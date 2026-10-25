/**
 * External installer — `EXTERNAL_ASSETS` 매트릭스를 실제 호출로 변환.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F1
 *
 * Decision (OQ1): 실패는 warn-skip. 종료 시 누락 자산 목록 보고.
 *   abort는 첫 실행 신뢰성을 깨뜨리므로 채택 안 함 (vibe killer).
 *
 * Spawning은 `child_process.spawnSync` 사용. command/args 분리로 shell injection 차단.
 * stdout/stderr는 captured — 사용자에게 한 줄 요약만 노출 (verbose-log는 별도 옵션 후속).
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
  accessSync,
  existsSync,
  constants as fsConstants,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { CATEGORIES as CATEGORY_ORDER } from "./categories.js";
import {
  assetReachesCli,
  EXTERNAL_ASSETS,
  type ExternalAsset,
  type ExternalAssetMethod,
  filterApplicableAssets,
} from "./external-assets.js";
import {
  backupFile,
  backupFromCopy,
  backupLink,
  backupOriginal,
  claimBackupDir,
  listEntriesRecursive,
  listFilesRecursive,
} from "./fs-ops.js";
import {
  buildAssetEntries,
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  installedClis,
  mergeRootFiles,
  readInstallLog,
  skillNames,
  writeInstallLog,
} from "./install-log.js";
import type { JudgedWrite } from "./install-writes.js";
import { LINES, withBackup } from "./judge.js";
import { outsideProjectTarget } from "./outside-project.js";
import { excludedIds, recorded } from "./recorded.js";
import {
  type CliTargets,
  DEFAULT_OPTIONS,
  type InstallScope,
  type OptionFlags,
  resolveScope,
  type Track,
} from "./types.js";

export interface ExternalInstallerDeps {
  /** Override `spawnSync` for tests (mock으로 호출 횟수 + args 검증). */
  spawn?: (cmd: string, args: ReadonlyArray<string>, opts: SpawnOpts) => SpawnSyncReturns<string>;
  /** asset 매트릭스 override (테스트용, 기본 EXTERNAL_ASSETS 전체). */
  assets?: ReadonlyArray<ExternalAsset>;
  /** 진행 상황 로그 stream (기본 console.log). 일반 로그용. */
  log?: (msg: string) => void;
  /** 경고 메시지 stream (기본 console.error). */
  warn?: (msg: string) => void;
  /**
   * 자산 설치 시작 직전 호출 (streaming UI용).
   * Renderer가 "→ asset (installing...)" 라인 출력에 사용.
   */
  onAssetStart?: (asset: ExternalAsset) => void;
  /**
   * 자산 설치 완료 후 호출 (streaming UI용).
   * Renderer가 "✓/⊘ asset    meta" 라인 출력에 사용.
   */
  onAssetResult?: (result: AssetInstallResult) => void;
}

interface SpawnOpts {
  encoding: "utf8";
  stdio: ("ignore" | "pipe")[] | "ignore" | "pipe";
  timeout?: number;
  /** v26.77.0 — 작업 디렉토리. projectDir 로 고정해 자산이 올바른 프로젝트에 착지. */
  cwd?: string;
}

export interface AssetInstallResult {
  asset: ExternalAsset;
  ok: boolean;
  /** ok=false 시 user-facing 메시지 */
  message?: string;
  /**
   * v26.59.0 — 설치된 자산 version. install 후 detectVersion 으로 path 기반 추출.
   * plugin: ~/.claude/plugins/cache/<marketplace>/<plugin>/<VERSION>/ 디렉토리명
   * npm-global: <npm root -g>/<pkg>/package.json 의 version
   * 그 외 method (skill, npx-run): 표준 metadata 없음 → undefined.
   */
  version?: string;
  /**
   * #573 — project scope `skill` 만. 이 호출 동안 도구(`npx skills add`)가 스킬 자리(`SKILL_ROOTS`)에 놓은 파일.
   * uninstall 은 외부 도구의 에이전트 해석에 맡기지 않고 **기록된 이 경로만** 지운다. 판정은 호출 전후 비교다 —
   * 디스크 존재는 소유의 근거가 아니므로(ADR-096) 호출 **전에** 있던 파일은 `created` 가 아니다.
   */
  files?: ToolFiles;
  /**
   * #851 (ADR-112) — global scope 의 소스 전체 `skill`(`method.skill` 없음)만. 이 호출이 홈 스킬 자리에 깐 스킬 폴더 이름
   * (`homeSkillDirs` 전후 비교 ∩ 도구 잠금 파일이 이 소스로 적은 이름 — `lockedSkillNames`). 기록의 `skills` 가 된다. 부재 = 잴 수
   * 없었다(잠금 파일을 못 읽었다 — 기록하지 않는다).
   */
  skills?: string[];
  /**
   * #678 — 스킬 자리가 링크를 따라 **프로젝트 밖**으로 풀려 도구를 그 자리로 부르지 않은 것(설치 화면이 함께 말한다).
   * `root` = project 상대 스킬 자리(`.claude/skills` 등), `target` = 그 자리가 풀린 절대경로.
   */
  outside?: ReadonlyArray<{ root: string; target: string }>;
}

/**
 * #573 — 도구 호출 한 번이 스킬 자리에 남긴 것. 경로는 project 상대.
 * - `created` 호출 전에 없던 파일 — 도구가 이번에 놓았다.
 * - `changed` 호출 전에도 있었고 내용이 바뀐 파일 — 기록이 이미 그 자산 것이라 말할 때만 sha 를 갱신한다
 *   (`buildInstallLog`). 기록 없는 파일은 설치자 것일 수 있어 여기 있다는 이유로 소유하지 않는다.
 */
export interface ToolFiles {
  created: InstallLogSkillFile[];
  changed: InstallLogSkillFile[];
}

/**
 * `npx skills add --agent … --copy` 가 사본을 놓는 자리 — claude-code 는 `.claude/skills/`, codex · opencode ·
 * antigravity 는 공용 `.agents/skills/`(`SKILLS_CLI_AGENT_MAP` 주석). `--agent` 를 넘기지 않는 레거시 경로(`cli: []`)는
 * 더 많은 도구 자리에 깔지만 그 자리는 기록하지 않는다 — 남는 것은 지우지 않는 쪽이다.
 */
const SKILL_ROOTS = [".claude/skills", ".agents/skills"] as const;

/** `npx skills add --agent <cli> --copy` 가 그 CLI 몫을 놓는 자리. */
function skillRootOf(cli: CliTargets[number]): (typeof SKILL_ROOTS)[number] {
  return cli === "claude" ? ".claude/skills" : ".agents/skills";
}

/**
 * 스킬 자리의 파일 → sha. 링크 자리는 건너뛴다(`listFilesRecursive` — 남의 설치 포인터는 우리 것이 아니다).
 * #678 — 자리 자체가 프로젝트 밖으로 풀리면 그 자리는 훑지 않는다 — 밖의 파일을 하네스 몫으로 기록하지 않는다.
 */
function snapshotSkillRoots(projectDir: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const root of SKILL_ROOTS) {
    if (outsideProjectTarget(projectDir, join(projectDir, root)) !== null) continue;
    for (const rel of listFilesRecursive(join(projectDir, root))) {
      const path = `${root}/${rel}`;
      try {
        out.set(path, hashContent(readFileSync(join(projectDir, path), "utf8")));
      } catch {
        /* 읽지 못한 파일은 소유를 주장할 근거가 없다 — 기록하지 않는다 */
      }
    }
  }
  return out;
}

/**
 * #851 (ADR-112) — 홈 스킬 자리의 스킬 폴더마다 정체(`ino:ctime`). 도구(`skills@1.5.11` `installSkillForAgent` 의 `--copy` 경로)는 까는
 * 폴더를 **지우고 새로 만든다**(`cleanAndCreateDirectory`) — 그래서 이미 깔려 있던 같은 바이트의 폴더도 호출 뒤 정체가 바뀐다(내용
 * 비교는 이미 있던 폴더를 놓친다). 정체는 호출 중 다른 손(설치자 편집기의 원자 저장 · 다른 프로세스)이 바꾼 폴더도 잡으므로 이것만으로
 * 이름을 정하지 않는다 — 잠금 파일(`lockedSkillNames`)과 겹친 것만 쓴다. 링크 · 파일은 스킬 폴더가 아니다(`--copy` 는 폴더를 만든다).
 */
function homeSkillDirs(roots: ReadonlyArray<string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const root of roots) {
    let names: string[];
    try {
      names = readdirSync(root);
    } catch {
      continue; // 자리가 아직 없다
    }
    for (const name of names) {
      try {
        const st = lstatSync(join(root, name), { bigint: true });
        if (st.isDirectory()) out.set(join(root, name), `${st.ino}:${st.ctimeNs}`);
      } catch {
        /* 읽지 못한 자리는 이름의 근거가 아니다 */
      }
    }
  }
  return out;
}

/** 호출 전후 정체가 다른(새로 생긴) 스킬 폴더 이름. */
function writtenSkillNames(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): string[] {
  const names = [...after]
    .filter(([dir, id]) => before.get(dir) !== id)
    .map(([dir]) => basename(dir));
  return [...new Set(names)].sort();
}

/**
 * #851 (ADR-112) — 도구 잠금 파일이 이 소스로 적은 스킬의 폴더 이름. `skills@1.5.11` 실측(`getSkillLockPath` · `addSkillToLock` ·
 * `sanitizeName`): global 설치마다 `$XDG_STATE_HOME/skills/.skill-lock.json`(없으면 `~/.agents/.skill-lock.json`)의 `skills[<스킬 이름>]` 에
 * `source`(github 줄임 `owner/repo` 는 그대로)를 적고, 폴더 이름은 그 스킬 이름을 정규화한 것이다. 못 읽거나 도구가 읽지 않는 판이면
 * `null` — 이름을 기록하지 않는다(덜 회수하는 쪽).
 */
function lockedSkillNames(source: string): Set<string> | null {
  const xdg = process.env.XDG_STATE_HOME;
  const path = xdg
    ? join(xdg, "skills", ".skill-lock.json")
    : join(homedir(), ".agents", ".skill-lock.json");
  try {
    const lock = JSON.parse(readFileSync(path, "utf8")) as { version?: unknown; skills?: unknown };
    if (typeof lock.version !== "number" || lock.version < 3) return null;
    if (typeof lock.skills !== "object" || lock.skills === null) return null;
    const out = new Set<string>();
    for (const [name, entry] of Object.entries(lock.skills as Record<string, unknown>)) {
      if ((entry as { source?: unknown } | null)?.source === source)
        out.add(toolSkillDirName(name));
    }
    return out;
  } catch {
    return null;
  }
}

/** `skills@1.5.11` `sanitizeName` 그대로 — 스킬 이름 → 그 도구가 만드는 폴더 이름. */
function toolSkillDirName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._]+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .substring(0, 255) || "unnamed-skill"
  );
}

function diffSnapshots(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>,
): ToolFiles {
  const created: InstallLogSkillFile[] = [];
  const changed: InstallLogSkillFile[] = [];
  for (const [path, sha256] of after) {
    const prior = before.get(path);
    if (prior === undefined) created.push({ path, sha256 });
    else if (prior !== sha256) changed.push({ path, sha256 });
  }
  return { created, changed };
}

export interface ExternalInstallReport {
  /** 적용 시도된 자산 (조건 통과한 것만) */
  attempted: ReadonlyArray<AssetInstallResult>;
  /** 성공 갯수 */
  succeeded: number;
  /** warn-skip 된 갯수 */
  skipped: number;
  /**
   * v26.102.0 (ADR-031) — 조건은 통과했으나 선택 CLI 와 도달 범위(assetCliSupport)의
   * 교집합이 없어 **시도조차 하지 않은** 자산 (예: codex 단독 설치의 claude 전용 plugin).
   * 침묵 제외 금지 — render 가 이 목록을 사용자에게 고지한다 (no-false-ship).
   */
  excludedByCli: ReadonlyArray<ExternalAsset>;
}

const DEFAULT_SPAWN_TIMEOUT_MS = 120_000;
/**
 * #422 — `npm install` 계열은 큰 CLI(netlify-cli 26.x 는 413 MB · 컨테이너 실측 86초)를 받는다.
 * 120초는 느린 망·기존 lockfile 해석에서 넘기고, 그동안 화면은 침묵이라 설치자에게는 "멈춤"이다.
 * 진행 표시는 렌더러(`onAssetStart`)가, 시간 상한은 여기서 — 넘기면 직접 돌릴 명령을 알려 준다.
 */
const NPM_SPAWN_TIMEOUT_MS = 600_000;

/** method.kind 별 spawn 시간 상한 — 패키지 설치는 길고, 그 밖은 기본값. */
function spawnTimeoutFor(kind: ExternalAsset["method"]["kind"]): number {
  return kind === "npm" || kind === "npx-run" ? NPM_SPAWN_TIMEOUT_MS : DEFAULT_SPAWN_TIMEOUT_MS;
}

/**
 * v26.102.0 (ADR-031) — external 단계의 대상/배제 판정 **단일 지점**. 규칙 = 조건 통과 ∧
 * non-internal(Phase 1 담당) ∧ 선택 CLI 도달. runExternalInstall(시도 목록)과
 * runExternalPhase(헤더 카운트)가 이 함수만 호출한다 — 같은 규칙을 두 파일에 각각 기술하면
 * 3번째 조건이 생길 때 카운트만 조용히 어긋난다 (SOD 리뷰 Important-6, no-false-ship
 * "동일 목록 2곳 하드코딩 금지").
 */
export function selectExternalTargets(
  assets: ReadonlyArray<ExternalAsset>,
  ctx: {
    tracks: ReadonlyArray<Track>;
    options: OptionFlags;
    cli: CliTargets;
    userOverride?: { forceInclude: ReadonlyArray<string>; forceExclude: ReadonlyArray<string> };
  },
): { targets: ExternalAsset[]; excludedByCli: ExternalAsset[] } {
  const conditionPassed = filterApplicableAssets(assets, ctx).filter(
    (a) => a.method.kind !== "internal",
  );
  return {
    targets: conditionPassed.filter((a) => assetReachesCli(a, ctx.cli)),
    excludedByCli: conditionPassed.filter((a) => !assetReachesCli(a, ctx.cli)),
  };
}

/**
 * spec에 적용 가능한 자산을 모두 시도. 실패는 warn-skip (기본).
 */
export function runExternalInstall(
  ctx: {
    tracks: ReadonlyArray<Track>;
    options: OptionFlags;
    cli: CliTargets;
    /** v26.47.0 — Phase C full user override (forceInclude/forceExclude). */
    userOverride?: { forceInclude: ReadonlyArray<string>; forceExclude: ReadonlyArray<string> };
    /** v26.64.0 (ADR-020) — Install scope. undefined → default "project". */
    scope?: InstallScope;
    /**
     * v26.77.0 — 외부 설치기 spawn 의 작업 디렉토리.
     * 미지정 시 process.cwd(). 핵심: npm(--save-dev)·npx-run(bmad --directory .)·
     * plugin(--scope project, claude 의 cwd 기반 project 탐지)·skill 이 모두 cwd 기준으로
     * 착지하므로, --project-dir 가 cwd 와 다르면 cwd 를 projectDir 로 맞춰야 자산이 올바른
     * 프로젝트에 떨어진다 (이 누락 = 2026-06-07 probe 가 repo 를 오염시킨 근본 원인).
     */
    projectDir?: string;
  },
  deps: ExternalInstallerDeps = {},
): ExternalInstallReport {
  const log = deps.log ?? console.log;
  const warn = deps.warn ?? console.error;
  const spawn = deps.spawn ?? defaultSpawn;
  const assets = deps.assets ?? EXTERNAL_ASSETS;
  const projectDir = ctx.projectDir ?? process.cwd();

  // v26.81.0 (ADR-022) — internal 자산(tauri-desktop)은 Phase 1 의
  //   manifest/transform 이 설치 주체 — external(spawn) 단계에서 제외. Phase 1 의
  //   templates 행으로 사용자에게 이미 가시화됨 (중복 보고 방지).
  // v26.102.0 (ADR-031, Batch3) — CLI 도달 범위 필터. 선택 CLI 와 교집합 없는 자산은
  // spawn 자체를 배제한다: codex 단독 설치가 claude 전용 plugin 을 `claude plugin ...` 으로
  // spawn 해 ~/.claude/plugins 를 오염시키던 P0 [4cli-asymmetry-cluster] 의 구조적 fix.
  // 제외분은 excludedByCli 로 보고 — 침묵 제외 금지 (no-false-ship).
  const { targets: applicable, excludedByCli } = selectExternalTargets(assets, ctx);
  // v26.55.0 — Phase 2 grouped progress UX. 카테고리 순서로 정렬 → install.ts 의 onAssetStart
  // callback 이 category 변경 감지로 헤더 출력 가능. ADR-016.
  const sorted = [...applicable].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category);
    const bi = CATEGORY_ORDER.indexOf(b.category);
    return ai - bi;
  });
  const attempted: AssetInstallResult[] = [];
  const cli = ctx.cli;
  const scope = resolveScope(ctx.scope);

  for (const asset of sorted) {
    deps.onAssetStart?.(asset);
    log(`  → ${asset.description}`);
    const baseResult = installOne(asset, { spawn, cli, scope, projectDir });
    let result: AssetInstallResult = baseResult;
    if (baseResult.ok) {
      const v = detectVersion(asset.method, spawn, scope, projectDir);
      if (v) result = { ...baseResult, version: v };
    }
    deps.onAssetResult?.(result);

    if (!result.ok) {
      // v26.79.0 — 모든 실패는 warn-skip (abort 는 vibe killer 라 미채택). 죽은
      //   failureMode/aborted 메커니즘 제거 (사용 자산 0 + 렌더러 미참조).
      warn(`    [warn-skip] ${asset.id}: ${result.message ?? "failed"}`);
    }

    attempted.push(result);
  }

  return {
    attempted,
    succeeded: attempted.filter((r) => r.ok).length,
    skipped: attempted.filter((r) => !r.ok).length,
    excludedByCli,
  };
}

/**
 * 자산 1개 설치. method.kind 별 적절한 명령 실행.
 */
function installOne(
  asset: ExternalAsset,
  ctx: {
    spawn: NonNullable<ExternalInstallerDeps["spawn"]>;
    cli: CliTargets;
    scope: InstallScope;
    /** v26.77.0 — spawn cwd. 자산이 올바른 프로젝트에 착지하도록 projectDir 로 고정. */
    projectDir: string;
  },
): AssetInstallResult {
  const { method } = asset;
  const cwd = ctx.projectDir;
  switch (method.kind) {
    case "skill": {
      // global 은 홈에 깐다 — 이 프로젝트에 놓은 것이 없다(되돌리기는 안내뿐, D16)
      if (ctx.scope === "global") {
        const args = buildSkillArgs(method, ctx.cli, ctx.scope);
        if (method.skill !== undefined) return runSpawn(asset, ctx.spawn, "npx", args, cwd);
        // #851 (ADR-112) — 소스 전체를 까는 자산은 무엇을 깔았는지 이름이 없다 — 홈 스킬 자리를 호출 전후로 재 기록에 남긴다
        const roots = [
          ...new Set(
            (ctx.cli.length === 0 ? [...SKILL_ROOTS] : ctx.cli.map(skillRootOf)).map(
              globalSkillRoot,
            ),
          ),
        ];
        const before = homeSkillDirs(roots);
        const result = runSpawn(asset, ctx.spawn, "npx", args, cwd);
        if (!result.ok) return result;
        // 호출 중 다른 손이 바꾼 폴더는 이 자산 것이 아니다 — 도구가 이 소스로 잠금 파일에 적은 이름과 겹친 것만
        const locked = lockedSkillNames(method.source);
        if (locked === null) return result;
        const written = writtenSkillNames(before, homeSkillDirs(roots));
        return { ...result, skills: written.filter((n) => locked.has(n)) };
      }
      // #678 — 스킬 자리가 프로젝트 밖으로 풀리는 CLI 는 그 자리로 도구를 부르지 않는다(도구는 링크를 따라 밖에 쓴다).
      // 남은 CLI 가 없으면 부르지 않는다. 에이전트 미지정(레거시 `cli: []`)은 두 자리 모두 쓰므로 하나라도 밖이면 부르지 않는다.
      const outside = SKILL_ROOTS.flatMap((root) => {
        const hit = outsideProjectTarget(cwd, join(cwd, root));
        return hit === null ? [] : [{ root, target: hit.target }];
      });
      const outRoots = new Set(outside.map((o) => o.root));
      const cli = ctx.cli.filter((c) => !outRoots.has(skillRootOf(c)));
      if (outside.length > 0 && cli.length === 0) {
        const where = outside.map((o) => `${o.root} → ${o.target}`).join(", ");
        return {
          asset,
          ok: false,
          message: `not installed — the skill folder links outside the project (${where}); left as is`,
          outside,
        };
      }
      const usedOutside = outside.filter((o) => ctx.cli.some((c) => skillRootOf(c) === o.root));
      const args = buildSkillArgs(method, cli, ctx.scope);
      const before = snapshotSkillRoots(cwd);
      const result = runSpawn(asset, ctx.spawn, "npx", args, cwd);
      if (!result.ok) return result;
      return {
        ...result,
        files: diffSnapshots(before, snapshotSkillRoots(cwd)),
        ...(usedOutside.length > 0 ? { outside: usedOutside } : {}),
      };
    }
    case "plugin":
      return installPlugin(asset, ctx.spawn, method, ctx.scope, cwd);
    case "npm": {
      // v26.64.0 (ADR-020) — scope=project 시 devDep, scope=global 시 -g.
      // v26.68.0 — method.kind "npm-global" → "npm" rename (scope 분기와 무관 의미).
      // v26.80.0 — pinned 버전 설치 (`pkg@version`). vetting 시점의 코드만 실행 (보안 wedge).
      const pinned = `${method.pkg}@${method.version}`;
      return runSpawn(
        asset,
        ctx.spawn,
        "npm",
        ctx.scope === "global" ? ["install", "-g", pinned] : ["install", "--save-dev", pinned],
        cwd,
      );
    }
    case "npx-run":
      // v26.80.0 — pinned 버전 실행 (`cmd@version`). 이전 `cmd` 에 "@latest" 인라인이던 것을
      //   구조 필드로 분리 (cmd 는 bare 이름 — drift override/라벨이 이름 그대로 사용).
      return runSpawn(
        asset,
        ctx.spawn,
        "npx",
        [`${method.cmd}@${method.version}`, ...(method.args ?? [])],
        cwd,
      );
    case "internal":
      // v26.81.0 (ADR-022) — 도달 불가 (runExternalInstall 이 사전 필터). exhaustive switch
      //   + 방어: 도달해도 spawn 없이 ok (Phase 1 manifest 가 실 설치 주체).
      return { asset, ok: true, message: "internal template (installed by Phase 1 manifest)" };
  }
}

/**
 * v26.39.5 fix — `--agent <list>` 명시 추가 (사용자 보고 #3 진짜 fix).
 *
 * `npx skills add` default 동작은 `*` (all installed agents) → universal install →
 * `.factory/skills/`, `.goose/skills/` 자동 생성. v0.8.0 의 `.gitignore` 패턴 추가만으론
 * git noise 만 차단하고 disk 디렉토리 생성은 막지 못함.
 *
 * 본 fix: `spec.cli` 의 base CLI 만 콤마 구분 명시 → 의도된 agent 만 install.
 *
 * v26.39.6 fix — skills CLI agent name 매핑.
 * skills CLI 1.5.5 valid agent 이름은 `claude-code` 인데 우리 CliBase 는 `claude`.
 * 매핑 누락 시 `Invalid agents: claude` 로 exit 1 → 외부 사용자 (실사용 리포
 * reproduce 2026-05-06) 환경에서 7건 skill 자산 100% skip.
 */
const SKILLS_CLI_AGENT_MAP: Record<CliTargets[number], string> = {
  claude: "claude-code",
  codex: "codex",
  opencode: "opencode",
  // v26.66.0 — Antigravity (Google) skills agent. `.agents/skills/` 표준 공유 (codex transform 산출과 동일).
  antigravity: "antigravity",
};

/**
 * `npx skills` CLI 고정 버전 — unpinned 면 upstream breaking 이 설치·검증을 동시에 깬다
 * (1.5.5→1.5.7 multi-agent `--agent` 플래그 파손 전례). bump 시 Docker 시나리오 재검증 필수.
 * audit CODE-4/D-1. scripts/verify-catalog.mjs 와 동일 값 유지 (drift 테스트 가드).
 */
export const SKILLS_CLI_VERSION = "1.5.11";

/** `npx skills <subcommand>` 의 첫 인자 — 항상 버전 고정. */
export function skillsCliSpec(): string {
  return `skills@${SKILLS_CLI_VERSION}`;
}

/** `update` 가 외부 스킬을 갱신했는지에 대한 보고 (#374). */
export interface ExternalSkillRefresh {
  /** 갱신을 시도한 자산 수. 0 = 설치 기록에 외부 스킬이 없다. */
  attempted: number;
  /** 그중 성공한 수. */
  refreshed: number;
  /** 실패한 자산 — 화면에 이름을 낸다. 실패해도 update 는 계속한다. */
  failed: ReadonlyArray<{ id: string; message: string }>;
  /**
   * 설치 기록에는 있는데 **지금 카탈로그에 없는** 스킬 자산 id — 갱신 대상이 아니다.
   *
   * 침묵하면 사용자는 깔린 3종 중 2종만 갱신됐다는 사실을 알 수 없다. 이 저장소는 실제로
   * 자산을 지운 적이 있다(`north-star-skill`) — 그 릴리즈 뒤 옛 설치본이 도는 자리다.
   */
  notInCatalog: ReadonlyArray<string>;
  /** #817 — 도구 호출 전후로 지킨 파일의 백업마다 판정의 줄(고친 기록 파일 · 비켜 둔 설치자 파일). 부재 = 없음. */
  judged?: JudgedWrite[];
  /** #851 (ADR-112) — 옛 update 가 프로젝트에 만든 global 자산 사본을 회수한 자리. 백업은 `judged` 에 든다. 부재 = 없음. */
  reclaimed?: GlobalCopyReclaim[];
  /**
   * **설치 기록이 없어 무엇을 갱신해야 하는지 판정할 수 없다** (레거시 설치본).
   *
   * `attempted: 0` 과 구분한다 — 그쪽은 "갱신할 게 없다"이고 이쪽은 "모른다"다. 둘을 같은
   * 침묵으로 합치면 이 이슈가 고치려던 실패 형태(조용한 무동작)가 그대로 남는다.
   */
  unknown: boolean;
}

/**
 * 이미 깔린 외부 스킬을 상류 최신판으로 다시 받는다 (#374).
 *
 * **왜 있나**: `update` 는 우리가 놓아둔 정책 파일과 우리가 렌더한 CLI 산출물만 새로 썼다.
 * `npx skills add` 로 깐 스킬 본문은 그 경로에 없어서 **한 번도 갱신되지 않았다**(실측
 * 2026-08-27, npx 호출 추적: install 2회 · update 0회). 그런데 화면에는
 * `✓ external CLI artifacts` 가 떠서 다 된 것처럼 보였다.
 *
 * **`skills update` 를 쓰지 않는 이유** (독립 리뷰가 잡은 CRITICAL, 실측 2026-08-27):
 * 그 서브명령은 **`--copy` 도 `--agent` 도 받지 않는다**(도움말의 *Update Options* = `-g`·`-p`·`-y`
 * 뿐). 그래서 자기 기본 배치로 스킬 자리를 다시 만들고, 결과가 이렇다:
 *
 *   claude 단독 설치 · install 직후 → `.claude/skills/<id>` = 실제 디렉터리 · `.agents/` 없음
 *   같은 프로젝트에 `skills update` → `.claude/skills/<id>` = **`.agents/` 로의 심링크**,
 *                                     고른 적 없는 `.agents/` 트리가 **생성**됨
 *
 * 이건 #372 가 세운 "두 자리에 각각 실제 사본" 계약을 되돌린다. 측정된 해악은 셋이다:
 * ⓐ 고른 적 없는 CLI 의 자산 트리가 생긴다(ADR-031 이 P0 로 닫은 형태) ⓑ 사용자가 정체 모를
 * `.agents/` 를 지우면 `.claude/skills/*` 는 **끊긴 링크**가 되어 본문이 사라진다
 * ⓒ 슬롯 이름이 번들 스킬과 겹치면 `foreign-slot.ts` 가 디렉터리 아닌 자리를 "남의 것"으로
 * 판정해(#343) 하네스 writer 가 건너뛴다.
 *
 * *(초판은 여기에 "그 뒤로 우리 최신본이 영영 그 자리에 안 들어간다"고 적었는데 **틀렸다** —
 * 외부 스킬 id 는 `templates/skills/` 에 없어 우리 writer 가 그 자리를 겨냥하지 않고, 실측에서
 * 이 구현은 이미 심링크가 된 슬롯을 오히려 디렉터리로 **복구한다**. 독립 리뷰가 반증했다.)*
 *
 * **그래서 install 과 같은 호출**(`add … --agent … --copy --yes`)을 다시 돌린다. 실측으로
 * 재실행은 상류 최신판을 받아오고(변이 1 → 0) 두 자리가 실제 디렉터리로 유지된다.
 * 같은 함수(`runExternalInstall`)를 쓰는 이유는 ADR-049 와 같다 — 인자 조립을 두 벌 두면
 * 한쪽만 고쳐지는 순간 조용히 갈린다.
 *
 * **대상은 설치 기록에 적힌 스킬 자산뿐이다.** 트랙·옵션에서 다시 유도하지 않는다 — 그러면
 * 사용자가 고른 적 없는 자산이 update 로 새로 깔릴 수 있고, 반대로 opt-in 으로 깐 자산이
 * 조건 불일치로 조용히 빠진다. `forceInclude` 로 조건 판정을 우회해 **깐 것을 깐 그대로**
 * 다시 받는다.
 *
 * **그 우회는 신뢰 티어 게이트도 지난다** — `shouldInstallAsset` 이 `forceInclude` 를 tier
 * 검사보다 앞에서 본다. 즉 자산이 나중에 experimental(T3)로 강등돼도 이미 깐 사람은 갱신을
 * 계속 받는다. 이건 부작용이 아니라 **결정**이다(ADR-078 Consequences): update 는 무엇을
 * 깔지 다시 묻는 자리가 아니고, 티어 강등을 이유로 조용히 갱신을 끊으면 사용자는 낡은 본문을
 * 쥔 채 그 사실을 모른다. 강등 자체는 `trust-tier-drift` 가 따로 감시한다.
 */
export function refreshExternalSkills(
  projectDir: string,
  deps: Pick<ExternalInstallerDeps, "spawn" | "assets" | "log" | "warn"> & {
    /** 설치 기록 읽기 주입점 (테스트용). 기본 `readInstallLog`. */
    readLog?: (projectDir: string) => InstallLog | null;
    /** 실 설치 주입점 (테스트용). 기본 `runExternalInstall`. */
    run?: typeof runExternalInstall;
    /** 설치 기록 쓰기 주입점 (테스트용). 기본 `writeInstallLog`. */
    writeLog?: (projectDir: string, log: InstallLog) => void;
  } = {},
): ExternalSkillRefresh {
  const none = { attempted: 0, refreshed: 0, failed: [] as const, notInCatalog: [] as const };
  const log = (deps.readLog ?? readInstallLog)(projectDir);
  // 기록 없음: CLI 경로로는 도달 불가 — 진입 판정(#699)이 먼저 거절. 엔진 단위 방어("판정 불가").
  if (!log) {
    return { ...none, unknown: true };
  }
  // #851 (ADR-112) — 옛 update 가 global 자산을 `-g` 없이 다시 받아 프로젝트에 만든 사본을 회수한다. 도구를 부르기 **전에** —
  // 홈 사본을 이번 갱신 전의 판으로 대고, 아래 hold 가 그 파일을 설치자 파일로 옮겨 두지 않게.
  const reclaimed = reclaimGlobalSkillCopies(projectDir, log, { write: true });
  const copies = {
    ...(reclaimed.length > 0 ? { reclaimed } : {}),
    ...(reclaimed.some((r) => r.judged.length > 0)
      ? { judged: reclaimed.flatMap((r) => r.judged) }
      : {}),
  };
  // ADR-099 R3 — 설치자가 뺀 자산(누적 `excluded`)은 기록에 깔렸다고 남아 있어도 갱신하지도 되살리지도 않는다(#566)
  const excluded = excludedIds(log);
  const installedIds = new Set(
    log.assets.filter((a) => a.method === "skill" && !excluded.has(a.id)).map((a) => a.id),
  );
  const catalog = deps.assets ?? EXTERNAL_ASSETS;
  const targets = catalog.filter((a) => a.method.kind === "skill" && installedIds.has(a.id));
  // 기록에는 있는데 카탈로그에서 사라진 자산 — 갱신할 방법이 없다. 화면에 이름을 낸다.
  const inCatalog = new Set(targets.map((a) => a.id));
  const notInCatalog = [...installedIds].filter((id) => !inCatalog.has(id));
  if (targets.length === 0) {
    return { ...none, notInCatalog, unknown: false, ...copies };
  }
  // #770 (ADR-097 결정 3·5) — 도구(`npx skills add --copy`)는 스킬 폴더를 **새로 만든다**(컨테이너 실측: 폴더 안의
  // 기록 밖 파일이 사라진다). 그래서 호출 **전에** 그 폴더의 내용을 들고 있다가 호출 **뒤에** 판정한다 — 설치자가 고친
  // 하네스 파일(기록 sha 와 다름)은 그 파일 하나를 백업하고, 안 고친 파일은 조용히 갱신되며, 설치자 파일(기록 밖 —
  // 노트 · 앞선 update 의 백업)은 제자리로 되돌린다. 화면·목록은 `collectRunBackups` 가 디스크에서 줍는다.
  // #851 — 자산마다 기록된 scope 로 다시 받는다. `log.scope` 는 마지막 install 의 것이라 global 로 깐 자산 뒤에 플래그 없는
  // 재설치가 있었으면(mixed 이력 — #560) project 를 말한다. 그걸로 부르면 `-g` 없이 프로젝트에 기록 밖 사본이 생긴다.
  const scopeOf = (a: ExternalAsset): InstallScope =>
    resolveScope(log.assets.find((r) => r.id === a.id)?.scope ?? log.scope);
  // #902 — 옛 판이 파일 목록 없이 깐 자산의 자리도 든다(다른 바이트 · 빠진 파일은 백업만). 드는 자리도 자산의 기록 scope 로 고른다 —
  // `log.scope` 로 고르면 project 로 깐 뒤 `--scope global` 을 돌린 설치본에서 자리가 없었다(PR #906 리뷰 R1-BLOCKER-1)
  const targetIds = new Set(targets.map((a) => a.id));
  const clis = [...installedClis(log)] as CliTargets;
  const inProject = targets.filter((a) => scopeOf(a) === "project");
  const slotCtx = { log, scope: "project" as const };
  const settle = holdSkillSlots(projectDir, {
    recorded: log.assets.filter((a) => targetIds.has(a.id)),
    slots: skillSlotsFor(inProject, clis, slotCtx),
    unlisted: unlistedSkillSlots(inProject, clis, slotCtx),
    log,
    clis,
    scope: "project",
  });
  const run = deps.run ?? runExternalInstall;
  let ran: ExternalInstallReport;
  try {
    const runs = [...new Set(targets.map(scopeOf))].map((scope) =>
      run(
        {
          tracks: log.spec.tracks as ReadonlyArray<Track>,
          // `forceInclude` 가 조건 판정을 앞지르므로 옵션 값은 결과에 영향을 주지 않는다.
          options: DEFAULT_OPTIONS,
          // #528 — 대상 CLI 는 **깔린 집합**(`installedClis`)이다. `spec.cli` 는 마지막 install 의
          // 요청이라 `uninstall --cli` 뒤에도 뺀 CLI 를 말하고, 반대로 그걸 비우면 `buildSkillArgs` 가
          // `--agent`·`--copy` 를 못 붙여 Claude 몫이 조용히 빠진다(재리뷰 BLOCKER-3).
          cli: clis,
          userOverride: { forceInclude: [...installedIds], forceExclude: [] },
          scope,
          projectDir,
        },
        {
          assets: targets.filter((a) => scopeOf(a) === scope),
          ...(deps.spawn ? { spawn: deps.spawn } : {}),
          ...(deps.log ? { log: deps.log } : {}),
          ...(deps.warn ? { warn: deps.warn } : {}),
        },
      ),
    );
    ran = {
      attempted: runs.flatMap((r) => r.attempted),
      succeeded: runs.reduce((n, r) => n + r.succeeded, 0),
      skipped: runs.reduce((n, r) => n + r.skipped, 0),
      excludedByCli: runs.flatMap((r) => r.excludedByCli),
    };
  } catch (e) {
    // #780 — 도구 호출이 예외로 끝났다. 옮긴 파일을 제자리로 — 되돌리지 못한 파일은 백업 폴더에 남는다
    try {
      settle(null);
    } catch {
      // 원래 예외가 원인이다 — 되돌리지 못한 파일은 백업 폴더에 그대로 있다
    }
    throw e;
  }
  const { report, displaced, judged } = settle(ran);
  // #770 — 도구가 다시 쓴 sha 로 기준선을 잇는다. 안 이으면 상류가 바뀐 다음 update 가 안 고친 파일을 "고쳤다" 로 백업한다.
  // #780 — 상류 파일에 덮여 비켜 둔 설치자 파일(`displaced`)도 같은 쓰기로 적는다 — uninstall 이 그 원본을 되돌린다
  const next = recordRefreshedFiles(
    projectDir,
    log,
    report,
    displaced,
    deps.writeLog ?? writeInstallLog,
  );
  // #851 (ADR-112) — 이번 갱신이 처음 기록한 스킬 이름(이름이 없던 옛 기록)의 프로젝트 사본. 갱신 전 회수는 이름을 몰라 못 봤다 —
  // 홈 사본이 이미 새 판이라 상류가 바꾼 파일은 "다르다" 로 백업하고 지운다(무손실).
  const late = reclaimNewlyNamed(projectDir, log, next);
  const reclaimedAll = [...reclaimed, ...late];
  return {
    attempted: report.attempted.length,
    refreshed: report.succeeded,
    failed: report.attempted
      .filter((r) => !r.ok)
      .map((r) => ({ id: r.asset.id, message: r.message ?? "failed" })),
    notInCatalog,
    unknown: false,
    ...(reclaimedAll.length > 0 ? { reclaimed: reclaimedAll } : {}),
    judged: [...reclaimedAll.flatMap((r) => r.judged), ...judged],
  };
}

/**
 * #770 · #780 (ADR-097 결정 3·5·7) — 외부 스킬 도구(`npx skills add --copy`)는 스킬 폴더를 **새로 만든다**. 그래서 부르기
 * **전에** 이번에 도구가 쓸 스킬 자리의 지킬 파일(설치자 파일 · 고친 하네스 파일)을 스킬 루트 밖 평범한 백업 폴더
 * `<스킬 루트>.backup-<시각>/<id>/`(같은 상대 경로)로 **옮기고**, 호출 **뒤에** 부를 판정 함수를 돌려준다. update 의 갱신 · install
 * 재실행 · 기존 설치본에 처음 더하기가 같은 도구 호출이라 이 한 함수를 함께 쓴다.
 *
 * 실행이 어디서 끊겨도(Ctrl-C · 예외 · 판정 도중 실패) 옮긴 파일은 그 백업 폴더에 그대로 남는다 — 되살리는 코드가 따로
 * 없다. 도구는 스킬 폴더(`<자리>`)만 새로 만들어 옆 폴더는 건드리지 않는다.
 *
 * `recorded` = 기록에 있는 이번 대상 자산(그 `files` 가 기록 sha 다) · `slots` = 이번 대상이 쓸 자리(`skillSlotsFor` —
 * 처음 더하는 자산은 기록이 없어 이것만이 자리를 말한다) · `unlisted` = 그 가운데 기록이 파일 목록 없이 말하는 자리
 * (`unlistedSkillSlots`) · `log` = 기록(하네스 · 다른 자산 것이라 말하는 경로는 옮기지 않는다) · `clis` · `scope` = 도구가
 * 실패한 자산의 자리를 가린다.
 *
 * 판정 함수에는 도구의 보고를 넘긴다 — `null` 이면 도구 호출이 예외로 끝났다(전부 제자리로). 도구가 실패한 자산의 자리도
 * 원본을 제자리로 되돌린다(리뷰 MEDIUM-1: 그 자산은 기록되지 않으니 displaced 로 적으면 "uninstall 이 되돌린다" 를 지킬
 * 수 없다). 돌려주는 보고에서는 설치자 바이트가 제자리로 돌아간 경로를 도구가 놓은 파일(`created`)에서 뺀다.
 *
 * #902 — `unlisted` 자리의 파일은 도구 것인지 설치자 것인지 모른다. 같은 바이트면 그대로 두고, 바이트가 다르거나 도구가 새로
 * 쓴 폴더에서 빠졌으면 그 파일 하나를 백업만 하고 되살리지 않는다(되살리면 상류가 바꾼 · 뺀 옛 도구 파일이 설치자 원본으로
 * 남는다). displaced 로도 적지 않는다. 기록에 목록을 추론해 적지도 않는다 — 그 자산은 계속 "모름" 이다(`buildAssetEntries`).
 */
export function holdSkillSlots(
  projectDir: string,
  hold: {
    recorded: ReadonlyArray<InstallLogAsset>;
    slots: ReadonlyArray<string>;
    unlisted?: ReadonlyArray<string>;
    log: InstallLog | null;
    clis: ReadonlyArray<CliTargets[number]>;
    scope: InstallScope | undefined;
  },
): <R extends ExternalInstallReport | null>(report: R) => SettledSlots<R> {
  const now = new Date();
  const asides = new Map<string, string>();
  const moved: AsideFile[] = [];
  try {
    for (const f of slotFilesToKeep(projectDir, hold)) {
      // 스킬 루트 밖(`.claude/skills.backup-<시각>/<id>/…`) — 루트 안에 두면 끊긴 실행이 남긴 폴더를 CLI 가 스킬로 읽는다
      const root = dirname(f.slot);
      let dir = asides.get(root);
      if (dir === undefined) {
        dir = claimBackupDir(join(projectDir, root), now);
        asides.set(root, dir);
      }
      const aside = join(dir, f.rel.slice(root.length + 1));
      mkdirSync(dirname(aside), { recursive: true });
      renameSync(f.abs, aside);
      moved.push({ ...f, aside });
    }
  } catch (e) {
    // 도구를 부르기 전이다 — 옮긴 것을 되돌리고 멈춘다
    for (const f of moved) renameSync(f.aside, f.abs);
    for (const dir of asides.values()) pruneEmptyDirs(dir);
    throw new Error(
      `could not move your files aside before the skill tool runs — nothing was changed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return <R extends ExternalInstallReport | null>(report: R): SettledSlots<R> => {
    const failedSlots =
      report === null
        ? null
        : skillSlotsFor(
            report.attempted.filter((r) => !r.ok).map((r) => r.asset),
            hold.clis,
            { log: hold.log, scope: hold.scope },
          );
    const out = {
      backups: [] as string[],
      displaced: [] as InstallLogRootFile[],
      judged: [] as JudgedWrite[],
    };
    // #902 — 도구가 이번에 새로 쓴 스킬 폴더. 파일 목록 없는 옛 기록의 파일이 그 폴더에서 빠졌으면 되살리지 않는다
    const rewritten = new Set(
      (report?.attempted ?? []).flatMap((r) =>
        r.ok ? (r.files?.created ?? []).map((x) => skillFolderOf(x.path)) : [],
      ),
    );
    const back = new Set<string>();
    const failed: string[] = [];
    for (const f of moved) {
      const restore =
        failedSlots === null || failedSlots.some((s) => f.rel === s || f.rel.startsWith(`${s}/`));
      try {
        const r = settleAside(projectDir, f, restore, rewritten.has(skillFolderOf(f.rel)));
        if (r === "back") {
          back.add(f.rel);
          continue;
        }
        out.backups.push(r.backup);
        if (r.displaced !== null) out.displaced.push(r.displaced);
        // 고친 기록 파일(sha) · 상류 파일에 덮여 비켜 둔 설치자 파일(none) · 목록 없는 옛 기록의 파일(no-sha) — `judge` 의 같은 칸의 줄
        const backup = toProjectRel(projectDir, r.backup);
        const line = f.unlisted
          ? r.gone
            ? LINES.noFileListRemoved
            : LINES.noFileList
          : !f.recorded
            ? LINES.hadFile
            : r.gone
              ? LINES.editedRemoved
              : LINES.edited;
        out.judged.push({
          path: f.rel,
          verdict: r.gone ? "backup+remove" : "backup+overwrite",
          recorded: f.recorded ? "sha" : f.unlisted ? "no-sha" : "none",
          line: withBackup(line, backup),
          backup,
          backupAbs: r.backup,
        });
      } catch (e) {
        failed.push(`${f.rel} (${e instanceof Error ? e.message : String(e)})`);
      }
    }
    for (const dir of asides.values()) pruneEmptyDirs(dir);
    if (failed.length > 0) {
      const at = [...asides.values()].map((d) => `${toProjectRel(projectDir, d)}/`).join(", ");
      throw new Error(
        `could not put back ${failed.length} file(s) moved aside before the skill tool ran — they stay in ${at}: ${failed.join(", ")}`,
      );
    }
    return { ...out, report: (report === null ? null : withoutCreated(report, back)) as R };
  };
}

/** 도구 호출 뒤 판정의 결과 — `backups` = 이번에 남긴 백업(절대 경로) · `displaced` = 상류 파일에 덮여 비켜 둔 설치자 파일. */
export interface SettledSlots<R extends ExternalInstallReport | null = ExternalInstallReport> {
  report: R;
  backups: string[];
  displaced: InstallLogRootFile[];
  /** #817 — `backups` 마다 판정의 줄. */
  judged: JudgedWrite[];
}

/**
 * #780 — 이번 대상 외부 스킬 자산이 도구 호출로 쓸 스킬 자리(project 상대). `method.skill` 이 있으면 이번 CLI 마다
 * `<root>/<skill>` · 없으면(소스 전체를 까는 자산) 두 루트 전체. global 은 홈에 깔아 프로젝트 자리를 쓰지 않는다.
 * 옛 판이 깐 자산(기록은 있는데 `files` 가 없다)의 자리도 든다(#902) — 그 자리는 `unlistedSkillSlots` 가 따로 말하고, hold 는
 * 그 안 파일을 설치자 원본으로 되살리지 않고 백업만 남긴다.
 */
export function skillSlotsFor(
  assets: ReadonlyArray<ExternalAsset>,
  clis: ReadonlyArray<CliTargets[number]>,
  ctx: { log: InstallLog | null; scope: InstallScope | undefined },
): string[] {
  if (resolveScope(ctx.scope) === "global") return [];
  const roots = clis.length === 0 ? [...SKILL_ROOTS] : [...new Set(clis.map(skillRootOf))];
  const out = new Set<string>();
  for (const a of assets) {
    if (a.method.kind !== "skill") continue;
    const skill = a.method.skill;
    for (const root of roots) out.add(skill === undefined ? root : `${root}/${skill}`);
  }
  return [...out];
}

/**
 * #902 — `skillSlotsFor` 가운데 기록이 파일 목록(`files`) 없이 말하는 자산의 자리. v26.163.0 이하가 그렇게 적었고, 그 뒤 판도
 * 목록을 잇지 않았다. 그 자리의 파일은 도구가 놓은 옛 판인지 설치자 파일인지 기록이 말하지 않는다.
 */
export function unlistedSkillSlots(
  assets: ReadonlyArray<ExternalAsset>,
  clis: ReadonlyArray<CliTargets[number]>,
  ctx: { log: InstallLog | null; scope: InstallScope | undefined },
): string[] {
  const unlisted = assets.filter((a) => {
    const prior = ctx.log?.assets.find((r) => r.id === a.id);
    return prior !== undefined && prior.files === undefined;
  });
  return skillSlotsFor(unlisted, clis, ctx);
}

/** #851 (ADR-112) — 회수한(미리보기면 회수할) 프로젝트 사본 하나. */
export interface GlobalCopyReclaim {
  /** 기록의 자산 id. */
  id: string;
  /** project 상대 자리(`.claude/skills/<skill>` 등). */
  slot: string;
  /** 지운(미리보기면 지울) 파일(project 상대). */
  removed: string[];
  /** 지우기 전에 백업한 파일마다 판정의 줄 — 미리보기면 `backup` 이 없다. */
  judged: JudgedWrite[];
  /** 지우지 않고 남긴 파일과 까닭. */
  left: Array<{ path: string; why: string }>;
}

/**
 * #851 (ADR-112, 사용자 확정 2026-10-19) — 기록 scope 가 global 인 외부 스킬 자산의 **프로젝트 사본**을 회수한다. v26.174.0 이하의
 * update 는 그 자산을 `-g` 없이 다시 받아(`--copy`) 이번 CLI 자리마다 `<root>/<skill>` 사본을 기록 밖에 만들었다 — 기록이 global 이라
 * 말하는 자산의 프로젝트 자리는 하네스 refresh 가 만든 자리다(디스크 존재가 아니라 기록으로 가른다 — ADR-096). update(갱신 전) ·
 * uninstall(전량 · `--only`) · 각 미리보기가 이 함수 하나를 쓴다.
 *
 * 파일마다 홈의 global 사본(같은 상대 경로)과 바이트로 대어 같으면 지우고, 다르거나 global 사본에 없으면 그 파일 하나를 백업하고
 * 지운다. global 사본이 아예 없으면 댈 수 없어 파일마다 백업하고 지운다. 다른 자산 · 하네스 기록이 말하는 경로, 앞선 백업은 건드리지
 * 않는다. 설치자가 뺀 자산(`excludedIds`)은 보지 않는다. 같은 폴더로 풀리는 자리는 한 번만 본다. 자리가 실제 폴더가 아니면(링크 —
 * 도구의 `--copy` 는 폴더를 만든다) · 프로젝트 밖으로 풀리면 · 홈의 그 자리와 같은 폴더면 따라가지 않는다. 폴더 안의 링크는 지우지 않고 남긴다. 소스 전체를 까는 자산(`detail.skill` 없음)은 기록된 스킬 이름(`skills` —
 * install · update 가 홈 스킬 자리를 재 남긴다)마다 같은 자리를 본다. 이름이 없는 옛 기록은 보지 않는다.
 */
export function reclaimGlobalSkillCopies(
  projectDir: string,
  log: InstallLog,
  opts: { ids?: ReadonlySet<string> | undefined; write: boolean; rm?: (abs: string) => void },
): GlobalCopyReclaim[] {
  const clis = installedClis(log);
  const roots = clis.length === 0 ? [...SKILL_ROOTS] : [...new Set(clis.map(skillRootOf))];
  const others = new Set(log.assets.flatMap((a) => (a.files ?? []).map((f) => f.path)));
  const rm = opts.rm ?? ((abs: string) => rmSync(abs, { force: true }));
  // 설치자가 뺀 자산(누적 `excluded` — ADR-099 R3)은 update 가 갱신하지 않듯 회수도 하지 않는다 — 그 자리는 하네스 몫이 아니다
  const excluded = excludedIds(log);
  // 한 폴더는 한 번만 — `.claude/skills` 가 `.agents/skills` 로의 링크면(#524 · #838) 두 자리가 한 폴더다(미리보기 = 실행)
  const seen = new Set<string>();
  const out: GlobalCopyReclaim[] = [];
  for (const a of log.assets) {
    if (a.method !== "skill" || a.scope !== "global" || excluded.has(a.id)) continue;
    if (opts.ids !== undefined && !opts.ids.has(a.id)) continue;
    // 소스 전체를 까는 자산(`detail.skill` 없음)은 install · update 가 잰 이름(`skills`)으로 — 이름이 없는 옛 기록은 다음 update 가 잰다
    const skill = a.detail.skill;
    const names =
      skill !== undefined ? [skill] : (Array.isArray(a.skills) ? a.skills : []).filter(isSkillName);
    for (const name of names) {
      for (const root of roots) {
        const slot = `${root}/${name}`;
        const real = realOrNull(join(projectDir, slot));
        if (real !== null) {
          if (seen.has(real)) continue;
          seen.add(real);
        }
        const ctx = { log, others, write: opts.write, rm, id: a.id };
        const r = reclaimCopy(projectDir, slot, join(globalSkillRoot(root), name), ctx);
        if (r !== null) out.push(r);
      }
    }
  }
  return out;
}

/**
 * 프로젝트 스킬 루트의 global 짝 — `skills@1.5.11` `getAgentBaseDir` 실측(2026-10-19): claude-code 는 `$CLAUDE_CONFIG_DIR/skills`
 * (없으면 `~/.claude/skills`), `.agents/skills` 를 쓰는 에이전트(codex · opencode · antigravity)는 공용 `~/.agents/skills`.
 */
function globalSkillRoot(root: (typeof SKILL_ROOTS)[number]): string {
  if (root === ".claude/skills") {
    return join(process.env.CLAUDE_CONFIG_DIR?.trim() || join(homedir(), ".claude"), "skills");
  }
  return join(homedir(), ".agents/skills");
}

/**
 * #851 — 기록의 스킬 이름이 스킬 루트 바로 아래 한 자리인가. 잰 이름은 `readdir` 의 것이라 늘 그렇다 — 손으로 고친(커밋된) 기록의
 * `../` 같은 이름이 루트 밖을 겨냥하지 않게 거른다.
 */
function isSkillName(name: unknown): name is string {
  return (
    typeof name === "string" && name !== "" && name !== "." && name !== ".." && !/[\\/]/.test(name)
  );
}

function reclaimCopy(
  projectDir: string,
  slot: string,
  home: string,
  ctx: {
    log: InstallLog;
    others: ReadonlySet<string>;
    write: boolean;
    rm: (abs: string) => void;
    id: string;
  },
): GlobalCopyReclaim | null {
  const abs = join(projectDir, slot);
  try {
    if (lstatSync(abs, { throwIfNoEntry: false })?.isDirectory() !== true) return null;
    if (outsideProjectTarget(projectDir, abs) !== null) return null;
    if (existsSync(home) && realpathSync(abs) === realpathSync(home)) return null;
  } catch {
    return null; // 판정할 수 없다 — 건드리지 않는다
  }
  const homeExists = existsSync(home);
  const res: GlobalCopyReclaim = { id: ctx.id, slot, removed: [], judged: [], left: [] };
  const now = new Date();
  let entries: Array<{ rel: string; link: boolean }>;
  try {
    entries = listEntriesRecursive(abs);
  } catch (e) {
    res.left.push({ path: slot, why: `could not read it (${errText(e)})` });
    return res;
  }
  for (const { rel, link } of entries) {
    if (backupOriginal(rel) !== null) continue; // 앞선 백업 — 설치자 몫이다
    const path = `${slot}/${rel}`;
    if (ctx.others.has(path) || recorded(ctx.log, path).state !== "none") continue;
    if (link) {
      res.left.push({ path, why: "a link — not part of the copy the tool put here" });
      continue;
    }
    const file = join(abs, rel);
    try {
      const mine = readFileSync(file);
      const same = homeExists && readOrNull(join(home, rel))?.equals(mine) === true;
      const backupAbs = !same && ctx.write ? backupFile(file, now) : undefined;
      if (ctx.write) ctx.rm(file);
      res.removed.push(path);
      if (same) continue;
      const line = homeExists
        ? `not the same as the global copy (${join(home, rel)}) — saved as <file>.backup-<time>, removed from live`
        : `no global copy at ${home} to compare — saved as <file>.backup-<time>, removed from live`;
      const judged: JudgedWrite = {
        path,
        verdict: "backup+remove",
        recorded: homeExists ? "sha" : "no-sha",
        line,
      };
      if (backupAbs !== undefined) {
        const backup = toProjectRel(projectDir, backupAbs);
        Object.assign(judged, { line: withBackup(line, backup), backup, backupAbs });
      }
      res.judged.push(judged);
    } catch (e) {
      res.left.push({ path, why: `could not back up or remove it (${errText(e)})` });
    }
  }
  if (ctx.write && res.removed.length > 0) pruneEmptyDirs(abs);
  return res.removed.length > 0 || res.left.length > 0 ? res : null;
}

function realOrNull(abs: string): string | null {
  try {
    return realpathSync(abs);
  } catch {
    return null;
  }
}

/** 폴더를 realpath 한 자리 + 이름 — 파일 자체가 링크여도 따라가지 않는다(`slotFilesToKeep` 의 실경로와 같은 잣대). 폴더가 없으면 `null`. */
function realFileOrNull(abs: string): string | null {
  const dir = realOrNull(dirname(abs));
  return dir === null ? null : join(dir, basename(abs));
}

function readOrNull(abs: string): Buffer | null {
  try {
    return readFileSync(abs);
  } catch {
    return null;
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * 도구 호출 전에 옮긴 파일 하나. `recorded` = 하네스 파일인데 기록 sha 와 다르다(설치자가 고쳤다) · `unlisted` = 기록이 파일 목록
 * 없이 말하는 자리의 파일 — 도구 것인지 설치자 것인지 모른다(#902) · 둘 다 아니면 설치자 파일.
 * `slot` = 그 파일이 든 자리 · `aside` = 백업 폴더 안의 자리(절대 경로) · `link` = 링크 자체를 옮겼다(#839).
 */
interface AsideFile {
  abs: string;
  rel: string;
  slot: string;
  recorded: boolean;
  unlisted: boolean;
  link: boolean;
  aside: string;
}

/**
 * 자리마다 지켜야 할 파일 — 고친 기록 파일과 기록 밖 파일(기록 sha 와 같은 파일은 도구가 갱신해도 된다). 기록이 하네스
 * 것(`recorded()`)이거나 다른 자산 것이라 말하는 경로는 설치자 파일이 아니라 옮기지 않는다. 프로젝트 밖으로 풀리는 자리는
 * 도구도 쓰지 않는다(#678). 옮기기 전에 다 모은다 — 겹친 자리(루트 · 그 안의 스킬)의 백업 폴더를 다시 줍지 않게.
 * 같은 파일은 실경로(폴더를 realpath 한 자리 + 이름)로 한 번만 든다 — `.claude/skills/<id>` 가 `.agents/skills/<id>` 로의 링크면
 * (#524) 두 자리가 한 폴더라 경로 둘로 잡혀 두 번째 옮기기가 ENOENT 로 죽는다(#838). 링크를 거치지 않는 경로를 남긴다 — 도구가
 * 링크 자리를 실제 폴더로 바꿔도 설치자 파일은 원래 있던 폴더로 돌아간다.
 * 스킬 폴더 안의 링크(파일 · 폴더 — 공유 에셋 등)는 따라가지 않고 링크 자체를 옮긴다 — 도구가 폴더를 새로 만들면 링크도
 * 사라진다(#839). 스킬 루트 바로 아래 링크는 스킬 자리 그 자체(#524)라 들지 않는다 — 그 안을 지키는 것이 hold 다.
 * AppleDouble 짝(`._<name>`)은 목록에 들지 않는다(`listEntriesRecursive`) — 그 볼륨이 `<name>` 과 함께 옮긴다(#890).
 */
function slotFilesToKeep(
  projectDir: string,
  hold: {
    recorded: ReadonlyArray<InstallLogAsset>;
    slots: ReadonlyArray<string>;
    unlisted?: ReadonlyArray<string> | undefined;
    log: InstallLog | null;
  },
): Omit<AsideFile, "aside">[] {
  const mine = hold.recorded.flatMap((a) => a.files ?? []);
  const sha = new Map(mine.map((f) => [f.path, f.sha256]));
  // #867 — 기록 sha 는 실파일로도 찾는다: 기록이 `.agents/skills/<id>/…` 에만 있고 `.claude/skills/<id>` 가 그곳으로의 링크면 링크 경로로
  // 본 같은 파일이 "기록 밖 = 설치자 파일" 로 읽혀 갱신마다 백업 · displaced 가 생긴다
  const realSha = new Map(
    mine.flatMap((f) => {
      const real = realFileOrNull(join(projectDir, f.path));
      return real === null ? [] : [[real, f.sha256] as const];
    }),
  );
  const targetIds = new Set(hold.recorded.map((a) => a.id));
  const others = new Set(
    (hold.log?.assets ?? [])
      .filter((a) => !targetIds.has(a.id))
      .flatMap((a) => (a.files ?? []).map((f) => f.path)),
  );
  // 자리는 기록 파일이 **든 폴더**(`<root>/<id>`)다 — 루트 바로 아래 파일(옛 판이 적은 AppleDouble 짝 `<root>/._<id>` 등)은 자리가
  // 아니다(#890 — 그 파일을 폴더로 훑다 ENOTDIR 로 멈췄다)
  const slots = new Set([
    ...mine
      .map((f) => f.path.split("/"))
      .filter((parts) => parts.length > 3)
      .map((parts) => parts.slice(0, 3).join("/")),
    ...hold.slots,
  ]);
  // #902 — 파일이 든 가장 안쪽 자리가 목록 없는 옛 기록의 자리면 그 파일은 도구 것인지 모른다(소스 전체 자산의 루트 자리 안에서도
  // 목록 있는 자산 폴더의 파일은 그 폴더가 말한다). 하네스 백업 이름(`<file>.backup-<시각>`)은 상류가 놓지 않는다 — 설치자 몫이다
  // (앞 update 가 남긴 백업을 다시 백업하지 않는다 — PR #906 리뷰 R1-M1)
  const unlisted = new Set(hold.unlisted ?? []);
  const unlistedAt = (path: string): boolean => {
    let owner = "";
    for (const s of slots) if (path.startsWith(`${s}/`) && s.length > owner.length) owner = s;
    return unlisted.has(owner);
  };
  const out = new Map<string, Omit<AsideFile, "aside">>();
  const realProject = realpathSync(projectDir);
  for (const slot of slots) {
    if (outsideProjectTarget(projectDir, join(projectDir, slot)) !== null) continue;
    for (const { rel, link } of listEntriesRecursive(join(projectDir, slot))) {
      const path = `${slot}/${rel}`;
      if (link && (SKILL_ROOTS as ReadonlyArray<string>).includes(dirname(path))) continue;
      const abs = join(projectDir, path);
      const real = join(realpathSync(dirname(abs)), basename(abs));
      const prev = out.get(real);
      if (prev !== undefined && (prev.rel === path || real !== join(realProject, path))) continue;
      const recordedSha = sha.get(path) ?? realSha.get(real);
      if (
        recordedSha === undefined &&
        (others.has(path) || recorded(hold.log, path).state !== "none")
      )
        continue;
      try {
        if (!link) {
          if (recordedSha !== undefined && hashContent(readFileSync(abs, "utf8")) === recordedSha)
            continue;
          accessSync(abs, fsConstants.R_OK);
        }
      } catch {
        continue; // 못 읽으면 편집을 잴 수 없다 — 도구에 맡긴다
      }
      const listed = recordedSha !== undefined;
      out.set(real, {
        abs,
        rel: path,
        slot,
        recorded: listed,
        unlisted: !listed && unlistedAt(path) && backupOriginal(path) === null,
        link,
      });
    }
  }
  return [...out.values()];
}

/**
 * 도구 호출 뒤 한 파일. 원래 자리가 비었거나(설치자 파일) 같은 바이트면, 또는 `restore`(도구가 실패했거나 예외로 끝났다)면
 * 제자리로 되돌린다(`"back"`). 그 밖은 호출 전 내용을 `<file>.backup-<시각>` 으로 남긴다 — 상류 파일에 덮인 설치자 파일은
 * `displaced`(notes[0] = 백업)로도 적는다: 그 자산이 자리를 떠나면(uninstall) 원본이 돌아온다(#780). 바뀌었거나 지워진
 * 고친 하네스 파일은 백업만 남는다. 링크(#839)는 내용을 재지 않는다 — 자리가 비었으면 되돌리고, 도구가 그 이름에 무엇을 놓았으면
 * 링크 그대로 백업으로 남긴다. #902 — 목록 없는 옛 기록의 파일(`unlisted`)은 고친 하네스 파일처럼 백업만 남기고, 원래 자리가
 * 비었어도 도구가 그 폴더를 새로 썼으면(`folderRewritten`) 되살리지 않는다 — 상류가 뺀 옛 도구 파일일 수 있다.
 */
function settleAside(
  projectDir: string,
  f: AsideFile,
  restore: boolean,
  folderRewritten: boolean,
): "back" | { backup: string; gone: boolean; displaced: InstallLogRootFile | null } {
  let now: Buffer | null = null;
  let vacant = false;
  try {
    if (f.link) lstatSync(f.abs);
    else now = readFileSync(f.abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") throw e;
    vacant = true;
  }
  // 링크는 같은 글자를 가리키는 링크가 그 자리에 있으면 같은 것이다 — 도구가 같은 링크를 다시 놓았다
  const keep = vacant
    ? f.unlisted
      ? !folderRewritten
      : f.link || !f.recorded
    : f.link
      ? lstatSync(f.abs).isSymbolicLink() && readlinkSync(f.abs) === readlinkSync(f.aside)
      : now?.equals(readFileSync(f.aside)) === true;
  if (restore || keep) {
    mkdirSync(dirname(f.abs), { recursive: true });
    renameSync(f.aside, f.abs);
    return "back";
  }
  const backup = f.link ? backupLink(f.abs, f.aside) : backupFromCopy(f.abs, f.aside);
  rmSync(f.aside, { force: true });
  if (f.recorded || f.unlisted || vacant) return { backup, gone: vacant, displaced: null };
  return {
    backup,
    gone: false,
    displaced: { path: f.rel, change: "displaced", notes: [toProjectRel(projectDir, backup)] },
  };
}

/** 스킬 루트 바로 아래 한 자리(`<root>/<name>`) — 그 안 파일의 스킬 폴더. */
function skillFolderOf(path: string): string {
  return path.split("/").slice(0, 3).join("/");
}

/** 설치자 바이트가 제자리로 돌아간 경로는 도구가 놓은 파일이 아니다 — 기록이 그 자산 것으로 적지 않게 뺀다. */
function withoutCreated(
  report: ExternalInstallReport,
  paths: ReadonlySet<string>,
): ExternalInstallReport {
  if (paths.size === 0) return report;
  return {
    ...report,
    attempted: report.attempted.map((r) =>
      r.files === undefined
        ? r
        : {
            ...r,
            files: { ...r.files, created: r.files.created.filter((x) => !paths.has(x.path)) },
          },
    ),
  };
}

/** 빈 폴더를 아래에서부터 걷는다 — 파일이 남은 폴더(되돌리지 못한 파일)는 그대로 둔다. */
function pruneEmptyDirs(dir: string): void {
  try {
    for (const e of readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory()) pruneEmptyDirs(join(dir, e.name));
    rmdirSync(dir);
  } catch {
    // 비지 않았다 — 남긴다
  }
}

function toProjectRel(projectDir: string, abs: string): string {
  return relative(projectDir, abs).split(sep).join("/");
}

/**
 * #770 — 갱신한 자산의 `files` 를 이번 호출의 결과로 잇는다(install 의 `buildAssetEntries` 와 같은 병합). #851 — global 자산이 이번에
 * 잰 스킬 이름(`skills`)도 같은 쓰기로 더한다. 바뀐 것이 없으면 쓰지 않는다. 돌려주는 것은 디스크에 남은 기록이다(쓰기에 실패하면 앞의 것).
 */
function recordRefreshedFiles(
  projectDir: string,
  log: InstallLog,
  report: ExternalInstallReport,
  displaced: ReadonlyArray<InstallLogRootFile>,
  writeLog: (projectDir: string, log: InstallLog) => void,
): InstallLog {
  const next = new Map(
    buildAssetEntries(report, log.scope, log.assets)
      .filter((e) => e.files !== undefined)
      .map((e) => [e.id, e.files]),
  );
  const named = new Map(
    report.attempted.flatMap((r) =>
      r.ok && r.skills !== undefined ? [[r.asset.id, r.skills]] : [],
    ),
  );
  let changed = displaced.length > 0;
  const assets = log.assets.map((a) => {
    const files = next.get(a.id);
    const { skills } = skillNames(a, a.scope, named.get(a.id));
    const sameFiles = files === undefined || JSON.stringify(files) === JSON.stringify(a.files);
    const sameSkills = skills === undefined || JSON.stringify(skills) === JSON.stringify(a.skills);
    if (sameFiles && sameSkills) return a;
    changed = true;
    return { ...a, ...(sameFiles ? {} : { files }), ...(skills !== undefined ? { skills } : {}) };
  });
  if (!changed) return log;
  const written: InstallLog = {
    ...log,
    assets,
    ...(displaced.length > 0 ? { rootFiles: mergeRootFiles(log.rootFiles, displaced) } : {}),
  };
  try {
    writeLog(projectDir, written);
    return written;
  } catch {
    // 기록 실패가 update 자체를 실패시키지는 않는다(update-mode 의 다른 writeInstallLog 들과 같은 방침).
    return log;
  }
}

/**
 * #851 (ADR-112) — `after` 가 `before` 에 없던 스킬 이름을 더한 자산의 그 이름 자리만 회수한다. 갱신 전 회수(`refreshExternalSkills`
 * 첫머리)가 이미 본 이름은 다시 보지 않는다 — 남긴 링크 줄이 두 번 나오지 않게.
 */
function reclaimNewlyNamed(
  projectDir: string,
  before: InstallLog,
  after: InstallLog,
): GlobalCopyReclaim[] {
  const gained = new Map<string, string[]>();
  for (const a of after.assets) {
    const old = new Set(before.assets.find((b) => b.id === a.id)?.skills ?? []);
    const added = (a.skills ?? []).filter((n) => !old.has(n));
    if (added.length > 0) gained.set(a.id, added);
  }
  if (gained.size === 0) return [];
  const only: InstallLog = {
    ...after,
    assets: after.assets.map((a) => {
      const names = gained.get(a.id);
      return names === undefined ? a : { ...a, skills: names };
    }),
  };
  return reclaimGlobalSkillCopies(projectDir, only, { ids: new Set(gained.keys()), write: true });
}

/**
 * `npx skills add` 인자.
 *
 * **`--copy` 가 핵심이다** (#372, 실측 2026-08-27 `skills@1.5.11` 컨테이너). 기본 모드에서
 * 에이전트를 여럿 넘기면 skill 이 `.agents/skills/`(codex·opencode·antigravity 공용)에만 깔리고
 * **Claude Code 몫의 `.claude/skills/` 가 조용히 빠진다** — exit 0 이라 설치 화면에는 ✓ 로 뜬다.
 * `--copy`(help: "Copy files instead of symlinking to agent directories")를 붙이면 한 호출로
 * 두 자리가 다 생긴다.
 *
 * 재 본 것들:
 *   `--agent a --agent b` (반복)      → `.agents/` 만        ❌
 *   `--agent a b` (variadic, 문서 형태) → `.agents/` 만        ❌ (1.5.23 도 동일)
 *   `--agent "a,b"` (콤마)             → `Invalid agents:` **exit 1**, 아무것도 안 깔림
 *   위 어느 형태든 **+ `--copy`**       → 두 자리 다 생김      ✅ 1회 5초
 * 콤마는 1.5.5 에서만 되던 형태다(1.5.7 폐지, v26.55.1 회귀). 버전 bump 때 이 표를 다시 잰다.
 *
 * **`--copy` 는 에이전트를 명시할 때만 붙인다.** 미지정(`cli: []`, 레거시 "전체")에 붙이면
 * 설치 대상이 `.agents/` 한 곳에서 **약 50개 도구 디렉터리로 폭발**한다(실측). 그 경로는 종전
 * 그대로 둔다.
 */
function buildSkillArgs(
  method: { kind: "skill"; source: string; skill?: string },
  cli: CliTargets,
  scope: InstallScope,
): string[] {
  const args = [skillsCliSpec(), "add", method.source];
  if (method.skill) {
    args.push("--skill", method.skill);
  }
  if (cli.length > 0) {
    for (const c of cli) {
      args.push("--agent", SKILLS_CLI_AGENT_MAP[c] ?? c);
    }
    // 에이전트를 고른 경우에만. 위 주석의 폭발 사유.
    args.push("--copy");
  }
  // v26.64.0 (ADR-020) — global scope 시 -g. project 는 skills CLI default (project) 따름.
  if (scope === "global") {
    args.push("-g");
  }
  args.push("--yes");
  return args;
}

/**
 * Plugin 은 marketplace add → install 두 단계. marketplace add 실패는 무시 (이미 등록 케이스).
 *
 * v26.64.0 (ADR-020) — `--scope <project|user>` 분기. claude CLI native:
 *   - project: --scope project (현재 projectPath 격리, installed_plugins.json 메타 매칭)
 *   - global:  --scope user (모든 projectPath 에서 활성)
 * fs 적으로는 양쪽 모두 ~/.claude/plugins/cache/ + ~/.claude/plugins/marketplaces/ 에 write
 * (claude CLI 자체 디자인). 격리는 메타데이터.
 */
function installPlugin(
  asset: ExternalAsset,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
  method: { kind: "plugin"; marketplace: string; pluginId: string },
  scope: InstallScope,
  cwd: string,
): AssetInstallResult {
  const claudeScope = scope === "global" ? "user" : "project";
  // v26.77.0 — cwd=projectDir: --scope project 시 claude 가 cwd 기준으로 프로젝트를 탐지하므로
  // installed_plugins.json 의 projectPath 가 올바른 프로젝트로 기록된다.
  spawn(
    "claude",
    ["plugin", "marketplace", "add", "--scope", claudeScope, method.marketplace],
    spawnOpts(cwd),
  );
  return runSpawn(
    asset,
    spawn,
    "claude",
    ["plugin", "install", "--scope", claudeScope, method.pluginId],
    cwd,
  );
}

function runSpawn(
  asset: ExternalAsset,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
  cmd: string,
  args: ReadonlyArray<string>,
  cwd?: string,
): AssetInstallResult {
  const timeout = spawnTimeoutFor(asset.method.kind);
  const result = spawn(cmd, args, spawnOpts(cwd, timeout));
  if (result.error) {
    // #422 — 시간 초과는 "실패"가 아니라 "덜 끝남"이다. 설치자가 같은 명령을 직접 이어 돌릴 수
    // 있게 명령을 그대로 낸다 — 메시지에 원인(ETIMEDOUT)만 있으면 무엇을 해야 하는지 모른다.
    const code = (result.error as NodeJS.ErrnoException).code;
    if (code === "ETIMEDOUT") {
      return {
        asset,
        ok: false,
        message: `timed out after ${Math.round(timeout / 1000)}s — finish it yourself: ${cmd} ${args.join(" ")}`,
      };
    }
    return { asset, ok: false, message: result.error.message };
  }
  if ((result.status ?? 1) !== 0) {
    const stderr = (result.stderr ?? "").trim();
    // #583 — stderr 가 비면(`npx skills` 류는 원인을 stdout 에만 쓴다) stdout 끝부분에서
    // 원인을 가져온다. npm 은 원인이 stderr 앞쪽에 있고 stdout 끝은 "A complete log of this
    // run can be found in: …" 뿐이라 그 경로는 그대로 둔다(같은 자리 시간 초과 처리, #422 와
    // 같은 근거 — 메시지에 원인이 없으면 무엇을 해야 하는지 모른다).
    const usingStdout = stderr.length === 0;
    const source = usingStdout ? (result.stdout ?? "").trim() : stderr;
    const tail =
      source.length > 200
        ? usingStdout
          ? `…${source.slice(-200)}`
          : `${source.slice(0, 200)}…`
        : source;
    return {
      asset,
      ok: false,
      message: `${cmd} exited ${result.status}${tail ? `: ${tail}` : ""}`,
    };
  }
  return { asset, ok: true };
}

function spawnOpts(cwd?: string, timeout: number = DEFAULT_SPAWN_TIMEOUT_MS): SpawnOpts {
  return {
    encoding: "utf8",
    stdio: "pipe",
    timeout,
    ...(cwd ? { cwd } : {}),
  };
}

/* v8 ignore next 7 — thin dep-inject default. tests 는 항상 spawn 주입. */
function defaultSpawn(
  cmd: string,
  args: ReadonlyArray<string>,
  opts: SpawnOpts,
): SpawnSyncReturns<string> {
  return spawnSync(cmd, [...args], opts);
}

/**
 * v26.59.0 — install 후 path 기반 version 추출.
 * #582 — 캐시 폴더 이름 정렬·전역 npm 사본 대신 **이번 실행이 실제로 깐 것**을 읽는다.
 *
 * 안전 원칙: 실패 시 undefined 반환 (silent). install 성공 자체는 이미 검증됨. 모르면 비운다 —
 * 틀린 값을 보여주는 것보다 낫다.
 *
 * - plugin: `~/.claude/plugins/installed_plugins.json` 의 이 scope·projectPath 항목의 version.
 *   폴더 이름 정렬은 갱신 뒤에도 남는 옛 캐시·버전 필드 없는 커밋 SHA 폴더 때문에 "최신"과
 *   무관하다 — 실제 설치 기록은 claude 자신이 이 파일에 남긴다(v26.64.0 ADR-020 댓글이 이미
 *   이 파일을 매칭 대상으로 지목했다).
 * - npm: scope=project(기본, `--save-dev`) 는 `<projectDir>/node_modules/<pkg>/package.json`.
 *   scope=global(`-g`) 은 `npm root -g` 의 전역 사본 — 그 경우엔 전역이 실제로 깐 자리다.
 * - skill / npx-run: 표준 metadata 위치 없음 → undefined
 */
function detectVersion(
  method: ExternalAssetMethod,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
  scope: InstallScope,
  projectDir: string,
): string | undefined {
  try {
    switch (method.kind) {
      case "plugin":
        return detectPluginVersion(method.pluginId, scope, projectDir);
      case "npm": {
        const pkgJson =
          scope === "global"
            ? detectGlobalNpmPackageJsonPath(method.pkg, spawn)
            : join(projectDir, "node_modules", method.pkg, "package.json");
        if (!pkgJson || !existsSync(pkgJson)) return undefined;
        const parsed = JSON.parse(readFileSync(pkgJson, "utf8")) as { version?: string };
        return parsed.version;
      }
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/** `installed_plugins.json` 의 항목 하나 — 우리가 읽는 필드만 선언(그 외는 무시). */
interface InstalledPluginEntry {
  scope?: string;
  projectPath?: string;
  version?: string;
  lastUpdated?: string;
}

/**
 * `~/.claude/plugins/installed_plugins.json` 에서 이번 실행의 scope·프로젝트에 맞는 항목의
 * version 을 읽는다. pluginId 는 카탈로그에 이미 "<plugin>@<marketplace-short>" 형태로 있고,
 * 그 문자열이 이 파일의 최상위 키와 그대로 일치한다.
 */
function detectPluginVersion(
  pluginId: string,
  scope: InstallScope,
  projectDir: string,
): string | undefined {
  const claudeScope = scope === "global" ? "user" : "project";
  const path = join(homedir(), ".claude/plugins/installed_plugins.json");
  if (!existsSync(path)) return undefined;
  const data = JSON.parse(readFileSync(path, "utf8")) as {
    plugins?: Record<string, ReadonlyArray<InstalledPluginEntry>>;
  };
  const entries = data.plugins?.[pluginId] ?? [];
  const matches = entries.filter((e) =>
    claudeScope === "user"
      ? e.scope === "user"
      : e.scope === "project" && e.projectPath === projectDir,
  );
  if (matches.length === 0) return undefined;
  // 같은 scope·프로젝트에 항목이 둘 이상이면(관측된 적은 없지만) 가장 최근 걸 쓴다.
  const latest = [...matches].sort((a, b) =>
    (a.lastUpdated ?? "").localeCompare(b.lastUpdated ?? ""),
  );
  return latest.at(-1)?.version;
}

function detectGlobalNpmPackageJsonPath(
  pkg: string,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
): string | undefined {
  const npmRoot = getNpmGlobalRoot(spawn);
  return npmRoot ? join(npmRoot, pkg, "package.json") : undefined;
}

let npmGlobalRootCache: string | undefined;

/* v8 ignore start — npm CLI 실행 + cache. 실 시스템 의존. detectVersion (plugin 외 method) 가 본 함수 호출. */
function getNpmGlobalRoot(spawn: NonNullable<ExternalInstallerDeps["spawn"]>): string | undefined {
  if (npmGlobalRootCache !== undefined) return npmGlobalRootCache || undefined;
  try {
    const r = spawn("npm", ["root", "-g"], spawnOpts());
    if ((r.status ?? 1) === 0) {
      npmGlobalRootCache = (r.stdout ?? "").trim();
      return npmGlobalRootCache || undefined;
    }
  } catch {
    // fallthrough
  }
  npmGlobalRootCache = "";
  return undefined;
}
/* v8 ignore stop */

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
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CATEGORIES as CATEGORY_ORDER } from "./categories.js";
import {
  assetReachesCli,
  EXTERNAL_ASSETS,
  type ExternalAsset,
  type ExternalAssetMethod,
  filterApplicableAssets,
} from "./external-assets.js";
import { listFilesRecursive } from "./fs-ops.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogSkillFile,
  installedClis,
  readInstallLog,
} from "./install-log.js";
import { outsideProjectTarget } from "./outside-project.js";
import { excludedIds } from "./recorded.js";
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
        return runSpawn(asset, ctx.spawn, "npx", buildSkillArgs(method, ctx.cli, ctx.scope), cwd);
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
  } = {},
): ExternalSkillRefresh {
  const none = { attempted: 0, refreshed: 0, failed: [] as const, notInCatalog: [] as const };
  const log = (deps.readLog ?? readInstallLog)(projectDir);
  if (!log) {
    return { ...none, unknown: true };
  }
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
    return { ...none, notInCatalog, unknown: false };
  }
  const report = (deps.run ?? runExternalInstall)(
    {
      tracks: log.spec.tracks as ReadonlyArray<Track>,
      // `forceInclude` 가 조건 판정을 앞지르므로 옵션 값은 결과에 영향을 주지 않는다.
      options: DEFAULT_OPTIONS,
      // #528 — 대상 CLI 는 **깔린 집합**(`installedClis`)이다. `spec.cli` 는 마지막 install 의
      // 요청이라 `uninstall --cli` 뒤에도 뺀 CLI 를 말하고, 반대로 그걸 비우면 `buildSkillArgs` 가
      // `--agent`·`--copy` 를 못 붙여 Claude 몫이 조용히 빠진다(재리뷰 BLOCKER-3).
      cli: [...installedClis(log)] as CliTargets,
      userOverride: { forceInclude: [...installedIds], forceExclude: [] },
      scope: log.scope,
      projectDir,
    },
    {
      assets: targets,
      ...(deps.spawn ? { spawn: deps.spawn } : {}),
      ...(deps.log ? { log: deps.log } : {}),
      ...(deps.warn ? { warn: deps.warn } : {}),
    },
  );
  return {
    attempted: report.attempted.length,
    refreshed: report.succeeded,
    failed: report.attempted
      .filter((r) => !r.ok)
      .map((r) => ({ id: r.asset.id, message: r.message ?? "failed" })),
    notInCatalog,
    unknown: false,
  };
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

/**
 * 누락(skip) 자산 목록을 사용자 보고용 텍스트로 포맷.
 */
export function formatSkippedReport(report: ExternalInstallReport): string {
  const failed = report.attempted.filter((r) => !r.ok);
  if (failed.length === 0) return "";
  const lines = failed.map((r) => `  • ${r.asset.id} — ${r.message ?? "failed"}`);
  return [
    `${failed.length}개 외부 자산이 설치되지 않았습니다 (warn-skip):`,
    ...lines,
    "",
    "Manual install or retry needed. See docs/REFERENCE.md or README.md for details.",
  ].join("\n");
}

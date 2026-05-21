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
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CATEGORIES as CATEGORY_ORDER } from "./categories.js";
import {
  EXTERNAL_ASSETS,
  type ExternalAsset,
  type ExternalAssetMethod,
  filterApplicableAssets,
} from "./external-assets.js";
import {
  type CliTargets,
  type InstallScope,
  type OptionFlags,
  resolveScope,
  type Track,
} from "./types.js";

export interface ExternalInstallerDeps {
  /** Override `spawnSync` for tests (mock으로 호출 횟수 + args 검증). */
  spawn?: (cmd: string, args: ReadonlyArray<string>, opts: SpawnOpts) => SpawnSyncReturns<string>;
  /** harness root (prune-ecc.sh script 위치 resolve용). */
  harnessRoot?: string;
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
   * 그 외 method (skill, npx-run, shell-script): 표준 metadata 없음 → undefined.
   */
  version?: string;
}

export interface ExternalInstallReport {
  /** 적용 시도된 자산 (조건 통과한 것만) */
  attempted: ReadonlyArray<AssetInstallResult>;
  /** 성공 갯수 */
  succeeded: number;
  /** warn-skip 된 갯수 */
  skipped: number;
  /** abort failureMode가 발화된 자산 (있으면 install 중단) */
  aborted?: ExternalAsset;
}

const DEFAULT_SPAWN_TIMEOUT_MS = 120_000;

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
  },
  deps: ExternalInstallerDeps = {},
): ExternalInstallReport {
  const log = deps.log ?? console.log;
  const warn = deps.warn ?? console.error;
  const spawn = deps.spawn ?? defaultSpawn;
  const assets = deps.assets ?? EXTERNAL_ASSETS;
  const harnessRoot = deps.harnessRoot ?? process.cwd();

  const applicable = filterApplicableAssets(assets, ctx);
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
    const baseResult = installOne(asset, { spawn, harnessRoot, cli, scope });
    let result: AssetInstallResult = baseResult;
    if (baseResult.ok) {
      const v = detectVersion(asset.method, spawn);
      if (v) result = { ...baseResult, version: v };
    }
    deps.onAssetResult?.(result);

    if (!result.ok) {
      const failureMode = asset.failureMode ?? "warn-skip";
      if (failureMode === "abort") {
        attempted.push(result);
        return {
          attempted,
          succeeded: attempted.filter((r) => r.ok).length,
          skipped: attempted.filter((r) => !r.ok).length,
          aborted: asset,
        };
      }
      warn(`    [warn-skip] ${asset.id}: ${result.message ?? "failed"}`);
    }

    attempted.push(result);
  }

  return {
    attempted,
    succeeded: attempted.filter((r) => r.ok).length,
    skipped: attempted.filter((r) => !r.ok).length,
  };
}

/**
 * 자산 1개 설치. method.kind 별 적절한 명령 실행.
 */
function installOne(
  asset: ExternalAsset,
  ctx: {
    spawn: NonNullable<ExternalInstallerDeps["spawn"]>;
    harnessRoot: string;
    cli: CliTargets;
    scope: InstallScope;
  },
): AssetInstallResult {
  const { method } = asset;
  switch (method.kind) {
    case "skill":
      return runSpawn(asset, ctx.spawn, "npx", buildSkillArgs(method, ctx.cli, ctx.scope));
    case "plugin":
      return installPlugin(asset, ctx.spawn, method, ctx.scope);
    case "npm-global":
      // v26.64.0 (ADR-020) — scope=project 시 devDep, scope=global 시 -g.
      // method.kind 이름은 "npm-global" 유지 (별도 cycle 에서 rename) — 실 동작은 scope 분기.
      return runSpawn(
        asset,
        ctx.spawn,
        "npm",
        ctx.scope === "global"
          ? ["install", "-g", method.pkg]
          : ["install", "--save-dev", method.pkg],
      );
    case "npx-run":
      return runSpawn(asset, ctx.spawn, "npx", [method.cmd, ...(method.args ?? [])]);
    case "shell-script": {
      const scriptPath = join(ctx.harnessRoot, method.script);
      if (!existsSync(scriptPath)) {
        return {
          asset,
          ok: false,
          message: `script not found: ${scriptPath}`,
        };
      }
      return runSpawn(asset, ctx.spawn, "bash", [scriptPath, ...method.args]);
    }
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
 * 매핑 누락 시 `Invalid agents: claude` 로 exit 1 → 외부 사용자 (DYLD-GoalTrack
 * reproduce 2026-05-06) 환경에서 7건 skill 자산 100% skip.
 */
const SKILLS_CLI_AGENT_MAP: Record<CliTargets[number], string> = {
  claude: "claude-code",
  codex: "codex",
  opencode: "opencode",
};

function buildSkillArgs(
  method: { kind: "skill"; source: string; skill?: string },
  cli: CliTargets,
  scope: InstallScope,
): string[] {
  const args = ["skills", "add", method.source];
  if (method.skill) {
    args.push("--skill", method.skill);
  }
  if (cli.length > 0) {
    // v26.55.1 — skills cli 1.5.7 부터 multi-agent 는 repeatable `--agent` 만 지원.
    for (const c of cli) {
      args.push("--agent", SKILLS_CLI_AGENT_MAP[c] ?? c);
    }
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
): AssetInstallResult {
  const claudeScope = scope === "global" ? "user" : "project";
  spawn(
    "claude",
    ["plugin", "marketplace", "add", "--scope", claudeScope, method.marketplace],
    spawnOpts(),
  );
  return runSpawn(asset, spawn, "claude", [
    "plugin",
    "install",
    "--scope",
    claudeScope,
    method.pluginId,
  ]);
}

function runSpawn(
  asset: ExternalAsset,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
  cmd: string,
  args: ReadonlyArray<string>,
): AssetInstallResult {
  const result = spawn(cmd, args, spawnOpts());
  if (result.error) {
    return { asset, ok: false, message: result.error.message };
  }
  if ((result.status ?? 1) !== 0) {
    const stderr = (result.stderr ?? "").trim();
    const tail = stderr.length > 200 ? `${stderr.slice(0, 200)}…` : stderr;
    return {
      asset,
      ok: false,
      message: `${cmd} exited ${result.status}${tail ? `: ${tail}` : ""}`,
    };
  }
  return { asset, ok: true };
}

function spawnOpts(): SpawnOpts {
  return {
    encoding: "utf8",
    stdio: "pipe",
    timeout: DEFAULT_SPAWN_TIMEOUT_MS,
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
 *
 * 안전 원칙: 실패 시 undefined 반환 (silent). install 성공 자체는 이미 검증됨.
 *
 * - plugin: ~/.claude/plugins/cache/<marketplace>/<plugin>/<VERSION>/ 디렉토리명 (semver-like 만)
 * - npm-global: <npm root -g>/<pkg>/package.json 의 version
 * - skill / npx-run / shell-script: 표준 metadata 위치 없음 → undefined
 */
function detectVersion(
  method: ExternalAssetMethod,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
): string | undefined {
  try {
    switch (method.kind) {
      case "plugin": {
        // pluginId = "<plugin>@<marketplace-short>". cache path:
        // ~/.claude/plugins/cache/<marketplace-short>/<plugin>/<VERSION>/
        // method.marketplace 는 GH `<user>/<repo>` (다른 값) 이라 path 에 사용 X.
        const at = method.pluginId.lastIndexOf("@");
        if (at <= 0) return undefined;
        const plugin = method.pluginId.slice(0, at);
        const marketplaceShort = method.pluginId.slice(at + 1);
        const cacheBase = join(homedir(), ".claude/plugins/cache", marketplaceShort, plugin);
        if (!existsSync(cacheBase)) return undefined;
        const versions = readdirSync(cacheBase)
          .filter((v) => /^\d/.test(v))
          .sort();
        return versions.at(-1);
      }
      case "npm-global": {
        const npmRoot = getNpmGlobalRoot(spawn);
        if (!npmRoot) return undefined;
        const pkgJson = join(npmRoot, method.pkg, "package.json");
        if (!existsSync(pkgJson)) return undefined;
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

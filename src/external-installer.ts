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
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CATEGORIES as CATEGORY_ORDER } from "./categories.js";
import { EXTERNAL_ASSETS, type ExternalAsset, filterApplicableAssets } from "./external-assets.js";
import type { CliTargets, OptionFlags, Track } from "./types.js";

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

  for (const asset of sorted) {
    deps.onAssetStart?.(asset);
    log(`  → ${asset.description}`);
    const result = installOne(asset, { spawn, harnessRoot, cli });
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
  },
): AssetInstallResult {
  const { method } = asset;
  switch (method.kind) {
    case "skill":
      return runSpawn(asset, ctx.spawn, "npx", buildSkillArgs(method, ctx.cli));
    case "plugin":
      return installPlugin(asset, ctx.spawn, method);
    case "npm-global":
      return runSpawn(asset, ctx.spawn, "npm", ["install", "-g", method.pkg]);
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
): string[] {
  const args = ["skills", "add", method.source];
  if (method.skill) {
    args.push("--skill", method.skill);
  }
  if (cli.length > 0) {
    // v26.55.1 — skills cli 1.5.7 부터 multi-agent 는 repeatable `--agent` 만 지원.
    // comma-separated (`--agent claude-code,codex`) → "Invalid agents" exit 1.
    // 1.5.5 까지는 comma 지원했음 (regression). 사용자 보고 (2026-05-17): multi-cli 시
    // 모든 npx skills 자산 100% fail.
    for (const c of cli) {
      args.push("--agent", SKILLS_CLI_AGENT_MAP[c] ?? c);
    }
  }
  args.push("--yes");
  return args;
}

/**
 * Plugin은 marketplace add → install 두 단계. marketplace add 실패는 무시 (이미 등록 케이스).
 */
function installPlugin(
  asset: ExternalAsset,
  spawn: NonNullable<ExternalInstallerDeps["spawn"]>,
  method: { kind: "plugin"; marketplace: string; pluginId: string },
): AssetInstallResult {
  // marketplace add는 idempotent — 실패해도 install 시도 (이미 등록 케이스가 흔함)
  spawn("claude", ["plugin", "marketplace", "add", method.marketplace], spawnOpts());
  return runSpawn(asset, spawn, "claude", ["plugin", "install", method.pluginId]);
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

function defaultSpawn(
  cmd: string,
  args: ReadonlyArray<string>,
  opts: SpawnOpts,
): SpawnSyncReturns<string> {
  return spawnSync(cmd, [...args], opts);
}

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
    "수동 설치 또는 후속 재시도 필요. 자세한 내용은 docs/REFERENCE.md 또는 README.md 참조.",
  ].join("\n");
}

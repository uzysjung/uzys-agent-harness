/**
 * `install` subcommand — spec 검증 + 파이프라인 오케스트레이션 (v26.82.0, Phase R).
 * 화면 출력(헤더/Phase rows/산출물/Summary)은 `install-render.ts` 로 분리.
 */

import { resolve } from "node:path";
import type { Cli } from "../cli.js";
import { parseCliTargets } from "../cli-targets.js";
import { c, status, unifiedSection } from "../design.js";
import { EXTERNAL_ASSETS } from "../external-assets.js";
import { type InstallReport, runInstall as runInstallPipeline } from "../installer.js";
import {
  type CliTargets,
  type InstallScope,
  type InstallSpec,
  isInstallScope,
  isTrack,
  type Track,
} from "../types.js";
import {
  createInstallRenderer,
  type PipelineCallbacks,
  renderCliArtifacts,
  renderFinalSummary,
  renderInstallHeader,
  renderUpdateSummary,
} from "./install-render.js";

export interface InstallOptions {
  track?: string[];
  /** v0.7.0 — repeatable. cac type: [String]. v0.8.0 — legacy alias 'both'/'all' 제거됨. */
  cli?: string | string[];
  /** v26.63.0 — Phase 1 templates 의 files 라인 표시 (default: counts only). */
  verbose?: boolean;
  projectDir?: string;
  // v26.81.0 (ADR-022, BREAKING) — 자산 1:1 플래그 13종(withTauri/withGsd/withEcc/withTob/
  //   withAddyAgentSkills/withUzysHarness/withSuperpowers/withWshobsonAgents/withOpenspec/
  //   withBmad/withClaudeVideo/withUnderstandAnything/withAgentmemory) 완전 삭제.
  //   자산 선택 = generic `--with <id>` / `--without <id>` 만. 아래는 동작 옵션.
  withPrune?: boolean;
  withCodexTrust?: boolean;
  withKarpathyHook?: boolean;
  /**
   * v26.47.0 (Phase C full) — External Asset 직접 추가 (preset condition 무관 강제 포함).
   * cac repeatable. 예: `--with railway-skills --with impeccable`.
   * 옵션-키 flag (예: `--with-uzys-harness`) 와 별개 — External Asset id 만.
   */
  with?: string | string[];
  /**
   * v26.47.0 (Phase C full) — External Asset 직접 제외 (preset 추천에서 unchecked).
   * cac repeatable. 예: `--without netlify-cli`.
   */
  without?: string | string[];
  /**
   * v26.64.0 (ADR-020) — Installation scope. `project` (default) | `global`.
   * 명시 안 하면 wizard 의 scope prompt → 비대화형은 "project".
   */
  scope?: string;
}

export interface RunInstallResult {
  ok: boolean;
  cli: CliTargets;
  /** Deprecation warnings (alias 사용 시 emit). caller가 stderr로 출력. */
  warnings: ReadonlyArray<string>;
  message: string;
  report?: InstallReport;
}

/**
 * Lift raw flag options to a typed InstallSpec.
 * Returns a Result-shaped value so callers can render errors uniformly.
 */
export function specFromOptions(options: InstallOptions): RunInstallResult {
  const parsed = parseCliTargets(options.cli);
  if (!parsed.ok) {
    return {
      ok: false,
      cli: ["claude"],
      warnings: parsed.warnings,
      message: parsed.error ?? "Invalid --cli value",
    };
  }
  const trackInputs = options.track ?? [];
  if (trackInputs.length === 0) {
    return {
      ok: false,
      cli: parsed.targets,
      warnings: parsed.warnings,
      // v26.56.0 (F6) — wizard 진입 안내. `install` subcommand 는 non-interactive.
      message:
        "At least one --track is required (e.g. --track tooling)\n       Interactive wizard: run without subcommand → `agent-harness` (drop the `install` word)",
    };
  }
  for (const t of trackInputs) {
    if (!isTrack(t)) {
      return {
        ok: false,
        cli: parsed.targets,
        warnings: parsed.warnings,
        message: `Unknown track: ${t}`,
      };
    }
  }
  return {
    ok: true,
    cli: parsed.targets,
    warnings: parsed.warnings,
    message: "spec valid",
  };
}

export interface InstallActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  /** Override the install pipeline (used by tests to avoid real fs side effects). */
  runPipeline?: (
    spec: InstallSpec,
    harnessRoot: string,
    mode?: import("../installer.js").InstallMode,
    callbacks?: PipelineCallbacks,
  ) => InstallReport;
  /** Override the harness root resolver (defaults to a path relative to this file). */
  resolveHarnessRoot?: () => string;
}

export function installAction(options: InstallOptions, deps: InstallActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const runPipeline = deps.runPipeline ?? defaultRunPipeline;
  const resolveHarnessRoot = deps.resolveHarnessRoot ?? defaultHarnessRoot;

  const validated = specFromOptions(options);
  // Deprecation warnings to stderr (alias 사용 시), regardless of ok/fail.
  for (const w of validated.warnings) {
    err(c.yellow(`[WARN] ${w}`));
  }
  if (!validated.ok) {
    err(status.failure(c.red(`ERROR: ${validated.message}`)));
    exit(1);
    return;
  }

  // v26.47.0 — Phase C full: --with/--without repeatable → userOverride.
  const forceInclude = normalizeRepeatable(options.with);
  const forceExclude = normalizeRepeatable(options.without);
  // v26.49.0 — unknown asset id validation (silent ignore 방지).
  const validIds = new Set(EXTERNAL_ASSETS.map((a) => a.id));
  for (const id of [...forceInclude, ...forceExclude]) {
    if (!validIds.has(id)) {
      err(
        c.yellow(
          `[WARN] Unknown asset id '${id}' (--with/--without). Skipping. Use one of: ${[...validIds].sort().join(", ")}`,
        ),
      );
    }
  }
  const filteredInclude = forceInclude.filter((id) => validIds.has(id));
  const filteredExclude = forceExclude.filter((id) => validIds.has(id));
  const userOverride =
    filteredInclude.length > 0 || filteredExclude.length > 0
      ? { forceInclude: filteredInclude, forceExclude: filteredExclude }
      : undefined;

  const spec: InstallSpec = {
    tracks: (options.track as Track[]) ?? [],
    ...(userOverride ? { userOverride } : {}),
    // v26.81.0 (ADR-022, BREAKING) — 자산 1:1 boolean 13종 삭제. 자산 선택은 위
    //   userOverride(--with <id>)로 일원화. 잔존 = 설치 동작 옵션만.
    options: {
      withPrune: options.withPrune === true,
      withCodexTrust: options.withCodexTrust === true,
      withKarpathyHook: options.withKarpathyHook === true,
    },
    cli: validated.cli,
    projectDir: resolve(options.projectDir ?? process.cwd()),
    scope: resolveScopeOption(options.scope, err),
  };

  executeSpec(spec, {
    log,
    err,
    exit,
    runPipeline,
    resolveHarnessRoot,
    verbose: options.verbose === true,
  });
}

export interface ExecuteSpecDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  runPipeline?: (
    spec: InstallSpec,
    harnessRoot: string,
    mode?: import("../installer.js").InstallMode,
    callbacks?: PipelineCallbacks,
  ) => InstallReport;
  resolveHarnessRoot?: () => string;
  /** Router action mode (forwarded to runInstall). Default "fresh". */
  mode?: import("../installer.js").InstallMode;
  /**
   * v26.63.0 — wizard 모드 (Step 1~4 통과 후 호출) 식별. true 시:
   *   - install header (TARGET / TRACKS / CLI / OPTIONS / ASSETS) 출력 skip
   *     (Step 3 review + Step 4 confirm 에서 이미 표시)
   *   - "Step 5/5 — Installing" 흐름에 자연 연결
   */
  fromWizard?: boolean;
  /**
   * v26.63.0 — verbose 출력 (Phase 1 templates 의 files 라인 표시).
   * Default false — 카운트 + use 만 표시 (cognitive load 감소).
   */
  verbose?: boolean;
}

/**
 * Run the install pipeline for a fully-validated InstallSpec and render the
 * report. Shared by the `install` flag-mode command and the default
 * (interactive) action so both have identical post-install output.
 */
export function executeSpec(spec: InstallSpec, deps: ExecuteSpecDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const runPipeline = deps.runPipeline ?? defaultRunPipeline;
  const resolveHarnessRoot = deps.resolveHarnessRoot ?? defaultHarnessRoot;

  // v26.63.0 — wizard 모드는 header (TARGET ~ ASSETS) 출력 skip — Step 3/4 에서 이미 표시.
  //   non-interactive (--track ...) 모드는 기존 header 유지 — 사용자 spec 확인 cue 필요.
  if (!deps.fromWizard) {
    renderInstallHeader(log, spec, deps.mode);
  }

  // v26.63.0 — phaseHeader → unifiedSection. Phase 카운터 (1/2/3) 제거 — 5-step 통합 시
  //   wizard step 5/5 안 sub-section 으로 자연 흐름. Update mode 도 동일.
  log(unifiedSection(deps.mode === "update" ? "Update Mode" : "Templates"));
  log("");

  // Streaming progress: baseline 완료 시 즉시 Phase 1 rows 출력, external은 per-asset 스트리밍.
  const renderer = createInstallRenderer(log, spec, deps.verbose === true);

  let report: InstallReport;
  try {
    report = runPipeline(spec, resolveHarnessRoot(), deps.mode, renderer.callbacks);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    log("");
    err(status.failure(c.red(`install failed — ${detail}`)));
    exit(1);
    return;
  }

  // Update mode 단축 출력 — manifest copy / external 모두 skip
  if (report.updateMode) {
    renderUpdateSummary(log, report);
    return;
  }

  // Phase 2 trailing newline (if header was printed)
  if (renderer.phase2HeaderPrinted()) {
    log("");
  }

  renderCliArtifacts(log, spec, report);
  renderFinalSummary(log, spec, report, deps.fromWizard === true);
}

/**
 * v26.64.0 (ADR-020) — `--scope` flag 해석. invalid 값은 warn + "project" default.
 * 비대화형 (--track 명시) 진입에서만 호출. wizard 는 별도 prompt.
 */
function resolveScopeOption(value: string | undefined, err: (msg: string) => void): InstallScope {
  if (value === undefined) return "project";
  if (isInstallScope(value)) return value;
  err(
    c.yellow(`[WARN] Unknown --scope value '${value}' (expected: project, global). Using project.`),
  );
  return "project";
}

/**
 * v26.47.0 — Normalize cac repeatable flag (string | string[] | undefined) → string[].
 * Trim 빈 문자열 + dedup.
 */
function normalizeRepeatable(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return [...new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0))];
}

/* v8 ignore start — thin dep-inject defaults. tests 는 항상 runPipeline / resolveHarnessRoot 주입. */
function defaultRunPipeline(
  spec: InstallSpec,
  harnessRoot: string,
  mode?: import("../installer.js").InstallMode,
  callbacks?: PipelineCallbacks,
): InstallReport {
  const ctx: import("../installer.js").InstallContext = {
    harnessRoot,
    projectDir: spec.projectDir,
    spec,
  };
  if (mode) ctx.mode = mode;
  if (callbacks?.onProgress) ctx.onProgress = callbacks.onProgress;
  if (callbacks?.externalDeps) ctx.externalDeps = callbacks.externalDeps;
  return runInstallPipeline(ctx);
}

function defaultHarnessRoot(): string {
  // The bundled CLI lives at <root>/dist/index.js. import.meta.url + ../ resolves to <root>.
  return resolve(new URL(".", import.meta.url).pathname, "..");
}

/* v8 ignore stop */

export { defaultHarnessRoot };

export function registerInstallCommand(cli: Cli): void {
  cli
    .command("install", "Install harness assets into a project")
    // === Track / CLI / Project ===
    .option("--track <name>", "[Track] Track to install (repeatable)", { type: [String] })
    .option(
      "--cli <target>",
      "[CLI] Target CLI (repeatable): claude | codex | opencode | antigravity",
      {
        type: [String],
        default: "claude",
      },
    )
    .option("--project-dir <path>", "[Project] Target project directory", {
      default: process.cwd(),
    })
    .option("--scope <scope>", "[Scope] Installation scope: project (default) | global", {
      default: "project",
    })
    // === Asset selection (Phase C full, v26.47.0+) ===
    .option(
      "--with <asset-id>",
      "[Asset] Force-include External Asset id (regardless of preset). Repeatable. v26.47.0+",
    )
    .option(
      "--without <asset-id>",
      "[Asset] Force-exclude External Asset id (drop from preset recommendation). Repeatable. v26.47.0+",
    )
    // === Codex global (v26.46.0+) ===
    .option(
      "--with-codex-trust",
      "[Codex] Codex global opt-in: register trust entry in ~/.codex/config.toml",
    )
    // v26.81.0 (ADR-022, BREAKING) — 자산 1:1 플래그 13종 삭제. 자산 opt-in 은 전부
    //   generic `--with <asset-id>` (위) — 자산 id 목록은 docs/COMPATIBILITY.md 표 참조.
    //   아래는 자산이 아닌 설치 동작 옵션만.
    .option(
      "--with-prune",
      "[Behavior] Prune ECC items beyond curated 89 (use with --with ecc-plugin)",
    )
    .option(
      "--with-karpathy-hook",
      "[Behavior] karpathy-coder pre-commit hook (.claude/settings.json PreToolUse Write|Edit)",
    )
    // === Misc ===
    .option("--verbose", "[Misc] Show installed file lists per category (default: counts only)")
    // === Examples (v26.50.0+) ===
    .example("install --track tooling --with karpathy-coder")
    .example("install --track csr-supabase --cli claude --cli codex")
    .example("install --track csr-supabase --without netlify-cli --with railway-skills")
    /* v8 ignore next — cac action callback. installAction 자체는 별도 tests 로 검증. */
    .action((options: InstallOptions) => installAction(options));
}

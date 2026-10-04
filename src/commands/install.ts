/**
 * `install` subcommand — spec 검증 + 파이프라인 오케스트레이션 (v26.82.0, Phase R).
 * 화면 출력(헤더/Phase rows/산출물/Summary)은 `install-render.ts` 로 분리.
 */

import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isKeyId } from "../adapters/index.js";
import { BASELINE_PREFIX, listBaselineTargets } from "../baseline-targets.js";
import type { Cli } from "../cli.js";
import { parseCliTargets } from "../cli-targets.js";
import { c, status, unifiedSection } from "../design.js";
import { EXTERNAL_ASSETS } from "../external-assets.js";
import { dirTreesIdentical } from "../fs-ops.js";
import { installedClis, readInstallLog } from "../install-log.js";
import { withRecordedExclusions } from "../install-writes.js";
import { type InstallReport, runInstall as runInstallPipeline } from "../installer.js";
import { renderedKeyIds } from "../key-ids.js";
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
  //   #492 — `--with-prune` 삭제 (ECC 자산 은퇴로 prune 대상 자체가 없다).
  withCodexTrust?: boolean;
  /**
   * v26.47.0 (Phase C full) — External Asset 직접 추가 (preset condition 무관 강제 포함).
   * cac repeatable. 예: `--with railway-skills --with impeccable`.
   * 옵션-키 동작 flag (예: `--with-codex-trust`) 와 별개 — External Asset id 만.
   */
  with?: string | string[];
  /**
   * v26.47.0 (Phase C full) — External Asset 직접 제외 (preset 추천에서 unchecked).
   * cac repeatable. 예: `--without netlify-cli`.
   */
  without?: string | string[];
  /**
   * v26.64.0 (ADR-020) — Installation scope. `project` (default).
   * #560 (ADR-097 결정 1) — `global` 은 새 설치에서 거절한다(`globalScopeRefusal`). 기록이 이미 global 인
   * 설치본만 그대로 받는다 — 그 설치본의 위저드 `RUNS AS` 줄과 복구 명령이 `--scope global` 을 찍는다.
   */
  scope?: string;
  /**
   * #533 (D9) — 하네스 파일을 다시 깐다(`mode: "reinstall"`). 위저드 메뉴에서 빠져 이 플래그가 됐다.
   * `--track` 은 여전히 필수다. #551 PR-3 — 폴더를 옮기지 않는다: install 과 같은 쓰기를 판정대로 한다
   * (고친 파일만 그 파일 하나 백업). 깨진 설치(기록엔 claude, `.claude/` 없음)의 복구 명령이 이것이다.
   */
  reinstall?: boolean;
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
  // #613 — cac 는 absent 플래그를 "undefined" 문자열로, 빈 값을 mri 수치 강제로 "0" 으로
  // 뒤트려 전달한다. 그대로 검증에 넘기면 "Unknown track: undefined" 라는, 사용자가 입력한
  // 적 없는 값을 오류의 주어로 삼는다. 센티넬을 먼저 걷고 남은 것이 없으면 누락 안내로.
  const trackInputs = (options.track ?? []).filter(
    (t) =>
      t !== undefined && t !== null && `${t}` !== "" && `${t}` !== "undefined" && `${t}` !== "0",
  ) as string[];
  if (trackInputs.length === 0) {
    if ((options.track ?? []).length > 0) {
      return {
        ok: false,
        cli: parsed.targets,
        warnings: parsed.warnings,
        message:
          "--track 값이 비어 있다 — 예: --track tooling (빈 문자열이 숫자 0 으로 해석될 수 있다)",
      };
    }
    return {
      ok: false,
      cli: parsed.targets,
      warnings: parsed.warnings,
      // v26.56.0 (F6) — wizard 진입 안내. `install` subcommand 는 non-interactive.
      message:
        "At least one --track is required (e.g. --track tooling)\n       Interactive wizard: run without subcommand → `agent-harness` (drop the `install` word)",
    };
  }
  // #617 — 트랙은 집합 의미다. `--track base --track base` 가 기록·list·CLAUDE.md 까지
  // "base, base" 로 번지는데, `--cli` 는 dedup 된다(대칭 위반).
  const uniqueTracks = [...new Set(trackInputs)];
  for (const t of uniqueTracks) {
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
  const refusal = globalScopeRefusal(options);
  if (refusal !== null) {
    err(status.failure(c.red(`ERROR: ${refusal[0]}`)));
    for (const line of refusal.slice(1)) err(`       ${line}`);
    exit(1);
    return;
  }

  // ADR-099 R6 (#616) — 같은 id 를 넣고 빼라고 하면 어느 쪽인지 정하지 않는다. 아무것도 쓰기 전에 멈춘다.
  // `installSpecFromOptions` 안이 아니라 여기인 이유: 위저드도 그 함수를 부르는데 위저드는 이 상태를 만들 수 없다.
  const both = conflictingIds(options);
  if (both.length > 0) {
    for (const id of both) {
      err(status.failure(c.red(`'${id}' is in both --with and --without — pick one`)));
    }
    exit(1);
    return;
  }

  const spec = installSpecFromOptions(options, validated.cli, err, resolveHarnessRoot());

  executeSpec(spec, {
    log,
    err,
    exit,
    runPipeline,
    resolveHarnessRoot,
    verbose: options.verbose === true,
    ...(options.reinstall === true ? { mode: "reinstall" as const } : {}),
  });
}

/**
 * #560 (ADR-097 결정 1) — 새 설치의 `--scope global` 을 거절하고 대체 명령을 안내한다. 하네스 파일은
 * 범위와 무관하게 늘 이 프로젝트에 쓰였고 Global 이 바꾸던 것은 외부 자산 도구의 플래그뿐이었다 — 그것은
 * 도구를 직접 부르면 된다.
 *
 * **기록이 이미 global 이면 받는다**(설계 §5 — 옛 global 설치본은 지금처럼). 그 설치본의 위저드 Update
 * 확인 화면(`RUNS AS`)과 복구 명령(`router.ts` · `update-mode.ts`)이 기록의 scope 를 그대로 찍으므로,
 * 여기서 막으면 화면이 준 명령을 설치자가 칠 수 없게 된다. 판정은 기록으로 한다 — 디스크 존재가 아니다.
 *
 * @returns 거절이면 출력할 줄(첫 줄 = 사유), 아니면 null.
 */
function globalScopeRefusal(options: InstallOptions): string[] | null {
  if (options.scope !== "global") return null;
  const projectDir = resolve(options.projectDir ?? process.cwd());
  if (readInstallLog(projectDir)?.scope === "global") return null;
  return [
    "--scope global is no longer offered — the harness installs into this project only.",
    "To make an external asset available in every project, install it with its own tool:",
    "  claude plugin install --scope user <plugin>",
    "  npx skills add -g <source>",
    "  npm i -g <pkg>",
    "Then run this command again without --scope.",
  ];
}

/**
 * 검증을 통과한 플래그 → `InstallSpec`.
 *
 * #533 (D6) — `install` 명령과 위저드 Update 의 추가 케이스가 **이 함수 하나**로 spec 을 만든다.
 * 위저드 확인 화면의 `RUNS AS` 줄(`installCommandLine`)이 곧 이 함수의 입력이라, 화면이 말하는
 * 명령과 실제로 도는 spec 이 갈라질 자리가 없다.
 */
export function installSpecFromOptions(
  options: InstallOptions,
  cli: CliTargets,
  err: (msg: string) => void,
  /**
   * ADR-099 R4 — 키 id(`mcp:github`)를 이번 렌더와 대조할 하네스 루트. 없으면(위저드 — 키 id 를 내지 않는다, 설계 G2)
   * 키 id 는 모르는 id 로 경고하고 건너뛴다.
   */
  harnessRoot?: string,
): InstallSpec {
  // v26.47.0 — Phase C full: --with/--without repeatable → userOverride.
  const forceInclude = normalizeRepeatable(options.with);
  const forceExclude = normalizeRepeatable(options.without);
  const tracks = [...new Set(options.track ?? [])] as Track[];
  // ADR-099 R4 — 두 플래그는 화면이 보여 주는 모든 id 를 받는다: 카탈로그(번들 스킬 포함) · `baseline:` · 키 id.
  // `--with` 의 baseline · 키 id 는 기록된 빼기를 푸는 일만 한다(기본으로 깔리는 것이라 "추가" 할 것은 없다).
  // 기록 트랙 · 깔린 CLI 의 것도 받는다 — 이번 실행에 안 넣었어도 화면이 보여 준 id 다.
  const record = readInstallLog(resolve(options.projectDir ?? process.cwd()));
  const recordTracks = (record?.spec.tracks ?? []).filter(isTrack);
  // 2026-08-16 — `--without` 는 외부 자산 id 와 트랙 baseline id(`baseline:<kind>/<name>`)를 받는다. 위저드에서 체크를
  // 풀 수 있는 것을 플래그로는 못 뺀다면 같은 기능이 진입점마다 다른 것이고, 이 리포가 세 번 적발당한 표면 비대칭이다.
  const baselineIds = new Set(listBaselineTargets({ tracks }).map((t) => t.id));
  const releasableBaseline = new Set([
    ...baselineIds,
    ...listBaselineTargets({ tracks: recordTracks }).map((t) => t.id),
  ]);
  const keyIds = (): ReadonlySet<string> => {
    if (harnessRoot === undefined) return new Set();
    const clis = [...new Set([...(record ? installedClis(record) : []), ...cli])];
    return renderedKeyIds(harnessRoot, [...new Set([...recordTracks, ...tracks])], clis);
  };
  let renderedKeys: ReadonlySet<string> | undefined;
  const isRenderedKey = (id: string): boolean => {
    if (!isKeyId(id)) return false;
    renderedKeys ??= keyIds();
    return renderedKeys.has(id);
  };

  // v26.49.0 — unknown asset id validation (silent ignore 방지).
  const validIds = new Set(EXTERNAL_ASSETS.map((a) => a.id));
  for (const id of forceInclude) {
    if (validIds.has(id) || releasableBaseline.has(id) || isRenderedKey(id)) continue;
    err(
      c.yellow(
        id.startsWith(BASELINE_PREFIX)
          ? `[WARN] '${id}' is not installed by the recorded or selected track(s) — nothing to bring back. Available: ${[...releasableBaseline].sort().join(", ")}`
          : `[WARN] Unknown asset id '${id}' (--with). Skipping. Use one of: ${[...validIds].sort().join(", ")}`,
      ),
    );
  }
  for (const id of forceExclude) {
    if (validIds.has(id) || baselineIds.has(id) || isRenderedKey(id)) continue;
    // 갈림은 **id 의 생김새**로 한다(사유가 아니다 — 오타와 트랙 밖은 여기서 구분되지 않는다).
    // `baseline:` 꼴이면 이 트랙의 후보 전체를 함께 보여 주는 편이 카탈로그 전체를 쏟는 것보다
    // 낫다. 반대로 카탈로그 id 오타에 baseline 목록을 보이면 엉뚱한 곳을 뒤지게 된다.
    err(
      c.yellow(
        id.startsWith(BASELINE_PREFIX)
          ? `[WARN] '${id}' is not installed by the selected track(s) — nothing to exclude. Available: ${[...baselineIds].sort().join(", ")}`
          : `[WARN] Unknown asset id '${id}' (--without). Skipping. Use one of: ${[...validIds].sort().join(", ")}`,
      ),
    );
  }
  const baselineExclude = forceExclude.filter((id) => baselineIds.has(id));
  const keyExclude = forceExclude.filter((id) => !validIds.has(id) && isRenderedKey(id));
  const releaseExclude = forceInclude.filter(
    (id) => !validIds.has(id) && (releasableBaseline.has(id) || isRenderedKey(id)),
  );
  const filteredInclude = forceInclude.filter((id) => validIds.has(id));
  const filteredExclude = forceExclude.filter((id) => validIds.has(id));
  const userOverride =
    filteredInclude.length > 0 || filteredExclude.length > 0
      ? { forceInclude: filteredInclude, forceExclude: filteredExclude }
      : undefined;

  return {
    tracks,
    ...(userOverride ? { userOverride } : {}),
    ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
    ...(releaseExclude.length > 0 ? { releaseExclude } : {}),
    ...(keyExclude.length > 0 ? { keyExclude } : {}),
    // v26.81.0 (ADR-022, BREAKING) — 자산 1:1 boolean 13종 삭제. 자산 선택은 위
    //   userOverride(--with <id>)로 일원화. 잔존 = 설치 동작 옵션만.
    options: {
      withCodexTrust: options.withCodexTrust === true,
    },
    cli,
    projectDir: resolve(options.projectDir ?? process.cwd()),
    scope: resolveScopeOption(options.scope, err),
  };
}

/**
 * `InstallOptions` → 사람이 그대로 칠 수 있는 명령 한 줄 (`--project-dir` 는 뺀다 — 현재 디렉터리에서
 * 치는 명령이다). #533 — 위저드 확인 화면의 `RUNS AS` 줄. `installSpecFromOptions` 의 역이다.
 */
export function installCommandLine(options: InstallOptions): string {
  const repeat = (flag: string, value: string | string[] | undefined): string[] =>
    normalizeRepeatable(value).map((v) => `${flag} ${v}`);
  return [
    "agent-harness install",
    ...repeat("--track", options.track),
    ...repeat("--cli", options.cli),
    ...(options.scope ? [`--scope ${options.scope}`] : []),
    ...repeat("--with", options.with),
    ...repeat("--without", options.without),
  ].join(" ");
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
export function executeSpec(requested: InstallSpec, deps: ExecuteSpecDeps = {}): void {
  // ADR-099 R3 — 기록된 빼기는 이번 설치도 지킨다. 화면(머리글 · 자산 수 · 상주 비용)이 실제로 깔릴 것을 말하도록
  // 파이프라인과 같은 누적 결과로 그린다(파이프라인도 같은 함수를 다시 걸고, 결과는 같다).
  const spec =
    deps.mode === "update"
      ? requested
      : withRecordedExclusions(requested, readInstallLog(requested.projectDir)).spec;
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
    // #594 — update 실행이 실패했는데 "install failed" 라고 쓰면 사용자는 무엇이 죽었는지
    // 못 본다. 이 catch 는 두 파이프라인을 함께 감싼다.
    const label = deps.mode === "update" ? "update failed" : "install failed";
    err(status.failure(c.red(`${label} — ${detail}`)));
    exit(1);
    return;
  }

  // #556 — update 가 시작 시 만든 `.claude.backup-<ts>` 가 끝까지 원본과 동일하면 이번 실행은
  // `.claude/` 를 하나도 안 고친 것이다. 그 백업은 아무것도 지키지 않으므로 지우고 보고에서도
  // 뺀다 — 실행마다 쌓이는 무의미한 사본이 이 이슈의 본체다. (백업은 변경 '전' 내용을 담으므로,
  // 트리가 동일하다는 것은 변경이 없었다는 것과 정확히 동치다.)
  if (deps.mode === "update" && report.backup !== null) {
    const liveClaude = join(spec.projectDir, ".claude");
    if (dirTreesIdentical(liveClaude, report.backup)) {
      try {
        rmSync(report.backup, { recursive: true, force: true });
        report.backup = null;
      } catch {
        /* 지우지 못한 백업은 그냥 둔다 — 보존 방향의 실패라 해롭지 않다. */
      }
    }
  }

  // Update mode 단축 출력 — manifest copy / external 모두 skip
  if (report.updateMode) {
    renderUpdateSummary(log, spec, report);
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
 * `global` 이 여기까지 오는 것은 기록이 이미 global 인 설치본뿐이다(`globalScopeRefusal` · 위저드 Update).
 */
function resolveScopeOption(value: string | undefined, err: (msg: string) => void): InstallScope {
  if (value === undefined) return "project";
  if (isInstallScope(value)) return value;
  err(c.yellow(`[WARN] Unknown --scope value '${value}' (expected: project). Using project.`));
  return "project";
}

/** ADR-099 R6 — `--with` 와 `--without` 에 함께 들어온 id. */
export function conflictingIds(options: Pick<InstallOptions, "with" | "without">): string[] {
  const without = new Set(normalizeRepeatable(options.without));
  return normalizeRepeatable(options.with).filter((id) => without.has(id));
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
  // fileURLToPath 필수 — `.pathname` 은 공백/비ASCII 경로를 percent-encoded 로 남겨
  // "Templates dir not found" 로 install 이 실패한다 (v26.103.0 SOD 리뷰 2기 독립 수렴).
  return resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
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
    .option(
      "--scope <scope>",
      "[Scope] project (the only choice — harness files always go into this project). global is kept only for installs whose record already says global",
      {
        default: "project",
      },
    )
    // === Asset selection (Phase C full, v26.47.0+) ===
    .option(
      "--with <asset-id>",
      "[Asset] Force-include External Asset id (regardless of preset). Repeatable. v26.47.0+",
    )
    .option(
      "--without <asset-id>",
      "[Asset] Force-exclude External Asset id (drop from preset recommendation). Repeatable. v26.47.0+",
    )
    // === Codex trust (v26.46.0+ · ADR-097 결정 2 — 범위 조건 없음) ===
    .option(
      "--with-codex-trust",
      '[Codex] Trust this folder in Codex: add [projects."<dir>"] to ~/.codex/config.toml so .codex/config.toml (MCP · hooks · sandbox · approval) is read without opening Codex first',
    )
    // v26.81.0 (ADR-022, BREAKING) — 자산 1:1 플래그 13종 삭제. 자산 opt-in 은 전부
    //   generic `--with <asset-id>` (위) — 자산 id 목록은 docs/COMPATIBILITY.md 표 참조.
    //   #492 — 마지막 동작 플래그였던 `--with-prune` 도 삭제 (ECC 자산 은퇴).
    // === Mode (#533 D9) ===
    .option(
      "--reinstall",
      "[Mode] Rewrite the harness files in place — files you edited are saved as <file>.backup-<time> first; your own files stay. Use when .claude/ is damaged or missing",
    )
    // === Misc ===
    .option("--verbose", "[Misc] Show installed file lists per category (default: counts only)")
    // === Examples (v26.50.0+) ===
    .example("install --track tooling --with marketingskills")
    .example("install --track csr-supabase --cli claude --cli codex")
    .example("install --track csr-supabase --without netlify-cli --with railway-skills")
    /* v8 ignore next — cac action callback. installAction 자체는 별도 tests 로 검증. */
    .action((options: InstallOptions) => installAction(options));
}

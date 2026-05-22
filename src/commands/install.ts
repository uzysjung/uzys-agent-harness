import { resolve } from "node:path";
import { CATEGORY_TITLES, type Category } from "../categories.js";
import type { Cli } from "../cli.js";
import { parseCliTargets, targetsInclude } from "../cli-targets.js";
import {
  assetRow,
  c,
  infoRow,
  padDisplay,
  sectionHeader,
  status,
  unifiedSection,
} from "../design.js";
import { EXTERNAL_ASSETS } from "../external-assets.js";
import { type InstallReport, runInstall as runInstallPipeline } from "../installer.js";
import { recommendedExternalAssets } from "../preset-recommend.js";
import {
  type CliTargets,
  type InstallScope,
  type InstallSpec,
  isInstallScope,
  isTrack,
  type Track,
} from "../types.js";

export interface InstallOptions {
  track?: string[];
  /** v0.7.0 — repeatable. cac type: [String]. v0.8.0 — legacy alias 'both'/'all' 제거됨. */
  cli?: string | string[];
  /** v26.63.0 — Phase 1 templates 의 files 라인 표시 (default: counts only). */
  verbose?: boolean;
  projectDir?: string;
  withTauri?: boolean;
  withGsd?: boolean;
  withEcc?: boolean;
  withPrune?: boolean;
  withTob?: boolean;
  withCodexSkills?: boolean;
  withCodexTrust?: boolean;
  withKarpathyHook?: boolean;
  /**
   * v0.7.0 — Codex slash 통일 (~/.codex/prompts/uzys-*.md).
   * v26.46.0 — `cli` 에 codex 포함 시 default ON (ADR-012). Opt-out 은 `--no-codex-prompts`.
   * 명시 true: 사용자 explicit (legacy --with-codex-prompts 호환).
   */
  withCodexPrompts?: boolean;
  /**
   * v26.46.0 — Codex slash 통일 opt-out (cli=codex 일 때 default ON 해제).
   * cac negation flag — `--no-codex-prompts` 명시 시 cac 가 `codexPrompts: false` 로 set.
   * v26.51.0 — bug fix: 이전엔 `noCodexPrompts` field 참조 (cac 가 만들지 않음) → 동작 안 함.
   */
  codexPrompts?: boolean;
  /** v26.42.0 — addyosmani/agent-skills opt-in (BREAKING vs prior auto-install). */
  withAddyAgentSkills?: boolean;
  /** v26.44.0 — uzys-harness 6-Gate slash commands opt-in (BREAKING vs prior auto-install). */
  withUzysHarness?: boolean;
  /** v26.44.0 — obra/superpowers opt-in. Anthropic 공식 marketplace 등록. */
  withSuperpowers?: boolean;
  /**
   * v26.67.0 — Antigravity global opt-in. `~/.gemini/antigravity/skills/uzys-*` +
   * `~/.gemini/antigravity/global_workflows/uzys-*.md`. scope=global + cli=antigravity 시만 의미.
   */
  withAntigravityGlobal?: boolean;
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
        "At least one --track is required (e.g. --track tooling)\n       Interactive wizard: run without subcommand → `claude-harness` (drop the `install` word)",
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

/** Callbacks for progressive rendering during runInstall (avoids "Phase 1 silence" UX). */
export interface PipelineCallbacks {
  onProgress?: (event: import("../installer.js").ProgressEvent) => void;
  externalDeps?: {
    onAssetStart?: (asset: import("../external-assets.js").ExternalAsset) => void;
    onAssetResult?: (result: import("../external-installer.js").AssetInstallResult) => void;
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
  // v26.46.0 — Codex prompts default 화. cli=codex 시 자동. --with-codex-prompts 명시는 호환 유지.
  if (validated.ok && options.withCodexPrompts === true && !validated.cli.includes("codex")) {
    err(
      c.yellow(
        "[WARN] --with-codex-prompts requires --cli codex. Skipping (no Codex prompts will be installed).",
      ),
    );
  }
  if (validated.ok && options.codexPrompts === false && !validated.cli.includes("codex")) {
    err(
      c.yellow("[WARN] --no-codex-prompts has no effect without --cli codex (already excluded)."),
    );
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
    options: {
      withTauri: options.withTauri === true,
      withGsd: options.withGsd === true,
      withEcc: options.withEcc === true || options.withPrune === true,
      withPrune: options.withPrune === true,
      withTob: options.withTob === true,
      withCodexSkills: options.withCodexSkills === true,
      withCodexTrust: options.withCodexTrust === true,
      withKarpathyHook: options.withKarpathyHook === true,
      // v26.64.0 (ADR-020, BREAKING) — ADR-012/017 supersede. cli=codex 자동 default ON 폐기.
      //   withCodexPrompts 는 사용자 명시 `--with-codex-prompts` 시에만 ON.
      //   `--no-codex-prompts` 는 backward-compat noop (default 가 이미 false).
      //   scope=global 일 때만 ~/.codex/prompts/ 에 실 write (installer.ts 참조).
      withCodexPrompts: options.withCodexPrompts === true && options.codexPrompts !== false,
      withAddyAgentSkills: options.withAddyAgentSkills === true,
      withUzysHarness: options.withUzysHarness === true,
      withSuperpowers: options.withSuperpowers === true,
      withAntigravityGlobal: options.withAntigravityGlobal === true,
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
    const headerLabel =
      deps.mode === "update"
        ? "uzys-claude-harness · update"
        : deps.mode === "add"
          ? "uzys-claude-harness · add"
          : deps.mode === "reinstall"
            ? "uzys-claude-harness · reinstall"
            : "uzys-claude-harness · install";
    log("");
    log(sectionHeader(headerLabel));
    log("");
    log(infoRow("TARGET", shortenPath(spec.projectDir)));
    log(infoRow("TRACKS", spec.tracks.join(", ")));
    log(infoRow("CLI", spec.cli.join(" · ")));
    // v26.64.0 (ADR-020) — SCOPE row. 사용자가 매 install 시 어디에 write 되는지 인지 (D16).
    {
      const effectiveScope = spec.scope ?? "project";
      const scopeMsg =
        effectiveScope === "global"
          ? "Global — writes to ~/.claude/, ~/.codex/, npm -g"
          : "Project — current directory only (no global write)";
      log(infoRow("SCOPE", scopeMsg));
    }
    log(infoRow("OPTIONS", formatOptions(spec)));
    const finalAssets = computeFinalAssets(spec);
    if (finalAssets.length > 0) {
      log(infoRow("ASSETS", `${finalAssets.length} selected`));
      for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
        log(`              ${c.dim(`· ${cat}:`)} ${ids.join(", ")}`);
      }
    }
    log("");
  }

  // v26.63.0 — phaseHeader → unifiedSection. Phase 카운터 (1/2/3) 제거 — 5-step 통합 시
  //   wizard step 5/5 안 sub-section 으로 자연 흐름. Update mode 도 동일.
  log(unifiedSection(deps.mode === "update" ? "Update Mode" : "Templates"));
  log("");

  // Streaming progress: baseline 완료 시 즉시 Phase 1 rows 출력, external은 per-asset 스트리밍.
  let phase2HeaderPrinted = false;
  // v26.55.0 — Phase 2 grouped progress UX (ADR-016). category 변경 시 ━━ <Title> ━━ 헤더 출력.
  // external-installer 가 카테고리 순서로 정렬해 호출 → 첫 번째 호출이 category 1 의 첫 자산.
  let currentCategory: Category | null = null;
  const callbacks: PipelineCallbacks = {
    onProgress: (event) => {
      if (event.type === "baseline-complete") {
        renderPhase1Rows(log, event.baseline, deps.verbose === true, spec.options.withEcc === true);
      } else if (event.type === "external-start" && event.assetCount > 0) {
        // v26.63.0 — phaseHeader → unifiedSection. count 헤더에 inline 표시.
        log(unifiedSection(`External assets (${event.assetCount})`));
        log("");
        phase2HeaderPrinted = true;
      }
    },
    externalDeps: {
      onAssetStart: (asset) => {
        // v26.57.0 (F2) — 카테고리 헤더만 출력. 자산 시작 라인 (→) 제거 — ✓ 결과 한 라인으로 1 단위 명확화.
        if (asset.category !== currentCategory) {
          if (currentCategory !== null) log("");
          log(`  ${c.bold(`━━ ${CATEGORY_TITLES[asset.category]} ━━`)}`);
          currentCategory = asset.category;
        }
      },
      onAssetResult: (result) => {
        const meta = result.ok
          ? formatAssetMeta(result.asset, result.version)
          : (result.message ?? "failed");
        log(`  ${assetRow(result.ok ? "success" : "skip", result.asset.id, meta)}`);
      },
    },
  };

  let report: InstallReport;
  try {
    report = runPipeline(spec, resolveHarnessRoot(), deps.mode, callbacks);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    log("");
    err(status.failure(c.red(`install failed — ${detail}`)));
    exit(1);
    return;
  }

  // Update mode 단축 출력 — manifest copy / external 모두 skip
  if (report.updateMode) {
    log("");
    // v26.63.2 — Summary 도 unifiedSection 으로 통일 (━━ marker). Step 5 안 sub-section 들과 일관.
    log(unifiedSection("Summary"));
    log("");
    log(infoRow("STATUS", c.green("Update complete")));
    log(infoRow("MODE", "update"));
    if (report.backup) {
      log(infoRow("BACKUP", shortenPath(report.backup)));
      log(infoRow("ROLLBACK", `rm -rf .claude && mv ${shortenPath(report.backup)} .claude`));
    }
    log("");
    return;
  }

  // Phase 2 trailing newline (if header was printed)
  if (phase2HeaderPrinted) {
    log("");
  }

  // v26.63.0 — Codex / OpenCode 산출물 sub-section. phaseHeader → unifiedSection.
  if (
    (report.codex || report.opencode) &&
    (targetsInclude(spec.cli, "codex") || targetsInclude(spec.cli, "opencode"))
  ) {
    log(unifiedSection(formatCliPhaseTitle(spec.cli)));
    log("");
    // AGENTS.md is shared across Codex/OpenCode — render once with shared note
    if (report.codex && report.opencode) {
      log(assetRow("success", "AGENTS.md", "shared (Codex + OpenCode)"));
    } else if (report.codex || report.opencode) {
      log(assetRow("success", "AGENTS.md", "from .claude/CLAUDE.md"));
    }
    if (report.codex) {
      log(assetRow("success", ".codex/config.toml", "settings + [mcp_servers.*]"));
      log(assetRow("success", ".codex/hooks/", `${report.codex.hookFiles.length} files`));
      log(
        assetRow(
          "success",
          ".agents/skills/uzys-*/SKILL.md",
          `${report.codex.skillFiles.length} skills ($uzys-spec mention)`,
        ),
      );
      // v0.7.1 — project-scoped prompts pre-positioning (글로벌 영향 0)
      if (report.codex.promptFiles.length > 0) {
        log(
          assetRow(
            "success",
            ".codex/prompts/uzys-*.md",
            `${report.codex.promptFiles.length} prompts (upstream #9848 지원 시 /uzys-spec 자동 작동)`,
          ),
        );
      }
      // Codex global opt-in (D16) — only when explicitly enabled
      if (report.codexOptIn) {
        if (report.codexOptIn.skillsInstalled.enabled) {
          log(
            assetRow(
              "success",
              "~/.codex/skills/uzys-*",
              `${report.codexOptIn.skillsInstalled.count} copied (global opt-in)`,
            ),
          );
        }
        if (report.codexOptIn.trustEntry.enabled) {
          const trust = report.codexOptIn.trustEntry;
          const kind = trust.status === "error" ? "skip" : "success";
          const meta =
            trust.status === "registered"
              ? '[projects."<dir>"] trust_level="trusted"'
              : trust.status === "already-present"
                ? "already present"
                : (trust.message ?? "error");
          log(assetRow(kind, "~/.codex/config.toml trust entry", meta));
        }
        // v0.7.0 — Codex prompts (slash 통일) opt-in 결과
        if (report.codexOptIn.promptsInstalled.enabled) {
          const count = report.codexOptIn.promptsInstalled.count;
          log(
            assetRow(
              count > 0 ? "success" : "skip",
              "~/.codex/prompts/uzys-*",
              `${count} markdown copied (/uzys-spec slash 등록)`,
            ),
          );
        }
      }
    }
    if (report.opencode) {
      log(assetRow("success", "opencode.json", "$schema + 5 keys"));
      log(
        assetRow("success", ".opencode/commands/", `${report.opencode.commandFiles.length} files`),
      );
      log(assetRow("success", ".opencode/plugins/uzys-harness.ts", "self-contained plugin"));
    }
    log("");
  }

  // v26.63.2 — Summary 도 unifiedSection 으로 통일 (━━ marker).
  log(unifiedSection("Summary"));
  log("");
  log(infoRow("STATUS", c.green("Install complete")));
  log(infoRow("TRACKS", report.installedTracks.join(", ")));
  // v26.63.4 (P3): install header `CLI` 와 Summary `CLIs` 라벨 불일치 → `CLI` 로 통일.
  if (report.codex && report.opencode) {
    log(infoRow("CLI", "Claude · Codex · OpenCode"));
  } else if (report.codex) {
    log(infoRow("CLI", "Claude · Codex"));
  } else if (report.opencode) {
    log(infoRow("CLI", "Claude · OpenCode"));
  } else {
    log(infoRow("CLI", "Claude"));
  }
  if (report.external && report.external.skipped > 0) {
    log("");
    log(
      infoRow(
        "WARN",
        c.yellow(
          `${report.external.skipped} external asset${report.external.skipped > 1 ? "s" : ""} skipped (see Phase 2 above)`,
        ),
      ),
    );
  }
  log("");
  log(infoRow("NEXT", `${c.bold("claude")}  →  ${c.cyan("/uzys:spec")}`));
  log("");
}

function formatAssetMeta(
  asset: import("../external-assets.js").ExternalAsset,
  version?: string,
): string {
  // v26.56.0 (F3) — description 제거. onAssetStart 의 → 라인이 이미 description 표시.
  // result row 는 method + source 만 간결하게 → terminal 120 char 안 wrap 방지.
  // v26.59.0 — plugin / npm-global 에 한해 version 표시 (path 기반 추출).
  const m = asset.method;
  const v = version ? ` ${c.dim(`v${version.replace(/^v/, "")}`)}` : "";
  switch (m.kind) {
    case "skill":
      // v26.63.3 (clarify M1): skill name 이 asset id 와 동일하면 중복 segment 생략.
      //   "skill · pbakaus/impeccable · impeccable" → "skill · pbakaus/impeccable"
      if (m.skill && m.skill !== asset.id) return `skill · ${m.source} · ${m.skill}`;
      return `skill · ${m.source}`;
    case "plugin":
      return `plugin · ${m.pluginId}${v}`;
    case "npm":
      return `npm -g · ${m.pkg}${v}`;
    case "npx-run":
      return `npx · ${m.cmd}`;
    case "shell-script":
      return `bash · ${m.script}`;
  }
}

/**
 * Phase 1 rows 출력. baseline-complete progress event에서 호출 — 외부 자산 설치
 * 시작 전 즉시 화면에 표시되어야 한다 (멈춰 보임 방지).
 */
function renderPhase1Rows(
  log: (msg: string) => void,
  baseline: import("../installer.js").BaselineReport,
  verbose = false,
  withEcc = false,
): void {
  // Update mode rows
  if (baseline.updateMode) {
    if (baseline.backup) {
      log(assetRow("success", "backup", shortenPath(baseline.backup)));
    }
    for (const [dir, count] of Object.entries(baseline.updateMode.updated)) {
      if (count > 0) log(assetRow("success", dir, `${count} files updated`));
    }
    for (const [dir, removed] of Object.entries(baseline.updateMode.pruned)) {
      if (removed.length > 0) {
        log(assetRow("skip", `${dir} orphan prune`, `${removed.length} removed`));
      }
    }
    if (baseline.updateMode.claudeMdUpdated) {
      log(assetRow("success", ".claude/CLAUDE.md", "refreshed from template"));
    }
    if (baseline.updateMode.staleHookRefs.length > 0) {
      log(
        assetRow(
          "skip",
          "settings.json stale hook refs",
          `${baseline.updateMode.staleHookRefs.length} removed`,
        ),
      );
    }
    return;
  }

  // Fresh / add / reinstall — Phase 1 rows
  // v26.57.1 (F2) — multi-line 구조 (header + use + files). visual hierarchy + width-safe.
  // 사용자 image 검증 (2026-05-17): 단일 라인 description 이 width 좁을 때 wrap → 들여쓰기 깨짐.
  const cats = baseline.categories;
  if (cats) {
    // v26.63.0 — files 라인은 verbose 옵션 시만. 기본은 카운트 + use 1 줄.
    // v26.63.2 — polish: label + count 칼럼 fixed-width 정렬 (28 char). spacing scale 일관.
    const phase1Row = (label: string, count: number, useText: string, files?: string[]) => {
      const labelCol = `${c.bold(label)} ${c.dim(`(${count})`)}`;
      const padded = padDisplay(labelCol, 28);
      log(`  ${c.green("✓")} ${padded} ${c.dim(useText)}`);
      if (verbose && files && files.length > 0) {
        log(`      ${c.dim("└ files:")} ${c.dim(files.join(", "))}`);
      }
    };

    if (cats.rules.length > 0) {
      phase1Row(
        "rules",
        cats.rules.length,
        "coding · git/PR · tests · ship checklist · MCP policy",
        cats.rules,
      );
    }
    if (cats.agents.length > 0) {
      // v26.63.3 (clarify H3): SOD jargon 보강 — independent verifier 명시.
      // v26.63.3 (distill H2): "Without ECC plugin..." 반복 제거 — section footer 통합.
      phase1Row(
        "agents",
        cats.agents.length,
        "SOD reviewer (opus, independent verifier) + 3 base",
        cats.agents,
      );
    }
    if (cats.hooks.length > 0) {
      phase1Row(
        "hooks",
        cats.hooks.length,
        "session-start · gate-check (6-Gate order) · spec-drift · agentshield (security)",
        cats.hooks,
      );
    }
    if (cats.commands > 0) {
      phase1Row("commands", cats.commands, "uzys-harness option: /uzys:* (7)");
    }
    if (cats.skills.length > 0) {
      phase1Row(
        "skills",
        cats.skills.length,
        "north-star · gh-issue-workflow · ui-visual-review · cl-v2 (modified)",
        cats.skills,
      );
    }
  } else {
    // v0.6.0 backwards compat — categories 없는 fakeReport 등
    log(assetRow("success", "rules + hooks + commands + agents", `${baseline.filesCopied} files`));
    log(assetRow("success", "skeleton", `${baseline.dirsCopied} dirs`));
  }
  // v26.63.4 (P3): Templates section 의 assetRow 호출 labelWidth=28 명시 → phase1Row 와 column 정렬.
  //   default 40 은 External assets 의 긴 asset id (architecture-decision-record 등) 용 — 별개.
  const TEMPLATES_COL = 28;
  if (baseline.rootClaudeMd) {
    const n = baseline.rootClaudeMd.tracks.length;
    log(
      assetRow(
        "success",
        "CLAUDE.md (root)",
        `merged from ${n} track${n > 1 ? "s" : ""}`,
        TEMPLATES_COL,
      ),
    );
  }
  if (baseline.skipped > 0) {
    log(
      assetRow(
        "skip",
        "manifest entries (applies → false)",
        `${baseline.skipped} skipped`,
        TEMPLATES_COL,
      ),
    );
  }
  if (baseline.backup) {
    log(assetRow("success", "backup", shortenPath(baseline.backup), TEMPLATES_COL));
  }
  const mcpList = baseline.mcpServers.join(", ") || "(none)";
  log(assetRow("success", ".mcp.json", mcpList, TEMPLATES_COL));
  if (baseline.envFiles.mcpAllowlist) {
    log(
      assetRow(
        "success",
        ".mcp-allowlist",
        `${baseline.envFiles.mcpAllowlist.length} servers (D35 opt-in gate)`,
        TEMPLATES_COL,
      ),
    );
  }
  // v26.63.3 (distill H2): ECC fallback hint — Templates section 마지막에 통합 표시.
  //   withEcc=true (ECC plugin opt-in) 사용자에게는 hint 미표시.
  if (!withEcc && baseline.categories) {
    log("");
    log(
      `  ${c.dim("·")} ${c.dim("ECC plugin not selected — cherry-pick fallback active (up to 4 agents + 8 skills + 3 commands)")}`,
    );
    log(`  ${c.dim("·")} ${c.dim("Use --with-ecc to install ECC plugin instead")}`);
  }
  if (baseline.envFiles.envExampleCreated) {
    log(assetRow("success", ".env.example", "Supabase token guide"));
  }
  if (baseline.envFiles.gitignoreEnvAdded) {
    log(assetRow("success", ".gitignore", "+ .env"));
  }
  if (baseline.envFiles.gitignoreNpxSkillsAdded.length > 0) {
    log(
      assetRow(
        "success",
        ".gitignore",
        `+ ${baseline.envFiles.gitignoreNpxSkillsAdded.join(" ")} (npx skills universal install)`,
      ),
    );
  }
  log("");
}

/**
 * v26.47.0 — Normalize cac repeatable flag (string | string[] | undefined) → string[].
 * Trim 빈 문자열 + dedup.
 */
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

function normalizeRepeatable(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const arr = Array.isArray(value) ? value : [value];
  return [...new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0))];
}

/**
 * v26.62.4 — preset recommended + userOverride 적용 후 최종 자산 id list.
 * install header 의 ASSETS row 와 (향후) formatSummary 통합 위치.
 */
function computeFinalAssets(spec: InstallSpec): string[] {
  const recommended = new Set(recommendedExternalAssets(spec.tracks));
  if (spec.userOverride) {
    for (const id of spec.userOverride.forceExclude) recommended.delete(id);
    for (const id of spec.userOverride.forceInclude) recommended.add(id);
  }
  return [...recommended].sort();
}

/** v26.62.4 — 자산 id 를 카테고리별로 묶어 정렬된 entries 반환 (출력 hierarchy 용). */
function groupAssetsByCategory(assetIds: ReadonlyArray<string>): Array<[string, string[]]> {
  const map = new Map<string, string[]>();
  for (const id of assetIds) {
    const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
    const cat = asset?.category ?? "other";
    const list = map.get(cat) ?? [];
    list.push(id);
    map.set(cat, list);
  }
  return [...map.entries()];
}

function formatOptions(spec: InstallSpec): string {
  const flags: string[] = [];
  if (spec.options.withTauri) flags.push("tauri");
  if (spec.options.withGsd) flags.push("gsd");
  if (spec.options.withEcc) flags.push("ecc");
  if (spec.options.withPrune) flags.push("prune");
  if (spec.options.withTob) flags.push("tob");
  if (spec.options.withKarpathyHook) flags.push("karpathy-hook");
  if (spec.options.withAddyAgentSkills) flags.push("addy-agent-skills");
  if (spec.options.withUzysHarness) flags.push("uzys-harness");
  if (spec.options.withSuperpowers) flags.push("superpowers");
  // v26.63.3 (clarify H1): "(defaults only)" 모호 → "(none added)" 명료.
  return flags.length > 0 ? flags.join(", ") : c.dim("(none added)");
}

/**
 * Shorten an absolute path for display:
 *   /Users/foo/bar     → ~/bar (HOME relative)
 *   /private/tmp/x.X   → /tmp/x.X
 *   /a/very/long/path  → …/long/path (≥3 segs from end if > 50 chars)
 */
/** v26.48.0 — export for direct unit test (branch coverage 복구). */
export function shortenPath(p: string): string {
  if (p.length <= 50) return p;
  const home = process.env.HOME ?? "";
  if (home && p.startsWith(home)) {
    const rel = p.slice(home.length);
    return `~${rel.startsWith("/") ? "" : "/"}${rel}`;
  }
  // private/tmp prefix on macOS — drop /private
  if (p.startsWith("/private/tmp/")) {
    return p.slice("/private".length);
  }
  // Last 3 segments
  const segs = p.split("/").filter(Boolean);
  if (segs.length > 3) {
    return `…/${segs.slice(-3).join("/")}`;
  }
  return p;
}

/**
 * v0.7.0 — CliTargets에서 codex/opencode 포함 여부에 따라 title 결정.
 * Phase 3는 codex 또는 opencode 1개 이상 포함 시 호출됨.
 * v26.48.0 — export for direct unit test (branch coverage 복구).
 */
export function formatCliPhaseTitle(targets: CliTargets): string {
  const hasCodex = targets.includes("codex");
  const hasOpenCode = targets.includes("opencode");
  if (hasCodex && hasOpenCode) return "Codex + OpenCode artifacts";
  if (hasCodex) return "Codex artifacts";
  if (hasOpenCode) return "OpenCode artifacts";
  return "CLI artifacts";
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
    .option("--cli <target>", "[CLI] Target CLI (repeatable): claude | codex | opencode", {
      type: [String],
      default: "claude",
    })
    .option("--project-dir <path>", "[Project] Target project directory", {
      default: process.cwd(),
    })
    .option(
      "--scope <scope>",
      "[Scope] Installation scope: project (default) | global. ADR-020 / NORTH_STAR D16",
      { default: "project" },
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
    // === Codex global (v26.46.0+) ===
    .option(
      "--with-codex-prompts",
      "[Codex] Unify Codex slash (~/.codex/prompts/uzys-*.md). v26.46.0+ default ON when --cli codex",
    )
    .option(
      "--no-codex-prompts",
      "[Codex] Disable Codex slash default ON (skip global copy even with --cli codex)",
    )
    .option(
      "--with-codex-skills",
      "[Codex] Codex global opt-in: copy uzys-* skills to ~/.codex/skills/",
    )
    .option(
      "--with-codex-trust",
      "[Codex] Codex global opt-in: register trust entry in ~/.codex/config.toml",
    )
    // === Workflow opt-in (v26.42.0+) ===
    .option(
      "--with-uzys-harness",
      "[Workflow] uzys-harness 6-Gate slash (/uzys:spec ... /uzys:ship). v26.44.0 BREAKING",
    )
    .option(
      "--with-addy-agent-skills",
      "[Workflow] addyosmani/agent-skills (/spec /plan /build slash). v26.42.0 BREAKING",
    )
    .option(
      "--with-superpowers",
      "[Workflow] obra/superpowers (registered in Anthropic official marketplace)",
    )
    .option(
      "--with-antigravity-global",
      "[Workflow] Antigravity global opt-in: copy uzys-* to ~/.gemini/antigravity/{skills,global_workflows}/. Requires --cli antigravity + --scope global. (v26.67.0+)",
    )
    .option("--with-gsd", "[Workflow] GSD orchestrator (for large projects)")
    // === ECC Suite ===
    .option("--with-ecc", "[ECC] ECC plugin (project-scoped)")
    .option("--with-prune", "[ECC] Prune ECC items beyond curated 89 (implies --with-ecc)")
    // === Dev Tools ===
    .option("--with-tob", "[Dev Tools] Trail of Bits differential security review")
    .option(
      "--with-karpathy-hook",
      "[Dev Tools] karpathy-coder pre-commit hook (.claude/settings.json PreToolUse Write|Edit)",
    )
    // === Misc ===
    .option("--with-tauri", "[Misc] Tauri desktop rule (csr-*/full)")
    .option("--verbose", "[Misc] Show installed file lists per category (default: counts only)")
    // === Examples (v26.50.0+) ===
    .example("install --track tooling --with-uzys-harness")
    .example("install --track csr-supabase --cli claude --cli codex")
    .example("install --track csr-supabase --without netlify-cli --with railway-skills")
    .example("install --track full --no-codex-prompts")
    /* v8 ignore next — cac action callback. installAction 자체는 별도 tests 로 검증. */
    .action((options: InstallOptions) => installAction(options));
}

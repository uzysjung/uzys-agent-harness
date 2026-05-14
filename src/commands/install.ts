import { resolve } from "node:path";
import type { Cli } from "../cli.js";
import { parseCliTargets, targetsInclude } from "../cli-targets.js";
import { assetRow, c, infoRow, phaseHeader, sectionHeader, status } from "../design.js";
import { type InstallReport, runInstall as runInstallPipeline } from "../installer.js";
import { type CliTargets, type InstallSpec, isTrack, type Track } from "../types.js";

export interface InstallOptions {
  track?: string[];
  /** v0.7.0 — repeatable. cac type: [String]. v0.8.0 — legacy alias 'both'/'all' 제거됨. */
  cli?: string | string[];
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
  /** v26.46.0 — Codex slash 통일 opt-out (cli=codex 일 때 default ON 해제). */
  noCodexPrompts?: boolean;
  /** v26.42.0 — addyosmani/agent-skills opt-in (BREAKING vs prior auto-install). */
  withAddyAgentSkills?: boolean;
  /** v26.44.0 — uzys-harness 6-Gate slash commands opt-in (BREAKING vs prior auto-install). */
  withUzysHarness?: boolean;
  /** v26.44.0 — obra/superpowers opt-in. Anthropic 공식 marketplace 등록. */
  withSuperpowers?: boolean;
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
      message: "At least one --track is required (e.g. --track tooling)",
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
  if (validated.ok && options.noCodexPrompts === true && !validated.cli.includes("codex")) {
    err(
      c.yellow("[WARN] --no-codex-prompts has no effect without --cli codex (already excluded)."),
    );
  }
  if (!validated.ok) {
    err(status.failure(c.red(`ERROR: ${validated.message}`)));
    exit(1);
    return;
  }

  const spec: InstallSpec = {
    tracks: (options.track as Track[]) ?? [],
    options: {
      withTauri: options.withTauri === true,
      withGsd: options.withGsd === true,
      withEcc: options.withEcc === true || options.withPrune === true,
      withPrune: options.withPrune === true,
      withTob: options.withTob === true,
      withCodexSkills: options.withCodexSkills === true,
      withCodexTrust: options.withCodexTrust === true,
      withKarpathyHook: options.withKarpathyHook === true,
      // v26.46.0 — cli=codex 시 default ON (ADR-012). --no-codex-prompts 또는 --with-codex-prompts=false 명시 시 OFF.
      withCodexPrompts:
        options.noCodexPrompts === true
          ? false
          : options.withCodexPrompts === true || validated.cli.includes("codex"),
      withAddyAgentSkills: options.withAddyAgentSkills === true,
      withUzysHarness: options.withUzysHarness === true,
      withSuperpowers: options.withSuperpowers === true,
    },
    cli: validated.cli,
    projectDir: resolve(options.projectDir ?? process.cwd()),
  };

  executeSpec(spec, { log, err, exit, runPipeline, resolveHarnessRoot });
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

  // ━━━ TARGET ━━━ pre-flight info block ━━━
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
  log(infoRow("OPTIONS", formatOptions(spec)));
  log("");

  // ━━━ Phase 1 — Templates (또는 Update Mode) ━━━
  log(phaseHeader(1, deps.mode === "update" ? "Update Mode" : "Templates"));
  log("");

  // Streaming progress: baseline 완료 시 즉시 Phase 1 rows 출력, external은 per-asset 스트리밍.
  let phase2HeaderPrinted = false;
  const callbacks: PipelineCallbacks = {
    onProgress: (event) => {
      if (event.type === "baseline-complete") {
        renderPhase1Rows(log, event.baseline);
      } else if (event.type === "external-start" && event.assetCount > 0) {
        log(phaseHeader(2, "External Assets"));
        log("");
        phase2HeaderPrinted = true;
      }
    },
    externalDeps: {
      onAssetStart: (asset) => {
        log(`  ${c.dim("→")} ${c.dim(asset.description)} ${c.dim("...")}`);
      },
      onAssetResult: (result) => {
        const meta = result.ok ? formatAssetMeta(result.asset) : (result.message ?? "failed");
        log(assetRow(result.ok ? "success" : "skip", result.asset.id, meta));
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
    log(sectionHeader("Summary"));
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

  // ━━━ Phase 3 — Codex / OpenCode (CLI-specific) ━━━
  // Phase 3 = Codex 또는 OpenCode 산출물이 있을 때만 출력 (claude 단독 install은 skip)
  if (
    (report.codex || report.opencode) &&
    (targetsInclude(spec.cli, "codex") || targetsInclude(spec.cli, "opencode"))
  ) {
    const phaseN = report.external && report.external.attempted.length > 0 ? 3 : 2;
    log(phaseHeader(phaseN, formatCliPhaseTitle(spec.cli)));
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

  // ━━━ Summary ━━━
  log(sectionHeader("Summary"));
  log("");
  log(infoRow("STATUS", c.green("Install complete")));
  log(infoRow("TRACKS", report.installedTracks.join(", ")));
  if (report.codex && report.opencode) {
    log(infoRow("CLIs", "Claude · Codex · OpenCode"));
  } else if (report.codex) {
    log(infoRow("CLIs", "Claude · Codex"));
  } else if (report.opencode) {
    log(infoRow("CLIs", "Claude · OpenCode"));
  } else {
    log(infoRow("CLIs", "Claude"));
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

function formatAssetMeta(asset: import("../external-assets.js").ExternalAsset): string {
  // v0.6.1 — kind + method + description 보강. install 시 무엇이 들어왔는지 명시적.
  const m = asset.method;
  let methodPart: string;
  switch (m.kind) {
    case "skill":
      methodPart = m.skill ? `skill · ${m.source} · ${m.skill}` : `skill · ${m.source}`;
      break;
    case "plugin":
      methodPart = `plugin · ${m.pluginId}`;
      break;
    case "npm-global":
      methodPart = `npm -g · ${m.pkg}`;
      break;
    case "npx-run":
      methodPart = `npx · ${m.cmd}`;
      break;
    case "shell-script":
      methodPart = `bash · ${m.script}`;
      break;
  }
  // description은 asset.description (예: "karpathy-coder (4 Python tool + reviewer + ...)")
  // ID와 중복 prefix 제거
  const desc = asset.description.replace(new RegExp(`^${asset.id}\\s*[—\\-]?\\s*`), "").trim();
  const descPart = desc && desc !== asset.id ? ` — ${desc}` : "";
  return `${methodPart}${descPart}`;
}

/**
 * Phase 1 rows 출력. baseline-complete progress event에서 호출 — 외부 자산 설치
 * 시작 전 즉시 화면에 표시되어야 한다 (멈춰 보임 방지).
 */
function renderPhase1Rows(
  log: (msg: string) => void,
  baseline: import("../installer.js").BaselineReport,
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

  // Fresh / add / reinstall — Phase 1 rows (v0.6.1: 카테고리별 분리 + names 일부 표시)
  const cats = baseline.categories;
  if (cats) {
    if (cats.rules.length > 0) {
      log(assetRow("success", "rules", formatNamesWithCount(cats.rules)));
    }
    if (cats.agents.length > 0) {
      log(assetRow("success", "agents", formatNamesWithCount(cats.agents)));
    }
    if (cats.hooks.length > 0) {
      log(assetRow("success", "hooks", formatNamesWithCount(cats.hooks)));
    }
    if (cats.commands > 0) {
      log(assetRow("success", "commands", `${cats.commands} entries (uzys + ecc)`));
    }
    if (cats.skills.length > 0) {
      log(assetRow("success", "skills", formatNamesWithCount(cats.skills)));
    }
  } else {
    // v0.6.0 backwards compat — categories 없는 fakeReport 등
    log(assetRow("success", "rules + hooks + commands + agents", `${baseline.filesCopied} files`));
    log(assetRow("success", "skeleton", `${baseline.dirsCopied} dirs`));
  }
  if (baseline.rootClaudeMd) {
    const n = baseline.rootClaudeMd.tracks.length;
    log(assetRow("success", "CLAUDE.md (root)", `merged from ${n} track${n > 1 ? "s" : ""}`));
  }
  if (baseline.skipped > 0) {
    log(assetRow("skip", "manifest entries (applies → false)", `${baseline.skipped} skipped`));
  }
  if (baseline.backup) {
    log(assetRow("success", "backup", shortenPath(baseline.backup)));
  }
  const mcpList = baseline.mcpServers.join(", ") || "(none)";
  log(assetRow("success", ".mcp.json", mcpList));
  if (baseline.envFiles.mcpAllowlist) {
    log(
      assetRow(
        "success",
        ".mcp-allowlist",
        `${baseline.envFiles.mcpAllowlist.length} servers (D35 opt-in gate)`,
      ),
    );
  }
  if (baseline.envFiles.envExampleCreated) {
    log(assetRow("success", ".env.example", "Supabase 토큰 가이드"));
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
 * Names 배열을 "name1, name2, ... (N)" 형식으로 표시. 전체 names 노출 (압축 없음).
 * 사용자 피드백 v0.6.2 — Phase 1 names 풀어서 다 보이게.
 */
function formatNamesWithCount(names: ReadonlyArray<string>): string {
  if (names.length === 0) return "0";
  return `${names.join(", ")} (${names.length})`;
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
  return flags.length > 0 ? flags.join(", ") : c.dim("(defaults only)");
}

/**
 * Shorten an absolute path for display:
 *   /Users/foo/bar     → ~/bar (HOME relative)
 *   /private/tmp/x.X   → /tmp/x.X
 *   /a/very/long/path  → …/long/path (≥3 segs from end if > 50 chars)
 */
function shortenPath(p: string): string {
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
 */
function formatCliPhaseTitle(targets: CliTargets): string {
  const hasCodex = targets.includes("codex");
  const hasOpenCode = targets.includes("opencode");
  if (hasCodex && hasOpenCode) return "Codex + OpenCode artifacts";
  if (hasCodex) return "Codex artifacts";
  if (hasOpenCode) return "OpenCode artifacts";
  return "CLI artifacts";
}

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

export { defaultHarnessRoot };

export function registerInstallCommand(cli: Cli): void {
  cli
    .command("install", "Install harness assets into a project")
    .option("--track <name>", "Track to install (repeatable)", { type: [String] })
    .option(
      "--cli <target>",
      "Target CLI (repeatable): claude | codex | opencode. Multiple --cli flags combine (e.g. --cli claude --cli codex).",
      { type: [String], default: "claude" },
    )
    .option("--project-dir <path>", "Target project directory", { default: process.cwd() })
    .option("--with-tauri", "Include tauri.md rule")
    .option("--with-gsd", "Include GSD orchestrator")
    .option("--with-ecc", "Install ECC plugin (project-scoped)")
    .option("--with-prune", "Prune ECC items beyond curated 89 (implies --with-ecc)")
    .option("--with-tob", "Install Trail of Bits security plugin")
    .option(
      "--with-codex-skills",
      "Codex global opt-in: copy uzys-* skills to ~/.codex/skills/ (requires --cli codex)",
    )
    .option(
      "--with-codex-trust",
      'Codex global opt-in: register [projects."..."] trust entry in ~/.codex/config.toml',
    )
    .option(
      "--with-karpathy-hook",
      "karpathy-coder pre-commit hook auto-wire (.claude/settings.json PreToolUse Write|Edit). karpathy-coder plugin install 성공 시에만 활성화. opt-in.",
    )
    .option(
      "--with-codex-prompts",
      "Codex slash 통일 (~/.codex/prompts/uzys-*.md 글로벌 복사). v26.46.0 부터 --cli codex 시 default ON. 본 flag는 cli=claude 단독에서도 강제 시 사용 (보통 불필요).",
    )
    .option(
      "--no-codex-prompts",
      "v26.46.0 — Codex slash default ON 해제. --cli codex 명시 시에도 ~/.codex/prompts/uzys-*.md 글로벌 복사 안 함.",
    )
    .option(
      "--with-addy-agent-skills",
      "addyosmani/agent-skills marketplace plugin install. v26.42.0 — opt-in (이전엔 dev 트랙 자동 설치). /spec /plan /build slash commands (no namespace).",
    )
    .option(
      "--with-uzys-harness",
      "uzys-harness 6-Gate slash commands (/uzys:spec ... /uzys:ship) opt-in. v26.44.0 BREAKING — 이전엔 dev 트랙 자동 설치. 기존 동작 복원: install <같은 옵션> --with-uzys-harness",
    )
    .option(
      "--with-superpowers",
      "obra/superpowers (190k★, Anthropic 공식 marketplace 등록) plugin install. /spec /plan /build slash (no namespace).",
    )
    .action((options: InstallOptions) => installAction(options));
}

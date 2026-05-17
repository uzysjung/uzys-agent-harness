import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { type CodexOptInReport, runCodexOptIn } from "./codex/opt-in.js";
import { type CodexTransformReport, runCodexTransform } from "./codex/transform.js";
import {
  addGitignoreEnv,
  addGitignoreNpxSkillsAgents,
  writeEnvExample,
  writeMcpAllowlist,
} from "./env-files.js";
import { EXTERNAL_ASSETS, filterApplicableAssets } from "./external-assets.js";
import {
  type ExternalInstallerDeps,
  type ExternalInstallReport,
  runExternalInstall,
} from "./external-installer.js";
import { backupDir, copyBackupDir, copyDir, copyFile, ensureProjectSkeleton } from "./fs-ops.js";
import { buildManifest } from "./manifest.js";
import { composeMcpJson, writeMcpJson } from "./mcp-merge.js";
import { type OpencodeTransformReport, runOpencodeTransform } from "./opencode/transform.js";
import { mergeProjectClaude } from "./project-claude-merge.js";
import { addPreToolUseHook, type ClaudeSettings } from "./settings-merge.js";
import type { InstallSpec, OptionFlags, Track } from "./types.js";
import { runUpdateMode, type UpdateModeReport } from "./update-mode.js";

/** karpathy-coder hook command — `.claude/settings.json` PreToolUse Write|Edit matcher entry. */
const KARPATHY_HOOK_COMMAND = 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/karpathy-gate.sh"';

/**
 * Install mode — Router action 매핑.
 *   - "fresh"     : 첫 설치 (기본값)
 *   - "add"       : 기존 위에 Track union 추가 (backup 없음)
 *   - "update"    : 정책 파일만 templates로 갱신 (backup + orphan prune + stale hook)
 *   - "reinstall" : 기존 .claude/ backup 후 처음부터 (backup 강제)
 */
export type InstallMode = "fresh" | "add" | "update" | "reinstall";

export interface InstallContext {
  /** Path to the harness repo (where `templates/` lives). */
  harnessRoot: string;
  /** Target project directory. */
  projectDir: string;
  spec: InstallSpec;
  /**
   * Router action mode. Defaults to "fresh".
   * - "add"/"update"/"reinstall" trigger different install paths.
   * - reinstall + update force backup=true.
   */
  mode?: InstallMode;
  /**
   * When true, an existing .claude/ is renamed to a timestamped backup before install.
   * Auto-true when mode ∈ {update, reinstall}.
   */
  backup?: boolean;
  /**
   * External install (claude plugin / npm -g / npx skills) injection point.
   * Default: real `runExternalInstall`. Tests inject mock to avoid real spawn.
   * Pass `null` to disable external install entirely.
   */
  runExternal?:
    | ((
        ctx: { tracks: ReadonlyArray<Track>; options: OptionFlags },
        deps: ExternalInstallerDeps,
      ) => ExternalInstallReport)
    | null;
  /**
   * Progress callback fired between stages so renderers can stream output
   * (avoids "Phase 1 header → 5 minutes silence" UX problem).
   */
  onProgress?: (event: ProgressEvent) => void;
  /** External installer streaming hooks (forwarded to runExternalInstall). */
  externalDeps?: Pick<ExternalInstallerDeps, "onAssetStart" | "onAssetResult">;
}

/** Progress event types fired during runInstall. */
export type ProgressEvent =
  /** Baseline (manifest copy + mcp + envFiles + Codex/OpenCode transforms) finished. External not yet started. */
  | { type: "baseline-complete"; baseline: BaselineReport }
  /** External install phase about to begin. */
  | { type: "external-start"; assetCount: number }
  /** External install phase finished (with report). */
  | { type: "external-complete"; report: ExternalInstallReport };

/** karpathy-coder hook auto-wire 결과 (v0.6.0). */
export interface KarpathyHookReport {
  /** withKarpathyHook=true && karpathy-coder install 성공 시 true. */
  wired: boolean;
  /** wired=false 시 사유. */
  reason?:
    | "opt-out"
    | "plugin-install-failed"
    | "external-skipped"
    | "settings-parse-error"
    | "claude-not-selected";
  /** wired=true 시 settings.json 갱신 여부 (idempotent skip 시 false). */
  settingsUpdated?: boolean;
  /** wired=true 시 hook script 복사 여부. */
  hookScriptCopied?: boolean;
}

/** karpathy-coder asset ID — SSOT (external-assets.ts entry id와 일치 강제). */
const KARPATHY_ASSET_ID = "karpathy-coder";

/**
 * v0.6.1 — Phase 1 output 카테고리별 분류. install renderer가 각 카테고리별로 row를 출력한다.
 * Names는 description용 (display only); 빈 배열이면 row 출력 skip.
 */
export interface BaselineCategoryCounts {
  /** rule 파일 names (확장자 제외) — git-policy, change-management 등 */
  rules: string[];
  /** agent 파일 names */
  agents: string[];
  /** hook 파일 names (확장자 제외) */
  hooks: string[];
  /** commands 디렉토리 카운트 (uzys + ecc) — names는 디렉토리라 무의미 */
  commands: number;
  /** skill 디렉토리 names */
  skills: string[];
}

/** Baseline phase result (everything except external assets). */
export interface BaselineReport {
  filesCopied: number;
  dirsCopied: number;
  skipped: number;
  backup: string | null;
  installedTracks: string[];
  mcpServers: string[];
  codex: CodexTransformReport | null;
  codexOptIn: CodexOptInReport | null;
  opencode: OpencodeTransformReport | null;
  updateMode: UpdateModeReport | null;
  mode: InstallMode;
  envFiles: {
    envExampleCreated: boolean;
    gitignoreEnvAdded: boolean;
    mcpAllowlist: string[] | null;
    /** v0.8.0 — `.gitignore`에 추가된 npx skills agent 디렉토리 패턴 (`.factory/`, `.goose/`). */
    gitignoreNpxSkillsAdded: string[];
  };
  /** v0.6.1 — Phase 1 카테고리별 카운트 + names. Update mode에서는 빈 객체. */
  categories?: BaselineCategoryCounts;
  /** Root CLAUDE.md merged from project-claude fragments. null when claude baseline disabled. */
  rootClaudeMd: { tracks: ReadonlyArray<Track> } | null;
}

export interface InstallReport {
  filesCopied: number;
  dirsCopied: number;
  skipped: number;
  backup: string | null;
  installedTracks: string[];
  mcpServers: string[];
  /** Present when spec.cli includes "codex". */
  codex: CodexTransformReport | null;
  /** Present when Codex transform ran AND user opted-in to global skills/trust/prompts. null otherwise. */
  codexOptIn: CodexOptInReport | null;
  /** Present when spec.cli includes "opencode". */
  opencode: OpencodeTransformReport | null;
  /** External install report (claude plugin / npm -g / npx skills). null when disabled or empty. */
  external: ExternalInstallReport | null;
  /** Update-mode report (rules/agents/commands/hooks 갱신 + orphan prune + stale hook). null when not update mode. */
  updateMode: UpdateModeReport | null;
  /** karpathy-coder hook auto-wire 결과 (v0.6.0). null when withKarpathyHook=false. */
  karpathyHook: KarpathyHookReport | null;
  /** Install mode dispatched (echo of ctx.mode, default "fresh"). */
  mode: InstallMode;
  /** Environment file generation results (always present). */
  envFiles: {
    /** true if .env.example was created (csr-supabase/full only). */
    envExampleCreated: boolean;
    /** true if .gitignore got `.env` line appended. */
    gitignoreEnvAdded: boolean;
    /** Server names written to .mcp-allowlist; null if skipped. */
    mcpAllowlist: string[] | null;
    /** v0.8.0 — `.gitignore`에 추가된 npx skills agent 디렉토리 패턴 (`.factory/`, `.goose/`). */
    gitignoreNpxSkillsAdded: string[];
  };
}

/**
 * Run the installation pipeline. Pure function modulo filesystem side effects.
 */
export function runInstall(ctx: InstallContext): InstallReport {
  const { harnessRoot, projectDir, spec } = ctx;
  const mode: InstallMode = ctx.mode ?? "fresh";
  const templatesDir = join(harnessRoot, "templates");

  if (!existsSync(templatesDir)) {
    throw new Error(`Templates dir not found: ${templatesDir}`);
  }

  const claudeDir = join(projectDir, ".claude");

  // Update mode pre-flight: existing .claude/ 필수. backup 전에 검증.
  if (mode === "update" && !existsSync(claudeDir)) {
    throw new Error(`Update mode requires existing .claude/ at ${claudeDir}`);
  }

  // Backup auto-on for update + reinstall (sourced from router action).
  // Update: copy backup (preserve original .claude/ for in-place update).
  // Reinstall + others: rename backup (move .claude/ aside, then full install).
  const wantBackup = ctx.backup ?? (mode === "update" || mode === "reinstall");
  const backupPath = wantBackup
    ? mode === "update"
      ? copyBackupDir(claudeDir)
      : backupDir(claudeDir)
    : null;

  // Update mode 단축 — 정책 파일만 갱신하고 종료 (manifest copy / external 모두 skip)
  if (mode === "update") {
    const updateReport = runUpdateMode(projectDir, templatesDir);
    const baseline: BaselineReport = {
      filesCopied: 0,
      dirsCopied: 0,
      skipped: 0,
      backup: backupPath,
      installedTracks: [...spec.tracks].sort(),
      mcpServers: [],
      codex: null,
      codexOptIn: null,
      opencode: null,
      updateMode: updateReport,
      mode,
      envFiles: {
        envExampleCreated: false,
        gitignoreEnvAdded: false,
        mcpAllowlist: null,
        gitignoreNpxSkillsAdded: [],
      },
      rootClaudeMd: null,
    };
    ctx.onProgress?.({ type: "baseline-complete", baseline });
    return { ...baseline, external: null, karpathyHook: null };
  }

  // v0.8.0 — `.claude/` baseline은 spec.cli에 "claude" 포함 시에만 생성.
  // Codex/OpenCode 단독 사용자는 dead weight 회피.
  const claudeBaselineEnabled = spec.cli.includes("claude");

  let filesCopied = 0;
  let dirsCopied = 0;
  let skipped = 0;
  let rootClaudeMd: { tracks: ReadonlyArray<Track> } | null = null;
  const categories: BaselineCategoryCounts = {
    rules: [],
    agents: [],
    hooks: [],
    commands: 0,
    skills: [],
  };

  if (claudeBaselineEnabled) {
    ensureProjectSkeleton(projectDir);

    const manifestSpec = {
      tracks: spec.tracks,
      withTauri: spec.options.withTauri,
      withUzysHarness: spec.options.withUzysHarness,
      // v26.55.0 — withEcc gating (ADR-016). ECC cherry-pick (agents/skills/commands) 항목 토글.
      withEcc: spec.options.withEcc,
    };
    const manifest = buildManifest(manifestSpec);

    for (const entry of manifest) {
      if (!entry.applies(manifestSpec)) {
        continue;
      }
      const source = join(templatesDir, entry.source);
      const target = join(projectDir, entry.target);
      if (!existsSync(source)) {
        skipped += 1;
        continue;
      }
      if (entry.type === "file") {
        copyFile(source, target);
        filesCopied += 1;
      } else {
        copyDir(source, target);
        dirsCopied += 1;
      }
      accumulateCategory(categories, entry);
    }

    // chmod +x on hook scripts (cp does not preserve exec bit when source is non-exec)
    const hookDir = join(projectDir, ".claude/hooks");
    if (existsSync(hookDir)) {
      chmodHooksSync(hookDir);
    }

    // Write metadata file used by detect_install_state on next run (.claude/.installed-tracks)
    writeInstalledTracks(projectDir, spec.tracks);

    // Project root CLAUDE.md — merge from fragments (single/multi/full).
    // Note: overwrites any user customization on re-install. Documented behavior.
    writeRootClaudeMd(harnessRoot, projectDir, spec.tracks);
    rootClaudeMd = { tracks: spec.tracks };
  }

  // Compose .mcp.json from template + track-mcp-map.tsv (Codex/OpenCode도 사용 — claude 무관)
  const mcpResult = composeAndWriteMcp(harnessRoot, projectDir, spec);

  // Environment files (F7/F8 — bash setup-harness.sh L880~890 + L954~996 등가)
  const envFiles = {
    envExampleCreated: writeEnvExample(projectDir, spec.tracks),
    gitignoreEnvAdded: addGitignoreEnv(projectDir),
    mcpAllowlist: writeMcpAllowlist(projectDir),
    // v0.8.0 — `.factory/`, `.goose/` ignore (npx skills universal install 사용자 #3)
    gitignoreNpxSkillsAdded: addGitignoreNpxSkillsAgents(projectDir),
  };

  // Codex transform when spec.cli includes "codex"
  let codex: CodexTransformReport | null = null;
  let codexOptIn: CodexOptInReport | null = null;
  if (spec.cli.includes("codex")) {
    // v26.57.0 (ADR-018) — withUzysHarness gating 을 codex transform 에도 전달.
    // .agents/skills/uzys-* + .codex/prompts/uzys-* 도 uzys-harness 없으면 생성 안 함.
    codex = runCodexTransform({
      harnessRoot,
      projectDir,
      withUzysHarness: spec.options.withUzysHarness,
    });
    // Codex global opt-in (D16): only when user explicitly enabled at least one flag
    if (
      spec.options.withCodexSkills ||
      spec.options.withCodexTrust ||
      spec.options.withCodexPrompts
    ) {
      codexOptIn = runCodexOptIn({
        projectDir,
        harnessRoot,
        withCodexSkills: spec.options.withCodexSkills,
        withCodexTrust: spec.options.withCodexTrust,
        withCodexPrompts: spec.options.withCodexPrompts,
      });
    }
  }

  // OpenCode transform when spec.cli includes "opencode"
  let opencode: OpencodeTransformReport | null = null;
  if (spec.cli.includes("opencode")) {
    opencode = runOpencodeTransform({ harnessRoot, projectDir });
  }

  const baseline: BaselineReport = {
    filesCopied,
    dirsCopied,
    skipped,
    backup: backupPath,
    installedTracks: [...spec.tracks].sort(),
    mcpServers: Object.keys(mcpResult.mcpServers).sort(),
    codex,
    codexOptIn,
    opencode,
    updateMode: null,
    mode,
    envFiles,
    categories,
    rootClaudeMd,
  };

  // ━━━ Baseline complete — emit progress event so renderer can show Phase 1 rows ━━━
  ctx.onProgress?.({ type: "baseline-complete", baseline });

  // ━━━ External assets (claude plugin / npm -g / npx skills) ━━━
  // Default = real runExternalInstall. Tests inject mock or `null` to skip.
  // log/warn은 silent (renderer가 onAssetStart/Result로 스트리밍).
  let external: ExternalInstallReport | null = null;
  if (ctx.runExternal !== null) {
    const runExt = ctx.runExternal ?? runExternalInstall;
    const externalDeps: ExternalInstallerDeps = {
      harnessRoot,
      log: () => {},
      warn: () => {},
    };
    if (ctx.externalDeps?.onAssetStart) {
      externalDeps.onAssetStart = ctx.externalDeps.onAssetStart;
    }
    if (ctx.externalDeps?.onAssetResult) {
      externalDeps.onAssetResult = ctx.externalDeps.onAssetResult;
    }
    const filterCtx = {
      tracks: spec.tracks,
      options: spec.options,
      ...(spec.userOverride ? { userOverride: spec.userOverride } : {}),
    };
    const applicableCount = filterApplicableAssets(EXTERNAL_ASSETS, filterCtx).length;
    ctx.onProgress?.({ type: "external-start", assetCount: applicableCount });
    external = runExt({ ...filterCtx, cli: spec.cli }, externalDeps);
    ctx.onProgress?.({ type: "external-complete", report: external });
  }

  // ━━━ karpathy-coder hook auto-wire (v0.6.0) ━━━
  // SPEC: docs/specs/karpathy-hook-autowire.md AC2 — opt-in 강제 + install 성공 후에만.
  // v0.8.0 — `.claude/settings.json` PreToolUse 의존이라 spec.cli에 "claude" 포함 시에만 와이어 가능.
  const karpathyHook = wireKarpathyHook(spec, external, harnessRoot, projectDir);

  return { ...baseline, external, karpathyHook };
}

/**
 * karpathy-coder pre-commit hook auto-wire (v0.6.0).
 *
 * 활성화 조건 (AND):
 *   1. spec.options.withKarpathyHook === true (opt-in 강제)
 *   2. spec.cli 에 "claude" 포함 (v0.8.0 — `.claude/settings.json` 미생성 시 와이어 불가)
 *   3. external.attempted에 karpathy-coder ok=true (plugin install 성공)
 *
 * 동작:
 *   - templates/hooks/karpathy-gate.sh → <projectDir>/.claude/hooks/karpathy-gate.sh 복사
 *   - .claude/settings.json PreToolUse Write|Edit matcher에 hook entry 추가 (idempotent)
 */
function wireKarpathyHook(
  spec: InstallSpec,
  external: ExternalInstallReport | null,
  harnessRoot: string,
  projectDir: string,
): KarpathyHookReport | null {
  if (!spec.options.withKarpathyHook) {
    return null;
  }
  // v0.8.0 가드 — `.claude/` baseline 미생성 시 hook 와이어 불가 (silent partial state 방지).
  if (!spec.cli.includes("claude")) {
    return { wired: false, reason: "claude-not-selected" };
  }
  if (external === null) {
    return { wired: false, reason: "external-skipped" };
  }
  const karpathyResult = external.attempted.find((r) => r.asset.id === KARPATHY_ASSET_ID);
  if (!karpathyResult?.ok) {
    return { wired: false, reason: "plugin-install-failed" };
  }

  // Hook script 복사 (manifest에 없는 v0.6.0 신규 — opt-in 시에만)
  const sourceHook = join(harnessRoot, "templates/hooks/karpathy-gate.sh");
  const targetHook = join(projectDir, ".claude/hooks/karpathy-gate.sh");
  let hookScriptCopied = false;
  if (existsSync(sourceHook)) {
    copyFile(sourceHook, targetHook);
    try {
      chmodSync(targetHook, 0o755);
    } catch {
      // best-effort
    }
    hookScriptCopied = true;
  }

  // settings.json PreToolUse Write|Edit entry 추가 (idempotent)
  // HIGH-2 fix: JSON.parse try/catch — add mode에서 사용자 손상 settings.json 시 install 중단 방지
  const settingsPath = join(projectDir, ".claude/settings.json");
  let settingsUpdated = false;
  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, "utf8");
    let before: ClaudeSettings;
    try {
      before = JSON.parse(raw);
    } catch {
      return { wired: false, reason: "settings-parse-error", hookScriptCopied };
    }
    const after = addPreToolUseHook(before, "Write|Edit", KARPATHY_HOOK_COMMAND);
    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);
    if (beforeStr !== afterStr) {
      writeFileSync(settingsPath, `${JSON.stringify(after, null, 2)}\n`);
      settingsUpdated = true;
    }
  }

  return { wired: true, settingsUpdated, hookScriptCopied };
}

function composeAndWriteMcp(
  harnessRoot: string,
  projectDir: string,
  spec: InstallSpec,
): { mcpServers: Record<string, unknown> } {
  const mcpPath = join(projectDir, ".mcp.json");
  const composed = composeMcpJson({
    templateMcpPath: join(harnessRoot, "templates/mcp.json"),
    trackMapPath: join(harnessRoot, "templates/track-mcp-map.tsv"),
    existingPath: mcpPath,
    tracks: spec.tracks,
  });
  writeMcpJson(mcpPath, composed);
  return composed;
}

/**
 * v0.6.1 — manifest entry를 카테고리별로 누적. install renderer Phase 1 row 출력에 사용.
 * `entry.target` prefix로 분류. file은 basename(.확장자 제거), dir은 dir name.
 */
function accumulateCategory(
  cats: BaselineCategoryCounts,
  entry: import("./manifest.js").AssetEntry,
): void {
  const target = entry.target;
  if (target.startsWith(".claude/rules/") && target.endsWith(".md")) {
    const name = target.replace(/^\.claude\/rules\//, "").replace(/\.md$/, "");
    cats.rules.push(name);
  } else if (target.startsWith(".claude/agents/") && target.endsWith(".md")) {
    const name = target.replace(/^\.claude\/agents\//, "").replace(/\.md$/, "");
    cats.agents.push(name);
  } else if (target.startsWith(".claude/hooks/") && target.endsWith(".sh")) {
    const name = target.replace(/^\.claude\/hooks\//, "").replace(/\.sh$/, "");
    cats.hooks.push(name);
  } else if (target.startsWith(".claude/commands/")) {
    cats.commands += 1;
  } else if (target.startsWith(".claude/skills/") && entry.type === "dir") {
    const name = target.replace(/^\.claude\/skills\//, "").replace(/\/?$/, "");
    cats.skills.push(name);
  }
}

function writeInstalledTracks(projectDir: string, tracks: ReadonlyArray<string>): void {
  const path = join(projectDir, ".claude/.installed-tracks");
  mkdirSync(dirname(path), { recursive: true });
  const sorted = [...new Set(tracks)].sort().join("\n");
  writeFileSync(path, `${sorted}\n`);
}

function writeRootClaudeMd(
  harnessRoot: string,
  projectDir: string,
  tracks: ReadonlyArray<Track>,
): void {
  const baseDir = join(harnessRoot, "templates/project-claude");
  const content = mergeProjectClaude(tracks, { baseDir });
  writeFileSync(join(projectDir, "CLAUDE.md"), content);
}

function chmodHooksSync(hookDir: string): void {
  for (const file of listHookFiles(hookDir)) {
    try {
      chmodSync(file, 0o755);
    } catch {
      // Best-effort; many platforms (Windows in particular) ignore mode bits.
    }
  }
}

function listHookFiles(hookDir: string): string[] {
  // Hooks are flat shell scripts — avoid pulling glob deps.
  return readdirSync(hookDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".sh"))
    .map((e) => resolve(hookDir, e.name));
}

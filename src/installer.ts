import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import {
  type AntigravityTransformReport,
  runAntigravityTransform,
} from "./antigravity/transform.js";
import { type CiScaffoldReport, installCiScaffold } from "./ci-scaffold.js";
import { type CodexOptInReport, runCodexOptIn } from "./codex/opt-in.js";
import { type CodexTransformReport, runCodexTransform } from "./codex/transform.js";
import {
  addGitignoreEnv,
  addGitignoreNpxSkillsAgents,
  writeEnvExample,
  writeMcpAllowlist,
} from "./env-files.js";
import { EXTERNAL_ASSETS, INTERNAL_BUNDLED_SKILL_IDS, isAssetSelected } from "./external-assets.js";
import {
  type ExternalInstallerDeps,
  type ExternalInstallReport,
  runExternalInstall,
  selectExternalTargets,
} from "./external-installer.js";
import {
  backupDir,
  backupFileIfChanged,
  copyBackupDir,
  copyDir,
  copyFile,
  ensureProjectSkeleton,
} from "./fs-ops.js";
import {
  buildInstallLog,
  collectSkillHashes,
  hashContent,
  type InstallLog,
  type InstallLogRootFile,
  readInstallLog,
  writeInstallLog,
} from "./install-log.js";
import { type AssetSpec, buildManifest } from "./manifest.js";
import { composeMcpJson, writeMcpJson } from "./mcp-merge.js";
import { type OpencodeTransformReport, runOpencodeTransform } from "./opencode/transform.js";
import { mergeProjectClaude } from "./project-claude-merge.js";
import { addPreToolUseHook, type ClaudeSettings } from "./settings-merge.js";
import { type InstallSpec, type OptionFlags, resolveScope, type Track } from "./types.js";
import { runUpdateMode, type UpdateModeReport } from "./update-mode.js";

/**
 * karpathy-coder hook 상수 — install 이 쓰고 uninstall 의 수기 안내가 읽는다.
 * v26.123.0 — 두 곳이 같은 값을 봐야 해서 export. 파일명이 바뀌면 안내가 조용히 멈추므로
 * 경로도 여기서 파생시킨다 (`no-false-ship`: 같은 값이 2곳에 하드코딩되면 derive 로 단일화).
 */
export const KARPATHY_HOOK_RELPATH = ".claude/hooks/karpathy-gate.sh";
export const KARPATHY_HOOK_COMMAND = `bash "$CLAUDE_PROJECT_DIR/${KARPATHY_HOOK_RELPATH}"`;

/**
 * Install mode — Router action 매핑.
 *   - "fresh"     : 첫 설치 (기본값)
 *   - "add"       : 기존 위에 Track union 추가 (backup 없음)
 *   - "update"    : 정책 파일만 templates로 갱신 (backup + orphan prune + stale hook)
 *   - "reinstall" : 기존 .claude/ backup 후 처음부터 (backup 강제)
 */
export type InstallMode = "fresh" | "add" | "update" | "reinstall";

/**
 * 각 mode 를 **비대화형으로 도달하는 CLI 명령** (없으면 null = 위저드 전용).
 *
 * 왜 코드로 두나: `install` 은 플래그로 되는데 `update` 는 위저드로만 되던 상태가 오래
 * 방치됐다. "CI 로 깔 수는 있는데 갱신할 수는 없다"는 수요 문제가 아니라 계열 비대칭이고,
 * 사람이 매번 계열 전체를 기억해서 대조해야 하면 그 규약은 이미 실패한 것이다.
 *
 * `Record<InstallMode, ...>` 라서 **mode 를 추가하면 여기 분류하기 전에는 컴파일이 안 된다.**
 * null 을 고르는 건 허용하지만 그 순간 "위저드 전용"이 명시적 선언이 되고, 아래 테스트가
 * 그 목록을 화면에 내보낸다 — 침묵으로 빠지는 경로가 없다.
 */
export const MODE_ENTRY_POINT: Record<InstallMode, string | null> = {
  fresh: "install",
  // 기존 설치 위에 `install --track <new>` = add. mode 는 헤더 라벨만 다르고 동작은 fresh 와 같다
  // (backup 없음 · manifest copy 동일) — 별도 명령이 필요 없다.
  add: "install",
  update: "update",
  // 미제공 — `.claude/` 를 통째로 backup 으로 **옮기는** 파괴적 경로다. 비대화형 진입점을
  // 붙일지는 별도 판단 사항이라 열어둔다 (열어둔 것 자체가 이 표에 보인다).
  reinstall: null,
};

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
        // v26.77.0 — projectDir: 외부 설치기 spawn cwd (자산 착지 위치). Bug B fix.
        // v26.81.0 (ADR-022) — userOverride: 자산 opt-in(--with <id>) 전파 (flag 13종 대체).
        ctx: {
          tracks: ReadonlyArray<Track>;
          options: OptionFlags;
          projectDir?: string;
          userOverride?: {
            forceInclude: ReadonlyArray<string>;
            forceExclude: ReadonlyArray<string>;
          };
        },
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
  | { type: "external-complete"; report: ExternalInstallReport }
  /** v26.64.0 — install log write 실패 (non-fatal). */
  | { type: "install-log-error"; message: string };

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
export const KARPATHY_ASSET_ID = "karpathy-coder";

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
  /** v26.66.0 — Present when spec.cli includes "antigravity". */
  antigravity: AntigravityTransformReport | null;
  updateMode: UpdateModeReport | null;
  mode: InstallMode;
  envFiles: {
    envExampleCreated: boolean;
    gitignoreEnvAdded: boolean;
    mcpAllowlist: string[] | null;
    /** v0.8.0 — `.gitignore`에 추가된 npx skills agent 디렉토리 패턴 (`.factory/`, `.goose/`). */
    gitignoreNpxSkillsAdded: string[];
  };
  /**
   * v26.108.0 (ADR-037) — CI 스캐폴드 결과. opt-in 미선택 시 null. `.github/workflows/`
   * 는 CLI-agnostic 이라 claude baseline 밖의 전용 단계 (ci-scaffold.ts) 가 설치 주체.
   */
  ciScaffold: CiScaffoldReport | null;
  /** v0.6.1 — Phase 1 카테고리별 카운트 + names. Update mode에서는 빈 객체. */
  categories?: BaselineCategoryCounts;
  /** Root CLAUDE.md fill-in scaffold (project name + active-track note + FILL sections). null when claude baseline disabled. */
  rootClaudeMd: { tracks: ReadonlyArray<Track> } | null;
  /** 덮어쓰기 전 보존한 사용자 파일 백업 경로 (settings.json·CLAUDE.md, fresh/add 모드). audit SEC-1/CODE-2. */
  backups?: string[];
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
  /** v26.66.0 — Present when spec.cli includes "antigravity". */
  antigravity: AntigravityTransformReport | null;
  /** v26.108.0 (ADR-037) — CI 스캐폴드 결과 (opt-in 미선택 시 null). */
  ciScaffold: CiScaffoldReport | null;
  /** External install report (claude plugin / npm -g / npx skills). null when disabled or empty. */
  external: ExternalInstallReport | null;
  /** Update-mode report (rules/agents/commands/hooks/skills 갱신 + orphan prune + stale hook). null when not update mode. */
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
 * v26.82.0 (Phase R) — 276줄 단일 함수를 단계별 블록 함수로 분해 (동작 변경 0):
 *   update 단축 / claude baseline / CLI transforms / external / install log.
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

  // v26.123.0 (F-1a) — 추가 설치가 이전 설치 기록을 지우지 않도록 기존 로그를 먼저 읽는다.
  // reinstall 은 바로 아래에서 `.claude/` 를 통째로 backup 으로 옮기므로 그 뒤엔 읽을 수 없다.
  const previousLog = readInstallLog(projectDir);

  const backupPath = resolveBackupPath(ctx, mode, claudeDir);

  // Update mode 단축 — 정책 파일만 갱신하고 종료 (manifest copy / external 모두 skip)
  if (mode === "update") {
    return runUpdateInstall(ctx, templatesDir, backupPath);
  }

  const manifestSpec = buildManifestSpec(spec);

  // v0.8.0 — `.claude/` baseline은 spec.cli에 "claude" 포함 시에만 생성.
  // Codex/OpenCode 단독 사용자는 dead weight 회피.
  const base = spec.cli.includes("claude")
    ? installClaudeBaseline(manifestSpec, projectDir, templatesDir)
    : emptyClaudeBaseline();

  // Compose .mcp.json from template + track-mcp-map.tsv (Codex/OpenCode도 사용 — claude 무관)
  const mcpResult = composeAndWriteMcp(harnessRoot, projectDir, spec);

  // v26.108.0 (ADR-037) — CI 스캐폴드 (opt-in 전용). `.github/` 은 CLI-agnostic 이라
  // claude baseline 조건 밖에서 설치. 기존 워크플로 파일은 절대 덮어쓰지 않는다.
  const ciScaffold = isAssetSelected("ci-scaffold", {
    tracks: spec.tracks,
    options: spec.options,
    ...(spec.userOverride ? { userOverride: spec.userOverride } : {}),
  })
    ? installCiScaffold({ harnessRoot, projectDir, tracks: spec.tracks })
    : null;

  const baseline: BaselineReport = {
    filesCopied: base.filesCopied,
    dirsCopied: base.dirsCopied,
    skipped: base.skipped,
    backup: backupPath,
    installedTracks: [...spec.tracks].sort(),
    mcpServers: Object.keys(mcpResult.mcpServers).sort(),
    ...runCliTransforms(spec, harnessRoot, projectDir, manifestSpec.selectedInternalSkills),
    ciScaffold,
    updateMode: null,
    mode,
    envFiles: writeEnvironmentFiles(projectDir, spec.tracks),
    categories: base.categories,
    rootClaudeMd: base.rootClaudeMd,
    backups: base.backups,
  };

  // ━━━ Baseline complete — emit progress event so renderer can show Phase 1 rows ━━━
  ctx.onProgress?.({ type: "baseline-complete", baseline });

  // ━━━ External assets (claude plugin / npm -g / npx skills) ━━━
  const external = runExternalPhase(ctx);

  // ━━━ karpathy-coder hook auto-wire (v0.6.0) ━━━
  // SPEC: docs/specs/karpathy-hook-autowire.md AC2 — opt-in 강제 + install 성공 후에만.
  // v0.8.0 — `.claude/settings.json` PreToolUse 의존이라 spec.cli에 "claude" 포함 시에만 와이어 가능.
  const karpathyHook = wireKarpathyHook(spec, external, harnessRoot, projectDir);

  // ━━━ v26.64.0 (ADR-020) — Install log write ━━━
  // backupPath 가 있으면 `.claude/` 를 rename 으로 밀어냈다는 뜻 — 그 안에 살던 이전 자산은
  // 실제로 사라졌으므로 누적에서 빠져야 한다 (fresh/add 는 backupPath=null → 전부 유지).
  writeInstallLogSafe(
    ctx,
    external,
    base.rootClaudeMdLog,
    previousLog,
    backupPath !== null,
    collectRootFiles(baseline.envFiles, ciScaffold, mcpResult.created),
  );

  return { ...baseline, external, karpathyHook };
}

/**
 * Backup auto-on for update + reinstall (sourced from router action).
 * Update: copy backup (preserve original .claude/ for in-place update).
 * Reinstall + others: rename backup (move .claude/ aside, then full install).
 */
function resolveBackupPath(
  ctx: InstallContext,
  mode: InstallMode,
  claudeDir: string,
): string | null {
  const wantBackup = ctx.backup ?? (mode === "update" || mode === "reinstall");
  if (!wantBackup) return null;
  return mode === "update" ? copyBackupDir(claudeDir) : backupDir(claudeDir);
}

/** Update mode 단축 경로 — 정책 파일만 갱신 (manifest copy / external 모두 skip). */
function runUpdateInstall(
  ctx: InstallContext,
  templatesDir: string,
  backupPath: string | null,
): InstallReport {
  const updateReport = runUpdateMode(ctx.projectDir, templatesDir);
  const baseline: BaselineReport = {
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    backup: backupPath,
    installedTracks: [...ctx.spec.tracks].sort(),
    mcpServers: [],
    codex: null,
    codexOptIn: null,
    opencode: null,
    antigravity: null,
    ciScaffold: null,
    updateMode: updateReport,
    mode: "update",
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

/**
 * v26.81.0 (ADR-022) — manifest 게이팅 입력. 내부 자산 선택 판정 — 이전
 * OptionFlags.withTauri/withUzysHarness/withEcc boolean 자리를 카탈로그 선택
 * (wizard 체크 / --with <id> → forceInclude)으로 대체 (manifest 필드명은 유지).
 */
function buildManifestSpec(spec: InstallSpec): Required<AssetSpec> {
  const selectionCtx = {
    tracks: spec.tracks,
    options: spec.options,
    ...(spec.userOverride ? { userOverride: spec.userOverride } : {}),
  };
  return {
    tracks: spec.tracks,
    withTauri: isAssetSelected("tauri-desktop", selectionCtx),
    // v26.55.0 — withEcc gating (ADR-016). ECC cherry-pick (agents/skills/commands) 항목 토글.
    // withPrune 은 ecc-plugin 사용을 전제 (이전 applyOptionRules `withEcc ||= withPrune` 의미 보존).
    withEcc: isAssetSelected("ecc-plugin", selectionCtx) || spec.options.withPrune,
    // v26.87.0 — internal bundled skills (dev-method + opt-in advisors, v26.95.0). Each id's
    // condition (has-dev-track vs opt-in) is applied by isAssetSelected — manifest copy + the 3
    // non-Claude CLI transforms gate on this filtered list, so opt-in ones install only when
    // wizard-checked / `--with <id>`, and any uncheck / `--without <id>` (forceExclude) drops it.
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS.filter((id) =>
      isAssetSelected(id, selectionCtx),
    ),
  };
}

/** `.claude/` baseline (manifest copy) 결과. claude 미선택 시 emptyClaudeBaseline(). */
interface ClaudeBaselineResult {
  filesCopied: number;
  dirsCopied: number;
  skipped: number;
  categories: BaselineCategoryCounts;
  rootClaudeMd: { tracks: ReadonlyArray<Track> } | null;
  /** root CLAUDE.md 무결성 기록 — uninstall 시 사용자 수정 여부 판별 (install 원본과 sha 비교). */
  rootClaudeMdLog: { path: string; sha256: string } | null;
  /** 덮어쓰기 전 보존한 사용자 파일 백업 경로 (settings.json·CLAUDE.md). audit SEC-1/CODE-2. */
  backups: string[];
}

function emptyClaudeBaseline(): ClaudeBaselineResult {
  return {
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    categories: { rules: [], agents: [], hooks: [], commands: 0, skills: [] },
    rootClaudeMd: null,
    rootClaudeMdLog: null,
    backups: [],
  };
}

/** `.claude/` baseline — manifest copy + hook chmod + .installed-tracks + root CLAUDE.md merge. */
function installClaudeBaseline(
  manifestSpec: Required<AssetSpec>,
  projectDir: string,
  templatesDir: string,
): ClaudeBaselineResult {
  ensureProjectSkeleton(projectDir);

  const result = emptyClaudeBaseline();
  const manifest = buildManifest(manifestSpec);

  for (const entry of manifest) {
    if (!entry.applies(manifestSpec)) {
      continue;
    }
    const source = join(templatesDir, entry.source);
    const target = join(projectDir, entry.target);
    if (!existsSync(source)) {
      result.skipped += 1;
      continue;
    }
    if (entry.type === "file") {
      // 사용자 편집 가능 파일은 덮어쓰기 전 백업 (audit SEC-1 — settings.json hook/statusLine 소실 방지).
      if (entry.target === ".claude/settings.json") {
        const backup = backupFileIfChanged(target, readFileSync(source, "utf-8"));
        if (backup) {
          result.backups.push(backup);
        }
      }
      copyFile(source, target);
      result.filesCopied += 1;
    } else {
      copyDir(source, target);
      result.dirsCopied += 1;
    }
    accumulateCategory(result.categories, entry);
  }

  // chmod +x on hook scripts (cp does not preserve exec bit when source is non-exec)
  const hookDir = join(projectDir, ".claude/hooks");
  if (existsSync(hookDir)) {
    chmodHooksSync(hookDir);
  }

  // Write metadata file used by detect_install_state on next run (.claude/.installed-tracks)
  writeInstalledTracks(projectDir, manifestSpec.tracks);

  // Project root CLAUDE.md — an honest fill-in scaffold (project name + active tracks + FILL sections).
  // Note: overwrites any user customization on re-install. Documented behavior.
  const rootClaudeMd = writeRootClaudeMd(projectDir, manifestSpec.tracks);
  result.rootClaudeMd = { tracks: manifestSpec.tracks };
  result.rootClaudeMdLog = { path: "CLAUDE.md", sha256: hashContent(rootClaudeMd.content) };
  if (rootClaudeMd.backup) {
    result.backups.push(rootClaudeMd.backup);
  }
  return result;
}

/** Environment files (F7/F8 — bash setup-harness.sh L880~890 + L954~996 등가). */
function writeEnvironmentFiles(
  projectDir: string,
  tracks: ReadonlyArray<Track>,
): BaselineReport["envFiles"] {
  return {
    envExampleCreated: writeEnvExample(projectDir, tracks),
    gitignoreEnvAdded: addGitignoreEnv(projectDir),
    mcpAllowlist: writeMcpAllowlist(projectDir),
    // v0.8.0 — `.factory/`, `.goose/` ignore (npx skills universal install 사용자 #3)
    gitignoreNpxSkillsAdded: addGitignoreNpxSkillsAgents(projectDir),
  };
}

/** Codex / OpenCode / Antigravity per-CLI transforms (+ scope=global opt-in) 결과. */
interface CliTransformResults {
  codex: CodexTransformReport | null;
  codexOptIn: CodexOptInReport | null;
  opencode: OpencodeTransformReport | null;
  antigravity: AntigravityTransformReport | null;
}

function runCliTransforms(
  spec: InstallSpec,
  harnessRoot: string,
  projectDir: string,
  selectedInternalSkills: ReadonlyArray<string>,
): CliTransformResults {
  // Codex transform when spec.cli includes "codex"
  let codex: CodexTransformReport | null = null;
  let codexOptIn: CodexOptInReport | null = null;
  if (spec.cli.includes("codex")) {
    // v26.87.0 — dev-method skills 는 selectedInternalSkills 로 게이팅.
    codex = runCodexTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
    });
    // v26.64.0 (ADR-020) — Codex global trust opt-in 은 scope=global 일 때만 의미.
    // scope=project (default) 시 ~/.codex/ write skip (config.toml trust entry 만).
    const installScope = spec.scope ?? "project";
    if (installScope === "global" && spec.options.withCodexTrust) {
      codexOptIn = runCodexOptIn({ projectDir });
    }
  }

  // OpenCode transform when spec.cli includes "opencode"
  let opencode: OpencodeTransformReport | null = null;
  if (spec.cli.includes("opencode")) {
    opencode = runOpencodeTransform({ harnessRoot, projectDir, selectedInternalSkills });
  }

  // v26.66.0 — Antigravity transform when spec.cli includes "antigravity".
  // `.agents/rules/uzys-harness.md` (project context) + dev-method skills.
  let antigravity: AntigravityTransformReport | null = null;
  if (spec.cli.includes("antigravity")) {
    antigravity = runAntigravityTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
    });
  }

  return { codex, codexOptIn, opencode, antigravity };
}

/**
 * External assets (claude plugin / npm -g / npx skills) 설치 단계.
 * Default = real runExternalInstall. Tests inject mock or `null` to skip.
 * log/warn은 silent (renderer가 onAssetStart/Result로 스트리밍).
 */
function runExternalPhase(ctx: InstallContext): ExternalInstallReport | null {
  if (ctx.runExternal === null) {
    return null;
  }
  const { harnessRoot, projectDir, spec } = ctx;
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
  // v26.102.0 (ADR-031) — 헤더 카운트 = 실제 시도될 자산 수. runExternalInstall 과 **같은
  // selector** 를 호출해 "External assets (N)" 의 N 이 시도 목록과 구조적으로 일치
  // (이전엔 internal 8종을 포함해 dev 트랙 전부에서 헤더가 과대였다 — SOD 리뷰 F1 실측).
  const applicableCount = selectExternalTargets(EXTERNAL_ASSETS, {
    ...filterCtx,
    cli: spec.cli,
  }).targets.length;
  ctx.onProgress?.({ type: "external-start", assetCount: applicableCount });
  const external = runExt(
    { ...filterCtx, cli: spec.cli, projectDir, ...(spec.scope ? { scope: spec.scope } : {}) },
    externalDeps,
  );
  ctx.onProgress?.({ type: "external-complete", report: external });
  return external;
}

/**
 * Install log write — `.claude/.harness-install.json` (자산 list + scope + timestamp,
 * uninstall command 의 source). 실패는 install 자체를 fail 시키지 않음 (D16 — install 성공 우선).
 */
function writeInstallLogSafe(
  ctx: InstallContext,
  external: ExternalInstallReport | null,
  rootClaudeMdLog: { path: string; sha256: string } | null,
  previousLog: InstallLog | null,
  claudeDirMovedAside: boolean,
  rootFiles: ReadonlyArray<InstallLogRootFile>,
): void {
  try {
    const log = buildInstallLog(
      ctx.spec,
      external,
      resolveScope(ctx.spec.scope),
      rootClaudeMdLog,
      previousLog,
      claudeDirMovedAside,
      rootFiles,
    );
    // v26.126.0 (ADR-046) — 스킬 기준선은 **이력이 아니라 스냅샷**이라 buildInstallLog 의 누적
    // 경로를 타지 않는다. manifest copy 가 끝난 뒤 디스크를 읽어야 값이 맞다.
    const skillFiles = collectSkillHashes(ctx.projectDir);
    writeInstallLog(ctx.projectDir, skillFiles.length > 0 ? { ...log, skillFiles } : log);
  } catch (e) {
    ctx.onProgress?.({
      type: "install-log-error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
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
  const targetHook = join(projectDir, KARPATHY_HOOK_RELPATH);
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
): { mcpServers: Record<string, unknown>; created: boolean } {
  const mcpPath = join(projectDir, ".mcp.json");
  // 쓰기 전에 본다 — 쓰고 나면 "우리가 만든 것"과 "사용자 것에 병합한 것"을 구분할 수 없다.
  const created = !existsSync(mcpPath);
  const composed = composeMcpJson({
    templateMcpPath: join(harnessRoot, "templates/mcp.json"),
    trackMapPath: join(harnessRoot, "templates/track-mcp-map.tsv"),
    existingPath: mcpPath,
    tracks: spec.tracks,
  });
  writeMcpJson(mcpPath, composed);
  return { ...composed, created };
}

/**
 * v26.124.0 (F-1f) — 이번 설치가 `.claude/` **밖**에 만들거나 고친 루트 파일 목록.
 *
 * uninstall 은 이걸 지우지 않고 **안내만** 한다 (사용자 내용이 섞임). 그러려면 무엇을 건드렸는지
 * 기록이 있어야 하는데 v26.123.0 까지 아무 기록이 없어서 안내조차 못 했다.
 *
 * **이번 설치가 실제로 바꾼 것만 넣는다** — idempotent skip(이미 있어서 안 건드림)은 넣지 않는다.
 * 이전 설치분은 install-log 의 누적(mergeRootFiles)이 살려 준다.
 */
function collectRootFiles(
  envFiles: BaselineReport["envFiles"],
  ciScaffold: CiScaffoldReport | null,
  mcpCreated: boolean,
): InstallLogRootFile[] {
  const files: InstallLogRootFile[] = [
    {
      path: ".mcp.json",
      change: mcpCreated ? "created" : "modified",
      notes: [mcpCreated ? "MCP 서버 정의 생성" : "MCP 서버 정의 병합 (기존 항목 보존)"],
    },
  ];
  if (envFiles.envExampleCreated) {
    files.push({ path: ".env.example", change: "created", notes: ["Supabase 토큰 가이드"] });
  }
  // `mcpAllowlist` 는 세 값이 다 다르다: null=skip · []=**서버가 없어 안 씀** · 비어있지 않음=씀.
  // 길이를 안 보면 안 만든 파일을 만들었다고 기록한다 (env-files.ts writeMcpAllowlist).
  if (envFiles.mcpAllowlist && envFiles.mcpAllowlist.length > 0) {
    files.push({
      path: ".mcp-allowlist",
      change: "created",
      notes: [`MCP allowlist (${envFiles.mcpAllowlist.length} server)`],
    });
  }
  const gitignoreAdded = [
    ...(envFiles.gitignoreEnvAdded ? [".env"] : []),
    ...envFiles.gitignoreNpxSkillsAdded,
  ];
  if (gitignoreAdded.length > 0) {
    files.push({
      path: ".gitignore",
      change: "modified",
      notes: [`추가된 줄: ${gitignoreAdded.join(", ")}`],
    });
  }
  for (const workflow of ciScaffold?.written ?? []) {
    files.push({ path: workflow, change: "created", notes: ["CI 워크플로 스캐폴드"] });
  }
  return files;
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
  projectDir: string,
  tracks: ReadonlyArray<Track>,
): { content: string; backup: string | null } {
  const content = mergeProjectClaude(tracks, { projectName: basename(projectDir) });
  const target = join(projectDir, "CLAUDE.md");
  // 기존 사용자 CLAUDE.md 는 덮어쓰기 전 백업 (audit CODE-2 — 무백업 덮어쓰기 데이터 손실 방지).
  const backup = backupFileIfChanged(target, content);
  writeFileSync(target, content);
  return { content, backup };
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

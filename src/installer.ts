import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { AntigravityTransformReport } from "./antigravity/transform.js";
import { isBaselineExcluded } from "./baseline-targets.js";
import { type CiScaffoldReport, installCiScaffold } from "./ci-scaffold.js";
import { runCliTransforms } from "./cli-transforms.js";
import type { CodexOptInReport } from "./codex/opt-in.js";
import type { CodexTransformReport } from "./codex/transform.js";
import { addGitignoreAgentArtifacts, addGitignoreEnv, writeEnvExample } from "./env-files.js";
import { EXTERNAL_ASSETS, INTERNAL_BUNDLED_SKILL_IDS, isAssetSelected } from "./external-assets.js";
import {
  type ExternalInstallerDeps,
  type ExternalInstallReport,
  runExternalInstall,
  selectExternalTargets,
} from "./external-installer.js";
import {
  backupDir,
  backupFile,
  backupFileIfChanged,
  copyBackupDir,
  copyDir,
  copyFile,
  ensureProjectSkeleton,
} from "./fs-ops.js";
import {
  buildInstallLog,
  collectPolicyHashes,
  collectSkillHashes,
  hashContent,
  type InstallLog,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  mergeExternalFiles,
  POLICY_DIRS,
  readInstallLog,
  writeInstallLog,
} from "./install-log.js";
import { type AssetSpec, buildManifest, isCliNeutralTarget, resolveRules } from "./manifest.js";
import { composeMcpJson, writeMcpJson } from "./mcp-merge.js";
import type { OpencodeTransformReport } from "./opencode/transform.js";
import { HARNESS_ANCHOR_FILE, upsertHarnessImport } from "./project-claude-merge.js";
import { type InstallSpec, type OptionFlags, resolveScope, type Track } from "./types.js";
import { cleanStaleHookRefs, runUpdateMode, type UpdateModeReport } from "./update-mode.js";

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
    /**
     * v0.8.0 — `.gitignore`에 추가된 자동 생성물 디렉토리 패턴
     * (`.factory/`, `.goose/`, 2026-08-02부터 `.uzys-agent-harness/`).
     * 필드명은 v0.8.0 당시 범위(npx skills)를 그대로 쓴다 — 개명은 표면 3곳을 함께 건드린다.
     */
    gitignoreNpxSkillsAdded: string[];
  };
  /**
   * v26.108.0 (ADR-037) — CI 스캐폴드 결과. opt-in 미선택 시 null. `.github/workflows/`
   * 는 CLI-agnostic 이라 claude baseline 밖의 전용 단계 (ci-scaffold.ts) 가 설치 주체.
   */
  ciScaffold: CiScaffoldReport | null;
  /** v0.6.1 — Phase 1 카테고리별 카운트 + names. Update mode에서는 빈 객체. */
  categories?: BaselineCategoryCounts;
  /**
   * Root CLAUDE.md 처리 결과. null when claude baseline disabled.
   * `created` = 없던 파일을 fill-in 스캐폴드로 만들었다. false 면 기존 사용자 파일에 앵커
   * import 한 줄만 얹었다는 뜻 — 두 경우의 보고 문구가 달라야 한다 (스캐폴드를 쓰지도 않고
   * "fill-in scaffold" 라고 보고하면 그게 거짓 보고다).
   */
  rootClaudeMd: { tracks: ReadonlyArray<Track>; created: boolean } | null;
  /**
   * 2026-08-16 — 사용자가 위저드에서 체크를 푼 트랙 자산의 대상 경로.
   *
   * 화면에 내는 이유는 설치 화면이 **무엇이 깔렸는가**만 말하면 해제가 먹혔는지 확인할 길이
   * 없기 때문이다. 0건이면 아무것도 안 뜬다.
   */
  baselineExcluded: string[];
  /** `baselineExcluded` 중 **디스크에 그대로 남은** 것 (`add`·`reinstall`). 화면이 이걸 표시한다. */
  baselineExcludedOnDisk: string[];
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
  /**
   * M-1 — settings.json 이 가리키는 없는 스크립트를 지운 결과 (`.claude/` 기준 상대경로).
   * install 은 settings.json 을 매번 템플릿으로 덮어쓰므로 치유도 매번 다시 해야 한다.
   * claude 미선택 시 `.claude/settings.json` 자체가 없어 항상 `[]`.
   */
  staleHookRefs: string[];
  /**
   * 2026-08-16 — 사용자가 위저드 3단계에서 **체크를 푼** 트랙 자산의 대상 경로.
   *
   * `BaselineReport` 와 같은 필드를 여기 다시 선언하는 이유는 두 타입이 별개이기 때문이다
   * (런타임은 `{...baseline}` 로 이미 흐른다). 타입에만 없으면 호출자가 결과를 못 읽고,
   * 그러면 "해제가 먹혔는지" 를 프로그램으로 확인할 방법이 사라진다.
   */
  baselineExcluded: string[];
  /** `baselineExcluded` 중 디스크에 남은 것. `BaselineReport` 와 같은 이유로 여기도 선언한다. */
  baselineExcludedOnDisk: string[];
  /** Install mode dispatched (echo of ctx.mode, default "fresh"). */
  mode: InstallMode;
  /** Environment file generation results (always present). */
  envFiles: {
    /** true if .env.example was created (csr-supabase/full only). */
    envExampleCreated: boolean;
    /** true if .gitignore got `.env` line appended. */
    gitignoreEnvAdded: boolean;
    /**
     * v0.8.0 — `.gitignore`에 추가된 자동 생성물 디렉토리 패턴
     * (`.factory/`, `.goose/`, 2026-08-02부터 `.uzys-agent-harness/`).
     * 필드명은 v0.8.0 당시 범위(npx skills)를 그대로 쓴다 — 개명은 표면 3곳을 함께 건드린다.
     */
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

  // v26.123.0 (F-1a) — 추가 설치가 이전 설치 기록을 지우지 않도록 기존 로그를 먼저 읽는다.
  // reinstall 은 아래에서 `.claude/` 를 통째로 backup 으로 옮기므로 그 뒤엔 읽을 수 없다.
  const previousLog = readInstallLog(projectDir);

  // Update mode pre-flight — 갱신할 **설치**가 있어야 한다. backup 전에 검증.
  //
  // 판정 기준은 `.claude/` 가 아니다. update 는 v26.134.0(ADR-049)부터 외부 CLI 산출물도
  // 갱신하므로 `.claude/` 가 없는 codex/opencode/antigravity 단독 설치도 정당한 대상이고,
  // `src/commands/update.ts` 의 pre-flight 는 이미 그렇게 판정한다(#253). **파이프라인만
  // `.claude/` 를 요구해 그 사용자를 거절하고 있었다** — 명령은 통과시키고 파이프라인이
  // throw 하니, 비 Claude 단독 사용자는 새 자산을 받을 길이 재설치뿐이었다(독립 검증 C-2c).
  // 설치의 CLI 중립 증거는 install log 다.
  //
  // 단, **claude 를 고른 설치인데 `.claude/` 가 없으면** 그건 정상 상태가 아니라 깨진 설치다 —
  // 그대로 진행하면 룰만 복원되고 `settings.json`·훅이 없는 반쪽 `.claude/` 가 만들어진다
  // (독립 재검증 M-R2). 그 경우는 예전처럼 막고 재설치로 보낸다.
  const claudeWasSelected = previousLog?.spec.cli.includes("claude") ?? false;
  if (mode === "update" && !existsSync(claudeDir) && (previousLog === null || claudeWasSelected)) {
    // 두 상황을 같은 문장으로 말하지 않는다 — 하나는 "깔린 게 없다", 다른 하나는 "깔렸는데
    // 일부가 사라졌다"이고, 사용자가 할 일이 다르다. 후자를 "설치가 없다"고 하면 로그를 눈으로
    // 본 사람은 도구가 틀렸다고 생각한다.
    throw new Error(
      claudeWasSelected
        ? `Update mode found a broken install at ${projectDir} — this project installed Claude Code assets but \`.claude/\` is gone. Reinstall instead: agent-harness install --track <name>`
        : `Update mode requires an existing install at ${projectDir}`,
    );
  }

  const backupPath = resolveBackupPath(ctx, mode, claudeDir);

  // Update mode 단축 — 정책 파일만 갱신하고 종료 (manifest copy / external 모두 skip)
  if (mode === "update") {
    return runUpdateInstall(ctx, templatesDir, backupPath);
  }

  const manifestSpec = buildManifestSpec(spec);

  // v0.8.0 — `.claude/` baseline은 spec.cli에 "claude" 포함 시에만 생성.
  // Codex/OpenCode 단독 사용자는 dead weight 회피.
  // ADR-047 — 덮어쓰기 전 소유 판정에 쓸 기준선. `.claude/` 를 옮겨낸 뒤(reinstall)엔 대조할
  // 대상이 없으므로 previousLog 를 그대로 쓰되, 그 경우 아래 existsSync 가 자연히 걸러낸다.
  const policyBase = new Map((previousLog?.policyFiles ?? []).map((f) => [f.path, f.sha256]));

  // 위저드 3단계에서 사용자가 **해제한** 트랙 자산. 비어 있으면(기본) 아무것도 안 거른다.
  const baselineExcluded = new Set(spec.baselineExclude ?? []);

  const base = spec.cli.includes("claude")
    ? installClaudeBaseline(manifestSpec, projectDir, templatesDir, policyBase, baselineExcluded)
    : // claude 미선택이어도 CLI 중립 자산은 깔린다. manifest 전체가 `.claude/` baseline 안에서만
      // 돌던 탓에 이 자산들이 claude 설치에만 도달했는데, **배포 룰 본문이 이 스크립트들을
      // 호출 지점으로 지목한다** — 즉 없는 도구를 있다고 안내하고 있었다(#300 과 같은 형태).
      installCliNeutralAssets(manifestSpec, projectDir, templatesDir, baselineExcluded);

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

  // v26.133.0 (ADR-048) — 외부 CLI transform 도 소유자 판정을 받는다. 기준선은 `.claude/` 와
  // 별도 필드(`externalFiles`)다: 저기는 templates 복사라 사후에 디스크를 훑어 만들지만
  // (`collectPolicyHashes`), 여기는 **렌더 결과**라 훑어서는 무엇이 하네스 것인지 알 수 없다.
  const {
    externalFiles,
    externalBackups,
    externalUpdated: _externalUpdated,
    externalBackedUp: _externalBackedUp,
    ...cliTransforms
  } = runCliTransforms({
    harnessRoot,
    projectDir,
    cli: spec.cli,
    selectedInternalSkills: manifestSpec.selectedInternalSkills,
    // 룰 목록의 SSOT 는 하나다 — `.claude/rules/` 를 채우는 것과 같은 `resolveRules` 결과가
    // 나머지 세 CLI 로도 간다. 여기서 다시 고르면 CLI 마다 다른 룰이 깔린다.
    rules: resolveRules(manifestSpec).filter(
      (r) => !isBaselineExcluded(`.claude/rules/${r}.md`, baselineExcluded),
    ),
    previousExternal: previousLog?.externalFiles ?? [],
    codexTrust: (spec.scope ?? "project") === "global" && spec.options.withCodexTrust,
  });

  const baseline: BaselineReport = {
    filesCopied: base.filesCopied,
    dirsCopied: base.dirsCopied,
    skipped: base.skipped,
    backup: backupPath,
    installedTracks: [...spec.tracks].sort(),
    mcpServers: Object.keys(mcpResult.mcpServers).sort(),
    ...cliTransforms,
    ciScaffold,
    updateMode: null,
    mode,
    envFiles: writeEnvironmentFiles(projectDir, spec.tracks),
    categories: base.categories,
    rootClaudeMd: base.rootClaudeMd,
    // 외부 CLI 백업도 같은 줄에 노출한다 — 백업이 화면에 안 보이면 사용자는 자기 편집분이
    // 어디 갔는지 알 수 없고, 그러면 백업은 있어도 없는 것과 같다 (ADR-046/047 과 같은 이유).
    backups: [...base.backups, ...externalBackups],
    baselineExcluded: base.excluded,
    baselineExcludedOnDisk: base.excludedOnDisk,
  };

  // ━━━ Baseline complete — emit progress event so renderer can show Phase 1 rows ━━━
  ctx.onProgress?.({ type: "baseline-complete", baseline });

  // ━━━ External assets (claude plugin / npm -g / npx skills) ━━━
  const external = runExternalPhase(ctx);

  // ━━━ M-1 — settings.json stale hook ref 치유 (baseline·external 뒤 1회) ━━━
  // 여기서 부르는 이유: 앞 단계들이 settings.json 과 참조 대상(스킬/훅 파일)을 모두 확정한
  // 뒤여야 "무엇이 없는가"가 답이 된다. 판정하지 않고 **디스크가 답하게 한다** — 설치자에
  // withEcc 사본이 생기지 않는다 (ADR-049 와 같은 형태).
  const staleHookRefs = healStaleHookRefs(spec, projectDir);

  // ━━━ v26.64.0 (ADR-020) — Install log write ━━━
  // backupPath 가 있으면 `.claude/` 를 rename 으로 밀어냈다는 뜻 — 그 안에 살던 이전 자산은
  // 실제로 사라졌으므로 누적에서 빠져야 한다 (fresh/add 는 backupPath=null → 전부 유지).
  writeInstallLogSafe(
    ctx,
    externalFiles,
    external,
    base.rootClaudeMdLog,
    previousLog,
    backupPath !== null,
    collectRootFiles(baseline.envFiles, ciScaffold, mcpResult.created),
  );

  return { ...baseline, external, staleHookRefs };
}

/**
 * M-1 — settings.json 이 참조하는 없는 `.claude/**` 스크립트를 제거한다.
 *
 * update 쪽 치유기(`cleanStaleHookRefs`)를 그대로 재사용한다. install 이 settings.json 을
 * 매번 템플릿으로 덮어쓰므로(`copyFile`) 치유는 설치마다 다시 필요하고, 같은 술어를 두 벌
 * 두면 그 사본이 다음 drift 서식지가 된다.
 */
function healStaleHookRefs(spec: InstallSpec, projectDir: string): string[] {
  // claude 미선택이면 `.claude/settings.json` 자체가 없다.
  if (!spec.cli.includes("claude")) return [];
  const settingsPath = join(projectDir, ".claude/settings.json");
  if (!existsSync(settingsPath)) return [];
  return cleanStaleHookRefs(settingsPath, join(projectDir, ".claude"));
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
  const updateReport = runUpdateMode(ctx.projectDir, templatesDir, ctx.harnessRoot);
  const baseline: BaselineReport = {
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    baselineExcluded: [],
    baselineExcludedOnDisk: [],
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
      gitignoreNpxSkillsAdded: [],
    },
    rootClaudeMd: null,
  };
  ctx.onProgress?.({ type: "baseline-complete", baseline });
  // update 경로의 치유 결과는 `updateMode.staleHookRefs` 가 이미 싣는다 — 여기서 다시 담으면
  // 같은 사실이 두 필드가 되고 렌더가 중복 보고한다.
  return { ...baseline, external: null, staleHookRefs: [] };
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
  rootClaudeMd: { tracks: ReadonlyArray<Track>; created: boolean } | null;
  /** 하네스 앵커 파일 무결성 기록 — uninstall 시 사용자 수정 여부 판별 (install 원본과 sha 비교). */
  rootClaudeMdLog: { path: string; sha256: string } | null;
  /** 덮어쓰기 전 보존한 사용자 파일 백업 경로 (settings.json·CLAUDE.md). audit SEC-1/CODE-2. */
  backups: string[];
  /**
   * 2026-08-16 — 사용자가 위저드에서 **체크를 푼** 자산의 대상 경로.
   *
   * `skipped` 와 나눈다: 저건 "원본이 없어서 못 깔았다"는 결함 신호이고 이건 정상 선택이다.
   * 한 숫자에 담으면 설치 화면이 사용자의 선택을 결함으로 보고한다.
   */
  excluded: string[];
  /**
   * 해제했는데 **디스크에 그대로 남아 있는** 대상 (`excluded` 의 부분집합).
   *
   * `add`·`reinstall` 은 이전 설치본을 지우지 않으므로 "제외됨"만 찍으면 화면이 디스크와 다른
   * 말을 한다 — 사용자는 파일이 사라진 줄 알고, 실제로는 그 룰이 계속 상주한다. 체크 해제는
   * 제거가 아니라는 기존 규약(v26.125.0 `● installed` 마커)을 baseline 항목에도 적용한다.
   */
  excludedOnDisk: string[];
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
    excluded: [],
    excludedOnDisk: [],
  };
}

/**
 * CLI 중립 자산(`.uzys-agent-harness/`)만 설치한다 — claude 를 고르지 않은 설치용.
 *
 * manifest 는 통째로 `.claude/` baseline 안에서만 돌았고, 그래서 `protect-branch.sh` ·
 * `spec-drift-check.sh` 는 두 entry 의 주석이 "CLI 중립 슬롯"이라 적어 두었음에도 claude
 * 설치에만 도달했다. 배포 룰 본문이 이 스크립트들을 호출 지점으로 지목하므로, 도달하지 않으면
 * 룰이 **없는 도구를 있다고 안내**하게 된다 (#300 과 같은 형태).
 *
 * `.claude/` 를 만들지 않는 것이 이 함수의 존재 이유다 — 스켈레톤·훅 chmod·루트 CLAUDE.md
 * 병합은 전부 claude 전용이라 여기서 하지 않는다.
 *
 * **해제한 룰은 여기서도 보고한다** (ADR-074). 이 경로에서도 제외는 실제로 작동한다 —
 * `runCliTransforms` 로 가는 `rules` 가 걸러지므로 `AGENTS.md`·`.agents/rules/` 에서 빠진다.
 * 그런데 보고가 없으면 **제외가 가장 안 보이는 곳에서 화면도 침묵한다**: 눈으로 확인할
 * `.claude/rules/` 디렉터리조차 없는 설치다. 룰만 세는 이유는 룰이 `.claude/` 밖으로 나가는
 * 유일한 baseline 종류이기 때문이다(에이전트·훅·트랙 스킬은 비 Claude 표면이 없다).
 */
function installCliNeutralAssets(
  manifestSpec: Required<AssetSpec>,
  projectDir: string,
  templatesDir: string,
  baselineExcluded: ReadonlySet<string>,
): ClaudeBaselineResult {
  const result = emptyClaudeBaseline();
  for (const entry of buildManifest(manifestSpec)) {
    if (!entry.applies(manifestSpec)) continue;
    if (
      entry.target.startsWith(".claude/rules/") &&
      isBaselineExcluded(entry.target, baselineExcluded)
    ) {
      result.excluded.push(entry.target);
      continue;
    }
    if (!isCliNeutralTarget(entry.target)) continue;
    const source = join(templatesDir, entry.source);
    if (!existsSync(source)) {
      result.skipped += 1;
      continue;
    }
    copyFile(source, join(projectDir, entry.target));
    result.filesCopied += 1;
  }
  return result;
}

/** `.claude/` baseline — manifest copy + hook chmod + .installed-tracks + root CLAUDE.md merge. */
/**
 * 정책 파일(rules/agents/commands/hooks)을 덮어쓰기 전 사용자 편집분 보호 (v26.132.0 · ADR-047).
 *
 * 판정은 update 와 **같은 기준선**(install log `policyFiles`)을 쓴다 — 두 명령이 서로 다른
 * 기준으로 "사용자가 고쳤다"를 판정하면 한쪽이 백업한 걸 다른 쪽이 조용히 밀 수 있다.
 *
 * @returns 백업 경로. 백업이 불필요했으면 null.
 */
function backupEditedPolicyFile(
  entryTarget: string,
  target: string,
  source: string,
  baseline: ReadonlyMap<string, string>,
): string | null {
  const prefix = ".claude/";
  if (!entryTarget.startsWith(prefix)) return null;
  const rel = entryTarget.slice(prefix.length);
  if (!POLICY_DIRS.some(({ dir, ext }) => rel.startsWith(`${dir}/`) && rel.endsWith(ext))) {
    return null;
  }
  if (!existsSync(target)) return null;
  const current = readFileSync(target, "utf-8");
  if (current === readFileSync(source, "utf-8")) return null; // 이미 최신 — 백업 불필요
  const recorded = baseline.get(rel);
  if (recorded !== undefined && recorded === hashContent(current)) return null; // 하네스가 놓아둔 그대로
  return backupFile(target);
}

function installClaudeBaseline(
  manifestSpec: Required<AssetSpec>,
  projectDir: string,
  templatesDir: string,
  policyBase: ReadonlyMap<string, string>,
  baselineExcluded: ReadonlySet<string>,
): ClaudeBaselineResult {
  ensureProjectSkeleton(projectDir);

  const result = emptyClaudeBaseline();
  const manifest = buildManifest(manifestSpec);

  for (const entry of manifest) {
    if (!entry.applies(manifestSpec)) {
      continue;
    }
    const target = join(projectDir, entry.target);
    // 사용자가 3단계에서 체크를 푼 자산. `skipped` 로 세지 않는다 — 저 카운터는 "원본이 없어서
    // 못 깔았다"는 결함 신호이고, 이쪽은 사용자가 그러라고 한 것이다. 둘을 한 숫자에 담으면
    // 설치 화면이 정상 선택을 결함으로 보고한다.
    if (isBaselineExcluded(entry.target, baselineExcluded)) {
      result.excluded.push(entry.target);
      // 이미 있던 파일은 지우지 않는다(체크 해제 ≠ 제거). 그 사실을 여기서 잡아 두지 않으면
      // `add`·`reinstall` 화면이 "제외됨"이라 적고 파일은 그대로 남는다 — 화면이 디스크와
      // 다른 말을 하는 것이고, 그게 이 PR 이 없애려던 상태다.
      if (existsSync(target)) result.excludedOnDisk.push(entry.target);
      continue;
    }
    const source = join(templatesDir, entry.source);
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
      } else {
        // v26.132.0 (ADR-047) — 룰·훅·에이전트도 같은 보호를 받는다. 그 전까지 install 이
        // 백업한 건 settings.json 하나뿐이라, 기존 설치 위 `install` 이 사용자가 고친 룰을
        // 흔적 없이 밀었다 (add 모드는 `.claude/` 통짜 백업도 없다 — resolveBackupPath).
        const backup = backupEditedPolicyFile(entry.target, target, source, policyBase);
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

  // Project root CLAUDE.md — 없으면 fill-in 스캐폴드로 만들고, 있으면 앵커 import 한 줄만 얹는다.
  const rootClaudeMd = writeRootClaudeMd(projectDir, manifestSpec.tracks);
  result.rootClaudeMd = { tracks: manifestSpec.tracks, created: rootClaudeMd.created };
  // 무결성 기록의 대상은 **하네스 앵커 파일**이다 (루트 CLAUDE.md 가 아니다) — uninstall 이
  // 회수하는 것도, update 가 갱신하는 것도 그 파일뿐이라 소유를 주장할 수 있는 것도 그것뿐이다.
  // 방금 manifest copy 가 놓아둔 디스크 내용을 읽는다: 렌더를 다시 하면 기준선이 두 벌이 된다.
  result.rootClaudeMdLog = harnessAnchorLog(projectDir);
  return result;
}

/** 앵커 파일의 설치 시점 sha. manifest 에서 빠졌거나 source 부재로 skip 됐으면 null (정직 기록). */
function harnessAnchorLog(projectDir: string): { path: string; sha256: string } | null {
  const anchor = join(projectDir, HARNESS_ANCHOR_FILE);
  if (!existsSync(anchor)) return null;
  return { path: HARNESS_ANCHOR_FILE, sha256: hashContent(readFileSync(anchor, "utf-8")) };
}

/** Environment files (F7/F8 — bash setup-harness.sh L880~890 + L954~996 등가). */
function writeEnvironmentFiles(
  projectDir: string,
  tracks: ReadonlyArray<Track>,
): BaselineReport["envFiles"] {
  return {
    envExampleCreated: writeEnvExample(projectDir, tracks),
    gitignoreEnvAdded: addGitignoreEnv(projectDir),
    // v0.8.0 — `.factory/`, `.goose/` ignore (npx skills universal install 사용자 #3).
    // 2026-08-02 — `.uzys-agent-harness/` 합류 (설치 로그 + 훅 차단 로그).
    gitignoreNpxSkillsAdded: addGitignoreAgentArtifacts(projectDir),
  };
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
 * Install log write — `.uzys-agent-harness/.harness-install.json` (자산 list + scope + timestamp,
 * uninstall command 의 source). 실패는 install 자체를 fail 시키지 않음 (D16 — install 성공 우선).
 */
function writeInstallLogSafe(
  ctx: InstallContext,
  externalFiles: ReadonlyArray<InstallLogSkillFile>,
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
    // v26.132.0 (ADR-047) — 정책 파일 기준선도 같은 이유로 여기서 찍는다. 이게 없으면
    // 다음 update 가 소유를 판정하지 못해 ⓐ 멀쩡한 파일을 전부 백업하고 ⓑ 폐기 룰을 회수 못 한다.
    const policyFiles = collectPolicyHashes(ctx.projectDir, join(ctx.harnessRoot, "templates"));
    // v26.133.0 (ADR-048) — 외부 CLI 기준선은 transform 이 **쓰면서 만든 값**이라 여기서 다시
    // 훑지 않는다. 이번에 안 건드린 산출물의 기록은 유지하고(다음 실행이 판정 불가로 떨어지지
    // 않게), 디스크에서 사라진 항목만 뺀다.
    const merged = mergeExternalFiles(ctx.projectDir, previousLog?.externalFiles, externalFiles);
    writeInstallLog(ctx.projectDir, {
      ...log,
      ...(skillFiles.length > 0 ? { skillFiles } : {}),
      ...(policyFiles.length > 0 ? { policyFiles } : {}),
      ...(merged.length > 0 ? { externalFiles: merged } : {}),
    });
  } catch (e) {
    ctx.onProgress?.({
      type: "install-log-error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
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

/**
 * 루트 `CLAUDE.md` — **덮어쓰지 않는다** (P5 · ADR-060). 하네스 내용은 앵커 파일
 * (`HARNESS_ANCHOR_FILE`)로 따로 나가고, 여기엔 그것을 끌어오는 마커 import 한 줄만 얹는다.
 *
 * 그래서 백업도 사라졌다 — 백업은 "덮어쓰기 전 원본 보존"의 대응물인데 이제 덮어쓰기가 없다.
 * 사용자 본문은 그대로 남고 우리 블록만 추가되며, uninstall 이 그 블록만 도로 걷어간다.
 * (`.mcp.json`·`.gitignore` 처럼 사용자 파일에 병합하는 다른 산출물과 같은 방침이다.)
 */
function writeRootClaudeMd(projectDir: string, tracks: ReadonlyArray<Track>): { created: boolean } {
  const target = join(projectDir, "CLAUDE.md");
  const existing = existsSync(target) ? readFileSync(target, "utf-8") : null;
  const content = upsertHarnessImport(existing, { projectName: basename(projectDir), tracks });
  // 이미 import 가 있으면 upsert 가 입력을 그대로 돌려준다 — 그때는 파일을 만지지 않는다.
  if (content !== existing) {
    writeFileSync(target, content);
  }
  return { created: existing === null };
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

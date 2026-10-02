import { chmodSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { seedRootClaudeProjectContext } from "./anchor-seed.js";
import type { AntigravityTransformReport } from "./antigravity/transform.js";
import { isBaselineExcluded } from "./baseline-targets.js";
import { type CiScaffoldReport, installCiScaffold } from "./ci-scaffold.js";
import { renderHarnessMcp, runCliTransforms } from "./cli-transforms.js";
import type { CodexOptInReport } from "./codex/opt-in.js";
import type { CodexTransformReport } from "./codex/transform.js";
import { gitignoreRender, writeEnvExample } from "./env-files.js";
import { EXTERNAL_ASSETS, isAssetSelected } from "./external-assets.js";
import {
  type ExternalInstallerDeps,
  type ExternalInstallReport,
  runExternalInstall,
  selectExternalTargets,
} from "./external-installer.js";
import { foreignOwnedTarget, linksToProjectSharedSkill } from "./foreign-slot.js";
import { copyBackupDir, ensureProjectSkeleton, listFilesRecursive } from "./fs-ops.js";
import { cleanStaleHookRefs } from "./hook-ref.js";
import {
  buildInstallLog,
  type InstallLog,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  installedClis,
  mergeExternalFiles,
  readInstallLog,
  writeInstallLog,
} from "./install-log.js";
import {
  composeWriterLog,
  createInstallWriter,
  cumulativeExcluded,
  GITIGNORE_NOTE_PREFIX,
  type InstallWriter,
  type JudgedWrite,
  legacyGitignoreSeed,
  legacyMcpSeed,
  legacySettingsSeed,
  renderSettingsPortion,
  type SharedWrite,
  type WriteLedger,
} from "./install-writes.js";
import { refreshLinkedSkillBodies } from "./linked-skill-bodies.js";
import {
  type AssetSpec,
  buildAssetSpec,
  buildManifest,
  isCliNeutralTarget,
  resolveRules,
} from "./manifest.js";
import type { OpencodeTransformReport } from "./opencode/transform.js";
import { upsertHarnessImport } from "./project-claude-merge.js";
import { type InstallSpec, type OptionFlags, resolveScope, type Track } from "./types.js";
import { runUpdateMode, type UpdateModeReport } from "./update-mode.js";

/**
 * Install mode — Router action 매핑.
 *   - "fresh"     : 첫 설치 (기본값)
 *   - "add"       : 기존 위에 Track union 추가 (backup 없음)
 *   - "update"    : 정책 파일만 templates로 갱신 (backup + orphan prune + stale hook)
 *   - "reinstall" : install 과 같은 쓰기 (#551 PR-3 — `.claude/` 를 옮기지 않는다. 고친 파일만 그 파일 하나 백업)
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
  // #533 (D9) — 위저드 메뉴에서 빠져 플래그가 됐다. #551 PR-3 — 폴더 이동은 없다: install 과 같은 쓰기를
  // 판정(`judge`)대로 한다. 기록 밖 항목 회수는 설계 §9 PR-9.
  reinstall: "install --reinstall",
};

export interface InstallContext {
  /** Path to the harness repo (where `templates/` lives). */
  harnessRoot: string;
  /** Target project directory. */
  projectDir: string;
  spec: InstallSpec;
  /**
   * Router action mode. Defaults to "fresh".
   * - "update" 은 따로 도는 경로다. "add"/"reinstall" 은 fresh 와 같은 쓰기다(#551 PR-3).
   */
  mode?: InstallMode;
  /**
   * **update 전용** — `.claude/` 사본(`.claude.backup-<ts>`)을 뜰지. 기본은 update 이고 claude 가 깔린 설치.
   * install · `--reinstall` 은 폴더를 옮기거나 복사하지 않는다 — 고친 파일만 그 파일 하나를 백업한다(#551 PR-3).
   * update 의 폴더 사본은 설계 §9 PR-5 가 없앤다.
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
  /** commands 디렉토리 카운트 — names는 디렉토리라 무의미 */
  commands: number;
  /** skill 디렉토리 names */
  skills: string[];
}

/** Baseline phase result (everything except external assets). */
export interface BaselineReport {
  filesCopied: number;
  dirsCopied: number;
  skipped: number;
  /** #603 — install 이 settings.json 에서 지운 죽은 훅 참조(.claude/ 상대경로). USAGE L148 약속의 고지용. */
  staleHookRefs?: string[];
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
  rootClaudeMd: {
    tracks: ReadonlyArray<Track>;
    created: boolean;
    /** #528 — 새로 만들면서 다른 앵커의 설치자 절을 옮겨 심었으면 그 출처. 아니면 `null`. */
    seededFrom?: string | null;
  } | null;
  /**
   * 2026-08-16 — 사용자가 위저드에서 체크를 푼 트랙 자산의 대상 경로.
   *
   * 화면에 내는 이유는 설치 화면이 **무엇이 깔렸는가**만 말하면 해제가 먹혔는지 확인할 길이
   * 없기 때문이다. 0건이면 아무것도 안 뜬다.
   */
  baselineExcluded: string[];
  /** `baselineExcluded` 중 **디스크에 그대로 남은** 것 (`add`·`reinstall`). 화면이 이걸 표시한다. */
  baselineExcludedOnDisk: string[];
  /**
   * #343 — 깔릴 자리가 디렉터리가 아니라 건너뛴 대상 (`.claude/` 포함 상대경로).
   * 화면에 이름을 내지 않으면 사용자는 **고른 자산이 왜 없는지** 알 방법이 없다.
   */
  baselineForeignOwned: string[];
  /**
   * #524 — `.claude/skills/<id>` 가 이 프로젝트의 `.agents/skills/<id>` 를 가리키는 링크라 **그 공유
   * 본문**을 최신판으로 맞춘 스킬 id. 링크 자리는 여전히 건드리지 않는다(링크는 설치자 것이다).
   * `baselineForeignOwned` 와 나누는 이유: 이쪽은 받았고 저쪽은 못 받았다 — 한 행이면 설치자는
   * 자기 스킬이 갱신됐는지 알 수 없다. 옵셔널인 이유는 update 경로와 화면 픽스처가 이 축을 안 싣기
   * 때문이다(없음 = 0건).
   */
  baselineLinked?: string[];
  /** #524 — 링크가 가리키는 공유 본문이 우리 기록에 없어 **건드리지 않은** 스킬 id. */
  baselineLinkedNotOurs?: string[];
  /** 덮어쓰기 전 보존한 설치자 파일 백업의 절대경로 — 하네스 파일 · 외부 CLI 산출물 · 링크 본문. */
  backups?: string[];
  /**
   * #551 PR-3 — 하네스 파일 판정 중 **알릴 것**(백업한 파일마다 실제 백업 경로 · 같은 내용이라 둔 설치자 파일).
   * 화면 줄은 여기서만 나온다(`judge` 의 `line`). 옵셔널 = update 경로와 화면 픽스처는 싣지 않는다.
   */
  judged?: JudgedWrite[];
  /** #551 PR-3 — 함께 쓰는 파일(`.claude/settings.json` · `.mcp.json` · `.gitignore`)의 판정과 결과. */
  shared?: SharedWrite[];
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
   * M-1 — settings.json 이 가리키는 없는 스크립트를 지운 결과 (`.claude/` 기준 상대경로). update 경로 전용 —
   * install 은 settings.json 의 하네스 몫을 **이번 선택으로 렌더**해 몫만 쓰므로 사후 치유가 없다(#551 PR-3 ·
   * 설계 N13). install 에서는 항상 `[]`.
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
  /** 자리가 디렉터리가 아니라 건너뛴 대상. `BaselineReport` 와 같은 이유로 여기도 선언한다. */
  baselineForeignOwned: string[];
  /** #524 — 링크를 통해 공유 본문을 갱신한 스킬 id. `BaselineReport` 와 같은 이유로 여기도 선언한다. */
  baselineLinked?: string[];
  /** #524 — 링크가 가리키는 공유 본문이 우리 기록에 없어 건드리지 않은 스킬 id. */
  baselineLinkedNotOurs?: string[];
  /** 덮어쓰기 전 보존한 사용자 파일 백업 경로. `BaselineReport` 와 같은 이유로 여기도 선언한다. */
  backups?: string[];
  /** #551 PR-3 — `BaselineReport.judged` 와 같다. */
  judged?: JudgedWrite[];
  /** #551 PR-3 — `BaselineReport.shared` 와 같다. */
  shared?: SharedWrite[];
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
  const claudeWasSelected = previousLog !== null && installedClis(previousLog).includes("claude");
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

  // Update mode 단축 — 정책 파일만 갱신하고 종료 (manifest copy / external 모두 skip)
  if (mode === "update") {
    return runUpdateInstall(
      ctx,
      templatesDir,
      resolveUpdateBackupPath(ctx, claudeDir, previousLog),
    );
  }

  const manifestSpec = buildManifestSpec(spec);

  // 위저드 3단계에서 사용자가 **해제한** 트랙 자산. 비어 있으면(기본) 아무것도 안 거른다.
  const baselineExcluded = new Set(spec.baselineExclude ?? []);

  // #551 PR-3 — 쓰기는 전부 판정 함수(`judge`)를 탄다. 폴더를 옮기거나 복사하지 않는다(`--reinstall` 포함) —
  // 첫 접촉 · 고친 파일은 **그 파일 하나**만 백업한다. 설치자가 뺀 것은 누적한다(설계 §6.2 ⓒ).
  const excluded = cumulativeExcluded(
    previousLog,
    [...baselineExcluded, ...(spec.userOverride?.forceExclude ?? [])],
    spec.userOverride?.forceInclude ?? [],
  );
  const writer = createInstallWriter({ projectDir, previousLog, excluded });

  // v0.8.0 — `.claude/` baseline은 spec.cli에 "claude" 포함 시에만 생성.
  // Codex/OpenCode 단독 사용자는 dead weight 회피.
  const base = spec.cli.includes("claude")
    ? installClaudeBaseline(
        manifestSpec,
        projectDir,
        templatesDir,
        baselineExcluded,
        harnessRoot,
        writer,
        previousLog,
      )
    : // claude 미선택이어도 CLI 중립 자산은 깔린다. manifest 전체가 `.claude/` baseline 안에서만
      // 돌던 탓에 이 자산들이 claude 설치에만 도달했는데, **배포 룰 본문이 이 스크립트들을
      // 호출 지점으로 지목한다** — 즉 없는 도구를 있다고 안내하고 있었다(#300 과 같은 형태).
      installCliNeutralAssets(manifestSpec, templatesDir, baselineExcluded, writer);

  // `.mcp.json` — 하네스 서버만 더한다(템플릿 + 트랙 표, Codex/OpenCode 와 같은 원천 #568). claude 무관.
  const mcp = writeMcpPortion(writer, harnessRoot, spec.tracks, previousLog);

  // v26.108.0 (ADR-037) — CI 스캐폴드 (opt-in 전용). `.github/` 은 CLI-agnostic 이라
  // claude baseline 조건 밖에서 설치. 기존 워크플로 파일은 절대 덮어쓰지 않는다.
  const ciScaffold = isAssetSelected("ci-scaffold", {
    tracks: spec.tracks,
    options: spec.options,
    ...(spec.userOverride ? { userOverride: spec.userOverride } : {}),
  })
    ? installCiScaffold({ harnessRoot, projectDir, tracks: spec.tracks })
    : null;

  // v26.133.0 (ADR-048) — 외부 CLI transform 도 소유자 판정을 받는다. 기준선은 transform 이 **쓰면서
  // 만든 값**(`externalFiles`)이다 — 렌더 결과라 디스크를 훑어서는 무엇이 하네스 것인지 알 수 없다.
  const {
    externalFiles,
    externalBackups,
    externalUpdated: _externalUpdated,
    externalBackedUp: _externalBackedUp,
    externalForeignOwned,
    sharedFiles: _sharedFiles,
    portions: cliPortions,
    portionPaths: cliPortionPaths,
    deletedKeyIds: cliDeletedIds,
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
    // #568 — Codex · OpenCode 의 MCP 서버는 `.mcp.json` 과 같은 원천(템플릿 + 이 트랙 표)에서 온다.
    tracks: spec.tracks,
    previousExternal: previousLog?.externalFiles ?? [],
    // ADR-097 결정 2 — 범위 조건 없이 `--with-codex-trust` 하나로 정한다.
    codexTrust: spec.options.withCodexTrust,
    // #551 R2 — `.codex/config.toml` · `opencode.json` · 첫 접촉 `AGENTS.md` 의 몫도 `.mcp.json` 과 같은 왕복을
    // 탄다: 앞 기록의 몫과 누적 제외 목록을 넘기고, 결과 몫 · 지운 키를 아래 기록(`composeWriterLog`)에 싣는다.
    // 안 실으면 다음 실행이 하네스 구간을 설치자 것으로 읽어 영영 갱신하지 못한다.
    shared: { portions: previousLog?.portions ?? [], excluded: [...excluded] },
  });

  // #524 — 링크 자리의 공유 본문. 외부 변환 **뒤에** 돈다: 그 결과를 기준선에 합쳐야 같은 실행에서
  // 방금 쓴 바이트를 "설치자 편집"으로 오판하지 않는다(같은 바이트면 no-op).
  const linked = refreshLinkedSkillBodies({
    harnessRoot,
    projectDir,
    ids: base.linkedSkills,
    baseline: new Map(
      mergeExternalFiles(projectDir, previousLog?.externalFiles, externalFiles).map((f) => [
        f.path,
        f.sha256,
      ]),
    ),
  });

  const envFiles = writeEnvironmentFiles(writer, projectDir, spec.tracks, previousLog);
  const writerLedger = writer.ledger();
  // 두 쓰기 경로(PR-3 writer · CLI 변환)의 몫은 파일이 겹치지 않는다 — 경로 단위로 합쳐 한 기록으로 쓴다.
  const ledger: WriteLedger = {
    ...writerLedger,
    portions: [...writerLedger.portions, ...cliPortions],
    portionPaths: [...writerLedger.portionPaths, ...cliPortionPaths],
    deletedIds: [...writerLedger.deletedIds, ...cliDeletedIds],
  };

  const baseline: BaselineReport = {
    ...(base.staleHookRefs.length > 0 ? { staleHookRefs: base.staleHookRefs } : {}),
    filesCopied: base.filesCopied,
    dirsCopied: base.dirsCopied,
    skipped: base.skipped,
    // #551 PR-3 — install · `--reinstall` 은 폴더를 옮기지 않는다. 백업은 파일마다 `backups`/`judged` 에 있다.
    backup: null,
    installedTracks: [...spec.tracks].sort(),
    mcpServers: mcp,
    ...cliTransforms,
    ciScaffold,
    updateMode: null,
    mode,
    envFiles,
    categories: base.categories,
    rootClaudeMd: base.rootClaudeMd,
    // 외부 CLI 백업도 같은 줄에 노출한다 — 백업이 화면에 안 보이면 사용자는 자기 편집분이
    // 어디 갔는지 알 수 없고, 그러면 백업은 있어도 없는 것과 같다 (ADR-046/047 과 같은 이유).
    backups: [...ledger.backups, ...externalBackups, ...linked.backupPaths],
    judged: ledger.judged,
    shared: ledger.shared,
    baselineExcluded: base.excluded,
    baselineExcludedOnDisk: base.excludedOnDisk,
    // `.claude/` baseline 과 외부 CLI 산출물의 같은 판정을 **한 목록으로** 낸다.
    baselineForeignOwned: [
      ...new Set([...base.foreignOwned, ...externalForeignOwned, ...linked.foreignOwned]),
    ],
    baselineLinked: linked.updated,
    baselineLinkedNotOurs: linked.notOurs,
  };

  // ━━━ Baseline complete — emit progress event so renderer can show Phase 1 rows ━━━
  ctx.onProgress?.({ type: "baseline-complete", baseline });

  // ━━━ External assets (claude plugin / npm -g / npx skills) ━━━
  const external = runExternalPhase(ctx);

  // ━━━ v26.64.0 (ADR-020) — Install log write ━━━
  // #551 PR-3 — 쓰기 = 기록. 이번 실행이 쓴 경로·sha 를 옛 기록 위에 누적한다(디스크 스캔 없음).
  writeInstallLogSafe(
    ctx,
    // 링크 본문의 기준선도 같은 필드다 — 같은 경로면 뒤(이번에 쓴 값)가 이긴다.
    [...externalFiles, ...linked.files],
    external,
    ledger,
    previousLog,
    excluded,
    collectRootFiles(envFiles, ciScaffold, ledger.shared),
  );

  // install 은 settings.json 을 렌더한 몫만 쓰므로 사후 치유가 없다(설계 N13) — update 경로만 싣는다.
  return { ...baseline, external, staleHookRefs: baseline.staleHookRefs ?? [] };
}

/**
 * update 의 `.claude/` 사본(copy) — **update 전용**(설계 §9 PR-5 가 없앤다). install · `--reinstall` 은 폴더를
 * 옮기거나 복사하지 않는다(#551 PR-3).
 *
 * #536 — **Claude 가 깔린 집합에 없으면** `.claude/` 를 복사하지 않는다. 그 실행은 `.claude/` 를 한 글자도
 * 안 바꾸므로(update-mode `claudeManaged`) 백업할 것이 없고, 복사하면 설치자 소유 디렉터리의 사본이 실행마다
 * 쌓인다. 판정은 로그의 깔린 집합(`installedClis`)이다 — `spec.cli`(마지막 설치분)로 보면 claude 로 깔고 codex 를
 * 더한 설치본이 `[codex]` 로 읽혀 실제로 갱신되는 `.claude/` 의 백업을 잃는다. 로그가 없는 레거시 설치본은
 * 이전과 같이 백업한다.
 */
function resolveUpdateBackupPath(
  ctx: InstallContext,
  claudeDir: string,
  previousLog: InstallLog | null,
): string | null {
  const claudeUntouched = previousLog !== null && !installedClis(previousLog).includes("claude");
  if (!(ctx.backup ?? !claudeUntouched)) return null;
  return copyBackupDir(claudeDir);
}

/**
 * Update mode 단축 경로 — manifest copy 는 건너뛴다.
 *
 * 갱신 대상은 ⓐ 정책 파일 ⓑ 외부 CLI 산출물(ADR-049) ⓒ **설치 기록에 적힌 외부 스킬**(#374).
 * 세 번째가 오래 빠져 있었고, 그동안 화면은 다 갱신된 것처럼 보였다.
 */
function runUpdateInstall(
  ctx: InstallContext,
  templatesDir: string,
  backupPath: string | null,
): InstallReport {
  const updateReport = runUpdateMode(
    ctx.projectDir,
    templatesDir,
    ctx.harnessRoot,
    {},
    ctx.spec.updateOnly,
  );
  const baseline: BaselineReport = {
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    baselineExcluded: [],
    baselineExcludedOnDisk: [],
    baselineForeignOwned: [],
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
 * OptionFlags.withTauri/withUzysHarness boolean 자리를 카탈로그 선택
 * (wizard 체크 / --with <id> → forceInclude)으로 대체 (manifest 필드명은 유지).
 */
export function buildManifestSpec(spec: InstallSpec): Required<AssetSpec> {
  // derive 본체는 `manifest.ts` 의 `buildAssetSpec` 하나다 (#320) — 계측 경로가 같은 것을 부른다.
  // 여기 다시 조립하면 그 순간 사본이 둘이 되고, 그게 #320 의 원인이었다.
  return buildAssetSpec({
    tracks: spec.tracks,
    options: spec.options,
    ...(spec.userOverride ? { userOverride: spec.userOverride } : {}),
  });
}

/** `.claude/` baseline (manifest copy) 결과. claude 미선택 시 emptyClaudeBaseline(). */
interface ClaudeBaselineResult {
  /** #603 — install 치유가 지운 죽은 훅 참조. */
  staleHookRefs: string[];
  filesCopied: number;
  dirsCopied: number;
  skipped: number;
  categories: BaselineCategoryCounts;
  rootClaudeMd: {
    tracks: ReadonlyArray<Track>;
    created: boolean;
    /** #528 — 새로 만들면서 다른 앵커의 설치자 절을 옮겨 심었으면 그 출처. 아니면 `null`. */
    seededFrom?: string | null;
  } | null;
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
  /**
   * #343 — 깔릴 자리가 **디렉터리가 아닌 것**으로 이미 차 있어 건너뛴 대상.
   *
   * `excluded`(사용자가 체크를 풂) · `skipped`(원본 부재)와 셋 다 다른 사실이라 따로 센다:
   * 이건 **디스크 쪽 사정**이고, 사용자가 고를 때는 보이지 않던 것이다.
   */
  foreignOwned: string[];
  /**
   * #524 — 자리가 이 프로젝트의 `.agents/skills/<id>` 를 가리키는 링크인 스킬 id. `foreignOwned` 에
   * 넣지 않는다 — 그 본문은 외부 변환 뒤에 `refreshLinkedSkillBodies` 가 기록대로 판정한다.
   */
  linkedSkills: string[];
}

function emptyClaudeBaseline(): ClaudeBaselineResult {
  return {
    staleHookRefs: [],
    filesCopied: 0,
    dirsCopied: 0,
    skipped: 0,
    categories: { rules: [], agents: [], hooks: [], commands: 0, skills: [] },
    rootClaudeMd: null,
    excluded: [],
    excludedOnDisk: [],
    foreignOwned: [],
    linkedSkills: [],
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
  templatesDir: string,
  baselineExcluded: ReadonlySet<string>,
  writer: InstallWriter,
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
    // #551 PR-3 — 판정대로 쓴다(첫 접촉 · 고친 파일은 그 파일 하나 백업). 전에는 백업 없이 덮었다.
    writer.harness(entry.target, { source });
    result.filesCopied += 1;
  }
  return result;
}

/** 훅 스크립트 자리 — settings.json 의 하네스 몫은 이번에 여기 깔린 스크립트만 부른다(설계 N13). */
const HOOKS_PREFIX = ".claude/hooks/";
const SETTINGS_TARGET = ".claude/settings.json";
const INSTALLED_TRACKS = ".claude/.installed-tracks";

/**
 * `.claude/` baseline — manifest 의 하네스 파일을 판정대로 쓴다 + hook chmod + `.installed-tracks` +
 * `settings.json` 의 하네스 몫 + 루트 CLAUDE.md import.
 *
 * #551 PR-3 — 파일마다 `judge`(설계 §1.2)가 정한다: 없으면 쓰고 · 기록 sha 그대로면 조용히 갱신하고 ·
 * 설치자가 고쳤거나(기록과 다름) 기록 없는 설치자 파일이 자리에 있으면(첫 접촉) **그 파일 하나**를
 * `<file>.backup-<ts>` 로 남긴 뒤 쓴다. 스킬 디렉터리도 파일 단위다(#343 — 슬롯 안 파일 링크는 건너뛴다).
 * `settings.json` 은 함께 쓰는 파일이라 통째로 쓰지 않고 하네스 몫만 더한다(#563).
 */
function installClaudeBaseline(
  manifestSpec: Required<AssetSpec>,
  projectDir: string,
  templatesDir: string,
  baselineExcluded: ReadonlySet<string>,
  /** #528 — 루트 `CLAUDE.md` 를 **새로 만들 때** `AGENTS.md` 의 절 경계를 읽을 템플릿 자리. */
  harnessRoot: string,
  writer: InstallWriter,
  previousLog: InstallLog | null,
): ClaudeBaselineResult {
  ensureProjectSkeleton(projectDir);

  const result = emptyClaudeBaseline();
  const manifest = buildManifest(manifestSpec);
  let settingsSource: string | null = null;

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
    // #524 — 슬롯이 이 프로젝트의 `.agents/skills/<id>` 로의 링크면 남의 것이 아니라 공유 본문이다.
    // 링크 자리엔 쓰지 않고(디렉터리를 부으면 링크를 따라간다) id 만 넘긴다 — 본문 판정은 외부
    // 변환 뒤에 기록으로 한다(`runInstall` → `refreshLinkedSkillBodies`).
    const skillId = entry.target.slice(".claude/skills/".length);
    if (entry.type === "dir" && linksToProjectSharedSkill(projectDir, skillId)) {
      result.linkedSkills.push(skillId);
      continue;
    }
    // #343 — 남의 도구가 소유한 스킬 슬롯에는 쓰지 않는다 (판정 SSOT = foreign-slot.ts).
    // 슬롯이 링크인 경우와 슬롯 안 파일이 링크인 경우를 한 술어가 함께 본다.
    const foreign = foreignOwnedTarget(projectDir, entry.target);
    if (foreign !== null) {
      // 슬롯 단위로 한 번만 보고한다 — 사용자가 옮겨야 할 대상은 파일이 아니라 그 자리다.
      if (!result.foreignOwned.includes(foreign)) result.foreignOwned.push(foreign);
      continue;
    }
    if (entry.type === "file") {
      if (entry.target === SETTINGS_TARGET) {
        // 함께 쓰는 파일 — 훅 스크립트가 다 깔린 뒤 하네스 몫만 쓴다(아래).
        settingsSource = source;
      } else {
        writer.harness(entry.target, { source });
      }
      result.filesCopied += 1;
    } else {
      // #343 — 디렉터리 자산은 **파일 단위로** 판정한다. 슬롯이 우리 것이어도 그 **안의 파일**이
      // 링크일 수 있고, 통짜 복사는 그것을 그대로 따라가 남의 파일을 덮었다.
      // dir 엔트리는 전부 `.claude/skills/<id>` 다(manifest.ts #409 — 스킬은 디렉터리 단위로만).
      for (const rel of listFilesRecursive(source)) {
        const slot = foreignOwnedTarget(projectDir, `${entry.target}/${rel}`);
        if (slot !== null) {
          if (!result.foreignOwned.includes(slot)) result.foreignOwned.push(slot);
          continue;
        }
        writer.harness(`${entry.target}/${rel}`, { source: join(source, rel) });
      }
      result.dirsCopied += 1;
    }
    accumulateCategory(result.categories, entry);
  }

  // chmod +x on hook scripts (cp does not preserve exec bit when source is non-exec)
  const hookDir = join(projectDir, ".claude/hooks");
  if (existsSync(hookDir)) {
    chmodHooksSync(hookDir);
  }

  // Write metadata file used by detect_install_state on next run (.claude/.installed-tracks).
  // 하네스 파일이라 같은 판정을 받는다 — 옛 판 기록엔 sha 가 없으므로 대상으로 알려 준다("no checksum").
  writer.harness(
    INSTALLED_TRACKS,
    { content: installedTracksText(manifestSpec.tracks) },
    { isTarget: (p) => p === INSTALLED_TRACKS },
  );

  if (settingsSource !== null) {
    writeSettingsPortion(writer, settingsSource, projectDir, previousLog, (script) => {
      const target = `${HOOKS_PREFIX}${script}`;
      return (
        manifest.some((e) => e.target === target && e.applies(manifestSpec)) &&
        !isBaselineExcluded(target, baselineExcluded) &&
        existsSync(join(projectDir, target))
      );
    });
    // #603 — USAGE L148: "Install and update both remove any settings.json hook entry whose
    // script file is missing, and note it in the summary." update 만 지우던 것을 install 도.
    // 스크립트가 이번 실행으로 깔렸는지와 무관하게 **참조 시점의 파일 유무**로 판정한다.
    const healed = cleanStaleHookRefs(
      join(projectDir, ".claude", "settings.json"),
      join(projectDir, ".claude"),
    );
    if (healed.length > 0) result.staleHookRefs.push(...healed);
  }

  // Project root CLAUDE.md — 없으면 fill-in 스캐폴드로 만들고, 있으면 앵커 import 한 줄만 얹는다.
  const rootClaudeMd = writeRootClaudeMd(
    projectDir,
    manifestSpec.tracks,
    manifestSpec.selectedInternalSkills ?? [],
    harnessRoot,
  );
  result.rootClaudeMd = {
    tracks: manifestSpec.tracks,
    created: rootClaudeMd.created,
    seededFrom: rootClaudeMd.seededFrom,
  };
  return result;
}

/**
 * `.claude/settings.json` — 함께 쓰는 파일(`json-keys`). 템플릿을 **이번 선택으로** 렌더한 하네스 몫(훅 · statusLine)만
 * 더하고, 설치자의 키·훅·statusLine·model 은 그대로 둔다(#563). 못 읽으면 한 바이트도 쓰지 않는다(#574).
 * `projectDir` 는 필수다 — 옛 판이 절대경로로 박은 하네스 훅을 알아봐야 같은 훅이 두 번 돌지 않는다(PR-1 인계 ①).
 */
function writeSettingsPortion(
  writer: InstallWriter,
  source: string,
  projectDir: string,
  previousLog: InstallLog | null,
  hookInstalled: (script: string) => boolean,
): SharedWrite {
  const render = renderSettingsPortion(readFileSync(source, "utf8"), hookInstalled);
  const claudeWasInstalled = previousLog !== null && installedClis(previousLog).includes("claude");
  return writer.shared(SETTINGS_TARGET, render, {
    // 옛 판은 이 파일을 템플릿으로 통째 덮었다 — claude 를 깐 기록이 있을 때만 그 훅을 하네스 몫으로 찾는다
    legacySeed: (text) =>
      claudeWasInstalled ? legacySettingsSeed(text, render, projectDir) : new Map(),
    createdNote: "Claude Code 설정 — 하네스 몫만(훅 · statusLine)",
  });
}

/**
 * `.mcp.json` — 함께 쓰는 파일(`json-keys`). 하네스 서버(템플릿 + 트랙 표 — Codex · OpenCode 와 같은 원천,
 * #568)만 더한다. 설치자 서버와 같은 이름이면 설치자 것이 이기고, 설치자가 지운 하네스 서버는 되살리지 않는다.
 *
 * @returns 쓴 뒤 파일에 있는 하네스 서버 이름(정렬) — 설치 화면 · 보고.
 */
function writeMcpPortion(
  writer: InstallWriter,
  harnessRoot: string,
  tracks: ReadonlyArray<Track>,
  previousLog: InstallLog | null,
): string[] {
  const servers = renderHarnessMcp(harnessRoot, tracks).mcpServers;
  const render = new Map<string, unknown>(
    Object.entries(servers).map(([name, cfg]) => [`mcpServers.${name}`, cfg]),
  );
  const res = writer.shared(".mcp.json", render, {
    legacySeed: (text) => legacyMcpSeed(text, render, previousLog),
    createdNote: "MCP 서버 정의 생성",
  });
  return [...res.harness].sort();
}

function installedTracksText(tracks: ReadonlyArray<string>): string {
  return `${[...new Set(tracks)].sort().join("\n")}\n`;
}

/**
 * Environment files (F7/F8). `.env.example` 은 스캐폴드라 없을 때만 한 번 쓴다(ADR-037 · 결정 7). `.gitignore` 는
 * 함께 쓰는 파일(`lines`) — **있을 때만** 하네스 줄을 더한다(설계 §2 행 15 "지금도 줄 추가" — 없는 파일은 만들지
 * 않는다). 설치자가 이미 둔 같은 줄은 설치자 것이고, 설치자가 지운 하네스 줄은 되살리지 않는다.
 */
function writeEnvironmentFiles(
  writer: InstallWriter,
  projectDir: string,
  tracks: ReadonlyArray<Track>,
  previousLog: InstallLog | null,
): BaselineReport["envFiles"] {
  const envExampleCreated = writeEnvExample(projectDir, tracks);
  const render = gitignoreRender();
  const res = writer.shared(".gitignore", render, {
    onlyIfPresent: true,
    legacySeed: (text) => legacyGitignoreSeed(text, render, previousLog),
  });
  return {
    envExampleCreated,
    gitignoreEnvAdded: res.added.includes(".env"),
    // v0.8.0 — `.factory/`, `.goose/` ignore (npx skills universal install 사용자 #3).
    // 2026-08-02 — `.uzys-agent-harness/` 합류 (설치 로그 + 훅 차단 로그).
    gitignoreNpxSkillsAdded: res.added.filter((line) => line !== ".env"),
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
  const { projectDir, spec } = ctx;
  const runExt = ctx.runExternal ?? runExternalInstall;
  const externalDeps: ExternalInstallerDeps = {
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
 *
 * #551 PR-3 — **쓰기 = 기록.** 기준선은 설치 뒤 디스크를 훑어 만들지 않는다(`collectPolicyHashes` ·
 * `collectSkillHashes` 는 install 경로에서 끊었다 — 템플릿과 이름이 같은 설치자 파일을 담았다, R1). 이번 실행이
 * 판정대로 쓴 경로·sha 를 옛 기록 위에 누적하고(`composeWriterLog`), 옛 판 스캔 기록은 처음 한 번 소유 필터를
 * 거쳐 이어받는다(`records: "writer"`, Q1).
 */
function writeInstallLogSafe(
  ctx: InstallContext,
  cliFiles: ReadonlyArray<InstallLogSkillFile>,
  external: ExternalInstallReport | null,
  ledger: WriteLedger,
  previousLog: InstallLog | null,
  excluded: ReadonlySet<string>,
  rootFiles: ReadonlyArray<InstallLogRootFile>,
): void {
  try {
    const base = buildInstallLog(
      ctx.spec,
      external,
      resolveScope(ctx.spec.scope),
      ledger.anchor,
      previousLog,
      // `--reinstall` 도 `.claude/` 를 옮기지 않는다 — 이전 자산은 디스크에 그대로다
      false,
      [...rootFiles, ...ledger.rootFiles],
    );
    writeInstallLog(
      ctx.projectDir,
      composeWriterLog({
        projectDir: ctx.projectDir,
        base,
        previous: previousLog,
        ledger,
        cliFiles,
        excluded,
      }),
    );
  } catch (e) {
    ctx.onProgress?.({
      type: "install-log-error",
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * v26.124.0 (F-1f) — 이번 설치가 `.claude/` **밖**에 고친 루트 파일 목록(하네스가 **만든** 함께 쓰는 파일은
 * writer 가 `created` 로 적는다).
 *
 * **이번 설치가 실제로 바꾼 것만 넣는다** — 못 읽어 남긴 파일 · 이미 최신이라 안 건드린 파일은 넣지 않는다.
 * 이전 설치분은 install-log 의 누적(mergeRootFiles)이 살려 준다.
 */
function collectRootFiles(
  envFiles: BaselineReport["envFiles"],
  ciScaffold: CiScaffoldReport | null,
  shared: ReadonlyArray<SharedWrite>,
): InstallLogRootFile[] {
  const files: InstallLogRootFile[] = [];
  const mcp = shared.find((f) => f.path === ".mcp.json");
  if (mcp?.verdict === "upsert-portion" && mcp.changed) {
    files.push({
      path: ".mcp.json",
      change: "modified",
      notes: ["MCP 서버 정의 병합 (기존 항목 보존)"],
    });
  }
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
      notes: [`${GITIGNORE_NOTE_PREFIX}${gitignoreAdded.join(", ")}`],
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

/**
 * 루트 `CLAUDE.md` — **덮어쓰지 않는다** (P5 · ADR-060). 하네스 내용은 앵커 파일
 * (`HARNESS_ANCHOR_FILE`)로 따로 나가고, 여기엔 그것을 끌어오는 마커 import 한 줄만 얹는다.
 *
 * 그래서 백업도 사라졌다 — 백업은 "덮어쓰기 전 원본 보존"의 대응물인데 이제 덮어쓰기가 없다.
 * 사용자 본문은 그대로 남고 우리 블록만 추가되며, uninstall 이 그 블록만 도로 걷어간다.
 * (`.mcp.json`·`.gitignore` 처럼 사용자 파일에 병합하는 다른 산출물과 같은 방침이다.)
 */
function writeRootClaudeMd(
  projectDir: string,
  tracks: ReadonlyArray<Track>,
  continuousSkills: ReadonlyArray<string>,
  harnessRoot: string,
): { created: boolean; seededFrom: string | null } {
  const target = join(projectDir, "CLAUDE.md");
  const existing = existsSync(target) ? readFileSync(target, "utf-8") : null;
  // #528 — 파일을 **새로 만들 때만** `AGENTS.md` 의 설치자 절을 옮겨 심는다. 이미 있으면 그
  // 본문이 이기고(우리는 마커 블록만 책임진다), 그때는 옮길 자리 자체가 없다.
  const seeded = existing === null ? seedRootClaudeProjectContext(projectDir, harnessRoot) : null;
  const content = upsertHarnessImport(existing, {
    projectName: basename(projectDir),
    tracks,
    continuousSkills,
    ...(seeded === null ? {} : { projectContext: seeded }),
  });
  // 이미 import 가 있으면 upsert 가 입력을 그대로 돌려준다 — 그때는 파일을 만지지 않는다.
  if (content !== existing) {
    writeFileSync(target, content);
  }
  return { created: existing === null, seededFrom: seeded === null ? null : "AGENTS.md" };
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

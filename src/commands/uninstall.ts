/**
 * Uninstall command — v26.64.0 (ADR-020).
 *
 * 동작:
 *   1. `.uzys-agent-harness/.harness-install.json` 읽기 (구 위치 `.claude/` 폴백).
 *   2. assets[] 별 reverse:
 *      - scope=project: 실제 reverse (`claude plugin uninstall --scope project`, `npm uninstall`, fs rm).
 *      - scope=global: 안내만 (D16 — 글로벌 영역 자동 삭제 금지). 사용자가 직접 명령 실행.
 *   3. 하네스 파일은 **기록된 것만 하나씩** 회수한다(#746 · ADR-097 결정 3 · 4) — CLI 폴더(`.claude/` · `.codex/` ·
 *      `.opencode/`)를 통째로 옮기거나 지우지 않는다. 안 고친 파일은 지우고, 고친 파일은 그 파일 하나를 백업하고 지운다.
 *      함께 쓰는 파일은 하네스 몫만 걷고, 하네스가 자리를 빌렸던 설치자 파일(`displaced`)은 원래 이름으로 되돌린다.
 *      기록에 없는 설치자 파일은 제자리에 둔다. 실체가 프로젝트 밖이면 건드리지 않고 "남김 + 링크 → 대상" 을
 *      말한다(#692 · ADR-098). `AGENTS.md` 는 하네스 절만 걷어내고 설치자 절을 남긴다 (#516).
 *   4. install log 자체도 함께 제거 — 되돌리기에 실패한 자산이 있으면 지우지 않고 남은 것으로 다시 쓴다(#889).
 *
 * 옵션:
 *   --dry-run        실제 변경 없이 reverse list 만 출력.
 *   --only <ids>     v26.123.0 (F-1c) — 항목별 제거. 하네스 파일 미변경 + 로그는 남은 자산으로 재기록.
 *   --keep-templates v26.169.0 에서 없어졌다 — 거절하고 같은 일을 하는 `--only <ids>` 를 알려 준다(ADR-097 결정 6).
 *
 * 안전:
 *   - log 없으면 명확 에러 + early exit.
 *   - scope=global 자산은 절대 자동 삭제 X (D16).
 *   - 되돌리기에 성공한 것만 로그에서 뺀다. 자동 경로가 없거나 실패한 자산은 기록에 남기고,
 *     아무것도 못 되돌렸으면 성공으로 보고하지 않는다 (no-false-ship).
 */

import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import {
  accessSync,
  type Dirent,
  existsSync,
  constants as fsConstants,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { ADAPTERS, keyId, SHARED_FILES } from "../adapters/index.js";
import { jsonSha } from "../adapters/json-keys.js";
import {
  AGENTS_BLOCK_NAME,
  type AgentsMdStripResult,
  isLegacyHarnessAgentsMd,
  stripAgentsMd,
} from "../agents-md-merge.js";
import { AGENTS_MD_TEMPLATE, agentsMdClis, isAgentsMdCli } from "../agents-md-render.js";
import { type AgentsMdTransformReport, runAgentsMdTransform } from "../agents-md-transform.js";
import { removableFor } from "../cli-ownership.js";
import { CLI_DISPLAY_NAMES } from "../cli-targets.js";
import { renderEverySelectableMcp } from "../cli-transforms.js";
import { tomlBasicString } from "../codex/trust-entry.js";
import { c, status } from "../design.js";
import {
  type DisplacedOutcome,
  isLegacyDisplaced,
  restoreDisplaced,
  withoutRestored,
} from "../displaced.js";
import { gitignoreRender, HARNESS_RUNTIME_IGNORES } from "../env-files.js";
import { CONTINUOUS_SKILLS } from "../external-assets.js";
import { type GlobalCopyReclaim, reclaimGlobalSkillCopies } from "../external-installer.js";
import { foreignOwnedTarget } from "../foreign-slot.js";
import {
  backupFile,
  backupIfLossyUtf8,
  listFilesRecursive,
  PROJECT_SKELETON_DIRS,
} from "../fs-ops.js";
import { LEGACY_HOOK_REFS, removeRetiredHookRefs } from "../hook-ref.js";
import {
  hashContent,
  INSTALL_LOG_DIR,
  INSTALL_LOG_FILENAME,
  type InstallLog,
  type InstallLogAsset,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  installedClis,
  installLogPath,
  LEGACY_INSTALL_LOG_DIR,
  legacyInstallLogPath,
  mergeExternalFiles,
  writeInstallLog,
} from "../install-log.js";
import {
  legacyGitignoreSeed,
  legacySettingsSeed,
  renderSettingsPortion,
  SETTINGS_TARGET,
} from "../install-writes.js";
import { INSTALLED_TRACKS, installedTracksText } from "../installer.js";
import { judge } from "../judge.js";
import { isLegacyHarnessFile, LEGACY_HARNESS_FILES } from "../legacy-fingerprints.js";
import { buildManifest, isCliNeutralTarget, RETIRED_HOOK_WIRING_REFS } from "../manifest.js";
import { type McpJson, type McpServerConfig, toClaudeServer } from "../mcp-merge.js";
import { PRIOR_MCP_SERVERS } from "../mcp-prior.js";
import { renderOpencodeMcp } from "../opencode/opencode-json.js";
import {
  isOutsideProject,
  type OutsideLink,
  outsideLinkAt,
  outsideProjectTarget,
} from "../outside-project.js";
import {
  HARNESS_IMPORT_LINE,
  SCAFFOLD_BANNER_LINES,
  stripHarnessImport,
  upsertHarnessImport,
} from "../project-claude-merge.js";
import {
  bundlePath,
  excludedIds,
  isExcludedPath,
  kindOf,
  ownersOf,
  recorded,
  recordedTrackSpots,
  recordedTrackTargets,
  usersOf,
} from "../recorded.js";
import { ruleHeadings } from "../rules-port.js";
import { type SharedStripResult, stripShared } from "../shared-write.js";
import { detectInstallState, reportNotInstalled } from "../state.js";
import type { TrackRemoval } from "../track-removal.js";
import { trackLeftLines, trackRemoval, trackRemovalNames } from "../track-removal.js";
import { CLI_BASES, type CliBase, isTrack, TRACKS, type Track } from "../types.js";
import { runInteractiveUninstall } from "../uninstall-interactive.js";
import { BACKUP_SCAN_DIRS, BACKUP_SUFFIX, recordedRenderInputs } from "../update-mode.js";
import { defaultHarnessRoot } from "./install.js";

/** `.codex/config.toml` — 하네스 구간(`toml-region`)만 걷는 함께 쓰는 파일. */
const CODEX_CONFIG = ".codex/config.toml";

export interface UninstallOptions {
  projectDir?: string;
  dryRun?: boolean;
  /**
   * v26.169.0 에서 없어졌다(ADR-097 결정 6) — 받으면 아무것도 하지 않고 거절하며 같은 일을 하는 `--only <ids>` 를 알려 준다.
   * 폴더가 더는 통째로 사라지지 않으므로 "남겨 달라" 는 요구 자체가 없어졌다.
   */
  keepTemplates?: boolean;
  /**
   * v26.123.0 (F-1c) — 항목별 제거. 쉼표 구분 자산 id.
   * 지정 시 하네스 파일은 건드리지 않고, 로그도 지우지 않고 **남은 자산으로 다시 쓴다**.
   * cac 는 플래그 반복(`--only a --only b`)을 배열로 전달하므로 둘 다 받는다(#612).
   */
  only?: string | string[];
  /** v26.125.0 — 대화형 선택 화면을 건너뛰고 전량 제거 (비대화형 스크립트용). */
  yes?: boolean;
  /**
   * #528 — **CLI 하나만** 뺀다 (Epic #527 정의 4). 그 CLI 전용 자리와, 그 CLI 가 나가면서
   * 쓰는 쪽이 하나도 안 남는 공유 자리만 회수한다. 자산(`assets`)은 CLI 소속이 아니라 손대지
   * 않고, 설치자 본문은 기존 규칙대로 남는다(루트 `CLAUDE.md` 는 import 블록만 · `AGENTS.md`
   * 는 하네스 절만, #516).
   */
  cli?: string;
  /** #543 — **트랙 하나만** 뺀다. 그 트랙만 가져오는 룰 · 에이전트 · 스킬을 네 CLI 자리에서 회수하고 기록에서 트랙을 뺀다. */
  track?: string;
}

export interface UninstallActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  spawn?: (
    cmd: string,
    args: ReadonlyArray<string>,
    opts: { cwd: string },
  ) => SpawnSyncReturns<string>;
  rm?: (path: string) => void;
  /** `--only` 후 로그 재기록. 실패 경로를 테스트에서 재현하기 위해 주입 가능. */
  writeLog?: (projectDir: string, log: InstallLog) => void;
  /** #516 — `AGENTS.md` 절 경계의 SSOT(템플릿)를 읽을 자리. 테스트는 리포 루트를 주입한다. */
  resolveHarnessRoot?: () => string;
}

/**
 * 미리보기와 결과가 같은 줄을 쓴다 — 둘 다 "남김 + 링크 → 대상". 링크 아래 기록된 하네스 파일도 댄다(#692 리뷰
 * NOTE-1): 전량 uninstall 은 같은 실행에서 기록을 지우므로, 설치자가 손으로 정리할 근거는 이 줄뿐이다.
 */
function keptOutsideLinkLine(o: OutsideLink, log: InstallLog): string {
  const head = `  ${c.yellow("⊘")} ${o.link} — left as is: the link points outside the project (${o.link} → ${o.linkTarget}). Nothing behind it is removed`;
  const files = recordedUnder(log, o.link);
  if (files.length === 0) return `${head}; clean up harness files there by hand if intended.`;
  const shown = files.slice(0, KEPT_LINK_FILES_SHOWN).join(" · ");
  const more =
    files.length > KEPT_LINK_FILES_SHOWN ? ` +${files.length - KEPT_LINK_FILES_SHOWN} more` : "";
  return `${head}; harness files there on record: ${shown}${more} — clean them up by hand if intended.`;
}

const KEPT_LINK_FILES_SHOWN = 3;

/** 기록된 하네스 파일 중 `link` 아래 것(project 상대) — 정책·번들 스킬 기록은 `.claude/` 상대라 접두를 붙인다. */
function recordedUnder(log: InstallLog, link: string): string[] {
  const paths = [
    ...(log.externalFiles ?? []).map((f) => f.path),
    ...(log.portions ?? []).map((p) => p.path),
    ...(log.policyFiles ?? []).map((f) => `.claude/${f.path}`),
    ...(log.skillFiles ?? []).map((f) => `.claude/skills/${f.path}`),
  ];
  return [...new Set(paths.filter((p) => p.startsWith(`${link}/`)))].sort();
}

/**
 * #746 · ADR-097 결정 6 — `--keep-templates` 는 없어졌다. 아무것도 하지 않고 거절하며, 같은 일을 하는 명령을 기록의
 * project-scope 자산 id 로 조립해 알려 준다(스크립트에 그 플래그를 쓰던 설치자가 고칠 줄을 바로 얻는다).
 */
function keepTemplatesRemovedLines(log: InstallLog): string[] {
  const ids = log.assets.filter((a) => a.scope === "project").map((a) => a.id);
  return [
    status.failure(
      c.red(
        "ERROR: --keep-templates was removed in v26.169.0 — harness files are now removed one by one and your own files in .claude/ · .codex/ · .opencode/ stay in place.",
      ),
    ),
    c.dim(
      ids.length > 0
        ? `       To remove only the external assets: agent-harness uninstall --only ${ids.join(",")}`
        : "       nothing on record for --only — run uninstall (everything) or uninstall --cli <name>",
    ),
  ];
}

interface ReverseStep {
  /** 어느 자산의 reverse 인지 — `--only` 성공분만 로그에서 빼기 위해 필요. */
  assetId: string;
  /** 사람이 읽는 라벨 (한 줄) */
  label: string;
  /**
   * 실제 동작 — dry-run 일 때는 호출 안 함. `notes` = 라벨 아래 덧붙일 줄(백업한 파일 · 남긴 파일 — #573).
   */
  execute: () => { ok: boolean; message?: string; notes?: string[] };
}

interface GlobalAdvisory {
  asset: InstallLogAsset;
  /** 사용자에게 안내할 reverse 명령 */
  command: string;
}

/**
 * 크기 예외 사유 (code-style 50줄 상한): 본 함수의 내용은 **단계의 순서와 전제조건 분기**이고,
 * 각 단계는 이미 이름 있는 함수로 빠져 있다 (`planReverse` → `headerLines` → `dryRunLines` |
 * `executeReverse` → `removeHarnessFiles` → `settleLog` → `advisoryLines` → `summarize`).
 * 남은 것은 early return 들(로그 없음 / 없어진 플래그 / 모르는 id / dry-run)과 호출 순서뿐 — 더 쪼개면
 * 그 순서가 흩어진다.
 */
export function uninstallAction(options: UninstallOptions, deps: UninstallActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const spawn = deps.spawn ?? defaultSpawn;
  const rm = deps.rm ?? defaultRm;
  const writeLog = deps.writeLog ?? writeInstallLog;
  const harnessRoot = (deps.resolveHarnessRoot ?? defaultHarnessRoot)();

  const projectDir = resolve(options.projectDir ?? process.cwd());
  // #640 — 깨진 기록(파싱은 되지만 필수 필드 결번)에서 TypeError 스택트레이스로 죽던 경로.
  // #595 — 판정과 문장은 `list` · `update` 와 같은 함수가 낸다.
  const detected = detectInstallState(projectDir);
  const installLog = detected.log;
  if (detected.state !== "installed" || !installLog) {
    reportNotInstalled(detected, projectDir, err);
    exit(1);
    return;
  }

  // #746 — 없어진 플래그는 다른 판정보다 먼저 거절한다(`--cli` 와 섞여도 같다) — 아무것도 바뀌지 않는다
  if (options.keepTemplates) {
    for (const line of keepTemplatesRemovedLines(installLog)) err(line);
    exit(1);
    return;
  }

  // #543 — 트랙 하나만 빼는 경로. `--cli` 와 섞이면 이쪽이 거절한다 · `--yes` 는 무시한다(전량으로 흘리지 않는다)
  if (options.track !== undefined) {
    removeTrackAction(
      { options, installLog, projectDir, harnessRoot },
      { log, err, exit, rm, writeLog },
    );
    return;
  }

  // #528 — CLI 하나만 빼는 경로. 전량 제거와 술어가 달라(표 기반) 이 자리에서 갈린다.
  if (options.cli !== undefined) {
    removeCliAction(
      { options, installLog, projectDir, harnessRoot },
      { log, err, exit, rm, writeLog },
    );
    return;
  }

  const selectedIds = parseOnly(options.only);
  // `--only ,` 처럼 값이 있는데 id 가 하나도 안 나오면 **전량 제거로 흘려보내지 않는다** —
  // 하나만 빼려던 사용자가 하네스 파일까지 잃는다. 무응답보다 명시적 거절이 안전하다.
  if (options.only !== undefined && selectedIds === null) {
    err(status.failure(c.red("ERROR: --only 에 자산 id 가 없다")));
    err(c.dim("       예: --only openspec  (id 는 `agent-harness list` 에서 확인)"));
    exit(1);
    return;
  }
  const unknown = selectedIds ? unknownIds(installLog, selectedIds) : [];
  if (unknown.length > 0) {
    err(status.failure(c.red(`ERROR: not in install log: ${unknown.join(", ")}`)));
    err(c.dim(`       installed: ${installLog.assets.map((a) => a.id).join(", ") || "(none)"}`));
    exit(1);
    return;
  }
  const targetAssets = selectedIds
    ? installLog.assets.filter((a) => selectedIds.includes(a.id))
    : installLog.assets;
  // `--only` 는 자산만 건드린다 — 하네스 파일을 지우면 "하나만 빼기"가 아니게 된다.
  const assetsOnly = selectedIds !== null;

  // v26.124.0 (F-1f) — 남는 루트 파일 안내. `--only` 는 특정 자산만 건드리는 작업이라
  // 설치 전반이 만든 루트 파일은 대상이 아니다. 구 로그(rootFiles 부재)는 빈 배열 = 안내 없음.
  // 함께 쓰는 파일은 걷는 줄이, displaced 자리는 되돌리는 줄이 말하므로 "남는 것" 으로 다시 나열하지 않는다(#569 · #746).
  const rootFiles = withSkillsLock(
    selectedIds
      ? []
      : (installLog.rootFiles ?? []).filter(
          (f) => !UNINSTALL_SHARED.includes(f.path) && f.change !== "displaced",
        ),
    targetAssets,
    projectDir,
  );
  // #644 — 전역 `~/.codex/config.toml` 의 trust 항목은 `--only`(자산만)의 대상이 아니다. 지우지 않고 알리기만 한다(D16).
  const globalTrust = selectedIds ? undefined : installLog.codexTrust;

  // #676 — 지운 것을 셈해 둔다. 중간에 멈추면 이미 한 일을 이 목록으로 말한다.
  const journal: string[] = [];
  let filesRemoved = 0;
  const rmJ = (path: string): void => {
    rm(path);
    filesRemoved += 1;
  };

  const plan = planReverse(targetAssets, { spawn, projectDir, rm: rmJ });
  // #851 (ADR-112) — 옛 update 가 프로젝트에 만든 global 외부 스킬 사본(대상 자산 것만). 미리보기와 실행이 같은 함수다
  const copyIds = selectedIds ? new Set(selectedIds) : undefined;
  for (const line of headerLines(installLog, selectedIds, targetAssets.length)) log(line);

  if (options.dryRun) {
    const copies = reclaimGlobalSkillCopies(projectDir, installLog, { ids: copyIds, write: false });
    for (const line of dryRunLines(
      plan,
      installLog,
      projectDir,
      assetsOnly,
      rootFiles,
      harnessRoot,
      globalTrust,
      copies,
    )) {
      log(line);
    }
    exit(0);
    return;
  }

  // #676 — 되돌릴 수 없는 제거(플러그인 · npm · 스킬 파일)보다 **먼저** 로컬 사전 조건을 본다. 쓸 수 없는 자리가 하나라도
  // 있으면 아무것도 하지 않고 멈춘다 — 앞의 제거만 끝나고 뒤에서 죽으면 반쯤 지운 프로젝트가 남는다.
  const blocked = unwritablePaths({ projectDir, installLog, targetAssets, selectedIds });
  if (blocked.length > 0) {
    err(status.failure(c.red("ERROR: uninstall cannot write here — nothing was removed:")));
    for (const p of blocked) err(c.dim(`       · ${p === "." ? "the project folder" : p}`));
    err(c.dim("       Fix the permissions, then run the same command again."));
    exit(1);
    return;
  }

  // install log 가 남는가 = `--only` 인가 (settleLog: --only 는 재기록, 전량은 삭제 — 되돌리기에 실패한 자산이 있으면 전량도 재기록, #889)
  const logSurvives = selectedIds !== null;

  let reversed: ReturnType<typeof executeReverse>;
  // #780 — `--only` 가 자산을 지운 뒤 되돌린 displaced 자리. 기록 정리는 `settleLog` 가 한다
  let onlyDisplaced: DisplacedOutcome[] = [];
  let copiesRemoved = 0;
  /** #851 — 프로젝트 사본을 회수한 자산 id. `--only` 면 그 자산은 기록에 남는다(홈 사본은 global 그대로). */
  const copiedIds = new Set<string>();
  /** #889 — 전량 실행이 회수한 하네스 파일. 되돌리기에 실패해 기록을 남길 때 `settleLog` 가 회수한 것을 기록에서 뺀다. */
  let harnessDone: HarnessRemoval | null = null;
  try {
    reversed = executeReverse(plan, log, logSurvives, journal);
    const copies = reclaimGlobalSkillCopies(projectDir, installLog, {
      ids: copyIds,
      write: true,
      rm: rmJ,
    });
    for (const r of copies) {
      if (r.removed.length > 0) {
        journal.push(`removed the project copy ${r.slot}`);
        copiedIds.add(r.id);
      }
      copiesRemoved += r.removed.length;
    }
    for (const line of globalCopyLines(copies, false)) log(line);
    if (assetsOnly) {
      const removed = new Set(reversed.removedIds);
      onlyDisplaced = restoreDisplaced(installLog, projectDir, {
        has: inAssetSlots(installLog.assets.filter((a) => removed.has(a.id))),
        write: true,
      });
      for (const d of onlyDisplaced) {
        if (d.verdict === "restore") journal.push(`put back ${d.path}`);
      }
      for (const line of displacedLines(onlyDisplaced, false)) log(line);
    } else {
      const done = removeHarnessFiles(installLog, projectDir, FULL_SCOPE, {
        rm: rmJ,
        write: true,
        harnessRoot,
      });
      harnessDone = done;
      for (const r of done.shared) {
        if (r.removed.length > 0 || r.fileRemoved)
          journal.push(`removed the harness part from ${r.path}`);
      }
      for (const d of done.displaced) {
        if (d.verdict === "restore") journal.push(`put back ${d.path}`);
      }
      for (const line of harnessRemovalLines(done, installLog, projectDir, FULL_SCOPE, false)) {
        log(line);
      }
    }
  } catch (e) {
    // #676 — 사전 조건을 통과하고도 중간에 멈췄다(디스크 가득 · 경합). 이미 한 일을 말하고 기록은 남긴다 — 같은 명령을
    // 다시 돌리면 끝난 단계는 할 일이 없어 지나가고 나머지가 이어진다.
    err(
      status.failure(
        c.red(`ERROR: uninstall stopped partway — ${e instanceof Error ? e.message : String(e)}`),
      ),
    );
    err(c.dim("       Already done:"));
    const done = [...journal, ...(filesRemoved > 0 ? [`removed ${filesRemoved} file(s)`] : [])];
    for (const line of done.length > 0 ? done : ["(nothing)"]) err(c.dim(`         · ${line}`));
    err(
      c.dim(
        `       The install record is kept (${installLogPath(projectDir)}) — fix the cause and run the same command again.`,
      ),
    );
    exit(1);
    return;
  }
  const { succeeded, failed, removedIds, failedIds } = reversed;

  const logWriteFailed = settleLog(
    {
      installLog,
      projectDir,
      selectedIds,
      removedIds,
      failedIds,
      displaced: onlyDisplaced,
      harness: harnessDone,
    },
    { log, err, rm, writeLog },
  );

  // dry-run 과 같은 인자를 넘겨야 미리보기가 실행 결과와 맞는다.
  for (const line of advisoryLines(plan, projectDir, rootFiles, globalTrust)) {
    log(line);
  }

  const outcome = summarize({
    succeeded,
    failed,
    logWriteFailed,
    // 제거된 것도 없고 하네스 파일도 안 건드렸는데, 사용자에게 줄 방법조차 없을 때만 실패다.
    //   ① `--only` = "이걸 빼라"는 특정 요청 — 하나도 못 뺐으면 요청 불이행 (C1).
    //   ② 자동 경로가 없는 자산이 남았으면 — 안내할 명령조차 없다 (R1).
    //   ③ 반면 global 자산만 남은 경우는 **정확한 수기 명령을 출력했으므로** 성공이다.
    //      D16 설계대로의 정상이고, 여기까지 묶으면 global scope 사용자는 exit 0 을 영원히
    //      못 받는다 (로그가 지워져 재시도하면 더 나빠진다).
    nothingDone:
      succeeded === 0 &&
      copiesRemoved === 0 &&
      assetsOnly &&
      (logSurvives || plan.noReversePath.length > 0),
    // #851 — `--only <global 자산>` 이 사본만 지웠으면 그 자산은 남는다 — "0 asset(s)" 만으로 끝내면 요청이 무시된 것처럼 읽힌다
    copiesOnly: assetsOnly ? [...copiedIds].filter((id) => !removedIds.includes(id)) : [],
  });
  log("");
  log(outcome.line);
  exit(outcome.code);
}

/**
 * #676 — 이번 실행이 바꿀 자리 중 쓸 수 없는 것(project 상대, `.` = 프로젝트 폴더). 실행과 같은 대상을 본다:
 * 전량이면 프로젝트 폴더(설치 기록 디렉터리를 지운다) · `--only` 면 설치 기록 폴더 · npm 자산이면 프로젝트 폴더
 * (`package.json`) · 기록된 하네스 파일 · 도구 파일 · displaced 자리는 그 파일이 든 폴더 · 몫을 걷을 함께 쓰는 파일은
 * 그 파일. 프로젝트 밖 링크 너머는 건드리지 않으므로 보지 않는다. 없는 자리는 할 일이 없어 보지 않는다.
 */
function unwritablePaths(ctx: {
  projectDir: string;
  installLog: InstallLog;
  targetAssets: ReadonlyArray<InstallLogAsset>;
  selectedIds: string[] | null;
}): string[] {
  const { projectDir, installLog } = ctx;
  const need = new Set<string>();
  need.add(ctx.selectedIds ? INSTALL_LOG_DIR : ".");
  const project = ctx.targetAssets.filter((a) => a.scope === "project");
  if (project.some((a) => a.method === "npm")) need.add(".");
  const parentOf = (path: string): void => {
    const abs = join(projectDir, path);
    if (!safeExists(abs)) return;
    const real = safeRealpath(abs);
    if (real !== null && isOutsideProject(projectDir, real)) return;
    need.add(dirname(path));
  };
  for (const a of project)
    if (a.method === "skill") for (const f of a.files ?? []) parentOf(f.path);
  if (ctx.selectedIds === null) {
    const recordedShared = new Set((installLog.portions ?? []).map((p) => p.path));
    const made = new Set((installLog.externalFiles ?? []).map((f) => f.path));
    for (const p of UNINSTALL_SHARED) {
      if (recordedShared.has(p) && existsSync(join(projectDir, p))) need.add(p);
      if (made.has(p)) parentOf(p);
    }
    for (const p of harnessCandidates(installLog)) parentOf(p);
    for (const p of legacyFileCandidates()) parentOf(p);
    for (const f of installLog.rootFiles ?? []) if (f.change === "displaced") parentOf(f.path);
    if (hasRootImport(projectDir)) need.add("CLAUDE.md");
  }
  return [...need].filter((p) => {
    try {
      accessSync(join(projectDir, p), fsConstants.W_OK);
      return false;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code !== "ENOENT";
    }
  });
}

/** lstat 기준 존재 — 끊어진 링크도 "있다"(지울 대상이 그 자리에 있다). */
function safeExists(abs: string): boolean {
  try {
    lstatSync(abs);
    return true;
  } catch {
    return false;
  }
}

/**
 * 종료 보고 — **한 일이 없으면 성공이라 하지 않는다.** 이전 판본은 reverse step 이 0개일 때
 * `0 === 0` 이 성공 판정을 통과해 `✓ uninstall complete` + exit 0 을 찍었다 (SOD CRITICAL).
 */
function summarize(r: {
  succeeded: number;
  failed: number;
  nothingDone: boolean;
  logWriteFailed: boolean;
  copiesOnly: ReadonlyArray<string>;
}): { line: string; code: number } {
  if (r.failed > 0)
    return {
      line: c.yellow(`uninstall finished with ${r.failed} skip(s) (${r.succeeded} ok)`),
      code: 1,
    };
  if (r.nothingDone)
    return {
      line: c.yellow("아무것도 자동 제거되지 않았다 — 위 안내를 따라 직접 처리해야 한다"),
      code: 1,
    };
  if (r.logWriteFailed)
    return {
      line: c.yellow("자산은 제거됐으나 install log 를 갱신하지 못했다 (기록이 실제와 다르다)"),
      code: 1,
    };
  const kept =
    r.copiesOnly.length > 0
      ? ` — removed the project copies; ${r.copiesOnly.join(", ")} stays installed globally (see above)`
      : "";
  return {
    line: status.success(c.green(`uninstall complete (${r.succeeded} asset(s))${kept}`)),
    code: 0,
  };
}

function headerLines(
  installLog: InstallLog,
  selectedIds: string[] | null,
  targetCount: number,
): string[] {
  return [
    "",
    c.bold("uzys-agent-harness · uninstall"),
    "",
    c.dim(`  installed: ${installLog.installedAt}`),
    c.dim(`  scope:     ${installLog.scope}`),
    c.dim(
      selectedIds
        ? `  assets:    ${targetCount} selected of ${installLog.assets.length} (--only)`
        : `  assets:    ${installLog.assets.length}`,
    ),
    "",
  ];
}

function executeReverse(
  plan: ReversePlan,
  log: (msg: string) => void,
  logSurvives: boolean,
  journal?: string[],
): { succeeded: number; failed: number; removedIds: string[]; failedIds: string[] } {
  let succeeded = 0;
  let failed = 0;
  const removedIds: string[] = [];
  const failedIds: string[] = [];
  for (const step of plan.reverseSteps) {
    const result = step.execute();
    if (result.ok) {
      log(`  ${status.success(step.label)}`);
      removedIds.push(step.assetId);
      journal?.push(`removed ${step.assetId}`);
      succeeded++;
    } else {
      log(`  ${c.yellow("⊘")} ${step.label}  (${result.message ?? "failed"})`);
      failedIds.push(step.assetId);
      failed++;
    }
    for (const note of result.notes ?? []) log(c.dim(`    ↳ ${note}`));
  }
  // #889 — 되돌리기에 실패한 자산이 있으면 전량 실행도 기록을 남긴다(`settleLog`) — 그때는 이 자산들도 기록에 남는다
  for (const line of noReverseLines(plan, logSurvives || failed > 0)) log(line);
  return { succeeded, failed, removedIds, failedIds };
}

/**
 * 자동 되돌리기 경로가 없는 자산은 **말한다.** 조용히 넘기면 `uninstall complete` 가 아무것도 안 한 실행에 붙어 거짓 보고가
 * 된다 (no-false-ship). "기록 유지"는 **기록이 남을 때만** 참이다 — 실행과 미리보기(#883)가 이 함수 하나로 같은 말을 한다.
 */
function noReverseLines(plan: ReversePlan, recordKept: boolean): string[] {
  const tail = recordKept ? "자동 되돌리기 경로 없음, 기록 유지" : "자동 되돌리기 경로 없음";
  return plan.noReversePath.flatMap((asset) => [
    `  ${c.yellow("⊘")} ${asset.id} (${asset.method}) — ${tail}`,
    ...(plan.hints.get(asset.id) ?? []).map((hint) => c.dim(`    ↳ ${hint}`)),
  ]);
}

/** 제거 후 로그 처리. @returns 재기록에 실패했는가 (실패해도 uninstall 을 죽이지 않는다). */
function settleLog(
  ctx: {
    installLog: InstallLog;
    projectDir: string;
    selectedIds: string[] | null;
    removedIds: string[];
    /** #889 — 되돌리기에 실패한 자산. 하나라도 있으면 전량 실행도 기록을 지우지 않고 남은 것으로 다시 쓴다. */
    failedIds: string[];
    /** #780 — `--only` 가 되돌린 displaced 자리. 되돌렸거나 백업이 없는 것은 기록에서 뺀다. */
    displaced: ReadonlyArray<DisplacedOutcome>;
    /** #889 — 전량 실행이 회수한 하네스 파일(`--only` 면 `null`). 기록을 남길 때 회수한 것을 기록에서도 뺀다. */
    harness: HarnessRemoval | null;
  },
  io: {
    log: (msg: string) => void;
    err: (msg: string) => void;
    rm: (path: string) => void;
    writeLog: (projectDir: string, log: InstallLog) => void;
  },
): boolean {
  const { installLog, projectDir, selectedIds, removedIds, failedIds } = ctx;
  if (selectedIds || failedIds.length > 0) {
    // v26.123.0 (F-1c) — 로그를 지우는 게 아니라 **되돌린 것만 빼고 다시 쓴다**.
    // 실패한 항목은 남긴다 — 실제로 안 지워진 걸 기록에서 지우면 그게 곧 거짓 기록이다.
    // #889 — 전량 실행도 같다: 실패한 자산이 있는데 기록을 지우면 그 자산을 뺄 길(같은 명령 · `--only`)이 영영 사라진다.
    const remaining = installLog.assets.filter((a) => !removedIds.includes(a.id));
    const next = selectedIds
      ? {
          ...installLog,
          assets: remaining,
          // #780 — 원본 기록의 `rootFiles` 에 건다(N13-3 — 화면용으로 비운 `--only` 의 루트 파일 목록과 섞지 않는다)
          ...(ctx.displaced.some((d) => d.forget)
            ? { rootFiles: withoutRestored(installLog.rootFiles, ctx.displaced) }
            : {}),
        }
      : afterFullRemoval({ ...installLog, assets: remaining }, ctx.harness);
    try {
      io.writeLog(projectDir, next);
      if (selectedIds) {
        io.log(`  ${status.success(`install log updated (${remaining.length} asset(s) remain)`)}`);
      } else {
        for (const line of recordKeptLines(failedIds)) io.log(line);
      }
    } catch (e) {
      // 되돌리기는 이미 끝난 뒤다 — 스택트레이스로 죽으면 무엇이 지워졌는지도 사라진다.
      io.err(status.failure(c.red(`ERROR: install log 갱신 실패 — ${installLogPath(projectDir)}`)));
      io.err(c.dim(`       ${e instanceof Error ? e.message : String(e)}`));
      io.err(c.dim(`       실제로 제거된 자산: ${removedIds.join(", ") || "(없음)"}`));
      return true;
    }
  } else {
    // v26.135.0 (#253) — 로그가 `.claude/` 밖으로 나왔다 — **templates 보존 여부와 무관하게** 여기서 지운다.
    // #812 — 폴더째 지우지 않는다: 헬퍼(`*.sh`)는 다른 하네스 파일처럼 `removeHarnessFiles` 가 파일 하나씩 회수했고(고친 것은
    // 그 파일 하나를 백업 · displaced 는 되돌림), 여기서는 기록과 런타임 파일만 지운 뒤 빈 폴더를 걷는다. 남는 것(백업 ·
    // 되돌린 설치자 파일)이 있으면 폴더도 남는다. 밖으로 나가는 링크면 예전처럼 링크만 걷는다(그 너머는 이 프로젝트 것이 아니다)
    const recordDir = join(projectDir, INSTALL_LOG_DIR);
    if (outsideLinkAt(projectDir, INSTALL_LOG_DIR) !== null) io.rm(recordDir);
    else {
      for (const rel of RECORD_FILES) io.rm(join(projectDir, rel));
      pruneEmptyDirsUpward(projectDir, recordDir);
    }
    // v26.134.1 이하로 설치한 프로젝트의 잔재. `.claude/` 는 설치자 파일과 함께 남으므로(#746) 여기서 안 지우면 다음
    // 실행이 그 구 파일을 읽어 **이미 지운 자산을 다시 보고**한다.
    // #692 — `.claude` 가 밖으로 나가는 링크면 그 폴더는 남는다 — 그 너머의 옛 기록은 이 프로젝트 것이라 할 수 없다.
    if (outsideLinkAt(projectDir, LEGACY_INSTALL_LOG_DIR) === null) {
      io.rm(legacyInstallLogPath(projectDir));
      // 그 파일 하나 때문에 남아 있던 빈 `.claude/` 도 걷는다(비어 있을 때만)
      pruneEmptyDirsUpward(projectDir, join(projectDir, LEGACY_INSTALL_LOG_DIR));
    }
    io.log(`  ${status.success("install log removed")}`);
  }
  return false;
}

/**
 * #889 — 전량 실행이 기록을 남길 때의 다음 판. 하네스 파일 · 함께 쓰는 파일의 몫 기록은 **그대로 둔다** — 같은 명령을 다시 돌리면
 * 없는 파일 · 이미 걷은 몫은 할 일이 없어 지나가고(#676 과 같은 계약), update 는 평소처럼 "was missing — restored" 로 다시 깐다
 * (회차 1 — 회수분까지 빼면 update 가 그 몫을 "안 깐 것" 으로 읽어 Codex 설정 · 훅 없이 성공했다).
 *
 * 빼는 것은 **설치자 파일만 남은 자리**의 기록뿐이다: 정리한 displaced 줄(`withoutRestored` 와 같은 `forget`)과 그 자리의 하네스
 * 파일 기록(앵커 포함), 하네스 절을 걷어 설치자 절만 남긴 `AGENTS.md`(`--cli` 의 `forgetRemoved` 도 그 기록을 뺀다). 남겨 두면
 * 재실행이 그 파일을 "고친 하네스 판" 으로 읽어 백업 이름으로 치우거나 "modified since install — Remove manually" 라고 말한다.
 */
function afterFullRemoval(next: InstallLog, done: HarnessRemoval | null): InstallLog {
  if (done === null) return next;
  const back = new Set([
    ...done.displaced.filter((d) => d.forget).map((d) => d.path),
    ...done.stripped,
    ...done.legacyAgentsMd.filter((l) => !l.fileRemoved).map((l) => l.path),
  ]);
  if (back.size === 0) return next;
  const out: InstallLog = { ...next, rootFiles: withoutRestored(next.rootFiles, done.displaced) };
  const stays =
    (prefix: string) =>
    (f: { path: string }): boolean =>
      !back.has(`${prefix}${f.path}`);
  if (out.policyFiles !== undefined) out.policyFiles = out.policyFiles.filter(stays(CLAUDE_DIR));
  if (out.skillFiles !== undefined) out.skillFiles = out.skillFiles.filter(stays(SKILLS_DIR));
  if (out.externalFiles !== undefined) out.externalFiles = out.externalFiles.filter(stays(""));
  const anchor = out.templates.rootClaudeMd;
  if (anchor !== undefined && back.has(anchor.path)) {
    out.templates = { ...out.templates }; // 원본 기록의 객체를 고치지 않는다
    delete out.templates.rootClaudeMd;
  }
  return out;
}

/** #889 — 기록을 남긴 전량 실행의 화면 줄. 무엇이 남았는지와 이어 가는 명령을 말한다(같은 명령 · 그 자산만 빼는 `--only`). */
function recordKeptLines(failedIds: ReadonlyArray<string>): string[] {
  const ids = failedIds.join(", ");
  return [
    `  ${c.yellow("⊘")} install log kept (${INSTALL_LOG_DIR}/${INSTALL_LOG_FILENAME}) — not removed: ${ids}`,
    c.dim(
      `    ↳ fix the cause above, then run the same command again — or only those: agent-harness uninstall --only ${failedIds.join(",")}`,
    ),
  ];
}

/** dry-run 미리보기 — 실행 경로와 같은 판정을 쓴다 (미리보기가 실제와 어긋나면 미리보기가 아니다). */
function dryRunLines(
  plan: ReversePlan,
  installLog: InstallLog,
  projectDir: string,
  assetsOnly: boolean,
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  harnessRoot: string,
  globalTrust: InstallLog["codexTrust"],
  copies: ReadonlyArray<GlobalCopyReclaim>,
): string[] {
  const lines = [c.yellow("[DRY RUN] reverse list (실제 변경 없음):"), ""];
  if (plan.reverseSteps.length === 0 && copies.length === 0) {
    lines.push(c.dim("  (no project-scope assets to reverse)"));
  }
  lines.push(...plan.reverseSteps.map((s) => `  ○ ${s.label}`));
  lines.push(...globalCopyLines(copies, true));
  // #607 — 실제 실행이 수행하는 단계는 전부 미리보기에 있어야 한다. 마지막 단계인
  // 설치 기록 디렉터리 제거가 빠져 있어 "전체 역순 단계"를 보고 승인한 사용자가
  // 실제 실행에서 겪는 변화가 계획보다 하나 많았다.
  // #812 — 헬퍼 스크립트는 위 하네스 파일 줄이 센다(고친 것은 백업) — 여기는 기록 · 런타임 파일뿐이다
  // #883 — `--only` 는 기록을 지우지 않고 남은 자산으로 다시 쓴다(`settleLog`) — 실행이 낼 그 줄을 미리 말한다.
  // 미리보기는 계획된 단계를 다 성공한 것으로 친다(`plannedAssets`)
  lines.push(
    assetsOnly
      ? `  ○ install log updated (${installLog.assets.length - plannedAssets(plan, installLog).length} asset(s) remain)`
      : "  ○ remove install record (.uzys-agent-harness/ — 설치 기록·차단 로그·update 백업 목록)",
  );
  lines.push(...noReverseLines(plan, assetsOnly));
  if (!assetsOnly) {
    // 실행과 같은 함수를 쓰지 않고 판정한다(write: false) — 미리보기가 말한 것과 실행 결과가 같다
    const preview = removeHarnessFiles(installLog, projectDir, FULL_SCOPE, {
      rm: () => {},
      write: false,
      harnessRoot,
      assetFilesGone: plannedAssetFiles(plan, installLog),
    });
    // 회수할 사본은 위 줄이 말했다 — "남는 설치자 파일" 로 다시 세지 않는다
    const copyFiles = copies.flatMap((r) => r.removed);
    lines.push(
      ...harnessRemovalLines(preview, installLog, projectDir, FULL_SCOPE, true, copyFiles),
    );
  } else {
    // #780 — `--only` 도 그 자산이 비켜 둔 설치자 파일을 되돌린다. 실행과 같은 함수로 판정한다
    const preview = restoreDisplaced(installLog, projectDir, {
      has: inAssetSlots(plannedAssets(plan, installLog)),
      willBeGone: new Set(plannedAssetFiles(plan, installLog)),
      write: false,
    });
    lines.push(...displacedLines(preview, true));
  }
  lines.push(...advisoryLines(plan, projectDir, rootFiles, globalTrust), "");
  return lines;
}

/** global(D16) + 루트 파일 안내. dry-run 과 실행 경로가 같은 함수를 쓴다. */
function advisoryLines(
  plan: ReversePlan,
  projectDir: string,
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  globalTrust?: InstallLog["codexTrust"],
): string[] {
  const lines: string[] = [];
  if (globalTrust) {
    // #644 — 홈 파일은 설치자 것이다: 지우지 않고 어느 항목인지만 알린다. 전에는 이 항목이 어디에도 안 나와,
    // 폴더 이름을 바꾼 뒤 옛 경로 항목이 다른 프로젝트를 자동 신뢰하는 채로 쌓였다.
    lines.push(
      "",
      c.yellow("[GLOBAL] Codex trust entry — remove by hand (never deleted automatically):"),
      c.dim(`  · ${globalTrust.configPath}`),
      c.dim(`      [projects.${tomlBasicString(globalTrust.projectDir)}]`),
    );
  }
  if (plan.globalAdvisories.length > 0) {
    lines.push(
      "",
      c.yellow(
        `[GLOBAL] ${plan.globalAdvisories.length} asset(s) at scope=global — manual removal required (D16):`,
      ),
    );
    for (const adv of plan.globalAdvisories) {
      lines.push(c.dim(`  · ${adv.asset.id} (${adv.asset.method})`), c.dim(`      ${adv.command}`));
    }
  }
  // 하네스 파일을 회수한 뒤에도 남는 루트 파일 — 말하지 않으면 사용자가 존재조차 모른다. 그게 F-1f 가 잡는 구멍이다.
  lines.push(...rootFileAdvisoryLines(rootFiles, projectDir));
  // #570 — 하네스가 남긴 백업 산물(디렉터·파일) 공지. 색인(설치 기록 · update 백업 목록)은 이번에
  // 지워지므로, 남는 실물을 말하지 않으면 정체를 알 방법이 없다.
  lines.push(...backupArtifactAdvisoryLines(projectDir));
  return lines;
}

/**
 * v26.124.0 (F-1f) — `.claude/` 밖에 남는 것 안내. **지우지 않는다**:
 * `.mcp.json`/`.gitignore` 는 사용자 내용이 섞이고, `.github/workflows/` 는 설치 후 사용자
 * 소유물이다 (ci-scaffold.ts 안전 계약 2). 기계적 되돌리기는 손실 위험이라 안내로 넘긴다.
 *
 * 규율: **예측이 아니라 현재 파일 상태를 읽어** 실재하는 것만 낸다.
 */

/**
 * #570 — 전량 uninstall 후 남을 백업 산물을 나열한다. 지우지 않는다(사용자 편집분이 들어 있을 수 있다) — "자동으로 지우지
 * 않는다" 규칙의 백업 판. 대상: 루트의 `<dir>.backup-<ts>` 디렉터리(옛 판이 만든 것 — 설치자 것이다) + 루트 파일 백업 +
 * 하네스가 쓰는 디렉터리(update 와 같은 집합 `BACKUP_SCAN_DIRS` — `.claude/` · `.codex/` · `.agents/` …) 안의 파일 백업
 * (update 가 편집분을 보존하며 남긴 것 · 이번 uninstall 이 고친 파일을 지우기 전에 남긴 것 — #746).
 */
function backupArtifactAdvisoryLines(projectDir: string): string[] {
  const found: string[] = [];
  for (const e of readdirSync(projectDir, { withFileTypes: true })) {
    if (CLI_FOLDERS.some((d) => e.name.startsWith(`${d}.backup-`))) {
      found.push(e.name);
    } else if (e.isFile() && BACKUP_SUFFIX.test(e.name)) {
      found.push(e.name);
    }
  }
  for (const dir of BACKUP_SCAN_DIRS) {
    const abs = join(projectDir, dir);
    // ADR-098 — 밖으로 나가는 링크 너머는 이 프로젝트 것이 아니다
    if (!existsSync(abs) || outsideLinkAt(projectDir, dir) !== null) continue;
    for (const rel of listFilesRecursive(abs)) {
      if (BACKUP_SUFFIX.test(rel)) found.push(`${dir}/${rel}`);
    }
  }
  if (found.length === 0) return [];
  return [
    c.yellow(
      `[BACKUPS] 하네스가 남긴 백업 ${found.length}건 (자동으로 지우지 않는다 — 내용 확인 후 삭제):`,
    ),
    ...found.sort().map((f) => c.dim(`  ${f}`)),
  ];
}

function rootFileAdvisoryLines(
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  projectDir: string,
): string[] {
  const header = "[ROOT] `.claude/` 밖에 남는 것 (자동으로 지우지 않는다):";
  const present = rootFiles.filter((f) => existsSync(join(projectDir, f.path)));
  if (present.length === 0) return [];
  // #694 — 프로젝트 밖으로 나가는 링크 너머 파일은 "삭제해도 안전" 으로 나열하지 않는다. 공유 dotfiles 면 다른
  // 프로젝트의 설정이다 — 링크 자리 하나로 묶어 남김 + 링크 → 대상을 말한다(ADR-098 · #692 와 같은 판정).
  const outside = new Map<string, { link: OutsideLink; files: string[] }>();
  const inside = present.filter((f) => {
    const o = outsideProjectTarget(projectDir, join(projectDir, f.path));
    if (o === null) return true;
    const group = outside.get(o.link) ?? { link: o, files: [] };
    group.files.push(f.path);
    outside.set(o.link, group);
    return false;
  });
  return [
    "",
    c.yellow(header),
    ...[...outside.values()].map(({ link: o, files }) =>
      c.dim(
        `  · ${o.link} — left as is: the link points outside the project (${o.link} → ${o.linkTarget}); harness files there: ${files.join(" · ")} (other projects linked to it may use them)`,
      ),
    ),
    ...inside.flatMap((f) => [
      c.dim(`  · ${f.path} — ${rootFileMeaning(f, projectDir)}`),
      // displaced 의 notes 는 백업 경로 하나 — 위 줄이 이미 댔다
      ...(f.change !== "displaced" && f.notes.length > 0
        ? [c.dim(`      ${f.notes.join(" / ")}`)]
        : []),
    ]),
  ];
}

/**
 * 루트 파일 기록 한 줄의 뜻 — `rootFiles.change` 넷(#551 ADR-097: advisory · displaced 가 더해졌다).
 * displaced 의 `notes[0]` 은 비켜 둔 설치자 원본의 백업 경로다 — 실재할 때만 그 자리를 댄다.
 */
function rootFileMeaning(f: InstallLogRootFile, projectDir: string): string {
  // #610 — 하네스가 아니라 `npx skills` 가 쓰는 잠금 파일이다. 하네스는 남의 도구 파일 내용을 고치지 않는다
  if (f.path === SKILLS_LOCK) {
    return "written by npx skills (not the harness) — it may still list the skills just removed; the harness does not edit it. Delete it if you no longer use npx skills";
  }
  // #569 — 스캐폴드(`.env.example` · `.github/workflows/*`)는 쓰는 순간 설치자 것이다(결정 7). 옛 로그는 `created` 로
  // 적었다 — 기록 값이 아니라 경로로 가른다(`kindOf`). "지워도 안전" 이라 해 놓고 안 지우던 말을 바로잡는다
  if (f.change !== "displaced" && kindOf(null, f.path) === "advisory") {
    return "yours now — a scaffold the harness handed over; it is never removed";
  }
  switch (f.change) {
    case "created":
      return "하네스가 생성 (수정한 적 없으면 삭제해도 안전)";
    case "modified":
      return "기존 사용자 파일에 병합 (직접 확인 필요)";
    case "advisory":
      return "넘겨준 파일 — 이제 설치자 것 (지우지 않는다)";
    case "displaced": {
      const backup = f.notes[0];
      if (backup === undefined) return "하네스 판과 같은 설치자 파일이 있던 자리 (그대로 두었다)";
      return existsSync(join(projectDir, backup))
        ? `하네스가 쓴 자리 — 원래 있던 설치자 파일은 ${backup} 에 있다`
        : `하네스가 쓴 자리 — 원래 있던 설치자 파일의 백업(${backup})이 더는 없다`;
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * #528 — `uninstall --cli <name>`: CLI 하나만 뺀다 (Epic #527 정의 4)
 *
 * 전량 제거와 술어가 다르다. 전량은 "기록에 있는 것 전부"지만 여기서는 **소유 표**가 정한다
 * (`cli-ownership.ts`): 전용 자리는 무조건, 공유 자리는 **남는 CLI 중 쓰는 쪽이 하나도 없을
 * 때만**. 지우는 절차 자체는 전량 경로의 함수를 그대로 쓴다 — `removeExternalFiles`(sha 소유
 * 판정 + #516 `AGENTS.md` 절 걷어내기 — `removeHarnessFiles`) · `stripRootImport` · `removeAnchor`. 여기서
 * 판정을 새로 쓰면 그게 곧 두 번째 사본이고, 사본이 갈리면 설치자 파일이 사라진다.
 * ──────────────────────────────────────────────────────────────────────────── */

interface RemoveCliCtx {
  options: UninstallOptions;
  installLog: InstallLog;
  projectDir: string;
  harnessRoot: string;
}

interface RemoveCliIo {
  log: (msg: string) => void;
  err: (msg: string) => void;
  exit: (code: number) => never;
  rm: (path: string) => void;
  writeLog: (projectDir: string, log: InstallLog) => void;
}

/** CLI → 그 CLI 를 뺄 때 함께 지워야 할 `templates` 필드. antigravity 는 그 기록이 없다. */
const TEMPLATE_DIR_FIELD: Partial<Record<CliBase, "claudeDir" | "codexDir" | "opencodeDir">> = {
  claude: "claudeDir",
  codex: "codexDir",
  opencode: "opencodeDir",
};

/**
 * 전제조건 검사. **아무것도 실행하기 전에** 전부 본다 (`--only` 의 pre-flight 와 같은 규율) — 절반만 지우고 거절하면 되돌릴 방법이
 * 없다. `--cli` · `--track` 이 같은 순서로 본다(#543). @returns 뺄 대상. `null` 이면 이미 `exit` 했다.
 */
function resolveScopeTarget<T extends string>(
  io: RemoveCliIo,
  s: {
    flag: "cli" | "track";
    value: unknown;
    conflict: boolean;
    vocab: ReadonlyArray<T>;
    installed: ReadonlyArray<string>;
  },
): T | null {
  const reject = (msg: string, hint: string): null => {
    io.err(status.failure(c.red(`ERROR: ${msg}`)));
    io.err(c.dim(`       ${hint}`));
    io.exit(1);
    return null;
  };
  if (s.conflict) {
    return reject(
      `--${s.flag} 는 --only · --cli · --track 중 하나만 쓸 수 있다`,
      "CLI 하나: uninstall --cli <name>  /  트랙 하나: uninstall --track <name>  /  자산: uninstall --only <id>",
    );
  }
  const target = String(s.value ?? "").trim();
  if (!(s.vocab as ReadonlyArray<string>).includes(target)) {
    return reject(
      `Invalid --${s.flag} value: ${target || "(empty)"}`,
      `Must be one of: ${s.vocab.join(" | ")}`,
    );
  }
  if (!s.installed.includes(target)) {
    return reject(
      `${target} is not installed in this project`,
      `installed: ${s.installed.join(", ") || "(none)"}`,
    );
  }
  // 마지막 하나는 거절한다 — 전량 삭제 경로를 두 개 두면 한쪽만 고쳐지는 날이 온다.
  if (s.installed.length <= 1) {
    return reject(
      `${target} 는 이 프로젝트의 마지막 ${s.flag === "cli" ? "CLI 다" : "트랙이다"}`,
      "전량 제거는 `agent-harness uninstall` 을 쓴다 (자산·설치 기록까지 함께)",
    );
  }
  return target as T;
}

/** 이 경로가 회수 대상 자리에 속하는가. `/` 로 끝나는 항목은 접두 디렉터리다. */
function underAny(path: string, owned: ReadonlyArray<string>): boolean {
  return owned.some((o) => (o.endsWith("/") ? path.startsWith(o) : path === o));
}

/** 회수 대상을 `kind` 별로 나눈 것 — dry-run 과 실행이 같은 목록을 읽는다. */
interface CliRemovalPlan {
  /** 빼는 CLI. */
  target: CliBase;
  /**
   * 회수 범위 — 소유 표의 `recorded` 자리(전용 + 마지막 사용자가 된 공유). 전량과 **같은 함수**(`removeHarnessFiles`)에 이
   * 범위만 넘긴다 — 함께 쓰는 파일은 몫만(B1) · 링크 슬롯은 기록만 정리(B4) · 빈 뼈대 걷기(B2) 규칙이 그대로 든다.
   */
  scope: RemovalScope;
  /** #769 — 표로는 범위 안이지만 남는 CLI 가 쓰고 있어(`usersOf` — 링크 슬롯의 본문) 남기는 하네스 기록 자리(슬롯 단위). */
  kept: string[];
}

function planCliRemoval(
  target: CliBase,
  remaining: ReadonlyArray<CliBase>,
  log: InstallLog,
  projectDir: string,
): CliRemovalPlan {
  const { exclusive, sharedNowUnowned } = removableFor(target, remaining);
  const owned = [...exclusive, ...sharedNowUnowned];
  // 앵커 자리도 범위에 든다 — 그 자리를 하네스가 빌렸으면(`displaced`) 앵커를 지운 뒤 되돌린다
  const prefixes = owned
    .filter((o) => o.kind === "recorded" || o.kind === "anchor")
    .map((o) => o.path);
  // #769 — 남는 CLI 가 실제로 쓰는 자리는 회수하지 않는다(남는 claude 의 링크 슬롯이 가리키는 `.agents/skills/<id>` 본문)
  const used = (path: string): boolean =>
    usersOf(path, projectDir).some((cli) => remaining.includes(cli));
  const has = (path: string): boolean => underAny(path, prefixes) && !used(path);
  const kept = harnessCandidates(log)
    .filter((p) => underAny(p, prefixes) && used(p))
    .map((p) => p.split("/").slice(0, 3).join("/"));
  return {
    target,
    kept: [...new Set(kept)].sort(),
    scope: {
      has,
      // `.claude/settings.json` 은 claude 의 `.claude/` 아래 · `.codex/config.toml` 은 codex 의 `.codex/` 아래 · `AGENTS.md` ·
      // `opencode.json` 은 마지막 사용자일 때만 표에 든다. `.mcp.json`(`keep`) · `.gitignore` 는 CLI 하나로 빠지지 않는다
      shared: UNINSTALL_SHARED.filter(has),
      // claude 를 뺄 때 `.claude/` 아래 다섯 — `docs/decisions` 는 CLI 소속이 아니다
      skeleton: PROJECT_SKELETON_DIRS.filter(has),
      folders: CLI_FOLDERS.filter((d) => has(`${d}/`)),
      importBlock: owned.some((o) => o.kind === "import-block"),
      anchor: owned.some((o) => o.kind === "anchor"),
    },
  };
}

/** #769 — 남는 CLI 가 쓰고 있어 남긴 하네스 기록 자리를 한 줄로(없으면 말하지 않는다). */
function keptForRemainingLines(plan: CliRemovalPlan, preview: boolean): string[] {
  if (plan.kept.length === 0) return [];
  const what = `${plan.kept.join(" · ")} — still used by Claude Code through its .claude/skills/ link(s)`;
  return [preview ? `  ○ leave ${what}` : `  ${c.yellow("⊘")} left  ${what}`];
}

function displayNames(clis: ReadonlyArray<CliBase>): string {
  return clis.map((c) => CLI_DISPLAY_NAMES[c]).join(" · ");
}

/**
 * C-3 (#642) — `uninstall --cli <x>` 뒤 `AGENTS.md` 를 남는 집합으로 다시 렌더할 집합. 빠지는 CLI 의 몫(제목의 이름 ·
 * `## Session Start` · 안내 문단)은 절이 아니라 문장 단위로 섞여 있어 strip 으로 표현되지 않는다 — 남는 집합으로 다시
 * 렌더하는 것이 그 몫만 빼는 가장 단순한 구현이다(설치자 절은 `mergeAgentsMd` 가 잇는다).
 *
 * 조건: 빠지는 CLI 가 이 파일을 읽었고 · 남는 집합에 읽는 CLI 가 있고(없으면 회수 경로 — #516) · 파일이 하네스 기록에
 * 있다(절 모델 `externalFiles` 또는 블록 모델 `portions`) · 파일이 있다. 기록 밖 파일에는 몫을 새로 더하지 않는다.
 */
function agentsMdRerenderSet(
  target: CliBase | null,
  remaining: ReadonlyArray<CliBase>,
  log: InstallLog,
  projectDir: string,
): CliBase[] | null {
  // #543 — 트랙 제거(`null`)는 읽는 CLI 가 있으면 늘 다시 렌더한다(인라인 룰 · 상시 스킬 안내가 트랙을 따른다)
  if (target !== null && !isAgentsMdCli(target)) return null;
  const set = agentsMdClis(remaining);
  if (set.length === 0) return null;
  const recorded =
    (log.externalFiles ?? []).some((f) => f.path === AGENTS_MD) ||
    (log.portions ?? []).some((p) => p.path === AGENTS_MD);
  if (!existsSync(join(projectDir, AGENTS_MD))) return null;
  // #774 (N13-7) — 기록 없는 옛 판의 하네스 `AGENTS.md`(머리 지문)도 다시 렌더한다 — 안 그러면 옛 파일 전체가 남는다
  if (!recorded && !isLegacyHarnessAgentsMd(readTextOrEmpty(join(projectDir, AGENTS_MD)))) {
    return null;
  }
  return set;
}

function readTextOrEmpty(abs: string): string {
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return "";
  }
}

/**
 * C-3 실행 — update 와 **같은 입력**(`recordedRenderInputs` · 기록의 기준선 · 몫)으로 렌더한다. 그래야 다음 update 가 같은
 * 바이트를 내고 조용하다(독립 검증 NOTE-8 — C-T3 의 "이어서 update 해도 백업 0건" 이 그 대조다).
 * #543 — 입력은 **이번에 쓸 기록**(`log`)이다 — 디스크의 기록은 빠지는 트랙을 아직 들고 있다(설계 검증 NOTE 1, 상시 스킬 안내도).
 */
function rerenderAgentsMd(
  ctx: RemoveCliCtx,
  set: ReadonlyArray<CliBase>,
  log: InstallLog,
): AgentsMdTransformReport {
  const { projectDir, harnessRoot } = ctx;
  return runAgentsMdTransform({
    harnessRoot,
    projectDir,
    clis: agentsMdClis(set),
    ...recordedRenderInputs(projectDir, log, log.spec.tracks.filter(isTrack)),
    baseline: new Map((log.externalFiles ?? []).map((f) => [f.path, f.sha256])),
    refreshOnly: true,
    installedByRecord: true,
    shared: { portions: log.portions ?? [], excluded: [...excludedIds(log)] },
    log,
  });
}

/** 재렌더 결과를 기록에 싣는다 — 안 실으면 다음 update 가 방금 쓴 바이트를 "설치자가 고쳤다" 로 읽어 백업한다(#550 형태). */
function withRerender(next: InstallLog, r: AgentsMdTransformReport): InstallLog {
  const out: InstallLog = { ...next };
  const files = mergeExternalFiles(next.externalFiles, r.ownership.files);
  if (files.length > 0) out.externalFiles = files;
  const block = r.agentsMd.shared;
  // #774 (N2) — 블록 모델이던 옛 하네스 파일을 절 모델로 바꿨으면 그 파일의 몫 기록은 빈다
  const blockPortions =
    block !== null && block.portions !== null
      ? block.portions
      : r.agentsMd.blockRecordDropped === true
        ? []
        : null;
  if (blockPortions !== null) {
    const portions = [
      ...(next.portions ?? []).filter((p) => p.path !== AGENTS_MD),
      ...blockPortions,
    ];
    if (portions.length > 0) out.portions = portions;
    else delete out.portions;
  }
  return out;
}

function rerenderLines(r: AgentsMdTransformReport): string[] {
  const names = displayNames(r.clis);
  const lines =
    r.agentsMd.model === "block"
      ? [`  ${status.success(`AGENTS.md — harness block re-rendered for ${names} (yours stays)`)}`]
      : [`  ${status.success(`AGENTS.md — re-rendered for ${names} (your sections kept)`)}`];
  for (const b of r.ownership.backedUp) {
    lines.push(
      `  ${c.yellow("⊘")} ${b} — changed since the harness last wrote it; saved a copy as ${b}.backup-<time> · your sections are kept`,
    );
  }
  return lines;
}

/**
 * 제거 후 로그. `assets` 는 손대지 않는다 — 자산은 CLI 소속이 아니다(스킬 자리는 표가 본다). `assets[].files` 도 그대로 두어
 * 남은 자산을 `--only <id>` 로 뺄 수 있다(A1 · N8 — 폴더째 옮기던 때는 그 기록도 지웠다).
 *
 * **뺀 CLI 의 흔적은 기록에서도 함께 뺀다.** 남겨 두면 기록이 디스크와 다른 말을 하고, 그
 * 값을 읽는 쪽이 이미 있다: `external-installer.ts` 는 `spec.cli` 를 외부 스킬 refresh 의
 * 대상 CLI 로 쓴다 — 방금 뺀 CLI 를 대상으로 지정하게 된다(독립 리뷰 N2). 회수한 하네스 파일
 * (`removeHarnessFiles` 의 `forgotten`)의 기록도 같은 이유로 지운다.
 */
function settleCliLog(
  ctx: RemoveCliCtx,
  target: CliBase,
  remaining: ReadonlyArray<CliBase>,
  done: HarnessRemoval,
  anchorRemoved: boolean,
): InstallLog {
  const { installLog } = ctx;
  const next: InstallLog = {
    ...installLog,
    spec: {
      ...installLog.spec,
      // `spec.cli` 는 손대지 않는다 — "마지막 install 이 요청한 CLI" 라는 뜻이고, 빼면 빈 배열이
      // 된다(재리뷰 BLOCKER-3: 외부 스킬 refresh 가 그 값으로 `--agent`·`--copy` 를 조립하다
      // 빈 배열이면 둘 다 빠져 Claude 몫이 조용히 빠졌다). 깔린 집합은 `clis` 하나가 말한다.
      clis: [...remaining],
    },
    templates: { ...installLog.templates },
  };
  const field = TEMPLATE_DIR_FIELD[target];
  if (field) delete next.templates[field];
  if (anchorRemoved) delete next.templates.rootClaudeMd;
  // #746 — claude 를 빼면 `.claude/` 정책 · 스킬 기록은 통째로 빠진다: 회수했거나 · 기록 밖 설치자 파일로 남겼거나 · 링크 슬롯이라
  // 하네스 자리가 아니다. 남겨 두면 나중에 설치자가 같은 자리에 둔 같은 내용의 사본을 하네스 것으로 읽는다
  if (target === "claude") {
    delete next.policyFiles;
    delete next.skillFiles;
  }
  return forgetRemoved(next, done);
}

/** 회수 결과를 기록에 옮긴다(`--cli` · `--track`) — 회수한 파일(필드는 비어도 남긴다 — 없으면 옛 로그다) · 되돌린 displaced(#761) · 걷은 몫(#551 R1 · #623). */
function forgetRemoved(next: InstallLog, done: HarnessRemoval): InstallLog {
  const out: InstallLog = { ...next };
  const kept =
    (prefix: string) =>
    (f: { path: string }): boolean =>
      !done.forgotten.has(`${prefix}${f.path}`);
  if (out.policyFiles !== undefined) out.policyFiles = out.policyFiles.filter(kept(CLAUDE_DIR));
  if (out.skillFiles !== undefined) out.skillFiles = out.skillFiles.filter(kept(SKILLS_DIR));
  const survivors = (out.externalFiles ?? []).filter(kept(""));
  if (survivors.length > 0) out.externalFiles = survivors;
  else delete out.externalFiles;
  if (out.rootFiles !== undefined) out.rootFiles = withoutRestored(out.rootFiles, done.displaced);
  const touched = new Set(done.shared.map((r) => r.path));
  const portions = [
    ...(out.portions ?? []).filter((p) => !touched.has(p.path)),
    ...done.shared.flatMap((r) => r.portions),
  ];
  if (portions.length > 0) out.portions = portions;
  else delete out.portions;
  return out;
}

/** 범위 하나를 빼는 실행 — `--cli` · `--track` 이 범위 · 남김 줄 · 기록 규칙만 바꿔 부른다(#543 설계 검증 §5 ⓐ). */
interface ScopedRemoval {
  flag: "cli" | "track";
  target: string;
  installed: ReadonlyArray<string>;
  remaining: ReadonlyArray<string>;
  scope: RemovalScope;
  leftLines: (preview: boolean, done: HarnessRemoval) => string[];
  rerenderSet: CliBase[] | null;
  /** 회수 줄 뒤의 줄 · 기록의 다음 판(기록 쓰기 직전에 한 번 — 트랙은 짝인 메타파일도 여기서 쓴다). */
  settle: (done: HarnessRemoval) => InstallLog;
}

function runScopedRemoval(ctx: RemoveCliCtx, io: RemoveCliIo, plan: ScopedRemoval): void {
  const { options, installLog, projectDir, harnessRoot } = ctx;
  const preview = options.dryRun === true;
  const remaining = plan.remaining.join(", ");
  const recordNote = `${plan.flag === "cli" ? "clis" : "tracks"}: ${remaining}`;
  const header = [
    "",
    c.bold(`uzys-agent-harness · uninstall --${plan.flag} ${plan.target}`),
    "",
    c.dim(`  installed: ${plan.installed.join(", ")}`),
    c.dim(`  removing:  ${plan.target}`),
    c.dim(`  remaining: ${remaining}`),
    "",
  ];
  for (const line of header) io.log(line);
  // 전량 경로와 같은 함수 — 범위 안에 기록된 하네스 파일만 하나씩(#746). 설치자 파일은 제자리에 둔다. 미리보기도 같은 판정이다
  const done = removeHarnessFiles(installLog, projectDir, plan.scope, {
    rm: preview ? () => {} : io.rm,
    write: !preview,
    harnessRoot,
  });
  const what = plan.flag === "cli" ? "CLI" : "트랙";
  const lines = [
    ...(preview ? [c.yellow(`[DRY RUN] ${what} 제거 미리보기 (실제 변경 없음):`), ""] : []),
    ...harnessRemovalLines(done, installLog, projectDir, plan.scope, preview),
    ...plan.leftLines(preview, done),
  ];
  if (preview) {
    if (plan.rerenderSet !== null) {
      lines.push(
        `  ○ would re-render AGENTS.md for ${displayNames(plan.rerenderSet)} (your sections kept)`,
      );
    }
    for (const line of [...lines, `  ○ install log updated (${recordNote})`, ""]) io.log(line);
    io.exit(0);
    return;
  }
  for (const line of lines) io.log(line);
  const settled = plan.settle(done);
  // C-3 (#642) — `AGENTS.md` 를 읽는 CLI 가 남으면 그 자리에서 다시 렌더한다(update 까지 옛 판이 남지 않는다)
  const agentsBefore = readTextOrEmpty(join(projectDir, AGENTS_MD));
  const rerender =
    plan.rerenderSet === null ? null : rerenderAgentsMd(ctx, plan.rerenderSet, settled);
  const rewrote =
    rerender !== null && readTextOrEmpty(join(projectDir, AGENTS_MD)) !== agentsBefore;
  if (rewrote) for (const line of rerenderLines(rerender)) io.log(line);
  const next = rerender === null ? settled : withRerender(settled, rerender);
  try {
    io.writeLog(projectDir, next);
    io.log(`  ${status.success(`install log updated (${recordNote})`)}`);
  } catch (e) {
    // 회수는 이미 끝났다 — 여기서 throw 하면 무엇이 지워졌는지도 사라진다(전량 경로와 같은 방침).
    io.err(status.failure(c.red(`ERROR: install log 갱신 실패 — ${installLogPath(projectDir)}`)));
    io.err(c.dim(`       ${e instanceof Error ? e.message : String(e)}`));
    io.log("");
    io.log(
      c.yellow(
        `${plan.target} 는 제거됐으나 install log 를 갱신하지 못했다 (기록이 실제와 다르다)`,
      ),
    );
    io.exit(1);
    return;
  }
  io.log("");
  io.log(status.success(c.green(`${plan.target} removed (remaining: ${remaining})`)));
  io.exit(0);
}

function removeCliAction(ctx: RemoveCliCtx, io: RemoveCliIo): void {
  const { options, installLog, projectDir } = ctx;
  const installed = installedClis(installLog);
  const target = resolveScopeTarget(io, {
    flag: "cli",
    value: options.cli,
    conflict: options.only !== undefined,
    vocab: CLI_BASES,
    installed,
  });
  if (target === null) return;
  const remaining = installed.filter((cli) => cli !== target);
  const plan = planCliRemoval(target, remaining, installLog, projectDir);
  runScopedRemoval(ctx, io, {
    flag: "cli",
    target,
    installed,
    remaining,
    scope: plan.scope,
    leftLines: (preview) => [
      ...keptForRemainingLines(plan, preview),
      ...assetsLeftLines(installLog, projectDir, plan.scope),
    ],
    rerenderSet: agentsMdRerenderSet(target, remaining, installLog, projectDir),
    settle: (done) => settleCliLog(ctx, target, remaining, done, done.anchor.removed),
  });
}

/** #543 — 그 트랙만 가져오는 룰 · 에이전트 · 스킬을 `--cli` 와 같은 뼈대로 뺀다. 함께 쓰는 파일 · 앵커에는 트랙의 몫이 없다. */
function removeTrackAction(ctx: RemoveCliCtx, io: RemoveCliIo): void {
  const { options, installLog, projectDir } = ctx;
  // 마지막 트랙은 **어휘에 있는 기록 트랙**으로 센다(모르는 문자열은 남는 트랙이 아니다)
  const target = resolveScopeTarget(io, {
    flag: "track",
    value: options.track,
    conflict: options.only !== undefined || options.cli !== undefined,
    vocab: TRACKS,
    installed: installLog.spec.tracks.filter(isTrack),
  });
  if (target === null) return;
  const removal = trackRemoval(installLog, target);
  runScopedRemoval(ctx, io, {
    flag: "track",
    target,
    installed: removal.known,
    remaining: removal.remaining,
    scope: { ...TRACK_SCOPE, has: removal.has },
    leftLines: (preview, done) =>
      preview
        ? trackNotes(ctx, removal, done, false).map((l) => `  ○ ${l}`)
        : trackNotes(ctx, removal, done, true),
    rerenderSet: agentsMdRerenderSet(null, installedClis(installLog), installLog, projectDir),
    settle: (done) => settleTrackLog(ctx, target, removal.remaining, done),
  });
}

const TRACK_SCOPE = { shared: [], skeleton: [], folders: [], importBlock: false, anchor: false };

type TrackCtx = Pick<RemoveCliCtx, "installLog" | "projectDir" | "harnessRoot">;

/** 회수 뒤 줄 — 빠지는 이름(엔진 미리보기에서, 리뷰 BLOCKER-1) · 루트 블록 · 남기는 것. dry-run · 위저드 · 실행이 같이 쓴다. */
function trackNotes(ctx: TrackCtx, r: TrackRemoval, d: HarnessRemoval, write: boolean): string[] {
  const md = join(ctx.projectDir, "CLAUDE.md");
  const block = rootBlockNext(ctx, new Set(d.removed));
  if (write && block !== null) {
    backupIfLossyUtf8(md);
    writeFileSync(md, block);
  }
  const left = trackLeftLines(ctx.installLog, r, ctx.harnessRoot);
  if (write) {
    const refreshed = block === null ? [] : ["CLAUDE.md — harness block refreshed (본문 보존)"];
    return [
      ...refreshed.map((l) => `  ${status.success(l)}`),
      ...left.map((l) => `  ⊘ left  ${l}`),
    ];
  }
  const would = block === null ? [] : ["would refresh the harness block in CLAUDE.md (본문 보존)"];
  return [trackRemovalNames(d.removed, r.target), ...would, ...left.map((l) => `leave ${l}`)];
}

/** #543 위저드 확인 화면 — dry-run 과 같은 엔진 미리보기(쓰지 않는다)로 무엇이 빠지는지 이름으로 말한다(리뷰 BLOCKER-1). */
export function previewTrackRemoval(ctx: TrackCtx, target: Track): string[] {
  const r = trackRemoval(ctx.installLog, target);
  const io = { rm: () => {}, write: false, harnessRoot: ctx.harnessRoot };
  const scope = { ...TRACK_SCOPE, has: r.has };
  const done = removeHarnessFiles(ctx.installLog, ctx.projectDir, scope, io);
  // dry-run 과 같은 수 · 백업 예고 줄(리뷰 r2 NOTE 1)
  const counts = harnessRemovalLines(done, ctx.installLog, ctx.projectDir, scope, true);
  return [...counts.map((l) => l.replace(/^\s*○ /, "")), ...trackNotes(ctx, r, done, false)];
}

/** 루트 `CLAUDE.md` 하네스 블록(상시 스킬 안내)의 다음 판. update 와 같은 가드 — 기록된 앵커가 디스크에 있고 블록이 이미 있을 때만(리뷰 HIGH-2). */
function rootBlockNext({ installLog, projectDir }: TrackCtx, gone: Set<string>): string | null {
  const anchor = installLog.templates?.rootClaudeMd?.path;
  const md = join(projectDir, "CLAUDE.md");
  const text =
    safeExists(md) && outsideProjectTarget(projectDir, md) === null ? readTextOrEmpty(md) : "";
  if (anchor === undefined || !safeExists(join(projectDir, anchor))) return null;
  if (stripHarnessImport(text) === null) return null; // 블록 마커가 없다 — 새로 붙이지 않는다
  // 기준 하나(리뷰 r2-1) — 이번에 지울(미리보기) · 지운(실행) 파일을 빼고 그 스킬 폴더에 파일이 남으면 아직 깔린 스킬이다
  const stays = (id: string) =>
    listFilesRecursive(join(projectDir, SKILLS_DIR, id)).some(
      (f) => !gone.has(`${SKILLS_DIR}${id}/${f}`),
    );
  const continuousSkills = CONTINUOUS_SKILLS.map((s) => s.id).filter(stays);
  const next = upsertHarnessImport(text, { projectName: "", continuousSkills });
  return next === text ? null : next;
}

/** 기록과 짝인 메타파일 · 그 sha 를 함께 맞춘다(아니면 heal 이 트랙을 되살린다). 고친 메타파일 · 밖 자리는 두고, 옛 기록에 필드를 만들지 않는다. */
function settleTrackLog(
  ctx: RemoveCliCtx,
  target: Track,
  remaining: ReadonlyArray<Track>,
  done: HarnessRemoval,
): InstallLog {
  const { installLog, projectDir } = ctx;
  const tracks = installLog.spec.tracks.filter((t) => t !== target);
  const next = forgetRemoved({ ...installLog, spec: { ...installLog.spec, tracks } }, done);
  const abs = join(projectDir, INSTALLED_TRACKS);
  const key = INSTALLED_TRACKS.slice(CLAUDE_DIR.length);
  // #854 — 옛 기록(sha 없음)은 전량 uninstall 과 같은 기준(`templateNext` — 기록 트랙으로 쓴 하네스 판)으로 고쳤는지 본다
  const prior =
    installLog.policyFiles?.find((f) => f.path === key)?.sha256 ??
    hashContent(installedTracksText(installLog.spec.tracks.filter(isTrack)));
  const edited = safeExists(abs) && hashContent(readTextOrEmpty(abs)) !== prior;
  if (!installedClis(installLog).includes("claude")) return next;
  if (outsideProjectTarget(projectDir, abs) !== null) return next;
  const content = installedTracksText(remaining);
  const sha256 = hashContent(content);
  if (edited) {
    // #863 — 고친 메타파일은 그대로 둔다(#854). 다만 기록의 sha 는 남는 트랙의 하네스 판으로 바꾼다 — 옛 sha 를 두면 설치자가 메모를
    // 지워 내용이 옛 판과 같아지는 순간 heal 이 그 파일을 근거로 뺀 트랙을 되살린다. sha 가 없던 옛 기록이 이미 같은 기준
    // (`installedTracksText(기록 트랙)`)으로 고쳤는지 보므로 두 기록이 같은 판정을 낸다. 항목이 없던 기록에는 만들지 않는다(쓰지 않았다)
    if (next.policyFiles?.some((f) => f.path === key)) {
      next.policyFiles = next.policyFiles.map((f) => (f.path === key ? { path: key, sha256 } : f));
    }
    return next;
  }
  writeFileSync(abs, content);
  if (next.policyFiles !== undefined) {
    next.policyFiles = [...next.policyFiles.filter((f) => f.path !== key), { path: key, sha256 }];
  }
  return next;
}

/* ────────────────────────────────────────────────────────────────────────────
 * #551 R1 — 첫 접촉 파일의 하네스 몫만 걷는다
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 몫을 걷는 함께 쓰는 파일 — 어댑터 표(`SHARED_FILES`) 중 루트 `CLAUDE.md`(import 블록은 `stripRootImport` 가 맡는다)를 뺀
 * 여섯이다: `AGENTS.md` · `.claude/settings.json` · `.mcp.json` · `opencode.json` · `.codex/config.toml` · `.gitignore`.
 * install · update 가 하네스 몫만 더하므로 uninstall 도 **기록된 몫만** 뺀다(설치자 서버 · 훅 · 줄은 남는다 — #569 · #746).
 * 몫 기록이 없는 옛 설치본은 지우지 않고 남은 하네스 몫으로 보이는 것을 알린다. 하네스가 **만든** 파일(`rootFiles` 의
 * `created` · `externalFiles`)은 몫을 걷고 남는 것이 없으면 파일째 지운다.
 */
const UNINSTALL_SHARED: ReadonlyArray<string> = Object.keys(SHARED_FILES).filter(
  (p) => p !== "CLAUDE.md",
);

/** #610 — `npx skills` 가 프로젝트 루트에 쓰는 잠금 파일. */
const SKILLS_LOCK = "skills-lock.json";

/**
 * #610 — 이번에 빼는 자산에 project scope 스킬이 있고 잠금 파일이 디스크에 있으면, 남는 것 안내에 그 파일을 더한다.
 * 내용은 고치지 않는다 — 외부 도구의 파일이다. 기록에 이미 있으면 그 줄을 쓴다.
 */
function withSkillsLock(
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  assets: ReadonlyArray<InstallLogAsset>,
  projectDir: string,
): InstallLogRootFile[] {
  const out = [...rootFiles];
  const skills = assets.some((a) => a.method === "skill" && a.scope === "project");
  if (
    skills &&
    !out.some((f) => f.path === SKILLS_LOCK) &&
    existsSync(join(projectDir, SKILLS_LOCK))
  ) {
    out.push({ path: SKILLS_LOCK, change: "advisory", notes: [] });
  }
  return out;
}

/** 몫 기록이 없을 때 남은 하네스 몫을 **알리기만** 하는 식별(지우지 않는다 — 기록 없이 지우면 설치자 것을 지울 수 있다). */
function remnantFor(
  path: string,
  log: InstallLog,
  harnessRoot: string,
  projectDir: string,
  wiringGone: ReadonlyArray<string> = [],
): (disk: string) => string[] {
  const clis = installedClis(log);
  if (path === SETTINGS_TARGET) {
    // #781 — ⓑ″ 가 걷은(미리보기면 걷을) 옛 훅 줄은 "남았다" 로 세지 않는다
    const gone = (k: string): boolean => wiringGone.includes(`hooks/${k.split("#")[1] ?? ""}`);
    // 옛 판은 이 파일을 템플릿으로 통째 덮었다 — 하네스 훅 스크립트를 부르는 핸들러를 update 와 같은 식별(`legacySettingsSeed`)로 알린다
    return (disk) => {
      try {
        const template = readFileSync(join(harnessRoot, "templates", "settings.json"), "utf8");
        const render = renderSettingsPortion(template, () => true);
        return [...legacySettingsSeed(disk, render, projectDir, { edited: true }).keys()].filter(
          (k) => !k.endsWith("{}") && !gone(k),
        );
      } catch {
        return [];
      }
    };
  }
  if (path === CODEX_CONFIG) {
    // 구간 마커는 하네스만 쓴다 — 있으면 하네스 구간이다
    return (disk) => [...(ADAPTERS["toml-region"].read(disk)?.keys() ?? [])];
  }
  if (path === ".gitignore") {
    // 옛 판이 `rootFiles.notes` 에 적은 줄 중 하네스 판(딸린 주석 포함) 그대로 남은 것
    return (disk) => [...legacyGitignoreSeed(disk, gitignoreRender(), log).keys()];
  }
  if (path === ".mcp.json") {
    // 이름만으로는 설치자 서버와 못 가른다 — 값까지 지금 하네스 렌더와 같은 것만 알린다
    return (disk) => {
      let servers: McpJson["mcpServers"];
      try {
        // #709 NOTE-1 — 몫 기록이 없어 무엇을 골랐는지 모른다: 고를 수 있었던 서버 전부와 값으로 대조한다(알리기만)
        servers = renderEverySelectableMcp(harnessRoot, log.spec.tracks.filter(isTrack)).mcpServers;
      } catch {
        return [];
      }
      // #722 (ADR-106) — 지금 렌더 값 + 하네스가 **전에** 쓴 값(`PRIOR_MCP_SERVERS` — 옛 github · 옛 railway 등)과 대조한다
      const known = knownServerValues(servers, (v) => toClaudeServer(v));
      const present = ADAPTERS["json-keys"].read(disk, known.keys()) ?? new Map<string, string>();
      return [...present]
        .filter(([k, sha]) => known.get(k)?.has(sha) === true)
        .map(([k]) => k.slice("mcpServers.".length));
    };
  }
  if (path === AGENTS_MD) {
    if (!clis.some(isAgentsMdCli)) return () => [];
    // 블록 마커는 하네스만 쓴다 — 있으면 하네스 블록이다
    return (disk) =>
      ADAPTERS["marker-md"].read(disk, [AGENTS_BLOCK_NAME])?.has(AGENTS_BLOCK_NAME)
        ? [AGENTS_BLOCK_NAME]
        : [];
  }
  if (!clis.includes("opencode")) return () => [];
  // 이름만으로는 설치자 서버와 못 가른다 — 값까지 지금 하네스 렌더와 같은 것만 알린다
  return (disk) => {
    let known: Map<string, Set<string>>;
    try {
      known = knownServerValues(
        renderEverySelectableMcp(harnessRoot, log.spec.tracks.filter(isTrack)).mcpServers,
        (v) => [...renderOpencodeMcp({ mcpServers: { x: v } }).values()][0],
        "mcp.",
      );
    } catch {
      return [];
    }
    const present = ADAPTERS["json-keys"].read(disk, known.keys()) ?? new Map<string, string>();
    return [...present].filter(([k, sha]) => known.get(k)?.has(sha) === true).map(([k]) => k);
  };
}

/**
 * 잔존 안내가 알아보는 하네스 값 — 키 → 값 sha 집합. 지금 렌더(`servers`) ∪ 하네스가 전에 쓴 값(`PRIOR_MCP_SERVERS`). `form` 이
 * 그 파일의 형식으로 바꾼다(`.mcp.json` = Claude · `opencode.json` = OpenCode). 알리기만 하는 자리라 넓게 대조해도 지우지 않는다.
 */
function knownServerValues(
  servers: McpJson["mcpServers"],
  form: (v: McpServerConfig) => unknown,
  prefix = "mcpServers.",
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const add = (name: string, v: McpServerConfig): void => {
    const key = `${prefix}${name}`;
    const set = out.get(key) ?? new Set<string>();
    set.add(jsonSha(form(v)));
    out.set(key, set);
  };
  for (const [name, v] of Object.entries(servers)) add(name, v);
  for (const p of PRIOR_MCP_SERVERS) add(p.name, p.value);
  return out;
}

function remnantLine(path: string): (names: ReadonlyArray<string>) => string {
  if (path === SETTINGS_TARGET) {
    return (names) =>
      `may still hold the harness's hooks (not on record): ${names.join(" · ")} — delete them by hand if they are not yours`;
  }
  if (path === CODEX_CONFIG) {
    return (names) =>
      `harness regions not on record: ${names.join(" · ")} — delete them by hand if you want them gone`;
  }
  if (path === ".mcp.json") {
    return (names) =>
      `may still hold the harness's MCP servers (not on record): ${names.join(" · ")} — delete them by hand if they are not yours`;
  }
  if (path === ".gitignore") {
    return (names) =>
      `may still hold lines the harness added (not on record): ${names.join(" · ")} — delete them by hand if they are not yours`;
  }
  return path === AGENTS_MD
    ? () =>
        "the harness block is not on record (written before the harness recorded its part) — delete the <!-- uzys-harness:agents --> block by hand if you want it gone"
    : (names) =>
        `may still hold the harness's MCP servers (not on record): ${names.join(" · ")} — delete them by hand if they are not yours`;
}

/** 걷은 것 · 남긴 것을 말한다 — 미리보기와 실행이 같은 판정을 읽는다. */
function sharedStripLines(results: ReadonlyArray<SharedStripResult>, preview: boolean): string[] {
  const lines: string[] = [];
  for (const r of results) {
    // 화면 이름 — 키 id 에서 파일 접두를 뗀 것(`mcpServers.github` → `github`). 빈 컨테이너 키는 이름이 아니다
    const display = (k: string): string[] => {
      if (k === AGENTS_BLOCK_NAME) return ["harness block"];
      const id = keyId(r.path, k);
      return id === null ? [] : [id.slice(id.indexOf(":") + 1)];
    };
    const names = (keys: ReadonlyArray<string>) => keys.flatMap(display).join(" · ");
    // #800 — 설치자가 고친 몫까지 걷었으면 "하네스 몫만 있었다" · "yours stays" 라 하지 않고 백업을 댄다
    const stays = r.edited === undefined ? " (yours stays)" : "";
    if (r.fileRemoved) {
      const only = (verb: string) =>
        r.edited === undefined ? ` and only its part ${verb} in it` : "";
      lines.push(
        preview
          ? `  ○ remove ${r.path} (the harness created it${only("is")})`
          : `  ${status.success(`${r.path} — removed (the harness created it${only("was")})`)}`,
      );
    } else if (r.removed.length > 0) {
      // 블록은 이름이 곧 전부다 · 키는 무엇을 걷었는지 이름을 댄다
      const which = r.path === AGENTS_MD ? "" : `: ${names(r.removed)}`;
      const what = r.path === AGENTS_MD ? "the harness block" : "the harness part";
      lines.push(
        preview
          ? `  ○ remove ${what} from ${r.path}${which}${stays}`
          : `  ${status.success(`${r.path} — removed ${what}${which}${stays}`)}`,
      );
    }
    if (r.edited !== undefined) {
      const n = r.edited.keys.length;
      const edited = `you had edited ${n} harness hook line${n === 1 ? "" : "s"} (${names(r.edited.keys)})`;
      lines.push(
        preview
          ? `  ○ ${r.path} — ${edited} — a copy is saved first as ${r.edited.backup}`
          : `  ${c.yellow("⊘")} ${r.path} — ${edited} — your edit is in the copy: ${r.edited.backup}`,
      );
    }
    if (r.kept.length > 0) {
      lines.push(
        `  ${c.yellow("⊘")} ${r.path} — kept ${names(r.kept)}: changed since install. Remove by hand if intended.`,
      );
    }
    if (r.line !== "") lines.push(`  ${c.yellow("⊘")} left  ${r.path} — ${r.line}`);
  }
  return lines;
}

interface ReversePlan {
  reverseSteps: ReverseStep[];
  globalAdvisories: GlobalAdvisory[];
  /**
   * 자동 되돌리기 경로가 없는 자산 (npx-run / legacy shell-script / internal · 파일 목록이 기록에 없는 옛 skill).
   * `--only` 에선 **아무 일도 안 일어난다** — 그래서 따로 센다.
   */
  noReversePath: InstallLogAsset[];
  /** `noReversePath` 자산마다 남는 것을 말하는 줄 — 실행과 미리보기가 같은 줄을 낸다. */
  hints: Map<string, string[]>;
}

interface ReverseCtx {
  spawn: (
    cmd: string,
    args: ReadonlyArray<string>,
    opts: { cwd: string },
  ) => SpawnSyncReturns<string>;
  projectDir: string;
  rm: (path: string) => void;
}

function planReverse(assets: ReadonlyArray<InstallLogAsset>, ctx: ReverseCtx): ReversePlan {
  const reverseSteps: ReverseStep[] = [];
  const globalAdvisories: GlobalAdvisory[] = [];
  const noReversePath: InstallLogAsset[] = [];
  const hints = new Map<string, string[]>();

  for (const asset of assets) {
    if (asset.scope === "global") {
      globalAdvisories.push({ asset, command: buildGlobalAdvisoryCmd(asset) });
      continue;
    }
    const step = buildProjectReverseStep(asset, ctx);
    if (step) reverseSteps.push(step);
    else {
      noReversePath.push(asset);
      hints.set(asset.id, noReverseHints(asset, ctx));
    }
  }

  return { reverseSteps, globalAdvisories, noReversePath, hints };
}

/** 되돌리지 못한 자산이 남기는 것 — 무엇을 손수 확인해야 하는지 말하지 않으면 남은 디렉터의 정체를 알 길이 없다. */
function noReverseHints(asset: InstallLogAsset, ctx: ReverseCtx): string[] {
  // #571 — 이 부류(npx-run)는 .claude/ 밖에도 파일을 만든다(USAGE L254 약속의 이행).
  if (asset.method === "npx-run") {
    return [".claude/ 밖에 만든 파일(예: _bmad/ · _openspec/)은 직접 확인 후 지운다 — 기록에 없다"];
  }
  if (asset.method !== "skill") return [];
  // #573 — 파일 목록이 없는 옛 기록. 무엇을 놓았는지 모르므로 지우지 않고, 그 스킬 이름의 자리 중 실재하는 것을 댄다
  const name = asset.detail.skill;
  const left =
    name === undefined
      ? []
      : [".claude/skills", ".agents/skills"]
          .map((root) => `${root}/${name}/`)
          .filter((p) => existsSync(join(ctx.projectDir, p)));
  return [
    left.length > 0
      ? `files it put down are not on record (installed by an older version) — left: ${left.join(" · ")} (delete by hand if the harness installed it)`
      : "files it put down are not on record (installed by an older version) — nothing removed",
  ];
}

function buildProjectReverseStep(asset: InstallLogAsset, ctx: ReverseCtx): ReverseStep | null {
  const { spawn } = ctx;
  switch (asset.method) {
    case "plugin": {
      const pluginId = asset.detail.pluginId ?? asset.id;
      return {
        assetId: asset.id,
        label: `claude plugin uninstall --scope project ${pluginId}`,
        execute: () => {
          // #845 — install 과 같은 계약(cwd=projectDir): claude 는 cwd 로 프로젝트를 찾고 npm 은 cwd 의 package.json 을
          // 고친다. 빠지면 `--project-dir` 이 아니라 명령을 친 자리의 프로젝트가 바뀌고 대상 기록은 성공으로 남는다.
          const r = spawn("claude", ["plugin", "uninstall", "--scope", "project", pluginId], {
            cwd: ctx.projectDir,
          });
          if (r.status === 0) return { ok: true };
          // #655 — 사용자가 claude CLI 로 이미 지운 플러그인은 "not found" 로 실패한다.
          // 이것을 실패로 세면 기록에서 빼질 수 없는 막다길이 되고, 전량 uninstall 도
          // 다 지워놓고 exit 1 로 끝난다. 이미 없다는 것은 목표 상태 — 성공으로 센다.
          const out = `${r.stderr || ""}\n${r.stdout || ""}`;
          if (/Plugin ".*" not found in installed plugins/.test(out)) return { ok: true };
          return { ok: false, message: (r.stderr || "").trim() };
        },
      };
    }
    case "skill": {
      // #573 — 외부 도구의 제거 명령(`npx skills remove`)에 맡기지 않는다. 그 도구는 이름으로 찾고 자기 에이전트 해석으로
      // 범위를 정해, 하네스가 깐 적 없는 사본(다른 에이전트 자리 · 링크 너머 공유 폴더)까지 지웠다. **설치 기록에 적힌
      // 경로만** 하네스가 직접 지운다. 기록이 없으면(옛 판) 지우지 않는다 — `noReverseHints` 가 남는 것을 말한다.
      const files = asset.files;
      if (files === undefined) return null;
      return {
        assetId: asset.id,
        label: `remove ${asset.id} — ${files.length} file(s) on record`,
        execute: () => removeToolFiles(files, ctx.projectDir, ctx.rm),
      };
    }
    case "npm": {
      const pkg = asset.detail.pkg ?? asset.id;
      return {
        assetId: asset.id,
        label: `npm uninstall --save-dev ${pkg}`,
        execute: () => {
          const r = spawn("npm", ["uninstall", "--save-dev", pkg], { cwd: ctx.projectDir });
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        },
      };
    }
    case "npx-run":
      // fire-and-forget — reverse 없음 (예: GSD orchestrator).
      return null;
    case "shell-script":
      // legacy(#492 은퇴) 로컬 script 호출 — 일반 reverse 없음 (script 별 별도 cleanup 필요).
      return null;
    case "internal":
      // v26.81.0 (ADR-022) — 내부 템플릿 — 기록된 하네스 파일로 `removeHarnessFiles` 가 회수한다.
      return null;
  }
}

/**
 * 로그에 없는 `--only` id — 오타로 엉뚱한 자산이 남지 않도록 **아무것도 실행하기 전에** 본다
 * (Pre-flight: 전제조건 미충족 시 차단, 부분 작업 없음).
 */
function unknownIds(installLog: InstallLog, selectedIds: ReadonlyArray<string>): string[] {
  const known = new Set(installLog.assets.map((a) => a.id));
  return selectedIds.filter((id) => !known.has(id));
}

/** `--only <a,b>` → ["a","b"]. 미지정이면 null (= 전량 제거, 기존 동작). */
export function parseOnly(only: string | string[] | undefined): string[] | null {
  // #612 — cac 는 플래그 반복을 배열로 준다. 배열·문자열·단일·혼합 전부 같은 곳에서 정규화한다.
  const parts = Array.isArray(only) ? only : only !== undefined ? [only] : [];
  const ids = parts
    .flatMap((s) => s.split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length > 0 ? ids : null;
}

// 2026-08-02 정비 (ADR-060) — [MANUAL] 안내(`manualAdvisoryLines`)는 karpathy-coder 훅
// 하나만을 위한 것이었고 그 자산과 함께 삭제됐다. `.claude/` 밖에 남는 것은 아래
// `rootFileAdvisoryLines` 가 계속 안내한다.

function buildGlobalAdvisoryCmd(asset: InstallLogAsset): string {
  switch (asset.method) {
    case "plugin": {
      const pid = asset.detail.pluginId ?? asset.id;
      return `claude plugin uninstall --scope user ${pid}`;
    }
    case "skill": {
      // #573 — skills CLI 는 설치 목록을 스킬 **이름**으로 찾는다. 소스 저장소 경로를 주면 "No matching skills" 로 끝난다
      const s = asset.detail.skill ?? asset.detail.source ?? asset.id;
      return `npx skills remove -g ${s}`;
    }
    case "npm": {
      const pkg = asset.detail.pkg ?? asset.id;
      return `npm uninstall -g ${pkg}`;
    }
    case "npx-run":
    case "shell-script":
    case "internal":
      return "(no standard reverse — manual)";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * #746 · #761 — 하네스 파일을 하나씩 회수한다 (설계 `v26.169.0-one-principle-finish-design.md` §2.3 · ADR-097 결정 3 · 4)
 *
 * CLI 폴더(`.claude/` · `.codex/` · `.opencode/`)를 통째로 옮기거나 지우지 않는다. **기록에 있는 경로만** 판정
 * 함수(`judge({op:"remove"})`)로 치우고 그 밖은 건드리지 않는다 — 설치자 파일(`settings.local.json` · 자기 커맨드 ·
 * `config.toml` 에 더한 서버)은 제자리에 남는다. 전량 uninstall 과 `--cli` 가 이 함수 하나를 범위(`RemovalScope`)만 바꿔 부른다.
 * ──────────────────────────────────────────────────────────────────────────── */

const CLAUDE_DIR = ".claude/";
/** 옛 위치의 설치 기록(v26.134.1 이하) — project 상대. */
const LEGACY_LOG = `${LEGACY_INSTALL_LOG_DIR}/${INSTALL_LOG_FILENAME}`;
const SKILLS_DIR = ".claude/skills/";
/** CLI 폴더 — 회수 뒤 남은 설치자 파일을 이름으로 말하는 자리다(통째로 다루지 않는다). */
const CLI_FOLDERS: ReadonlyArray<string> = [".claude", ".codex", ".opencode"];
const LEFT_FILES_SHOWN = 3;
/** 기록 폴더에서 `settleLog` 가 지우는 것 — 설치 기록 + 런타임 파일(`.gitignore` 가 무시하는 그 둘: 차단 로그 · update 백업 목록, ADR-100). */
const RECORD_FILES: ReadonlyArray<string> = [
  `${INSTALL_LOG_DIR}/${INSTALL_LOG_FILENAME}`,
  ...HARNESS_RUNTIME_IGNORES,
];

/** 이번 실행이 회수하는 범위 — 전량은 전부, `--cli` 는 그 CLI 의 소유 접두(`cli-ownership.ts`). */
interface RemovalScope {
  /** 이 경로(project 상대)를 이번에 회수하는가. */
  has: (path: string) => boolean;
  /** 몫을 걷을 함께 쓰는 파일. */
  shared: ReadonlyArray<string>;
  /** 빈 디렉터리 걷기에 더할 시작점 — install 이 기록 없이 만든 뼈대(설계 §2.3 #8 ⓑ). */
  skeleton: ReadonlyArray<string>;
  /** 남은 설치자 파일을 말할 CLI 폴더. */
  folders: ReadonlyArray<string>;
  /** 루트 `CLAUDE.md` 의 하네스 import 블록을 걷는가(claude 를 뺄 때 · 전량). */
  importBlock: boolean;
  /** 하네스 앵커(`templates.rootClaudeMd`)를 회수하는가(claude 를 뺄 때 · 전량). */
  anchor: boolean;
}

const FULL_SCOPE: RemovalScope = {
  has: () => true,
  shared: UNINSTALL_SHARED,
  skeleton: PROJECT_SKELETON_DIRS,
  // #817 — 기록 폴더도 — 헬퍼는 파일 하나씩 회수하고(#812) 설치자 파일은 남으니, 폴더가 왜 남았는지 같은 줄로 말한다
  folders: [...CLI_FOLDERS, INSTALL_LOG_DIR],
  importBlock: true,
  anchor: true,
};

/** `removeHarnessFiles` 의 결과 — 실행과 미리보기가 같은 판정을 읽는다. */
interface HarnessRemoval {
  /** 지운 하네스 파일(project 상대) — 그 파일 하나를 백업하고 지운 것도 든다. */
  removed: string[];
  /** 고쳤거나 체크섬이 없어 그 파일 하나를 백업하고 지운 것. 미리보기면 `backup` 은 이름 규약이다. */
  backedUp: Array<{ path: string; backup: string; line: string }>;
  /** 기록에서 뺄 경로(지웠다 · 이미 없다 · 하네스가 쓴 자리가 아니다). `--cli` 가 기록을 이어 쓸 때 읽는다. */
  forgotten: Set<string>;
  /** 하네스가 만든 `AGENTS.md` — 하네스 절만 걷고 설치자 절을 남겼다(#516). */
  stripped: string[];
  /** 하네스가 만든 `AGENTS.md` 인데 그 뒤 바뀌어 남긴 것(#516 — 설치자 절이 섞여 통째 판정을 못 한다). */
  kept: string[];
  /**
   * #774 (ADR-111) — 옛 판이 바이트 그대로 쓴 `AGENTS.md` 몫(지문 일치 절 · 옛 하네스 파일)을 걷었다. 걷기 전 파일 1회 백업
   * (`backup` — 미리보기면 이름 규약). `fileRemoved` = 설치자 몫이 없어 파일째 지웠다. `keptEdited` = 이름은 하네스 절인데 설치자가
   * 고쳐 남긴 절의 제목. 화면은 "설치자 몫이 없었다" 고 단언하지 않는다 — 백업 위치만 말한다(리뷰 r2 MEDIUM-1: 제목 한 줄 편집도 판정 밖이다).
   */
  legacyAgentsMd: Array<{
    path: string;
    backup: string;
    fileRemoved: boolean;
    keptEdited: string[];
  }>;
  /** 읽지 못해(권한 · 디렉터리 · 템플릿 없음 · 쓰기 실패) 판정하지 않고 남긴 것. */
  unjudged: string[];
  /** 실체가 프로젝트 밖이라 건드리지 않은 것(ADR-098). */
  outside: OutsideLink[];
  /** displaced 자리 — 하네스 판을 지운 뒤 설치자 원본을 원래 이름으로(#761). */
  displaced: DisplacedOutcome[];
  /** 함께 쓰는 파일의 몫 걷기 결과. */
  shared: SharedStripResult[];
  /** `.claude/settings.json` 에서 걷은(미리보기면 걷을) 은퇴 하네스 훅 배선(`RETIRED_HOOK_WIRING_REFS` — `.claude/` 상대). */
  retiredWiring: string[];
  /**
   * #781 — 몫 기록 없는 `.claude/settings.json` 에서 걷은(미리보기면 걷을) 옛 템플릿 훅 배선(`LEGACY_HOOK_REFS` — `.claude/` 상대).
   * 이번 실행 뒤 스크립트가 없는 것만이다.
   */
  legacyWiring: string[];
  /** 루트 `CLAUDE.md` 의 하네스 import 블록을 걷었다(미리보기면 걷을 것이 있다). */
  importStripped: boolean;
  /** #846 — 실체가 프로젝트 밖이라 import 블록을 걷지 않고 남긴 루트 `CLAUDE.md`. */
  importOutside?: OutsideLink;
  /** 하네스 앵커 — 지웠는가(기록을 뺄지 정한다) · 화면 줄. */
  anchor: { removed: boolean; lines: string[] };
  /** 지운(미리보기면 지울) 앵커 경로 — 미리보기의 되돌리기 판정이 "빈 자리" 로 친다. */
  removedAnchor?: string;
}

interface RemovalIo {
  rm: (path: string) => void;
  /** false = 미리보기(쓰지 않는다). 판정은 같다. */
  write: boolean;
  harnessRoot: string;
  /** #780 — 미리보기 전용: 이 실행이 하네스 파일보다 먼저 지울 외부 스킬 자산 파일(빈 자리로 친다). */
  assetFilesGone?: ReadonlyArray<string>;
}

/**
 * 순서(설계 §2.3 "전량 uninstall 의 순서" ③ · v26.170.0 §4.4): ⓑ 기록된 하네스 파일 → ⓑ′ 옛 판 지문 파일 → ⓑ″ 옛 훅 줄 →
 * ⓐ 함께 쓰는 파일의 몫(ⓑ″ 가 걷은 줄을 남은 훅 안내가 다시 세지 않게 그 뒤로) → ⓔ 루트 `CLAUDE.md` import
 * 블록 → 앵커 → ⓒ displaced 되돌리기 → ⓓ 빈 디렉터리. 설계 표는 ⓔ 를 맨 뒤에 적었지만 앵커 자리도 하네스가 빌린 자리일 수
 * 있어(설치자가 같은 이름의 파일을 두었다 — `rootFiles` displaced) 되돌리기보다 **앞**이어야 한다. 아니면 자리가 막혀 못 되돌린다.
 */
function removeHarnessFiles(
  log: InstallLog,
  projectDir: string,
  scope: RemovalScope,
  io: RemovalIo,
): HarnessRemoval {
  const out: HarnessRemoval = {
    removed: [],
    backedUp: [],
    forgotten: new Set(),
    stripped: [],
    kept: [],
    legacyAgentsMd: [],
    unjudged: [],
    outside: [],
    displaced: [],
    shared: [],
    retiredWiring: [],
    legacyWiring: [],
    importStripped: false,
    anchor: { removed: false, lines: [] },
  };
  const pruneFrom: string[] = [];
  // ⓑ 기록된 하네스 파일 — 판정 함수 하나(결정 4: 안 고친 것은 지우고 · 고친 것은 그 파일 하나를 백업하고 지운다)
  const isTarget = harnessTargets(log);
  const candidates = harnessCandidates(log);
  for (const path of candidates) {
    if (scope.has(path))
      removeRecordedFile(path, { log, projectDir, io, out, isTarget, pruneFrom });
  }
  // ⓑ′ #781 (ADR-111) — 기록이 열거하지 못한 옛 판의 하네스 파일(은퇴 스킬 · 옛 커맨드 · 강등 에이전트 · 옛 앵커 ·
  // `.agents/skills` 사본). 같은 함수가 지문으로 가른다 — 기록이 말하는 자리(sha · 앵커 · 외부 기록)는 ⓑ · ⓔ 의 몫이다
  const judged = new Set(candidates);
  for (const path of legacyFileCandidates()) {
    if (judged.has(path) || !scope.has(path) || !safeExists(join(projectDir, path))) continue;
    if (recorded(log, path, { isTarget }).state !== "none") continue;
    removeRecordedFile(path, { log, projectDir, io, out, isTarget, pruneFrom });
  }
  // ⓑ″ #781 — 몫 기록 없는 `settings.json` 의 옛 템플릿 훅 줄. ⓑ · ⓑ′ **뒤**라야 스크립트가 남는지 안다
  out.legacyWiring = removeLegacyHookWiring(log, projectDir, scope, io, out.removed);
  // ⓐ 함께 쓰는 파일은 어느 기록 필드에 있든 몫만 걷는다(B1 · #13) — 루트 `CLAUDE.md` import 블록보다 **먼저**(붙인 순서의
  // 역순, #551 R1 NOTE-3: `AGENTS.md` 가 `CLAUDE.md` 로의 링크면 한 파일에 두 블록이 붙는다). ⓑ″ 뒤라야 남은 훅 안내가 걷은 줄을
  // 다시 세지 않는다(#781)
  stripSharedFiles(log, projectDir, scope.shared, io, out, pruneFrom);
  // ⓔ 루트 `CLAUDE.md` 는 **사용자 소유**다 (P5 · ADR-060) — 지우지 않고 하네스 import 블록만 걷는다. 안 걷으면 앵커를 지운 뒤
  // 없는 파일을 가리키는 import 가 매 세션 로드된다. import 를 앵커보다 **먼저** 걷는다(반대면 잠깐이라도 끊긴 import 가 남는다)
  if (scope.importBlock) {
    const outside = rootImportOutside(projectDir);
    if (outside !== null) out.importOutside = outside;
    out.importStripped = io.write ? stripRootImport(projectDir) : hasRootImport(projectDir);
  }
  if (scope.anchor) {
    out.anchor = removeAnchor(log, projectDir, io);
    const anchorPath = log.templates?.rootClaudeMd?.path;
    if (out.anchor.removed && anchorPath !== undefined) out.removedAnchor = anchorPath;
  }
  // ⓒ displaced — 하네스 판을 지운 **뒤**, 기록을 지우기 **전**(`settleLog`)에. 미리보기는 "이번에 지울 하네스 판" 을 빈 자리로 친다
  out.displaced = restoreDisplaced(log, projectDir, {
    has: scope.has,
    willBeGone: new Set([
      ...out.removed,
      ...(out.removedAnchor === undefined ? [] : [out.removedAnchor]),
      ...(io.assetFilesGone ?? []),
    ]),
    write: io.write,
  });
  // ⓓ 빈 디렉터리 — 지운 파일의 부모 + install 이 기록 없이 만든 뼈대(B2). 비어 있을 때만 걷힌다
  if (io.write) {
    for (const p of pruneFrom) pruneEmptyDirsUpward(projectDir, dirname(join(projectDir, p)));
    for (const d of scope.skeleton) {
      const abs = join(projectDir, d);
      // N-B — 실체가 밖이면(`.claude` → dotfiles) 시작점으로 넣지 않는다. install 도 거기엔 만들지 않았다(ADR-098).
      // `docs/decisions` 에서 걸으면 비어 있는 `docs/` 도 걷힌다 — install 이 `recursive` 로 만든 자리다
      if (outsideProjectTarget(projectDir, abs) !== null) continue;
      pruneEmptyDirsUpward(projectDir, abs);
    }
  }
  return out;
}

/**
 * 판정 후보 — 기록의 하네스 파일 전부(`.claude/` 정책 · 번들 스킬 · 외부 CLI 산출물 · `.installed-tracks`). 함께 쓰는 파일
 * (`kindOf === "shared"`)은 ⓐ 에서만 다룬다(B1 — 여기로 오면 설치자가 표 하나를 더한 `config.toml` 이 sha 가 달라 통째로
 * 빠진다). 설치 기록 폴더의 헬퍼(`.uzys-agent-harness/*.sh`)도 같은 판정으로 회수한다(#812) — 기록 · 런타임 파일만 `settleLog` 가 지운다.
 */
function harnessCandidates(log: InstallLog): string[] {
  const paths = [
    ...(log.policyFiles ?? []).map((f) => `${CLAUDE_DIR}${f.path}`),
    ...(log.skillFiles ?? []).map((f) => `${SKILLS_DIR}${f.path}`),
    ...(log.externalFiles ?? []).map((f) => f.path),
    // 헬퍼 — writer 기록은 `externalFiles` 에 sha 로 적지만 옛 기록(≤v26.161.0)엔 항목이 없다. `recorded()` 가 가른다
    // (writer 기록에 없으면 `none` = 설치자 파일 · 옛 기록이면 `no-sha` = 번들 판과 같을 때만 백업 없이)
    ...helperSources().keys(),
    // 어느 필드에도 적힌 적 없는 옛 판의 하네스 파일 — `isTarget` 이 알려 준다(A8 · install 과 같은 방식)
    INSTALLED_TRACKS,
    // 스캔 필드가 아예 없는 옛 로그(v26.125.0 이하)는 필드가 하네스 파일을 열거하지 못한다 — manifest 의 하네스 자리 ·
    // 은퇴 경로를 후보로 넣고 `recorded()` 가 가른다(필드 없음 → `no-sha` · 필드 있음 → 기록에 없으면 `none`, PR-D 리뷰 N1).
    // 그 은퇴 자리는 새 install · update 가 필드를 쓸 때 `policyFiles` 로 이어받는다(`retiredClaims` — 재리뷰 BLOCKER-1 ②)
    ...(log.records === "writer" ? [] : recordedTrackSpots(log)),
  ];
  return [...new Set(paths)].filter((p) => kindOf(log, p) === "harness");
}

/** `recorded()` 의 하네스 대상 술어 — 한 번만 만든다(N4). `.installed-tracks` 는 manifest 밖이라 더한다. */
function harnessTargets(log: InstallLog): (path: string) => boolean {
  const tracked = recordedTrackTargets(log);
  return (p) => p === INSTALLED_TRACKS || tracked(p);
}

/** CLI 중립 헬퍼(`.uzys-agent-harness/*.sh`) → 번들 원본(`templates/` 상대). 트랙과 무관하게 깔린다(manifest `applies: all`). */
function helperSources(): Map<string, string> {
  return new Map(
    buildManifest({ tracks: [] })
      .filter((e) => isCliNeutralTarget(e.target))
      .map((e) => [e.target, e.source]),
  );
}

/**
 * `judge` 의 `next` — 옛 로그(`no-sha`)에서 "내용이 하네스 판 그대로인가" 를 본다. 외부 CLI 산출물은 쓰는 순간 sha 를
 * 적었으므로 렌더하지 않는다(null).
 */
function templateNext(harnessRoot: string, log: InstallLog, path: string): string | null {
  if (path === INSTALLED_TRACKS) return installedTracksText(log.spec.tracks.filter(isTrack));
  const helper = helperSources().get(path);
  if (helper === undefined && !path.startsWith(CLAUDE_DIR)) return null;
  try {
    const source = helper ?? path.slice(CLAUDE_DIR.length);
    return readFileSync(join(harnessRoot, "templates", source), "utf8");
  } catch {
    return null;
  }
}

function removeRecordedFile(
  path: string,
  ctx: {
    log: InstallLog;
    projectDir: string;
    io: RemovalIo;
    out: HarnessRemoval;
    isTarget: (path: string) => boolean;
    pruneFrom: string[];
  },
): void {
  const { log, projectDir, io, out } = ctx;
  const abs = join(projectDir, path);
  // N-A · B4 — install · update 가 링크를 따라 쓰지 않는 자리(스킬 슬롯 · 그 안의 중간 폴더 · 파일이 아닌 말단 — `foreign-slot.ts`
  // 의 한 술어)는 uninstall 도 따라가지 않는다. 하네스가 쓴 자리가 아니다 — 기록만 정리한다. 따라가면 `.claude/skills/<id>` →
  // `.agents/skills/<id>` 링크를 통과해 남는 CLI 의 스킬 본문을 지운다(#14)
  let foreign: string | null;
  try {
    foreign = foreignOwnedTarget(projectDir, path);
  } catch {
    out.unjudged.push(path);
    return;
  }
  if (foreign !== null) {
    out.forgotten.add(path);
    return;
  }
  // #9 — 실체가 프로젝트 밖(폴더 링크든 파일 링크든)이면 따라가지 않는다(ADR-098) — 그 너머는 다른 프로젝트와 같이 쓸 수 있다
  const outside = outsideProjectTarget(projectDir, abs);
  if (outside !== null) {
    out.outside.push(outside);
    return;
  }
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(abs, { throwIfNoEntry: false });
  } catch {
    out.unjudged.push(path);
    return;
  }
  // 이미 없다 · 대상 없는 링크 — 하네스가 둔 파일이 그 자리에 없다. 기록만 정리한다(다시 돌려도 같은 결과 — #676)
  if (st === undefined || (st.isSymbolicLink() && !existsSync(abs))) {
    out.forgotten.add(path);
    return;
  }
  // #10 — 프로젝트 **안**을 가리키는 링크는 따라가 실체를 판정한다(install 이 따라 썼다 · #629/#630)
  let effective = abs;
  let disk: string;
  try {
    const real = realpathSync(abs);
    if (!statSync(real).isFile()) {
      out.unjudged.push(path);
      return;
    }
    if (st.isSymbolicLink()) effective = real;
    disk = readFileSync(effective, "utf8");
  } catch {
    out.unjudged.push(path); // #565 — 읽지 못한 것은 "고쳤다" 가 아니라 판정 불가다
    return;
  }
  const rec = recorded(log, path, { isTarget: ctx.isTarget });
  // #781 (ADR-111) — 옛 판이 바이트 그대로 깐 파일(지문). 소유 근거가 아니다 — 현행 번들 자리(다시 깔면 현행 판으로 채워진다)는
  // 백업 없이, 그 밖은 백업하고 치운다. 기록이 없는 자리는 그 자리를 쓰는 CLI 가 깔렸고 설치자가 빼지도 비켜 두지도 않았을 때만
  const legacy =
    rec.state !== "sha" &&
    isLegacyHarnessFile(path, hashContent(disk)) &&
    (rec.state === "no-sha" || mayReclaimLegacy(log, projectDir, path));
  const inBundle = legacy && ctx.isTarget(bundlePath(path));
  const verdict = judge({
    op: "remove",
    kind: "harness",
    rec: legacy ? { state: "no-sha" } : rec,
    disk,
    next: legacy ? (inBundle ? disk : null) : templateNext(io.harnessRoot, log, path),
  });
  // leave = 기록 없음(옛 스캔 필터에 걸린 설치자 파일) — 건드리지 않는다
  if (verdict.verdict !== "remove" && verdict.verdict !== "backup+remove") return;
  let backup: string | null = null;
  if (verdict.verdict === "backup+remove") {
    backup = io.write
      ? relative(projectDir, backupFile(effective)).split(sep).join("/")
      : `${relative(projectDir, effective).split(sep).join("/")}.backup-<time>`;
  }
  if (io.write) {
    // 링크 포인터를 먼저 걷는다 — 대상을 먼저 지우면 끊어진 링크는 `existsSync` 로 보이지 않아 남는다
    if (effective !== abs) io.rm(abs);
    io.rm(effective);
  }
  out.removed.push(path);
  out.forgotten.add(path);
  ctx.pruneFrom.push(path);
  if (backup !== null)
    out.backedUp.push({ path, backup, line: legacy && !inBundle ? LEGACY_SAVED : verdict.line });
}

const LEGACY_SAVED =
  "older harness version (byte-identical, not in the current bundle) — saved a copy, removed from live";

/** ⓑ′ 후보 — 지문이 아는 경로 전부와 옛 codex 변환이 번들 스킬을 복사해 둔 `.agents/skills/` 자리. */
function legacyFileCandidates(): string[] {
  return [...LEGACY_HARNESS_FILES.keys()].flatMap((p) =>
    p.startsWith(SKILLS_DIR) ? [p, `.agents/skills/${p.slice(SKILLS_DIR.length)}`] : [p],
  );
}

/**
 * 기록이 없는 자리의 지문 회수 문(B2 · N7) — 그 자리를 쓰는 CLI 가 기록에 있고, 설치자가 뺀 자산(`excluded`)이 아니고, 하네스가
 * 비켜 둔 설치자 파일(`displaced`)의 자리가 아닐 때만. 원본이 옛 하네스 바이트인 트랙 밖 displaced 는 설치자 파일의 기록이 아니다(#807).
 */
function mayReclaimLegacy(log: InstallLog, projectDir: string, path: string): boolean {
  const clis = installedClis(log);
  // #769 — 링크 슬롯의 본문은 claude 도 쓴다(`usersOf`): codex 를 뺀 뒤의 전량 uninstall 도 그 옛 판 사본을 본다
  if (!usersOf(path, projectDir).some((c) => clis.includes(c))) return false;
  if (isExcludedPath(bundlePath(path), excludedIds(log))) return false;
  return !(log.rootFiles ?? []).some(
    (f) => f.path === path && f.change === "displaced" && !isLegacyDisplaced(log, projectDir, f),
  );
}

/**
 * ⓑ″ #781 — 몫 기록이 없는 `.claude/settings.json`(옛 판이 템플릿으로 통째 쓴 파일)에서 옛 템플릿 훅 줄(바이트 그대로)을 걷는다. 이번 실행 뒤
 * 스크립트가 없는 참조만 — 이번에 지운 스크립트(`removed`)는 미리보기에서도 없는 것으로 친다. 스크립트가 남으면(설치자가 같은
 * 이름으로 둔 것) 줄도 남는다. `RETIRED_HOOK_WIRING_REFS` 는 ⓐ 가 따로 걷는다(N8).
 */
function removeLegacyHookWiring(
  log: InstallLog,
  projectDir: string,
  scope: RemovalScope,
  io: RemovalIo,
  removed: ReadonlyArray<string>,
): string[] {
  if (!scope.has(SETTINGS_TARGET) || !installedClis(log).includes("claude")) return [];
  if ((log.portions ?? []).some((p) => p.path === SETTINGS_TARGET)) return [];
  const abs = join(projectDir, SETTINGS_TARGET);
  if (!safeExists(abs) || outsideProjectTarget(projectDir, abs) !== null) return [];
  const claudeDir = join(projectDir, ".claude");
  const gone = LEGACY_HOOK_REFS.filter(
    (r) =>
      !RETIRED_HOOK_WIRING_REFS.includes(r) &&
      (removed.includes(`${CLAUDE_DIR}${r}`) || !safeExists(join(claudeDir, r))),
  );
  // 옛 템플릿 바이트 그대로인 줄만 걷힌다(`removeRetiredHookRefs` 안의 `isLegacyHookLine`) — 고친 줄은 ⓐ 의 안내로 남는다
  return removeRetiredHookRefs(abs, claudeDir, gone, { evenIfScriptExists: true, write: io.write });
}

/**
 * ⓐ 함께 쓰는 파일 — 기록된 몫만 걷는다(설치자 키 · 표 · 훅은 남는다). 하네스가 **만든** 파일(`externalFiles` 에 sha · B1 #13)은
 * 디스크가 기록 그대로면 하네스 것뿐이라 파일째 지우고, 다르면 몫만 걷는다 — `backup+remove` 는 하지 않는다(설치자가 더한 것이
 * 라이브에서 빠진다, ADR-097 D4). `AGENTS.md` 절 모델은 지금 규칙 그대로(#516).
 */
function stripSharedFiles(
  log: InstallLog,
  projectDir: string,
  paths: ReadonlyArray<string>,
  io: RemovalIo,
  out: HarnessRemoval,
  pruneFrom: string[],
): void {
  const made = new Map((log.externalFiles ?? []).map((f) => [f.path, f.sha256]));
  const created = new Set(
    (log.rootFiles ?? []).filter((f) => f.change === "created").map((f) => f.path),
  );
  // 기록이 아무 말도 하지 않고 그 파일을 쓰는 CLI 도 깔린 적 없으면 설치자 파일이다 — 읽지도 않는다(예: codex 를 고르지 않은
  // 설치본의 설치자 `.codex/config.toml` · 멈춘 install 이 손대지 못한 자리 — #600)
  const onRecord = new Set([
    ...(log.portions ?? []).map((p) => p.path),
    ...made.keys(),
    ...(log.rootFiles ?? []).map((f) => f.path),
  ]);
  const clis = installedClis(log);
  const relevant = (path: string): boolean => {
    const owners = ownersOf(path);
    return onRecord.has(path) || owners.length === 0 || owners.some((c) => clis.includes(c));
  };
  for (const path of paths) {
    if (!relevant(path)) continue;
    const abs = join(projectDir, path);
    // N-C — 실체가 프로젝트 밖이면 몫도 걷지 않는다(링크를 따라 쓰면 그 dotfile 을 같이 쓰는 다른 프로젝트의 설정이 바뀐다)
    if (safeExists(abs)) {
      const o = outsideProjectTarget(projectDir, abs);
      if (o !== null) {
        out.outside.push(o);
        continue;
      }
    }
    // 옛 템플릿이 `.claude/hooks/` 밖 스크립트로 깐 은퇴 배선 — 몫 기록에 없어도 하네스 몫이다(닫힌 목록). update 와 같은 함수로
    // 걷는다. 스크립트가 남아 있어도 걷는다 — 남기면 은퇴 스킬 폴더의 스크립트를 계속 부른다(PR-D 재리뷰 NOTE-B)
    if (path === SETTINGS_TARGET && safeExists(abs)) {
      out.retiredWiring = removeRetiredHookRefs(
        abs,
        join(projectDir, ".claude"),
        RETIRED_HOOK_WIRING_REFS,
        { evenIfScriptExists: true, write: io.write },
      );
    }
    const sha = made.get(path);
    if (sha !== undefined && removeHarnessMadeShared(path, sha, projectDir, io, out, pruneFrom)) {
      continue;
    }
    // ⓐ₀ #774 — 기록(`externalFiles`)에 없는 옛 판의 하네스 `AGENTS.md`(v26.83~v26.132 블록 모델 · v26.169 update 가 블록을 붙인
    // 것 포함, N2). 위 `relevant()` 안이다 — 이 파일을 읽는 CLI 가 기록에 없으면 읽지도 않는다(B2)
    if (path === AGENTS_MD && sha === undefined) {
      if (removeUnrecordedLegacyAgentsMd(path, projectDir, io, out, pruneFrom)) continue;
    }
    const r = stripShared({
      projectDir,
      path,
      portions: log.portions ?? [],
      excluded: [...excludedIds(log)],
      remnant: remnantFor(path, log, io.harnessRoot, projectDir, out.legacyWiring),
      remnantLine: remnantLine(path),
      write: io.write,
      // 하네스가 만든 파일(#569 `created` · #13 `externalFiles`)은 몫을 걷고 남는 것이 없으면 파일째 지운다
      removeIfEmpty: created.has(path) || sha !== undefined,
    });
    if (r.fileRemoved) pruneFrom.push(path);
    out.shared.push(r);
  }
}

/** @returns 다 처리했다(true) · 몫만 걷으러 간다(false — 하네스가 만들었지만 그 뒤 바뀐 파일). */
function removeHarnessMadeShared(
  path: string,
  sha: string,
  projectDir: string,
  io: RemovalIo,
  out: HarnessRemoval,
  pruneFrom: string[],
): boolean {
  const abs = join(projectDir, path);
  if (!existsSync(abs)) {
    out.forgotten.add(path);
    return true;
  }
  let effective = abs;
  let current: string;
  try {
    const real = realpathSync(abs);
    if (!statSync(real).isFile()) {
      out.unjudged.push(path);
      return true;
    }
    if (lstatSync(abs).isSymbolicLink()) effective = real;
    current = readFileSync(effective, "utf8");
  } catch {
    out.unjudged.push(path);
    return true;
  }
  if (hashContent(current) !== sha) {
    // #516 — 절 모델 `AGENTS.md` 는 설치자 절을 담는다: 통째 판정을 하지 않고 남긴다(지금 규칙 그대로). #774 — 마커 없는 옛 판의
    // 하네스 파일(머리 지문)은 하네스 절을 걷고 설치자 절만 남긴다(1회 백업). 마커 있는 파일은 그대로 남긴다
    if (path === AGENTS_MD) {
      const verdict = isLegacyHarnessAgentsMd(current)
        ? agentsMdRemainder(current, io.harnessRoot)
        : null;
      if (verdict?.ok === true && verdict.strip.legacyRemoved) {
        removeLegacyAgentsMd(path, abs, effective, verdict.strip, {
          projectDir,
          io,
          out,
          pruneFrom,
        });
      } else out.kept.push(path);
      return true;
    }
    out.forgotten.add(path); // 이제 설치자 파일이다 — 남는 몫은 몫 기록이 말한다
    return false;
  }
  if (path === AGENTS_MD) {
    // #516 — 기준선과 같아도 설치자 절이 들어 있을 수 있다(update 가 이어받아 다시 쓴다) — 하네스 절만 걷는다
    const verdict = agentsMdRemainder(current, io.harnessRoot);
    if (!verdict.ok) {
      out.unjudged.push(path);
      return true;
    }
    // #774 — 걷을 것에 옛 판의 하네스 바이트(꼬리 절 · 옛 파일)가 들었다 — 1회 백업 뒤 걷는다(ADR-111)
    if (verdict.strip.legacyRemoved) {
      removeLegacyAgentsMd(path, abs, effective, verdict.strip, { projectDir, io, out, pruneFrom });
      return true;
    }
    if (verdict.remainder !== null) {
      try {
        // #656 — 걷어낸 뒤 남은 스캐폴드 배너는 거짓이다(하네스가 없는데 "not filled in yet")
        if (io.write) writeFileSync(effective, neutralizeScaffoldBanner(verdict.remainder), "utf8");
        out.stripped.push(path);
        out.forgotten.add(path);
      } catch {
        out.unjudged.push(path); // 쓰기 실패는 남긴 것과 같다
      }
      return true;
    }
  }
  if (io.write) {
    if (effective !== abs) io.rm(abs);
    io.rm(effective);
  }
  // 몫 기록도 함께 지운다 — `--cli` 가 이 결과의 경로를 "판정한 파일" 로 읽어 남은 몫(없음)만 이어 적는다
  out.shared.push({
    path,
    action: "removed",
    line: "",
    removed: [],
    kept: [],
    portions: [],
    fileRemoved: true,
  });
  out.forgotten.add(path);
  pruneFrom.push(path);
  return true;
}

/** 화면 묶음 — `.claude/rules/x.md` → `.claude/` · 루트 파일은 그 이름. */
function topOf(path: string): string {
  const i = path.indexOf("/");
  return i < 0 ? path : `${path.slice(0, i)}/`;
}

/** displaced 되돌리기의 화면 줄 — 전량 · `--only` 가 같은 말을 쓴다. */
function displacedLines(displaced: ReadonlyArray<DisplacedOutcome>, preview: boolean): string[] {
  const lines: string[] = [];
  const restore = displaced.filter((d) => d.verdict === "restore");
  if (preview && restore.length > 0) {
    lines.push(
      `  ○ put back ${restore.length} file(s) of yours (displaced): ${restore.map((d) => d.path).join(" · ")}`,
    );
  }
  for (const d of displaced) {
    if (d.verdict === "restore" && !preview) {
      lines.push(`  ${status.success(`put back  ${d.path} (from ${d.backup})`)}`);
    } else if (d.verdict === "advise") {
      lines.push(`  ${c.yellow("⊘")} ${d.path} — ${d.line}`);
    }
  }
  return lines;
}

/** 이 실행이 되돌리려는 project scope 스킬 자산 — 미리보기는 계획된 단계를 다 성공한 것으로 친다. */
function plannedAssets(plan: ReversePlan, log: InstallLog): InstallLogAsset[] {
  const ids = new Set(plan.reverseSteps.map((s) => s.assetId));
  return log.assets.filter((a) => ids.has(a.id));
}

/** 이 실행이 지울 외부 스킬 자산 파일(project 상대). */
function plannedAssetFiles(plan: ReversePlan, log: InstallLog): string[] {
  return plannedAssets(plan, log).flatMap((a) =>
    a.method === "skill" && a.scope === "project" ? (a.files ?? []).map((f) => f.path) : [],
  );
}

/**
 * #780 — 외부 스킬 자산이 떠나는 자리(기록 파일의 `<root>/skills/<id>/`) 술어. `--only` 의 displaced 되돌리기 범위다 —
 * 그 자산을 처음 더할 때 상류 파일에 덮인 설치자 파일이 그 자리에 `displaced` 로 적혀 있다.
 */
function inAssetSlots(assets: ReadonlyArray<InstallLogAsset>): (path: string) => boolean {
  const slots = new Set(
    assets.flatMap((a) =>
      a.method === "skill" && a.scope === "project"
        ? (a.files ?? []).map((f) => `${f.path.split("/").slice(0, 3).join("/")}/`)
        : [],
    ),
  );
  return (path) => [...slots].some((s) => path.startsWith(s));
}

/** 실행과 미리보기가 같은 결과(`HarnessRemoval`)를 말한다. */
function harnessRemovalLines(
  r: HarnessRemoval,
  log: InstallLog,
  projectDir: string,
  scope: RemovalScope,
  preview: boolean,
  /** 미리보기 전용 — 이 실행이 먼저 지울 다른 파일(#851 사본). 남는 설치자 파일로 세지 않는다. */
  alsoGone: ReadonlyArray<string> = [],
): string[] {
  const lines: string[] = [];
  const groups = new Map<string, { removed: number; backedUp: number }>();
  for (const p of r.removed) {
    const g = groups.get(topOf(p)) ?? { removed: 0, backedUp: 0 };
    g.removed += 1;
    groups.set(topOf(p), g);
  }
  for (const b of r.backedUp) {
    const g = groups.get(topOf(b.path));
    if (g) g.backedUp += 1;
  }
  if (preview) {
    for (const [top, g] of groups) {
      const edited =
        g.backedUp > 0 ? ` (${g.backedUp} with a copy saved beside as *.backup-<time>)` : "";
      lines.push(`  ○ remove ${g.removed} harness file(s) under ${top}${edited}`);
    }
  } else if (groups.size > 0) {
    const parts = [...groups].map(([top, g], i) =>
      i === 0 ? `${top} ${g.removed} harness file(s)` : `${top} ${g.removed}`,
    );
    lines.push(`  ${status.success(`removed  ${parts.join(" · ")}`)}`);
    for (const b of r.backedUp) {
      const what = b.line.includes("<file>.backup-<time>")
        ? b.line.replace("<file>.backup-<time>", b.backup)
        : `${b.line} (${b.backup})`;
      lines.push(`  ${status.success(`backed up  ${b.path} — ${what}`)}`);
    }
  }
  if (r.importStripped) {
    lines.push(
      preview
        ? "  ○ strip harness @import from CLAUDE.md (본문 보존)"
        : `  ${status.success("CLAUDE.md — harness @import removed (본문 보존)")}`,
    );
  }
  if (r.importOutside !== undefined) {
    lines.push(importOutsideLine(r.importOutside, r.removedAnchor !== undefined));
  }
  lines.push(...r.anchor.lines);
  lines.push(...displacedLines(r.displaced, preview));
  for (const path of r.stripped) {
    lines.push(
      preview
        ? `  ○ strip harness sections from ${path} (본문 보존)`
        : `  ${status.success(`${path} — harness sections removed (본문 보존)`)}`,
    );
  }
  for (const l of r.legacyAgentsMd) {
    // #774 — 이름은 하네스 절인데 설치자가 고친 절은 남기고 그 사실을 말한다. 파일째 지울 때 "설치자 몫이 없었다" 는 단언하지 않는다
    const kept =
      l.keptEdited.length > 0
        ? ` · kept ${l.keptEdited.length} section(s) you edited (${l.keptEdited.join(" · ")})`
        : "";
    if (preview) {
      lines.push(
        l.fileRemoved
          ? `  ○ remove ${l.path} (written by an older harness version — a copy is saved first)`
          : `  ○ remove the harness sections written by an older version from ${l.path} — yours stays${kept} (a copy is saved first)`,
      );
    } else {
      lines.push(
        l.fileRemoved
          ? `  ${status.success(`removed  ${l.path} (written by an older harness version — saved a copy: ${l.backup})`)}`
          : `  ${status.success(`${l.path} — removed the harness sections written by an older version — yours stays${kept} (saved a copy: ${l.backup})`)}`,
      );
    }
  }
  for (const path of r.unjudged) {
    lines.push(
      path === AGENTS_MD
        ? `  ${c.yellow("⊘")} ${path} kept — harness sections could not be separated (a file or template could not be read, or the write failed). Remove manually if intended.`
        : `  ${c.yellow("⊘")} ${path} left — could not read it to judge. Remove manually if intended.`,
    );
  }
  lines.push(...outsideLines(r.outside, log));
  for (const path of r.kept) {
    lines.push(
      `  ${c.yellow("⊘")} ${path} kept — modified since install. Remove manually if intended.`,
    );
  }
  if (r.legacyWiring.length > 0) {
    const refs = r.legacyWiring.join(" · ");
    lines.push(
      preview
        ? `  ○ remove harness hook wiring from an older version (script gone) from ${SETTINGS_TARGET}: ${refs}`
        : `  ${status.success(`${SETTINGS_TARGET} — removed harness hook wiring from an older version (script gone): ${refs}`)}`,
    );
  }
  if (r.retiredWiring.length > 0) {
    const refs = r.retiredWiring.join(" · ");
    lines.push(
      preview
        ? `  ○ remove retired harness hook wiring from ${SETTINGS_TARGET}: ${refs}`
        : `  ${status.success(`${SETTINGS_TARGET} — removed retired harness hook wiring: ${refs}`)}`,
    );
  }
  lines.push(...sharedStripLines(r.shared, preview));
  lines.push(...leftFolderLines(r, log, projectDir, scope, preview, alsoGone));
  return lines;
}

/**
 * 밖이라 남긴 자리 — 링크 자리 하나에 한 줄(폴더 링크 아래 여러 파일을 파일마다 말하지 않는다). 같은 경로가 몫 · 파일 기록
 * 양쪽에 있어도 한 번이다.
 */
function outsideLines(outside: ReadonlyArray<OutsideLink>, log: InstallLog): string[] {
  const byLink = new Map<string, OutsideLink>();
  for (const o of outside) if (!byLink.has(o.link)) byLink.set(o.link, o);
  return [...byLink.values()].map((o) =>
    o.link === o.path
      ? `  ${c.yellow("⊘")} ${o.path} kept — link target is outside the project (${o.target}). Not touched; remove manually if intended.`
      : keptOutsideLinkLine(o, log),
  );
}

/**
 * 회수 뒤 CLI 폴더에 남는 설치자 파일 — 이름으로 말한다(3개까지). 백업 파일(`[BACKUPS]` 가 말한다)과 자산 파일(자산 줄이
 * 말한다)은 세지 않는다. 미리보기는 이번에 지울 파일을 빼고 되돌릴 파일을 더해 실행 뒤 모습을 말한다.
 */
function leftFolderLines(
  r: HarnessRemoval,
  log: InstallLog,
  projectDir: string,
  scope: RemovalScope,
  preview: boolean,
  alsoGone: ReadonlyArray<string>,
): string[] {
  const assetFiles = new Set(log.assets.flatMap((a) => (a.files ?? []).map((f) => f.path)));
  // 미리보기는 아직 지우지 않았다 — 이번에 지울 하네스 파일 · 파일째 지울 함께 쓰는 파일을 빼고 센다
  const gone = new Set(
    preview
      ? [...r.removed, ...r.shared.filter((s) => s.fileRemoved).map((s) => s.path), ...alsoGone]
      : [],
  );
  const back = preview ? r.displaced.filter((d) => d.verdict === "restore").map((d) => d.path) : [];
  // 이미 다른 줄이 말한 기록 경로(밖 링크 · 읽지 못함 · 고친 AGENTS.md)는 "설치자 파일" 로 다시 세지 않는다
  const said = (full: string): boolean =>
    r.unjudged.includes(full) ||
    r.kept.includes(full) ||
    r.outside.some((o) => o.path === full || full.startsWith(`${o.link}/`));
  // 기록에 없는 파일을 설치자 것이라 단정하지 않는다 — 옛 판은 자기가 깐 것을 다 적지 않았고(은퇴한 스킬 · 강등된 에이전트 · 옛
  // 커맨드), 그 위에서 새 판이 쓴 기록(`records: "writer"`)도 그것을 이어받지 못한다(PR-D 리뷰 N1 · 재리뷰 BLOCKER-1 ①)
  const whose =
    "not on the install record — yours, or left by an older harness version; delete by hand any that are not yours";
  const lines: string[] = [];
  for (const dir of scope.folders) {
    if (outsideLinkAt(projectDir, dir) !== null) continue; // 밖 링크 줄이 이미 말했다
    const entries = new Map<string, string>();
    for (const n of yoursUnder(projectDir, dir)) {
      const full = `${dir}/${n.name}`;
      // 설치 기록(옛 위치 `.claude/.harness-install.json` 포함) · 런타임 파일은 하네스 것이다 — `settleLog` 가 지운다
      if (full === LEGACY_LOG || RECORD_FILES.includes(full)) continue;
      if (!gone.has(full) && !assetFiles.has(full) && !said(full)) entries.set(n.name, n.shown);
    }
    for (const p of back)
      if (p.startsWith(`${dir}/`)) entries.set(p.slice(dir.length + 1), p.slice(dir.length + 1));
    const shown = [...entries.values()].sort();
    if (shown.length === 0) continue;
    const head = shown.slice(0, LEFT_FILES_SHOWN).join(" · ");
    const more = shown.length > LEFT_FILES_SHOWN ? ` +${shown.length - LEFT_FILES_SHOWN} more` : "";
    const what = `${dir}/ — ${shown.length} file(s) ${whose}: ${head}${more}`;
    lines.push(preview ? `  ○ leave ${what}` : `  ${c.yellow("⊘")} left  ${what}`);
  }
  return lines;
}

/** 폴더 아래 파일과 링크(링크는 따라 들어가지 않는다 — `name → 대상` 으로 말한다). 하네스 백업 이름은 뺀다. */
function yoursUnder(projectDir: string, dir: string): Array<{ name: string; shown: string }> {
  const out: Array<{ name: string; shown: string }> = [];
  const walk = (abs: string, prefix: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const name = `${prefix}${e.name}`;
      if (e.isDirectory()) walk(join(abs, e.name), `${name}/`);
      else if (BACKUP_SUFFIX.test(e.name)) continue;
      else if (e.isSymbolicLink()) {
        let target = "?";
        try {
          target = readlinkSync(join(abs, e.name));
        } catch {
          /* 대상을 못 읽어도 링크가 있다는 사실은 말한다 */
        }
        out.push({ name, shown: `${name} (your link → ${target})` });
      } else out.push({ name, shown: name });
    }
  };
  const abs = join(projectDir, dir);
  try {
    if (!statSync(abs).isDirectory()) return [];
  } catch {
    return [];
  }
  walk(abs, "");
  return out;
}

/**
 * A1 · N8 — `--cli` 는 자산(외부 도구 산출물)을 건드리지 않는다(#528 — 자산은 CLI 소속이 아니다). 그 CLI 자리에 남은 자산을
 * 빼는 길을 한 줄로 말한다 — `assets[].files` 기록이 남으므로 `--only` 가 그대로 동작한다.
 */
function assetsLeftLines(log: InstallLog, projectDir: string, scope: RemovalScope): string[] {
  const lines: string[] = [];
  for (const a of log.assets) {
    const here = (a.files ?? [])
      .map((f) => f.path)
      .filter((p) => scope.has(p) && safeExists(join(projectDir, p)));
    if (here.length === 0) continue;
    const slots = [...new Set(here.map((p) => p.split("/").slice(0, 3).join("/")))].sort();
    lines.push(
      `  ${c.yellow("⊘")} left  ${slots.join(" · ")} (asset ${a.id}) — remove with: agent-harness uninstall --only ${a.id}`,
    );
  }
  return lines;
}

/**
 * ⓔ 하네스 앵커 — 같은 판정 함수(결정 4): 안 고쳤으면 지우고, 고쳤으면 그 파일 하나를 백업하고 지운다.
 * @returns 지웠는가(기록을 뺄지 정한다) · 화면 줄.
 */
function removeAnchor(
  log: InstallLog,
  projectDir: string,
  io: Pick<RemovalIo, "rm" | "write">,
): { removed: boolean; lines: string[] } {
  const rootMd = log.templates?.rootClaudeMd;
  if (!rootMd) return { removed: false, lines: [] };
  const abs = join(projectDir, rootMd.path);
  if (!existsSync(abs)) return { removed: false, lines: [] };
  const outside = outsideProjectTarget(projectDir, abs);
  if (outside !== null) return { removed: false, lines: outsideLines([outside], log) };
  let disk: string;
  try {
    disk = readFileSync(abs, "utf8");
  } catch {
    return {
      removed: false,
      lines: [
        `  ${c.yellow("⊘")} ${rootMd.path} left — could not read it to judge. Remove manually if intended.`,
      ],
    };
  }
  const verdict = judge({
    op: "remove",
    kind: "harness",
    rec: { state: "sha", sha256: rootMd.sha256 },
    disk,
    next: null,
  });
  const edited = verdict.verdict === "backup+remove";
  // 앵커 분리(ADR-060) 전의 옛 기록은 루트 `CLAUDE.md` 자체를 앵커로 적었다 — 그 파일은 설치자 프로젝트의 지시문이다(P5).
  // 고쳤으면 라이브에서 빼지 않고 지금처럼 남긴다(백업이 있어도 프로젝트 지시문이 사라지면 다음 세션이 그것 없이 돈다)
  if (edited && rootMd.path === "CLAUDE.md") {
    return {
      removed: false,
      lines: [
        io.write
          ? `  ${c.yellow("⊘")} ${rootMd.path} kept — modified since install. Remove manually if intended.`
          : `  ○ keep ${rootMd.path} (modified since install — preserved)`,
      ],
    };
  }
  if (!io.write) {
    return {
      removed: true,
      lines: [
        edited
          ? `  ○ remove ${rootMd.path} (you edited it → saved beside as ${rootMd.path}.backup-<time>)`
          : `  ○ remove ${rootMd.path}`,
      ],
    };
  }
  const backup = edited ? relative(projectDir, backupFile(abs)).split(sep).join("/") : null;
  io.rm(abs);
  return {
    removed: true,
    lines: [
      backup === null
        ? `  ${status.success(`${rootMd.path} removed`)}`
        : `  ${status.success(`backed up  ${rootMd.path} — ${verdict.line.replace("<file>.backup-<time>", backup)}`)}`,
    ],
  };
}

/** 설치자 소유 절이 있는 유일한 외부 산출물 — codex · opencode transform 이 같은 이름으로 쓴다. */
const AGENTS_MD = "AGENTS.md";

/**
 * `AGENTS.md` 를 렌더한 템플릿 — 절 경계의 SSOT(ADR-095 D3). 템플릿은 하나다(#642 · ADR-103) — 옛 CLI 판 두 템플릿의
 * 절 이름은 모두 이 템플릿의 절 이름에 들어 있으므로 옛 판으로 쓴 파일도 경계 판정이 같다. 기록의
 * `templates.opencodeDir` 는 더는 읽지 않는다(ADR-097 Consequences 의 남은 자리).
 * 못 읽으면 `null` — 그때는 경계를 판정할 수 없으니 파일을 남긴다(지우는 쪽으로 넘어가지 않는다).
 */
function readAgentsMdTemplate(harnessRoot: string): string | null {
  try {
    return readFileSync(join(harnessRoot, AGENTS_MD_TEMPLATE), "utf8");
  } catch {
    return null;
  }
}

function safeRealpath(abs: string): string | null {
  try {
    return realpathSync(abs);
  } catch {
    return null;
  }
}

/**
 * #656 — 하네스 제거 후 남는 스캐폴드 배너를 정정한다. 배너 문장("SCAFFOLD — not filled in
 * yet…")은 하네스가 쓴 것이므로 지워도 사용자 몫이 아니다 — 그대로 두면 하네스가 없는
 * 프로젝트가 "아직 안 채웠다"고 계속 주장한다. #837 — 표식 한 줄이 아니라 배너 3줄(채우는 법 · 앵커 안내도 하네스가
 * 쓴 거짓이다)을 걷되, **하네스가 쓴 줄과 똑같은 줄만** 걷는다. 인용 블록째 걷으면 배너 바로 아래 설치자가 적은 인용 줄까지
 * 백업 없이 사라진다 — 루트 `CLAUDE.md` 는 sha 판정이 없는 설치자 파일이다.
 */
function neutralizeScaffoldBanner(text: string): string {
  return text
    .split("\n")
    .filter((line) => !SCAFFOLD_BANNER_LINES.has(line.replace(/\r$/, "")))
    .join("\n");
}

/**
 * 기준선과 같은 `AGENTS.md` 를 어떻게 할지 — 실행과 dry-run 이 **같은 술어**를 쓴다.
 * `null` = 하네스 것뿐이라 파일째 삭제, 문자열 = 그 내용으로 다시 써서 설치자 절을 남긴다. `strip.legacyRemoved` = 걷을 것에 옛 판의
 * 하네스 바이트가 들었다(#774 — 호출부가 1회 백업).
 */
function agentsMdRemainder(
  current: string,
  harnessRoot: string,
): { ok: true; remainder: string | null; strip: AgentsMdStripResult } | { ok: false } {
  const template = readAgentsMdTemplate(harnessRoot);
  if (template === null) return { ok: false };
  const strip = stripAgentsMd({
    existing: current,
    template,
    harnessRuleHeadings: ruleHeadings(harnessRoot),
  });
  return { ok: true, remainder: strip.remainder, strip };
}

/**
 * ⓐ₀ #774 — 기록에 없는 `AGENTS.md` 가 옛 판의 하네스 파일(머리 지문)이면 하네스 몫을 걷는다. 아니면 `false`(지금 길 — 첫 접촉 블록
 * 몫 걷기 · 알리기).
 */
function removeUnrecordedLegacyAgentsMd(
  path: string,
  projectDir: string,
  io: RemovalIo,
  out: HarnessRemoval,
  pruneFrom: string[],
): boolean {
  const abs = join(projectDir, path);
  let effective = abs;
  let current: string;
  try {
    const real = realpathSync(abs);
    if (!statSync(real).isFile()) return false;
    if (lstatSync(abs).isSymbolicLink()) effective = real;
    current = readFileSync(effective, "utf8");
  } catch {
    return false; // 없거나 못 읽는다 — 지금 길이 판정한다
  }
  if (!isLegacyHarnessAgentsMd(current)) return false;
  const verdict = agentsMdRemainder(current, io.harnessRoot);
  if (!verdict.ok) {
    out.unjudged.push(path);
    return true;
  }
  removeLegacyAgentsMd(path, abs, effective, verdict.strip, { projectDir, io, out, pruneFrom });
  return true;
}

/**
 * #774 (ADR-111) — 옛 판의 하네스 바이트가 든 `AGENTS.md` 를 걷는다: **먼저 파일 1회 백업**, 그다음 설치자 몫만 남겨 쓰거나(배너 정정
 * — #656) 남는 것이 없으면 지운다. 백업이 실패하면 아무것도 하지 않고 남긴다(손실보다 남김).
 */
function removeLegacyAgentsMd(
  path: string,
  abs: string,
  effective: string,
  strip: AgentsMdStripResult,
  ctx: { projectDir: string; io: RemovalIo; out: HarnessRemoval; pruneFrom: string[] },
): void {
  const { projectDir, io, out } = ctx;
  let backup = `${path}.backup-<time>`;
  try {
    if (io.write) {
      backup = relative(projectDir, backupFile(effective)).split(sep).join("/");
      if (strip.remainder !== null) {
        writeFileSync(effective, neutralizeScaffoldBanner(strip.remainder), "utf8");
      } else {
        if (effective !== abs) io.rm(abs);
        io.rm(effective);
      }
    }
  } catch {
    out.unjudged.push(path); // 백업 · 쓰기 실패는 남긴 것과 같다
    return;
  }
  if (strip.remainder === null) ctx.pruneFrom.push(path);
  out.legacyAgentsMd.push({
    path,
    backup,
    fileRemoved: strip.remainder === null,
    keptEdited: strip.keptEdited,
  });
  out.forgotten.add(path);
  // `--cli` 가 이 파일을 "판정한 파일" 로 읽어 몫 기록(옛 블록)을 비우게 — 남는 하네스 몫은 없다
  out.shared.push({ path, action: "none", line: "", removed: [], kept: [], portions: [] });
}

/**
 * #851 (ADR-112) — 옛 update 가 프로젝트에 만든 global 외부 스킬 사본의 줄. 자리마다 한 줄 · 백업한 파일마다 한 줄 · 남긴 파일마다
 * 한 줄. 미리보기와 실행이 같은 판정(`reclaimGlobalSkillCopies`)의 결과를 받는다.
 */
function globalCopyLines(copies: ReadonlyArray<GlobalCopyReclaim>, preview: boolean): string[] {
  const what = (r: GlobalCopyReclaim): string =>
    `a project copy of ${r.id}, which is on record as installed globally (an older update put it here)`;
  return copies.flatMap((r) => {
    if (preview) {
      const saved =
        r.judged.length > 0
          ? ` — ${r.judged.length} with a copy saved beside as *.backup-<time>`
          : "";
      return [
        ...(r.removed.length > 0 ? [`  ○ remove ${r.slot} (${what(r)}${saved})`] : []),
        ...r.left.map((l) => `  ○ leave ${l.path} — ${l.why}`),
      ];
    }
    return [
      ...(r.removed.length > 0 ? [`  ${status.success(`removed  ${r.slot} — ${what(r)}`)}`] : []),
      ...r.judged.map((j) => `  ${status.success(`backed up  ${j.path} — ${j.line}`)}`),
      ...r.left.map((l) => `  ${c.yellow("⊘")} left  ${l.path} — ${l.why}`),
    ];
  });
}

/**
 * #573 — 외부 도구가 놓은 파일을 **기록된 경로만** 지운다(설계 §1.2 harness 행의 `remove` 규칙).
 *
 * - 기록 sha 그대로 → 지운다. 다르면(설치자가 고쳤다) **그 파일 하나**를 `<file>.backup-<ts>` 로 남기고 지운다.
 * - 링크를 따라간 실체가 프로젝트 밖이면 따라가지 않고 남긴다 — 그 폴더를 같이 쓰는 다른 프로젝트의 것이다.
 * - 기록된 자리가 지금은 링크면 남긴다 — 도구가 놓은 사본이 아니다(설치자·다른 도구가 바꿔 놓았다).
 * - 이미 없으면 할 일이 없다(다시 실행해도 같은 결과 — #676).
 *
 * 읽지 못했거나 백업·삭제가 실패한 파일은 남기고 `ok: false` — `--only` 는 기록을 남겨 다시 시도할 수 있게 한다.
 */
function removeToolFiles(
  files: ReadonlyArray<InstallLogSkillFile>,
  projectDir: string,
  rm: (path: string) => void,
): { ok: boolean; message?: string; notes: string[] } {
  const notes: string[] = [];
  const removed: string[] = [];
  let failed = 0;
  for (const { path, sha256 } of files) {
    const abs = join(projectDir, path);
    let isLink: boolean;
    try {
      isLink = lstatSync(abs).isSymbolicLink();
    } catch {
      continue; // 이미 없다
    }
    const real = safeRealpath(abs);
    if (real !== null && isOutsideProject(projectDir, real)) {
      notes.push(`left ${path} — link target is outside the project (${real})`);
      continue;
    }
    if (isLink) {
      notes.push(`left ${path} — it is a link now, not the copy that was installed`);
      continue;
    }
    try {
      if (hashContent(readFileSync(abs, "utf8")) !== sha256) {
        const backup = backupFile(abs);
        notes.push(`backed up ${path} → ${relative(projectDir, backup)} (changed since install)`);
      }
      rm(abs);
      removed.push(path);
    } catch (e) {
      failed += 1;
      notes.push(`left ${path} — ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const path of removed) pruneEmptyDirsUpward(projectDir, dirname(join(projectDir, path)));
  return failed > 0
    ? { ok: false, message: `${failed} file(s) could not be removed`, notes }
    : { ok: true, notes };
}

/**
 * 파일을 지운 뒤 빈 껍데기로 남은 상위 디렉터리를 `projectDir` 직전까지 걷어낸다.
 *
 * 이게 없으면 `.agents/skills/<id>/` 같은 빈 디렉터리 트리가 남아 "지웠다"는 보고와 디스크가
 * 다른 말을 한다. 비어 있지 않으면 즉시 멈춘다 — 남의 파일이 하나라도 있으면 그 자리는
 * 우리 것이 아니다.
 */
function pruneEmptyDirsUpward(projectDir: string, startDir: string): void {
  let cursor = startDir;
  while (true) {
    const rel = relative(projectDir, cursor);
    // projectDir 자신이거나 그 밖으로 나갔으면 멈춘다.
    if (rel === "" || rel.startsWith(`..${sep}`) || rel === "..") return;
    try {
      if (readdirSync(cursor).length > 0) return;
      rmdirSync(cursor);
    } catch {
      // 이미 없거나 지울 수 없다 — uninstall 을 죽일 이유가 아니다.
      return;
    }
    cursor = dirname(cursor);
  }
}

/**
 * 루트 `CLAUDE.md` 에서 하네스 import 블록만 제거. 마커가 없으면 아무것도 쓰지 않는다.
 *
 * 실패해도 uninstall 을 죽이지 않는다 — 여기서 throw 하면 자산은 이미 다 지운 상태에서
 * 명령이 실패로 끝나고, 사용자는 무엇이 남았는지 알 수 없게 된다 (D16 과 같은 방침).
 */
function stripRootImport(projectDir: string): boolean {
  if (rootClaudeMdOutside(projectDir) !== null) return false;
  const current = readRootClaudeMd(projectDir);
  const withoutImport = current === null ? null : stripHarnessImport(current);
  if (withoutImport === null) return false;
  // #837 — 배너는 방금 걷은 import 와 회수한 앵커 파일을 가리킨다("imported at the bottom of this file") — 같이 정정한다
  const stripped = neutralizeScaffoldBanner(withoutImport);
  try {
    // #653 — 비UTF-8 바이트가 섞인 파일을 문자열 왕복으로 재작성 전에 원시 바이트를 보존한다.
    backupIfLossyUtf8(join(projectDir, "CLAUDE.md"));
    writeFileSync(join(projectDir, "CLAUDE.md"), stripped, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** 미리보기용 — 실행 경로와 **같은 술어**를 쓴다 (미리보기가 실제와 어긋나면 미리보기가 아니다). */
function hasRootImport(projectDir: string): boolean {
  if (rootClaudeMdOutside(projectDir) !== null) return false;
  const current = readRootClaudeMd(projectDir);
  return current !== null && stripHarnessImport(current) !== null;
}

/**
 * #846 (ADR-098) — 루트 `CLAUDE.md` 의 실체가 프로젝트 밖이면(설치 뒤 dotfiles 로 옮기고 링크) import 를 걷지 않는다 — 그 파일은 다른
 * 프로젝트가 같이 쓸 수 있다. 걷을 import 가 있을 때만 그 자리를 돌려준다(화면이 "남김 + 대상" 을 말한다).
 */
function rootImportOutside(projectDir: string): OutsideLink | null {
  const outside = rootClaudeMdOutside(projectDir);
  if (outside === null) return null;
  const current = readRootClaudeMd(projectDir);
  return current !== null && stripHarnessImport(current) !== null ? outside : null;
}

/**
 * #846 리뷰 — 밖이라 남긴 루트 `CLAUDE.md` 에는 import 블록이 그대로 있다. 같은 실행이 앵커를 지우면 그 import 는 없는 파일을
 * 가리키므로, 손으로 걷을 것을 같은 줄이 말한다. 미리보기와 실행이 같은 문구다.
 */
function importOutsideLine(o: OutsideLink, anchorGone: boolean): string {
  const pointing = anchorGone ? ", pointing at the anchor this uninstall removes" : "";
  return `  ${c.yellow("⊘")} CLAUDE.md kept — link target is outside the project (${o.target}). Not touched — its harness @import block (${HARNESS_IMPORT_LINE}) is left in it${pointing} — delete that block by hand.`;
}

function rootClaudeMdOutside(projectDir: string): OutsideLink | null {
  return outsideProjectTarget(projectDir, join(projectDir, "CLAUDE.md"));
}

function readRootClaudeMd(projectDir: string): string | null {
  const path = join(projectDir, "CLAUDE.md");
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/* v8 ignore start — thin dep-inject defaults. tests 는 항상 mock 주입. */
function defaultSpawn(
  cmd: string,
  args: ReadonlyArray<string>,
  opts: { cwd: string },
): SpawnSyncReturns<string> {
  return spawnSync(cmd, [...args], {
    encoding: "utf8",
    stdio: "pipe",
    timeout: 120_000,
    cwd: opts.cwd,
  });
}

function defaultRm(path: string): void {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
  }
}
/* v8 ignore stop */

export function registerUninstallCommand(cli: import("../cli.js").Cli): void {
  cli
    .command("uninstall", "Uninstall harness assets (log-based reverse)")
    .option("--project-dir <path>", "[Project] Target project directory", {
      default: process.cwd(),
    })
    .option("--dry-run", "[Mode] List reverse steps without executing")
    .option(
      "--keep-templates",
      "[Removed in v26.169.0] Rejected — prints the `--only <ids>` that removes only the external assets",
    )
    .option(
      "--only <ids>",
      "[Scope] Remove only these assets (comma-separated ids from `agent-harness list`). Harness files untouched",
    )
    .option(
      "--cli <name>",
      `[Scope] Remove one CLI only (${CLI_BASES.join(" | ")}). Shared files stay until the last user leaves`,
    )
    .option(
      "--track <name>",
      `[Scope] Remove one track only (${TRACKS.join(" | ")}). Files another recorded track also installs stay`,
    )
    .option("--yes", "[Mode] Skip the interactive picker and remove everything (non-interactive)")
    /* v8 ignore next 3 — cac action callback. 분기 판정은 shouldRunInteractive 가 갖고 tests 로 검증. */
    .action(async (options: UninstallOptions) => {
      await dispatchUninstall(options);
    });
}

/**
 * v26.125.0 — 대화형 선택 화면으로 들어갈 것인가.
 *
 * 들어가지 **않는** 조건은 전부 "사용자가 이미 무엇을 원하는지 말한 경우"다:
 *   `--only` = 뺄 대상을 지정함 · `--dry-run` = 미리보기 · `--yes` = 묻지 말라는 명시.
 * 그 외 TTY 라면 화면으로 들어간다 — 플래그 없는 `uninstall` 이 즉시 전량 삭제하던 것이
 * 이 명령에서 가장 위험한 기본값이었다. TTY 가 아니면 이 함수는 false 지만, 플래그 없는 비TTY 실행은 dispatchUninstall 이
 * 거부한다(#561 · lacksRemovalIntent).
 */
export function shouldRunInteractive(options: UninstallOptions, isTty: boolean): boolean {
  if (!isTty) return false;
  if (options.yes || options.dryRun) return false;
  // #746 — 없어진 플래그는 엔진이 거절하고 대체 명령을 알린다. 화면으로 들여보내면 고른 옵션이 그 플래그를 조용히 덮는다
  if (options.keepTemplates) return false;
  // #528 — `--cli` 도 "뺄 대상을 이미 지정한" 경우다(#543 `--track` 도). 화면으로 들여보내면 그 선택이 무시된다.
  return options.only === undefined && options.cli === undefined && options.track === undefined;
}

/* v8 ignore start — 얇은 배선. 판정은 shouldRunInteractive·lacksRemovalIntent, 선택은 uninstall-interactive, 실행은 uninstallAction 이 각각 tests 로 검증. */
async function dispatchUninstall(options: UninstallOptions): Promise<void> {
  // #595 — 설치가 아니면 터미널·플래그를 묻기 전에 `list` · `update` 와 같은 줄로 끝낸다.
  const projectDir = resolve(options.projectDir ?? process.cwd());
  const detected = detectInstallState(projectDir);
  if (detected.state !== "installed") {
    reportNotInstalled(detected, projectDir, console.error);
    process.exit(1);
  }
  // #561 — 터미널 없는 환경(파이프·CI)에서 플래그 없이 실행되면 확인 없이 전량 제거되던
  // 기본값을 거부로 바꾼다. USAGE "Nothing happens until you confirm" 의 비TTY 판이다.
  if (!process.stdin.isTTY && lacksRemovalIntent(options)) {
    console.error(
      status.failure(
        c.red(
          "ERROR: no terminal and no flag saying what to remove — nothing was done. Pass --yes (remove everything), --only <ids>, --cli <name>, --track <name>, or --dry-run.",
        ),
      ),
    );
    process.exit(1);
  }
  if (!shouldRunInteractive(options, Boolean(process.stdin.isTTY))) {
    uninstallAction(options);
    return;
  }
  await runUninstallScreen(projectDir);
}

/**
 * #561 — 사용자가 "무엇을 지우겠다"고 말한 플래그가 하나도 없는가.
 * USAGE L239 가 말하는 네 가지(--only · --cli · --dry-run · --yes)만 의사 표현으로 친다.
 */
export function lacksRemovalIntent(options: UninstallOptions): boolean {
  return (
    options.yes === undefined &&
    options.dryRun === undefined &&
    options.only === undefined &&
    options.cli === undefined &&
    options.track === undefined
  );
}

/**
 * #533 (D8) — 제거 화면 → `uninstallAction`. `agent-harness uninstall`(TTY) 과 위저드 메뉴의
 * Uninstall 이 **이 함수 하나**를 부른다. 화면은 옵션만 만들고 판정은 엔진 pre-flight 가 한다.
 */
export async function runUninstallScreen(
  projectDir: string,
  opts: { embedded?: boolean } = {},
): Promise<void> {
  const picked = await runInteractiveUninstall(projectDir, opts);
  if (!picked.ok || !picked.options) {
    if (picked.reason === "no-log") {
      reportNotInstalled(detectInstallState(projectDir), projectDir, console.error);
      process.exit(1);
    }
    // no-tty 는 위 분기에서 이미 걸러졌고, 나머지(cancelled/nothing-selected)는 정상 종료다.
    return;
  }
  uninstallAction(picked.options);
}
/* v8 ignore stop */

/**
 * Uninstall command — v26.64.0 (ADR-020).
 *
 * 동작:
 *   1. `.uzys-agent-harness/.harness-install.json` 읽기 (구 위치 `.claude/` 폴백).
 *   2. assets[] 별 reverse:
 *      - scope=project: 실제 reverse (`claude plugin uninstall --scope project`, `npm uninstall`, fs rm).
 *      - scope=global: 안내만 (D16 — 글로벌 영역 자동 삭제 금지). 사용자가 직접 명령 실행.
 *   3. templates 폴더(`.claude/` · `.codex/` · `.opencode/`)는 지우지 않고 `<dir>.backup-<time>` 으로
 *      **옮겨 둔다**(사용자 결정 2026-09-27 — 설치자가 거기 둔 자기 파일을 백업 없이 지우지 않는다).
 *      `--keep-templates` 시 보존.
 *      외부 CLI 산출물은 기록(`externalFiles`)대로 회수하되 `AGENTS.md` 는 루트 `CLAUDE.md` 처럼
 *      하네스 절만 걷어내고 설치자 절을 남긴다 (#516).
 *   4. install log 자체도 함께 제거.
 *
 * 옵션:
 *   --dry-run        실제 변경 없이 reverse list 만 출력.
 *   --keep-templates `.claude/`, `.codex/`, `.opencode/` 보존.
 *   --only <ids>     v26.123.0 (F-1c) — 항목별 제거. templates 미변경 + 로그는 남은 자산으로 재기록.
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
  existsSync,
  constants as fsConstants,
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { ADAPTERS, keyId } from "../adapters/index.js";
import { jsonSha } from "../adapters/json-keys.js";
import { AGENTS_BLOCK_NAME, stripHarnessFromAgentsMd } from "../agents-md-merge.js";
import { type OwnedPath, removableFor } from "../cli-ownership.js";
import { renderHarnessMcp } from "../cli-transforms.js";
import { c, status } from "../design.js";
import { gitignoreRender } from "../env-files.js";
import { backupDir, backupFile, backupIfLossyUtf8, listFilesRecursive } from "../fs-ops.js";
import {
  corruptedInstallLogMessage,
  hashContent,
  INSTALL_LOG_DIR,
  type InstallLog,
  type InstallLogAsset,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  installedClis,
  installLogPath,
  legacyInstallLogPath,
  readInstallLogStatus,
  writeInstallLog,
} from "../install-log.js";
import { legacyGitignoreSeed } from "../install-writes.js";
import { renderOpencodeMcp } from "../opencode/opencode-json.js";
import { isOutsideProject } from "../outside-project.js";
import { stripHarnessImport } from "../project-claude-merge.js";
import { excludedIds, kindOf } from "../recorded.js";
import { type SharedStripResult, stripShared } from "../shared-write.js";
import { CLI_BASES, type CliBase, isCliBase, isTrack } from "../types.js";
import { runInteractiveUninstall } from "../uninstall-interactive.js";
import { defaultHarnessRoot } from "./install.js";

export interface UninstallOptions {
  projectDir?: string;
  dryRun?: boolean;
  keepTemplates?: boolean;
  /**
   * v26.123.0 (F-1c) — 항목별 제거. 쉼표 구분 자산 id.
   * 지정 시 templates(`.claude/` 등)은 건드리지 않고, 로그도 지우지 않고 **남은 자산으로 다시 쓴다**.
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
}

export interface UninstallActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  spawn?: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>;
  rm?: (path: string) => void;
  /** `--only` 후 로그 재기록. 실패 경로를 테스트에서 재현하기 위해 주입 가능. */
  writeLog?: (projectDir: string, log: InstallLog) => void;
  /** #516 — `AGENTS.md` 절 경계의 SSOT(템플릿)를 읽을 자리. 테스트는 리포 루트를 주입한다. */
  resolveHarnessRoot?: () => string;
  /**
   * `.claude/` 를 지우는 대신 옮겨 둔다(사용자 결정 2026-09-27). 기본은 reinstall 과 같은
   * `backupDir` — `.claude.backup-<time>` 이름 규약·충돌 회피를 그대로 쓴다. @returns 백업 경로,
   * 옮길 것이 없으면 null.
   */
  moveAside?: (path: string) => string | null;
}

/**
 * CLI 템플릿 디렉터리(`.claude/` · `.codex/` · `.opencode/`)는 **지우지 않고 옮겨 둔다** — 하네스 전용
 * 자리가 아니다. 설치자가 거기 자기 파일을 둔다: `.claude/` 엔 `settings.local.json` · 직접 만든 커맨드 ·
 * `settings.json` 에 더한 권한 줄, `.codex/config.toml` 엔 더한 MCP 서버·모델, `.opencode/` 엔(하네스는
 * ADR-081 뒤로 쓰지 않는다) OpenCode 의 프로젝트 커맨드·에이전트. 통째 rm 은 그 파일들을 백업 없이
 * 지웠다(사용자 결정 2026-09-27 · 같은 날 `.codex/` · `.opencode/` 로 확장 — #533 리뷰 B3).
 */
function templateDirPath(projectDir: string, rel: string): string {
  // 끝의 `/` 를 떼야 `<dir>.backup-*` 형제가 된다(붙이면 백업 자리가 디렉터리 안쪽을 가리킨다).
  return join(projectDir, rel.replace(/\/+$/, ""));
}

function movedAsideLine(projectDir: string, rel: string, backup: string): string {
  return `  ${status.success(`${rel} moved aside → ${relative(projectDir, backup)} (your own files there are kept)`)}`;
}

const MOVE_ASIDE_PREVIEW = (rel: string): string =>
  `  ○ move ${rel} aside → ${rel.replace(/\/+$/, "")}.backup-<time> (your own files there stay in the backup)`;

/** 기록된 템플릿 디렉터리 — 전량 제거가 옮겨 둘 자리. */
function recordedTemplateDirs(log: InstallLog): string[] {
  // #650 — 필드가 빠진 기록(버전 스큐·수동 편집)에서 무방비 접근으로 죽지 않는다.
  return [log.templates?.claudeDir, log.templates?.codexDir, log.templates?.opencodeDir].filter(
    (d): d is string => typeof d === "string",
  );
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
 * `executeReverse` → `removeTemplates` → `settleLog` → `advisoryLines` → `summarize`).
 * 남은 것은 early return 3개(로그 없음 / 모르는 id / dry-run)와 호출 순서뿐 — 더 쪼개면
 * 그 순서가 흩어진다.
 */
export function uninstallAction(options: UninstallOptions, deps: UninstallActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const spawn = deps.spawn ?? defaultSpawn;
  const rm = deps.rm ?? defaultRm;
  const writeLog = deps.writeLog ?? writeInstallLog;
  const moveAside = deps.moveAside ?? backupDir;
  const harnessRoot = (deps.resolveHarnessRoot ?? defaultHarnessRoot)();

  const projectDir = resolve(options.projectDir ?? process.cwd());
  // #640 — 깨진 기록(파싱은 되지만 필수 필드 결번)에서 TypeError 스택트레이스로 죽던 경로.
  const logStatus = readInstallLogStatus(projectDir);
  if (logStatus.status === "corrupted") {
    err(c.red(`ERROR: ${corruptedInstallLogMessage(projectDir)}`));
    exit(1);
    return;
  }
  const installLog = logStatus.log;
  if (!installLog) {
    err(status.failure(c.red(`ERROR: install log not found at ${installLogPath(projectDir)}`)));
    err(c.dim("       Was this project installed by agent-harness? Nothing to uninstall."));
    exit(1);
    return;
  }

  // #528 — CLI 하나만 빼는 경로. 전량 제거와 술어가 달라(표 기반) 이 자리에서 갈린다.
  if (options.cli !== undefined) {
    removeCliAction(
      { options, installLog, projectDir, harnessRoot },
      { log, err, exit, rm, writeLog, moveAside },
    );
    return;
  }

  const selectedIds = parseOnly(options.only);
  // `--only ,` 처럼 값이 있는데 id 가 하나도 안 나오면 **전량 제거로 흘려보내지 않는다** —
  // 하나만 빼려던 사용자가 templates 까지 잃는다. 무응답보다 명시적 거절이 안전하다.
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
  // `--only` 는 자산만 건드린다 — templates 를 지우면 "하나만 빼기"가 아니게 된다.
  const keepTemplates = options.keepTemplates || selectedIds !== null;

  // v26.124.0 (F-1f) — `.claude/` 밖 루트 파일 안내. `--only` 는 특정 자산만 건드리는 작업이라
  // 설치 전반이 만든 루트 파일은 대상이 아니다. 구 로그(rootFiles 부재)는 빈 배열 = 안내 없음.
  // #551 PR-3 — 기록에 옮겨 둘 디렉터리 안의 항목(`.claude/settings.json` created · displaced)이 생겼다. 그 자리는
  // 디렉터리와 함께 백업으로 가므로 "남는 것" 으로 예고하지 않는다(실행 뒤 안내는 원래 부재로 걸렀다).
  const movedDirs = keepTemplates ? [] : recordedTemplateDirs(installLog);
  // #569 — 루트의 함께 쓰는 파일(`.mcp.json` · `.gitignore`)은 이제 하네스 몫을 걷는다 — 걷은 것·남긴 것은 걷는 줄이
  // 말하므로 "남는 것" 으로 다시 나열하지 않는다. `--keep-templates` 는 걷지 않으므로 그대로 나열한다.
  const sharedPaths = keepTemplates ? [] : [...CLI_SHARED, ...ROOT_SHARED];
  const rootFiles = withSkillsLock(
    selectedIds
      ? []
      : (installLog.rootFiles ?? []).filter(
          (f) => !underAny(f.path, movedDirs) && !(ROOT_SHARED.includes(f.path) && !keepTemplates),
        ),
    targetAssets,
    projectDir,
  );
  // #551 PR-3 — install 이 `.uzys-agent-harness/` 의 하네스 스크립트를 `externalFiles` 에 적는다. 그 디렉터리는
  // 기록 파일과 함께 통째로 지워지므로(`settleLog`) 여기서 따로 회수·보고하지 않는다 — 따로 보고하면 고친 파일을
  // "kept" 라 말한 뒤 디렉터리째 지운다. 파일 단위 회수는 설계 §9 PR-7.
  // #644 — 전역 `~/.codex/config.toml` 의 trust 항목은 `--only`(자산만)의 대상이 아니다. 지우지 않고 알리기만 한다(D16).
  const globalTrust = selectedIds ? undefined : installLog.codexTrust;
  const templatesLog: InstallLog = {
    ...installLog,
    externalFiles: (installLog.externalFiles ?? []).filter(
      (f) => !f.path.startsWith(`${INSTALL_LOG_DIR}/`),
    ),
  };

  // #676 — 지운 것을 셈해 둔다. 중간에 멈추면 이미 한 일을 이 목록으로 말한다.
  const journal: string[] = [];
  let filesRemoved = 0;
  const rmJ = (path: string): void => {
    rm(path);
    filesRemoved += 1;
  };
  const moveAsideJ = (path: string): string | null => {
    const backup = moveAside(path);
    if (backup)
      journal.push(`moved ${relative(projectDir, path)} aside → ${relative(projectDir, backup)}`);
    return backup;
  };

  const plan = planReverse(targetAssets, { spawn, projectDir, rm: rmJ, movedDirs });
  for (const line of headerLines(installLog, selectedIds, targetAssets.length)) log(line);

  if (options.dryRun) {
    for (const line of dryRunLines(
      plan,
      templatesLog,
      projectDir,
      keepTemplates,
      rootFiles,
      harnessRoot,
      sharedPaths,
      globalTrust,
    )) {
      log(line);
    }
    exit(0);
    return;
  }

  // #676 — 되돌릴 수 없는 제거(플러그인 · npm · 스킬 파일)보다 **먼저** 로컬 사전 조건을 본다. 쓸 수 없는 자리가 하나라도
  // 있으면 아무것도 하지 않고 멈춘다 — 앞의 제거만 끝나고 백업 생성에서 죽으면 반쯤 지운 프로젝트가 남는다.
  const blocked = unwritablePaths({
    projectDir,
    installLog: templatesLog,
    targetAssets,
    selectedIds,
    keepTemplates,
    movedDirs,
    sharedPaths,
  });
  if (blocked.length > 0) {
    err(status.failure(c.red("ERROR: uninstall cannot write here — nothing was removed:")));
    for (const p of blocked) err(c.dim(`       · ${p === "." ? "the project folder" : p}`));
    err(c.dim("       Fix the permissions, then run the same command again."));
    exit(1);
    return;
  }

  // 두 사실을 분리해서 쓴다 — 셋을 하나로 묶다 리뷰 3라운드 내리 회귀가 났다.
  //   `.claude/` 가 남는가  = keepTemplates   (수기 안내 대상 여부)
  //   install log 가 남는가 = `--only` 인가    (settleLog: --only 만 재기록, 나머지는 삭제)
  const logSurvives = selectedIds !== null;

  let reversed: ReturnType<typeof executeReverse>;
  try {
    reversed = executeReverse(plan, log, logSurvives, journal);
    if (!keepTemplates) {
      // #551 R1 · 리뷰 NOTE-3 — 함께 쓰는 파일의 하네스 블록은 루트 `CLAUDE.md` import 블록보다 **먼저** 걷는다(붙인
      // 순서의 역순). `AGENTS.md` 가 `CLAUDE.md` 로의 링크면 한 파일에 두 블록이 붙는데, import 를 먼저 걷으면 그 둘레
      // 빈 줄이 정리돼 뒤 블록을 걷을 때 설치자 원본의 끝 개행까지 빠진다.
      const sharedStrips = stripCliShared(installLog, projectDir, harnessRoot, sharedPaths, true);
      for (const r of sharedStrips) {
        if (r.removed.length > 0) journal.push(`removed the harness part from ${r.path}`);
      }
      const { rootClaudeMdKept, importStripped, external, moved } = removeTemplates(
        templatesLog,
        projectDir,
        { rm: rmJ, moveAside: moveAsideJ },
        harnessRoot,
      );
      for (const m of moved) log(movedAsideLine(projectDir, m.rel, m.backup));
      // 셋 다 없는 설치(antigravity 단독)도 있다 — 아무 줄도 안 찍으면 templates 를 빠뜨린 것처럼 읽힌다.
      if (recordedTemplateDirs(installLog).length === 0) {
        log(`  ${status.success("templates removed: (none)")}`);
      }
      for (const line of externalRemovalLines(external)) log(line);
      for (const line of sharedStripLines(sharedStrips, false)) log(line);
      if (importStripped) {
        log(`  ${status.success("CLAUDE.md — harness @import removed (본문 보존)")}`);
      }
      if (rootClaudeMdKept) {
        const kept = installLog.templates.rootClaudeMd?.path ?? "CLAUDE.md";
        log(
          `  ${c.yellow("⊘")} ${kept} kept — modified since install. Remove manually if intended.`,
        );
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
  const { succeeded, failed, removedIds } = reversed;

  const logWriteFailed = settleLog(
    { installLog, projectDir, selectedIds, removedIds },
    { log, err, rm, writeLog },
  );

  // dry-run 과 같은 인자를 넘겨야 미리보기가 실행 결과와 맞는다.
  for (const line of advisoryLines(
    plan,
    projectDir,
    rootFiles,
    options.keepTemplates === true,
    globalTrust,
  )) {
    log(line);
  }

  const outcome = summarize({
    succeeded,
    failed,
    logWriteFailed,
    // 제거된 것도 없고 templates 도 안 지웠는데, 사용자에게 줄 방법조차 없을 때만 실패다.
    //   ① `--only` = "이걸 빼라"는 특정 요청 — 하나도 못 뺐으면 요청 불이행 (C1).
    //   ② 자동 경로가 없는 자산이 남았으면 — 안내할 명령조차 없다 (R1).
    //   ③ 반면 global 자산만 남은 경우는 **정확한 수기 명령을 출력했으므로** 성공이다.
    //      D16 설계대로의 정상이고, 여기까지 묶으면 global scope 사용자는 exit 0 을 영원히
    //      못 받는다 (로그가 지워져 재시도하면 더 나빠진다).
    nothingDone: succeeded === 0 && keepTemplates && (logSurvives || plan.noReversePath.length > 0),
  });
  log("");
  log(outcome.line);
  exit(outcome.code);
}

/**
 * #676 — 이번 실행이 바꿀 자리 중 쓸 수 없는 것(project 상대, `.` = 프로젝트 폴더). 실행과 같은 대상을 본다:
 * 전량이면 프로젝트 폴더(템플릿 디렉터리를 옮기고 설치 기록을 지운다) · `--only` 면 설치 기록 폴더 · npm 자산이면
 * 프로젝트 폴더(`package.json`) · 기록된 도구 파일과 `.agents/` 하네스 파일은 그 파일이 든 폴더 · 몫을 걷을 함께 쓰는
 * 파일은 그 파일. 프로젝트 밖 링크 너머는 건드리지 않으므로 보지 않는다. 없는 자리는 할 일이 없어 보지 않는다.
 */
function unwritablePaths(ctx: {
  projectDir: string;
  installLog: InstallLog;
  targetAssets: ReadonlyArray<InstallLogAsset>;
  selectedIds: string[] | null;
  keepTemplates: boolean;
  movedDirs: ReadonlyArray<string>;
  sharedPaths: ReadonlyArray<string>;
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
  if (!ctx.keepTemplates) {
    const recordedShared = new Set((installLog.portions ?? []).map((p) => p.path));
    for (const p of ctx.sharedPaths) {
      if (recordedShared.has(p) && existsSync(join(projectDir, p))) need.add(p);
    }
    for (const f of installLog.externalFiles ?? []) {
      if (!underAny(f.path, ctx.movedDirs)) parentOf(f.path);
    }
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
  return { line: status.success(c.green(`uninstall complete (${r.succeeded} asset(s))`)), code: 0 };
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
): { succeeded: number; failed: number; removedIds: string[] } {
  let succeeded = 0;
  let failed = 0;
  const removedIds: string[] = [];
  for (const step of plan.reverseSteps) {
    const result = step.execute();
    if (result.ok) {
      log(`  ${status.success(step.label)}`);
      removedIds.push(step.assetId);
      journal?.push(`removed ${step.assetId}`);
      succeeded++;
    } else {
      log(`  ${c.yellow("⊘")} ${step.label}  (${result.message ?? "failed"})`);
      failed++;
    }
    for (const note of result.notes ?? []) log(c.dim(`    ↳ ${note}`));
  }
  // 자동 되돌리기 경로가 없는 자산은 **말한다.** 조용히 넘기면 `uninstall complete` 가
  // 아무것도 안 한 실행에 붙어 거짓 보고가 된다 (no-false-ship).
  // "기록 유지"는 **로그가 남을 때만** 참이다. `--keep-templates` 는 `.claude/` 를 남기면서도
  // 로그는 지우므로(settleLog), templates 보존 여부로 판단하면 지워질 기록을 유지한다고 말한다.
  const tail = logSurvives ? "자동 되돌리기 경로 없음, 기록 유지" : "자동 되돌리기 경로 없음";
  for (const asset of plan.noReversePath) {
    log(`  ${c.yellow("⊘")} ${asset.id} (${asset.method}) — ${tail}`);
    for (const hint of plan.hints.get(asset.id) ?? []) log(c.dim(`    ↳ ${hint}`));
  }
  return { succeeded, failed, removedIds };
}

/** 제거 후 로그 처리. @returns 재기록에 실패했는가 (실패해도 uninstall 을 죽이지 않는다). */
function settleLog(
  ctx: {
    installLog: InstallLog;
    projectDir: string;
    selectedIds: string[] | null;
    removedIds: string[];
  },
  io: {
    log: (msg: string) => void;
    err: (msg: string) => void;
    rm: (path: string) => void;
    writeLog: (projectDir: string, log: InstallLog) => void;
  },
): boolean {
  const { installLog, projectDir, selectedIds, removedIds } = ctx;
  if (selectedIds) {
    // v26.123.0 (F-1c) — 로그를 지우는 게 아니라 **되돌린 것만 빼고 다시 쓴다**.
    // 실패한 항목은 남긴다 — 실제로 안 지워진 걸 기록에서 지우면 그게 곧 거짓 기록이다.
    const remaining = installLog.assets.filter((a) => !removedIds.includes(a.id));
    try {
      io.writeLog(projectDir, { ...installLog, assets: remaining });
      io.log(`  ${status.success(`install log updated (${remaining.length} asset(s) remain)`)}`);
    } catch (e) {
      // 되돌리기는 이미 끝난 뒤다 — 스택트레이스로 죽으면 무엇이 지워졌는지도 사라진다.
      io.err(status.failure(c.red(`ERROR: install log 갱신 실패 — ${installLogPath(projectDir)}`)));
      io.err(c.dim(`       ${e instanceof Error ? e.message : String(e)}`));
      io.err(c.dim(`       실제로 제거된 자산: ${removedIds.join(", ") || "(없음)"}`));
      return true;
    }
  } else {
    // v26.135.0 (#253) — 로그가 `.claude/` 밖으로 나왔다. 예전엔 templates 제거가 `.claude/` 를
    // 통째로 지우며 로그도 딸려 갔지만 이제 그 경로가 없다 — **templates 보존 여부와 무관하게**
    // 여기서 지운다. 디렉터리째 지우는 이유: `.uzys-agent-harness/` 는 하네스 전용이라
    // 파일만 지우면 빈 디렉터리가 남고, 그러면 "전부 지웠다"가 거짓이 된다.
    io.rm(join(projectDir, INSTALL_LOG_DIR));
    // v26.134.1 이하로 설치한 프로젝트의 잔재. keepTemplates 면 `.claude/` 가 살아남으므로
    // 여기서 안 지우면 다음 실행이 그 구 파일을 읽어 **이미 지운 자산을 다시 보고**한다.
    io.rm(legacyInstallLogPath(projectDir));
    io.log(`  ${status.success("install log removed")}`);
  }
  return false;
}

/** dry-run 미리보기 — 실행 경로와 같은 판정을 쓴다 (미리보기가 실제와 어긋나면 미리보기가 아니다). */
function dryRunLines(
  plan: ReversePlan,
  installLog: InstallLog,
  projectDir: string,
  keepTemplates: boolean,
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  harnessRoot: string,
  sharedPaths: ReadonlyArray<string>,
  globalTrust: InstallLog["codexTrust"],
): string[] {
  const lines = [c.yellow("[DRY RUN] reverse list (실제 변경 없음):"), ""];
  if (plan.reverseSteps.length === 0) {
    lines.push(c.dim("  (no project-scope assets to reverse)"));
  }
  lines.push(...plan.reverseSteps.map((s) => `  ○ ${s.label}`));
  // #607 — 실제 실행이 수행하는 단계는 전부 미리보기에 있어야 한다. 마지막 단계인
  // 설치 기록 디렉터리 제거가 빠져 있어 "전체 역순 단계"를 보고 승인한 사용자가
  // 실제 실행에서 겪는 변화가 계획보다 하나 많았다.
  lines.push("  ○ remove install record (.uzys-agent-harness/ — 로그·헬퍼 스크립트·차단 로그)");
  lines.push(
    ...plan.noReversePath.flatMap((a) => [
      c.dim(`  ⊘ ${a.id} (${a.method}) — 자동 되돌리기 경로 없음, 기록 유지`),
      ...(plan.hints.get(a.id) ?? []).map((h) => c.dim(`    ↳ ${h}`)),
    ]),
  );
  if (!keepTemplates) {
    const dirs = recordedTemplateDirs(installLog);
    for (const rel of dirs) {
      if (existsSync(join(projectDir, rel))) lines.push(MOVE_ASIDE_PREVIEW(rel));
    }
    if (dirs.length === 0) lines.push("  ○ remove templates: (none)");
    const rootMd = installLog.templates.rootClaudeMd;
    if (rootMd) {
      lines.push(
        rootClaudeMdModified(installLog, projectDir)
          ? `  ○ keep ${rootMd.path} (modified since install — preserved)`
          : `  ○ remove ${rootMd.path}`,
      );
    }
    if (hasRootImport(projectDir)) {
      lines.push("  ○ strip harness @import from CLAUDE.md (본문 보존)");
    }
    // 옮겨 둘 디렉터리 안의 기록 파일은 그 디렉터리와 함께 백업으로 간다 — 따로 "keep"·"remove" 로
    // 예고하면 실행과 다른 말이 된다(리뷰 B3: `keep .codex/config.toml … preserved` 라 해 놓고 지웠다).
    lines.push(...previewExternalLines(installLog, projectDir, harnessRoot, dirs));
    lines.push(
      ...sharedStripLines(
        stripCliShared(installLog, projectDir, harnessRoot, sharedPaths, false),
        true,
      ),
    );
  }
  lines.push(...advisoryLines(plan, projectDir, rootFiles, keepTemplates, globalTrust), "");
  return lines;
}

/** global(D16) + 루트 파일 안내. dry-run 과 실행 경로가 같은 함수를 쓴다. */
function advisoryLines(
  plan: ReversePlan,
  projectDir: string,
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  keepTemplates = false,
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
      c.dim(`      [projects."${globalTrust.projectDir}"]`),
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
  // templatesKept 와 무관하다 — `.claude/` 를 통째로 지우는 경로야말로 밖에 남는 것을
  // 사용자가 존재조차 모르게 되는 경우다. 그게 F-1f 가 잡는 구멍이다.
  // #626 — `--keep-templates` 에서는 movedDirs 가 비어 ROOT 필터가 풀리는데, 그러면
  // `.claude/settings.json` 같은 **안쪽** 파일이 "밖에 남는 것" 헤더 아래 나열된다 —
  // keep-templates 는 말 그대로 templates 를 남기는 것이라 안쪽은 헤더가 거짓말을 한다.
  lines.push(...rootFileAdvisoryLines(rootFiles, projectDir, keepTemplates));
  // #570 — 하네스가 남긴 백업 산물(디렉터·파일) 공지. 색인(.uzys-agent-harness/)은 이번에
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
 * #570 — 전량 uninstall 후 남을 백업 산물을 나열한다. 지우지 않는다(사용자 편집분이 들어
 * 있을 수 있다) — "자동으로 지우지 않는다" 규칙의 백업 판. 대상: 루트의 `<dir>.backup-<ts>`
 * 디렉터리 셋 + `.agents/` 아래 파일 백업(update 가 편집분을 보존하며 남긴 것).
 */
function backupArtifactAdvisoryLines(projectDir: string): string[] {
  const stampRe = /\.backup-\d{8}T\d{6}$/;
  const found: string[] = [];
  for (const e of readdirSync(projectDir, { withFileTypes: true })) {
    if ([".claude", ".codex", ".opencode"].some((d) => e.name.startsWith(`${d}.backup-`))) {
      found.push(e.name);
    } else if (e.isFile() && stampRe.test(e.name)) {
      found.push(e.name);
    }
  }
  const agents = join(projectDir, ".agents");
  if (existsSync(agents)) {
    for (const rel of listFilesRecursive(agents)) {
      if (stampRe.test(rel)) found.push(`.agents/${rel}`);
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
  keepTemplates = false,
): string[] {
  // #626 — keepTemplates 한정: 헤더를 바꾼다. "밖에 남는 것"이 아니라 "남는 것" 전체가
  // 참이 된다(안쪽 경로도 살아 있으므로). 나열 자체는 같은 rootFiles 에서.
  const header = keepTemplates
    ? "[LEFT] uninstall 후 남는 것 — templates 보존(.claude/ 등) + 루트 파일 (자동으로 지우지 않는다):"
    : "[ROOT] `.claude/` 밖에 남는 것 (자동으로 지우지 않는다):";
  const present = rootFiles.filter((f) => existsSync(join(projectDir, f.path)));
  if (present.length === 0) return [];
  return [
    "",
    c.yellow(header),
    ...present.flatMap((f) => [
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
 * 판정 + #516 `AGENTS.md` 절 걷어내기) · `stripRootImport` · `rootClaudeMdModified`. 여기서
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
  moveAside: (path: string) => string | null;
}

/** CLI → 그 CLI 를 뺄 때 함께 지워야 할 `templates` 필드. antigravity 는 그 기록이 없다. */
const TEMPLATE_DIR_FIELD: Partial<Record<CliBase, "claudeDir" | "codexDir" | "opencodeDir">> = {
  claude: "claudeDir",
  codex: "codexDir",
  opencode: "opencodeDir",
};

/**
 * 전제조건 검사. **아무것도 실행하기 전에** 전부 본다 (`--only` 의 pre-flight 와 같은 규율) —
 * 절반만 지우고 거절하면 되돌릴 방법이 없다.
 *
 * @returns 뺄 CLI. `null` 이면 이미 `exit` 했다.
 */
function resolveCliTarget(ctx: RemoveCliCtx, io: RemoveCliIo): CliBase | null {
  const { options, installLog } = ctx;
  // `--only`(자산만) · `--keep-templates`(파일을 남긴다)는 이 명령이 하려는 일과 반대다.
  // 조용히 한쪽을 이기게 하면 사용자는 자기가 시킨 것과 다른 결과를 받는다.
  if (options.only !== undefined || options.keepTemplates) {
    io.err(status.failure(c.red("ERROR: --cli 는 --only · --keep-templates 와 함께 쓸 수 없다")));
    io.err(
      c.dim(
        "       CLI 하나 제거: uninstall --cli <name>  /  자산 하나 제거: uninstall --only <id>",
      ),
    );
    io.exit(1);
    return null;
  }
  const target = (options.cli ?? "").trim();
  if (!isCliBase(target)) {
    io.err(status.failure(c.red(`ERROR: Invalid --cli value: ${target || "(empty)"}`)));
    io.err(c.dim(`       Must be one of: ${CLI_BASES.join(" | ")}`));
    io.exit(1);
    return null;
  }
  const installed = installedClis(installLog);
  if (!installed.includes(target)) {
    io.err(status.failure(c.red(`ERROR: ${target} is not installed in this project`)));
    io.err(c.dim(`       installed: ${installed.join(", ") || "(none)"}`));
    io.exit(1);
    return null;
  }
  // 마지막 하나는 거절한다 — 전량 삭제 경로를 두 개 두면 한쪽만 고쳐지는 날이 온다.
  if (installed.length <= 1) {
    io.err(status.failure(c.red(`ERROR: ${target} 는 이 프로젝트의 마지막 CLI 다`)));
    io.err(c.dim("       전량 제거는 `agent-harness uninstall` 을 쓴다 (자산·설치 기록까지 함께)"));
    io.exit(1);
    return null;
  }
  return target;
}

/** 이 경로가 회수 대상 자리에 속하는가. `/` 로 끝나는 항목은 접두 디렉터리다. */
function underAny(path: string, owned: ReadonlyArray<string>): boolean {
  return owned.some((o) => (o.endsWith("/") ? path.startsWith(o) : path === o));
}

/** 회수 대상을 `kind` 별로 나눈 것 — dry-run 과 실행이 같은 목록을 읽는다. */
interface CliRemovalPlan {
  dirs: string[];
  /** #551 R1 — 몫만 걷는 CLI 쪽 함께 쓰는 파일(이 CLI 가 마지막 사용자인 것만). */
  shared: string[];
  /** `externalFiles` 중 이번에 판정할 항목만 담은 로그 사본. 전량 경로 함수에 그대로 넘긴다. */
  scoped: InstallLog;
  anchor: boolean;
  importBlock: boolean;
}

function planCliRemoval(
  target: CliBase,
  remaining: ReadonlyArray<CliBase>,
  installLog: InstallLog,
): CliRemovalPlan {
  const { exclusive, sharedNowUnowned } = removableFor(target, remaining);
  const owned: ReadonlyArray<OwnedPath> = [...exclusive, ...sharedNowUnowned];
  const recorded = owned.filter((o) => o.kind === "recorded").map((o) => o.path);
  const scopedFiles: ReadonlyArray<InstallLogSkillFile> = (installLog.externalFiles ?? []).filter(
    (f) => underAny(f.path, recorded),
  );
  return {
    dirs: owned.filter((o) => o.kind === "dir").map((o) => o.path),
    shared: CLI_SHARED.filter((p) => recorded.includes(p)),
    scoped: { ...installLog, externalFiles: scopedFiles },
    anchor: owned.some((o) => o.kind === "anchor"),
    importBlock: owned.some((o) => o.kind === "import-block"),
  };
}

function removeCliHeader(
  target: CliBase,
  installed: ReadonlyArray<CliBase>,
  remaining: ReadonlyArray<CliBase>,
): string[] {
  return [
    "",
    c.bold(`uzys-agent-harness · uninstall --cli ${target}`),
    "",
    c.dim(`  installed: ${installed.join(", ")}`),
    c.dim(`  removing:  ${target}`),
    c.dim(`  remaining: ${remaining.join(", ")}`),
    "",
  ];
}

/** dry-run 미리보기 — 실행 경로와 **같은 술어**를 쓴다. */
function removeCliDryRunLines(
  plan: CliRemovalPlan,
  ctx: RemoveCliCtx,
  remaining: ReadonlyArray<CliBase>,
): string[] {
  const { installLog, projectDir, harnessRoot } = ctx;
  const lines = [c.yellow("[DRY RUN] CLI 제거 미리보기 (실제 변경 없음):"), ""];
  for (const dir of plan.dirs) {
    if (existsSync(join(projectDir, dir))) lines.push(MOVE_ASIDE_PREVIEW(dir));
  }
  lines.push(...previewExternalLines(plan.scoped, projectDir, harnessRoot));
  lines.push(
    ...sharedStripLines(
      stripCliShared(installLog, projectDir, harnessRoot, plan.shared, false),
      true,
    ),
  );
  const rootMd = plan.anchor ? installLog.templates.rootClaudeMd : undefined;
  if (rootMd && existsSync(join(projectDir, rootMd.path))) {
    lines.push(
      rootClaudeMdModified(installLog, projectDir)
        ? `  ○ keep ${rootMd.path} (modified since install — preserved)`
        : `  ○ remove ${rootMd.path}`,
    );
  }
  if (plan.importBlock && hasRootImport(projectDir)) {
    lines.push("  ○ strip harness @import from CLAUDE.md (본문 보존)");
  }
  lines.push(`  ○ install log updated (clis: ${remaining.join(", ")})`, "");
  return lines;
}

/**
 * 하네스 앵커 파일 회수. 전량 경로와 같은 규칙 — install 원본 그대로일 때만 지운다.
 * @returns 실제로 지웠는가 (기록을 뺄지 결정한다 — 남긴 파일의 기록까지 지우면 전량 uninstall 이
 *   그 파일을 더는 안내하지 못한다).
 */
function removeHarnessAnchor(ctx: RemoveCliCtx, io: RemoveCliIo): boolean {
  const { installLog, projectDir } = ctx;
  const rootMd = installLog.templates.rootClaudeMd;
  if (!rootMd || !existsSync(join(projectDir, rootMd.path))) return false;
  if (rootClaudeMdModified(installLog, projectDir)) {
    io.log(
      `  ${c.yellow("⊘")} ${rootMd.path} kept — modified since install. Remove manually if intended.`,
    );
    return false;
  }
  io.rm(join(projectDir, rootMd.path));
  io.log(`  ${status.success(`${rootMd.path} removed`)}`);
  return true;
}

/**
 * 제거 후 로그. `assets` 는 손대지 않는다 — 자산은 CLI 소속이 아니다(스킬 자리는 표가 본다).
 *
 * **뺀 CLI 의 흔적은 기록에서도 함께 뺀다.** 남겨 두면 기록이 디스크와 다른 말을 하고, 그
 * 값을 읽는 쪽이 이미 있다: `external-installer.ts` 는 `spec.cli` 를 외부 스킬 refresh 의
 * 대상 CLI 로 쓴다 — 방금 뺀 CLI 를 대상으로 지정하게 된다(독립 리뷰 N2). 회수한 전용
 * 디렉터리(`.codex/` 등) 아래의 `externalFiles` 항목도 같은 이유로 지운다 — 그 파일들은
 * 디렉터리와 함께 이미 사라졌다.
 */
function settleCliLog(
  ctx: RemoveCliCtx,
  target: CliBase,
  remaining: ReadonlyArray<CliBase>,
  recovered: ReadonlySet<string>,
  anchorRemoved: boolean,
  removedDirs: ReadonlyArray<string>,
  shared: ReadonlyArray<SharedStripResult>,
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
  // #573 — 옮겨 둔 디렉터리(`.claude/` 등) 아래 도구 파일 기록도 뺀다. 그 파일은 디렉터리와 함께 백업으로 갔다 —
  // 남겨 두면 나중에 설치자가 같은 자리에 둔 같은 내용의 사본을 전량 uninstall 이 하네스 것으로 읽고 지운다.
  next.assets = installLog.assets.map((a) =>
    a.files === undefined
      ? a
      : { ...a, files: a.files.filter((f) => !underAny(f.path, removedDirs)) },
  );
  const field = TEMPLATE_DIR_FIELD[target];
  if (field) delete next.templates[field];
  if (anchorRemoved) delete next.templates.rootClaudeMd;
  const survivors = (installLog.externalFiles ?? []).filter(
    (f) => !recovered.has(f.path) && !underAny(f.path, removedDirs),
  );
  if (survivors.length > 0) next.externalFiles = survivors;
  else delete next.externalFiles;
  // #551 R1 — 몫을 판정한 파일은 걷고 남은 몫(설치자가 고친 키 · 못 읽어 남긴 몫)만 이어 적는다. 판정하지 않은
  // 파일(다른 CLI 가 아직 쓰는 자리 · 하네스가 만든 파일)의 몫은 그대로다.
  const touched = new Set(shared.map((r) => r.path));
  // #623 — externalFiles 와 같은 규칙: 옮겨 둔 디렉터리(예: `.codex/`) 아래 몫은 이 CLI 것이었다.
  // 남겨 두면 사용자가 자체 config.toml 을 새로 만들 때 "설치자가 지운 몫"(excluded)으로 읽혀
  // 재설치가 아무 리전도 못 넣고 허위 excluded 까지 기록된다.
  const portions = [
    ...(installLog.portions ?? []).filter(
      (p) => !touched.has(p.path) && !underAny(p.path, removedDirs),
    ),
    ...shared.flatMap((r) => r.portions),
  ];
  if (portions.length > 0) next.portions = portions;
  else delete next.portions;
  return next;
}

function removeCliAction(ctx: RemoveCliCtx, io: RemoveCliIo): void {
  const target = resolveCliTarget(ctx, io);
  if (target === null) return;
  const { options, installLog, projectDir, harnessRoot } = ctx;
  const installed = installedClis(installLog);
  const remaining = installed.filter((cli) => cli !== target);
  const plan = planCliRemoval(target, remaining, installLog);

  for (const line of removeCliHeader(target, installed, remaining)) io.log(line);

  if (options.dryRun) {
    for (const line of removeCliDryRunLines(plan, ctx, remaining)) io.log(line);
    io.exit(0);
    return;
  }

  // 전용 디렉터리는 지우지 않고 옮겨 둔다(`templateDirPath` 주석) — 전량 경로와 같은 규칙.
  for (const dir of plan.dirs) {
    if (!existsSync(join(projectDir, dir))) continue;
    const backup = io.moveAside(templateDirPath(projectDir, dir));
    if (backup) io.log(movedAsideLine(projectDir, dir, backup));
  }
  const external = removeExternalFiles(plan.scoped, projectDir, io.rm, harnessRoot);
  for (const line of externalRemovalLines(external)) io.log(line);
  const shared = stripCliShared(installLog, projectDir, harnessRoot, plan.shared, true);
  for (const line of sharedStripLines(shared, false)) io.log(line);
  // 루트 `CLAUDE.md` 의 import 블록을 앵커보다 **먼저** 걷는다 — 전량 경로와 같은 순서다.
  // 반대로 하면 잠깐이라도 없는 파일을 가리키는 import 가 남는다.
  if (plan.importBlock && stripRootImport(projectDir)) {
    io.log(`  ${status.success("CLAUDE.md — harness @import removed (본문 보존)")}`);
  }
  const anchorRemoved = plan.anchor ? removeHarnessAnchor(ctx, io) : false;

  const recovered = new Set([...external.removed, ...external.stripped]);
  const next = settleCliLog(ctx, target, remaining, recovered, anchorRemoved, plan.dirs, shared);
  try {
    io.writeLog(projectDir, next);
    io.log(`  ${status.success(`install log updated (clis: ${remaining.join(", ")})`)}`);
  } catch (e) {
    // 회수는 이미 끝났다 — 여기서 throw 하면 무엇이 지워졌는지도 사라진다(전량 경로와 같은 방침).
    io.err(status.failure(c.red(`ERROR: install log 갱신 실패 — ${installLogPath(projectDir)}`)));
    io.err(c.dim(`       ${e instanceof Error ? e.message : String(e)}`));
    io.log("");
    io.log(
      c.yellow(`${target} 는 제거됐으나 install log 를 갱신하지 못했다 (기록이 실제와 다르다)`),
    );
    io.exit(1);
    return;
  }
  io.log("");
  io.log(status.success(c.green(`${target} removed (remaining: ${remaining.join(", ")})`)));
  io.exit(0);
}

/* ────────────────────────────────────────────────────────────────────────────
 * #551 R1 — 첫 접촉 파일의 하네스 몫만 걷는다
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 하네스가 **몫만** 더할 수 있는 CLI 쪽 함께 쓰는 파일 — 설치자가 이미 쓰던 `AGENTS.md` · `opencode.json` 에는
 * 블록 하나 · MCP 키만 더한다(첫 접촉, #558 · #563). uninstall 은 기록된 그 몫만 걷는다.
 * `.codex/config.toml` 은 여기 없다 — `.codex/` 가 통째로 옮겨진다(설계 §9 PR-7 전까지). 하네스가 **만든** 파일
 * (`externalFiles` 기록)은 지금의 회수 경로(`removeExternalFiles`)가 맡는다 — 여기서는 건너뛴다.
 */
const CLI_SHARED: ReadonlyArray<string> = ["AGENTS.md", "opencode.json"];

/**
 * #569 — 루트의 함께 쓰는 파일. install · update 가 하네스 몫만 더하므로 uninstall 도 **기록된 몫만** 뺀다(설치자 서버 ·
 * 줄은 남는다). 몫 기록이 없는 옛 설치본은 지우지 않고 남은 하네스 몫으로 보이는 것을 알린다. 하네스가 **만든** 파일
 * (`rootFiles.change === "created"`)은 몫을 걷고 남는 것이 없으면 파일째 지운다.
 */
const ROOT_SHARED: ReadonlyArray<string> = [".mcp.json", ".gitignore"];

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
): (disk: string) => string[] {
  const clis = installedClis(log);
  if (path === ".gitignore") {
    // 옛 판이 `rootFiles.notes` 에 적은 줄 중 하네스 판(딸린 주석 포함) 그대로 남은 것
    return (disk) => [...legacyGitignoreSeed(disk, gitignoreRender(), log).keys()];
  }
  if (path === ".mcp.json") {
    // 이름만으로는 설치자 서버와 못 가른다 — 값까지 지금 하네스 렌더와 같은 것만 알린다
    return (disk) => {
      let servers: Record<string, unknown>;
      try {
        servers = renderHarnessMcp(harnessRoot, log.spec.tracks.filter(isTrack)).mcpServers;
      } catch {
        return [];
      }
      const render = new Map(Object.entries(servers).map(([n, v]) => [`mcpServers.${n}`, v]));
      const present = ADAPTERS["json-keys"].read(disk, render.keys()) ?? new Map<string, string>();
      return [...present]
        .filter(([k, sha]) => sha === jsonSha(render.get(k)))
        .map(([k]) => k.slice("mcpServers.".length));
    };
  }
  if (path === AGENTS_MD) {
    if (!clis.includes("codex") && !clis.includes("opencode")) return () => [];
    // 블록 마커는 하네스만 쓴다 — 있으면 하네스 블록이다
    return (disk) =>
      ADAPTERS["marker-md"].read(disk, [AGENTS_BLOCK_NAME])?.has(AGENTS_BLOCK_NAME)
        ? [AGENTS_BLOCK_NAME]
        : [];
  }
  if (!clis.includes("opencode")) return () => [];
  // 이름만으로는 설치자 서버와 못 가른다 — 값까지 지금 하네스 렌더와 같은 것만 알린다
  return (disk) => {
    let render: Map<string, unknown>;
    try {
      render = renderOpencodeMcp(renderHarnessMcp(harnessRoot, log.spec.tracks.filter(isTrack)));
    } catch {
      return [];
    }
    const present = ADAPTERS["json-keys"].read(disk, render.keys()) ?? new Map<string, string>();
    return [...present].filter(([k, sha]) => sha === jsonSha(render.get(k))).map(([k]) => k);
  };
}

function remnantLine(path: string): (names: ReadonlyArray<string>) => string {
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

function stripCliShared(
  log: InstallLog,
  projectDir: string,
  harnessRoot: string,
  paths: ReadonlyArray<string>,
  write: boolean,
): SharedStripResult[] {
  const harnessMade = new Set((log.externalFiles ?? []).map((f) => f.path));
  // #569 — 루트 함께 쓰는 파일을 하네스가 만들었으면 몫만 남은 파일째 지운다(설계 §1.2 shared 행)
  const created = new Set(
    (log.rootFiles ?? []).filter((f) => f.change === "created").map((f) => f.path),
  );
  return paths
    .filter((path) => !harnessMade.has(path))
    .map((path) =>
      stripShared({
        projectDir,
        path,
        portions: log.portions ?? [],
        excluded: [...excludedIds(log)],
        remnant: remnantFor(path, log, harnessRoot),
        remnantLine: remnantLine(path),
        write,
        removeIfEmpty: ROOT_SHARED.includes(path) && created.has(path),
      }),
    );
}

/** 걷은 것 · 남긴 것을 말한다 — 미리보기와 실행이 같은 판정을 읽는다. */
function sharedStripLines(results: ReadonlyArray<SharedStripResult>, preview: boolean): string[] {
  const lines: string[] = [];
  for (const r of results) {
    // 화면 이름 — 키 id 에서 파일 접두를 뗀 것(`mcpServers.github` → `github`). 빈 컨테이너 키는 이름이 아니다
    const display = (k: string): string[] => {
      if (k === AGENTS_BLOCK_NAME) return ["harness block"];
      if (!ROOT_SHARED.includes(r.path)) return [k];
      const id = keyId(r.path, k);
      return id === null ? [] : [id.slice(id.indexOf(":") + 1)];
    };
    const names = (keys: ReadonlyArray<string>) => keys.flatMap(display).join(" · ");
    if (r.fileRemoved) {
      lines.push(
        preview
          ? `  ○ remove ${r.path} (the harness created it and only its part is in it)`
          : `  ${status.success(`${r.path} — removed (the harness created it and only its part was in it)`)}`,
      );
    } else if (r.removed.length > 0) {
      // 블록은 이름이 곧 전부다 · 키는 무엇을 걷었는지 이름을 댄다
      const which = r.path === AGENTS_MD ? "" : `: ${names(r.removed)}`;
      const what = r.path === AGENTS_MD ? "the harness block" : "the harness part";
      lines.push(
        preview
          ? `  ○ remove ${what} from ${r.path}${which} (yours stays)`
          : `  ${status.success(`${r.path} — removed ${what}${which} (yours stays)`)}`,
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
   * 전량 uninstall 에선 `.claude/` 통째 제거가 덮지만, `--only` 에선 **아무 일도 안 일어난다** — 그래서 따로 센다.
   */
  noReversePath: InstallLogAsset[];
  /** `noReversePath` 자산마다 남는 것을 말하는 줄 — 실행과 미리보기가 같은 줄을 낸다. */
  hints: Map<string, string[]>;
}

interface ReverseCtx {
  spawn: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>;
  projectDir: string;
  rm: (path: string) => void;
  /** 먼저 옮겨 둘 템플릿 디렉터리 — 그 안의 남는 것은 백업으로 가므로 "남는다" 고 하지 않는다. */
  movedDirs: ReadonlyArray<string>;
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
          .filter((p) => !underAny(p, ctx.movedDirs) && existsSync(join(ctx.projectDir, p)));
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
          const r = spawn("claude", ["plugin", "uninstall", "--scope", "project", pluginId]);
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
          const r = spawn("npm", ["uninstall", "--save-dev", pkg]);
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
      // v26.81.0 (ADR-022) — 내부 템플릿 — removeTemplates 가 .claude/ 전체로 처리.
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

function removeTemplates(
  log: InstallLog,
  projectDir: string,
  io: { rm: (path: string) => void; moveAside: (path: string) => string | null },
  harnessRoot: string,
): {
  rootClaudeMdKept: boolean;
  importStripped: boolean;
  external: ExternalRemoval;
  /** 옮겨 둔 템플릿 디렉터리와 그 백업 자리. 디스크에 없던 것은 빠진다. */
  moved: Array<{ rel: string; backup: string }>;
} {
  const { rm } = io;
  // #528 — `claudeDir` 는 claude 를 고른 설치에만 있다. 옛 로그는 고르지 않아도 적혀 있지만
  // 그때도 디렉터리가 없으면 `backupDir` 이 null 을 내고 넘긴다.
  // 사용자 결정 2026-09-27 — 지우지 않고 옮겨 둔다(`templateDirPath` 주석). 기록 파일 회수보다
  // **먼저** 옮긴다 — 그 안의 기록 파일은 디렉터리와 함께 백업으로 간다(아래 부재 = 정상).
  // #630 — 옮길 디렉터 안의 **파일 심링크**는 실체가 디렉터 밖에 산다(.codex/config.toml →
  // 프로젝트의 실제 파일). 디렉터를 통째로 옮기면 링크만 옮겨가고 대상에 하네스 리전이 남는다 —
  // 옮기기 **전에** 대상을 회수한다: externalFiles 기록은 무편집=삭제·편집=보존,
  // portions(shared) 기록은 stripShared 로 하네스 몫만 걷는다(쓰기는 링크를 따라 대상에 반영).
  const movedDirs = removedDirsList(log);
  const recovered = recoverMovedSymlinkTargets(log, projectDir, movedDirs, io.rm);
  const outsidePortions = recoverMovedSymlinkPortions(log, projectDir, movedDirs);
  const moved = recordedTemplateDirs(log).flatMap((rel) => {
    const backup = io.moveAside(templateDirPath(projectDir, rel));
    return backup ? [{ rel, backup }] : [];
  });
  const external = removeExternalFiles(log, projectDir, rm, harnessRoot);
  external.removed.push(...recovered.removed);
  external.kept.push(...recovered.kept);
  // 같은 링크가 externalFiles·portions 양쪽에 기록돼 있어도 "남김" 은 경로당 한 줄이다.
  for (const o of [...recovered.outside, ...outsidePortions]) {
    if (!external.outside.some((e) => e.path === o.path)) external.outside.push(o);
  }
  // 루트 `CLAUDE.md` 는 **사용자 소유**다 (P5 · ADR-060) — 지우지 않고 하네스가 넣은 마커
  // import 블록만 도로 걷어낸다. 안 걷으면 앵커 파일을 지운 뒤 없는 파일을 가리키는 import 가
  // 남아 매 세션 끊긴 참조가 로드된다.
  const importStripped = stripRootImport(projectDir);
  // 하네스 앵커 파일 — install 원본 그대로일 때만 삭제. 사용자가 수정했으면 보존.
  const rootMd = log.templates?.rootClaudeMd;
  if (rootMd) {
    if (rootClaudeMdModified(log, projectDir))
      return { rootClaudeMdKept: true, importStripped, external, moved };
    rm(join(projectDir, rootMd.path));
  }
  return { rootClaudeMdKept: false, importStripped, external, moved };
}

/** `removeExternalFiles` 의 결과 — 화면이 지운 것과 남긴 것을 나눠 말할 수 있어야 한다. */
interface ExternalRemoval {
  removed: string[];
  /** 설치 이후 내용이 바뀌어 남긴 것 — 사용자 편집분이라 우리가 소유를 주장하지 않는다. */
  kept: string[];
  /** #516 — 하네스 절만 걷어내고 설치자 절을 남긴 것 (`AGENTS.md`). */
  stripped: string[];
  /** #516 — 절 경계를 판정할 수 없어(템플릿 불가·쓰기 실패) 통째로 남긴 것. 편집분과는 다른 사유다. */
  unjudged: string[];
  /** 링크 대상이 프로젝트 밖이라 따라가지 않고 남긴 것 — 기록에 없는 경로는 건드리지 않는다(남김 + 대상 경로). */
  outside: Array<{ path: string; target: string }>;
}

/** 설치자 소유 절이 있는 유일한 외부 산출물 — codex · opencode transform 이 같은 이름으로 쓴다. */
const AGENTS_MD = "AGENTS.md";

/**
 * `AGENTS.md` 를 렌더한 템플릿 — 절 경계의 SSOT(ADR-095 D3). 두 CLI 가 같은 파일을 쓰고
 * opencode transform 이 뒤에 돌아 그 판이 남으므로 opencode 가 깔려 있으면 그 템플릿이다.
 * 두 템플릿은 설치자 소유 절 이름(`## Project Context` · `## Project Rules`)이 같고 codex 판의
 * 절 이름이 opencode 판을 포함하므로, 로그와 디스크의 판이 어긋나도(#514 이전 update 를 거친
 * codex 단독 설치본) 경계 판정은 같다 — 독립 리뷰 N2 실측.
 * 못 읽으면 `null` — 그때는 경계를 판정할 수 없으니 파일을 남긴다(지우는 쪽으로 넘어가지 않는다).
 */
function readAgentsMdTemplate(harnessRoot: string, log: InstallLog): string | null {
  const flavor = log.templates.opencodeDir ? "opencode" : "codex";
  try {
    return readFileSync(join(harnessRoot, "templates", flavor, "AGENTS.md.template"), "utf8");
  } catch {
    return null;
  }
}

/**
 * 기준선과 같은 `AGENTS.md` 를 어떻게 할지 — 실행과 dry-run 이 **같은 술어**를 쓴다.
 * `null` = 하네스 것뿐이라 파일째 삭제, 문자열 = 그 내용으로 다시 써서 설치자 절을 남긴다.
 */

/**
 * #656 — 하네스 제거 후 남는 스캐폴드 배너를 정정한다. 배너 문장("SCAFFOLD — not filled in
 * yet…")은 하네스가 쓴 것이므로 지워도 사용자 몫이 아니다 — 그대로 두면 하네스가 없는
 * 프로젝트가 "아직 안 채웠다"고 계속 주장한다.
 */

/**
 * #630 — portions(shared) 파일이 옮길 디렉터 안의 심링크일 때, 대상에서 하네스 몫을 걷는다.
 * `stripShared` 의 읽기·쓰기는 링크를 따라가므로 moveAside **전**에 부르면 대상이 정리된다.
 */
function recoverMovedSymlinkPortions(
  log: InstallLog,
  projectDir: string,
  dirs: ReadonlyArray<string>,
): Array<{ path: string; target: string }> {
  const outside: Array<{ path: string; target: string }> = [];
  const paths = new Set((log.portions ?? []).map((p) => p.path));
  for (const path of paths) {
    if (path.startsWith(".agents/skills/")) continue;
    if (!dirs.some((d) => path.startsWith(d))) continue;
    const abs = join(projectDir, path);
    if (!safeIsSymlink(abs)) continue;
    // 프로젝트 밖 실체는 다시 쓰지 않는다 — 두 프로젝트가 같은 dotfile 을 가리켜도 한쪽 uninstall 이
    // 다른 쪽 설정을 걷지 않는다. 대신 남겼다고 말한다.
    const target = safeRealpath(abs);
    if (target !== null && isOutsideProject(projectDir, target)) {
      outside.push({ path, target });
      continue;
    }
    stripShared({
      projectDir,
      path,
      portions: log.portions ?? [],
      excluded: [...excludedIds(log)],
      remnant: () => [],
      remnantLine: () => "",
      write: true,
    });
  }
  return outside;
}

/** removeTemplates 가 옮길 디렉터 목록(기록 템플릿 디렉터 — 백업 이동 대상과 같은 집합). */
function removedDirsList(log: InstallLog): string[] {
  return recordedTemplateDirs(log);
}

/**
 * #630 — 디렉터 이동 대상 안의 파일 심링크가 가리키는 **밖의 실체**를 회수한다.
 * 판정은 removeExternalFiles 와 같다: 기록 sha 그대로면 삭제, 바뀌었으면 보존(kept).
 * `.agents/skills/` 는 대상 디렉터에 없고(#343 남의 포인터) 여기서도 배제한다.
 */
function recoverMovedSymlinkTargets(
  log: InstallLog,
  projectDir: string,
  dirs: ReadonlyArray<string>,
  rm: (path: string) => void,
): { removed: string[]; kept: string[]; outside: Array<{ path: string; target: string }> } {
  const removed: string[] = [];
  const kept: string[] = [];
  const outside: Array<{ path: string; target: string }> = [];
  for (const { path, sha256 } of log.externalFiles ?? []) {
    if (path.startsWith(".agents/skills/")) continue;
    if (!dirs.some((d) => path.startsWith(d))) continue;
    const abs = join(projectDir, path);
    if (!safeIsSymlink(abs)) continue;
    let target: string;
    try {
      target = realpathSync(abs);
      if (!statSync(target).isFile()) continue;
    } catch {
      continue;
    }
    if (isOutsideProject(projectDir, target)) {
      outside.push({ path, target });
      continue;
    }
    try {
      if (hashContent(readFileSync(target, "utf8")) !== sha256) {
        kept.push(path); // 편집분 — 보존
        continue;
      }
      rm(target);
      removed.push(path);
    } catch {
      kept.push(path);
    }
  }
  return { removed, kept, outside };
}

function safeRealpath(abs: string): string | null {
  try {
    return realpathSync(abs);
  } catch {
    return null;
  }
}

/** lstat 실패(부재·권한)는 "심링크 아님"으로 접는다 — 판정 보조일 뿐이다. */
function safeIsSymlink(abs: string): boolean {
  try {
    return lstatSync(abs).isSymbolicLink();
  } catch {
    return false;
  }
}

function neutralizeScaffoldBanner(text: string): string {
  return text
    .split("\n")
    .filter((line) => !line.includes("SCAFFOLD — not filled in yet"))
    .join("\n");
}

function agentsMdRemainder(
  current: string,
  harnessRoot: string,
  log: InstallLog,
): { ok: true; remainder: string | null } | { ok: false } {
  const template = readAgentsMdTemplate(harnessRoot, log);
  if (template === null) return { ok: false };
  return { ok: true, remainder: stripHarnessFromAgentsMd({ existing: current, template }) };
}

/**
 * 외부 CLI transform 산출물 회수 (#350).
 *
 * **디렉터리를 통째로 지우지 않는다.** `templates` 는 `.claude/`·`.codex/`·`.opencode/` 세
 * 디렉터리만 알고 있어서, codex·opencode·antigravity 가 함께 쓰는 `.agents/` 는 uninstall
 * 이후에도 통째로 남았다(실측 2026-08-29 · v26.148.1: codex 는 `.agents/skills`, antigravity 는
 * `.agents/rules` + `.agents/skills` 가 잔존하고 화면에는 한 줄도 안 뜬다).
 *
 * 그렇다고 `.agents/` 를 회수 목록에 더하면 안 된다 — **그 자리는 `npx skills` 와 공유**하고,
 * 그쪽은 `.claude/skills/<id>` 를 `.agents/` 로의 심링크로 만들어 **본문을 거기 둔다**
 * (`external-installer.ts` 의 실측 주석). 통째 삭제는 남의 도구가 깐 스킬 본문을 지운다.
 * `.claude/` 통짜 삭제가 안전한 것은 그 안의 링크를 지워도 본문이 `.agents/` 에 남기 때문이고,
 * 반대 방향은 성립하지 않는다.
 *
 * 그래서 **우리가 쓴 파일만** 지운다. 무엇을 썼는지는 이미 정확히 기록돼 있다 —
 * `externalFiles`(ADR-048)는 transform 이 쓴 파일의 projectDir 상대경로와 sha256 을 담는다.
 * 열거 사본을 새로 만들지 않아도 되고, 자산이 늘어도 기록이 따라온다.
 *
 * 설치 이후 내용이 바뀐 파일은 **남긴다** — 루트 앵커에 이미 쓰는 규칙과 같다(사용자 편집분).
 *
 * **`AGENTS.md` 는 기준선과 같아도 통째로 지우지 않는다** (#516). `update` 가 설치자 절을 이어받아
 * 다시 쓰므로(#503) 그 문장이 기준선 안에 들어 있다 — "기준선과 같다"가 "하네스 것뿐이다"를 뜻하지
 * 않는 유일한 파일이다. 루트 `CLAUDE.md` 처럼 하네스 절만 걷어내고, 설치자가 아무것도 안 채웠을
 * 때만 파일을 지운다.
 */
function removeExternalFiles(
  log: InstallLog,
  projectDir: string,
  rm: (path: string) => void,
  harnessRoot: string,
): ExternalRemoval {
  const removed: string[] = [];
  const kept: string[] = [];
  const stripped: string[] = [];
  const unjudged: string[] = [];
  const outside: Array<{ path: string; target: string }> = [];
  for (const { path, sha256 } of log.externalFiles ?? []) {
    const abs = join(projectDir, path);
    // `.claude/`·`.codex/`·`.opencode/` 아래 것은 위에서 이미 사라졌다 — 부재는 정상이다.
    // 심링크였던 자리의 실체 회수는 moveAside 직전에 recoverMovedSymlinkTargets 가 맡는다(#630).
    if (!existsSync(abs)) continue;
    // 일반 파일만 회수한다. `.agents/skills/<id>` 는 `npx skills add` 가 **심링크로** 깔아 두는
    // 자리이고(#343 실사용자 신고로 관측), 그 링크는 우리가 만든 것이 아니다. 안 걸러 두면
    // 내용이 우연히 같을 때 남의 설치 포인터를 지우고, 다를 때는 "네가 고쳤다"고 잘못 말한다.
    // #629/#630 — **파일을 가리키는** 심링크 중 `.agents/skills/` 밖의 것은 install 이 링크를
    // 따라 썼으므로 회수도 따라간다: 대상에서 하네스 몫을 걷고 링크 포인터를 함께 정리한다.
    // `.agents/skills/<id>` 의 링크는 `npx skills` 가 만든 **남의 설치 포인터**(#343) — 파일을
    // 가리키더라도 무조건 건드리지 않는다(이 두 계약을 한 술어로 나눈 것이 이 조건이다).
    // #565 — lstat→read 사이 TOCTOU·EACCES 도 같은 망태로 흘린다: 읽지 못한 것은 "고쳤다"가 아니라
    // 판정 불가라 지우지 않고 unjudged 로 보고한다.
    let current: string;
    let effective = abs;
    const foreignSkillSlot = path.startsWith(".agents/skills/");
    try {
      const isLink = lstatSync(abs).isSymbolicLink();
      if (isLink && foreignSkillSlot) continue; // #343 — 남의 설치 포인터는 건드리지 않는다
      // 실체의 실제 위치 하나로 판정한다 — 파일 링크든 상위 폴더 링크든(`.agents/rules → 밖`) 같다.
      const resolved = realpathSync(abs);
      if (!statSync(resolved).isFile()) continue;
      if (isOutsideProject(projectDir, resolved)) {
        outside.push({ path, target: resolved });
        continue;
      }
      if (isLink) effective = resolved;
      current = readFileSync(effective, "utf8");
    } catch {
      unjudged.push(path);
      continue;
    }
    if (hashContent(current) !== sha256) {
      kept.push(path);
      continue;
    }
    if (path === AGENTS_MD) {
      const verdict = agentsMdRemainder(current, harnessRoot, log);
      if (!verdict.ok) {
        unjudged.push(path);
        continue;
      }
      if (verdict.remainder !== null) {
        try {
          // #656 — 걷어낸 뒤에도 스캐폴드 배너가 남으면 그 문장은 이제 거짓이다(하네스가
          // 없는데 "not filled in yet" 를 계속 주장). 배너는 하네스가 쓴 문장이므로 정정한다 —
          // 사용자 본문은 그대로. sha 일치가 "하네스 렌더 뿐"을 뜻하지 않는 이유는 #516: update
          // 가 사용자 절을 보존해 재쓴 파일도 sha 가 일치한다(통째 삭제 불가의 원천).
          writeFileSync(effective, neutralizeScaffoldBanner(verdict.remainder), "utf8");
          stripped.push(path);
        } catch {
          // 쓰기 실패는 남긴 것과 같다 — 파일은 그대로 있고, 지웠다고 말하지 않는다.
          unjudged.push(path);
        }
        continue;
      }
    }
    rm(effective);
    if (effective !== abs) {
      // 심링크 경로였다 — 대상을 정리했으니 링크 포인터도 걷는다(#629).
      try {
        rm(abs);
      } catch {
        /* 링크 제거 실패가 대상 정리를 무효화하지 않는다 */
      }
    }
    removed.push(path);
  }
  for (const path of removed) pruneEmptyDirsUpward(projectDir, dirname(join(projectDir, path)));
  // #611 — install 스켈리톤이 만든 빈 docs/decisions 도 걷는다(기록 밖이라 잔여 보고에 안
  // 올랐다). 비었을 때만 — 사용자가 ADR 을 넣었다면 그냥 둔다.
  const decisions = join(projectDir, "docs", "decisions");
  try {
    if (existsSync(decisions) && readdirSync(decisions).length === 0)
      rmSync(decisions, { recursive: true });
  } catch {
    /* 걷지 못한 빈 디렉터는 무해하다 */
  }
  return { removed, kept, stripped, unjudged, outside };
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
  const current = readRootClaudeMd(projectDir);
  const stripped = current === null ? null : stripHarnessImport(current);
  if (stripped === null) return false;
  try {
    // #653 — 비UTF-8 바이트가 섞인 파일을 문자열 왕복으로 재작성 전에 원시 바이트를 보존한다.
    backupIfLossyUtf8(join(projectDir, "CLAUDE.md"));
    writeFileSync(join(projectDir, "CLAUDE.md"), stripped, "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * dry-run 이 실행과 **같은 판정**으로 미리 보여 준다. 실행 경로가 회수를 판정하는 술어
 * (기록에 있고 · 디스크에 있고 · sha256 이 그대로)를 그대로 다시 쓴다.
 */
function previewExternalLines(
  installLog: InstallLog,
  projectDir: string,
  harnessRoot: string,
  /** 먼저 옮겨 둘 디렉터리 — 그 안의 기록 파일은 실행 때 이미 백업으로 가 있다. */
  movedDirs: ReadonlyArray<string> = [],
): string[] {
  const lines: string[] = [];
  let removable = 0;
  for (const { path, sha256 } of installLog.externalFiles ?? []) {
    const abs = join(projectDir, path);
    const underMoved = underAny(path, movedDirs);
    const isLink = !underMoved || existsSync(abs) ? safeIsSymlink(abs) : false;
    if (underMoved && !isLink) continue;
    if (!existsSync(abs)) continue;
    // 실행 경로와 **같은 술어**다 — 심링크 중 파일을 가리키는 것도 `.agents/skills/` 밖일 때만
    // 따라가 회수 대상으로 센다(#629/#630). 스킬 슬롯의 링크(#343 남의 포인터)는 세지 않는다.
    let effective = abs;
    const foreignSkillSlot = path.startsWith(".agents/skills/");
    try {
      const isLinkPath = lstatSync(abs).isSymbolicLink();
      if (isLinkPath && foreignSkillSlot) continue;
      const resolved = realpathSync(abs);
      if (!statSync(resolved).isFile()) continue;
      if (isOutsideProject(projectDir, resolved)) {
        lines.push(`  ○ keep ${path} (link target outside project: ${resolved} — preserved)`);
        continue;
      }
      if (isLinkPath) effective = resolved;
    } catch {
      continue;
    }
    const current = readFileSync(effective, "utf8");
    if (hashContent(current) !== sha256) {
      lines.push(`  ○ keep ${path} (modified since install — preserved)`);
      continue;
    }
    if (path === AGENTS_MD) {
      const verdict = agentsMdRemainder(current, harnessRoot, installLog);
      if (!verdict.ok) {
        lines.push(`  ○ keep ${path} (harness sections could not be separated — preserved)`);
        continue;
      }
      if (verdict.remainder !== null) {
        lines.push(`  ○ strip harness sections from ${path} (본문 보존)`);
        continue;
      }
    }
    removable += 1;
  }
  if (removable > 0) lines.unshift(`  ○ remove ${removable} CLI output file(s)`);
  return lines;
}

/**
 * `.claude/`·`.codex/`·`.opencode/` 밖(주로 `.agents/`)에서 회수한 산출물 보고.
 *
 * 지운 게 없으면 아무 줄도 내지 않는다 — codex·opencode·antigravity 를 안 고른 설치가
 * 대부분이고, 거기서 "0 files" 를 찍으면 화면만 길어진다.
 */
function externalRemovalLines(external: ExternalRemoval): string[] {
  const lines: string[] = [];
  if (external.removed.length > 0) {
    lines.push(`  ${status.success(`CLI outputs removed: ${external.removed.length} file(s)`)}`);
  }
  for (const path of external.stripped) {
    lines.push(`  ${status.success(`${path} — harness sections removed (본문 보존)`)}`);
  }
  for (const path of external.unjudged) {
    lines.push(
      `  ${c.yellow("⊘")} ${path} kept — harness sections could not be separated (a file or template could not be read, or the write failed). Remove manually if intended.`,
    );
  }
  // 같은 폴더 링크 아래 여러 파일이면 폴더 단위 한 줄(경로 + 개수)로 묶는다.
  const outsideGroups = new Map<string, Array<{ path: string; target: string }>>();
  for (const o of external.outside) {
    const key = `${dirname(o.path)}\0${dirname(o.target)}`;
    outsideGroups.set(key, [...(outsideGroups.get(key) ?? []), o]);
  }
  for (const group of outsideGroups.values()) {
    const first = group[0];
    if (!first) continue;
    if (group.length === 1) {
      lines.push(
        `  ${c.yellow("⊘")} ${first.path} kept — link target is outside the project (${first.target}). Not touched; remove manually if intended.`,
      );
    } else {
      lines.push(
        `  ${c.yellow("⊘")} ${dirname(first.path)}/ kept ${group.length} file(s) — link target is outside the project (${dirname(first.target)}). Not touched; remove manually if intended.`,
      );
    }
  }
  for (const path of external.kept) {
    lines.push(
      `  ${c.yellow("⊘")} ${path} kept — modified since install. Remove manually if intended.`,
    );
  }
  return lines;
}

/** 미리보기용 — 실행 경로와 **같은 술어**를 쓴다 (미리보기가 실제와 어긋나면 미리보기가 아니다). */
function hasRootImport(projectDir: string): boolean {
  const current = readRootClaudeMd(projectDir);
  return current !== null && stripHarnessImport(current) !== null;
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

/** 하네스 앵커 파일이 install 이후 수정됐는지. log 에 없거나 파일 부재 시 false (= 삭제 대상). */
function rootClaudeMdModified(log: InstallLog, projectDir: string): boolean {
  const rootMd = log.templates.rootClaudeMd;
  if (!rootMd) return false;
  const path = join(projectDir, rootMd.path);
  if (!existsSync(path)) return false;
  return hashContent(readFileSync(path, "utf8")) !== rootMd.sha256;
}

/* v8 ignore start — thin dep-inject defaults. tests 는 항상 mock 주입. */
function defaultSpawn(cmd: string, args: ReadonlyArray<string>): SpawnSyncReturns<string> {
  return spawnSync(cmd, [...args], { encoding: "utf8", stdio: "pipe", timeout: 120_000 });
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
      "[Mode] Keep `.claude/`, `.codex/`, `.opencode/` templates (remove only external assets). Without a terminal it still needs --yes, --only, --cli or --dry-run",
    )
    .option(
      "--only <ids>",
      "[Scope] Remove only these assets (comma-separated ids from `agent-harness list`). Templates untouched",
    )
    .option(
      "--cli <name>",
      `[Scope] Remove one CLI only (${CLI_BASES.join(" | ")}). Shared files stay until the last user leaves`,
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
  // #528 — `--cli` 도 "뺄 대상을 이미 지정한" 경우다. 화면으로 들여보내면 그 선택이 무시된다.
  return options.only === undefined && options.cli === undefined;
}

/* v8 ignore start — 얇은 배선. 판정은 shouldRunInteractive·lacksRemovalIntent, 선택은 uninstall-interactive, 실행은 uninstallAction 이 각각 tests 로 검증. */
async function dispatchUninstall(options: UninstallOptions): Promise<void> {
  // #561 — 터미널 없는 환경(파이프·CI)에서 플래그 없이 실행되면 확인 없이 전량 제거되던
  // 기본값을 거부로 바꾼다. USAGE "Nothing happens until you confirm" 의 비TTY 판이다.
  if (!process.stdin.isTTY && lacksRemovalIntent(options)) {
    console.error(
      status.failure(
        c.red(
          "ERROR: no terminal and no flag saying what to remove — nothing was done. Pass --yes (remove everything), --only <ids>, --cli <name>, or --dry-run.",
        ),
      ),
    );
    process.exit(1);
  }
  if (!shouldRunInteractive(options, Boolean(process.stdin.isTTY))) {
    uninstallAction(options);
    return;
  }
  await runUninstallScreen(resolve(options.projectDir ?? process.cwd()));
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
    options.cli === undefined
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
      console.error(
        status.failure(c.red(`ERROR: install log not found at ${installLogPath(projectDir)}`)),
      );
      console.error(c.dim("       Nothing installed here by agent-harness."));
      process.exit(1);
    }
    // no-tty 는 위 분기에서 이미 걸러졌고, 나머지(cancelled/nothing-selected)는 정상 종료다.
    return;
  }
  uninstallAction(picked.options);
}
/* v8 ignore stop */

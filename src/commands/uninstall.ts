/**
 * Uninstall command — v26.64.0 (ADR-020).
 *
 * 동작:
 *   1. `.claude/.harness-install.json` 읽기.
 *   2. assets[] 별 reverse:
 *      - scope=project: 실제 reverse (`claude plugin uninstall --scope project`, `npm uninstall`, fs rm).
 *      - scope=global: 안내만 (D16 — 글로벌 영역 자동 삭제 금지). 사용자가 직접 명령 실행.
 *   3. templates 폴더 rm (`.claude/`, `.codex/`, `.opencode/`) — `--keep-templates` 시 보존.
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
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { c, status } from "../design.js";
import { skillsCliSpec } from "../external-installer.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../install-log.js";
import { KARPATHY_ASSET_ID, KARPATHY_HOOK_COMMAND, KARPATHY_HOOK_RELPATH } from "../installer.js";
import type { ClaudeSettings } from "../settings-merge.js";

export interface UninstallOptions {
  projectDir?: string;
  dryRun?: boolean;
  keepTemplates?: boolean;
  /**
   * v26.123.0 (F-1c) — 항목별 제거. 쉼표 구분 자산 id.
   * 지정 시 templates(`.claude/` 등)는 건드리지 않고, 로그도 지우지 않고 **남은 자산으로 다시 쓴다**.
   */
  only?: string;
}

export interface UninstallActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  spawn?: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>;
  rm?: (path: string) => void;
  /** `--only` 후 로그 재기록. 실패 경로를 테스트에서 재현하기 위해 주입 가능. */
  writeLog?: (projectDir: string, log: InstallLog) => void;
}

interface ReverseStep {
  /** 어느 자산의 reverse 인지 — `--only` 성공분만 로그에서 빼기 위해 필요. */
  assetId: string;
  /** 사람이 읽는 라벨 (한 줄) */
  label: string;
  /** 실제 동작 — dry-run 일 때는 호출 안 함. */
  execute: () => { ok: boolean; message?: string };
}

interface GlobalAdvisory {
  asset: InstallLogAsset;
  /** 사용자에게 안내할 reverse 명령 */
  command: string;
}

/**
 * 크기 예외 사유 (code-style 50줄 상한): 본 함수는 CLI action 의 **선형 orchestration** 이고
 * 각 단계는 이미 이름 있는 함수로 빠져 있다 (`planReverse` → `headerLines` → `dryRunLines` |
 * `executeReverse` → `removeTemplates` → `settleLog` → `advisoryLines` → `summarize`).
 * 더 쪼개면 호출 순서라는 유일한 정보가 흩어진다 — 순서 자체가 이 함수의 내용이다.
 */
export function uninstallAction(options: UninstallOptions, deps: UninstallActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const spawn = deps.spawn ?? defaultSpawn;
  const rm = deps.rm ?? defaultRm;
  const writeLog = deps.writeLog ?? writeInstallLog;

  const projectDir = resolve(options.projectDir ?? process.cwd());
  const installLog = readInstallLog(projectDir);
  if (!installLog) {
    err(status.failure(c.red(`ERROR: install log not found at ${installLogPath(projectDir)}`)));
    err(c.dim("       Was this project installed by agent-harness? Nothing to uninstall."));
    exit(1);
    return;
  }

  const selectedIds = parseOnly(options.only);
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

  const plan = planReverse(targetAssets, spawn);
  for (const line of headerLines(installLog, selectedIds, targetAssets.length)) log(line);

  if (options.dryRun) {
    for (const line of dryRunLines(plan, installLog, projectDir, keepTemplates, targetAssets)) {
      log(line);
    }
    exit(0);
    return;
  }

  const { succeeded, failed, removedIds } = executeReverse(plan, log, keepTemplates);

  if (!keepTemplates) {
    const { rootClaudeMdKept } = removeTemplates(installLog, projectDir, rm);
    log(`  ${status.success(`templates removed: ${formatTemplateList(installLog)}`)}`);
    if (rootClaudeMdKept) {
      log(
        `  ${c.yellow("⊘")} CLAUDE.md kept — modified since install. Remove manually if intended.`,
      );
    }
  }

  const logWriteFailed = settleLog(
    { installLog, projectDir, selectedIds, keepTemplates, removedIds },
    { log, err, rm, writeLog },
  );

  // 판정 기준은 "`--only` 인가"가 아니라 "`.claude/` 가 남는가"다 — `--keep-templates` 만 줘도
  // settings.json 은 살아남으므로 안내 대상이다. dry-run 과 같은 값을 넘겨야 미리보기가 맞는다.
  for (const line of advisoryLines(plan, targetAssets, projectDir, keepTemplates)) {
    log(line);
  }

  const outcome = summarize({
    succeeded,
    failed,
    logWriteFailed,
    // `--only` 로 하나 빼달라 했는데 하나도 못 뺐으면 "complete" 가 아니다.
    // **`--only` 경로에만 적용한다** — `--keep-templates` 전량 uninstall 은 자산이 전부
    // global 이라 자동 제거가 0건이어도 install log 를 지우는 실제 작업을 했고, 그건
    // D16 설계대로의 정상 종료다. 여기까지 exit 1 로 묶으면 global scope 사용자는
    // 영원히 exit 0 을 못 받는다 (재시도하면 로그가 없어 더 나빠진다).
    nothingDone: selectedIds !== null && succeeded === 0 && targetAssets.length > 0,
  });
  log("");
  log(outcome.line);
  exit(outcome.code);
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
  keepTemplates: boolean,
): { succeeded: number; failed: number; removedIds: string[] } {
  let succeeded = 0;
  let failed = 0;
  const removedIds: string[] = [];
  for (const step of plan.reverseSteps) {
    const result = step.execute();
    if (result.ok) {
      log(`  ${status.success(step.label)}`);
      removedIds.push(step.assetId);
      succeeded++;
    } else {
      log(`  ${c.yellow("⊘")} ${step.label}  (${result.message ?? "failed"})`);
      failed++;
    }
  }
  // 자동 되돌리기 경로가 없는 자산은 **말한다.** 조용히 넘기면 `uninstall complete` 가
  // 아무것도 안 한 실행에 붙어 거짓 보고가 된다 (no-false-ship).
  // "기록 유지"는 로그가 남을 때만 참이다 — 전량 uninstall 은 `.claude/` 와 함께 로그도 지운다.
  const tail = keepTemplates ? "자동 되돌리기 경로 없음, 기록 유지" : "자동 되돌리기 경로 없음";
  for (const asset of plan.noReversePath) {
    log(`  ${c.yellow("⊘")} ${asset.id} (${asset.method}) — ${tail}`);
  }
  return { succeeded, failed, removedIds };
}

/** 제거 후 로그 처리. @returns 재기록에 실패했는가 (실패해도 uninstall 을 죽이지 않는다). */
function settleLog(
  ctx: {
    installLog: InstallLog;
    projectDir: string;
    selectedIds: string[] | null;
    keepTemplates: boolean;
    removedIds: string[];
  },
  io: {
    log: (msg: string) => void;
    err: (msg: string) => void;
    rm: (path: string) => void;
    writeLog: (projectDir: string, log: InstallLog) => void;
  },
): boolean {
  const { installLog, projectDir, selectedIds, keepTemplates, removedIds } = ctx;
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
  } else if (keepTemplates) {
    // install log 자체도 함께 제거 (templates 제거 시 .claude/ 통째 사라짐 → log 도 자동 사라짐.
    // keepTemplates 시 .claude/ 유지 → log 만 명시 제거).
    io.rm(installLogPath(projectDir));
    io.log(`  ${status.success("install log removed (templates kept)")}`);
  }
  return false;
}

/** dry-run 미리보기 — 실행 경로와 같은 판정을 쓴다 (미리보기가 실제와 어긋나면 미리보기가 아니다). */
function dryRunLines(
  plan: ReversePlan,
  installLog: InstallLog,
  projectDir: string,
  keepTemplates: boolean,
  targetAssets: ReadonlyArray<InstallLogAsset>,
): string[] {
  const lines = [c.yellow("[DRY RUN] reverse list (실제 변경 없음):"), ""];
  if (plan.reverseSteps.length === 0) {
    lines.push(c.dim("  (no project-scope assets to reverse)"));
  }
  lines.push(...plan.reverseSteps.map((s) => `  ○ ${s.label}`));
  lines.push(
    ...plan.noReversePath.map((a) =>
      c.dim(`  ⊘ ${a.id} (${a.method}) — 자동 되돌리기 경로 없음, 기록 유지`),
    ),
  );
  if (!keepTemplates) {
    lines.push(`  ○ remove templates: ${formatTemplateList(installLog)}`);
    if (installLog.templates.rootClaudeMd) {
      lines.push(
        rootClaudeMdModified(installLog, projectDir)
          ? "  ○ keep CLAUDE.md (modified since install — preserved)"
          : "  ○ remove CLAUDE.md",
      );
    }
  }
  // keepTemplates=false 면 실제 실행은 `.claude/` 를 통째로 지운다 → 수기 안내 대상 자체가
  // 사라지므로 미리보기에서도 안내하지 않는다. 안 그러면 곧 삭제될 파일을 손보라고 시킨다.
  lines.push(...advisoryLines(plan, targetAssets, projectDir, keepTemplates), "");
  return lines;
}

/** global(D16) + 수기 표면 안내. dry-run 과 실행 경로가 같은 함수를 쓴다. */
function advisoryLines(
  plan: ReversePlan,
  targetAssets: ReadonlyArray<InstallLogAsset>,
  projectDir: string,
  templatesKept: boolean,
): string[] {
  const lines: string[] = [];
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
  if (templatesKept) lines.push(...manualAdvisoryLines(targetAssets, projectDir));
  return lines;
}

interface ReversePlan {
  reverseSteps: ReverseStep[];
  globalAdvisories: GlobalAdvisory[];
  /**
   * 자동 되돌리기 경로가 없는 자산 (npx-run / shell-script / internal). 전량 uninstall 에선
   * `.claude/` 통째 제거가 덮지만, `--only` 에선 **아무 일도 안 일어난다** — 그래서 따로 센다.
   */
  noReversePath: InstallLogAsset[];
}

function planReverse(
  assets: ReadonlyArray<InstallLogAsset>,
  spawn: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>,
): ReversePlan {
  const reverseSteps: ReverseStep[] = [];
  const globalAdvisories: GlobalAdvisory[] = [];
  const noReversePath: InstallLogAsset[] = [];

  for (const asset of assets) {
    if (asset.scope === "global") {
      globalAdvisories.push({ asset, command: buildGlobalAdvisoryCmd(asset) });
      continue;
    }
    const step = buildProjectReverseStep(asset, spawn);
    if (step) reverseSteps.push(step);
    else noReversePath.push(asset);
  }

  return { reverseSteps, globalAdvisories, noReversePath };
}

function buildProjectReverseStep(
  asset: InstallLogAsset,
  spawn: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>,
): ReverseStep | null {
  switch (asset.method) {
    case "plugin": {
      const pluginId = asset.detail.pluginId ?? asset.id;
      return {
        assetId: asset.id,
        label: `claude plugin uninstall --scope project ${pluginId}`,
        execute: () => {
          const r = spawn("claude", ["plugin", "uninstall", "--scope", "project", pluginId]);
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        },
      };
    }
    case "skill": {
      // skills CLI default 가 project — `skills remove <source>` (no -g).
      // 일부 source 는 폴더 경로/직접 id — npx skills remove 가 처리.
      const source = asset.detail.source ?? asset.id;
      return {
        assetId: asset.id,
        label: `npx skills remove ${source}`,
        execute: () => {
          const r = spawn("npx", [skillsCliSpec(), "remove", source, "--yes"]);
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        },
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
      // 로컬 script 호출 — 일반 reverse 없음 (script 별 별도 cleanup 필요).
      return null;
    case "internal":
      // v26.81.0 (ADR-022) — 내부 템플릿 — removeTemplates 가 .claude/ 전체로 처리.
      return null;
  }
}

/**
 * `.claude/settings.json` 의 hook command 존재 여부. **파싱해서** 본다 — 원문 substring 매치는
 * JSON 이스케이프(`\"`) 때문에 실제로 등록된 훅을 놓친다 (도입 시 테스트가 잡은 실패).
 */
function settingsHasHookCommand(projectDir: string, command: string): boolean {
  const path = join(projectDir, ".claude", "settings.json");
  if (!existsSync(path)) return false;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ClaudeSettings;
    return Object.values(parsed.hooks ?? {}).some((matchers) =>
      matchers.some((m) => m.hooks?.some((h) => h.command === command)),
    );
  } catch {
    return false; // 깨진 settings.json — 안내를 못 만들 뿐, uninstall 을 막지는 않는다.
  }
}

/**
 * 로그에 없는 `--only` id — 오타로 엉뚱한 자산이 남지 않도록 **아무것도 실행하기 전에** 본다
 * (gates-taxonomy Pre-flight: 전제조건 미충족 시 차단, 부분 작업 없음).
 */
function unknownIds(installLog: InstallLog, selectedIds: ReadonlyArray<string>): string[] {
  const known = new Set(installLog.assets.map((a) => a.id));
  return selectedIds.filter((id) => !known.has(id));
}

/** `--only <a,b>` → ["a","b"]. 미지정이면 null (= 전량 제거, 기존 동작). */
function parseOnly(only: string | undefined): string[] | null {
  if (!only) return null;
  const ids = only
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return ids.length > 0 ? ids : null;
}

/**
 * v26.123.0 (F-1d) — 자산 제거로 **끊어진 참조가 남는 표면**을 알려준다. 자동으로 안 고치는 이유:
 * `.claude/settings.json` 과 hook 파일에는 사용자 편집이 섞이므로 기계적 되돌리기가 손실 위험이다
 * (사용자 방침 — 위험한 표면은 반자동 안내).
 *
 * 예측이 아니라 **현재 파일 상태를 읽어** 실제로 남아 있는 것만 출력한다.
 */
function manualAdvisoryLines(
  targetAssets: ReadonlyArray<InstallLogAsset>,
  projectDir: string,
): string[] {
  if (!targetAssets.some((a) => a.id === KARPATHY_ASSET_ID)) return [];

  const items: string[] = [];
  if (settingsHasHookCommand(projectDir, KARPATHY_HOOK_COMMAND))
    items.push(
      `.claude/settings.json — hooks.PreToolUse 에서 다음 command 항목 삭제:\n      ${KARPATHY_HOOK_COMMAND}`,
    );
  if (existsSync(join(projectDir, KARPATHY_HOOK_RELPATH)))
    items.push(`\`${KARPATHY_HOOK_RELPATH}\` — 삭제`);

  if (items.length === 0) return [];
  return [
    "",
    c.yellow("[MANUAL] 자동으로 되돌리지 않은 것 (사용자 편집이 섞이는 표면):"),
    ...items.map((i) => c.dim(`  · ${i}`)),
  ];
}

function buildGlobalAdvisoryCmd(asset: InstallLogAsset): string {
  switch (asset.method) {
    case "plugin": {
      const pid = asset.detail.pluginId ?? asset.id;
      return `claude plugin uninstall --scope user ${pid}`;
    }
    case "skill": {
      const s = asset.detail.source ?? asset.id;
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
  rm: (path: string) => void,
): { rootClaudeMdKept: boolean } {
  rm(join(projectDir, log.templates.claudeDir));
  if (log.templates.codexDir) rm(join(projectDir, log.templates.codexDir));
  if (log.templates.opencodeDir) rm(join(projectDir, log.templates.opencodeDir));
  // root CLAUDE.md — install 원본 그대로일 때만 삭제. 사용자가 수정했으면 보존.
  const rootMd = log.templates.rootClaudeMd;
  if (rootMd) {
    if (rootClaudeMdModified(log, projectDir)) return { rootClaudeMdKept: true };
    rm(join(projectDir, rootMd.path));
  }
  return { rootClaudeMdKept: false };
}

/** root CLAUDE.md 가 install 이후 수정됐는지. log 에 없거나 파일 부재 시 false (= 삭제 대상). */
function rootClaudeMdModified(log: InstallLog, projectDir: string): boolean {
  const rootMd = log.templates.rootClaudeMd;
  if (!rootMd) return false;
  const path = join(projectDir, rootMd.path);
  if (!existsSync(path)) return false;
  return hashContent(readFileSync(path, "utf8")) !== rootMd.sha256;
}

function formatTemplateList(log: InstallLog): string {
  const items: string[] = [log.templates.claudeDir];
  if (log.templates.codexDir) items.push(log.templates.codexDir);
  if (log.templates.opencodeDir) items.push(log.templates.opencodeDir);
  return items.join(", ");
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
      "[Mode] Keep `.claude/`, `.codex/`, `.opencode/` templates (remove only external assets)",
    )
    .option(
      "--only <ids>",
      "[Scope] Remove only these assets (comma-separated ids from `agent-harness list`). Templates untouched",
    )
    /* v8 ignore next 3 — cac action callback. uninstallAction 자체는 별도 tests 로 검증. */
    .action((options: UninstallOptions) => {
      uninstallAction(options);
    });
}

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
 *
 * 안전:
 *   - log 없으면 명확 에러 + early exit.
 *   - scope=global 자산은 절대 자동 삭제 X (D16).
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
import { KARPATHY_ASSET_ID, KARPATHY_HOOK_COMMAND } from "../installer.js";
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

export function uninstallAction(options: UninstallOptions, deps: UninstallActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const spawn = deps.spawn ?? defaultSpawn;
  const rm = deps.rm ?? defaultRm;

  const projectDir = resolve(options.projectDir ?? process.cwd());
  const installLog = readInstallLog(projectDir);
  if (!installLog) {
    err(status.failure(c.red(`ERROR: install log not found at ${installLogPath(projectDir)}`)));
    err(c.dim("       Was this project installed by agent-harness? Nothing to uninstall."));
    exit(1);
    return;
  }

  // v26.123.0 (F-1c) — `--only <id,...>` 항목별 제거. 오타로 엉뚱한 자산이 남는 일이 없도록
  // 알 수 없는 id 는 아무것도 실행하기 전에 차단한다 (Pre-flight — 부분 작업 없음).
  const selectedIds = parseOnly(options.only);
  if (selectedIds) {
    const known = new Set(installLog.assets.map((a) => a.id));
    const unknown = selectedIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      err(status.failure(c.red(`ERROR: not in install log: ${unknown.join(", ")}`)));
      err(c.dim(`       installed: ${[...known].join(", ") || "(none)"}`));
      exit(1);
      return;
    }
  }
  const targetAssets = selectedIds
    ? installLog.assets.filter((a) => selectedIds.includes(a.id))
    : installLog.assets;
  // `--only` 는 자산만 건드린다 — templates 를 지우면 "하나만 빼기"가 아니게 된다.
  const keepTemplates = options.keepTemplates || selectedIds !== null;

  const { reverseSteps, globalAdvisories } = planReverse(targetAssets, spawn, rm, projectDir);

  log("");
  log(c.bold("uzys-agent-harness · uninstall"));
  log("");
  log(c.dim(`  installed: ${installLog.installedAt}`));
  log(c.dim(`  scope:     ${installLog.scope}`));
  log(
    c.dim(
      selectedIds
        ? `  assets:    ${targetAssets.length} selected of ${installLog.assets.length} (--only)`
        : `  assets:    ${installLog.assets.length}`,
    ),
  );
  log("");

  if (options.dryRun) {
    log(c.yellow("[DRY RUN] reverse list (실제 변경 없음):"));
    log("");
    if (reverseSteps.length === 0) {
      log(c.dim("  (no project-scope assets to reverse)"));
    }
    for (const step of reverseSteps) {
      log(`  ○ ${step.label}`);
    }
    if (!keepTemplates) {
      log(`  ○ remove templates: ${formatTemplateList(installLog)}`);
      if (installLog.templates.rootClaudeMd) {
        log(
          rootClaudeMdModified(installLog, projectDir)
            ? "  ○ keep CLAUDE.md (modified since install — preserved)"
            : "  ○ remove CLAUDE.md",
        );
      }
    }
    if (globalAdvisories.length > 0) {
      log("");
      log(
        c.yellow(
          `[GLOBAL] ${globalAdvisories.length} asset(s) at scope=global — manual removal required (D16):`,
        ),
      );
      for (const adv of globalAdvisories) {
        log(c.dim(`  · ${adv.asset.id} (${adv.asset.method})  →  ${adv.command}`));
      }
    }
    for (const line of manualAdvisoryLines(targetAssets, projectDir)) {
      log(line);
    }
    log("");
    exit(0);
    return;
  }

  // Execute reverse steps
  let succeeded = 0;
  let failed = 0;
  const removedIds: string[] = [];
  for (const step of reverseSteps) {
    const result = step.execute();
    if (result.ok) {
      log(`  ${status.success("✓")} ${step.label}`);
      removedIds.push(step.assetId);
      succeeded++;
    } else {
      log(`  ${c.yellow("⊘")} ${step.label}  (${result.message ?? "failed"})`);
      failed++;
    }
  }

  if (!keepTemplates) {
    const { rootClaudeMdKept } = removeTemplates(installLog, projectDir, rm);
    log(`  ${status.success("✓")} templates removed: ${formatTemplateList(installLog)}`);
    if (rootClaudeMdKept) {
      log(
        `  ${c.yellow("⊘")} CLAUDE.md kept — modified since install. Remove manually if intended.`,
      );
    }
  }

  if (selectedIds) {
    // v26.123.0 (F-1c) — 로그를 지우는 게 아니라 **되돌린 것만 빼고 다시 쓴다**.
    // 실패한 항목은 남긴다 — 실제로 안 지워진 걸 기록에서 지우면 그게 곧 거짓 기록이다.
    const remaining = installLog.assets.filter((a) => !removedIds.includes(a.id));
    writeInstallLog(projectDir, { ...installLog, assets: remaining });
    log(`  ${status.success("✓")} install log updated (${remaining.length} asset(s) remain)`);
  } else if (keepTemplates) {
    // install log 자체도 함께 제거 (templates 제거 시 .claude/ 통째 사라짐 → log 도 자동 사라짐.
    // keepTemplates 시 .claude/ 유지 → log 만 명시 제거).
    rm(installLogPath(projectDir));
    log(`  ${status.success("✓")} install log removed (templates kept)`);
  }

  if (globalAdvisories.length > 0) {
    log("");
    log(
      c.yellow(
        `[GLOBAL] ${globalAdvisories.length} asset(s) at scope=global — manual removal required (D16):`,
      ),
    );
    for (const adv of globalAdvisories) {
      log(c.dim(`  · ${adv.asset.id} (${adv.asset.method})`));
      log(c.dim(`      ${adv.command}`));
    }
  }

  for (const line of manualAdvisoryLines(targetAssets, projectDir)) {
    log(line);
  }

  log("");
  log(
    succeeded === reverseSteps.length && failed === 0
      ? status.success(c.green(`uninstall complete (${succeeded} asset(s))`))
      : c.yellow(`uninstall finished with ${failed} skip(s) (${succeeded} ok)`),
  );
  exit(failed === 0 ? 0 : 1);
}

function planReverse(
  assets: ReadonlyArray<InstallLogAsset>,
  spawn: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>,
  _rm: (path: string) => void,
  _projectDir: string,
): { reverseSteps: ReverseStep[]; globalAdvisories: GlobalAdvisory[] } {
  const reverseSteps: ReverseStep[] = [];
  const globalAdvisories: GlobalAdvisory[] = [];

  for (const asset of assets) {
    if (asset.scope === "global") {
      globalAdvisories.push({ asset, command: buildGlobalAdvisoryCmd(asset) });
      continue;
    }
    const step = buildProjectReverseStep(asset, spawn);
    if (step) reverseSteps.push(step);
  }

  return { reverseSteps, globalAdvisories };
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
  const hookPath = join(projectDir, ".claude", "hooks", "karpathy-gate.sh");
  if (existsSync(hookPath)) items.push("`.claude/hooks/karpathy-gate.sh` — 삭제");

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

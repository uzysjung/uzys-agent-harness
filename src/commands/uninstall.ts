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
import {
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  installLogPath,
  readInstallLog,
} from "../install-log.js";

export interface UninstallOptions {
  projectDir?: string;
  dryRun?: boolean;
  keepTemplates?: boolean;
}

export interface UninstallActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  spawn?: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>;
  rm?: (path: string) => void;
}

interface ReverseStep {
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

  const { reverseSteps, globalAdvisories } = planReverse(installLog, spawn, rm, projectDir);

  log("");
  log(c.bold("uzys-agent-harness · uninstall"));
  log("");
  log(c.dim(`  installed: ${installLog.installedAt}`));
  log(c.dim(`  scope:     ${installLog.scope}`));
  log(c.dim(`  assets:    ${installLog.assets.length}`));
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
    if (!options.keepTemplates) {
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
    log("");
    exit(0);
    return;
  }

  // Execute reverse steps
  let succeeded = 0;
  let failed = 0;
  for (const step of reverseSteps) {
    const result = step.execute();
    if (result.ok) {
      log(`  ${status.success("✓")} ${step.label}`);
      succeeded++;
    } else {
      log(`  ${c.yellow("⊘")} ${step.label}  (${result.message ?? "failed"})`);
      failed++;
    }
  }

  if (!options.keepTemplates) {
    const { rootClaudeMdKept } = removeTemplates(installLog, projectDir, rm);
    log(`  ${status.success("✓")} templates removed: ${formatTemplateList(installLog)}`);
    if (rootClaudeMdKept) {
      log(
        `  ${c.yellow("⊘")} CLAUDE.md kept — modified since install. Remove manually if intended.`,
      );
    }
  }

  // install log 자체도 함께 제거 (templates 제거 시 .claude/ 통째 사라짐 → log 도 자동 사라짐.
  // keepTemplates 시 .claude/ 유지 → log 만 명시 제거).
  if (options.keepTemplates) {
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

  log("");
  log(
    succeeded === reverseSteps.length && failed === 0
      ? status.success(c.green(`uninstall complete (${succeeded} asset(s))`))
      : c.yellow(`uninstall finished with ${failed} skip(s) (${succeeded} ok)`),
  );
  exit(failed === 0 ? 0 : 1);
}

function planReverse(
  log: InstallLog,
  spawn: (cmd: string, args: ReadonlyArray<string>) => SpawnSyncReturns<string>,
  _rm: (path: string) => void,
  _projectDir: string,
): { reverseSteps: ReverseStep[]; globalAdvisories: GlobalAdvisory[] } {
  const reverseSteps: ReverseStep[] = [];
  const globalAdvisories: GlobalAdvisory[] = [];

  for (const asset of log.assets) {
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
        label: `npx skills remove ${source}`,
        execute: () => {
          const r = spawn("npx", ["skills", "remove", source, "--yes"]);
          return r.status === 0 ? { ok: true } : { ok: false, message: (r.stderr || "").trim() };
        },
      };
    }
    case "npm": {
      const pkg = asset.detail.pkg ?? asset.id;
      return {
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
    /* v8 ignore next 3 — cac action callback. uninstallAction 자체는 별도 tests 로 검증. */
    .action((options: UninstallOptions) => {
      uninstallAction(options);
    });
}

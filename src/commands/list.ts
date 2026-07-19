/**
 * List command — v26.123.0 (F-1b).
 *
 * `.claude/.harness-install.json` 을 사람이 읽는 표로 출력한다. 기록은 v26.64.0(ADR-020)부터
 * 있었지만 **사용자가 볼 수단이 없었다** — 무엇이 깔렸는지 알 수 없으면 항목별 제거(`--only`)의
 * 입력값도 알 수 없다. 본 커맨드가 그 입력값(자산 id)을 보여주는 곳이다.
 *
 * 읽기 전용 — 어떤 파일도 쓰지 않는다.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { c, padDisplay, status } from "../design.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  type InstallLogRootFile,
  installLogPath,
  readInstallLog,
} from "../install-log.js";

export interface ListOptions {
  projectDir?: string;
}

export interface ListActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
}

export function listAction(options: ListOptions = {}, deps: ListActionDeps = {}): void {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);

  const projectDir = resolve(options.projectDir ?? process.cwd());
  const installLog = readInstallLog(projectDir);
  if (!installLog) {
    err(status.failure(c.red(`ERROR: install log not found at ${installLogPath(projectDir)}`)));
    err(c.dim("       Nothing installed here by agent-harness."));
    exit(1);
    return;
  }

  log("");
  log(c.bold("uzys-agent-harness · installed"));
  log("");
  log(c.dim(`  installed: ${installLog.installedAt}`));
  log(c.dim(`  scope:     ${installLog.scope}`));
  log(c.dim(`  tracks:    ${installLog.spec.tracks.join(", ") || "(none)"}`));
  log(c.dim(`  cli:       ${installLog.spec.cli.join(", ") || "(none)"}`));
  log("");

  log(c.bold(`  Assets (${installLog.assets.length})`));
  if (installLog.assets.length === 0) {
    log(c.dim("    (none — 내부 템플릿만 설치됨)"));
  }
  for (const line of formatAssetRows(installLog.assets)) {
    log(line);
  }

  log("");
  log(c.bold("  Templates"));
  for (const line of formatTemplateRows(installLog, projectDir)) {
    log(line);
  }

  const rootRows = formatRootFileRows(installLog.rootFiles ?? [], projectDir);
  if (rootRows.length > 0) {
    log("");
    log(c.bold("  Root files"));
    log(c.dim("    (uninstall 이 지우지 않는다 — 사용자 내용이 섞인다)"));
    for (const line of rootRows) log(line);
  }

  log("");
  log(c.dim("  remove one:  agent-harness uninstall --only <id>"));
  log(c.dim("  remove all:  agent-harness uninstall"));
  log("");
  exit(0);
}

/** 자산 행 — id / method / scope / version. global 은 uninstall 이 자동 삭제하지 않으므로 표시한다. */
export function formatAssetRows(assets: ReadonlyArray<InstallLogAsset>): string[] {
  const idWidth = Math.max(0, ...assets.map((a) => a.id.length));
  const methodWidth = Math.max(0, ...assets.map((a) => a.method.length));
  return assets.map((a) => {
    const marker = a.scope === "global" ? c.yellow("!") : c.green("✓");
    const version = a.version ? c.dim(` v${a.version}`) : "";
    const note = a.scope === "global" ? c.yellow("  (manual removal — D16)") : "";
    return `    ${marker} ${padDisplay(a.id, idWidth)}  ${c.dim(padDisplay(a.method, methodWidth))}  ${c.dim(a.scope)}${version}${note}`;
  });
}

/** templates 행 — 디렉토리 + root CLAUDE.md 수정 여부(uninstall 이 보존할지 여부와 같은 판정). */
function formatTemplateRows(log: InstallLog, projectDir: string): string[] {
  const dirs = [log.templates.claudeDir, log.templates.codexDir, log.templates.opencodeDir].filter(
    (d): d is string => Boolean(d),
  );
  const rows = [`    ${c.dim(dirs.join("  "))}`];
  const rootMd = log.templates.rootClaudeMd;
  if (rootMd) {
    const path = join(projectDir, rootMd.path);
    const modified = existsSync(path) && hashContent(readFileSync(path, "utf8")) !== rootMd.sha256;
    rows.push(
      modified
        ? `    ${c.dim(rootMd.path)}  ${c.yellow("(수정됨 — uninstall 시 보존)")}`
        : `    ${c.dim(rootMd.path)}`,
    );
  }
  return rows;
}

/**
 * v26.124.0 (F-1f) — `.claude/` 밖 루트 파일 행. uninstall 안내와 같은 규율로
 * **실재하는 것만** 낸다 (사용자가 이미 지운 파일을 인벤토리에 남기면 그게 거짓 기록이다).
 */
function formatRootFileRows(
  rootFiles: ReadonlyArray<InstallLogRootFile>,
  projectDir: string,
): string[] {
  const present = rootFiles.filter((f) => existsSync(join(projectDir, f.path)));
  const width = Math.max(0, ...present.map((f) => f.path.length));
  return present.map(
    (f) =>
      `    ${c.dim(padDisplay(f.path, width))}  ${c.dim(f.change === "created" ? "생성" : "병합")}  ${c.dim(f.notes.join(" / "))}`,
  );
}

export function registerListCommand(cli: import("../cli.js").Cli): void {
  cli
    .command("list", "Show what agent-harness installed in this project")
    .option("--project-dir <path>", "[Project] Target project directory", {
      default: process.cwd(),
    })
    /* v8 ignore next 3 — cac action callback. listAction 자체는 별도 tests 로 검증. */
    .action((options: ListOptions) => {
      listAction(options);
    });
}

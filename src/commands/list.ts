/**
 * List command — v26.123.0 (F-1b).
 *
 * `.uzys-agent-harness/.harness-install.json` 을 사람이 읽는 표로 출력한다. 기록은 v26.64.0(ADR-020)부터
 * 있었지만 **사용자가 볼 수단이 없었다** — 무엇이 깔렸는지 알 수 없으면 항목별 제거(`--only`)의
 * 입력값도 알 수 없다. 본 커맨드가 그 입력값(자산 id)을 보여주는 곳이다.
 *
 * 읽기 전용 — 어떤 파일도 쓰지 않는다.
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { isKeyId } from "../adapters/index.js";
import { c, padDisplay, status } from "../design.js";
import { excludedStillThere } from "../excluded-still-there.js";
import {
  corruptedInstallLogMessage,
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  type InstallLogRootFile,
  installedClis,
  installLogPath,
  readInstallLogStatus,
} from "../install-log.js";
import { excludedIds } from "../recorded.js";

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
  // #640 — "설치 없음"과 "기록 깨짐"을 구분한다. 파일이 있는데 not found 로 진단하면
  // 사용자는 원인(병합 충돌·부분 기록·수동 편집)을 못 찾는다.
  const statusResult = readInstallLogStatus(projectDir);
  if (statusResult.status === "corrupted") {
    err(c.red(`ERROR: ${corruptedInstallLogMessage(projectDir)}`));
    exit(1);
    return;
  }
  const installLog = statusResult.log;
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
  // #528 — **지금 깔려 있는 집합**을 보여 준다. `spec.cli` 는 마지막 설치가 고른 것이라
  // `uninstall --cli codex` 뒤에도 codex 를 계속 말한다 — 화면이 디스크와 다른 말을 하는 자리였다.
  log(c.dim(`  cli:       ${installedClis(installLog).join(", ") || "(none)"}`));
  log("");

  log(c.bold(`  Assets (${installLog.assets.length})`));
  if (installLog.assets.length === 0) {
    log(c.dim("    (none — 내부 템플릿만 설치됨)"));
  }
  for (const line of formatAssetRows(installLog.assets)) {
    log(line);
  }

  log("");
  log(c.bold("  Harness files"));
  for (const line of formatHarnessFileRows(installLog, projectDir)) {
    log(line);
  }

  const rootRows = formatRootFileRows(installLog.rootFiles ?? [], projectDir);
  if (rootRows.length > 0) {
    log("");
    log(c.bold("  Root files"));
    log(c.dim("    (uninstall 이 지우지 않는다 — 사용자 내용이 섞인다)"));
    for (const line of rootRows) log(line);
  }

  // 설계 selection-record §1 — 무엇을 지금 빼 두었고, 언제 어떤 명령으로 빼고 되돌렸나
  log("");
  log(c.bold("  Selections"));
  for (const line of formatSelectionRows(installLog, projectDir)) log(line);

  log("");
  log(c.dim("  remove one:  agent-harness uninstall --only <id>"));
  log(c.dim("  remove all:  agent-harness uninstall"));
  log("");
  exit(0);
}

/** `list` 가 보여 주는 이력 수 — 기록은 `SELECTIONS_MAX` 개까지 둔다. */
const SELECTIONS_SHOWN = 10;

/**
 * 설계 selection-record §1 — 지금 빼 둔 id(종류 · 디스크에 남았나) + 최근 이력. 이력 한 줄 = 날짜 + 그 실행이 바꾼 것.
 */
export function formatSelectionRows(log: InstallLog, projectDir: string): string[] {
  const rows: string[] = [];
  const excluded = [...excludedIds(log)].sort();
  if (excluded.length === 0) rows.push(c.dim("    excluded: (none)"));
  const still = new Set(
    excludedStillThere(projectDir, new Set(excluded), [], log).map((e) => e.id),
  );
  for (const id of excluded) {
    const kind = id.startsWith("baseline:") ? "baseline" : isKeyId(id) ? "harness part" : "asset";
    rows.push(`    ⊘ ${id}  ${c.dim(`(${kind}${still.has(id) ? " · still on disk" : ""})`)}`);
  }
  const history = (log.selections ?? []).slice(-SELECTIONS_SHOWN);
  if (history.length > 0) rows.push(c.dim(`    history (latest ${history.length}):`));
  for (const ev of history) {
    const day = ev.at.slice(0, 10);
    const parts: string[] = [];
    if (ev.by === "migration") {
      if (ev.released?.length) parts.push(`released ${ev.released.join(", ")}`);
      if (ev.kept?.length) parts.push(`kept ${ev.kept.join(", ")}`);
      rows.push(`      ${day}  migration (26.162–26.163 record): ${parts.join(" · ")}`);
      continue;
    }
    if (ev.without?.length) parts.push(`--without ${ev.without.join(", ")}`);
    if (ev.with?.length) parts.push(`re-added ${ev.with.join(", ")}`);
    const tags = [ev.via === "wizard" ? "wizard" : "", ev.interrupted ? "interrupted" : ""]
      .filter(Boolean)
      .join(", ");
    rows.push(`      ${day}  install ${parts.join(" · ")}${tags ? ` (${tags})` : ""}`);
  }
  return rows;
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

/**
 * 하네스 파일 행 — **기록이 말하는 자리만** 최상위 폴더·파일로 + root CLAUDE.md 수정 여부(uninstall 이
 * 보존할지 여부와 같은 판정).
 *
 * #559 (설계 §2 행 25) — `templates.*Dir` 는 읽지 않는다. 그 필드는 CLI 를 골랐다는 뜻으로 적혔을 뿐
 * 하네스가 그 폴더를 만들었다는 기록이 아니다(OpenCode 는 `.opencode/` 를 만들지 않는데 `list` 가 보였다).
 *
 * - codex · opencode · antigravity 산출물 = `externalFiles`(쓰는 순간 경로·sha 를 적는다).
 * - `.claude/` = claude 가 **깔린 CLI 집합**에 있을 때만(`installedClis` — 기록에서 유도, 디스크 아님).
 *   `.claude/` 의 파일별 기록(`policyFiles`·`skillFiles`)은 옛 판이 디스크를 훑어 적은 값이라 설치자 파일이
 *   섞여 있다 — 파일 단위로 보이려면 소유 필터(PR-1 `recorded()`)가 필요해 여기서는 폴더만 말한다.
 */
function harnessFileTops(log: InstallLog): string[] {
  const tops = new Set<string>();
  if (installedClis(log).includes("claude")) tops.add(".claude/");
  for (const f of log.externalFiles ?? []) {
    const slash = f.path.indexOf("/");
    tops.add(slash === -1 ? f.path : f.path.slice(0, slash + 1));
  }
  return [...tops];
}

function formatHarnessFileRows(log: InstallLog, projectDir: string): string[] {
  const tops = harnessFileTops(log);
  const rows = [`    ${c.dim(tops.length > 0 ? tops.join("  ") : "(none recorded)")}`];
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
 * `rootFiles.change` 의 짧은 이름 — #551(ADR-097)이 둘을 더했다: advisory(넘겨준 파일 — 이제 설치자 것) ·
 * displaced(하네스 자리에 있던 설치자 파일을 비켜 뒀다 — notes 가 그 백업 경로).
 */
const ROOT_FILE_CHANGE: Record<InstallLogRootFile["change"], string> = {
  created: "생성",
  modified: "병합",
  advisory: "넘겨줌",
  displaced: "비켜 둠",
};

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
      `    ${c.dim(padDisplay(f.path, width))}  ${c.dim(ROOT_FILE_CHANGE[f.change])}  ${c.dim(f.notes.join(" / "))}`,
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

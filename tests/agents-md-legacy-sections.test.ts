/**
 * #774 (ADR-111) — 옛 판(마커 이전, v26.83~v26.159)이 쓴 `AGENTS.md` 를 update · uninstall 이 알아보고, 하네스가 바이트 그대로 쓴 몫만
 * 걷는다. 설치자가 쓰거나 고친 절은 남고, 옛 하네스 몫을 떨어뜨린 쓰기는 파일 1회 백업을 남긴다.
 *
 * 설치자에게 달라지는 것:
 * - v26.83~v26.132 설치본(기록 필드 없음 · 블록 모델로 읽혔다): update 가 옛 파일 전체(31절) 위에 새 블록을 덧붙여 51절이 매 세션
 *   상주했고 uninstall 뒤에도 옛 파일이 남았다 — 이제 update 는 절 모델로 갈아타고(채운 Project Context 는 이어받는다) uninstall 은
 *   설치자 절만 남기거나 파일을 지운다. v26.169 로 이미 update 해 블록이 붙은 파일도 같은 길이다(N2).
 * - v26.133~v26.150 설치본: 옛 템플릿의 꼬리 절(`Protected Files (DO NOT EDIT)` · `Git Policy` …)이 설치자 절로 되살아나 uninstall
 *   뒤에도 남았다 — 이제 update 가 떨어뜨리고(백업 1회 · 화면 한 줄) uninstall 도 걷는다.
 *
 * 픽스처 = npm 게시판을 컨테이너에 실제로 깐 `AGENTS.md`(`docs/plans/v26.170.0-design-evidence/container/` · v26.153.0 은 같은 방법으로
 * 새로 깔았다) 바이트 그대로다.
 */

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADAPTERS } from "../src/adapters/index.js";
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  legacyInstallLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const FIX = join(__dirname, "fixtures/legacy-agents-md");
const fixture = (name: string): string => readFileSync(join(FIX, name), "utf8");
/** v26.100.0 · codex — 블록 모델 옛 파일(31절 · 머리 블록인용 · 옛 앵커 Rule 1~12 · 꼬리 절). */
const V100 = fixture("v26.100.0-codex.AGENTS.md");
/** v26.100.0 → 설치자 `## My Team Rules` → v26.169 update — 옛 본문 + 첫 접촉 블록(N2). */
const V100_V169 = fixture("v26.100.0-codex-after-v26.169-update.AGENTS.md");
/** v26.140.0 · codex — 절 모델(`externalFiles` sha) · 꼬리 절 7. */
const V140 = fixture("v26.140.0-codex.AGENTS.md");
/** v26.140.0 → 설치자 `## My Team Rules` → v26.169 update — 꼬리 6절이 설치자 절로 되살아나 기록 sha 안에 들었다. */
const V140_V169 = fixture("v26.140.0-codex-after-v26.169-update.AGENTS.md");
/** v26.153.0 · codex — 꼬리 없음 · 마커 없음 · 머리 블록인용 없음. */
const V153 = fixture("v26.153.0-codex.AGENTS.md");
/** v26.150.0 · codex · tooling — 절 모델 · 인라인 룰(`## Harness Rules` 안 `## Shell Safety` …) · 꼬리 절(컨테이너 실설치본). */
const V150 = fixture("v26.150.0-codex.AGENTS.md");
/** PR #789 손실 탐색 실측(`f1-sessedit-26.140`) — v26.140 설치 뒤 `## Session Start` 끝에 설치자 한 줄. */
const V140_SESSEDIT = fixture("v26.140.0-codex-sessedit.AGENTS.md");
/** PR #789 손실 탐색 실측(`f1-rulesintro-26.100`) — v26.100 설치 뒤 `## Project Rules` 머리말에 설치자 한 줄. */
const V100_RULESINTRO = fixture("v26.100.0-codex-rulesintro.AGENTS.md");

const MINE = "## My Team Rules\n\nMINE-SECTION\n";
/** 옛 판 꼬리 절 제목 — 옛 템플릿이 `## Session Start` 뒤에 쓴 하네스 절(지문 일치). */
const TAIL = [
  "## Protected Files (DO NOT EDIT)",
  "## Git Policy",
  "## Agents (subagent, multi_agent stable)",
  "## Hooks 현황 (Codex 0.124.0 실측 제약)",
  "## Experience Accumulation",
];
const OLD_PREAMBLE = "> **Generated from**";
const OLD_BANNER = "The universal harness rules (Rule 1–12)";
const ANCHOR_START = "<!-- uzys-harness:anchor:start -->";
const AGENTS_BLOCK_START = "<!-- uzys-harness:agents:start -->";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "agents-md-legacy-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const agentsPath = (): string => join(projectDir, "AGENTS.md");
const agents = (): string => readFileSync(agentsPath(), "utf8");
const backups = (): string[] =>
  readdirSync(projectDir)
    .filter((f) => /^AGENTS\.md\.backup-/.test(f))
    .sort();
const backupText = (): string[] => backups().map((f) => readFileSync(join(projectDir, f), "utf8"));
const headings = (text: string): string[] => text.split("\n").filter((l) => /^## /.test(l));
const log = (): InstallLog => readInstallLog(projectDir) as InstallLog;

const spec = (cli: CliTargets): InstallSpec => ({
  tracks: ["tooling"],
  options: { withCodexTrust: false },
  cli: [...cli],
  projectDir,
});

/** install · update — update 면 화면(진행 + 요약)을 색 코드 없이 돌려준다. */
function run(cli: CliTargets, mode: "add" | "update" = "add"): string {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(cli), false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  if (mode === "update") renderUpdateSummary((m) => lines.push(m), spec(cli), report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

function uninstall(opts: { cli?: string } = {}): string {
  const lines: string[] = [];
  let code: number | null = null;
  uninstallAction(
    { projectDir, ...(opts.cli === undefined ? { yes: true } : { cli: opts.cli, yes: true }) },
    {
      exit: (c: number) => {
        code ??= c;
        return undefined as never;
      },
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  expect(code ?? 0).toBe(0);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

/** v26.83~v26.125 설치본 — 기록 필드가 없고(`AGENTS.md` 기록 없음) `.claude/` 안에 있다. */
function oldFieldless(text: string, cli: CliTargets = ["claude", "codex"]): void {
  run(cli);
  writeFileSync(agentsPath(), text);
  const l = log();
  delete l.records;
  delete l.policyFiles;
  delete l.skillFiles;
  delete l.externalFiles;
  delete l.portions;
  writeInstallLog(projectDir, l);
  renameSync(installLogPath(projectDir), legacyInstallLogPath(projectDir));
}

/** v26.133~v26.152 설치본(또는 그 위에서 v26.169 update) — `AGENTS.md` 가 `externalFiles` 에 그 바이트의 sha 로 적혀 있다. */
function oldSectionModel(text: string): void {
  run(["claude", "codex"]);
  writeFileSync(agentsPath(), text);
  const l = log();
  delete l.records;
  l.externalFiles = (l.externalFiles ?? []).map((f) =>
    f.path === "AGENTS.md" ? { ...f, sha256: hashContent(text) } : f,
  );
  l.portions = (l.portions ?? []).filter((p) => p.path !== "AGENTS.md");
  writeInstallLog(projectDir, l);
}

/**
 * v26.83~v26.132 설치본을 v26.169 로 update 한 모양(N2) — 파일 끝에 첫 접촉 블록, 기록은 `portions` 의 블록 몫뿐이고 `externalFiles` 에
 * `AGENTS.md` 가 없다(외부 산출물은 적혀 있다 — v26.169 update 가 적었다).
 */
function oldBlockUpdatedByV169(text: string): void {
  run(["claude", "codex"]);
  writeFileSync(agentsPath(), text);
  const l = log();
  delete l.records;
  l.externalFiles = (l.externalFiles ?? []).filter((f) => f.path !== "AGENTS.md");
  const blocks = ADAPTERS["marker-md"].read(text) ?? new Map<string, string>();
  expect(blocks.has("agents"), "픽스처 자기검증 — 첫 접촉 블록이 있다").toBe(true);
  l.portions = [
    ...(l.portions ?? []).filter((p) => p.path !== "AGENTS.md"),
    ...[...blocks].map(([key, sha256]) => ({
      path: "AGENTS.md",
      adapter: "marker-md" as const,
      key,
      sha256,
    })),
  ];
  writeInstallLog(projectDir, l);
}

/** 옛 하네스 몫이 하나도 안 남았다(머리 · 옛 배너 · 옛 앵커 · 꼬리). */
function expectNoOldHarness(text: string): void {
  expect(text).not.toContain(OLD_PREAMBLE);
  expect(text).not.toContain(OLD_BANNER);
  expect(text).not.toContain("## Rule 1 — Think Before Coding");
  expect(text).not.toContain("## 1. Think before coding");
  for (const t of TAIL) expect(text, t).not.toContain(t);
}

describe("#774 update — 옛 판 `AGENTS.md`", () => {
  it("① v26.100 블록 모델(기록 없음) → 절 모델 · 옛 앵커 · 꼬리 · 머리 0 · 안 채운 옛 스캐폴드는 렌더로 · 백업 1 · 2회차 바이트 동일", () => {
    oldFieldless(V100);

    run(["claude", "codex"], "update");

    const after = agents();
    expectNoOldHarness(after);
    expect(after).toContain(ANCHOR_START);
    expect(after).not.toContain(AGENTS_BLOCK_START);
    expect(headings(after)).toContain("## Harness Rules");
    // 옛 파일 전체는 백업에 남는다(설치자가 뭘 썼는지 모르는 파일을 통째로 바꿨다)
    expect(backupText()).toEqual([V100]);
    // 이제 하네스 파일이다 — 기록 sha = 디스크 · 첫 접촉(displaced) 아님 · 블록 몫 기록 없음
    const l = log();
    expect(l.externalFiles?.find((f) => f.path === "AGENTS.md")?.sha256).toBe(hashContent(after));
    expect((l.rootFiles ?? []).filter((f) => f.path === "AGENTS.md")).toEqual([]);
    expect((l.portions ?? []).filter((p) => p.path === "AGENTS.md")).toEqual([]);

    run(["claude", "codex"], "update");

    expect(agents()).toBe(after);
    expect(backups()).toHaveLength(1);
  });

  it("①′ install 재실행(`add`)도 같은 쓰기다 — 절 모델 · 옛 몫 0 · 백업 1 · displaced 아님", () => {
    oldFieldless(`${V100}\n${MINE}`);

    run(["claude", "codex"]);

    const after = agents();
    expectNoOldHarness(after);
    expect(after).toContain(ANCHOR_START);
    expect(headings(after).at(-1)).toBe("## My Team Rules");
    expect(backups()).toHaveLength(1);
    expect((log().rootFiles ?? []).filter((f) => f.path === "AGENTS.md")).toEqual([]);
  });

  it("② 설치자가 더한 절과 한 줄 고친 옛 앵커 절은 파일 끝에 남는다 — 그 밖의 옛 하네스 몫은 0", () => {
    const edited = `${V100.replace(
      "## Rule 3 — Surgical Changes\n",
      "## Rule 3 — Surgical Changes\n\nMINE-ANCHOR-EDIT\n",
    )}\n${MINE}`;
    expect(edited, "픽스처 자기검증 — 앵커 절을 고쳤다").toContain("MINE-ANCHOR-EDIT");
    oldFieldless(edited);

    run(["claude", "codex"], "update");

    const after = agents();
    const tail = headings(after).slice(headings(after).indexOf("## Protected Files") + 1);
    expect(tail).toEqual(["## Rule 3 — Surgical Changes", "## My Team Rules"]);
    expect(after).toContain("MINE-ANCHOR-EDIT");
    expect(after).toContain("MINE-SECTION");
    expect(after).not.toContain("## Rule 1 — Think Before Coding");
    for (const t of TAIL) expect(after, t).not.toContain(t);
    expect(backupText()).toEqual([edited]);
  });

  it("③ v26.140 절 모델(기록 sha 그대로) → 옛 앵커 7 · 꼬리 6 을 되살리지 않고 백업 1 · 화면 한 줄 · 2회차 조용", () => {
    oldSectionModel(V140);

    const screen = run(["claude", "codex"], "update");

    const after = agents();
    expectNoOldHarness(after);
    expect(screen).toContain("removed 13 section(s) written by an older harness version");
    expect(backupText()).toEqual([V140]);

    const again = run(["claude", "codex"], "update");

    expect(agents()).toBe(after);
    expect(backups()).toHaveLength(1);
    expect(again).not.toContain("written by an older harness version");
  });

  it("③′ v26.140 을 v26.169 로 update 해 꼬리 6절이 기록 sha 안에 든 파일 → 꼬리만 빠지고 설치자 절은 남는다 · 백업 1 · 화면 `removed 6`", () => {
    expect(hashContent(V140_V169), "픽스처 자기검증 — 실측 기록(record-2.json) sha").toBe(
      "fb2c83374181fd1ba1fb8932817f80e975af79ec264dc862f449ff7cc1493bd9",
    );
    oldSectionModel(V140_V169);

    const screen = run(["claude", "codex"], "update");

    const after = agents();
    for (const t of TAIL) expect(after, t).not.toContain(t);
    expect(headings(after).at(-1)).toBe("## My Team Rules");
    expect(after).toContain("MINE-SECTION");
    expect(screen).toContain("removed 6 section(s) written by an older harness version");
    expect(backupText()).toEqual([V140_V169]);
  });

  it("⑥ 설치자가 처음부터 쓴 `AGENTS.md`(옛 머리 없음) → 지금처럼 블록 모델 · 본문 바이트 그대로 · uninstall 뒤 원래 바이트", () => {
    const own = "# My project\n\nOur notes.\n\n## Team\n\nrules\n";
    oldFieldless(own);

    run(["claude", "codex"], "update");

    expect(agents().startsWith(own)).toBe(true);
    expect(agents()).toContain(AGENTS_BLOCK_START);
    expect(backups()).toEqual([]);

    uninstall();

    expect(agents()).toBe(own);
    expect(backups()).toEqual([]);
  });

  it("⑦ v26.169 update 가 블록을 붙인 옛 파일(N2) → 절 모델 · displaced 아님(B3) · 블록 몫 기록 비움 · uninstall 뒤 설치자 절만", () => {
    oldBlockUpdatedByV169(V100_V169);

    run(["claude", "codex"], "update");

    const after = agents();
    expectNoOldHarness(after);
    expect(after).toContain(ANCHOR_START);
    expect(after).not.toContain(AGENTS_BLOCK_START);
    expect(headings(after).at(-1)).toBe("## My Team Rules");
    const l = log();
    expect(
      (l.rootFiles ?? []).filter((f) => f.path === "AGENTS.md"),
      "첫 접촉(displaced)으로 적지 않는다",
    ).toEqual([]);
    expect((l.portions ?? []).filter((p) => p.path === "AGENTS.md")).toEqual([]);
    expect(l.externalFiles?.find((f) => f.path === "AGENTS.md")?.sha256).toBe(hashContent(after));
    expect(backupText()).toEqual([V100_V169]);

    uninstall();

    const left = agents();
    expect(headings(left)).toEqual(["## My Team Rules"]);
    expect(left).toContain("MINE-SECTION");
    expect(left).not.toContain("<!-- uzys-harness:");
  });

  it("⑦′ 설치자 절이 없는 같은 모양 → update 뒤 uninstall 하면 파일이 없고 되살아나지 않는다(백업 1 만 남는다)", () => {
    const bare = V100_V169.replace(`\n${MINE}`, "");
    expect(bare, "픽스처 자기검증 — 설치자 절을 뺐다").not.toContain("MINE-SECTION");
    oldBlockUpdatedByV169(bare);

    run(["claude", "codex"], "update");
    uninstall();

    expect(existsSync(agentsPath())).toBe(false);
    expect(backupText()).toEqual([bare]);
    expect((readInstallLog(projectDir)?.rootFiles ?? []).length).toBe(0);
  });

  it("⑨ v26.153(기록 sha · 꼬리 없음 · 머리 없음) → 떨어뜨릴 것이 없다: 백업 0 · 절은 지금 렌더 그대로 · Project Context 는 이어받는다", () => {
    expect(V153, "픽스처 자기검증 — 이 판에는 머리 블록인용이 없다").not.toContain(OLD_PREAMBLE);
    run(["claude", "codex"]);
    const rendered = agents();
    oldSectionModel(V153);

    const screen = run(["claude", "codex"], "update");

    const after = agents();
    expect(headings(after)).toEqual(headings(rendered));
    // 설치자 소유 절은 디스크에서 이어받는다(이 판의 안 채운 스캐폴드 문구 그대로 — 지금과 같다)
    const context = (t: string): string =>
      t.slice(t.indexOf("## Project Context"), t.indexOf("## Project Rules"));
    expect(context(after).replace(/<!-- uzys-harness:skills[\s\S]*$/, "")).toBe(
      context(V153).replace(/## Skills that apply continuously[\s\S]*$/, ""),
    );
    expect(backups()).toEqual([]);
    expect(screen).not.toContain("written by an older harness version");
  });
});

describe("#774 uninstall — 옛 판 `AGENTS.md`", () => {
  it("④ v26.100 바로 uninstall(기록 없음) · 설치자 절 추가 → 설치자 절만 남는다 · 백업 1 · 배너 없음", () => {
    const withMine = `${V100}\n${MINE}`;
    oldFieldless(withMine);

    const screen = uninstall();

    const left = agents();
    expect(headings(left)).toEqual(["## My Team Rules"]);
    expect(left).toContain("MINE-SECTION");
    expect(left).not.toContain("SCAFFOLD — not filled in yet");
    expectNoOldHarness(left);
    expect(backupText()).toEqual([withMine]);
    expect(screen).toContain(
      "AGENTS.md — removed the harness sections written by an older version — yours stays (saved a copy:",
    );
  });

  it("④′ 설치자 몫이 없으면 파일째 지운다 · 백업 1", () => {
    oldFieldless(V100);

    const screen = uninstall();

    expect(existsSync(agentsPath())).toBe(false);
    expect(backupText()).toEqual([V100]);
    expect(screen).toContain(
      "removed  AGENTS.md (written by an older harness version — saved a copy:",
    );
  });

  it("④″ Project Context 를 채웠으면 그 글은 남고 하네스 배너 · 옛 하네스 몫은 빠진다", () => {
    const filled = V100.replace(
      "## Identity & Purpose\n",
      "## Identity & Purpose\n\nMINE-CONTEXT — 결제 서비스다.\n",
    );
    expect(filled, "픽스처 자기검증").toContain("MINE-CONTEXT");
    oldFieldless(filled);

    uninstall();

    const left = agents();
    expect(left).toContain("MINE-CONTEXT");
    expect(left).not.toContain("SCAFFOLD — not filled in yet");
    expectNoOldHarness(left);
    expect(backupText()).toEqual([filled]);
  });

  it("⑤ v26.140 sha 다름(설치자 절 추가) 바로 uninstall → 설치자 절만 · 백업 1", () => {
    oldSectionModel(V140);
    const withMine = `${V140}\n${MINE}`;
    writeFileSync(agentsPath(), withMine);

    uninstall();

    const left = agents();
    expect(headings(left)).toEqual(["## My Team Rules"]);
    expectNoOldHarness(left);
    expect(backupText()).toEqual([withMine]);
  });

  it("⑤′ v26.169 update 로 꼬리 절이 기록 sha 안에 든 파일 → uninstall 이 꼬리도 걷는다 · 설치자 절은 남는다 · 백업 1", () => {
    oldSectionModel(V140_V169);

    uninstall();

    const left = agents();
    expect(headings(left)).toEqual(["## My Team Rules"]);
    for (const t of TAIL) expect(left, t).not.toContain(t);
    expect(backupText()).toEqual([V140_V169]);
  });

  it("⑦″ v26.169 update 가 블록을 붙인 옛 파일을 바로 uninstall → 설치자 절만 · 블록 · 옛 몫 0 · 백업 1", () => {
    oldBlockUpdatedByV169(V100_V169);

    uninstall();

    const left = agents();
    expect(headings(left)).toEqual(["## My Team Rules"]);
    expect(left).not.toContain("<!-- uzys-harness:");
    expectNoOldHarness(left);
    expect(backupText()).toEqual([V100_V169]);
  });

  it("⑧ claude 단독 설치본의 옛 하네스 모양 `AGENTS.md` → update · uninstall 모두 바이트 그대로 · 백업 0(B2 — 읽지도 않는다)", () => {
    oldFieldless(V100, ["claude"]);

    run(["claude"], "update");
    expect(agents()).toBe(V100);

    const screen = uninstall();

    expect(agents()).toBe(V100);
    expect(backups()).toEqual([]);
    expect(screen).not.toContain("older version");
  });

  it("⑩ `uninstall --cli codex`(opencode 남음) — 기록 없는 옛 파일도 남는 집합으로 다시 렌더한다(N13-7) · 백업 1", () => {
    oldFieldless(`${V100}\n${MINE}`, ["claude", "codex", "opencode"]);

    uninstall({ cli: "codex" });

    const after = agents();
    expectNoOldHarness(after);
    expect(after).toContain(ANCHOR_START);
    expect(after).toContain("MINE-SECTION");
    expect(backups()).toHaveLength(1);
    expect(log().externalFiles?.find((f) => f.path === "AGENTS.md")?.sha256).toBe(
      hashContent(after),
    );
  });
});

/**
 * PR #789 리뷰 HIGH — 하네스 **이름 절**(`## Session Start` · `## Project Rules` 머리말 · 인라인 룰 `## Shell Safety` …) 안에 설치자가 적은
 * 줄. 전에는 이름으로 걷혀 uninstall 이 파일을 지우며 "nothing of yours in it" 이라고 말했다(줄은 백업에만). 이제 이름 절도 옛 렌더
 * 바이트로 가른다 — 다르면 설치자가 고친 절로 남고(사용자 결정 ⓓ), 화면은 남긴 것을 말한다. update 는 그 절을 현행 판으로 바꾸고
 * 1회 백업 + 화면 한 줄로 고친 글의 자리를 말한다(ADR-111 결정 4).
 */
describe("#774 하네스 이름 절 안의 설치자 편집", () => {
  /** 리뷰어의 `mut3.mjs hredit` 와 같은 자리 — 그 절 끝(빈 줄 앞)에 한 줄. */
  function withLineAtEndOf(text: string, heading: string, line: string): string {
    const lines = text.split("\n");
    const at = lines.indexOf(heading);
    expect(at, `픽스처 자기검증 — ${heading}`).toBeGreaterThan(0);
    let j = at + 1;
    while (j < lines.length && !/^## /.test(lines[j] ?? "")) j++;
    j--;
    while ((lines[j] ?? "").trim() === "") j--;
    lines.splice(j + 1, 0, line);
    return lines.join("\n");
  }

  it("⑪ v26.140 `## Session Start` 에 한 줄 → 바로 uninstall: 그 절은 라이브에 남고 나머지 옛 몫은 빠진다 · 백업 1 · 화면이 남긴 절을 말한다", () => {
    oldSectionModel(V140);
    writeFileSync(agentsPath(), V140_SESSEDIT);

    const screen = uninstall();

    const left = agents();
    expect(left).toContain("4. MINE-SESSEDIT: `npm ci` before anything else");
    expect(headings(left)).toEqual(["## Session Start"]);
    expectNoOldHarness(left);
    expect(backupText()).toEqual([V140_SESSEDIT]);
    expect(screen).toContain("yours stays · kept 1 section(s) you edited (Session Start)");
    expect(screen).not.toContain("nothing of yours");
  });

  it("⑫ v26.100(블록 모델 · 기록 없음) `## Project Rules` 머리말에 한 줄 → 바로 uninstall: 머리말 절이 라이브에 남는다 · 옛 앵커 절은 빠진다", () => {
    oldFieldless(V100_RULESINTRO);

    const screen = uninstall();

    const left = agents();
    expect(left).toContain("MINE-RULESINTRO: team rule — never deploy on Friday.");
    expect(headings(left)).toEqual(["## Project Rules"]);
    expectNoOldHarness(left);
    expect(backupText()).toEqual([V100_RULESINTRO]);
    expect(screen).toContain("kept 1 section(s) you edited (Project Rules)");
    expect(screen).not.toContain("nothing of yours");
  });

  it("⑬ v26.150 인라인 룰 `## Shell Safety` 에 한 줄 → 바로 uninstall: 그 룰 절만 라이브에 남는다 · 다른 룰 · 꼬리 · 안내는 빠진다", () => {
    const edited = withLineAtEndOf(V150, "## Shell Safety", "- MINE-HREDIT: never pipe curl to sh");
    oldSectionModel(V150);
    writeFileSync(agentsPath(), edited);

    const screen = uninstall();

    const left = agents();
    expect(left).toContain("- MINE-HREDIT: never pipe curl to sh");
    expect(headings(left)).toEqual(["## Shell Safety"]);
    expect(left).not.toContain("Codex 는 룰 디렉터리가 없고");
    expectNoOldHarness(left);
    expect(backupText()).toEqual([edited]);
    expect(screen).toContain("kept 1 section(s) you edited (Shell Safety)");
  });

  it("⑬′ v26.150 무편집 → 바로 uninstall: 이름 절(머리말 · 안내 · 인라인 룰 · Session Start)까지 옛 렌더 바이트로 알아봐 파일째 지운다 · 백업 1", () => {
    oldSectionModel(V150);

    const screen = uninstall();

    expect(existsSync(agentsPath())).toBe(false);
    expect(backupText()).toEqual([V150]);
    expect(screen).toContain(
      "removed  AGENTS.md (written by an older harness version — saved a copy:",
    );
  });

  it("⑭ update 는 고친 이름 절을 현행 판으로 바꾼다 — 고친 글은 백업 1 에 있고 화면이 그 사실을 말한다 · 2회차 조용", () => {
    oldSectionModel(V140);
    writeFileSync(agentsPath(), V140_SESSEDIT);

    const screen = run(["claude", "codex"], "update");

    const after = agents();
    expect(after).not.toContain("MINE-SESSEDIT");
    expectNoOldHarness(after);
    expect(backupText()).toEqual([V140_SESSEDIT]);
    expect(screen).toContain(
      "1 harness section(s) you had edited (Session Start) now hold the current version — your edit is in the copy AGENTS.md.backup-<time>",
    );

    const again = run(["claude", "codex"], "update");

    expect(agents()).toBe(after);
    expect(backups()).toHaveLength(1);
    expect(again).not.toContain("you had edited");
  });

  it("⑯ `## Project Context` 가 없던 판(v26.83~v26.95) 무편집 → 바로 uninstall: 빈 Project Context 껍데기를 남기지 않고 파일째 지운다 · 백업 1", () => {
    const v95 = fixture("v26.95.0-codex.AGENTS.md");
    expect(v95, "픽스처 자기검증 — 채울 자리가 없던 판").not.toContain("## Project Context");
    oldFieldless(v95);

    const screen = uninstall();

    expect(existsSync(agentsPath())).toBe(false);
    expect(backupText()).toEqual([v95]);
    expect(screen).not.toContain("nothing of yours");
  });

  it('⑮ 첫 접촉 블록을 함께 걷어 파일을 지우면 "nothing of yours" 라고 말하지 않는다 — 블록 안 줄은 지문이 가르지 못한다', () => {
    const noMine = V100_V169.replace(`${MINE}\n`, "");
    expect(noMine, "픽스처 자기검증").not.toContain("MINE-SECTION");
    oldBlockUpdatedByV169(noMine);

    const screen = uninstall();

    expect(existsSync(agentsPath())).toBe(false);
    expect(backupText()).toEqual([noMine]);
    expect(screen).toContain(
      "removed  AGENTS.md (written by an older harness version — saved a copy:",
    );
    expect(screen).not.toContain("nothing of yours");
  });
});

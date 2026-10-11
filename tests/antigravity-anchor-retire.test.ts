/**
 * ADR-103 · #645 · #631 — 옛 Antigravity 앵커(`.agents/rules/uzys-harness.md`) 은퇴와 한 번뿐인 이관.
 *
 * 26.164.0 까지 Antigravity 의 원칙·프로젝트 맥락은 그 파일 하나였다. frontmatter 가 없어 Antigravity 가 버렸고(#631),
 * 통째로 하네스 파일이라 설치자가 채운 FILL 을 update 가 빈 스캐폴드로 되돌렸다(#645). 이 릴리즈부터 Antigravity 도 루트
 * `AGENTS.md` 를 읽는다 — 이미 깐 설치본의 update 한 번이 그 파일을 은퇴시키고 채운 글을 `AGENTS.md` 로 옮긴다.
 *
 * 픽스처는 **26.164.0 이 남긴 모양**이다: 기록에 앵커 sha · `spec.clis` 없음(옛 로그 — antigravity 는 앵커 경로로 유도된다) ·
 * 앵커 본문은 그 판의 렌더(옛 FILL 문구 + 마커 없는 상시 스킬 안내). 독립 검증 BLOCKER-1~3 의 회귀 단언이 여기 있다.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import {
  hashContent,
  type InstallLog,
  installedClis,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import { renderedKeyIds } from "../src/key-ids.js";
import { renderContinuousSkillsNote, renderFillScaffold } from "../src/project-claude-merge.js";
import { stripClaudeFrontmatter } from "../src/rules-port.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const ANCHOR = ".agents/rules/uzys-harness.md";
const NOTE_HEADING = "## Skills that apply continuously";
const FILLED = "Payments batch for the finance team — runs nightly.";

/** 26.164.0 판 스캐폴드의 두 줄 — 이 릴리즈가 바꾸기 전 바이트(테스트 쪽 리터럴 — 구현에서 가져오지 않는다). */
const OLD_BANNER =
  "> **This file (`.agents/rules/uzys-harness.md`) is the harness anchor** — it carries the working principles in full, further down. Only the `## …` sections immediately below are project-specific context for you to fill in.";
const OLD_FILL =
  "Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list";

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "agy-retire-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(cli: CliBase[]): InstallSpec {
  return { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir };
}

function install(cli: CliBase[], mode: "add" | "reinstall" = "add"): InstallReport {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode,
  });
}

function update(): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(["antigravity"]), false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(["antigravity"]),
    mode: "update",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const screen = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { report, screen };
}

const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const backupsOf = (dir: string, name: string): string[] =>
  existsSync(join(projectDir, dir))
    ? readdirSync(join(projectDir, dir)).filter((f) => f.startsWith(`${name}.backup-`))
    : [];

/** 26.164.0 이 렌더하던 옛 앵커 — 옛 배너 · 옛 FILL 문구 · 마커 없는 상시 스킬 안내 · 앵커 본문. */
function legacyAnchor(filled: boolean): string {
  const now = renderFillScaffold("agents-md");
  const newBanner = now.split("\n").find((l) => l.includes("is the harness anchor")) ?? "";
  const at = now.indexOf("Verify against the harness folders this CLI reads");
  const end = now.indexOf(" and list", at) + " and list".length;
  expect(newBanner, "픽스처 자기검증 — 지금 배너의 앵커 줄").not.toBe("");
  expect(at, "픽스처 자기검증 — 지금 FILL 문구").toBeGreaterThan(-1);
  let scaffold = `${now.slice(0, at)}${OLD_FILL}${now.slice(end)}`.replace(newBanner, OLD_BANNER);
  if (filled) {
    scaffold = scaffold.replace(
      "_(not filled yet — what this project is, who it is for, and why it exists)_",
      FILLED,
    );
  }
  const note = renderContinuousSkillsNote(["user-centered-explanation"]);
  const anchorBody = readFileSync(join(HARNESS_ROOT, "templates/CLAUDE.md"), "utf8")
    .replace(/^#\s+.*\r?\n/, "")
    .trim();
  return [
    `# ${basename(projectDir)} — Antigravity Agent Guide`,
    "",
    "## Project Context",
    "",
    `${scaffold}\n\n${note}`,
    "",
    "## Project Rules",
    "",
    anchorBody,
    "",
    "## Protected Files",
    "",
    "- lock 파일은 손으로 고치지 않는다.",
    "",
  ].join("\n");
}

/** 26.164.0 판 룰 파일 — frontmatter 없는 본문(그 판이 기록한 sha 그대로). */
function legacyRule(name: string): string {
  const source = readFileSync(join(HARNESS_ROOT, "templates/rules", `${name}.md`), "utf8");
  return `${stripClaudeFrontmatter(source)}\n`;
}

/**
 * 지금 판으로 깐 뒤 26.164.0 이 남긴 모양으로 되돌린다: `AGENTS.md` 는 (antigravity 단독이면) 없었고, 앵커 · 옛 룰 본문이
 * 기록 sha 와 함께 있고, 로그에 `spec.clis` 가 없다(v26.160.1 이하로 깔고 update 만 해 온 설치본 — BLOCKER-1 의 인구).
 */
function make164(opts: {
  cli: CliBase[];
  filledAnchor: boolean;
  keepAgentsMd?: boolean;
  /** 마지막 install 의 `spec.cli` — 생략하면 `cli`. antigravity 를 빼면 그 CLI 는 앵커 경로로만 유도된다. */
  lastCli?: CliBase[];
}): void {
  install(opts.cli);
  const log = readInstallLog(projectDir) as InstallLog;
  const files = new Map((log.externalFiles ?? []).map((f) => [f.path, f.sha256]));
  if (opts.keepAgentsMd !== true) {
    rmSync(join(projectDir, "AGENTS.md"));
    files.delete("AGENTS.md");
  }
  for (const f of readdirSync(join(projectDir, ".agents/rules"))) {
    const rel = `.agents/rules/${f}`;
    const body = legacyRule(f.replace(/\.md$/, ""));
    writeFileSync(join(projectDir, rel), body);
    files.set(rel, hashContent(body));
  }
  // 기록 sha 는 **안 채운** 앵커 — 설치자가 채웠으면 디스크만 다르다(26.164.0 의 실제 상태)
  files.set(ANCHOR, hashContent(legacyAnchor(false)));
  writeFileSync(join(projectDir, ANCHOR), legacyAnchor(opts.filledAnchor));
  const { clis: _clis, ...oldSpec } = log.spec;
  writeInstallLog(projectDir, {
    ...log,
    spec: { ...oldSpec, cli: opts.lastCli ?? opts.cli },
    externalFiles: [...files].map(([path, sha256]) => ({ path, sha256 })),
  });
  // 픽스처 자기검증 — 옛 로그다: 필드가 없고, antigravity 는 앵커 경로로만 유도된다
  const written = readInstallLog(projectDir) as InstallLog;
  expect(written.spec.clis).toBeUndefined();
  expect(installedClis(written)).toContain("antigravity");
}

/** 리뷰 #735 M-2 — 쓰기 한 번이면 기록 sha = 디스크 바이트다(변환 뒤에 다시 고쳐 쓰면 갈린다). */
const recordMatchesDisk = (rel: string): boolean =>
  (readInstallLog(projectDir)?.externalFiles ?? []).find((f) => f.path === rel)?.sha256 ===
  hashContent(read(rel));

const projectContext = (text: string): string => {
  const start = text.indexOf("## Project Context\n");
  const end = text.indexOf("\n## Project Rules\n");
  return text.slice(start, end);
};

describe("ADR-103 — 26.164.0 Antigravity 설치본의 update 한 번", () => {
  it("채운 앵커 → AGENTS.md 가 생기며 그 글을 받는다 · 앵커는 백업 1건 뒤 은퇴 · 기록에 spec.clis 를 적는다 (B-T4 · BLOCKER-1/3)", () => {
    make164({ cli: ["antigravity"], filledAnchor: true });

    const { screen } = update();

    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(true);
    const agents = read("AGENTS.md");
    expect(projectContext(agents)).toContain(FILLED);
    // 리뷰 #735 — 부분만 채운 앵커의 남은 FILL 안내는 지금 판 문구로 옮겨진다(옛 `.claude/rules/*.md …` 문구가 따라오지 않는다)
    expect(agents).not.toContain("(or this CLI's equivalent)");
    // BLOCKER-3 — 1차 update 직후 기록 sha == 디스크(같은 판 두 번째 update 는 고정점이라 이 결함을 못 문다)
    expect(recordMatchesDisk("AGENTS.md")).toBe(true);
    // 옛 앵커의 마커 없는 안내가 설치자 글로 옮겨 가 두 벌이 되지 않는다(BLOCKER-2)
    expect(agents.split(NOTE_HEADING).length - 1).toBe(1);
    expect(existsSync(join(projectDir, ANCHOR))).toBe(false);
    expect(backupsOf(".agents/rules", "uzys-harness.md")).toHaveLength(1);
    const log = readInstallLog(projectDir) as InstallLog;
    expect((log.externalFiles ?? []).map((f) => f.path)).not.toContain(ANCHOR);
    // BLOCKER-1 — `installedClis()` 가 아니라 **기록 필드 자체**: update 가 옛 로그에 이 필드를 적어야 다음 실행이
    // antigravity 를 잃지 않는다(앵커 경로가 유도 근거였다)
    expect(log.spec.clis).toContain("antigravity");
    // 룰은 frontmatter 판으로 갈아 끼워진다 — 기록 sha 그대로라 백업 없이(#631)
    for (const f of readdirSync(join(projectDir, ".agents/rules")).filter((n) =>
      n.endsWith(".md"),
    )) {
      expect(read(`.agents/rules/${f}`), f).toMatch(/^---\ntrigger: (always_on|glob)\n/);
    }
    expect(screen).toMatch(
      /AGENTS\.md\s+created \(Antigravity\) · Project Context seeded from \.agents\/rules\/uzys-harness\.md/,
    );
    expect(screen).toMatch(
      /\.agents\/rules\/uzys-harness\.md\s+retired — Antigravity reads AGENTS\.md; your Project Context moved there · previous file saved as \.agents\/rules\/uzys-harness\.md\.backup-/,
    );

    // BLOCKER-3 음성 대조 — 이어서 update 를 한 번 더 해도 AGENTS.md 백업 0 · 은퇴 줄 없음 · 파일 그대로
    const second = update();
    expect(backupsOf(".", "AGENTS.md")).toEqual([]);
    expect(second.screen).not.toContain("retired");
    expect(read("AGENTS.md")).toBe(agents);
    expect(installedClis(readInstallLog(projectDir))).toContain("antigravity");
  });

  it("안 채운 앵커(옛 FILL 문구 + 마커 없는 안내) → 옮길 것 없음 · 백업 0 · 빈 스캐폴드의 AGENTS.md (B-T5 · BLOCKER-2)", () => {
    make164({ cli: ["antigravity"], filledAnchor: false });

    const { screen } = update();

    expect(existsSync(join(projectDir, ANCHOR))).toBe(false);
    expect(backupsOf(".agents/rules", "uzys-harness.md")).toEqual([]);
    const agents = read("AGENTS.md");
    // 옛 스캐폴드가 "설치자 글" 로 옮겨 오지 않았다 — 지금 판 스캐폴드다
    expect(agents).not.toContain("(or this CLI's equivalent)");
    expect(agents).toContain("Verify against the harness folders this CLI reads");
    expect(agents.split(NOTE_HEADING).length - 1).toBe(1);
    expect((readInstallLog(projectDir) as InstallLog).spec.clis).toContain("antigravity");
    expect(screen).toMatch(
      /\.agents\/rules\/uzys-harness\.md\s+retired — Antigravity reads AGENTS\.md\s*$/m,
    );
    expect(screen).not.toContain("seeded from");
    expect(screen).not.toContain("moved there");

    const second = update();
    expect(backupsOf(".", "AGENTS.md")).toEqual([]);
    expect(second.screen).not.toContain("retired");
  });

  it("codex+antigravity · AGENTS.md 도 채웠다 → 두 글을 합치지 않는다 · 앵커 글은 백업에 · 화면이 경로를 말한다 (B-T6 · ⓒ)", () => {
    make164({ cli: ["codex", "antigravity"], filledAnchor: true, keepAgentsMd: true });
    const filledAgents = read("AGENTS.md").replace(
      "## Project Context\n",
      "## Project Context\n\nAGENTS-OWN-LINE — this project is a CLI.\n",
    );
    writeFileSync(join(projectDir, "AGENTS.md"), filledAgents);

    const { screen } = update();

    const agents = read("AGENTS.md");
    expect(agents).toContain("AGENTS-OWN-LINE");
    expect(agents).not.toContain(FILLED);
    expect(existsSync(join(projectDir, ANCHOR))).toBe(false);
    const anchorBackups = backupsOf(".agents/rules", "uzys-harness.md");
    expect(anchorBackups).toHaveLength(1);
    expect(read(`.agents/rules/${anchorBackups[0]}`)).toContain(FILLED);
    expect(screen).toMatch(
      /\.agents\/rules\/uzys-harness\.md\s+retired — AGENTS\.md already has its own Project Context, so nothing was merged; your filled text is in \.agents\/rules\/uzys-harness\.md\.backup-/,
    );

    const agentsBackups = backupsOf(".", "AGENTS.md");
    const second = update();
    expect(backupsOf(".", "AGENTS.md")).toEqual(agentsBackups);
    expect(second.screen).not.toContain("retired");
    expect(read("AGENTS.md")).toBe(agents);
  });

  it("기록에 없는 같은 이름의 파일은 설치자 것이다 — 그대로 두고 말하지 않는다 (B-T7)", () => {
    install(["antigravity"]);
    const mine = "# my own antigravity rule\n\nalways reply in Korean.\n";
    writeFileSync(join(projectDir, ANCHOR), mine);

    const { screen } = update();

    expect(read(ANCHOR)).toBe(mine);
    expect(backupsOf(".agents/rules", "uzys-harness.md")).toEqual([]);
    expect(screen).not.toContain("uzys-harness.md");
  });

  it("codex+antigravity · 앵커만 채웠다 → 이미 있는 AGENTS.md 의 빈 절이 그 글을 받는다 · 기록 sha = 디스크 (ⓑ · BLOCKER-3)", () => {
    make164({ cli: ["codex", "antigravity"], filledAnchor: true, keepAgentsMd: true });

    update();

    expect(projectContext(read("AGENTS.md"))).toContain(FILLED);
    expect(recordMatchesDisk("AGENTS.md")).toBe(true);
    expect(backupsOf(".", "AGENTS.md")).toEqual([]);
    expect(backupsOf(".agents/rules", "uzys-harness.md")).toHaveLength(1);
  });

  // 리뷰 #735 M-1 — 마지막 install 의 spec.cli 에 antigravity 가 없는 옛 로그(antigravity 는 앵커 경로로만 유도된다)에서
  //   install 이 앵커를 은퇴시키면 그 install 이 spec.clis 를 적어야 다음 실행이 antigravity 를 잃지 않는다.
  it("install 경로: 앵커로만 유도되던 antigravity 가 은퇴 뒤에도 기록에 남는다 (BLOCKER-1 · install)", () => {
    make164({
      cli: ["codex", "antigravity"],
      lastCli: ["codex"],
      filledAnchor: false,
      keepAgentsMd: true,
    });

    install(["claude"]);

    const log = readInstallLog(projectDir) as InstallLog;
    expect((log.externalFiles ?? []).map((f) => f.path)).not.toContain(ANCHOR);
    expect(log.spec.clis).toContain("antigravity");
    update();
    expect(read("AGENTS.md").split("\n")[0]).toContain("Antigravity");
  });

  // 리뷰 #735 BLOCKER — 26.164.0 판 codex 설치본에서 설치자가 인라인 룰 **바로 뒤**에 적은 절은 update 2회 뒤에도 남는다.
  it("26.164.0 판 AGENTS.md 의 인라인 룰 뒤 설치자 절 → update 2회 뒤에도 남는다 · 이어진 update 백업 0", () => {
    make164({ cli: ["codex", "antigravity"], filledAnchor: false, keepAgentsMd: true });
    const TEAM = "## Team rules\n\nTEAM-RULES-TEXT — 리뷰는 두 명이 본다.";
    // 26.164.0 판 제목 — 그 판이 쓴 바이트(기록 sha)는 설치자 절이 없는 판이다
    const harnessWrote = read("AGENTS.md").replace(
      /^# .*\n/,
      `# ${basename(projectDir)} — Codex Agent Guide\n`,
    );
    const log = readInstallLog(projectDir) as InstallLog;
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: (log.externalFiles ?? []).map((f) =>
        f.path === "AGENTS.md" ? { ...f, sha256: hashContent(harnessWrote) } : f,
      ),
    });
    expect(harnessWrote).toContain("\n## Session Start\n"); // 대조군 — 끼울 자리가 있다
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      harnessWrote.replace("\n## Session Start\n", `\n${TEAM}\n\n## Session Start\n`),
    );

    update();
    expect(read("AGENTS.md")).toContain(TEAM);
    const after = read("AGENTS.md");
    const backups = backupsOf(".", "AGENTS.md");
    update();
    expect(read("AGENTS.md")).toBe(after);
    expect(backupsOf(".", "AGENTS.md")).toEqual(backups);
  });

  it("install(--reinstall 포함)도 같은 함수로 은퇴시키고 spec.clis 를 이어 적는다", () => {
    make164({ cli: ["antigravity"], filledAnchor: true });

    const report = install(["claude"], "reinstall");

    expect(existsSync(join(projectDir, ANCHOR))).toBe(false);
    expect(report.anchorRetired?.action).toBe("removed");
    expect(projectContext(read("AGENTS.md"))).toContain(FILLED);
    const log = readInstallLog(projectDir) as InstallLog;
    expect((log.externalFiles ?? []).map((f) => f.path)).not.toContain(ANCHOR);
    expect(log.spec.clis).toEqual(["claude", "antigravity"]);
  });
});

describe("ADR-103 — 새 설치", () => {
  it("install --cli antigravity 단독: AGENTS.md 가 생기고 제목은 Antigravity · 인라인 룰 절 없음 · 옛 앵커 없음 (C-T8)", () => {
    const report = install(["antigravity"]);

    const agents = read("AGENTS.md");
    expect(agents.split("\n")[0]).toContain("Agent Guide (Antigravity)");
    expect(agents).not.toContain("## Harness Rules");
    expect(agents).not.toContain("## Session Start");
    // 원칙(앵커 본문)과 FILL 스캐폴드는 이 파일에 있다 — Antigravity 가 frontmatter 없이 always_on 으로 읽는 자리
    expect(agents).toContain("<!-- uzys-harness:anchor:start -->");
    expect(agents).toContain("<!-- FILL:identity");
    expect(existsSync(join(projectDir, ANCHOR))).toBe(false);
    expect(report.anchorRetired ?? null).toBeNull();
    expect((readInstallLog(projectDir)?.externalFiles ?? []).map((f) => f.path)).toContain(
      "AGENTS.md",
    );
  });

  // NOTE-6 — Antigravity 단독도 첫 접촉 블록 모델 `AGENTS.md` 를 받으므로 그 블록의 키 id 를 `--without` 으로 받는다
  it("Antigravity 단독 설치의 렌더 키 id 에 agents-md:agents 가 있다", () => {
    const ids = renderedKeyIds(
      HARNESS_ROOT,
      { tracks: ["tooling"], forceInclude: [], previous: null },
      ["antigravity"],
    );
    expect(ids.has("agents-md:agents")).toBe(true);
  });
});

import { CONTINUOUS_SKILLS } from "./external-assets.js";

/**
 * Project-context scaffold for the delivered CLAUDE.md / AGENTS.md.
 *
 * The installer is a pure Node CLI and CANNOT run an LLM, so it cannot fill a
 * project-specific context file at install time. Shipping generic per-track prose
 * instead produced "meaningless" files (a literal `# [Project Name]` title, a Bash
 * stack advertised to every project, phantom rule names). This module ships an
 * honest fill-in SCAFFOLD instead: each section carries an embedded `<!-- FILL: -->`
 * instruction the user runs in their own coding agent post-install (or by hand).
 * The same scaffold body feeds BOTH the Claude Code root CLAUDE.md and the
 * `{PROJECT_CONTEXT}` block of every AGENTS.md — one source, byte-identical across
 * all 4 CLIs, with no disk read-back coupling.
 */

/**
 * 하네스 앵커의 **설치 파일명** (프로젝트 루트). manifest target · 루트 CLAUDE.md 의 `@import`
 * 줄 · update 갱신 · uninstall 회수가 전부 이 상수를 쓴다.
 *
 * 이름이 여러 곳에 리터럴로 살면 한 곳만 바뀌었을 때 조용히 갈리고, 그때 생기는 것은 아무도
 * 갱신·회수하지 않는 고아 파일이다 (`no-false-ship.md` §Drift 구조 차단).
 */
export const HARNESS_ANCHOR_FILE = "CLAUDE-uzys-harness.md";

/** 루트 CLAUDE.md 가 앵커를 끌어오는 Claude Code memory import 줄. */
export const HARNESS_IMPORT_LINE = `@${HARNESS_ANCHOR_FILE}`;

/**
 * 관리 마커 — **하네스가 넣은 줄과 사용자가 쓴 줄을 가르는 유일한 표식**이다.
 * 재실행 시 중복 추가를 막고(idempotent), uninstall 이 사용자 본문을 건드리지 않고
 * 이 블록만 도려낼 수 있게 한다.
 */
const IMPORT_MARKER_START = "<!-- uzys-harness:import:start -->";
const IMPORT_MARKER_END = "<!-- uzys-harness:import:end -->";

/**
 * 안내 절의 헤딩. **마커 없는 옛 `AGENTS.md`** 에서 이 조각을 찾아내는 단서라
 * (`agents-md-merge.ts`) 리터럴을 양쪽에 두지 않는다 — 갈리면 조각이 두 벌 쌓인다.
 */
export const CONTINUOUS_SKILLS_HEADING = "## Skills that apply continuously";

/**
 * ADR-085 — 상시 적용 스킬 안내. **실제로 깔린 것만** 적는다.
 *
 * 배포 앵커가 전역 6원칙과 바이트 동일해지면서 앵커 꼬리절(`Skills that apply continuously`)이
 * 사라졌다. 그 절이 하던 일 — 프롬프트 모양으로는 절대 발화하지 않는 스킬을 매 응답에 열게
 * 하는 것 — 을 설치기가 프로젝트 맥락 블록에서 한다. 어느 스킬이 그런지는 카탈로그
 * (`CONTINUOUS_SKILLS`)가 SSOT 이고, 여기는 선택된 것만 골라 줄을 만든다.
 *
 * @returns 안내 블록. 해당 스킬이 하나도 선택되지 않았으면 빈 문자열 — 한 줄도 상주시키지 않는다.
 */
export function renderContinuousSkillsNote(selectedInternalSkills: ReadonlyArray<string>): string {
  const lines = CONTINUOUS_SKILLS.filter((s) => selectedInternalSkills.includes(s.id)).map(
    (s) => `- \`${s.id}\` — ${s.whenToApply}.`,
  );
  if (lines.length === 0) return "";
  return [
    CONTINUOUS_SKILLS_HEADING,
    "",
    "These installed skills apply to every response or delegation; no prompt ever looks like their job, so open them from this list:",
    "",
    ...lines,
  ].join("\n");
}

/** 스캐폴드 뒤에 상시 스킬 안내를 붙인다 — 안내가 비면 스캐폴드를 그대로 돌려준다. */
export function withContinuousSkillsNote(
  scaffold: string,
  selectedInternalSkills: ReadonlyArray<string>,
): string {
  const note = renderContinuousSkillsNote(selectedInternalSkills);
  return note ? `${scaffold}\n\n${note}` : scaffold;
}

/** 관리 블록 본문 — import 한 줄 + (있으면) 상시 스킬 안내. 블록 안은 하네스 소유다. */
function importBlock(continuousSkills: ReadonlyArray<string>): string {
  const note = renderContinuousSkillsNote(continuousSkills);
  const body = note ? `${HARNESS_IMPORT_LINE}\n\n${note}` : HARNESS_IMPORT_LINE;
  return `${IMPORT_MARKER_START}\n${body}\n${IMPORT_MARKER_END}`;
}

/**
 * The MUST-HAVE project-context sections, from a harness perspective: the context
 * an agent needs to work on ANY project with few round-trips. Order is intentional
 * (identity → stack → architecture → assets → boundaries → verify).
 */
export const FILL_SECTIONS = [
  "identity",
  "stack",
  "architecture",
  "installed-assets",
  "boundaries",
  "verify",
] as const;
export type FillSection = (typeof FILL_SECTIONS)[number];

interface FillSpec {
  /** Rendered `## <title>` header. */
  title: string;
  /** Body of the `<!-- FILL:<id> — … -->` comment: what to inspect and write. */
  prompt: string;
  /** Honest `_(not filled yet — …)_` line so an unfilled section never states a false fact. */
  placeholder: string;
}

const FILL_SPECS: Record<FillSection, FillSpec> = {
  identity: {
    title: "Identity & Purpose",
    prompt:
      'Replace the H1 title above with this project\'s real name, then state in 1-2 plain sentences what it does, who uses it, and why it exists. Sources: README.md, the package.json / pyproject.toml "description", docs/. Do NOT describe the harness itself. Delete this comment when done.',
    placeholder: "what this project is, who it is for, and why it exists",
  },
  stack: {
    title: "Stack & Commands",
    prompt:
      "Replace the list below with this project's REAL stack. Inspect package.json / pyproject.toml / go.mod / Cargo.toml / Gemfile + lockfiles and any Makefile/justfile/package scripts. List the language(s)+versions, framework(s), package manager, and the exact install/build/test/run commands. Verify each command exists before writing it — never guess. Delete lines that do not apply, then delete this comment.",
    placeholder: "languages, runtimes, package manager, and the install/build/test/run commands",
  },
  architecture: {
    title: "Architecture & Layout",
    prompt:
      "Map this repository. List each top-level source directory and what it holds, the entry point(s), the 3-5 files a newcomer reads first, and how data/requests flow between the main layers. View the real tree (e.g. `git ls-files | sed 's#/.*##' | sort -u`) — do not assume a framework's conventional layout. Flag any generated/vendored directories that must never be hand-edited. If this is a single small module, say so in one line. Delete this comment when done.",
    placeholder: "where things live, the entry points, and how data flows between layers",
  },
  "installed-assets": {
    title: "Installed Harness Assets",
    prompt:
      "List the harness assets installed in this project (rules / skills / agents / commands) and add one line each on when to reach for it here. Verify against the harness folders this CLI reads (.claude/rules/ · .claude/skills/ · .claude/agents/ for Claude Code; AGENTS.md § Harness Rules · .agents/skills/ for Codex and OpenCode; .agents/rules/ · .agents/skills/ for Antigravity) and list ONLY assets whose file exists on disk — do not invent any. Do NOT restate the harness's working principles (they live in this project's harness anchor and rules layer) — cross-reference them instead. Delete this comment when done.",
    placeholder: "the installed rules/skills/agents/commands and when to use each",
  },
  boundaries: {
    title: "Boundaries — Always / Ask First / Never",
    prompt:
      'Fill the Always / Ask First / Never lists with this repo\'s real red lines. Read the CI config, CODEOWNERS, .gitignore, and release/deploy scripts. Never must include secrets, generated files, force-push, and direct commits to the default branch, plus any repo-specific "do not touch" directories. Every entry must be specific and enforceable here. Delete this comment when done.',
    placeholder: "what to always do, ask before doing, and never do in this repo",
  },
  verify: {
    title: "Verification Gate",
    prompt:
      'State the single command (or short sequence) that PROVES a change is safe here — the test/lint/typecheck/build gate you run before committing — plus the coverage/CI threshold and what "done" means. Sources: package scripts, CI workflow files, CONTRIBUTING. An agent must be able to self-verify without guessing. Delete this comment when done.',
    placeholder: "the single command that proves a change is safe, and the done bar",
  },
};

/**
 * Which file the scaffold is being rendered INTO. It decides one line of the banner: whether the
 * reader is holding the harness anchor or a file that points at one.
 *
 * WHY this is a parameter (#305): the banner used to be one constant shipped byte-identically into
 * all four surfaces, and its third line was written for `CLAUDE.md`. Rendered into `AGENTS.md` it
 * asserted two things that are false there — "imported from this file" (measured: 0 import lines)
 * and "this file is project-specific context only" (measured: 7 principle sections). A reader of
 * AGENTS.md was told the principles live somewhere else, so they went looking for a file that a
 * Codex-only install does not even have.
 */
export type ScaffoldSurface = "claude" | "agents-md";

/**
 * The anchor sentence, true for the file it is rendered into.
 *
 * There is no import to point at outside Claude Code: `AGENTS.md` has no include directive —
 * agentsmd/agents.md#11 and openai/codex#6038 · #17401 are all still open feature requests
 * (measured 2026-08-29). So every non-Claude surface carries the principles inline and IS the
 * anchor; saying otherwise sends the reader after a file that may not exist.
 */
function anchorLine(surface: ScaffoldSurface): string {
  if (surface === "claude") {
    return `> The working principles live in this project's harness anchor \`${HARNESS_ANCHOR_FILE}\`, imported at the bottom of this file. Everything above that import is **project-specific context only**.`;
  }
  return `> **This file (\`AGENTS.md\`) is the harness anchor** — it carries the working principles in full, further down. Only the \`## …\` sections immediately below are project-specific context for you to fill in.`;
}

/** Visible (rendered-markdown) banner — HTML FILL comments are invisible in a preview, so this
 * blockquote is what stops the scaffold from reading as verified project fact for a human. */
export function scaffoldBanner(surface: ScaffoldSurface): string {
  return [
    "> ⚙️ **SCAFFOLD — not filled in yet.** The sections below are a fill-in template for THIS project, not verified facts.",
    "> To fill: open this file and paste each `<!-- FILL: … -->` comment's instruction into your coding agent (e.g. Claude Code) — it will inspect the real repo and write the section. You can also fill them by hand; the comments are the instructions.",
    anchorLine(surface),
  ].join("\n");
}

/**
 * 하네스가 루트 `CLAUDE.md` · `AGENTS.md` 에 쓴 배너 줄 — 현행 판 + 옛 판 문구(태그 v26.96.0~v26.174.0 의
 * `project-claude-merge.ts` 실측, 2026-10-19). 옛 판 문구는 그 판이 쓴 바이트 그대로 고정한다(상수가 바뀌어도 옛 디스크는 그대로다).
 *
 * #837 · #862 — 배너는 **이 줄과 똑같은 줄만** 하네스 것이다. 인용 블록째 하네스 것으로 보면 배너 바로 아래 설치자가 이어 적은
 * 인용 줄까지 하네스 몫이 된다 — uninstall 의 배너 걷기(#837)도 "채웠는가" 판정(#862)도 이 집합 하나로 가른다.
 */
export const SCAFFOLD_BANNER_LINES: ReadonlySet<string> = new Set([
  ...scaffoldBanner("claude").split("\n"),
  ...scaffoldBanner("agents-md").split("\n"),
  // v26.96.0~v26.139.0 — 네 자리에 같은 배너
  "> The universal harness rules (Rule 1–12) live in the separate rules layer. This file is **project-specific context only**.",
  // v26.140.0
  "> The working principles live in this project's harness anchor — `.claude/CLAUDE.md` (Claude Code), `AGENTS.md` (Codex/OpenCode), or `.agents/rules/uzys-harness.md` (Antigravity). This file is **project-specific context only**.",
  // v26.141.0~v26.148.1
  "> The working principles live in this project's harness anchor — `CLAUDE-uzys-harness.md` (Claude Code, imported from this file), `AGENTS.md` (Codex/OpenCode), or `.agents/rules/uzys-harness.md` (Antigravity). This file is **project-specific context only**.",
]);

/**
 * Shared project-context scaffold body: the visible banner followed by the six MUST-HAVE
 * sections, each a `## Title` + a self-contained `<!-- FILL:id — … -->` comment + an honest
 * `_(not filled yet — …)_` placeholder. Pure and track-agnostic, so the Claude Code CLAUDE.md
 * and every AGENTS.md `{PROJECT_CONTEXT}` block get byte-identical prompts from one source.
 */
export function renderFillScaffold(surface: ScaffoldSurface = "claude"): string {
  const blocks = FILL_SECTIONS.map((id) => {
    const spec = FILL_SPECS[id];
    return `## ${spec.title}\n\n<!-- FILL:${id} — ${spec.prompt} -->\n\n_(not filled yet — ${spec.placeholder})_`;
  });
  return `${scaffoldBanner(surface)}\n\n${blocks.join("\n\n")}`;
}

/** 스캐폴드 배너를 알아보는 표식. 배너 문구가 바뀌어도 이 문장은 배너의 정체다. */
export const SCAFFOLD_MARK = "SCAFFOLD — not filled in yet";
/** 루트 `CLAUDE.md` 머리의 설치 메타 한 줄 (`mergeProjectClaude`). */
const TRACK_NOTE_MARK = "Active track(s):";

/**
 * **하네스가 쓴 인용문 블록만** 뗀다 — 스캐폴드 배너와 트랙 안내.
 *
 * 인용문 run 을 통째로 보고 그 안에 하네스 표식이 있을 때만 뗀다. 설치자가 적어 둔 인용문
 * (프로젝트 한 줄 소개 같은 것)은 표식이 없으니 그대로 남는다. 앞머리만 보지 않고 전체를 훑는다 —
 * 설치자가 H1 바로 뒤에 자기 인용문을 끼우면 하네스 앞머리가 그 아래로 밀린다(#305).
 */
export function dropHarnessQuoteBlocks(lines: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!(lines[i] ?? "").trim().startsWith(">")) {
      out.push(lines[i] ?? "");
      i += 1;
      continue;
    }
    let end = i;
    while (end < lines.length && (lines[end] ?? "").trim().startsWith(">")) end++;
    const run = lines.slice(i, end);
    const text = run.join("\n");
    if (!text.includes(SCAFFOLD_MARK) && !text.includes(TRACK_NOTE_MARK)) out.push(...run);
    i = end;
  }
  return out;
}

/**
 * 상시 스킬 안내 조각(ADR-085)이 끝나는 줄 — 헤딩 다음부터 빈 줄 · 소개 문장 · `- \`id\` — …` 항목만 조각으로
 * 친다. 그 밖의 첫 줄이 설치자 텍스트의 시작이다(#503 독립 리뷰 B1 — 안내 *뒤*에 적은 설치자 문단을 조각으로
 * 삼키지 않는다). 마커 없는 옛 판에서 조각을 찾는 단서도 이것 하나다.
 */
export function continuousNoteEnd(lines: ReadonlyArray<string>, headingAt: number): number {
  let i = headingAt + 1;
  while (i < lines.length) {
    const l = (lines[i] ?? "").replace(/\r$/, "").trim();
    const isNote = l === "" || l.startsWith("- `") || l.startsWith("These installed skills apply");
    if (!isNote) break;
    i++;
  }
  return i;
}

/** 마커 유무와 무관하게 상시 스킬 안내 조각을 뗀다 — 옛 Antigravity 앵커는 마커를 걷어 썼다. */
export function dropContinuousSkillsNote(lines: ReadonlyArray<string>): string[] {
  const at = lines.findIndex((l) => l.replace(/\r$/, "").trim() === CONTINUOUS_SKILLS_HEADING);
  if (at === -1) return [...lines];
  return [...lines.slice(0, at), ...lines.slice(continuousNoteEnd(lines, at))];
}

/** `<!-- FILL:… -->` 주석 줄(여러 줄이면 `-->` 까지)을 뗀다. */
function dropFillComments(lines: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  let inFill = false;
  for (const line of lines) {
    if (!inFill && line.trim().startsWith("<!-- FILL:")) inFill = true;
    if (inFill) {
      if (line.includes("-->")) inFill = false;
      continue;
    }
    out.push(line);
  }
  return out;
}

/**
 * #862 — 하네스가 쓴 인용 **줄**만 뗀다: 배너 줄(`SCAFFOLD_BANNER_LINES` 와 똑같은 줄) · 트랙 안내 줄(v26.140.0 이하 루트 `CLAUDE.md`
 * 머리 — 트랙 이름이 들어 있어 머리말로 알아본다). 인용 블록째 떼면 배너 바로 아래 이어 적은 설치자 인용 줄이 "안 채움" 으로 읽혀
 * uninstall 이 그 줄이 든 `AGENTS.md` 를 파일째 지웠다.
 */
function dropHarnessBannerLines(lines: ReadonlyArray<string>): string[] {
  return lines.filter((line) => {
    const bare = line.replace(/\r$/, "");
    return !SCAFFOLD_BANNER_LINES.has(bare) && !bare.startsWith(`> ${TRACK_NOTE_MARK}`);
  });
}

/** 비교용 — 하네스가 쓴 줄(배너 · 트랙 안내 · FILL 주석 · 상시 스킬 안내)과 빈 줄 · 줄 끝 공백을 뺀 나머지. */
function scaffoldComparable(lines: ReadonlyArray<string>): string[] {
  return dropFillComments(dropContinuousSkillsNote(dropHarnessBannerLines(lines)))
    .map((l) => l.replace(/\r$/, "").trimEnd())
    .filter((l) => l.trim() !== "");
}

/**
 * 프로젝트 맥락 본문이 **손대지 않은 스캐폴드**인가 — 설치자가 채운 것이 없는가 (v26.165.0 독립 검증 BLOCKER-2).
 *
 * 하네스가 쓴 줄을 **양쪽(디스크 본문 · 기준 스캐폴드)에서 뗀 뒤** 비교한다. 바이트 비교로 두면 FILL 프롬프트
 * 문구를 고친 릴리즈가 옛 판으로 깐 모든 안 채운 스캐폴드를 "채웠다" 로 읽고, 옛 Antigravity 앵커의 마커 없는
 * 상시 스킬 안내가 설치자 글로 읽힌다. 남는 비교 대상은 절 제목과 `_(not filled yet — …)_` 자리표시자다 —
 * 설치자가 "Delete this comment when done" 대로 주석만 지운 상태도 같은 뜻이라 "안 채움" 이다.
 *
 * 앵커 씨 뿌리기(`anchor-seed.ts`) · uninstall 의 `AGENTS.md` 걷기 · 옛 Antigravity 앵커 은퇴가 이 함수 하나를
 * 쓴다 — 판정이 갈리면 "옮겼다/채웠다" 가 서로 다른 답을 낸다.
 */
export function isUnfilledScaffold(body: ReadonlyArray<string>): boolean {
  const pristine = scaffoldComparable(renderFillScaffold("agents-md").split("\n"));
  return scaffoldComparable(body).join("\n") === pristine.join("\n");
}

export interface MergeOptions {
  /** Project directory basename → the H1 title (fixes the shipped `# [Project Name]` literal). */
  projectName: string;
  /**
   * ADR-085 — 이 설치가 깐 번들 스킬 id. 관리 블록 안의 상시 스킬 안내는 여기서 고른다.
   * 생략 = 안내 없음(레거시 호출부·테스트). update 는 `.claude/skills/<id>` 존재로 채운다.
   */
  continuousSkills?: ReadonlyArray<string>;
  /**
   * #528 — 파일을 **새로 만들 때** 프로젝트 맥락 자리에 넣을 본문. 생략 = 빈 스캐폴드.
   *
   * CLI 를 더해 앵커가 새로 태어날 때 다른 앵커의 설치자 절을 옮겨 심는 자리다(`anchor-seed.ts`).
   * 이미 있는 파일에는 쓰이지 않는다 — 그쪽은 본문이 설치자 소유고 우리는 마커 블록만 책임진다.
   */
  projectContext?: string;
}

/**
 * Build the project-root CLAUDE.md: a real H1 project name + the shared fill scaffold. The
 * scaffold is track-agnostic — the installed-assets section is filled from real files at fill time.
 * 트랙 안내 줄(`> Active track(s):`)은 쓰지 않는다(#833) — 이 파일은 설치자 것이라 트랙을 더하거나
 * 빼도 갱신할 수 없고, 낡은 안내를 매 세션 읽히게 된다. 트랙의 SSOT 는 설치 기록이다(`list`).
 */
export function mergeProjectClaude(opts: MergeOptions): string {
  return `# ${opts.projectName}\n\n${opts.projectContext ?? renderFillScaffold()}\n`;
}

/**
 * 루트 `CLAUDE.md` 에 하네스 앵커 import 를 **비파괴로** 얹는다 (P5 · ADR-060).
 *
 * v26.140.0 까지 설치는 이 파일을 `mergeProjectClaude()` 결과로 **통째 덮어썼다** — 백업은
 * 남겼지만, 사용자가 채워 넣은 프로젝트 맥락이 매 재설치마다 스캐폴드로 되돌아갔다. 하네스
 * 내용은 `HARNESS_ANCHOR_FILE` 로 따로 나가므로, 루트 CLAUDE.md 에는 그것을 끌어오는 한 줄만
 * 있으면 된다. 그래서 소유가 갈린다: 앵커 파일 = 하네스 소유(갱신·회수 가능), 루트 CLAUDE.md
 * = 사용자 소유(우리는 마커 블록만 책임진다).
 *
 * @param existing 디스크의 현재 내용. 파일이 없으면 `null`.
 * @returns 기록할 내용. 이미 import 가 있으면 **입력과 바이트 동일**(= 쓰지 않아도 된다).
 */
export function upsertHarnessImport(existing: string | null, opts: MergeOptions): string {
  const block = importBlock(opts.continuousSkills ?? []);
  if (existing === null) {
    return `${mergeProjectClaude(opts)}\n${block}\n`;
  }
  // ADR-085 — 마커 블록이 있으면 **그 안만** 현행으로 바꾼다. 블록 안은 하네스 소유라 사용자
  // 편집을 덮는 것이 아니고, 스킬을 더 깔거나 뺐을 때 안내가 따라와야 한다. 내용이 같으면
  // 입력을 그대로 돌려준다(= 파일을 만지지 않는다).
  const start = existing.indexOf(IMPORT_MARKER_START);
  if (start !== -1) {
    const endAt = existing.indexOf(IMPORT_MARKER_END, start);
    if (endAt === -1) return existing; // 깨진 블록 — 우리가 판정할 수 없다. 손대지 않는다.
    const current = existing.slice(start, endAt + IMPORT_MARKER_END.length);
    // 문자열 replace 는 치환문의 `$` 를 패턴으로 읽는다(리뷰 N-2) — slice 결합으로 그대로 넣는다.
    if (current === block) return existing;
    return `${existing.slice(0, start)}${block}${existing.slice(endAt + IMPORT_MARKER_END.length)}`;
  }
  if (hasHarnessImport(existing)) {
    // 사용자가 손으로 적은 import 줄 — 파일 전체가 사용자 소유라 블록을 얹지 않는다. 그때는
    // 상시 스킬 안내도 못 넣는다(관리 자리가 없다).
    return existing;
  }
  const body = existing.endsWith("\n") ? existing : `${existing}\n`;
  return `${body}\n${block}\n`;
}

/**
 * 마커 블록만 도려낸다 — uninstall 이 사용자 본문을 지우지 않고 하네스 몫만 회수하는 경로.
 *
 * 블록 앞뒤로 우리가 넣었던 빈 줄까지 되돌리므로, 설치 전 내용이 그대로였다면 결과는
 * **설치 전과 바이트 동일**해진다.
 *
 * @returns 회수 후 내용. 마커가 없으면 `null` (= 우리가 건드린 적 없다 → 파일을 만지지 않는다).
 */
export function stripHarnessImport(text: string): string | null {
  // #628 — 마커가 한쪽이라도 있으면 우리가 넣은 블록이 손상된 것이다 — 정리 대상.
  // 양쪽 다 없는 파일만 "우리가 건드린 적 없다"(기존 계약: 건드리지 않는다).
  if (!text.includes(IMPORT_MARKER_START) && !text.includes(IMPORT_MARKER_END)) return null;
  const endsWithNewline = text.endsWith("\n");
  const out: string[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.includes(IMPORT_MARKER_START)) {
      // 블록 끝까지 통째로 — 끝 마커가 없으면(끊어진 블록) 시작 줄만 걷고 아래 스캔이
      // 남은 import 줄·고아 end 마커를 정리한다(#628: 앵커는 지워지므로 참조가 남으면 안 된다).
      let j = i;
      while (j < lines.length && !(lines[j] ?? "").includes(IMPORT_MARKER_END)) j++;
      i = j < lines.length ? j + 1 : i + 1;
      // #620 — 설치가 블록 **앞에** 넣은 빈 줄 하나만 되돌린다. 사용자의 원래 빈 줄을
      // 지우지 않는다(이전 구현은 \n+ 를 통째로 접어 인접 빈 줄을 흡수했다).
      if (out.length > 0 && out[out.length - 1] === "") out.pop();
      continue;
    }
    if (line.includes(IMPORT_MARKER_END) || line.trim() === HARNESS_IMPORT_LINE) {
      // 고아 end 마커 · 마커 밖의 중복 import 줄(#628 복제 블록의 잔여)
      i++;
      continue;
    }
    out.push(line);
    i++;
  }
  // #620 — 파일 끝 개행 상태를 보존한다(강제로 붙이거나 떼지 않는다).
  let result = out.join("\n");
  if (endsWithNewline && result !== "" && !result.endsWith("\n")) result += "\n";
  if (!endsWithNewline && result.endsWith("\n")) result = result.slice(0, -1);
  return result === text ? null : result;
}

/**
 * import 가 이미 사는가 — 마커 블록이거나, 사용자가 손으로 적은 실제 import 줄이거나.
 *
 * **코드펜스 안은 세지 않는다.** Claude Code 는 펜스 안의 `@path` 를 import 로 읽지 않으므로,
 * 문서에서 이 파일명을 예시로 인용한 것을 import 로 오인하면 진짜 import 를 영영 안 넣는다
 * (= 앵커가 조용히 안 실린다).
 */
function hasHarnessImport(text: string): boolean {
  if (text.includes(IMPORT_MARKER_START)) return true;
  let inFence = false;
  for (const line of text.split("\n")) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && line.trim() === HARNESS_IMPORT_LINE) return true;
  }
  return false;
}

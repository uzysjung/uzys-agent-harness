import { TRACKS, type Track } from "./types.js";

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
const IMPORT_BLOCK = `${IMPORT_MARKER_START}\n${HARNESS_IMPORT_LINE}\n${IMPORT_MARKER_END}`;

export const TRACK_DISPLAY_NAMES: Record<Track, string> = {
  tooling: "Tooling",
  "csr-supabase": "CSR Supabase",
  "csr-fastify": "CSR Fastify",
  "csr-fastapi": "CSR FastAPI",
  "ssr-htmx": "SSR HTMX",
  "ssr-nextjs": "SSR Next.js",
  data: "Data",
  executive: "Executive",
  full: "Full",
  "project-management": "Project Management",
  "growth-marketing": "Growth Marketing",
};

/** Tracks expanded when 'full' is selected — every track except 'full' itself.
 * Derived from TRACKS so a future track can't be silently omitted from a 'full' install. */
const FULL_EXPANSION: ReadonlyArray<Track> = TRACKS.filter((t) => t !== "full");

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
      "List the harness assets installed in this project (rules / skills / agents / commands) and add one line each on when to reach for it here. Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list ONLY assets whose file exists on disk — do not invent any. Do NOT restate the harness's working principles (they live in this project's harness anchor and rules layer) — cross-reference them instead. Delete this comment when done.",
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

/** Visible (rendered-markdown) banner — HTML FILL comments are invisible in a preview, so this
 * blockquote is what stops the scaffold from reading as verified project fact for a human. */
export const SCAFFOLD_BANNER = [
  "> ⚙️ **SCAFFOLD — not filled in yet.** The sections below are a fill-in template for THIS project, not verified facts.",
  "> To fill: open this file and paste each `<!-- FILL: … -->` comment's instruction into your coding agent (e.g. Claude Code) — it will inspect the real repo and write the section. You can also fill them by hand; the comments are the instructions.",
  `> The working principles live in this project's harness anchor — \`${HARNESS_ANCHOR_FILE}\` (Claude Code, imported from this file), \`AGENTS.md\` (Codex/OpenCode), or \`.agents/rules/uzys-harness.md\` (Antigravity). This file is **project-specific context only**.`,
].join("\n");

/**
 * Shared project-context scaffold body: the visible banner followed by the six MUST-HAVE
 * sections, each a `## Title` + a self-contained `<!-- FILL:id — … -->` comment + an honest
 * `_(not filled yet — …)_` placeholder. Pure and track-agnostic, so the Claude Code CLAUDE.md
 * and every AGENTS.md `{PROJECT_CONTEXT}` block get byte-identical prompts from one source.
 */
export function renderFillScaffold(): string {
  const blocks = FILL_SECTIONS.map((id) => {
    const spec = FILL_SPECS[id];
    return `## ${spec.title}\n\n<!-- FILL:${id} — ${spec.prompt} -->\n\n_(not filled yet — ${spec.placeholder})_`;
  });
  return `${SCAFFOLD_BANNER}\n\n${blocks.join("\n\n")}`;
}

export interface MergeOptions {
  /** Project directory basename → the H1 title (fixes the shipped `# [Project Name]` literal). */
  projectName: string;
  /** Selected tracks → the active-track note (genuine install metadata). */
  tracks: ReadonlyArray<Track>;
}

/**
 * Build the project-root CLAUDE.md: a real H1 project name + the active-track note (genuine
 * install metadata) + the shared fill scaffold. The scaffold is track-agnostic — the selected
 * tracks are recorded in the note; the installed-assets section is filled from real files at
 * fill time rather than from static per-track prose.
 */
export function mergeProjectClaude(opts: MergeOptions): string {
  const expanded = expandTracks(opts.tracks);
  const trackList = expanded.map((t) => TRACK_DISPLAY_NAMES[t]).join(", ");
  const header = `# ${opts.projectName}\n\n> Active track(s): ${trackList}`;
  return `${header}\n\n${renderFillScaffold()}\n`;
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
  if (existing === null) {
    return `${mergeProjectClaude(opts)}\n${IMPORT_BLOCK}\n`;
  }
  if (hasHarnessImport(existing)) {
    return existing;
  }
  const body = existing.endsWith("\n") ? existing : `${existing}\n`;
  return `${body}\n${IMPORT_BLOCK}\n`;
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
  const start = text.indexOf(IMPORT_MARKER_START);
  if (start === -1) return null;
  const endAt = text.indexOf(IMPORT_MARKER_END, start);
  if (endAt === -1) return null;
  const before = text.slice(0, start).replace(/\n+$/, "\n");
  const after = text.slice(endAt + IMPORT_MARKER_END.length).replace(/^\n+/, "");
  return `${before}${after}`;
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

function expandTracks(tracks: ReadonlyArray<Track>): ReadonlyArray<Track> {
  if (tracks.includes("full")) {
    return FULL_EXPANSION;
  }
  return tracks;
}

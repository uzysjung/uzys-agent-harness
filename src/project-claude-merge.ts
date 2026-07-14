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
      "List the harness assets installed in this project (rules / skills / agents / commands) and add one line each on when to reach for it here. Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list ONLY assets whose file exists on disk — do not invent any. Do NOT restate the universal Rule 1-12 (they live in the rules layer) — cross-reference them instead. Delete this comment when done.",
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
  "> The universal harness rules (Rule 1–12) live in the separate rules layer. This file is **project-specific context only**.",
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
}

/**
 * Build the project-root CLAUDE.md: a real H1 project name + the active-track note (genuine
 * install metadata) + the shared fill scaffold. The scaffold is track-agnostic — the selected
 * tracks are recorded in the note; the installed-assets section is filled from real files at
 * fill time rather than from static per-track prose.
 */
export function mergeProjectClaude(tracks: ReadonlyArray<Track>, opts: MergeOptions): string {
  const expanded = expandTracks(tracks);
  const trackList = expanded.map((t) => TRACK_DISPLAY_NAMES[t]).join(", ");
  const header = `# ${opts.projectName}\n\n> Active track(s): ${trackList}`;
  return `${header}\n\n${renderFillScaffold()}\n`;
}

function expandTracks(tracks: ReadonlyArray<Track>): ReadonlyArray<Track> {
  if (tracks.includes("full")) {
    return FULL_EXPANSION;
  }
  return tracks;
}

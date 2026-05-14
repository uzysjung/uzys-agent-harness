import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Track } from "./types.js";

export const SECTIONS = [
  "stack",
  "workflow",
  "active-rules",
  "agents",
  "skills",
  "plugins",
  "commands",
  "boundaries",
  "supabase-auth",
] as const;
export type Section = (typeof SECTIONS)[number];

const SECTION_TITLES: Record<Section, string> = {
  stack: "Stack",
  workflow: "Workflow",
  "active-rules": "Active Rules",
  agents: "Agents",
  skills: "Skills",
  plugins: "Plugins",
  commands: "Commands",
  boundaries: "Boundaries",
  "supabase-auth": "Supabase 인증 설정",
};

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

/** Tracks expanded when 'full' is selected — every track except 'full' itself. */
const FULL_EXPANSION: ReadonlyArray<Track> = [
  "tooling",
  "csr-fastapi",
  "csr-fastify",
  "csr-supabase",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "executive",
  "project-management",
  "growth-marketing",
];

export interface MergeOptions {
  /** Path to `templates/project-claude/` directory. */
  baseDir: string;
}

/**
 * Build the project root CLAUDE.md by merging `_base.md` with track fragments.
 * - Single track: section bodies inserted verbatim under each `## Section` header.
 * - Multi track: each track's fragment prefixed with `### <Display Name>` subheader.
 * - Section with no fragments from any selected track: section omitted entirely.
 * - 'full' track: expanded to every non-full track.
 */
export function mergeProjectClaude(tracks: ReadonlyArray<Track>, opts: MergeOptions): string {
  const expanded = expandTracks(tracks);
  const baseRaw = readFileSync(join(opts.baseDir, "_base.md"), "utf8");

  let output = baseRaw;
  output = output.replace("<!-- INSERT: track-list -->", trackList(expanded));
  output = output.replace("<!-- INSERT: tagline -->", taglineList(expanded, opts.baseDir));

  for (const section of SECTIONS) {
    const marker = `<!-- INSERT: ${section} -->`;
    const block = renderSection(section, expanded, opts.baseDir);
    if (block === null) {
      output = stripMarkerLine(output, marker);
    } else {
      output = output.replace(marker, block);
    }
  }

  return `${output.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function expandTracks(tracks: ReadonlyArray<Track>): ReadonlyArray<Track> {
  if (tracks.includes("full")) {
    return FULL_EXPANSION;
  }
  return tracks;
}

function trackList(tracks: ReadonlyArray<Track>): string {
  return tracks.map((t) => TRACK_DISPLAY_NAMES[t]).join(", ");
}

function taglineList(tracks: ReadonlyArray<Track>, baseDir: string): string {
  const taglines: string[] = [];
  for (const t of tracks) {
    const path = join(baseDir, "fragments", t, "tagline.md");
    if (!existsSync(path)) {
      continue;
    }
    const body = readFileSync(path, "utf8").trim();
    if (body) {
      taglines.push(body);
    }
  }
  return taglines.join(" / ");
}

function renderSection(
  section: Section,
  tracks: ReadonlyArray<Track>,
  baseDir: string,
): string | null {
  const present: { track: Track; body: string }[] = [];
  for (const t of tracks) {
    const path = join(baseDir, "fragments", t, `${section}.md`);
    if (!existsSync(path)) {
      continue;
    }
    const body = readFileSync(path, "utf8").trim();
    if (body) {
      present.push({ track: t, body });
    }
  }
  if (present.length === 0) {
    return null;
  }
  const title = `## ${SECTION_TITLES[section]}`;
  if (present.length === 1 && present[0]) {
    return `${title}\n\n${present[0].body}\n`;
  }
  const blocks = present.map(({ track, body }) => `### ${TRACK_DISPLAY_NAMES[track]}\n\n${body}`);
  return `${title}\n\n${blocks.join("\n\n")}\n`;
}

/** Remove a marker line plus the leading blank line that separates it from the previous block. */
function stripMarkerLine(text: string, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\n*${escaped}\\n*`);
  return text.replace(pattern, "\n");
}

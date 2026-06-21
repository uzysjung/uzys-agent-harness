/**
 * Claude `.claude/commands/uzys/<phase>.md` → OpenCode `.opencode/commands/uzys-<phase>.md`.
 *
 * 차이 (Codex skills.ts와):
 *   - OpenCode 파일명 = 슬래시 커맨드명 → `uzys-<phase>.md` 형식
 *   - Frontmatter: `description` + `agent` (build/plan), `name` 필드 없음 (filename 자체)
 */
import { renameSlashes } from "./agents-md.js";

export interface RenderCommandParams {
  /** Original uzys command markdown (frontmatter optional). */
  source: string;
  /** Phase identifier (spec, plan, build, test, review, ship). */
  phase: string;
}

const AGENT_BY_PHASE: Record<string, string> = {
  spec: "plan",
  plan: "plan",
  build: "build",
  test: "build",
  review: "plan",
  ship: "build",
};

/**
 * Render an OpenCode `.opencode/commands/uzys-<phase>.md` from a Claude
 * `.claude/commands/uzys/<phase>.md` source. Slash references are renamed.
 */
export function renderCommand(params: RenderCommandParams): string {
  const { description, body } = parseSource(params.source);
  const finalDescription = description || `uzys-${params.phase} phase command (OpenCode 포팅)`;
  const escapedDesc = finalDescription.replace(/"/g, '\\"');
  const agent = AGENT_BY_PHASE[params.phase] ?? "build";
  const renamedBody = renameSlashes(body).trimEnd();

  return [
    "---",
    `description: "${escapedDesc}"`,
    `agent: ${agent}`,
    "---",
    "",
    renamedBody,
    "",
  ].join("\n");
}

/**
 * v26.87.0 — render an OpenCode command from a bundled, already-complete SKILL.md
 * (dev-method skills). OpenCode has NO native skill concept, so each selected skill is
 * surfaced as a `.opencode/commands/<id>.md` command fallback: command frontmatter
 * (`description` from the skill's own frontmatter, `agent: plan`) + the skill body.
 *
 * Unlike a uzys phase command, there is no slash phase — the id IS the command name
 * (filename). Body slashes are renamed (`/uzys:` → `/uzys-`) for consistency with the
 * other ports. `agent: plan` because these are review/analysis methodology skills
 * (read-heavy), mirroring renderCommand's plan-side phases (spec/plan/review).
 */
export function renderCommandFromSkill(source: string, id: string): string {
  const { description, body } = parseSkillFrontmatter(source);
  const finalDescription = description || `${id} (dev-method skill, OpenCode command fallback)`;
  const escapedDesc = finalDescription.replace(/"/g, '\\"');
  const renamedBody = renameSlashes(body).trimEnd();

  return ["---", `description: "${escapedDesc}"`, "agent: plan", "---", "", renamedBody, ""].join(
    "\n",
  );
}

/**
 * Parse a complete SKILL.md: split frontmatter from body, extracting the `description`
 * scalar. Handles folded/literal block scalars (`description: >-` or `|`) where the value
 * spans subsequent indented lines — the dev-method skills use `>-`. Single-line
 * `description: "..."` is also supported.
 */
function parseSkillFrontmatter(source: string): ParsedSource {
  const lines = source.split(/\r?\n/);
  if (lines[0] !== "---") {
    const firstLine = lines[0] ?? "";
    return { description: firstLine.trim(), body: lines.slice(1).join("\n") };
  }
  let secondDelimAt = -1;
  let description = "";
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line === "---") {
      secondDelimAt = i;
      break;
    }
    const inline = line.match(/^description:\s*(.+)$/);
    if (!inline) {
      continue;
    }
    const raw = (inline[1] ?? "").trim();
    if (raw === ">-" || raw === ">" || raw === "|" || raw === "|-") {
      // Folded/literal block scalar — collect following more-indented lines, join folded.
      const collected: string[] = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j] ?? "";
        if (next === "---") {
          break;
        }
        if (next.trim() === "" || /^\s/.test(next)) {
          collected.push(next.trim());
        } else {
          break; // next top-level key
        }
      }
      description = collected.join(" ").replace(/\s+/g, " ").trim();
    } else {
      description = stripQuotes(raw);
    }
  }
  const body =
    secondDelimAt >= 0
      ? lines
          .slice(secondDelimAt + 1)
          .join("\n")
          .replace(/^\n+/, "")
      : source;
  return { description, body };
}

interface ParsedSource {
  description: string;
  body: string;
}

function parseSource(source: string): ParsedSource {
  const lines = source.split(/\r?\n/);
  if (lines[0] === "---") {
    let descMatch = "";
    let secondDelimAt = -1;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (line === "---") {
        secondDelimAt = i;
        break;
      }
      const match = line.match(/^description:\s*(.*)$/);
      if (match) {
        descMatch = stripQuotes(match[1] ?? "");
      }
    }
    const body = secondDelimAt >= 0 ? lines.slice(secondDelimAt + 1).join("\n") : source;
    return { description: descMatch, body: body.replace(/^\n+/, "") };
  }
  const firstLine = lines[0] ?? "";
  const body = lines.slice(1).join("\n");
  return { description: firstLine.trim(), body };
}

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

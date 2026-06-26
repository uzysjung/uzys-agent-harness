/**
 * Bundled SKILL.md → OpenCode `.opencode/commands/<id>.md` command fallback (dev-method skills).
 *
 * OpenCode 는 native skill 개념이 없어 각 skill 을 커맨드로 surface:
 *   - 파일명 = 슬래시 커맨드명 → `<id>.md`
 *   - Frontmatter: `description` (skill frontmatter 에서) + `agent: plan`, `name` 필드 없음
 */
import { renameSlashes } from "./agents-md.js";

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

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

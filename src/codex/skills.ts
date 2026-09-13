/**
 * Bundled SKILL.md → non-Claude CLI native skill transform (dev-method skills).
 */
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listFilesRecursive } from "../fs-ops.js";
import type { OwnedWriter } from "../owned-write.js";
import { renameSlashes } from "./agents-md.js";

/**
 * v26.87.0 — render a bundled, already-complete SKILL.md (dev-method skills) for a
 * non-Claude CLI (Codex / Antigravity native `.agents/skills/<id>/SKILL.md`).
 *
 * These sources are full Anthropic skills with their OWN frontmatter (`name: <id>`,
 * full description). We MUST preserve that frontmatter verbatim — only the BODY is
 * ported: `/uzys:` → `/uzys-` slash rename + `CLAUDE_PROJECT_DIR` → `CODEX_PROJECT_DIR`
 * env-var rename (Codex/Antigravity share the `.agents/` format + `CODEX_PROJECT_DIR`).
 */
export function renderBundledSkill(source: string): string {
  const trimmed = source.trimEnd();
  const lines = trimmed.split(/\r?\n/);
  // No frontmatter → emit body as-is (port slashes/env only). Defensive: bundled
  // dev-method skills always have frontmatter, but never silently drop content.
  if (lines[0] !== "---") {
    return `${portBody(trimmed)}\n`;
  }
  let secondDelimAt = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      secondDelimAt = i;
      break;
    }
  }
  if (secondDelimAt < 0) {
    // Malformed frontmatter (no closing ---) → port whole thing as body.
    return `${portBody(trimmed)}\n`;
  }
  const frontmatter = lines.slice(0, secondDelimAt + 1).join("\n");
  const body = lines.slice(secondDelimAt + 1).join("\n");
  return `${frontmatter}\n${portBody(body)}\n`;
}

/** Port a skill body for Codex/Antigravity: slash + project-dir env-var rename. */
function portBody(body: string): string {
  return renameSlashes(body)
    .replace(/CLAUDE_PROJECT_DIR/g, "CODEX_PROJECT_DIR")
    .trimEnd();
}

export interface BundledSkillDirParams {
  /** harness root — 원본은 `templates/skills/<id>/`. */
  harnessRoot: string;
  /** 대상 프로젝트 root — 산출물은 `.agents/skills/<id>/`. */
  projectDir: string;
  /** 이 설치에서 고른 번들 스킬 id (installer 가 채운 `selectedInternalSkills`). */
  skillIds: ReadonlyArray<string>;
  /** 소유자 판정을 쥔 writer — 쓴 파일이 전부 `ownership.files` 에 실린다. */
  writer: OwnedWriter;
}

/**
 * 2026-09-13 (#431) — 번들 스킬을 **디렉터리 전체**로 `.agents/skills/<id>/` 에 쓴다.
 *
 * 이전에는 세 transform(codex·opencode·antigravity)이 `SKILL.md` **한 파일**만 보내는 같은
 * 루프를 각자 갖고 있었다. 번들 스킬 다수가 본문을 `references/`·`scripts/`·`agents/` 로
 * 나눠 들고 `SKILL.md` 가 "그 파일을 읽어라"로 라우팅하는데, 비-Claude CLI 설치자에게는 그
 * 자리가 **비어 있었다** — 안내판만 가고 본문이 안 갔다. Claude Code 쪽(`manifest.ts`)은
 * 처음부터 디렉터리 단위 복사라 이 비대칭은 한쪽 계열에만 있었다.
 *
 * 루프를 여기 하나로 모은 이유: 같은 루프가 셋이면 다음 수정이 또 하나를 빠뜨린다(#340·
 * `feedback_surface_symmetry` 와 같은 형태).
 *
 * 파일 종류별 처리 —
 *   - `SKILL.md`: `renderBundledSkill` 그대로. 이전 판본과 **바이트 동일**해야 한다.
 *   - 형제 `.md`·`.sh`: `SKILL.md` 본문과 같은 포팅(`/uzys:` → `/uzys-` ·
 *     `CLAUDE_PROJECT_DIR` → `CODEX_PROJECT_DIR`). 참조 문서가 Claude 전용 슬래시를 들고
 *     가면 그 CLI 에서 존재하지 않는 커맨드를 불러 보게 된다.
 *   - 그 밖(`.py`·`.yaml`·`.json` 등): 그대로. 코드·데이터를 문자열 치환하면 깨진다.
 *   - 이름이 `.` 로 시작하는 파일·디렉터리: 건너뛴다(`.DS_Store` 같은 OS 부산물).
 *
 * @returns 이번에 쓴 **모든** 파일의 절대 경로 (`SKILL.md` + 형제). 호출부가 그대로
 *   `skillFiles` 로 보고한다 — 안 쓴 경로는 들어가지 않는다(건너뛴 것을 싣는 순간 거짓 보고).
 */
export function writeBundledSkillDirs(params: BundledSkillDirParams): string[] {
  const { harnessRoot, projectDir, skillIds, writer } = params;
  const written: string[] = [];
  for (const id of skillIds) {
    const srcDir = join(harnessRoot, "templates/skills", id);
    const srcSkill = join(srcDir, "SKILL.md");
    if (!existsSync(srcSkill)) {
      continue;
    }
    const targetDir = join(projectDir, ".agents", "skills", id);
    const targetSkill = join(targetDir, "SKILL.md");
    // 건너뛴 경로를 report 에 실으면 "깔았다"는 거짓 보고가 된다. 형제도 함께 건너뛴다 —
    // refresh 모드에서 `SKILL.md` 가 없다는 것은 이 스킬이 이 프로젝트에 없다는 뜻이고,
    // 남의 도구가 소유한 슬롯이면 그 트리에 우리 파일을 흘리지 않아야 한다(#343).
    if (!writer.write(targetSkill, renderBundledSkill(readFileSync(srcSkill, "utf8")))) {
      continue;
    }
    written.push(targetSkill);
    for (const rel of listFilesRecursive(srcDir)) {
      if (rel === "SKILL.md") continue;
      if (rel.split("/").some((segment) => segment.startsWith("."))) continue;
      const segments = rel.split("/");
      const raw = readFileSync(join(srcDir, ...segments), "utf8");
      const ported = rel.endsWith(".md") || rel.endsWith(".sh") ? `${portBody(raw)}\n` : raw;
      const target = join(targetDir, ...segments);
      // `createInRefresh`: 바로 위에서 `SKILL.md` 를 담당했다는 것이 **이 CLI 가 설치돼 있고
      // 이 스킬이 선택됐다**는 증거다(antigravity 룰이 앵커 반환값을 쓰는 것과 같은 논거).
      // 그 증거 없이 켜면 안 깐 CLI 에 `.agents/` 가 생겨 refreshOnly 가 무의미해진다.
      if (!writer.write(target, ported, { createInRefresh: true })) continue;
      // refresh 가 건너뛴 경로에는 파일이 없다 — chmod 를 무조건 걸면 ENOENT 로 터진다.
      if (rel.endsWith(".sh")) chmodSync(target, 0o755);
      written.push(target);
    }
  }
  return written;
}

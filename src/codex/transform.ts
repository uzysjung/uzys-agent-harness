/**
 * Codex transform orchestrator — wraps the 5-step pipeline.
 *
 * Replaces `scripts/claude-to-codex.sh` (Phase D, OQ4 = TS port).
 *
 * Inputs:
 *   - harnessRoot:  repository root (templates/ + .mcp.json)
 *   - projectDir:   target project to receive AGENTS.md + .codex/ + .agents/skills/
 *
 * Outputs (under projectDir):
 *   - AGENTS.md
 *   - .codex/config.toml
 *   - .codex/hooks/*.sh              (hooks ported from templates/hooks/)
 *   - .agents/skills/<id>/SKILL.md   (dev-method skills, frontmatter 보존)
 *
 * v0.6.4 — skill 출력 경로는 Codex 공식 표준 `.agents/skills/<name>/SKILL.md` (repo-level scope).
 *   참조: https://developers.openai.com/codex/skills
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { renderAgentsMd } from "./agents-md.js";
import { renderConfigToml } from "./config-toml.js";
import { renderBundledSkill } from "./skills.js";

export interface CodexTransformParams {
  harnessRoot: string;
  projectDir: string;
  /**
   * v26.87.0 — dev-method skill ids 선택 목록 (installer 가 `DEV_METHOD_SKILL_IDS` 를
   * `isAssetSelected` 로 필터). 각 id 의 `templates/skills/<id>/SKILL.md` 를 Codex native
   * `.agents/skills/<id>/SKILL.md` 로 (frontmatter 보존) 출력.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
}

export interface CodexTransformReport {
  agentsMdPath: string;
  configTomlPath: string;
  hookFiles: string[];
  skillFiles: string[];
}

const HOOK_NAMES = ["session-start", "hito-counter"];

const ENV_VAR_RENAME = /CLAUDE_PROJECT_DIR/g;

export function runCodexTransform(params: CodexTransformParams): CodexTransformReport {
  const { harnessRoot, projectDir, selectedInternalSkills = [] } = params;

  const claudeMd = readRequired(join(harnessRoot, "templates/CLAUDE.md"));
  const agentsTemplate = readRequired(join(harnessRoot, "templates/codex/AGENTS.md.template"));
  const configTemplate = readRequired(join(harnessRoot, "templates/codex/config.toml.template"));
  const projectName = basename(projectDir);
  const mcp = readOptionalJson(join(harnessRoot, ".mcp.json"));

  // 1. AGENTS.md
  const agentsMdPath = join(projectDir, "AGENTS.md");
  ensureDir(projectDir);
  writeFileSync(agentsMdPath, renderAgentsMd({ template: agentsTemplate, claudeMd, projectName }));

  // 2. .codex/config.toml
  const configTomlPath = join(projectDir, ".codex/config.toml");
  ensureDir(join(projectDir, ".codex"));
  writeFileSync(
    configTomlPath,
    renderConfigToml({
      template: configTemplate,
      projectName,
      projectDir,
      mcp,
    }),
  );

  // 3. .codex/hooks/{session-start,hito-counter}.sh
  const hookDir = join(projectDir, ".codex/hooks");
  ensureDir(hookDir);
  const hookFiles: string[] = [];
  for (const hook of HOOK_NAMES) {
    const src = join(harnessRoot, "templates/hooks", `${hook}.sh`);
    if (!existsSync(src)) {
      continue;
    }
    const ported = readFileSync(src, "utf8").replace(ENV_VAR_RENAME, "CODEX_PROJECT_DIR");
    const target = join(hookDir, `${hook}.sh`);
    writeFileSync(target, ported);
    chmodSync(target, 0o755);
    hookFiles.push(target);
  }

  // 4. v26.87.0 — dev-method skills → .agents/skills/<id>/SKILL.md (frontmatter 보존).
  //   renderBundledSkill 이 source frontmatter(name: <id>)를 그대로 보존하고 body 만 포팅.
  const skillFiles: string[] = [];
  for (const id of selectedInternalSkills) {
    const src = join(harnessRoot, "templates/skills", id, "SKILL.md");
    if (!existsSync(src)) {
      continue;
    }
    const skillDir = join(projectDir, ".agents", "skills", id);
    ensureDir(skillDir);
    const target = join(skillDir, "SKILL.md");
    writeFileSync(target, renderBundledSkill(readFileSync(src, "utf8")));
    skillFiles.push(target);
  }

  return { agentsMdPath, configTomlPath, hookFiles, skillFiles };
}

function readRequired(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Codex transform: required source missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

function readOptionalJson(path: string): McpJson | null {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as McpJson;
  } catch {
    return null;
  }
}

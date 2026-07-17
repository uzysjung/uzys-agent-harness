/**
 * OpenCode transform orchestrator — SSOT (templates/CLAUDE.md, .mcp.json) →
 * OpenCode 자산.
 *
 * Inputs:
 *   - harnessRoot:  repository root (templates/ + .mcp.json)
 *   - projectDir:   target project to receive AGENTS.md + opencode.json + .opencode/
 *
 * Outputs (under projectDir):
 *   - AGENTS.md
 *   - opencode.json
 *   - .opencode/commands/<id>.md   (dev-method skills as command fallback)
 *
 * SPEC: docs/specs/opencode-compat.md
 * Phase: C1 (transform orchestrator)
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { backupFileIfChanged, ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { renderFillScaffold } from "../project-claude-merge.js";
import { renderAgentsMd } from "./agents-md.js";
import { renderCommandFromSkill } from "./commands.js";
import { renderOpencodeJson } from "./opencode-json.js";

export interface OpencodeTransformParams {
  harnessRoot: string;
  projectDir: string;
  /**
   * v26.87.0 — dev-method skill ids 선택 목록. OpenCode 는 native skill 개념이 없어 각 skill 을
   * `.opencode/commands/<id>.md` 커맨드 fallback 으로 surface (description = skill frontmatter,
   * body = skill 본문). installer 가 `DEV_METHOD_SKILL_IDS` 필터로 채움.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
}

export interface OpencodeTransformReport {
  agentsMdPath: string;
  opencodeJsonPath: string;
  commandFiles: string[];
}

export function runOpencodeTransform(params: OpencodeTransformParams): OpencodeTransformReport {
  const { harnessRoot, projectDir, selectedInternalSkills = [] } = params;

  const claudeMd = readRequired(join(harnessRoot, "templates/CLAUDE.md"));
  const agentsTemplate = readRequired(join(harnessRoot, "templates/opencode/AGENTS.md.template"));
  const opencodeTemplate = readRequired(
    join(harnessRoot, "templates/opencode/opencode.json.template"),
  );
  const projectName = basename(projectDir);
  const mcp = readOptionalJson(join(harnessRoot, ".mcp.json"));

  // 1. AGENTS.md
  ensureDir(projectDir);
  const agentsMdPath = join(projectDir, "AGENTS.md");
  const agentsMdOut = renderAgentsMd({
    template: agentsTemplate,
    claudeMd,
    projectName,
    projectContext: renderFillScaffold(),
  });
  // 사용자가 채운 AGENTS.md 를 재설치(add 모드) 덮어쓰기 전 보존 — 루트 CLAUDE.md 와 대칭.
  backupFileIfChanged(agentsMdPath, agentsMdOut);
  writeFileSync(agentsMdPath, agentsMdOut);

  // 2. opencode.json
  const opencodeJsonPath = join(projectDir, "opencode.json");
  writeFileSync(opencodeJsonPath, renderOpencodeJson({ template: opencodeTemplate, mcp }));

  // 3. v26.87.0 — dev-method skills → .opencode/commands/<id>.md (command fallback).
  //   OpenCode 는 native skill 개념이 없어 skill 을 커맨드로 surface.
  const cmdDir = join(projectDir, ".opencode/commands");
  ensureDir(cmdDir);
  const commandFiles: string[] = [];
  for (const id of selectedInternalSkills) {
    const src = join(harnessRoot, "templates/skills", id, "SKILL.md");
    if (!existsSync(src)) {
      continue;
    }
    const target = join(cmdDir, `${id}.md`);
    // scripts/ sidecar = the skill shells out to an external CLI → needs a
    // bash-capable agent; plan (bash denied) made such commands a no-op.
    const shellDependent = existsSync(join(harnessRoot, "templates/skills", id, "scripts"));
    writeFileSync(
      target,
      renderCommandFromSkill(readFileSync(src, "utf8"), id, { shellDependent }),
    );
    commandFiles.push(target);
  }

  return { agentsMdPath, opencodeJsonPath, commandFiles };
}

function readRequired(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`OpenCode transform: required source missing: ${path}`);
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

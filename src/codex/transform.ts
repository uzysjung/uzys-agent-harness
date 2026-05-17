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
 *   - .codex/hooks/*.sh                      (3 hooks ported from templates/hooks/)
 *   - .agents/skills/uzys-{phase}/SKILL.md   (6 skills, slash-renamed)
 *
 * v0.6.4 — skill 출력 경로 수정 `.codex-skills/` → `.agents/skills/`.
 *   사유: Codex 공식 표준은 `.agents/skills/<name>/SKILL.md` (repo-level scope).
 *   `.codex-skills/`는 비표준 — Codex가 인식 안 함 → /uzys-* slash 동작 안 함.
 *   참조: https://developers.openai.com/codex/skills
 */

import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { renderAgentsMd } from "./agents-md.js";
import { renderConfigToml } from "./config-toml.js";
import { renderCodexPrompt } from "./prompts.js";
import { renderSkill } from "./skills.js";

export interface CodexTransformParams {
  harnessRoot: string;
  projectDir: string;
  /**
   * v26.57.0 (ADR-018) — uzys-* skill/prompt 생성 gating.
   * Codex 의 `.agents/skills/uzys-{phase}/SKILL.md` 와 `.codex/prompts/uzys-{phase}.md`
   * 는 본 harness 의 6-Gate 워크플로우 산출물. withUzysHarness=false 면 두 디렉토리에
   * uzys-* 파일 생성 안 함. Claude 쪽 `.claude/commands/uzys/` 와 묶음 (ADR-017 의 확장).
   */
  withUzysHarness?: boolean;
}

export interface CodexTransformReport {
  agentsMdPath: string;
  configTomlPath: string;
  hookFiles: string[];
  skillFiles: string[];
  /**
   * v0.7.1 — `<projectDir>/.codex/prompts/uzys-{phase}.md` 6 markdown.
   * 글로벌 영향 0. upstream Codex Issue #9848 (project-scoped prompts) 지원 시 자동 작동.
   */
  promptFiles: string[];
}

const PHASES = ["spec", "plan", "build", "test", "review", "ship"];
const HOOK_NAMES = ["session-start", "hito-counter", "gate-check"];

const ENV_VAR_RENAME = /CLAUDE_PROJECT_DIR/g;

export function runCodexTransform(params: CodexTransformParams): CodexTransformReport {
  const { harnessRoot, projectDir, withUzysHarness = false } = params;

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

  // 3. .codex/hooks/{session-start,hito-counter,gate-check}.sh
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

  // 4. .agents/skills/uzys-{phase}/SKILL.md (v0.6.4 — Codex 공식 repo-level skill scope)
  // v26.57.0 (ADR-018) — withUzysHarness gating. uzys 슬래시 미사용 시 skill 디렉토리 생성 X.
  const skillFiles: string[] = [];
  if (withUzysHarness) {
    for (const phase of PHASES) {
      const skillDir = join(projectDir, ".agents", "skills", `uzys-${phase}`);
      ensureDir(skillDir);
      const cmdSrc = join(harnessRoot, "templates/commands/uzys", `${phase}.md`);
      let source = "";
      if (existsSync(cmdSrc)) {
        source = readFileSync(cmdSrc, "utf8");
      } else {
        // Fallback: bundled stub from templates/codex/skills/<phase>/SKILL.md
        const fallback = join(harnessRoot, "templates/codex/skills", `uzys-${phase}/SKILL.md`);
        if (existsSync(fallback)) {
          source = readFileSync(fallback, "utf8");
        }
      }
      const target = join(skillDir, "SKILL.md");
      writeFileSync(target, renderSkill({ source, phase }));
      skillFiles.push(target);
    }
  }

  // 5. v0.7.1 — .codex/prompts/uzys-{phase}.md (project-scoped pre-positioning)
  // 글로벌 ~/.codex/prompts/ 영향 0. Codex upstream Issue #9848 지원 시 자동 작동.
  // 현재는 Codex가 project-scoped prompts 미지원 — pre-position만 (free upgrade 패턴).
  // v26.57.0 (ADR-018) — withUzysHarness gating. uzys 슬래시 미사용 시 prompt 생성 X.
  const promptFiles: string[] = [];
  if (withUzysHarness) {
    const promptDir = join(projectDir, ".codex", "prompts");
    ensureDir(promptDir);
    for (const phase of PHASES) {
      const cmdSrc = join(harnessRoot, "templates/commands/uzys", `${phase}.md`);
      if (!existsSync(cmdSrc)) {
        continue;
      }
      const source = readFileSync(cmdSrc, "utf8");
      const target = join(promptDir, `uzys-${phase}.md`);
      writeFileSync(target, renderCodexPrompt({ source, phase }));
      promptFiles.push(target);
    }
  }

  return { agentsMdPath, configTomlPath, hookFiles, skillFiles, promptFiles };
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

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

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { createOwnedWriter, type OwnedWriteResult } from "../owned-write.js";
import { renderFillScaffold } from "../project-claude-merge.js";
import { portRules, renderRulesBlock } from "../rules-port.js";
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
  /** 2026-08-12 — 이 설치의 배포 룰 이름들. codex 와 공유하는 `AGENTS.md` 본문에 embed 된다. */
  rules?: ReadonlyArray<string>;
  /**
   * v26.133.0 (ADR-048) — 설치 시점 기준선 (install log `externalFiles`).
   * codex 쪽과 같은 이유로 **required** 다 — 안 넘긴 호출부가 조용히 판정 불가로 떨어지면
   * 그 경로만 매 설치마다 백업이 쌓인다. 레거시는 빈 Map 을 명시적으로 넘긴다.
   */
  baseline: ReadonlyMap<string, string>;
  /**
   * v26.134.0 (ADR-049) — `update` 경로. 이미 있는 산출물만 갱신하고 없는 것은 만들지 않는다.
   * opencode 를 안 깐 프로젝트에서 돌려도 `opencode.json`/`.opencode/` 가 생기지 않는다.
   */
  refreshOnly?: boolean;
}

export interface OpencodeTransformReport {
  agentsMdPath: string;
  opencodeJsonPath: string;
  commandFiles: string[];
  /** v26.133.0 (ADR-048) — 소유권 결과 (기준선 · 백업된 사용자 편집분). */
  ownership: OwnedWriteResult;
}

export function runOpencodeTransform(params: OpencodeTransformParams): OpencodeTransformReport {
  const {
    harnessRoot,
    projectDir,
    selectedInternalSkills = [],
    rules = [],
    baseline,
    refreshOnly,
  } = params;
  const writer = createOwnedWriter(projectDir, baseline, { refreshOnly: refreshOnly ?? false });

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
    // codex 와 **같은 파일**(프로젝트 루트 `AGENTS.md`)이다. 두 transform 이 서로 다른 본문을
    // 쓰면 나중에 도는 쪽이 앞선 쪽을 덮어써, codex+opencode 조합에서 룰이 통째로 사라진다
    // (독립 검증 C-1 실측). 같은 내용을 쓰면 순서가 결과를 바꾸지 않는다.
    harnessRules: renderRulesBlock(portRules(harnessRoot, rules)),
  });
  // 사용자가 채운 AGENTS.md 를 재설치(add 모드) 덮어쓰기 전 보존 — 루트 CLAUDE.md 와 대칭.
  // v26.133.0 (ADR-048) — 내용 비교에서 소유자 판정으로. codex 가 같은 install 안에서 이미
  // 쓴 AGENTS.md 를 여기서 '사용자 편집'으로 오판하면 매 설치마다 백업이 생긴다.
  writer.write(agentsMdPath, agentsMdOut);

  // 2. opencode.json
  const opencodeJsonPath = join(projectDir, "opencode.json");
  writer.write(opencodeJsonPath, renderOpencodeJson({ template: opencodeTemplate, mcp }));

  // 3. v26.87.0 — dev-method skills → .opencode/commands/<id>.md (command fallback).
  //   OpenCode 는 native skill 개념이 없어 skill 을 커맨드로 surface.
  const cmdDir = join(projectDir, ".opencode/commands");
  // refresh 는 없던 디렉터리를 만들지 않는다 — 만들면 opencode 를 안 쓰는 프로젝트에
  // 빈 `.opencode/commands/` 가 남아 "설치됨"처럼 보인다. 신규 설치 경로에서는 writer 가
  // 파일별로 mkdir 하므로 이 줄이 없어도 되지만, 선택 스킬이 0개인 설치의 기존 동작
  // (빈 디렉터리 생성)을 바꾸지 않으려고 남겨 둔다.
  if (!refreshOnly) ensureDir(cmdDir);
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
    // 건너뛴 경로를 report 에 실으면 "깔았다"는 거짓 보고가 된다.
    const wrote = writer.write(
      target,
      renderCommandFromSkill(readFileSync(src, "utf8"), id, { shellDependent }),
    );
    if (!wrote) continue;
    commandFiles.push(target);
  }

  return {
    agentsMdPath,
    opencodeJsonPath,
    commandFiles,
    ownership: writer.result(),
  };
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

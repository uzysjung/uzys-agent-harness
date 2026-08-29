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
 *   - .agents/skills/<id>/SKILL.md (dev-method skills — codex·antigravity 와 같은 자리)
 *
 * SPEC: docs/specs/opencode-compat.md
 * Phase: C1 (transform orchestrator)
 */

import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { renderBundledSkill } from "../codex/skills.js";
import { backupFile, ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { createOwnedWriter, type OwnedWriteResult } from "../owned-write.js";
import { renderFillScaffold } from "../project-claude-merge.js";
import { portRules, renderRulesBlock } from "../rules-port.js";
import { renderAgentsMd } from "./agents-md.js";
import { renderOpencodeJson } from "./opencode-json.js";

export interface OpencodeTransformParams {
  harnessRoot: string;
  projectDir: string;
  /**
   * dev-method skill ids 선택 목록. installer 가 `DEV_METHOD_SKILL_IDS` 필터로 채움.
   *
   * 2026-08-29 (ADR-081) — `.agents/skills/<id>/SKILL.md` 로 보낸다. v26.87.0 이 커맨드로
   * 변환하던 근거("OpenCode 는 native skill 개념이 없다")가 더는 사실이 아니다.
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
  /** `.agents/skills/<id>/SKILL.md` — codex·antigravity 와 같은 자리(같은 파일)다. */
  skillFiles: string[];
  /** 옛 `.opencode/commands/<id>.md` 를 백업하고 지운 경로들 (ADR-081 전환 뒷정리). */
  retiredCommands: string[];
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

  // 3. dev-method skills → `.agents/skills/<id>/SKILL.md` (ADR-081).
  //
  //   실측 2026-08-29 (`opencode 1.18.23`, 컨테이너, 대조군 포함): OpenCode 는 프로젝트
  //   스코프 `.agents/skills/<id>/SKILL.md` 를 **자동 로드**하고, 그렇게 실린 스킬이
  //   커맨드 목록에도 `source: "skill"` 로 함께 뜬다. 즉 슬래시 호출을 잃지 않으면서
  //   모델이 description 을 보고 스스로 부를 수 있게 된다.
  //
  //   codex·antigravity 와 **같은 파일**이다. 셋이 한 벌을 공유하므로 조합 설치에서
  //   같은 스킬이 두 판본으로 깔리는 일이 없다 — 그것이 #340 의 형태였다.
  const skillFiles: string[] = [];
  for (const id of selectedInternalSkills) {
    const src = join(harnessRoot, "templates/skills", id, "SKILL.md");
    if (!existsSync(src)) {
      continue;
    }
    const target = join(projectDir, ".agents", "skills", id, "SKILL.md");
    // 건너뛴 경로를 report 에 실으면 "깔았다"는 거짓 보고가 된다.
    if (!writer.write(target, renderBundledSkill(readFileSync(src, "utf8")))) continue;
    skillFiles.push(target);
  }

  // 4. 옛 커맨드 사본 은퇴. 안 지우면 OpenCode 커맨드 목록에 같은 이름이 **두 줄**로 뜬다
  //   (옛 `source: "command"` + 새 `source: "skill"`). 대상은 번들 스킬 이름인 것만 —
  //   목록을 적지 않고 `templates/skills/<이름>/SKILL.md` 존재로 유도한다. 사용자가 직접
  //   쓴 커맨드는 그 조건에 안 걸린다.
  //
  //   판정 대신 **백업하고 지운다**: 우리가 렌더한 파일이지만 사용자가 고쳤을 수 있고,
  //   그 편집분을 되살릴 방법이 없다(`retireMcpAllowlist` 와 같은 이유). 파일이 다시
  //   생기지 않으므로 이 백업은 프로젝트당 한 번뿐이다.
  const retiredCommands: string[] = [];
  const cmdDir = join(projectDir, ".opencode/commands");
  if (existsSync(cmdDir)) {
    for (const entry of readdirSync(cmdDir)) {
      if (!entry.endsWith(".md")) continue;
      const id = entry.slice(0, -3);
      if (!existsSync(join(harnessRoot, "templates/skills", id, "SKILL.md"))) continue;
      const victim = join(cmdDir, entry);
      try {
        backupFile(victim);
        unlinkSync(victim);
        retiredCommands.push(victim);
      } catch {
        // 뒷정리라 실패해도 설치를 세우지 않는다 (read-only 디렉터리 등).
      }
    }
  }

  return {
    agentsMdPath,
    opencodeJsonPath,
    skillFiles,
    retiredCommands,
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

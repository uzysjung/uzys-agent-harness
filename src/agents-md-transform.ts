/**
 * `AGENTS.md` 렌더·쓰기 주체 하나 (#642 · ADR-103).
 *
 * codex · opencode 변환이 각자 이 파일을 쓰던 것을 걷고, `runCliTransforms` 가 세 변환 **뒤에** 이 함수를 한 번
 * 부른다. 판은 깔린 비-Claude CLI 집합(`clis`)이 정한다 — 한 판이 이기던 구조(#550 의 "쓰는 쪽은 하나" 우회)가
 * 사라진다. `uninstall --cli` 도 남는 집합으로 같은 함수를 부른다(C-3) — 렌더 규칙이 두 벌이 되지 않게.
 *
 * 쓰기는 지금의 `writeAgentsMd`(절 모델 / 첫 접촉 블록 모델 판정 `agentsMdModel`) 그대로다.
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { anchorTitle, withMarkedContinuousSkillsNote } from "./agents-md-merge.js";
import {
  AGENTS_MD_TEMPLATE,
  type AgentsMdCli,
  agentsMdClis,
  renameSlashes,
  renderAgentsMd,
} from "./agents-md-render.js";
import { agentsSkillSlot } from "./agents-skill-targets.js";
import { seedAgentsMdProjectContext } from "./anchor-seed.js";
import { ensureDir } from "./fs-ops.js";
import { createOwnedWriter, type OwnedWriteResult, type WriteJournal } from "./owned-write.js";
import { renderFillScaffold } from "./project-claude-merge.js";
import { portRules, renderRulesBlock, ruleHeadings } from "./rules-port.js";
import { type AgentsMdWriteResult, type SharedRecord, writeAgentsMd } from "./shared-write.js";

export interface AgentsMdTransformParams {
  harnessRoot: string;
  projectDir: string;
  /** 이 실행의 `AGENTS.md` 집합 — 비면 호출하지 않는다(claude 단독). */
  clis: ReadonlyArray<AgentsMdCli>;
  /** 상시 스킬 안내(ADR-085)의 원천 — 세 변환과 같은 인자(`agentsSkillSlot` 이 같은 답을 낸다). */
  selectedInternalSkills: ReadonlyArray<string>;
  /** 인라인 룰(`## Harness Rules`) — codex · opencode 가 집합에 있을 때만 들어간다. */
  rules: ReadonlyArray<string>;
  /** 기준선(install log `externalFiles` + 이 실행의 앞 변환 결과). */
  baseline: ReadonlyMap<string, string>;
  /** `update` · `uninstall --cli` 경로 — 없는 파일은 `installedByRecord` 일 때만 만든다. */
  refreshOnly?: boolean;
  /** ADR-099 R2 — 기록이 이 집합의 CLI 를 깔린 것으로 말한다. refresh 에서도 없으면 만든다. */
  installedByRecord?: boolean;
  /** 첫 접촉 블록 모델의 앞 기록(`SharedRecord`). */
  shared?: SharedRecord;
  journal?: WriteJournal;
  /**
   * 옛 Antigravity 앵커(`.agents/rules/uzys-harness.md`)에 설치자가 채운 Project Context — 배너를 붙여 둔 씨
   * (`readLegacyAntigravityContext`). 없거나 안 채웠으면 `null`. 루트 `CLAUDE.md` 씨 다음 순위다(ADR-103).
   */
  legacyContext?: string | null;
}

export interface AgentsMdTransformReport {
  agentsMdPath: string;
  /** 쓴 모델과 결과 — 블록 모델이면 `shared` 가 화면 · 기록(`portions`)의 원천이다. */
  agentsMd: AgentsMdWriteResult;
  /**
   * #528 — 이 실행이 다른 앵커의 설치자 절을 옮겨 심었으면 그 출처 파일명(`CLAUDE.md` 또는 옛 Antigravity 앵커).
   * 안 심었으면 `null`. 화면이 "옮겼다" 를 말하는 근거이고, 앵커 은퇴가 "옮겼다/안 옮겼다" 를 가르는 근거다.
   */
  agentsMdSeededFrom: string | null;
  /** 이번 렌더의 집합(정렬) — 화면이 이름을 댄다. */
  clis: AgentsMdCli[];
  ownership: OwnedWriteResult;
}

/** 옛 Antigravity 앵커 — 은퇴 대상(ADR-103). 씨의 출처 이름으로도 쓴다. */
export const LEGACY_ANTIGRAVITY_ANCHOR = ".agents/rules/uzys-harness.md";

export function runAgentsMdTransform(params: AgentsMdTransformParams): AgentsMdTransformReport {
  const { harnessRoot, projectDir, baseline, shared = {} } = params;
  const refreshOnly = params.refreshOnly === true;
  const clis = agentsMdClis(params.clis);
  const writer = createOwnedWriter(projectDir, baseline, {
    refreshOnly,
    ...(params.journal === undefined ? {} : { journal: params.journal }),
  });
  const claudeMd = readRequired(join(harnessRoot, "templates/CLAUDE.md"));
  const template = readRequired(join(harnessRoot, AGENTS_MD_TEMPLATE));
  // 상시 스킬 안내는 세 변환이 스킬 자리에 쓰는 목록과 같아야 한다 — 같은 함수 · 같은 입력(결정론적).
  const { skillIds } = agentsSkillSlot({
    projectDir,
    selectedInternalSkills: params.selectedInternalSkills,
    refreshOnly,
    writer,
  });

  const agentsMdPath = join(projectDir, "AGENTS.md");
  const exists = existsSync(agentsMdPath);
  const creates = !exists && (!refreshOnly || params.installedByRecord === true);
  const legacy = params.legacyContext ?? null;
  // #528 — **새로 만드는 순간에만** 루트 `CLAUDE.md` 의 설치자 절을 옮겨 심는다. 옛 Antigravity 앵커의 글은 그 다음
  // 순위이고, 이미 있는 파일이라도 `## Project Context` 가 손대지 않은 스캐폴드면 그 절을 그 글로 바꾼다(ADR-103 —
  // 앵커 은퇴의 한 번뿐인 이관). 채워진 파일은 건드리지 않는다(두 문장을 합치지 않는다 — ADR-096 D7).
  const fromRoot = creates ? seedAgentsMdProjectContext(projectDir) : null;
  const seed = fromRoot ?? legacy;
  const seededFrom =
    fromRoot !== null ? "CLAUDE.md" : legacy !== null ? LEGACY_ANTIGRAVITY_ANCHOR : null;
  ensureDir(projectDir);
  const rendered = renderAgentsMd({
    template,
    claudeMd,
    projectName: basename(projectDir),
    // ADR-085 — 상시 스킬 안내는 앵커가 아니라 프로젝트 맥락에, 깔린 것만(#503 — 설치자 절 안이라 마커로 감싼다).
    projectContext: withMarkedContinuousSkillsNote(
      seed ?? renderFillScaffold("agents-md"),
      skillIds,
    ),
    harnessRules: renderRulesBlock(portRules(harnessRoot, params.rules)),
    clis,
  });
  const diskBefore = exists ? readFileSync(agentsMdPath, "utf8") : null;
  const agentsMd = writeAgentsMd({
    projectDir,
    rendered,
    template,
    anchorTitle: anchorTitle(claudeMd),
    writer,
    baseline,
    record: shared,
    refreshOnly,
    ...(params.installedByRecord === true ? { createInRefresh: true } : {}),
    ...(legacy !== null && fromRoot === null ? { replaceUnfilledContext: true } : {}),
    harnessRuleHeadings: ruleHeadings(harnessRoot),
  });
  return {
    agentsMdPath,
    agentsMd,
    agentsMdSeededFrom:
      seededFrom === null ? null : seededInto(agentsMdPath, diskBefore, seed, seededFrom),
    clis,
    ownership: writer.result(),
  };
}

/**
 * 씨가 실제로 들어갔는가 — 파일을 새로 만들었거나(절 모델) 손대지 않은 절을 바꿨으면 디스크에 씨 본문이 있다.
 * 채워진 절을 이어받았거나 블록 모델(설치자 파일 — 설치자 절이 없다)이면 없다. 판정을 쓰기 경로에 다시 두지 않고
 * 결과 바이트로 본다 — 화면의 "옮겼다" 가 거짓이 될 수 없다. 씨 = 배너 + 빈 줄 + 본문(`compose`).
 */
function seededInto(
  path: string,
  before: string | null,
  seed: string | null,
  from: string,
): string | null {
  if (seed === null || !existsSync(path)) return null;
  const after = readFileSync(path, "utf8");
  const body = renameSlashes(seed.slice(seed.indexOf("\n\n") + 2));
  return after !== before && after.includes(body) ? from : null;
}

function readRequired(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`AGENTS.md transform: required source missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

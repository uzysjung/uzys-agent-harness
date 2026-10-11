/**
 * OpenCode transform orchestrator — SSOT (templates/CLAUDE.md, 하네스 MCP 서버) →
 * OpenCode 자산.
 *
 * Inputs:
 *   - harnessRoot:  harness root (templates/) — 저장소 루트 또는 npm 패키지 루트
 *   - mcp:          하네스 MCP 서버 (`renderHarnessMcp` — 템플릿 + 트랙 표, #568)
 *   - projectDir:   target project to receive opencode.json + .agents/skills/
 *
 * Outputs (under projectDir):
 *   - opencode.json
 *   - .agents/skills/<id>/** (dev-method skills 디렉터리 전체 — codex·antigravity 와 같은 자리)
 *
 * `AGENTS.md` 는 여기서 쓰지 않는다 — 세 CLI 공용 렌더 주체(`agents-md-transform.ts`)가 깔린 집합으로 쓴다(#642).
 *
 * SPEC: docs/specs/opencode-compat.md
 * Phase: C1 (transform orchestrator)
 */

import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { agentsSkillSlot } from "../agents-skill-targets.js";
import { writeBundledSkillDirs } from "../codex/skills.js";
import { backupFile, ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { createOwnedWriter, type OwnedWriteResult, type WriteJournal } from "../owned-write.js";
import { type SharedRecord, type SharedWriteResult, writeShared } from "../shared-write.js";
import { renderOpencodeJson, renderOpencodeMcp } from "./opencode-json.js";

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
  /**
   * #568 — 이 설치의 하네스 MCP 서버(`cli-transforms.ts` `renderHarnessMcp` — 템플릿 + 트랙 표).
   * 예전에는 하네스 루트의 `.mcp.json` 을 읽었는데 그 파일은 npm 패키지에 없다. **required** —
   * 호출부가 빠뜨리면 조용히 빈 목록이 되는 것이 바로 그 버그의 형태였다.
   */
  mcp: McpJson;
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
  /**
   * #551 (ADR-097) — 함께 쓰는 파일(`opencode.json`)의 앞 기록(`shared-write.ts`
   * `SharedRecord`). 생략 = 몫 기록 없음 — 하네스 키를 갈아 끼우지 않고 남긴다.
   */
  shared?: SharedRecord;
  /** #600 — 쓰는 즉시 받아 적을 곳(install 의 중단 기록). */
  journal?: WriteJournal;
}

export interface OpencodeTransformReport {
  opencodeJsonPath: string;
  /**
   * #563 — `opencode.json` 에 하네스 몫(`mcp.<name>`)만 쓴 결과. optional = 손으로 만드는 테스트 stub 이 여럿이다 —
   * 부재는 "알릴 것 없음".
   */
  opencodeJson?: SharedWriteResult;
  /**
   * `.agents/skills/<id>/` 에 쓴 **모든** 파일 — codex·antigravity 와 같은 자리(같은 파일)다.
   * #431 이후 `SKILL.md` 의 형제(references/scripts 등)도 함께 들어온다.
   */
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
    mcp,
    baseline,
    refreshOnly,
    shared = {},
  } = params;
  const writer = createOwnedWriter(projectDir, baseline, {
    refreshOnly: refreshOnly ?? false,
    ...(params.journal === undefined ? {} : { journal: params.journal }),
  });

  const opencodeTemplate = readRequired(
    join(harnessRoot, "templates/opencode/opencode.json.template"),
  );
  // #531 (Epic #527 S3) — `update` 가 **새 릴리즈의 번들 스킬도** 이 CLI 자리에 깐다.
  // 호출부(`selectedInternalSkills`)는 update 에서 "디스크에 있는 스킬"만 넘기므로 어느 자리에도
  // 없는 스킬은 목록에 아예 없다. 대상 집합·생성 허가는 세 transform 공용 모듈이 정한다.
  const { skillIds, skillWriter } = agentsSkillSlot({
    projectDir,
    selectedInternalSkills,
    refreshOnly: refreshOnly ?? false,
    writer,
  });

  ensureDir(projectDir);

  // 1. opencode.json — 함께 쓰는 파일(#563 · ADR-097 §6.2 `json-keys`): 하네스 MCP 키(`mcp.<name>`)만 upsert 한다.
  //    템플릿의 나머지 키는 파일을 새로 만들 때만 바탕(seed)으로 깔린다.
  const opencodeJsonPath = join(projectDir, OPENCODE_JSON);
  const render = renderOpencodeMcp(mcp);
  const opencodeJson = writeShared({
    projectDir,
    path: OPENCODE_JSON,
    render,
    record: shared,
    baseline,
    writer,
    refreshOnly: refreshOnly ?? false,
    seed: renderOpencodeJson({ template: opencodeTemplate }),
  });

  // 2. dev-method skills → `.agents/skills/<id>/SKILL.md` (ADR-081).
  //
  //   실측 2026-08-29 (`opencode 1.18.23`, 컨테이너, 대조군 포함): OpenCode 는 프로젝트
  //   스코프 `.agents/skills/<id>/SKILL.md` 를 **자동 로드**하고, 그렇게 실린 스킬이
  //   커맨드 목록에도 `source: "skill"` 로 함께 뜬다. 즉 슬래시 호출을 잃지 않으면서
  //   모델이 description 을 보고 스스로 부를 수 있게 된다.
  //
  //   codex·antigravity 와 **같은 파일**이다. 셋이 한 벌을 공유하므로 조합 설치에서
  //   같은 스킬이 두 판본으로 깔리는 일이 없다 — 그것이 #340 의 형태였다.
  //
  //   2026-09-13 (#431) — `SKILL.md` 한 파일이 아니라 디렉터리 전체를 보낸다. 루프는 세
  //   transform 공용 helper 가 소유한다.
  //
  //   #531 — `skillWriter` 가 refreshOnly 에서도 **대상 집합의 자리만** 만들게 한다
  //   (증거·범위는 `agents-skill-targets.ts`).
  const skillFiles = writeBundledSkillDirs({
    harnessRoot,
    projectDir,
    skillIds,
    writer: skillWriter,
  });

  // 3. 옛 커맨드 사본 은퇴. 안 지우면 OpenCode 커맨드 목록에 같은 이름이 **두 줄**로 뜬다
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
      // #678 — 실체가 프로젝트 밖이면(`.opencode/commands` → dotfiles 등) 지우지도 백업하지도 않는다.
      if (writer.skipOutside(victim)) continue;
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
    opencodeJsonPath,
    opencodeJson,
    skillFiles,
    retiredCommands,
    ownership: writer.result(),
  };
}

const OPENCODE_JSON = "opencode.json";

function readRequired(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`OpenCode transform: required source missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

/**
 * Codex transform orchestrator — wraps the 5-step pipeline.
 *
 * Replaces `scripts/claude-to-codex.sh` (Phase D, OQ4 = TS port).
 *
 * Inputs:
 *   - harnessRoot:  harness root (templates/) — 저장소 루트 또는 npm 패키지 루트
 *   - mcp:          하네스 MCP 서버 (`renderHarnessMcp` — 템플릿 + 트랙 표, #568)
 *   - projectDir:   target project to receive AGENTS.md + .codex/ + .agents/skills/
 *
 * Outputs (under projectDir):
 *   - AGENTS.md
 *   - .codex/config.toml
 *   - .codex/hooks/*.sh              (hooks ported from templates/hooks/)
 *   - .agents/skills/<id>/**         (dev-method skills — SKILL.md frontmatter 보존 + 형제 파일, #431)
 *
 * v0.6.4 — skill 출력 경로는 Codex 공식 표준 `.agents/skills/<name>/SKILL.md` (repo-level scope).
 *   참조: https://developers.openai.com/codex/skills
 */

import { chmodSync, existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { ADAPTERS } from "../adapters/index.js";
import { anchorTitle, withMarkedContinuousSkillsNote } from "../agents-md-merge.js";
import { agentsSkillSlot } from "../agents-skill-targets.js";
import { seedAgentsMdProjectContext } from "../anchor-seed.js";
import { ensureDir } from "../fs-ops.js";
import type { McpJson } from "../mcp-merge.js";
import { createOwnedWriter, type OwnedWriteResult, type OwnedWriter } from "../owned-write.js";
import { renderFillScaffold } from "../project-claude-merge.js";
import { portRules, renderRulesBlock } from "../rules-port.js";
import {
  type AgentsMdWriteResult,
  type SharedRecord,
  type SharedWriteResult,
  writeAgentsMd,
  writeShared,
} from "../shared-write.js";
import { renderAgentsMd } from "./agents-md.js";
import { configRegions, isChangedLegacyConfig, renderConfigToml } from "./config-toml.js";
import { writeBundledSkillDirs } from "./skills.js";

export interface CodexTransformParams {
  harnessRoot: string;
  projectDir: string;
  /**
   * v26.87.0 — dev-method skill ids 선택 목록 (installer 가 `DEV_METHOD_SKILL_IDS` 를
   * `isAssetSelected` 로 필터). 각 id 의 `templates/skills/<id>/` 를 Codex native
   * `.agents/skills/<id>/` 로 (SKILL.md frontmatter 보존) 출력 — #431 이후 디렉터리 전체다.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
  /** 2026-08-12 — 이 설치의 배포 룰 이름들. Codex 는 룰 디렉터리가 없어 AGENTS.md 본문에 embed 한다. */
  rules?: ReadonlyArray<string>;
  /**
   * #568 — 이 설치의 하네스 MCP 서버(`cli-transforms.ts` `renderHarnessMcp` — 템플릿 + 트랙 표).
   * 예전에는 하네스 루트의 `.mcp.json` 을 읽었는데 그 파일은 npm 패키지에 없다. **required** —
   * 호출부가 빠뜨리면 조용히 빈 목록이 되는 것이 바로 그 버그의 형태였다.
   */
  mcp: McpJson;
  /**
   * v26.133.0 (ADR-048) — 설치 시점 기준선 (install log `externalFiles`).
   *
   * **required 로 둔다.** 옵셔널이면 호출부 하나가 안 넘겨도 컴파일이 통과하고, 그 경로만
   * 조용히 판정 불가로 떨어져 사용자에게 매 설치마다 백업이 쌓인다. 기준선이 없는 상황
   * (레거시 설치)은 빈 Map 을 **명시적으로** 넘겨서 표현한다.
   */
  baseline: ReadonlyMap<string, string>;
  /**
   * v26.134.0 (ADR-049) — `update` 경로. 이미 있는 산출물만 갱신하고 없는 것은 만들지 않는다.
   * 그래서 codex 를 안 깐 프로젝트에서 이 transform 을 돌려도 `.codex/` 가 생기지 않는다.
   */
  refreshOnly?: boolean;
  /**
   * #550 — 이 실행에서 `AGENTS.md` 를 쓰는가. 기본 `true`.
   *
   * opencode 가 **같은 실행에서** 같은 파일을 자기 템플릿으로 쓸 때만 `false` 다(`cli-transforms.ts`).
   * 둘 다 쓰면 디스크에는 늘 opencode 판이 남고, 다음 실행의 codex 가 그 판을 자기 판으로 바꾸려
   * 든다 — 설치자가 Project Context 를 고친 파일이면 그 쓰기가 백업을 남긴다(편집마다 1건).
   */
  writeAgentsMd?: boolean;
  /**
   * #551 (ADR-097) — 함께 쓰는 파일(`.codex/config.toml` · 첫 접촉 `AGENTS.md`)의 앞 기록(`shared-write.ts`
   * `SharedRecord`). 생략 = 몫 기록 없음 — 하네스 구간을 갈아 끼우지 않고 남긴다.
   */
  shared?: SharedRecord;
}

export interface CodexTransformReport {
  agentsMdPath: string;
  /**
   * #528 — 이 실행이 `AGENTS.md` 를 **새로 만들면서** 다른 앵커의 설치자 절을 옮겨 심었으면
   * 그 출처 파일명. 안 심었으면 `null`. 화면이 "옮겼다 · 표현은 스킬로 맞춰라"를 말하는 근거다.
   *
   * optional = **부재는 "안 심었다"** 로 읽는다. 이 리포트를 손으로 만드는 자리(테스트 stub)가
   * 여럿이고, 그쪽에 새 필드를 강제해도 얻는 것이 없다 — 틀리는 방향이 안전한 쪽이다.
   */
  agentsMdSeededFrom?: string | null;
  configTomlPath: string;
  /**
   * #563 — `.codex/config.toml` 에 하네스 몫(구간 둘)만 쓴 결과. 화면 · 기록(`portions`)이 읽는다.
   * optional = `agentsMdSeededFrom` 과 같은 이유(손으로 만드는 테스트 stub) — 부재는 "알릴 것 없음" 으로 읽는다.
   */
  configToml?: SharedWriteResult;
  /** #558 — `AGENTS.md` 를 이 실행에서 썼으면 그 모델과 결과. 안 썼으면(opencode 가 쓴다) `null` · 부재. */
  agentsMd?: AgentsMdWriteResult | null;
  hookFiles: string[];
  /** `.agents/skills/<id>/` 에 쓴 **모든** 파일 — `SKILL.md` + 형제(references/scripts 등, #431). */
  skillFiles: string[];
  /** v26.133.0 (ADR-048) — 소유권 결과 (기준선 · 백업된 사용자 편집분). */
  ownership: OwnedWriteResult;
}

const HOOK_NAMES = ["session-start"];

const ENV_VAR_RENAME = /CLAUDE_PROJECT_DIR/g;

export function runCodexTransform(params: CodexTransformParams): CodexTransformReport {
  const {
    harnessRoot,
    projectDir,
    selectedInternalSkills = [],
    rules = [],
    mcp,
    baseline,
    refreshOnly,
    writeAgentsMd: writesAgentsMd = true,
    shared = {},
  } = params;
  const writer = createOwnedWriter(projectDir, baseline, { refreshOnly: refreshOnly ?? false });

  const claudeMd = readRequired(join(harnessRoot, "templates/CLAUDE.md"));
  const agentsTemplate = readRequired(join(harnessRoot, "templates/codex/AGENTS.md.template"));
  const configTemplate = readRequired(join(harnessRoot, "templates/codex/config.toml.template"));
  const projectName = basename(projectDir);

  // #530 (Epic #527 S3) — `update` 가 **새 릴리즈의 번들 스킬도** 이 CLI 자리에 깐다. 대상
  // 집합·생성 허가는 세 transform 공용 모듈이 정한다 — opencode 와 같은 `AGENTS.md` 를 쓰므로
  // 둘이 같은 목록을 받아야 상시 안내가 갈리지 않는다.
  const { skillIds, skillWriter } = agentsSkillSlot({
    projectDir,
    selectedInternalSkills,
    refreshOnly: refreshOnly ?? false,
    writer,
  });

  // 1. AGENTS.md — #550 opencode 가 같은 실행에서 쓰면 건너뛴다(`writeAgentsMd` 주석).
  const agentsMdPath = join(projectDir, "AGENTS.md");
  // #528 — **새로 만드는 순간에만** 다른 앵커의 설치자 절을 옮겨 심는다. 이미 있으면 그 파일의
  // 설치자 절이 이기고(`mergeAgentsMd`), refreshOnly(update)는 없는 파일을 만들지 않는다.
  const seededContext =
    !writesAgentsMd || refreshOnly || existsSync(agentsMdPath)
      ? null
      : seedAgentsMdProjectContext(projectDir);
  ensureDir(projectDir);
  let agentsMd: AgentsMdWriteResult | null = null;
  if (writesAgentsMd) {
    const agentsMdOut = renderAgentsMd({
      template: agentsTemplate,
      claudeMd,
      projectName,
      // ADR-085 — 상시 스킬 안내는 앵커가 아니라 여기(프로젝트 맥락)에, 깔린 것만.
      // #503 — 그 조각은 설치자 소유 절 안에 사니 마커로 감싼다.
      // #530 — `skillIds` 를 쓴다(= 깔린 것 + **이번 실행이 만들 것**).
      projectContext: withMarkedContinuousSkillsNote(
        seededContext ?? renderFillScaffold("agents-md"),
        skillIds,
      ),
      // Codex 는 룰 디렉터리가 없다 — 룰이 AGENTS.md 본문에 들어가야 도달한다(§Harness Rules).
      harnessRules: renderRulesBlock(portRules(harnessRoot, rules)),
    });
    // 하네스가 만든 파일은 절 모델(#503 — 설치자 절은 이어받고 하네스 절만 최신판, owned-write 가 기준선),
    // 기록에 없는 설치자 파일은 첫 접촉 블록 모델(#558 — 본문 그대로 + 파일 끝 블록 하나). 판정 = `agentsMdModel`.
    agentsMd = writeAgentsMd({
      projectDir,
      rendered: agentsMdOut,
      template: agentsTemplate,
      anchorTitle: anchorTitle(claudeMd),
      writer,
      baseline,
      record: shared,
      refreshOnly: refreshOnly ?? false,
    });
  }

  // 2. .codex/config.toml — 함께 쓰는 파일(#563 · ADR-097 §6.2 `toml-region`): 하네스 몫 구간 둘만 upsert 한다.
  const configTomlPath = join(projectDir, CONFIG_TOML);
  const configToml = writeConfigToml({
    projectDir,
    regions: configRegions(
      renderConfigToml({ template: configTemplate, projectName, projectDir, mcp }),
    ),
    baseline,
    writer,
    record: shared,
    refreshOnly: refreshOnly ?? false,
  });

  // 3. .codex/hooks/session-start.sh
  const hookDir = join(projectDir, ".codex/hooks");
  const hookFiles: string[] = [];
  for (const hook of HOOK_NAMES) {
    const src = join(harnessRoot, "templates/hooks", `${hook}.sh`);
    if (!existsSync(src)) {
      continue;
    }
    const ported = readFileSync(src, "utf8").replace(ENV_VAR_RENAME, "CODEX_PROJECT_DIR");
    const target = join(hookDir, `${hook}.sh`);
    // refresh 모드가 건너뛴 경로에는 파일이 없다 — chmod 를 무조건 걸면 ENOENT 로 터진다.
    if (!writer.write(target, ported)) continue;
    chmodSync(target, 0o755);
    hookFiles.push(target);
  }

  // 4. v26.87.0 — dev-method skills → .agents/skills/<id>/ (frontmatter 보존).
  //   renderBundledSkill 이 source frontmatter(name: <id>)를 그대로 보존하고 body 만 포팅.
  //   2026-09-13 (#431) — `SKILL.md` 한 파일이 아니라 **디렉터리 전체**다. 루프는 세 transform
  //   공용 helper 가 소유한다(사본 셋이면 다음 수정이 또 하나를 빠뜨린다).
  //   #530 — `skillWriter` 가 refreshOnly 에서도 **대상 집합의 자리만** 만들게 한다
  //   (증거·범위는 `agents-skill-targets.ts`).
  const skillFiles = writeBundledSkillDirs({
    harnessRoot,
    projectDir,
    skillIds,
    writer: skillWriter,
  });

  return {
    agentsMdPath,
    agentsMdSeededFrom: seededContext === null ? null : "CLAUDE.md",
    configTomlPath,
    configToml,
    agentsMd,
    hookFiles,
    skillFiles,
    ownership: writer.result(),
  };
}

const CONFIG_TOML = ".codex/config.toml";

/** 옛 판이 통째로 쓴 파일이 그 뒤 바뀌었다 — 쓰지 않는다(`isChangedLegacyConfig`). */
const LEGACY_CHANGED =
  "written by an earlier harness version and changed since — left as is; harness part not added";

/**
 * `.codex/config.toml` — 몫(구간 둘)만 쓴다(`writeShared`). 예외 하나: 옛 판이 통째로 쓴 파일이 그 뒤 바뀌었으면
 * 쓰지 않는다(`isChangedLegacyConfig`).
 */
function writeConfigToml(args: {
  projectDir: string;
  regions: ReadonlyMap<string, string>;
  baseline: ReadonlyMap<string, string>;
  writer: OwnedWriter;
  record: SharedRecord;
  refreshOnly: boolean;
}): SharedWriteResult {
  const abs = join(args.projectDir, CONFIG_TOML);
  const disk = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  const regions = disk === null ? null : ADAPTERS["toml-region"].read(disk);
  // 못 읽는 파일(`null`)은 판정 함수가 "한 바이트도 안 쓴다" 로 낸다 — 여기서는 읽히고 구간이 없는 파일만 가른다
  if (
    disk !== null &&
    regions?.size === 0 &&
    isChangedLegacyConfig(disk, args.baseline.get(CONFIG_TOML))
  ) {
    return {
      path: CONFIG_TOML,
      action: "left",
      line: LEGACY_CHANGED,
      kept: [],
      portions: null,
      deleted: [],
      deletedFile: false,
    };
  }
  return writeShared({
    projectDir: args.projectDir,
    path: CONFIG_TOML,
    render: args.regions,
    record: args.record,
    baseline: args.baseline,
    writer: args.writer,
    refreshOnly: args.refreshOnly,
  });
}

function readRequired(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Codex transform: required source missing: ${path}`);
  }
  return readFileSync(path, "utf8");
}

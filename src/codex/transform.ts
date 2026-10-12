/**
 * Codex transform orchestrator — wraps the 5-step pipeline.
 *
 * Replaces `scripts/claude-to-codex.sh` (Phase D, OQ4 = TS port).
 *
 * Inputs:
 *   - harnessRoot:  harness root (templates/) — 저장소 루트 또는 npm 패키지 루트
 *   - mcp:          하네스 MCP 서버 (`renderHarnessMcp` — 템플릿 + 트랙 표, #568)
 *   - projectDir:   target project to receive .codex/ + .agents/skills/
 *
 * `AGENTS.md` 는 여기서 쓰지 않는다 — 세 CLI 공용 렌더 주체(`agents-md-transform.ts`)가 깔린 집합으로 쓴다(#642).
 *
 * Outputs (under projectDir):
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
import { agentsSkillSlot } from "../agents-skill-targets.js";
import type { McpJson } from "../mcp-merge.js";
import {
  createOwnedWriter,
  type OwnedWriteResult,
  type OwnedWriter,
  type WriteJournal,
} from "../owned-write.js";
import { type SharedRecord, type SharedWriteResult, writeShared } from "../shared-write.js";
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
   * #551 (ADR-097) — 함께 쓰는 파일(`.codex/config.toml`)의 앞 기록(`shared-write.ts`
   * `SharedRecord`). 생략 = 몫 기록 없음 — 하네스 구간을 갈아 끼우지 않고 남긴다.
   */
  shared?: SharedRecord;
  /** #600 — 쓰는 즉시 받아 적을 곳(install 의 중단 기록). */
  journal?: WriteJournal;
  /** #761 B-1 — 기준선 밖이어도 기록이 하네스 것이라 말하는 경로(`OwnedWriterOptions.owned`). */
  owned?: (rel: string) => boolean;
}

export interface CodexTransformReport {
  configTomlPath: string;
  /**
   * #563 — `.codex/config.toml` 에 하네스 몫(구간 둘)만 쓴 결과. 화면 · 기록(`portions`)이 읽는다.
   * optional = 이 리포트를 손으로 만드는 테스트 stub 이 여럿이다 — 부재는 "알릴 것 없음" 으로 읽는다.
   */
  configToml?: SharedWriteResult;
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
    mcp,
    baseline,
    refreshOnly,
    shared = {},
  } = params;
  const writer = createOwnedWriter(projectDir, baseline, {
    refreshOnly: refreshOnly ?? false,
    ...(params.journal === undefined ? {} : { journal: params.journal }),
    ...(params.owned === undefined ? {} : { owned: params.owned }),
  });

  const configTemplate = readRequired(join(harnessRoot, "templates/codex/config.toml.template"));
  const projectName = basename(projectDir);

  // #530 (Epic #527 S3) — `update` 가 **새 릴리즈의 번들 스킬도** 이 CLI 자리에 깐다. 대상
  // 집합·생성 허가는 세 transform 공용 모듈이 정한다 — `AGENTS.md` 의 상시 안내도 같은 모듈로 렌더된다.
  const { skillIds, skillWriter } = agentsSkillSlot({
    projectDir,
    selectedInternalSkills,
    refreshOnly: refreshOnly ?? false,
    writer,
  });

  // 1. .codex/config.toml — 함께 쓰는 파일(#563 · ADR-097 §6.2 `toml-region`): 하네스 몫 구간 둘만 upsert 한다.
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

  // 2. .codex/hooks/session-start.sh
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

  // 3. v26.87.0 — dev-method skills → .agents/skills/<id>/ (frontmatter 보존).
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
    configTomlPath,
    configToml,
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
      leftAsIs: [],
      portions: null,
      restored: [],
      added: [],
      missing: [],
      removedOut: [],
      removedEdited: [],
      keptOut: [],
      replaced: false,
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

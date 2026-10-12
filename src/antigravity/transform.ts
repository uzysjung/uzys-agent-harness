/**
 * Antigravity transform — v26.66.0 (skills/workflows) + v26.69.0 (rules).
 *
 * Google Antigravity 공식 spec (https://antigravity.google/docs/rules, 확인 2026-10-11):
 *   - Workspace skills:    .agents/skills/<name>/SKILL.md       (Anthropic skill format — codex 와 공유)
 *   - Workspace rules:     .agents/rules/<name>.md              (**YAML frontmatter 의 `trigger` 필수** — 없으면
 *                                                               Antigravity 가 조용히 버린다, #631)
 *   - Workspace root:      AGENTS.md                            (frontmatter 없이 always_on — IDE · CLI 모두)
 *   - Global rules:        ~/.gemini/GEMINI.md                   (사용자 글로벌 — harness 미터치)
 *
 * 본 transform 의 책임 (모두 project-scope):
 *   1. `.agents/rules/<룰>.md` — 배포 룰. frontmatter 를 붙여 쓴다(Claude `paths:` 가 있던 룰은 `trigger: glob`).
 *   2. `.agents/skills/<id>/**` — dev-method skills 디렉터리 전체 (frontmatter 보존, codex 와 공유).
 *
 * 원칙·프로젝트 맥락(앵커)은 여기서 쓰지 않는다 — 루트 `AGENTS.md` 를 세 CLI 공용 렌더 주체
 * (`agents-md-transform.ts`)가 깔린 집합으로 쓴다(ADR-103). 옛 앵커 `.agents/rules/uzys-harness.md` 의 은퇴는
 * `retire-anchor.ts` 가 맡는다.
 *
 * SAFETY: `~/.gemini/` 글로벌 write 없음.
 */

import { join } from "node:path";
import { agentsSkillSlot } from "../agents-skill-targets.js";
import { writeBundledSkillDirs } from "../codex/skills.js";
import { createOwnedWriter, type OwnedWriteResult, type WriteJournal } from "../owned-write.js";
import { type PortedRule, portRules } from "../rules-port.js";

export interface AntigravityTransformParams {
  /** harness root (templates/ 위치). */
  harnessRoot: string;
  /** 사용자 프로젝트 root. `.agents/` 가 만들어질 위치. */
  projectDir: string;
  /**
   * v26.87.0 — dev-method skill ids 선택 목록. 각 id 의 `templates/skills/<id>/` 를
   * Antigravity native `.agents/skills/<id>/` 로 (SKILL.md frontmatter 보존) 출력.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
  /** 2026-08-12 — 이 설치의 배포 룰 이름들. `.agents/rules/<name>.md` 로 나간다. */
  rules?: ReadonlyArray<string>;
  /**
   * v26.133.0 (ADR-048) — 설치 시점 기준선 (install log `externalFiles`).
   * codex/opencode 와 같은 이유로 **required**. 레거시는 빈 Map 을 명시적으로 넘긴다.
   */
  baseline: ReadonlyMap<string, string>;
  /**
   * v26.134.0 (ADR-049) — `update` 경로. 이미 있는 산출물만 갱신하고 없는 것은 만들지 않는다.
   * antigravity 를 안 깐 프로젝트에서 돌려도 `.agents/rules/` 가 생기지 않는다.
   */
  refreshOnly?: boolean;
  /** #600 — 쓰는 즉시 받아 적을 곳(install 의 중단 기록). */
  journal?: WriteJournal;
  /** #761 B-1 — 기준선 밖이어도 기록이 하네스 것이라 말하는 경로(`OwnedWriterOptions.owned`). */
  owned?: (rel: string) => boolean;
  /**
   * ADR-099 R2 (#584) — 설치 기록(`installedClis`)이 Antigravity 를 깔린 CLI 로 말한다. refresh 모드에서 룰을
   * **없어도 만드는** 근거다 — 디스크 존재가 아니라 기록이 정한다.
   */
  installedByRecord?: boolean;
}

export interface AntigravityTransformReport {
  /** 2026-08-12 — 작성된 배포 룰 경로 (.agents/rules/<name>.md). */
  harnessRuleFiles: string[];
  /**
   * `.agents/skills/<id>/` 에 쓴 **모든** 파일 경로 — `SKILL.md` + 형제(references/scripts 등).
   * #431 이전에는 `SKILL.md` 하나뿐이었다.
   */
  skillFiles: ReadonlyArray<string>;
  /** v26.133.0 (ADR-048) — 소유권 결과 (기준선 · 백업된 사용자 편집분). */
  ownership: OwnedWriteResult;
}

/**
 * #631 — Antigravity 워크스페이스 룰의 frontmatter. 공식 문서: "Every `.md` file inside `rules/` must start with YAML
 * frontmatter declaring a valid `trigger`" — 없으면 조용히 버린다. Claude `paths:` 가 있던 룰은 같은 뜻의 `glob`
 * (`globs` 는 쉼표 구분, `*` 로 시작하는 패턴이라 큰따옴표), 나머지는 매 턴 상주(`always_on`) — 룰은 대원칙 층이다
 * (ADR-071). `description` 은 넣지 않는다(권장일 뿐이고 룰마다 새 문장을 쓰는 것은 자산 본문 변경이다).
 */
export function antigravityFrontmatter(rule: Pick<PortedRule, "paths">): string {
  if (rule.paths.length === 0) return "---\ntrigger: always_on\n---\n\n";
  return `---\ntrigger: glob\nglobs: "${rule.paths.join(", ")}"\n---\n\n`;
}

/**
 * Antigravity 용 project-scope 자산 생성 (rules + dev-method skills).
 */
export function runAntigravityTransform(
  params: AntigravityTransformParams,
): AntigravityTransformReport {
  const {
    harnessRoot,
    projectDir,
    selectedInternalSkills = [],
    rules = [],
    baseline,
    refreshOnly,
  } = params;
  const writer = createOwnedWriter(projectDir, baseline, {
    refreshOnly: refreshOnly ?? false,
    ...(params.journal === undefined ? {} : { journal: params.journal }),
    ...(params.owned === undefined ? {} : { owned: params.owned }),
  });

  // 0. #532 (Epic #527 S3) — 새 릴리즈가 더한 번들 스킬(또는 설치자가 지운 자리)을 이 CLI 의
  //   스킬 자리에도 깐다. 대상 집합·생성 허가는 codex·opencode 와 **같은 모듈**이 정한다 —
  //   세 CLI 가 같은 `.agents/skills/` 를 쓰므로 판정이 셋이면 한 update 안에서 갈린다.
  const { skillIds, skillWriter } = agentsSkillSlot({
    projectDir,
    selectedInternalSkills,
    refreshOnly: refreshOnly ?? false,
    writer,
  });

  // 1. 2026-08-12 — 배포 룰을 워크스페이스 룰 디렉터리에 놓는다(파일 하나 24,000 bytes 상한 — 배포 룰은 전부 그 아래다).
  //   #631 — frontmatter 를 붙인다. 이전 판은 본문만 써서 Antigravity 가 일곱 파일을 전부 버렸다.
  //   `createInRefresh` 의 근거는 **설치 기록**이다(ADR-099 R2 · #584) — 앵커 존재를 근거로 쓰던 경로는 앵커와 함께
  //   은퇴했다(ADR-103). 기록이 없는 옛 설치본은 update 진입 판정(#699)이 먼저 거절한다.
  const antigravityInstalled = params.installedByRecord === true;
  const harnessRuleFiles: string[] = [];
  for (const rule of portRules(harnessRoot, rules)) {
    const target = join(projectDir, ".agents", "rules", `${rule.name}.md`);
    const content = `${antigravityFrontmatter(rule)}${rule.body}\n`;
    if (!writer.write(target, content, { createInRefresh: antigravityInstalled })) {
      continue;
    }
    harnessRuleFiles.push(target);
  }

  // 2. v26.87.0 — dev-method skills → .agents/skills/<id>/ (frontmatter 보존).
  //   2026-09-13 (#431) — `SKILL.md` 한 파일이 아니라 디렉터리 전체다. 루프는 세 transform
  //   공용 helper 가 소유한다(codex·opencode 와 같은 산출물).
  //   #532 — `skillWriter` 가 refreshOnly 에서도 **대상 집합의 자리만** 만들게 한다.
  const skillFiles = writeBundledSkillDirs({
    harnessRoot,
    projectDir,
    skillIds,
    writer: skillWriter,
  });

  return {
    harnessRuleFiles,
    skillFiles,
    ownership: writer.result(),
  };
}

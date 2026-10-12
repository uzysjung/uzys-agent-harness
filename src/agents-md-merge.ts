/**
 * `AGENTS.md` 병합 — 설치자가 채운 절은 그대로 두고 하네스 소유분만 갱신한다 (#503).
 *
 * 루트 `CLAUDE.md` 는 `project-claude-merge.ts` 가 마커 블록만 갈아 끼우는 모델로 이미 그렇게
 * 한다. `AGENTS.md` 만 매번 통째로 렌더해 `owned-write` 에 넘겼고, 그래서 `update` 를 돌릴
 * 때마다 설치자가 채운 `## Project Context` 가 빈 스캐폴드로 되돌아갔다 — 백업에는 남지만
 * 옮겨 적는 것은 사람 몫이었다.
 *
 * 소유 경계:
 *   - `## Project Context` · `## Project Rules` = **설치자 소유**. 본문을 디스크에서 이어받는다.
 *   - 그 안의 하네스 조각만 마커로 감싸 갈아 끼운다 — `skills`(ADR-085 상시 스킬 안내) ·
 *     `anchor`(`templates/CLAUDE.md` 본문). 룰·원칙이 바뀌면 여기가 바뀌어야 update 가 산다.
 *   - 나머지(제목 · `## Harness Rules` · `## Session Start` · `## Protected Files`)는 하네스
 *     소유라 매번 최신 렌더가 자리를 차지한다.
 *
 * 절 경계는 **템플릿이 정의한 최상위 절 이름**으로만 판정한다. "다음 `## ` 까지"로 자르면
 * 안 된다 — 스캐폴드(`## Identity & Purpose` …)도 앵커(`## 1. …`)도 룰도 본문에 `## ` 를
 * 갖고 있어서, Project Context 가 첫 하위 헤딩에서 끊긴다(실측).
 */

import {
  LEGACY_AGENTS_MD_NAMED_KEYS,
  LEGACY_AGENTS_MD_PREAMBLE_KEYS,
  LEGACY_AGENTS_MD_SECTION_KEYS,
  legacyPreambleKey,
  legacySectionKey,
  RETIRED_ANCHOR_SECTION_KEYS,
} from "./legacy-fingerprints.js";
import {
  CONTINUOUS_SKILLS_HEADING,
  continuousNoteEnd,
  dropHarnessQuoteBlocks,
  isUnfilledScaffold,
  renderContinuousSkillsNote,
} from "./project-claude-merge.js";

export interface HarnessBlockMarker {
  start: string;
  end: string;
}

/** 마커 형식의 SSOT — `src/adapters/marker-md.ts` 도 이것을 쓴다(#551). */
export const marker = (name: string): HarnessBlockMarker => ({
  start: `<!-- uzys-harness:${name}:start -->`,
  end: `<!-- uzys-harness:${name}:end -->`,
});

/** `## Project Rules` 안의 하네스 앵커 본문(= `templates/CLAUDE.md`)이 사는 자리. */
export const ANCHOR_BLOCK = marker("anchor");
/** `## Project Context` 안의 상시 스킬 안내(ADR-085)가 사는 자리. */
export const SKILLS_BLOCK = marker("skills");

/**
 * #558 — 첫 접촉 `AGENTS.md`(하네스 기록에 없는 설치자 파일)의 하네스 블록 이름(설계 §6.2 `marker-md`). 루트
 * `CLAUDE.md` 의 import 블록과 같은 모델이다 — 설치자 본문은 바이트 그대로, 하네스 몫은 파일 끝의 이 블록 하나.
 */
export const AGENTS_BLOCK_NAME = "agents";
export const AGENTS_BLOCK = marker(AGENTS_BLOCK_NAME);

/** 설치자 소유 절 — 이 둘만 디스크 본문을 이어받는다. 템플릿의 절 이름과 같아야 한다. */
const CONTEXT_SECTION = "Project Context";
const RULES_SECTION = "Project Rules";
/** 하네스 소유 절 — 인라인 룰이 사는 자리(그 안의 `## ` 는 룰 제목이다). */
const HARNESS_RULES_SECTION = "Harness Rules";

/** 하네스 조각을 마커로 감싼다 — 감싸야 다음 렌더가 그 조각만 갈아 끼울 수 있다. */
export function wrapHarnessBlock(m: HarnessBlockMarker, body: string): string {
  return `${m.start}\n${body}\n${m.end}`;
}

/**
 * ADR-085 상시 스킬 안내를 **마커로 감싸** 프로젝트 맥락 뒤에 붙인다 —
 * `withContinuousSkillsNote` 의 AGENTS.md 판.
 *
 * 왜 따로 두나: 루트 `CLAUDE.md` 는 이미 자기 import 마커 블록 안에 안내를 담고 있고
 * (`project-claude-merge.ts`), Antigravity 룰 파일은 통째로 하네스 소유라 마커가 필요 없다.
 * 마커가 필요한 것은 **사용자 본문과 한 절을 나눠 쓰는** AGENTS.md 뿐이다.
 */
export function withMarkedContinuousSkillsNote(
  scaffold: string,
  selectedInternalSkills: ReadonlyArray<string>,
): string {
  const note = renderContinuousSkillsNote(selectedInternalSkills);
  return note ? `${scaffold}\n\n${wrapHarnessBlock(SKILLS_BLOCK, note)}` : scaffold;
}

/** 템플릿이 정의한 최상위 절 이름 — 경계 판정의 SSOT (열거 사본을 두지 않는다). */
function sectionNames(template: string): ReadonlySet<string> {
  return new Set([...template.matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? "").trim()));
}

/** 이 줄이 **알려진** 절의 헤딩인가. 본문 속 `## ` 는 절이 아니다. */
function headingName(line: string, names: ReadonlySet<string>): string | null {
  const name = /^## (.+?)\s*$/.exec(line.replace(/\r$/, ""))?.[1];
  return name !== undefined && names.has(name) ? name : null;
}

/** 절 본문(헤딩 다음 줄부터 다음 절 헤딩 전까지)을 줄 단위로. 절이 없으면 `null`. */
function sectionBody(text: string, names: ReadonlySet<string>, want: string): string[] | null {
  const lines = text.split("\n");
  let start = -1;
  for (const [i, line] of lines.entries()) {
    const name = headingName(line, names);
    if (name === null) continue;
    if (start === -1) {
      if (name === want) start = i;
    } else {
      return lines.slice(start + 1, i);
    }
  }
  return start === -1 ? null : lines.slice(start + 1);
}

/** 렌더 결과를 한 번만 훑으며 지정된 절의 본문을 갈아 끼운다. */
function assemble(
  rendered: string,
  names: ReadonlySet<string>,
  bodies: ReadonlyMap<string, string[]>,
): string {
  const out: string[] = [];
  let replacing = false;
  for (const line of rendered.split("\n")) {
    const name = headingName(line, names);
    if (name !== null) {
      out.push(line);
      const override = bodies.get(name);
      replacing = override !== undefined;
      if (override !== undefined) out.push(...override);
      continue;
    }
    if (!replacing) out.push(line);
  }
  return out.join("\n");
}

function blockRange(lines: ReadonlyArray<string>, m: HarnessBlockMarker): [number, number] | null {
  const start = lines.findIndex((l) => l.trim() === m.start);
  if (start === -1) return null;
  const end = lines.findIndex((l, i) => i > start && l.trim() === m.end);
  return end === -1 ? null : [start, end];
}

function trimTrailingBlanks(lines: ReadonlyArray<string>): string[] {
  const out = [...lines];
  while (out.length > 0 && (out.at(-1) ?? "").trim() === "") out.pop();
  return out;
}

/**
 * #774 — 옛 판이 바이트 그대로 쓴 `## ` 절인가: #739 앵커 절(`RETIRED_ANCHOR_SECTION_KEYS`) ∪ 마커 이전 `AGENTS.md.template` 의
 * 절(`LEGACY_AGENTS_MD_SECTION_KEYS` — `Session Start` 뒤 꼬리 절 등) ∪ 하네스 이름 절의 옛 렌더(`LEGACY_AGENTS_MD_NAMED_KEYS` —
 * `Project Rules` 머리말 · `Harness Rules` 안내 · 인라인 룰 절). 어디 있든 하네스가 쓴 것이다 — 설치자가 한 줄이라도 고쳤으면 지문이
 * 달라 설치자 절로 남는다(잃는 쪽보다 남는 쪽). 소유 근거가 아니라 걷을 근거다(ADR-111): 걷는 쓰기는 호출부가 파일 1회 백업을 남긴다.
 */
function isLegacyHarnessSection(lines: ReadonlyArray<string>): boolean {
  const key = legacySectionKey(lines);
  return (
    RETIRED_ANCHOR_SECTION_KEYS.has(key) ||
    LEGACY_AGENTS_MD_SECTION_KEYS.has(key) ||
    LEGACY_AGENTS_MD_NAMED_KEYS.has(key)
  );
}

/**
 * #774 (N2) — 첫 접촉 블록(`agents`)을 뗀 본문. v26.169 update 는 옛 하네스 `AGENTS.md`(블록 모델로 읽혔다)의 끝에 이 블록을
 * 붙였다 — 옛 파일인지는 블록 밖 본문으로 판정하고, 절 모델로 갈아탈 때도 블록 밖 본문을 이어받는다(블록 안은 렌더가 다시 쓴다).
 */
export function withoutAgentsBlock(text: string): string {
  const lines = text.split("\n");
  const at = blockRange(lines, AGENTS_BLOCK);
  if (at === null) return text;
  const head = trimTrailingBlanks(lines.slice(0, at[0]));
  const tail = lines.slice(at[1] + 1);
  while (tail.length > 0 && (tail[0] ?? "").trim() === "") tail.shift();
  return tail.length > 0 ? [...head, "", ...tail].join("\n") : `${head.join("\n")}\n`;
}

/**
 * #774 — 마커 이전 판(v26.70 ~ v26.159)의 하네스가 쓴 `AGENTS.md` 인가. 술어는 **머리 지문 하나**다 — 제목 다음 블록인용
 * (`> **Generated from** …`)이 옛 템플릿 그대로일 때만 참(`LEGACY_AGENTS_MD_PREAMBLE_KEYS`). 첫 접촉 블록이 있으면 떼고 본다(N2).
 * 절 모델 마커(`anchor` · `skills`)가 있으면 거짓 — 지금 판이 아는 파일이다. 머리를 지우거나 고친 파일은 거짓(설치자 파일로 남긴다).
 * 소유를 주장하지 않는다(ADR-111) — 이 파일을 통째로 바꾸거나 걷는 쓰기는 1회 백업을 남긴다.
 */
export function isLegacyHarnessAgentsMd(text: string): boolean {
  const body = withoutAgentsBlock(text);
  const lines = body.split("\n");
  if (blockRange(lines, ANCHOR_BLOCK) !== null || blockRange(lines, SKILLS_BLOCK) !== null) {
    return false;
  }
  const key = legacyPreambleKey(body);
  return key !== null && LEGACY_AGENTS_MD_PREAMBLE_KEYS.has(key);
}

/**
 * 설치자 본문은 그대로 두고 그 안의 하네스 조각만 최신판으로.
 *
 * @param legacyHeading 마커가 없던 시절 그 조각이 시작하던 헤딩. 옛 설치본에서 조각을 찾아
 *   걷어내는 유일한 단서다 — 없으면 조각이 두 벌 쌓인다.
 */
function refreshBlock(
  existing: ReadonlyArray<string>,
  rendered: ReadonlyArray<string>,
  m: HarnessBlockMarker,
  legacyHeading?: string,
): string[] {
  const at = blockRange(rendered, m);
  const fresh = at === null ? null : rendered.slice(at[0], at[1] + 1);
  const here = blockRange(existing, m);
  if (here !== null) {
    const head = existing.slice(0, here[0]);
    const tail = existing.slice(here[1] + 1);
    if (fresh === null) {
      const kept = trimTrailingBlanks(head);
      return tail.length > 0 ? [...kept, ...tail] : [...kept, ""];
    }
    return [...head, ...fresh, ...tail];
  }
  // 마커 없는 옛 설치본 — 헤딩으로 조각을 찾아 **조각의 끝까지만** 걷어내고 그 자리에 마커째
  // 다시 넣는다. 절 끝까지 잘라내면 설치자가 안내 *뒤*에 적어 둔 문단이 첫 update 에서 사라진다
  // (#503 독립 리뷰 B1 — 백업에는 남지만 문서는 "그대로 남는다"고 약속한다).
  const legacyAt =
    legacyHeading === undefined
      ? -1
      : existing.findIndex((l) => l.replace(/\r$/, "").trim() === legacyHeading);
  if (legacyAt === -1) {
    const kept = trimTrailingBlanks(existing);
    return fresh === null ? [...kept, ""] : [...kept, "", ...fresh, ""];
  }
  const head = trimTrailingBlanks(existing.slice(0, legacyAt));
  const tail = existing.slice(continuousNoteEnd(existing, legacyAt));
  while (tail.length > 0 && (tail[0] ?? "").trim() === "") tail.shift();
  const body = fresh === null ? [...head] : [...head, "", ...fresh];
  return tail.length > 0 ? [...body, "", ...tail] : [...body, ""];
}

/** 앵커 제목을 못 읽었을 때 — `templates/CLAUDE.md` 의 첫 줄과 같은 말. */
const ANCHOR_TITLE_FALLBACK = "Working Principles";

/** 앵커(`templates/CLAUDE.md`)의 제목 — 첫 줄 `# …`. 절 모델 렌더는 이 줄을 떼고 `## Project Rules` 아래에 둔다. */
export function anchorTitle(claudeMd: string): string {
  const first = claudeMd.split("\n")[0] ?? "";
  return /^#\s+(.+?)\s*\r?$/.exec(first)?.[1] ?? ANCHOR_TITLE_FALLBACK;
}

function markerInner(body: ReadonlyArray<string> | null, m: HarnessBlockMarker): string[] {
  if (body === null) return [];
  const at = blockRange(body, m);
  return at === null ? [] : body.slice(at[0] + 1, at[1]);
}

/**
 * #558 — 첫 접촉 블록 본문. 절 모델 렌더(`renderAgentsMd` 결과)에서 **하네스 몫만** 뽑아 한 덩어리로 만든다.
 *
 * - 설치자 절(`## Project Context` · `## Project Rules`)은 설치자 파일에 이미 있으니 뺀다 — 스캐폴드도 넣지 않는다.
 * - 그 절 안에 살던 하네스 조각(앵커 본문 · 상시 스킬 안내)은 마커를 벗겨 블록 안으로 옮긴다 — 블록 안에서 블록을
 *   열면 읽지 못한 파일이 된다(`marker-md`).
 * - 앵커에는 앵커 자신의 제목(`## Working Principles`)을 단다 — 설치자의 `## Project Rules` 와 같은 이름의 절이 두 개
 *   생기면 에이전트가 어느 쪽이 설치자 규칙인지 가를 수 없다.
 * - 나머지 하네스 절(`## Harness Rules` · `## Session Start` · `## Protected Files`)은 렌더 그대로.
 */
export function renderAgentsBlock(params: {
  rendered: string;
  template: string;
  anchorTitle: string;
}): string {
  const { rendered, template } = params;
  const names = sectionNames(template);
  const anchor = markerInner(sectionBody(rendered, names, RULES_SECTION), ANCHOR_BLOCK);
  const skills = markerInner(sectionBody(rendered, names, CONTEXT_SECTION), SKILLS_BLOCK);
  const harness: string[] = [];
  let keep = false;
  for (const line of rendered.split("\n")) {
    const name = headingName(line, names);
    if (name !== null) keep = name !== CONTEXT_SECTION && name !== RULES_SECTION;
    if (keep) harness.push(line);
  }
  return [
    [`## ${params.anchorTitle}`, "", ...trimBlankEdges(anchor)],
    trimBlankEdges(skills),
    trimBlankEdges(harness),
  ]
    .filter((part) => part.length > 0)
    .map((part) => part.join("\n"))
    .join("\n\n");
}

export interface MergeAgentsMdParams {
  /** 이번 렌더 결과 — 하네스 소유 절의 최신판이자 결과물의 골격. */
  rendered: string;
  /** 디스크의 현재 내용. 파일이 없으면 `null` (신규 설치 → 렌더 그대로). */
  existing: string | null;
  /** 절 이름의 SSOT. 렌더에 쓴 그 템플릿을 그대로 넘긴다. */
  template: string;
  /**
   * v26.165.0 (ADR-103 · 독립 검증 BLOCKER-3) — 디스크의 `## Project Context` 가 **손대지 않은 스캐폴드**
   * (`isUnfilledScaffold`)면 이어받지 않고 렌더의 절(= 호출부가 넣은 씨)로 바꾼다. 옛 Antigravity 앵커에 채운 글을
   * 이미 있는 `AGENTS.md` 로 한 번 옮겨 심는 자리다. 채워져 있으면 그대로 이어받는다(두 문장을 합치지 않는다).
   * 쓰기는 이 결과 한 번 — 기록 sha 가 최종 바이트라 다음 update 가 "고쳤다" 로 읽지 않는다.
   */
  replaceUnfilledContext?: boolean;
  /**
   * 리뷰 #735 — 하네스가 `## Harness Rules` 에 쓸 수 있는 룰 제목 전체(`ruleHeadings` — 배포 룰 전부의 `## ` 줄). 렌더에서
   * 빠진 룰 제목(Antigravity 만 남은 집합 · 더 좁은 트랙)을 설치자 절로 되살리지 않는 근거다. **위치가 아니라 정체**로
   * 가른다 — 같은 자리에 설치자가 적은 `## Team rules` 는 이 집합에 없으므로 설치자 절로 남는다. 생략 = 빈 집합.
   */
  harnessRuleHeadings?: ReadonlySet<string>;
}

/**
 * @returns 기록할 내용. 설치자가 아무것도 안 고쳤으면 **렌더 결과와 바이트 동일**하다
 *   (= 디스크와 같으면 `owned-write` 가 쓰지도 백업하지도 않는다).
 */
export function mergeAgentsMd(params: MergeAgentsMdParams): string {
  return mergeAgentsMdDetailed(params).text;
}

export interface MergeAgentsMdResult {
  text: string;
  /**
   * #774 — 옛 판이 바이트 그대로 쓴 절(`isLegacyHarnessSection`)이라 되살리지 않고 떨어뜨린 수. 0 보다 크면 호출부가 쓰기 전
   * `AGENTS.md.backup-<시각>` 1회를 남긴다(ADR-111 — 현행 번들에 없는 바이트라 다시 깔아도 돌아오지 않는다).
   */
  droppedLegacySections: number;
  /**
   * #774 — 옛 판 파일(`isLegacyHarnessAgentsMd`)의 하네스 이름 절 중 설치자가 고친 것(바이트가 옛 렌더와 다르다)의 제목. 절 모델에서
   * 이 절은 하네스 몫이라 지금 판으로 바뀐다 — 비어 있지 않으면 호출부가 쓰기 전 1회 백업을 남기고 화면이 "고친 절은 백업에 있다" 고
   * 말한다(ADR-111). 옛 판 파일이 아니면 빈 배열.
   */
  editedLegacySections: string[];
}

/** `mergeAgentsMd` 와 같은 병합 — 떨어뜨린 옛 하네스 절 수까지 돌려준다. */
export function mergeAgentsMdDetailed(params: MergeAgentsMdParams): MergeAgentsMdResult {
  const { rendered, existing, template } = params;
  if (existing === null) {
    return { text: rendered, droppedLegacySections: 0, editedLegacySections: [] };
  }
  const names = sectionNames(template);
  const bodies = new Map<string, string[]>();

  const contextNow = sectionBody(existing, names, CONTEXT_SECTION);
  const contextNew = sectionBody(rendered, names, CONTEXT_SECTION);
  const seedOverUnfilled =
    params.replaceUnfilledContext === true &&
    contextNow !== null &&
    isUnfilledScaffold(installerLines(contextNow, SKILLS_BLOCK));
  if (contextNow !== null && contextNew !== null && !seedOverUnfilled) {
    bodies.set(
      CONTEXT_SECTION,
      refreshBlock(contextNow, contextNew, SKILLS_BLOCK, CONTINUOUS_SKILLS_HEADING),
    );
  }

  const rulesNow = sectionBody(existing, names, RULES_SECTION);
  const rulesNew = sectionBody(rendered, names, RULES_SECTION);
  // 마커 없는 옛 설치본의 `## Project Rules` 는 통째로 하네스가 렌더한 앵커 본문이고, 어디까지가
  // 설치자가 덧쓴 줄인지 판정할 근거가 없다 — 그때는 최신판으로 간다(편집분은 `owned-write` 의
  // `.backup-<stamp>` 에 남는다). 마커가 있는 판부터는 블록만 갈아 끼우므로 덧쓴 줄이 남는다.
  // 다만 그 본문 안에 설치자가 적은 `## ` 절은 라이브에 남긴다(ADR-097 결정 4 · #739) — 렌더의 같은 절에 없는 제목이
  // 그것이다(집합 대조). 아래 `extraTopLevelSections` 가 다른 설치자 절과 같이 파일 끝에 되살린다.
  let replacedRulesHeadings: ReadonlySet<string> | null = null;
  if (rulesNow !== null && rulesNew !== null && blockRange(rulesNow, ANCHOR_BLOCK) !== null) {
    bodies.set(RULES_SECTION, refreshBlock(rulesNow, rulesNew, ANCHOR_BLOCK));
  } else if (rulesNow !== null && rulesNew !== null) {
    replacedRulesHeadings = headingLines(rulesNew);
  }

  const merged = bodies.size === 0 ? rendered : assemble(rendered, names, bodies);
  // #643 — 스켈리톤이 모르는 상위 절(사용자가 파일 끝에 붙인 `## My Team Conventions` 등)은
  // 렌더에 자리가 없어 조용히 사라졌다. ADR-095 가 설치자 소유로 정한 것은 **아는 절들**이다 —
  // 모르는 절을 지우는 권한까지는 없다. 원래 순서 그대로 파일 끝에 되살린다.
  // 어느 절이 설치자 것인지는 uninstall 의 걷기와 같은 판정(`headingOwner`)이 정한다(#739). 아는 절 본문
  // (`## Project Context`·`## Project Rules` 아래)의 `## ` 는 그 본문의 소유 규칙(마커 블록)이 맡으므로 다시 모으지 않는다 —
  // 모으면 update 마다 한 벌씩 늘거나, 옛 판 앵커·스캐폴드 제목이 파일 끝에 되살아난다.
  const mergedText = merged.replace(/\r/g, "");
  const candidates = extraTopLevelSections(
    existing,
    names,
    rendered,
    params.harnessRuleHeadings ?? new Set(),
    replacedRulesHeadings,
  );
  const droppedLegacySections = candidates.legacy;
  // #774 — 옛 판 파일의 하네스 이름 절을 설치자가 고쳤으면(옛 렌더 바이트와 다르다) 지금 판으로 바뀌는 사실을 호출부가 말하게 한다.
  // uninstall 의 걷기와 같은 판정이다(그쪽은 남긴다 — 바꿔 쓸 지금 판이 없다)
  const editedLegacySections = isLegacyHarnessAgentsMd(existing)
    ? installerSectionsInHarnessArea(
        existing,
        names,
        new Set([...(params.harnessRuleHeadings ?? []), ...renderedRuleHeadings(rendered, names)]),
        true,
      ).keptEdited
    : [];
  const extras = candidates.sections.filter(
    (e) => !mergedText.includes(e.join("\n").replace(/\r/g, "")),
  );
  if (extras.length === 0) return { text: merged, droppedLegacySections, editedLegacySections };
  return {
    text: `${merged.replace(/\n+$/, "\n")}${extras.map((e) => e.join("\n")).join("\n")}`.replace(
      /\n+$/,
      "\n",
    ),
    droppedLegacySections,
    editedLegacySections,
  };
}

/** `headingOwner` 의 판정 — 하네스 것 · 설치자 것 · 아는 절 본문(그 절의 소유 규칙이 맡는다). */
export type HeadingOwner = "harness" | "installer" | "body";

/**
 * #739 — `AGENTS.md` 의 `## ` 줄 하나가 누구 것인가. update 의 병합(`extraTopLevelSections`)과 uninstall 의 걷기
 * (`installerSectionsInHarnessArea`)가 **이 함수 하나**로 가른다 — 한쪽만 바뀌면 #736 처럼 설치자 글이 사라진다.
 *
 * - 템플릿의 절 이름 → `harness`(절 경계)
 * - `## Project Context` · `## Project Rules` 안 → `body`(그 절 본문 — 소유는 마커 블록 · `installerLines` 가 정한다)
 * - `## Harness Rules` 안이고 하네스 룰 제목 집합에 든다 → `harness`(정체로 가른다 — 위치가 아니다, 리뷰 #735)
 * - 그 밖 → `installer`
 *
 * @param bare 줄 끝 `\r` 을 뗀 줄. `region` 은 호출부가 줄을 훑으며 넘기는 직전 절 이름(아직 없으면 `null`).
 */
export function headingOwner(
  bare: string,
  ctx: {
    region: string | null;
    names: ReadonlySet<string>;
    harnessHeadings: ReadonlySet<string>;
  },
): HeadingOwner {
  const name = /^## (.+?)\s*$/.exec(bare)?.[1];
  if (name !== undefined && ctx.names.has(name)) return "harness";
  if (ctx.region === CONTEXT_SECTION || ctx.region === RULES_SECTION) return "body";
  if (ctx.region === HARNESS_RULES_SECTION && ctx.harnessHeadings.has(bare.trim())) {
    return "harness";
  }
  return "installer";
}

/** 절 본문 줄들 중 `## ` 제목 줄(끝 공백을 뗀 것). */
function headingLines(body: ReadonlyArray<string>): Set<string> {
  return new Set(body.filter((l) => /^## /.test(l)).map((l) => l.replace(/\r$/, "").trim()));
}

/** 렌더의 `## Harness Rules` 절에 든 `## ` 제목 — 병합이 하네스 룰 제목으로 더 넘기는 몫. */
function renderedRuleHeadings(rendered: string, names: ReadonlySet<string>): Set<string> {
  return headingLines(sectionBody(rendered, names, HARNESS_RULES_SECTION) ?? []);
}

/**
 * 설치자가 하네스 절 자리에 적은 `## ` 절을 [헤딩 포함 줄 배열] 단위로 원래 순서대로 — 병합이 파일 끝에 되살린다.
 * `replacedRulesHeadings` 가 있으면 `## Project Rules` 본문을 통째로 갈아 끼우는 중이다(마커 없는 옛 판) — 그 본문의
 * `## ` 중 이 집합(렌더의 같은 절 제목)에 없는 것도 설치자 절로 모은다. 단 옛 판이 바이트 그대로 쓴 절(앵커 절 · 옛 템플릿
 * 꼬리 절 — `isLegacyHarnessSection`)은 **어느 후보 자리에 있든** 하네스가 쓰고 은퇴시킨 것이다 — 되살리지 않고 `legacy` 로
 * 센다(#774 — 꼬리 절은 `## Project Rules` 밖에 있어 그 본문만 거르면 못 잡는다).
 */
function extraTopLevelSections(
  existing: string,
  names: ReadonlySet<string>,
  rendered: string,
  harnessRuleHeadings: ReadonlySet<string>,
  replacedRulesHeadings: ReadonlySet<string> | null,
): { sections: string[][]; legacy: number } {
  // 하네스 룰 제목 = 넘겨받은 배포 룰 제목 전부(렌더에서 빠진 룰도 설치자 절로 되살리지 않는다 — #642) ∪ 이번 렌더의
  // 룰 제목(호출부가 집합을 생략해도 지금 렌더한 룰은 하네스 것이다).
  const harnessHeadings = new Set([
    ...harnessRuleHeadings,
    ...renderedRuleHeadings(rendered, names),
  ]);
  const out: string[][] = [];
  let current: string[] | null = null;
  let region: string | null = null;
  for (const line of existing.split("\n")) {
    const bare = line.replace(/\r$/, "");
    const name = /^## (.+?)\s*$/.exec(bare)?.[1];
    if (name !== undefined) {
      if (current !== null) out.push(current);
      if (names.has(name)) region = name;
      const owner = headingOwner(bare, { region, names, harnessHeadings });
      const replacedBody =
        owner === "body" &&
        region === RULES_SECTION &&
        replacedRulesHeadings !== null &&
        !replacedRulesHeadings.has(bare.trim());
      current = owner === "installer" || replacedBody ? [line] : null;
      continue;
    }
    if (current !== null) current.push(line);
  }
  if (current !== null) out.push(current);
  const legacy = out.filter(isLegacyHarnessSection).length;
  // 끝의 빈 줄 껍데기는 되살릴 필요 없다 — 병합 결과가 정리한다.
  const sections = out
    .filter((lines) => !isLegacyHarnessSection(lines))
    .map((lines) => {
      const trimmed = [...lines];
      while (trimmed.length > 1 && (trimmed.at(-1) ?? "").trim() === "") trimmed.pop();
      return trimmed;
    })
    .filter((lines) => lines.length > 1 || /^## /.test(lines[0] ?? ""));
  return { sections, legacy };
}

/** 절 본문에서 하네스 마커 블록 하나를 뺀 나머지 = 설치자가 적은 줄. 절이 없으면 빈 배열. */
function installerLines(body: ReadonlyArray<string> | null, m: HarnessBlockMarker): string[] {
  if (body === null) return [];
  const at = blockRange(body, m);
  return at === null ? [...body] : [...body.slice(0, at[0]), ...body.slice(at[1] + 1)];
}

/** 비교용 정규화 — 빈 줄과 줄 끝 공백은 "내용"이 아니다. */
function compact(lines: ReadonlyArray<string>): string[] {
  return lines.map((l) => l.replace(/\r$/, "").trimEnd()).filter((l) => l.trim() !== "");
}

function trimBlankEdges(lines: ReadonlyArray<string>): string[] {
  const out = trimTrailingBlanks(lines);
  while (out.length > 0 && (out[0] ?? "").trim() === "") out.shift();
  return out;
}

/**
 * 설치자가 `## Project Context` 에 적어 둔 줄 (하네스 마커 블록 제외). 절이 없으면 `null`.
 *
 * #528 앵커 씨 뿌리기가 다른 앵커로 옮길 때 읽는 자리 — 경계는 `stripHarnessFromAgentsMd` 와
 * 같다(템플릿의 최상위 절 이름). 판정("채워졌는가")은 하지 않는다: 그 판정을 두 곳에 두면
 * 갈리고, 여기 호출부는 자기 스캐폴드와 비교할 줄 안다.
 */
export function projectContextInstallerLines(params: StripAgentsMdParams): string[] | null {
  const { existing, template } = params;
  const body = sectionBody(existing, sectionNames(template), CONTEXT_SECTION);
  return body === null ? null : installerLines(body, SKILLS_BLOCK);
}

export interface StripAgentsMdParams {
  /** 디스크의 현재 내용. */
  existing: string;
  /** 절 이름의 SSOT — 이 파일을 렌더한 그 템플릿. */
  template: string;
  /**
   * #736 — 하네스가 `## Harness Rules` 에 쓸 수 있는 룰 제목 전체(`ruleHeadings`). 병합의 같은 이름 인자와 같은 판정이다:
   * 그 자리의 `## ` 중 이 집합에 든 것만 하네스 것이고, 나머지는 설치자가 이어 쓴 절이다. 생략 = 빈 집합.
   */
  harnessRuleHeadings?: ReadonlySet<string>;
}

/**
 * #736 — 하네스 절 자리(`## Harness Rules` · `## Session Start` · `## Protected Files` · 파일 끝)에 설치자가 적은 `## ` 절을
 * [헤딩 포함 줄 배열] 단위로 원래 순서대로. update 가 `extraTopLevelSections` 로 살려 둔 절이 여기 든다 — 걷기가 이 절을
 * 모르면 uninstall 이 그 글을 지운다(파일째이거나 그 절만).
 *
 * 하네스 것 = 템플릿의 절 이름 · `## Harness Rules` 안의 하네스 룰 제목. 그 밖의 `## ` 는 설치자 절이다(정체로 가른다 —
 * 위치가 아니다). `## Project Context` · `## Project Rules` 본문은 `installerLines` 가 맡으므로 여기서 세지 않는다.
 *
 * #774 — 병합(`extraTopLevelSections`)과 같은 지문으로 옛 판이 바이트 그대로 쓴 절은 걷는다(`legacy` 로 센다 — 호출부가 1회
 * 백업). `legacyFile` = 마커 이전 판의 파일이다: 하네스 **이름 절**(템플릿 제목 절 — `## Project Rules` 머리말 · `## Harness Rules`
 * 안내 · `## Session Start` · 그리고 하네스 룰 제목 절)도 이름이 아니라 바이트로 가른다 — 옛 렌더 그대로(지문 일치)면 걷고, 다르면
 * 설치자가 고친 절로 남기고 `keptEdited` 에 제목을 싣는다(사용자 결정 ⓓ "설치자가 고친 절은 남는다"). `## Project Rules` 본문의 `## `
 * 는 옛 앵커 절 후보다(지문 일치 = 앵커 절 · 불일치 = 설치자 절). `## Project Context` 본문은 호출부가 맡는다.
 */
function installerSectionsInHarnessArea(
  existing: string,
  names: ReadonlySet<string>,
  harnessRuleHeadings: ReadonlySet<string>,
  legacyFile = false,
): { sections: string[][]; legacy: number; keptEdited: string[] } {
  const out: Array<{ lines: string[]; named: boolean }> = [];
  let current: { lines: string[]; named: boolean } | null = null;
  let region: string | null = null;
  for (const line of existing.split("\n")) {
    const bare = line.replace(/\r$/, "");
    const name = /^## (.+?)\s*$/.exec(bare)?.[1];
    if (name !== undefined) {
      if (current !== null) out.push(current);
      if (names.has(name)) region = name;
      const owner = headingOwner(bare, { region, names, harnessHeadings: harnessRuleHeadings });
      if (!legacyFile) current = owner === "installer" ? { lines: [bare], named: false } : null;
      else if (region === CONTEXT_SECTION) current = null;
      else current = { lines: [bare], named: owner === "harness" };
      continue;
    }
    if (current !== null) current.lines.push(bare);
  }
  if (current !== null) out.push(current);
  const sections: string[][] = [];
  const keptEdited: string[] = [];
  let legacy = 0;
  for (const { lines, named } of out) {
    if (isLegacyHarnessSection(lines)) {
      legacy++;
      continue;
    }
    if (named) {
      // 본문이 빈 이름 절(머리말 없는 앵커의 `## Project Rules`)은 걷을 것도 남길 것도 없다
      if (lines.slice(1).every((l) => l.trim() === "")) continue;
      keptEdited.push((lines[0] ?? "").replace(/^## /, "").trim());
    }
    sections.push(trimTrailingBlanks(lines));
  }
  return { sections, legacy, keptEdited };
}

/** `stripAgentsMd` 의 결과. */
export interface AgentsMdStripResult {
  /** 남길 내용 — `null` = 파일째 삭제(마커도 머리 지문도 없는 파일은 호출부의 기준선 sha 가 소유를 말한다). */
  remainder: string | null;
  /**
   * #774 — 걷은 것에 옛 판의 하네스 바이트(지문 일치 절 · 옛 파일 통째)가 들었다. 참이면 호출부가 쓰거나 지우기 **전**
   * `AGENTS.md.backup-<시각>` 1회를 남긴다(ADR-111 — 현행 번들에 없는 바이트라 다시 깔아도 돌아오지 않는다).
   */
  legacyRemoved: boolean;
  /** 걷은 옛 하네스 절 수(지문 일치) — 화면이 센다. */
  legacySections: number;
  /**
   * #774 — 하네스 이름 절(`Session Start` · `Project Rules` 머리말 · 하네스 룰 제목 절 …)인데 바이트가 옛 렌더와 달라 **설치자가 고친
   * 절로 남긴** 것의 제목(사용자 결정 ⓓ). 화면이 "고친 절 N 개를 남겼다" 고 말한다.
   */
  keptEdited: string[];
}

/**
 * uninstall 용 — 하네스 몫을 걷어내고 설치자 절만 남긴다 (#516).
 *
 * 루트 `CLAUDE.md` 의 `stripHarnessImport` 와 같은 자리다. `update` 가 설치자 절을 이어받아 다시
 * 쓰면서(#503) 그 문장이 기준선 sha 안으로 들어갔고, uninstall 은 "기준선과 같으면 우리 것"으로
 * 보고 파일을 통째로 지웠다 — 설치자가 채운 `## Project Context` 가 살아 있는 파일에서 사라졌다.
 *
 * 남기는 것 = 제목 줄 + `## Project Context` · `## Project Rules` 의 설치자 줄(마커 블록은 뺀다) + 하네스 절 자리에
 * 설치자가 적은 `## ` 절(#736 — `installerSectionsInHarnessArea`).
 * 걷어내는 것 = 하네스 소유 절 전부(`## Harness Rules` · `## Session Start` · `## Protected Files`)와
 * 두 마커 블록. 절 경계는 렌더 때와 같이 템플릿의 최상위 절 이름으로 판정한다(ADR-095 D3).
 *
 * @returns 남길 내용. 설치자가 아무것도 안 채웠으면(Project Context 가 스캐폴드 그대로이고
 *   Project Rules 에 덧쓴 줄이 없고 덧붙인 절도 없으면) `null` = 파일째 삭제. **마커도 옛 판 머리 지문도 없는 파일도 `null`**
 *   — 그 파일의 소유는 기준선 sha 가 그대로 말한다(호출부는 sha 가 다르면 이 함수를 부르지 않고 파일을 남긴다).
 */
export function stripHarnessFromAgentsMd(params: StripAgentsMdParams): string | null {
  return stripAgentsMd(params).remainder;
}

/** `stripHarnessFromAgentsMd` 와 같은 걷기 — 옛 판의 하네스 바이트를 걷었는지까지 돌려준다(#774). */
export function stripAgentsMd(params: StripAgentsMdParams): AgentsMdStripResult {
  const { existing, template } = params;
  const lines = existing.split("\n");
  const names = sectionNames(template);
  const headings = params.harnessRuleHeadings ?? new Set<string>();
  if (blockRange(lines, ANCHOR_BLOCK) === null && blockRange(lines, SKILLS_BLOCK) === null) {
    if (!isLegacyHarnessAgentsMd(existing)) {
      return {
        remainder: null,
        legacyRemoved: false,
        legacySections: 0,
        keptEdited: [],
      };
    }
    const body = withoutAgentsBlock(existing);
    return stripLegacyAgentsMd(body, names, headings);
  }
  const context = installerLines(sectionBody(existing, names, CONTEXT_SECTION), SKILLS_BLOCK);
  const rules = installerLines(sectionBody(existing, names, RULES_SECTION), ANCHOR_BLOCK);
  // BLOCKER-2 — 하네스가 쓴 줄(배너 · FILL 주석 · 상시 스킬 안내)을 뗀 뒤 판정한다. FILL 문구가 바뀐 릴리즈에서
  // 옛 판의 안 채운 파일을 "채웠다" 로 읽으면 스캐폴드만 든 파일이 남는다.
  const contextFilled = !isUnfilledScaffold(context);
  const rulesFilled = compact(rules).length > 0;
  const extras = installerSectionsInHarnessArea(existing, names, headings);
  const legacy = {
    legacyRemoved: extras.legacy > 0,
    legacySections: extras.legacy,
    keptEdited: [],
  };
  if (!contextFilled && !rulesFilled && extras.sections.length === 0) {
    return { remainder: null, ...legacy };
  }

  const out: string[] = [];
  const title = (lines[0] ?? "").replace(/\r$/, "");
  if (/^# /.test(title)) out.push(title, "");
  // 안 채운 스캐폴드는 하네스가 쓴 글이다 — 남길 설치자 몫이 덧붙인 절뿐이면 Project Context 를 싣지 않는다.
  if (contextFilled || rulesFilled) {
    out.push(`## ${CONTEXT_SECTION}`, "", ...trimBlankEdges(context), "");
  }
  if (rulesFilled) out.push(`## ${RULES_SECTION}`, "", ...trimBlankEdges(rules), "");
  for (const section of extras.sections) out.push(...section, "");
  return { remainder: out.join("\n"), ...legacy };
}

/**
 * #774 — 마커 이전 판의 하네스 `AGENTS.md`(머리 지문 일치, 첫 접촉 블록은 뗀 본문)를 걷는다: 머리 블록인용과 지문 일치 절(앵커 ·
 * 꼬리 · 하네스 이름 절의 옛 렌더)은 하네스 것이고, 지문이 다른 절은 — 이름이 하네스 것(`Session Start` · `Project Rules` 머리말 ·
 * 하네스 룰 제목)이어도 — 설치자가 쓰거나 고친 절로 남는다(사용자 결정 ⓓ). `## Project Context` 는 안 채운 스캐폴드면 걷고, 채웠으면
 * 하네스 배너만 떼고 남긴다. 남는 것이 없으면 `null`(파일째 삭제). 어느 쪽이든 옛 판 바이트를 걷으므로 `legacyRemoved` 는 참이다.
 */
function stripLegacyAgentsMd(
  existing: string,
  names: ReadonlySet<string>,
  headings: ReadonlySet<string>,
): AgentsMdStripResult {
  // `## Project Context` 가 없던 판(v26.70~v26.95)은 채울 자리도 없었다 — 빈 본문을 "채웠다" 로 읽지 않는다
  const contextBody = sectionBody(existing, names, CONTEXT_SECTION);
  const context = dropHarnessQuoteBlocks(contextBody ?? []);
  const contextFilled = contextBody !== null && !isUnfilledScaffold(context);
  const extras = installerSectionsInHarnessArea(existing, names, headings, true);
  const result = {
    legacyRemoved: true,
    legacySections: extras.legacy,
    keptEdited: extras.keptEdited,
  };
  if (!contextFilled && extras.sections.length === 0) return { remainder: null, ...result };
  const out: string[] = [];
  const title = (existing.split("\n")[0] ?? "").replace(/\r$/, "");
  if (/^# /.test(title)) out.push(title, "");
  if (contextFilled) out.push(`## ${CONTEXT_SECTION}`, "", ...trimBlankEdges(context), "");
  for (const section of extras.sections) out.push(...section, "");
  return { remainder: out.join("\n"), ...result };
}

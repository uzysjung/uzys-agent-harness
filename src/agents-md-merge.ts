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

import { CONTINUOUS_SKILLS_HEADING, renderContinuousSkillsNote } from "./project-claude-merge.js";

export interface HarnessBlockMarker {
  start: string;
  end: string;
}

const marker = (name: string): HarnessBlockMarker => ({
  start: `<!-- uzys-harness:${name}:start -->`,
  end: `<!-- uzys-harness:${name}:end -->`,
});

/** `## Project Rules` 안의 하네스 앵커 본문(= `templates/CLAUDE.md`)이 사는 자리. */
export const ANCHOR_BLOCK = marker("anchor");
/** `## Project Context` 안의 상시 스킬 안내(ADR-085)가 사는 자리. */
export const SKILLS_BLOCK = marker("skills");

/** 설치자 소유 절 — 이 둘만 디스크 본문을 이어받는다. 템플릿의 절 이름과 같아야 한다. */
const CONTEXT_SECTION = "Project Context";
const RULES_SECTION = "Project Rules";

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
  // 마커 없는 옛 설치본 — 헤딩으로 조각을 찾아 걷어내고 그 자리에 마커째 다시 넣는다.
  const legacyAt =
    legacyHeading === undefined
      ? -1
      : existing.findIndex((l) => l.replace(/\r$/, "").trim() === legacyHeading);
  const kept = trimTrailingBlanks(legacyAt === -1 ? existing : existing.slice(0, legacyAt));
  return fresh === null ? [...kept, ""] : [...kept, "", ...fresh, ""];
}

export interface MergeAgentsMdParams {
  /** 이번 렌더 결과 — 하네스 소유 절의 최신판이자 결과물의 골격. */
  rendered: string;
  /** 디스크의 현재 내용. 파일이 없으면 `null` (신규 설치 → 렌더 그대로). */
  existing: string | null;
  /** 절 이름의 SSOT. 렌더에 쓴 그 템플릿을 그대로 넘긴다. */
  template: string;
}

/**
 * @returns 기록할 내용. 설치자가 아무것도 안 고쳤으면 **렌더 결과와 바이트 동일**하다
 *   (= 디스크와 같으면 `owned-write` 가 쓰지도 백업하지도 않는다).
 */
export function mergeAgentsMd(params: MergeAgentsMdParams): string {
  const { rendered, existing, template } = params;
  if (existing === null) return rendered;
  const names = sectionNames(template);
  const bodies = new Map<string, string[]>();

  const contextNow = sectionBody(existing, names, CONTEXT_SECTION);
  const contextNew = sectionBody(rendered, names, CONTEXT_SECTION);
  if (contextNow !== null && contextNew !== null) {
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
  if (rulesNow !== null && rulesNew !== null && blockRange(rulesNow, ANCHOR_BLOCK) !== null) {
    bodies.set(RULES_SECTION, refreshBlock(rulesNow, rulesNew, ANCHOR_BLOCK));
  }

  return bodies.size === 0 ? rendered : assemble(rendered, names, bodies);
}

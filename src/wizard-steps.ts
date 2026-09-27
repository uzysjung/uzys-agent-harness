/**
 * Wizard step single source of truth — v26.65.0.
 *
 * v26.64.0 에서 wizard 가 5→6 step 으로 변경됐는데 prompts.ts 의 message 가 hardcoded
 * ("Step 1/5") 였음 → step indicator drift 가 무성. 본 모듈이 SSOT.
 *
 * 추가 step 도입 시 본 파일만 수정 → message 자동 정합.
 */

export interface WizardStep {
  current: number;
  total: number;
}

/**
 * #560 (ADR-097 결정 1) — 6→5단계. Scope 단계를 없앴다: 하네스 파일은 범위와 무관하게 늘 이 프로젝트에
 * 쓰였고, Global 이 바꾸던 것은 외부 자산 도구의 플래그뿐이었다 — 화면은 "~/.claude/ 에 쓴다"고 했다.
 */
export const WIZARD_TOTAL = 5;

export const WIZARD: {
  TRACKS: WizardStep;
  CLI: WizardStep;
  TARGETS: WizardStep;
  CONFIRM: WizardStep;
  INSTALL: WizardStep;
} = {
  TRACKS: { current: 1, total: WIZARD_TOTAL },
  CLI: { current: 2, total: WIZARD_TOTAL },
  TARGETS: { current: 3, total: WIZARD_TOTAL },
  CONFIRM: { current: 4, total: WIZARD_TOTAL },
  INSTALL: { current: 5, total: WIZARD_TOTAL },
};

/**
 * #533 (D3) — 기설치 Update 흐름은 5단계다. 스코프는 묻지 않는다 — 설치 기록의 것을 확인 화면에
 * 보인다(결정 1 이전의 global 설치본은 기록대로 간다 — 다시 물으면 project 를 섞는 길이 생긴다).
 */
export const UPDATE_WIZARD_TOTAL = 5;

export const UPDATE_WIZARD: {
  TRACKS: WizardStep;
  CLI: WizardStep;
  TARGETS: WizardStep;
  CONFIRM: WizardStep;
  RUN: WizardStep;
} = {
  TRACKS: { current: 1, total: UPDATE_WIZARD_TOTAL },
  CLI: { current: 2, total: UPDATE_WIZARD_TOTAL },
  TARGETS: { current: 3, total: UPDATE_WIZARD_TOTAL },
  CONFIRM: { current: 4, total: UPDATE_WIZARD_TOTAL },
  RUN: { current: 5, total: UPDATE_WIZARD_TOTAL },
};

/**
 * Wizard step header — `Step N/M — <suffix>` 형식.
 *
 * step 미지정 시 suffix 만 반환 (backward compat — tests / non-wizard 호출).
 */
export function stepLabel(step: WizardStep | undefined, suffix: string): string {
  if (!step) return suffix;
  return `Step ${step.current}/${step.total} — ${suffix}`;
}

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

export const WIZARD_TOTAL = 6;

export const WIZARD: {
  TRACKS: WizardStep;
  CLI: WizardStep;
  TARGETS: WizardStep;
  SCOPE: WizardStep;
  CONFIRM: WizardStep;
  INSTALL: WizardStep;
} = {
  TRACKS: { current: 1, total: WIZARD_TOTAL },
  CLI: { current: 2, total: WIZARD_TOTAL },
  TARGETS: { current: 3, total: WIZARD_TOTAL },
  SCOPE: { current: 4, total: WIZARD_TOTAL },
  CONFIRM: { current: 5, total: WIZARD_TOTAL },
  INSTALL: { current: 6, total: WIZARD_TOTAL },
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

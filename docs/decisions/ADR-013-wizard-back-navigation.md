# ADR-013: Wizard Back Navigation for Interactive Install

- **Status**: Accepted
- **Date**: 2026-05-15
- **PR**: TBD (v26.46.0)
- **Supersedes**: 없음
- **Related**: ADR-012 (Codex prompts default; 같은 PR)

## Context

v0.x 부터 interactive 흐름 = 한 방향 sequence (tracks → options → cli → confirm). 각 step 의 ESC 키 = `isCancel(result) → null` → **전체 종료**.

사용자 verbatim feedback (2026-05-15): "Target CLI(s) 단계에서 이전 단계로 가는 것이 안 된다. Optional features 로 안 가짐."

문제:
- cli 단계에서 옵션 다시 선택하고 싶을 때 → ESC 누르면 통째 cancel → 모든 입력 재시작.
- 4-step sequence 의 후반 step 에서 작은 수정 = 처음부터 재선택.

## Decision

각 step 의 ESC 키 의미를 재정의:

| Step | ESC 동작 |
|---|---|
| tracks (1) | 전체 종료 (기존 동일) |
| options (2) | **back to tracks** (신규) |
| cli (3) | **back to options** (신규) |
| confirm (4) | 전체 종료 (기존 동일) |
| confirm No (4) | cancel (clack convention 유지) |

### 구현

```ts
type Step = "tracks" | "options" | "cli" | "confirm";
let step: Step = "tracks";
let tracks, optionKeys, cli;

while (true) {
  if (step === "tracks") {
    const result = await prompts.selectTracks(tracks ?? initialTracks);
    if (result === null) return cancel();  // 최초 step ESC = exit
    tracks = result;
    step = "options";
  } else if (step === "options") {
    const result = await prompts.selectOptionKeys(optionKeys ?? undefined);
    if (result === null) { step = "tracks"; continue; }  // back
    optionKeys = result;
    step = "cli";
  } else if (step === "cli") {
    const result = await prompts.selectCli(cli ?? ["claude"]);
    if (result === null) { step = "options"; continue; }  // back
    cli = result;
    step = "confirm";
  } else {
    // confirm logic ...
  }
}
```

### 이전 선택 보존

각 변수 (`tracks`, `optionKeys`, `cli`) 는 closure 보존. Back nav 후 재진입 시 `initial*` 인자로 전달 — 사용자 이전 선택이 미리 체크된 상태로 표시.

## Alternatives

- **(a) "Edit step" select prompt — confirm 단계에서 select (proceed/edit-tracks/edit-options/edit-cli/cancel).** 기각: 추가 step UX 부담. ESC 가 더 직관적 + 키보드 한 번.
- **(b) prompt 라이브러리 교체 (Inquirer, Ink).** 기각: 큰 dependency 변경. clack 의 minimalism 가치 손실.
- **(c) `confirm: No → back to tracks`.** 기각: clack confirm 의 [Y/n] 관례에서 No=cancel. 의미 모호.

## Consequences

### 긍정
- 사용자 UX 개선 — 후반 step 에서 작은 수정 가능.
- 이전 선택 보존 (initial values) — 재선택 부담 ↓.
- Clack 호환 — 추가 dependency 없음.

### 부정
- 기존 test mock 동작 변화 — `selectOptionKeys=null` 이 cancel 이 아니라 back nav.
- mock 작성 시 wizard step 인지 필요 (e.g., `mockResolvedValueOnce(null).mockResolvedValueOnce([])`).
- ESC 의 의미가 step 마다 다름 — 사용자 인지 부담 (그러나 직관적: "뒤로" = ESC 는 widely understood).

### 완화
- `tests/interactive.test.ts` mock 재구성 — back nav 검증 2 신규 test 추가 (`ESC at options → back to tracks`, `ESC at cli → back to options`).
- 기존 cancellation test 는 tracks/confirmInstall 2 step 으로 한정 (선두/말단 step ESC = 종료).
- README/USAGE 에 명시 (별도 PR).

## Notes

clack/prompts 자체는 wizard 패턴 미지원 — 한 방향 sequence API. 본 구현은 application layer 의 while-loop wizard. clack 호환 + 무한 루프 회피 (테스트 시 mock 두 번째 호출에서 종료 시그널 필수).

# ADR-092: wizard — 방법론 스킬을 개별 행으로 (ADR-028 ⓐ 번들 행 대체)

- Status: Accepted
- Date: 2026-09-20
- PR: #485
- Supersedes: ADR-028 의 결정 ⓐ(방법론 번들 단일 row). ⓑ Dev 페이지 분할과 행수 상한 게이트(≤30, `tests/wizard-bundle.test.ts`)는 그대로 유효하다.

## Context

ADR-028(2026-07-17)은 Dev 페이지가 37행으로 clack 의 페이지당 ≤30 제약을 넘긴 것을 **번들 행 + 페이지 분할**로 풀었다. 그 뒤 자산 은퇴(ADR-078 · ADR-090)로 방법론 스킬은 8종 → 5종, 카탈로그 전체도 줄었다.

사용자 관측(#421, 2026-09-04): *"Default 설치되던 스킬을 따로 한 부류로 모았는데 이게 맞는지… 정말 Default 로 반드시 필요한 것인지 판단해서 추가한 것인지 의문… 설명도 부실함."* 번들 행은 ⓐ 하나만 빼고 싶어도 못 빼고(체크박스 1개 = 5종 전부) ⓑ 다섯의 쓸모가 다른데 hint 가 id 나열뿐이며 ⓒ "기본이 맞는가"라는 질문에 답할 관측(개별 해제 기록)이 쌓이지 않는다.

사용자 결정(2026-09-20): **B — 다섯을 개별 행으로 풀고 각자 설명을 붙인다. 기본 체크는 다섯 전부.** (compaction-handoff · clear-korean-communication · recurrence-prevention · multi-persona-review · audit-service-gaps)

## Decision

- 방법론 스킬은 **자기 카테고리 페이지에 개별 행**으로 렌더한다. hint = 카탈로그 `description`(다른 자산과 같은 규칙), 배지 = `★ official`.
- 번들 표현 계층(`DEV_METHOD_BUNDLE_VALUE` · `collapseDevMethodBundle` · `expandDevMethodBundle`)은 제거한다. 위저드 값과 설치 값이 같은 `asset:<id>` 다 — 접었다 펴는 변환이 없다.
- 기본 체크는 조건(`has-dev-track`)이 정한다 — 이번 결정으로 바뀌지 않는다. 개별 해제는 체크박스로(전에는 `--without <id>` 뿐이었다).
- `DEV_METHOD_SKILL_IDS` 는 설치 의미(has-dev-track 묶음 · base 트랙 #456 · 개별 호스팅 #442)에 그대로 쓴다 — 위저드 표현에서만 빠진다.
- 행수 실측(이 PR 시점, `tests/wizard-bundle.test.ts` 상한 게이트 green): 전 페이지 ≤30.

## Alternatives

- **A 유지(번들 행)** — 기각(사용자). 위 ⓐⓑⓒ 그대로.
- **C 번들은 두되 기본 체크를 일부만** — 기각. 묶음 안에서 일부만 기본이면 "체크박스 1개 = 의미 1개"가 깨져 ADR-028 이 지키려던 것마저 잃는다.

## Consequences

- 설치자: 3단계에서 방법론 스킬 다섯이 각자 설명과 함께 보이고 하나씩 뺄 수 있다. 행이 넷 는다(상한 안).
- "기본이 맞는가"는 이제 해제 기록으로 관측할 수 있다 — #452 가 요구한 "설치자의 실제 프로젝트 관측"의 입력이 생긴다.
- ADR-028 ⓑ(페이지 분할·상한 게이트)는 유지 — 이 결정이 행을 늘리므로 게이트가 더 필요해졌다.

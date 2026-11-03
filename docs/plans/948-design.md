# #948 설계 — Codex + Antigravity 조합의 경로 룰을 조건부 포인터로

- 이슈: #948 (마일스톤 v26.182.0) · 근거: `docs/research/codex-rule-pointer-2026-11.md`(실 Codex 포인터 15/15 · 인라인 7/7 · 룰 없음 0/4)
- 바탕: ADR-116(#944) — 룰 본문은 `## Harness Rules` 의 `rules` 마커 블록, 위치 안내는 "이번 실행이 도달을 보장할 때만"

## 0. 판정 기준 (설치자 자리에서)

Codex 와 Antigravity 를 함께 깐 설치자의 Codex 는 `.tsx` · `.sh` · htmx 화면 파일을 고칠 때만 그 룰을 읽고, 그 밖의 세션에는 그 룰을 싣지
않는다. **이 변경이 Codex 가 경로 룰을 0번 받는 실행을 새로 만들지 않는다** — 포인터는 이번 실행이 실재를 보장한 파일만 가리킨다(남는 기존 사각은 ADR-117 Consequences).

## 1. 결정

### D1. 조건 — 이번 실행이 파일을 보장할 때만 (`pathRulesViaFiles`)

넷이 모두 참이면 경로 룰을 포인터로 바꾼다. 하나라도 거짓이면 v26.181.0 과 같은 인라인.

1. codex ∈ `AGENTS.md` 집합
2. opencode ∉ `AGENTS.md` 집합 — OpenCode 의 포인터 따르기는 재지 않았다(OpenCode 가 섞이면 현행 인라인)
3. Antigravity 변환이 이번 실행에서 이번 룰 전부를 `.agents/rules/` 에 썼다(`wroteEveryRule` — #944 와 같은 함수)
4. `AGENTS.md` 가 절 모델이다(`agentsMdModelFor` — 첫 접촉 블록은 굳을 수 있어 늘 인라인, #944 R2-B1 교훈)

`uninstall --cli` 재렌더는 `false` 를 넘긴다(그 실행은 `.agents/rules/` 를 쓰지 않는다 — #944 와 같은 자리).

### D2. 렌더 — 상시 룰은 그대로, 경로 룰만 목록으로

`rules` 마커 블록 안: 안내문(`RULES_NOTE` · `CODEX_SIZE_NOTE`) → 상시 룰 본문(지금 순서) → 경로 룰이 하나라도 있으면 포인터 목록.

```
> 아래 파일을 만들거나 고치기 전에 그 룰을 읽고 따른다 — 본문은 여기 없다.
> - `**/*.tsx` · `**/*.jsx` → `.agents/rules/ui-components.md`
> - `**/*.sh` → `.agents/rules/cli-development.md`
```

- 문장 · 형식은 2차 측정에서 쓴 그대로(측정한 판을 낸다). 글롭은 그 룰의 `paths:` 를 ` · ` 로 잇는다. 줄 순서 = 경로 룰의 렌더 순서.
- 경로 룰이 없는 집합(그 트랙 룰에 `paths:` 가 없다)은 목록 없이 인라인과 같은 바이트.

### D3. 화면 · 크기

- update 화면 상주 비용 줄: 포인터 판이면 인라인은 상시 룰만, 경로 룰은 `.agents/rules/` 파일로 센다 — 실제로 상주하는 것만 말한다(#944 화면 수정과 같은 원칙).
- 크기 게이트: 포인터 판 렌더도 잰다(codex+ag · claude+codex+ag × 두 트랙 조합).

## 2. 바꾸지 않는 것

- 늘 적용되는 룰 · Working Principles 인라인. Codex 단독 설치(파일이 없다 — 후속). OpenCode 가 섞인 집합. 첫 접촉 블록.
- 새 하네스 파일 · 소유 기록 변경 없음 — 가리키는 파일은 Antigravity 가 이미 쓰고 기록하는 `.agents/rules/<룰>.md` 다.

## 3. 집합이 바뀌는 실행

| 실행 | 그 실행의 블록 | Codex 의 경로 룰 | 다음 update |
|---|---|---|---|
| codex+ag 함께 install / update | 포인터(D1 참) | 파일(Antigravity 가 이번에 씀) | 같음 |
| antigravity 설치본에 `install --cli codex` | 인라인(3 거짓) | 인라인 | 포인터 |
| codex 설치본에 `install --cli antigravity` | 포인터(Antigravity 가 이번에 씀) — 단 이번 룰 전부를 썼을 때만 | 파일 | 같음 |
| codex+ag 에 `install --cli opencode` | 인라인(2 거짓) | 인라인 | 인라인(OpenCode 가 남는 한) |
| `uninstall --cli antigravity` (codex 남음) | 인라인(재렌더 false) | 인라인 | 인라인 |
| `uninstall --cli codex` | Codex 없음 — #944 규칙 | — | — |
| 링크 · 남의 슬롯이라 Antigravity 가 룰 하나를 건너뜀 | 인라인(3 거짓) | 인라인 | 인라인(같은 상태면) |

## 4. 검증

| 완료 기준 | 증거 |
|---|---|
| D1 네 조건 각각이 거짓이면 인라인 | 실설치 테스트 — 표 §3 의 행마다 Codex 도달(인라인 본문 또는 포인터가 가리키는 실재 파일) ≥ 1 |
| D2 렌더 | 단위 — 포인터 목록 줄 · 글롭 · 경로 룰 없는 집합의 바이트 동일 |
| 크기 · 화면 | 크기 게이트 확장 · 상주 비용 줄 테스트, 각각 변이로 red |
| 결정 기록 | ADR-117(Amends ADR-116) |

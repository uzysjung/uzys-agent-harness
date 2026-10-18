# #513 GLM DeepSWE A/B — 중단 시점 결과 (2026-10-18 09:03 → 10-19 08:5x UTC)

**효과 판정이 아니다.** 사용자 결정(2026-10-19)으로 113 전수를 중단하고 "어려운 과제 표본 비교"로 바꿨다. 아래는 중단까지 끝난 짝이다(n 이 작아 §15 의 판정 규칙을 적용하지 않는다).

설정: effort max · 벽시계 2h · 턴 300(안전망) · 하네스 26.174.0 `--track base --cli claude` · B = 설치 + 같은 모델의 초기 정리 3회 · amd64 이미지(Rosetta). 원본 `~/eval-513/jobs/513-deepswe-<model>-{A,B}-full-<과제>` · 표 원본 `~/eval-513/full-partial-summary.json`.

## 과제별 짝 (reward · F2P)

| 과제 | 5.3 A | 5.3 B | Flash A | Flash B |
|---|---|---|---|---|
| ytt-jsonpath-query-api | 1 | 1 | 1 | 1 |
| goreleaser-retry-publish-auditing | 1 | 1 | 1 | 1 |
| drizzle-orm-window-function-builders | 1 | 1 | 1 | 1 |
| python-statemachine-state-data-scoping | 1 | 1 | 1 | 1 |
| awilix-async-container-initialization | 0 (23/24) | 0 (23/24) | 0 (23/24) | **1** |
| obsidian-linter-link-format-conversion | 0 (58/60) | 0 **커밋 없음** | 0 (59/60) | **1** |
| bandit-structured-nosec-directives | 0 (P2P 실패) | 0 **커밋 없음** | — | — |
| pest-character-class-coalescing | 0 (98/104) | 0 (101/104) | — | — |
| tengo-destructuring-bindings | **1** | 0 (86/91) | — | — |
| scriggo-method-declarations | 1 | 무효(환산 예산) | 무효(환산 예산) | 무효(환산 예산) |

- 유효 짝(예산 무효 제외): **GLM-5.3 9쌍 — A 5 · B 4**(갈린 짝 1: tengo A 만), **Flash 6쌍 — A 4 · B 6**(갈린 짝 2: awilix · obsidian B 만). 둘 다 표본이 너무 작아 방향도 확정 못 한다(§6).
- 둘 다 성공한 과제의 B/A 과제 세션 시간 중앙값: **5.3 1.55배 · Flash 1.61배**(범위 1.1–2.0). 입력 토큰 1.15 · 1.58배, 출력 1.33 · 1.39배. 여기에 B 의 초기 정리 중앙값 **5.3 8.2분 · Flash 19.4분**.

## 드러난 하네스 동작 — 비대화 실행에서 커밋 전에 끝난다

GLM-5.3 B 의 obsidian · bandit 두 건은 구현·테스트를 끝내고 **백그라운드 독립 리뷰어를 띄운 뒤 "리뷰 결과가 오면 커밋하겠다"로 턴을 끝냈다**(패치 0바이트). 두 세션 모두 `result` 줄이 하나뿐이다 — `claude --print` 가 백그라운드 **에이전트**의 완료로 세션을 다시 깨우지 않은 것으로 보인다(관측. 메커니즘은 미검증)(백그라운드 **명령**은 깨웠다 — 배관 시험 A textual). A 에는 이 패턴이 0건(백그라운드 에이전트 호출 0). 두 짝은 A 도 실패라 이번 점수는 바뀌지 않았지만, Flash B 는 같은 obsidian 을 통과했으므로 5.3 B 도 커밋했다면 통과했을 수 있다.

- 대화형 사용에서는 완료 알림이 다음 턴을 연다 — 설치자가 곧바로 잃는 것은 없다. **`claude -p` · CI · 무인 실행 설치자에게는 실재하는 실패**다(이슈로 올릴 후보).
- 평가 쪽 함의: 하네스의 리뷰 게이트가 "끝"을 늦추는 구조라, 무인 벤치마크는 그 비용을 실패로 센다. 비교 설계가 이것을 측정 대상(하네스의 결과)으로 볼지, 실행 방식의 산물로 볼지 먼저 정해야 한다.

## 그 밖의 관측

- `--max-budget-usd` 가 GLM 에서도 걸렸다(Claude 가격표 환산) — 정정 기록 = 설계 §15. scriggo 3 팔.
- 1113 · 실행기 중단 · 정리 실패 0. 키 유출 0(첫 과제 시점 검사).
- 과제당 A+B 벽시계: 5.3 약 1.4h · Flash 약 2.3h(동시 2, Rosetta).

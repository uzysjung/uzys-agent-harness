# PR-A (#739) 재리뷰 판정 — fix/agents-md-heading-owner @f0aa9e2 (1차 대상 267b1cc · 기준 main@6d6c8ec)

## 결론: PASS — BLOCKER 없음 (BLOCKER-1 해소)

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH (BLOCKER) | 0 |
| MEDIUM (NOTE) | 2 — 둘 다 main 에도 그대로 있는 기존 동작이고, 이 PR 은 바이트 하나 바꾸지 않는다 |
| LOW (NOTE) | 2 |

증거 파일: `rev-A/r2-evidence/`(분석 출력 · 스크립트 · 변이 로그 · ci 로그).

---

## 판정 항목별 결과

### 1. BLOCKER-1 해소 — 예
- **1차 재현 P1 을 f0aa9e2 에서 그대로 다시 돌렸다**(`zz-review-probe.test.ts.bak`, 실제 `runInstall(update)`): update 뒤 옛 제목(`## 1. Resolve what matters, then act`)은 0회이고 새 6원칙은 1벌만 있다. 2회차 update 결과는 바이트까지 같고, uninstall 뒤 파일은 지워진다. P2~P5 도 green 이다. 프로브는 실행 후 지웠다.
- **실제 npm 게시본으로도 확인했다**(아래 2): v26.151.0·v26.152.0 을 docker 에서 설치하고 고치지 않은 채 f0aa9e2 CLI 로 `update` ×2 → `uninstall --yes` 를 돌렸다. 옛 앵커 절은 0/6 이고 uninstall 뒤 파일이 지워진다. 같은 흐름에서 main·267b1cc 는 옛 6절이 남고 uninstall 뒤에도 파일에 남는다.
- 완료 기준 3(267b1cc 에서 red): 소스를 267b1cc 로 되돌리면(tsc exit 0) 새 회귀 테스트 ⓐⓑⓒ 3건이 red 다.

### 2. 지문 목록의 완전성 — 실제 게시본 전부를 대조했다. 빠진 판은 없다.
표본을 고르지 않고 **마커가 없는 npm 게시판 전부(26.83.0~26.159.0, 81판)**를 대조했다. `npm pack` 으로 받은 실제 tarball 을 docker(node:22) 안에서 `install --track tooling --cli codex --cli opencode --cli antigravity` 로 설치했다. 호스트에서는 실 CLI 실행이 훅에 막힌다. 설치한 뒤 **f0aa9e2 · 267b1cc · main 세 빌드의 실제 CLI** 로 `update` 두 번과 `uninstall --yes` 를 돌렸다. 판정은 기계로 했다. 옛 판 `## Project Rules` 영역의 절 중 지금 앵커에 없는 것을 골라, 정규화한 본문 전체가 update 결과에 들어 있는지 대조했다. 탐지기가 처음에는 템플릿 경로를 잘못 짚어 0을 냈다. 그래서 이름 집합이 비면 예외를 던지게 고쳤고, main·267b1cc 에서 양성(6~17절)을 잡는 것으로 탐지기가 제대로 무는지 확인했다.

| 판 범위 | 병합 경로 | f0aa9e2 update 뒤 옛 앵커 절 | uninstall | main 대비 |
|---|---|---|---|---|
| 26.151.0~26.152.0 (2판) | 절 병합(이번 수정 경로) | **0/6** | 파일 삭제 | main: 6/6 남음 · 파일 남음 |
| 26.133.0~26.150.0 (19판) | 절 병합 | **0/7~0/17** (판마다 다름) | 파일 남음. 남는 것은 옛 **템플릿** 꼬리 절 5개이고 앵커 절은 0 → NOTE-A | main: 7~17절이 남음 |
| 26.153.0~26.159.0 (7판) | 절 병합 | 은퇴 절 없음(앵커가 지금과 같다) | 파일 삭제 | 같음 |
| 26.83.0~26.132.0 (51판) | **블록 모델** — 이번 수정 경로를 안 탄다 | 17·16절 남음 | 파일 남음 | **세 빌드 결과 바이트 동일**(sha 일치) → NOTE-B |

- codex 단독과 opencode 단독 설치(26.133~26.159, 30판씩)에서도 결과가 같다. f0aa9e2 는 은퇴 절 0이고 2회차 update 결과가 바이트 동일하며, main 은 6~17절이 남는다. 블록 모델 판은 codex 단독 표본 4개(26.83·100·120·132)에서도 블록 모델이었다.
- 이 경로를 타는 판에서 마지막 앵커 절(`## Context Management` 등)도 지문과 맞는다. 처음에는 그 절이 어긋나 보였는데, 같은 이름을 쓰는 옛 **템플릿의** `## Context Management` 절을 잘못 대조한 것이었다.
- 범위 밖: 26.65~26.82 git 태그는 npm 에 게시되지 않아 대조하지 않았다(`npx github:` 경로). 생성기 범위는 v26.70 부터다.

### 3. 바이트 민감도 — 오판 없음
실제 설치본(26.152 · 26.140)의 AGENTS.md 를 바꾼 변형마다 f0aa9e2 로 update ×2 → uninstall 을 돌렸다.

| 변형 | 26.152 | 26.140 |
|---|---|---|
| CRLF 전체 · 줄 끝 공백/탭 · 끝 개행 없음 · BOM | 은퇴 절 0/6 · 2회차 동일 · 파일 삭제 | 은퇴 절 0/7 · 2회차 동일 |
| Harness Rules 앞에 빈 줄 3개 추가 | 0/6 · 삭제 | 해당 없음(그 절이 없다) |

설치기가 쓴 바이트 그대로인 경우는 위 표 2의 "고치지 않은 설치본" 행 전부가 덮는다.

### 4. 설치자가 고친 절은 남는다 — 예
- 옛 `## 3.` 절에 한 줄을 넣은 경우: update 뒤 그 절이 넣은 줄과 함께 남고, 나머지 은퇴 절은 0이다. uninstall 뒤에도 남는다(26.152 · 26.140).
- `## My rules` 를 더한 경우: update 뒤에도 uninstall 뒤에도 남는다(26.152).
- 단위 테스트 ⓒ 는 제목만 보도록 바꾼 변이(tsc exit 0)에서 red 이고, 다른 28건은 green 이다. 본문까지 보는지를 그 테스트 하나가 지킨다.

### 5. 이전에 통과한 것 — 그대로
대상 3파일 29건(heading-owner 7 · antigravity-anchor-retire 11 · #736 11)은 f0aa9e2 에서 모두 green 이다. 변이는 모두 tsc exit 0 에서 적용했고, 되돌린 뒤 `git diff --quiet f0aa9e2 -- src` 로 원상을 확인했다.

| 변이 | red |
|---|---|
| N2 걷기 호출부 `region: null` | 13 = 동일성 1 + ⓐ 1 + #736 11 |
| 병합 호출부 region 무력화(NOTE-2) | 6 = **동일성 테스트 포함**(1차에서는 green 이었다 → NOTE-2 반영 확인) + ⓐⓑⓒ + ① + ③ |
| 제목만 대조 | 1 (ⓒ) |
| 소스를 267b1cc 로 | 3 (ⓐⓑⓒ) |
| 소스를 6d6c8ec 로 | 7 = 동일성 · ② · ⓐⓑⓒ · ① · ③. ④ 는 main 에서도 남던 동작이라 green 이 맞다 |

### 6. `npm run ci` (파이프 없이, 로그 파일로)
exit **0**. 148 files / 2256 tests passed. branches 89.07(문턱 86).

---

## NOTE (블로커 아님)

**[NOTE-A · MEDIUM] 26.133~26.150 설치본: 옛 템플릿 자체의 꼬리 절 5개가 설치자 절로 되살아나고, uninstall 도 지우지 않는다. 기존 동작이다.**
대상은 `## Protected Files (DO NOT EDIT)` · `## Git Policy` · `## Agents (subagent)` · `## Experience Accumulation` · `## Context Management` 다. 모두 옛 템플릿이 `## Session Start` 뒤에 쓴 하네스 글이다. 고치지 않은 설치본을 update 하면 파일 끝에 붙고, uninstall 뒤에는 이 5절만 든 파일이 남는다(`r2-evidence/f0a-26.140-after-uninstall.md`). main 에서도 남는다. f0aa9e2 는 거기서 옛 앵커 절만 걷어 내 오히려 줄였다. 원인은 BLOCKER-1 · NOTE-1 과 같다: 지금 템플릿에 없는 이름을 설치자 것으로 본다(`headingOwner` 가 region=Session Start 에서 installer 를 낸다). 이 PR 의 수정 범위(Project Rules 앵커) 밖이므로 별도 이슈를 권한다. 같은 지문 방식(옛 템플릿 절)으로 덮을 수 있다.

**[NOTE-B · MEDIUM] 26.83~26.132 설치본(npm 51판): update 가 옛 파일 전체를 설치자 파일로 두고 하네스 블록만 덧붙인다. 옛 앵커 16~17절이 영구히 상주하고 uninstall 뒤에도 남는다. 기존 동작이고 이 PR 과 무관하다.**
세 빌드의 update 결과가 sha 까지 같다(`all-cli-3builds.txt`). 옛 원칙과 새 원칙이 함께 매 세션 상주한다. Codex AGENTS.md 예산 관점에서도 비용이다. 원인은 그 판들이 남긴 설치 기록으로는 `agentsMdModel` 이 `block` 이 되는 것으로 보인다(ADR-048 소유자 판정 도입 v26.133 이전). 원인은 확정하지 않았다. 설치자 디스크 원칙상 별도 이슈로 다룰 가치가 있다.

**[NOTE-C · LOW] 지문은 본문의 형식 변경에 민감하다.** 줄 끝 공백 · CR · 끝 빈 줄은 정규화한다. 하지만 md 포매터(prettier 등)가 목록 기호나 줄바꿈을 바꾼 파일은 "설치자가 고친 절"로 판정돼 옛 절이 남는다. 설계 의도("잃는 쪽보다 남는 쪽")대로의 동작이고 실관측 사례도 없어 기록만 한다.

**[NOTE-D · LOW] 1차 NOTE-3(설계서 §5·§8 문구)은 그대로 남아 있다.** 인계 문서에 이미 적혀 있다. 머지 전에 설계서나 PR 본문을 동기화해야 한다.

## 정리
- `wt2`: HEAD f0aa9e2 이고 `git status` 는 clean 이다. node_modules 심링크를 지웠다. 내 빌드로 덮인 `dist/`(gitignore 대상)도 지웠다.
- 설치·update 산출물(약 18 GB)은 내 scratchpad 에서 지웠다. 판정에 쓴 출력과 스크립트는 `rev-A/r2-evidence/` 에 남겼다.

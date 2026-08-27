# Test Policy

## 커버리지 하한 (Track 별)

| 영역 | 최소 커버리지 | 적용 Track |
|---|---|---|
| UI 컴포넌트 | 60% | csr-*, ssr-* |
| API 엔드포인트 | 80% | csr-*, ssr-*, data |
| 비즈니스 로직 | 90% | 전체 개발 Track |
| **이 repo (tooling)** | lines·functions·statements 90 / **branches 88** | SSOT: `vitest.config.ts` |

## 시점별 검증 (사용자 확정 2026-07-27)

커밋마다 전체를 돌리지 않는 대신 **머지와 배포에는 빠져나갈 구멍을 두지 않는다.**

| 시점 | 테스트 | 리뷰 |
|---|---|---|
| **커밋** | **없음** | — |
| **머지** | typecheck(전체) + 영향 범위 테스트 + **변경 파일** lint·format · 새 가드 도입 시 변이 테스트 | **독립 에이전트 리뷰 필수** |
| **배포(tag)** | 풀 테스트 + E2E + `ship-checklist` 전항 · **CI green 이 배포의 전제(`needs:`)** | **필수** |

**GitHub Actions 는 태그(`v*`) push 시에만 돈다 — PR 에는 CI 가 없다.** 머지 단의 방어는 로컬 실행 + 독립 리뷰가 전부이고, 배포 단의 `needs:` 배선이 마지막 방어선이다. 태그 push 후 릴리스 CI 는 `gh run view <run-id> --json conclusion` 으로 판정한다 — `gh run watch --exit-status` 는 실패한 run 에 exit 0 을 낸 실측이 있다(#377). 추가 릴리스 게이트 = `install-matrix.yml`(태그 + `workflow_dispatch`) — fresh-env 설치 매트릭스(OS×Node×pm + 멀티트랙 + npx github: smoke), First-Run Success 회귀 게이트. 머지 후 `gh workflow run install-matrix.yml --ref main` 로 검증.

`npm test` 만으로는 coverage gate 를 놓친다(v26.70.1 fail — branches 87.94% < 88%). `npm run ci` = typecheck + lint + test:coverage + build 이고 branches(88)가 가장 빡빡한 gate 다.

## 영향 범위를 도구·grep 으로 도출하지 마라 — 두 번 틀렸다

ⓐ `npx vitest related <문서·자산 파일>` 은 **0건을 고른다**(스위트 다수가 `readFileSync`/`readdirSync` 로 경로를 읽어 import 그래프 밖). 실측: `templates/CLAUDE.md` 한 곳을 고치자 **건드리지 않은 테스트 2개**가 깨졌다. ⓑ 룰 변경 후 `grep -rln "rules/" tests/` 로 고른 14개는 전부 green 이었는데 `tests/north-star-cost-figures.test.ts` 가 red 였다(그 파일엔 `rules/` 문자열이 없다). → **문서·자산 변경의 영향 범위 = 파일을 경로로 읽는 게이트 전체.** 고르기가 애매해지면 전체를 돌려라.

## `변이 테스트` = 입력 변이 (이 리포 확정 어휘)

새 가드를 넣었으면 **그 가드가 읽는 입력**을 일부러 위반 상태로 만들어 빨간불을 눈으로 본다. 가드의 검사 대상이 소스 코드면 그 소스를 되돌리는 **음성 대조**가 같은 자리를 맡고, 그때 되돌린 코드가 typecheck 를 통과하는지까지 확인한다 — 빌드 파손으로 난 FAIL 은 증거가 아니다.

## Dev-Prod Parity (필수)

개발/테스트 DB 엔진은 Prod 와 **동일**해야 한다. Prod 가 Postgres 면 테스트도 Postgres(testcontainer 또는 docker-compose). SQLite 대체 금지 — CI 속도·편의는 근거가 아니다. 테스트가 틀린 경우가 아니면 **구현을 수정하라, 테스트를 수정하지 마라.**

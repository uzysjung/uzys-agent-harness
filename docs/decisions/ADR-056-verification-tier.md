# ADR-056: 검증 실행을 3단 티어로 나눈다 — 작업 중 타깃 / 단위 종료 시 full 1회 / 배포 전 full + ship 게이트

- Status: Accepted
- Date: 2026-07-27
- PR: (머지 시 기재)
- Supersedes: — (없음. `test-policy.md` 의 *"ship/PR 전 반드시 전체 실행"* 한 줄을 정밀화)

## Context

사용자 지시(2026-07-27):

> *"CI는 배포 전에만 돌게 해줄래? 리뷰할 때 꼭 full CI 돌 필요 없잖아. 코드 작성한 부분에 대해서만
> 테스트가 돌면 되지 않을까. 리뷰와 테스트는 다르잖아."*

기존 규약은 `ship/PR 전 반드시 전체 실행` 한 줄이라 **"작업 중"과 "배포 전"을 구분하지 않았다.**
실제로 이 세션에서 4개 레인이 각자 full CI 를 돌렸다 — 같은 사실을 4번 산 셈이다.

그러나 "그럼 항상 타깃만"으로 가면 안 되는 이유가 **실측으로** 있다:

| # | 실측 | 값 | 출처 |
|---|---|---|---|
| 1 | `npx vitest related src/manifest.ts` | **30개 파일 선택 · 4.5s** — 소스 변경엔 타깃이 유효 | 구현 레인 재실행 |
| 2 | `npx vitest related templates/CLAUDE.md` | **0개** (`No test files found`) — 문서/자산 변경엔 **도구가 못 고른다** | 구현 레인 재실행 |
| 3 | `readFileSync`/`readdirSync` 로 파일을 읽는 테스트 | **83개 중 46개 (55%)** — import 그래프 밖이라 vitest 가 연결을 못 본다 | 구현 레인 재실행 |
| 4 | 사고: `templates/CLAUDE.md` 의 `Rule 1~12` 삭제가 **건드리지 않은** `doc-governance-baseline-rule`·`resident-doc-asset-reachability` 를 깼다. full 에서만 잡혔다 | — | 설계·검증 레인 보고. **구현 레인이 재현하지 않음**(재현하려면 타 작업 단위의 미커밋 파일을 변경해야 함) |

> **정정**: 착수 지시의 *"테스트 154개 중 46개"* 에서 **분모 154 는 틀렸다.** `vitest.config.ts` 의
> `include: ["tests/**/*.test.ts"]` 기준 실제 스위트는 **83개**다(154 는 `.dev-references/` ·
> `.claude/local-plugins/**/node_modules/` 의 벤더 파일이 섞인 수로 추정). 분자 46 은 일치.
> **비율은 30% 가 아니라 55%** — 즉 근거는 약해진 게 아니라 **더 강해졌다**.

## Decision

검증 실행을 **3단 티어**로 나눈다.

| 시점 | 무엇을 돌리나 | 누가 |
|---|---|---|
| 작업 중 · 리뷰 | `src` 변경 → `npx vitest related <파일>` · **문서/자산 변경 → 관련 게이트를 이름으로 지정**. full 금지 | 구현·리뷰 레인 |
| **작업 단위 종료 (커밋 직전)** | **`npm run ci` 1회** | **검증 레인만** |
| 배포 전 | `npm run ci` + `ship-checklist` 전항 | ship 레인 |

**왜 가운데 단이 필요한가** — 실측 2·3·4 가 그 자리다. `related` 는 문서·자산 변경에 **0건**을
고르는데, 스위트의 **55%가 파일을 직접 읽어** 그 변경에 실제로 반응한다. 즉 타깃 실행만으로는
**"고르지 못한 테스트가 깨지는" 사고(실측 4)를 원리적으로 못 본다.** coverage gate(branches 88)도
부분 실행으로는 평가되지 않는다. 배포 전까지 미루면 사고가 여러 커밋 뒤에서 발견된다.

## 적용 범위

| 축 | 범위 |
|---|---|
| 파일 | `.claude/rules/test-policy.md`(근거 전문) · `templates/rules/test-policy.md`(표 + 1줄) · 양 사본 `ship-checklist.md`(full 요구 지점 명시) |
| 레인 | 전 레인. **가운데 단의 실행 주체는 검증 레인**(구현 레인은 자기 산출물을 통과 선언하지 않는다 — ADR-054) |
| 트랙 | **dev 트랙만** — `test-policy`·`ship-checklist` 는 `DEV_RULES`(`src/manifest.ts`)라 executive·project-management·growth-marketing 에는 **도달하지 않는다** |
| CLI | **claude 전용**(`.claude/rules/`). opencode 는 claude 를 함께 선택했을 때만 `instructions` 글롭으로 읽고, **codex·antigravity 에는 도달하지 않는다** — 룰 파일은 앵커와 달리 임베드되지 않는다 |
| 범위 밖 | 릴리스 태그 CI(`v*`)·`install-matrix.yml` 트리거 조건 — **변경 없음.** GitHub Actions 는 그대로 태그 push 시에만 돈다. 커버리지 threshold 값(branches 88)도 불변 |

## Alternatives

| 대안 | 왜 기각 |
|---|---|
| ⓐ 항상 full (현행) | 이번 세션에 4개 레인이 각자 돌린 낭비. 사용자가 명시적으로 기각(*"리뷰할 때 꼭 full CI 돌 필요 없잖아"*) |
| ⓑ 항상 타깃 | **문서·자산 변경에서 `related` 가 0건을 골라 오늘의 사고(실측 4)를 놓친다.** coverage gate 도 평가 불가 |
| ⓒ `related` 자체를 개선 | **원리적으로 불가.** 스위트의 55%가 `readFileSync` 로 경로를 문자열로 읽는다 — import 그래프에 간선이 없으므로 정적 분석으로 연결을 만들 수 없다. 테스트를 전부 import 기반으로 재작성하는 것은 비용이 편익을 넘고, 파일 배치 자체를 검사하는 게이트는 본래 파일을 읽어야 한다 |

## Consequences

1. **상주 순증 `+116 tok`** (tooling: 6,323 → 6,439. **개수 축 29개 불변** — 새 파일 0). 배포판
   축약으로 -20 을 회수한 뒤의 값이다(초안 +136 → 확정 +116). ratchet 이 요구하는 *"룰 대신
   게이트/훅으로 착지시킬 수 있는지 먼저 확인"* 에 대한 답: **불가**. "언제 full 을 돌리나"는
   실행 주체의 판단 규칙이라 기계가 강제할 대상이 아니다 — 게이트로 만들면 "full 을 안 돌렸다"를
   무엇으로 검출할 것인가라는 더 어려운 문제가 된다.
2. **이 결정은 게이트로 강제되지 않는다 — 프로즈로만 산다.** `doc-governance` §검증 게이트의
   *"안 지켜져도 아무도 안 막는다"* 와 같은 지위다. 위반(레인이 full 을 건너뛰고 커밋)은
   **사후에만** 드러난다. 이것을 한계로 명시하는 이유는, 명시하지 않으면 다음 세션이 이 표를
   **강제되는 것**으로 오인하기 때문이다.
3. **근거 서술의 `.claude/` ↔ `templates/` 비대칭은 의도된 것이다.** 배포판에는 표 + 1줄만 두고
   (설치자에게는 원칙만 필요하다), 실측 수치·사고 서사는 `.claude/` 사본이 소유한다 —
   `no-false-ship` §*"templates/ 는 배포물이다"*. 두 파일은 원래도 서로 달랐다(배포판에는
   `npm run ci`·v26.70.1·`install-matrix` 가 없다).
4. **이 ADR 을 쓰는 중에 티어의 한계가 실제로 발현됐다 — 기록해 둔다.** 구현 레인이 룰 변경 후
   *"룰 파일을 읽는 테스트"* 를 `grep -rln "rules/" tests/` 로 도출해 14개를 타깃 실행했고 전부
   green 이었다. 그러나 `npx vitest related src/manifest.ts`(30개)를 돌리자
   **`tests/north-star-cost-figures.test.ts` 가 red** 였다 — 상주 토큰이 변하면
   `docs/NORTH_STAR.md` 의 수기 수치와 어긋나는데, 그 테스트는 `rules/` 문자열을 안 써서
   grep 도출에서 빠졌다. **즉 "관련 게이트를 이름으로 지정"의 정확도는 지정하는 사람의 도출
   품질에 달려 있고, 그것이 가운데 단(full 1회)이 필요한 두 번째 실증이다.**
5. **파생 의무**: 상주 토큰을 바꾸는 변경은 `context-cost-baseline.json`(ratchet)과
   `docs/NORTH_STAR.md` §현재 상태(수기 수치) **둘 다** 갱신해야 CI 가 green 이 된다. 전자는
   `npm run cost:baseline` 로 생성되지만 **후자는 자동 갱신되지 않는다**(스크립트는 baseline JSON
   만 쓴다). 이 비대칭이 다음 세션의 함정이 될 수 있어 명시한다.

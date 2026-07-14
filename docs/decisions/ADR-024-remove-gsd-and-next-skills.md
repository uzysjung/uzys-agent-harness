# ADR-024: 카탈로그에서 gsd-orchestrator·next-skills 제거

- Status: Accepted
- Date: 2026-07-14
- PR: (harness-audit Batch 2)
- Supersedes: (없음)

## Context

2026-07-14 harness-audit(6차원, 16/16 확정)가 두 계측 CI의 RED 방치를 확인했다. 원인은 두 카탈로그 자산의 upstream 실측 상태였다 (`gh api` 확인):

- **gsd-orchestrator** (`get-shit-done-cc`, 소스 `gsd-build/get-shit-done`) — 소스 repo가 **archived: true** (64.7k★이나 read-only, 마지막 push 2026-05-31). npm 패키지는 여전히 설치되나, Trust Tier 정의 "vetted = ★≥1000 **+ 활성**"의 *활성* 조건 위반. `trust-tier-drift.yml`이 `❌ demote (archived)`로 정확히 검출했으나 tier 라벨은 vetted로 방치돼 CI RED.
- **next-skills** (`vercel-labs/next-skills`, method skill) — 소스 repo는 active(955★)이나 **구조가 바뀌어 SKILL.md/skills 디렉토리가 사라짐**(현 top-level = AGENTS.md·CLAUDE.md·README.md). `npx skills add`가 설치할 skill이 없어 실제 설치 실패 → `catalog-verify.yml` RED (Promise=Implementation 위반). 그럼에도 COMPATIBILITY에서 🟢 Docker로 광고 중.

두 자산 모두 "광고 = 실동작"(no-false-ship) 및 North Star NSM(Promise=Implementation 100% / Trust Tier 정직성)을 위반한다.

## Decision

**두 자산을 카탈로그(`src/external-assets.ts` `EXTERNAL_ASSETS`)에서 제거한다.** 카탈로그 61 → **59**.

- 근거: 둘 다 "출처·설치 검증된 큐레이션"(ADR-021 정정 후 표현)의 반례 — 하나는 archived(활성 아님), 하나는 설치 불가. 큐레이션 부패(넣기는 쉽고 빼기는 안 함) 방지 원칙(M5)에 따라 제거.
- 사용자 결정: 2026-07-14 (Major CR — 자산 drop = 사용자 도달경로 변경. AskUserQuestion 2건 모두 "카탈로그에서 제거" 선택).
- 두 RED CI(catalog-verify·trust-tier-drift)가 GREEN으로 복구되고, 🟢 카운트가 정직해진다.

## Alternatives

- **gsd demote vetted→experimental (제거 대신)** — 기각(사용자). archived는 장기 방치 위험이라 opt-in 잔류보다 제거가 정직.
- **next-skills 재지정(re-point)** — 기각(사용자). vercel-labs 새 Next.js 자산 위치가 불확실하고 speculative. 깨진 자산을 유지한 채 조사하는 것은 no-false-ship 위반 지속.
- **현상 유지** — 기각. RED 방치 + 거짓 🟢 광고 = 차별화 wedge 자기배신.

## Consequences

- **긍정**: catalog-verify·trust-tier-drift GREEN 복구. 카탈로그 59 전량이 "설치 가능 + 활성" 조건 충족(정직성 회복).
- **후속 권장(본 커밋 미포함)**: "문서 자산수 == EXTERNAL_ASSETS.length" derive 테스트 게이트로 카운트 drift 를 구조적으로 차단하는 방안 — 이번 제거 커밋 범위 밖(사용자 지시 2026-07-14 "harness-only, 게이트 미진행"). 재발 시 재검토.
- **부정/리스크**: GSD(대형 프로젝트 오케스트레이션)·next-skills(Next.js 패턴) 용도 공백. 대체재 — 오케스트레이션은 BMAD/wshobson, Next.js는 react-best-practices/web-design-guidelines(vercel-labs, 유지). 향후 활성·설치가능 대체 자산 발견 시 재등재 가능.
- **문서 영향**: COMPATIBILITY(자동생성 regen + 수동 카운트) · WORKFLOWS(설치 워크플로 7→6) · REFERENCE · README/README.ko · index.html · service-audit-roadmap(58→59) · external-assets.test.ts(61→59).
- **범위 불변**: 역사적 GSD cherry-pick(gates-taxonomy rule 출처, `.dev-references/cherrypicks.lock`·PRD)은 카탈로그 자산과 무관하므로 유지.

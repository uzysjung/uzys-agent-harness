# ADR-026: compaction-handoff = 스냅샷 기반 재설계 (append 기반 폐기)

- Status: Accepted
- Date: 2026-07-15
- PR: (feat/compaction-handoff-snapshot)
- Supersedes: 없음 (동일 스킬 `templates/skills/compaction-handoff/SKILL.md`의 methodology 교체)

## Context

출하 스킬 `compaction-handoff`(official tier, has-dev-track, internal method — `templates/skills/`에서 4-CLI로 번들)의 기존 본문은 **"3 legs of a checkpoint"** 를 서술하면서 핵심 지시가 append 편향이었다. 사용자 지적(2026-07-15) 근거:

- **`Update the auto-memory (MEMORY.md) and any session-summary entry`** — 매 핸드오프를 단순 append로 구현하면 `MEMORY.md`가 작업 로그처럼 비대해진다.
- 스킬이 매 실행마다 상태 정보를 **누적**할 수 있는 경로가 열려 있었다: MEMORY.md에 이전 상태 계속 추가 / 핸드오프 기록 매번 신규 생성 / 사소한 결정까지 ADR / 매번 savepoint 커밋 / 과거 resume anchor를 새 컨텍스트에 반복 포함.
- 결과 실패모드: **최신 상태 식별 실패**(이전·현재 핸드오프 혼재), **전화게임식 정보 변형**(요약의 요약), **lost-in-the-middle**(최신 상태가 긴 파일 중간에 매몰), **불필요한 Git 노이즈**(실작업보다 savepoint가 더 많음), **재개 비용 증가**(새 에이전트가 여러 파일을 다시 읽고 상충 정리).
- 즉 스킬의 방향(핸드오프 자체)은 옳으나 **누적 방식과 보존 기간(retention policy)이 명시되지 않아** 반복 실행이 오히려 컴팩션 품질을 떨어뜨렸다.

핵심 제약: 이 스킬은 문서 자산이며 harness가 아니라 **사용자 프로젝트**에서 실행된다. 따라서 파일 크기·보존·idempotency 를 코드 게이트로 강제할 수 없고, **스킬 본문의 지시 계약**으로 규율해야 한다.

## Decision

**append 기반 핸드오프를 폐기하고 snapshot 기반으로 재설계한다.** 상태를 4계층으로 분리하고 각 계층의 보존정책과 idempotency 를 본문에 명시한다.

- **`.handoff/CURRENT.md` = 단일 resume 앵커, 매 핸드오프 덮어쓰기 (append 금지).** 4 고정필드(Current state / Verified / What's left / Next action) + References. 상한 **120줄 / 12KB**. 과거 앵커는 기본 비보존 — 필요 시에만 `.handoff/archive/`(retention 한도 적용, resume 시 자동 로드 금지).
- **`MEMORY.md` = 로그가 아니라 현재상태 인덱스.** durable fact(목적·스코프·불변제약·운영원칙) + active ADR/앵커 포인터만. 브랜치·테스트실패·태스크진척·raw output·완료 이력·과거 앵커 **제외**. 상한 **200줄 / 20KB**(저장소가 다른 상한을 정하면 그것). append-near-duplicate 대신 갱신·교체·superseded 제거.
- **ADR 생성 기준 엄격화.** 되돌리기 어려운 결정(아키텍처/의존성/데이터모델/API·호환성·마이그레이션 계약/보안 trust boundary/배포·운영책임/의도적 breaking)만. 브랜치 상태·태스크 순서·임시 workaround·테스트 실패·오늘 남은 작업은 ADR 대상 아님 → `.handoff/CURRENT.md`. 신규 생성 전 기존 ADR 검색 → 갱신·supersede 우선.
- **Git savepoint = 조건부.** 우선순위: ① 트리 clean이면 현재 의미커밋 재사용 → ② 완결 단위 의미커밋(승인 시) → ③ named stash(안전·승인 시) → ④ 최후에만 savepoint 커밋 → ⑤ 안전한 write 권한이 없으면 트리 미변경 + dirty·리스크 기록. 변화 없으면 재savepoint 금지, 무관 파일 stage 금지.
- **Resume 시 과거 핸드오프 자동 재주입 금지.** 로드 대상 = 저장소 지시(CLAUDE.md 등) + MEMORY.md + `.handoff/CURRENT.md` + 앵커가 참조한 ADR + 현재 git·open-PR 상태 + 다음 액션에 필요한 소스만. Git이 앵커와 충돌하면 Git 우선, 불일치는 진행 전 보고.
- **Idempotency 계약 + failure-handling 명시.** 재실행이 CURRENT.md를 교체(append 아님)·MEMORY.md fact 갱신(중복 아님)·ADR 재사용·불필요 savepoint 미생성·파일 크기 안정을 만족해야 한다. 도구/저장소 접근 불가 시 git/PR/CI/test 상태를 **날조 금지**, 미확인은 `not verified`, atomic 체크포인트를 주장 금지(no-false-ship 정합).

## Alternatives

- **현상 유지(append 기반 3-leg)** — 기각. 사용자가 관찰한 상태 누적·최신성 상실·Git 노이즈를 방치. 스킬을 반복 실행할수록 컴팩션 품질이 하락.
- **MEMORY.md만 상한 두고 나머지 유지** — 기각. 앵커 중복·과거 핸드오프 자동 재주입·무조건 savepoint 라는 나머지 누적원을 남긴다(부분 해결).
- **코드 게이트로 크기·idempotency 강제** — 부적용. 스킬은 사용자 프로젝트에서 실행되는 문서 자산이라 harness CI가 사용자 측 `.handoff/`·`MEMORY.md` 를 검사할 수 없다. 계약은 본문 지시로만 성립.
- **별도 신규 스킬 신설** — 기각. 동일 트리거·동일 목적. 카탈로그 자산 수(59)·설치 경로·광고 문구를 불변으로 두고 본문만 교체하는 것이 표면 최소(no-false-ship: 광고=실동작 유지).

## Consequences

- **긍정**: 매 실행이 idempotent — 상태파일이 무한 증식하지 않는다. 최신 상태가 단일 앵커(`.handoff/CURRENT.md`)에 있어 lost-in-the-middle·전화게임 변형이 구조적으로 감소. MEMORY.md가 durable index로 유지되어 recall 신호대잡음비 개선. Git 노이즈(무조건 savepoint) 제거. `/compact` 라인이 요약이 아니라 앵커 포인터로 축소.
- **드리프트 차단**: 출하 SSOT = `templates/skills/compaction-handoff/SKILL.md` 단일 파일(installer가 4-CLI로 복사). `.claude/skills/compaction-handoff/SKILL.md` dogfood 사본은 `.gitignore`에 `.claude/skills/`가 있어도 **이미 tracked**(ignore 규칙은 기추적 파일에 무효) → 커밋된다. 그러나 npm `files: ["dist","templates",…]`는 `templates/`만 출하하므로 dogfood 사본 drift는 **사용자에게 도달 불가**. 단 gitignore도 테스트도 두 tracked 사본의 미래 divergence를 능동 차단하지 않음(현재 byte-identical, governance-only 리스크 — dev-method dogfood 사본 전반의 기존 패턴). body-content 테스트 없음 → 본문 교체가 기존 테스트를 깨지 않음. 자산 id/tier/category/method 는 불변이라 `tests/external-assets.test.ts`(dev-method 7종 게이트) 통과 유지.
- **부정/리스크**: (a) `.handoff/CURRENT.md`는 사용자 프로젝트에 생성되는 산출물 — 사용자가 커밋 여부를 결정. 본 repo dogfood 는 `.gitignore .handoff/` 로 세션 스크래치 처리(main 오염 0). (b) 보존 상한(120/200줄)은 지시 계약이라 실행 에이전트가 이를 무시하면 강제되지 않음 — 사용자 프로젝트에 코드 게이트를 심을 수 없다는 자산 특성상 불가피(문서 자산의 한계, 스킬 본문 Validate 단계로 self-check 유도). (c) 프론트매터 description 이 기존의 "proactively ~80% window" 명시 트리거를 축약 — 본문 Trigger 섹션이 proactive 사용을 커버하나, description 레벨 트리거 신호는 다소 약화(사용자 채택 원문 유지, 후속 조정 여지).
- **언어**: 본문·앵커 템플릿·retention 규칙 = 영어(공개 npm 패키지, 기존 출하본·`templates/CLAUDE.md`·콘솔 컨벤션 일치). 프론트매터는 한국어 트리거 구문 보존.
- **문서 영향**: CHANGELOG v26.97.0, `.gitignore`(`.handoff/`). README/COMPATIBILITY 의 한 줄 자산 설명("persist durable state + git snapshot + resume anchor before a context `/compact`")은 새 본문도 그대로 수행하므로 불변.

# pstack 원칙 vs 하네스 원칙 — 원칙별 효과 대조 (#962 후속)

- 작성일 2026-11-08 · 하네스 기준 `main` 10c52b5 (v26.184.0) · pstack 기준 cursor/plugins `6b03002` (2026-11-07) · pstack-claude 포트도 원칙 24종 동일
- **개수 정정: 원칙은 23종이 아니라 24종이다.** 상류 README 가이드 08 과 `poteto-mode` 색인이 24 라고 적고, `skills/principle-*` 디렉터리도 24 개다. Flavio 글(2026-09-29 갱신)의 "23 small principle skills" 가 옛 수다.
- 원문 출처 접두 **C** = `https://github.com/cursor/plugins/blob/6b0300214a09fd6029cfb7077043125758cd1fd2/pstack/skills/` — 각 원칙은 `C<id>/SKILL.md`
- 하네스 기준 파일: 앵커 `templates/CLAUDE.md`(5,394 B · 4 CLI 매 세션 상주 · Codex 는 `AGENTS.md` 인라인) · 상시 룰 `templates/rules/*.md` · 에이전트 `templates/agents/*.md`(Claude Code 전용) · 번들 스킬(발화 시만)
- 근거 등급 표기: **[리포 관측]** 이 리포의 ADR·연구·메모리에 기록된 관측 · **[벤더 측정]** 벤더가 수치로 보고 · **[벤더 권고]** 벤더 문서의 권고 문장(측정 없음) · **[연구]** 공개 논문 · **[없음]** 어느 쪽도 없음 — 수치는 출처에 있는 것만 적었다
- 검증(오케스트레이터 2026-11-08): 앵커 인용 줄 · 벤더 Overeagerness 샘플 문안(platform.claude.com prompting best practices — "If you're seeing this undesired behavior" 조건부) · 사용자 전역 원칙 두 문장 대조 일치. "경우를 덧대기 전에 구조" 는 implementer 에만 있어(reviewer 아님) 그 부분을 정정했다

---

## 1. 결론

1. 24종 중 **같은 상황에서 반대로 미는 충돌은 8건**이고, 8건 모두 **하네스 문안이 더 효과적**이다 — 반대쪽 pstack 원칙(최소 diff · 빼고 더하기 · 처음부터 재설계 · 도구부터 만들기 · 프로토타입 2~3개 · 되돌릴 수 있으면 묻지 않기 · 구조로만 교정 · 옛 API 즉시 삭제)은 벤더가 최신 모델에서 **과잉 공사·과잉 탐색·과잉 검증**으로 측정·경고한 방향이거나, 비용을 재지 않는 무조건 지시다.
2. pstack 이 **더 낫게 말하는 자리는 셋**이다 — 근본 원인(가드는 그 상태가 정당할 때만 수정이다) · 전제 공격(같은 전제의 수정이 두 번 실패하면 전제를 시험한다) · 경계 규율(검증은 신뢰 경계에서만). 셋 다 **사용자의 전역 6원칙에는 이미 같은 뜻의 문장이 있는데 배포 앵커(#463 문안)에서 빠진 것**이라, 차용이 아니라 **복원**에 가깝다.
3. 권고는 앵커 두 곳 **+392 B(~98 tok/세션)** 뿐이다 — §5 에 진단 갱신·근본 원인 두 문장, §3 에 경계 검증 한 문장. 나머지 21종은 KEEP-HARNESS(13) · 모델 기본 역량이라 상주 안 함(6) · 보류(2 — 수치 설명은 관측 시 스킬, 테스트 행동 단언은 선택).
4. 문장이 행동을 바꾸는지는 **이 둘 다 측정이 없다**. 리포가 가진 측정 근거는 "실패 행동을 이름으로 짚은 구체 문장만 효과가 측정됐다"(ADR-115) 와 "같은 세션 리뷰 5회차가 경우 덧대기로 소모됐다"(메모리 2026-10-12 · model-evidence E-07)이고, 권고 문안은 그 형태(이름 짚기)로 썼다.
5. pstack 원칙을 스킬 24개로 들이는 안은 앞선 평가대로 기각이 맞다 — pstack 자신도 `disable-model-invocation: true` 로 모델 자동 발화를 끄고 `poteto-mode` 가 색인을 읽을 때만 쓴다. 우리 4 CLI 에선 그 색인(poteto-mode) 이 없으니 24개 descriptor 만 상주하고 본문은 영영 안 열린다.

---

## 2. 원칙 대조표 (24종 전부)

분류: **같음** · **하네스가 더 넓음** · **pstack 추가분** · **충돌**(같은 상황에서 반대로 민다)

| # | pstack 원칙 (출처 C`…`) | 한 줄 뜻 | 가장 가까운 하네스 자리 | 분류 | 판정 |
|---|---|---|---|---|---|
| 1 | Laziness Protocol (`principle-laziness-protocol`) | 결정은 한 곳에 · **diff 최소화, 적은 줄이 우아한 보일러플레이트를 이긴다** | 앵커 §2:23 "simplest sufficient" · §3:47-50 "coherent solution over an arbitrarily small diff" | **충돌** (diff 크기 축) | KEEP-HARNESS |
| 2 | Foundational Thinking (`principle-foundational-thinking`) | 자료구조 먼저 · 스캐폴드 먼저 · 작은 커밋 | 없음(공학 일반론) | pstack 추가분 | 상주 안 함 — 모델 기본 역량 |
| 3 | Redesign from First Principles (`principle-redesign-from-first-principles`) | 새 요구를 덧대지 말고 처음부터 있던 것처럼 재설계 | §2:23 simplest sufficient · §3:47-50 necessary integration | **충돌** | KEEP-HARNESS |
| 4 | Attack the Premise (`principle-attack-the-premise`) | 같은 전제의 수정이 2회 실패 → 전제를 적고 시험 | §5:86 "Use unexpected results to update the diagnosis or approach" | pstack 추가분 (구체 방아쇠) | **MERGE** (§5) |
| 5 | Subtract Before You Add (`principle-subtract-before-you-add`) | 빼고 나서 더한다 · 단순화를 **상시 투자**로 | §2:23 · §3:49-50 "unrelated cleanup … outside the task" | **충돌** (상시 단순화 축) | KEEP-HARNESS |
| 6 | Minimize Reader Load (`principle-minimize-reader-load`) | 층 수·숨은 상태를 센다 · 호출자 1개 래퍼 접기 | `templates/agents/reviewer.md` Step 2 bullet(관례 대비 크기 · 더 단순한 구조) | pstack 추가분 | 상주 안 함 — 모델 기본 역량 |
| 7 | Outcome-Oriented Execution (`principle-outcome-oriented-execution`) | 계획된 마이그레이션은 중간 깨짐을 허용, 끝 상태로 수렴 | §3:52-53 preserve contracts unless authorized · §4:67-69 difficult-to-reverse | pstack 추가분 (상황 한정) | 상주 안 함 |
| 8 | Experience First (`principle-experience-first`) | 구현 편의보다 사용자 결과 · 적게 다듬어서 · 사용자 = 소비자 전부(유지보수자 포함) | §1:12-19 intended user's goal · essential readiness vs optional polish · 스킬 `user-centered-explanation` | 하네스가 더 넓음 (폴리시 축만 약한 충돌) | KEEP-HARNESS |
| 9 | Exhaust the Design Space (`principle-exhaust-the-design-space`, 상류 본문 1문장 스텁) | 전례 없는 결정은 프로토타입 2~3개 | §1:13-15 ground decisions in evidence · 스킬 `multi-model-debate` | **충돌** (항상 2~3개 vs 충분한 가장 단순한 안) | KEEP-HARNESS |
| 10 | Build the Lever (`principle-build-the-lever`) | 사소하지 않으면 **기본값이 도구 제작**(codemod·스크립트) · 인용했는데 diff 에 도구 없으면 미적용 | §2:24-26 tools where benefit outweighs cost · §5:77 actual artifacts | **충돌** | KEEP-HARNESS |
| 11 | Model the Domain (`principle-model-the-domain`) | 조건문 대신 상태기계·타입·테이블 | 없음 | pstack 추가분 | 상주 안 함 — 모델 기본 역량 |
| 12 | Boundary Discipline (`principle-boundary-discipline`) | 검증·에러 처리는 경계에서만 · 내부 타입은 신뢰 | §4:58-60 protections users depend on(뜻이 다름) · reviewer Step 2 · implementer "경우를 덧대기 전에 구조" | pstack 추가분 | **MERGE** (§3) |
| 13 | Type System Discipline (`principle-type-system-discipline`) | 불가능 상태를 타입으로 배제 · 브랜드 · 스키마에서 파생 | 없음 | pstack 추가분 | 상주 안 함 — 언어별 craft |
| 14 | Make Operations Idempotent (`principle-make-operations-idempotent`) | 두 번 돌아도 · 중간에 죽어도 같은 끝 상태 | `templates/rules/test-policy.md:22-23` high-risk 에 state transitions · migrations | pstack 추가분 | 상주 안 함 |
| 15 | Migrate Callers Then Delete Legacy APIs (`principle-migrate-callers-then-delete-legacy-apis`) | 새 내부 API 도입 시 호환층 없이 같은 파도에서 옛것 삭제 | §3:52-53 preserve contracts unless authorized | **충돌** (조건부) | KEEP-HARNESS |
| 16 | Never Block on the Human (`principle-never-block-on-the-human`) | 되돌릴 수 있으면 묻지 말고 진행 후 제시 · 비가역만 확인 | §2:28-32 (ADR-115 문안) · §6:98-101 | 하네스가 더 넓음 (중대한 미해결 선택 축에서 **충돌**) | KEEP-HARNESS |
| 17 | Prove It Works (`principle-prove-it-works`) | 대리 지표 아닌 실물 확인 · 검증 실패 시 관측 방법부터 의심 · 가능하면 스크립트 | §5:77-79 actual artifacts · Delivery 룰 :6 "실행하지 않은 상태는 통과가 아니다" · doc-governance :7 + `check-absence.sh` | 같음 / 하네스가 더 넓음(도구) | KEEP-HARNESS |
| 18 | Fix Root Causes (`principle-fix-root-causes`) | 재현 → why 추적 → **가드는 그 상태가 정당할 때만 수정** · 패턴 전체 수정 · 재시작 후 실패는 영속 상태 의심 | §5:86 (진단 갱신 한 문장) · implementer "경우를 덧대기 전에 구조"(Claude Code 만) | pstack 추가분 | **MERGE** (§5) |
| 19 | Sequence Verifiable Units (`principle-sequence-verifiable-units`) | 단위마다 검사 후 다음 · 실패 테스트 → 수정 순서로 전달 | §2:38-43 (ADR-110 문단) · implementer "편집 직후에 확인" · "변경이 없으면 실패" | 같음 | KEEP-HARNESS |
| 20 | Test Behavior, Not Implementation (`principle-test-behavior-not-implementation`) | 두 가상 편집(행동 깨기 · 내부 바꾸기)으로 테스트 판정 · 기대값은 요구에서 | test-policy :31-34 (단언 약화 금지) · implementer 종료 조건 | pstack 추가분 (리팩터 내성 절반) | 선택 — 최소 집합 밖 |
| 21 | Explain the Number (`principle-explain-the-number`) | 재기 전에 결정을 적고 · 한계 자원을 대고 · 다른 걸 잰 가능성을 배제 | 없음(배포판) · 개발 사본 "수치는 before → after" | pstack 추가분 | 보류 — 관측 시 ADD-AS-SKILL (앞선 평가 A05 와 같음) |
| 22 | Guard the Context Window (`principle-guard-the-context-window`, 상류 본문 1불릿 스텁) | 대량 출력은 서브에이전트로 · 요약만 본 스레드에 | 스킬 `model-orchestration` §1·§3 · `compaction-handoff` | 같음 (스킬) | KEEP-HARNESS |
| 23 | Encode Lessons in Structure (`principle-encode-lessons-in-structure`, 상류 본문 2문장 스텁) | 같은 지시를 두 번 쓰면 린트·검사·스크립트로 · "지시는 증상" | NORTH_STAR §1 "반복 실수는 룰 · 심각한 실수는 훅" · 스킬 `recurrence-prevention` · test-policy :12-16 최소 부담 보호 | **충돌** (구조만 vs 증거 비례) | KEEP-HARNESS |
| 24 | Separate Before Serializing Shared State (`principle-separate-before-serializing-shared-state`) | 동시 행위자가 같은 파일·브랜치·키를 쓰면 공유부터 없애고, 진짜 불변식일 때만 구조적으로 직렬화 — "지시와 관례는 동시성 제어가 아니다" | 스킬 `model-orchestration` §3 "Different files are insufficient if …"(공유 테스트 자원 격리) · 메모리 "병렬 리뷰 레인은 워크트리를 격리한다"(리포 관측 — 같은 워크트리 변이로 관측 4건 폐기) | 같음 (스킬) | KEEP-HARNESS |

상류 분류로 세면 Core 10(1~10) · Architecture 6(11~15 · 24) · Verification 5(17~21) · Delegation 2(16 · 22) · Meta 1(23) = 24.

집계: **충돌 8**(1·3·5·9·10·15·16·23) · **pstack 추가분 11**(2·4·6·7·11·12·13·14·18·20·21) · **같음 / 하네스가 더 넓음 5**(8·17·19·22·24). 추가분 11 중 MERGE 3(4·12·18) · 보류 2(20·21) · 상주 안 함 6.

---

## 3. 충돌 · 추가분 상세

형식: 상황 → 어느 쪽이 이기나 → 근거(등급) → 비용 → 판정(문안)

### 충돌 8건 — 전부 KEEP-HARNESS

**C1. Laziness Protocol ↔ §3 "coherent over arbitrarily small diff"**
- 상황: 버그의 원인이 세 곳에 복제된 판정 하나다. pstack 은 "diff 최소화 · 적은 줄"을 말하면서 같은 파일에서 "결정은 한 곳에"도 말한다 — 두 불릿이 이 상황에서 서로 반대다. 하네스는 "필요한 통합·국소 단순화는 포함, 무관한 정리는 밖"으로 한 번에 가른다.
- 이기는 쪽: 하네스. pstack 쪽의 "적은 줄" 은 표면 패치를 낳고, 그것은 pstack 자신의 Fix Root Causes 와도 충돌한다.
- 근거: [연구] arXiv 2604.11088 — 룰 18개 제거 실험에서 가장 큰 단일 효과는 'do not refactor unrelated code' 제거 시 −20pp(p=0.016, 다중비교 보정 뒤 비유의). 하네스 §3:49-50 이 그 룰과 같은 뜻이다. [벤더 권고] Codex 기본 지시문은 최소 diff 편향 — §3 의 "coherent" 는 Codex 에서 반대로 당기는 문장이다(`docs/research/working-principles-2026-11.md` 결과 끝 항목). 이 긴장은 실재하지만 pstack 문안으로 바꾸면 Codex 와 같아질 뿐 Claude 쪽 과잉 공사는 막지 못한다.
- 비용: 변경 0.
- 판정: **KEEP-HARNESS**.

**C2. Subtract Before You Add ↔ §3 "unrelated cleanup outside the task"**
- 상황: 기능 추가 대상 모듈 옆에 죽은 코드가 있다. pstack "단순화를 상시 투자로 · 찾았을 때보다 단순하게 두고 나와라"(보이스카우트) vs 하네스 "무관한 정리는 밖".
- 이기는 쪽: 하네스. 범위 안의 죽은 코드 제거는 하네스 §3 "local simplification" 이 이미 허용하고, 범위 밖 상시 정리는 위 C1 의 −20pp 룰이 막는 바로 그 행동이다.
- 근거: [연구] 위와 같음. [벤더 권고] Anthropic 프롬프팅 모범사례 §Overeagerness — Opus 4.5·4.6 은 "extra files, unnecessary abstractions, flexibility that wasn't requested" 경향이라 "A bug fix doesn't need surrounding code cleaned up" 문장을 권한다.
- 비용: 0. 판정: **KEEP-HARNESS**.

**C3. Redesign from First Principles ↔ §2 "simplest sufficient"**
- 상황: 기존 설정 로더에 플래그 하나를 더한다. pstack "처음부터 있던 것처럼 로더를 재설계하고 타입·문서·예시·근거 절까지 전파" vs 하네스 "검증된 사용 가능한 결과까지의 시간을 고려한 가장 단순한 충분안".
- 이기는 쪽: 하네스. 재설계 지시는 Opus 세대의 과잉 공사 경향을 키우는 방향이고, "전파"의 좋은 절반(문서 동기화)은 `doc-governance:4` 가 이미 머지 단위로 요구한다.
- 근거: [벤더 권고] Anthropic §Overeagerness(위) · [벤더 측정] Opus 5 가이드 — 작업을 요청 밖으로 넓히는 경향, 범위 지시 권고(`working-principles-2026-11.md` 결과). [리포 관측] 메모리 "경우를 덧대지 말고 구조를 바꿔라" — 리포가 겪은 문제는 재설계 부족이 아니라 **경우 덧대기**였고 그것은 C-MERGE-1(근본 원인) 이 맡는다.
- 비용: 0. 판정: **KEEP-HARNESS**.

**C4. Build the Lever ↔ §2 "tools where benefit outweighs cost"**
- 상황: 12개 파일 이름 바꾸기. pstack 기본값 = codemod 작성 · "인용했는데 diff 에 스크립트가 없으면 미적용" vs 하네스 = 이득이 복잡성·조정 비용을 넘을 때만.
- 이기는 쪽: 하네스. 재실행 가능한 검사가 눈대중보다 낫다는 pstack 의 핵심은 맞지만, "기본값이 도구"는 산출물(파일)을 늘리고 벤더가 반대로 권하는 자리다.
- 근거: [벤더 권고] Anthropic §Avoid focusing on passing tests — "Do not create helper scripts or workarounds to accomplish the task more efficiently" · §Reduce file creation in agentic coding. [연구] ETH arXiv 2602.11988 — 컨텍스트 파일 지시는 단계·비용을 늘렸고 성공률은 그대로(지시를 **잘 따랐기 때문**). 도구 제작 기본값은 그 비용 축을 키운다.
- 비용: 0. 판정: **KEEP-HARNESS**.

**C5. Exhaust the Design Space ↔ §2 simplest sufficient**
- 상황: 전례 없는 UI 상호작용. pstack "프로토타입 2~3개 병렬 제작 후 비교" vs 하네스 "가장 단순한 충분안 · 가정은 드러낸다".
- 이기는 쪽: 하네스(기본값으로서). 2~3개는 비용 상수를 고정하는 지시다. 결정적 가정만 가장 작은 프로토타입으로 시험하는 것은 **사용자 전역 원칙에 이미 있는 문장**("Test unresolved assumptions … through the smallest useful research or prototype before costly commitments") 이고 배포 앵커엔 없다 — §4 "하네스가 약한 자리" 참조.
- 근거: [벤더 권고] Anthropic §Overthinking — "choose an approach and commit to it … You can always course-correct later". [리포 관측] 앞선 평가 A08 이 pstack `architect`(최소 두 설계) 를 같은 이유로 기각.
- 비용: 0. 판정: **KEEP-HARNESS**.

**C6. Never Block on the Human ↔ §2:28-32 (ADR-115 문안)**
- 상황: 요구가 두 갈래로 읽히고 갈래에 따라 결과물이 달라진다. pstack "되돌릴 수 있으면 진행 후 제시" vs 하네스 "중대한 결과가 있는 미해결 선택은 합의된 의도·권한 안에서 안전하게 정할 수 없을 때 묻는다".
- 이기는 쪽: 하네스. 두 문안은 "routine 은 묻지 않는다" 에서 같고(ADR-115 가 벤더 측정으로 구체화), 갈림은 "중대한 두 갈래" 뿐인데 그 자리는 벤더도 하네스 쪽이다.
- 근거: [벤더 측정] ADR-115 Context ⓑ — Sonnet 5.5 low·medium 에서 "끝내기 전에 멈추고 확인" 실패를 벤더가 측정했고 실패를 이름으로 짚은 문장으로 고쳐졌다 → §2 문안의 근거. [벤더 권고] Opus 5 가이드 — "check in only when different readings lead to materially different work"(`working-principles-2026-11.md`) = 하네스 문안. GPT-5 가이드의 "Do not ask the human to confirm or clarify assumptions" 는 **더 적극적으로 만들고 싶을 때** 넣는 블록이고 같은 문서가 "stop conditions · safe vs unsafe actions 를 적으라"고 한다. [리포 관측] ADR-110 실험 — 두 앵커 모두 승인 없이 설계서 원본에 한 줄을 넣었다(묻지 않는 쪽의 실제 실패).
- 비용: 0. 판정: **KEEP-HARNESS**.

**C7. Encode Lessons in Structure ↔ recurrence-prevention · NORTH_STAR §1**
- 상황: 같은 포맷 실수가 두 번째. pstack "린트·검사·스크립트로 · 지시는 증상 · 구조적 수정이 있으면 그것만" vs 하네스 "증거에 비례 — 기록 · 한 줄 기준 · 코드 수정 · 구조 게이트 중 프로즈가 실패했음이 입증됐을 때 더 결정론적으로".
- 이기는 쪽: 하네스. **방향은 pstack 이 리포의 측정과 일치한다**(NORTH_STAR §1: 사고 기록에서 주어가 룰·프로즈면 검출 0건, 게이트·테스트·레인이면 7건 · ADR-090: 룰 44문장 중 행동을 바꿨다는 관측 0). 그러나 하네스는 그 측정을 이미 반영했고(심각한 실수 → 훅, 반복 실수 → 룰, `recurrence-prevention` 의 "more deterministic when prose has demonstrably failed") **구조의 비용도 쟀다** — 루트 `CLAUDE.md` 함정 1 "로컬에 차단 훅을 더 얹지 마라: 명령마다 검사 · 우회 플래그 · 클론마다 재설치". pstack 의 무조건 "구조만"은 그 비용 축이 없다.
- 근거: [리포 관측] 위 둘 + test-policy :12-16(최소 부담 보호, 사용자 확정 #496). [벤더 권고] Claude Code memory 문서 — "Add to it when Claude makes the same mistake a second time"(프로즈 우선을 벤더가 권한다).
- 비용: 0. 판정: **KEEP-HARNESS**.

**C8. Migrate Callers Then Delete Legacy APIs ↔ §3 preserve contracts unless authorized**
- 상황: 새 내부 API 도입, 옛 호출자 잔존. pstack "같은 파도에서 옛 API 삭제(외부 사용자 없을 때)" vs 하네스 "계약·의도된 동작은 승인 없이 바꾸지 않는다".
- 이기는 쪽: 하네스. pstack 의 조건("외부 사용자 없음")은 에이전트가 저장소 안에서 판정할 수 없다 — ADR-068 이 같은 문장("Delete verified-unused paths")을 넣을 때 "공개 API 는 정의상 저장소 안 호출자 0건이라 조건 없이는 공개 표면 전체가 삭제 대상"이라 판별자를 저장소 경계로 고정한 전례가 있다. 요청된 리팩터 안에서의 삭제는 하네스 §3 "necessary integration" 이 이미 허용한다.
- 근거: [리포 관측] ADR-068 Decision 3. 측정 없음.
- 비용: 0. 판정: **KEEP-HARNESS**.

### pstack 추가분 — MERGE 3건 (앵커 두 곳)

**M1 + M2. Fix Root Causes · Attack the Premise → 앵커 §5:86**
- 상황: 간헐 null 에러. 수정 1(가드 추가) 실패 · 수정 2(다른 가드) 실패. 하네스 현 문안 "Use unexpected results to update the diagnosis or approach" 는 방향만 말한다. pstack 은 두 방아쇠를 이름으로 짚는다 — ① 가드는 그 상태가 **정당하게 생길 수 있을 때만** 수정이고 아니면 생성 지점을 찾는다 ② 같은 전제의 수정이 두 번 실패하면 전제를 적고 시험한다.
- 이기는 쪽: pstack(이 상황 한정). 리포가 가진 유일한 "문장 효과" 측정은 **실패 행동을 이름으로 짚은 문장**에서만 나왔다(ADR-115 Context). 현 §5 문장은 추상형이다.
- 근거: [리포 관측] 메모리 2026-10-12 "경우를 덧대지 말고 구조를 바꿔 경우를 없애라" — PR-B +457줄 · #911 5회차 · #918 5회차(회차 4 는 회귀 생성) · model-evidence E-2026-10-25-07 "비용은 모델이 아니라 회차 수를 따라갔다 — 회차마다 새 조합의 가드". 그 관측으로 implementer 에 "경우를 덧대기 전에 구조" 를 넣었는데 **그 파일은 Claude Code 에만 깔린다**(`src/manifest.ts` 에이전트 경로 · 앞선 평가 §3 서두). Codex·OpenCode·Antigravity 설치자에겐 그 교훈이 닿지 않는다. [벤더 권고] GPT-5 프롬프팅 가이드 Terminal-Bench 지시 "Fix the problem at the root cause rather than applying surface-level patches, when possible" · Codex 기본 지시문에도 같은 뜻(Codex 에선 중복이나 무해). [사용자 전역] `~/.claude/CLAUDE.md` §1 "Investigate unexpected results before proposing another fix. Do not stack speculative fixes without updating the diagnosis." — 사용자 본인의 원칙에 있고 #463 배포 문안에서 빠졌다. **측정: 없음**(이 문장이 회차를 줄이는지는 미관측).
- 비용: **+236 B(~59 tok/세션, chars/4 규약)**. 4 CLI 전부 상주. Antigravity 24,000 B 절단은 #944(PR #946) 로 룰 사본이 끝으로 갔으므로 잘리는 쪽은 룰 사본이다. Codex 32 KiB 합계 상한엔 영향 없음(단일 트랙 3 CLI 렌더 21~23 KB, #944 표).
- 판정: **MERGE** — §5 두 번째 문단을 아래로(앵커 어투 · 영문). 바꾸는 문장은 사용자 문안이므로(ADR-091 결정 1) 이슈로 문안을 제시하고 채택 여부는 사용자가 정한다.

  before (`templates/CLAUDE.md:86-87`)
  ```
  Use unexpected results to update the diagnosis or approach. When no productive,
  authorized path remains, report the precise blocker and what would resolve it.
  ```
  after
  ```
  Use unexpected results to update the diagnosis before trying another fix; when
  two fixes built on the same assumption have failed, test that assumption first.
  Fix a fault where it first arises rather than where it surfaces; a guard is a fix
  only when the state it handles can legitimately occur. When no productive,
  authorized path remains, report the precise blocker and what would resolve it.
  ```

**M3. Boundary Discipline → 앵커 §3:49-50 뒤**
- 상황: 내부 헬퍼 호출 사슬 깊숙이 null 체크·fallback 을 덧댄다. 하네스 배포 앵커엔 "어디에 방어 코드를 두는가" 문장이 없다(§4:58-60 "protections users depend on" 은 사용자 보호 기능 얘기다). pstack "경계(CLI·설정·네트워크·외부 API)에서만 검증, 내부는 신뢰".
- 이기는 쪽: pstack. 단, **벤더가 같은 문장을 권고 문안으로 제공한다** — 벤더 문안을 쓴다.
- 근거: [벤더 권고] Anthropic §Overeagerness 샘플 "Defensive coding: Don't add error handling, fallbacks, or validation for scenarios that can't happen. Trust internal code and framework guarantees. Only validate at system boundaries (user input, external APIs)." 벤더는 "이 행동이 보이면 넣으라"고 조건을 단다 → 리포엔 그 관측이 있다(M1 의 경우 덧대기 회차). [사용자 전역] `~/.claude/CLAUDE.md` §2 "Add defensive logic for concrete requirements, credible failure modes, and trust boundaries." — 역시 배포 문안에서 빠진 문장. **측정: 없음.**
- 비용: **+156 B(~39 tok/세션)**. 동일 조건.
- 판정: **MERGE**.

  before (`templates/CLAUDE.md:49-50`)
  ```
  arbitrarily small diff, while keeping unrelated cleanup and speculative future
  capabilities outside the task.
  ```
  after
  ```
  arbitrarily small diff, while keeping unrelated cleanup and speculative future
  capabilities outside the task.
  Add validation and error handling where data crosses a trust boundary or a credible
  failure needs it, not for states that internal code already guarantees.
  ```

### pstack 추가분 — 차용하지 않음 / 보류

| 원칙 | 왜 안 들이나 | 근거 |
|---|---|---|
| Foundational Thinking · Model the Domain · Type System Discipline · Minimize Reader Load · Make Operations Idempotent | 공학 일반론. 상주 파일 기준(코드에서 알 수 없는 것만)에 어긋나고, 효과 측정도 없다 | [벤더 권고] Claude Code memory "Keep it to facts Claude should hold in every session … If an entry is a multi-step procedure … move it to a skill"; best-practices "A more capable model knows more about engineering"(`working-principles-2026-11.md` 결과 1). [연구] arXiv 2607.27250 — AGENTS.md 유무로 통과율 차이 없음(Claude 53.3→55.6% · Codex 58.8→56.9%, p=1.0/0.66), 실패 원인은 "구현 기술"이지 지식 부재가 아님 |
| Outcome-Oriented Execution | 계획된 마이그레이션 한정. 설치자 관측 없음. 하네스 §3·§4 가 "승인된 변경"으로 같은 결과 | [없음] |
| Test Behavior, Not Implementation | 좋은 판별자(기대값은 요구에서 · 내부만 바꿔도 통과해야)지만 2 KB 본문. implementer(Claude Code) 가 "변경 없으면 실패" 절반을 갖고, 나머지 절반은 모델 기본 역량 | [벤더 권고] GPT-6 Astra "Do not write tests for reversible, low-impact changes that mirror the implementation"(vendor-signals). 선택안: Testing 룰 한 줄 +177 B — **최소 집합 밖**(리포 관측은 개발 사본 쪽 "변이 미반영 초록" 3회뿐, 설치자 관측 0) |
| Explain the Number | 앞선 평가 A05 와 같다 — 설치자 프로젝트에서 성능 주장 오류가 관측되면 그때 단독 스킬(출처·MIT) | [리포 관측] 메모리 "성능은 절대값 1회로 판정 불가(A/B 교차로 2.6배 회귀)" — 리포 쪽 관측 1건, 설치자 0 |
| Guard the Context Window · Separate Before Serializing · Sequence Verifiable Units · Prove It Works | 하네스가 스킬·룰·도구로 같은 뜻을 갖고 더 구체적(`check-absence.sh` · 워크트리 격리 · ADR-110 문단) | [벤더 측정] Opus 5 — 검증 지시 추가는 과잉 검증, 제거해도 품질 손실 없음 · Sonnet 5.5 xhigh·max — 자발 리뷰 라운드 차단 문장으로 비용 약 1/3 감소 · 품질 동일(`working-principles-2026-11.md` 결과). **검증 쪽 프로즈를 더하는 것은 벤더 측정이 반대한다** |

---

## 4. 권고 변경 목록 (최소 집합)

| 파일 | before → after | 바이트 | 왜 |
|---|---|---|---|
| `templates/CLAUDE.md` §5 :86-87 | §3 M1+M2 문안 (진단 갱신 → 같은 전제 2회 실패 시 전제 시험 · 근본 원인 · 가드 판별자) | **+236 B** (~59 tok) | 리포가 겪은 5회차 소모(경우 덧대기)의 교훈이 지금은 Claude Code 전용 에이전트 파일에만 있다. 앵커에 넣으면 4 CLI 에 닿는다. 사용자 전역 원칙의 같은 문장을 복원하는 형태 |
| `templates/CLAUDE.md` §3 :49-50 뒤 | M3 문안 (신뢰 경계에서만 검증·에러 처리) | **+156 B** (~39 tok) | 벤더가 관측된 과잉 방어에 권하는 문장 · 사용자 전역 원칙에 있던 문장의 복원 |
| 합계 | | **+392 B · ~98 tok/세션 · 전 트랙** | 기준선 `context-cost-baseline.json` directive(tooling 4,107 tok) 대비 약 +2.4%. ratchet 이 red 를 내므로 같은 커밋에서 `npm run cost:baseline` 과 사유를 담는다(ADR-083 절차) |

절차 메모(변경 아님): 앵커는 사용자 문안이다(ADR-091 결정 1 · ADR-115 가 "조사 결과의 문장 단위 제안 중 사용자가 채택" 형태로 선례). 이 문서의 문안을 이슈로 올려 사용자가 채택·수정하면 그 문안 축자로 넣고, `lane-principle-anchor-parity` 등 앵커 게이트는 성분을 세므로 어휘 조정이 필요한지 PR 에서 확인한다. 이 변경은 설치자 디스크 삭제·덮어쓰기 경로가 아니라 머지 전 독립 리뷰 문턱 밖(test-policy §시점별)이고, 영향 범위는 앵커를 경로로 읽는 게이트 + 비용 게이트 5종.

**하지 않는 것**: pstack 원칙을 스킬·룰로 들이지 않는다. 충돌 8건의 하네스 문안을 바꾸지 않는다. Testing 룰 한 줄(Test Behavior)과 수치 스킬(Explain the Number)은 설치자 관측이 생길 때 다시 연다.

### 하네스 원칙이 pstack 보다 약해 보이는 자리 (직접 충돌 없음)

1. **§5 진단 갱신이 추상형이다** — 위 M1+M2. 사용자 전역 §1 의 "Do not stack speculative fixes without updating the diagnosis" 가 배포 문안에서 빠졌다.
2. **§3 에 방어 코드 위치 문장이 없다** — 위 M3. 사용자 전역 §2 의 "trust boundaries" 문장이 빠졌다.
3. **결정적 가정을 가장 작은 프로토타입으로 시험하라는 문장이 없다** — 사용자 전역 §1 "Test unresolved assumptions that could change direction through the smallest useful research or prototype before costly commitments" 가 빠졌다. pstack 은 반대로 "항상 2~3개"라 과하다. 이 문장은 **권고에 넣지 않았다** — 리포 관측이 없고(ADR-110 실험은 계획 단계만), 벤더가 "commit to an approach" 를 권하는 자리라 방향이 갈린다. 관측이 생기면 사용자 전역 문장을 그대로 복원하는 것이 pstack 차용보다 낫다.
4. **Prove It Works 의 "검증이 실패하면 시스템보다 관측 방법을 먼저 의심하라"** — 하네스는 도구(`check-absence.sh` 대조군)로 갖고 있지만 앵커 문장은 없다. 벤더 측정이 검증 프로즈 추가를 반대하므로 넣지 않는다.

---

## 5. 근거가 없는 판단 목록

| 판단 | 무엇이 없나 |
|---|---|
| M1+M2 문안이 설치자 프로젝트에서 수정 회차를 줄인다 | 측정 없음. 리포 관측(5회차 소모)은 **문장이 없을 때의 실패**이지 문장이 막는다는 증거가 아니다. 반영 뒤 첫 관측 = 이 리포 리뷰에서 "가드 덧대기" 지적 회차가 줄었는가 |
| M3 문안이 과잉 방어 코드를 줄인다 | 벤더 샘플 문안이지 벤더 측정이 아니다. Anthropic 은 "이 행동이 보이면" 조건부로 권한다 |
| 충돌 8건에서 "하네스가 더 효과적" | 두 문안을 같은 과업으로 대조한 실험은 없다. 판정은 (ⅰ) 벤더가 최신 모델에서 측정·경고한 실패 방향(과잉 공사·과잉 검증·과잉 탐색)과 (ⅱ) 리포 ADR 의 전례(ADR-068 · 090 · 110 · 115)로 했다 |
| pstack 24종이 pstack 사용자에게 효과가 있는가 | 상류에 측정 없음. Flavio 글도 정성 평가뿐("sometimes more ceremony than a task needs"). 상류 5종(Encode Lessons · Exhaust Design Space · Guard Context · Laziness · Migrate Callers)은 본문이 1~2문장 스텁이다(바이트 대조로 확인 — 다운로드 오류 아님) |
| Codex 외 CLI(OpenCode · Antigravity) 의 기본 시스템 프롬프트에 근본 원인·최소 diff 지시가 있는가 | 확인하지 않았다. Codex 기본 지시문만 확인(`working-principles-2026-11.md`). 있으면 M1 은 그 CLI 에서 중복(무해)이다 |
| 설치자가 실제로 겪는 실패가 리포가 겪은 것과 같은가 | 설치자 관측 0(NORTH_STAR 측정 한계 각주 — 이 리포가 유일한 표본). 메모리 "최우선 출처는 설치자의 실제 프로젝트 관측" 기준으로는 M1~M3 도 **리포 관측 + 벤더 권고** 등급이지 설치자 관측 등급이 아니다 |
| 토큰 수치 | chars/4 규약값(`context-cost-baseline.json` units). 실측 토큰이 아니다 |

# 상주 감축 사이클 — todo (2026-07-26 발 · ADR-053)

> **역할**: 진행 중 사이클의 작업 추적 (sub-SPEC 모드). 이 리포는 진행 중 사이클을
> `docs/plans/<name>-todo.md` 에 두고 `docs/todo.md` 는 쉬는 상태 추적기로 유지한다 —
> 선례 7건(cli-cleanup·code-quality-cycle 등). 그래야 main 이 항상 출하 가능한 상태로 남고,
> `spec-drift-check.sh` 의 ship 게이트가 진행 중 작업 때문에 상시 차단되지 않는다.
>
> **이 파일을 게이트에 태우려면**: `SHIP_SUBSPEC=resident-reduction-2026-07-26 bash .claude/hooks/spec-drift-check.sh ship`
>
> **기준선** = `~/.claude/CLAUDE.md` 6원칙 최종본(2026-07-26) · **결정** = [ADR-053](../decisions/ADR-053-resident-item-count.md)

---


메인테이너 방향: *"꼭 필요한 것만 남기고 빼는 것이 오히려 에이전트에게 더 좋다 / AI 가 실수할 것
같은 것만 원칙화 / 이조차 모델이 좋아지면 완화 / 원칙·방법론이 더 중요."*
판정 절차(0단계 실수 테스트 → 4범주 → 배치 3목적지 → sunset)는 `docs/decisions/ADR-053-resident-item-count.md`.

- [x] 1차 NSM 양 축을 토큰 → 상주 항목 수로 교체 + 계측·ratchet·표시 대칭 (✅ `5830ef8`, 음성 대조 4종)
- [ ] **AC 전수 판정** — `tooling` 상주 29 + `templates/rules` 21 + `templates/agents` 9.
      결과가 곧 새 baseline (숫자를 먼저 박지 않는다).
      ⚠ **배포판은 증거 기준이 다르다** — 로컬 사고 1건 불가, 다도메인 반복·공개 실증·운영
      사실·손상 비대칭 중 하나 필요 (ADR-053 §0단계). 근거 모집단이 **이 맥 1인**뿐이라는
      실측(외부 신호 issue 3·star 3)에서 나온 제약
- [ ] **판정 결과 실행** — 삭제 / 스킬 이관 / **메모리 이관** 중 하나로 배치. 배치 목적지가 셋인
      것은 기준선 실측 발견(그쪽은 TDD·오탐 재검증·브랜치→PR→태그를 룰이 아니라 메모리에 둔다)
- [ ] **검증 방법론 자산 신설 여부 판정** — 실측 공백: `templates/` 전수에서 속성기반·계약
      테스트·FDD **0건**, 변이 테스트는 언급 4건이나 선택 가이드 없음, `verification-loop` 158줄은
      전부 CI 실행 순서. 범위는 **선택 규칙과 함정**으로 한정("TDD 가 무엇인가"는 모델이 안다)
- [x] **CLAUDE.md 최종본 확정** — 메인테이너가 2026-07-26 `~/.claude/CLAUDE.md`(글로벌 앵커)를
      **6원칙 · ~1,100 tok** 으로 교체. *"너무 프로시저 내용이 있어서 원칙 중심으로 다시 바꿨다.
      이를 기반으로 해야 한다."* → **이후 모든 판정의 기준선.** SSOT 는 그 파일이며 리포에
      복제하지 않는다(doc-governance)
- [ ] **리포 `.claude/CLAUDE.md` 의 옛 Rule 1~12 정리** — 최종본이 대체한 12룰을 그대로 들고 있어
      **지금 모순 상태**다. 남길 것은 이 리포 고유분(거짓출하 · Docker 실환경 검증 · CalVer ·
      4-CLI · 컨펌 시 ASIS/TOBE 설명 형식)뿐. 최종본과 겹치는 항목은 삭제
- [ ] **`templates/CLAUDE.md`(배포판)를 원칙 형태로 갈지 판정** — 지금은 트랙 fill-in 스캐폴드
      (~1,182 tok). 상주 예산의 단일 최대 레버이고, 배포판은 낯선 사람의 프로젝트에 설치된다
- [ ] **6원칙이 흡수한 룰 재판정** (아래 매핑 기준으로 AC 전수 판정에 반영)
- [ ] **sunset 임계값 실측 후 확정** — 위반 근거가 며칠/몇 릴리즈 갱신 안 되면 재판정 큐에
      올릴지. 근거 없는 수치 고정 금지라 지금 안 박는다

#### 최종본 6원칙 ↔ 기존 자산 매핑 (AC 판정 입력)

기준선 = `~/.claude/CLAUDE.md` (2026-07-26 최종본). **원칙이 앵커로 올라간 만큼 룰 쪽에서 같은
말을 반복하면 그건 두 번째 사본이다** — 아래 "흡수" 열이 곧 삭제 후보 근거다.

| 최종본 원칙 | 흡수한 기존 항목 | 재판정 대상 |
|---|---|---|
| 1 Think before coding | 옛 Rule 1·7(충돌 시 pushback)·8(읽고 나서 쓴다) + 안티패턴 표의 취지 | `doc-governance` 착수 전 baseline 대조 절과 중복 여부 |
| 2 Simplest sufficient | 옛 Rule 2. **신규**: "재현·테스트 가능한 동작을 선호 — 간결이 재현 불가를 만들면 그건 단순함이 아니다" | `code-style` 크기 상한과의 관계 |
| 3 Surgical + preserve | 옛 Rule 3·11 + 옛 Rule 7 의 충돌 우선순위. **신규**: "기존 워크트리 변경은 사용자 것 — 덮거나 되돌리거나 스테이징하지 마라" | `change-management` Savepoint 의 `git add -A` 금지와 같은 실패를 덮는가 |
| 4 Define success before editing | 옛 Rule 4·9. "안정적 계약 경계에서의 회귀 테스트" 로 구체화 | `test-policy` 의 TDD 절차 잔여분 |
| 5 **Report evidence, not confidence** | 옛 Rule 12 + **`no-false-ship` 의 절대 원칙 자체**("검증한 경로만 주장한다") + 옛 Rule 10 의 handoff | **`no-false-ship` 을 사례·증거 양식만 남기고 축소 가능한지** — 원칙이 앵커로 올라갔다 |
| 6 **High-impact boundaries** (신규) | `git-policy` Safety(force/reset 금지) 일부 · "준비 ≠ 적용" | `git-policy` 해당 절 중복 여부 |

**최종본에서 사라진 것 3건 — 각각 판정이 필요하다** (그냥 없어지면 다음 세션이 이유를 모른다):

| 사라진 것 | 사전 판정 | 근거 |
|---|---|---|
| 옛 Rule 6 토큰 예산(4,000/30,000) | **삭제 타당** | 상시 초과돼 온 규칙 = 지켜지지 않는 규칙. 0단계 실수 테스트를 통과 못 한다(지켜진 적이 없으니 위반이 사고로 기록되지도 않았다) |
| 옛 Rule 5 "코드가 답할 수 있으면 코드가 답한다" | **미판정 — 확인 필요** | 최종본 원칙 2 가 "재현 가능한 동작 선호"로 근처를 지나가지만 *"라우팅·재시도·결정론 변환에 모델을 쓰지 마라"* 는 명시가 없다. 이 리포는 설치기라 결정론이 핵심이다 |
| Self-Audit 의 "Non-Goals 침범 없음" 확인 | **미판정 — 확인 필요** | 원칙 5 가 미검증 보고는 덮지만 **범위 침범**은 다른 축이다. SPEC 에 Non-Goals 절이 실재한다 |

### 리스크·한계 문서를 doc-governance 위계에 넣을 것인가 (사용자 제안 2026-07-26)

- [ ] **결론 내기.** 아래는 착수 판단용 사전 조사이지 결정이 아니다.

**왜 후보인가 (실측)**: `docs/` + `.claude/rules/` 에서 "한계" 10파일 · "미검증" 10파일 ·
"제약" 9파일 · "risk" 8파일이 나오는데 **doc-governance SSOT 표 6항목 중 이걸 소유하는 문서가
없다.** 같은 성격의 사실이 최소 8~10곳에 흩어진 상태이고, 이는 doc-governance 자신이 금지하는
형태다("같은 사실을 두 곳에 쓰지 않는다 — 중복 서술 = drift 의 씨앗").

**AC 사전 판정** (ADR-053 절차 적용):

| 단계 | 판정 | 근거 |
|---|---|---|
| 0단계 실수 테스트 | **Pass** | 사고 기록 있음 — `no-false-ship` §"미검증에도 근거가 필요하다"가 v26.127.0 사고로 신설됐고("환경 제약상 불가"로 적었다가 실제로는 `script(1)` 로 가능했음), 백로그 서술이 2회 틀린 전례도 같은 계열 |
| 1단계 범주 | **Pass — B(문서 현행화)** | 최우선 범주에 정면으로 해당 |
| 2단계-1 게이트 중복 | **부분** | `spec-drift-check.sh` 는 SPEC/TODO 미완만 본다 — 한계·리스크는 대상 밖 |
| 2단계-2 상주 여부 | **비상주** | 문서 자체는 상주 아님. 룰 증분은 doc-governance 표의 **한 줄**(~30 tok) |
| 2단계-3 가변성 | **내용은 가변, 구조는 규약** | 내용은 프로젝트마다 다름 → 배포는 *자리*만, 내용은 사용자 프로젝트에서 자람 |

**결정해야 할 것** — 셋 중 하나를 고른다:

| 안 | 형태 | 장점 | 대가 |
|---|---|---|---|
| **①** 새 문서 `docs/LIMITATIONS.md` 를 위계에 추가 | SSOT 표 7번째 행 | 찾을 곳이 하나 | 문서가 하나 늘고, 안 갱신되면 그 자체가 거짓이 된다 |
| **②** 기존 `gap.md` 스키마 재사용 (benchmark-parity) | 이미 있는 표를 범위만 확장 | **새 스키마 0** — Severity·근본원인·증거 열이 이미 규정됨 | gap.md 는 UI/벤치마크 대조용이라 의미가 늘어짐 |
| **③** 추가하지 않음 | ADR `Consequences` + `no-false-ship` 미검증 표기로 충분하다고 판정 | 감산 기본값에 충실 | 흩어짐이 유지됨 |

**판정 시 반드시 볼 것**: 이 리포는 *"선언만 하고 한 번도 갱신 안 한 문서"* 로 지표를 두 번 죽였다
(HITO · JAR). 리스크 문서도 **갱신 발동 조건이 없으면 같은 운명**이다 — 어느 안을 고르든
"언제 이 문서를 건드리는가"를 먼저 정하고, 그게 기계로 발동되지 않으면 ③이 정답일 수 있다.


### 옛 Rule 12 "Fail loud" 가 약해진 것이 문제인지 검증 (사용자 지적 2026-07-26)

- [ ] **결론 내기.** 유실은 아니고 **약해졌다**. 약해진 지점이 실제 실패를 통과시키는지 확인한다.

**대조**

| 옛 Rule 12 | 최종본 원칙 5 | 판정 |
|---|---|---|
| "Completed" is wrong if anything was skipped silently | "Do not claim Pass/Works/Completed without corresponding evidence" + "A completion criterion that was not verified is not complete" | **유지·강화** (일반화됨) |
| **"Tests pass" is wrong if any were skipped** | "Relevant broader checks that were not run must be disclosed, **but do not invalidate verified completion by themselves**" | **약화** — 스킵된 테스트라는 구체 사례가 사라졌고, 명시적 예외 절이 새로 생겼다 |
| "Default to surfacing uncertainty, not hiding it" | "Report what changed, what was verified, what was not verified, and what remains" | **약화** — 보고 항목으로 남았으나 *기본 자세* 프레이밍은 사라짐 |
| — | "반복 시도가 새 증거를 못 내면 멈추고 handoff" | **신규** (옛 Rule 10 흡수) |

중간 초안(11룰)에 있던 **범주별 테스트 보고 의무**(`132 passed, 3 skipped, 1 xfailed` 는 정직하고
`all tests pass` 는 은폐)가 최종본에는 **없다**. 이 리포의 실제 습관(`skip 0건` 명시 보고)이 거기서 나왔다.

**기계 backstop 실측 (2026-07-26)** — 프로즈가 유일한 방어선인지 확인한 결과:

| 검사 | 결과 |
|---|---|
| `vitest.config.ts` 의 `allowOnly` / skip 관련 설정 | **없음** |
| skip/pending 개수를 단언하는 테스트·스크립트 | **없음** (grep 매치는 전부 설치기 자체의 `skipped` 개념) |
| 현재 코드의 `it.skip`/`describe.skip`/`.todo` | **0건** |
| coverage threshold (branches 88 등) | 있음 — 단 **스킵이 커버리지를 임계 아래로 떨어뜨릴 때만** 잡는다 |

→ **스킵돼도 커버리지가 임계 위면 아무도 안 막는다.** 프로즈가 유일한 방어선이었고 그게 약해졌다.

**결정할 것** — 셋 중 하나:

| 안 | 형태 | 판단 재료 |
|---|---|---|
| **①** 기계 게이트 신설 | CI 에서 skip/todo/only 개수 > 0 이면 실패(의도적 스킵은 명시 허용목록) | 프로즈 대신 구조 — recurrence-prevention 사다리의 정답 형태. 단 `it.skip` 이 0건인 지금 **한 번도 안 문 게이트**가 된다(음성 대조로 물리는지 먼저 확인 필요) |
| **②** 리포 고유 한 줄로 복원 | `test-policy.md` 에 "테스트 결과는 범주별로 보고(passed/failed/skipped/xfailed)" 한 줄 | 싸다. 단 프로즈로 2회 실패한 계열이라 같은 실패를 반복할 수 있다 |
| **③** 추가 안 함 | 원칙 5 의 "not verified is not complete" 로 충분하다고 판정 | 감산 기본값에 충실. 대가는 위 표의 빈칸 |

**판정 기준**: 0단계 실수 테스트를 이 항목 자신에게 적용한다 — **스킵된 테스트를 "통과"로 보고한
사고 기록이 실제로 있는가.** 있으면 ① 또는 ②, 없으면 ③이 정답이다. `no-false-ship` 사례 표와
CHANGELOG 164 릴리즈에서 확인할 것. (참고: `test-policy.md` 는 "`npm test` 만으로는 coverage
gate 를 놓친다"는 **다른** 실패를 이미 기록하고 있다 — 스킵과 혼동하지 말 것.)

---

## 실행 순서 확정 (사용자 결정 2026-07-26) — 2 → 1 → 3

리서치·실측이 끝난 뒤 사용자가 세 안의 형태를 직접 지정했다. 아래가 착수 기준선이다.

### ① 제품 진실 상주 — **템플릿 제공 + `@import` 배선**

> **문서 위치 절은 여기서 쓴다** — ②-c(ADR-055)가 앵커에서 문서 위치를 뺐고, 그 소유자는
> 이 항목의 `@import` 배선이다.

**사용자 지정 형태**: *"PRD(+SPEC), BACKLOG(TODO)을 작성해야 하고 템플릿은 제공하면 되지 않을까?
PRD가 너무 커지면 FEATURE 별로 분리하는 것이고."*

즉 우리가 만드는 것은 **내용이 아니라 자리와 배선**이다. 내용은 사용자 프로젝트에서 자란다.

- [ ] **PRD / SPEC / BACKLOG(TODO) 템플릿 3종을 실제로 설치**한다. 지금 설치는 `.claude/` 밖에
      문서를 **0개** 만든다(실측). `templates/docs/PLAN.template.md` 는 존재하는데 manifest 에
      없어 설치되지 않는다 — 그것부터 배선할지 새로 쓸지 판단
- [ ] **`templates/CLAUDE.md` 에 `@import` 배선.** 지금 92행이 *"매 세션 시작 시 SPEC/PRD 재참조"*
      를 지시하는데 **참조할 문서도 없고 로드 배선도 없다** — 지시만 있고 기전이 없는 죽은 참조다
      (아래 ② 목록의 8번째와 같은 항목). 파일이 없을 때 조용히 깨지지 않게 할 것
- [ ] **feature 별 분리는 신규 제작하지 않는다** — 기존 `spec-scaling` 스킬이 이미 소유한다
      (SPEC 800줄 초과 시 기능별 분리). 그 스킬은 AC 판정에서 **살아남은 4개 중 하나**다.
      할 일은 PRD 로 범위를 넓히는 것뿐인지 확인
- [ ] **지표를 같이 확장**한다. 사용자 문서는 `templates/` 밖이라 현재 `cost:report` 가 **아예 못
      본다** — 배선하면 상주가 크게 늘면서 지표는 침묵한다. 그 상태로 두면 "가장 큰 상주 증가가
      지표에 안 보이는" 구멍이 생긴다(굿하트 검증이 지적한 형태)

**빈 스캐폴드는 비용만 늘리고 편익 0 이다.** 기준선 프로젝트가 효과를 보는 이유는 그 PRD 가 실제로
채워지고 갱신되기 때문이다(200커밋 중 PRD 48건). 템플릿만 넣고 "제품 진실을 상주시켰다"고 보고하면
그것이 거짓출하다.

### ② 죽은 참조 정리 — **먼저 착수** (싸고 판단이 필요 없다)

- [x] 착수 목록 8건 재확인 (2026-07-26) — **6 확정 · 1 기각 · 1 은 ① 로 이관** + 재확인 중
      신규 1건(`pip-audit`) = **처리 7건**. 착수 전 목록은
      이전 세션 에이전트 보고였고 **그중 1건이 실제로 틀렸다** → 목록을 그대로 믿지 않은 것이 맞았다

| # | 지점 | 죽은 참조 | 부재 증거 | 처리 |
|---|---|---|---|---|
| 1 | `{.claude,templates}/rules/gates-taxonomy.md:3` | "CLAUDE.md P9(Circuit Breakers)와 함께 적용" | CLAUDE.md 는 Rule 1~12 구조 — P9·Circuit Breaker 0건 | 절 삭제 |
| 2 | `{.claude,templates}/rules/test-policy.md` | "구체적 설정은 test-driven-development 스킬 참조" | 그 스킬은 양쪽 `skills/` 에 없고 **opt-in 플러그인 `addy-agent-skills` 안에만** 존재 → 기본 설치에서 도달 불가 | 문장 삭제 |
| 3 | `{.claude,templates}/agents/plan-checker.md:108` | "CLAUDE.md Decision Meta-Rule 적용" | CLAUDE.md 에 해당 절 0건 (개념은 "안티패턴" 절로 이동) | 문구 삭제 |
| 4 | `{.claude,templates}/agents/build-error-resolver.md:106-110` | `refactor-cleaner`·`architect`·`planner`·`tdd-guide` **4개 부재 에이전트** | harness 설치분(`agents/`·`skills/`) 0건. `planner`·`tdd-guide` 는 ECC 플러그인 `agents/` 에 **에이전트 파일로 실재**(`architect`·`refactor-cleaner` 는 그 로스터에도 없고 `.kiro/`·번역 문서 사본에만) — 단 플러그인 ON 이면 `build-error-resolver` 자체가 플러그인 판본이라 **이 파일이 도달하지 않음** (`!withEcc` 게이팅, `src/manifest.ts:134,242`) | 실존 `implementer` 로 재지정 + 테스트 실패는 범위 밖 명시 |
| 5 | `templates/rules/design-workflow.md:9` | "`/teach` 로 컨텍스트 설정 먼저" | `commands/` 에 `ecc` 뿐 — `/teach` 0건. `$impeccable teach` 는 **없는 문법**이었다(upstream 은 `/impeccable teach`). 그래서 도구명을 아예 뺐다 — 조건부 안내는 룰이 아니라 그 자산이 소유한다 | 문구 교체 |
| 6 | `{.claude,templates}/skills/deep-research/SKILL.md:20-26` | 전제로 요구하는 firecrawl/exa MCP | `src/` 배선 **0건** — 하네스가 설치하지 않는다. 오늘 실제로 WebSearch 로 대체 수행(실증) | `MCP Requirements` 절을 `Web access` 절로 **교체** — 설정돼 있으면 쓰고, 없으면 CLI 내장 웹 도구, 그것도 없으면 멈춘다 |
| 7 | `{.claude,templates}/rules/ship-checklist.md` (nit) | `pip audit` | pip 서브커맨드로 존재하지 않음 (도구명 = `pip-audit`) | 표기 수정 |
| — | `{.claude,templates}/rules/ship-checklist.md:12` | ~~`npx ecc-agentshield scan`~~ | **기각** — `npm view ecc-agentshield version` = **1.4.0 실재**. 리포에 배선이 없는 것은 수기 실행 명령이라 정상 | 변경 없음 |
| — | `templates/CLAUDE.md` 마지막 절 | "Re-reference SPEC/PRD at the start of every session" — 문서 0개 + `@import` 0건 | 확인됨 | **① 로 이관** (① 이 배선하므로 지금 지우면 되돌아온다) |

- 부수 사실: **`.claude/CLAUDE.md` 에 검증 분리(SOD) 절이 없다** — `templates/CLAUDE.md` 는
      "Review and verification belong to a lane other than the one that wrote the code" 를 배송하는데
      이 리포 앵커에는 0건이고 기계 강제도 0건이다. 배포판이 남에게 지시하는 것을 자기는 상주로
      안 받는 비대칭(`feedback_surface_symmetry`) → 처리 방침은 사용자 확인 대기
- 검증 위임: 구현(나)과 분리된 2레인에 넘김 — `reviewer`(사실 재확인 + **글롭 훑기로 놓친 죽은 참조
      탐색**) · 다면 페르소나 적대적 리뷰(판단이 갈리는 부분). 산출물은 scratchpad 파일로 수거

### ②-b 레인 원칙 상주 — **② 다음, ① 앞** (ADR-054)

착수 시점의 확정 실행순서(② → ① → ③)에 이 항목의 자리가 없었다. 사용자 지시 5건(구현 검증 분리 ·
적대적 다면 리뷰를 **중요한 결정에만** · 설계·구현·검증 독립 · **기획서와 그 리뷰도** 분리 ·
**테스트 생성도** 독립 + 상위원칙으로 통합)에서 나온 신규 단위라 **② 다음 ① 앞**에 넣는다.
② 를 **먼저 커밋**한 뒤 이 단위의 baseline·문서 갱신을 한다 — 안 그러면 두 단위의 델타가 한 숫자에
합산돼 "무엇이 얼마를 늘렸나"가 복원 불가능해진다.

- [x] **D1** `templates/CLAUDE.md` — 옛 `## Delegate the Building, Keep the Deciding` 절 삭제 +
      `## The Lane Principle` 을 `## Rule 1` **앞**에 삽입 (상위 원칙은 룰 목록의 n번째가 아니다)
- [x] **D2** `templates/{codex,opencode,antigravity}/AGENTS.md.template` **무변경** — `{PROJECT_RULES}`
      임베드(`src/codex/agents-md.ts`)가 CLAUDE.md 본문 전체를 넣으므로 **한 곳을 고치면 4앵커가 동시
      갱신**된다. 템플릿에 또 쓰면 원칙이 2벌 상주(doc-governance 위반). *"여기 없네" 하고 다시 넣지
      마라* — 이건 **안 하기로 한 결정**이다
- [x] **D3** `.claude/CLAUDE.md` **맨 끝**에 대원칙 + 전례 (번호 없음 — `Rule 13` 은 12룰 정리가
      번호를 흔든다). ② 의 "부수 사실"이 지적한 **SOD 절 부재 비대칭이 이걸로 닫힌다**
- [ ] **D4** 게이트 `tests/lane-principle-anchor-parity.test.ts` — **테스트 작성 레인 소관**
      (구현 레인은 자기 종료 테스트를 쓰지 않는다). 렌더 산출물 대상 · 앵커 집합 derive · 2성분 판정
- [x] **D5** 비용 — **보류 해소**(2026-07-26). 보류 사유였던 CLAUDE.md 재구성이 **②-c** 로
      끝나 그 시점에 한 번만 쟀다. 앞 단위 순증 **+217**. 3값 표 = ADR-055 Consequences 1.
- [x] **D6** `ADR-054` 신설 + **ADR-052 → Superseded**(양방향 링크). 자산·배선·계약은 **승계**
- [x] **D10** `NORTH_STAR` §3 감산 문안 정정 — 기준은 방향이 아니라 **필요성**

**정당화 2줄** (`Resident Justification Rate` — 상주시키려는 쪽의 입증 책임):
1. **막는 구체적 실패**: 판정이 생산과 같은 레인이라 샌 사고가 실재한다 — v26.138.0 거짓출하(적대적
   검증 에이전트가 적발) · v26.128.0~131.0 릴리즈 CI 4연속 red 미인지 · ADR-053 §정정 이력(같은 표
   3회 수정, 결론 부호가 매번 뒤집힘) · 이번 세션 3건(§② 죽은 참조 목록의 거짓 1건 · 설계 v2 실측
   오류를 설계 리뷰가 NO-GO · 이 항목 자체). 배포판 기준은 **손상 비대칭**으로 충족 — 판정 누수는
   되돌릴 수 없는 형태로 배포된다(npm 26.83.0~26.127.0 유출은 unpublish 불가로 종결).
2. **이미 결정론 게이트가 덮는가 → 아니다.** 레인 분리를 강제하는 게이트가 0건이다. `no-false-ship`
   은 *증거의 형태*를 규정하지 **누가 그 증거를 만드는지**는 규정하지 않는다. D4 가 앵커 문안 존재만
   덮고, **준수율 자체는 미계측**(ADR-054 Consequences).

### ②-c CLAUDE.md 개편 — 앵커 2파일 역할 분리 (ADR-055)

**②-b 다음, ① 앞.** 사용자 결정 A1 = **앵커에는 원칙만** — 기술스택·스킬 라우팅·agents·필수 스킬·
문서 위치는 앵커에서 뺀다(리뷰 실측: 그 5항목 중 앵커가 **유일 소유자인 것 0개**).

- [x] **E1** `templates/CLAUDE.md` 전면 교체 — 사용자 기준선 **6원칙 본문 그대로** + 삽입 3문장
      (패널 문턱 / 리뷰어의 자기 증거 / AS-IS→TO-BE + 설명 진단). `Rule 1~12`·안티패턴·Self-Audit·
      Context Management 삭제, 이관처는 ADR-055 Consequences 2 의 표
- [x] **E2** 루트 `CLAUDE.md` 배너 죽은 참조 정정(`src/project-claude-merge.ts`) — `Rule 1–12` →
      **CLI 중립 문안**. 루트는 무조건 생성되나 `.claude/` 는 claude 선택 시만이라, `.claude/CLAUDE.md`
      만 가리키면 codex/opencode/antigravity 단독 설치에서 거짓이 된다. **FILL 6섹션 무변경**
- [x] **E3** 리포 `.claude/CLAUDE.md` = 리포 고유분만 — 6원칙 **복제 0**(전역 파일이 SSOT).
      대원칙(레인) + 구현 위임 + **의사결정 4줄 그대로**(리포 고유 표현이라 압축 금지 — 배포판은
      삽입 3 이 같은 5요소를 전부 싣는다) + Non-Goals 한 줄
- [x] **E4** 비용 — **순감이 아니라 순증 `+151`**(개수 축 불변). 6원칙 원문(1,189)이 옛 12룰 구조
      (1,064)보다 길고, 삽입 3 이 옛 5요소를 전부 옮긴다. 3값 = ADR-055 Consequences 1
- [x] **E5** ADR-055 신설(`## 적용 범위` + Consequences 6항) + ADR-054 재배치 한 줄 + 본 항목 등재
- [ ] **E6** 게이트 개정 — **테스트 작성 레인 소관**(문단 스코프 채점 · 축2 제거 · 어휘 확장 ·
      앵커별 축 표 · 음성 대조 전면 재실행). **현재 `resident-doc-asset-reachability` 1건 빨간불** —
      삽입 3 의 `Where … are installed` 가 `ABSENCE_ACK` 의 인접 리터럴 `where installed` 와 안 맞는다.
      **문안이 아니라 게이트를 고친다**(사용자 승인 문안을 게이트에 맞춰 비틀지 않는다)
- [x] **E7-1** `Rule N` 참조 글롭 스윕 — 상주 문서·배송 표면(`templates/**`·`src/**`) **0건 확인**.
      `docs/**` 의 ADR·plans·specs·archive·research 는 **과거 기록으로 동결**
- [ ] **E7-2** `Rule N` 죽은 참조 게이트 신설 — 테스트 작성 레인 소관

**옛 Rule 5 는 재지목하지 않았다** — "코드가 답할 수 있으면 코드가 답한다"는 6원칙에 명시가 없어
**미판정**이다(위 §최종본 매핑 표). 그래서 그것을 지목하던 주석 3곳은 새 번호로 옮기지 않고
**죽은 포인터만 제거하고 취지를 프로즈로 보존**했다.


### ③ 검증 방법론 자산 — `test-policy` 룰은 버리고 **방법론을 쓴다**

**사용자 지정**: *"test-policy 는 룰이 필요 없는데 test 방법론에 대해서는 작성했으면 좋겠어."*
→ 룰(상주)에서 내리고, 방법론을 **스킬**로 쓴다. 3층 구조를 사용자가 직접 지정했다:

| 층 | 무엇 | 무엇에 답하나 |
|---|---|---|
| **BDD** | 기획서·유저 요구사항을 사람이 읽을 수 있는 Given-When-Then 테스트케이스로 | 우리 서비스가 **무엇(What)**을 해야 하는가 |
| **E2E 시나리오** | BDD 로 정의한 유저 행동 흐름을 처음부터 끝까지 가상 브라우저로 자동화 (Playwright · Midscene.js) | 실제 서비스가 **유기적으로** 굴러가는가 |
| **변이 테스트 (mutation testing)** | 정상 흐름 외에 기상천외한 유저 입력·악성 프롬프트(인젝션)를 일부러 투입 | E2E 와 백엔드 가드레일이 **얼마나 빈틈없이** 예외를 방어하는가 |

- [ ] **어휘 고정 (사용자 결정 2026-07-26).** 이 프로젝트에서 **`변이 테스트`/`mutation testing`
      = 입력을 변이시켜 시스템 대응을 보는 것**이다. 소스를 망가뜨리는 것이 아니다.
      소스를 일부러 되돌려 *게이트가 무는지* 확인하는 관행은 이 리포에 이미 **`음성 대조`** 라는
      이름이 있으므로 그 이름만 쓰고, 거기에 "mutation" 을 붙이지 않는다. 두 이름이 각각 하나만
      가리키므로 충돌이 없다 — 과거 보고서에서 음성 대조를 "mutation" 으로 부른 표기는 이 결정
      이후 쓰지 않는다.
- [ ] **주의 — 리서치 근거를 잘못 붙이지 말 것.** 아래 실측 중 *"소스 변이는 변경분·라인당 1개로만
      값을 낸다(Google 820→7)"* 는 **학계 용어의 소스 변이**에 대한 것이고, 위 표의 변이 테스트
      (입력 변이)에 대한 증거가 **아니다**. 입력 변이 쪽 근거는 fuzzing·property-based·red-team
      문헌에서 따로 확보해야 한다 — 지금 갖고 있지 않다
- [ ] **범위는 선택 규칙과 함정으로 한정.** "BDD 가 무엇인가"는 모델이 안다. 리서치 실측이
      뒷받침한다: BDD 의 정량 근거는 **사실상 없고**(systematic mapping 이 "anecdotal" 로 결론)
      FDD 는 **검증 방법론이 아니며**(프로젝트 분해 기법 — 범주 오류), 소스 변이는 전량이 아니라
      **변경분·라인당 1개**로만 값을 낸다(Google 820→7), 속성기반은 입력 500개가 아니라
      **20개로 76% 포착**, TDD 의 효과는 "테스트 먼저"가 아니라 **짧고 균일한 사이클**에서 온다
      (시퀀싱은 회귀모델 2개 모두에서 탈락, p=.29)
- [ ] **`verification-loop` 과의 경계를 정한다** — 그 스킬 158줄은 전부 CI 실행 순서
      (build→typecheck→lint→test→security→diff)이고 "어느 검증이 무는가"를 다루지 않는다.
      새 자산이 그 공백을 메우는 것이므로 중복이 아니다

### ④ 자산 감축 판정 — **deep-research + 다면 페르소나 검증 후 결정**

**사용자 지정**: *"3번은 Deep research 와 다면 페르소나 검증으로 검토하고 삭제를 정하자."*
→ 이번 AC 판정(29 → 13)을 **확정으로 쓰지 않는다.** 아래를 거친 뒤 삭제를 정한다.

- [ ] 삭제 후보 14건에 `deep-research` + `multi-persona-review` 를 적용해 재판정.
      특히 판단이 갈릴 3건: `code-reviewer`(사용자가 "검증 분리"를 핵심 원칙으로 꼽았는데 그
      역할 에이전트다 — `reviewer` 와 중복이라는 판정을 **재확인 안 했다**) ·
      `deep-research`(필요 MCP 가 기본 설치에 없어 도달 불가 — 오늘 실제로 WebSearch 로
      대체했으므로 **이 건은 실증됨**) · `error-handling`·`data-analyst`·`strategist`
      (FastAPI/DuckDB/재무모델 전용인데 `tooling` 에도 딸려 옴 = 트랙 배선 버그로 보인다)
- [ ] **편익 미관측을 잊지 말 것.** 자산을 줄여 성과가 좋아진다는 측정은 우리에게도 공개 문헌에도
      없다. 오늘 실측이 보여준 것은 "적은 쪽이 이긴다"가 아니라 **"배분이 다른 쪽이 이긴다"** 다

# 1차 출처 5건 — 횡단 요약 (2026-08-09)

> ⚠ **이 파일은 스크래치패드에 있다 — 날짜가 바뀌면 사라진다.** 사이클이 근거로 쓸 것이면
> `docs/research/claude-md-standards-2026-08-09/` 안으로 옮겨야 한다. 본문 사실은 전부 그
> 디렉터리의 다섯 `primary-*.md` 에서 유도된 것이라 유실돼도 재구성은 가능하다.

수집물:

| # | 파일 | 등급 | 한 줄 성격 |
|---|---|---|---|
| S1 | `primary-openai-agents-md.md` | A | AGENTS.md **배선**(발견·병합·32KiB 절단) |
| S2 | `primary-openai-harness.md` | B+ | 지시문 = **목차**, ~100줄 인덱스 + 기계 점검 |
| S3 | `primary-openai-agent-loop.md` | B+ | 지시문이 프롬프트의 **어느 자리**에 들어가는가 |
| S4 | `primary-anthropic-steering.md` | A− | **룰/스킬/훅/서브에이전트 역할 분담**의 공식 표 |
| S5 | `primary-anthropic-prompting.md` | A | **표현 규약** + 권장 표준 문안 |

기존 원장(2026-08-02): `docs/research/rules-hooks-value-audit-2026-08-02/docs-resident-criteria.md`
(#1~#5) · `docs-power-user-tips.md`. 이하 **L1~L5, LP** 로 부른다.

---

## ① 다섯 출처가 **일치**하는 지점

일치는 곧 이번 판정에서 **다투지 않아도 되는 바닥**이다.

### A. 상주 지시문은 입구이지 백과사전이 아니다 (S2·S4, L3·L4 와도 일치)

- S2: *"give Codex a map, not a 1,000-page instruction manual"* / *"we treat it as **the table of
  contents**"* / *"A short `AGENTS.md` (roughly 100 lines) … serves primarily as a map"*
- S4: *"Think of this file as giving Claude an overview of your codebase, or as an index pointing
  to other files"* / *"Keep CLAUDE.md under 200 lines"*

**두 회사가 독립적으로 같은 은유(지도/목차/인덱스)에 도달했다.** 수치는 다르지만(100 vs 200)
방향은 하나다. 이것이 이 사이클에서 가장 강한 합의다.

### B. 길이보다 **모순과 부패**가 준수율을 깎는다 (S2·S4·S5, L3)

- S2: *"Too much guidance becomes non-guidance. When everything is "important," nothing is."* /
  *"It rots instantly … a graveyard of stale rules"*
- S4: *"dilutes adherence to the instructions that actually matter"* / *"the more instructions you
  provide … the less strictly Claude will follow them, **particularly if any contradict**"*
- L3: *"if two rules contradict each other, Claude may pick one arbitrarily"*

→ 처방은 "짧게"가 아니라 **모순 제거 + 주기 점검**이다.

### C. 프로즈는 집행 계층이 아니다 — 보장이 필요하면 훅·권한 (S1·S2·S3·S4, L3·L4)

- S4(가장 명시적): *""Never do this" in CLAUDE.md … an instruction is the wrong tool … A real
  guardrail needs to be deterministic, and the enforcement methods are hooks and permissions."*
- S2: *"By enforcing invariants, not micromanaging implementations"* / *"When documentation falls
  short, we promote the rule into code"*
- S1: *"reserve formatting and lint checks for CI"*
- S3(배선 근거): AGENTS.md 는 `role=user` — 위계상 `system`·`developer` **아래**다.

**S3 이 새로 더하는 것**: 기존 근거는 "모델이 안 지킬 수 있다"는 행동 관찰이었는데, S3 은
**프롬프트 조립 구조상 권한이 낮다**는 기전을 준다. 같은 결론에 독립적인 두 번째 근거가 붙었다.

### D. 금지에는 **이유 또는 대체 행동**을 붙인다 (S1·S5, L3)

- S1 예시: *"Do not filter … **Safe path:** build cohorts from assignment or exposure"*
- S5 예시: `NEVER use ellipses`(덜 효과적) → `… so never use ellipses since the text-to-speech
  engine will not know how to pronounce them`(더 효과적) — **부정형은 그대로 두고 이유만 붙였다**
- S4: *"explaining the why behind constraints"*
- L3: 구체성 원칙(`"Use 2-space indentation"` vs `"Format code properly"`)

### E. 절차는 스킬로, 사실·규범은 상주로 (S2·S4, L3·L4·LP)

- S4: *"A 30-line procedure in CLAUDE.md. Procedures belong in skills."*
- S2: 실행 계획·설계 문서는 `docs/` 로 빼고 입구는 포인터만
- LP: *"If you do something more than once a day, turn it into a skill."*

---

## ② 출처끼리 **어긋나는** 지점 (한쪽으로 정리하지 않는다)

### 어긋남 1 — 상주 지시문의 목표 분량: 100줄 vs 200줄, 그리고 **장르가 다르다**

| | S2 (OpenAI) | S4 (Anthropic) |
|---|---|---|
| 수치 | *"roughly 100 lines"* | *"under 200 lines"* |
| 그 파일의 **역할** | 순수 목차 — 원칙 본문은 `docs/` 에 있다 | 개요 + 규범이 같이 산다(*"team norms"*) |
| 초과 시 | (수치는 목표일 뿐, 강제는 32KiB 절단) | 준수율 저하 |

**정리하지 않는 이유**: 두 수치는 같은 것을 재고 있지 않다. S2 의 100줄짜리 파일에는 원칙이
**애초에 안 들어 있다** — *"a set of core beliefs that define agent-first operating principles"*
는 `docs/` 소속이다. 따라서 **"#287 의 7원칙 120줄이 100줄을 넘는다"는 비교는 성립하지 않는다.**
비교 가능한 것은 S4 의 200줄이고, 거기에는 들어간다.

### 어긋남 2 — 강조어(`IMPORTANT` / `YOU MUST`): Anthropic 내부 두 문서가 반대

| 출처 | 지시 |
|---|---|
| L4 (best-practices) | *"You can tune instructions by adding emphasis (e.g., "IMPORTANT" or "YOU MUST") to improve adherence."* |
| **S5 (prompting best practices)** | *"The fix is to dial back any aggressive language. Where you might have said "CRITICAL: You MUST use this tool when...", you can use more normal prompting like "Use this tool when..."."* |

**차이의 축은 모델 세대다.** S5 는 4.5/4.6 이후를 명시하고 L4 는 세대 조건이 없다. 그러나 어느
쪽도 상대를 폐기한다고 말하지 않으므로 **병기한다.** 이 저장소에 걸리는 지점: 배포 룰·CLAUDE.md
에 남아 있는 대문자 강조가 **최신 모델에서는 과발화 유발 요인**일 수 있다(미측정).

### 어긋남 3 — 검증 지시: "넣어라" vs "빼라"

| 축 | "넣어라" | "빼라" |
|---|---|---|
| 과잉 구현 억제 | S5 권장 문안 (`Avoid over-engineering…`) | 예외 문장 **없음** |
| 비가역 작업 승인 | S5 권장 문안 (`Consider the reversibility…`) | 예외 문장 **없음** |
| 미조사 단정 억제 | S5 권장 문안 (`investigate_before_answering`) | 예외 문장 **없음** |
| **자기 검증 지시** | — | **L2 · S5 둘 다 "제거하라"** (Opus 5 한정) |

**축을 뭉뚱그리면 안 된다.** "모델이 이미 하니까 원칙을 빼라"는 반론이 공식 근거를 갖는 것은
**검증 축 하나뿐**이다. 나머지 세 축은 공식 문서가 **지금도 그 지시를 쓰라고 싣고 있다.**

### 어긋남 4 — 게이트 철학: S2 는 "머지 게이트 최소화", 이 저장소는 정반대

S2: *"The repository operates with minimal blocking merge gates … Test flakes are often addressed
with follow-up runs rather than blocking progress indefinitely."*

**단 저자 자신이 조건을 붙였다**: *"This would be irresponsible in a low-throughput environment."*
+ *"should not be assumed to generalize without similar investment."*

→ **S2 를 게이트 완화의 근거로 인용하면 오인용이다.** 배포 대상은 저처리량 저장소다.

### 어긋남 5 — 병합 방향이 두 CLI 에서 반대

| | Codex (S1) | Claude Code (L3·S4) |
|---|---|---|
| 탐색 방향 | 프로젝트 루트 → **cwd 까지만** | 루트는 세션 시작, **하위는 그 파일을 읽을 때** |
| 하위 무력화 | `AGENTS.override.md` (디렉터리당 1파일) | 없음(누적) |
| 임포트 | 공식 없음 — 디렉터리 계층으로 | `@path` (단, 컨텍스트 절감 없음) |
| 상한 | **32 KiB 절단**(조정 가능) | 없음(전량 로드) |

**같은 트리가 두 CLI 에서 다르게 병합된다.** 4-CLI 설치물인 이 저장소에는 직접 리스크다.

---

## ③ 기존 원장(2026-08-02) 대비 **달라진 지점**

### 신규 사실 (원장에 없던 것)

| # | 사실 | 출처 | 이 저장소에 걸리는 곳 |
|---|---|---|---|
| N1 | **스코프 없는 룰은 CLAUDE.md 에 붙여 넣은 것과 "기계적으로 동일"** — *"An unscoped rule is mechanically identical to putting the content in CLAUDE.md: always loaded, always costing tokens."* | S4 | 배포 룰 7종 중 `paths:` 는 1종. 나머지는 파일로 나눈 것이 **비용을 한 토큰도 안 줄인다** |
| N2 | **컴팩션 후 생존이 방법마다 다르다** — CLAUDE.md 재독 / 룰 **재주입** / 스킬은 공유 예산 안에서 오래된 것부터 탈락 / 훅은 컴팩션 **우회** | S4 표 | 원장은 *로드 시점*만 다뤘다. "긴 세션에서 룰이 사라진다"는 통념이 **틀렸다** |
| N3 | **32 KiB 는 품질 기준이 아니라 절단 상한**이고 **조용히 자른다** | S1 | 2차 자료(`dyld-articles.md`)가 200줄과 나란히 "분량 기준"으로 실은 것을 **정정** |
| N4 | **지시문은 `role=user`** — `system`·`developer` 아래 | S3 | "룰로 막는다"가 약한 이유의 **배선 근거** |
| N5 | **지시문은 프롬프트 캐싱의 정적 접두사** → 비싼 것은 길이보다 **불안정성** | S3 (우리 추론 포함) | 상주 비용 모델(`cost:report`)의 해석을 보정 |
| N6 | **개수 축 희석의 첫 1차 출처 문장** — *"the more instructions … the less strictly Claude will follow them, particularly if any contradict"* | S4 | 원장 §7 의 "개수 축은 계량 안 됨"은 **여전히 유효**(계량은 없음). 방향 주장만 생김 |
| N7 | **문서 부패·검증불가**가 길이와 **독립된** 실패 원인 | S2 | 처방이 "짧게"에서 **"기계가 검사할 수 있게"**로 이동 |
| N8 | **Codex 쪽 로드 감사 수단** — `codex -c log_dir=./.codex-log` / `session-*.jsonl` | S1 | 4-CLI 실측에서 Codex 경로를 처음으로 확인 가능 |
| N9 | **`claudeMdExcludes` · MDM 중앙 배포 CLAUDE.md** | S4 | 조직 배포 시 사용자가 못 끄는 계층이 존재 |
| N10 | 분량 규율의 처방이 **소유자 지정 + 코드리뷰** | S4 | "누가 이 파일을 소유하는가"가 이 저장소에 없다 |

### 기존 원장을 **정정**하는 것

| 무엇 | 원장의 기록 | 이번 확인 |
|---|---|---|
| 강조어 | L4: 강조어를 **더하면** 준수율이 오른다 | S5: 최신 모델에서는 **덜어내라** — 병기 필요(어긋남 2) |
| 32 KiB | 2차 자료가 "권장 분량 기준"으로 제시 | 절단 상한 · 조정 가능 · 무음 실패(N3) |
| "부정형 금지" | (원장 L2의 *"Positive examples … more effective"* 가 그렇게 읽힐 소지) | S5 의 해당 항목은 **출력 형식** 절 소속. 같은 문서가 부정형을 유지한 채 이유만 붙인 개선 예시를 싣는다 → **"부정형을 쓰지 마라"는 뒷받침되지 않는다** |

### 수집 방법론에서 드러난 것 (원장 신뢰도에 영향)

**접힌 아코디언 본문은 정적 HTML 에 없다.** S5 를 HTML 로 추출했을 때 11개 패널이 빈 채로
나왔고, **그중 하나가 판정을 뒤집는 예시**였다(어긋남 3 의 `NEVER use ellipses` 개선 예시).
`.md` 접미사로 재수집해서야 잡혔다.

→ **기존 원장 L1(support 14553240)과 LP(power-user-tips)는 "WebFetch 요약 모델 추출, 전문
미대조" 등급이다.** 같은 위험에 노출돼 있으므로 **재수집 권고**(이번 범위 밖).

---

## ④ 이슈 #287 의 7원칙에 이 원장을 댔을 때 (판정 재료 — 결론 아님)

사용자가 원칙의 정당성은 이미 확정했으므로, 아래는 **"배포물로서 참인가"에만** 대는 것이다.

**측정 기준점(중요)**: 아래 저장소 측 수치는 전부 **`main` 에 고정해 측정**했다
(`git show main:<path>`). 이 세션 도중 워크트리가 `refactor/rules-minimal-judgment` → `main` 으로
바뀌었고 그 브랜치는 삭제됐다(다른 세션의 머지·정리로 보인다 — 이 조사는 git 쓰기를 한 적이
없다). 그래서 `git status` 스냅샷 대신 ref 고정 측정을 썼다.

- `main:templates/CLAUDE.md` = **142줄**, 본문에 `AGENTS` 문자열 **0회**
- `main:templates/rules/` = **7개**, `paths:` 프론트매터는 **`cli-development.md` 1개뿐**
  (탐지기 검증: 알려진 양성 1건이 잡히는 것을 먼저 확인)
- 이슈 #287 제안 본문 = **119줄**, 첫 줄 = `# AGENTS.md`

| 항목 | 출처가 말하는 것 | 상태 |
|---|---|---|
| **분량** 119줄 (현행 142줄 → 119줄) | S4 의 200줄 안. S2 의 100줄은 장르가 달라 비교 불가(어긋남 1) | ✅ 통과 |
| **32 KiB** | 단독으로는 문제없음. 단 설치본이 여러 디렉터리에 지시문을 뿌리면 합계가 닿을 수 있고 **실패가 무음**이다(N3) | ⚠ 합계 실측 필요 |
| **파일명이 `# AGENTS.md`인데 대상은 `templates/CLAUDE.md`** | L3: *"Claude Code reads `CLAUDE.md`, not `AGENTS.md`."* 권장은 CLAUDE.md 가 AGENTS.md 를 **임포트**하는 형태 | ❗ **문면 불일치 — 확인 필요** |
| **원칙 6(비가역 작업 승인)** | S4 의 `"Never do this"` 안티패턴에 정확히 걸린다. 처방은 **삭제가 아니라 훅·권한 병행** | ⚠ 프로즈 단독이면 보장 없음(이 저장소는 이미 GitHub 룰셋 보유 → **원칙 6 옆에 그 사실을 적을 자리**) |
| **원칙 5(독립 리뷰)** | 검증 축은 유일하게 "빼라"가 공식인 축(L2·S5). 단 그 문장은 **자기 검증** 지시를 겨냥하지 **타 레인 리뷰**를 겨냥하지 않는다. 별도로 L4 는 리뷰어 과잉 보고를 경고 | ⚠ **문면 조정 여지** — "verify" 반복보다 "누가 판정하는가"로 |
| **원칙 1·2·3·4·7** | S5 가 같은 취지의 문안을 **권장 문안으로 싣는다**(과잉 구현·미조사 단정·테스트 맞춤) | ✅ 공식 지지 |
| **부정형("Do not …") 다용** | 금지 자체는 문제 아님. 요구되는 것은 **이유 또는 대체 행동**(일치 D) | ⚠ 항목별 점검 — `Safe path:` 형 보강 여지 |
| **모순 없음** | S4·L3 이 가장 강조하는 축. 7원칙이 배포 `templates/rules/*` 와 충돌하면 임의 선택된다 | ❗ **미확인 — 대조 필요** |
| **점검 루프** | S2: 원칙의 정당성은 **주기 점검의 존재**에서 온다(doc-gardening) | ⚠ 이 저장소엔 `spec-drift-check` 가 있으나 원칙 문서를 물지는 않는다 |

**가장 실행 가능한 두 가지** (근거가 가장 단단한 순):

1. **`# AGENTS.md` 헤더 ↔ `templates/CLAUDE.md` 경로의 불일치를 정리한다** — L3 이 명시적으로
   다루는 축이고, 4-CLI 설치물이라 병합 규칙(S1)까지 걸린다.
2. **원칙 6 옆에 "이것은 프로즈이고, 실제 차단은 어디가 하는가"를 한 줄로 붙인다** — S4 의
   안티패턴에 정면으로 걸리는 유일한 원칙이고, 처방은 삭제가 아니라 병행이다.

---

## ⑤ 확인하지 못한 것 (추론으로 채우지 않음)

- `https://agents.md` 공식 사이트 — S1 이 "더 알아보려면 여기"로 가리키는 곳. **미수집.**
  담으라/빼라 목록이 있다면 거기다.
- `Project instructions discovery`(Codex config 상세) — **미수집.**
- **Codex 의 컴팩션 후 지시문 재주입 여부** — S3 은 `input` 치환만 말하고 재주입을 말하지 않는다.
  Claude Code 쪽은 S4 가 명시. **두 CLI 가 같다고 가정하면 안 된다.**
- **Claude Code 의 프롬프트 캐싱 동작** — S3 은 Codex 구현 문서다. N5 의 추론을 Claude Code 로
  옮기려면 별도 확인이 필요하다.
- **규칙 "개수"와 준수율의 계량** — 다섯 출처 어디에도 **없다**(N6 은 방향 주장일 뿐).
  원장 §7 의 공백은 그대로 남는다.
- `.claude/rules/` 파일 하나의 권장 줄 수 — **여전히 어느 출처에도 없다.**

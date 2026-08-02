---
status: active
---

# 문서 템플릿 세트 + 앵커 항목 구성 — 확정안 (종합)

> 입력 = 설계 1건(`doc-format-and-anchor-plan.md`) + 적대적 리뷰 3건(준수 회의론자 18 · 낯선 설치자 15 · 드리프트 헌터 15 = **48건**).
> 이 문서의 실측은 **종합 레인이 이 워킹트리에서 직접 다시 돌린 값**이다(2026-07-28). 재측정 명령은 §7·§12 에 남긴다.
>
> **독립 검토 완료 (2026-07-28)** — 판정 **조건부 착수**. 검토 산출물 = `doc-template-standard-review.md`
> (이 문서를 쓰지 않은 레인). 헤드라인 수치 4개(126/89/108/66)는 전부 재현됐고, **확정으로 적혔으나
> 미검증이던 6건**이 적발됐다. 아래 본문에 정정을 반영했고 각 자리에 `[검토정정 H*/M*]` 로 표시했다.
> 착수 조건 5개 중 **C1(사용자 결정)은 2026-07-29 승인 완료** — `docs/SPEC.md` 는 옛 본문을
> `docs/archive/` 로 옮기고 같은 경로에 현행 SPEC 을 쓴다(선택지 ⓐ).

---

## 1. BLUF

1. **설계의 판정 축(개수)은 살아남았고, 임계값은 바뀌었다.** 회의론자가 출처를 열어 확인한 결과 동료심사된 AgentIF(NeurIPS 2025 D&B)의 헤드라인은 **평균 11.9 제약 → 전 모델 완전 준수(ISR) <30%** 다. 설계는 이 수치를 쓰지 않고 단독저자 프리프린트의 N=80 을 임계로 삼았다. **임계는 11.9 로 교체한다.** 그 결과 설계의 ADR 템플릿(슬롯 43개)은 "값싸다"가 아니라 **3.6배 초과**였고, 지시대로 **템플릿을 줄였다** — 최종 ADR 작성 시 걸리는 독립 의무 **12개**(헤더 필드 1 · 필수 절 4 · 생성 스크립트가 흡수 2).

2. **이 계획은 상주 부하를 줄이지 않는다. 그 점을 헤드라인에 적는다.** 재측정: 이 리포 상주 **126**(무조건 95/조건부 24/메타 7, 가중 157) · 실설치 **tooling 89 / csr-fastapi 108 / executive 66**. 설계의 "배포 COMMON 105"는 `COMMON_RULES`(실제 5건)와 어긋난 손 목록이라 **폐기**했고, 최대 감축 레버라던 R1(`paths:` 지연 로드)은 **델타 0**이다(UI 룰은 tooling 에 애초에 안 깔리고, 4개 CLI 중 3개는 설치 시점 인라인·글롭 병합이라 frontmatter 를 읽을 경로 자체가 없다). 감축은 R1b(스킬 이관)·R2·R3 에 있고 **전부 사용자 판정 대기**다.

3. **템플릿 4종은 배포하지 않는다.** `templates/docs/` → `docs/templates/` 로 옮겨 npm tarball(`files:["dist","templates",…]`) 밖으로 뺀다. 한국어 헤딩·`🧪✅⬜` 기호·`v26.140.0` 좌표 문제가 전부 이 한 결정으로 소멸한다.

   **[검토정정 H4]** 원안은 "낯선 설치자에게 나가는 변경은 골격 축소 **하나뿐**"이라 적었으나 §9 표 자신이 **셋**을 싣는다: ⓐ `change-management.md` 인라인 ADR 골격 축소(순감) ⓑ codex·antigravity `AGENTS.md.template` 문안 정정 + `Linked SPEC:` 삭제 ⓒ **앵커 스캐폴드 `src/project-claude-merge.ts` 절 구성**. ⓒ 는 순감이 아니다 — 현행 6절 중 **3절이 사라지고 1절이 들어오며**, `dist/` 로 컴파일돼 전 설치자에게 나간다. **ⓒ 는 §10 의 사용자 결정 지점(단계 9)에 포함한다.**

---

## 2. 판정 기준 (확정) — "AI 가 가장 잘 일하는 기준"의 조작적 정의

**5개 제안 중 근거가 온전히 살아남은 것 3개(A1·A2·A5), 축소 생존 1개(A3′), 무행동 1개(A4).**

| # | 확정된 체크 | 판정 방법 | 출처 · 상태 |
|---|---|---|---|
| **A1** | **동시에 걸린 독립 의무의 개수를 세었는가.** 참조점 = **평균 11.9 제약에서 완전 준수 <30%** | `scripts/count-obligations.mjs`(슬롯+규범줄). 세지 않은 템플릿은 판정 불가 | **AgentIF** arXiv 2505.16944, NeurIPS 2025 D&B(동료심사) — 11.9/ISR<30%. 보조: IFScale(arXiv 2507.11538, 20모델) 10개 100% → 500개 68.9/62.8%. **VeyraBench(2607.19257)는 단독저자 프리프린트라 방향 근거로만 쓰고 임계값으로 쓰지 않는다** |
| **A2** | **조건부·메타는 예산에서 2배로 친다** | 계수기의 `cond`/`meta` 열 | AgentIF: vanilla 80.8% vs condition 66.1%(−14.7pp) vs example 59.1%(−21.7pp), 메타 제약 ≈25%. **[검토정정 H1] 정규식을 좁히기로 한 결정은 유효하나 그 결과 수치는 미확정이다** — "cond 45 → 24 · 178 → 157(−12%)" 를 내는 계수기가 존재하지 않는다(현존 계수기는 `74/45/7 · 178`, 두 패턴 제거 재구성은 `96/23/7 · 156`). **§10 단계 0 에서 착지시킨 계수기 출력으로 확정한다.** 그전까지 이 배율을 근거로 쓰지 않는다 |
| **A3′** | **금지문에 집행자와 이유를 병기한다.** 명령형을 제거하지 않는다 | `NEVER commit secrets — 막는 훅 없음(⬜), 되돌리기 불가` 형태 | **원안 근거 무너짐.** 회의론자가 원문 확인: "Tell Claude what to do instead of what not to do"는 **출력 서식 조종 팁**(예시가 markdown vs prose)이고, 같은 벤더가 *"adding emphasis ('IMPORTANT' or 'YOU MUST') to improve adherence"* 를 적는다. **명령형 제거는 뺐다.** 살아남은 절반 = "이유를 붙이면 더 잘 듣는다"(벤더 공식). 효과 크기 **미확인(§12 E-1)** |
| **A4** | **행동 없음 — 이미 충족돼 있다** | — | AbsenceBench(2506.11440, +35.7%)가 지지하는 것은 "빈칸에 리터럴 표식을 둔다"이고 현행 `renderFillScaffold()` 가 이미 `_(not filled yet — …)_` 를 렌더한다. 설계의 실제 변경은 **문안 교체**(`NOT RECORDED`)였고 그건 측정된 적이 없다 → **이번 사이클에서 뺀다**(§12 E-2 A/B 후 재론) |
| **A5** | **삭제 테스트 — "이 줄을 빼면 실수하나?" 아니면 지우거나 훅으로.** **단, 벤더가 처방한 검증(행동 관측)을 붙인다** | 계수기 before/after **+ 행동 대조 1회** | 벤더 공식: *"If Claude already does something correctly without the instruction, delete it or convert it to a hook"* · *"Bloated CLAUDE.md files cause Claude to ignore your actual instructions!"* · **그리고** *"test changes by observing whether Claude's behavior actually shifts"*. 세 번째 문장을 설계가 인용하지 않았다 → R2 앞에 행동 관측 단계를 넣는다 |

**형식(표/불릿/산문/마크다운)은 판정 항목이 아니다** — 유일한 통제 실험이 프리프린트이고 5모델 중 4모델 델타 ≤2.1pp·부호 뒤집힘이며, 벤더 공식도 *"There's no required format for CLAUDE.md files"* 다. **"짧을수록 좋다"도 쓰지 않는다**(1,650세션 요인설계 BF10 0.05~0.10 = 긍정적 귀무). 관측되는 축은 줄 수가 아니라 **개수**다.

**길이를 검증 기준으로도 쓰지 않는다** — 설계는 논증에서는 길이를 뺐는데 실행 단계의 green 판정을 "토큰 비증가"로 두어 자기 기각을 되살렸다(회의론자 MEDIUM). **모든 green 기준을 계수기 before/after 로 통일한다.**

---

## 3. 문서 템플릿 — 확정 문안 전문

### 3-0. 4종 공통 규약

| 축 | 확정 | 근거 |
|---|---|---|
| 위치 | **`docs/templates/`** (이 리포 전용, npm tarball 밖) | §9. `templates/` 에 두면 게시는 되고 설치는 안 되고 위생 게이트도 안 무는 3중 회색지대가 된다(드리프트 헌터 M10). 기존 `templates/docs/PLAN.template.md` 도 함께 이동 |
| frontmatter | **plan 만.** ADR·SPEC·research 는 없음 | 기계가 읽는가 = 유일 기준. plan 의 `status:` 는 G-F1 이 읽는다. ADR 0/58 이 frontmatter 를 갖고, MADR 자신의 ADR-0013 이 채택 대가로 *"pretends to be more accurate than it can be"* 를 적는다 |
| 필수/선택 표기 | **헤딩 텍스트 안 `(선택)`** | 생성 TOC 에 실리고 · grep 에 잡히고 · diff 무시(`-I '(선택)'`)로 쓰인다. 상류 2곳이 같은 형태(KEP `(Optional)` · spec-kit `*(mandatory)*`) |
| 빈 절 | **삭제.** 앵커만 표식 유지(예외를 템플릿에 한 줄로 명시) | 어느 표준도 "빈 채로 둔다"를 기본값으로 두지 않는다(MADR "Feel free to remove" · Rust RFC "없다고 쓴다"). 앵커 예외는 부재 추론 비용 때문 |
| 손으로 채우는 필드 | **0개를 목표로.** `Date`·`PR`·`Tag` 전부 뺀다 | 실측: `PR:` 34/58(59%)이 `#N` 부재, 26/58 이 placeholder 원형, 최소 1건은 거짓(ADR-058 `PR: (머지 시 기입)` ← 실제 #263 머지). 날짜·PR·태그는 전부 **git 이 이미 안다** |
| 상태 값 | **한 줄 = 한 토큰.** 부가 정보는 본문으로 | 실측 재확인: ADR Status 값 **8건**이 날짜·서사를 달아 파싱 불가(`- **Status**: Superseded by ADR-023 (2026-06-26 — …)` ×2 등). `docs/specs/` **18/18** 은 `> **Status**: Draft (…)` 라 어떤 게이트에도 안 걸리고 이 값을 읽는 코드가 리포에 0건이다 |
| 언어 | **한국어 유지** — 배포하지 않으므로 계약 충돌 없음 | 낯선 설치자 HIGH(한국어 헤딩 + 헤딩 diff 게이트)는 §9 배포 결정으로 소멸 |

---

### 3-1. `docs/templates/ADR.template.md`

```markdown
# ADR-NNN: <결정 한 줄>

- Status: Proposed

## Context

<왜 이 결정이 필요했나. 결정 시점의 근거를 적는다 — 수치가 있으면 어떻게 셌는지까지.>

## Decision

<무엇을 결정했나.>

## Alternatives

<검토 후 기각된 대안과 기각 사유.>

## Consequences

<무엇이 달라지나. 치르는 비용 포함.>

## 적용 범위 (선택)
## Confirmation (선택)
## References (선택)

<!-- 관계 필드(Supersedes / Amends)는 다른 ADR 을 대체·수정할 때만 쓴다 —
     형식과 역방향 링크 규약은 change-management.md 가 소유한다. -->
```

**이 템플릿이 거는 독립 의무 = 9개**
Status 존재(1) · Status ∈ 4-enum(1) · Status 한 토큰(1) · `## Context`(1) · `## Decision`(1) · `## Alternatives`(1) · `## Consequences`(1) · Context 에 근거·계수법(1) · 선택 절은 `(선택)` 표기하고 안 쓰면 삭제(1).
**ADR 1건을 쓸 때 실제로 걸리는 총계 = 12** (+ `change-management` 가 거는 3: 본문 append-only · 머지 직전 `Proposed→Accepted` · 관계 필드 형식).
`ADR-NNN-slug.md` 파일명과 초기 Status 는 **`scripts/adr-new.mjs` 가 흡수**하므로 사람 의무가 아니다.

**설계 대비 뺀 것과 이유**

| 뺀 것 | 이유 |
|---|---|
| `Date:` | 사람이 채우는 필드는 이 리포에서 45~59% 실패율이 실측됐다. 시점은 ADR 번호(순서) + git 최초 커밋이 이미 안다. 인덱스 생성기가 `git log --diff-filter=A --follow` 로 derive |
| `PR:` | 위 실측. 인덱스에만 derive 값으로 싣는다 |
| `Supersedes:`/`Amends:`/`Superseded-by:` **헤더 슬롯** | 23/58 이 지금도 이 줄이 없고 그게 정상이다. 관계가 있을 때만 쓰는 줄을 상시 슬롯으로 두면 4개 의무가 매 ADR 에 걸린다. 규약은 `change-management` 가 소유 |
| `## 적용 범위` **필수 승격** | 현행 11/58. 필수로 올리면 47건 즉시 위반 + G-F3 영구 만발이고, 실제 사고(ADR-048 의 거짓 범위 주장)는 **헤딩 존재로 안 잡힌다**. A5 를 내 템플릿에 적용한 결과 — 선택 절로 남긴다 |
| `## Confirmation` **필수 승격** | 현행 **0/58**(재측정). MADR 자신이 *"we classify this element as optional"* 이라 적는다(회의론자 M14 — 설계가 이 문장을 인용하지 않았다). 설치 프로젝트에서는 답이 매번 "nobody" |
| `🧪 / ✅ / ⬜` 기호 지시 | 범례가 `CLAUDE.md:7` 에만 있다. 리포 전용 문서이므로 기호 자체는 허용하되 **"반드시 하나 고른다"는 강제를 뺀다** — 선택 절이라 강제가 성립하지 않는다 |

---

### 3-2. `docs/templates/SPEC.template.md`

```markdown
# SPEC: <사이클 이름>

- Status: Active

## North Star Check (선택 — NORTH_STAR 문서가 있을 때)

| 질문 | 답 | 근거 |
|---|---|---|
| 어느 지표를 움직이나 |  |  |
| Won't 를 침범하나 | 아니오 / 예(→ Major CR) |  |

## AC — 무엇이 완료인가

- [ ] **AC1** — <관측 가능한 완료 조건> (판정: test `tests/<파일>` / hook `<경로>` / nobody)
- [ ] **AC2** — …

## Non-Goals

## DO NOT CHANGE

## 출하 시

AC 가 전부 `[x]` 가 되면 이 파일을 `docs/archive/` 로 옮기고 다음 사이클 SPEC 을 이 자리에 새로
쓴다. **완료된 AC 를 이 파일에 누적하지 않는다.** 미결 결정의 SSOT 는 `Status: Proposed` ADR 이다.

> 빈 절은 지운다 — 이 규약은 앵커(`_(not filled yet — …)_`)와 반대이고, 앵커에서만 부재를
> 추론하는 비용이 크기 때문이다.
```

**이 템플릿이 거는 독립 의무 = 11개**
Status 존재/enum/한 토큰(3) · AC 는 `- [ ]` 체크박스 줄(1) · AC 마다 판정 주체 기재(1) · `## Non-Goals`(1) · `## DO NOT CHANGE`(1) · 출하 시 archive 이동(1) · 완료 AC 비누적(1) · 미결은 Proposed ADR 로(1) · 선택 절 표기(1).

**설계 대비 바꾼 것**

| 변경 | 이유 |
|---|---|
| **AC 를 표 → 체크박스 리스트** | 드리프트 헌터 CRITICAL-2 를 재현 확인했다. `.claude/hooks/spec-drift-check.sh` 의 `count_unchecked` awk 는 `/^- \[ \]\|^  - \[ \]/` 만 센다 — 표 행 `\| AC1 \| … \| [ ] \|` 는 `\|` 로 시작해 **안 걸린다.** 살아 있는 ship 게이트(`ship-checklist.md` 가 exit 2 차단으로 적고 `tests/spec-drift-backlog-exemption.test.ts` 가 지키는)가 빨간불 없이 0건으로 죽는다. 리스트로 쓰면 **신규 코드 0으로 기존 게이트가 그대로 문다** |
| `Roadmap:` 헤더 **삭제** · North Star Check **선택** | 낯선 설치자 HIGH. 배포하지 않기로 했어도 이 리포 SPEC 에서 로드맵 경로를 헤더에 박으면 로드맵 파일명이 바뀔 때 거짓이 된다. 근거는 본문에서 링크로 |
| `Tag:` **삭제** | 드리프트 헌터 HIGH. `status: shipped` + `tag: v26.138.0`(없는 태그)이 게이트를 통과하면 **방금 막은 v26.138.0 형태가 새 필드에서 되살아난다.** 태그 사실의 SSOT 는 CHANGELOG↔태그 양방향 게이트(`tests/docs-supply-chain.test.ts`)이고 여기서 두 번째 사본을 만들지 않는다 |
| `Cycle:` 삭제 | 사이클 날짜가 SPEC 과 plan 두 곳에 생기고 대조 장치가 없다(드리프트 헌터 HIGH-7 의 같은 형태) |

---

### 3-3. `docs/templates/PLAN.template.md` (기존 8절 판을 교체·이동)

```markdown
---
status: active
---

# <사이클 이름>

> 이 파일은 **순서와 레인**만 소유한다. 완료 기준은 SPEC 의 AC 다 — 여기서 재서술하지 않고
> AC 번호로 참조한다.

## 순서

- [ ] **<작업>** (AC1) — <레인: 설계 / 테스트 / 구현 / 검증>
- [ ] **<작업>** (AC2) — <레인>

## 막힌 것 (선택)

## 미확인 (선택)

<무엇을 확인 못 했고 무엇이 풀리면 확정되는지 한 줄씩. 못 쓰겠으면 미확인이 아니라 미시도다.>
```

**이 템플릿이 거는 독립 의무 = 5개**
frontmatter `status:` 존재(1) · 값 ∈ `active|shipped|superseded`(1) · 파일명 `<slug>-todo.md`(1) · 완료 기준을 재서술하지 않고 AC 번호 참조(1) · 선택 절 표기(1).

- **`spec:`·`tag:`·`cycle:` 을 뺐다**(낯선 설치자 MEDIUM) — 릴리즈 태그를 안 다는 팀·SPEC 이 없는 팀에서 영구 dangling 이고, dangling 수기 필드는 이 리포에서 실패율이 실측된 종류다.
- **기존 8절 판(Sprint Contract / Dependency Graph / Critical Path / …)을 되살리지 않는다** — 실측 0/22 준수, `src/`·`tests/`·`manifest.ts` 참조 0건의 미배선 템플릿이다.

---

### 3-4. `docs/templates/RESEARCH.template.md`

````markdown
# <조사 제목>

## 방법 — 재현 명령

```bash
<실제로 돌린 명령>
```

<부재를 증명하는 조사라면, **알려진 양성 1건에 같은 명령을 먼저 돌려 그 출력을 함께 싣는다** —
고장난 명령의 빈 출력은 깨끗한 결과와 똑같이 생겼다.>

## 실측

| 항목 | 값 | 어떻게 셌나 |
|---|---|---|

## 결론

## 미확인

<무엇을 확인 못 했고 무엇이 풀리면 확정되는지. 무엇이 무엇을 막는지 쓴다 —
주어 없는 불가 선언("환경 제약상 불가")은 미확인이 아니라 미시도다.>
````

**이 템플릿이 거는 독립 의무 = 5개**
파일명 `<slug>-YYYY-MM-DD.md`(1) · `## 방법`이 `## 실측` 앞(1) · 부재 조사면 canary 선행(1) · 실측 표에 "어떻게 셌나"(1) · 미확인에 해소 조건(1).

- **본문 `- 실측일:` 필드를 뺐다**(드리프트 헌터 HIGH-7) — 파일명이 이미 시점을 담고, 두 곳에 두면 갱신 시 갈린다. 설계 자신이 같은 절에서 "날짜는 파일명이 담는다"고 판정해 놓고 필드를 뒀다.
- **canary 지시를 룰 이름 인용 없이 자족적으로 썼다**(낯선 설치자 MEDIUM) — `cli-development` 는 tooling 트랙 전용이라 다른 트랙에서 출처가 없다.
- **gap.md 는 여기서 규정하지 않는다** — `benchmark-parity.md` §gap.md 스키마가 SSOT.

---

## 4. 상태 머신 — 값 · 전이 · 정규식이 잡는 표기

### 형식 계약 (셋 다 **줄 시작 · 한 토큰 · 줄 끝**)

| 문서 | 정규식 | 비고 |
|---|---|---|
| ADR | `^- Status: (Proposed\|Accepted\|Superseded\|Deprecated)$` | 기존 `- Date:` 줄은 **허용하되 요구하지 않는다**(58건 보존) |
| SPEC | `^- Status: (Active\|Shipped\|Superseded)$` | |
| plan | `^status: (active\|shipped\|superseded)$` (frontmatter) | |
| research | **상태 없음** | 파일명 날짜가 시점을 담는다 |

### 관계 표기 (ADR 전용 · 관계가 있을 때만 존재)

```
- Supersedes: ADR-012            (전면 대체 — 대상 Status 를 Superseded 로)
- Amends: ADR-043 · ADR-053      (부분 수정 — 대상 Status 불변)
- Superseded-by: ADR-023         (스크립트가 쓴다)
- Amended-by: ADR-058            (스크립트가 쓴다)
```
정규식: `^- (Supersedes|Amends|Superseded-by|Amended-by): ADR-\d{3}( · ADR-\d{3})*$`
**값에 괄호·서술을 붙이지 않는다** — 실측 `- Superseded-by: — (해당 없음)`(ADR-054), `- Supersedes: 없음 — ADR-053 의 1차 축을 …`(ADR-058) 처럼 설계가 Status 에서 문제라 지목한 형태가 관계 필드에서 그대로 재현되고 있다(드리프트 헌터 HIGH-5). 서술은 Context/Consequences 로.

### 전이

```
ADR    Proposed ──accept──▶ Accepted ──replace──▶ Superseded (terminal)
           │                    └──obsolete───▶ Deprecated  (terminal, 사유를 PR/본문에)
           └──reject──▶ ADR 을 만들지 않는다 (PR comment 에 사유 — change-management 현행 유지)

SPEC   Active ──ship──▶ Shipped ──▶ docs/archive/
           └──replace──▶ Superseded
plan   active ──ship──▶ shipped ──▶ docs/archive/plans/
           └──replace──▶ superseded
```

- **`Amends` 는 대상 Status 를 바꾸지 않는다.** 회의론자 HIGH: 저자가 부분을 고르면 의무가 0이 되는 **탈출구**가 생긴다. 실측 기저율이 그 우려를 지지한다 — Supersedes 가 지목한 고유 대상 중 여전히 `Accepted` 인 것 7건, 그중 **5건이 선언 줄에서 스스로 "부분"·"폐기 아님"이라 적는다**(ADR-014·016·021·027·043). **완화 = 두 필드의 저자 비용을 같게 만든다**: `Amends` 에도 역방향 `Amended-by` 를 요구하고 **양쪽 다 스크립트가 쓴다**. 남는 차이는 대상 Status 하나뿐이고 그건 의미상 필요한 차이다. **잔여 위험은 감수하고 §12 E-8 에 관측 항목으로 남긴다**(amends:supersedes 비율 추이).
- **`Amends` 는 신설이 아니라 성문화다** — 재현 확인: `docs/decisions/ADR-058-harness-truthfulness.md:7` 이 이미 `- Amends: ADR-043(차별화 축) · ADR-053(개수 축) · ADR-054(입증 책임 방향)` 를 쓴다.
- **archive 이동 트리거 = `status != active`** (프로즈가 아니라 필드).

---

## 5. ADR 58개 정합안

**대전제**: append-only 가 보호하는 것은 **Context/Decision/Alternatives/Consequences 본문**이다. **헤더 상태 필드는 그 대상이 아니다** — `change-management.md` 가 이미 "머지 직전에 Status 를 Accepted 로 바꾼다"고 지시하고 MADR·PEP·adr-tools 셋 다 Status 를 변이시킨다. **이 경계를 §D 계획서에 명시하지 않으면 다음 세션이 헤더 정정을 위반으로 오독한다.**

| # | 대상 | 실측 | 지금 고치나 | 근거 |
|---|---|---:|---|---|
| **N1** | `- **Status**:` → `- Status:` | **21/58** | **지금** | 두 형태 공존 = G-F2 정규식 2벌 = 두 번째 하드코딩 사본. 헤더 줄만 |
| **N2** | Status 값 8건 정규화(날짜·서사 분리) | **8/58** | **지금** | `Superseded by ADR-023 (…)` 4건은 값을 `Superseded` 로 자르고 대상은 `Superseded-by:` 로. `Accepted (2026-04-25, Phase E 완료)` 류 4건은 괄호 제거 |
| **N3** | `Superseded-by:` / `Amended-by:` 역방향 삽입 | 스크립트 | **지금** | adr-tools 전례(`adr new -s 12` 가 옛 ADR 에 역방향을 awk 로 써 넣는다). 사람이 두 곳을 고치는 의무는 이 리포에서 45~59% 실패한 종류 |
| **N4** | 부분 대체 5건을 `Supersedes:` → `Amends:` | **5/58** | **지금** | 안 하면 G-F4 가 **오탐 5 / 실적발 2**로 태어난다. 선언 줄이 스스로 "부분"이라 적으므로 추가 조사 불요 |
| **N5** | ADR-010 · ADR-013 Status | **2/58**(둘 다 `Accepted`) | **지금 — 사용자 판정** | ADR-015 가 둘을 부분 한정 없이 지목한다. `change-management` 가 "한쪽만 고치면 어느 것이 현행인지 알 수 없다"고 금지한 상태의 유일한 실례. **미확인 — 두 ADR 본문을 안 읽었다**(§12 E-5) |
| **N6** | ADR-020 `Status: Proposed` | 1/58 | **지금 — 사용자 판정** | 본문이 `TBD (v26.64.0)` 인데 그 버전은 출하됐다 |
| **N7** | **ADR-054 의 "규약 확장 고지"** | 1건 | **지금 — 추가로만** | 원문: *"`change-management.md` 의 ADR 템플릿에 정의된 필드는 `Supersedes` 뿐이고 `Superseded-by` 는 정의돼 있지 않다."* → N3 착지 순간 **거짓**이 된다. **삭제가 아니라 한 줄 추가로 정정**한다(`> (2026-07-28 정정: 이 필드는 change-management 규약에 정식 편입됐다.)`) — 음성 대조는 삭제 대신 추가로(ADR-057 계열 교훈) |
| **N8** | 절 형식(불릿 15건 → 헤딩) | **15/58**(헤딩 43/58) | **안 한다** | 본문 편집이고 게이트 가치 0. 템플릿을 헤딩으로 두면 43건이 자동 정합. 나머지 15 는 **diff 스코프 게이트**(§7)가 안 건드리므로 면제 표식조차 불필요 — 설계의 N7 표식 15건 삽입 단계가 통째로 사라진다(회의론자 LOW-17 해소) |
| **N9** | `PR:` placeholder 34건 | 34/58 | **안 한다** | 템플릿에서 필드를 빼므로 신규는 안 생긴다. 34건 수기 채움 = 방금 실패가 증명된 그 작업. 인덱스가 git 에서 derive |
| **N10** | `## 적용 범위`·`## Confirmation` 소급 | 47/58 · 58/58 미보유 | **안 한다** | 둘 다 선택 절로 확정(§3-1) |
| **N11** | 파일명 개명 | 0 | **안 한다** | 58/58 이 `ADR-NNN-slug` 로 이미 일관 |

**"지금 고친다" 총량 = 헤더 줄 4종(N1 21 · N2 8 · N3 스크립트 · N4 5) + 사용자 판정 3종(N5 2 · N6 1) + 추가 1줄(N7). 본문 편집 0건.**

**왜 전수 개정을 안 하나(append-only 말고도)**: ADR 을 쓰는 리포의 약 50%가 5건 미만에서 이탈한다는 경험 연구(MSR, 900+ 리포 — **미열람, 검색 요약만**). 58건까지 온 관행을 전수 개정 비용으로 끊는 것이 그 이탈의 형태다.

---

## 6. 앵커 항목 구성 — 확정

### 6-1. 절 구성과 순서

**목표 4절 · 순서 `Boundaries → Verification Gate → Stack & Commands → Where decisions get written down`.**

> **[검토정정 H5] "4절 유지"는 이 워킹트리에 대해 거짓이었다.** 현행 스캐폴드
> (`src/project-claude-merge.ts` `FILL_SECTIONS`)는 **6절**이고, 위 4절은 아직 착지하지 않은
> **선행 계획의 to-be** 다. 정확히는 **삭제 3 · 신설 1 · 재정렬**이다. `templates/CLAUDE.md` 도
> 4절이 아니라 6원칙 + `## Decisions and explanations` 구조다. **§10 단계 9 는 선행 계획의 착지를
> 전제로 하며, 선행 계획이 서지 않으면 이번 사이클에서 뺀다.**

| 순위 | 절 | 틀렸을 때 | 되돌리기 |
|---|---|---|---|
| 1 | **Boundaries** | force push · main 직접 커밋 · 시크릿 커밋 | **불가** |
| 2 | **Verification Gate** | 안 돌린 채 머지·출하 | 비쌈(hotfix) |
| 3 | **Stack & Commands** | 없는 명령을 돌린다 | **쌈 — 명령이 스스로 에러를 낸다** |
| 4 | **Where decisions…** | 결정을 엉뚱한 파일에 적는다 | 쌈 |

**근거는 "되돌리는 비용"이지 준수 연구가 아니다.** primacy 편향은 중간 밀도(150~200 지시)에서 정점이고 4개 절 사이에서 주장할 근거가 없다. 벤더의 "긴 자료를 위, 질의를 아래(+30%)"는 **한 프롬프트 안의 자료 대 질의** 규칙이지 앵커 내부 순서 규칙이 아니다 — 여기서 인용하면 과주장이다.

**순서 근거가 실제로 적용되는 곳은 조립된 `AGENTS.md`** 다: `{PROJECT_CONTEXT}`(프로젝트 사실) → `{PROJECT_RULES}`(≈66~108 의무) → CLI 고유 절. **이 순서는 옳고 유지한다** — 프로젝트 고유 사실은 모델이 어디서도 유도할 수 없고, 밀도(N≈70+)가 primacy 조건을 만족한다.

**공식 Include 열 2행을 지우는 문제 (회의론자 HIGH-7 반영)**: 벤더 표의 ✅ Include 열에 *"Architectural decisions specific to your project"* 와 *"Common gotchas or non-obvious behaviors"* 가 실재한다. 설계는 ❌ Exclude 열만 인용했다. **판정 정정** —
- `Architecture & Layout` 삭제는 **layout 서술**(제외 열 "코드를 읽으면 알 수 있는 것")을 지우는 것이고, **architectural decision 슬롯은 `Where decisions get written down` 이 겸한다**. 이 문장을 계획서에 남긴다.
- `Traps`(= common gotchas)는 슬롯을 없애지 않는다 — **`Boundaries` 안의 한 줄로 흡수**하고, 사건이 나면 별도 절로 승격한다(`harness-fill.md` §Later, not now). 다섯 번째 빈 표식을 만들지 않으면서 슬롯을 남기는 형태다.

### 6-2. 채우는 지시의 위치 — `.claude/harness-fill.md`(비상주). 유지.

FILL 지시문 4개는 그 자체로 의무 ≈20건이고, 채워진 뒤에는 전부 무의미해진다(A5 삭제 테스트를 정의상 통과 못 한다). 앵커 안에 두면 매 세션 상주 의무에 20건이 더해진다. **비상주가 옳다.**

**개정 지시 문안에 반영할 것 (리뷰 3건 병합)**

| 변경 | 근거 |
|---|---|
| 블록 순서를 §6-1 과 일치 | 두 파일이 다른 순서를 쓰면 대조가 어렵다 |
| 머리 규범을 **금지문 → "무엇을 쓰는가" + 이유** | A3′ 의 살아남은 절반(이유 부착). **명령형 제거는 하지 않는다** |
| FILL 1: `NEVER commit secrets` **형태를 유지하고 집행자를 병기** | A3′. 이 리포·설치처 모두 시크릿 커밋을 막는 훅이 0건이라 그 자리를 지키는 것이 명령형뿐이다 |
| FILL 1 에 `Traps` 흡수 한 줄 | §6-1 |
| FILL 3: `Run each command's --help, or find it in a script` + **이유** | 추측한 명령이 우연히 틀리면 읽는 쪽이 추측인 줄 알 방법이 없다 |
| **종료 규칙 신설** — *"한 줄짜리가 될 절, 또는 아무도 집행하지 않는 항목만 남을 절은 헤딩까지 지운다"* | 낯선 설치자 MEDIUM-9. 3인·README 하나 팀에서 FILL 4 는 `README.md` 한 줄이 된다 |
| **채움 후 확인 한 줄** — *"채운 뒤 한 세션을 돌려 에이전트 행동이 실제로 달라졌는지 본다"* | A5 의 벤더 처방(행동 관측) |

### 6-3. 한 세션에 걸리는 독립 의무 총계 — before → after

**재측정(2026-07-28, 좁힌 cond 정규식):**

| 집합 | 의무(하한) | 무조건/조건부/메타 | 가중 예산 |
|---|---:|---|---:|
| **이 리포 상주 A** (전역앵커+루트+레인+룰12) | **126** | *미확정* | *미확정* |
| **실설치 tooling** (`templates/CLAUDE.md` + 룰 10) | **89** | *미확정* | *미확정* |
| **실설치 csr-fastapi** (+ 룰 15) | **108** | *미확정* | *미확정* |
| **실설치 executive** (+ COMMON 5) | **66** | *미확정* | *미확정* |

> **[검토정정 H1] 총계 4개(126/89/108/66)는 독립 레인이 재현했다. 내역과 가중 예산은 재현되지
> 않아 미확정으로 내린다.** 원안은 "재측정(좁힌 cond 정규식)"으로 `95 / 24 / 7 · 157` 을 확정
> 표기하고 §2 A2 가 이를 "178 → 157(−12%)"로 헤드라인화했으나, **그 값을 내는 계수기가 어디에도
> 없다** — 현존 계수기는 `74 / 45 / 7 · 178` 을 낸다. 정규식 두 개를 빼고 재구성하면
> `96 / 23 / 7 · 156` 이고, 원안 자신의 산술("오탐 22건 제거", 45−22=23)과도 어긋난다.
> **§10 단계 0 에서 계수기를 리포에 착지시킨 뒤 그 출력으로 이 칸을 덮어쓴다.** 그전까지 내역을
> 근거로 쓰는 문장은 전부 무효다.
>
> **[검토정정 H3] 상주 A 에는 `$HOME/.claude/CLAUDE.md`(126 중 15)가 들어 있다** — 이 맥에만 있는
> 파일이다. §7 G-F5 ratchet 은 **리포 안에서 derive 되는 집합만** 쓴다(`A_repo = 111`). 전역앵커분은
> 리포트에만 남긴다. 안 그러면 GitHub 체크아웃에 그 파일이 없어 "부재는 throw" 계약과 만나
> **게이트가 죽는 게 아니라 터진다** — v26.128.0~131.0(환경 하드코딩으로 게이트 자멸)과 같은 계열이다.

> 설계의 "배포 상주 COMMON 105"는 **폐기**한다 — 계수기의 12건 손 목록이 `src/manifest.ts:63` 의 `COMMON_RULES`(**5건**)와 어긋나고 `design-workflow` 를 빠뜨려 **어떤 실제 설치와도 대응하지 않는다**(드리프트 헌터 CRITICAL-3 · 낯선 설치자 HIGH-4). 위 4개 값은 `resolveRules()` 의 실제 합성 규칙(COMMON + DEV(hasDevTrack) + UI(hasUiTrack) + TRACK_RULES)을 그대로 재현해 낸 것이다.
> **BLUF 의 378~466 추정치도 폐기** — 표본 2개에서 뽑은 ×3.0~3.7 배율 외삽이고 신뢰구간이 사실상 무한대다(회의론자 MEDIUM-11). **운영은 재현 가능한 하한으로만 한다.**

**before → after (이 계획이 일으키는 변화)**

| 축 | before | after | 델타 |
|---|---:|---:|---|
| 이 리포 상주 A | 126 | **126 ± 2** | ≈0 — `change-management` 인라인 골격 축소(−) + 관계 필드 규약 2줄(+) |
| 실설치 tooling / csr-fastapi / executive | 89 / 108 / 66 | **동일** | 0 — 배포 변경은 `change-management` 골격 축소뿐이고 그 블록은 코드펜스라 줄 계수 밖(슬롯으로는 8필드 → 1필드) |
| **문서 1건 작성 시 추가** | — | ADR **12** · SPEC **11** · plan **5** · research **5** | 신규 |
| ADR 1건 작성 시 총계 | 126 + 0 | **126 + 12 = 138** | — |

**정직한 결론**: 벤치마크 11.9 대비 상주 단독으로 **약 11배**다. **템플릿을 줄인 것으로는 이 숫자가 안 움직인다** — 설계가 43→12 로 줄인 것은 옳지만 지배항이 아니다. 부하를 실제로 줄이는 것은 §8 의 R1b·R2·R3 이고 **전부 사용자 판정 대기**다. 이것을 BLUF 에 적는 이유는, 안 적으면 이 계획이 "부하를 줄인다"로 읽히기 때문이다.

---

## 7. 포맷 게이트

### 설계 대비 가장 큰 변경 — **diff 스코프**

설계가 전례로 인용한 Kubernetes `hack/verify-toc-vs-template.sh` 는 `exit 0` 만이 아니라 **`git diff-tree … "${base}".."${target}"` 로 PR 이 건드린 KEP 만** 검사한다(회의론자 HIGH-4, 원본 확인). 경고량이 저자가 방금 만진 것에 묶여 있어서 exit 0 이 견딜 만한 것이다. 스코프 없이 전체 글롭 + exit 0 을 쓰면 **정상 상태의 경고가 G-F1 9 · G-F2 47 · G-F3 58 건**이고, 상시 만발하는 경고는 정의상 신호가 아니다 — 이 리포가 이미 가진 `spec-drift-check.sh` 상태(산문은 "차단", 실제로는 안 뭄)를 다섯 개 더 만드는 것이다.

**확정**: 대상 = `git diff --name-only <base>...HEAD` ∩ 글롭. base 를 못 구하면(main 위 등) **전체 글롭 + 경고 모드로 리포트만**. 변경 파일에 대해서는 **처음부터 red**.

| ID | 계약 | 대상(글롭) | 모드 | 음성 대조 — **양방향** |
|---|---|---|---|---|
| **G-F1** `plan-status` | `docs/plans/*-todo.md` 에 frontmatter `status:` 존재 + enum. `active` 아닌데 현행 디렉터리에 있으면 archive 대상 | `docs/plans/*-todo.md` (**9건** — `service-audit-roadmap.md` 등 사이클 아닌 13건은 글롭 밖) | diff 스코프 **red** / 전체 경고 | 잡혀야: 활성 2건 지금 전부 경고(frontmatter 0/22). **안 잡혀야: `service-audit-roadmap.md`**(리터럴로 두 곳이 무는 파일 — `tests/docs-supply-chain.test.ts:306`, `ship-checklist.md:20`) |
| **G-F2** `status-token` | Status 줄이 §4 정규식에 정확히 일치 | **`- Status:` 또는 `> **Status**:` 를 가진 현행 md 전체**(git ls-files → archive 제외) — 종류 열거 금지 | diff 스코프 **red** / 전체 경고 | **[검토정정 M1] 단위를 명시한다**: 잡혀야 = **위반 29건**(볼드 21 ∪ 값 8 — 8은 21의 부분집합이 아니라 교차하므로 **파일 단위로는 21건**) · 통과 = **파일 37건**(21+37=58). 원안의 "29 / 36" 은 29+36=65≠58 이고 36 은 `- Status: Superseded`(ADR-052) 1건을 빠뜨렸다. **단위를 안 적으면 게이트가 파일 단위로 21 을 뱉을 때 §10 단계 1 의 "적게 잡히면 고장" 규칙이 정상 게이트를 고장으로 오판한다.** specs 는 **18/18**. N1·N2 **전에** 돌려 red 를 눈으로 본다 |
| **G-F3** `required-sections` | **템플릿 파일에서 헤딩 derive** → 문서와 diff, **삭제 줄만**(템플릿에 있는데 문서에 없는 것). 추가 헤딩 허용 | `docs/decisions/*.md` ← `docs/templates/ADR.template.md` 등 | diff 스코프 **red** / 전체 경고 | 잡혀야: 문서 1건에서 `## Consequences` 제거 → 그 1건. **안 잡혀야: 불릿판 15건**(diff 스코프라 안 건드리면 안 본다) + `(선택)` 헤딩. **바닥 단언**: derive 된 필수 헤딩 수 < 4 면 그 자체로 실패(템플릿이 줄면 조용히 0이 되는 것을 막는다) |
| **G-F4** `adr-relation-symmetry` | `Supersedes: ADR-X` ↔ X 의 `Status: Superseded` + `Superseded-by:` / `Amends: ADR-X` ↔ X 의 `Amended-by:` | `docs/decisions/*.md` 전체 | **경고(자문)** — 전면/부분은 기계가 못 가른다 | **N4 전에** 돌린다: 오탐 5 + 실적발 2 가 나와야 한다. N4 후 오탐 0 · 실적발 2. **과적발로도 실패할 수 있게** 기대값을 양쪽으로 고정 |
| **G-F5** `obligation-budget` | 계수기 하한이 baseline 초과면 실패 | **`resolveRules()` 에서 derive** 한 트랙별 설치 집합 (+ 이 리포 상주 A) | **red**(ratchet) | 임의 룰에 의무 1줄 추가 → +1. **canary 기대 집합 정확 일치가 아니면 값을 안 뱉는다**. **룰 파일 하나를 rename 하면 throw**(현행 계수기는 `MISSING` 을 0으로 세고 넘어가 ratchet 이 '개선'으로 읽는다) |
| **G-F6** `template-doc-sync` | ⓐ `templates/rules/change-management.md` 인라인 ADR 골격 == `docs/templates/ADR.template.md` 본문 ⓑ `docs/REFERENCE.md` §Templates 행 == 템플릿 파일들의 `^## ` 헤딩 집합 | 두 짝 | **red** | 템플릿에서 절 하나 삭제 → ⓐⓑ 둘 다 red. **§8 참조** |

### 0건 함정 방지 — 규율 3줄

1. **음성 대조를 "N건 잡힌다"가 아니라 "잡혀야 할 것 N + 잡히면 안 되는 것 M" 양방향으로 쓴다.** 설계의 "지금 돌리면 22/22 경고"는 게이트가 무는지와 **과대적용하는지를 구분하지 못한다**(드리프트 헌터 HIGH-9).
2. **구조 파싱 게이트에는 바닥(floor)을 둔다** — G-F3 필수 헤딩 수 ≥4, G-F5 canary 정확 집합. OpenSpec 문서가 못 박듯 헤딩 레벨이 틀리면 *"will fail silently"* 다.
3. **계수기의 파일 부재는 0이 아니라 throw.**

### 게이트 설계 원칙

- **열거하지 말고 글롭.** G-F2 대상을 "문서 종류 3개"가 아니라 **"`Status` 줄을 가진 현행 md 전체"**로 정의한다 — 새 종류가 생겨도 안 고치고, `docs/specs/` 의 blockquote 형태도 "상태를 주장하는데 계약 밖"으로 자동 검출된다. 제외 필터는 `tests/docs-supply-chain.test.ts:293-308` 의 것을 **함수로 추출해 공유**한다(복사하면 두 번째 사본).
- **면제는 표식이 있는 쪽에.** 다만 diff 스코프 도입으로 legacy 표식 15건 삽입 자체가 불필요해졌다.
- **ADR 전용 도구에 배선하지 않는다** — 생존 실측: markdownlint 6,229★/2026-07-27 · vale 5,609★/2026-07-23(활성) vs adr-log 105★/2023-01-05 · log4brains 1,513★/2024-12-17(정체). 게이트는 vitest 로 쓴다.
- **인덱스는 생성물로만** — `npm run docs:adr-index` 가 `ADR | 제목 | Status | Date(git derive) | PR(git derive) | Supersedes/Amends` 를 만든다. 손 인덱스를 택한 Backstage 는 새 ADR 마다 두 곳을 사람이 갱신하게 됐다.

---

## 8. 드리프트 차단 — 템플릿 ↔ 그것을 설명하는 문서

**과제문이 든 전례가 이미 리포에 살아 있다.** 재현 확인: `docs/REFERENCE.md:138` 이 `PLAN.template.md` 를 *"Sprint Contract / Phase Overview / Milestone × Dependency Graph + Critical Path / Per-Milestone AC / Risk / Open Questions / Changelog **8섹션**"* 으로 서술하는데, §3-3 이 그 파일을 3절 판으로 교체한다. 그리고 `NORTH_STAR.template.md` 서술은 **바로 다음 줄(:139)** 이다 — 같은 함정이 이웃 줄에서 두 번.

| 사본 | 지금 | 처리 |
|---|---|---|
| `docs/REFERENCE.md:138` §Templates | 손 서술, 동기화 장치 0 | **G-F6ⓑ** — 템플릿 파일의 `^## ` 헤딩 집합에서 derive 한 값과 대조. 장기적으로 `npm run docs:template-index` 로 **생성** |
| `templates/rules/change-management.md` 인라인 ADR 골격 | 손 사본 | **G-F6ⓐ** — 템플릿 파일 본문과 byte 대조 |
| `.claude/evals/session-2026-04-20.md:46` · `docs/requirements-trace.md:170` · `CHANGELOG.md:3534` | 과거 AC/이력 기록 | **면제** — `<!-- doc-format:frozen 과거 기록 -->` 표식(기본값 = 검사) |
| `docs/plans/harness-direction-2026-07-27-todo.md:141,144` | F9 규약을 `status: active \| shipped(<태그>) \| superseded` 로 적는다 | §3-3 이 `shipped(<태그>)` 를 없애므로 **착수 순간 거짓**. 실행 단계에 **본문 정정**을 명시(드리프트 헌터 MEDIUM-14). 구조적으로는 규약 SSOT 를 템플릿 파일로 옮기고 계획서는 링크만 |
| `.claude/skills/architecture-decision-record/checklists/*` | ADR 규약 4번째 사본(옛 필드 지시) | **SKILL.md 에 "이 리포의 ADR 규약 SSOT = `docs/templates/ADR.template.md`" 한 줄** + 체크리스트의 필드 열거 삭제. 배포 안 되고 발화 시에만 로드되므로 우선순위 낮음 |
| `.claude/rules/*` ↔ `templates/rules/*` | **byte 게이트가 2건뿐**(`doc-governance` @ `tests/doc-governance-baseline-rule.test.ts:93` · `benchmark-parity` @ `tests/evidence-templates.test.ts:199`). **`change-management` 에는 없다** | 설계의 "byte-identity 테스트 존재" 문구는 **change-management 에 대해 거짓** → 삭제. 대신 **교집합 전수 byte 게이트** 신설: `readdirSync` 교집합을 돌며 비교, 의도적 분기 5쌍(`no-false-ship` 155 · `git-policy` 58 · `ship-checklist` 40 · `test-policy` 23 · `cli-development` 5)은 `<!-- rule-copy:diverged <사유 10자+> -->` 로 면제. 음성 대조 = **5쌍 잡히고 7쌍 통과**(0건이면 고장) |

> 드리프트 헌터는 "두 파일을 읽어 diff 하는 단언은 리포에 없다"고 했으나 **2건 있다**(위). 설계의 주장도 **change-management 에 대해서는 틀렸다**. 양쪽 다 부분 오류이고 실행에 필요한 사실은 하나다 — **change-management 는 아무도 안 막는다.**

---

## 9. 배포 여부 — 무엇이 나가고 무엇이 이 리포 전용인가

**게시 계약 실측**: `package.json.files = ["dist","templates","scripts/prune-ecc.sh","README.md","LICENSE"]`. `templates/` 는 통째로 tarball 에 들어가고, `src/manifest.ts` 의 `source:` 전수에 `docs/` 가 **없다** → `templates/docs/PLAN.template.md` 는 **게시는 되고 설치는 안 되고 위생 게이트도 안 무는** 3중 회색지대에 있다(`tests/templates-distribution-hygiene.test.ts` 는 manifest 선언 source 만 훑는다).

| 대상 | 결정 | 근거 |
|---|---|---|
| `docs/templates/{ADR,SPEC,PLAN,RESEARCH}.template.md` | **이 리포 전용. tarball 밖.** 기존 `templates/docs/PLAN.template.md` 도 여기로 이동 | 낯선 설치자 CRITICAL-1: 배포 여부가 안 정해지면 §3 전체가 사내 규약인지 배송물인지 갈린다. 배포하면 3인·README 하나 팀에 ADR 12슬롯·SPEC 11슬롯을 얹게 되고, 배포 `doc-governance` 가 이미 *"README 하나면 되는 프로젝트가 정상"* 이라 자기모순이 된다 |
| `templates/rules/change-management.md` 인라인 ADR 골격 | **인라인 유지 + 최소형으로 축소**(1필드 + 4절). **파일 참조로 바꾸지 않는다** | 낯선 설치자 CRITICAL-2: 설치본에는 `templates/` 디렉터리가 없다. 참조 1줄로 바꾸면 첫 ADR 을 쓰려는 에이전트가 없는 경로를 찾다 실패하거나 기억으로 지어낸다 |
| `templates/rules/doc-governance.md` | **변경 없음**(0줄 추가) | 포맷 규약은 `change-management` 가 소유. ratchet 여유가 0인 파일에 줄을 얹지 않는다 |
| `templates/CLAUDE.md` | **이번 사이클 변경 없음** | R2(59→≤30)는 §10 단계에서 **행동 관측 후 사용자 판정** |
| 앵커 스캐폴드(`src/project-claude-merge.ts`) | **절 구성·순서만**. `_(not filled yet — …)_` **문안 교체는 뺀다** | A4(§2). 근거 없는 변경을 배포물에 싣지 않는다 |
| `templates/codex/AGENTS.md.template` · `templates/antigravity/AGENTS.md.template` | **문서 체인 문안 정정 + `Linked SPEC: docs/specs/codex-compat.md` 삭제** | 낯선 설치자 MEDIUM-13: 설치본이 서로 다른 두 지도를 동시에 지시하게 된다. 세션 시작 문안은 존재 조건부로 — *"If docs/SPEC.md exists, read it first. If it does not, this project does not use a SPEC — do not create one."* |
| 이 리포의 태그·ADR 번호 좌표 | **배포 문안에 예시로도 안 쓴다** | `no-false-ship` §templates 는 배포물이다 가 이미 금지(`vX.Y.Z`·`ADR-0NN`). 위생 게이트는 타 프로젝트명만 잡고 우리 좌표는 못 잡는다 |

**결과**: 낯선 설치자 리뷰의 CRITICAL 2건, HIGH 4건 중 3건(SPEC 선행문서·ADR 11슬롯·한국어 헤딩·기호 범례)이 이 한 결정으로 소멸한다. 남는 것은 R1(§10)과 codex/antigravity 템플릿 정정이다.

---

## 10. 실행 순서 — 각 단계의 green 판정

> **전체 스위트를 돌린다.** 스위트 85개 중 48개가 `readFileSync` 로 경로를 읽어 import 그래프 밖이고 `vitest related <문서>` 는 0건을 고른다.

| # | 작업 | green 판정 |
|---|---|---|
| **0** | 계수기 수리 — `resolveRules()` derive · `MISSING`→throw · **슬롯 계수 추가**(필수 절 1=1, 필수 필드 1=1, 값 제약 1=1) · cond 정규식 축소 · canary 정확 집합 | canary 전건 PASS(현재 3/4; 평서형 `~쓴다` 는 **계수 대상에서 제외**하고 그래서 하한임을 출력에 남긴다). baseline 기록 = A 126 / tooling 89 / csr-fastapi 108 / executive 66 |
| **1** | **[검토정정 H7] `G-F1 · G-F2 · G-F4` 만** 넣고 red 를 눈으로 본다(정합 작업 전). **G-F3 은 뺀다** — G-F3 은 `docs/templates/ADR.template.md` 에서 헤딩을 derive 하는데 그 파일이 단계 2 에서 생긴다. 단계 1 에 두면 입력 부재로 실패하고, 그 red 는 게이트가 문 증거가 아니라 **빌드 파손 계열**이다(`no-false-ship` §초록불이 무는지부터 확인한다) | 양방향 기대값(§7, 단위 포함)이 그대로 나오는가. 적게 잡히면 게이트 고장, `service-audit-roadmap.md` 가 잡히면 과대적용 |
| **2** | `docs/templates/` 4종 생성(+ `templates/docs/PLAN.template.md` 이동) · `change-management` 인라인 골격 축소(**두 사본 동시**) · **G-F6** 신설 · **G-F3 신설(단계 1 에서 이동)** | G-F6 · G-F3 각각 red→green 전이를 본다. **계수기 before/after**(토큰 아님) |
| **3** | **N1·N2** ADR Status 표기·값 정규화 | G-F2 ADR 29 → **0**. `npm run ci` |
| **4** | **N4** 부분 대체 5건 → `Amends:` | G-F4 오탐 5 → **0**, 실적발 2 유지 |
| **5** | **N3** `Superseded-by:`/`Amended-by:` 스크립트 · **N7** ADR-054 정정 1줄 | 스크립트 재실행 결과 == 커밋본 |
| **6** | **N5·N6 사용자 판정** — ADR-010/013 전면·부분, ADR-020 Proposed | 판정 후 G-F2·G-F4 green |
| **7** | **[사용자 결정 — 2026-07-29 승인 완료]** 옛 `docs/SPEC.md`(DO NOT CHANGE 보존 앵커)를 `docs/archive/` 로 옮기고 같은 경로에 신규 SPEC 작성(§3-2). **경로가 유지되므로 훅·에이전트 참조는 변경 0곳** | **`bash .claude/hooks/spec-drift-check.sh ship` 이 신규 SPEC 의 미완 AC 를 실제로 센다**(체크박스 형식 검증 — 이 단계가 없으면 게이트가 조용히 죽는다). **주의**: 이 단계가 착지하면 미완 AC 때문에 `ship` 이 **사이클 내내 exit 2** 가 된다 — 그것이 의도지만, ship-checklist 전항 통과를 요구하는 **단계 12 와 충돌**하므로 출하 시점에 AC 를 닫거나 `ship-gate:ignore` 표식을 쓴다 |
| **8** | plans frontmatter — **활성 2건 먼저**. **[검토정정 H6] + `docs/plans/harness-direction-2026-07-27-todo.md:144` 의 `shipped(<태그>)` 를 `shipped` 로 본문 정정** — §3-3 이 `shipped(<태그>)` 를 없애므로 안 고치면 착수 순간 거짓이 된다. §8 이 요구한 바로 그 작업인데 §11 원장은 "채택 — §10 단계 8"이라 적고 단계 8 본문엔 없었다 | G-F1 경고 감소. `npm run ci` |
| **9** | 앵커 절 구성·순서 + `harness-fill.md` 개정(§6-2) + codex/antigravity 템플릿 정정 | `project-claude-merge.test.ts` · `agents-md-scaffold-parity` · `context-cost-ratchet` + **Docker 시나리오로 4-CLI 산출물 절 순서 확인**(배포물) |
| **10** | **행동 관측 1회** — 개정 앵커/룰로 같은 과제를 돌려 행동이 달라지는지 | 벤더 처방(A5). **이 단계 없이 11 로 가지 않는다** |
| **11** | **R2 삭제 테스트**(`templates/CLAUDE.md` 59 → 목표 ≤30) — **사용자 판정** | 계수기 before/after + 10 의 관측 결과 |
| **12** | 독립 리뷰(이 문서를 쓰지 않은 레인) | 리뷰 CRITICAL 0 + `npm run ci` exit 0 |

**감축 레버 — 정정판**

| # | 레버 | 델타 | 상태 |
|---|---|---|---|
| ~~R1~~ | `paths:` 지연 로드 | **배포 트랙 0 / 상주 A 최대 −16 (미검증)** | **[검토정정 H2] 델타 0 은 배포 설치본에 대해서만 참이다.** 이 리포 상주 A(126)에는 `.claude/rules/benchmark-parity.md`(12)와 `playwright-launch.md`(4)가 **실재하고 매 세션 로드된다** — 합 16 = A 의 12.7%. Claude Code 가 `paths:` 를 존중하면 126→110 이다. **기각 사유는 "델타 0"이 아니라 "Claude Code 의 `paths:` 지원이 미검증"(§12 E-4) 하나다.** E-4 의 "도달해도 델타는 error-handling 4 뿐"은 A 를 계산에 안 넣은 문장이라 삭제한다. 아래 원안 근거는 배포 트랙에 대해서는 그대로 유효하다 — **기각.** `benchmark-parity`·`playwright-launch` 는 `UI_RULES` 라 tooling 에 **애초에 안 깔린다`(manifest.ts). 그리고 codex·antigravity 는 설치 시점에 앵커를 AGENTS.md 로 **인라인**하고 opencode 는 `opencode.json` `instructions` 로 **글롭 병합**한다 — 셋 다 frontmatter 를 읽을 경로가 없다. Claude Code 한정 가설이고 미검증(§12 E-4) |
| **R1b** | **COMMON/DEV 룰 중 트랙 한정분을 스킬로 이관** | 미측정 | **신규 채택.** 벤더 공식이 처방하는 지연 로드 수단은 `paths:` 가 아니라 **스킬**이다 — *"For domain knowledge or workflows that are only relevant sometimes, use skills instead. Claude loads them on demand without bloating every conversation."* 이 리포는 스킬 배포 파이프라인을 이미 갖고 있다 |
| **R2** | `templates/CLAUDE.md` 59건 A5 삭제 테스트 | 59 → 목표 ≤30 | **사용자 판정 + 행동 관측 선행** |
| **R3** | 조건부 24건 중 훅으로 옮길 수 있는 것 | 옮긴 만큼 ×2로 감소 | 예: `doc-governance` §baseline 대조의 3중 발동 조건 |
| ~~R4~~ | 룰 2사본 분기 5쌍 | **의무 0 감소** | 사례 표는 사실이지 의무가 아니다. 토큰은 줄지만 A1 축이 아니다 — 위생으로 새지 않기 위해 명시 |

**사용자 결정 지점**: 6(무엇이 현행 ADR 인가) · 9(배포물) · 11(배포물 삭제) · R1b(룰→스킬 이관).

---

## 11. 리뷰 처리 표 — 48건 전건

**범례**: 채택 = 확정안에 반영 · 수정채택 = 취지 반영·형태 변경 · 기각 = 사유 명기.
S = 준수 회의론자(18) · I = 낯선 설치자(15) · D = 드리프트 헌터(15).

| ID | 지적 | 처리 | 사유 / 반영 위치 |
|---|---|---|---|
| S1 | 임계값을 관대한 프리프린트에서 골랐다(AgentIF 11.9/ISR<30% 미인용) | **채택** | §2 A1. 출처를 연 지적이 설계 주장에 우선. 임계 교체 → §3 템플릿 축소의 직접 근거 |
| S2 | 계수기가 슬롯을 못 본다(2/43) · G-F5 범위가 열거 | **채택** | §7 G-F5 · §10 단계 0(슬롯 계수 추가, resolveRules derive) |
| S3 | 필수 절 현행 0/58 인데 소급 금지 → 영구 만발 | **채택(형태 변경)** | 필수 절을 4개(58/58 보유)로 축소 + `적용 범위`·`Confirmation` 선택화 + **diff 스코프**. §3-1 · §7 |
| S4 | K8s 전례는 exit 0 을 **diff 스코프와 함께** 쓴다 | **채택** | §7 전면. 이 지적 하나가 게이트 5종의 운영 형태를 바꿨다 |
| S5 | `Amends` 는 저자가 끄는 스위치 | **수정채택** | §4. 두 필드의 저자 비용을 같게(역방향 양쪽 스크립트 소유). 잔여 위험 감수 + §12 E-8 관측 항목 |
| S6 | A3 출처가 출력 서식 팁이고 반대 문장 미인용 | **채택** | §2 A3′. **명령형 제거를 뺐다.** 근거가 무너진 항목으로 명시 |
| S7 | 벤더 Include 열 2행(Architecture decisions · gotchas)을 지우며 Exclude 열만 인용 | **채택** | §6-1. layout 서술 vs architectural decision 구분 명시 + Traps 를 Boundaries 한 줄로 흡수 |
| S8 | R1 이 미검증 메커니즘에 걸려 있고 벤더는 스킬을 처방 | **채택** | §10 R1 기각 · R1b 신설 |
| S9 | exit 0 승격 조건에 주인·기한 없음 | **채택** | §7. diff 스코프 변경 파일은 **처음부터 red**. "승격"이라는 미래 약속 자체를 없앴다 |
| S10 | cond 분류 미검증 · canary 계약 자기 위반 · 오탐 49% | **채택** | §2 A2 재측정(45→24, 가중 178→157) · §10 단계 0 |
| S11 | BLUF 378~466 은 n=2 외삽 | **채택** | §6-3. 추정치 폐기, 재현 가능한 하한만 운영 |
| S12 | D-3 의 "순서만"이 현행 트리와 불일치(FILL_SECTIONS 6개) | **채택** | 재현 확인(`src/project-claude-merge.ts:40` = identity/stack/architecture/installed-assets/boundaries/verify). §10 단계 9 에 "선행 계획 착지 후 기준" 전제 명시 |
| S13 | A4 는 "표식을 둔다"를 지지하지 "단어를 바꾼다"를 지지 안 함 | **채택** | §2 A4 무행동 · §9 문안 교체 제외 |
| S14 | MADR 이 Confirmation 을 optional 로 분류한 것을 미인용 | **채택** | §3-1 선택 절로. 원문 인용 포함 |
| S15 | green 기준이 토큰인데 설계가 그 축을 기각했다 | **채택** | §2 말미 + §10 전 단계 계수기 기준 통일 |
| S16 | A5 인용 문서가 처방한 행동 관측이 실행에 없다 | **채택** | §10 단계 10 신설(R2 선행 필수) |
| S17 | N7 면제 표식 15건 삽입 단계 부재 | **채택(소멸)** | §5 N8. diff 스코프로 표식 자체가 불필요 |
| S18 | `## Context` 44 → 실측 43 | **채택** | §5 재측정 확인(헤딩 43 / 불릿 15 = 58) |
| I1 | 템플릿 4종 배포 여부가 비어 있다 | **채택** | §9. `docs/templates/` = tarball 밖 |
| I2 | change-management 를 파일 참조로 바꾸면 설치본에서 끊긴다 | **채택** | §9. 인라인 유지 + 축소 |
| I3 | R1 의 −20 중 16 은 이미 안 깔린다 · `paths:` 는 3개 CLI 에서 배선상 불가 | **채택** | §10 R1 기각 |
| I4 | "COMMON 105"가 어떤 설치와도 대응 안 함 | **채택** | §6-3 재측정(89/108/66). 독립 재현으로 I 의 수치와 일치 확인 |
| I5 | SPEC 이 NORTH_STAR·roadmap·archive 를 선행 요구 | **채택** | §3-2(North Star Check 선택 · Roadmap 삭제). 배포 안 하므로 영향은 이 리포 한정이나 **문안은 그대로 고쳤다** |
| I6 | ADR 11슬롯이 3인 팀에 과하다 | **채택** | §3-1(9슬롯/총 12) + §9 미배포 |
| I7 | `🧪✅⬜` 범례가 배포 자산에 없다 | **채택** | §9 미배포 + §3-1 강제 제거(선택 절) |
| I8 | 한국어 헤딩 + 헤딩 diff 게이트 | **채택(소멸)** | §9 미배포로 계약 충돌 없음 |
| I9 | 앵커 4절 중 둘만 실질 내용 | **수정채택** | 4절 유지 + `harness-fill` 종료 규칙("한 줄짜리 절은 헤딩까지 지운다"). 절을 3개로 줄이는 것은 **기각** — 슬롯 부재는 되돌리기 비싸고(다음 사람이 그 자리를 안 만든다) 종료 규칙이 같은 효과를 싸게 낸다 |
| I10 | 스캐폴드 채움률이 미측정 | **채택** | §12 E-9 신설 + §6-1 에 "순서 변경의 기대 효과는 채움률에 비례" 조건 명시 |
| I11 | plan frontmatter 4필드 중 3개 dangling | **채택** | §3-3 `status` 만 |
| I12 | research canary 의 근거 룰이 tooling 전용 | **채택** | §3-4 자족적 문장으로 재작성 |
| I13 | codex/antigravity 템플릿이 옛 문서 지도를 지시 | **채택** | §9 · §10 단계 9 |
| I14 | G-F5 계약과 단계 0 이 서로 무효화 | **채택** | §10 단계 0(평서형은 계수 대상 제외 → canary 전건 PASS) |
| I15 | 배포 문안에 `v26.140.0` 좌표 | **채택** | §9 마지막 행. §3-2 에서 `Tag:` 자체를 삭제해 발생지 소멸 |
| D1 | PLAN.template 서술 4벌 · REFERENCE:138 | **채택** | §8 G-F6ⓑ. 과제문의 전례가 이웃 줄에서 재현됨을 확인 |
| D2 | AC 표 셀 `[ ]` 는 spec-drift 훅이 못 센다 | **채택** | §3-2 체크박스 리스트. `count_unchecked` awk 재현 확인 · §10 단계 7 검증 |
| D3 | COMMON_RULES 하드코딩 · MISSING→0 | **채택** | §6-3 · §7 G-F5 · §10 단계 0 |
| D4 | byte-identity 테스트가 없다 | **부분 채택 + 정정** | **2건 있다**(doc-governance:93 · evidence-templates:199) — D 의 "없다"도 틀렸고 설계의 "존재"도 change-management 에 대해 틀렸다. §8 에 양쪽 정정 + 교집합 전수 게이트 신설 |
| D5 | ADR 헤더 정의 3벌 · ADR-054 고지가 거짓이 된다 | **채택** | §5 N7(추가로 정정) + §4 관계 필드 한 토큰 계약 + §8(SSOT 를 템플릿으로) |
| D6 | `Date:` 를 쓰는 주체가 없다 | **채택(형태 변경)** | §3-1 **필드 자체를 삭제**. 생성기(`scripts/adr-new.mjs`)는 번호·파일명·초기 Status 만 담당하고 날짜는 git 이 소유 |
| D7 | research 날짜 2벌 | **채택** | §3-4 `실측일` 필드 삭제 |
| D8 | `tag:` 가 태그 실재를 안 본다 = v26.138.0 형태 재현 | **채택** | §3-2·§3-3 `Tag:`/`tag:` 삭제. 태그 사실의 SSOT 는 기존 양방향 게이트 |
| D9 | G-F1 글롭이 사이클 아닌 6건에 과대적용 | **채택** | §7 대상 = `docs/plans/*-todo.md`(**9건**, 재측정). 음성 대조에 `service-audit-roadmap.md` 무경고 포함 |
| D10 | templates/docs 3중 회색지대 | **채택** | §9 |
| D11 | 글롭/열거 혼합(G-F2·G-F5) | **채택** | §7(G-F2 = Status 줄 보유 문서 전체, G-F5 = resolveRules derive) |
| D12 | 활성 사이클 판정 2벌(`SHIP_SUBSPEC` vs frontmatter) | **부분 채택** | 훅 기본 분기(`docs/SPEC.md` + `docs/todo.md`)는 신규 레이아웃과 일치하므로 **훅을 이번엔 안 고친다**. 대신 §10 단계 7 에 "훅이 신규 SPEC 을 무는지" 검증을 넣었다. `SHIP_SUBSPEC` 경로 통합은 **기각(이번 범위 밖)** — 되돌리기 싸고, 지금 고치면 살아 있는 게이트를 같은 PR 에서 건드린다 |
| D13 | ratchet 2벌(context-cost vs 의무 baseline) | **채택** | §7 G-F5 를 `context-cost-baseline.json` 의 **셋째 축**으로 넣는다(측정 경로 단일화, `npm run cost:baseline` 한 명령). `tests/obligation-budget.test.ts` 별도 신설 취소 |
| D14 | harness-direction-todo:144 가 규약을 다른 값으로 적는다 | **채택** | §8 표 + §10 단계 8 |
| D15 | ADR 스킬이 4번째 사본 | **채택(우선순위 낮음)** | §8 마지막 행 |

**기각 2건 / 부분 2건 / 나머지 44건 채택.** 기각 사유는 위 표의 I9·D12 행에 적었다.

---

## 12. 미확인 — 무엇이 풀리면 확정되나

| # | 미확인 | 왜 못 했나 | 풀리는 조건 |
|---|---|---|---|
| **E-1** | **긍정형 vs 부정형의 직접 효과 크기** | 같은 과제에서 A/B 한 공개 정량 연구가 없다. 벤더 권고는 수치 없음 | 자체 측정 — 금지문 N개를 "집행자·이유 병기" 판으로 바꾼 판본과 원판을 같은 과제에 물려 위반 횟수를 센다. **§10 단계 10 이 이것을 겸할 수 있다** |
| **E-2** | `_(NOT RECORDED)_` 문안의 효과 | AbsenceBench 는 "지운 줄 찾기"라 "제목은 있고 내용이 빈 절"과 다르다 | 두 문안으로 렌더한 스캐폴드를 같은 과제에 물려 "없다고 단정 vs 묻기" 빈도 비교. **그 전까지 문안 교체를 배포하지 않는다** |
| **E-3** | 계수기의 과소 계수 배율 | 수기 대조 표본 2개(59 vs 16 · 6 vs 2) | 룰 3~4개 추가 수기 계수. **단 §6-3 은 배율을 쓰지 않고 하한만 쓰므로 운영은 이것 없이 굴러간다** |
| **E-4** | `paths:` 를 Claude Code 가 존중하는가 | 3개 CLI 는 배선상 불가를 코드로 확인(인라인·글롭 병합). Claude Code 만 미확인 | `test/docker/run.sh` 로 도달 확인. **도달해도 R1 델타는 error-handling 4 뿐**이라 기각 판단은 안 바뀐다 |
| **E-5** | ADR-010 · ADR-013 이 전면 대체인가 | 두 ADR 본문을 안 읽었다. 확인한 것은 "ADR-015 선언 줄에 부분 한정이 없다"와 "둘 다 `Accepted`"까지 | 두 파일 본문을 읽고 사용자 판정(N5) |
| **E-6** | G-F3·G-F6 이 실제로 몇 건을 잡는가 | 구현 전. 이 리포에 마크다운 린터가 없다(devDeps·설정 0건) | §10 단계 1·2 의 dry-run 출력 |
| **E-7** | VeyraBench 의 지위 | 단독저자 프리프린트, 동료심사 미확인 | **완화됨** — 임계값을 AgentIF 로 교체했으므로 이 논문에 무게가 실린 결론이 남아 있지 않다. 형식 무효 결론만 이 논문 단독이고, **그래서 형식은 판정 항목에서 뺐다**(주장 대신 비판정) |
| **E-8** | `Amends` 탈출구가 실제로 발생하는가 | 신설 직후라 표본 0 | 사이클마다 `amends:supersedes` 비율과 `Superseded` 전이 건수를 G-F4 리포트에 남긴다. 비율이 치솟으면 `Amends` 를 폐기하고 단일 필드 + 자문 게이트로 되돌린다 |
| **E-9** | **스캐폴드 채움률** — 설치 후 앵커 4절이 실제로 채워지는 비율 | 이 하네스가 한 번도 잰 적 없다 | 설치 로그(`.uzys-agent-harness/`)에 앵커 스냅샷 해시를 남기고 update 시 변경 여부 집계, 또는 사용자 5인 수기 확인. **채움률이 낮으면 §6-1 순서·문안 논쟁의 기대값이 0 에 수렴한다** |
| **E-10** | MSR 900+ 리포 "50%가 5건 미만 이탈" | 검색 요약만 봤고 원문 미열람 | 원문 확인. §5 의 보조 근거일 뿐이고 주근거(append-only)는 독립적이다 |

**본 확정안은 미검증이다.** 문안·수치는 이 세션에서 실측했으나, 이 문서를 쓰지 않은 레인의 리뷰를 거치기 전에는 착수 근거가 아니다(원칙 4 · `.claude/CLAUDE.md` 대원칙 — 만든 레인은 자기 산출물을 판정하지 않는다).

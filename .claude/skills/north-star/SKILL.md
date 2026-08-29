---
name: north-star
description: >-
  Defines and enforces a project's long-term direction (North Star Statement,
  metric-as-proxy NSM, strategic Pillars with a module↔pillar map, Will/Won't,
  4-gate + priority-order decision heuristics), then turns that direction into a
  ranked, persisted roadmap so the plan survives /compact and new sessions. Use
  when starting a new project, when scope creep is suspected, when a non-obvious
  feature request needs prioritization, or when the user asks where the project
  should go next. Sits one layer above SPEC/PRD — answers 'why and where to', not
  'what and how'. Fires on the user's real phrasings: "앞으로 어떤 방향으로
  개선·발전시킬지 고민해봐", "NORTH.md / NORTH_STAR 보고 나아갈 방향 + 기능 제안",
  "나아갈 방향 + 기능제안 (수용 → 계획 수립하고 메모리에 기록)", "북극성 정렬 로드맵",
  as well as the English equivalents "what direction should we take next", "propose
  a roadmap / feature backlog from the north star", "plan the next milestones and
  save it to memory". Do NOT use it to find what is broken right now — detecting
  bugs, gaps, or quality regressions belongs to the audit/gap skills; this skill
  consumes their findings and DIRECTS forward planning.
---

# North Star

## Purpose

SPEC/PRD가 "무엇을 어떻게"를 다루면, North Star는 **왜·어디로**를 다룬다.

- 의사결정이 모호할 때 우선순위 판정의 SSOT.
- 신규 요청·기능이 "범위 안인가?"를 검증 가능한 기준으로 거른다.
- Won't (의도적 비-방향)을 명시해 scope creep을 사전 차단.
- 그 방향을 **지속되는 로드맵**으로 바꿔 대화가 끝나도 살아남게 한다.

The point is alignment, not idea generation: every proposal must trace upward to
the north star, and the result must outlive the conversation that produced it.

## 세 가지 lifecycle — 섞이면 전부 망가진다

이 스킬이 다루는 것들은 **수명이 다르다.** 하나의 지표 체계에 몰아넣으면 일회성 완료
목표가 영구 지표 자리를 차지하고, 반대로 계속 지켜야 할 조건이 "완료"로 닫힌다.

| | 무엇 | 수명 | 소유 개념 |
|---|---|---|---|
| **DIRECTION** | 계속 향하는 사용자 가치와 전략 방향 | 서비스가 존재하는 동안 | North Star · NSM · Inputs · Pillars · Boundaries |
| **CHANGE** | 현재 상태를 바꾸는 **유한한** 작업 | Finish Line 을 통과하면 끝 | Product Initiative · Enabler Initiative · Finish Line |
| **RUN** | 완성된 서비스를 유지하는 영역 | 운영하는 동안 계속 | SLO · Guardrail · Operational Health · Operational Work |

세 단어를 혼동하지 않는다:

> **North Star** = 계속 향하는 방향. 도착해서 끝나지 않는다.
> **Finish Line** = 이 Initiative 를 언제 종료할지 정하는 완료 조건. 통과하면 종료된다.
> **Guardrail** = 운영하는 동안 계속 지켜야 하는 조건. 달성이 아니라 유지다.

```
      DIRECTION                 CHANGE                    RUN
    North Star            Product Initiative        SLO / Guardrail
        │                        │                        │
   NSM ─┴─ Inputs          Enabler Initiative      Operational Health
        │                        │                        │
     Pillars                Finish Line            Operational Work
                                 │                        │
                               Done         구조적 문제 발견 ─┘
                                                ↓
                                        Enabler Initiative
```

### Lifecycle 판정 규칙 — 목표·지표를 정의할 때 **가장 먼저**

> **이 목표를 달성하면 더 이상 추적할 필요가 없는가?**

| 답 | 분류 | 어디에 적는가 |
|---|---|---|
| **YES** — 달성하면 끝 | **Finite** | Initiative Target · Finish Line · Exit Criterion |
| **NO** — 달성 후에도 계속 재고 유지해야 한다 | **Persistent** | NSM · Input · SLO · Guardrail |

**Finite 와 Persistent 를 한 지표 체계에 섞지 않는다.** "테스트 커버리지 80% 달성"은
Finite 이고 "커버리지 80% 이상 유지"는 Persistent 다 — 문장은 비슷한데 사는 곳이 다르다.

## When to Invoke

| 트리거 | 행동 |
|--------|------|
| 신규 프로젝트 시작 | 북극성 문서 부재 시 작성 제안 |
| Major CR / scope 확대 의심 | 게이트 통과 여부 점검 |
| 분기 1회 정기 리뷰 | NSM 변경, Pillar 변경, Won't 변경 검토 |
| 신규 기능 요청 진입 시 | 게이트 통과 시만 우선순위 진입 |
| "앞으로 어디로 가야 하나" | 아래 로드맵 워크플로 (분류 → 방향 → 순위 → 영속화) |

Do **not** reach for it to find what's broken right now. Detecting defects, gaps,
or quality regressions is the sibling audit skills' job; this skill consumes their
findings and points forward.

---

# DIRECTION — 계속 향하는 것

### 1. North Star Statement

한 문장으로 프로젝트의 종착점을 표현. 5년 뒤 이 프로젝트가 무엇이 되어 있어야 하는가.

**좋은 예**: 도메인 명사 + 사용자 + 측정 가능한 결과.
**나쁜 예**: "최고의 X" / "사용자 만족" — 측정 불가.

### 2. North Star Metric (NSM) — metric-as-proxy

NSM 은 **하나**이고, 그것은 북극성이 실현되고 있는지를 대표하는 **지속 지표**다.
일회성 완료 목표는 NSM 이 될 수 없다(위 lifecycle 판정을 먼저 통과시킨다).

**Definition 과 Current Target 을 분리해서 적는다.**

| | 무엇 | 언제 바뀌는가 |
|---|---|---|
| **NSM Definition** | 무엇을 어떻게 재는가 | 전략이 바뀔 때만. **Major CR** |
| **Current Target** | 지금 겨냥하는 수치와 시점 | 도달하거나 근거가 바뀌면. 정기 리뷰 사안 |

**Target 에 도달했다는 이유로 NSM 자체를 바꾸지 않는다.** 그때 하는 일은 다음 Target 을
정하는 것이다. Definition 이 바뀐다는 것은 "이제 다른 것을 재기로 했다"는 뜻이고, 그건
방향 변경이라 별도 결정을 받는다.

**진짜 목표가 직접 측정 불가하면 프록시를 선언한다.** 많은 프로젝트의 실제 목표(사용자의
투자 수익, 팀의 생산성, 학습 성과 등)는 외부적이거나 지연되어 직접 측정할 수 없다. 그때
"측정 불가"로 방치하지 말고:

1. **프록시 지표를 명시적으로 선언** — "진짜 목표 X 는 직접 측정 불가하므로 Y 를 프록시로
   최적화한다"를 문서에 그대로 적는다. 왜 이 프록시인지 1줄 근거 필수.
2. **양(1차) + 사후 품질(짝)** — 프록시는 행동의 양(추적되는 의사결정 수 등)과 그 행동의
   사후 품질(성과 추적이 양(+)인 비율 등)을 짝으로 잡는다. 양만 재면 굿하트 법칙으로 프록시
   자체가 게임된다.

NSM 결정 기준:

- **Lagging (결과) vs Leading (원인) — Leading 권장.** 이미 끝난 결과로는 조타할 수 없다.
- **단일 행동만 측정 (composite 금지).**
- **Current Target 명시** ("≥ 40% by 2026").
- **게임 가능성 점검** — 가치를 전달하지 않고도 직접 올릴 수 있으면 북극성이 아니다.
  그런 지표를 발견하면 조용히 그것을 향해 계획하지 말고 먼저 그 사실을 알린다.

### 3. Inputs — 직접 움직일 수 있는 레버 3–5개

NSM 은 **결과**이고 Inputs 는 그것을 움직이는 **원인**이다. 둘의 역할이 다르므로 목록을
따로 유지한다 — Input 은 "NSM 을 보조하는 작은 지표"가 아니라, 팀이 실제로 손댈 수 있는
지속 지표이고 계획은 여기에 붙는다.

각 Input 마다: **정의 · 현재 값 · 목표 방향 · NSM 을 움직인다고 믿는 이유 1줄.**
측정되지 않는 Input 은 "미측정"이라고 적는다 — 빈칸으로 두면 없는 것과 구분되지 않는다.

### 4. Pillars (전략 축) + 모듈 ↔ 축 매핑

North Star 로 가는 길을 3-5개 **전략 축**으로 분해한다. 각 축은 4요소로 정의:

- **정의** — 이 축이 사용자에게 주는 것 1문장.
- **현재 위치** — 이 축에 속한 기존 모듈/기능.
- **전방 목표** — 다음에 쌓을 것.
- **가설** — 이 축이 NSM 을 올린다고 믿는 이유 1줄.

그리고 **모듈 ↔ 축 매핑 표**를 유지한다: 모든 모듈은 최소 1개 축에 속한다 (플랫폼 공통
인프라는 "공통"으로 명시). **어떤 신규 모듈이 어느 축에도 매핑되지 않으면 착수 전에 북극성
정렬을 재검토한다** — 매핑 실패 = scope creep 의 조기 신호.

### 5. Will / Won't / Trade-offs

- **Will**: 집중 영역 4-6개. 동사로 시작 ("개인 사용 깊이 우선", "AI 친화 1급 시민").
- **Won't**: 의도적 비-방향 **5-8개**. "X는 안 한다" 명시. 가장 중요한 섹션 — scope creep의
  1차 방어선. 비어 있으면 이 문서는 아무것도 막지 못한다.
- **Trade-offs**: "**선택 → 포기한 것 → 근거**" 3열 표. 의식적 결정의 추적 기록이며, 같은
  논쟁을 반년 뒤에 처음부터 다시 하지 않게 하는 유일한 장치다.

### 6. Versioning

- 분기 1회 또는 NSM Current Target 도달/미달 시 갱신.
- **Major CR**: NSM Definition 변경 / Pillar 변경 / Won't 변경.
- **Clarification**: Current Target 갱신, Trade-off 추가, 매핑 보강.
- 갱신 사유는 커밋 메시지에 남긴다 — 문서 본문에 이력을 쌓지 않는다.
- 북극성이 바뀌면 그 아래 로드맵·계획 문서는 자동으로 최신이 아니다. 같은 갱신 단위에서
  재검토 대상으로 표시한다.

---

# CHANGE — 유한한 작업

### Work Type — 실행 작업은 셋 중 하나다

| Work Type | 의미 | 게이트 | 순위 결정 |
|---|---|---|---|
| **Product Initiative** | 사용자 가치·제품 경험을 바꾸는 유한한 작업 | 아래 4-gate | RICE/ICE + 판단 |
| **Enabler Initiative** | 기술·운영 capability 를 바꾸는 유한한 작업 | 아래 4-gate (Value 게이트는 간접 경로 허용) | RICE/ICE + 판단 |
| **Operational Work** | 현재 서비스를 유지하는 반복적·사건 기반 업무 | **게이트를 기계적으로 적용하지 않는다** | severity·위험·기한 |

**Operational Work 를 전부 Enabler Initiative 로 만들지 않는다.** 백업 검증, 인시던트 대응,
정기 점검은 그냥 운영이다. 그 운영에서 **구조적 문제**가 반복해 드러날 때에만 별도의
Enabler Initiative 로 승격하고, 그때 Finish Line 을 붙인다.

### 4-Gate Decision Heuristic — "할 것인가"

신규 Initiative 는 4개 게이트를 **모두** 통과해야 우선순위에 진입한다.

| Gate | 질문 | 통과 기준 |
|------|------|----------|
| **Trend** | 프로젝트의 핵심 트렌드/원칙 중 1개 이상에 매핑되는가? | YES |
| **Value** | 사용자 가치에 닿는 경로가 있는가? | 아래 두 형태 중 하나 |
| **Capability** | 현재 시스템이 이것을 동등하게 노출 가능한가? (UI 한정 기능은 -1) | YES |
| **Lean** | 선언된 Will 범위 내에 있는가? 외부면 Open Question 으로 적재 후 분기 1회 재평가 | YES |

**Value 게이트의 두 형태** — 이 갈래가 Enabler 를 억지로 사용자 지표에 묶지 않게 한다:

- **직접(Product)** — Primary persona 에게 직접 가치를 준다. Anti-persona 위주면 거절.
- **간접(Enabler)** — 자기가 **막아 주는 Guardrail/SLO** 또는 **가능하게 하는 Initiative·
  Pillar capability** 를 이름으로 지목한다. 지목된 그것이 사용자 가치를 나른다.
  Security · Reliability · Observability · Migration 이 여기 산다. **NSM 을 직접 움직이지
  않아도 정당한 Initiative 다** — 다만 "무엇을 위해서인지"를 이름으로 못 대면 탈락이다.

게이트 명칭은 프로젝트마다 customize 가능하나 **4개 ALL True** 원칙은 유지.

### Finish Line — 유한함을 증명하는 것

모든 Initiative 는 **Exit Criterion** 을 갖는다. 없으면 그건 Initiative 가 아니라 방향이거나
운영이다. 좋은 Finish Line 은 관측 가능하고, 통과 여부를 두고 논쟁이 안 생긴다.

**완료 시 전환 규칙** — 여기가 빠지면 완료된 목표가 영구 KPI 로 남아 계속 감시 비용을 문다:

1. **Finish Line 은 종료한다.** 이미 통과한 완료 조건을 지속 KPI 처럼 계속 추적하지 않는다.
2. **Initiative Metric 은 자동으로 Persistent Metric 이 되지 않는다.** 승격은 **결정**이지
   기본값이 아니다.
3. **계속 유지해야 하는 성질만** 명시적으로 넘긴다 — 사용자 가치의 지속 개선이면
   **NSM/Input** 으로, 운영 중 계속 지켜야 하는 조건이면 **SLO/Guardrail** 로. 넘길 때
   "무엇을 왜 넘기는가"를 한 줄 남긴다.
4. 넘길 것이 없으면 **아무것도 안 남기고 닫는다.** 그게 정상이다.

### Initiative Sequencing Heuristic — 유한한 작업의 순서

**적용 범위: 신규 서비스 구축 · 신규 Feature Initiative · 아직 Finish Line 을 통과하지 못한
기능.** 운영 중인 제품 backlog 전체의 절대 우선순위 규칙으로 쓰지 않는다.

1. **Foundation (기본 필수 기능)** — 없으면 제품이 성립 안 되는 기본기 (예: 표준 로그인).
   "기본"이 빠진 채 화려함부터 쌓지 않는다.
2. **End-to-End Completeness (기능 완성도)** — 이미 shipped 된 기능이 사용자 관점
   end-to-end 로 진짜 완결인가. **단순 존재 ≠ 완결** (버튼이 동작하나, 링크가 목적지까지
   가나, 빈/에러 상태가 처리되나).
3. **Differentiation (차별화 깊이)** — 핵심 경쟁력의 advanced 구현. **research/ADR 선행
   필수** — advanced 부터 코드로 뛰어들지 않는다.

**한 Initiative 안에서 상위 단계에 미완이 있으면 하위로 건너뛰지 않는다** (긴급 hotfix·
사용자 명시 지시 예외).

### 우선순위 — RICE/ICE 를 쓰는 자리와 안 쓰는 자리

**RICE/ICE 는 모든 작업을 한 Pool 에서 비교하는 기준이 아니다.** 아래는 optional feature 와
점수로 경쟁시키지 않는다 — 경쟁시키는 순간 "점수가 낮아서 안 했다"가 사고 보고서에 남는다:

> Security violation · Data integrity risk · Critical incident · SLO/Guardrail breach ·
> Required migration · Release blocker · Regulatory / Mandatory requirement

이런 작업은 **severity · 위험 · 기한 · 의존성 · 저장소 정책**으로 먼저 판정한다.

RICE/ICE 는 **비교 가능한 discretionary Initiative 후보끼리** 순서를 정할 때 쓴다. 그때도
점수는 **의사결정의 입력이지 자동 결정 기준이 아니다** — 뒤집을 때는 이유를 남긴다.

---

# RUN — 운영하는 동안 지켜지는 것

이 스킬은 **RUN 의 존재와 경계만 정의한다.** SLO 체계·인시던트 절차·런북의 설계는 여기서
하지 않고, 저장소의 운영 SSOT 가 소유한다. 북극성 문서는 그것을 **가리킨다.**

- **SLO / Guardrail** — 운영하는 동안 계속 지켜야 하는 조건. 달성이 아니라 유지다.
  Finite 로 적혀 있으면 잘못 분류된 것이다.
- **Operational Health** — 그 조건이 지금 지켜지고 있는지의 현재 상태.
- **Operational Work** — 유지를 위한 반복적·사건 기반 업무. Initiative 가 아니다.

운영에서 **같은 문제가 반복**되면 그때가 Enabler Initiative 를 만들 시점이다 — 반복 업무를
없애는 구조 변경에 Finish Line 을 붙여 유한한 작업으로 만든다.

---

## Output Template

`docs/NORTH_STAR.md`에 저장. 본 skill 디렉토리의 `NORTH_STAR.template.md`를 복사해 채운다.

북극성 문서는 **DIRECTION 의 SSOT** 다. 7 섹션:

1. Product North Star
2. North Star Metric (Definition + Current Target)
3. Inputs
4. Strategic Pillars (+ 모듈 ↔ 축 매핑)
5. Strategic Boundaries (Will / Won't / Trade-offs)
6. Alignment Rules (게이트 · Work Type · lifecycle 판정)
7. Review & Versioning

**북극성 문서가 소유하지 않는 것** — 필요하면 해당 SSOT 를 가리킨다:

| 소유하지 않는 것 | 어디가 소유하나 |
|---|---|
| Initiative Finish Line · Initiative KPI · Release 완료 조건 · Feature checklist | 계획 문서 (`docs/plans/` 등) |
| Now / Next / Later 상세 backlog | 로드맵 SSOT |
| 상세 SLO · Runbook · Incident procedure | 저장소의 운영 SSOT |
| 갱신 이력 | 버전 관리 이력 |

시간축을 이 문서에 끌어들이는 순간 방향 문서와 일정 문서가 서로를 덮어쓴다.

## Roadmap Workflow — 방향에서 백로그로

방향이 정해진 뒤 "그래서 다음에 뭘 하나"를 답하는 6단계. 각 단계의 근거 방법론과 계산 예시는
[references/roadmap-method.md](references/roadmap-method.md).

1. **READ** — 북극성 문서를 읽고 **NSM 1개 + 직접 움직일 수 있는 Inputs 3–5개**로 다시
   진술한다. 문서에 이미 있으면 그대로 들어 올리고, 산문 비전만 있으면 후보를 만들어
   확인받는다. 그 지표가 leading 인지, 가치 없이도 움직일 수 있는지를 먼저 점검한다.
2. **CLASSIFY** — 손에 든 항목마다 두 축을 먼저 정한다: **Work Type**(Product / Enabler /
   Operational)과 **lifecycle**(Finite → Finish Line / Persistent → NSM·Input·SLO·Guardrail).
   이 단계를 건너뛰면 뒤의 모든 단계가 잘못된 Pool 에서 돌아간다.
3. **ASSESS** — Input 별로 "지금 어디 / 목표 어디"를 실제 증거(기존 계획·감사 산출물·지표·
   코드 상태)로 적는다. 산출물은 **갭**이다. 측정되지 않은 Input 도 갭으로 센다.
4. **PROPOSE** — 가장 큰 갭을 닫는 **방향**을 한두 문장으로 먼저 명명한다. 각 제안마다
   ⓐ 한 줄 mini-PR(출시 후 누가 무슨 가치를 받는가) ⓑ 그것을 실현하는 구체 기능
   ⓒ **부모** — 어느 Input·Pillar·Guardrail·Exit Criterion 을 지지하는가. **부모가 없으면
   잘라낸다.** 부모가 NSM Input 하나로 제한되지 않는다는 것이 Enabler 를 살리는 지점이다.
5. **PRIORITIZE** — 먼저 **mandatory · incident · guardrail breach** 를 골라낸다(위 규칙).
   남은 discretionary 후보끼리 RICE `(Reach × Impact × Confidence) / Effort` 로 점수를
   매긴다(데이터가 얇으면 ICE). 숫자를 적어 순위를 감사 가능하게 만든 뒤 판단을 얹는다 —
   의존성·전략적 table-stakes·북극성 적합도가 점수를 뒤집을 수 있고, 뒤집을 때는 **이유를
   남긴다.**
6. **PERSIST** — 결과를 **Now / Next / Later** 로 묶어 지속되는 산출물에 쓴다: 기존 로드맵
   SSOT 를 제자리에서 갱신하고(날짜 약속이 아니라 성과 테마로), 세션 시작 시 다시 읽히는
   앵커 한 줄을 메모리에 남기고, 진짜 아키텍처 결정이 있었으면 ADR 로 기록한다.
   로드맵이 둘이 되면 반드시 갈라진다 — 새 날짜 문서를 만들지 말고 살아 있는 문서를 고친다.

그리고 보고한다: 방향 · 순위 표 · 기록한 파일 경로. **living document** 로 표시한다 —
지표도 우선순위도 전략이 바뀌면 개정될 것을 전제한다.

## Integration with Workflow

- **신규 프로젝트 시작 시**: 북극성 문서 존재 확인. 없으면 본 skill 호출 권유.
- **신규 task 진입 전**: Work Type 분류 → Initiative 면 4-gate 체크. 1개 이상 게이트 fail 시
  사용자에게 보고 후 결정 대기. Operational Work 는 게이트 대상이 아니다.
- **자동 hook 없음** — 의식적 결정을 강제하지 않음. 게이트는 가이드 도구.

## Anti-Patterns

lifecycle 을 섞어서 생기는 것들:

- **Initiative-as-NSM** — 일회성 완료 목표를 NSM 으로 정의. 달성하는 순간 북극성이 사라진다.
- **Temporary North Star** — Current Target 에 도달했다는 이유로 NSM Definition 을 교체.
  할 일은 다음 Target 을 정하는 것이지 재는 대상을 바꾸는 것이 아니다.
- **Enabler-forced-into-NSM** — Security/Reliability/Observability/Migration 을 억지로 사용자
  지표에 연결. 연결이 안 되면 그 Enabler 가 조용히 탈락한다.
- **Operation-as-Enabler-Initiative** — 반복 운영 업무를 전부 Initiative 로 만들어 끝나지 않는
  Finish Line 을 양산.
- **Permanent Finish Line** — 완료된 Initiative 의 완료 조건을 지속 KPI 로 유지.
- **SLO-vs-Feature RICE** — mandatory/guardrail/incident 를 optional feature 와 같은 점수
  Pool 에서 경쟁.
- **Feature Sequence Everywhere** — `Foundation → E2E Completeness → Differentiation` 을
  운영 중인 backlog 전체의 절대 규칙으로 사용.

방향 자체가 부실해서 생기는 것들:

- **NSM이 vanity metric** ("downloads", "stars") — 사용자 행동 측정 X
- **측정 불가 목표를 프록시 선언 없이 방치** — "좋은 제품"류 목표만 있고 최적화 대상이 없음
- **프록시가 양(量)만 측정** — 사후 품질 짝 없이는 굿하트 법칙으로 지표 자체가 게임됨
- **축에 매핑되지 않는 모듈 방치** — 매핑 실패는 scope creep 의 조기 신호인데 무시
- **Won't가 비어있음** — scope creep 방어선 부재
- **게이트 검증 없이 "유용해 보이니까" 추가** — 의사결정 원칙 위반
- **북극성 문서를 작성만 하고 한 번도 참조 안 함** — 죽은 문서. 분기 리뷰로 살림

로드맵 단계 고유의 실패 6종(허수/후행/게임 가능한 지표 · RICE 허위정밀도 · 점수 자동추종 ·
날짜형 로드맵 · bottom-up 아이디어 덤프 · 미영속화)은
[references/roadmap-method.md](references/roadmap-method.md) 의 Pitfalls 절이 소유한다.

## References (progressive disclosure)

- [references/roadmap-method.md](references/roadmap-method.md) — 로드맵 6단계의 근거
  방법론(출처 URL 포함) · CLASSIFY 와 부모 계보 예시 · RICE 워크드 계산 예제와 override 로그 ·
  Pitfalls 6종 · 자매 스킬과의 역할 분담.

## Examples

참고 사례 (도메인 종속 — 실운영 프로젝트 2종):

- 프로젝트 A (목표 추적 SaaS): NSM = WAGI (Weekly AI-Initiated Goal Items), Current Target
  ≥ 40% · Won't: 팀 협업 도구 / 모바일 우선 / 게이미피케이션 / 외부 통합 폭발 / CRDT ·
  4-gate: Trend × Value × MCP × Lean · sequencing heuristic 을 신규 기능 Initiative 에 한정 적용.
- 프로젝트 B (투자 분석 서비스): 진짜 목표(사용자 투자 수익)가 외부·지연이라 직접 측정 불가 →
  **프록시 선언** "추적되는 근거 기반 의사결정 수(양) + 사후 성과 양(+) 비율(품질)" ·
  5 Pillars(각 정의/현재 위치/전방 목표/가설) + 전 모듈 ↔ 축 매핑 표 · 스키마 마이그레이션은
  Enabler Initiative 로, 부모는 Pillar capability 로 기록(사용자 지표에 억지로 붙이지 않음).

본 skill은 그 패턴들을 도메인 비종속으로 일반화한 것.

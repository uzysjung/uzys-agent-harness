# [Project Name] — North Star

> **지속되는 방향의 SSOT.** PRD/SPEC이 "무엇을 어떻게"를 다루면, 본 문서는 **왜·어디로**를
> 다룬다. 의사결정이 모호할 때 본 문서를 기준으로 우선순위를 판정한다.
>
> 여기 적는 것은 **서비스가 존재하는 동안 계속 추구하는 것**뿐이다. 끝나는 것(Initiative의
> 완료 조건)과 유지하는 것(운영 SLO/Guardrail의 상세)은 §8 이 가리키는 문서가 소유한다.

---

## 1. Product North Star

> **"[한 문장: 5년 뒤 이 프로젝트가 무엇이 되어 있어야 하는가. 도메인 명사 + 사용자 + 측정 가능한 결과]"**

[2-3 문장: 단순 X를 넘어, 어떤 시스템/사이클을 지향하는가.]

---

## 2. North Star Metric (NSM)

> [진짜 목표가 직접 측정 불가하면 여기서 프록시를 선언: "진짜 목표 X 는 (외부적/지연이라)
> 직접 측정 불가하므로, Y(양) + Z(사후 품질)를 프록시로 최적화한다. 근거: …"]

### 2.1 Definition — 무엇을 어떻게 재는가

**[지표 약어 — 풀네임]**
- 정의: [어떻게 계산하는가]
- 의미: [이 지표가 올라가면 무엇이 증명되는가. 내려가면 무엇이 부족함을 시사하는가]
- 측정 환경: [single-user / team / public 등]에서 자가 수집.

> Definition 변경은 **Major CR** 이다 — "이제 다른 것을 재기로 했다"는 방향 변경이다.

### 2.2 Current Target — 지금 겨냥하는 수치

| Target | 시점 | 현재 값 | 근거 |
|---|---|---|---|
| [수치] | [YYYY-Qn] | [측정값 또는 "미측정"] | [왜 이 수치인가] |

> **Target 에 도달했다고 Definition 을 바꾸지 않는다.** 그때 하는 일은 다음 Target 을
> 정하는 것이다. Target 갱신은 Clarification 이다.

> 결정 기준: Leading(원인) 우선 · 단일 행동만 측정(composite 금지) · Target 명시 ·
> 가치 없이 직접 올릴 수 있는(게임 가능한) 지표는 기각 ·
> **달성하면 추적을 그만두게 되는 목표는 NSM 이 아니라 Initiative 의 Finish Line 이다.**

---

## 3. Inputs — 직접 움직일 수 있는 레버 (3–5개)

NSM 은 결과이고 Inputs 는 원인이다. **계획은 여기에 붙는다.**

| Input | 정의 | 현재 | 목표 방향 | NSM 을 움직인다고 믿는 이유 |
|---|---|---|---|---|
| [Input A] | [어떻게 재는가] | [값 또는 "미측정"] | [↑ / ↓ / 유지] | [1줄] |
| [Input B] | | | | |
| [Input C] | | | | |

> 측정되지 않는 Input 은 **"미측정"이라고 적는다** — 빈칸은 "없음"과 구분되지 않는다.
> 미측정 자체가 갭이다.

---

## 4. Strategic Pillars (전략 축)

각 축은 North Star 로 가는 단계이며, 모든 모듈은 최소 1개 축에 속한다.

### Pillar 1 — [이름]
- **정의**: [이 축이 사용자에게 주는 것 1문장]
- **현재 위치**: [이 축에 속한 기존 모듈/기능]
- **전방 목표**: [다음에 쌓을 것]
- **가설**: [이 축이 NSM 을 올린다고 믿는 이유 1줄]

### Pillar 2 — [이름]
- **정의** / **현재 위치** / **전방 목표** / **가설**: [동일 4요소]

### Pillar 3 — [이름]
- **정의** / **현재 위치** / **전방 목표** / **가설**: [동일 4요소]

### 모듈 ↔ 축 매핑

| 모듈 | 주 축 | 비고 |
|---|---|---|
| [모듈 A] | P1 | |
| [모듈 B] | P2 / P3 | [복수 축이면 병기] |
| [공통 인프라 — 인증·관리 등] | 공통 | 축을 가로지르는 플랫폼 |

> 어떤 신규 모듈이 위 축 어디에도 매핑되지 않으면, **착수 전에 북극성 정렬을 재검토**한다.

---

## 5. Strategic Boundaries (방향성 경계)

### 5.1 Will (집중)

- **[집중 영역 1]**: [짧은 설명]
- **[집중 영역 2]**: [짧은 설명]
- **[집중 영역 3]**: [짧은 설명]
- **[집중 영역 4]**: [짧은 설명]

### 5.2 Won't (의도적 비-방향)

scope creep의 1차 방어선. "X는 안 한다"를 **5-8개** 명시.

- **[안 하는 것 1]**: [왜 안 하는지 한 문장]
- **[안 하는 것 2]**: [근거]
- **[안 하는 것 3]**: [근거]
- **[안 하는 것 4]**: [근거]
- **[안 하는 것 5]**: [근거]

### 5.3 Trade-offs (의식적 선택)

| 선택 | 포기한 것 | 근거 |
|------|----------|------|
| [선택 A] | [반대편 옵션] | [왜 이 쪽인가] |
| [선택 B] | [반대편 옵션] | [근거] |
| [선택 C] | [반대편 옵션] | [근거] |

---

## 6. Alignment Rules

### 6.1 Lifecycle 판정 — 목표·지표를 정의할 때 가장 먼저

> **달성하면 더 이상 추적할 필요가 없는가?**

| 답 | 분류 | 어디에 사는가 |
|---|---|---|
| YES | **Finite** | Initiative 의 Finish Line / Exit Criterion — **이 문서 밖** |
| NO | **Persistent** | NSM · Input(이 문서) 또는 SLO · Guardrail(운영 SSOT) |

### 6.2 Work Type

| Work Type | 의미 | 게이트 | 순위 |
|---|---|---|---|
| **Product Initiative** | 사용자 가치·경험을 바꾸는 유한한 작업 | 6.3 전부 | RICE/ICE + 판단 |
| **Enabler Initiative** | 기술·운영 capability 를 바꾸는 유한한 작업 | 6.3 (Value 는 간접 경로) | RICE/ICE + 판단 |
| **Operational Work** | 서비스 유지를 위한 반복적·사건 기반 업무 | 기계적 적용 안 함 | severity·위험·기한 |

### 6.3 4-Gate — "할 것인가"

신규 Initiative 는 4 게이트를 **모두** 통과해야 우선순위 진입.

| Gate | 질문 | Pass 기준 |
|------|------|---------------|
| **1. Trend** | 본 프로젝트의 핵심 트렌드/원칙 1개 이상에 매핑되는가? | 매핑 명시 |
| **2. Value** | 사용자 가치에 닿는 경로가 있는가? | **직접** — Primary persona([이름])에게 직접 가치. Anti-persona 위주면 거절 <br> **간접** — 막아 주는 Guardrail/SLO 또는 가능하게 하는 Initiative·Pillar capability 를 **이름으로** 지목 |
| **3. Capability** | [도메인 특수 능력 — 예: MCP 노출 / API 제공]이 동등하게 가능한가? | YES (UI-only면 -1) |
| **4. Lean** | §5.1 Will 범위 내인가? 외부면 Open Question 으로 적재 | YES |

> Security · Reliability · Observability · Migration 은 게이트 2 의 **간접** 경로로 통과한다.
> NSM 을 직접 움직이지 않아도 정당하다 — 다만 무엇을 위해서인지 이름을 못 대면 탈락이다.

### 6.4 순위에서 제외되는 작업

다음은 optional feature 와 RICE/ICE 로 경쟁시키지 않는다. severity·위험·기한·의존성·
저장소 정책으로 먼저 판정한다.

> Security violation · Data integrity risk · Critical incident · SLO/Guardrail breach ·
> Required migration · Release blocker · Regulatory / Mandatory requirement

### 6.5 Initiative Sequencing Heuristic

**적용 범위: 신규 구축 · 신규 Feature Initiative · 아직 Finish Line 을 통과하지 못한 기능.**
운영 중인 backlog 전체의 절대 규칙이 아니다.

1. **Foundation** — 없으면 제품이 성립 안 되는 기본기.
2. **End-to-End Completeness** — shipped 기능이 사용자 관점 end-to-end 완결인가. 존재 ≠ 완결.
3. **Differentiation** — 핵심 경쟁력의 advanced 구현. research/ADR 선행 필수.

### 6.6 Initiative 완료 시 전환

1. Finish Line 은 **종료**한다 — 지속 KPI 로 남기지 않는다.
2. Initiative Metric 은 **자동으로** Persistent Metric 이 되지 않는다. 승격은 결정이다.
3. 계속 유지해야 하는 성질만 명시적으로 넘긴다 — 사용자 가치의 지속 개선이면 §2/§3 으로,
   운영 중 지켜야 하는 조건이면 운영 SSOT 의 SLO/Guardrail 로. 이유를 한 줄 남긴다.
4. 넘길 것이 없으면 아무것도 안 남기고 닫는다.

---

## 7. Review & Versioning

- 본 문서는 **분기 1회** 또는 **NSM Current Target 도달/미달** 시 갱신.
- **Major CR**: NSM Definition 변경 / Pillar 변경 / Won't 변경.
- **Clarification**: Current Target 갱신, Trade-off 추가, 매핑 보강.
- 갱신 사유는 커밋 메시지에 남긴다 — 본문에 이력을 쌓지 않는다.
- 본 문서가 바뀌면 그 아래 계획·로드맵 문서는 자동으로 최신이 아니다. 같은 갱신 단위에서
  재검토 대상으로 표시한다.

---

## 8. 이 문서가 소유하지 않는 것

| 소유하지 않는 것 | 어디가 소유하나 |
|---|---|
| Initiative Finish Line · Initiative KPI · Release 완료 조건 · Feature checklist | [계획 문서 경로 — 예: `docs/plans/`] |
| Now / Next / Later 상세 backlog | [로드맵 SSOT 경로] |
| 상세 SLO · Runbook · Incident procedure | [운영 SSOT 경로] |
| 갱신 이력 | 버전 관리 이력 |

> 방향은 여기가 소유하고, 실행 계획과 운영 기준의 상세는 중복해서 소유하지 않는다.
> 시간축을 이 문서에 끌어들이는 순간 방향 문서와 일정 문서가 서로를 덮어쓴다.

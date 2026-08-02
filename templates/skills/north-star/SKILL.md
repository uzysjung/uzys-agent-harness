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

## When to Invoke

| 트리거 | 행동 |
|--------|------|
| 신규 프로젝트 시작 | 북극성 문서 부재 시 작성 제안 |
| Major CR / scope 확대 의심 | 4-gate 통과 여부 점검 |
| 분기 1회 정기 리뷰 | NSM 변경, Pillar 변경, Won't 변경 검토 |
| 신규 기능 요청 진입 시 | 4-gate 통과 시만 우선순위 진입 |
| "앞으로 어디로 가야 하나" | 아래 로드맵 워크플로 (방향 → 순위 → 영속화) |

Do **not** reach for it to find what's broken right now. Detecting defects, gaps,
or quality regressions is the sibling audit skills' job; this skill consumes their
findings and points forward.

## Process — 방향을 정한다

### 1. North Star Statement 작성

한 문장으로 프로젝트의 종착점을 표현. 5년 뒤 이 프로젝트가 무엇이 되어 있어야 하는가.

**좋은 예**: 도메인 명사 + 사용자 + 측정 가능한 결과.
**나쁜 예**: "최고의 X" / "사용자 만족" — 측정 불가.

### 2. North Star Metric (NSM) 정의 — metric-as-proxy

1차 지표 1개 + 2차 보조 지표 2-4개. 모두 단일 사용자 환경에서 자가 수집 가능해야 한다.

**진짜 목표가 직접 측정 불가하면 프록시를 선언한다.** 많은 프로젝트의 실제 목표(사용자의
투자 수익, 팀의 생산성, 학습 성과 등)는 외부적이거나 지연되어 직접 측정할 수 없다. 그때
"측정 불가"로 방치하지 말고:

1. **프록시 지표를 명시적으로 선언** — "진짜 목표 X 는 직접 측정 불가하므로 Y 를 프록시로
   최적화한다"를 문서에 그대로 적는다. 왜 이 프록시인지 1줄 근거 필수.
2. **양(1차) + 사후 품질(2차) 짝** — 프록시는 행동의 양(추적되는 의사결정 수 등)과 그 행동의
   사후 품질(성과 추적이 양(+)인 비율 등)을 짝으로 잡는다. 양만 재면 굿하트 법칙으로 프록시
   자체가 게임된다.
3. **기능 평가 기준으로 사용** — "이 기능이 프록시 지표 둘 중 하나를 올리는가?" NO 면 북극성
   이탈 신호.

NSM 결정 기준:

- **Lagging (결과) vs Leading (원인) — Leading 권장.** 이미 끝난 결과로는 조타할 수 없다.
- **단일 행동만 측정 (composite 금지).**
- **목표값 명시** ("≥ 40% by 2026").
- **게임 가능성 점검** — 가치를 전달하지 않고도 직접 올릴 수 있으면 북극성이 아니다.
  그런 지표를 발견하면 조용히 그것을 향해 계획하지 말고 먼저 그 사실을 알린다.

### 3. Pillars (전략 축) + 모듈 ↔ 축 매핑

North Star 로 가는 길을 3-5개 **전략 축**으로 분해한다. 각 축은 4요소로 정의:

- **정의** — 이 축이 사용자에게 주는 것 1문장.
- **현재 위치** — 이 축에 속한 기존 모듈/기능.
- **전방 목표** — 다음에 쌓을 것.
- **가설** — 이 축이 NSM 을 올린다고 믿는 이유 1줄.

그리고 **모듈 ↔ 축 매핑 표**를 유지한다: 모든 모듈은 최소 1개 축에 속한다 (플랫폼 공통
인프라는 "공통"으로 명시). **어떤 신규 모듈이 어느 축에도 매핑되지 않으면 착수 전에 북극성
정렬을 재검토한다** — 매핑 실패 = scope creep 의 조기 신호. 로드맵 항목도 정기 리뷰 때 축에
매핑해 "새 축·방향 변경이 필요한가"를 점검한다.

축은 아래 로드맵 워크플로가 말하는 *Inputs* 와 같은 것이다 — 북극성이 목적지라면 축은 직접
움직일 수 있는 레버다. 두 이름은 같은 분해를 가리킨다.

### 4. Will / Won't / Trade-offs

- **Will**: 집중 영역 4-6개. 동사로 시작 ("개인 사용 깊이 우선", "AI 친화 1급 시민").
- **Won't**: 의도적 비-방향 **5-8개**. "X는 안 한다" 명시. 가장 중요한 섹션 — scope creep의
  1차 방어선. 비어 있으면 이 문서는 아무것도 막지 못한다.
- **Trade-offs**: "**선택 → 포기한 것 → 근거**" 3열 표. 의식적 결정의 추적 기록이며, 같은
  논쟁을 반년 뒤에 처음부터 다시 하지 않게 하는 유일한 장치다.

### 5. 4-Gate Decision Heuristic — "할 것인가"

신규 요청·제안이 들어왔을 때 다음 4개 게이트를 **모두** 통과해야 우선순위 진입:

| Gate | 질문 | 통과 기준 |
|------|------|----------|
| **Trend** | 프로젝트의 핵심 트렌드/원칙 중 1개 이상에 매핑되는가? | YES |
| **Persona** | Primary persona에게 직접 가치를 주는가? Anti-persona 위주는 거절 | YES |
| **Capability** | 현재 시스템이 이 기능을 동등하게 노출 가능한가? (UI 한정 기능은 -1) | YES |
| **Lean** | 선언된 Will 범위 내에 있는가? 외부면 Open Question으로 적재 후 분기 1회 재평가 | YES |

게이트 명칭은 프로젝트마다 customize 가능하나 **4개 ALL True** 원칙은 유지.

### 6. 우선순위 순서 게이트 — "언제 할 것인가"

(검증 체크포인트 유형 분류와 무관 — 이것은 작업 **순서** 규칙이다.)
4-gate 는 "할 것인가"를 거른다. 통과한 것들 사이의 **순서**는 별도 규칙이다 — 무엇을 먼저
할지 모호하면 이 순서로 판정한다:

1. **기본 필수 기능** — 없으면 제품이 성립 안 되는 기본기 (예: 표준 로그인). "기본"이 빠진 채
   화려함부터 쌓지 않는다.
2. **기능 완성도** — 이미 shipped 된 기능이 사용자 관점 end-to-end 로 진짜 완결인가.
   **단순 존재 ≠ 완결** (버튼이 동작하나, 링크가 목적지까지 가나, 빈/에러 상태가 처리되나).
   UI 트랙이면 벤치마크 동등성 검토 루프와 동일 기준.
3. **차별화 깊이** — 핵심 경쟁력의 advanced 구현. **research/ADR 선행 필수** — advanced 부터
   코드로 뛰어들지 않는다.

**상위 순위에 미완이 있으면 하위로 건너뛰지 않는다** (긴급 hotfix·사용자 명시 지시 예외).
Plan/Define 단계에서 "이 작업이 ①/②/③ 중 어디이고, 앞 순위가 남아있지 않나"를 먼저 점검.

### 7. Versioning

- 분기 1회 또는 NSM 도달/미달 시 갱신.
- 주요 갱신: NSM 변경 / Pillar 변경 / Won't 변경 → **Major CR** 분류.
- 가벼운 갱신: Trade-off 추가, 트렌드 매핑 보강 → **Clarification**.
- 갱신 사유는 커밋 메시지에 남긴다 — 문서 본문에 이력을 쌓지 않는다.
- 북극성이 바뀌면 그 아래 로드맵·계획 문서는 자동으로 최신이 아니다. 같은 갱신 단위에서
  재검토 대상으로 표시한다.

## Output Template

`docs/NORTH_STAR.md`에 저장. 본 skill 디렉토리의 `NORTH_STAR.template.md`를 복사해 채운다.

6 섹션 (번호는 템플릿에 맞춘다 — **§5 로드맵과 §8 이력은 비워 둔 자리다. 시간축은
TODO/로드맵 문서가, 이력은 버전 관리 이력이 소유한다**):

1. North Star Statement (1문장)
2. North Star Metric (1차 + 2차, metric-as-proxy 선언)
3. Pillars (전략 축) + 모듈 ↔ 축 매핑
4. Strategic Boundaries (Will / Won't / Trade-offs)
6. Decision Heuristics (4-gate + 우선순위 순서)
7. Versioning & Review

시간축을 이 문서에 끌어들이는 순간 방향 문서와 일정 문서가 서로를 덮어쓴다. 로드맵은 아래
워크플로가 **별도 문서**로 만든다.

## Roadmap Workflow — 방향에서 백로그로

방향이 정해진 뒤 "그래서 다음에 뭘 하나"를 답하는 5단계. 각 단계의 근거 방법론과 계산 예시는
[references/roadmap-method.md](references/roadmap-method.md).

1. **READ** — 북극성 문서를 읽고 **NSM 1개 + 직접 움직일 수 있는 Inputs 3–5개**로 다시
   진술한다. 문서에 이미 있으면 그대로 들어 올리고, 산문 비전만 있으면 후보를 만들어
   확인받는다. 그 지표가 leading 인지, 가치 없이도 움직일 수 있는지를 먼저 점검한다.
2. **ASSESS** — Input 별로 "지금 어디 / 목표 어디"를 실제 증거(기존 계획·감사 산출물·지표·
   코드 상태)로 적는다. 산출물은 **갭**이다. 측정되지 않은 Input 도 갭으로 센다.
3. **PROPOSE** — 가장 큰 갭을 닫는 **방향**을 한두 문장으로 먼저 명명한다. 각 제안마다
   ⓐ 한 줄 mini-PR(출시 후 누가 무슨 가치를 받는가) ⓑ 그것을 실현하는 구체 기능
   ⓒ **부모** — 어느 Input/축을 지지하는가. **부모가 없으면 잘라낸다.** bottom-up 기능
   난립을 막는 정렬 게이트가 이 줄이다.
4. **PRIORITIZE** — RICE `(Reach × Impact × Confidence) / Effort` 로 점수를 매긴다(데이터가
   얇으면 ICE). 숫자를 적어 순위를 감사 가능하게 만든 뒤 판단을 얹는다 — 의존성·전략적
   table-stakes·북극성 적합도가 점수를 뒤집을 수 있고, 뒤집을 때는 **이유를 남긴다.**
   점수는 결정의 입력이지 자동조종이 아니다.
5. **PERSIST** — 결과를 **Now / Next / Later** 로 묶어 지속되는 산출물에 쓴다: 기존 로드맵
   SSOT 를 제자리에서 갱신하고(날짜 약속이 아니라 성과 테마로), 세션 시작 시 다시 읽히는
   앵커 한 줄을 메모리에 남기고, 진짜 아키텍처 결정이 있었으면 ADR 로 기록한다.
   로드맵이 둘이 되면 반드시 갈라진다 — 새 날짜 문서를 만들지 말고 살아 있는 문서를 고친다.

그리고 보고한다: 방향 · 순위 표 · 기록한 파일 경로. **living document** 로 표시한다 —
지표도 우선순위도 전략이 바뀌면 개정될 것을 전제한다.

## Integration with Workflow

- **신규 프로젝트 시작 시**: 북극성 문서 존재 확인. 없으면 본 skill 호출 권유.
- **신규 task 진입 전**: 4-gate 체크. 1개 이상 게이트 fail 시 사용자에게 보고 후 결정 대기.
- **자동 hook 없음** — 의식적 결정을 강제하지 않음. 게이트는 가이드 도구.

## Anti-Patterns

- **NSM이 vanity metric** ("downloads", "stars") — 사용자 행동 측정 X
- **측정 불가 목표를 프록시 선언 없이 방치** — "좋은 제품"류 목표만 있고 최적화 대상이 없음
- **프록시가 양(量)만 측정** — 사후 품질 짝 없이는 굿하트 법칙으로 지표 자체가 게임됨
- **축에 매핑되지 않는 모듈 방치** — 매핑 실패는 scope creep 의 조기 신호인데 무시
- **기본 미완인데 advanced 착수** — 우선순위 순서 게이트 위반 (기본→완성도→차별화)
- **Won't가 비어있음** — scope creep 방어선 부재
- **4-gate 검증 없이 "유용해 보이니까" 추가** — 의사결정 원칙 위반
- **북극성 문서를 작성만 하고 한 번도 참조 안 함** — 죽은 문서. 분기 리뷰로 살림

로드맵 단계 고유의 실패 6종(허수/후행/게임 가능한 지표 · RICE 허위정밀도 · 점수 자동추종 ·
날짜형 로드맵 · bottom-up 아이디어 덤프 · 미영속화)은
[references/roadmap-method.md](references/roadmap-method.md) 의 Pitfalls 절이 소유한다.

## References (progressive disclosure)

- [references/roadmap-method.md](references/roadmap-method.md) — 로드맵 5단계의 근거
  방법론(출처 URL 포함) · RICE 워크드 계산 예제와 override 로그 · Pitfalls 6종 ·
  자매 스킬과의 역할 분담.

## Examples

참고 사례 (도메인 종속 — 실운영 프로젝트 2종):

- 프로젝트 A (목표 추적 SaaS): NSM = WAGI (Weekly AI-Initiated Goal Items) ≥ 40% ·
  Won't: 팀 협업 도구 / 모바일 우선 / 게이미피케이션 / 외부 통합 폭발 / CRDT ·
  4-gate: Trend × Persona × MCP × Lean · 우선순위 순서(기본→완성도→차별화) 실운영.
- 프로젝트 B (투자 분석 서비스): 진짜 목표(사용자 투자 수익)가 외부·지연이라 직접 측정 불가 →
  **프록시 선언** "추적되는 근거 기반 의사결정 수(양) + 사후 성과 양(+) 비율(품질)" ·
  5 Pillars(각 정의/현재 위치/전방 목표/가설) + 전 모듈 ↔ 축 매핑 표 · 로드맵 항목의 축 매핑
  정기 점검("새 축 불필요" 판정 기록).

본 skill은 그 패턴들을 도메인 비종속으로 일반화한 것.

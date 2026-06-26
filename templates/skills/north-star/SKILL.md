---
name: north-star
description: "Defines and enforces a project's long-term direction (North Star Statement, NSM, Will/Won't, 4-gate decision heuristic). Use when starting a new project, when scope creep is suspected, or when a non-obvious feature request needs prioritization. Sits one layer above SPEC/PRD — answers 'why and where to', not 'what and how'."
---

# North Star

## Purpose

SPEC/PRD가 "무엇을 어떻게"를 다루면, North Star는 **왜·어디로**를 다룬다.
- 의사결정이 모호할 때 우선순위 판정의 SSOT.
- 신규 요청·기능이 "범위 안인가?"를 검증 가능한 기준으로 거른다.
- Won't (의도적 비-방향)을 명시해 scope creep을 사전 차단.

CLAUDE.md의 P1(가정 금지) / P2(Simplicity First) / Decision Making 메타원칙의 **프로젝트 단위 인스턴스**.

## When to Invoke

| 트리거 | 행동 |
|--------|------|
| 신규 프로젝트 시작 | `docs/NORTH_STAR.md` 부재 시 작성 제안 |
| Major CR / scope 확대 의심 | 4-gate 통과 여부 점검 |
| 분기 1회 정기 리뷰 | NSM 변경, Phase 정의 변경, Won't 변경 검토 |
| 신규 기능 요청 진입 시 | 4-gate 통과 시만 우선순위 진입 |

## Process

### 1. North Star Statement 작성

한 문장으로 프로젝트의 종착점을 표현. 5년 뒤 이 프로젝트가 무엇이 되어 있어야 하는가.

**좋은 예**: 도메인 명사 + 사용자 + 측정 가능한 결과.
**나쁜 예**: "최고의 X" / "사용자 만족" — 측정 불가.

### 2. North Star Metric (NSM) 정의

1차 지표 1개 + 2차 보조 지표 2-4개. 모두 단일 사용자 환경에서 자가 수집 가능해야 한다.

NSM 결정 기준:
- Lagging (결과) vs Leading (원인) — Leading 권장
- 단일 행동만 측정 (composite 금지)
- 목표값 명시 ("≥ 40% by 2026")

### 3. Will / Won't / Trade-offs

- **Will**: 집중 영역 4-6개. 동사로 시작 ("개인 사용 깊이 우선", "AI 친화 1급 시민").
- **Won't**: 의도적 비-방향 5-8개. "X는 안 한다" 명시. 가장 중요한 섹션 — scope creep의 1차 방어선.
- **Trade-offs**: "X 선택 → Y 포기 → 근거" 표. 의식적 결정의 추적 기록.

### 4. 4-Gate Decision Heuristic

신규 요청·제안이 들어왔을 때 다음 4개 게이트를 **모두** 통과해야 우선순위 진입:

| Gate | 질문 | 통과 기준 |
|------|------|----------|
| **Trend** | 프로젝트의 핵심 트렌드/원칙 중 1개 이상에 매핑되는가? | YES |
| **Persona** | Primary persona에게 직접 가치를 주는가? Anti-persona 위주는 거절 | YES |
| **Capability** | 현재 시스템이 이 기능을 동등하게 노출 가능한가? (UI 한정 기능은 -1) | YES |
| **Lean** | 정의된 Phase 범위 내에 있는가? 외부면 Open Question으로 적재 후 분기 1회 재평가 | YES |

게이트 명칭은 프로젝트마다 customize 가능하나 **4개 ALL True** 원칙은 유지.

### 5. Versioning

- 분기 1회 또는 NSM 도달/미달 시 갱신.
- 주요 갱신: NSM 변경 / Phase 정의 변경 / Won't 변경 → Major CR 분류.
- 가벼운 갱신: Trade-off 추가, 트렌드 매핑 보강 → Clarification.
- 갱신 시 Changelog 1줄 (날짜 + 사유).

## Output Template

`docs/NORTH_STAR.md`에 다음 구조로 저장. 본 skill 디렉토리의 `NORTH_STAR.template.md`를 복사해 채운다.

7 섹션:
1. North Star Statement (1문장)
2. North Star Metric (1차 + 2차)
3. Strategic Boundaries (Will / Won't / Trade-offs)
4. Phase Roadmap (장기 진화 단계)
5. Decision Heuristics (4-gate)
6. Versioning & Review
7. Changelog

## Integration with Workflow

- **신규 프로젝트 시작 시**: `docs/NORTH_STAR.md` 존재 확인. 없으면 본 skill 호출 권유.
- **신규 task 진입 전**: 4-gate 체크. 1개 이상 게이트 fail 시 사용자에게 보고 후 결정 대기.
- **자동 hook 없음** — 의식적 결정을 강제하지 않음. 게이트는 가이드 도구.

## Anti-Patterns

- **NSM이 vanity metric** ("downloads", "stars") — 사용자 행동 측정 X
- **Won't가 비어있음** — scope creep 방어선 부재
- **4-gate 검증 없이 "유용해 보이니까" 추가** — Decision Making 메타원칙 위반
- **NORTH_STAR.md를 작성만 하고 한 번도 참조 안 함** — 죽은 문서. 분기 리뷰로 살림

## Examples

GoalTrack 프로젝트의 NORTH_STAR.md (참고 사례, 도메인 종속):
- NSM: WAGI (Weekly AI-Initiated Goal Items) ≥ 40%
- Won't: 팀 협업 도구 / 모바일 우선 / 게이미피케이션 / 외부 통합 폭발 / CRDT
- 4-gate: Trend × Persona × MCP × Lean

본 skill은 그 패턴을 도메인 비종속으로 일반화한 것.

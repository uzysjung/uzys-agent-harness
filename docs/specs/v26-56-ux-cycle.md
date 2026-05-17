# SPEC: v26.56.0 — UX cycle (clarity + Codex Prompts uzys 묶음)

> **Status**: Draft (2026-05-17)
> **Predecessor**: v26.55.1 (skills cli multi-agent fix)
> **Trigger**: 사용자 검증 후 6 항목 피드백
> **Design ref**: frontend-design 원칙 — visual hierarchy / 일관성 / typography 적용

---

## 1. Objective

설치 흐름 전체의 명확성/일관성 향상 + 구조 결함 1건 fix (Codex Prompts ↔ uzys-harness 관계).

## 2. AC (6 항목)

### F1 — 자산 description 보강

- **AC1.1**: EXTERNAL_ASSETS 32+ 자산 description 1-2줄 의미있는 설명. (자산 이름이 아닌 "무엇을 위한 것" 명시)
- **AC1.2**: description 안에 트랙 hint 포함 (예: "csr-* 트랙 추천")
- **AC1.3**: terminal 120 char 안 wrap 안 되도록 조절

### F2 — Phase 1 Templates 설명

- **AC2.1**: Phase 1 출력에 각 카테고리 (rules/agents/hooks/skills/CLAUDE.md/.mcp.json) 별 한 줄 설명 표시
  ```
  ✓ rules        13 entries  · 코딩/PR/테스트 정책. 모든 트랙 공통
  ✓ agents       4 entries   · code reviewer / data analyst / 전략가 / plan checker
  ```
- **AC2.2**: Step 3 선택 화면에 "Phase 1 default 설치 항목" 안내 한 줄 (intro 또는 separator)

### F3 — Phase 2 result row 간략화

- **AC3.1**: result row 의 description 중복 제거. id + 핵심 meta (method · source) 만
  ```
  → Impeccable — UI 디자인 가이드 ... (시작 시)
  ✓ impeccable                               skill · pbakaus/impeccable
  ```
- **AC3.2**: 한 row 가 120 char 안에 들어가도록 meta 단축

### F4 — Step 3 카테고리 selected count

- **AC4.1**: 카테고리 그룹 헤더에 `[selected/total ✓]` 표시
  ```
  ━━ 🎨 Frontend (UI · Design) [3/5 ✓] ━━
  ```
- **AC4.2**: dynamic update — toggle 시 카운트 갱신 (clack render 시 매번 계산)
- **AC4.3**: viewport 외 selected 도 헤더로 인지 가능

### F5 — Codex Prompts ↔ uzys-harness 묶음 (BREAKING)

ADR-017 참조.

- **AC5.1**: `codexPrompts` 자동 활성화 조건 변경:
  - 기존: `cli.includes("codex")`
  - 신규: `cli.includes("codex") && withUzysHarness === true`
- **AC5.2**: `withUzysHarness=false` + `cli=codex` 시 `~/.codex/prompts/uzys-*` **글로벌 복사 안 함**
- **AC5.3**: 사용자 명시 `--with-codex-prompts` 는 여전히 작동 (legacy override)
- **AC5.4**: Step 3 의 `withUzysHarness` 토글 시 안내 hint 에 "Codex slash /uzys-spec 도 함께 활성화" 추가

### F6 — install subcommand help 안내

- **AC6.1**: `claude-harness install` (track 없음) error 메시지에 안내 추가:
  ```
  ERROR: At least one --track is required (e.g. --track tooling)
         (Interactive wizard 는 subcommand 없이: `claude-harness`)
  ```
- **AC6.2**: README/help 의 install 섹션에 동일 안내

## 3. Design 원칙 적용 (frontend-design)

| 원칙 | 적용 |
|---|---|
| Visual hierarchy | Phase header `━━━` (3) > Category header `━━` (2) > 카테고리 내 자산 (들여쓰기) |
| Typography | description = normal / meta = dim / count = bold |
| 일관성 | Step 3 의 카테고리 헤더 = Phase 2 의 카테고리 헤더 동일 emoji + 표기 |
| 좁은 폭 | 120 char 안 wrap 안 되게 description 단축 |

## 4. Non-Goals

- clack 자체 viewport 확장 (F4 카테고리 헤더로 우회)
- 2-tier navigator 복귀 (v26.54 의 한 화면 의도 유지)
- description i18n (한국어 유지)
- frontend-design plugin 직접 invoke (agent 한계)

## 5. 위험

- **F5 BREAKING** — 기존 `cli=codex` 사용자가 v26.56.0 update 시 `~/.codex/prompts/uzys-*` 글로벌 복사 안 됨. Migration 안내 README 필요
- **F1 변경 분량 큼** — 32+ 자산 일괄 보강. test 영향 없음 (data only)
- **F4 dynamic count** — clack message 가 prompt 시작 시점 정적이라 group label 안 update 가능성. clack 의 selectableGroups + label 동작 확인 필요

## 6. Changelog
- 2026-05-17: 초안. 사용자 6 항목 피드백 기반. frontend-design 원칙 적용 명시.

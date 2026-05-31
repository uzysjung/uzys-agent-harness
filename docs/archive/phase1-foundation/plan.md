# Plan: Phase 1 Finalization & Phase 2 Entry Readiness

> **Linked SPEC**: `docs/SPEC.md`
> **Created**: 2026-04-23
> **Status**: Plan
> **Target version**: v26.38.0 (Foundation 완료 선언)

---

## Sprint Contract

### 범위 (In Scope)

SPEC §3.1 F1-F8. 요약:
- Docs 이월 3종 (README, USAGE, CONTRIBUTING)
- v27.17 dogfood 재실행
- HITO 집계 스크립트 + 7일 baseline
- Phase 2 진입 체크리스트 + v27.0~v27.17 requirements-trace

### 제외 (Out of Scope)

SPEC §3.2 그대로.

### 완료 기준

SPEC §2 AC1-AC5 모두 Pass + v26.38.0 태그 push.

### 제약 조건

- bash 3.2 호환 (집계 스크립트)
- jq 폴백 유지
- 글로벌 `~/.claude/` 미수정 자동 검증
- test-harness 147/147 유지

---

## Phase 분해

### Phase A — Docs Finalization (F1, F2, F3)

**목표**: Phase 4b 이월 3개 문서 소화.

- **A1** README.md 보강
  - Architecture 다이어그램 업데이트 (deep-research, market-research 공통 도구)
  - "Common tools" 섹션 신설 (find-skills, agent-browser, playwright, chrome-devtools, claude-powerline)
  - "Cherry-pick sync" 섹션 신설 (`.dev-references/cherrypicks.lock`, `sync-cherrypicks.sh`)
- **A2** USAGE.md 보강
  - Common tools 사용 시나리오 (research 워크플로우 등)
  - `.mcp.json` / `.claude/settings.json` 구조 설명 + `$CLAUDE_PROJECT_DIR` 사용법
  - `sync-cherrypicks.sh` 사용법 (diff/auto-update/conflict 분기)
- **A3** CONTRIBUTING.md sync 절차
  - cherry-pick drift 감지 워크플로우
  - 외부 repo 수정 시 매니페스트 업데이트 절차

**검증**: 해당 파일 diff + `grep` 키워드 매칭.

### Phase B — Dogfood v27.17 (F4)

**목표**: v27.17 기준 품질 확인 리포트.

- **B1** 기존 16 시나리오 재실행 (Phase 1~5)
- **B2** interactive 라우터 신규 시나리오 추가
  - 신규 디렉토리 Install 분기
  - 기존 설치 Update 분기
  - Multi-track Add 분기
- **B3** v27.16 gh-issue-workflow skill 설치 검증
- **B4** 리포트 작성 — `docs/dogfood/cli-dogfood-2026-04-XX.md`

**검증**: 리포트 CRITICAL/HIGH = 0.

### Phase C — HITO Infrastructure (F5)

**목표**: 집계 스크립트 + 집계 방법 문서화.

- **C1** `scripts/hito-aggregate.sh` 작성
  - `.claude/evals/hito-*.log` glob
  - 일일 카운트 (파일별 `wc -l`)
  - 주간 이동 평균
  - Feature 단위 집계 가이드(수동 eval 연계)
- **C2** HITO 측정 가이드 문서 — `docs/HITO.md` 또는 USAGE.md 섹션
  - 측정 정의 (NORTH_STAR NSM 인용)
  - 해석 방법 (explicit instruction vs 승인 vs 확인 구분은 수동)

**검증**: 빈 로그 / 1일 로그 / 복수일 로그 3케이스 테스트.

### Phase D — HITO Measurement (F6)

**목표**: 연속 7일+ 실사용 로그 수집 + baseline 수치.

- **D1** 경과 대기 (최소 7일, 세션 ≥ 10회 기준 — OQ1 참조)
- **D2** 집계 실행 + 수치 기록
- **D3** 분석 리포트 — `docs/evals/hito-baseline-YYYY-MM-DD.md`
  - 일일/주간 추세
  - feature 완주 횟수 (수동 분류 필요)
  - NSM 목표 대비 현재치 (≤ 3 per feature)

**⚠ 경과 시간 필요** — Phase A/B/C 병행 진행.

### Phase E — Phase 2 Readiness (F7, F8)

**목표**: 진입 체크리스트 Pass/Fail 판정 + 추적성.

- **E1** SPEC §5 체크리스트 항목별 실행 + 결과 기록
- **E2** `docs/requirements-trace.md` 확장
  - Part 3 신설: "v27.x Post-audit Trace"
  - v27.0~v27.17 각 feat 커밋의 Source → 4-gate → Evidence 매핑
- **E3** OQ1-3 결정 문서화 — ADR로 `docs/decisions/ADR-001-phase2-entry-criteria.md`

**검증**: 체크리스트 7항목 전부 결과 기록(Pass/Fail/이월). ADR 1개 생성.

### Phase F — Review & Ship

- **F1** `/uzys:review` — 5축 리뷰, CRITICAL 0
- **F2** ship-checklist 통과 확인
- **F3** CLAUDE.md 업데이트 검토 (개선 프로세스 §1 Ship 후 리뷰)
- **F4** Self-Audit 5항목 기록
- **F5** v26.38.0 태그 + push

---

## Revision & Escalation

- **Revision 상한**: 각 Phase 내 에이전트 자동 수정 ≤ 2회. 초과 시 Escalation.
- **Escalation**: OQ1-3 해결 불가 / Phase D baseline 수치가 NSM 목표 대비 크게 벗어남 / dogfood CRITICAL 발견 시 사용자 결정.
- **Abort 조건**: 글로벌 `~/.claude/` 변경 감지 → 즉시 중단.

## Risks

| Risk | 완화 |
|------|------|
| HITO 7일간 세션 부족 → baseline 대표성 낮음 | OQ1 — 최소 세션 수 병행 기준. 미달 시 Phase D 이월 + 새 ADR |
| v27.17 interactive 라우터 dogfood 시나리오 정의 불명 | OQ3 — 최소 3개(Install/Update/Add) 확정, 추가 발견 시 B2 확장 |
| D1/D2/D4 작업 중 setup-harness.sh 변경 필요 발견 | Surgical Changes 원칙. 발견 시 Major CR로 분리 |

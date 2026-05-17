# SPEC: v26.57.0 — Codex uzys 매핑 전수 + UX 보강

> **Status**: Draft (2026-05-17)
> **Predecessor**: v26.56.0 (ADR-017 — global codex prompts 만 묶음)
> **Trigger**: 사용자 검증 — 4 항목 피드백 (Codex 매핑 모순 + UX 명료성 + Templates 설명 + viewport)

---

## 1. Objective

ADR-017 의 codex prompts 묶음을 완성 + Phase 2/Phase 1 UX 명료성 보강.

## 2. AC (4 항목)

### F1 — Codex 매핑 전체 uzys 묶음 (ADR-018, BREAKING)

- **AC1.1**: `.agents/skills/uzys-*/SKILL.md` 6 파일 → `cli=codex && withUzysHarness` 일 때만 생성
- **AC1.2**: `.codex/prompts/uzys-*.md` 6 파일 → 동일 조건
- **AC1.3**: AGENTS.md / config.toml / hooks 는 codex baseline 으로 유지 (cli=codex 기본 매핑)
- **AC1.4**: `runCodexTransform` 가 `withUzysHarness` param 받음 (default false — 안전)
- **AC1.5**: test 회귀 0 + 신규 — withUzysHarness=true/false 각각 검증

### F2 — Phase 2 출력 GUI 명료화

- **AC2.1**: → (asset start) 라인 제거. ✓ (result) 한 라인 per asset 으로 1 단위 명확
- **AC2.2**: 카테고리 헤더 (`━━ Frontend ━━`) 는 유지 — 카테고리 경계 시각화
- **AC2.3**: assets 시작 spinner 없음 — sync spawn 이라 진행 시간 < 5초

### F3 — Templates 설명 더 상세

- **AC3.1**: rules 설명: 정책 종류 명시 ("git/PR · 테스트 · ship checklist · MCP allowlist") + 트랙별 추가 예시
- **AC3.2**: agents 설명: 자체 vs ECC 분리 명시
- **AC3.3**: hooks 설명: 각 hook 의 역할 (gate-check 가 6-Gate 순서 강제 등)
- **AC3.4**: commands 설명: 옵션별 매핑 명시
- **AC3.5**: skills 설명: 자체 3종 의 역할 + ECC 9 cherry-pick 안내

### F4 — Step 3 viewport 안내 (clack 한계 인정)

- **AC4.1**: prompt message 에 `default ✓ N/total` 정적 카운트 표시
- **AC4.2**: 터미널 height 30+ 권장 안내 한 줄
- **AC4.3**: dynamic per-category count update 는 clack core fork 필요 — skip. 카테고리 헤더의 초기 count (v26.56.0 F4) 로 대체

## 3. Non-Goals

- clack core fork — viewport dynamic count 불요 (한계 인정, message 정적 hint 로 대체)
- Update mode 의 기존 `.codex/prompts/uzys-*` prune (BREAKING migration — 수동)
- 자산별 description 추가 보강 (이미 v26.55.0 + v26.56.0 에서 보강)

## 4. 위험

- **F1 BREAKING** — 기존 `cli=codex` 사용자 (uzys-harness 안 켰던) update 시 codex skill/prompt 산출물 0. Migration 안내 README + CHANGELOG
- **F2** — → 라인 제거 시 plugin install 같이 5초+ 자산은 진행 인지 부족 가능. 카테고리 헤더 + ✓ 누적 표시로 부분 보완

## 5. Changelog
- 2026-05-17: 초안. 사용자 4 항목 피드백 기반.

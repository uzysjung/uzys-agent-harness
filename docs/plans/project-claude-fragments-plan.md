# Plan: project-claude Section-Fragment 머지 구조

> **Linked SPEC**: `docs/specs/project-claude-fragments.md`
> **Created**: 2026-05-12
> **Status**: Plan
> **Complexity**: Complex
> **Target branch**: `feat/project-claude-fragments`

---

## Sprint Contract

### 범위 (In Scope)

SPEC §3.1 T1-T7. 결과물:
- `templates/project-claude/_base.md` (공통 골격)
- `templates/project-claude/fragments/<track>/<section>.md` (11 트랙 × 최대 8 섹션)
- `src/project-claude-merge.ts` (머지 모듈)
- `src/manifest.ts` 변경 (single-track 가드 제거 + 머지 호출)
- `src/commands/install.ts` 로그 보강
- `tests/project-claude-merge.test.ts`
- 기존 11 트랙 .md + `full.md` 삭제 (R1, R2)

### 제외 (Out of Scope)
- `.claude/CLAUDE.md` 구조 변경
- Codex/OpenCode AGENTS.md 변환 로직 변경
- 트랙 추가/삭제, 섹션 헤더 명칭 변경
- 머지 결과 후처리 (lint, TOC)

### 완료 기준
- SPEC AC1~AC8 모두 Pass
- vitest 테스트 신규 추가분 100% PASS
- `tests/test-harness.sh` 147 assertion 회귀 0
- 단일/이중/triple/full 트랙 머지 결과 수동 검증 1회

### 제약 조건
- `templates/CLAUDE.md` 무변경 (DO NOT CHANGE)
- 11 트랙 식별자 보존
- 800줄 상한 (code-style.md) — 트랙 다수 머지 시 경고만 출력

---

## NORTH_STAR 4-gate

| Gate | 판정 | 근거 |
|------|------|------|
| Trend | Pass | Multi-track 설치 UX 갭 해소 |
| Persona | Pass | 시니어/Setup 사용자가 multi-track 선택하는 케이스 |
| Capability | Pass | docs/template + manifest 영역 (기존 capability) |
| Lean | Pass | 새 트랙/스킬 추가 없음, 기존 구조 재정렬 |

→ 4/4 Pass. 진행 가능.

---

## Phase 분해 (Vertical Slice)

### Phase A — 설계 & PoC (1 트랙으로 동작 증명)

목적: 머지 로직의 핵심 동작을 1개 트랙(`tooling`)으로 검증.

| Task | 산출물 | AC |
|------|--------|-----|
| **A1** | `templates/project-claude/_base.md` | 헤더 + 8 INSERT 마커 + 안내문 |
| **A2** | `templates/project-claude/fragments/tooling/{stack,workflow,active-rules,agents,skills,commands,boundaries}.md` (7개, plugins 제외) | 기존 `tooling.md`에서 추출, 본문 동등 |
| **A3** | `src/project-claude-merge.ts` 골격 | `mergeProjectClaude(tracks: string[]): string` export, single-track 동작만 |
| **A4** | PoC 검증 | `mergeProjectClaude(['tooling'])` 결과가 기존 `tooling.md`와 기능적 동등 |

의존성: A1 → A2 → A3 → A4

### Phase B — 머지 로직 완성

목적: multi/full 케이스 + 단위 테스트.

| Task | 산출물 | AC |
|------|--------|-----|
| **B1** | 머지 모듈: multi-track concat + `### <Track Display Name>` 소제목 자동 삽입 | 2+ 트랙 머지 시 각 섹션 내 소제목 정렬 |
| **B2** | `TRACK_DISPLAY_NAMES` const (R3) | 11 트랙 매핑 완비 |
| **B3** | 'full' 자동 union (R2) | `mergeProjectClaude(['full'])` = 모든 dev 트랙 union |
| **B4** | 옵션 섹션 생략 (R4) | fragment 파일 없으면 INSERT 마커 자체 제거 |
| **B5** | `tests/project-claude-merge.test.ts` | 단일/이중/full/옵션 누락 4 케이스 |

의존성: A 완료 → B1, B2 병렬 → B3 → B4 → B5

### Phase C — 트랙 분해 (나머지 10 트랙)

목적: A에서 만든 `tooling` 외 10 트랙을 fragment로 분해.

| Task | 산출물 | AC |
|------|--------|-----|
| **C1** | csr-fastapi, csr-fastify, csr-supabase fragment 분해 | 3 트랙 × 섹션, 기존 .md와 본문 동등 |
| **C2** | data, executive, growth-marketing, project-management fragment 분해 | 4 트랙 × 섹션 |
| **C3** | ssr-htmx, ssr-nextjs fragment 분해 | 2 트랙 × 섹션 |
| **C4** | csr-supabase 옵션 섹션 (`supabase-auth.md`) 처리 | `_base.md`에 옵션 마커 추가 or fragment 내부 inline |
| **C5** | C1-C4 머지 결과 sanity check | 각 트랙 단일 설치 결과가 기존 .md와 동등 |

의존성: B 완료 → C1/C2/C3 병렬 → C4 → C5

### Phase D — manifest & install 통합

목적: 실제 설치 흐름에 머지 로직 연결.

| Task | 산출물 | AC |
|------|--------|-----|
| **D1** | `src/manifest.ts:261` 가드 제거 | multi-track도 root CLAUDE.md 생성 |
| **D2** | manifest entry → 머지 모듈 호출 변경 | `source` 필드 대신 머지 결과 inject 메커니즘 |
| **D3** | `src/commands/install.ts` 로그 | `merged from N tracks` 표시 |
| **D4** | test-harness 회귀 확인 | 147 assertion 0 fail |

의존성: C 완료 → D1 → D2 → D3 → D4

### Phase E — 정리 (R1, R2 적용)

목적: 기존 파일 제거 + full.md 제거.

| Task | 산출물 | AC |
|------|--------|-----|
| **E1** | 기존 11 트랙 .md + `full.md` 삭제 | `templates/project-claude/*.md` 중 `_base.md`만 잔존 |
| **E2** | 문서 sync — README/USAGE에 신구조 1줄 언급 | 필요 시 (cli-development 등 영향 없음) |

의존성: D 완료 → E1 → E2

### Phase F — Review & Ship

`/uzys:review` → `/uzys:ship` → 태그 (v26.x.x, 차후 결정).

---

## 의존성 그래프

```
A1 → A2 → A3 → A4
              ↓
         B1, B2 → B3 → B4 → B5
                              ↓
                    C1, C2, C3 → C4 → C5
                                       ↓
                              D1 → D2 → D3 → D4
                                              ↓
                                         E1 → E2
                                              ↓
                                              F
```

병렬 가능: B1/B2, C1/C2/C3.

---

## 위험 & 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| 기존 트랙 .md와 머지 결과 본문 차이 | regression | C5 sanity check + git diff 검토 |
| 800줄 상한 위반 (full 머지) | code-style.md 위반 | 경고 로그만, hard fail X |
| `csr-supabase`의 비표준 섹션 (Supabase 인증) | 옵션 섹션 처리 누락 | C4에서 명시 처리 |
| manifest entry 머지 결과 inject 메커니즘 부재 | 구현 막힘 | D1-D2에서 patch entry 신설 검토 |

---

## Self-Audit Hooks

각 Phase 완료 시 5항목 실행. 결과 commit body에 1줄 기록.

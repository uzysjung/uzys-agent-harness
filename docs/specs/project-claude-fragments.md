# SPEC: project-claude Section-Fragment 머지 구조

> **Status**: Draft (2026-05-12)
> **Trigger**: Multi-track 설치 시 root `CLAUDE.md` 미생성 (manifest.ts:261 가드). 11개 트랙 .md에 공통 섹션 헤더/안내문 중복. `full.md` 수동 동기화 부담.

---

## 1. Objective

`templates/project-claude/`를 **section fragment 기반**으로 재구성해, 단일 트랙·복수 트랙·full 어느 케이스든 root `CLAUDE.md`를 일관된 머지 로직으로 자동 생성한다.

**3가지 결과**:

1. **공통 골격 SSOT화** — section 헤더/안내문은 `_base.md`에 1회만 정의.
2. **트랙 fragment 분해** — 11 트랙 × 8 섹션 = 최대 88 fragment 파일 (트랙별 옵션 섹션 허용).
3. **Multi-track 자동 머지** — `spec.tracks`가 1개든 N개든 'full'이든 동일 로직.

## 2. 판단 기준 (불변)

### 완료 조건 (AC)

- **AC1**: `templates/project-claude/_base.md` 신설. `<!-- INSERT: <section> -->` 마커로 8개 섹션 placeholder 보유.
- **AC2**: 11 트랙 모두 `templates/project-claude/fragments/<track>/<section>.md` 분해. 옵션 섹션(예: `tooling` Plugins 없음, `csr-supabase` Supabase 인증) 허용.
- **AC3**: `src/manifest.ts` 또는 별도 머지 모듈에서 단일/다중/full 트랙 처리 통합.
- **AC4**: 'full' 선택 시 `fragments/full/` 디렉토리 없이 모든 트랙 fragment를 자동 union.
- **AC5**: 같은 섹션에 복수 트랙 fragment 있으면 `### <Track Display Name>` 소제목 자동 삽입 후 concat. dedup 없음.
- **AC6**: 기존 11개 트랙 .md 단일 트랙 설치 시 머지 결과가 **기능적으로 동등**해야 함 (섹션 헤더·본문 보존, 트랙 식별 가능).
- **AC7**: 머지 로직 단위 테스트 (단일/이중/full/옵션 섹션 누락 케이스).
- **AC8**: `src/commands/install.ts` 설치 로그에 multi-track 머지 결과 표시 (`merged from N tracks`).

### 판정 절차

1. 단일 트랙 머지 → 기존 `<track>.md`와 diff (구조 변경 허용, 정보 누락 불가).
2. Multi-track 머지 → 각 섹션이 트랙별 소제목으로 분리되는지 검증.
3. `full` 머지 → 10개 dev 트랙 모두 fragment 포함 확인.
4. 머지 후 root `CLAUDE.md` 800줄 상한 (code-style.md) 위반 시 경고.

## 3. 결정 일람

### 3.1 포함 (In Scope)

| ID | 작업 | 근거 |
|----|------|------|
| **T1** | `_base.md` 골격 작성 — 헤더 + 안내문 + 8 INSERT 마커 | SSOT |
| **T2** | 11 트랙 × 8 섹션 fragment 분해 — 기존 트랙 .md 본문 추출 | 분해 작업 |
| **T3** | 머지 모듈 신설 — `src/project-claude-merge.ts` | 단일 책임 |
| **T4** | `manifest.ts` 변경 — `if (spec.tracks.length === 1)` 가드 제거, 머지 모듈 호출로 대체 | 핵심 동작 변경 |
| **T5** | `install.ts` 로그 — `merged from N tracks` 표시 | UX |
| **T6** | 머지 단위 테스트 — `tests/project-claude-merge.test.ts` | 회귀 방지 |
| **T7** | 기존 11 트랙 .md 보존 정책 — archive로 이동 vs 삭제 (§3.4 OQ1) | 결정 보류 |

### 3.2 제외 (Non-Goals)

- **`.claude/CLAUDE.md` 구조 변경** — 본 SPEC은 root `CLAUDE.md`(=project-claude)만 다룸.
- **Codex/OpenCode AGENTS.md 변환 로직 변경** — `templates/CLAUDE.md` SSOT 유지. 영향 없음.
- **트랙 추가/삭제** — 기존 11 트랙 그대로.
- **섹션 헤더 명칭 변경** — Stack/Workflow/.../Boundaries 8개 유지.
- **머지 결과의 추가 후처리** — Markdown lint, TOC 자동 생성 등.

### 3.3 DO NOT CHANGE

- `templates/CLAUDE.md` (← `.claude/CLAUDE.md` SSOT, 별개)
- `src/codex/transform.ts`, `src/opencode/transform.ts`
- 11 트랙 식별자 (`csr-fastapi`, `csr-fastify`, ..., `tooling`)
- `manifest.ts` 타 섹션 (rules/agents/skills/hooks 매핑)

### 3.4 결정 사항 (Resolved)

- **R1** (was OQ1): 기존 11 트랙 .md 원본은 fragment 분해 검증 후 **즉시 삭제**. git history에 보존.
- **R2** (was OQ2): `full.md` 파일 **삭제**. 'full' 트랙은 머지 로직에서 모든 dev 트랙 union으로 자동 처리. `fragments/full/` 디렉토리 없음.
- **R3** (was OQ3): 트랙 display name은 머지 모듈(`src/project-claude-merge.ts`) 내부 `const TRACK_DISPLAY_NAMES` 매핑으로 정의. 단일 책임.
- **R4** (was OQ4): 트랙 fragment 파일이 없는 섹션은 **섹션 자체 생략**. (예: `tooling`에 `plugins.md` 없으면 결과 `CLAUDE.md`에 `## Plugins` 섹션 자체 없음). multi-track에서 다른 트랙이 해당 섹션 fragment를 가지면 그 트랙 분만 포함.

## 4. Phase 분해

- **Phase A — 설계 & PoC** (T1, T3 일부): `_base.md` + 머지 모듈 골격 + 1 트랙(`tooling`) fragment.
- **Phase B — 머지 로직 완성** (T3, T6): 단일/다중/full 케이스 + 단위 테스트.
- **Phase C — 트랙 분해** (T2): 나머지 10 트랙 × 8 섹션 fragment.
- **Phase D — manifest 통합** (T4, T5): 가드 제거 + 설치 로그.
- **Phase E — 정리** (T7, OQ1/OQ2 해소): 원본 .md 처리, full.md 처리.
- **Phase F — Review & Ship**: `/uzys:review` → `/uzys:ship`.

순차 의존: A → B → C → D → E → F. 병렬 불가 (각 phase가 다음 phase 입력).

## 5. Self-Audit Hooks

각 Phase 완료 시 5항목 실행 + 결과 commit message body에 기록.

---

## Changelog

- 2026-05-12: 초안. 사용자 결정 4건(섹션 단위 / full 자동 union / concat + 트랙 소제목 / SPEC-first) + OQ 4건 해소(R1~R4) 반영. Ready for /uzys:plan.

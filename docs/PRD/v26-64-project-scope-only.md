# v26.64.0 — Project Scope Default + Global Opt-in (BREAKING)

> **Status**: Approved (2026-05-18 user mandate)
> **Type**: Refactor + BREAKING
> **Predecessor**: v26.63.4
> **북극성**: `NORTH_STAR.md` D16 — "글로벌 무인지 write 금지" (본질 재정의)
> **ADR**: ADR-020 (Supersedes ADR-012, ADR-017)

---

## 1. Context (Why)

### D16 SPEC drift (v26.42~v26.63 누적)

NORTH_STAR.md D16 원문:
> **Project-Scope 오염 금지** — 글로벌 `~/.claude/`, `~/.codex/`, `~/.opencode/` 절대 미수정

이 SPEC 가 v26.42 (addy-agent-skills opt-in) ~ v26.55 (ECC opt-in) cycle 에서 외부 자산 도입 시 무인지 → 글로벌 write 가 multiple 위치에서 발생. **ECC plugin 만 prune-ecc.sh 로 `.claude/local-plugins/ecc/` 에 복사 (D16 준수)**. 나머지 자산 silent drift.

### 본 세션 (v26.58~v26.63) 의 영향

- UX 검증 시 mktemp dir 에 install 호출 12+ 회 — 글로벌 plugin/skill/npm 추가
- pm-skills@claude-code-skills (2026-05-17) 1 plugin
- agent-browser (npm -g, 2026-05-18)
- ~/.codex/prompts/uzys-*.md (2026-05-17)
- **매뉴얼 cleanup 완료 (사용자 직접, 2026-05-18)** — 본 cycle 시작 시점에 baseline 깨끗

### 위반 매트릭스 (cleanup 전 상태)

| Phase | 자산 | 위반 위치 | 위반 |
|-------|------|----------|------|
| Phase 2 plugin (railway/karpathy/product/c-level/data/agent-skills/superpowers/document-skills/supabase/postgres/impeccable 등) | `claude plugin install` → `~/.claude/plugins/cache/` | **YES** |
| Phase 2 skill (impeccable/playwright/find-skills/ADR/shadcn/react/web/next/polars/dask/python-*) | `npx skills add` → `~/.claude/skills/` | **YES** |
| Phase 2 npm-global (agent-browser/vercel/netlify-cli/supabase) | `npm install -g` → `/usr/local/lib/node_modules/` | **YES** (system-wide) |
| Phase 3 codex prompts (--with-codex-prompts) | `~/.codex/prompts/uzys-*.md` | **YES** |
| Phase 3 codex skills (--with-codex-skills) | `~/.codex/skills/uzys-*/` | **YES** |
| Phase 3 codex trust (--with-codex-trust) | `~/.codex/config.toml` `[projects."..."]` block 추가 | **YES** |
| Phase 1 (rules/agents/hooks/commands/skills templates) | `.claude/` (project) | ✓ 준수 |
| Phase 1 (.mcp.json / .mcp-allowlist / .env.example) | project | ✓ 준수 |
| Phase 3 AGENTS.md / .codex/config.toml (project file) | project | ✓ 준수 |

### D16 의도 재정의 (사용자 mandate 2026-05-18)

silent drift 의 본질 = **사용자 무인지 글로벌 write**. 따라서 D16 의 의도는:

> **사용자 명시 동의 없는 글로벌 write 금지** — 명시 opt-in (interactive 또는 `--scope global`) 은 D16 본질 위배 아님.

NORTH_STAR.md D16 본문도 함께 보강 (본 PRD PR 의 부수 변경).

---

## 2. PRD (What)

### Goals

1. **모든 install 자산 default = Project scope** — D16 본질 준수
2. **interactive scope prompt 노출** — 사용자 의식적 결정
3. **`--scope <project|global>` flag** — 비대화형 동작 / CI 지원 (`--yes` 시 자동 project)
4. **install log marker** — `.claude/.harness-install.json` (자산 list + version + scope + timestamp)
5. **uninstall command 신규** — log 기반 reverse. 글로벌 자산은 안내만 (D16 — 자동 삭제 금지)
6. **테스트 격리** — Docker 컨테이너 안 검증. 사용자 PC 글로벌 미사용

### Non-Goals

- 이미 발생한 글로벌 install 자동 cleanup (사용자가 2026-05-18 매뉴얼 완료)
- 외부 자산 매트릭스 변경 (install 방식 + scope 만 변경)
- Codex 글로벌 사용 (claude-harness 외 직접 use) 영향 X

### Acceptance Criteria

#### AC1 — `--scope project` (default) 검증

Phase 1 (2026-05-18) 실 조사 결과: claude CLI 가 `--scope project` 라도 fs 적으로 `~/.claude/plugins/cache/` + `~/.claude/plugins/marketplaces/` 에 write (자체 디자인). 격리는 `installed_plugins.json` 메타데이터.

Docker 컨테이너 안 검증:

| 영역 | 검증 |
|------|------|
| `~/.claude/skills/` | fs diff = 0 (skills CLI default 가 project — `./node_modules` 에만 write) |
| `~/.codex/` | fs diff = 0 (claude-harness 가 `.codex/` 에 직접 write) |
| `~/.opencode/` | fs diff = 0 |
| `npm root -g` | diff = 0 (`npm --save-dev` 만 사용) |
| `~/.claude/plugins/cache/`, `marketplaces/` | write 발생 허용 (claude CLI 자체 디자인). `installed_plugins.json` 의 새 entry 가 모두 `scope: "project"` + 현재 `projectPath` 일치 |
| **격리 검증** | 다른 projectPath 에서 plugin 미노출 (`projectPath=/tmp/other` 로 `claude plugin list` 호출 시 v26.64 install plugin 안 보임) |

#### AC2 — `--scope global` (opt-in) 후 매트릭스 정의대로 정확 write

Docker 컨테이너 안 검증:

| 영역 | 검증 |
|------|------|
| `~/.claude/plugins/installed_plugins.json` | 새 entry 의 `scope: "user"` (projectPath 없음) |
| `~/.claude/skills/<id>/` | 새 디렉토리 생성 |
| `npm root -g` | 새 패키지 (vercel/supabase 등) 추가 |
| `~/.codex/prompts/uzys-*` | 새 파일 생성 |
| `~/.codex/skills/uzys-*` | 새 디렉토리 생성 |
| `~/.codex/config.toml` | `[projects."..."]` block 추가 (codex-trust 자산 활성 시) |

#### AC3 — Interactive scope prompt + flag 우선순위

```
◆  Installation scope
│  ● Project   (Install in current directory, committed with your project)
│  ○ Global    (Write to ~/.claude/, ~/.codex/, npm -g)
└
```

| 입력 | 결과 |
|------|------|
| `--scope project` 명시 | Project (prompt skip) |
| `--scope global` 명시 | Global (prompt skip) |
| `--yes` (비대화형) | **Project** (default) |
| flag 없음 + interactive | prompt — Project pre-selected |

#### AC4 — install log marker

`.claude/.harness-install.json`:
```json
{
  "version": "26.64.0",
  "installedAt": "2026-05-18T...",
  "scope": "project",
  "spec": { "tracks": [...], "cli": [...], "options": {...} },
  "templates": { "rules": [...], "agents": [...], ... },
  "assets": [
    { "id": "playwright-skill", "method": "skill", "version": "...", "scope": "project", "path": ".claude/local-skills/playwright-skill/" },
    { "id": "vercel", "method": "npm", "version": "...", "scope": "global", "path": "/usr/local/lib/node_modules/vercel/" }
  ]
}
```

#### AC5 — uninstall command

```bash
claude-harness uninstall [--dry-run] [--keep-templates]
```

- log 기반 reverse — `scope=project` 자산만 자동 제거
- `scope=global` 자산은 **안내만** (D16 — 글로벌 영역 자동 삭제 금지). 사용자 명시 `--global` 플래그 필요 (별도 PR 검토)
- dry-run: 제거 대상 list 표시
- keep-templates: `.claude/{rules,agents,...}` 보존

#### AC6 — 회귀 0 + Docker 검증

- 기존 583 tests pass 유지
- 신규 tests (Docker 컨테이너 안):
  - install --scope project → 컨테이너 글로벌 diff = 0
  - install --scope global → 매트릭스 정의대로 정확 write
  - uninstall → project 자산 정확 reverse + global 자산 미수정
- 사용자 PC 글로벌 무영향

---

## 3. Plan (How) — Phase

### Phase 0 — SPEC/ADR 갱신 (~0.5h)

**완료 산출** (Task #1):
- ADR-020 신규 — Default=Project, Global opt-in
- ADR-012, ADR-017 → Superseded by ADR-020
- 본 PRD 갱신
- NORTH_STAR.md D16 본문 보강 (Phase 2 진입 전)

### Phase 1 — 테스트 환경 + CLI 조사 (READ-ONLY, ~2h)

**Task 1.A**: Docker 테스트 환경 설계 (Task #2)
- `test/docker/Dockerfile` — ubuntu 24.04 + node + claude CLI (mock 또는 실 npm install)
- `test/docker/run-install.sh` — snapshot before/after + install + diff
- `test/docker/scenarios/` — project / global / uninstall 시나리오
- 사용자 PC 파일시스템 mount 0 (`-v` flag 사용 시 read-only)

**Task 1.B**: CLI scope 옵션 조사 (Task #3)
- 1.1 `claude plugin install --help` — `--scope project` 옵션 존재 확인
- 1.2 `npx skills add --help` — `--target` 또는 `--local` 옵션 확인
- 1.3 npm 자산 처리 = **A' 확정**: `npm install --save-dev` (default) / `npm install -g` (opt-in)
- 1.4 Codex CLI 의 project-scope (`.codex/prompts/`) 인식 여부 검증 (Docker 안 read-only test)
- 1.5 install log 스키마 final + uninstall 명령 final 설계

### Phase 2 — 구현 (~3~5h)

**Task 2.A** (Task #4): scope prompt + install 분기
- `src/commands/install.ts` — scope prompt UI (interactive + flag)
- `src/external-installer.ts` — method 별 scope 분기:
  - `plugin`: project → `.claude/local-plugins/` 복사, global → `~/.claude/plugins/cache/`
  - `skill`: project → `.claude/local-skills/` 또는 `--target`, global → `~/.claude/skills/`
  - `npm`: project → `--save-dev`, global → `-g`
  - `codex-*`: project → `.codex/`, global → `~/.codex/` (Phase 1.4 결과에 따라 fallback)
- `src/installer.ts` — install header 에 SCOPE row

**Task 2.B** (Task #5): install log + uninstall command
- `src/installer.ts` 의 install 종료 시 `.claude/.harness-install.json` write
- `src/commands/uninstall.ts` 신규 — log 기반 reverse, `--dry-run` / `--keep-templates`

### Phase 3 — Docker E2E + 검증 (~2~3h)

**Task 3** (Task #6):
- Docker 컨테이너 안 install --scope project + snapshot diff = 0
- Docker 컨테이너 안 install --scope global + 정확 write 검증
- uninstall 동작 검증
- 기존 583 tests + 신규 tests 모두 pass
- 사용자 PC 글로벌 무영향 (호스트 snapshot 비교)

### Phase 4 — PR + 머지 + Release

**Task 4** (Task #7):
- `feat/v26.64-project-scope-default` branch → PR
- PR 본문: BREAKING (ADR-012/017 supersede), 사용자 mandate, Docker 검증 결과
- CI green 확인 (단발 호출, until loop 금지)
- 머지 후 tag v26.64.0 + release
- Post-merge cleanup: local + remote branch 삭제

---

## 4. Todo

### Phase 0 (in progress)
- [x] ADR-020 작성
- [x] ADR-012 / ADR-017 Status 갱신 (Superseded by ADR-020)
- [x] 본 PRD 갱신
- [ ] NORTH_STAR.md D16 본문 보강 (Phase 2 진입 전)
- [ ] 사용자 컨펌

### Phase 1 (blocked by Phase 0 사용자 컨펌)
- [ ] Task 1.A — Docker 테스트 환경 설계 + 검증
- [ ] Task 1.B — CLI scope 옵션 조사 (claude / npx skills / npm / codex)
- [ ] Task 1.B.4 — Codex CLI project-scope 인식 가능 여부 결정

### Phase 2 (blocked by Phase 1)
- [ ] Task 2.A — scope prompt UI + install 분기
- [ ] Task 2.B — install log + uninstall command

### Phase 3 (blocked by Phase 2)
- [ ] Task 3 — Docker E2E + snapshot diff + 기존 tests 회귀

### Phase 4 (blocked by Phase 3)
- [ ] Task 4 — PR + 머지 + tag v26.64.0

---

## 5. 사용자 결정 (해결됨)

### Codex 글로벌 자산 정책

사용자 mandate (2026-05-18): **모든 자산 일관 Default=Project, Global opt-in**.

ADR-012 (v26.46 — Codex prompts cli=codex 자동 global ON) → Superseded.
ADR-017 (v26.56 — `cli=codex && withUzysHarness` coupling) → Superseded.

새 결정: ADR-020. 모든 install 자산 동일 정책.

### npm 자산 처리

**A' 채택**: `npm install --save-dev` (project default) + `npm install -g` (global opt-in). 일반 npm 동작과 일관.

---

## 6. 새 세션 시작 가이드

### 새 세션 prompt template

```
v26.64.0 cycle 진행. PRD: docs/PRD/v26-64-project-scope-only.md, ADR-020.

배경:
- D16 의도 재정의 (사용자 mandate 2026-05-18): "글로벌 무인지 write 금지" 의 본질 — 명시 opt-in 은 예외 OK
- 모든 install 자산 Default = Project scope + interactive prompt 또는 --scope global 로 opt-in
- 테스트 격리: 사용자 PC 글로벌 미사용. Docker 컨테이너 안에서만 검증

진행:
1. TaskList 로 현재 phase 확인
2. Phase 0 완료 → Phase 1 (Docker + CLI 조사) 진입
3. 각 Phase 끝마다 사용자 컨펌

세션 첫 명령:
- cat docs/PRD/v26-64-project-scope-only.md
- cat docs/decisions/ADR-020-project-scope-default.md
- TaskList
```

### 의존성 / 선행 조건

- v26.63.4 머지 완료
- 사용자 매뉴얼 cleanup 완료 (2026-05-18)
- Phase 0 사용자 컨펌 후 Phase 1 진입

### 관련 SPEC / ADR

- `docs/NORTH_STAR.md` D16 (본문 보강 예정)
- ADR-020 (본 cycle 신규) — Project Scope Default + Global Opt-in
- ADR-012 / ADR-017 — Superseded by ADR-020
- `scripts/prune-ecc.sh` — ECC 의 project-scoped 패턴 (참고 모델, 일반화 대상)

---

## 7. Changelog

- 2026-05-18 (v1): 초안 작성. v26.63.4 머지 후 D16 위반 발견. 사용자 mandate. (Phase 1.4 사용자 결정 필요 상태)
- 2026-05-18 (v2): 사용자 결정 수신 — "모든 install Default=Project, Global opt-in. npm 은 A' (devDep default), Codex 도 동일 적용". ADR-020 신규 + ADR-012/017 supersede. PRD 전면 갱신. 테스트는 Docker 컨테이너 안에서만.
- 2026-05-18 (v3): Phase 1 (CLI scope 옵션 조사) 결과 반영. `claude plugin install --scope <user|project|local>` + `npx skills add [-g]` 가 native 지원. ADR-020 의 가설 (prune-ecc 패턴 일반화) 폐기 — claude/skills CLI native scope 사용. **claude plugin 의 fs 비대칭성** 발견: `--scope project` 라도 fs 는 `~/.claude/plugins/cache/` 에 write (claude CLI 자체 디자인). 사용자 결정 X 채택 — fs 격리 X, 메타데이터 격리 O. AC1/AC2 재정의 (위 §2).

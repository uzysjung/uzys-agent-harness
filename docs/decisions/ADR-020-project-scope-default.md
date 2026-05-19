# ADR-020: 모든 install 자산 Default = Project scope, Global 은 명시 opt-in

- **Status**: Proposed
- **Date**: 2026-05-18
- **PR**: TBD (v26.64.0)
- **Supersedes**: ADR-012 (Codex prompts global default), ADR-017 (Codex prompts + uzys-harness coupling)
- **Related**: ADR-002 (D16 정신 명시), ADR-004 (opencode 글로벌 미수정), `docs/NORTH_STAR.md` D16

## Context

### D16 SPEC 의 원문

`docs/NORTH_STAR.md` D16:
> **Project-Scope 오염 금지** — 글로벌 `~/.claude/`, `~/.codex/`, `~/.opencode/` 절대 미수정

### v26.42~v26.63 cycle 의 silent drift

| Cycle | 도입 자산 | 글로벌 write |
|-------|----------|------------|
| v26.42 | addy-agent-skills opt-in | `~/.claude/skills/` |
| v26.46 | ADR-012: Codex prompts cli=codex 시 자동 ON | `~/.codex/prompts/uzys-*` |
| v26.55 | ECC plugin opt-in (단 prune-ecc.sh 로 `.claude/local-plugins/` 복사 — D16 준수) | (준수) |
| v26.56 | ADR-017: ADR-012 부분 정정 (uzys-harness 와 coupling) | `~/.codex/prompts/uzys-*` (uzys ON 시) |
| v26.58~63 | UX 검증 시 mktemp 에 install 12+회 호출 | `~/.claude/plugins/cache/`, `~/.claude/skills/`, `npm root -g`, `~/.codex/` |

ECC 1건만 D16 준수 (project-scoped local copy 패턴), 나머지 silent drift.

### 사용자 mandate (2026-05-18)

매뉴얼 cleanup 직후 사용자 명시 결정:

1. **모든 install 디폴트 = Project scope**
2. **interactive prompt 로 Project/Global 선택 가능** (default Project pre-selected)
3. **테스트는 사용자 PC 글로벌 미사용. Docker / CI / sandbox 격리 환경**

### D16 의 의도 재정의

v26.42~63 의 silent drift 는 모두 "사용자 무인지 글로벌 write". 사용자 mandate 의 핵심은 동일:

> **D16 의 본질 = 사용자 무인지 글로벌 write 금지.**
> 명시 opt-in (`--scope global` 또는 interactive 에서 Global 선택) 은 사용자 의식적 결정 → D16 의 본질 위배 아님.

따라서 NORTH_STAR.md D16 원문 "절대 미수정" 은 "사용자 명시 동의 없는 미수정" 으로 보강한다 (본 ADR 함께 NORTH_STAR.md 보강 PR).

## Decision

**모든 install 자산 (plugin / skill / Codex prompts / npm 자산) 디폴트 = Project scope. 사용자가 interactive prompt 또는 `--scope global` 로 명시 선택 시에만 Global write.**

### Scope semantics (자산 method 별)

Phase 1 (2026-05-18) 실 조사 결과 반영. claude/skills CLI 가 native `--scope` 옵션을 지원하므로 CLI 의 native 동작 그대로 사용.

| Method | Project scope (default) | Global scope (opt-in) | fs 격리 메커니즘 |
|--------|----------------------|---------------------|-----------------|
| `plugin` (claude plugin) | `claude plugin install --scope project <id>` + `claude plugin marketplace add --scope project <src>` | `claude plugin install --scope user <id>` | **fs 는 모든 scope 가 `~/.claude/plugins/cache/`** + `~/.claude/plugins/marketplaces/` 에 write (claude CLI 자체 디자인 — 변경 불가). 격리는 `~/.claude/plugins/installed_plugins.json` 의 `scope` + `projectPath` 매칭 |
| `skill` (npx skills) | `npx skills add <source>` (skills CLI default 가 이미 project) | `npx skills add <source> -g` | skills CLI native — project = `./node_modules` + agent dir, global = user-level. 진짜 격리 |
| `npm` (cli 도구) | `npm install --save-dev <pkg>` → `./node_modules/.bin/<cli>` | `npm install -g <pkg>` → `/usr/local/lib/node_modules/<cli>` | npm 표준. 진짜 격리 |
| `codex-prompts` | `.codex/prompts/uzys-*` (project dir 에 직접 write) | `~/.codex/prompts/uzys-*` | claude-harness 가 직접 fs write — 진짜 격리. 단 Codex CLI 가 `.codex/prompts/` 인식 여부는 Phase 3 (Docker) 에서 검증 후 보충 |
| `codex-skills` | `.codex/skills/uzys-*` (project) | `~/.codex/skills/uzys-*` | 동일 — claude-harness 가 직접 fs write |
| `codex-trust` | `.codex/config.toml` (project, 새 파일) | `~/.codex/config.toml` 의 `[projects.""]` block 추가 | 동일 |

> **claude plugin 의 fs 비대칭성**: `--scope project` 라도 fs 는 `~/.claude/plugins/cache/` 에 write. 이는 claude CLI 자체 디자인 (project local 폴더 미사용). 본 ADR 은 옵션 X 채택 (claude CLI native scope 그대로 사용, fs 격리 X, 메타데이터 격리 O). 사용자 mandate 2026-05-18 — D16 본질 ("사용자 무인지 write 금지") 충족.

### Interactive UI

```
◆  Installation scope
│  ● Project   (Install in current directory, committed with your project)
│  ○ Global    (Write to ~/.claude/, ~/.codex/, npm -g)
└

▸ SCOPE        PROJECT (default) — no global write
              Use `--scope global` to opt-in to ~/.claude/, ~/.codex/, npm -g
```

### Non-interactive 동작

| 입력 | 결과 |
|------|------|
| `--scope project` 명시 | Project |
| `--scope global` 명시 | Global |
| `--yes` (CI / 비대화형) | **Project (default)** |
| flag 없음 + interactive | prompt — Project pre-selected |

### ADR-012 / ADR-017 처리

- **ADR-012**: Status → Superseded by ADR-020. `cli=codex` 시 자동 글로벌 ON 동작 폐기.
- **ADR-017**: Status → Superseded by ADR-020. `cli=codex && withUzysHarness` coupling 도 폐기 (불필요 — 모든 자산 동일 정책).

## Alternatives

| 안 | 거부 사유 |
|---|---------|
| **A. D16 원문 엄격 — 글로벌 write 0** | 사용자 mandate 와 불일치. 또한 `~/.codex/` 가 Codex CLI 자체의 글로벌 기반 메커니즘이라 일부 자산 작동 불능 |
| **B. ADR-012/017 유지** | v26.42~63 silent drift 의 근본 원인. "cli 선택만으로 자동 글로벌" = 사용자 무인지 |
| **C. 본 결정 — Default=Project + Global opt-in** | D16 본질 (사용자 의식적 결정) + Codex 실용성 양립 |

## Consequences

### Positive
- 사용자 무인지 글로벌 write 0 (D16 본질 회복)
- 매 install 시 사용자가 scope 인지 — 회계 책임 명확
- install log + uninstall command 와 자연스럽게 결합 (project scope 자산은 자동 제거, global 은 안내만)
- 모든 자산 method 일관 정책 — 외워야 할 예외 0

### Negative (BREAKING)
- ADR-012/017 시점의 default (`cli=codex && withUzysHarness` → 자동 글로벌) 가 v26.64.0 부터 Project 로 변경
- 기존 사용자 영향: `--scope global` 명시 안 하면 `~/.codex/prompts/` 자동 업데이트 중단
- Codex CLI 의 project-scope 미지원이 확인되면 Codex 자산 사용자가 매 install 시 `--scope global` 의식적 선택 필요

### Migration
- README + CHANGELOG 안내: "v26.64.0 부터 default = Project. Codex 슬래시는 `--scope global` 또는 interactive 에서 Global 선택"
- 기존 `~/.codex/prompts/uzys-*` 는 prune 안 함 (D16 — 글로벌 영역 자동 삭제 금지). 사용자 수동 또는 uninstall command 의 안내

### 검증 (AC)

Docker 컨테이너 안에서 (사용자 PC 글로벌 무영향):

- **install --scope project**:
  - `~/.claude/skills/`, `~/.codex/`, `~/.opencode/`, `npm root -g` 의 fs diff = 0
  - `~/.claude/plugins/cache/` 와 `~/.claude/plugins/marketplaces/` 는 write 발생 (claude CLI 자체 디자인). 검증: `~/.claude/plugins/installed_plugins.json` 의 새 entry 가 모두 `scope: "project"` + 현재 `projectPath` 일치, 다른 projectPath 에서 plugin 미노출
- **install --scope global**: 매트릭스 정의대로 정확히 write (`scope: "user"` entry 추가, `npm -g` 에 패키지 추가, `~/.codex/` 에 파일 생성 등)
- **uninstall**: log 기반 reverse. project scope 자산만 자동 제거 (claude plugin 은 `claude plugin uninstall --scope project <id>` 호출, npm devDep 은 `npm uninstall`, codex/skills 는 fs rm). global scope 자산은 안내만 (D16 — 자동 삭제 금지)

## Notes

본 ADR 은 사용자 mandate (2026-05-18) 의 직접 산물. `docs/PRD/v26-64-project-scope-only.md` 의 Phase 1.4 결정 (사용자 결정 필요) 의 답.

NORTH_STAR.md D16 의 본문 "절대 미수정" → "사용자 명시 동의 없는 미수정" 으로 보강하는 PR 함께 진행 (본 ADR 머지와 동일 PR).

# SPEC: Codex CLI 풀 하네스 복제 (1차)

> **Status**: Accepted (2026-04-24) — 사용자 승인 완료
> **Scope**: Multi-CLI — 1차 Codex (OpenAI Codex CLI). 2차 OpenCode는 Non-Goals에 명시 후 후속 SPEC.
> **Relation**: 본 SPEC은 `docs/SPEC.md` (Phase 1 Finalization)와 **독립 스펙**. spec-scaling 룰 적용 — `docs/specs/` 하위.

---

## 1. Objective

현재 하네스(Claude Code 전용)를 **OpenAI Codex CLI에서도 동일 워크플로우로 사용** 가능하게 만든다. Claude Code가 SSOT이며 Codex 자산은 transform/generator로 파생된다.

**3가지 결과**:

1. **Codex 설치 파이프라인**: `setup-harness.sh --cli=codex --track <t>` 명령 하나로 Codex 프로젝트 구성.
2. **6-gate 워크플로우 이식**: `/uzys-spec`~`/uzys-ship` 6개 skill이 Codex에서 작동.
3. **SSOT 분리**: 공통 docs/rules/skills는 1회 작성, CLI별 렌더링 자동화. 유지 비용 최소화.

## 2. 판단 기준 (불변)

NORTH_STAR §5 4-gate + CLAUDE.md P2(Simplicity First) 우선.

### 완료 조건 (AC)

- **AC1**: `scripts/setup-harness.sh --cli=codex --track tooling --project-dir <tmp>` 무인 실행 exit=0 + `AGENTS.md` + `~/.codex/config.toml`(프로젝트 스코프 아님 — **아래 OQ4 참조**) 또는 프로젝트 `.codex/config.toml` 생성 검증.
- **AC2**: 9 Track 중 최소 **tooling + csr-fastapi 2종** Codex 설치 검증. 성공률 100% (2/2).
- **AC3**: 6 skill (`uzys-spec`, `uzys-plan`, `uzys-build`, `uzys-test`, `uzys-review`, `uzys-ship`) Codex에서 slash 호출 가능 + SKILL.md 동일 포맷 재사용.
- **AC4**: MCP 서버 최소 2종(context7, github) Codex `config.toml` `[mcp_servers.X]`에 생성 + 실제 접속 smoke test 통과.
- **AC5**: Hook 포맷 변환 규약 확정 + 2가지 제약 문서화 (Issue #16732 ApplyPatch 미발화, Issue #17532 인터랙티브 세션 bug) — `docs/decisions/ADR-002-codex-hook-gap.md` v2. ApplyPatch protect 경로는 `sandbox_mode` + `approval_policy`로 이관 검증.
- **AC6**: Claude Code 현행 동작 regression 0 — `tests/test-harness.sh` 149 total 유지 (Pass 144 / Fail 0 / Skip 5).

### 판정 절차

1. AC별 증거 = 파일 경로 + 커밋 SHA + 실행 결과 로그.
2. 에이전트 자기주장 불가. 최소한 무인 설치 로그를 `docs/evals/codex-install-YYYY-MM-DD.md`에 기록.

## 3. 결정 일람

### 3.1 포함 (In Scope)

| ID | 작업 | 근거 | 우선순위 |
|----|------|------|---------|
| **F1** | Claude Code ↔ Codex 호환 매트릭스 문서화 — `docs/research/codex-compat-matrix-2026-04-24.md` | 리서치 결과 정리 (본 세션에서 이미 수행) | P0 |
| **F2** | `templates/codex/` 디렉토리 설계 — AGENTS.md 마스터/계층, config.toml 템플릿, rules/*.rules 실행 정책, skills ported | 구조 고정 | P0 |
| **F3** | Transform 스크립트 `scripts/claude-to-codex.sh` — CLAUDE.md→AGENTS.md, .mcp.json→[mcp_servers], .claude/rules/*.md→AGENTS.md 계층, .claude/commands/uzys→slash+skill | Generator 기반 SSOT | P0 |
| **F4** | `setup-harness.sh --cli={claude,codex}` 플래그 도입 (기본 claude, regression 0) + `--cli=codex` 경로 구현 | 배포 통로 | P1 |
| **F5** | 6 uzys skill을 SKILL.md 포맷으로 일반화 — Claude/Codex 공용. slash name은 CLI별 prefix 처리 (`uzys:` vs `uzys-`) | 동일 워크플로우 | P1 |
| **F6** | MCP 변환 — `.mcp.json` → `config.toml` `[mcp_servers.X]` + auth 환경변수 매핑 | MCP 호환 | P1 |
| **F7** | Hook 갭 ADR-002 + 우회 — HITO는 shell wrapper, gate-check는 workflow 내 가드, spec-drift-check은 skill 내부 sanity check | 핵심 갭 명시 | P1 |
| **F8** | Codex dogfood 2 Track 설치 + 무인 로그 리포트 | 실측 검증 | P2 |
| **F9** | Codex 설치 문서(README.codex.md 섹션 추가) — "Codex CLI 사용자 시작 가이드" | 사용자 온보딩 | P2 |

### 3.2 제외 (Non-Goals)

- **OpenCode 지원** — 2차 타깃. 본 SPEC 완료 + ADR-003로 OpenCode 진입 결정 후 별도 SPEC.
- **Hook 1:1 동일성** — Codex의 `[notify]` 하나만으로 Pre/Post/UserPromptSubmit 완전 재현 불가. 갭 명시로 대신.
- **새 Track 추가** — 현 9 Track 구조 유지. Codex 전용 Track 신설 금지.
- **외부 Codex 사용자 영입** — dogfood 수준만. Phase 2 entry checklist 외 이월.
- **Hook wrapper 독자 런타임 구현** — 별도 데몬/에이전트 프로세스 만들지 않음. shell wrapper + Codex 기본 `[notify]` 선에서 해결.
- **Claude Code 기능 축소** — Codex에 없다고 Claude Code 측 삭제 금지. SSOT는 Claude Code.

### 3.3 DO NOT CHANGE

- `docs/SPEC.md` 현행 Phase 1 Finalization AC1~AC5
- `docs/NORTH_STAR.md` §1~5
- `tests/test-harness.sh` 149 total (Pass 144 / Fail 0 / Skip 5)
- `.claude/` 현행 구조 (setup-harness.sh 기본 경로)
- `~/.claude/` 글로벌 (D16 보호)
- Claude Code 기존 `/uzys:*` slash prefix (본 SPEC에서 변경 금지)

### 3.4 판단 보류 (Open Questions) — 2026-04-24 실측 업데이트

| OQ | 상태 | 결정/근거 |
|----|------|-----------|
| **OQ1** `child_agents_md` 기본 활성 | **Closed — 비활성** | `codex features list` 실측. `under development, disabled`. 본 SPEC은 계층 merge 없이 `~/.codex/AGENTS.md` 글로벌 + 프로젝트 `AGENTS.md` 2단만 가정 |
| **OQ2** 글로벌 vs 프로젝트 스코프 | **Closed — 2단 공식 규약** | 글로벌 `~/.codex/config.toml` + 프로젝트 `./.codex/config.toml` (upward search). 프로젝트는 글로벌에 `[projects."..."] trust_level="trusted"` 등록 필요. `setup-harness.sh --cli=codex`가 확인 프롬프트로 등록 (ADR-002 D4) |
| **OQ3** slash prefix | **Closed — `uzys-*`** | Codex slash namespace 없음. `/uzys-spec, /uzys-plan, ...` 형태 |
| **OQ4** skills 저장 경로 | **Closed — `~/.codex/skills/`** | 공식 `$CODEX_HOME/skills` 관례. plugin 번들 시 `<plugin>/skills/`로 이동 (F9 선택지) |
| **OQ5** Hook 우회 범위 | **Resolved — 우회 불필요** | Codex 0.124.0 `codex_hooks=stable` 실측. 포맷 변환(TOML ↔ JSON)만 필요. ADR-002 v2 참조. ApplyPatch 예외만 sandbox로 이관 (Issue #16732) |
| **OQ6** subagent SOD | **Closed — 가능** | `multi_agent=stable, enabled`. `spawn_agent / wait_agent / close_agent` 공식 지원. Claude `context: fork` 대응 |

**현행(2026-10-11, #724)**: 설치 템플릿 `config.toml.template` 은 `[features]` 표를 쓰지 않는다. 위 OQ1 · OQ5 · OQ6 의
기능은 Codex 기본값(true)이고, 옛 템플릿의 `codex_hooks`(deprecated — 정식 이름 `hooks`) · `child_agents_md`(레지스트리에 없는 키)는
매 세션 경고만 만들었다. 갈아 끼우지 못한 옛 구간에 두 키가 남으면 install · update 화면이 지울 자리를 말한다.

**신규 OQ (Phase F 이후 결정)**:

- **OQ7**: Issue #17532 (인터랙티브 세션에서 프로젝트 hook 무시) 현재 버전 영향 여부 → Phase F 실측
- **OQ8**: Plugin 번들 배포(uzys-harness as Codex plugin) 채택 여부 → F9에서 사용자 결정

## 4. Phase 분해

- **Phase A — 호환 매트릭스 + ADR** (F1, 부분 F7): 리서치 정리 + Hook 갭 ADR 초안. (0.5일)
- **Phase B — 구조 설계** (F2, OQ 1/2/4 결정): `templates/codex/` 레이아웃 + AGENTS.md 계층 + config.toml 스키마. (1일)
- **Phase C — Transform 구현** (F3, F5, F6): `scripts/claude-to-codex.sh` + skills 포맷 정규화 + MCP 변환. (1.5일)
- **Phase D — Setup integration** (F4): `setup-harness.sh --cli` 플래그 + 무인 설치 파이프라인. (1일)
- **Phase E — Hook 갭 확정** (F7 완료, ADR-002 merge): 우회 스크립트 + skill 내부 가드. (0.5일)
- **Phase F — Dogfood 2 Track** (F8, AC2 검증): 무인 설치 + smoke test. (0.5일)
- **Phase G — 문서화** (F9): README 섹션 + 사용자 가이드. (0.5일)

**총 예상**: ~5.5일 (병렬 고려 시 단축 가능).

병렬 관계:
- A/B 직렬 (B가 A 결과 소비)
- C/D는 B 완료 후 병렬 가능
- E는 C와 병렬 (ADR은 코드와 독립)
- F는 D/E 완료 후
- G는 F 완료 후

## 5. 위험 & 완화

| Risk | 완화 |
|------|------|
| Codex `child_agents_md` flag 비활성 기본 → AGENTS.md 계층 작동 안 함 | Phase B pre-flight 게이트. 비활성 시 설치 경고 + flag 활성화 안내 |
| Slash namespace 미지원으로 `/uzys:*` 일괄 rename 필요 → docs drift | Phase C transform 스크립트가 rename 자동. 문서는 CLI별 생성 섹션 |
| Hook 갭이 실제 사용에서 치명적(HITO 측정 안 됨 등) | Phase E에서 shell wrapper 우회. 치명적이면 OpenCode로 2차 타깃 조정(플러그인 API 풍부) |
| MCP 인증 플로우(OAuth 등) Codex에서 차이 | F6 범위에 "접속 smoke test"만. 고급 인증은 별도 ADR |
| Transform 스크립트가 Claude Code 원본 변경에 fragile | Phase C에서 "Claude Code 변경 시 재실행 필요" 명시 + CI 후속 항목 (본 SPEC 범위 밖) |

## 6. Self-Audit Hooks

각 Phase 완료 시 CLAUDE.md P11 Self-Audit 5항목 실행. 결과 `docs/evals/codex-phase-<X>-YYYY-MM-DD.md`에 기록.

## 7. Sprint Contract 승인 기록

2026-04-24 사용자 승인. Status: Draft → **Accepted**.

승인 시점 결정사항:
- OQ3 slash prefix: **`uzys-spec` 형식 채택** (Codex namespace 미지원 대응)
- OQ4 skill 저장 경로: **`~/.codex/skills/`** (공식 `$CODEX_HOME/skills` 관례)
- `setup-harness.sh --cli=claude` **기본값 유지**, `--cli=codex` 옵션 추가 — 기존 사용자 regression 0
- 남은 OQ1/OQ2/OQ5/OQ6 → Phase B 실측 + ADR-002로 확정

Phase A 착수.

---

## Changelog

- 2026-04-24: 초안 작성. 근거 — 사용자 요청(Codex 1차 타깃, 풀 하네스 복제, SSOT는 Claude Code, 단독 dogfood 사용자) + Context7 리서치(`/openai/codex`, `/luohaothu/everything-codex`, `/anomalyco/opencode`, `/websites/opencode_ai_plugins`).

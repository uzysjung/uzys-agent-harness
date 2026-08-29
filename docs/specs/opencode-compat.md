# SPEC: OpenCode CLI 풀 하네스 복제 (2차)

> **Status**: Accepted (2026-04-25) — 사용자 승인 완료
> **Scope**: Multi-CLI 2차 — OpenCode CLI (`anomalyco/opencode`). 1차 Codex(`docs/specs/codex-compat.md`, v26.37.0 완료)와 독립.
> **Relation**: 본 SPEC은 `docs/SPEC.md` (Phase 1 Finalization)와 **독립 스펙**. spec-scaling 룰 적용 — `docs/specs/` 하위. Codex 1차 산출물 재사용 가능 영역(`scripts/claude-to-codex.sh`의 5-단 transform 패턴, AGENTS.md 구조)은 명시.

---

## 1. Objective

현재 하네스(Claude Code SSOT + Codex 파생)에 **OpenCode CLI 호환**을 추가한다. Claude Code가 SSOT, OpenCode는 transform/plugin으로 파생.

**3가지 결과**:

1. **OpenCode 설치 파이프라인**: `claude-harness install --cli=opencode --track <t>` 명령 하나로 OpenCode 프로젝트 구성.
2. **6-gate 워크플로우 이식**: `/uzys-spec`~`/uzys-ship` 6개 skill이 OpenCode에서 작동 (Codex 1차 결정 OQ3 일관성 — slash prefix `uzys-`).
3. **Plugin 기반 Hook 매핑**: OpenCode의 풍부한 plugin lifecycle API(`tool.execute.before/after`, `event`)로 Claude Hook 직접 대응 — Codex의 shell wrapper 우회 불필요.

## 2. 판단 기준 (불변)

NORTH_STAR §5 4-gate + CLAUDE.md P2(Simplicity First) 우선.

### 완료 조건 (AC)

- **AC1**: `claude-harness install --cli=opencode --track tooling --project-dir <tmp>` 무인 실행 exit=0 + `AGENTS.md` + `opencode.json` + `.opencode/` (commands/agent/plugin) 생성 검증.
- **AC2**: 9 Track 중 **tooling + csr-fastapi 2종** OpenCode 설치 검증. 성공률 100% (2/2).
- **AC3**: 6 skill (`/uzys-spec` ~ `/uzys-ship`) OpenCode에서 slash 호출 가능. SKILL.md 또는 OpenCode `command/*.md` 포맷 재사용 (Codex 산출물과 90% 이상 공유).
- **AC4**: MCP 서버 최소 2종(context7, github) `opencode.json` `mcp.X`에 생성 + 실제 접속 smoke test 통과.
- **AC5**: `uzys-harness-opencode-plugin` JS/TS plugin 1개 — Claude Hook 3종(HITO `UserPromptSubmit`, gate-check `PreToolUse`, spec-drift `PostToolUse`) 매핑 + plugin 무인 로드 + smoke test 통과. 결과 `docs/decisions/ADR-004-opencode-plugin-mapping.md` 작성.
- **AC6**: Claude Code + Codex 현행 동작 regression 0 — Codex 1차 산출물(`templates/codex/`, `scripts/claude-to-codex.sh`) 미수정 + 9 Track 192 test 유지.

### 판정 절차

1. AC별 증거 = 파일 경로 + 커밋 SHA + 실행 결과 로그.
2. 에이전트 자기주장 불가. 무인 설치 + plugin 로드 로그를 `docs/evals/opencode-install-YYYY-MM-DD.md`에 기록.

## 3. 결정 일람

### 3.1 포함 (In Scope)

| ID | 작업 | 근거 | 우선순위 |
|----|------|------|---------|
| **F1** | Claude Code ↔ OpenCode 호환 매트릭스 — `docs/research/opencode-compat-matrix-2026-04-25.md` (Codex matrix와 비교 표 포함) | 리서치 결과 정리 | P0 |
| **F2** | `templates/opencode/` 디렉토리 설계 — AGENTS.md(Codex 산출물 재사용), `opencode.json` 템플릿, `.opencode/commands/*.md`, plugin 번들 위치 | 구조 고정 | P0 |
| **F3** | Transform 통합 — Codex의 `scripts/claude-to-codex.sh` 패턴을 TS CLI(`src/codex/`)에 추가한 것처럼, **`src/opencode/`** 모듈 신설. 입력: SSOT (CLAUDE.md, .mcp.json, .claude/rules/*, .claude/commands/uzys/*). 출력: `AGENTS.md`(Codex와 동일 형식) + `opencode.json` + `.opencode/commands/*.md` + plugin scaffold | Generator 기반 SSOT | P0 |
| **F4** | TS CLI `--cli` 옵션 확장 — 현재 `claude / codex / both` → `claude / codex / opencode / all`. 기본값 `claude` 유지(regression 0). 인터랙티브 모드에 OpenCode 분기 추가 | 배포 통로 | P1 |
| **F5** | 6 uzys skill OpenCode 포맷 매핑 — Codex의 `~/.codex/skills/` 패턴 대신 **프로젝트 스코프 `.opencode/commands/*.md`**로 슬래시 노출. SKILL.md 본문은 그대로 재사용 | D16 정신 + 글로벌 미수정 | P1 |
| **F6** | MCP 변환 — `.mcp.json` → `opencode.json` `mcp.<name>` (1:1 가까운 매핑). auth 환경변수 매핑 동일 | MCP 호환 | P1 |
| **F7** | **Plugin 작성 — `uzys-harness-opencode-plugin`** | 핵심 차별화 | P1 |
| | (a) `tool.execute.before` → PreToolUse hook 매핑 (gate-check) | | |
| | (b) `tool.execute.after` → PostToolUse hook 매핑 (spec-drift-check) | | |
| | (c) `event` (session.idle, prompt.submit) → UserPromptSubmit hook 매핑 (HITO 카운터) | | |
| | (d) ADR-004로 매핑 규약 + 한계 문서화 | | |
| **F8** | OpenCode dogfood 2 Track 설치 + plugin 로드 smoke test + 무인 로그 리포트 | 실측 검증 | P2 |
| **F9** | OpenCode 설치 문서 — `README.md` "OpenCode CLI support" 섹션 + `README.ko.md` 동일 + `docs/USAGE.md` OpenCode 사용 시나리오 | 사용자 온보딩 | P2 |
| **F10** | **README/USAGE 일괄 청소** — Phase G 마지막에 v0.2.0 CLI rewrite 시 누락된 stale `setup-harness.sh` 참조(영문 9곳 + 한국어 10곳) 일괄 정리 | OpenCode 완료 시 묶음 처리 (사용자 결정 2026-04-25) | P2 |

### 3.2 제외 (Non-Goals)

- **Codex 후속 OQ7/OQ8** — Issue #17532 라이브 검증, plugin 번들 배포 결정. 본 SPEC 완료 후 별도 처리.
- **OpenCode 전용 Track 추가** — 현 9 Track 구조 유지.
- **Plugin 외 globe 범위 변경** — `~/.opencode/` 절대 미수정 (D16 정신). 모든 자산 프로젝트 스코프.
- **Plugin npm publish** — 본 SPEC은 로컬 plugin 번들만. npm/jsr 배포는 별도 ADR.
- **외부 OpenCode 사용자 영입** — dogfood 수준만. Phase 2 entry checklist 외 이월.
- **Claude Code / Codex 기능 축소** — OpenCode에 없다고 SSOT 측 삭제 금지. SSOT는 Claude Code.

### 3.3 DO NOT CHANGE

- `docs/SPEC.md` 현행 Phase 1 Finalization AC1~AC5
- `docs/NORTH_STAR.md` §1~5
- `docs/specs/codex-compat.md` 본문 (Codex 1차 SPEC)
- `templates/codex/` 산출물 + `src/codex/` TS 모듈
- `scripts/claude-to-codex.sh` 잔존(폐기 예정 명시되었으나 본 SPEC에서 제거 금지)
- `tests/` 현행 192 test (Codex + Claude regression 보존)
- `.claude/` 현행 구조
- `~/.claude/` / `~/.codex/` / `~/.opencode/` 글로벌 (D16 보호)
- v0.2.0 CLI rewrite 산출물 (`src/cli.ts`, `src/interactive.ts`, `src/commands/install.ts`)

### 3.4 판단 보류 (Open Questions)

| OQ | 상태 | 결정/근거 |
|----|------|-----------|
| **OQ1** Hook 매핑 전략 | **Closed — Plugin (a)** | OpenCode plugin API가 풍부(`tool.execute.before/after`, `event`) → Codex의 shell wrapper 우회 불필요. JS/TS plugin이 SSOT 매핑 단순. 사용자 승인 2026-04-25 |
| **OQ2** Slash prefix | **Open** | (a) `/uzys-spec` (Codex와 동일 — namespace 부재 시 안전) / (b) `/uzys:spec` (OpenCode가 콜론 허용 시). Phase B 실측 후 결정. 1차 가정 (a) |
| **OQ3** Dogfood 범위 | **Closed — tooling + csr-fastapi** | Codex와 동일 2 Track. 비교 가능성 유지. 사용자 승인 2026-04-25 |
| **OQ4** SPEC 범위 | **Closed — 풀 하네스 복제** | Codex와 동등 패턴. 사용자 요청 명시. 사용자 승인 2026-04-25 |
| **OQ5** Plugin 배포 형식 | **Open** | (a) `templates/opencode/.opencode/plugins/` 로컬 번들 → 설치 시 프로젝트 `.opencode/plugins/`로 복사 / (b) git submodule / (c) npm publish 후 install. 1차 (a). npm은 후속 ADR (Codex OQ8과 동일 패턴) |
| **OQ6** OpenCode-Skills plugin 의존 | **Closed (2026-08-29, ADR-081)** — 플러그인 불요. OpenCode 1.18.23 이 프로젝트 스코프 `.agents/skills/**/SKILL.md` 를 자동 로드한다(실측, 대조군 포함). 번들 스킬을 커맨드로 변환하던 것을 폐지하고 codex·antigravity 와 같은 자리로 보낸다. |

## 4. Phase 분해

- **Phase A — 호환 매트릭스 + ADR 초안** (F1, 부분 F7): OpenCode plugin API 정밀 리서치(Context7 `/anomalyco/opencode` + `/websites/opencode_ai_plugins`) + Hook 매핑 ADR-004 v1. (0.5일)
- **Phase B — 구조 설계** (F2, OQ 2/5/6 결정): `templates/opencode/` 레이아웃 + `opencode.json` 스키마 + plugin 번들 위치 결정. 슬래시 prefix 실측. (1일)
- **Phase C — Transform 구현** (F3, F5, F6): TS CLI `src/opencode/` 모듈 + skills 포맷 정규화 + MCP 변환. Codex 모듈 패턴 재사용. (1.5일)
- **Phase D — Setup integration** (F4): TS CLI `--cli=opencode` + `--cli=all` 분기 + 인터랙티브 모드 OpenCode 옵션 추가 + 무인 설치 파이프라인. (1일)
- **Phase E — Plugin 작성** (F7 완료, ADR-004 Accepted): `uzys-harness-opencode-plugin` JS/TS — 3종 hook 매핑 + smoke test + plugin 로드 검증. (1일)
- **Phase F — Dogfood 2 Track** (F8, AC2/AC5 검증): 무인 설치 + plugin 로드 + slash 호출 smoke test. (0.5일)
- **Phase G — 문서화 + 청소** (F9, F10): README en/ko + USAGE OpenCode 섹션 + **stale `setup-harness.sh` 참조 19곳(en 9 + ko 10) 일괄 청소**. (0.5일)

**총 예상**: ~6일 (병렬 고려 시 단축).

병렬 관계:
- A/B 직렬 (B가 A 결과 소비)
- C/D 병렬 가능 (B 완료 후)
- E는 C와 병렬 (plugin은 transform과 독립)
- F는 D/E 완료 후
- G는 F 완료 후

## 5. 위험 & 완화

| Risk | 완화 |
|------|------|
| OpenCode plugin lifecycle 이벤트가 Claude hook 종류와 1:1 매핑 안 됨 | Phase A에서 매핑 표 작성. 갭 발견 시 ADR-004에 명시 + 대체 전략(예: bash hook 직접 호출) |
| `opencode.json` 스키마가 빠르게 변경 | Phase B에서 `$schema` 버전 고정 + Phase G 문서에 호환 OpenCode 버전 명시 |
| Codex 1차 산출물(`templates/codex/`, `src/codex/`)과 코드 충돌 | F4 분기 로직에 `--cli` 분기 명확화. AC6에 regression 0 명시. CI matrix로 보호 |
| Plugin smoke test가 OpenCode CLI 없이 불가 | Phase E에서 OpenCode CLI 설치 단계 명시. CI에서 OpenCode brew/npm 설치 후 plugin 로드 |
| stale `setup-harness.sh` 참조 청소가 OpenCode docs와 충돌 | Phase G에서 청소 + OpenCode 섹션 추가 동일 PR로 묶음 — drift 방지 |

## 6. Self-Audit Hooks

각 Phase 완료 시 CLAUDE.md P11 Self-Audit 5항목 실행. 결과 `docs/evals/opencode-phase-<X>-YYYY-MM-DD.md`에 기록.

## 7. Sprint Contract 승인 기록

2026-04-25 사용자 승인 단계:

- OQ1 Plugin 전략: **(a) JS/TS plugin** 채택
- OQ3 Dogfood: **tooling + csr-fastapi** (Codex와 동일)
- OQ4 SPEC 범위: **풀 하네스 복제** (Codex 동등)
- OQ3(폐기) 글로벌 위치: **`~/.opencode/` 절대 미수정** (D16 정신 — Codex 1차 ADR-002 D4 일관성)
- OQ2 slash prefix / OQ5 plugin 배포 / OQ6 community plugin 의존: Phase B 실측 후 결정

2026-04-25 사용자 최종 승인 — Status: Draft → **Accepted**. Phase A 착수.

---

## Changelog

- 2026-04-25: 초안 작성. 근거 — 사용자 요청(OpenCode 2차 진입, Codex 1차 v26.37.0 완료 후속) + Context7 리서치(`/anomalyco/opencode`, `/websites/opencode_ai_plugins`, `/kdcokenny/opencode-workspace`, `/malhashemi/opencode-skills`).
- 2026-04-25 (Clarification CR): Phase B2 실측 결과 디렉토리명 정정 — `.opencode/command/` → `.opencode/commands/`, `templates/opencode/plugin/` → `templates/opencode/.opencode/plugins/`. OpenCode 공식 규약(plural directory) 일치. 합의된 내용의 구체화이므로 Major CR 불필요.

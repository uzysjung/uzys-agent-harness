# uzys-agent-harness

**기술 스택에 실제로 필요한 AI 코딩 스킬·플러그인만 골라, 한 번의 명령어로 Claude Code · Codex · OpenCode · Antigravity 에 세팅한다 — 아이디어부터 출시까지 에이전트가 탈선하지 않게 잡아주는 라이프사이클 규율과 함께.**

코딩 에이전트는 기본기가 계속 강해지고 있다 — 안 쓸 스킬과 MCP 를 쌓으면 컨텍스트 창만 부풀고, awesome-list 는 내 프로젝트에 맞는 것을 일일이 고르기엔 선택지가 너무 많다. `agent-harness` 는 두 가지를 한다:

1. **스택 기반 lean 큐레이션** — 검증된 옵션 중에서, 이 프로젝트에 실제로 필요한 것만 설치.
2. **규율 레이어(discipline layer)** — 실제 프로덕션 프로젝트를 에이전트로 운영하며 증명된 룰·훅·CI 스캐폴드: 문서 거버넌스, 검증 게이트, 벤치마크 패리티 루프, 재발 방지. 이 규율 레이어 덕분에 이 도구는 단순한 스킬 모음이 아니라 *하네스*가 된다 ([상세 ↓](#규율-레이어--무엇이-하네스인가)).

**Claude Code 는 전체 지원(모든 자산·훅·플러그인); Codex / OpenCode / Antigravity 는 skills + rules 레이어를 받는다.** 디폴트는 project scope — 명시적으로 선택하지 않는 한 글로벌 영역 미수정.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/github/v/tag/uzysjung/uzys-agent-harness?label=version)](https://github.com/uzysjung/uzys-agent-harness/releases)
[![CI](https://github.com/uzysjung/uzys-agent-harness/actions/workflows/test.yml/badge.svg)](https://github.com/uzysjung/uzys-agent-harness/actions)

![agent-harness 데모 — 검증된 AI 코딩 스킬·플러그인 원커맨드 설치](https://raw.githubusercontent.com/uzysjung/uzys-agent-harness/main/docs/assets/agent-harness-demo.gif)

> **"vetted(검증됨)"의 의미** — GitHub star ≥ 1000 + 활성 유지보수 + Docker 격리 실설치 검증(현재 51/65 자산 green), 월간 CI cron 재검증([catalog-verify](docs/COMPATIBILITY.md), [trust-tier-drift](.github/workflows/)). 자산 코드의 라인 단위 보안 감사나 prompt-injection 스캔까지 보장하는 것은 **아니다**. npm/npx 자산은 버전 고정; **plugin/skill 자산은 upstream HEAD 로 설치(commit-pin 아직 없음)**. 설치 자산은 서드파티 의존성처럼 취급할 것 — [SECURITY.md](SECURITY.md) 참고.

🇺🇸 [English](./README.md)

---

## 설치

```bash
npx -y @uzysjung/agent-harness
```

6-step interactive wizard 가 안내한다. flag 필요 없음. **기존 프로젝트에도 안전** — `settings.json` / `CLAUDE.md` 는 변경 전 백업(아래 상세); 아무것도 삭제하지 않는다.

```
Step 1/6  Tracks            ← 스택 선택
Step 2/6  CLI               ← claude / codex / opencode / antigravity
Step 3/6  Install items     ← 추천 항목 (pre-checked) 확인
Step 4/6  Scope             ← Project (default) 또는 Global
Step 5/6  Confirm
Step 6/6  Installing
```

설치 후:

```bash
claude    # CLI 실행 — 설치된 skills · rules · hooks 가 바로 활성화됨
```

### 비대화형 설치 (CI / 스크립트 / Docker)

wizard 는 TTY 가 필요하다. CI 파이프라인·온보딩 스크립트·컨테이너에서는 flag 사용 — 우리 자체 검증 CI 가 도는 것과 같은 경로다:

```bash
npx -y @uzysjung/agent-harness install \
  --track tooling --cli claude --scope project \
  --with bmad-method
```

| Flag | 의미 |
|------|---------|
| `--track <name>` | 설치할 트랙 (반복 가능) |
| `--cli <target>` | `claude` / `codex` / `opencode` / `antigravity` (반복 가능) |
| `--scope <s>` | `project` (기본) 또는 `global` |
| `--with <asset-id>` / `--without <asset-id>` | 카탈로그 자산 id 로 추가/제외 (반복 가능) — id 는 [호환 매트릭스](docs/COMPATIBILITY.md) |

---

## 큐레이션 철학 — lean by default

프론티어 코딩 모델은 스킬 팩이 가르치던 것을 계속 흡수하고 있다. 우리의 입장: **스킬은 자신이 차지하는 컨텍스트 비용 이상의 가치를 증명해야 한다** — 설치된 스킬은 안 쓰일 때도 에이전트의 어텐션을 점유하므로, 기본 설치는 최소로 유지하고 "스킬이 많음"은 기능이 아니라 비용으로 취급한다.

여전히 가치 있다고 믿는 것은 지식 레이어가 아니라 **인사이트 레이어**다:

- **오케스트레이션 노하우** — 모델/effort 역할 분담(`model-orchestration`), 다관점 검증(`multi-persona-review`), 자기 하네스 감사(`harness-health-audit`).
- **크로스-CLI 레버리지** — CLI 별 강점 활용: 자연스러운 산문은 Antigravity(`gemini-consult`), 간결한 구조화 + 이미지 생성은 Codex(`codex-consult`).
- **운영 사실(operational facts)** — CLI flag·인증 흐름·배포 절차(`supabase-cli`, `railway-skills`, …)는 모델이 아무리 똑똑해져도 upstream 릴리즈와 함께 drift 한다. 범용 패턴 가이드가 가장 먼저 불필요해진다.

구조화 워크플로 번들(superpowers, BMAD, OpenSpec, …)은 **opt-in 유지, pre-check 안 함**. 우리 관점: 강한 모델에는 애자일한 방향 + 확고한 git/PR 정책이 강제된 절차보다 낫다(솔로/그린필드 기준) — 단 다수 개발자 간 의견 정렬·주니어 온보딩·감사 추적은 모델 업그레이드로는 해결되지 않는 조직의 문제라, 선택은 사용자의 몫으로 열어둔다([워크플로 큐레이션 가이드](docs/WORKFLOWS.md)).

v26.103.0 부터 설치기는 선택 항목의 **세션 시작 컨텍스트 비용**을 표시한다(번들 스킬은 실측, 외부 자산은 정직하게 unmeasured 표기).

---

## 규율 레이어 — 무엇이 하네스인가

큐레이션 자산은 설치의 절반이다. 나머지 절반은 **프로젝트 라이프사이클 규율** — 우리 프로덕션 프로젝트에서 증명된 룰·훅·스캐폴드를 도메인 중립으로 일반화한 것이다. 에이전트가 실제로 도는 루프를 커버한다 — 방향 → 문서 → 테스트/CI → 검증 → 실브라우저 → 재발 방지:

| 라이프사이클 단계 | 설치물 | 강제하는 것 |
|---|---|---|
| **방향** | `north-star` 스킬 (전 트랙) + `northstar-roadmap` ★ | 비전 문서 → 갭 실측 → 랭킹된 백로그 |
| **문서 거버넌스** | `doc-governance` 룰 (전 트랙) + `spec-drift-check` 훅 | SSOT 위계, "머지 = 코드 **그리고** 추적 동기화", 현행/archive 분리 |
| **딜리버리** | `git-policy` · `change-management` · `gates-taxonomy` 룰 (전 트랙) | conventional commits, 핵심 결정의 ADR 화, 게이트 4유형 |
| **테스트 → CI** | `test-policy` 룰 (dev 트랙) + `ci-scaffold` (opt-in) | 커버리지 threshold, TDD, 실DB CI 템플릿(`.github/workflows/`) |
| **검증** | `reviewer` 에이전트 + `multi-persona-review` ★ | 구현자 ≠ 검증자; 출하 전 다관점 리뷰 |
| **실브라우저 검증** | `playwright-launch` + `benchmark-parity` 룰 (UI 트랙) | 영속 profile capture, 갭 매트릭스(`gap.md`), PR `## Fidelity` 증거 |
| **재발 방지** | `recurrence-prevention` ★ (dev 트랙) | 반복 결함 → 에스컬레이션: 기록 → 강제 룰 → 구조적 게이트 |

전부 가볍고 예측 가능하게 동작한다 — 레일은 고정하되 그 안에서 에이전트는 유연하게 움직인다. ★ = 1st-party dev-method 스킬.

---

## 기존 프로젝트에 설치

`agent-harness` 는 설정을 조용히 덮어쓰지 않는다. 내용이 다른 **편집 가능** 파일을 교체하기 전에 타임스탬프 백업을 만들고, 모든 백업 경로를 설치 요약에 출력한다(`backup` 행). 아무것도 삭제되지 않는다.

| 이미 있는 것 | 처리 |
|---|---|
| 자체 hooks / statusLine 이 있는 `.claude/settings.json` | 갱신 전 `settings.json.backup-<ts>` 로 백업 |
| 루트 `CLAUDE.md` (생성본과 다른 경우) | 병합 write 전 `CLAUDE.md.backup-<ts>` 로 백업 |
| `--reinstall` / `update` 모드의 `.claude/` | 디렉토리 전체를 먼저 `.claude.backup-<ts>` 로 rename |
| `.mcp.json` | 기존 MCP 서버 보존·병합 (교체 아님) |

---

## Tracks

**트랙** = 스택별 프리셋 번들. Step 1 에서 1개 이상 선택; 트랙이 Step 3 의 pre-check 항목을 결정한다.

### Dev tracks

| Track | Stack |
|---|---|
| `csr-supabase` | Vite + React + Supabase |
| `csr-fastify` | Vite + React + Fastify |
| `csr-fastapi` | Vite + React + FastAPI |
| `ssr-nextjs` | Next.js (App Router) |
| `ssr-htmx` | HTMX + server-side |
| `data` | DuckDB + Polars + PySide6 |
| `full` | dev 트랙 전체 union |

### Business tracks

| Track | 용도 |
|---|---|
| `executive` | 제안서, DD, 발표자료, 재무모델 |
| `project-management` | PM 워크플로우 + 리뷰 |
| `growth-marketing` | Growth + 콘텐츠 마케팅 |

### Meta

| Track | 용도 |
|---|---|
| `tooling` | Bash + Markdown 메타프로젝트 (앱 스택 없음) |

---

## 트랙별 설치 항목 (요약)

트랙 선택 결과로 자동 추천되고 Step 3 에 pre-checked 로 표시된다 — 설치 전 자유롭게 토글. 전체 자산 표와 검증 상태는 [영문 README](./README.md#what-gets-installed-per-track) 와 [호환 매트릭스](docs/COMPATIBILITY.md) 참조. 주요 포인트:

- **Frontend**: `frontend-design`(Anthropic 공식, **전 dev 트랙 기본**) + `react-best-practices`(vercel-labs) + `shadcn-ui`. `web-design-guidelines` · `impeccable` 은 v26.106.0 부터 opt-in.
- **Backend**: `railway-skills`, Supabase 계열(csr-supabase), `vercel-cli`. `netlify-cli` 는 opt-in(배포 CLI 중복 정리).
- **Data**: `polars` · `dask`(K-Dense) + `anthropic-data-plugin`. Python 패턴 2종(wshobson)은 opt-in.
- **Dev Tools**: `find-skills` · `agent-browser` · `karpathy-coder` + 1st-party dev-method 스킬 8종(★ — 전 dev 트랙 코어, Step 3 에서 해제 가능). `code-review`(Anthropic 공식) 는 opt-in — 기본 리뷰 에이전트와 표면 중복.
- **Security**: `security-guidance`(Anthropic 공식, opt-in — 런타임에 Python·Agent SDK 필요) · `trailofbits-skills`.
- **Workflow (전부 opt-in)**: superpowers · ECC · OpenSpec · BMAD · addy agent-skills · wshobson agents · feature-dev — 7종 비교는 [워크플로 가이드](docs/WORKFLOWS.md).
- **권장 수단 (opt-in)**: `model-orchestration` · `gemini-consult`(agy) · `codex-consult`(codex) — 방법론 코어와 달리 "권장하는 수단". 두 컨설트 스킬은 런타임에 해당 외부 CLI 필요.
- **CI 스캐폴드 (opt-in)**: `--with ci-scaffold` → `.github/workflows/` fill-in 템플릿(태그 트리거 CI + 실DB 서비스 컨테이너 + coverage 게이트 + Playwright E2E). `.claude/` 밖에 쓰는 유일한 자산 — **기존 워크플로 파일은 절대 덮어쓰지 않고**, uninstall 은 `.github/` 를 건드리지 않는다.

---

## Trust tiers (검증 등급)

모든 외부 자산은 **trust tier** 를 가지며 Step 3 에서 배지로 표시된다:

- **★ official** — Anthropic 공식 marketplace + 본 하네스 자체 자산.
- **vetted** — GitHub star ≥ 1000 + 활성 유지보수. track 적합 시 pre-checked.
- **⚠ experimental** — star 1000 미만. opt-in 만 (pre-check 안 함), 카테고리 하단 표시.

tier 는 **정보 제공일 뿐 차단하지 않는다** — 최종 선택은 항상 사용자. star-drift 는 월간 CI 로 자동 감시된다.

> **"검증됨"의 근거는?** [호환·검증 매트릭스](docs/COMPATIBILITY.md) — 설치 방법을 실제 registry/marketplace 에 대조하고, 핵심 워크플로 셋은 **Docker 격리 컨테이너 실설치**로 검증한다(정적 표가 아님).

---

## Scope

Step 4 에서 install write 위치 선택.

| 대상 | Project (default) | Global (opt-in) |
|---|---|---|
| `claude plugin` | `--scope project` (`installed_plugins.json` 의 `projectPath` 로 격리) | `--scope user` |
| `npx skills` | project `node_modules` | `-g` (user-level) |
| `npm` | `--save-dev` (devDependency) | `-g` |
| Codex (prompts / skills / config) | 프로젝트 `.codex/` | `~/.codex/` |
| Antigravity (skills / workflows) | 프로젝트 `.agents/` | `~/.gemini/antigravity/` |
| `~/.claude/skills/` · `~/.codex/` · `~/.opencode/` · `~/.gemini/` · `npm root -g` | **미수정** | 자산별 write |

Project scope 는 install 을 본 레포에 가둔다. 동일 머신의 다른 프로젝트는 영향 받지 않는다.

Claude CLI 자체는 scope 와 무관하게 `~/.claude/plugins/cache/` 에 plugin 파일을 write 한다 — 단 `installed_plugins.json` 메타데이터가 `projectPath` 로 격리하므로 다른 프로젝트에서 안 보인다.

---

## Uninstall

```bash
npx -y @uzysjung/agent-harness uninstall
```

`.claude/.harness-install.json` (install 시 생성) 을 읽어 자동 reverse 한다.

- Project-scope 자산: 자동 제거 (`claude plugin uninstall --scope project`, `npm uninstall --save-dev`, `.codex/` cleanup 등).
- 프로젝트 루트 `CLAUDE.md`: install 시점과 내용이 동일할 때만 제거 (sha256). 설치 후 직접 수정했다면 안내와 함께 보존.
- Global-scope 자산: 안내 메시지만 출력 — 사용자가 직접 제거. uninstall 은 명시적 동의 없이는 다른 프로젝트나 글로벌 설정을 절대 변경하지 않는다.

| Flag | What |
|---|---|
| `--dry-run` | reverse list 만 출력, 변경 없음 |
| `--keep-templates` | external 자산만 제거, `.claude/`, `.codex/`, `.opencode/` 보존 |

---

## 동작 방식

```
┌──────────────────────────────────────────────────────────┐
│  npx -y @uzysjung/agent-harness                         │
│         │                                                │
│         ▼                                                │
│  ┌─ 6-step wizard ──────────────────────────────────┐    │
│  │  Track(s) → CLI(s) → Items → Scope → Confirm    │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 1: Templates ─────────────────────────────┐    │
│  │  .claude/{rules,agents,hooks,commands,skills}    │    │
│  │  CLAUDE.md (scaffold) · .mcp.json                │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 2: External assets ───────────────────────┐    │
│  │  claude plugin / npx skills / npm / shell-script │    │
│  │  Step 4 에서 선택한 scope 따름                    │    │
│  └──────────────────┬───────────────────────────────┘    │
│                     ▼                                    │
│  ┌─ Phase 3: install log ───────────────────────────┐    │
│  │  .claude/.harness-install.json                   │    │
│  │  (uninstall 의 source)                           │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

---

## CLI 지원

| CLI | 지원 |
|---|---|
| Claude Code | First class — 모든 자산 + hook |
| Codex (OpenAI) | Skills + `AGENTS.md` (스택별 rules) |
| OpenCode | Skills + AGENTS.md 통합 |
| Antigravity (Google) | Project: `.agents/rules/` (context, 항상) + `.agents/skills/` (dev-method skills) |

Step 2 에서 1개 또는 multi 선택.

---

## 심화

- [docs/USAGE.md](./docs/USAGE.md) — 워크플로우 상세, install 내부, CI flag, ECC 통합, Codex/OpenCode 설정
- [docs/WORKFLOWS.md](./docs/WORKFLOWS.md) — 설치 가능 워크플로 7종 비교 가이드
- [docs/NORTH_STAR.md](./docs/NORTH_STAR.md) — 디자인 원칙
- [docs/decisions/](./docs/decisions/) — ADR (아키텍처 결정)
- [docs/REFERENCE.md](./docs/REFERENCE.md) — 트랙별 자산 매트릭스 상세

---

## License

MIT.

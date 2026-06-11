# 호환·검증 매트릭스 (Compatibility & Verification)

> **갱신**: 2026-06-06 (ADR-021 A) · **SSOT**: [`src/external-assets.ts`](../src/external-assets.ts) `TRUST_TIER` · **신선도**: [`trust-tier-drift.yml`](../.github/workflows/trust-tier-drift.yml) 월 cron
>
> 본 문서는 ADR-021 재포지셔닝의 **방어 wedge — "검증됐다"의 공개 증거**다. 경쟁사(Vercel/MS APM)의 *정적* capability 표과 달리, 본 매트릭스의 **실설치 검증은 Docker 격리 컨테이너 실행**(반복 가능)에 근거한다. 호스트 글로벌 write 0.
>
> **재현 가능 검증기**: `scripts/verify-catalog.mjs` + [`catalog-verify.yml`](../.github/workflows/catalog-verify.yml)(월 cron + dispatch) — 실 claude/`npx skills`/`npm` 으로 전 카탈로그 설치 가능성을 CI 에서 재검증, plugin 삭제·rename·패키지 부재 시 fail. "지속 테스트"가 1회성이 아니라 codified.

## 검증 등급 (무엇이 "검증됐다"인가)

| 등급 | 의미 | 근거 |
|------|------|------|
| **🟢 Docker 실설치** | 실 CLI/패키지를 격리 컨테이너에 실제 설치 → exit 0 + 산출물 확인 (plugin/skill/npx/openspec) | `docs/research/realcli-*.md` |
| **🟢 registry 실재** | npm registry 실재 확인 (full 설치는 표준 `npm i` — vercel/netlify/supabase/agent-browser CLI) | `npm view` |
| **🟡 local / matrix** | 로컬 스크립트(ecc-prune) 또는 install-matrix CI (uzys-harness templates) | `install-matrix.yml` |

> **전 카탈로그 37/38 🟢** (Docker 실설치 + registry 실재). ecc-prune 만 🟡(로컬 스크립트, 네트워크 무관). content-creator·demand-gen 은 upstream 부재 검출 → 제거(v26.76.0).

## 보안 근거 (Trust Tier + 출처 vetting)

agentshield 는 로컬 `.claude/` 설정 스캐너로, 임의 외부 repo 를 스캔하지 않는다. 따라서 큐레이션 자산의 보안은 **다층 vetting**으로 보증한다:

1. **Trust Tier** — `official`(Anthropic 공식 + 본 하네스) / `vetted`(GitHub ★≥1000 + 활성) / `experimental`(★<1000, opt-in + 경고). 정적 라벨이 실 star 와 어긋나면 `trust-tier-drift.yml`(월 cron)이 자동 검출.
2. **upstream vetting 위임** — 공식 마켓플레이스 자산(superpowers 등 anthropics/claude-plugins-official)은 Anthropic 의 품질·보안 스크리닝을 통과. plugin 자산은 각 upstream 의 검증에 의존.
3. **Promise = Implementation** — 광고된 설치 명령은 실재(registry/marketplace 확인). 워크플로 핵심군은 Docker 실설치까지.
4. **`.claude/` 산출물 게이트** — 하네스가 *생성*하는 설정은 ship 전 `agentshield-gate.sh`(PreToolUse hook)가 스캔(CRITICAL 차단).
5. **버전 pinning (v26.80.0)** — npm/npx-run 자산은 **정확 semver 로 고정** 설치 (`pkg@version`, 아래 표에 버전 명시). vetting 은 시점 검증이므로 `@latest` 는 vetting 안 된 미래 코드 실행 = supply-chain 구멍. 회귀 테스트가 unpinned 를 차단. **bump 정책**: 분기 자산 audit(A2) 주기에 새 버전을 Docker 실설치 검증 후 갱신.
   - *잔여 리스크 (정직 표기)*: `plugin`(claude marketplace) / `skill`(skills.sh) 메서드는 설치 CLI 가 버전 지정을 지원하지 않아 **pin 불가** — upstream HEAD 가 설치된다. 이 부분은 Trust Tier + upstream vetting(②)에 의존.

> 산업 맥락: Snyk "ToxicSkills" 가 테스트 skill 의 36%에서 prompt injection 을 발견. 본 큐레이션은 위 다층 vetting 으로 무검증 자산 sprawl 을 차단한다 (ADR-021 wedge).

## 전체 카탈로그 매트릭스 (자동 생성)

> `npm run gen:compat` 로 자산 데이터에서 자동 생성(수동 drift 0). 아래 블록은 생성기 산출.

<!-- AUTO-GEN:CATALOG:START -->

> **자동 생성** (`scripts/gen-compatibility.mjs`, 2026-06-06). 자산 **43** (official 6 / vetted 33 / experimental 4) · 🟢 검증 **40/43**. tier SSOT=`src/external-assets.ts`, drift 감시=`trust-tier-drift.yml`.

#### 🔄 Workflow (7)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `uzys-harness` | official | templates (`--with uzys-harness`) | 4-CLI (templates) | 🟡 local |
| `superpowers` | official | `superpowers@claude-plugins-official` | Claude Code | 🟢 Docker 2026-06-06 |
| `addy-agent-skills` | vetted | `agent-skills@addy-agent-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `wshobson-agents` | vetted | `full-stack-orchestration@claude-code-workflows` | Claude Code | 🟢 Docker 2026-06-06 |
| `openspec` | vetted | `@fission-ai/openspec@1.4.1` (npm) | agnostic | 🟢 Docker 2026-06-06 |
| `bmad-method` | vetted | `bmad-method@6.8.0` (npx) | agnostic | 🟢 Docker 2026-06-06 |
| `gsd-orchestrator` | vetted | `get-shit-done-cc@1.42.3` (npx) | agnostic | 🟢 Docker 2026-06-06 |

#### 🎨 Frontend (5)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `tauri-desktop` | official | templates (`--with tauri-desktop`) | 4-CLI (templates) | 🟡 local |
| `impeccable` | vetted | `pbakaus/impeccable :: impeccable` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `react-best-practices` | vetted | `vercel-labs/agent-skills :: vercel-react-best-practices` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `shadcn-ui` | vetted | `shadcn/ui :: shadcn` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `web-design-guidelines` | vetted | `vercel-labs/agent-skills :: web-design-guidelines` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |

#### 🗄️ Backend (7)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `vercel-cli` | vetted | `vercel@54.11.1` (npm) | agnostic | 🟢 registry 2026-06-06 |
| `netlify-cli` | vetted | `netlify-cli@26.1.0` (npm) | agnostic | 🟢 registry 2026-06-06 |
| `supabase-cli` | vetted | `supabase@2.105.0` (npm) | agnostic | 🟢 registry 2026-06-06 |
| `supabase-agent-skills` | vetted | `supabase@supabase-agent-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `postgres-best-practices` | vetted | `postgres-best-practices@supabase-agent-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `railway-skills` | experimental | `railway@railway-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `next-skills` | experimental | `vercel-labs/next-skills` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |

#### 📊 Data (5)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `anthropic-data-plugin` | official | `data@knowledge-work-plugins` | Claude Code | 🟢 Docker 2026-06-06 |
| `polars-K-Dense` | vetted | `K-Dense-AI/scientific-agent-skills :: polars` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `dask-K-Dense` | vetted | `K-Dense-AI/scientific-agent-skills :: dask` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `python-resource-management` | vetted | `wshobson/agents :: python-resource-management` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `python-performance-optimization` | vetted | `wshobson/agents :: python-performance-optimization` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |

#### 💼 Business (7)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `anthropic-document-skills` | official | `document-skills@anthropic-agent-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `c-level-skills` | vetted | `c-level-skills@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `business-growth-skills` | vetted | `business-growth-skills@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `finance-skills` | vetted | `finance-skills@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `pm-skills` | vetted | `pm-skills@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `marketing-skills` | vetted | `marketing-skills@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `research-summarizer` | vetted | `research-summarizer@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |

#### 🛡️ Dev Tools (6)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `find-skills` | vetted | `vercel-labs/skills :: find-skills` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `product-skills` | vetted | `product-skills@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `karpathy-coder` | vetted | `karpathy-coder@claude-code-skills` | Claude Code | 🟢 Docker 2026-06-06 |
| `trailofbits-skills` | vetted | `differential-review@trailofbits` | Claude Code | 🟢 Docker 2026-06-06 |
| `playwright-skill` | experimental | `testdino-hq/playwright-skill :: playwright-skill` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |
| `architecture-decision-record` | experimental | `yonatangross/orchestkit :: architecture-decision-record` | Claude Code (+skills.sh) | 🟢 Docker 2026-06-06 |

#### 🧠 Understanding (4)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `agent-browser` | vetted | `agent-browser@0.27.2` (npm) | agnostic | 🟢 registry 2026-06-06 |
| `claude-video` | vetted | `watch@claude-video` | Claude Code | 🟢 Docker 2026-06-06 |
| `understand-anything` | vetted | `understand-anything@understand-anything` | Claude Code | 🟢 Docker 2026-06-06 |
| `agentmemory` | vetted | `agentmemory@agentmemory` | Claude Code | 🟢 Docker 2026-06-06 |

#### 📦 ECC Suite (2)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `ecc-prune` | official | `scripts/prune-ecc.sh` | local | 🟡 local |
| `ecc-plugin` | vetted | `ecc@ecc` | Claude Code | 🟢 Docker 2026-06-06 |

<!-- AUTO-GEN:CATALOG:END -->

> v26.81.0 (ADR-022) — uzys-harness/tauri-desktop 은 **내부 템플릿 자산**으로 표에 합류 (`--with <id>` 또는 wizard 체크, 설치 주체 = Phase 1 manifest — install-matrix CI 가 검증 🟡). 모든 plugin `pluginId`/skill 이름이 실 claude(2.1.167) / `npx skills` 로 **정확성 확정**(content-creator·demand-gen 은 upstream 부재 검출 → v26.76.0 제거).
> 🟢 실설치 evidence: [`research/realcli-workflows-verification-2026-06-06.md`](research/realcli-workflows-verification-2026-06-06.md) (워크플로 3 + 기존 4 + 카탈로그 배치) · Codex/Antigravity 구조: [`research/realcli-verification-2026-05-31.md`](research/realcli-verification-2026-05-31.md).

## 4-CLI 적용 범위

자산이 4개 CLI(Claude Code · Codex · OpenCode · Antigravity) 중 어디에 적용되는지는 **install method** 가 결정한다:

| method | 적용 CLI | 비고 |
|--------|---------|------|
| `plugin` (`claude plugin …`) | **Claude Code** primary | CC 플러그인 시스템. 일부는 cross-CLI 미러(wshobson: Codex/Cursor/OpenCode 별도 installer) |
| `skill` (`npx skills add`) | Claude Code(+ skills.sh 지원 에이전트) | `--agent` 플래그로 다중 |
| `npm` / `npx-run` | **CLI-agnostic** | 독립 CLI 도구(openspec/bmad/gsd) — 어느 셸에서나 |
| 하네스 `uzys-*` (templates) | **4-CLI 전부** | `.claude/`·`.codex/`·`.agents/`·`~/.gemini/` 동등 산출 (Cross-CLI Parity NSM) |

> 전체 자산의 Track×CLI 조합 매트릭스(mock)는 `tests/installer-cli-matrix.test.ts`(92 케이스)가 강제.

## 한계 (정직)

- **런타임 슬래시 실행(C tier)은 검증 범위 외** — 본 매트릭스는 *설치 + 인식(discovery)*까지. 슬래시/에이전트의 실 동작은 별도.
- **npm(4종, openspec 제외)은 registry 실재 확인** — full 설치는 표준 `npm i`(자명). 나머지(plugin/skill/npx/openspec)는 Docker 실설치.
- **검증은 스냅샷**(2026-06-06)이나 **재현 가능** — tier drift 는 `trust-tier-drift.yml`, 실설치 가능성은 `catalog-verify.yml`(월 cron + dispatch) / `scripts/verify-catalog.mjs`(격리 env) 가 자동 재검증. 매트릭스 표는 `npm run gen:compat` 재생성.

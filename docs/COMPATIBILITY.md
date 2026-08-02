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
| **🟡 local / matrix** | 로컬 스크립트(ecc-prune) 또는 install-matrix CI (tauri-desktop·dev-method templates) | `install-matrix.yml` |

> **전 카탈로그 51/55 🟢** (Docker 실설치 + registry 실재). 나머지 4 자산 🟡 = templates(tauri-desktop·ci-scaffold·dev-method 1종 compaction-handoff)·ecc-prune. (2026-08-02 ADR-060 정비 — uzys 이관 9종은 `npx skills add uzysjung/uzys-agent-skills` 로, 그중 north-star 와 frontend 신규 2종(jakubkrehel 7종 세트·taste-skill)은 Docker 실설치 3/3 exit 0 실증.) 오피셜 플러그인 신규 3종(v26.110.0 — code-review·feature-dev·security-guidance)은 **Docker 실 claude 2.1.214 로 marketplace add + plugin install 3/3 exit 0 실증**(2026-07-18, throwaway 컨테이너 — 호스트 오염 0). ⚠ **🟡 templates 의 검증 범위 정직화**: install-matrix CI 가 검증하는 것은 **파일 배치(manifest copy — 올바른 위치에 올바른 내용)** 까지다. ci-scaffold 는 manifest 미경유 전용 단계라 install-matrix 에도 포함되지 않는다 — 검증 = 로컬 unit 테스트(`tests/ci-scaffold.test.ts`: 트랙 매핑·no-clobber·CLI-무관)와 YAML 파싱까지, 실 GitHub Actions 실행은 사용자 repo 에서만 가능(미검증). 실 Codex/OpenCode/Antigravity 바이너리가 `.agents/skills/<id>/SKILL.md`·`.opencode/commands/<id>.md` 를 **native 로드(slash 노출)** 하는지는 각 CLI vendor 계약이라 **미검증**(`CLAUDE.md` "Docker mock ≠ 실 CLI"). content-creator·demand-gen 은 upstream 부재 검출 → 제거(v26.76.0).

## 보안 근거 (Trust Tier + 출처 vetting)

agentshield 는 로컬 `.claude/` 설정 스캐너로, 임의 외부 repo 를 스캔하지 않는다. 따라서 큐레이션 자산의 보안은 **다층 vetting**으로 보증한다:

1. **Trust Tier** — `official`(Anthropic 공식 + 본 하네스) / `vetted`(GitHub ★≥1000 + 활성) / `experimental`(★<1000, opt-in + 경고). 정적 라벨이 실 star 와 어긋나면 `trust-tier-drift.yml`(월 cron)이 자동 검출.
2. **upstream vetting 위임** — 공식 마켓플레이스 자산(superpowers 등 anthropics/claude-plugins-official)은 Anthropic 의 품질·보안 스크리닝을 통과. plugin 자산은 각 upstream 의 검증에 의존.
3. **Promise = Implementation** — 광고된 설치 명령은 실재(registry/marketplace 확인). 워크플로 핵심군은 Docker 실설치까지.
4. **`.claude/` 산출물 게이트** — 하네스가 *생성*하는 설정은 ship 전 `npx ecc-agentshield scan`(수동, ship-checklist 게이트)로 점검. *자동 PreToolUse 게이트(`agentshield-gate.sh`)는 6-Gate 제거(ADR-023) 시 삭제 — 현재 미배선.*
5. **버전 pinning (v26.80.0)** — npm/npx-run 자산은 **정확 semver 로 고정** 설치 (`pkg@version`, 아래 표에 버전 명시). vetting 은 시점 검증이므로 `@latest` 는 vetting 안 된 미래 코드 실행 = supply-chain 구멍. 회귀 테스트가 unpinned 를 차단. **bump 정책**: 분기 자산 audit(A2) 주기에 새 버전을 Docker 실설치 검증 후 갱신.
   - *잔여 리스크 (정직 표기)*: `plugin`(claude marketplace) / `skill`(skills.sh) 메서드는 설치 CLI 가 버전 지정을 지원하지 않아 **pin 불가** — upstream HEAD 가 설치된다. 이 부분은 Trust Tier + upstream vetting(②)에 의존.

> 산업 맥락: Snyk "ToxicSkills" 가 테스트 skill 의 36%에서 prompt injection 을 발견. 본 큐레이션은 위 다층 vetting 으로 무검증 자산 sprawl 을 차단한다 (ADR-021 wedge).

## 전체 카탈로그 매트릭스 (자동 생성)

> `npm run gen:compat` 로 자산 데이터에서 자동 생성(수동 drift 0). 아래 블록은 생성기 산출.

<!-- AUTO-GEN:CATALOG:START -->

> **자동 생성** (`scripts/gen-compatibility.mjs`). 자산 **55** (official 20 / vetted 33 / experimental 2) · 🟢 검증 **51/55**. tier SSOT=`src/external-assets.ts`, drift 감시=`trust-tier-drift.yml`.
>
> **🟢 = method 기반 실설치 검증** (Docker realcli / registry; 검증 배치 기준 2026-06-06). 날짜는 배치 기준이며 **자산별 실검증일이 아니다** — 자산 추가·검증 이력은 [CHANGELOG](../CHANGELOG.md).

#### 🔄 Workflow (13)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `ci-scaffold` | official | templates (`--with ci-scaffold`) | 4-CLI (templates) | 🟡 local |
| `compaction-handoff` | official | templates (`--with compaction-handoff`) | Claude · Codex · Antigravity (skill) · OpenCode (cmd) | 🟡 local |
| `clear-korean-communication` | official | `uzysjung/uzys-agent-skills :: clear-korean-communication` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `north-star` | official | `uzysjung/uzys-agent-skills :: north-star` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `recurrence-prevention` | official | `uzysjung/uzys-agent-skills :: recurrence-prevention` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `gh-issue-workflow` | official | `uzysjung/uzys-agent-skills :: gh-issue-workflow` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `model-orchestration` | official | `uzysjung/uzys-agent-skills :: model-orchestration` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `superpowers` | official | `superpowers@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `feature-dev` | official | `feature-dev@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `addy-agent-skills` | vetted | `agent-skills@addy-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `wshobson-agents` | vetted | `full-stack-orchestration@claude-code-workflows` | Claude Code (plugin) | 🟢 Docker |
| `openspec` | vetted | `@fission-ai/openspec@1.4.1` (npm) | 4-CLI (npm) | 🟢 Docker |
| `bmad-method` | vetted | `bmad-method@6.9.0` (npx) | Claude Code (npx) | 🟢 Docker |

#### 🎨 Frontend (8)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `tauri-desktop` | official | templates (`--with tauri-desktop`) | 4-CLI (templates) | 🟡 local |
| `frontend-design` | official | `frontend-design@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `jakubkrehel-skills` | vetted | `jakubkrehel/skills` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `taste-skill` | vetted | `Leonxlnx/taste-skill :: taste-skill` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `scroll-world` | vetted | `oso95/scroll-world :: scroll-world` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `react-best-practices` | vetted | `vercel-labs/agent-skills :: vercel-react-best-practices` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `shadcn-ui` | vetted | `shadcn/ui :: shadcn` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `web-design-guidelines` | vetted | `vercel-labs/agent-skills :: web-design-guidelines` | 4-CLI (skills.sh --agent) | 🟢 Docker |

#### 🗄️ Backend (6)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `vercel-cli` | vetted | `vercel@54.17.3` (npm) | 4-CLI (npm) | 🟢 registry |
| `netlify-cli` | vetted | `netlify-cli@26.1.0` (npm) | 4-CLI (npm) | 🟢 registry |
| `supabase-cli` | vetted | `supabase@2.108.0` (npm) | 4-CLI (npm) | 🟢 registry |
| `supabase-agent-skills` | vetted | `supabase@supabase-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `postgres-best-practices` | vetted | `postgres-best-practices@supabase-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `railway-skills` | experimental | `railway@railway-skills` | Claude Code (plugin) | 🟢 Docker |

#### 📊 Data (1)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `anthropic-data-plugin` | official | `data@knowledge-work-plugins` | Claude Code (plugin) | 🟢 Docker |

#### 💼 Business (3)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `anthropic-document-skills` | official | `document-skills@anthropic-agent-skills` | Claude Code (plugin) | 🟢 Docker |
| `finance-skills` | vetted | `finance-skills@claude-code-skills` | Claude Code (plugin) | 🟢 Docker |
| `marketingskills` | vetted | `marketing-skills@marketingskills` | Claude Code (plugin) | 🟢 Docker |

#### 🛡️ Dev Tools (9)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `audit-service-gaps` | official | `uzysjung/uzys-agent-skills :: audit-service-gaps` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `verification-loop` | official | `uzysjung/uzys-agent-skills :: verification-loop` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `multi-persona-review` | official | `uzysjung/uzys-agent-skills :: multi-persona-review` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `external-model-consult` | official | `uzysjung/uzys-agent-skills :: external-model-consult` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `code-review` | official | `code-review@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `security-guidance` | official | `security-guidance@claude-plugins-official` | Claude Code (plugin) | 🟢 Docker |
| `find-skills` | vetted | `vercel-labs/skills :: find-skills` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `product-skills` | vetted | `product-skills@claude-code-skills` | Claude Code (plugin) | 🟢 Docker |
| `trailofbits-skills` | vetted | `differential-review@trailofbits` | Claude Code (plugin) | 🟢 Docker |

#### 🧠 Understanding (4)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `agent-browser` | vetted | `agent-browser@0.31.0` (npm) | 4-CLI (npm) | 🟢 registry |
| `claude-video` | vetted | `watch@claude-video` | Claude Code (plugin) | 🟢 Docker |
| `understand-anything` | vetted | `understand-anything@understand-anything` | Claude Code (plugin) | 🟢 Docker |
| `agentmemory` | vetted | `agentmemory@agentmemory` | Claude Code (plugin) | 🟢 Docker |

#### 🎬 Visual & Media (9)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `frontend-slides` | vetted | `frontend-slides@frontend-slides` | Claude Code (plugin) | 🟢 Docker |
| `marp-slide` | vetted | `softaworks/agent-toolkit :: marp-slide` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `mermaid-diagrams` | vetted | `softaworks/agent-toolkit :: mermaid-diagrams` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `gsap-skills` | vetted | `gsap-skills@gsap-skills` | Claude Code (plugin) | 🟢 Docker |
| `remotion` | vetted | `remotion-dev/skills :: remotion-best-practices` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `ppt-master` | vetted | `hugohe3/ppt-master :: ppt-master` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `ppt-generation` | vetted | `bytedance/deer-flow :: ppt-generation` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `web-video-presentation` | vetted | `ConardLi/garden-skills :: web-video-presentation` | 4-CLI (skills.sh --agent) | 🟢 Docker |
| `revealjs` | experimental | `ryanbbrown/revealjs-skill :: revealjs` | 4-CLI (skills.sh --agent) | 🟢 Docker |

#### 📦 ECC Suite (2)

| id | tier | 설치 타겟 | CLI | 검증 |
|---|---|---|---|---|
| `ecc-prune` | official | `scripts/prune-ecc.sh` | Claude Code (local script) | 🟡 local |
| `ecc-plugin` | vetted | `ecc@ecc` | Claude Code (plugin) | 🟢 Docker |

<!-- AUTO-GEN:CATALOG:END -->

> v26.81.0 (ADR-022) — tauri-desktop 은 **내부 템플릿 자산**으로 표에 합류 (`--with <id>` 또는 wizard 체크, 설치 주체 = Phase 1 manifest — install-matrix CI 가 검증 🟡). 모든 plugin `pluginId`/skill 이름이 실 claude(2.1.167) / `npx skills` 로 **정확성 확정**(content-creator·demand-gen 은 upstream 부재 검출 → v26.76.0 제거).
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

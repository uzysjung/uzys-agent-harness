# 호환·검증 매트릭스 (Compatibility & Verification)

> **갱신**: 2026-06-06 (ADR-021 A) · **SSOT**: [`src/external-assets.ts`](../src/external-assets.ts) `TRUST_TIER` · **신선도**: [`trust-tier-drift.yml`](../.github/workflows/trust-tier-drift.yml) 월 cron
>
> 본 문서는 ADR-021 재포지셔닝의 **방어 wedge — "검증됐다"의 공개 증거**다. 경쟁사(Vercel/MS APM)의 *정적* capability 표과 달리, 본 매트릭스의 **실설치 검증은 Docker 격리 컨테이너 실행**(반복 가능)에 근거한다. 호스트 글로벌 write 0.

## 검증 등급 (무엇이 "검증됐다"인가)

| 등급 | 의미 | 근거 |
|------|------|------|
| **🟢 Docker 실설치** | 실 CLI/패키지를 격리 컨테이너에 실제 설치 → exit 0 + 산출물 확인 | `docs/research/realcli-*.md` |
| **🟡 install-matrix CI** | npm pack 타르볼을 OS×Node×pm 매트릭스에서 설치 검증(mock 외부 의존) | `install-matrix.yml` |
| **⚪ 메타데이터** | upstream marketplace/registry 실재 + Trust Tier 확인 (실설치 미실행) | `TRUST_TIER` + drift CI |

> 모든 자산은 최소 ⚪(메타데이터 검증 + Trust Tier). 워크플로 핵심군은 🟢까지.

## 보안 근거 (Trust Tier + 출처 vetting)

agentshield 는 로컬 `.claude/` 설정 스캐너로, 임의 외부 repo 를 스캔하지 않는다. 따라서 큐레이션 자산의 보안은 **다층 vetting**으로 보증한다:

1. **Trust Tier** — `official`(Anthropic 공식 + 본 하네스) / `vetted`(GitHub ★≥1000 + 활성) / `experimental`(★<1000, opt-in + 경고). 정적 라벨이 실 star 와 어긋나면 `trust-tier-drift.yml`(월 cron)이 자동 검출.
2. **upstream vetting 위임** — 공식 마켓플레이스 자산(superpowers 등 anthropics/claude-plugins-official)은 Anthropic 의 품질·보안 스크리닝을 통과. plugin 자산은 각 upstream 의 검증에 의존.
3. **Promise = Implementation** — 광고된 설치 명령은 실재(registry/marketplace 확인). 워크플로 핵심군은 Docker 실설치까지.
4. **`.claude/` 산출물 게이트** — 하네스가 *생성*하는 설정은 ship 전 `agentshield-gate.sh`(PreToolUse hook)가 스캔(CRITICAL 차단).

> 산업 맥락: Snyk "ToxicSkills" 가 테스트 skill 의 36%에서 prompt injection 을 발견. 본 큐레이션은 위 다층 vetting 으로 무검증 자산 sprawl 을 차단한다 (ADR-021 wedge).

## 워크플로 매트릭스 (8) — 검증 showcase

| 워크플로 | id | Tier | Install | 검증 | 비고 |
|---|---|------|---------|------|------|
| uzys-harness | (내장) | official | templates | 🟡 | 4-CLI 산출(codex/antigravity 구조 realcli) |
| Superpowers | `superpowers` | official | plugin (anthropics 공식) | ⚪ | upstream 공식 vetting |
| ECC | `ecc-plugin` | vetted | plugin (affaan-m) | ⚪ | 199k★ |
| GSD | `gsd-orchestrator` | vetted | npx-run | ⚪ | 63k★ |
| addy agent-skills | `addy-agent-skills` | vetted | plugin (addyosmani) | ⚪ | 47k★ |
| **OpenSpec** | `openspec` | vetted | npm `@fission-ai/openspec` | **🟢 2026-06-06** | `npm i` → `npx openspec --version` 1.4.1 |
| **BMAD-METHOD** | `bmad-method` | vetted | npx `bmad-method@latest install --directory . --tools claude-code --yes` | **🟢 2026-06-06** | `_bmad`/`.claude` 생성. `--directory` 필수(Docker 검출) |
| **wshobson agents** | `wshobson-agents` | vetted | plugin `full-stack-orchestration@claude-code-workflows` | **🟢 2026-06-06** | 실 claude 2.1.167 marketplace add + install |

> 🟢 3건 evidence: [`research/realcli-workflows-verification-2026-06-06.md`](research/realcli-workflows-verification-2026-06-06.md). Codex/Antigravity 구조 realcli: [`research/realcli-verification-2026-05-31.md`](research/realcli-verification-2026-05-31.md).

## 4-CLI 적용 범위

자산이 4개 CLI(Claude Code · Codex · OpenCode · Antigravity) 중 어디에 적용되는지는 **install method** 가 결정한다:

| method | 적용 CLI | 비고 |
|--------|---------|------|
| `plugin` (`claude plugin …`) | **Claude Code** primary | CC 플러그인 시스템. 일부는 cross-CLI 미러(wshobson: Codex/Cursor/OpenCode 별도 installer) |
| `skill` (`npx skills add`) | Claude Code(+ skills.sh 지원 에이전트) | `--agent` 플래그로 다중 |
| `npm` / `npx-run` | **CLI-agnostic** | 독립 CLI 도구(openspec/bmad/gsd) — 어느 셸에서나 |
| 하네스 `uzys-*` (templates) | **4-CLI 전부** | `.claude/`·`.codex/`·`.agents/`·`~/.gemini/` 동등 산출 (Cross-CLI Parity NSM) |

> 전체 자산의 Track×CLI 조합 매트릭스(mock)는 `tests/installer-cli-matrix.test.ts`(92 케이스)가 강제.

## 전체 카탈로그 검증 수준 (요약)

- **official 5** (anthropic-data/document, superpowers, ecc-prune, + uzys-harness 내장) — upstream 공식 또는 본 하네스.
- **vetted 다수** (★≥1000) — GitHub star + 활성 확인, drift CI 감시.
- **experimental 4** (next-skills 895 / railway 268 / playwright 264 / ADR 179) — opt-in + 경고, pre-check 제외.

> tier 라벨은 `src/external-assets.ts` SSOT. 누락 0 강제(`external-assets.test.ts`). 실 star drift 는 `trust-tier-drift.yml` 월 1회 자동 검출.

## 한계 (정직)

- **런타임 슬래시 실행(C tier)은 검증 범위 외** — 본 매트릭스는 *설치 + 인식(discovery)*까지. 슬래시/에이전트의 실 동작은 별도.
- **메타데이터(⚪) 자산은 실설치 미실행** — upstream 실재 + Trust Tier 로 보증하되, Docker 실설치는 워크플로 핵심군부터 점진 확대.
- **검증은 스냅샷** — 패키지/마켓 버전은 drift 가능. tier drift 는 자동 감지하나 실설치 재검증은 수동(자산 변경 시).

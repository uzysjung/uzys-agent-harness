# 워크플로 큐레이션 가이드 — 어떤 개발 워크플로를 고를까

> **갱신**: 2026-06-06 (v26.75.0, ADR-021) · **anchor**: [`NORTH_STAR.md`](NORTH_STAR.md) · **근거**: [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md)
>
> agent-harness 의 본질 = **검증된(+보안) 워크플로/자산 큐레이터**. "무엇이든 설치"가 아니라, AI 코딩 워크플로 시스템들을 **검증해서 고르게** 해주고 4개 CLI(Claude Code · Codex · OpenCode · Antigravity)에 동등 설치한다. 이 문서는 *어떤 워크플로를 골라야 하나*에 답한다.
>
> 마켓플레이스가 1개(2025-12)→8개(2026 Q2)로 늘며 **"skill 찾기보다 비교에 시간을 더 쓰는"** 과부하가 생겼다. 이 가이드가 그 비교를 대신한다.

---

## 한눈에 — 설치 가능 워크플로 (8)

설치 = 인터랙티브 위저드의 **Workflow 카테고리**에서 선택, 또는 `npx -y @uzysjung/agent-harness install --track <t> --with <id>`.

| 워크플로 | id | 출처 | ★ | Tier | 설치 | 한 줄 정체 |
|---|---|---|---|---|---|---|
| **uzys-harness** | `uzys-harness` | 본 하네스 | — | official | 내장 | 6-Gate `/uzys:spec…ship` + `/uzys:auto`(Ralph 루프). SPEC anchor·결정론 게이트 |
| **Superpowers** | `superpowers` | obra → anthropics 공식 | 226k | official | plugin | agentic skills 프레임워크. `/spec /plan …`(no-namespace) |
| **ECC** | `ecc-plugin` | affaan-m | 214k | vetted | plugin | 60 agents·230 skills·75 commands 종합 패키지(kitchen-sink) |
| **GSD** | `gsd-orchestrator` | gsd-build | 64k | vetted | npx | get-shit-done 오케스트레이터 |
| **OpenSpec** | `openspec` | Fission-AI | 55k | vetted | npm | **spec-driven brownfield delta**(propose→apply→archive) |
| **BMAD-METHOD** | `bmad-method` | bmad-code-org | 49k | vetted | npx | **멀티-에이전트 애자일**(PM/Architect/Dev, 12+ agents) |
| **addy agent-skills** | `addy-agent-skills` | addyosmani | 57k | vetted | plugin | general dev `/spec /plan` (경량) |
| **wshobson agents** | `wshobson-agents` | wshobson | 37k | vetted | plugin | 멀티-에이전트 오케스트레이션(full-stack/tdd/review), cross-CLI |

> `v26.75.0` 추가(ADR-021): OpenSpec · BMAD · wshobson — 3-에이전트 시장 리서치로 발굴, vetted 바(★≥1000+활성+설치가능) 통과분.
>
> ★ 수치 = GitHub `stargazers_count` 실측, **측정일 2026-06-13** (천 단위 반올림). 출처 repo: obra/superpowers · affaan-m/ECC · gsd-build/get-shit-done · Fission-AI/OpenSpec · bmad-code-org/BMAD-METHOD · addyosmani/agent-skills · wshobson/agents.

---

## 어떤 걸 골라야 하나 (의사결정)

- **구조화된 규율 + SPEC 정합성 반복(Ralph)** 을 원한다 → **uzys-harness**. 6-Gate + `/uzys:auto` 가 SPEC 충족까지 반복 검증.
- **스킬/하위에이전트 프레임워크**로 능력을 확장 → **Superpowers**(공식, 가장 안전).
- **다 깔고 골라쓰기**(에이전트·스킬·커맨드 대량) → **ECC**. 단 무겁다.
- **기존 코드베이스에 점진 변경(brownfield)** 을 spec-driven 으로 → **OpenSpec**(delta 기반).
- **애자일 팀 시뮬레이션**(PM→Architect→Dev 역할 분담) → **BMAD-METHOD**.
- **가벼운 spec/plan 슬래시**만 → **addy agent-skills**.
- **멀티-에이전트 오케스트레이션 + 다(多)CLI 일관성** → **wshobson agents**.
- **빠른 오케스트레이션 1회성 실행** → **GSD**.

> 택1+ 가능(상호 배타 아님). 단 슬래시 네임스페이스 충돌(`/spec` 등)은 의식할 것 — uzys 는 `/uzys:` 네임스페이스라 충돌 없음.

---

## 추천하되 자동설치 안 함 (정직)

큐레이터는 *최고*를 추천한다 — 우리 Node-기반 비대화형 installer 모델에 안 맞아도. Promise=Implementation 원칙상 **자동설치 못 하는 걸 "설치된다"고 광고하지 않는다.**

| 워크플로 | ★ | 왜 추천 | 왜 자동설치 안 하나 | 직접 설치 |
|---|---|---|---|---|
| **GitHub Spec Kit** | 112k | spec-driven 카테고리 **리더**, GitHub 공식, 20-30 에이전트 | **uv/Python 의존** + 대화형 `specify init` → Node-only·비대화형 모델 위반 (NORTH_STAR 트레이드오프) | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z` → `specify init` |
| **Kiro** | 3.8k | AWS 의 spec-driven **IDE/CLI** | **closed-source 제품** — 다른 CLI에 설치하는 자산이 아님 | [kiro.dev](https://kiro.dev) 다운로드 |

> ★ 측정일 2026-06-13: Spec Kit = `github/spec-kit` 실측. Kiro 는 closed-source(공개 repo 없음)라 ★ 미확정 — 기존 표기 유지.

---

## 기법 (워크플로 아님) — Ralph loop

**Ralph** 는 설치 가능한 워크플로가 아니라 *기법*이다: "신선한 에이전트를 루프로 돌려 목표 충족까지 eventual-consistency 로 수렴"(Geoffrey Huntley). 본 하네스의 **`/uzys:auto` 가 이 기법을 내장**(SPEC Compliance Check 반복).

외부 설치형 Ralph 패키징도 존재한다 — `snarktank/ralph`(20k, MIT, CC 플러그인) · `mikeyobrien/ralph-orchestrator`(2.9k, 7-CLI). 단 uzys:auto 와 기능이 **부분 중복**이라 현재 큐레이션 세트엔 미포함(필요 시 사용자가 직접 추가). `ghuntley/loom` 은 proprietary("do not use") — 제외.

---

## 큐레이션 기준 (왜 이것만)

1. **검증(Trust Tier)** — official(Anthropic·본 하네스) / vetted(★≥1000+활성) / experimental(★<1000, opt-in). [`src/external-assets.ts`](../src/external-assets.ts) `TRUST_TIER` SSOT, 월 cron drift 감지(`trust-tier-drift.yml`).
2. **설치 가능 + Node 모델 적합** — uv/Python 의존이나 대화형-전용은 자동설치 제외(추천만).
3. **철학 차별 + 중복 회피** — 같은 엔진 re-wrapper, uzys:auto 와 기능 중복(claude-flow/oh-my-claudecode 등)은 제외.
4. **라이선스** — permissive 우선. copyleft(GPL/AGPL)·Commons-Clause·proprietary 는 신중(현재 세트는 전부 MIT).
5. **보안 vetting (ADR-021 wedge)** — Snyk "ToxicSkills" 가 skill 의 36%에서 prompt injection 발견. 자산 보안 스캔은 A 단계(`docs/COMPATIBILITY.md`)에서 공개 예정.

> 제외된 후보·전체 평가: [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md).

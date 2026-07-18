# 워크플로 큐레이션 가이드 — 어떤 개발 워크플로를 고를까

> **갱신**: 2026-06-06 (v26.75.0, ADR-021) · **anchor**: [`NORTH_STAR.md`](NORTH_STAR.md) · **근거**: [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md)
>
> agent-harness 의 본질 = **검증된 워크플로/자산 큐레이터**. "무엇이든 설치"가 아니라, AI 코딩 워크플로 시스템들을 **검증해서 고르게** 해준다. **skill·rule 자산은 4개 CLI(Claude Code · Codex · OpenCode · Antigravity)에 동등 설치**되고, **plugin 계열(superpowers/ecc 등)은 Claude Code 전용** — claude 를 선택하지 않은 설치에서는 시도되지 않고 `EXCLUDED` 로 고지된다(v26.102.0 ADR-031; 자산별 도달 범위는 `COMPATIBILITY.md` CLI 열 참조). 이 문서는 *어떤 워크플로를 골라야 하나*에 답한다.
>
> 마켓플레이스가 1개(2025-12)→8개(2026 Q2)로 늘며 **"skill 찾기보다 비교에 시간을 더 쓰는"** 과부하가 생겼다. 이 가이드가 그 비교를 대신한다.

---

## 한눈에 — 설치 가능 워크플로 (7)

설치 = 인터랙티브 위저드의 **Workflow 카테고리**에서 선택, 또는 `npx -y @uzysjung/agent-harness install --track <t> --with <id>`.

| 워크플로 | id | 출처 | ★ | Tier | 설치 | 한 줄 정체 |
|---|---|---|---|---|---|---|
| **Superpowers** | `superpowers` | obra → anthropics 공식 | 235k | official | plugin | agentic skills 프레임워크. `/spec /plan …`(no-namespace) |
| **ECC** | `ecc-plugin` | affaan-m | 219k | vetted | plugin | 60 agents·230 skills·75 commands 종합 패키지(kitchen-sink) |
| **OpenSpec** | `openspec` | Fission-AI | 56k | vetted | npm | **spec-driven brownfield delta**(propose→apply→archive) |
| **BMAD-METHOD** | `bmad-method` | bmad-code-org | 49k | vetted | npx | **멀티-에이전트 애자일**(PM/Architect/Dev, 12+ agents) |
| **addy agent-skills** | `addy-agent-skills` | addyosmani | 65k | vetted | plugin | general dev `/spec /plan` (경량) |
| **wshobson agents** | `wshobson-agents` | wshobson | 37k | vetted | plugin | 멀티-에이전트 오케스트레이션(full-stack/tdd/review), cross-CLI |
| **feature-dev** | `feature-dev` | anthropics 공식 | — | official | plugin | 가이드된 단일 기능 개발 루프(탐색→설계→구현) + 전용 에이전트 3종(architect/explorer/reviewer) |

> `v26.75.0` 추가(ADR-021): OpenSpec · BMAD · wshobson — 3-에이전트 시장 리서치로 발굴, vetted 바(★≥1000+활성+설치가능) 통과분.
> `v26.110.0` 추가(ADR-039): feature-dev — 오피셜 마켓플레이스 큐레이션 배치. ★는 마켓플레이스 모노레포 소속이라 비적용(—).
>
> ★ 수치 = GitHub `stargazers_count` 실측, **측정일 2026-06-22** (천 단위 반올림; 이전 06-13 대비 refresh — addy 57→65k 등). 출처 repo: obra/superpowers · affaan-m/ECC · Fission-AI/OpenSpec · bmad-code-org/BMAD-METHOD · addyosmani/agent-skills · wshobson/agents.

---

## 어떤 걸 골라야 하나 (의사결정)

- **스킬/하위에이전트 프레임워크**로 능력을 확장 → **Superpowers**(공식, 가장 안전).
- **다 깔고 골라쓰기**(에이전트·스킬·커맨드 대량) → **ECC**. 단 무겁다.
- **기존 코드베이스에 점진 변경(brownfield)** 을 spec-driven 으로 → **OpenSpec**(delta 기반).
- **애자일 팀 시뮬레이션**(PM→Architect→Dev 역할 분담) → **BMAD-METHOD**.
- **가벼운 spec/plan 슬래시**만 → **addy agent-skills**.
- **멀티-에이전트 오케스트레이션 + 다(多)CLI 일관성** → **wshobson agents**.
- **가이드된 단일 기능 개발 루프**(탐색→설계→리뷰, 공식·경량) → **feature-dev**.

> 택1+ 가능(상호 배타 아님). 단 슬래시 네임스페이스 충돌(`/spec` 등)은 의식할 것.

---

## 언제 방법론 워크플로가 필요 없는가 (2026-07-17 · ADR-032)

프론티어 모델(Opus 4.8 / GPT-5.6급)에서는 **애자일 방향성 + git/PR 정책 고정**만으로 충분한 경우가
많다 — 방법론 구조는 기본값이 아니라 **조건이 맞을 때 고르는 도구**다(그래서 전부 opt-in·비체크).
판단 기준:

| 조건 | 방법론 없이 충분 (원칙 + 강한 모델) | 방법론 워크플로 유효 |
|---|---|---|
| 인원 | 1인 (에이전트 오케스트레이션 포함) | 3인+ / 주니어 온보딩 — 사람 간 합의·교육 프로토콜 필요 |
| 코드베이스 | greenfield / 스파이크 | 대규모 brownfield — 기존 invariant 보호 (OpenSpec delta 등) |
| 수명 | 수일~수주 (throwaway 포함) | 6개월+ — 담당 교체가 단일 세션 컨텍스트 수명 초과 |
| 규제/감사 | 없음 | 있음 — 요구→설계→테스트 추적 체인 = spec artifact 자체가 감사 트레일 |
| 동시 개발 | 단일 세션 순차 | 병렬 세션·멀티에이전트 — 동시성이 늘수록 공유 계약(spec/delta)이 **더** 필요 |

> 오른쪽 열은 **모델이 좋아져도 남는 인간측 문제**다 — 모델 업그레이드가 풀어주지 않는다.
> 왼쪽 열에 해당하면 Workflow 카테고리를 건너뛰어도 된다: 하네스 기본 설치(rules + 인사이트
> 스킬)가 그 역할을 한다.

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

**Ralph** 는 설치 가능한 워크플로가 아니라 *기법*이다: "신선한 에이전트를 루프로 돌려 목표 충족까지 eventual-consistency 로 수렴"(Geoffrey Huntley).

외부 설치형 Ralph 패키징도 존재한다 — `snarktank/ralph`(20k, MIT, CC 플러그인) · `mikeyobrien/ralph-orchestrator`(2.9k, 7-CLI). 단 *기법*이라 설치형 워크플로 큐레이션 세트엔 미포함(필요 시 사용자가 직접 추가). `ghuntley/loom` 은 proprietary("do not use") — 제외.

---

## 큐레이션 기준 (왜 이것만)

1. **검증(Trust Tier)** — official(Anthropic·본 하네스) / vetted(★≥1000+활성) / experimental(★<1000, opt-in). [`src/external-assets.ts`](../src/external-assets.ts) `TRUST_TIER` SSOT, 월 cron drift 감지(`trust-tier-drift.yml`).
2. **설치 가능 + Node 모델 적합** — uv/Python 의존이나 대화형-전용은 자동설치 제외(추천만).
3. **철학 차별 + 중복 회피** — 같은 엔진 re-wrapper, 기존 큐레이션 자산과 기능 중복(claude-flow/oh-my-claudecode 등)은 제외.
4. **라이선스** — permissive 우선. copyleft(GPL/AGPL)·Commons-Clause·proprietary 는 신중(현재 세트는 전부 MIT).
5. **보안 vetting (ADR-021 wedge)** — Snyk "ToxicSkills" 가 skill 의 36%에서 prompt injection 발견. 자산 보안 스캔은 A 단계(`docs/COMPATIBILITY.md`)에서 공개 예정.

> 제외된 후보·전체 평가: [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md).

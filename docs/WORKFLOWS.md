# 워크플로 큐레이션 가이드 — 어떤 개발 워크플로를 고를까

> **갱신**: 2026-09-20 (★ 재측정) · 큐레이션 근거: ADR-021 · [`NORTH_STAR.md`](NORTH_STAR.md) · [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md)
>
> agent-harness 의 핵심 역할은 **검증된 워크플로와 자산을 큐레이션**하는 것이다. "무엇이든 설치"가 아니라, AI 코딩 워크플로 시스템들을 **검증해서 고르게** 해 준다. **skill·rule 자산은 4개 CLI(Claude Code · Codex · OpenCode · Antigravity)에 모두 설치**되지만, **plugin 계열(superpowers/ecc 등)은 Claude Code 에서만 쓸 수 있다.** Claude 를 선택하지 않은 설치에서는 플러그인 설치를 시도하지 않고 `EXCLUDED` 로 안내한다(ADR-031; 자산별 지원 CLI 는 `COMPATIBILITY.md` 의 CLI 열 참조). 이 문서는 *어떤 워크플로를 골라야 하나*에 답한다.
>
> 마켓플레이스가 1개(2025-12)에서 8개(2026 Q2)로 늘어나면서 **"스킬을 찾기보다 비교하는 데 시간을 더 쓰는"** 문제가 생겼다. 이 가이드가 그 비교를 대신한다.

---

## 한눈에 — 설치 가능 워크플로 (7)

설치 방법: 인터랙티브 위저드 3단계의 **Workflow & ECC Suite** 페이지에서 고르거나, `npx -y @uzysjung/agent-harness install --track <t> --with <id>` 를 실행한다. 전부 opt-in 이라 트랙이 미리 체크하지 않는다.

| 워크플로 | id | 출처 | ★ | Tier | 설치 | 한 줄 정체 |
|---|---|---|---|---|---|---|
| **Superpowers** | `superpowers` | obra → anthropics 공식 | 289k | official | plugin | agentic skills 프레임워크. `/spec /plan …`(no-namespace) |
| **ECC** | `ecc-plugin` | affaan-m | 263k | vetted | plugin | 60 agents·230 skills·75 commands 종합 패키지(kitchen-sink) |
| **OpenSpec** | `openspec` | Fission-AI | 70k | vetted | npm | **spec-driven brownfield delta**(propose→apply→archive) |
| **BMAD-METHOD** | `bmad-method` | bmad-code-org | 53k | vetted | npx | **멀티-에이전트 애자일**(PM/Architect/Dev, 12+ agents) |
| **addy agent-skills** | `addy-agent-skills` | addyosmani | 97k | vetted | plugin | general dev `/spec /plan` (경량) |
| **wshobson agents** | `wshobson-agents` | wshobson | 40k | vetted | plugin | 멀티-에이전트 오케스트레이션(full-stack/tdd/review), cross-CLI |
| **feature-dev** | `feature-dev` | anthropics 공식 | — | official | plugin | 가이드된 단일 기능 개발 루프(탐색→설계→구현)와 전용 에이전트 3종(architect/explorer/reviewer) |

> OpenSpec · BMAD · wshobson 은 3-에이전트 시장 리서치로 발굴해 검증 기준(★ 1,000 이상 · 활성 · 설치 가능)을 통과한 것이고(ADR-021), feature-dev 는 공식 마켓플레이스 큐레이션에서 왔다(ADR-039). feature-dev 의 ★ 가 비어 있는 이유는 마켓플레이스 모노레포 소속이라 단독 수치가 없기 때문이다.
>
> ★ 는 GitHub `stargazers_count` 실측값으로 **측정일 2026-09-20**, 천 단위 반올림이다. 출처 저장소: obra/superpowers · affaan-m/ECC · Fission-AI/OpenSpec · bmad-code-org/BMAD-METHOD · addyosmani/agent-skills · wshobson/agents.

---

## 어떤 걸 골라야 하나 (의사결정)

- **스킬/하위에이전트 프레임워크**로 능력을 확장 → **Superpowers**(공식, 가장 안전).
- **다 깔고 골라쓰기**(에이전트·스킬·커맨드 대량) → **ECC**. 단 무겁다.
- **기존 코드베이스(brownfield)를 스펙 기반으로 점진적으로 바꾸려면** → **OpenSpec**(delta 기반).
- **애자일 팀 시뮬레이션**(PM→Architect→Dev 역할 분담) → **BMAD-METHOD**.
- **`/spec`, `/plan` 같은 가벼운 슬래시 명령어**만 필요하면 → **addy agent-skills**.
- **멀티-에이전트 오케스트레이션 + 다(多)CLI 일관성** → **wshobson agents**.
- **가이드된 단일 기능 개발 루프**(탐색→설계→리뷰, 공식·경량) → **feature-dev**.

> 여러 개를 함께 골라도 된다. 단, `/spec` 처럼 슬래시 명령어 이름이 겹칠 수 있으니 주의한다.

---

## 언제 방법론 워크플로가 필요 없는가 (2026-07-17 · ADR-032)

프론티어 모델(Opus 4.8 · GPT-5.6급)에서는 **애자일 방향성과 git/PR 정책을 정해 두는 것**만으로 충분한
경우가 많다. 방법론 워크플로는 기본값이 아니라 **조건이 맞을 때 고르는 도구**다(그래서 전부 opt-in 이고
미리 체크되지 않는다). 판단 기준:

| 조건 | 방법론 없이 충분 (원칙 + 강한 모델) | 방법론 워크플로 유효 |
|---|---|---|
| 인원 | 1인 (에이전트 오케스트레이션 포함) | 3인+ / 주니어 온보딩 — 사람 간 합의·교육 프로토콜 필요 |
| 코드베이스 | greenfield / 스파이크 | 대규모 brownfield — 기존 invariant 보호 (OpenSpec delta 등) |
| 수명 | 수일~수주 (throwaway 포함) | 6개월+ — 담당 교체가 단일 세션 컨텍스트 수명 초과 |
| 규제/감사 | 없음 | 있음 — 요구→설계→테스트 추적 체인 = spec artifact 자체가 감사 트레일 |
| 동시 개발 | 단일 세션 순차 | 병렬 세션·멀티에이전트 — 동시성이 늘수록 공유 계약(spec/delta)이 **더** 필요 |

> 오른쪽 열은 **모델이 좋아져도 사람 쪽에 남는 문제**라 모델 업그레이드가 풀어 주지 않는다.
> 왼쪽 열에 해당하면 Workflow 페이지를 건너뛰어도 된다. 하네스 기본 설치(룰 + 번들 방법론 스킬)가
> 그 역할을 한다 — 목록은 [`TRACKS.md`](TRACKS.md#what-every-track-gets).

---

## 추천하되 자동설치 안 함 (정직)

우리 Node 기반 비대화형 설치 방식에 맞지 않아도, 가장 좋은 도구라면 추천한다. 다만 **자동으로 설치할 수 없는 것을 "설치된다"고 광고하지는 않는다.**

| 워크플로 | ★ | 왜 추천 | 왜 자동설치 안 하나 | 직접 설치 |
|---|---|---|---|---|
| **GitHub Spec Kit** | 138k | spec-driven 카테고리 **리더**, GitHub 공식, 20-30 에이전트 | **uv/Python 의존** + 대화형 `specify init` → Node-only·비대화형 모델 위반 (NORTH_STAR 트레이드오프) | `uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z` → `specify init` |
| **Kiro** | 3.8k | AWS 의 spec-driven **IDE/CLI** | **closed-source 제품** — 다른 CLI에 설치하는 자산이 아님 | [kiro.dev](https://kiro.dev) 다운로드 |

> ★ 측정일 2026-09-20: Spec Kit = `github/spec-kit` 실측. Kiro 는 closed-source(공개 repo 없음)라 ★ 를 확정할 수 없어 기존 표기를 유지한다.

---

## 기법 (워크플로 아님) — Ralph loop

**Ralph** 는 설치 가능한 워크플로가 아니라 *기법*이다: "새 에이전트를 반복해서 띄워 목표를 만족할 때까지 결과가 점차 수렴하게 하는 방식"(Geoffrey Huntley).

외부 설치형 Ralph 패키징도 존재한다 — `snarktank/ralph`(20k, MIT, CC 플러그인) · `mikeyobrien/ralph-orchestrator`(2.9k, 7-CLI). 단 *기법*이라 설치형 워크플로 큐레이션 세트엔 미포함(필요 시 사용자가 직접 추가). `ghuntley/loom` 은 proprietary("do not use") — 제외.

---

## 큐레이션 기준 (왜 이것만)

1. **검증(Trust Tier)** — official(Anthropic · 본 하네스) / vetted(★ 1,000 이상 · 활성) / experimental(★ 1,000 미만, opt-in). 등급의 SSOT 는 [`src/external-assets.ts`](../src/external-assets.ts) 의 각 자산 `tier` 이고, 매월 cron 이 ★ 변동을 감지한다(`trust-tier-drift.yml`).
2. **설치 가능 + Node 모델 적합** — uv/Python 의존이나 대화형-전용은 자동설치 제외(추천만).
3. **철학 차별 + 중복 회피** — 같은 엔진 re-wrapper, 기존 큐레이션 자산과 기능 중복(claude-flow/oh-my-claudecode 등)은 제외.
4. **라이선스** — permissive 우선. copyleft(GPL/AGPL)·Commons-Clause·proprietary 는 신중(현재 세트는 전부 MIT).
5. **보안 vetting (ADR-021 wedge)** — Snyk "ToxicSkills" 가 skill 의 36%에서 prompt injection 발견. 자산 보안 스캔은 A 단계(`docs/COMPATIBILITY.md`)에서 공개 예정.

> 제외된 후보·전체 평가: [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md).

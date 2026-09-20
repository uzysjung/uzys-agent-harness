# 워크플로 큐레이션 가이드 — 어떤 개발 워크플로를 고를까

> **갱신**: 2026-09-20 (★ 재측정) · 큐레이션 근거: ADR-021 · [`NORTH_STAR.md`](NORTH_STAR.md) · [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md)
>
> agent-harness 의 핵심 역할은 **검증된 워크플로와 자산을 큐레이션**하는 것이다. "무엇이든 설치"가 아니라, AI 코딩 워크플로 시스템들을 **검증해서 고르게** 해 준다. **skill·rule 자산은 4개 CLI(Claude Code · Codex · OpenCode · Antigravity)에 모두 설치**되지만, **plugin 계열(security-guidance · Supabase 스킬 등)은 Claude Code 에서만 쓸 수 있다.** Claude 를 선택하지 않은 설치에서는 플러그인 설치를 시도하지 않고 `EXCLUDED` 로 안내한다(ADR-031; 자산별 지원 CLI 는 `COMPATIBILITY.md` 의 CLI 열 참조). 이 문서는 *어떤 워크플로를 골라야 하나*에 답한다.
>
> 마켓플레이스가 1개(2025-12)에서 8개(2026 Q2)로 늘어나면서 **"스킬을 찾기보다 비교하는 데 시간을 더 쓰는"** 문제가 생겼다. 이 가이드가 그 비교를 대신한다.

---

## 한눈에 — 설치 가능 워크플로 (2)

설치 방법: 인터랙티브 위저드 3단계의 **Workflow** 페이지에서 고르거나, `npx -y @uzysjung/agent-harness install --track <t> --with <id>` 를 실행한다. 둘 다 opt-in 이라 트랙이 미리 체크하지 않는다.

| 워크플로 | id | 출처 | ★ | Tier | 설치 | 언제 쓰나 |
|---|---|---|---|---|---|---|
| **OpenSpec** | `openspec` | Fission-AI | 70k | vetted | npm | 기존 코드베이스를 **스펙과 델타(propose → apply → archive)** 로 바꾸는 팀 계약. 팀이 그 명세 체계를 실제로 채택했을 때 |
| **BMAD-METHOD** | `bmad-method` | bmad-code-org | 53k | vetted | npx | **역할 고정 멀티에이전트 애자일**(PM / Architect / Dev). 팀 규모 전달에 한정하고, 핀된 6.9.0 은 전체 절차를 돈다 |

> ★ 는 GitHub `stargazers_count` 실측값으로 **측정일 2026-09-20**, 천 단위 반올림이다.
>
> **2026-09-20 에 퇴역한 것(ADR-093 · #492)**: Superpowers · feature-dev · wshobson agents · addy agent-skills · ECC 플러그인. 공통 이유는 하나다 — 모델이 스스로 고를 수 있는 절차(브레인스토밍 호출 · 7단계 고정 · 단계 병합 금지 · 별도 방법론 체계 · 5-에이전트 고정 리뷰)를 미리 정해 두어 **방법 선택을 모델에게 맡기는 원칙과 반대로 작동**했다. 원본 저장소의 가치를 부정한 것이 아니라 이 하네스의 선택지에서 뺀 것이다. 이미 설치한 프로젝트는 `uninstall` 로 뺀다.

---

## 어떤 걸 골라야 하나 (의사결정)

- **지속되는 요구사항·변경 명세를 사람과 에이전트가 공유**해야 한다(brownfield · 다인 팀) → **OpenSpec**.
- **역할 분담이 고정된 팀 시뮬레이션**(PM → Architect → Dev)이 필요하다 → **BMAD-METHOD**.
- 그 밖의 경우 — 아래 표의 왼쪽 열 — 는 워크플로 묶음 없이 하네스 기본 설치로 충분하다.

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
3. **철학 차별 + 중복 회피** — 같은 엔진 re-wrapper, 기존 큐레이션 자산과 기능 중복(claude-flow/oh-my-claudecode 등)은 제외. **모델의 방법 선택을 대신하는 고정 절차 체계도 제외**(ADR-093).
4. **라이선스** — permissive 우선. copyleft(GPL/AGPL)·Commons-Clause·proprietary 는 신중(현재 세트는 전부 MIT).
5. **보안 vetting (ADR-021 wedge)** — Snyk "ToxicSkills" 가 skill 의 36%에서 prompt injection 발견. 자산 보안 스캔은 A 단계(`docs/COMPATIBILITY.md`)에서 공개 예정.

> 제외된 후보·전체 평가: [`research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md).

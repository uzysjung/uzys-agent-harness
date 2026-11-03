# ADR-119: OpenCode 가 섞인 조합도 경로 룰은 `AGENTS.md` 에서 룰 파일을 가리킨다

- Status: Accepted
- Date: 2026-11-03
- PR: (머지 직전에 채운다)
- Issue: #960
- Amends: ADR-117 · ADR-118 — 조건 ②("OpenCode ∉ 집합")를 걷는다. 조건 ① 은 "Codex 또는 OpenCode ∈ 집합"이 된다
- 근거 = `docs/research/codex-rule-pointer-2026-11.md` §5차

## Context

- ADR-117 · ADR-118 은 OpenCode 가 섞인 설치를 포인터에서 뺐다. OpenCode 가 같은 형식의 포인터를 따르는지 재지 않았기 때문이다. 그래서
  claude + codex + opencode(± antigravity) · codex + opencode + antigravity · claude + opencode 는 경로 룰(`paths:`)의 본문을 `AGENTS.md`
  인라인으로 매 세션 실었다. 같은 룰이 `.claude/rules/` 나 `.agents/rules/` 에 하네스 판으로 이미 있는데도 그랬다.
- 실 OpenCode 2.2.5 가 실제 4 CLI 설치본에서 같은 형식의 포인터를 **6/6** 따랐다. 결과는 `.claude/rules/ui-components.md` 3/3 + 1/1,
  `.agents/rules/ui-components.md` 2/2 이고, 대조군(룰 없음)은 0/2 였다. 모두 `.tsx` 를 쓰기 전에 그 파일을 읽었다(§5차).
- 근거의 두께는 이렇다. 모델과 강도는 하나씩(`gpt-6-astra` xhigh, Codex 측정과 같다)이고, 측정 환경은 셸 · 웹 · 하위 에이전트를 끈 상태였다.
  설치자 환경은 셸이 열려 있다. 셸이 열린 첫 실행 1회도 읽고 나서 고쳤지만 표에는 넣지 않았다.
- 인라인 렌더는 codex + opencode + antigravity 의 두 트랙 조합 91개 중 **13개**가 Antigravity 의 24,000 B 를 넘는다(최대 24,955 B,
  2026-11-03 실측). 넘는 부분은 뒤의 `## Harness Rules` 부터 잘린다(ADR-116).

## Decision

1. **조건 ② 를 걷는다.** `AGENTS.md` 를 읽는 집합에 Codex **또는** OpenCode 가 있으면 경로 룰 포인터 판정(ADR-118 의 ③a · ③b 와
   ADR-117 의 ④ 절 모델)으로 간다. 판정 · 렌더 · 줄 형식 · 대상 폴더는 ADR-117 · ADR-118 그대로다. 하나라도 거짓이면 인라인이다.
2. **ADR-116 의 위치 안내가 우선이다.** 그 안내가 서는 실행에서는 렌더가 위치 안내를 쓰고 이 값은 쓰이지 않는다. 그 실행이란 Codex 가
   없고, OpenCode 와 Antigravity 가 함께 있고, `rulesViaInstructions` 가 참인 실행이다. 렌더 바이트는 v26.183.0 과 같다.
3. **`uninstall --cli` · `--track` 의 재렌더는 그대로 인라인이다.** 쓰기 가능 사전 검사(ADR-118 결정 3)도 그대로다. OpenCode 가 섞인
   집합이라고 해서 새 재렌더 대상이 생기지는 않는다. `--cli claude` 는 ADR-118 이 이미 덮는다.

## Alternatives (기각)

- **OpenCode 는 `opencode.json` `instructions` 로만 룰을 받게 한다(ADR-116 을 Codex 섞인 집합으로 넓히기)** — Codex 는 `instructions`
  를 읽지 않는다. Codex 가 섞이면 `AGENTS.md` 에 무언가가 남아야 하는데, 그것이 바로 이 포인터다. 원소를 하나 더 두면 OpenCode 가 같은
  룰을 두 번 읽는다.
- **셸이 열린 환경에서 더 잰 뒤 결정한다** — 열린 1회도 따랐다. 포인터를 놓쳐도 결과는 "그 파일을 고칠 때 룰을 못 본다"이고, 0번이
  되는 실행은 아래 불변식이 막는다. 되돌리기는 조건 한 줄이다.

## Consequences

- 새로 포인터가 되는 집합과 대상 폴더:
  - claude + codex + opencode → `.claude/rules/`
  - claude + codex + opencode + antigravity, codex + opencode + antigravity → `.agents/rules/`
  - claude + opencode(Antigravity · Codex 없음) → `.claude/rules/`
  - ADR-116 집합에서 위치 안내가 그 실행에 서지 못하는 부분 실행(OpenCode 를 고르지 않은 `install --cli`) → 그 실행이 쓴 폴더.
    다음 update 에 위치 안내로 돌아간다.
- 불변식: **하네스가 남긴 상태에서 시작한 실행은 Codex · OpenCode 가 경로 룰을 0번 받게 두지 않는다**(예외 둘은 아래 감수 ⓔ ⓕ).
  `tests/opencode-rules-pointer-960.test.ts` 가 바뀌는 집합 넷과 대표 전이를 문다 — 집합 15종 × 두 단계 약 700가지는 독립 리뷰가 실설치로 쟀다. 셈은 인라인 본문, 포인터가 가리키는 실재 파일, OpenCode 의 `instructions` 글롭 셋이다.
- 크기: 포인터 렌더는 codex + opencode + antigravity 최대 21,588 B 로 24,000 B 를 넘는 조합이 0/91 이다(인라인은 13/91).
  claude + codex + opencode 는 최대 24,940 → 21,573 B, claude + opencode 는 24,417 → 21,050 B 다(`tests/agents-md-size-budget.test.ts`).
- (감수) 근거 두께는 위 Context 그대로다. 셸을 끈 환경 · 모델과 강도 하나 · 6/6 + 열린 1회다.
- (감수) OpenCode 도 가리킨 파일의 frontmatter(`paths:` · `trigger: glob`)를 본문으로 함께 읽는다. ADR-117 · ADR-118 과 같다.
- (감수) ADR-118 의 ⓐ(`update --only external`), ⓑ(`.claude/` 를 VCS 에서 뺀 클론), ⓓ(재렌더 = 인라인 → 다음 update 포인터)가
  OpenCode 가 섞인 집합에도 그대로 적용된다.
- (감수 ⓔ) 설치자가 가리킨 룰 파일을 지운 뒤 그 폴더를 쓰지 않는 부분 update(`--only skills` · `.agents/rules/` 포인터면 `--only rules`)를
  돌리면 그 룰은 다음 전체 update 까지 0번이다 — ADR-117 이 감수한 "설치자가 가리킨 파일을 지운 경우" 와 같다(claude + opencode 에서 새로 생긴다).
- (감수 ⓕ) uninstall 이 룰 파일을 지우는 도중 다른 이유로 죽으면 포인터가 빈 자리를 가리킬 수 있다 — ADR-118 감수 ⓔ 와 같고, 권한을 고친 뒤 같은
  명령을 다시 돌리면 인라인으로 돌아온다.

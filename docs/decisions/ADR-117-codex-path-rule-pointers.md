# ADR-117: Codex + Antigravity 조합의 경로 룰은 `AGENTS.md` 에서 `.agents/rules/<룰>.md` 를 가리킨다

- Status: Accepted
- Date: 2026-11-03
- PR: #950
- Issue: #948
- Amends: ADR-116 — 결정 1 의 "인라인 룰 = 룰 본문 전부"(Codex 가 섞인 집합) · Consequences 의 "Codex 가 섞인 설치의 Antigravity
  이중 읽기는 그대로다"
- 설계 = `docs/plans/948-design.md` · 근거 = `docs/research/codex-rule-pointer-2026-11.md`
- Amended by: ADR-118 (#953) — 조건 ③ 을 "이번 실행이 이번 룰 전부를 한 룰 폴더에 썼다" 로(Claude Code + Codex 는 `.claude/rules/`) ·
  `uninstall --cli claude` 재렌더 · 재렌더 전 `AGENTS.md` 쓰기 가능 확인
- Amended by: ADR-119 (#960) — 조건 ②("OpenCode ∉ 집합")를 걷는다 — OpenCode 가 섞인 집합도 포인터(ADR-116 위치 안내가 서면 그쪽 우선)

## Context

- Codex 는 `AGENTS.md` 안의 경로를 로더가 따라가지 않는다(`codex-rs/core/src/agents_md.rs` — 폴더마다 파일 하나를 이어 붙인다,
  include 요청 openai/codex#6038 · #17401 OPEN). 그래서 ADR-116 까지 Codex 가 섞인 집합은 룰 본문 전부를 `## Harness Rules` 에
  인라인했고, 경로가 정해진 룰(`paths:` — `cli-development` · `ui-components` · `htmx-*-ui`)도 매 세션 상주했다. 같은 룰을 Claude
  Code 는 그 파일을 고칠 때만 읽는다. 두 트랙 조합 12개에서 인라인 렌더가 Antigravity 의 24,000 B 를 넘는다(최대 24,895 B — 넘는
  것은 룰 사본의 뒷부분, ADR-116).
- 실 Codex(codex-cli 0.163.0 · `gpt-6-astra`, `xhigh` · `medium`)가 조건부 포인터("아래 파일을 만들거나 고치기 전에 그 룰을 읽고
  따른다 — 본문은 여기 없다." + 글롭 → `.agents/rules/<룰>.md` 목록)를 **15/15** 따랐다 — 작업 문장에 대상 파일 종류가 없는 "덤으로
  고치기" 작업 포함, 모두 대상 파일을 쓰기 전에 룰 파일을 읽었다. 인라인 6/6 · 룰 없음 0/4(연구 문서 §결과 · §2차 측정).
- 늘 적용되는 룰 · Working Principles 를 포인터로 바꾸는 근거는 없다(시작 포인터 B2 는 끝난 실행 1회).

## Decision

1. **조건(`pathRulesViaFiles`) — 넷이 모두 참일 때만 경로 룰을 포인터로.** ① Codex ∈ `AGENTS.md` 집합 ② OpenCode ∉ 그 집합(OpenCode 의
   포인터 따르기는 재지 않았다) ③ Antigravity 변환이 이번 실행에 이번 룰 전부를 `.agents/rules/` 에 썼다(`wroteEveryRule` — ADR-116 과
   같은 함수) ④ `AGENTS.md` 가 절 모델이다(`agentsMdModelFor` — 첫 접촉 블록은 굳을 수 있어 늘 인라인, ADR-116 결정 2 ⑤ 와 같은 이유).
   하나라도 거짓이면 v26.181.0 과 같은 인라인. `uninstall --cli` 재렌더는 `.agents/rules/` 를 쓰지 않으므로 거짓을 넘긴다.
2. **렌더 — `rules` 블록 안에서 상시 룰 본문은 그대로, 경로 룰 본문 자리(맨 끝)에 목록 하나.** 머리 문장과 줄 형식은 측정한 판과 같은 바이트다(감싸는 블록 · 앞의 `---` 는 측정 픽스처에 없던 하네스 구조다):
   머리 줄 `> 아래 파일을 만들거나 고치기 전에 그 룰을 읽고 따른다 — 본문은 여기 없다.` 다음 룰마다
   `` > - `<glob>` · `<glob>` → `.agents/rules/<룰>.md` ``(글롭 = 그 룰의 `paths:`, 줄 순서 = 경로 룰의 렌더 순서). 목록은 룰 사이와
   같은 `---` 로 앞 룰과 가른다. 경로 룰이 없는 집합은 목록 없이 인라인과 같은 바이트.
3. **화면 — update 의 상주 비용 줄은 실제로 있는 자리를 말한다.** 포인터 판이면 상시 룰은 `inside AGENTS.md`(토큰은 그 파일 숫자에),
   경로 룰은 디스크의 `AGENTS.md` 가 가리키는 `.agents/rules/<룰>.md` 의 수 · 토큰(`+ N in .agents/rules ~T`) — ADR-116 화면 수정과 같은
   원칙(디스크 바이트로 본다).

## Alternatives (기각)

- **경로 룰을 스킬로**(연구 C 조건 5/5) — 같은 본문을 두 번째 자산으로 깔고 기록해야 한다. 포인터는 Antigravity 가 이미 쓰고 기록하는
  파일을 가리켜 새 하네스 파일 · 소유 기록이 없다.
- **늘 적용되는 룰까지 시작 포인터로**(연구 B2) — 근거 부족(끝난 실행 1회).
- **Codex 단독 설치에도 포인터** — 가리킬 `.agents/rules/` 가 없다. 파일을 새로 까는 것은 후속(설계 §2).
- **OpenCode 가 섞인 집합에도** — OpenCode 의 포인터 따르기를 재지 않았다. 측정 전에는 현행 인라인.
- **조건을 집합만으로**(Codex + Antigravity 면 포인터) — Antigravity 를 안 고른 실행 · 링크라 룰 하나를 건너뛴 실행 · 재렌더에서
  포인터가 없는 파일을 가리킨다(ADR-116 Alternatives 와 같은 이유).

## Consequences

- Codex + Antigravity(+ Claude Code) 설치에서 Codex 는 `.tsx` · `.sh` · htmx 화면 파일을 고칠 때만 그 룰을 읽고, 그 밖의 세션에는 싣지
  않는다. 그 조합의 `AGENTS.md` 는 두 트랙 조합 전부에서 24,000 B 안이다(최대 21,528 B, `tests/agents-md-size-budget.test.ts`) — ADR-116
  의 "넘으면 잘리는 것은 룰 사본" 이 이 조합에서는 일어나지 않는다. Antigravity 의 경로 룰 이중 읽기(인라인 사본 + `.agents/rules/`)도
  이 조합에서 없어진다. 상시 룰의 이중 읽기는 그대로다(감수, ADR-103).
- 집합이 바뀌는 실행은 새 경로 없이 다음 update 에 수렴한다(설계 §3 표 · `tests/codex-path-rule-pointers-948.test.ts` — 행마다 Codex 가
  설치된 경로 룰 전부를 인라인 본문이나 실재 파일로 받는다). 포인터는 이번 실행이 실재를 보장한 파일만 가리킨다 — 이 결정이
  Codex 가 경로 룰을 0번 받는 실행을 새로 만들지 않는다. 남는 것은 main 과 같은 기존 사각 둘이다: 같은 실행에서 `AGENTS.md` 를 읽는
  CLI 전부와 함께 트랙을 더하면 앞 트랙 룰이 다음 update 까지 빠지는 일(Codex 단독도 같다), 그리고 `AGENTS.md` 가 읽기 전용인 채
  `uninstall --cli antigravity` 를 하면 룰 파일을 지운 뒤 `AGENTS.md` 쓰기가 실패(EACCES, exit 1 로 알린다)해 다음 update 까지 포인터가
  빈 자리를 가리키는 일(그 상태를 만드는 설치자는 관측되지 않았다 — 전량 uninstall 의 쓰기 가능 사전 검사(#676)를 `--cli` 에 넓히는 것은 후속).
- (감수) Codex 가 포인터를 따르는 것은 로더가 아니라 모델의 판단이다 — 측정은 모델 하나(`gpt-6-astra`) · 작업 두 종류 · 짧은 세션이다
  (연구 §남는 한계). 다른 모델 · 긴 세션에서 덜 따를 수 있다.
- (감수) 설치자가 가리킨 `.agents/rules/<룰>.md` 를 지우면 다음 update 까지 Codex 가 그 룰을 못 받는다 — update 가 파일을 되살린다
  (ADR-099 R1). 설치자가 그 파일을 고치면 Codex 도 고친 판을 읽는다(Antigravity 와 같다).
- (감수) `.agents/rules/<룰>.md` 는 Antigravity 판(frontmatter `trigger: glob` 포함)이다 — Codex 는 그 줄을 본문으로 함께 읽는다.

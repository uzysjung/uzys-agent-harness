# ADR-118: Claude Code + Codex 조합의 경로 룰은 `AGENTS.md` 에서 `.claude/rules/<룰>.md` 를 가리킨다

- Status: Proposed
- Date: 2026-11-03
- PR: (머지 때 채운다)
- Issue: #953
- Amends: ADR-117 — 결정 1 의 ③("Antigravity 가 이번 룰 전부를 `.agents/rules/` 에 썼다")을 "이번 실행이 이번 룰 전부를 한 룰 폴더에 썼다"
  로 넓힌다 · `uninstall --cli` 재렌더 대상에 Claude Code 를 더한다
- 설계 = `docs/plans/953-design.md`(설계 검증 반영본) · 근거 = `docs/research/codex-rule-pointer-2026-11.md` §4차

## Context

- ADR-117 은 Codex + Antigravity(OpenCode 없음)에서만 경로 룰(`paths:`)을 포인터로 바꿨다 — 가리킬 파일이 `.agents/rules/` 뿐이었다.
  Claude Code + Codex 설치본에는 같은 룰이 Claude Code 용으로 `.claude/rules/<룰>.md` 에 이미 있는데, Codex 는 그 룰을 `AGENTS.md`
  인라인으로 매 세션 실었다.
- 실 Codex(`gpt-6-astra` xhigh)가 실제 Claude Code + Codex 설치본에서 `.claude/rules/ui-components.md` 를 가리키는 같은 형식의 포인터를
  **4/4** 따랐다 — `.tsx` 를 쓰기 전에 그 파일을 읽었다(§4차, 덤으로 고치기 3 · 새로 만들기 1). 가리킨 파일은 Claude Code 판 그대로
  (`paths:` frontmatter 포함)다.
- 포인터가 `.claude/rules/` 를 가리키면 그 폴더를 지우는 `uninstall --cli claude` 가 지운 파일을 가리키는 포인터를 남길 수 있다 —
  지금 그 명령은 `AGENTS.md` 를 건드리지 않는다(Claude Code 는 그 파일을 읽지 않는다).

## Decision

1. **조건 ③ 을 둘로.** ① Codex ∈ 집합 ② OpenCode ∉ 집합 ④ 절 모델(ADR-117 그대로)에 더해
   - ③a Antigravity 가 이번 실행에 이번 룰 전부를 `.agents/rules/` 에 썼다 → 그 폴더(ADR-117 과 같은 바이트 — 우선)
   - ③b ③a 가 아니고, 이번 실행의 하네스 writer 가 이번 룰 전부를 `.claude/rules/` 에 남겼다 → 그 폴더
   - 둘 다 아니면 인라인.
   "썼다" 는 이번 실행의 쓰기 결과다 — 디스크 존재가 아니다. ③b 의 근거는 Claude Code 단계(CLI 변환 **앞**)의 writer 원장이다: install =
   `writer.ledger().writes`, update = `updateHarnessFiles(...).wrote`. 둘을 프로젝트 상대 경로 집합 하나(`harnessWrote`)로 `runCliTransforms`
   에 넘기고, ③a · ③b 를 같은 함수(`wroteEveryRule(folder, written, rules)`)로 판정한다. 대조 목록은 렌더하는 `agentsRules`(이번 선택
   밖의 기록 CLI 가 있으면 누적 룰)다 — `rules` 와 대조하면 `install --cli claude --track <새 트랙>` 이 이번에 안 쓴 파일을 가리킨다.
   원장에 없는 자리(프로젝트 밖 링크 · 남의 슬롯)가 있으면 ③b 는 거짓이다.
2. **렌더.** 포인터 머리 문장 · 줄 형식은 ADR-117 그대로, 폴더만 대상 폴더를 따른다(`` → `.claude/rules/<룰>.md` ``). 읽는 쪽
   (`pathRulePointerTargets` · update 화면의 `pointedRuleFiles`)은 포인터 줄이 적은 폴더를 그대로 쓴다.
3. **`uninstall --cli claude` 도 남는 `AGENTS.md` 를 다시 렌더한다**(인라인 — `pathRulesViaFiles: false`). 대상 CLI 와 무관하게 남는 집합에
   `AGENTS.md` 를 읽는 CLI 가 있고 그 파일이 기록에 있으면 늘 재렌더한다 — 디스크의 포인터 줄로 가르지 않는다(행동은 기록 · 집합으로).
   재렌더가 예정된 `uninstall --cli` · `--track` 은 **지우기 전에** `AGENTS.md` 의 쓰기 가능을 확인하고, 불가면 아무것도 지우지 않고 exit 1
   이다(#676 전량 uninstall 과 같은 검사 · 같은 문구).

## Alternatives (기각)

- **디스크의 `.claude/rules/` 존재로 ③b 를 판정** — 설치자가 지운 · 고친 · 링크로 바꾼 파일을 가리킬 수 있다. 원장이 하네스 판을 보장한다.
- **`uninstall --cli claude` 의 재렌더를 디스크 포인터 줄로 트리거** — 디스크 바이트를 행동 결정에 쓰는 첫 분기가 된다(설계 검증 NOTE-4).
  늘 재렌더하는 대가(아래 Consequences ⓓ)가 더 작다.
- **쓰기 불가 `AGENTS.md` 를 감수** — 지운 뒤 재렌더에서 죽으면 포인터가 빈 자리를 가리킨 채 남고, `update` 는 "claude 기록 + `.claude/`
  없음" 을 깨진 설치로 거절한다(설계 검증 BLOCKER-1). 사전 검사가 작고 #676 장치를 그대로 쓴다.
- **Claude Code 단독 · Codex 단독으로 넓히기** — 범위 밖(Codex 단독은 가리킬 파일이 없다).

## Consequences

- Claude Code + Codex(OpenCode 없음)의 Codex 도 `.tsx` · `.sh` · htmx 화면 파일을 고칠 때만 그 룰을 읽는다. claude + codex + antigravity 는
  ③a 우선이라 v26.182.0 과 같은 바이트다. 설계 §2 의 행마다 Codex 가 설치된 경로 룰 전부를 인라인 본문이나 실재 파일로 받는다
  (`tests/codex-claude-rules-pointer-953.test.ts`).
- `uninstall --cli antigravity` 도 같은 사전 검사를 지난다 — ADR-117 이 후속으로 남긴 "쓰기 불가 `AGENTS.md` 에서 지운 뒤 재렌더 실패" 가 닫힌다.
  `AGENTS.md` 를 담은 폴더의 쓰기 가능(재렌더가 백업을 만들 때)은 보지 않는다 — #676 의 공유 파일 검사와 같은 범위다.
- (감수 ⓐ) `update --only external` 은 `.claude/rules/` 를 쓰지 않아 ③b 가 거짓이다 — 포인터가 인라인으로 내려오고 다음 전체 update 가
  되돌린다(0번은 아니다, 설계 검증 NOTE-3). 디스크 존재로 참을 만드는 우회는 원칙 위반이라 두지 않는다.
- (감수 ⓑ) `.claude/` 를 VCS 에서 빼고 `AGENTS.md` 만 커밋한 클론에서는 팀원이 install 하기 전까지 Codex 가 경로 룰을 0번 받는다(ADR-116
  N-1 과 같은 부류).
- (감수 ⓒ) 근거 두께 — 폴더만 다른 같은 형식이고, `.claude/rules/` 측정은 4회 · xhigh 만이다(`.agents/rules/` 는 medium 포함 15/15).
- (감수 ⓓ) `uninstall --cli claude` · `--track` 재렌더는 늘 인라인이라, 포인터 설치본(claude + codex의 `.claude/rules/` · claude + codex + ag 의
  `.agents/rules/`)은 그 한 번 인라인으로 내려오고 다음 update 가 포인터로 되돌린다(ADR-116 이 감수한 "재렌더 = 인라인 → 다음 update
  포인터" 와 같은 부류). 그래서 claude + codex 의 `uninstall --track` 은 룰이 그대로여도 `re-rendered AGENTS.md` 를 말할 수 있다.
- (감수) Codex 는 `.claude/rules/<룰>.md` 의 Claude Code frontmatter(`paths:`) 줄을 본문으로 함께 읽는다(ADR-117 의 `trigger: glob` 과 같다).
- update 화면의 상주 비용 줄은 Claude Code 가 섞인 설치에서 Claude 세션(`.claude/rules/` · `CLAUDE.md`)을 잰다 — Codex 세션의 `AGENTS.md` 는
  그 줄에 없다(현행 표면 규칙). 포인터 줄의 폴더를 읽는 계산은 Codex 표면으로 잴 때 쓰인다.

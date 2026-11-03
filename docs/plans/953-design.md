# #953 설계 — Claude Code + Codex 조합도 경로 룰을 `.claude/rules/` 포인터로

- 이슈: #953 (마일스톤 v26.183.0) · 바탕: ADR-117(#948) · `docs/plans/948-design.md`
- 근거: `docs/research/codex-rule-pointer-2026-11.md` §4차 — 실제 Claude Code + Codex 설치본에서 `.claude/rules/ui-components.md` 포인터 4/4

## 0. 판정 기준 (설치자 자리에서)

Claude Code 와 Codex 를 함께 깐 설치자(OpenCode 없음)의 Codex 도 `.tsx` · `.sh` · htmx 화면 파일을 고칠 때만 그 룰을 읽는다. 이 변경이 Codex 가 경로 룰을
0번 받는 실행을 새로 만들지 않는다 — 포인터는 이번 실행이 이번 룰 전부를 쓴 폴더만 가리킨다.

## 1. 결정

### D1. 조건 ③ 을 "이번 실행이 이번 룰 전부를 어느 한 룰 폴더에 썼다" 로 넓힌다

ADR-117 의 ③(Antigravity 가 이번 룰 전부를 `.agents/rules/` 에 썼다)을 다음으로 바꾼다. 나머지(① codex ∈ 집합 ② opencode ∉ 집합 ④ 절 모델)와
`uninstall --cli` 재렌더의 `false` 는 그대로.

- ③a Antigravity 가 이번 룰 전부를 `.agents/rules/` 에 썼다 → 포인터 대상 `.agents/rules/` (v26.182.0 과 같은 바이트)
- ③b ③a 가 거짓이고, 이번 실행이 Claude Code 로 이번 룰 전부를 `.claude/rules/` 에 썼다(링크 · 남의 슬롯 · 설치자 편집이라 건너뛴 파일이 없다)
  → 포인터 대상 `.claude/rules/`
- 둘 다 거짓 → 인라인

"썼다" 는 이번 실행의 쓰기 결과로 판정한다(디스크 존재가 아니라). Claude Code 룰 파일을 쓰는 단계는 CLI 변환보다 **앞**이고(install =
`installClaudeBaseline` · update = `updateHarnessFiles`), 둘 다 같은 writer 를 쓴다. 그 writer 원장(`ledger().writes`)의 `.claude/rules/*.md`
경로 집합을 `runCliTransforms` 에 새 인자로 넘긴다 — install · update 같은 인자 · 같은 판정 함수(`wroteEveryRule` 을 폴더 · 경로 집합을
받게 일반화).

- 원장에 오르는 판정은 `create` · `overwrite` · `backup+overwrite` · `leave`(같은 내용) — 넷 다 실행 뒤 디스크가 하네스 판이다. 원장에
  안 오르는 자리 = 프로젝트 밖 링크(`skipOutside`) · 남의 슬롯 — 그 룰이 빠지므로 ③b 거짓.
- 설치자가 뺀 룰(`excluded`)은 렌더 룰 목록에서도 같은 판정으로 빠지므로 요구하지 않는다.
- claude 가 이번 실행에 없으면(install `--cli codex` · update 에서 claude 미기록) 원장이 비어 ③b 거짓.

### D2. 렌더

포인터 목록의 줄 형식은 그대로, 경로만 대상 폴더를 따른다: `` > - `<glob>` · `<glob>` → `.claude/rules/<룰>.md` ``. 머리 문장 · 앞 `---` 그대로.

### D3. `uninstall --cli claude` 는 `.claude/rules/` 포인터가 있으면 `AGENTS.md` 를 다시 렌더한다

지금은 claude 가 `AGENTS.md` 를 읽는 CLI 가 아니라 `uninstall --cli claude` 가 그 파일을 건드리지 않는다(`agentsMdRerenderSet` 이 `null`).
포인터가 `.claude/rules/` 를 가리키는데 그 파일들이 지워지면 Codex 는 경로 룰을 0번 받는다 — 이 변경이 새로 만드는 사각이라 같은 PR 에서 닫는다.

- 조건: 대상이 claude 이고 · 남는 집합에 `AGENTS.md` 를 읽는 CLI 가 있고 · 디스크 `AGENTS.md` 의 포인터 줄이 `.claude/rules/` 를
  가리킨다(이 판정은 소유가 아니라 "지우는 파일을 가리키는 줄이 있나" 다) · 그 밖의 기존 재렌더 조건(기록 · 존재)은 같다.
- 재렌더는 지금처럼 `pathRulesViaFiles: false` → 경로 룰 인라인. dry-run 화면도 "would re-render AGENTS.md" 를 낸다.
- `.agents/rules/` 포인터만 있으면(claude+codex+ag 에서 claude 제거) 지금처럼 건드리지 않는다 — 가리키는 파일이 남는다.
- 남는 사각(ADR-117 과 같은 부류): 재렌더가 실패하는 읽기 전용 `AGENTS.md`. 새로 만들지 않는 것을 확인만 한다.

### D4. 화면 · 크기 · 문서

- update 상주 비용 줄: 포인터가 `.claude/rules/` 를 가리키면 경로 룰은 그 파일로 센다(실제로 상주하는 것만).
- 크기 게이트: claude+codex 포인터 판도 잰다.
- ADR-118(Amends ADR-117) · README/README.ko Codex 행 · CONTEXT-FILES · USAGE · 루트 CLAUDE.md 함정 3 중 이 사실을 말하는 곳.

## 2. 집합이 바뀌는 실행

| 실행 | 그 실행의 블록 | Codex 의 경로 룰 |
|---|---|---|
| claude+codex 함께 install / update | 포인터 → `.claude/rules/` | 파일(이번에 씀) |
| claude 설치본에 `install --cli codex` | Claude Code 룰을 이번에 안 썼으면 인라인 · 썼으면 포인터 | 인라인 또는 파일 |
| codex 설치본에 `install --cli claude` | 포인터 → `.claude/rules/`(이번에 씀) | 파일 |
| claude+codex 에 `install --cli antigravity` | ③a 참이면 `.agents/rules/` 포인터, 아니면 ③b | 파일 |
| `uninstall --cli claude` (codex 남음, `.claude/rules/` 포인터) | 인라인(D3 재렌더 · false) | 인라인 |
| `uninstall --cli claude` (claude+codex+ag, `.agents/rules/` 포인터) | 그대로(재렌더 없음) | 파일(남는다) |
| claude+codex 에 `install --cli opencode` | 인라인(② 거짓) | 인라인 |
| Claude Code 룰 파일 하나가 링크 · 설치자 편집이라 건너뜀 | 인라인(③b 거짓) | 인라인 |

## 3. 검증

표 §2 의 행마다 실설치 테스트로 Codex 도달(인라인 본문 또는 실재 포인터 대상) ≥ 1 — 특히 `uninstall --cli claude` 뒤 포인터가 지운 파일을
가리키지 않는다 · ③b · D3 각 가드의 음성 대조 · 크기 게이트 · 상주 비용 줄 · ADR-118.

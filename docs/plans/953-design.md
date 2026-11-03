# #953 설계 — Claude Code + Codex 조합도 경로 룰을 `.claude/rules/` 포인터로

- 이슈: #953 (마일스톤 v26.183.0) · 바탕: ADR-117(#948) · `docs/plans/948-design.md`
- 근거: `docs/research/codex-rule-pointer-2026-11.md` §4차 — 실제 Claude Code + Codex 설치본에서 `.claude/rules/ui-components.md` 포인터 4/4
- 설계 검증: design-verifier-xhigh 2026-11-03 — BLOCKER 1(쓰기 불가 `AGENTS.md`) · NOTE 1·2·3·4·5·6·7·8 반영

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
- 대조하는 룰 목록은 ③a 와 같은 `agentsRules` 다(집합에 이번 선택 밖의 기록 CLI 가 있으면 누적 룰, `cli-transforms.ts` `beyondThisRun`).
  `rules` 와 대조하면 `install --cli claude --track <새 트랙>` 이 이번에 안 쓴 파일을 가리킨다(설계 검증 NOTE-1).
- 설치자가 뺀 룰(`excluded`)은 렌더 룰 목록에서도 같은 판정으로 빠지므로 요구하지 않는다.
- 새 인자는 기존 값의 재사용이다: update 는 `updateHarnessFiles(...).wrote`(#843), install 은 `writer.ledger().writes` 의 경로 —
  둘 다 project 상대 `ReadonlySet<string>` 하나로 넘기고 `wroteEveryRule(folder, written, rules)` 로 일반화한다(③a 도 같은 함수).
- claude 가 이번 실행에 없으면(install `--cli codex` · update 에서 claude 미기록) 원장이 비어 ③b 거짓.

### D2. 렌더

포인터 목록의 줄 형식은 그대로, 경로만 대상 폴더를 따른다: `` > - `<glob>` · `<glob>` → `.claude/rules/<룰>.md` ``. 머리 문장 · 앞 `---` 그대로.

### D3. `uninstall --cli claude` 도 남는 `AGENTS.md` 를 다시 렌더한다 · 지우기 전에 쓰기 가능을 확인한다

지금은 claude 가 `AGENTS.md` 를 읽는 CLI 가 아니라 `uninstall --cli claude` 가 그 파일을 건드리지 않는다(`agentsMdRerenderSet` 이 `null`).
포인터가 `.claude/rules/` 를 가리키는데 그 파일들이 지워지면 Codex 는 경로 룰을 0번 받는다 — 이 변경이 새로 만드는 사각이라 같은 PR 에서 닫는다.

- **재렌더**: 대상이 claude 여도 다른 `--cli` 제거와 같이 다룬다 — 남는 집합에 `AGENTS.md` 를 읽는 CLI 가 있고 기존 재렌더 조건(기록 ·
  존재)이 맞으면 늘 재렌더(`pathRulesViaFiles: false` → 경로 룰 인라인). 디스크의 포인터 줄로 트리거하지 않는다(설계 검증 NOTE-4 —
  디스크 바이트를 행동 결정에 쓰는 분기를 만들지 않는다). 대가: claude+codex+ag 의 `.agents/rules/` 포인터도 이 한 번 인라인으로
  내려오고 다음 update 가 되돌린다(ADR-116 이 이미 감수한 "재렌더 = 인라인 → 다음 update 포인터" 와 같은 부류).
- **사전 검사**(설계 검증 BLOCKER-1): `runScopedRemoval` 은 하네스 파일을 **먼저** 지우고 재렌더한다. 재렌더가 예정된 실행
  (`rerenderSet !== null`)은 지우기 **전에** `AGENTS.md` 의 쓰기 가능을 확인하고, 불가면 아무것도 지우지 않고 멈춘다 — 전량 uninstall
  의 #676 검사(`unwritablePaths`)와 같은 검사 · 같은 문구. ADR-117 이 후속으로 남긴 `uninstall --cli antigravity` 쪽 사각도 같은 줄로 닫힌다.
- dry-run 의 "would re-render AGENTS.md" 줄은 `agentsMdRerenderSet` 결과에서 그대로 나온다.
- 다음 유지보수자 안내: `cli-ownership.ts` 의 claude 행(`.claude/` 전용) 또는 `agentsMdRerenderSet` 주석에 "Codex 포인터가 `.claude/rules/`
  를 가리킬 수 있다(ADR-118) — 이 자리를 지우는 경로는 `AGENTS.md` 재렌더와 묶여 있다" 한 줄(NOTE-7).

### D4. 화면 · 크기 · 문서

- 포인터 줄 렌더 · 읽기(`pathRulePointerLine` · `POINTER_TARGET` · `pathRulePointerTargets`)가 폴더를 인자 · 캡처로 받는다(지금 `.agents/rules/` 고정).
- update 상주 비용 줄: 포인터가 `.claude/rules/` 를 가리키면 경로 룰은 그 파일로 센다(`pointedRuleFiles` 가 캡처한 폴더로 경로를 조립 —
  안 그러면 `existsSync` 에서 0 으로 떨어져 화면이 "밖 룰 0" 으로 거짓말한다).
- ADR-118 Consequences 에 감수 셋: ⓐ `update --only external` 은 `.claude/rules/` 를 안 써서 포인터 → 인라인으로 출렁인다(0번 아님 · 다음 전체
  update 가 되돌림, NOTE-3) ⓑ `.claude/` 를 VCS 에서 빼고 `AGENTS.md` 만 커밋한 클론은 팀원이 install 하기 전까지 Codex 경로 룰 0번(ADR-116 N-1
  과 같은 부류) ⓒ 근거 두께 — 폴더만 다른 같은 형식, `.claude/rules/` 측정은 4회 · xhigh 만(NOTE-6).
- 크기 게이트: claude+codex 포인터 판도 잰다.
- ADR-118(Amends ADR-117) · README/README.ko Codex 행 · CONTEXT-FILES · USAGE · 루트 CLAUDE.md 함정 3 중 이 사실을 말하는 곳.

## 2. 집합이 바뀌는 실행

| 실행 | 그 실행의 블록 | Codex 의 경로 룰 |
|---|---|---|
| claude+codex 함께 install / update | 포인터 → `.claude/rules/` | 파일(이번에 씀) |
| claude 설치본에 `install --cli codex` | 인라인(claude 가 이번 선택에 없어 원장이 빈다 — 다음 update 가 포인터) | 인라인 |
| codex 설치본에 `install --cli claude`(트랙 = 기록 트랙) | 포인터 → `.claude/rules/`(이번에 씀) | 파일 |
| claude+codex 에 `install --cli claude --track <새 트랙>` | 인라인(`agentsRules` 누적 — 이번에 안 쓴 룰이 있다) | 인라인 |
| claude+codex 에 `install --cli antigravity` | ③a 참이면 `.agents/rules/` 포인터, 아니면 인라인(claude 가 이번 선택에 없어 ③b 거짓) | 파일 또는 인라인 |
| `uninstall --cli claude` (codex 남음, `.claude/rules/` 포인터) | 인라인(D3 재렌더 · false) | 인라인 |
| `uninstall --cli claude` (claude+codex+ag, `.agents/rules/` 포인터) | 인라인(D3 재렌더 · 다음 update 가 `.agents/rules/` 포인터) | 인라인 |
| `uninstall --cli claude` · `AGENTS.md` 쓰기 불가 | 아무것도 안 지우고 멈춤(D3 사전 검사) | 그대로(포인터 대상 남음) |
| `update --only external` (claude+codex 포인터) | 인라인(③b 거짓 — 다음 전체 update 가 포인터) | 인라인 |
| claude+codex 에 `install --cli opencode` | 인라인(② 거짓) | 인라인 |
| Claude Code 룰 파일 하나가 링크 · 설치자 편집이라 건너뜀 | 인라인(③b 거짓) | 인라인 |

## 3. 검증

표 §2 의 행마다 실설치 테스트로 Codex 도달(인라인 본문 또는 실재 포인터 대상) ≥ 1 — 특히 `uninstall --cli claude` 뒤 포인터가 지운 파일을
가리키지 않는다 · ③b · D3 각 가드의 음성 대조(D3 재렌더를 끈 변이에서 `.claude/rules/` 포인터 줄이 남아 red) · `chmod a-w AGENTS.md` 뒤
`uninstall --cli claude` 가 exit 1 이고 `.claude/rules/` 파일 수가 그대로 · 크기 게이트 · 상주 비용 줄 · ADR-118.

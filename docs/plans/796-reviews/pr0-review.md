# PR #809 (#796 PR-0) 독립 리뷰 — 0d41f9f (대조군: main 1dc9628)

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 1 | warn |
| MEDIUM | 2 | info |
| LOW | 0 | pass |

**판정: PASS with notes** — 기준 (1)~(4)는 모두 충족한다. 다만 N2 장면에서 동작이 바뀌는 범위가 ADR 한 줄보다 넓고, 사용자가 확정한 원칙에 예외를 두는 일이라 머지 승인을 요청할 때 사용자에게 보여야 한다(HIGH-1).

## 기준별 판정 (산출물과 실행 결과로 확인)

### (1) BLOCKER-1 고침 — 충족
- **실제 옛 판 대조**(docker, 이미지 `uzys-r796a-*`, 끝난 뒤 지움): 흐름은 옛 npm 판 install(tooling · claude) → 표식 4개(내 룰 `my-rule.md` · `git-policy`·`test-policy` 끝에 MINE-EDIT 덧붙임 · 내 스킬 `mine/`) → 이번 빌드로 `update --only hooks` → 전체 update ×2 → `uninstall --yes`.
  - **26.100.0 + main**: `--only hooks` 를 돌린 뒤 `policyFiles` 의 rules/ 항목은 은퇴 경로 3개(code-style · error-handling · gates-taxonomy)뿐이다. 이어서 전체 update 를 돌리면 하네스 룰 5개(change-management · cli-development · git-policy · ship-checklist · test-policy)와 `agents/reviewer.md` 가 "policy files had files with these names … yours, put back on uninstall" 로 displaced 기록된다. 이어 uninstall 이 그 6개를 **"put back"으로 옛 하네스 바이트째 제자리로 되돌린다**. 결함이 재현됐다.
  - **26.100.0 + PR**: 화면에서 달라지는 줄은 displaced 7 → 1(strategist), no checksum 7 → 13 둘뿐이다. 그 밖은 바이트 단위로 같다. uninstall 은 하네스 룰을 백업만 하고 치우며 "put back" 줄이 하나도 없다. 하네스 룰 중 displaced 로 기록된 것도 0이다.
  - **26.132.0**(스캔 필드가 있는 S2 기록): main 과 PR 의 update·uninstall 화면이 경로와 시각 말고는 같다. 이 판에서는 동작이 바뀌지 않았다.
  - **표식 손실 0**(네 실행 모두): `my-rule.md` · `mine/SKILL.md` 는 라이브에 남는다. MINE-EDIT 는 PR 에서는 `git-policy/test-policy.md.backup-*` 에 남고, main(26.100)에서는 되돌려진 라이브 파일에 남는다. 두 번째 update 에서 백업이 새로 생기지 않는다(백업 29→29 · 16→16, 안정).
- 단위 테스트: `tests/partial-update-retired-claim.test.ts` 가 장면을 끝에서 끝까지 재현하고, `tests/recorded.test.ts` 는 대조군(은퇴 아닌 항목이 있으면 none)까지 담았다.
- **변이 대조(직접 확인)**: `recorded.ts` 의 `&& !RETIRED_PATHS.includes(f.path)` 를 빼도 tsc 는 0 이고, 두 테스트가 모두 red 다. 스킬 폴더 단위 읽기를 필드 존재로 되돌리면 tsc 0, `recorded.test` 와 `update-dev-default-skills ④` 가 red 다. judge 의 `!== "sha"` 를 `=== "none"` 으로 되돌리면 tsc 0, `judge.test no-sha/없음 · update` 가 red 다. 세 변이 모두 테스트가 잡는다.

### (2) 스킬 폴더 단위 읽기 — 새 손실 없음
- 탐침(`evidence/zz-n2-probe.test.ts`, PR·main 사본에서 실행): 장면은 S2–S4 모양 기록 + 항목 없는 번들 id 폴더에 설치자가 손으로 만든 `SKILL.md` 다. id 둘(기본 `multi-model-debate` · opt-in `gemini-delegate`) × 흐름 셋(update · add · 아무것도 안 함) 뒤에 uninstall 을 돌렸다. **여섯 경우 모두 MINE 바이트가 라이브나 `.backup-*` 에 남는다.**
- `writer` 기록은 `scanFieldOf` 에 닿기 전에 `none` 으로 끝나므로 영향이 없다. 번들 밖 노트는 `isTarget` 이 거른다(기존 `uninstall-legacy-scan` 그대로 green).

### (3) install 동작 — N2 장면 밖은 변화 없음 · N2 장면의 설치자 바이트 손실 0
- 26.132.0 실제 판의 update·uninstall 화면은 PR 과 main 이 같다. 바뀌는 곳은 탐침의 N2 장면뿐이고, 바이트는 백업에 남는다(위 (2)).

### (4) writer 추가분(`run` · `writes`) — 관측되는 변화 없음
- `createInstallWriter` 를 부르는 두 곳(installer.ts:534 · update-mode.ts:1173) 모두 `run` 을 넘기지 않는다. `ledger.writes` 를 읽는 곳은 src 에 없다. 기록에는 개별 필드만 들어간다.
- judge 의 새 행(no-sha · 디스크 없음)은 install 문구가 "wrote" 그대로다. update 가 쓰는 `judgedUpdateWrite` 는 `line` 을 읽지 않으므로 화면이 바뀌지 않는다.

### `npm run ci`
- PR 작업 트리에서 파이프 없이 exit 0(branches 89.69%). 작업 트리는 읽기만 했다(`git status` = 기존 `node_modules` 심링크뿐). 변이와 탐침은 스크래치패드 사본에서 했다.

## Findings

[HIGH] N2 의 실제 영향이 ADR 한 줄보다 넓다 — 사용자 확정 원칙의 예외이므로 머지 승인 때 사용자에게 보인다
File: docs/decisions/ADR-097-one-principle-installer-disk.md:129-132
Issue: 루트 CLAUDE.md §설치자 디스크(사용자 확정)는 하네스 자리에 있는 설치자 파일을 "백업 + displaced + uninstall 이 제자리로 되돌림"으로 다루라고 정한다. 탐침으로 잰 PR 의 실제 동작은 다음과 같다.
  - **update**(④)·**add**: 원래 displaced → 되돌림이던 것이 이제 1회 백업에 그치고, 하네스 것으로 기록되며, uninstall 이 되돌리지 않는다. 결과적으로 설치자 파일은 `.backup-*` 에만 남는다. ADR 문장은 "install · uninstall"만 적고 update 를 빠뜨렸다.
  - **uninstall 만 돌린 경우와 opt-in id**: update 가 건드리지도 않은 손수 만든 폴더(`gemini-delegate`)까지 uninstall 이 백업한 뒤 치운다. main 에서는 그대로 둔다. 설치자 쪽에서는 하네스를 지운 뒤 **자기 스킬이 제자리에서 사라지고 이름을 바꿔 다시 놓아야 한다**.
  - 바이트 손실은 없으므로 블로커는 아니다. 그러나 사용자가 확정한 원칙의 동작이 바뀌고, change-management 상 Minor 이상은 사람의 승인이 필요하다. 설계 검증의 "사용자 결정 필요 항목 없음"은 이 승인을 대신하지 못한다.
Fix: ADR 줄을 "install · update · uninstall — 기본·opt-in id 모두, uninstall 만 돌려도"로 정정한다. PR 본문의 머지 승인 요청 표에는 N2 를 따로 올린다(무엇이 달라지나: 손으로 만든 번들 이름 스킬이 uninstall 뒤 `.backup-*` 로만 남는다).

[MEDIUM] N2 의 uninstall 쪽 테스트 — 필수는 아님
Issue: 손실 안전은 기존 uninstall 의 no-sha → backup+remove 경로(`uninstall-legacy-scan` :163)와 `recorded.test` 의 폴더 단위 단언이 함께 지키고, 이번 변경은 읽기 한 곳뿐이다. 새 가드가 생긴 것이 아니므로 상시 테스트를 더할 근거는 약하다.
Fix: 원하면 ④ 끝에 uninstall 을 붙이고 "MINE 이 `.backup-*` 에 있다" 한 단언을 더하면 3줄이다. HIGH-1 의 동작을 사용자가 승인하면 그 계약을 고정하는 값이 생긴다.

[MEDIUM] (이번 PR 밖 · 기존 동작) 트랙 밖 에이전트가 displaced 로 남는다
Issue: 26.100.0·26.132.0 모두에서 main 과 PR 이 같다. `agents/strategist.md`(백업 + displaced) · `agents/data-analyst.md`(displacedSame)이 uninstall 뒤 라이브에 남는다. 설계 검증 N1 이 "별도 이슈"로 둔 잠복 상태가 실제 판에서 관측된 것이다.
Fix: N1 이슈가 실제로 열려 있는지 확인한다. 이 PR 에서 고칠 것은 아니다.

## 의심 (1) 판정 — 옛 스캔 기록 + 항목 없는 번들 스킬 폴더는 설치자 파일인가
- **그렇다. 그 상태를 만드는 것은 설치자다.** S2–S4 판(v26.126–161)의 스캔은 install 뒤 `.claude/skills/` 를 훑어 깔린 스킬마다 항목을 남겼다. 그러니 번들 id 폴더에 항목이 하나도 없다는 것은 스캔할 때 그 폴더가 없었다는 뜻이다. 그 뒤에 그 폴더를 만드는 것은 #729 첨부를 손으로 복사한 설치자(#761 테스트의 서사)이다. 하네스 update 가 새 기본 스킬을 깔면 `refreshSkillBaseline`·`recordNewSkillBaseline` 이 항목을 적으므로 항목 없는 폴더가 되지 않는다.
- 그래서 ④ 를 뒤집은 것은 원칙과 어긋난다. 그래도 **받아들일 만하다.** ① 바이트 손실이 0이다(실측). ② 같은 no-sha 규칙이 S0/S1 기록에는 이미 적용되고 있다. ③ 이 읽기가 막으려는 반대쪽 회귀(⑧ — 하네스 스킬이 설치자 파일로 읽혀 uninstall 이 옛 하네스 바이트를 되돌림)가 더 해롭고 대상도 넓다. ④ 폴더 단위는 정책 파일의 디렉터리 단위와 같은 모양이라 경우가 늘지 않는다.
- 조건은 HIGH-1 이다. 예외의 범위를 정확히 적고 사용자 승인 아래 둔다.

## Positive Observations
- BLOCKER-1 을 검증자가 준 문장 그대로, 기록이 아니라 "잘못 읽는 쪽"(`scanFieldOf`)을 고쳐 닫았다. 실제 26.100.0 에서 "put back" 6건이 0건으로 줄었다. 그 사이 agents/ 디렉터리의 같은 구멍(`reviewer.md`)도 함께 닫혔다.
- 새 테스트 세 개가 모두 음성 대조에서 문다. 판정 표, ADR, 코드 주석이 같은 행을 가리킨다.

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경(src 4개 · 테스트 · 문서 2개 — 설계 PR-0 범위)
- [x] SPEC/설계 범위 안. 단 N2 의 동작 변화는 HIGH-1 대로 사용자에게 보인다

증거: `evidence/docker-out/<판>-<빌드>/`(log · 화면 · 기록 · 스냅숏), `evidence/flow.sh` · `Dockerfile`(합본 이미지), `evidence/zz-n2-probe.test.ts`

# PR #788 (#782) 독립 리뷰 — 판정: **조건부 통과 (CRITICAL·HIGH 없음, 메모 3건)**

검토한 것: 워크트리 `iso782`(분리 상태, HEAD `4b902fe`) · `git diff origin/main...HEAD`(merge base 6308562) · 설계 `v26.170.0-legacy-displaced-design.md` §1.4 · §4.1 · §5 · §6 PR-A · §7.1 · §8.2 · 루트 CLAUDE.md §설치자 디스크 원칙.
워크트리는 원상태로 돌려놓았습니다. 소스는 매 변이 뒤 `cp` 로 되돌리고 `cmp` 로 같은지 확인했고, 임시 테스트 파일은 지웠습니다. `git status` 에는 원래 있던 `node_modules` 링크만 남아 있습니다.

## Review Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 1 | info |
| LOW | 2 | info |

## 직접 다시 돌린 증거

| 검사 | 결과 |
|---|---|
| 지정 6개 파일 `npx vitest run …`(파이프 없이 exit 읽음) | **exit 0** · 118/118 |
| `npm run ci`(typecheck + lint + test:coverage + build, 파이프 없이 exit 읽음) | **exit 0** · 152 파일 2293 테스트 · 커버리지 All files: 줄 96.74 / 분기 89.55 / 함수 95.74 / 구문 95.55(분기 하한 86) |

### 변이 대조 — 다섯 자리 모두 typecheck 통과(`tsc --noEmit` exit 0)를 확인한 뒤 관측

| # | 변이 | 결과 |
|---|---|---|
| M1 | update 은퇴 회수: `prunedRestored` 를 빈 배열로 | ① red (나머지 7 green) |
| M2 | install·`--reinstall`: `has` 를 `… && false` 로 | ④ · ④′ red |
| M4 | update 트랙 밖 룰 회수: `has` 를 `… && false` 로 | ② red |
| M5 | update 옛 앵커 은퇴: `has` 를 `… && false` 로 | ③ · ⑤ red |
| M3 | update 은퇴 회수의 되돌리기를 `refreshPolicyBaseline` **앞**으로 옮김 | **PR 테스트·관련 테스트 21건 전부 green** → MEDIUM-1 |

M2 의 첫 시도는 import 를 쓰지 않게 되어 typecheck 가 깨졌습니다(TS6133). 그 FAIL 은 증거로 쓰지 않고, typecheck 를 통과하는 형태로 다시 걸어서 위 결과를 얻었습니다.

## 완료 기준 판정

**(a) displaced 로 기록된 자리를 하네스가 떠나는 remove 는 원본을 바이트 그대로 되돌리고 기록을 지운다 — 충족 (예외 2개, 둘 다 손실 아님).**
- 연결된 자리: uninstall 전량·`--cli` · update 의 은퇴 회수 · update 의 트랙 밖 룰 회수 · update 의 옛 앵커 은퇴 · install/`--reinstall` 의 트랙 밖 룰 회수 + 옛 앵커 은퇴.
- 각 자리에서 확인한 것:
  - `expectPutBack` 이 원본 바이트·백업 0개·displaced 기록 0개를 단언합니다.
  - 기록 정리는 그 실행의 같은 쓰기에 들어가 있습니다. update 은퇴 회수는 `recordDisplaced` 가 기록을 **다시 읽은 뒤**(N13-4 충족, ① 이 policyFiles 보존을 단언), 트랙 밖 룰은 `reclaimOutOfTrackRecorded` 의 같은 `writeInstallLog`, 앵커는 `refreshExternalCli` 가 새로 읽은 기록의 `next.rootFiles`, install 은 `logBase.rootFiles` → `buildInstallLog` 의 `mergeRootFiles` 입니다.
- 예외 ⓐ `--only` — PR-B 몫(설계 §6). 외부 스킬 자리에 displaced 를 만드는 쪽은 PR-B(#780)입니다. 지금 displaced 를 만드는 곳은 `install-writes` · `owned-write` · `update-mode` 셋뿐이고 `--only` 는 `assets[].files` 만 지우므로, 지금은 이 상태에 닿는 경로가 없다고 판단했습니다(가정 — 실행으로 확인하지는 않았습니다).
- 예외 ⓑ #477 — LOW-1 참조.

**(b) 하네스가 아직 차지한 자리에 되돌리는 경로 · 설치자 파일을 덮거나 잃는 경로가 없다 — 충족.**
- 되돌리기는 모든 호출부에서 하네스 판을 지운 **뒤**에 돕니다(`pruneOrphans` 의 unlink 뒤 · `reclaimOutOfTrack` 의 rm 뒤 · `retireAntigravityAnchor` 의 rm 뒤).
- 판정은 lstat 기준으로 자리가 비었을 때만 `restore` 입니다. 끊어진 링크도 "차 있음"으로 봅니다 — uninstall 의 옛 `safeExists` 와 같습니다.
- 되돌린 뒤 같은 실행이 그 자리를 다시 쓰는 단계는 없습니다.
  - install: 외부 CLI 변환은 회수보다 **앞**에서 돌고, 이번 실행의 트랙 ⊆ 누적 트랙이라 렌더가 그 자리를 다시 쓰지 않습니다. 그 뒤의 `writeEnvironmentFiles` · `runExternalPhase` 는 다른 자리를 씁니다.
  - update: 은퇴 회수 뒤 단계(스킬 · 앵커 · 외부 갱신)는 `.claude/{rules,agents,commands,hooks}` 를 쓰지 않습니다. 트랙 밖 룰 회수는 외부 갱신 **뒤**이고, 렌더 밖 자리만 지웁니다.
- 다음 update 가 되돌린 파일을 지우지 않는지도 봤습니다.
  - `collectPolicyHashes` 는 템플릿에 있는 이름만 기준선에 적습니다.
  - 은퇴 경로(`RETIRED_PATHS`)는 writer 기록에서 `recorded()` = `none` 입니다. 필드가 있는 옛 기록에서는 `scanFieldOf` = present → `none` 입니다.
  - 실측(probe R1): 은퇴 경로 `.claude/rules/nextjs.md` 에서 되돌린 설치자 파일이 두 번째 update 뒤에도 제자리에 있습니다.
- 백업 이름 충돌은 `claimBackupPath`(EXCL)가 막습니다.

**(c) uninstall 동작 불변 — 충족.** `restoreDisplaced` 는 그대로 옮겨졌습니다. `safeExists` 와 새 `exists` 는 같은 lstat 구현이고, `willBeGone` 식도 같습니다. `out.displaced` 는 push 에서 대입으로 바뀌었지만, ⓒ 앞에서 그 배열에 넣는 곳이 없음을 grep 으로 확인했습니다. `settleCliLog` 의 필터는 `withoutRestored` 와 같은 식입니다. 기존 uninstall 3개 스위트도 green 입니다.

## Findings

[MEDIUM-1] 은퇴 회수의 "되돌리기는 기준선 재기록 뒤" 순서를 지키는 테스트가 없다
File: src/update-mode.ts:644-650 (호출 위치), tests/displaced-restore-all-removes.test.ts ①
Issue:
- 구현자 주장 자체는 **맞습니다**. 하지만 PR 테스트는 이 순서를 물지 않습니다.
- ① 의 픽스처 `git-policy.md` 는 `RETIRED_PATHS` 에 없어서 `retiredClaims` 가 아예 돌지 않습니다.
- M3(순서를 뒤집은 변이)에서 21건이 전부 green 이었습니다.
- 같은 변이에서 은퇴 경로(`rules/nextjs.md`) probe 는 red 였습니다. 되돌린 설치자 파일이 `policyFiles` 에 하네스 것으로 적혔고(`policy has nextjs? true`), 두 번째 update 의 `pruneOrphans` 가 그 파일을 백업하고 제자리에서 치웠습니다.
- 바이트는 백업에 남지만, 리팩터 한 번으로 조용히 돌아올 수 있는 회귀입니다.
- 실제 은퇴는 `RETIRED_PATHS` 에 등재되는 경로라, 이쪽이 실사용 모양입니다.
Fix: ① 과 같은 장면을 `RETIRED_PATHS` 의 경로로 하나 더 만들고, update 를 두 번 돌린 뒤 원본이 제자리에 있고 `policyFiles` 에 없음을 단언합니다. 그대로 쓸 수 있는 probe = `rev782/probe-r782.test.ts.txt` 의 R1.

[LOW-1] 상주 문서·주석의 "모든 remove" 가 #477 스킬 내부 정리를 빼고 말한다
File: CLAUDE.md:30 · src/displaced.ts:2 · src/judge.ts:229-232
Issue: update 의 `syncSkills` #477 정리(번들에서 빠진 스킬 안 파일 삭제)는 displaced 기록이 있는 자리에서도 되돌리지 않습니다. 손실 경로인지 판정한 결과는 **아니다**입니다.
- 이 상태를 만드는 사람: 하네스 스킬 파일과 같은 경로에 자기 파일을 둔 채 설치했고(displaced + 백업), 그 뒤 릴리즈가 그 파일을 번들에서 뺀 경우입니다. 드뭅니다.
- 결과: 정리 루프가 `.backup-` 이름을 건너뛰므로 원본은 `<file>.backup-*` 에 그대로 남고, 기록도 남습니다. 다음 uninstall(전량)이 비어 있는 그 자리에 되돌립니다(코드 추적 — 실행 확인은 하지 않았습니다).
- 설계 §1.4 가 "대상 아님"으로 둔 범위이므로, 이 PR 에서 덮지 않는 판단은 맞습니다.
- 다만 CLAUDE.md 는 "update 의 은퇴 회수 … 모두 같은 함수다", 주석은 "모든 remove" 라고 써서 예외가 보이지 않습니다. 다음 유지보수자가 이 문장을 믿고 #477 에도 되돌림이 있다고 읽습니다.
Fix: 한 구절을 덧붙입니다 — "스킬 폴더 안 번들 밖 파일 정리(#477)는 되돌리지 않는다 — 원본은 백업에 남고 uninstall 이 되돌린다."

[LOW-2] install 이 되돌린 뒤 기록 쓰기 전에 중단되면, 다음 실행이 되돌린 파일을 다시 백업으로 옮긴다
File: src/installer.ts:721 → 558 (`recordInterruptedInstall` 은 `logBase` 가 아니라 `previousLog` 를 쓴다)
Issue: 구현자가 적은 "backup no longer there" 안내보다 한 걸음 더 갑니다.
- 중단 기록에는 트랙 밖 룰의 `externalFiles`(하네스 sha)와 displaced 항목이 그대로 남습니다.
- 다음 update·install 의 `reclaimOutOfTrack` 은 제자리로 돌아온 설치자 파일을 "고친 하네스 판"으로 판정해 `backup+remove` 합니다. 그 다음 displaced 되돌리기는 옛 백업이 없으니 advise 로 끝납니다.
- 결과: 설치자 파일이 제자리에서 새 백업으로 옮겨지고, 화면은 "되돌릴 백업이 없다"고 말합니다.
- 바이트는 새 백업에 남고, 그 경로는 트랙 밖 행에 나옵니다. 손실은 아닙니다.
- probe R2 로 이 모양을 재현했습니다. 다만 같은 초 안에서 백업 이름이 우연히 같아져 다시 되돌려지는 바람에, 최종 상태는 실사용 장면과 다릅니다.
- 이 상태를 만드는 조건: 721행 뒤(`.env` 파일 · 외부 자산 단계)에서 예외가 나는 install. 드뭅니다.
Fix: 선택 사항입니다. 중단 기록에서도 `displacedRestored` 의 forget 과 `forgotten` 을 반영하면 됩니다.

## 확인한 긍정 관찰(구체)
- 되돌리기 판정과 실행이 `src/displaced.ts` 한 곳으로 모였습니다. uninstall 의 사본이 사라져 판정이 둘로 갈라질 여지가 없습니다.
- 새 테스트가 화면 문구(`yours — put back (from …backup-…)`)·기록·디스크를 한 장면에서 함께 단언합니다. 다섯 호출부 각각이 자기 변이에 red 로 반응합니다.
- `recordDisplaced` 가 기록을 다시 읽은 뒤 정리하므로, `refreshPolicyBaseline` 이 쓴 기록을 실행 시작 때 기록으로 덮는 위험(N13-4)이 없습니다. ① 이 이를 단언합니다.

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/설계 범위 안 — `--only` 는 PR-B 로 미뤘고, CLAUDE.md 문장에서도 `--only` 를 뺐습니다(지금 출하분 기준으로 참). §13 ① 완료 줄 · judge 주석을 갱신했습니다.
- **조건부 통과** — 머지를 막는 것은 없습니다. MEDIUM-1 의 회귀 테스트는 이 PR 에 넣기를 권하지만 필수는 아닙니다.

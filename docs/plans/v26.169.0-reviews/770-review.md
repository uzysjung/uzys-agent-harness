# #770 독립 리뷰 — fix/external-skill-backup @ 06db99c (기준 main@2069b5f)

## 결론: **PASS** (BLOCKER 0) — 단 HIGH 1건(install 재실행 경로)은 이 마일스톤 안에서 다뤄야 한다

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 (비차단 — 이 PR 이 만든 회귀가 아니고, 이 PR 범위 밖이다) |
| MEDIUM | 0 |
| NOTE | 3 |

## 완료 기준 대조 (직접 실행으로 확인)

| 기준 | 판정 | 증거 |
|---|---|---|
| 고친 외부 스킬 파일이 `<file>.backup-<시각>` 으로 남고 화면이 말한다 | ✓ | head 컨테이너(실 `npx skills`, 태그 rev-770): 두 사본 SKILL.md 편집 → update → `SKILL.md.backup-20261012T043633` 2개, 각각 편집 포함. 화면 `▸ BACKUPS 2 file(s) saved before replacing`, update-backups.json 에 noChecksum 없음(시나리오 ②') |
| 안 고친 파일은 조용히 갱신 | ✓ | LICENSE.txt 백업 없음. 2회차 update(편집 없음): 화면 BACKUPS 행 없음 · update-backups.json 없음 · 새 백업 0 |
| 설치자 파일이 백업 없이 사라지지 않는다 | ✓ (update 경로) | 슬롯 안 my-notes.md 와 앞선 백업이 2·3회차 update 뒤에도 남는다 |

## 판정 요청 항목

1. **재현이 실제인가 — 예.** main 소스(2069b5f) + 이 PR 의 시나리오로 이미지를 빌드해 돌리면
   `FAIL: 고친 .../SKILL.md 의 편집이 백업으로 남지 않았다 (#770) — 찾은 백업: []` (exit 1). 리뷰어 프로브에서도 base 는
   편집 2건 소실 · 백업 0 · 슬롯의 my-notes.md 소실. 같은 시나리오를 head 로 빌드하면 전 단계 PASS(exit 0).

2. **설치자 파일 복원(브리프 밖) — 필요하고, ADR-097 결정 5 와 맞다. 과잉 아님.**
   - 결정 5 = "하네스 자리 밖의 기록 없는 파일은 어떤 동작도 건드리지 않는다". 도구가 폴더를 새로 만들어 기록 밖 파일을 지우는 것은
     base 에서도 실측된 손실이고(노트 소실), 복원은 "건드리지 않은" 결과를 되돌려 놓는 것이다.
   - 이것 없이는 이번 PR 의 백업이 다음 update 에서 사라진다(M5 변이로 확인 — 노트·앞선 백업 테스트가 red). 즉 완료 기준 1 이 한 번만 성립한다.
   - **하네스 판을 덮지 않는다**: 복원은 `now === null` 일 때만 쓴다. 상류가 같은 이름을 들여오면 설치자 내용을 백업하고 상류판을 둔다(리뷰어 프로브: live = 상류판).
   - **은퇴 파일을 되살리지 않는다(기록된 것)**: 기록된 · 안 고친 파일을 상류가 빼면 되살아나지 않는다(프로브). 기록된 · 고친 파일이 빠지면 백업만 남고 라이브는 비운다(기존 테스트 4).
   - 예외는 NOTE-1(기록 밖 상류 파일).

3. **sha 연쇄 — 고친 파일을 안 고친 것으로 잘못 읽는 경우 없음.** 실 도구 3회 update:
   1회차(편집) 뒤 기록 sha = 디스크(4파일 모두 same) → 2회차(편집 없음) 백업 0 · 화면 무언 → 3회차(Claude 사본만 재편집) 새 백업 1개(edit3 만 담음), 앞선 백업 2개 유지.
   기준선은 도구 호출 전후 diff 의 `changed` 로만 잇고, 고친 파일은 호출 **전** 내용을 들고 있으므로 연쇄가 편집을 덮는 순서가 없다.

4. **install 재실행 손실 — 사실이다. 그리고 이 PR 의 백업까지 지운다.** → HIGH-1 참조.

5. **회귀 테스트 · 음성 대조 — 문다.** 구현자 5종 재실행(각 `cmp` 로 적용 증명 · `tsc` exit 0): M1 → 4 red · M2 → 1 · M3 → 1 · M4 → 1 · M5 → 1.
   리뷰어 추가 2종: M6(sha 비교 무시 — 모든 기록 파일을 고친 것으로) → 4 red · M7(`recordRefreshedFiles` 미호출) → 1 red. 복원 후 7/7.
   `npm run ci` 파이프 없이 **exit 0** — 149 files / 2267 tests, branches 89.33.

## Findings

[HIGH-1] install 재실행이 편집·노트와 **update 가 만든 백업까지** 백업 없이 지운다 (비차단 — 별도 이슈, 같은 마일스톤)
- 증거(head 이미지, 실 도구): 3회 update 뒤 백업 3개(`SKILL.md.backup-…043633` ×2, `…043641`)와 my-notes.md 가 있는 상태에서
  SKILL.md 편집 + my-notes2.md 를 만들고 `agent-harness install --track tooling --with frontend-design --scope project --cli claude --cli codex`
  재실행 → exit 0, 편집 소실(백업 0), 노트 2개 소실, **앞선 백업 3개 모두 소실**. base 에서도 편집·노트는 같은 방식으로 사라진다(회귀 아님).
- 왜 비차단인가: 이 PR 의 완료 기준은 update 경로이고, base 대비 나빠진 것이 없다(base 는 백업 자체가 없었다). install 경로는 PR-C 의 폴더 사본이 덮던 자리도 아니다.
- 왜 마일스톤 안인가: 이 PR 로 "고친 외부 스킬 파일은 백업된다" 를 릴리스에 적으면, 다음 `install`(트랙·자산 추가) 한 번이 그 백업을 말없이 지운다 —
  설치자에게는 "백업이 있다고 했는데 없다" 가 된다. 루트 CLAUDE.md "install · update · uninstall 은 같은 원칙" 위반이 그대로 남는다.
- 완료 기준(후속 이슈): install 재실행 뒤 ① 고친 기록 파일은 `<file>.backup-<시각>` 하나로 남는다 ② 슬롯의 기록 밖 파일(노트·앞선 백업)은 제자리 ③ 안 고친 파일은 무백업.
  `holdSlotFiles`/`settleHeld` 가 자산 기록만 받으므로 install 의 `runExternalInstall` 호출 주위에서 재사용할 수 있어 보인다(구현 판단은 구현 레인).
  같은 시나리오에 install 재실행 단계를 더해 base red → fix green 을 보이면 된다.

[NOTE-1] 기록 밖 상류 파일 — 옛 판이 깐 뒤 기록 못 한 파일은 설치자 파일로 취급된다
- 리뷰어 단위 프로브: 기록에 SKILL.md 만 있고 상류 파일 extra.md 가 디스크에 있을 때 ⓐ 상류가 extra.md 를 빼면 **되살아난다**
  ⓑ 상류가 extra.md 를 바꾸면 백업 1개를 만들고 extra.md 는 계속 기록 밖으로 남는다(상류가 바뀔 때마다 반복, 화면은 noChecksum 으로 말할 것).
- 이 상태를 만드는 사람: `files` 기록(#573) 이후 · 이 PR 이전의 update 가 상류의 새 파일을 깔았는데 기록하지 않은 설치본. 손실이 아니라 낡은 파일·잉여 백업이고,
  "디스크 존재 ≠ 소유"(ADR-096)와 결정 5 를 따른 결과라 설계상 일관된다. 손대지 않아도 된다 — 관측되면 이슈.
- 같은 축: 설치자 파일과 같은 이름을 상류가 들여오면 상류판이 `changed` 로 잡혀 `mergeToolFiles` 가 기록하지 않는다 — 결정 3 의 `displaced` 기록이 외부 스킬 자리에는 없다. 손실 없음.

[NOTE-2] 기록된 파일을 상류가 빼도 기록에서 빠지지 않는다(`mergeToolFiles` 의 기존 의미 — 이 PR 이 refresh 에도 같은 병합을 쓰게 됐을 뿐). 이후 설치자가 같은 이름을 만들면 "고친 하네스 파일" 로 백업된다. 손실 없음.

[NOTE-3] 폴더 안 심링크·옛 판 자산(`files` 부재)은 보호하지 않는다 — 인계에 적힌 대로 종전 동작 그대로. 손실 경로이긴 하나 이 PR 이 만든 것이 아니다.

## Positive Observations
- 백업을 호출 **뒤**에 쓰는 설계가 실측(도구가 폴더를 새로 만든다)에서 나왔고, "호출 전 백업" 이 실 환경에서 red 인 이유를 시나리오 ②'' 가 고정한다.
- 화면·목록 문구를 새로 만들지 않고 `collectRunBackups` + 실행 전 이름 집합(#646)에 태웠다 — 2회차에 되돌린 옛 백업이 "이번 실행의 백업" 으로 잘못 실리지 않는 것을 확인했다(화면 무언 · 목록 없음).
- 도구 실패 시 무동작(M4), 기록 sha 를 install 과 같은 `buildAssetEntries` 병합으로 잇는 것 — 두 벌 로직을 만들지 않았다.

## Verdict 체크
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (src 3파일 · 시나리오 1 · 테스트 1)
- [x] 범위 — 브리프 밖 결정(설치자 파일 복원)은 ADR-097 결정 5 안이고 완료 기준 3 의 성립에 필요
- 정리: 작업 사본의 node_modules 심링크 삭제 · 변이 전부 원복(`git status` 깨끗) · 이미지 `uzys-harness-test:rev-770` 삭제. 리뷰어 프로브 스크립트와 로그는 리뷰어 scratchpad(`/private/tmp/claude-502/-Users-uzysjung-Development-Claude-Workspace-uzysClaudeUniversalEnv/4dfbd7f8-d741-464b-9c6b-58eb1ce86bd4/scratchpad/probe`)에 있다.

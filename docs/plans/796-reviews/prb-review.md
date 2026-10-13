# PR #815 (#796 PR-B) 독립 리뷰 — 은퇴 회수가 설치 기록 판정(judge remove)을 부른다

- 대상: PR head `aab5c4d`(격리 사본 isoPB, 리뷰 전후 `git status` 깨끗 · HEAD 불변) · 대조군: main `8e6d87b`(`git archive` 로 따로 빌드 · `npm pack`)
- 두 빌드가 실제로 다른지 증명: 번들 `dist/index.js` 의 `policyBase` 출현 PR 0 · main 2
- 리뷰어가 직접 돌린 것: `npm run ci`(파이프 없이) · 음성 대조 4종 · check-absence · 옛 npm 판 실설치 공격 32회(아래)
- 증거: `evidence/`(ci.log · nc*.txt · check-absence.txt · container/{matrix.txt, matrix-partial.txt, scripts/, Dockerfile, samples/})

## 판정: **PASS with notes**

블로커 0. PR 이 새로 만든 설치자 바이트 손실 0 · 원칙 위반 0. main 대비 달라진 것은 설계가 받아들인 두 가지(§1.2 ③ 백업이 한 번 일찍 · §1.2 ④ 손실 경로 폐쇄)뿐이고, §1.2 ④ 는 main 의 **실제 손실**을 컨테이너에서 재현한 뒤 PR 이 막는 것을 봤다.

## 기준 1–4

| # | 기준 | 결과 | 근거 |
|---|---|---|---|
| 1 | §1.2 ③ S0/S1 은퇴 룰·훅·에이전트를 첫 update 가 백업 뒤 치운다 · 설치자가 고쳤거나 만든 은퇴 이름 파일은 백업이 남는다 | **충족.** 26.100 · 26.125 의 디스크 위 은퇴 파일(14 · 15개, 표식 포함): PR 은 u1 뒤 **0**, main 은 u1 뒤 14 · 15 → u2 뒤 0. 설치자 표식(편집 `code-style` · `error-handling` · `code-reviewer` · `security-reviewer` · `hito-counter`, 직접 만든 `rules/database.md` · `hooks/karpathy-gate.sh`)은 전부 u1 에서 `.backup-*` 로 — 끝까지 BACKUP, LOST 0. 부분 update(`--only skills·new-skills·hooks·rules`) 뒤 첫 full update 도 같다 | `container/matrix.txt` · `matrix-partial.txt` · `samples/26.100.0-claude-A/summary.txt`(u1) · `log.txt` |
| 2 | §1.2 ④ 기록이 하네스 것이라 말하지 않는 옛 스캔 항목은 남긴다 — 백업 없는 삭제 0 | **충족 + main 의 손실 실증.** 실제 판 탐침: 현행 번들에서 빠진 옛 템플릿 이름은 **전부** `RETIRED_PATHS` 에 있다(26.100 · 125 · 150 · 161 대조) — 그래서 장면은 "다음 릴리즈가 템플릿을 빼고 은퇴 목록에 안 넣을 때"다. 26.161 은 설치 전에 있던 트랙 밖 이름 설치자 파일(`agents/strategist.md`)을 **설치자 sha 로** `policyFiles` 에 적는다(탐침 확인). 그 이름을 번들에서 뺀 변형으로 update: **main(Xm) = u1 에서 백업 없이 삭제 → LOST**, PR(X) = 5단계 내내 LIVE(uninstall 뒤도) | `container/matrix.txt` X/Xm 행 · `samples/26.161.0-claude-X{,m}/summary.txt` · `scripts/setup-drop.sh` |
| 3 | 표식 LIVE 또는 백업 · 2회차 백업 0 · uninstall 뒤 하네스 바이트 0 · PR-A 보호 유지 | **충족.** PR 16흐름 전부 LOST 0 · u2 백업 0 · uninstall 뒤 하네스 템플릿 바이트(5판 템플릿 sha 454개 대조) 0. uninstall 직후 최종 표식 상태는 PR 과 main 이 **12쌍 전부 동일**(X/Xm 만 다르고 그 차이가 기준 2). main A 의 u2 백업 14 · 15 → PR 은 u1 로 이동(PR u1 34 = main 20+14, 35 = 20+15, codex 조합 39 = 25+14, 40 = 25+15 — 정확히 옮겨옴. 리드 브리프의 13 보다 큰 것은 은퇴 이름 표식을 4개 더 심었기 때문) | `container/matrix.txt` newbk · harnessBytesAfterUn 열 |
| 4 | 테스트 재작성이 단언을 약하게 하지 않았는가 | **충족.** 지운 `update-mode.test` 3건(지운다 · 비면 [] · 다른 확장자 무시)은 새 `policy-file-ownership` ⓒ2 한 건이 `runUpdateMode` 경로로 셋 다 단언(alive.md 생존 · `stale.txt` 는 **기록에 있는데도** 확장자로 생존 — 원본보다 강함) + 백업 없음 + 기록에서 빠짐까지. "설치 기록이 하네스 소유를 증명하면 orphan 을 지운다" 는 `records:"writer"` 추가로 전제가 "지금 판 기록"으로 좁혀졌지만 삭제 단언은 그대로이고, 빠진 반쪽(표시 없는 옛 스캔 · 트랙 밖 → 남김)은 ⓑ 가 반대 방향으로 단언 — 반전이 아니라 분리. ADR-089 테스트는 S0 전제가 §1.2 ③ 으로 더는 "남는 장면"이 아니게 돼 writer 기록 전제로 옮겼고, 단언 3개(이름 냄 · 파일 남음 · reviewer 미포함) 그대로 | 아래 음성 대조 · `git diff 8e6d87b..aab5c4d -- tests/` |

### 음성 대조(리뷰어가 isoPB 에서 다시 돌림 — 변이 diff 를 각 파일에 기록, 매번 `git checkout` 복원 · 끝에 `git status` 깨끗)

| 변이 | tsc | red |
|---|---|---|
| nc1 `src/update-mode.ts` 를 main 판으로 | 0 | ⓐ §1.2 ③ · ⓑ §1.2 ④ (2) |
| nc2 백업 분기 무력화 | 0 | ⓒ3 편집 룰 · ⓐ (2) |
| nc3 `rec.state === "none"` 가드 제거 | 0 | 6 — ⓒ1 · ⓑ · ADR-089 · ADR-090 · 기존 2 |
| nc4 기록 무시(항상 sha) | 0 | 8 |

`npm run ci` exit 0(Branches 89.59). check-absence `policyBaseline|baselineRecord|policyBase\b|ctx\.baseline` src → exit 0(카나리 통과).

## Findings

[MEDIUM-1] 삭제가 판정을 따르지 않는다 — `none` 가드가 설치자 파일을 지키는 유일한 줄
File: src/update-mode.ts:2299-2305 `pruneOrphans`
Issue: `judge` 의 결과 중 `backup+remove` 만 보고 `unlinkSync` 는 **verdict 와 상관없이** 실행한다. 지금은 앞줄의 `rec.state === "none"` 가드가 judge 의 `leave` 행(none)을 미리 걸러 결과가 맞다. 그러나 nc3 이 보이듯 그 가드 한 줄을 빼면 설치자 파일 6개 장면이 지워진다 — judge 를 부르면서도 "판정 하나" 가 아니라 가드와 judge 두 곳이 같은 규칙을 갖고, judge 표에 `leave` 를 내는 행이 늘면(예: 미래의 remove 측 예외) 이 자리는 조용히 삭제한다. 현재 실증 손실은 없다(테스트 6건이 가드를 문다).
Fix: 방향만 — `verdict === "leave"` 면 건너뛰는 것을 삭제의 조건으로 삼아 판정 결과가 곧 동작이 되게 한다(outside 보고 순서는 `outside.skip` 을 `none` 판정 뒤에 두면 지금과 같다). 작성자 인계 "미심쩍은 부분" 과 같은 지점.

[NOTE-1 · 기존 · PR-B 무관] 설치자가 만든 은퇴·트랙 밖 이름 파일에 "지워도 된다" 안내
26.161 설치본에서 설치자가 직접 만든 `agents/code-reviewer.md` · `security-reviewer.md` · `strategist.md` 를 update 가 "…를 지워도 된다" 로 안내한다(기록은 none 이라 PR 은 올바르게 남긴다 — 안내만 이름 기준). main 동일(`samples/26.161.0-claude-Am/u1.txt` 3줄 = PR 3줄). 화면 통일(PR-C) 때 안내도 `recorded()` 로 가를지 볼 것.

[NOTE-2 · 기존] `.claude/commands/uzys/` 은퇴 자리는 update 가 회수하지 않는다 — 현행 번들에 `templates/commands/uzys` 가 없어 `pruneOrphans` 가 첫 줄에서 돌아선다. uninstall 이 백업 뒤 치운다(26.161 의 설치자 파일 `commands/uzys/auto.md` 도 uninstall 이 백업으로 옮긴다 — main 동일, 손실 아님). §1.2 ③ 의 "룰·훅·에이전트" 범위와 일치.

[NOTE-3 · PR-C 로 미룬 것 확인] 26.100 첫 update 화면이 직접 만든 `rules/database.md` 를 포함해 `no checksum … may not be your edits` 로 센다(MEDIUM-1 of lane note) — 그대로 PR-C.

## Positive Observations
- 판정 입력이 `recorded()` 하나로 모여 §1.2 ④ 손실 경로가 데이터(`RETIRED_PATHS` 완전성)가 아니라 구조로 닫혔다 — main 의 실제 손실(Xm LOST)을 같은 설치본에서 PR 이 막는 것을 봤다.
- src 순감 23줄, `PolicySyncCtx` 의 선택 필드 2개가 필수가 되어 "기록 없이 판정" 하는 단위 테스트 전용 경로가 사라졌다.

## 한계
- 실설치는 26.100 · 26.125(claude 6흐름 + 부분 4흐름 + claude,codex A) · 26.161(claude 6흐름 + X) × PR/main = 32회. 26.132 · 26.150 은 X 탐침(기록 모양 확인)만 하고 매트릭스는 안 돌렸다 — 은퇴 자리 판정은 S3/S4 에서 `scanFieldOf` present → none 이라 26.161 과 같은 길이다.
- §1.2 ④ 는 실제 판에 해당 이름이 없어 번들에서 템플릿 하나(`agents/strategist.md`)를 뺀 **변형 빌드**로 재현했다(PR · main 같은 방식).
- 화면 문구는 판정하지 않았다(PR-C 범위). Docker 이미지·컨테이너 `uzys-rev815-*` 는 지웠다(잔존 0 확인).

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (src 2파일 · tests 2파일)
- [x] SPEC/PRD 범위 내 (설계 §5.5 · §1.2 ③④ · §6 PR-B 행)

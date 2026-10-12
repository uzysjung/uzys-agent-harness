# PR-D 독립 리뷰 ① — 설계 이행 · 편차 판정 (fix/uninstall-no-folder-move · 57c01f8 + 병합 13b6887, 기준 main@ac4de4c)

## 결론: **BLOCKER 1건(문서 · 고치는 비용 작음)** — 코드는 설계대로이고 차단 결함 없음

## 이 판정의 근거 (직접 재실행)
- `npm run ci`(파이프 없음, 13b6887 사본): **exit 0** — 2264 tests, branches 89.39 / lines 96.69. `tsc --noEmit` 0.
- 폴더 함수: `src/` 에서 `backupDir` · `copyBackupDir` · `moveAside` 호출 0(grep). `fs-ops.ts` 에서 `backupDir` 삭제됨.
- 탐침 테스트 11건(사본 안에서만 돌리고 지움 — 본문은 scratchpad `zz-revd1-*.test.ts.txt`), 모두 의도대로:
  - P1 이미 있는 `.claude.backup-*/` · `.codex.backup-*/` · `rules/old.md.backup-*` → 지우지 않고 `[BACKUPS] 3건` 으로 나열
  - P2 **룰 자리** displaced(PR-B 의 `updateDir` 이 기록) → 전량 uninstall 이 "MINE RULE" 바이트로 되돌림
  - P3 스킬 두 자리 displaced: dry-run `○ put back 2 file(s)` · 디스크 무변경 → 실행 결과 같음
  - P5 전량 + 링크 슬롯: 본문은 `.agents/` 쪽으로 한 번만 회수, 설치자 링크 남김 · 화면 `your link →` · 백업 0
  - P6 **앵커 자리** displaced(설치자가 같은 이름 앵커를 둠) → 앵커 회수 뒤 되돌림(편차 ① 의 근거 사례)
  - P7 `--cli codex`: `.codex/prompts/mine.md` · `config.toml` 의 설치자 표 남음 · 백업 0 · `left .codex/ — 2 file(s)`
  - P8 `--cli opencode`: `.opencode/command/mine.md` 남음
  - Q1 `--only ext`: 자산 파일만 지움, 하네스 룰 바이트 동일, 슬롯의 설치자 노트 남음 · 백업 0
  - Q2 `--cli claude`: `.claude/skills/ext` 자산 남음 + `remove with: agent-harness uninstall --only ext` · `assets[].files` 유지(A1 · N8)
  - Q3 전량: 자산 회수 + 설치자 노트 `left` 로 이름 나옴
  - 옛 앵커(`CLAUDE.md`) 안 고침 → 지움 / 고침 → `kept — modified`, 백업 0(편차 ②)
- Docker(레인 전용 태그 `uzys-harness-test:revd1`, 실행 뒤 이미지 삭제): claude-slot · wizard-add-cli · uninstall · uninstall-cli · no-record-plain **5종 모두 RC=0**. 구현자는 실행하지 않았다 — 이 실행이 첫 증거다.

## 1. §2.3 종류별 처리 — 전부 설계대로
| # | 판정 | 증거 |
|---|---|---|
| 1·2 안 고침 → 지움 · 고침 → 그 파일 하나 백업 + 지움 | ✓ | 새 테스트 §2.4-1 · M1(구현자) |
| 3 no-sha | ✓ | 옛 로그 테스트 · `.installed-tracks` 는 `installedTracksText` 로 조용히 회수(백업 0) |
| 4 displaced 되돌리기(전량 · `--cli`) | ✓ | P2 · P3 · P6 · 새 테스트 6건 · **M-a red 6** |
| 5·13 함께 쓰는 파일은 몫만 | ✓ | P7 · 새 테스트 · **M-c red 3** |
| 6 설치자 파일 제자리 | ✓ | P7 · P8 · Q3 · Docker wizard-add-cli ⑤ |
| 7 자산 — `--cli` 는 손대지 않음 | ✓ | Q2 |
| 8 빈 폴더 + 뼈대 | ✓ | **M-f red 3** |
| 9 밖 링크 | ✓ | N-B · N-C(아래) |
| 11 이미 있는 백업 | ✓ | P1 |
| 14 링크 슬롯 | ✓ | P5 · **M-d red 3** |

## 2. 구현자 편차 다섯 — 전부 수용
- ① 앵커 회수를 displaced 되돌리기 **앞**에: **맞다.** 앵커 자리도 displaced 일 수 있다(P6). 뒤에 두면 자리가 막혀 못 되돌린다.
- ② 옛 기록의 앵커가 루트 `CLAUDE.md` 이고 고쳤으면 남김: **맞다.** 이 PR 전과 같은 동작이다. 루트 `CLAUDE.md` 는 원칙상 "함께 쓰는 파일"(설치자 소유)이고 #13 행이 함께 쓰는 파일의 `backup+remove` 를 금지한다. ADR-097 Consequences 의 글자와는 다르므로 설계 §10 에 가정 한 줄로 남기기를 권한다(NOTE).
- ③ `--keep-templates` 면 화면으로 들어가지 않음: **맞다.** 설계 §2.1 표의 "거절 · 무변경" 의도를 TTY 에서도 지킨다. **M-e red 1**.
- ④ 기록에도 없고 그 CLI 도 안 깔린 함께 쓰는 파일은 읽지 않음: **맞다.** 기록 밖 설치자 파일을 건드리지 않는다는 원칙의 직접 적용이다. 깔린 CLI 의 옛 로그 알림 경로는 그대로 열려 있다.
- ⑤ Docker claude-slot ③ 수정: **맞다·필수.** 링크 슬롯을 남기면(B4) 옛 "`.claude/` 없음" 단언은 반드시 깨진다. 실행 green.

## 3. N-A · N-B · N-C — 반영됨, 셋 다 테스트가 문다
- N-A `foreignOwnedTarget` 하나로 슬롯 · 중간 폴더 · 말단을 봄 → **M-d** 로 N-A · B4 · 막힌 자리 3건 red
- N-B 뼈대 시작점의 밖 판정 → 가드 무력화 시 N-B 테스트 red(tsc 0)
- N-C strip 전 밖 판정 → **M-b** 로 `uninstall-leaks` "프로젝트 밖 config.toml" red 1
- 모든 변이: 적용을 `git diff --stat` 로 확인 · `tsc` 0 · 원본 복원 확인. 대조 실행(변이 없음)에서 4파일 108건 green.

## 4. 문서 · 화면
- 루트 `CLAUDE.md` 두 문장: 설계 §6 문안과 글자가 같다. 단 NOTE-1.
- USAGE · README.md · 위저드 힌트 · 확인 화면: 실제 동작과 맞다. 화면은 실제로 한 일만 말한다 — dry-run 수 = 실행 수(§2.4-6 · P3). 되돌린 파일은 `put back` 과 `left … of yours` 양쪽에 나오는데, 둘 다 사실이다.
- **BLOCKER-1 은 아래.**

## 5. 병합 13b6887
- `fs-ops.ts` 의 import 해소가 맞다. `renameSync` · `rmdirSync` 는 `backupDir` 과 함께 빠졌고, `writeFileSync` 는 #770 의 `backupContent` 몫이다. lint · tsc 0.
- #770 과 함께 맞게 돈다. `holdSlotFiles` 는 update 의 외부 스킬 갱신 쪽에만 있고, uninstall 의 외부 스킬 회수는 그대로 `removeToolFiles`(기록 sha 그대로면 지움 · 다르면 백업 뒤 지움)다. Q1~Q3 에서 자산 회수 · 설치자 노트 보존 · `--cli` 의 자산 보존이 서로 간섭하지 않았다. #770 테스트도 CI 안에서 green.

---

## BLOCKER-1 — 설치자가 읽는 문서 두 곳이 옛 동작(폴더를 옮긴다)을 말한다
- 증거:
  - `README.ko.md:201` — "`.claude/`, `.codex/`, `.opencode/` 폴더는 삭제하지 않고 `.claude.backup-<시각>`처럼 이름을 바꿔 옆에 남긴다 … 백업 폴더에서 다시 꺼내 쓰면 된다"
  - `index.html:366`(랜딩) — "renamed to something like `.claude.backup-<time>` … take back what you need from the backup"
  - 이 PR 은 같은 문단의 `README.md:194` 만 고쳤다. 원인은 설계 §7 표에 두 파일이 빠진 것이고, 구현자 잘못은 아니다. 직전 #766 은 세 파일을 함께 고쳤으니 이 저장소는 세 파일을 같이 맞춘다.
- 재현: `grep -n "backup-<시각>\|renamed to something like" README.ko.md index.html` → 2줄. 실제 동작은 P7 · Q3 · Docker wizard-add-cli ⑤ 가 보인 그대로다: 설치자 파일은 제자리에 있고 백업 폴더는 0개다.
- 설치자에게 미치는 영향: 한국어 README 와 랜딩 페이지를 읽은 사람이 uninstall 뒤 있지도 않은 백업 폴더를 찾는다. 반대로 "폴더가 비워진다" 고 믿고 커밋하면 자기 파일이 그대로 남아 있다. 파일을 잃지는 않지만, 세 동작의 화면 · 문서를 "실제로 한 일만" 말하게 하려는 이 PR 의 목적과 정면으로 어긋난다.
- 완료 기준: 두 문단을 `README.md:194` 의 새 문장과 같은 뜻으로 고친다(하네스가 쓴 파일만 하나씩 지움 · 설치자 파일 제자리 · 하네스가 대신했던 설치자 파일은 되돌림). 고친 뒤 위 grep 이 0줄이어야 한다. 문서 변경이므로 `npm run ci` 를 전체로 다시 돈다.

## NOTE (차단 아님)
- **NOTE-1 루트 `CLAUDE.md:30` 이 아직 없는 동작을 말한다.** "하네스가 그 자리를 떠나는 동작(uninstall · `--cli` · **은퇴 회수**)이 제자리로 되돌린다" 라고 쓰지만, update 의 은퇴 회수와 `--reinstall` 의 기록 밖 회수는 아직 되돌리지 않는다(`judge.ts` 주석 · 설계 §13 ①). `:34` 는 "v26.169.0 에서 고쳤다" 로 끝나 이 예외를 말하지 않는다. 이 저장소에만 있는 개발용 문서라 설치자가 잃는 것은 없다. 다만 다음 에이전트가 이미 된 일로 읽을 수 있다. 권장: `:34` 에 "예외: update 의 은퇴 회수 · `--reinstall` 의 되돌리기는 아직(설계 §13 ①, 이슈 #…)" 을 더하고, 이슈가 없으면 연다.
- **NOTE-2 `--cli claude` 가 지우지 못한 하네스 파일의 기록도 함께 지운다.** `settleCliLog` 가 `policyFiles` · `skillFiles` 를 통째로 지우므로, 읽지 못했거나(P4: `chmod 000` 룰 → `left — could not read`, exit 0) 밖 링크라 남긴 하네스 파일이 기록 없이 디스크에 남는다. 다음 `install --cli claude` 는 그 파일을 설치자 파일로 보고 백업한 뒤 `displaced` 로 적는다. 그러면 이후 uninstall 이 하네스의 옛 사본을 "설치자 파일" 이라며 되돌린다. 손실은 아니고 빈도는 낮다. 전량 uninstall 도 기록을 지우므로 같은 결과다. 권장: `--cli` 에서는 `unjudged` · `outside` 경로의 기록을 남긴다.
- **NOTE-3 `--cli` 경로에 #676 사전 점검과 중간 멈춤 기록이 없다.** 이 PR 전부터 없었다. 다만 폴더를 한 번 옮기던 것이 파일마다 `rm` 하는 방식으로 바뀌어, 중간에 실패할 수 있는 지점이 늘었다. 중간에 `rm` 이 던지면 스택트레이스가 나오고 기록은 갱신되지 않는다. 같은 명령을 다시 돌리면 이어서 끝나고 displaced 백업도 그대로 남으므로, 잃는 것은 없다.
- **NOTE-4 터미널이 없는 `uninstall --keep-templates` 는 `--only` 안내를 받지 못한다.** `--yes` 없이 쓰면 `lacksRemovalIntent` 의 일반 거절문("no terminal and no flag …")이 먼저 나온다. 설계가 받아들인 동작이지만, USAGE 표는 "the command prints the `--only <ids>`" 라고 말한다. `--keep-templates --yes` 를 쓰던 스크립트는 안내를 제대로 받는다.
- **NOTE-5** 편차 ② 를 설계 §10 가정에 한 줄로 남긴다(위 2절).

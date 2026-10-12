# PR #803 (#800) 독립 리뷰: 고친 하네스 훅 줄을 걷기 전에 settings.json 을 백업한다

- 대상: `07983c2`(분리된 HEAD, `git diff origin/main...HEAD`, 8파일 +241/−6). 작업 트리는 읽기만 했다. 변이는 걸었다가 되돌렸고 `git status` 는 깨끗하다
- 리뷰 레인: 이 코드를 쓰지 않은 레인이 직접 다시 돌렸다
- 증거: `rev800/evidence/` — `matrix.txt`(셀 요약) · `ev/<흐름>-<pr|old170>/log.txt`(단계별 판정 + 화면 줄) · `extra*.txt`(추가 장면) · `run.sh` · `extra*.sh` · `Dockerfile` · `ci.log`

## 판정: **PASS with notes**

합격선 5개를 모두 충족한다. 설치자가 고친 훅 줄은 uninstall(전량 · `--cli claude`) 뒤에 사라지지 않고 백업 1개에 바이트 그대로 남는다. 라이브 파일에는 죽은 하네스 참조가 없고, 고치지 않은 줄은 백업 없이 걷히며, 화면은 실제로 한 일만 말한다. 실제 npm 게시판으로 만든 3흐름 × 2 CLI 조합에서 모두 확인했다. 같은 장면을 게시판 26.170.0 uninstall 로 돌린 대조군은 4/4셀 LOST 로, 탐지기가 손실을 잡는다는 것도 함께 보였다.

| 심각도 | 건수 | 상태 |
|---|---|---|
| CRITICAL / BLOCKER | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM(이 PR 밖 · 기존 동작 · 별도 이슈 권고) | 1 | info |
| LOW | 1 | info |

## 1. 게이트

- `npm run ci`(파이프 없이 실행): **exit=0**. Branches 89.63%(하한 86) · Statements 95.47% · build 성공 → `evidence/ci.log`
- `tests/uninstall-edited-hook-backup.test.ts`: **4/4 green**
- **변이(직접 검증)**: `src/adapters/contract.ts:231`(`planStrip` 안 `if (now !== sha) plan.removedEdited.push(key);`)을 `void 0;` 로 바꿨다(`git diff --stat` 로 1줄 적용 확인). `planUpsert` 의 같은 줄(184)은 그대로 두었다
  - `tsc --noEmit` = 0
  - 결과: **3 failed | 1 passed** — ⓐ · ⓐ′ · ⓑ 가 red, 음성 대조만 green(예상대로)
  - 되돌린 뒤 4/4 green, 트리 깨끗

## 2. 실제 npm 게시판으로 검증 (docker `uzys-r800-pr` · `uzys-r800-x` — 끝난 뒤 삭제, 남은 이미지 0 · 컨테이너는 `--rm`)

- 이미지에는 `npm pack` 한 PR 빌드를 전역으로 깔았다(dist 에 `you had edited` 있음 확인)
- `/opt/old/{26.170.0, 26.140.0, 26.169.0}` 에 실제 npm 판을 받았다
- 표식:
  - `protect-files` 줄 끝에 ` && bash ./scripts/team-guard.sh # MINE-CHAIN` 를 덧붙였다
  - 설치자 자기 훅 `bash ./scripts/mine.sh # MINE-HOOKLINE` 를 더했다
- 판정 방법:
  - 고친 command 를 jq 로 뽑아 **정확히 일치**하는지로 LIVE / BACKUP / LOST 를 가렸다
  - 죽은 참조는 라이브 command 가 부르는 `.claude/**.sh` 가 디스크에 없는지로 봤다
- dry-run 앞뒤로 디스크 sha 를 대조했다

| 흐름 | uninstall 판 | 고친 command | settings 백업 | 죽은 참조 | 설치자 훅 | dry-run 디스크 |
|---|---|---|---|---|---|---|
| ① 26.170.0 설치(claude) → 편집 → uninstall | **PR** | **BACKUP** | 1 | 없음 | 라이브 | 그대로 |
| 〃 | 게시판 26.170.0(대조) | LOST | 0 | 없음 | 라이브 | 그대로 |
| ① ′ 26.170.0 설치(claude+codex) → 편집 → `--cli claude` → 전량 | **PR** | **BACKUP**(두 단계 모두) | 1(두 번째 단계에서 늘지 않음) | 없음 | 라이브 | 그대로 |
| 〃 | 게시판(대조) | LOST | 0 | 없음 | 라이브 | 그대로 |
| ② C: 26.140.0 설치(claude) → 편집 → npx 26.169.0 update → uninstall | **PR** | **BACKUP** | 1 | 없음 | 라이브 | 그대로 |
| 〃 | 게시판(대조) | LOST | 0 | 없음 | 라이브 | 그대로 |
| ③ C: 26.140.0(claude+codex) → 편집 → 26.169.0 update → `--cli claude` → 전량 | **PR** | **BACKUP**(두 단계 모두) | 1 | 없음 | 라이브 | 그대로 |
| 〃 | 게시판(대조) | LOST | 0 | 없음 | 라이브 | 그대로 |

- C 흐름 전제를 재현했다. 26.169.0 update 화면은 `kept yours: hooks.PreToolUse#protect-files.sh` 이고, 고친 줄은 update 뒤에도 LIVE 였다(4셀). 손실은 그다음 uninstall 단계에서만 난다(대조군)
- 백업 내용(② PR 셀): 고친 command 와 `session-start` 줄 · 설치자 훅 · statusLine 이 들어 있다. 백업은 은퇴 배선(`suggest-compact`)을 걷은 **뒤** 상태를 담는다. 은퇴 배선은 하네스 몫이니 문제없다
- 고치지 않은 `session-start` 줄은 26.140 모양과 지금 렌더가 같아 "고쳤다"로 잡히지 않았다(C 4셀). 구현자가 의심한 "옛 모양 줄이 고친 줄로 잡혀 백업이 하나 더 생기는 경우"는 지금은 일어나지 않는다

### 화면 (PR 판)

- 실행:
  - `✓ .claude/settings.json — removed the harness part: hooks.PreToolUse#protect-files.sh · hooks.SessionStart#session-start.sh` — `(yours stays)` 가 빠졌다
  - `⊘ .claude/settings.json — you had edited 1 harness hook line (hooks.PreToolUse#protect-files.sh) — your edit is in the copy: .claude/settings.json.backup-20261012T204356`
  - 화면이 대는 백업 이름은 디스크에 실제로 있는 파일 이름과 같다
- dry-run: `○ … — a copy is saved first as .claude/settings.json.backup-<time>`. 디스크는 그대로다(8셀 모두)
- 대조군(게시판)은 같은 장면에서 `(yours stays)` 라고 말하고 설치자 명령을 지웠다. 이 PR 이 화면의 거짓말을 바로잡았다

### 추가 장면 (`extra.txt` · `extra2.txt`)

- **E1 — 하네스가 만든 settings.json 에 하네스 몫 + 고친 줄만 있을 때**(파일째 지우는 경로, 새 테스트에 없는 분기)
  - 화면: `removed (the harness created it)` — "only its part was in it" 가 빠져 사실과 맞다 — 와 `you had edited … copy: …backup-…`
  - 결과: settings.json 은 없어지고 백업 1개에 고친 줄이 있다. **BACKUP**. 백업을 지우기 전에 만든다(`rmSync` 앞)
- **E2 — `install --reinstall`**: upsert 경로라 고친 줄을 그대로 둔다(`kept yours`). 이 PR 과 무관하고 손실도 없다
- **E4 — 그냥 `update`**: 고친 줄 LIVE. 렌더에 있는 키라 `planUpsert` 가 남긴다

## Findings

[MEDIUM] `install --without settings:hooks.<Event>#<script>` 가 설치자가 고친 하네스 훅 줄을 백업 없이 지운다 — 이 PR 밖이고 기존 동작이다
File: src/adapters/contract.ts:182-184(`planUpsert` 의 `alwaysStrip`) · src/shared-write.ts:274 · src/commands/install-render.ts:1852-1854
Issue:
- 재현(E3, docker): PR 판으로 설치(claude) → `protect-files` 줄 편집 → `agent-harness install --track tooling --cli claude --without 'settings:hooks.PreToolUse#protect-files.sh'` → 고친 command **LOST**, 백업 0
- 화면은 `your edits to … went with it` 라고 알린다. 설치자가 직접 요청했고 화면도 알리니 거짓 출력은 아니다. 하지만 이 PR 이 uninstall 에 세운 "고친 몫을 걷기 전에 그 파일 하나를 백업한다"(루트 CLAUDE.md §설치자 디스크)와 어긋난다
- 게시판 26.170.0 에서도 똑같다(E3b). **이 PR 이 나쁘게 만든 것이 아니다**
- 일반 `update` 는 렌더에 있는 키를 남겨서(E4) 손실이 없다. 손실이 나는 것은 설치자가 훅을 빼라고 요청한 경우뿐이다
Fix: 별도 이슈로 올린다. `writeShared` 가 `upserted.removedEdited` 가 비어 있지 않을 때 같은 `backupFile` 을 한 번 부르면, 이 PR 과 같은 판정 하나로 닫힌다(화면 문구 `went with it` → 백업 경로). 이 PR 을 막지 않는다

[LOW] 파일째 지우는 분기(`fileRemoved` + edited)는 단위 테스트에 없다
File: tests/uninstall-edited-hook-backup.test.ts
Issue: 새 테스트 4건은 모두 settings.json 이 남는 장면이다. `only()` 가 문구를 바꾸는 분기와 "백업 → rmSync" 순서는 이 리뷰의 docker E1 만 확인했다. 커버리지 게이트는 통과한다
Fix: 선택 사항. ⓐ 에서 "설치자 훅을 더하지 않은" 변형 1건을 더하면 그 분기를 문다

## 읽어서 확인한 것

- 정확성:
  - `removedEdited` 는 `alwaysStrip` 이 참이고 값이 다를 때만 차오른다. 그런 키는 `json-keys` 의 핸들러 키뿐이라, 다른 어댑터 4종은 늘 빈 배열이다. 화면이 "hook line" 이라고 단정해도 맞다
  - 백업은 `write` 일 때만, 쓰기·삭제 **앞에서** 1회 만든다
  - `excluded` 키는 `planStrip` 이 먼저 건너뛰므로 설치자가 뺀 줄은 백업 판정에도 들어오지 않는다
- 범위·구조:
  - 판정 하나(`now !== sha`)와 기존 `backupFile` 재사용만 했다. #781 의 기록 없는 옛 줄 규칙(`removeRetiredHookRefs` · 지문)은 건드리지 않았다
  - 사용자 결정 ⓐ(백업 1회 후 제거) · "가장 단순한 판" 지시와 맞는다. 새 가드나 분기 장치가 없다
- 보안·성능: 해당 사항 없음. 백업은 settings.json 한 파일을 복사할 뿐이다
- 남는 화면 한계(이 PR 밖, 대조군도 같다):
  - `⊘ left .claude/ — 1 file(s) not on the install record … settings.json` 줄이 같은 실행에 함께 나온다
  - C 흐름 라이브 파일에 빈 이벤트 배열(`"SessionStart": []` 등)이 남는다
  - 둘 다 이 PR 이 만들지도 늘리지도 않았다

## Verdict

- [x] CRITICAL 이슈 없음
- [x] 합격선: 고친 줄 손실 0(PR 6셀 + E1) · 백업 정확히 1개 · 죽은 참조 0 · 고치지 않은 줄만 있으면 백업 0(음성 대조 테스트) · 화면이 디스크와 일치
- [x] 변이 red 직접 확인(3 red · tsc 0 · 되돌림)
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/PRD 범위 내

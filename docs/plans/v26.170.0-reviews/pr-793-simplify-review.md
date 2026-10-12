# PR #793 독립 리뷰 — 외부 스킬 자리 보호 단순화 (#780/#770) · e506fb3 vs main fc13c73

## 판정: **PASS with notes** — 막을 것 없음

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 0 | pass |
| LOW / NOTE | 3 | info |

탐침은 내가 만든 별도 워크트리 2개(PR · main)에서 돌렸다. lead 트리는 읽기만 했다(`git status` = node_modules 만 · HEAD e506fb3 그대로). 워크트리와 docker 이미지는 끝난 뒤 지웠다.

## 기준별 결과

### (1) 설치자 파일이 사라지는 경로가 없다 — 충족
| 장면 | 결과 | 근거 |
|---|---|---|
| 정상 실행 (첫 추가 · 재실행 · update · 루트 전체 자산 · 둘을 함께) | 손실 0 · main 과 같음 | 아래 (2)의 대조 26개 상태 |
| 도구가 0 이 아닌 코드로 끝남 · 시간 초과(status null) | 원본이 제자리로 돌아온다 · displaced 없음 · 자산 기록 없음 | 탐침 E · L · K(루트 전체 자산 실패) = main 과 같음 |
| JS 예외 (도구가 폴더를 지운 뒤) | 1 MiB 넘는 파일까지 바이트 그대로 제자리 · 백업 폴더 남지 않음 | 탐침 J + PR 테스트 P-A(install · update 경로) |
| settle 도중 실패 (자리 0555, 1 MiB 넘는 파일 포함) | 파일이 `<slot>.backup-<ts>/` 에 바이트 그대로 남고, 오류 문구가 그 폴더를 가리킨다 | PR 테스트 P-E green |
| 실제 SIGINT (자식 프로세스 · 도구가 폴더를 지운 채 멈춘 순간) | 네 파일 모두(.agents 쪽 포함) 백업 폴더에 바이트 그대로 | PR 테스트 green. 실 자식 프로세스에 `kill SIGINT`, 종료 신호까지 확인 |
| 호출 전 옮기다 실패 | 이미 옮긴 파일을 되돌리고 도구를 부르지 않는다 | 코드 :600-619 |

옮기기와 되돌리기는 모두 `renameSync` 다. 옮긴 파일은 백업 폴더 아니면 원래 자리, 둘 중 한 곳에 반드시 있다. `backupFromCopy` 다음 `rmSync` 사이에서 끊겨도 사본이 하나 더 생길 뿐이다. 그 사이에 파일이 사라지는 창은 없다. 1라운드 MEDIUM-A(동시에 돈 두 번째 실행이 살아 있는 실행의 사본을 정리하던 문제)는 정리 코드가 없어지면서 함께 사라졌다.

### (2) 끊기지 않은 모든 장면에서 디스크 · 기록 · uninstall 결과가 main 과 같다 — 충족
같은 탐침 테스트(`rev793/zz-probe-793.test.ts`)를 main 과 PR 에서 돌렸다. 도구는 실 도구처럼 스킬 폴더를 지우고 새로 만든다. 그 뒤 스킬 자리의 모든 파일 sha(백업 시각은 정규화)와 기록의 assets.files · rootFiles 를 JSON 으로 떠서 비교했다(`probe-main.json` · `probe-pr.json`).
- 13개 장면, 26개 상태 → **차이 0**. 다룬 장면: A 첫 추가 덮어쓰기 + uninstall · B 같은 바이트 · C 재실행에서 고친 기록 파일 + 노트 + 1 MiB 파일 · D #770 update 두 번 + uninstall · E P-C · F 큰 파일 안 고침 · G 상류가 고친 파일을 뺌 · H 루트 전체 자산(설치자 스킬 · 다른 자산 공존) 재실행 + uninstall · I displaced 뒤 update · J P-A · K 루트 전체 자산 실패 · L 시간 초과 · M per-skill 과 루트 전체를 한 실행에.
- 비교가 빈 값끼리 같은 것이 아님을 확인했다. A 에서 `SKILL.md.backup-TS` 두 개, displaced 2건, 자산 files 4개가 있고 uninstall 뒤 원본 바이트가 돌아온다. H 에서는 better-typography 의 displaced 와 uninstall 원복, 설치자 스킬(myskill) 보존을 확인했다.
- **기록**: 도구가 쓴 파일은 main 과 똑같이 자산 몫으로 적힌다. 옮긴 탓에 `changed` 가 `created` 로 바뀌어도 `mergeToolFiles` 의 결과는 같다. 설치자 파일이 자산 몫으로 적히는 경로도 찾지 않았다. 같은 바이트로 제자리에 돌아온 경로는 `withoutCreated` 가 뺀다. 지워진 뒤 되돌린 파일은 애초에 created 에 없다. 실패한 자산에는 files 가 없다. 루트 전체 자산이 실패하면 형제 자산 자리의 복원 경로도 `back` 으로 빠진다(M · K).
- 실도구 docker(전용 태그 `uzys-r793-pr`, 끝난 뒤 지움): `scenario-update-external-skills.sh` 15개 체크가 모두 ✓ 였다(#770 · #780 첫 추가 · uninstall `--only` · 전량). 실 `npx skills add --copy` 로 따로 첫 추가도 해 봤다. 스킬 루트에 `*.backup-*` 폴더가 남지 않았다. 1.1 MB 랜덤 파일의 sha256 이 같았다. `SKILL.md.backup-<ts>` 가 생겼고, uninstall 뒤 `SKILL.md` = "MINE" 으로 돌아왔다.

### (3) 끊긴 실행은 보이는 옆 폴더 `<slot>.backup-<ts>/` 에 바이트 그대로 남긴다 — 충족
P-E 와 SIGINT 테스트가 같은 상대 경로와 바이트까지 단언한다(1 MiB 넘는 파일 포함). 다만 사용자에게 알리는 부분은 LOW-1 을 본다.

### (4) 정말 더 단순하고, 떠받치던 것을 빼지 않았다 — 충족
+227 / −615. `held-files.ts`(260줄)가 통째로 빠졌다. install · uninstall 첫머리의 남은 사본 정리, uninstall 의 "되돌리지 못하면 멈춤", 화면 이벤트 `held-settled`, `.gitignore` 의 held 줄, `buildAssetEntries` 의 `displacedPaths` 인자도 빠졌다. 빠진 것마다 대체가 있는지 확인했다.
- 다음 실행이 자동으로 되돌리던 동작 → 보이는 옆 폴더로 바뀌었다. 기준 (3)이 받아들인 교환이다.
- uninstall 의 멈춤 가드 → 사본이 더는 기록 폴더 안에 없으니 지킬 대상이 없다.
- 조각 해시(`fileShaUtf8`) → `hashContent(readFileSync(...,"utf8"))`. snapshot 과 같은 방식이라 sha 가 맞는다(P-F green). 메모리를 통째로 쓰지만 손실과는 무관하다.
- `displacedPaths` → created 분류와 `withoutCreated` 로 바뀌었다. 기록이 같음은 (2)에서 확인했다.
- held 의 `.gitignore` 줄 → fc13c73 을 포함한 태그가 없다(`git tag --contains` 0건). 배포된 적이 없으니 설치자 디스크에 남은 줄이나 남은 held 폴더도 없다.
- 남은 참조: `check-absence.sh --canary settleLeftoverHolds` 로 src · tests · test · CHANGELOG · SPEC · ADR · 설계 문서를 보니 0건이다(393개 파일).
- 구현자 메모를 확인했다. 덮인 설치자 파일은 `<file>.backup-<ts>` + displaced 로 남는다(docker 시나리오와 update 백업 목록이 읽는 이름, 실도구로 확인). 770 테스트 가짜 도구의 `force:true` 는 정당하다. 도구가 돌기 전에 파일이 이미 옮겨져 없기 때문이다. 테스트를 약하게 만든 것이 아니다.

## 변이 (tsc 0 확인 → 적용 → 원복, 원복 뒤 `git diff --quiet`)
- **호출 전 옮기기 생략**(`slotFilesToKeep(...).slice(0, 0)`) → **15건 red**: P-A ×2 · P-E · 실제 SIGINT · P-C · P-F 대조 · 첫 추가 displaced 4건 · #770 갱신 5건.
- **`withoutCreated` 무력화**(`paths.size >= 0` 이면 그대로 반환) → 1건 red: "설치자 파일이 상류와 바이트까지 같으면 손대지 않는다". 이 PR 이 새로 넣은 단언이 문다.

## 실행 증거
- `npm run ci`(PR 워크트리, 파이프 없이 exit 를 파일에 기록) → **EXIT=0** · 154 files · 2306 tests · branches 89.43%.

## Findings

[NOTE-1] 끊긴 실행이 남긴 폴더가 스킬 루트 안에 있다 — 같은 정도로 단순한 루트 밖 자리가 있다 (항목 4 판정)
File: src/external-installer.ts:604 `claimBackupDir(join(projectDir, f.slot), now)`
Issue: per-skill 자리의 백업 폴더는 `.claude/skills/<id>.backup-<ts>/` 다. 끊기면 그 안의 `SKILL.md` 를 Claude Code 가 스킬로 읽는다(같은 frontmatter name 으로 중복). `.agents/skills/` 쪽도 Codex · OpenCode 에 같은 일이 생긴다. 정상 실행에서는 남지 않고, 끊긴 경우에만 생기며 손실도 아니다.
대안(같은 줄 수): 슬롯이 아니라 **루트 기준**으로 자리를 잡는다 — `.claude/skills.backup-<ts>/<id>/…`. 루트 전체 자산은 지금도 이미 이 모양(`.claude/skills.backup-<ts>/`)이다. 자리를 루트로 정하면 실행마다 루트당 폴더 하나가 된다. 그러면 겹친 자리의 순서 문제(slotFilesToKeep 주석)가 사라진다. 옮긴 파일이 `snapshotSkillRoots` 범위 밖으로 나가 자산마다 다시 해시하지도 않는다. 스킬 탐색에도 걸리지 않는다. `.gitignore` 의 `*.backup-[0-9]{8}T*` 에 그대로 맞고, uninstall 의 `.claude.backup-*` 안내(프로젝트 루트 1단만 본다)와도 겹치지 않는다. 막는 사유는 아니다. lead 가 고르면 된다.

[LOW-1] 끊긴 뒤에는 어떤 화면도 그 폴더를 말하지 않는다
Issue: main 은 다음 실행이 파일마다 한 줄씩 말했다. 지금은 SIGINT 뒤에도, "도구 예외 + 되돌리기 실패"가 겹친 경우에도 아무 안내가 없다(예외 경로의 `settle(null)` 실패는 삼킨다). 폴더는 `*.backup-…T*` 무시 규칙에 걸려 `git status` 에도 안 보인다. 디스크에는 있고, 전량 uninstall 의 "left …" 목록에는 파일로 나온다(`yoursUnder` 가 폴더 안까지 내려간다). 기준 (3)이 받아들인 범위 안이다. 참고로만 둔다.

[LOW-2] 정보 — 그 밖에 확인한 것
- `moveFile` 의 EXDEV 처리가 빠지고 bare `renameSync` 가 됐다. 옆 폴더라 사실상 같은 파일시스템이다. 실패하더라도 호출 전이면 되돌리고, settle 중이면 폴더에 남는다. 손실은 없다.
- `docs/plans/v26.170.0-legacy-displaced-design.md` §4.2 · §13 B4 는 그 전 판(메모리 hold · 1 MiB 디스크 백업)을 서술한다. #790 때 이미 지난 서술이었고, 계획 문서라 이 PR 의 필수 항목은 아니다.

## 확인하지 않은 것
- 실제 터미널 Ctrl-C 는 하지 않았다. 대신 자식 프로세스 SIGINT 를 썼다(PR 테스트). "옮기는 도중"과 "settle 도중"에 SIGINT 를 보내는 것은 실행하지 않았다. 둘 다 rename 이 원자적이라는 데서 나온 추론이다.
- docker 의 다른 시나리오는 돌리지 않았다(이 PR 범위의 실도구 시나리오 1종 + 즉석 첫 추가만).

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (src/tests 만)
- [x] SPEC/PRD 범위 내 — 동작 같음, 장치 축소

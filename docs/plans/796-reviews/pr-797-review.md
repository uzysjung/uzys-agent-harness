# PR #810 (#797) 독립 리뷰 — owned-write 판정을 judge() 표 하나로

대상: 412d116 (`git diff origin/main...HEAD`) · 리뷰어는 코드를 쓰지 않았고 모든 수치는 직접 다시 돌린 것이다.

## Review Summary

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0 | pass |
| HIGH | 0 | pass |
| MEDIUM | 1 | info |
| LOW | 0 | pass |

**판정: PASS with notes** — 정상 경로에서는 모든 입력에 결과가 같다. 다른 것은 쓰기가 예외로 실패할 때 저널 내용 하나다(MEDIUM).

## 완료 기준별 증거

1. **새 테스트가 변경 전 동작을 실제로 고정하는가** — ✓
   - 트리 사본(`git archive HEAD`)에 `origin/main` 의 `src/owned-write.ts` · `install-log.ts` · `judge.ts` 를 덮어썼다. 사본에 `isHarnessOwned` 가 있고 `judge(` 가 없는 것을 확인한 뒤 `tests/owned-write-judge.test.ts` 실행 → **32/32 green**.
   - PR 트리에서도 32/32 green(`npm run ci` 안에서 확인).
2. **모든 입력에서 결과가 같은가** — 정상 경로는 ✓, 예외 경로는 ✗(아래 MEDIUM).
   - 차분 탐침: 변경 전 writer 와 변경 후 writer 를 한 프로세스에 함께 올려 **512개 조합**을 돌리고 출력을 바이트 단위로 비교했다. 조합의 축은 기록 상태 8종(none · sha=디스크 · sha=next · sha=다른 값 · sha=`""` · owned 만 · owned+sha=디스크 · owned+sha=다른 값), 디스크 4종(없음 · next 와 같음 · 다름 · 빈 파일), install/update, 옵션 4종(없음 · createInRefresh · backupFirst · 둘 다), 모양 3종(일반 파일 · 프로젝트 안 dangling 링크 · 프로젝트 안 파일 링크)이다. 비교 대상은 반환값 · `result()` 전체 · **저널 호출 순서와 내용** · 디렉터리의 최종 내용이다. → **diffs 0**.
   - 탐침 대조군: 변경 후 코드의 `backedUp` 조건을 `rec.state === "sha"` 로 바꾸면 **diffs 32** 가 나온다. 탐침이 실제로 차이를 잡는다는 증거다.
   - 함께 확인한 것: Q3(첫 접촉 · 같은 내용)는 `true` 를 반환하고 displaced(notes 비어 있음)를 남기며 `files` 에는 싣지 않는다 — 변경 전과 같다. foreign · outside 선검사는 바뀌지 않은 코드다. `mkdirSync` 가 이제 덮어쓰기 전에도 도는데, 파일이 이미 있으면 상위 폴더도 이미 있으므로 효과가 없다.
3. **`npm run ci`** — PR 트리에서 파이프 없이 실행해 **exit=0**, Test Files 161 / Tests 2394 passed, branches 89.7(문턱 86). 실행 후 `git status` 에는 원래 있던 `node_modules` 심링크만 남았다(트리 변경 없음).
4. **변이 하나를 직접 걸어 빨간불 확인** — ✓. 사본에서 PR 판 `owned-write.ts` 의 `|| (verdict === "overwrite" && opts?.backupFirst === true)` 를 지웠다. typecheck 는 해당 파일 오류 없이 통과했고, 테스트는 `install/update · rec=sha-same · disk=different · backupFirst` **2건 FAIL**(30 pass). 원상 복구 뒤 다시 32/32.

## Findings

[MEDIUM] 첫 접촉 파일 쓰기가 예외로 실패하면 멈춘 실행의 기록에서 `displaced` 가 빠진다
File: src/owned-write.ts:217-238
Issue: 변경 전에는 `backupFile` → `displace()`(저널에 displaced 와 백업 경로를 적음) → `writeFileSync` 순서였다. 변경 후에는 `backupFile` → `writeFileSync` → `displace()` 순서다. 그래서 `writeFileSync` 가 던지면 저널에 백업 경로만 남고 displaced 항목은 없다. 실측: 첫 접촉 파일을 chmod 444 로 만들어 EACCES 를 냈더니 변경 전은 `backup,displaced:1`, 변경 후는 `backup` 만 남았다. 이 저널은 `installer.ts:543-565` 의 `recordInterruptedInstall` 이 멈춘 설치의 기록으로 쓰는 경로이고, `WriteJournal.displaced` 주석이 "멈춘 실행의 기록도 되돌리기 근거를 잃지 않는다"를 약속한다. 실제 피해는 쓰기가 중간에 끊겨 설치자 파일이 잘린 경우(ENOSPC 등)에만 생긴다. 그때 원본 백업은 디스크에 남고 화면도 알려 주지만, uninstall 이 자동으로 되돌릴 근거가 사라진다. EACCES 처럼 파일이 그대로인 경우에는 피해가 없다. 드물고 데이터도 남으므로 블로커는 아니다. 다만 목표로 한 "모든 입력에 결과가 같다"가 예외 경로에서는 성립하지 않는다. `install-writes.ts` 도 쓰기 → 기록 순서지만 거기서는 저널을 직접 쓰지 않는다.
Fix: displaced 저널 기록을 쓰기 전으로 되돌린다. 판정(`record`)은 쓰기 전에 이미 알 수 있으니, displaced 블록을 백업 블록 바로 뒤, 쓰기 앞으로 옮기면 된다. 이 순서를 지키고 싶으면 위와 같은 throw 탐침 1건을 회귀 테스트로 둘 수 있다(선택).

## 표가 덮지 않는 입력(직접 탐침해 같음 확인 — 테스트 추가는 선택)
- 저널 호출(순서·내용) — 새 표는 저널을 단언하지 않는다. 정상 경로에서는 위 512개 조합으로 같음을 확인했다.
- `sha-edited × disk=same` · `owned` 와 기준선이 함께 있는 경우 · 기준선 sha 가 `""` 인 경우 · install 에서 `createInRefresh` · 링크 모양 — 전부 diffs 0.
- 프로젝트 밖 링크 · foreign 슬롯 — 판정 앞에서 먼저 돌아가는 바뀌지 않은 코드라 판정 교체의 영향 밖이다.

## Positive Observations
- 손으로 쓴 판정 7행이 `judge()` 하나로 줄었다. refresh 생성 규칙은 판정이 아니라 대상 선택이라 판정 앞에 남겨 두었다. `baseline.has` 를 `rec.state === "sha"` 로 바꾼 것도 `restored` 조건과 같은 뜻이다.
- `backedUp` 이 `no-sha` 백업을 계속 담는다(`rec.state !== "none"`). 그래서 update 화면이 `checksumOnRecord` 로 다시 가르는 계약이 유지된다.
- `isHarnessOwned` 를 지운 뒤 `src`·`tests` 에 남은 호출부가 없다(docs 의 언급은 이력 문서다).

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (변경 파일: src/owned-write.ts · judge.ts 주석 · install-log.ts 의 `isHarnessOwned` 삭제 · 새 테스트)
- [x] SPEC/설계 범위 내 (설계 §4.2 · 검증 N12 의 매핑과 일치)

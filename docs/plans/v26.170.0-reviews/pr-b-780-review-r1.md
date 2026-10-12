# PR #790 (#780) 독립 리뷰 — 설계 이행 + 손실 탐색

대상: 4db6f97 (base a6be19f) · 격리 워크트리 · 리뷰어가 직접 재실행한 결과만 적는다.

## 판정: **BLOCK** (BLOCKER 1 — 중단된 실행에서 설치자 파일 손실. 완료 기준 "partial runs · tool exceptions" 미충족)

정상 흐름(첫 추가 · 덮임 · 지워짐 · 1 MiB 초과 · uninstall 전량/`--only`/`--cli`)은 설계대로 동작하고 실도구로도 확인했다.
막는 것은 하나다. 실행이 **도중에 끊기면** 지켜 두던 설치자 파일이 어디에도 남지 않는다.
참고로 main 보다는 확실히 낫다(main 은 첫 추가에서 무조건 잃는다). 같은 손실은 #770 재실행 경로(고친 기록 파일 · 노트)에도 v26.169.0 부터 있었다.
위험을 감수하고 머지할지는 lead·사용자가 정한다. 다만 기준 문장대로면 이것은 미충족이다.

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH (BLOCKER) | 1 | **block** |
| MEDIUM | 2 | warn |
| LOW | 1 | info |

## 재실행 증거

- `npx vitest run` §6 PR-B 행 4파일 + `tests/displaced-restore-all-removes.test.ts` → 5 files · 39 tests green, exit 0
- `npm run ci`(파이프 없이 exit 를 파일에 기록) → **exit=0**. 153 files · 2299 tests · branches 89.38
- 변이 4건(모두 `tsc --noEmit` exit 0 에서 적용하고 원복함. 원복 뒤 `git status` 는 clean):
  - M1 `installer.ts` 의 `skillSlotsFor(skills,…)` → `skillSlotsFor([],…)`: 새 테스트 4/5 red(`expected [] to have a length of 1`). 처음에 `slots: []` 로 바꾼 판은 TS6133 이 나서 증거에서 뺐다.
  - M2 `mergeToolFiles` 의 displaced 분기를 끔(`&& false`): 4/5 red. 화면에 `not put back — the spot is taken` 이 나온다. 설계가 예고한 그대로다.
  - M3 1 MiB 초과 파일을 건너뜀(`continue`): B4 테스트 red(`ENOENT … data.bin`). 큰 파일이 사라졌다는 뜻이다.
  - M4 `--only` 의 되돌리기 술어를 항상 false 로: `--only` 테스트 red
- docker 실도구(`scenario-update-external-skills.sh`, 레인 태그 `uzys-r780-rev`): **PASS** (E 단계 3개 ✓)
  - **음성 대조**: M1 을 넣고 빌드한 이미지(`uzys-r780-rev-neg`)로 같은 시나리오를 돌렸다 → `FAIL: 상류에 덮인 설치자 SKILL.md 가 백업 하나로 남지 않았다`. 이때 디렉터리에는 `LICENSE.txt` 와 `SKILL.md` 만 남았고 `mine.md` 는 지워졌다. 실도구가 폴더를 새로 만든다는 것과 시나리오가 실제로 문다는 것을 함께 확인했다. 두 이미지 모두 지웠다.

## Findings

[HIGH · BLOCKER] 중단된 실행에서 설치자 파일이 백업 없이 사라진다
File: src/external-installer.ts `holdSkillSlots` / `holdSlotFiles` (메모리에 들고 있음 · `spillDir` 를 `finally` 에서 rm) · src/installer.ts `runExternalPhase` (`runExt` 와 `settle()` 사이에 try/finally 가 없음)
Issue: 1 MiB 이하 파일의 유일한 사본은 **프로세스 메모리**에 있다. 1 MiB 초과 파일의 사본은 `os.tmpdir()` 에 둔다. 도구가 폴더를 새로 만든 뒤 `settle()` 이 돌기 전에 실행이 끝나면 설치자 파일은 복구할 수 없다. 재현은 세 가지다(탐침 테스트 · 지금은 지웠음).
  1. **Ctrl-C 재현**: 외부 자산을 [frontend-design, npm 자산] 순으로 두고 npm 단계에서 `SIGINT` 를 보내 프로세스를 죽였다(vitest forks). 디스크에서 `.claude/skills/frontend-design/SKILL.md` 는 상류 바이트로 바뀌었다. `mine.md` 와 `.agents/skills/frontend-design/mine.md` 는 **없다**. 백업 파일은 0개다. src 에 SIGINT 처리기가 없어서(`grep SIGINT\|process.on( src` 0건) `finally` 도 돌지 않는다. 지켜 두는 기간은 도구 한 번이 아니라 **외부 단계 전체**다. 뒤에 오는 npm 설치나 plugin 단계는 오래 걸리고, 사람이 Ctrl-C 를 누르기 쉬운 순간이 바로 거기다. 터미널을 닫아 SIGHUP 이 가도 마찬가지다.
  2. **JS 예외**: 도구가 폴더를 지운 뒤 예외가 나면 `InstallInterruptedError` 가 되고, `SKILL.md`="MINE" 과 `mine.md` 가 `<GONE>` 이 된다(P-A). 1 MiB 초과 파일은 `uzys-skill-hold-*` 로 tmp 에 남지만 화면도 기록도 그 자리를 말하지 않는다(P-A2).
  3. **settle 도중 예외**(EACCES · ENOSPC 등, 슬롯을 0555 로 바꿔 재현): 작은 파일은 `<GONE>` 이 되고, **1 MiB 초과 파일은 아직 되돌리지 않았는데 `finally` 가 spill 폴더를 지워** 마지막 사본까지 사라진다(P-E: `zbig len 6`=GONE · `spills: []`). 보존이 실패해도 그 사본을 지우는 순서 문제다.
  누가 겪나: 외부 스킬과 같은 이름의 폴더를 손으로 쓰던 설치자가 그 스킬을 더하거나(#780), 이미 깐 스킬 폴더에 노트나 편집을 둔 설치자가 재실행·update 하다가(#770), 외부 단계가 끝나기 전에 실행을 끊은 경우다. 장면 자체가 드물다는 점은 설계 §1.5 와 같다. 그래도 기준 문장이 "partial runs" 를 명시했고, 지금 손실은 복구할 수 없다.
Fix(방향만): 들고 있는 파일 **전부**의 사본을 호출 전에 프로젝트 안 보존 자리(슬롯 밖, 설치자가 찾을 수 있는 곳)에 디스크로 둔다. 사본은 파일마다 settle 이 성공한 **뒤에만** 지운다. `runExt` 와 `settle` 은 try/finally 로 묶는다. 이렇게 하면 SIGINT · 예외 · settle 도중 실패가 모두 닫히고 #770 경로도 같이 닫힌다.

[MEDIUM] 도구가 덮은 뒤 실패(비영 종료 · 시간 초과)하면 "put back on uninstall" 이라고 한 약속이 지켜지지 않는다
File: src/installer.ts `runExternalPhase`(실패한 자산에서도 `displaced` 를 기록하고 화면에 냄) · src/install-log.ts `buildAssetEntries`(ok 인 자산만 담음)
Issue: P-C 재현. 자산 기록은 `null` 인데 `rootFiles displaced` 는 남는다. 전량 uninstall 의 화면은 `not put back — the spot is taken; your earlier file is at …backup-…` 이고 `SKILL.md` 는 상류 바이트 그대로다. 원본은 백업으로 남아 있어 손실은 아니다. 하지만 install 화면의 문구가 거짓이 되고, 이후 재실행이 성공해도 그 파일은 before==after 라 자산 몫이 되지 않는다. 그래서 영영 되돌아오지 않는다.
Fix: 실패한 자산의 자리에서 덮인 파일은 바로 되돌리거나, displaced 로 적지 않고 편집 백업으로만 말한다.

[MEDIUM] 1 MiB 를 넘는 **안 고친** 도구 파일이 상류가 바뀔 때마다 백업된다 — #770 의 "안 고친 파일은 백업 없이 갱신" 동작이 바뀌었다
File: src/external-installer.ts `holdSlotFiles`(상한을 넘으면 sha 대조를 건너뛰고 `recorded:true` 로 듦)
Issue: P-F 재현. 상류가 `font.bin`(1 MiB+) 바이트를 바꾸고 재실행하면 `.claude/…/font.bin.backup-*` 와 `.agents/…/font.bin.backup-*` 가 생기고 화면에는 편집 백업 행이 뜬다. 같은 조건의 작은 파일은 백업되지 않는다. 그 백업은 다음 실행에서 설치자 파일로 취급되어 계속 붙들린다. 일탈 (b)를 모든 슬롯에 적용한 결과이고, 손실은 아니고 잡음과 오해다.
Fix: 큰 파일은 스트림으로 해시해 기록 sha 와 대조한다.

[LOW] `uninstall --cli claude` 가 자산이 아직 차지한 displaced 자리를 "not put back — the spot is taken" 으로 말한다
Issue: P-B 확인. 기록은 남고, 이어서 전량 uninstall 하면 `SKILL.md`="MINE skill" 로 바이트까지 제자리에 돌아온다. **정확성 문제는 없다**(구현자의 의문 ①에 대한 답 = 잡음). 다만 설계 §4.2 는 "`--cli` 해당 없음" 이라고 했는데 화면에는 경고처럼 보인다. 바로 아래 `left … (asset frontend-design) — remove with --only` 줄이 맥락을 준다.

## 구현자 일탈·의문 판정

- (a) spill 을 os.tmpdir 에: 슬롯 안에 두면 도구가 지우므로 방향은 맞다. 다만 크래시 뒤 사본이 보이지 않고 `finally` 가 지우므로 BLOCKER 와 묶인다.
- (b) 1 MiB 상한을 모든 슬롯에 적용: 메모리 측면은 타당하다. 부작용은 MEDIUM 2.
- (c) 기록된 하네스 경로 · 다른 자산 경로는 들지 않음(모든 슬롯): `RETIRED_PATHS` 에 skills 항목이 0건이고 외부 스킬 이름과 겹치는 번들 스킬도 없다. 이 규칙 때문에 설치자 파일이 빠지는 장면은 찾지 못했다. 수용한다.
- (d) displaced 경로를 이번 실행의 rootFiles 에서 유도: 탐침 P-D(첫 추가 → 재실행 → `--only`)가 제자리 · 백업 0 으로 끝났다. 수용한다.
- (e) `files` 없는 옛 판 자산은 들지 않음: `buildAssetEntries` 와 같은 판정이고 #770 과 다르지 않다. 수용한다.
- 의문 ② 첫 설치에서 루트 전체 폴백이 번들 스킬을 설치자 파일로 붙드는 문제: 도구가 그 파일을 건드리지 않으면 결과는 없다. 실제 충돌은 jakubkrehel 상류에 번들 스킬과 같은 이름의 스킬이 생길 때뿐이고, 지금은 입증할 수 없다(확신 80% 미만이라 finding 에서 뺐다).
- 의문 ③ 도구 예외 시 메모리에 든 작은 파일이 사라지는가: **사라진다** → BLOCKER.

## 확인하지 않은 것

- `method.skill` 이 상류 폴더 이름과 다른 자산(`design-taste-frontend` 등)의 실제 설치 폴더 이름이 slot 과 같은지는 실도구로 재지 않았다. docker 는 frontend-design 만 쟀다.
- 실제 터미널 Ctrl-C 는 재지 않았다. 대신 같은 효과인 프로세스 SIGINT 를 vitest fork 안에서 보냈다. 호스트에서 dist 로 install 하는 것은 훅이 차단한다.

## Positive Observations

- 변이 4건이 모두 의도한 자리에서 red 가 나고, 실도구 음성 대조까지 문다. 새 테스트가 장식이 아니다.
- `--only` 의 기록 정리가 원본 `installLog.rootFiles` 에 걸려 있어 N13-3 을 지킨다. 다른 rootFiles 항목이 보존되는 것을 테스트로 단언한다.
- 미리보기와 실행이 같은 `restoreDisplaced` 판정을 쓴다(`assetFilesGone` · `willBeGone`).

## Verdict 체크

- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/설계 범위 안(§6 PR-B 항목 전부 구현)
- [ ] 완료 기준 "어떤 시점에도 손실 없음(partial runs · tool exceptions 포함)" — **미충족**(HIGH-1)

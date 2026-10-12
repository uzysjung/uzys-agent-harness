# PR #799 (#781) 재리뷰 — 블로커 수정 · main 병합 회귀 확인

- 대상: `78e7ee2`(수정) · 병합 `893f48b`(main `5786f56` = PR-C #789 + #793 + #795 위). 1라운드 대상 `a8ceaee`
- 대조: main `5786f56` 을 같은 방식(`test/docker/Dockerfile`, npm pack)으로 빌드해 C 흐름의 update 와 현행 설치 대조에 썼다
- 증거: `rev781/r2-evidence/` — 표 `matrix-r2.txt` · 셀별 로그 `logs/<v>/<셀>.log` · 표본 `sample-26.125/` · 1라운드 대조 `r1-vs-r2-*.diff` · 변이 `mutations/` · CI `ci-r2.txt` · 현행 설치 대조 `current-install-edited-hook.txt` · 스크립트 `scripts/`(1라운드 `m.sh` + 훅 줄 검사 `hookcheck`)

## 판정: **PASS with notes**

1라운드 블로커(update 를 거치지 않은 B · F · F2 에서 고친 옛 훅 줄 손실)는 닫혔고, A(이 판으로 update → uninstall)의 기존 손실도 닫혔다. main 병합은 회귀가 없다.
**단, 리드가 적은 합격선 중 C 흐름(옛 판 → 게시판/main 으로 update → 이 판으로 uninstall)은 충족되지 않는다** — 12/12셀에서 고친 줄이 사라진다. 원인은 이 PR 이 아니라 이미 쓰인 기록 + 기존 `alwaysStrip` 설계이고, main 에서도 같고, 현행 판으로 처음 깐 설치본에서도 같은 손실이 난다(아래 HIGH-1). 이 PR 을 막을 이유는 아니지만 **"A·C 손실을 닫았다"는 주장은 A 에만 참**이다.

| 심각도 | 건수 | 상태 |
|---|---|---|
| CRITICAL / BLOCKER | 0 | pass |
| HIGH (이 PR 밖 · 기존 결함) | 1 | 별도 이슈 권고 |
| NOTE | 2 | info |

## 매트릭스 (실제 npm 게시판 → 설치자 표식 → 새 빌드)

- 판 6개: 26.100.0 · 26.125.0 · 26.132.0 · 26.140.0 · 26.150.0 · 26.160.0
- CLI 조합: `claude` (B · A · C) · `claude+codex` (B · A · C · F · F2) → **48셀**
- 표식은 1라운드와 같다. 고친 훅 줄 두 개 = `session-start` 줄 끝 `# MINE-EDHOOK` · `protect-files` 줄 끝 `&& bash ./scripts/team-guard.sh # MINE-CHAIN`
- 이번에 더한 검사(`hookcheck`, 단계마다): ① 고친 줄의 command 가 **바이트 그대로** 남았나(jq 로 전체 command 추출 → 정확히 일치) ② 옛 템플릿 command 8가지와 바이트로 같은 줄이 몇 개 남았나 ③ 같은 스크립트를 부르는 핸들러가 둘 이상인가(update 가 새 줄을 덧붙였나)

| 흐름 | 고친 줄 바이트 그대로 | 그대로인 옛 줄 남음 | 그 밖의 표식 손실 |
|---|---|---|---|
| **B** 바로 uninstall (12셀) | **2/2 전 셀** | 3·2 → **0** | 0 |
| **F** `--cli codex` → 전량 (6셀) | **2/2 전 셀**(두 단계 모두) | → **0** | 0 |
| **F2** `--cli claude` → 전량 (6셀) | **2/2 전 셀**(두 단계 모두) | → **0** | 0 |
| **A** 이 판 update ×2 → uninstall (12셀) | **2/2 전 셀**(u1 · u2 · un 모두) | → **0** | 0 |
| **C** main update → 이 판 uninstall (12셀) | update 뒤 2/2 → **uninstall 뒤 0/2 (12/12 LOST)** | → 0 | 0 |

- 26.160.0 은 템플릿 훅 줄이 두 개뿐이고 둘 다 표식으로 고쳐서 "그대로인 옛 줄 걷힘"은 나머지 5판이 증명한다(26.100: `mcp-pre-exec` · `hito-counter` · `suggest-compact`, 26.125~150: `mcp-pre-exec` · `suggest-compact`).
- 중복 핸들러: 48셀 전 단계 0 — update 는 고친 줄 옆에 새 하네스 줄을 덧붙이지 않는다(기록 없는 같은 키 = 설치자 것, Q3).
- 화면(B · F · F2 · A 공통): `⊘ left .claude/settings.json — may still hold the harness's hooks (not on record): hooks.SessionStart#session-start.sh · hooks.PreToolUse#protect-files.sh — delete them by hand if they are not yours`. 걷은 것은 `removed harness hook wiring from an older version (script gone): hooks/mcp-pre-exec.sh` 처럼 바이트 그대로였던 줄만 말한다. dry-run 이 같은 세 줄을 말하고 디스크는 그대로(B · F 18회 전부).

### 1라운드 대비 회귀 (main 병합 포함)

- 48셀의 exit · 지문 일치 잔존 · 백업 수: **전 셀 동일**(`r1-vs-r2-fp-bk.diff` rc=0)
- 백업에만 남는 표식 집합: **전 셀 동일**(`r1-vs-r2-bkonly.diff` rc=0)
- B2(다른 프로젝트의 옛 하네스 바이트 통째) 바이트 불변 · 프로젝트 밖 링크 불변 · dry-run 디스크 불변: **전 셀 동일**(`r1-vs-r2-other.diff` rc=0)
- 1라운드와 달라진 것은 고친 훅 줄 두 토큰뿐: B · F · F2 · A 의 `LOST=[MINE-CHAIN MINE-EDHOOK]` → `LOST=[]`
- 병합 텍스트: PR-D 변경분을 새 main 위에서 다시 떠도(`5786f56..893f48b`) PR-C 위의 원래 변경분(`8d2e428..a8ceaee`)과 **변경 줄이 한 줄도 다르지 않다**(30파일 +2406/−13).

## Findings

[HIGH — 이 PR 밖, 기존 결함] 기록에 하네스 몫으로 적힌 훅 항목은 설치자가 고쳤어도 uninstall 이 통째로 뺀다 — C 흐름과 현행 설치 모두
File: `src/adapters/json-keys.ts` `alwaysStrip`(훅 항목이면 sha 무관하게 뺀다) → `src/adapters/contract.ts` `planStrip`
Issue:
- C 흐름: 게시판 v26.162.0~v26.169.0 의 update(`legacySettingsSeed` 첫 포함 = v26.162.0)가 고친 옛 줄을 하네스 몫으로 기록한다(화면 `removed the harness part · kept yours: … protect-files.sh`). 그 기록을 이 판의 uninstall 이 `alwaysStrip` 으로 걷는다 — 화면은 `removed the harness part: hooks.PreToolUse#protect-files.sh · hooks.SessionStart#session-start.sh (yours stays)` 인데 설치자의 `team-guard.sh` 호출은 어디에도 없다(백업 없음). 12/12셀.
- 같은 손실이 **현행 판으로 처음 깐 설치본**에서도 난다: `install --cli claude` → `protect-files` 줄 끝에 `&& bash ./scripts/team-guard.sh` → `uninstall --yes` → `✓ .claude/settings.json — removed (the harness created it and only its part was in it)`, 설치자 몫 0. PR 판 · main 판 모두 같다(`current-install-edited-hook.txt`). 화면이 "하네스 몫만 있었다"고 말하는 것도 사실과 다르다.
- 왜 이 PR 의 블로커가 아닌가: main 에서도 같고(1라운드 `matrix-main-A.txt`), 이 PR 은 이 손실을 늘리지 않고 A 를 줄였다. 고치려면 `alwaysStrip` 의 결정(N-f · N13 — 스크립트가 사라지니 남기면 죽은 참조)을 바꿔야 하고, 그건 모든 설치본에 걸리는 다른 결정이다.
- 방향: 이 PR 에서 들인 원칙("하네스 줄로 볼 수 있는 것은 하네스가 쓴 바이트 그대로일 때만")을 기록된 훅 항목에도 적용 — 기록 sha 와 다르면 `kept` + 같은 "may still hold" 안내. 이슈로 분리하고, 릴리즈 노트·PR 본문에서 "update 를 거친 경우도 닫았다"는 **이 판으로 update 한 경우로 한정**해 적는다.

[NOTE-1] 고친 줄이 남은 뒤의 모양은 설치자가 손으로 정리해야 한다(합의된 동작)
`bash ".../protect-files.sh" && bash ./scripts/team-guard.sh` 는 uninstall 뒤 스크립트가 없어 앞부분이 실패하고 `&&` 때문에 설치자 명령도 돌지 않는다. 1라운드에서 권한 대로 "남기고 알린다"이고 화면이 정확히 그 줄을 지목하므로 손실은 아니다 — 참고만.

[NOTE-2] CI 첫 실행 1건 실패는 기존 불안정 테스트
`tests/commit-install-record.test.ts` B3 의 로컬 `git clone` 이 `failed to copy file … .git/objects/…` 로 간헐 실패. 단독 3회: PR 사본 1/3 통과 · main 체크아웃 2/3 통과 — 이 diff 와 무관. 도커 매트릭스가 끝난 뒤 재실행은 exit 0.

1라운드 NOTE 처리: NOTE-2(ⓑ″ 두 번 호출)는 한 번 호출로 줄었다 · NOTE-3(statusLine · `.mcp-allowlist` 제외)는 설계 문서에 한 줄 남았다 · NOTE-4(claude 문 테스트 공백)는 새 테스트가 문다(아래 M6) · NOTE-1(ⓑ′ 자격 판정 위치)은 그대로 — 판정에 영향 없음.

## 검증 실행

- `npm run ci`(파이프 없이) **exit 0** — 157 파일 · 2,349 테스트 · lines 96.74 / branches **89.62** (`ci-r2.txt`). 첫 실행 exit 1 은 NOTE-2(`ci-r2-first-run-flake.txt`)
- 변이(별도 사본 `git archive 78e7ee2`, 적용 diff 확인 · `tsc --noEmit` 0 · 원본 바이트 복원 확인). 사본에는 `.git` 이 없어 태그 · 문서 테스트 3건이 늘 실패하므로 그 3건을 뺀 차이로 읽었다:
  - **MA** `removeRetiredHookRefs` 의 `isLegacyHookLine` 문 삭제 → ⑫ "바로 uninstall" · "--cli claude" **2 red**
  - **MB** `legacySettingsSeed` 의 `legacyLines` 거르기 무력화(`&& Math.random() > 2`, 첫 판은 미사용 인자로 tsc 2 → 무효 처리 후 재실행) → ⑫ "옛 판 → update → uninstall" **1 red**
  - **MC** `isLegacyHookLine` 이 참조만 보게(`return true`) → ⑫ 세 개 **3 red**
  - **M6** ⓑ″ claude 문 제거 → ⑫ "codex 단독 … 읽지도 않는다 (B2)" **1 red**(1라운드 0 red 였던 공백이 닫혔다)
- 26.70 이전 판(바이트를 모르는 범위 — 참조로 보거나 이제 몫으로 안 적는다)은 npm 에 없다: 게시판 최저 = 26.83.0. 바뀐 방향도 "남기고 알린다" 쪽이라 손실 쪽으로 틀릴 수 없다.
- 옛 템플릿 114개 어디에도 같은 이벤트에 같은 스크립트가 두 번 나오지 않는다(대조: 26.125 키 4개 출력 확인) — `legacyLines` 가 키 단위로 모아도 고친 줄 · 그대로인 줄이 한 키에 섞이는 옛 판은 없다.

## Positive Observations
- 판정 하나(`isLegacyHookLine`)를 update 의 몫 찾기와 걷기가 함께 써서, 1라운드의 B 손실과 main 의 A 손실이 같은 수정으로 닫혔다 — 경우별 장치가 아니라 "바이트가 다르면 손대지 않는다"를 훅 줄로 넓힌 모양.
- ⓑ″ 가 두 번 호출 → 한 번 호출로 줄었고 화면 · dry-run 이 같은 집합을 말한다.
- 생성기가 참조 대신 command 원문을 내 데이터 출처가 하나로 남았다(`LEGACY_HOOK_REFS` 는 그 원문에서 유도).

## Verdict
- [x] CRITICAL 이슈 없음 — 1라운드 블로커 해소(B · F · F2 · A 48셀 중 36셀 고친 줄 바이트 그대로)
- [ ] 리드 합격선 "every flow" — **C 12셀 미충족**, 원인은 이 PR 밖(HIGH-1, 별도 이슈 권고)
- [x] main 병합 회귀 없음(48셀 수치 · 백업 집합 · B2 · 밖 링크 · dry-run 전부 1라운드와 동일)
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/PRD 범위 내

도커: `uzys-r781b-{pr,main,x}` 이미지와 `uzys-r781b-run-*` 컨테이너 6개 삭제 확인(남은 것 0).

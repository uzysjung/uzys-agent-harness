# PR-C 3차 리뷰 — fix/update-no-folder-copy @ 41d7e7c (2차 B-1 수정분만)

## 결론: PASS

2차 B-1 의 완료 기준을 전부 충족한다. 1차 BLOCKER-1 의 회귀 테스트도 그대로 green 이다.

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| BLOCKER(HIGH) | 0 |
| NOTE | 5 |

증거 폴더 = `rev-C/r3/`. 프로브 원문은 `probe5.test.ts.txt`, 결과는 `probe3-41d7e7c.json` · `probe5-41d7e7c.json` 이다.
변이 결과는 `tsc-M*.log` · `vt-M*.json`, CI 로그는 `ci.log` 에 있다.

---

## 1. 2차 완료 기준 — 충족

**S6 재현.** 2차 `probe3`(옛 로그 → 배선과 폴더 → update ① → 폴더 삭제 → update ②)를 41d7e7c 에서 그대로 돌렸다.

| | b4ea578 (2차) | 41d7e7c |
|---|---|---|
| update ② 뒤 배선 | 남음 | **걷힘** |
| update ② 화면 | `1 left (yours — …)` | `✓ settings.json retired hook refs  1 removed (harness wiring from an earlier release; script gone: skills/strategic-compact/suggest-compact.sh)` |
| staleHookRefs | 대상 1건 | `[]` |

**두 기록 모양.** `probe5` 를 `legacy`(기록에서 `records`·`portions` 제거)와 `writer`(설치 직후 `records:"writer"`, 그대로 둠)로 각각 돌렸다.
흐름은 `runInstall` add → 배선 주입 → update ① → 폴더 삭제 → update ② → update ③ 이다. 두 모양의 결과가 같다.
- update ①(스크립트 있음): 배선을 둔다. `retired: []` 이다.
- update ②: protect-files 묶음은 `[protect-files.sh]` 만 남고 suggest-compact 는 걷힌다. 화면은 `removed` 한 줄이고, 그 참조는 "yours" 줄에 나오지 않는다.
- hooks 밖 키는 직렬화가 같다(`otherKeysEqual: true`).
- update ③: 파일이 update ② 뒤와 바이트 동일하다. `retired: []` · 추가 화면 없음 → 멱등이다.

구현자가 추가한 회귀 테스트(it.each legacy·writer)도 같은 흐름을 단언한다. 같은 묶음의 설치자 핸들러는 직렬화 동일, observe 묶음은 걷힌다.

## 2. 닫힌 목록의 완전성 — 빠진 것 없음

대조 방법은 셋이다.
- `git log --all -p -- templates/settings.json` 커밋 16개의 command 전부
- `git log --all -p -- src templates '*.sh'`(tests·docs 제외)에서 `.claude/…/*.sh` 를 참조하는 추가 줄 전부
- 같은 범위에서 `skills/|plugins/|scripts/` 를 부르는 command 줄 전부

결과:
- `.claude/hooks/` 밖의 이 프로젝트 앵커 배선은 `skills/continuous-learning-v2/hooks/observe.sh` 와 `skills/strategic-compact/suggest-compact.sh` 두 개뿐이다. 목록과 일치한다.
  - observe.sh 는 최초판 `setup-harness.sh`(e6e4899)가 `${PROJECT_ABS}/.claude/…` 절대경로로 박기도 했다.
  - 상대경로가 같아서 `projectAnchoredRef` 의 `claudeDir` 앵커로 같은 항목에 걸린다. **이 부분은 코드 읽기로 판단했고 실행하지 않았다.**
- `~/.claude/skills/strategic-compact/suggest-compact.{js,sh}`(6028770 · cdcff49)는 배선이 아니다. SKILL.md 안내문과 setup 스크립트의 주석(`#`)이라 대상이 아니다.
- `hooks/` 아래 이력 스크립트 11종 중 현행 둘(protect-files · session-start)을 뺀 9종은 모두 `RETIRED_PATHS` 에 있다. agentshield-gate · checkpoint-snapshot · gate-check · hito-counter · karpathy-gate · mcp-pre-exec · spec-drift-check · task-brief-nudge · uncommitted-check 이다.
  - 그래서 `legacySettingsSeed` 쪽에도 빈 곳이 없다.

## 3. 판정이 기대는 것 — `.claude/` 기준 상대경로(디렉터리 + 파일명). 명령 전체도, 파일명만도 아니다

`probe5` 에서 설치자 배선 7종을 넣었다. 7종 모두 스크립트가 없는 상태다.

| 설치자 배선 | 결과 |
|---|---|
| `…/.claude/hooks/suggest-compact.sh`(같은 이름, 다른 폴더) | 남음 · "yours" 로 알림 |
| `…/.claude/skills/my-compact/suggest-compact.sh` | 남음 · 알림 |
| `bash .claude/skills/strategic-compact/suggest-compact.sh`(앵커 없음) | 남음 |
| `~/.claude/skills/strategic-compact/…`(홈) | 남음 |
| 같은 경로에 인자를 덧붙임(`… --team`) | 걷힘(NOTE-3) |
| `suggest-compact.sh"; bash …/hooks/team-guard.sh` | **핸들러째 걷힘**(NOTE-1) |
| `team-guard2.sh"; bash …/suggest-compact.sh` | 남음 |

결론: 이름이 같은 설치자 스크립트를 걷어 버리지 않는다. 걷히는 것은 하네스 은퇴 스킬 폴더의 정확한 경로가 첫 앵커일 때뿐이고, 그 경우에도 스크립트가 없을 때만 걷는다.
- `.gitignore` 몫은 `.claude/skills/` 를 무시하지 않는다(`src/env-files.ts`).
- 그래서 팀이 커밋한 설치본의 새 클론에도 그 스크립트가 함께 온다. 1차 BLOCKER-1 의 "생성물이라 클론에 없다" 경로는 이 목록에서는 생기지 않는다.

## 4. 1차 BLOCKER-1 회귀 — 그대로

- `update-restores-shared` "기록에 없는 스크립트를 부르는 설치자 훅은 바이트 그대로…"는 HEAD 와 변이 M1 · M2 에서 모두 green 이다.
- 목록 제한을 푸는 변이 M3 에서는 **red** 다(`expected '[]' to be '[{"matcher":"Bash",…'`).
  - 즉 이 테스트는 목록이 "기록 밖 죽은 참조 전부"로 넓어지는 것도 막는다.
- `probe5` 에서도 목록 밖 설치자 참조는 바이트가 그대로이고 `left (yours …)` 로만 나온다.

## 5. 변이 · typecheck · CI

변이는 셋 다 typecheck 를 통과했고, 적용은 `git diff -U0` 출력으로 확인했다. 매번 `git checkout -- src` 로 복원했다.

| 변이 | 내용 | tsc | 결과 |
|---|---|---|---|
| M1 | update-mode 의 `removeRetiredHookRefs` 호출을 `[]` 로 바꿈 | exit 0 | 은퇴 배선 테스트 2건 red(`expected [] to deeply equal [ Array(1) ]`) · BLOCKER-1 테스트 green |
| M2 | `existsSync` 검사를 지움(스크립트가 있어도 걷음) | exit 0 | 2건 red(`… to contain 'suggest-compact.sh'`, update ① 단언) · BLOCKER-1 테스트 green |
| M3 | `!refs.includes(rel)` 를 `(void refs, false)` 로 바꿈(목록 제한 해제) | exit 0 | BLOCKER-1 테스트 red · 은퇴 배선 2건 green |

- 첫 M3 시도는 `refs` 미사용 오류(TS6133)로 tsc exit 2 가 났다. 빌드 파손이라 증거로 쓰지 않고 M3b 로 다시 돌렸다(`tsc-M3.log`).
- `npm run ci`(파이프 없이, 41d7e7c, 깨끗한 트리): **exit 0** — 146 files / 2232 tests · branches 88.98% · build 성공.

---

## NOTE (비차단)

- **NOTE-1 복합 명령의 첫 참조만 본다.** `bash …/suggest-compact.sh"; bash …/hooks/team-guard.sh` 처럼 설치자가 하네스 줄 뒤에 자기 스크립트를 이어 붙였다면, 은퇴 스크립트가 없을 때 핸들러째 걷히고 설치자 호출도 함께 사라진다.
  - 반대 순서는 남는다. 이때 죽은 suggest-compact 는 알림에도 안 나온다.
  - 원인은 `projectAnchoredRef` 가 첫 앵커만 반환하는 기존 판정이다. 옛 정리기(main)도 같은 입력을 핸들러째 지웠다.
  - 이 상태를 만드는 경로가 관측된 적이 없어 차단하지 않는다.
- **NOTE-2 서식.** 걷을 때 파일 전체를 `JSON.stringify(…, 2)` 로 다시 쓴다. 설치자가 다른 들여쓰기를 썼다면 그 한 번 바뀐다. 키 순서와 값은 보존된다(`otherKeysEqual: true`). 옛 정리기와 같은 서식이다(인계 ⓐ).
- **NOTE-3 인자를 덧붙인 같은 경로**(`suggest-compact.sh --team`)도 걷힌다. 경로가 하네스 은퇴 스킬 폴더이고 스크립트가 없어 죽은 배선이므로 기준에 맞는다고 본다.
- **NOTE-4 스크립트가 있는 observe.sh 배선**은 계속 남아 돈다. ECC 플러그인과 함께 쓰면 c8fdef1 이 없앤 중복 실행이 그대로다. b4ea578 이전에도 같았다(살아 있는 참조는 걷지 않았다). 범위 밖이다.
- **NOTE-5 문서.** 2차 NOTE-1(ADR-099:28 의 `cleanStaleHookRefs` 문장)은 아직 사실과 다르다. 리드 처리 몫으로 남아 있다.
  - 설계 §2.2 의 예외 구절은 현행 동작과 맞는다.
  - Codex · OpenCode 쪽 훅 배선 이력은 이번 질문 범위 밖이라 대조하지 않았다.

Non-Goals · DO NOT CHANGE 침범 없음.

## 정리
- 작업 사본 `wt3`: 프로브 2개를 `tests/` 에서 지웠다. `node_modules` 심링크와 `dist/` · `coverage/` 도 지웠다.
- `git status --short --ignored` 는 비어 있다(HEAD 41d7e7c detached).

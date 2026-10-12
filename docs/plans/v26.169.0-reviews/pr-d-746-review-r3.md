# rev-D4 — PR-D 3차 재리뷰 (fix/uninstall-no-folder-move @ 42b3d36 · 2차 판정 = pr-d-746-review-r2.md)

- 방법: 사본(detached 42b3d36)으로 `uzys-harness-test:rev-d4` 이미지를 만들었다(`npm pack` 경로). 그 안에서 npm 게시판 v26.125 · 126 · 132 · 150 · 153 · 161 을 실제로 설치하고, 설치자 파일과 편집을 더한 뒤 새 빌드로 install · update · uninstall 을 돌렸다.
- 스크립트와 결과: `a2df5ee2…/scratchpad/r4/` 의 `a1` · `a2` · `a3` · `a3b` · `attack`(2차 A · C) · `attack2`(2차 E), 그리고 `mut*.py` · `ci.log`.
- 정리: 이미지를 지웠다. node_modules 심링크와 dist · coverage 도 지웠다. 사본은 `git status --ignored` 기준 깨끗하고 HEAD 는 42b3d36 이다. 변이는 매번 원복했고, 원복한 뒤 git status 로 확인했다.

## 결론: PASS

재현된 설치자 손실은 없다. 2차 완료 기준 BLOCKER-1 ①②③ 과 BLOCKER-2 는 모두 충족됐다. 차단하지 않는 NOTE 가 3건 있다.

---

## 1. 2차 BLOCKER-1 · BLOCKER-2 — 해소

`a1.sh`: v26.125 · 132 · 150 · 161 × (새 install | 새 update) → update 2회 → uninstall, 모두 8흐름이다. 흐름마다 다음 설치자 상태를 만들었다.
- 그 판이 깐 은퇴 파일 하나를 고친다.
- 은퇴 이름으로 자기 파일 3개를 둔다(그 판이 깔지 않은 이름).
- 자기 룰 하나를 둔다.

| 기준 | 결과 |
|---|---|
| ① "of yours" 표기 | 8흐름 모두 **0회**. 남은 파일은 "not on the install record — yours, or left by an older harness version; delete by hand any that are not yours" 로 안내한다 |
| ② 은퇴 룰 · 훅 · 에이전트 라이브 잔존 | 8흐름 모두 **하네스 내용 0개**(전: 125 15개 · 132 15개 · 150 9개) |
| ③ 회귀 테스트 | `uninstall-legacy-scan.test.ts` 에 +4건이 있다(install add 경로 · update 경로 · install→update 백업 · settings 배선). 변이 결과는 §6 |
| BLOCKER-2 llms.txt | `check-absence.sh --canary` 결과는 다음과 같다. 사용자 문서 9개(README · README.ko · index.html · llms.txt · docs/USAGE · REFERENCE · COMPATIBILITY · TRACKS · WORKFLOWS)는 **0건, exit 0** 이다. 대조군인 9511452 판 llms.txt 는 exit 1 이다. 새 문장은 README.md:194 와 같은 뜻이다 |

- 설치자 편집과 파일은 8흐름 모두 라이브나 그 파일 하나의 백업에 있다. 폴더 백업(`.claude.backup-*`)은 0개다.
- 은퇴 하네스 배선(`suggest-compact.sh`)은 125 · 132 · 150 흐름에서 걷혔다. 화면에는 `✓ .claude/settings.json — removed retired harness hook wiring: …` 가 나온다.
- v26.161 흐름의 "EDIT … LOST" 는 탐지 오표기다. 그 판은 은퇴 파일을 깔지 않아 고칠 대상이 없었고, 그래서 마커가 처음부터 만들어지지 않았다.

## 2. update 의 은퇴 자리 백업 — 반복해서 쌓이지 않는다

`a2.sh` R: 6흐름(125 · 132 · 150 × install · update) 뒤에 update 를 3회 더 돌렸다. 매 회 백업 수를 세고, **원본 경로 하나에 백업이 2개 이상 생겼는지** 집계했다.

| 흐름 | 첫 단계 | update 1 | update 2 | update 3 | 같은 경로 중복 |
|---|---|---|---|---|---|
| 125 → install | 16 | 30 | 30 | 30 | 0 |
| 125 → update | 18 | 30 | 30 | 30 | 0 |
| 132 → install | 0 | 14 | 14 | 14 | 0 |
| 132 → update | 14 | 14 | 14 | 14 | 0 |
| 150 → install | 3 | 11 | 11 | 11 | 0 |
| 150 → update | 11 | 11 | 11 | 11 | 0 |

- 은퇴 자리 백업은 그 파일을 지우는 update 한 번에만 생긴다. 파일이 디스크에서 사라지면 `retiredClaims` 도 다시 적지 않는다(디스크에 있는 것만 적는다).
- 125 → update 에서는 첫 update 가 은퇴 파일을 기록에 이어 적기만 하고, 회수는 다음 update 가 한다. 그 사이 한 회차 동안은 라이브에 남는다. uninstall 은 이 상태에서도 회수한다(§1).
- **정상 writer 설치본**(`a2.sh` W, 새 판으로만 설치): update 2회에서 백업 0 → 0 → 0, uninstall 에서도 0 이다. 이 경로의 update 동작은 바뀌지 않았다.
- 바뀐 곳은 기록에 은퇴 자리가 있는 옛 계보의 설치본뿐이다. 거기서는 sha 가 같아도 한 번 백업한다. 리드가 감수한 범위다.

## 3. uninstall 의 `RETIRED_HOOK_WIRING_REFS` — 경로 전체로 판정한다

`a3.sh`: v26.150(claude+codex) → 새 install 한 뒤 설치자 훅 10개를 넣고 uninstall 했다.

| 설치자 훅 | full | `--cli claude` | `--cli codex` |
|---|---|---|---|
| U1 다른 스킬 폴더의 같은 파일명 · U2 `.sh.bak` · U3 파일명만 · U4 `$HOME/.claude/…` · U5 다른 프로젝트 절대경로 · U6 앵커 앞에 문자가 붙은 형태 · U8 `strategic-compact-v2/…` · U7 자기 스크립트가 앞에 오는 복합 명령 · U9 하네스 묶음 안 자기 핸들러 | 9개 모두 유지 | 9개 모두 유지 | 9개 모두 유지 |
| 하네스 배선 그대로(`$CLAUDE_PROJECT_DIR/…`) | 걷힘 | 걷힘 | **유지**(claude 를 걷지 않는 범위라 settings 를 건드리지 않는다) |
| ABS(이 프로젝트 `.claude/` 절대경로로 쓴 같은 스크립트) | 걷힘 | 걷힘 | 유지 |

- 판정은 `projectAnchoredRef`(토큰 경계 · 앵커 시작 고정)가 내고, 그 결과가 닫힌 목록과 **경로 전체로 일치**해야 걷는다. PR-C r3 와 같은 기준이다.
- ABS 가 걷히는 것은 옛 절대경로 앵커를 같은 프로젝트로 보는 기존 설계(ADR-057)대로다.

## 4. 은퇴 목록 회수가 설치자 파일을 백업 없이 지우나 — 재현 0

| 공격 | 결과 |
|---|---|
| 새 판(writer)만 깐 설치본에 은퇴 이름 자기 파일 4개를 둔다(`rules/database.md` · `agents/code-reviewer.md` · `hooks/gate-check.sh` · `commands/uzys/plan.md`) → update 2회 → uninstall | 기록에 적히지 않음(0). 4개 모두 내용 그대로 **라이브 유지**. 백업 0 |
| 필드 있는 옛 기록(132 · 150 · 161) + 은퇴 이름 자기 파일 3개 → 새 install/update → update×2 → uninstall | 3개 모두 **라이브 유지**(`recorded()` = none 이라 이어 적지 않음) |
| 필드 없는 기록(125) + 은퇴 이름 자기 파일 3개 → 새 install/update → update | 기록에 이어 적힌다. 다음 update 에서 그 파일 하나를 **백업한 뒤** 라이브에서 뺀다. 내용은 `*.backup-<t>` 에 있다(손실 아님. 2차 NOTE-C 와 같은 설계 §2.3 #3 동작이 install 경로로 넓어졌다) |
| 고친 은퇴 파일(125 · 132 · 150) | 모든 흐름에서 그 파일 하나의 백업에 편집 내용이 남는다 |
| 코드 경로 대조 | 이어 적은 sha 가 백업 없는 삭제로 이어질 수 있는 곳은 세 곳이다. ⓐ `pruneOrphans` 는 `recordOf` 가 `no-sha` 이면 백업한다. ⓑ `owned-write` 의 `isHarnessOwned` 는 템플릿에 있는 경로만 쓰는데, `RETIRED_PATHS` 45개는 지금 템플릿에 없다. ⓒ uninstall 은 `recorded()` 를 쓰고, 은퇴 자리는 sha 와 무관하게 `no-sha`(백업 후 회수)로 읽는다. 세 곳 모두 막혀 있다 |

## 5. 1·2차 통과 공격 회귀 표본 — 전부 유지

- **노트 v26.126 · 150 · 153** × 전량 · `--cli claude` · update(2차 A, 9건): 전량과 `--cli` 에서는 노트가 라이브로 남는다. update 에서는 `my-team-notes.md.backup-<t>` 로 간다. 소실 0. 153 에는 새 문구가 나온다.
- **필드 없는 · 있는 옛 설치본**(2차 C, 125 · 132): 결과가 2차와 같다.
  - 설치 전부터 있던 동명 파일 PRE-* 는 **옛 판 install 이 이미 덮었다**. 2차에서 확인한 것과 같고, 새 빌드가 낸 손실이 아니다.
  - POST-* 13종은 라이브나 그 파일 하나의 백업에 있다.
- **E1**(claude+codex+opencode): displaced `agents/reviewer.md` 는 원본으로 되돌아왔다("put back"). 설치자 몫 12종(settings 키 · .mcp.json 서버 · AGENTS.md · .gitignore · 깊은 파일 · `.codex/mine.toml` · codex 서버 표 · `.opencode/command/mine.md` · `commands/team` · settings.local.json · 번들 스킬 안 노트)은 **모두 라이브**다. 폴더 백업 0 · 하네스 룰 0 · `.agents` 0.
- **E2** `--cli claude`: `.codex` 와 `.agents` 44개 항목이 전후 sha 동일하다.
- **E3** 프로젝트 밖 링크(`.claude/agents` → 밖 폴더): 밖 폴더가 전후 동일하고 링크도 남았다.

## 6. 테스트 · 변이 · CI

- 기준선: `uninstall-legacy-scan.test.ts` 8/8 green.
- 변이 7종을 사본에서 독립적으로 돌렸다. 모두 `git diff --stat` 로 적용을 확인했고, 원복한 뒤 status 로 다시 확인했다.

| 변이 | tsc | 결과 |
|---|---|---|
| Mb `pruneOrphans` 를 기준선 sha 만으로 판정 | 0 | red 1 (install→update 백업) |
| Mc uninstall `evenIfScriptExists: false` | 0 | red 1 (NOTE-B) |
| Md install 이 `inheritScanned` 에 projectDir 를 주지 않음 | 0 | red 2 |
| Me2 update 의 `retiredClaims` 를 비움(`.slice(0,0)`) | 0 | red 1 |
| Ma2 `retiredClaims` 의 `recorded()==none` 가드 무력화 | 0 | **전체 스위트 2285 green** → NOTE-1 |
| (Ma · Me 첫 시도) | 2 | 미사용 심볼로 빌드가 깨졌다. 증거로 쓰지 않고 Ma2 · Me2 로 다시 돌렸다 |

- `npm run ci`(파이프 없이 실행, 출력은 `r4/ci.log` 로 리다이렉트): **exit 0** — 151 files · 2285 tests · statements 95.52 · branches 89.49 · lines 96.74.

---

## NOTE (차단 아님)

- **NOTE-1 테스트 공백: `retiredClaims` 의 소유 가드를 무는 테스트가 없다.**
  - 이 가드는 writer 기록이나 필드 있는 기록에서 설치자의 은퇴 이름 파일을 이어 적지 않게 막는다. 동작은 맞다(§4 W · 132 · 150 · 161 실측).
  - 가드를 무력화해도(Ma2) 전체 스위트가 green 이다.
  - 회귀하더라도 결과는 손실이 아니다. 그 파일 하나를 백업한 뒤 라이브에서 빼는 정도다(`recorded()` 가 은퇴 자리를 항상 `no-sha` 로 읽기 때문). 그래서 MEDIUM 이다.
- **NOTE-2 uninstall 은 스크립트가 있어도 은퇴 배선을 걷는다.**
  1. 설치자가 은퇴 스킬을 남겨 쓰면서 하네스 배선을 그대로 둔 경우(update 는 남겨 둔다), uninstall 뒤에는 그 훅이 settings.json 에서 사라진다.
     - 이 줄은 하네스가 깐 것과 바이트까지 같아 구분할 수 없다.
     - 화면이 `removed retired harness hook wiring` 이라고 알린다. 스킬 폴더 자체는 남는다.
  2. 복합 명령에서 **은퇴 스크립트가 앞에 오는** 경우(`…/suggest-compact.sh && …/hooks/mine.sh`, `a3b.sh`)에는 핸들러째 걷힌다. PR-C r3 NOTE-1 과 같은 원인으로, `projectAnchoredRef` 가 첫 참조만 본다.
     - uninstall 에서는 "스크립트 없음" 조건이 빠져 이 경우가 더 넓게 걸린다.
     - 이 상태를 만드는 경로가 관측된 적은 없다.
- **NOTE-3 필드 없는 기록(v26.125)에서 은퇴 이름 설치자 파일**은 새 install 이나 update 뒤 다음 update 에서 백업과 함께 라이브에서 빠진다. 2차에서는 직행 uninstall 에서만 그랬다.
  - 손실은 아니다. 설계 §2.3 #3 ⓐⓒ 의 연장이다.
  - 화면이 이를 "no checksum on record — saved a copy" 처럼 알리는지 update 화면은 따로 대조하지 않았다.

## 시도한 공격 목록

| # | 공격 | 결과 |
|---|---|---|
| a1 ×8 | 125 · 132 · 150 · 161 × 새 install/update → update×2 → uninstall (고친 은퇴 파일 · 은퇴 이름 자기 파일 3 · 자기 룰) | 은퇴 하네스 잔존 0 · "of yours" 0 · 손실 0 · 폴더 백업 0 |
| a2 W | writer 설치본 + 은퇴 이름 자기 파일 4 → update×2 → uninstall | 기록 0 · 라이브 유지 · 백업 0 |
| a2 R ×6 | 옛 판 → 새 install/update → update×3, 같은 경로 백업 중복 | 중복 0, 백업 수가 고정된다 |
| a3 ×3 | 설치자 훅 10종 × full · `--cli claude` · `--cli codex` | 경로 전체 일치만 걷힘 · `--cli codex` 는 settings 를 건드리지 않음 |
| a3b | 은퇴 스크립트가 앞에 오는 복합 명령 | 핸들러째 걷힘 → NOTE-2 |
| A ×9 | 노트 126 · 150 · 153 × 전량 · `--cli` · update | 보존 9/9 |
| C ×2 | 필드 없는 · 있는 옛 설치본 15종 마커 | 2차와 같음, 새 손실 0 |
| E1–3 | 설치자 몫 12종 · displaced · `--cli claude` 바이트 동일 · 밖 링크 | 전부 유지 |
| 문서 | 폴더 이동 서술(canary 대조) | 사용자 문서 0건 |
| 변이 | Mb · Mc · Md · Me2 red / Ma2 green | NOTE-1 |
| CI | `npm run ci` | exit 0 |

Non-Goals · DO NOT CHANGE 침범 없음(변경은 uninstall · update · install 기록 · 문서 1줄 · 테스트에 한정).

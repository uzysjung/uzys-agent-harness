# PR-C 재리뷰 — fix/update-no-folder-copy @ b4ea578 (1차 5fcd28c 뒤 BLOCKER-1 수정)

## 결론: BLOCKER 있음 (1건 — 이번 수정이 새로 만든 회귀)

BLOCKER-1(설치자 훅 항목 소실)은 **해소됐다**. 다만 옛 정리기를 통째로 빼면서, 하네스가 옛 템플릿으로 깔았던
은퇴 스킬 훅 배선을 이제 아무도 치우지 않는다. 화면은 그것을 설치자 것("yours")이라고 말한다. 판정 질문 2의 답이
"있다"이고, 설치자가 실제로 그 상태에 들어가는 흐름을 재현했다(B-1).

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| BLOCKER(HIGH) | 1 |
| NOTE | 4 |

---

## B-1 — 옛 판이 깐 은퇴 스킬 훅 배선이 영구히 남고, 화면은 그것을 "yours"라고 말한다

**File**: `src/update-mode.ts:677-690`(3단계 — 이제 탐지만) · `src/install-writes.ts:645-651,674-685`(`hookScript` ·
`legacySettingsSeed` — 옛 로그의 몫 찾기가 `hooks/` 아래 스크립트만 본다)

**누가 이 상태를 만드나**: 하네스 자신이다. `templates/settings.json` 은 2026-04-14 부터 2026-09-13(a125453 은퇴)까지
모든 Claude Code 설치에 `bash "$CLAUDE_PROJECT_DIR/.claude/skills/strategic-compact/suggest-compact.sh"`(PreToolUse
`Write|Edit`, `async`)를 배선했다. 템플릿 이력에서 `.claude/hooks/` 밖 스크립트를 부른 것은 이것과
`skills/continuous-learning-v2/hooks/observe.sh`(2026-05-03 제거) 두 개다.
- 그 기간의 update 는 settings.json 을 다시 쓰지 않았다(a125453 의 update 는 3단계 정리만 했다). update 는 은퇴 스킬
  폴더도 지우지 않는다. 그래서 그 뒤로 update 만 돌린 설치본에는 배선과 스크립트가 함께 남아 있다.
- writer 의 옛 로그 몫 찾기(`legacySettingsSeed`)는 `hooks/` 아래 스크립트(현행 렌더와 `RETIRED_PATHS` 의 훅 10종)만
  하네스 몫으로 알아본다. `skills/…` 핸들러는 설치자 몫이 되고 기록 밖에 남는다.
- update 화면은 은퇴 스킬에 대해 이렇게 말한다: `strategic-compact · 이 릴리즈에서 은퇴 — … strategic-compact 는 지워도 된다`.

**무엇이 달라졌나(설치자 자리)**: 화면 안내대로 폴더를 지운 뒤 update 를 돌린 경우다.
- 5fcd28c 와 main 에서는 3단계가 죽은 참조를 걷었다. 결과: 배선이 사라지고 화면은 `1 removed (skills/strategic-compact/suggest-compact.sh)` 이다.
- b4ea578 에서는 배선이 그대로 남는다. 화면은 `1 left (yours — not in the install record; script missing: skills/strategic-compact/suggest-compact.sh)` 이다.
  - 하네스가 쓴 배선을 설치자 것이라고 말한다. 거짓 화면이다.
  - 이것을 걷는 경로가 이제 어디에도 없다. 누수이고 영구적이다(update 를 몇 번 돌려도 같다).
  - Write/Edit 마다 없는 스크립트를 부르는 훅이 돈다(`bash` exit 127). Claude Code 가 이를 오류로 보여 주는지는
    **실 CLI 미검증**이다(호스트 실행 차단 · Docker 미실행). 동작이 막히지는 않는다(비차단 종료 코드 · async).
  - 데이터 손실은 없다. 설치자가 직접 settings.json 에서 그 줄을 지우면 복구된다. 다만 "yours"라는 말을 믿으면 팀 훅으로 오인해 지우기를 망설이게 된다.

**증거(직접 재현, 같은 프로브를 두 판에서)** — `r2/probe3.test.ts.txt` · 결과 `r2/probe3-{b4ea578,5fcd28c}.json`.
절차: add 설치 → 기록을 옛 모양으로(`records`·`portions` 제거) → 옛 템플릿 모양 핸들러를 protect-files 묶음에 추가하고
스킬 폴더·스크립트를 둔다 → update ① → 화면의 "지워도 된다"대로 폴더 삭제 → update ②.

| | 5fcd28c | b4ea578 |
|---|---|---|
| update ① 화면 | `strategic-compact … 지워도 된다` | 같음 |
| update ① 뒤 배선 | 남음(스크립트 있음) | 남음 |
| update ② 뒤 배선 | **걷힘** | **남음** |
| update ② 화면 | `1 removed (skills/strategic-compact/suggest-compact.sh)` | `1 left (yours — not in the install record; …)` |

대조: `hooks/` 아래의 은퇴 하네스 훅(`task-brief-nudge.sh`, 같은 옛 로그 모양)은 두 판 모두 writer 가 걷는다
(`probe2` S2: 배선 없음 · `removed the harness part`). 구현자가 인계 ⓑ에 적은 "은퇴 훅 배선이 yours 로 남는다"는
`hooks/` 아래 훅에서는 **일어나지 않는다**(`legacySettingsSeed` 가 `RETIRED_PATHS` 를 후보에 넣는다). 실제 구멍은
`.claude/hooks/` 밖의 하네스 배선이다.

**재현**: `r2/probe3.test.ts.txt` 를 `tests/` 에 두고 `PROBE_OUT=<경로> npx vitest run tests/<그 파일>`.

**완료 기준** (구현 방식은 리드·구현자 몫):
- 위 S6 흐름(옛 로그 + suggest-compact 배선 → 폴더 삭제 → update)에서 update 가 그 핸들러를 걷는다. 같은 묶음의
  하네스 핸들러(protect-files)와 설치자 핸들러는 남는다. 화면은 "하네스 몫을 걷었다"로 말하고 "yours"라고 하지 않는다.
- 기록이 이미 writer 모양(`records:"writer"`)으로 옮겨진 설치본에서도 같다. 옛 로그 몫 찾기는 첫 번째 writer
  실행에서만 돌기 때문에, 그것만 고치면 이미 옮겨진 설치본은 덮이지 않는다.
- BLOCKER-1 의 회귀 테스트(기록 밖 설치자 훅 → 바이트 그대로 · `left` 한 줄)는 그대로 green 이어야 한다.
  하네스 몫으로 인정하는 범위는 **템플릿 이력에 실재한 닫힌 목록**으로 한정한다. 목록 밖은 지금처럼 알리기만 한다.
- 회귀 테스트 1건과 음성 대조를 둔다. 음성 대조는 그 분기를 되돌리면 red 가 되는지 보고, 되돌린 코드가 typecheck 를 통과하는지도 확인한다.
- 받아들이기로 하면(리드 결정) 그 사유를 PR 본문에 남긴다. 그러면 이 항목은 NOTE 로 내려간다. 이 경우 설치자에게
  남는 결과는 다음과 같다: 해당 배선이 영구히 남고, 화면이 그것을 "yours"라고 표기한다.

---

## 판정 질문별

### 1. BLOCKER-1 해소 — **해소**
- 1차와 같은 입력을 b4ea578 의 실제 update(`runInstall` add→update, cli claude+codex+antigravity)로 다시 돌렸다
  (`r2/probe2` S1). 같은 실행에서 statusLine 을 지워 writer 가 파일을 실제로 다시 쓰게 했고 `model` 도 고쳤다.
  - 설치자 항목: 1개 남음 · `JSON.stringify` 동일 · 파일 텍스트에 원래 들여쓰기 그대로 존재.
  - statusLine 은 되돌아왔고 `model` 은 유지됐다.
  - 화면: `⊘ settings.json stale hook refs  1 left (yours — not in the install record; script missing: hooks/team-generated-guard.sh)`.
    설치자 훅에 대해서는 사실이다.
  - 5fcd28c 는 같은 입력에서 항목 0개 · `1 removed` 였다(대조).

### 2. 옛 정리기와 #632 몫 걷기 제거로 덜 정리되는 경우 — **있다 → B-1**
- 구현자가 짚은 경우(`hooks/` 아래 은퇴 하네스 훅)는 재현해 보니 **그렇지 않다**. writer 가 걷는다(위 대조).
- 실제 구멍은 `.claude/hooks/` 밖의 하네스 배선이다(B-1).
- `dropHealedHookPortions` 제거로 몫 기록이 새는 경우는 **찾지 못했다**. 이제 3단계가 지우는 참조가 없으니 걷을
  몫도 없다. 그 단계가 막던 위험("기록에 있는데 없는 키 → 다음 install 이 excluded 로 읽음")은 ADR-099 가 자동
  빼기 추론을 없애면서 사라졌다. 빼기 설치본(S8 `--without baseline:hooks/protect-files`)은 update 뒤에도 배선 0 ·
  알림 0 이고, 5fcd28c 와 같다.

### 3. 기록된 하네스 훅 지우기·되살리기 — **그대로**
같은 프로브를 두 판에 돌려 결과가 같다(`r2/probe4-*.json` · `r2/probe2-*.json` S4):
- 스크립트 전부 삭제 → update 가 되살린다. settings.json 은 바이트 동일이고 알림은 0 이다.
- SessionStart 하네스 핸들러를 손으로 지움 → writer 가 되돌린다(`restored: settings:hooks.SessionStart#session-start.sh`).
- 하네스 배선을 손으로 고침(`--mine`) + 스크립트 삭제 → 스크립트가 돌아오고, 고친 배선은 설치자 것으로 유지된다.
- `--without` 으로 뺀 훅 → 계속 빠져 있다.

### 4. "바뀌지 않았다"를 항목 단위로 — **충족**
- S1: 같은 실행에서 writer 가 다른 키(statusLine)를 되돌려 파일 바이트는 바뀐다. 그래도 설치자 항목은 직렬화 동일이다.
- S7: 설치자 핸들러가 SessionStart 에 있고, 같은 실행에서 writer 가 그 이벤트에 하네스 묶음을 되돌린다.
  - b4ea578: 설치자 핸들러 1개 유지(직렬화 동일).
  - 5fcd28c: 0개(지워짐).
- 회귀 테스트도 파일 바이트가 아니라 해당 이벤트 배열의 직렬화로 단언한다. 같은 파일의 다른 키 변화와 섞이지 않는다.

### 5. ADR-099 문장과의 어긋남 — **새 ADR 불요, 문서 동기화는 필요(NOTE-1)**
ADR-099 Consequences 의 "`cleanStaleHookRefs` 는 기록에 없는 스크립트 참조에만 남는다"는 결정이 아니라 남은 동작을
적은 문장이다. 이번 변경은 새 결정이라기보다 **이미 Accepted 인 ADR-097 결정 4**("함께 쓰는 파일은 하네스 몫만
… 뺀다")와 install #603 의 선례를 update 에 맞춘 것이다. 그래서 새 ADR 은 필요 없다고 본다. 다만 그 문장은 이제
사실이 아니고 다음 유지보수자를 오도한다(NOTE-1). B-1 을 닫힌 목록으로 고치면 그것도 같은 결정 4 의 적용이라
ADR 대상이 아니다.

### 6. 회귀 테스트가 무는가 · CI — **문다 · exit 0**
- 음성 대조: `git checkout 5fcd28c -- src` 로 되돌린 뒤 `hook-ref.ts` 의 `findStaleHookRefs` 시그니처만 3인자로 맞췄다.
  변이 적용 증명은 `update-mode.ts:687` 이 `cleanStaleHookRefs(` 를 다시 부르는 것으로 확인했다.
  `tsc --noEmit` exit 0 이다. 전체 vitest 2236건(프로브 6 포함) 중 2건이 red 였다:
  - `update-restores-shared` "기록에 없는 스크립트를 부르는 설치자 훅은 바이트 그대로…" — `expected '[]' to be '[{"matcher":"Bash",…'`.
  - `install.test` "update 분기는 남긴 stale hook ref 를 경로까지 노출한다" — `to contain '2 left (yours'`.
  - 동작에서 난 red 이고 빌드 파손이 아니다. 복원 뒤 green.
- `npm run ci`(파이프 없이) **exit 0** — 146 files / 2230 tests · branches 88.98% · build 성공(`r2/ci.log`).

---

## NOTE (비차단)
- **NOTE-1** ADR-099 Consequences 문장(`docs/decisions/ADR-099-exclusion-is-explicit-only.md:28`)이 현행 동작과 어긋난다.
  같은 사실을 두 곳에 두지 않는 원칙에 따라, 날짜를 단 한 줄 주석(#746 · 이 PR 로 3단계는 알리기만 한다)이나 PR
  본문 기록으로 처리를 정할 것. 고치지 않으면 다음 사람이 정리기가 아직 있다고 읽는다.
- **NOTE-2** 구현자 인계의 음성 대조 기술 "src 4파일을 5fcd28c 로 되돌리면(HEAD 그대로라 typecheck 통과)"는 **사실이 아니다**.
  그대로 되돌리면 `tests/update-restores-shared.test.ts(223,62) TS2554 Expected 2 arguments, but got 3`(`r2/tsc-mut.log`)
  가 난다. spare 단위 테스트의 red 는 그 시그니처 차이에서도 온다. 위 §6 의 typecheck 통과 변이로 회귀 테스트가
  무는 것은 따로 확인했으므로 결론에는 영향이 없다.
- **NOTE-3** 화면 문구 "yours — not in the install record"는 기록 밖이라는 사실까지는 맞다. 다만 "yours"는 추정이다.
  B-1 을 고치면 남는 대상은 정말 설치자 몫뿐이라 문구가 사실이 된다. 고치지 않고 받아들이면 문구를 사실 쪽("not in the install record")으로만 좁히는 것을 권한다.
- **NOTE-4** `InstallReport.staleHookRefs`(fresh 분기 `install-render.ts:727-733` 의 `removed` 문구)는 항상 `[]` 라 거짓
  화면은 나지 않는다. 구현자 판단대로 범위 밖으로 두어도 된다(죽은 경로 정리는 이슈로).
- Non-Goals · DO NOT CHANGE 침범 없음. 위저드 힌트 `harness hook wiring · dead refs reported, not removed` 는 실제 동작과 맞다.

## 정리
- 작업 사본: 프로브 3개를 `tests/` 에서 지웠고, node_modules 심링크와 `dist/` 도 지웠다.
  `git checkout HEAD -- src` 로 복원했고 `git status` 는 깨끗하다(HEAD b4ea578 detached).
- 증거는 `rev-C/r2/` 에 남겼다: `probe{2,3,4}.test.ts.txt` · `probe*-{b4ea578,5fcd28c}.json` · `tsc-mut*.log` · `vt-mut*.json` · `ci.log`.

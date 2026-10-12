# PR #804 (#800 후속) 독립 리뷰 — e1d1f48 (base 185d6df)

## 판정: **BLOCK (범위 좁음 — update 화면 1건)**

핵심 재현(`install --without settings:hooks.PreToolUse#protect-files.sh`)은 **완전히 통과**했다.
데이터 쪽(백업 1개 · 바이트 그대로 · 안 고친 줄은 백업 없음 · 중복 백업 없음)은 install·update 두 경로 모두 맞다.
막는 것은 하나다. **update 가 고친 은퇴 훅 줄을 걷으면, 화면이 그 백업을 "네 편집이 아닐 수 있다"고 말한다.**
리드가 준 기준 중 "update path behaves the same · no misleading screen lines"를 충족하지 못한다.

## Review Summary

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 1 | block (리드 기준 미충족) |
| MEDIUM | 1 | info |
| LOW | 0 | pass |

## 검증 증거 (직접 실행)

1. **`npm run ci`** (리뷰 트리, 파이프 없이 실행): exit 0 · branches 89.64%.
2. **변이 3종** (트리를 격리 사본으로 옮겨 실행 · 3종 모두 tsc=0 확인)
   - ① `backupFile` 호출 제거 → 3개 테스트 red (#800 신규 테스트 포함, `expected [] to have a length of 1`)
   - ② render 중복 억제 루프 제거 → 2개 테스트 red (`expected 2 to be 1` — 같은 백업이 두 줄에 나온다)
   - ③ 조건을 `res.removed.length > 0` 로 넓힘(안 고친 줄도 백업) → 신규 테스트 red (`[ …(2) ] to deeply equal [ Array(1) ]`)
   → 백업 생성 · 화면 중복 억제 · "고친 것만 백업"을 각각 테스트가 잡는다.
3. **실제 npm 판 → 이 빌드로 확인 (docker `uzys-r804-a`, 확인 뒤 삭제)** — 스크립트는 `docker-r804.sh`
   - npm `@uzysjung/agent-harness@26.170.0` 로 install → jq 로 protect-files 줄 끝에 ` && bash ./scripts/team-guard.sh # MINE-CHAIN` 덧붙임 → 이 빌드로 `install --without <KEY>`
   - 고친 경우: 백업 1개 · **`cmp` 로 실행 전 파일과 바이트 그대로 일치** · 실제 파일에 protect-files 참조 0 · 화면에 그 행 1줄(`… your edits to <KEY> are in the copy: .claude/settings.json.backup-… (…)`), 일반 backup 행은 없다
   - 안 고친 경우(대조군): 백업 없음, 화면에 "your edits" 문구 없음
   - 두 경우 모두 이어서 `update` 를 돌림 → 백업이 더 생기지 않고, settings 행도 없고, 참조 0 그대로
4. **update 경로 (단위 탐침, `probe800.test.ts`)** — 하네스 루트 사본에서 template `settings.json` 의 protect-files 배선을 지워 "그 훅을 은퇴시킨 다음 판"을 흉내 냈다
   - 순서: install(현행) → protect-files 줄 편집 → 은퇴판으로 `runInstall(mode:"update")`
   - 결과: 백업 1개, JSON 으로 다시 읽었을 때 편집한 명령이 그대로 있음 · 실제 파일에서는 걷힘 · 두 번째 update 는 백업을 더 만들지 않음 ✓
   - 화면 ✗ — 아래 HIGH-1
   - 같은 탐침을 `mode:"add"` 로도 돌림: 백업 1개 ✓, 화면은 일반 `✓ backup …settings.json.backup-…` 행 + `removed the harness part` (MEDIUM-1)

## Findings

[HIGH-1] update 가 고친 하네스 훅 줄을 걷고 만든 settings.json 백업이 "체크섬 없음 — 네 편집이 아닐 수 있다"로 분류된다
File: src/update-mode.ts:952-961 (`noChecksum` 판정) · src/commands/install-render.ts:297-330 (BACKUPS/NEXT 행)
Issue: `checksumOnRecord` 는 하네스 파일 목록(policy/skill/external/assets)만 보고, 함께 쓰는 파일(`.claude/settings.json`)은
그 목록에 없다. 그래서 이 PR 이 update 에서 처음 만드는 settings.json 백업이 **언제나** `noChecksum` 으로 분류된다.
실측 화면(체크섬을 남기는 이 빌드로 설치한 프로젝트):
```
  ✓ .claude/settings.json        removed the harness part
  ⊘ no checksum on record   1 backed up once as *.backup-<time> — installed before checksums were kept, so these may not be your edits (usually what changed between releases); later updates compare precisely
```
요약에도 같은 분류가 이어진다. `BACKUPS … no checksum on record for any of them … may not be your edits` 행과
`NEXT nothing to re-apply unless you remember editing one of them` 행이 붙고, `update-backups.json` 에는 `noChecksum: true` 가 적힌다.
실제로는 `removedEdited` 가 기록 sha 와 대조해 **"고쳤다"고 판정한 뒤에** 만든 백업이다. 그러니 이 화면은 사실과 반대이고
("installed before checksums were kept" 도 틀렸다), settings 행은 편집이 걷혔다는 말을 하지 않는다.
설치자는 자기 편집을 담은 백업을 무시하라는 안내를 받는 셈이다. 이 PR 이 막으려던 "편집이 말없이 사라짐"이
update 경로에서는 문구 수준으로 남는다.
도달성: 판이 훅 배선을 은퇴시키면 생긴다. 이력상 실제로 반복됐다
(task-brief-nudge 2026-09-13, mcp-pre-exec 2026-08-16, hito-counter 2026-07-19 …). 몫 기록을 가진 설치본에서는 다음 은퇴 때 그대로 발생한다.
데이터는 안전하다(백업이 바이트 그대로 있다). PR 전에는 백업 자체가 없었으니 데이터 면에서는 순수한 개선이다.
그래도 리드 기준의 "update 경로가 같게 동작 · 오해를 부르는 화면 없음"은 충족하지 못한다.
Fix (방향): 함께 쓰는 파일의 "고친 몫을 걷기 전" 백업은 측정된 판정이니, `firstContact` 처럼 `noChecksum` 후보에서 뺀다
(예: writer 의 shared `backupAbs` 가 있는 경로를 제외 집합에 넣는다). update 의 settings 행도 그 백업이나 걷힌 편집을 한 번 말하게 한다.
회귀 테스트는 이 탐침 시나리오(은퇴판 템플릿 + 편집 줄 + update)로 쓴다.

[MEDIUM-1] 은퇴(`--without` 이 아님)로 걷힌 고친 훅 줄을 install/--reinstall 화면이 맨 backup 행으로만 말한다 — 구현자 의심 (a)
File: src/install-writes.ts:368 (`removedEdited` 를 excluded 로만 거름) · src/commands/install-render.ts:1480-1483
Issue: 백업은 `res.removedEdited` 전체(은퇴 포함)로 만드는데, 화면 문구(`excludedKeyParts`)와 중복 억제는 excluded 로 거른
`removedEdited` 만 본다. 그래서 은퇴 경우의 화면은 `✓ backup …/settings.json.backup-…` + `✓ .claude/settings.json removed the harness part` 다.
경로는 대니 거짓은 아니고, 백업도 한 번만 말한다. 다만 "왜 백업했는가(네 편집이 걷혔다)"는 빠진다.
HIGH-1 을 고치면서 settings 행이 은퇴로 걷힌 편집도 말하게 하면 install 쪽도 같이 풀린다. 이 PR 범위 밖으로 미뤄도 된다.

## 구현자 의심에 대한 판정
- (a) → MEDIUM-1 (install) · HIGH-1 (update, 화면이 틀렸다)
- (b) Codex/OpenCode — 수용한다. `removedEdited` 는 `adapters/contract.ts:184,231` 의 `alwaysStrip` 경로에서만 생기고,
  Codex `transform.ts:211` 은 늘 `[]` 다. 고친 몫은 `kept` 로 남긴다(걷지 않으니 백업할 것도 없다).
- (c) update 경로 — 코드 읽기 대신 위 4번으로 실행해 확인했다. 데이터 ✓ · 화면 ✗.
- (d) 테스트 헬퍼 `hooks?.[event]` — 무해하다. 그 event 의 훅이 다 걷혀 `hooks` 가 없어지는 경우를 위한 방어다.

## 리드 기준 대조
| 기준 | 결과 |
|---|---|
| --without 재현: 편집을 백업 1개에 바이트 그대로 | ✓ (npm 26.170.0 → 이 빌드, `cmp` 일치) |
| 안 고친 줄을 걷을 때 백업 없음 | ✓ (docker 대조군 · 변이 ③) |
| update 경로 같은 동작 | 데이터 ✓ / 화면 ✗ (HIGH-1) |
| 백업 추가·중복 없음 | ✓ (재실행·update 후 백업 1개 그대로 · 변이 ②) |
| 오해를 부르는 화면 없음 | install ✓ / update ✗ |

## Positive Observations
- 백업은 `res.changed && disk !== null && removedEdited` 일 때만 쓰기 직전에 만들고, 그 백업을 `backups` 에 넣어 install 보고와 짝을 맞췄다.
  uninstall(#803, `shared-write.ts:535`)과 같은 규칙이다.
- 같은 백업을 settings 행과 일반 backup 행에 두 번 내지 않도록 `judgedBackups` 를 재사용했다. 새 장치를 만들지 않았다.
- 신규 테스트에 "안 고친 줄 → 백업 없음" 대조군이 같이 들어 있어, 변이 ③(백업을 과하게 만드는 쪽)도 잡는다.

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (diff = src 2파일 + 테스트 1파일)
- [x] SPEC/PRD 범위 내
- [ ] 리드 기준 "update 경로 동일 · 오해를 부르는 화면 없음" — HIGH-1 로 미충족

증거 파일: `probe800.test.ts`(update/add 탐침 — 은퇴판 루트 경로를 상수로 박음) · `docker-r804.sh`(npm 실설치 재현). docker 이미지는 삭제했다.

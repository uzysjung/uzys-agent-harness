# PR-C 독립 리뷰 — fix/update-no-folder-copy @ 5fcd28c (base main@6d6c8ec)

## 결론: BLOCKER 있음 (1건)

완료 기준 두 줄은 **충족한다**(아래 §근거). 다만 판정 질문 2("폴더 사본이 있어야만 복구되던 경우가 있었나")의 답이
**있다** — update 가 설치자 몫을 지우는 경로가 하나 있고, 이번 변경으로 그 경로의 유일한 원본 보존이 사라진다.

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| BLOCKER(HIGH) | 1 |
| HIGH(비차단) | 1 |
| LOW/NOTE | 5 |

---

## BLOCKER-1 — update 가 settings.json 에서 설치자 훅 항목을 지우고, 이제는 어디에도 원본이 안 남는다

**File**: `src/update-mode.ts:685-695`(3단계 `cleanStaleHookRefs`) · `src/hook-ref.ts:154-166`(`writeFileSync` — 백업 없음)

**무슨 일이 생기나(설치자 자리)**: Claude Code 를 고른 설치본의 `.claude/settings.json` 에 설치자가 직접 넣은 훅
(`$CLAUDE_PROJECT_DIR/.claude/hooks/<x>.sh` 형태)이 있고 그 스크립트가 지금 디스크에 없으면(#536 주석이 적은 실 사례 —
팀이 커밋한 훅, 스크립트는 생성물이라 클론에 아직 없다), `update` 가 그 항목(이벤트 · matcher · command · 플래그)을
통째로 지운다. ADR-099 R2 로 정리기는 **기록된 하네스 스크립트 참조는 건너뛰므로**, 지우는 대상은 정의상 기록 밖 —
대부분 설치자 몫이다. 화면은 `settings.json stale hook refs · 1 removed (hooks/<x>.sh)` 로 경로만 말한다.
- 이전(main): `.claude.backup-<ts>/settings.json` 이 원본을 들고 있었고 ROLLBACK 행이 되돌리는 명령을 줬다.
- 이후(5fcd28c): 파일 백업 없음 · 폴더 사본 없음 · ROLLBACK 행 없음 → **git 에 커밋돼 있지 않으면 복구 불가**.

이는 ADR-097 결정 4("함께 쓰는 파일은 하네스 몫만 더하고·바꾸고·뺀다") · 루트 CLAUDE.md §설치자 디스크 원칙 ·
USAGE.md:184 의 약속("your own keys, hooks and lines stay")과 어긋나는 **기존 동작**이지만, 지금까지는 폴더 사본이 그
손실을 덮고 있었다. 설계 §2.2 의 불변식 문단("`.claude/` 안에서 하네스가 쓰지 않는 파일은 update 가 손대지 않으므로
사본이 지키던 것이 없다")은 settings.json 의 이 경로를 빠뜨렸다 — 그 전제가 이 PR 의 "잃는 것 없음" 근거다.
(install 쪽은 같은 상태를 이미 "지우지 않고 알리기만" 으로 정했다 — `hook-ref.ts` `findStaleHookRefs` 주석 #603 · B-666-1.)

**증거(직접 재현)** — 같은 프로브를 두 판에 돌렸다(`runInstall` add → settings.json 에 설치자 훅
`bash "$CLAUDE_PROJECT_DIR/.claude/hooks/team-generated-guard.sh" --strict --team-flag` 추가 → `runInstall` update):

| | main@6d6c8ec | 5fcd28c |
|---|---|---|
| update 뒤 settings.json 에 그 훅 | 없음 | 없음 |
| `report.updateMode.staleHookRefs` | `["hooks/team-generated-guard.sh"]` | 같음 |
| 원본을 담은 파일이 디스크 어딘가에 | **있음**(`.claude.backup-*/settings.json`) | **없음** |
| `settings.json.backup-*` | 0 | 0 |
| `.claude.backup-*` | 1 | 0 |

원자료: `probe-base.json` · `probe-after.json` · 프로브 소스 `probe.test.ts.txt`(같은 폴더).

**재현**: `probe.test.ts.txt` 를 `tests/` 에 넣고 `npx vitest run tests/<그 파일>` → 출력 JSON 의 `settings.anyCopyHoldsIt`.

**완료 기준(둘 중 하나 — 고르는 것은 리드)**:
- ⓐ update 가 settings.json 에서 무언가를 지우는 실행이면 지우기 **전** 원본이 파일 단위로 남는다 —
  `.claude/settings.json.backup-<ts>` 생성 · `update-backups.json` 에 쌍 · 화면 BACKUPS 행에 그 경로. 또는
- ⓑ 기록 밖 참조는 install(#603)과 같게 **지우지 않고 알리기만** 한다(설치자 항목 바이트 유지).
- 어느 쪽이든 위 프로브와 같은 회귀 테스트 1건 + 음성 대조(백업/보존 분기를 되돌리면 red, typecheck 통과 확인).
- 설계 §2.2 불변식 문단에 settings.json 경로를 반영(또는 ⓑ 면 그 문단이 그대로 참이 된다).

---

## HIGH(비차단) — 외부 스킬 갱신(`npx skills add --copy`)도 폴더 사본이 유일한 보존이었다

`src/external-installer.ts:465-524` `refreshExternalSkills` 는 기록된 외부 스킬을 상류 최신판으로 다시 받는다
(주석의 실측: "재실행은 상류 최신판을 받아오고(변이 1 → 0)" — 편집이 되돌려진다). 파일 단위 백업이 없다.
설치자가 `.claude/skills/<외부 id>/` 의 파일을 고쳤다면 main 에서는 `.claude.backup-*` 에 남았고 이제는 남지 않는다.
ADR-097 결정 5 는 "기록된 외부 도구 파일에 3(파일 단위 백업)을 적용" 이라 적었다 — update 쪽은 미적용 상태.
**비차단 사유**: 실 `npx skills` 를 돌리지 않아 end-to-end 로 재현하지 못했고(호스트 실행 · 네트워크),
설치자가 서드파티 스킬 본문을 제자리에서 고치는 상태를 누가 만드는지 기록된 관측이 없다. `.agents/skills/<id>` 쪽은
원래도 무보호였다. 이슈로 올려 두기를 권한다(PR-D 의 #7 행과 같은 축).

---

## 근거 — 판정 질문별

### 1. update 쓰기 경로마다 파일 단위 백업 + 무는 테스트 — **충족**

실 update(`runInstall` add → 편집 → `runInstall` update, cli = claude+codex+antigravity, tooling) 결과
(`probe-after.json`): 아래 10경로 **전부** 백업 1개 · 백업에 편집 내용 보존 · 라이브는 최신판(지운 경로는 부재) ·
`update-backups.json` 에 10쌍 · `.claude.backup-*` 0.

| 경로 | 쓰기 지점 | 백업 | 편집 보존 |
|---|---|---|---|
| 룰 `.claude/rules/git-policy.md` | `updateDir` | 1 | ✓ |
| 에이전트 `.claude/agents/reviewer.md` | `updateDir` | 1 | ✓ |
| 훅 `.claude/hooks/session-start.sh` | `updateDir` | 1 | ✓ |
| 스킬 `.claude/skills/natural-korean/SKILL.md` | `syncSkills` 덮기 | 1 | ✓ |
| 스킬 번들 밖 파일 `…/my-notes.md` | `syncSkills` prune(#477) | 1 | ✓ |
| 은퇴 룰 `.claude/rules/retired.md`(기록 sha 와 다름) | `pruneOrphans` | 1 | ✓ |
| 앵커 `CLAUDE-uzys-harness.md` | `syncHarnessAnchor` | 1 | ✓ |
| `.agents/rules/git-policy.md` | owned-writer | 1 | ✓ |
| `.agents/skills/natural-korean/SKILL.md` | owned-writer | 1 | ✓ |
| `.codex/hooks/session-start.sh` | owned-writer | 1 | ✓ |

변이 대조(각 경로의 백업 분기를 `false` 로, 전체 vitest — 테스트 2231건):

| 변이 | 대상 | red |
|---|---|---|
| M1 | `updateDir` 백업 | 9 (backup-collision update · claude-slot ⑤ · policy-file-ownership 4 · update-mode · update-report-honesty 2) |
| M2 | `syncSkills` 덮기 백업 | 3 (update-mode syncSkills 2 · 스킬 기준선 1) |
| M3 | `syncSkills` prune 백업 | 2 (update-mode #477 2) |
| M4 | 앵커 백업 | 3 (update-mode 앵커 2 · 백업 목록 1) |
| M5 | owned-writer 백업(`.agents/` · `.codex/`) | 14 (external-cli-ownership 6 · external-cli-update · agents-md 4 · claude-slot ① 등) |
| M6 | `pruneOrphans` 백업 | 1 (policy-file-ownership pruneOrphans) |

변이마다 `tsc --noEmit` 진단은 **TS6133(안 쓰는 변수)뿐**이고 형 오류 0 — vitest 는 형검사를 하지 않으므로 red 는
빌드 파손이 아니라 동작에서 왔다. 구현자가 미검증으로 남긴 스킬 · 앵커 · `.agents/` 경로도 모두 기존 테스트가 문다.
매 변이 뒤 `git checkout -- src` 로 복원, 최종 `git status` 깨끗(HEAD 5fcd28c).

참고: 앵커(루트 파일)와 `.agents/` · `.codex/` 는 원래 `.claude/` 폴더 사본 밖이라 이번 변경으로 보호가 줄지 않는다.
보호가 실제로 줄어든 곳은 `.claude/` 안의 쓰기뿐이고, 하네스 파일 경로는 위 표대로 전부 파일 백업이 덮는다.

### 2. 폴더 사본이 있어야만 복구되던 경우 — **있다** → BLOCKER-1 · HIGH(외부 스킬)
그 밖: 안 고친 하네스 파일을 이전 판으로 통째 되돌리기(ROLLBACK)는 사라지지만 설치자 데이터 손실이 아니고
ADR-097 Alternatives 가 기각한 요구다. `retireMcpAllowlist` 는 무조건 백업, `installNewAssets` · 새 스킬 파일은
없는 자리에만 쓴다 — 손실 없음.

### 3. `docs/todo.md` R-3m 닫음 — **근거 맞음**
R-3m 의 대상은 update 의 `.claude.backup-<stamp>` 폴더 이름 충돌 · 심링크 `cpSync` EINVAL 이었고 그 폴더 사본이
없어졌다. "파일 백업 같은 초 충돌은 `claimBackupPath` 가 풀고 `backup-collision` 이 update 경로로 문다" 는 M1 에서
`backup-collision` update 테스트가 red 로 확인됨. 추적 문서 동기화는 doc-governance 가 요구하는 쪽이라 범위 밖이 아니다.
`spec-drift-check.sh ship` exit 0.

### 4. `shellQuotePath` 잔존 — **허용(NOTE)**
src 호출 0, `tests/p0-safety.test.ts:28-40` 만 문다. 이 변경이 쓸모를 없앤 산출물이라 원칙상 지울 대상이지만 리드가
렌더 파일 구역을 제한했고 동작 위험은 없다. 잊히지 않게 PR-D 범위에 명시하거나 이슈로 남길 것.

### 5. Docker `scenario-claude-slot.sh` ② — **맞음**
② 는 룰을 지워 update 가 `.claude/` 를 실제로 고치게 한 뒤 사본 수를 본다 — 기대 0 이 이번 계약이다. ④ 의
`BEFORE == AFTER` 는 ③(uninstall 이 아직 폴더를 옮긴다)이 사본을 만들어 탐지기에 양성이 남는다. (실행 안 함.)

### 6. `npm run ci` — **exit 0** (파이프 없이 실행 · 146 files / 2231 tests · branches 88.95% · build 성공)

---

## NOTE (비차단)
- N1 `scenario-claude-slot.sh:121-123` ② 위 블록 주석이 아직 "#556 — … 사본 1개가 실제로 잡혀야 하므로" 라 적는다
  (헤더는 고쳤다). ④ 의 탐지기 양성 대조는 PR-D 뒤 ③ 이 사본을 안 만들면 사라진다 — PR-D 가 볼 자리.
- N2 `fs-ops.backupDir` 는 설계 §2.2 가 "삭제" 로 적었으나 uninstall `moveAside` 가 아직 부른다 — 남긴 판단 맞음, PR-D 몫.
- N3 `install.test` Update Mode 요약의 `ROLLBACK` 불포함 단언은 입력에 backup 이 없어 자명하게 green(구현자 자인) — 무는 테스트 아님.
- N4 `scenario-wizard-add-cli.sh:179` · `scenario-update-external.sh:110` · `tests/commit-install-record.test.ts:295,299` 주석이
  update 사본을 전제 — 단언 무영향, PR-D 에서 함께 현행화.
- N5 Non-Goals · DO NOT CHANGE 침범 없음. `.gitignore` 의 `.claude.backup-*/` 줄 유지는 §2.2 · A4 그대로.

## 정리
작업 사본: 프로브 테스트 · node_modules 심링크 · `dist/` 삭제, `git status` 깨끗(HEAD 5fcd28c). 기준 판 추출본(`base/`) 삭제.
변이 스크립트 `mutate.mjs` · 결과 `vt-M*.json` · `tsc-M*.log` 는 증거로 남겼다.

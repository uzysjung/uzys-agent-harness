# PR #811 (#796 PR-A) 설계 이행 리뷰 — update 의 `.claude/` · 헬퍼 쓰기를 install writer 로

- 대상: `7803f76`(detached, `iso796r1`) · `git diff origin/main...HEAD` · 리뷰 2026-10-13 · 읽기 전용(변이·탐침은 별도 격리 사본 `scratchpad/mut/` 에서)
- 기준: 설계 `docs/plans/796-one-writer-design.md` PR-A 행 · §1.2(②′ 포함) · §3 · §5 · §7 표 A · "검증 반영"(BLOCKER-2 · N1 · N4 · N8–N11)

## 판정: **PASS with notes** — CRITICAL 0 · HIGH 1 · MEDIUM 1

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 1 | warn |
| MEDIUM | 1 | info |
| LOW | 0 | pass |

## 실행 증거

- `npm run ci`(파이프 없이) **exit 0** — 커버리지 Branches 89.6% (하한 86).
- 삭제 대상 부재: `scripts/check-absence.sh --canary 'x installNewAssets(' 'collectPolicyHashes|collectSkillHashes|refreshPolicyBaseline|refreshSkillBaseline|recordNewSkillBaseline|judgedUpdateWrite|refreshNeutralHelpers|notOursUnder|outsidePaths|installNewAssets|installNewSkillDirs|helpersKept|justWritten|syncSkills|updateDir\(' src` → **0건, exit 0**(카나리 통과).
- 변이 대조(격리 사본 · 매번 `tsc --noEmit` 0 확인 뒤 `tests/update-one-writer.test.ts` 실행 · 원복 `diff -q` 확인) — **4/4 red**:

| # | 변이 | 무는 테스트 |
|---|---|---|
| M1 | `updateHarnessTargets` ② 를 템플릿 폴더 대신 `템플릿 ∪ recordedSkillIds` 로 돌림(BLOCKER-2 의 원 설계 모양) | BLOCKER-2 "은퇴한 스킬 폴더의 파일이 하나도 지워지지 않고…" × |
| M2 | `recorded.ts` `scanFieldOf` 스킬 분기를 필드 존재로 되돌림 | ⓒ "다른 옛 하네스 스킬은 'no checksum' 1회 백업이고 displaced 로 적히지 않는다" × (`displaced` 에 옛 스킬이 듦) |
| M3 | `creatable` 을 릴리즈 기본(`bundledSkillTargets`)만으로 | ⓐ "폴더째 돌아오고 … restored" × |
| M4 | `recordHarnessWrites` 의 `skillFiles` 를 누적 대신 이번 원장만으로 교체(재스캔 모양) | ⓑ "--only skills 도 기록에서 지우지 않는다" × |

  구현자 메모대로 ⓒ · BLOCKER-2 는 옛 코드(base)에서는 green 이고 변이로만 문다 — 둘 다 "이 구조로 바꾸면 생길 회귀" 를 막는 가드라 그 성격이 맞다.

- 기록 모양 × 장면 탐침(격리 사본 `zz-probe-796.test.ts` — tooling·claude 실설치 → 모양 변환 → 다음 릴리즈 번들 사본에서 룰 2 · 훅 1 · 스킬 1 · 헬퍼 1 을 고침) — **21/21 통과**:

| 모양 | 고친 하네스 룰 | 기록에 없는 같은 이름 설치자 파일(`test-policy.md`) | 안 고친 훅·스킬·헬퍼 | 2회차 |
|---|---|---|---|---|
| 필드 없음(S0) | 백업 + 최신판 · `policyBackedUp` · `noChecksum` | 1회 "no checksum" 백업(옛 로그는 열거를 못 해 `no-sha` — 오늘과 같다) · 원본 바이트 백업에 생존 | 1회 "no checksum" 백업 뒤 갱신(오늘과 같다) | 백업 0 |
| 스캔 필드(S4′) | 백업 + 최신판 · `policyBackedUp` | `displaced` + 백업(원본 생존) · `noChecksum` 에 안 듦 | 백업 없이 갱신 | 백업 0 |
| writer(S5) | 같음 | 같음 | 백업 없이 갱신 · 백업 파일 0 | 백업 0 |

  `--only {rules,hooks,skills,new-skills,anchor,external}` × 3모양 18건: **고른 묶음의 파일만 바뀌고 그 기록만 바뀐다**(rules 는 헬퍼 포함 — 오늘과 같은 묶음). 이어서 돌린 전체 update 에서 `displaced`·`displacedSame` 0 — 부분 실행 뒤 하네스 파일이 첫 접촉으로 뒤집히는 길(검증 BLOCKER-1 · §1.2 ⑧)이 세 모양 모두 닫혀 있다.
- ⑨(N1) 탐침: tooling 설치본에 트랙 밖 같은 이름 `rules/ui-components.md` · `agents/data-analyst.md`(설치자 내용) → update 뒤 **두 파일 바이트 그대로** · 백업 0 · `demotedAgents` 안내만(writer · 필드 없음 둘 다).

## 설계 이행 대조

| 항목 | 결과 | 근거 |
|---|---|---|
| §5.2 대상 선정 | ✓ | `updateHarnessTargets` (update-mode.ts:1248) — 파일 자산 = `trackOnlyFileAssets` · 앵커/settings 제외 · `#480` 묶음 · claude 게이트 · `isBaselineExcluded`. 스킬 = **템플릿 폴더를 돈다**(BLOCKER-2 반영) ∩ `recordedSkillIds` · 없는 폴더는 `claudeSkillIds`(Claude 자리 기록 ∪ 릴리즈 기본)일 때만 |
| N10 순서 | ✓ | `occupiedByNonDirectory` 가 `existsSync` · `ids` 검사보다 먼저(:1289) |
| §5.2 ① 의 `foreignOwnedTarget` | 실질 동일 | 파일 자산 루프엔 없지만 `foreignOwnedTarget` 은 `SKILL_SLOT` 밖 경로에 늘 null 을 낸다(foreign-slot.ts) — 빠진 보호 아님 |
| §5.3 한 패스 · 순서 자유 | ✓ | 쓰기 → 은퇴 회수 → #477 정리 → 되돌리기 → 기록 1회(:1343–1400). `claims` 는 디스크를 만지기 전 계산(§3.4) |
| §5.4 기록 누적 | ✓ | `recordHarnessWrites` — 네 필드 `mergeExternalFiles`/`mergeRootFiles` · `withoutLostBackups` · `withoutRestored` · pruned 제외 · `records` 미기록(§3.5) · 로그 재읽기·없으면 안 만듦 |
| §5.4 화면 필드 | ✓ | `updated`(기존 단위의 변경) · `installedNew`/`restored`(새로 생긴 단위, `LINES.restored` 유무) · `policyBackedUp`/`skillsBackedUp`(`backup+overwrite && record==="sha"` = 편집·체크섬 없음) · `displaced`/`displacedSame`(원장 rootFiles) · `noChecksum`·`backups` 오늘 그대로 — 탐침 출력과 일치 |
| BLOCKER-2 | ✓ | 위 M1 |
| N1 ⑨ | ✓ 동작 · ✓ 문서 | "검증 반영" 표가 §1.2 를 대체한다고 명시 — 동작은 탐침으로 확인 |
| N4 · ⑥ | ✓ | `helpersKept` 필드·행 삭제 · 테스트 단언 `outsideLinks` + 밖에 백업 0 |
| N9 | ✓ | `logAtStart === null` → 하네스 단계 전체(헬퍼 포함) 건너뜀(:595-598) |
| N8 | ✓ | 로그 없이 `.claude/` 갱신을 단언하던 E2E 는 기록을 심었다(update-mode.test `legacyLog()` 등) · 앵커 이행 블록은 그대로 |
| N11 ⓓ | ✓ | 주석만 갱신 — "없으면 실패" 로 주장하지 않는다 |
| ②′ | ✓ | §1.2 행 추가 · docker `update-new-assets` 준비 단계를 헬퍼 기록 없는 옛 모양으로(`jq walk`) — **docker 실행은 내가 하지 않았다**(다른 레인 범위) |
| §7 크기 | 범위 안 | src +340 / −908(순 −568). update-mode.ts 추가 중 주석 아닌 줄 ≈ 260 — 추정 ≈ 230 근처, 경우가 되돌아온 흔적 없음(옛 `notOurs`·`outside`·`keepPrior`·`targets`·`justWritten`·조기 반환 모두 부재) |

## 재작성 테스트 — 보호가 약해졌는가 (파일별 옛/새 단언 대조)

| 파일 | 대조 | 판정 |
|---|---|---|
| `policy-file-ownership.test.ts` | `updateDir` 5건 → `runUpdateMode` + 심은 기록. 디스크·백업 내용 단언 동일, `result.backedUp` → `report.policyBackedUp`, 체크섬 없음 건에 `noChecksum` 단언 **추가**. `collectPolicyHashes` 2건 → "기록은 이번에 쓴 하네스 sha 만 · 설치자 파일 미기록" 1건(sha 가 디스크가 아니라 쓴 판 — 의도된 의미 변경). "보호 계약" 1건은 함수 소멸 · 같은 장면을 체크섬 없음 건이 문다 | 약화 없음 |
| `update-mode.test.ts` | `updateDir` 3건 삭제 — "c.md 를 새로 깔지 않는다" 는 의도적으로 뒤집힌 의미(트랙 대상 결측은 원래 `installNewAssets` 가 깔았다), 확장자 필터는 대상 선정이 manifest 라 무의미. `syncSkills` 11건 → `runUpdateMode`; 디스크·백업·prune·링크 단언 동일하고 **기록 단언 추가**(prune 된 파일이 기록에서 빠짐 · 사용자 파일 미기록). "기준선 없음 백업" + "이미 최신 무동작" 2건 → 1건으로 합치며 `displaced`·`displacedSame` 0 **추가**. 단언 수 −43/+41 | 약화 없음 |
| `render-hint-parity.test.ts` | 손 픽스처 → 실설치 + 번들 사본. `commands/uzys` 가 슬롯에서 빠짐 — 템플릿에 그 폴더가 없어 update 가 쓸 것이 없다(픽스처 전제 단언 포함) | 약화 없음 |
| `update-pipeline-scope.test.ts` | `helpersKept` → `outsideLinks` + 밖 폴더에 백업 0 **추가** | 강화 |
| `update-restores-shared.test.ts` | §1.2 ⑤ 대로 restored → installedNew 로 뒤집음(설계 감수 항목) + 스크립트·배선·기록 단언 **추가** | 설계대로 |
| `displaced-restore-all-removes.test.ts` · `update-external-skills.test.ts` | 주석 · 옛 로그 심기만 | 영향 없음 |

## Findings

[HIGH] §1.2 에 없는 설치자 가시 변화 2건 — 문서 열거 누락(디스크 결과는 같다)
File: src/update-mode.ts:1355(writer 경로) · :1289-1292 / docs/plans/796-one-writer-design.md §1.2
Issue:
 ⓐ **writer 기록(v26.162+)에 헬퍼 항목이 없는데 디스크에 헬퍼가 있고 내용이 다를 때** — 전: `refreshNeutralHelpers` 가 "기록 없음 → 백업 뒤 교체", 화면 `noChecksum`("no checksum on record"). 후: `recorded()` = `none` → 첫 접촉 — 백업 뒤 교체는 같지만 화면이 `displaced` "had a file with this name — saved as …, **put back on uninstall**"(install-render.ts:201·1001) 로 바뀌고 `rootFiles` 에 displaced 가 적힌다. 탐침(`zz-probe2-796.test.ts`)으로 재현: update 뒤 `displaced=[.uzys-agent-harness/check-absence.sh]` · rootFiles displaced+백업 1건 → 이어 `uninstall --yes` 뒤 `.uzys-agent-harness/` 는 폴더째 없다(uninstall.ts:606 "하네스 전용이라 디렉터리째 지운다") — **"put back on uninstall" 약속이 헬퍼 자리에서는 지켜지지 않는다.** 단 이 거짓 약속과 원본 소실은 **PR-A 이전부터 install 경로에 있다**(writer 가 v26.162.0 부터 `installCliNeutralAssets` 로 헬퍼를 같은 규칙으로 씀 — `git show v26.162.0:src/installer.ts` :686-693), 그리고 옛 update 의 백업도 같은 폴더에 있어 uninstall 뒤 남지 않았다 → PR-A 가 새로 잃게 하는 바이트는 없다. 이 상태를 만드는 길도 좁다(writer 설치 때 헬퍼가 "같아서 둔 첫 접촉" 이었거나 · 밖 링크였거나 · 나중 릴리즈에 생긴 헬퍼 이름의 파일을 설치자가 그 하네스 전용 폴더에 둔 경우).
 ⓑ **`--only new-skills` 가 `skillsSkippedLinks` 행을 낸다** — 전에는 `syncSkills`(묶음 `skills`)만 채웠다. 말 자체는 참(그 자리는 링크라 건너뛰었다)이라 해는 없다.
 구현자 보고에는 둘 다 적혀 있으나 §1.2 에 행이 없어, 목표의 "설치자 가시 변화는 전부 §1.2 에 열거" 기준을 문서상 채우지 못한다.
Fix: §1.2 에 두 행(예: ②″ "writer 기록에 없는 헬퍼 · 내용 다름 → 'no checksum' 대신 첫 접촉(displaced) 문구, 디스크 결과 같음" · ⑩ "`--only new-skills` 도 링크 슬롯 행을 낸다")을 추가. 헬퍼 displaced 의 "put back on uninstall" 이 `.uzys-agent-harness/` 에서 거짓인 것은 install 경로의 기존 결함이므로 **별도 이슈**로(이 PR 의 블로커 아님 — 설치자 디스크 원칙상 그 폴더를 하네스 자리로 볼지 · 화면 문구만 고칠지 결정 필요).

[MEDIUM] 지운 함수를 가리키는 테스트 주석 3곳
File: tests/external-cli-update.test.ts:12(`updateDir`) · tests/install-foreign-skill-dir.test.ts:34(`syncSkills` 의 `skippedLinks`) · tests/update-dev-default-skills.test.ts:355(it 제목 "updateDir 경로에서도")
Issue: 다음 유지보수자가 없는 함수를 찾는다. 동작·단언에는 영향 없음.
Fix: `updateHarnessFiles` · `report.skillsSkippedLinks` 등 현행 이름으로.

## Positive Observations
- 은퇴 스킬 폴더 보호(BLOCKER-2)를 "템플릿 폴더를 돈다" 는 **대상 선정 구조**로 풀어, 정리 함수(`pruneSkillExtras`)에 은퇴 분기를 덧대지 않았다 — 변이 M1 이 원 설계 모양으로 되돌리면 바로 문다.
- 재스캔 예외 6종(`dirs`·`outside`·`notOurs`·`keepPrior`·`targets`·조기 반환)과 `justWritten` 이 코드에서 실제로 사라졌고(check-absence 0건), 그 보호는 세 기록 모양 × `--only` 18건 탐침에서 그대로 유지된다.
- 재작성 테스트가 옛 디스크 단언을 그대로 옮기면서 **기록 단언을 더했다**(prune 된 파일의 기록 제거 · 설치자 파일 미기록 · 첫 접촉 0) — 완화가 아니라 강화.
- 화면 필드는 원장(`ledger.writes`)에서 유도돼 탐침 출력(`policyBackedUp`·`noChecksum`·`displaced`·`updated`)이 디스크 결과와 일치했다.

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 — ADR-097 판정표 뜻 · 기록 네 필드 모양 불변, `judge.ts` 는 주석 1줄만
- [x] SPEC/설계 범위 내 — PR-B(`pruneOrphans` → judge) · PR-797 범위를 건드리지 않았다(`pruneOrphans` · `PolicySyncCtx.baseline` 그대로)
- [ ] §1.2 열거 완결 — HIGH ⓐ·ⓑ 두 행 추가 필요(문서 한 줄씩, 코드 수정 불요)

**결론: PASS with notes.** 머지 전 §1.2 에 두 행을 더하는 것을 권장하고, 헬퍼 자리의 "put back on uninstall" 거짓 약속은 기존 결함으로 이슈를 연다. 미검증: docker 시나리오(②′ 의 `update-new-assets` 포함) 실행 · 옛 npm 판 실설치는 다른 레인 몫이라 이 판정에 들어 있지 않다.

증거 파일(스크래치): `14be698a…/scratchpad/zz-probe-796.test.ts` · `zz-probe2-796.test.ts` · `ci.log` · `old-update-mode.ts`(origin/main 사본).

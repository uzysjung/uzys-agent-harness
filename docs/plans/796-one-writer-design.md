# #796 · #797 설계 — update 의 하네스 파일 쓰기를 install 과 **같은 writer · 같은 판정** 으로

- 작성 2026-10-13 · 설계 레인(단일 에이전트 · 저장소 읽기 전용 · git 무수정) · 기준 main `601c227`
- 입력: 이슈 #796 · #797 · `docs/plans/simplify-audit-2026-10-12.md` §1–§4 · `docs/plans/one-principle-design-2026-09-27.md`(PR-5 계획, :370 · :374 · :465) · 루트 `CLAUDE.md` §설치자 디스크 · ADR-096 · 097 · 099 · 111 · `docs/plans/v26.170.0-legacy-displaced-design.md` · `v26.170.0-reviews/` · `v26.170.0-design-evidence/container/`(옛 npm 판 5종 실설치 기록) · 코드 `src/update-mode.ts` · `install-writes.ts` · `owned-write.ts` · `judge.ts` · `recorded.ts` · `install-log.ts` · `displaced.ts` · `commands/uninstall.ts` · `commands/install-render.ts`
- 증거: `796-one-writer-evidence/`(이 폴더) — `function-spans.txt`(삭제 대상 함수의 줄 범위 실측) · `probe-797-owned-write-nosha.md`(#797 탐침 실행 결과) · `record-shapes-observed.md`(옛 판 기록 모양 실측) · `file-sizes.txt` · `base-commit.txt`
- 사용자 지시(2026-10-12/13): "단순화해서 해결하는 것이 가장 좋다 — 여러 경우를 구조로 없앨 수 있으면 그렇게."
- **이 문서가 바꾸지 않는 것**: ADR-097 판정표의 뜻 · 루트 `CLAUDE.md` §설치자 디스크 원칙 · 기록 네 필드의 모양. 표에 **행 하나를 더하는 것**(§5.6)만 Minor CR 로 올린다.

---

## 0. 결론 먼저

**할 가치가 있다 — 단, 범위를 넷(PR-0 · A · B · 797)으로 자르고 화면은 건드리지 않는다.**

설치자에게 달라지는 것(§1): 결과는 **거의 같고 놀람이 줄어든다** — ⓐ 지운 하네스 파일이 기록에서 사라지지 않아 다음 update 가 "was missing — restored" 로 정직하게 되살린다 ⓑ 기록에 있는 opt-in 스킬 폴더를 지웠을 때도 되살린다(ADR-099 R2 가 이미 약속한 것) ⓒ 옛 판(체크섬 이전)의 은퇴 룰이 두 번째 update 가 아니라 첫 update 에서 백업 뒤 빠진다 ⓓ `RETIRED_PATHS` 손목록이 빠뜨린 이름이어도 설치자 파일을 백업 없이 지우는 길이 닫힌다. 나빠지는 것은 없고, 문구가 바뀌는 좁은 경우 둘(§1.2 ⑤ · ⑥)은 감수한다.

유지보수자에게: 하네스 파일을 쓰는 실행기가 **세 벌(install writer · update `judgedUpdateWrite` · owned-write 인라인) → 한 벌**이 되고, "쓴 뒤 디스크를 다시 훑어 기록" 하는 함수 3개와 그 매개변수 7개가 **생길 자리와 함께** 사라진다. 단계 순서 제약(새 자산 → 재스캔 → 되돌리기)도 사라진다. 순감 ≈ **650줄(src, ±100)**(§7).

위험 통제: PR-A · B 는 설치자 디스크 경로라 `test-policy` 문턱 위 — 설계 이행 리뷰 + **옛 npm 판 실설치 적대적 손실 탐색**(v26.170.0 의 `run-old.sh` 재사용)을 따로 건다. PR-A·B·797 은 화면 필드(`UpdateModeReport`)를 그대로 채우므로 기존 화면 테스트가 리그레션 게이트다. 화면 통일(감사 §3)은 PR-C 로 뒤에.

---

## 1. 설치자에게 — 장면별 전/후

### 1.1 같은 결과인 장면(바뀌지 않아야 하고, 바뀌지 않는다)

| 장면 | 전(v26.170) | 후 | 근거 |
|---|---|---|---|
| 현행 기록(writer) · 안 고친 룰·훅·스킬 | 조용히 갱신, 기록 sha 갱신 | 같음 | `judge` sha 행 `overwrite`(judge.ts:176-179) — 지금도 update 가 judge 를 탄다(update-mode.ts:2492) |
| 고친 하네스 파일 | 그 파일 하나 `<file>.backup-<시각>` + 최신판, 화면 `edited … N backed up` | 같음 | `backup+overwrite` + `record: sha`(judge.ts:179) → `policyBackedUp`/`skillsBackedUp` 로 같은 필드에 |
| 하네스 자리의 같은 이름 설치자 파일(첫 접촉) | 다르면 백업 + 최신판 + `displaced`(되돌리기 근거) · 같으면 그대로 두고 백업 없는 `displaced` | 같음 | writer 가 이미 `displaced+sha` · `displaced` 를 `rootFiles` 로 낸다(install-writes.ts:236-247) |
| 설치자가 `--without` 으로 뺀 것 | 갱신하지도 만들지도 않는다 | 같음 | 대상 선정에서 거른다(§5.2) — install 과 같은 자리(installer.ts:1150) |
| 링크 너머가 프로젝트 밖 | 쓰지도 백업하지도 기록하지도 않고 알린다 | 같음 | writer 의 `outside.skip`(install-writes.ts:201) |
| 남의 도구 슬롯(`.claude/skills/<id>` 링크·FIFO) | 건드리지 않고 알린다 | 같음 | `occupiedByNonDirectory` · `foreignOwnedTarget` 은 판정이 아니라 자리 술어 — 대상 선정에 그대로(감사 "남겨야 하는 것" 표) |
| 번들 밖 스킬 파일(#477) | 기록 sha 그대로면 삭제 · 아니면 백업 뒤 삭제 · `displaced` 아님 | 같음 | `syncSkills` 의 prune 분기는 judge 밖에 그대로(설계 2026-09-27 §370 결정) |
| 은퇴 룰 회수(`pruneOrphans`) — 기록(sha)에 있는 파일 | 안 고쳤으면 삭제 · 고쳤으면 백업 뒤 삭제 · displaced 자리는 원본 되돌림 | 같음(PR-B 뒤에도 — §5.5 표) | `judge(remove)` sha 행 = 오늘의 `owned` 식과 결과 동일 |
| 옛 판(체크섬 이전) 하네스 파일 · 내용 다름 | 1회 백업 "no checksum on record — saved a copy once" | 같음 | `no-sha` 행(judge.ts:171-175) |
| `--only hooks` 등 부분 갱신 | 고른 묶음만 | 같음 | `wants(group)` 는 대상 선정의 필터(§5.2) |
| 로그 없는 설치본 | CLI 가 update 를 거절(#699) | 같음 | 엔진에서도 `.claude/` 단계를 건너뛴다(§5.3 — `installNewAssets` 가 이미 그 규칙, update-mode.ts:1392-1394) |

### 1.2 바뀌는 동작 — 전부 열거

| # | 장면 | 전 | 후 | 판정 |
|---|---|---|---|---|
| ① | 기록에 있는 **opt-in** 스킬 폴더를 설치자가 지운 뒤 update | 되살리지 않는다 — `syncSkills` 는 디스크에 있는 폴더만(update-mode.ts:2429) · `installNewSkillDirs` 는 릴리즈 기본만(:1566-1570) | **되살린다** "was missing — restored"(+ `--without` 안내) | **받아들인다 — 결정 이행.** ADR-099 R2 "손으로 지운 것은 빼기가 아니다", ADR-097 D2 "update 대상 = 기록 항목 + 릴리즈 신규". 외부 CLI 자리(`.agents/skills`)는 이미 그렇게 한다(owned-write.ts:216-220). 비대칭 해소 |
| ② | 하네스 파일을 지운 뒤 (옛 판이 재스캔으로 기록에서 그 항목을 지운 상태에서) update | 재스캔이 지운 파일을 기록에서 뺐다 → 다음 update 가 "added by this release" | 기록은 누적(`mergeExternalFiles`) → "was missing — restored" | **받아들인다 — 더 정직.** 지운 것을 "릴리즈가 더했다" 고 말하던 것이 고쳐진다. 이미 기록을 잃은 설치본은 다음 update 1회에 다시 적힌다 |
| ②′ | 기록에 있는 `.uzys-agent-harness/*.sh` 헬퍼를 지운 뒤 update (PR-A 구현 중 발견) | 헬퍼 기록을 보지 않고 "added by this release" | "was missing — reinstalled" | **받아들인다 — ②와 같은 이유.** 그 판에 헬퍼가 없었던 설치본(기록에도 없음)은 지금처럼 "added by this release". docker `update-new-assets` ① 의 준비 단계를 실제 옛 기록 모양(헬퍼 기록도 없음)으로 고쳤다 |
| ②″ | writer 기록에 헬퍼 항목이 없는데 디스크 헬퍼 내용이 다를 때 update (PR-A 리뷰 HIGH ⓐ) | "no checksum" 백업 1회 | 첫 접촉 문구("yours, put back on uninstall") + 백업 · 디스크 결과 같음 | **받아들인다 — 판정이 install 과 같아졌다.** 단 uninstall 이 `.uzys-agent-harness/` 를 폴더째 지워 그 약속을 지키지 못하는 것은 v26.162.0 부터 install 경로에 있던 별도 결함(이슈) |
| ②‴ | `update --only new-skills` 에서 링크 슬롯을 건너뛸 때 (리뷰 HIGH ⓑ) | 행 없음 | "skipped link" 행 — 사실 | **받아들인다** |
| ③ | 옛 판(≤v26.125, 스캔 필드 없음)의 **은퇴 룰·훅·에이전트** 가 디스크에 있을 때 update (PR-B) | 첫 update: `retiredClaims` 로 기록에 이어 적기만 · **두 번째** update 가 백업 뒤 치움 | **첫 update** 가 백업 뒤 치운다 | **받아들인다 — 한 번 일찍, 보호 같음.** `recorded()` 가 그 자리를 `no-sha` 로 읽어(recorded.ts:183) `backup+remove`. v26.170 설계 §1 행 6 의 "지금과 같다" 는 요구가 아니라 관측이었다 |
| ④ | 옛 스캔(v26.132–161)이 적었지만 `recorded()` 필터가 "기록 없음" 으로 읽는 항목(기록 트랙 밖 템플릿 이름의 설치자 파일)이, 그 템플릿이 번들에서 빠졌는데 `RETIRED_PATHS` 에는 없을 때 (PR-B) | `pruneOrphans` 가 raw `policyFiles` 로 `baseline.has` → sha 가 같으면 **백업 없이 삭제**(update-mode.ts:2744-2752) | `recorded() === none` → 남긴다 | **받아들인다 — 손실 경로 폐쇄.** 지금은 보호가 손목록(45항목)의 완전성에 걸려 있다. 남는 파일은 설치자 것이고, 옛 바이트면 uninstall 의 지문(ADR-111)이 처리한다 |
| ⑤ | 옛 판(≤v26.125)에서 **훅 스크립트를 지운** 뒤, 옛 update 가 재스캔으로 기록에서 뺐고 `settings.json` 몫(`hooks.<E>#<script>`)만 남은 상태의 update | `wiredBefore` 휴리스틱(update-mode.ts:1405-1410)이 "was missing — restored" | "wrote (new in this release)" | **감수 — 1회 문구.** 디스크 결과 같음 · 그 뒤 기록이 맞아 다시는 안 생긴다. 이 상태를 만드는 재스캔이 사라지므로 새로 생기지 않는다. 다른 파일의 기록(함께 쓰는 파일의 키)으로 이 파일을 말하는 교차 추론은 재스캔 버그에만 필요했다. 대안(§9 의심 7) |
| ⑥ | CLI 중립 헬퍼(`.uzys-agent-harness/*.sh`)가 **프로젝트 안**을 가리키는 심링크일 때 | 건너뛰고 `helpersKept` 행(update-mode.ts:2821-2824) | install 과 같은 규칙 — 링크를 따라 판정·쓰기(밖이면 `outsideLinks` 행) | **감수 — "한 원칙".** install 은 모든 하네스 파일을 그렇게 쓴다(writer 에 lstat 분기 없음). `helpersKept` 필드·행 삭제. 확인 테스트 = `tests/update-pipeline-scope.test.ts:139`(#597 링크) 재작성 |
| ⑦ | 옛 판(≤v26.125) 로그에서 **없는** 파일 자산을 update 가 만들 때의 문구 | `installNewAssets`: 기준선 비어 "added by this release"(:1398-1416) | `judge` 가 `no-sha · 디스크 없음` 을 sha 칸으로 읽어 **"was missing — restored"** 가 될 자리 → **표에 행을 더해 "wrote (new in this release)" 로 고정**(§5.6) | 행 추가 = 문구 유지. 기록이 열거하지 못하는 파일의 부재는 되살림의 근거가 아니다(ADR-096 D6 — 디스크 존재/부재는 "안 만든다" 의 근거로만) |
| ⑧ | `--only new-skills` 를 **스캔 필드 없는** 옛 로그에 돌린 뒤의 다음 update | `recordNewSkillBaseline` 이 조기 반환(:1604) — 부분 `skillFiles` 를 만들지 않아 다른 스킬이 첫 접촉으로 읽히는 것(#761 B-2)을 피함 | writer 는 새 스킬 파일을 적는다 → `skillFiles` 가 생긴다 → `scanFieldOf` 를 **스킬 폴더 단위**로 고쳐(§3.3) 다른 스킬은 여전히 `no-sha` | 결과 같음(B-2 가 구조로 해소). 이것을 안 고치면 다음 update 가 옛 하네스 스킬을 첫 접촉으로 백업·`displaced` 하고 uninstall 이 **옛 하네스 파일을 제자리로 되돌리는** 회귀가 난다 — 설계 필수 항목 |

화면 필드는 PR-A·B·797 에서 그대로다 — `updated` · `installedNew` · `restored` · `policyBackedUp` · `skillsBackedUp` · `displaced` · `displacedSame` · `noChecksum` · `backups` 는 writer 원장에서 같은 뜻으로 채운다(§5.4). 사라지는 필드는 `helpersKept` 하나(⑥).

---

## 2. 덧댄 경우 7(+1) — 구조로 사라지는 것 · 데이터로 남는 것

감사 §1 표의 경우마다 "왜 생겼나 → 새 구조에서 생길 수 있나" 를 적는다. 원리 하나: **재스캔은 "디스크에 있는 것 = 하네스가 쓴 것" 이라 읽어서 예외가 필요했고, writer 는 "방금 쓴 것만" 적으므로 예외의 입력 자체가 없다.**

| 덧댄 경우 | 어디 | 출처 | 새 구조 | 왜 |
|---|---|---|---|---|
| 이번에 동기화한 폴더만 다시 찍기(`dirs`) | `refreshPolicyBaseline` :2623 | #480 | **사라진다** | 재스캔이 없다. 원장에는 이번에 판정한 경로만 있고, 안 돈 묶음의 기록은 `mergeExternalFiles` 가 그대로 둔다 |
| 밖 링크는 다시 찍지 않기(`outside` · `outsidePaths`) | :2625 · :2660-2677 | #678 | **사라진다** | writer 가 밖이면 판정 전에 멈춰 기록하지 않는다(install-writes.ts:201). 화면은 `ledger.outside` 가 말한다 |
| 첫 접촉인데 같아서 둔 설치자 파일을 적지 않기(`notOurs` · `notOursUnder`) | :2627 · :2554-2568 | #761 Q3 | **사라진다** | judge 의 `record: "displaced"`(sha 없음) 가 곧 그 뜻이다 — writer 는 `rootFiles` 에만 적고 `policyFiles` 에 안 적는다(install-writes.ts:244-245) |
| 뺀 파일·스킬은 앞 기록 유지(`isBaselineExcluded` · `keepPrior`) | :2633 · :2695 | ADR-099 R3 | **사라진다** | 뺀 것은 대상 선정에서 빠져 writer 에 가지 않는다 → 원장에 없음 → 병합이 앞 기록을 둔다. "유지" 가 기본값이 된다 |
| 갱신 대상 스킬만 적기(`targets`) | :2690 · :2697 | #761 | **사라진다** | 대상 선정이 writer 호출을 정하므로 "대상 아닌 것을 적지 않기" 가 따로 필요 없다 |
| 필드 없는 옛 로그에 부분 `skillFiles` 를 만들지 않기(조기 반환) | `recordNewSkillBaseline` :1604 | #761 B-2 | **사라진다 — 단 `scanFieldOf` 스킬 단위(§3.3)와 함께** | 그 경우가 보호하던 것은 "필드가 생기면 다른 스킬이 첫 접촉으로 읽힌다" 였다. 읽는 쪽(`recorded()`)이 스킬 폴더 단위로 보면 부분 기록이 다른 스킬을 말하지 않는다 — 기록을 고치지 말고 잘못 읽는 쪽을 고친다(메모리 "기록에 읽는 곳이 여럿이면…") |
| 옛 로그가 하네스 것으로 읽던 은퇴 자리 이어 적기(`retiredClaims`) | :2645 | PR-D 재리뷰 BLOCKER-1 ② | **데이터로 남는다 — 단 실행 시작 때 한 번 계산** | 기록이 열거하지 못하는 자리를 기록으로 승격하는 **유일한 길**이다(uninstall 이 그 자리를 치우는 근거). 재스캔과 무관하게 필요하다. 시작 스냅숏으로 바꾸면 아래 "순서 강제" 가 함께 사라진다 |
| 단계 순서 강제(새 자산 → 재스캔 · 되돌리기 → 재스캔 뒤) | :585-588 · :652-653 · `tests/displaced-restore-all-removes.test.ts:138,148` | #283 · #782 | **사라진다** | ⓐ 새 자산과 기존 자산이 **한 패스**에서 같은 writer 를 지난다(`justWritten` 불요) ⓑ `retiredClaims` 를 시작 때 계산하면 되돌린 설치자 파일을 뒤늦게 하네스 것으로 적는 길(#788 MEDIUM-1)이 구조적으로 없다 — 되돌리기가 기록 쓰기보다 앞이든 뒤든 같다 |

추가로 함께 사라지는 사본: `refreshNeutralHelpers`(update-mode.ts:2799-2862) — 헬퍼 전용의 네 번째 판정 사본("기록 sha 그대로 → 교체 · 다르거나 기록 없음 → 백업 뒤 교체" = judge 의 sha/no-sha 행). 헬퍼는 writer 가 `.claude/` 밖 경로를 `externalFiles` 로 적는 규칙(install-writes.ts:195)을 이미 갖고 있어 **같은 루프에 넣으면 끝**이다. `installNewAssets` 가 결측 헬퍼를 만들던 몫도 같은 루프가 맡는다(만들기 = `create`).

남겨야 하는 복잡성(재제안 방지): `foreignOwnedTarget` · `occupiedByNonDirectory` · `linksToProjectSharedSkill`(자리 술어 — 감사 표) · #477 prune(judge 밖, 설계 §370) · `excludedSkillOf` · `isBaselineExcluded`(대상 선정 입력) · `splitTrackFilled`(화면 분류) · `retiredClaims`(위) · `withoutLostBackups`(두 기록 쓰기 자리에서 같은 규칙 — `refreshExternalCli` 도 쓴다).

---

## 3. 옛 기록 모양과 writer — 손실 경로가 없음을 보인다

### 3.1 기록 모양(실측 — `796-one-writer-evidence/record-shapes-observed.md`)

| 모양 | 판 | `.claude/` 파일의 `recorded()` 상태(현행 코드, 바뀌지 않는다) |
|---|---|---|
| S0 | v26.83–123 — 스캔 필드 · `rootFiles` 없음 | 기록 트랙 대상 · 은퇴 경로 → `no-sha`(recorded.ts:196-201) · 그 밖 → `none` |
| S1 | v26.124–125 — `rootFiles` 만 | 같음 |
| S2 | v26.126–131 — `skillFiles` 만 | 정책 파일 → `no-sha` · 스킬: 적힌 파일 → 필터 통과 시 `sha` · 안 적힌 스킬 파일 → `scanFieldOf` present → `none` |
| S3 | v26.132 — + `policyFiles` | 적힌 것 → `sha`(필터 통과) · 은퇴 자리 → `no-sha` · 안 적힌 것 → 그 폴더에 항목이 있으면 `none`, 없으면 `no-sha` |
| S4 | v26.133–161 — + `externalFiles` | 같음 |
| S4′ | S0–S4 를 현행 판이 update 한 뒤 — 필드가 재스캔 값으로 채워졌고 `records` 없음(26.150.0-A record-2 실측) | S3/S4 와 같다 |
| S5 | v26.162+ install — `records:"writer"` | 필터 없음 — 적힌 것 `sha` · 안 적힌 것 `none` |

### 3.2 writer 의 쓰기 = 기록 — 모양별 결과(바뀌는 것은 "기록을 어떻게 적나" 뿐)

| `recorded()` | 디스크 | judge(write) | 기록에 적는 것 | 설치자가 잃는 것 |
|---|---|---|---|---|
| `none` | 없음 | `create` | `sha`(next) | 없음 |
| `none` | 같음 | `leave` | `displaced`(sha 없음) | 없음 — 하네스 것으로 삼지 않는다 |
| `none` | 다름 | `backup+overwrite` | `displaced+sha` | 없음 — 원본은 백업, 하네스가 떠날 때 되돌림 |
| `no-sha` | 없음 | `create` | `sha` | 없음 (§5.6 행 추가 = 문구만) |
| `no-sha` | 같음 | `leave` | `sha` | 없음 |
| `no-sha` | 다름 | `backup+overwrite`("no checksum") | `sha` | 없음 — 1회 백업 |
| `sha` | 없음 | `create`("restored") | `sha` | 없음 |
| `sha` | = next | `leave` | `sha` | 없음 |
| `sha` | = 기록 | `overwrite` | `sha` | 없음 — 하네스 바이트였다 |
| `sha` | ≠ 기록 | `backup+overwrite`("edited") | `sha` | 없음 — 편집은 백업 |

**적는 sha 는 언제나 `next`(이번에 쓴 하네스 바이트)의 sha 다**(install-writes.ts:238,241 `hashContent(next)`). 디스크 바이트를 기록으로 승격하는 자리가 **코드에 없다** — 재스캔의 손실 경로(B2 · #678 · #761 Q3)는 "디스크 바이트 → 기록" 이라는 전제가 필요했고 writer 에는 그 전제가 없다. writer 에 가지 않는 파일(뺀 것 · 밖 링크 · 남의 슬롯 · 안 고른 묶음)은 기록이 바뀌지 않는다.

### 3.3 `recorded()` 한 곳 수정 — `scanFieldOf` 의 스킬 단위

> **철회(2026-10-14, #813)**: 스킬 폴더 단위 읽기는 26.170.0 대비 회귀(손으로 만든 하네스 이름 스킬 폴더가 `displaced` 없이 덮임 · opt-in 이름 폴더를 uninstall 이 치움)를 만들어 되돌렸다. 스킬 기록은 다시 필드 단위로 읽고, ⑧ 은 쓰기 쪽(필드가 없던 기록에 부분 `skillFiles` 를 만들지 않는다)이 막는다 — ADR-097 Consequences · `docs/plans/796-reviews/skill-read-review.md`.

지금(recorded.ts:222): `.claude/skills/` 는 `skillFiles` 필드의 **존재**를 "다 훑은 기록" 으로 읽는다(옛 `collectSkillHashes` 가 `.claude/skills/` 전부를 한 번에 적었기 때문). writer 는 스킬 **폴더 단위**로 적으므로(한 스킬의 모든 파일을 같은 실행에서 판정) 읽기 단위도 폴더로: `present(skillFiles.some(f => f.path.startsWith(`${id}/`)))`. 정책 파일이 이미 `POLICY_DIRS` 폴더 단위인 것(recorded.ts:225-228)과 같은 모양이다.

영향 대조: ⓐ S2–S4 옛 스캔은 깔린 스킬마다 항목이 있으므로 폴더 단위로 읽어도 같은 답 ⓑ `tests/recorded.test.ts:144-151`(B-2 — 필드 없음 → `no-sha`) 그대로 ⓒ `tests/uninstall-legacy-scan.test.ts:102`(BLOCKER-1 — 폴더 안 설치자 노트) 그대로(`isTarget` 이 거른다) ⓓ 새로 보호되는 장면 = §1.2 ⑧.

### 3.4 `retiredClaims` — 실행 시작 스냅숏

`claimsAtStart = log.records === "writer" ? [] : retiredClaims(logAtStart, projectDir, logAtStart.policyFiles ?? [])` 를 **`.claude/` 단계가 디스크를 만지기 전**에 계산하고, 기록 쓰기(§5.4)에서 `pruned` 에 든 경로를 빼고 더한다. 지금 코드는 재스캔 시점(되돌리기 **전**)에 계산해야만 했고 그래서 순서가 묶였다(update-mode.ts:652-653 주석 · #788 MEDIUM-1). 스냅숏은 "옛 기록이 시작 상태에서 무엇을 말했나" 라는 뜻과도 맞는다.

### 3.5 `records: "writer"` 표시 — update 는 적지 않는다(현행 유지)

표시의 뜻은 "필드가 하네스 파일을 **다** 열거한다" 이고, update 는 고른 묶음(`--only`)만 돈다. 적는 규칙을 "전부 돌았을 때만" 으로 두면 경우가 하나 늘고, 안 적으면 다음 install 까지 옛 필터가 그대로 걸린다 — 오늘과 같다(26.150.0-A record-2 가 `records` 없음을 보인다). uninstall 은 표시가 없으면 `recordedTrackSpots` 후보를 더해 `recorded()` 로 가른다(uninstall.ts:1746) — writer 가 적은 항목이든 재스캔이 적은 항목이든 같은 길이다.

### 3.6 지문(ADR-111)과의 관계

update 는 지문을 쓰지 않는다(ADR-111 결정 5 — 은퇴 스킬·커맨드·옛 앵커는 안내만). 이 설계도 그대로다. 지문 회수는 uninstall 만.

---

## 4. #797 — owned-write 의 인라인 판정 → `judge()`

### 4.1 탐침(실행 확인 — `796-one-writer-evidence/probe-797-owned-write-nosha.md`)

`createOwnedWriter(dir, new Map(), { owned: () => true, refreshOnly: true })` 에 디스크 "old" · next "new":
`backedUp: [".agents/skills/x/SKILL.md"]` · 백업 1 · 기록 sha(next). 대조군(기준선 sha = 디스크): `backedUp: []` · 백업 0.

→ **코드 수준에서 이슈의 의심은 맞다**: 체크섬 없는 옛 기록(`owned` 참 · 기준선 없음)의 파일이 `backedUp`("편집" 묶음, owned-write.ts:235-242)에 든다. judge 라면 `no-sha` 행 → "no checksum on record — saved a copy once".
→ **설치자가 보는 문구는 지금도 틀리지 않는다**: update 화면은 `checksumOnRecord(logAtStart)` 로 `externalBackedUp` 을 다시 갈라 "no checksum on record" 행으로 낸다(install-render.ts:1013 · 1372 · update-mode.ts:1086-1102); install 화면은 외부 CLI 백업을 `backup <경로>` 중립 행으로만 낸다(install-render.ts:1491-1495). 즉 **분류가 두 곳에 산다**(owned-write 의 묶음 + 렌더의 재분류)는 구조 문제이고, #797 은 그 한 곳을 없앤다.

### 4.2 매핑 — `write()` 가 하는 일을 judge 의 입력·출력으로

```ts
// owned-write.ts write(absPath, content, opts) — 판정 전 선검사는 그대로(자리 술어 · 대상 선택)
if (foreignOwnedTarget(...) !== null) return false;              // #343 그대로
if (outside.skip(absPath)) return false;                         // #678 그대로
const disk = existsSync(absPath) ? readFileSync(absPath, "utf8") : null;
const rec: Recorded = baseline.has(rel) ? { state: "sha", sha256: baseline.get(rel) }
                    : owned(rel) ? { state: "no-sha" } : { state: "none" };
// refreshOnly 의 생성 규칙(ADR-099 R2)은 판정이 아니라 대상 선택 — 호출부 규칙 그대로(오늘과 같은 조건)
if (disk === null && refreshOnly && !opts?.createInRefresh && !baseline.has(rel)) return false;
const j = judge({ op: "write", kind: "harness", rec, disk, next: content, run: refreshOnly ? "update" : "install" });
switch (j.verdict) {
  case "create": write(); updated++; if (refreshOnly && rec.state === "sha") restored.push(rel); break;
  case "overwrite": if (opts?.backupFirst) backup();           // #774 ADR-111 — 실행 방식, 판정 아님
                    write(); updated++; break;
  case "backup+overwrite": backup(); write(); updated++;
                    if (rec.state !== "none") backedUp.push(rel); break;   // 오늘의 묶음 그대로(sha · no-sha 둘)
  case "leave": break;
}
switch (j.record) {
  case "sha": written.set(rel, digest); journal?.file(...); break;
  case "displaced+sha": written.set(rel, digest); journal?.file(...); displace({ path: rel, change: "displaced", notes: [backupRel] }); break;
  case "displaced": displace({ path: rel, change: "displaced", notes: [] }); break;   // Q3 — 기준선에 안 싣는다
}
return true;
```

오늘의 표(owned-write.ts:107-117) 7행 ↔ judge 행 대응: 파일 없음→`create`(refreshOnly 생성 규칙은 위 선검사) · 내용 동일→`leave`(+sha) · 기준선 같다→`overwrite` · 기준선 다르다→`backup+overwrite`(sha) · 기록 없음·다르다→`backup+overwrite`(none → displaced+sha) · 기록 없음·같다→`leave`(displaced) · 기준선 없음·owned→`no-sha` 행. **`OwnedWriteResult` 모양은 바꾸지 않는다** — `backedUp` 에 `no-sha` 백업도 그대로 넣어 update 화면의 재분류(`checksumOnRecord`)가 오늘과 같은 말을 한다. 문구를 judge 의 `line` 으로 바꾸는 것은 PR-C(화면 통일)에서 `.claude/` 와 함께.

삭제: `isHarnessOwned`(install-log.ts:597-616, 호출부 owned-write.ts:235 하나 — tests 에 직접 호출 0). 주석(install-log.ts:611-613)이 말한 "술어는 하나만" 의 그 하나는 이제 `judge` 다.

### 4.3 음성 대조(이 PR 의 "없으면 실패하는" 테스트)

`tests/owned-write-judge.test.ts`(신설): 기준선 상태 3종(`sha` 같음/다름 · `no-sha` 같음/다름 · `none` 같음/다름 · 각 디스크 없음) × refreshOnly 2 를 돌려 ⓐ 디스크 결과 · 백업 수 · `files` · `displaced` · `backedUp` · `restored` 가 **judge 표가 말하는 것과 같다**를 단언한다. 변이: `rec` 조립에서 `owned(rel)` 분기를 빼면(`none` 으로) B-1 장면이 첫 접촉(displaced)으로 떨어져 실패 — `tests/recorded.test.ts:176-187`(B-1)과 짝.

---

## 5. 구조 — 구현자가 그대로 옮길 수 있게

### 5.1 `createInstallWriter` 확장(install-writes.ts) — PR-0

```ts
export function createInstallWriter(args: { projectDir; previousLog; excluded; now?; run?: "install" | "update" })
// harness(): judge({ ..., run: args.run })  — update 의 문구(restored · new in this release) 가 judge 에서 나온다
// ledger.writes: WriteEntry[]  — harness() 호출 **전부**(조용한 create · overwrite · leave 포함)
export interface WriteEntry { path: string; verdict: Verdict; record: RecordEffect; line: string; backup?: string; backupAbs?: string }
```
`judged`(알릴 것만)는 install 화면 호환으로 그대로 둔다. install 의 동작 변화 0(`run` 기본 install · `writes` 는 읽는 곳이 아직 없다).

### 5.2 update 의 대상 선정 — 함수 하나, 순수(디스크 읽기만)

```ts
/** update 가 이번에 쓸 하네스 파일 — 기록 항목 + 릴리즈 신규(excluded 제외), ADR-097 D2. 판정은 하지 않는다. */
function updateHarnessTargets(log: InstallLog, templatesDir: string, wants, outside, report): Array<{ path; source; unit: string; unitExisted: boolean }> {
  const excluded = excludedIds(log);
  const tracks = installedTracks(projectDir);
  const claude = installedClis(log).includes("claude");
  // ① 파일 자산(트랙 기본 · opt-in 무관 — trackOnlyFileAssets 그대로). settings.json 은 함께 쓰는 파일(2.5단계) · 앵커는 2단계
  for (const e of trackOnlyFileAssets(tracks)) {
    const group = e.target.startsWith(".claude/hooks/") ? "hooks" : "rules";          // #480 묶음 그대로
    if (!wants(group) || e.target === SETTINGS_TARGET || e.target === HARNESS_ANCHOR_FILE) continue;
    if (e.target.startsWith(".claude/") && !claude) continue;
    if (isBaselineExcluded(e.target, excluded)) continue;
    if (foreignOwnedTarget(projectDir, e.target) !== null) { report.foreignOwned.push(...); continue; }
    if (!existsSync(join(templatesDir, e.source))) continue;
    out.push({ path: e.target, source, unit: e.target, unitExisted: existsSync(abs) });
  }
  // ② 번들 스킬 — id 집합은 오늘과 같다(recordedSkillIds: skillFiles 필터 통과 id ∪ .agents/skills 기록 id ∪ 릴리즈 기본)
  if (claude) for (const id of recordedSkillIds(projectDir, log)) {
    if (excludedSkillOf(log)(id)) continue;
    const dir = `.claude/skills/${id}`;
    if (occupiedByNonDirectory(abs(dir))) { report.skillsSkippedLinks.push(id); continue; }   // 자리 술어 그대로
    if (foreignOwnedTarget(projectDir, dir) !== null) { ...; continue; }
    const existed = existsSync(abs(dir));
    if (existed ? !wants("skills") : !wants("new-skills")) continue;                       // 두 묶음의 뜻 = 폴더 유무
    // 없는 폴더는 **Claude 자리의 기록(skillFiles 필터 통과) 또는 릴리즈 기본**일 때만 만든다 — 공유 자리(.agents) 기록만으로는
    // 만들지 않는다(오늘과 같다: 그 기록은 "있는 폴더를 갱신해도 된다" 의 근거일 뿐). §1.2 ① 이 여기서 난다
    if (!existed && !claudeSlotRecordedOrDefault(id)) continue;
    for (const rel of listFilesRecursive(join(templatesDir, "skills", id))) {
      if (foreignOwnedTarget(projectDir, `${dir}/${rel}`) !== null) { ...; continue; }
      out.push({ path: `${dir}/${rel}`, source, unit: dir, unitExisted: existed });
    }
  }
  return out;
}
```
`outside` 는 writer 가 판정하므로 여기서 보지 않는다. `.uzys-agent-harness/*.sh` 는 ① 에 자연히 든다(`applies: all`, 묶음 "rules" — 오늘 `refreshNeutralHelpers` 와 같은 묶음).

### 5.3 `.claude/` 단계(`runUpdateMode` 1 · 1.5 · 3.8 단계가 하나로)

```
0. logAtStart === null → 이 단계 전체 건너뜀(기록 날조 금지 · CLI 도달 불가 #699). claudeManaged 게이트는 ① 안에서 경로별로.
1. claimsAtStart = retiredClaims(logAtStart, …)   // §3.4 — 디스크를 만지기 전
2. writer = createInstallWriter({ projectDir, previousLog: logAtStart, excluded: adapterExcluded(...), run: "update" })
   isTarget = recordedTrackTargets(logAtStart)
   for (t of updateHarnessTargets(...)) writer.harness(t.path, { source: t.source }, { isTarget })
   chmod hooks (오늘과 같다)
3. 은퇴 회수 — POLICY_DIRS 마다 pruneOrphans(…)  (PR-A: 오늘 그대로 · PR-B: §5.5)
   #477 — 대상 스킬 폴더의 번들 밖 파일 정리(syncSkills 의 prune 블록을 함수로 떼어 그대로)
4. prunedRestored = restoreDisplaced(logAtStart, …, { has: prunedPaths })   // 순서 자유 — §3.4
5. recordHarnessWrites(projectDir, writer.ledger(), { claimsAtStart, prunedPolicy, prunedSkill, restored: prunedRestored })  // §5.4 — 기록 쓰기 한 번
6. report 필드 ← ledger.writes (§5.4 아래 표)
```
2.5(함께 쓰는 파일) · 3(죽은 훅 참조) · 4(외부 CLI) 단계는 손대지 않는다 — 5 가 2.5 보다 앞이라 뒤 단계가 읽는 기록은 오늘과 같은 시점의 것이다.

### 5.4 기록 쓰기 한 함수 + 화면 필드 유도

```ts
function recordHarnessWrites(projectDir, ledger: WriteLedger, x: { claimsAtStart; prunedPolicy: Set<string>; prunedSkill: Set<string>; restored: DisplacedOutcome[] }) {
  const log = readInstallLog(projectDir); if (!log) return;                    // 날조 금지 (앞 단계가 다시 썼을 수 있어 여기서 읽는다)
  const policy = mergeExternalFiles(log.policyFiles, ledger.policyFiles).filter(f => !x.prunedPolicy.has(f.path));
  const claims = x.claimsAtStart.filter(c => !x.prunedPolicy.has(c.path) && !policy.some(p => p.path === c.path));
  const skills = mergeExternalFiles(log.skillFiles, ledger.skillFiles).filter(f => !x.prunedSkill.has(f.path));
  const external = mergeExternalFiles(log.externalFiles, ledger.externalFiles);     // 헬퍼
  const roots = withoutRestored(mergeRootFiles(log.rootFiles, withoutLostBackups(log.rootFiles, ledger.rootFiles)), x.restored);
  writeInstallLog(projectDir, { ...log, policyFiles: [...policy, ...claims] | 삭제, skillFiles | 삭제, externalFiles | 삭제, rootFiles: roots });  // try/catch 오늘과 같다
}
```
`mergeExternalFiles` 규칙(같은 경로면 이번 값 · 사라진 것도 남긴다 — ADR-099 R2)이 네 필드에 같다 = install 의 `composeWriterLog` 와 같은 규칙(install-writes.ts:580-586). 다른 점은 `inheritScanned` 필터와 `records` 표시를 **하지 않는 것**(§3.5) — 그래서 `retiredClaims` 를 여기서 직접 더한다.

| 화면 필드 | 유도(`w ∈ ledger.writes`, `changed = w.verdict !== "leave"`) |
|---|---|
| `updated[label]` | `changed && !(w.verdict === "create" && !unitExisted)` 를 label(`.claude/rules` · `.claude/skills` · 헬퍼 경로)로 센다 — 기존 단위 안의 새 파일(`create`)은 오늘처럼 `updated` 에 |
| `installedNew` / `restored` | 단위(파일 · 스킬 폴더)가 이번에 **처음 생겼을 때**(`!unitExisted`) 한 줄: 그 단위 writes 중 `line === LINES.restored` 가 하나라도 있으면 `restored`, 아니면 `installedNew` |
| `policyBackedUp` / `skillsBackedUp` | `w.verdict === "backup+overwrite" && w.record === "sha"`(= 기록 있던 자리: 편집 · 체크섬 없음 둘 — 오늘의 묶음) |
| `displaced` / `displacedSame` | `w.record === "displaced+sha"` / `"displaced"` |
| `noChecksum` · `backups` | 오늘 그대로(`collectRunBackups` + `checksumOnRecord(logAtStart)`) — 외부 CLI · 앵커 백업까지 한 자리에서 가르는 함수라 PR-C 에서 judge 의 `line` 으로 바꾼다 |
| `foreignOwned` · `skillsSkippedLinks` · `outsideLinks` | 대상 선정 · `ledger.outside` |
| `helpersKept` | **삭제**(§1.2 ⑥) |

### 5.5 `pruneOrphans` → `judge(remove)` (PR-B)

```ts
for (file of readdirSync(target)) if (ext 맞고 && !existsSync(sourceFile)) {
  const rec = recorded(log, projectRel, { isTarget });  if (rec.state === "none") continue;   // 설치자 파일
  if (outside.skip(targetFile)) continue;
  const j = judge({ op: "remove", kind: "harness", rec, disk, next: null });                  // 은퇴 자리는 템플릿이 없다 → next null
  if (j.verdict === "backup+remove") backupFile(targetFile, now);
  unlinkSync(targetFile); removed.push(file);                                                // j.record === "forget" → 기록에서 뺀다(§5.4 pruned)
}
```
| 기록 상태 | 디스크 | 오늘(`baseline.has` + `owned` 식, :2742-2752) | judge(remove) |
|---|---|---|---|
| raw 항목 없음 · `recorded()` none | — | 건너뜀 | `leave` — 같음 |
| raw 항목 없음 · `recorded()` no-sha(S0/S1 은퇴 자리) | — | 건너뜀(다음 실행에 `retiredClaims` 뒤 회수) | `backup+remove` — §1.2 ③ |
| raw 항목 있음 · `recorded()` none(필터에 걸린 옛 스캔) | = sha | **백업 없이 삭제** | `leave` — §1.2 ④ |
| `sha` | = sha | 삭제 | `remove` — 같음 |
| `sha` | ≠ sha | 백업 뒤 삭제 | `backup+remove` — 같음 |
| `no-sha`(은퇴 · 이어받은 claims) | — | 백업 뒤 삭제 | `backup+remove`(next null → "다르다") — 같음 |
삭제: `PolicySyncCtx.baseline` · `policyBaseline` · `baselineRecord`. `pruneOrphans` 의 "기록이 없으면 아무것도 지우지 않는다"(:2718-2720)는 `recorded(null) === none` 이 그대로 보장한다.

### 5.6 judge 표에 행 하나(Minor CR — `one-principle-design-2026-09-27.md` §1.2 표 + ADR-097 Consequences 한 줄)

| kind | 기록 | 디스크 | `op: write` | `op: remove` |
|---|---|---|---|---|
| harness | **no-sha** | **없음** | `create` · 문구 install "wrote" · update **"wrote (new in this release)"** · 기록 `sha` | 기록만 정리(`keep` — 지금 코드 그대로, judge.ts:185) |

지금 코드는 이 칸을 sha 칸으로 접었다(judge.ts:159-163 주석 "표에 행이 없다"). sha 칸은 "기록이 그 파일을 열거하는데 없다 = 설치자가 지웠다 → restored" 인데 `no-sha` 는 **열거하지 못하는** 기록이라 부재가 되살림의 근거가 못 된다(ADR-096 D6). 오늘 `installNewAssets` 는 이 자리를 "added by this release" 로 말했고(§1.2 ⑦) 이 행이 그 문구를 지킨다. `tests/judge.test.ts` 에 행 추가(음성 대조: 행을 빼면 update 문구가 restored 로 바뀌어 실패).

---

## 6. PR 분할 — main 기준 · 스택 없음 · 앞 것이 머지된 뒤 `git merge main`

| PR | 내용 | 삭제 → 추가(src) | 문턱(ADR-094) | 완료 기준(명령) | 없으면 실패하는 테스트 | 적대적 옛 판 실설치 |
|---|---|---|---|---|---|---|
| **PR-0** 준비 | writer `run` 옵션 + `ledger.writes`(§5.1) · judge 행 추가(§5.6) · `scanFieldOf` 스킬 단위(§3.3) · 설계 표 · ADR-097 Consequences 한 줄 | 0 → ≈ 30 | 아래(리그레션) — install 동작 변화 0 | `npm run ci` · `npx vitest run tests/judge.test.ts tests/recorded.test.ts tests/install-writes.test.ts tests/uninstall-legacy-scan.test.ts` | judge.test 새 행(빼면 restored 문구) · recorded.test 신규 "skillFiles 에 다른 스킬만 있으면 이 스킬은 no-sha"(스킬 단위 안 고치면 none) · install-writes.test "writes 가 조용한 create 도 담는다" | 불요 |
| **PR-A** update `.claude/` + 헬퍼 → writer | §5.2 · §5.3 · §5.4 · 삭제 목록(§7 표 A) · `installNewAssets` · `installNewSkillDirs` · `refreshNeutralHelpers` · 재스캔 3 · `judgedUpdateWrite` 등 · `collect*Hashes`(install-log) · 테스트 재작성 | ≈ 690 → ≈ 230 | **위**(update 덮어쓰기·백업·기록) — 독립 리뷰 2종(설계 이행 + 손실 탐색) | `npm run ci` · 영향 범위 전체(문서·자산 규칙과 같이 **전체** 스위트) · `bash scripts/check-absence.sh --canary 'judge(' 'collectPolicyHashes\|collectSkillHashes\|refreshPolicyBaseline\|refreshSkillBaseline\|recordNewSkillBaseline\|judgedUpdateWrite\|refreshNeutralHelpers\|notOursUnder\|outsidePaths' src` → 0 · docker `bash test/docker/run.sh update-skills` · `update-new-assets` · `policy-preserve` · `update-respects-without` · `update-external` · `uninstall` | ⓐ §1.2 ① "기록된 opt-in 스킬 폴더를 지운 뒤 update → 되살림 + restored 줄"(지금 코드: 폴더 없음) ⓑ §1.2 ② "지운 룰이 update 뒤에도 기록에 남는다(R2)" ⓒ §1.2 ⑧ "S0 로그 + `--only new-skills` → 다음 update 가 옛 스킬을 첫 접촉으로 읽지 않는다(no checksum 행 · displaced 없음)" ⓓ 순서 자유: `displaced-restore-all-removes.test.ts` ①′ 가 되돌리기와 기록 쓰기 순서를 바꿔도 통과(주석 :138·:148 삭제) ⓔ 기존 리그레션: update-mode.test "연속 update 가 백업본을 쌓지 않는다"(:1850) · policy-file-ownership · legacy-log-claude-dir · update-restores-shared · outside-link-writes · explicit-exclusion R3 | **필요** — `docs/plans/v26.170.0-design-evidence/container/run-old.sh` 를 26.100.0 · 26.125.0 · 26.132.0 · 26.150.0 · 26.161.0 으로 재실행(이미지 태그 `uzys-d796-a`). 판정: MINE 표식 전부 라이브 또는 `.backup-` 에 생존 · update 뒤 기록에 MINE 파일 경로 0 · `records` 없음 · 은퇴 claims 존재 · update 2회차 백업 0(안정) · uninstall 뒤 하네스 바이트 0 |
| **PR-B** `pruneOrphans` → judge(remove) | §5.5 · `policyBaseline` · `PolicySyncCtx.baseline` · `baselineRecord` 삭제 · forget 반영 | ≈ 40 → ≈ 15 | **위**(삭제 경로) — 독립 리뷰 + 손실 탐색(A 와 같은 스크립트, 은퇴 자리 집중) | `npm run ci` · check-absence `policyBaseline\|baselineRecord` → 0 · docker `update-new-assets` · `uninstall` | ⓐ §1.2 ③ "S0 로그 + 은퇴 경로 파일 → 첫 update 가 백업 뒤 치운다"(지금: 남는다) ⓑ §1.2 ④ "필터에 걸린 옛 스캔 항목 · sha 같음 · 템플릿 없음 · RETIRED_PATHS 밖 → 남는다"(지금: 백업 없이 삭제 — **변이 대조로 손실을 눈으로 본 뒤** 고친다) ⓒ 기존 policy-file-ownership `pruneOrphans` 3건을 runUpdateMode 경로로 | **필요**(26.100.0 · 26.125.0 집중) |
| **PR-797** owned-write → judge | §4.2 · `isHarnessOwned` 삭제 · 계약 테스트(§4.3) | ≈ 40 → ≈ 25 | 위(외부 CLI 파일의 백업 규약) — 독립 리뷰 1종; 결과 모양 불변이라 실설치 탐색은 **A 의 실행 결과 재사용**(26.140.0 · 26.150.0 의 외부 산출물 백업 수 전/후 동일 확인) | `npm run ci` · `npx vitest run tests/cli-shared-files.test.ts tests/codex tests/external-cli-update.test.ts tests/recorded.test.ts` · check-absence `isHarnessOwned` → 0 | §4.3 계약 테스트(owned 분기 변이) | A 결과 재사용 |
| **PR-C** 화면 통일(감사 §3 — 이 문서 범위 밖, 방향만) | `UpdateModeReport.writes` → `judgedRow` · `checksumOnRecord` 삭제 · `OwnedWriteResult` 에 judge `line` · 영역별 분기 축소 | (미측정) | 아래(화면만) | `npm run ci` + 화면 픽스처 | — | 불요 |

**순서**: PR-0 → PR-A → (PR-B ‖ PR-797 — 다른 파일) → PR-C. PR-0 과 PR-797 은 PR-A 와 독립이지만 PR-A 가 `run` · `writes` 를 쓰므로 PR-0 이 먼저다. 한 PR 이 열려 있는 동안 같은 파일(`update-mode.ts`)을 고치는 다음 PR 을 열지 않는다(메모리 "스택 PR 은 쓰지 마라").

**테스트 재작성 범위(PR-A)**: 엔진 함수를 직접 부르는 단위 테스트 — `tests/update-mode.test.ts` `updateDir`(:59-98) · `pruneOrphans`(:99-168, PR-B) · `syncSkills`(:1587-1849) · `스킬 기준선 갱신`(:1850-1931) · `tests/policy-file-ownership.test.ts` :34-149 · :263-283 — 는 **같은 단언을 `runUpdateMode` + 심은 기록**으로 다시 쓴다(판정 단언은 `tests/judge.test.ts` 가 행마다 이미 갖고 있으므로 중복은 지운다). `collectPolicyHashes 기준선`(:150-195) · `collectSkillHashes` 단언(update-mode.test :1733-1758)은 함수가 사라지므로 삭제. 로그 없이 `runUpdateMode` 를 불러 `.claude/` 갱신을 단언하는 테스트(E2E 47건 중 기록을 심는 14건 밖)는 기록을 심거나, 앵커 이행 전용(ADR-060 — 로그 없음이 전제, 바뀌지 않는다)이면 그대로.

---

## 7. 크기 — 실측과 추정을 가른다

**실측(삭제 · doc 주석 포함, `796-one-writer-evidence/function-spans.txt` — 다음 함수 시작까지의 줄 수라 뒤따르는 doc 이 섞인 근사)**

| 표 A — PR-A | 줄 | 처리 |
|---|---|---|
| `installNewAssets` 1378-1482 | 105 | 삭제 → 대상 선정 ①(≈ 25) |
| `installNewSkillDirs` 1545-1594 | 50 | 삭제 → 대상 선정 ②(≈ 25) |
| `recordNewSkillBaseline` 1595-1633 | 39 | 삭제 |
| `updateDir` 2309-2369 | 61 | 삭제 → 루프 1줄 |
| `syncSkills` 2370-2491 | 122 | ≈ 55 남음(슬롯 술어 + #477 prune) |
| `judgedUpdateWrite` · `displacedEntry` · `recordedStateOf` · `notOursUnder` · `recordDisplaced` · `skillBaseline` 2492-2608 | 97(`baselineRecord` 6 · `withoutLostBackups` 15 제외) | 삭제 → `recordHarnessWrites` ≈ 30 |
| `refreshPolicyBaseline` · `outsidePaths` · `refreshSkillBaseline` 2620-2727 | 108 | 삭제 |
| `refreshNeutralHelpers` 2799-2862 | 73 | 삭제 |
| `runUpdateMode` `.claude/` 조정부 580-715 | 136 | ≈ 55 남음 |
| `PolicySyncCtx` 2270-2288 | 19 | ≈ 6 남음 |
| install-log.ts `collectSkillHashes` · `collectPolicyHashes` 637-691 | 55 | 삭제 |
| **합** | **865 삭제** | **≈ 230 추가·잔존**(대상 선정 60 · 조정부 55 · 기록 30 · 화면 유도 25 · prune 55 · ctx 6) |

| 표 B — PR-B | 줄 | | 표 C — PR-797 | 줄 |
|---|---|---|---|---|
| `policyBaseline` · `baselineRecord` | 17 삭제 | | `write()` 199-256 | 58 → ≈ 40 |
| `pruneOrphans` 2728-2777 | 50 → ≈ 45 | | `isHarnessOwned` 597-616 | 20 삭제 |

PR-0 추가 ≈ 30(writer 20 · judge 4 · recorded 3 · 테스트 밖).

**순감 추정(src)**: 삭제 865 + 17 + 5 + 38 ≈ **925** · 추가 ≈ 230 + 30 + 15 ≈ **275** → **≈ −650(±100)**. 감사의 "≈ 250" 은 통째로 사라지는 재스캔·기록 함수만 센 값이고, 여기서는 그것들이 끌고 가는 `installNewAssets` · `installNewSkillDirs` · `refreshNeutralHelpers` · `updateDir` 재구성을 더했다. 추가 쪽은 **추정**이다 — 구현 뒤 `git diff --stat` 로 대조한다(≈ 275 를 크게 넘으면 설계가 경우를 다시 들이고 있다는 신호).

**테스트**: 삭제 ≈ 72(사라지는 함수의 단언) · 재작성 ≈ 585 중 절반 정도가 E2E 로 살아남고 · 신규 ≈ 150(§6 "없으면 실패" 열) → 대략 중립(±150).

---

## 8. 비목표 · 위험

**비목표**
- 화면 문구·행 구조(PR-C) · `UpdateModeReport` 필드 모양(단 `helpersKept` 삭제).
- uninstall · 함께 쓰는 파일(`shared-write.ts`) · 앵커 동기화(`syncHarnessAnchor` — ADR-060 이행 로직을 품은 다섯째 쓰기 경로. 같은 질문을 던질 자리지만 이 사이클 밖) · `.installed-tracks`(update 는 오늘도 안 쓴다).
- `RETIRED_PATHS` 를 지문 표에서 유도(#796 "함께 볼 것") — 감사 §4 가 적은 범위 불일치(`observe.sh` 등 v26.70 이전 경로)가 **먼저 대조돼야** 하고 `recorded.ts` · reclaim 제외 구역을 지난다. 이 설계는 `RETIRED_PATHS` 를 읽기만 한다. 별도 이슈로.
- update 가 `records: "writer"` 를 적는 것(§3.5).
- 로그 없는 엔진 호출의 `.claude/` 갱신(A7 폴백) — 건너뛴다(§5.3 0).

**위험과 통제**

| 위험 | 통제 |
|---|---|
| 재스캔이 "우연히" 막아 주던 손실이 writer 에 없을 수 있다 | §3.2 표 — 디스크 바이트를 기록으로 승격하는 코드가 없다는 구조적 논거 + 옛 판 5종 실설치 공격(PR-A) — v26.169.0 때 단위 픽스처가 못 본 손실을 실설치가 찾았다(메모리) |
| `--only` 부분 갱신과 옛 로그의 조합(B-2 류) | §3.3 스킬 단위 읽기 + PR-0 테스트 + PR-A ⓒ. 정책 파일은 이미 폴더 단위 |
| 대상 집합 변경(§1.2 ①)이 설치자가 **빼려고** 지운 폴더를 되살린다 | 그 길은 ADR-099 가 이미 정했다(`--without <id>`) — 화면이 `restoredWithout` 인자를 함께 낸다(오늘의 `restored` 행 그대로) |
| `retiredClaims` 시작 스냅숏이 뒤 단계가 만든 상태를 놓친다 | 스냅숏에 들 수 있는 건 시작 시점 디스크의 은퇴 경로 파일만이고, 그 자리를 이 실행이 바꾸는 유일한 길은 `pruneOrphans`(→ `pruned` 로 제거) · 되돌리기(→ 시작 때 하네스 파일이라 `have` 에 있어 애초에 claim 아님) |
| 테스트 재작성 중 단언이 약해진다(완화가 곧 삭제) | 재작성 규칙 = "같은 디스크 결과를 단언" · judge 행 단언은 judge.test 로 — 리뷰어가 word-diff 로 본다 |
| 추가 코드가 추정(275)을 넘는다 | PR-A 리뷰 체크 항목 — 넘으면 어느 경우를 다시 들였는지 적시 |
| PR-B 의 ③·④ 가 설치자 디스크에서 **삭제 시점**을 바꾼다 | 둘 다 백업이 있거나(③) 더 남기는 쪽(④). 실설치 공격에서 26.100.0 · 26.125.0 B 흐름(uninstall 직행)과 A 흐름(update ×2)을 비교 |

---

## 9. 검증자에게 — 내가 확신하지 못하는 것

1. **§3.3 `scanFieldOf` 스킬 단위** — S2(v26.126–131, 컨테이너 표본 없음)의 `collectSkillHashes` 가 실제로 깔린 모든 스킬의 파일을 적었는지(그래야 폴더 단위로 읽어도 S2 에서 답이 같다). CHANGELOG v26.126.0 과 당시 코드로 확인해 주기 바란다. 또 `recorded.test.ts:151`(스킬 — 필드 없음 → no-sha) 외에 "필드 있음 → 그 스킬 항목 없음 → none" 을 단언하는 테스트가 있는지(있으면 그 단언의 의도가 "다 훑었다" 인지 "이 스킬을 훑었다" 인지).
2. **§5.6 judge 행 추가** — `no-sha · 디스크 없음` 의 `op: remove` 칸을 `keep` 으로 둔 것이 맞는지(지금 코드와 같다). 그리고 install 의 `installClaudeBaseline` 에서 이 행이 문구를 바꾸는 자리가 없는지(둘 다 "wrote" 라 없다고 본다).
3. **§3.4 시작 스냅숏과 install 의 비대칭** — install 은 `composeWriterLog → inheritScanned → retiredClaims` 를 **실행 끝**에 계산한다(install-writes.ts:535). `reclaimOutOfTrackRecorded` · 옛 앵커 은퇴가 되돌린 설치자 파일이 은퇴 경로에 놓이면 install 도 #788 MEDIUM-1 과 같은 길이 아닌가? 이 설계 밖이지만 같은 함수를 쓰는 자리라 묻는다.
4. **§1.2 ① 되살림 집합** — "없는 폴더는 Claude 자리 기록 또는 릴리즈 기본일 때만 만든다" 가 ADR-097 D2 와 #585("기록은 트랙을 CLI 마다 나누지 않는다")의 뜻과 맞는지. 대안 = `.agents/skills` 기록만으로도 Claude 자리에 만든다(대칭) — 그러면 화면 분류(`splitTrackFilled` 류)가 하나 더 필요해 넣지 않았다.
5. **§1.2 ⑥ 헬퍼 심링크** — `tests/update-pipeline-scope.test.ts:139` 가 지키려던 것이 "밖 링크" 였는지 "프로젝트 안 링크도" 였는지(B-666 NOTE 원문). 안 링크까지였다면 install 과 다른 보호를 update 만 가진 이유가 있었는지.
6. **§3.5 `records` 미설정** — update 가 writer 로 바뀐 뒤에도 표시를 안 적는 것이 ADR-097 D1 "새 판이 로그를 처음 쓸 때 … `records: "writer"` 를 적는다" 와 어긋나 보일 수 있다. 나는 "다 열거할 때만" 이라 읽었고 install 이 그 자리다. 다른 읽기가 있으면 PR-0 에서 결정.
7. **§1.2 ⑤ `wired` 폐기** — 대안은 `recorded()` 에 "`.claude/hooks/<s>` 의 기록 = `policyFiles` 항목 또는 `settings.json` 몫 키 `hooks.*#<s>`" 를 데이터 규칙으로 두는 것(≈ 8줄). 나는 교차 추론을 늘리지 않는 쪽을 택했다. 설치자 문구 1회의 가치를 다르게 보면 바꾼다.
8. **PR-A 테스트 재작성 범위** — 로그 없이 `runUpdateMode` 를 부르는 E2E 테스트(47 − 14) 중 `.claude/` 갱신을 단언하는 것이 몇 건인지 세지 않았다(앵커 이행 테스트가 다수라 본다). 구현 전에 세어 PR-A 의 크기를 확정해 달라.
9. **`occupiedByNonDirectory` 와 `foreignOwnedTarget` 의 순서** — 오늘 `syncSkills` 는 `occupiedByNonDirectory` 를 `existsSync` 보다 **먼저** 본다(깨진 링크, :2423-2429). 대상 선정 ②가 그 순서를 지키는지 구현 리뷰 체크에 넣어 달라.
10. 크기 추정(§7)의 "추가 ≈ 275" 는 추정이다. 구현 diff 가 이것을 넘으면 어느 경우가 되돌아왔는지 먼저 묻기 바란다.

---

## 검증 반영 (`796-one-writer-design-verify.md` — 이 절이 앞 절의 해당 문장을 대체한다)

검증: BLOCK 2건(둘 다 검증자 문장으로 닫힘) · NOTE 12건. 사용자 결정 필요 항목 없음. 두 BLOCKER 는 검증자가 준 문장을 그대로 넣는다 — 설계 재검증은 걸지 않고 PR 리뷰가 단언으로 확인한다.

| 항목 | 반영(대체하는 자리) | 담는 PR |
|---|---|---|
| **BLOCKER-1** 부분 실행(`--only`)의 `retiredClaims` 가 안 쓴 디렉터리를 "기록 있음"으로 뒤집는다 — **오늘 코드에서도 `--only hooks` 로 재현**(P1: 하네스 룰 6개가 displaced/displacedSame 로 적힘) | §3.3 에 추가: `scanFieldOf` 의 정책 분기도 같은 교정을 받는다 — `RETIRED_PATHS` 에 든 항목(옛 스캔 · `retiredClaims` 가 이어 적은 것)은 "그 디렉터리를 훑은 기록"의 증거로 세지 않는다: `present(policyFiles.some(f => f.path.startsWith(dir/) && !RETIRED_PATHS.includes(f.path)))`. claim 은 은퇴 자리 하나의 소유 근거이지 디렉터리 열거의 근거가 아니다(기록을 고치지 말고 잘못 읽는 쪽을 고친다). 테스트: `policyFiles` 에 은퇴 항목만 있으면 그 디렉터리의 다른 대상은 `no-sha`(claim 을 세면 `none`) | PR-0 |
| **BLOCKER-2** §5.2 ② 대상 id 에 은퇴 스킬이 들어와 #477 정리가 은퇴 스킬 폴더를 비운다 | §5.2 ② 첫 줄 교체: 번들 스킬 — id 집합 = `recordedSkillIds(...)` ∩ 이번 번들에 폴더가 있는 id(`existsSync(join(templatesDir, "skills", id))`) — 오늘 `syncSkills` 가 템플릿 디렉터리를 도는 것과 같은 범위. 은퇴 스킬 폴더는 대상이 아니고 #477 정리도 돌지 않는다(ADR-111 결정 5 · `staleSkillDirs` 안내 그대로). 테스트: writer 로그 + 기록된 스킬 id 가 번들에서 빠진 "다음 릴리즈"로 update → 그 폴더의 파일이 하나도 지워지지 않고 안내 행만 난다 | PR-A |
| N1 | §1.2 에 ⑨ 추가: 기존 파일 갱신 대상이 "디스크 ∩ 템플릿 이름"에서 "기록 트랙 대상"으로 좁아진다 — 트랙 밖 같은 이름 설치자 파일을 더는 덮지 않고, 옛 판이 깐 트랙 밖 하네스 파일은 안내 + uninstall 지문이 치운다. ADR-097 D2 "displaced 자리" 는 "그중 이번 트랙 대상인 것"으로 읽는다. 이미 생긴 잠복 상태(트랙 밖 자리 displaced+sha 인데 `recorded()` 가 none)는 별도 이슈 | PR-A · 이슈 |
| N2 | §3.3 ⓑ 정정: `tests/recorded.test.ts:149-154` 가 뒤집힌다 — "다른 스킬 항목만 → no-sha · 같은 스킬의 다른 파일 없음 → none" 으로 재작성. PR-0 의 "install 동작 변화 0" → "S2–S4 로그 + 항목 없는 번들 id 폴더 한 장면에서 install · uninstall 판정이 바뀐다(백업에 남아 손실 없음)" | PR-0 |
| N4 · N9 | 헬퍼 링크 테스트 단언 `helpersKept` → `outsideLinks` · "로그 없음 → `.claude/` 단계 건너뜀"에 헬퍼(`.uzys-agent-harness/*.sh`)도 포함 | PR-A |
| N6 · N7 | ① 감수 범위에 "옛 스캔이 적은 opt-in id 도 되살림 집합에 든다" 한 줄 · §3.5 에 "S2–S4 raw 항목은 update 로 남고 다음 install 이 1회 정리" 명시 | 문서 |
| N8 · N10 · N11 | PR-A 착수 때 `runUpdateMode(` 직접 호출 12파일 81회부터 센다 · ② 는 `occupiedByNonDirectory` 를 먼저 · PR-A ⓓ 는 "없으면 실패" 열에서 본문으로 | PR-A |
| N3 · N5 · N12 | 설계 그대로(검증자 확인) | — |

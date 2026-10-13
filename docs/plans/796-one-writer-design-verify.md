# #796 · #797 설계 검증 — `docs/plans/796-one-writer-design.md` (2026-10-13, 읽기 전용 · main @ 1dc9628)

판정: **BLOCK** — BLOCKER 2건(둘 다 설계 문장 한 줄로 닫힌다 · 구조는 그대로). 고치면 PASS with notes.

근거 실측: 탐침 3건 = `scratchpad/v796/probe.test.ts`(P1 · P2 · P4, 전부 green = 아래 주장 재현) · 옛 판 컨테이너 기록 `docs/plans/v26.170.0-design-evidence/container/` · 옛 코드 `git show v26.126.0 / v26.131.0`.

---

## BLOCKER-1 — `retiredClaims` 가 부분 실행(`--only`)에서 **안 쓴 디렉터리를 "기록 있음"으로 뒤집는다** → 실제 하네스 파일이 첫 접촉으로 읽혀 uninstall 이 옛 하네스 바이트를 제자리로 되돌린다

- 주장(설계): §3.4 "실행 시작 스냅숏" + §5.4 `policyFiles: [...policy, ...claims]` 를 **모든 실행**(`--only external` · `skills` · `new-skills` · `anchor` 포함)에서 쓴다. §3.3 은 `scanFieldOf` 를 **스킬만** 폴더 단위로 고친다.
- 왜 깨지나: `recorded.ts:225-229` 정책 분기는 "같은 `POLICY_DIRS` 디렉터리에 **항목이 하나라도**" 있으면 `present`. 은퇴 claim(`rules/nextjs.md` 등)도 항목이다. S0/S1 로그(26.100 · 26.125 설치본 — 컨테이너 snap-0 에 `rules/code-style.md` · `hooks/spec-drift-check.sh` 등 RETIRED_PATHS 파일이 실재)에 `--only skills` 를 돌리면 설계 §5.4 가 **claim 만 든 `policyFiles`** 를 만든다 → 다음 update 의 `.claude/rules/git-policy.md` 는 `recorded()` → `scanFieldOf` present → `none`(recorded.ts:200) → judge 첫 접촉 → 다르면 백업+displaced("had a file with this name"), 같으면 displaced(백업 없음, "yours") → 기록에 안 실린다 → uninstall 이 하네스 룰을 **설치자 파일로 남기거나**(displacedSame) **옛 하네스 바이트를 제자리로 되돌린다**(displaced+backup). §1.2 ⑧ 이 "설계 필수" 라 부른 바로 그 회귀가 정책 파일 쪽에 남는다.
- 실측(P1 · P2, **오늘 코드로도 재현** — `--only hooks` 로 좁게 열려 있고 설계는 모든 `--only` 로 넓힌다):
  - P2: `policyFiles = [{path:"rules/nextjs.md"}]` 만 있는 로그 → `recorded(".claude/rules/git-policy.md") = none` · claim 을 빼면 `no-sha`(대조군).
  - P1: tooling·claude 설치 → S0 로 깎음 → `.claude/rules/nextjs.md` 둠 → `runUpdateMode(…, ["hooks"])` 뒤 `policyFiles = [hooks/protect-files.sh, hooks/session-start.sh, rules/nextjs.md]` → `recorded(git-policy) = none` → 전체 update: `displaced = [.claude/rules/git-policy.md]`(백업 1 · rootFiles displaced notes 1) · `displacedSame = [change-management, cli-development, doc-governance, ship-checklist, test-policy]` — 하네스 룰 5개가 "설치자 파일(그대로 둠)" 로 기록된다.
- 넣을 문장(§3.3 에 한 줄 추가 · PR-0 범위): "**`scanFieldOf` 의 정책 분기도 같은 교정을 받는다: `RETIRED_PATHS` 에 든 항목(옛 스캔 · `retiredClaims` 가 이어 적은 것)은 '그 디렉터리를 훑은 기록' 의 증거로 세지 않는다 — `present(policyFiles.some(f => f.path.startsWith(dir/) && !RETIRED_PATHS.includes(f.path)))`.** claim 은 은퇴 자리 하나의 소유 근거이지 디렉터리 열거의 근거가 아니다(기록을 고치지 말고 잘못 읽는 쪽을 고친다)." + PR-0 "없으면 실패하는 테스트" 에 추가: "`policyFiles` 에 은퇴 항목만 있으면 그 디렉터리의 다른 대상은 `no-sha`(claim 을 세면 `none`)". 충분성: `legacyOwned` 가 `isTarget || retired` 를 요구하므로(recorded.ts:167-168) 이 교정이 비대상 파일을 새로 `no-sha` 로 만들지 않는다.

## BLOCKER-2 — §5.2 ② 의 대상 id 집합에 **은퇴 스킬**이 들어오고, §5.3 3 의 #477 정리가 "대상 스킬 폴더" 를 돌면 **은퇴 스킬 폴더의 파일 전부를 치운다** (ADR-111 결정 5 · ADR-089 위반)

- 주장(설계): ② `for (const id of recordedSkillIds(projectDir, log))` + 3단계 "#477 — 대상 스킬 폴더의 번들 밖 파일 정리(syncSkills 의 prune 블록을 함수로 떼어 그대로)".
- 왜 깨지나: `recordedSkillIds`(update-mode.ts:1866-1878)는 writer 로그(`records:"writer"`, v26.162+)에서 `skillFiles` 의 id 를 **번들 존재와 무관하게** 넣는다(recorded.ts:184 `writer || legacyOwned()` → `sha`). 같은 id 가 다음 릴리즈에서 은퇴하면 폴더는 디스크에 있고 템플릿은 없다 → ② 에서 `listFilesRecursive(templates/skills/<id>)` 는 `[]`(fs-ops.ts:154 가드)라 쓰기는 0 이지만, **#477 정리의 `bundled` 집합도 ∅** 이라 그 폴더의 모든 파일이 "번들 밖" 이 된다 → 기록 sha 그대로면 **백업 없이 삭제**, 다르면 백업 뒤 삭제(update-mode.ts:2457-2481 의 규칙 그대로). 오늘은 `syncSkills` 가 `readdirSync(sourceDir)`(템플릿)만 돌아 은퇴 폴더를 아예 방문하지 않고(:2415), 은퇴는 `staleSkillDirs` 안내뿐이다(ADR-111 결정 5 "update 는 옛 은퇴 스킬 … 지우지 않고 안내한다"). 설계 §3.6 은 "그대로다" 라고 썼지만 ②·3 의 조합이 그것을 깬다. 옛 로그(S2–S4)는 `isTarget` 이 템플릿 존재를 보므로(recorded.ts:97-99) 은퇴 id 가 걸러지지만, 옛 로그도 `mergeExternalFiles` 로 항목이 영구 보존되므로(§5.4) 다음 install 이 `records:"writer"` 를 적는 순간 같은 길이 열린다.
- 넣을 문장(§5.2 ② 첫 줄 교체): "**② 번들 스킬 — id 집합 = `recordedSkillIds(...)` ∩ 이번 번들에 폴더가 있는 id(`existsSync(join(templatesDir, "skills", id))`) — 오늘 `syncSkills` 가 템플릿 디렉터리를 도는 것과 같은 범위. 은퇴 스킬 폴더는 대상이 아니고 #477 정리도 돌지 않는다(ADR-111 결정 5 · `staleSkillDirs` 안내 그대로).**" + PR-A "없으면 실패하는 테스트" 에 추가: "writer 로그 + 기록된 스킬 id 가 번들에서 빠진 '다음 릴리즈' 로 update → 그 폴더의 파일이 한 개도 지워지지 않고 `externalSkillsNotInCatalog`/은퇴 안내 행만 난다".

---

## NOTE (선택 — 설계가 더 정확해지는 것, 손실 아님)

- **N1 · §1.2 에 빠진 동작 변화 ⑨ — 기존 파일 갱신 대상이 "디스크 ∩ 템플릿 이름" 에서 "기록 트랙 대상" 으로 좁아진다.** 오늘 `updateDir`(:2322-2326)은 `.claude/<dir>/` 의 디스크 파일 중 템플릿에 같은 이름이 있으면 **트랙과 무관하게** 판정한다. 옛 판은 트랙과 무관하게 에이전트를 전부 깔았고(컨테이너 26.100 · 26.140 snap-0: `agents/data-analyst.md` · `strategist.md` 가 tooling 설치본에 있다), 오늘 v26.170 update 는 그것을 첫 접촉으로 읽어 strategist 는 백업+displaced("yours, put back on uninstall"), data-analyst 는 displaced(같음)로 적었다(26.140.0-A `new-update-1.txt`:55 · :59 · record-2 rootFiles). 설계 ① 의 `trackOnlyFileAssets(tooling)` 에는 둘 다 없다(P4 실측 — 15개 목록). 결과: ⓐ 설치자의 같은 이름 트랙 밖 파일(예: tooling 설치자의 자기 `agents/strategist.md`)을 update 가 더는 덮지 않는다(트랙 혼입 경로 폐쇄 — 좋다) ⓑ 옛 판이 깐 트랙 밖 하네스 파일은 update 가 갱신하지 않고 `demotedAgents`(:1334) 안내만 남으며 uninstall 의 지문(ADR-111)이 치운다 — 오늘은 그것을 displaced 로 적어 uninstall 이 **옛 하네스 바이트를 되돌리는** 쪽이었으니 더 낫다. 둘 다 원칙에 맞지만 §1.2 "전부 열거" 와 ADR-097 D2 표의 "+ `displaced` 자리" 와 어긋나므로 행 하나를 더하고 D2 를 "displaced 자리 중 이번 트랙 대상인 것" 으로 읽는다고 적을 것. (이미 record-2 모양이 된 설치본 — 트랙 밖 자리에 하네스 판 + displaced+sha 기록이지만 `recorded()` 가 `none` 으로 읽는 — 은 오늘 코드가 만든 잠복 상태라 이 설계 밖이다: uninstall 이 그 하네스 판을 못 알아보고(`none` · 지문은 v26.169 까지) 되돌리기는 "spot is taken" 이 된다. 별도 이슈 권고.)
- **N2 · §3.3 영향 대조 ⓑ 는 틀렸다 — `tests/recorded.test.ts:149-154` "스캔 필드가 있는데 경로가 없으면 none — 스킬" 이 뒤집힌다.** 픽스처 `skillFiles=[spec-scaling/SKILL.md]` 로 `north-star/SKILL.md` 를 묻고 `none` 을 단언하는데 폴더 단위면 `no-sha` 다. 그 단언의 의도는 "다 훑었다"(옛 `collectSkillHashes` 가 `.claude/skills/` 전부를 적었다 — v26.126.0 · v26.131.0 `collectSkillHashes(projectDir)` 본문 확인: `listFilesRecursive(skillsDir)` 전체, 필터 없음 — S2 에서 폴더 단위 읽기가 같은 답을 내는 근거). 재작성 = "다른 스킬 항목만 → no-sha · 같은 스킬의 다른 파일 없음 → none". 아울러 PR-0 의 "install 동작 변화 0" 은 한 장면에서 참이 아니다: S2–S4 로그 + 항목이 하나도 없는 번들 id 폴더(설치자가 옛 스캔 뒤 같은 id 로 손수 만든 것)는 install 에서 첫 접촉(displaced·되돌림) 대신 `no-sha`(1회 백업 · 되돌림 없음)가 되고, uninstall 은 `recordedTrackSpots` 후보로 그것을 백업 뒤 치운다(오늘은 둠). 바이트는 백업에 남아 손실은 아니나 PR-0 문장을 "install·uninstall 의 판정이 그 한 장면에서 바뀐다" 로 고칠 것.
- **N3 · §9 의심 3(install 의 실행 끝 `retiredClaims`)** — 실제로는 닿지 않는다: displaced 기록은 writer 판(v26.162+)이 쓴 **현행 템플릿 경로**에만 생기고 `RETIRED_PATHS` 는 2026-09-27 에 닫힌 옛 스캔 전용 목록이라 교집합이 비어 있다(manifest.ts 주석 "닫힌 목록"). #788 MEDIUM-1 의 ①′ 은 기록·번들을 손으로 만든 장면이다. 시작 스냅숏은 그래도 맞는 방향(순서 제약 제거)이다 — 설계 그대로.
- **N4 · §9 의심 5(헬퍼 링크)** — `tests/update-pipeline-scope.test.ts:174-188` 은 **밖**(tmpdir) 링크다. writer 의 `outside.skip`(install-writes.ts:201)이 그대로 지키므로 ⑥ 은 안 링크 한 장면만 바꾼다. 단언은 `helpersKept` → `outsideLinks` 로 바꾼다. 안 링크를 따라 쓸 때의 손실: `backupFile` 은 `copyFileSync`(fs-ops.ts:115-119)라 링크 너머 파일의 바이트가 백업에 남고 판정은 기록 sha 대 디스크 — install 과 동일. 감수 가능.
- **N5 · §9 의심 2** — `no-sha · 디스크 없음 · remove = keep` 은 읽는 곳이 없다(`pruneOrphans` 는 디스크 파일만 돌고 uninstall 은 `disk null → leave`). 그대로 두어도 된다. `installClaudeBaseline` 은 `harness()` 가 `create` 를 화면에 내지 않아(install-writes.ts:252) 문구 변화 0 — 맞다.
- **N6 · §9 의심 4(되살림 집합)** — ADR-097 D1 "소유 근거 = 기록에 있는 **경로**" 로 읽으면 `.agents/skills/<id>` 기록은 그 경로의 근거이지 `.claude/skills/<id>` 의 근거가 아니다. 설계대로(Claude 자리 기록 ∪ 릴리즈 기본) 두는 것이 맞고 사용자 결정 불요. 단 **옛 스캔이 적은 opt-in id** 도 되살림 집합에 든다(S2–S4: 설치자가 손수 만든 번들 id 폴더가 스캔됐다가 지워진 경우 → 되살림). 드물고 `--without` 으로 닫히니 ① 의 감수 범위에 한 줄로 적을 것.
- **N7 · §9 의심 6(`records:"writer"`)** — ADR-097 D1 의 "새 판이 로그를 처음 쓸 때" 는 `inheritScanned` 를 적용하는 자리(= install, `composeWriterLog`)를 가리킨다. update 가 안 적는 것이 일관적이다. 대신 결과를 §3.5 에 명시: S2–S4 의 raw 항목(트랙 밖 · 은퇴 id)은 update 를 몇 번 돌려도 기록에 남고 `recorded()` 가 매번 거른다 — 다음 install 이 1회 정리한다.
- **N8 · §9 의심 8(재작성 범위)** — `runUpdateMode(` 직접 호출 = 12 파일 81 회(update-mode.test 47 · update-pipeline-scope 9 · update-external-skills 6 · legacy-log-claude-dir 4 · update-restores-shared 3 · excluded-state-machine 3 · file-boundaries 2 · resident-cost-honesty 2 · 나머지 4 파일 1 씩). 로그 없이 `.claude/` 갱신을 단언하는 것은 `update-mode.test.ts` "runUpdateMode (E2E with templates)"(:732-) 블록이 대부분이고 앵커 이행(:1443-) 은 로그 없음이 전제(ADR-060)라 그대로다. 구현자가 PR-A 착수 때 이 블록부터 센다.
- **N9 · §5.3 0단계** — "로그 없음 → `.claude/` 단계 건너뜀" 에 **헬퍼(`.uzys-agent-harness/*.sh`)도 포함**임을 적을 것. 오늘 `installNewAssets` 는 로그 없이도 결측 헬퍼를 만든다(:1392-1393 "CLI 중립 자산은 그대로 대상"). CLI 경로로는 도달 불가(#699)라 감수 가능하지만, `update-pipeline-scope.test.ts:121-128` 류가 로그 있는 설치를 전제하는지 구현자가 확인한다.
- **N10 · §9 의심 9** — ② 는 `occupiedByNonDirectory` 를 `existsSync` 보다 먼저 본다(설계 코드 순서가 그렇다) — 리뷰 체크에 그대로.
- **N11 · PR 분할** — main 기준 · 스택 없음 · 완료 명령 실행 가능 ✓. PR-A ⓓ "순서 자유" 는 '없으면 실패' 가 아니라 리팩터 불변 주장이므로 열에서 빼고 본문에 둔다. 크기: 표 A 합 865 는 `function-spans.txt` 합과 맞고(installNewAssets 105 + installNewSkillDirs 50 + recordNewSkillBaseline 39 + updateDir 61 + syncSkills 122 + judged…skillBaseline 97 + refresh* 108 + refreshNeutralHelpers 66-73 + 조정부 136 + ctx 19 + collect* 55), 추가 275 는 추정으로 표시돼 있다 — 타당.
- **N12 · #797** — §4.2 매핑을 오늘의 7행(owned-write.ts:95-103 · :212-250)과 행마다 대조했다: 선검사(foreign · outside · refreshOnly 생성 규칙) 동일 · `firstContact` = `none` · `isHarnessOwned` 거짓 = `backup+overwrite` · `backupFirst` 는 `overwrite` 에서만 · Q3 같음-첫접촉은 `written.set` 없이 `displaced` · `restored` 는 `refreshOnly && rec.state==="sha"`(= 오늘 `baseline.has`). 결과 모양 불변 ✓. 탐침(`probe-797-owned-write-nosha.md`)의 "체크섬 없는 파일이 `backedUp` 에 든다" 는 코드와 일치하고 화면은 `checksumOnRecord` 가 다시 가르므로(update-mode.ts:1086-1100) 설치자 문구 변화 0 — 맞다. `isHarnessOwned` 호출부는 owned-write.ts:235 하나(확인).

---

## 성공 기준별 판정

1. 손실 안전(기록 모양 × 디스크 × 동작): writer 에 닿는 파일의 판정은 오늘과 같은 `recorded()`+`judge` 라 §3.2 표대로 손실 없음 ✓. **대상 선정과 기록 쓰기**에서 두 길이 열린다 — BLOCKER-1(부분 실행 뒤 하네스 룰이 첫 접촉·설치자 파일로 바뀜 → uninstall 이 옛 하네스 바이트를 되돌리거나 남김) · BLOCKER-2(은퇴 스킬 폴더 삭제). 디스크 바이트를 기록으로 승격하는 자리는 `retiredClaims` 뿐이고 `recorded()` 가 sha 와 무관하게 `no-sha` 로 읽는다 ✓.
2. 덧댄 경우 7(+1): `dirs` · `outside` · `notOurs` · `keepPrior` · `targets` · 조기 반환 · 순서 강제 — 구조로 사라짐 ✓(각 근거 §2 표와 코드 대조). `retiredClaims` 는 데이터로 남는다 ✓ — 단 BLOCKER-1 의 읽기 교정이 없으면 그 데이터가 새 경우를 만든다.
3. `scanFieldOf` 스킬 단위: 필요 ✓(⑧) · 충분 ✗ — 정책 분기에 같은 구멍(BLOCKER-1) · 기존 테스트 1건 뒤집힘(N2).
4. #797: 결과 모양 보존 ✓ · 관측 타당 ✓(N12).
5. 설치자 동작 변화: ①–⑧ 전부 원칙 안 ✓ · 빠진 ⑨(N1)는 원칙에 맞고 사용자 결정 불요, 열거만 필요. ⑦ Minor CR(judge 행) 타당.
6. PR 분할: ✓ (N11).
7. 구현자에게 암묵적인 것: BLOCKER-2 의 ② 범위 · N9 헬퍼 · N2 테스트 뒤집힘 · N4 `helpersKept → outsideLinks`.

판정: **BLOCK** → BLOCKER-1 · 2 의 문장을 넣으면 **PASS with notes**.

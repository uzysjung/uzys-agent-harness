# 판정: 조건부 — CRITICAL 1건(DO NOT CHANGE 침범) 해소 + HIGH 7건 정정 후 착수

리뷰 레인: 이 계획서를 쓰지 않은 독립 검증 레인. 워킹트리 `fix/unapproved-session-pull` @ `cc70695`, 2026-07-28.
git 상태 변경 0건(읽기 전용 명령만). 리포 파일 수정 0건. 베이스라인 `npm run ci` **exit 0**(branches 88.56% / 1461)
— §10 의 "npm run ci green" 판정들은 초록 트리에서 출발한다.

---

## 재현한 것 — 명령과 실제 출력

계수기는 리포에 **없다**. `scripts/count-obligations.mjs` 는 `git ls-files`·`find` 양쪽에서 0건이고
(canary: 같은 `find` 가 `scripts/check-absence.sh` 를 정상 검출), 실물은 스크래치패드의
`count-obligations.mjs`(07-28 06:53)·`count-real-install.mjs`(07:12) 다. 그 둘을 리포 루트에서 그대로 돌렸다.

| 계획서 주장 | 내가 돌린 명령 | 실제 값 | 일치 |
|---|---|---|---|
| §6-3 이 리포 상주 **A = 126** | `node …/count-obligations.mjs` | **126** | ✅ |
| §6-3 실설치 **tooling 89** | `node …/count-real-install.mjs` | **89** | ✅ |
| §6-3 실설치 **csr-fastapi 108** | 〃 | **108** | ✅ |
| §6-3 실설치 **executive 66** | COMMON 5 + 앵커 수동 합산(16+16+15+9+8+2) | **66** | ✅ |
| §6-3 A 내역 **95 / 24 / 7 · 가중 157** | 위 스크립트 | **74 / 45 / 7 · 178** | ❌ |
| §6-3 내역(좁힌 cond 재구성: `/면\s/`·`/시\b\|시 /` 제거) | `node -e` 로 두 정규식만 제거 | **96 / 23 / 7 · 156** | ❌ (±1) |
| §10 단계 0 "canary 현재 3/4" | 계수기 CANARY 블록 | `FAIL uncond` 1 + PASS 3 = **3/4** | ✅ |
| §6-3 설계의 "배포 COMMON 105" | `count-real-install.mjs` 3번째 집합 | **105** (룰 12 = manifest `COMMON_RULES` 5 와 불일치) | ✅ 폐기 근거 성립 |
| §5 N1 `- **Status**:` **21/58** | `grep -rl '^- \*\*Status\*\*:' docs/decisions/*.md \| wc -l` | **21** (+ 평문 37 = 58) | ✅ |
| §5 N2 Status 값 비정규 **8건** | `grep -h -E '^- (\*\*)?Status' … \| uniq -c` | **8** (4 = `Superseded by …`, 4 = `Accepted (…)`) | ✅ |
| §3-0 `PR:` **34/58** `#N` 부재 | `grep -hE '^- (\*\*)?PR' … \| grep -vc '#[0-9]'` | **34** | ✅ |
| §3-0 ADR-058 `PR: (머지 시 기입)` 이 거짓 | `ADR-058:5` + `git log`(`1ad627e … (#263)`) | 확인 | ✅ |
| §5 N8 헤딩 43 / 불릿 15 | `grep -l '^## Context'` / `grep -lE '^- (\*\*)?Context'` | **43 / 15** | ✅ |
| §3-1 `## Confirmation` **0/58** · `## 적용 범위` **11/58** | 〃 (canary: `## Decision` 44건 검출) | **0 / 11** | ✅ |
| §4 ADR-058:7 이 이미 `- Amends:` 사용 | `sed -n '1,12p'` | **:7 정확** | ✅ |
| §4 ADR-054 `- Superseded-by: — (해당 없음)` | `grep -n Superseded-by` | **:7 정확** | ✅ |
| §5 "고유 대상 중 Accepted 7건, 그중 자기선언 부분 5건(014·016·021·027·043)" | 12개 대상 Status 전수 조회 | **7 / 5, ID 전부 일치** | ✅ |
| §7 G-F1 대상 **9건**, 글롭 밖 13건 | `ls docs/plans/*-todo.md \| wc -l` / `ls docs/plans \| wc -l` | **9 / 22** | ✅ |
| §7 G-F1 "안 잡혀야 `service-audit-roadmap.md`" | 글롭 밖 + `tests/docs-supply-chain.test.ts:306` · `.claude/rules/ship-checklist.md:20` | **두 리터럴 모두 해당 줄에 정확히 존재** | ✅ |
| §7 G-F2 specs **18/18** | `ls docs/specs/*.md`, Status 줄 전수 | **18/18 모두 `> **Status**:` 형태** | ✅ |
| §7 plans frontmatter **0/22** | 22개 `head -1` 검사 (canary: `templates/skills/*/SKILL.md` 는 검출됨) | **0** | ✅ |
| §3-2 CRITICAL-2 `count_unchecked` 가 표 셀을 못 센다 | `.claude/hooks/spec-drift-check.sh:58` = `/^- \[ \]\|^  - \[ \]/` | **확인** | ✅ |
| §8 byte 게이트 **2건**, `change-management` 없음 | `grep -rn '\.claude/rules' tests/` 전수 | `doc-governance-baseline-rule.test.ts:93` · `evidence-templates.test.ts:199` **둘뿐** | ✅ |
| §8 "5쌍 분기 / 7쌍 동일" | 교집합 12쌍 `diff` | **5 diverged(no-false-ship·git-policy·ship-checklist·test-policy·cli-development) / 7 identical** | ✅ (줄 수치 155/58/40/23/5 는 diff 방식 미상 — 내 계수는 118/47/33/16/4) |
| §8 `docs/REFERENCE.md:138` PLAN 8섹션, `:139` NORTH_STAR | `sed -n '134,142p'` | **:138 / :139 정확** | ✅ |
| §8 `harness-direction-…-todo.md:144` `shipped(<태그>)` | `grep -n` | **:144 정확** | ✅ |
| §9 `package.json.files` | `node -e` | `["dist","templates","scripts/prune-ecc.sh","README.md","LICENSE"]` | ✅ |
| §9 manifest `source:` 에 `docs/` 없음 | `grep -n 'source: "docs' src/manifest.ts` (canary: `source: "` 6건 존재) | **0건** | ✅ |
| §10 R1ⓐ UI 룰이 tooling 에 안 깔린다 | `src/manifest.ts:70` `UI_RULES` + `src/track-match.ts:18` `hasUiTrack='csr-*\|ssr-*\|full'` | **확인** | ✅ |
| §10 R1ⓑ codex·antigravity 인라인 / opencode 글롭 | `src/codex/agents-md.ts:33-40`(`{PROJECT_RULES}`=CLAUDE.md 전문) · `src/antigravity/transform.ts:99-120` · `templates/opencode/opencode.json.template:3-7`(`".claude/rules/*.md"`) | **확인** | ✅ |
| §11 S12 `project-claude-merge.ts:40` FILL_SECTIONS 6개 | `sed -n '30,55p'` | **:39-46, 6개 정확** | ✅ |

**요약**: 팀리드가 지목한 4개 헤드라인 수치(126/89/108/66)는 **전부 재현된다.** 재현 안 되는 것은
그 4개의 **내역**(무조건/조건부/메타)과 그것을 근거로 삼은 §2 A2 의 "−12%" 서사다.

---

## CRITICAL (착수를 막는 것)

| # | 무엇이 틀렸나 | 증거 | 어떻게 고치나 |
|---|---|---|---|
| **C1** | **§10 단계 7 이 `docs/SPEC.md` 를 새로 쓰는데, 그 파일은 명시적으로 DO NOT CHANGE 로 보존된 문서다.** `docs/SPEC.md:7` — *"본 SPEC 은 Foundation(v26.38) 시점의 Persistent Anchor 로 **의도적으로 보존**된다 (DO NOT CHANGE 본문)"*, `:63` — `### 3.3 DO NOT CHANGE`. `change-management.md` 는 DO NOT CHANGE 를 **수정 금지 · 불가피하면 Major CR + 인간 결정 필수**로 규정한다. 그런데 §10 의 **사용자 결정 지점 목록은 "6 · 9 · 11 · R1b" 이고 단계 7 이 없다.** 즉 계획서는 인간 결정이 필수인 조작을 무승인 단계로 편성했다. §3-2 템플릿의 *"출하 시 이 파일을 `docs/archive/` 로 옮긴다"* 까지 합치면 보존 앵커의 **이동**까지 자동 절차에 들어간다 | `docs/SPEC.md:7`, `docs/SPEC.md:63-69`, 계획서 §10 단계 7 · §10 말미 "사용자 결정 지점", 계획서 §3-2 "## 출하 시" | 단계 7 을 **사용자 결정 지점에 추가**하고, 두 선택지를 ASIS→TOBE 로 올려 승인받는다: ⓐ 기존 앵커를 `docs/archive/` 로 이동하고 그 자리에 신규 SPEC ⓑ 신규 SPEC 을 다른 경로(예: `docs/specs/<slug>.md`)에 두고 앵커는 불변. **어느 쪽이든 착수 전 인간 결정.** 부수로, 단계 7 이 착지하면 `spec-drift-check.sh ship` 이 미완 AC 를 세어 **출하가 사이클 내내 차단**된다(그게 §10 이 의도한 바이지만, ship-checklist 전항 통과를 요구하는 §10 단계 12 와의 관계가 계획서에 없다 — 같이 적어라) |

---

## HIGH

| # | 무엇이 틀렸나 | 증거 | 어떻게 고치나 |
|---|---|---|---|
| **H1** | **§6-3·§2 A2 의 내역과 가중 예산이 재현되지 않는다.** 계획서는 "재측정(2026-07-28, **좁힌 cond 정규식**)"으로 `95 / 24 / 7 · 가중 157` 을 확정 표기하고, §2 A2 는 이를 "cond 45→24, 178→**157**(−12%)"로 헤드라인화했다. 그러나 **좁힌 정규식을 담은 산출물이 어디에도 없다** — 스크래치패드의 계수기는 여전히 `/면\s/`·`/시\b\|시 /` 를 갖고 `74 / 45 / 7 · 178` 을 낸다. 그 두 패턴만 빼고 재구성하면 `96 / 23 / 7 · **156**` 이다. 게다가 계획서 자신의 산술("오탐 **22건** 제거")은 45−22=**23** 이라 본문의 24 와 어긋난다 → 95/24/157 은 96/23/156 의 오기로 보인다 | `node …/count-obligations.mjs` 출력(위 표) · `node -e` 재구성 출력 · 계획서 §2 A2, §6-3 표 | ⓐ 좁힌 정규식 계수기를 **먼저 리포에 착지**시키고(§10 단계 0), 그 출력으로 §2 A2·§6-3 수치를 **덮어쓴다**. ⓑ 그 전까지 내역·가중 예산은 "미확정"으로 표기. **총계 126/89/108/66 만 확정으로 남긴다**(그건 재현됐다). ⓒ §7 G-F5 ratchet baseline 은 착지한 계수기 출력에서만 기록한다 |
| **H2** | **R1 기각의 근거 두 가지는 옳지만, 결론인 "델타 0" 은 계획서 자신의 헤드라인 지표에 대해 틀렸다.** ⓐⓑ 는 코드로 확인했다(위 재현 표). 그러나 ⓐ 가 덮는 것은 **배포 tooling 설치본**뿐이고, §6-3 이 1차 지표로 내세운 **상주 A(126)** 에는 `.claude/rules/benchmark-parity.md`(**12**)와 `playwright-launch.md`(**4**)가 **실재하고 지금 내 컨텍스트에 로드돼 있다** — 합 **16 = A 의 12.7%**. Claude Code 가 `paths:` 를 존중한다면 A 는 126→110 이 될 수 있다. §12 E-4 의 *"도달해도 R1 델타는 error-handling 4 뿐"* 은 A 를 계산에 넣지 않은 문장이다. **기각 자체는 "메커니즘 미검증"만으로 지탱되지만, 표에 적힌 델타 0 은 최대 레버의 크기를 0 으로 박제한다** | 계수기 출력의 `12 .claude/rules/benchmark-parity.md` · `4 .claude/rules/playwright-launch.md` · `src/manifest.ts:70` · 계획서 §10 R1 행 · §12 E-4 | R1 행의 델타를 **"배포 트랙 0 / 상주 A 최대 −16(미검증)"** 으로 쪼개 적고, 기각 사유를 **"Claude Code 의 `paths:` 지원이 미검증"** 하나로 재서술한다. E-4 의 "error-handling 4 뿐"을 삭제하거나 "tooling 설치본 기준"으로 한정한다 |
| **H3** | **§7 G-F5 를 `context-cost-baseline.json` 에 얹으면(§11 D13) 릴리즈 CI 가 throw 한다.** 상주 A 집합에는 `$HOME/.claude/CLAUDE.md`(**126 중 15**)가 들어 있는데 이 파일은 리포 밖 · 이 맥 전용이다. §10 단계 0 은 **"파일 부재는 0 이 아니라 throw"** 를 계약으로 못 박았고, `context-cost-baseline.json` 은 `tests/context-cost-ratchet.test.ts` 가 `npm run ci` 에서 읽는다 → GitHub Actions 체크아웃에는 그 파일이 없어 **게이트가 죽는 게 아니라 터진다**. 현행 baseline 은 `tracks` 만 담아 HOME 의존이 0 이다 | `count-obligations.mjs` 출력 `15  /Users/uzysjung/.claude/CLAUDE.md` · `context-cost-baseline.json` 키 `["$comment","units","tracks"]` · 계획서 §10 단계 0 · §11 D13 | ratchet 축은 **리포 내부에서 derive 되는 집합만** 쓴다(A 를 넣으려면 전역앵커를 제외한 `A_repo = 111` 로 정의). 전역앵커분은 리포트에만 남기고 게이트에서 뺀다. 안 그러면 v26.128.0~131.0(환경 하드코딩으로 게이트 자멸)과 **같은 계열의 실패**다 |
| **H4** | **§1 BLUF 의 "낯선 설치자에게 나가는 변경은 … 하나뿐" 이 쓰는 시점에 거짓이다.** §9 표 자신이 배포 변경을 **셋** 싣는다: ⓐ `templates/rules/change-management.md` 골격 축소(인정된 하나) ⓑ `templates/codex/AGENTS.md.template`·`templates/antigravity/AGENTS.md.template` 문안 정정 + `Linked SPEC:` 삭제 ⓒ **앵커 스캐폴드 `src/project-claude-merge.ts` 절 구성·순서**. ⓒ 는 "순감"이 아니다 — 현행 `FILL_SECTIONS` 6절 중 **3절(Identity & Purpose · Architecture & Layout · Installed Harness Assets)이 사라지고** 새 절 하나가 들어온다. `dist/` 로 컴파일돼 전 설치자에게 나간다. §9 말미도 "남는 것은 R1 과 codex/antigravity 템플릿 정정"이라 적어 BLUF 를 스스로 반박한다 | 계획서 §1-3 · §9 표 3개 행 · `src/project-claude-merge.ts:39-46`(6절) · `:61-91`(제목 6개) | BLUF ¶3 를 "배포에 나가는 변경 **3건**(골격 축소 · 4-CLI 템플릿 문안 · 스캐폴드 절 구성)"으로 정정하고, ⓒ 는 **절 삭제 3건**임을 명시해 §9 의 "사용자 결정 지점 9" 에 포함시킨다 |
| **H5** | **§6-1 의 "4절 유지"는 이 워킹트리에 대해 거짓이고, §10 단계 9 는 다른 계획서의 산출물을 무선언 전제로 깔고 있다.** 현행 스캐폴드는 4절이 아니라 **6절**이다. 계획서가 말하는 4절 앵커(`Boundaries → Verification Gate → Stack & Commands → Where decisions get written down`)는 아직 착지하지 않은 **선행 계획의 to-be** 다. `templates/CLAUDE.md` 도 4절이 아니라 6원칙 + `## Decisions and explanations` 구조다. §11 S12 는 이 문제를 인정하며 *"§10 단계 9 에 '선행 계획 착지 후 기준' 전제 명시"* 라고 적었는데 — **§10 단계 9 본문에 그 전제가 없다** | `src/project-claude-merge.ts:61-91` · `grep -n '^#' templates/CLAUDE.md` · 계획서 §6-1 첫 줄 · §10 단계 9 · §11 S12 | §6-1 을 "현행 6절 → 목표 4절(삭제 3 · 신설 1 · 재정렬)"로 다시 쓴다. §10 단계 9 에 **선행 계획명과 그 착지가 전제라는 문장**을 넣거나, 선행 계획이 안 서면 이 단계를 이번 사이클에서 뺀다 |
| **H6** | **§11 리뷰 처리 표(48건 원장)가 §10 에 없는 반영을 있다고 적는다 — 확인된 것만 2건.** ⓐ D14: *"채택 — §8 표 + **§10 단계 8**"* 인데 단계 8 본문은 `plans frontmatter — 활성 2건 먼저 / G-F1 경고 감소. npm run ci` 가 전부다. **`harness-direction-…-todo.md:144` 본문 정정이 없다** — §8 이 "실행 단계에 본문 정정을 명시"라고 요구한 바로 그것이다. ⓑ S12: 위 H5. 원장은 48건을 닫았다는 **증거 문서**인데, 표본 2건에서 포인터가 거짓이면 나머지 46건의 신뢰도가 같이 떨어진다 | 계획서 §11 D14·S12 행 vs §10 단계 8·9 본문 · `docs/plans/harness-direction-2026-07-27-todo.md:144` | §10 단계 8 에 "`harness-direction-…-todo.md:144` 의 `shipped(<태그>)` 를 `shipped` 로 정정" 을 **명시적 작업으로 추가**. 그리고 §11 의 "반영 위치" 열을 **전건 역참조 검증**한다 — 두 건이 틀렸으면 표본이 아니라 절차 문제다 |
| **H7** | **§10 단계 1 이 아직 존재하지 않는 입력에 의존한다.** 단계 1 = "**G-F1~G-F4** 를 먼저 넣고 red 를 눈으로 본다(정합 작업 전)". 그런데 **G-F3 은 `docs/templates/ADR.template.md` 에서 헤딩을 derive** 하는데 그 파일은 **단계 2** 에서 생긴다. §7 이 G-F3 에 넣은 바닥 단언("derive 된 필수 헤딩 수 < 4 면 실패")까지 있어, 단계 1 에서 G-F3 는 **입력 부재로 실패**한다 — 그 red 는 "게이트가 문다"의 증거가 아니라 빌드 파손 계열의 red 다(`no-false-ship` §초록불이 무는지부터 확인한다: *실패의 이유를 확인하지 않으면 실패도 증거가 아니다*) | 계획서 §10 단계 1 vs 단계 2 · §7 G-F3 행 | 단계 1 을 **G-F1·G-F2·G-F4** 로 좁히고, **G-F3 은 단계 2(템플릿 생성) 직후**로 옮긴다. G-F3 의 음성 대조도 그 시점 기준으로 다시 적는다 |

---

## MEDIUM

| # | 무엇이 틀렸나 | 증거 | 어떻게 고치나 |
|---|---|---|---|
| **M1** | **§7 G-F2 의 양방향 기대값이 단위 미정의이고 한쪽은 실측과 다르다.** 파일 단위면 잡혀야 **21** / 안 잡혀야 **37**(21+37=58). 위반 단위면 잡혀야 29(볼드 21 + 값 8 — **8은 21의 부분집합**) / 통과 파일 37. 계획서는 "잡혀야 **29** · 안 잡혀야 **36**" 이라 **29+36=65 ≠ 58** 이고, 36 은 `- Status: Superseded`(ADR-052) 1건을 빠뜨렸다. §10 단계 1 의 판정 규칙이 *"적게 잡히면 게이트 고장"* 이라 게이트가 파일 단위로 21 을 뱉으면 **정상 게이트를 고장으로 오판**한다 | `grep -h -E '^- (\*\*)?Status' docs/decisions/*.md \| uniq -c` 전수 출력 · 계획서 §7 G-F2 행 · §10 단계 1·3 | G-F2 기대값을 **"위반 건수 29 (볼드 21 ∪ 값 8, 파일 21건) / 통과 파일 37"** 로 단위와 함께 다시 쓴다 |
| **M2** | **§9 의 "위생 게이트도 안 무는" 근거 문장이 거짓이다.** 계획서는 *"(`tests/templates-distribution-hygiene.test.ts` 는 manifest 선언 source 만 훑는다)"* 라고 적었으나, 그 파일의 **4번째 검사(:137-167)는 `package.json` 의 `files` 에서 derive** 해 `templates/` 를 통째로 훑는다 → `templates/docs/PLAN.template.md` 도 검사 대상이다(형제 프로젝트명 패턴 · 로컬 한정). 나머지 3검사(:96·:110·:121)만 manifest 범위다. `no-false-ship.md` 자신이 *"검사 범위를 `package.json` 의 `files`(게시 계약)와 manifest 에서 derive"* 라 적고 있어 **상주 룰과도 모순**된다 | `tests/templates-distribution-hygiene.test.ts:49-66`(manifest) vs `:137-167`(`package.json.files`) · `.claude/rules/no-false-ship.md` §templates | "3중 회색지대" → **"게시된다 · 설치 안 된다 · 위생 검사 4개 중 3개가 못 본다(4번째는 형제명·로컬 한정)"** 로 정정. §9 의 이동 결정 자체는 이 정정에도 살아남는다 |
| **M3** | **§5 N4 의 "5건"은 대상 수이고 편집 대상 파일은 6개다.** 자기선언 부분대체 선언줄은 ADR-**015**(→014) · **019**(→016) · **030**(→027) · **043**(→021) · **044**(→043) · **053**(→043) = **6파일**. "5" 는 고유 **대상**(014·016·021·027·043)이고 043 이 두 번 지목돼 겹친다. 게다가 ADR-015 의 줄은 전면(010·013)과 부분(014)이 **한 줄에 섞여 있어 분할**이 필요하다 | `grep -n '^- \(\*\*\)\?Supersedes' docs/decisions/*.md` 전수 · `docs/decisions/ADR-015-…:6` | N4 를 "**대상 5 / 편집 파일 6**(ADR-015 는 줄 분할)"로 쓴다. G-F4 의 "오탐 5→0" 은 대상 단위 판정임을 명시 |
| **M4** | **§8 G-F6ⓐ("byte 대조")와 §9("최소형으로 축소 = 1필드+4절")·§3-1(1필드+4필수+**3선택절**+HTML 주석)이 동시에 성립하지 않는다.** 배포 인라인 골격이 선택절·주석을 빼면 byte 동일이 될 수 없고, 넣으면 "최소형"이 아니다 | 계획서 §3-1 코드블록 · §8 G-F6ⓐ 행 · §9 2번째 행 | 배포 골격과 리포 템플릿의 **공통 부분집합을 명시**하고 G-F6ⓐ 를 "필수 4절 + Status 줄의 부분집합 대조"로 바꾸거나, 두 사본을 문자 그대로 동일하게 확정한다 |
| **M5** | **§5 N5 의 "확인한 것"이 부정확하다.** *"ADR-015 선언 줄에 부분 한정이 없다"* 고 적었으나 실제 줄은 `ADR-010 **(Step 4 = External Assets 단일 step)** · ADR-013 **(wizard back nav 의 cancel 메시지)**` 로 **양쪽 다 괄호 범위 한정을 달고 있다**. "부분"이라는 단어가 없을 뿐이다. E-5 가 미확인으로 표기한 것은 정직하나, 확정으로 적은 "확인한 것" 쪽이 틀렸다 | `docs/decisions/ADR-015-all-in-one-installer.md:6` | N5 근거를 "**부분** 이라는 어휘가 없다(괄호 범위 한정은 있다)"로 정정. 사용자 판정에 그 괄호 문안을 그대로 올린다 |
| **M6** | **§7 의 diff 스코프가 이 리포에서는 대개 발동하지 않는다.** 확정 문안이 "base 를 못 구하면(main 위 등) **전체 글롭 + 경고 모드**"인데, 이 리포는 **PR 에 CI 가 없고**(CLAUDE.md 실측) 게이트는 `npm run ci` 로 로컬·태그 시점에 돈다. 그 시점의 `<base>...HEAD` 는 대체로 비거나 무의미해서 "변경 파일은 처음부터 red" 라는 강제가 실제로 걸리는 창이 좁다 — S4·S9 채택의 효과가 계획대로 안 난다 | 계획서 §7 "확정" 단락 · `CLAUDE.md` §검증 게이트 표(PR 에 CI 없음) | base 결정 규칙을 **명시**한다(예: `git merge-base origin/main HEAD`), 그리고 main 위에서 도는 경우의 판정(경고인가 red 인가)을 §10 각 단계의 green 기준에 반영한다 |

---

## 계획서가 "미검증"이라 적었어야 하는데 확정으로 적은 것

1. **§6-3 표의 `95 / 24 / 7 · 157` 과 §2 A2 의 "−12%"** — "재측정" 이라 적혀 있으나 그 값을 내는 도구가 없다(H1).
2. **§12 E-4 의 "도달해도 R1 델타는 error-handling 4 뿐"** — 미확인 칸 안에 들어 있으나 문장 자체는 확정형이고, 상주 A 기준으로 틀렸다(H2).
3. **§1 BLUF "배포에 나가는 변경은 … 하나뿐"** — §9 자신이 3건을 싣는다(H4).
4. **§6-1 "4절 유지"** — 현행 6절(H5).
5. **§9 "위생 게이트도 안 무는"의 괄호 근거** — 4검사 중 1개는 문다(M2).
6. **§5 N5 "부분 한정 없이 지목한다"** — 괄호 범위 한정이 있다(M5).
7. **§8 "byte-identity 게이트는 2건이고 change-management 에는 없다"** — 이건 **참이다**(재현 확인). 계획서가 D4 와 설계 양쪽을 정정한 이 대목은 정확했다.

§12 의 열린 위험 10건은 대체로 정직하다 — 특히 E-3(계수기 과소계수 배율을 운영에서 안 쓴다) · E-7(VeyraBench 를 임계값에서 뺐다) · E-10(MSR 미열람)은 근거 무게를 스스로 낮춘 정직한 표기다. 위 1~6 은 **§12 에 있어야 했는데 본문에 확정으로 적힌 것**이다.

---

## 확인하지 못한 것 — 왜 못 했고 무엇이 풀리면 되는가

| 항목 | 무엇이 막았나 | 무엇이 풀리면 확정되나 |
|---|---|---|
| **§2 의 논문 근거**(AgentIF 11.9/ISR<30%, IFScale 68.9/62.8, AbsenceBench +35.7%, MSR 900+) | 이 워킹트리에 원문·인용 사본이 없다. 리포 안에서 대조할 대상이 0이고, 나는 **논문을 열지 않았다**. 임계값 11.9 가 §3 템플릿 축소의 직접 근거라 여기가 틀리면 §3 전체가 흔들린다 | 4편의 원문(또는 초록의 해당 수치)을 열어 대조. 계획서가 E-7·E-10 으로 일부 자인했으나 **A1 의 11.9 자체는 자인 목록에 없다** |
| **벤더(Anthropic) 공식 문서 인용 3건**(*"use skills instead"* · *"Bloated CLAUDE.md…"* · *"test changes by observing…"*) | 같은 이유 — 리포 밖 자료이고 열지 않았다. A3′·A5·R1b 가 여기에 걸려 있다 | 해당 문서 URL 을 열어 문장 대조 |
| **ADR-010 · ADR-013 이 전면 대체인가**(N5) | 두 ADR 본문을 열지 않았다. 사용자 판정 항목이고, 계획서도 E-5 로 미확인 표기했다. 내가 확인한 것은 "둘 다 `Accepted`" 와 "ADR-015 선언줄의 괄호 한정 문안"까지다 | 두 파일 본문 열람 + 사용자 판정 |
| **게이트 6종의 실제 검출 건수**(G-F3·G-F5·G-F6) | 미구현이라 돌릴 코드가 없다. G-F1·G-F2·G-F4 는 대상 집합을 손으로 재현해 기대값을 검증했고(위 표), G-F3·G-F6 은 입력(`docs/templates/`)이 아직 없어 대상 자체가 성립하지 않는다 | 단계 1·2 의 dry-run 출력. 계획서 E-6 과 동일 |
| **4-CLI 산출물의 절 순서**(§10 단계 9 Docker 검증) | 호스트에서 실 CLI 실행은 `docker-only-realcli` 훅이 ✅ 차단하고, `test/docker/run.sh` 는 컨테이너 빌드·실행이라 **읽기 전용 리뷰 범위를 넘는다**(수 분 + 이미지 상태 변경). 코드 경로(`renderAgentsMd` · `writeRules` · opencode `instructions`)는 소스로 확인했다 | `bash test/docker/run.sh <시나리오>` 실행 — 구현 레인이 단계 9 에서 수행 |
| **`npm run ci` 이후 상태** | 돌렸고 **exit 0** 이다(파이프 없이 `$?` 판독, 로그 `/tmp/ci-review-*.log`). `dist/`·`coverage/` 는 `.gitignore:38-39` 라 추적 트리 불변이고 `git status --porcelain` 도 실행 전후 비어 있다 | — (확인 완료) |

---

## Verdict

- [x] **DO NOT CHANGE 영역 미변경** — ❌ **위반 예정**. §10 단계 7 이 `docs/SPEC.md`(DO NOT CHANGE 본문)를 무승인 단계로 대체한다 → C1
- [ ] **CRITICAL 이슈 없음** — C1 1건
- [x] **SPEC Non-Goals 침범** — 없음. `docs/SPEC.md:63` 의 DO NOT CHANGE 목록(NORTH_STAR §1~5 · `~/.claude/` 전역 · `test-harness.sh` · `hito-counter.sh` · `docs/archive/phase-4b/`)은 이 계획이 건드리지 않는다. **다만 그 목록을 담은 파일 자체가 C1 의 대상이다**
- [x] **git 상태 변경 0 · 리포 파일 수정 0**

### 착수 조건 (전부 충족 시 착수 가능)

1. **C1** — 단계 7 을 사용자 결정 지점으로 올리고 ⓐ/ⓑ 중 하나를 승인받는다. **인간 결정 없이는 착수 불가.**
2. **H1** — 좁힌 정규식 계수기를 리포에 먼저 착지시키고 §2 A2·§6-3 내역을 그 출력으로 덮어쓴다. 그전까지 내역·가중치는 미확정 표기.
3. **H3** — G-F5/ratchet 집합에서 `$HOME/.claude/CLAUDE.md` 를 제외(또는 A_repo=111 로 재정의)한다. CI throw 를 심고 시작하지 않는다.
4. **H7 · H5** — 단계 1 에서 G-F3 를 빼 단계 2 뒤로 옮기고, 단계 9 의 선행 계획 전제를 명시(또는 이번 사이클에서 제외)한다.
5. **H2 · H4 · H6 · M1** — R1 델타 표기 분리 · BLUF 배포 변경 3건 정정 · §11 반영 위치 전건 역참조 · G-F2 기대값 단위 명시. **이 넷은 문서 정정이라 착수 전 한 커밋으로 끝난다.**

M2~M6 은 착수를 막지 않는다. 해당 단계 진입 전까지 정정하면 된다.

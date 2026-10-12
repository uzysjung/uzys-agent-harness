# 단순화 원칙 적용 후보 — "경우를 덧대지 말고 구조를 바꿔 경우를 없앤다"

- 기준: main @ 1e4dcbf (2026-10-12), 읽기 전용. 열린 PR #789(옛 AGENTS.md 지문) · #793(외부 스킬 자리 보호 단순화)은 브랜치 diff 목록까지만 봤다.
- 측정: 상주 비용 = `npm run cost:report` (tooling, claude) · 바이트/줄 = `wc` · 함수 길이 = 소스의 doc 주석 + 본문 줄 범위.
- 결론 요약: **배포 지침(A)은 이미 여러 번 감사돼 있어서(#447 · #446/#452 · #496 · #728) 큰 후보가 없다.** 큰 후보는 코드(B)에 있다. 하네스 파일을 쓰는 실행기가 아직 **세 벌**이고, update 는 **쓴 뒤 디스크를 다시 훑어** 기록한다. 경우를 덧댄 흔적이 집중된 곳이 바로 여기다.

---

## 순위표 (설치자 이득 ÷ 노력)

| # | 후보 | 표면 | 판정 | 노력 | 위험 | 누가 이득 |
|---|---|---|---|---|---|---|
| 1 | update 의 `.claude/` 쓰기를 install 과 같은 writer 로 옮기고, 디스크 재스캔 기록을 폐지 | B | **issue** (문턱 위) | L | 높음(update 덮어쓰기·백업 규약) | 설치자 + 유지보수자 |
| 2 | `createOwnedWriter.write` 의 인라인 판정을 `judge()` 호출로 교체 | B | **issue** (#789 머지 뒤, 문턱 위) | S–M | 중간 | 설치자(Codex·OpenCode·Antigravity·`.agents/`) + 유지보수자 |
| 3 | update 화면의 영역별 행 분기를 install 과 같은 `judgedRow` 로 통일 | B | **issue** (1·2 뒤) | M | 낮음(화면만, 리그레션) | 설치자 |
| 4 | 은퇴 손목록(`RETIRED_PATHS` · `RETIRED_AGENT_IDS` 일부)을 #789 생성 지문 표에서 유도 | B | **later** (제외 구역 `recorded.ts` 를 거친다) | S–M | 중간 | 유지보수자 |
| 5 | `reviewer` 에이전트 본문의 서로 어긋난 지시와 중복 줄 정리 | A | **apply now** (자산 이슈 1건 열고 진행) | S | 낮음 | 설치자 |
| 6 | `reviewer` 의 방법 지식 체크리스트를 판정 기준 하나로 줄이기 | A | **issue** (#446 가드레일: 판정표 → 독립 리뷰 → 적용) | S–M | 낮음 | 설치자 |
| 7 | 브라우저 위임 스킬 3종에 똑같이 들어 있는 ~12 KB 를 한 곳으로 | A | **issue — 사용자 결정 필요** | M | 중간(스킬 id·트리거가 바뀜) | 유지보수자(설치자는 셋 다 선택했을 때만) |

"apply now" 는 5번 하나다. 1–3은 같은 축이라 순서대로 가는 것이 좋다. 2 → 1 → 3 순서면 마지막에 하네스 파일 쓰기 실행기가 **하나**만 남는다.

---

## 1. update 의 `.claude/` 쓰기 → install writer · 디스크 재스캔 기록 폐지 (issue, L)

**지금 구조**
- install 은 이미 "쓰기 = 기록"이다. `createInstallWriter().harness`(`src/install-writes.ts:192-252`)가 `judge` → 실행 → 기록 → 화면 한 줄까지 한 자리에서 처리한다. 설치 뒤 디스크 스캔(`collectPolicyHashes`·`collectSkillHashes`)은 install 경로에서 이미 끊었다(`src/installer.ts:1622-1623`).
- update 의 `.claude/` 룰·에이전트·훅·스킬은 다른 길로 간다.
  - 실행기를 따로 둔다: `judgedUpdateWrite`(`src/update-mode.ts:2462-2503`)가 같은 `judge` 표를 자기 switch 로 다시 실행하고 `kind` 를 돌려준다. `updateDir`(`:2266-2318`)와 `syncSkills`(`:2346~`)가 이것을 부른다.
  - 기록은 쓴 뒤에 **디스크를 다시 훑어** 만든다: `refreshPolicyBaseline`(`:2590-2630`) · `refreshSkillBaseline`(`:2645-2689`) · `recordNewSkillBaseline`(`:1573-1597`). 모두 `collectPolicyHashes`/`collectSkillHashes`(`src/install-log.ts:644-698`)를 거친다.
- 스캔은 "디스크에 있는 것 = 하네스가 쓴 것"으로 읽는다. 그래서 그렇지 않은 경우마다 **매개변수가 하나씩 덧대졌다**.

| 덧댄 경우 | 위치 | 출처 |
|---|---|---|
| 이번에 동기화한 폴더만 다시 찍기 | `refreshPolicyBaseline` `dirs` | #480 |
| 프로젝트 밖 링크는 다시 찍지 않기. 안 막으면 링크를 실파일로 바꾼 뒤의 update 가 백업 없이 덮는다 | `outside` · `outsidePaths`(`:2632-2643`) | #678 |
| 첫 접촉인데 같아서 둔 설치자 파일을 하네스 것으로 적지 않기 | `notOurs` · `notOursUnder`(`:2529-2539`) | #761 Q3 |
| 설치자가 뺀 파일·스킬은 앞 기록 유지 | `isBaselineExcluded` · `keepPrior` | ADR-099 R3 |
| 갱신 대상 스킬만 적기 | `targets` | #761 |
| 필드 없는 옛 로그에 부분 `skillFiles` 를 만들지 않기 | `recordNewSkillBaseline` 의 조기 반환 | #761 B-2 |
| 옛 로그가 하네스 것으로 읽던 은퇴 자리 이어 적기 | `retiredClaims` | PR-D 재리뷰 BLOCKER-1 ② |
| 단계 순서 강제(새 자산 설치 → 재스캔 · 되돌리기 → 재스캔 뒤) | `src/update-mode.ts:577-579` 주석 · `tests/displaced-restore-all-removes.test.ts:138,148` | #283 · #782 |

**구조 변경**: update 의 `.claude/` 하네스 파일 쓰기를 `writer.harness` 로 보낸다. update 는 이미 같은 writer 를 함께 쓰는 파일에 쓰고 있다(`src/update-mode.ts:1155`). 기록은 writer ledger 를 합치는 것으로 끝낸다. 그러면 스캔 자체가 없어지므로 위 표의 경우들이 **생기지 않는다**. 밖 링크·제외·첫 접촉 같음은 writer 가 쓰지 않거나 기록하지 않는다. 순서 제약도 남지 않는다.

**이건 새 설계가 아니라 남은 계획이다**: `docs/plans/one-principle-design-2026-09-27.md:370`(“`updateDir` · `syncSkills` · `pruneOrphans` 갱신·회수 판정 3벌 → `judge`”), `:374`(“스캔 두 함수는 폐지 — 쓰기 = 기록”), `:463`(“**삭제는 PR-5** (update 가 `refreshPolicyBaseline`·`refreshSkillBaseline`·`recordNewSkillBaseline` 으로 아직 부른다)”).

**지켜야 할 보호**
- 편집한 파일 하나만 백업(`backup+overwrite`). 첫 접촉은 `displaced` 로 기록하고 되돌리기 대상으로 둔다(#761 · #782).
- #477: 번들 밖 스킬 파일은 백업 후 삭제하고 `displaced` 로 적지 않는다(설계 §370 결정 그대로). `syncSkills` 의 prune 분기는 judge 밖에 둔다.
- 기록이 없는 설치본에서는 기록을 만들지 않는다(날조 금지).
- `noChecksum`(#557)은 실행 시작 때의 기록으로 가른다.

**크기**: 없어지는 함수 합계 ≈ 250줄(doc 포함 실측). 내역: `judgedUpdateWrite` ~42 · `displacedEntry` 11 · `baselineRecord` 5 · `notOursUnder` 11 · `skillBaseline`/`policyBaseline` 10 · `refreshPolicyBaseline` 41 · `outsidePaths` 12 · `refreshSkillBaseline` 45 · `recordNewSkillBaseline` 25 · `collect*Hashes` 54. 여기에 그 함수만 겨냥한 테스트(`tests/policy-file-ownership.test.ts:150~` · `tests/update-mode.test.ts:1742~`)도 빠진다. 대신 들어갈 writer 배선의 크기는 **추정하지 않았다**.

**위험**: 높다. update 의 덮어쓰기 경로와 백업 규약이라 `test-policy` 문턱 위다. 메모리 지침대로 설계 이행 리뷰와 **실제 옛 npm 판 실설치 적대적 손실 탐색**을 따로 걸어야 한다. 제외 구역과도 닿는다: `pruneOrphans`·은퇴 회수 경로(`src/update-mode.ts` reclaim)와 `src/recorded.ts`(`retiredClaims`)는 손대지 않고, 그 둘이 읽는 기록 모양만 유지해야 한다.

**설치자 이득**: 위 표의 경우 하나하나가 "기록이 설치자 파일을 하네스 것이라고 말하는" 결함 후보였고, 모두 리뷰가 잡아 하나씩 막았다. 구조를 바꾸면 그다음 경우가 생길 자리가 사라진다.

## 2. `createOwnedWriter.write` → `judge()` (issue, S–M — #789 뒤)

- **지금**: `src/owned-write.ts:194-247` 이 judge 표를 if/else 로 다시 구현한다. 첫 접촉(`firstContact`), 같음 → displaced, 다름 → `isHarnessOwned` 로 백업 여부를 정한다. Codex·OpenCode·Antigravity 산출물과 `.agents/skills`, 링크 본문(`linked-skill-bodies.ts:60`)이 모두 이 writer 를 쓴다. judge 를 부르지 않는 하네스 파일 실행기는 이제 이것 하나다(`judge(` 호출부: `install-writes.ts:198,305` · `update-mode.ts:2479` · `shared-write.ts` · `uninstall.ts` · `out-of-track.ts` · `antigravity/retire-anchor.ts`).
- **덧댄 흔적**: #761 때 judge 에는 첫 접촉이 있었다. 그런데 owned-write 는 judge 를 타지 않아서 첫 접촉을 "edited" 로 불렀고, 결국 따로 인라인으로 고쳤다(`docs/plans/v26.169.0-one-principle-finish-design.md:35`). `isHarnessOwned` 주석(`install-log.ts:611-613`)은 "판정식이 세 곳에서 각자 살면 갈린다 → 하나만 둔다"고 적는데, 지금 그 하나는 judge 다.
- **남은 어긋남(코드 경로 확인, 실행 안 함)**: 옛 로그가 하네스 것이라 말하는데(`owned(rel)`) 기준선 sha 가 없는 파일이 있다. owned-write 는 이것을 `backedUp` 에 넣어 "편집" 묶음으로 센다. judge 라면 `no-sha` 행이라 "no checksum on record" 줄이 나온다.
- **보호 유지**: `refreshOnly` 의 생성 규칙(`createInRefresh` · 기록에 있는 경로만 되살린다, ADR-099 R2)은 판정이 아니라 대상 선택이라 호출부에 둔다. `foreignOwnedTarget`·`outside` 선검사도 그대로 둔다.
- **크기**: `write()` 판정 분기 약 45줄이 judge 호출과 verdict 실행으로 바뀐다. `isHarnessOwned`(`install-log.ts:605-622`, 18줄)는 유일한 호출부가 사라져 같이 지운다. 순감은 수십 줄 수준이다.
- **순서**: #789 가 `owned-write.ts` 를 +10 줄 바꾸므로 그 뒤에 한다.

## 3. update 화면을 `judgedRow` 로 통일 (issue, M — 1·2 뒤)

- **지금**: install 은 판정이 낸 줄을 파일마다 그대로 찍는다(`install-render.ts:1459-1461` `judgedRow`). update 는 실행기들이 `kind` 만 돌려주므로, `renderPhase1Rows` 의 update 분기(`install-render.ts:1019-1455`, 약 440줄)가 `displaced` 를 경로 접두로 세 영역(스킬 · 정책 · 외부)에 나누고(`:1023-1028`), `hadFileRow` 3회(`:1198,1307,1365`), `displacedSame` 별도 행(`:1367-1373`), `noChecksum` 분리(`:1021`)를 따로 처리한다. `UpdateModeReport` 필드는 48개다(`update-mode.ts:139~`).
- **구조 변경**: 1·2가 끝나면 update 의 하네스 파일 쓰기도 `JudgedWrite`(경로 + 줄)를 낸다. 그러면 영역별 분기 대신 install 과 같은 렌더 한 줄로 찍을 수 있다. 같은 사건을 명령마다 다르게 부르지 않는다는 기존 목표(#524 주석, `install-render.ts:1552`)와도 같은 방향이다.
- **보호**: 파일마다 백업 경로를 대는 것과 "실제로 한 일만 말한다"는 원칙은 그대로다.
- **크기·위험**: 화면 코드만 바뀐다. 문턱 아래(리그레션)다. 줄어드는 양은 1·2가 무엇을 남기느냐에 달려 있어 **추정하지 않았다**.

## 4. 은퇴 손목록을 생성 지문 표에서 유도 (later)

- #789 가 `src/legacy-fingerprints.ts` 를 생성한다(v26.70.0~v26.169.0 태그 114판의 `.claude/*` 경로×sha `LEGACY_HARNESS_FILES`, `LEGACY_HOOK_REFS` 등). `RETIRED_ANCHOR_SECTION_KEYS` 는 그 PR 안에서 이미 이 표로 흡수된다(`retired-anchor-sections.ts` −64).
- 남는 손목록은 `RETIRED_PATHS`(`src/manifest.ts:233-282`, 45항목, "닫힌 목록" 근거 주석 포함)와, 거기서 나오는 `RETIRED_AGENT_IDS`(`:311`)다. 이것은 "생성 표의 정책 폴더 경로 − 현행 templates"로 유도할 수 있다.
- **반드시 먼저 대조할 것**: 생성 범위가 v26.70.0 부터라 손목록 출처 범위와 다를 수 있다. 실제로 `RETIRED_HOOK_WIRING_REFS`(`manifest.ts:298`)의 `skills/continuous-learning-v2/hooks/observe.sh`(2026-05-03 제거)는 생성 `LEGACY_HOOK_REFS` 에 **없다**(PR 브랜치에서 관측). 따라서 훅 배선 목록은 통째로 유도할 수 없다.
- `recorded.ts`·update reclaim(제외 구역)이 소비하므로, 그 PR 들이 머지된 뒤에만 진행한다.

## 5. `reviewer` 본문의 어긋난 지시·중복 (apply now — 자산 이슈 1건)

- `templates/agents/reviewer.md:97` 출력 형식은 "Fix: **코드 예시 포함한** 해결 방안"을 요구한다. 반면 `:125` 는 "구현 제안하지 않는다 — 이슈만 식별하고, 수정은 구현 에이전트가 한다"고 한다. 설치자의 리뷰어는 매번 서로 반대인 두 지시를 받는다.
- `:76` 과 `:128` 은 같은 규칙("변경되지 않은 코드는 CRITICAL 보안 제외 리뷰하지 않는다")을 두 번 적는다.
- **처리**: 한쪽으로 정해 한 문장만 남긴다. 어느 쪽인지는 이 리포의 레인 계약(검증 레인은 코드를 쓰지 않는다)이 이미 가른다. 중복 한 줄은 지운다.
- **크기**: 2–3줄. 상주 아님(호출 때만 읽힌다, 본문 4,728 B). **위험** 낮음. 문턱 아래.
- **규칙**: `change-management` 에 따라 자산은 자기 변경 요청이 있어야 하므로 이슈를 먼저 연다. `.claude/agents/reviewer.md` 개발 사본도 같은 두 줄을 갖고 있다(description 한 단어만 다르다).

## 6. `reviewer` 방법 지식 체크리스트 → 판정 기준 (issue)

- `reviewer.md:29-62` 의 Five-Axis 항목(N+1 · re-render · SQL injection/XSS/CSRF · 번들 크기 등)은 모델이 이미 아는 방법 지식이다. 같은 판정 기준("필수 요구 미충족 · 입증된 중대 위험 = 블로커, 선호는 분리")은 `:64-78`(Severity + Confidence)과 `:123-128`(Anti-Patterns)에 나뉘어 있다.
- #446 이 이미 "reviewer(레인 계약 · 입력 · Verdict 만 남기는 감량 후보)"로 지목했다. 이후 #452 에 흡수되면서 reviewer 는 **자산 유지** 판정만 받았고(`docs/plans/harness-inventory-audit-2026-09-14.md:76`), 본문 감량은 실행되지 않았다.
- **보호**: 입력(씬 + 완료 기준), CRITICAL 이 게이트를 막는다는 합격선(`docs/plans/v26.168.0-model-routing-design.md:200` "유지"), 이번 #791 의 구조 질문 줄은 남긴다.
- **크기**: 본문 4,728 B 중 체크리스트 약 34줄. 호출당 비용만 줄고 상주 비용은 그대로다. #446 가드레일(판정표 → 독립 리뷰 → 적용)을 따른다.

## 7. 브라우저 위임 3종의 공통 본문 (issue — 사용자 결정)

- `templates/skills/{chatgpt,gemini,genspark}-delegate/SKILL.md`(16,979 · 16,820 · 21,653 B)의 비어 있지 않은 줄 중 각각 130–134줄이 서로 같다. 세 파일 모두에 똑같이 있는 줄만 약 12,015 B다(`comm` 실측). §2 "현재 사용 중인 Chrome 연결" 절은 사이트 이름 한 단어만 다르다.
- **구조 후보**: 한 스킬로 합치고 사이트별 절을 둔다. 스킬 폴더는 독립 설치 단위라 형제 폴더를 참조하는 공유 파일은 성립하지 않는다(하나만 선택한 설치본에서 깨진다). 그래서 공유 참조 파일이 아니라 병합이 대안이다.
- **비용·위험**: 스킬 id 3개가 은퇴한다(`RETIRED_SKILL_IDS` · 카탈로그 · opt-in 이전 필요). 사이트별 트리거("젠스파크에 맡겨줘")를 하나의 descriptor 로 합쳐야 한다. 세 개를 다 고른 설치자의 descriptor 상주 합은 547 tokens(측정)다. 합친 뒤 값은 **측정하지 않았다**.
- 오늘(#759) 사용자가 3종으로 편입했으므로 합칠지는 사용자가 정한다. 지금까지 수정 이력은 1커밋이라 "세 번 고쳐야 했던" 관측은 아직 없다.
- **사용자 결정(2026-10-12): 지금은 두기.** 공통 본문을 두 번째로 고쳐야 할 때 합친다 — 설치자에게 달라지는 것이 없고 이전 비용(은퇴 3 · 기존 설치본 이전)만 지금 생긴다.

---

## 복잡해 보이지만 남겨야 하는 것 (재제안 방지)

| 대상 | 남기는 이유 |
|---|---|
| `foreign-slot.ts` 의 `foreignOwnedTarget` · `linksToProjectSharedSkill` + `outside-project.ts` | 술어 셋이 서로 다른 답을 낸다: 남의 도구 슬롯(절대 안 씀) · 프로젝트 안 공유 링크(본문은 기록으로 판정) · 밖 링크(남김). 하나로 묶어도 분기가 분류기 안으로 옮겨 갈 뿐 없어지지 않는다. 쓰기 경로의 밖 검사는 이미 writer 가 맡는다(`install-writes.ts:195`). |
| `templates/rules/test-policy.md:9-18`(#496 문단)과 앵커 §2·§4·§5 의 겹침(약 378 B ≈ 80 tokens) | 둘 다 사용자 문안이고 같은 날(2026-09-20) 의도적으로 함께 넣었다(c7ab85c · d109313). 지우면 사용자 확정 문안을 바꾸는 일이라 사용자 결정 없이는 하지 않는다. |
| `ship-checklist.md:7` "배포라는 이유로 다시 걸지 않는다"와 앵커 §4 의 겹침 | 오늘 #728(07b89c8)로 사용자가 넣은 결정이다. |
| `templates/hooks/protect-files.sh` 의 lock·인증서 파일명 열거 | 열거 자체가 보호다. 일반 문장으로는 차단할 수 없다. |
| `AGENTS.md.template` 의 Protected Files 문단 | Codex·OpenCode 에는 보호 훅이 없어서 이 산문이 유일한 보호다. |
| `RETIRED_AGENTS` 의 에이전트별 `instead` 문구 | 종마다 대안이 다르다는 결정(ADR-090 주석, `manifest.ts:210-212`)이다. |
| CLI별 transform 3종(`codex`/`opencode`/`antigravity/transform.ts`) | 공통부는 이미 `agentsSkillSlot` · `writeBundledSkillDirs` · `createOwnedWriter` 로 모였다. 남은 차이는 CLI 계약(config.toml · opencode.json · `.agents/rules`) 자체다. |
| `RETIRED_GITIGNORE_LINES`(1항목) · `RETIRED_FEATURE_KEYS`(2항목) | 함께 쓰는 파일의 옛 몫을 알아보는 값이다. 항목이 하나둘이라 생성 표로 옮겨도 줄지 않는다. |
| 배포 룰 7종 본문 | `cost:report` 기준 rules ~1,530 tokens/세션. #447 2차 감사에서 앵커 중복과 방법 지식을 이미 뺐다. 이번에 새로 찾은 중복은 위 두 줄(사용자 문안)뿐이다. |

## 제외 구역 — later 로만

- `src/legacy-fingerprints.ts` · `scripts/gen-legacy-fingerprints.mjs` · `src/recorded.ts` · update reclaim: 후보 4(은퇴 손목록 유도)가 여기에 닿는다.
- `src/commands/uninstall.ts` · `src/shared-write.ts` · `src/agents-md-*.ts` · `src/external-installer.ts` · `runExternalPhase`: 이번에는 보지 않았다. 후보 1이 끝나면, 같은 질문("실행기가 judge 를 직접 실행하나, 따로 구현하나")을 uninstall 쪽에도 던질 만하다.
- `src/opencode/transform.ts:162-180` 의 옛 `.opencode/commands/<id>.md` 회수는 지금 **이름이 번들 스킬과 같다**는 것만으로 대상을 고른다(백업 후 삭제). #789 지문 표가 `.opencode/` 경로를 담게 되면 "옛 판과 바이트가 같다"로 고르는 쪽으로 바꿀 수 있다. 현재 생성 표에는 `.claude/` 경로만 있다(관측).

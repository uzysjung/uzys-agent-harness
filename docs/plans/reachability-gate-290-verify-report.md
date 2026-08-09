# 검증 보고 — #290 reachability 게이트 (독립 레인)

- 대상: `fix/reachability-gate-blind-assets` — `cadf8d2`(게이트) · `1a77f77`(앵커 문안), main `d033831` 위 2커밋
- 검증 레인: 구현 레인과 분리. 구현 보고를 읽지 않고 **직접 실행**한 결과만 적는다.
- 실행일 2026-08-10 · 게이트 단독 실행 17회 + 전체 CI 1회 + 계측 프로브 4회
- git 상태 변경 명령 0회. 변이는 전부 `cp` 스냅샷 → 변이 → 실행 → **역치환 복원** → `shasum` 대조.

## 판정

**조건부 머지 가능** — #290 이 명시한 재현 변이는 확실히 사살됐고(EXIT 0 → EXIT 1) 범위·CI 는 깨끗하나,
이 수정이 겨냥한 바로 그 구역(앵커 146~158줄)이 **ack 누출로 통째 면제 구역**이라 실효가 반쪽이고
(결함 1, 변이 생존으로 실증), 같은 부류의 사각이 자산 45종에 남아 있다(결함 2).

CRITICAL 0 · HIGH 1 · MEDIUM 4 · LOW 3. 이 PR 이 만든 결함은 결함 3·4 둘뿐이고 나머지는 선재(先在)다.

---

## A. 재현 — 수정 전 변이 A 가 살아났는가

| 항목 | 값 |
|---|---|
| 명령 | `git show cadf8d2^:tests/…test.ts > GATE.prefix` → 게이트를 prefix 판으로 교체 → 앵커에서 `, where installed` 삭제 → `npx vitest run tests/resident-doc-asset-reachability.test.ts` |
| EXIT | **0** (3 passed) |
| 관찰 | 위반 0건 보고. 변이가 **생존**. |
| 판정 | **구현 레인 주장 1 재현됨 (참).** 이슈 #290 의 재현 절차가 정확하다. |

`git stash`·`git checkout` 미사용. prefix 판은 `git show`(읽기)로만 뽑았다.

## B. 수정 후 변이 A → red 이고 리포트가 올바른가

| 항목 | 값 |
|---|---|
| EXIT | **1** |
| 실패 단언 | `지목 대상이 없는 트랙이 있으면 문서가 그 부재를 명시한다` |
| 리포트 | `CLAUDE.md:156  →  model-orchestration (미설치 트랙: csr-fastapi, csr-fastify, csr-supabase, data, executive, full, growth-marketing, project-management, ssr-htmx, ssr-nextjs, tooling)` |
| 대조 | 변이된 파일에서 `grep -n model-orchestration` = **156줄**. `TRACKS`(src/types.ts) = **11종** = 나열된 미설치 트랙 수. |
| 판정 | **줄·자산·미설치 트랙 전부 정확. 주장 2 참.** |

## C. 추가 변이 사냥 — 17종 실행 (표는 §변이 표)

요구된 7종을 전부 포함해 **17종**을 설계·실행했다. **생존 8건**. 그중 게이트 설계에 대한
판정으로 이어지는 것은 결함 §1·2·3·6.

특히 지시 목록 밖에서 찾은 두 건이 크다 — `M10`(ack 누출로 인접 줄이 무조건 면제)과
`M9`(plugin 방식 자산 45종이 모집단 밖). 둘 다 #290 과 **같은 형태의 사각**이다.

## D. 앵커 문안(1a77f77)이 참인가 — 스킬 본문 대조

| 문안 | 스킬 본문 근거 | 판정 |
|---|---|---|
| 구: "which model and which effort level **each lane** gets" | `SKILL.md:127` — "**This lane does not choose models.** The tool runs whatever its own config resolves to" | **거짓이었다.** 외부 실행기 레인에 대해 성립하지 않는다. 커밋의 전제는 참. |
| 신: "decides **which lane takes the work**" | `SKILL.md:59-85` Routing test 가 전 레인 배정을 소유. `SKILL.md:99-108` P1~P5 가 외부 레인 개폐를 결정 | **참.** 외부 레인 포함 전 레인에 대해 성립. |
| 신: "and **how that lane is run**" | `SKILL.md:130-135` — 비대화형 호출·`--help` 확인·worktree 격리·위임 프롬프트/파일핸드오프 계약이 외부 워커에도 그대로 적용 | **참.** 모델 선택을 주장하지 않으면서 운영 방식은 실제로 소유한다. |

**판정: 새 문안은 과장이 아니다.** 다만 관측 하나 — 스킬의 가장 조용한 실패 모드는
`SKILL.md:143-147`("Agent/Task 는 per-invocation `effort` 를 안 받아 spawn 된 에이전트가 세션
effort 를 물려받고 xhigh 바닥값 아래로 조용히 내려간다")인데, 새 문안은 그 단어(`effort`)를
앵커에서 지웠다. 앵커의 역할이 "언제 스킬을 여는가"뿐이고 발화 조건("when work is delegated")은
그대로라 **결함으로 보지 않는다.** 대신 "how that lane is run" 은 거의 모든 것을 가리킬 수 있는
문구라 변별력이 이전보다 낮다는 점만 기록한다(LOW, 결함 8).

## E. 주석의 ADR-019 주장이 사실인가

| 주장 (게이트 주석 61~64줄) | 대조 | 판정 |
|---|---|---|
| `withEcc` 를 켜면 C2 fallback 자산이 **빠진다** | 실측: `withEcc:true` 모집단 36 vs `withEcc:false` 46. 빠지는 10종 = agent-introspection-debugging, build-error-resolver, code-reviewer, continuous-learning-v2, e2e-testing, python-patterns, python-testing, security-reviewer, silent-failure-hunter, strategic-compact | **참** |
| ADR-019 — 플러그인이 켜지면 그쪽이 제공한다 | `docs/decisions/ADR-019-cherry-pick-plugin-gating.md` §Decision 표: `withEcc=true` → cherry-pick **skip**, plugin install | **참. 인용 정확.** |
| 손실이 아니다 — 그 자산들은 기본 설치 루프가 이미 담았다 | 실측: 위 10종 전부 기본 설치 트랙 3~11개 보유. `maxEccOff \ merged = ∅` (켠 쪽·끈 쪽 합집합이 동일한 46) | **오늘은 참** |

**주석에 거짓은 없다.** ADR-048 형 결함(쓰는 시점에 거짓)은 발견되지 않았다.
다만 그 선택 자체가 함수의 이름·계약과 반대로 간다 — 결함 3 참조.

부수 관측(범위 밖): ADR-019 본문의 C2 예시에 `continuous-learning-v2` 가 없고 개수를 19개로 적지만,
실제로는 v26.121.0 에 C3→C2 로 재분류됐고(`src/manifest.ts:157-162` 에 사유 기록) 실측 C2 는 10종이다.
ADR 본문이 stale 하나 코드가 이력을 남기고 있어 이번 PR 의 결함은 아니다.

## F. `npm run ci` 직접 실행

```
npm run ci > run-ci.log 2>&1
CI_EXIT=0        # 파이프 없이 직접 읽음
```

- Test Files **92 passed (92)** · Tests **1338 passed (1338)**
- Branches **88.8% (1332/1500)** — 하한 88 통과. Stmts 96.4 / Funcs 96.11 / Lines 96.9
- biome: `Checked 138 files … No fixes applied` · tsup 빌드 성공
- **구현 레인 주장 5 전부 재현됨(1338 passed · branches 88.8%).**
- 부수 확인: 태그 `v26.145.0` 존재 + `package.json` 26.145.0 → ship-checklist 가 말하는
  "bump 후 태그 전 구조적 red" 구간이 **아니다**. green 이 정상 상태.
- 부수 확인: `npm run cost:report` = `상주 합계 23개 상주 · ~4968 tokens/세션` — 앵커 커밋 메시지의
  수치와 일치.

## G. 범위 침범

```
git diff d033831..HEAD --stat
 templates/CLAUDE.md                           |  2 +-
 tests/resident-doc-asset-reachability.test.ts | 45 +++++++++++++++++++++++++++
```

- 두 커밋 합계 **2파일 · +46 / -1**. `src/` 미변경 · 배포 룰 미변경 · 다른 테스트 미변경.
- `templates/CLAUDE.md` 변경은 1줄이고 #290 과 별건이나 **승인된 별건**으로 지시받았다.
- DO NOT CHANGE 영역 접촉 없음. Non-Goals 침범 없음.
- 작업 종료 시 `git status --porcelain` = `.claude/settings.json`·`.claude/skills/.DS_Store`
  (세션 시작 시점과 동일한 **사용자 소유** 변경) 뿐. 검증이 남긴 흔적 0.
- **판정: 범위 침범 없음.**

---

## 변이 표

기준 명령은 전부 `npx vitest run tests/resident-doc-asset-reachability.test.ts`.
"복원" = 변이 후 스냅샷 역치환 → `shasum -a 256` 이 기준 해시와 일치.

| # | 변이 | 대상 | EXIT | 실패 단언 | 복원 |
|---|---|---|---|---|---|
| A1 | `, where installed` 삭제 (**수정 전 게이트**) | 앵커 156 | **0 생존** | — | OK |
| M1 | `, where installed` 삭제 (수정 후) | 앵커 156 | 1 사살 | 부재를 명시한다 | OK |
| M2 | `task-brief` 조건절 삭제 | 앵커 152 | **0 생존** | — | OK |
| M3 | `clear-korean-communication` 조건절 삭제 | 앵커 149 | 1 사살 | 부재를 명시한다 | OK |
| M4 | 모집단 보강 루프 삭제(119~125줄) | 게이트 | 1 사살 | manifest 에서 실제로 뽑는다 | OK |
| M5 | `maximalSpecFor.selectedInternalSkills` 를 `[]` 로 | 게이트 | 1 사살 | manifest 에서 실제로 뽑는다 | OK |
| M6a | `maximalSpecFor.withEcc` → `false` | 게이트 | **0 생존** | — | OK |
| M6b | `maximalSpecFor.withTauri` → `false` | 게이트 | **0 생존** | — | OK |
| M7 | 보강 루프 삭제 + zeroTrack canary 를 `toBeGreaterThan(-1)` 로 약화 | 게이트 | **0 생존** | — | OK |
| M8 | 상주 **룰**에 `model-orchestration` 지목 추가(조건절 없이) | doc-governance.md | 1 사살 | 부재를 명시한다 | OK |
| M9 | 상주 룰에 `frontend-design` 지목 추가 | doc-governance.md | **0 생존** | — | OK |
| M10 | 앵커 **끝**에 `implementer` 지목 추가 | 앵커 158 | **0 생존** | — | OK |
| M10b | 같은 줄을 **46줄 뒤**에 삽입 | 앵커 48 | 1 사살 | 부재를 명시한다 (`CLAUDE.md:48 → implementer`, 미설치 executive·growth-marketing·project-management) | OK |
| M11 | 지목에서 백틱 제거(`- model-orchestration —`) | 앵커 156 | **0 생존** | — | OK |
| M15 | 조건절을 무관한 `근거가 없으면 …` 로 치환 | 앵커 156 | **0 생존** | — | OK |
| M16 | 상주 룰에 `external-model-consult` 지목 추가 | doc-governance.md | 1 사살 | 부재를 명시한다 | OK |
| M17 | Codex 앵커 템플릿에 `implementer` 지목 추가 | codex/AGENTS.md.template | **0 생존** | — | OK |

전 변이 종료 후 최종 확인: 4개 파일 shasum 전부 기준값 일치 · 게이트 재실행 EXIT 0 · `git status` 청결.

### 계측 (프로브 4회, `buildManifest` 를 직접 돌려 산출)

| 지표 | 수정 전 | 수정 후 |
|---|---|---|
| 모집단(`assetTracks`) | **44** | **46** |
| 신규 편입 | — | `external-model-consult`, `model-orchestration` (둘 다 `installedOn = ∅`) |
| 탐지된 지목(`references`) | **4** | **5** |
| `INTERNAL_BUNDLED_SKILL_IDS` 12종 모집단 진입 | 10/12 | **12/12** |

**구현 레인 주장 3(44→46, 신규 2종) 독립 재현 완료.**

---

## 결함

### 1. [HIGH · 선재] ack 누출 — 앵커 146~158줄 전체가 무조건 면제 구역이고, #290 이 새로 보이게 만든 자산이 정확히 거기 산다

- **증거**: `M10` — 미설치 3트랙짜리 `implementer` 지목을 앵커 끝(158줄)에 추가 → **EXIT 0 생존**.
  같은 문장을 48줄에 넣은 `M10b` → **EXIT 1** 로 정확히 물었다. 차이는 위치뿐이다.
- **원인**: `ACK_WINDOW = 160` 이 문자 창이라, **다른 자산의 조건절**이 창 안에 들어오면 그것이
  면제로 쓰인다. `- \`model-orchestration\`, where installed` 의 `where installed` 가 158줄의
  새 지목까지 덮는다(거리 ~121자 < 160).
- **범위 계측**(프로브: 각 줄머리에 가상의 12자 지목을 놓고 창을 평가):

  | 상주 문서 | 면제 줄 | 비율 | 구간 |
  |---|---|---|---|
  | `templates/CLAUDE.md` | 13/158 | 8.2% | **146–158** |
  | `templates/rules/playwright-launch.md` | 7/17 | 41.2% | 4–10 |
  | 나머지 룰 6종 | 0 | 0% | — |

- **왜 이 PR 에서 중요한가**: 146–158 = `## Skills that apply continuously` 절 전체다. #290 이
  모집단에 새로 넣은 `model-orchestration`·`external-model-consult` 가 사는 곳이고, 앞으로 상주
  스킬 줄이 추가될 곳도 여기다. 이 구역에서 게이트가 무는 조건은 **"그 구역의 ack 리터럴이
  전부 사라질 때"** 로 좁아진다 — 줄 하나를 지운 M1 은 잡히지만(마진 약 4자), 줄을 **추가**하는
  방향은 전부 통과한다.
- **재현**: `printf '\n- Hand implementation to the \`implementer\` agent.\n' >> templates/CLAUDE.md`
  → 게이트 EXIT 0. 같은 줄을 46줄 뒤에 삽입하면 EXIT 1.
- **판단**: 선재 결함(ACK_WINDOW 는 이 PR 이 안 건드렸다)이나, **이 PR 의 실효 범위를 직접 제한**한다.
  게이트가 노리는 시나리오의 절반(줄 추가)이 대상 구역에서 통째로 빠진다.

### 2. [MEDIUM · 선재] plugin·marketplace·git 방식 자산 45/57 은 아직도 모집단 밖 — #290 과 같은 형태의 사각

- **증거**: `M9` — 상주 룰에 `` `frontend-design` 스킬 `` 지목을 조건절 없이 추가 → **EXIT 0 생존**.
- `frontend-design` 은 `condition: has-dev-track`(src/external-assets.ts:521)이라 executive ·
  project-management · growth-marketing **3트랙에서 미설치**다. 게이트 자기 주석이 든 결함 형태 ②
  ("전 트랙 설치인 CLAUDE.md 가 dev 트랙 전용 자산을 지목")와 **정확히 같다.**
- **원인**: 모집단이 `buildManifest` 산출 `.claude/{rules,agents,skills,hooks,commands}/` 대상뿐이다.
  `method.kind` 가 plugin/git-clone 인 자산은 애초에 거기 안 나온다. 계측: 카탈로그 id **45/57 이
  모집단 밖** — `frontend-design`, `superpowers`, `bmad-method`, `shadcn-ui`, `tauri-desktop`,
  `web-design-guidelines`, `openspec` 등.
- **주의할 서술**: 커밋 메시지는 "모집단을 **선택 축을 켠 manifest** 에서 함께 derive 해 자리를
  만든다"라고 일반형으로 쓰지만, 실제로 자리가 생기는 축은 `selectedInternalSkills` **하나**다
  (`withTauri`·`withEcc` 는 결함 3·4). 거짓은 아니나 커버 범위를 실제보다 넓게 읽히게 한다.
- **현재 실害**: 없음(오늘 상주 문서가 이 45종을 하나도 지목하지 않는다 — references 5건 전수 확인).
  잠재만 있다.

### 3. [MEDIUM · 이 PR] `maximalSpecFor` 의 `withEcc: true` 는 함수 이름·계약과 **반대**로 작동한다

- **증거**: `M6a`(→`false`) **생존**. 프로브 실측 — `withEcc:true` 모집단 **36**, `withEcc:false` **46**.
  즉 "선택 축을 켠다"가 이 축에서는 **10종을 빼는** 동작이다.
- `src/manifest.ts` 전수 확인 — `s.withEcc` 를 **양(+)의 방향으로 읽는 게이팅은 0개**다
  (`grep -n "s\.withEcc" src/manifest.ts | grep -v "!s\.withEcc"` → 주석 1줄만). 따라서 `true` 는
  **얻는 것이 0이고 잃는 것만 있다.**
- 주석은 이 사실을 정직하게 적고 "기본 설치 루프가 이미 담았으니 손실 아님"이라 논증하며, **그 논증은
  오늘 참이다**(§E). 문제는 계약이다 — 함수 이름이 `maximalSpecFor` 이고 주석이 "선택 가능한 것을
  전부 켠 manifest" 라고 선언하는데, 이 축에서 진짜 maximal 은 `false` 다.
- **잠재 사각**: 앞으로 `applies: (s) => !s.withEcc && <어느 트랙도 기본 만족 못 하는 조건>` 형태의
  항목이 생기면 두 루프 어디에도 안 잡힌다 — **#290 이 막으려던 바로 그 부류**가 다른 축으로 재발한다.
- **수정 방향(구현 레인 몫)**: `withEcc: false` 로 두면 그 루프 단독으로 46 이 나온다. 또는 두 극성을
  모두 도는 것이 계약에 맞다.

### 4. [LOW · 이 PR] `maximalSpecFor` 의 `withTauri: true` 는 완전한 무동작

- **증거**: `M6b`(→`false`) **생존**. 프로브 — `withTauri` 를 뒤집어도 모집단 차집합 **양방향 0**.
- `src/manifest.ts:23-26` 이 스스로 적고 있다 — "tauri **룰**이 배포에서 빠져 이 필드를 읽는 게이팅은
  현재 없다". 그래서 `tauri-desktop` 은 `withTauri:true` 를 켜도 **여전히 모집단 밖**이다.
- 게이트 34줄의 옛 주석("opt-in 으로만 깔리는 문서 — 예: tauri — 는 … 대상 밖이다")과 새 주석
  ("선택하면 깔릴 수 있는 자산에 자리를 만든다")이 같은 파일에서 서로 다른 것을 말한다.
  실제 동작은 **옛 주석 쪽**이다.

### 5. [MEDIUM · 선재 + 이 PR 이 악화] `references` canary 의 `// 실측 3` 주석이 거짓이고 하한이 실측에서 3 벌어졌다

- **증거**: 프로브 실측 — 수정 **전 4**, 수정 **후 5**. 파일 229줄은 `expect(references).toBeGreaterThan(2); // 실측 3`.
- 즉 주석은 이 PR **이전에 이미** 거짓이었고(4≠3), 이 PR 이 4→5 로 한 칸 더 벌리면서 갱신하지 않았다.
  지금 지목이 **5→3 으로 40% 소실돼도** canary 는 통과한다.
- 같은 파일 247줄의 `docTracks` 하한은 "리뷰 MEDIUM-4: 절반 소실도 놓치는 하한은 canary 가 아니다"라는
  사유로 실측 8 에 대해 `>7` 까지 조여 놨다. **같은 기준이 이 canary 에는 적용되지 않았다.**
- 이 리포는 "쓰는 시점에 거짓인 문장"에 전례(ADR-048)가 있어 별도 축으로 본다. 파일이 이번에 열렸고
  수치도 이번에 움직였으므로 **이 PR 에서 함께 고치는 것을 권한다**(주석 `실측 5` + 하한 `>4`).

### 6. [MEDIUM · 선재] 다른 CLI 의 상주 앵커(AGENTS.md 계열)는 게이트 밖

- **증거**: `M17` — `templates/codex/AGENTS.md.template` 에 `implementer` 지목 추가 → **EXIT 0 생존**.
- `isResidentDoc` 는 `HARNESS_ANCHOR_FILE` 과 `.claude/rules/*.md` 만 본다. Codex/OpenCode/Antigravity 의
  `AGENTS.md` 는 `templates/{codex,opencode,antigravity}/AGENTS.md.template` 이 `CLAUDE.md` 본문을
  **감싸서** 만들어지는데(`src/codex/agents-md.ts:24`), **감싸는 껍데기 쪽 문장**은 검사되지 않는다.
- **현재 실害**: 없음. 세 템플릿을 전수 grep 한 결과 자산 id 지목 **0건**(`main`·`memories`·
  `permission`·`instructions` 만 백틱 안에 있고 자산이 아니다).
- 이 리포의 재발 기록 중 "한 축이 계열 일부에만 있으면 빠진 쪽이 입증 책임"에서 **CLI 종류**가
  3연속 적발 축 중 하나였다. 잠재이지만 축이 비어 있다는 사실은 기록해 둔다.

### 7. [LOW · 관측] 앵커 3줄 중 게이트가 무는 것은 2줄뿐 — `task-brief` 줄의 조건절은 강제되지 않는다

- **증거**: `M2`(task-brief 조건절 삭제) **생존**. 원인은 회피가 아니라 사실 — `task-brief` 는 **11트랙
  전부 기본 설치**라 미설치 트랙이 0이다(프로브 실측).
- 앵커 절 머리말은 "Each is selected individually at install time, hence the condition on every line" 라고
  **세 줄 모두에 같은 근거**를 주장한다. 게이트가 지지하는 것은 `clear-korean-communication`(3트랙 부재)과
  `model-orchestration`(11트랙 부재) 두 줄뿐이다.
- `--without <id>` 로 빠지는 경우는 게이트 기준선("평범하게 깔았을 때")밖이며, 이는 게이트 33~34줄이
  의도적으로 선언한 범위다. **결함이라기보다 강제 범위의 정직한 한계**로 기록한다.

### 8. [LOW · 문서화된 한계 재확인] 어휘 매칭 우회 2종

- `M15` — 조건절을 무관한 `근거가 없으면 …` 으로 바꾸면 **생존**. 게이트 159~161줄이 "성의 없는 면제
  문구는 못 잡는다"고 이미 적어 둔 그대로다.
- `M11` — 백틱을 빼면(`- model-orchestration —`) 지목 자체가 탐지되지 않아 **생존**. 게이트 130~133줄의
  "참조 형태 4종만 본다"는 선언대로다.
- 둘 다 파일이 스스로 밝힌 한계라 **새 결함으로 세지 않는다.** 다만 결함 1 과 겹치면 우회 경로가 셋이 된다.

### 9. [LOW · 설계상 당연] zeroTrack canary 를 약화하면 아무도 안 잡는다

- `M7`(보강 루프 삭제 + canary 를 `toBeGreaterThan(-1)`) **생존**. `assetTracks.size > 20` 은 46→44 를
  못 본다.
- canary 의 성질상 당연하나, **#290 재발을 막는 방어선이 그 한 줄 단독**임을 기록해 둔다.

---

## 잘 된 것 (구체 관찰만)

- **초록으로 태어난 게이트가 아니다.** `M4`(보강 루프 삭제)·`M5`(스킬 축 비우기) 둘 다 canary 가
  물었다 — 커밋 메시지의 "canary 자체도 음성 대조로 확인했다"가 재현된다.
- **자산 id 열거를 끝까지 피했다.** `INTERNAL_BUNDLED_SKILL_IDS` 12종이 모집단에 **12/12** 진입하고,
  두 신규 편입도 열거가 아니라 derive 결과다. 새 opt-in 번들 스킬이 생겨도 게이트 수정이 불필요하다.
- **앵커 전용 게이트가 아니다.** `M8`·`M16` — 상주 **룰**에 zero-track 자산을 지목해도 물었다.
- **리포트가 쓸 만하다.** 문서:줄 → 자산 → 미설치 트랙 전량을 찍는다. 줄 번호를 직접 대조해 정확했다.
- **주석에 거짓이 없다.** ADR-019 인용을 원문과 대조해 확인했고(§E), `withEcc:true` 의 부작용을
  숨기지 않고 먼저 적어 놨다. 결함 3 은 그 정직한 서술에도 불구하고 **선택이 계약과 어긋난다**는 지적이지
  거짓 주장에 대한 지적이 아니다.
- **범위가 좁다.** 2파일 46줄. 게이트 수정이 `src/` 를 한 줄도 건드리지 않았다.

---

## 미검증

| 항목 | 이유 |
|---|---|
| 실제 설치 산출물에서의 도달성 | 게이트는 `buildManifest` 를 돌릴 뿐 실제 `install` 을 하지 않는다. 호스트 실 CLI 실행은 훅이 차단하고 `test/docker/run.sh` 는 이번 범위 밖으로 판단해 돌리지 않았다. |
| Codex/OpenCode/Antigravity 로 설치했을 때의 상주 실물 | 위와 같음. §결함 6 은 **템플릿 소스 grep + 게이트 변이**로만 판정했고 렌더 산출물은 안 봤다. |
| `--without <id>` opt-out 경로 | 게이트 기준선이 기본 설치라 이 축은 게이트가 아예 모델링하지 않는다(§결함 7). 별도 테스트가 있는지 확인하지 않았다. |
| `install-matrix.yml` · 릴리즈 CI | 태그 push 트리거라 로컬에서 발화시킬 수 없다. 이번 변경은 테스트/문서 2파일이라 설치 매트릭스에 영향이 없다고 **추정**하나 실행 증거는 없다. |
| `npx ecc-agentshield scan` · `npm audit` | ship 게이트 항목이나 머지 단 검증 범위 밖으로 판단해 미실행. |
| 상주 비용 baseline **동일성** | `cost:report` 로 `~4968 tokens/세션` 은 재현했으나 baseline 파일과의 **차이 0** 을 직접 비교하지는 않았다. `npm run ci` 안의 비용 수치 게이트가 통과했다는 간접 증거만 있다. |
| `maximalSpecFor` 미사용 시 typecheck | `M4`(보강 루프 삭제)는 vitest 로만 돌렸다. 그 상태의 `tsc` 통과 여부는 확인하지 않았다 — 변이가 canary 로 사살됐으므로 추가 확인이 불필요하다고 판단. |

---

## 처리 결과 (오케스트레이터 · 검증 레인 판정 이후 추가)

위 §판정~§미검증은 검증 레인의 산출물이며 **수정하지 않았다.** 아래는 그 지적에 대한 처분이다.

| 결함 | 처분 | 근거 |
|---|---|---|
| 3 `withEcc: true` 가 이름·계약과 반대 | **수정** — 두 플래그를 제거하고 함수명을 `populationSpecFor` 로. 실제로 자리를 만드는 축(`selectedInternalSkills`)만 남겼다 | 켜서 얻는 자산이 0이고 잃는 것만 있다는 지적이 실측으로 맞다. 반대 극성을 지금 도는 것은 없는 것을 위한 방어라 기각(원칙 2) — 그 판단 근거를 주석에 남겼다 |
| 4 `withTauri: true` 무동작 | **수정** — 위와 같은 커밋에서 제거 | `manifest.ts` 가 스스로 "이 필드를 읽는 게이팅은 현재 없다"고 적고 있다 |
| 5 `references` canary 주석이 거짓·하한이 느슨 | **수정** — 주석 `실측 5`, 하한 `>2` → `>4` | 실측이 정확히 5임을 `>5` 로 조여 red(`expected 5 to be greater than 5`)를 받아 확인했다. `docTracks` 하한과 같은 기준으로 맞췄다 |
| 1 ack 누출 (HIGH · 선재) | **이 PR 밖 — 이슈로 이월** | `ACK_WINDOW` 판정 범위 설계 문제이고, 좁히면 기존 정당한 면제(`playwright-launch` 7/17)가 깨질 수 있어 별도 조사가 필요하다. **이 PR 의 실효 한계로 PR 본문에 명시한다** |
| 2 plugin·git 방식 자산 45종 모집단 밖 (MEDIUM · 선재) | **이 PR 밖 — 이슈로 이월** | 현재 실害 0(지목 5건 전수 확인). #290 과 같은 형태의 사각이므로 별건으로 추적 |
| 6 다른 CLI 앵커 껍데기가 게이트 밖 (MEDIUM · 선재) | **이 PR 밖 — 이슈로 이월** | 현재 실害 0(세 템플릿 지목 0건) |
| 7·8·9 (LOW) | **수정 없음** | 7·8 은 게이트가 스스로 밝힌 한계, 9 는 canary 의 성질. 기록으로 남긴다 |

수정 후 재확인(오케스트레이터 직접 실행): 원 재현 변이 A → **EXIT 1** 유지 · 무변이 → EXIT 0 ·
`npm run ci` → **exit 0 · 1338 passed · branches 88.8%** · 앵커/게이트 파일 HEAD 와 일치.

## 범위 밖 한 줄 — 이슈 #289

이번 PR 과 무관하며 검사하지 않았다. 다만 §결함 1 의 면제 구역(앵커 146–158)이 #289 가 다루는
상주 3층 중복 구간과 겹치므로, #289 를 착수할 때 이 구역의 문구를 옮기면 **ack 리터럴이 사라져
게이트가 갑자기 빨개질 수 있다**는 점만 남긴다.

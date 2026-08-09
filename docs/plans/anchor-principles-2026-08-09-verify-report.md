# 배포 앵커 7원칙 재편 — 독립 검증 보고 (#287 / ADR-068)

- 대상 커밋: `48ad694` · 브랜치 `refactor/anchor-working-principles`
- 검증 레인: 이 변경을 만들지 않은 리뷰어. 구현 보고서(`…-impl-report.md`)는 **이전 판본**
  기준이라 참고만 하고 **모든 수치를 재측정**했다.
- 검증 일자: 2026-08-10

---

## 판정 한 줄

**조건부 머지 가능 — P0 없음.** 앵커 자체는 게이트 4/4 가 실제로 물고, 배포 위생 8/8 이 깨끗하고,
NORTH_STAR 수치는 전부 재현된다. 다만 **앵커가 룰 층과 같은 사실을 3중으로 말하는 곳 1건과,
리뷰 시점을 서로 다르게 말하는 모순 1건**이 남아 있다(P1 2건). 이 둘은 앵커를 고치는 게 아니라
**어느 층이 소유할지 정하는 결정**이라 사용자 판단이 필요하다.

이 변경의 핵심 주장은 "중복 6건을 걷어냈다"였다. 걷어낸 것은 사실이다 — `HEAD~1` 에 있던
`"Unless this repository defines otherwise, a merge is gated on regression tests…"` 한 줄이
실제로 사라졌고, 이는 `ship-checklist` 와의 중복이었다. **그러나 더 남아 있다.**

---

## 1. `npm run ci` — 내가 다시 돌린 결과

```
$ npm run ci > /tmp/verify-ci-baseline.txt 2>&1; echo "EXIT=$?"
EXIT=0
```

| 항목 | 실측 | 게이트 |
|---|---|---|
| Test Files | **91 passed (91)** | — |
| Tests | **1296 passed (1296)** | — |
| Statements | 96.4% (2280/2365) | 90 |
| **Branches** | **88.8% (1332/1500)** | **88** (가장 빡빡한 게이트) |
| Functions | 96.11% (396/412) | 90 |
| Lines | 96.9% (2098/2165) | 90 |
| Duration | 20.42s | — |

변이 실험을 전부 끝낸 뒤 **재실행**해서 원복이 완전한지 확인했다 — 같은 값으로 `EXIT=0`
(`Test Files 91 / Tests 1296 / Branches 88.8%`).

Branches 여유는 **0.8%p** 다. 이 변경은 코드를 안 건드렸으므로 이 변경의 리스크는 아니다.

---

## 2. 중복 대조 — **이 리뷰의 본론**

앵커의 각 문단을 ⓐ `templates/rules/*.md` 7종 ⓑ `src/project-claude-merge.ts` 의 `FILL_SPECS`
ⓒ 상시 적용 스킬 3종과 전부 대조했다. 결과는 **중복 3건 · 모순 1건 · 앵커 내부 중복 1건**이다.

### 2-1. 【P1】 리뷰 시점에 대해 두 층이 **다른 답**을 준다 (모순)

```
$ grep -n "before deployment" templates/CLAUDE.md
96:before it is built on, and for any completed change before deployment.

$ grep -n "머지는 그 변경을 만들지 않은" templates/rules/ship-checklist.md
5:- **머지는 그 변경을 만들지 않은 레인의 리뷰를 거친다.** … 배포 직전이 아니라 **머지 시점**이다
   — 리뷰 없이 쌓인 변경은 배포 때 형식만 채워진다.
```

- 앵커 §5: 독립 리뷰는 **"배포 전"** 두 지점에서 필요하다.
- `ship-checklist`: **"배포 직전이 아니라 머지 시점이다"** — 앵커가 유도하는 읽기를 명시적으로 **부정**한다.

둘 다 매 세션 무조건 상주한다. 설치자는 "언제 리뷰하는가"에 대해 서로를 부정하는 두 문장을 동시에 받는다.

**왜 P1 인가**: 이 사이클이 근거로 삼은 1차 출처가 지목하는 **유일한 방향성 변수가 "모순"**이다 —
`primary-anthropic-steering.md` §7: *"the more instructions you provide using this method, the less
strictly Claude will follow them, **particularly if any contradict**."* 이 원장을 근거로 쓴 변경이
그 원장이 지목한 축을 새로 만들면 안 된다.

**의견 — 어느 쪽에 남길까**: `ship-checklist` 쪽이 맞다. "머지 시점"이 더 강한 요구이고 실패 서사
(v26.138.0 거짓출하)가 그쪽에 붙어 있다. 앵커 §5 를 `before deployment` → 머지를 포함하는 표현으로
넓히거나, 시점 판정을 아예 `ship-checklist` 로 넘기고 앵커는 "누가"만 소유하는 것이 깔끔하다.

### 2-2. 【P1】 앵커 §5·§7 ↔ `templates/rules/test-policy.md` — **같은 사실 4건**

| # | 사실 | 앵커 | `test-policy.md` | 추가 사본 |
|---|---|---|---|---|
| a | 실행하지 않은 검사는 통과가 아니다 | §7:124 `Do not claim Pass, Works, or Completed without evidence` | :13 `Never report a check as passed unless it was executed and observed` | **`ship-checklist`:6 `실행하지 않은 검사는 통과가 아니다`** → **3중** |
| b | 검증한 것/안 한 것/남은 것을 보고하라 | §7:121 `Report what changed, what was verified and how, … what was not verified, and what remains` | :20 `Report what was tested, what was not tested, and the remaining risk` | — |
| c | 위험에 비례해 검증 범위를 넓혀라 | §5:90 `Run targeted checks first, then broaden according to risk` | :2 `evidence proportional to its requirements and risk` / :18 `If the affected scope cannot be established confidently, broaden the validation` | — |
| d | 기준을 약화시켜 통과시키지 마라 | §5:91 `Do not weaken or silently omit criteria` | :15 `Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage` | — |

(a) 는 **세 층이 동시에** 말한다. `doc-governance` 의 첫 줄 —
*"한 사실은 한 곳에. 같은 내용을 두 문서에 쓰지 않는다 — 한 곳에 두고 나머지는 가리킨다"* — 을
이 저장소가 스스로 어기고 있다. 세 파일 전부 무조건 상주라 비용도 3중이다.

**의견 — 어느 쪽에 남길까**:
- (a)(b) 는 **앵커 §7 이 소유**한다(테스트만의 규율이 아니라 모든 산출물의 보고 규율이다).
  `test-policy` 의 마지막 두 줄과 `ship-checklist` 의 해당 절을 앵커로 가리키게 줄인다.
- (c)(d) 는 **`test-policy` 가 소유**한다(테스트 기법에 붙은 구체 규율이고, 앵커의 §5 는
  같은 말을 한 단계 추상화만 해서 얻는 게 없다).

### 2-3. 【P2】 앵커 §2 ↔ `test-policy` — 계약 경계 테스트

```
앵커 §2:35   Prefer regression tests at stable contract boundaries.
test-policy:4 Test observable behavior, contracts, and invariants rather than reproducing
              implementation details.
```
같은 처방이다. `test-policy` 쪽이 "왜 그런가"(구현 디테일 재현 금지)까지 담고 있어 더 낫다.

### 2-4. 【P2】 앵커가 **자기 자신과** 중복한다 — `verified-unused` 가 §3·§4 두 곳

```
$ grep -n "verified.unused\|verified as unused" templates/CLAUDE.md
67:data requires it. Delete verified-unused paths instead of adding compatibility
68:layers, fallbacks, dual paths, or migrations. A path counts as verified-unused
77:obsolete by the change or paths verified as unused and safe to remove.
```
§3 이 개념과 **판별 조건**(저장소 안 호출자 0건일 때만)을 정의하고, §4:77 이 조건 없이 같은 허가를
반복한다. §4 만 읽는 독자는 §3 이 붙인 안전장치를 못 본다 — 커밋 메시지가 "가장 크다"고 강조한 바로
그 위험(공개 API 전체가 삭제 대상)이 §4 경로로 되살아난다.

### 2-5. 【P2】 `## Presenting a decision` ↔ `clear-korean-communication` 스킬

| 앵커 (L133-138) | 스킬 |
|---|---|
| `AS-IS → TO-BE with a recommendation and the trade-off, not as prose` | Part 2 "The four slots": 추천+이유 / 전후맥락 / UI/UX 형태 / ASIS→TOBE |
| `Give the surrounding before/after context in enough detail` | `전후맥락 — the forces at play in plain language` |
| `show the choice the way they will meet it — a comparison table, a sketch` | `UI/UX 형태 — one scannable table or option list, never a wall of prose` |
| `fix what the words point at before rewording; the usual cause is one name meaning two things` | Part 1 Step 1 `does any name … point at more than one thing?` |

**전량 중복이지만 방어 가능하다** — 실측상 스킬은 11 트랙 중 3곳(executive · project-management ·
growth-marketing)에 **안 깔린다**(아래 5절 표). 그 3곳에서는 앵커가 유일한 carrier다.
다만 앵커 스스로 `including the AS-IS → TO-BE form above` 로 중복을 인정하고 있으므로, 8개 dev
트랙에서는 124 tok 이 순수 중복이다. 유지 판단이면 그 사유(3 트랙 fallback)를 남겨야 한다.

### 2-6. `FILL_SPECS` 대조 — 중복 **없음** (양호)

`FILL_SPECS['installed-assets']` 가 스스로 방어선을 치고 있다:
> `Do NOT restate the harness's working principles (they live in this project's harness anchor and
> rules layer) — cross-reference them instead.`

앵커 §3:58 `inspect installed dependencies and verify their versions…` 과 `FILL_SPECS.stack` 의
`Inspect package.json / … Verify each command exists before writing it` 는 표현이 닮았지만
**행위가 다르다**(문서 한 절을 채우는 일 vs 패키지를 추가할 때의 행동). 중복으로 세지 않는다.

---

## 3. 원칙이 아닌 것이 남아 있는가

판정 기준 = `docs/research/claude-md-standards-2026-08-09/primary-anthropic-steering.md` §6.

| 후보 | ⓐ도구/경로 결박 | ⓑ절차 | ⓒ파일 보면 아는 것 | 판정 |
|---|---|---|---|---|
| §1~§7 본문 | 없음 (위생 검사 8/8 clean) | 없음 — 순서 있는 다단계 없음 | 없음 | **통과** |
| §5 "two points" | — | 경계선 — 원장 자신이 *"부분 해당, 절차 상세는 스킬로 내릴 수 있다"* 로 이미 분류 | — | 허용 |
| §6 마지막 문단 `These principles shape decisions; they do not block actions…` | — | — | — | **P2 — 원칙이 아니라 문서에 대한 메타 해설**이고, §6(승인 경계)과 주제가 다른데 그 절에 얹혀 있다 |
| `## Skills that apply continuously` 첫 문단 (~87 tok × 4 CLI 앵커) | — | — | — | **P2 — 하네스 내부 동작 해설.** 설치자에게 "왜 이 세 줄이 여기 있는가"는 작업 원칙이 아니다 |
| `task-brief` 줄 | — | — | — | **P2 — 안티패턴 정면**, 아래 별항 |

### 【P2】 `task-brief` 줄은 Anthropic 안티패턴 1번에 정확히 걸린다

원장 인용: *"**'Every time X, always do Y' in CLAUDE.md.** … use a hook in settings.json instead."*

`task-brief` 줄이 지시하는 것은 "요청이 오면 **항상** 브리프로 정규화하라"이다. 그리고
**이미 훅이 있다**:

```
$ grep -rn "task-brief-nudge" templates/ src/
templates/settings.json:50  "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/task-brief-nudge.sh\""
src/manifest.ts:148         "task-brief-nudge.sh"   ← ALWAYS_HOOKS (전 설치본)
```
훅은 `UserPromptSubmit` 에서 `길이 ≥ 400자 && <objective> 부재` 를 결정적으로 판정해 넛지를 낸다.
즉 같은 행위에 **훅 + 스킬 description + 앵커 줄** 세 carrier가 붙어 있다.

**다만 감경 사유가 있다**: 훅은 `.claude/hooks/` 로만 나가므로 **Claude Code 전용**이다
(`templates/codex/`·`opencode/`·`antigravity/` 에 대응 훅 없음). 4 CLI 중 3곳에서는 앵커 줄이
유일한 carrier다. → **삭제가 아니라 "Claude Code 에서는 훅이 이미 한다"는 사실을 어디에 적을지**의 문제.

---

## 4. 음성 대조 — 게이트가 실제로 무는가

**규율**: 변이 전 `cp` 백업 → 변이 하나 → 해당 단언만 red 확인 → 백업에서 `cp` 복원 → `shasum` 대조.
`git checkout`·`git restore` **미사용**.

기준 shasum: `c7782bec78a52270626ba493b38682fa44e91484cae75d58431e68ed4778a47a`
기준 상태: `npx vitest run tests/lane-principle-anchor-parity.test.ts tests/resident-doc-asset-reachability.test.ts` → **30 passed, EXIT=0**

| # | 변이 | 예상 | 실측 | 원복 shasum |
|---|---|---|---|---|
| 1 | §5 `verifies the work itself rather than trusting…` → `reads the completed work` | 축2 red | ✅ **[검증의 자기 증거] 축 4 CLI 전부 red** (4 failed / 23 passed) | 일치 |
| 2 | §5 `other than the one that produced the work` → `by another agent` | 축1 red | ✅ **[설계 리뷰 분리] 축 4 CLI 전부 red** (4 failed / 23 passed) | 일치 |
| 3 | §1 적대적 패널 문장을 **다른 문단으로 분리** | 축3 red (문단 스코프) | ✅ **[적대적 패널의 문턱] 축 4 CLI 전부 red** | 일치 |
| 4 | `## Skills that apply continuously` 절 삭제 (17줄) | reachability canary red | ✅ **`지목을 실제로 찾아낸다 (헛통과 차단)` red** (`references > 2` 실패) | 일치 |

### 변이 3 이 가장 강한 증거다

```
$ diff /tmp/anchor-ORIG.md /tmp/anchor-mut3.md
21c21,23
< options and trade-offs and ask before proceeding. When independent lanes
---
> options and trade-offs and ask before proceeding.
>
> When independent lanes
```
**낱말 0개 변경. 빈 줄 1개 추가.** 그것만으로 red 가 되고, 실패 사유가
`"두 성분이 **서로 다른 문단**에 흩어져 있다 — 한 문단 안에 같이 두어라 (짝 없음)"` 로 나온다.
이 게이트는 낱말의 존재가 아니라 **의미의 짝**을 센다 — 장식이 아니다.

### 【P2 · 리뷰어가 추가한 변이 5 — **생존했다**】

의뢰 4건 외에 내가 하나 더 걸었다: **11 트랙 전부에서 안 깔리는** `model-orchestration` 의
`, where installed` 조건절만 지운다.

```
$ diff  (원본 → 변이)
155c155
< - `model-orchestration`, where installed — when work is delegated, it decides
---
> - `model-orchestration` — when work is delegated, it decides

$ npx vitest run tests/resident-doc-asset-reachability.test.ts
EXIT=0   Tests  3 passed (3)      ← 생존
```

대조군으로 같은 변이를 `clear-korean-communication`(11 트랙 중 **3곳**에서만 부재)에 걸면 문다:
```
× 지목 대상이 없는 트랙이 있으면 문서가 그 부재를 명시한다
  CLAUDE.md:148 → clear-korean-communication (미설치 트랙: executive, growth-marketing, project-management)
```

**근본 원인을 기계로 규명했다** — 게이트의 `assetTracks` 색인은 *실제로 설치되는 것*에서만 만들어진다.
어느 트랙에도 안 깔리는 자산은 색인에 **아예 없어서** 루프가 검사조차 하지 않는다:
```
clear-korean-communication     IN assetTracks index (gate can see it)
task-brief                     IN assetTracks index (gate can see it)
model-orchestration            NOT in index -> GATE IS BLIND TO IT
```
즉 **자산이 더 많이 부재할수록 게이트가 덜 신경 쓴다**(부재 3/11 → 물고, 부재 11/11 → 못 봄).

**이 커밋의 결함은 아니다** — `model-orchestration` 줄은 `HEAD~1`(#281)에 이미 있었고, 문안 자체는
`where installed` 로 올바르다. 다만 **아무도 몰랐던 게이트 사각지대**이므로 기록한다.
(지시대로 게이트는 고치지 않았다.)

### 워킹트리 최종 상태

```
$ shasum -a 256 templates/CLAUDE.md /tmp/anchor-ORIG.md ; git show HEAD:templates/CLAUDE.md | shasum -a 256
c7782bec…78a47a  templates/CLAUDE.md
c7782bec…78a47a  /tmp/anchor-ORIG.md
c7782bec…78a47a  -                      ← 커밋본과도 바이트 동일

$ git status --short
 M .claude/settings.json
 M .claude/skills/.DS_Store
```
세션 시작 시점과 **동일** — 사용자 소유 2개 파일뿐. git 상태를 바꾸는 명령은 쓰지 않았다.

---

## 5. 문안이 사실인가 — 배선 대조

### 5-1. 이름으로 부르는 스킬 3종은 실재하는 자산인가 — **예**

셋 다 `src/external-assets.ts` 의 `EXTERNAL_ASSETS` 에 있고 `INTERNAL_BUNDLED_SKILL_IDS` 에 등재돼
있다. `src/installer.ts:461` 이 이 목록을 `isAssetSelected` 로 걸러 `selectedInternalSkills` 를
만들고, 그 값이 `.claude/` manifest 복사와 **3개 비-Claude CLI transform 에 모두** 전달된다(`:323`).

### 5-2. 기본 설치 기준 트랙별 실제 도달 (내가 `isAssetSelected` 로 직접 산출)

| 트랙 | clear-korean-communication | task-brief | model-orchestration |
|---|---|---|---|
| tooling / csr-* / ssr-* / data / full | INSTALLED | INSTALLED | **ABSENT** |
| executive | **ABSENT** | INSTALLED | **ABSENT** |
| project-management | **ABSENT** | INSTALLED | **ABSENT** |
| growth-marketing | **ABSENT** | INSTALLED | **ABSENT** |
| **부재 트랙 수** | **3 / 11** | **0 / 11** | **11 / 11** |

- `clear-korean-communication` = `has-dev-track` → `where installed` **필요하고 정확**. ✅
- `task-brief` = `any-track: [...TRACKS]` → **기본 설치에서 11/11 전부 깔린다.**
- `model-orchestration` = `opt-in` → **기본 설치에서 한 트랙도 안 깔린다.**

### 5-3. 【P2】 `Each is selected individually at install time, hence the condition on every line.`

`task-brief` 에 대해 **부정확하다**. `task-brief` 는 개별 선택이 아니라 전 트랙 무조건이다
(`condition: { kind: "any-track", tracks: [...TRACKS] }`). 조건절 `where installed` 자체가 거짓은
아니지만(사용자가 `--without` 할 수는 있다) **그 이유로 붙였다는 설명이 틀렸다.**

### 5-4. 【P2】 `A skill's body loads when the prompt looks like the skill's job.` — OpenCode 에서 거짓

`src/opencode/commands.ts:4` — *"OpenCode 는 native skill 개념이 없어 각 skill 을 커맨드로 surface"*.
스킬은 `.opencode/commands/<id>.md` 슬래시 커맨드가 되고, 프론트매터는 `description` + `agent` 뿐
**자동 발화 장치가 없다** — 사용자가 직접 타이핑해야 연다.

그런데 문장은 그대로 실려 나간다(내가 실제 렌더러로 확인):
```
$ renderAgentsMd(opencode)  →  "SHIPS VERBATIM TO OPENCODE:
   A skill's body loads when the prompt looks like the skill's job. …"
```
4 CLI 중 1곳에서 전제가 거짓이다. 결론("그래서 여기 줄이 필요하다")은 OpenCode 에서 **오히려 더
참**이라 실질 피해는 작지만, `lane-principle-anchor-parity.test.ts` 헤더가 CRITICAL 로 기록한
ADR-052 실패 유형(*"임베드를 타고 나가는 3 CLI 앵커에 사실이 아닌 문장이 실려 나갔다"*)과 같은 형태다.

### 5-5. 헤더에서 파일명 제거 — **확인됨**

`# Working Principles`. 커밋 메시지가 주장한 대로 파일명이 없다. 한 원본이
`CLAUDE-uzys-harness.md` / `AGENTS.md` / `.agents/rules/uzys-harness.md` 세 이름으로 나가므로 옳은 처분.

---

## 6. 배포 위생 — 8/8 clean, **전부 canary 로 탐지기 선검증**

`scripts/check-absence.sh` 는 canary 를 필수로 받아 *탐지기가 실제로 무는지 먼저 보이고*,
stderr 를 보존하고, 파이프 없이 exit code 를 낸다.

| # | 패턴 | canary (알려진 양성) | canary 검증 | 매치 | exit |
|---|---|---|---|---|---|
| A | `ADR-[0-9]{3}` | `ADR-068` | 통과 | **0건** | 0 |
| B | `v[0-9]+\.[0-9]+\.[0-9]+` | `v26.144.0` | 통과 | **0건** | 0 |
| C | `/Users/` | `/Users/uzysjung` | 통과 | **0건** | 0 |
| D | `docs/research/` | `docs/research/claude-md-standards` | 통과 | **0건** | 0 |
| E† | `#[0-9]{2,}` (이슈·PR 번호) | `Closes #287` | 통과 | **0건** | 0 |
| F† | `[가-힣]` (배포판은 영어) | `한국어 문장` | 통과 | **0건** | 0 |
| G† | `templates/\|src/\|docs/plans/\|\.uzys-agent-harness/` | `templates/skills/foo` | 통과 | **0건** | 0 |
| H† | `npm run\|npx \|vitest\|biome\|pnpm ` (도구 결박) | `npm run ci` | 통과 | **0건** | 0 |

† = 의뢰 4건 외에 리뷰어가 추가한 검사.

---

## 7. `docs/NORTH_STAR.md` 서사 — 수치 전부 재현, 서사 1건 미확인

### 7-1. 수치 — 내가 `npm run cost:report tooling` 을 다시 돌려 대조

| NORTH_STAR 표기 | 내 실측 | |
|---|---|---|
| 상주 23개 항목 · ~4,963 tok/세션 | **23개 · ~4963** | ✅ |
| rules 6개 ~1,092 | **6개 ~1092** | ✅ |
| CLAUDE.md 2개 ~2,855 | **2개 ~2855** | ✅ |
| agent descriptors 9개 ~724 | **9개 ~724** | ✅ |
| skill descriptors 6개 ~292 | **6개 ~292** | ✅ |
| `templates/CLAUDE.md` 1,685 → 1,893 | 7,572자 / 4 = **1893**, `HEAD~1` 6,739자 / 4 = **1685** | ✅ |
| 스캐폴드 962 불변 | 1893 + 962 = **2855** (위 항목과 일치) | ✅ |
| 직전 4,755 대비 **+208** | 4963 − 4755 = **208** | ✅ |
| 30개 ~7,570 → 23개 ~4,963 = −7개 · −2,607 | 7570 − 4963 = **2607**, 30 − 23 = **7** | ✅ |

### 7-2. `"남은 +208 은 ratchet 의 토큰 축을 red 로 만들었고"` — **참**

`tests/context-cost-ratchet.test.ts` 의 성장 단언은 `expect(actual).toBeLessThanOrEqual(recorded)`
로 **무관용**이다(10% 는 반대 방향, 즉 baseline 부풀리기 방지 상한이다). 구 baseline 4,755 에
실측 4,963 → 초과 → red. 그리고 **items 축은 23 → 23 으로 그대로**라 red 가 아니다 — 서사가
"토큰 축"만 지목한 것도 정확하다. baseline 갱신이 같은 커밋에 담긴 것도 diff 로 확인했다
(`context-cost-baseline.json`, 11 트랙 전부 +208).

### 7-3. 서사 중 내가 확인하지 못한 것

- **`"사용자가 이를 적발해 걷어냈다"`** — 누가 6건을 발견했는지는 저장소에 증거가 없다.
- **`"증가 승인은 사용자 결정이다"`** — 정책 서술로 읽으면 참이지만, `baseline 을 올렸다` 바로
  뒤에 놓여 **"이번 +208 을 사용자가 승인했다"로 읽힐 수 있다.** 승인 기록을 못 찾았다. 【P2】
- **`"13,018자 → 7,561자"`** — 초안 13,018자는 커밋된 적이 없어 검증 불가.
  최종본은 실측 **7,572자**로 표기 7,561자와 **11자 차이**. 【P2 · 사소】

---

## 발견 요약

### P0 (머지 불가) — **없음**

### P1 (고쳐야 함) — 2건

| # | 발견 | 위치 |
|---|---|---|
| P1-1 | **리뷰 시점 모순** — 앵커 §5 `before deployment` ↔ `ship-checklist` `배포 직전이 아니라 머지 시점이다`. 둘 다 무조건 상주. 이 사이클의 1차 출처가 지목한 유일한 변수가 "모순"이다 | `templates/CLAUDE.md:96` ↔ `templates/rules/ship-checklist.md:5` |
| P1-2 | **앵커 §5·§7 ↔ `test-policy` 가 같은 사실 4건을 중복**, 그중 "실행 안 한 검사는 통과가 아니다"는 `ship-checklist` 까지 **3중**. `doc-governance` 첫 줄("한 사실은 한 곳에")을 저장소가 스스로 위반 | `templates/CLAUDE.md:90-91,121,124` ↔ `templates/rules/test-policy.md:2,13,15,18,20` ↔ `ship-checklist.md:6` |

### P2 (다듬기) — 8건

| # | 발견 |
|---|---|
| P2-1 | 앵커 **내부** 중복 — `verified-unused` 가 §3(조건 있음)·§4(조건 없음) 두 곳. §4 만 읽으면 커밋이 "가장 크다"고 한 안전장치를 못 본다 |
| P2-2 | 앵커 §2:35 ↔ `test-policy`:4 계약 경계 테스트 중복 |
| P2-3 | `## Presenting a decision`(124 tok) 전량이 `clear-korean-communication` 과 중복 — 단 3 트랙에서는 유일 carrier라 방어 가능. 유지하려면 사유를 남길 것 |
| P2-4 | `task-brief` 줄이 Anthropic 안티패턴 1번("Every time X → 훅으로")에 정면 해당하고 **훅이 이미 있다**(`task-brief-nudge.sh`, ALWAYS_HOOKS). 단 훅은 Claude Code 전용이라 3 CLI 에서는 앵커가 유일 carrier |
| P2-5 | `Each is selected individually at install time` 이 `task-brief` 에 대해 부정확 — 11/11 트랙 무조건 설치다 |
| P2-6 | `model-orchestration` 은 기본 설치 **0/11 트랙**. 전 설치자가 매 세션 ~33 tok 을 안 깔린 스킬 설명에 쓴다. 그리고 **게이트가 이 경우를 구조적으로 못 본다**(변이 5 생존, 원인 규명 완료 — 이 커밋의 결함 아님, 사각지대 기록) |
| P2-7 | `A skill's body loads when the prompt looks like the skill's job` 이 **OpenCode 에서 거짓**(native skill 개념 없음, 커맨드로 surface). 문장은 렌더러를 타고 그대로 나간다. 함께: 이 mechanism 문단(~87 tok × 4 앵커)은 작업 원칙이 아니라 하네스 내부 해설 |
| P2-8 | §6 마지막 문단(`These principles shape decisions; they do not block actions…`)은 §6 주제(승인 경계)와 무관한 문서 메타 해설 / NORTH_STAR `"증가 승인은 사용자 결정"`이 승인 획득으로 읽힐 소지 / 커밋 메시지 `7,561자` vs 실측 `7,572자` |

---

## 잘 된 것 (구체 관찰만)

1. **게이트 4/4 가 예측대로 정확히 문다.** 특히 변이 3 은 **낱말 0개 변경 · 빈 줄 1개 추가**만으로
   red 이고 실패 사유가 `"두 성분이 서로 다른 문단에 흩어져 있다"` 로 나온다 — 문단 스코프가
   장식이 아님이 실증됐다.
2. **중복 제거가 실제로 일어났다.** `HEAD~1` 에 있던
   `"Unless this repository defines otherwise, a merge is gated on regression tests…"` 가
   diff 상 사라졌고, 이는 `ship-checklist` 와의 중복이었다.
3. **`FILL_SPECS` 층은 스스로 경계를 지킨다** — `installed-assets` 가
   `Do NOT restate the harness's working principles … cross-reference them instead` 로 명시.
   이 층에서는 중복 0건.
4. **위생 8/8 clean**, 전부 canary 선검증. 도구 결박·경로 누출·한국어 혼입·이슈 번호 0건.
5. **NORTH_STAR 수치 9개 항목 전부 재현.** ratchet red 주장도 코드로 확인했다.
6. **`verified-unused` 판별 조건**(`every caller you found is inside this repository`)은 실제로
   공개 API 전량 삭제를 막는 유효한 판별자다 — 커밋 메시지의 자평이 과장이 아니다.

---

## 내가 검증하지 못한 것

- **4 CLI 실설치.** `bash test/docker/run.sh` 시나리오를 돌리지 않았다. 검증은 전부 렌더러 함수를
  직접 호출한 결과와 manifest derive 다 — 디스크에 실제로 떨어지는 파일은 안 봤다.
- **모델 행동 변화.** 앵커가 준수율·판단 품질을 실제로 바꾸는지는 이 리포에 계측이 없다.
  토큰·개수만 측정 가능하고, 이 사이클의 1차 지표(진실성)는 미측정 상태 그대로다.
- **`13,018자` 초안** — 커밋된 적 없어 대조 불가.
- **`"사용자가 적발했다"` · `"증가 승인은 사용자 결정"`** — 승인·발견 주체 기록을 저장소에서 못 찾았다.
- **1차 출처 5건의 원문.** `docs/research/` 원장의 인용만 읽었고 외부 URL 에 접근하지 않았다.
  인용의 정확성은 미검증이다.
- **`ship-checklist`·`test-policy` 를 앵커 기준으로 줄였을 때의 회귀.** 중복 해소안은 제시만 했고
  구현·검증은 하지 않았다(리뷰 레인의 범위 밖).

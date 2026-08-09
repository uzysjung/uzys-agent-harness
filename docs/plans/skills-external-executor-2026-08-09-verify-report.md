# V286 — 검증 레인 보고서 (이슈 #286 · ADR-069 외부 실행기 레인)

검증 2026-08-10 · 브랜치 `feat/external-executor-lane` · **HEAD `34f574d`**(착수 지시는 `a320959`
기준이었으나 세션 중 후속 커밋 1건이 들어왔다 — `git diff a320959 34f574d` = ADR 본문의 PR 번호
한 곳뿐, 세 스킬·테스트 무변경. 아래 판정은 `34f574d` 에 대한 것이다).

**나는 이 변경을 만들지 않았다.** 두 보고서(tests / impl)는 *무엇을 확인할지의 목록*으로만 썼고,
아래 숫자는 전부 내가 다시 낸 것이다. git 상태는 바꾸지 않았다(status/diff/show/log 읽기만).

---

## 판정

> **조건부 머지 가능.** CI green(1337/1337) · scope creep 0 · 배포 위생 0건 · 두 사본 1:1 ·
> frontmatter 무변경 · 문안 사실 대조 통과. **단, ADR-069 가드레일 6개 중 3개는 그 문장을
> 통째로 지워도 게이트가 초록이다**(변이 3건 생존, 그중 2건은 두 보고서 어디에도 없다).
> 배포되는 본문 자체는 지금 정확하므로 **거짓출하는 아니다.** 조건 = 이 P1 을 ⓐ `tests/` 앵커
> 범위를 좁혀 닫든 ⓑ 알려진 한계로 명시 기록하든, **머지 전에 사용자가 하나를 고른다.**

이 리포의 기준이 "변이가 살아남으면 게이트가 장식"이고(overhaul-2026-08-02 실측 2건),
ADR-069 의 Consequences 가 **"가드레일은 프로즈와 테스트"**라고 스스로 적었기 때문에,
그 테스트 중 3개가 안 무는 것은 보고 대상이다.

---

## 1. `npm run ci` — 내가 다시 돌렸다

파이프 뒤 `$?` 를 쓰지 않았다(`cli-development.md` §검증 명령은 실패해도 조용하다).

```
$ npm run ci > /tmp/verify-ci-1786297301.log 2>&1; echo "EXIT=$?"
EXIT=0

 Test Files  92 passed (92)
      Tests  1337 passed (1337)
   Duration  10.66s

Statements   : 96.4%  ( 2280/2365 )
Branches     : 88.8%  ( 1332/1500 )   ← 하한 88
Functions    : 96.11% ( 396/412 )
Lines        : 96.9%  ( 2098/2165 )
```

`typecheck` → `biome check src tests` (Checked 138 files, no fixes) → `test:coverage` → `tsup` build
전부 통과. 변이 전항을 끝내고 **원복 후 다시 돌린 최종 실행**도 동일하다:

```
$ npm run ci > /tmp/verify-ci-final.log 2>&1; echo "EXIT=$?"
EXIT=0
 Test Files  92 passed (92) / Tests 1337 passed (1337) / Branches 88.8%
```

설계 §5.4 의 [의견]("신규 테스트가 branches 88 에 영향 없다")은 **실측으로 확인**됐다 — 88.8%.

부수 관측: `--reporter=basic` 은 이 vitest 판본에 없다(`Failed to load custom Reporter from basic`,
exit 1). 도구 오류이지 테스트 실패가 아니어서 `verbose` 로 바꿔 재실행했다. 적는 이유는 이 exit 1
을 테스트 실패로 읽으면 곧장 오판이기 때문이다.

---

## 2. 음성 대조 — 새 게이트가 실제로 무는가 (10건)

**규율**: 변이 전 `cp` 백업 → 변이 **하나** → 대상 스위트 실행 → 백업에서 복원 → `shasum -a 256 -c`
대조. `git checkout`·`git restore` 는 쓰지 않았다. 실행기 = `/tmp/verify-baseline/mut.sh`(원복이
무조건 돌도록 짜고, 매 회 8/8 해시 일치를 출력하게 했다).

**설계 §5.3 과 다르게 한 것 하나**: 변이를 `templates/` 와 `.claude/` **양쪽에** 걸었다. 한쪽만
걸면 1:1 게이트가 같이 red 가 되어 "그 단언만 red" 를 못 보인다. 대신 1:1 게이트는 M8 로 따로 확인했다.

기준선: `external-tool-routing` + `subagent-file-handoff` + `templates-distribution-hygiene`
= **54 passed / EXIT=0**.

| # | 변이 (무엇을 했나) | 결과 | 판정 |
|---|---|---|---|
| **M1a** | `\| **P5** \|` 술어 행 **1줄만** 삭제 | `× A1` ×2(양 루트) — 2 failed / 52 passed | ✅ A1 만 red |
| **M1b** | P5 행은 남기고 **셸 조건만** 삭제 (`, and it can use a shell` + `with no shell, …`) | **54 passed — 생존** | ❌ **안 문다** |
| **M2** | A4 의 `Never install it, never log in for them, and never quietly substitute…` 문단 삭제 | `× A4` ×2 — 2 failed / 52 passed | ✅ (단, 문 것은 `A4·교체금지` 하나뿐) |
| **M2b** | 그중 **설치·로그인 금지만** 삭제(교체 금지는 유지) | **54 passed — 생존** | ❌ **안 문다** |
| **M3** | Anti-patterns 의 `외부 실행기에 **테스트 작성·검증**…` 행 1줄 삭제 | `× B1` ×2 | ✅ B1 만 red |
| **M4** | `A panel that spans more than one tool is the user's call…` 문장 삭제 | `× C1` ×2 | ✅ C1 만 red |
| **M5** | (추가형) mpr 에 `codex-ask.sh` 호출 예시 + `exit 4` **재서술** 2줄 추가 | `× C3` ×2 | ✅ C3 만 red |
| **M6** | (추가형) 라우팅 절에 `provider-9.9` 삽입 | `× E` ×2 | ✅ E 만 red |
| **M7** | (추가형) 로컬 설정 파생 실 id `glm-5.2` 를 **E 슬라이스 밖**(`## Effort floors`)에 삽입 | `× F`(로컬 한정) 1건 — E 는 green | ✅ F 만 red |
| **M8** | `.claude` 사본만 1자 변경 | `× 설치본(.claude) 사본이 1:1 이다` | ✅ 1:1 만 red |
| **M9** | 앵커 헤딩 `executors`→`executor` (한 글자) | `× A0`·`× E0` 가 A1~A4·E 와 함께 12건 red | ✅ **A0/E0 가 먼저 뜬다**(헛통과 차단) |
| **M10** | A3 핵심 문장 `This lane buys **capacity, not quality.**` 삭제 | **54 passed — 생존** | ❌ **안 문다** |

매 회 원복 결과:

```
--- 원복 해시 대조 ---
8/8 OK (모두 일치)
```

**E 의 경계도 같은 실행에서 확인**했다(설계 §5.3 이 요구한 항목). M6 에서 red 가 된 줄은 삽입한
`provider-9.9` **1건뿐**이고, `external-model-consult/SKILL.md:192` 의 날짜 붙은 관측
(`Measured 2026-07-26: gemini-3.1-pro-high…`)은 오탐되지 않았다.

### 2.1 생존한 변이 3건 — 왜 안 무는가

원인은 하나다. **앵커가 절 슬라이스 *전체*를 정규식으로 훑는다**(`unmet()` → `a.re.test(text)`).
그래서 의도한 자리를 지워도 같은 낱말이 **그 절의 다른 줄**에 있으면 앵커가 계속 충족된다.

읽기 전용으로 앵커 34개를 전수 계측했다(`/tmp/verify-baseline/anchor-audit.mjs`) — 슬라이스 안에서
**2줄 이상**에 매치되는 앵커가 **9개**다:

| 앵커 | 매치 줄 수 | 대신 만족시키는 줄 |
|---|---:|---|
| `A1·P5-셸` | 2 | §2.1(f) `**Call the tool's non-interactive mode from the shell.**` |
| `A1·P4-승인범위` | 3 | A2 문단의 `After that one approval…` / `outside what was approved` |
| `A3·용량` | 2 | `mechanical work is eating capacity a judgment lane needs` |
| `A3·품질` | 3 | `quality a command decides` / `quality-over-cost premise` |
| `A4·보고` | 4 | `you report what answered` / `stop and report if it isn't there` |
| `A4·설치금지` | 3 | `not every tool installed` / `where that skill isn't installed` |
| `A4·인증금지` | 2 | 제목줄 `Tool missing, **auth** expired…` |
| `A4·교체금지` | 2 | `a silent swap makes your report false` |
| `C2·네이티브` | 5 | 좌석 절 곳곳 |

그룹 전체가 red 가 되려면 **그 그룹의 앵커 중 최소 하나가 단일 줄**이어야 한다. A1 은 `P5` 라벨이
단일이라 행 전체 삭제(M1a)는 잡지만 **행 안의 반쪽 삭제(M1b)는 못 잡는다.** A4 는 `설치금지`·`인증금지`
가 **둘 다** 새기 때문에 그 두 금지를 통째로 지워도 초록이다(M2b). A3 는 앵커가 둘뿐인데 **둘 다**
새서 핵심 문장이 사라져도 초록이다(M10).

### 2.2 왜 "탐지기 자기검증" 블록이 이걸 못 잡았나 — 구조적 이유

`external-tool-routing.test.ts:409-475` 의 자기검증은 **합성 최소 입력**(`SAMPLE_EXECUTORS` 등)에
변이를 건다. 그 합성 입력은 앵커마다 정확히 한 줄씩만 갖도록 만들어져 있어서 **설계상 중복이 없다.**
즉 이 블록이 증명하는 것은 *"앵커가 유일 출현일 때 문다"* 이고, 실제 본문의 실패 모드인
*"중복 때문에 안 문다"* 는 **원리적으로 검출할 수 없다.** 테스트 보고서가 A2/A3/A4/C1/C2 를
"확인 — 합성 입력 변이"로 적은 것이 그래서 실제 본문에 대한 증거가 되지 못한다.

impl 보고서 §4.2 는 **M1b 한 건을 정직하게 자진 공개**했고 "tests/ 수정은 내 권한 밖"이라고
적었다 — 그 판단은 옳다. **새로 드러난 것은 M2b·M10 두 건**이고, 이 둘은 두 보고서 어디에도 없다.
impl 이 돌린 변이 7건(①P3 ②A2 ③B1 ④C1 ⑤D1 ⑥E ⑦1:1)에 **A4·A3 를 실제 본문에서 건드린 변이가
아예 없었다.**

### 2.3 워킹트리 최종 상태

```
$ git status --short
 M .claude/settings.json
 M .claude/skills/.DS_Store          ← 둘 다 사용자 소유

$ shasum -a 256 -c /tmp/verify-baseline/SHA256.txt
templates/skills/model-orchestration/SKILL.md: OK
templates/skills/multi-persona-review/SKILL.md: OK
templates/skills/multi-persona-review/references/reviewer-design.md: OK
templates/skills/external-model-consult/SKILL.md: OK
.claude/skills/model-orchestration/SKILL.md: OK
.claude/skills/multi-persona-review/SKILL.md: OK
.claude/skills/multi-persona-review/references/reviewer-design.md: OK
.claude/skills/external-model-consult/SKILL.md: OK
```

---

## 3. 중복 — 같은 사실을 두 곳이 말하는가

직전 PR 의 사고("추가분 9건 중 6건이 이미 다른 층에 있었다")와 같은 검사를 했다.

### 3.1 다른 층과의 중복 — **0건**

```
$ ls templates/rules/
change-management.md  cli-development.md  doc-governance.md  git-policy.md
playwright-launch.md  ship-checklist.md   test-policy.md

$ grep -rInE "external|외부|opencode|provider|패널|panel|위임|delegat|제3자" templates/rules/ templates/CLAUDE.md
templates/rules/test-policy.md:9:  execution order, network, and external services.
templates/rules/change-management.md:6: … 외부 의존성 …
templates/CLAUDE.md:13:Prefer proven patterns. Verify external behavior, …
```

셋 다 **다른 주제**다(테스트 격리 / ADR 대상 분류 / 원칙 1). 룰 7종·배포 앵커 어디에도 외부 도구·
위임·패널·provider 를 말하는 줄이 없다. `src/project-claude-merge.ts` 의 `FILL_SPECS` 6종
(identity/stack/architecture/installed-assets/boundaries/verify)도 전부 프로젝트 스캐폴드 프롬프트라
겹치지 않는다. → **층간 중복 없음. 이 사이클은 직전 PR 의 실수를 반복하지 않았다.**

### 3.2 스킬 **안**에서의 중복 — 2건 (P2)

`multi-persona-review` 안에서 같은 사실이 여러 번 서술된다.

**주장 A — "어느 좌석에 어느 모델이 답했는지 기록한다" = 4곳**

```
SKILL.md:149   … coverage caveat which seats were native and which were external, and which model answered each.
SKILL.md:196-8 **Say where each seat came from** … how many external, and which model answered each.
SKILL.md:246   - **Unlabelled provenance** — if the caveat doesn't say which seats answered from outside …
references/reviewer-design.md:27  … which model answered each seat — a panel whose provenance is unrecorded …
```

**주장 B — "provenance 는 상관 통제 · 같은 렌즈를 모델만 바꾸면 리뷰어 하나" = 3곳**

```
SKILL.md:102   Model provenance is a **correlation control, not a lens** …
SKILL.md:244   … is still one reviewer with two names. A second vendor lowers correlation only between lenses that already differ …
references/reviewer-design.md:21-23  **Model provenance is a correlation control, not a sixth criterion.** …
```

**소유 의견**
- 주장 B 의 **메커니즘**은 `references/reviewer-design.md` 가 소유해야 한다(그 파일이
  `## Define independence` 를 소유한다). `SKILL.md:102` 는 한 줄 요약 + `The mechanics are in
  [references/…]` 로 **명시적 포인터**라 정당하다. **`SKILL.md:244`(Pitfalls) 가 세 번째 사본**이고,
  포인터가 아니라 메커니즘을 다시 설명한다 — 여기를 줄이는 게 맞다.
- 주장 A 의 소유자는 **`SKILL.md:196-198`(step-6 커버리지 고지)** 이다. 고지문을 쓰는 자리가 거기다.
  `:246`(Pitfalls)은 네 번째 사본이다.
- **다만 `:149` 는 지금 지울 수 없다** — 테스트 앵커 `C2·고지위치`(`/coverage caveat/`)와
  `C2·출처기록`(`/model answered/`)이 **좌석 슬라이스 안에서** 그 어구를 요구한다. 즉 **게이트가
  중복을 제자리에 못 박아 뒀다.** 중복을 줄이려면 테스트도 함께 손봐야 한다는 뜻이라, 2.1 의
  앵커 범위 조정과 **같은 작업으로 묶는 것**을 권한다.

### 3.3 두 스킬에 걸친 중복 1건 — 설계가 의도한 것 (지적 아님)

`대신 설치/로그인하지 않는다` 가 `external-model-consult:71-72` 와 `model-orchestration:122`
두 곳에 있다. 설계 §6.1 이 "세 자리 전부에 있고 각각 테스트가 문다"고 **명시적으로 결정**했고,
근거는 각 스킬이 단독 설치될 수 있다는 것이다. 본문도 그 경계를 스스로 적는다 —
`Recognizing each failure — and the exact wording for it — belongs to [[external-model-consult]];
where that skill isn't installed, only the conclusion survives`. **결론의 중복은 타당, 메커니즘의
중복은 없음** → 문제 없음.

---

## 4. 배포 위생 — canary 를 먼저 보이고 검사

전부 `scripts/check-absence.sh --canary` 로 돌렸다(stderr 미폐기, 파이프 없음, exit code 직접).
canary 가 안 잡히면 이 도구는 exit 2 로 **"없음"을 거부**한다.

| 축 | canary | 패턴 | 매치 | exit |
|---|---|---|---:|---|
| ⓑ ADR 번호 | `ADR-069` | `ADR-[0-9]{3}` | **0건** | 0 |
| ⓒ 릴리스 태그 | `v26.144.0` | `v[0-9]{2}\.[0-9]+\.[0-9]+` | **0건** | 0 |
| ⓓ 홈 경로 | `/Users/uzysjung/Development` | `/Users/[a-zA-Z]+\|/home/[a-zA-Z]+` | **0건** | 0 |
| ⓔ `docs/research/` | `see docs/research/foo.md` | `docs/research/` | **0건** | 0 |
| ⓐ 모델 슬러그 | `glm-5.2` | 슬러그 형태 | 4건 — **전부 기존분** | 1 |

각 실행이 `패턴: …  (canary '…' 검증 통과)` 를 출력했다 = 탐지기가 실제로 무는 것을 먼저 보였다.

**ⓐ 4건은 전부 이번 변경 이전부터 있던 것이고, 신규 0건이다:**

```
model-orchestration/SKILL.md:139   Fable 5, Sonnet 5, and Opus 4.8/4.7   ← 이 스킬의 주제(자기 티어 정책), 기존
external-model-consult/scripts/gemini-ask.sh:119,131                     ← 코드 주석, 날짜 붙은 관측, 기존
external-model-consult/SKILL.md:192  Measured 2026-07-26: `gemini-3.1-pro-high`  ← 설계 §4.4 가 남기기로 한 것
```

**설계 §4.4 가 지목한 노후 문자열은 실제로 제거됐다:**

```
$ bash scripts/check-absence.sh --canary 'codex 0.144.5' -i 'codex 0\.[0-9]+' templates/ .claude/skills/
매치: 1건
templates/codex/AGENTS.md.template:53:## Hooks 현황 (Codex 0.124.0 실측 제약)   ← 별건 파일, 이번 범위 밖
```

세 스킬에서 `codex 0.144.5` 는 사라졌고(`verified against a logged-out codex` 로 대체), 남은 1건은
전혀 다른 파일이다.

부수 관측: 이 도구는 **셸 변수로 경로를 넘기면 실패**한다. 첫 호출에서
`FAIL(2): 검사 대상 경로가 하나도 존재하지 않는다` 가 났는데, 원인은 도구가 아니라 내 호출 방식
(변수 전개)이었다. 리터럴 경로로 재호출해 통과. 적는 이유는 이 exit 2 를 "위생 통과"로 읽으면
정반대 결론이 나기 때문이다 — 도구가 fail-closed 라 오히려 잘 막았다.

---

## 5. 두 사본 일치 · frontmatter 무변경

```
$ diff -q templates/skills/<각>/SKILL.md .claude/skills/<각>/SKILL.md
model-orchestration      SKILL.md  동일
multi-persona-review     SKILL.md  동일
external-model-consult   SKILL.md  동일
reviewer-design.md                 동일
```

**frontmatter 는 한 글자도 안 바뀌었다.** hunk 시작 줄과 frontmatter 끝 줄을 대조했다:

```
$ git diff a320959^ a320959 -U0 -- templates/skills/model-orchestration/SKILL.md
@@ -74,0 +75,9 @@   @@ -82,0 +92,45 @@   @@ -214,0 +269,3 @@   @@ -225,0 +283,3 @@
$ git diff a320959^ a320959 -U0 -- templates/skills/multi-persona-review/SKILL.md
@@ -101,0 +102,4 @@  @@ -125,0 +130,22 @@  @@ -169,0 +196,4 @@  @@ -212,0 +243,5 @@  @@ -226 +261,3 @@
$ git diff a320959^ a320959 -U0 -- templates/skills/external-model-consult/SKILL.md
@@ -69,0 +70,5 @@   @@ -78,2 +83,2 @@   @@ -228 +233,3 @@   @@ -281,0 +289,4 @@

frontmatter 끝 줄:  model-orchestration 20 / multi-persona-review 14 / external-model-consult 28
```

가장 이른 hunk 가 **70줄**(emc, frontmatter 끝 28)이다 → 모든 변경이 frontmatter 바깥.
따라서 설계 §6.3 의 "상주 descriptor 토큰 증가 0" 과 §5.4 의 "ratchet·NORTH_STAR 무영향"이 성립한다
(그리고 실제로 `npm run ci` 안의 cost 계열 게이트 전부 green).

---

## 6. 문안이 사실인가

### 6.1 외부 CLI 실재 여부와 본문의 전제

```
$ command -v opencode codex agy gemini antigravity
opencode  /Users/uzysjung/.opencode/bin/opencode
codex     /Users/uzysjung/.local/bin/codex
agy       /Users/uzysjung/.local/bin/agy
gemini    (absent)      antigravity (absent)
```

**본문은 어느 CLI 의 존재도 전제하지 않는다.** 도구를 가리키는 자리마다 조건절이 붙어 있다:

```
mpr:141  The outside seat goes out through `external-model-consult` **where installed**
mpr:143  **installed the seat doesn't exist**, and the panel runs native.
mo:108   P5 … with no shell, **this lane doesn't exist for you**
mo:124-5 belongs to [[external-model-consult]]; **where that skill isn't installed**, only the conclusion survives: stop and ask.
mo:130   Read the subcommand off **`--help`** rather than typing one from memory
```

서브커맨드를 본문에 박지 않고 `--help` 로 확인하게 한 것도 설계 §2.1(f) 대로다. **머신 의존 사실 0.**

### 6.2 `external-model-consult` 를 가리키는 참조가 실재하는 절을 가리키는가 — **전부 실재**

| 참조 (어디서) | 가리키는 것 | 실재 |
|---|---|---|
| `mo:79` "`external-model-consult`'s **provider table**" | `## Which provider — the division of labor is the decision rule` | ✅ emc:53 |
| `mo:82` "`external-model-consult` **persona mode**" | Mode P | ✅ emc:58(표), emc:229(본문) |
| `mo:124` `[[external-model-consult]]` (실패 인식·문구) | `## Prerequisite` / `## On failure — the exit-code contract` | ✅ emc:65, emc:261 |
| `mpr:263` "**("Seats an outside tool can fill")**" | 그 헤딩 | ✅ mpr:130 |
| `emc:291` "belong to `model-orchestration`" | `## External executors` | ✅ mo:92 |
| `mo:83` "that gate belongs to `[[multi-persona-review]]`" | 좌석 절의 확인 문장 | ✅ mpr:132 |

절 순서도 계약대로다 — `## Routing test`(59) → `## External executors`(92) → `## Effort floors`(137).
새 라우팅 불릿 3개(75-83)는 `## Routing test` 슬라이스 **안**에 있다(= E 가 실제로 훑는 범위).

### 6.3 ADR-069 가드레일 6개 — 하나씩 대조

| # | 가드레일 | 본문 반영 | 무는 게이트 | 변이 생존? |
|---|---|---|---|---|
| 1 | 최초 1회 사용자 확인, 소유자 = model-orchestration | mo:112-117 (`First use in a repository is the user's call`) | A2 (앵커 4개 **전부 단일 줄**) | 아니오 ✅ |
| 2 | **용량이지 품질이 아니다**, 기존 라우팅 질문 그대로 | mo:94 + P1 | A3 | **예 ❌ (M10)** |
| 3 | 테스트·검증·핵심 구현 안 감 | mo:269 anti-pattern 행 | B1 (한 행 안 AND) | 아니오 ✅ |
| 4 | 외부 산출물은 교차검증 전까지 무엇도 게이트 못 함 | mo:106 P3 | A1 (`cross-verif` 단일 줄) | 아니오 ✅ |
| 5 | 도구 없으면 레인 내리고 보고, **대신 설치·인증 안 함** | mo:121-125 | A4 | **부분 ❌ (M2b — 설치·인증 반쪽)** |
| 6 | 새 래퍼·훅·룰 안 만듦 | — | 파일 목록으로 확인 | 아니오 ✅ (§7) |

**가드레일 3 에 한 가지 불일치가 있다(P2).** ADR 은 *"이미 형태가 고정된 표에 케이스 한 줄을
복제하는 일은 허용한다"* 는 예외를 명시했는데, **배포 본문에 그 예외가 없다.**

```
$ grep -rInE "케이스 한 줄|한 줄을 복제|형태가 고정|case line" templates/skills/model-orchestration/SKILL.md
→ 0건 (관련 없는 :174 의 'duplicated work' 만)
```

본문만 읽는 사람은 `외부 실행기에 **테스트 작성·검증**·핵심 구현을 넘김` 을 **테스트 전면 금지**로
읽는다. 설계 §7 이 "추가 문구 불요"라고 판단한 결과인데, **차이는 더 보수적인 쪽**이라(레인이 덜
열린다) 안전 방향의 불일치다. 그래서 P2 다 — 다만 ADR 과 배포물이 한 지점에서 다른 말을 한다는
사실 자체는 기록해 둔다.

### 6.4 §6.4 배선 전제 재확인

```
$ ls templates/skills/model-orchestration/   →  SKILL.md            (scripts/ 없음)
$ ls templates/skills/multi-persona-review/  →  references  SKILL.md (scripts/ 없음)
```

둘 다 `scripts/` 가 없으므로 OpenCode 설치본에서 `agent: plan`(bash 거부)으로 렌더된다 — 설계
§6.4 의 전제 그대로다. 그 상황에서 레인을 닫는 것이 P5 인데, **P5 의 셸 조건이 바로 M1b 로
생존이 확인된 문장**이다. 즉 설계가 스스로 "이것이 P5 를 AND 로 쓰는 이유"라고 못 박은 안전
사슬이 게이트로는 안 지켜진다. (다행히 P5 **전반절**(`not the CLI you are running on`)은 단일 줄
앵커라 살아 있고, OpenCode 호스트에서는 그쪽이 먼저 레인을 닫는다 — 그래서 P0 가 아니다.)

---

## 7. Scope creep — 설계 §8 의 12개 금지 대조

```
$ git diff main...HEAD --name-only
.claude/skills/external-model-consult/SKILL.md
.claude/skills/model-orchestration/SKILL.md
.claude/skills/multi-persona-review/SKILL.md
.claude/skills/multi-persona-review/references/reviewer-design.md
docs/decisions/ADR-069-external-executor-lane.md
docs/plans/skills-external-executor-2026-08-09-impl-report.md
docs/plans/skills-external-executor-2026-08-09-tests-report.md
templates/skills/external-model-consult/SKILL.md
templates/skills/model-orchestration/SKILL.md
templates/skills/multi-persona-review/SKILL.md
templates/skills/multi-persona-review/references/reviewer-design.md
tests/external-tool-routing.test.ts
tests/subagent-file-handoff.test.ts
tests/templates-distribution-hygiene.test.ts
```

| # | 금지 | 판정 | 증거 |
|---|---|---|---|
| 1 | 새 래퍼 스크립트 | ✅ 준수 | 파일 목록에 `scripts/` 0건 |
| 2 | 역할·effort floor 수정 | ✅ 준수 | `## Effort floors` 이하 본문 무변경. diff 의 `Sonnet` 2건은 **기존 레인을 가리키는** 새 문장 |
| 3 | description 확장 | ✅ 준수 | §5 frontmatter 무변경 |
| 4 | emc 에 OpenCode 를 자문 provider 추가 | ✅ 준수 | provider 표(:53-63) 무변경 — 첫 hunk 가 :67 |
| 5 | 구체 모델명·티어명 | ✅ 준수 | §4 ⓐ 신규 0건 |
| 6 | 훅 신설 | ✅ 준수 | `hooks/` 0건 |
| 7 | 새 룰 | ✅ 준수 | `rules/` 0건 |
| 8 | `src/opencode/*`·`external-assets.ts`·`manifest.ts` | ✅ 준수 | `^src/` 0건 |
| 9 | 다중 도구 패널을 기본값으로 | ✅ 준수 | `Native reviewers are the default` (mpr:135) |
| 10 | 세 스킬에 같은 서술 복제 | ⚠ **부분** | 층간 0건이나 mpr **안**에서 3~4중복(§3.2) |
| 11 | description 초과 2건 트리밍 | ✅ 준수 | 미착수(별건 보고 유지) |
| 12 | 위생 정규식에 `docs/research/` 추가 | ✅ 준수 | 해당 diff 0건 |

`grep -E "scripts/|hooks/|rules/|^src/|manifest|external-assets"` → **0건**.
**scope creep 없음.** 문서 추적도 정상: `bash templates/scripts/spec-drift-check.sh` → `OK: SPEC/TODO
동기화 상태 정상` (EXIT=0).

---

## 발견

### P0 — 없음

배포되는 본문은 지금 정확하고, 승인 게이트(가드레일 1 = 저장소 코드의 제3자 최초 도달)는 앵커 4개가
전부 단일 줄이라 **변이가 안 샌다.** 새 신뢰 경계를 여는 결정 자체는 ADR-069 로 인간 결정을 받았다.

### P1-1 — ADR-069 가드레일 3개가 문장을 지워도 게이트 초록 (변이 3건 생존)

- **어디**: `tests/external-tool-routing.test.ts:180-184` (`unmet()` 이 절 슬라이스 전체를 검사)
- **무엇**: M1b(P5 셸 조건) · M2b(가드레일 5 의 설치·인증 금지) · M10(가드레일 2 의 핵심 문장)이
  각각 **54 passed** 로 생존. 앵커 34개 중 **9개**가 슬라이스 안에서 2줄 이상에 매치된다.
- **왜 중요**: ADR-069 Consequences 가 스스로 *"가드레일은 프로즈와 테스트이지 기계적 차단이
  아니다"* 라고 적었다. 그 두 축 중 하나가 이 3문장에 대해 작동하지 않는다. 이 리포의 기준으로는
  **"변이가 살아남으면 게이트가 장식"** 에 해당한다.
- **지금 당장의 위험도**: 낮음 — 본문에 문장이 실재하고, P5 전반절·A4 교체금지·A1 라벨이 각각
  단일 줄로 살아 있어 *행/문단 통째 삭제*는 잡힌다. 새는 것은 **반쪽 삭제**다.
- **고치는 쪽**: `tests/` 다(본문 아님). 앵커를 절 전체가 아니라 **그 술어 행 / 그 문단**으로
  좁히면 닫힌다. impl 레인이 §4.2 에서 "내 권한 밖"이라 남긴 것과 같은 작업이며, **§3.2 의 중복
  정리와 같은 커밋으로 묶는 것을 권한다**(앵커를 좁혀야 중복 문장을 지울 수 있다).
- **보고 정확성**: impl 보고서는 M1b 1건을 **자진 공개**했다(정직함). M2b·M10 **2건은 미공개**이고,
  impl 이 돌린 변이 7건에 A3·A4 를 실제 본문에서 건드린 것이 없었다.

### P1-2 — 자기검증 블록이 주는 보증이 보고서에 적힌 것보다 좁다

- **어디**: `tests/external-tool-routing.test.ts:409-475` · tests 보고서 §264 표
- **무엇**: 자기검증은 **합성 최소 입력**(앵커당 정확히 한 줄)에만 변이를 건다. 실제 본문의 실패
  모드(중복 때문에 안 묾)는 **원리적으로 검출 불가**다. tests 보고서가 A2/A3/A4/C1/C2 를
  "확인 — 합성 입력 변이"로 적었는데, **A3·A4 는 실제 본문에서 반증됐다**(M10·M2b).
- **행동**: 보고 문구를 "합성 입력 한정"으로 명확히 하거나, 실제 본문 변이를 계약에 포함한다.

### P2-1 — `multi-persona-review` 안에서 같은 사실이 3~4번 서술된다

주장 A 4곳 · 주장 B 3곳(§3.2). `doc-governance` 의 "한 사실은 한 곳에" 위반이다. 소유 의견:
메커니즘은 `references/reviewer-design.md`, 고지 요구는 `SKILL.md` step-6 이 갖고, **Pitfalls 2행은
포인터로 축약**. `SKILL.md:149`(좌석 절)는 C2 앵커가 붙들고 있어 **P1-1 과 함께** 손대야 한다.

### P2-2 — ADR 의 예외 조항이 배포 본문에 없다

가드레일 3 의 *"이미 형태가 고정된 표에 케이스 한 줄 복제는 허용"* 이 본문에 0건(§6.3). 본문만
읽으면 테스트 전면 금지로 읽힌다. 차이가 **더 보수적인 방향**이라 안전하지만, ADR 과 배포물이
한 지점에서 다른 말을 한다.

### P2-3 — 배포 앵커의 `model-orchestration` 설명이 새 레인을 반쯤만 덮는다

`templates/CLAUDE.md:156-157`: *"when work is delegated, it decides **which model and which effort
level** each lane gets."* 그런데 새 레인은 본문이 명시적으로 **"This lane does not choose
models."**(mo:127) 라고 적는다. 앵커의 서술이 새 레인에 대해서는 사실이 아니다. 한 줄짜리 드리프트이고
이번 범위 밖이라 **별건**으로 남긴다.

---

## 검증하지 못한 것 (미검증으로 명시)

1. **외부 CLI 의 실동작·인증.** `command -v` 로 `opencode`·`codex`·`agy` 존재만 확인했다.
   **실호출 0회**, 로그인 상태 미확인, `opencode run` 실행 미확인. ADR-069 §미적용이 이미 이
   한계를 적고 있고, 이번 사이클에서도 그대로 남는다.
2. **문장이 실제 위임 행동을 바꾸는가.** 이 검증은 전부 **문면·배선 판정**이다. 모델이 P1~P5 를
   실제로 평가하고 레인을 닫는지, 최초 확인을 실제로 받고 멈추는지는 측정하지 않았다.
3. **F 게이트의 CI 동작.** F 는 `~/.config/opencode` 에서 파생하므로 **로컬 전용**이다. 이 머신에서
   10개 id(`glm-5.2`·`gpt-5.5` 등)를 파생해 실제로 돌았고 M7 로 무는 것도 봤지만, **CI 에는 그
   설정이 없어 미수행으로 warn 후 통과**한다. CI 상시 방어는 E 뿐이다.
4. **설치 경로별 렌더 결과.** OpenCode 에서 두 스킬이 `agent: plan` 으로 찍히는지는 `scripts/`
   부재로 **추론**했을 뿐, `install` 을 돌려 렌더 산출물을 보지 않았다. 4개 CLI 실설치 미실행.
5. **PR·릴리스 단 게이트.** 이 리포는 PR 에 CI 가 없다. 위 숫자는 전부 **로컬** `npm run ci` 다.
6. **`npm audit` / `ecc-agentshield`.** 배포 단 항목이라 이번 머지 검증에서는 안 돌렸다.
7. **description 상한 초과 2건**(설계 §6.3 이 별건으로 뺀 것)의 현재 값은 재측정하지 않았다.

---

## 부록 — 재현 명령

```bash
npm run ci > /tmp/ci.log 2>&1; echo "EXIT=$?"          # 파이프 뒤 $? 금지
npx vitest run tests/external-tool-routing.test.ts \
    tests/subagent-file-handoff.test.ts \
    tests/templates-distribution-hygiene.test.ts --reporter=verbose   # 54 passed
node /tmp/verify-baseline/anchor-audit.mjs             # 앵커별 매치 줄 수 (읽기 전용)
bash /tmp/verify-baseline/mut.sh <이름> <변이.py>       # 변이 1건 + 무조건 원복 + 해시 대조
bash scripts/check-absence.sh --canary '<양성>' [-i] '<ERE>' <경로 리터럴>
bash templates/scripts/spec-drift-check.sh
```

변이 스크립트 10종 = `/tmp/verify-baseline/m{1a,1b,2,2b,3,4,5,6,7,8,9,10}.py`,
로그 = `/tmp/verify-baseline/M*.log`, 기준선 해시 = `/tmp/verify-baseline/SHA256.txt`.

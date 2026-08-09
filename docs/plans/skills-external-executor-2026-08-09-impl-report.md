# D286 구현 레인 보고 — 세 스킬 본문에 외부 실행기 레인을 붙였다

작성 2026-08-10 · 브랜치 `feat/external-executor-lane` · 시작 HEAD `6f0e40c` · **본문만 수정**
(`tests/**` · `src/**` · frontmatter 무수정) · git 무쓰기(status/diff/show 읽기만).
설계 SSOT = `docs/plans/skills-external-executor-2026-08-09.md` · 계약 =
`docs/plans/skills-external-executor-2026-08-09-tests-report.md` §2 앵커표 · 결정 = ADR-069.

---

## 0. 한 문단 요약 — 무엇이 달라졌나

테스트 레인이 red 로 남겨 둔 **24개 단언이 전부 green** 이다(`36 passed`). 세 스킬 본문에
① 판단이 남지 않은 기계적 구현이 나가는 **외부 실행기 레인**(model-orchestration 소유, 다섯 술어 +
최초 1회 사용자 확인) ② 패널의 한 자리를 비-Claude 에 주는 **외부 좌석**(multi-persona-review 소유,
복수 도구 패널 사전 확인 + 좌석 출처 기록) ③ **실행 위임은 자문 스킬의 일이 아니라는 경계**
(external-model-consult)를 넣었다. 호출 방법은 옮기지 않고 가리켰다. frontmatter 는 여섯 파일 모두
**HEAD 와 해시가 같다**(상주 토큰 증가 0). `npm run ci` **exit 0**(1,337 tests / branches 88.8%).

추가로 설계 §5.3 이 "구현 후"로 남긴 **실제 본문 음성 대조 6건을 직접 돌렸다** — 6/6 이 정확히
의도한 단언만 red 로 만들고, 원복 후 해시 일치를 확인했다(§4). 그 과정에서 **살아남은 변이 1건**을
발견해 §4.2 에 적었다 — 내 본문의 결함이 아니라 앵커가 어휘 계약이라는 이미 공시된 한계다.

---

## 1. 무엇을 어디에 썼나 (실제 문안 인용)

편집 대상은 **4파일 × 2사본 = 8파일**. `templates/` 를 먼저 고치고 `.claude/` 는 `cp` 로 동기화해
바이트 동일을 보장했다(양쪽이 편집 전에 이미 byte-identical 이었다 — §3.4).

| 파일 | 줄수 | 설계 예상 |
|---|---|---|
| `skills/model-orchestration/SKILL.md` | 228 → **288** (+60) | +36 |
| `skills/multi-persona-review/SKILL.md` | 228 → **265** (+37) | +23 |
| `skills/multi-persona-review/references/reviewer-design.md` | 55 → **63** (+8) | +9 |
| `skills/external-model-consult/SKILL.md` | 291 → **302** (+11) | +9 |

**줄수가 설계 예상을 넘는 이유는 §5-①에 적었다** — 항목 수는 설계와 1:1 이고, 초과분은 전부
줄바꿈이다(파일의 기존 ~100자 랩 스타일). 게이트는 줄수를 보지 않는다.

### 1.1 `model-orchestration` — `## External executors — the lane outside the harness` 신설 (45줄)

위치 = `## Routing test` **뒤**, `## Effort floors` **앞**(A0 이 순서를 문다).
설계 §2.1 (a)~(g) + §2.2 를 순서대로 담았다.

**(a) 이 레인이 사는 것 — 설계 §2.1a**

> This lane buys **capacity, not quality.** It is not a fourth rank below Sonnet — the ranking above
> is by judgment, and an outside CLI has not earned a place in it. What it can hold is work whose
> **quality a command decides**, the only case where "cheaper" doesn't also mean "worse." Choosing it
> because some other vendor is supposedly better inverts this policy's quality-over-cost premise.

**(b) 다섯 술어 — 설계 §2.1b.** 표 앞에 AND 임을 못 박았다:
"**All five predicates must hold; any one false closes the lane.** Each is a question you can answer
right now, not a "use it if it helps.""

| # | Predicate | How you answer it now |
|---|---|---|
| **P1** | No judgment is left | The routing question above, unchanged — *"새 판단이 남아 있는가?"* 남아 있으면 닫힌다 |
| **P2** | Passing is machine-decided | Write the pass command on one line, right now. Can't? Closed |
| **P3** | The output gates nothing | It gates no merge, no release, no decision until in-harness cross-verification clears it |
| **P4** | The repo may go to that provider | The first-use approval below is done, and this file set is inside what was approved |
| **P5** | It is **not the CLI you are running on**, and it can use a shell | Delegating to yourself is not a round trip; with no shell, this lane doesn't exist for you |

P5 는 설계 §6.4 가 요구한 대로 **두 조건의 AND** 로 썼다 — 셸이 없는 설치본에서 이 레인이 조용한
no-op 이 되지 않게 본문 스스로 닫는다.

**(c) 동점일 때의 기본값 — 설계 §2.1c**

> Even with all five true, **the in-harness repetitive lane is still the default.** Go outside when
> mechanical work is eating capacity a judgment lane needs — and reach for the fewest tools that
> answer the task, not every tool installed.

**(§2.2) 최초 사용 확인 — 설계가 준 초안을 한 글자도 안 바꾸고 썼다**

> **First use in a repository is the user's call, not yours.** Routing implementation to an external
> CLI puts this repository's code into another vendor's session — a disclosure none of the in-harness
> lanes make. Before the first such delegation in a project, say which tool, which provider its own
> config resolves to, which files the worker may touch, and what comes back; then wait. After that one
> approval, routing inside the predicates above is yours. Ask again when the boundary moves — a
> different tool, or files outside what was approved.

**(d) 부재·실패 시의 경로 — 설계 §2.1d.** 네 조각(하향·보고·설치/인증 금지·교체 금지) 전부:

> **Tool missing, auth expired, provider refused → step down a lane and report what you could not
> use.** Never install it, never log in for them, and never quietly substitute a different provider:
> the user knows which tool answered, so a silent swap makes your report false. Recognizing each
> failure — and the exact wording for it — belongs to [[external-model-consult]]; where that skill
> isn't installed, only the conclusion survives: stop and ask.

**(e) 모델은 사용자 설정에서 온다 — 설계 §2.1e.** 구체 모델명 0개:

> **This lane does not choose models.** The tool runs whatever its own config resolves to, and you
> report what answered. A model id written down here goes stale and pins the user to a retired model.

**(f) 호출 형태 — 설계 §2.1f**

> **Call the tool's non-interactive mode from the shell.** Read the subcommand off `--help` rather
> than typing one from memory, and stop and report if it isn't there. Writes stay isolated (worktree
> or equivalent) — the parallel-write rule above holds for outside workers too.

**(g) 위임 규격은 재서술 없이 가리킨다 — 설계 §2.1g**

> The delegation prompt spec and the file-handoff contract below apply here unchanged: an outside
> worker is still a worker.

### 1.2 `model-orchestration` — `## Routing test` 에 3불릿 (설계 §2.3)

기존 "Read-only assists" 불릿 뒤, "설계·기획·분배·리뷰 decisions never route down" 앞.

> - **Judgment-free implementation whose pass condition is a command** — the repetitive lane above
>   stays the default; only when every predicate in the next section holds may that work go to an
>   external executor instead.
> - **Korean the user will read** · **shorter and better structured** — an external advisory
>   round-trip. Which provider takes which is `external-model-consult`'s provider table; that table
>   is the SSOT and is not copied here.
> - **A judgment that needs several perspectives** → [[multi-persona-review]] (native panel). **One
>   non-Claude perspective** → `external-model-consult` persona mode. A panel that mixes both asks
>   the user before it runs, and that gate belongs to [[multi-persona-review]].

provider 표를 **되풀이하지 않고 SSOT 를 가리켰다**(설계 §1 MECE).

### 1.3 `model-orchestration` — `## Anti-patterns` 3행 (설계 §2.4)

첫 행이 B1 계약이다 — **한 행 안에** 외부 ∧ 테스트 ∧ 검증.

> \| 외부 실행기에 **테스트 작성·검증**·핵심 구현을 넘김 \| 이 레인은 판단 잔여 0 인 일만 받는다 — 무엇을 단언할지 정하는 일을 밖으로 내보내면 외부 산출물을 검사할 기준 자체가 밖에 있게 된다 \|
> \| 도구가 없어서 조용히 다른 제공자로 갈아타 실행 \| 사용자는 어느 도구가 답했는지 알고 있다 — 대체는 보고 대상이지 판단 대상이 아니다 \|
> \| 외부 실행기를 "품질이 더 낫다"는 이유로 고름 \| 이 레인이 사는 것은 용량이다. 품질을 근거로 들면 이 정책의 quality-over-cost 전제를 뒤집는 것이다 \|

### 1.4 `model-orchestration` — `## Quick reference` 3줄 (설계 §2.5)

`결정적 변환` 줄 뒤, `위임 완료` 줄 앞:

```
판단 잔여 0 + 합격을 명령 하나로 판정
                               → sonnet 기본 / 다섯 술어 충족 시 외부 실행기 — 최초 1회 사용자 확인, 산출물은 in-harness 교차검증
도구 부재·인증 만료            → 레인을 내리고 무엇을 못 썼는지 보고 — 대신 설치/로그인 금지, 조용한 제공자 교체 금지
```

### 1.5 `multi-persona-review` — 페르소나 설계 절 3줄 (설계 §3.1)

설계가 준 문장 그대로:

> Model provenance is a **correlation control, not a lens** — designing lenses comes first, choosing
> which seat an outside model fills comes second. The mechanics are in
> [references/reviewer-design.md](references/reviewer-design.md).

### 1.6 `multi-persona-review` — `#### Seats an outside tool can fill` 신설 (22줄, 설계 §3.2)

위치 = `### 3.` 안, **절 끝**(`### 4.` 바로 앞). 설계는 ":113 뒤"라고 했다 — **위치를 옮긴 이유는
§5-② 에 적었다.**

**(a) 확인 문장 — 설계 초안 그대로**

> **A panel that spans more than one tool is the user's call before it runs, not after.** Name the
> tools that will answer, how many external round-trips that is, and what text leaves the machine;
> then wait. Native reviewers are the default — one outside seat is a considered upgrade, several are
> a bill the user has not seen yet.

**(d) 언제 값을 하는가 — 설계 §3.2d**

> Spend that seat where a miss costs the most: a judgment that is expensive to reverse, a surface like
> UI/UX where one model's default taste becomes the answer, or a panel you already ran and suspect
> every member missed the same thing in. Otherwise native is the default.

**(c) 어떻게 부르는가 — 재서술 없이 가리킨다. 설계 §3.2c**

> The outside seat goes out through `external-model-consult` where installed — the call itself, its
> guardrails, and its failure handling are that skill's and are not repeated here. Where it isn't
> installed the seat doesn't exist, and the panel runs native.

**(b) 좌석을 채울 수 없을 때 — 설계 초안 그대로**

> If the seat cannot be filled — the consult skill is not installed, its CLI is missing, auth expired,
> or the provider refused — do **not** quietly replace it with another native reviewer of the same
> shape; that keeps the count and loses the independence, which is the only variable this method's
> value is made of. Fill it with a lens that fears a different failure, and record in the step-6
> coverage caveat which seats were native and which were external, and which model answered each.
> A panel's claim rests on how its members fail; a reader who cannot see who answered cannot audit it.

### 1.7 `multi-persona-review` — 커버리지 고지 3줄 (설계 §3.3) · Pitfalls 2행 (§3.4) · Cross-refs (§3.5)

`### 6.` 끝:

> **Say where each seat came from**, not only which tier it ran at: how many reviewers were native,
> how many external, and which model answered each. A caveat that reports the tier alone turns false
> the moment the panel spans tools, and provenance a reader can't see is a panel they can't reproduce.

`## Pitfalls to avoid`:

> - **Buying tools instead of lenses** — the same lens seated twice with a different model behind it
>   is still one reviewer with two names. A second vendor lowers correlation only between lenses that
>   already differ; it is never a substitute for designing them.
> - **Unlabelled provenance** — if the caveat doesn't say which seats answered from outside, the
>   coverage claim can't be audited and the panel can't be reproduced.

`## Cross-references` 의 `external-model-consult` 항목에 셋째 조합을 더했다:

> A third shape now exists — a native panel
> with one seat filled from outside — and the confirmation before running it belongs here
> ("Seats an outside tool can fill"), not there.

### 1.8 `references/reviewer-design.md` — `## Define independence` 뒤 문단 신설 (8줄, 설계 §3.6)

5개 판정 기준은 **손대지 않았다.** 설계가 준 문단을 그대로 붙였다:

> **Model provenance is a correlation control, not a sixth criterion.** Two reviewers with the same
> lens stay one reviewer whichever models run them — the five tests above still decide independence.
> What a second vendor buys is different: two reviewers whose lenses already differ fail *together*
> less often when they do not share a model family, and that joint-failure rate is the quantity
> "Nine Judges, Two Effective Votes" says a panel's information content is made of. So spend an
> outside seat on the lens whose miss would cost the most, not on the panel at large, and write down
> which model answered each seat — a panel whose provenance is unrecorded cannot be replicated.

### 1.9 `external-model-consult` — 4곳 (설계 §4.1~§4.4)

**§4.1 `## Prerequisite` 도입 일반화** (그래야 model-orchestration 이 재서술 없이 가리킬 수 있다):

> This is the rule for any external CLI the harness routes to, not only the two
> below: **the tool's installation and login are the user's action.** You report
> what is missing; you never install, authenticate, or substitute another provider
> on their behalf.

**§4.4 노후 사실 수정** — 관측은 유지하고 버전 문자열만 제거. **이 한 줄이 E 게이트의 기존
양성(canary)이었다**:

| | 문안 |
|---|---|
| ASIS | `(verified against` **`codex 0.144.5`** `with an empty CODEX_HOME; codex retries "Reconnecting… n/5" first …)` |
| TOBE | `(verified against a` **`logged-out codex`** `with an empty CODEX_HOME; codex retries "Reconnecting… n/5" first …)` |

**§4.2 `## When NOT to use` 1항** — 설계 초안 그대로:

> - Handing an external CLI actual implementation work in your repo — the guarantee
>   that makes this skill safe is that the repo never enters the provider's
>   workspace, and an executor needs the opposite. That lane, its predicates, and
>   its one-time user approval belong to `model-orchestration` where installed.

**§4.3 Mode P 1줄**:

> It
> can also be called for a **single seat** on that native panel; the confirmation
> a tool-spanning panel needs is owned there, not here.

---

## 2. 완료 기준 5개 — 명령과 출력

### 2.1 신규 계약 게이트 36/36 green

```
$ npx vitest run tests/external-tool-routing.test.ts
 ✓ tests/external-tool-routing.test.ts (36 tests) 29ms

 Test Files  1 passed (1)
      Tests  36 passed (36)
```

**변경 전 같은 명령의 출력**(편집 착수 직전, 같은 세션에서 실측):

```
 Test Files  1 failed (1)
      Tests  24 failed | 12 passed (36)
```

→ 24 red 가 전부 green. **테스트 파일은 한 글자도 고치지 않았다**(§3.3 의 `git status` 가 증거).

### 2.2 인접 게이트 2건 green 유지

```
$ npx vitest run tests/subagent-file-handoff.test.ts tests/templates-distribution-hygiene.test.ts
 ✓ tests/templates-distribution-hygiene.test.ts (13 tests) 84ms

 Test Files  2 passed (2)
      Tests  18 passed (18)
```

`templates-distribution-hygiene` 의 **F**(로컬 CLI 설정 파생 모델 id 누출)는 이 머신에서 실제로
돌았고 0건이다 — 새로 쓴 본문에 로컬 설정발 모델 id 가 없음의 실측 근거다. (같은 실행의
`console.warn` 두 줄은 픽스처용 임시 디렉터리에 대한 것이고, 실 설정 검사 쪽은 미수행이 아니다.)

### 2.3 `npm run ci` exit 0 — 파이프 없이

```
$ CI_LOG=$(mktemp -t ci-impl-XXXX).log && npm run ci > "$CI_LOG" 2>&1; echo "EXIT=$?"
EXIT=0

$ grep -E "Test Files|Tests  |Branches|Lines " "$CI_LOG"
 Test Files  92 passed (92)
      Tests  1337 passed (1337)
Branches     : 88.8% ( 1332/1500 )
Lines        : 96.9% ( 2098/2165 )
```

typecheck → lint(`biome check src tests`) → test:coverage → build 전부 통과. branches 88.8% ≥ 게이트
88. 문서·자산 변경의 영향 범위는 grep 으로 고르지 않는다는 룰대로 **전체 스위트**로 판정했다.

### 2.4 두 사본의 일치 — `diff`

```
$ for f in model-orchestration/SKILL.md multi-persona-review/SKILL.md \
           multi-persona-review/references/reviewer-design.md external-model-consult/SKILL.md; do
    diff -q "templates/skills/$f" ".claude/skills/$f" >/dev/null && echo "SAME  $f" || echo "DIFF  $f"; done
SAME  model-orchestration/SKILL.md
SAME  multi-persona-review/SKILL.md
SAME  multi-persona-review/references/reviewer-design.md
SAME  external-model-consult/SKILL.md
```

해당 절만이 아니라 **파일 전체가 바이트 동일**하다. 그 1:1 을 무는 게이트는 4개
(`subagent-file-handoff` 3 + `external-tool-routing` 의 `reviewer-design.md` 1)이고, §4.1 변이 ⑦ 이
실제로 무는 것을 확인했다.

### 2.5 frontmatter 무변경 — HEAD 대비 해시 일치

```
$ for f in <6파일>; do
    a=$(git show "HEAD:$f" | awk 'NR==1&&/^---$/{p=1;print;next} p{print; if(/^---$/){exit}}' | shasum)
    b=$(awk 'NR==1&&/^---$/{p=1;print;next} p{print; if(/^---$/){exit}}' "$f" | shasum)   # 동일성 비교
  done
frontmatter UNCHANGED  (c19029510223ef11b982bb1f310bad7599ae2c60)  templates/skills/model-orchestration/SKILL.md
frontmatter UNCHANGED  (d0bf103f89559d0c2405d4940698554356863fac)  templates/skills/multi-persona-review/SKILL.md
frontmatter UNCHANGED  (715c094a2700c5ea5f361e293af42315196cf86e)  templates/skills/external-model-consult/SKILL.md
frontmatter UNCHANGED  (c19029510223ef11b982bb1f310bad7599ae2c60)  .claude/skills/model-orchestration/SKILL.md
frontmatter UNCHANGED  (d0bf103f89559d0c2405d4940698554356863fac)  .claude/skills/multi-persona-review/SKILL.md
frontmatter UNCHANGED  (715c094a2700c5ea5f361e293af42315196cf86e)  .claude/skills/external-model-consult/SKILL.md
```

`git diff` 로도 확인 가능하다 — 세 SKILL.md 의 diff hunk 는 전부 본문 영역이고 `---` 블록 안에
`+`/`-` 가 없다. **상주 descriptor 토큰 증가 0**(설계 §5.4·ADR-069 Consequences 와 일치).

---

## 3. 범위를 지켰다는 증거

### 3.1 안 만든 것

새 스크립트 0 · 새 훅 0 · 새 룰 0 · `src/**` 수정 0 (설계 §8-1·6·7·8, ADR-069 가드레일 6).

### 3.2 배포물 위생

배포 본문에 **구체 모델명·티어명 0건**(§8-5) — `templates-distribution-hygiene` 과
`external-tool-routing` 의 E 가 둘 다 green. ADR 번호 · 릴리스 태그 · 홈 경로 · `docs/research/`
경로도 새 문안에 없다(위생 게이트 green). 이슈가 예로 든 모델명은 **한 개도 옮기지 않았다.**

### 3.3 `git status --porcelain` — 내가 만든 변경만

```
 M .claude/settings.json                                            ← 사용자 소유, 착수 시점부터 M
 M .claude/skills/.DS_Store                                         ← 사용자 소유, 착수 시점부터 M
 M .claude/skills/external-model-consult/SKILL.md                    ┐
 M .claude/skills/model-orchestration/SKILL.md                       │
 M .claude/skills/multi-persona-review/SKILL.md                      │ 내가 고친 8파일
 M .claude/skills/multi-persona-review/references/reviewer-design.md │
 M templates/skills/external-model-consult/SKILL.md                  │
 M templates/skills/model-orchestration/SKILL.md                     │
 M templates/skills/multi-persona-review/SKILL.md                    │
 M templates/skills/multi-persona-review/references/reviewer-design.md ┘
```

`tests/**` 에 변경 0. `.claude/settings.json` · `.claude/skills/.DS_Store` 는 **착수 시점의 git
status 스냅샷에 이미 `M`** 이었고 나는 열지도 않았다(`.DS_Store` 는 Finder 가 바꾸는 바이너리다).
git 쓰기 명령(add·commit·checkout·stash)은 한 번도 실행하지 않았다.

### 3.4 편집 전 두 사본이 동일했음 — `cp` 동기화가 남의 변경을 덮지 않았다는 근거

```
$ (편집 전) diff -q templates/skills/<4파일> .claude/skills/<4파일>
SAME  model-orchestration/SKILL.md
SAME  multi-persona-review/SKILL.md
SAME  multi-persona-review/references/reviewer-design.md
SAME  external-model-consult/SKILL.md
```

네 파일이 편집 전에 이미 byte-identical 이었으므로 `templates/`→`.claude/` 복사가 `.claude/` 쪽
고유 내용을 지운 경우는 없다.

---

## 4. 음성 대조 — 이 초록불이 실제로 무는가 (설계 §5.3 의 "구현 후" 항목)

지금 트리의 green 만으로는 "본문이 계약을 만족해서 green" 과 "게이트가 이 본문을 안 봐서 green" 이
구분되지 않는다. §2.1 의 before/after(24 red → 36 green)가 1차 증거이고, 그 위에 **실제 본문을
외과적으로 변이시켜** 어느 단언이 무는지 확인했다. 변이는 `git checkout` 이 아니라 문자열 편집으로
하고, **원복 후 해시 일치를 확인했다**(전례: 변이 복구를 `git checkout` 으로 하다 다른 변경을 날린
사례).

### 4.1 6/6 — 의도한 단언만 red

각 변이는 `templates/` 사본에만 적용했다. 그래서 `templates/skills` 루트의 그 단언 1개만 red 가 되고
`.claude/skills` 루트는 green 으로 남는다(= 게이트가 **파일별로** 본다는 것도 같이 보인다).

| # | 변이 (무엇을 했나) | 결과 | 기대와 일치 |
|---|---|---|---|
| ① | P3 에서 `until in-harness cross-verification clears it` 삭제 | `× A1 — 다섯 술어가 전부 있다` (1 failed / 35 passed) | ✅ |
| ② | `**First use in a repository is the user's call, not yours.**` 문장 삭제 | `× A2 — 최초 외부 도달은 사용자 결정` | ✅ |
| ③ | anti-pattern 신규 첫 행 삭제 | `× B1 — 외부 실행기에 테스트·검증 금지` | ✅ |
| ④ | `A panel that spans more than one tool is` → `A panel is` | `× C1 — 복수 도구 패널의 사전 확인` | ✅ |
| ⑤ | `## When NOT to use` 의 실행 위임 경계 1항 삭제 | `× D1 — 실행 위임은 내 일이 아니다` | ✅ |
| ⑥ | `logged-out codex` → `codex 0.144.5` (버전 슬러그 **복원**) | `× E — 구체 모델 슬러그 0건` | ✅ |
| ⑦ | `.claude` 사본의 제목에 공백 1자 추가 | `× 설치본(.claude) 사본이 1:1 이다` | ✅ |

⑥ 은 **추가형 변이**다 — 삭제형만 쓰면 위생 게이트의 방향(있으면 안 되는 것)을 검증할 수 없다.
⑦ 은 테스트 레인이 "미실행 — 구현 후 검증 레인"으로 남긴 항목이고(테스트 보고 §5), 여기서 닫았다.

원복 검증:

```
restore OK  templates/skills/model-orchestration/SKILL.md
restore OK  templates/skills/multi-persona-review/SKILL.md
restore OK  templates/skills/external-model-consult/SKILL.md
$ npx vitest run <신규 게이트 + 인접 2건>
 Test Files  3 passed (3)
      Tests  54 passed (54)
```

### 4.2 살아남은 변이 1건 — 정직하게 적는다

**첫 시도로 P5 의 `, and it can use a shell` 만 지웠는데 36 passed 로 살아남았다.** 원인을 확인했다:

```
$ awk '/^## External executors/{p=1} p&&/^## Effort floors/{exit} p' <mo> | grep -n "shell|셸"
17:| **P5** | It is **not the CLI you are running on**, and it can use a shell | … with no shell, this lane doesn't exist for you |
39:**Call the tool's non-interactive mode from the shell.** Read the subcommand off `--help` …
```

앵커 `A1·P5-셸`(`/shell|셸/i`)은 **절 슬라이스 전체**를 보고, 그 슬라이스에 `shell` 이 3번 나온다 —
P5 행 안에 2번(내가 지운 것 + `with no shell`), 그리고 설계 §2.1(f) 가 요구한 호출 형태 줄에 1번.
그래서 P5 전반절만 지워도 앵커는 여전히 충족된다.

- **내 본문의 결함이 아니다.** P5 는 설계 §6.4 가 요구한 두 조건 AND 로 실재하고(§1.1 인용),
  §2.1(f) 도 설계가 요구한 줄이다. 둘 다 있어야 맞다.
- **게이트의 한계다.** 테스트 보고 §7-5 가 이미 공시한 것과 같은 성질이다("앵커는 어휘 계약이지
  의미 계약이 아니다"). 이 특정 구멍은 그보다 좁다 — 같은 슬라이스 안의 **다른 정당한 문장**이 같은
  낱말을 갖고 있어서 한쪽 삭제를 못 잡는다.
- **내가 고칠 일이 아니다.** 앵커를 좁히려면 `tests/**` 를 고쳐야 하고 그것은 계약 변경이다. 검토
  대상으로 넘긴다(§6-①).

---

## 5. 설계와 다르게 쓴 곳 (2건, 둘 다 위치·분량이고 내용 삭감은 없다)

**① 줄수가 설계 예상을 넘는다** — mo +60(예상 +36) · mpr +37(예상 +23) · reviewer-design +8(예상 +9)
· emc +11(예상 +9). 항목 수는 설계 §2·§3·§4 와 1:1 이고(빠뜨린 항목 0, 추가한 항목 0), 초과분은
전부 **줄바꿈**이다: 설계가 "3줄"이라 센 라우팅 3불릿이 파일의 기존 ~100자 랩에서 9줄이 되고,
신설 절은 표·문단 사이 빈 줄까지 45줄이 됐다. 게이트는 줄수를 보지 않고, 상주 비용은
frontmatter 에만 걸리므로(§2.5) 이 초과는 상주 비용을 늘리지 않는다.

**② `#### Seats an outside tool can fill` 을 `### 3.` 의 끝에 놓았다** — 설계 §3.2 는 "파일 핸드오프
문단 뒤(:113 뒤)"라고 했다. 그 자리에 `####` 를 넣으면 뒤따르는 **일반 step-3 산문 2문단**
(페르소나 티어 고정 노트, 각 페르소나의 반환 형식)이 "외부 좌석" 하위 절 **안으로 들어간다** —
외부 좌석과 무관한 규칙이 그 제목 아래 읽히게 된다. `### 3.` 안이면서 핸드오프 문단 뒤라는 두 조건은
절 끝에서도 성립하므로 끝으로 옮겼다. 영향 확인:

- C1·C2·C3 앵커는 위치를 안 본다 → green(§2.1).
- `subagent-file-handoff` 의 step-3 단언(`### 3.`~`### 4.` 슬라이스에 `Effective Votes`)도
  green — 그 문장은 여전히 같은 슬라이스에 있다(§2.2).
- 슬라이스 끝을 `####`/`###`/`##` 중 먼저 오는 것으로 막는 슬라이서와도 정합(다음 헤딩 = `### 4.`).

---

## 6. 못 한 것 · 미검증 (추정을 실측처럼 쓰지 않는다)

1. **앵커 한 개는 음성 대조로 못 닫았다** — `A1·P5-셸`(§4.2). 본문은 설계대로 두 조건 AND 이지만,
   그 절반을 지워도 게이트가 안 문다. **무엇이 풀리면 닫히는가**: 앵커를 슬라이스 전체가 아니라
   `P5` 행으로 좁히면 닫힌다 — 그것은 `tests/**` 수정이므로 **내 권한 밖**이고, 테스트 레인 또는
   사용자 판정이 필요하다.
2. **외부 CLI 의 실동작·인증은 이번에도 미검증** — 본문은 "그 CLI 가 자기 설정으로 고른 모델을
   쓴다"라고 쓰지만 **실호출을 하지 않았다**(ADR-069 적용 범위 §미적용, 설계 §9-6 이 예고한 그대로).
   저장소 코드를 외부로 보내는 첫 위임은 사용자 확인 대상이라 구현 레인이 임의로 할 일이 아니다.
3. **문면이 실제 위임 행동을 바꾸는지는 측정하지 않았다** — 판정한 것은 문면·배선이다
   (ADR-069 Consequences 와 같은 한계).
4. **F 게이트는 CI 에서 돌지 않는다** — 이 머신에서는 돌아 0건이지만(§2.2), CI 에는 그 설정 파일이
   없어 warn 후 미수행이다. CI 에서 상시 무는 것은 E 다.
5. **독립 리뷰 미수행** — 이 보고서와 본문은 **구현자 자신의 산출물**이다. 이 리포의 대원칙대로
   코드를 쓰지 않은 레인이 다시 돌려 판정해야 한다. 특히 §4.2 의 구멍과 §5-② 의 위치 변경은
   리뷰 대상으로 명시해 넘긴다.
6. **Non-Goals 침범 없음**(설계 §8 전 12항) — 확인했다: 새 스크립트·훅·룰 0, `src/**` 0,
   description 0, 기존 3레인 역할·effort floor 문장 무수정, OpenCode 를 자문 provider 로 추가 0,
   다중 도구 패널을 기본값으로 만들지 않음, 세 스킬에 같은 서술 복제 0(C3 green).
7. **별건으로 남는 기존 결함**(설계 §6.3·§8-11) — `model-orchestration`·`external-model-consult` 의
   description 이 공식 상한 1,024 자를 넘긴다는 사실은 **이번 사이클에서 손대지 않았고 그대로다.**
   이번 변경이 그 수치를 바꾸지 않았다(frontmatter 무변경).

---

## 7. 다음 레인에 넘기는 한 문장

`npx vitest run tests/external-tool-routing.test.ts` 가 **36/36** 이고 `npm run ci` 가 **exit 0**
이다. 검증 레인은 이 보고를 읽는 대신 그 두 명령을 직접 돌리고, **§4.2(살아남은 변이) 와
§5-②(하위 절 위치 변경) 두 곳을 먼저** 보라 — 내가 스스로 판정할 수 없는 두 지점이다.

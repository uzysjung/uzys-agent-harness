# E2 — 이슈 #287 7원칙 × 담으라/담지 마라 대조

작성 2026-08-09. 전제(사용자 확정): **7원칙은 이미 옳다.** 이 문서는 채택 여부를 묻지 않고
**배포본으로서 참이 되게 다듬는다.** 글자 수·토큰은 사실로만 보고하고 자르는 근거로 쓰지 않는다.

인용 표기: `원장:줄` = `docs/research/…` · `코드:줄` = 이 리포 소스 · `제안 L##` =
이슈 #287 본문의 펜스 블록(사본 `scratchpad/proposal-287.md`, 117줄).

---

## 0. 결론 먼저 (BLUF)

**제안을 그대로 배포하면 세 가지가 조용히 깨진다.** 원칙이 틀려서가 아니라, 이 앵커가 *배포물*이라서
생기는 문제다 — 원칙 문장이 서 있는 자리에 이미 **기계 게이트 3개**와 **CLI 4종의 렌더 경로**가
붙어 있다.

| # | 무엇이 | 근거 |
|---|---|---|
| ① | 이 리포의 `lane-principle-anchor-parity` 게이트 **3축이 전부 red** 가 된다 (문단 스코프 채점) | 아래 §C-0. 탐지기를 현재본(=알려진 양성)으로 검증한 뒤 측정 |
| ② | 상시 스킬 3종의 **발화 지점이 사라진다** — 설치돼 있어도 안 돈다 | 제안이 「Skills that apply continuously」 절 전체를 삭제. 그 절의 존재 이유 = `git log 6e6079c` |
| ③ | 앵커 H1 `# AGENTS.md` 가 **Claude 설치본에서 거짓 이름**이 된다 | claude 경로는 원문 그대로 복사(`src/manifest.ts:216-220`), 나머지 3 CLI 는 H1 을 떼고 임베드(`src/codex/agents-md.ts:35`) |

셋 다 **원칙을 자르지 않고** 고쳐진다(문장 3개 복원 + 절 1개 복원 + H1 교체). 그 위에
담지 마라 위반 6건의 재작성문, 배포 표면 간 중복 5건, 공식 담으라 미충족 4축을 아래에 낸다.

**가장 큰 구조적 발견은 (b)다**: 이 앵커는 낯선 저장소로 나가므로 저장소 사실을 담을 수 없는데,
**그 사실을 어디에 적어야 하는지도 말하지 않는다.** 그런데 앵커는 `update` 가 `copyFileSync` 로
통째 덮어쓴다(`src/update-mode.ts:365`) — 설치자가 자기 프로젝트 사실을 앵커에 적으면 다음
업데이트에 사라진다. 현재본·제안 **양쪽 다** 이 포인터가 없다(검증된 grep, §B-2).

---

## A. 담지 마라에 걸리는 표현 — 원문 · 위반 · 고쳐 쓴 문장

### A-1. `# AGENTS.md` (제안 L1) — 배포 진실 위반

**위반**: 원장의 담지 마라 목록이 아니라 **배포 사실**에 걸린다. 이 파일은 4 CLI 로 갈라져 나가고
파일명이 각각 다르다. claude 설치본은 `CLAUDE-uzys-harness.md` 로 **원문 그대로** 복사되므로
(`src/manifest.ts:216-220`) 설치자는 `CLAUDE-uzys-harness.md` 를 열어 `# AGENTS.md` 라는 제목을
본다. 나머지 3 CLI 는 첫 H1 을 정규식으로 떼고 임베드하므로(`src/codex/agents-md.ts:35`) 이 제목은
**어디서도 참이 아니다** — claude 에서는 틀렸고 나머지에서는 버려진다.

> 고쳐 쓴 문장 (L1)
> ```
> # Working Principles
> ```
> 파일명·CLI 이름을 제목에 넣지 않는다. 이름은 설치 경로마다 다르고, 본문은 4곳 모두에서 같다.

### A-2. "Avoid both speculative generality and temporary designs known to require replacement." (제안 L58-59)

**위반**: 원장 `dyld-articles.md:29` — *"✗ **'조심하세요'** 류의 주의 환기 — **'행동과 승인
조건으로 적습니다'**"*. `Avoid both A and B` 는 행동도 승인 조건도 주지 않는다. 게다가 두 항은
코드를 쓰는 시점에 판별 불가다(무엇이 speculative 인지는 나중에야 안다).

> 고쳐 쓴 문장 (L58-59 대체)
> ```
> Design for the requirements that are already written down. When a structural choice would be
> expensive to reverse and the requirement driving it is not written down anywhere, name the two
> options and ask before committing to one.
> ```
> 행동(=적힌 요구까지만 설계) + 승인 조건(=적히지 않은 요구가 구조를 끌 때는 묻는다)으로 바뀐다.
> 판별자가 "적혀 있는가"라서 저장소 안에서 확인된다.

### A-3. "Follow local style …" (제안 L75-76)

**위반**: 원장 `dyld-articles.md:27` — *"✗ '기존 스타일을 따릅니다' — 모호한 패턴 참조"*. 원장이
제시한 해법은 파일 경로로 지목하는 것(`dyld-articles.md:20`)인데, 배포 앵커는 낯선 저장소의 경로를
쓸 수 없다. **쓸 수 있는 것은 "local" 의 해석 규칙**이다 — 지금은 저장소 전체인지, 모듈인지,
편집 중인 파일인지가 정해져 있지 않다.

> 고쳐 쓴 문장 (L75-76 대체)
> ```
> Match the file you are editing — its naming, error handling, and layout. Where files disagree,
> follow the repository's formatter and linter configuration rather than your own preference.
> Depart from either only where a contract, security boundary, data integrity, or an intentionally
> tested behavior requires it, and say so in the report.
> ```
> 지시대상이 "편집 중인 파일 → 저장소 설정" 순으로 고정된다. 예외 절은 제안 원문을 유지.

### A-4. "verify their versions, documentation, types, and capabilities" (제안 L53-55)

**위반 ⓐ**: 원장 `docs-resident-criteria.md:86-91` — *"Avoid instructing re-checks it already
performs … these compound with the model's own behavior and add cost without improving results."*
명사 4개를 나열한 "verify" 는 일반적 재확인 지시에 가깝다.
**위반 ⓑ**: `Prefer maintained libraries` 의 *maintained* 는 관측 불가 — A-3 과 같은 모호한 참조.

> 고쳐 쓴 문장 (L53-56 대체)
> ```
> Read the API of the version that is actually installed — from the lockfile and the package's own
> type definitions — before calling it. Do not call an API you have not seen in that version.
> Add a dependency only when it removes more code than it adds, and prefer what the repository
> already depends on over an unfamiliar equivalent.
> ```
> 재확인 지시가 **하나의 관측 가능한 행동**(설치된 버전의 API 를 읽는다)으로 좁아지고, 실패
> 유형(있지도 않은 API 호출)이 명시된다. 선택 기준도 저장소 안에서 확인 가능한 사실로 바뀐다.

### A-5. "Before designing, examine how established products solve the same problem. Prefer proven patterns." (제안 L12-13)

**위반**: *proven* 은 판정 불가(모호한 참조), 그리고 트리거·정지 조건이 없어 매 설계마다 조사를
유발한다 — 원장 `docs-resident-criteria.md:78-84` 의 과잉 검증 안티패턴과 같은 형태다.
**자를 대상이 아니다**(원장 `dyld-articles.md:169` 가 이 원칙을 싣고 사용자가 채택했다) — 발화
조건을 붙이는 것이 고침이다.

> 고쳐 쓴 문장 (L12-13 대체)
> ```
> When a design is new to this repository and an established product already solves the same
> problem, look at how it does before inventing a shape, and name in the plan what you took from
> it. When the repository already contains a working precedent, follow the precedent instead.
> ```
> 트리거(저장소에 처음) · 산출(계획에 출처를 적는다) · 정지 조건(전례가 있으면 조사하지 않는다).

### A-6. 6항목 금지 나열 (제안 L34-37)

**위반**: 원장 `docs-resident-criteria.md:107-110` — *"Positive examples of the communication style
you want tend to be more effective than instructions about what not to do."* 한 문장에 금지 6개가
붙어 있어 각각의 판별자가 안 보인다. (참고: 원장이 **역효과를 실증한** 금지형은 "생각하지 마라"류
뿐이고(`docs-resident-criteria.md:99-105`) 제안에는 그 형태가 없다. 즉 이 항목은 역효과 교정이
아니라 **가독·판별 개선**이다.)

> 고쳐 쓴 문장 (L34-37 대체)
> ```
> Implement the minimum change that completely satisfies the request. Add a feature the request
> asked for, a configuration something already reads, an abstraction with a second caller today, an
> extension point something extends now, and defensive code with a named failure mode, contract,
> trust boundary, or security requirement behind it.
> ```
> 같은 6항목이 **통과 조건**으로 바뀐다(요청됨 / 읽는 것이 있음 / 두 번째 호출자 있음 / 지금
> 확장하는 것이 있음 / 이름 붙은 실패 유형 있음). 금지어 0개, 항목 손실 0개.

### A-7. "Prefer direct, explicit, reproducible, and testable behavior." (제안 L39)

**위반**: 형용사 4개 나열 — 관측 가능한 판별자가 없다(`docs-resident-criteria.md:229-233`,
*"write instructions that are concrete enough to verify"*). 뒤 문장(`Brevity is not simplicity …`)이
이미 판별자를 갖고 있어 앞 문장이 없어도 손실이 없다. 그리고 결정성 요구는 배포 룰
`templates/rules/test-policy.md:9` 가 이미 소유한다(한 사실은 한 곳에 — §C-5).

> 고쳐 쓴 문장 (L39 앞 문장 삭제, 뒤 문장만 유지·보강)
> ```
> If equally sufficient approaches exist, choose the simplest one that reaches a verified result
> soonest. Brevity is not simplicity when it makes behavior harder to state or to check.
> ```

### A-8. (경계 사례 · 자르지 말 것) "Before editing, inspect the affected code, tests, callers, …" (제안 L8-10)

원장 기준으로는 **조건 2**(모델이 이미 하는 것)에 가장 가깝다. 그러나 이 문장의 판별자는 뒤 절
— *"Resolve questions from the repository before asking the user"* 와 목록의 *worktree changes* —
이고, 후자는 §4 가 명시하는 관측된 실패(사용자 변경 덮어쓰기)와 1:1이다. **유지 권고.** 다만 이
절이 "일반 자기점검"으로 읽히지 않도록 판별자를 문장 앞으로 올리는 편이 낫다:

> ```
> Resolve questions from the repository before asking the user: before editing, inspect the
> affected code, tests, callers, interfaces, dependencies, documentation, and uncommitted worktree
> changes.
> ```

---

## B. "코드에서 알 수 없는 내용만" — 낯선 저장소로 나가는 배포물에서 무엇을 뜻하는가

### B-1. 기준의 재해석 (판정)

원장의 원문은 *"코드에서 알 수 없는 내용만 적습니다"*(`dyld-articles.md:19`)이고, 같은 계열의
공식 문장은 *"Anything Claude can figure out by reading code"* 를 ❌ 로 둔다
(`docs-resident-criteria.md:355-363`). **이 기준은 한 저장소를 전제한다** — "코드"가 가리키는
대상이 있어야 성립한다.

우리 앵커는 **대상 코드를 못 본다.** 그래서 기준이 방향을 바꾼다:

- 한 저장소에서: "코드에서 유도되는 것을 빼라" → **중복 제거**의 기준.
- 배포 앵커에서: 저장소 사실을 적으면 **대부분의 설치에서 거짓**이 된다 → **금지**의 기준.
  (공식 ❌ 목록의 *"Aspirational rules the team does not actually follow"*
  `docs-resident-criteria.md:47` 가 여기에 정확히 걸린다. 낯선 팀이 따르지 않는 규칙을 우리가
  선언하면 그것이 aspirational rule 이다.)

따라서 **배포 앵커에 남을 수 있는 문장은 두 조건을 동시에 만족하는 것뿐**이다:

- **조건 1 — 어떤 코드베이스를 읽어도 유도되지 않는다.** 즉 *무엇을 만드는가*가 아니라 *어떻게
  일하는가*. 원장이 이 범주를 직접 명명한다: *"여러 작업에 걸쳐 반복되는 판단 원칙"*
  (`dyld-articles.md:15`).
- **조건 2 — 모델이 지시 없이 이미 하는 행동이 아니다.** (`docs-resident-criteria.md:488`
  *"Default assumption: Claude is already very smart"*)

**이 기준은 배포 앵커에 적극적 의무 하나를 새로 만든다.** 저장소 사실을 담을 수 없으므로,
**그 사실이 어디에 적히는지**를 앵커가 가리켜야 한다. 원장의 최소 템플릿이 통째로 "작업 전에
확인할 곳 / 승인 규칙 / 검증 / 범위"인 것(`dyld-articles.md:76-96`)과 대비하면, 우리 앵커는 그
네 칸 중 **승인·검증·범위만** 채울 수 있고 "확인할 곳"은 구조적으로 못 채운다 — 그러니 그 칸이
어디 있는지를 말해야 한다.

### B-2. 그 포인터가 있는가 — 없다 (검증된 grep)

```
# 탐지기 검증(알려진 양성): 실제로 있는 낱말은 잡힌다
$ grep -n "repository" templates/CLAUDE.md
13,14,141  → 3 hits

# 본 검사: 프로젝트 사실이 어디 적히는지 가리키는 낱말
$ grep -nE "CLAUDE\.md|AGENTS\.md|\.claude/|project context|scaffold|FILL" templates/CLAUDE.md
1:# Uzys-agent-harness CLAUDE.md          ← H1 뿐
$ grep -nE "…같은 패턴…" scratchpad/proposal-287.md
1:# AGENTS.md                              ← H1 뿐
```

**설치 구조상 포인터는 한 방향뿐이다.** 스캐폴드 → 앵커는 있다
(`src/project-claude-merge.ts:124`, SCAFFOLD_BANNER 가 *"The working principles live in this
project's harness anchor …"* 로 앵커를 지목). 앵커 → 스캐폴드는 **없다.**

**왜 이것이 안전 문제인가**: 앵커는 하네스 소유라 `update` 가 무조건 덮어쓴다 —
`src/update-mode.ts:365` `copyFileSync(templateMd, anchor)`. 설치자가 앵커에 자기 프로젝트 사실을
적으면 다음 업데이트에 **경고 없이 사라진다**(루트 `CLAUDE.md` 는 반대로 절대 안 덮어쓴다 —
`src/update-mode.ts:337-345`). 지금은 그 갈림을 앵커 본문이 말해 주지 않는다.

> 채울 문장 (앵커 머리말, 제안 L3-4 뒤에 1문단)
> ```
> These principles are installed and refreshed by the harness: edits made here are replaced on the
> next update. Facts about this repository — its stack, commands, layout, red lines, and the check
> that proves a change is safe — belong in the project's own context file (the root `CLAUDE.md`
> for Claude Code, the `## Project Context` section of `AGENTS.md` for the other CLIs), which the
> harness never overwrites. When a fact about this repository is missing there, write it there,
> not here.
> ```
> 이 문단은 조건 1·2 를 모두 만족한다: 어느 코드베이스에서도 유도되지 않고(설치 구조 사실),
> 모델이 지시 없이 알 수 없다. 그리고 **템플릿 위생 통과** — 경로 리터럴 2개는 설치본에 실재하고
> ADR 번호·릴리스 태그·홈 경로가 없다(`tests/templates-distribution-hygiene.test.ts:112`).

### B-3. 절별 판정

| 절 | 조건 1 (코드에서 유도 불가) | 조건 2 (모델 기본 행동 아님) | 판정 |
|---|---|---|---|
| §1 Understand First | ✓ | △ — 전반은 기본 행동에 가깝다. 판별자는 "저장소에서 먼저 해소" + "worktree 변경" | 유지 (A-8 로 판별자 전면 배치) |
| §2 Define Success and Keep It Simple | ✓ | ✓ — 완료 기준 선언·최소 구현은 지시 없이 흔들리는 축 | 유지 (A-6·A-7 문장 교정) |
| §3 Preserve Sound Boundaries | ✓ (¶1·¶2) / **✗ (¶4)** | ✓ | **¶4 만 조건 1 위반** — 아래 |
| §4 Make Surgical Changes | ✓ | ✓ — 관측된 재발 실패(사용자 변경 덮어쓰기)와 직결 | 유지 (A-3 교정) |
| §5 Verify and Review | ✓ | ✓ | 유지 + 상한 명시(§D-4) + 게이트 문장 복원(§C-0) |
| §6 Protect High-Impact Boundaries | ✓ | ✓ | **가장 적합.** 원장 최소 템플릿 §작업 제한 및 승인 규칙(`dyld-articles.md:83-86`)과 1:1 |
| §7 Report Evidence | ✓ | ✓ | 원장 담으라 *"실제로 실행하지 않은 검증은 통과했다고 보고하지 않습니다"*(`dyld-articles.md:23`)와 1:1 |

**§3 ¶4 (제안 L61-64) — 유일하게 조건 1 을 어기는 문단.**
*"Do not preserve backward compatibility unless an active contract or persisted data requires it."*
이것은 작업 원칙이 아니라 **저장소 정책**이고, 낯선 저장소에서 기본값이 거짓일 수 있다: 공개
패키지·SDK·플러그인 API 는 소비자가 저장소 밖에 있어 "active contract" 가 저장소 안에서 판별되지
않는다. 원장 `dyld-articles.md:31` — *"✗ 단일 작업용 요구사항을 저장소 룰에 — 앞으로의 작업에
불필요한 제약이 된다"* 의 반대 방향 사례(한 저장소의 정책을 전 저장소 룰로). 원칙 자체는
theaxlabs 원칙 2(`dyld-articles.md:170-171`)로 사용자가 채택한 것이므로 **자르지 않고 판별자를
저장소 안으로 끌어온다**:

> 고쳐 쓴 문장 (L61-64 대체)
> ```
> Delete paths you have verified are unused instead of adding compatibility layers, fallbacks, dual
> paths, or migrations to keep them alive. A path counts as unused only when every caller is inside
> this repository and you have checked them. When the consumers are outside it — a published
> package, a documented API, or persisted data — treat removal as a change that needs explicit
> authorization, and say which consumers you could not check.
> ```

---

## C. 중복 제거

### C-0. 먼저 — 삭제로 인해 **기계 게이트 3축이 red** 가 된다 (중복이 아니라 손실)

이 리포에는 배포 앵커의 문장을 **문단 단위로 채점**하는 게이트가 있다:
`tests/lane-principle-anchor-parity.test.ts`. 축마다 ⓐ 산출물 명사 ⓑ 그것을 만든 레인이 아닌
쪽을 가리키는 술어가 **같은 문단 안에** 있어야 통과한다(같은 파일 L219-228).

탐지기를 원 게이트로 검증한 뒤(현재 배포본에 대해 `npx vitest run
tests/lane-principle-anchor-parity.test.ts` → **27 passed**), 같은 정규식·같은 문단 분할로 제안을
채점했다(복제 스크립트 `scratchpad/axis-check.mjs`):

```
== templates/CLAUDE.md (현재 배포본, paragraphs=40)      ← 알려진 양성
   설계 리뷰 분리   PASS      검증의 자기 증거  PASS      적대적 패널의 문턱  PASS
== proposal-287.md (제안, paragraphs=35)
   설계 리뷰 분리   FAIL (lane predicate missing)
   검증의 자기 증거  FAIL (lane predicate missing)
   적대적 패널의 문턱 FAIL (artifact noun missing)
```

원인은 **제안이 지운 문장 3개**다(전부 현재본에 있다):

| 축 | 지워진 문장 (현재본) | 제안의 대체 | 왜 통과 못 하나 |
|---|---|---|---|
| 설계 리뷰 분리 | `templates/CLAUDE.md:90` *"Delegate review to an agent **other than the one that produced the work**."* | L87 *"Independent review by another agent is required:"* | 술어 `other than the one that produced` 가 사라졌고, 산출물 명사(spec/plan)는 **다른 문단**(L89)에 있다 |
| 검증의 자기 증거 | `templates/CLAUDE.md:94` *"A reviewer **verifies the work itself rather than trusting the author's report**."* | 없음 | 술어가 통째로 삭제 |
| 적대적 패널의 문턱 | `templates/CLAUDE.md:22-24` *"…settle it with an **adversarial panel** of independent reviewers … expensive to reverse…"* | 없음(§1 에 `expensive to reverse` 만 남음) | 산출물 명사(adversarial panel)가 삭제 |

**게이트를 고치지 말 것.** 이 게이트는 선행 판본이 배포 앵커에서 **비대칭으로 살아** claude 외
3 CLI 에 거짓 문장이 나갔던 사고를 막으려고 만든 것이다(같은 파일 L14-19). 고칠 자리는 문장이다.

> 복원안 — §5 를 두 문단으로 (제안 L87-96 대체)
> ```
> Independent review is required at two points, and it is done by an agent other than the one that
> produced the work: a completed specification, plan, or design before anything is built on it, and
> any completed change before deployment.
>
> Give the reviewer the completion criteria and relevant constraints. A reviewer verifies the work
> itself rather than trusting the author's report; independent review supplements direct
> verification and does not replace it. At these two points an unreviewed artifact is not verified.
> If no reviewer is available, say so and do not present self-review as independent review.
> ```
> 첫 문단이 축1(spec/plan + `other than the one that produced`)을, 둘째 문단이 축2(verification +
> `verifies the work itself rather than trusting`)를 한 문단 안에서 만족한다. 제안이 번호 목록으로
> 얻은 스캔성은 잃지만 — 목록으로 두려면 **각 항목 줄에 술어를 붙여야** 게이트를 만족한다.
> (목록 유지안: `1. A completed specification, plan, or design, reviewed by an agent other than the
> one that produced it, before anything is built on it.`)

> 복원안 — 적대적 패널 (제안 §1, L21 뒤에 1문단; 현재본 L22-24 의 축약)
> ```
> When independent lanes disagree, or the call is genuinely uncertain and expensive to reverse,
> settle it with an adversarial panel of independent reviewers rather than the loudest lane. On
> smaller calls take the better-evidenced answer — a panel costs more than the decision is worth.
> ```
> **문턱 절(`expensive to reverse` / 마지막 문장)을 떼지 말 것** — 게이트가 무는 것은 "패널을
> 쓰라"가 아니라 "**되돌리기 비싼 결정에만** 쓰라"는 짝이다(같은 파일 L104-110 의 canary).

### C-0b. 같은 삭제로 사라지는 것 2건 (게이트는 없지만 배포 계약)

- **「Skills that apply continuously」 절**(현재본 L127-139) — 제안이 통째 삭제. 이 절은
  *"상시 적용 스킬은 설치돼 있어도 발화 지점이 없으면 안 돈다. 스킬은 프롬프트와 관련 있어 보일 때
  로드되는데 '모든 답변에 적용' 류는 그 판정에 안 걸린다"* 는 이유로 넣은 것이다
  (`git log 6e6079c` 본문 ⓑ). 각 줄의 `where installed` 조건도 장식이 아니다 — 조건을 떼면
  `resident-doc-asset-reachability` 가 red 가 되는 것까지 음성 대조로 확인돼 있다(같은 커밋).
  **삭제하면 게이트는 초록인데 스킬 3종이 조용히 안 돈다.** 유지 권고.
  (참고: `task-brief` 만은 훅이 일부 보완한다 — `templates/hooks/task-brief-nudge.sh`, 400자 이상
  · `<objective>` 없음. 그러나 그 훅은 claude 설치에만 배선된다(`src/codex/transform.ts` 의
  `HOOK_NAMES = ["session-start"]`) → 나머지 3 CLI 는 앵커 줄이 유일한 발화 지점이다.)
- **「Decisions and explanations」 절**(현재본 L119-125) — 제안이 통째 삭제. 사용자 상시 요구
  (AS-IS → TO-BE + 추천 + 이유 + UI/UX 형태)의 배포판 앵커다. 삭제는 **사용자 확정 사항의 철회**라
  이 문서가 임의로 판단할 대상이 아니다 — **명시적 결정 항목으로 올린다.**
- **마지막 줄**(현재본 L141-142, *"Unless this repository defines otherwise, a merge is gated on
  regression tests …"*) — 제안이 삭제. 이것은 공식 담으라 범주 *"Testing instructions and preferred
  test runners"*(`docs-resident-criteria.md:355-363`)의 **저장소 불문 기본선**이고, `Unless this
  repository defines otherwise` 가 붙어 있어 aspirational rule 이 되지 않는다. 유지 권고.

### C-1. 제안 **내부** 중복 — 추상화 억제가 3곳

| 위치 | 문장 |
|---|---|
| L34-37 | `one-use abstractions, unnecessary indirection, unused extension points` |
| L50-51 | `Keep interfaces narrow; do not abstract hypothetical reuse.` |
| L58-59 | `Avoid both speculative generality and …` |

같은 실패를 세 번 겨냥한다. **권고**: A-6 의 긍정형 한 문장이 §2 에서 소유하고, §3 ¶1 은
*모듈 경계의 판별 기준*(책임·신뢰 경계·수명·변경 이유)만 남긴다 — 그 판별 기준은 §2 에 없는
고유 정보다. L58-59 는 A-2 로 이미 대체된다.

### C-2. 제안 **내부** 중복 — 승인 게이트 2개의 경계가 안 보인다

§1 L18-21(`… cost … expensive to reverse … ask before proceeding`)과
§6 L100-102(`destructive, privileged, costly, or shared-state operation … explicit approval`).
둘 다 승인인데 `cost/costly` 가 양쪽에 있어 어느 쪽이 적용되는지 독자가 판단해야 한다.

> 고침 (§6 첫 문장 앞에 반 문장 추가)
> ```
> §1 covers a choice you are about to make; this covers an action you are about to run. Before any
> destructive, privileged, costly, or shared-state operation, state the exact action and target and
> obtain explicit approval.
> ```
> (또는 §1 쪽에서 `cost` 를 빼고 `behavior, data, security, architecture, or scope` 로 좁혀도
> 같은 효과 — 실행 비용은 §6, 설계 비용은 §1.)

### C-3. 제안 **내부** 중복 — "무엇이 남았는가" 2회

§5 L84-85 `report exactly what remains unmet and why` · §7 L109-110 `what was not verified, and
what remains`. **권고**: 보고 항목은 §7 이 소유하고, §5 는 *막혔을 때의 행동*만 남긴다 —
`If blocked, stop rather than weakening the criteria.` (§7 L116-117 이 이미 handoff 를 소유한다.)

### C-4. **배포 표면 간** 중복 — 앵커 §5 vs 배포 룰 `ship-checklist`

`templates/rules/ship-checklist.md:5` — *"**머지는 그 변경을 만들지 않은 레인의 리뷰를 거친다.**
만든 쪽이 자기 산출물을 판정하면 그건 검증이 아니다."* 앵커 §5 와 **같은 사실**이고, 같은 설치에서
둘 다 상주한다(룰 7종 중 `paths:` 를 가진 것은 `cli-development.md` 하나뿐 — 나머지 6종은 무조건
로드). 그리고 같은 설치에 나가는 `templates/rules/doc-governance.md:3` 이 *"**한 사실은 한 곳에.**
같은 내용을 두 문서에 쓰지 않는다 — 한 곳에 두고 나머지는 가리킨다"* 를 싣고 있다. **하네스가
자기 배포 룰을 위반한다.**

**단, 앵커 쪽을 지우면 안 된다 — 도달 범위가 다르다** (실측):

| CLI | 앵커 도달 | `.claude/rules/*.md` 도달 |
|---|---|---|
| Claude Code | `CLAUDE-uzys-harness.md` (`src/manifest.ts:216-220`) | ✓ 상주 |
| OpenCode | `AGENTS.md` 임베드 | ✓ `templates/opencode/opencode.json.template:4` 의 `instructions` 글롭 |
| Codex | `AGENTS.md` 임베드 | ✗ — `src/codex/transform.ts`·`templates/codex/config.toml.template` 에 `rules` 참조 0 (`AGENTS` 는 잡히는 대조군) |
| Antigravity | `.agents/rules/uzys-harness.md` (`src/antigravity/transform.ts:93-116`) | ✗ — 앵커 1파일만 |

즉 **룰 파일은 4 CLI 중 2곳에서만 읽힌다.** 원칙 문장은 앵커가 소유하고, `ship-checklist` 룰의
그 줄은 *저장소별 게이트 배선*(머지 시점 · 게시가 검증에 의존하도록 배선 · 경로별 증거)만 남기고
원칙 문장은 앵커를 가리키는 것이 맞다. **이 정리는 #287 범위 밖의 후속 작업으로 분리 권고** —
앵커 개정과 룰 개정을 한 PR 에 섞으면 게이트 red 의 원인이 갈린다.

### C-5. **배포 표면 간** 중복 — 앵커 §7 vs 배포 룰 `test-policy`

- `templates/rules/test-policy.md:13-14` — *"Run the relevant checks and inspect their results.
  Never report a check as passed unless it was executed and observed."* ≡ 제안 §7 L112-113.
- `templates/rules/test-policy.md:20` — *"Report what was tested, what was not tested, and the
  remaining risk."* ≡ 제안 §7 L109-110.
- `templates/rules/test-policy.md:19` — *"If the affected scope cannot be established confidently,
  broaden the validation."* ≡ 제안 §5 L83.
- `templates/rules/test-policy.md:9` — 결정성 요구 ≡ 제안 §2 L39 (A-7 에서 삭제 권고한 문장).

C-4 와 같은 처리(앵커가 원칙을 소유, 룰은 저장소별 선택을 소유). **사실 보고**: 앵커는 영어,
배포 룰 7종 중 5종은 한국어다 — 두 층을 합치거나 서로 가리키게 만들 때 언어를 하나로 정해야 한다.

### C-6. 현재본 vs 제안 — 어느 표현이 나은가

| 항목 | 현재본 | 제안 | 판정 |
|---|---|---|---|
| 머리말의 승인 문장 | L4-6 `Do not infer approval …` 가 §6 L112-114 와 중복 | 머리말에서 제거, §6 만 유지 | **제안 승** — 순수 중복 제거 |
| 스타일 준수 | L57·L68-69 두 문단(`Match the existing local style` + `Contracts … take precedence`) | L75-76 한 문장 조건절 | **제안 승** (그 위에 A-3 적용) |
| 불확실성 표기 | L26 `Do not present assumptions or judgments as evidence.` — 실패 유형을 명명 | L17 `State uncertainty plainly and distinguish facts, assumptions, and judgments.` — 일반 자기보고 | **현재본 승**. 병합안: `State uncertainty plainly, and label which statements are facts, which are assumptions, and which are judgments. Do not present an assumption or a judgment as evidence.` |
| 독립 리뷰 | L90-95 술어 보유(게이트 통과) | L87-96 목록형, 술어 소실 | **현재본 승** — C-0 복원안이 양쪽을 합친다 |
| 적대적 패널 | L22-24 보유 | 없음 | **현재본 승** (C-0) |
| 상시 스킬 · 의사결정 형식 · 머지/릴리즈 기본선 | 보유 | 없음 | **현재본 승** (C-0b) |
| 절 제목 | `Think before coding` 등 동사구 | `Understand First` 등 — 7절로 분해, 경계 원칙 신설 | **제안 승** — §3(경계·의존성·수명)은 현재본에 없는 축 |

---

## D. 강화 후보 — 공식 담으라 중 **제안·현재본 어느 쪽에도 없는** 축

각 항목은 조건 1·2(§B-1)를 통과하고 템플릿 위생(ADR 번호·릴리스 태그·홈 경로 없음)을 지킨다.

### D-1. 이 파일이 자라고 줄어드는 규칙 (축적 루프 + 세대 리셋)

**근거**: `docs-resident-criteria.md:189-194` — *"Add to it when: Claude makes the same mistake a
second time / A code review catches something Claude should have known / You type the same
correction … / A new teammate would need the same context."* · `docs-power-user-tips.md:23-26` —
*"anytime Claude does something incorrectly, add it to CLAUDE.md"* · 반대 방향은
`docs-resident-criteria.md:387-390` — *"Ruthlessly prune. If Claude already does something
correctly without the instruction, delete it"* · `dyld-articles.md:149` — *"모델이 바뀌면
프롬프트도 덜어내야 합니다"*.
**왜 지금 없는가**: 7원칙은 *일하는 법*만 말하고 *이 지시층을 유지하는 법*은 말하지 않는다.
앵커가 하네스 소유라 설치자가 여기에 못 적는다는 점(§B-2)과 맞물려, 축적 경로가 아예 안 보인다.

> 채울 문장 (§7 뒤 또는 머리말 포인터 문단 뒤)
> ```
> ## Keeping these instructions true
>
> When the same correction is needed a second time, propose adding it to the project's context file
> — with the observable behavior it should produce — rather than repeating it in chat. When an
> instruction there describes something you now do correctly without being told, or names a tool,
> path, or command that no longer exists, propose removing it and say what you observed.
> ```

### D-2. 프로즈로 못 막는 것은 프로즈에 적지 않는다 (판단층 ↔ 집행층)

**근거**: `dyld-articles.md:57-58` — *"**룰 ≠ 집행**: '문서는 판단 방향을 제공하고, 시스템은 넘지
말아야 할 경계를 집행합니다'"* · `docs-resident-criteria.md:176-178` — *"Claude treats them as
context, not enforced configuration. To block an action regardless of what Claude decides, use a
PreToolUse hook instead."* · `docs-resident-criteria.md:288-290` — *"If the instruction is something
that must run at a specific point … write it as a hook instead."*
**실측**: 현재본·제안 양쪽에 `hook|permission|enforce` 문자열이 **0건**(§0 의 grep). 그런데 이
하네스는 훅과 permission 을 함께 설치한다 — 즉 앵커가 자기 집행층의 존재를 말하지 않는다.

> 채울 문장 (§6 끝에 1문단)
> ```
> These principles are advisory: they shape decisions, they do not block actions. When something
> must hold every time regardless of judgment, it belongs in the enforcement layer this repository
> already has — a hook, a permission rule, or a CI gate — not in a sentence here. If you find
> yourself relying on a sentence to prevent an irreversible action, say so and propose the gate.
> ```

### D-3. 리뷰어에게 주는 범위 제한 (§5 의 균형추)

**근거**: `docs-resident-criteria.md:439-442` — *"A reviewer prompted to find gaps will usually
report some, even when the work is sound … Chasing every finding leads to over-engineering: extra
abstraction layers, defensive code, and tests for cases that can't happen. Tell the reviewer to flag
only gaps that affect correctness or the stated requirements, and treat the rest as optional."*
**왜 지금 필요한가**: 제안 §5 는 독립 리뷰를 **의무**로 못 박는다(현재본보다 강하다). 균형추가
없으면 그 의무가 곧바로 과잉 설계로 번역된다. 이 문장은 배포 표면 어디에도 없다 — 유일한 사본이
`templates/skills/audit-harness-fit/references/official-criteria.md:313` 인데, 그건 그 스킬이
발화해야 로드되므로 리뷰 시점에 도달하지 않는다.

> 채울 문장 (§5, C-0 복원안 둘째 문단 끝에 이어서)
> ```
> Tell the reviewer to flag only what affects correctness or the stated completion criteria, and to
> mark everything else as optional. A reviewer asked for gaps will produce gaps; treating every
> finding as mandatory buys extra abstraction, defensive code, and tests for cases that cannot
> happen.
> ```

### D-4. 검증·위임의 **상한** (과잉 검증 억제)

**근거**: `docs-resident-criteria.md:80-84` — *"If your prompt contains explicit verification
instructions … remove them: instructions like these cause over-verification … The same applies to
legacy harness scaffolding that adds separate verification steps."* · 같은 파일 L136-139 —
*"Delegate to a subagent only for large tasks that are genuinely independent and parallelizable …
do not use subagents to verify or double-check your own work."*
**출처가 어긋난다 — 병기한다**: 공식 문서는 *별도 검증 단계와 검증용 서브에이전트*를 줄이라 하고,
이 리포는 두 지점의 **독립 리뷰**를 요구한다(사용자 확정, 게이트로 강제). 두 지시는 **충돌하지
않는다** — 공식이 겨냥한 것은 *자기 일의 재확인*이고 여기서 요구하는 것은 *만들지 않은 레인의
판정*이다. 다만 그 구분이 앵커에 안 적혀 있어서, 다음 세대 모델이 §5 를 "매 단계 검증 패스"로
읽을 여지가 있다. **상한을 명시하면 원칙을 자르지 않고 그 오독을 막는다.**

> 채울 문장 (§5, 위 D-3 문단 뒤 한 줄)
> ```
> Outside these two points, do not add verification passes or hand work to another agent to
> double-check what you can check yourself.
> ```

### D-5. (사실 보고 · 채울 문장 아님) 배포 앵커가 구조적으로 못 채우는 담으라 범주

공식 담으라 표(`docs-resident-criteria.md:355-363`, `:29-37`)의 다음 범주는 **저장소 사실이라
배포 앵커에 담을 수 없다**: Bash 명령 · 기본값과 다른 코드 스타일 · 테스트 러너 · 브랜치/PR 관례 ·
아키텍처 3문장 · 환경 quirk · known gotcha. 이 범주들은 설치본의 **프로젝트 스캐폴드 6절**이
받는다(`src/project-claude-merge.ts:61-117` — identity / stack / architecture / installed-assets /
boundaries / verify). 즉 하네스는 이미 이 범주를 **구조로** 커버하고 있고, 빠진 것은 §B-2 의
**포인터 한 문단**뿐이다.

---

## E. 분량 — 사실만 (자르는 근거로 쓰지 말 것)

측정 명령·복제 스크립트: `scratchpad/size-check.mjs` (렌더는 `src/codex/agents-md.ts:33-41` 복제).
토큰은 이 리포 자신의 근사식 `chars/4`(`src/context-cost.ts:18-22`).

### E-1. 앵커 파일 자체

| | 줄 | 바이트 | ~토큰 |
|---|---|---|---|
| 현재 배포본 `templates/CLAUDE.md` | **142** | 6,755 | ~1,685 |
| 제안 #287 | **117** | 5,103 | ~1,276 |
| 위 §C-0/C-0b/D 를 **전부** 적용 시 (산식 추정, 미측정) | 약 175 | — | — |

추정 산식(줄): 117 − 2(§5 재작성) + 4(적대적 패널) + 13(상시 스킬 절) + 8(의사결정 절) +
3(머지·릴리즈 기본선) + 8(포인터 문단) + 9(D-1) + 7(D-2) + 6(D-3) + 2(D-4) ≈ **175**.
항목별로 채택/기각이 갈리므로 실제 값은 채택 조합에 따라 **145~175** 사이다.

Anthropic 기준 *"target under 200 lines per CLAUDE.md file"*(`docs-resident-criteria.md:205-206`)
**안쪽**이다 — 현재본·제안·복원안 모두.

### E-2. 설치자가 실제로 무는 파일 (앵커 ≠ 상주 총량)

| 설치 | 세션마다 로드되는 파일 | 현재본 기준 | 제안 기준 | 적용 기준 |
|---|---|---|---|---|
| Claude Code | 루트 `CLAUDE.md` **47줄**(실측: 제목·트랙 + 스캐폴드 39 + import 블록) **+** 앵커 | **189줄** (47+142) | **164줄** (47+117) | 200줄(Anthropic) — **둘 다 안쪽, 현재본은 여유 11줄** |
| Codex | `AGENTS.md` 단일 (앵커 임베드 + 스캐폴드 + 템플릿 고유분) | **248줄 / 13.1 KiB** | 223줄 / 11.5 KiB | 32 KiB(OpenAI, `dyld-articles.md:39`) — **41%** |
| OpenCode | `AGENTS.md` + `.claude/rules/*.md`(글롭) | **241줄 / 12.4 KiB** (+룰 88줄) | 216줄 / 10.8 KiB | 32 KiB — **39%** |
| Antigravity | `.agents/rules/uzys-harness.md` | **211줄 / 11.5 KiB** | 186줄 / 9.9 KiB | 32 KiB — **36%** |

**사실 세 가지**: ⓐ Codex·OpenCode·Antigravity 가 무는 파일은 **이미 200줄을 넘는다**(248 · 241 ·
211) — 다만 그 파일에 적용되는 공식 기준은 200줄이 아니라 32 KiB 이고 셋 다 여유가 크다.
ⓑ 200줄 기준이 걸리는 유일한 경로는 Claude Code 이며, 거기서는 현재본(189)도 제안(164)도 기준
안이다. ⓒ **여유가 11줄뿐인 현재본에 §C-0/D 의 복원·추가를 얹으면 Claude 경로가 200줄을 넘는다**
(누적 추정: C-0 만 → 앵커 119 / 합계 166 · C-0+C-0b → 143 / 190 · +B-2 포인터 → 151 / 198 ·
+D-1~D-4 → 175 / **222 = 초과**). 즉 **D 4건을 다 얹는 순간 Claude 경로만 기준을 넘는다.**
이것은 자르라는 뜻이 아니라 **선택지를 아는 채로
결정하라는 뜻**이다 — 공식 문서가 주는 대안은 셋이고 전부 배포 앵커에 적용 가능하다:
`paths:` 스코프 룰로 내리기 · 스킬로 내리기 · 세션마다 필요 없는 줄 제거
(`docs-resident-criteria.md:210-214`). 참고로 그 200줄은 **하드 리밋이 아니다** — 같은 문서가
*"CLAUDE.md files are loaded in full regardless of length, though shorter files produce better
adherence"*(`docs-resident-criteria.md:216-217`)라고 명시한다.

### E-3. 부정 표현 (참고 수치)

`do not / never / avoid / don't` 출현: 현재본 **16회 / 문장 ~70**, 제안 **13회 / 문장 ~61**
(둘 다 ~21~23%). 제안이 더 나쁘지 않다. A-6 을 적용하면 제안은 8회로 내려간다.

---

## F. 적용 순서 (권고)

1. **게이트 복원 3문장 + H1** — 없으면 `npm run ci` 가 red 다. (§C-0, §A-1)
2. **절 2개 복원** — 「Skills that apply continuously」는 복원, 「Decisions and explanations」는
   **사용자 결정**. (§C-0b)
3. **포인터 문단 1개 추가** — 배포물로서 참이 되는 최소 조건. (§B-2)
4. **담지 마라 재작성 6건** — A-1~A-7. 원칙 손실 0.
5. **강화 4건** — D-1~D-4.
6. **배포 룰과의 중복 정리(C-4·C-5)는 별도 PR** — 앵커 개정과 섞으면 red 원인이 갈린다.

## G. 이 문서가 검증하지 않은 것

- 제안 문장이 **실제 모델 행동을 바꾸는가** — 측정 안 했다. 원장이 요구하는 확인
  (`docs-resident-criteria.md:379` *"test changes by observing whether Claude's behavior actually
  shifts"*)은 이 작업 범위 밖이다.
- 위 재작성문을 넣은 **전체 파일로 `npm run ci` 를 돌리지 않았다** — 리포 파일 무수정 제약. 검증한
  것은 ⓐ 현재본이 게이트를 통과한다(실제 vitest 실행) ⓑ 제안 원안이 3축에서 실패한다(게이트
  정규식 복제, 알려진 양성으로 탐지기 검증 완료)까지다.
- `docs/research/claude-md-standards-2026-08-09/00-index.md:32-40` 이 "이번에 수집할 것"으로 적은
  **1차 출처 5건(OpenAI AGENTS.md 공식 · Harness Engineering · agent loop · Anthropic Steering ·
  prompting best practices)은 디렉터리에 파일이 없다** — 미수집. 이 문서의 판정은 2차 자료
  (`dyld-articles.md`, 전문 대조 안 됨 — 그 파일 L3-4 의 등급 주의)와 기존 원장
  (`rules-hooks-value-audit-2026-08-02/`, 전문 확보분)에만 근거한다. 특히 **32 KiB 기준은
  2차 자료 인용이 유일한 근거**다.

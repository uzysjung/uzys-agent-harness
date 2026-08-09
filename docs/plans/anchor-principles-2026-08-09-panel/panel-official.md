# 패널 렌즈 — 공식 문서 대조자 (official)

작성 2026-08-09 · 리포 무수정(읽기 전용) · 브랜치 `main` · 제안 사본
`scratchpad/proposal-287-official.md`(118줄, `gh issue view 287` 의 펜스 블록 그대로)

전제(사용자 확정, 재론 없음): **7원칙은 이미 옳다.** 이 문서는 채택 여부를 묻지 않는다. 글자 수·
토큰·"8줄"은 판정 근거로 쓰지 않았다. 이 렌즈가 쓰는 잣대는 하나다 — **공식 문서가 실제로 무엇을
지시하는가.** 원장 요약을 믿지 않고 `docs/research/` 의 원문 인용을 직접 열어 대조했고, 저장소
사실은 전부 탐지기를 알려진 양성으로 먼저 검증한 뒤 측정했다.

---

## 0. 한 줄 판정 (BLUF)

**원칙 7개 중 공식이 "다른 곳으로 옮겨라"라고 지목하는 것은 §6 하나뿐이고, 그 처방은 삭제가 아니라
훅·권한과의 병행이다.** 나머지 6개는 Anthropic 이 지금도 **권장 문안으로 싣는 내용과 문면이
겹친다.** 그러므로 이 렌즈가 낼 수 있는 결론은 "깎아라"가 아니라 셋이다 — ⓐ 집행하는 척하는
문장에 집행층을 붙여라 ⓑ 스스로 모순되는 두 문단을 정렬해라 ⓒ 잃어버린 색인 기능을 되살려라.

---

## 1. 판정 요약

| # | 등급 | 대상 | 무엇이 |
|---|---|---|---|
| F1 | **P0** | §6 전체 | 공식이 이름으로 부르는 유일한 안티패턴(`"Never do this"`)인데, 배포물이 함께 까는 집행층을 앵커가 한 번도 말하지 않는다 |
| F2 | **P0** | §3 ¶4 ↔ §4 ¶1·¶2 | 같은 대상(검증된 미사용 경로)에 삭제/보존을 두 줄 간격으로 반대 지시. 임의 선택의 한쪽이 **요청 없는 코드 삭제** |
| F3 | **P0** | L1 `# AGENTS.md` | Claude 경로는 원문 복사라 제목이 파일명과 어긋난다 — 참인 설치가 하나도 없다 |
| F4 | P1 | §5 L90 "before deployment" | 같은 설치에 나가는 배포 룰이 이 시점을 **명시적으로 부정**한다("배포 직전이 아니라 머지 시점") |
| F5 | P1 | 앵커 전체 (색인 소실) | 다른 파일·스킬·도구를 가리키는 토큰 **0개**. 두 회사가 독립적으로 도달한 유일한 합의(지도/목차/인덱스)를 정면으로 거스른다 |
| F6 | P1 | §5 리뷰어 범위 | 리뷰 의무만 있고 상한이 없어 §2(최소 구현)와 서로를 상쇄한다. 공식이 교정 문장까지 준다 |
| F7 | P1 | §1 ¶2 선행 조사 | 트리거·정지 조건 없음. 최신 세대에서 과발화가 공식 경고 대상 |
| F8 | P1 | 머지·릴리즈 티어 삭제 | 공식 담으라 범주 중 **배포 앵커가 실제로 채울 수 있는** 몇 안 되는 칸 |
| F9 | P2 | L58-59 · L53-56 | 금지 13건 중 이유도 대체 행동도 없는 2건 |
| F10 | P2 | §1 ↔ §6 의 `cost` | 두 승인 게이트가 같은 낱말을 판별자로 쓴다 |
| F11 | P2 | §5 검증 상한 | 공식이 "빼라"고 말하는 유일한 축. 지금은 상한이 안 적혀 있다 |

---

## 2. Findings

### F1 (P0) — §6 은 집행하는 척한다. 공식 처방은 삭제가 아니라 병행이다

**대상**: 제안 §6 전체 (L98-105)

**근거**

- `primary-anthropic-steering.md:218-225` — 다섯 안티패턴 중 두 번째, 원문 그대로:
  > "**\"Never do this\" in CLAUDE.md.** When there's something that absolutely must not happen, an
  > instruction is the wrong tool. Claude will follow the instruction most of the time, but when
  > under pressure, in a long session or an ambiguous situation, or due to a prompt injection in a
  > file accessed as part of the task, the model can fail to follow a prompted rule. **A real
  > guardrail needs to be deterministic, and the enforcement methods are hooks and permissions.**"
- `docs-resident-criteria.md:176-178` — > "Claude treats them as context, not enforced
  configuration. To block an action regardless of what Claude decides, use a PreToolUse hook
  instead."
- `dyld-articles.md:57` — > "문서는 판단 방향을 제공하고, 시스템은 넘지 말아야 할 경계를 집행합니다"
- **실측**(탐지기 검증: 알려진 양성 `review` 9건 검출 확인): `hook|permission|enforce|CI gate|
  guardrail` 이 **제안 0건 · 현재 배포본 0건.**
- **그런데 집행층은 실재하고 함께 설치된다**: `templates/hooks/protect-files.sh:47-60` 이
  `.env*` · lock 파일 · `*.pem|*.key|*.p12|*.pfx` 편집을 `exit 2` 로 차단하고,
  `templates/scripts/protect-branch.sh` 는 `.uzys-agent-harness/` 라는 **CLI 중립 슬롯**으로
  설치된다(`src/manifest.ts:227-228`).
- **도달 실측 — 이것이 P0 인 이유**: 차단 훅은 Claude Code 에만 배선된다
  (`src/codex/transform.ts:63` `HOOK_NAMES = ["session-start"]`, opencode·antigravity transform 에
  `hook` 0건). 룰도 4 CLI 중 2곳만 읽힌다(`templates/opencode/opencode.json.template:4` 글롭 vs
  codex/antigravity 참조 0건, 대조군 `AGENTS` 는 잡힘). → **Codex·Antigravity 설치에서 §6 은
  배포물 전체를 통틀어 유일한 경계 서술이고, 자기가 집행되지 않는다는 사실을 아무도 말하지 않는다.**
- 덧붙여 §6 은 **예시가 없다.** `primary-anthropic-steering.md:79` 는 CLAUDE.md 본문에 대해
  > "being explicit, explaining the why behind constraints, and **showing examples**"
  를 요구하고, 같은 축의 권장 문안(`primary-anthropic-prompting.md:209-224`)은 세 범주를 이름으로
  나열한다.

**고쳐 쓴 문장** (§6 을 세 문단으로)

```
Before any destructive, privileged, or shared-state operation, state the exact action and target and
obtain explicit approval. Do not infer approval from a broad objective. Local, reversible work —
editing files, running tests — does not need it. These do: deleting files, branches, or tables;
force-pushing, resetting away tracked work, amending published commits, or bypassing a verification
flag; and anything other people see, such as pushing, merging a pull request, commenting on one,
publishing a package, or changing shared infrastructure. When an obstacle blocks you, do not reach
for one of these as the way around it.

Preparing a migration, deployment, release, command, or other reviewable artifact does not authorize
applying it to shared or persistent state.

These principles are advisory: they shape a decision, they do not stop an action. Anything that has
to hold every time regardless of judgment belongs in the enforcement layer instead — a pre-tool hook
that exits non-zero, a permission rule, or a host-side branch rule that the agent cannot reinstall
around. If you find yourself relying on a sentence here to prevent something irreversible, say so
and name the gate that should replace it.
```

세 번째 문단이 **"훅이 있다"가 아니라 "거기에 넣어라"** 로 쓰인 것이 중요하다 — 훅은 4 CLI 중
1곳에만 배선되므로 "있다"는 나머지 3곳에서 거짓이 되고, 그러면 공식 ❌ 목록의
*"Aspirational rules the team does not actually follow"*(`docs-resident-criteria.md:47`)에 걸린다.

---

### F2 (P0) — §3 ¶4 와 §4 가 같은 대상에 반대를 지시한다. 공식이 준수율 붕괴의 1순위로 꼽는 형태다

**대상**: 제안 §3 L61-64 ↔ §4 L68-73

**근거**

원문 두 곳을 나란히 둔다(실측 인용):

> §3 L62 — "**Delete verified-unused paths** instead of adding compatibility layers, fallbacks,
> dual paths, or migrations."
>
> §4 L69-70 — "Remove only artifacts made obsolete by the change **or paths verified as unused and
> safe to remove**."
> §4 L72 — "**Leave unrelated dead code untouched.**"

§4 ¶1 의 마지막 절이 허용하는 것을 §4 ¶2 의 첫 문장이 금지한다 — **두 줄 간격**이다. §3 은 그
행동을 *권장*으로 격상시켜 긴장을 키운다. 독자(모델)는 "검증된 미사용 경로"가 "관련 없는 죽은
코드"의 부분집합인지를 매번 스스로 판정해야 한다.

- `docs-resident-criteria.md:235-237` — > "**Consistency**: if two rules contradict each other,
  Claude may pick one arbitrarily."
- `docs-resident-criteria.md:284-286` — > "Look for conflicting instructions across CLAUDE.md files.
  If two files give different guidance for the same behavior, Claude may pick one arbitrarily."
- `primary-anthropic-steering.md:269` — > "the more instructions you provide … the less strictly
  Claude will follow them, **particularly if any contradict.**"
- **현재 배포본에는 이 긴장이 없다**: `templates/CLAUDE.md:59` 는 *"Remove only artifacts made
  obsolete by your own change."* 하나뿐이고 §3 에 해당하는 절 자체가 없다. → **제안이 새로 만든
  모순이다.**
- **P0 인 이유**: 임의 선택의 한쪽 결과가 **요청하지 않은 코드 삭제**다. 그 행동은 같은 문서
  §6 이 승인 대상으로 규정한 파괴적 조작이라, 이 모순이 §6 까지 같이 무력화한다. 낯선 저장소에
  설치되는 배포물에서 이것은 가정이 아니라 시나리오다.

**고쳐 쓴 문장** (§3 ¶4 대체 — §4 는 손대지 않는다)

```
Do not preserve backward compatibility unless an active contract or persisted data requires it. When
the change you were asked for makes a path unreachable, delete that path rather than adding a
compatibility layer, fallback, dual path, or migration to keep it alive. Paths your change does not
touch stay as they are, even when they look unused — removing those is a separate request. Breaking
an active dependency requires explicit authorization, and say which consumers you could not check.
```

판별자가 하나로 정렬된다: **내 변경이 도달 불가로 만든 것인가.** 원칙(하위 호환 레이어를 쌓지
않는다)은 그대로 남고, §4 의 *"Leave unrelated dead code untouched"* 와 더 이상 다투지 않는다.
부수 효과로, 공개 패키지·SDK 처럼 소비자가 저장소 밖에 있는 경우에 앵커가 거짓 정책을 선언하던
문제(`docs-resident-criteria.md:47` 의 aspirational rule)도 같이 닫힌다.

---

### F3 (P0) — H1 `# AGENTS.md` 는 참인 설치가 하나도 없다

**대상**: 제안 L1

**근거**

- `docs-resident-criteria.md:306-308` — > "**Claude Code reads `CLAUDE.md`, not `AGENTS.md`.** If
  your repository already uses `AGENTS.md` for other coding agents, create a `CLAUDE.md` that
  imports it so both tools read the same instructions without duplicating them."
- 배선 실측: claude 경로만 렌더를 거치지 않고 **원문 그대로 복사**된다
  (`src/manifest.ts:216-221` → `CLAUDE-uzys-harness.md`). 나머지 3 CLI 는 첫 h1 을 정규식으로 떼고
  임베드한다(`src/codex/agents-md.ts:35`; antigravity 는 같은 렌더러 재사용 —
  `src/antigravity/transform.ts:90-113`).
- 결과: 이 제목은 **claude 에서는 틀리고 나머지 셋에서는 버려진다.** 참인 설치가 없다.
- 현재본 H1(`# Uzys-agent-harness CLAUDE.md`)도 claude 전용 이름이라 최선이 아니다.

**고쳐 쓴 문장**

```
# Working Principles
```

파일명도 CLI 이름도 제목에 넣지 않는다 — 이름은 설치 경로마다 다르고(4종) 본문은 네 곳에서 같다.

---

### F4 (P1) — §5 의 리뷰 시점을 같은 설치의 배포 룰이 명시적으로 부정한다

**대상**: 제안 §5 L90 *"For any completed change before deployment."*

**근거**

- `templates/rules/ship-checklist.md:5` — > "**머지는 그 변경을 만들지 않은 레인의 리뷰를 거친다.**
  만든 쪽이 자기 산출물을 판정하면 그건 검증이 아니다. **배포 직전이 아니라 머지 시점이다** —
  리뷰 없이 쌓인 변경은 배포 때 형식만 채워진다."
  → 룰이 앵커의 시점을 **낱말 단위로 부정**한다.
- 두 문서는 같은 세션에 함께 상주한다: Claude Code(`src/manifest.ts:197-198` → `.claude/rules/`)와
  OpenCode(`templates/opencode/opencode.json.template:4` 글롭). Codex·Antigravity 는 룰을 안 읽어
  앵커만 남는다.
- `docs-resident-criteria.md:284-286` 이 다루는 정확한 사례다(같은 행동에 다른 지침 → 임의 선택).
- 현재 배포본(`templates/CLAUDE.md:91-92`)도 같은 결함을 갖고 있다 — **제안이 만든 것은 아니지만,
  본문을 통째로 다시 쓰는 지금이 고칠 자리다.**

**고쳐 쓴 문장** (§5 의 번호 목록 대체 — F6·F8 과 한 절로 합쳐진다)

```
Independent review is required at two points, and it is done by an agent other than the one that
produced the work:

1. A completed specification, plan, or design, before anything is built on it.
2. Any completed change, before it merges into the shared branch — at merge, not at release.
   Changes that pile up unreviewed get a formality at release, not a review.
```

목록 각 항목이 아니라 도입 문장이 "만든 쪽이 아닌" 술어를 소유하게 두면, 이 리포의 문단 스코프
게이트(`tests/lane-principle-anchor-parity.test.ts`)가 요구하는 **산출물 명사 + 비생산 레인 술어의
동일 문단 공존**도 함께 만족된다.

---

### F5 (P1) — 앵커가 색인 기능을 전부 잃는다. 두 회사가 독립적으로 도달한 유일한 합의다

**대상**: 제안 전체. 특히 현재본 `## Skills that apply continuously`(L127-139) 삭제

**근거**

- `primary-anthropic-steering.md:81-82` — > "Think of this file as giving Claude an overview of your
  codebase, or as **an index pointing to other files** where Claude can find more information as
  needed."
- `primary-openai-harness.md:55` — > "instead of treating `AGENTS.md` as the encyclopedia, we treat
  it as **the table of contents.**" / `:41` — > "give Codex **a map, not a 1,000-page instruction
  manual.**"
- **실측**(탐지기 검증: 백틱 추출기가 현재본에서 6개 토큰을 잡는 것을 먼저 확인): 제안의 백틱
  토큰은 `Pass` · `Works` · `Completed` **셋뿐이다 — 다른 파일·스킬·도구를 가리키는 토큰 0개.**
  현재본은 3개(`clear-korean-communication` · `task-brief` · `model-orchestration`).
- **스킬 로드 기전이 이 삭제를 비용으로 만든다.** `primary-anthropic-steering.md:49`(원문 표):
  > "Skills | Name and description at session start; full body loads when the skill is invoked"
  즉 **프롬프트와 매칭돼야 본문이 열린다.** "모든 답변에 적용" 류는 그 매칭에 걸리지 않으므로,
  앵커가 이름을 부르지 않으면 매 세션 디스크립터 값만 내고 본문은 영영 안 열린다. 같은 설치에
  스킬 26종이 나간다(`templates/skills/` 실측). **삭제는 절약이 아니라 낭비의 고정이다.**

**고쳐 쓴 문장** (절을 살리되, 현재본을 복사하지 않고 *왜*를 붙인다 — `primary-anthropic-
steering.md:79` *"explaining the why behind constraints"*)

```
## Skills that never get invoked on their own

A skill's body loads when the prompt looks like the skill's job. That works for task-shaped skills
and fails for the ones that apply to every answer or every delegation — nothing in a prompt ever
looks like those, so they cost a descriptor each session and never open. They are named here so they
have a trigger. Each is selected individually at install time, hence the condition on every line.

- `clear-korean-communication`, where installed — every answer, report, and approval request, not
  only the moment approval is asked for.
- `task-brief`, where installed — normalize an incoming work request into the brief shape before
  starting, fill from context the fields the request left open, and show the filled-in brief with
  the assumed values marked.
- `model-orchestration`, where installed — when work is delegated, it decides which model and which
  effort level each lane gets.
```

---

### F6 (P1) — §5 에 리뷰어 범위 제한이 없어 §2 와 서로를 상쇄한다. 공식이 교정 문장을 준다

**대상**: 제안 §5 L92-96

**근거**

- `docs-resident-criteria.md:439-442` — > "A reviewer prompted to find gaps will usually report
  some, even when the work is sound, because that is what it was asked to do. Chasing every finding
  leads to over-engineering: extra abstraction layers, defensive code, and tests for cases that
  can't happen. **Tell the reviewer to flag only gaps that affect correctness or the stated
  requirements, and treat the rest as optional.**"
- 제안 §5 는 독립 리뷰를 **의무**로 못 박는다. 균형추가 없으면 리뷰 지적을 전부 반영하는 순간
  §2 가 금지한 것(방어 코드·1회용 추상화·일어날 수 없는 경우의 테스트)이 그대로 들어온다 —
  **제안 내부의 두 원칙이 서로를 상쇄한다.**
- 이 문장은 배포 표면 어디에도 없다. 유일한 사본은
  `templates/skills/audit-harness-fit/references/official-criteria.md` 인데, 그 스킬이 발화해야
  로드되므로 **리뷰 시점에 도달하지 않는다**(F5 와 같은 기전).

**고쳐 쓴 문장** (§5 마지막 문단 끝에 이어 붙인다)

```
Tell the reviewer to flag only what affects correctness or the stated completion criteria, and to
mark the rest as optional. A reviewer asked for gaps will produce gaps; treating every finding as
mandatory buys exactly what principle 2 forbids — extra abstraction, defensive code, and tests for
cases that cannot happen.
```

---

### F7 (P1) — §1 의 선행 조사 지시에 트리거도 정지 조건도 없다. 최신 세대에서 과발화가 공식 경고 대상이다

**대상**: 제안 §1 L12-13 *"Before designing, examine how established products solve the same
problem. Prefer proven patterns."*

**근거**

- `primary-anthropic-prompting.md:113-116` — > "If your prompts were designed to reduce
  undertriggering on tools or skills, these models may now **overtrigger**. The fix is to dial back
  any aggressive language."
  `:118-120` — > "**Tune anti-laziness prompting:** If your prompts previously encouraged the model
  to be more thorough or use tools more aggressively, dial back that guidance."
- `docs-resident-criteria.md:229-233` — > "**Specificity**: write instructions that are concrete
  enough to verify. For example: \"Use 2-space indentation\" instead of \"Format code properly\"."
  → *proven* 은 이 기준을 통과하지 못한다. 무엇이 proven 인지 판정할 관측이 없다.
- **자를 대상이 아니다.** 사용자가 채택한 원칙이고(`dyld-articles.md:169`), 공식도 조사 자체는
  권장 문안으로 싣는다(`primary-anthropic-prompting.md:229-235` `investigate_before_answering`).
  빠진 것은 **언제 켜고 언제 끄는가**다.

**고쳐 쓴 문장**

```
When the shape you are about to design is new to this repository and an established product already
solves the same problem, look at how it does before inventing one, and name in the plan what you
took from it. When the repository already contains a working precedent, follow the precedent and
skip the survey.
```

트리거(저장소에 처음) · 산출(계획에 출처를 적는다) · 정지 조건(전례가 있으면 조사하지 않는다).

---

### F8 (P1) — 머지·릴리즈 검증 티어의 기본값이 사라진다. 공식 담으라 범주 중 앵커가 실제로 채울 수 있는 칸이다

**대상**: 현재본 마지막 문장(`templates/CLAUDE.md:141-142`) 삭제 — 제안에 대응 없음

**근거**

- `docs-resident-criteria.md:355-363` ✅ 열: > "Testing instructions and preferred test runners"
- `primary-anthropic-steering.md:46`(원문 표, CLAUDE.md 행): > "Build commands, directory layout,
  monorepo structure, coding conventions, **team norms**"
- 현재본 문장은 `Unless this repository defines otherwise` 로 시작해 **낯선 저장소에서 거짓이 되지
  않는다** — 공식 ❌ 목록의 *"Aspirational rules the team does not actually follow"*
  (`docs-resident-criteria.md:47`)를 피하도록 설계된 형태다.
- **배포 룰 쪽은 시점을 말하지 않는다**: `templates/rules/test-policy.md:17-18` 은
  *"Treat coverage as a signal … **Follow the repository-defined CI gates.**"* 뿐이고
  `ship-checklist.md:6` 은 "배포 전"만 말한다. → **머지 시점의 기본값을 이름으로 말하는 곳은
  앵커의 이 한 문장뿐이다.**

**고쳐 쓴 문장** (§5 끝, F4 목록 다음 줄)

```
Unless this repository defines otherwise, a merge is gated on the regression tests covering what
changed, and a release additionally runs the full suite and the end-to-end flows.
```

---

### F9 (P2) — 금지 13건 중 이유도 대체 행동도 없는 것은 2건뿐이다 (그리고 "부정문을 쓰지 마라"는 공식 근거가 없다)

**대상**: 제안 L58-59, L53-56

**근거 — 먼저 통설을 정정한다**

"부정형 지시를 쓰지 마라"는 이 출처들이 뒷받침하지 않는다.

- `primary-anthropic-prompting.md:88-99` — 같은 문서의 **개선 예시가 부정형을 그대로 둔다**:
  > **Less effective:** `NEVER use ellipses`
  > **More effective:** `Your response will be read aloud by a text-to-speech engine, so never use
  > ellipses since the text-to-speech engine will not know how to pronounce them.`
  바뀐 것은 부정형→긍정형이 아니라 **이유의 유무**다.
- 널리 인용되는 *"Tell Claude what to do instead of what not to do"* 는
  `### Control the format of responses` 절 소속으로 **출력 형식**에 한정된다
  (`primary-anthropic-prompting.md:80-82`). 같은 문서의 권장 시스템 프롬프트는 부정형투성이다
  (`:101-104`).
- 요구되는 형태는 **이유 또는 대체 행동**이다: `primary-anthropic-steering.md:79`
  *"explaining the why behind constraints"* · `primary-openai-agents-md.md:187-188` 공식 예시
  > "Do not filter treatment comparisons on post-exposure behavior … **Safe path:** build cohorts
  > from assignment or exposure; report conversion as an outcome."

**실측 — 13건 전수 대조**: 11건은 인접 문장이 대체 행동을 준다(예: L34 는 앞 문장
*"Implement the minimum change that completely satisfies the request"*, L78 은 앞 절
*"Pre-existing changes belong to the user"* 가 이유까지 겸한다). **이유도 대체 행동도 없는 것은
둘이다.**

- **L58-59** `Avoid both speculative generality and temporary designs known to require replacement.`
  — 행동도 승인 조건도 없고, 무엇이 speculative 인지는 작성 시점에 판별 불가다.
  `dyld-articles.md:29` 의 *"✗ '조심하세요' 류의 주의 환기 — '행동과 승인 조건으로 적습니다'"*
  에 정확히 걸린다.
- **L53-56** `verify their versions, documentation, types, and capabilities. Prefer maintained
  libraries …` — 명사 4개 나열 verify 는 정지 조건이 없고, *maintained* 는 관측 불가다.

**고쳐 쓴 문장**

```
(L58-59 대체)
Design for the requirements that are written down. A design built for a requirement nobody wrote
down is a guess, and a design you already know will be replaced is rework you scheduled on purpose.
When a structural choice would be expensive to reverse and the requirement driving it is not written
down anywhere, name the two options and ask before committing to one.

(L53-56 대체)
Before calling a package, read the API of the version that is actually installed — from the lockfile
and the package's own type definitions — so you do not call something that exists only in another
version. Add a dependency only when it removes more code than it adds, and reach for what the
repository already depends on before an unfamiliar equivalent.
```

---

### F10 (P2) — §1 과 §6 이 같은 낱말(`cost`)을 서로 다른 승인 게이트의 판별자로 쓴다

**대상**: 제안 §1 L18-19 (`cost`) ↔ §6 L100 (`costly`)

**근거**

공식 권장 문안은 두 축을 **다른 낱말로** 가른다.

- 범위 판단 축 — `docs-resident-criteria.md:126-132`: > "Make routine judgment calls yourself, and
  check in only when **different readings of the request** would lead to materially different work."
- 실행 승인 축 — `primary-anthropic-prompting.md:209-212`: > "Consider the **reversibility** and
  potential impact of your actions."

제안은 두 축에 같은 낱말을 놓아, 독자가 매번 어느 절을 적용할지 판정해야 한다. `:235-237` 의
"모순"까지는 아니지만 같은 계열의 모호성이고, 고치는 비용이 거의 없다.

**고쳐 쓴 문장** (§1 세 번째 문단 — 실행 비용은 §6 이 단독으로 소유하게 둔다)

```
State uncertainty plainly, and label which statements are facts, which are assumptions, and which
are judgments; do not present an assumption or a judgment as evidence. If two readings of the
request would lead to materially different work — in behavior, data, security, architecture, or
scope — and the difference would be expensive to unwind, present the options and trade-offs and ask
before proceeding. Otherwise state the reading you chose and continue.
```

(현재본 `templates/CLAUDE.md:26` 의 *"Do not present assumptions or judgments as evidence."* 를
함께 흡수했다 — 제안의 *"distinguish facts, assumptions, and judgments"* 는 실패 유형을 이름으로
부르지 않아 일반 자기보고에 가깝다.)

---

### F11 (P2) — 검증의 상한이 없다. 공식이 "빼라"고 말하는 유일한 축이 바로 이 축이다

**대상**: 제안 §5 전체

**근거**

- `docs-resident-criteria.md:80-84` — > "Claude Opus 5 verifies its own work without being told to.
  If your prompt contains explicit verification instructions (\"include a final verification step
  for any non-trivial task,\" \"use a subagent to verify\"), **remove them** … The same applies to
  legacy harness scaffolding that adds separate verification steps."
- `docs-resident-criteria.md:136-139` — > "do not use subagents to verify or double-check your own
  work."
- **정정 — 이 문장들은 제안을 겨냥하지 않는다.** 실측(탐지기 검증: `verif` 어간 17건 검출 확인):
  제안에 `double-check|re-verify|verification step|verification pass|subagent|final check`
  **0건**. 제안의 검증 지시는 전부 ⓐ 착수 전 완료 기준 정의(§2)이거나 ⓑ **만들지 않은 레인**의
  판정(§5)이고, 공식이 지목한 것은 *자기 일의 재확인*이다. → **"모델이 이미 하니 §5 를 빼라"는
  논변은 이 출처로 성립하지 않는다.**
- 다만 **상한이 안 적혀 있다.** 공식이 이 실패를 이름으로 부르는 유일한 축이므로 한 문장으로 닫는
  값이 크다 — 다음 세대 모델이 §5 를 "매 단계 검증 패스"로 읽을 여지를 없앤다.

**고쳐 쓴 문장** (§5 마지막 줄)

```
Outside those two points, do not add a separate verification pass or hand work to another agent to
double-check what you can check yourself.
```

---

## 3. 공식 "담으라" 범주 대비 커버리지

세 목록을 합쳐 대조했다 — `docs-resident-criteria.md:29-37`(support) · `:355-363`(best-practices
✅/❌ 표) · `primary-anthropic-steering.md:46`(원문 표 CLAUDE.md 행).

| 공식 범주 | 제안 커버 | 판정 |
|---|---|---|
| Hard constraints | §6 (추상) | **부분** → F1 이 공식 예시 3범주를 넣어 닫는다 |
| Team norms | §5 리뷰 · §7 보고 | 커버 |
| Testing instructions and preferred test runners | §2 회귀 테스트만 | **미충족** → F8 |
| Common gotchas / 반복 교정 | 없음 | 구조적 미충족(아래) |
| Architectural decisions | §3 | 커버(원칙 형태로) |
| Commands · directory layout · env quirks · branch/PR 관례 · code style | 없음 | **구조적으로 못 담는다** — 낯선 저장소 사실이라 담으면 대부분의 설치에서 거짓이 된다(`docs-resident-criteria.md:47` aspirational rule). 이 범주는 설치본의 프로젝트 스캐폴드가 받는다 |

**"반복 교정을 담는 루프"만은 형태를 바꿔 담을 수 있다.** 근거는
`docs-resident-criteria.md:189-194`(> "Add to it when: Claude makes the same mistake a second time
…") 와 `docs-power-user-tips.md:23-26`(> "anytime Claude does something incorrectly, add it to
`CLAUDE.md`") 이고, 반대 방향은 `docs-resident-criteria.md:387-390`(> "**Ruthlessly prune.** If
Claude already does something correctly without the instruction, delete it or convert it to a
hook.")다. 다만 **이 앵커는 하네스가 소유해 update 가 덮어쓰므로 축적처가 될 수 없다** — 그래서
담을 문장은 "여기에 적어라"가 아니라 "**어디에 적어라**"여야 한다. 이 축은 다른 렌즈가 배선 사실을
갖고 다루는 편이 정확하므로 여기서는 **범주 미충족 사실만** 보고하고 문장은 내지 않는다.

---

## 4. 룰 vs 스킬 vs 훅 — 무엇을 내려야 하는가 (공식 5목록 기계 대조)

`primary-anthropic-steering.md:208-239` 의 다섯 안티패턴을 제안에 그대로 댔다.

| 공식 안티패턴 | 제안에서 해당하는 곳 | 판정 |
|---|---|---|
| `"Never do this"` → 훅·권한 | **§6 전체** | **해당** — 처방은 삭제가 아니라 **병행**. 원문이 못 박는다: *"A real guardrail needs to be deterministic, and the enforcement methods are hooks and permissions."* → **F1** |
| `"Every time X, always do Y"` → 훅 | §5 *"Run targeted checks first, then broaden according to risk"* | **비해당** — 조건부 판단이라 결정론적 훅으로 환원되지 않는다 |
| 30줄 절차 → 스킬 | §5 의 리뷰 운영 문장 2개 | **비해당** — 절차가 아니라 규범이고, 문장 2개는 "30-line procedure" 형태가 아니다. 다만 리뷰 절차가 더 자라면 그때는 스킬이다 |
| `paths` 없는 룰 → 스코프 | 앵커 자체 | **비해당** — 원칙은 전역이라 스코프 술어가 없다. (단 함께 나가는 배포 룰 7종 중 `paths:` 는 `cli-development.md` 1종뿐 — 실측 확인. 나머지 6종은 원문 기준 *"mechanically identical to putting the content in CLAUDE.md"*(`:234`)다. **이는 #287 범위 밖의 별건**) |
| 개인 취향 → user-level | 없음 | 비해당 |

**결론: 7원칙 중 "상주 지시문이 아닌 곳으로 내려야 한다"고 공식이 지목하는 것은 §6 하나뿐이고,
그 처방은 삭제가 아니라 훅·권한과의 병행이다.** 나머지 여섯은 판단 원칙이라 이 목록의 대상이
아니며, `primary-anthropic-prompting.md:304-306` 이 그 형태를 직접 지지한다:
> "**Prefer general instructions over prescriptive steps.** A prompt like \"think thoroughly\" often
> produces better reasoning than a hand-written step-by-step plan."

---

## 5. 이 렌즈가 **기각한** 반론 (공식 근거로)

정리해 두지 않으면 다음 리뷰에서 같은 잣대가 다시 올라온다.

| 반론 | 기각 사유 (공식) |
|---|---|
| "부정문이 많다" | 공식 근거 없음. 개선 예시가 `NEVER use ellipses` 를 **그대로 두고 이유만 붙인다**(`primary-anthropic-prompting.md:88-99`). 요구는 이유 또는 `Safe path:`이지 긍정형 전환이 아니다 |
| "모델이 이미 검증하니 §5 를 빼라" | 그 문장이 겨냥한 것은 **자기 일의 재확인**이고 §5 는 **만들지 않은 레인의 판정**이다. 실측: 제안에 `double-check\|re-verify\|verification step\|subagent` 0건 |
| "원칙 문서는 100줄을 넘으면 안 된다" | 100줄은 **목차의 분량**이다 — 그 파일에는 원칙이 애초에 안 들어 있고 *"a set of core beliefs"* 는 `docs/` 소속이다(`primary-openai-harness.md:66-89`). 장르가 달라 비교가 성립하지 않는다 |
| "강조어(`IMPORTANT`/`YOU MUST`)를 붙여 준수율을 올리자" | Anthropic 두 공식 문서가 반대 방향이고(`docs-resident-criteria.md:381-383` vs `primary-anthropic-prompting.md:113-116`), **모델 세대를 명시한 쪽이 "덜어내라"**다. 실측: 제안·현재본 모두 0건 — 현 상태를 유지한다 |
| "머지 게이트를 줄이자(OpenAI 사례)" | 저자 자신이 조건을 붙였다: *"This would be irresponsible in a low-throughput environment."*(`primary-openai-harness.md:206`) 배포 대상은 저처리량 저장소다 — 오인용이다 |

---

## 6. 이 문서가 검증하지 않은 것

- **제안 문장이 실제 모델 행동을 바꾸는가** — 측정하지 않았다. 공식이 요구하는 확인
  (`docs-resident-criteria.md:379` > "test changes by observing whether Claude's behavior actually
  shifts")은 이 작업 범위 밖이다.
- **위 재작성문을 넣은 전체 파일로 `npm run ci` 를 돌리지 않았다** — 리포 무수정 제약. 이 렌즈가
  실행한 것은 읽기 전용 grep 과 소스 확인뿐이다.
- **`https://agents.md` 공식 사이트** — `primary-openai-agents-md.md:37` 이 "더 알아보려면 여기"로
  가리키는 곳. 미수집. AGENTS.md 쪽 담으라/빼라 목록이 있다면 거기다.
- **원장 2건의 등급 한계** — `docs-resident-criteria.md` #1 과 `docs-power-user-tips.md` 는 WebFetch
  요약 추출본이라 전문 대조가 안 됐다(각 파일의 §증거 등급 주의). F5·§3 이 이 둘을 인용하는 대목은
  그 한계를 안고 있다. `.md` 접미사 재수집 시 바뀔 수 있다.

---
name: task-brief
description: >-
  Rewrite a task request into the canonical XML brief — objective, inputs, invariants,
  success_criteria, boundaries, autonomy, verification, communication, output_format — so the
  worker receives one judgeable definition of done instead of prose. Runs in two directions:
  INBOUND reshapes a sprawling or half-formed request (pasted requirements, a wall of background,
  a request that grew across several messages) into that shape, filling each field from context
  already on screen and deleting sections that do not apply; OUTBOUND writes the prompt that a
  spawned worker actually receives, so nobody hand-rolls a one-off prompt shape per delegation.
  Trigger on "브리프로 정리", "작업 지시서로 만들어", "프롬프트 구조화", "브리프 만들어줘",
  "이 요청 정리해줘", and in English "turn this into a task brief", "structure this prompt",
  "write the brief for this", "draft the spawn prompt". Fire unprompted the moment you are about
  to hand a multi-part task to a subagent, a workflow worker, or a parallel lane. Do NOT fire on a
  one-line question, a lookup, or an ordinary conversational exchange where you simply need one
  more piece of information — asking a clarifying question is not a brief, and wrapping a
  one-sentence ask in nine XML tags costs more than it buys.
---

# Task Brief

A single shape for "here is the task". The point is not tidiness — it is that every field is a
place where an unstated assumption would otherwise stay unstated. A worker that receives prose
guesses what done means; a worker that receives this brief can be judged against it.

Use it in both directions. **Inbound**, an arriving request gets normalized into the shape before
you act on it. **Outbound**, a delegation prompt *is* this shape — you do not write a different
prompt format per worker.

## The template

Copy this shape. Fill what applies, delete what does not — an empty section left in place reads
as a field that was considered and found empty, which is a claim you did not make.

```xml
<objective>
  [최종적으로 만들어야 할 의사결정 가능 상태 — 무엇을, 왜]
  [가능하면 한 문장 판정 기준. 예: "이 화면을 보고 실제 주문을 낼 수 있는가"]
</objective>

<inputs>
  [파일은 @경로로 직접 지정, 에러/로그는 요약 없이 원문]
  [기존 자산을 승계할 경우: 무엇을 참고하고, 어떤 개념·인터페이스를
   재정의하지 않고 그대로 쓰는지 명시]
</inputs>

<invariants>
  [정답의 기준. 구현 방법이 아니라 결과값의 정의이므로 autonomy가 침범 불가.
   계산 규칙·법규·도메인 제약 등. 바뀔 수 있는 값(세율 등)은 파라미터로 다루라고 명시.
   해당 없으면 섹션 삭제 — 빈 섹션을 남기지 않는다]
</invariants>

<success_criteria>
  [명령어·외부 관찰로 검증 가능한 완료 조건. 체크리스트 형태 권장.
   항목 간 수치·개수 표현은 실제와 대조 확인 — 모델이 문자 그대로 대조한다]
</success_criteria>

<boundaries>
  - Scope:
  - Non-scope: [필요해 보여도 만들지 않는 것. 배출구를 함께 지정:
    "대신 인계 문서의 후속 제안에 한 줄로 남긴다"]
  - Guardrails: [이 태스크 한정 제약. 프로젝트 불변 규칙은 CLAUDE.md,
    결과값 정의는 invariants로]
  - Resource limit: [서브에이전트 상한, 시간·토큰 캡 등 결정적 상한]
  - Stop conditions: [실패로 간주하고 중단·보고할 조건]
</boundaries>

<autonomy>
  방법은 자율 결정. 루틴한 판단은 스스로 한다.
  [실행 모드에 따라 하나 선택]
  - 대화형: 해석에 따라 결과물이 실질적으로 달라지는 경우에만 확인 질문한다.
  - 무인형: 멈추지 않는다. 모호하면 기본값으로 진행하고,
    그 가정과 택한 기본값을 인계 문서에 모아 보고한다.
  더 나은 접근이 보이면 한 문장으로 언급하고 요청대로 진행한다.
</autonomy>

<recommended_direction>
  [권장 접근법 — 참고사항. 없으면 섹션 삭제]
</recommended_direction>

<verification>
  [검증 주체에 따라 하나 선택]
  - 자체 완결형: 별도 지시 없음. 검증 단계를 명시하지 않는다(모델 기본 동작에 맡김).
    단, success_criteria의 검증 명령이 있으면 그것으로 done을 판정한다.
  - 리뷰어 위임형: 테스트 작성·정합성 검증은 리뷰어 몫.
    스스로를 통과시키는 검증 루프에 시간을 쓰지 말고, 동작 확인 수준의
    스모크만 한 뒤 리뷰어가 판정 가능한 상태로 넘긴다.
    인계 문서 [N줄] 이내: 임의로 정한 가정과 기본값 / 정답이 갈릴 수 있는 지점 /
    파라미터 위치 / 미심쩍은 부분 전부(심각도로 거르지 않는다, 판단은 리뷰어) /
    재현 시나리오(기대값은 적지 않는다).
    검증만 위임한 것이지 완성을 위임한 것이 아니다. 스텁·목 데이터를 남기지 않는다.
</verification>

<communication>
  단계 시작에 한두 문장, 완료에 [N]줄 이내. 도구 호출마다 예고하지 않는다.
  최종 보고는 [N]줄 이내.
</communication>

<output_format>
  [최종 결과 형식]
  분량은 과제에 필요한 만큼만. 필러 섹션·중복 요약·보일러플레이트 금지.
</output_format>
```

## Inbound — normalize the request before acting on it

A request arrives as prose, a paste, or an ask that grew across three messages. Reshape it first,
then work from the reshaped version.

1. **Read the whole request before writing any field.** The objective is usually stated last.
2. **Fill fields from context you already have** — open files, the error text on screen, the
   branch you are on, what the previous turn established. A field you can answer from context is
   not an open question, and asking about it spends a round trip on something you knew.
3. **Delete sections that do not apply.** No `invariants` for a docs edit; no
   `recommended_direction` when you have no preference. The template's own rule.
4. **Ask only when interpretation changes the result.** The `<autonomy>` section already states
   the questioning policy — 대화형 asks when the answer materially changes the artifact, 무인형
   does not ask at all and reports the assumption instead. Choosing the mode *is* choosing the
   question policy; do not add a second one on top.
5. **Do not invent scope.** Normalizing means giving structure to what was asked, not enlarging
   it. If a field is genuinely empty and nothing in context fills it, leave it out and say so.
6. **Show the brief before executing on anything expensive** — a long autonomous run, a fan-out,
   or an irreversible step. The brief is the cheapest place to catch a misread of the request.

The result is not a document to keep. It is the working definition of the task for this turn: the
thing you check the finished work against.

## Outbound — a delegation prompt is a brief

Every prompt handed to a subagent, a workflow worker, or a parallel lane uses this same shape.
One shape means a worker never has to infer where the boundaries are stated, and it means a
delegation missing a field is visibly missing it.

Where the `model-orchestration` skill is installed, its delegation-prompt spec is the routing-side
authority (which model, which effort floor, who verifies). This template **carries** that spec
rather than competing with it — the mapping is one-to-one:

| Delegation element | Brief field |
|---|---|
| Objective + why it matters | `<objective>` (with the one-sentence pass/fail test) |
| Output format — the final message *is* the deliverable | `<output_format>` + `<communication>` |
| Tool/source guidance — where to look, what to trust | `<inputs>` (+ `<recommended_direction>`) |
| Boundaries — what not to touch, where the task ends | `<boundaries>` Scope / Non-scope / Guardrails |
| Acceptance criteria — how the worker knows it is done | `<success_criteria>` |
| Worker-count and cost caps | `<boundaries>` **Resource limit** — model, effort, agent count, time/token cap |
| Who judges the result | `<verification>` — 리뷰어 위임형 when a separate lane will verify |

Two of those rows are the ones people drop, so state them explicitly:

- **Resource limit is where model and effort live.** "One agent, opus, effort floor xhigh, no
  further fan-out" belongs here as a hard cap, not as an aside in prose. A cap that is not in the
  brief is not a cap. Where `model-orchestration` is installed, take the floors from it; where it
  is not, still name the model and effort you intend, because a worker that inherits an unstated
  level runs at whatever the session happened to be set to.
- **리뷰어 위임형 is the lane split, written down.** Choosing it tells the worker that a different
  lane writes the tests and issues the verdict, so it must not spend the run self-certifying —
  and that it owes a handoff note listing its assumptions, the points where the right answer could
  diverge, and everything it found doubtful without filtering by severity. Choosing 자체 완결형
  says the opposite: no separate judge is coming, so `success_criteria` is the whole gate.
  Pick one deliberately. Leaving both in place hands the worker a contradiction.

If the delegation's deliverable is long, `<output_format>` names the **file path** the worker
writes to, and the final message carries only that path plus a short summary — a long final
message gets truncated in transport and what was cut is unrecoverable.

## Field notes

**objective** — one sentence, then the pass/fail test. "Refactor the import pipeline" is a topic;
"a re-run of the import produces the same row count as the source export" is an objective. If you
cannot write the test, the task is not yet defined enough to delegate.

**inputs** — point at files by path rather than summarizing them, and paste errors and logs
verbatim. A summarized error has already had the diagnostic detail removed by someone who did not
yet know what mattered. When the task continues existing work, say what is inherited and must not
be redefined — otherwise the worker redesigns an interface that was already settled.

**invariants vs Guardrails** — the distinction that gets collapsed most often, and collapsing it
is what lets an autonomous run produce a confidently wrong result:

| | `<invariants>` | `<boundaries>` Guardrails |
|---|---|---|
| Says | what makes the output *correct* | what the worker may not *do* |
| Example | rounding rule, unit, legal/domain constraint | "do not touch the migration files" |
| Autonomy | cannot override it — it defines the answer | can choose freely inside it |
| If violated | the result is wrong | the process was out of bounds |

Values that can legitimately change (a rate, a threshold, a fee) go in as parameters with the rule
that governs them, not as literals — a literal becomes a hardcoded constant the moment someone
implements it. Project-wide standing rules do not belong in either field; they live in the
project's own instruction file and apply without being restated.

**autonomy mode** — 대화형 when a human is present and a misread is cheap to correct in the moment;
무인형 when nobody is watching, where stopping to ask means the run stalls instead of finishing.
The failure mode of picking wrong is asymmetric: a 무인형 worker with a human watching wastes a
question that would have taken seconds, while a 대화형 worker running unattended blocks on a
question nobody will answer.

**success_criteria** — prefer conditions someone else can check by running something or looking at
something. Counts and numbers inside the criteria get compared literally, so verify them against
reality before writing them; a criterion that says "all 12 cases pass" when there are 11 cases
makes the worker either invent a case or report failure.

**verification / communication** — the `[N줄]` caps are meant to be replaced with a real number.
Leaving the placeholder in tells the worker nothing, and an uncapped handoff drifts into a report
longer than the work.

## Anti-patterns

| Anti-pattern | Why it hurts |
|---|---|
| Wrapping a one-line ask in the full template | Nine tags around "what does this function do" is pure overhead — the skill's own Do-NOT |
| Leaving empty sections in place | An empty field reads as a considered-and-none answer; deletion is the honest form |
| Putting the correctness rule in Guardrails | Guardrails are process limits and autonomy may work around them; the definition of the right answer must not be workaroundable |
| Success criteria that only the author can check | "Looks right" is not a criterion — the verifying lane cannot run it |
| Both autonomy modes, or both verification modes, left in | A contradiction the worker resolves silently, in whichever direction is cheaper for it |
| Resource limit omitted "because it is obvious" | Nothing about model, effort, or fan-out is inherited the way you assume; unstated means default |
| Restating standing project rules inside every brief | They already apply; repeating them buries the task-specific constraints in boilerplate |
| Normalizing a request by expanding its scope | The brief is a shape for what was asked, not a place to add what you would prefer to build |

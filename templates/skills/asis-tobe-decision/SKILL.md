---
name: asis-tobe-decision
description: >-
  Present a decision or confirmation request in the user's four-part format:
  전후맥락 (context) → 추천 + 이유 (recommendation) → UI/UX 형태 (a scannable
  table/option-list) → ASIS→TOBE contrast, led by the recommendation so the user
  can say yes fast. Fire at genuine A-or-B / approval / explicit-ASIS-TOBE moments.
  Triggers on the user's verbatim phrases "ASIS TOBE로 설명", "ASIS-TOBE로 알려줘",
  "화면으로 ASIS TOBE로 설명", "의사결정 / 컨펌 요청", "이거 진행할까요?", and the
  softer "다음 진행할 것들 알려줘"; English equivalents: "present this as ASIS/TOBE",
  "give me the as-is to-be", "should I do A or B", "ask for my approval", "lay out
  the options". Do NOT fire for pure information with no decision, or trivial
  reversible actions you would just do.
---

# ASIS→TOBE Decision Presentation

A presentation **format**, not a heavy process. It fires at the moment you would
otherwise ask "should I do this?" or "A or B?" and turns that question into a
one-screen artifact the user can approve, question, or push back on in a single
pass.

This codifies the user's standing rule in `.claude/CLAUDE.md`:

> **의사결정 및 컨펌 요청 시**
> 1. 이해가 쉽도록 전후 맥락과 함께 상세하게 설명
> 2. 추천하는 제안과 그 이유를 설명
> 3. UI/UX 형태로 이해할 수 있도록 설명
> 4. ASIS TOBE 형태로 설명

The rule exists but does not reliably self-trigger — the user has had to demand it
mid-task ("구체적으로 화면으로 ASIS TOBE로 설명", "다음 진행할 것들 ASIS-TOBE로
알려줘"). This skill makes it an **active default** so the user never has to ask.

## When to use

Fire whenever you are about to:

- ask for approval before doing something ("이거 이렇게 진행할까요?")
- offer the user a choice between two or more approaches
- propose a change to architecture, config, scope, or plan
- recommend one option over others

Softer/secondary trigger: reporting "next steps" the user must sign off on ("다음
진행할 것들"). Use judgment — render it in this format when a real yes/no is needed.

Do **not** fire for pure information with no decision in it, or for trivial
reversible actions you'd just do. This is for moments where a human "yes / no /
which one" is genuinely needed.

## The four slots (= the four CLAUDE.md items)

The four slots map 1:1 to the user's rule. Cover all four, but **lead with the
recommendation** — readers decide off the conclusion, so put it up top even though
it is item 2 in the list. Everything after it is there to justify and let the user
react to one specific cell.

```
추천 + 이유   (item 2)  ← lead here: the recommendation and the explicit ask
전후맥락       (item 1)  ← context: the forces that make this decision necessary now
UI/UX 형태     (item 3)  ← one scannable table / option-list, never prose
ASIS→TOBE     (item 4)  ← current → proposed contrast, gap made concrete
```

### 추천 + 이유 (item 2) — lead with this

State the recommendation as a **concrete commitment in active voice**: "I'll switch
X to Y" — not "we could consider maybe looking at Y." Hedged language signals low
confidence and pushes the user back into doing the analysis themselves. Give the
short **why** (a line or two), then the **explicit ask**: "Approve A, or pick B?" A
proposal with no actual ask leaves the loop open and guarantees another round.

### 전후맥락 (item 1) — context

The **forces at play** in plain language — the technical, product, or constraint
pressure that makes this decision necessary now. Keep it to what the user needs to
judge the call; without it a reader either blindly accepts or blindly rejects.

### UI/UX 형태 (item 3) — show it, don't narrate it

Render the choice as **one scannable table or option list, never a wall of prose** —
this is the "UI/UX 형태로 이해할 수 있도록" item. Aligned columns the user can scan
vertically; pre-answer the obvious objection inline ("왜 B가 아닌가") so they don't
have to ask. When it's "which of these?", an option-comparison table fits; when it's
"move from current to proposed?", use the ASIS→TOBE shape below.

### ASIS→TOBE (item 4) — make the gap concrete

Columns: *항목 / ASIS (현재) / TOBE (제안) / Gap*. **Quantify the gap** with a metric
or cost — an unquantified gap ("느림 → 빨라짐") is rhetoric, not a basis for
deciding. List trade-offs honestly, including the downside of the recommended
option; hidden downsides surface later as distrust (a `no-false-ship` violation).
You can close with a one-line tail of what happens on approval ("승인 시 → …") — keep
it to the ask, not a separate required slot.

## Worked example

**Input** (what you're tempted to send): *"The compat checker re-validates every
asset on each run and it's gotten slow. I could cache results. Want me to?"*

**Output** (the format):

> **추천 + 이유:** `gen-compatibility` 의 검증 결과를 콘텐츠 해시 기준으로 캐싱하도록
> 바꾸겠습니다 — 변경분만 재검증해 시간을 가장 크게 줄이고 CI 코어 변동에도 안정적이라.
> **승인해 주세요 — 아니면 B(캐시 없이 병렬화만)도 가능합니다.**
>
> **전후맥락:** 자산이 52개로 늘면서 매 실행마다 전 자산 재검증 → CI `gen-compat`
> 스텝이 느려짐. 자산 내용은 거의 안 바뀌는데 매번 풀 재검증하는 게 병목.
>
> | 항목 | ASIS (현재) | TOBE (제안: 해시 캐싱) | Gap |
> |------|-------------|------------------------|-----|
> | 전체 검증 시간 | ~140s (52자산 전수) | ~12s (변경분만) | **-128s / 실행** |
> | 캐시 미스 시 | — | 풀 재검증 폴백 | 정확성 손실 0 |
> | 추가 코드 | 없음 | 캐시 read/write + 무효화 (~40줄) | 유지보수 +α |
> | 트레이드오프 | — | 해시 충돌 시 stale 위험 | 무효화 키 = 파일내용 해시로 차단 |
>
> *왜 B(병렬화만)가 아닌가:* 병렬화는 시간을 ~3배만 줄이고(약 45s) 코어 수에 의존 —
> 캐싱이 변경분만 검증해 더 크게(11배) 줄이고 CI 코어 변동에도 안정적이라 A 추천.
>
> 승인 시 → feature 브랜치에서 캐시 레이어 + 무효화 테스트 추가 → 로컬 `npm run ci`
> 통과 → PR.

Notice: the user can say "go" after the first two lines, or push back on exactly one
cell of the table. No essay, no buried recommendation, no hidden downside.

## Common failure modes to avoid

- **Hedged recommendation** ("고려해볼 수 있습니다") — forces the user to do the
  analysis. State a commitment.
- **Recommendation buried under option analysis** — lead with the lead option.
- **Context but no ask** — leaves the loop open. Always end the 추천 with the ask.
- **Prose instead of a table** — skips the "UI/UX 형태" item. Show it scannable.
- **Unquantified ASIS→TOBE gap** — rhetoric, not a decision basis. Attach a
  metric or cost.
- **Suppressed downsides** to make the proposal look cleaner — surfaces later as
  distrust (and a `no-false-ship` violation). List trade-offs.

## 왜 통하나 (근거, 선택적)

Light support if you want to defend the format — not part of the body:

- **Lead with the recommendation**: BLUF (Bottom Line Up Front) — readers decide off
  the conclusion, so the ask goes first even though it's item 2.
- **Keep supporting reasons few (~3), one scannable table**: executive-decision-slide
  and working-memory (~7±2) guidance — more dilutes and pushes the reader back into
  analysis-mode.
- **Quantify the gap, list all consequences**: As-Is/To-Be gap analysis + ADR
  (Nygard) — an unquantified or one-sided gap isn't a basis for deciding.
- **Pre-answer the objection inline**: Amazon Working Backwards PR/FAQ — collapses
  the back-and-forth into one round.
- **Contested call? score on explicit criteria**: RICE (Intercom) — a small scoring
  table is more defensible than prose advocacy.

## Related skills

A cross-cutting **presentation discipline**, not a workflow. Sibling skills that
produce findings or choices should render them in this format:

- `gap-analysis-e2e` — its gap output maps directly onto the ASIS→TOBE table.
- `ultracode-service-audit` — present audit findings and remediation choices as
  ASIS→TOBE.

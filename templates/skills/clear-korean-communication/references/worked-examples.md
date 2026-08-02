# Worked examples

Two complete walkthroughs. The first repairs a failing *explanation* (Part 1);
the second renders a *decision* (Part 2). Read the one that matches the message
you are about to send.

---

## 1. Explain — a failing draft, diagnosed and repaired

**Input** (the failing draft): *"`update-mode.ts:53-78` の targets array lists
rules/agents/commands/hooks. `skills` is absent, and `install-render.ts:431`
iterates `updated`, so no row renders."*

Every clause is true, and it does not land.

**Diagnosis, in the order of Steps 1–4**

| Step | Question | Verdict on this draft |
|---|---|---|
| 1 | Does a name point at two things? | Yes — `.claude/` means *this repo* and *the installed project*. The writer holds both; the reader cannot tell which is broken. |
| 2 | Does it lead with who + what changes? | No — it opens with a coordinate (`update-mode.ts:53-78`). |
| 3 | Is the evidence before or after the claim? | Before. There is no claim yet. |
| 4 | What did the reader actually ask? | *"is this about installing, or about the project directory?"* → symptom row 1 = referent collision. |

**Output** (after the diagnostic):

> There are two `.claude/` directories, and I mixed them:
>
> ```
> ① this repo (we build here)    ② someone's project (installed here)
>    templates/skills/  ──npm──▶    .claude/skills/
> ```
>
> **The problem, in one sentence:** in ②, skills installed once never change
> again, no matter how many times the user runs update.
>
> Update refreshes rules, agents, commands, and hooks — but skills were left out
> of that list, and the summary screen only prints directories that were
> touched. So nothing on screen said anything was skipped.
>
> Evidence: `update-mode.ts:53-78` (the target list), `install-render.ts:431`
> (the render loop).

Same facts, same precision, three lines to comprehension. Note what did **not**
change: no softer tone, no shorter sentences, no "user perspective" rewrite. The
repair was separating one name into two named things and putting the claim first.

---

## 2. Decide — the four slots with a quantified gap

**Input** (what you're tempted to send): *"The compat checker re-validates every
asset on each run and it's gotten slow. I could cache results. Want me to?"*

That is a decision hidden inside a status update. The reader has to reconstruct
the options, the cost, and the ask.

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

Notice: the user can say "go" after the first two lines, or push back on exactly
one cell of the table. No essay, no buried recommendation, no hidden downside —
the stale-cache risk is in the table, not omitted to make the proposal look
cleaner.

**The numbers are the point.** "느려짐 → 빨라짐" would have carried the same
argument with none of the basis for deciding: ~140s → ~12s, -128s per run, 11×,
and the rejected alternative's own number (~45s) are what let the reader judge
the trade instead of trusting the recommender.

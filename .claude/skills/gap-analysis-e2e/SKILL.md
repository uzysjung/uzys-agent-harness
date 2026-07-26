---
name: gap-analysis-e2e
description: >-
  Two-mode chained gap analysis. DETECT scans the current service end-to-end
  through three lenses — north-star alignment, correctness (bugs), and
  user-perspective (UX) — and enumerates concrete, severity-ranked gaps. Then
  BENCHMARK researches how reference/benchmark services actually solved each
  high-ranked gap and PROPOSES a closing approach. Use when the user says any of:
  "북극성 기준으로 부족한 점", "사용자 관점에서 부족한 점", "다른 벤치마크 서비스는 이 부분을
  어떻게 해결했는지", "갭분석", "레퍼런스 서비스랑 비교해서 부족한 점 찾아줘" — or the
  English equivalents: "gap analysis", "what are we missing vs the
  ideal/north-star", "benchmark against reference services". Fires for both
  Korean and English phrasing. NOT for a whole-codebase multi-dimension audit
  (use ultracode-service-audit) or single-artifact prose review (use
  multi-persona-review) — this is the narrower gap-vs-benchmark loop.
---

# Gap Analysis E2E (reverse + competitive)

A targeted loop, not a sweep. You take the service as it is today, find where it
falls short of the ideal **and** where it is simply broken or awkward, then for
each real shortfall you go look at how a benchmark service solved that exact
problem before proposing a fix. The user's own framing:

> "현재 서비스 개발 상태에서 북극성 기준으로 부족하거나, 버그가 있거나, 사용자 관점에서 부족한 점을
> 인지하면 다른 벤치마크 서비스는 이부분을 어떻게 해결했는지를 확인해 가는 거지."

So the work fuses two moves that are usually done separately: **reverse-gap**
(distance from the north-star / ideal) and **competitive benchmark resolution**
(how others closed the same gap). DETECT finds gaps; BENCHMARK closes them. They
chain: detect → for each gap, benchmark → propose fix.

## When to use

- You have a working-ish service and want to know, concretely, where it's behind
  its own north star, where it has bugs, and where the UX disappoints.
- You've found a weak spot and want "다른 유사 깃허브 프로젝트 / 레퍼런스 SaaS 는 이걸
  어떻게 했지?" before inventing a fix.
- You want a ranked, auditable list of gap → benchmark evidence → proposed close,
  not a vague "we could improve X."

Not for: directing the roadmap forward (that's `northstar-roadmap` — it DIRECTS;
this DETECTS gaps against the same north star). Not a full N-dimension audit
(that's `ultracode-service-audit`; this is a narrower gap-to-benchmark loop).

---

## MODE 1 — DETECT

Run three **independent** passes, then consolidate. The usability and gap-analysis
literature is unanimous that one undifferentiated pass systematically under-finds:
heuristic evaluation works precisely because several evaluators inspect separately
and you aggregate (Nielsen & Molich). Blend the lenses into one sweep and you
will miss large categories of gap. So scan each lens on its own terms, then merge.

A gap is only valid if it is a **concrete delta between two describable states** —
the observable current state and a specific ideal state. "It feels unpolished" is
an opinion; "the onboarding has no empty-state for zero projects, the ideal is a
guided first-run" is a gap. (Gap Analysis: Current → Future State.)

### Lens A — North-star alignment (the reverse / planning lens)

For the ideal state, use a **Working-Backwards** artifact: write (or read, if it
exists in `docs/NORTH_STAR.md`) the one-paragraph press release of the finished,
ideal product, then reason backward. The gap is the distance between today's
product and that press release (Amazon PR-FAQ). Then make it testable with the
**North Star Framework**: is each surface tied to a north-star *input* metric? Two
gap shapes fall out automatically:

- an input lever that should move the north star but doesn't, and
- product surface area that contributes to **no** input (candidate for removal).

Where this repo's north star lives: `docs/NORTH_STAR.md` and `CLAUDE.md`
("설치 서비스 = installer + curator"). Judge surfaces against *that*, not taste.

No `docs/NORTH_STAR.md`? Don't skip Lens A — write the one-paragraph
Working-Backwards press release *inline* from the README / `CLAUDE.md` vision
first, then score against it. The ideal state is the anchor; an absent file is no
excuse to drop the planning lens.

### Lens B — Correctness (the bug lens)

Inspect for things that are simply wrong: broken flows, crashes, mismatched
advertised-vs-actual behavior, drift between docs and code. In this repo the
`no-false-ship` rule names the exact failure family — a `--with-*` flag that's
advertised but unregistered, a `--version` that lies, a category missing from the
wizard. Treat each as a correctness gap with a reproduction, not a hunch.

### Lens C — User-perspective (the UX lens)

Judge the interface against **named criteria**, not vibes — Nielsen's 10
heuristics (visibility of system status, match to the real world, error
prevention, recognition over recall, etc.) so each finding traces to a principle
and is reproducible. For the heavy UX pass, hand this lens to the
**`multi-persona-review`** skill (independent persona evaluators) rather than
duplicating its machinery here. Remember the limits: heuristic inspection finds
roughly half of what real user testing finds and produces false positives — it's
a cheap first filter, not ground truth.

### Score every gap before you spend benchmark effort

Never present an unranked gap list — the benchmark research in Mode 2 is the
expensive part, so it must run only on gaps that matter. Tag each gap with:

- **Severity 0–4** (Nielsen): roughly frequency × impact × persistence. 0 = not
  really a problem, 4 = catastrophe, must fix before release.
- **Opportunity (optional, ODI)**: `Importance + max(Importance − Satisfaction, 0)`
  (importance weighted twice; Ulwick). High-importance/low-satisfaction =
  under-served, prime target. Low-importance/high-satisfaction = **over-served** —
  flag it for *removal/simplification*, not addition. Surfacing over-served areas
  is the structural antidote to feature bloat; a good scan proposes cuts too.

DETECT is fully usable on **severity 0–4 alone**. ODI needs real importance and
satisfaction data; for a solo/tooling repo without it, *skip* the Opp. column
rather than inventing importance/satisfaction numbers — fabricated inputs launder a
guess as data. Reach for ODI only when you genuinely have user-sourced signal.

Keep the numbers as a prioritization aid, not proof — self-reported importance and
made-up severity launder a guess as data if you over-trust them.

**DETECT output** — one table:

| # | Lens | Gap (current → ideal delta) | Severity 0–4 | Opp. | Notes / repro |
|---|------|------------------------------|--------------|------|---------------|

Scale the rigor to severity: a 4 earns the full reverse-from-ideal write-up; a 1
gets a one-line pre-flight note. Don't run the heavy PR-FAQ ritual on every tiny
gap — that's analysis paralysis.

---

## MODE 2 — BENCHMARK (runs only on high-ranked gaps)

For each gap worth closing, work like a **competitive teardown**: take apart how a
reference service *actually* solves that exact problem and document the **verified
mechanism** — the real flow, states, and copy you observed — not the assumed
implementation. This mirrors `no-false-ship`: claim only what you inspected. If you
couldn't verify how they do it, **say so** ("could not inspect — inferred") rather
than fabricating a plausible-sounding mechanism. Fictional evidence is the named
failure mode of both Working-Backwards and this skill.

Sources, in order of trust: the running reference product / its repo (first-hand),
then docs, then write-ups. For "다른 유사 깃허브 프로젝트 보고 수정", read their actual
code path, not their README claims.

Then **PROPOSE** the closing approach in **jobs-to-be-done** terms — what job does
the user need done — and consciously resist the **feature-parity trap**. Copying a
competitor's feature list is a catch-up trap that breeds bloat (Zune out-featured
the iPod and lost; customers wanted the job done, not the features). For each gap,
decide explicitly: does closing it defend table-stakes, or does a *differentiated*
approach make the competitor's solution irrelevant? Propose accordingly.

Record each proposed fix **ADR-style** — rationale + the rejected benchmark
alternative — so the whole chain is auditable. (This repo already has an
`architecture-decision-record` convention and `docs/decisions/`.)

**BENCHMARK output** — per high-ranked gap:

```
Gap #N (sev X): <one line>
  Benchmark:   <service> — VERIFIED how they solve it: <real flow/state/copy>
               [or: COULD NOT INSPECT — inferred, treat as hypothesis]
  Job:         <the customer job this gap blocks>
  Proposed:    <closing approach in JTBD terms — differentiate, don't mirror>
  Rejected:    <the benchmark's exact approach, and why not, if diverging>
```

---

## The chain, in order

1. **Define states.** Current (observable) + ideal (Working-Backwards press
   release, anchored to `docs/NORTH_STAR.md`). A gap is the delta between them.
2. **DETECT** — three independent passes (north-star / correctness / UX via
   `multi-persona-review`), each against named criteria.
3. **Consolidate & score** — merge into one table; severity 0–4 + optional ODI
   opportunity; tag over-served items for removal.
4. **BENCHMARK** — only the high-ranked gaps; verified teardown of how a reference
   service solves each; mark anything unverified.
5. **PROPOSE** — closing approach in JTBD terms, differentiate over parity-match,
   recorded ADR-style with the rejected alternative.

---

## 갭을 파일로 추적할 때 — `gap.md` (benchmark-parity 루프)

위 DETECT 표는 **대화 안의 탐지 결과**다. 갭을 여러 PR 에 걸쳐 닫아야 하면 파일로 승격한다:
`docs/research/<area>_audit_<sprint>/gap.md`. `benchmark-parity` 룰이 이 파일에 **머지 차단
게이트**를 걸고, 여기가 그 파일의 **형식과 절차**를 소유한다.

**두 척도를 섞지 않는다.** DETECT 의 severity 0–4(Nielsen)는 "비싼 benchmark 리서치를 어디에
쓸까"를 고르는 랭킹이고, `gap.md` 의 CRITICAL~LOW 는 "이걸 두고 머지해도 되나"를 가르는 판정이다.
서로 다른 질문에 답하므로 변환표를 만들지 말고, 파일로 옮기는 시점에 **판정 기준으로 다시 매긴다**.

```markdown
| ID | 항목 | Severity | 근본원인 | 증거 | 수정안 | 상태 |
|----|------|----------|----------|------|--------|------|
| X-1 | <사용자가 겪는 증상> | CRITICAL | <코드 수준 원인> | file.ts:12 + capture.png | <구체 수정안> | [ ] |
| X-2 | ... | HIGH | ... | ... | ... | [x] #123 |
```

- **Severity**: CRITICAL(핵심 기능 자체가 불성립) · HIGH(핵심 기능이 사용자 관점 미완) ·
  MEDIUM(동작하나 벤치마크와 상이) · LOW(polish).
- **근본원인은 코드 수준까지** — "안 됨"이 아니라 어느 파일의 어느 경로가 왜 끊겼는지.
- 선택 확장 열: Effort(S/M/L) · 구분(내부 버그 vs 벤치마크 divergence).
- fix PR 머지 시 해당 행을 `[x] #PR번호` 로 닫는다 — `doc-governance` 의 "작업 완료 처리"와 같은 의무.

**루프**: NORTH_STAR 로 "무엇이 핵심인지" 판정 기준을 먼저 세운다 → 벤치마크와 자체 구현의 같은
영역을 capture → `gap.md` 작성 → **사용자 관점 end-to-end** 로 완결성 검토 → fix → 행 닫기.
완료된 audit 산출물은 `docs/archive/` 로 격리한다.

### Dogfood pass — 기준선이 자기 배포본인 경우

남과 비교하는 대신 **배포된 자기 서비스를 사용자처럼 끝까지 써본다.** 산출물은 위 표 그대로다
(새 스키마를 만들지 않는다).

- **대상은 배포본**(로컬 dev 아님). 로그인 상태로 전 메뉴를 실제로 눌러본다.
- **범위를 먼저 적는다** — "전체 / 주요 메뉴 N개". 범위 미기재 보고는 커버리지를 부풀린다.
- **심각도 롤업**을 머리에 둔다: `CRITICAL n · HIGH n · MEDIUM n · LOW n · 합계 n`. 개별 행만
  나열하면 "얼마나 나쁜가"가 안 보인다.
- **재현 아티팩트 필수** — 이슈마다 스크린샷/영상 경로.
- **통과 기준은 CRITICAL 0.** HIGH 는 사유를 적고 사용자 판단으로 넘긴다.

### PR 에 붙이는 형식

```markdown
## Fidelity (benchmark parity)
- Benchmark: <벤치마크명> (dogfood 발 PR 이면 `dogfood — 자기 배포본`)
- Capture: docs/research/<area>_audit_<sprint>/<file>.png
- 갭 매트릭스: docs/research/<area>_audit_<sprint>/gap.md §X
```

### 자율 루프에 태울 때 (기계검증 프록시만)

`/loop` 등으로 자율 반복시키려면 완료조건에 **기계적으로 확인 가능한 것만** 쓴다 — `gap.md` 의
CRITICAL/HIGH 체크박스 전부 `[x]` + fix PR 번호, 그리고 typecheck/test/lint exit 0. "시각적으로
동등" 같은 주관 판정은 완료조건이 될 수 없다. 재capture 해서 `gap.md` 에 남기고 사용자가 최종
확인한다. 매 턴 capture/test 결과를 대화에 남긴다 — 안 남기면 루프가 자기 진척을 판정할 수 없다.

---

## Worked example (Input → Output)

**Input:** "이 설치 서비스 갭분석 해줘 — 북극성 대비 부족한 점이랑 버그랑 UX, 그리고 다른
벤치마크는 어떻게 했는지."

**DETECT (consolidated, abridged):**

| # | Lens | Gap (current → ideal) | Sev | Opp | Notes |
|---|------|------------------------|-----|-----|-------|
| 1 | North-star | Wizard lists assets but never explains *why* each is vetted; north star is "이해하고 선택", so an unexplained list under-serves the core job | 3 | 14 | no provenance/★ shown at select time |
| 2 | Correctness | `--with-foo` advertised in README but crashes (flag unregistered) | 4 | — | repro: `install --with-foo` → CAC throw |
| 3 | UX | First run gives no "what happens next" status (Nielsen: visibility of system status) | 3 | 11 | via multi-persona-review |
| 4 | North-star (over-served) | Three near-duplicate verbose `--help` walls; low importance, high satisfaction | 1 | 2 | candidate for **removal** |

**BENCHMARK (gap #1, high-ranked):**

```
Gap #1 (sev 3): wizard shows assets with no "why vetted" at decision time
  Benchmark:   VS Code Marketplace — VERIFIED: each extension card shows
               install count + verified-publisher badge + star rating inline
               in the pick list, so the trust signal sits at the moment of choice.
  Job:         "I need to trust this asset enough to install it, right here."
  Proposed:    Inline a one-line provenance (source repo + ★ + 'vetted: <date>')
               on each wizard row — surface the trust signal at decision time.
               Differentiator: we curate, so add a one-line *curator reason*,
               which a raw marketplace can't.
  Rejected:    Marketplace's full detail-page-per-extension — too heavy for a
               terminal wizard; defers the decision instead of supporting it.
```

The gap #1 proposal lands as an ADR — e.g. `docs/decisions/ADR-0NN-wizard-provenance.md`
recording the inline-provenance decision and the rejected full-detail-page
alternative — so step 5's "record ADR-style" is concrete, not just advice.

Gap #2 (correctness, sev 4) skips benchmarking — it's a bug, fix directly and add
the drift guard `no-false-ship` requires. Gap #4 proposes deletion, not a
benchmark. That selective routing is the point: spend research only where it pays.

---

## Cross-references (don't duplicate)

- **`multi-persona-review`** — owns the UX lens (Lens C). Invoke it; don't
  re-implement persona evaluation here.
- **`northstar-roadmap`** — same north star, opposite direction: it *directs* the
  roadmap forward; this *detects* gaps against it.
- **`ultracode-service-audit`** — the full N-dimension sweep. This skill is the
  narrower, faster gap → benchmark loop when you don't need the whole audit.
- **`architecture-decision-record`** — record each proposed fix as an ADR.

## Notes on rigor (where deeper detail would live)

If a future version needs the full scoring rubrics (the complete Nielsen 10-item
checklist text, the ODI questionnaire wording) or per-domain benchmark source
lists, the option is to summarize here and split the long-form into a sibling
`reference.md` — no such file exists yet, and this SKILL.md is self-sufficient
without it. Keep SKILL.md the practical map, not the encyclopedia.

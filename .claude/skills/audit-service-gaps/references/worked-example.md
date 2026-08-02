# Worked example (Input → Output)

One run of the DETECT → BENCHMARK → PROPOSE chain from SKILL.md.

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

The gap #1 proposal lands as an ADR — e.g. `docs/decisions/ADR-0NN-wizard-provenance.md` recording
the inline-provenance decision and the rejected full-detail-page alternative — so step 5's "record
ADR-style" is concrete, not just advice.

Gap #2 (correctness, sev 4) skips benchmarking — it's a bug: fix directly and add the drift guard
that stops the advertised-vs-actual family from recurring. Gap #4 proposes deletion, not a
benchmark. **That selective routing is the point: spend research only where it pays.** Three of the
four gaps never enter Mode 2, and the one that does carries a mechanism someone actually observed.

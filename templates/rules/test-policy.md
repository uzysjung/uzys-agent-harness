# Testing

**How far** to verify scales with the risk of the change; **when** those results must exist
belongs to the Delivery rule.

- An ordinary change gets the repository's baseline CI and regression across the affected scope;
  independent verification only where the Delivery rule requires it. A high-risk one widens that in
  proportion to what it touches and what its failure would cost.
- Preserve required outcomes with the least burdensome reliable protection.
  Prefer fixing the cause and reusing or improving existing mechanisms within scope;
  no new guard is needed when those suffice. Judge safeguards by credible risk,
  the assurance they add, and total effort, not request emphasis, incident counts,
  or the number or subject of checks. Tests of safeguards follow the same standard.
  Reuse valid evidence and recheck affected claims when relevant conditions change.
  Within project policy, adapt methods to demonstrated model and tool capabilities
  while preserving acceptance criteria, required gates, and authority boundaries.
  Finish optional verification when required outcomes have sufficient evidence
  and residual risk is within the project's accepted limits.
- High-risk includes at least authentication, authorization, payments and settlement, personal
  data, data integrity, concurrency, state transitions, and migrations.
- Full regression, full E2E, full mutation, and periodic security scanning belong to the CI/CD
  schedule, not to a per-change decision.
- For a high-risk change, cover normal, boundary, failure, misuse, and recovery paths,
  omitting one only when failure on it is not plausible.
- Use production-compatible dependencies when a substitute's behavioral differences could affect
  the result. Otherwise, use explicit test doubles or contract tests.
- Never use unauthorized production personal data, credentials, or secrets in tests.
- Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage, or
  adding indiscriminate retries. Correct or consolidate tests when their expectations are
  wrong, obsolete, or redundant; preserve coverage of the accepted contract and follow project
  policy for changes to mandatory gates.
- If the affected scope cannot be established confidently, broaden the validation.

# Testing

**How far** to verify scales with the risk of the change; **when** those results must exist
belongs to the Delivery rule.

- An ordinary change gets the repository's baseline CI, regression across the affected scope, and
  whatever independent verification it warrants. A high-risk one widens that in proportion to what
  it touches and what its failure would cost.
- High-risk includes at least authentication, authorization, payments and settlement, personal
  data, data integrity, concurrency, state transitions, and migrations.
- Full regression, full E2E, full mutation, and periodic security scanning belong to the CI/CD
  schedule, not to a per-change decision.
- Test observable behavior — contracts and invariants — at whichever level best exposes
  plausible failures.
- For a high-risk change, cover normal, boundary, failure, misuse, and recovery paths,
  omitting one only when failure on it is not plausible.
- Keep tests deterministic: time, randomness, shared state, execution order, network, and
  external services.
- Use production-compatible dependencies when a substitute's behavioral differences could affect
  the result. Otherwise, use explicit test doubles or contract tests.
- Never use unauthorized production personal data, credentials, or secrets in tests.
- Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage, or
  adding indiscriminate retries. Change tests only when the intended behavior has changed.
- Coverage signals untested risk; it is not a target. Follow the repository-defined CI gates.
- If the affected scope cannot be established confidently, broaden the validation.

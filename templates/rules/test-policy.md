# Testing

- Select the test level and technique that best exposes plausible failures.
- Test observable behavior, contracts, and invariants rather than reproducing implementation details.
- For high-risk changes—including authentication, authorization, payments, personal data, data
  integrity, concurrency, and migrations—test normal, boundary, failure, misuse, and recovery paths.
- Keep tests isolated, repeatable, and deterministic. Control time, randomness, shared state,
  execution order, network, and external services.
- Use production-compatible dependencies when behavioral differences could affect validity.
  Otherwise, use explicit test doubles or contract tests.
- Never use unauthorized production personal data, credentials, or secrets in tests.
- Run the relevant checks and inspect their results.
- Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage, or
  adding indiscriminate retries. Change tests only when the intended behavior has changed.
- Treat coverage as a signal for untested risk, not as a quality target. Follow the
  repository-defined CI gates.
- If the affected scope cannot be established confidently, broaden the validation.

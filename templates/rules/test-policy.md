# Testing

- Test observable behavior — contracts and invariants — at whichever level best exposes
  plausible failures.
- For high-risk changes—including authentication, authorization, payments, personal data, data
  integrity, concurrency, and migrations—cover normal, boundary, failure, misuse, and recovery
  paths, omitting one only when failure on it is not plausible.
- Keep tests deterministic: time, randomness, shared state, execution order, network, and
  external services.
- Use production-compatible dependencies when a substitute's behavioral differences could affect
  the result. Otherwise, use explicit test doubles or contract tests.
- Never use unauthorized production personal data, credentials, or secrets in tests.
- Do not hide failures by weakening assertions, deleting or skipping tests, excluding coverage, or
  adding indiscriminate retries. Change tests only when the intended behavior has changed.
- Coverage signals untested risk; it is not a target. Follow the repository-defined CI gates.
- If the affected scope cannot be established confidently, broaden the validation.

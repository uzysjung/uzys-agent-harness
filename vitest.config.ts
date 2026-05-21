import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["src/**/*.ts"],
      // Excluded from coverage:
      //   - src/index.ts: bin entrypoint; calls buildCli().parse(argv). Logic in cli.ts.
      //   - src/prompts.ts: thin @clack/prompts adapter (no transformation logic — that lives in
      //     interactive.ts). Mocking clack to test prompt wiring is fragile and low value;
      //     business rules are exercised via the orchestrator.
      exclude: ["src/**/*.d.ts", "src/types/**", "src/index.ts", "src/prompts.ts"],
      thresholds: {
        lines: 90,
        // branches: 90 → 88 → 87 → 86 → 87 → 88 → 86 (v26.64.0) → 87 (v26.64.1) → 88 (v26.65.2 완전 복구).
        // install.ts / cli.ts / external-installer.ts 의 dep-inject defaults + spawn helpers 에 v8 ignore.
        // wizard-steps.ts 100% test. ADR-013/014 약속 회복.
        branches: 88,
        functions: 90,
        statements: 90,
      },
    },
    globals: false,
    reporters: ["default"],
  },
});

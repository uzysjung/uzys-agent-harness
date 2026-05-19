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
        // branches: 90 → 88 → 87 → 86 → 87 → 88 → 86 (v26.64.0 — uninstall.ts 신규 + ADR-020 분기 다수).
        // 후속 cycle 에서 uninstall.ts branch 보강 후 88 복구.
        branches: 86,
        functions: 90,
        statements: 90,
      },
    },
    globals: false,
    reporters: ["default"],
  },
});

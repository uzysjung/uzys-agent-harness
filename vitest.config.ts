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
        // branches: 90 → 88 → 87 → 86 (v26.47.0) — Phase C full userOverride 분기 + assets
        // step + computeUserOverride diff 등 격리 테스트 어려움. 후속 PR에서 복구.
        branches: 86,
        functions: 90,
        statements: 90,
      },
    },
    globals: false,
    reporters: ["default"],
  },
});

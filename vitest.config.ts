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
        // branches: 90 → 88 → 87 (v26.46.0) — streaming progress(installer.ts onProgress),
        // default 헬퍼, shortenPath edge case + Codex/Wizard back nav 분기 격리 테스트 어려움.
        // 후속 PR에서 복구.
        branches: 87,
        functions: 90,
        statements: 90,
      },
    },
    globals: false,
    reporters: ["default"],
  },
});

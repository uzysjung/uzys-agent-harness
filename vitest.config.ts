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
      //   - src/prompts.ts: @clack/prompts adapter. Mocking clack to test prompt wiring is fragile
      //     and low value; orchestration rules are exercised via interactive.ts.
      //     ⚠️ v26.99.0 정정 (SOD 리뷰): 기존 주석은 "no transformation logic" 이라 단언했으나
      //     ADR-028 이 설치에 영향 주는 변환(방법론 번들 collapse/expand + 멤버 필터 + 번들 row)을
      //     이 파일에 들였다 — 그 단언은 더 이상 참이 아니다. 제외는 유지하되(clack 렌더 자체는
      //     여전히 mocking 가치 낮음) **변환부는 순수 함수로 export 해 직접 테스트**한다:
      //     buildPageGroups·collapse/expandDevMethodBundle → tests/wizard-bundle.test.ts.
      //     즉 이 제외가 "미검증" 을 뜻하지 않도록 커버 경로를 별도 확보. 새 변환 로직을 여기
      //     추가하려면 같은 방식(export + 직접 테스트)을 따를 것 — coverage 수치는 이 파일에
      //     대해 아무 보장을 주지 않는다.
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

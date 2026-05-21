import { describe, expect, it } from "vitest";
import { stepLabel, WIZARD, WIZARD_TOTAL } from "../src/wizard-steps.js";

describe("wizard-steps", () => {
  it("WIZARD constants match WIZARD_TOTAL", () => {
    expect(WIZARD_TOTAL).toBe(6);
    expect(WIZARD.TRACKS).toEqual({ current: 1, total: 6 });
    expect(WIZARD.CLI).toEqual({ current: 2, total: 6 });
    expect(WIZARD.TARGETS).toEqual({ current: 3, total: 6 });
    expect(WIZARD.SCOPE).toEqual({ current: 4, total: 6 });
    expect(WIZARD.CONFIRM).toEqual({ current: 5, total: 6 });
    expect(WIZARD.INSTALL).toEqual({ current: 6, total: 6 });
  });

  it("stepLabel(step, suffix) — step 명시 시 'Step N/M — <suffix>' 형식", () => {
    expect(stepLabel(WIZARD.TRACKS, "Select Track(s)")).toBe("Step 1/6 — Select Track(s)");
    expect(stepLabel(WIZARD.SCOPE, "Installation scope")).toBe("Step 4/6 — Installation scope");
  });

  it("stepLabel(undefined, suffix) — step 미명시 시 suffix 만 반환 (backward compat)", () => {
    expect(stepLabel(undefined, "Select Track(s)")).toBe("Select Track(s)");
  });
});

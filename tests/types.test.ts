import { describe, expect, it } from "vitest";
import { CLI_BASES, isCliBase, isTrack, TRACKS } from "../src/types.js";

describe("isTrack", () => {
  it.each(TRACKS)("accepts known track %s", (t) => {
    expect(isTrack(t)).toBe(true);
  });

  it.each([null, undefined, "", "unknown", 1, true, {}])("rejects %s", (value) => {
    expect(isTrack(value)).toBe(false);
  });
});

describe("isCliBase (v0.8.0 — replaces isCliMode)", () => {
  it.each(CLI_BASES)("accepts %s", (b) => {
    expect(isCliBase(b)).toBe(true);
  });

  it("rejects an unknown CLI", () => {
    expect(isCliBase("rust")).toBe(false);
  });

  it("rejects legacy alias both/all (v0.8.0 — alias removed)", () => {
    expect(isCliBase("both")).toBe(false);
    expect(isCliBase("all")).toBe(false);
  });
});

describe("TRACKS array", () => {
  it("has 12 tracks (v0.5.0 — added project-management, growth-marketing · #456 base)", () => {
    expect(TRACKS).toHaveLength(12);
  });

  it("includes the two v0.5.0 tracks", () => {
    expect(TRACKS).toContain("project-management");
    expect(TRACKS).toContain("growth-marketing");
  });
});

import { describe, expect, it } from "vitest";
import { buildRouterChoices, summarizeState } from "../src/router.js";
import type { DetectedInstall } from "../src/state.js";

const newState: DetectedInstall = {
  state: "new",
  tracks: [],
  source: "none",
  hasClaudeDir: false,
};

const existingState: DetectedInstall = {
  state: "existing",
  tracks: ["tooling", "csr-fastapi"],
  source: "metafile",
  hasClaudeDir: true,
};

const legacyState: DetectedInstall = {
  state: "existing",
  tracks: [],
  source: "legacy",
  hasClaudeDir: true,
};

describe("buildRouterChoices", () => {
  it("returns 5 choices in stable order", () => {
    const choices = buildRouterChoices(existingState);
    expect(choices.map((c) => c.value)).toEqual(["add", "update", "remove", "reinstall", "exit"]);
  });

  it("disables only the remove action", () => {
    const choices = buildRouterChoices(existingState);
    const disabled = choices.filter((c) => !c.enabled).map((c) => c.value);
    expect(disabled).toEqual(["remove"]);
  });

  it("includes detected tracks in the add hint", () => {
    const choices = buildRouterChoices(existingState);
    const add = choices.find((c) => c.value === "add");
    expect(add?.hint).toContain("tooling");
    expect(add?.hint).toContain("csr-fastapi");
  });

  it("falls back to '(none detected)' when tracks empty", () => {
    const choices = buildRouterChoices(legacyState);
    const add = choices.find((c) => c.value === "add");
    expect(add?.hint).toContain("none detected");
  });
});

describe("summarizeState", () => {
  it("describes a new install", () => {
    expect(summarizeState(newState)).toContain("new install");
  });

  it("describes an existing metafile install with track list", () => {
    expect(summarizeState(existingState)).toContain(".claude/.installed-tracks");
    expect(summarizeState(existingState)).toContain("tooling");
  });

  it("describes a legacy heuristic install", () => {
    expect(summarizeState(legacyState)).toContain("legacy rules");
  });

  it("notes when no tracks resolved", () => {
    expect(summarizeState(legacyState)).toContain("no tracks resolved");
  });

  it("describes a none-source existing install path", () => {
    const noneState: DetectedInstall = {
      state: "existing",
      tracks: ["data"],
      source: "none",
      hasClaudeDir: true,
    };
    expect(summarizeState(noneState)).toContain("via no source");
  });
});

/**
 * v26.126.0 (R-3a) — update 는 **위저드로만 도달**한다 (`install` 은 mode 를 안 넘긴다).
 * 그래서 이 hint 문구가 update 동작의 유일한 광고 표면이고, 실동작과 어긋나면 그 자체로
 * 거짓출하다 (`no-false-ship` Surface Parity). v26.126.0 이전 문구는 skills 를 빠뜨리고 있었다.
 */
describe("update hint 는 실제 갱신 대상을 광고한다 (R-3a)", () => {
  it("skills 가 문구에 있다 — 갱신하면서 안 알리면 사용자는 모른다", () => {
    const update = buildRouterChoices(existingState).find((c) => c.value === "update");
    expect(update?.hint).toContain("skills");
  });

  it("편집분 백업을 알린다 — 백업본이 갑자기 나타나면 놀란다", () => {
    const update = buildRouterChoices(existingState).find((c) => c.value === "update");
    expect(update?.hint).toMatch(/back(ed)? up/i);
  });
});

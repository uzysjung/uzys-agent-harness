import { describe, expect, it } from "vitest";
import { buildRouterChoices, describeInstall, summarizeState } from "../src/router.js";
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
  // #533 (D1) — 기설치 메뉴는 세 항목이다. Add 는 Update 로 합쳐졌고, Remove(고를 수 없는 항목)는
  // 빠졌고, Reinstall 은 `install --reinstall` 플래그가 됐다.
  it("returns 3 choices in stable order — update, uninstall, exit", () => {
    const choices = buildRouterChoices(existingState);
    expect(choices.map((c) => c.value)).toEqual(["update", "uninstall", "exit"]);
    for (const gone of ["add", "remove", "reinstall"]) {
      expect(choices.map((c) => c.value as string)).not.toContain(gone);
    }
  });

  it("disables nothing on a healthy install", () => {
    const choices = buildRouterChoices(existingState);
    expect(choices.filter((c) => !c.enabled)).toEqual([]);
  });

  // (이전 "add hint 에 감지된 트랙" 단언의 자리 이동 — #533 D2 에서 트랙은 메뉴 머리글이 읊는다.)
  it("includes detected tracks in the menu header", () => {
    const header = describeInstall(existingState);
    expect(header).toContain("tooling");
    expect(header).toContain("csr-fastapi");
  });

  it("falls back to '(none detected)' when tracks empty", () => {
    expect(describeInstall(legacyState)).toContain("none detected");
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

  // v26.135.0 (#253) — 위저드가 이 문장을 그대로 찍는다. opencode 단독 설치는 `.claude/` 가
  // 없어 트랙 출처가 설치 로그뿐인데, 라벨이 없으면 "via no source" 로 떨어져 화면이
  // "설치는 됐는데 출처 없음"이라는 거짓을 말한다.
  it("describes an install detected from the install log (no .claude/)", () => {
    const logState: DetectedInstall = {
      state: "existing",
      tracks: ["tooling"],
      source: "install-log",
      hasClaudeDir: false,
    };
    expect(summarizeState(logState)).toContain(".uzys-agent-harness/");
    expect(summarizeState(logState)).toContain("tooling");
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

/**
 * 기록 접근자 `recorded()` · `excludedIds` · `kindOf` (#551 · ADR-097 · 설계 §1.2 "데이터 모델" · §5).
 *
 * 핵심은 옛 스캔 필드 필터(Q1 · B2): 옛 판의 `policyFiles`·`skillFiles` 는 디스크를 훑어 적은 값이라 설치자
 * 파일이 섞여 있고, 그것을 소유로 읽으면 uninstall 이 백업 없이 지운다. 필터에 걸린 항목은 "기록 없음" 이다.
 */

import { describe, expect, it } from "vitest";
import type { InstallLog } from "../src/install-log.js";
import { judge } from "../src/judge.js";
import { RETIRED_AGENT_IDS, RETIRED_AGENTS } from "../src/manifest.js";
import { excludedIds, kindOf, ownersOf, recorded } from "../src/recorded.js";

function log(
  over: Omit<Partial<InstallLog>, "spec"> & { spec?: Partial<InstallLog["spec"]> } = {},
): InstallLog {
  const { spec, ...rest } = over;
  return {
    schemaVersion: 1,
    installedAt: "2026-09-27T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"], ...spec },
    templates: {},
    assets: [],
    ...rest,
  };
}

const GIT_POLICY = ".claude/rules/git-policy.md";

describe("recorded — 네 필드의 경로 기준을 숨긴다", () => {
  it("로그가 없으면 none", () => {
    expect(recorded(null, GIT_POLICY)).toEqual({ state: "none" });
  });

  it("externalFiles(프로젝트 상대) · 앵커 sha 는 쓰는 순간 적은 값 — 그대로 sha", () => {
    const l = log({
      spec: { cli: ["codex"] },
      externalFiles: [{ path: "AGENTS.md", sha256: "a" }],
      templates: { rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "b" } },
    });
    expect(recorded(l, "AGENTS.md")).toEqual({ state: "sha", sha256: "a" });
    expect(recorded(l, "CLAUDE-uzys-harness.md")).toEqual({ state: "sha", sha256: "b" });
  });

  it("policyFiles 는 `.claude/` 상대 · skillFiles 는 `.claude/skills/` 상대로 적혀 있다", () => {
    const l = log({
      policyFiles: [{ path: "rules/git-policy.md", sha256: "p" }],
      skillFiles: [{ path: "north-star/SKILL.md", sha256: "s" }],
    });
    expect(recorded(l, GIT_POLICY)).toEqual({ state: "sha", sha256: "p" });
    expect(recorded(l, ".claude/skills/north-star/SKILL.md")).toEqual({
      state: "sha",
      sha256: "s",
    });
  });

  it("rootFiles 는 sha 없이 기록 — displaced 는 소유가 아니다", () => {
    const l = log({
      records: "writer",
      rootFiles: [
        { path: ".mcp.json", change: "created", notes: [] },
        { path: ".claude/agents/reviewer.md", change: "displaced", notes: ["x.backup-1"] },
      ],
    });
    expect(recorded(l, ".mcp.json")).toEqual({ state: "no-sha" });
    expect(recorded(l, ".claude/agents/reviewer.md")).toEqual({ state: "none" });
  });
});

describe("recorded — 옛 스캔 필드 필터(Q1)", () => {
  const scanned = {
    policyFiles: [
      { path: "rules/git-policy.md", sha256: "p" },
      { path: "agents/data-analyst.md", sha256: "d" }, // tooling 트랙은 고르지 않는 에이전트
    ],
  };

  it("고르지 않은 트랙의 같은 이름 설치자 파일은 소유가 아니다", () => {
    expect(recorded(log(scanned), ".claude/agents/data-analyst.md")).toEqual({ state: "none" });
    expect(
      recorded(log({ ...scanned, spec: { tracks: ["data"] } }), ".claude/agents/data-analyst.md"),
    ).toEqual({
      state: "sha",
      sha256: "d",
    });
  });

  it("claude 가 깔리지 않은 로그의 스캔 값은 소유가 아니다(BLOCKER-5)", () => {
    expect(recorded(log({ ...scanned, spec: { cli: ["codex"] } }), GIT_POLICY)).toEqual({
      state: "none",
    });
  });

  it("설치자가 뺀 것(옛 baselineExclude · 새 excluded)은 소유가 아니다", () => {
    expect(
      recorded(
        log({ ...scanned, spec: { baselineExclude: ["baseline:rules/git-policy"] } }),
        GIT_POLICY,
      ),
    ).toEqual({
      state: "none",
    });
    expect(
      recorded(log({ ...scanned, excluded: ["baseline:rules/git-policy"] }), GIT_POLICY),
    ).toEqual({ state: "none" });
    const skills = log({
      skillFiles: [{ path: "north-star/SKILL.md", sha256: "s" }],
      spec: { skillExclude: ["north-star"] },
    });
    expect(recorded(skills, ".claude/skills/north-star/SKILL.md")).toEqual({ state: "none" });
  });

  it('새 판 로그(records: "writer")는 필터 없이 읽는다', () => {
    const l = log({ ...scanned, records: "writer", spec: { cli: ["codex"] } });
    expect(recorded(l, ".claude/agents/data-analyst.md")).toEqual({ state: "sha", sha256: "d" });
  });
});

describe("recorded — 기록 있음 · sha 없음(#557 · A8)", () => {
  it("로그가 그 CLI 를 말하고 기록 트랙의 대상인데 파일별 sha 만 없으면 no-sha", () => {
    expect(recorded(log(), GIT_POLICY)).toEqual({ state: "no-sha" });
    expect(recorded(log(), ".uzys-agent-harness/protect-branch.sh")).toEqual({ state: "no-sha" });
  });

  it("대상이 아니거나 · CLI 가 없거나 · 뺐거나 · 새 판 로그면 none", () => {
    expect(recorded(log(), ".claude/agents/data-analyst.md")).toEqual({ state: "none" });
    expect(recorded(log(), ".claude/rules/my-own.md")).toEqual({ state: "none" });
    expect(recorded(log({ spec: { cli: ["codex"] } }), GIT_POLICY)).toEqual({ state: "none" });
    expect(recorded(log({ excluded: ["baseline:rules/git-policy"] }), GIT_POLICY)).toEqual({
      state: "none",
    });
    expect(recorded(log({ records: "writer" }), GIT_POLICY)).toEqual({ state: "none" });
  });

  it("다른 CLI 경로는 호출부가 대상 목록을 줄 때만 no-sha — 모르면 none(안전한 쪽)", () => {
    const codex = log({ spec: { cli: ["codex"] } });
    const hook = ".codex/hooks/session-start.sh";
    expect(recorded(codex, hook)).toEqual({ state: "none" });
    expect(recorded(codex, hook, { isTarget: (p) => p === hook })).toEqual({ state: "no-sha" });
    expect(
      recorded(log({ spec: { cli: ["claude"] } }), hook, { isTarget: (p) => p === hook }),
    ).toEqual({
      state: "none",
    });
  });
});

describe("excludedIds · ownersOf · kindOf", () => {
  it("excludedIds = 새 excluded + 옛 두 필드(읽기 폴백)", () => {
    const l = log({
      excluded: ["mcp:github"],
      spec: { baselineExclude: ["baseline:agents/reviewer"], skillExclude: ["north-star"] },
    });
    expect([...excludedIds(l)].sort()).toEqual([
      "baseline:agents/reviewer",
      "mcp:github",
      "north-star",
    ]);
    expect(excludedIds(null).size).toBe(0);
  });

  it("ownersOf — 소유 표의 경로 접두(N3)", () => {
    expect(ownersOf(".claude/rules/x.md")).toEqual(["claude"]);
    expect(ownersOf(".agents/skills/x/SKILL.md")).toEqual(["codex", "opencode", "antigravity"]);
    expect(ownersOf("AGENTS.md")).toEqual(["codex", "opencode"]);
    expect(ownersOf("src/index.ts")).toEqual([]);
  });

  it("kindOf — 어댑터 표 = shared · 스캐폴드·advisory 기록 = advisory · 그 밖 = harness", () => {
    expect(kindOf(null, ".claude/settings.json")).toBe("shared");
    expect(kindOf(null, "AGENTS.md")).toBe("shared");
    expect(kindOf(null, ".github/workflows/ci.yml")).toBe("advisory"); // 옛 로그는 created 로 적었다
    expect(kindOf(null, ".env.example")).toBe("advisory");
    expect(
      kindOf(log({ rootFiles: [{ path: "_bmad/", change: "advisory", notes: [] }] }), "_bmad/"),
    ).toBe("advisory");
    expect(kindOf(null, GIT_POLICY)).toBe("harness");
  });
});

describe("recorded — 옛 로그의 은퇴 하네스 파일(#551 리뷰 B3 · P4)", () => {
  // v26.150 시절 로그 모양 — `clis` 없음 · 디스크 스캔 `policyFiles` · 앵커 sha
  const v150 = log({
    spec: { tracks: ["tooling"], cli: ["claude"] },
    templates: {
      claudeDir: ".claude/",
      rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "a" },
    },
    policyFiles: [
      { path: "rules/git-policy.md", sha256: "g" },
      { path: "agents/code-reviewer.md", sha256: "c" },
      { path: "agents/plan-checker.md", sha256: "p" },
      { path: "hooks/task-brief-nudge.sh", sha256: "t" },
    ],
  });
  const RETIRED = [
    ".claude/agents/code-reviewer.md",
    ".claude/agents/plan-checker.md",
    ".claude/hooks/task-brief-nudge.sh",
  ];

  it.each(RETIRED)("%s → no-sha → uninstall · update 회수 = backup+remove", (path) => {
    const rec = recorded(v150, path);
    expect(rec).toEqual({ state: "no-sha" });
    const disk = "whatever is on disk\n";
    expect(judge({ op: "remove", kind: "harness", rec, disk, next: null }).verdict).toBe(
      "backup+remove",
    );
  });

  it("대조군 — 지금도 배포하는 rules/git-policy.md 는 옛 sha 그대로 sha", () => {
    expect(recorded(v150, GIT_POLICY)).toEqual({ state: "sha", sha256: "g" });
  });

  it("claude 가 없거나 · 설치자가 뺐거나 · 옛 스캔 기록이 없으면 은퇴 경로도 기록 없음(지우지 않는다)", () => {
    const codex = log({ ...v150, spec: { tracks: ["tooling"], cli: ["codex"] }, templates: {} });
    expect(recorded(codex, ".claude/agents/code-reviewer.md")).toEqual({ state: "none" });
    const excluded = log({ ...v150, excluded: ["baseline:agents/code-reviewer"] });
    expect(recorded(excluded, ".claude/agents/code-reviewer.md")).toEqual({ state: "none" });
    expect(recorded(v150, ".claude/rules/code-style.md")).toEqual({ state: "none" }); // policyFiles 에 없다
  });

  it("writer 가 이어받은 은퇴 항목도 no-sha — 옛 스캔 sha 로 백업 없이 지우지 않는다", () => {
    const writer = log({ ...v150, records: "writer" });
    expect(recorded(writer, ".claude/agents/code-reviewer.md")).toEqual({ state: "no-sha" });
  });

  it("같은 이름이 다시 배포되면 은퇴가 아니다 — 대상으로 읽는다", () => {
    const again = recorded(v150, ".claude/agents/code-reviewer.md", { isTarget: () => true });
    expect(again).toEqual({ state: "sha", sha256: "c" });
  });

  it("은퇴 에이전트 id 는 은퇴 경로에서 나오고, 대안 문구 목록과 같은 집합이다", () => {
    expect([...RETIRED_AGENT_IDS].sort()).toEqual(RETIRED_AGENTS.map((a) => a.id).sort());
  });
});

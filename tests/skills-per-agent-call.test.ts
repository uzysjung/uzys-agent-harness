import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { DEFAULT_OPTIONS } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #372 — skill 자산은 **에이전트마다 한 번씩** 부른다.
 *
 * 실측 (2026-08-27, 컨테이너 `skills@1.5.11`): 같은 명령에서 `--agent` 를 반복해 넘기면
 * Claude Code 몫의 복사가 조용히 빠진다. 자산만 다르게 해도 같고(대조군 `find-skills`),
 * exit 0 이라 설치 화면에는 ✓ 로 뜬다.
 *
 *   --agent claude-code                          → .claude/skills/<id>/SKILL.md   ✅
 *   --agent claude-code --agent codex            → .agents/skills/<id> 만          ❌
 *   --agent claude-code ... (4개 전부)            → .agents/skills/<id> 만          ❌
 *   나눠서 4번 호출                                 → 두 자리 다 생김                 ✅
 *
 * `.agents/skills/` 는 skills CLI 자신이 "universal: Codex, OpenCode, Antigravity" 로 표시하는
 * 자리다 — Claude Code 는 별도 복사를 받아야 한다. 그래서 영향은 `method.kind:"skill"` 자산
 * 전부이고(카탈로그 60 중 18), Claude Code 를 다른 CLI 와 **함께** 고른 설치자가 겪는다.
 *
 * 이 파일이 무는 것은 **호출 형태**다. 디스크 결과는 컨테이너에서만 볼 수 있고(호스트 실행은
 * 훅이 차단), 그쪽은 #369(G2)가 소유한다. 형태를 무는 이유는 이것이 회귀하면 증상이 다시
 * **조용해지기** 때문이다 — exit 0 에 화면은 ✓ 다.
 */

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

function okSpawn(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function makeSpawnMock(): SpawnFn & { mock: { calls: Array<Parameters<SpawnFn>> } } {
  return vi.fn(okSpawn) as unknown as SpawnFn & {
    mock: { calls: Array<Parameters<SpawnFn>> };
  };
}

const SKILL_ASSET = createMockAsset({
  id: "skill-cross-cli",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/repo", skill: "thing" },
});

const BASE_CTX = {
  tracks: ["tooling"] as const,
  options: DEFAULT_OPTIONS,
  projectDir: "/tmp/x",
};

/** `npx` 호출들만 추린다 — plugin 자산의 `claude` 호출과 섞이지 않게. */
function npxCalls(spawn: ReturnType<typeof makeSpawnMock>): string[][] {
  return spawn.mock.calls.filter((c) => c[0] === "npx").map((c) => [...(c[1] as string[])]);
}

const agentsOf = (args: string[]): string[] =>
  args.flatMap((a, i) => (a === "--agent" ? [args[i + 1] as string] : []));

describe("#372 — skill 자산은 에이전트마다 한 번씩 부른다", () => {
  it("4 CLI 를 고르면 호출이 4번이고, 각 호출의 --agent 는 정확히 하나다", () => {
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex", "opencode", "antigravity"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const calls = npxCalls(spawn);
    expect(calls, "자산 1개 · CLI 4개 → npx 호출 4번이어야 한다").toHaveLength(4);
    for (const args of calls) {
      expect(
        agentsOf(args),
        `한 호출에 --agent 가 여럿이면 Claude Code 몫이 조용히 빠진다: ${args.join(" ")}`,
      ).toHaveLength(1);
    }
  });

  it("네 에이전트가 정확히 한 번씩 나온다 (누락도 중복도 없다)", () => {
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex", "opencode", "antigravity"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const seen = npxCalls(spawn).flatMap(agentsOf).sort();
    // `claude` → `claude-code` 매핑이 유지돼야 한다 — 어긋나면 skills CLI 가 `Invalid agents` 로
    // 죽고 그 자산은 100% skip 된다(실사용 리포 재현 전례, v26.55.1 주석).
    expect(seen).toEqual(["antigravity", "claude-code", "codex", "opencode"]);
  });

  it("CLI 하나면 호출도 하나다 (분할이 과하게 늘어나지 않는다)", () => {
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: ["codex"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const calls = npxCalls(spawn);
    expect(calls).toHaveLength(1);
    expect(agentsOf(calls[0] as string[])).toEqual(["codex"]);
  });

  it("cli 미지정([])은 --agent 없이 한 번 — 레거시 '전체' 관례 유지", () => {
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: [] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const calls = npxCalls(spawn);
    expect(calls).toHaveLength(1);
    expect(agentsOf(calls[0] as string[])).toEqual([]);
  });

  it("한 에이전트가 실패하면 그 자산은 실패로 보고되고, 어느 에이전트인지 나온다", () => {
    // 부분 실패를 성공으로 접으면 "설치됨"이 거짓이 된다 — 이 저장소가 반복해 다친 형태.
    const spawn = vi.fn((_cmd: string, args: ReadonlyArray<string>) =>
      agentsOf([...args]).includes("codex")
        ? { pid: 0, output: [], stdout: "", stderr: "boom", status: 1, signal: null }
        : okSpawn(),
    ) as unknown as SpawnFn;
    const report = runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const r = report.attempted.find((a) => a.asset.id === "skill-cross-cli");
    expect(r?.ok, "한 에이전트가 실패했는데 성공으로 보고됐다").toBe(false);
    expect(r?.message ?? "", "실패 메시지가 어느 에이전트인지 안 말한다").toContain("codex");
  });

  it("모든 에이전트가 성공하면 성공으로 보고된다", () => {
    const spawn = makeSpawnMock();
    const report = runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    expect(report.attempted.find((a) => a.asset.id === "skill-cross-cli")?.ok).toBe(true);
  });
});

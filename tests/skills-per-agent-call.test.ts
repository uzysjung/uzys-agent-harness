import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { DEFAULT_OPTIONS } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * #372 — skill 자산 설치는 `--copy` 를 붙인다. 안 붙이면 Claude Code 몫이 조용히 빠진다.
 *
 * 실측 (2026-08-27, 컨테이너 `skills@1.5.11`, 최신 1.5.23 도 동일):
 *
 *   --agent a --agent b (반복)        → `.agents/skills/` 만          ❌
 *   --agent a b (variadic, 문서 형태)   → `.agents/skills/` 만          ❌
 *   --agent "a,b" (콤마)               → `Invalid agents:` **exit 1**   ❌ 아무것도 안 깔림
 *   위 어느 형태든 **+ --copy**         → `.claude/` · `.agents/` 둘 다  ✅ 1회 5초
 *
 * `.agents/skills/` 는 codex·opencode·antigravity 가 공유하는 자리다. Claude Code 는
 * `.claude/skills/` 로의 별도 복사를 받아야 하는데, 기본 모드의 다중 에이전트에서 그 복사가
 * 일어나지 않는다. **exit 0 이고 설치 화면에는 ✓ 로 뜬다** — 조용한 미설치다.
 * 영향은 `method.kind:"skill"` 자산 전부(카탈로그 60 중 18, 기본 설치 4종).
 *
 * **`--copy` 는 에이전트를 명시할 때만 붙인다.** 미지정(레거시 "전체")에 붙이면 설치 자리가
 * `.agents/` 한 곳에서 **약 50개 도구 디렉터리로 폭발**한다(실측). 그 경로는 종전 그대로다.
 *
 * 이 파일이 무는 것은 **호출 형태**다. 디스크 결과는 컨테이너에서만 볼 수 있고(호스트 실행은
 * 훅이 차단), 그쪽은 #369(G2)가 소유한다. 형태를 무는 이유는 회귀하면 증상이 다시 조용해지기
 * 때문이다.
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

describe("#372 — skill 설치 인자", () => {
  const argsFor = (cli: string[]): string[] => {
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: cli as never },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const calls = npxCalls(spawn);
    expect(calls, `npx 호출이 1번이 아니다: ${calls.length}`).toHaveLength(1);
    return calls[0] as string[];
  };

  it("에이전트를 고르면 --copy 가 붙는다 (없으면 .claude/skills 가 조용히 빠진다)", () => {
    for (const cli of [
      ["claude"],
      ["codex"],
      ["claude", "codex"],
      ["claude", "codex", "opencode", "antigravity"],
    ]) {
      expect(argsFor(cli), `--copy 누락 (cli=${cli.join(",")})`).toContain("--copy");
    }
  });

  it("네 에이전트가 정확히 한 번씩, claude → claude-code 로 매핑된다", () => {
    // 매핑이 어긋나면 skills CLI 가 `Invalid agents` 로 죽고 그 자산은 100% skip 된다
    // (실사용 리포 재현 전례, v26.55.1).
    const seen = agentsOf(argsFor(["claude", "codex", "opencode", "antigravity"]));
    expect([...seen].sort()).toEqual(["antigravity", "claude-code", "codex", "opencode"]);
  });

  it("콤마로 합치지 않는다 — 콤마 형태는 exit 1 이다 (1.5.11 · 1.5.23 실측)", () => {
    for (const a of agentsOf(argsFor(["claude", "codex"]))) {
      expect(a, `에이전트 이름에 콤마가 들어갔다: ${a}`).not.toContain(",");
    }
  });

  it("cli 미지정([])은 --agent 도 --copy 도 없다 — 붙이면 약 50곳으로 폭발한다", () => {
    const args = argsFor([]);
    expect(agentsOf(args)).toEqual([]);
    expect(args, "레거시 '전체' 경로에 --copy 가 붙었다 — 설치 자리가 폭발한다").not.toContain(
      "--copy",
    );
  });

  it("설치가 실패하면 그 자산은 실패로 보고된다", () => {
    const spawn = vi.fn(() => ({
      pid: 0,
      output: [],
      stdout: "",
      stderr: "boom",
      status: 1,
      signal: null,
    })) as unknown as SpawnFn;
    const report = runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    expect(report.attempted.find((a) => a.asset.id === "skill-cross-cli")?.ok).toBe(false);
  });

  it("모든 것이 성공하면 성공으로 보고된다", () => {
    const spawn = makeSpawnMock();
    const report = runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    expect(report.attempted.find((a) => a.asset.id === "skill-cross-cli")?.ok).toBe(true);
  });
});

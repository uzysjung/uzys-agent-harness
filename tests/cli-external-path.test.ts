import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { assetCliSupport, EXTERNAL_ASSETS } from "../src/external-assets.js";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { CLI_BASES, DEFAULT_OPTIONS } from "../src/types.js";
import { createMockAsset } from "./helpers/mock-asset.js";

/**
 * v26.102.0 (ADR-031, Batch3) — 4-CLI 도달 경로 게이트.
 *
 * WHY: 2026-07-14 하네스 감사 P0 [4cli-asymmetry-cluster]/[cli-external-path-untested]
 * CONFIRMED — `installPlugin` 이 `claude plugin ...` 을 하드코딩 spawn 하는데 ctx.cli 를
 * 아무도 참조하지 않아, codex 단독 설치에서도 claude CLI 가 실행돼 `~/.claude/plugins` 를
 * 오염시켰다(프로젝트 룰 "무동의 글로벌 write 금지" 위반). 이 경로는 테스트 0건이라
 * branches 88 게이트로도 잡히지 않았다. 본 파일이 그 경로의 회귀 게이트다:
 * 선택 CLI 와 도달 범위(assetCliSupport)의 교집합이 없는 자산은 spawn 자체가 없어야 한다.
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

const PLUGIN_ASSET = createMockAsset({
  id: "plugin-claude-only",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "plugin", marketplace: "ms/foo", pluginId: "foo@ms-foo" },
});

const SKILL_ASSET = createMockAsset({
  id: "skill-cross-cli",
  condition: { kind: "any-track", tracks: ["tooling"] },
  method: { kind: "skill", source: "owner/repo" },
});

const BASE_CTX = {
  tracks: ["tooling"] as const,
  options: DEFAULT_OPTIONS,
  projectDir: "/tmp/x",
};

describe("assetCliSupport — method.kind 에서 derive (하드코딩 목록 금지)", () => {
  it("plugin/shell-script 는 claude 전용, 나머지 kind 는 전 CLI", () => {
    // WHY: 도달 범위의 SSOT 는 installOne 의 실동작 — plugin 은 `claude plugin ...` spawn,
    // shell-script(ecc-prune)는 .claude/local-plugins/ write. 둘 다 구조적으로 claude 전용.
    for (const asset of EXTERNAL_ASSETS) {
      const support = assetCliSupport(asset);
      if (asset.method.kind === "plugin" || asset.method.kind === "shell-script") {
        expect(support, asset.id).toEqual(["claude"]);
      } else {
        expect(support, asset.id).toEqual([...CLI_BASES]);
      }
    }
  });

  it("전 자산의 support 는 비어 있지 않고 CLI_BASES 부분집합", () => {
    for (const asset of EXTERNAL_ASSETS) {
      const support = assetCliSupport(asset);
      expect(support.length, asset.id).toBeGreaterThan(0);
      for (const c of support) {
        expect(CLI_BASES).toContain(c);
      }
    }
  });
});

describe("runExternalInstall — CLI 도달 범위 필터 (P0 오염 경로 차단)", () => {
  it("codex 단독 설치는 claude 를 절대 spawn 하지 않는다", () => {
    // WHY: 이것이 P0 의 본체 — 사용자가 codex 만 선택했는데 claude CLI 가 실행되면
    // ~/.claude/plugins 글로벌 오염. 어떤 자산이 늘어나도 이 불변식은 유지돼야 한다.
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: ["codex"] },
      { spawn, assets: [PLUGIN_ASSET, SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const spawnedCmds = spawn.mock.calls.map((c) => c[0]);
    expect(spawnedCmds).not.toContain("claude");
  });

  it("codex 단독: plugin 자산은 시도 없이 excludedByCli 로 보고된다", () => {
    // WHY: 침묵 제외는 no-false-ship 위반 — "미설치"가 사용자에게 보여야 한다.
    const spawn = makeSpawnMock();
    const report = runExternalInstall(
      { ...BASE_CTX, cli: ["codex"] },
      { spawn, assets: [PLUGIN_ASSET, SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    expect(report.excludedByCli.map((a) => a.id)).toEqual(["plugin-claude-only"]);
    expect(report.attempted.map((r) => r.asset.id)).toEqual(["skill-cross-cli"]);
  });

  it("claude 포함 설치: plugin 자산이 정상 시도되고 제외 목록은 비어 있다", () => {
    const spawn = makeSpawnMock();
    const report = runExternalInstall(
      { ...BASE_CTX, cli: ["claude", "codex"] },
      { spawn, assets: [PLUGIN_ASSET, SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    expect(report.excludedByCli).toEqual([]);
    expect(report.attempted.map((r) => r.asset.id)).toContain("plugin-claude-only");
    expect(spawn.mock.calls.map((c) => c[0])).toContain("claude");
  });

  it("cli 미지정([])은 레거시 동작 — 필터 없이 전부 시도", () => {
    // WHY: buildSkillArgs 등 기존 코드가 cli.length===0 을 "전체" 로 해석하는 관례 유지.
    const spawn = makeSpawnMock();
    const report = runExternalInstall(
      { ...BASE_CTX, cli: [] },
      { spawn, assets: [PLUGIN_ASSET, SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    expect(report.excludedByCli).toEqual([]);
    expect(report.attempted).toHaveLength(2);
  });

  it("codex 단독에서도 skill 자산은 --agent codex 로 도달한다 (과차단 방지)", () => {
    // WHY: 필터가 과하게 넓으면 4-CLI 정직화가 "비-claude 는 아무것도 못 받음" 퇴행이 된다.
    const spawn = makeSpawnMock();
    runExternalInstall(
      { ...BASE_CTX, cli: ["codex"] },
      { spawn, assets: [SKILL_ASSET], log: () => {}, warn: () => {} },
    );
    const skillCall = spawn.mock.calls.find((c) => c[0] === "npx");
    expect(skillCall).toBeDefined();
    expect(skillCall?.[1]).toContain("--agent");
    expect(skillCall?.[1]).toContain("codex");
  });
});

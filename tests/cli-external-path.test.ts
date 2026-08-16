import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { createInstallRenderer, renderFinalSummary } from "../src/commands/install-render.js";
import { assetCliSupport, EXTERNAL_ASSETS } from "../src/external-assets.js";
import {
  type ExternalInstallerDeps,
  runExternalInstall,
  selectExternalTargets,
} from "../src/external-installer.js";
import { CLI_BASES, type CliTargets, DEFAULT_OPTIONS, type InstallSpec } from "../src/types.js";
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
  it("plugin/shell-script 는 claude 전용, 나머지 kind 는 전 CLI (entry override 예외)", () => {
    // WHY: 도달 범위의 SSOT 는 installOne 의 실동작 — plugin 은 `claude plugin ...` spawn,
    // shell-script(ecc-prune)는 .claude/local-plugins/ write. 둘 다 구조적으로 claude 전용.
    // kind 기본값이 자산에서 거짓인 경우(bmad)만 cliSupportOverride 가 우선한다.
    for (const asset of EXTERNAL_ASSETS) {
      const support = assetCliSupport(asset);
      if (asset.cliSupportOverride) {
        expect(support, asset.id).toEqual([...asset.cliSupportOverride]);
      } else if (asset.method.kind === "plugin" || asset.method.kind === "shell-script") {
        expect(support, asset.id).toEqual(["claude"]);
      } else {
        expect(support, asset.id).toEqual([...CLI_BASES]);
      }
    }
  });

  it("method 인자에 claude 특정 토큰이 박힌 자산은 광의 support 를 주장할 수 없다", () => {
    // WHY (SOD 리뷰 Critical-1): bmad 의 `--tools claude-code` 처럼 인자가 claude 전용
    // 산출물을 만들면 kind 기본값(전 CLI)이 그 자산에서 거짓 광고가 된다. 신규 자산이
    // 같은 함정에 빠지면 여기서 fail — override 기입을 강제한다.
    for (const asset of EXTERNAL_ASSETS) {
      const m = asset.method;
      const argText =
        m.kind === "npx-run" || m.kind === "shell-script" ? (m.args ?? []).join(" ") : "";
      if (/claude/i.test(argText)) {
        expect(
          assetCliSupport(asset),
          `${asset.id}: method args 에 claude 특정 토큰 — cliSupportOverride: ["claude"] 필요`,
        ).toEqual(["claude"]);
      }
    }
  });

  it("bmad-method 는 --tools claude-code 하드코딩으로 claude 전용", () => {
    const bmad = EXTERNAL_ASSETS.find((a) => a.id === "bmad-method");
    expect(bmad).toBeDefined();
    expect(assetCliSupport(bmad as (typeof EXTERNAL_ASSETS)[number])).toEqual(["claude"]);
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

describe("selectExternalTargets — 대상/배제 판정 단일 지점 (SOD 리뷰 Important-6)", () => {
  it("targets ∪ excludedByCli == 조건 통과 non-internal 자산 (분할 무손실)", () => {
    const ctx = { ...BASE_CTX, cli: ["codex"] as const };
    const { targets, excludedByCli } = selectExternalTargets([PLUGIN_ASSET, SKILL_ASSET], ctx);
    expect(targets.map((a) => a.id)).toEqual(["skill-cross-cli"]);
    expect(excludedByCli.map((a) => a.id)).toEqual(["plugin-claude-only"]);
  });

  it("runExternalInstall 의 시도 목록과 항상 일치 (헤더 카운트 정합의 구조 근거)", () => {
    // WHY: installer.ts 헤더 카운트와 실제 시도 목록이 같은 함수를 쓰는지가 정합의 전부다.
    // 두 파일이 각자 필터를 기술하면 3번째 조건 추가 시 카운트만 조용히 어긋난다.
    const ctx = { ...BASE_CTX, cli: ["codex"] as const };
    const { targets } = selectExternalTargets([PLUGIN_ASSET, SKILL_ASSET], ctx);
    const spawn = makeSpawnMock();
    const report = runExternalInstall(ctx, {
      spawn,
      assets: [PLUGIN_ASSET, SKILL_ASSET],
      log: () => {},
      warn: () => {},
    });
    expect(report.attempted.map((r) => r.asset.id)).toEqual(targets.map((a) => a.id));
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

describe("배제 고지 렌더 — 침묵 제외 금지의 실행 증거 (SOD 리뷰 F5: 커버리지 0 이던 표면)", () => {
  const mkSpec = (cli: CliTargets): InstallSpec => ({
    tracks: ["tooling"],
    options: DEFAULT_OPTIONS,
    cli,
    projectDir: "/tmp/x",
  });

  const emptyExternal = { attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] };

  it("codex 단독: 배제 자산이 'not installed — requires claude' 로 사용자에게 고지된다", () => {
    const lines: string[] = [];
    const r = createInstallRenderer((m) => lines.push(m), mkSpec(["codex"]), false);
    r.callbacks.onProgress?.({
      type: "external-complete",
      report: { ...emptyExternal, excludedByCli: [PLUGIN_ASSET] },
    });
    const out = lines.join("\n");
    expect(out).toContain("not installed");
    expect(out).toContain("requires claude");
    expect(out).toContain("plugin-claude-only");
    // F8: attempted=0 이라 phase-2 헤더가 없던 경우에도 고지가 고아로 떠돌지 않는다.
    expect(out).toContain("External assets (0)");
    expect(r.phase2HeaderPrinted()).toBe(true);
  });

  it("배제 0 이면 고지 없음 (claude 포함 설치의 출력 불변)", () => {
    const lines: string[] = [];
    const r = createInstallRenderer((m) => lines.push(m), mkSpec(["claude"]), false);
    r.callbacks.onProgress?.({ type: "external-complete", report: emptyExternal });
    expect(lines.join("\n")).not.toContain("not installed");
  });

  it("Summary EXCLUDED 행이 excludedByCli 에서 derive 된다 (구 NOTE 대체, F4)", () => {
    const lines: string[] = [];
    renderFinalSummary(
      (m) => lines.push(m),
      mkSpec(["codex"]),
      {
        filesCopied: 1,
        dirsCopied: 1,
        skipped: 0,
        baselineExcluded: [],
        baselineExcludedOnDisk: [],
        backup: null,
        installedTracks: ["tooling"],
        mcpServers: [],
        codex: null,
        codexOptIn: null,
        opencode: null,
        antigravity: null,
        ciScaffold: null,
        external: { ...emptyExternal, excludedByCli: [PLUGIN_ASSET] },
        updateMode: null,
        staleHookRefs: [],
        mode: "fresh",
        envFiles: {
          envExampleCreated: false,
          gitignoreEnvAdded: false,
          gitignoreNpxSkillsAdded: [],
        },
      },
      false,
    );
    const out = lines.join("\n");
    expect(out).toContain("EXCLUDED");
    expect(out).toContain("plugin-claude-only");
    // 구 NOTE 의 어휘("Claude Code-only")는 사라져야 한다 — 이중 고지·숫자 불일치의 원천.
    expect(out).not.toContain("Claude Code-only");
  });

  it("ecc 힌트: codex 단독에선 no-op 명령('--with ecc-plugin') 안내를 하지 않는다 (F2)", () => {
    const baseline = {
      filesCopied: 1,
      dirsCopied: 1,
      skipped: 0,
      baselineExcluded: [],
      baselineExcludedOnDisk: [],
      backup: null,
      backups: [],
      categories: { rules: ["a.md"], agents: [], hooks: [], commands: 0, skills: [] },
      installedTracks: ["tooling"],
      mcpServers: [],
      codex: null,
      codexOptIn: null,
      opencode: null,
      antigravity: null,
      ciScaffold: null,
      updateMode: null,
      mode: "fresh" as const,
      envFiles: {
        envExampleCreated: false,
        gitignoreEnvAdded: false,
        gitignoreNpxSkillsAdded: [],
      },
      rootClaudeMd: null,
    };
    const render = (cli: CliTargets): string => {
      const lines: string[] = [];
      const r = createInstallRenderer((m) => lines.push(m), mkSpec(cli), false);
      r.callbacks.onProgress?.({ type: "baseline-complete", baseline });
      return lines.join("\n");
    };
    expect(render(["claude"])).toContain("Use --with ecc-plugin");
    expect(render(["codex"])).not.toContain("Use --with ecc-plugin");
    // fallback 상태 자체는 양쪽 다 진실이므로 유지된다.
    expect(render(["codex"])).toContain("cherry-pick fallback active");
  });
});

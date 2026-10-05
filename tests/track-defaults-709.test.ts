/**
 * #709 (ADR-101) — 트랙 기본값 정리와 기존 설치 보호.
 *
 * - 새 설치: `ssr-nextjs` 는 Railway MCP 를 깔지 않고(고를 수는 있다 — `--with railway-mcp-server`), `data` · `tooling` 은
 *   `frontend-design` 을 미리 체크하지 않는다(트랙 매트릭스 · 카탈로그는 `installer-track-matrix` · `external-assets` 가 잰다).
 * - 기존 설치: 기록이 하네스 몫으로 적은 railway 서버는 트랙 표에서 빠져도 update · 재설치 · CLI 추가에서 사라지지 않는다.
 *   기록된 `frontend-design` 은 update 가 계속 갱신한다. 명시한 빼기는 어느 꼴(자산 id · 키 id)이든 지킨다(ADR-099).
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adapterExcluded, renderHarnessMcp } from "../src/cli-transforms.js";
import { refreshExternalSkills } from "../src/external-installer.js";
import { type InstallLog, installLogPath, readInstallLog } from "../src/install-log.js";
import type { SharedWrite } from "../src/install-writes.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import { computeUserOverride, initialTargetSelection } from "../src/interactive.js";
import { withoutAccepts } from "../src/key-ids.js";
import { recommendedExternalAssets } from "../src/preset-recommend.js";
import { type CliTargets, DEFAULT_OPTIONS, type InstallSpec, type Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const RAILWAY = "railway-mcp-server";
const RAILWAY_KEY = `mcp:${RAILWAY}`;

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-709-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

/* ─── 도우미 ─────────────────────────────────────────────────────────────── */

const CLIS: CliTargets = ["claude", "codex", "opencode"];

function install(
  tracks: Track[],
  over: Partial<InstallSpec> = {},
  mode: "install" | "update" = "install",
): InstallReport {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: { tracks, options: { ...DEFAULT_OPTIONS }, cli: CLIS, projectDir, ...over },
    ...(mode === "update" ? { mode } : {}),
  });
}

const withRailway = { userOverride: { forceInclude: [RAILWAY], forceExclude: [] } };
const withoutRailway = { userOverride: { forceInclude: [], forceExclude: [RAILWAY] } };

/** 세 자리(`.mcp.json` · Codex · OpenCode)에서 railway 서버가 보이나. */
function railwayIn(): { mcp: boolean; codex: boolean; opencode: boolean } {
  const mcp = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
    mcpServers: Record<string, unknown>;
  };
  const opencode = JSON.parse(readFileSync(join(projectDir, "opencode.json"), "utf8")) as {
    mcp?: Record<string, unknown>;
  };
  const toml = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
  return {
    mcp: RAILWAY in mcp.mcpServers,
    codex: toml.includes(`[mcp_servers.${RAILWAY}]`),
    opencode: RAILWAY in (opencode.mcp ?? {}),
  };
}
const EVERYWHERE = { mcp: true, codex: true, opencode: true };
const NOWHERE = { mcp: false, codex: false, opencode: false };

function log(): InstallLog {
  const l = readInstallLog(projectDir);
  if (!l) throw new Error("install log missing");
  return l;
}

/** 기록을 고쳐 쓴다 — "옛 판이 남긴 기록" 을 만드는 데만 쓴다(디스크 파일은 그대로). */
function rewriteLog(edit: (l: InstallLog) => InstallLog): void {
  writeFileSync(installLogPath(projectDir), JSON.stringify(edit(log())), "utf8");
}

const railwayPortion = (l: InstallLog) =>
  (l.portions ?? []).some((p) => p.path === ".mcp.json" && p.key === `mcpServers.${RAILWAY}`);

function mcpWrite(report: { shared?: ReadonlyArray<SharedWrite> }): SharedWrite | undefined {
  return report.shared?.find((w) => w.path === ".mcp.json");
}

function updateMcpWrite(report: InstallReport): SharedWrite | undefined {
  return report.updateMode?.sharedWrites?.find((w) => w.path === ".mcp.json");
}

const render = (choice: Parameters<typeof renderHarnessMcp>[1]): string[] =>
  Object.keys(renderHarnessMcp(HARNESS_ROOT, choice).mcpServers);

/* ─── T4 — 렌더 규칙(기본 행 ∪ 선택된 행) ─────────────────────────────────── */

describe("T4 — 하네스 MCP 렌더 = 트랙 기본 행 ∪ 선택된 행", () => {
  const spec = (tracks: Track[], forceInclude: string[] = []) => ({
    tracks,
    options: DEFAULT_OPTIONS,
    ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
  });
  const recorded = {
    portions: [{ path: ".mcp.json", key: `mcpServers.${RAILWAY}` }],
  } as unknown as InstallLog;

  it("ssr-nextjs 는 기본으로 railway 를 내지 않는다 — 대조군 csr-fastapi 는 낸다", () => {
    const none = { excluded: new Set<string>(), previousLog: null };
    expect(render({ spec: spec(["ssr-nextjs"]), ...none })).not.toContain(RAILWAY);
    expect(render({ spec: spec(["csr-fastapi"]), ...none })).toContain(RAILWAY);
  });

  it("고르면(--with · 위저드 체크) 어느 트랙에서든 낸다 · 기록된 몫이어도 낸다", () => {
    expect(
      render({ spec: spec(["ssr-nextjs"], [RAILWAY]), excluded: new Set(), previousLog: null }),
    ).toContain(RAILWAY);
    expect(
      render({ spec: spec(["tooling"]), excluded: new Set(), previousLog: recorded }),
    ).toContain(RAILWAY);
  });

  it("명시한 빼기는 어느 꼴이든 이긴다 — 자산 id · 키 id(기록이 있어도 · 골라도)", () => {
    for (const out of [RAILWAY, RAILWAY_KEY]) {
      expect(
        render({
          spec: spec(["ssr-nextjs"], [RAILWAY]),
          excluded: new Set([out]),
          previousLog: recorded,
        }),
        out,
      ).not.toContain(RAILWAY);
    }
  });

  it("어댑터 빼기 집합: 자산 id 로 뺀 선택 서버에 키 id 를 더한다 — 다른 id 에는 키를 지어내지 않는다", () => {
    expect([...adapterExcluded(HARNESS_ROOT, new Set([RAILWAY]))].sort()).toEqual(
      [RAILWAY, RAILWAY_KEY].sort(),
    );
    expect([...adapterExcluded(HARNESS_ROOT, new Set(["north-star"]))]).toEqual(["north-star"]);
  });
});

/* ─── T5 — 새 설치에서 고르기 ─────────────────────────────────────────────── */

describe("T5 — ssr-nextjs 새 설치: railway 는 안 깔리고, --with 로 세 자리에 깔린다", () => {
  it("플래그 없음 → 세 자리 어디에도 없다", () => {
    install(["ssr-nextjs"]);
    expect(railwayIn()).toEqual(NOWHERE);
    expect(railwayPortion(log())).toBe(false);
  });

  // tooling 은 railway 가 어느 판에서도 기본이 아니었던 트랙이다 — 고르는 경로만 재는 대조
  for (const track of ["ssr-nextjs", "tooling"] as const) {
    it(`${track} --with railway-mcp-server → .mcp.json · Codex · OpenCode 에 들어가고 몫으로 기록된다(외부 자산 기록엔 없다)`, () => {
      install([track], withRailway);
      expect(railwayIn()).toEqual(EVERYWHERE);
      const l = log();
      expect(railwayPortion(l)).toBe(true);
      expect(l.assets.map((a) => a.id)).not.toContain(RAILWAY);
      expect(l.excluded ?? []).toEqual([]);
    });
  }
});

/* ─── T6 — 기록된 선택 행은 update 가 지키지 않으면 지워진다 ──────────────── */

describe("T6 — 기록된 railway 몫은 트랙 표 밖이어도 update 뒤 남는다", () => {
  // 옛 판이 남긴 상태를 만든다: railway 가 기본이던 트랙으로 깔고(몫 기록 · 세 자리 파일) 기록의 트랙만 바꾼다. claude 는 빼고
  // 깐다 — claude 설치본은 `.claude/.installed-tracks` 로 기록 트랙을 되살려(#585 track-heal) 바꾼 트랙이 먹지 않는다.
  // `.mcp.json` 은 CLI 와 무관하게 쓴다.
  const noClaude = { cli: ["codex", "opencode"] as CliTargets };
  for (const recordTrack of ["ssr-nextjs", "tooling"] as const) {
    it(`기록 트랙 ${recordTrack} + 몫 기록 → update 가 세 자리 모두 그대로 두고 'retired' 로 걷지 않는다`, () => {
      install(["csr-fastapi"], noClaude);
      expect(railwayIn()).toEqual(EVERYWHERE); // 전제
      rewriteLog((l) => ({ ...l, spec: { ...l.spec, tracks: [recordTrack] } }));
      expect(railwayPortion(log())).toBe(true); // 전제
      expect(log().spec.tracks).toEqual([recordTrack]); // 전제 — 기록 트랙이 정말 바뀌었다

      const report = install([recordTrack], noClaude, "update");
      expect(railwayIn()).toEqual(EVERYWHERE);
      expect(railwayPortion(log())).toBe(true);
      // 바뀐 것이 없으면 update 는 그 파일을 화면에 올리지 않는다 — 올렸다면 railway 를 은퇴로 걷은 것이 아니어야 한다
      expect(updateMcpWrite(report)?.retired ?? []).not.toContain(RAILWAY);
      // 대조군 — 같은 파일의 템플릿 서버도 그대로다
      const servers = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")).mcpServers;
      expect(Object.keys(servers)).toContain("context7");
    });
  }

  for (const recordTrack of ["ssr-nextjs", "tooling"] as const) {
    it(`기록 트랙 ${recordTrack} — 플래그 없는 install 재실행 · CLI 추가도 기록된 railway 를 남긴다(새 CLI 자리에도 간다)`, () => {
      install(["csr-fastapi"], { cli: ["codex"] });
      rewriteLog((l) => ({ ...l, spec: { ...l.spec, tracks: [recordTrack] } }));
      install([recordTrack], { cli: ["codex"] }); // 플래그 없음
      const mcp = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")).mcpServers;
      expect(Object.keys(mcp)).toContain(RAILWAY);
      install([recordTrack], { cli: ["codex", "opencode"] }); // opencode 추가
      expect(railwayIn()).toEqual(EVERYWHERE);
    });
  }
});

/* ─── T7 — 기록된 frontend-design 은 update 가 계속 갱신한다 ───────────────── */

describe("T7 — data 설치본의 frontend-design 은 기록으로 갱신된다(트랙 조건을 다시 묻지 않는다)", () => {
  const dataLog = (excluded: string[]): InstallLog => ({
    schemaVersion: 1,
    installedAt: "2026-10-01T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["data"], cli: ["claude"], clis: ["claude"] },
    templates: {},
    assets: [
      {
        id: "frontend-design",
        category: "frontend",
        method: "skill",
        scope: "project",
        detail: {},
      },
    ],
    ...(excluded.length > 0 ? { excluded } : {}),
    excludedKeysMigrated: true,
  });
  const spawnArgs = (excluded: string[]): string => {
    const spawn = vi.fn(() => ({
      pid: 0,
      output: [],
      stdout: "",
      stderr: "",
      status: 0,
      signal: null,
    }));
    refreshExternalSkills(projectDir, {
      readLog: () => dataLog(excluded),
      spawn: spawn as never,
      log: () => {},
      warn: () => {},
    });
    return JSON.stringify(spawn.mock.calls);
  };

  it("기록에 있으면 다시 받는다 — 대조군: 뺐으면 안 받는다", () => {
    expect(spawnArgs([])).toContain("frontend-design");
    expect(spawnArgs(["frontend-design"])).not.toContain("frontend-design");
  });
});

/* ─── T8 — 빼기 ──────────────────────────────────────────────────────────── */

describe("T8 — 명시한 빼기를 지킨다", () => {
  it("ⓑ --without railway-mcp-server → 세 자리에서 걷히고, 화면은 'dropped' 로 말하고, 기록엔 자산 id 하나만 · update 가 되살리지 않는다", () => {
    install(["ssr-nextjs"], withRailway);
    expect(railwayIn()).toEqual(EVERYWHERE); // 전제
    const report = install(["ssr-nextjs"], withoutRailway);
    expect(railwayIn()).toEqual(NOWHERE);
    const w = mcpWrite(report);
    expect(w?.removedOut).toContain(RAILWAY_KEY);
    expect(w?.retired ?? []).not.toContain(RAILWAY);
    expect(log().excluded).toEqual([RAILWAY]);

    install(["ssr-nextjs"], {}, "update");
    expect(railwayIn()).toEqual(NOWHERE);
  });

  it("기본 행이 있는 트랙(csr-fastapi)에서도 --without railway-mcp-server 가 .mcp.json 에서 걷는다", () => {
    install(["csr-fastapi"]);
    install(["csr-fastapi"], withoutRailway);
    expect(railwayIn().mcp).toBe(false);
    install(["csr-fastapi"], {}, "update");
    expect(railwayIn().mcp).toBe(false);
  });

  it("ⓐ 옛 키 빼기(mcp:railway-mcp-server)가 기록된 ssr-nextjs 설치본 — update 가 되돌리지 않는다", () => {
    install(["ssr-nextjs"]);
    rewriteLog((l) => ({ ...l, excluded: [RAILWAY_KEY] }));
    const report = install(["ssr-nextjs"], {}, "update");
    expect(railwayIn().mcp).toBe(false);
    expect(updateMcpWrite(report)?.restored ?? []).not.toContain(RAILWAY_KEY);
  });
});

/* ─── T11 — 키 id 수용 집합 = 기록 ∪ 이번 선택 ─────────────────────────────── */

describe("T11 — --with/--without mcp:railway-mcp-server 는 기록이 있을 때 받는다", () => {
  const accepts = (previous: InstallLog | null, forceInclude: string[] = []) =>
    withoutAccepts(
      HARNESS_ROOT,
      {
        tracks: ["ssr-nextjs"],
        cli: ["claude"],
        ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
      },
      previous,
    )(RAILWAY_KEY);

  it("기록된 몫이 있으면 받는다 · 이번 --with 면 받는다 · 기록된 키 빼기면 받는다 — 대조군: 아무것도 없으면 모르는 키", () => {
    install(["ssr-nextjs"], withRailway);
    expect(accepts(log())).toBe(true);
    expect(accepts(null, [RAILWAY])).toBe(true);
    const keyOut = { ...log(), portions: [], excluded: [RAILWAY_KEY] } as InstallLog;
    expect(accepts(keyOut)).toBe(true);
    expect(accepts(null)).toBe(false);
  });
});

/* ─── T9ⓐ — 첫 설치 위저드 3단계 ──────────────────────────────────────────── */

describe("T9ⓐ — ssr-nextjs 첫 설치 3단계: vercel-cli 는 체크 · railway 는 미체크, 체크하면 고른 것이다", () => {
  it("초기 체크와 체크 결과", () => {
    const initial = initialTargetSelection(["ssr-nextjs"], []);
    expect(initial).toContain("asset:vercel-cli");
    expect(initial).not.toContain(`asset:${RAILWAY}`);
    const checked = [...recommendedExternalAssets(["ssr-nextjs"]), RAILWAY];
    expect(computeUserOverride(["ssr-nextjs"], checked)?.forceInclude).toEqual([RAILWAY]);
    // data · tooling 은 frontend-design 을 체크하지 않은 채 시작한다(목록에는 있다 — 카탈로그 전체가 보인다)
    for (const t of ["data", "tooling"] as const)
      expect(initialTargetSelection([t], [])).not.toContain("asset:frontend-design");
  });
});

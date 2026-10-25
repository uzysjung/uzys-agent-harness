/**
 * #751 — 남은 기본 MCP 서버 둘(context7 · supabase)도 위저드 3단계의 한 줄이다.
 *
 * - context7 은 모든 트랙에서 · supabase 는 csr-supabase · full 에서 체크된 채 시작한다(기본값 그대로 — 보이게만 한다)
 * - 이미 깔린 설치본의 update 3단계에서 둘 다 체크 · `● installed` 로 보인다(기록된 `.mcp.json` 몫)
 * - 체크를 풀면 `--without <id>` 와 같은 결과다 — 하네스 몫만 `.mcp.json` · Codex · OpenCode 에서 빠지고 설치자 서버는 남는다
 * - 새 설치 결과가 바뀌지 않는 것은 `installer-*` · `cli-mcp-source` 스위트가 서버 집합 · 값으로 잰다
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATEGORIES } from "../src/categories.js";
import { installSpecFromOptions } from "../src/commands/install.js";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import {
  computeUserOverride,
  initialTargetSelection,
  installedTargetState,
  runInteractive,
  updateInitialSelection,
} from "../src/interactive.js";
import { buildPageGroups, type InstallTargetId, type Prompts } from "../src/prompts.js";
import { excludedIds } from "../src/recorded.js";
import type { DetectedInstall } from "../src/state.js";
import {
  type CliBase,
  type CliTargets,
  DEFAULT_OPTIONS,
  TRACKS,
  type Track,
} from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const SERVERS = ["context7", "supabase"] as const;
const SUPABASE_DEFAULT: Track[] = ["csr-supabase", "full"];
const CLIS: CliBase[] = ["claude", "codex", "opencode"];
const TRACK: Track = "csr-supabase";

describe("#751 — 3단계 체크 상태는 트랙 기본값 그대로다", () => {
  it.each(TRACKS.map((t) => [t]))("%s", (track) => {
    const initial = initialTargetSelection([track as Track], []);
    expect(initial).toContain("asset:context7");
    expect(initial.includes("asset:supabase")).toBe(SUPABASE_DEFAULT.includes(track as Track));
  });

  it("tooling 에서 supabase 를 체크하면 --with supabase · csr-supabase 에서 둘을 풀면 --without 둘", () => {
    const on = initialTargetSelection(["tooling"], [])
      .filter((t) => t.startsWith("asset:"))
      .map((t) => t.slice("asset:".length));
    expect(computeUserOverride(["tooling"], [...on, "supabase"])?.forceInclude).toEqual([
      "supabase",
    ]);
    const off = initialTargetSelection([TRACK], [])
      .filter((t) => t.startsWith("asset:"))
      .map((t) => t.slice("asset:".length))
      .filter((id) => !(SERVERS as ReadonlyArray<string>).includes(id));
    expect(computeUserOverride([TRACK], off)?.forceExclude).toEqual([...SERVERS]);
  });
});

/* ─── 기존 설치본 ─────────────────────────────────────────────────────────── */

let dirs: string[] = [];
beforeEach(() => {
  dirs = [];
});
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/** 설치자 서버(`mine`)가 세 파일에 이미 있는 프로젝트에 csr-supabase 를 깐다. */
function installed(): string {
  const dir = mkdtempSync(join(tmpdir(), "wiz-751-"));
  dirs.push(dir);
  writeFileSync(
    join(dir, ".mcp.json"),
    `${JSON.stringify({ mcpServers: { mine: { command: "my-mcp", args: [] } } }, null, 2)}\n`,
  );
  writeFileSync(
    join(dir, "opencode.json"),
    `${JSON.stringify({ mcp: { mine: { type: "local", command: ["my-mcp"] } } }, null, 2)}\n`,
  );
  mkdirSync(join(dir, ".codex"), { recursive: true });
  writeFileSync(join(dir, ".codex/config.toml"), '[mcp_servers.mine]\ncommand = "my-mcp"\n');
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    runExternal: null,
    spec: { tracks: [TRACK], options: { ...DEFAULT_OPTIONS }, cli: CLIS, projectDir: dir },
  });
  return dir;
}

/** 세 파일의 MCP 서버 이름. */
function servers(dir: string): { mcp: string[]; codex: string[]; opencode: string[] } {
  const mcp = JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")) as {
    mcpServers: Record<string, unknown>;
  };
  const oc = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf8")) as {
    mcp?: Record<string, unknown>;
  };
  const toml = readFileSync(join(dir, ".codex/config.toml"), "utf8");
  return {
    mcp: Object.keys(mcp.mcpServers).sort(),
    codex: [...toml.matchAll(/^\[mcp_servers\.([^\]]+)\]$/gm)].map((m) => m[1] ?? "").sort(),
    opencode: Object.keys(oc.mcp ?? {}).sort(),
  };
}

const MCP_FILES = [".mcp.json", ".codex/config.toml", "opencode.json"];
/** 세 파일 내용 — Codex 설정에 박히는 프로젝트 경로 · 이름만 지운다(두 프로젝트를 맞대려고). */
const read = (dir: string) =>
  MCP_FILES.map((f) =>
    readFileSync(join(dir, f), "utf8").split(dir).join("<DIR>").split(basename(dir)).join("<NAME>"),
  );

const prompts = (over: Partial<Prompts>): Prompts => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  selectAction: vi.fn(async () => "update" as const),
  selectTracks: vi.fn(async (initial?: Track[]) => initial ?? [TRACK]),
  selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
  confirmInstall: vi.fn(async () => true),
  selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
  ...over,
});
const detect = (projectDir: string): DetectedInstall => ({
  state: "installed",
  tracks: [TRACK],
  log: readInstallLog(projectDir),
  hasClaudeDir: true,
  traces: [],
});

describe("#751 — 깔린 context7 · supabase 는 update 3단계에 체크 · installed 로 보인다", () => {
  it("installed 상태 · 초기 체크 · `● installed` 마커", () => {
    const dir = installed();
    for (const s of SERVERS) {
      // 전제 — 기본 설치가 세 파일에 깔았다
      expect(servers(dir).mcp).toContain(s);
      expect(servers(dir).codex).toContain(s);
      expect(servers(dir).opencode).toContain(s);
    }
    const state = installedTargetState(dir);
    const initial = updateInitialSelection([TRACK], state.projectScoped, readInstallLog(dir));
    const { flatItems } = buildPageGroups(
      CATEGORIES,
      new Set(initial),
      new Set(state.installed.map((id) => `asset:${id}`)),
    );
    for (const s of SERVERS) {
      expect(state.installed).toContain(s);
      expect(initial).toContain(`asset:${s}`);
      expect(flatItems.find((i) => i.value === `asset:${s}`)?.label).toContain("● installed");
    }
  });

  it("그대로 두면 refresh(update) 다", async () => {
    const dir = installed();
    const result = await runInteractive(dir, { prompts: prompts({}), detect, isTty: () => true });
    expect(result.mode).toBe("update");
  });

  it("둘의 체크를 풀면 `install --without context7 --without supabase` 와 같은 세 파일 — 설치자 서버는 남는다", async () => {
    const wizardDir = installed();
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(wizardDir, {
      prompts: prompts({
        selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) =>
          initial.filter((t) => !SERVERS.some((s) => t === `asset:${s}`)),
        ),
        confirmInstall,
      }),
      detect,
      isTty: () => true,
    });
    expect(result.mode).toBe("add");
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    for (const s of SERVERS) expect(summary).toContain(`--without ${s}`);
    if (!result.spec) throw new Error("spec 이 없다");
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: wizardDir,
      runExternal: null,
      spec: result.spec,
      mode: "add",
    });

    const flagDir = installed();
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: flagDir,
      runExternal: null,
      spec: installSpecFromOptions(
        { track: [TRACK], cli: CLIS, without: [...SERVERS], projectDir: flagDir },
        CLIS,
        () => {},
        HARNESS_ROOT,
      ),
    });

    const after = servers(wizardDir);
    for (const s of SERVERS) {
      expect(after.mcp).not.toContain(s);
      expect(after.codex).not.toContain(s);
      expect(after.opencode).not.toContain(s);
    }
    expect(after.mcp).toContain("mine");
    expect(after.codex).toContain("mine");
    expect(after.opencode).toContain("mine");
    // 대조군 — 빼지 않은 하네스 서버는 남는다
    expect(after.mcp).toContain("railway-mcp-server");
    expect(read(wizardDir)).toEqual(read(flagDir));
  });
});

/**
 * #908 — 뺀 서버를 3단계에서 다시 체크하면 깔린다. 빼기는 두 형태로 기록된다: 자산 id(`--without railway-mcp-server`) ·
 * 키 id(`--without mcp:railway-mcp-server`). 위저드는 3단계에 자산 id 로만 체크를 받으므로, 기록의 키 id 도 자산 id 로
 * 풀어 대조해야 다시 체크한 서버가 무시되지 않는다(`classifyUpdateIntent` · `unchecked`).
 */
describe("#908 — 뺀 MCP 서버를 위저드 3단계에서 다시 체크하면 깔린다", () => {
  const RAILWAY = "railway-mcp-server";
  const FORMS = [
    ["키 id", `mcp:${RAILWAY}`],
    ["자산 id", RAILWAY],
  ] as const;
  /** [CLI 를 그대로 둔다 · CLI(codex)를 더한다] */
  const CLI_CASES = [
    ["CLI 유지", false],
    ["CLI 추가", true],
  ] as const;

  /** csr-supabase(claude)를 `--without <without>` 으로 깐다 — railway 는 트랙 기본이라 빼지 않으면 깔린다. */
  function installedWithout(without: string): string {
    const dir = mkdtempSync(join(tmpdir(), "wiz-908-"));
    dirs.push(dir);
    const warnings: string[] = [];
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      runExternal: null,
      spec: installSpecFromOptions(
        { track: [TRACK], cli: ["claude"], without: [without], projectDir: dir },
        ["claude"],
        (m) => warnings.push(m),
        HARNESS_ROOT,
      ),
    });
    expect(warnings, "빼기 id 가 받아들여져야 한다 — 경고가 나면 전제가 틀렸다").toEqual([]);
    // 전제 — 뺀 서버는 안 깔렸고, 빼기는 입력한 형태 그대로 기록됐다
    expect(mcpServers(dir)).not.toContain(RAILWAY);
    expect([...excludedIds(readInstallLog(dir))]).toContain(without);
    return dir;
  }
  const mcpServers = (dir: string): string[] =>
    Object.keys(
      (JSON.parse(readFileSync(join(dir, ".mcp.json"), "utf8")) as { mcpServers: object })
        .mcpServers,
    );

  /** 위저드를 한 번 돈다 — 3단계에서 railway 를 다시 체크하거나 두고, CLI 를 더하거나 둔다. */
  async function wizard(dir: string, o: { recheck: boolean; addCodex: boolean }) {
    let initialTargets: ReadonlyArray<InstallTargetId> = [];
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(dir, {
      prompts: prompts({
        selectCli: vi.fn(async (initial?: CliTargets): Promise<CliTargets> => {
          const base: CliTargets = initial ?? ["claude"];
          return o.addCodex ? [...base, "codex"] : base;
        }),
        selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => {
          initialTargets = initial;
          return o.recheck ? [...initial, `asset:${RAILWAY}` as const] : initial;
        }),
        confirmInstall,
      }),
      detect,
      isTty: () => true,
    });
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    // 전제 — 3단계는 뺀 서버를 해제된 채로 보인다(그래서 다시 체크가 의미 있다)
    expect(initialTargets).not.toContain(`asset:${RAILWAY}`);
    return { result, summary };
  }
  /** 확인 화면 `RUNS AS` 의 `--without` 값들. */
  const withoutOf = (summary: string): string[] =>
    [
      ...(summary.split("\n").find((l) => l.includes("RUNS AS")) ?? "").matchAll(
        /--without (\S+)/g,
      ),
    ].map((m) => m[1] ?? "");
  const selectedCount = (summary: string): number =>
    Number(/Assets:\s+(\d+) selected/.exec(summary)?.[1] ?? Number.NaN);
  const runAdd = (dir: string, result: Awaited<ReturnType<typeof wizard>>["result"]): void => {
    if (!result.spec) throw new Error("spec 이 없다");
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      runExternal: null,
      spec: result.spec,
      mode: "add",
    });
  };

  describe.each(FORMS)("%s 로 뺀 기록", (_label, without) => {
    it.each(
      CLI_CASES,
    )("%s — 다시 체크하면 add 이고 설치 뒤 서버가 깔리고 기록의 빼기가 풀린다", async (_c, addCodex) => {
      const dir = installedWithout(without);
      const { result, summary } = await wizard(dir, { recheck: true, addCodex });
      expect(result.mode).toBe("add");
      expect(withoutOf(summary)).not.toContain(without);
      runAdd(dir, result);
      expect(mcpServers(dir)).toContain(RAILWAY);
      expect([...excludedIds(readInstallLog(dir))]).not.toContain(without);
    });

    it("CLI 유지 · 다시 체크하지 않으면 refresh(update) 그대로다", async () => {
      const dir = installedWithout(without);
      const { result } = await wizard(dir, { recheck: false, addCodex: false });
      expect(result.mode).toBe("update");
    });

    it("CLI 추가 · 다시 체크하지 않으면 그 빼기를 이어 가고 서버는 안 깔린다", async () => {
      const dir = installedWithout(without);
      const { result, summary } = await wizard(dir, { recheck: false, addCodex: true });
      expect(result.mode).toBe("add");
      expect(withoutOf(summary)).toContain(without);
      runAdd(dir, result);
      expect(mcpServers(dir)).not.toContain(RAILWAY);
      expect([...excludedIds(readInstallLog(dir))]).toContain(without);
    });
  });

  it.each(
    FORMS,
  )("%s — 확인 화면의 수가 다시 체크한 서버를 센다(뺀 채 두면 하나 적다)", async (_label, without) => {
    const kept = await wizard(installedWithout(without), { recheck: false, addCodex: true });
    const rechecked = await wizard(installedWithout(without), { recheck: true, addCodex: true });
    expect(selectedCount(rechecked.summary)).toBe(selectedCount(kept.summary) + 1);
  });

  it("다시 체크한 서버만 풀린다 — 같은 키 형태로 뺀 다른 서버는 계속 빠진다", async () => {
    const dir = installedWithout(`mcp:${RAILWAY}`);
    // 두 번째 서버도 키 id 로 뺀 기록을 만든다(CLI 추가로 다시 설치)
    runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir: dir,
      runExternal: null,
      spec: installSpecFromOptions(
        {
          track: [TRACK],
          cli: ["claude"],
          without: [`mcp:${RAILWAY}`, "mcp:supabase"],
          projectDir: dir,
        },
        ["claude"],
        () => {},
        HARNESS_ROOT,
      ),
    });
    expect(mcpServers(dir)).not.toContain("supabase");
    const { result, summary } = await wizard(dir, { recheck: true, addCodex: false });
    expect(result.mode).toBe("add");
    expect(withoutOf(summary).filter((id) => id.startsWith("mcp:"))).toEqual(["mcp:supabase"]);
    runAdd(dir, result);
    expect(mcpServers(dir)).toContain(RAILWAY);
    expect(mcpServers(dir)).not.toContain("supabase");
    const recordedOut = [...excludedIds(readInstallLog(dir))];
    expect(recordedOut).toContain("mcp:supabase");
    expect(recordedOut).not.toContain(`mcp:${RAILWAY}`);
  });
});

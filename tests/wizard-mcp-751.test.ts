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

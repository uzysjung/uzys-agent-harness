/**
 * #722 · #712 · #711 (ADR-106) — 기존 설치본이 update 뒤 받는 MCP 서버와 화면.
 *
 * 옛 상태는 **옛 판의 템플릿으로 실제로 깔아서** 만든다(손으로 적은 기록이 아니다): 하네스 루트를 패키지 산출물로 새로 만들고
 * `templates/mcp.json` · `templates/track-mcp-map.tsv` 만 그 판의 내용으로 되돌린다. 그 위에서 이 판(저장소 루트)으로 update 한다.
 *
 * 무는 것(설계 `docs/plans/v26.167.0-mcp-design.md` §7.2 · 설계 검증 B1 · B2 · B3):
 *   A  기록 있는 설치본 — 옛 github 는 걷히고 화면이 까닭과 대안을 말한다 · chrome-devtools · railway 는 남고 새 값으로 갈아 끼운다
 *   B  설치자가 고친 옛 github — 남긴다(kept yours) · 새 github-mcp 는 어디에도 안 생긴다
 *   C  옛 로그(몫 기록 전) — 같은 디스크가 A 와 같은 결과를 받는다(B1 ⓐ)
 *   C' 옛 로그 · ssr-nextjs 의 옛 railway(#710 전 기본) — 걷히지 않고 원격으로 갈아 끼운다(B1 ⓓ)
 *   B2 update 화면이 원격 서버 첫 사용 로그인 안내(NEXT)를 낸다
 *   B3 비웹 트랙에 기록으로 남은 chrome-devtools — "이 트랙의 기본이 아니다 · 빼는 명령" 을 말한다
 *   E  `--without mcp:github` 은 이제 모르는 키 id 다
 *   F · N9 기록된 빼기(자산 id · 키 id)는 세 자리 모두에서 지킨다
 */

import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createInstallRenderer,
  renderFinalSummary,
  renderUpdateSummary,
} from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { type InstallLog, installLogPath, readInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import { renderedKeyIds, withoutAccepts } from "../src/key-ids.js";
import {
  type CliBase,
  DEFAULT_OPTIONS,
  type InstallSpec,
  TRACKS,
  type Track,
} from "../src/types.js";

const REPO_ROOT = resolve(__dirname, "..");

/** v26.166.0 의 `templates/mcp.json` — 모든 트랙에 github · chrome-devtools(통계 켬). */
const OLD_MCP_JSON = JSON.stringify({
  mcpServers: {
    context7: { type: "stdio", command: "npx", args: ["-y", "@upstash/context7-mcp@latest"] },
    github: { type: "stdio", command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] },
    "chrome-devtools": {
      type: "stdio",
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest"],
    },
  },
});
/** v26.166.0 의 트랙 표 — railway 는 stdio(`@railway/mcp-server`). */
const OLD_TSV_166 = [
  'railway-mcp-server\tcsr-supabase|csr-fastify|csr-fastapi|ssr-htmx|full\tnpx\t["-y", "@railway/mcp-server"]',
  'supabase\tcsr-supabase|full\tnpx\t["-y", "@supabase/mcp-server"]',
].join("\n");
/** #710 전(v26.164 이하) — railway 가 ssr-nextjs 에서도 기본이었다. */
const OLD_TSV_164 = [
  'railway-mcp-server\tcsr-supabase|csr-fastify|csr-fastapi|ssr-htmx|ssr-nextjs|full\tnpx\t["-y", "@railway/mcp-server"]',
  'supabase\tcsr-supabase|full\tnpx\t["-y", "@supabase/mcp-server"]',
].join("\n");

const roots: string[] = [];
let OLD_ROOT_166: string;
let OLD_ROOT_164: string;

/** npm pack 이 싣는 것만으로 하네스 루트를 만들고 MCP 원천 두 파일만 그 판의 것으로 되돌린다. */
function oldHarnessRoot(tsv: string): string {
  const root = mkdtempSync(join(tmpdir(), "ah-167-oldroot-"));
  roots.push(root);
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    files: string[];
  };
  for (const entry of [...pkg.files, "package.json"]) {
    const src = join(REPO_ROOT, entry);
    if (existsSync(src)) cpSync(src, join(root, entry), { recursive: true });
  }
  writeFileSync(join(root, "templates/mcp.json"), OLD_MCP_JSON);
  writeFileSync(join(root, "templates/track-mcp-map.tsv"), `${tsv}\n`);
  return root;
}

beforeAll(() => {
  OLD_ROOT_166 = oldHarnessRoot(OLD_TSV_166);
  OLD_ROOT_164 = oldHarnessRoot(OLD_TSV_164);
});
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-167-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const ALL: CliBase[] = ["claude", "codex", "opencode"];

function spec(tracks: Track[], cli: CliBase[] = ALL, over: Partial<InstallSpec> = {}): InstallSpec {
  return { tracks, options: { ...DEFAULT_OPTIONS }, cli, projectDir, ...over };
}

/** 옛 판으로 깐다 — 그 판의 기록(writer) · 세 파일이 남는다. */
function oldInstall(
  tracks: Track[],
  cli: CliBase[] = ALL,
  over: Partial<InstallSpec> = {},
  root = OLD_ROOT_166,
): void {
  runInstall({ runExternal: null, harnessRoot: root, projectDir, spec: spec(tracks, cli, over) });
}

const strip = (s: string): string =>
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  s.replace(/\x1b\[[0-9;]*m/g, "");

/** 이 판으로 update — 보고 · 진행 화면 · 요약(NEXT 포함). */
function update(): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const s = spec(["tooling"]);
  const renderer = createInstallRenderer((m) => lines.push(m), s, false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: REPO_ROOT,
    projectDir,
    spec: s,
    mode: "update",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  renderUpdateSummary((m) => lines.push(m), s, report);
  return { report, screen: strip(lines.join("\n")) };
}

const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const mcpJson = (): Record<string, Record<string, unknown>> =>
  (JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, Record<string, unknown>> })
    .mcpServers;
const opencodeMcp = (): Record<string, Record<string, unknown>> =>
  (JSON.parse(read("opencode.json")) as { mcp: Record<string, Record<string, unknown>> }).mcp;
const codexToml = (): string => read(".codex/config.toml");

function log(): InstallLog {
  const l = readInstallLog(projectDir);
  if (!l) throw new Error("install log missing");
  return l;
}

/** 몫 기록 전의 옛 로그(v26.161 이하) 모양으로 — `records` · `portions` 를 지운다(나머지 기록은 그대로). */
function toLegacyLog(): void {
  const { records: _r, portions: _p, ...rest } = log();
  writeFileSync(installLogPath(projectDir), JSON.stringify(rest), "utf8");
}

const CHROME_NOW = {
  type: "stdio",
  command: "npx",
  args: ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"],
};
const RAILWAY_NOW = { type: "http", url: "https://mcp.railway.com" };

describe("A — 기록 있는 설치본(v26.162+)을 update", () => {
  it("csr-fastapi: 옛 github 는 세 자리에서 걷히고 · chrome-devtools(통계 끔) · railway(원격)로 갈아 끼우며 화면이 그대로 말한다", () => {
    oldInstall(["csr-fastapi"]);
    expect(mcpJson().github).toBeDefined(); // 전제 — 옛 판이 깔았다
    expect(opencodeMcp().github).toBeDefined();
    expect(codexToml()).toContain("[mcp_servers.github]");

    const { screen } = update();

    expect(mcpJson().github).toBeUndefined();
    expect(opencodeMcp().github).toBeUndefined();
    expect(codexToml()).not.toContain("[mcp_servers.github]");
    expect(mcpJson()["chrome-devtools"]).toEqual(CHROME_NOW);
    expect(mcpJson()["railway-mcp-server"]).toEqual(RAILWAY_NOW);
    expect(opencodeMcp()["railway-mcp-server"]).toEqual({
      type: "remote",
      url: "https://mcp.railway.com",
    });
    expect(codexToml()).toContain(
      '[mcp_servers.railway-mcp-server]\nurl = "https://mcp.railway.com"',
    );
    // 새 github-mcp 는 고르지 않았으니 어디에도 없다
    expect(mcpJson()["github-mcp"]).toBeUndefined();
    expect((log().portions ?? []).some((p) => p.key === "mcpServers.github")).toBe(false);
    // 화면 — 걷은 것 · 갈아 끼운 것을 이름과 까닭으로
    expect(screen).toContain(
      "retired: github — the old @modelcontextprotocol/server-github is deprecated upstream and ran without a token",
    );
    expect(screen).toContain("agent-harness install … --with github-mcp (needs GITHUB_PAT)");
    expect(screen).toContain("chrome-devtools (usage statistics off)");
    expect(screen).toContain(
      "railway-mcp-server (now Railway's remote server — sign in on first use, see NEXT)",
    );
    // 웹 트랙의 chrome 은 기본이다 — "기본이 아니다" 를 말하지 않는다
    expect(screen).not.toContain("not a default on");
    // B2 — update 요약의 NEXT 가 원격 서버 로그인 안내를 낸다(깔린 CLI 것만)
    expect(screen).toContain("Remote MCP servers sign in on first use — railway-mcp-server");
    expect(screen).toContain("codex mcp login railway-mcp-server");
    expect(screen).toContain("opencode mcp auth railway-mcp-server");
    expect(screen).toContain("claude mcp login railway-mcp-server");
  });

  it("B2 — 아무것도 바뀌지 않은 두 번째 update 는 로그인 안내를 다시 내지 않는다", () => {
    oldInstall(["csr-fastapi"]);
    update();
    const { screen } = update();
    expect(screen).not.toContain("sign in on first use");
  });

  it("B3 — tooling: 기록으로 남은 chrome-devtools 는 남기고 갈아 끼우며 '이 트랙의 기본이 아니다 · 빼는 명령' 을 말한다", () => {
    oldInstall(["tooling"]);
    const { screen } = update();
    expect(mcpJson()["chrome-devtools"]).toEqual(CHROME_NOW);
    expect(opencodeMcp()["chrome-devtools"]).toEqual({
      type: "local",
      command: ["npx", ...CHROME_NOW.args],
    });
    expect(screen).toContain(
      "chrome-devtools (usage statistics off; not a default on tooling — kept because your install record has it; drop it: agent-harness install … --without chrome-devtools)",
    );
    // 원격 서버를 바꾸지 않았다 — 로그인 안내 없음
    expect(screen).not.toContain("sign in on first use");
  });
});

describe("B — 설치자가 옛 github 항목을 고친 설치본", () => {
  it("고친 github 는 남기고 kept yours 로 말한다 · 새 github-mcp 는 세 자리 어디에도 생기지 않는다", () => {
    oldInstall(["tooling"]);
    const raw = JSON.parse(read(".mcp.json")) as {
      mcpServers: Record<string, Record<string, unknown>>;
    };
    raw.mcpServers.github = {
      ...raw.mcpServers.github,
      env: { GITHUB_PERSONAL_ACCESS_TOKEN: "x" },
    };
    writeFileSync(join(projectDir, ".mcp.json"), JSON.stringify(raw, null, 2));

    const { screen } = update();

    expect(mcpJson().github?.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: "x" });
    expect(screen).toContain("kept yours: github");
    expect(screen).not.toContain("retired: github");
    expect(mcpJson()["github-mcp"]).toBeUndefined();
    expect(opencodeMcp()["github-mcp"]).toBeUndefined();
    expect(codexToml()).not.toContain("github-mcp");
  });
});

describe("C — 옛 로그(몫 기록 전)는 같은 디스크에서 A 와 같은 결과를 받는다 (설계 검증 B1 ⓐ)", () => {
  it("tooling · claude: github 는 옛 값 그대로라 걷고 · chrome 은 남겨 갈아 끼운다 — 기록 있는 설치본과 `.mcp.json` 이 같다", () => {
    // 대조군 — 기록 있는 설치본
    oldInstall(["tooling"], ["claude"]);
    update();
    const withRecord = mcpJson();
    rmSync(projectDir, { recursive: true, force: true });
    projectDir = mkdtempSync(join(tmpdir(), "ah-167-"));

    oldInstall(["tooling"], ["claude"]);
    toLegacyLog();
    expect(log().records).toBeUndefined(); // 전제 — 옛 로그다
    const { screen } = update();

    expect(mcpJson()).toEqual(withRecord);
    expect(mcpJson().github).toBeUndefined();
    expect(mcpJson()["chrome-devtools"]).toEqual(CHROME_NOW);
    expect(screen).toContain("retired: github — the old @modelcontextprotocol/server-github");
    expect(screen).toContain("chrome-devtools (usage statistics off; not a default on tooling");
    expect(screen).not.toContain("kept yours");
  });

  it("C' — ssr-nextjs 옛 로그의 railway(#710 전 기본)는 걷히지 않고 원격으로 갈아 끼운다 — Codex · OpenCode 도 같다", () => {
    oldInstall(["ssr-nextjs"], ALL, {}, OLD_ROOT_164);
    expect(mcpJson()["railway-mcp-server"]).toBeDefined(); // 전제 — 그때는 기본이었다
    toLegacyLog();

    const { screen } = update();

    expect(mcpJson()["railway-mcp-server"]).toEqual(RAILWAY_NOW);
    expect(opencodeMcp()["railway-mcp-server"]).toEqual({
      type: "remote",
      url: "https://mcp.railway.com",
    });
    expect(codexToml()).toContain(
      '[mcp_servers.railway-mcp-server]\nurl = "https://mcp.railway.com"',
    );
    expect(screen).not.toContain("retired: railway-mcp-server");
    expect(screen).toContain("not a default on ssr-nextjs");
  });

  it("옛 로그라도 설치자가 만든 `.mcp.json` 이면(만든 기록 없음) 아무것도 걷거나 고르지 않는다", () => {
    oldInstall(["tooling"], ["claude"]);
    const l = log();
    const { records: _r, portions: _p, ...rest } = l;
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({
        ...rest,
        rootFiles: (l.rootFiles ?? []).filter((f) => f.path !== ".mcp.json"),
      }),
    );
    const before = mcpJson();

    update();

    expect(mcpJson().github).toEqual(before.github);
    expect(mcpJson()["chrome-devtools"]).toEqual(before["chrome-devtools"]);
  });
});

describe("E · F · N9 — 빼기", () => {
  it("E — `mcp:github` 은 어느 트랙 · CLI 에서도 받는 키 id 가 아니다(옛 서버 은퇴)", () => {
    for (const track of TRACKS) {
      const ids = renderedKeyIds(
        REPO_ROOT,
        { tracks: [track], forceInclude: [], previous: null },
        ALL,
      );
      expect(ids.has("mcp:github"), track).toBe(false);
      expect(ids.has("mcp:context7"), track).toBe(true); // 대조군
    }
  });

  it("9 — tooling 에 기록으로 남은 chrome-devtools: 키 id 를 받고 · 자산 id 로 빼면 세 자리 모두에서 빠진다", () => {
    oldInstall(["tooling"]);
    update();
    const accepts = withoutAccepts(REPO_ROOT, spec(["tooling"]), log());
    expect(accepts("mcp:chrome-devtools")).toBe(true);
    expect(accepts("mcp:github")).toBe(false);
    runInstall({
      runExternal: null,
      harnessRoot: REPO_ROOT,
      projectDir,
      spec: spec(["tooling"], ALL, {
        userOverride: { forceInclude: [], forceExclude: ["chrome-devtools"] },
      }),
    });
    expect(mcpJson()["chrome-devtools"]).toBeUndefined();
    expect(opencodeMcp()["chrome-devtools"]).toBeUndefined();
    expect(codexToml()).not.toContain("[mcp_servers.chrome-devtools]");
  });

  it("F — `--without railway-mcp-server` 로 뺀 설치본은 update 뒤에도 세 자리 어디에도 railway 가 없다", () => {
    oldInstall(["csr-fastapi"], ALL, {
      userOverride: { forceInclude: [], forceExclude: ["railway-mcp-server"] },
    });
    update();
    expect(mcpJson()["railway-mcp-server"]).toBeUndefined();
    expect(opencodeMcp()["railway-mcp-server"]).toBeUndefined();
    expect(codexToml()).not.toContain("railway-mcp-server");
  });

  it("N9 — 옛 판에서 `.mcp.json` 에서만 뺐던 `--without mcp:chrome-devtools` 는 이제 Codex · OpenCode 에서도 뺀다", () => {
    oldInstall(["csr-fastapi"], ALL, { keyExclude: ["mcp:chrome-devtools"] });
    expect(opencodeMcp()["chrome-devtools"]).toBeDefined(); // 전제 — 옛 판은 .mcp.json 에서만 뺐다
    update();
    expect(mcpJson()["chrome-devtools"]).toBeUndefined();
    expect(opencodeMcp()["chrome-devtools"]).toBeUndefined();
    expect(codexToml()).not.toContain("[mcp_servers.chrome-devtools]");
  });
});

describe("D — 몫 기록 없는 옛 설치본의 uninstall 은 옛 값의 하네스 서버도 알린다(지우지 않는다)", () => {
  it("남은 github · chrome-devtools(옛 값)를 잔존 안내에 넣고 파일은 그대로 둔다", () => {
    oldInstall(["tooling"], ["claude"]);
    toLegacyLog();
    const before = read(".mcp.json");
    const lines: string[] = [];
    uninstallAction(
      { projectDir, yes: true },
      {
        exit: () => undefined as never,
        log: (l: string) => lines.push(strip(l)),
        err: (l: string) => lines.push(strip(l)),
        resolveHarnessRoot: () => REPO_ROOT,
      },
    );
    const remnant = lines.find((l) => l.includes("may still hold the harness's MCP servers")) ?? "";
    expect(remnant).toContain("github");
    expect(remnant).toContain("chrome-devtools");
    expect(read(".mcp.json")).toBe(before);
  });
});

describe("새 설치 — 요약 NEXT 의 원격 서버 첫 사용 안내", () => {
  it("csr-fastapi + --with github-mcp: 로그인 안내(깔린 CLI 것만)와 GITHUB_PAT 안내 · tooling 은 아무 줄도 없다", () => {
    const s = spec(["csr-fastapi"], ["claude", "codex"], {
      userOverride: { forceInclude: ["github-mcp"], forceExclude: [] },
    });
    const report = runInstall({ runExternal: null, harnessRoot: REPO_ROOT, projectDir, spec: s });
    const lines: string[] = [];
    renderFinalSummary((m) => lines.push(m), s, report, false);
    const screen = strip(lines.join("\n"));
    expect(screen).toContain("Remote MCP servers sign in on first use — railway-mcp-server");
    expect(screen).toContain("claude mcp login railway-mcp-server");
    expect(screen).toContain("codex mcp login railway-mcp-server");
    expect(screen).not.toContain("opencode mcp auth"); // opencode 를 깔지 않았다
    expect(screen).toContain("github-mcp needs GITHUB_PAT in the shell you start the CLI from");
    expect(screen).not.toContain("login github-mcp"); // 토큰 서버는 로그인하지 않는다

    rmSync(projectDir, { recursive: true, force: true });
    projectDir = mkdtempSync(join(tmpdir(), "ah-167-"));
    const t = spec(["tooling"], ["claude", "codex"]);
    const r2 = runInstall({ runExternal: null, harnessRoot: REPO_ROOT, projectDir, spec: t });
    const l2: string[] = [];
    renderFinalSummary((m) => l2.push(m), t, r2, false);
    expect(strip(l2.join("\n"))).not.toContain("sign in on first use");
  });
});

describe("새 설치 — 트랙별 기본 MCP", () => {
  const WEB = TRACKS.filter((t) => t.startsWith("csr-") || t.startsWith("ssr-") || t === "full");
  it.each(TRACKS.map((t) => [t]))("%s", (track) => {
    runInstall({
      runExternal: null,
      harnessRoot: REPO_ROOT,
      projectDir,
      spec: spec([track as Track], ["claude"]),
    });
    const servers = existsSync(join(projectDir, ".mcp.json")) ? mcpJson() : {};
    expect(servers.github).toBeUndefined();
    expect(servers["github-mcp"]).toBeUndefined();
    expect(servers.vercel).toBeUndefined();
    if (WEB.includes(track as Track)) expect(servers["chrome-devtools"]).toEqual(CHROME_NOW);
    else expect(servers["chrome-devtools"]).toBeUndefined();
    if (servers["railway-mcp-server"] !== undefined)
      expect(servers["railway-mcp-server"]).toEqual(RAILWAY_NOW);
  });
});

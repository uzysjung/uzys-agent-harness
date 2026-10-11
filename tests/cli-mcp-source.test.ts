/**
 * #568 — Codex · OpenCode 가 받는 MCP 서버는 Claude `.mcp.json` 과 **같은 원천**(템플릿 + 트랙 표)이다.
 *
 * 두 변환이 서버 목록을 하네스 루트의 `.mcp.json` 에서 읽던 탓에, 그 파일이 없는 **npm 게시판**
 * (`package.json` `files` 밖)에서는 `opencode.json` 의 `mcp` 가 늘 비었다. 저장소 루트를 하네스 루트로
 * 쓰는 테스트는 그 파일이 있어 이 차이를 볼 수 없었다 — 그래서 여기서는 하네스 루트를 **패키지에
 * 실리는 것만으로** 새로 만든다(`files` + `package.json`, npm pack 과 같은 규칙).
 *
 * 설치자 파일과의 병합은 여기서 안 본다(#563) — 빈 프로젝트에 깔아 하네스 몫만 대조한다.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import { DEFAULT_OPTIONS, type Track } from "../src/types.js";

const REPO_ROOT = resolve(__dirname, "..");

/** npm pack 이 싣는 것만으로 하네스 루트를 만든다 — `files` 항목 + 항상 실리는 `package.json`. */
function packagedHarnessRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ch-pkgroot-"));
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    files: string[];
  };
  for (const entry of [...pkg.files, "package.json"]) {
    const src = join(REPO_ROOT, entry);
    // `dist` 는 빌드 전이면 없다 — 변환은 dist 를 읽지 않으므로 없어도 대조에 영향이 없다.
    if (existsSync(src)) cpSync(src, join(root, entry), { recursive: true });
  }
  return root;
}

/** `.codex/config.toml` 의 `[mcp_servers.<name>]` 이름들. */
function codexServerNames(toml: string): string[] {
  return [...toml.matchAll(/^\[mcp_servers\.(?:"([^"]+)"|([A-Za-z0-9_-]+))\]$/gm)].map(
    (m) => m[1] ?? m[2] ?? "",
  );
}

describe("#568 — 패키지 산출물 기준에서 세 CLI 가 같은 MCP 서버 목록을 받는다", () => {
  let harnessRoot: string;
  const projects: string[] = [];

  beforeAll(() => {
    harnessRoot = packagedHarnessRoot();
  });

  afterAll(() => {
    rmSync(harnessRoot, { recursive: true, force: true });
    for (const p of projects) rmSync(p, { recursive: true, force: true });
  });

  it("대조군: 패키지 산출물에는 루트 `.mcp.json` 이 없다(이 테스트가 재는 조건)", () => {
    expect(existsSync(join(harnessRoot, "templates/mcp.json"))).toBe(true);
    expect(existsSync(join(harnessRoot, ".mcp.json"))).toBe(false);
  });

  // 트랙 표에서 행이 붙는 트랙(csr-fastapi = railway, csr-supabase = railway + supabase)과 안 붙는
  // 트랙(tooling)을 함께 본다 — 템플릿만 읽고 트랙 표를 빠뜨리면 앞의 둘이 잡는다.
  for (const track of ["tooling", "csr-fastapi", "csr-supabase"] as const satisfies Track[]) {
    it(`${track}: opencode.json mcp = .codex/config.toml mcp_servers = .mcp.json mcpServers`, () => {
      const projectDir = mkdtempSync(join(tmpdir(), `ch-mcpsrc-${track}-`));
      projects.push(projectDir);
      runInstall({
        runExternal: null,
        harnessRoot,
        projectDir,
        spec: {
          tracks: [track],
          options: { ...DEFAULT_OPTIONS },
          cli: ["codex", "opencode"],
          projectDir,
        },
      });

      const claude = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
        mcpServers: Record<
          string,
          { type: "stdio"; command: string; args: string[] } | { type: "http"; url: string }
        >;
      };
      const expected = Object.keys(claude.mcpServers).sort();
      // 모집단 0 은 "같다"가 아니라 "아무것도 안 쟀다"다.
      expect(expected.length).toBeGreaterThan(0);

      const opencode = JSON.parse(readFileSync(join(projectDir, "opencode.json"), "utf8")) as {
        mcp: Record<string, { type: string; command: string[] }>;
      };
      expect(Object.keys(opencode.mcp).sort()).toEqual(expected);
      // OpenCode 는 Claude 형식({type:"stdio", command, args})을 설정 오류로 거절한다(실측
      // opencode 1.18.32: "Configuration is invalid"). 서버마다 local + 명령 배열 · 원격은 remote + url 이어야 켜진다.
      for (const [name, cfg] of Object.entries(claude.mcpServers)) {
        expect(opencode.mcp[name]).toEqual(
          cfg.type === "http"
            ? { type: "remote", url: cfg.url }
            : { type: "local", command: [cfg.command, ...cfg.args] },
        );
      }

      const toml = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
      expect(codexServerNames(toml).sort()).toEqual(expected);
    });
  }

  // #722 · #712 (ADR-106) — 어느 트랙에도 옛 github 는 없다 · chrome-devtools 는 웹 트랙만 · railway 는 세 자리 모두 원격
  it("csr-fastapi: railway is Railway's remote server in all three · chrome-devtools runs with usage statistics off · no github", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ch-mcpsrc-remote-"));
    projects.push(projectDir);
    runInstall({
      runExternal: null,
      harnessRoot,
      projectDir,
      spec: {
        tracks: ["csr-fastapi"],
        options: { ...DEFAULT_OPTIONS },
        cli: ["claude", "codex", "opencode"],
        projectDir,
      },
    });
    const claude = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(claude.mcpServers["railway-mcp-server"]).toEqual({
      type: "http",
      url: "https://mcp.railway.com",
    });
    expect(claude.mcpServers["chrome-devtools"]).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"],
    });
    expect(claude.mcpServers.github).toBeUndefined();
    const opencode = JSON.parse(readFileSync(join(projectDir, "opencode.json"), "utf8")) as {
      mcp: Record<string, unknown>;
    };
    expect(opencode.mcp["railway-mcp-server"]).toEqual({
      type: "remote",
      url: "https://mcp.railway.com",
    });
    const toml = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
    expect(toml).toContain('[mcp_servers.railway-mcp-server]\nurl = "https://mcp.railway.com"');
    expect(toml).not.toMatch(/^\[mcp_servers\.github\]$/m);
  });

  it("tooling: no chrome-devtools and no github in any of the three", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ch-mcpsrc-tooling-"));
    projects.push(projectDir);
    runInstall({
      runExternal: null,
      harnessRoot,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS },
        cli: ["claude", "codex", "opencode"],
        projectDir,
      },
    });
    const claude = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(Object.keys(claude.mcpServers)).toEqual(["context7"]);
    const toml = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
    expect(codexServerNames(toml)).toEqual(["context7"]);
  });

  // #722 (ADR-106) — GitHub 공식 서버는 PAT 를 **환경변수 이름으로만** 받는다. 세 자리의 인증 형식이 각 CLI 공식 형식 그대로다
  it("--with github-mcp: each CLI gets its own bearer-env form, byte for byte", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ch-mcpsrc-gh-"));
    projects.push(projectDir);
    runInstall({
      runExternal: null,
      harnessRoot,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS },
        cli: ["claude", "codex", "opencode"],
        projectDir,
        userOverride: { forceInclude: ["github-mcp"], forceExclude: [] },
      },
    });
    const claude = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    expect(claude.mcpServers["github-mcp"]).toEqual({
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 파일에 쓰는 리터럴 — Claude Code 가 실행 때 펼친다
      headers: { Authorization: "Bearer ${GITHUB_PAT}" },
    });
    const opencode = JSON.parse(readFileSync(join(projectDir, "opencode.json"), "utf8")) as {
      mcp: Record<string, unknown>;
    };
    expect(opencode.mcp["github-mcp"]).toEqual({
      type: "remote",
      url: "https://api.githubcopilot.com/mcp/",
      oauth: false,
      headers: { Authorization: "Bearer {env:GITHUB_PAT}" },
    });
    const toml = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
    expect(toml).toContain(
      '[mcp_servers.github-mcp]\nurl = "https://api.githubcopilot.com/mcp/"\nbearer_token_env_var = "GITHUB_PAT"',
    );
  });

  // update 는 트랙을 인자로 받지 않는다 — 설치 기록의 트랙으로 렌더해야 트랙 서버(railway)가 update 뒤에도
  // 남는다. 여기 update 의 spec 트랙(tooling)은 일부러 기록(csr-fastapi)과 다르게 둔다.
  it("update 뒤에도 두 CLI 가 설치 기록의 트랙대로 같은 목록을 유지한다", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "ch-mcpsrc-upd-"));
    projects.push(projectDir);
    const spec = (tracks: Track[]) => ({
      tracks,
      options: { ...DEFAULT_OPTIONS },
      cli: ["codex", "opencode"] as ("codex" | "opencode")[],
      projectDir,
    });
    runInstall({ runExternal: null, harnessRoot, projectDir, spec: spec(["csr-fastapi"]) });
    runInstall({
      runExternal: null,
      harnessRoot,
      projectDir,
      spec: spec(["tooling"]),
      mode: "update",
    });

    const claude = JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
      mcpServers: Record<string, unknown>;
    };
    const expected = Object.keys(claude.mcpServers).sort();
    expect(expected).toContain("railway-mcp-server");
    const opencode = JSON.parse(readFileSync(join(projectDir, "opencode.json"), "utf8")) as {
      mcp: Record<string, unknown>;
    };
    expect(Object.keys(opencode.mcp).sort()).toEqual(expected);
    const toml = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
    expect(codexServerNames(toml).sort()).toEqual(expected);
  });
});

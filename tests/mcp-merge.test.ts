import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  composeMcpJson,
  type McpJson,
  mergeMcpServers,
  parseTrackMcpMap,
  type TrackMcpRow,
  toClaudeServer,
} from "../src/mcp-merge.js";

const SAMPLE_MAP = `# header
railway-mcp-server\tcsr-*|ssr-*|full\tnpx\t["-y", "@railway/mcp-server"]
supabase\tcsr-supabase|full\tnpx\t["-y", "@supabase/mcp-server"]
# trailing comment
`;

const BASE: McpJson = {
  _comment: "template",
  mcpServers: {
    context7: { command: "npx", args: ["-y", "@upstash/context7-mcp"] },
  },
};

describe("parseTrackMcpMap", () => {
  it("ignores comments + blank lines", () => {
    const rows = parseTrackMcpMap(SAMPLE_MAP);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.name).toBe("railway-mcp-server");
    expect(rows[1]?.pattern).toBe("csr-supabase|full");
  });

  it("rejects rows with missing fields", () => {
    expect(parseTrackMcpMap("name\tpattern")).toEqual([]);
  });

  it("rejects rows with non-string args", () => {
    const bad = "name\tpattern\tnpx\t[1, 2]";
    expect(parseTrackMcpMap(bad)).toEqual([]);
  });

  it("rejects rows with malformed JSON args", () => {
    const bad = "name\tpattern\tnpx\t[not json]";
    expect(parseTrackMcpMap(bad)).toEqual([]);
  });

  // #711 (ADR-106) — 3열이 리터럴 `url` 이면 원격 행. 4열은 객체이고 url 은 https 여야 한다
  it("reads a `url` row as a remote server — with and without a bearer env", () => {
    const rows = parseTrackMcpMap(
      [
        'vercel\t-\turl\t{"url":"https://mcp.vercel.com"}',
        'github-mcp\t-\turl\t{"url":"https://api.githubcopilot.com/mcp/","bearerEnv":"GITHUB_PAT"}',
      ].join("\n"),
    );
    expect(rows).toEqual([
      { name: "vercel", pattern: "-", server: { type: "http", url: "https://mcp.vercel.com" } },
      {
        name: "github-mcp",
        pattern: "-",
        server: {
          type: "http",
          url: "https://api.githubcopilot.com/mcp/",
          auth: { bearerEnv: "GITHUB_PAT" },
        },
      },
    ]);
  });

  it("drops a `url` row whose 4th column is not an https object or whose env name is not a name", () => {
    for (const bad of [
      'x\t-\turl\t["https://a"]',
      'x\t-\turl\t{"url":"http://a"}',
      'x\t-\turl\t{"url":"https://a","bearerEnv":"$(rm -rf)"}',
      "x\t-\turl\tnot json",
    ]) {
      expect(parseTrackMcpMap(bad)).toEqual([]);
    }
  });
});

describe("toClaudeServer", () => {
  it("writes the env var name into the header, never a value", () => {
    expect(
      toClaudeServer({ type: "http", url: "https://h/", auth: { bearerEnv: "GITHUB_PAT" } }),
    ).toEqual({
      type: "http",
      url: "https://h/",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: 파일에 쓰는 리터럴 — Claude Code 가 실행 때 펼친다
      headers: { Authorization: "Bearer ${GITHUB_PAT}" },
    });
    expect(toClaudeServer({ type: "http", url: "https://h/" })).toEqual({
      type: "http",
      url: "https://h/",
    });
    expect(toClaudeServer({ command: "npx", args: ["-y", "a"] })).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "a"],
    });
  });
});

describe("mergeMcpServers", () => {
  const rows: TrackMcpRow[] = [
    {
      name: "railway-mcp-server",
      pattern: "csr-*|full",
      server: { type: "stdio", command: "npx", args: ["-y", "x"] },
    },
    {
      name: "supabase",
      pattern: "csr-supabase",
      server: { type: "stdio", command: "npx", args: ["-y", "y"] },
    },
    // #711 — 기본 트랙이 없는 행(`-`)은 트랙만으로는 안 들어가고 `chosen` 으로만 들어간다
    { name: "vercel", pattern: "-", server: { type: "http", url: "https://mcp.vercel.com" } },
  ];

  it("a `-` row is never a track default — only `chosen` brings it in", () => {
    for (const track of ["csr-supabase", "full", "tooling", "executive"] as const) {
      expect(mergeMcpServers(BASE, rows, [track]).mcpServers.vercel).toBeUndefined();
    }
    expect(mergeMcpServers(BASE, rows, ["tooling"], ["vercel"]).mcpServers.vercel).toEqual({
      type: "http",
      url: "https://mcp.vercel.com",
    });
  });

  it("adds servers whose pattern matches selected tracks", () => {
    const out = mergeMcpServers(BASE, rows, ["csr-supabase"]);
    expect(Object.keys(out.mcpServers).sort()).toEqual([
      "context7",
      "railway-mcp-server",
      "supabase",
    ]);
  });

  it("does not add servers when no track matches", () => {
    const out = mergeMcpServers(BASE, rows, ["executive"]);
    expect(Object.keys(out.mcpServers)).toEqual(["context7"]);
  });

  it("preserves existing custom servers (no overwrite)", () => {
    const customized: McpJson = {
      mcpServers: {
        ...BASE.mcpServers,
        railway: { command: "user", args: ["custom"] },
        "railway-mcp-server": { command: "kept", args: [] },
      },
    };
    const out = mergeMcpServers(customized, rows, ["full"]);
    expect(out.mcpServers["railway-mcp-server"]).toMatchObject({ command: "kept" });
  });

  it("strips _comment marker", () => {
    const out = mergeMcpServers(BASE, [], ["tooling"]);
    expect(out._comment).toBeUndefined();
  });
});

describe("composeMcpJson", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-mcp-"));
    writeFileSync(
      join(dir, "mcp.json"),
      JSON.stringify({ _comment: "tpl", mcpServers: { context7: { command: "npx", args: [] } } }),
    );
    writeFileSync(join(dir, "track-mcp-map.tsv"), SAMPLE_MAP);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("composes from template + map (no existing user file)", () => {
    const out = composeMcpJson({
      templateMcpPath: join(dir, "mcp.json"),
      trackMapPath: join(dir, "track-mcp-map.tsv"),
      tracks: ["full"],
      chosen: () => [],
    });
    expect(Object.keys(out.mcpServers).sort()).toEqual([
      "context7",
      "railway-mcp-server",
      "supabase",
    ]);
  });

  // #551 PR-3 — 설치자 파일과 합치는 일은 더는 여기서 하지 않는다(`existingPath` 삭제). 합치던 판은 설치자 파일을
  // 못 읽으면 템플릿으로 덮었다(#574). 설치자 서버 보존 · 깨진 파일 무쓰기는 `json-keys` 어댑터 경로에서 문다
  // (`tests/adapters.test.ts` · `tests/install-writes.test.ts`).

  it("works when track-mcp-map.tsv is missing", () => {
    const out = composeMcpJson({
      templateMcpPath: join(dir, "mcp.json"),
      trackMapPath: join(dir, "no-such.tsv"),
      tracks: ["full"],
      chosen: () => [],
    });
    expect(Object.keys(out.mcpServers)).toEqual(["context7"]);
  });
});

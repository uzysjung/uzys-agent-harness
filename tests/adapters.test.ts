/**
 * 원칙 단위 테스트 — 어댑터 4종 (#551 · ADR-097 · 설계 §6.2 · §7A).
 *
 * 세 성질을 문다:
 *   ① upsert∘strip = 설치자 원본 — `marker-md` · `lines` 는 바이트 동일, `json-keys` · `toml-region` 은 파싱 동치
 *   ② 파싱 실패 입력에는 한 바이트도 쓰지 않는다(#574) — 결과에 쓸 내용 자체가 없다
 *   ③ strip 은 기록된 키만 뺀다 — 설치자 것은 이름·값이 하네스 것과 같아도 남는다(Q3 · R3)
 */

import { describe, expect, it } from "vitest";
import { ADAPTERS, adapterFor, excludedKeys, keyId, SHARED_FILES } from "../src/adapters/index.js";
import { readToml } from "../src/adapters/toml-region.js";

const none = new Set<string>();
const fresh = new Map<string, string>();

function upsertOk<V>(
  adapter: (typeof ADAPTERS)[keyof typeof ADAPTERS],
  existing: string | null,
  render: ReadonlyMap<string, V>,
  recorded: ReadonlyMap<string, string> = fresh,
  excluded: ReadonlySet<string> = none,
) {
  const r = (
    adapter as { upsert: (e: string | null, i: unknown) => ReturnType<typeof adapter.upsert> }
  ).upsert(existing, { render, recorded, excluded });
  if (!r.ok) throw new Error(`upsert failed: ${r.reason}`);
  return r;
}

function stripOk(
  adapter: (typeof ADAPTERS)[keyof typeof ADAPTERS],
  existing: string,
  recorded: ReadonlyMap<string, string>,
  excluded: ReadonlySet<string> = none,
) {
  const r = adapter.strip(existing, { recorded, excluded });
  if (!r.ok) throw new Error(`strip failed: ${r.reason}`);
  return r;
}

/* ─── marker-md ─────────────────────────────────────────────────────────── */

describe("marker-md — 루트 CLAUDE.md · AGENTS.md 블록", () => {
  const md = ADAPTERS["marker-md"];
  const render = new Map([["import", "@CLAUDE-uzys-harness.md"]]);
  const originals = [
    "",
    "# My project\n",
    "# My project", // 끝 개행 없음 — 지금 `upsertHarnessImport` 짝은 여기서 원본으로 안 돌아온다
    "# My project\n\n\n",
    "\n",
    "# CRLF\r\nline\r\n",
    "# 앞에 설치자 블록 이름이 다른 것\n<!-- uzys-harness:mine:start -->\nkeep\n<!-- uzys-harness:mine:end -->\n",
  ];

  it.each(
    originals.map((x) => [JSON.stringify(x), x]),
  )("upsert∘strip = 원본(바이트) — %s", (_, x) => {
    const u = upsertOk(md, x, render);
    expect(u.text).toContain("<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n");
    const s = stripOk(md, u.text, u.portions);
    expect(s.text).toBe(x);
  });

  it("블록 둘을 따로 붙였다가 빼도 원본", () => {
    const x = "# P\n";
    const a = upsertOk(md, x, new Map([["a", "A"]]));
    const b = upsertOk(
      md,
      a.text,
      new Map([
        ["a", "A"],
        ["b", "B"],
      ]),
      a.portions,
    );
    expect(stripOk(md, b.text, b.portions).text).toBe(x);
  });

  it("기록 sha 그대로면 본문만 바꾼다 · 설치자가 블록 안을 고쳤으면 남기고 알린다", () => {
    const u = upsertOk(md, "# P\n", render);
    const refreshed = upsertOk(md, u.text, new Map([["import", "@NEW"]]), u.portions);
    expect(refreshed.text).toBe(
      "# P\n\n<!-- uzys-harness:import:start -->\n@NEW\n<!-- uzys-harness:import:end -->\n",
    );
    const edited = u.text.replace("@CLAUDE-uzys-harness.md", "@CLAUDE-uzys-harness.md\nmy line");
    const again = upsertOk(md, edited, new Map([["import", "@NEW"]]), u.portions);
    expect(again.text).toBe(edited);
    expect(again.kept).toEqual(["import"]);
    expect(stripOk(md, edited, u.portions).text).toBe(edited); // 고친 블록은 strip 도 남긴다
  });

  it("기록에 있는 블록을 설치자가 지웠으면 되살리지 않고 deleted 로 낸다(R2)", () => {
    const u = upsertOk(md, "# P\n", render);
    const again = upsertOk(md, "# P\n", render, u.portions);
    expect(again).toMatchObject({ text: "# P\n", changed: false, deleted: ["import"] });
  });

  it("기록에 없는 같은 이름 블록은 설치자 것 — 쓰지도 빼지도 않는다(Q3)", () => {
    const mine =
      "<!-- uzys-harness:import:start -->\n@CLAUDE-uzys-harness.md\n<!-- uzys-harness:import:end -->\n";
    const u = upsertOk(md, mine, render);
    expect(u).toMatchObject({ text: mine, changed: false, kept: ["import"] });
    expect(u.portions.size).toBe(0);
    expect(stripOk(md, mine, u.portions).text).toBe(mine);
  });

  it("파일이 없으면 seed(스캐폴드) 뒤에 블록 — strip 은 seed 를 남기고, 비었는지 알린다", () => {
    const r = md.upsert(null, { render, recorded: fresh, excluded: none, seed: "# P\n" });
    if (!r.ok) throw new Error("unexpected");
    expect(r.changed).toBe(true);
    const s = stripOk(md, r.text, r.portions);
    expect(s).toMatchObject({ text: "# P\n", empty: false });
    const bare = upsertOk(md, null, render);
    expect(stripOk(md, bare.text, bare.portions)).toMatchObject({ text: "", empty: true });
  });

  it.each([
    "<!-- uzys-harness:import:start -->\n@x\n", // 끝 마커 없음
    "<!-- uzys-harness:a:start -->\n<!-- uzys-harness:b:start -->\n", // 블록 안에서 블록
    "<!-- uzys-harness:a:end -->\n", // 시작 없는 끝
    "<!-- uzys-harness:a:start -->\n<!-- uzys-harness:a:end -->\n<!-- uzys-harness:a:start -->\n<!-- uzys-harness:a:end -->\n",
  ])("마커가 깨진 파일은 한 바이트도 쓰지 않는다 — %j", (broken) => {
    expect(md.read(broken)).toBeNull();
    const u = md.upsert(broken, { render, recorded: fresh, excluded: none });
    const s = md.strip(broken, { recorded: new Map([["a", "x"]]), excluded: none });
    expect(u).toEqual({ ok: false, reason: md.unreadable });
    expect(s).toEqual({ ok: false, reason: md.unreadable });
  });
});

/* ─── json-keys ─────────────────────────────────────────────────────────── */

const HOOK = (script: string, extra: Record<string, unknown> = {}) => ({
  ...extra,
  hooks: [{ type: "command", command: `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${script}"` }],
});

describe("json-keys — .mcp.json · opencode.json · .claude/settings.json", () => {
  const js = ADAPTERS["json-keys"];
  const mcpRender = new Map<string, unknown>([
    ["mcpServers.context7", { command: "npx", args: ["-y", "@upstash/context7-mcp"] }],
    ["mcpServers.github", { command: "npx", args: ["-y", "gh"] }],
  ]);
  const settingsRender = new Map<string, unknown>([
    ["statusLine", { type: "command", command: "powerline" }],
    ["hooks.SessionStart#session-start.sh", HOOK("session-start.sh")],
    ["hooks.PreToolUse#protect-files.sh", HOOK("protect-files.sh", { matcher: "Write|Edit" })],
  ]);

  const originals: Array<[string, string, ReadonlyMap<string, unknown>]> = [
    ["빈 객체", "{}", mcpRender],
    ["원래 빈 mcpServers — 컨테이너를 걷지 않는다", '{\n    "mcpServers": {}\n}', mcpRender],
    ["설치자 서버", '{"mcpServers":{"mine":{"command":"x"}}}', mcpRender],
    ["설치자의 같은 이름 서버", '{"mcpServers":{"github":{"command":"my-gh"}}}', mcpRender],
    ["settings — 권한만", '{"permissions":{"allow":["Bash"]}}', settingsRender],
    [
      "settings — 설치자 훅 · statusLine",
      JSON.stringify({
        statusLine: { type: "command", command: "mine" },
        hooks: {
          SessionStart: [{ hooks: [{ type: "command", command: "bash my.sh" }] }],
          PostToolUse: [],
        },
      }),
      settingsRender,
    ],
  ];

  it.each(originals)("upsert∘strip = 원본(파싱 동치) — %s", (_, x, render) => {
    const u = upsertOk(js, x, render);
    const s = stripOk(js, u.text, u.portions);
    expect(JSON.parse(s.text)).toEqual(JSON.parse(x));
  });

  it("설치자 키가 이긴다 — 같은 이름 서버 · statusLine 은 쓰지도 기록하지도 않는다(Q3 · A5)", () => {
    const u = upsertOk(js, '{"mcpServers":{"github":{"command":"my-gh"}}}', mcpRender);
    expect(JSON.parse(u.text).mcpServers.github).toEqual({ command: "my-gh" });
    expect(u.kept).toEqual(["mcpServers.github"]);
    expect([...u.portions.keys()]).not.toContain("mcpServers.github");
    const st = upsertOk(js, '{"statusLine":{"command":"mine"}}', settingsRender);
    expect(JSON.parse(st.text).statusLine).toEqual({ command: "mine" });
  });

  it("strip 은 기록된 키만 — 기록에 없는 설치자 서버는 이름이 같아도 남는다", () => {
    const mine = '{"mcpServers":{"github":{"command":"npx","args":["-y","gh"]}}}';
    const u = upsertOk(js, mine, mcpRender);
    const s = stripOk(js, u.text, u.portions);
    expect(JSON.parse(s.text)).toEqual(JSON.parse(mine));
    expect(s.removed).toEqual(["mcpServers.context7"]);
  });

  it("설치자가 값을 고친 하네스 서버는 upsert·strip 모두 남기고 알린다", () => {
    const u = upsertOk(js, "{}", mcpRender);
    const edited = JSON.parse(u.text);
    edited.mcpServers.github.env = { TOKEN: "x" };
    const text = JSON.stringify(edited);
    const again = upsertOk(js, text, mcpRender, u.portions);
    expect(again.kept).toContain("mcpServers.github");
    const s = stripOk(js, text, u.portions);
    expect(s.kept).toEqual(["mcpServers.github"]);
    expect(JSON.parse(s.text)).toEqual({ mcpServers: { github: edited.mcpServers.github } });
  });

  it("훅 항목은 설치자가 필드를 고쳤어도 strip 이 뺀다 — 스크립트가 함께 사라진다(N-f)", () => {
    const u = upsertOk(js, "{}", settingsRender);
    const edited = JSON.parse(u.text);
    edited.hooks.SessionStart[0].hooks[0].timeout = 30;
    const s = stripOk(js, JSON.stringify(edited), u.portions);
    expect(s.removed).toContain("hooks.SessionStart#session-start.sh");
    expect(s.kept).toEqual([]);
    expect(JSON.parse(s.text)).toEqual({}); // 하네스가 더한 statusLine · 만든 hooks 컨테이너까지 걷혔다
  });

  it("렌더에서 빠진 훅(스크립트 해제)은 upsert 가 뺀다 — 사후 정리가 필요 없다(N13)", () => {
    const u = upsertOk(js, "{}", settingsRender);
    const without = new Map(settingsRender);
    without.delete("hooks.PreToolUse#protect-files.sh");
    const again = upsertOk(js, u.text, without, u.portions);
    const parsed = JSON.parse(again.text);
    expect(parsed.hooks.PreToolUse).toBeUndefined(); // 하네스가 만든 빈 배열까지 걷었다
    expect(parsed.hooks.SessionStart).toHaveLength(1);
  });

  it("R2 — 지운 서버는 되살리지 않고 deleted → 키 id `mcp:<name>`", () => {
    const u = upsertOk(js, "{}", mcpRender);
    const gone = JSON.parse(u.text);
    delete gone.mcpServers.github;
    const again = upsertOk(js, JSON.stringify(gone), mcpRender, u.portions);
    expect(again.deleted).toEqual(["mcpServers.github"]);
    expect(JSON.parse(again.text).mcpServers.github).toBeUndefined();
    expect(again.deleted.map((k) => keyId(".mcp.json", k))).toEqual(["mcp:github"]);
  });

  it("파일이 없으면 하네스 몫만 — strip 하면 비어 empty", () => {
    const u = upsertOk(js, null, mcpRender);
    const s = stripOk(js, u.text, u.portions);
    expect(s).toMatchObject({ empty: true });
    expect(JSON.parse(s.text)).toEqual({});
  });

  it("바뀐 것이 없으면 입력 바이트 그대로", () => {
    const u = upsertOk(js, "{}", mcpRender);
    const again = upsertOk(js, u.text, mcpRender, u.portions);
    expect(again).toMatchObject({ changed: false, text: u.text });
  });

  it("컨테이너 자리에 모양이 다른 설치자 값이 있으면 그 키는 쓰지 않는다", () => {
    const u = upsertOk(js, '{"mcpServers":[]}', mcpRender);
    expect(u.text).toBe('{"mcpServers":[]}');
    expect(u.kept).toEqual(["mcpServers.context7", "mcpServers.github"]);
  });

  it.each([
    '{ "mcpServers": { broken',
    "[1,2]",
    "null",
    "",
  ])("파싱 실패(%j)는 한 바이트도 쓰지 않는다(#574)", (broken) => {
    expect(js.read(broken)).toBeNull();
    expect(js.upsert(broken, { render: mcpRender, recorded: fresh, excluded: none })).toEqual({
      ok: false,
      reason: "invalid JSON",
    });
    expect(js.strip(broken, { recorded: fresh, excluded: none })).toEqual({
      ok: false,
      reason: "invalid JSON",
    });
  });

  it("excluded 키는 더하지 않고, uninstall 은 건너뛴다", () => {
    const u = upsertOk(js, "{}", mcpRender, fresh, new Set(["mcpServers.github"]));
    expect(JSON.parse(u.text).mcpServers).toEqual({
      context7: mcpRender.get("mcpServers.context7"),
    });
    const s = stripOk(js, u.text, u.portions, new Set(["mcpServers.context7"]));
    expect(s.removed).toEqual([]);
  });
});

/* ─── lines ─────────────────────────────────────────────────────────────── */

describe("lines — .gitignore", () => {
  const ln = ADAPTERS.lines;
  const render = new Map([
    [".env", "# Secret env (auto-added by agent-harness install)\n.env"],
    [".factory/", "# agent CLI / harness 자동 생성물 (auto-added by agent-harness)\n.factory/"],
    [".uzys-agent-harness/", ".uzys-agent-harness/"],
  ]);
  const originals = [
    "",
    "node_modules\n",
    "node_modules",
    "dist\n\n",
    "a\r\nb\r\n",
    "# mine\n.env\n",
  ];

  it.each(
    originals.map((x) => [JSON.stringify(x), x]),
  )("upsert∘strip = 원본(바이트) — %s", (_, x) => {
    const u = upsertOk(ln, x, render);
    expect(stripOk(ln, u.text, u.portions).text).toBe(x);
  });

  it("설치자의 같은 줄은 설치자 것 — 붙이지도 빼지도 않는다", () => {
    const u = upsertOk(ln, "# mine\n.env\n", render);
    expect(u.text.match(/^\.env$/gm)).toHaveLength(1);
    expect(u.kept).toEqual([".env"]);
    expect(stripOk(ln, u.text, u.portions).text).toBe("# mine\n.env\n");
  });

  it("딸린 주석을 설치자가 고쳤으면 남기고 알린다 · 줄을 지웠으면 deleted(R2)", () => {
    const u = upsertOk(ln, "x\n", render);
    const edited = u.text.replace("# Secret env", "# my secrets");
    const s = stripOk(ln, edited, u.portions);
    expect(s.kept).toEqual([".env"]);
    expect(s.text).toContain(".env");
    const gone = u.text.replace(".factory/\n", "");
    expect(upsertOk(ln, gone, render, u.portions).deleted).toEqual([".factory/"]);
  });

  it("파일이 없으면 몫만 — strip 하면 비어 empty", () => {
    const u = upsertOk(ln, null, render);
    expect(stripOk(ln, u.text, u.portions)).toMatchObject({ text: "", empty: true });
  });
});

/* ─── toml-region ───────────────────────────────────────────────────────── */

/** 파싱 동치 — 실제 TOML 파서(`smol-toml`)가 읽은 값이 같다. 읽히지 않으면 그 자체로 실패. */
function tomlMeaning(text: string): unknown {
  const parsed = readToml(text);
  expect(parsed, text).not.toBeNull();
  return parsed;
}

describe("toml-region — .codex/config.toml", () => {
  const tr = ADAPTERS["toml-region"];
  const render = new Map([
    ["top", 'approval_policy = "on-request"\nsandbox_mode = "workspace-write"'],
    [
      "tables",
      [
        "[sandbox_workspace_write]",
        'writable_roots = [\n    "/work",\n    "/tmp",\n]',
        "",
        "[[hooks.session_start]]",
        'command = ["/work/.codex/hooks/session-start.sh"]',
        "",
        "[mcp_servers.context7]",
        'command = "npx"',
      ].join("\n"),
    ],
  ]);
  const originals = [
    "",
    'model = "o3"\n',
    'model = "o3"', // 끝 개행 없음
    '# my config\nmodel = "o3"\n\n[profiles.fast]\nmodel = "o4-mini"\n',
    '[[hooks.session_start]]\ncommand = ["mine.sh"]\n',
    'approval_policy = "never"\n[sandbox_workspace_write]\nnetwork_access = false\n',
  ];

  it.each(
    originals.map((x) => [JSON.stringify(x), x]),
  )("upsert∘strip = 원본(파싱 동치) — %s", (_, x) => {
    const u = upsertOk(tr, x, render);
    tomlMeaning(u.text);
    const s = stripOk(tr, u.text, u.portions);
    expect(tomlMeaning(s.text)).toEqual(tomlMeaning(x));
  });

  it("최상위 키 구간은 파일 맨 앞에 들어간다 — 파일 끝이면 설치자 표 안으로 빨려 들어간다(B4)", () => {
    const u = upsertOk(tr, 'model = "o3"\n[profiles.fast]\nmodel = "x"\n', render);
    expect(u.text.startsWith("# uzys-harness:top:start\n")).toBe(true);
    expect(tomlMeaning(u.text)).toMatchObject({
      approval_policy: "on-request",
      profiles: { fast: { model: "x" } },
    });
  });

  it("여러 줄 문자열 안의 `[…]` 줄을 첫 표로 착각하지 않는다(리뷰 P3 · N7)", () => {
    const x = 'developer_instructions = """\nBe careful.\n[important]\nnever push\n"""\n';
    const u = upsertOk(tr, x, render);
    expect(tomlMeaning(u.text)).toMatchObject({
      approval_policy: "on-request",
      developer_instructions: "Be careful.\n[important]\nnever push\n",
    });
    expect(tomlMeaning(stripOk(tr, u.text, u.portions).text)).toEqual(tomlMeaning(x));
  });

  describe("설치자가 같은 표를 다른 형태로 이미 정의했다 — 결과는 읽히고 그 항목은 설치자 것(리뷰 P2 · B2)", () => {
    const p2Render = new Map([
      ["top", 'approval_policy = "on-request"'],
      [
        "tables",
        '[features]\nweb_search_request = false\n\n[mcp_servers.context7]\ncommand = "npx"\nargs = ["-y", "@upstash/context7-mcp"]',
      ],
    ]);
    it.each([
      ["인라인 표", "features = { web_search_request = true }\n", "[features]"],
      [
        "표 안의 인라인 표",
        '[mcp_servers]\ncontext7 = { command = "npx", args = ["-y", "@upstash/context7-mcp"] }\n',
        "[mcp_servers.context7]",
      ],
      ["표 안의 점 키", '[mcp_servers]\ncontext7.command = "bunx"\n', "[mcp_servers.context7]"],
      ["최상위 점 키", 'mcp_servers.context7.command = "bunx"\n', "[mcp_servers.context7]"],
    ])("%s", (_, x, taken) => {
      expect(readToml(x)).not.toBeNull(); // 입력은 유효하다
      const u = upsertOk(tr, x, p2Render);
      const parsed = tomlMeaning(u.text);
      expect(u.kept).toContain(taken);
      expect(parsed).toMatchObject(readToml(x) ?? {}); // 설치자 값이 그대로 이긴다
      expect(tomlMeaning(stripOk(tr, u.text, u.portions).text)).toEqual(readToml(x));
    });

    it("설치자가 하위 표만 정의했어도 그 표는 설치자 것 — 파싱은 되지만 하네스 키가 섞여 들지 않는다", () => {
      const x = '[mcp_servers.context7.env]\nTOKEN = "t"\n';
      const u = upsertOk(tr, x, p2Render);
      expect(u.kept).toContain("[mcp_servers.context7]");
      expect((tomlMeaning(u.text) as { mcp_servers: unknown }).mcp_servers).toEqual({
        context7: { env: { TOKEN: "t" } },
      });
    });

    it("닫힌 인라인 표를 넓히는 항목은 경로가 없어도 뺀다(쓴 결과가 읽혀야 한다)", () => {
      const x = 'mcp_servers = { mine = { command = "x" } }\n';
      const u = upsertOk(tr, x, p2Render);
      expect(u.kept).toContain("[mcp_servers.context7]");
      expect(tomlMeaning(u.text)).toMatchObject({ mcp_servers: { mine: { command: "x" } } });
    });
  });

  it("구간 밖 설치자 키·표가 이긴다 — 하네스 구간에서 그 항목을 뺀다 · [[배열 표]]는 충돌이 아니다", () => {
    const x =
      'approval_policy = "never"\n[sandbox_workspace_write]\nnetwork_access = false\n[[hooks.session_start]]\ncommand = ["mine.sh"]\n';
    const u = upsertOk(tr, x, render);
    expect(u.kept).toEqual(
      expect.arrayContaining(["approval_policy", "[sandbox_workspace_write]"]),
    );
    expect(u.text.match(/^approval_policy/gm)).toHaveLength(1);
    expect(u.text.match(/^\[\[hooks\.session_start\]\]/gm)).toHaveLength(2);
    expect(u.text).toContain('sandbox_mode = "workspace-write"');
  });

  it("strip 은 기록된 구간만 — 설치자 표는 남는다 · 고친 구간은 남기고 알린다", () => {
    const u = upsertOk(tr, '[mcp_servers.mine]\ncommand = "x"\n', render);
    const edited = u.text.replace('sandbox_mode = "workspace-write"', 'sandbox_mode = "read-only"');
    const s = stripOk(tr, edited, u.portions);
    expect(s.kept).toEqual(["top"]);
    expect(s.text).toContain("[mcp_servers.mine]");
    expect(s.text).not.toContain("[mcp_servers.context7]");
  });

  it("파일이 없으면 몫만 — strip 하면 비어 empty", () => {
    const u = upsertOk(tr, null, render);
    expect(stripOk(tr, u.text, u.portions)).toMatchObject({ text: "", empty: true });
  });

  it.each([
    "approval_policy never\n", // = 없음
    "a = [1, 2\n", // 닫히지 않은 배열
    'a = "unterminated\n', // 한 줄 문자열이 줄을 넘음
    "[t]\na = 1\n[t]\nb = 2\n", // 같은 표 두 번
    "a = 1\na = 2\n", // 같은 키 두 번
    "[t\n", // 깨진 헤더
    "x = { y = 1 }\n[x.z]\nq = 1\n", // 인라인 표를 다시 정의
  ])("TOML 로 읽히지 않는 파일(%j)에는 한 바이트도 쓰지 않는다(#574)", (broken) => {
    expect(tr.read(broken)).toBeNull();
    const failed = { ok: false, reason: "invalid TOML" };
    expect(tr.upsert(broken, { render, recorded: fresh, excluded: none })).toEqual(failed);
    expect(tr.strip(broken, { recorded: fresh, excluded: none })).toEqual(failed);
  });

  it("쓴 결과가 읽히지 않으면 쓰지 않는다 — 설치자가 고쳐 남긴 구간과 새 구간이 겹칠 때", () => {
    const first = upsertOk(tr, "", new Map([["tables", "[features]\na = true"]]));
    const edited = first.text.replace("a = true", "a = false"); // 설치자가 구간을 고쳤다 → 남긴다
    const r = tr.upsert(edited, {
      // 릴리즈가 `tables` 를 은퇴시키고 같은 표를 새 구간에 정의 — 고쳐 남긴 구간은 판정 문서 밖이라 사후 검증만 본다
      render: new Map([["extra", "[features]\nb = 1"]]),
      recorded: first.portions,
      excluded: none,
    });
    expect(r).toEqual({ ok: false, reason: "the merged result would not be readable TOML" });
  });

  it("마커가 깨진 파일에도 쓰지 않는다", () => {
    const broken = "# uzys-harness:top:start\na = 1\n"; // 끝 마커 없음 — TOML 로는 읽힌다
    const failed = { ok: false, reason: "harness markers are broken" };
    expect(tr.read(broken)).toBeNull();
    expect(tr.upsert(broken, { render, recorded: fresh, excluded: none })).toEqual(failed);
    expect(tr.strip(broken, { recorded: fresh, excluded: none })).toEqual(failed);
  });

  it("여러 줄 값 · 인라인 표 · 여러 줄 문자열 · 주석이 있는 파일을 읽는다", () => {
    const ok = [
      "a = [",
      '  "x", # comment',
      "  { b = 1 },",
      "]",
      'c = """',
      "multi [ line",
      '"""',
      "d = '''raw ] '''",
      'e = "esc \\" [ "',
      '["quoted.table"]',
      "'lit' = 1",
    ].join("\n");
    expect(tr.read(ok)).not.toBeNull();
    tomlMeaning(upsertOk(tr, ok, render).text);
  });
});

/* ─── 표 · 키 id ────────────────────────────────────────────────────────── */

describe("함께 쓰는 파일 표 · 키 id", () => {
  it("설계 §6.2 의 일곱 파일이 어댑터를 갖는다 — 그 밖의 경로는 shared 가 아니다", () => {
    expect(
      Object.fromEntries(Object.entries(SHARED_FILES).map(([p, f]) => [p, f.adapter])),
    ).toEqual({
      "CLAUDE.md": "marker-md",
      "AGENTS.md": "marker-md",
      ".claude/settings.json": "json-keys",
      ".mcp.json": "json-keys",
      "opencode.json": "json-keys",
      ".codex/config.toml": "toml-region",
      ".gitignore": "lines",
    });
    expect(adapterFor(".claude/rules/git-policy.md")).toBeNull();
  });

  it.each([
    [".mcp.json", "mcpServers.github", "mcp:github"],
    [".claude/settings.json", "statusLine", "settings:statusLine"],
    [
      ".claude/settings.json",
      "hooks.SessionStart#session-start.sh",
      "settings:hooks.SessionStart#session-start.sh",
    ],
    ["opencode.json", "mcp.context7", "opencode:mcp.context7"],
    [".gitignore", ".env", "gitignore:.env"],
  ])("%s · %s → %s (설계 §1.2 의 키 id) · 되돌리면 같은 키", (path, key, id) => {
    expect(keyId(path, key)).toBe(id);
    expect([...excludedKeys(path, [id, "baseline:rules/x", "mcp:other"])]).toContain(key);
  });

  it("하네스가 만든 빈 컨테이너는 키 id 가 아니다 · 표 밖 경로는 id 가 없다", () => {
    expect(keyId(".mcp.json", "mcpServers{}")).toBeNull();
    expect(keyId(".claude/rules/x.md", "a")).toBeNull();
    expect(excludedKeys(".claude/rules/x.md", ["mcp:github"]).size).toBe(0);
  });
});

/* ─── 무작위 입력 — 바이트 동일 두 어댑터 ──────────────────────────────── */

describe("upsert∘strip 바이트 동일 — 무작위 설치자 파일(시드 고정)", () => {
  /** 결정적 난수(mulberry32) — 실패가 재현되게 시드를 고정한다. */
  function rng(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const PIECES = ["", "a", "# note", ".env", "node_modules/", "  x  ", "## 제목", "b = 1"];
  function randomFile(next: () => number): string {
    const n = Math.floor(next() * 6);
    const eol = next() < 0.2 ? "\r\n" : "\n";
    const body = Array.from(
      { length: n },
      () => PIECES[Math.floor(next() * PIECES.length)] ?? "",
    ).join(eol);
    return next() < 0.5 ? body : `${body}${eol}`;
  }

  it("marker-md · lines 각 300개", () => {
    const next = rng(551);
    const md = ADAPTERS["marker-md"];
    const ln = ADAPTERS.lines;
    for (let i = 0; i < 300; i++) {
      const x = randomFile(next);
      const m = upsertOk(
        md,
        x,
        new Map([
          ["import", "@A"],
          ["skills", "- s"],
        ]),
      );
      expect(stripOk(md, m.text, m.portions).text, JSON.stringify(x)).toBe(x);
      const l = upsertOk(
        ln,
        x,
        new Map([
          [".env", "# h\n.env"],
          [".factory/", ".factory/"],
        ]),
      );
      expect(stripOk(ln, l.text, l.portions).text, JSON.stringify(x)).toBe(x);
    }
  });
});

/* ─── 옛 로그의 몫 찾기(§5) 에 쓰는 read(keys) · 갱신 ─────────────────── */

describe("read(text, keys) — 호출부가 내용 식별로 고른 후보 중 지금 있는 것의 sha", () => {
  it("네 어댑터 모두 있는 키만 돌려준다", () => {
    const md = ADAPTERS["marker-md"].read(
      "<!-- uzys-harness:import:start -->\n@A\n<!-- uzys-harness:import:end -->\n",
      ["import", "nope"],
    );
    expect([...(md?.keys() ?? [])]).toEqual(["import"]);
    const js = ADAPTERS["json-keys"].read('{"mcpServers":{"a":{}},"x":1}', [
      "mcpServers.a",
      "mcpServers.b",
    ]);
    expect([...(js?.keys() ?? [])]).toEqual(["mcpServers.a"]);
    expect([...(ADAPTERS["json-keys"].read('{"x":1}')?.keys() ?? [])]).toEqual(["x"]);
    const ln = ADAPTERS.lines.read("# c\n.env\nnode_modules\n");
    expect([...(ln?.keys() ?? [])]).toEqual([".env", "node_modules"]);
    const tr = ADAPTERS["toml-region"].read(
      "# uzys-harness:top:start\na = 1\n# uzys-harness:top:end\n",
      ["top", "x"],
    );
    expect([...(tr?.keys() ?? [])]).toEqual(["top"]);
  });
});

describe("릴리즈가 몫의 값을 바꾸면 기록 sha 그대로인 키만 갈아 끼운다", () => {
  it("lines — 딸린 주석이 바뀐 줄", () => {
    const ln = ADAPTERS.lines;
    const x = "node_modules\n";
    const u = upsertOk(ln, x, new Map([[".env", "# old header\n.env"]]));
    const v2 = upsertOk(ln, u.text, new Map([[".env", "# new header\n.env"]]), u.portions);
    expect(v2.text).toBe("node_modules\n\n# new header\n.env\n");
    expect(stripOk(ln, v2.text, v2.portions).text).toBe(x);
  });

  it("toml-region — 구간 본문", () => {
    const tr = ADAPTERS["toml-region"];
    const x = 'model = "o3"\n';
    const u = upsertOk(tr, x, new Map([["tables", "[features]\na = true"]]));
    const v2 = upsertOk(tr, u.text, new Map([["tables", "[features]\na = false"]]), u.portions);
    expect(v2.text).toContain("a = false");
    expect(stripOk(tr, v2.text, v2.portions).text).toBe(x);
    // 렌더에서 빠진 구간은 upsert 가 걷는다(기록 sha 그대로일 때)
    const gone = upsertOk(tr, v2.text, new Map(), v2.portions);
    expect(gone.text).toBe(x);
  });
});

/* ─── json-keys 훅 — 핸들러 단위(#551 리뷰 B1) ──────────────────────────── */

describe("json-keys 훅 — 몫은 핸들러 하나, 같은 묶음의 다른 핸들러는 설치자 것", () => {
  const js = ADAPTERS["json-keys"];
  const protect = HOOK("protect-files.sh", { matcher: "Write|Edit" });
  const render = new Map<string, unknown>([["hooks.PreToolUse#protect-files.sh", protect]]);
  const prettier = { type: "command", command: "npx prettier --write $FILE" };

  it("하네스 묶음에 설치자가 더한 핸들러(prettier)는 strip 뒤에도 남는다", () => {
    const u = upsertOk(js, '{"permissions":{"allow":["Bash"]}}', render);
    const withMine = JSON.parse(u.text);
    withMine.hooks.PreToolUse[0].hooks.push(prettier);
    const s = stripOk(js, JSON.stringify(withMine), u.portions);
    expect(s.removed).toEqual(["hooks.PreToolUse#protect-files.sh"]);
    expect(JSON.parse(s.text)).toEqual({
      permissions: { allow: ["Bash"] },
      hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [prettier] }] },
    });
  });

  it("렌더에서 빠진 훅(은퇴 · --without)을 upsert 가 뺄 때도 형제 핸들러는 남는다", () => {
    const u = upsertOk(js, "{}", render);
    const withMine = JSON.parse(u.text);
    withMine.hooks.PreToolUse[0].hooks.push(prettier);
    const again = upsertOk(js, JSON.stringify(withMine), new Map(), u.portions);
    expect(JSON.parse(again.text).hooks.PreToolUse).toEqual([
      { matcher: "Write|Edit", hooks: [prettier] },
    ]);
  });

  it("설치자 묶음 안의 하네스 핸들러(옛 로그에서 호출부가 몫으로 넘긴 것)를 빼도 설치자 묶음은 비어도 남는다", () => {
    const mine = { hooks: { PreToolUse: [protect] } }; // 묶음을 하네스가 만들었다는 기록이 없다
    const recorded = js.read(JSON.stringify(mine), ["hooks.PreToolUse#protect-files.sh"]);
    const s = stripOk(js, JSON.stringify(mine), recorded ?? new Map());
    expect(JSON.parse(s.text)).toEqual({
      hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [] }] },
    });
  });

  const homeHook = {
    hooks: [{ type: "command", command: "bash ~/.claude/hooks/session-start.sh" }],
  };
  const sessionRender = new Map<string, unknown>([
    ["hooks.SessionStart#session-start.sh", HOOK("session-start.sh")],
  ]);

  it("홈 ~/.claude/hooks/ 의 같은 이름 스크립트는 하네스 것이 아니다 — 설치 전부터 있어도 하네스 훅은 깔린다", () => {
    const x = JSON.stringify({ hooks: { SessionStart: [homeHook] } });
    const u = upsertOk(js, x, sessionRender);
    expect(u.kept).toEqual([]);
    expect([...u.portions.keys()]).toContain("hooks.SessionStart#session-start.sh");
    expect(JSON.parse(u.text).hooks.SessionStart).toHaveLength(2);
    // 되돌리면 홈 훅만 남는다
    expect(JSON.parse(stripOk(js, u.text, u.portions).text)).toEqual(JSON.parse(x));
  });

  it("설치 뒤 홈 훅이 하네스 묶음 앞에 와도 strip 은 홈 훅을 지우지 않는다", () => {
    const u = upsertOk(js, "{}", sessionRender);
    const reordered = JSON.parse(u.text);
    reordered.hooks.SessionStart.unshift(homeHook);
    const s = stripOk(js, JSON.stringify(reordered), u.portions);
    expect(JSON.parse(s.text)).toEqual({ hooks: { SessionStart: [homeHook] } });
  });

  it("옛 절대경로 표기는 프로젝트 경로를 받을 때만 이 프로젝트 것으로 읽는다(치유기와 같은 규칙)", () => {
    const legacy = JSON.stringify({
      hooks: {
        SessionStart: [
          { hooks: [{ type: "command", command: "bash /work/p/.claude/hooks/session-start.sh" }] },
        ],
      },
    });
    const key = ["hooks.SessionStart#session-start.sh"];
    expect([...(js.read(legacy, key, "/work/p")?.keys() ?? [])]).toEqual(key);
    expect([...(js.read(legacy, key)?.keys() ?? [])]).toEqual([]);
    expect([...(js.read(legacy, key, "/work/other")?.keys() ?? [])]).toEqual([]);
  });

  it("렌더 묶음에 그 스크립트를 부르는 핸들러가 없으면 조용히 넘어가지 않는다", () => {
    const bad = new Map<string, unknown>([["hooks.SessionStart#session-start.sh", homeHook]]);
    expect(() =>
      js.upsert("{}", { render: bad, recorded: new Map(), excluded: new Set() }),
    ).toThrow(/no handler/);
  });
});

/* ─── CRLF 재체크아웃(#551 리뷰 N6) ─────────────────────────────────────── */

describe("설치 뒤 체크아웃이 CRLF 로 바꿔도 하네스 몫을 알아본다", () => {
  const crlf = (t: string) => t.replace(/\r?\n/g, "\r\n");
  const cases = [
    ["marker-md", "# P\n", new Map([["import", "@A\n\nline"]]), new Map([["import", "@B"]])],
    [
      "lines",
      "node_modules\n",
      new Map([[".env", "# h\n.env"]]),
      new Map([[".env", "# h2\n.env"]]),
    ],
    [
      "toml-region",
      'model = "o3"\n',
      new Map([["tables", "[features]\na = true"]]),
      new Map([["tables", "[features]\na = false"]]),
    ],
  ] as const;

  it.each(
    cases,
  )("%s — strip 은 CRLF 원본으로 돌아온다(끝에 \\r 이 남지 않는다) · 갱신은 고친 것으로 읽지 않는다", (name, x, v1, v2) => {
    const adapter = ADAPTERS[name];
    const u = upsertOk(adapter, x, v1);
    const onDisk = crlf(u.text);
    const s = stripOk(adapter, onDisk, u.portions);
    expect(s.kept).toEqual([]);
    expect(s.text).toBe(crlf(x));
    const again = upsertOk(adapter, onDisk, v2, u.portions);
    expect(again.kept).toEqual([]);
    expect(again.changed).toBe(true);
  });
});

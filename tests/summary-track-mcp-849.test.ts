/**
 * #849 — 확인 화면(위저드) · 설치 헤더(플래그 경로)의 자산 요약이 **트랙 기본 MCP 서버**를 센다.
 *
 * 3단계는 트랙 표가 기본으로 까는 MCP 서버(csr-supabase: railway-mcp-server · context7 · supabase · chrome-devtools)를
 * 체크된 채 보이고 실제로 `.mcp.json` · Codex · OpenCode 에 깐다(#709). 요약이 카탈로그 추천만 따로 세면 그 넷이
 * `Assets: N selected` 개수와 카테고리 줄에서 빠져, 실행 직전 마지막 화면이 디스크 결과와 어긋난다.
 * 해제했을 때만 `-Unchecked by you:` 로 보이던 비대칭도 같은 뿌리다.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderInstallHeader } from "../src/commands/install-render.js";
import { runInstall } from "../src/installer.js";
import { computeUserOverride, formatSummary, initialTargetSelection } from "../src/interactive.js";
import { DEFAULT_OPTIONS, type InstallSpec, type Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TRACKS: Track[] = ["csr-supabase"];
const MCP4 = ["chrome-devtools", "context7", "railway-mcp-server", "supabase"];

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-849-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(over: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: TRACKS,
    options: { ...DEFAULT_OPTIONS },
    cli: ["claude"],
    projectDir,
    ...over,
  } as InstallSpec;
}

/** 3단계가 체크된 채 시작하는 자산 id — 아무것도 안 건드리면 이것이 깔린다. */
function step3Defaults(): string[] {
  return initialTargetSelection(TRACKS, [])
    .filter((t) => t.startsWith("asset:"))
    .map((t) => t.slice("asset:".length));
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 이스케이프를 걷는다
const plain = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, "");

/** 요약의 `N selected` 와 카테고리 줄(`· <cat>: a, b`)에 나열된 id. */
function parse(text: string): { count: number; listed: string[] } {
  const count = Number(/(\d+) selected/.exec(text)?.[1]);
  const listed = [...text.matchAll(/· [a-z-]+: ([^\n]+)/g)]
    .filter((m) => !m[0].includes("session-start context cost"))
    .flatMap((m) => (m[1] ?? "").split(", ").map((s) => s.trim()));
  return { count, listed };
}

describe("#849 — 확인 화면 요약이 체크된 채 깔리는 트랙 기본 MCP 를 센다", () => {
  it("전제: csr-supabase 3단계는 MCP 4종을 체크된 채 시작하고, 그대로 두면 override 가 없다", () => {
    expect(step3Defaults()).toEqual(expect.arrayContaining(MCP4));
    expect(computeUserOverride(TRACKS, step3Defaults())).toBeUndefined();
  });

  it("위저드 기본값 — 개수가 3단계 체크 수와 같고, 4종이 카테고리 줄에 있다", () => {
    const { count, listed } = parse(formatSummary(spec()));
    expect(count).toBe(step3Defaults().length);
    expect(listed).toEqual(expect.arrayContaining(MCP4));
    expect(listed.length).toBe(count);
  });

  it("해제하면 — 개수·목록에서 빠지고 -Unchecked by you 로 나타난다(대칭)", () => {
    const override = computeUserOverride(
      TRACKS,
      step3Defaults().filter((id) => id !== "railway-mcp-server"),
    );
    expect(override?.forceExclude).toEqual(["railway-mcp-server"]);
    const summary = formatSummary(spec(override ? { userOverride: override } : {}));
    const { count, listed } = parse(summary);
    expect(count).toBe(step3Defaults().length - 1);
    expect(listed).not.toContain("railway-mcp-server");
    expect(summary).toContain("-Unchecked by you: railway-mcp-server");
  });

  it("플래그 경로 — 헤더 ASSETS 가 실제로 .mcp.json 에 기록되는 4종을 세고 나열한다", () => {
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec());
    const header = plain(lines.join("\n"));
    const { count, listed } = parse(header);
    expect(listed).toEqual(expect.arrayContaining(MCP4));
    expect(listed.length).toBe(count);
    expect(count).toBe(step3Defaults().length);

    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir, spec: spec() });
    const servers = Object.keys(
      (
        JSON.parse(readFileSync(join(projectDir, ".mcp.json"), "utf8")) as {
          mcpServers: Record<string, unknown>;
        }
      ).mcpServers,
    );
    expect(servers).toEqual(expect.arrayContaining(MCP4));
  });

  it("플래그 경로 --without context7 — 헤더에서 빠진다", () => {
    const lines: string[] = [];
    renderInstallHeader(
      (m) => lines.push(m),
      spec({ userOverride: { forceInclude: [], forceExclude: ["context7"] } }),
    );
    const { count, listed } = parse(plain(lines.join("\n")));
    expect(listed).not.toContain("context7");
    expect(count).toBe(step3Defaults().length - 1);
  });
});

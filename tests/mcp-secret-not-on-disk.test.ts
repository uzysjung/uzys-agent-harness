/**
 * #722 (ADR-106) — GitHub 공식 원격 MCP 의 토큰은 **어느 파일에도 쓰지 않는다**. 세 자리(`.mcp.json` · Codex · OpenCode)는
 * 환경변수 이름(`GITHUB_PAT`)만 갖고, 값은 CLI 가 실행 때 셸에서 읽는다. 렌더러가 `process.env` 를 펼치는 순간 설치자의 토큰이
 * 커밋 대상 파일(`.mcp.json` 은 팀이 커밋한다)에 박힌다 — 되돌릴 수 없는 유출이라 값으로 문다.
 */

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import { DEFAULT_OPTIONS } from "../src/types.js";

const REPO_ROOT = resolve(__dirname, "..");
const SECRET = "ghp_hunter2_do_not_write_me";
const FILES = [".mcp.json", ".codex/config.toml", "opencode.json"];

let projectDir: string;
let saved: string | undefined;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-pat-"));
  saved = process.env.GITHUB_PAT;
  process.env.GITHUB_PAT = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.GITHUB_PAT;
  else process.env.GITHUB_PAT = saved;
  rmSync(projectDir, { recursive: true, force: true });
});

describe("--with github-mcp 는 토큰 값을 어느 파일에도 쓰지 않는다", () => {
  it("세 파일에 변수 이름은 있고(대조군) 값은 없다 · Codex 평문 bearer_token 필드도 없다", () => {
    runInstall({
      runExternal: null,
      harnessRoot: REPO_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS },
        cli: ["claude", "codex", "opencode"],
        projectDir,
        userOverride: { forceInclude: ["github-mcp"], forceExclude: [] },
      },
    });
    for (const f of FILES) {
      const text = readFileSync(join(projectDir, f), "utf8");
      expect(text, `${f} — 대조군: 변수 이름은 있어야 한다`).toContain("GITHUB_PAT");
      expect(text, `${f} — 토큰 값이 파일에 박혔다`).not.toContain(SECRET);
    }
    expect(readFileSync(join(projectDir, ".codex/config.toml"), "utf8")).not.toMatch(
      /^bearer_token\s*=/m,
    );
  });
});

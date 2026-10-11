/**
 * #605 — 설치자 `.codex/config.toml` 에 `[[hooks]]` 배열이 있으면 하네스 `[[hooks.SessionStart]]` 가 그 마지막 원소 안으로
 * 들어갔고(설치자 값이 바뀐다) 화면은 아무 말도 없었다. 판정 규칙(설치자 값이 바뀌면 그 항목은 넣지 않는다)은
 * `tests/adapters.test.ts` 가 문다 — 여기는 설치 화면이 그 사실을 말하는지와 설치자 배열이 그대로인지를 본다.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readToml } from "../src/adapters/toml-region.js";
import { renderCliArtifacts } from "../src/commands/install-render.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const MINE = '[[hooks]]\nevent = "session_end"\ncommand = "my-own-hook.sh"\n';

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "codex-hooks-nesting-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

describe("#605 — 설치자 [[hooks]] 배열이 있는 .codex/config.toml 에 install", () => {
  it("설치자 배열은 그대로 · 화면의 .codex/config.toml 행이 kept yours 로 하네스 훅 항목을 말한다", () => {
    mkdirSync(join(projectDir, ".codex"), { recursive: true });
    writeFileSync(join(projectDir, ".codex/config.toml"), MINE);
    const spec: InstallSpec = {
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli: ["codex"],
      projectDir,
    };

    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec,
      mode: "add",
      runExternal: null,
    });

    const text = readFileSync(join(projectDir, ".codex/config.toml"), "utf8");
    expect(readToml(text)?.hooks).toEqual(readToml(MINE)?.hooks);
    const lines: string[] = [];
    renderCliArtifacts((m) => lines.push(m), spec, report);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
    const plain = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    const row = plain.split("\n").find((l) => l.includes(".codex/config.toml"));
    expect(row).toContain("kept yours");
    expect(row).toContain("[[hooks.SessionStart]]");
    expect(row).toContain("[[hooks.SessionStart.hooks]]");
  });
});

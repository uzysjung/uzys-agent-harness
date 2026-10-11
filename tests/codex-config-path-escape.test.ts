/**
 * #733 — 프로젝트 경로에 `"` · `\` 가 있어도 `install --cli codex` 가 끝까지 가고, 만든 `.codex/config.toml` 이 TOML 로
 * 읽히며 그 안의 경로 값(`writable_roots` · 하네스 훅 command)이 실제 경로를 가리킨다.
 *
 * 경로는 #685 의 trust 키와 같은 TOML 기본 문자열 규칙(`tomlBasicString`)으로 쓴다. `\` 는 macOS · Linux 에서도 파일
 * 이름에 쓸 수 있어 Windows 경로의 구분자와 같은 자리를 여기서 재현한다(Windows 실기는 아니다).
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installAction } from "../src/commands/install.js";
import { runInstall } from "../src/installer.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let base: string;
let savedHome: string | undefined;
let savedCodexHome: string | undefined;

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), "codex-path-escape-"));
  savedHome = process.env.HOME;
  savedCodexHome = process.env.CODEX_HOME;
  // 개발자의 실제 ~/.codex 를 건드리지 않는다
  process.env.HOME = join(base, "home");
  process.env.CODEX_HOME = join(base, "home", ".codex");
});
afterEach(() => {
  if (savedHome === undefined) Reflect.deleteProperty(process.env, "HOME");
  else process.env.HOME = savedHome;
  if (savedCodexHome === undefined) Reflect.deleteProperty(process.env, "CODEX_HOME");
  else process.env.CODEX_HOME = savedCodexHome;
  rmSync(base, { recursive: true, force: true });
});

function installCodex(projectDir: string): {
  err: ReturnType<typeof vi.fn>;
  exit: ReturnType<typeof vi.fn>;
} {
  const err = vi.fn();
  const exit = vi.fn();
  installAction(
    { cli: ["codex"], track: ["tooling"], projectDir },
    {
      log: () => {},
      err,
      exit: exit as unknown as (code: number) => never,
      resolveHarnessRoot: () => HARNESS_ROOT,
      runPipeline: (spec, harnessRoot) =>
        runInstall({ harnessRoot, projectDir: spec.projectDir, spec, runExternal: null }),
    },
  );
  return { err, exit };
}

describe("#733 — 경로에 TOML 특수 문자가 든 프로젝트의 Codex 설치", () => {
  it.each([
    ['큰따옴표 `"`', 'my "quoted" app'],
    ["역슬래시 `\\`", "C:\\Users\\me\\app"],
  ])("%s — install 이 끝까지 가고 config.toml 이 읽히며 경로 값이 원 경로와 같다", (_, name) => {
    const projectDir = join(base, name);
    mkdirSync(projectDir, { recursive: true });

    const { err, exit } = installCodex(projectDir);

    expect(err.mock.calls.flat().join("\n")).not.toContain("install failed");
    expect(exit).not.toHaveBeenCalled();
    const config = parse(readFileSync(join(projectDir, ".codex/config.toml"), "utf8")) as {
      sandbox_workspace_write: { writable_roots: string[] };
      hooks: { SessionStart: Array<{ hooks: Array<{ command: string }> }> };
    };
    expect(config.sandbox_workspace_write.writable_roots[0]).toBe(projectDir);
    expect(config.hooks.SessionStart[0]?.hooks[0]?.command).toBe(
      `${projectDir}/.codex/hooks/session-start.sh`,
    );
  });
});

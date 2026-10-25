/**
 * #911 — `uninstall --only <외부 스킬>` 도 같다(`uninstall-linked-slot-911.test.ts` 의 짝). `.agents` 를 프로젝트 안 다른 폴더로 링크해 둔
 * 설치본에서 그 스킬을 처음 더할 때 상류 파일에 덮인 설치자 파일은 백업 + displaced 로 적히고, `--only` 가 되돌리려 해도 링크 너머라
 * 하네스가 옮기지 못한다(#901) — 그 백업을 제자리로 옮기는 명령을 화면이 말한다. 파일은 건드리지 않는다.
 */

import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { runExternalInstall } from "../src/external-installer.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const found = EXTERNAL_ASSETS.find((a) => a.id === "frontend-design");
if (found === undefined) throw new Error("catalog has no frontend-design");
const FD = found;
const CLI: CliBase[] = ["claude", "codex"];
const SKILL = ".agents/skills/frontend-design/SKILL.md";
const MINE = "MINE skill\n";

let root = "";
let projectDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-911o-"));
  projectDir = join(root, "proj");
  mkdirSync(projectDir);
  mkdirSync(join(root, "home"));
  vi.stubEnv("HOME", join(root, "home"));
  vi.stubEnv("CLAUDE_CONFIG_DIR", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

const abs = (rel: string): string => join(projectDir, rel);
const ok = (): SpawnSyncReturns<string> => ({
  pid: 0,
  output: [],
  stdout: "",
  stderr: "",
  status: 0,
  signal: null,
});

/** `npx skills add … --copy` 의 디스크 효과 — 스킬 폴더를 지우고 상류 판으로 새로 만든다. */
function tool(cmd: string, args: ReadonlyArray<string>, opts: { cwd?: string }) {
  if (cmd !== "npx" || args[1] !== "add") return ok();
  const cwd = opts.cwd ?? projectDir;
  const agents = args.flatMap((a, i) => (args[i - 1] === "--agent" ? [a] : []));
  const roots = new Set(
    agents.map((a) => (a === "claude-code" ? ".claude/skills" : ".agents/skills")),
  );
  for (const r of roots) {
    const dir = join(cwd, r, "frontend-design");
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "# frontend-design upstream\n");
  }
  return ok();
}

function uninstall(dryRun = false): string {
  const lines: string[] = [];
  uninstallAction(
    { projectDir, only: "frontend-design", ...(dryRun ? { dryRun: true } : {}) },
    {
      exit: () => undefined as never,
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      spawn: (() => ok()) as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

it("`.agents` 링크 + 첫 추가가 덮은 설치자 스킬 파일: `--only` 가 못 되돌리는 대신 옮길 명령을 말한다 · 미리보기도 같다 · 명령을 치면 원본이 돌아온다", () => {
  mkdirSync(abs("dotfiles/agents/skills/frontend-design"), { recursive: true });
  symlinkSync("dotfiles/agents", abs(".agents"));
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: CLI, projectDir },
    mode: "add",
    runExternal: null,
  });
  mkdirSync(dirname(abs(SKILL)), { recursive: true });
  writeFileSync(abs(SKILL), MINE);
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: CLI,
    projectDir,
    userOverride: { forceInclude: ["frontend-design"], forceExclude: [] },
  };
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec,
    mode: "add",
    runExternal: (ctx, deps) =>
      runExternalInstall(
        { ...ctx, cli: CLI as CliTargets },
        { ...deps, assets: [FD], spawn: tool },
      ),
  });
  const backup = readdirSync(abs(dirname(SKILL))).find((n) => n.startsWith("SKILL.md.backup-"));
  expect(backup, "전제 — 첫 추가가 설치자 파일을 백업으로 비켜 두었다").toBeDefined();
  const bak = `${dirname(SKILL)}/${backup}`;

  const preview = uninstall(true);
  const text = uninstall();

  for (const screen of [preview, text]) {
    expect(screen).toContain(`${SKILL} — not put back`);
    expect(screen).toContain(`mv -i ${bak} ${SKILL}`);
  }
  // 화면이 말할 뿐이다 — 백업은 그대로
  expect(readFileSync(abs(bak), "utf8")).toBe(MINE);
  const r = spawnSync("sh", ["-c", `mv -i ${bak} ${SKILL}`], {
    cwd: projectDir,
    input: "y\n",
    encoding: "utf8",
  });
  expect(r.status, r.stderr).toBe(0);
  expect(readFileSync(abs(SKILL), "utf8")).toBe(MINE);
  expect(existsSync(abs(bak))).toBe(false);
});

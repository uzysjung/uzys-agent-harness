/**
 * #596/#629/#630/#656/#655/#611 — uninstall 회수 누수(E 클러스터)의 계약.
 *
 * - #596: `--cli antigravity` 가 형제 룰(.agents/rules/<rule>.md)도 회수한다.
 * - #629/#630: 파일 심링크(config.toml 등)는 대상까지 따라가 회수 — 단 `.agents/skills/` 링크는 건드리지 않는다(#343).
 * - #655: claude CLI 가 "not found" 로 실패하는 플러그인은 already-removed 로 성공 처리.
 * - #656: 걷어낸 AGENTS.md 에 거짓 스캐폴드 배너("not filled in yet")가 남지 않는다.
 * - #611: 전량 uninstall 후 빈 docs/decisions 디렉터를 걷는다.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-leaks-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const install = (clis: ReadonlyArray<CliBase>, tracks: ReadonlyArray<string> = ["tooling"]) =>
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: {
      tracks: [...tracks],
      options: { withCodexTrust: false },
      cli: [...clis],
      projectDir,
    } as InstallSpec,
  });

const uninstall = (options: Record<string, unknown> = {}) => {
  const lines: string[] = [];
  uninstallAction({ projectDir, yes: true, ...options } as never, {
    exit: () => undefined as never,
    log: (l: string) => lines.push(l),
    err: (l: string) => lines.push(l),
    // vitest(src) 에서 defaultHarnessRoot 가 src/ 를 가리켜 템플릿을 못 읽는다 — 배치(dist) 기준 경로 주입.
    resolveHarnessRoot: () => HARNESS_ROOT,
  });
  return lines;
};

describe("#596 — --cli antigravity 가 형제 룰을 회수한다", () => {
  it("룰 파일들이 사라진다(앵커만 아니라)", () => {
    install(["claude", "antigravity"]);
    expect(existsSync(join(projectDir, ".agents/rules/git-policy.md"))).toBe(true);
    uninstall({ cli: "antigravity" });
    expect(existsSync(join(projectDir, ".agents/rules/uzys-harness.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".agents/rules/git-policy.md"))).toBe(false);
    // .agents/skills 는 이 조합에서 antigravity 소유(codex/opencode 없음) — 함께 회수된다.
    expect(existsSync(join(projectDir, ".agents/skills"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude"))).toBe(true); // 남은 claude 는 무사
  });
});

describe("#655 — not-found 플러그인은 already-removed 로 성공", () => {
  it("exit 1 없이 기록에서 빠진다", () => {
    install(["claude"]);
    const path = join(projectDir, ".uzys-agent-harness", ".harness-install.json");
    const log = JSON.parse(readFileSync(path, "utf8")) as {
      assets: Array<{ id: string; method: string; scope: string; detail: Record<string, string> }>;
    };
    log.assets = [
      { id: "gone", method: "plugin", scope: "project", detail: { pluginId: "gone@mp" } },
    ];
    writeFileSync(path, JSON.stringify(log));
    const exit = vi.fn(() => undefined as never);
    const lines: string[] = [];
    uninstallAction({ projectDir, yes: true } as never, {
      exit,
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      spawn: () =>
        ({
          status: 1,
          stdout: "",
          stderr:
            '✘ Failed to uninstall plugin "gone@mp": Plugin "gone@mp" not found in installed plugins',
        }) as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    });
    expect(exit).not.toHaveBeenCalledWith(1);
    expect(lines.join("\n")).toContain("claude plugin uninstall"); // 되돌리기 단계는 실행됐고
    expect(lines.join("\n")).not.toMatch(/⊘.*gone.*failed/); // 실패로 보고되지 않았다
    expect(existsSync(path)).toBe(false); // 전량 uninstall 계약대로 로그는 삭제
  });
});

describe("#656 — 거짓 스캐폴드 배너가 남지 않는다", () => {
  it("씨뿌린 AGENTS.md(미편집)를 uninstall 한 뒤 배너 문장이 없다", () => {
    // CLAUDE.md 가 있는 프로젝트에 codex 설치 → AGENTS.md 씨뿌림(#528)
    writeFileSync(join(projectDir, "CLAUDE.md"), "# my project\n\nmy own notes\n", "utf8");
    install(["codex"]);
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toContain("my own notes");
    uninstall();
    if (existsSync(join(projectDir, "AGENTS.md"))) {
      expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).not.toContain(
        "SCAFFOLD — not filled in yet",
      );
    }
  });
});

describe("#611 — 빈 docs/decisions 회수", () => {
  it("전량 uninstall 후 빈 디렉터가 남지 않는다", () => {
    install(["claude"]);
    expect(existsSync(join(projectDir, "docs/decisions"))).toBe(true);
    uninstall();
    expect(existsSync(join(projectDir, "docs/decisions"))).toBe(false);
  });
});

describe("#629/#630 — 링크 따라가기: 프로젝트 안은 회수, 밖은 남김", () => {
  let outsideDir: string;
  beforeEach(() => {
    outsideDir = mkdtempSync(join(tmpdir(), "ah-leaks-outside-"));
  });
  afterEach(() => {
    rmSync(outsideDir, { recursive: true, force: true });
  });

  const hook = () => join(projectDir, ".codex", "hooks", "session-start.sh");
  const config = () => join(projectDir, ".codex", "config.toml");
  /** 실파일을 `dest` 로 옮기고 그 자리에 링크를 둔다 — 링크 대상 내용은 install 이 쓴 그대로다. */
  const relink = (link: string, dest: string) => {
    mkdirSync(join(dest, ".."), { recursive: true });
    renameSync(link, dest);
    symlinkSync(dest, link);
  };

  it("프로젝트 안 대상으로 이어진 링크는 따라가 하네스 파일을 회수하고 집계에 든다", () => {
    install(["claude", "codex"]);
    const real = join(projectDir, "sub", "real-session-start.sh");
    relink(hook(), real);
    const out = uninstall().join("\n");
    expect(existsSync(real)).toBe(false);
    expect(out).toMatch(/CLI outputs removed: \d+ file/);
  });

  it("프로젝트 안 대상으로 이어진 config.toml 은 하네스 구간을 걷는다", () => {
    install(["claude", "codex"]);
    const real = join(projectDir, "sub", "real.toml");
    relink(config(), real);
    writeFileSync(real, `${readFileSync(real, "utf8")}\n# mine\n[user]\nkeep = true\n`);
    uninstall();
    const after = existsSync(real) ? readFileSync(real, "utf8") : "";
    expect(after).toContain("keep = true");
    expect(after).not.toMatch(/uzys|harness/i);
  });

  it("프로젝트 밖 대상 파일 링크는 바이트 그대로 남고 보고에 경로가 나온다", () => {
    install(["claude", "codex"]);
    const real = join(outsideDir, "shared-hook.sh");
    relink(hook(), real);
    const before = readFileSync(real);
    const out = uninstall().join("\n");
    expect(existsSync(real)).toBe(true);
    expect(readFileSync(real).equals(before)).toBe(true);
    expect(out).toContain(real);
    expect(out).toMatch(/outside the project/);
  });

  it("프로젝트 밖 대상의 config.toml 은 하네스 구간을 걷지 않고 남김으로 보고한다", () => {
    install(["claude", "codex"]);
    const real = join(outsideDir, "shared.toml");
    relink(config(), real);
    const before = readFileSync(real);
    const out = uninstall().join("\n");
    expect(readFileSync(real).equals(before)).toBe(true);
    expect(out).toContain(real);
    // externalFiles·portions 양쪽에 기록돼도 남김 줄은 한 번이다
    expect(out.split(real).length - 1).toBe(1);
  });

  it("이동 대상 디렉터 밖 자리(.agents/rules)의 링크도 대상이 밖이면 지우지 않는다", () => {
    install(["claude", "antigravity"]);
    const link = join(projectDir, ".agents", "rules", "git-policy.md");
    const real = join(outsideDir, "rule.md");
    rmSync(real, { force: true });
    renameSync(link, real);
    symlinkSync(real, link);
    const before = readFileSync(real);
    const out = uninstall().join("\n");
    expect(existsSync(real)).toBe(true);
    expect(readFileSync(real).equals(before)).toBe(true);
    expect(out).toContain(real);
  });

  it("상위 **폴더** 링크가 밖을 가리켜도(.agents/rules → 밖) 그 안의 하네스 룰은 지우지 않는다", () => {
    install(["claude", "antigravity"]);
    const dir = join(projectDir, ".agents", "rules");
    const realDir = join(outsideDir, "rules");
    renameSync(dir, realDir);
    symlinkSync(realDir, dir);
    const snap = () => readdirSync(realDir).map((f) => [f, readFileSync(join(realDir, f), "utf8")]);
    const before = snap();
    expect(before.length).toBeGreaterThan(0);
    const out = uninstall().join("\n");
    expect(snap()).toEqual(before);
    expect(out).toContain(realDir);
  });
});

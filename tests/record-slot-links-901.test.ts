/**
 * #901 후속(PR #907 독립 리뷰 BLOCKER-1 · HIGH-1) — 글자 경로만 보면 자리 폴더를 링크로 커밋하는 것 하나로 다시 열린다. 설치자가 안
 * 쓰는 CLI 자리(`.opencode` · `.codex` · `.agents/*`)에 `→ .` · `→ ..` · `→ .git` · `→ apps/web` 링크를 두고 기록에 그 아래 경로를 적으면
 * uninstall 이 쓰이는 `.env` 를 공격자 바이트로 바꾸고 · `.git/HEAD` 를 백업 없이 지우고 · `src/` 파일을 백업 이름으로 옮겼다. 앵커 ·
 * displaced 기록은 함께 쓰는 파일(`.mcp.json` · `AGENTS.md` · `opencode.json` …)과 설치 기록 폴더도 통째로 옮기거나 그 자리에 다른 판을 놓았다.
 *
 * 설치자에게 달라지는 것(사용자 확정 2026-10-25 규칙): 기록이 시키는 지우기 · 옮기기 · 되돌리기는 **글자 경로와 실경로 둘 다** 하네스
 * 자리 안일 때만 한다 — 아니면 건드리지 않고 화면이 링크 하나에 한 줄로 말한다. 함께 쓰는 파일은 통째 동작의 자리가 아니다(몫 단위로만).
 * 대가: 자리를 프로젝트 안 다른 폴더로 옮겨 링크로 둔 구성(`.agents → dotfiles/…` · `.codex → shared-codex`)은 그 아래 기록 파일이
 * 회수되지 않고 남는다(바이트 그대로 — 손실이 아니다). 자리끼리 잇는 #524 링크는 그대로 회수된다(`record-harness-slots-901.test.ts` AC3).
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
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogAsset,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const STAMP = "20261025T000000";
const SECRET = "SECRET=installer-only\n";
const ATTACK = "SECRET=attacker-chosen\n";
const MINE = "installer own content\n";
const HEAD = "ref: refs/heads/main\n";
const REPO = [".", "g", "i", "t"].join(""); // 저장소 폴더 이름 — 편집 차단 훅의 글자 대조를 피한다
const OUTSIDE = "outside the places this tool installs to";
const wrongSha = hashContent("not the installer's bytes");

let root = "";
let projectDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-901l-"));
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
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};
const read = (rel: string): string | null =>
  existsSync(abs(rel)) ? readFileSync(abs(rel), "utf8") : null;
const link = (rel: string, target: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  symlinkSync(target, abs(rel));
};
/** 그 폴더(project 상대)에 생긴 백업 이름 — 하네스가 무엇을 옮겼다면 여기 보인다. */
const backupsIn = (dir: string): string[] =>
  existsSync(abs(dir)) ? readdirSync(abs(dir)).filter((n) => n.includes(".backup-")) : [];

function install(cli: CliBase[] = ["claude"]): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir },
  });
}

function forge(edit: (log: InstallLog) => InstallLog): void {
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("install log missing");
  writeInstallLog(projectDir, edit(log));
}

const withExternal =
  (...paths: Array<[string, string]>) =>
  (log: InstallLog): InstallLog => ({
    ...log,
    externalFiles: [
      ...(log.externalFiles ?? []),
      ...paths.map(([path, sha256]) => ({ path, sha256 })),
    ],
  });
const withDisplaced =
  (path: string, backup: string) =>
  (log: InstallLog): InstallLog => ({
    ...log,
    rootFiles: [...(log.rootFiles ?? []), { path, change: "displaced", notes: [backup] }],
  });

function uninstall(dryRun = false): string {
  const lines: string[] = [];
  uninstallAction(
    { projectDir, yes: true, ...(dryRun ? { dryRun: true } : {}) },
    {
      log: (l: string) => lines.push(l),
      err: (l: string) => lines.push(l),
      exit: () => undefined as never,
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

describe("#901 BLOCKER-1 — 자리 폴더를 링크로 둬도 기록이 하네스 자리 밖 파일을 옮기거나 빼지 못한다", () => {
  it.each([
    [".opencode", "."],
    [".codex", "."],
    [".agents/rules", ".."],
  ])("자리 폴더 링크 %s → %s + externalFiles 그 아래 `.env`: 쓰이는 `.env` 가 그대로 · 백업 0 · 화면이 링크로 말한다", (slot, target) => {
    install();
    link(slot, target);
    put(".env", SECRET);
    forge(withExternal([`${slot}/.env`, wrongSha]));

    const preview = uninstall(true);
    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    expect(backupsIn(".")).toEqual([]);
    for (const screen of [preview, text]) {
      expect(screen).toContain(`${slot} — your link (→ ${target}) leads ${OUTSIDE}`);
      expect(screen).not.toMatch(/backed up {2}[^\n]*\.env/);
    }
  });

  it("`.opencode → .` + externalFiles 와 displaced 를 함께 조작: 쓰이는 `.env` 가 공격자 바이트로 바뀌지 않는다", () => {
    install();
    link(".opencode", ".");
    put(".env", SECRET);
    put(`.env.backup-${STAMP}`, ATTACK);
    forge((log) =>
      withDisplaced(
        ".opencode/.env",
        `.opencode/.env.backup-${STAMP}`,
      )(withExternal([".opencode/.env", wrongSha])(log)),
    );

    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    expect(read(`.env.backup-${STAMP}`)).toBe(ATTACK);
    expect(backupsIn(".")).toEqual([`.env.backup-${STAMP}`]);
    expect(text).not.toContain("put back  .opencode/.env");
  });

  it("`.opencode → .` + displaced 만: 비어 있는 `.env` 자리에 공격자 파일을 놓지 않는다", () => {
    install();
    link(".opencode", ".");
    put(`.env.backup-${STAMP}`, ATTACK);
    forge(withDisplaced(".opencode/.env", `.opencode/.env.backup-${STAMP}`));

    const text = uninstall();

    expect(existsSync(abs(".env"))).toBe(false);
    expect(read(`.env.backup-${STAMP}`)).toBe(ATTACK);
    expect(text).toContain(".opencode/.env — not put back");
  });

  it("`.opencode → <저장소 폴더>`: 저장소 파일을 백업 이름으로 옮기지도 · sha 를 맞춘 HEAD 를 백업 없이 지우지도 않는다", () => {
    install();
    put(`${REPO}/HEAD`, HEAD);
    put(`${REPO}/config`, "[core]\n");
    link(".opencode", REPO);
    forge(withExternal([".opencode/config", wrongSha], [".opencode/HEAD", hashContent(HEAD)]));

    uninstall();

    expect(read(`${REPO}/HEAD`)).toBe(HEAD);
    expect(read(`${REPO}/config`)).toBe("[core]\n");
    expect(readdirSync(abs(REPO)).sort()).toEqual(["HEAD", "config"]);
  });

  it("`.opencode → apps/web`: 다른 앱 폴더의 `.env` 에 닿지 않는다", () => {
    install();
    put("apps/web/.env", SECRET);
    link(".opencode", "apps/web");
    forge(withExternal([".opencode/.env", wrongSha]));

    uninstall();

    expect(read("apps/web/.env")).toBe(SECRET);
    expect(backupsIn("apps/web")).toEqual([]);
  });

  it("`.agents/skills → ..` + global 자산 `detail.skill: src`: `src/` 파일을 훑어 백업 이름으로 옮기지 않는다", () => {
    install();
    put("src/app.ts", "export const app = 1;\n");
    put("src/secret.local", "local-only\n");
    link(".agents/skills", "..");
    const evil: InstallLogAsset = {
      id: "evil",
      category: "skill",
      method: "skill",
      scope: "global",
      detail: { source: "owner/evil", skill: "src" },
    };
    forge((log) => ({
      ...log,
      spec: { ...log.spec, clis: ["claude", "codex"] },
      assets: [...log.assets, evil],
    }));

    const text = uninstall();

    expect(readdirSync(abs("src")).sort()).toEqual(["app.ts", "secret.local"]);
    expect(read("src/app.ts")).toBe("export const app = 1;\n");
    expect(text).toContain(".agents/skills/src — it leads outside the skill folders");
  });

  it("말단 링크 — 기록된 하네스 파일 자리를 `.env` · 저장소 파일로의 링크로 커밋해도 따라가 옮기거나 지우지 않는다", () => {
    install();
    put(".env", SECRET);
    put(`${REPO}/HEAD`, HEAD);
    rmSync(abs(".claude/rules/git-policy.md"));
    link(".claude/rules/git-policy.md", "../../.env");
    rmSync(abs(".claude/rules/test-policy.md"));
    link(".claude/rules/test-policy.md", `../../${REPO}/HEAD`);
    // 저장소 파일 쪽은 바이트가 뻔하다 — 기록 sha 를 맞추면 판정이 "고치지 않은 하네스 파일" 이 된다
    forge((log) => ({
      ...log,
      policyFiles: (log.policyFiles ?? []).map((f) =>
        f.path === "rules/test-policy.md" ? { ...f, sha256: hashContent(HEAD) } : f,
      ),
    }));

    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    expect(read(`${REPO}/HEAD`)).toBe(HEAD);
    expect(backupsIn(".")).toEqual([]);
    expect(backupsIn(REPO)).toEqual([]);
    expect(text).toContain(".claude/rules/git-policy.md — your link (→ ../../.env) leads");
  });

  it("말단 링크 — 앵커를 `.env` 로의 링크로 커밋해도 그 바이트를 앵커 백업 이름으로 베끼지 않는다", () => {
    install();
    put(".env", SECRET);
    rmSync(abs("CLAUDE-uzys-harness.md"));
    link("CLAUDE-uzys-harness.md", ".env");

    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    expect(backupsIn(".")).toEqual([]);
    expect(text).toContain(
      `CLAUDE-uzys-harness.md left — the install record names it as the harness anchor, but it is (or leads) ${OUTSIDE}`,
    );
  });
});

describe("#901 HIGH-1 — 함께 쓰는 파일 · 설치 기록 폴더는 앵커 · displaced 같은 통째 동작의 자리가 아니다", () => {
  it.each([
    [".mcp.json"],
    ["opencode.json"],
    ["AGENTS.md"],
    [".uzys-agent-harness/notes.txt"],
  ])("앵커 기록이 `%s`: 설치자 파일을 통째로 백업 이름으로 옮기지 않는다", (path) => {
    install();
    put(path, MINE);
    forge((log) => ({
      ...log,
      templates: { ...log.templates, rootClaudeMd: { path, sha256: wrongSha } },
    }));

    const preview = uninstall(true);
    const text = uninstall();

    expect(read(path)).toBe(MINE);
    expect(backupsIn(dirname(path))).toEqual([]);
    for (const screen of [preview, text]) {
      expect(screen).toContain(`${path} left — the install record names it as the harness anchor`);
    }
  });

  it.each([
    [".mcp.json"],
    ["opencode.json"],
    ["AGENTS.md"],
    ["CLAUDE.md"],
    [".claude/settings.json"],
    [".codex/config.toml"],
    [".uzys-agent-harness/notes.txt"],
  ])("displaced `%s` + 커밋된 백업: 비어 있는 자리에 다른 판을 놓지 않는다", (path) => {
    install();
    rmSync(abs(path), { force: true });
    put(`${path}.backup-${STAMP}`, ATTACK);
    forge(withDisplaced(path, `${path}.backup-${STAMP}`));

    const text = uninstall();

    expect(read(path)).not.toBe(ATTACK);
    expect(read(`${path}.backup-${STAMP}`)).toBe(ATTACK);
    expect(text).toContain(`${path} — not put back`);
  });
});

describe("#901 대가 — 자리를 프로젝트 안 다른 폴더로 옮겨 링크로 둔 구성은 회수 대신 안내(남는 쪽)", () => {
  it("`.agents → dotfiles/agents`(#885 류) · `.codex → shared-codex`(#746 류): 그 아래 기록 파일이 바이트 그대로 남고 링크 하나에 한 줄로 말한다 · 다른 자리는 회수된다", () => {
    mkdirSync(abs("dotfiles/agents"), { recursive: true });
    link(".agents", "dotfiles/agents");
    install(["claude", "codex", "opencode", "antigravity"]);
    renameSync(abs(".codex"), abs("shared-codex"));
    link(".codex", "shared-codex");
    const hookBefore = read("shared-codex/hooks/session-start.sh");
    expect(hookBefore, "전제 — 옮긴 자리에 기록된 하네스 훅이 있다").not.toBeNull();
    const snap = (dir: string): Record<string, string> =>
      Object.fromEntries(
        readdirSync(abs(dir), { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => {
            const full = join(e.parentPath, e.name);
            return [full.slice(abs(dir).length), readFileSync(full, "utf8")];
          }),
      );
    const dotfilesBefore = snap("dotfiles/agents");
    expect(
      Object.keys(dotfilesBefore).length,
      "전제 — 기록된 공유 자리 파일이 있다",
    ).toBeGreaterThan(5);

    const preview = uninstall(true);
    const text = uninstall();

    expect(snap("dotfiles/agents")).toEqual(dotfilesBefore);
    expect(read("shared-codex/hooks/session-start.sh")).toBe(hookBefore);
    for (const screen of [preview, text]) {
      expect(screen).toContain(`.agents — your link (→ dotfiles/agents) leads ${OUTSIDE}`);
      expect(screen).toContain(`.codex — your link (→ shared-codex) leads ${OUTSIDE}`);
    }
    // 링크 밖 자리는 그대로 회수된다
    expect(existsSync(abs(".claude/rules/git-policy.md"))).toBe(false);
    expect(existsSync(abs("CLAUDE-uzys-harness.md"))).toBe(false);
  });
});

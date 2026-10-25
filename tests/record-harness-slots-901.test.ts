/**
 * #901 — 설치 기록(`.uzys-agent-harness/.harness-install.json`)은 커밋되는 파일이라 믿을 수 없다. 조작된 기록이 하네스 자리 밖 경로를
 * 적으면 uninstall 이 그대로 따랐다: displaced `path: .env` + 커밋된 `.env.backup-<시각>` 이면 비어 있는 `.env` 자리에 그 파일을 놓고,
 * `externalFiles: .env`(그리고 다른 기록 필드 · 앵커 · 외부 스킬 파일)면 설치자 `.env` 를 백업 이름으로 옮겨 실제 자리에서 뺐다.
 * `.env` 처럼 gitignore 된 파일은 커밋으로 바꿀 수 없는데, 이 길이 그 한계를 넘게 해 줬다.
 *
 * 설치자에게 달라지는 것: 남이 커밋한 기록을 받은 프로젝트에서 uninstall 을 돌려도 하네스 자리(소유 표 — `.claude/` · `.codex/` ·
 * `.agents/skills/` · 앵커 …) 밖의 파일은 옮겨지지도 · 빠지지도 · 다른 내용으로 바뀌지도 않고, 화면이 "기록이 적었지만 이 도구가
 * 까는 자리 밖이라 건드리지 않았다" 고 말한다. 하네스가 만든 정상 기록(자리째 링크로 옮긴 구성 포함)의 회수 · 되돌리기는 그대로다.
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
import { restoreDisplaced } from "../src/displaced.js";
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
const MINE = "# my own team rule — not the harness one\n";

let root = "";
let projectDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-901-"));
  projectDir = join(root, "proj");
  mkdirSync(projectDir);
  // 외부 스킬 회수(#851)가 읽는 홈 — 실제 홈을 읽지 않는다
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
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
/** 프로젝트 루트의 `.env` 백업 — 하네스가 `.env` 를 옮겼다면 여기 생긴다. */
const envBackups = (): string[] =>
  readdirSync(projectDir).filter((n) => n.startsWith(".env.backup-"));

function install(cli: CliBase[] = ["claude"]): InstallLog {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir },
  });
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("install log missing");
  return log;
}

/** 남이 커밋한 기록 — 지금 기록을 고쳐 다시 쓴다. */
function forge(edit: (log: InstallLog) => InstallLog): void {
  const log = readInstallLog(projectDir);
  if (log === null) throw new Error("install log missing");
  writeInstallLog(projectDir, edit(log));
}

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

const OUTSIDE = "outside the places this tool installs to";

describe("#901 AC1 — 기록의 displaced 자리가 하네스 자리 밖이면 되돌리지 않고 말한다", () => {
  it("uninstall --yes — `.env` 자리 + 커밋된 `.env.backup-<시각>`: 빈 `.env` 자리에 아무것도 놓지 않는다", () => {
    install();
    put(`.env.backup-${STAMP}`, ATTACK);
    forge((log) => ({
      ...log,
      rootFiles: [
        ...(log.rootFiles ?? []),
        { path: ".env", change: "displaced", notes: [`.env.backup-${STAMP}`] },
      ],
    }));

    const preview = uninstall(true);
    const text = uninstall();

    expect(existsSync(abs(".env"))).toBe(false);
    expect(read(`.env.backup-${STAMP}`)).toBe(ATTACK);
    for (const screen of [preview, text]) {
      expect(screen).toContain(".env — not put back");
      expect(screen).toContain(OUTSIDE);
      expect(screen).not.toContain("put back  .env");
      expect(screen).not.toMatch(/put back \d+ file\(s\) of yours \(displaced\): \.env/);
    }
  });

  // [이름, 기록의 자리, 디스크 준비] — 백업은 늘 그 자리 옆 `.backup-<시각>`(#894 이름 판정은 통과한다)
  const FORGED: Array<[string, string, () => void]> = [
    ["루트의 `.env`", ".env", () => undefined],
    ["하네스 자리 아닌 폴더의 `.env`", "src/.env", () => undefined],
    ["`../` 로 하네스 자리에서 빠져나온 경로", ".claude/../.env", () => undefined],
    ["프로젝트 이름을 거쳐 돌아 들어오는 경로", ".codex/../../proj/.env", () => undefined],
    [
      "하네스 자리 안의 폴더 링크로 루트에 닿는 경로(정규화로는 안 보인다)",
      ".claude/evil/.env",
      () => symlinkSync("..", abs(".claude/evil")),
    ],
  ];
  it.each(FORGED)("restoreDisplaced — %s", (_label, path, prepare) => {
    const log = install();
    prepare();
    const backup = `${path}.backup-${STAMP}`;
    put(backup, ATTACK);
    log.rootFiles = [{ path, change: "displaced", notes: [backup] }];

    const [out] = restoreDisplaced(log, projectDir, { has: () => true, write: true });

    expect(out).toMatchObject({ path, verdict: "advise", forget: true });
    expect(out?.line).toContain(OUTSIDE);
    expect(existsSync(abs(path))).toBe(false);
    expect(read(backup)).toBe(ATTACK);
  });
});

describe("#901 AC2 — 기록이 하네스(그 자산의) 자리 밖 설치자 파일을 적으면 옮기지도 빼지도 않는다", () => {
  const asset = (over: Partial<InstallLogAsset>): InstallLogAsset => ({
    id: "evil",
    category: "skill",
    method: "skill",
    scope: "project",
    detail: { source: "owner/evil", skill: "evil" },
    ...over,
  });
  const wrongSha = hashContent("not the installer's bytes");
  // [이름, 기록 조작, 디스크 준비]
  const FORGED: Array<[string, (log: InstallLog) => InstallLog, () => void]> = [
    [
      "externalFiles 에 `.env`",
      (log) => ({
        ...log,
        externalFiles: [...(log.externalFiles ?? []), { path: ".env", sha256: wrongSha }],
      }),
      () => undefined,
    ],
    [
      "externalFiles 에 하네스 자리 안 폴더 링크를 거친 `.env`",
      (log) => ({
        ...log,
        externalFiles: [
          ...(log.externalFiles ?? []),
          { path: ".claude/evil/.env", sha256: wrongSha },
        ],
      }),
      () => symlinkSync("..", abs(".claude/evil")),
    ],
    [
      "policyFiles 에 `../.env`(`.claude/` 상대)",
      (log) => ({
        ...log,
        policyFiles: [...(log.policyFiles ?? []), { path: "../.env", sha256: wrongSha }],
      }),
      () => undefined,
    ],
    [
      "skillFiles 에 `../../.env`(`.claude/skills/` 상대)",
      (log) => ({
        ...log,
        skillFiles: [...(log.skillFiles ?? []), { path: "../../.env", sha256: wrongSha }],
      }),
      () => undefined,
    ],
    [
      "앵커 기록(`templates.rootClaudeMd`)이 `.env`",
      (log) => ({
        ...log,
        templates: { ...log.templates, rootClaudeMd: { path: ".env", sha256: wrongSha } },
      }),
      () => undefined,
    ],
    [
      "project 외부 스킬 자산의 `files` 에 `.env`",
      (log) => ({
        ...log,
        assets: [...log.assets, asset({ files: [{ path: ".env", sha256: wrongSha }] })],
      }),
      () => undefined,
    ],
    [
      "global 외부 스킬 자산의 `detail.skill` 이 `../..`(프로젝트 사본 회수 자리가 프로젝트 루트가 된다)",
      (log) => ({
        ...log,
        assets: [
          ...log.assets,
          asset({ scope: "global", detail: { source: "owner/evil", skill: "../.." } }),
        ],
      }),
      () => undefined,
    ],
  ];
  it.each(FORGED)("uninstall --yes — %s: `.env` 가 제자리에 남는다", (_l, edit, prepare) => {
    install();
    prepare();
    put(".env", SECRET);
    forge(edit);

    const preview = uninstall(true);
    expect(read(".env"), "미리보기는 아무것도 바꾸지 않는다").toBe(SECRET);
    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    expect(envBackups()).toEqual([]);
    for (const screen of [preview, text]) {
      expect(screen).not.toMatch(/backed up {2}[^\n]*\.env\b/);
      expect(screen).not.toMatch(/\.env removed/);
    }
  });

  it("uninstall --yes — `externalFiles: .env` 는 화면이 기록에 있지만 자리 밖이라 건드리지 않았다고 말한다(미리보기 · 실행 같은 말)", () => {
    install();
    put(".env", SECRET);
    forge((log) => ({
      ...log,
      externalFiles: [...(log.externalFiles ?? []), { path: ".env", sha256: wrongSha }],
    }));

    const preview = uninstall(true);
    const text = uninstall();

    for (const screen of [preview, text]) {
      expect(screen).toContain(`.env left — the install record lists it, but it is ${OUTSIDE}`);
      expect(screen).not.toContain("harness file(s) under .env");
    }
  });
});

describe("#901 AC3 — 하네스가 만든 정상 기록의 회수 · 되돌리기는 그대로", () => {
  it("네 CLI · 자리째 프로젝트 안 다른 폴더로 옮긴 `.agents` · `.codex` · 비켜 둔 설치자 룰: 기록된 하네스 파일이 다 회수되고 원본이 돌아온다", () => {
    // 설치자가 `.agents` 를 dotfiles 식 폴더로 둔 프로젝트(#885)
    mkdirSync(abs("dotfiles/agents"), { recursive: true });
    symlinkSync("dotfiles/agents", abs(".agents"));
    put(".claude/rules/git-policy.md", MINE);
    install(["claude", "codex", "opencode", "antigravity"]);
    // install 뒤 `.codex` 를 프로젝트 안 다른 폴더로 옮기고 링크를 건다(#746 회귀와 같은 구성)
    renameSync(abs(".codex"), abs("shared-codex"));
    symlinkSync("shared-codex", abs(".codex"));
    const log = readInstallLog(projectDir);
    if (log === null) throw new Error("install log missing");
    const recordedPaths = [
      ...(log.policyFiles ?? []).map((f) => `.claude/${f.path}`),
      ...(log.skillFiles ?? []).map((f) => `.claude/skills/${f.path}`),
      ...(log.externalFiles ?? []).map((f) => f.path),
    ].filter((p) => p !== "AGENTS.md" && p !== "opencode.json" && p !== ".codex/config.toml");
    expect(recordedPaths.length, "전제 — 기록이 하네스 파일을 적었다").toBeGreaterThan(20);
    expect(
      (log.rootFiles ?? []).some(
        (f) => f.path === ".claude/rules/git-policy.md" && f.change === "displaced",
      ),
      "전제 — 설치자 룰을 비켜 두고 displaced 로 적었다",
    ).toBe(true);

    const preview = uninstall(true);
    const text = uninstall();

    for (const screen of [preview, text]) expect(screen).not.toContain(OUTSIDE);
    expect(read(".claude/rules/git-policy.md")).toBe(MINE);
    expect(text).toContain("put back  .claude/rules/git-policy.md");
    const left = recordedPaths.filter(
      (p) => p !== ".claude/rules/git-policy.md" && existsSync(abs(p)),
    );
    expect(left).toEqual([]);
  });

  it("옛 판 모양의 기록(writer 표시 · 몫 기록 없음)도 하네스 파일을 회수하고 자리 밖이라 말하지 않는다", () => {
    install();
    forge((log) => {
      const { records: _r, portions: _p, ...legacy } = log;
      return legacy as InstallLog;
    });

    const text = uninstall();

    expect(text).not.toContain(OUTSIDE);
    expect(existsSync(abs(".claude/rules/git-policy.md"))).toBe(false);
    expect(existsSync(abs("CLAUDE-uzys-harness.md"))).toBe(false);
  });
});

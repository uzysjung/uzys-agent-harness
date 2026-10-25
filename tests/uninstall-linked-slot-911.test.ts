/**
 * #911 (PR #910 독립 리뷰 HIGH-1) — 하네스 자리를 프로젝트 안 다른 폴더로 링크해 둔 설치본(`.agents → dotfiles/agents` ·
 * `.codex → shared-codex`)은 #901 뒤로 기록이 시키는 회수가 안내로 바뀐다(손실이 아니라 남는 쪽). 그 안내가 설치자 손에 잡히게 화면이
 * 둘을 말한다:
 *   ① 남긴 하네스 파일을 개수만이 아니라 경로 하나하나로
 *   ② 하네스가 비켜 둔(displaced) 설치자 파일을 제자리로 옮기는 명령 — 화면이 말할 뿐 하네스는 옮기지 않는다(파일은 그대로)
 * 화면과 `--dry-run` 만 달라진다 — 무엇을 지우고 옮기고 남기는가는 그대로이고, 실디렉터리 기본 레이아웃의 화면도 그대로다.
 */

import { spawnSync } from "node:child_process";
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
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const STAMP = "20261025T000000";
const MINE = "installer own content\n";
const RULE = ".agents/rules/git-policy.md";
const ALL_CLI: CliBase[] = ["claude", "codex", "opencode", "antigravity"];

let root = "";
let projectDir = "";
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "ah-911-"));
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
/** 폴더 아래 파일 전부(`상대 경로 → 바이트`). */
const snap = (dir: string): Record<string, string> =>
  Object.fromEntries(
    existsSync(abs(dir))
      ? readdirSync(abs(dir), { recursive: true, withFileTypes: true })
          .filter((e) => e.isFile())
          .map((e) => {
            const full = join(e.parentPath, e.name);
            return [full.slice(abs(dir).length + 1), readFileSync(full, "utf8")];
          })
      : [],
  );
const backupOf = (slot: string): string | undefined =>
  readdirSync(abs(dirname(slot))).find((n) => n.startsWith(`${slot.split("/").pop()}.backup-`));

function install(cli: CliBase[]): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir },
  });
}

function forgeDisplaced(path: string, backup: string): void {
  const log = readInstallLog(projectDir) as InstallLog;
  writeInstallLog(projectDir, {
    ...log,
    rootFiles: [...(log.rootFiles ?? []), { path, change: "displaced", notes: [backup] }],
  });
}

function forgeExternal(path: string): void {
  const log = readInstallLog(projectDir) as InstallLog;
  writeInstallLog(projectDir, {
    ...log,
    externalFiles: [...(log.externalFiles ?? []), { path, sha256: "0".repeat(64) }],
  });
}

function forgePolicy(path: string): void {
  const log = readInstallLog(projectDir) as InstallLog;
  writeInstallLog(projectDir, {
    ...log,
    policyFiles: [...(log.policyFiles ?? []), { path, sha256: "0".repeat(64) }],
  });
}

function uninstall(opts: { dryRun?: boolean; cli?: string } = {}): string {
  const lines: string[] = [];
  uninstallAction(
    {
      projectDir,
      yes: true,
      ...(opts.dryRun ? { dryRun: true } : {}),
      ...(opts.cli === undefined ? {} : { cli: opts.cli }),
    },
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

/** 화면의 "손으로 끝낼 것" 덩어리가 링크 아래 하나하나 댄 경로(들여쓰기 8칸 — 링크 이름으로 시작하는 것만). */
const listedPaths = (screen: string): string[] =>
  [...screen.matchAll(/^ {8}(\.(?:agents|codex)\/\S+)/gm)].map((m) => m[1] as string).sort();
/** 화면이 말한 `mv` 명령 줄. */
const mvLines = (screen: string): string[] =>
  [...screen.matchAll(/^ {8}(mv -i .*)$/gm)].map((m) => m[1] as string);
/** "손으로 끝낼 것" 덩어리 — 머리줄부터 이어지는 들여쓴 줄(없으면 빈 배열). */
function handBlock(screen: string): string[] {
  const lines = screen.split("\n");
  const at = lines.findIndex((l) => l.includes("left for you to finish by hand"));
  if (at < 0) return [];
  const out = [lines[at] as string];
  for (const l of lines.slice(at + 1)) {
    if (!l.startsWith("      ")) break;
    out.push(l);
  }
  return out;
}
/** 덩어리의 "이름 없이 센" 줄 — 덩어리마다 많아야 하나. */
const countLines = (screen: string): string[] =>
  handBlock(screen).filter((l) => l.includes("not shown —"));

/** 설치자가 `.agents` 를 dotfiles 식 폴더로 · `.codex` 를 공유 폴더로 링크해 둔 프로젝트(#885 · #746) + 그 자리에 비켜 둔 설치자 룰 하나. */
function linkedLayout(): void {
  mkdirSync(abs("dotfiles/agents"), { recursive: true });
  link(".agents", "dotfiles/agents");
  put(RULE, MINE);
  install(ALL_CLI);
  renameSync(abs(".codex"), abs("shared-codex"));
  link(".codex", "shared-codex");
}

describe("#911 AC1 — 링크로 둔 자리에서 남긴 하네스 파일을 경로로 나열한다", () => {
  it("`.agents` · `.codex` 링크: 미리보기도 실행도 남은 파일을 하나하나 대고, 그 목록이 디스크에 실제로 남은 것과 같다", () => {
    linkedLayout();

    const preview = uninstall({ dryRun: true });
    const text = uninstall();

    const left = [
      ...Object.keys(snap("dotfiles/agents")).map((k) => `.agents/${k}`),
      ...Object.keys(snap("shared-codex")).map((k) => `.codex/${k}`),
    ]
      .filter((p) => !p.includes(".backup-"))
      .sort();
    expect(left.length, "전제 — 링크 너머에 하네스 파일이 많이 남는다").toBeGreaterThan(40);
    for (const screen of [preview, text]) {
      expect(listedPaths(screen)).toEqual(left);
      // 링크 하나에 한 줄로 개수를 말하던 줄은 그대로다
      expect(screen).toContain(".agents — your link (→ dotfiles/agents) leads outside");
      expect(screen).toContain(".codex — your link (→ shared-codex) leads outside");
    }
  });

  it("`--cli codex`(`.codex` 링크)도 같다 — 미리보기 · 실행이 남은 파일을 경로로 댄다", () => {
    install(["claude", "codex"]);
    renameSync(abs(".codex"), abs("shared-codex"));
    link(".codex", "shared-codex");

    const preview = uninstall({ dryRun: true, cli: "codex" });
    const text = uninstall({ cli: "codex" });

    const left = Object.keys(snap("shared-codex"))
      .map((k) => `.codex/${k}`)
      .sort();
    expect(left.length, "전제 — 링크 너머에 하네스 파일이 남는다").toBeGreaterThan(0);
    for (const screen of [preview, text]) expect(listedPaths(screen)).toEqual(left);
  });
});

describe("#911 AC2 — 되돌리지 않은 displaced 설치자 파일은 손으로 옮길 명령이 나온다", () => {
  it("링크로 둔 `.agents` 의 비켜 둔 룰: 백업을 제자리로 옮기는 명령이 화면에 나오고 · 파일은 건드리지 않으며 · 명령을 그대로 치면 원본이 돌아온다", () => {
    linkedLayout();
    const backup = backupOf(RULE);
    expect(backup, "전제 — 설치가 설치자 룰을 백업으로 비켜 두었다").toBeDefined();
    const bak = `.agents/rules/${backup}`;
    const before = snap("dotfiles/agents");
    expect(read(RULE)).not.toBe(MINE);

    const preview = uninstall({ dryRun: true });
    expect(snap("dotfiles/agents")).toEqual(before);
    const text = uninstall();
    // 화면이 말할 뿐이다 — 백업도 하네스 판도 uninstall 전후로 바이트 그대로
    expect(snap("dotfiles/agents")).toEqual(before);

    for (const screen of [preview, text]) {
      expect(mvLines(screen)).toEqual([`mv -i ${bak} ${RULE}`]);
      // 지우지 말라는 표시 — 이 자리는 곧 설치자 원본이 돌아올 자리다
      expect(screen).toContain(`${RULE}  (your own file goes back here — do not delete)`);
    }
    const [printed] = mvLines(text);
    const r = spawnSync("sh", ["-c", printed as string], {
      cwd: projectDir,
      input: "y\n",
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    expect(read(RULE)).toBe(MINE);
    expect(existsSync(abs(bak))).toBe(false);
  });

  it.each([
    [".codex", "shared-codex", ".codex/hooks/session-start.sh"],
    [".agents", "dotfiles/agents", ".agents/skills/model-orchestration/SKILL.md"],
    [".claude", "shared-claude", ".claude/rules/git-policy.md"],
    [".claude", "shared-claude", ".claude/skills/model-orchestration/SKILL.md"],
  ])("룰이 아닌 번들 자산 자리(%s → %s 의 %s)도 같다", (slotLink, target, slot) => {
    mkdirSync(abs(target), { recursive: true });
    link(slotLink, target);
    put(slot, MINE);
    install(["claude", "codex"]);
    const backup = backupOf(slot);
    expect(backup, "전제 — 설치가 설치자 파일을 백업으로 비켜 두었다").toBeDefined();
    const bak = `${dirname(slot)}/${backup}`;

    const text = uninstall();

    expect(mvLines(text)).toEqual([`mv -i ${bak} ${slot}`]);
    const r = spawnSync("sh", ["-c", `mv -i ${bak} ${slot}`], {
      cwd: projectDir,
      input: "y\n",
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    expect(read(slot)).toBe(MINE);
  });

  it("자리의 현재 바이트가 하네스 판이 아니면(설치자가 고친 하네스 사본) 명령 없이 백업이 남아 있다는 사실만 말한다 · 비어 있으면 명령이 나온다", () => {
    linkedLayout();
    const bak = `.agents/rules/${backupOf(RULE)}`;
    writeFileSync(abs(RULE), "edited by the installer\n");

    const edited = uninstall({ dryRun: true });

    // 고친 사본은 이름 대신 개수로 간다(목록 줄 하나 + 옮길 수 없는 백업 하나) — 지우라고도 옮기라고도 권하지 않는다
    expect(mvLines(edited)).toEqual([]);
    expect(handBlock(edited).join("\n")).not.toContain(RULE);
    expect(countLines(edited)).toHaveLength(1);
    expect(countLines(edited)[0]).toContain("2 entries on the install record");
    expect(read(RULE)).toBe("edited by the installer\n");

    rmSync(abs(RULE));
    const empty = uninstall({ dryRun: true });

    expect(mvLines(empty)).toEqual([`mv -i ${bak} ${RULE}`]);
    expect(read(bak)).toBe(MINE);
  });

  it.each([
    [
      "백업 이름이 이 자리의 것이 아니다(`.env` 를 하네스 자리로 보내는 기록)",
      RULE,
      `.env.backup-${STAMP}`,
      true,
    ],
    ["백업이 이미 없다", RULE, `${RULE}.backup-${STAMP}`, false],
    [
      "글자부터 하네스 자리 밖이다(링크 너머가 아니라 기록이 `.env`)",
      ".env",
      `.env.backup-${STAMP}`,
      true,
    ],
  ])("명령을 만들어 주지 않는다 — %s", (_what, slot, backup, backupOnDisk) => {
    mkdirSync(abs("dotfiles/agents"), { recursive: true });
    link(".agents", "dotfiles/agents");
    install(["claude", "codex"]);
    if (backupOnDisk) put(backup, "ATTACK\n");
    forgeDisplaced(slot, backup);

    const text = uninstall();

    expect(text).toContain(`${slot} — not put back`);
    expect(text).not.toContain("mv -i");
    // 센 것도 없다 — 이 기록은 덩어리에 아무것도 더하지 못한다
    expect(countLines(text)).toEqual([]);
    if (backupOnDisk) expect(read(backup)).toBe("ATTACK\n");
  });
});

describe("#911 위조 기록 — 화면 안내로 하네스 자리 밖 파일을 덮게 만들 수 없다", () => {
  const SECRET = "SECRET=installer-only\n";
  const ATTACK = "SECRET=attacker-chosen\n";

  it.each([
    ["`.opencode → .`", ".", ".env"],
    ["`.opencode → apps/web`", "apps/web", "apps/web/.env"],
  ])("%s + displaced `.opencode/.env` + 커밋된 백업: mv 줄 0 · 쓰이는 `.env` 그대로 · 백업이 남아 있다는 사실만 말한다", (_what, target, env) => {
    install(["claude", "codex"]);
    put(env, SECRET);
    put(`${env}.backup-${STAMP}`, ATTACK);
    link(".opencode", target);
    forgeDisplaced(".opencode/.env", `.opencode/.env.backup-${STAMP}`);

    const preview = uninstall({ dryRun: true });
    const text = uninstall();

    expect(read(env)).toBe(SECRET);
    expect(read(`${env}.backup-${STAMP}`)).toBe(ATTACK);
    for (const screen of [preview, text]) {
      expect(mvLines(screen)).toEqual([]);
      expect(screen).not.toContain("mv -i");
      // 덩어리는 하네스 밖 파일의 이름을 말하지 않는다 — 센 줄 하나뿐
      expect(handBlock(screen).join("\n")).not.toContain(".env");
      expect(countLines(screen)).toHaveLength(1);
    }
  });

  it("`.agents → .` + 번들 룰 이름의 displaced + 커밋된 백업: 링크 너머의 같은 이름 설치자 파일을 덮는 명령을 주지 않는다", () => {
    install(["claude"]);
    put("rules/git-policy.md", "USER OWN untracked\n");
    put(`rules/git-policy.md.backup-${STAMP}`, ATTACK);
    link(".agents", ".");
    forgeDisplaced(RULE, `${RULE}.backup-${STAMP}`);

    const preview = uninstall({ dryRun: true });
    const text = uninstall();

    expect(read("rules/git-policy.md")).toBe("USER OWN untracked\n");
    expect(read(`rules/git-policy.md.backup-${STAMP}`)).toBe(ATTACK);
    for (const screen of [preview, text]) {
      expect(mvLines(screen)).toEqual([]);
      expect(screen).not.toContain("mv -i");
      expect(handBlock(screen).join("\n")).not.toContain("git-policy");
      expect(countLines(screen)).toHaveLength(1);
    }
  });

  it.each([
    [
      "`.opencode → .` + 기록 `.opencode/.env`",
      () => {
        link(".opencode", ".");
        forgeExternal(".opencode/.env");
      },
    ],
    [
      "`.agents → .` + 기록 `.agents/.env` · `.agents/rules/.env`",
      () => {
        rmSync(abs(".agents"), { recursive: true, force: true });
        link(".agents", ".");
        forgeExternal(".agents/.env");
        forgeExternal(".agents/rules/.env");
      },
    ],
    [
      "`.claude/rules → ..` + 기록 `.claude/rules/.env`",
      () => {
        rmSync(abs(".claude/rules"), { recursive: true });
        link(".claude/rules", "..");
        forgePolicy("rules/.env");
      },
    ],
  ])("링크 + 평범한 이름의 기록 경로 — %s: 목록이 쓰이는 `.env` 를 하네스 파일처럼 대지 않는다 · 목록대로 지워도 `.env` 가 남는다", (_what, forge) => {
    install(["claude", "codex"]);
    put(".env", SECRET);
    forge();

    const preview = uninstall({ dryRun: true });
    const text = uninstall();

    expect(read(".env")).toBe(SECRET);
    for (const screen of [preview, text]) {
      const block = handBlock(screen);
      // 덩어리 안에 `.env` 로 끝나는 이름이 없다 — 센 줄 하나가 대신 말한다
      expect(block.filter((l) => /\.env\s*$/.test(l))).toEqual([]);
      expect(countLines(screen)).toHaveLength(1);
      // 목록(8칸)을 `rm` 에 넘겨도 `.env` 는 그대로다
      const listed = block
        .filter((l) => /^ {8}\S/.test(l))
        .map((l) => l.trim().split(/\s+/)[0] as string);
      const r = spawnSync("rm", ["-f", "--", ...listed.filter((p) => !p.startsWith("mv"))], {
        cwd: projectDir,
      });
      expect(r.status).toBe(0);
      expect(read(".env")).toBe(SECRET);
    }
  });

  describe("기록 · 링크 유래 글자로 진짜와 같은 명령 줄을 끼워 넣거나 안내대로 지우면 밖 파일이 지워지게 만들지 못한다", () => {
    const fake = `        mv -i .env.backup-${STAMP} .env`;

    it.each([
      [
        "줄바꿈",
        `.agents/rules/zz\n      your files this tool moved aside — put each back:\n${fake}`,
      ],
      [
        "공백 — 목록을 `xargs rm` 하면 `.env` 가 같이 지워진다",
        ".agents/rules/test-policy.md .env",
      ],
      [
        "공백 채우기 — 80칸에서 둘째 줄이 진짜 mv 줄처럼 보인다",
        `.agents/rules/zz${" ".repeat(64)}mv -i .env.backup-${STAMP} .env`,
      ],
      ["셸 메타 문자", ".agents/rules/$(touch PWNED);x.md"],
    ])("기록 경로(`externalFiles`)에 %s: 덩어리가 그 경로를 찍지 않고 개수 한 줄로만 센다", (_what, forged) => {
      mkdirSync(abs("dotfiles/agents"), { recursive: true });
      link(".agents", "dotfiles/agents");
      install(["claude", "codex"]);
      put(".env", SECRET);
      put(`.env.backup-${STAMP}`, ATTACK);
      forgeExternal(forged);

      const preview = uninstall({ dryRun: true });
      const text = uninstall();

      expect(read(".env")).toBe(SECRET);
      expect(existsSync(abs("PWNED"))).toBe(false);
      for (const screen of [preview, text]) {
        // 위조 경로가 화면 어디에도 없다 — 개수만 센다
        expect(screen).not.toContain(forged.split("\n")[0] as string);
        expect(screen.split("\n")).not.toContain(fake);
        expect(mvLines(screen)).toEqual([]);
        expect(countLines(screen)).toHaveLength(1);
        expect(countLines(screen)[0]).toContain("1 entry on the install record that this tool");
        // 목록 줄(8칸)을 쪼개 `rm` 에 넘겨도 `.env` 는 안 나온다
        const tokens = screen
          .split("\n")
          .filter((l) => l.startsWith("        "))
          .flatMap((l) => l.trim().split(/\s+/));
        expect(tokens).not.toContain(".env");
      }
    });

    it("설치한 판보다 새 판으로 지울 때(하네스 사본이 현재 번들과 다르고 기록 sha 와 같다): 명령이 나오고 그대로 치면 원본이 돌아온다", () => {
      linkedLayout();
      const bak = `.agents/rules/${backupOf(RULE)}`;
      const older = "an older harness version of this rule\n";
      writeFileSync(abs(RULE), older);
      const log = readInstallLog(projectDir) as InstallLog;
      writeInstallLog(projectDir, {
        ...log,
        externalFiles: (log.externalFiles ?? []).map((f) =>
          f.path === RULE ? { ...f, sha256: hashContent(older) } : f,
        ),
      });

      const text = uninstall();

      expect(mvLines(text)).toEqual([`mv -i ${bak} ${RULE}`]);
      const r = spawnSync("sh", ["-c", `mv -i ${bak} ${RULE}`], {
        cwd: projectDir,
        input: "y\n",
        encoding: "utf8",
      });
      expect(r.status, r.stderr).toBe(0);
      expect(read(RULE)).toBe(MINE);
    });

    it("링크 대상 폴더 이름에 줄바꿈", () => {
      const evil = `dotfiles/x\n${fake}\ny`;
      mkdirSync(abs(evil), { recursive: true });
      link(".agents", evil);
      install(["claude", "codex"]);
      put(".env", SECRET);
      put(`.env.backup-${STAMP}`, ATTACK);

      const preview = uninstall({ dryRun: true });
      const text = uninstall();

      expect(read(".env")).toBe(SECRET);
      for (const screen of [preview, text]) {
        expect(screen.split("\n")).not.toContain(fake);
        expect(mvLines(screen)).toEqual([]);
        // 링크 요약 줄(#910)은 대상 글자를 한 줄로 적는다
        expect(screen).toContain("\\u000a");
      }
    });
  });
});

describe("#911 AC3 — 실디렉터리 기본 레이아웃의 화면은 그대로", () => {
  it("링크 없는 설치본: 비켜 둔 룰은 돌아오고 · 손으로 끝낼 것을 말하는 덩어리가 없다", () => {
    put(".claude/rules/git-policy.md", MINE);
    put(RULE, MINE);
    install(ALL_CLI);

    const preview = uninstall({ dryRun: true });
    const text = uninstall();

    expect(read(RULE)).toBe(MINE);
    expect(read(".claude/rules/git-policy.md")).toBe(MINE);
    expect(text).toContain(`put back  ${RULE}`);
    for (const screen of [preview, text]) {
      expect(screen).not.toContain("by hand (nothing here was touched");
      expect(screen).not.toContain("mv -i");
      expect(screen).not.toContain("your link");
    }
  });
});

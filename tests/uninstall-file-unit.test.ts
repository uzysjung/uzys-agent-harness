/**
 * #746 · #761 (3) — uninstall 은 CLI 폴더를 통째로 옮기지 않고 **기록된 하네스 파일만 하나씩** 회수한다
 * (설계 `docs/plans/v26.169.0-one-principle-finish-design.md` §2.3 · §2.4 · §3.3 ⓒ · ADR-097 결정 3 · 4 · 6).
 *
 * 설치자에게 달라지는 것: 전량 `uninstall` · `uninstall --cli <x>` 뒤에도 `.claude/settings.local.json` · 자기 커맨드 ·
 * `.codex/config.toml` 에 더한 MCP 서버가 **제자리에 바이트 그대로** 있다(전에는 `<dir>.backup-<time>/` 으로 옮겨져 되찾아
 * 와야 했다). 고친 하네스 파일은 그 파일 하나만 `<file>.backup-<time>` 으로 남는다. 하네스가 자리를 빌렸던 설치자 파일은
 * 원래 이름으로 돌아온다.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  type InstallLog,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, CliTargets, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const MINE_LOCAL = '{ "permissions": { "allow": ["Bash(make build)"] } }\n';
const MINE_CMD = "# my command\n";
const MY_MCP = '\n[mcp_servers.mine]\ncommand = "my-mcp"\n';

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-file-unit-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};
const append = (rel: string, tail: string): void => writeFileSync(abs(rel), `${read(rel)}${tail}`);
const log = (): InstallLog => {
  const l = readInstallLog(projectDir);
  if (!l) throw new Error("install log missing");
  return l;
};

function install(cli: CliTargets, mode: "add" | "update" = "add", tracks: Track[] = ["tooling"]) {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode,
    spec: { tracks, options: { withCodexTrust: false }, cli: [...cli], projectDir },
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir"> = {}) {
  const out = { lines: [] as string[], code: null as number | null };
  uninstallAction(
    { projectDir, ...options },
    {
      log: (l: string) => out.lines.push(l),
      err: (l: string) => out.lines.push(l),
      exit: (code: number) => {
        out.code ??= code;
        return undefined as never;
      },
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return { ...out, text: out.lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
}

/** 설치자가 `.claude/` · `.codex/` 에 둔 자기 파일 — 하네스 기록에 없다. */
function addMine(cli: ReadonlyArray<CliBase>): void {
  if (cli.includes("claude")) {
    put(".claude/settings.local.json", MINE_LOCAL);
    put(".claude/commands/mine/deploy.md", MINE_CMD);
  }
  if (cli.includes("codex")) append(".codex/config.toml", MY_MCP);
}

/** 프로젝트 아래 `<…>.backup-*` 이름(파일 · 폴더) 전부. */
function backupsUnder(rel = "."): string[] {
  const out: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const name = `${prefix}${e.name}`;
      if (/\.backup-/.test(e.name)) out.push(name);
      else if (e.isDirectory()) walk(join(dir, e.name), `${name}/`);
    }
  };
  walk(abs(rel), rel === "." ? "" : `${rel}/`);
  return out.sort();
}

/** 기록이 하네스 것이라 말하는 경로(project 상대) 중 지금 디스크에 있는 것. */
function recordedPresent(l: InstallLog): string[] {
  const paths = [
    ...(l.policyFiles ?? []).map((f) => `.claude/${f.path}`),
    ...(l.skillFiles ?? []).map((f) => `.claude/skills/${f.path}`),
    ...(l.externalFiles ?? []).map((f) => f.path),
  ];
  return paths.filter((p) => existsSync(abs(p)));
}

describe("전량 uninstall — 하네스 파일만 하나씩, 설치자 파일은 제자리 (§2.4 1)", () => {
  it("설치자 세 파일이 바이트 그대로 제자리 · 고친 룰은 그 파일 하나만 백업 · 하네스 파일 0 · 폴더 이동 없음", () => {
    install(["claude", "codex"]);
    addMine(["claude", "codex"]);
    append(".claude/rules/test-policy.md", "\n<!-- my rule edit -->\n");
    const before = log();
    const configBefore = read(".codex/config.toml");

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(read(".claude/settings.local.json")).toBe(MINE_LOCAL);
    expect(read(".claude/commands/mine/deploy.md")).toBe(MINE_CMD);
    // 하네스가 만든 config.toml 에 설치자가 표를 더했다 — 하네스 구간만 빠지고 설치자 표는 라이브(B1)
    expect(read(".codex/config.toml")).toContain('[mcp_servers.mine]\ncommand = "my-mcp"');
    expect(read(".codex/config.toml")).not.toBe(configBefore);
    expect(read(".codex/config.toml")).not.toMatch(/uzys/i);
    // 고친 룰은 백업으로만 — 라이브에는 없다(결정 4)
    expect(existsSync(abs(".claude/rules/test-policy.md"))).toBe(false);
    const ruleBackups = backupsUnder(".claude/rules");
    expect(ruleBackups).toHaveLength(1);
    expect(read(ruleBackups[0] ?? "")).toContain("<!-- my rule edit -->");
    // 그 밖의 백업은 하나도 없다 — 폴더 백업 · config.toml 백업 · 다른 파일 백업
    expect(backupsUnder()).toEqual(ruleBackups);
    // 남는 것은 설치자가 표를 더한 함께 쓰는 파일 하나뿐이다(몫만 걷혔다)
    expect(recordedPresent(before)).toEqual([".codex/config.toml"]);
    // 고친 룰의 백업만 `rules/` 에 남는다 — 나머지 뼈대는 비어 걷혔다
    expect(readdirSync(abs(".claude/rules")).map((f) => `.claude/rules/${f}`)).toEqual(ruleBackups);
    for (const gone of [".claude/hooks", ".claude/commands/uzys", ".claude/skills"])
      expect(existsSync(abs(gone)), gone).toBe(false);
    expect(existsSync(abs(".claude"))).toBe(true); // 설치자 파일 때문에 남는다
    expect(out.text).toContain(
      "left  .claude/ — 2 file(s) of yours: commands/mine/deploy.md · settings.local.json",
    );
    expect(out.text).toContain("settings.local.json");
    expect(out.text).toContain("backed up  .claude/rules/test-policy.md — you edited it");
    expect(out.text).not.toContain("moved aside");
    expect(out.text).toContain("[BACKUPS]");
    expect(out.text).toContain(".codex/config.toml — removed the harness part");
  });

  it("설치자 파일이 없으면 `.claude/` · `.codex/` · 빈 뼈대 · `docs/` 가 모두 걷힌다 (B2 · N-B)", () => {
    install(["claude", "codex"]);
    expect(existsSync(abs(".claude/commands/uzys"))).toBe(true); // 전제 — 기록 없이 만든 뼈대
    expect(existsSync(abs("docs/decisions"))).toBe(true);

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(existsSync(abs(".claude"))).toBe(false);
    expect(existsSync(abs(".codex"))).toBe(false);
    // #611 승계 + N-B — `docs/decisions` 에서 위로 걸어 비어 있는 `docs/` 까지 걷힌다
    expect(existsSync(abs("docs"))).toBe(false);
    expect(out.text).not.toContain("left  .claude/");
    expect(backupsUnder()).toEqual([]);
  });

  it("설치자가 `docs/decisions` 에 ADR 을 넣었으면 그 폴더는 남는다(비어 있을 때만 걷는다)", () => {
    install(["claude"]);
    put("docs/decisions/ADR-001.md", "# mine\n");
    uninstall({ yes: true });
    expect(read("docs/decisions/ADR-001.md")).toBe("# mine\n");
  });
});

describe("uninstall --cli claude — 같은 함수, 그 CLI 자리만 (§2.4 2 · B2)", () => {
  it("`.claude/` 하네스 파일만 사라지고 `.codex/` · `.agents/` 는 그대로 · 설치자 파일 제자리 · 기록 정리", () => {
    install(["claude", "codex"]);
    addMine(["claude"]);
    const codexBefore = readdirSync(abs(".codex"), { recursive: true }).length;
    const agentsSkill = ".agents/skills/model-orchestration/SKILL.md";
    const agentsBody = read(agentsSkill);
    const before = log();

    const out = uninstall({ cli: "claude" });

    expect(out.code).toBe(0);
    expect(read(".claude/settings.local.json")).toBe(MINE_LOCAL);
    expect(read(".claude/commands/mine/deploy.md")).toBe(MINE_CMD);
    const claudeRecorded = recordedPresent(before).filter((p) => p.startsWith(".claude/"));
    expect(claudeRecorded).toEqual([]);
    expect(readdirSync(abs(".codex"), { recursive: true }).length).toBe(codexBefore);
    expect(read(agentsSkill)).toBe(agentsBody);
    const after = log();
    expect(after.policyFiles).toBeUndefined();
    expect(after.skillFiles).toBeUndefined();
    expect(after.spec.clis).toEqual(["codex"]);
    expect(out.text).not.toContain("moved aside");
    expect(backupsUnder()).toEqual([]);
  });

  it("설치자 파일이 없으면 `.claude/` 가 통째로 걷힌다 — 뼈대(`commands/uzys/`)도 비어 있어 함께", () => {
    install(["claude", "codex"]);
    const out = uninstall({ cli: "claude" });
    expect(out.code).toBe(0);
    expect(existsSync(abs(".claude"))).toBe(false);
    expect(existsSync(abs(".codex"))).toBe(true);
  });
});

describe("함께 쓰는 파일 — 몫만 걷는다 (§2.4 3 · 4 · 9 · B1)", () => {
  it("하네스가 만든 config.toml 을 안 고쳤으면 파일째 사라진다 (ⓑ)", () => {
    install(["claude", "codex"]);
    const out = uninstall({ yes: true });
    expect(existsSync(abs(".codex/config.toml"))).toBe(false);
    expect(out.text).toContain(".codex/config.toml — removed (the harness created it");
  });

  it("몫 기록 없는 옛 로그의 고친 config.toml — 걷지 않고 남은 하네스 구간을 한 줄로 알린다", () => {
    install(["claude", "codex"]);
    addMine(["codex"]);
    const { records: _r, portions: _p, ...legacy } = log();
    writeFileSync(installLogPath(projectDir), JSON.stringify(legacy), "utf8");
    const before = read(".codex/config.toml");

    const out = uninstall({ yes: true });

    expect(read(".codex/config.toml")).toBe(before);
    expect(out.text).toMatch(/left {2}\.codex\/config\.toml — harness regions not on record: /);
    expect(backupsUnder(".codex")).toEqual([]);
  });

  it("settings.json 의 설치자 훅 · 권한 줄은 남고 하네스 핸들러만 빠진다", () => {
    const mine = {
      permissions: { allow: ["Bash(npm test)"] },
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }],
      },
    };
    put(".claude/settings.json", `${JSON.stringify(mine, null, 2)}\n`);
    install(["claude"]);
    expect(read(".claude/settings.json")).toMatch(/\.claude\/hooks\//); // 전제 — 하네스 훅이 더해졌다

    const out = uninstall({ yes: true });

    const after = JSON.parse(read(".claude/settings.json")) as typeof mine;
    expect(after.permissions).toEqual(mine.permissions);
    expect(after.hooks.PreToolUse).toEqual(mine.hooks.PreToolUse);
    expect(read(".claude/settings.json")).not.toMatch(/\.claude\/hooks\//);
    expect(out.text).toContain(".claude/settings.json — removed the harness part");
    expect(out.text).toContain("left  .claude/ — 1 file(s) of yours: settings.json");
  });

  it("하네스가 만든 settings.json 에 몫밖에 없으면 파일째 지운다", () => {
    install(["claude"]);
    expect(log().rootFiles?.some((f) => f.path === ".claude/settings.json")).toBe(true);
    uninstall({ yes: true });
    expect(existsSync(abs(".claude/settings.json"))).toBe(false);
  });

  it("하네스가 만든 opencode.json 을 설치자가 고쳤으면 MCP 몫만 빠지고 설치자 키는 라이브 · 백업 없음 (ⓒ · N7)", () => {
    install(["claude", "opencode"]);
    const doc = JSON.parse(read("opencode.json")) as Record<string, unknown>;
    doc.agent = { mine: { description: "my agent" } };
    writeFileSync(abs("opencode.json"), `${JSON.stringify(doc, null, 2)}\n`);

    const out = uninstall({ yes: true });

    const after = JSON.parse(read("opencode.json")) as Record<string, unknown>;
    expect(after.agent).toEqual({ mine: { description: "my agent" } });
    expect(after.mcp ?? {}).toEqual({});
    expect(backupsUnder()).toEqual([]);
    expect(out.text).toContain("opencode.json — removed the harness part");
  });
});

describe("`--keep-templates` 는 거절하고 같은 일을 하는 명령을 알려 준다 (§2.4 5 · ADR-097 결정 6)", () => {
  const snapshot = (): Map<string, string> => {
    const m = new Map<string, string>();
    const walk = (dir: string, prefix: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const name = `${prefix}${e.name}`;
        if (e.isDirectory()) walk(join(dir, e.name), `${name}/`);
        else if (e.isFile()) m.set(name, readFileSync(join(dir, e.name), "utf8"));
      }
    };
    walk(projectDir, "");
    return m;
  };

  it("자산이 기록에 있으면 `--only a,b` 를 찍고 exit 1 · 아무것도 바뀌지 않는다", () => {
    install(["claude"]);
    const l = log();
    writeInstallLog(projectDir, {
      ...l,
      assets: [
        { id: "a", category: "x", method: "npm", scope: "project", detail: { pkg: "a" } },
        { id: "b", category: "x", method: "npm", scope: "project", detail: { pkg: "b" } },
        { id: "g", category: "x", method: "npm", scope: "global", detail: { pkg: "g" } },
      ],
    });
    const before = snapshot();

    const out = uninstall({ keepTemplates: true });

    expect(out.code).toBe(1);
    expect(out.text).toContain("--keep-templates was removed in v26.169.0");
    expect(out.text).toContain("agent-harness uninstall --only a,b");
    expect(snapshot()).toEqual(before);
  });

  it("자산이 없으면 대체 문구 · `--cli` 와 섞여도 같은 거절", () => {
    install(["claude", "codex"]);
    const before = snapshot();
    for (const extra of [{}, { cli: "claude" }]) {
      const out = uninstall({ keepTemplates: true, ...extra });
      expect(out.code).toBe(1);
      expect(out.text).toContain("nothing on record for --only");
    }
    expect(snapshot()).toEqual(before);
  });
});

describe("--dry-run 이 말한 것과 실행 결과가 같다 (§2.4 6)", () => {
  it("remove N · leave(설치자 파일) — 미리보기는 아무것도 바꾸지 않는다", () => {
    install(["claude", "codex"]);
    addMine(["claude"]);
    append(".claude/rules/git-policy.md", "\n<!-- edit -->\n");
    const before = log();
    const recordedClaude = recordedPresent(before).filter((p) => p.startsWith(".claude/")).length;

    const preview = uninstall({ dryRun: true }).text;
    expect(recordedPresent(before).filter((p) => p.startsWith(".claude/"))).toHaveLength(
      recordedClaude,
    ); // 무변경
    const planned = /○ remove (\d+) harness file\(s\) under \.claude\/ \(1 you edited/.exec(
      preview,
    );
    expect(planned?.[1]).toBe(String(recordedClaude));
    expect(preview).toContain("○ leave .claude/ — 2 file(s) of yours:");

    const run = uninstall({ yes: true }).text;
    expect(run).toContain(`removed  .claude/ ${recordedClaude} harness file(s)`);
    expect(run).toContain("left  .claude/ — 2 file(s) of yours:");
  });
});

describe("displaced 되돌리기 — 같은 이름의 설치자 스킬이 원래 이름으로 돌아온다 (§3.3 ⓒ · #761 (3))", () => {
  const DEBATE = "multi-model-debate";
  const MINE = "MINE — my own copy\n";
  const SLOTS = [".claude/skills", ".agents/skills"] as const;

  /** 그 스킬이 없던 옛 판 설치본 + 손수 만든 `SKILL.md` 두 자리 → update(백업 + displaced). */
  function handMadeThenUpdate(): void {
    install(["claude", "codex"]);
    for (const slot of SLOTS) rmSync(abs(`${slot}/${DEBATE}`), { recursive: true, force: true });
    const l = log();
    const ours = (p: string): boolean =>
      p.startsWith(`${DEBATE}/`) || p.startsWith(`.agents/skills/${DEBATE}/`);
    writeInstallLog(projectDir, {
      ...l,
      ...(l.skillFiles ? { skillFiles: l.skillFiles.filter((f) => !ours(f.path)) } : {}),
      ...(l.externalFiles ? { externalFiles: l.externalFiles.filter((f) => !ours(f.path)) } : {}),
    });
    for (const slot of SLOTS) put(`${slot}/${DEBATE}/SKILL.md`, MINE);
    install(["claude", "codex"], "update");
    // 전제 — update 가 두 자리 모두 백업 + displaced 로 적었다(#775)
    for (const slot of SLOTS) {
      const rel = `${slot}/${DEBATE}/SKILL.md`;
      expect(read(rel), rel).not.toBe(MINE);
      expect(
        (log().rootFiles ?? []).filter((f) => f.path === rel && f.change === "displaced"),
        rel,
      ).toHaveLength(1);
    }
  }

  it("전량 uninstall — 두 자리 모두 'MINE' 바이트로 제자리 · 백업 파일 없음(rename) · 화면 put back", () => {
    handMadeThenUpdate();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    for (const slot of SLOTS) {
      const rel = `${slot}/${DEBATE}/SKILL.md`;
      expect(read(rel), rel).toBe(MINE);
      expect(readdirSync(abs(`${slot}/${DEBATE}`)), rel).toEqual(["SKILL.md"]);
      expect(out.text).toContain(`put back  ${rel} (from ${rel}.backup-`);
    }
  });

  it("uninstall --cli codex — `.agents/` 쪽만 되돌리고 `.claude/` 쪽은 하네스 판 · 기록의 displaced 그대로", () => {
    handMadeThenUpdate();

    const out = uninstall({ cli: "codex" });

    expect(out.code).toBe(0);
    expect(read(`.agents/skills/${DEBATE}/SKILL.md`)).toBe(MINE);
    expect(read(`.claude/skills/${DEBATE}/SKILL.md`)).not.toBe(MINE);
    const displaced = (log().rootFiles ?? [])
      .filter((f) => f.change === "displaced")
      .map((f) => f.path);
    expect(displaced).toContain(`.claude/skills/${DEBATE}/SKILL.md`);
    expect(displaced).not.toContain(`.agents/skills/${DEBATE}/SKILL.md`);
  });

  it("uninstall --cli claude — `.claude/` 쪽만 되돌린다", () => {
    handMadeThenUpdate();
    uninstall({ cli: "claude" });
    expect(read(`.claude/skills/${DEBATE}/SKILL.md`)).toBe(MINE);
    expect(read(`.agents/skills/${DEBATE}/SKILL.md`)).not.toBe(MINE);
  });

  it("하네스 판을 설치자가 고쳤으면 그 판은 백업 후 회수되고 원래 파일이 돌아온다", () => {
    handMadeThenUpdate();
    const rel = `.claude/skills/${DEBATE}/SKILL.md`;
    writeFileSync(abs(rel), "NEWER — edited the harness copy\n");

    const out = uninstall({ yes: true });

    expect(read(rel)).toBe(MINE);
    expect(out.text).toContain(`backed up  ${rel} — you edited it`);
    const kept = backupsUnder(`.claude/skills/${DEBATE}`);
    expect(kept).toHaveLength(1); // 고친 하네스 판의 백업 — 원래 파일의 백업은 rename 으로 돌아갔다
    expect(read(kept[0] ?? "")).toBe("NEWER — edited the harness copy\n");
  });

  it("자리가 막혔으면(설치자가 그 자리를 자기 파일로의 링크로 바꿨다) 되돌리지 않고 말한다 · 백업 그대로", () => {
    handMadeThenUpdate();
    const rel = `.claude/skills/${DEBATE}/SKILL.md`;
    const backup = (log().rootFiles ?? []).find((f) => f.path === rel)?.notes[0] ?? "";
    put("notes/mine.md", "# linked\n");
    rmSync(abs(rel));
    symlinkSync(join("..", "..", "..", "notes", "mine.md"), abs(rel));

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(read(backup)).toBe(MINE);
    expect(lstatSync(abs(rel)).isSymbolicLink()).toBe(true);
    expect(out.text).toContain(
      `${rel} — not put back — the spot is taken; your earlier file is at ${backup}`,
    );
  });

  it("백업을 지웠으면 'could not put back' 한 줄 · exit 0", () => {
    handMadeThenUpdate();
    const rel = `.agents/skills/${DEBATE}/SKILL.md`;
    const backup = (log().rootFiles ?? []).find((f) => f.path === rel)?.notes[0] ?? "";
    rmSync(abs(backup));

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(out.text).toContain(`${rel} — could not put back your earlier file`);
  });
});

describe("옛 로그(체크섬 · 몫 기록 전) — 소유 필터를 통과한 것만 지운다 (§2.4 8)", () => {
  it("policyFiles 에 적힌 비 번들 이름 파일은 설치자 것으로 남는다", () => {
    install(["claude"]);
    put(".claude/rules/my-team.md", "# my team rule\n");
    const l = log();
    const { records: _r, portions: _p, ...legacy } = l;
    writeFileSync(
      installLogPath(projectDir),
      JSON.stringify({
        ...legacy,
        policyFiles: [...(l.policyFiles ?? []), { path: "rules/my-team.md", sha256: "x" }],
      }),
      "utf8",
    );

    uninstall({ yes: true });

    expect(read(".claude/rules/my-team.md")).toBe("# my team rule\n");
    expect(existsSync(abs(".claude/rules/git-policy.md"))).toBe(false);
  });
});

describe("링크 — install 이 따라 쓰지 않는 자리는 따라가지 않는다 (B4 · N-A)", () => {
  it("B4 — `.claude/skills/<id>` 가 `.agents/skills/<id>` 링크면 --cli claude 가 codex 본문을 지우지 않는다", () => {
    install(["claude", "codex"]);
    const id = "model-orchestration";
    const slot = abs(`.claude/skills/${id}`);
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(join("..", "..", ".agents", "skills", id), slot);
    const body = `.agents/skills/${id}/SKILL.md`;
    const bodyBefore = read(body);
    const externalBefore = log().externalFiles;

    const out = uninstall({ cli: "claude" });

    expect(out.code).toBe(0);
    expect(read(body)).toBe(bodyBefore);
    expect(backupsUnder(".agents")).toEqual([]);
    expect(log().externalFiles).toEqual(externalBefore);
    expect(log().skillFiles).toBeUndefined();
    // 설치자가 건 링크는 남는다 — 화면이 이름으로 말한다
    expect(lstatSync(slot).isSymbolicLink()).toBe(true);
    expect(out.text).toContain(`skills/${id} (your link → ${readlinkSync(slot)})`);
  });

  it("N-A — 스킬 슬롯 안 `SKILL.md` 가 설치자 파일로의 링크면 따라가 지우지 않는다(백업도 만들지 않는다)", () => {
    install(["claude"]);
    const id = "model-orchestration";
    const rel = `.claude/skills/${id}/SKILL.md`;
    put("notes/my-skill.md", "# my skill body\n");
    rmSync(abs(rel));
    symlinkSync(join("..", "..", "..", "notes", "my-skill.md"), abs(rel));

    uninstall({ yes: true });

    expect(read("notes/my-skill.md")).toBe("# my skill body\n");
    expect(backupsUnder("notes")).toEqual([]);
  });

  it("N-B — `.claude` 가 밖으로의 링크면 밖의 빈 폴더(rules/ · commands/uzys/)를 걷지 않는다", () => {
    const outside = mkdtempSync(join(tmpdir(), "un-file-unit-outside-"));
    try {
      mkdirSync(join(outside, "rules"));
      mkdirSync(join(outside, "commands", "uzys"), { recursive: true });
      symlinkSync(outside, abs(".claude"));
      install(["claude"]);

      uninstall({ yes: true });

      expect(existsSync(join(outside, "rules"))).toBe(true);
      expect(existsSync(join(outside, "commands", "uzys"))).toBe(true);
      expect(lstatSync(abs(".claude")).isSymbolicLink()).toBe(true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHarnessMcp } from "../src/cli-transforms.js";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { listAction } from "../src/commands/list.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import {
  buildInstallLog,
  hashContent,
  type InstallLog,
  installLogPath,
  readInstallLog,
} from "../src/install-log.js";
import { type InstallMode, type InstallReport, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

/** #657 — 백업 패턴 4종(테스트 기대치가 소스 목록과 함께 살아야 함). */
const BACKUP_PATTERNS = [
  ".claude.backup-*/",
  ".codex.backup-*/",
  ".opencode.backup-*/",
  "*.backup-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T*",
] as const;

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #551 PR-3 — **처음 깔아도, `install --reinstall` 을 돌려도 설치자 설정이 남는다.**
 *
 * 판정 기준(브리프): 이미 쓰던 프로젝트에 install / `--reinstall` 을 돌린 뒤, 설치자가 넣어 둔 것(자기 훅 ·
 * statusLine · model · 자기 MCP 서버 · 고친 하네스 파일의 내용)이 라이브 파일이나 **그 파일 하나의 백업**에 반드시
 * 남아 있고, 화면은 실제로 한 일만 말한다. 파이프라인(`runInstall`)을 실제로 돌리고 디스크 · 기록 · 화면으로 판정한다.
 */

let projectDir = "";

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "pr3-writes-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function specOf(over: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude"],
    projectDir,
    ...over,
  };
}

function install(
  over: Partial<InstallSpec> = {},
  mode?: InstallMode,
): { report: InstallReport; screen: string } {
  const spec = specOf(over);
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec, false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec,
    ...(mode ? { mode } : {}),
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  return { report, screen: lines.join("\n") };
}

const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const write = (rel: string, text: string): void => {
  mkdirSync(dirname(join(projectDir, rel)), { recursive: true });
  writeFileSync(join(projectDir, rel), text);
};
const template = (rel: string): string =>
  readFileSync(join(HARNESS_ROOT, "templates", rel), "utf8");
/** 그 파일 옆의 `<name>.backup-*` — project 상대. */
const backupsOf = (rel: string): string[] =>
  readdirSync(dirname(join(projectDir, rel)))
    .filter((n) => n.startsWith(`${basename(rel)}.backup-`))
    .map((n) => join(dirname(rel), n));
const log = (): InstallLog => {
  const l = readInstallLog(projectDir);
  if (l === null) throw new Error("설치 로그가 없다 — 시나리오 전제가 깨졌다");
  return l;
};
const writeLog = (l: InstallLog): void => {
  mkdirSync(dirname(installLogPath(projectDir)), { recursive: true });
  writeFileSync(installLogPath(projectDir), `${JSON.stringify(l, null, 2)}\n`);
};
const claudeDirBackups = (): string[] =>
  readdirSync(projectDir).filter((n) => n.startsWith(".claude.backup-"));

/** v26.161.0 모양의 옛 로그 — `records` · `portions` 없음, 기준선은 디스크 스캔 값. */
function legacyLog(over: Partial<InstallLog> = {}): InstallLog {
  return {
    schemaVersion: 1,
    installedAt: "2026-09-01T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"] },
    templates: {
      claudeDir: ".claude/",
      rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "x" },
    },
    assets: [],
    ...over,
  };
}

/* ─── 하네스 파일 — judge 가 정한다 (criterion 1) ─────────────────────────── */

describe("하네스 파일 쓰기가 판정을 탄다 — 첫 접촉 · 고친 파일 · 같은 내용", () => {
  const RULE = ".claude/rules/git-policy.md";

  it("기록 없는 자리에 설치자 파일이 있으면 그 파일 하나를 백업하고 하네스 판을 쓴다 — displaced 로 적는다", () => {
    write(RULE, "# my own git policy\n");

    const { screen } = install();

    expect(read(RULE)).toBe(template("rules/git-policy.md"));
    const [backup = "", ...more] = backupsOf(RULE);
    expect(more).toEqual([]);
    expect(read(backup)).toBe("# my own git policy\n");
    expect(log().rootFiles).toContainEqual({ path: RULE, change: "displaced", notes: [backup] });
    // 화면 = 판정의 줄 + 실제 백업 경로(편집이라 부르지 않는다)
    expect(screen).toContain(`backed up  ${RULE} — had a file with this name — saved as ${backup}`);
    expect(screen).not.toContain("you edited");
  });

  it("내용이 하네스 판과 같으면 두고(백업 없음) displaced 로만 적는다 — 하네스 것으로 삼지 않는다", () => {
    write(RULE, template("rules/git-policy.md"));

    const { screen } = install();

    expect(backupsOf(RULE)).toEqual([]);
    expect(log().rootFiles).toContainEqual({ path: RULE, change: "displaced", notes: [] });
    expect(log().policyFiles?.map((f) => f.path)).not.toContain("rules/git-policy.md");
    expect(screen).toContain(`⊘ ${RULE} — kept — already the same as the harness version`);
  });

  it("설치자가 고친 하네스 파일은 그 파일 하나를 백업한 뒤 갱신한다 — 편집이라 말한다", () => {
    install();
    write(RULE, `${read(RULE)}\n<!-- my note -->\n`);
    const edited = read(RULE);

    const { screen } = install();

    expect(read(RULE)).toBe(template("rules/git-policy.md"));
    const [backup = ""] = backupsOf(RULE);
    expect(read(backup)).toBe(edited);
    expect(screen).toContain(`backed up  ${RULE} — you edited it — saved as ${backup}`);
    // 하네스가 쓴 자리라 displaced 가 아니다
    expect(log().rootFiles?.some((f) => f.path === RULE)).toBe(false);
  });

  it("기록 sha 그대로인 옛 판 파일은 조용히 갱신한다 — 백업도 줄도 없다", () => {
    install();
    // 앞 릴리즈의 하네스 판을 흉내 낸다 — 디스크와 기록이 같은 옛 내용
    const old = "# git-policy (older harness release)\n";
    write(RULE, old);
    const l = log();
    writeLog({
      ...l,
      policyFiles: (l.policyFiles ?? []).map((f) =>
        f.path === "rules/git-policy.md" ? { ...f, sha256: hashContent(old) } : f,
      ),
    });

    const { report, screen } = install();

    expect(read(RULE)).toBe(template("rules/git-policy.md"));
    expect(backupsOf(RULE)).toEqual([]);
    expect(report.judged ?? []).toEqual([]);
    expect(screen).not.toContain(RULE);
  });

  it("같은 내용으로 다시 깔면 아무것도 안 한다 — 백업 0 · 알릴 줄 0", () => {
    install();
    const { report } = install();

    expect(report.judged ?? []).toEqual([]);
    expect(report.backups ?? []).toEqual([]);
  });

  it("#572 — `--reinstall` 이 고친 앵커를 그 파일 하나 백업한 뒤 갱신한다 · `.claude/` 는 제자리다", () => {
    install();
    const anchor = "CLAUDE-uzys-harness.md";
    write(anchor, `${read(anchor)}\n## my team rules\n`);
    const edited = read(anchor);
    write(".claude/settings.local.json", '{"permissions":{"allow":["Bash(make)"]}}\n');

    const { report, screen } = install({}, "reinstall");

    expect(read(anchor)).toBe(template("CLAUDE.md"));
    const [backup = ""] = backupsOf(anchor);
    expect(read(backup), "고친 앵커가 백업 없이 사라졌다(#572)").toBe(edited);
    expect(screen).toContain(`backed up  ${anchor} — you edited it — saved as ${backup}`);
    // 폴더 이동 없음 — 설치자 파일은 제자리
    expect(report.backup).toBeNull();
    expect(claudeDirBackups()).toEqual([]);
    expect(read(".claude/settings.local.json")).toBe('{"permissions":{"allow":["Bash(make)"]}}\n');
    expect(log().templates.rootClaudeMd?.sha256).toBe(hashContent(template("CLAUDE.md")));
  });

  it("CLI 중립 자산도 같은 판정 — 설치자의 `.uzys-agent-harness/protect-branch.sh` 는 백업된다 (codex 단독)", () => {
    const rel = ".uzys-agent-harness/protect-branch.sh";
    write(rel, "#!/bin/sh\necho mine\n");

    install({ cli: ["codex"] });

    expect(read(rel)).toBe(template("scripts/protect-branch.sh"));
    const [backup = ""] = backupsOf(rel);
    expect(read(backup)).toBe("#!/bin/sh\necho mine\n");
    expect(log().externalFiles).toContainEqual({
      path: rel,
      sha256: hashContent(template("scripts/protect-branch.sh")),
    });
  });

  it("스킬은 파일 단위 — 고친 파일 하나만 백업하고, 설치자가 더한 파일은 건드리지도 적지도 않는다", () => {
    install();
    const skill = ".claude/skills/north-star/SKILL.md";
    write(skill, `${read(skill)}\nmine\n`);
    write(".claude/skills/north-star/my-notes.md", "# mine\n");

    install();

    expect(backupsOf(skill)).toHaveLength(1);
    expect(read(".claude/skills/north-star/my-notes.md")).toBe("# mine\n");
    expect(backupsOf(".claude/skills/north-star/my-notes.md")).toEqual([]);
    expect(log().skillFiles?.map((f) => f.path)).not.toContain("north-star/my-notes.md");
  });
});

/* ─── 쓰기 = 기록 (criterion 2) ─────────────────────────────────────────── */

describe("쓰기 = 기록 — 디스크를 훑지 않는다", () => {
  it("기록은 이번 실행이 쓴 것만 — 이름이 같은 설치자 파일(고르지 않은 트랙의 에이전트)은 적지 않는다 (R1)", () => {
    write(".claude/agents/data-analyst.md", "# my own analyst\n");

    install();

    const l = log();
    expect(l.records).toBe("writer");
    expect(l.policyFiles?.map((f) => f.path)).toContain("agents/reviewer.md");
    expect(l.policyFiles?.map((f) => f.path)).not.toContain("agents/data-analyst.md");
    expect(read(".claude/agents/data-analyst.md")).toBe("# my own analyst\n");
  });

  it("옛 판 스캔 기록은 처음 쓸 때 소유 필터를 한 번 거쳐 이어받는다 — 은퇴 경로는 남고 트랙 밖 동명 파일은 빠진다", () => {
    write(".claude/rules/git-policy.md", template("rules/git-policy.md"));
    write(".claude/rules/no-false-ship.md", "# retired rule\n");
    write(".claude/agents/data-analyst.md", "# my own analyst\n");
    writeLog(
      legacyLog({
        policyFiles: [
          { path: "rules/git-policy.md", sha256: hashContent(template("rules/git-policy.md")) },
          { path: "rules/no-false-ship.md", sha256: hashContent("# retired rule\n") },
          { path: "agents/data-analyst.md", sha256: hashContent("# my own analyst\n") },
        ],
      }),
    );

    // `.claude/` 를 건드리지 않는 실행 — 이어받은 기록만 본다
    install({ cli: ["codex"] });

    const paths = log().policyFiles?.map((f) => f.path) ?? [];
    expect(log().records).toBe("writer");
    expect(paths).toContain("rules/git-policy.md");
    expect(paths).toContain("rules/no-false-ship.md");
    expect(paths).not.toContain("agents/data-analyst.md");
  });

  it("누적 — 이번에 안 쓴 기록은 남고, 디스크에서 사라진 것만 빠진다", () => {
    install({ tracks: ["tooling", "data"] });
    expect(log().policyFiles?.map((f) => f.path)).toContain("agents/data-analyst.md");

    install({ tracks: ["tooling"] });
    expect(log().policyFiles?.map((f) => f.path)).toContain("agents/data-analyst.md");

    rmSync(join(projectDir, ".claude/agents/data-analyst.md"));
    install({ tracks: ["tooling"] });
    expect(log().policyFiles?.map((f) => f.path)).not.toContain("agents/data-analyst.md");
  });
});

/* ─── 함께 쓰는 파일 — settings.json (criterion 4 · #563) ───────────────── */

describe("`.claude/settings.json` — 하네스 몫만 (#563)", () => {
  const SETTINGS = ".claude/settings.json";
  const MINE = {
    model: "claude-opus-4",
    statusLine: { type: "command", command: "my-status" },
    permissions: { allow: ["Bash(make build)"] },
    hooks: {
      SessionStart: [{ hooks: [{ type: "command", command: "bash my-own.sh" }] }],
    },
  };
  type Settings = {
    model?: string;
    statusLine?: { command: string };
    permissions?: unknown;
    hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
  };
  const settings = (): Settings => JSON.parse(read(SETTINGS)) as Settings;
  const commands = (event: string): string[] =>
    (settings().hooks[event] ?? []).flatMap((g) => g.hooks.map((h) => h.command));

  it.each<[string, InstallMode | undefined]>([
    ["첫 install", undefined],
    ["`--reinstall`", "reinstall"],
  ])("%s 가 설치자 훅 · statusLine · model · 권한을 지키고 하네스 훅만 더한다", (_, mode) => {
    write(SETTINGS, JSON.stringify(MINE, null, 2));

    const { screen } = install({}, mode);

    const s = settings();
    expect(s.model).toBe("claude-opus-4");
    expect(s.statusLine?.command).toBe("my-status");
    expect(s.permissions).toEqual(MINE.permissions);
    expect(commands("SessionStart")).toContain("bash my-own.sh");
    expect(commands("SessionStart").some((c) => c.includes(".claude/hooks/session-start.sh"))).toBe(
      true,
    );
    expect(commands("PreToolUse").some((c) => c.includes(".claude/hooks/protect-files.sh"))).toBe(
      true,
    );
    const keys = (log().portions ?? []).filter((p) => p.path === SETTINGS).map((p) => p.key);
    expect(keys).toContain("hooks.SessionStart#session-start.sh");
    expect(keys, "설치자 statusLine 을 하네스 몫으로 적었다").not.toContain("statusLine");
    expect(screen).toContain("kept yours: statusLine");
    expect(backupsOf(SETTINGS)).toEqual([]);
  });

  it("없던 settings.json 은 하네스 몫만으로 만들고 `created` 로 적는다", () => {
    install();

    expect(settings().statusLine).toBeDefined();
    expect(log().rootFiles).toContainEqual(
      expect.objectContaining({ path: SETTINGS, change: "created" }),
    );
    const keys = (log().portions ?? []).filter((p) => p.path === SETTINGS).map((p) => p.key);
    expect(keys).toContain("statusLine");
  });

  it("손으로 지운 하네스 훅은 다음 install 이 되돌리고 알린다 — 빼는 것은 `--without <키 id>` 뿐이고 다음 install 도 지킨다(ADR-099)", () => {
    const HOOK = "settings:hooks.SessionStart#session-start.sh";
    install();
    const s = settings();
    s.hooks.SessionStart = [];
    write(SETTINGS, JSON.stringify(s, null, 2));

    const { screen } = install();

    expect(commands("SessionStart").some((c) => c.includes("session-start.sh"))).toBe(true);
    expect(log().excluded ?? []).not.toContain(HOOK);
    expect(screen).toContain(`was missing — restored: ${HOOK}`);
    expect(screen).toContain(`drop for good: install … --without ${HOOK}`);
    expect(screen).not.toContain("not added back");

    // 명시적 빼기 — 훅 핸들러는 고쳤어도 뺀다(스크립트 참조라 남기면 죽은 참조, N-f). 화면이 그 사실을 말한다(리뷰 #693 NOTE-2)
    const edited = settings();
    const handler = edited.hooks.SessionStart?.[0]?.hooks?.[0] as { timeout?: number } | undefined;
    if (handler) handler.timeout = 99;
    write(SETTINGS, JSON.stringify(edited, null, 2));
    const out = install({ keyExclude: [HOOK] }).screen;
    expect(commands("SessionStart").some((c) => c.includes("session-start.sh"))).toBe(false);
    expect(out).toContain(`removed the harness part: ${HOOK} (you asked: --without ${HOOK})`);
    expect(out).toContain(`your edits to ${HOOK} went with it`);
    expect(out).not.toMatch(/settings\.json\s+removed the harness part — yours stays/);
    expect(out).toMatch(/settings\.json\s+removed the harness part ·/);
    install({}, "update"); // update 는 선택을 읽기만 한다 — 지킨다
    expect(commands("SessionStart").some((c) => c.includes("session-start.sh"))).toBe(false);
    expect(log().excluded).toContain(HOOK);
    // 설계 selection-record §3 — 플래그 없는 install 은 새 선택이다: 훅이 돌아오고 화면이 그렇게 말한다
    const again = install().screen;
    expect(commands("SessionStart").some((c) => c.includes("session-start.sh"))).toBe(true);
    expect(log().excluded ?? []).not.toContain(HOOK);
    expect(again).toContain(
      `↺ ${HOOK} — dropped earlier, installed again: this install did not pass --without ${HOOK}`,
    );
  });

  it("리뷰 #693 NOTE-2 — 같은 실행에서 되돌린 것과 고친 훅을 걷은 것이 함께면 'yours stays' 라 하지 않는다", () => {
    const HOOK = "settings:hooks.SessionStart#session-start.sh";
    install();
    const s = settings() as Settings & { statusLine?: unknown };
    delete s.statusLine; // 손으로 지웠다 — 되돌아온다
    const handler = s.hooks.SessionStart?.[0]?.hooks?.[0] as { timeout?: number } | undefined;
    if (handler) handler.timeout = 99; // 고쳤다 — 그래도 걷힌다(N-f)
    write(SETTINGS, JSON.stringify(s, null, 2));

    const { screen } = install({ keyExclude: [HOOK] });

    const row = screen.split("\n").find((l) => l.includes(".claude/settings.json")) ?? "";
    expect(row).toContain("wrote the harness part ·");
    expect(row).not.toContain("yours stays");
    expect(row).toContain("was missing — restored: settings:statusLine");
    expect(row).toContain(`your edits to ${HOOK} went with it`);
  });

  it("옛 판이 절대경로로 박은 하네스 훅을 알아본다 — 같은 훅을 두 번 부르지 않는다 (PR-1 인계 ①)", () => {
    const abs = `bash ${join(projectDir, ".claude/hooks/session-start.sh")}`;
    const tpl = JSON.parse(template("settings.json")) as Settings;
    tpl.hooks.SessionStart = [{ hooks: [{ type: "command", command: abs } as never] }];
    write(SETTINGS, JSON.stringify(tpl, null, 2));
    writeLog(legacyLog());

    install();

    const calls = commands("SessionStart").filter((c) => c.includes("hooks/session-start.sh"));
    expect(calls, "하네스 SessionStart 훅이 두 번 돈다").toEqual([abs]);
    // 옛 표기를 "설치자가 지웠다" 로 읽으면 안 된다
    expect(log().excluded ?? []).not.toContain("settings:hooks.SessionStart#session-start.sh");
  });

  it("기록이 없어도 이 프로젝트를 절대경로로 부르는 하네스 훅은 이미 있는 것으로 본다 — 두 번 더하지 않는다", () => {
    const abs = `bash ${join(projectDir, ".claude/hooks/session-start.sh")}`;
    write(
      SETTINGS,
      JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: "command", command: abs }] }] } }),
    );

    install();

    const calls = commands("SessionStart").filter((c) => c.includes("hooks/session-start.sh"));
    expect(calls, "하네스 SessionStart 훅이 두 번 돈다").toEqual([abs]);
  });

  it("옛 판 settings.json(템플릿 그대로)의 하네스 훅을 몫으로 이어받는다 — 다음부터는 기록으로 판정", () => {
    write(SETTINGS, template("settings.json"));
    writeLog(legacyLog());

    install();

    expect(commands("SessionStart").filter((c) => c.includes("session-start.sh"))).toHaveLength(1);
    const keys = (log().portions ?? []).filter((p) => p.path === SETTINGS).map((p) => p.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "hooks.SessionStart#session-start.sh",
        "hooks.PreToolUse#protect-files.sh",
      ]),
    );
  });

  it("옛 판이 적어 둔 은퇴 훅 참조는 뺀다 — 설치자 훅은 그대로", () => {
    const tpl = JSON.parse(template("settings.json")) as Settings;
    tpl.hooks.PostToolUse = [
      {
        hooks: [
          {
            type: "command",
            command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/checkpoint-snapshot.sh"',
          },
        ],
      } as never,
      { hooks: [{ type: "command", command: "bash my-post.sh" }] } as never,
    ];
    write(SETTINGS, JSON.stringify(tpl, null, 2));
    writeLog(legacyLog());

    install();

    expect(read(SETTINGS)).not.toContain("checkpoint-snapshot.sh");
    expect(commands("PostToolUse")).toEqual(["bash my-post.sh"]);
  });
});

/* ─── .mcp.json (criterion 4 · #574) ─────────────────────────────────────── */

describe("`.mcp.json` — 하네스 서버만 · 못 읽으면 한 바이트도 안 쓴다 (#574)", () => {
  it("읽지 못하는 `.mcp.json` 은 그대로 두고 화면이 한 줄로 말한다", () => {
    write(".mcp.json", '{ "mcpServers": { "mine": { broken');
    const before = read(".mcp.json");

    const { screen } = install();

    expect(read(".mcp.json"), "깨진 설치자 파일을 덮었다(#574)").toBe(before);
    expect(backupsOf(".mcp.json")).toEqual([]);
    expect(screen).toContain("⊘ left  .mcp.json — could not read it (invalid JSON)");
    expect((log().portions ?? []).some((p) => p.path === ".mcp.json")).toBe(false);
    expect((log().rootFiles ?? []).some((f) => f.path === ".mcp.json")).toBe(false);
  });

  it("같은 이름 서버는 설치자 것이 이기고, 설치자의 다른 키도 남는다", () => {
    write(
      ".mcp.json",
      JSON.stringify({
        mcpServers: { context7: { command: "my-c7" }, own: { command: "x" } },
        note: 1,
      }),
    );

    const { report } = install();

    const mcp = JSON.parse(read(".mcp.json")) as {
      mcpServers: Record<string, { command: string }>;
      note?: number;
    };
    expect(mcp.mcpServers.context7?.command).toBe("my-c7");
    expect(mcp.mcpServers.own?.command).toBe("x");
    expect(mcp.note).toBe(1);
    const keys = (log().portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key);
    expect(keys).not.toContain("mcpServers.context7");
    expect(report.mcpServers).not.toContain("context7");
  });

  it("손으로 지운 하네스 서버는 다음 install 이 되돌린다 — 손으로 지운 것은 빼기가 아니다(ADR-099 R1)", () => {
    install();
    const mcp = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, unknown> };
    expect(mcp.mcpServers.context7).toBeDefined();
    delete mcp.mcpServers.context7;
    write(".mcp.json", JSON.stringify(mcp, null, 2));

    const { screen } = install();

    expect((JSON.parse(read(".mcp.json")) as typeof mcp).mcpServers.context7).toBeDefined();
    expect(log().excluded ?? []).not.toContain("mcp:context7");
    expect(screen).toContain("was missing — restored: mcp:context7");
  });

  it("`--without mcp:<name>` 은 기록 sha 와 같은 서버만 빼고 고친 서버는 남기고 알린다 · 다음 install 도 지킨다 · `--with` 로만 돌아온다", () => {
    install();
    const mcp = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, { env?: unknown }> };
    mcp.mcpServers.github = { ...mcp.mcpServers.github, env: { MINE: "1" } };
    write(".mcp.json", JSON.stringify(mcp, null, 2));

    const { screen } = install({ keyExclude: ["mcp:context7", "mcp:github"] });

    const servers = () =>
      (JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, { env?: unknown }> })
        .mcpServers;
    expect(servers().context7).toBeUndefined(); // 기록 sha 그대로 — 뺐다
    expect(servers().github?.env).toEqual({ MINE: "1" }); // 고쳤다 — 남겼다
    // 리뷰 #693 NOTE-2 — 걷은 것과 남긴 것을 화면이 확인한다 · 같은 키가 "kept yours" 에 또 나오지 않는다
    expect(screen).toContain(
      "removed the harness part: mcp:context7 (you asked: --without mcp:context7)",
    );
    expect(screen).toContain(
      "left in place, no longer managed by the harness (excluded, but you edited it): mcp:github",
    );
    expect(screen).not.toContain("kept yours: github");
    expect(log().excluded).toEqual(expect.arrayContaining(["mcp:context7", "mcp:github"]));

    install({}, "update"); // update 는 선택을 읽기만 한다
    expect(servers().context7).toBeUndefined();

    install({ keyExclude: ["mcp:github"] }); // 다음 install 의 입력이 새 선택 — context7 은 돌아온다
    expect(servers().context7).toBeDefined();
    expect(log().excluded).toEqual(["mcp:github"]);
  });

  it("옛 판이 만든 `.mcp.json` 의 하네스 서버를 몫으로 이어받는다 — 설치자가 고친 서버는 덮지 않는다", () => {
    const servers = renderHarnessMcp(HARNESS_ROOT, ["tooling"]).mcpServers;
    const edited = { ...servers, context7: { ...servers.context7, env: { MY_KEY: "mine" } } };
    write(".mcp.json", JSON.stringify({ mcpServers: edited }, null, 2));
    writeLog(
      legacyLog({
        rootFiles: [{ path: ".mcp.json", change: "created", notes: ["MCP 서버 정의 생성"] }],
      }),
    );

    const { screen } = install();

    const mcp = JSON.parse(read(".mcp.json")) as { mcpServers: Record<string, { env?: unknown }> };
    expect(mcp.mcpServers.context7?.env, "설치자가 고친 하네스 서버를 백업 없이 덮었다").toEqual({
      MY_KEY: "mine",
    });
    const keys = (log().portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key);
    expect(keys).toEqual(
      expect.arrayContaining(Object.keys(servers).map((n) => `mcpServers.${n}`)),
    );
    expect(screen).toContain("kept yours: context7");
  });

  it("옛 판이 병합한 설치자 `.mcp.json` 의 같은 이름 서버는 설치자 것으로 둔다", () => {
    const servers = renderHarnessMcp(HARNESS_ROOT, ["tooling"]).mcpServers;
    write(".mcp.json", JSON.stringify({ mcpServers: servers }, null, 2));
    writeLog(
      legacyLog({ rootFiles: [{ path: ".mcp.json", change: "modified", notes: ["병합"] }] }),
    );

    install();

    const keys = (log().portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key);
    expect(keys.filter((k) => !k.endsWith("{}"))).toEqual([]);
  });
});

/* ─── .gitignore ─────────────────────────────────────────────────────────── */

describe("`.gitignore` — 있을 때만 하네스 줄을 더한다", () => {
  it("없는 `.gitignore` 는 만들지 않는다", () => {
    install();
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(false);
  });

  it("하네스가 더한 줄만 몫으로 적고, 설치자가 이미 둔 줄은 적지 않는다", () => {
    write(".gitignore", "node_modules\n.env\n");

    const { report } = install();

    expect(read(".gitignore").startsWith("node_modules\n.env\n")).toBe(true);
    const keys = (log().portions ?? []).filter((p) => p.path === ".gitignore").map((p) => p.key);
    expect(keys).toEqual([".factory/", ".goose/", ".uzys-agent-harness/", ...BACKUP_PATTERNS]);
    expect(report.envFiles.gitignoreEnvAdded).toBe(false);
  });

  it("옛 판이 더한 줄을 몫으로 이어받는다 — 딸린 주석이 두 번 붙지 않는다", () => {
    const old =
      "node_modules\n\n# Secret env (auto-added by agent-harness install)\n.env\n\n" +
      "# agent CLI / harness 자동 생성물 (auto-added by agent-harness)\n.factory/\n.goose/\n.uzys-agent-harness/\n";
    write(".gitignore", old);
    writeLog(
      legacyLog({
        rootFiles: [
          {
            path: ".gitignore",
            change: "modified",
            notes: [
              "추가된 줄: .env, .factory/, .goose/, .uzys-agent-harness/, …backup patterns(#657)",
            ],
          },
        ],
      }),
    );

    install();

    // #657 — 옛 판이 붙인 줄은 그대로(주석도 두 번 안 붙는다) 이어받고, 이 판이 새로 정의한
    // 백업 패턴은 같은 머리글 아래에 더해진다. "이어받기"는 "새 줄 추가 금지"가 아니다.
    const after = read(".gitignore");
    expect(after.startsWith(old.replace(/\n$/, ""))).toBe(true);
    for (const pat of BACKUP_PATTERNS) expect(after).toContain(pat);
    expect(after.match(/auto-added by agent-harness( install)?\)/g)?.length).toBe(2); // 주석 중복 없음
    const keys = (log().portions ?? []).filter((p) => p.path === ".gitignore").map((p) => p.key);
    expect(keys.sort()).toEqual(
      [...[".env", ".factory/", ".goose/", ".uzys-agent-harness/"], ...BACKUP_PATTERNS].sort(),
    );
  });
});

/* ─── excluded 누적 ──────────────────────────────────────────────────────── */

describe("excluded — install 의 입력이 최신 선택이다 (설계 selection-record §3)", () => {
  it("update 는 지키고, 다음 install 은 그 실행의 `--without` 으로 대체한다", () => {
    const id = "ci-scaffold";
    install({
      baselineExclude: ["baseline:agents/implementer"],
      userOverride: { forceInclude: [], forceExclude: [id] },
    });
    expect(log().excluded).toEqual(expect.arrayContaining(["baseline:agents/implementer", id]));

    install({}, "update");
    expect(log().excluded).toEqual(expect.arrayContaining(["baseline:agents/implementer", id]));

    install({ baselineExclude: ["baseline:agents/implementer"] });
    expect(log().excluded).toEqual(["baseline:agents/implementer"]);

    install();
    expect(log().excluded ?? []).toEqual([]);
  });
});

/* ─── rootFiles displaced — 마지막 하나만 (PR-1 인계 ③) ──────────────────── */

describe("같은 경로의 displaced 기록은 마지막 하나만 둔다", () => {
  it("옛 백업을 가리키지 않는다", () => {
    const spec = specOf();
    const first = buildInstallLog(spec, null, "project", null, null, false, [
      { path: ".claude/rules/x.md", change: "displaced", notes: ["old.backup"] },
    ]);
    const next = buildInstallLog(spec, null, "project", null, first, false, [
      { path: ".claude/rules/x.md", change: "displaced", notes: ["new.backup"] },
    ]);
    expect(next.rootFiles).toEqual([
      { path: ".claude/rules/x.md", change: "displaced", notes: ["new.backup"] },
    ]);
  });
});

/* ─── list · uninstall 의 표시 (PR-1 인계 ②) ─────────────────────────────── */

describe("list · uninstall 이 displaced 를 사실대로 부른다", () => {
  const ANCHOR = "CLAUDE-uzys-harness.md";

  it("list 는 displaced 를 '비켜 둠' 으로, uninstall 은 원래 파일의 백업 자리를 댄다", () => {
    write(ANCHOR, "# my own anchor-named notes\n");
    install();
    const [backup = ""] = backupsOf(ANCHOR);

    const listOut = vi.fn();
    listAction(
      { projectDir },
      { log: listOut, err: listOut, exit: vi.fn() as unknown as (code: number) => never },
    );
    const listed = listOut.mock.calls.flat().join("\n");
    const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expect(listed).toMatch(new RegExp(`${esc(ANCHOR)}\\s+비켜 둠\\s+${esc(backup)}`));

    const lines: string[] = [];
    uninstallAction(
      { projectDir, keepTemplates: true },
      {
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    expect(lines.join("\n")).toContain(
      `${ANCHOR} — 하네스가 쓴 자리 — 원래 있던 설치자 파일은 ${backup} 에 있다`,
    );
  });

  it("uninstall --dry-run 은 옮겨 둘 `.claude/` 안의 기록을 '남는 것' 으로 예고하지 않는다", () => {
    write(".claude/rules/git-policy.md", "# mine\n");
    install();
    expect(log().rootFiles?.map((f) => f.path)).toEqual(
      expect.arrayContaining([".claude/settings.json", ".claude/rules/git-policy.md"]),
    );

    const lines: string[] = [];
    uninstallAction(
      { projectDir, dryRun: true },
      {
        log: (l: string) => lines.push(l),
        err: (l: string) => lines.push(l),
        exit: () => undefined as never,
        resolveHarnessRoot: () => HARNESS_ROOT,
      },
    );
    const out = lines.join("\n");
    expect(out).toContain("move .claude/ aside");
    expect(out).not.toMatch(/· \.claude\//);
  });
});

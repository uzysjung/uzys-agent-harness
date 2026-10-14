/**
 * #781 (ADR-111 · 설계 `docs/plans/v26.170.0-legacy-displaced-design.md` §4.4 · §7.1) — 옛 판 설치본의 uninstall 잔존.
 *
 * 설치자에게 달라지는 것: 옛 판(v26.83~v26.161)으로 깔고 바로 uninstall 하면 그 판이 바이트 그대로 깐 은퇴 스킬 · `commands/ecc` ·
 * 강등 에이전트 · 옛 앵커 `.claude/CLAUDE.md` · `.agents/skills` 사본이 라이브에 남아 다음 세션이 계속 읽었고, `settings.json` 에는
 * 지워진 스크립트를 부르는 훅 줄이 남았다. 이제 그 파일은 라이브에서 빠진다 — 현행 번들 자리(다시 깔면 현행 판으로 채워진다)는
 * 백업 없이, 그 밖은 `<file>.backup-<시각>` 을 남기고. 바이트가 하나라도 다른 파일 · 그 자리를 쓰는 CLI 가 깔린 적 없는 자리 ·
 * 설치자가 뺀 자산 · 하네스가 비켜 둔 설치자 파일은 그대로다.
 *
 * 픽스처 = 태그 v26.125.0 의 `templates/` 바이트 그대로(`tests/fixtures/legacy-26.125/`) — 생성 모듈의 sha 를 쓰지 않는다.
 */

import {
  existsSync,
  lstatSync,
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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  type InstallLog,
  installLogPath,
  legacyInstallLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const FIX = join(__dirname, "fixtures", "legacy-26.125");
const old = (rel: string): string => readFileSync(join(FIX, rel), "utf8");

// 번들 밖(은퇴 스킬 · 옛 커맨드 · 옛 앵커 · 강등 에이전트 · 은퇴 룰)
const RETIRED_SKILL = ".claude/skills/strategic-compact/SKILL.md";
const ECC = ".claude/commands/ecc/e2e.md";
const OLD_ANCHOR = ".claude/CLAUDE.md";
const DEMOTED_AGENT = ".claude/agents/strategist.md";
const RETIRED_RULE = ".claude/rules/code-style.md";
// 현행 번들 자리(다시 깔면 현행 판으로 채워진다)
const AGENTS_COPY = ".agents/skills/compaction-handoff/SKILL.md";
const CURRENT_RULE = ".claude/rules/git-policy.md";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-legacy-fp-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
const put = (rel: string, text: string): void => {
  // 현행 설치가 링크 슬롯으로 둔 자리면 링크를 걷고 실제 폴더에 쓴다(옛 판은 복사본을 두었다)
  const slot = rel.split("/").slice(0, 3).join("/");
  if (lstatSync(abs(slot), { throwIfNoEntry: false })?.isSymbolicLink() === true) rmSync(abs(slot));
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};

function install(cli: CliTargets) {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode: "add",
    spec: { tracks: ["tooling"], options: { withCodexTrust: false }, cli: [...cli], projectDir },
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir">) {
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

function currentLog(): InstallLog {
  const l = readInstallLog(projectDir);
  if (!l) throw new Error("install log missing");
  return l;
}

/** v26.125.0 의 기록 모양 — 파일 필드 · 몫 기록이 없고 `.claude/` 안에 있다. */
function toFieldless(edit: (l: InstallLog) => void = () => {}): void {
  const l = currentLog();
  delete l.records;
  delete l.policyFiles;
  delete l.skillFiles;
  delete l.externalFiles;
  delete l.portions;
  edit(l);
  writeInstallLog(projectDir, l);
  renameSync(installLogPath(projectDir), legacyInstallLogPath(projectDir));
}

/** 그 파일 옆의 `<name>.backup-*` 내용들. */
function backupsOf(rel: string): string[] {
  const dir = dirname(abs(rel));
  if (!existsSync(dir)) return [];
  const base = rel.split("/").pop() ?? "";
  return readdirSync(dir)
    .filter((n) => n.startsWith(`${base}.backup-`))
    .map((n) => readFileSync(join(dir, n), "utf8"));
}

/** 프로젝트 전체 파일 → 내용(링크는 대상 문자열) — 바이트 그대로 남았는지 대조. */
function snapshot(): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of readdirSync(projectDir, { recursive: true, withFileTypes: true })) {
    const full = join(e.parentPath, e.name);
    const rel = full.slice(projectDir.length + 1);
    if (e.isSymbolicLink()) out.set(rel, `-> ${full}`);
    else if (e.isFile()) out.set(rel, readFileSync(full, "utf8"));
  }
  return out;
}

/** 옛 판이 깐 하네스 파일들을 바이트 그대로 둔다. */
function putOldHarnessFiles(): void {
  put(RETIRED_SKILL, old("skills/strategic-compact/SKILL.md"));
  put(ECC, old("commands/ecc/e2e.md"));
  put(OLD_ANCHOR, old("CLAUDE.md"));
  put(AGENTS_COPY, old("skills/compaction-handoff/SKILL.md"));
}

/** 26.125 템플릿 settings.json 의 훅 셋 + 설치자 훅 하나. */
function putOldSettings(): void {
  const handler = (script: string) => ({
    type: "command",
    command: `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${script}"`,
  });
  put(
    ".claude/settings.json",
    `${JSON.stringify(
      {
        hooks: {
          SessionStart: [{ hooks: [handler("session-start.sh")] }],
          PreToolUse: [
            { matcher: "Write|Edit", hooks: [handler("protect-files.sh")] },
            { matcher: "mcp__.*", hooks: [handler("mcp-pre-exec.sh")] },
            { matcher: "Bash", hooks: [handler("mine.sh")] },
          ],
        },
      },
      null,
      2,
    )}\n`,
  );
  put(".claude/hooks/mine.sh", "echo mine\n");
}

const hookScripts = (): string[] => {
  const s = JSON.parse(read(".claude/settings.json")) as {
    hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
  };
  return Object.values(s.hooks)
    .flat()
    .flatMap((g) => g.hooks.map((h) => /hooks\/([^"]+)"/.exec(h.command)?.[1] ?? h.command));
};

describe("① ② 필드 없는 옛 기록(claude+codex) — 바로 uninstall", () => {
  it("번들 밖 지문 파일은 백업 뒤 라이브에서 빠지고 · 번들 자리는 백업 없이 · 고친 것은 남는다", () => {
    install(["claude", "codex"]);
    putOldHarnessFiles();
    const editedAgent = `${old("agents/strategist.md")}\n<!-- mine -->\n`;
    put(DEMOTED_AGENT, editedAgent);
    put(RETIRED_RULE, old("rules/code-style.md"));
    put(CURRENT_RULE, old("rules/git-policy.md"));
    toFieldless();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    // 번들 밖 — 라이브 0 · 그 파일 하나의 백업 1(바이트 그대로)
    for (const [rel, body] of [
      [RETIRED_SKILL, old("skills/strategic-compact/SKILL.md")],
      [ECC, old("commands/ecc/e2e.md")],
      [OLD_ANCHOR, old("CLAUDE.md")],
      [RETIRED_RULE, old("rules/code-style.md")],
    ] as const) {
      expect(existsSync(abs(rel)), rel).toBe(false);
      expect(backupsOf(rel), rel).toEqual([body]);
    }
    expect(out.text).toContain(
      `backed up  ${ECC} — older harness version (byte-identical, not in the current bundle) — saved a copy, removed from live`,
    );
    expect(out.text).toContain(
      `backed up  ${RETIRED_RULE} — older harness version (byte-identical, not in the current bundle)`,
    );
    // `commands/ecc/` 에는 백업만 남는다 — 라이브로 읽힐 커맨드가 없다(빈 폴더 걷기는 백업이 있어 일어나지 않는다)
    expect(readdirSync(abs(".claude/commands/ecc")).every((n) => n.includes(".backup-"))).toBe(
      true,
    );
    // 번들 자리 — 라이브 0 · 백업 0
    for (const rel of [AGENTS_COPY, CURRENT_RULE]) {
      expect(existsSync(abs(rel)), rel).toBe(false);
      expect(backupsOf(rel), rel).toEqual([]);
    }
    // 바이트가 다른 파일(설치자가 고침) — 라이브 그대로 · 백업 없음 · 남은 목록에 든다
    expect(read(DEMOTED_AGENT)).toBe(editedAgent);
    expect(backupsOf(DEMOTED_AGENT)).toEqual([]);
    expect(out.text).toMatch(
      /left {2}\.claude\/ — \d+ file\(s\) not on the install record.*agents\/strategist\.md/,
    );
  });
});

describe("③ 옛 템플릿 훅 줄 — 스크립트가 없을 때만 걷는다", () => {
  it("26.126+ 모양 기록(`policyFiles` 있음 · 몫 없음): 스크립트가 지워진 줄만 걷히고 설치자 스크립트가 남은 줄 · 설치자 훅은 남는다", () => {
    install(["claude"]);
    putOldSettings();
    // 설치자가 같은 이름으로 둔 자기 스크립트 — 지문에 안 걸려 남는다(그 줄도 남아야 한다)
    put(".claude/hooks/protect-files.sh", "echo mine-protect\n");
    const l = currentLog();
    delete l.records;
    delete l.portions;
    l.policyFiles = (l.policyFiles ?? []).filter((f) => f.path !== "hooks/protect-files.sh");
    writeInstallLog(projectDir, l);

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(read(".claude/hooks/protect-files.sh")).toBe("echo mine-protect\n");
    expect(hookScripts().sort()).toEqual(["mine.sh", "protect-files.sh"]);
    expect(out.text).toContain(
      ".claude/settings.json — removed harness hook wiring from an older version (script gone): hooks/session-start.sh · hooks/mcp-pre-exec.sh",
    );
    // 걷은 줄을 "남았을 수 있다" 로 다시 말하지 않는다
    expect(out.text).not.toMatch(/may still hold the harness's hooks.*session-start/);
  });

  it("필드 없는 기록: 옛 판 자리의 스크립트는 바꿨어도 백업 뒤 빠지고 그 줄도 빠진다(N6) · 설치자 훅은 남는다", () => {
    install(["claude"]);
    putOldSettings();
    put(".claude/hooks/protect-files.sh", "echo mine-protect\n");
    toFieldless();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(existsSync(abs(".claude/hooks/protect-files.sh"))).toBe(false);
    expect(backupsOf(".claude/hooks/protect-files.sh")).toEqual(["echo mine-protect\n"]);
    expect(hookScripts()).toEqual(["mine.sh"]);
  });
});

describe("⑤ ⑩ ⑪ 기록 · 설치자 선택이 바이트보다 앞선다", () => {
  it("displaced 기록 자리 · excluded 자산 · 링크 슬롯 아래의 옛 바이트는 그대로다", () => {
    install(["claude"]);
    put(DEMOTED_AGENT, old("agents/strategist.md"));
    put(RETIRED_SKILL, old("skills/strategic-compact/SKILL.md"));
    // 링크 슬롯 — 프로젝트 안 다른 폴더를 가리키는 `.claude/skills/<id>`(#524 의 모양)
    put("vendor/handoff/SKILL.md", old("skills/compaction-handoff/SKILL.md"));
    rmSync(abs(".claude/skills/compaction-handoff"), { recursive: true, force: true });
    symlinkSync(abs("vendor/handoff"), abs(".claude/skills/compaction-handoff"));
    toFieldless((l) => {
      l.excluded = ["strategic-compact"];
      l.rootFiles = [
        ...(l.rootFiles ?? []),
        { path: DEMOTED_AGENT, change: "displaced", notes: [`${DEMOTED_AGENT}.backup-x`] },
      ];
    });

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(read(DEMOTED_AGENT)).toBe(old("agents/strategist.md"));
    expect(read(RETIRED_SKILL)).toBe(old("skills/strategic-compact/SKILL.md"));
    expect(read("vendor/handoff/SKILL.md")).toBe(old("skills/compaction-handoff/SKILL.md"));
    for (const rel of [DEMOTED_AGENT, RETIRED_SKILL]) expect(backupsOf(rel)).toEqual([]);
  });
});

describe("⑧ ⑨ 그 자리를 쓰는 CLI 가 기록에 없으면 읽지도 않는다(B2)", () => {
  it("codex 단독 설치본의 `.claude/` — 옛 판 바이트여도 그대로 · 백업 0 · 화면에 옛 판 문구 없음", () => {
    install(["codex"]);
    put(RETIRED_RULE, old("rules/code-style.md"));
    put(ECC, old("commands/ecc/e2e.md"));
    toFieldless();
    const before = snapshot();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    for (const rel of [RETIRED_RULE, ECC]) {
      expect(read(rel)).toBe(before.get(rel));
      expect(backupsOf(rel)).toEqual([]);
    }
    expect(out.text).not.toContain("older harness version (byte-identical");
  });

  it("claude 단독 설치본의 `.agents/skills/` — 옛 사본 바이트 그대로", () => {
    install(["claude"]);
    put(AGENTS_COPY, old("skills/compaction-handoff/SKILL.md"));
    put(".agents/skills/strategic-compact/SKILL.md", old("skills/strategic-compact/SKILL.md"));
    toFieldless();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(read(AGENTS_COPY)).toBe(old("skills/compaction-handoff/SKILL.md"));
    expect(read(".agents/skills/strategic-compact/SKILL.md")).toBe(
      old("skills/strategic-compact/SKILL.md"),
    );
    expect(backupsOf(".agents/skills/strategic-compact/SKILL.md")).toEqual([]);
  });
});

describe("⑥ ⑦ `--cli` 범위 · dry-run", () => {
  it("--cli claude(claude+codex) 는 `.claude/` 아래만 — `.agents/skills` 사본은 남는 codex 몫이라 그대로", () => {
    install(["claude", "codex"]);
    putOldHarnessFiles();
    toFieldless();

    const out = uninstall({ cli: "claude", yes: true });

    expect(out.code).toBe(0);
    for (const rel of [RETIRED_SKILL, ECC, OLD_ANCHOR])
      expect(existsSync(abs(rel)), rel).toBe(false);
    expect(read(AGENTS_COPY)).toBe(old("skills/compaction-handoff/SKILL.md"));
  });

  // #769 리뷰 HIGH-2 (ⓔ4) — 링크 슬롯이 가리키는 본문은 claude 몫이다: --cli codex 는 남기고, claude 까지 나가는 전량은 회수한다
  it("--cli codex 가 claude 링크 슬롯의 옛 사본을 남긴 뒤 · update · 전량 uninstall 은 그 사본을 회수한다", () => {
    install(["claude", "codex"]);
    putOldHarnessFiles();
    toFieldless();
    const slot = abs(".claude/skills/compaction-handoff");
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(join("..", "..", ".agents/skills/compaction-handoff"), slot);
    expect(readFileSync(join(slot, "SKILL.md"), "utf8")).toBe(
      old("skills/compaction-handoff/SKILL.md"),
    );

    expect(uninstall({ cli: "codex", yes: true }).code).toBe(0);
    expect(read(AGENTS_COPY)).toBe(old("skills/compaction-handoff/SKILL.md")); // Claude 가 아직 쓴다
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      mode: "update",
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
    });

    expect(uninstall({ yes: true }).code).toBe(0);
    expect(existsSync(abs(AGENTS_COPY))).toBe(false);
  });

  it("dry-run 은 디스크를 바꾸지 않고 실행과 같은 수 · 같은 훅 줄을 말한다", () => {
    install(["claude", "codex"]);
    putOldHarnessFiles();
    putOldSettings();
    toFieldless();
    const before = snapshot();

    const preview = uninstall({ yes: true, dryRun: true });

    expect(preview.code).toBe(0);
    expect(snapshot()).toEqual(before);
    const planned = [
      ...preview.text.matchAll(
        /○ remove (\d+) harness file\(s\) under (\S+)(?: \((\d+) with a copy saved)?/g,
      ),
    ]
      .map((m) => `${m[2]} ${m[1]}/${m[3] ?? 0}`)
      .sort();
    expect(preview.text).toContain(
      "○ remove harness hook wiring from an older version (script gone) from .claude/settings.json: hooks/session-start.sh · hooks/protect-files.sh · hooks/mcp-pre-exec.sh",
    );

    const run = uninstall({ yes: true });

    expect(run.code).toBe(0);
    const removed = /removed {2}(.+)$/m.exec(run.text)?.[1] ?? "";
    const backedUp = (top: string): number =>
      [...run.text.matchAll(/backed up {2}(\S+)/g)].filter((m) => m[1]?.startsWith(top)).length;
    const done = removed
      .split(" · ")
      .map((part) => /^(\S+) (\d+)/.exec(part))
      .flatMap((m) => (m ? [`${m[1]} ${m[2]}/${backedUp(m[1] ?? "")}`] : []))
      .sort();
    expect(planned).toEqual(done);
    expect(hookScripts()).toEqual(["mine.sh"]);
  });
});

/**
 * #781 리뷰 BLOCKER — 설치자가 옛 하네스 훅 줄에 자기 명령을 이어 붙였거나 고쳤으면 그 줄은 설치자 것이다. 참조(경로)가 같아도
 * 옛 템플릿 바이트와 다르면 uninstall(바로 · `--cli`)도 update 의 몫 찾기도 건드리지 않는다 — 고친 줄은 그대로 남고, 남은 하네스
 * 훅이 있을 수 있다는 안내로 떨어진다. 바이트 그대로인 옛 줄은 여전히 걷힌다.
 */
describe("⑫ 고친 옛 훅 줄은 설치자 줄이다 — 바이트 그대로인 줄만 걷는다", () => {
  const ORIG = (script: string): string => `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${script}"`;
  const GUARD = `${ORIG("protect-files.sh")} && bash ./scripts/team-guard.sh`;
  const MCP = `${ORIG("mcp-pre-exec.sh")} && bash ./scripts/team-guard.sh`;
  const SESSION = ORIG("session-start.sh");

  const commands = (): string[] => {
    const s = JSON.parse(read(".claude/settings.json")) as {
      hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    return Object.values(s.hooks ?? {})
      .flat()
      .flatMap((g) => g.hooks.map((h) => h.command));
  };

  /** 26.125 템플릿 훅 셋 중 protect-files · mcp-pre-exec(은퇴) 줄 끝에 설치자 명령을 이어 붙였다. session-start 는 그대로. */
  function putEditedOldSettings(): void {
    putOldSettings();
    put(
      ".claude/settings.json",
      read(".claude/settings.json")
        .replace(JSON.stringify(ORIG("protect-files.sh")), JSON.stringify(GUARD))
        .replace(JSON.stringify(ORIG("mcp-pre-exec.sh")), JSON.stringify(MCP)),
    );
    expect(commands()).toEqual(expect.arrayContaining([GUARD, MCP, SESSION])); // 전제
  }

  it.each([
    ["바로 uninstall", {}],
    ["--cli claude", { cli: "claude" }],
  ] as const)("%s — 고친 두 줄은 바이트 그대로 남고 안내가 붙는다 · 그대로인 session-start 줄은 걷힌다", (_, opts) => {
    install(["claude", "codex"]);
    putEditedOldSettings();
    toFieldless();

    const out = uninstall({ yes: true, ...opts });

    expect(out.code).toBe(0);
    const left = commands();
    expect(left).toContain(GUARD);
    expect(left).toContain(MCP);
    expect(left).not.toContain(SESSION);
    expect(out.text).toContain(
      ".claude/settings.json — removed harness hook wiring from an older version (script gone): hooks/session-start.sh",
    );
    expect(out.text).toMatch(/may still hold the harness's hooks.*protect-files/);
  });

  it("옛 판 → update → uninstall — update 가 고친 줄을 하네스 몫으로 적지 않아 uninstall 뒤에도 남는다", () => {
    install(["claude"]);
    putEditedOldSettings();
    toFieldless();

    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      mode: "update",
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
    });
    expect(commands()).toEqual(expect.arrayContaining([GUARD, MCP]));
    const keys = (currentLog().portions ?? [])
      .filter((p) => p.path === ".claude/settings.json")
      .map((p) => p.key);
    expect(keys).not.toContain("hooks.PreToolUse#protect-files.sh");
    expect(keys).not.toContain("hooks.PreToolUse#mcp-pre-exec.sh");

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    const left = commands();
    expect(left).toContain(GUARD);
    expect(left).toContain(MCP);
    expect(left).not.toContain(SESSION); // 바이트 그대로인 줄은 update 가 몫으로 적었고 uninstall 이 걷는다
  });

  it("claude 를 깐 적 없는 기록(codex 단독)이면 스크립트가 없어도 옛 훅 줄을 읽지도 않는다 (B2)", () => {
    install(["codex"]);
    putOldSettings(); // 바이트 그대로인 옛 줄 · 스크립트 없음
    toFieldless();
    const before = read(".claude/settings.json");

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(read(".claude/settings.json")).toBe(before);
  });
});

/**
 * #543 — `uninstall --track <name>` (설계 `docs/plans/543-track-uninstall-design.md` · 검증 `docs/plans/543-design-verify.md`).
 *
 * 판정 기준 한 문장: **트랙 하나를 빼면 그 트랙에만 속한 룰 · 에이전트 · 스킬이 네 CLI 자리에서 빠지고, 남는 트랙이 같이 쓰는 것 ·
 * 설치자 파일 · `--with` 항목 · 외부 자산 · MCP 행은 남으며, 기록과 메타파일에서 트랙이 빠져 다음 update 가 되살리지도 바꾸지도 않는다.**
 */

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
import { dirname, join, relative, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listAction } from "../src/commands/list.js";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec, Track } from "../src/types.js";
import {
  buildUninstallModeChoices,
  runInteractiveUninstall,
  type UninstallPrompts,
} from "../src/uninstall-interactive.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un543-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const has = (rel: string): boolean => existsSync(abs(rel));
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};

function install(
  tracks: Track[],
  cli: CliBase[],
  extra: Partial<InstallSpec> = {},
  mode: "add" | "update" = "add",
): void {
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode,
    spec: { tracks, options: { withCodexTrust: false }, cli, projectDir, ...extra },
  });
}

function uninstall(options: Omit<UninstallOptions, "projectDir">) {
  const out = { lines: [] as string[], errors: [] as string[], code: null as number | null };
  uninstallAction(
    { projectDir, ...options },
    {
      log: (l: string) => out.lines.push(l),
      err: (l: string) => out.errors.push(l),
      exit: (code: number) => {
        out.code ??= code;
        return undefined as never;
      },
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const strip = (l: string[]) => l.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { ...out, text: strip(out.lines), errText: strip(out.errors) };
}

function log(): InstallLog {
  const l = readInstallLog(projectDir);
  if (!l) throw new Error("install log missing");
  return l;
}

/** 기록의 네 파일 필드 경로(프로젝트 상대). */
function recordedPaths(l: InstallLog): string[] {
  return [
    ...(l.policyFiles ?? []).map((f) => `.claude/${f.path}`),
    ...(l.skillFiles ?? []).map((f) => `.claude/skills/${f.path}`),
    ...(l.externalFiles ?? []).map((f) => f.path),
  ];
}

/** 프로젝트의 파일 목록(백업 · 설치 기록 폴더 제외) — 디스크 비교용. */
function files(): string[] {
  return readdirSync(projectDir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(projectDir, join(e.parentPath, e.name)).split("\\").join("/"))
    .filter((p) => !p.startsWith(".uzys-agent-harness/") && !p.includes(".backup-"))
    .sort();
}

function snapshot(): Map<string, string> {
  return new Map(files().map((p) => [p, read(p)]));
}

const backups = (): string[] =>
  readdirSync(projectDir, { recursive: true })
    .filter((p) => String(p).includes(".backup-"))
    .map(String);

const CSR_ONLY = [
  ".claude/rules/ui-components.md",
  ".claude/skills/ui-visual-review/SKILL.md",
  ".agents/rules/ui-components.md",
  ".agents/skills/ui-visual-review/SKILL.md",
];
const SHARED = [
  ".claude/rules/git-policy.md",
  ".claude/rules/cli-development.md",
  ".claude/skills/objective-brief/SKILL.md",
  ".agents/skills/objective-brief/SKILL.md",
  ".claude/hooks/session-start.sh",
  "CLAUDE-uzys-harness.md",
];

describe("#543 uninstall --track — 판정 기준", () => {
  it("1 · 그 트랙만 가져오는 것만 네 CLI 자리에서 빠지고 남는 트랙이 쓰는 것은 남는다 · 기록에서 트랙이 빠진다", () => {
    install(["tooling", "csr-fastapi"], ["claude", "codex", "antigravity"]);
    for (const p of [...CSR_ONLY, ...SHARED]) expect(has(p), p).toBe(true); // 시나리오 자기검증

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(0);
    for (const p of CSR_ONLY) expect(has(p), p).toBe(false);
    for (const p of SHARED) expect(has(p), p).toBe(true);
    const l = log();
    expect(l.spec.tracks).toEqual(["tooling"]);
    expect([...(l.spec.clis ?? [])].sort()).toEqual(["antigravity", "claude", "codex"]);
    const recorded = recordedPaths(l);
    for (const p of CSR_ONLY) expect(recorded, p).not.toContain(p);
    expect(recorded).toContain(".claude/rules/git-policy.md");
    expect(out.text).toContain("✓ csr-fastapi removed (remaining: tooling)");
  });

  it("2 · heal 이 되살리지 않는다 — 메타파일과 그 sha 가 기록과 함께 바뀐다", () => {
    install(["tooling", "csr-fastapi"], ["claude"]);

    uninstall({ track: "csr-fastapi" });

    expect(read(".claude/.installed-tracks")).toBe("tooling\n");
    const l = log(); // readInstallLog 는 heal 을 거친다
    expect(l.spec.tracks).toEqual(["tooling"]);
    expect(l.policyFiles?.find((f) => f.path === ".installed-tracks")?.sha256).toBe(
      hashContent("tooling\n"),
    );
  });

  it("3 · 고친 파일은 그 파일 하나를 백업한 뒤 빠진다", () => {
    install(["tooling", "csr-fastapi"], ["claude"]);
    put(".claude/rules/ui-components.md", `${read(".claude/rules/ui-components.md")}\nmine\n`);

    const out = uninstall({ track: "csr-fastapi" });

    expect(has(".claude/rules/ui-components.md")).toBe(false);
    const saved = readdirSync(abs(".claude/rules")).filter((n) =>
      n.startsWith("ui-components.md.backup-"),
    );
    expect(saved).toHaveLength(1);
    expect(readFileSync(abs(`.claude/rules/${saved[0]}`), "utf8")).toContain("\nmine\n");
    expect(out.text).toContain("you edited it — saved as .claude/rules/ui-components.md.backup-");
    expect(out.text).toContain("removed from live");
  });

  it("4 · 하네스가 자리를 빌렸던 설치자 파일은 제자리로 돌아온다", () => {
    put(".claude/rules/ui-components.md", "# my own ui rules\n");
    install(["tooling", "csr-fastapi"], ["claude"]);
    expect(log().rootFiles?.some((f) => f.change === "displaced")).toBe(true); // 대조군

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(0);
    expect(read(".claude/rules/ui-components.md")).toBe("# my own ui rules\n");
    expect(log().rootFiles?.some((f) => f.change === "displaced")).toBe(false);
  });

  it("5 · 전제 검사 — 아무것도 안 바꾸고 거절한다 · `--yes` 는 전량으로 흘리지 않는다", () => {
    install(["tooling", "csr-fastapi"], ["claude", "codex"]);
    const before = snapshot();

    expect(uninstall({ track: "nope" }).errText).toContain("Invalid --track value: nope");
    const notInstalled = uninstall({ track: "data" });
    expect(notInstalled.code).toBe(1);
    expect(notInstalled.errText).toContain("data is not installed in this project");
    expect(notInstalled.errText).toContain("installed: csr-fastapi, tooling");
    expect(uninstall({ track: "tooling", only: "x" }).code).toBe(1);
    expect(uninstall({ track: "tooling", cli: "codex" }).code).toBe(1);
    expect(snapshot()).toEqual(before);
    expect(log().spec.tracks).toEqual(["csr-fastapi", "tooling"]);

    // T6 — `--yes` 가 같이 와도 트랙 제거만 한다
    const yes = uninstall({ track: "csr-fastapi", yes: true });
    expect(yes.code).toBe(0);
    expect(has(".claude/rules/git-policy.md")).toBe(true);
    expect(log().spec.tracks).toEqual(["tooling"]);

    // 마지막 트랙
    const last = uninstall({ track: "tooling" });
    expect(last.code).toBe(1);
    expect(last.errText).toContain("마지막 트랙");
    expect(has(".claude/rules/git-policy.md")).toBe(true);
  });

  it("5 · base 를 빼면 다른 dev 트랙이 이미 다 갖고 있어 파일 0 · 기록만 갱신", () => {
    install(["base", "tooling"], ["claude"]);
    const before = files();

    const dry = uninstall({ track: "base", dryRun: true });
    expect(dry.text).toContain("○ removes: nothing only base installs");
    const out = uninstall({ track: "base" });

    expect(out.code).toBe(0);
    expect(files()).toEqual(before);
    expect(log().spec.tracks).toEqual(["tooling"]);
  });

  it("6 · dry-run 은 아무것도 안 바꾸고 · 빼는 이름을 말하고 · 예고한 수가 실행과 같다", () => {
    install(["tooling", "csr-fastapi"], ["claude", "codex"]);
    const before = snapshot();
    const logBefore = JSON.stringify(log());

    const dry = uninstall({ track: "csr-fastapi", dryRun: true });

    expect(dry.code).toBe(0);
    expect(snapshot()).toEqual(before);
    expect(JSON.stringify(log())).toBe(logBefore);
    expect(dry.text).toContain("○ removes: rules ui-components · skills ui-visual-review");
    const planned = [...dry.text.matchAll(/○ remove (\d+) harness file\(s\) under (\S+)/g)].map(
      (m) => `${m[2]} ${m[1]}`,
    );
    expect(planned.length).toBeGreaterThan(0);

    const out = uninstall({ track: "csr-fastapi" });
    const done = /removed {2}(.+)$/m.exec(out.text)?.[1] ?? "";
    for (const p of planned) {
      const [top, n] = p.split(" ");
      expect(done).toMatch(new RegExp(`${top}( ${n} harness file\\(s\\)| ${n})`));
    }
  });

  it("7 · AGENTS.md 는 남는 트랙으로 다시 렌더되고 설치자 문단은 그대로 · 이어서 update 해도 조용하다", () => {
    install(["tooling", "csr-fastapi"], ["claude", "codex"]);
    put(
      "AGENTS.md",
      read("AGENTS.md").replace("## Project Context\n", "## Project Context\n\n우리 팀 문단.\n"),
    );
    install(["tooling", "csr-fastapi"], ["claude", "codex"], {}, "update");
    expect(read("AGENTS.md")).toContain("## UI Components"); // 대조군

    const out = uninstall({ track: "csr-fastapi" });

    const after = read("AGENTS.md");
    expect(after).not.toContain("## UI Components");
    expect(after).toContain("우리 팀 문단.");
    expect(out.text).toContain("AGENTS.md — re-rendered for Codex (your sections kept)");
    expect(log().externalFiles?.find((f) => f.path === "AGENTS.md")?.sha256).toBe(
      hashContent(after),
    );
    const snap = snapshot();
    const backupsBefore = backups();

    install(["tooling"], ["claude", "codex"], {}, "update");

    expect(backups()).toEqual(backupsBefore);
    expect(snapshot()).toEqual(snap);
  });

  it("8 · 외부 자산 · 기본 MCP 행은 남기고 빼는 명령을 댄다(D1 · D2)", () => {
    install(["tooling", "csr-fastapi"], ["claude"]);
    const l = log();
    writeInstallLog(projectDir, {
      ...l,
      assets: [
        ...l.assets,
        {
          id: "frontend-design",
          category: "dev-tools",
          method: "skill",
          scope: "project",
          detail: {},
        },
      ],
    });
    const mcpBefore = read(".mcp.json");
    expect(mcpBefore).toContain("railway-mcp-server"); // 대조군

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(0);
    expect(read(".mcp.json")).toBe(mcpBefore);
    expect(log().assets.map((a) => a.id)).toContain("frontend-design");
    expect(out.text).toContain(
      "⊘ left  asset frontend-design (a default of csr-fastapi) — remove with: agent-harness uninstall --only frontend-design",
    );
    expect(out.text).toMatch(
      /⊘ left {2}MCP servers .*railway-mcp-server.* \(defaults of csr-fastapi, kept because your install record has them\) — drop: agent-harness install --track tooling .*--without railway-mcp-server/,
    );
    expect(out.text).toContain("this re-runs the whole install");
  });

  it("10 · 옛 스캔 기록(records 없음) — 고친 것은 백업 뒤 · 그대로인 것은 백업 없이 · 뺀 것은 남는다", () => {
    install(["tooling", "csr-fastapi"], ["claude"], {
      baselineExclude: ["baseline:rules/ui-components"],
    });
    expect(has(".claude/rules/ui-components.md")).toBe(false); // 뺀 룰은 처음부터 없다
    put(".claude/rules/ui-components.md", "# mine — written after the harness left it out\n");
    put(
      ".claude/skills/ui-visual-review/SKILL.md",
      `${read(".claude/skills/ui-visual-review/SKILL.md")}\nedited\n`,
    );
    const l = log();
    delete l.records;
    writeInstallLog(projectDir, l);

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(0);
    // ⓒ excluded 경로는 후보가 아니다 — 설치자 파일 그대로
    expect(read(".claude/rules/ui-components.md")).toBe(
      "# mine — written after the harness left it out\n",
    );
    // ⓐ 스캔 sha 와 다른 스킬 본문 → 백업 뒤 제거
    expect(has(".claude/skills/ui-visual-review/SKILL.md")).toBe(false);
    expect(
      readdirSync(abs(".claude/skills/ui-visual-review")).some((n) =>
        n.startsWith("SKILL.md.backup-"),
      ),
    ).toBe(true);
    // ⓑ 스캔 sha 그대로인 파일 → 백업 없이 제거
    const plain = readdirSync(abs(".claude/skills/ui-visual-review"));
    expect(plain.every((n) => n.startsWith("SKILL.md.backup-"))).toBe(true);
  });
});

describe("#543 uninstall --track — 검증 보고 §6 장면", () => {
  it("T1 · 비-dev 트랙이 남으면 dev 전용 룰 · 에이전트 · 스킬 · 상시 스킬이 빠지고 AGENTS.md 안내에서도 빠진다 · update 조용", () => {
    install(["tooling", "executive"], ["claude", "codex"]);
    expect(has(".claude/agents/strategist.md")).toBe(true); // executive 대조군
    expect(read("AGENTS.md")).toContain("user-centered-explanation"); // 상시 안내 대조군

    const out = uninstall({ track: "tooling" });

    expect(out.code).toBe(0);
    expect(has(".claude/rules/cli-development.md")).toBe(false);
    expect(has(".claude/agents/implementer.md")).toBe(false);
    expect(has(".claude/skills/user-centered-explanation")).toBe(false);
    expect(has(".agents/skills/user-centered-explanation")).toBe(false);
    expect(has(".claude/agents/strategist.md")).toBe(true);
    expect(has(".claude/rules/git-policy.md")).toBe(true);
    expect(has(".claude/hooks/session-start.sh")).toBe(true);
    expect(has("CLAUDE-uzys-harness.md")).toBe(true);
    expect(read("AGENTS.md")).not.toContain("user-centered-explanation");
    expect(read("CLAUDE.md")).not.toContain("user-centered-explanation"); // 루트 하네스 블록의 상시 스킬 안내
    expect(out.text).toContain("CLAUDE.md — harness block refreshed");
    const snap = snapshot();

    install(["executive"], ["claude", "codex"], {}, "update");

    const now = snapshot();
    const diff = [...new Set([...snap.keys(), ...now.keys()])].filter(
      (k) => snap.get(k) !== now.get(k),
    );
    expect(diff).toEqual([]);
  });

  it("T2 · full 을 빼면 full 만의 것이 빠지고 tooling 의 룰은 남는다", () => {
    install(["full", "tooling"], ["claude"]);

    uninstall({ track: "full" });

    for (const p of [
      ".claude/rules/ui-components.md",
      ".claude/skills/ui-visual-review",
      ".claude/agents/data-analyst.md",
      ".claude/agents/strategist.md",
    ]) {
      expect(has(p), p).toBe(false);
    }
    expect(has(".claude/rules/cli-development.md")).toBe(true);
    expect(log().spec.tracks).toEqual(["tooling"]);
  });

  it("T3 · `--with` 로 고른 옵트인 스킬은 남는다", () => {
    install(["tooling", "csr-fastapi"], ["claude", "codex"], {
      userOverride: { forceInclude: ["compaction-handoff"], forceExclude: [] },
    });
    expect(has(".claude/skills/compaction-handoff/SKILL.md")).toBe(true); // 대조군
    expect(has(".agents/skills/compaction-handoff/SKILL.md")).toBe(true);

    uninstall({ track: "csr-fastapi" });

    expect(has(".claude/skills/compaction-handoff/SKILL.md")).toBe(true);
    expect(has(".agents/skills/compaction-handoff/SKILL.md")).toBe(true);
    expect(has(".claude/skills/ui-visual-review")).toBe(false);
  });

  it("T4 · 설치자가 뺀 것(`excluded`)은 그대로 · A8 다시 더하면 트랙이 돌아오고 기록 · 메타파일이 누적된다", () => {
    install(["tooling"], ["claude"]);
    install(["csr-fastapi"], ["claude"], { baselineExclude: ["baseline:skills/ui-visual-review"] });
    const excluded = JSON.stringify(log().excluded);
    expect(has(".claude/skills/ui-visual-review")).toBe(false); // 대조군

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(0);
    expect(JSON.stringify(log().excluded)).toBe(excluded);
    // A8 — 다시 더하면 돌아온다. (install 은 이번 선택이 기록의 선택을 대체한다 — selection-record §3 — 그래서 빼기를 이어 가려면
    // 같은 빼기를 다시 준다. 검증 보고 T4 의 "재설치해도 안 돌아온다" 는 install 계약이고 트랙 제거가 바꾸는 것이 아니다.)
    install(["csr-fastapi"], ["claude"], { baselineExclude: ["baseline:skills/ui-visual-review"] });
    expect(has(".claude/rules/ui-components.md")).toBe(true);
    expect(has(".claude/skills/ui-visual-review")).toBe(false);
    expect(log().spec.tracks).toEqual(["csr-fastapi", "tooling"]);
    expect(read(".claude/.installed-tracks")).toBe("csr-fastapi\ntooling\n");
  });

  it("T5 · Antigravity 단독 — 메타파일 없이 `.agents/rules/<T>` 만 빠지고 기록 트랙이 갱신된다", () => {
    install(["tooling", "csr-fastapi"], ["antigravity"]);
    expect(has(".agents/rules/ui-components.md")).toBe(true);
    expect(has(".claude/.installed-tracks")).toBe(false);

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(0);
    expect(has(".agents/rules/ui-components.md")).toBe(false);
    expect(has(".agents/rules/cli-development.md")).toBe(true);
    expect(has(".claude/.installed-tracks")).toBe(false);
    expect(log().spec.tracks).toEqual(["tooling"]);
  });

  it("T7 · 하나씩 두 번 = 처음부터 두 트랙 없이 깐 설치", () => {
    install(["tooling", "csr-fastapi", "data"], ["claude"]);
    uninstall({ track: "csr-fastapi" });
    uninstall({ track: "data" });
    // `.mcp.json` 기본 행(D1)과 CI 스캐폴드(`.github/` — 설치 때 한 번 쓰는 설치자 파일, 전량 uninstall 도 남긴다)는 남는다
    const comparable = (p: string): boolean => p !== ".mcp.json" && !p.startsWith(".github/");
    const sequential = files().filter(comparable);
    const tracks = log().spec.tracks;

    rmSync(projectDir, { recursive: true, force: true });
    mkdirSync(projectDir);
    install(["tooling"], ["claude"]);

    const fresh = files().filter(comparable);
    expect(sequential.filter((p) => !fresh.includes(p))).toEqual([]);
    expect(sequential).toEqual(fresh);
    expect(tracks).toEqual(log().spec.tracks);
  });

  it("T8 · 어휘 밖 문자열은 남는 트랙으로 치지 않는다 — 마지막 아는 트랙은 거절 · 모르는 문자열은 지우지 않는다", () => {
    install(["csr-fastapi"], ["claude"]);
    const l = log();
    writeInstallLog(projectDir, { ...l, spec: { ...l.spec, tracks: ["csr-fastapi", "legacy-x"] } });

    const out = uninstall({ track: "csr-fastapi" });

    expect(out.code).toBe(1);
    expect(out.errText).toContain("마지막 트랙");
    expect(has(".claude/rules/ui-components.md")).toBe(true);

    install(["tooling"], ["claude"]);
    const l2 = log();
    writeInstallLog(projectDir, {
      ...l2,
      spec: { ...l2.spec, tracks: [...l2.spec.tracks, "legacy-x"] },
    });
    expect(uninstall({ track: "csr-fastapi" }).code).toBe(0);
    expect([...log().spec.tracks].sort()).toEqual(["legacy-x", "tooling"]);
  });

  it("T9 · 제거 뒤 `list` 는 남는 트랙만 말한다", () => {
    install(["tooling", "csr-fastapi"], ["claude"]);
    uninstall({ track: "csr-fastapi" });

    const lines: string[] = [];
    listAction({ projectDir }, { log: (l) => lines.push(l), exit: () => undefined as never });

    expect(lines.join("\n")).toMatch(/tracks: {4}tooling/);
  });
});

describe("#543 위저드 Remove one track", () => {
  it("9 · 기록 트랙이 둘 이상일 때만 고를 수 있다 · 트랙 화면에서 취소하면 아무 일도 없다", async () => {
    expect(
      buildUninstallModeChoices(["claude"], 0, ["tooling", "csr-fastapi"]).find(
        (c) => c.value === "track",
      )?.enabled,
    ).toBe(true);
    expect(
      buildUninstallModeChoices(["claude"], 0, ["tooling"]).find((c) => c.value === "track")
        ?.enabled,
    ).toBe(false);

    install(["tooling", "csr-fastapi"], ["claude"]);
    const cancelled = await runInteractiveUninstall(projectDir, {
      isTty: () => true,
      prompts: {
        intro: vi.fn(),
        outro: vi.fn(),
        cancel: vi.fn(),
        selectMode: vi.fn(async () => "track" as const),
        selectCli: vi.fn(async () => null),
        selectTrack: vi.fn(async () => null),
        selectAssets: vi.fn(async () => []),
        confirm: vi.fn(async () => true),
      },
    });
    expect(cancelled).toEqual({ ok: false, reason: "cancelled" });
    expect(log().spec.tracks).toEqual(["csr-fastapi", "tooling"]);
  });

  it("dry-run 미리보기와 확인 화면이 같은 이름 목록 · 같은 남김 줄을 낸다 · 고르면 `{ track }` 으로 넘어간다", async () => {
    install(["tooling", "csr-fastapi"], ["claude"]);
    const confirm = vi.fn(async (_summary: string) => true);
    const prompts: UninstallPrompts = {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      selectMode: vi.fn(async () => "track" as const),
      selectCli: vi.fn(async () => null),
      selectTrack: vi.fn(async () => "csr-fastapi" as const),
      selectAssets: vi.fn(async () => []),
      confirm,
    };

    const picked = await runInteractiveUninstall(projectDir, { prompts, isTty: () => true });

    expect(picked).toEqual({ ok: true, options: { projectDir, track: "csr-fastapi" } });
    const summary = String(confirm.mock.calls[0]?.[0] ?? "");
    const dry = uninstall({ track: "csr-fastapi", dryRun: true });
    const names = "removes: rules ui-components · skills ui-visual-review";
    expect(summary).toContain(names);
    expect(dry.text).toContain(names);
    const mcp = /MCP servers .+$/m.exec(dry.text)?.[0] ?? "(none)";
    expect(summary).toContain(mcp);
    expect(summary).toContain("agent-harness uninstall --track csr-fastapi --dry-run");
  });
});

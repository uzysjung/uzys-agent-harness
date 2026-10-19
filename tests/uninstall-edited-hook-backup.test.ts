/**
 * #800 — 기록에 하네스 몫으로 적힌 훅 줄을 설치자가 고쳤으면, uninstall(전량 · `--cli`)이 그 줄을 걷기 전에 `.claude/settings.json`
 * 을 1회 백업한다. 줄은 여전히 걷는다(스크립트가 함께 사라지니 남기면 죽은 참조다, N-f) — 설치자가 덧붙인 명령은 백업에 바이트
 * 그대로 남고, 화면이 그 백업을 댄다. 고치지 않은 줄만 있으면 백업하지 않는다.
 *
 * 장면 둘: ⓐ 현행 판으로 깔고 하네스 훅 줄을 고쳤다 ⓑ 옛 판으로 깔고 고친 뒤 v26.162~169 로 update 해 고친 줄이 하네스 몫으로
 * 기록됐다(그 판의 `legacySettingsSeed` 는 렌더 값의 sha 를 적었다 — 기록을 손으로 같은 모양으로 만든다).
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { jsonSha } from "../src/adapters/json-keys.js";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const SETTINGS = ".claude/settings.json";
const ORIG = (script: string): string => `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/${script}"`;
const MINE = " && bash ./scripts/team-guard.sh";
const GUARD = `${ORIG("protect-files.sh")}${MINE}`;

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-edited-hook-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);

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

type Settings = { hooks?: Record<string, Array<{ hooks: Array<{ command: string }> }>> };

const commandsIn = (text: string): string[] =>
  Object.values((JSON.parse(text) as Settings).hooks ?? {})
    .flat()
    .flatMap((g) => g.hooks.map((h) => h.command));

/** 라이브 `settings.json` 의 훅 명령(파일이 없으면 빈 목록). */
const liveCommands = (): string[] =>
  existsSync(abs(SETTINGS)) ? commandsIn(readFileSync(abs(SETTINGS), "utf8")) : [];

/** `settings.json` 옆의 백업 내용들. */
function backups(): string[] {
  const dir = dirname(abs(SETTINGS));
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((n) => n.startsWith("settings.json.backup-"))
    .map((n) => readFileSync(join(dir, n), "utf8"));
}

/** 하네스 훅 줄 `protect-files.sh` 끝에 설치자 명령을 덧붙인다(그 밖은 그대로). */
function editProtectFiles(): void {
  const text = readFileSync(abs(SETTINGS), "utf8");
  expect(text).toContain(JSON.stringify(ORIG("protect-files.sh"))); // 전제 — 하네스가 쓴 줄
  writeFileSync(
    abs(SETTINGS),
    text.replace(JSON.stringify(ORIG("protect-files.sh")), JSON.stringify(GUARD)),
  );
}

/** 라이브에 이 프로젝트의 `.claude/hooks/` 하네스 스크립트를 부르는 줄이 하나도 없다. */
function expectNoHarnessHook(): void {
  for (const c of liveCommands()) expect(c).not.toContain(".claude/hooks/");
}

/** 성공 판정 — 백업 1개에 설치자 명령이 바이트 그대로 · 라이브엔 죽은 하네스 참조 없음 · 화면이 백업을 댄다. */
function expectBackedUp(out: ReturnType<typeof uninstall>): void {
  expect(out.code).toBe(0);
  const saved = backups();
  expect(saved).toHaveLength(1);
  expect(commandsIn(saved[0] ?? "{}")).toContain(GUARD);
  expectNoHarnessHook();
  expect(out.text).toMatch(
    /\.claude\/settings\.json — you had edited 1 harness hook line \(hooks\.PreToolUse#protect-files\.sh\) — your edit is in the copy: \.claude\/settings\.json\.backup-\d{8}T\d{6}/,
  );
  expect(out.text).not.toMatch(/settings\.json — removed.*\(yours stays\)/);
  expect(out.text).not.toMatch(/settings\.json — removed.*only its part was in it/);
}

describe("#800 기록된 하네스 훅 줄을 설치자가 고쳤으면 걷기 전에 settings.json 을 백업한다", () => {
  it("ⓐ 현행 판 설치 → 줄 고침 → uninstall: 고친 줄은 백업에 · 라이브엔 하네스 훅 없음 · 화면이 백업을 댄다", () => {
    install(["claude"]);
    editProtectFiles();

    const preview = uninstall({ yes: true, dryRun: true });
    expect(preview.text).toContain(
      "you had edited 1 harness hook line (hooks.PreToolUse#protect-files.sh) — a copy is saved first as .claude/settings.json.backup-<time>",
    );
    expect(backups()).toHaveLength(0);

    expectBackedUp(uninstall({ yes: true }));
  });

  it("ⓐ′ --cli claude 도 같다", () => {
    install(["claude", "codex"]);
    editProtectFiles();

    expectBackedUp(uninstall({ yes: true, cli: "claude" }));
  });

  it("ⓑ 옛 판 → v26.162~169 update 가 고친 줄을 하네스 몫으로 기록한 설치본 → uninstall: 같다 · 설치자 훅은 남는다", () => {
    install(["claude"]);
    // 옛 템플릿 모양 — 고친 protect-files 줄 · 그대로인 session-start 줄 · 설치자 자기 훅
    const handler = (command: string) => ({ type: "command", command });
    writeFileSync(
      abs(SETTINGS),
      `${JSON.stringify(
        {
          hooks: {
            SessionStart: [{ hooks: [handler(ORIG("session-start.sh"))] }],
            PreToolUse: [
              { matcher: "Write|Edit", hooks: [handler(GUARD)] },
              { matcher: "Bash", hooks: [handler("bash ./scripts/mine.sh")] },
            ],
          },
        },
        null,
        2,
      )}\n`,
    );
    // 그 판의 `legacySettingsSeed` 가 적은 모양 — 핸들러 키는 렌더 값의 sha · 묶음 키는 "legacy"
    const log = readInstallLog(projectDir);
    if (!log) throw new Error("install log missing");
    const seeded = (script: string, event: string) => [
      {
        path: SETTINGS,
        adapter: "json-keys" as const,
        key: `hooks.${event}#${script}`,
        sha256: jsonSha(handler(ORIG(script))),
      },
      {
        path: SETTINGS,
        adapter: "json-keys" as const,
        key: `hooks.${event}#${script}{}`,
        sha256: "legacy",
      },
    ];
    log.portions = [
      ...(log.portions ?? []).filter((p) => p.path !== SETTINGS),
      ...seeded("session-start.sh", "SessionStart"),
      ...seeded("protect-files.sh", "PreToolUse"),
    ];
    writeInstallLog(projectDir, log);

    const out = uninstall({ yes: true });

    expectBackedUp(out);
    expect(liveCommands()).toEqual(["bash ./scripts/mine.sh"]);
  });

  it("음성 대조 — 고치지 않은 기록된 훅 줄만 있으면 백업하지 않는다 · 설치자 훅은 남는다", () => {
    install(["claude"]);
    const s = JSON.parse(readFileSync(abs(SETTINGS), "utf8")) as Settings;
    s.hooks?.PreToolUse?.push({ hooks: [{ command: "bash ./scripts/mine.sh" }] });
    writeFileSync(abs(SETTINGS), `${JSON.stringify(s, null, 2)}\n`);

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(backups()).toHaveLength(0);
    expect(liveCommands()).toEqual(["bash ./scripts/mine.sh"]);
    expect(out.text).not.toContain("you had edited");
    expect(out.text).toMatch(/settings\.json — removed the harness part.*\(yours stays\)/);
  });
});

describe("#840 설치자가 같은 훅 스크립트를 자기 묶음으로 또 등록했으면 걷기 전에 settings.json 을 백업한다", () => {
  it("설치자 묶음이 앞에 있어도 · 하네스 줄이 그대로여도 — 설치자 줄은 백업에 · 라이브엔 하네스 훅 없음 · 'yours stays' 라 하지 않는다", () => {
    install(["claude"]);
    const settings = JSON.parse(readFileSync(abs(SETTINGS), "utf8"));
    const mine = { type: "command", command: ORIG("session-start.sh"), timeout: 30 };
    settings.hooks.SessionStart.unshift({ matcher: "startup", hooks: [mine] });
    writeFileSync(abs(SETTINGS), `${JSON.stringify(settings, null, 2)}\n`);

    const out = uninstall({ yes: true });
    expect(out.code).toBe(0);
    const saved = backups();
    expect(saved).toHaveLength(1);
    expect(JSON.parse(saved[0] ?? "{}").hooks.SessionStart[0]).toEqual({
      matcher: "startup",
      hooks: [mine],
    });
    expectNoHarnessHook();
    expect(out.text).toContain("hooks.SessionStart#session-start.sh");
    expect(out.text).not.toMatch(/settings\.json — removed.*\(yours stays\)/);
  });
});

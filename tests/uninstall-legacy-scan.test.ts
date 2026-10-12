/**
 * PR-D 리뷰(`docs/plans/v26.169.0-reviews/pr-d-746-review-r1-loss.md`) BLOCKER-1 · N1 — 옛 판 기록 위의 uninstall · update.
 *
 * 설치자에게 달라지는 것:
 * - v26.126–v26.153 은 `.claude/skills/` 아래 **모든 파일**을 기록에 적었다. 번들 스킬 폴더에 둔 자기 노트가 그 기록 때문에
 *   하네스 파일로 읽혀 uninstall(전량 · `--cli claude`)과 update 에서 백업 없이 사라졌다 — 이제 라이브에 남거나 그 파일 하나의
 *   백업으로 남는다.
 * - 기록 필드가 아예 없는 옛 설치본(v26.125.0 이하)은 uninstall 뒤에도 하네스 룰 · 훅 · 에이전트 · 스킬이 라이브에 남아 다음
 *   세션에서 계속 돌았고, 화면은 그것을 "file(s) of yours" 라 불렀다 — 이제 하네스 자리는 회수되고(고친 것은 그 파일 하나 백업),
 *   남는 것은 "기록에 없다" 고만 말한다.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type UninstallOptions, uninstallAction } from "../src/commands/uninstall.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  legacyInstallLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { CliTargets } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** 번들 스킬 폴더 안의 설치자 노트 — 번들 템플릿(`templates/skills/audit-harness-fit/`)에 없는 이름. */
const NOTES = ".claude/skills/audit-harness-fit/my-team-notes.md";
const NOTES_BODY = "# team notes\nkeep me\n";

let projectDir = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "un-legacy-scan-"));
});
afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

const abs = (rel: string): string => join(projectDir, rel);
const read = (rel: string): string => readFileSync(abs(rel), "utf8");
const put = (rel: string, text: string): void => {
  mkdirSync(dirname(abs(rel)), { recursive: true });
  writeFileSync(abs(rel), text);
};

function install(cli: CliTargets, mode: "add" | "update" = "add") {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    mode,
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

/** 이 이름의 파일 내용이 라이브나 그 파일 하나의 백업(`<file>.backup-<time>`)에 남아 있는가. */
function survives(rel: string, body: string): boolean {
  if (existsSync(abs(rel)) && read(rel) === body) return true;
  const dir = dirname(abs(rel));
  if (!existsSync(dir)) return false;
  const base = rel.split("/").pop() ?? "";
  return readdirSync(dir)
    .filter((n) => n.startsWith(`${base}.backup-`))
    .some((n) => readFileSync(join(dir, n), "utf8") === body);
}

/**
 * v26.126–v26.153 의 기록 모양 — `records: "writer"` 가 없고, 옛 `collectSkillHashes` 가 번들 스킬 폴더 안 설치자 노트까지
 * 디스크 그대로의 sha 로 적었다(재설치 · update 로 다시 훑은 뒤).
 */
function toOldFullScan(): void {
  put(NOTES, NOTES_BODY);
  const l = currentLog();
  delete l.records;
  l.skillFiles = [
    ...(l.skillFiles ?? []),
    { path: "audit-harness-fit/my-team-notes.md", sha256: hashContent(NOTES_BODY) },
  ];
  writeInstallLog(projectDir, l);
}

describe("BLOCKER-1 — 옛 전체 스캔이 적은 번들 스킬 폴더 안 설치자 파일", () => {
  it("전량 uninstall — 노트는 라이브나 그 파일 하나의 백업으로 남는다", () => {
    install(["claude"]);
    toOldFullScan();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(survives(NOTES, NOTES_BODY)).toBe(true);
    // 하네스 판은 회수됐다 — 노트만 남긴 것이지 스킬을 남긴 것이 아니다
    expect(existsSync(abs(".claude/skills/audit-harness-fit/SKILL.md"))).toBe(false);
  });

  it("uninstall --cli claude — 같은 판정", () => {
    install(["claude", "codex"]);
    toOldFullScan();

    const out = uninstall({ cli: "claude", yes: true });

    expect(out.code).toBe(0);
    expect(survives(NOTES, NOTES_BODY)).toBe(true);
    expect(existsSync(abs(".claude/skills/audit-harness-fit/SKILL.md"))).toBe(false);
  });

  it("update — 번들 밖 파일로 치울 때 그 파일 하나를 백업한다", () => {
    install(["claude"]);
    toOldFullScan();

    install(["claude"], "update");

    expect(survives(NOTES, NOTES_BODY)).toBe(true);
  });
});

describe("N1 — 기록 필드가 없는 옛 설치본(v26.125.0 이하)의 uninstall", () => {
  /** v26.125.0 의 기록 모양 — 파일 필드(`policyFiles` · `skillFiles` · `externalFiles`)가 없고 `.claude/` 안에 있다. */
  function toFieldless(): void {
    const l = currentLog();
    delete l.records;
    delete l.policyFiles;
    delete l.skillFiles;
    delete l.externalFiles;
    delete l.portions;
    writeInstallLog(projectDir, l);
    renameSync(installLogPath(projectDir), legacyInstallLogPath(projectDir));
  }

  it("하네스 룰 · 훅 · 에이전트 · 스킬과 은퇴한 룰이 라이브에서 빠지고 · 고친 것은 백업 · 남은 것을 '당신 파일' 이라 부르지 않는다", () => {
    install(["claude"]);
    // 그 판이 깐 은퇴 파일(지금 manifest 에는 없고 은퇴 목록에 있다) · 목록 밖 옛 하네스 파일 · 설치자 자기 파일 · 설치자 편집
    put(".claude/rules/code-style.md", "# old harness rule\n");
    put(".claude/hooks/spec-drift-check.sh", "#!/bin/sh\n");
    put(".claude/commands/ecc/plan.md", "# old harness command\n");
    put(".claude/commands/mine/deploy.md", "# my command\n");
    const edited = `${read(".claude/rules/git-policy.md")}\n<!-- my edit -->\n`;
    put(".claude/rules/git-policy.md", edited);
    toFieldless();

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    const live = (dir: string): string[] =>
      existsSync(abs(dir))
        ? readdirSync(abs(dir), { recursive: true, withFileTypes: true })
            .filter((e) => e.isFile() && !/\.backup-/.test(e.name))
            .map((e) => e.name)
        : [];
    // 다음 세션이 읽고 돌릴 하네스 파일이 없다
    expect(live(".claude/rules")).toEqual([]);
    expect(live(".claude/hooks")).toEqual([]);
    expect(live(".claude/agents")).toEqual([]);
    expect(live(".claude/skills")).toEqual([]);
    // 고친 룰 · sha 가 없어 판정할 수 없는 은퇴 룰은 그 파일 하나의 백업으로 남는다
    expect(survives(".claude/rules/git-policy.md", edited)).toBe(true);
    expect(survives(".claude/rules/code-style.md", "# old harness rule\n")).toBe(true);
    // 설치자 파일은 제자리
    expect(read(".claude/commands/mine/deploy.md")).toBe("# my command\n");
    // 기록이 다 적지 못한 옛 판 — 남은 것을 설치자 것이라 단정하지 않는다. 지운 기록 파일은 남은 목록에 없다
    expect(out.text).not.toContain("of yours");
    expect(out.text).toMatch(
      /left {2}\.claude\/ — \d+ file\(s\) not on the install record — yours, or left by an older harness version; delete by hand any that are not yours: commands\/ecc\/plan\.md · commands\/mine\/deploy\.md/,
    );
    expect(out.text).not.toContain(".harness-install.json");
    expect(existsSync(legacyInstallLogPath(projectDir))).toBe(false);
  });
});

/**
 * PR-D 재리뷰(`pr-d-746-review-r2.md`) BLOCKER-1 · NOTE-B — 옛 판 위에서 **새 판을 한 번 돌린 뒤** uninstall.
 *
 * 설치자에게 달라지는 것: 필드 없는 옛 설치본(v26.125.0 이하) 위에서 새 판 install · update 를 한 번이라도 돌리면, 그 뒤 uninstall 이
 * 은퇴한 하네스 룰 · 훅 · 에이전트를 라이브에 남겨 다음 Claude Code 세션이 계속 로드했고, 화면은 남은 옛 하네스 파일을 "file(s) of
 * yours" 라 불렀다. 이제 은퇴 자리는 그 파일 하나를 백업하고 회수되고, 남는 것은 기록에 없다는 사실과 직접 지우라는 안내로 말한다.
 * 은퇴 하네스 훅 배선(`suggest-compact.sh`)도 settings.json 에서 걷혀 은퇴 스킬 폴더의 스크립트를 더는 부르지 않는다.
 */
describe("재리뷰 BLOCKER-1 — 필드 없는 옛 기록 → 새 판 install · update → uninstall", () => {
  const RETIRED_RULE = ".claude/rules/code-style.md";
  const RETIRED_HOOK = ".claude/hooks/spec-drift-check.sh";
  const RETIRED_AGENT = ".claude/agents/code-reviewer.md";
  const EDITED_BODY = "# old harness rule\n<!-- my edit -->\n";

  /** v26.125.0 설치본 — 그 판이 깐 은퇴 룰(설치자가 고침) · 훅 · 에이전트 · 목록 밖 옛 커맨드 · 설치자 파일, 필드 없는 기록. */
  function oldInstall(): void {
    install(["claude"]);
    put(RETIRED_RULE, EDITED_BODY);
    put(RETIRED_HOOK, "#!/bin/sh\n");
    put(RETIRED_AGENT, "# old harness agent\n");
    put(".claude/commands/ecc/plan.md", "# old harness command\n");
    put(".claude/commands/mine/deploy.md", "# my command\n");
    const l = currentLog();
    delete l.records;
    delete l.policyFiles;
    delete l.skillFiles;
    delete l.externalFiles;
    delete l.portions;
    writeInstallLog(projectDir, l);
    renameSync(installLogPath(projectDir), legacyInstallLogPath(projectDir));
  }

  function expectRetiredGone(out: { text: string; code: number | null }): void {
    expect(out.code).toBe(0);
    for (const p of [RETIRED_RULE, RETIRED_HOOK, RETIRED_AGENT])
      expect(existsSync(abs(p))).toBe(false);
    // sha 로 판정할 수 없는 은퇴 자리 — 고친 내용은 그 파일 하나의 백업에 남는다
    expect(survives(RETIRED_RULE, EDITED_BODY)).toBe(true);
    expect(read(".claude/commands/mine/deploy.md")).toBe("# my command\n");
    // 목록 밖 옛 하네스 파일(#781)은 남되 "당신 파일" 이라 부르지 않는다 — 기록에 없다는 사실과 직접 지우라는 안내
    expect(out.text).not.toContain("of yours");
    expect(out.text).toContain(
      "not on the install record — yours, or left by an older harness version; delete by hand any that are not yours: commands/ecc/plan.md · commands/mine/deploy.md",
    );
  }

  it("새 install(add) 을 거친 writer 기록 — 은퇴 룰 · 훅 · 에이전트가 라이브에 남지 않는다", () => {
    oldInstall();
    install(["claude"]);
    expect(currentLog().records).toBe("writer");

    expectRetiredGone(uninstall({ yes: true }));
  });

  it("새 update 를 거친 기록 — 같다", () => {
    oldInstall();
    install(["claude"], "update");

    expectRetiredGone(uninstall({ yes: true }));
  });

  it("이어받은 은퇴 자리를 다음 update 가 치울 때도 고친 내용은 그 파일 하나의 백업에 남는다", () => {
    oldInstall();
    install(["claude"]); // writer 기록이 은퇴 자리를 디스크 그대로의 sha 로 이어받는다
    install(["claude"], "update");

    expect(existsSync(abs(RETIRED_RULE))).toBe(false);
    expect(survives(RETIRED_RULE, EDITED_BODY)).toBe(true);
  });
});

describe("재리뷰 NOTE-B — uninstall 이 settings.json 의 은퇴 하네스 훅 배선을 걷는다", () => {
  const SCRIPT = ".claude/skills/strategic-compact/suggest-compact.sh";
  const RETIRED_CMD =
    'bash "$CLAUDE_PROJECT_DIR/.claude/skills/strategic-compact/suggest-compact.sh"';
  type Settings = {
    hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string }> }>>;
  };

  it("스크립트가 남아 있어도 닫힌 목록의 배선은 걷고 · 목록 밖 설치자 훅은 그대로 둔다", () => {
    install(["claude"]);
    put(SCRIPT, "#!/bin/bash\nexit 0\n"); // 은퇴 스킬 폴더 — 기록에 없어 uninstall 뒤에도 남는다
    const settings = JSON.parse(read(".claude/settings.json")) as Settings;
    settings.hooks.PreToolUse = [
      ...(settings.hooks.PreToolUse ?? []),
      { matcher: "*", hooks: [{ command: RETIRED_CMD }] },
      { matcher: "Bash", hooks: [{ command: "echo mine" }] },
    ];
    put(".claude/settings.json", JSON.stringify(settings, null, 2));

    const preview = uninstall({ yes: true, dryRun: true });
    expect(preview.text).toContain(
      "○ remove retired harness hook wiring from .claude/settings.json: skills/strategic-compact/suggest-compact.sh",
    );
    expect(read(".claude/settings.json")).toContain("suggest-compact.sh"); // 미리보기는 쓰지 않는다

    const out = uninstall({ yes: true });

    expect(out.code).toBe(0);
    expect(existsSync(abs(SCRIPT))).toBe(true);
    const after = read(".claude/settings.json");
    expect(after).not.toContain("suggest-compact.sh");
    expect(after).toContain("echo mine");
    expect(out.text).toContain(
      ".claude/settings.json — removed retired harness hook wiring: skills/strategic-compact/suggest-compact.sh",
    );
  });
});

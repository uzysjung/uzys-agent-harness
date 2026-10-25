/**
 * #644 — `--with-codex-trust` 가 쓰는 전역 `~/.codex/config.toml` 의 위생.
 *
 * ① 파싱 불가인 전역 config 에는 한 바이트도 안 쓰고 이유를 말한다(성공 ✓ 아님) — install 은 계속 성공.
 * ② 정상 config 는 지금처럼 등록하고, 이미 등록됐으면 덧붙이지 않는다.
 * ③ uninstall(전량 · `--dry-run`)은 하네스가 더한 trust 항목을 "손수 지울 것" 에 올린다 — 전역 파일은 건드리지 않는다.
 *    이미 있던(설치자 몫) 항목 · 플래그 없는 설치는 올리지 않는다(기록이 정한다).
 *
 * 개발자의 실제 `~/.codex` 를 건드리지 않도록 HOME 을 임시 폴더로 바꾼다(`runCodexOptIn` 은 `homedir()` 를 쓴다).
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasTrustEntry } from "../src/codex/trust-entry.js";
import { renderCliArtifacts, renderFinalSummary } from "../src/commands/install-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

let projectDir: string;
let home: string;
let configPath: string;
let savedHome: string | undefined;
let savedCodexHome: string | undefined;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "trust-proj-"));
  home = mkdtempSync(join(tmpdir(), "trust-home-"));
  configPath = join(home, ".codex", "config.toml");
  savedHome = process.env.HOME;
  savedCodexHome = process.env.CODEX_HOME;
  process.env.HOME = home;
  process.env.CODEX_HOME = join(home, ".codex");
});
afterEach(() => {
  if (savedHome === undefined) Reflect.deleteProperty(process.env, "HOME");
  else process.env.HOME = savedHome;
  if (savedCodexHome === undefined) Reflect.deleteProperty(process.env, "CODEX_HOME");
  else process.env.CODEX_HOME = savedCodexHome;
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
});

function putConfig(content: string): void {
  mkdirSync(join(home, ".codex"), { recursive: true });
  writeFileSync(configPath, content);
}

function install(withCodexTrust: boolean): { spec: InstallSpec; report: InstallReport } {
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust },
    cli: ["codex"],
    projectDir,
  };
  const report = runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec,
    mode: "add",
    runExternal: null,
  });
  return { spec, report };
}

function screen(spec: InstallSpec, report: InstallReport): string {
  const lines: string[] = [];
  renderCliArtifacts((m) => lines.push(m), spec, report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

function finalSummary(spec: InstallSpec, report: InstallReport): string {
  const lines: string[] = [];
  renderFinalSummary((m) => lines.push(m), spec, report, false);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

function uninstall(extra: { dryRun?: boolean; only?: string } = {}): string {
  const lines: string[] = [];
  uninstallAction(
    { projectDir, ...extra },
    {
      exit: () => undefined as never,
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
      log: (l: string) => lines.push(l.replace(/\x1b\[[0-9;]*m/g, "")),
      err: (l: string) => lines.push(l),
      resolveHarnessRoot: () => HARNESS_ROOT,
    },
  );
  return lines.join("\n");
}

/** 하네스가 쓰는 trust 키 — Codex `project_trust_key` 와 같은 정규화 경로(macOS 임시 폴더는 `/private/var/…`). */
const trustKey = (): string => realpathSync.native(projectDir);

const BROKEN = 'model = "gpt-5"\n[projects.\n  = nope ===\n';

describe("파싱 불가인 전역 config — 쓰지 않고 이유를 말한다 (#644 ②)", () => {
  it("파일 바이트 불변 · 화면에 성공(✓) 대신 이유 한 줄 · install 은 성공 · 기록 없음", () => {
    putConfig(BROKEN);
    const before = readFileSync(configPath);

    const { spec, report } = install(true);

    expect(readFileSync(configPath).equals(before)).toBe(true);
    expect(report.codexOptIn?.trustEntry.status).toBe("unreadable");
    const row = screen(spec, report)
      .split("\n")
      .filter((l) => l.includes("config.toml trust entry"));
    expect(row).toHaveLength(1);
    expect(row[0]).not.toContain("✓");
    expect(row[0]).toContain("not valid TOML");
    expect(row[0]).toContain("left untouched");
    // 쓰지 않았으니 하네스 몫이 아니다 — uninstall 이 있지도 않은 항목을 안내하지 않는다
    expect(readInstallLog(projectDir)?.codexTrust).toBeUndefined();
    expect(uninstall({ dryRun: true })).not.toContain("Codex trust entry");
    // 실패한 플래그를 다음 단계로 다시 권하지 않는다
    const next = finalSummary(spec, report);
    expect(next).toContain("fix ~/.codex/config.toml");
    expect(next).not.toContain("(headless: agent-harness install … --with-codex-trust)");
  });
});

describe("#685 — 안전하게 못 넣거나 설치자가 untrusted 로 둔 폴더: 쓰지 않고 화면이 손으로 할 일을 말한다", () => {
  it("인라인 projects 표 — 바이트 불변 · ✓ 아님 · NEXT 가 넣을 항목을 키째 말한다 · 기록 없음", () => {
    putConfig('projects = { "/other" = { trust_level = "trusted" } }\n');
    const before = readFileSync(configPath);

    const { spec, report } = install(true);

    expect(readFileSync(configPath).equals(before)).toBe(true);
    expect(report.codexOptIn?.trustEntry.status).toBe("error");
    const row = screen(spec, report)
      .split("\n")
      .find((l) => l.includes("config.toml trust entry"));
    expect(row).not.toContain("✓");
    expect(row).toContain("left untouched");
    expect(finalSummary(spec, report)).toContain(
      `add [projects."${trustKey()}"] trust_level = "trusted" to ~/.codex/config.toml by hand`,
    );
    expect(readInstallLog(projectDir)?.codexTrust).toBeUndefined();
  });

  it("untrusted — 덮지 않는다 · ✓ 아님 · Codex 가 이 폴더 설정을 안 켜므로 NEXT 의 trust 안내가 그대로 나온다", () => {
    const content = `[projects."${projectDir}"]\ntrust_level = "untrusted"\n`;
    putConfig(content);

    const { spec, report } = install(true);

    expect(readFileSync(configPath, "utf8")).toBe(content);
    expect(report.codexOptIn?.trustEntry.status).toBe("left");
    const row = screen(spec, report)
      .split("\n")
      .find((l) => l.includes("config.toml trust entry"));
    expect(row).not.toContain("✓");
    expect(row).toContain('trust_level = "untrusted"');
    expect(finalSummary(spec, report)).toContain('"Trust and continue"');
    expect(readInstallLog(projectDir)?.codexTrust).toBeUndefined();
  });
});

describe("정상 config — 등록·멱등 (회귀 없음)", () => {
  it("설치자 항목을 보존한 채 한 번 등록하고 ✓ 로 말한다 · 다시 설치해도 중복 append 가 없다", () => {
    putConfig('[projects."/other"]\ntrust_level = "trusted"\n');

    const first = install(true);
    expect(first.report.codexOptIn?.trustEntry.status).toBe("registered");
    expect(screen(first.spec, first.report)).toContain("✓");
    const afterFirst = readFileSync(configPath, "utf8");
    expect(afterFirst).toContain('[projects."/other"]');
    expect(afterFirst.split(`[projects."${trustKey()}"]`)).toHaveLength(2);
    // Codex 는 정규화 경로 · 받은 경로 둘 다 조회한다 — 받은 경로로 물어도 이미 trusted 다(#685 A-T14)
    expect(hasTrustEntry(afterFirst, projectDir)).toBe(true);

    const second = install(true);
    expect(second.report.codexOptIn?.trustEntry.status).toBe("already-present");
    expect(readFileSync(configPath, "utf8")).toBe(afterFirst);
    // 두 번째 실행(already-present)이 첫 실행의 기록을 지우지 않는다
    // 기록은 쓴 키(정규화 경로) — uninstall 의 "손수 지울 것" 이 실제 파일에 있는 키를 찍는다
    expect(readInstallLog(projectDir)?.codexTrust).toEqual({ configPath, projectDir: trustKey() });
  });
});

describe("uninstall — trust 항목을 손수 지울 목록에 올린다 (#644 ①)", () => {
  it("전량 uninstall 과 --dry-run 이 경로와 함께 나열하고 전역 파일은 건드리지 않는다", () => {
    install(true);
    const registered = readFileSync(configPath);

    const dry = uninstall({ dryRun: true });
    expect(dry).toContain("Codex trust entry — remove by hand");
    expect(dry).toContain(configPath);
    expect(dry).toContain(`[projects."${trustKey()}"]`);
    expect(readFileSync(configPath).equals(registered)).toBe(true);

    const real = uninstall();
    expect(real).toContain("Codex trust entry — remove by hand");
    expect(real).toContain(configPath);
    expect(real).toContain(`[projects."${trustKey()}"]`);
    expect(readFileSync(configPath).equals(registered)).toBe(true);
  });

  it("--only 는 자산만 다룬다 — 전역 trust 안내를 내지 않는다", () => {
    install(true);
    const log = readInstallLog(projectDir);
    if (log === null) throw new Error("대조군: 설치 기록이 있어야 한다");
    // 외부 자산 설치는 이 테스트에서 돌리지 않는다 — --only 가 고를 자산 하나를 기록에 둔다.
    writeInstallLog(projectDir, {
      ...log,
      assets: [
        {
          id: "demo-npm",
          category: "tool",
          method: "npm",
          scope: "project",
          detail: { pkg: "demo" },
        },
      ],
    });
    expect(uninstall({ dryRun: true })).toContain("Codex trust entry");
    expect(uninstall({ dryRun: true, only: "demo-npm" })).not.toContain("Codex trust entry");
  });

  it("플래그 없이 깐 설치나 설치자가 손으로 trust 한 항목은 올리지 않는다 — 기록이 정한다", () => {
    putConfig(`[projects."${projectDir}"]\ntrust_level = "trusted"\n`);
    install(false);
    expect(uninstall({ dryRun: true })).not.toContain("Codex trust entry");

    const second = install(true); // 이미 있던 항목 → 하네스가 더한 게 아니다
    expect(second.report.codexOptIn?.trustEntry.status).toBe("already-present");
    expect(readInstallLog(projectDir)?.codexTrust).toBeUndefined();
    expect(uninstall({ dryRun: true })).not.toContain("Codex trust entry");
  });
});

describe("#882 — CODEX_HOME 을 둔 환경: 쓰기와 확인이 Codex 가 읽는 같은 파일을 본다", () => {
  let codexHome = "";
  beforeEach(() => {
    // HOME 아래 기본 자리(~/.codex)와 다른 곳 — 위 beforeEach 의 별칭 설정을 이 블록에서만 바꾼다(afterEach 가 되돌린다)
    codexHome = mkdtempSync(join(tmpdir(), "trust-codex-home-"));
    process.env.CODEX_HOME = codexHome;
  });
  afterEach(() => rmSync(codexHome, { recursive: true, force: true }));

  it("--with-codex-trust 는 $CODEX_HOME/config.toml 에 쓰고 화면이 그 파일을 가리킨다 · 플래그 없는 재설치는 trust 안내를 내지 않는다", () => {
    const first = install(true);

    const written = join(codexHome, "config.toml");
    expect(first.report.codexOptIn?.trustEntry.status).toBe("registered");
    expect(hasTrustEntry(readFileSync(written, "utf8"), projectDir)).toBe(true);
    expect(existsSync(configPath)).toBe(false); // ~/.codex 는 Codex 가 읽지 않는 자리다
    const row = screen(first.spec, first.report)
      .split("\n")
      .find((l) => l.includes("trust entry"));
    expect(row).toContain(`${written} trust entry`);
    expect(row).not.toContain("~/.codex/config.toml");
    expect(readInstallLog(projectDir)?.codexTrust?.configPath).toBe(written);

    const again = install(false);
    expect(finalSummary(again.spec, again.report)).not.toContain('"Trust and continue"');
  });
});

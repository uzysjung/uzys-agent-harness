import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "smol-toml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hasTrustEntry, registerTrustEntry, tomlBasicString } from "../../src/codex/trust-entry.js";

describe("hasTrustEntry", () => {
  it("detects an existing project block", () => {
    const cfg = `[other]\n[projects."/path/a"]\ntrust_level = "trusted"\n`;
    expect(hasTrustEntry(cfg, "/path/a")).toBe(true);
  });
  it("returns false when project missing", () => {
    expect(hasTrustEntry("", "/path/a")).toBe(false);
  });
});

describe("registerTrustEntry", () => {
  let dir: string;
  let configPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-trust-"));
    configPath = join(dir, "config.toml");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates the config file + appends a block when none exists", () => {
    const result = registerTrustEntry({ configPath, projectDir: "/proj" });
    expect(result.status).toBe("registered");
    const content = readFileSync(configPath, "utf8");
    expect(content).toContain('[projects."/proj"]');
    expect(content).toContain('trust_level = "trusted"');
  });

  it("is idempotent (already-present)", () => {
    registerTrustEntry({ configPath, projectDir: "/proj" });
    const second = registerTrustEntry({ configPath, projectDir: "/proj" });
    expect(second.status).toBe("already-present");
    const occurrences = readFileSync(configPath, "utf8").match(/\[projects\."\/proj"\]/g) ?? [];
    expect(occurrences).toHaveLength(1);
  });

  it("appends a separate block for a different project dir", () => {
    registerTrustEntry({ configPath, projectDir: "/a" });
    registerTrustEntry({ configPath, projectDir: "/b" });
    const content = readFileSync(configPath, "utf8");
    expect(content).toContain('[projects."/a"]');
    expect(content).toContain('[projects."/b"]');
  });
});

/**
 * #685 — 이 폴더 항목이 이미 다른 TOML 표기로 있거나 경로에 `"` · `\` 가 있으면 전역 config 를 깨고 ✓ 라고 말했다.
 * 판정은 파서로 · 키는 이스케이프 · 덧붙인 결과가 안 읽히면 한 바이트도 쓰지 않는다.
 */
describe("registerTrustEntry — 어떤 표기든 알아보고 전역 config 를 깨지 않는다 (#685)", () => {
  let dir: string;
  let configPath: string;
  // 없는 경로 — 정규화(realpath)가 실패해 받은 경로 그대로가 키다
  const PROJ = "/proj/x";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-trust-685-"));
    configPath = join(dir, "config.toml");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function registerOver(content: string, projectDir = PROJ) {
    writeFileSync(configPath, content);
    const result = registerTrustEntry({ configPath, projectDir });
    return { result, after: readFileSync(configPath, "utf8") };
  }

  it.each([
    ["리터럴 키 표", `[projects.'${PROJ}']\ntrust_level = "trusted"\n`],
    ["인라인 표", `projects = { "${PROJ}" = { trust_level = "trusted" } }\n`],
    ["점 키", `projects."${PROJ}".trust_level = "trusted"\n`],
  ])("이미 있는 항목(%s) — already-present · 바이트 불변", (_, content) => {
    const { result, after } = registerOver(content);
    expect(result.status).toBe("already-present");
    expect(after).toBe(content);
    expect(hasTrustEntry(content, PROJ)).toBe(true);
  });

  it("인라인 projects 표에 이 폴더가 없다 — 덧붙이면 안 읽히므로 error · 바이트 불변 · 파일은 여전히 읽힌다", () => {
    const content = 'projects = { "/other" = { trust_level = "trusted" } }\n';
    const { result, after } = registerOver(content);
    expect(result.status).toBe("error");
    expect(result.message).toContain("left untouched");
    expect(after).toBe(content);
    expect(() => parse(after)).not.toThrow();
  });

  it("설치자가 untrusted 로 둔 폴더 — 덮지 않고 left + 이유 · 바이트 불변 · trusted 로 치지 않는다", () => {
    const content = `[projects."${PROJ}"]\ntrust_level = "untrusted"\n`;
    const { result, after } = registerOver(content);
    expect(result.status).toBe("left");
    expect(result.message).toContain("untrusted");
    expect(after).toBe(content);
    expect(hasTrustEntry(content, PROJ)).toBe(false);
  });

  it('경로에 `"` 와 `\\` 가 있다 — 이스케이프해 쓰고 다시 읽으면 그 키가 trusted 다', () => {
    const projectDir = join(dir, 'we"ird\\name');
    mkdirSync(projectDir);
    const key = realpathSync.native(projectDir);
    const { result, after } = registerOver("", projectDir);
    expect(result).toEqual({ status: "registered", key });
    const parsed = parse(after) as { projects: Record<string, { trust_level: string }> };
    expect(parsed.projects[key]?.trust_level).toBe("trusted");
    expect(hasTrustEntry(after, projectDir)).toBe(true);
  });

  it("tomlBasicString — Windows 경로 · 따옴표 · 제어 문자가 파싱 뒤 원래 키로 돌아온다", () => {
    for (const raw of ['C:\\Users\\me "x"', "tab\there", "del\u007fx", "é/경로"]) {
      const parsed = parse(`[projects.${tomlBasicString(raw)}]\ntrust_level="trusted"`) as {
        projects: Record<string, unknown>;
      };
      expect(Object.keys(parsed.projects)).toEqual([raw]);
    }
  });
});

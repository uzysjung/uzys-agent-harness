import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderInstallHeader, renderUpdateSummary } from "../src/commands/install-render.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import { formatSummary } from "../src/interactive.js";
import { resolveRules } from "../src/manifest.js";
import { residentCostFor } from "../src/resident-entries.js";
import { DEFAULT_OPTIONS, type InstallSpec, type Track } from "../src/types.js";

/**
 * #615 — 설치 화면의 상주 비용 줄은 **이번에 실제로 깔린(그 CLI 가 읽는) 파일**을 센다.
 * 기대값을 손으로 적지 않는다: 실제로 `runInstall` 을 돌려 디스크를 세고, 화면 숫자와 맞댄다.
 * 외부 자산 설치(`runExternal`)는 no-op — 그쪽은 의도적으로 미계측이다.
 */
const ROOT = resolve(__dirname, "..");
const dirs: string[] = [];

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function install(
  track: Track,
  cli: InstallSpec["cli"],
  baselineExclude: ReadonlyArray<string> = [],
): { projectDir: string; spec: InstallSpec } {
  const projectDir = mkdtempSync(join(tmpdir(), "resident-honesty-"));
  dirs.push(projectDir);
  const spec: InstallSpec = {
    tracks: [track],
    options: DEFAULT_OPTIONS,
    cli,
    projectDir,
    ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
  };
  runInstall({
    harnessRoot: ROOT,
    projectDir,
    spec,
    mode: "add",
    runExternal: () => ({ attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] }),
  });
  return { projectDir, spec };
}

const subdirs = (p: string): string[] =>
  existsSync(p)
    ? readdirSync(p, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
    : [];

const headerLine = (spec: InstallSpec): string => {
  const lines: string[] = [];
  renderInstallHeader((m) => lines.push(m), spec);
  return /session-start context cost: [^\n]*/.exec(lines.join("\n"))?.[0] ?? "";
};

describe.each(["codex", "opencode", "antigravity"] as const)("사례 1 — %s 단독", (cli) => {
  it("CLAUDE.md 가 아니라 그 CLI 가 실제로 읽는 앵커 파일 1개를 말한다", () => {
    const { projectDir, spec } = install("tooling", [cli]);
    // 대조군: 디스크에 CLAUDE 계열이 정말 없다.
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(false);
    expect(existsSync(join(projectDir, "CLAUDE-uzys-harness.md"))).toBe(false);
    const anchor = cli === "antigravity" ? ".agents/rules/uzys-harness.md" : "AGENTS.md";
    expect(existsSync(join(projectDir, anchor))).toBe(true);

    const cost = residentCostFor(spec);
    expect(cost.contextFile).toBe(anchor);
    expect(cost.items.claudeMd).toBe(1);
    for (const line of [headerLine(spec), formatSummary(spec)]) {
      expect(line).toContain(`${anchor} 1 ~`);
      expect(line).not.toContain("CLAUDE.md");
    }
  });
});

describe("사례 1 — claude 는 그대로", () => {
  it("claude 포함이면 CLAUDE.md 2개(앵커 + 루트)를 센다", () => {
    const { spec } = install("tooling", ["claude", "codex"]);
    expect(headerLine(spec)).toContain("CLAUDE.md 2 ~");
  });
});

describe("사례 2 — 스킬 수 = 실제로 그 CLI 자리에 깔린 수", () => {
  it.each([
    ["csr-fastify", ["codex"]],
    ["csr-fastify", ["opencode"]],
    ["csr-fastify", ["antigravity"]],
    ["csr-fastify", ["claude"]],
    ["tooling", ["codex"]],
  ] as ReadonlyArray<readonly [Track, InstallSpec["cli"]]>)("%s + %j", (track, cli) => {
    const { projectDir, spec } = install(track, cli);
    const slot = cli.includes("claude") ? ".claude/skills" : ".agents/skills";
    const onDisk = subdirs(join(projectDir, slot));
    expect(onDisk.length, "대조군: 스킬이 하나도 안 깔렸으면 비교가 무의미하다").toBeGreaterThan(0);
    expect(residentCostFor(spec).items.skills).toBe(onDisk.length);
    expect(headerLine(spec)).toContain(`skills ${onDisk.length} ~`);
    expect(formatSummary(spec)).toContain(`skills ${onDisk.length} ~`);
  });
});

describe("사례 3 — --without 로 뺀 룰은 비용에서도 빠진다", () => {
  const allRules = (track: Track): string[] =>
    resolveRules({ tracks: [track] }).map((r) => `baseline:rules/${r}`);

  it("룰을 전부 뺀 설치: 디스크 0 = 헤더 0 = 위저드 0", () => {
    const { projectDir, spec } = install("tooling", ["claude"], allRules("tooling"));
    const rulesDir = join(projectDir, ".claude", "rules");
    expect(existsSync(rulesDir) ? readdirSync(rulesDir) : []).toEqual([]);
    const header = headerLine(spec);
    expect(header).toContain("rules 0 ~0");
    expect(formatSummary(spec)).toContain("rules 0 ~0");
  });

  it("일부만 뺐을 때: 헤더(비대화형)와 위저드가 같은 줄이고 디스크의 룰 수와 같다", () => {
    const [first, second, ...rest] = allRules("tooling");
    expect(rest.length, "대조군: 룰이 3개 이상이어야 일부 제외가 의미 있다").toBeGreaterThan(0);
    const { projectDir, spec } = install("tooling", ["claude"], [first ?? "", second ?? ""]);
    const onDisk = readdirSync(join(projectDir, ".claude", "rules")).length;
    expect(residentCostFor(spec).items.rules).toBe(onDisk);
    expect(headerLine(spec)).toContain(`rules ${onDisk} ~`);
    const wizard = /session-start context cost: [^\n]*/.exec(formatSummary(spec))?.[0];
    expect(headerLine(spec)).toContain(wizard ?? "<없음>");
  });

  it("룰은 CLI 와 무관하게 해제가 반영된다 (codex 단독)", () => {
    const [first, ...rest] = allRules("tooling");
    const full = residentCostFor({
      tracks: ["tooling"],
      options: DEFAULT_OPTIONS,
      cli: ["codex"],
      projectDir: "/tmp/x",
    }).items.rules;
    const cut = residentCostFor({
      tracks: ["tooling"],
      options: DEFAULT_OPTIONS,
      cli: ["codex"],
      projectDir: "/tmp/x",
      baselineExclude: [first ?? ""],
    }).items.rules;
    expect(rest.length).toBeGreaterThan(0);
    expect(cut).toBe(full - 1);
  });
});

describe("update 화면(CONTEXT 행)도 같은 판정이다", () => {
  const contextRow = (spec: InstallSpec): string => {
    const lines: string[] = [];
    renderUpdateSummary((m) => lines.push(m), spec, {} as InstallReport);
    return /session-start context cost: [^\n]*/.exec(lines.join("\n"))?.[0] ?? "";
  };

  it("codex 단독: AGENTS.md 1 · 스킬 수 = 디스크 · 설치자의 .claude/agents 는 세지 않는다", () => {
    const { projectDir, spec } = install("csr-fastify", ["codex"]);
    // 이 설치가 만든 적 없는 남의 에이전트 파일 — claude 를 안 골랐으니 이 설치의 상주가 아니다.
    mkdirSync(join(projectDir, ".claude", "agents"), { recursive: true });
    writeFileSync(
      join(projectDir, ".claude", "agents", "mine.md"),
      "---\nname: mine\ndescription: x\n---\n",
    );
    const row = contextRow(spec);
    expect(row).toContain("AGENTS.md 1 ~");
    expect(row).not.toContain("CLAUDE.md");
    expect(row).toContain(`skills ${subdirs(join(projectDir, ".agents", "skills")).length} ~`);
    expect(row).toContain("agents 0 ~0");
  });

  it("룰을 전부 뺀 설치: update 도 rules 0", () => {
    const names = resolveRules({ tracks: ["tooling"] }).map((r) => `baseline:rules/${r}`);
    const { spec } = install("tooling", ["claude"], names);
    expect(contextRow(spec)).toContain("rules 0 ~0");
  });
});

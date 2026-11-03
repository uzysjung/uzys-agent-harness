import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";
import { resolveRules } from "../src/manifest.js";
import {
  PATH_RULE_POINTER_LEAD,
  type PathRuleFolder,
  type PortedRule,
  pathRulePointerTargets,
  portRules,
} from "../src/rules-port.js";
import type { CliBase, Track, UpdateGroup } from "../src/types.js";

/**
 * #953 (ADR-118) — Claude Code + Codex(OpenCode 없음) 설치본의 Codex 경로 룰(`paths:`)은 이번 실행이 이번 룰 전부를 `.claude/rules/` 에
 * 썼을 때 그 파일을 가리키는 목록이다(`.agents/rules/` 가 조건을 만족하면 그쪽 우선 — ADR-117).
 *
 * 판정 기준(설계 `docs/plans/953-design.md` §0): **이 변경 뒤 어떤 실행도 Codex 가 경로 룰을 0번 받는 상태를 만들지 않는다.** 아래
 * `codexReach` 가 룰마다 센다 — `AGENTS.md` 인라인 본문 · 포인터가 가리키고 실재하며 본문을 담은 파일 중 하나 이상. 행 = 설계 §2 표.
 */

const ROOT = resolve(__dirname, "..");
const h2 = (r: PortedRule): string => r.body.replace(/^#\s+/, "## ");
const pathRulesOf = (tracks: ReadonlyArray<Track>): PortedRule[] =>
  portRules(ROOT, resolveRules({ tracks: [...tracks] })).filter((r) => r.paths.length > 0);

const isRoot = typeof process.getuid === "function" && process.getuid() === 0;

describe("§2 — 실행마다 Codex 가 경로 룰을 받는 수 (Claude Code + Codex)", () => {
  let projectDir: string;
  let outside: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "codex-953-"));
    outside = mkdtempSync(join(tmpdir(), "codex-953-out-"));
  });
  afterEach(() => {
    // 쓰기 불가 행이 남긴 권한을 풀어야 지운다
    if (existsSync(join(projectDir, "AGENTS.md"))) chmodSync(join(projectDir, "AGENTS.md"), 0o644);
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  const install = (cli: CliBase[], tracks: Track[] = ["full"]): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode: "add",
      spec: { tracks, options: { withCodexTrust: false }, cli, projectDir },
    });
  };
  const update = (only?: UpdateGroup[]): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode: "update",
      spec: {
        tracks: ["full"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
        ...(only === undefined ? {} : { updateOnly: only }),
      },
    });
  };
  const uninstall = (
    cli: string,
    opts: { dryRun?: boolean } = {},
  ): { code: number | null; out: string; err: string } => {
    let code: number | null = null;
    const out: string[] = [];
    const err: string[] = [];
    uninstallAction(
      { projectDir, cli, ...opts },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: (m: string) => out.push(m),
        err: (m: string) => err.push(m),
        resolveHarnessRoot: () => ROOT,
      },
    );
    return { code, out: out.join("\n"), err: err.join("\n") };
  };
  const read = (rel: string): string =>
    existsSync(join(projectDir, rel)) ? readFileSync(join(projectDir, rel), "utf8") : "";
  /** 지금 `AGENTS.md` 의 경로 룰 포인터가 가리키는 폴더(없으면 `null` — 인라인). */
  const pointerFolder = (): PathRuleFolder | "mixed" | null => {
    const agents = read("AGENTS.md");
    if (!agents.includes(PATH_RULE_POINTER_LEAD)) return null;
    const dirs = new Set(
      pathRulePointerTargets(agents).map((t) => t.slice(0, t.lastIndexOf("/")) as PathRuleFolder),
    );
    return dirs.size === 1 ? ([...dirs][0] ?? null) : "mixed";
  };
  const codexReach = (r: PortedRule): number => {
    const agents = read("AGENTS.md");
    const inline = agents.includes(h2(r));
    const viaFile = pathRulePointerTargets(agents).some(
      (t) => t.endsWith(`/${r.name}.md`) && read(t).includes(r.body),
    );
    return Number(inline) + Number(viaFile);
  };
  const everyPathRuleReachesCodex = (tracks: Track[], step: string): void => {
    const rules = pathRulesOf(tracks);
    expect(rules.length, "모집단 자기검증 — 경로 룰이 있다").toBeGreaterThan(0);
    for (const r of rules) expect(codexReach(r), `${step} — ${r.name}`).toBeGreaterThan(0);
  };
  const claudeRuleFiles = (): string[] =>
    existsSync(join(projectDir, ".claude/rules"))
      ? readdirSync(join(projectDir, ".claude/rules")).sort()
      : [];

  it("1행 — claude+codex 함께 install → `.claude/rules/` 포인터 · 경로 룰은 파일로만(한 번) · update 도 같은 바이트", () => {
    install(["claude", "codex"]);
    expect(pointerFolder()).toBe(".claude/rules");
    for (const r of pathRulesOf(["full"])) expect(codexReach(r), r.name).toBe(1);
    const agents = read("AGENTS.md");
    update();
    expect(read("AGENTS.md")).toBe(agents);
  });

  it("2행 — claude 설치본에 install --cli codex → 인라인(Claude Code 단계가 안 돌아 원장이 빈다) → update 에 포인터", () => {
    install(["claude"]);
    install(["codex"]);
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "install --cli codex");
    update();
    expect(pointerFolder()).toBe(".claude/rules");
    everyPathRuleReachesCodex(["full"], "update");
  });

  it("3행 — codex 설치본에 install --cli claude(같은 트랙) → `.claude/rules/` 포인터", () => {
    install(["codex"]);
    expect(pointerFolder(), "대조군: Codex 단독은 인라인").toBeNull();
    install(["claude"]);
    expect(pointerFolder()).toBe(".claude/rules");
    everyPathRuleReachesCodex(["full"], "install --cli claude");
  });

  it("4행 — claude+codex[tooling] 에 install --cli claude --track csr-supabase → 인라인(누적 룰 중 이번에 안 쓴 것이 있다) → update 에 포인터", () => {
    install(["claude", "codex"], ["tooling"]);
    expect(pointerFolder(), "대조군: 같은 트랙이면 포인터").toBe(".claude/rules");
    install(["claude"], ["csr-supabase"]);
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["tooling", "csr-supabase"], "install --track csr-supabase");
    update();
    expect(pointerFolder()).toBe(".claude/rules");
    everyPathRuleReachesCodex(["tooling", "csr-supabase"], "update");
  });

  it("5행 — claude+codex 에 install --cli antigravity → Antigravity 가 이번에 다 썼으면 `.agents/rules/` 포인터(우선)", () => {
    install(["claude", "codex"]);
    install(["antigravity"]);
    expect(pointerFolder()).toBe(".agents/rules");
    everyPathRuleReachesCodex(["full"], "install --cli antigravity");
  });

  it("6행 — uninstall --cli claude(codex 남음) → 인라인 · `.claude/rules/` 를 가리키는 줄 0 · update 도 인라인", () => {
    install(["claude", "codex"]);
    expect(pointerFolder()).toBe(".claude/rules");
    expect(uninstall("claude").code).toBe(0);
    expect(claudeRuleFiles(), "픽스처 자기검증 — Claude Code 룰 파일이 지워졌다").toEqual([]);
    expect(read("AGENTS.md")).not.toContain("→ `.claude/rules/");
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "uninstall --cli claude");
    update();
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "update");
  });

  it("6행 dry-run — 지우지 않고 'would re-render AGENTS.md' 를 말한다", () => {
    install(["claude", "codex"]);
    const before = read("AGENTS.md");
    const r = uninstall("claude", { dryRun: true });
    expect(r.code).toBe(0);
    expect(r.out).toContain("would re-render AGENTS.md for Codex");
    expect(read("AGENTS.md")).toBe(before);
    expect(claudeRuleFiles().length).toBeGreaterThan(0);
  });

  it("7행 — uninstall --cli claude(claude+codex+ag · `.agents/rules/` 포인터) → 인라인(재렌더) → update 가 `.agents/rules/` 포인터", () => {
    install(["claude", "codex", "antigravity"]);
    expect(pointerFolder()).toBe(".agents/rules");
    expect(uninstall("claude").code).toBe(0);
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "uninstall --cli claude");
    update();
    expect(pointerFolder()).toBe(".agents/rules");
    everyPathRuleReachesCodex(["full"], "update");
  });

  // root 는 권한 비트를 무시한다 — 다른 chmod 테스트와 같이 건너뛴다(tests/uninstall-recorded-removal.test.ts)
  it.skipIf(isRoot)(
    "8행 — `AGENTS.md` 를 쓸 수 없으면 uninstall --cli claude 는 아무것도 지우지 않고 exit 1(#676 과 같은 문구) · 포인터 대상 그대로",
    () => {
      install(["claude", "codex"]);
      const files = claudeRuleFiles();
      const agentsPath = join(projectDir, "AGENTS.md");
      chmodSync(agentsPath, 0o444);
      expect(
        () => accessSync(agentsPath, constants.W_OK),
        "픽스처 자기검증 — 이 실행 계정에서 쓰기 불가",
      ).toThrow();
      const r = uninstall("claude");
      expect(r.code).toBe(1);
      expect(r.err).toContain("ERROR: uninstall cannot write here — nothing was removed:");
      expect(r.err).toContain("· AGENTS.md");
      expect(r.err).toContain("Fix the permissions, then run the same command again.");
      expect(claudeRuleFiles()).toEqual(files);
      expect(pointerFolder()).toBe(".claude/rules");
      everyPathRuleReachesCodex(["full"], "막힌 uninstall");
    },
  );

  it("9행 — update --only external(claude+codex 포인터) → 인라인(이번에 `.claude/rules/` 를 안 썼다) → 전체 update 가 포인터", () => {
    install(["claude", "codex"]);
    update(["external"]);
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "update --only external");
    update();
    expect(pointerFolder()).toBe(".claude/rules");
  });

  it("10행 — claude+codex 에 install --cli opencode → 인라인(OpenCode 가 섞이면 현행)", () => {
    install(["claude", "codex"]);
    install(["opencode"]);
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "install --cli opencode");
    update();
    expect(pointerFolder()).toBeNull();
  });

  it("11행 — Claude Code 룰 파일 하나가 프로젝트 밖 링크라 건너뛰면 인라인 — 그 룰을 Codex 가 잃지 않는다", () => {
    mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
    writeFileSync(join(outside, "ui-components.md"), "# elsewhere\n");
    symlinkSync(
      join(outside, "ui-components.md"),
      join(projectDir, ".claude/rules/ui-components.md"),
    );
    install(["claude", "codex"]);
    expect(readFileSync(join(outside, "ui-components.md"), "utf8")).toBe("# elsewhere\n");
    expect(pointerFolder()).toBeNull();
    everyPathRuleReachesCodex(["full"], "install");
  });
});

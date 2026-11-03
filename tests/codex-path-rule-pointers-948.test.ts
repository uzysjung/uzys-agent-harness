import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AGENTS_BLOCK, RULES_BLOCK } from "../src/agents-md-merge.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { runInstall } from "../src/installer.js";
import { resolveRules } from "../src/manifest.js";
import {
  PATH_RULE_POINTER_LEAD,
  type PortedRule,
  pathRulePointerTargets,
  portRules,
  renderRulesBlock,
} from "../src/rules-port.js";
import type { CliBase, Track } from "../src/types.js";

/**
 * #948 (ADR-117) — Codex + Antigravity(OpenCode 없음) 조합의 경로 룰(`paths:`)은 `AGENTS.md` 에 본문 대신 Antigravity 가 이번 실행에 쓴
 * `.agents/rules/<룰>.md` 를 가리키는 목록이다(실 Codex 15/15 — `docs/research/codex-rule-pointer-2026-11.md`).
 *
 * 판정 기준(설계 `docs/plans/948-design.md` §0): **어떤 실행 뒤에도 Codex 가 경로 룰을 0번 받는 상태는 없다.** 아래 `codexReach` 가
 * 룰마다 그 수를 센다 — 인라인 본문 · 포인터가 가리키는 실재 파일(본문을 담은) 중 하나 이상.
 */

const ROOT = resolve(__dirname, "..");

const h2 = (r: PortedRule): string => r.body.replace(/^#\s+/, "## ");

describe("D2 — 렌더: 상시 룰은 그대로, 경로 룰만 측정한 형식의 목록으로", () => {
  const rule = (name: string, paths: string[]): PortedRule => ({
    name,
    body: `# ${name} title\n\n${name.toUpperCase()}-BODY`,
    paths,
  });
  const always = rule("git-policy", []);
  const ui = rule("ui-components", ["**/*.tsx", "**/*.jsx"]);
  const cli = rule("cli-development", ["**/*.sh"]);

  it("목록 = 측정한 머리 문장 + 룰마다 `paths:` 를 ` · ` 로 이은 줄 → `.agents/rules/<룰>.md` · 줄 순서 = 경로 룰의 렌더 순서", () => {
    const out = renderRulesBlock([ui, always, cli], ".agents/rules");
    expect(out).toBe(
      [
        "## git-policy title\n\nGIT-POLICY-BODY",
        [
          "> 아래 파일을 만들거나 고치기 전에 그 룰을 읽고 따른다 — 본문은 여기 없다.",
          "> - `**/*.tsx` · `**/*.jsx` → `.agents/rules/ui-components.md`",
          "> - `**/*.sh` → `.agents/rules/cli-development.md`",
        ].join("\n"),
      ].join("\n\n---\n\n"),
    );
    expect(out).not.toContain("UI-COMPONENTS-BODY");
    expect(pathRulePointerTargets(out)).toEqual([
      ".agents/rules/ui-components.md",
      ".agents/rules/cli-development.md",
    ]);
  });

  it("거짓이면 v26.181.0 과 같다 — 상시 룰 → 경로 룰 본문", () => {
    expect(renderRulesBlock([ui, always, cli], false)).toBe(
      [always, ui, cli].map(h2).join("\n\n---\n\n"),
    );
  });

  it("경로 룰이 없는 집합은 참이어도 같은 바이트 — 실제 트랙(base)도", () => {
    expect(renderRulesBlock([always], ".agents/rules")).toBe(renderRulesBlock([always], false));
    const base = portRules(ROOT, resolveRules({ tracks: ["base"] }));
    expect(
      base.every((r) => r.paths.length === 0),
      "모집단 자기검증 — base 는 경로 룰이 없다",
    ).toBe(true);
    expect(renderRulesBlock(base, ".agents/rules")).toBe(renderRulesBlock(base, false));
  });
});

describe("D1 · §3 — 실행마다 Codex 가 경로 룰을 받는 수", () => {
  const TRACKS: Track[] = ["full"];
  const PATH_RULES = portRules(ROOT, resolveRules({ tracks: TRACKS })).filter(
    (r) => r.paths.length > 0,
  );
  let projectDir: string;
  let outside: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "codex-948-"));
    outside = mkdtempSync(join(tmpdir(), "codex-948-out-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  const install = (cli: CliBase[], mode: "add" | "reinstall" = "add"): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode,
      spec: { tracks: TRACKS, options: { withCodexTrust: false }, cli, projectDir },
    });
  };
  const update = (): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode: "update",
      spec: { tracks: TRACKS, options: { withCodexTrust: false }, cli: ["claude"], projectDir },
    });
  };
  const uninstall = (cli: string): void => {
    let code: number | null = null;
    uninstallAction(
      { projectDir, cli },
      {
        exit: (c: number) => {
          code ??= c;
          return undefined as never;
        },
        log: () => {},
        err: () => {},
        resolveHarnessRoot: () => ROOT,
      },
    );
    expect(code).toBe(0);
  };
  const read = (rel: string): string =>
    existsSync(join(projectDir, rel)) ? readFileSync(join(projectDir, rel), "utf8") : "";

  /** `AGENTS.md` 의 `rules` 블록이 경로 룰 포인터 판인가. */
  const pointer = (): boolean => read("AGENTS.md").includes(PATH_RULE_POINTER_LEAD);
  /**
   * Codex 가 이 경로 룰을 받는 곳의 수 — `AGENTS.md` 인라인 본문 · `AGENTS.md` 가 가리키고 실재하며 본문을 담은 `.agents/rules/<룰>.md`.
   * 가리키기만 하고 파일이 없거나 남의 내용이면 세지 않는다 — 그건 도달이 아니다.
   */
  const codexReach = (r: PortedRule): number => {
    const agents = read("AGENTS.md");
    const inline = agents.includes(h2(r));
    const file =
      pathRulePointerTargets(agents).includes(`.agents/rules/${r.name}.md`) &&
      read(`.agents/rules/${r.name}.md`).includes(r.body);
    return Number(inline) + Number(file);
  };
  const everyPathRuleReachesCodex = (step: string): void => {
    for (const r of PATH_RULES) expect(codexReach(r), `${step} — ${r.name}`).toBeGreaterThan(0);
  };

  it("모집단 자기검증 — 이 트랙은 경로 룰이 둘 이상이다", () => {
    expect(PATH_RULES.map((r) => r.name).sort()).toEqual(["cli-development", "ui-components"]);
  });

  it.each([
    ["codex+antigravity", ["codex", "antigravity"]],
    ["claude+codex+antigravity", ["claude", "codex", "antigravity"]],
  ] as const)("§3 1행 — %s 를 함께 install → 포인터 · 경로 룰은 파일로만(한 번) · update 도 같은 바이트", (_, set) => {
    install([...set]);
    expect(pointer()).toBe(true);
    for (const r of PATH_RULES) expect(codexReach(r), r.name).toBe(1);
    // 상시 룰은 인라인 그대로 — 포인터는 `rules` 블록 안, 맨 끝
    const agents = read("AGENTS.md");
    expect(agents).toContain("## Git Safety");
    expect(agents.indexOf(PATH_RULE_POINTER_LEAD)).toBeGreaterThan(
      agents.indexOf(RULES_BLOCK.start),
    );
    expect(agents.trimEnd().endsWith(RULES_BLOCK.end)).toBe(true);
    update();
    expect(read("AGENTS.md")).toBe(agents);
  });

  it("§3 2행 — antigravity 설치본에 install --cli codex → 인라인(Antigravity 미실행) → update 에 포인터", () => {
    install(["antigravity"]);
    install(["codex"]);
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("install --cli codex");
    update();
    expect(pointer()).toBe(true);
    everyPathRuleReachesCodex("update");
  });

  it("§3 3행 — codex 설치본에 install --cli antigravity → 포인터(Antigravity 가 이번에 다 씀) · update 도 같다", () => {
    install(["codex"]);
    expect(pointer(), "대조군: Codex 단독은 인라인").toBe(false);
    install(["antigravity"]);
    expect(pointer()).toBe(true);
    everyPathRuleReachesCodex("install --cli antigravity");
    update();
    expect(pointer()).toBe(true);
    everyPathRuleReachesCodex("update");
  });

  it("§3 4행 — codex+antigravity 에 install --cli opencode → 인라인(OpenCode 의 포인터 따르기는 재지 않았다) · update 도 인라인", () => {
    install(["codex", "antigravity"]);
    install(["opencode"]);
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("install --cli opencode");
    update();
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("update");
  });

  it("§3 5행 — uninstall --cli antigravity(Codex 남음) → 인라인(재렌더는 `.agents/rules/` 를 안 쓴다) · update 도 인라인", () => {
    install(["codex", "antigravity"]);
    uninstall("antigravity");
    expect(existsSync(join(projectDir, ".agents/rules/cli-development.md"))).toBe(false);
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("uninstall --cli antigravity");
    update();
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("update");
  });

  it("§3 6행 — uninstall --cli codex → Codex 없음 · 포인터 목록도 없다(남는 Antigravity 는 `.agents/rules/` 를 직접)", () => {
    install(["codex", "antigravity"]);
    uninstall("codex");
    expect(pointer()).toBe(false);
    expect(read(".agents/rules/cli-development.md")).toContain(PATH_RULES[0]?.body ?? "<없음>");
  });

  it("§3 7행 — Antigravity 가 경로 룰 하나를 못 썼으면(프로젝트 밖 링크) 인라인 — 그 룰을 Codex 가 잃지 않는다", () => {
    mkdirSync(join(projectDir, ".agents/rules"), { recursive: true });
    writeFileSync(join(outside, "cli-development.md"), "# elsewhere\n");
    symlinkSync(
      join(outside, "cli-development.md"),
      join(projectDir, ".agents/rules/cli-development.md"),
    );
    install(["codex", "antigravity"]);
    expect(readFileSync(join(outside, "cli-development.md"), "utf8")).toBe("# elsewhere\n");
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("install");
  });

  it("설치자가 가리킨 파일을 지우면 update 가 되살리고 포인터를 유지한다(ADR-117 감수 항목)", () => {
    install(["codex", "antigravity"]);
    rmSync(join(projectDir, ".agents/rules/cli-development.md"));
    update();
    expect(pointer()).toBe(true);
    everyPathRuleReachesCodex("update");
  });

  it("D1 4번 — 첫 접촉 블록(설치자가 먼저 가진 `AGENTS.md`)은 늘 인라인 — 굳어도 Codex 가 경로 룰을 잃지 않는다", () => {
    writeFileSync(join(projectDir, "AGENTS.md"), "# Mine\n\nINSTALLER-OWN\n");
    install(["codex", "antigravity"]);
    expect(read("AGENTS.md"), "픽스처 자기검증 — 첫 접촉 블록").toContain(AGENTS_BLOCK.start);
    expect(pointer()).toBe(false);
    everyPathRuleReachesCodex("install");
  });
});

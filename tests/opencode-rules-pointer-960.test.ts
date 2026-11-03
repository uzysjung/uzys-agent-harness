import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { withMarkedContinuousSkillsNote } from "../src/agents-md-merge.js";
import {
  AGENTS_MD_TEMPLATE,
  type AgentsMdCli,
  hasRulesPointer,
  renderAgentsMd,
} from "../src/agents-md-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { CONTINUOUS_SKILLS } from "../src/external-assets.js";
import { installedClis, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { resolveRules } from "../src/manifest.js";
import { renderFillScaffold } from "../src/project-claude-merge.js";
import {
  PATH_RULE_POINTER_LEAD,
  type PathRuleFolder,
  type PortedRule,
  pathRulePointerTargets,
  portRules,
  renderRulesBlock,
} from "../src/rules-port.js";
import type { CliBase, Track } from "../src/types.js";

/**
 * #960 (ADR-119) — OpenCode 가 섞인 집합도 경로 룰(`paths:`)은 이번 실행이 이번 룰 전부를 쓴 룰 폴더를 가리키는 목록이다(조건 ② 를
 * 걷었다 — 실 OpenCode 2.2.5 6/6 · 대조군 0/2, `docs/research/codex-rule-pointer-2026-11.md` §5차). ADR-116 의 위치 안내(Codex 없음 +
 * OpenCode + Antigravity)가 서는 실행은 그쪽이 우선이라 바이트가 그대로다.
 *
 * 판정 기준: **어떤 실행 뒤에도 Codex · OpenCode 가 경로 룰을 0번 받지 않는다.** `reach` 가 룰마다 센다 — `AGENTS.md` 인라인 본문 ·
 * 포인터가 가리키고 실재하며 본문을 담은 파일 · (OpenCode 만) `opencode.json` `instructions` 글롭이 가리키는 실재 파일.
 */

const ROOT = resolve(__dirname, "..");
const TEMPLATE = readFileSync(join(ROOT, AGENTS_MD_TEMPLATE), "utf8");
const TRACKS: Track[] = ["full"];
const PATH_RULES = portRules(ROOT, resolveRules({ tracks: TRACKS })).filter(
  (r) => r.paths.length > 0,
);
const h2 = (r: PortedRule): string => r.body.replace(/^#\s+/, "## ");

describe("ADR-116 위치 안내 집합은 바이트 그대로 — 경로 룰 포인터 값이 와도 위치 안내가 이긴다", () => {
  it("렌더: opencode+antigravity · 위치 안내 참이면 `harnessRules` 를 쓰지 않는다 — 포인터 판 · 인라인 판이 같은 바이트", () => {
    const ported = portRules(ROOT, resolveRules({ tracks: TRACKS }));
    expect(PATH_RULES.length, "모집단 자기검증 — 경로 룰이 있다").toBeGreaterThan(0);
    const render = (harnessRules: string): string =>
      renderAgentsMd({
        template: TEMPLATE,
        claudeMd: readFileSync(join(ROOT, "templates/CLAUDE.md"), "utf8"),
        projectName: "demo",
        projectContext: withMarkedContinuousSkillsNote(
          renderFillScaffold("agents-md"),
          CONTINUOUS_SKILLS.map((s) => s.id),
        ),
        harnessRules,
        clis: ["opencode", "antigravity"] satisfies AgentsMdCli[],
        rulesViaInstructions: true,
      });
    const inline = render(renderRulesBlock(ported, false));
    expect(hasRulesPointer(inline), "대조군: 위치 안내 판").toBe(true);
    expect(render(renderRulesBlock(ported, ".agents/rules"))).toBe(inline);
    expect(inline).not.toContain(PATH_RULE_POINTER_LEAD);
  });
});

describe("§ 실행마다 Codex · OpenCode 가 경로 룰을 받는 수 (OpenCode 가 섞인 집합)", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "oc-960-"));
  });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  const install = (cli: CliBase[]): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode: "add",
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
  const pointerFolder = (): PathRuleFolder | "mixed" | null => {
    const agents = read("AGENTS.md");
    if (!agents.includes(PATH_RULE_POINTER_LEAD)) return null;
    const dirs = new Set(
      pathRulePointerTargets(agents).map((t) => t.slice(0, t.lastIndexOf("/")) as PathRuleFolder),
    );
    return dirs.size === 1 ? ([...dirs][0] ?? null) : "mixed";
  };
  /** 953 의 `codexReach` 와 같은 셈 — 인라인 본문 · 포인터가 가리키고 실재하며 본문을 담은 파일. */
  const codexReach = (r: PortedRule): number => {
    const agents = read("AGENTS.md");
    const inline = agents.includes(h2(r));
    const viaFile = pathRulePointerTargets(agents).some(
      (t) => t.endsWith(`/${r.name}.md`) && read(t).includes(r.body),
    );
    return Number(inline) + Number(viaFile);
  };
  /** OpenCode — 위 셈 + `opencode.json` `instructions` 의 `.agents/rules/*.md` 가 그 룰 파일을 실제로 잡는가(ADR-116). */
  const openCodeReach = (r: PortedRule): number => {
    let glob = false;
    try {
      const v = (JSON.parse(read("opencode.json") || "{}") as { instructions?: unknown })
        .instructions;
      glob =
        Array.isArray(v) &&
        v.includes(".agents/rules/*.md") &&
        read(`.agents/rules/${r.name}.md`).includes(r.body);
    } catch {
      glob = false;
    }
    return codexReach(r) + Number(glob);
  };
  /** 기록이 말하는 깔린 CLI 중 Codex · OpenCode 마다 경로 룰 전부가 1번 이상. */
  const everyReaderReaches = (step: string): void => {
    const clis = installedClis(readInstallLog(projectDir));
    for (const r of PATH_RULES) {
      if (clis.includes("codex"))
        expect(codexReach(r), `${step} — Codex ${r.name}`).toBeGreaterThan(0);
      if (clis.includes("opencode")) {
        expect(openCodeReach(r), `${step} — OpenCode ${r.name}`).toBeGreaterThan(0);
      }
    }
  };

  it("모집단 자기검증 — 경로 룰 둘", () => {
    expect(PATH_RULES.map((r) => r.name).sort()).toEqual(["cli-development", "ui-components"]);
  });

  it.each([
    ["claude+codex+opencode", ["claude", "codex", "opencode"], ".claude/rules"],
    [
      "claude+codex+opencode+antigravity",
      ["claude", "codex", "opencode", "antigravity"],
      ".agents/rules",
    ],
    ["codex+opencode+antigravity", ["codex", "opencode", "antigravity"], ".agents/rules"],
    ["claude+opencode", ["claude", "opencode"], ".claude/rules"],
  ] as const)("%s 함께 install → %s 포인터 · Codex · OpenCode 경로 룰은 파일로 · update 도 같은 바이트", (_, set, folder) => {
    install([...set]);
    expect(pointerFolder()).toBe(folder);
    expect(hasRulesPointer(read("AGENTS.md")), "ADR-116 위치 안내는 서지 않는다").toBe(false);
    for (const r of PATH_RULES) expect(read("AGENTS.md")).not.toContain(h2(r));
    everyReaderReaches("install");
    const agents = read("AGENTS.md");
    update();
    expect(read("AGENTS.md")).toBe(agents);
  });

  it("ADR-116 집합(opencode+antigravity 함께) → 위치 안내 그대로 · 경로 룰 포인터 줄 없음", () => {
    install(["opencode", "antigravity"]);
    expect(hasRulesPointer(read("AGENTS.md"))).toBe(true);
    expect(pointerFolder()).toBeNull();
    everyReaderReaches("install");
  });

  // ADR-116 집합인데 위치 안내가 이번 실행에 서지 못하는 부분 실행 — 전에는 인라인, 이제 이번 실행이 쓴 룰 폴더를 가리킨다
  it.each([
    ["opencode 설치본에 install --cli antigravity", ["opencode"], ["antigravity"], ".agents/rules"],
    [
      "opencode+antigravity 설치본에 install --cli claude",
      ["opencode", "antigravity"],
      ["claude"],
      ".claude/rules",
    ],
  ] as const)("%s → 위치 안내 없음(opencode 미실행) · %s 포인터 → update 에 위치 안내", (_, first, then, folder) => {
    install([...first]);
    install([...then]);
    expect(hasRulesPointer(read("AGENTS.md"))).toBe(false);
    expect(pointerFolder()).toBe(folder);
    everyReaderReaches(`install --cli ${then.join(",")}`);
    update();
    expect(hasRulesPointer(read("AGENTS.md"))).toBe(true);
    expect(pointerFolder()).toBeNull();
    everyReaderReaches("update");
  });

  it("claude+codex 에 install --cli opencode → 인라인(Claude Code 단계가 안 돌았다) → update 에 `.claude/rules/` 포인터", () => {
    install(["claude", "codex"]);
    install(["opencode"]);
    expect(pointerFolder()).toBeNull();
    everyReaderReaches("install --cli opencode");
    update();
    expect(pointerFolder()).toBe(".claude/rules");
    everyReaderReaches("update");
  });

  it.each([
    ["opencode", ".claude/rules"],
    ["codex", ".claude/rules"],
    ["claude", null],
  ] as const)("claude+codex+opencode 에서 uninstall --cli %s → 인라인(재렌더) · update 뒤 %s", (target, after) => {
    install(["claude", "codex", "opencode"]);
    expect(pointerFolder()).toBe(".claude/rules");
    uninstall(target);
    expect(pointerFolder(), "재렌더는 인라인").toBeNull();
    if (target === "claude") {
      expect(existsSync(join(projectDir, ".claude/rules"))).toBe(false);
      expect(read("AGENTS.md")).not.toContain("→ `.claude/rules/");
    }
    everyReaderReaches(`uninstall --cli ${target}`);
    update();
    expect(pointerFolder()).toBe(after);
    everyReaderReaches("update");
  });

  it("claude+opencode 에서 uninstall --cli claude → OpenCode 만 남고 인라인 · 지운 `.claude/rules/` 를 가리키지 않는다", () => {
    install(["claude", "opencode"]);
    expect(pointerFolder()).toBe(".claude/rules");
    uninstall("claude");
    const rulesDir = join(projectDir, ".claude/rules");
    expect(existsSync(rulesDir) ? readdirSync(rulesDir) : []).toEqual([]);
    expect(pointerFolder()).toBeNull();
    everyReaderReaches("uninstall --cli claude");
  });

  it("codex+opencode+antigravity 에서 uninstall --cli antigravity → 인라인 · update 도 인라인(쓴 룰 폴더가 없다)", () => {
    install(["codex", "opencode", "antigravity"]);
    expect(pointerFolder()).toBe(".agents/rules");
    uninstall("antigravity");
    expect(pointerFolder()).toBeNull();
    everyReaderReaches("uninstall --cli antigravity");
    update();
    expect(pointerFolder()).toBeNull();
    everyReaderReaches("update");
  });
});

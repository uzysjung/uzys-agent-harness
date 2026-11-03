import {
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
import { mergeAgentsMd, renderAgentsBlock } from "../src/agents-md-merge.js";
import { AGENTS_MD_TEMPLATE, type AgentsMdCli, renderAgentsMd } from "../src/agents-md-render.js";
import { uninstallAction } from "../src/commands/uninstall.js";
import { readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { renderedKeyIds } from "../src/key-ids.js";
import { RULES_INSTRUCTION, RULES_INSTRUCTION_KEY } from "../src/opencode/opencode-json.js";
import { portRules, renderRulesBlock } from "../src/rules-port.js";
import type { CliBase, InstallSpec, Track } from "../src/types.js";

/**
 * #944 (ADR-116) — `AGENTS.md` 의 룰 사본을 CLI 집합에 맞춰 둔다.
 *
 * 판정 기준(설계 `docs/plans/944-design.md` §0): Antigravity 가 `AGENTS.md` 를 24,000 B 에서 잘라도 설치자 글과 Antigravity 가 다른
 * 데서 못 받는 하네스 지시는 잃지 않는다(D1 — 룰 절이 맨 끝). Codex 가 없는 설치에서는 OpenCode 가 룰을 한 번만 읽는다(D2 · D3 —
 * `opencode.json` `instructions` 의 `.agents/rules/*.md`). **어떤 실행 뒤에도 OpenCode 가 룰을 0번 받는 일은 없다**(D4) — 아래
 * `reach` 가 그 수를 센다.
 */

const ROOT = resolve(__dirname, "..");
const TEMPLATE = readFileSync(join(ROOT, AGENTS_MD_TEMPLATE), "utf8");
const TEMPLATE_SECTIONS = [...TEMPLATE.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? "");
/** git-policy 룰 본문의 canary — 앵커에는 없다(`resident-reach-4cli` 가 자기검증한다). */
const RULE_CANARY = "공유 이력을 바꾸거나";
const POINTER = "하네스 룰은 `.agents/rules/` 에 있다";

function sections(text: string): string[] {
  return text
    .split("\n")
    .flatMap((l) => /^## (.+)$/.exec(l)?.[1] ?? [])
    .filter((n) => TEMPLATE_SECTIONS.includes(n));
}

function render(clis: ReadonlyArray<AgentsMdCli>, rulesViaInstructions = false): string {
  return renderAgentsMd({
    template: TEMPLATE,
    claudeMd: "# Working Principles\n\n## 1. One\n\nbody\n",
    projectName: "demo",
    projectContext: "<!-- FILL:stack -->",
    harnessRules: "## Some Rule\n\nRULE-BODY",
    clis,
    rulesViaInstructions,
  });
}

describe("D1 — `## Harness Rules` 는 맨 끝 · 설치자 절은 그 앞 · 상시 룰 먼저", () => {
  it("템플릿 순서: Project Context → Project Rules → Session Start → Protected Files → Harness Rules", () => {
    expect(TEMPLATE_SECTIONS).toEqual([
      "Project Context",
      "Project Rules",
      "Session Start",
      "Protected Files",
      "Harness Rules",
    ]);
    for (const set of [["codex"], ["opencode"], ["codex", "opencode", "antigravity"]] as const) {
      const out = render(set);
      expect(sections(out).at(-1), set.join("+")).toBe("Harness Rules");
      expect(out.trimEnd().endsWith("RULE-BODY"), set.join("+")).toBe(true);
    }
  });

  it("룰 안내문은 설치자에게 이 절 **위에** 쓰라고 한다", () => {
    expect(render(["codex"])).toContain("이 절 **위에** `## ` 절로");
    expect(render(["codex"])).not.toContain("이 문서에\n> 이어 쓰거나");
  });

  it("인라인 룰은 상시 룰 → 경로 룰(`paths:`) 순 — Codex 가 32 KiB 에서 멈추면 빠지는 것이 경로 룰이게", () => {
    const names = readdirSync(join(ROOT, "templates/rules"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.slice(0, -3))
      .sort();
    const ported = portRules(ROOT, names);
    const pathRules = ported.filter((r) => r.paths.length > 0);
    const always = ported.filter((r) => r.paths.length === 0);
    expect(pathRules.length, "모집단 자기검증 — 경로 룰").toBeGreaterThan(0);
    expect(always.length, "모집단 자기검증 — 상시 룰").toBeGreaterThan(0);
    // 이름순 입력에서도 경로 룰(`cli-development` …)이 상시 룰(`git-policy` …)보다 앞에 오지 않는다
    expect(names.indexOf("cli-development")).toBeLessThan(names.indexOf("git-policy"));
    const block = renderRulesBlock(ported);
    const heading = (r: { body: string }) =>
      block.indexOf((r.body.split("\n")[0] ?? "").replace(/^#\s+/, "## "));
    const lastAlways = Math.max(...always.map(heading));
    const firstPath = Math.min(...pathRules.map(heading));
    expect(Math.min(...always.map(heading))).toBeGreaterThanOrEqual(0);
    expect(firstPath).toBeGreaterThan(lastAlways);
  });

  it("update 병합: 설치자 절은 `## Harness Rules` 바로 앞으로 — 룰 뒤에 이어 쓴 절도 그 앞으로 옮긴다 · 두 번째부터 같은 바이트", () => {
    const rendered = render(["codex"]);
    const mine = "## My Team\n\nMY-TEAM-TEXT";
    const after = "## Late Notes\n\nLATE-TEXT";
    const existing = `${rendered.replace("\n## Harness Rules\n", `\n${mine}\n\n## Harness Rules\n`).replace(/\n+$/, "\n")}\n${after}\n`;
    const merged = mergeAgentsMd({ rendered, existing, template: TEMPLATE });
    expect(merged).toContain(`${mine}\n\n${after}\n\n## Harness Rules\n`);
    expect(merged.trimEnd().endsWith("RULE-BODY")).toBe(true);
    expect(mergeAgentsMd({ rendered, existing: merged, template: TEMPLATE })).toBe(merged);
  });

  it("`## Harness Rules` 가 없는 렌더(Antigravity 단독)는 전처럼 파일 끝에 되살린다", () => {
    const rendered = render(["antigravity"]);
    expect(sections(rendered)).not.toContain("Harness Rules");
    const existing = `${rendered.replace(/\n+$/, "\n")}\n## My Team\n\nMY-TEAM-TEXT\n`;
    const merged = mergeAgentsMd({ rendered, existing, template: TEMPLATE });
    expect(merged.trimEnd().endsWith("MY-TEAM-TEXT")).toBe(true);
  });

  it("첫 접촉 블록도 같은 순서 — 블록 안에서 룰 절이 마지막", () => {
    const block = renderAgentsBlock({
      rendered: render(["codex", "opencode"]),
      template: TEMPLATE,
      anchorTitle: "Working Principles",
    });
    const order = block
      .split("\n")
      .filter((l) =>
        /^## (Working Principles|Session Start|Protected Files|Harness Rules)$/.test(l),
      );
    expect(order).toEqual([
      "## Working Principles",
      "## Session Start",
      "## Protected Files",
      "## Harness Rules",
    ]);
    expect(block.trimEnd().endsWith("RULE-BODY")).toBe(true);
  });
});

describe("D2 — 위치 안내는 Codex 가 없고 이번 실행이 보장했을 때만", () => {
  it("opencode+antigravity + 보장 → 룰 본문 없이 안내 한 문단 · 절은 맨 끝", () => {
    const out = render(["opencode", "antigravity"], true);
    expect(out).not.toContain("RULE-BODY");
    expect(out).toContain(POINTER);
    expect(sections(out).at(-1)).toBe("Harness Rules");
  });

  it("Codex 가 있으면 보장 플래그가 와도 인라인 — 안내 문장이 Codex 에서 거짓이다", () => {
    const out = render(["codex", "opencode", "antigravity"], true);
    expect(out).toContain("RULE-BODY");
    expect(out).not.toContain(POINTER);
  });

  it("보장이 없으면 opencode+antigravity 도 인라인(오늘과 같음)", () => {
    const out = render(["opencode", "antigravity"]);
    expect(out).toContain("RULE-BODY");
    expect(out).not.toContain(POINTER);
  });

  it("renderedKeyIds 는 같은 조건에서만 원소 id 를 낸다 — `--without` 이 그 id 를 받는다", () => {
    const id = `opencode:${RULES_INSTRUCTION_KEY}`;
    const ids = (clis: CliBase[]) =>
      renderedKeyIds(ROOT, { tracks: ["tooling"], forceInclude: [], previous: null }, clis);
    expect(ids(["opencode", "antigravity"]).has(id)).toBe(true);
    expect(ids(["opencode"]).has(id)).toBe(false);
    expect(ids(["codex", "opencode", "antigravity"]).has(id)).toBe(false);
    expect(ids(["antigravity"]).has(id)).toBe(false);
  });
});

/* ─── D3 · D4 — 실설치 ─────────────────────────────────────────────────── */

describe("D3 · D4 — 실행마다 OpenCode 가 룰을 받는 수", () => {
  let projectDir: string;
  let outside: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "agents-944-"));
    outside = mkdtempSync(join(tmpdir(), "agents-944-out-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  const install = (
    cli: CliBase[],
    extra: Partial<InstallSpec> = {},
    tracks: Track[] = ["tooling"],
    mode: "add" | "reinstall" = "add",
  ): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode,
      spec: { tracks, options: { withCodexTrust: false }, cli, projectDir, ...extra },
    });
  };
  const update = (): void => {
    runInstall({
      runExternal: null,
      harnessRoot: ROOT,
      projectDir,
      mode: "update",
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: ["claude"],
        projectDir,
      },
    });
  };
  const uninstall = (opts: { cli?: string; track?: string }): void => {
    let code: number | null = null;
    uninstallAction(
      { projectDir, ...opts },
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
  const instructions = (): unknown[] => {
    const text = read("opencode.json");
    if (text === "") return [];
    try {
      const v = (JSON.parse(text) as { instructions?: unknown }).instructions;
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  /**
   * OpenCode 가 하네스 룰을 읽는 곳의 수 — `AGENTS.md` 인라인 · `instructions` 원소가 **실재하는** `.agents/rules/*.md` 를 가리킴.
   * 원소만 있고 파일이 없으면(빈 매치) 세지 않는다 — 그건 도달이 아니다.
   */
  const reach = (): { inline: boolean; glob: boolean; times: number } => {
    const inline = read("AGENTS.md").includes(RULE_CANARY);
    const dir = join(projectDir, ".agents/rules");
    const glob =
      instructions().includes(RULES_INSTRUCTION) &&
      existsSync(dir) &&
      readdirSync(dir)
        .filter((f) => f.endsWith(".md"))
        .some((f) => readFileSync(join(dir, f), "utf8").includes(RULE_CANARY));
    return { inline, glob, times: Number(inline) + Number(glob) };
  };
  const pointer = (): boolean => read("AGENTS.md").includes(POINTER);
  const recordedElement = (): boolean =>
    (readInstallLog(projectDir)?.portions ?? []).some(
      (p) => p.path === "opencode.json" && p.key === RULES_INSTRUCTION_KEY,
    );

  it("opencode+antigravity 를 함께 고른 install → 위치 안내 · 원소(하네스 몫) · OpenCode 는 한 번 · 다시 돌려도 같은 바이트", () => {
    install(["opencode", "antigravity"]);
    expect(pointer()).toBe(true);
    expect(read("AGENTS.md")).not.toContain(RULE_CANARY);
    expect(instructions()).toContain(RULES_INSTRUCTION);
    expect(recordedElement()).toBe(true);
    expect(reach()).toEqual({ inline: false, glob: true, times: 1 });
    // Antigravity 는 원래대로 `.agents/rules/` 를 읽는다 — 두 CLI 모두 한 번씩
    const agents = read("AGENTS.md");
    const json = read("opencode.json");
    update();
    install(["opencode", "antigravity"]);
    expect(read("AGENTS.md")).toBe(agents);
    expect(read("opencode.json")).toBe(json);
  });

  it("opencode 단독 → 인라인 · 원소 없음(#300 — `.agents/rules/` 가 없다)", () => {
    install(["opencode"]);
    expect(pointer()).toBe(false);
    expect(instructions().some((g) => String(g).includes("rules/"))).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
  });

  it("opencode 설치본에 install --cli antigravity → 인라인(opencode 미선택) · 원소 없음 → update 에 포인터", () => {
    install(["opencode"]);
    install(["antigravity"]);
    expect(pointer()).toBe(false);
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(reach().times).toBe(1);
    update();
    expect(pointer()).toBe(true);
    expect(reach()).toEqual({ inline: false, glob: true, times: 1 });
  });

  it("antigravity 설치본에 install --cli opencode → 인라인(Antigravity 미실행) · 원소 없음 → update 에 포인터", () => {
    install(["antigravity"]);
    install(["opencode"]);
    expect(pointer()).toBe(false);
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
    update();
    expect(pointer()).toBe(true);
    expect(reach()).toEqual({ inline: false, glob: true, times: 1 });
  });

  it("포인터 설치본에 install --cli codex → 인라인 · 원소는 남는다(두 번) → update 가 원소를 걷어 한 번", () => {
    install(["opencode", "antigravity"]);
    install(["codex"]);
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: true, times: 2 });
    update();
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
  });

  it("포인터 설치본에서 opencode 를 안 고른 실행(install --cli claude) → 인라인 · 원소는 남는다 → update 가 포인터로", () => {
    install(["opencode", "antigravity"]);
    install(["claude"]);
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: true, times: 2 });
    update();
    expect(pointer()).toBe(true);
    expect(reach().times).toBe(1);
  });

  it("포인터 설치본에서 antigravity 를 안 고른 실행(install --cli opencode) → 인라인 · 원소를 걷는다 → update 가 포인터로", () => {
    install(["opencode", "antigravity"]);
    install(["opencode"]);
    expect(pointer()).toBe(false);
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
    update();
    expect(pointer()).toBe(true);
    expect(reach().times).toBe(1);
  });

  it("포인터 설치본에서 `--reinstall` 부분 선택(antigravity 만) → 인라인 · OpenCode 0번이 아니다", () => {
    install(["opencode", "antigravity"]);
    install(["antigravity"], {}, ["tooling"], "reinstall");
    expect(pointer()).toBe(false);
    expect(reach().times).toBeGreaterThanOrEqual(1);
    update();
    expect(pointer()).toBe(true);
    expect(reach().times).toBe(1);
  });

  it("포인터 설치본에서 uninstall --track(재렌더 — opencode.json 을 안 쓴다) → 인라인 · 원소는 남는다 → update 가 포인터로", () => {
    install(["opencode", "antigravity"], {}, ["tooling", "data"]);
    expect(pointer()).toBe(true);
    uninstall({ track: "data" });
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: true, times: 2 });
    update();
    expect(pointer()).toBe(true);
    expect(reach().times).toBe(1);
  });

  it("opencode+antigravity+codex 에서 uninstall --cli codex → 재렌더는 인라인(보장 못 함) · 원소 없음 → update 에 포인터", () => {
    install(["codex", "opencode", "antigravity"]);
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    uninstall({ cli: "codex" });
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
    update();
    expect(pointer()).toBe(true);
    expect(reach()).toEqual({ inline: false, glob: true, times: 1 });
  });

  it("포인터 설치본에서 uninstall --cli antigravity → 인라인 · 원소는 남지만 빈 매치 → update 가 원소를 걷는다", () => {
    install(["opencode", "antigravity"]);
    uninstall({ cli: "antigravity" });
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
    update();
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(reach().times).toBe(1);
  });

  it("포인터 설치본에서 uninstall --cli opencode → 기록된 원소를 걷는다 · 남는 Antigravity 는 절 없음", () => {
    put("opencode.json", `${JSON.stringify({ model: "mine" }, null, 2)}\n`);
    install(["opencode", "antigravity"]);
    expect(recordedElement()).toBe(true);
    uninstall({ cli: "opencode" });
    expect(JSON.parse(read("opencode.json"))).toEqual({ model: "mine" });
    expect(sections(read("AGENTS.md"))).not.toContain("Harness Rules");
  });

  it("설치자가 같은 원소를 먼저 갖고 있으면 그것으로 포인터 · 하네스 몫으로 적지 않는다 · uninstall --cli opencode 뒤에도 남는다", () => {
    const mine = { instructions: ["docs/SPEC.md", RULES_INSTRUCTION], model: "mine" };
    put("opencode.json", `${JSON.stringify(mine, null, 2)}\n`);
    install(["opencode", "antigravity"]);
    expect(pointer()).toBe(true);
    expect(recordedElement()).toBe(false);
    expect(instructions()).toEqual(mine.instructions);
    uninstall({ cli: "opencode" });
    expect(JSON.parse(read("opencode.json"))).toEqual(mine);
  });

  it("`opencode.json` 이 JSON 으로 안 읽히면 원소를 못 쓴다 → 인라인", () => {
    put("opencode.json", "{ model: nope");
    install(["opencode", "antigravity"]);
    expect(read("opencode.json")).toBe("{ model: nope");
    expect(pointer()).toBe(false);
    expect(reach().inline).toBe(true);
  });

  it("`instructions` 가 배열이 아닌 설치자 값이면 kept → 원소 부재 → 인라인", () => {
    put("opencode.json", `${JSON.stringify({ instructions: "docs/SPEC.md" })}\n`);
    install(["opencode", "antigravity"]);
    expect((JSON.parse(read("opencode.json")) as { instructions: unknown }).instructions).toBe(
      "docs/SPEC.md",
    );
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
  });

  it("`--without opencode:instructions[=…]` → 원소 없음 → 인라인 · 다음 update 도 되살리지 않는다", () => {
    const id = `opencode:${RULES_INSTRUCTION_KEY}`;
    install(["opencode", "antigravity"], {
      userOverride: { forceInclude: [], forceExclude: [id] },
    });
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(pointer()).toBe(false);
    expect(reach()).toEqual({ inline: true, glob: false, times: 1 });
    update();
    expect(instructions()).not.toContain(RULES_INSTRUCTION);
    expect(pointer()).toBe(false);
  });

  it("Antigravity 가 룰 하나를 못 썼으면(프로젝트 밖 링크) 인라인 — 그 룰을 OpenCode 가 잃지 않는다", () => {
    mkdirSync(join(projectDir, ".agents/rules"), { recursive: true });
    writeFileSync(join(outside, "git-policy.md"), "# elsewhere\n");
    symlinkSync(join(outside, "git-policy.md"), join(projectDir, ".agents/rules/git-policy.md"));
    install(["opencode", "antigravity"]);
    expect(readFileSync(join(outside, "git-policy.md"), "utf8")).toBe("# elsewhere\n");
    expect(pointer()).toBe(false);
    expect(reach().inline).toBe(true);
  });

  function put(rel: string, content: string): void {
    mkdirSync(join(projectDir, rel, ".."), { recursive: true });
    writeFileSync(join(projectDir, rel), content);
  }
});

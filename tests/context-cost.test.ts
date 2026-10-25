import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installSpecFromOptions } from "../src/commands/install.js";
import { renderInstallHeader, renderUpdateSummary } from "../src/commands/install-render.js";
import {
  assetDescriptorTokens,
  formatResidentCostLine,
  residentCost,
  summarizeContextCost,
} from "../src/context-cost.js";
import {
  assetCliSupport,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
} from "../src/external-assets.js";
import { thisRunExclusions } from "../src/install-writes.js";
import { buildManifestSpec, runInstall } from "../src/installer.js";
import { formatSummary } from "../src/interactive.js";
import { withoutAccepts } from "../src/key-ids.js";
import { buildAssetSpec, buildManifest } from "../src/manifest.js";
import { finalSelectedAssets } from "../src/preset-recommend.js";
import { type CliBase, DEFAULT_OPTIONS, type InstallSpec, type Track } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

const HARNESS_ROOT_FOR_INSTALL = resolve(__dirname, "..");

describe("context-cost primitives", () => {
  it("measures every bundled internal skill (frontmatter exists and is non-trivial)", () => {
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const tokens = assetDescriptorTokens(id);
      expect(tokens, `bundled skill ${id} must be measurable`).not.toBeNull();
      expect(tokens ?? 0, `bundled skill ${id} frontmatter too small to be real`).toBeGreaterThan(
        20,
      );
    }
  });
});

describe("path robustness + degraded frontmatter (SOD 리뷰 F1/F7 회귀 가드)", () => {
  it("measures from a root containing spaces and Korean chars, with CRLF frontmatter", () => {
    const root = mkdtempSync(join(tmpdir(), "agent harness 한글 "));
    const dir = join(root, "templates", "skills", "compaction-handoff");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "---\r\nname: x\r\ndescription: y\r\n---\r\nbody");
    expect(assetDescriptorTokens("compaction-handoff", root) ?? 0).toBeGreaterThan(0);
  });

  it("degrades to null (unmeasured) when SKILL.md has no frontmatter", () => {
    const root = mkdtempSync(join(tmpdir(), "agent-harness-nofm-"));
    const dir = join(root, "templates", "skills", "compaction-handoff");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), "no frontmatter body");
    expect(assetDescriptorTokens("compaction-handoff", root)).toBeNull();
  });
});

/**
 * #856 — unmeasured 버킷은 외부 자산 한정(ADR-032). descriptor 가 없는 하네스 번들 자산
 * (ci-scaffold)이 "external unmeasured" 로 세어지면 화면이 하네스 자산을 외부라고 오보한다.
 */
describe("unmeasured 는 외부 자산만 센다 (#856)", () => {
  it("descriptor 없는 internal(ci-scaffold)은 세지 않고, 진짜 external 은 그대로 센다", () => {
    expect(assetDescriptorTokens("ci-scaffold")).toBeNull(); // 전제: descriptor 가 없다
    expect(summarizeContextCost(["ci-scaffold"]).unmeasuredCount).toBe(0);
    expect(summarizeContextCost(["frontend-design"]).unmeasuredCount).toBe(1);
  });

  it("tooling 확인 화면 — ci-scaffold 가 선택돼도 'external asset unmeasured' 를 내지 않는다", () => {
    const spec = {
      projectDir: "/tmp/x",
      tracks: ["tooling"],
      cli: ["claude"],
      options: {},
      scope: "project",
    } as unknown as InstallSpec;
    expect(finalSelectedAssets(spec.tracks)).toContain("ci-scaffold");
    const externals = finalSelectedAssets(spec.tracks).filter(
      (id) => EXTERNAL_ASSETS.find((a) => a.id === id)?.method.kind !== "internal",
    );
    expect(externals, "tooling 기본에 external 이 생기면 이 대조를 다시 본다").toEqual([]);
    expect(formatSummary(spec)).not.toMatch(/external assets? unmeasured/);
  });

  /**
   * #856 리뷰 HIGH — MCP 서버 행도 internal 이지만 세션마다 tool schema 가 상주한다. ADR-044 §4 "미계측 항목은 그대로
   * 명시한다: 외부 자산 · MCP tool schema(서버 제공)" — 빼면 상주 비용을 숨긴다. external 이라 부르지 않고 따로 말한다.
   */
  it("MCP 서버 행은 세지 않는 것이 아니라 'MCP server tool schema' 미계측으로 따로 센다", () => {
    const one = summarizeContextCost(["context7"]);
    expect(one).toMatchObject({ unmeasuredCount: 0, mcpUnmeasuredCount: 1 });
    const line = formatResidentCostLine(
      residentCost(
        buildManifest(buildManifestSpec(surfaceSpec(["tooling"]))).filter((e) =>
          e.applies(buildManifestSpec(surfaceSpec(["tooling"]))),
        ),
      ),
      one,
    );
    expect(line).toContain(" · 1 MCP server tool schema unmeasured)");
    expect(line).not.toContain("external");
    expect(summarizeContextCost(["ci-scaffold", "context7"]).mcpUnmeasuredCount).toBe(1);
  });

  it("csr-supabase 확인 화면 · 설치 헤더 — 트랙 기본 MCP 4종을 미계측으로 말한다", () => {
    const spec = surfaceSpec(["csr-supabase"]);
    expect(formatSummary(spec)).toContain("4 MCP server tool schemas unmeasured");
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    expect(lines.join("\n")).toContain("4 MCP server tool schemas unmeasured");
  });
});

/**
 * #865 — 비용 줄은 실제로 깔리는 자산만 센다. 고른 CLI 가 받지 못하는 자산(Antigravity 는 MCP 를 받지 않고, 플러그인은 claude
 * 만 받는다)은 미계측 수에 들지 않는다 — 확인 화면 · 설치 헤더 · update 요약 셋 다. update 요약은 기록된 `--without` 도 따른다.
 */
describe("비용 줄은 고른 CLI 가 받는 자산만 센다 (#865)", () => {
  const tracks: Track[] = ["csr-supabase"];
  /** 그 CLI 로 깔리는 외부(비-internal) 자산 수 — 카탈로그의 방식 · 도달 목록에서 따로 센다. */
  const externalsFor = (cli: CliBase): number =>
    finalSelectedAssets(tracks).filter((id) => {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      return a !== undefined && a.method.kind !== "internal" && assetCliSupport(a).includes(cli);
    }).length;
  const externalPart = (n: number): string => `${n} external asset${n === 1 ? "" : "s"} unmeasured`;

  let projectDir = "";
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "cost-reach-"));
  });
  afterEach(() => rmSync(projectDir, { recursive: true, force: true }));

  /** 설치한 뒤 update 요약의 CONTEXT 줄 — update 가 쓰는 spec(`buildUpdateSpec`) 그대로. */
  const updateCostLine = (spec: InstallSpec): string => {
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT_FOR_INSTALL,
      projectDir,
      spec,
      mode: "add",
    });
    const lines: string[] = [];
    renderUpdateSummary((m) => lines.push(m), buildUpdateSpec(projectDir, tracks), report);
    return lines.find((l) => l.includes("session-start context cost")) ?? "";
  };

  it("Antigravity 단독 — 세 화면 모두 MCP tool schema 를 세지 않고 외부 자산은 Antigravity 가 받는 것만 센다", () => {
    // 대조군 — claude 는 같은 트랙에서 더 많이 받는다(이 테스트가 가를 수 있다는 전제)
    expect(externalsFor("antigravity")).toBeLessThan(externalsFor("claude"));
    const spec: InstallSpec = { ...surfaceSpec(tracks), cli: ["antigravity"], projectDir };
    const header: string[] = [];
    renderInstallHeader((m) => header.push(m), spec);
    const surfaces = {
      confirm: formatSummary(spec),
      header: header.join("\n"),
      update: updateCostLine(spec),
    };
    // 화면마다 따로 판정한다 — 하나가 틀려도 나머지의 결과가 함께 보이게
    for (const [name, text] of Object.entries(surfaces)) {
      expect.soft(text, name).toContain("session-start context cost");
      expect.soft(text, name).not.toContain("MCP server tool schema");
      expect.soft(text, name).toContain(externalPart(externalsFor("antigravity")));
    }
  });

  it("기록에 --without 으로 뺀 MCP 서버는 update 요약이 세지 않는다", () => {
    const base = surfaceSpec(tracks);
    const all = summarizeContextCost(finalSelectedAssets(tracks)).mcpUnmeasuredCount;
    expect(finalSelectedAssets(tracks)).toContain("railway-mcp-server"); // 전제 — 트랙 기본 MCP
    const line = updateCostLine({
      ...base,
      projectDir,
      userOverride: { forceInclude: [], forceExclude: ["railway-mcp-server"] },
    });
    expect(line).toContain(`${all - 1} MCP server tool schemas unmeasured`);
  });
});

/**
 * #904 — 트랙 기본 MCP 서버를 키 id 형태(`--without mcp:<서버>`)로 빼도 자산 id 형태(`--without <서버>`)와 같이 센다. 두 형태
 * 모두 `.mcp.json` 에서는 빠지는데, 키 id 형태만 화면(ASSETS 줄 · 비용 줄 · update 요약)이 계속 세던 어긋남을 고정한다.
 */
describe("키 id 로 뺀 MCP 서버는 화면이 세지 않는다 (#904)", () => {
  const tracks: Track[] = ["csr-supabase"];
  const SERVER = "railway-mcp-server";
  const KEY = `mcp:${SERVER}`;
  /** 트랙 기본 MCP 서버 수(context7 · railway · supabase · chrome-devtools) — 아래 기대값의 기준선. */
  const ALL = summarizeContextCost(finalSelectedAssets(tracks)).mcpUnmeasuredCount;
  const mcpPart = (n: number): string =>
    `${n} MCP server tool schema${n === 1 ? "" : "s"} unmeasured`;

  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  /** 화면 중 이 이슈가 보는 줄 — ASSETS 줄(수) · 카테고리별 id 줄 · 비용 줄. 경로가 든 줄은 빼서 실행끼리 비교할 수 있다. */
  const picked = (text: string): string =>
    text
      .split("\n")
      .filter((l) => /\d+ selected|^\s+· [a-z-]+: |session-start context cost/.test(l))
      .join("\n");

  /**
   * `install --track csr-supabase --without <without>` 를 한 뒤의 네 화면 — 확인 화면 · 설치 헤더 · update 헤더 · update 요약.
   * spec 은 비대화형 `executeSpec` 이 화면에 넘기는 것과 같은 길(`installSpecFromOptions` → `thisRunExclusions`)로 만들고,
   * update 쪽은 그 설치가 남긴 기록에서 `buildUpdateSpec` 이 읽는다.
   */
  const screens = (without: string[]): Record<string, string> => {
    const projectDir = mkdtempSync(join(tmpdir(), "cost-keyid-"));
    dirs.push(projectDir);
    const warnings: string[] = [];
    const parsed = installSpecFromOptions(
      { track: [...tracks], without, projectDir },
      ["claude"],
      (m) => warnings.push(m),
      HARNESS_ROOT_FOR_INSTALL,
    );
    expect(warnings, "빼기 id 가 받아들여져야 한다 — 경고가 나면 전제가 틀렸다").toEqual([]);
    const spec = thisRunExclusions(
      parsed,
      null,
      withoutAccepts(HARNESS_ROOT_FOR_INSTALL, parsed, null),
    ).spec;
    const header: string[] = [];
    renderInstallHeader((m) => header.push(m), spec);
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT_FOR_INSTALL,
      projectDir,
      spec,
      mode: "add",
    });
    const updateSpec = buildUpdateSpec(projectDir, tracks);
    const updateHeader: string[] = [];
    renderInstallHeader((m) => updateHeader.push(m), updateSpec, "update");
    const summary: string[] = [];
    renderUpdateSummary((m) => summary.push(m), updateSpec, report);
    return {
      confirm: picked(formatSummary(spec)),
      header: picked(header.join("\n")),
      updateHeader: picked(updateHeader.join("\n")),
      updateSummary: picked(summary.join("\n")),
    };
  };
  const selectedCount = (text: string): number =>
    Number(/(\d+) selected/.exec(text)?.[1] ?? Number.NaN);
  /** ASSETS 줄을 내는 화면 · 비용 줄을 내는 화면. update 헤더는 비용 줄을 안 찍고(#458), update 요약은 ASSETS 줄이 없다. */
  const assetsScreens = ["confirm", "header", "updateHeader"];
  const costScreens = ["confirm", "header", "updateSummary"];

  it("--without mcp:<서버> — ASSETS 줄 · 비용 줄 · update 요약이 그 서버를 세지 않는다", () => {
    const base = screens([]);
    expect(base.header, "전제 — 트랙 기본 MCP 라 아무것도 안 빼면 센다").toContain(SERVER);
    const byKey = screens([KEY]);
    for (const name of assetsScreens) {
      expect.soft(byKey[name], name).not.toContain(SERVER);
      expect.soft(selectedCount(byKey[name] ?? ""), name).toBe(selectedCount(base[name] ?? "") - 1);
    }
    for (const name of costScreens) expect.soft(byKey[name], name).toContain(mcpPart(ALL - 1));
  });

  it("두 형태(--without <서버> · --without mcp:<서버>)가 같은 화면을 낸다", () => {
    const byAsset = screens([SERVER]);
    const byKey = screens([KEY]);
    for (const name of Object.keys(byAsset)) expect.soft(byKey[name], name).toBe(byAsset[name]);
    // 대조군 — 자산 id 형태는 서버를 빼고 센다(두 형태가 함께 틀려 같아지는 경우를 막는다)
    expect(byAsset.header).not.toContain(SERVER);
    expect(byAsset.header).toContain(mcpPart(ALL - 1));
  });

  it("뺀 것이 없으면 현행 수 그대로이고, 이 트랙의 MCP 가 아닌 키 id 는 수를 바꾸지 않는다", () => {
    const none = screens([]);
    for (const name of costScreens) expect.soft(none[name], name).toContain(mcpPart(ALL));
    for (const name of assetsScreens) expect.soft(none[name], name).toContain(SERVER);
    const other = screens(["settings:statusLine"]);
    for (const name of Object.keys(none)) expect.soft(other[name], name).toBe(none[name]);
  });
});

function surfaceSpec(tracks: Track[]): InstallSpec {
  return {
    projectDir: "/tmp/x",
    tracks,
    cli: ["claude"],
    options: {},
    scope: "project",
  } as unknown as InstallSpec;
}

/** 표시 표면 증거 (no-false-ship — "표시된다" 주장은 렌더 실행 산출물로 증명). */
describe("context cost surfaces", () => {
  const spec: InstallSpec = {
    projectDir: "/tmp/x",
    tracks: ["tooling"],
    cli: ["claude"],
    options: {},
    scope: "project",
  } as unknown as InstallSpec;

  /**
   * 표면이 보여야 하는 문자열을 여기서 다시 조립하지 않는다 — 포맷 함수를 그대로 호출해
   * 얻는다. 기대값을 손으로 적으면 그 문자열이 세 번째 사본이 되고, 표면이 자체 조립으로
   * 새는 것을 잡으려는 이 테스트가 정작 같은 잘못을 저지르게 된다.
   *
   * **기대값은 `buildManifestSpec` 을 거친다 (#320 H1, 독립 리뷰 적발).** 전에는 `InstallSpec`
   * 을 그대로 `applies()` 에 넘겨 기대값을 뽑았는데, 표면도 같은 좁은 spec 을 쓰고 있어서
   * **둘이 같은 결함을 공유한 채 항상 초록**이었다. 그동안 설치자 화면은 track=tooling 에서
   * 23개(실제 34개)를 출력하고 있었다. 기대값을 설치기 쪽에 묶어야 표면이 새는 것이 보인다.
   */
  const expectedLine = (): string => {
    const assetSpec = buildManifestSpec(spec);
    const entries = buildManifest(assetSpec).filter((e) => e.applies(assetSpec));
    const line = formatResidentCostLine(residentCost(entries), {
      unmeasuredCount: 0,
      mcpUnmeasuredCount: 0,
    });
    // unmeasured 절은 자산 선택에 따라 달라지므로 그 앞부분(개수·토큰·내역)만 비교한다.
    return (line ?? "").split(" · 0 external")[0]?.replace(/\)$/, "") ?? "";
  };

  it("화면에 뜨는 상주 항목 수가 baseline·cost:report 와 같은 값이다 (#320 H1)", () => {
    // 계측만 고치고 표면을 두면 **내부는 34, 화면은 23** 이 된다 — 일관되게 틀린 것보다 나쁘다.
    // `residentCost` 를 설치기 spec 으로 부른 것이 이 저장소의 1차 지표 값이고, 화면은 그것과
    // 같아야 한다.
    const truth = residentCost(
      buildManifest(buildManifestSpec(spec)).filter((e) => e.applies(buildManifestSpec(spec))),
    ).items.total;
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const shown = /(\d+) items resident/.exec(lines.join("\n"))?.[1];
    expect(
      shown,
      "설치 헤더가 상주 항목 수를 아예 안 낸다 — 표면이 사라졌거나 문구가 바뀌었다.",
    ).toBeDefined();
    expect(
      Number(shown),
      `설치 헤더가 ${shown}개를 보여주는데 실제 상주는 ${truth}개다 — 설치자에게 나가는 숫자가\n` +
        "1차 지표와 어긋난다(#320 H1: 표면이 selectedInternalSkills 없는 spec 을 쓰면 이 형태가 된다).",
    ).toBe(truth);
    expect(formatSummary(spec)).toContain(`${truth} items resident`);
  });

  it("non-interactive install header prints the context cost line", () => {
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const joined = lines.join("\n");
    expect(joined).toContain("session-start context cost:");
    // v26.117.0 — 총합만 보이면 "스킬 descriptor 만 세던" 10% 과소표기로 조용히 되돌아간다.
    // v26.140.0 — 개수까지 같은 라인으로 도달하는지 (표면 대칭). 포맷 함수 산출물과 대조.
    expect(joined).toContain(expectedLine());
    expect(joined).toContain("items resident");
  });

  it("wizard confirm summary prints the same context cost line", () => {
    const summary = formatSummary(spec);
    expect(summary).toContain("session-start context cost:");
    expect(summary).toContain(expectedLine());
    expect(summary).toContain("items resident");
  });

  it("두 표면이 **같은** 라인을 보여준다 — 표면별 상이 문구 금지", () => {
    // v26.88.0 이중 고지 사고의 교훈이 개수 축에도 그대로 걸린다.
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    const fromHeader = lines.join("\n").match(/session-start context cost: [^\n]*/)?.[0];
    const fromWizard = formatSummary(spec).match(/session-start context cost: [^\n]*/)?.[0];
    expect(fromHeader).toBeDefined();
    // 헤더는 dim 이스케이프가 붙으므로 wizard 라인이 헤더 라인에 포함되는지로 본다.
    expect(fromHeader).toContain(expectedLine());
    expect(fromWizard).toContain(expectedLine());
  });
});

/**
 * #476 — 계획(manifest)으로 재는 두 표면(헤더 · wizard confirm)은 그 CLI 조합에서 **디스크에
 * 남는** 것만 센다. codex 단독 설치는 `.claude/` 를 만들지 않는데 서브에이전트를 셌고(tooling:
 * `agents 2 ~192`), 같은 설치의 update 화면(디스크 실측, #458)은 `agents 0 ~0` 을 냈다 — 같은
 * 설치가 화면마다 다른 숫자를 가진다. 기대값은 여기서 손으로 적지 않고 manifest 계획에서 뽑는다.
 */
describe("계획 상주 계측은 CLI 조합에서 디스크에 남는 것만 센다 (#476)", () => {
  const specFor = (cli: ReadonlyArray<string>): InstallSpec =>
    ({
      projectDir: "/tmp/x",
      tracks: ["tooling"],
      cli,
      options: {},
      scope: "project",
    }) as unknown as InstallSpec;
  const headerLine = (spec: InstallSpec): string => {
    const lines: string[] = [];
    renderInstallHeader((m) => lines.push(m), spec);
    return /session-start context cost: [^\n]*/.exec(lines.join("\n"))?.[0] ?? "";
  };
  const plannedAgents = (spec: InstallSpec): number => {
    const a = buildManifestSpec(spec);
    return buildManifest(a).filter((e) => e.applies(a) && e.target.startsWith(".claude/agents/"))
      .length;
  };

  it("codex 단독 — 헤더와 wizard confirm 이 agents 0 ~0 (계획에는 에이전트가 있다 = 대조군)", () => {
    const spec = specFor(["codex"]);
    expect(
      plannedAgents(spec),
      "대조군: 계획에 에이전트가 없으면 이 테스트는 필터가 무는지 못 본다",
    ).toBeGreaterThan(0);
    expect(headerLine(spec)).toContain("agents 0 ~0");
    expect(formatSummary(spec)).toContain("agents 0 ~0");
  });

  it("claude 포함 — 계획의 에이전트 수를 그대로 센다 (기존 동작 보존)", () => {
    const spec = specFor(["claude", "codex"]);
    expect(headerLine(spec)).toContain(`agents ${plannedAgents(spec)} ~`);
    expect(formatSummary(spec)).toContain(`agents ${plannedAgents(spec)} ~`);
  });
});

/**
 * **계측을 "설치가 실제로 만드는 것"에 묶는다 (#320, 사용자 지시 2026-08-30).**
 *
 * #320 의 원인은 필드 하나를 빠뜨린 것이 아니라 **계측이 설치와 다른 목록을 보고 있었다**는
 * 것이다. 그래서 재발 방지도 "필드를 채웠는지" 확인이 아니라 **두 목록을 맞대는 것**으로 한다 —
 * 새 스킬이 카탈로그에 들어오면 설치분과 계측분이 함께 움직이므로 이 등식은 저절로 최신이 된다.
 * 열거가 없어서 게이트를 고칠 일도 없다.
 *
 * 외부 설치(`runExternal`)는 no-op 으로 둔다 — 그쪽은 설치 시점에 내용을 알 수 없어 의도적으로
 * "미계측"이고(no-false-ship), 섞으면 이 등식이 네트워크 상태에 따라 흔들린다.
 */
describe("상주 계측 ↔ 실제 설치 (#320 재발 방지)", () => {
  const measuredVsInstalled = (
    track: Track,
  ): { measured: number; installed: ReadonlyArray<string>; selected: number } => {
    const projectDir = mkdtempSync(join(tmpdir(), "cost-install-"));
    try {
      const spec = buildAssetSpec({ tracks: [track], options: DEFAULT_OPTIONS });
      runInstall({
        harnessRoot: HARNESS_ROOT_FOR_INSTALL,
        projectDir,
        spec: { tracks: [track], options: DEFAULT_OPTIONS, cli: ["claude"], projectDir },
        mode: "add",
        runExternal: () => ({ attempted: [], succeeded: 0, skipped: 0, excludedByCli: [] }),
      });
      const installed = readdirSync(join(projectDir, ".claude", "skills"), { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();
      const measured = residentCost(buildManifest(spec).filter((e) => e.applies(spec))).items
        .skills;
      return { measured, installed, selected: spec.selectedInternalSkills.length };
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
    }
  };

  it.each([
    "executive",
    "tooling",
    "full",
  ] as ReadonlyArray<Track>)("track=%s — 상주 계측이 세는 스킬 수 = 설치가 실제로 만든 스킬 디렉터리 수", (track) => {
    const { measured, installed } = measuredVsInstalled(track);
    expect(
      measured,
      `계측 ${measured}종 ≠ 실설치 ${installed.length}종.\n` +
        `설치된 것: ${installed.join(", ")}\n` +
        "계측 spec 이 설치기와 다른 목록을 보고 있다 — #320 이 정확히 이 형태였다\n" +
        "(계측만 손으로 조립해 selectedInternalSkills 를 안 넘겼고, 번들 스킬이 통째로 빠졌다).",
    ).toBe(installed.length);
  });

  it("모집단이 통째로 비어 통과하는 상태를 막는다 (0 == 0 방지)", () => {
    // **위 등식이 무는 범위를 과장하지 않는다** (독립 리뷰 적발): 등식은 "계측만 설치와
    // 갈리는 것"을 잡는다. `buildAssetSpec` **자체**가 망가지면 계측과 설치가 **함께** 줄어
    // 등식은 초록으로 산다. 그 경우를 실제로 무는 것은 아래 하한 단언이다.
    const { measured, selected } = measuredVsInstalled("tooling");
    expect(selected, "buildAssetSpec 이 번들 스킬을 하나도 안 고른다").toBeGreaterThan(0);
    // ADR-090 (#452) 이전에는 `measured > selected` 였다 — 카탈로그 엔트리 없이 깔리던 ECC 파생
    // 스킬이 tooling 상주에 섞여 있었기 때문이다. 그 셋이 은퇴해 두 집합이 겹친다.
    expect(measured, "상주 스킬 계측이 0 이다").toBeGreaterThanOrEqual(selected);
  });
});

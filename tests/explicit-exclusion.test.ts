/**
 * ADR-099 — 빼기는 명시할 때만 · 기록된 빼기는 모든 설치가 지킨다 (설계 `docs/plans/explicit-exclusion-design-2026-10-04.md`).
 *
 * 이 파일이 무는 것(설계 §5):
 *   - R3 누적 규칙이 **선택에도** 걸린다 — `--without baseline:rules/x` 뒤 플래그 없는 install · update 가 그 룰을 깔지
 *     않고, `--with baseline:rules/x` 로만 돌아온다. 뺐지만 남은 파일은 지우지도 갱신하지도 않고 화면이 말한다
 *   - 위저드 재체크 — 기록에서 뺀 것을 다시 체크하면 확인 화면 `RUNS AS` 에 `--with <id>` 가 보이고 설치 뒤 파일이 있다
 *   - R5 — v26.162–26.163 이 굳힌 기록(키 id 자동 추론 · 다시 깐 baseline/번들 스킬)을 한 번 푼다 · 표시 뒤엔 다시 안 돈다
 *   - #566 — 뺀 외부 스킬은 기록에 깔렸다고 남아 있어도 update 가 되살리지 않는다
 */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listBaselineTargets } from "../src/baseline-targets.js";
import {
  executeSpec,
  type InstallOptions,
  installSpecFromOptions,
} from "../src/commands/install.js";
import {
  createInstallRenderer,
  excludedStillThereRows,
  legacyReleasedCatalogRows,
} from "../src/commands/install-render.js";
import { listAction } from "../src/commands/list.js";
import { excludedStillThere } from "../src/excluded-still-there.js";
import { type ExternalAsset, INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { refreshExternalSkills } from "../src/external-installer.js";
import {
  appendSelection,
  hashContent,
  type InstallLog,
  installLogPath,
  LEGACY_REINSTALL_WINDOW_MS,
  legacyDroppedKeys,
  legacyReleasedCatalog,
  migrateExcluded,
  readInstallLog,
  SELECTIONS_MAX,
} from "../src/install-log.js";
import { thisRunExclusions } from "../src/install-writes.js";
import { type InstallMode, type InstallReport, runInstall } from "../src/installer.js";
import { runInteractive } from "../src/interactive.js";
import { withoutAccepts } from "../src/key-ids.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import { residentEntries } from "../src/resident-entries.js";
import type { CliTargets, InstallSpec, Track } from "../src/types.js";
import { buildUpdateSpec, runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const RULE = "baseline:rules/git-policy";
const RULE_FILE = ".claude/rules/git-policy.md";

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-explicit-excl-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(over: Partial<InstallSpec> = {}): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude"],
    projectDir,
    ...over,
  };
}

function install(over: Partial<InstallSpec> = {}): { report: InstallReport; screen: string } {
  const s = spec(over);
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), s, false);
  const report = runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: s,
    mode: "add",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const screen = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { report, screen };
}

/** update 를 화면과 함께 돌린다 — 색을 벗긴 출력. */
function updateScreen(): string {
  const lines: string[] = [];
  const renderer = createInstallRenderer((m) => lines.push(m), spec(), false);
  runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(),
    mode: "update",
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  return lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
}

function update(): InstallReport {
  return runInstall({
    runExternal: null,
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(),
    mode: "update",
  });
}

const abs = (rel: string) => join(projectDir, rel);
/** 마지막 설치의 플래그(`spec.baselineExclude`)를 뗀 spec — 빼기가 누적 기록에만 있는 상태를 만든다. */
function specWithoutFlag(log: InstallLog): InstallLog["spec"] {
  const { baselineExclude: _flag, ...rest } = log.spec;
  return rest;
}
const rawLog = (): InstallLog => JSON.parse(readFileSync(installLogPath(projectDir), "utf8"));
function putRawLog(log: InstallLog): void {
  mkdirSync(dirname(installLogPath(projectDir)), { recursive: true });
  writeFileSync(installLogPath(projectDir), JSON.stringify(log));
}

describe("R3 — 기록된 빼기는 선택에도 걸린다", () => {
  it("V1 · V2 — `--without baseline:…` 은 update 가 지키고, 플래그 없는 다음 install 이 다시 깔고 그렇게 말한다", () => {
    install();
    expect(existsSync(abs(RULE_FILE))).toBe(true); // 전제

    const { screen } = install({ baselineExclude: [RULE] });
    // 이미 깔린 것은 지우지 않고, 화면이 그 사실과 두 길을 말한다
    expect(existsSync(abs(RULE_FILE))).toBe(true);
    expect(screen).toContain(
      `${RULE} — excluded (still on disk — an earlier install put it there; the harness does not delete it. Remove the file yourself, or run uninstall) · to manage it again: run install without --without ${RULE}`,
    );
    expect(updateScreen()).toContain(`${RULE} — excluded (still on disk`);
    expect(screen).not.toContain(`uninstall --only ${RULE}`);

    rmSync(abs(RULE_FILE));
    update(); // A — 손 삭제 뒤 update 는 기록의 최신 선택을 지킨다
    expect(existsSync(abs(RULE_FILE))).toBe(false);
    expect(readInstallLog(projectDir)?.excluded).toContain(RULE);

    const again = install().screen; // B — 플래그 없는 install 은 새 선택이다
    expect(existsSync(abs(RULE_FILE))).toBe(true);
    expect(readInstallLog(projectDir)?.excluded ?? []).not.toContain(RULE);
    expect(again).toContain(
      `↺ ${RULE} — dropped earlier, installed again: this install did not pass --without ${RULE}`,
    );
    const events = rawLog().selections ?? [];
    expect(events.map((e) => [e.by, e.without ?? [], e.with ?? []])).toEqual([
      ["install", [RULE], []],
      ["install", [], [RULE]],
    ]);
  });

  it("update 의 독자는 누적 기록(`excluded`)을 읽는다 — 마지막 설치의 플래그(spec.baselineExclude)에 없어도", () => {
    install();
    const log = rawLog();
    putRawLog({ ...log, spec: specWithoutFlag(log), excluded: [RULE] });
    rmSync(abs(RULE_FILE));

    update();

    expect(existsSync(abs(RULE_FILE))).toBe(false);
  });

  it("뺀 번들 스킬은 update 가 되살리지 않고 · 플래그 없는 install 이 다시 깐다", () => {
    const skill = "audit-harness-fit"; // tooling 이 기본으로 까는 번들 스킬
    install();
    expect(existsSync(abs(`.claude/skills/${skill}`))).toBe(true); // 전제
    install({ userOverride: { forceInclude: [], forceExclude: [skill] } });
    rmSync(abs(`.claude/skills/${skill}`), { recursive: true });

    update();
    expect(existsSync(abs(`.claude/skills/${skill}`))).toBe(false);

    install();
    expect(existsSync(abs(`.claude/skills/${skill}`))).toBe(true);
  });

  it("update 는 뺐지만 남은 룰을 새 판으로 바꾸지 않고 기준선도 다시 찍지 않는다 — 대조군 룰은 갱신된다", () => {
    install();
    install({ baselineExclude: [RULE] });
    // 두 룰을 '옛 판이 놓은 그대로' 로 만든다 — 디스크와 기록 sha 를 같은 옛 내용으로
    const OTHER_FILE = ".claude/rules/doc-governance.md";
    const old = "# old harness version\n";
    // 뺀 룰은 설치자가 고쳐 쓰고 있다 — 기록 sha(옛 판)와 다르다
    writeFileSync(abs(RULE_FILE), "# mine now\n");
    writeFileSync(abs(OTHER_FILE), old);
    const log = rawLog();
    putRawLog({
      ...log,
      policyFiles: (log.policyFiles ?? []).map((f) =>
        f.path === "rules/git-policy.md" || f.path === "rules/doc-governance.md"
          ? { ...f, sha256: hashContent(old) }
          : f,
      ),
    });

    update();

    expect(readFileSync(abs(RULE_FILE), "utf8")).toBe("# mine now\n"); // 뺀 것 — 갱신도 백업도 않는다
    expect(
      readdirSync(abs(".claude/rules")).filter((f) => f.startsWith("git-policy.md.backup-")),
    ).toEqual([]);
    expect(readFileSync(abs(OTHER_FILE), "utf8")).not.toBe(old); // 대조군 — 갱신된다
    const sha = (p: string) => readInstallLog(projectDir)?.policyFiles?.find((f) => f.path === p);
    // 앞 기록을 그대로 둔다 — 설치자 편집분을 "하네스 판" 으로 다시 찍지 않는다
    expect(sha("rules/git-policy.md")?.sha256).toBe(hashContent(old));
  });

  it("update 는 뺐지만 남은 번들 스킬을 새 판으로 바꾸지 않는다 — 대조군 스킬은 갱신된다", () => {
    const OUT = "audit-harness-fit";
    const KEEP = "self-hosted-github-runner";
    install();
    install({ userOverride: { forceInclude: [], forceExclude: [OUT] } });
    const old = "---\nname: old\n---\n";
    for (const id of [OUT, KEEP]) writeFileSync(abs(`.claude/skills/${id}/SKILL.md`), old);
    const log = rawLog();
    putRawLog({
      ...log,
      skillFiles: (log.skillFiles ?? []).map((f) =>
        f.path === `${OUT}/SKILL.md` || f.path === `${KEEP}/SKILL.md`
          ? { ...f, sha256: hashContent(old) }
          : f,
      ),
    });

    update();

    expect(readFileSync(abs(`.claude/skills/${OUT}/SKILL.md`), "utf8")).toBe(old);
    expect(readFileSync(abs(`.claude/skills/${KEEP}/SKILL.md`), "utf8")).not.toBe(old);
  });

  it("뺀 외부 스킬은 아직 있을 때만 'still installed' 로 말한다 — 지운 뒤에는 말하지 않는다 · update 머리글도 세지 않는다", () => {
    install();
    const log = rawLog();
    putRawLog({
      ...log,
      assets: [
        ...log.assets,
        {
          id: "frontend-design",
          category: "design",
          method: "skill",
          scope: "project",
          detail: {},
        },
      ],
      excluded: ["frontend-design"],
    });
    mkdirSync(abs(".claude/skills/frontend-design"), { recursive: true });
    const LINE =
      "frontend-design — excluded, so the harness no longer updates it (still installed)";
    // 리뷰 #693 NOTE-1 — 다시 관리하기 · 치우기 두 행동이 다 보인다 · update 도 같은 줄
    const both = `${LINE}. To manage it again: run install (without --without frontend-design; add --with frontend-design if it is opt-in) · remove it: agent-harness uninstall --only frontend-design`;
    const keep = { userOverride: { forceInclude: [], forceExclude: ["frontend-design"] } };
    expect(install(keep).screen).toContain(both);
    expect(updateScreen()).toContain(both);
    rmSync(abs(".claude/skills/frontend-design"), { recursive: true });
    expect(install(keep).screen).not.toContain(LINE);
    const header = buildUpdateSpec(projectDir, ["tooling"]);
    expect(header.userOverride?.forceExclude).toContain("frontend-design");
  });

  it("thisRunExclusions — R4 집합 안은 이번 입력으로 대체 · 밖은 이어받음 · 같은 spec 에 다시 걸어도 같다 · 양쪽이면 빼기", () => {
    install({ baselineExclude: [RULE] });
    const log = readInstallLog(projectDir);
    const accepts = (id: string) => id === RULE || id === "railway-skills";
    expect([...thisRunExclusions(spec(), log, accepts).excluded]).toEqual([]);
    expect([...thisRunExclusions(spec(), log, () => false).excluded]).toEqual([RULE]);
    const once = thisRunExclusions(spec({ baselineExclude: [RULE] }), log, accepts);
    const twice = thisRunExclusions(once.spec, log, accepts);
    expect([...twice.excluded]).toEqual([...once.excluded]);
    const both = thisRunExclusions(
      spec({
        userOverride: { forceInclude: ["railway-skills"], forceExclude: ["railway-skills"] },
      }),
      log,
      accepts,
    );
    expect(both.excluded.has("railway-skills")).toBe(true);
  });
});

describe("리뷰 #693 NOTE-2 · NOTE-3 — 키 빼기를 화면이 확인한다 · 뺐어도 디스크에 있으면 상주로 센다", () => {
  it("이번 --cli 밖 파일의 키 id 는 기록하고 '아직 적용 안 됨' 을 말한다 · 다음 update 가 걷고 그렇게 말한다", () => {
    install({ cli: ["claude", "codex"] });
    expect(readFileSync(abs(".codex/config.toml"), "utf8")).toContain("# uzys-harness:top:start");

    const { screen } = install({ cli: ["claude"], keyExclude: ["codex:top"] });

    expect(screen).toContain(
      "codex:top — excluded and recorded, not applied yet: this run did not touch .codex/config.toml",
    );
    expect(readFileSync(abs(".codex/config.toml"), "utf8")).toContain("# uzys-harness:top:start");
    expect(readInstallLog(projectDir)?.excluded).toContain("codex:top");

    const out = updateScreen();
    expect(readFileSync(abs(".codex/config.toml"), "utf8")).not.toContain("uzys-harness:top");
    expect(out).toContain("removed the harness part: codex:top (you asked: --without codex:top)");
  });

  it("이미 걷힌 키를 다시 --without 으로 주면 '아직 적용 안 됨' 이라 말하지 않는다 (리뷰 #693 B1)", () => {
    install({ cli: ["claude", "codex"], keyExclude: ["codex:top"] });
    expect(readFileSync(abs(".codex/config.toml"), "utf8")).not.toContain("uzys-harness:top");

    const { screen } = install({ cli: ["claude"], keyExclude: ["codex:top"] });

    expect(screen).not.toContain("not applied yet");
    expect(readInstallLog(projectDir)?.excluded).toContain("codex:top");
  });

  it("상주 비용은 뺐지만 디스크에 남은 룰을 센다 — install 머리글 · update 요약이 같은 판정", () => {
    install();
    install({ baselineExclude: [RULE] });
    const counted = (s: InstallSpec) => residentEntries(s).map((e) => e.target);
    expect(counted(spec({ baselineExclude: [RULE] }))).toContain(RULE_FILE);
    expect(counted(buildUpdateSpec(projectDir, ["tooling"]))).toContain(RULE_FILE);
    rmSync(abs(RULE_FILE));
    expect(counted(spec({ baselineExclude: [RULE] }))).not.toContain(RULE_FILE);
    expect(counted(buildUpdateSpec(projectDir, ["tooling"]))).not.toContain(RULE_FILE);
  });

  it("뺀 번들 스킬도 디스크에 남아 있으면 상주로 센다", () => {
    const skill = "audit-harness-fit";
    install();
    install({ userOverride: { forceInclude: [], forceExclude: [skill] } });
    const counted = () =>
      residentEntries(buildUpdateSpec(projectDir, ["tooling"])).map((e) => e.target);
    expect(counted().some((t) => t.startsWith(`.claude/skills/${skill}`))).toBe(true);
    rmSync(abs(`.claude/skills/${skill}`), { recursive: true });
    expect(counted().some((t) => t.startsWith(`.claude/skills/${skill}`))).toBe(false);
  });
});

describe("#566 — 뺀 외부 스킬은 update 가 되살리지도 갱신하지도 않는다", () => {
  const asset = {
    id: "frontend-design",
    category: "design",
    method: { kind: "skill", source: "anthropics/skills", skill: "frontend-design" },
  } as unknown as ExternalAsset;
  const logWith = (excluded: string[]): InstallLog => ({
    schemaVersion: 1,
    installedAt: "2026-10-04T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"], clis: ["claude"] },
    templates: {},
    assets: [
      { id: "frontend-design", category: "design", method: "skill", scope: "project", detail: {} },
    ],
    ...(excluded.length > 0 ? { excluded } : {}),
    excludedKeysMigrated: true,
  });

  it("excluded 에 있으면 다시 깔지 않는다 — 대조군: 없으면 다시 깐다", () => {
    const run = vi.fn(() => ({ attempted: [], succeeded: 0 }) as never);
    refreshExternalSkills(projectDir, {
      assets: [asset],
      readLog: () => logWith(["frontend-design"]),
      run,
    });
    expect(run).not.toHaveBeenCalled();
    refreshExternalSkills(projectDir, { assets: [asset], readLog: () => logWith([]), run });
    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe("R5 — 옛 판(26.162–26.163)이 굳힌 기록을 한 번 푼다", () => {
  const A_SKILL = INTERNAL_BUNDLED_SKILL_IDS.includes("model-orchestration")
    ? "model-orchestration"
    : (INTERNAL_BUNDLED_SKILL_IDS[0] ?? "");

  it("키 id 는 지우고 · baseline/번들 스킬은 마지막 설치의 플래그에 있는 것만 남기고 · 표시를 단다", () => {
    const legacy: InstallLog = {
      schemaVersion: 1,
      installedAt: "2026-10-01T00:00:00.000Z",
      scope: "project",
      spec: {
        tracks: ["tooling"],
        cli: ["claude"],
        baselineExclude: ["baseline:rules/test-policy"],
      },
      templates: {},
      assets: [],
      excluded: [
        "settings:hooks.SessionStart#session-start.sh", // #675 — 자동 추론
        "mcp:github",
        "agents-md:agents",
        "baseline:rules/git-policy", // 뺀 뒤 플래그 없이 다시 깔았다 — 마지막 선택은 "깔기"
        "baseline:rules/test-policy", // 마지막 설치도 뺐다 — 남는다
        A_SKILL, // 마지막 설치의 skillExclude 에 없다 — 다시 깐 것
        "frontend-design", // 카탈로그 · 기록에 깔린 적 없음(A1) — 모호하지 않다, 남는다
      ],
    };
    const { log, droppedKeys } = migrateExcluded(legacy);
    // 판정이 이력 한 항목으로 남는다(설계 selection-record §2.2)
    expect(log.selections?.map((e) => [e.by, e.released, e.kept])).toEqual([
      [
        "migration",
        [
          "settings:hooks.SessionStart#session-start.sh",
          "mcp:github",
          "agents-md:agents",
          "baseline:rules/git-policy",
          A_SKILL,
        ],
        undefined,
      ],
    ]);
    expect(droppedKeys).toEqual([
      "settings:hooks.SessionStart#session-start.sh",
      "mcp:github",
      "agents-md:agents",
      "baseline:rules/git-policy",
      A_SKILL,
    ]);
    expect(log.excluded).toEqual(["baseline:rules/test-policy", "frontend-design"]);
    expect(log.excludedKeysMigrated).toBe(true);
    // 표시가 있으면 다시 돌지 않는다 — 그 뒤 `--without <키 id>` 로 명시한 빼기를 지우지 않는다
    const explicit = { ...log, excluded: [...(log.excluded ?? []), "mcp:github"] };
    expect(migrateExcluded(explicit).log.excluded).toContain("mcp:github");
  });

  it("163 이 굳힌 하네스 서버를 이 판 install 1회가 되살리고 '↺ restored' 를 말한다 · 기록에 표시가 남는다", () => {
    install();
    // 26.163.0 이 남긴 모양 — 파일에서 사라졌고, 몫에서 빠졌고, excluded 에 키 id 가 적혔고, 표시가 없다
    const mcp = JSON.parse(readFileSync(abs(".mcp.json"), "utf8"));
    delete mcp.mcpServers.github;
    writeFileSync(abs(".mcp.json"), JSON.stringify(mcp, null, 2));
    const log = rawLog();
    const { excludedKeysMigrated: _m, ...unmarked } = log;
    putRawLog({
      ...unmarked,
      portions: (log.portions ?? []).filter((p) => p.key !== "mcpServers.github"),
      excluded: ["mcp:github"],
    });
    expect(legacyDroppedKeys(readInstallLog(projectDir))).toEqual(["mcp:github"]); // 전제

    const { report, screen } = install();

    expect(JSON.parse(readFileSync(abs(".mcp.json"), "utf8")).mcpServers.github).toBeDefined();
    expect(report.legacyRestored).toEqual(["mcp:github"]);
    expect(screen).toContain(
      "restored 1 harness part(s) an earlier version had marked as removed (mcp:github) — to drop one: install … --without <id> (kept out by update; a later install without that flag brings it back)",
    );
    expect(rawLog().excludedKeysMigrated).toBe(true);
    expect(rawLog().excluded ?? []).not.toContain("mcp:github");

    // 되살린 것이 없는 실행은 그 줄을 내지 않는다
    expect(install().screen).not.toContain("an earlier version had marked as removed");
  });
});

describe("V3 위저드 — 최신 선택을 미리 채우고, 아직 해제된 id 를 `--without` 으로 낸다", () => {
  function makePrompts(overrides: Partial<Prompts>): Prompts {
    return {
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      selectAction: vi.fn(async () => "update" as const),
      selectTracks: vi.fn(async (initial?: Track[]) => initial ?? (["tooling"] as Track[])),
      selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
      confirmInstall: vi.fn(async () => true),
      selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
      ...overrides,
    };
  }
  const detect = () => ({
    state: "existing" as const,
    tracks: ["tooling" as Track],
    source: "install-log" as const,
    hasClaudeDir: true,
  });
  /** 위저드가 고른 spec 을 cli.ts 와 같은 경로(`executeSpec`, fromWizard)로 돌린다 — 외부 단계는 끈다. */
  function runWizardSpec(s: InstallSpec, mode: InstallMode | undefined, fromWizard = true): void {
    executeSpec(s, {
      log: () => {},
      err: () => {},
      exit: (() => undefined) as unknown as (code: number) => never,
      fromWizard,
      ...(mode ? { mode } : {}),
      resolveHarnessRoot: () => HARNESS_ROOT,
      runPipeline: (sp, root, m, cb) =>
        runInstall({
          runExternal: null,
          harnessRoot: root,
          projectDir,
          spec: sp,
          ...(m ? { mode: m } : {}),
          ...(cb?.onProgress ? { onProgress: cb.onProgress } : {}),
        }),
    });
  }

  it("(a) 재체크 → RUNS AS 에 그 id 가 없다 · 설치 뒤 파일 존재 · 이력 {via: wizard, with}", async () => {
    install();
    install({ baselineExclude: [RULE] });
    rmSync(abs(RULE_FILE));

    const seenInitial: InstallTargetId[][] = [];
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(projectDir, {
      prompts: makePrompts({
        confirmInstall,
        selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => {
          seenInitial.push([...initial]);
          return [...initial, RULE as InstallTargetId];
        }),
      }),
      detect,
      isTty: () => true,
    });

    expect(seenInitial[0]).not.toContain(RULE); // 최신 선택을 미리 채워 보였다
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    const runsAs = summary.split("\n").find((l) => l.includes("RUNS AS")) ?? "";
    expect(runsAs).not.toContain(RULE);
    expect(result.mode).toBe("add");
    // biome-ignore lint/style/noNonNullAssertion: 위에서 add 확인
    runWizardSpec(result.spec!, result.mode);
    expect(existsSync(abs(RULE_FILE))).toBe(true);
    const last = rawLog().selections?.at(-1);
    expect(last).toMatchObject({ by: "install", via: "wizard", with: [RULE] });
  });

  it("(b) 그대로 두고 트랙을 더하면 RUNS AS 가 `--without` 을 이어 낸다(위저드에 안 보이는 키 id 포함) — 그 문자열로 친 결과와 기록이 같다", async () => {
    install();
    install({ baselineExclude: [RULE], keyExclude: ["mcp:github"] });
    const confirmInstall = vi.fn(async (_s: string) => true);
    const result = await runInteractive(projectDir, {
      prompts: makePrompts({
        confirmInstall,
        selectTracks: vi.fn(async () => ["tooling", "data"] as Track[]),
      }),
      detect,
      isTty: () => true,
    });
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    const runsAs = summary.split("\n").find((l) => l.includes("RUNS AS")) ?? "";
    expect(runsAs).toContain(`--without ${RULE}`);
    expect(runsAs).toContain("--without mcp:github");
    expect(result.mode).toBe("add");
    // biome-ignore lint/style/noNonNullAssertion: 위에서 add 확인
    runWizardSpec(result.spec!, result.mode);
    const viaWizard = rawLog().excluded;

    // 같은 명령을 비대화형으로 — 그 spec 을 플래그 경로로 돌린다
    const argv = runsAs.replace(/^.*RUNS AS\s+agent-harness\s+install\s+/, "").split(/\s+/);
    const options: InstallOptions = { projectDir };
    for (let i = 0; i < argv.length; i += 2) {
      const [flag, value] = [argv[i], argv[i + 1] ?? ""];
      if (flag === "--track") options.track = [...(options.track ?? []), value];
      if (flag === "--cli") options.cli = [...((options.cli as string[] | undefined) ?? []), value];
      if (flag === "--without") options.without = [...((options.without as string[]) ?? []), value];
      if (flag === "--scope") options.scope = value;
    }
    const flagSpec = installSpecFromOptions(options, ["claude"], () => {}, HARNESS_ROOT);
    runWizardSpec(flagSpec, "add", false);
    expect(rawLog().excluded).toEqual(viaWizard);
    expect(rawLog().excluded).toEqual(expect.arrayContaining([RULE, "mcp:github"]));
  });

  it("재체크하지 않으면 해제는 그대로고 엔진은 refresh 다 — 기록의 최신 선택이 기준", async () => {
    install();
    const log = rawLog();
    putRawLog({ ...log, spec: specWithoutFlag(log), excluded: [RULE] });
    const result = await runInteractive(projectDir, {
      prompts: makePrompts({}),
      detect,
      isTty: () => true,
    });
    expect(result.mode).toBe("update");
  });
});

/**
 * #600 × ADR-099 — 도중에 멈춘 install 의 중단 기록도 정상 기록과 **같은 규칙**의 `excluded` 를 쓴다: 옛 판 자동 추론분은
 * 풀리고(R5), 이번 `--without` 은 더해지고(누적), 손으로 지운 키는 들어가지 않는다(R1). 선택 입력(spec)도 같은 누적판이다.
 * 읽을 수 없는 `.codex/config.toml` 로 멈춘다 — root 는 권한을 무시하므로 재현이 안 된다.
 */
describe.skipIf(process.getuid?.() === 0)(
  "#600 중단 기록의 excluded 는 정상 경로와 같은 규칙",
  () => {
    it("163 모양 기록 위에서 멈춰도 — 자동 추론 키는 풀리고 · 선택은 이번 입력 · 이력에 interrupted", () => {
      install({ cli: ["claude", "codex"] });
      // 26.163.0 이 남긴 모양: github 서버를 손으로 지웠고 그것이 excluded 에 키 id 로 굳었다 · 표시 없음
      const mcp = JSON.parse(readFileSync(abs(".mcp.json"), "utf8"));
      delete mcp.mcpServers.github;
      writeFileSync(abs(".mcp.json"), JSON.stringify(mcp, null, 2));
      const log = rawLog();
      const { excludedKeysMigrated: _m, ...unmarked } = log;
      putRawLog({
        ...unmarked,
        spec: { ...log.spec, baselineExclude: [RULE] },
        portions: (log.portions ?? []).filter((p) => p.key !== "mcpServers.github"),
        excluded: ["mcp:github", RULE, "baseline:rules/doc-governance"],
      });
      const before = readInstallLog(projectDir);
      const input = spec({ cli: ["claude", "codex"], keyExclude: ["mcp:context7"] });
      const expected = thisRunExclusions(
        input,
        before,
        withoutAccepts(HARNESS_ROOT, input, before),
      );
      writeFileSync(abs(".codex/config.toml"), "ok = true\n");
      chmodSync(abs(".codex/config.toml"), 0);
      try {
        let stopped = false;
        try {
          install({ cli: ["claude", "codex"], keyExclude: ["mcp:context7"] });
        } catch (e) {
          stopped = (e as Error).name === "InstallInterruptedError";
        }
        expect(stopped).toBe(true); // 픽스처 자기검증 — 정말 멈췄다
      } finally {
        chmodSync(abs(".codex/config.toml"), 0o644);
      }

      const after = rawLog();
      expect([...(after.excluded ?? [])].sort()).toEqual([...expected.excluded].sort());
      // 설계 selection-record §3 — 선택은 입력에서 정해진다: 이번 실행이 뺀 것만(RULE 은 이번에 빼지 않았다)
      expect([...(after.excluded ?? [])].sort()).toEqual(["mcp:context7"]);
      expect(after.excludedKeysMigrated).toBe(true);
      expect(after.selections?.at(-1)).toMatchObject({
        by: "install",
        without: ["mcp:context7"],
        with: [RULE],
        interrupted: true,
      });
      expect(after.spec.baselineExclude).toEqual(expected.spec.baselineExclude);
      // R1 — 손으로 지웠던 github 는 되돌아왔고 빼기로 적히지 않았다 · 이번에 뺀 context7 은 걷혔다
      const servers = JSON.parse(readFileSync(abs(".mcp.json"), "utf8")).mcpServers;
      expect(servers.github).toBeDefined();
      expect(servers.context7).toBeUndefined();
    });
  },
);

/** 설계 selection-record §5 V4–V8. */
describe("선택 기록 — 대체 범위 · opt-in · 효과분 · 옛 기록 판정 · 상한 · list", () => {
  it("V4 — 플래그 없는 `install --cli claude` 는 깔린 codex 의 키 빼기도 푼다(R4 집합) · 화면이 미리 말하고 다음 update 가 되돌린다", () => {
    install({ cli: ["claude", "codex"], keyExclude: ["codex:top"], baselineExclude: [RULE] });
    expect(readFileSync(abs(".codex/config.toml"), "utf8")).not.toContain("uzys-harness:top");
    expect([...(rawLog().excluded ?? [])].sort()).toEqual([RULE, "codex:top"].sort());

    const { screen } = install({ cli: ["claude"] });

    expect(rawLog().excluded ?? []).toEqual([]);
    expect(screen).toContain(
      "↺ codex:top — no longer excluded: the next update puts it back (this install did not pass --without codex:top)",
    );
    update();
    expect(readFileSync(abs(".codex/config.toml"), "utf8")).toContain("# uzys-harness:top:start");
  });

  it("V4 변종 — 이번 트랙에 없는 트랙의 baseline 빼기는 이어받는다(말할 수 없었던 것은 선택이 아니다)", () => {
    const data = new Set(listBaselineTargets({ tracks: ["data"] }).map((t) => t.id));
    const toolingOnly = listBaselineTargets({ tracks: ["tooling"] }).find((t) => !data.has(t.id));
    if (toolingOnly === undefined)
      throw new Error("픽스처 자기검증 — tooling 전용 baseline 이 없다");
    install({ baselineExclude: [toolingOnly.id, RULE] });
    install({ tracks: ["data"] });
    expect(rawLog().excluded).toEqual([toolingOnly.id]); // RULE(공통 룰)은 data 도 받으므로 풀렸다
  });

  it("V5 — opt-in 을 `--with` 로 깔고 `--without` 한 뒤 플래그 없는 install: 빼기가 풀리고(↺ 변형) update 가 다시 관리한다", () => {
    const X = "model-orchestration"; // tooling 기본 밖(opt-in) 번들 스킬
    install({ userOverride: { forceInclude: [X], forceExclude: [] } });
    install({ userOverride: { forceInclude: [], forceExclude: [X] } });
    expect(rawLog().excluded).toEqual([X]);

    const { screen } = install();
    expect(rawLog().excluded ?? []).toEqual([]);
    expect(screen).toContain(
      `↺ ${X} — no longer excluded: update keeps it current again (this install did not pass --without ${X})`,
    );
    // update 가 관리한다 — 옛 판인 척한 파일이 새 판으로 바뀐다
    const old = "---\nname: old\n---\n";
    writeFileSync(abs(`.claude/skills/${X}/SKILL.md`), old);
    const log = rawLog();
    putRawLog({
      ...log,
      skillFiles: (log.skillFiles ?? []).map((f) =>
        f.path === `${X}/SKILL.md` ? { ...f, sha256: hashContent(old) } : f,
      ),
    });
    update();
    expect(readFileSync(abs(`.claude/skills/${X}/SKILL.md`), "utf8")).not.toBe(old);
  });

  it("V6 — 이력은 효과분만: 같은 선택의 재설치 · update 는 늘리지 않는다", () => {
    install({ baselineExclude: [RULE] });
    const n = rawLog().selections?.length ?? 0;
    expect(n).toBe(1);
    install({ baselineExclude: [RULE] });
    update();
    expect(rawLog().selections?.length).toBe(n);
  });

  describe("V7 — 옛 기록의 모호한 카탈로그(assets ∩ excluded)는 폴더 · mtime 창으로 1회 판정한다", () => {
    const FD = "frontend-design";
    const T = Date.parse("2026-10-01T00:00:00.000Z");
    const legacy = (): InstallLog => ({
      schemaVersion: 1,
      installedAt: new Date(T).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: {},
      assets: [{ id: FD, category: "design", method: "skill", scope: "project", detail: {} }],
      excluded: [FD],
    });
    const folderAt = (mtime: number | null): void => {
      if (mtime === null) return;
      const file = abs(`.claude/skills/${FD}/SKILL.md`);
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, "---\nname: frontend-design\n---\n");
      utimesSync(file, mtime / 1000, mtime / 1000);
    };
    const judged = (mtime: number | null) => {
      folderAt(mtime);
      putRawLog(legacy());
      const log = readInstallLog(projectDir);
      return {
        log,
        excluded: log?.excluded ?? [],
        event: log?.selections?.at(-1),
        released: legacyReleasedCatalog(log),
      };
    };

    it("(1) 폴더 없음 → 뺀 채(kept)", () => {
      const r = judged(null);
      expect(r.excluded).toEqual([FD]);
      expect(r.event).toMatchObject({ by: "migration", kept: [FD] });
    });

    it("(2) 마지막 install 직전 창 안 → 푼다(released) · update 가 다시 갱신하고 화면이 말한다", () => {
      const r = judged(T - 30_000);
      expect(r.excluded).toEqual([]);
      expect(r.event).toMatchObject({ by: "migration", released: [FD] });
      expect(r.released).toEqual([FD]);
      const refreshSkills = vi.fn(() => ({
        attempted: 0,
        refreshed: 0,
        failed: [],
        notInCatalog: [],
        unknown: false,
      }));
      const report = runUpdateMode(projectDir, join(HARNESS_ROOT, "templates"), HARNESS_ROOT, {
        refreshSkills,
      });
      expect(report.legacyReleasedCatalog).toEqual([FD]);
      expect(legacyReleasedCatalogRows([FD]).join("")).toContain(
        "frontend-design — released: the last install re-added it (26.162–26.163 record)",
      );
      expect(readInstallLog(projectDir)?.excluded ?? []).toEqual([]); // 기록에 남았다(표시 · 이력과 함께)
      expect(rawLog().selections?.[0]).toMatchObject({ by: "migration", released: [FD] });
    });

    it("(3) 창보다 이르다 → 마지막 install 은 안 썼다 → 뺀 채", () => {
      const r = judged(T - 3_600_000);
      expect(r.excluded).toEqual([FD]);
      expect(r.event).toMatchObject({ kept: [FD] });
    });

    it("(4) installedAt 뒤에 다시 써졌다 → 근거 없음 → 뺀 채 · 화면이 다시 관리하는 길을 말한다", () => {
      const r = judged(T + 3_600_000);
      expect(r.excluded).toEqual([FD]);
      expect(r.event).toMatchObject({ kept: [FD] });
      const still = excludedStillThereRows(
        excludedStillThere(projectDir, new Set(r.excluded), [], r.log),
      ).join("\n");
      expect(still).toContain(
        "frontend-design — excluded, so the harness no longer updates it (still installed). To manage it again: run install (without --without frontend-design",
      );
    });

    it("창 경계는 양끝 포함 — mtime = installedAt · installedAt − 창 은 푼다, 그 바깥 1 초는 뺀 채 (리뷰 #693 NOTE)", () => {
      expect(judged(T).excluded).toEqual([]);
      expect(judged(T - LEGACY_REINSTALL_WINDOW_MS).excluded).toEqual([]);
      expect(judged(T + 1_000).excluded).toEqual([FD]);
      expect(judged(T - LEGACY_REINSTALL_WINDOW_MS - 1_000).excluded).toEqual([FD]);
    });
  });

  it("V8 — 이력은 최근 100개 · list 의 Selections 절이 `--without` 과 `re-added` 를 말한다", () => {
    let log: InstallLog = {
      schemaVersion: 1,
      installedAt: "2026-10-04T00:00:00.000Z",
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: {},
      assets: [],
    };
    for (let i = 0; i < SELECTIONS_MAX + 1; i += 1) {
      log = appendSelection(log, {
        at: `2026-10-04T00:00:${String(i % 60).padStart(2, "0")}.000Z`,
        harness: "test",
        by: "install",
        without: [`id-${i}`],
      });
    }
    expect(log.selections).toHaveLength(SELECTIONS_MAX);
    expect(log.selections?.[0]?.without).toEqual(["id-1"]); // 가장 오래된 것이 떨어졌다
    expect(appendSelection(log, { at: "x", harness: "t", by: "install" })).toBe(log); // 효과분 없음

    install({ baselineExclude: [RULE] });
    install();
    const out: string[] = [];
    listAction(
      { projectDir },
      { log: (m) => out.push(m), err: () => {}, exit: (() => undefined) as never },
    );
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
    const text = out.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(text).toContain("Selections");
    expect(text).toContain(`install --without ${RULE}`);
    expect(text).toContain(`install re-added ${RULE}`);
  });
});

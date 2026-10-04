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
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import { type ExternalAsset, INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { refreshExternalSkills } from "../src/external-installer.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  legacyDroppedKeys,
  migrateExcluded,
  readInstallLog,
} from "../src/install-log.js";
import { withRecordedExclusions } from "../src/install-writes.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import { runInteractive } from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import type { CliTargets, InstallSpec, Track } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

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
  it("`--without baseline:…` 뒤 플래그 없는 install · update 가 그 룰을 깔지 않는다 · `--with` 로만 돌아온다", () => {
    install();
    expect(existsSync(abs(RULE_FILE))).toBe(true); // 전제

    const { screen } = install({ baselineExclude: [RULE] });
    // 이미 깔린 것은 지우지 않고, 화면이 그 사실과 할 일을 말한다
    expect(existsSync(abs(RULE_FILE))).toBe(true);
    expect(screen).toContain(
      `${RULE} — excluded (still on disk — an earlier install put it there; the harness does not delete it. Remove the file yourself, or run uninstall)`,
    );
    expect(screen).not.toContain(`uninstall --only ${RULE}`);

    rmSync(abs(RULE_FILE));
    install(); // 플래그 없는 재설치 — 누적 빼기를 지킨다
    expect(existsSync(abs(RULE_FILE))).toBe(false);
    update();
    expect(existsSync(abs(RULE_FILE))).toBe(false);
    expect(readInstallLog(projectDir)?.excluded).toContain(RULE);

    install({ releaseExclude: [RULE] });
    expect(existsSync(abs(RULE_FILE))).toBe(true);
    expect(readInstallLog(projectDir)?.excluded ?? []).not.toContain(RULE);
  });

  it("update 의 독자는 누적 기록(`excluded`)을 읽는다 — 마지막 설치의 플래그(spec.baselineExclude)에 없어도", () => {
    install();
    const log = rawLog();
    putRawLog({ ...log, spec: specWithoutFlag(log), excluded: [RULE] });
    rmSync(abs(RULE_FILE));

    update();

    expect(existsSync(abs(RULE_FILE))).toBe(false);
  });

  it("뺀 번들 스킬은 플래그 없는 install 이 깔지 않는다 · 카탈로그 id 를 `--with` 로 풀면 돌아온다", () => {
    const skill = "audit-harness-fit"; // tooling 이 기본으로 까는 번들 스킬
    install();
    expect(existsSync(abs(`.claude/skills/${skill}`))).toBe(true); // 전제
    install({ userOverride: { forceInclude: [], forceExclude: [skill] } });
    rmSync(abs(`.claude/skills/${skill}`), { recursive: true });

    install();
    update();
    expect(existsSync(abs(`.claude/skills/${skill}`))).toBe(false);

    install({ userOverride: { forceInclude: [skill], forceExclude: [] } });
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
    const LINE = "frontend-design — excluded (still installed";
    expect(install().screen).toContain(
      `${LINE} — an earlier install put it there; the harness does not remove it. Remove it with: agent-harness uninstall --only frontend-design)`,
    );
    rmSync(abs(".claude/skills/frontend-design"), { recursive: true });
    expect(install().screen).not.toContain(LINE);
    const header = buildUpdateSpec(projectDir, ["tooling"]);
    expect(header.userOverride?.forceExclude).toContain("frontend-design");
  });

  it("withRecordedExclusions 는 같은 spec 에 다시 걸어도 같다 · 같은 id 가 양쪽이면 빼기가 이긴다", () => {
    install({ baselineExclude: [RULE] });
    const log = readInstallLog(projectDir);
    const once = withRecordedExclusions(spec(), log);
    const twice = withRecordedExclusions(once.spec, log);
    expect([...twice.excluded].sort()).toEqual([...once.excluded].sort());
    expect(once.spec.baselineExclude).toEqual([RULE]);
    const both = withRecordedExclusions(
      spec({
        userOverride: { forceInclude: ["railway-skills"], forceExclude: ["railway-skills"] },
      }),
      log,
    );
    expect(both.excluded.has("railway-skills")).toBe(true);
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
        "frontend-design", // 카탈로그 — 이 판은 손대지 않는다(보고의 결정 대기)
      ],
    };
    const { log, droppedKeys } = migrateExcluded(legacy);
    expect(droppedKeys).toEqual([
      "settings:hooks.SessionStart#session-start.sh",
      "mcp:github",
      "agents-md:agents",
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
      "restored 1 harness part(s) an earlier version had marked as removed (mcp:github) — to drop one for good: install … --without <id>",
    );
    expect(rawLog().excludedKeysMigrated).toBe(true);
    expect(rawLog().excluded ?? []).not.toContain("mcp:github");

    // 되살린 것이 없는 실행은 그 줄을 내지 않는다
    expect(install().screen).not.toContain("an earlier version had marked as removed");
  });
});

describe("R3 — 위저드 재체크는 `--with <id>` 로 낸다", () => {
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

  it("전에 `--without baseline:rules/x` 한 기록에서 x 를 재체크 → 확인 화면에 `--with` · 설치 뒤 파일 존재", async () => {
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
      detect: () => ({
        state: "existing",
        tracks: ["tooling"],
        source: "install-log",
        hasClaudeDir: true,
      }),
      isTty: () => true,
    });

    // 해제된 채로 보였다(누적 기록)
    expect(seenInitial[0]).not.toContain(RULE);
    const summary = confirmInstall.mock.calls[0]?.[0] ?? "";
    expect(summary).toMatch(new RegExp(`RUNS AS .*--with ${RULE}`));
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("add");
    expect(result.spec?.releaseExclude).toEqual([RULE]);

    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      // biome-ignore lint/style/noNonNullAssertion: 위에서 ok 확인
      spec: result.spec!,
      mode: "add",
    });
    expect(existsSync(abs(RULE_FILE))).toBe(true);
  });

  it("재체크하지 않으면 해제는 그대로고 엔진은 refresh 다 — 누적 기록이 기준", async () => {
    install();
    // 빼기가 누적 기록(`excluded`)에만 있다 — 마지막 설치의 플래그(spec.baselineExclude)에는 없다
    const log = rawLog();
    putRawLog({ ...log, spec: specWithoutFlag(log), excluded: [RULE] });
    const result = await runInteractive(projectDir, {
      prompts: makePrompts({}),
      detect: () => ({
        state: "existing",
        tracks: ["tooling"],
        source: "install-log",
        hasClaudeDir: true,
      }),
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
    it("163 모양 기록 위에서 멈춰도 — 자동 추론 키는 풀리고 · 이번 --without 은 더해지고 · 누적 빼기는 남는다", () => {
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
      const expected = withRecordedExclusions(
        spec({ cli: ["claude", "codex"], keyExclude: ["mcp:context7"] }),
        readInstallLog(projectDir),
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
      expect([...(after.excluded ?? [])].sort()).toEqual(["mcp:context7", RULE].sort());
      expect(after.excludedKeysMigrated).toBe(true);
      expect(after.spec.baselineExclude).toEqual(expected.spec.baselineExclude);
      // R1 — 손으로 지웠던 github 는 되돌아왔고 빼기로 적히지 않았다 · 이번에 뺀 context7 은 걷혔다
      const servers = JSON.parse(readFileSync(abs(".mcp.json"), "utf8")).mcpServers;
      expect(servers.github).toBeDefined();
      expect(servers.context7).toBeUndefined();
    });
  },
);

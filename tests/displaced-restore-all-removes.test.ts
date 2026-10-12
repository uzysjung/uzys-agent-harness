/**
 * #782 (ADR-097 결정 3 의 나머지 반) — 하네스가 자리를 떠나는 **모든** remove 가 같은 함수(`src/displaced.ts`)로 설치자
 * 원본을 제자리에 되돌린다. uninstall(전량 · `--cli`)은 `uninstall-file-unit.test.ts` 가 본다 — 여기는 그 밖의 자리다:
 *   ① update 의 은퇴 회수(`pruneOrphans`)
 *   ② update 의 트랙 밖 룰 회수(`reclaimOutOfTrackRecorded`)
 *   ③ update 의 옛 Antigravity 앵커 은퇴(`refreshExternalCli`)
 *   ④ install `--reinstall` 의 트랙 밖 룰 회수 · 옛 앵커 은퇴(`installer.ts`)
 * 각 자리에서: 원본 바이트 그대로 제자리 · 백업 파일 없음(rename) · 기록의 displaced 항목 없음 · 화면 한 줄.
 *
 * displaced 기록은 **지금 판의 install 이 만든 것**을 쓴다(같은 이름의 설치자 파일 위에 깔면 백업 + displaced). 은퇴 · 트랙
 * 밖 · 옛 앵커는 "다음 릴리즈" 나 옛 판 기록의 모양이라 기록 · 번들을 손으로 바꿔 흉내 낸다.
 */

import {
  cpSync,
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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInstallRenderer,
  displacedRows,
  renderUpdateSummary,
} from "../src/commands/install-render.js";
import { restoreDisplaced, withoutRestored } from "../src/displaced.js";
import {
  hashContent,
  type InstallLog,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { type InstallMode, type InstallReport, runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const MINE = "# my own team rule — not the harness one\n\n- keep this byte for byte\n";

let projectDir = "";
let scratch = "";

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ah-782-project-"));
  scratch = mkdtempSync(join(tmpdir(), "ah-782-bundle-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

const spec = (tracks: Track[], cli: CliBase[]): InstallSpec => ({
  tracks,
  options: { withCodexTrust: false },
  cli,
  projectDir,
});

/** 실행 1회 — 보고와 색을 벗긴 화면(install 은 Phase 1 행 · update 는 요약까지). */
function run(
  mode: InstallMode,
  tracks: Track[],
  cli: CliBase[],
  harnessRoot = HARNESS_ROOT,
): { report: InstallReport; screen: string } {
  const lines: string[] = [];
  const s = spec(tracks, cli);
  const renderer = createInstallRenderer((m) => lines.push(m), s, false);
  const report = runInstall({
    runExternal: null,
    harnessRoot,
    projectDir,
    spec: s,
    mode,
    onProgress: (event) => renderer.callbacks.onProgress?.(event),
  });
  if (mode === "update") renderUpdateSummary((m) => lines.push(m), s, report);
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
  const screen = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  return { report, screen };
}

const log = (): InstallLog => readInstallLog(projectDir) as InstallLog;
const read = (rel: string): string => readFileSync(join(projectDir, rel), "utf8");
const backupsOf = (rel: string): string[] => {
  const dir = join(projectDir, dirname(rel));
  const name = rel.slice(rel.lastIndexOf("/") + 1);
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith(`${name}.backup-`)) : [];
};
const displacedAt = (rel: string) =>
  (log().rootFiles ?? []).filter((f) => f.path === rel && f.change === "displaced");

/** 같은 이름의 설치자 파일을 둔 뒤 지금 판으로 깐다 — 그 자리는 백업 + `displaced`(전제를 단언한다). */
function installOverMine(rel: string, tracks: Track[], cli: CliBase[]): void {
  mkdirSync(join(projectDir, dirname(rel)), { recursive: true });
  writeFileSync(join(projectDir, rel), MINE);
  run("add", tracks, cli);
  expect(read(rel), "전제 — 하네스 판이 자리를 잡았다").not.toBe(MINE);
  const [entry, ...more] = displacedAt(rel);
  expect(more, "전제 — displaced 1건").toEqual([]);
  expect(entry?.notes, "전제 — 백업 경로가 기록에 있다").toHaveLength(1);
  expect(read(entry?.notes[0] ?? ""), "전제 — 백업이 원본 바이트").toBe(MINE);
}

/** 되돌림의 판정 — 원본 바이트 그대로 제자리 · 백업 파일 없음 · 기록의 displaced 없음. */
function expectPutBack(rel: string): void {
  expect(read(rel)).toBe(MINE);
  expect(backupsOf(rel)).toEqual([]);
  expect(displacedAt(rel)).toEqual([]);
}

describe("#782 — update 의 은퇴 회수가 떠난 자리에 설치자 원본을 되돌린다", () => {
  const RULE = ".claude/rules/git-policy.md";

  /** 그 룰이 빠진 "다음 릴리즈" — 번들을 임시 폴더에 복사하고 그 룰만 지운다(템플릿 외 렌더 소스는 그 폴더 안에 있다). */
  function nextReleaseWithout(name: string): string {
    cpSync(join(HARNESS_ROOT, "templates"), join(scratch, "templates"), { recursive: true });
    rmSync(join(scratch, "templates/rules", name));
    return scratch;
  }

  it("① 룰이 은퇴하면 update 가 하네스 판을 지우고 원본을 제자리로 · 기준선 재기록은 남는다 · 화면 put back", () => {
    installOverMine(RULE, ["tooling"], ["claude"]);
    const root = nextReleaseWithout("git-policy.md");

    const { report, screen } = run("update", ["tooling"], ["claude"], root);

    expectPutBack(RULE);
    expect(report.updateMode?.pruned[".claude/rules"]).toContain("git-policy.md");
    expect(report.updateMode?.displacedRestored?.map((d) => [d.path, d.verdict])).toEqual([
      [RULE, "restore"],
    ]);
    // N13-4 — 기록 정리는 그 사이 `refreshPolicyBaseline` 이 다시 쓴 기록 위에 한다(실행 시작 때 읽은 기록으로 덮지 않는다)
    const policy = (log().policyFiles ?? []).map((f) => f.path);
    expect(policy).not.toContain("rules/git-policy.md");
    expect(policy).toContain("rules/test-policy.md");
    expect(screen).toMatch(
      /\.claude\/rules\/git-policy\.md\s+yours — put back \(from \.claude\/rules\/git-policy\.md\.backup-\d{8}T\d{6}\)/,
    );
  });
});

describe("#782 — 트랙 밖 룰 회수가 떠난 자리에 설치자 원본을 되돌린다(update · --reinstall)", () => {
  const RULE = ".agents/rules/cli-development.md";

  /** tooling 으로 깐 Antigravity 룰 자리를 #601 이전 판 기록처럼 — 기록 트랙만 그 룰이 없는 data 로 바꾼다. */
  function leakedOverMine(): void {
    installOverMine(RULE, ["tooling"], ["antigravity"]);
    const current = log();
    writeInstallLog(projectDir, { ...current, spec: { ...current.spec, tracks: ["data"] } });
  }

  it("② update — 기록 트랙 밖이라 치운 뒤 원본을 제자리로 · 화면 put back", () => {
    leakedOverMine();

    const { report, screen } = run("update", ["data"], ["antigravity"]);

    expectPutBack(RULE);
    expect(report.updateMode?.outOfTrack?.removed).toEqual([RULE]);
    expect((log().externalFiles ?? []).map((f) => f.path)).not.toContain(RULE);
    expect(screen).toMatch(/\.agents\/rules\/cli-development\.md\s+yours — put back \(from /);
  });

  it("④ install --reinstall --track data — 같은 자리를 치운 뒤 원본을 제자리로 · Phase 1 화면 put back", () => {
    leakedOverMine();

    const { report, screen } = run("reinstall", ["data"], ["antigravity"]);

    expectPutBack(RULE);
    expect(report.outOfTrack?.removed).toEqual([RULE]);
    expect(report.displacedRestored?.map((d) => d.verdict)).toEqual(["restore"]);
    expect(screen).toMatch(/\.agents\/rules\/cli-development\.md\s+yours — put back \(from /);
  });
});

describe("#782 — 옛 Antigravity 앵커 은퇴가 떠난 자리에 설치자 원본을 되돌린다(update · --reinstall)", () => {
  const ANCHOR = ".agents/rules/uzys-harness.md";
  const BACKUP = `${ANCHOR}.backup-20261001T000000`;

  /**
   * 26.164.0 이하 판이 같은 이름의 설치자 파일 위에 앵커를 쓴 모양 — 앵커가 기록 sha 와 함께 있고, 설치자 원본은 백업으로
   * 비켜 두고 `displaced` 로 적었다. 앵커 본문은 Project Context 가 없어 옮길 것이 없다(은퇴 판정만 본다).
   */
  function legacyAnchorOverMine(): void {
    run("add", ["tooling"], ["antigravity"]);
    const anchor = "# legacy harness anchor\n\nharness text\n";
    writeFileSync(join(projectDir, ANCHOR), anchor);
    writeFileSync(join(projectDir, BACKUP), MINE);
    const current = log();
    writeInstallLog(projectDir, {
      ...current,
      externalFiles: [
        ...(current.externalFiles ?? []).filter((f) => f.path !== ANCHOR),
        { path: ANCHOR, sha256: hashContent(anchor) },
      ],
      rootFiles: [
        ...(current.rootFiles ?? []),
        { path: ANCHOR, change: "displaced", notes: [BACKUP] },
      ],
    });
  }

  it("③ update — 앵커를 은퇴시킨 뒤 원본을 제자리로 · 기록의 앵커 · displaced 모두 빠진다 · 화면 put back", () => {
    legacyAnchorOverMine();

    const { report, screen } = run("update", ["tooling"], ["antigravity"]);

    expect(report.updateMode?.anchorRetired?.action).toBe("removed");
    expectPutBack(ANCHOR);
    expect((log().externalFiles ?? []).map((f) => f.path)).not.toContain(ANCHOR);
    expect(screen).toMatch(
      /\.agents\/rules\/uzys-harness\.md\s+yours — put back \(from \.agents\/rules\/uzys-harness\.md\.backup-20261001T000000\)/,
    );
  });

  it("④′ install --reinstall — 같은 은퇴 뒤 원본을 제자리로", () => {
    legacyAnchorOverMine();

    const { report } = run("reinstall", ["tooling"], ["antigravity"]);

    expect(report.anchorRetired?.action).toBe("removed");
    expectPutBack(ANCHOR);
  });

  it("⑤ 백업이 사라졌으면 되돌리지 않고 말한다 · 되풀이하지 않게 기록은 뺀다", () => {
    legacyAnchorOverMine();
    rmSync(join(projectDir, BACKUP));

    const { report, screen } = run("update", ["tooling"], ["antigravity"]);

    expect(existsSync(join(projectDir, ANCHOR))).toBe(false);
    expect(report.updateMode?.displacedRestored?.map((d) => d.verdict)).toEqual(["advise"]);
    expect(displacedAt(ANCHOR)).toEqual([]);
    expect(screen).toContain(
      "could not put back your earlier file — its backup is no longer there",
    );
  });
});

describe("#782 — 되돌리기 함수 하나의 판정(자리가 막힘 · 범위 밖)", () => {
  const SLOT = ".claude/rules/team.md";
  const BACKUP = `${SLOT}.backup-20261001T000000`;
  const fixture = (): InstallLog => {
    mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
    writeFileSync(join(projectDir, BACKUP), MINE);
    return {
      rootFiles: [
        { path: SLOT, change: "displaced", notes: [BACKUP] },
        { path: ".mcp.json", change: "modified", notes: [] },
      ],
    } as unknown as InstallLog;
  };

  it("자리가 막혔으면 advise · 기록은 남긴다(다음 회수가 다시 본다) · 백업은 그대로", () => {
    const l = fixture();
    writeFileSync(join(projectDir, SLOT), "something else\n");

    const outcomes = restoreDisplaced(l, projectDir, { has: () => true, write: true });

    expect(outcomes.map((d) => [d.verdict, d.forget])).toEqual([["advise", false]]);
    expect(read(SLOT)).toBe("something else\n");
    expect(read(BACKUP)).toBe(MINE);
    expect(withoutRestored(l.rootFiles, outcomes).map((f) => f.path)).toEqual([SLOT, ".mcp.json"]);
    expect(displacedRows(outcomes).join("\n")).toContain("not put back — the spot is taken");
  });

  it("범위(has) 밖이면 건드리지 않는다 · write=false 면 판정만 한다", () => {
    const l = fixture();
    expect(restoreDisplaced(l, projectDir, { has: () => false, write: true })).toEqual([]);
    const preview = restoreDisplaced(l, projectDir, { has: () => true, write: false });
    expect(preview.map((d) => d.verdict)).toEqual(["restore"]);
    expect(existsSync(join(projectDir, SLOT))).toBe(false);
    expect(read(BACKUP)).toBe(MINE);
    // 되돌린 것만 빠지고 다른 rootFiles 항목은 남는다
    expect(withoutRestored(l.rootFiles, preview).map((f) => f.path)).toEqual([".mcp.json"]);
  });
});

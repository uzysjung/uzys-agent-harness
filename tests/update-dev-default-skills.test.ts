/**
 * #726 (ADR-105) — model-orchestration · external-model-consult · natural-korean 이 개발 트랙 기본이 됐다. 이 판보다
 * 앞선 설치본(그 세 스킬이 opt-in 이라 안 깔렸던 것)은 `update` 한 번으로 세 스킬을 받는다 — 새 규칙이 아니라 #480 ①
 * (`.claude/skills/` — `installNewSkillDirs`) · #530 S3(`.agents/skills/` — `agents-skill-targets`)의 기존 경로다. 둘 다
 * 누적 `excluded` 를 지킨다(ADR-099 R3). executive 계열 기록은 받지 않는다.
 *
 * "옛 판 설치본" 재현 = 지금 판으로 깐 뒤 세 스킬 디렉터리를 지우고 **기준선(skillFiles · externalFiles)에서도 뺀다**
 * (`agents-skills-slot.test.ts` 의 `pretendNewInThisRelease` 와 같은 논리). 기준선에 남기면 "깔았는데 사용자가 지웠다"가
 * 되어 되살림(`restored`) 경로를 재게 된다.
 */

import {
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
import { createInstallRenderer, renderUpdateSummary } from "../src/commands/install-render.js";
import {
  type InstallLog,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import { type InstallReport, runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const THREE = ["model-orchestration", "external-model-consult", "natural-korean"] as const;

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "update-dev-default-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function spec(tracks: Track[], cli: CliTargets, forceExclude: string[] = []): InstallSpec {
  return {
    tracks,
    options: { withCodexTrust: false },
    cli,
    projectDir,
    ...(forceExclude.length > 0 ? { userOverride: { forceInclude: [], forceExclude } } : {}),
  };
}

function run(mode: "add" | "update", s: InstallSpec): InstallReport {
  return runInstall({ harnessRoot: HARNESS_ROOT, projectDir, spec: s, mode, runExternal: null });
}

/** 주어진 스킬이 없던 옛 판 설치본처럼 만든다 — 디스크와 기준선 양쪽에서 뺀다. */
function pretendOlderRelease(ids: ReadonlyArray<string> = THREE): void {
  for (const id of ids) {
    for (const slot of [".claude/skills", ".agents/skills"]) {
      rmSync(join(projectDir, slot, id), { recursive: true, force: true });
    }
  }
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  const ours = (p: string): boolean =>
    ids.some((id) => p.startsWith(`${id}/`) || p.startsWith(`.agents/skills/${id}/`) || p === id);
  writeInstallLog(projectDir, {
    ...log,
    ...(log.skillFiles ? { skillFiles: log.skillFiles.filter((f) => !ours(f.path)) } : {}),
    ...(log.externalFiles ? { externalFiles: log.externalFiles.filter((f) => !ours(f.path)) } : {}),
  });
}

const added = (r: InstallReport): string[] => [
  ...(r.updateMode?.installedNew ?? []),
  ...(r.updateMode?.installedForTracks ?? []).map((e) => e.path),
];

describe("#726 — 개발 트랙 기존 설치본은 update 로 세 스킬을 받는다(두 자리 모두)", () => {
  it("tooling · claude + codex: .claude/skills 와 .agents/skills 양쪽에 세 스킬이 새로 깔린다", () => {
    run("add", spec(["tooling"], ["claude", "codex"]));
    pretendOlderRelease();
    for (const id of THREE) expect(existsSync(join(projectDir, ".claude/skills", id))).toBe(false);

    const report = run("update", spec(["tooling"], ["claude", "codex"]));
    for (const id of THREE) {
      expect(existsSync(join(projectDir, ".claude/skills", id, "SKILL.md")), id).toBe(true);
      expect(existsSync(join(projectDir, ".agents/skills", id, "SKILL.md")), id).toBe(true);
      expect(added(report), id).toEqual(
        expect.arrayContaining([`.claude/skills/${id}`, `.agents/skills/${id}`]),
      );
    }
  });

  it("codex 단독 설치본도 .agents/skills 에 받는다 (Claude 밖 CLI 의 비대칭은 없다)", () => {
    run("add", spec(["tooling"], ["codex"]));
    pretendOlderRelease();
    run("update", spec(["tooling"], ["codex"]));
    for (const id of THREE) {
      expect(existsSync(join(projectDir, ".agents/skills", id, "SKILL.md")), id).toBe(true);
    }
    expect(existsSync(join(projectDir, ".claude"))).toBe(false);
  });

  it("executive 기록은 받지 않는다", () => {
    run("add", spec(["executive"], ["claude", "codex"]));
    const report = run("update", spec(["executive"], ["claude", "codex"]));
    for (const id of THREE) {
      expect(existsSync(join(projectDir, ".claude/skills", id)), id).toBe(false);
      expect(existsSync(join(projectDir, ".agents/skills", id)), id).toBe(false);
    }
    expect(added(report).filter((p) => THREE.some((id) => p.endsWith(id)))).toEqual([]);
  });

  it("`--without natural-korean` 으로 뺀 설치본은 그것만 받지 않는다", () => {
    run("add", spec(["tooling"], ["claude", "codex"], ["natural-korean"]));
    pretendOlderRelease();
    run("update", spec(["tooling"], ["claude", "codex"]));
    for (const slot of [".claude/skills", ".agents/skills"]) {
      expect(existsSync(join(projectDir, slot, "natural-korean")), slot).toBe(false);
      expect(existsSync(join(projectDir, slot, "model-orchestration")), slot).toBe(true);
      expect(existsSync(join(projectDir, slot, "external-model-consult")), slot).toBe(true);
    }
  });
});

/**
 * #729 (ADR-109) — multi-model-debate 가 개발 트랙 기본으로 들어왔다. 같은 두 경로(#480 ① · #530 S3)로 옛 설치본이
 * `update` 한 번에 받는다 — 사이드카(references/ · agents/openai.yaml)까지 두 자리에. 브라우저 위임 3종은 opt-in 이라
 * 기록에 없으면 `update` 가 깔지 않는다.
 */
describe("#729 — multi-model-debate 는 update 로 두 자리에 오고, 브라우저 위임 3종은 오지 않는다", () => {
  const DEBATE = ["multi-model-debate"] as const;
  const BROWSER = ["gemini-delegate", "chatgpt-delegate", "genspark-delegate"] as const;
  const SIDECARS = ["SKILL.md", "references/adapters.md", "agents/openai.yaml"] as const;

  it("tooling · claude + codex: 옛 설치본이 사이드카까지 두 자리에 받는다", () => {
    run("add", spec(["tooling"], ["claude", "codex"]));
    pretendOlderRelease(DEBATE);
    expect(existsSync(join(projectDir, ".claude/skills/multi-model-debate"))).toBe(false);

    const report = run("update", spec(["tooling"], ["claude", "codex"]));
    for (const slot of [".claude/skills", ".agents/skills"]) {
      for (const f of SIDECARS) {
        expect(existsSync(join(projectDir, slot, "multi-model-debate", f)), `${slot} ${f}`).toBe(
          true,
        );
      }
      for (const id of BROWSER) {
        expect(existsSync(join(projectDir, slot, id)), `${slot} ${id}`).toBe(false);
      }
    }
    expect(added(report)).toEqual(
      expect.arrayContaining([
        ".claude/skills/multi-model-debate",
        ".agents/skills/multi-model-debate",
      ]),
    );
  });

  it("`--without multi-model-debate` 로 뺀 설치본은 받지 않는다", () => {
    run("add", spec(["tooling"], ["claude", "codex"], ["multi-model-debate"]));
    pretendOlderRelease(DEBATE);
    run("update", spec(["tooling"], ["claude", "codex"]));
    for (const slot of [".claude/skills", ".agents/skills"]) {
      expect(existsSync(join(projectDir, slot, "multi-model-debate")), slot).toBe(false);
    }
  });

  it("--with 로 고른 브라우저 위임 스킬은 두 자리에 깔린다(opt-in 경로)", () => {
    run("add", {
      ...spec(["tooling"], ["claude", "codex"]),
      userOverride: { forceInclude: [...BROWSER], forceExclude: [] },
    });
    for (const slot of [".claude/skills", ".agents/skills"]) {
      for (const id of BROWSER) {
        expect(existsSync(join(projectDir, slot, id, "SKILL.md")), `${slot} ${id}`).toBe(true);
      }
    }
  });
});

/**
 * #761 (ADR-097 결정 7 · 설계 v26.169.0 §3.3) — 같은 이름의 설치자 파일을 update 가 처음 만났다(첫 접촉).
 *
 * 장면: #729 첨부를 손으로 `.claude/skills/<id>/` · `.agents/skills/<id>/` 에 복사해 쓰던 설치자가, 그 이름이 개발 트랙 기본이
 * 된 판으로 update 한다. 하네스 판이 자리를 잡는 것은 같고(결정 7), 달라지는 것은 ① 원본 백업이 기록에 `displaced` 로 남아
 * 하네스가 떠날 때 되돌릴 근거가 되고 ② 화면이 "고쳤다(edited)" 가 아니라 "같은 이름의 파일이 있었다" 고 말한다.
 * 갱신 대상은 기록 + 이번 릴리즈 기본이다 — 기본이 아닌(opt-in) 이름의 손수 만든 폴더는 디스크에 있어도 건드리지 않는다.
 */
describe("#761 — 첫 접촉: 같은 이름의 설치자 스킬 · 룰을 update 가 displaced 로 적는다", () => {
  const DEBATE = "multi-model-debate";
  const OPT_IN = "gemini-delegate";
  const MINE = "MINE — my own copy\n";
  const SLOTS = [".claude/skills", ".agents/skills"] as const;
  const CLIS: CliTargets = ["claude", "codex"];

  const abs = (rel: string): string => join(projectDir, rel);
  const read = (rel: string): string => readFileSync(abs(rel), "utf8");
  const put = (rel: string, text: string): void => {
    mkdirSync(dirname(abs(rel)), { recursive: true });
    writeFileSync(abs(rel), text);
  };
  const backupsOf = (rel: string): string[] => {
    const dir = dirname(abs(rel));
    if (!existsSync(dir)) return [];
    const base = rel.slice(rel.lastIndexOf("/") + 1);
    return readdirSync(dir).filter((f) => f.startsWith(`${base}.backup-`));
  };
  const log = (): InstallLog => {
    const l = readInstallLog(projectDir);
    if (!l) throw new Error("install log missing");
    return l;
  };
  const displacedOf = (path: string) =>
    (log().rootFiles ?? []).filter((f) => f.path === path && f.change === "displaced");

  /** 이 판으로 update — 보고 · 진행 화면 · 요약. */
  function updateWithScreen(): { report: InstallReport; screen: string } {
    const lines: string[] = [];
    const s = spec(["tooling"], CLIS);
    const renderer = createInstallRenderer((m) => lines.push(m), s, false);
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: s,
      mode: "update",
      onProgress: (event) => renderer.callbacks.onProgress?.(event),
    });
    renderUpdateSummary((m) => lines.push(m), s, report);
    // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
    return { report, screen: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
  }

  /** 몫 기록 전의 옛 로그(v26.161 이하) 모양으로 — `records` · `portions` 를 지운다(`skillFiles` 등 나머지는 그대로). */
  function toLegacyLog(): void {
    const { records: _r, portions: _p, ...rest } = log();
    writeFileSync(installLogPath(projectDir), JSON.stringify(rest), "utf8");
  }

  /** ① 의 디스크 — 그 스킬이 없던 옛 판 설치본에 손수 만든 `SKILL.md` 두 자리. */
  function handMadeDebate(): void {
    run("add", spec(["tooling"], CLIS));
    pretendOlderRelease([DEBATE]);
    for (const slot of SLOTS) put(`${slot}/${DEBATE}/SKILL.md`, MINE);
  }

  function expectDisplacedBoth(screen: string): void {
    for (const slot of SLOTS) {
      const rel = `${slot}/${DEBATE}/SKILL.md`;
      expect(read(rel), rel).not.toBe(MINE); // 하네스 판이 자리를 잡았다(결정 7)
      const backups = backupsOf(rel);
      expect(backups, rel).toHaveLength(1);
      expect(read(`${slot}/${DEBATE}/${backups[0]}`), rel).toBe(MINE);
      const [entry, ...more] = displacedOf(rel);
      expect(more, rel).toEqual([]);
      expect(entry?.notes, rel).toEqual([`${slot}/${DEBATE}/${backups[0]}`]);
    }
    // 하네스 판이 자리를 잡았으니 sha 도 적혔다(`displaced+sha`)
    expect(log().skillFiles?.some((f) => f.path === `${DEBATE}/SKILL.md`)).toBe(true);
    expect(log().externalFiles?.some((f) => f.path === `.agents/skills/${DEBATE}/SKILL.md`)).toBe(
      true,
    );
    // #817 — 파일마다 판정의 줄(install 과 같은 말) — 실제 백업 경로를 댄다
    for (const slot of SLOTS) {
      const rel = `${slot}/${DEBATE}/SKILL.md`;
      expect(screen).toContain(
        `${rel} — had a file with this name — saved as ${slot}/${DEBATE}/${backupsOf(rel)[0]}`,
      );
    }
    expect(screen).not.toContain("you edited it");
    expect(screen).not.toContain("no checksum");
    // 설치자 자기 파일의 백업은 새 판에 다시 얹을 편집이 아니다
    expect(screen).not.toContain("to keep your edits across updates");
  }

  it("① 기본 스킬과 같은 이름의 손수 만든 폴더 → 백업 · 하네스 판 · displaced 2건 · 화면 'had a file with this name'", () => {
    handMadeDebate();
    const { screen } = updateWithScreen();
    expectDisplacedBoth(screen);
  });

  it("④ 옛 로그(records 없음 · skillFiles 있음)에서도 ① 과 같다 — B3 좁히기", () => {
    handMadeDebate();
    toLegacyLog();
    const { screen } = updateWithScreen();
    expectDisplacedBoth(screen);
  });

  it("② opt-in 이름의 손수 만든 폴더는 대상이 아니다 — 바이트 그대로 · 백업 0 · 기록 없음 · 화면 언급 없음", () => {
    run("add", spec(["tooling"], CLIS));
    for (const slot of SLOTS) put(`${slot}/${OPT_IN}/SKILL.md`, MINE);

    const { screen } = updateWithScreen();

    for (const slot of SLOTS) {
      const rel = `${slot}/${OPT_IN}/SKILL.md`;
      expect(read(rel), rel).toBe(MINE);
      expect(backupsOf(rel), rel).toEqual([]);
      expect(displacedOf(rel), rel).toEqual([]);
    }
    expect(log().skillFiles?.some((f) => f.path.startsWith(`${OPT_IN}/`))).toBe(false);
    expect(log().externalFiles?.some((f) => f.path.includes(`/${OPT_IN}/`))).toBe(false);
    expect(screen).not.toContain(OPT_IN);
  });

  it("③ 내용이 하네스 판과 같은 손수 둔 파일 → 백업 0 · displaced(notes 없음) · 하네스 기록에는 없다(Q3)", () => {
    run("add", spec(["tooling"], CLIS));
    const harness = new Map(SLOTS.map((slot) => [slot, read(`${slot}/${DEBATE}/SKILL.md`)]));
    pretendOlderRelease([DEBATE]);
    for (const slot of SLOTS) put(`${slot}/${DEBATE}/SKILL.md`, harness.get(slot) ?? "");

    const { screen } = updateWithScreen();

    for (const slot of SLOTS) {
      const rel = `${slot}/${DEBATE}/SKILL.md`;
      expect(read(rel), rel).toBe(harness.get(slot));
      expect(backupsOf(rel), rel).toEqual([]);
      expect(
        displacedOf(rel).map((f) => f.notes),
        rel,
      ).toEqual([[]]);
    }
    expect(log().skillFiles?.some((f) => f.path === `${DEBATE}/SKILL.md`)).toBe(false);
    expect(log().externalFiles?.some((f) => f.path === `.agents/skills/${DEBATE}/SKILL.md`)).toBe(
      false,
    );
    // 형제 파일은 하네스가 새로 깔았다 — 하네스 것이다
    expect(log().skillFiles?.some((f) => f.path === `${DEBATE}/references/adapters.md`)).toBe(true);
    expect(screen).toContain("same as the harness version");
    expect(screen).not.toContain("had a file with this name");
  });

  it("ⓑ 이번 릴리즈의 신규 룰과 같은 이름의 손수 만든 룰 → update 의 .claude/ 쓰기에서도 백업 · displaced · 화면 같은 말", () => {
    const RULE = ".claude/rules/git-policy.md";
    run("add", spec(["tooling"], CLIS));
    // 그 룰이 없던 옛 판 설치본 — 디스크와 기준선에서 뺀다
    rmSync(abs(RULE));
    const l = log();
    writeInstallLog(projectDir, {
      ...l,
      ...(l.policyFiles
        ? { policyFiles: l.policyFiles.filter((f) => f.path !== "rules/git-policy.md") }
        : {}),
    });
    put(RULE, MINE);

    const { screen } = updateWithScreen();

    expect(read(RULE)).not.toBe(MINE);
    const backups = backupsOf(RULE);
    expect(backups).toHaveLength(1);
    expect(read(`.claude/rules/${backups[0]}`)).toBe(MINE);
    expect(displacedOf(RULE).map((f) => f.notes)).toEqual([[`.claude/rules/${backups[0]}`]]);
    expect(log().policyFiles?.some((f) => f.path === "rules/git-policy.md")).toBe(true);
    expect(screen).toContain(
      `${RULE} — had a file with this name — saved as .claude/rules/${backups[0]}`,
    );
    expect(screen).not.toContain("you edited it");
  });
});

import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderBundledSkill } from "../src/codex/skills.js";
import { createInstallRenderer } from "../src/commands/install-render.js";
import {
  hashContent,
  type InstallLog,
  installLogPath,
  readInstallLog,
} from "../src/install-log.js";
import {
  type BaselineReport,
  type InstallMode,
  type InstallReport,
  runInstall,
} from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * Claude 자리(`.claude/`)의 install · update 가 설치자 파일을 잃지 않는가 — #529(L1) · #524 · #536.
 *
 * 설치자가 겪는 세 모양만 문다:
 *   ① `.claude/skills/<id>` 를 이 프로젝트의 `.agents/skills/<id>` 로의 링크로 둔 설치자(#524 원문
 *      그대로 — "스킬은 .agents 에, .claude 에는 링크"). add 는 그 공유 본문을 포팅판 최신으로 맞추고,
 *      update 는 화면이 그 자리를 "남의 것"이라 부르지 않는다.
 *   ⑤ Claude 가 깔리지 않은 설치본에 설치자 `.claude/` 가 있을 때 update 가 매번 통째 사본을 쌓지 않는다.
 *   ⑥ 기설치 위 install 이 설치자가 고친 스킬 파일을 백업 없이 밀지 않는다(룰과 같은 잣대).
 *
 * 스킬 id 는 **설치 결과에서 고른다** — 이름을 박으면 카탈로그가 바뀔 때 시나리오가 개수·이름 때문에
 * 빨개진다(자산 은퇴 전례 ADR-088 · ADR-090).
 */
describe("Claude 자리 — 링크 스킬 · 백업 규약 (#529 · #524 · #536)", () => {
  let projectDir: string;
  let foreignRepo: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-529-proj-"));
    foreignRepo = mkdtempSync(join(tmpdir(), "ch-529-foreign-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(foreignRepo, { recursive: true, force: true });
  });

  const specOf = (cli: CliBase[]): InstallSpec => ({
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli,
    projectDir,
  });

  /** 기설치 위 install — 위저드 Add · `install --cli claude` 와 같은 경로(mode add). */
  const install = (
    cli: CliBase[],
    mode: InstallMode = "fresh",
    onBaseline?: (b: BaselineReport) => void,
  ): InstallReport =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(cli),
      mode,
      ...(onBaseline
        ? { onProgress: (e) => e.type === "baseline-complete" && onBaseline(e.baseline) }
        : {}),
    });

  /** `agent-harness update` 와 같은 spec(`buildUpdateSpec`) 으로 돈다. */
  const update = (onBaseline?: (b: BaselineReport) => void): InstallReport =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: buildUpdateSpec(projectDir, ["tooling"]),
      mode: "update",
      ...(onBaseline
        ? { onProgress: (e) => e.type === "baseline-complete" && onBaseline(e.baseline) }
        : {}),
    });

  /** 실제 렌더러에 실제 baseline 을 물린 화면 — 문자열을 손으로 짓지 않는다. */
  function screenOf(baseline: BaselineReport | undefined): string {
    if (baseline === undefined) throw new Error("baseline-complete 이벤트가 오지 않았다");
    const lines: string[] = [];
    const renderer = createInstallRenderer((m) => lines.push(m), specOf(["claude"]), false);
    renderer.callbacks.onProgress?.({ type: "baseline-complete", baseline });
    return lines.join("\n");
  }

  const log = (): InstallLog => {
    const l = readInstallLog(projectDir);
    if (l === null) throw new Error("설치 로그가 없다 — 시나리오 전제가 깨졌다");
    return l;
  };
  const writeLog = (l: InstallLog): void =>
    writeFileSync(installLogPath(projectDir), `${JSON.stringify(l, null, 2)}\n`);
  const externalSha = (path: string): string | undefined =>
    log().externalFiles?.find((f) => f.path === path)?.sha256;
  /** `externalFiles` 의 한 경로를 바꾸거나(sha) 뺀다(undefined). 컨테이너 시나리오의 jq 와 같은 조작. */
  function setExternalSha(path: string, sha: string | undefined): void {
    const l = log();
    const rest = (l.externalFiles ?? []).filter((f) => f.path !== path);
    writeLog({ ...l, externalFiles: sha === undefined ? rest : [...rest, { path, sha256: sha }] });
    // 대조군 — 조작이 실제로 먹었는지부터 본다. 안 먹으면 아래 판정이 전부 다른 이유로 난다.
    expect(externalSha(path)).toBe(sha);
  }

  /** 두 자리에 모두 깔린 스킬 하나 — claude 사본과 `.agents/` 포팅판이 짝인 것. */
  function sharedSkillId(): string {
    const dirs = (rel: string): string[] =>
      readdirSync(join(projectDir, rel), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name);
    const agents = new Set(dirs(".agents/skills"));
    const id = dirs(".claude/skills")
      .filter((d) => agents.has(d))
      .sort()[0];
    if (id === undefined)
      throw new Error("두 자리에 함께 깔린 스킬이 없다 — 시나리오가 무의미해진다");
    return id;
  }

  /** `.claude/skills/<id>` 를 `../../.agents/skills/<id>` 상대 링크로 바꾼다 (#524 설치자 구성). */
  function linkToShared(id: string): string {
    const slot = join(projectDir, ".claude/skills", id);
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(join("..", "..", ".agents", "skills", id), slot);
    expect(lstatSync(slot).isSymbolicLink()).toBe(true);
    return slot;
  }

  const bodyOf = (id: string): string => join(projectDir, ".agents/skills", id, "SKILL.md");
  /** 번들 원본을 `.agents/skills/` 변환과 같은 함수로 렌더한 바이트 — 공유 본문의 정본. */
  const portedOf = (id: string): string =>
    renderBundledSkill(
      readFileSync(join(HARNESS_ROOT, "templates/skills", id, "SKILL.md"), "utf8"),
    );
  const backupsOf = (file: string): string[] =>
    readdirSync(dirname(file))
      .filter((f) => f.startsWith(`${file.split("/").pop()}.backup-`))
      .map((f) => join(dirname(file), f));

  const STALE = "# stale — 지난 릴리즈 판\n";

  describe("① 링크 자리 — add 가 공유 본문을 갱신한다 (#524)", () => {
    it("①a install --cli claude(add) 뒤 본문 = 포팅판 최신 · 링크 유지 · 기록 갱신 · 백업 0", () => {
      install(["claude", "codex"]);
      const id = sharedSkillId();
      const body = bodyOf(id);
      // 정본 확인 — 첫 설치가 쓴 바이트가 곧 `writeBundledSkillDirs` 의 포팅판이다.
      expect(readFileSync(body, "utf8")).toBe(portedOf(id));
      const slot = linkToShared(id);
      writeFileSync(body, STALE);
      // 지난 릴리즈가 놓아둔 본문 = 기록과 같은 sha. 안 맞추면 stale 이 "설치자 편집"으로 읽혀
      // 백업 0 단언이 다른 이유로 깨진다.
      setExternalSha(`.agents/skills/${id}/SKILL.md`, hashContent(STALE));

      const report = install(["claude"], "add");

      // 음성 대조: installer.ts 의 링크 분기(`linksToProjectSharedSkill` → linkedSkills)를 끄면 여기가
      // red 다 — 이 실행엔 codex 변환이 없으므로 본문을 쓰는 주체가 A 말고는 없다.
      expect(readFileSync(body, "utf8")).toBe(portedOf(id));
      expect(lstatSync(slot).isSymbolicLink()).toBe(true);
      expect(externalSha(`.agents/skills/${id}/SKILL.md`)).toBe(hashContent(portedOf(id)));
      expect(backupsOf(body)).toEqual([]);
      expect(report.backups ?? []).toEqual([]);
      expect(report.baselineLinked).toEqual([id]);
      expect(report.baselineForeignOwned).not.toContain(`.claude/skills/${id}`);
    });

    it("①a' 같은 실행에 codex 변환이 있어도 한 번만 바뀐다 (두 주체가 같은 바이트 → 두 번째는 no-op)", () => {
      install(["claude", "codex"]);
      const id = sharedSkillId();
      const body = bodyOf(id);
      linkToShared(id);
      writeFileSync(body, STALE);
      setExternalSha(`.agents/skills/${id}/SKILL.md`, hashContent(STALE));

      const report = install(["claude", "codex"], "add");

      expect(readFileSync(body, "utf8")).toBe(portedOf(id));
      expect(backupsOf(body)).toEqual([]);
      expect(report.baselineLinked).toEqual([id]);
    });

    it("①b update 뒤 화면이 그 자리를 'linked · updated via' 로 말하고 'owned by another tool' 에 넣지 않는다", () => {
      install(["claude", "codex"]);
      const id = sharedSkillId();
      const body = bodyOf(id);
      linkToShared(id);
      writeFileSync(body, STALE);
      setExternalSha(`.agents/skills/${id}/SKILL.md`, hashContent(STALE));

      let captured: BaselineReport | undefined;
      const report = update((b) => {
        captured = b;
      });

      // 대조군 — 본문 갱신은 update 의 codex 변환(refreshExternalCli, L0 경로)의 몫이다. update-mode 의
      // 화면 분기(skillsLinked 가르기)를 꺼도 이 단언은 green 으로 남는 것이 정상이다 — A 는 update
      // 에서 본문을 쓰지 않는다.
      expect(readFileSync(body, "utf8")).toBe(portedOf(id));
      // 음성 대조: 그 화면 분기를 끄면 아래 셋이 red 다.
      expect(report.updateMode?.skillsLinked).toEqual([id]);
      const screen = screenOf(captured);
      expect(screen).toContain(`linked · updated via .agents/skills/${id}`);
      const ownedRows = screen.split("\n").filter((l) => l.includes("owned by another tool"));
      expect(ownedRows.filter((l) => l.includes(id))).toEqual([]);
    });

    it("② 설치자가 고친 공유 본문(기준선과 다름)은 백업 1개를 남기고 최신판으로", () => {
      install(["claude", "codex"]);
      const id = sharedSkillId();
      const body = bodyOf(id);
      linkToShared(id);
      const edited = `${portedOf(id)}\n설치자가 덧붙인 줄\n`;
      writeFileSync(body, edited);

      const report = install(["claude"], "add");

      expect(readFileSync(body, "utf8")).toBe(portedOf(id));
      const backups = backupsOf(body);
      expect(backups).toHaveLength(1);
      expect(readFileSync(backups[0] as string, "utf8")).toBe(edited);
      // 화면의 backup 행이 이 목록을 쓴다 — 목록에 없으면 설치자는 편집분이 어디 갔는지 모른다.
      expect(report.backups).toContain(backups[0]);
    });

    it("③ 다른 도구가 채운 공유 본문(기록 없음)은 건드리지 않고 'linked · not ours' 로 이름을 댄다", () => {
      // claude 단독 설치 — `.agents/skills/` 는 하네스가 쓴 적이 없다. 설치자가 다른 도구로 채우고 링크.
      install(["claude"]);
      const id = readdirSync(join(projectDir, ".claude/skills")).sort()[0] as string;
      const body = bodyOf(id);
      mkdirSync(dirname(body), { recursive: true });
      writeFileSync(body, "# 다른 도구가 깐 본문\n");
      linkToShared(id);

      let captured: BaselineReport | undefined;
      const report = install(["claude"], "add", (b) => {
        captured = b;
      });

      expect(readFileSync(body, "utf8")).toBe("# 다른 도구가 깐 본문\n");
      expect(readdirSync(dirname(body))).toEqual(["SKILL.md"]);
      expect(report.baselineLinkedNotOurs).toEqual([id]);
      expect(report.baselineLinked).toEqual([]);
      expect(screenOf(captured)).toContain(`linked · not ours — .agents/skills/${id}`);
    });

    it("④ 프로젝트 밖 · 다른 id 로의 링크는 종전대로 남의 것이다 (#343 회귀)", () => {
      install(["claude"]);
      const [outside, otherId] = readdirSync(join(projectDir, ".claude/skills")).sort() as [
        string,
        string,
      ];
      // 프로젝트 밖 저장소 — `npx skills add` 의 모양.
      const external = join(foreignRepo, outside);
      mkdirSync(external, { recursive: true });
      writeFileSync(join(external, "SKILL.md"), "# 남의 저장소 본문\n");
      rmSync(join(projectDir, ".claude/skills", outside), { recursive: true, force: true });
      symlinkSync(external, join(projectDir, ".claude/skills", outside));
      // 프로젝트 안이지만 **다른 id** 의 공유 자리 — 이름이 어긋난 링크는 공유 본문이 아니다.
      mkdirSync(join(projectDir, ".agents/skills/not-the-same"), { recursive: true });
      rmSync(join(projectDir, ".claude/skills", otherId), { recursive: true, force: true });
      symlinkSync(
        join("..", "..", ".agents", "skills", "not-the-same"),
        join(projectDir, ".claude/skills", otherId),
      );

      const report = install(["claude"], "add");

      expect(readFileSync(join(external, "SKILL.md"), "utf8")).toBe("# 남의 저장소 본문\n");
      expect(readdirSync(join(projectDir, ".agents/skills/not-the-same"))).toEqual([]);
      expect(report.baselineForeignOwned).toEqual(
        expect.arrayContaining([`.claude/skills/${outside}`, `.claude/skills/${otherId}`]),
      );
      expect(report.baselineLinked).toEqual([]);
      expect(report.baselineLinkedNotOurs).toEqual([]);
    });
  });

  describe("⑤ Claude 가 깔리지 않은 update 는 `.claude` 통째 사본을 만들지 않는다 (#536-1)", () => {
    const claudeCopies = (): string[] =>
      readdirSync(projectDir).filter((f) => f.startsWith(".claude.backup-"));

    it("codex 단독 로그 + 설치자 `.claude/` → update 뒤 `.claude.backup-*` 0", () => {
      install(["codex"]);
      expect(log().spec.clis).toEqual(["codex"]);
      // Claude Code 가 권한 승인 때 만드는 모양 — 하네스가 깐 적 없는 설치자 디렉터리.
      mkdirSync(join(projectDir, ".claude"), { recursive: true });
      writeFileSync(join(projectDir, ".claude/settings.local.json"), "{}\n");

      const report = update();

      // 음성 대조: installer.ts resolveBackupPath 의 `claudeUntouched` 를 되돌리면 red.
      expect(report.backup).toBeNull();
      expect(claudeCopies()).toEqual([]);
      expect(readFileSync(join(projectDir, ".claude/settings.local.json"), "utf8")).toBe("{}\n");
    });

    it("대조군 — claude 로 깔고 codex 를 더한 설치본(`spec.cli` = [codex])은 사본 1개", () => {
      // 판정이 `spec.cli`(마지막 설치분)를 읽으면 여기서 0 이 된다 — 실제로 갱신되는 `.claude/` 의
      // 되돌림 지점을 잃는다. 깔린 집합(`clis`)으로 판정해야 1.
      install(["claude"]);
      install(["codex"], "add");
      expect(log().spec.cli).toEqual(["codex"]);

      const report = update();

      expect(report.backup).not.toBeNull();
      expect(claudeCopies()).toHaveLength(1);
    });
  });

  describe("⑥ 기설치 위 install 은 고친 스킬 파일을 파일 단위로 백업한다 (#536-2)", () => {
    /** `.claude/skills/` 의 첫 스킬 — 룰과 같은 표를 스킬 기준선 키(`<id>/<rel>`)로 읽는지 본다. */
    function skillFile(): { key: string; file: string; shipped: string } {
      const id = readdirSync(join(projectDir, ".claude/skills")).sort()[0] as string;
      const file = join(projectDir, ".claude/skills", id, "SKILL.md");
      return { key: `${id}/SKILL.md`, file, shipped: readFileSync(file, "utf8") };
    }
    const EDITED = "# 설치자가 고친 스킬\n";

    // 음성 대조(⑥·⑥'): installer.ts 의 `backupEditedSkillFiles` 호출을 빼면 이 두 시험이 red 다.
    it("⑥ 기준선 없는 옛 로그 + 고친 파일 → add 뒤 그 파일의 백업 1", () => {
      install(["claude"]);
      const { file, shipped } = skillFile();
      writeFileSync(file, EDITED);
      const { skillFiles: _dropped, ...legacy } = log();
      writeLog(legacy);
      expect(log().skillFiles).toBeUndefined();

      const report = install(["claude"], "add");

      expect(readFileSync(file, "utf8")).toBe(shipped);
      const backups = backupsOf(file);
      expect(backups).toHaveLength(1);
      expect(readFileSync(backups[0] as string, "utf8")).toBe(EDITED);
      expect(report.backups).toContain(backups[0]);
    });

    it("⑥' 기준선 있음 + 고친 파일 → 백업 1", () => {
      install(["claude"]);
      const { key, file, shipped } = skillFile();
      expect(log().skillFiles?.some((f) => f.path === key)).toBe(true);
      writeFileSync(file, EDITED);

      install(["claude"], "add");

      expect(readFileSync(file, "utf8")).toBe(shipped);
      expect(backupsOf(file)).toHaveLength(1);
    });

    it("⑥' 기준선 있음 + 안 고친 옛 판(기준선 = 그 해시) → 백업 0", () => {
      install(["claude"]);
      const { key, file, shipped } = skillFile();
      const oldRelease = "# 지난 릴리즈가 놓아둔 판\n";
      writeFileSync(file, oldRelease);
      const l = log();
      writeLog({
        ...l,
        skillFiles: (l.skillFiles ?? []).map((f) =>
          f.path === key ? { path: key, sha256: hashContent(oldRelease) } : f,
        ),
      });

      const report = install(["claude"], "add");

      expect(readFileSync(file, "utf8")).toBe(shipped);
      expect(backupsOf(file)).toEqual([]);
      expect(report.backups ?? []).toEqual([]);
      expect(existsSync(file)).toBe(true);
    });
  });
});

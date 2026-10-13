/**
 * #796 PR-A — update 의 `.claude/` 하네스 파일 · CLI 중립 헬퍼를 install 과 **같은 writer** 로 쓴다(쓰기 = 기록). 쓴 뒤 디스크를 다시
 * 훑어 기록하던 길(재스캔)이 사라져 바뀌는 장면들을 설치자 자리에서 문다(설계 `docs/plans/796-one-writer-design.md` §1.2 · §6 PR-A).
 *
 * - ⓐ §1.2 ① — 기록에 있는 opt-in 스킬 폴더를 지운 뒤 update 는 되살린다(ADR-099 R2 "손으로 지운 것은 빼기가 아니다")
 * - ⓑ §1.2 ② — 지운 하네스 파일은 update 뒤에도 기록에 남는다(누적 · ADR-099 R2) — 다음 update 가 "restored" 로 정직하게 말한다
 * - ⓒ §1.2 ⑧ — 필드 없는 옛 로그 + `--only new-skills` 뒤의 update 가 옛 하네스 스킬을 첫 접촉(설치자 파일)으로 읽지 않는다
 * - BLOCKER-2 — 기록된 스킬이 다음 릴리즈 번들에서 빠져도 update 는 그 폴더를 비우지 않는다(ADR-111 결정 5 — 안내만)
 */

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listFilesRecursive } from "../src/fs-ops.js";
import { readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { buildAssetSpec, buildManifest } from "../src/manifest.js";
import { DEFAULT_OPTIONS, type InstallSpec, type UpdateGroup } from "../src/types.js";
import { runUpdateMode } from "../src/update-mode.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const TEMPLATES = join(HARNESS_ROOT, "templates");
/** tooling 트랙의 기본이 아닌 번들 스킬 — `--with` 로만 깔린다. */
const OPT_IN = "gemini-delegate";

let projectDir = "";
let scratch = "";
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "one-writer-p-"));
  scratch = mkdtempSync(join(tmpdir(), "one-writer-s-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(scratch, { recursive: true, force: true });
});

function install(forceInclude: string[] = []): void {
  const spec: InstallSpec = {
    tracks: ["tooling"],
    options: { withCodexTrust: false },
    cli: ["claude"],
    projectDir,
    ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
  };
  runInstall({ harnessRoot: HARNESS_ROOT, projectDir, spec, runExternal: null });
}

const update = (only?: UpdateGroup[], templates = TEMPLATES) =>
  runUpdateMode(projectDir, templates, HARNESS_ROOT, {}, only);

const skillFilesOf = (id: string): string[] =>
  (readInstallLog(projectDir)?.skillFiles ?? [])
    .map((f) => f.path)
    .filter((p) => p.startsWith(`${id}/`));

/** tooling 기본 번들 스킬 id — manifest 에서 뽑는다(열거는 자산 하나가 지워지면 썩는다). */
function defaultSkills(): string[] {
  const spec = buildAssetSpec({ tracks: ["tooling"], options: DEFAULT_OPTIONS });
  return buildManifest(spec)
    .filter((e) => e.type === "dir" && e.target.startsWith(".claude/skills/") && e.applies(spec))
    .map((e) => e.target.slice(".claude/skills/".length));
}

describe("#796 ⓐ — 기록된 opt-in 스킬 폴더를 지운 뒤 update 가 되살린다 (§1.2 ①)", () => {
  it("폴더째 돌아오고 화면은 'was missing — restored' 로 말한다 · 다시 돌리면 조용하다", () => {
    install([OPT_IN]);
    expect(defaultSkills(), "전제 — tooling 기본이 아니다").not.toContain(OPT_IN);
    const slot = join(projectDir, ".claude/skills", OPT_IN);
    const before = listFilesRecursive(slot).sort();
    expect(before.length, "전제 — 깔렸다").toBeGreaterThan(0);
    rmSync(slot, { recursive: true });

    const report = update();

    expect(listFilesRecursive(slot).sort()).toEqual(before);
    expect(report.restored).toContain(`.claude/skills/${OPT_IN}`);
    expect(report.installedNew).not.toContain(`.claude/skills/${OPT_IN}`);
    // 빼는 길도 함께 말한다(되살림 행의 인자)
    expect(report.restoredWithout?.[`.claude/skills/${OPT_IN}`]).toBe(OPT_IN);

    const again = update();
    expect(again.restored).toEqual([]);
    expect(again.backups).toEqual([]);
  });
});

describe("#796 ⓑ — 지운 하네스 파일은 update 뒤에도 기록에 남는다 (§1.2 ② · ADR-099 R2)", () => {
  it("폴더를 되살리지 않는 부분 갱신(--only skills)도 기록에서 지우지 않는다 — 다음 전체 update 가 '되살림' 으로 말한다", () => {
    install();
    const [id] = defaultSkills();
    expect(id, "전제 — tooling 기본 스킬").toBeDefined();
    const recorded = skillFilesOf(id as string);
    expect(recorded.length, "전제 — 기록에 있다").toBeGreaterThan(0);
    rmSync(join(projectDir, ".claude/skills", id as string), { recursive: true });

    update(["skills"]); // 있는 폴더만 갱신하는 묶음 — 지운 폴더는 만들지 않는다

    expect(existsSync(join(projectDir, ".claude/skills", id as string))).toBe(false);
    expect(skillFilesOf(id as string)).toEqual(recorded);

    const full = update();
    expect(full.restored).toContain(`.claude/skills/${id}`);
    expect(full.installedNew).not.toContain(`.claude/skills/${id}`);
  });
});

describe("#796 ⓒ — 필드 없는 옛 로그 + --only new-skills 뒤 update 가 옛 스킬을 첫 접촉으로 읽지 않는다 (§1.2 ⑧)", () => {
  it("다른 옛 하네스 스킬은 'no checksum' 1회 백업이고 displaced 로 적히지 않는다", () => {
    install();
    const [fresh, old] = defaultSkills();
    expect(old, "전제 — tooling 기본 스킬이 둘 이상").toBeDefined();
    // 체크섬 이전 옛 판(≤v26.125)의 기록 모양 — 파일별 필드 · writer 표시가 없다
    const log = readInstallLog(projectDir);
    if (log === null) throw new Error("전제 — 설치 기록");
    const legacy = { ...log };
    delete legacy.records;
    delete legacy.policyFiles;
    delete legacy.skillFiles;
    delete legacy.rootFiles;
    writeInstallLog(projectDir, legacy);
    // `fresh` 는 이번 릴리즈가 더한 스킬 · `old` 는 옛 판 바이트로 남은 하네스 스킬
    rmSync(join(projectDir, ".claude/skills", fresh as string), { recursive: true });
    const oldSkill = join(projectDir, ".claude/skills", old as string, "SKILL.md");
    writeFileSync(oldSkill, `${readFileSync(oldSkill, "utf8")}\n<!-- older release -->\n`);

    const partial = update(["new-skills"]);
    expect(partial.installedNew).toContain(`.claude/skills/${fresh}`);
    // 있는 스킬 폴더를 다 돌지 않은 실행은 없던 `skillFiles` 를 만들지 않는다 — 만들면 새 스킬만 든 부분 기록이 되고, 읽는 쪽은
    // 필드가 있으면 `.claude/skills/` 를 다 적은 기록으로 읽어 `old` 를 첫 접촉으로 뒤집는다
    expect(readInstallLog(projectDir)?.skillFiles).toBeUndefined();

    const next = update();

    const rel = `.claude/skills/${old}/SKILL.md`;
    expect(next.displaced ?? []).not.toContain(rel);
    expect(next.noChecksum ?? []).toContain(rel);
    expect(next.displacedSame ?? []).not.toContain(rel);
    const roots = readInstallLog(projectDir)?.rootFiles ?? [];
    expect(roots.filter((f) => f.change === "displaced").map((f) => f.path)).toEqual([]);
    expect(readFileSync(oldSkill, "utf8")).toBe(
      readFileSync(join(TEMPLATES, "skills", old as string, "SKILL.md"), "utf8"),
    );
  });
});

describe("#796 BLOCKER-2 — 기록된 스킬이 다음 릴리즈 번들에서 빠져도 update 는 그 폴더를 비우지 않는다", () => {
  it("은퇴한 스킬 폴더의 파일이 하나도 지워지지 않고 백업도 생기지 않는다 (ADR-111 결정 5)", () => {
    install([OPT_IN]);
    const slot = join(projectDir, ".claude/skills", OPT_IN);
    const before = listFilesRecursive(slot).sort();
    expect(before.length, "전제 — 깔렸다").toBeGreaterThan(0);
    expect(skillFilesOf(OPT_IN).length, "전제 — 기록에 있다").toBeGreaterThan(0);
    // 다음 릴리즈 — 번들 사본에서 그 스킬만 뺐다
    const next = join(scratch, "templates");
    cpSync(TEMPLATES, next, { recursive: true });
    rmSync(join(next, "skills", OPT_IN), { recursive: true });

    const report = update(undefined, next);

    expect(listFilesRecursive(slot).sort()).toEqual(before);
    expect(report.skillsPruned).toEqual([]);
    expect(readdirSync(slot).filter((f) => f.includes(".backup-"))).toEqual([]);
    expect(report.backups.filter((b) => b.path.startsWith(`.claude/skills/${OPT_IN}/`))).toEqual(
      [],
    );
  });
});

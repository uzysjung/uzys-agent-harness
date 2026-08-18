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
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInstallRenderer } from "../src/commands/install-render.js";
import type { BaselineReport, ProgressEvent } from "../src/installer.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #343 — 게시된 v26.147.0 에서 **실 사용자의 설치가 통째로 죽었다**:
 *
 *   ✗ install failed — Cannot overwrite non-directory
 *     <proj>/.claude/skills/compaction-handoff with directory <npx>/templates/skills/compaction-handoff
 *
 * 조건은 하나다 — 자산이 깔릴 자리가 **디렉터리가 아닌 것**으로 이미 차 있을 때.
 * `.claude/skills/<id>` 는 `npx skills add` 의 프로젝트 스코프 설치처이고 그 실체는
 * 다른 저장소로의 심볼릭 링크다. 그 위에 `cpSync` 가 디렉터리를 부으려다 죽는다.
 *
 * `update` 는 이 상황을 **이미 올바르게** 처리한다 (ADR-062 · `syncSkills` 의 `skippedLinks`):
 * 남의 도구가 소유한 자리는 건드리지 않고, 건너뛴 사실을 화면에 이름으로 낸다. 같은 정책이
 * `install` 경로에만 없어서 크래시로 나타난 것이므로, 이 스위트는 **install 이 update 와 같은
 * 판정을 하는가**를 문다.
 *
 * 덮어쓰기가 답이 아닌 이유도 그대로다: 링크를 따라 쓰면 `.claude/` **밖**에 있는 사용자의
 * 다른 저장소를 우리 판본으로 민다. 백업을 남겨도 사용자가 찾을 자리가 아니다.
 */
describe("#343 install: 자산 자리가 디렉터리가 아닐 때", () => {
  let projectDir: string;
  let foreignRepo: string;

  const specOf = (): InstallSpec => ({
    tracks: ["tooling"],
    options: { withPrune: false, withCodexTrust: false },
    cli: ["claude"],
    projectDir,
  });

  const install = (onProgress?: (event: ProgressEvent) => void) =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(),
      // exactOptionalPropertyTypes — 넘기지 않을 땐 키 자체를 만들지 않는다.
      ...(onProgress ? { onProgress } : {}),
    });

  /** 첫 설치가 실제로 깔아 둔 스킬 하나를 고른다 — 기본 선택 목록이 바뀌어도 따라간다. */
  function installedSkillId(): string {
    const dir = join(projectDir, ".claude/skills");
    const ids = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    const id = ids[0];
    // 하나도 없으면 아래 시나리오가 전부 공회전한다 — 스위트가 조용히 무의미해지는 것을 막는다.
    if (id === undefined) throw new Error(".claude/skills 가 비었다 — 이 스위트가 무의미해진다");
    return id;
  }

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-343-proj-"));
    foreignRepo = mkdtempSync(join(tmpdir(), "ch-343-foreign-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(foreignRepo, { recursive: true, force: true });
  });

  it("심볼릭 링크(= npx skills add 설치본) 위에서도 설치가 끝까지 간다", () => {
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);

    // `npx skills add` 가 만드는 모양을 그대로 만든다: 남의 저장소로의 링크.
    const external = join(foreignRepo, id);
    mkdirSync(external, { recursive: true });
    writeFileSync(join(external, "SKILL.md"), "# 남의 저장소 본문\n");
    rmSync(target, { recursive: true, force: true });
    symlinkSync(external, target);

    const report = install();

    // ⓐ 설치가 죽지 않는다 (여기까지 온 것 자체가 그 증거) — 나머지 자산도 정상 설치됐다.
    expect(report.filesCopied).toBeGreaterThan(10);
    // ⓑ 남의 저장소 본문은 그대로다. 이게 이 판정의 존재 이유다.
    expect(readFileSync(join(external, "SKILL.md"), "utf-8")).toBe("# 남의 저장소 본문\n");
    // ⓒ 링크도 링크인 채로 남는다 (실체 디렉터리로 바뀌지 않았다).
    expect(lstatSync(target).isSymbolicLink()).toBe(true);
    // ⓓ 침묵하지 않는다 — 건너뛴 자리를 이름으로 보고한다.
    expect(report.baselineForeignOwned).toContain(`.claude/skills/${id}`);
  });

  it("일반 파일이 자리를 차지하고 있어도 설치가 끝까지 간다", () => {
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);

    rmSync(target, { recursive: true, force: true });
    writeFileSync(target, "사용자가 놓아둔 파일\n");

    const report = install();

    expect(report.filesCopied).toBeGreaterThan(10);
    // 지우지 않는다 — 누가 놓아둔 것인지 모르는 파일이다.
    expect(readFileSync(target, "utf-8")).toBe("사용자가 놓아둔 파일\n");
    expect(report.baselineForeignOwned).toContain(`.claude/skills/${id}`);
  });

  it("깨진 링크(가리키던 저장소가 사라진 뒤)에서도 설치가 끝까지 간다", () => {
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);

    rmSync(target, { recursive: true, force: true });
    symlinkSync(join(foreignRepo, "사라진-저장소"), target);

    const report = install();

    expect(report.filesCopied).toBeGreaterThan(10);
    expect(lstatSync(target).isSymbolicLink()).toBe(true);
    expect(report.baselineForeignOwned).toContain(`.claude/skills/${id}`);
  });

  it("건너뛴 자리는 설치 화면에 이름으로 뜬다 (사용자 도달 경로)", () => {
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);
    const external = join(foreignRepo, id);
    mkdirSync(external, { recursive: true });
    rmSync(target, { recursive: true, force: true });
    symlinkSync(external, target);

    // 프로그램 결과만 맞고 화면이 침묵하면 사용자는 고른 자산이 왜 없는지 끝내 알 수 없다.
    // 그래서 **실제 렌더러**에 실제 baseline 을 그대로 물린다 (문자열을 손으로 짓지 않는다).
    let captured: BaselineReport | undefined;
    install((event) => {
      if (event.type === "baseline-complete") captured = event.baseline;
    });
    if (captured === undefined) throw new Error("baseline-complete 이벤트가 오지 않았다");

    const lines: string[] = [];
    const renderer = createInstallRenderer((m) => lines.push(m), specOf(), false);
    renderer.callbacks.onProgress?.({ type: "baseline-complete", baseline: captured });
    const screen = lines.join("\n");

    // 화면이 디스크와 다른 말을 하면 안 된다 — 안 깐 것을 "깔았다" 목록에 세지 않는다.
    // 목록이 비면 이 단언은 저절로 참이 되므로, 먼저 목록이 살아 있는지부터 본다.
    const installedSkills = captured.categories?.skills ?? [];
    expect(installedSkills.length).toBeGreaterThan(0);
    expect(installedSkills).not.toContain(id);

    expect(screen).toContain(`skills/${id}`);
    expect(screen).toContain("owned by another tool");
    // 원인만 알려주는 안내는 다음 행동을 못 만든다 — 되받는 방법까지 화면에 있어야 한다.
    expect(screen).toContain("재설치");
  });

  it("슬롯 안의 파일로 나가는 자산도 링크를 따라 남의 저장소를 덮지 않는다", () => {
    install();
    // `.claude/skills/spec-scaling/SKILL.md` 는 디렉터리가 아니라 **파일**로 나가는 엔트리다.
    // 부모가 링크면 copyFileSync 는 죽지 않는다 — 그래서 크래시보다 조용한 위반이 된다.
    const slot = join(projectDir, ".claude/skills/spec-scaling");
    const external = join(foreignRepo, "spec-scaling");
    mkdirSync(external, { recursive: true });
    writeFileSync(join(external, "SKILL.md"), "# 남의 저장소 본문\n");
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(external, slot);

    const report = install();

    expect(readFileSync(join(external, "SKILL.md"), "utf-8")).toBe("# 남의 저장소 본문\n");
    expect(report.baselineForeignOwned).toContain(".claude/skills/spec-scaling");
    // 슬롯 하나당 한 줄 — 파일마다 반복해 내지 않는다.
    expect(
      report.baselineForeignOwned.filter((t) => t === ".claude/skills/spec-scaling"),
    ).toHaveLength(1);
  });

  it("정상 디렉터리는 종전대로 덮어쓴다 (게이트가 설치를 막지 않는다는 대조군)", () => {
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);
    const probe = join(target, "SKILL.md");
    const shipped = existsSync(probe) ? readFileSync(probe, "utf-8") : null;
    if (shipped !== null) writeFileSync(probe, "사용자가 고친 내용\n");

    const report = install();

    expect(report.baselineForeignOwned).not.toContain(`.claude/skills/${id}`);
    if (shipped !== null) expect(readFileSync(probe, "utf-8")).toBe(shipped);
  });
});

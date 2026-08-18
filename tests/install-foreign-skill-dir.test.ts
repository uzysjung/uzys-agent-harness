import { execFileSync } from "node:child_process";
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
import { foreignOwnedTarget } from "../src/foreign-slot.js";
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

  const update = (onProgress?: (event: ProgressEvent) => void) =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(),
      mode: "update",
      ...(onProgress ? { onProgress } : {}),
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
    // ⓐ' **건너뛴 것은 하나뿐이다.** 이 단언이 없으면 "한 자리가 남의 것이면 스킬을 하나도
    // 안 깐다"는 최악의 오탐이 전 스위트를 통과한다(적대적 검증에서 실제로 생존했다).
    // 스킬은 `type:"dir"` 이라 filesCopied 로는 안 잡힌다 — 디렉터리 축을 따로 본다.
    expect(report.baselineForeignOwned).toHaveLength(1);
    expect(report.dirsCopied).toBeGreaterThan(10);
    const others = readdirSync(join(projectDir, ".claude/skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(others.length).toBeGreaterThan(10);
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

    // 접두를 포함해 단언한다 — `skills/<id>` 로만 보면 `.claude/` 를 잘라도 통과해서,
    // `.agents/` 자리와 구분이 안 되게 만드는 회귀를 아무도 막지 못한다.
    expect(screen).toContain(`.claude/skills/${id}`);
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

  it("codex 자리(.agents/skills/<id>)도 링크를 따라 덮지 않는다", () => {
    // `.agents/skills/` 는 codex·antigravity 산출물의 자리이자 `npx skills add --agent` 의
    // 설치처다(SKILLS_CLI_AGENT_MAP). v26.147.0 에서는 `.claude/` 쪽이 먼저 죽어 이 코드가
    // 돈 적이 없었고, 크래시를 없애는 순간 **처음으로** 도달한다.
    const withCodex = (): InstallSpec => ({ ...specOf(), cli: ["claude", "codex"] });
    const run = () =>
      runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir, spec: withCodex() });

    run();
    const agentSkills = join(projectDir, ".agents/skills");
    const id = readdirSync(agentSkills, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort()[0];
    if (id === undefined) throw new Error(".agents/skills 가 비었다 — 이 시나리오가 무의미해진다");

    const external = join(foreignRepo, id);
    mkdirSync(external, { recursive: true });
    writeFileSync(join(external, "SKILL.md"), "# 남의 저장소 본문\n");
    rmSync(join(agentSkills, id), { recursive: true, force: true });
    symlinkSync(external, join(agentSkills, id));

    const report = run();

    expect(readFileSync(join(external, "SKILL.md"), "utf-8")).toBe("# 남의 저장소 본문\n");
    // 백업조차 남의 저장소 안에 만들지 않는다 — 사용자가 찾을 자리가 아니다.
    expect(readdirSync(external)).toEqual(["SKILL.md"]);
    expect(report.baselineForeignOwned).toContain(`.agents/skills/${id}`);
  });

  it("슬롯은 우리 것인데 그 안의 SKILL.md 만 링크여도 따라 쓰지 않는다", () => {
    install();
    const slot = join(projectDir, ".claude/skills/spec-scaling");
    const external = join(foreignRepo, "SKILL.md");
    writeFileSync(external, "# 남의 파일\n");
    rmSync(join(slot, "SKILL.md"), { force: true });
    symlinkSync(external, join(slot, "SKILL.md"));

    const report = install();

    expect(readFileSync(external, "utf-8")).toBe("# 남의 파일\n");
    expect(report.baselineForeignOwned).toContain(".claude/skills/spec-scaling/SKILL.md");
  });

  it("update 도 install 과 같은 판정을 쓴다 — 일반 파일 위에서 죽지 않는다", () => {
    // install 이 그 상태를 화면으로 승인하는데 update 만 죽으면, 실패 지점을 옮긴 것에 불과하다.
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);
    rmSync(target, { recursive: true, force: true });
    writeFileSync(target, "사용자가 놓아둔 파일\n");

    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(),
      mode: "update",
    });

    expect(readFileSync(target, "utf-8")).toBe("사용자가 놓아둔 파일\n");
    expect(report.updateMode?.skillsSkippedLinks).toContain(id);
  });

  it("`.claude` 자체가 심링크인 공유 dotfiles 설치는 막지 않는다 (가드가 넓지 않다)", () => {
    // `fs-ops.ts` 가 지원 케이스로 명시한 모양이다. 여기까지 막으면 정상 설치가 통째로 멈춘다.
    const shared = join(foreignRepo, "shared-dotfiles-claude");
    mkdirSync(shared, { recursive: true });
    symlinkSync(shared, join(projectDir, ".claude"));

    const report = install();

    expect(report.baselineForeignOwned).toHaveLength(0);
    expect(report.dirsCopied).toBeGreaterThan(10);
    expect(existsSync(join(shared, "skills"))).toBe(true);
  });

  it("디렉터리 자산(스킬 대부분)도 **그 안의 파일**이 링크면 따라 쓰지 않는다", () => {
    // 스킬 14종 중 13종은 `type:"dir"` 엔트리다. 슬롯 판정만으로는 이 다수가 안 막힌다 —
    // 통짜 복사가 트리 안의 링크를 그대로 따라가기 때문이다.
    install();
    const id = installedSkillId();
    const external = join(foreignRepo, "x.md");
    writeFileSync(external, "# 남의 파일\n");
    const inner = join(projectDir, ".claude/skills", id, "SKILL.md");
    rmSync(inner, { force: true });
    symlinkSync(external, inner);

    const report = install();

    expect(readFileSync(external, "utf-8")).toBe("# 남의 파일\n");
    expect(report.baselineForeignOwned).toContain(`.claude/skills/${id}/SKILL.md`);
    // 같은 스킬의 **나머지 파일은 그대로 깔린다** — 파일 하나 때문에 스킬을 통째로 버리지 않는다.
    expect(report.dirsCopied).toBeGreaterThan(10);
  });

  it("스킬 안 중첩 경로의 파일이 링크여도 따라 쓰지 않는다", () => {
    install();
    // 중첩 파일을 가진 스킬을 **찾아서** 쓴다 — 특정 이름에 묶으면 자산 구성이 바뀔 때
    // 시나리오가 조용히 무의미해진다.
    const skillsDir = join(projectDir, ".claude/skills");
    let id = "";
    let nested = "";
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const found = readdirSync(join(skillsDir, entry.name), { recursive: true })
        .map(String)
        .find((f) => f.includes("/"));
      if (found !== undefined) {
        id = entry.name;
        nested = found;
        break;
      }
    }
    if (id === "") throw new Error("중첩 파일을 가진 스킬이 없다 — 시나리오가 무의미해진다");

    const external = join(foreignRepo, "nested.md");
    writeFileSync(external, "# 남의 중첩 파일\n");
    const inner = join(projectDir, ".claude/skills", id, nested);
    rmSync(inner, { force: true });
    symlinkSync(external, inner);

    const report = install();

    expect(readFileSync(external, "utf-8")).toBe("# 남의 중첩 파일\n");
    expect(report.baselineForeignOwned).toContain(`.claude/skills/${id}/${nested}`);
  });

  it("판정이 FIFO 를 남의 것으로 본다 (통합 시험으로는 못 무는 자리)", () => {
    // FIFO 를 **설치로** 시험하지 않는다: 가드가 빠지면 `copyFileSync`·`readFileSync` 가 영영
    // 블록돼 빨간불이 아니라 **멈춤**으로 끝나고, 동기 블로킹이라 vitest 의 테스트 타임아웃도
    // 못 자른다(실측: 400초·120초 두 번 강제 종료). 그래서 술어만 직접 문다 — 여기서는 즉시
    // red 가 난다. "쓰는 쪽이 판정을 부르는가"는 같은 자리를 지나는 심링크 시나리오가 문다.
    const slot = join(projectDir, ".claude/skills/probe-skill");
    mkdirSync(slot, { recursive: true });
    const fifo = join(slot, "SKILL.md");
    execFileSync("mkfifo", [fifo]);

    expect(foreignOwnedTarget(projectDir, ".claude/skills/probe-skill/SKILL.md")).toBe(
      ".claude/skills/probe-skill/SKILL.md",
    );
    // 대조군 — 평범한 파일은 우리 것이다(판정이 전부를 남의 것이라 하지 않는다).
    writeFileSync(join(slot, "plain.md"), "x\n");
    expect(foreignOwnedTarget(projectDir, ".claude/skills/probe-skill/plain.md")).toBeNull();
  });

  it("스킬 안 **중간 디렉터리**가 링크여도 그 안으로 쓰지 않는다", () => {
    // 마지막 성분만 보는 판정은 중간 링크를 따라간 자리를 "평범한 파일"로 읽고 통과시킨다.
    install();
    const skillsDir = join(projectDir, ".claude/skills");
    let id = "";
    let sub = "";
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = readdirSync(join(skillsDir, entry.name), { withFileTypes: true }).find((e) =>
        e.isDirectory(),
      );
      if (dir !== undefined) {
        id = entry.name;
        sub = dir.name;
        break;
      }
    }
    if (id === "") throw new Error("하위 디렉터리를 가진 스킬이 없다 — 시나리오가 무의미해진다");

    const external = join(foreignRepo, sub);
    mkdirSync(external, { recursive: true });
    writeFileSync(join(external, "keep.md"), "# 남의 하위 파일\n");
    rmSync(join(skillsDir, id, sub), { recursive: true, force: true });
    symlinkSync(external, join(skillsDir, id, sub));

    const report = install();

    console.log("[DBG] sub is symlink =", lstatSync(join(skillsDir, id, sub)).isSymbolicLink());
    expect(readdirSync(external)).toEqual(["keep.md"]);
    expect(readFileSync(join(external, "keep.md"), "utf-8")).toBe("# 남의 하위 파일\n");
    expect(report.baselineForeignOwned).toContain(`.claude/skills/${id}/${sub}`);
  });

  it("update 는 남의 저장소 안에 우리 파일을 새로 만들지 않는다", () => {
    // update 의 네 번째 쓰기 주체(`installNewAssets`)는 `existsSync` 로만 판정했다. 슬롯이
    // 남의 저장소 링크이고 그쪽에 그 파일이 없으면 existsSync 가 false 라, 복사가 **남의
    // 저장소 안에 우리 파일을 새로 만들었다**. 같은 화면이 "추가했다"와 "안 건드렸다"를 동시에 말했다.
    install();
    const empty = join(foreignRepo, "spec-scaling");
    mkdirSync(empty, { recursive: true });
    const slot = join(projectDir, ".claude/skills/spec-scaling");
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(empty, slot);

    let captured: BaselineReport | undefined;
    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(),
      mode: "update",
      onProgress: (event) => {
        if (event.type === "baseline-complete") captured = event.baseline;
      },
    });

    expect(readdirSync(empty)).toEqual([]);
    expect(report.updateMode?.installedNew ?? []).not.toContain(
      ".claude/skills/spec-scaling/SKILL.md",
    );
    // 슬롯 자체가 남의 것이므로 슬롯 행이 낸다 (경로 행은 중복을 피해 빠진다 — 아래 전용 시험).
    expect(report.updateMode?.skillsSkippedLinks ?? []).toContain("spec-scaling");

    if (captured === undefined) throw new Error("baseline-complete 이벤트가 오지 않았다");
    const lines: string[] = [];
    const renderer = createInstallRenderer((m) => lines.push(m), specOf(), false);
    renderer.callbacks.onProgress?.({ type: "baseline-complete", baseline: captured });
    const screen = lines.join("\n");
    expect(screen).toContain("spec-scaling");
    expect(screen).toContain("owned by another tool");
    // 2라운드에 고친 문구(종류 단정 제거)를 무는 자리 — 없으면 다음 정리 커밋이 조용히 되돌린다.
    expect(screen).toContain("갱신하지 않았다");
    // 화면이 같은 자리를 "추가했다"고 말하면 안 된다.
    expect(screen).not.toContain("added by this release");
  });

  it("update 도 슬롯 **안의 파일**이 링크면 따라 쓰지 않는다", () => {
    // install 은 막는데 update 는 덮던 자리 — `syncSkills` 의 파일 루프가 판정을 안 거쳤다.
    install();
    const id = installedSkillId();
    const external = join(foreignRepo, "x.md");
    writeFileSync(external, "# 남의 파일\n");
    const inner = join(projectDir, ".claude/skills", id, "SKILL.md");
    rmSync(inner, { force: true });
    symlinkSync(external, inner);

    const report = update();

    expect(readFileSync(external, "utf-8")).toBe("# 남의 파일\n");
    // 백업조차 남의 저장소 옆에 만들지 않는다.
    expect(readdirSync(foreignRepo)).toEqual(["x.md"]);
    expect(report.updateMode?.foreignOwned ?? []).toContain(`.claude/skills/${id}/SKILL.md`);
  });

  it("update 도 슬롯 안 **중간 디렉터리**가 링크면 그 안으로 쓰지 않는다", () => {
    install();
    const skillsDir = join(projectDir, ".claude/skills");
    let id = "";
    let sub = "";
    for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = readdirSync(join(skillsDir, entry.name), { withFileTypes: true }).find((e) =>
        e.isDirectory(),
      );
      if (dir !== undefined) {
        id = entry.name;
        sub = dir.name;
        break;
      }
    }
    if (id === "") throw new Error("하위 디렉터리를 가진 스킬이 없다 — 시나리오가 무의미해진다");

    const external = join(foreignRepo, sub);
    mkdirSync(external, { recursive: true });
    writeFileSync(join(external, "keep.md"), "# 남의 하위 파일\n");
    rmSync(join(skillsDir, id, sub), { recursive: true, force: true });
    symlinkSync(external, join(skillsDir, id, sub));

    const report = update();

    expect(readdirSync(external)).toEqual(["keep.md"]);
    expect(report.updateMode?.foreignOwned ?? []).toContain(`.claude/skills/${id}/${sub}`);
  });

  it("한 자리를 두 행으로 말하지 않는다 (슬롯 행과 경로 행의 중복 제거)", () => {
    install();
    const slot = join(projectDir, ".claude/skills/spec-scaling");
    const external = join(foreignRepo, "spec-scaling");
    mkdirSync(external, { recursive: true });
    rmSync(slot, { recursive: true, force: true });
    symlinkSync(external, slot);

    const report = update();

    expect(report.updateMode?.skillsSkippedLinks ?? []).toContain("spec-scaling");
    // 같은 자리가 경로 행에 또 뜨면 사용자는 서로 다른 두 사건으로 읽는다.
    expect(report.updateMode?.foreignOwned ?? []).not.toContain(".claude/skills/spec-scaling");
  });

  it("update 는 깨진 링크 슬롯도 이름으로 낸다 (조용히 빠져나가지 않는다)", () => {
    install();
    const id = installedSkillId();
    const target = join(projectDir, ".claude/skills", id);
    rmSync(target, { recursive: true, force: true });
    symlinkSync(join(foreignRepo, "사라진-저장소"), target);

    const report = runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: specOf(),
      mode: "update",
    });

    expect(report.updateMode?.skillsSkippedLinks).toContain(id);
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

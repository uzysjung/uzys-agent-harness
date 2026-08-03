import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildManifest } from "../src/manifest.js";
import { type InstallSpec, TRACKS } from "../src/types.js";

/**
 * 배포판 SPEC/TODO drift 탐지기(ADR-065, #275)의 도달 경로 + 행동 게이트.
 *
 * 이 자산은 한 번 죽어 봤다 — 훅 라벨만 달고 `settings.json` 어디에도 안 붙어 발화 경로가 0이었고,
 * 그래서 2026-08-02 정비에서 "미배선 + 무동작"으로 제거됐다. 복원본은 훅이 아니라 **명시 호출
 * 스크립트**다. 훅이 아니면 죽는 방식이 바뀐다:
 *   ⓐ `templates/` 에는 있는데 manifest 에 없어 **게시는 되고 설치는 안 되는** 회색지대
 *   ⓑ 설치는 되는데 아무 룰도 안 가리켜 설치자가 존재를 모르는 상태(= 제거 전 그 상태)
 * 둘 다 조용하다. 그래서 경로를 **manifest 에서 derive 해** 룰 문안과 대조한다 — 룰과 테스트에
 * 경로를 각각 적으면 그게 두 번째 하드코딩 사본이고 다음 drift 의 서식지다(protect-branch 전례).
 *
 * 행동 단언(describe 2)은 #237(v26.122.0)에서 mutation 까지 마쳤던 면제 로직의 부활분이다.
 * 제거와 함께 실행체가 사라져 그 단언들도 같이 사라졌고, 실행체 없는 단언은 초록불로 태어난
 * 테스트라 증거가 아니다 — 복원과 같은 사이클에 되돌린다.
 */
const ROOT = join(__dirname, "..");
const SOURCE = "scripts/spec-drift-check.sh";
const SCRIPT = join(ROOT, "templates", SOURCE);

const START = "<!-- ship-gate:ignore-start -->";
const END = "<!-- ship-gate:ignore-end -->";

const specFor = (track: string): InstallSpec =>
  ({ tracks: [track], cli: ["claude"], options: {} }) as unknown as InstallSpec;

const entryFor = (track: string) => {
  const spec = specFor(track);
  return buildManifest(spec)
    .filter((e) => e.applies(spec))
    .find((e) => e.source === SOURCE);
};

describe("SPEC/TODO drift 스크립트의 도달 경로", () => {
  it("탐지기가 살아 있다 — manifest 가 엔트리를 실제로 뱉는다", () => {
    // 0건 함정 방지: buildManifest 가 빈 배열이면 아래 전수 검사가 조용히 통과한다.
    const spec = specFor("tooling");
    expect(buildManifest(spec).length).toBeGreaterThan(20);
  });

  it.each([...TRACKS])("track=%s 에 설치된다 — 트랙별 누락 없음", (track) => {
    // 문서 drift 는 트랙과 무관한 관심사다. 한 트랙만 빠지면 그 트랙 설치자는 제거 전과 같은
    // 상태 — "프로즈는 게이트를 지시하는데 게이트가 없는" 상태 — 로 남는다.
    expect(entryFor(track), `${track} 에 ${SOURCE} 가 안 깔린다`).toBeDefined();
  });

  it("설치 타깃이 CLI 중립 위치다 — `.claude/` 아래가 아니다", () => {
    // SPEC/TODO 는 4개 CLI 와 사람이 함께 보는 문서다. `.claude/` 에 두면 codex/opencode/
    // antigravity 설치본에서 룰이 가리키는 경로가 실제로 존재하지 않는다.
    const target = entryFor("tooling")?.target ?? "";
    expect(target).not.toMatch(/^\.claude\//);
    expect(target).toMatch(/\.sh$/);
  });

  it("원본 파일이 실재하고 계약을 스스로 설명한다", () => {
    const body = readFileSync(SCRIPT, "utf8");
    // 면제 표식은 이 스크립트의 존재 이유다(상시 차단 → 우회 관행 → 게이트 사망 경로를 끊은 것).
    // 본문에 없으면 복원된 것은 #237 이전의 상시 차단판이다.
    expect(body).toContain("ship-gate:ignore-start");
    expect(body).toContain("ship-gate:ignore-end");
    // 호출자(룰)가 exit 2 로 차단을 판정한다 — 계약이 본문에 안 적히면 다음 사람이 코드를
    // 읽어 유추해야 하고, 유추는 조용히 틀린다.
    expect(body).toMatch(/Exit codes/i);
    expect(body).toContain("exit 2");
  });

  it("배포 룰 2종이 **manifest 가 정한 그 경로**를 가리킨다 (derive 대조)", () => {
    const target = entryFor("tooling")?.target;
    expect(target).toBeDefined();

    for (const rule of ["ship-checklist.md", "doc-governance.md"]) {
      const body = readFileSync(join(ROOT, "templates", "rules", rule), "utf8");
      expect(
        body,
        `${rule} 이 설치 경로 ${target} 를 안 가리킨다 — 설치는 되는데 아무도 모르는 자산이 된다`,
      ).toContain(target as string);
    }
  });

  it("ship-checklist 가 호출 형태와 차단 기준(exit 2)까지 적는다", () => {
    // "스크립트가 있다"까지만 적힌 룰은 실행 지시가 아니다. 어떤 인자로 부르고 무엇을 보고
    // 막는지가 없으면 제거 전과 같은 상태 — 실행되지 않는 프로즈 — 로 되돌아간다.
    const target = entryFor("tooling")?.target as string;
    const body = readFileSync(join(ROOT, "templates", "rules", "ship-checklist.md"), "utf8");
    expect(body, "ship 모드 호출 형태가 안 적혀 있다").toContain(`bash ${target} ship`);
    expect(body, "무엇을 보고 차단하는지(exit 2)가 안 적혀 있다").toMatch(/exit 2/i);
  });
});

// ── 행동 계약 (#237 v26.122.0 의 면제 로직) ──────────────────────────────────────────
//
// WHY: ship 게이트가 `[ ]` 개수만 세고 내용을 안 보면 "언젠가 할 일(백로그)"과 "이번 사이클에
//   하기로 해놓고 안 한 것(진짜 drift)"이 구분되지 않는다. 백로그는 정상적으로 항상 존재하므로
//   게이트는 상시 차단이 되고, 사람들은 체크박스를 안 쓰는 쪽으로 우회한다 → 셀 게 없어 게이트가
//   죽는다. 해법이 면제 표식이고, **기본값은 검사 · 면제는 표식이 있는 쪽 · 표식이 깨지면
//   fail-closed** 라는 세 조건이 함께여야 우회 경로가 안 생긴다.

const tmpDirs: string[] = [];

/** SPEC 은 깨끗하게 두고 todo 만 변주한다 — 판정이 어느 파일에서 왔는지 모호해지지 않게. */
function makeProject(todoBody: string): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-drift-script-"));
  tmpDirs.push(dir);
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "SPEC.md"), ["# Spec", "", "- [x] 정의 완료", ""].join("\n"));
  writeFileSync(join(dir, "docs", "todo.md"), todoBody);
  return dir;
}

type RunResult = { status: number; stdout: string; stderr: string };

/**
 * 파이프를 쓰지 않는다 — `cmd | tail` 의 `$?` 는 `tail` 의 것이고, 그 함정을 이 리포가 이미
 * 밟았다(`cli-development.md`). spawnSync 는 종료 코드를 직접 준다.
 */
function runScript(projectDir: string, mode?: "ship"): RunResult {
  const r = spawnSync("bash", [SCRIPT, ...(mode ? [mode] : [])], {
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
    encoding: "utf-8",
  });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe("ship 게이트 백로그 면제 — 행동", () => {
  it("면제 표식 밖의 unchecked 는 ship 을 차단한다 (게이트가 원래 잡으려던 것)", () => {
    const dir = makeProject(
      ["# Todo", "", "## 이번 사이클", "- [ ] 약속하고 안 한 것", ""].join("\n"),
    );

    const r = runScript(dir, "ship");

    expect(r.status, `ship 게이트가 차단하지 않았다.\n${r.stdout}\n${r.stderr}`).toBe(2);
    expect(r.stderr).toContain("BLOCKED");
  });

  it("면제 표식 안의 unchecked 는 세지 않는다 (백로그는 drift 가 아니다)", () => {
    const dir = makeProject(
      [
        "# Todo",
        "",
        "## 이번 사이클",
        "- [x] 다 한 것",
        "",
        "## 백로그",
        START,
        "- [ ] 언젠가 할 일 A",
        "- [ ] 언젠가 할 일 B",
        "  - [ ] 중첩된 것도 면제",
        END,
        "",
      ].join("\n"),
    );

    const r = runScript(dir, "ship");

    expect(
      r.status,
      `백로그만 남았는데 ship 이 막혔다 — 면제가 동작하지 않는다.\n${r.stdout}\n${r.stderr}`,
    ).toBe(0);
  });

  it("면제 구간 밖에 하나라도 있으면 여전히 차단한다 (면제가 파일 전체로 번지지 않는다)", () => {
    const dir = makeProject(
      [
        "# Todo",
        "",
        "## 이번 사이클",
        "- [ ] 약속하고 안 한 것",
        "",
        "## 백로그",
        START,
        "- [ ] 언젠가 할 일",
        END,
        "",
      ].join("\n"),
    );

    const r = runScript(dir, "ship");

    expect(r.status, `면제 구간이 파일 전체를 덮었다.\n${r.stdout}\n${r.stderr}`).toBe(2);
  });

  // WHY: 깨진 표식이 "면제가 넓어지는" 쪽으로 작동하면 표식 하나 잘못 쓰는 것만으로 게이트를
  //   통째로 끌 수 있다 — 우회 관행을 코드로 옮겨놓는 셈이다. 그래서 fail-closed 여야 한다.
  it("표식이 닫히지 않으면 면제를 통째로 무시한다 (fail-closed) + 경고를 낸다", () => {
    const dir = makeProject(
      ["# Todo", "", "## 백로그", START, "- [ ] 닫는 표식이 없다", ""].join("\n"),
    );

    const r = runScript(dir, "ship");

    expect(
      r.status,
      `표식이 깨졌는데 통과했다 — 게이트를 끄는 경로가 생긴다.\n${r.stdout}\n${r.stderr}`,
    ).toBe(2);
    expect(r.stderr, "깨진 표식이 조용히 넘어갔다").toMatch(/ship-gate:ignore/);
  });

  // WHY: 이 기능을 도입한 커밋에서 실제로 밟은 함정이다. todo.md 헤더에 사용법을 백틱으로
  //   인용했더니 그 산문 줄이 진짜 표식으로 잡혀 start/end 짝이 깨졌다(fail-closed 가 잡아냈다).
  //   기능을 그 기능이 적용되는 파일 안에서 문서화할 수 없으면 쓸 수 없는 기능이다.
  it("산문 안에 인용된 표식은 면제를 열지 않는다 (단독 줄만 인정)", () => {
    const dir = makeProject(
      [
        "# Todo",
        "",
        `> 백로그는 \`${START}\` ~ \`${END}\` 로 감싼다.`,
        "",
        "- [ ] 이번 사이클 미완",
        "",
      ].join("\n"),
    );

    const r = runScript(dir, "ship");

    expect(
      r.status,
      `산문 인용이 면제를 열었다 — 문서화가 게이트를 끄는 경로가 된다.\n${r.stdout}\n${r.stderr}`,
    ).toBe(2);
    expect(r.stderr, "짝 불일치 경고가 났다 = 산문을 표식으로 오인했다").not.toMatch(/표식 불일치/);
  });

  // WHY: 후행 텍스트 축 — 변이 생존 실측으로 추가. awk start 규칙에서 **후행 `$` 앵커**를 뺀
  //   변이본이 기존 스위트를 전부 통과했다. 바로 위 산문 케이스는 표식 앞에 `> ` 가 붙어
  //   선행 앵커(`^`)가 혼자 막아내기 때문에 후행 앵커가 사라져도 초록이다 — "단독 줄만 인정"의
  //   절반만 무는 셈이다. 표식 **뒤**에 텍스트가 붙은 줄이 나머지 절반이고, 후행 앵커가 없으면
  //   그 줄이 표식으로 잡혀 짝이 맞아버려 면제가 조용히 열린다(차단 exit 2 → 통과 exit 0).
  it("표식 뒤에 텍스트가 붙은 줄은 표식이 아니다 (단독 줄만 인정 — 후행 축)", () => {
    const dir = makeProject(
      [
        "# Todo",
        "",
        "## 백로그",
        `${START} 이 줄은 표식이 아니라 산문이다`,
        "- [ ] 면제되면 안 되는 미완 항목",
        END,
        "",
      ].join("\n"),
    );

    const r = runScript(dir, "ship");

    expect(
      r.status,
      `표식 뒤 후행 텍스트가 면제를 열었다 — start 가 인정되지 않으니 짝 불일치로 차단해야 한다.\n${r.stdout}\n${r.stderr}`,
    ).toBe(2);
    expect(
      r.stderr,
      "짝 불일치 경고가 없다 = 후행 텍스트가 붙은 줄을 진짜 표식으로 인정했다",
    ).toMatch(/표식 불일치/);
  });

  it("면제 표식이 전혀 없는 기존 문서는 종전대로 전부 검사한다 (기본값 = 검사)", () => {
    const dir = makeProject(["# Todo", "", "- [ ] 표식 없는 미완 항목", ""].join("\n"));

    const r = runScript(dir, "ship");

    expect(r.status, "표식 없는 문서에서 면제가 기본값이 됐다").toBe(2);
  });
});

// WHY: 픽스처만 보면 "표식 파싱이 맞다"까지만 확인된다. 우리 문서 레이아웃에서 실제로 통과하는지는
//   이 저장소를 대상으로 돌려봐야 안다 — 그 둘이 갈렸던 상태를 이미 겪었다(산문 인용 오인).
//   `docs/todo.md` 는 쉬는 상태 추적기이고 열린 사이클은 `docs/plans/*-todo.md` 로 분리한다는
//   계약이 살아 있으면 여기는 항상 0 이어야 한다.
describe("dogfood — 이 저장소에서 ship 게이트가 통과한다", () => {
  it("ROOT 를 대상으로 ship 모드가 exit 0", () => {
    const r = runScript(ROOT, "ship");
    expect(r.status, `실 저장소에서 ship 이 막힌다.\n${r.stdout}\n${r.stderr}`).toBe(0);
  });
});

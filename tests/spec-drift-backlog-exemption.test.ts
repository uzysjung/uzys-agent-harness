import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// WHY (v26.122.0): ship 게이트가 todo.md 의 `[ ]` 개수만 세고 **내용을 보지 않아서**
//   "언젠가 할 일(백로그)"과 "이번 사이클에 하기로 해놓고 안 한 것(진짜 drift)"을 구분하지
//   못했다. 백로그는 정상적으로 항상 존재하므로 게이트는 사실상 상시 차단 상태가 되고,
//   그 결과 todo.md 가 "열린 목표는 ship gate drift 를 피하려 비체크박스로 둔다"는 **우회를
//   관행으로 성문화**했다 — 셀 게 없으니 게이트는 아무것도 잡지 못한다. no-false-ship 의
//   "주석 경고 ≠ 차단 수단"과 동일한 실패다.
//
//   해법은 면제 구간 표식이다. 단 **기본값은 검사**여야 하고 면제는 표식이 있는 쪽이어야
//   한다(no-false-ship: "면제는 표식이 있는 쪽"). 그리고 표식이 깨졌을 때 면제가 넓어지면
//   게이트를 무력화하는 새 경로가 되므로 **fail-closed**(면제 통째 무시)로 설계한다.

const HOOKS = [".claude/hooks/spec-drift-check.sh", "templates/hooks/spec-drift-check.sh"] as const;

const START = "<!-- ship-gate:ignore-start -->";
const END = "<!-- ship-gate:ignore-end -->";

const tmpDirs: string[] = [];

function makeProject(todoBody: string): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-drift-"));
  tmpDirs.push(dir);
  mkdirSync(join(dir, "docs"), { recursive: true });
  writeFileSync(join(dir, "docs", "todo.md"), todoBody);
  return dir;
}

type RunResult = { status: number; stdout: string; stderr: string };

function runHook(hook: string, projectDir: string, mode?: "ship"): RunResult {
  try {
    const stdout = execFileSync("bash", [hook, ...(mode ? [mode] : [])], {
      env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { status: err.status ?? -1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

describe.each(HOOKS)("ship 게이트 백로그 면제 — %s", (hook) => {
  it("면제 표식 밖의 unchecked 는 ship 을 차단한다 (게이트가 원래 잡으려던 것)", () => {
    // 이번 사이클에 하기로 해놓고 안 한 것 = 진짜 drift.
    const dir = makeProject(
      ["# Todo", "", "## 이번 사이클", "- [ ] 약속하고 안 한 것", ""].join("\n"),
    );

    const r = runHook(hook, dir, "ship");

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

    const r = runHook(hook, dir, "ship");

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

    const r = runHook(hook, dir, "ship");

    expect(r.status, `면제 구간이 파일 전체를 덮었다.\n${r.stdout}\n${r.stderr}`).toBe(2);
  });

  // WHY: 깨진 표식이 "면제가 넓어지는" 쪽으로 작동하면, 표식 하나 잘못 쓰는 것만으로 게이트를
  //   통째로 끌 수 있다 — 우회 관행을 코드로 옮겨놓는 셈이다. 그래서 fail-closed 여야 한다.
  it("표식이 닫히지 않으면 면제를 통째로 무시한다 (fail-closed) + 경고를 낸다", () => {
    const dir = makeProject(
      ["# Todo", "", "## 백로그", START, "- [ ] 닫는 표식이 없다", ""].join("\n"),
    );

    const r = runHook(hook, dir, "ship");

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

    const r = runHook(hook, dir, "ship");

    expect(
      r.status,
      `산문 인용이 면제를 열었다 — 문서화가 게이트를 끄는 경로가 된다.\n${r.stdout}\n${r.stderr}`,
    ).toBe(2);
    expect(r.stderr, "짝 불일치 경고가 났다 = 산문을 표식으로 오인했다").not.toMatch(/표식 불일치/);
  });

  it("면제 표식이 전혀 없는 기존 문서는 종전대로 전부 검사한다 (기본값 = 검사)", () => {
    const dir = makeProject(["# Todo", "", "- [ ] 표식 없는 미완 항목", ""].join("\n"));

    const r = runHook(hook, dir, "ship");

    expect(r.status, "표식 없는 문서에서 면제가 기본값이 됐다").toBe(2);
  });
});

// WHY: 훅이 두 벌(.claude 도그푸드 · templates 배포본)로 존재한다. 한쪽만 고치면 배포본과
//   자기 사용분이 갈리고, 그 drift 는 조용하다 — 이 repo 가 반복해서 겪은 실패다.
describe("사본 drift 차단", () => {
  it("두 훅 사본 모두 면제 표식과 fail-closed 처리를 갖는다", () => {
    for (const hook of HOOKS) {
      const src = readFileSync(hook, "utf-8");
      expect(src, `${hook} 에 면제 표식 처리가 없다`).toContain("ship-gate:ignore-start");
      expect(src, `${hook} 에 닫는 표식 처리가 없다`).toContain("ship-gate:ignore-end");
    }
  });
});

// WHY: 이 게이트를 실제로 쓰는 문서가 우회 문장("비체크박스로 둔다")을 성문화해 두면, 면제
//   기능을 넣어도 관행은 안 바뀐다. 문서가 새 방식을 가리키는지까지가 이번 변경의 범위다.
describe("우회 관행 제거", () => {
  it("docs/todo.md 가 '비체크박스' 우회를 더 이상 지시하지 않는다", () => {
    const todo = readFileSync("docs/todo.md", "utf-8");
    expect(
      todo.includes("비체크박스로 둔다"),
      "todo.md 가 여전히 게이트 우회를 관행으로 지시하고 있다",
    ).toBe(false);
  });

  it("docs/todo.md 의 백로그 구간이 면제 표식으로 감싸여 있다 (단독 줄 기준)", () => {
    const todo = readFileSync("docs/todo.md", "utf-8");
    // 훅과 같은 기준으로 센다 — 단독 줄만 표식이다. 산문 인용을 함께 세면 이 테스트가
    // 훅과 다른 계산을 하게 되고, 그러면 통과해도 실제 게이트는 막힌다(그 상태를 겪었다).
    const standalone = (marker: string) =>
      todo.split("\n").filter((l) => l.trim() === marker).length;
    const starts = standalone(START);
    expect(starts, "백로그 면제 표식이 없다").toBeGreaterThan(0);
    expect(standalone(END), "표식이 열리고 닫히지 않았다 (fail-closed 로 무의미해진다)").toBe(
      starts,
    );
  });

  // WHY: 테스트가 문서 상태만 보면 "표식이 짝이 맞다"까지만 확인된다. 실제로 게이트가 통과하는지는
  //   훅을 진짜 돌려봐야 안다 — 이 둘이 갈렸던 상태를 이미 겪었다(산문 인용 오인).
  it("실제 저장소에서 ship 게이트가 통과한다 (백로그만 남은 상태)", () => {
    const r = runHook(HOOKS[0], process.cwd(), "ship");
    expect(r.status, `실 저장소에서 ship 이 막힌다.\n${r.stdout}\n${r.stderr}`).toBe(0);
  });
});

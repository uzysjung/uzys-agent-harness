import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `scripts/check-absence.sh` — "이 패턴이 없다"를 **증거로** 만드는 도구.
 *
 * WHY: `cli-development.md` §"검증 명령은 실패해도 조용하다" 가 세 가지를 이미 규정하는데
 * (빈 결과 ≠ 부재 · 파이프 뒤 exit code · 탐지기 먼저 검증), 한 세션에서 **셋 다 깨졌다**:
 * 대소문자 구분 grep 으로 2건을 놓치고 "잔여 0" 선언 · `grep | sort || echo` 로 exit code 를
 * 가림 · 탐지기를 안 보고 빈 출력을 신뢰. 프로즈가 실패했으므로 도구로 내렸다.
 *
 * 이 테스트는 도구의 **거절 능력**을 지킨다. 도구가 항상 0 을 뱉으면 없느니만 못하다.
 */
const SCRIPT = resolve(__dirname, "../scripts/check-absence.sh");

function run(args: string[], cwd: string): { code: number; out: string } {
  try {
    const out = execFileSync("bash", [SCRIPT, ...args], { cwd, encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("check-absence.sh — 부재를 증거로 만든다", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "absence-"));
    writeFileSync(join(dir, "clean.txt"), "nothing to see\n");
    writeFileSync(join(dir, "dirty.txt"), "contains GoalTrack here\n");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("정말 없으면 0 — 매치 건수를 명시 출력한다 (빈 출력로 얼버무리지 않는다)", () => {
    const r = run(["--canary", "GoalTrack", "GoalTrack", "clean.txt"], dir);
    expect(r.code).toBe(0);
    expect(r.out).toContain("매치: 0건");
  });

  it("있으면 1 — 위치를 보여준다", () => {
    const r = run(["--canary", "GoalTrack", "GoalTrack", "dirty.txt"], dir);
    expect(r.code).toBe(1);
    expect(r.out).toContain("dirty.txt");
  });

  /** 이 세션의 실제 사고: 소문자 패턴 + 대문자 실 데이터 → 놓치고 "잔여 0" 선언. */
  it("탐지기가 canary 를 못 잡으면 2 — '없음'을 결론으로 내주지 않는다", () => {
    const r = run(["--canary", "GoalTrack", "goaltrack", "dirty.txt"], dir);
    expect(r.code).toBe(2);
    expect(r.out).toContain("탐지기 자기검증 실패");
  });

  it("-i 는 자기검증과 실검사에 동시 적용된다 — 한쪽만 적용되면 구멍이 생긴다", () => {
    const r = run(["--canary", "GoalTrack", "-i", "goaltrack", "dirty.txt"], dir);
    expect(r.code).toBe(1); // 대소문자 무시하면 잡혀야 한다
  });

  it("경로가 없으면 2 — '없음'이 아니라 '안 봤음'이다", () => {
    const r = run(["--canary", "x", "x", "no-such-file.txt"], dir);
    expect(r.code).toBe(2);
    expect(r.out).toContain("안 봤음");
  });

  it("canary 없이는 쓸 수 없다 — 그게 이 도구의 존재 이유다", () => {
    const r = run(["GoalTrack", "clean.txt"], dir);
    expect(r.code).toBe(3);
  });
});

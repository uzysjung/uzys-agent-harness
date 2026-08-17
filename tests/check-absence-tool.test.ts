import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * `check-absence.sh` — 부정 결론("없다" · "안 된다")을 **증거로** 만드는 도구.
 *
 * WHY: `cli-development.md` 가 세 가지를 이미 규정하는데(빈 결과 ≠ 부재 · 파이프 뒤 exit code ·
 * 탐지기 먼저 검증), 한 세션에서 **셋 다 깨졌다**: 대소문자 구분 grep 으로 2건을 놓치고 "잔여 0"
 * 선언 · `grep | sort || echo` 로 exit code 를 가림 · 탐지기를 안 보고 빈 출력을 신뢰.
 * 프로즈가 실패했으므로 도구로 내렸다.
 *
 * 그 뒤 **네 번째 형태**가 났다: Docker 로 설치를 돌려 exit 1 을 보고 "설치 불가"라고 보고했는데,
 * 대조군(이미 되는 자산)도 함께 실패했고 원인은 컨테이너의 `git` 부재였다 — 실험이 무효였지
 * 대상이 안 되는 게 아니었다. grep 전용 도구로는 다룰 수 없는 축이라 `command` 모드를 더했다.
 *
 * 이 테스트가 지키는 것은 도구의 **거절 능력**이다. 도구가 항상 0 을 뱉으면 없느니만 못하다.
 * 그래서 exit code 뿐 아니라 **사람이 읽는 사유 문구**까지 단언한다 — 코드만 맞고 사유가 사라지면
 * 다음 사람은 왜 막혔는지 모른 채 우회한다.
 */

const ROOT = resolve(import.meta.dirname, "..");
const REPO_COPY = join(ROOT, "scripts", "check-absence.sh");
const SHIPPED_COPY = join(ROOT, "templates", "scripts", "check-absence.sh");

function run(
  script: string,
  args: ReadonlyArray<string>,
  cwd: string,
): { code: number; out: string } {
  try {
    const out = execFileSync("bash", [script, ...args], { cwd, encoding: "utf8" });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? -1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

describe("두 사본이 갈라지지 않는다", () => {
  // 개발용(`scripts/`)과 배포용(`templates/scripts/`)이 다르게 동작하면, 이 저장소에서 확인한
  // 것이 설치받은 사람에게서 참이라는 보장이 사라진다. 스크립트 안 호출 예시에 디렉터리 접두사를
  // 두지 않은 것도 이 동일성을 유지하려는 것이다.
  it("scripts/ 와 templates/scripts/ 의 check-absence.sh 가 바이트 단위로 같다", () => {
    expect(readFileSync(SHIPPED_COPY, "utf8")).toBe(readFileSync(REPO_COPY, "utf8"));
  });
});

for (const [label, SCRIPT] of [
  ["repo", REPO_COPY],
  ["shipped", SHIPPED_COPY],
] as const) {
  describe(`${label} 사본 — 부재를 증거로 만든다`, () => {
    let dir = "";
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "absence-"));
      writeFileSync(join(dir, "clean.txt"), "nothing to see\n");
      writeFileSync(join(dir, "dirty.txt"), "contains OldName here\n");
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    describe("pattern 모드 — 대조군은 합성한 canary 다", () => {
      it("정말 없으면 0 — 매치 건수를 명시 출력한다 (빈 출력로 얼버무리지 않는다)", () => {
        const r = run(SCRIPT, ["--canary", "OldName", "OldName", "clean.txt"], dir);
        expect(r.code).toBe(0);
        expect(r.out).toContain("매치: 0건");
      });

      it("있으면 1 — 위치를 보여준다", () => {
        const r = run(SCRIPT, ["--canary", "OldName", "OldName", "dirty.txt"], dir);
        expect(r.code).toBe(1);
        expect(r.out).toContain("dirty.txt");
      });

      /** 이 도구를 만들게 한 실제 사고: 소문자 패턴 + 대문자 실 데이터 → 놓치고 "잔여 0" 선언. */
      it("탐지기가 canary 를 못 잡으면 2 — '없음'을 결론으로 내주지 않는다", () => {
        const r = run(SCRIPT, ["--canary", "OldName", "oldname", "dirty.txt"], dir);
        expect(r.code).toBe(2);
        expect(r.out).toContain("탐지기 자기검증 실패");
      });

      it("-i 는 자기검증과 실검사에 동시 적용된다 — 한쪽만 적용되면 구멍이 생긴다", () => {
        const r = run(SCRIPT, ["--canary", "OldName", "-i", "oldname", "dirty.txt"], dir);
        expect(r.code).toBe(1); // 대소문자 무시하면 잡혀야 한다
      });

      it("경로가 없으면 2 — '없음'이 아니라 '안 봤음'이다", () => {
        const r = run(SCRIPT, ["--canary", "x", "x", "no-such-file.txt"], dir);
        expect(r.code).toBe(2);
        expect(r.out).toContain("안 봤음");
      });

      it("canary 없이는 쓸 수 없다 — 그게 이 도구의 존재 이유다", () => {
        const r = run(SCRIPT, ["OldName", "clean.txt"], dir);
        expect(r.code).toBe(3);
      });
    });

    describe("command 모드 — 대조군은 '되는 줄 아는 대상'이다", () => {
      it("대조 성공 + 대상 실패 → 0. 무엇이 대조군이었는지 출력에 남는다", () => {
        const r = run(SCRIPT, ["--control", "true", "--subject", "false"], dir);
        expect(r.code).toBe(0);
        expect(r.out).toContain("대조군");
        expect(r.out).toContain("부정 결론이 증거를 얻었다");
      });

      it("대조 성공 + 대상 성공 → 1 ('안 된다'가 틀렸다)", () => {
        const r = run(SCRIPT, ["--control", "true", "--subject", "true"], dir);
        expect(r.code).toBe(1);
        expect(r.out).toContain("'안 된다'는 결론은 틀렸다");
      });

      /**
       * 이 한 줄이 command 모드의 존재 이유다. 대조군까지 함께 실패했는데 대상의 exit 1 만 보고
       * "설치 불가"라고 보고한 적이 있다 — 코드가 아니라 **사유 문구**가 그때 필요했던 것이다.
       */
      it("대조군이 실패하면 대상도 실패해도 2 — 실험 자체가 무효다", () => {
        const r = run(SCRIPT, ["--control", "false", "--subject", "false"], dir);
        expect(r.code).toBe(2);
        expect(r.out).toContain("대조군이 기대");
        expect(r.out).toContain("증거가 아니다");
      });

      it("--control-exit 로 대조군의 기대 코드를 옮길 수 있다", () => {
        const r = run(
          SCRIPT,
          ["--control", "false", "--control-exit", "1", "--subject", "false"],
          dir,
        );
        expect(r.code).toBe(0);
      });

      it("대조군 stderr 를 삼키지 않는다 — 왜 무효인지가 보여야 고친다", () => {
        const r = run(SCRIPT, ["--control", "echo boom >&2; exit 7", "--subject", "false"], dir);
        expect(r.code).toBe(2);
        expect(r.out).toContain("boom");
      });
    });

    describe("사용법 오류는 3 — 판정 코드와 섞이지 않는다", () => {
      it.each([
        ["인자 없음", [] as ReadonlyArray<string>],
        ["--subject 누락", ["--control", "true"]],
        ["--control 누락", ["--subject", "true"]],
        ["두 모드 혼용", ["--canary", "x", "--control", "true", "--subject", "true"]],
        [
          "--control-exit 비숫자",
          ["--control", "true", "--subject", "true", "--control-exit", "a"],
        ],
      ])("%s", (_desc, args) => {
        expect(run(SCRIPT, args, dir).code).toBe(3);
      });
    });
  });
}

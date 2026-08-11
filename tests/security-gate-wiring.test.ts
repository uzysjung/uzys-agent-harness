import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 보안 게이트가 **돌아갈 수 있고 배선돼 있는지**.
 *
 * WHY (v26.146.0 실측): ship-checklist 의 보안 항목이 `npx ecc-agentshield scan` **CRITICAL/HIGH
 * 없음**을 요구했다. 그런데 이 저장소가 파는 에이전트는 Bash 를 갖고 훅은 백그라운드 프로세스를
 * 띄운다 — 스캐너가 설계상 high 로 잡는 것들이라 **절대 0 은 영원히 성립하지 않는다.**
 * 통과할 수 없는 게이트는 아무도 안 돌린다. 실제로 v26.146.0 은 그 항목을 건너뛴 채 배포됐고,
 * 배포 후에 돌려 보고서야 조건이 불가능하다는 것을 알았다. 이 리포는 같은 형태로 한 번 다쳤다
 * (#237 — ship 게이트가 백로그를 drift 로 오인해 상시 차단하자 우회가 관행으로 성문화됐다).
 *
 * 그래서 조건을 **baseline 대비 신규 0**(달성 가능·회귀는 잡음)으로 바꾸고, 검사를 릴리즈 CI 의
 * `ci` job **안**에 넣었다. `publish` 가 `needs: ci` 이므로 red 면 게시가 안 일어난다.
 *
 * 이 게이트가 무는 것은 **배선**이지 스캔 결과가 아니다 — 스캔은 네트워크가 필요해 매 `npm run ci`
 * 에서 돌리지 않는다(로컬은 ship 시점에 `npm run security`, 원격은 태그 CI 가 강제).
 */

const ROOT = resolve(__dirname, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const pkg = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
const workflow = read(".github/workflows/test.yml");
const rule = read(".claude/rules/ship-checklist.md");

describe("보안 게이트 배선", () => {
  it("한 명령으로 돌릴 수 있다 — 손으로 조립해야 하는 검사는 안 돌아간다", () => {
    expect(pkg.scripts?.security, "`npm run security` 가 없다").toBeTruthy();
    expect(
      pkg.scripts?.["security:baseline"],
      "baseline 갱신 경로가 없으면 신규 findings 를 받아들일 방법이 없어 게이트가 다시 상시 차단이 된다",
    ).toBeTruthy();
  });

  it("달성 가능한 조건을 쓴다 — baseline 회귀 + 게시되는 의존성", () => {
    const cmd = pkg.scripts?.security ?? "";
    // baseline 비교가 없으면 절대 0 요구로 되돌아간다(설계상 high 29건이라 영원히 red).
    expect(cmd, "baseline 비교가 빠졌다").toContain("--baseline");
    expect(cmd, "회귀 판정(--gate)이 빠졌다").toContain("--gate");
    // 빌드 도구의 취약점은 설치자에게 도달하지 않는다 — 게시되는 것만 본다.
    expect(cmd, "`--omit=dev` 가 빠지면 빌드 도구 취약점이 릴리즈를 막는다").toContain(
      "--omit=dev",
    );
  });

  it("baseline 파일이 실재하고 비어 있지 않다 — 빈 baseline 은 게이트를 공허하게 만든다", () => {
    expect(existsSync(join(ROOT, "security-baseline.json"))).toBe(true);
    const baseline = JSON.parse(read("security-baseline.json")) as {
      findings?: unknown[];
    };
    // 0건짜리 baseline 이면 `--gate` 가 무엇과 대조하는지 알 수 없다. 실측 190건 근처로 조인다.
    expect(baseline.findings?.length ?? 0).toBeGreaterThan(100);
  });

  it("게시를 막는 자리에 있다 — `ci` job 안이어야 `needs: ci` 가 성립한다", () => {
    // 별도 워크플로로 빼면 v26.128.0~131.0 형태(검증 red 인데 게시 성공)가 재현된다.
    const ciJob = workflow.split("\n  publish:")[0] ?? "";
    expect(ciJob, "workflow 를 job 경계로 못 잘랐다 — 이 단언이 공허해진다").toContain("jobs:");
    expect(ciJob, "보안 게이트가 `ci` job 밖에 있다").toContain("npm run security");
    expect(workflow, "`publish` 가 `ci` 에 묶여 있지 않다").toMatch(/publish:[\s\S]*needs: ci/);
  });

  it("룰이 그 명령을 가리키고 달성 불가능한 절대값을 요구하지 않는다", () => {
    expect(rule).toContain("npm run security");
    // 이 문구가 되살아나면 게이트는 다시 영원히 red 가 되고 다음 사람이 또 건너뛴다.
    expect(rule, "절대 0 요구가 되살아났다 — 설계상 high 29건이라 통과할 수 없다").not.toMatch(
      /ecc-agentshield scan` CRITICAL\/HIGH 없음/,
    );
  });
});

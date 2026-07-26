import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installCiScaffold } from "../src/ci-scaffold.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec, OptionFlags, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

const NO_OPTS: OptionFlags = {
  withPrune: false,
  withCodexTrust: false,
  withKarpathyHook: false,
};

describe("installCiScaffold (라이프사이클 자산화 ② — ADR-037)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ci-scaffold-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const run = (tracks: Track[]) =>
    installCiScaffold({ harnessRoot: HARNESS_ROOT, projectDir, tracks });

  // WHY: track → variant 매핑이 결정론이어야 사용자가 받는 파일을 사전에 알 수 있다
  //   (결정론 변환에 모델을 쓰지 않는다 — 코드가 답할 수 있으면 코드가 답한다).
  it("node 트랙(ssr-nextjs): ci.yml + e2e.yml 설치, python 변형 없음", () => {
    const report = run(["ssr-nextjs"]);
    expect(report.written.sort()).toEqual([
      ".github/workflows/ci.yml",
      ".github/workflows/e2e.yml",
    ]);
    expect(existsSync(join(projectDir, ".github/workflows/ci-python.yml"))).toBe(false);
    expect(report.skippedExisting).toEqual([]);
  });

  it("python 전용 트랙(data): ci-python.yml 만 (node CI · e2e 없음)", () => {
    const report = run(["data"]);
    expect(report.written).toEqual([".github/workflows/ci-python.yml"]);
    expect(existsSync(join(projectDir, ".github/workflows/ci.yml"))).toBe(false);
    expect(existsSync(join(projectDir, ".github/workflows/e2e.yml"))).toBe(false);
  });

  it("polyglot 트랙(csr-fastapi): node + python + e2e 3종 전부", () => {
    const report = run(["csr-fastapi"]);
    expect(report.written.sort()).toEqual([
      ".github/workflows/ci-python.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/e2e.yml",
    ]);
  });

  // WHY: 명시 --with 인데 트랙이 매핑 밖(PM 단독)이면 무설치 = silent no-op (no-false-ship 위반).
  //   제네릭 node 스캐폴드 fallback 이 무설치보다 정직하다.
  it("비-dev 트랙(project-management) 명시 opt-in: node ci.yml fallback (silent no-op 방지)", () => {
    const report = run(["project-management"]);
    expect(report.written).toEqual([".github/workflows/ci.yml"]);
  });

  // WHY: `.claude/` 밖에 쓰는 첫 자산 — 사용자의 기존 CI 를 덮어쓰면 파이프라인 파괴.
  //   no-clobber 는 이 자산의 핵심 안전 계약이다.
  it("기존 워크플로 파일은 절대 덮어쓰지 않고 skippedExisting 으로 보고", () => {
    const existing = join(projectDir, ".github/workflows/ci.yml");
    mkdirSync(join(projectDir, ".github/workflows"), { recursive: true });
    writeFileSync(existing, "# user-owned CI — must survive\n");

    const report = run(["ssr-nextjs"]);

    expect(readFileSync(existing, "utf-8")).toBe("# user-owned CI — must survive\n");
    expect(report.skippedExisting).toEqual([".github/workflows/ci.yml"]);
    // 나머지 파일은 정상 설치 (부분 skip 이 전체 abort 가 되면 안 됨).
    expect(report.written).toEqual([".github/workflows/e2e.yml"]);
  });

  it("설치된 템플릿은 fill-in 스캐폴드다 (FILL 마커 + tag 트리거 + no-overwrite 고지)", () => {
    run(["csr-fastapi"]);
    for (const f of ["ci.yml", "ci-python.yml", "e2e.yml"]) {
      const text = readFileSync(join(projectDir, ".github/workflows", f), "utf-8");
      expect(text, `${f}: FILL 마커`).toContain("FILL");
      expect(text, `${f}: tag-only 트리거 기본`).toContain('tags: ["v*"]');
      expect(text, `${f}: no-overwrite 계약 고지`).toContain("never overwrite");
    }
    // Dev-Prod parity (test-policy) — 실DB 서비스 컨테이너 블록은 CI 변형에 존재해야 한다.
    for (const f of ["ci.yml", "ci-python.yml"]) {
      const text = readFileSync(join(projectDir, ".github/workflows", f), "utf-8");
      expect(text, `${f}: 실DB 서비스 컨테이너 블록`).toContain("postgres");
    }
  });
});

describe("runInstall × ci-scaffold (opt-in 게이팅 + CLI-무관)", () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ci-scaffold-install-"));
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const spec = (over?: Partial<InstallSpec>): InstallSpec => ({
    tracks: ["ssr-nextjs"],
    options: NO_OPTS,
    cli: ["claude"],
    projectDir,
    ...over,
  });

  it("opt-in 미선택 시 .github/ 에 아무것도 쓰지 않는다", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec(),
      runExternal: null,
    });
    expect(report.ciScaffold).toBeNull();
    expect(existsSync(join(projectDir, ".github"))).toBe(false);
  });

  it("--with ci-scaffold (forceInclude) 시 설치 + report.ciScaffold 보고", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({ userOverride: { forceInclude: ["ci-scaffold"], forceExclude: [] } }),
      runExternal: null,
    });
    expect(report.ciScaffold?.written).toContain(".github/workflows/ci.yml");
    expect(existsSync(join(projectDir, ".github/workflows/ci.yml"))).toBe(true);
  });

  // WHY: `.github/` 산출물은 CLI-agnostic — claude 미선택(.claude/ baseline skip)이어도
  //   설치되어야 한다. manifest 경유가 아닌 전용 단계인 이유가 이 테스트다.
  it("claude 미선택(codex 단독)에서도 설치된다 (CLI-agnostic)", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({
        cli: ["codex"],
        userOverride: { forceInclude: ["ci-scaffold"], forceExclude: [] },
      }),
      runExternal: null,
    });
    expect(report.ciScaffold?.written).toContain(".github/workflows/ci.yml");
    expect(existsSync(join(projectDir, ".github/workflows/ci.yml"))).toBe(true);
  });

  it("forceExclude 가 forceInclude 보다 우선한다 (기존 override 우선순위 보존)", () => {
    const report = runInstall({
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: spec({
        userOverride: { forceInclude: ["ci-scaffold"], forceExclude: ["ci-scaffold"] },
      }),
      runExternal: null,
    });
    expect(report.ciScaffold).toBeNull();
  });
});

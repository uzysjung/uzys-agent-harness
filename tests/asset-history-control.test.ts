import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * #879 — `scripts/asset-history.sh`(`npm run assets:history`)의 대조군 검사가 실제로 문다. 대조군(`CLAUDE.md`)이 이력을 내지
 * 않으면 exit 2 로 무효 실행을 선언한다 — 전에는 git log 의 exit 코드만 봐서(매치가 없어도 0) 검사가 발동한 적이 없고, 이력 없는
 * 리포에서 "자산 N개 중 0개 표시." exit 0 으로 유효한 전수 조사처럼 발표했다.
 *
 * 스크립트는 자기 위치의 상위 폴더로 `cd` 하므로 합성 리포의 `scripts/` 에 복사해 돌린다.
 */
const SCRIPT = resolve(__dirname, "..", "scripts", "asset-history.sh");

let repo = "";
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "ah-879-"));
  mkdirSync(join(repo, "scripts"));
  copyFileSync(SCRIPT, join(repo, "scripts", "asset-history.sh"));
  git("init", "-q");
  put("README.md", "# r\n");
  git("add", "README.md");
  git("commit", "-q", "-m", "init");
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

/** 사용자 전역 git 설정(훅 · 서명)이 끼지 않게 격리한 git. */
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
function git(...args: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@example.invalid",
      "-c",
      "commit.gpgsign=false",
      ...args,
    ],
    { cwd: repo, env: gitEnv, stdio: "pipe" },
  );
}

function put(rel: string, text: string): void {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), text);
}

function run(): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync("bash", [join(repo, "scripts", "asset-history.sh")], {
    cwd: repo,
    env: gitEnv,
    encoding: "utf8",
    timeout: 20_000,
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("#879 asset-history 대조군", () => {
  it("자산이 staged 로만 있어 대조군(CLAUDE.md)에 커밋 이력이 없으면 exit 2 로 무효를 선언한다", () => {
    put("CLAUDE.md", "# c\n");
    put("templates/rules/r1.md", "# r1\n");
    git("add", "CLAUDE.md", "templates/rules/r1.md");

    const r = run();

    expect(r.status, r.stdout).toBe(2);
    expect(r.stderr).toContain("대조군(CLAUDE.md)이 이력을 안 낸다");
    expect(r.stdout).not.toContain("개 표시.");
  });

  it("회귀 없음 — 대조군에 이력이 있으면 자산 행을 내고 exit 0", () => {
    put("CLAUDE.md", "# c\n");
    put("templates/rules/r1.md", "# r1\n");
    git("add", "CLAUDE.md", "templates/rules/r1.md");
    git("commit", "-q", "-m", "feat: assets (#1)");

    const r = run();

    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("templates/rules/r1.md");
    expect(r.stdout).toContain("자산 2개 중 2개 표시.");
  });
});

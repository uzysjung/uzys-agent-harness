import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * #888 — 배포판 보호 훅(`templates/hooks/protect-files.sh`)이 대소문자 변형도 막는다.
 *
 * 설치자에게 달라지는 것: macOS·Windows 기본 볼륨은 대소문자를 가리지 않아 에이전트가 `.ENV` 에 쓰면 그 자리의 `.env` 가
 * 통째로 바뀐다. 훅은 이름을 바이트 그대로 비교해 그 쓰기를 통과시켰고 차단 로그에도 남기지 않았다. 이제 이름을 소문자로
 * 접어 비교한다 — 원래 막던 소문자 이름은 그대로 막고, 예시 파일(`.env.example`)과 일반 파일은 그대로 통과한다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = join(ROOT, "templates/hooks/protect-files.sh");
const LOG_REL = join(".uzys-agent-harness", "hook-blocks.log");

let dir = "";
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "harness-protect-case-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function run(rel: string): { status: number | null; stderr: string; logLines: string[] } {
  const res = spawnSync("bash", [HOOK], {
    input: JSON.stringify({ tool_name: "Write", tool_input: { file_path: join(dir, rel) } }),
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    timeout: 10_000,
  });
  const log = join(dir, LOG_REL);
  const logLines = existsSync(log)
    ? readFileSync(log, "utf8")
        .split("\n")
        .filter((l) => l.trim() !== "")
    : [];
  return { status: res.status, stderr: res.stderr ?? "", logLines };
}

describe("#888 protect-files — 대소문자 변형도 막고 차단 로그에 남긴다", () => {
  it.each([
    ".ENV",
    ".Env",
    ".ENV.local",
    ".ENVRC",
    "ID_RSA",
    "Id_Rsa",
    "ID_ED25519",
    "server.PEM",
    "server.KEY",
    "cert.Crt",
    "PACKAGE-LOCK.JSON",
    "GEMFILE.LOCK",
    "gemfile.lock",
    "PIPFILE.LOCK",
    "cargo.lock",
    "Go.Sum",
  ])("%s → exit 2 + 로그 1줄", (name) => {
    const r = run(name);
    expect(
      r.status,
      `${name} 이 통과했다(대소문자 무시 볼륨에서 보호 파일을 덮는다)\n${r.stderr}`,
    ).toBe(2);
    expect(r.logLines).toHaveLength(1);
    expect(r.logLines[0]).toContain(name);
    // 사유 줄은 설치자가 쓴 이름 그대로 말한다
    expect(r.stderr).toContain(`Protected file: ${name}.`);
  });

  it.each([
    ".env",
    ".env.production",
    ".envrc",
    "sub/../.env",
    "id_rsa",
    "server.pem",
    "package-lock.json",
    "Gemfile.lock",
    "Pipfile.lock",
    "Cargo.lock",
    "go.sum",
  ])("원래 막던 %s 는 그대로 막는다", (name) => {
    expect(run(name).status).toBe(2);
  });

  it.each([
    ".env.example",
    ".ENV.EXAMPLE",
    ".env.Sample",
    "src/index.ts",
    "README.md",
    "Environment.ts",
    "docs/KEYS.md",
  ])("%s 는 통과한다 — 과잉 차단 없음 · 로그 없음", (name) => {
    const r = run(name);
    expect(r.status, r.stderr).toBe(0);
    expect(r.logLines).toEqual([]);
  });
});

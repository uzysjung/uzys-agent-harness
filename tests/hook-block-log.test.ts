import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * "차단은 로그를 남긴다" 계약 (룰·훅 다이어트 AC2).
 *
 * 왜 게이트인가: 실측 차단 로그가 **0줄**이다. 무엇이 실제로 막고 있는지 판정할 데이터가
 * 없으니 "훅이 옥죈다 / 아니다"가 느낌 대 느낌으로 남고, 훅을 지울지 남길지를 증거로
 * 고를 수 없다. 로그는 훅의 부수 기능이 아니라 **훅의 가치를 판정하는 유일한 계측**이다.
 *
 * 계약은 셋이다:
 *   ⓐ 차단 입력 → exit 2 + `<project>/.uzys-agent-harness/hook-blocks.log` 에 1줄
 *   ⓑ 통과 입력 → exit 0 + 로그 파일 자체가 없음 (통과를 기록해 로그를 오염시키지 않는다)
 *   ⓒ 로그를 쓸 수 없는 상태여도 **차단은 그대로 exit 2** — 계측이 방어를 깨면 안 된다.
 *      `protect-files.sh` 는 `set -e` 라서 append 실패가 그대로 스크립트를 죽인다.
 *      계측을 넣다가 가드를 잃는 것이 이 게이트가 막는 실패다.
 *
 * 로그 형식은 느슨하게 본다(1줄 · 훅 이름 포함) — 형식 세부는 구현 몫이고, 여기서 필드를
 * 고정하면 계약이 아니라 구현 사본이 된다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOG_REL = join(".uzys-agent-harness", "hook-blocks.log");

interface HookCase {
  /** ROOT 기준 훅 경로. 배포판·설치본 양 사본을 각각 건다. */
  path: string;
  /** 차단돼야 하는 stdin JSON */
  block: unknown;
  /** 통과해야 하는 stdin JSON */
  pass: unknown;
  /** 훅이 읽는 프로젝트 상태를 만든다 (allowlist 등) */
  setup?: (projectDir: string) => void;
  /** 훅의 allow 단락을 무력화하는 env (docker 훅의 CI 우회 등) */
  env?: Record<string, string>;
  /** 이 환경에서 훅이 구조적으로 차단하지 않으면 건너뛴다 */
  skip?: boolean;
  skipReason?: string;
}

/**
 * 대상 훅. `protect-files`·`mcp-pre-exec` 는 배포판과 설치본 **양쪽** — 이 리포는 자기
 * 배포물을 도그푸딩하므로 한쪽만 고치면 파는 것과 쓰는 것이 갈린다.
 * `docker-only-realcli` 는 dev 전용이라 `.claude/` 사본만 있다.
 */
const HOOKS: HookCase[] = [
  ...["templates", ".claude"].map((copy) => ({
    path: `${copy}/hooks/protect-files.sh`,
    block: { tool_name: "Edit", tool_input: { file_path: "/proj/.env" } },
    pass: { tool_name: "Edit", tool_input: { file_path: "/proj/src/index.ts" } },
  })),
  ...["templates", ".claude"].map((copy) => ({
    path: `${copy}/hooks/mcp-pre-exec.sh`,
    // allowlist 가 있어야 opt-in 이 활성된다 — 파일이 없으면 훅은 전부 통과시킨다.
    setup: (projectDir: string) => {
      writeFileSync(join(projectDir, ".mcp-allowlist"), "# 테스트용\ncontext7\n", "utf8");
    },
    block: { tool_name: "mcp__evil__run", tool_input: { arg: "x" } },
    pass: { tool_name: "mcp__context7__query-docs", tool_input: { query: "vitest" } },
  })),
  {
    path: ".claude/hooks/docker-only-realcli.sh",
    // CI 가 세팅돼 있으면 훅이 즉시 통과시킨다 (GitHub Actions 대비 반드시 비운다).
    env: { CI: "" },
    block: { tool_name: "Bash", tool_input: { command: "agent-harness install --track tooling" } },
    pass: { tool_name: "Bash", tool_input: { command: "npm run ci" } },
    // 컨테이너 안에서는 `/.dockerenv` 때문에 훅이 설계상 전부 통과시킨다 — 차단 계약을
    // 물을 수 있는 환경이 아니다. vitest 는 호스트/CI 러너에서 도는 것이 전제.
    skip: existsSync("/.dockerenv"),
    skipReason: "컨테이너 내부 — docker-only-realcli 는 /.dockerenv 가 있으면 통과가 정상",
  },
];

function runHook(hook: HookCase, projectDir: string, payload: unknown) {
  const res = spawnSync("bash", [join(ROOT, hook.path)], {
    input: JSON.stringify(payload),
    cwd: projectDir,
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...hook.env },
    timeout: 10_000,
  });
  return { status: res.status, stderr: res.stderr ?? "", stdout: res.stdout ?? "" };
}

function logPath(projectDir: string): string {
  return join(projectDir, LOG_REL);
}

function logLines(projectDir: string): string[] {
  const p = logPath(projectDir);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");
}

/**
 * 로그를 쓸 수 없는 상태를 만든다. 복구 함수를 돌려준다.
 * root 는 mode bit 을 무시하므로 그때는 디렉터리 자리에 파일을 둬 mkdir/append 를
 * ENOTDIR 로 확실히 실패시킨다 — 어느 환경에서도 ⓒ 가 조용히 통과하지 않게.
 */
function makeLogUnwritable(projectDir: string): () => void {
  const logDir = dirname(logPath(projectDir));
  if (process.getuid?.() === 0) {
    writeFileSync(logDir, "not a directory", "utf8");
    return () => rmSync(logDir, { force: true });
  }
  mkdirSync(logDir, { recursive: true });
  chmodSync(logDir, 0o000);
  return () => chmodSync(logDir, 0o755);
}

for (const hook of HOOKS) {
  const name = basename(hook.path, ".sh");

  const title = hook.skip
    ? `${hook.path} 차단 로그 (skip: ${hook.skipReason})`
    : `${hook.path} 차단 로그`;

  describe.skipIf(hook.skip)(title, () => {
    let dir = "";

    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "harness-hook-block-"));
      hook.setup?.(dir);
    });

    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("ⓐ 차단 입력 → exit 2 이고 로그에 1줄이 남는다", () => {
      const res = runHook(hook, dir, hook.block);
      expect(
        res.status,
        `차단 입력인데 exit ${res.status} 다. 차단 계약(exit 2)이 먼저 깨졌다.\nstderr: ${res.stderr}`,
      ).toBe(2);

      const lines = logLines(dir);
      expect(
        lines.length,
        `차단했는데 ${LOG_REL} 에 1줄이 아니라 ${lines.length}줄이다 — 무엇이 막혔는지 판정할 ` +
          "데이터가 없다(실측 차단 로그 0줄이 이 게이트의 이유).\n" +
          `로그 내용: ${JSON.stringify(lines)}`,
      ).toBe(1);
      expect(
        lines[0],
        `로그 줄에 훅 이름 '${name}' 이 없다 — 어느 훅이 막았는지 구분할 수 없다: ${lines[0]}`,
      ).toContain(name);
    });

    it("ⓑ 통과 입력 → exit 0 이고 로그 파일이 없다", () => {
      const res = runHook(hook, dir, hook.pass);
      expect(
        res.status,
        `통과 입력인데 exit ${res.status} 다 (over-blocking).\nstderr: ${res.stderr}`,
      ).toBe(0);
      expect(
        existsSync(logPath(dir)),
        `통과인데 ${LOG_REL} 이 생겼다 — 통과 기록이 섞이면 로그가 차단 계측으로 못 쓰인다.`,
      ).toBe(false);
    });

    it("ⓒ 로그를 쓸 수 없어도 차단은 exit 2 다", () => {
      const restore = makeLogUnwritable(dir);
      try {
        const res = runHook(hook, dir, hook.block);
        expect(
          res.status,
          `로그 기록이 불가능한 상태에서 exit ${res.status} 로 떨어졌다 — 계측이 방어를 깼다. ` +
            "차단은 로그와 무관하게 exit 2 여야 한다(`set -e` + append 실패가 전형적 경로).\n" +
            `stderr: ${res.stderr}`,
        ).toBe(2);
      } finally {
        restore();
      }
    });
  });
}

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
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * self-hosted-github-runner `runner.sh` 가 **자기가 띄우지 않은 러너를 등록 해제하지 않는다**.
 *
 * WHY: `down` 이 우리 라벨을 단 러너를 이름과 상관없이 모두 지웠다(#930). 잡 코드가 등록 토큰으로
 * 몰래 붙인 러너를 치우려는 것이었는데, 설치자 저장소에 같은 라벨의 상시 러너가 있으면
 * (`LABEL=<그 라벨>` 은 `CI_RUNNER_LABEL` 거부를 피하는 가장 쉬운 우회다) 그 러너까지 해제됐다.
 * 이제 `up` 은 남의 러너가 이미 그 라벨을 달고 있으면 거부하고, 통과하면 이 머신에 claim 을 남긴다.
 * `down` 은 claim 이 있을 때만 이름이 다른 같은 라벨 러너를 지운다.
 *
 * `gh`·`docker` 는 스텁이다 — 실제 GitHub 에 쓰지 않는다. `--jq` 필터는 스크립트의 것을 그대로
 * `jq` 로 평가한다(필터를 스텁이 흉내 내면 스크립트의 판정을 보는 게 아니게 된다).
 */
const SCRIPT = resolve(
  __dirname,
  "../templates/skills/self-hosted-github-runner/scripts/runner.sh",
);
const REPO = "acme/app";
const LABEL = "app-local";
const NAME = "acme-app-runner";

let dir = "";
let home = "";

function runner(id: number, name: string, labels: string[]) {
  return { id, name, status: "online", labels: labels.map((n) => ({ name: n })) };
}
function setRunners(list: ReturnType<typeof runner>[]): void {
  writeFileSync(
    join(dir, "runners.json"),
    JSON.stringify({ total_count: list.length, runners: list }),
  );
}
function log(): string[] {
  const p = join(dir, "calls.log");
  return existsSync(p) ? readFileSync(p, "utf8").trimEnd().split("\n") : [];
}
const writes = () => log().filter((l) => !l.startsWith("GET ") && !l.startsWith("docker logs"));
const claimFile = () => join(home, ".local/state/self-hosted-github-runner/acme@app");

function stub(name: string, body: string): void {
  const p = join(dir, "bin", name);
  writeFileSync(p, `#!/usr/bin/env bash\nD="${dir}"\n${body}`);
  chmodSync(p, 0o755);
}

function run(args: string[]): { code: number; err: string; out: string } {
  const env: Record<string, string | undefined> = {
    ...process.env,
    PATH: `${join(dir, "bin")}:${process.env.PATH}`,
    HOME: home,
    REPO,
    LABEL,
    PLATFORM: "linux/amd64",
  };
  delete env.XDG_STATE_HOME;
  const r = spawnSync("bash", [SCRIPT, ...args], { encoding: "utf8", env, timeout: 20_000 });
  return { code: r.status ?? -1, err: r.stderr ?? "", out: r.stdout ?? "" };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "runner-scope-"));
  home = join(dir, "home");
  mkdirSync(join(dir, "bin"));
  mkdirSync(home);
  stub(
    "gh",
    `[ "$1" = variable ] && { printf '%s' "$5" > "$D/var"; echo "SET CI_RUNNER_LABEL" >> "$D/calls.log"; exit 0; }
shift
method=GET; path=""; jqf=""
while [ $# -gt 0 ]; do
  case "$1" in
    -X) method=$2; shift 2 ;;
    --jq) jqf=$2; shift 2 ;;
    -*) shift ;;
    *) path=$1; shift ;;
  esac
done
echo "$method $path" >> "$D/calls.log"
case "$method $path" in
  "GET /repos/${REPO}")
    [ ! -f "$D/vis-fail" ] || { echo "gh: HTTP 500" >&2; exit 1; }
    body='{"visibility":"private"}' ;;
  "GET /repos/${REPO}/actions/permissions/fork-pr-workflows-private-repos")
    if [ -f "$D/fork-empty" ]; then body='{}'; else body='{"run_workflows_from_fork_pull_requests":false}'; fi ;;
  "GET /repos/${REPO}/actions/variables/CI_RUNNER_LABEL")
    [ -f "$D/var" ] || { echo "gh: Not Found (HTTP 404)" >&2; exit 1; }
    body="{\\"value\\":\\"$(cat "$D/var")\\"}" ;;
  "GET /repos/${REPO}/actions/runners")
    [ ! -f "$D/runners-fail" ] || { echo "gh: HTTP 502" >&2; exit 1; }
    body=$(cat "$D/runners.json") ;;
  "POST /repos/${REPO}/actions/runners/registration-token") body='{"token":"T"}' ;;
  "DELETE /repos/${REPO}/actions/variables/CI_RUNNER_LABEL") rm -f "$D/var"; exit 0 ;;
  "DELETE /repos/${REPO}/actions/runners/"*) exit 0 ;;
  *) echo "stub gh: unexpected $method $path" >&2; exit 9 ;;
esac
if [ -n "$jqf" ]; then printf '%s' "$body" | jq -r "$jqf"; else printf '%s\\n' "$body"; fi
`,
  );
  stub(
    "docker",
    `echo "docker $1" >> "$D/calls.log"
case "$1" in logs) echo "Listening for Jobs" ;; inspect) echo true ;; esac
exit 0
`,
  );
  setRunners([]);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("runner.sh 는 자기가 띄우지 않은 러너를 등록 해제하지 않는다", () => {
  it("ⓐ 다른 이름의 러너가 같은 라벨(대소문자 무시)을 달고 있으면 up 이 쓰기 없이 거부한다", () => {
    setRunners([runner(115, "my-persistent-mac", ["self-hosted", "macOS", "APP-LOCAL"])]);
    const r = run(["up"]);
    expect(r.code, r.err).toBe(3);
    expect(r.err).toContain("my-persistent-mac");
    expect(writes(), "거부한 up 이 무언가를 썼다").toEqual([]);
    expect(existsSync(claimFile()), "거부한 up 이 claim 을 남겼다").toBe(false);
  });

  it("러너 목록을 읽지 못하면 up 이 쓰기 없이 거부한다", () => {
    writeFileSync(join(dir, "runners-fail"), "");
    const r = run(["up"]);
    expect(r.code, r.err).toBe(3);
    expect(writes()).toEqual([]);
  });

  // 리뷰 N2·N3: 상태를 못 읽으면 헤더가 약속한 3 으로, 실제와 다른 사유를 대지 않고 멈춘다.
  it("공개 여부를 못 읽으면 exit 3 으로 쓰기 없이 멈춘다", () => {
    writeFileSync(join(dir, "vis-fail"), "");
    const r = run(["up"]);
    expect(r.code, r.err).toBe(3);
    expect(writes()).toEqual([]);
  });

  it("fork PR 설정 값이 없으면 '켜져 있다'가 아니라 확인할 수 없다고 말하며 멈춘다", () => {
    writeFileSync(join(dir, "fork-empty"), "");
    const r = run(["up"]);
    expect(r.code, r.err).toBe(3);
    expect(r.err).toContain("cannot confirm");
    expect(writes()).toEqual([]);
  });

  it("ⓑⓓ claim 없는 down 은 우리 이름의 러너만 지우고, 같은 라벨의 남의 러너는 이름을 대며 남긴다", () => {
    writeFileSync(join(dir, "var"), LABEL);
    setRunners([
      runner(7, NAME, ["self-hosted", LABEL]),
      runner(115, "my-persistent-mac", ["self-hosted", "macOS", LABEL]),
      runner(200, "unrelated", ["self-hosted", "other"]),
    ]);
    const r = run(["down"]);
    expect(r.code, r.err).toBe(0);
    expect(log()).toContain(`DELETE /repos/${REPO}/actions/runners/7`);
    expect(log()).not.toContain(`DELETE /repos/${REPO}/actions/runners/115`);
    expect(log()).not.toContain(`DELETE /repos/${REPO}/actions/runners/200`);
    expect(r.err).toContain("my-persistent-mac");
  });

  it("ⓒ up 이 claim 을 남긴 뒤 붙은 같은 라벨의 다른 러너는 down 이 지우고 claim 을 치운다", () => {
    const up = run(["up"]);
    expect(up.code, up.err).toBe(0);
    expect(readFileSync(claimFile(), "utf8").trim()).toBe(LABEL);
    // 잡 코드가 등록 토큰으로 다른 이름의 러너를 우리 라벨로 붙였다.
    setRunners([runner(301, "sneaky", ["self-hosted", "App-Local"])]);
    const down = run(["down"]);
    expect(down.code, down.err).toBe(0);
    expect(log()).toContain(`DELETE /repos/${REPO}/actions/runners/301`);
    expect(existsSync(claimFile()), "down 이 claim 을 치우지 않았다").toBe(false);
  });
});

/**
 * #654/#565 — 진입점이 동기 throw 와 비동기 rejection 을 모두 한 줄 메시지 + exit 1 로 끝낸다.
 * `async` 액션의 rejection 은 `cli.parse()` 의 try/catch 를 지나쳐 스택트레이스로 샌다.
 */

import { cac } from "cac";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCli } from "../src/cli.js";
import { runCli } from "../src/entrypoint.js";

afterEach(() => vi.restoreAllMocks());

async function run(cli: ReturnType<typeof cac>, args: string[]) {
  const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  const exit = vi.fn();
  await runCli(cli, ["node", "agent-harness", ...args], exit);
  return { exit, out: write.mock.calls.map((c) => String(c[0])).join("") };
}

describe("runCli", () => {
  it("async 액션이 던진 오류를 한 줄 메시지 + exit 1 로 낸다 (#565)", async () => {
    const cli = cac("t");
    cli.command("boom").action(async () => {
      throw new Error("EACCES: permission denied");
    });
    const { exit, out } = await run(cli, ["boom"]);
    expect(out).toBe("✗ ERROR: EACCES: permission denied\n");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("동기 throw(cac 의 Unused args)도 같다 (#654)", async () => {
    const { exit, out } = await run(buildCli(), ["list", "oops"]);
    expect(out).toContain("✗ ERROR: Unused args");
    expect(out).not.toContain("    at ");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("오류 없으면 exit 을 부르지 않는다", async () => {
    const cli = cac("t");
    cli.command("ok").action(async () => {});
    const { exit, out } = await run(cli, ["ok"]);
    expect(out).toBe("");
    expect(exit).not.toHaveBeenCalled();
  });
});

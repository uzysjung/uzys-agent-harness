import type { CAC } from "cac";

/**
 * 진입점 — 동기 throw 와 비동기 rejection 을 같은 한 줄 메시지 + exit 1 로 끝낸다.
 *
 * `cli.parse()` 는 액션이 반환한 promise 를 버린다(#565) — `async` 액션이 던진 오류는
 * try/catch 를 지나쳐 Node 의 unhandled rejection 스택트레이스로 새고 만다. 그래서
 * `run: false` 로 파싱만 하고 `runMatchedCommand()` 의 결과를 직접 await 한다.
 */
export async function runCli(
  cli: CAC,
  argv: string[],
  exit: (code: number) => void = process.exit,
): Promise<void> {
  try {
    cli.parse(argv, { run: false });
    await cli.runMatchedCommand();
  } catch (error) {
    // #654/#612/#640 — cac 의 CACError("Unused args: `oops`") 와 명령 안의 TypeError 가 여기로 온다.
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`✗ ERROR: ${message}\n`);
    exit(1);
  }
}

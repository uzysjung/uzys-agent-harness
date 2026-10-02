import { buildCli } from "./cli.js";

const cli = buildCli();
try {
  cli.parse(process.argv);
} catch (error) {
  // #654/#612/#640 — 어떤 경로에서 튀어나온 동기 throw 도 라이브러리 내부 스택트레이스로
  // 보이지 않게 한다. cac 의 CACError("Unused args: `oops`") 와 명령 안의 TypeError 가
  // 여기로 온다. 비동기 흐름은 각 명령이 자기 err/exit 으로 처리한다.
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`✗ ERROR: ${message}\n`);
  process.exit(1);
}

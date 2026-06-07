import { cac } from "cac";
import { type ExecuteSpecDeps, executeSpec, registerInstallCommand } from "./commands/install.js";
import { registerUninstallCommand } from "./commands/uninstall.js";
import { type InteractiveResult, runInteractive } from "./interactive.js";

// v26.72.1 — CalVer 정합 (cli --version / package.json / git tag 단일 버전). publish.yml 가 태그에서 파생.
export const VERSION = "26.78.0";

export type Cli = ReturnType<typeof cac>;

export interface DefaultActionDeps {
  log?: (msg: string) => void;
  err?: (msg: string) => void;
  exit?: (code: number) => never;
  run?: (cwd: string) => Promise<InteractiveResult>;
  /** Override the install pipeline + report renderer (used by tests). */
  execute?: (spec: NonNullable<InteractiveResult["spec"]>, deps: ExecuteSpecDeps) => void;
}

/**
 * Default action — runs the interactive flow, then executes the install
 * pipeline with the captured spec. Mirrors the `install` flag-mode command's
 * post-install report.
 */
export async function defaultAction(deps: DefaultActionDeps = {}): Promise<void> {
  const log = deps.log ?? console.log;
  const err = deps.err ?? console.error;
  /* v8 ignore next — process.exit default. tests 는 exit 주입. */
  const exit = deps.exit ?? ((code: number) => process.exit(code) as never);
  const run = deps.run ?? ((cwd: string) => runInteractive(cwd));
  const execute = deps.execute ?? executeSpec;

  const result = await run(process.cwd());
  if (!result.ok) {
    if (result.message) {
      err(result.message);
    }
    // exit-code mapping: no-tty=2; cancelled/exit/disabled/declined=0
    exit(result.reason === "no-tty" ? 2 : 0);
    return;
  }
  if (!result.spec) {
    err("Internal error: interactive returned ok=true without a spec.");
    exit(1);
    return;
  }
  // v26.63.0 — wizard 모드 표시. install header (TARGET 등) 출력 skip → Step 5 sub-section 으로 자연 흐름.
  const execDeps: import("./commands/install.js").ExecuteSpecDeps = {
    log,
    err,
    exit,
    fromWizard: true,
  };
  if (result.mode) execDeps.mode = result.mode;
  execute(result.spec, execDeps);
}

export function buildCli(): Cli {
  const cli = cac("claude-harness");

  cli.help();
  cli.version(VERSION);

  registerInstallCommand(cli);
  registerUninstallCommand(cli);

  cli
    .command("", "Interactive installer (state detection + prompts)")
    /* v8 ignore next — cac action callback. defaultAction 자체는 별도 tests 로 검증. */
    .action(() => defaultAction());

  return cli;
}

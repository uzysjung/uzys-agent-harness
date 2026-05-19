import { cac } from "cac";
import { type ExecuteSpecDeps, executeSpec, registerInstallCommand } from "./commands/install.js";
import { registerUninstallCommand } from "./commands/uninstall.js";
import { type InteractiveResult, runInteractive } from "./interactive.js";

export const VERSION = "0.4.0";

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
    .action(() => defaultAction());

  return cli;
}

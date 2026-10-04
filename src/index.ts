import { buildCli } from "./cli.js";
import { runCli } from "./entrypoint.js";

await runCli(buildCli(), process.argv);

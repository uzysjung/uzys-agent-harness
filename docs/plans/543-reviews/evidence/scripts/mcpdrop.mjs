// D1 안내 명령이 실제로 MCP 행을 네 자리에서 빼는가 · 다른 것을 건드리나
import { join } from "node:path";
import { mkproj, recorder, run, snap, snapDiff, read, exists, rawLog } from "./lib.mjs";
const R = recorder("mcp-drop-command");
const X = mkproj("mcpdrop");
R.step("branch install tooling+csr-fastapi 4cli --with vercel", run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex", "--cli", "opencode", "--cli", "antigravity", "--with", "vercel"], X));
const t = R.step("branch uninstall --track csr-fastapi", run("branch", ["uninstall", "--track", "csr-fastapi"], X));
const m = /drop: (agent-harness install [^(]+?) \(this/.exec(t.out);
const cmd = m[1].trim().split(/\s+/).slice(1);
R.w("# suggested: " + m[1]);
const has = () => ["mcp.json", ".codex/config.toml", "opencode.json"].map((f) => { const p = join(X, f === "mcp.json" ? ".mcp.json" : f); if (!exists(p)) return `${f}: (absent)`; const s = read(p); return `${f}: railway=${s.includes("railway-mcp-server")} chrome=${s.includes("chrome-devtools")} vercel=${s.includes("vercel")}`; }).join(" | ");
R.w("# before drop: " + has());
const before = snap(X);
R.step("branch " + cmd.join(" "), run("branch", cmd, X));
R.w("# after drop: " + has());
R.w("# disk diff by drop command:"); R.w(snapDiff(before, snap(X)).join("\n"));
const lg = rawLog(X); R.w(`# log: tracks=${JSON.stringify(lg.spec.tracks)} cli=${JSON.stringify(lg.spec.cli)} clis=${JSON.stringify(lg.spec.clis)} excluded=${JSON.stringify(lg.excluded)}`);
const b2 = snap(X);
R.step("branch update (after drop)", run("branch", ["update"], X));
R.w("# after update: " + has());
R.w("# disk diff by update:"); R.w(snapDiff(b2, snap(X)).join("\n"));
// 대조: 같은 설치본에 CLI 를 모두 적은 명령
const Y = mkproj("mcpdrop-y");
run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex", "--cli", "opencode", "--cli", "antigravity", "--with", "vercel"], Y);
run("branch", ["uninstall", "--track", "csr-fastapi"], Y);
R.step("[control] branch install --track tooling --cli claude --cli codex --cli opencode --cli antigravity --without railway-mcp-server --without chrome-devtools", run("branch", ["install", "--track", "tooling", "--cli", "claude", "--cli", "codex", "--cli", "opencode", "--cli", "antigravity", "--without", "railway-mcp-server", "--without", "chrome-devtools"], Y));
const hasY = () => ["mcp.json", ".codex/config.toml", "opencode.json"].map((f) => { const p = join(Y, f === "mcp.json" ? ".mcp.json" : f); const s = read(p); return `${f}: railway=${s.includes("railway-mcp-server")} chrome=${s.includes("chrome-devtools")} vercel=${s.includes("vercel")}`; }).join(" | ");
R.w("# control after: " + hasY());
console.log(R.file);

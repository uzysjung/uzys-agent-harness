// 옛 판(v125 · v150)에서 범위 제거(--track · --cli) 뒤 update 가 두 번에 걸쳐 수렴하는가 — --track 고유인가
import { cpSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { S, mkproj, recorder, run, snap, snapDiff, rawLog } from "./lib.mjs";
const R = recorder("old-version-churn");
for (const [ver, args, cliOut] of [["v125", ["--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "antigravity"], "antigravity"], ["v150", ["--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex"], "codex"]]) {
  const B = mkproj(`churn-${ver}`);
  run(ver, ["install", ...args], B);
  for (const [label, first] of [["V0 control (no scope removal)", null], ["V1 branch --track csr-fastapi", ["branch", ["uninstall", "--track", "csr-fastapi"]]], ["V2 main --cli " + cliOut, ["main", ["uninstall", "--cli", cliOut]]], ["V3 branch --cli " + cliOut, ["branch", ["uninstall", "--cli", cliOut]]]]) {
    const d = join(mkdtempSync(join(S, "proj", `churn-${ver}-`)), "app"); cpSync(B, d, { recursive: true, verbatimSymlinks: true });
    if (first) run(first[0], first[1], d);
    const counts = [];
    let firstDiff = [], secondDiff = [];
    for (let i = 0; i < 3; i++) { const a = snap(d); run("branch", ["update"], d); const df = snapDiff(a, snap(d)); counts.push(df.length); if (i === 0) firstDiff = df; if (i === 1) secondDiff = df; }
    R.w(`## ${ver} ${label}: update#1 ${counts[0]} lines · update#2 ${counts[1]} · update#3 ${counts[2]} · log.records=${rawLog(d)?.records}`);
    if (counts[1] > 2) R.w("   update#2 changes (first 12):\n" + secondDiff.slice(0, 12).join("\n"));
  }
}
console.log(R.file);

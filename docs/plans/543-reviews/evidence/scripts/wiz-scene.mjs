// 위저드 Remove one track — 실 TTY(pty) 로 확인 화면의 이름 목록과 실제 디스크 변화를 맞댄다.
import * as cp from "node:child_process";
import { join } from "node:path";
import { appendFileSync } from "node:fs";
import { cliPath, HERE, mkproj, recorder, run, snap, snapDiff, rawLog } from "./lib.mjs";
const SC = {
  W1: { install: ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex", "--cli", "opencode"], keys: ["wait:What do you want to remove", "down", "enter", "wait:Which track", "enter", "wait:Remove csr", "y"] },
  W2: { install: ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--without", "ui-visual-review"], keys: ["wait:What do you want to remove", "enter", "wait:Which track", "enter", "wait:Remove csr", "y"] },
  W3: { install: ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude"], keys: ["wait:What do you want to remove", "enter", "wait:Which track", "enter", "wait:Remove csr", "n"] },
  W4: { install: ["install", "--track", "tooling", "--track", "data", "--cli", "claude"], edit: (X) => appendFileSync(join(X, ".claude/agents/data-analyst.md"), "\nedited\n"), keys: ["wait:What do you want to remove", "enter", "wait:Which track", "enter", "wait:Remove data", "y"] },
};
for (const name of process.argv.slice(2)) {
  const sc = SC[name];
  const R = recorder(`wizard-${name}`);
  const X = mkproj(`wiz-${name}`);
  R.step(`branch ${sc.install.join(" ")}`, run("branch", sc.install, X));
  if (sc.edit) sc.edit(X);
  R.w(`# log tracks order: ${JSON.stringify(rawLog(X).spec.tracks)}`);
  const before = snap(X);
  const r = cp.spawnSync(process.env.REV_PY ?? "python3", [join(HERE, "wizard.py"), cliPath("branch"), X, join(X, "..", "home"), ...sc.keys], { encoding: "utf8", timeout: 120000 });
  R.w("\n$ wizard (pty) keys: " + sc.keys.join(" "));
  R.w((r.stdout ?? "") + (r.stderr ?? ""));
  R.w("\n# disk diff by wizard:"); R.w(snapDiff(before, snap(X)).join("\n") || "  (none)");
  R.w(`# log tracks after: ${JSON.stringify(rawLog(X).spec.tracks)}`);
  console.log(`${name}: ${R.file}`);
}

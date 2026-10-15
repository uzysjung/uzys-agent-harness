// A5 대조 — .claude/skills 폴더째 링크에서 미리보기 수와 실행 수가 main 의 전량 · --cli 에서도 어긋나는가
import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { S, mkproj, recorder, run, snap, snapDiff } from "./lib.mjs";
const R = recorder("A5-control");
const base = mkproj("a5base");
run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex"], base);
rmSync(join(base, ".claude/skills"), { recursive: true }); symlinkSync("../.agents/skills", join(base, ".claude/skills"));
const copy = (t) => { const d = join(mkdtempSync(join(S, "proj", `a5-${t}-`)), "app"); cpSync(base, d, { recursive: true, verbatimSymlinks: true }); return d; };
for (const [ver, cmd] of [["main", ["uninstall", "--yes"]], ["main", ["uninstall", "--cli", "codex"]], ["main", ["uninstall", "--cli", "claude"]], ["branch", ["uninstall", "--track", "csr-fastapi"]]]) {
  const d = copy(cmd.join("-").replace(/-/g, ""));
  const p = run(ver, [...cmd, "--dry-run"], d);
  const b = snap(d);
  const r = run(ver, cmd, d);
  const grab = (o) => o.split("\n").filter((l) => /harness file\(s\)|removed  /.test(l)).join(" / ");
  R.w(`\n## ${ver} ${cmd.join(" ")}\n  preview: ${grab(p.out)}\n  run    : ${grab(r.out)}\n  files actually gone (not re-created): ${snapDiff(b, snap(d)).filter((l) => l.startsWith("  - ") && !/harness-install|installed-tracks|AGENTS.md|CLAUDE.md|config.toml|settings.json|mcp.json/.test(l)).length}`);
}
console.log(R.file);

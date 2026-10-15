// 장면 S1 — 현행(브랜치) 설치 tooling+csr-fastapi · claude+codex+antigravity+opencode · --with vercel · 설치자가 T 전용 룰을 고침 → --track csr-fastapi
import { append, cmp, join, mkproj, read, recorder, run, snap, snapDiff, exists, rawLog } from "./lib.mjs";
const R = recorder("S1-current-4cli");
const clis = ["--cli", "claude", "--cli", "codex", "--cli", "antigravity", "--cli", "opencode"];
const X = mkproj("s1x");
R.step("branch install tooling+csr-fastapi 4cli --with vercel", run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", ...clis, "--with", "vercel"], X));
append(join(X, ".claude/rules/ui-components.md"), "\n<!-- installer edit -->\n");
append(join(X, "AGENTS.md"), "\n## My Notes\ninstaller paragraph\n");
const before = snap(X);
R.step("branch uninstall --track csr-fastapi --dry-run", run("branch", ["uninstall", "--track", "csr-fastapi", "--dry-run"], X));
R.w("dry-run disk change:", snapDiff(before, snap(X)).length);
R.step("branch uninstall --track csr-fastapi", run("branch", ["uninstall", "--track", "csr-fastapi"], X));
R.w("\n# disk diff by --track:"); R.w(snapDiff(before, snap(X)).join("\n"));
R.w("\n# AGENTS.md has My Notes:", read(join(X, "AGENTS.md")).includes("installer paragraph"), " has UI Components:", read(join(X, "AGENTS.md")).includes("UI Components"));
R.step("branch list", run("branch", ["list"], X));
const afterTrack = snap(X);
R.step("branch update", run("branch", ["update"], X));
R.w("\n# disk diff by update after --track:"); R.w(snapDiff(afterTrack, snap(X)).join("\n") || "  (none)");
const afterUpd = snap(X);
R.step("branch update again", run("branch", ["update"], X));
R.w("# disk diff by 2nd update:"); R.w(snapDiff(afterUpd, snap(X)).join("\n") || "  (none)");
// 기준: 남는 트랙만으로 처음 설치
const Y = mkproj("s1y");
R.step("branch install tooling only (reference)", run("branch", ["install", "--track", "tooling", ...clis, "--with", "vercel"], Y));
append(join(Y, "AGENTS.md"), "\n## My Notes\ninstaller paragraph\n");
R.w("\n# compare X(after --track + update) vs Y(fresh tooling install) — A=X B=Y");
R.w(cmp(X, Y).join("\n"));


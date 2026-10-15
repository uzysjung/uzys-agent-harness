// 전제 검사 · 플래그 조합 · 비TTY — 거절이면 디스크 · 기록 무변경인가
import { join } from "node:path";
import { writeFileSync, readFileSync } from "node:fs";
import { mkproj, recorder, run, snap, snapDiff, rawLog } from "./lib.mjs";
const R = recorder("preconditions");
const X = mkproj("pre");
R.step("branch install tooling+csr-fastapi claude+codex", run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex"], X));
const cases = [
  ["uninstall", "--track", "nope"],
  ["uninstall", "--track", "data"],
  ["uninstall", "--track", ""],
  ["uninstall", "--track", "csr-fastapi", "--cli", "codex"],
  ["uninstall", "--track", "csr-fastapi", "--only", "frontend-design"],
  ["uninstall", "--track", " csr-fastapi "],
];
for (const c of cases) { const b = snap(X); const r = R.step("branch " + JSON.stringify(c), run("branch", c, X)); R.w(`# disk change: ${snapDiff(b, snap(X)).length}`); }
// --yes 와 함께 → 트랙만
{ const b = snap(X); const r = R.step("branch uninstall --track csr-fastapi --yes", run("branch", ["uninstall", "--track", "csr-fastapi", "--yes"], X)); R.w(`# log exists after: ${rawLog(X) !== null} tracks=${JSON.stringify(rawLog(X)?.spec?.tracks)} · disk change lines: ${snapDiff(b, snap(X)).length}`); }
// 마지막 트랙
{ const b = snap(X); R.step("branch uninstall --track tooling (last)", run("branch", ["uninstall", "--track", "tooling"], X)); R.w(`# disk change: ${snapDiff(b, snap(X)).length}`); }
// 어휘 밖 문자열이 기록에 있을 때 (T8)
const Y = mkproj("pre-y");
run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude"], Y);
const lp = join(Y, ".uzys-agent-harness/.harness-install.json");
const j = JSON.parse(readFileSync(lp, "utf8")); j.spec.tracks = [...j.spec.tracks, "legacy-x"]; writeFileSync(lp, JSON.stringify(j, null, 2));
R.step("[legacy-x in record] branch uninstall --track csr-fastapi --dry-run", run("branch", ["uninstall", "--track", "csr-fastapi", "--dry-run"], Y));
R.step("[legacy-x in record] branch uninstall --track csr-fastapi", run("branch", ["uninstall", "--track", "csr-fastapi"], Y));
R.w(`# tracks after: ${JSON.stringify(rawLog(Y).spec.tracks)} meta=${JSON.stringify(readFileSync(join(Y, ".claude/.installed-tracks"), "utf8"))}`);
R.step("[legacy-x] branch list", run("branch", ["list"], Y));
R.step("[legacy-x] branch update", run("branch", ["update"], Y));
// 기록 없음
const Z = mkproj("pre-z");
R.step("[no record] branch uninstall --track tooling", run("branch", ["uninstall", "--track", "tooling"], Z));
console.log(R.file);

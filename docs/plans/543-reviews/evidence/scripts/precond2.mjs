import { mkproj, recorder, run, snap, snapDiff, rawLog } from "./lib.mjs";
const R = recorder("preconditions-2");
const X = mkproj("pre2");
R.step("branch install tooling+csr-fastapi claude", run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude"], X));
for (const [ver, c] of [["branch", ["uninstall", "--track"]], ["main", ["uninstall", "--cli"]], ["branch", ["uninstall", "--cli"]], ["branch", ["uninstall", "--track", "3"]]]) {
  const b = snap(X); R.step(`${ver} ${JSON.stringify(c)}`, run(ver, c, X)); R.w(`# disk change: ${snapDiff(b, snap(X)).length}`);
}
const b = snap(X);
R.step("branch uninstall --track csr-fastapi --yes", run("branch", ["uninstall", "--track", "csr-fastapi", "--yes"], X));
R.w(`# log exists: ${rawLog(X) !== null} tracks=${JSON.stringify(rawLog(X)?.spec?.tracks)} disk lines changed: ${snapDiff(b, snap(X)).length}`);
console.log(R.file);

// node probe.mjs <ver> <grep> -- <install args...> — 새 프로젝트에 설치하고 기록에서 grep 에 맞는 항목을 보인다
import { mkproj, run, rawLog } from "./lib.mjs";
const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const [ver, g] = argv.slice(0, sep);
const X = mkproj(`probe-${ver}`);
const r = run(ver, ["install", ...argv.slice(sep + 1)], X);
console.log("dir:", X, "exit:", r.code);
const j = rawLog(X);
const f = (a) => (a ?? []).map((x) => `${x.path}${x.sha256 ? "@" + x.sha256.slice(0, 8) : ""}`).filter((p) => !g || p.includes(g));
console.log("keys:", Object.keys(j).join(","));
console.log("spec:", JSON.stringify(j.spec), "records:", j.records, "excluded:", JSON.stringify(j.excluded));
console.log("policyFiles:", JSON.stringify(f(j.policyFiles)));
console.log("skillFiles:", JSON.stringify(f(j.skillFiles)));
console.log("externalFiles:", JSON.stringify(f(j.externalFiles)));

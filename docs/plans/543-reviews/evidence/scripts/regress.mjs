// 회귀 ② — 같은 설치본 두 벌(복사)에 main · 브랜치의 기존 명령을 각각 돌려 디스크 · 기록 · 화면을 맞댄다.
// node regress.mjs <setup>...
import { cpSync, mkdirSync, mkdtempSync, writeFileSync, appendFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { S, mkproj, run, snap, normLog, recorder } from "./lib.mjs";

const I = (...a) => ["install", ...a];
const SETUPS = {
  cur4: { installs: [["branch", I("--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex", "--cli", "opencode", "--cli", "antigravity", "--with", "vercel")]],
          edit: (X) => { appendFileSync(join(X, ".claude/rules/ui-components.md"), "\nedit\n"); appendFileSync(join(X, "AGENTS.md"), "\n## Mine\npara\n"); writeFileSync(join(X, ".claude/rules/my-own.md"), "mine\n"); } },
  v161: { installs: [["v161", I("--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex", "--cli", "antigravity")]],
          edit: (X) => { appendFileSync(join(X, ".claude/rules/cli-development.md"), "\nedit\n"); writeFileSync(join(X, ".claude/rules/my-own.md"), "mine\n"); } },
  v125: { installs: [["v125", I("--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex")]],
          edit: (X) => { writeFileSync(join(X, ".claude/rules/my-own.md"), "mine\n"); } },
  link: { installs: [["branch", I("--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex")]],
          edit: (X) => { rmSync(join(X, ".claude/skills/ui-visual-review"), { recursive: true }); symlinkSync("../../.agents/skills/ui-visual-review", join(X, ".claude/skills/ui-visual-review")); } },
  disp: { pre: (X) => { mkdirSync(join(X, ".claude/rules"), { recursive: true }); writeFileSync(join(X, ".claude/rules/git-policy.md"), "MY git policy\n"); },
          installs: [["branch", I("--track", "tooling", "--cli", "claude", "--cli", "codex")]] },
};
const CMDS = [
  ["uninstall", "--yes", "--dry-run"], ["uninstall", "--yes"],
  ["uninstall", "--cli", "codex", "--dry-run"], ["uninstall", "--cli", "codex"],
  ["uninstall", "--cli", "claude", "--dry-run"], ["uninstall", "--cli", "claude"],
  ["update"], ["uninstall", "--only", "frontend-design"],
];
const normOut = (s, dirs) => { let o = s; for (const d of dirs) o = o.split(d).join("<P>"); return o.replace(/\d{8}T\d{6}/g, "<TS>").replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<ISO>").replace(/\/private\/tmp/g, "/tmp"); };

for (const name of process.argv.slice(2)) {
  const st = SETUPS[name];
  const R = recorder(`regress-${name}`);
  const base = mkproj(`rg-${name}-base`);
  if (st.pre) st.pre(base);
  for (const [ver, args] of st.installs) R.step(`${ver} ${args.join(" ")}`, run(ver, args, base));
  if (st.edit) st.edit(base);
  for (const cmd of CMDS) {
    const A = join(mkdtempSync(join(S, "proj", `rg-${name}-main-`)), "app");
    const B = join(mkdtempSync(join(S, "proj", `rg-${name}-br-`)), "app");
    cpSync(base, A, { recursive: true, verbatimSymlinks: true });
    cpSync(base, B, { recursive: true, verbatimSymlinks: true });
    const ra = run("main", cmd, A), rb = run("branch", cmd, B);
    const oa = normOut(ra.out, [A, A.replace("/private", "")]), ob = normOut(rb.out, [B, B.replace("/private", "")]);
    const sa = snap(A).join("\n"), sb = snap(B).join("\n");
    const la = JSON.stringify(normLog(A)), lb = JSON.stringify(normLog(B));
    const same = ra.code === rb.code && oa === ob && sa === sb && la === lb;
    R.w(`\n## ${cmd.join(" ")} — exit main=${ra.code} branch=${rb.code} · screen ${oa === ob ? "same" : "DIFF"} · disk ${sa === sb ? "same" : "DIFF"} · log ${la === lb ? "same" : "DIFF"}`);
    if (oa !== ob) { const al = oa.split("\n"), bl = ob.split("\n"); R.w("### screen diff (main vs branch):"); for (const l of al) if (!bl.includes(l)) R.w("  main  : " + l); for (const l of bl) if (!al.includes(l)) R.w("  branch: " + l); }
    if (sa !== sb) { const al = sa.split("\n"), bl = sb.split("\n"); R.w("### disk diff:"); for (const l of al) if (!bl.includes(l)) R.w("  main  : " + l); for (const l of bl) if (!al.includes(l)) R.w("  branch: " + l); }
    if (la !== lb) { R.w("### log diff:"); const ja = normLog(A), jb = normLog(B); for (const k of new Set([...Object.keys(ja ?? {}), ...Object.keys(jb ?? {})])) if (JSON.stringify(ja?.[k]) !== JSON.stringify(jb?.[k])) R.w(`  ${k}: main=${JSON.stringify(ja?.[k]).slice(0, 400)} branch=${JSON.stringify(jb?.[k]).slice(0, 400)}`); }
    if (ra.code !== 0 || rb.code !== 0) R.w(`### outputs (exit != 0)\n${oa.slice(0, 1500)}`);
  }
  console.log(`${name}: ${R.file}`);
}

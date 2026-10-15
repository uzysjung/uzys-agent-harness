// 루트 CLAUDE.md — --track 이 하네스 블록을 맞출 때 설치자 내용 · 미리보기 · update 와의 정합
import { readFileSync, writeFileSync, cpSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { S, mkproj, recorder, run } from "./lib.mjs";
const R = recorder("root-claude-md");
const lines = (s) => s.split("\n");
const diff = (a, b) => { const A = lines(a), B = lines(b); return [...A.filter((l) => !B.includes(l)).map((l) => "  - " + l), ...B.filter((l) => !A.includes(l)).map((l) => "  + " + l)].join("\n") || "  (same)"; };
// R1: v125 설치본(설치 전 설치자 CLAUDE.md 있음) → --track csr-fastapi
{
  const X = mkproj("rmd-v125");
  writeFileSync(join(X, "CLAUDE.md"), "# My Project\n\nMY OWN CONTEXT LINE\n");
  run("v125", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude"], X);
  const a = readFileSync(join(X, "CLAUDE.md"), "utf8");
  const p = R.step("R1 v125 → branch --track csr-fastapi --dry-run", run("branch", ["uninstall", "--track", "csr-fastapi", "--dry-run"], X));
  R.w(`# dry-run mentions CLAUDE.md: ${/CLAUDE\.md/.test(p.out)}`);
  R.step("R1 branch --track csr-fastapi", run("branch", ["uninstall", "--track", "csr-fastapi"], X));
  const b = readFileSync(join(X, "CLAUDE.md"), "utf8");
  R.w("# R1 root CLAUDE.md before→after --track:\n" + diff(a, b));
  R.w(`# installer line kept: ${b.includes("MY OWN CONTEXT LINE")}`);
}
// R2: 현행 설치본에서 설치자가 하네스 블록을 지움(옵트아웃) → --track
{
  const X = mkproj("rmd-optout");
  run("branch", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude"], X);
  const p0 = join(X, "CLAUDE.md");
  const s = readFileSync(p0, "utf8").replace(/<!-- uzys-harness:import:start -->[\s\S]*<!-- uzys-harness:import:end -->\n?/, "");
  writeFileSync(p0, s);
  const Y = join(mkdtempSync(join(S, "proj", "rmd-optout-upd-")), "app"); cpSync(X, Y, { recursive: true });
  const pr = R.step("R2 branch --track csr-fastapi --dry-run", run("branch", ["uninstall", "--track", "csr-fastapi", "--dry-run"], X));
  R.w(`# dry-run mentions CLAUDE.md: ${/CLAUDE\.md/.test(pr.out)}`);
  R.step("R2 branch --track csr-fastapi", run("branch", ["uninstall", "--track", "csr-fastapi"], X));
  R.w("# R2 root CLAUDE.md before→after --track:\n" + diff(s, readFileSync(p0, "utf8")));
  R.step("R2 [control] branch update on the opt-out copy", run("branch", ["update"], Y));
  R.w("# R2 control: root CLAUDE.md before→after update:\n" + diff(s, readFileSync(join(Y, "CLAUDE.md"), "utf8")));
}
console.log(R.file);

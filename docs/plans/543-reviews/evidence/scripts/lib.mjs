// 리뷰 보조 라이브러리 — #543 적대적 리뷰. REV_SCRATCH 아래 cli/<판>/ 에 설치된 CLI 를 mock PATH · 임시 HOME 으로 돌린다.
import * as cp from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const S = process.env.REV_SCRATCH;
export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, "../../../../..");
const MOCKS = join(REPO, "docs/plans/543-design-evidence/mocks");
export const LOG = ".uzys-agent-harness/.harness-install.json";
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

export function cliPath(ver) { return join(S, "cli", ver, "node_modules/@uzysjung/agent-harness/dist/index.js"); }

export function mkproj(tag) {
  const base = join(S, "proj");
  mkdirSync(base, { recursive: true });
  const d = join(mkdtempSync(join(base, `${tag}-`)), "app");
  mkdirSync(d);
  cp.spawnSync("git", ["init", "-q", d]);
  return d;
}

export function run(ver, args, proj, opts = {}) {
  const home = join(proj, "..", "home");
  mkdirSync(home, { recursive: true });
  const r = cp.spawnSync(process.execPath, [cliPath(ver), ...args, "--project-dir", proj], {
    cwd: proj,
    encoding: "utf8",
    input: opts.input ?? "",
    env: { ...process.env, HOME: home, PATH: `${MOCKS}:${process.env.PATH}`, NO_COLOR: "1", FORCE_COLOR: "0", CI: "1" },
    timeout: 180000,
  });
  return { code: r.status, out: strip((r.stdout ?? "") + (r.stderr ?? "")) };
}

const norm = (p) => p.replace(/\.backup-[0-9A-Za-z_.-]+/g, ".backup-*");
function walk(root, dir = root, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (dir === root && (e.name === ".git" || e.name === "node_modules")) continue;
    const abs = join(dir, e.name);
    const rel = relative(root, abs);
    const st = lstatSync(abs);
    if (st.isSymbolicLink()) out.push(`${norm(rel)} -> ${readlinkSync(abs)}`);
    else if (st.isDirectory()) { const b = out.length; walk(root, abs, out); if (out.length === b) out.push(`${rel}/ (empty dir)`); }
    else out.push(`${norm(rel)} ${createHash("sha256").update(readFileSync(abs)).digest("hex").slice(0, 12)}`);
  }
  return out;
}
export const snap = (d) => walk(d).sort();
export function rawLog(d) { const p = join(d, LOG); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; }
export function normLog(d) {
  const j = rawLog(d);
  if (j === null) return null;
  const out = {};
  for (const k of Object.keys(j).sort()) {
    if (/At$|^version$|^harnessVersion$|^installedBy$/.test(k)) continue;
    const v = j[k];
    if (k === "spec") { out.spec = { ...v, tracks: [...(v.tracks ?? [])].sort(), clis: v.clis ? [...v.clis].sort() : v.clis }; continue; }
    out[k] = Array.isArray(v) ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).sort() : v;
  }
  return out;
}
export function cmp(a, b, ignore = []) {
  const keep = (l) => !ignore.some((r) => r.test(l));
  const A = new Set(snap(a).filter(keep)), B = new Set(snap(b).filter(keep));
  const lines = [];
  const onlyA = [...A].filter((x) => !B.has(x)), onlyB = [...B].filter((x) => !A.has(x));
  for (const x of onlyA) lines.push(`  - ${x}`);
  for (const x of onlyB) lines.push(`  + ${x}`);
  const la = normLog(a) ?? {}, lb = normLog(b) ?? {};
  for (const k of [...new Set([...Object.keys(la), ...Object.keys(lb)])].sort()) {
    const va = JSON.stringify(la[k]), vb = JSON.stringify(lb[k]);
    if (va === vb || ignore.some((r) => r.test(`log.${k}`))) continue;
    if (Array.isArray(la[k]) || Array.isArray(lb[k])) {
      const sa = new Set(la[k] ?? []), sb = new Set(lb[k] ?? []);
      for (const x of sa) if (!sb.has(x)) lines.push(`  log.${k} - ${x}`);
      for (const x of sb) if (!sa.has(x)) lines.push(`  log.${k} + ${x}`);
    } else lines.push(`  log.${k}: A=${va} B=${vb}`);
  }
  return lines;
}
export function snapDiff(before, after) {
  const A = new Set(before), B = new Set(after);
  return [...[...A].filter((x) => !B.has(x)).map((x) => `  - ${x}`), ...[...B].filter((x) => !A.has(x)).map((x) => `  + ${x}`)];
}
export const append = (p, t) => appendFileSync(p, t);
export const write = (p, t) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, t); };
export const read = (p) => readFileSync(p, "utf8");
export const exists = existsSync;
export { cpSync, join };

/** 증거 기록기 — 장면 하나를 한 파일로. */
export function recorder(name) {
  const dir = process.env.REV_OUT ?? join(HERE, "..", "scenes");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.txt`);
  writeFileSync(file, "");
  const w = (...s) => { appendFileSync(file, s.join(" ") + "\n"); };
  return { file, w, step(title, r) { w(`\n$ ${title}  (exit ${r.code})`); w(r.out.trimEnd()); return r; } };
}

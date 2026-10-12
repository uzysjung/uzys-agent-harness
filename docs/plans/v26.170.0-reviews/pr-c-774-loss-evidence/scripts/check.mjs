// args: <proj> <outdir> <label> <old0 path> <fresh path|-> ; prints one summary line, writes check-<label>.json
import fs from "node:fs"; import path from "node:path"; import { execSync } from "node:child_process";
const [proj, out, label, old0p, freshp] = process.argv.slice(2);
const blocks = JSON.parse(fs.readFileSync(path.join(out, "blocks.json"), "utf8"));
const rd = (p) => { try { return fs.readFileSync(p, "utf8"); } catch { return null; } };
const live = rd(path.join(proj, "AGENTS.md"));
const backups = fs.readdirSync(proj).filter((f) => f.startsWith("AGENTS.md.backup-")).sort();
const bk = backups.map((f) => rd(path.join(proj, f)) ?? "");
const where = (s) => (live !== null && live.includes(s) ? "LIVE" : bk.some((b) => b.includes(s)) ? "BACKUP" : "LOST");
const res = {};
for (const [k, v] of Object.entries(blocks)) { if (!v) continue; res[k] = where(v.text ?? v.line); }
const norm = (sec) => { const a = sec.map((l) => l.trimEnd()); while (a.length > 1 && a.at(-1) === "") a.pop(); return a.join("\n"); };
const sections = (t) => { if (!t) return []; const out = []; let cur = null; for (const l of t.split("\n")) { if (/^## /.test(l)) { if (cur) out.push(norm(cur)); cur = [l]; } else if (cur) cur.push(l); } if (cur) out.push(norm(cur)); return out; };
const old0 = new Set(sections(rd(old0p)));
const fresh = new Set(freshp && freshp !== "-" ? sections(rd(freshp)) : []);
const liveSecs = sections(live);
const stale = liveSecs.filter((s) => old0.has(s) && !fresh.has(s)).map((s) => s.split("\n")[0]);
const preamble = live !== null && /^> \*\*Generated from\*\*/m.test(live);
// global token check
let tokensBefore = []; try { tokensBefore = fs.readFileSync(path.join(out, "tokens-before.txt"), "utf8").split("\n").filter(Boolean); } catch {}
const lostTok = []; const bkOnlyTok = [];
for (const t of tokensBefore) {
  let hits = ""; try { hits = execSync(`grep -rlF --exclude-dir=.git -- ${JSON.stringify(t)} . || true`, { cwd: proj, encoding: "utf8" }); } catch {}
  const files = hits.split("\n").filter(Boolean);
  if (files.length === 0) lostTok.push(t); else if (files.every((f) => /\.backup-/.test(f))) bkOnlyTok.push(t);
}
const summary = { label, agentsLive: live !== null, liveHeadings: liveSecs.length, agentsBackups: backups.length, blocks: res, staleOldSections: stale, oldPreambleLive: preamble, lostTokens: lostTok, backupOnlyTokens: bkOnlyTok };
fs.writeFileSync(path.join(out, `check-${label}.json`), JSON.stringify(summary, null, 1));
console.log(`${label}: live=${summary.agentsLive} secs=${liveSecs.length} bk=${backups.length} blocks=${Object.entries(res).map(([k, v]) => k + ":" + v).join(",")} stale=${stale.length} pre=${preamble} LOST=[${lostTok.join(",")}] bkOnly=[${bkOnlyTok.join(",")}]`);

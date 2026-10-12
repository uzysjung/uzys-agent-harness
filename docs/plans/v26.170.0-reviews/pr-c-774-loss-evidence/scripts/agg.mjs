// args: <evroot> ; prints table rows per run
import fs from "node:fs"; import path from "node:path";
const root = process.argv[2];
const rows = [];
for (const v of fs.readdirSync(root).filter((d) => /^26\./.test(d)).sort()) {
  for (const run of fs.readdirSync(path.join(root, v)).filter((d) => d !== "DONE").sort()) {
    const D = path.join(root, v, run);
    const checks = fs.readdirSync(D).filter((f) => /^check-.*\.json$/.test(f));
    const log = fs.existsSync(path.join(D, "log.txt")) ? fs.readFileSync(path.join(D, "log.txt"), "utf8") : "";
    const bks = [...log.matchAll(/^(\S+) agents-backups=(\d+)/gm)].map((m) => [m[1], +m[2]]);
    const exits = [...log.matchAll(/^(\S+) exit=(\d+)/gm)].filter((m) => m[2] !== "0").map((m) => m[1] + "=" + m[2]);
    let incr = []; for (let i = 1; i < bks.length; i++) if (bks[i][1] - bks[i - 1][1] > 1) incr.push(bks[i][0] + "+" + (bks[i][1] - bks[i - 1][1]));
    const steps = {};
    for (const c of checks) { const j = JSON.parse(fs.readFileSync(path.join(D, c), "utf8")); steps[j.label] = j; }
    const order = ["u169", "u1", "u2", "reinst", "rei", "uncli", "un"].filter((s) => steps[s]);
    const lost = new Set(); const blkBk = new Set(); const blkLost = new Set(); const bkOnly = new Set();
    for (const s of order) { const j = steps[s]; j.lostTokens.forEach((t) => lost.add(t)); j.backupOnlyTokens.forEach((t) => bkOnly.add(s + ":" + t));
      for (const [k, w] of Object.entries(j.blocks)) { if (w === "LOST") blkLost.add(s + ":" + k); if (w === "BACKUP") blkBk.add(s + ":" + k); } }
    // B2: claude-only AGENTS.md byte-identical
    let b2 = "";
    if (/^claude-/.test(run) && fs.existsSync(path.join(D, "AGENTS-1-mutated.md"))) {
      const m = fs.readFileSync(path.join(D, "AGENTS-1-mutated.md"));
      const diffs = order.filter((s) => { const p = path.join(D, `AGENTS-${s}.md`); return !fs.existsSync(p) || !m.equals(fs.readFileSync(p)); });
      b2 = diffs.length ? "B2-CHANGED@" + diffs.join("/") : "B2-identical";
    }
    const st = order.map((s) => `${s}[sec=${steps[s].liveHeadings},bk=${steps[s].agentsBackups},stale=${steps[s].staleOldSections.length}${steps[s].oldPreambleLive ? ",PRE" : ""}${steps[s].agentsLive ? "" : ",GONE"}]`).join(" ");
    rows.push(`${v} ${run} | ${st} | LOST=${[...lost].join(",") || "-"} blkLOST=${[...blkLost].join(",") || "-"} blkBK=${[...blkBk].join(",") || "-"} bkOnly=${[...bkOnly].join(",") || "-"} ${b2} ${incr.length ? "MULTIBK=" + incr.join(",") : ""} ${exits.length ? "EXIT!=" + exits.join(",") : ""}`);
  }
}
console.log(rows.join("\n"));

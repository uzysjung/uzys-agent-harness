// installer edits on AGENTS.md. args: <proj> <outdir>
import fs from "node:fs"; import path from "node:path";
const [proj, out] = process.argv.slice(2);
const A = path.join(proj, "AGENTS.md");
const blocks = {};
if (fs.existsSync(A)) {
  let L = fs.readFileSync(A, "utf8").split("\n");
  const heads = () => L.map((l, i) => (/^## /.test(l) ? i : -1)).filter((i) => i >= 0);
  const find = (re) => L.findIndex((l) => re.test(l));
  const secEnd = (i) => { let j = i + 1; while (j < L.length && !/^## /.test(L[j])) j++; return j; };
  const lastContent = (i) => { let j = secEnd(i) - 1; while (j > i && L[j].trim() === "") j--; return j; };
  const appendLine = (re, line, tag) => {
    const i = find(re); if (i < 0) { blocks[tag] = null; return; }
    const at = lastContent(i); L.splice(at + 1, 0, line);
    blocks[tag] = { heading: L[i], line };
  };
  // edits of harness sections (one line each)
  const pr = find(/^## Project Rules/);
  if (pr >= 0) { const h = heads().filter((x) => x > pr); if (h[1] !== undefined) { const re = new RegExp("^" + L[h[1]].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"); appendLine(re, "MINE-EDIT-ANCHOR: we also require a changelog line per PR.", "EDIT_ANCHOR"); } }
  const tailRe = [/^## Experience Accumulation/, /^## Testing/, /^## Delivery/].find((re) => find(re) >= 0);
  if (tailRe) appendLine(tailRe, "MINE-EDIT-TAIL: our team adds this line.", "EDIT_TAIL");
  appendLine(/^## Protected Files/, "- MINE-EDIT-NAMED: secrets/ directory too", "EDIT_NAMED");
  // fill project context
  const ip = find(/^## Identity & Purpose/);
  if (ip >= 0) {
    const e = secEnd(ip); let replaced = false;
    for (let j = ip + 1; j < e; j++) if (/<!-- FILL/.test(L[j]) && !replaced) { L[j] = "MINE-CONTEXT: payments reconciliation service for ACME."; replaced = true; }
    if (!replaced) L.splice(ip + 1, 0, "", "MINE-CONTEXT: payments reconciliation service for ACME.");
    blocks.CONTEXT = { line: "MINE-CONTEXT: payments reconciliation service for ACME." };
  }
  // verbatim copy of an old harness section body under own heading
  const srcRe = [/^## Context Management/, /^## Shell Safety/, /^## Session Cleanup/, /^## Git Policy/].find((re) => find(re) >= 0);
  let copy = null;
  if (srcRe) { const i = find(srcRe); const body = L.slice(i + 1, lastContent(i) + 1); copy = ["## MINE Copied Guidance", ...body]; }
  // middle sections
  const mid = (beforeRe, tag) => { const i = find(beforeRe); if (i < 0) { blocks[tag] = null; return; } const sec = [`## MINE ${tag} Section`, "", `${tag === "MIDA" ? "MINE-MIDA" : "MINE-MIDB"}: our own middle rules.`, ""]; L.splice(i, 0, ...sec); blocks[tag] = { text: sec.slice(0, 3).join("\n") }; };
  if (pr >= 0) { const pr2 = find(/^## Project Rules/); const h = heads().filter((x) => x > pr2); if (h[2] !== undefined) { const t = L[h[2]]; mid(new RegExp("^" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "MIDA"); } }
  mid(find(/^## Session Start/) >= 0 ? /^## Session Start/ : /^## Protected Files/, "MIDB");
  // top section (after preamble, before first ##)
  { const i = heads()[0]; const sec = ["## MINE Top Section", "", "MINE-TOP: team conventions first.", ""]; L.splice(i, 0, ...sec); blocks.TOP = { text: sec.slice(0, 3).join("\n") }; }
  // end + copy
  while (L.length && L[L.length - 1] === "") L.pop();
  if (copy) { L.push("", ...copy); blocks.COPY = { text: copy.join("\n") }; }
  L.push("", "## MINE End Section", "", "MINE-END: last words.", "");
  blocks.END = { text: "## MINE End Section\n\nMINE-END: last words." };
  fs.writeFileSync(A, L.join("\n"));
}
fs.writeFileSync(path.join(out, "blocks.json"), JSON.stringify(blocks, null, 1));

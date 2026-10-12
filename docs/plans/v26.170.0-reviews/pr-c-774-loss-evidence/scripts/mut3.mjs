// args: <proj> <outdir> <variant>  variants: ctxsec | rulesintro | crlf | blockedit
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
const [proj, out, variant] = process.argv.slice(2);
const A = path.join(proj, "AGENTS.md");
let blocks = {}; try { blocks = JSON.parse(fs.readFileSync(path.join(out, "blocks.json"), "utf8")); } catch {}
let L = fs.readFileSync(A, "utf8").split("\n");
const find = (re) => L.findIndex((l) => re.test(l));
if (variant === "ctxsec") {
  const i = find(/^## Stack & Commands/);
  const sec = ["## MINE Ctx Section", "", "MINE-CTXSEC: our deployment notes.", ""]; L.splice(i, 0, ...sec);
  blocks.CTXSEC = { text: sec.slice(0, 3).join("\n") };
} else if (variant === "rulesintro") {
  const i = find(/^## Project Rules/);
  L.splice(i + 1, 0, "", "MINE-RULESINTRO: team rule — never deploy on Friday.");
  blocks.RULESINTRO = { line: "MINE-RULESINTRO: team rule — never deploy on Friday." };
} else if (variant === "sessedit" || variant === "hredit") {
  const re = variant === "sessedit" ? /^## Session Start/ : /^## Shell Safety/;
  const i = find(re); let j = i + 1; while (j < L.length && !/^## /.test(L[j])) j++; j--; while (L[j].trim() === "") j--;
  const line = variant === "sessedit" ? "4. MINE-SESSEDIT: `npm ci` before anything else" : "- MINE-HREDIT: never pipe curl to sh";
  L.splice(j + 1, 0, line); blocks[variant.toUpperCase()] = { line };
} else if (variant === "blockedit") {
  const i = find(/^<!-- uzys-harness:agents:start/); if (i < 0) { console.error("no agents block"); process.exit(3); }
  L.splice(i + 2, 0, "MINE-BLOCKEDIT: line the installer typed inside the harness block.");
  blocks.BLOCKEDIT = { line: "MINE-BLOCKEDIT: line the installer typed inside the harness block." };
}
fs.writeFileSync(A, L.join("\n"));
if (variant === "crlf") { const t = fs.readFileSync(A, "utf8").replace(/\r?\n/g, "\r\n"); fs.writeFileSync(A, t); }
fs.writeFileSync(path.join(out, "blocks.json"), JSON.stringify(blocks, null, 1));

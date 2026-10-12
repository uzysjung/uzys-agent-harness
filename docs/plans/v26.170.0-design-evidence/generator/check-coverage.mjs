import { readFileSync } from "node:fs"; import { createHash } from "node:crypto";
const key = (lines) => { const out = lines.map((l) => l.replace(/\r$/, "").trimEnd()); while (out.length > 1 && out.at(-1) === "") out.pop(); return createHash("sha256").update(out.join("\n")).digest("hex"); };
const REPO = "/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv";
const anchor = new Set([...readFileSync(`${REPO}/src/retired-anchor-sections.ts`, "utf8").matchAll(/"([0-9a-f]{64})"/g)].map((m) => m[1]));
const gen = readFileSync(process.argv[2], "utf8");
const grab = (name) => new Set([...(gen.split(`export const ${name}`)[1] ?? "").split("]);")[0].matchAll(/"([0-9a-f]{64})"/g)].map((m) => m[1]));
const tail = grab("LEGACY_AGENTS_MD_SECTION_KEYS"), pre = grab("LEGACY_AGENTS_MD_PREAMBLE_KEYS");
const names = new Set([...readFileSync(`${REPO}/templates/AGENTS.md.template`, "utf8").matchAll(/^## (.+)$/gm)].map((m) => m[1].trim()));
for (const f of process.argv.slice(3)) {
  const lines = readFileSync(f, "utf8").split("\n"); let cur = null; const secs = []; const head = [];
  for (const l of lines) { if (/^## /.test(l)) { if (cur) secs.push(cur); cur = [l]; } else if (cur) cur.push(l); else head.push(l); }
  if (cur) secs.push(cur);
  const headKey = key(head.filter((l) => !/^# /.test(l)));
  const cls = secs.map((s) => { const k = key(s); const n = /^## (.+?)\s*$/.exec(s[0])[1]; return anchor.has(k) ? "anchor" : tail.has(k) ? "tail" : names.has(n) ? `name(${n})` : `UNKNOWN(${n})`; });
  const count = (p) => cls.filter((c) => c.startsWith(p)).length;
  console.log(`${f.split("/").slice(-2).join("/")}: preamble=${pre.has(headKey) ? "match" : "NO"} sections=${secs.length} anchor=${count("anchor")} tail=${count("tail")} name=${count("name")} unknown=${count("UNKNOWN")}`);
  for (const c of cls) if (c.startsWith("UNKNOWN") || c.startsWith("name")) console.log("    " + c);
}

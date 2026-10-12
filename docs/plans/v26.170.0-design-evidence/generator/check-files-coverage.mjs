// 실설치 잔존 파일(snap-9, sha 앞 12자)이 생성한 지문 집합에 드는가
import { readFileSync } from "node:fs";
const gen = readFileSync(process.argv[2], "utf8");
const map = new Map(); for (const m of gen.matchAll(/\[\"([^"]+)\", new Set\(\[([^\]]*)\]\)\]/g)) map.set(m[1], new Set([...m[2].matchAll(/"([0-9a-f]{64})"/g)].map((x) => x[1].slice(0, 12))));
const alias = (p) => p.startsWith(".agents/skills/") ? `.claude/skills/${p.slice(".agents/skills/".length)}` : p;
for (const f of process.argv.slice(3)) {
  const rows = readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => { const [sha, p] = l.split(/\s+/); return { sha, p: p.replace(/^\.\//, "") }; });
  const cand = rows.filter((r) => /^(\.claude|\.agents\/skills|\.codex\/hooks)\//.test(r.p) && !/\.backup-|my-rule|skills\/mine|my-notes|hooks\/mine|harness-install|settings\.json/.test(r.p));
  const hit = [], knownPathOtherSha = [], unknownPath = [];
  for (const r of cand) { const set = map.get(alias(r.p)); if (!set) unknownPath.push(r.p); else if (set.has(r.sha)) hit.push(r.p); else knownPathOtherSha.push(r.p); }
  console.log(`${f.split("/").slice(-2, -1)}: candidates=${cand.length} exactMatch=${hit.length} knownPathOtherBytes=${knownPathOtherSha.length} unknownPath=${unknownPath.length}`);
  for (const p of knownPathOtherSha) console.log("   ~ other bytes:", p);
  for (const p of unknownPath) console.log("   ? unknown path:", p);
}

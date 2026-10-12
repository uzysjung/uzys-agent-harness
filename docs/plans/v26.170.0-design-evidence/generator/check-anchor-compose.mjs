// PR-A 의 53 지문을 같은 규칙으로 git 태그에서 다시 뽑아 일치하는지 — 생성기가 기존 집합과 "합성"된다는 증거
import { execFileSync } from "node:child_process"; import { createHash } from "node:crypto"; import { readFileSync } from "node:fs";
const REPO = "/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv";
const git = (...a) => execFileSync("git", a, { cwd: REPO, maxBuffer: 1 << 28 }).toString();
const key = (lines) => { const out = lines.map((l) => l.replace(/\r$/, "").trimEnd()); while (out.length > 1 && out.at(-1) === "") out.pop(); return createHash("sha256").update(out.join("\n")).digest("hex"); };
const existing = new Set([...readFileSync(`${REPO}/src/retired-anchor-sections.ts`, "utf8").matchAll(/"([0-9a-f]{64})"/g)].map((m) => m[1]));
const cmp = (a, b) => { const A = a.split(".").map(Number), B = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i]; return 0; };
const tags = git("tag", "-l").split("\n").filter((t) => /^v26\./.test(t)).map((t) => t.slice(1)).sort(cmp);
const run = (lo, hi) => { const keys = new Map(); for (const v of tags) { if (cmp(v, lo) < 0 || cmp(v, hi) > 0) continue; let text; try { text = git("show", `v${v}:templates/CLAUDE.md`); } catch { continue; }
  // 옛 판 변환: 첫 h1 제거 · `/uzys:` → `/uzys-`
  const lines = text.replace(/\/uzys:/g, "/uzys-").split("\n"); const i = lines.findIndex((l) => /^# /.test(l)); if (i >= 0) lines.splice(i, 1);
  let cur = null; const secs = []; for (const l of lines) { if (/^## /.test(l)) { if (cur) secs.push(cur); cur = [l]; } else if (cur) cur.push(l); } if (cur) secs.push(cur);
  for (const s of secs) { const k = key(s); if (!keys.has(k)) keys.set(k, `${s[0]} (${v})`); } } return keys; };
for (const [lo, hi] of [["26.70.0", "26.159.0"], ["26.0.0", "26.159.0"], ["26.83.0", "26.159.0"]]) {
  const k = run(lo, hi); const mine = new Set(k.keys());
  const onlyExisting = [...existing].filter((x) => !mine.has(x)); const onlyMine = [...mine].filter((x) => !existing.has(x));
  console.log(`range ${lo}~${hi}: regenerated=${mine.size} existing=${existing.size} onlyInExisting=${onlyExisting.length} onlyInRegenerated=${onlyMine.length}`);
  if (onlyMine.length && onlyMine.length < 40) for (const x of onlyMine) console.log("   +", k.get(x));
}

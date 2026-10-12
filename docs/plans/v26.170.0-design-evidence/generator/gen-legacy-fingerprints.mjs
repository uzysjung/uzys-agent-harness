#!/usr/bin/env node
// d170 설계 초안(검증 반영판 N5) — 옛 판의 하네스 지문 생성기(동결 데이터). 입력 = git 태그 v26.70.0~v26.169.0 양끝 고정(교집합을 취하지 않는다 — 26.70~26.82 미게시 태그 포함).
// 출력 = src/legacy-fingerprints.ts 모양의 TS 소스(여기서는 scratchpad 로). 실행: node gen-legacy-fingerprints.mjs <out.ts>
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
const REPO = "/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv";
const git = (...a) => execFileSync("git", a, { cwd: REPO, maxBuffer: 1 << 28 });
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const cmp = (a, b) => { const A = a.split(".").map(Number), B = b.split(".").map(Number); for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i]; return 0; };
// 입력 범위 = git 태그 v26.70.0 이상 전부(PR-A 지문과 같은 하한 — npm 게시 전 `npx github:` 배포판 26.70~26.82 포함). 게시판과 태그 내용이 같음은 설계 §3 증거.
const RANGE_FROM = process.env.RANGE_FROM ?? "26.70.0";
// 상한 고정 — v26.170.0 태그가 생겨도 집합이 변하지 않아야 PR-C 의 재생산 검사(cmp)가 유지된다(검증 N5). v26.170 부터는 쓰는 순간 기록한다.
const RANGE_TO = process.env.RANGE_TO ?? "26.169.0";
const tags = new Set(git("tag", "-l").toString().split("\n").filter(Boolean));
const versions = [...tags].filter((t) => /^v26\./.test(t)).map((t) => t.slice(1)).filter((v) => cmp(v, RANGE_FROM) >= 0 && cmp(v, RANGE_TO) <= 0).sort(cmp);
// ① .claude/ 하네스 파일 (path → sha 집합) — templates/{rules,agents,commands,hooks,skills}/** 전부 + CLAUDE.md(옛 앵커 .claude/CLAUDE.md). `templates/codex/hooks/**` 는 렌더본이라 바이트가 안 맞아 입력에서 뺀다(설계 §3.1 · 검증 N5).
const FILE_DIRS = [["templates/rules/", ".claude/rules/"], ["templates/agents/", ".claude/agents/"], ["templates/commands/", ".claude/commands/"], ["templates/hooks/", ".claude/hooks/"], ["templates/skills/", ".claude/skills/"]];
const files = new Map(); // target path → Set(sha)
const add = (p, s) => { if (!files.has(p)) files.set(p, new Set()); files.get(p).add(s); };
// ② AGENTS.md 옛 템플릿 절 지문(마커 전 판 ≤ 26.159) — 자리표시자 없는 절만. 지문 규칙 = retiredAnchorSectionKey 와 같다
const sectionKey = (lines) => { const out = lines.map((l) => l.replace(/\r$/, "").trimEnd()); while (out.length > 1 && out.at(-1) === "") out.pop(); return sha(out.join("\n")); };
const sections = new Map(); // key → heading (comment)
const preambles = new Map(); // key → first line sample (title 제외 블록인용 머리)
const trailers = new Map();
const hookRefs = new Set(); // settings.json 의 $CLAUDE_PROJECT_DIR/.claude/ 상대 참조
const statusLines = new Set();
let fileRows = 0;
for (const v of versions) {
  const t = `v${v}`;
  const tree = git("ls-tree", "-r", t, "--", "templates").toString().split("\n").filter(Boolean).map((l) => { const [meta, path] = l.split("\t"); return { blob: meta.split(" ")[2], path }; });
  for (const { blob, path } of tree) {
    for (const [src, dst] of FILE_DIRS) if (path.startsWith(src)) { add(dst + path.slice(src.length), sha(git("cat-file", "blob", blob))); fileRows++; }
    if (path === "templates/CLAUDE.md") add(".claude/CLAUDE.md", sha(git("cat-file", "blob", blob)));
    if (path === "templates/settings.json") {
      try { const s = JSON.parse(git("cat-file", "blob", blob).toString());
        for (const ev of Object.values(s.hooks ?? {})) for (const e of ev) for (const h of e.hooks ?? []) { const m = /\$CLAUDE_PROJECT_DIR\/\.claude\/([^"']+)/.exec(h.command ?? ""); if (m) hookRefs.add(m[1]); }
        if (s.statusLine) statusLines.add(JSON.stringify(s.statusLine));
      } catch {}
    }
    if (/^templates\/(codex|opencode|antigravity)\/AGENTS\.md\.template$/.test(path) && cmp(v, "26.159.0") <= 0) {
      const text = git("cat-file", "blob", blob).toString();
      const lines = text.split("\n");
      let cur = null; const secs = []; let pre = [];
      for (const line of lines) { if (/^## /.test(line)) { if (cur) secs.push(cur); cur = [line]; } else if (cur) cur.push(line); else pre.push(line); }
      if (cur) secs.push(cur);
      for (const s of secs) { if (s.some((l) => /\{[A-Z_]+\}/.test(l))) continue; const k = sectionKey(s); if (!sections.has(k)) sections.set(k, `${s[0]} (${v})`); }
      // 머리: 제목(프로젝트 이름 포함) 다음의 블록인용 줄들 — 제목은 뺀다
      const head = pre.filter((l) => !/^# /.test(l)); if (head.some((l) => l.trim() !== "")) { const k = sectionKey(head); if (!preambles.has(k)) preambles.set(k, `${head.find((l) => l.trim() !== "")} (${v})`); }
      // 꼬리: 마지막 절 뒤의 `---` + 이탤릭 안내 — 마지막 절 안에 포함돼 있으면 절 지문이 덮는다(여기서는 별도 집계만)
      const tail = lines.slice(lines.lastIndexOf("---")); if (tail.length > 1 && tail[0] === "---") { const k = sectionKey(tail); if (!trailers.has(k)) trailers.set(k, `${tail[1] ?? tail[0]} (${v})`); }
    }
  }
}
const pairs = [...files].reduce((n, [, s]) => n + s.size, 0);
const notCurrent = [...files].filter(([p]) => { const rel = p.replace(/^\.claude\//, "templates/"); return p === ".claude/CLAUDE.md" || !existsSync(`${REPO}/${rel}`); });
let out = `// 생성물 — scripts/gen-legacy-fingerprints.mjs (입력: git 태그 v${RANGE_FROM}~v${RANGE_TO} 양끝 고정, 실제 ${versions[0]}~${versions.at(-1)} ${versions.length}판). 손으로 고치지 않는다.\n`;
out += `export const LEGACY_HARNESS_FILES: ReadonlyMap<string, ReadonlySet<string>> = new Map([\n`;
for (const [p, s] of [...files].sort()) out += `  [${JSON.stringify(p)}, new Set([${[...s].map((x) => `"${x}"`).join(", ")}])],\n`;
out += `]);\nexport const LEGACY_AGENTS_MD_SECTION_KEYS: ReadonlySet<string> = new Set([\n`;
for (const [k, c] of sections) out += `  "${k}", // ${c}\n`;
out += `]);\nexport const LEGACY_AGENTS_MD_PREAMBLE_KEYS: ReadonlySet<string> = new Set([\n`;
for (const [k, c] of preambles) out += `  "${k}", // ${c.replace(/\n/g, " ")}\n`;
out += `]);\nexport const LEGACY_HOOK_REFS: ReadonlySet<string> = new Set(${JSON.stringify([...hookRefs].sort(), null, 2)});\n`;
out += `export const LEGACY_STATUSLINE_VALUES: ReadonlySet<string> = new Set(${JSON.stringify([...statusLines].map((s) => sha(s)), null, 2)}); // sha256(JSON.stringify(statusLine))\n`;
writeFileSync(process.argv[2], out);
console.log(JSON.stringify({ rangeFrom: RANGE_FROM, rangeTo: RANGE_TO, versions: versions.length, first: versions[0], last: versions.at(-1), fileRowsScanned: fileRows, filePaths: files.size, filePairs: pairs, filePathsNotCurrent: notCurrent.length, filePairsNotCurrent: notCurrent.reduce((n, [, s]) => n + s.size, 0), sectionKeys: sections.size, preambleKeys: preambles.size, trailerKeys: trailers.size, hookRefs: [...hookRefs].sort(), statusLines: statusLines.size, outBytes: Buffer.byteLength(out) }, null, 2));

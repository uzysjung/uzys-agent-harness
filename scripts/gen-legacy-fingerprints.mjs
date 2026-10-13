#!/usr/bin/env node
// #774 · ADR-111 — 옛 판(기록이 다 적지 못한 판)이 남긴 하네스 바이트의 닫힌 지문을 git 태그에서 뽑아 `src/legacy-fingerprints.ts` 를 쓴다.
//
// 입력 = git 태그 v26.70.0 ≤ v ≤ v26.169.0, **양끝 고정**. v26.170.0 부터 하네스는 쓰는 순간 기록하므로(writer) 새 판이 나와도 이 목록은
// 늘지 않는다 — 상한을 상수로 두어야 다음 태그가 생겨도 재생산 검사(`cmp`)가 깨지지 않는다. 미게시 태그(26.70~26.82)도 넣는다 — 바이트가 더
// 많이 알려질 뿐 설치자 파일을 오판할 길은 없다(설계 `docs/plans/v26.170.0-legacy-displaced-design.md` §3).
//
// 실행: node scripts/gen-legacy-fingerprints.mjs [out]   (out 생략 = src/legacy-fingerprints.ts)
// 재생산 확인: T=$(mktemp) && node scripts/gen-legacy-fingerprints.mjs "$T" && cmp "$T" src/legacy-fingerprints.ts
//
// 생성물은 손으로 고치지 않는다. 지문 함수(`legacySectionKey` · `legacyPreambleKey`)도 이 파일이 생성물에 써 넣는다 — 지문을 뽑은 규칙과
// 런타임이 대조하는 규칙이 한 곳에서 나온다(아래 `sectionKey` · `preambleLines` 와 생성물의 같은 이름 함수가 같은 일을 한다).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const RANGE_FROM = "26.70.0";
const RANGE_TO = "26.169.0";
/** 마커(#503) 이전 판 — 앵커 절 · `AGENTS.md` 템플릿 절 · 머리 지문의 상한. 그 뒤 판은 마커가 하네스 몫을 말한다. */
const PRE_MARKER_TO = "26.159.0";
/**
 * 옛 판이 그대로 복사한 템플릿 자리. `templates/codex/hooks/**` 는 렌더본이라 바이트가 안 맞아 넣지 않는다.
 * 헬퍼(`templates/scripts/*` → `.uzys-agent-harness/`)는 v26.141 부터 manifest 가 1:1 로 `copyFile` 했다(#812 — 옛 기록은 헬퍼를
 * 적지 않아 `no-sha` 이고 옛 바이트가 현행 번들과 달라, 지문 없이는 손대지 않은 헬퍼마다 백업이 남았다).
 */
const FILE_DIRS = [
  ["templates/rules/", ".claude/rules/"],
  ["templates/agents/", ".claude/agents/"],
  ["templates/commands/", ".claude/commands/"],
  ["templates/hooks/", ".claude/hooks/"],
  ["templates/skills/", ".claude/skills/"],
  ["templates/scripts/", ".uzys-agent-harness/"],
];
const AGENTS_TEMPLATE = /^templates\/(codex|opencode|antigravity)\/AGENTS\.md\.template$/;

const git = (...args) => execFileSync("git", args, { cwd: REPO, maxBuffer: 1 << 28 });
const sha = (buf) => createHash("sha256").update(buf).digest("hex");
const cmp = (a, b) => {
  const A = a.split(".").map(Number);
  const B = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i];
  return 0;
};
const inRange = (v, lo, hi) => cmp(v, lo) >= 0 && cmp(v, hi) <= 0;

/** 생성물의 `legacySectionKey` 와 같은 규칙. */
const sectionKey = (lines) => {
  const out = lines.map((l) => l.replace(/\r$/, "").trimEnd());
  while (out.length > 1 && out.at(-1) === "") out.pop();
  return sha(out.join("\n"));
};
/** 생성물의 `legacyPreambleKey` 가 해시하는 줄 — 첫 `## ` 앞 줄 중 `# ` 제목이 아닌 것(빈 줄 포함). */
const preambleLines = (text) => {
  const pre = [];
  for (const line of text.split("\n")) {
    if (/^## /.test(line)) break;
    pre.push(line);
  }
  return pre.filter((l) => !/^# /.test(l));
};
/** `## ` 줄로 나눈 절(헤딩 포함 줄 배열) — 첫 `## ` 앞은 뺀다. */
const splitSections = (lines) => {
  const secs = [];
  let cur = null;
  for (const line of lines) {
    if (/^## /.test(line)) {
      if (cur) secs.push(cur);
      cur = [line];
    } else if (cur) cur.push(line);
  }
  if (cur) secs.push(cur);
  return secs;
};
/** 옛 렌더(`renderAgentsMd` · `renameSlashes`, v26.70~v26.159 `src/codex/agents-md.ts`)와 같은 슬래시 이름 바꾸기 — 파일 전체에 걸렸다. */
const renameSlashes = (text) => text.replaceAll("/uzys:", "/uzys-");
/** 옛 렌더의 `{PROJECT_RULES}` 값 — 앵커의 첫 h1 줄을 떼고 trim. */
const anchorBody = (claudeMd) => claudeMd.replace(/^#\s+.*\r?\n/, "").trim();
/** 옛 `rules-port.ts`(v26.147~v26.159 동일)의 `stripClaudeFrontmatter` 와 같은 규칙. */
const stripFrontmatter = (source) => {
  if (!source.startsWith("---\n")) return source.trim();
  const end = source.indexOf("\n---", 4);
  return end === -1 ? source.trim() : source.slice(end + 4).trim();
};
/** 주석에 싣는 헤딩 — 템플릿 리터럴 안이라 백틱 · `${` 를 무해하게. */
const note = (s) => s.replace(/`/g, "'").replace(/\$\{/g, "$ {").replace(/\r/g, "");

const versions = git("tag", "-l")
  .toString()
  .split("\n")
  .filter((t) => /^v26\.\d+\.\d+$/.test(t))
  .map((t) => t.slice(1))
  .filter((v) => inRange(v, RANGE_FROM, RANGE_TO))
  .sort(cmp);

const blobSha = new Map(); // git blob id → sha256(content) — 판 사이에 같은 blob 이 대부분이라 한 번만 읽는다
const blobText = new Map();
const readBlob = (id) => {
  if (!blobText.has(id)) blobText.set(id, git("cat-file", "blob", id));
  return blobText.get(id);
};
const contentSha = (id) => {
  if (!blobSha.has(id)) blobSha.set(id, sha(readBlob(id)));
  return blobSha.get(id);
};

const files = new Map(); // 프로젝트 상대 경로 → Set(sha256), 삽입 순서 = 판 순서
const addFile = (p, s) => {
  if (!files.has(p)) files.set(p, new Set());
  files.get(p).add(s);
};
const agentsSections = new Map(); // 지문 → 주석
const preambles = new Map();
const anchorSections = new Map();
const namedSections = new Map(); // 하네스 이름 절(템플릿 제목 절 · 인라인 룰 절)의 옛 렌더 바이트 — 지문 → 주석
const hookCommands = new Set(); // 옛 템플릿 훅 핸들러의 command 원문(바이트 그대로)
const statusLines = new Map(); // sha256(JSON.stringify(statusLine)) → 주석

for (const v of versions) {
  const tree = git("ls-tree", "-r", `v${v}`, "--", "templates")
    .toString()
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [meta, path] = l.split("\t");
      return { blob: meta.split(" ")[2], path };
    });
  const pre = inRange(v, RANGE_FROM, PRE_MARKER_TO);
  let anchor = null;
  const agentsTemplates = [];
  const ruleSources = [];
  for (const { blob, path } of tree) {
    if (pre && path === "templates/CLAUDE.md") anchor = readBlob(blob).toString();
    if (pre && AGENTS_TEMPLATE.test(path)) agentsTemplates.push(readBlob(blob).toString());
    if (pre && /^templates\/rules\/[^/]+\.md$/.test(path)) ruleSources.push(readBlob(blob).toString());
    for (const [src, dst] of FILE_DIRS) {
      if (path.startsWith(src)) addFile(dst + path.slice(src.length), contentSha(blob));
    }
    // 옛 앵커 — 옛 판은 `templates/CLAUDE.md` 를 `.claude/CLAUDE.md` 로 바이트 그대로 복사했다
    if (path === "templates/CLAUDE.md") {
      addFile(".claude/CLAUDE.md", contentSha(blob));
      if (inRange(v, RANGE_FROM, PRE_MARKER_TO)) {
        // #739 의 앵커 절 — `AGENTS.md` 의 `## Project Rules` 에 넣을 때 첫 h1 을 떼고 `/uzys:` → `/uzys-` 로 바꿨다
        const lines = readBlob(blob).toString().replace(/\/uzys:/g, "/uzys-").split("\n");
        const h1 = lines.findIndex((l) => /^# /.test(l));
        if (h1 >= 0) lines.splice(h1, 1);
        for (const s of splitSections(lines)) {
          const k = sectionKey(s);
          if (!anchorSections.has(k)) anchorSections.set(k, `${s[0]} (${v})`);
        }
      }
    }
    if (path === "templates/settings.json") {
      const s = JSON.parse(readBlob(blob).toString());
      for (const ev of Object.values(s.hooks ?? {}))
        for (const e of ev)
          for (const h of e.hooks ?? []) {
            if (/\$CLAUDE_PROJECT_DIR\/\.claude\//.test(h.command ?? "")) hookCommands.add(h.command);
          }
      if (s.statusLine !== undefined) {
        const k = sha(JSON.stringify(s.statusLine));
        if (!statusLines.has(k)) statusLines.set(k, `statusLine (${v})`);
      }
    }
    if (AGENTS_TEMPLATE.test(path) && inRange(v, RANGE_FROM, PRE_MARKER_TO)) {
      const text = readBlob(blob).toString();
      // 자리표시자(`{PROJECT_NAME}` 등)가 있는 절은 렌더 뒤 바이트가 달라 지문이 될 수 없다
      for (const s of splitSections(text.split("\n"))) {
        if (s.some((l) => /\{[A-Z_]+\}/.test(l))) continue;
        const k = sectionKey(s);
        if (!agentsSections.has(k)) agentsSections.set(k, `${s[0]} (${v})`);
      }
      const head = preambleLines(text);
      if (head.some((l) => l.trim() !== "")) {
        const k = sectionKey(head);
        if (!preambles.has(k)) preambles.set(k, `${head.find((l) => l.trim() !== "")} (${v})`);
      }
    }
  }
  // 하네스 이름 절 — 템플릿이 제목을 정한 절(`Project Rules` 머리말 · `Harness Rules` 안내 · `Session Start` …)과 인라인 룰 절.
  // 옛 렌더가 쓴 바이트를 그대로 다시 만든다: `{PROJECT_RULES}` = 같은 판의 앵커 본문 · `{HARNESS_RULES}` 는 비우고(룰 절은 아래에서
  // 따로) · 파일 전체에 `/uzys:` → `/uzys-`. 자리표시자가 남은 절(`{PROJECT_CONTEXT}` · 제목)은 지문이 될 수 없다. 이름 절이 아닌 절
  // (앵커 하위 절)은 앵커 지문이 맡고, 위 꼬리 절 지문과 바이트가 같은 절은 거기 이미 있다 — 둘 다 여기 싣지 않는다.
  if (pre && anchor !== null) {
    const body = anchorBody(anchor);
    for (const template of agentsTemplates) {
      const own = new Set(
        splitSections(template.split("\n"))
          .filter((s) => !s.some((l) => /\{[A-Z_]+\}/.test(l)))
          .map(sectionKey),
      );
      const names = new Set([...template.matchAll(/^## .+$/gm)].map((m) => m[0]));
      const rendered = renameSlashes(
        template.replaceAll("{PROJECT_RULES}", body).replaceAll("{HARNESS_RULES}", ""),
      );
      for (const s of splitSections(rendered.split("\n"))) {
        if (!names.has(s[0]) || s.some((l) => /\{[A-Z_]+\}/.test(l))) continue;
        const k = sectionKey(s);
        if (!own.has(k) && !namedSections.has(k)) namedSections.set(k, `${s[0]} (${v})`);
      }
    }
    // 인라인 룰 — 옛 codex 렌더(`renderRulesBlock`)는 룰마다 앞머리를 떼고 첫 h1 을 `## ` 로 낮춰 `\n\n---\n\n` 으로 이었다. 룰의
    // 마지막 절은 다음 룰 앞이면 `---` 를 달고 끝 룰이면 달지 않는다 — 두 모양 다 싣는다.
    if (agentsTemplates.some((t) => t.includes("{HARNESS_RULES}"))) {
      for (const source of ruleSources) {
        const ported = renameSlashes(stripFrontmatter(source).replace(/^#\s+/, "## "));
        const secs = splitSections(ported.split("\n"));
        for (const [i, s] of secs.entries()) {
          const shapes = i === secs.length - 1 ? [s, [...s, "", "---"]] : [s];
          for (const shape of shapes) {
            const k = sectionKey(shape);
            if (!namedSections.has(k)) namedSections.set(k, `${s[0]} (rule ${v})`);
          }
        }
      }
    }
  }
}

const sortedFiles = [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const pairs = sortedFiles.reduce((n, [, s]) => n + s.size, 0);
const block = (rows) => `\`\n${rows.join("\n")}\n\``;
const keyRows = (m) => [...m].map(([k, c]) => `${k} ${note(c)}`);

const out = `// 생성물 — scripts/gen-legacy-fingerprints.mjs 가 쓴다. 손으로 고치지 않는다(ADR-111).
// 입력: git 태그 v${RANGE_FROM}~v${RANGE_TO} 양끝 고정(실제 ${versions[0]}~${versions.at(-1)}, ${versions.length}판). 앵커 절 · AGENTS.md 절 · 머리 지문은 ~v${PRE_MARKER_TO}(마커 이전 판).
// 재생산: T=$(mktemp) && node scripts/gen-legacy-fingerprints.mjs "$T" && cmp "$T" src/legacy-fingerprints.ts
//
// 지문은 **소유 근거가 아니다**(ADR-111 · 루트 CLAUDE.md "하네스 몫은 설치 기록 하나가 정한다"). 기록이 다 적지 못한 옛 판의 바이트를
// 알아볼 뿐이다 — 백업을 생략하는 것은 그 자리가 현행 번들에 있을 때뿐이고, 그 밖은 백업하고 치운다.
import { createHash } from "node:crypto";

/** 절(헤딩 포함 줄 배열)의 지문 — 줄 끝 \`\\r\` · 공백과 끝 빈 줄을 떼고 "\\n" 으로 이어 sha256. 아래 목록을 뽑은 규칙과 같다. */
export function legacySectionKey(lines: ReadonlyArray<string>): string {
  const out = lines.map((l) => l.replace(/\\r$/, "").trimEnd());
  while (out.length > 1 && out.at(-1) === "") out.pop();
  return createHash("sha256").update(out.join("\\n")).digest("hex");
}

/**
 * \`AGENTS.md\` 머리의 지문 — 첫 \`## \` 앞 줄 중 \`# \` 제목(프로젝트 이름이 들어간다)이 아닌 줄을 빈 줄까지 모아 \`legacySectionKey\`.
 * 머리가 비었으면 \`null\`.
 */
export function legacyPreambleKey(text: string): string | null {
  const pre: string[] = [];
  for (const line of text.split("\\n")) {
    if (/^## /.test(line)) break;
    pre.push(line);
  }
  const head = pre.filter((l) => !/^# /.test(l));
  return head.some((l) => l.trim() !== "") ? legacySectionKey(head) : null;
}

/** 한 줄 = \`<첫 토큰> <둘째 토큰|주석…>\` — 데이터는 템플릿 리터럴에 둔다(포매터가 줄을 바꾸지 않는다). */
function rows(text: string): string[][] {
  return text
    .split("\\n")
    .filter((l) => l !== "")
    .map((l) => l.split(" "));
}

function keySet(text: string): ReadonlySet<string> {
  return new Set(rows(text).map((r) => r[0] ?? ""));
}

const FILES = ${block(sortedFiles.flatMap(([p, s]) => [...s].map((x) => `${p} ${x}`)))};

/**
 * 옛 판이 \`.claude/\` · \`.uzys-agent-harness/\` 아래로 **그대로 복사**해 둔 하네스 파일 — 경로(프로젝트 상대) → 그 경로가 가졌던 바이트의 sha256 전부
 * (${sortedFiles.length} 경로 · ${pairs} 쌍). \`.agents/skills/<rel>\` 은 \`isLegacyHarnessFile\` 이 \`.claude/skills/<rel>\` 로 조회한다.
 */
export const LEGACY_HARNESS_FILES: ReadonlyMap<string, ReadonlySet<string>> = (() => {
  const m = new Map<string, Set<string>>();
  for (const [path = "", sha256 = ""] of rows(FILES)) {
    const s = m.get(path) ?? new Set<string>();
    s.add(sha256);
    m.set(path, s);
  }
  return m;
})();

/** 옛 codex 변환은 번들 스킬을 \`.agents/skills/<rel>\` 에 바이트 그대로 복사했다 — 같은 지문으로 본다. */
export function isLegacyHarnessFile(path: string, sha256: string): boolean {
  const key = path.startsWith(".agents/skills/")
    ? \`.claude/skills/\${path.slice(".agents/skills/".length)}\`
    : path;
  return LEGACY_HARNESS_FILES.get(key)?.has(sha256) === true;
}

/** 마커 이전 \`AGENTS.md.template\`(codex · opencode · antigravity)의 자리표시자 없는 \`## \` 절 (${agentsSections.size}). */
export const LEGACY_AGENTS_MD_SECTION_KEYS: ReadonlySet<string> = keySet(${block(keyRows(agentsSections))});

/**
 * 하네스 **이름 절**의 옛 렌더 바이트 (${namedSections.size}) — 템플릿이 제목을 정한 절(\`## Project Rules\` 머리말 · \`## Harness Rules\` 안내 ·
 * \`## Session Start\` …, 같은 판의 앵커 본문을 넣고 \`/uzys:\` → \`/uzys-\` 를 건 모양)과 인라인 룰 절(v26.147~ codex). 이름이 하네스 것이어도
 * 바이트가 여기 없으면 설치자가 고친 절이다 — uninstall 은 남긴다(사용자 결정 ⓓ).
 */
export const LEGACY_AGENTS_MD_NAMED_KEYS: ReadonlySet<string> = keySet(${block(keyRows(namedSections))});

/** 같은 템플릿의 머리(제목 다음 블록인용) — \`legacyPreambleKey\` 로 대조한다 (${preambles.size}). */
export const LEGACY_AGENTS_MD_PREAMBLE_KEYS: ReadonlySet<string> = keySet(${block(keyRows(preambles))});

/**
 * #739 — 마커 이전 판이 \`AGENTS.md\` 의 \`## Project Rules\` 에 통째로 넣은 앵커(\`templates/CLAUDE.md\` — 첫 h1 제거 · \`/uzys:\` → \`/uzys-\`)
 * 절의 지문 (${anchorSections.size}). \`src/retired-anchor-sections.ts\` 가 다시 내보낸다.
 */
export const RETIRED_ANCHOR_SECTION_KEYS: ReadonlySet<string> = keySet(${block(keyRows(anchorSections))});

/**
 * 옛 \`templates/settings.json\` 이 \`$CLAUDE_PROJECT_DIR/.claude/\` 로 배선한 훅 핸들러의 command 원문 (${hookCommands.size}). 이 문자열과
 * 바이트로 같은 줄만 옛 하네스 줄이다 — 설치자가 한 글자라도 고쳤으면 설치자 줄이다(#781).
 */
export const LEGACY_HOOK_COMMANDS: ReadonlySet<string> = new Set([
${[...hookCommands]
  .sort()
  .map((c) => `  '${c}',`)
  .join("\n")}
]);

/** 옛 템플릿 \`statusLine\` 값의 \`sha256(JSON.stringify(value))\` (${statusLines.size}). */
export const LEGACY_STATUSLINE_VALUES: ReadonlySet<string> = keySet(${block(keyRows(statusLines))});
`;

const target = process.argv[2] ?? join(REPO, "src/legacy-fingerprints.ts");
writeFileSync(target, out);
console.log(
  JSON.stringify(
    {
      range: `${RANGE_FROM}~${RANGE_TO}`,
      versions: versions.length,
      first: versions[0],
      last: versions.at(-1),
      filePaths: sortedFiles.length,
      filePairs: pairs,
      agentsMdSectionKeys: agentsSections.size,
      preambleKeys: preambles.size,
      anchorSectionKeys: anchorSections.size,
      namedSectionKeys: namedSections.size,
      hookCommands: [...hookCommands].sort(),
      statusLines: statusLines.size,
      outBytes: Buffer.byteLength(out),
    },
    null,
    2,
  ),
);

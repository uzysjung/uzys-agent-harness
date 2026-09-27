/**
 * `toml-region` — `.codex/config.toml` (#551 · ADR-097 §6.2).
 *
 * 몫 = 이름 붙은 구간(`# uzys-harness:<name>:start` ~ `:end`). 설계의 두 구간:
 *   `top`    최상위 키(`approval_policy` · `sandbox_mode`) — **첫 `[table]` 헤더 앞**에 끼운다. 파일 끝에 두면
 *            설치자의 마지막 `[table]` 안으로 들어가 Codex 가 조용히 무시한다(B4 · `strict_config.rs`).
 *   그 밖    표 구간(`[sandbox_workspace_write]` · `[[hooks.*]]` · `[mcp_servers.*]` …) — 파일 끝에 붙인다.
 *
 * 충돌은 **읽어서** 판정한다(쓰기는 구간 텍스트 그대로): 구간 밖에 같은 최상위 키 · 같은 `[table]` 이 있으면
 * 그 항목을 구간에서 뺀다(설치자 값 우선, `kept` 로 알린다). `[[배열 표]]` 는 더하기만 하고 충돌로 보지 않는다.
 *
 * 읽기는 **외부 의존성 없는 구조 스캐너**다 — 키 줄 · 표 헤더 · 문자열/배열의 여러 줄 걸침 · 중복 키/표를 본다.
 * 값의 문법 전부를 검사하지는 않는다(설계 §6.2 "TOML 은 읽기용 파서 하나만 … 라이브러리 선택은 구현 선택").
 * 쓴 결과도 한 번 더 읽어, 읽히지 않는 파일을 만들 바에는 쓰지 않는다. 배선은 PR-4 — 지금 `.codex/config.toml`
 * 은 여전히 통째로 렌더된다(`src/codex/config-toml.ts`, 이 PR 은 손대지 않는다).
 */

import { hashContent } from "../install-log.js";
import {
  type PortionAdapter,
  planStrip,
  planUpsert,
  type StripResult,
  type UpsertResult,
} from "./contract.js";
import {
  appendRun,
  applyEdits,
  type Edit,
  insertRun,
  parseRegions,
  type Region,
} from "./text-runs.js";

/** 첫 `[table]` 앞에 들어가는 구간 이름. 나머지 이름은 파일 끝. */
export const TOP_REGION = "top";

const MARKER_LINE = /^# uzys-harness:([A-Za-z0-9_-]+):(start|end)$/;
const UNREADABLE = "invalid TOML";

const BARE = "[A-Za-z0-9_-]+";
const BASIC = '"(?:[^"\\\\]|\\\\.)*"';
const LITERAL = "'[^']*'";
const SIMPLE = `(?:${BARE}|${BASIC}|${LITERAL})`;
const DOTTED = `${SIMPLE}(?:\\s*\\.\\s*${SIMPLE})*`;
const KEY_LINE = new RegExp(`^(${DOTTED})\\s*=(.*)$`);
const TABLE = new RegExp(`^\\[\\s*(${DOTTED})\\s*\\]\\s*(?:#.*)?$`);
const ARRAY_TABLE = new RegExp(`^\\[\\[\\s*(${DOTTED})\\s*\\]\\]\\s*(?:#.*)?$`);

export type TomlItem =
  | { kind: "key"; table: string | null; key: string; startLine: number; endLine: number }
  | { kind: "header"; name: string; array: boolean; line: number };

/** `"a" . b` → `a.b` — 따옴표가 필요 없는 조각은 벗긴다(같은 키를 같은 이름으로 비교하려고). */
function normName(dotted: string): string {
  const parts = dotted.match(new RegExp(SIMPLE, "g")) ?? [];
  return parts
    .map((p) => {
      const raw = p.startsWith('"')
        ? (JSON.parse(p) as string)
        : p.startsWith("'")
          ? p.slice(1, -1)
          : p;
      return new RegExp(`^${BARE}$`).test(raw) ? raw : JSON.stringify(raw);
    })
    .join(".");
}

/** 값이 끝나는 줄의 다음 줄 번호. 문자열·괄호가 닫히지 않으면 -1. */
function valueEnd(lines: ReadonlyArray<string>, first: number, rest: string): number {
  let depth = 0;
  let str: '"' | "'" | '"""' | "'''" | null = null;
  let text = rest;
  for (let li = first; ; ) {
    for (let c = 0; c < text.length; c++) {
      const ch = text[c];
      if (str === '"""' || str === "'''") {
        if (text.startsWith(str, c)) {
          str = null;
          c += 2;
        } else if (str === '"""' && ch === "\\") c++;
        continue;
      }
      if (str === '"') {
        if (ch === "\\") c++;
        else if (ch === '"') str = null;
        continue;
      }
      if (str === "'") {
        if (ch === "'") str = null;
        continue;
      }
      if (ch === "#") break;
      if (text.startsWith('"""', c) || text.startsWith("'''", c)) {
        str = text.startsWith('"""', c) ? '"""' : "'''";
        c += 2;
      } else if (ch === '"' || ch === "'") str = ch;
      else if (ch === "[" || ch === "{") depth++;
      else if (ch === "]" || ch === "}") {
        depth--;
        if (depth < 0) return -1;
      }
    }
    if (str === '"' || str === "'") return -1; // 한 줄 문자열은 줄을 넘지 못한다
    if (depth === 0 && str === null) return li + 1;
    li++;
    if (li >= lines.length) return -1;
    text = lines[li] ?? "";
  }
}

/** 구조 스캔. 읽지 못하면 null. */
export function scanToml(text: string): TomlItem[] | null {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  const items: TomlItem[] = [];
  const tables = new Set<string>();
  const keys = new Map<string, Set<string>>();
  let table: string | null = null;
  let scope = "";
  let arrays = 0;
  for (let i = 0; i < lines.length; ) {
    const t = (lines[i] ?? "").trim();
    if (t === "" || t.startsWith("#")) {
      i++;
      continue;
    }
    const arr = ARRAY_TABLE.exec(t);
    const tab = arr ? null : TABLE.exec(t);
    if (arr || tab) {
      const name = normName((arr ?? tab)?.[1] ?? "");
      if (tab && tables.has(name)) return null;
      if (tab) tables.add(name);
      items.push({ kind: "header", name, array: arr !== null, line: i });
      table = name;
      scope = arr ? `${name}#${arrays++}` : name;
      i++;
      continue;
    }
    const kv = KEY_LINE.exec(t);
    const rest = (kv?.[2] ?? "").trim();
    if (!kv || rest === "" || rest.startsWith("#")) return null;
    const end = valueEnd(lines, i, rest);
    if (end === -1) return null;
    const key = normName(kv[1] ?? "");
    const seen = keys.get(scope) ?? new Set<string>();
    if (seen.has(key)) return null;
    seen.add(key);
    keys.set(scope, seen);
    items.push({ kind: "key", table, key, startLine: i, endLine: end });
    i = end;
  }
  return items;
}

function parseRegionsIn(text: string): Map<string, Region> | null {
  return scanToml(text) === null ? null : parseRegions(text, MARKER_LINE);
}

function regionText(name: string, body: string): string {
  return `# uzys-harness:${name}:start\n${body}\n# uzys-harness:${name}:end`;
}

/** 구간 밖(설치자 것)의 최상위 키와 `[table]` 이름. 구간 줄은 빈 줄로 가려 줄 번호를 지킨다. */
function installerNames(text: string, regions: ReadonlyMap<string, Region>): Set<string> {
  let masked = text;
  for (const r of regions.values()) {
    const span = text.slice(r.start, r.end);
    masked = `${masked.slice(0, r.start)}${span.replace(/[^\n]/g, " ")}${masked.slice(r.end)}`;
  }
  const names = new Set<string>();
  for (const item of scanToml(masked) ?? []) {
    if (item.kind === "header" && !item.array) names.add(`[${item.name}]`);
    if (item.kind === "key" && item.table === null) {
      names.add(item.key);
      if (item.key.includes(".")) names.add(`[${item.key.split(".")[0]}]`); // 점 키가 암묵적으로 만드는 표
    }
  }
  return names;
}

/**
 * 렌더 구간에서 설치자와 겹치는 항목을 뺀다.
 * @returns 남은 본문(항목이 하나도 안 남으면 null)과 뺀 이름
 */
function filterRegion(
  body: string,
  taken: ReadonlySet<string>,
): { body: string | null; dropped: string[] } {
  const items = scanToml(body);
  if (items === null) throw new Error("toml-region: rendered region is not readable TOML");
  const lines = body.split("\n");
  const drop = new Set<number>();
  const dropped: string[] = [];
  for (const [n, item] of items.entries()) {
    if (item.kind === "key" && item.table === null && taken.has(item.key)) {
      for (let l = item.startLine; l < item.endLine; l++) drop.add(l);
      dropped.push(item.key);
    }
    if (item.kind === "header" && !item.array && taken.has(`[${item.name}]`)) {
      const next = items.slice(n + 1).find((x) => x.kind === "header");
      const end = next?.kind === "header" ? next.line : lines.length;
      for (let l = item.line; l < end; l++) drop.add(l);
      dropped.push(`[${item.name}]`);
    }
  }
  const kept = lines.filter((_, i) => !drop.has(i)).join("\n");
  const remaining = scanToml(kept) ?? [];
  return { body: remaining.length === 0 ? null : kept, dropped };
}

function shas(regions: ReadonlyMap<string, Region>): Map<string, string> {
  return new Map([...regions].map(([k, r]) => [k, hashContent(r.body)]));
}

function at<T>(map: ReadonlyMap<string, T>, key: string): T {
  const v = map.get(key);
  if (v === undefined) throw new Error(`toml-region: no entry for ${key}`);
  return v;
}

/** `top` 을 끼울 자리 — 구간 밖 첫 `[table]` 헤더와 다른 구간의 시작 중 앞선 것. 없으면 파일 끝. */
function topInsertAt(text: string): number | null {
  const regions = parseRegions(text, MARKER_LINE) ?? new Map<string, Region>();
  const inRegion = (off: number) =>
    [...regions.values()].some((r) => off >= r.start && off < r.end);
  const lines = text.split("\n");
  let off = 0;
  let first: number | null = null;
  for (const line of lines) {
    const t = line.trim();
    if ((ARRAY_TABLE.test(t) || TABLE.test(t)) && !inRegion(off)) {
      first = off;
      break;
    }
    off += line.length + 1;
  }
  const starts = [...regions].filter(([k]) => k !== TOP_REGION).map(([, r]) => r.start);
  const candidates = [...(first === null ? [] : [first]), ...starts];
  return candidates.length === 0 ? null : Math.min(...candidates);
}

export const tomlRegion: PortionAdapter<string> = {
  unreadable: UNREADABLE,

  read(text, keys) {
    const regions = parseRegionsIn(text);
    if (regions === null) return null;
    const all = shas(regions);
    return new Map(
      [...(keys ?? all.keys())].flatMap((k) => (all.has(k) ? [[k, at(all, k)] as const] : [])),
    );
  },

  upsert(existing, input): UpsertResult {
    const fresh = existing === null;
    const base = existing ?? input.seed ?? "";
    const regions = parseRegionsIn(base);
    if (regions === null) return { ok: false, reason: UNREADABLE };
    const taken = installerNames(base, regions);
    const kept: string[] = [];
    const render = new Map<string, string>();
    for (const [name, body] of input.render) {
      if (input.excluded.has(name)) continue;
      const filtered = filterRegion(body, taken);
      kept.push(...filtered.dropped);
      if (filtered.body !== null) render.set(name, filtered.body);
    }
    const plan = planUpsert({
      render: new Map([...render].map(([k, v]) => [k, hashContent(v)])),
      recorded: fresh ? new Map() : input.recorded,
      present: shas(regions),
      excluded: input.excluded,
    });
    const edits: Edit[] = [
      ...plan.replace.map((k) => {
        const r = at(regions, k);
        return {
          start: r.start,
          end: r.end,
          replacement: `${regionText(k, at(render, k))}${r.newline ? "\n" : ""}`,
        };
      }),
      ...plan.remove.map((k) => ({
        start: at(regions, k).start,
        end: at(regions, k).end,
        replacement: null,
      })),
    ];
    let text = applyEdits(base, edits);
    const adds = [...plan.add].sort((a, b) => Number(b === TOP_REGION) - Number(a === TOP_REGION));
    for (const k of adds) {
      const run = regionText(k, at(render, k));
      const pos = k === TOP_REGION ? topInsertAt(text) : null;
      text = pos === null ? appendRun(text, run) : insertRun(text, pos, run);
    }
    if (scanToml(text) === null)
      return { ok: false, reason: "the merged result would not be readable TOML" };
    return {
      ok: true,
      text,
      changed: fresh || text !== base,
      portions: plan.portions,
      deleted: plan.deleted,
      kept: [...kept, ...plan.kept],
    };
  },

  strip(existing, input): StripResult {
    const regions = parseRegionsIn(existing);
    if (regions === null) return { ok: false, reason: UNREADABLE };
    const plan = planStrip({
      recorded: input.recorded,
      present: shas(regions),
      excluded: input.excluded,
    });
    const text = applyEdits(
      existing,
      plan.remove.map((k) => ({
        start: at(regions, k).start,
        end: at(regions, k).end,
        replacement: null,
      })),
    );
    return {
      ok: true,
      text,
      changed: text !== existing,
      removed: plan.remove,
      kept: plan.kept,
      portions: plan.portions,
      empty: text.trim() === "",
    };
  },
};

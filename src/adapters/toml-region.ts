/**
 * `toml-region` — `.codex/config.toml` (#551 · ADR-097 §6.2).
 *
 * 몫 = 이름 붙은 구간(`# uzys-harness:<name>:start` ~ `:end`). 설계의 두 구간:
 *   `top`    최상위 키(`approval_policy` · `sandbox_mode`) — **파일 맨 앞**에 끼운다. 파일 끝이면 설치자의 마지막
 *            `[table]` 안으로 들어가 Codex 가 조용히 무시하고(B4 · `strict_config.rs`), "첫 `[table]` 앞" 을 줄로
 *            찾으면 여러 줄 문자열 안의 `[…]` 줄에 속는다(#551 리뷰 N7). 파일 시작은 늘 루트 표다.
 *   그 밖    표 구간(`[sandbox_workspace_write]` · `[[hooks.*]]` · `[mcp_servers.*]` …) — 파일 끝에 붙인다.
 *
 * **판정과 사후 검증은 실제 TOML 파서(`smol-toml`)로 한다**(#551 리뷰 B2 — 구조 스캐너는 인라인 표 · 점 키가 만드는
 * 암묵 표를 못 봐 Codex 가 못 읽는 파일을 `ok:true` 로 냈다). 쓰기는 구간 텍스트 그대로다 — 직렬화로 설치자 파일을
 * 다시 쓰지 않는다.
 *   - 충돌: 구간 밖(설치자 것)을 파싱한 객체에 렌더 항목의 키 경로가 명시 · 암묵 · 인라인 · 점 키 어느 형태로든 있으면
 *     그 항목을 구간에서 뺀다(설치자 값 우선, `kept` 로 알린다). 경로가 없어도 그 항목을 더한 문서가 파싱되지 않으면
 *     (닫힌 인라인 표를 넓히는 등) 같이 뺀다. `[[배열 표]]` 는 더하기라 경로 충돌로 보지 않는다.
 *   - 사후 검증: 쓴 결과를 다시 파싱해 실패하면 쓰지 않는다(`ok:false`).
 *   - 기존 파일이 파싱되지 않으면 unreadable — 한 바이트도 쓰지 않는다(#574).
 */

import { parse } from "smol-toml";
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

/** 파일 맨 앞에 들어가는 구간 이름. 나머지 이름은 파일 끝. */
export const TOP_REGION = "top";

const MARKER_LINE = /^# uzys-harness:([A-Za-z0-9_-]+):(start|end)$/;
const UNREADABLE = "invalid TOML";
const MARKERS_BROKEN = "harness markers are broken";
const WOULD_BREAK = "the merged result would not be readable TOML";

type Table = Record<string, unknown>;

/** TOML 로 읽히면 그 객체, 아니면 null. */
export function readToml(text: string): Table | null {
  try {
    return parse(text) as Table;
  } catch {
    return null;
  }
}

function isTable(v: unknown): v is Table {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** CRLF 로 체크아웃돼도 같은 구간으로 읽는다(#551 리뷰 N6). */
function normEol(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r$/, "");
}

function shas(regions: ReadonlyMap<string, Region>): Map<string, string> {
  return new Map([...regions].map(([k, r]) => [k, hashContent(normEol(r.body))]));
}

function at<T>(map: ReadonlyMap<string, T>, key: string): T {
  const v = map.get(key);
  if (v === undefined) throw new Error(`toml-region: no entry for ${key}`);
  return v;
}

/** 구간 줄을 공백으로 가려(줄 수는 그대로) 설치자 것만 남긴다. */
function maskRegions(text: string, regions: ReadonlyMap<string, Region>): string {
  let out = text;
  for (const r of regions.values()) {
    out = `${out.slice(0, r.start)}${out.slice(r.start, r.end).replace(/[^\n]/g, " ")}${out.slice(r.end)}`;
  }
  return out;
}

/** 렌더 구간 안의 항목 하나 — 최상위 키 하나, 또는 표 헤더와 그 아래 키들. */
interface Item {
  text: string;
  /** 화면에 쓰는 이름(`approval_policy` · `[mcp_servers.context7]`). */
  name: string;
  path: string[];
  header: "table" | "array" | null;
}

function isStatement(line: string): boolean {
  const t = line.trim();
  return t !== "" && !t.startsWith("#");
}

/** 한 항목만 담은 객체에서 키 경로를 뽑는다 — 키가 하나뿐인 표를 따라 내려간다. */
function soloPath(obj: Table): { path: string[]; array: boolean } {
  const path: string[] = [];
  let cur: unknown = obj;
  while (isTable(cur)) {
    const keys = Object.keys(cur);
    const only = keys[0];
    if (keys.length !== 1 || only === undefined) break;
    path.push(only);
    cur = cur[only];
  }
  return { path, array: Array.isArray(cur) };
}

/**
 * 렌더 구간을 항목으로 자른다 — 경계는 **파서가 정한다**: 다음 문장 줄에서 끊으려면 그 앞까지가 TOML 로 읽혀야 한다
 * (여러 줄 배열·문자열 안의 줄에서는 끊기지 않는다). 표 항목은 다음 헤더에서만 끊는다.
 */
function segment(body: string): Item[] {
  const lines = body.split("\n");
  const cuts: number[] = [0];
  let from = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!isStatement(line)) continue;
    const first = lines.slice(from, i).find(isStatement);
    if (first === undefined) continue;
    if (first.trim().startsWith("[") && !line.trim().startsWith("[")) continue;
    if (readToml(lines.slice(from, i).join("\n")) === null) continue;
    cuts.push(i);
    from = i;
  }
  cuts.push(lines.length);
  const items: Item[] = [];
  for (let c = 0; c + 1 < cuts.length; c++) {
    const text = lines.slice(cuts[c], cuts[c + 1]).join("\n");
    const first = text.split("\n").find(isStatement);
    if (first === undefined) continue;
    const obj = readToml(text);
    if (obj === null) throw new Error("toml-region: rendered region is not readable TOML");
    const isHeader = first.trim().startsWith("[");
    const solo = soloPath(isHeader ? (readToml(first.trim()) ?? {}) : obj);
    const header = isHeader ? (solo.array ? "array" : "table") : null;
    const dotted = solo.path.join(".");
    const name = header === "array" ? `[[${dotted}]]` : header === "table" ? `[${dotted}]` : dotted;
    items.push({ text, name, path: solo.path, header });
  }
  return items;
}

function hasPath(obj: Table, path: ReadonlyArray<string>): boolean {
  let cur: unknown = obj;
  for (const seg of path) {
    if (!isTable(cur) || !(seg in cur)) return false;
    cur = cur[seg];
  }
  return path.length > 0;
}

/**
 * 렌더 구간들에서 설치자와 겹치는 항목을 뺀다. 판정 문서 = `top` 몫 + 설치자 것 + 표 몫 — 최종 배치와 같다.
 * @returns 남은 본문(항목이 하나도 안 남은 구간은 빠진다)과 뺀 항목 이름
 */
function filterRender(
  render: ReadonlyMap<string, string>,
  outside: string,
): { render: Map<string, string>; kept: string[] } {
  const installer = readToml(outside) ?? {};
  const kept: string[] = [];
  const out = new Map<string, string>();
  const top: string[] = [];
  const tail: string[] = [];
  const doc = () => [...top, outside, ...tail].join("\n");
  const ordered = [...render].sort(
    ([a], [b]) => Number(b === TOP_REGION) - Number(a === TOP_REGION),
  );
  for (const [name, body] of ordered) {
    const side = name === TOP_REGION ? top : tail;
    const items = segment(body);
    if (name !== TOP_REGION && items[0] !== undefined && items[0].header === null) {
      // 파일 끝 구간이 최상위 키로 시작하면 설치자의 마지막 표 안으로 들어간다 — 렌더가 잘못됐다
      throw new Error(`toml-region: region ${name} must start with a [table] header`);
    }
    const mine: string[] = [];
    for (const item of items) {
      const taken = item.header !== "array" && hasPath(installer, item.path);
      side.push(item.text);
      if (taken || readToml(doc()) === null) {
        side.pop();
        kept.push(item.name);
        continue;
      }
      mine.push(item.text);
    }
    if (mine.length > 0) out.set(name, mine.join("\n"));
  }
  return { render: out, kept };
}

function regionText(name: string, body: string): string {
  return `# uzys-harness:${name}:start\n${body}\n# uzys-harness:${name}:end`;
}

/** 파일을 읽는다 — 파서가 못 읽으면 unreadable, 마커가 깨졌으면 markers. */
function load(text: string): Map<string, Region> | "unreadable" | "markers" {
  if (readToml(text) === null) return "unreadable";
  return parseRegions(text, MARKER_LINE) ?? "markers";
}

function fail(state: "unreadable" | "markers"): { ok: false; reason: string } {
  return { ok: false, reason: state === "unreadable" ? UNREADABLE : MARKERS_BROKEN };
}

export const tomlRegion: PortionAdapter<string> = {
  unreadable: UNREADABLE,

  read(text, keys) {
    const regions = load(text);
    if (typeof regions === "string") return null;
    const all = shas(regions);
    return new Map(
      [...(keys ?? all.keys())].flatMap((k) => (all.has(k) ? [[k, at(all, k)] as const] : [])),
    );
  },

  upsert(existing, input): UpsertResult {
    const fresh = existing === null;
    const base = existing ?? input.seed ?? "";
    const regions = load(base);
    if (typeof regions === "string") return fail(regions);
    const wanted = new Map([...input.render].filter(([k]) => !input.excluded.has(k)));
    const filtered = filterRender(wanted, maskRegions(base, regions));
    const plan = planUpsert({
      render: new Map([...filtered.render].map(([k, v]) => [k, hashContent(v)])),
      recorded: fresh ? new Map() : input.recorded,
      present: shas(regions),
      excluded: input.excluded,
    });
    const edits: Edit[] = [
      ...plan.replace.map((k) => {
        const r = at(regions, k);
        const run = `${regionText(k, at(filtered.render, k))}${r.newline ? "\n" : ""}`;
        return { start: r.start, end: r.end, replacement: run };
      }),
      ...plan.remove.map((k) => ({
        start: at(regions, k).start,
        end: at(regions, k).end,
        replacement: null,
      })),
    ];
    let text = applyEdits(base, edits);
    for (const k of plan.add) {
      const run = regionText(k, at(filtered.render, k));
      text = k === TOP_REGION ? insertRun(text, 0, run) : appendRun(text, run);
    }
    if (readToml(text) === null) return { ok: false, reason: WOULD_BREAK };
    return {
      ok: true,
      text,
      changed: fresh || text !== base,
      portions: plan.portions,
      deleted: plan.deleted,
      kept: [...filtered.kept, ...plan.kept],
    };
  },

  strip(existing, input): StripResult {
    const regions = load(existing);
    if (typeof regions === "string") return fail(regions);
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

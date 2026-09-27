/**
 * `json-keys` — `.mcp.json` · `opencode.json` · `.claude/settings.json` (#551 · ADR-097 §6.2).
 *
 * 키 문법(설계 표 그대로):
 *   `statusLine`                          최상위 속성
 *   `mcpServers.<name>` · `mcp.<name>`    객체 안 속성 — 첫 `.` 에서만 자른다(서버 이름에 `.` 이 있어도 된다)
 *   `hooks.<Event>#<script>`              `hooks.<Event>` 배열에서 `hooks[].command` 가 `.claude/hooks/<script>`
 *                                         를 부르는 **항목**(matcher 묶음) — 배열은 항목 단위다
 *   `<path>{}` · `<path>[]`               하네스가 **만든** 빈 컨테이너 — strip 이 비었으면 걷는다
 *
 * 컨테이너 키가 따로 있는 이유: strip 은 "빈 컨테이너 정리"를 해야 하는데(설정 파일에 `hooks` 가 없던
 * 설치자에게 빈 `"hooks": {}` 를 남기면 원본이 아니다), 설치자가 **원래 갖고 있던** 빈 컨테이너
 * (`"mcpServers": {}`)까지 걷으면 역시 원본이 아니다. 누가 만들었는지는 기록만 안다.
 *
 * 값의 sha 는 키 순서를 정렬한 JSON 으로 잰다 — 설치자가 들여쓰기·키 순서만 바꾼 것은 편집이 아니다.
 * 쓰기는 `JSON.stringify(…, null, 2)` 이고, 바뀐 것이 없으면 입력 바이트를 그대로 돌려준다(N-a).
 * 기존 `mcp-merge.ts` 의 `mergeUserBase` 는 파싱 실패 시 템플릿으로 덮는다(#574) — 그 호출부는 PR-3 이
 * 이 어댑터로 옮기며 고친다. 여기서는 파싱 실패 = `{ ok: false }` 다.
 */

import { hashContent } from "../install-log.js";
import {
  type PortionAdapter,
  planStrip,
  planUpsert,
  type StripResult,
  type UpsertResult,
} from "./contract.js";

type JsonObject = Record<string, unknown>;

const UNREADABLE = "invalid JSON";

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseRoot(text: string): JsonObject | null {
  try {
    const v: unknown = JSON.parse(text);
    return isObject(v) ? v : null;
  } catch {
    return null;
  }
}

/** 키 순서를 정렬한 직렬화 — sha 가 들여쓰기·순서에 흔들리지 않게. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObject(v)) {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

export function jsonSha(v: unknown): string {
  return hashContent(stable(v));
}

/** 컨테이너 키의 sha 는 뜻이 없다 — 고정값으로 둬 기록이 흔들리지 않게 한다. */
const CONTAINER_SHA = hashContent("uzys-harness:container");

type Parsed =
  | { kind: "container"; path: string[]; shape: "object" | "array" }
  | { kind: "item"; path: string[]; script: string }
  | { kind: "prop"; path: string[]; name: string };

/** `a` → [] + a · `a.b` → [a] + b (첫 `.` 에서만). */
function splitHead(s: string): string[] {
  const dot = s.indexOf(".");
  return dot === -1 ? [s] : [s.slice(0, dot), s.slice(dot + 1)];
}

function parseKey(key: string): Parsed {
  const container = /^(.+?)(\{\}|\[\])$/.exec(key);
  if (container) {
    return {
      kind: "container",
      path: splitHead(container[1] ?? ""),
      shape: container[2] === "{}" ? "object" : "array",
    };
  }
  const hash = key.indexOf("#");
  if (hash !== -1)
    return { kind: "item", path: splitHead(key.slice(0, hash)), script: key.slice(hash + 1) };
  const path = splitHead(key);
  return { kind: "prop", path: path.slice(0, -1), name: path.at(-1) ?? key };
}

export function isContainerKey(key: string): boolean {
  return parseKey(key).kind === "container";
}

/** settings.json 훅 항목은 기록된 키면 sha 와 무관하게 뺀다(N-f · N13 — 스크립트가 함께 사라진다). */
function alwaysStrip(key: string): boolean {
  return parseKey(key).kind === "item";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 이 matcher 묶음이 `.claude/hooks/<script>` 를 부르는가. */
function callsScript(entry: unknown, script: string): boolean {
  if (!isObject(entry) || !Array.isArray(entry.hooks)) return false;
  const re = new RegExp(`(?:^|[\\s"'/])\\.claude/hooks/${escapeRe(script)}(?=$|[\\s"'])`);
  return entry.hooks.some(
    (h) => isObject(h) && typeof h.command === "string" && re.test(h.command),
  );
}

/** 경로의 컨테이너. 없으면 undefined, 있는데 모양이 다르면 null(설치자 값 — 건드리지 않는다). */
function walk(root: JsonObject, path: ReadonlyArray<string>): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (!isObject(cur)) return null;
    cur = cur[seg];
    if (cur === undefined) return undefined;
  }
  return cur;
}

function readKey(root: JsonObject, key: string): unknown {
  const p = parseKey(key);
  const holder = walk(root, p.path);
  if (p.kind === "container") return holder ?? undefined;
  if (p.kind === "item") {
    return Array.isArray(holder) ? holder.find((e) => callsScript(e, p.script)) : undefined;
  }
  return isObject(holder) ? holder[p.name] : undefined;
}

/**
 * 값을 쓴다 — 없는 컨테이너는 만들고 그 컨테이너 키를 `created` 에 적는다.
 * @returns 컨테이너 자리에 모양이 다른 설치자 값이 있으면 false(쓰지 않았다)
 */
function writeKey(root: JsonObject, key: string, value: unknown, created: string[]): boolean {
  const p = parseKey(key);
  if (p.kind === "container") return false;
  // 컨테이너 사슬: 마지막 칸은 item 이면 배열, prop 이면 객체
  let cur: JsonObject = root;
  const chain = p.path;
  for (const [i, seg] of chain.entries()) {
    const last = i === chain.length - 1;
    const wantArray = last && p.kind === "item";
    const existing = cur[seg];
    if (existing === undefined) {
      const fresh = wantArray ? [] : {};
      cur[seg] = fresh;
      created.push(`${chain.slice(0, i + 1).join(".")}${wantArray ? "[]" : "{}"}`);
    } else if (wantArray ? !Array.isArray(existing) : !isObject(existing)) {
      return false;
    }
    if (!wantArray) cur = cur[seg] as JsonObject;
  }
  if (p.kind === "item") {
    const arr = walk(root, chain) as unknown[];
    const at = arr.findIndex((e) => callsScript(e, p.script));
    if (at === -1) arr.push(value);
    else arr[at] = value;
    return true;
  }
  cur[p.name] = value;
  return true;
}

function deleteKey(root: JsonObject, key: string): void {
  const p = parseKey(key);
  if (p.kind === "item") {
    const arr = walk(root, p.path);
    if (!Array.isArray(arr)) return;
    const at = arr.findIndex((e) => callsScript(e, p.script));
    if (at !== -1) arr.splice(at, 1);
    return;
  }
  const holderPath = p.kind === "container" ? p.path.slice(0, -1) : p.path;
  const name = p.kind === "container" ? (p.path.at(-1) ?? "") : p.name;
  const holder = holderPath.length === 0 ? root : walk(root, holderPath);
  if (isObject(holder)) delete holder[name];
}

function isEmptyContainer(v: unknown): boolean {
  return (Array.isArray(v) && v.length === 0) || (isObject(v) && Object.keys(v).length === 0);
}

/** 하네스가 만든 컨테이너 중 비었으면 걷는다 — 깊은 것부터. 남은 것만 기록으로 돌려준다. */
function pruneContainers(root: JsonObject, containers: ReadonlyArray<string>): string[] {
  const depth = (k: string) => parseKey(k).path.length;
  const kept: string[] = [];
  for (const key of [...containers].sort((a, b) => depth(b) - depth(a))) {
    const v = readKey(root, key);
    if (v === undefined || v === null) continue;
    if (isEmptyContainer(v)) deleteKey(root, key);
    else kept.push(key);
  }
  return kept;
}

function present(root: JsonObject, keys: Iterable<string>): Map<string, string> {
  const out = new Map<string, string>();
  for (const k of keys) {
    if (isContainerKey(k)) continue;
    const v = readKey(root, k);
    if (v !== undefined) out.set(k, jsonSha(v));
  }
  return out;
}

function serialize(root: JsonObject): string {
  return `${JSON.stringify(root, null, 2)}\n`;
}

function valueKeys(m: ReadonlyMap<string, unknown>): string[] {
  return [...m.keys()].filter((k) => !isContainerKey(k));
}

export const jsonKeys: PortionAdapter<unknown> = {
  unreadable: UNREADABLE,

  read(text, keys) {
    const root = parseRoot(text);
    if (root === null) return null;
    return present(root, keys ?? Object.keys(root));
  },

  upsert(existing, input): UpsertResult {
    const fresh = existing === null;
    const root = fresh ? {} : parseRoot(existing);
    if (root === null) return { ok: false, reason: UNREADABLE };
    const recorded = fresh ? new Map<string, string>() : input.recorded;
    const recordedValues = new Map([...recorded].filter(([k]) => !isContainerKey(k)));
    const render = new Map([...input.render].filter(([k]) => !isContainerKey(k)));
    const plan = planUpsert({
      render: new Map([...render].map(([k, v]) => [k, jsonSha(v)])),
      recorded: recordedValues,
      present: present(root, [...recordedValues.keys(), ...render.keys()]),
      excluded: input.excluded,
      alwaysStrip,
    });
    const before = stable(root);
    const created: string[] = [];
    for (const k of plan.remove) deleteKey(root, k);
    for (const k of plan.replace) writeKey(root, k, render.get(k), created);
    const kept = [...plan.kept];
    for (const k of plan.add) {
      if (!writeKey(root, k, render.get(k), created)) {
        plan.portions.delete(k);
        kept.push(k);
      }
    }
    const containers = pruneContainers(root, [
      ...[...recorded.keys()].filter(isContainerKey),
      ...created,
    ]);
    for (const c of containers) plan.portions.set(c, CONTAINER_SHA);
    // 실제로 바뀐 것만 — 컨테이너 모양이 달라 못 쓴 키는 바꾼 것이 아니다(입력 바이트를 그대로 둔다)
    const changed = fresh || stable(root) !== before;
    return {
      ok: true,
      text: changed ? serialize(root) : (existing ?? ""),
      changed,
      portions: plan.portions,
      deleted: plan.deleted,
      kept,
    };
  },

  strip(existing, input): StripResult {
    const root = parseRoot(existing);
    if (root === null) return { ok: false, reason: UNREADABLE };
    const plan = planStrip({
      recorded: new Map([...input.recorded].filter(([k]) => !isContainerKey(k))),
      present: present(root, valueKeys(input.recorded)),
      excluded: input.excluded,
      alwaysStrip,
    });
    const before = stable(root);
    for (const k of plan.remove) deleteKey(root, k);
    const containers = pruneContainers(root, [...input.recorded.keys()].filter(isContainerKey));
    for (const c of containers) plan.portions.set(c, CONTAINER_SHA);
    const changed = stable(root) !== before;
    return {
      ok: true,
      text: changed ? serialize(root) : existing,
      changed,
      removed: plan.remove,
      kept: plan.kept,
      portions: plan.portions,
      empty: Object.keys(root).length === 0,
    };
  },
};

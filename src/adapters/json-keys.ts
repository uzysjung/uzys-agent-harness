/**
 * `json-keys` — `.mcp.json` · `opencode.json` · `.claude/settings.json` (#551 · ADR-097 §6.2).
 *
 * 키 문법(설계 표 그대로):
 *   `statusLine`                          최상위 속성
 *   `mcpServers.<name>` · `mcp.<name>`    객체 안 속성 — 첫 `.` 에서만 자른다(서버 이름에 `.` 이 있어도 된다)
 *   `hooks.<Event>#<script>`              **핸들러 하나** — `hooks.<Event>` 의 matcher 묶음 안 `hooks[]` 중
 *                                         `command` 가 **이 프로젝트의** `.claude/hooks/<script>` 를 부르는 것
 *                                         (앵커 판정 = `hook-ref.ts` `projectAnchoredRef`, 치유기와 같은 함수 —
 *                                         홈 `~/.claude/hooks/` 의 같은 이름은 설치자 것). 같은 묶음의 다른
 *                                         핸들러는 설치자 몫이다(#551 리뷰 B1). 렌더 값은 **더할 때 붙일 묶음**
 *                                         `{ matcher?, hooks: [<핸들러>] }` 이고, 몫(sha)은 그 핸들러뿐이다
 *   `hooks.<Event>#<script>{}`            그 핸들러를 담은 묶음을 하네스가 **만들었다** — 핸들러를 빼서 묶음의
 *                                         `hooks` 가 비면 묶음째 걷는다. 설치자 묶음은 비어도 남긴다
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

import { join } from "node:path";
import { projectAnchoredRef } from "../hook-ref.js";
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
  | { kind: "group"; path: string[]; script: string }
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
    const inner = parseKey(container[1] ?? "");
    if (inner.kind === "item") return { kind: "group", path: inner.path, script: inner.script };
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

/** 값이 아니라 "하네스가 만들었다" 는 표시인 키(빈 컨테이너 · 묶음) — 키 id 가 없고 sha 도 뜻이 없다. */
export function isContainerKey(key: string): boolean {
  const kind = parseKey(key).kind;
  return kind === "container" || kind === "group";
}

function isGroupKey(key: string): boolean {
  return parseKey(key).kind === "group";
}

/** settings.json 훅 핸들러는 기록된 키면 sha 와 무관하게 뺀다(N-f · N13 — 스크립트가 함께 사라진다). */
function alwaysStrip(key: string): boolean {
  return parseKey(key).kind === "item";
}

/** 이 핸들러가 이 프로젝트의 `.claude/hooks/<script>` 를 부르는가 — 판정은 치유기와 같은 함수. */
function callsScript(handler: unknown, script: string, claudeDir: string | undefined): boolean {
  if (!isObject(handler) || typeof handler.command !== "string") return false;
  return projectAnchoredRef(handler.command, claudeDir) === `hooks/${script}`;
}

interface HandlerAt {
  groups: unknown[];
  gi: number;
  hooks: unknown[];
  hi: number;
}

/** 이벤트 배열에서 그 스크립트를 부르는 핸들러의 자리. 없으면 undefined. */
function findHandler(
  root: JsonObject,
  path: ReadonlyArray<string>,
  script: string,
  claudeDir: string | undefined,
): HandlerAt | undefined {
  const groups = walk(root, path);
  if (!Array.isArray(groups)) return undefined;
  for (const [gi, group] of groups.entries()) {
    if (!isObject(group) || !Array.isArray(group.hooks)) continue;
    const hi = group.hooks.findIndex((h) => callsScript(h, script, claudeDir));
    if (hi !== -1) return { groups, gi, hooks: group.hooks, hi };
  }
  return undefined;
}

/** 렌더가 준 묶음에서 그 스크립트를 부르는 핸들러 — 없으면 렌더가 잘못됐다. */
function renderedHandler(key: string, group: unknown, claudeDir: string | undefined): unknown {
  const p = parseKey(key);
  const hooks = isObject(group) && Array.isArray(group.hooks) ? group.hooks : [];
  const handler =
    p.kind === "item" ? hooks.find((h) => callsScript(h, p.script, claudeDir)) : undefined;
  if (handler === undefined) {
    throw new Error(`json-keys: rendered group for ${key} has no handler calling that hook script`);
  }
  return handler;
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

function readKey(root: JsonObject, key: string, claudeDir: string | undefined): unknown {
  const p = parseKey(key);
  if (p.kind === "item" || p.kind === "group") {
    const at = findHandler(root, p.path, p.script, claudeDir);
    if (at === undefined) return undefined;
    return p.kind === "item" ? at.hooks[at.hi] : at.groups[at.gi];
  }
  const holder = walk(root, p.path);
  if (p.kind === "container") return holder ?? undefined;
  return isObject(holder) ? holder[p.name] : undefined;
}

/**
 * 값을 쓴다 — 없는 컨테이너는 만들고 그 컨테이너 키를 `created` 에 적는다.
 * @returns 컨테이너 자리에 모양이 다른 설치자 값이 있으면 false(쓰지 않았다)
 */
function writeKey(
  root: JsonObject,
  key: string,
  value: unknown,
  created: string[],
  claudeDir: string | undefined,
): boolean {
  const p = parseKey(key);
  if (p.kind === "container" || p.kind === "group") return false;
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
    // 있으면 핸들러만 갈아 끼운다(묶음 · 형제 핸들러는 그대로). 없으면 렌더의 묶음을 새로 붙이고 그 묶음을
    // 하네스가 만들었다고 적는다 — 설치자 묶음 안에 끼워 넣지 않는다(뺄 때 그 묶음을 걷을 근거가 없다).
    const at = findHandler(root, chain, p.script, claudeDir);
    if (at !== undefined) {
      at.hooks[at.hi] = structuredClone(renderedHandler(key, value, claudeDir));
    } else {
      (walk(root, chain) as unknown[]).push(structuredClone(value));
      created.push(`${key}{}`);
    }
    return true;
  }
  cur[p.name] = value;
  return true;
}

/**
 * @param ownsGroup 핸들러 키일 때 — 그 핸들러의 묶음을 하네스가 만들었나. 그렇고 비면 묶음째 걷는다.
 */
function deleteKey(
  root: JsonObject,
  key: string,
  claudeDir: string | undefined,
  ownsGroup = false,
): void {
  const p = parseKey(key);
  if (p.kind === "group") return;
  if (p.kind === "item") {
    const at = findHandler(root, p.path, p.script, claudeDir);
    if (at === undefined) return;
    at.hooks.splice(at.hi, 1);
    if (ownsGroup && at.hooks.length === 0) at.groups.splice(at.gi, 1);
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

/**
 * 하네스가 만든 컨테이너 중 비었으면 걷는다 — 깊은 것부터. 남은 것만 기록으로 돌려준다.
 * 묶음 키는 여기서 다루지 않는다 — 핸들러를 뺄 때 함께 판정한다(`deleteKey` 의 `ownsGroup`).
 */
function pruneContainers(root: JsonObject, containers: ReadonlyArray<string>): string[] {
  const depth = (k: string) => parseKey(k).path.length;
  const kept: string[] = [];
  const plain = containers.filter((k) => !isGroupKey(k));
  for (const key of [...plain].sort((a, b) => depth(b) - depth(a))) {
    const v = readKey(root, key, undefined);
    if (v === undefined || v === null) continue;
    if (isEmptyContainer(v)) deleteKey(root, key, undefined);
    else kept.push(key);
  }
  return kept;
}

function present(
  root: JsonObject,
  keys: Iterable<string>,
  claudeDir: string | undefined,
): Map<string, string> {
  const out = new Map<string, string>();
  for (const k of keys) {
    if (isContainerKey(k)) continue;
    const v = readKey(root, k, claudeDir);
    if (v !== undefined) out.set(k, jsonSha(v));
  }
  return out;
}

function claudeDirOf(projectDir: string | undefined): string | undefined {
  return projectDir === undefined ? undefined : join(projectDir, ".claude");
}

/** 몫으로 남은 핸들러 중 묶음을 하네스가 만든 것 — 묶음 키를 이어 적는다. */
function carryGroups(
  root: JsonObject,
  portions: Map<string, string>,
  owned: ReadonlySet<string>,
  claudeDir: string | undefined,
): void {
  for (const key of [...portions.keys()]) {
    if (parseKey(key).kind !== "item" || !owned.has(key)) continue;
    if (readKey(root, key, claudeDir) !== undefined) portions.set(`${key}{}`, CONTAINER_SHA);
  }
}

function ownedGroups(keys: Iterable<string>): Set<string> {
  return new Set([...keys].filter(isGroupKey).map((k) => k.slice(0, -2)));
}

function serialize(root: JsonObject): string {
  return `${JSON.stringify(root, null, 2)}\n`;
}

function valueKeys(m: ReadonlyMap<string, unknown>): string[] {
  return [...m.keys()].filter((k) => !isContainerKey(k));
}

export const jsonKeys: PortionAdapter<unknown> = {
  unreadable: UNREADABLE,

  read(text, keys, projectDir) {
    const root = parseRoot(text);
    if (root === null) return null;
    return present(root, keys ?? Object.keys(root), claudeDirOf(projectDir));
  },

  upsert(existing, input): UpsertResult {
    const fresh = existing === null;
    const root = fresh ? {} : parseRoot(existing);
    if (root === null) return { ok: false, reason: UNREADABLE };
    const claudeDir = claudeDirOf(input.projectDir);
    const recorded = fresh ? new Map<string, string>() : input.recorded;
    const recordedValues = new Map([...recorded].filter(([k]) => !isContainerKey(k)));
    const render = new Map([...input.render].filter(([k]) => !isContainerKey(k)));
    const renderSha = ([k, v]: [string, unknown]): [string, string] => [
      k,
      jsonSha(parseKey(k).kind === "item" ? renderedHandler(k, v, claudeDir) : v),
    ];
    const plan = planUpsert({
      render: new Map([...render].map(renderSha)),
      recorded: recordedValues,
      present: present(root, [...recordedValues.keys(), ...render.keys()], claudeDir),
      excluded: input.excluded,
      alwaysStrip,
    });
    const before = stable(root);
    const created: string[] = [];
    const owned = ownedGroups(recorded.keys());
    for (const k of plan.remove) deleteKey(root, k, claudeDir, owned.has(k));
    for (const k of plan.replace) writeKey(root, k, render.get(k), created, claudeDir);
    const kept = [...plan.kept];
    const restored = [...plan.restored];
    const missing = [...plan.missing];
    for (const k of plan.add) {
      if (!writeKey(root, k, render.get(k), created, claudeDir)) {
        // 컨테이너 모양이 달라 못 썼다 — 기록에 있던 키면 그 sha 를 잇는다(되돌릴 근거, ADR-099 R1)
        const prior = recordedValues.get(k);
        if (prior === undefined) plan.portions.delete(k);
        else {
          plan.portions.set(k, prior);
          missing.push(k);
        }
        const r = restored.indexOf(k);
        if (r >= 0) restored.splice(r, 1);
        kept.push(k);
      }
    }
    const containers = pruneContainers(root, [
      ...[...recorded.keys()].filter(isContainerKey),
      ...created,
    ]);
    for (const c of containers) plan.portions.set(c, CONTAINER_SHA);
    carryGroups(root, plan.portions, new Set([...owned, ...ownedGroups(created)]), claudeDir);
    // 실제로 바뀐 것만 — 컨테이너 모양이 달라 못 쓴 키는 바꾼 것이 아니다(입력 바이트를 그대로 둔다)
    const changed = fresh || stable(root) !== before;
    return {
      ok: true,
      text: changed ? serialize(root) : (existing ?? ""),
      changed,
      portions: plan.portions,
      restored,
      missing,
      kept,
    };
  },

  strip(existing, input): StripResult {
    const root = parseRoot(existing);
    if (root === null) return { ok: false, reason: UNREADABLE };
    const claudeDir = claudeDirOf(input.projectDir);
    const plan = planStrip({
      recorded: new Map([...input.recorded].filter(([k]) => !isContainerKey(k))),
      present: present(root, valueKeys(input.recorded), claudeDir),
      excluded: input.excluded,
      alwaysStrip,
    });
    const before = stable(root);
    const owned = ownedGroups(input.recorded.keys());
    for (const k of plan.remove) deleteKey(root, k, claudeDir, owned.has(k));
    const containers = pruneContainers(root, [...input.recorded.keys()].filter(isContainerKey));
    for (const c of containers) plan.portions.set(c, CONTAINER_SHA);
    carryGroups(root, plan.portions, owned, claudeDir);
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

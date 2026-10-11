/**
 * Codex trust entry — `~/.codex/config.toml [projects."<dir>"]` (parity with
 * setup-harness.sh L1404-1422).
 *
 * SAFETY: never modify the global `~/.codex/config.toml` without an explicit
 * opt-in (D16 / ADR-002 v2 D4). Callers must verify user consent first.
 *
 * #685 — 판정은 파서로 한다(어떤 TOML 표기로 쓴 항목이든 — `[projects.'/p']` · 점 키 · 인라인 표). 키는 Codex 가 쓰는
 * 것과 같은 정규화 경로(`project_trust_key` — realpath, Windows 는 소문자)이고 TOML 기본 문자열로 이스케이프한다. 덧붙인
 * 결과를 다시 읽어 항목이 그대로 읽히지 않으면 **한 바이트도 쓰지 않는다**(§6.2 toml-region 과 같은 규칙). 설치자 파일을
 * 다시 직렬화하지 않는다 — 덧붙이기뿐이다.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse } from "smol-toml";

export interface RegisterTrustResult {
  /**
   * unreadable = 전역 config 가 TOML 로 파싱되지 않는다 — 한 바이트도 쓰지 않았다(#644 · #574 의 전역판).
   * left = 이 폴더 항목이 이미 있는데 `trusted` 가 아니다 — 설치자의 명시 결정이라 덮지 않았다(#685).
   * error = 덧붙이면 항목이 읽히지 않는다(인라인 `projects = { … }` 등) · 쓰기 실패 — 한 바이트도 쓰지 않았다.
   */
  status: "registered" | "already-present" | "left" | "unreadable" | "error";
  message?: string;
  /** 이 폴더의 trust 키 — 쓴 키 · 이미 있던 키 · 쓰려던 키. 기록 · 안내가 이 값을 찍는다. */
  key?: string;
}

const UNSAFE_APPEND = "adding the entry would make this file unreadable TOML — left untouched";

/**
 * 이 폴더의 trust 키 후보 — `[정규화 경로, 받은 경로]`(중복 제거). Codex 는 둘 다 조회하고 정규화 경로로 쓴다
 * (`normalized_project_trust_keys` · `project_trust_key`). Windows 는 Codex 처럼 ASCII 소문자로.
 */
export function trustKeysFor(projectDir: string): string[] {
  let canonical = projectDir;
  try {
    canonical = realpathSync.native(projectDir);
  } catch {
    // 없는 경로 — 받은 그대로
  }
  const keys = [canonical, projectDir];
  const out =
    process.platform === "win32"
      ? keys.map((k) => k.replace(/[A-Z]/g, (ch) => ch.toLowerCase()))
      : keys;
  return [...new Set(out)];
}

/** TOML 1.0 기본 문자열 — `\` · `"` · 제어 문자(U+0000–U+001F · U+007F)를 이스케이프한다. */
export function tomlBasicString(s: string): string {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (code <= 0x1f || code === 0x7f)
      out += `\\u${code.toString(16).toUpperCase().padStart(4, "0")}`;
    else out += ch;
  }
  return `${out}"`;
}

type Table = Record<string, unknown>;

function isTable(v: unknown): v is Table {
  return typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
}

/** 파싱한 전역 config 에서 이 폴더의 항목 — 후보 키 순서로 처음 찾은 것. */
function findEntry(
  parsed: Table,
  keys: ReadonlyArray<string>,
): { key: string; level: unknown } | null {
  const projects = parsed.projects;
  if (!isTable(projects)) return null;
  for (const key of keys) {
    if (!Object.hasOwn(projects, key)) continue;
    const entry = projects[key];
    return { key, level: isTable(entry) ? entry.trust_level : undefined };
  }
  return null;
}

/** Append a `[projects."<key>"]` block to the user `config.toml` (idempotent). */
export function registerTrustEntry(opts: {
  configPath: string;
  projectDir: string;
}): RegisterTrustResult {
  const { configPath, projectDir } = opts;
  const keys = trustKeysFor(projectDir);
  const key = keys[0] ?? projectDir;
  try {
    const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    // #644 — 파싱 불가인 파일에 덧붙이면 여전히 파싱 불가라 trust 가 무의미하다. 설치자 파일이라 고치지도 않는다.
    let parsed: Table;
    try {
      parsed = parse(existing) as Table;
    } catch (e: unknown) {
      return {
        status: "unreadable",
        message: `not valid TOML (${firstLine(e)}) — left untouched`,
      };
    }
    const found = findEntry(parsed, keys);
    if (found !== null) {
      if (found.level === "trusted") return { status: "already-present", key: found.key };
      const level =
        typeof found.level === "string"
          ? `trust_level = ${tomlBasicString(found.level)}`
          : "no trust_level";
      return { status: "left", key: found.key, message: `already present (${level}) — left as is` };
    }
    const next = `${existing}\n[projects.${tomlBasicString(key)}]\ntrust_level = "trusted"\n`;
    if (findEntry(readable(next) ?? {}, [key])?.level !== "trusted") {
      return { status: "error", key, message: UNSAFE_APPEND };
    }
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, next);
    return { status: "registered", key };
  } catch (e: unknown) {
    return {
      status: "error",
      key,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 이 폴더가 전역 config 에서 이미 `trusted` 인가 — 못 읽거나 `trusted` 가 아니면 false(안내 대상). */
export function hasTrustEntry(configContent: string, projectDir: string): boolean {
  const parsed = readable(configContent);
  return parsed !== null && findEntry(parsed, trustKeysFor(projectDir))?.level === "trusted";
}

function readable(text: string): Table | null {
  try {
    return parse(text) as Table;
  } catch {
    return null;
  }
}

function firstLine(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";
}

/**
 * Codex trust entry — `~/.codex/config.toml [projects."<dir>"]` (parity with
 * setup-harness.sh L1404-1422).
 *
 * SAFETY: never modify the global `~/.codex/config.toml` without an explicit
 * opt-in (D16 / ADR-002 v2 D4). Callers must verify user consent first.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parse } from "smol-toml";

export interface RegisterTrustResult {
  /** unreadable = 전역 config 가 TOML 로 파싱되지 않는다 — 한 바이트도 쓰지 않았다(#644 · #574 의 전역판). */
  status: "registered" | "already-present" | "unreadable" | "error";
  message?: string;
}

const TRUST_BLOCK_REGEX = /\[projects\."([^"]+)"\]/g;

/** Append a `[projects."<projectDir>"]` block to the user `config.toml` (idempotent). */
export function registerTrustEntry(opts: {
  configPath: string;
  projectDir: string;
}): RegisterTrustResult {
  const { configPath, projectDir } = opts;
  try {
    const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    // #644 — 파싱 불가인 파일에 덧붙이면 여전히 파싱 불가라 trust 가 무의미하다. 설치자 파일이라 고치지도 않는다.
    try {
      parse(existing);
    } catch (e: unknown) {
      return {
        status: "unreadable",
        message: `not valid TOML (${firstLine(e)}) — left untouched`,
      };
    }
    if (hasTrustEntry(existing, projectDir)) {
      return { status: "already-present" };
    }
    mkdirSync(dirname(configPath), { recursive: true });
    const block = `\n[projects."${projectDir}"]\ntrust_level = "trusted"\n`;
    writeFileSync(configPath, existing + block);
    return { status: "registered" };
  } catch (e: unknown) {
    return {
      status: "error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export function hasTrustEntry(configContent: string, projectDir: string): boolean {
  const matches = [...configContent.matchAll(TRUST_BLOCK_REGEX)].map((m) => m[1]);
  return matches.includes(projectDir);
}

function firstLine(e: unknown): string {
  return (e instanceof Error ? e.message : String(e)).split("\n")[0] ?? "";
}

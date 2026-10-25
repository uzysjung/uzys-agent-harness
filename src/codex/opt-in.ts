/**
 * Codex global opt-in — ~/.codex/config.toml trust entry 등록.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F11 (Reviewer HIGH-4)
 * Source: bash setup-harness.sh@911c246~1 L1389~1429
 *
 * SAFETY: 사용자 명시 opt-in 없이 ~/.codex/ 글로벌 수정 금지 (D16 / ADR-002 v2 D4).
 * 호출자(installer)는 OptionFlags.withCodexTrust 가 true 일 때만 호출.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import { registerTrustEntry } from "./trust-entry.js";

export interface CodexOptInReport {
  /** ~/.codex/config.toml trust entry 등록 결과 */
  trustEntry: {
    enabled: boolean;
    status: "registered" | "already-present" | "left" | "unreadable" | "error" | "skipped";
    message?: string;
    /** #685 — 이 폴더의 trust 키(Codex 가 쓰는 정규화 경로). 기록 · 손수 넣을 안내가 이 값을 찍는다. */
    key?: string;
    /** 항목을 넣은(또는 넣으려던) 전역 파일 — uninstall 안내가 그 자리를 가리킨다(#644). */
    configPath?: string;
  };
}

export interface CodexOptInContext {
  /** 사용자 프로젝트 root (trust entry 경로). */
  projectDir: string;
  /** 글로벌 ~/.codex/ 경로 (테스트 override 가능). */
  codexHome?: string;
}

/**
 * #882 — Codex 가 읽는 전역 config 의 자리. 쓰기(`runCodexOptIn`)와 확인(설치 화면이 "이미 신뢰했나" 를 보는 곳)이 이 한
 * 함수를 쓴다 — 둘이 갈리면 `CODEX_HOME` 을 둔 환경에서 Codex 가 읽지 않는 파일에 trust 를 쓰고 "등록했다" 고 말한다.
 * 우선순위 = 주입(`codexHome`) → `CODEX_HOME`(빈 값은 없는 것으로) → `~/.codex`.
 */
export function codexConfigPath(codexHome?: string): string {
  const env = process.env.CODEX_HOME;
  const home = codexHome ?? (env !== undefined && env !== "" ? env : join(homedir(), ".codex"));
  return join(home, "config.toml");
}

/** 화면에 찍는 그 파일 — 홈 아래면 `~/…`(기본 자리는 지금처럼 `~/.codex/config.toml`), 밖이면 경로 그대로. */
export function codexConfigLabel(configPath: string = codexConfigPath()): string {
  const home = homedir();
  return configPath.startsWith(`${home}/`) ? `~${configPath.slice(home.length)}` : configPath;
}

/** ~/.codex/config.toml 에 프로젝트 trust entry 등록. */
export function runCodexOptIn(ctx: CodexOptInContext): CodexOptInReport {
  const configPath = codexConfigPath(ctx.codexHome);
  const result = registerTrustEntry({ configPath, projectDir: ctx.projectDir });
  return {
    trustEntry: {
      enabled: true,
      status: result.status,
      configPath,
      ...(result.message ? { message: result.message } : {}),
      ...(result.key ? { key: result.key } : {}),
    },
  };
}

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
    status: "registered" | "already-present" | "error" | "skipped";
    message?: string;
  };
}

export interface CodexOptInContext {
  /** 사용자 프로젝트 root (trust entry 경로). */
  projectDir: string;
  /** 글로벌 ~/.codex/ 경로 (테스트 override 가능). */
  codexHome?: string;
}

/** ~/.codex/config.toml 에 프로젝트 trust entry 등록. */
export function runCodexOptIn(ctx: CodexOptInContext): CodexOptInReport {
  const codexHome = ctx.codexHome ?? join(homedir(), ".codex");
  const configPath = join(codexHome, "config.toml");
  const result = registerTrustEntry({ configPath, projectDir: ctx.projectDir });
  return {
    trustEntry: {
      enabled: true,
      status: result.status,
      ...(result.message ? { message: result.message } : {}),
    },
  };
}

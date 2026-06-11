/**
 * Install log — `.claude/.harness-install.json`.
 *
 * v26.64.0 (ADR-020) — install 종료 시 자산 list + scope + timestamp 기록.
 * uninstall command 가 본 log 를 읽어 정확한 reverse 수행.
 *
 * 글로벌 자산 (scope=global 또는 codexOptIn) 은 log 에 안내용으로만 기록 — uninstall 시 자동 삭제 X (D16).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExternalAsset, ExternalAssetMethod } from "./external-assets.js";
import type { ExternalInstallReport } from "./external-installer.js";
import type { InstallScope, InstallSpec } from "./types.js";

export const INSTALL_LOG_FILENAME = ".harness-install.json";
export const INSTALL_LOG_VERSION = 1;

export interface InstallLogAsset {
  id: string;
  category: string;
  /** External asset method.kind 그대로. uninstall reverse 시 분기 기준. */
  method: ExternalAssetMethod["kind"];
  /** scope=global 자산은 uninstall 시 안내만 (D16 — 글로벌 자동 삭제 금지). */
  scope: InstallScope;
  /** method 별 추가 정보. plugin: marketplace + pluginId. skill: source. npm: pkg. */
  detail: Record<string, string>;
  /** installed 시점 version (detectVersion 결과, 없으면 undefined). */
  version?: string;
}

export interface InstallLog {
  /** schema version — backward compat 검출용 */
  schemaVersion: number;
  /** harness 가 install 한 시점 ISO timestamp */
  installedAt: string;
  /** 전체 install scope. 자산 per-asset scope 와 동일 (현재는 single global scope) */
  scope: InstallScope;
  /** install 시 spec 요약 (tracks/cli — uninstall reasoning 용) */
  spec: {
    tracks: ReadonlyArray<string>;
    cli: ReadonlyArray<string>;
  };
  /** templates 출처 — uninstall 시 templates 제거 위치 */
  templates: {
    /** .claude/ project local */
    claudeDir: string;
    /** .codex/ project local (cli=codex 시) */
    codexDir?: string;
    /** .opencode/ project local (cli=opencode 시) */
    opencodeDir?: string;
    /**
     * project root CLAUDE.md (cli=claude 시 생성).
     * uninstall 시 sha256 이 install 시점과 동일할 때만 삭제 — 사용자가 수정했으면 보존.
     */
    rootClaudeMd?: { path: string; sha256: string };
  };
  /** external-installer 가 install 한 자산 (ok=true 만) */
  assets: ReadonlyArray<InstallLogAsset>;
}

/**
 * external-installer 의 result 를 InstallLogAsset 으로 변환.
 * ok=false 자산은 제외 (실제 install 안 됨 → uninstall 대상 아님).
 */
export function buildAssetEntries(
  report: ExternalInstallReport | null,
  scope: InstallScope,
): InstallLogAsset[] {
  if (!report) return [];
  return report.attempted
    .filter((r) => r.ok)
    .map((r) => assetToLogEntry(r.asset, scope, r.version));
}

function assetToLogEntry(
  asset: ExternalAsset,
  scope: InstallScope,
  version: string | undefined,
): InstallLogAsset {
  const detail = methodDetail(asset.method);
  const entry: InstallLogAsset = {
    id: asset.id,
    category: asset.category,
    method: asset.method.kind,
    scope,
    detail,
  };
  if (version) entry.version = version;
  return entry;
}

function methodDetail(method: ExternalAssetMethod): Record<string, string> {
  switch (method.kind) {
    case "plugin":
      return { marketplace: method.marketplace, pluginId: method.pluginId };
    case "skill":
      return { source: method.source, ...(method.skill ? { skill: method.skill } : {}) };
    case "npm":
      return { pkg: method.pkg };
    case "npx-run":
      return { cmd: method.cmd, args: (method.args ?? []).join(" ") };
    case "shell-script":
      return { script: method.script, args: method.args.join(" ") };
    case "internal":
      // v26.81.0 (ADR-022) — Phase 1 manifest 가 설치 주체. external 단계에선 미기록이 정상.
      return { key: method.key };
  }
}

export function buildInstallLog(
  spec: InstallSpec,
  external: ExternalInstallReport | null,
  scope: InstallScope,
  rootClaudeMd?: { path: string; sha256: string } | null,
): InstallLog {
  const log: InstallLog = {
    schemaVersion: INSTALL_LOG_VERSION,
    installedAt: new Date().toISOString(),
    scope,
    spec: {
      tracks: spec.tracks,
      cli: spec.cli,
    },
    templates: {
      claudeDir: ".claude/",
      ...(spec.cli.includes("codex") ? { codexDir: ".codex/" } : {}),
      ...(spec.cli.includes("opencode") ? { opencodeDir: ".opencode/" } : {}),
      ...(rootClaudeMd ? { rootClaudeMd } : {}),
    },
    assets: buildAssetEntries(external, scope),
  };
  return log;
}

/** install log + root CLAUDE.md 등 자산 무결성 비교용 sha256 (hex). */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * install log write. 위치: `<projectDir>/.claude/.harness-install.json`.
 *
 * `.claude/` 는 cli=claude 일 때 baseline phase 에서 생성되지만, codex/opencode/antigravity
 * 단독(claude 미포함) 설치 시엔 생성되지 않는다. 그 경우에도 uninstall 이 본 log 를 읽을 수 있도록
 * write 직전 디렉토리를 보장한다 (없으면 install log 누락 → uninstall 불가).
 */
export function writeInstallLog(projectDir: string, log: InstallLog): string {
  const path = join(projectDir, ".claude", INSTALL_LOG_FILENAME);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  return path;
}

export function readInstallLog(projectDir: string): InstallLog | null {
  const path = join(projectDir, ".claude", INSTALL_LOG_FILENAME);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as InstallLog;
    // v26.68.0 — backward compat: method.kind "npm-global" → "npm" rename.
    // v26.64.0 ~ v26.67.0 시점 install log 가 새 uninstall 에서 작동하도록 normalize.
    if (Array.isArray(parsed.assets)) {
      parsed.assets = parsed.assets.map((a) =>
        (a.method as string) === "npm-global" ? { ...a, method: "npm" } : a,
      );
    }
    return parsed;
  } catch {
    return null;
  }
}

export function installLogPath(projectDir: string): string {
  return join(projectDir, ".claude", INSTALL_LOG_FILENAME);
}

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

/**
 * v26.124.0 (F-1f) — install 이 `.claude/` **밖**에 만들거나 고친 프로젝트 루트 파일.
 *
 * uninstall 은 이 목록을 **안내만 하고 지우지 않는다**. `.mcp.json`/`.gitignore` 에는 사용자
 * 내용이 섞이고, `.github/workflows/` 는 설치 후 사용자 소유물이기 때문 (ci-scaffold.ts 안전
 * 계약 2 · F-1d 와 같은 방침). 기록이 없으면 안내도 없다 — 그래서 install 이 적어 둔다.
 */
export interface InstallLogRootFile {
  /** project-relative 경로 (예: `.mcp.json`, `.github/workflows/ci.yml`) */
  path: string;
  /**
   * created = 하네스가 없던 파일을 만들었다 (내용 전부 하네스 것 → 손 안 댔으면 지워도 안전).
   * modified = 이미 있던 사용자 파일에 병합/추가했다 (직접 확인이 필요하다).
   */
  change: "created" | "modified";
  /** 무엇을 했는지 — uninstall 안내에 그대로 나온다. 재설치 시 합집합으로 누적된다. */
  notes: string[];
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
  /**
   * v26.124.0 (F-1f) — `.claude/` 밖 루트 파일. 건드린 게 없으면 필드 자체가 없다
   * (v26.123.0 이하 로그도 이 상태 — 읽는 쪽은 부재를 정상으로 다뤄야 한다).
   */
  rootFiles?: ReadonlyArray<InstallLogRootFile>;
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

/**
 * install log 생성. `previous` 가 있으면 **누적**한다 (v26.123.0 — F-1a).
 *
 * install 은 이전에 설치한 것을 지우지 않는다. 그런데 로그는 매번 새로 만들어 덮어썼으므로,
 * 나중에 `install --with <id>` 를 한 번만 해도 1회차 자산이 기록에서 사라지고 **uninstall 이
 * 그걸 못 찾아 남긴다**. 디스크에는 남아 있는데 기록에는 없는 = 로그가 거짓이 되는 상태.
 *
 * 누적 대상은 uninstall 이 실제로 읽는 두 필드뿐이다 (`assets` · `templates`). `spec`(tracks/cli)은
 * 누적하지 않는다: `.claude/` 가 backup 으로 밀리는 설치(reinstall)에선 이전 트랙 파일이 실제로
 * 사라져 합집합이 거짓이 된다. 게다가 uninstall 은 `spec` 을 읽지 않는다 (표시용).
 *
 * `claudeDirMovedAside` = 이번 설치가 `.claude/` 를 backup 으로 rename 했는가. 그 경우
 * **`.claude/` 안에 살던 이전 자산은 실제로 사라졌으므로 누적에서 뺀다** — 안 빼면 F-1a 를
 * 반대 방향으로 재현한다(있지도 않은 걸 있다고 기록). 해당: project scope 의 `skill`
 * (`npx skills add` 가 `.claude/skills/` 에 설치) 와 `shell-script`(ecc-prune →
 * `.claude/local-plugins/`). plugin/npm 은 프로젝트 밖에 살아 남으므로 유지한다.
 */
export function buildInstallLog(
  spec: InstallSpec,
  external: ExternalInstallReport | null,
  scope: InstallScope,
  rootClaudeMd?: { path: string; sha256: string } | null,
  previous?: InstallLog | null,
  claudeDirMovedAside = false,
  rootFiles: ReadonlyArray<InstallLogRootFile> = [],
): InstallLog {
  const templates: InstallLog["templates"] = {
    claudeDir: ".claude/",
    ...(spec.cli.includes("codex") ? { codexDir: ".codex/" } : {}),
    ...(spec.cli.includes("opencode") ? { opencodeDir: ".opencode/" } : {}),
    ...(rootClaudeMd ? { rootClaudeMd } : {}),
  };
  const log: InstallLog = {
    schemaVersion: INSTALL_LOG_VERSION,
    installedAt: new Date().toISOString(),
    scope,
    spec: {
      tracks: spec.tracks,
      cli: spec.cli,
    },
    // 이번 설치가 만든 항목이 이기고, 이번에 안 만든 항목은 이전 값을 그대로 둔다.
    // (예: claude 로 깔고 나중에 codex 만 추가 설치해도 root CLAUDE.md 기록이 살아남는다)
    templates: { ...previous?.templates, ...templates },
    assets: mergeAssets(
      claudeDirMovedAside ? previous?.assets?.filter(survivesClaudeDirRename) : previous?.assets,
      buildAssetEntries(external, scope),
    ),
  };
  // 루트 파일은 `.claude/` 밖이라 backup rename 과 무관하게 살아남는다 → 무조건 누적.
  const mergedRootFiles = mergeRootFiles(previous?.rootFiles, rootFiles);
  if (mergedRootFiles.length > 0) log.rootFiles = mergedRootFiles;
  return log;
}

/**
 * 경로 기준 합집합. 자산과 달리 **이번 설치분이 이전 것을 덮지 않고 합친다** — `.gitignore` 에
 * 1회차는 `.env`, 2회차는 `.factory/` 를 추가하면 둘 다 디스크에 남아 있으므로 둘 다 알려야 한다.
 * `change` 는 한 번이라도 created 면 created — 하네스가 만든 파일에 나중에 병합한 것뿐이고,
 * 사용자에게는 "전부 하네스 것"이 여전히 참이다 (modified 로 낮추면 지워도 될 것을 못 지운다).
 */
function mergeRootFiles(
  previous: ReadonlyArray<InstallLogRootFile> | undefined,
  current: ReadonlyArray<InstallLogRootFile>,
): InstallLogRootFile[] {
  const byPath = new Map<string, InstallLogRootFile>();
  for (const file of [...(previous ?? []), ...current]) {
    const prior = byPath.get(file.path);
    byPath.set(
      file.path,
      prior
        ? {
            path: file.path,
            change: prior.change === "created" ? "created" : file.change,
            notes: [...new Set([...prior.notes, ...file.notes])],
          }
        : file,
    );
  }
  return [...byPath.values()];
}

/**
 * `.claude/` 가 backup 으로 밀려도 살아남는 자산인가 — 산출물이 프로젝트 `.claude/` 밖인가.
 *
 * **exhaustive switch 로 쓴다(default 없음).** method 종류가 늘면 빌드가 깨져서 이 판단을
 * 강제로 하게 만든다 — `!==` 목록이면 새 method 가 조용히 "살아남음"으로 분류되고, 그건
 * 곧 없는 걸 있다고 기록하는 것이다 (`no-false-ship` §Drift 구조 차단: 하드코딩 목록에는
 * exhaustiveness 가드 없이 머지 금지, 기본값은 면제가 아니라 검사).
 */
function survivesClaudeDirRename(asset: InstallLogAsset): boolean {
  if (asset.scope === "global") return true; // 글로벌 영역은 install 이 건드리지 않는다
  switch (asset.method) {
    case "plugin":
      return true; // `~/.claude/plugins/cache` — 프로젝트 밖
    case "npm":
      return true; // `node_modules/`
    case "skill":
      return false; // `npx skills add` project scope → `.claude/skills/`
    case "shell-script":
      return false; // ecc-prune → `.claude/local-plugins/`
    case "npx-run":
      // bmad-method 는 `--tools claude-code` 로 `.claude/` 안에 agent command 를 만든다
      // (external-assets.ts 의 cliSupportOverride 주석 + Docker 실증 realcli-workflows-2026-06-06).
      // `_bmad/` 는 루트에 남지만, `.claude/` 산출물이 사라진 이상 "그대로 설치됨"이 아니다.
      return false;
    case "internal":
      // 실제로는 로그에 실리지 않는다(external-installer 가 사전 제외). 그래도 기본값은 검사.
      return false;
  }
}

/** id 기준 합집합 — 같은 id 는 이번 설치분이 이긴다 (version/scope 가 최신). 순서는 안정적. */
function mergeAssets(
  previous: ReadonlyArray<InstallLogAsset> | undefined,
  current: ReadonlyArray<InstallLogAsset>,
): InstallLogAsset[] {
  if (!previous || previous.length === 0) return [...current];
  const currentById = new Map(current.map((a) => [a.id, a]));
  const previousIds = new Set(previous.map((a) => a.id));
  return [
    ...previous.map((a) => currentById.get(a.id) ?? a),
    ...current.filter((a) => !previousIds.has(a.id)),
  ];
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

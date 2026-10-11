import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { keyId } from "./adapters/index.js";
import { jsonSha } from "./adapters/json-keys.js";
import { EXTERNAL_ASSETS, isAssetSelected } from "./external-assets.js";
import type { InstallLog } from "./install-log.js";
import { priorMcpValues } from "./mcp-prior.js";
import { anyTrack } from "./track-match.js";
import type { Track } from "./types.js";

/**
 * 하네스 MCP 서버 하나 — 내부 모델(#711 · ADR-106). 세 렌더러(`.mcp.json` · Codex · OpenCode)가 각자 형식으로 낸다.
 * - stdio: 지금까지의 모양(Claude `.mcp.json` 형식과 같다)
 * - http: 원격(Streamable HTTP) 서버. `auth.bearerEnv` = `Authorization: Bearer` 를 **환경변수 이름**으로만 둔다 — 값은 어느
 *   파일에도 쓰지 않는다(Claude `${VAR}` · Codex `bearer_token_env_var` · OpenCode `{env:VAR}` 가 실행 때 읽는다).
 */
export type McpServerConfig =
  | { type?: "stdio"; command: string; args: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; auth?: { bearerEnv: string } };

export interface McpJson {
  mcpServers: Record<string, McpServerConfig>;
  _comment?: string;
}

export interface TrackMcpRow {
  name: string;
  /** 기본 트랙 패턴. `-` 는 어떤 트랙과도 맞지 않는다 — 같은 이름의 카탈로그 `internal` 자산으로만 고른다. */
  pattern: string;
  server: McpServerConfig;
}

/** 환경변수 이름 — 파일에 쓰는 것은 이 이름뿐이라 셸이 그대로 읽는 모양만 받는다. */
const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** 원격 행의 4열(`{"url":"https://…","bearerEnv"?:"NAME"}`) — 아니면 null(행을 버린다). */
function parseRemote(raw: string): McpServerConfig | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null;
  const { url, bearerEnv } = v as { url?: unknown; bearerEnv?: unknown };
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  if (bearerEnv === undefined) return { type: "http", url };
  if (typeof bearerEnv !== "string" || !ENV_NAME.test(bearerEnv)) return null;
  return { type: "http", url, auth: { bearerEnv } };
}

/**
 * Parse `templates/track-mcp-map.tsv` (tab-separated, comment-aware). 3열이 리터럴 `url` 이면 원격 행이다(4열 = JSON 객체).
 * 깨진 행은 버린다.
 */
export function parseTrackMcpMap(raw: string): TrackMcpRow[] {
  const rows: TrackMcpRow[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const parts = line.split("\t");
    if (parts.length < 4) {
      continue;
    }
    const [name, pattern, command, argsJson] = parts;
    if (!name || !pattern || !command) {
      continue;
    }
    if (command === "url") {
      const server = parseRemote(argsJson ?? "");
      if (server !== null) rows.push({ name, pattern, server });
      continue;
    }
    let args: unknown;
    try {
      args = JSON.parse(argsJson ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
      continue;
    }
    rows.push({ name, pattern, server: { type: "stdio", command, args: args as string[] } });
  }
  return rows;
}

/**
 * 내부 모델 → Claude Code `.mcp.json` 값. `.mcp.json` 에 쓰는 자리 · 그 값과 대조하는 자리(옛 로그 식별 · uninstall 잔존
 * 안내)만 이것을 거친다. 원격은 `type: "http"` 가 필수다(공식: `url` 만 있고 `type` 이 없으면 설정 오류).
 */
export function toClaudeServer(cfg: McpServerConfig): Record<string, unknown> {
  if (cfg.type === "http") {
    return cfg.auth === undefined
      ? { type: "http", url: cfg.url }
      : {
          type: "http",
          url: cfg.url,
          headers: { Authorization: `Bearer \${${cfg.auth.bearerEnv}}` },
        };
  }
  const out: Record<string, unknown> = {
    type: cfg.type ?? "stdio",
    command: cfg.command,
    args: cfg.args,
  };
  if (cfg.env && Object.keys(cfg.env).length > 0) out.env = { ...cfg.env };
  return out;
}

/**
 * Apply track-aware MCP rows to a base `.mcp.json` object.
 * Existing entries (including user customizations) are preserved.
 */
export function mergeMcpServers(
  base: McpJson,
  rows: ReadonlyArray<TrackMcpRow>,
  tracks: ReadonlyArray<Track>,
  /** #709 — 트랙 패턴 밖이어도 넣을 행 이름(`selectedMcpServers`). 기본 행과 겹치면 한 항목이다. */
  chosen: ReadonlyArray<string> = [],
  /** #709 리뷰 NOTE 1 — 설치자가 명시적으로 뺀 행 이름(`droppedMcpServers`). 기본 행이어도 넣지 않는다. */
  dropped: ReadonlyArray<string> = [],
): McpJson {
  const out: McpJson = {
    ...base,
    mcpServers: { ...base.mcpServers },
  };
  for (const row of rows) {
    if (dropped.includes(row.name)) {
      continue;
    }
    if (!anyTrack(tracks, row.pattern) && !chosen.includes(row.name)) {
      continue;
    }
    if (out.mcpServers[row.name]) {
      // Preserve existing — do not overwrite user customizations.
      continue;
    }
    out.mcpServers[row.name] = row.server;
  }
  // Strip _comment marker (parity with the bash `jq 'del(._comment)'`).
  delete out._comment;
  return out;
}

/**
 * 하네스가 이 트랙에 까는 `.mcp.json` 서버 — 템플릿 + 트랙 표. **설치자 파일과 합치지 않는다**:
 * 설치자 파일에 하네스 몫을 더하는 일은 `json-keys` 어댑터가 한다(#551 PR-3). 여기서 합치던 판은
 * 설치자 파일을 못 읽으면 템플릿으로 덮었다(#574) — 합치는 자리를 하나로 줄여 그 경로가 없다.
 */
export function composeMcpJson(opts: {
  templateMcpPath: string;
  trackMapPath: string;
  tracks: ReadonlyArray<Track>;
  /** #709 — 트랙 패턴 밖에서 넣을 행 이름을 표에서 고른다(`selectedMcpServers` · uninstall 은 고를 수 있는 행 전부). */
  chosen: (rows: ReadonlyArray<TrackMcpRow>) => ReadonlyArray<string>;
  /** #709 리뷰 NOTE 1 — 기본 행이어도 뺄 행 이름. 없으면 아무것도 안 뺀다. */
  dropped?: (rows: ReadonlyArray<TrackMcpRow>) => ReadonlyArray<string>;
}): McpJson {
  const base = JSON.parse(readFileSync(opts.templateMcpPath, "utf8")) as McpJson;
  const mapRaw = existsSync(opts.trackMapPath) ? readFileSync(opts.trackMapPath, "utf8") : "";
  const rows = parseTrackMcpMap(mapRaw);
  return mergeMcpServers(base, rows, opts.tracks, opts.chosen(rows), opts.dropped?.(rows) ?? []);
}

/**
 * #709 (ADR-101) — 어느 트랙에서든 **고를 수 있는** 트랙 표 행(서버 이름 → 자산 id): 카탈로그 `internal` 자산의 `key` 가
 * 행 이름인 것. 대응은 이 한 규칙뿐이다 — 따로 표를 두지 않는다. 행의 패턴은 기본 트랙을 정하고, 이 자산은 그 밖의
 * 트랙에서 위저드 체크 · `--with <id>` 로 고르게 한다. 서버 정의(명령 · 인자)는 여전히 트랙 표 한 곳에 있다.
 */
export function selectableMcpServers(rows: ReadonlyArray<TrackMcpRow>): Map<string, string> {
  const names = new Set(rows.map((r) => r.name));
  const out = new Map<string, string>();
  for (const a of EXTERNAL_ASSETS) {
    if (a.method.kind === "internal" && names.has(a.method.key)) out.set(a.method.key, a.id);
  }
  return out;
}

/** 이 실행에서 무엇을 골랐나 — `selectedMcpServers` 의 입력. */
export interface McpChoice {
  /** 이번 선택 — `isAssetSelected` 와 같은 입력(트랙 · `--with`/위저드 체크). */
  spec: Parameters<typeof isAssetSelected>[1];
  /** 이 실행 뒤의 누적 빼기(install = `thisRunExclusions`, update = 기록의 `excludedIds`). */
  excluded: ReadonlySet<string>;
  previousLog: InstallLog | null;
  /**
   * #722 (ADR-106, 설계 검증 B1 ⓐ) — 옛 로그(몫 기록 전)의 `.mcp.json` 을 읽을 프로젝트. 주면 하네스가 **만든** 그 파일에 하네스가
   * 쓴 값 그대로 남은 고를 수 있는 서버를 기록된 몫처럼 선택으로 본다(`legacyMcpServers`). 생략 = 그 근거를 쓰지 않는다.
   */
  projectDir?: string;
}

/**
 * #709 — 트랙 패턴 밖에서 이번 렌더에 넣을 선택 행 이름. 둘 다 만족해야 한다:
 *
 * ⓐ 설치자가 빼지 않았다 — 자산 id(`railway-mcp-server`)로도 키 id(`mcp:railway-mcp-server`, ADR-099 R4)로도(`droppedMcpServers`).
 * ⓑ 이번 실행이 골랐거나(위저드 체크 · `--with`), **기록**이 그 서버를 하네스 몫으로 적었다(`.mcp.json` 몫). 디스크
 *    존재는 근거가 아니다(ADR-096) — 기록 조항이 없으면 렌더에 없는 기록 키를 `planUpsert` 가 지운다(조용한 삭제).
 */
export function selectedMcpServers(rows: ReadonlyArray<TrackMcpRow>, choice: McpChoice): string[] {
  const recorded = new Set(
    (choice.previousLog?.portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key),
  );
  const legacy = new Set(
    choice.projectDir === undefined
      ? []
      : legacyMcpServers(choice.projectDir, choice.previousLog, rows),
  );
  const dropped = new Set(droppedMcpServers(rows, choice.excluded));
  const out: string[] = [];
  for (const [name, assetId] of selectableMcpServers(rows)) {
    if (dropped.has(name)) continue;
    const key = `mcpServers.${name}`;
    if (isAssetSelected(assetId, choice.spec) || recorded.has(key) || legacy.has(name)) {
      out.push(name);
    }
  }
  return out;
}

/**
 * #722 (ADR-106, 설계 검증 B1 ⓐ) — 옛 로그(몫 기록 전 · v26.161 이하)에서 **값으로** 알아본 하네스 서버 중 고를 수 있는 행의
 * 이름. 근거는 `legacyMcpSeed` 와 같다: 기록이 하네스가 그 파일을 **만들었다**고 말하고(`rootFiles.change === "created"`), 값이
 * 하네스가 쓴 것(지금 행 · `PRIOR_MCP_SERVERS`)과 같다. 디스크 존재만으로는 고르지 않는다(ADR-096).
 *
 * 이것을 선택으로 넘기는 이유: 기록 있는 설치본은 기록된 몫(ⓑ)으로 같은 서버를 남기고 갈아 끼운다. 옛 로그만 이 근거가 없어
 * 걷거나 관리 밖에 두면 같은 디스크가 이전 판에 따라 다른 결과를 받는다(루트 CLAUDE.md §설치자 디스크 한 원칙).
 */
export function legacyMcpServers(
  projectDir: string,
  previousLog: InstallLog | null,
  rows: ReadonlyArray<TrackMcpRow>,
): string[] {
  if (previousLog === null || previousLog.records === "writer") return [];
  if ((previousLog.portions ?? []).some((p) => p.path === ".mcp.json")) return [];
  const created = (previousLog.rootFiles ?? []).some(
    (f) => f.path === ".mcp.json" && f.change === "created",
  );
  if (!created) return [];
  const servers = readMcpServers(join(projectDir, ".mcp.json"));
  if (servers === null) return [];
  const out: string[] = [];
  for (const name of selectableMcpServers(rows).keys()) {
    if (!Object.hasOwn(servers, name)) continue;
    const disk = jsonSha(servers[name]);
    const row = rows.find((r) => r.name === name);
    const known = [...(row ? [row.server] : []), ...priorMcpValues(name)];
    if (known.some((v) => jsonSha(toClaudeServer(v)) === disk)) out.push(name);
  }
  return out;
}

/** `.mcp.json` 의 `mcpServers` — 없거나 못 읽으면 null(아무것도 알아보지 않는다). */
function readMcpServers(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const servers = (parsed as { mcpServers?: unknown }).mcpServers;
    if (servers === null || typeof servers !== "object" || Array.isArray(servers)) return null;
    return servers as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * #709 리뷰 NOTE 1 — 설치자가 명시적으로 뺀 고를 수 있는 행: 자산 id(`railway-mcp-server`) 또는 키 id(`mcp:railway-mcp-server`).
 * **트랙 기본 행이어도** 렌더에서 뺀다 — 렌더는 `.mcp.json` · Codex · OpenCode 가 같이 받으므로 명시한 빼기가 트랙과 무관하게 세
 * 자리 모두에 닿는다. 키 id 도 같은 규칙이다: 키 id 를 `.mcp.json` 에만 걸면 기본 행이 아닌 트랙에서는 다음 실행에 몫 기록이 사라져
 * 결국 세 자리 모두에서 빠지므로(선택 조항 ⓑ 가 근거를 잃는다), 트랙에 따라 결과가 갈린다.
 */
export function droppedMcpServers(
  rows: ReadonlyArray<TrackMcpRow>,
  excluded: ReadonlySet<string>,
): string[] {
  return [...selectableMcpServers(rows)]
    .filter(([name, assetId]) => {
      const id = keyId(".mcp.json", `mcpServers.${name}`);
      return excluded.has(assetId) || (id !== null && excluded.has(id));
    })
    .map(([name]) => name);
}

/**
 * #709 — 기록이 하네스 몫으로 적은 `.mcp.json` 서버 중 카탈로그 `internal` 자산이 가리키는 것의 자산 id. 위저드 update
 * 흐름이 이 서버를 **체크된 채** 보이고(체크 = 확인 뒤 디스크에 있다), 해제하면 `--without <id>` 로 낸다. 기록된 몫은
 * 렌더한 키뿐이라 같은 이름의 `internal` 자산이면 곧 트랙 표의 고를 수 있는 행이다 — 트랙 표를 다시 읽지 않는다.
 */
export function recordedMcpAssetIds(log: InstallLog | null): string[] {
  const recorded = new Set(
    (log?.portions ?? []).filter((p) => p.path === ".mcp.json").map((p) => p.key),
  );
  return EXTERNAL_ASSETS.filter(
    (a) => a.method.kind === "internal" && recorded.has(`mcpServers.${a.method.key}`),
  ).map((a) => a.id);
}

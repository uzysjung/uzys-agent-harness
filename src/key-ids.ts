/**
 * 함께 쓰는 파일의 키 id 중 **이번 렌더가 내는 것** (ADR-099 R4).
 *
 * `--with`/`--without` 이 키 id(`mcp:github` · `settings:statusLine` …)를 받을 때 접두만 보면 `--without mcp:gitub` 같은
 * 오타가 아무것도 안 빼는 제외로 조용히 기록된다. 그래서 설치기가 실제로 쓰는 렌더(같은 함수)에서 키를 모아 대조한다.
 * id 는 `keyId`(접두 표 `SHARED_FILES`)로만 만든다 — 접두를 여기 옮겨 적지 않는다.
 *
 * 렌더 집합 = **깔린 CLI ∪ 이번 `--cli`**, **기록 트랙 ∪ 이번 `--track`** 으로 잰다 — 이번 실행에 안 넣은 깔린 CLI 의
 * 키도 화면이 보여 주는 id 이므로 받는다. 트랙 밖의 선택 MCP 서버(#709)는 **기록 ∪ 이번 선택**으로 — 기록된 몫 · 기록된 빼기 ·
 * 이번 `--with`. 그래야 옛 설치본에서 `--without mcp:<name>` 이 계속 받아들여지고, 전에 뺀 키를 `--with mcp:<name>` 으로 풀 수 있다.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isKeyId, keyId } from "./adapters/index.js";
import { TOP_REGION } from "./adapters/toml-region.js";
import { AGENTS_BLOCK_NAME } from "./agents-md-merge.js";
import { listBaselineTargets } from "./baseline-targets.js";
import { renderHarnessMcp } from "./cli-transforms.js";
import { TABLES_REGION } from "./codex/config-toml.js";
import { gitignoreRender } from "./env-files.js";
import { EXTERNAL_ASSETS } from "./external-assets.js";
import { type InstallLog, installedClis } from "./install-log.js";
import { renderSettingsPortion } from "./install-writes.js";
import { renderOpencodeMcp } from "./opencode/opencode-json.js";
import { excludedIds } from "./recorded.js";
import { type CliBase, DEFAULT_OPTIONS, type InstallSpec, isTrack, type Track } from "./types.js";

/** 키 id 를 받는 렌더의 입력 — 트랙(기록 ∪ 이번), 이번 `--with` 의 카탈로그 id, 앞 기록. */
export interface KeyRenderInput {
  tracks: ReadonlyArray<Track>;
  forceInclude: ReadonlyArray<string>;
  previous: InstallLog | null;
}

export function renderedKeyIds(
  harnessRoot: string,
  input: KeyRenderInput,
  clis: ReadonlyArray<CliBase>,
): Set<string> {
  const out = new Set<string>();
  const add = (path: string, key: string): void => {
    const id = keyId(path, key);
    if (id !== null) out.add(id);
  };
  // 빼기로 거르지 않는다 — 받을 수 있는 id 의 집합이다. 기록된 빼기(자산 id · 키 id)가 가리키는 선택 서버도 이번 선택처럼 넣는다
  const recorded = excludedIds(input.previous);
  const recordedOut = EXTERNAL_ASSETS.flatMap((a) =>
    a.method.kind === "internal" &&
    (recorded.has(a.id) || recorded.has(keyId(".mcp.json", `mcpServers.${a.method.key}`) ?? ""))
      ? [a.id]
      : [],
  );
  const mcp = renderHarnessMcp(harnessRoot, {
    spec: {
      tracks: input.tracks,
      options: DEFAULT_OPTIONS,
      userOverride: { forceInclude: [...input.forceInclude, ...recordedOut], forceExclude: [] },
    },
    excluded: new Set(),
    previousLog: input.previous,
  });
  // `.mcp.json` 은 CLI 와 무관하게 쓴다(installer `writeMcpPortion`)
  for (const name of Object.keys(mcp.mcpServers)) add(".mcp.json", `mcpServers.${name}`);
  for (const key of gitignoreRender().keys()) add(".gitignore", key);
  if (clis.includes("claude")) {
    const template = readFileSync(join(harnessRoot, "templates/settings.json"), "utf8");
    for (const key of renderSettingsPortion(template, () => true).keys()) {
      add(".claude/settings.json", key);
    }
  }
  if (clis.includes("codex")) {
    add(".codex/config.toml", TOP_REGION);
    add(".codex/config.toml", TABLES_REGION);
  }
  if (clis.includes("opencode")) {
    for (const key of renderOpencodeMcp(mcp).keys()) add("opencode.json", key);
  }
  if (clis.includes("codex") || clis.includes("opencode")) add("AGENTS.md", AGENTS_BLOCK_NAME);
  return out;
}

/**
 * 설계 `selection-record-design-2026-10-04.md` §3 — install 이 `--without` 으로 받을 수 있는 id 인가(R4 집합): 카탈로그(번들
 * 스킬 포함) · 이번 트랙의 baseline · 깔린 CLI ∪ 이번 `--cli`, 기록 트랙 ∪ 이번 `--track` 의 렌더 키 id. install 의 선택은 이 집합
 * 안에서 기록을 대체하고, 밖은 이어받는다. 키 집합은 처음 필요할 때 한 번 렌더한다.
 */
export function withoutAccepts(
  harnessRoot: string,
  spec: Pick<InstallSpec, "tracks" | "cli" | "userOverride">,
  previous: InstallLog | null,
): (id: string) => boolean {
  const catalog = new Set(EXTERNAL_ASSETS.map((a) => a.id));
  const baseline = new Set(listBaselineTargets({ tracks: spec.tracks }).map((t) => t.id));
  let keys: Set<string> | undefined;
  return (id) => {
    if (catalog.has(id) || baseline.has(id)) return true;
    if (!isKeyId(id)) return false;
    if (keys === undefined) {
      const recordTracks = (previous?.spec.tracks ?? []).filter(isTrack);
      const clis = [...new Set([...(previous ? installedClis(previous) : []), ...spec.cli])];
      keys = renderedKeyIds(
        harnessRoot,
        {
          tracks: [...new Set([...recordTracks, ...spec.tracks])],
          forceInclude: spec.userOverride?.forceInclude ?? [],
          previous,
        },
        clis,
      );
    }
    return keys.has(id);
  };
}

/**
 * 함께 쓰는 파일의 키 id 중 **이번 렌더가 내는 것** (ADR-099 R4).
 *
 * `--with`/`--without` 이 키 id(`mcp:github` · `settings:statusLine` …)를 받을 때 접두만 보면 `--without mcp:gitub` 같은
 * 오타가 아무것도 안 빼는 제외로 조용히 기록된다. 그래서 설치기가 실제로 쓰는 렌더(같은 함수)에서 키를 모아 대조한다.
 * id 는 `keyId`(접두 표 `SHARED_FILES`)로만 만든다 — 접두를 여기 옮겨 적지 않는다.
 *
 * 렌더 집합 = **깔린 CLI ∪ 이번 `--cli`**, **기록 트랙 ∪ 이번 `--track`** 으로 잰다 — 이번 실행에 안 넣은 깔린 CLI 의
 * 키도 화면이 보여 주는 id 이므로 받는다.
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
import { type CliBase, type InstallSpec, isTrack, type Track } from "./types.js";

export function renderedKeyIds(
  harnessRoot: string,
  tracks: ReadonlyArray<Track>,
  clis: ReadonlyArray<CliBase>,
): Set<string> {
  const out = new Set<string>();
  const add = (path: string, key: string): void => {
    const id = keyId(path, key);
    if (id !== null) out.add(id);
  };
  const mcp = renderHarnessMcp(harnessRoot, tracks);
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
  spec: Pick<InstallSpec, "tracks" | "cli">,
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
      keys = renderedKeyIds(harnessRoot, [...new Set([...recordTracks, ...spec.tracks])], clis);
    }
    return keys.has(id);
  };
}

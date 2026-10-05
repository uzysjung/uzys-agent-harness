import { renderHarnessMcp } from "../../src/cli-transforms.js";
import type { McpJson } from "../../src/mcp-merge.js";
import { DEFAULT_OPTIONS, type Track } from "../../src/types.js";

/** 선택 · 기록 없이 트랙만으로 렌더한 하네스 MCP(첫 설치 · 플래그 없음과 같다) — 픽스처용. */
export function trackOnlyMcp(harnessRoot: string, tracks: ReadonlyArray<Track>): McpJson {
  return renderHarnessMcp(harnessRoot, {
    spec: { tracks, options: DEFAULT_OPTIONS },
    excluded: new Set(),
    previousLog: null,
  });
}

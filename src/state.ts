import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readInstallLog } from "./install-log.js";
import { isTrack, type Track } from "./types.js";

export type InstallState = "new" | "existing";

export interface DetectedInstall {
  state: InstallState;
  tracks: Track[];
  /**
   * Source of the detected tracks: "metafile" (v27.17+), "legacy" (rules/*.md heuristic),
   * "install-log" (v26.135.0 — `.claude/` 없는 설치), or "none".
   */
  source: "metafile" | "legacy" | "install-log" | "none";
  /**
   * `.claude/` 가 실제로 있는가. **"설치됐는가"가 아니다** — opencode/codex 단독 설치는
   * `.claude/` 없이도 설치 상태다 (v26.135.0 · #253). 설치 여부는 `state` 를 봐라.
   */
  hasClaudeDir: boolean;
}

const META_FILE = ".claude/.installed-tracks";

interface LegacySignature {
  rule: string;
  track: Track;
}

const LEGACY_SIGNATURES: readonly LegacySignature[] = [
  { rule: "htmx.md", track: "ssr-htmx" },
  { rule: "nextjs.md", track: "ssr-nextjs" },
  { rule: "data-analysis.md", track: "data" },
  { rule: "pyside6.md", track: "data" },
  { rule: "cli-development.md", track: "tooling" },
];

/**
 * Detect what was previously installed in the given project directory.
 * Mirrors the v27.17 detect_install_state shell function (setup-harness.sh:191).
 */
export function detectInstallState(projectDir: string): DetectedInstall {
  const claudeDir = join(projectDir, ".claude");
  const hasClaudeDir = existsSync(claudeDir);

  if (hasClaudeDir) {
    const metaPath = join(projectDir, META_FILE);
    if (existsSync(metaPath)) {
      const tracks = readMetafile(metaPath);
      return { state: "existing", tracks, source: "metafile", hasClaudeDir: true };
    }
    const tracks = inferFromLegacySignatures(projectDir);
    return { state: "existing", tracks, source: "legacy", hasClaudeDir: true };
  }

  // v26.135.0 (#253) — `.claude/` 부재 ≠ 미설치. opencode/codex 단독 설치는 `.claude/` 를
  // 만들지 않는다(만들던 것이 그 이슈다). 설치 로그가 있으면 설치된 것이고, 이걸 안 보면
  // 위저드가 기설치 프로젝트에 "new install" 흐름을 태운다.
  const log = readInstallLog(projectDir);
  if (log) {
    return {
      state: "existing",
      tracks: tracksFromLog(log.spec.tracks),
      source: "install-log",
      hasClaudeDir: false,
    };
  }

  return { state: "new", tracks: [], source: "none", hasClaudeDir: false };
}

/** 로그의 tracks 는 문자열이라 현재 Track 어휘로 좁힌다 (구 버전 로그에 폐기된 track 이 있을 수 있다). */
function tracksFromLog(tracks: ReadonlyArray<string>): Track[] {
  return [...new Set(tracks.filter(isTrack))].sort();
}

function readMetafile(path: string): Track[] {
  const raw = readFileSync(path, "utf8");
  const seen = new Set<Track>();
  for (const line of raw.split(/\s+/)) {
    const trimmed = line.trim();
    if (isTrack(trimmed)) {
      seen.add(trimmed);
    }
  }
  return [...seen].sort();
}

function inferFromLegacySignatures(projectDir: string): Track[] {
  const rulesDir = join(projectDir, ".claude/rules");
  if (!existsSync(rulesDir)) {
    return [];
  }
  const found = new Set<Track>();
  for (const sig of LEGACY_SIGNATURES) {
    if (existsSync(join(rulesDir, sig.rule))) {
      found.add(sig.track);
    }
  }
  return [...found].sort();
}

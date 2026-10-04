import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { c, status } from "./design.js";
import {
  corruptedInstallLogMessage,
  type InstallLog,
  installLogPath,
  readInstallLogStatus,
} from "./install-log.js";
import { HARNESS_ANCHOR_FILE } from "./project-claude-merge.js";
import { isTrack, type Track } from "./types.js";

/** 기록 ok · 기록 파싱/필드 불량 · 기록 없음 — 설계 no-record §1. 디스크 흔적은 이 값을 바꾸지 않는다. */
export type InstallState = "installed" | "corrupted" | "none";

/**
 * 하네스가 남겼을 법한 디스크 흔적(설계 no-record §3). **판정에 쓰지 않는다** — 안내 문장과 `--track` 제안에만
 * 쓴다(ADR-096 Consequences: 디스크 존재는 안내를 낼지에만). 오판해도 비용은 문장 하나다.
 */
export interface Trace {
  /** 프로젝트 상대 경로 */
  path: string;
  /** 이 흔적이 제안하는 트랙 — `.claude/.installed-tracks` 만 채운다. */
  tracks?: Track[];
}

export interface DetectedInstall {
  state: InstallState;
  /** `state === "installed"` 일 때만 non-null. */
  log: InstallLog | null;
  /** 기록의 트랙 ∩ 지금 어휘 (installed 일 때만 — 나머지는 빈 배열). */
  tracks: Track[];
  /**
   * `.claude/` 가 실제로 있는가. **"설치됐는가"가 아니다** — opencode/codex 단독 설치는
   * `.claude/` 없이도 설치 상태다 (v26.135.0 · #253). 복구 문구(D10) 전용이다.
   */
  hasClaudeDir: boolean;
  /** `state === "none"` 일 때만 채운다. */
  traces: Trace[];
}

export const META_FILE = ".claude/.installed-tracks";
/** v26.139 이하가 쓰던 앵커 자리 — install 이 한 줄 안내한다(설계 no-record §3). */
export const LEGACY_ANCHOR_FILE = ".claude/CLAUDE.md";

/** 옛 판이 깔던 트랙 룰 — 흔적으로만 본다(트랙 추론에 쓰지 않는다). */
const TRACE_RULES = ["htmx", "nextjs", "data-analysis", "pyside6", "cli-development"].map(
  (r) => `.claude/rules/${r}.md`,
);

/**
 * 설치 상태 판정 — `list` · `update` · `uninstall` · 위저드가 **이 결과만** 읽는다(설계 no-record §1 불변식).
 * 입력은 설치 기록 하나다(CLAUDE.md §설치자 디스크 — 디스크 존재는 근거가 아니다, ADR-096).
 */
export function detectInstallState(projectDir: string): DetectedInstall {
  const hasClaudeDir = existsSync(join(projectDir, ".claude"));
  const read = readInstallLogStatus(projectDir);
  if (read.status === "ok") {
    return {
      state: "installed",
      log: read.log,
      tracks: tracksFromLog(read.log.spec.tracks),
      hasClaudeDir,
      traces: [],
    };
  }
  if (read.status === "corrupted") {
    return { state: "corrupted", log: null, tracks: [], hasClaudeDir, traces: [] };
  }
  return { state: "none", log: null, tracks: [], hasClaudeDir, traces: collectTraces(projectDir) };
}

/** 로그의 tracks 는 문자열이라 현재 Track 어휘로 좁힌다 (구 버전 로그에 폐기된 track 이 있을 수 있다). */
function tracksFromLog(tracks: ReadonlyArray<string>): Track[] {
  return [...new Set(tracks.filter(isTrack))].sort();
}

function collectTraces(projectDir: string): Trace[] {
  const at = (rel: string): string => join(projectDir, rel);
  const contains = (rel: string, needle: string): boolean =>
    existsSync(at(rel)) && readFileSync(at(rel), "utf8").includes(needle);
  const traces: Trace[] = [];
  if (existsSync(at(META_FILE)))
    traces.push({ path: META_FILE, tracks: readMetafile(at(META_FILE)) });
  if (existsSync(at(HARNESS_ANCHOR_FILE))) traces.push({ path: HARNESS_ANCHOR_FILE });
  if (contains("CLAUDE.md", "<!-- uzys-harness:import:start -->"))
    traces.push({ path: "CLAUDE.md" });
  if (contains("AGENTS.md", "<!-- uzys-harness:")) traces.push({ path: "AGENTS.md" });
  for (const rel of [".agents/rules/uzys-harness.md", LEGACY_ANCHOR_FILE, ...TRACE_RULES]) {
    if (existsSync(at(rel))) traces.push({ path: rel });
  }
  return traces;
}

function readMetafile(path: string): Track[] {
  const seen = new Set<Track>();
  for (const word of readFileSync(path, "utf8").split(/\s+/)) {
    if (isTrack(word)) seen.add(word);
  }
  return [...seen].sort();
}

/** 흔적이 제안하는 트랙 — 위저드 트랙 기본 체크 · 안내의 `--track` 값. 없으면 빈 배열. */
export function suggestedTracks(traces: ReadonlyArray<Trace>): Track[] {
  return [...new Set(traces.flatMap((t) => t.tracks ?? []))].sort();
}

/** 흔적 있는 none 의 둘째·셋째 줄 — 세 명령과 위저드가 같은 문장을 쓴다. */
export function traceNoteLines(traces: ReadonlyArray<Trace>): string[] {
  const shown = traces.slice(0, 3).map((t) => t.path);
  return [
    `Harness files are here (${shown.join(", ")}${traces.length > 3 ? ", …" : ""}) but no record of installing them.`,
    "Cloned from a teammate? Ask whoever installed it to run `install --track <t>` once (tracks: see `list`) and commit .uzys-agent-harness/ (if .gitignore still lists `.uzys-agent-harness/` after that, the line is theirs — delete it).",
  ];
}

/**
 * 설치가 아닌 상태의 안내 — `list` · `update` · `uninstall` 이 **같은 줄**을 낸다(설계 no-record §1 규칙 ⓐ).
 * 첫 줄이 판정 한 문장이고, 이어지는 줄은 할 일이다. `installed` 면 빈 배열.
 */
export function notInstalledLines(detected: DetectedInstall, projectDir: string): string[] {
  if (detected.state === "installed") return [];
  if (detected.state === "corrupted") return [corruptedInstallLogMessage(projectDir)];
  if (detected.traces.length === 0) {
    return [
      `No harness install found at ${projectDir}`,
      "Run `agent-harness install --track <name>` first.",
    ];
  }
  const suggested = suggestedTracks(detected.traces);
  const trackArgs =
    suggested.length > 0 ? suggested.map((t) => `--track ${t}`).join(" ") : "--track <t>";
  return [
    `No install record at ${installLogPath(projectDir)}`,
    ...traceNoteLines(detected.traces),
    `To make this copy managed on its own: agent-harness install ${trackArgs}`,
  ];
}

/** `notInstalledLines` 를 stderr 형식으로 — 첫 줄 `✗`, 나머지는 들여 쓴 흐린 줄. */
export function reportNotInstalled(
  detected: DetectedInstall,
  projectDir: string,
  err: (msg: string) => void,
): void {
  const [head, ...rest] = notInstalledLines(detected, projectDir);
  if (head === undefined) return;
  err(status.failure(c.red(head)));
  for (const line of rest) err(c.dim(`  ${line}`));
}

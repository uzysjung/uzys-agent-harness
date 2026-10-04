/**
 * #585 후속(리뷰 B1) — 옛 판(v26.163.0 이하)이 마지막 install 의 트랙으로 **덮어쓴** 기록의 트랙을 기록 안의 근거로 한 번 되살린다.
 *
 * 옛 판은 `spec.tracks` 를 누적하지 않았다. 그래서 `install --track tooling --cli claude --cli antigravity` 뒤
 * `install --track data --cli codex` 를 하면 기록은 `[data]` 인데 디스크에는 tooling 의 몫이 하네스 것으로 깔려 있다. 이 상태를
 * 그대로 읽으면 트랙 밖 회수(#677)가 정당하게 깐 tooling 룰을 "트랙 밖" 이라며 지우고, 머리글은 tooling 이 사라진 것처럼 말한다.
 *
 * 근거는 하네스가 쓴 것만이다(디스크 존재는 근거가 아니다, ADR-096):
 * - `.claude/.installed-tracks` — claude 를 깐 실행이 쓰는 하네스 파일. **기록에 그 sha 가 있고 디스크 내용이 같을 때만** 읽는다.
 *   sha 가 없으면 기록이 그 내용을 보증하지 않으므로 근거가 아니다(#699 — 메타파일이 기록과 달라도 트랙은 기록에서).
 * - claude 자리에 기록된 하네스 파일(`policyFiles` · `skillFiles`) — **쓰는 순간 적은 기록(`records: "writer"`, v26.162.0+)
 *   만**. 옛 판이 디스크를 훑어 적은 기록에는 같은 이름의 설치자 파일이 섞인다(BLOCKER-5 — 트랙 밖 동명 파일은 소유가 아니다).
 *   트랙 t 만의 대상(공통 · 기록 트랙의 것 · 설치자가 뺀 것을 뺀 나머지)이 **전부** 기록에 있으면 t 가 깔렸던 것이다. 하나만 보고
 *   정하면 `cli-development` 하나로 `full` 까지 되살린다.
 *   다른 CLI 자리는 근거로 쓰지 않는다: `.agents/rules/` 는 옛 update 가 트랙 밖 룰을 새게 만든 바로 그 자리이고(#601 — 회수 후보
 *   자신과 그 사본), Codex · OpenCode 의 룰은 `AGENTS.md` 안이라 파일 단위 기록이 없다.
 *
 * 되살린 트랙은 읽는 쪽 전부(머리글 · update · install 의 누적)가 같이 본다. 기록에는 다음 쓰기 때 남고, 그때 `tracksHealed`
 * 표시가 붙어 다시 하지 않는다(이 판 이후의 기록은 누적되므로 잘리지 않는다 — `migrateExcluded` 와 같은 1회 방식).
 */

import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isBaselineExcluded } from "./baseline-targets.js";
import { hashContent, type InstallLog } from "./install-log.js";
import { buildAssetSpec, buildManifest } from "./manifest.js";
import { DEFAULT_OPTIONS, isTrack, TRACKS, type Track } from "./types.js";

const META_FILE = ".claude/.installed-tracks";
/** `policyFiles` 의 키(`.claude/` 상대). */
const META_KEY = ".installed-tracks";

export function memoTargets(
  render: (tracks: ReadonlyArray<Track>) => Iterable<string>,
): (tracks: ReadonlyArray<Track>) => ReadonlySet<string> {
  const cache = new Map<string, ReadonlySet<string>>();
  return (tracks) => {
    const key = [...tracks].sort().join(",");
    const hit = cache.get(key) ?? new Set(render(tracks));
    cache.set(key, hit);
    return hit;
  };
}

/** claude 자리(파일 자산 · 번들 스킬 디렉터리)에 트랙이 가져오는 대상 — manifest 렌더(프로젝트 상대). */
export const claudeTargets = memoTargets((tracks) => {
  const spec = buildAssetSpec({ tracks, options: DEFAULT_OPTIONS });
  return buildManifest(spec)
    .filter((e) => e.applies(spec) && (e.type === "file" || e.target.startsWith(".claude/skills/")))
    .map((e) => e.target);
});

/** 기록된 claude 자리 경로(프로젝트 상대) — 파일과 스킬 디렉터리. */
export function claudeRecorded(log: InstallLog): Set<string> {
  return new Set([
    ...(log.policyFiles ?? []).map((f) => `.claude/${f.path}`),
    ...(log.skillFiles ?? []).map((f) => `.claude/skills/${f.path.split("/")[0] ?? ""}`),
  ]);
}

/**
 * 잘린 트랙을 되살린 기록. 표시(`tracksHealed`)가 있거나 claude 가 깔린 기록이 아니면 그대로다(근거가 claude 자리에만 있다).
 * `excluded` 는 이 함수 안에서 읽는다(`excluded` · 옛 `spec.baselineExclude`).
 */
export function healRecordedTracks(
  log: InstallLog,
  projectDir: string,
  clis: ReadonlyArray<string>,
): InstallLog {
  if (log.tracksHealed === true || !clis.includes("claude")) return log;
  const recorded = log.spec.tracks.filter(isTrack);
  const found = new Set<Track>([
    ...metafileTracks(log, projectDir),
    ...fileEvidence(log, recorded),
  ]);
  const added = [...found].filter((t) => !recorded.includes(t));
  if (added.length === 0) return log;
  return {
    ...log,
    spec: { ...log.spec, tracks: [...new Set([...log.spec.tracks, ...added])].sort() },
  };
}

function metafileTracks(log: InstallLog, projectDir: string): Track[] {
  const abs = join(projectDir, META_FILE);
  if (lstatSync(abs, { throwIfNoEntry: false })?.isFile() !== true) return [];
  const content = readFileSync(abs, "utf8");
  const sha = log.policyFiles?.find((f) => f.path === META_KEY)?.sha256;
  if (sha === undefined || hashContent(content) !== sha) return []; // 기록이 보증하지 않는 내용은 근거가 아니다
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter(isTrack);
}

function fileEvidence(log: InstallLog, recordTracks: ReadonlyArray<Track>): Track[] {
  if (log.records !== "writer") return [];
  const recorded = claudeRecorded(log);
  if (recorded.size === 0) return [];
  const excluded = new Set([...(log.excluded ?? []), ...(log.spec.baselineExclude ?? [])]);
  const known = new Set([...claudeTargets([]), ...claudeTargets(recordTracks)]);
  return TRACKS.filter((t) => {
    if (recordTracks.includes(t)) return false;
    const own = [...claudeTargets([t])].filter(
      (g) => !known.has(g) && !isBaselineExcluded(g, excluded),
    );
    return own.length > 0 && own.every((g) => recorded.has(g));
  });
}

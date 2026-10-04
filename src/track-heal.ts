/**
 * #585 후속(리뷰 B1 · B2) — 옛 판(v26.163.0 이하)이 마지막 install 의 트랙으로 **덮어쓴** 기록의 트랙을 되살린다.
 *
 * 옛 판은 `spec.tracks` 를 누적하지 않았다. 그래서 `install --track tooling --cli claude --cli antigravity` 뒤
 * `install --track data --cli codex` 를 하면 기록은 `[data]` 인데 디스크에는 tooling 의 몫이 하네스 것으로 깔려 있다.
 *
 * 되살린 트랙은 **더 까는 결과**를 낳는다(update 가 그 트랙의 몫을 모든 CLI 에 깔고 `.mcp.json` 에 서버를 더하며, 위저드는 깔린
 * 트랙을 뺄 수 없다). 그래서 근거는 **트랙 이름을 그대로 적은 정확한 근거 하나**만 쓴다: `.claude/.installed-tracks` — claude 를
 * 깐 실행이 쓰는 하네스 파일이고, **기록에 그 sha 가 있고 디스크 내용이 같을 때만** 읽는다(sha 가 없으면 기록이 그 내용을
 * 보증하지 않는다 — #699 "메타파일이 달라도 트랙은 기록에서").
 *
 * 파일 근거(claude 자리에 기록된 트랙 파일)로는 트랙을 더하지 않는다 — claude 자리 파일이 같은 형제 트랙(csr-* · ssr-nextjs,
 * base · ssr-htmx)을 가를 수 없어 고르지 않은 트랙과 그 MCP 서버를 더했다(리뷰 B2). 그 근거는 **남기기만 하는** 쪽, 트랙 밖
 * 회수의 보호(`out-of-track.ts`)에서만 쓴다.
 *
 * 1회 표시는 두지 않는다 — 이 판은 메타파일을 기록과 같은 누적 트랙으로 쓰므로(`installer.ts`) 다시 읽어도 더할 트랙이 없다.
 * 되살린 트랙은 읽는 쪽 전부가 같이 보고, 기록에는 다음 쓰기 때 남는다.
 */

import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hashContent, type InstallLog } from "./install-log.js";
import { buildAssetSpec, buildManifest } from "./manifest.js";
import { DEFAULT_OPTIONS, isTrack, type Track } from "./types.js";

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

/** 잘린 트랙을 되살린 기록. claude 가 깔린 기록이 아니면 그대로다(근거가 claude 자리의 메타파일이다). */
export function healRecordedTracks(
  log: InstallLog,
  projectDir: string,
  clis: ReadonlyArray<string>,
): InstallLog {
  if (!clis.includes("claude")) return log;
  const recorded = log.spec.tracks.filter(isTrack);
  const added = metafileTracks(log, projectDir).filter((t) => !recorded.includes(t));
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

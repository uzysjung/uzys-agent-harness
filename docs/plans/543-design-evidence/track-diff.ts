/**
 * #543 설계 근거 — "T 에만 속한 자산 = 남는 트랙의 manifest 차집합" 을 **기존 함수**로 계산할 수 있는가.
 *
 *   npx tsx track-diff.ts <installLog.json> <trackToRemove>
 *
 * 기록의 하네스 파일 후보(uninstall 의 `harnessCandidates` 와 같은 세 필드 — `commands/uninstall.ts:1776`)를 나열하고,
 * 두 술어로 "T 전용" 을 가른다:
 *   ⓐ `recordedTrackTargets(log)`(`src/recorded.ts:106`) — update · uninstall 이 지금 쓰는 "기록 트랙의 대상" 술어. 번들 스킬은
 *      **전부** 대상으로 본다(`selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS`, `src/recorded.ts:109`) → 트랙 전용 스킬을 못 가른다.
 *   ⓑ `buildManifest(buildAssetSpec({tracks}))`(`src/manifest.ts:64 · 370`) — install 이 까는 것과 같은 트랙 게이팅(스킬 포함).
 * 외부 CLI 자리는 번들 경로로 바꿔 같은 술어에 넣는다(`bundlePath`, `src/recorded.ts:83` · 룰은 `.agents/rules/<r>.md` → `.claude/rules/<r>.md`).
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveBundleRoot } from "../../../src/context-cost.ts";
import type { InstallLog } from "../../../src/install-log.ts";
import { buildAssetSpec, buildManifest } from "../../../src/manifest.ts";
import { bundlePath, recordedTrackTargets } from "../../../src/recorded.ts";
import { DEFAULT_OPTIONS, isTrack, type Track } from "../../../src/types.ts";

const [logPath, track] = process.argv.slice(2);
if (!logPath || !track) {
  console.error("usage: track-diff.ts <installLog.json> <track>");
  process.exit(3);
}
const log = JSON.parse(readFileSync(resolve(logPath), "utf8")) as InstallLog;
const candidates = [
  ...(log.policyFiles ?? []).map((f) => `.claude/${f.path}`),
  ...(log.skillFiles ?? []).map((f) => `.claude/skills/${f.path}`),
  ...(log.externalFiles ?? []).map((f) => f.path),
];
const asBundle = (p: string): string => {
  const rule = /^\.agents\/rules\/([^/]+\.md)$/.exec(p)?.[1];
  return rule !== undefined ? `.claude/rules/${rule}` : bundlePath(p);
};
const oldTracks = log.spec.tracks.filter(isTrack);
const newTracks = oldTracks.filter((t) => t !== track);
const next: InstallLog = { ...log, spec: { ...log.spec, tracks: newTracks } };

// ⓑ manifest(트랙 게이팅 그대로) 의 대상 술어 — 디렉터리 대상은 번들 템플릿에 있는 파일만(recordedTrackTargets 와 같은 규칙)
function manifestTargets(tracks: ReadonlyArray<Track>): (path: string) => boolean {
  const spec = buildAssetSpec({ tracks, options: DEFAULT_OPTIONS });
  const entries = buildManifest(spec).filter((e) => e.applies(spec));
  const templates = join(resolveBundleRoot(), "templates");
  return (path) =>
    entries.some((e) =>
      e.type === "dir"
        ? path.startsWith(`${e.target}/`) &&
          existsSync(join(templates, e.source, path.slice(e.target.length + 1)))
        : e.target === path,
    );
}

const report = (label: string, was: (p: string) => boolean, is: (p: string) => boolean): void => {
  const onlyT = candidates.filter((p) => was(asBundle(p)) && !is(asBundle(p)));
  const neither = candidates.filter((p) => !was(asBundle(p)));
  console.log(`\n=== ${label}`);
  console.log(`[T-only = target under ${oldTracks.join("+")}, not under ${newTracks.join("+") || "(none)"}] ${onlyT.length}`);
  for (const p of onlyT.sort()) console.log(`  ${p}`);
  console.log(`[not a target under either — shared files · meta · external renders · tool files] ${neither.length}`);
  for (const p of neither.sort()) console.log(`  ${p}`);
};

console.log(`tracks: ${oldTracks.join(",")} -> ${newTracks.join(",")}`);
console.log(`recorded harness candidates: ${candidates.length}`);
report("ⓐ recordedTrackTargets (src/recorded.ts:106 — bundled skills all count as targets)", recordedTrackTargets(log), recordedTrackTargets(next));
report("ⓑ buildManifest(buildAssetSpec) (src/manifest.ts:64·370 — install's track gating, skills included)", manifestTargets(oldTracks), manifestTargets(newTracks));

import type { Track } from "./types.js";

/** Match a track against a glob-style pattern (bash-compatible: `csr-*`, `csr-*|full`). */
export function matchTrack(track: Track, pattern: string): boolean {
  return pattern.split("|").some((p) => globToRegex(p.trim()).test(track));
}

export function anyTrack(tracks: ReadonlyArray<Track>, pattern: string): boolean {
  return tracks.some((t) => matchTrack(t, pattern));
}

export function hasDevTrack(tracks: ReadonlyArray<Track>): boolean {
  // Dev tracks = anything that is NOT executive AND NOT tooling-only-meta.
  // Mirrors setup-harness.sh has_dev_track: csr-*, ssr-*, data, full, tooling.
  // #456 — base 는 dev 트랙이다(방법론 스킬·implementer 를 받는다). 스택 전용 자산은 각자의
  // 트랙 조건이 거른다.
  return anyTrack(tracks, "csr-*|ssr-*|data|full|tooling|base");
}

export function hasUiTrack(tracks: ReadonlyArray<Track>): boolean {
  return anyTrack(tracks, "csr-*|ssr-*|full");
}

/** Convert a bash glob (only `*` is supported) to a strict-anchored RegExp. */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

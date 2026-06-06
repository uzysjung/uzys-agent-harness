/**
 * A1 — Trust Tier star-drift 검출 데이터 + 순수 로직.
 *
 * TRUST_TIER 의 star 기반 라벨(vetted ≥ 1000★ / experimental < 1000★)이 실제 GitHub
 * star 와 어긋났는지(drift) 판정한다. `official` 은 star 무관(Anthropic 공식·하네스 자체)
 * 이라 검사 제외.
 *
 * repo 출처 = 각 자산 method (in-code authoritative — 주석이 아니라 실제 설치 source):
 *   skill  → method.source     ("owner/repo" 또는 github URL)
 *   plugin → method.marketplace ("owner/repo")
 *   npm    → NPM_REPO_OVERRIDE[id] (pkg 는 npm 명이므로 GitHub repo 를 별도 명시)
 *
 * fetch/네트워크는 본 모듈에 없음 — 순수 로직만(테스트 가능). 실 fetch 는
 * `scripts/trust-tier-drift.mjs` 가 담당.
 */
import { EXTERNAL_ASSETS, type ExternalAsset, TRUST_TIER } from "./external-assets.js";

// v26.76.0 — gen-compatibility.mjs 가 dist 에서 자산 카탈로그+tier 를 읽도록 re-export.
export { EXTERNAL_ASSETS, TRUST_TIER } from "./external-assets.js";

/** vetted 경계 (NORTH_STAR / PRD v26-71 D2). */
export const STAR_THRESHOLD = 1000;

export type StarTier = "vetted" | "experimental";
export type DriftVerdict = "ok" | "promote" | "demote";

/**
 * method 가 GitHub repo 를 안 담는 자산(npm.pkg / npx-run.cmd 는 npm 명) → 트러스트 근거가
 * 된 GitHub repo 를 명시 매핑. override 가 method 도출보다 우선.
 */
const REPO_OVERRIDE: Record<string, string> = {
  "vercel-cli": "vercel/vercel", // npm
  "netlify-cli": "netlify/cli", // npm
  "supabase-cli": "supabase/cli", // npm
  "agent-browser": "vercel-labs/agent-browser", // npm
  "gsd-orchestrator": "gsd-build/get-shit-done", // npx-run
  openspec: "Fission-AI/OpenSpec", // npm (v26.75.0)
  "bmad-method": "bmad-code-org/BMAD-METHOD", // npx-run (v26.75.0)
};

/** "https://github.com/owner/repo" 또는 "owner/repo[/...]" → "owner/repo". 실패 시 null. */
export function normalizeRepo(source: string): string | null {
  const stripped = source.replace(/^https?:\/\/github\.com\//i, "");
  const m = stripped.match(/^([^/\s]+\/[^/\s]+)/);
  return m?.[1] ?? null;
}

/** 자산의 GitHub owner/repo 도출. override 우선 → skill/plugin method. 도출 불가 시 null. */
export function repoForAsset(asset: ExternalAsset): string | null {
  const override = REPO_OVERRIDE[asset.id];
  if (override) return override;
  const m = asset.method;
  if (m.kind === "skill") return normalizeRepo(m.source);
  if (m.kind === "plugin") return normalizeRepo(m.marketplace);
  return null;
}

export interface DriftTarget {
  id: string;
  tier: StarTier;
  repo: string;
}

/** star 기반(vetted/experimental) 자산만 + repo 도출 가능한 것만 검사 대상. */
export function driftTargets(
  assets: ReadonlyArray<ExternalAsset> = EXTERNAL_ASSETS,
): DriftTarget[] {
  const out: DriftTarget[] = [];
  for (const a of assets) {
    const tier = TRUST_TIER[a.id];
    if (tier !== "vetted" && tier !== "experimental") continue;
    const repo = repoForAsset(a);
    if (!repo) continue; // 도출 불가 — 테스트가 0건을 강제하므로 정상 경로에선 발생 안 함
    out.push({ id: a.id, tier, repo });
  }
  return out;
}

/** 정적 tier 가 실제 star 와 어긋났는지 판정. */
export function classifyDrift(tier: StarTier, stars: number): DriftVerdict {
  if (tier === "vetted" && stars < STAR_THRESHOLD) return "demote";
  if (tier === "experimental" && stars >= STAR_THRESHOLD) return "promote";
  return "ok";
}

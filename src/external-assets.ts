/**
 * External asset matrix — bash setup-harness.sh L791~1067 등가 데이터.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F3
 * Source: setup-harness.sh@911c246~1 (v27.18 직전, bash cutover 전)
 *
 * Track 또는 옵션 조건이 충족되면 install pipeline에서 method를 호출.
 * 실패는 "warn-skip" — 종료 시 누락 자산 보고 (OQ1 결정).
 */

import type { Category, Source } from "./categories.js";
import { hasDevTrack } from "./track-match.js";
import type { OptionFlags, Track } from "./types.js";

export type ExternalAssetMethod =
  /** `npx skills add <source>[ --skill <name>] --yes` */
  | { kind: "skill"; source: string; skill?: string }
  /** `claude plugin marketplace add <marketplace>` + `claude plugin install <pluginId>` */
  | { kind: "plugin"; marketplace: string; pluginId: string }
  /** `npm install -g <pkg>` */
  | { kind: "npm-global"; pkg: string }
  /** `npx <cmd>` — fire-and-forget 실행 (예: GSD orchestrator) */
  | { kind: "npx-run"; cmd: string; args?: string[] }
  /** `bash <script> <args...>` — 로컬 스크립트 (예: prune-ecc.sh) */
  | { kind: "shell-script"; script: string; args: string[] };

export type ExternalAssetCondition =
  /** Track 중 1개 이상이 set와 일치 */
  | { kind: "any-track"; tracks: Track[] }
  /** dev track (executive 외 모두) */
  | { kind: "has-dev-track" }
  /** OptionFlags 의 특정 플래그 true */
  | { kind: "option"; flag: keyof OptionFlags };

export interface ExternalAsset {
  /** 안정 식별자 — 로깅 + 누락 보고 + 테스트에서 사용 */
  id: string;
  /** 사람이 읽는 라벨 (한 줄) */
  description: string;
  /** v26.43.0 — Category-based UI 그룹화. SPEC §3.1. */
  category: Category;
  /** v26.43.0 — 정확한 출처 (GitHub org/user). Step 2 라벨. SPEC §3.5 R6. */
  source: Source;
  condition: ExternalAssetCondition;
  method: ExternalAssetMethod;
  /** 실패 시 동작 — 기본 warn-skip. abort는 vibe killer라 신중히 사용 */
  failureMode?: "abort" | "warn-skip";
}

const ALL_CSR_SSR_FULL: Track[] = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "full",
];

/** csr-*|ssr-nextjs|full per bash setup-harness.sh L1041 (ssr-htmx 제외 — htmx는 React 미사용). */
const CSR_SSR_NEXTJS_FULL: Track[] = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-nextjs",
  "full",
];

const RAILWAY_TRACKS: Track[] = ["csr-fastify", "csr-fastapi", "ssr-htmx", "ssr-nextjs", "full"];

/**
 * v0.8.1 — executive-style Track SSOT (reviewer MEDIUM-3 fix).
 *
 * 3 Track 모두 dev/UI baseline 미적용 — `.claude/agents/strategist` + project-claude/<track>.md만.
 * `track-match.ts:hasDevTrack()` 의 negation domain. 사용처:
 *   - `shouldInstallAsset` `has-dev-track` 분기 코멘트 (L458)
 *   - `tests/external-assets.test.ts` invariant
 *
 * 신규 executive-style Track 추가 시 이 상수만 수정 → 모든 사용처 자동 반영.
 */
export const EXECUTIVE_STYLE_TRACKS: ReadonlyArray<Track> = [
  "executive",
  "project-management",
  "growth-marketing",
];

/**
 * v0.8.1 — `hasDevTrack` SSOT 의 array 표현 (reviewer MEDIUM-3 fix).
 *
 * `track-match.ts:hasDevTrack()` 와 동등 (TRACKS \ EXECUTIVE_STYLE_TRACKS = 8 Track).
 * `any-track` condition 에 dev set 전체를 인라인하지 않도록 사용.
 */
export const DEV_TRACKS: ReadonlyArray<Track> = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "tooling",
  "full",
];

/**
 * v0.8.1 — dev + project-management 합집합 (reviewer MEDIUM-3 fix).
 *
 * `product-skills` (PM 도메인까지 사용) 의 9-Track 인라인 배열을 SSOT 상수로 교체.
 */
export const DEV_PLUS_PM_TRACKS: ReadonlyArray<Track> = [...DEV_TRACKS, "project-management"];

/**
 * 32 외부 자산 매트릭스. bash setup-harness.sh@911c246~1 L791~1067 + 1320~1370 동등.
 *
 * 호출 순서: data → dev-baseline → railway → supabase-cli → impeccable → dev-tools →
 * supabase-skills → react/ui → next → executive → GSD → ToB → ECC.
 */
export const EXTERNAL_ASSETS: ReadonlyArray<ExternalAsset> = [
  // === data Track ===
  {
    id: "polars-K-Dense",
    description: "polars (K-Dense scientific-skills)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "polars" },
  },
  {
    id: "dask-K-Dense",
    description: "dask (K-Dense, 분산처리)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "dask" },
  },
  {
    id: "python-resource-management",
    description: "python-resource-management (wshobson)",
    category: "data",
    source: "wshobson",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "skill",
      source: "https://github.com/wshobson/agents",
      skill: "python-resource-management",
    },
  },
  {
    id: "python-performance-optimization",
    description: "python-performance-optimization (wshobson)",
    category: "data",
    source: "wshobson",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "skill",
      source: "https://github.com/wshobson/agents",
      skill: "python-performance-optimization",
    },
  },
  {
    id: "anthropic-data-plugin",
    description: "Anthropic data plugin (visualization, SQL exploration)",
    category: "data",
    source: "anthropics",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "plugin",
      marketplace: "anthropics/knowledge-work-plugins",
      pluginId: "data@knowledge-work-plugins",
    },
  },

  // === Option-gated (v26.42.0 — opt-in, BREAKING vs prior has-dev-track auto-install) ===
  {
    id: "addy-agent-skills",
    description: "addy agent-skills (general dev)",
    category: "workflow",
    source: "addyosmani",
    condition: { kind: "option", flag: "withAddyAgentSkills" },
    method: {
      kind: "plugin",
      marketplace: "addyosmani/agent-skills",
      pluginId: "agent-skills@addy-agent-skills",
    },
  },
  {
    id: "superpowers",
    // 저자 = obra (190k★ github.com/obra/superpowers). 호스팅 = Anthropic 공식
    // marketplace github.com/anthropics/claude-plugins-official ("Official,
    // Anthropic-managed directory of high quality Claude Code Plugins").
    // source/marketplace 분리는 의도적 — source=저자, marketplace=registry.
    description: "Superpowers — agentic skills framework (obra, Anthropic 공식 marketplace)",
    category: "workflow",
    source: "obra",
    condition: { kind: "option", flag: "withSuperpowers" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "superpowers@claude-plugins-official",
    },
  },

  // === Railway (csr-fastify|csr-fastapi|ssr-*|full) ===
  // v0.6.3 — railway-plugin entry 제거. railwayapp/railway-plugin repo 자체 존재 안 함
  // (404 Not Found). 공식 docs (https://docs.railway.com/ai/claude-code-plugin) 형식은
  // marketplace add `railwayapp/railway-skills` + plugin install `railway@railway-skills`만.
  // → 아래 railway-skills entry로 단일화.
  {
    id: "railway-skills",
    description: "Railway agent-skills (deploy + project/service/env management)",
    category: "backend",
    source: "railwayapp",
    condition: { kind: "any-track", tracks: RAILWAY_TRACKS },
    method: {
      kind: "plugin",
      marketplace: "railwayapp/railway-skills",
      pluginId: "railway@railway-skills",
    },
  },

  // === csr-supabase|full CLI ===
  {
    id: "vercel-cli",
    description: "Vercel CLI (npm -g)",
    category: "backend",
    source: "vercel",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm-global", pkg: "vercel" },
  },
  {
    id: "netlify-cli",
    description: "Netlify CLI (npm -g)",
    category: "backend",
    source: "netlify",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm-global", pkg: "netlify-cli" },
  },
  {
    id: "supabase-cli",
    description: "Supabase CLI (npm -g) — 'supabase login' 첫 실행 후 OAuth 필요",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm-global", pkg: "supabase" },
  },

  // === UI tracks (csr-*|ssr-*|full) ===
  {
    id: "impeccable",
    description: "Impeccable UI design skill (pbakaus)",
    category: "frontend",
    source: "pbakaus",
    condition: { kind: "any-track", tracks: ALL_CSR_SSR_FULL },
    method: { kind: "skill", source: "pbakaus/impeccable" },
  },

  // === dev tools (has_dev_track) ===
  {
    id: "playwright-skill",
    description: "Playwright skill (testdino-hq)",
    category: "dev-tools",
    source: "testdino-hq",
    condition: { kind: "has-dev-track" },
    method: { kind: "skill", source: "testdino-hq/playwright-skill" },
  },
  {
    id: "find-skills",
    description: "find-skills (vercel-labs) — Skill 검색",
    category: "dev-tools",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "skill", source: "vercel-labs/skills", skill: "find-skills" },
  },
  {
    id: "agent-browser",
    description: "agent-browser (npm -g) — Playwright 래퍼",
    category: "dev-tools",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "npm-global", pkg: "agent-browser" },
  },
  {
    id: "architecture-decision-record",
    description: "ADR skill (orchestkit)",
    category: "dev-tools",
    source: "yonatangross",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "skill",
      source: "yonatangross/orchestkit",
      skill: "architecture-decision-record",
    },
  },

  // === Supabase agent-skills (csr-supabase|full) ===
  {
    id: "supabase-agent-skills",
    description: "Supabase agent-skills",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: {
      kind: "plugin",
      marketplace: "supabase/agent-skills",
      pluginId: "supabase@supabase-agent-skills",
    },
  },
  {
    id: "postgres-best-practices",
    description: "postgres-best-practices (Supabase 마켓 plugin)",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: {
      kind: "plugin",
      marketplace: "supabase/agent-skills",
      pluginId: "postgres-best-practices@supabase-agent-skills",
    },
  },

  // === React + Next UI tracks ===
  // v0.6.3 — vercel-labs/agent-skills source는 short form 안 됨. full HTTPS URL 필요.
  // 사용자 확인 형식: `npx skills add https://github.com/vercel-labs/agent-skills --skill <name>`.
  {
    id: "react-best-practices",
    description: "vercel-react-best-practices (vercel-labs/agent-skills)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      // v0.6.5 — skills.sh registry name. GitHub dir 이름(react-best-practices)과 다름.
      // skills.sh: 대부분 vercel- prefix (web-design-guidelines, deploy-to-vercel만 예외).
      skill: "vercel-react-best-practices",
    },
  },
  {
    id: "shadcn-ui",
    description: "shadcn/ui skill",
    category: "frontend",
    source: "shadcn-ui",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    method: { kind: "skill", source: "shadcn/ui" },
  },
  {
    id: "web-design-guidelines",
    description: "web-design-guidelines (vercel-labs/agent-skills)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      skill: "web-design-guidelines",
    },
  },
  {
    id: "next-skills",
    description: "next-skills (vercel-labs)",
    category: "backend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: ["ssr-nextjs", "full"] },
    method: { kind: "skill", source: "vercel-labs/next-skills" },
  },

  // === Executive tracks ===
  {
    id: "anthropic-document-skills",
    description: "Anthropic document-skills (pptx/docx/xlsx/pdf)",
    category: "business",
    source: "anthropics",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "anthropics/skills",
      pluginId: "document-skills@anthropic-agent-skills",
    },
  },
  // alirezarezvani/claude-skills marketplace (v2.3.0) — 2026-04-25 통합 갱신.
  // 기존 alirezarezvani/c-level-skills + alirezarezvani/finance-skills 별도 marketplace
  // → 통합된 alirezarezvani/claude-skills marketplace (claude-code-skills 이름)로 이동.
  {
    id: "c-level-skills",
    description: "c-level-skills (claude-code-skills, 28 advisory)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "c-level-skills@claude-code-skills",
    },
  },
  {
    id: "business-growth-skills",
    description: "business-growth-skills (4 — customer success, sales eng, revops, contract)",
    category: "business",
    source: "alirezarezvani",
    // v0.5.0 — growth-marketing Track에서도 재사용. 합집합 조건.
    condition: { kind: "any-track", tracks: ["executive", "full", "growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "business-growth-skills@claude-code-skills",
    },
  },
  {
    id: "finance-skills",
    description: "finance-skills (3 — financial analyst, SaaS metrics, investment advisor)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "finance-skills@claude-code-skills",
    },
  },

  // === Project Management Track (v0.5.0) ===
  // SPEC docs/specs/new-tracks-pm-growth.md §3.5 — pm-skills 4/4.
  {
    id: "pm-skills",
    description:
      "pm-skills (6 — senior PM, scrum master, Jira/Confluence/Atlassian admin, template creator)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["project-management"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "pm-skills@claude-code-skills",
    },
  },
  // SPEC §3.5 — product-skills: has-dev-track + project-management 합집합 (executive/growth-marketing 제외).
  // v0.8.1 — DEV_PLUS_PM_TRACKS 상수로 SSOT 통일 (reviewer MEDIUM-3 fix).
  {
    id: "product-skills",
    description: "product-skills (15 — RICE, PRD, agile PO, UX research, SaaS scaffolder ...)",
    category: "dev-tools",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: [...DEV_PLUS_PM_TRACKS] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "product-skills@claude-code-skills",
    },
  },

  // === Growth Marketing Track (v0.5.0) ===
  // SPEC docs/specs/new-tracks-pm-growth.md §3.5 — 4 entries 모두 4/4.
  {
    id: "marketing-skills",
    description:
      "marketing-skills (44 — content/SEO/CRO/channels/growth/intelligence/sales/twitter)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "marketing-skills@claude-code-skills",
    },
  },
  {
    id: "content-creator",
    description: "content-creator (SEO content + brand voice + frameworks)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "content-creator@claude-code-skills",
    },
  },
  {
    id: "demand-gen",
    description: "demand-gen (multi-channel demand gen + paid media + partnership)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "demand-gen@claude-code-skills",
    },
  },
  {
    id: "research-summarizer",
    description: "research-summarizer (시장 조사 요약)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "research-summarizer@claude-code-skills",
    },
  },

  // === Code-quality enforcement (has-dev-track, v0.5.0) ===
  // SPEC §3.5 — karpathy-coder 4/4. CLAUDE.md P1-P4 선언적 원칙의 검출 도구 layer.
  // 4 Python tools (stdlib only) + reviewer agent + /karpathy-check + pre-commit hook.
  {
    id: "karpathy-coder",
    description:
      "karpathy-coder (4 Python tool + reviewer agent + /karpathy-check + pre-commit hook)",
    category: "dev-tools",
    source: "alirezarezvani",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "karpathy-coder@claude-code-skills",
    },
  },

  // === Option-gated ===
  {
    id: "gsd-orchestrator",
    description: "GSD orchestrator (npx get-shit-done-cc@latest)",
    category: "workflow",
    source: "get-shit-done-cc",
    condition: { kind: "option", flag: "withGsd" },
    method: { kind: "npx-run", cmd: "get-shit-done-cc@latest" },
  },
  {
    // v26.39.2 fix — marketplace name = "trailofbits" (NOT "trailofbits-skills") +
    // "trailofbits-skills" plugin 자체가 존재하지 않음. marketplace 안에 14+ 개별 plugin.
    // 단일 대표 plugin = `differential-review` (코드 변경 보안 리뷰, 가장 보편).
    // 추가 plugin 원하는 사용자는: `claude plugin install <name>@trailofbits` (예: audit-context-building)
    id: "trailofbits-skills",
    description: "Trail of Bits differential-review plugin (security-focused code review)",
    category: "dev-tools",
    source: "trailofbits",
    condition: { kind: "option", flag: "withTob" },
    method: {
      kind: "plugin",
      marketplace: "trailofbits/skills",
      pluginId: "differential-review@trailofbits",
    },
  },
  {
    id: "ecc-plugin",
    description: "ECC (everything-claude-code) 마켓플레이스 + plugin install",
    category: "ecc-suite",
    source: "affaan-m",
    condition: { kind: "option", flag: "withEcc" },
    method: {
      kind: "plugin",
      marketplace: "affaan-m/everything-claude-code",
      pluginId: "everything-claude-code@everything-claude-code",
    },
  },
  {
    id: "ecc-prune",
    description: "ECC prune (89 KEEP 외 제거 → .claude/local-plugins/ecc/로 복사)",
    category: "ecc-suite",
    source: "uzys",
    condition: { kind: "option", flag: "withPrune" },
    method: {
      kind: "shell-script",
      script: "scripts/prune-ecc.sh",
      args: ["--apply", "--force"],
    },
  },
];

/**
 * v26.47.0 — User override of preset/option condition (Phase C full, SPEC §3.1).
 * - `forceInclude`: condition 무관 강제 포함 (사용자가 명시 추가)
 * - `forceExclude`: condition 무관 강제 제외 (사용자가 추천 ✓ 풀음)
 *
 * 우선순위: `forceExclude` > `forceInclude` > `condition`.
 */
export interface UserOverride {
  forceInclude: ReadonlyArray<string>;
  forceExclude: ReadonlyArray<string>;
}

export const EMPTY_USER_OVERRIDE: UserOverride = {
  forceInclude: [],
  forceExclude: [],
};

/**
 * 조건 평가 — 주어진 spec(tracks + options + userOverride)에서 자산이 설치 대상인지 판정.
 */
export function shouldInstallAsset(
  asset: ExternalAsset,
  ctx: {
    tracks: ReadonlyArray<Track>;
    options: OptionFlags;
    userOverride?: UserOverride;
  },
): boolean {
  // v26.47.0 — userOverride 우선순위: forceExclude > forceInclude > condition.
  if (ctx.userOverride?.forceExclude.includes(asset.id)) return false;
  if (ctx.userOverride?.forceInclude.includes(asset.id)) return true;
  const cond = asset.condition;
  switch (cond.kind) {
    case "any-track":
      return ctx.tracks.some((t) => cond.tracks.includes(t));
    case "has-dev-track":
      // SSOT — track-match.ts hasDevTrack(): csr-*|ssr-*|data|full|tooling (= DEV_TRACKS).
      // EXECUTIVE_STYLE_TRACKS (executive + project-management + growth-marketing) 는 제외.
      return hasDevTrack(ctx.tracks);
    case "option":
      return ctx.options[cond.flag] === true;
  }
}

/**
 * spec에 적용 가능한 자산 필터.
 */
export function filterApplicableAssets(
  assets: ReadonlyArray<ExternalAsset>,
  ctx: {
    tracks: ReadonlyArray<Track>;
    options: OptionFlags;
    userOverride?: UserOverride;
  },
): ReadonlyArray<ExternalAsset> {
  return assets.filter((a) => shouldInstallAsset(a, ctx));
}

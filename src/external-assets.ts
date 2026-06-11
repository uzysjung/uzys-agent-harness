/**
 * External asset matrix — bash setup-harness.sh L791~1067 등가 데이터.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F3
 * Source: setup-harness.sh@911c246~1 (v27.18 직전, bash cutover 전)
 *
 * Track 또는 옵션 조건이 충족되면 install pipeline에서 method를 호출.
 * 실패는 "warn-skip" — 종료 시 누락 자산 보고 (OQ1 결정).
 *
 * code-style 800줄 cap 예외: 본 파일은 ~85% 가 큐레이션 자산 카탈로그(41 entry × ~13줄)
 *   = 데이터. 로직(interface·condition 평가·shouldInstallAsset)은 소량. 데이터/로직 분리는
 *   별도 사이클(Phase R) 후보 — 현재는 카탈로그 단일 SSOT 가독성 우선. (v26.79.0 기준 802줄)
 */

import type { Category, Source } from "./categories.js";
import { hasDevTrack } from "./track-match.js";
import type { OptionFlags, Track } from "./types.js";

export type ExternalAssetMethod =
  /** `npx skills add <source>[ --skill <name>] --yes` */
  | { kind: "skill"; source: string; skill?: string }
  /** `claude plugin marketplace add <marketplace>` + `claude plugin install <pluginId>` */
  | { kind: "plugin"; marketplace: string; pluginId: string }
  /**
   * `npm install --save-dev <pkg>@<version>` (global scope 시 `-g`).
   * v26.80.0 — `version` 필수 (pinning). vetting 은 시점 검증인데 unpinned 는 미래 코드
   * 실행 = hijacked vetted repo 직행 구멍 (ADR-021 "지속 검증" 주장과 모순). pkg 는 bare
   * 이름 유지 (detectVersion 이 `<npm root>/<pkg>/package.json` 경로로 사용). bump 정책:
   * A2 자산 audit 주기에 Docker 검증 후 갱신 (docs/COMPATIBILITY.md §pinning).
   */
  | { kind: "npm"; pkg: string; version: string }
  /** `npx <cmd>@<version> [args...]` — fire-and-forget 실행. v26.80.0 — version 필수 (위와 동일 근거). */
  | { kind: "npx-run"; cmd: string; version: string; args?: string[] }
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
  /**
   * v26.79.0 — 검증 Trust Tier. 자산 entry 의 **필수 필드** (SSOT). 이전엔 별도 `TRUST_TIER`
   * Record 였으나 누락(컴파일러 미검출) + stale(좀비 키, v26.76.0 content-creator 제거 전례)
   * drift 가 가능했음 → entry 에 통합: **누락은 컴파일 에러, stale 은 구조적 불가능**.
   * `TRUST_TIER` / `assetTrustTier` 는 이 필드에서 derive (EXTERNAL_ASSETS 정의 뒤).
   * star snapshot(2026-05~06)은 각 entry tier 라인 주석. 실 drift 판정은 trust-tier-drift 가 live fetch.
   */
  tier: TrustTier;
}

/**
 * v26.71.0 (PRD v26-71) — 검증 Trust Tier. North Star 세 기둥 ②.
 *   - official: Anthropic 공식 marketplace + 본 하네스 자체.
 *   - vetted: star ≥ 1000 + 활성 유지보수 (D2; 라이선스 미표기/비-OSI 는 출처 신뢰).
 *   - experimental: star < 1000 — opt-in + 경고 (pre-check 제외).
 */
export type TrustTier = "official" | "vetted" | "experimental";

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
 * 41 외부 자산 매트릭스 (v26.78.0 Understanding 3종 추가). bash setup-harness.sh@911c246~1 L791~1067 + 1320~1370 동등.
 *
 * 호출 순서: data → dev-baseline → railway → supabase-cli → impeccable → dev-tools →
 * supabase-skills → react/ui → next → executive → GSD → ToB → ECC.
 */
export const EXTERNAL_ASSETS: ReadonlyArray<ExternalAsset> = [
  // === data Track ===
  {
    id: "polars-K-Dense",
    tier: "vetted", // K-Dense-AI 26k
    description: "Polars — fast Rust-based DataFrame (pandas alternative, data track)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "polars" },
    // v26.56.0 — description 보강: 트랙 hint + 한 줄 의미
  },
  {
    id: "dask-K-Dense",
    tier: "vetted", // K-Dense-AI 26k
    description: "Dask — distributed processing (large DataFrames · cluster, data track)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "dask" },
  },
  {
    id: "python-resource-management",
    tier: "vetted", // wshobson/agents 36k
    description: "Python memory · CPU management patterns (wshobson, data track)",
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
    tier: "vetted", // wshobson/agents 36k
    description: "Python performance optimization (profiling · vectorize, wshobson, data track)",
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
    tier: "official", // anthropics/knowledge-work-plugins 18k
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
    tier: "vetted", // addyosmani 47k
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
    tier: "official", // anthropics/claude-plugins-official 공식 배포 (소스 obra 213k)
    // 저자 = obra (190k★ github.com/obra/superpowers). 호스팅 = Anthropic 공식
    // marketplace github.com/anthropics/claude-plugins-official ("Official,
    // Anthropic-managed directory of high quality Claude Code Plugins").
    // source/marketplace 분리는 의도적 — source=저자, marketplace=registry.
    description: "Superpowers — agentic skills framework (obra, Anthropic official marketplace)",
    category: "workflow",
    source: "obra",
    condition: { kind: "option", flag: "withSuperpowers" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "superpowers@claude-plugins-official",
    },
  },
  {
    // v26.75.0 (ADR-021) — wshobson/agents marketplace.json name = "claude-code-workflows"
    // (84 plugins). 대표 = full-stack-orchestration. 다른 orchestrator(agent-orchestration/
    // tdd-workflows/ship-mate 등): `claude plugin install <name>@claude-code-workflows`.
    id: "wshobson-agents",
    tier: "vetted", // wshobson/agents 36k
    description: "wshobson agents — multi-agent orchestration workflows (full-stack/tdd/review)",
    category: "workflow",
    source: "wshobson",
    condition: { kind: "option", flag: "withWshobsonAgents" },
    method: {
      kind: "plugin",
      marketplace: "wshobson/agents",
      pluginId: "full-stack-orchestration@claude-code-workflows",
    },
  },
  {
    // v26.75.0 (ADR-021) — `npm i --save-dev @fission-ai/openspec` 후 `openspec init` 로 슬래시 주입.
    id: "openspec",
    tier: "vetted", // Fission-AI/OpenSpec 53k
    description: "OpenSpec — spec-driven brownfield delta workflow (propose → apply → archive)",
    category: "workflow",
    source: "fission-ai",
    condition: { kind: "option", flag: "withOpenspec" },
    method: { kind: "npm", pkg: "@fission-ai/openspec", version: "1.4.1" },
  },
  {
    // v26.75.0 (ADR-021) — 비대화형 install. v26.75.1: `--directory .` 누락 시 "Installation
    // directory" 프롬프트에서 hang (Docker realcli 검출). cwd(=project) 기준 `.` 지정으로 봉합.
    id: "bmad-method",
    tier: "vetted", // bmad-code-org/BMAD-METHOD 48k
    description: "BMAD-METHOD — multi-agent agile workflow (PM/Architect/Dev, 12+ agents)",
    category: "workflow",
    source: "bmad-code-org",
    condition: { kind: "option", flag: "withBmad" },
    method: {
      kind: "npx-run",
      cmd: "bmad-method",
      version: "6.8.0",
      args: ["install", "--directory", ".", "--tools", "claude-code", "--yes"],
    },
  },

  // === Railway (csr-fastify|csr-fastapi|ssr-*|full) ===
  // v0.6.3 — railway-plugin entry 제거. railwayapp/railway-plugin repo 자체 존재 안 함
  // (404 Not Found). 공식 docs (https://docs.railway.com/ai/claude-code-plugin) 형식은
  // marketplace add `railwayapp/railway-skills` + plugin install `railway@railway-skills`만.
  // → 아래 railway-skills entry로 단일화.
  {
    id: "railway-skills",
    tier: "experimental", // railwayapp/railway-skills 268
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
    tier: "vetted", // vercel/vercel 15k
    description: "Vercel CLI (npm)",
    category: "backend",
    source: "vercel",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "vercel", version: "54.11.1" },
  },
  {
    id: "netlify-cli",
    tier: "vetted", // netlify/cli 1.9k
    description: "Netlify CLI (npm)",
    category: "backend",
    source: "netlify",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "netlify-cli", version: "26.1.0" },
  },
  {
    id: "supabase-cli",
    tier: "vetted", // supabase 103k
    description: "Supabase CLI (npm) — first 'supabase login' requires OAuth",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "supabase", version: "2.105.0" },
  },

  // === UI tracks (csr-*|ssr-*|full) ===
  {
    id: "impeccable",
    tier: "vetted", // pbakaus 31k
    description:
      "Impeccable — UI design guide + visual consistency review (pbakaus, single-skill repo)",
    category: "frontend",
    source: "pbakaus",
    condition: { kind: "any-track", tracks: ALL_CSR_SSR_FULL },
    // v26.54.1 — skills cli 1.5.7 부터 `--skill <name>` 명시 필수 (single-skill repo 도)
    method: { kind: "skill", source: "pbakaus/impeccable", skill: "impeccable" },
  },

  // === dev tools (has_dev_track) ===
  {
    id: "playwright-skill",
    tier: "experimental", // testdino-hq/playwright-skill 264
    description: "Playwright — browser automation E2E test authoring guide (testdino-hq)",
    category: "dev-tools",
    source: "testdino-hq",
    condition: { kind: "has-dev-track" },
    // v26.54.1 — skills cli 1.5.7 부터 `--skill <name>` 명시 필수
    method: {
      kind: "skill",
      source: "testdino-hq/playwright-skill",
      skill: "playwright-skill",
    },
  },
  {
    id: "find-skills",
    tier: "vetted", // vercel-labs/skills 20k (license none — 출처 신뢰)
    description: "find-skills — search · rank all installed skills (vercel-labs, all dev tracks)",
    category: "dev-tools",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "skill", source: "vercel-labs/skills", skill: "find-skills" },
  },
  {
    id: "agent-browser",
    tier: "vetted", // vercel-labs/agent-browser 34k
    description:
      "agent-browser — agent-friendly Playwright wrapper (screenshot · DOM search CLI, dev tracks)",
    // v26.78.0 — Understanding 으로 재분류: 웹 지각(screenshot·DOM). 영상/코드 지각과 같은 축.
    category: "understanding",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "npm", pkg: "agent-browser", version: "0.27.2" },
  },
  // v26.78.0 — Understanding 신규 3종 (plugin, opt-in). 에이전트 인지 증강: 영상·코드 지각 + 메모리.
  {
    id: "claude-video",
    tier: "vetted", // bradautomates/claude-video 1.8k
    description:
      "Claude Video — /watch downloads any video, extracts frames + transcript so Claude can see + hear it (yt-dlp/ffmpeg auto on first run)",
    category: "understanding",
    source: "bradautomates",
    condition: { kind: "option", flag: "withClaudeVideo" },
    method: {
      kind: "plugin",
      marketplace: "bradautomates/claude-video",
      pluginId: "watch@claude-video",
    },
  },
  {
    id: "understand-anything",
    tier: "vetted", // Lum1104/Understand-Anything 53k
    description:
      "Understand Anything — multi-agent pipeline builds an interactive knowledge graph of your codebase (files/functions/deps) to explore + query",
    category: "understanding",
    source: "Lum1104",
    condition: { kind: "option", flag: "withUnderstandAnything" },
    method: {
      kind: "plugin",
      marketplace: "Lum1104/Understand-Anything",
      pluginId: "understand-anything@understand-anything",
    },
  },
  {
    id: "agentmemory",
    tier: "vetted", // rohitg00/agentmemory 21k
    description:
      "AgentMemory — persistent memory runtime; plugin auto-wires MCP (53 tools) + hooks + skills. Runtime server: npx @agentmemory/agentmemory",
    category: "understanding",
    source: "rohitg00",
    condition: { kind: "option", flag: "withAgentmemory" },
    method: {
      kind: "plugin",
      marketplace: "rohitg00/agentmemory",
      pluginId: "agentmemory@agentmemory",
    },
  },
  {
    id: "architecture-decision-record",
    tier: "experimental", // yonatangross/orchestkit 179
    description:
      "ADR — Architecture Decision Record template + status flow (orchestkit, one of 80+ skills)",
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
    tier: "vetted", // supabase/agent-skills 2.2k
    description:
      "Supabase — RLS · auth · edge function · realtime guide (csr-supabase · full tracks)",
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
    tier: "vetted", // supabase/agent-skills 2.2k
    description:
      "Postgres best practices — schema · index · query patterns (csr-supabase · full tracks)",
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
    tier: "vetted", // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
    description:
      "React best practices — Vercel's hook · perf · component patterns (CSR · SSR · Next tracks)",
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
    tier: "vetted", // shadcn-ui/ui 115k
    description: "shadcn/ui — Radix-based React component copy + Tailwind theme (shadcn official)",
    category: "frontend",
    source: "shadcn-ui",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    // v26.54.1 — shadcn/ui repo 의 실제 skill 이름은 `shadcn` (자산 id 와 다름).
    method: { kind: "skill", source: "shadcn/ui", skill: "shadcn" },
  },
  {
    id: "web-design-guidelines",
    tier: "vetted", // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
    description:
      "Web design guidelines — Vercel's visual hierarchy · color · spacing (CSR · SSR · Next tracks)",
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
    tier: "experimental", // vercel-labs/next-skills 895
    description:
      "Next-skills — Next.js App Router · Server Action patterns (ssr-nextjs · full tracks)",
    category: "backend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: ["ssr-nextjs", "full"] },
    method: { kind: "skill", source: "vercel-labs/next-skills" },
  },

  // === Executive tracks ===
  {
    id: "anthropic-document-skills",
    tier: "official", // anthropics/skills 144k
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
    tier: "vetted", // alirezarezvani 16k
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
    tier: "vetted", // alirezarezvani 16k
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
    tier: "vetted", // alirezarezvani 16k
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
    tier: "vetted", // alirezarezvani 16k
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
    tier: "vetted", // alirezarezvani 16k
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
    tier: "vetted", // alirezarezvani 16k
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
  // v26.76.0 — content-creator / demand-gen 제거: alirezarezvani/claude-skills marketplace.json 에
  // 해당 plugin 부재(Docker 실설치 검출, exit 1). 거짓 광고 0건 원칙(Promise=Implementation).
  // growth-marketing 트랙은 business-growth-skills + marketing-skills + research-summarizer 유지.
  {
    id: "research-summarizer",
    tier: "vetted", // alirezarezvani 16k
    description: "research-summarizer (market research summarization)",
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
    tier: "vetted", // alirezarezvani 16k
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
    tier: "vetted", // gsd-build/get-shit-done 63k
    description: "GSD orchestrator (npx get-shit-done-cc)",
    category: "workflow",
    source: "get-shit-done-cc",
    condition: { kind: "option", flag: "withGsd" },
    method: { kind: "npx-run", cmd: "get-shit-done-cc", version: "1.42.3" },
  },
  {
    // v26.39.2 fix — marketplace name = "trailofbits" (NOT "trailofbits-skills") +
    // "trailofbits-skills" plugin 자체가 존재하지 않음. marketplace 안에 14+ 개별 plugin.
    // 단일 대표 plugin = `differential-review` (코드 변경 보안 리뷰, 가장 보편).
    // 추가 plugin 원하는 사용자는: `claude plugin install <name>@trailofbits` (예: audit-context-building)
    id: "trailofbits-skills",
    tier: "vetted", // trailofbits/skills 5.5k (CC-BY-SA — 출처 신뢰)
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
    tier: "vetted", // affaan-m/everything-claude-code 199k
    description: "ECC — 60 agents · 230 skills · 75 commands. Affaan's hackathon package",
    category: "ecc-suite",
    source: "affaan-m",
    condition: { kind: "option", flag: "withEcc" },
    // v26.54.1 — upstream marketplace.json 의 name 은 "ecc" (plugin name 도 "ecc").
    // 기존 매핑 `everything-claude-code@everything-claude-code` 는 marketplace 가
    // 그 이름으로 등록되던 옛 버전 기준. fresh install 에서는 "Plugin not found" 발생.
    method: {
      kind: "plugin",
      marketplace: "affaan-m/everything-claude-code",
      pluginId: "ecc@ecc",
    },
  },
  {
    id: "ecc-prune",
    tier: "official", // uzys 본 하네스 자체
    description:
      "ECC prune (drop items beyond curated 89 KEEP → copy to .claude/local-plugins/ecc/)",
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
 * v26.79.0 — `TRUST_TIER` 는 EXTERNAL_ASSETS.tier 에서 derive (단일 출처). 별도 Record 유지 시
 * 누락/stale drift 가능 → 제거. 기존 소비자(prompts.ts·gen-compatibility·trust-tier-drift)는
 * 이 derived map 을 그대로 import. id 키는 각 자산 id 와 1:1 (자산 추가 시 자동 반영).
 */
export const TRUST_TIER: Record<string, TrustTier> = Object.fromEntries(
  EXTERNAL_ASSETS.map((a) => [a.id, a.tier]),
);

/** 자산의 검증 tier. 미분류(catalog 외 id)는 보수적으로 experimental. */
export function assetTrustTier(assetId: string): TrustTier {
  return TRUST_TIER[assetId] ?? "experimental";
}

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
  // v26.71.1 — experimental(T3) opt-in only (PRD v26-71 R6/AC4). condition 매치만으론 미설치.
  //   --with <id> (forceInclude) 또는 interactive 체크(→forceInclude) 시에만 설치 — 선택권 유지(강제 차단 아님).
  //   v26.71.0 은 recommendedExternalAssets(pre-check)에만 제외 적용 → 비대화형/미체크 install 경로 누락 버그 fix.
  //   게이트는 명시 분류(TRUST_TIER[id])만 본다 — assetTrustTier()의 unknown→experimental default 는
  //   DISPLAY(경고 배지)용이며 설치 게이트엔 미적용. 실 자산 전부 매핑은 "no-missing" 테스트가 강제(AC1).
  if (TRUST_TIER[asset.id] === "experimental") return false;
  return matchesCondition(asset, ctx);
}

/**
 * Track/option condition 매치만 평가 (tier·override 무관). shouldInstallAsset 의 조건절 +
 * experimentalOptInCandidates 의 "조건은 맞지만 T3" 판정에서 공유 (SSOT).
 */
function matchesCondition(
  asset: ExternalAsset,
  ctx: { tracks: ReadonlyArray<Track>; options: OptionFlags },
): boolean {
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
 * v26.71.1 — track/option condition 은 매치하지만 T3(experimental)라서 default 설치에서 제외된 자산.
 * forceInclude(--with / interactive 체크)된 것은 이미 설치되므로 제외. 비대화형 install 의
 * discoverability 힌트용 (Transparent Defaults — 숨김 0건. --with 로 opt-in 가능함을 사용자에게 알림).
 */
export function experimentalOptInCandidates(ctx: {
  tracks: ReadonlyArray<Track>;
  options: OptionFlags;
  userOverride?: UserOverride;
}): ReadonlyArray<ExternalAsset> {
  return EXTERNAL_ASSETS.filter(
    (a) =>
      TRUST_TIER[a.id] === "experimental" &&
      !ctx.userOverride?.forceInclude.includes(a.id) &&
      matchesCondition(a, ctx),
  );
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

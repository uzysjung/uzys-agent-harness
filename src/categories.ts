/**
 * Category-based installer (v26.43.0) — 분야별 대표 스킬 큐레이션.
 *
 * 7 카테고리: Frontend / Backend / Data / Business / Dev Tools / Workflow / ECC Suite.
 * 각 카테고리 안에서 자산은 (출처, ExternalAsset.id) 로 식별. Step 2 UI 그룹화 기준.
 *
 * Source labels = 정확한 GitHub org/user (Phase A의 SSOT).
 * `[3rd-party]` 같은 generic 라벨 금지 (SPEC R6).
 */

export const CATEGORIES = [
  "frontend",
  "backend",
  "data",
  "business",
  "dev-tools",
  "workflow",
  "ecc-suite",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TITLES: Record<Category, string> = {
  frontend: "🎨 Frontend (UI · Design)",
  backend: "🗄️  Backend (API · DB · Deploy)",
  data: "📊 Data",
  business: "💼 Business (Documents)",
  "dev-tools": "🛡️  Dev Tools (Security · Quality)",
  workflow: "🔄 Workflow (Development Cycle)",
  "ecc-suite": "📦 ECC Suite",
};

/** Source labels — GitHub org/user. Maps the canonical owner shown to the user. */
export const SOURCE_LABELS = {
  anthropics: "anthropics",
  "vercel-labs": "vercel-labs",
  "shadcn-ui": "shadcn/ui",
  vercel: "vercel",
  netlify: "netlify",
  supabase: "supabase",
  railwayapp: "railwayapp",
  trailofbits: "trailofbits",
  obra: "obra",
  addyosmani: "addyosmani",
  pbakaus: "pbakaus",
  "K-Dense-AI": "K-Dense-AI",
  wshobson: "wshobson",
  "testdino-hq": "testdino-hq",
  yonatangross: "yonatangross",
  alirezarezvani: "alirezarezvani",
  "affaan-m": "affaan-m",
  "get-shit-done-cc": "get-shit-done-cc",
  uzys: "this project",
} as const;
export type Source = keyof typeof SOURCE_LABELS;

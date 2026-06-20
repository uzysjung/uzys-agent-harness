/**
 * Category-based installer (v26.43.0) — 분야별 대표 스킬 큐레이션.
 *
 * 9 카테고리: Frontend / Backend / Data / Business / Dev Tools / Understanding / Visual & Media / Workflow / ECC Suite.
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
  "understanding",
  "visual-media",
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
  // v26.78.0 — 에이전트 인지 증강: 환경에 대한 지각(영상·웹·코드) + 기억(memory).
  understanding: "🧠 Understanding (Perception · Memory)",
  // v26.85.0 — 코드-퍼스트 비주얼/미디어 제작: 슬라이드·다이어그램·모션·동영상.
  "visual-media": "🎬 Visual & Media (Slides · Diagrams · Motion · Video)",
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
  "fission-ai": "Fission-AI",
  "bmad-code-org": "bmad-code-org",
  // v26.78.0 — Understanding 카테고리 신규 출처
  bradautomates: "bradautomates",
  Lum1104: "Lum1104",
  rohitg00: "rohitg00",
  // v26.85.0 — Visual & Media 카테고리 출처 (Docker 실설치 검증 PASS).
  zarazhangrui: "zarazhangrui",
  greensock: "greensock",
  softaworks: "softaworks",
  "remotion-dev": "remotion-dev",
  // v26.86.0 — Visual & Media 프레젠테이션 4종 (Issue #176, Docker 실설치 4/4 PASS).
  hugohe3: "hugohe3",
  bytedance: "bytedance",
  ConardLi: "ConardLi",
  ryanbbrown: "ryanbbrown",
  uzys: "this project",
} as const;
export type Source = keyof typeof SOURCE_LABELS;

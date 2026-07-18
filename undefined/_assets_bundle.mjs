// src/track-match.ts
function matchTrack(track, pattern) {
  return pattern.split("|").some((p) => globToRegex(p.trim()).test(track));
}
function anyTrack(tracks, pattern) {
  return tracks.some((t) => matchTrack(t, pattern));
}
function hasDevTrack(tracks) {
  return anyTrack(tracks, "csr-*|ssr-*|data|full|tooling");
}
function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

// src/types.ts
var CLI_BASES = ["claude", "codex", "opencode", "antigravity"];

// src/external-assets.ts
var CSR_SSR_NEXTJS_FULL = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-nextjs",
  "full"
];
var RAILWAY_TRACKS = ["csr-fastify", "csr-fastapi", "ssr-htmx", "ssr-nextjs", "full"];
var EXECUTIVE_STYLE_TRACKS = [
  "executive",
  "project-management",
  "growth-marketing"
];
var DEV_TRACKS = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-htmx",
  "ssr-nextjs",
  "data",
  "tooling",
  "full"
];
var EXTERNAL_ASSETS = [
  // === data Track ===
  {
    id: "polars-K-Dense",
    tier: "vetted",
    // K-Dense-AI 26k
    description: "Polars \u2014 fast Rust-based DataFrame (pandas alternative, data track)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "polars" }
    // v26.56.0 — description 보강: 트랙 hint + 한 줄 의미
  },
  {
    id: "dask-K-Dense",
    tier: "vetted",
    // K-Dense-AI 26k
    description: "Dask \u2014 distributed processing (large DataFrames \xB7 cluster, data track)",
    category: "data",
    source: "K-Dense-AI",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: { kind: "skill", source: "K-Dense-AI/scientific-agent-skills", skill: "dask" }
  },
  {
    // v26.106.0 (ADR-035, 사용자 승인 A): 일반 Python 패턴 = 순수 pattern-guide → opt-in 강등 (T2 가설 전제).
    id: "python-resource-management",
    tier: "vetted",
    // wshobson/agents 36k
    description: "Python memory \xB7 CPU management patterns (wshobson, data track)",
    category: "data",
    source: "wshobson",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/wshobson/agents",
      skill: "python-resource-management"
    }
  },
  {
    // v26.106.0 (ADR-035, 사용자 승인 A): 동일 — 순수 pattern-guide → opt-in 강등.
    id: "python-performance-optimization",
    tier: "vetted",
    // wshobson/agents 36k
    description: "Python performance optimization (profiling \xB7 vectorize, wshobson, data track)",
    category: "data",
    source: "wshobson",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/wshobson/agents",
      skill: "python-performance-optimization"
    }
  },
  {
    id: "anthropic-data-plugin",
    tier: "official",
    // anthropics/knowledge-work-plugins 18k
    description: "Anthropic data plugin (visualization, SQL exploration)",
    category: "data",
    source: "anthropics",
    condition: { kind: "any-track", tracks: ["data", "full"] },
    method: {
      kind: "plugin",
      marketplace: "anthropics/knowledge-work-plugins",
      pluginId: "data@knowledge-work-plugins"
    }
  },
  // === Internal template assets (v26.81.0, ADR-022 — 이전 OptionFlags.withTauri/withUzysHarness) ===
  {
    id: "tauri-desktop",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Tauri desktop rule template (CSR/full tracks \u2014 manifest rule mapping)",
    category: "frontend",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "tauri-desktop" }
  },
  // === Dev-method skills (uzys 1st-party, v26.87.0) ===
  // 본 하네스의 작업 방법론 skill 8종 (repo-bundled templates). tier official, core on dev tracks
  // (has-dev-track → 기본 설치; wizard uncheck / --without <id> 로 제외 가능 — isAssetSelected 게이팅).
  {
    id: "multi-persona-review",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Multi-persona review \u2014 critique one artifact via 3-5 parallel user personas, then synthesize P0/P1/P2 fixes",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "multi-persona-review" }
  },
  {
    id: "gap-analysis-e2e",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Gap analysis E2E \u2014 detect north-star / correctness / UX gaps, then benchmark how reference services solved each",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "gap-analysis-e2e" }
  },
  {
    id: "ultracode-service-audit",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Ultracode service audit \u2014 multi-agent, adversarially-verified full-service audit across 7 dimensions \u2192 milestone roadmap",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "ultracode-service-audit" }
  },
  {
    id: "asis-tobe-decision",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "ASIS\u2192TOBE decision \u2014 present an A-or-B / approval moment as context \u2192 recommendation \u2192 option table \u2192 AS-IS/TO-BE contrast",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "asis-tobe-decision" }
  },
  {
    id: "compaction-handoff",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Compaction handoff \u2014 persist durable state + git snapshot + resume anchor before a context /compact so nothing is lost",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "compaction-handoff" }
  },
  {
    id: "northstar-roadmap",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "North-star roadmap \u2014 measure current state vs the vision doc, then propose a ranked feature backlog persisted to docs/plans + memory",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "northstar-roadmap" }
  },
  // v26.98.0 — 하네스 건강 감사 (ADR-027). 어제(2026-07-14) 3개 프로젝트 교차 하네스 교정
  //   작업에서 추출한 방법론 + 리서치 근거(context rot·lost-in-the-middle·skill undertriggering·
  //   Ratchet). 기존 5분류(드리프트=정확성만)에서 3질문(A truth / B efficacy / C economy)으로
  //   재설계 — "맞는 말인데 아무것도 안 일어나는" 하네스와 "다 맞는데 너무 길어 안 지켜지는"
  //   하네스를 잡는다. 결정적 경계: 결정론적 린터(AgentLint/cclint)가 할 수 있는 form 검사는
  //   위임하고, 린터가 구조적으로 못 하는 판단(이 단언이 이 repo 의 진짜 스택인가 / 이 훅이
  //   실제로 fire 하는가 / 이 스킬이 트리거되는가)만 모델이 한다 (CLAUDE.md Rule 5 정합).
  // v26.101.0 — 안전(SAFE) 4번째 축 신설 (ADR-030): ADR-027 (z) 알려진 갭 해소. D1 위험 활성
  //   지시 · D2 폭발 반경 · D3 비신뢰 입력 취급. D 는 flag 기본(보안 태세 결정은 사용자 몫),
  //   완전성 단언은 계속 금지, "clean D ≠ security clearance" 명시.
  {
    id: "harness-health-audit",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Harness health audit \u2014 audit the CLAUDE.md/rules/skills/hooks steering layer on 4 questions a linter can't answer: TRUE (matches real code) \xB7 USED (skills trigger, loop verifies) \xB7 AFFORDABLE (inside the budget where rules are still followed) \xB7 SAFE (a live, accurate instruction can still be a bad idea)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "harness-health-audit" }
  },
  // v26.104.0 — 재발방지 (ADR-033, 사용자 지시 2026-07-17). 동일 이슈 재발 시: 재발을 증거로
  //   검증(메모리·룰 사례표·git 이력 — "느낌상 재발" 금지) → 단순 실수 vs 복잡 하네스 문제 분류 →
  //   단순 실수는 에스컬레이션 사다리(1회 기록 → 2회 룰 강제 등록 → 3회+ 구조적 게이트: 테스트/훅/
  //   derive), 복잡 문제는 다면 페르소나로 대책 후보 설계. 본 repo 실무 관행(no-false-ship 3회
  //   재발→rule 신설, CHANGELOG 7릴리즈 drift→테스트 게이트, "주석 경고 ≠ 차단 수단")의 스킬화.
  //   대책이 실제 fire 하는지 검증(RED→GREEN/훅 exit 2) 없이 "보호됨" 보고 금지.
  {
    id: "recurrence-prevention",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Recurrence prevention \u2014 when the same defect happens again, verify the count with evidence, classify simple slip vs complex harness problem, then escalate the countermeasure: record \u2192 forced rule \u2192 structural gate (or multi-persona designed fix)",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "recurrence-prevention" }
  },
  // === Opt-in internal bundled skills — 수단(권장) 계층 (v26.105.0, ADR-034) ===
  // 사용자 확정(2026-07-18): 방법론(목표·스코프/ADR/결함보고/재발방지 등) = 필수 코어(위 dev-method
  // 8종, 기본 설치) / model-orchestration·gemini-consult·codex-consult = **수단** — 필수 아님,
  // 단 **권장**(description 에 recommended 표기). 사용자: "agy, codex, model-policy는 수단인 것
  // 같아. 하지만 난 권장."
  // v26.93.0 — 사용자 확정(2026-07-04) Orchestration & Model Policy 스킬화. v26.94.0 개정
  //   (2026-07-07): 역할분담 재편 — orchestrator 직접: 방향성·스펙리뷰(multi-persona-review)·
  //   기능개선·성능/보안 문제발굴 / opus@xhigh+: 문서작성·핵심구현·V&V(fresh instance) /
  //   sonnet@high+: 반복구현·E2E. effort floor 강제 3경로 + quota 핸드오프는 유지.
  // v26.105.0 (ADR-034) — has-dev-track 기본 → opt-in 권장으로 이동 (수단 계층).
  {
    id: "model-orchestration",
    tier: "official",
    // uzys 본 하네스 자체 템플릿
    description: "Model orchestration policy \u2014 role split (orchestrator directs/reviews \xB7 opus@xhigh+ authors docs/core impl/V&V \xB7 sonnet@high+ repetitive impl/E2E) + effort floors + delegation spec + quota handoff (opt-in \u2014 recommended)",
    category: "workflow",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "model-orchestration" }
  },
  // gemini-consult: uzys 1st-party skill wrapping Antigravity's `agy` CLI for natural Korean
  //   phrasing + multi-persona second-opinion review. Bundled like dev-method skills
  //   (templates/skills/gemini-consult/) so it renders across all 4 CLIs, but opt-in (condition
  //   opt-in) — installed only on wizard check / `--with gemini-consult`. Ships a bash wrapper
  //   (scripts/gemini-ask.sh) to Claude scope via the dir copy; non-Claude CLIs get the SKILL.md
  //   which degrades to a direct `agy` call (graceful — no broken wrapper reference). tier
  //   official (repo template); runtime dep on the external `agy` binary is a prereq, not a source.
  {
    id: "gemini-consult",
    tier: "official",
    // uzys 본 하네스 자체 템플릿 (런타임 의존 agy 는 사용자 prereq)
    description: "gemini-consult \u2014 consult Gemini (via Antigravity agy CLI) for natural Korean phrasing + multi-persona second-opinion review + Gemini image generation (opt-in; requires agy)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "gemini-consult" }
  },
  // codex-consult (v26.100.0): uzys 1st-party sibling of gemini-consult, wrapping the OpenAI
  //   `codex` CLI (`codex exec`) for concise rewriting / document structuring + image generation
  //   (codex `image_generation` tool → real PNG on disk). Same bundling shape: dir copy ships
  //   scripts/codex-ask.sh to Claude scope; non-Claude CLIs get SKILL.md with a direct-call
  //   fallback. Division of labor is encoded in both skills' descriptions (Korean nuance/persona
  //   → gemini, concision/structure/default images → codex). Runtime dep on `codex` binary is a
  //   user prereq, not a source.
  {
    id: "codex-consult",
    tier: "official",
    // uzys 본 하네스 자체 템플릿 (런타임 의존 codex 는 사용자 prereq)
    description: "codex-consult \u2014 consult OpenAI Codex (codex exec) for concise/structured rewriting + image generation (opt-in; requires codex CLI)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "codex-consult" }
  },
  // === Option-gated (v26.42.0 — opt-in, BREAKING vs prior has-dev-track auto-install) ===
  {
    id: "addy-agent-skills",
    tier: "vetted",
    // addyosmani 47k
    description: "addy agent-skills (general dev)",
    category: "workflow",
    source: "addyosmani",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "addyosmani/agent-skills",
      pluginId: "agent-skills@addy-agent-skills"
    }
  },
  {
    id: "superpowers",
    tier: "official",
    // anthropics/claude-plugins-official 공식 배포 (소스 obra 213k)
    // 저자 = obra (190k★ github.com/obra/superpowers). 호스팅 = Anthropic 공식
    // marketplace github.com/anthropics/claude-plugins-official ("Official,
    // Anthropic-managed directory of high quality Claude Code Plugins").
    // source/marketplace 분리는 의도적 — source=저자, marketplace=registry.
    description: "Superpowers \u2014 agentic skills framework (obra, Anthropic official marketplace)",
    category: "workflow",
    source: "obra",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "superpowers@claude-plugins-official"
    }
  },
  {
    // v26.75.0 (ADR-021) — wshobson/agents marketplace.json name = "claude-code-workflows"
    // (84 plugins). 대표 = full-stack-orchestration. 다른 orchestrator(agent-orchestration/
    // tdd-workflows/ship-mate 등): `claude plugin install <name>@claude-code-workflows`.
    id: "wshobson-agents",
    tier: "vetted",
    // wshobson/agents 36k
    description: "wshobson agents \u2014 multi-agent orchestration workflows (full-stack/tdd/review)",
    category: "workflow",
    source: "wshobson",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "wshobson/agents",
      pluginId: "full-stack-orchestration@claude-code-workflows"
    }
  },
  {
    // v26.75.0 (ADR-021) — `npm i --save-dev @fission-ai/openspec` 후 `openspec init` 로 슬래시 주입.
    id: "openspec",
    tier: "vetted",
    // Fission-AI/OpenSpec 53k
    description: "OpenSpec \u2014 spec-driven brownfield delta workflow (propose \u2192 apply \u2192 archive)",
    category: "workflow",
    source: "fission-ai",
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "@fission-ai/openspec", version: "1.4.1" }
  },
  {
    // v26.75.0 (ADR-021) — 비대화형 install. v26.75.1: `--directory .` 누락 시 "Installation
    // directory" 프롬프트에서 hang (Docker realcli 검출). cwd(=project) 기준 `.` 지정으로 봉합.
    id: "bmad-method",
    tier: "vetted",
    // bmad-code-org/BMAD-METHOD 48k
    description: "BMAD-METHOD \u2014 multi-agent agile workflow (PM/Architect/Dev, 12+ agents)",
    category: "workflow",
    source: "bmad-code-org",
    condition: { kind: "opt-in" },
    // v26.102.0 (ADR-031) — args 의 `--tools claude-code` 하드코딩이 claude 전용 산출물
    // (.claude/ agent commands)을 생성 (Docker 실검증 realcli-workflows-2026-06-06).
    // kind 기본값(npx-run=전 CLI)이 이 자산에선 거짓 → override. 대칭 실현(--tools derive)은 M4+.
    cliSupportOverride: ["claude"],
    method: {
      kind: "npx-run",
      cmd: "bmad-method",
      version: "6.9.0",
      args: ["install", "--directory", ".", "--tools", "claude-code", "--yes"]
    }
  },
  // === Railway (csr-fastify|csr-fastapi|ssr-*|full) ===
  // v0.6.3 — railway-plugin entry 제거. railwayapp/railway-plugin repo 자체 존재 안 함
  // (404 Not Found). 공식 docs (https://docs.railway.com/ai/claude-code-plugin) 형식은
  // marketplace add `railwayapp/railway-skills` + plugin install `railway@railway-skills`만.
  // → 아래 railway-skills entry로 단일화.
  {
    id: "railway-skills",
    tier: "experimental",
    // railwayapp/railway-skills 268
    description: "Railway agent-skills (deploy + project/service/env management)",
    category: "backend",
    source: "railwayapp",
    condition: { kind: "any-track", tracks: RAILWAY_TRACKS },
    method: {
      kind: "plugin",
      marketplace: "railwayapp/railway-skills",
      pluginId: "railway@railway-skills"
    }
  },
  // === csr-supabase|full CLI ===
  {
    id: "vercel-cli",
    tier: "vetted",
    // vercel/vercel 15k
    description: "Vercel CLI (npm)",
    category: "backend",
    source: "vercel",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "vercel", version: "54.17.3" }
  },
  {
    // v26.106.0 (ADR-035, 사용자 승인 B): 배포 CLI 2종 동시 기본의 중복 해소 — npm dl 실측 10.11:1
    //   (vercel 2.79M vs netlify 276k /주, 2026-07-18) → vercel 만 기본, netlify 는 opt-in.
    id: "netlify-cli",
    tier: "vetted",
    // netlify/cli 1.9k
    description: "Netlify CLI (npm)",
    category: "backend",
    source: "netlify",
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "netlify-cli", version: "26.1.0" }
  },
  {
    id: "supabase-cli",
    tier: "vetted",
    // supabase 103k
    description: "Supabase CLI (npm) \u2014 first 'supabase login' requires OAuth",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: { kind: "npm", pkg: "supabase", version: "2.108.0" }
  },
  // === UI tracks (csr-*|ssr-*|full) ===
  {
    // v26.106.0 (ADR-035, 사용자 결정 2026-07-18): frontend-design(official)이 기본인 이상 taste
    //   가이드류는 opt-in 으로 충분 — v26.92.0 의 "생성↔리뷰 보완재" 논리는 권고이지 결합이 아님.
    id: "impeccable",
    tier: "vetted",
    // pbakaus 31k
    description: "Impeccable \u2014 UI design guide + visual consistency review (pbakaus, single-skill repo)",
    category: "frontend",
    source: "pbakaus",
    condition: { kind: "opt-in" },
    // v26.54.1 — skills cli 1.5.7 부터 `--skill <name>` 명시 필수 (single-skill repo 도)
    method: { kind: "skill", source: "pbakaus/impeccable", skill: "impeccable" }
  },
  // v26.92.0 — frontend-design (Anthropic official, claude-plugins-official 984.5K installs).
  //   impeccable(생성↔리뷰 짝)의 official 보완재 — frontend-design=distinctive UI 코드 생성,
  //   impeccable=일관성 리뷰. 사용자 결정: has-dev-track 기본추천 (impeccable=UI 트랙보다
  //   넓게 — 모든 개발 트랙, executive 제외). category=frontend (UI 자산, wizard 그룹).
  //   repoForAsset=marketplace(anthropics/claude-plugins-official); official tier=drift 제외.
  {
    id: "frontend-design",
    tier: "official",
    // anthropics/claude-plugins-official (Anthropic 저자, 984.5K installs)
    description: "frontend-design \u2014 distinctive production-grade UI generation (Anthropic official, avoids generic AI aesthetics)",
    category: "frontend",
    source: "anthropics",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "frontend-design@claude-plugins-official"
    }
  },
  // === dev tools (has_dev_track) ===
  {
    id: "playwright-skill",
    tier: "experimental",
    // testdino-hq/playwright-skill 264
    description: "Playwright \u2014 browser automation E2E test authoring guide (testdino-hq)",
    category: "dev-tools",
    source: "testdino-hq",
    condition: { kind: "has-dev-track" },
    // v26.54.1 — skills cli 1.5.7 부터 `--skill <name>` 명시 필수
    method: {
      kind: "skill",
      source: "testdino-hq/playwright-skill",
      skill: "playwright-skill"
    }
  },
  {
    id: "find-skills",
    tier: "vetted",
    // vercel-labs/skills 20k (license none — 출처 신뢰)
    description: "find-skills \u2014 search \xB7 rank all installed skills (vercel-labs, all dev tracks)",
    category: "dev-tools",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "skill", source: "vercel-labs/skills", skill: "find-skills" }
  },
  {
    id: "agent-browser",
    tier: "vetted",
    // vercel-labs/agent-browser 34k
    description: "agent-browser \u2014 agent-friendly Playwright wrapper (screenshot \xB7 DOM search CLI, dev tracks)",
    // v26.78.0 — Understanding 으로 재분류: 웹 지각(screenshot·DOM). 영상/코드 지각과 같은 축.
    category: "understanding",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "npm", pkg: "agent-browser", version: "0.31.0" }
  },
  // v26.78.0 — Understanding 신규 3종 (plugin, opt-in). 에이전트 인지 증강: 영상·코드 지각 + 메모리.
  {
    id: "claude-video",
    tier: "vetted",
    // bradautomates/claude-video 1.8k
    description: "Claude Video \u2014 /watch downloads any video, extracts frames + transcript so Claude can see + hear it (yt-dlp/ffmpeg auto on first run)",
    category: "understanding",
    source: "bradautomates",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "bradautomates/claude-video",
      pluginId: "watch@claude-video"
    }
  },
  {
    id: "understand-anything",
    tier: "vetted",
    // Lum1104/Understand-Anything 53k
    description: "Understand Anything \u2014 multi-agent pipeline builds an interactive knowledge graph of your codebase (files/functions/deps) to explore + query",
    category: "understanding",
    source: "Lum1104",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "Lum1104/Understand-Anything",
      pluginId: "understand-anything@understand-anything"
    }
  },
  {
    id: "agentmemory",
    tier: "vetted",
    // rohitg00/agentmemory 21k
    description: "AgentMemory \u2014 persistent memory runtime; plugin auto-wires MCP (53 tools) + hooks + skills. Runtime server: npx @agentmemory/agentmemory",
    category: "understanding",
    source: "rohitg00",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "rohitg00/agentmemory",
      pluginId: "agentmemory@agentmemory"
    }
  },
  // === Visual & Media (v26.85.0) — 코드-퍼스트 제작 자산. 전부 opt-in. ===
  // Docker 실설치 검증 PASS (실 claude 2.1.177): plugin install / npx skills add resolve 확인.
  {
    id: "frontend-slides",
    tier: "vetted",
    // zarazhangrui/frontend-slides 21k
    description: "frontend-slides \u2014 dependency-free HTML slide decks (presets \xB7 templates \xB7 PPTX\u2192HTML \xB7 PDF export)",
    category: "visual-media",
    source: "zarazhangrui",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "zarazhangrui/frontend-slides",
      pluginId: "frontend-slides@frontend-slides"
    }
  },
  {
    id: "marp-slide",
    tier: "vetted",
    // softaworks/agent-toolkit 2k
    description: "marp-slide \u2014 Marp Markdown slides (7 themes \xB7 PPTX/PDF export)",
    category: "visual-media",
    source: "softaworks",
    // softaworks plugin dir 는 plugin.json 부재 → skill 경로가 안전 (Docker 검증).
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "softaworks/agent-toolkit", skill: "marp-slide" }
  },
  {
    id: "mermaid-diagrams",
    tier: "vetted",
    // softaworks/agent-toolkit 2k
    description: "mermaid-diagrams \u2014 Mermaid flow/sequence/ER/state diagram authoring (code \xB7 docs)",
    category: "visual-media",
    source: "softaworks",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "softaworks/agent-toolkit", skill: "mermaid-diagrams" }
  },
  {
    id: "gsap-skills",
    tier: "vetted",
    // greensock/gsap-skills 9k (GSAP 본가 공식)
    description: "GSAP skills \u2014 official GreenSock motion/scroll animation guide (8 skills: timeline \xB7 scrolltrigger \xB7 react)",
    category: "visual-media",
    source: "greensock",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "greensock/gsap-skills",
      pluginId: "gsap-skills@gsap-skills"
    }
  },
  {
    // remotion: star 3.6k → vetted (star 기반 tier SSOT + trust-tier-drift CI 정합, 사용자 결정 2026-06-13).
    //   코어 BUSL(Business Source License) — opt-in + description 고지로 신중 취급 (경고 배지 대신).
    //   --skill 값 = remotion-best-practices (dir `remotion` ≠ frontmatter name, Docker 실측 확정).
    id: "remotion",
    tier: "vetted",
    // remotion-dev/skills 3.6k (license none — 출처 신뢰; 코어 BUSL 고지)
    description: "Remotion \u2014 programmatic MP4 video from React components (data-driven). Core license = BUSL",
    category: "visual-media",
    source: "remotion-dev",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "remotion-dev/skills", skill: "remotion-best-practices" }
  },
  // Issue #176 — 프레젠테이션 생성 스택 4종 (Docker 실설치 4/4 PASS: skills@1.5.11 add <src> --agent claude-code --skill, 2026-06-20).
  {
    id: "ppt-master",
    tier: "vetted",
    // hugohe3/ppt-master 29k
    description: "ppt-master \u2014 editable PowerPoint (.pptx) from any document (native shapes \xB7 speaker notes \xB7 custom .pptx template)",
    category: "visual-media",
    source: "hugohe3",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "hugohe3/ppt-master", skill: "ppt-master" }
  },
  {
    // deer-flow 72k 거대 harness지만 --skill 로 ppt-generation 단일 skill만 설치 (skills/public/ 중첩, Docker 확인).
    id: "ppt-generation",
    tier: "vetted",
    // bytedance/deer-flow 72k
    description: "ppt-generation \u2014 PPTX by generating an image per slide and composing into PowerPoint (deer-flow skill)",
    category: "visual-media",
    source: "bytedance",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "bytedance/deer-flow", skill: "ppt-generation" }
  },
  {
    id: "web-video-presentation",
    tier: "vetted",
    // ConardLi/garden-skills 8.4k
    description: "web-video-presentation \u2014 click-driven 16:9 web decks that look like video (optional TTS narration; garden-skills)",
    category: "visual-media",
    source: "ConardLi",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "ConardLi/garden-skills", skill: "web-video-presentation" }
  },
  {
    id: "revealjs",
    tier: "experimental",
    // ryanbbrown/revealjs-skill 347 (<1000 → experimental, opt-in + 경고)
    description: "reveal.js \u2014 polished HTML presentations (themes \xB7 multi-column \xB7 code highlight \xB7 speaker notes, no build step)",
    category: "visual-media",
    source: "ryanbbrown",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "ryanbbrown/revealjs-skill", skill: "revealjs" }
  },
  // === Supabase agent-skills (csr-supabase|full) ===
  {
    id: "supabase-agent-skills",
    tier: "vetted",
    // supabase/agent-skills 2.2k
    description: "Supabase \u2014 RLS \xB7 auth \xB7 edge function \xB7 realtime guide (csr-supabase \xB7 full tracks)",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: {
      kind: "plugin",
      marketplace: "supabase/agent-skills",
      pluginId: "supabase@supabase-agent-skills"
    }
  },
  {
    id: "postgres-best-practices",
    tier: "vetted",
    // supabase/agent-skills 2.2k
    description: "Postgres best practices \u2014 schema \xB7 index \xB7 query patterns (csr-supabase \xB7 full tracks)",
    category: "backend",
    source: "supabase",
    condition: { kind: "any-track", tracks: ["csr-supabase", "full"] },
    method: {
      kind: "plugin",
      marketplace: "supabase/agent-skills",
      pluginId: "postgres-best-practices@supabase-agent-skills"
    }
  },
  // === React + Next UI tracks ===
  // v0.6.3 — vercel-labs/agent-skills source는 short form 안 됨. full HTTPS URL 필요.
  // 사용자 확인 형식: `npx skills add https://github.com/vercel-labs/agent-skills --skill <name>`.
  {
    id: "react-best-practices",
    tier: "vetted",
    // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
    description: "React best practices \u2014 Vercel's hook \xB7 perf \xB7 component patterns (CSR \xB7 SSR \xB7 Next tracks)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      // v0.6.5 — skills.sh registry name. GitHub dir 이름(react-best-practices)과 다름.
      // skills.sh: 대부분 vercel- prefix (web-design-guidelines, deploy-to-vercel만 예외).
      skill: "vercel-react-best-practices"
    }
  },
  {
    id: "shadcn-ui",
    tier: "vetted",
    // shadcn-ui/ui 115k
    description: "shadcn/ui \u2014 Radix-based React component copy + Tailwind theme (shadcn official)",
    category: "frontend",
    source: "shadcn-ui",
    condition: { kind: "any-track", tracks: CSR_SSR_NEXTJS_FULL },
    // v26.54.1 — shadcn/ui repo 의 실제 skill 이름은 `shadcn` (자산 id 와 다름).
    method: { kind: "skill", source: "shadcn/ui", skill: "shadcn" }
  },
  {
    // v26.106.0 (ADR-035, 사용자 승인 D): 순수 pattern-guide(일반 디자인 가이드라인) → opt-in 강등
    //   (T2 가설 전제 — taste 3종 중복 주장은 검증자 정정으로 기각, 근거는 P축 단독).
    id: "web-design-guidelines",
    tier: "vetted",
    // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
    description: "Web design guidelines \u2014 Vercel's visual hierarchy \xB7 color \xB7 spacing (CSR \xB7 SSR \xB7 Next tracks)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      skill: "web-design-guidelines"
    }
  },
  // === Executive tracks ===
  {
    id: "anthropic-document-skills",
    tier: "official",
    // anthropics/skills 144k
    description: "Anthropic document-skills (pptx/docx/xlsx/pdf)",
    category: "business",
    source: "anthropics",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "anthropics/skills",
      pluginId: "document-skills@anthropic-agent-skills"
    }
  },
  // alirezarezvani/claude-skills marketplace (v2.3.0) — 2026-04-25 통합 갱신.
  // 기존 alirezarezvani/c-level-skills + alirezarezvani/finance-skills 별도 marketplace
  // → 통합된 alirezarezvani/claude-skills marketplace (claude-code-skills 이름)로 이동.
  {
    id: "c-level-skills",
    tier: "vetted",
    // alirezarezvani 16k
    description: "c-level-skills (claude-code-skills, 28 advisory)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "c-level-skills@claude-code-skills"
    }
  },
  {
    id: "business-growth-skills",
    tier: "vetted",
    // alirezarezvani 16k
    description: "business-growth-skills (4 \u2014 customer success, sales eng, revops, contract)",
    category: "business",
    source: "alirezarezvani",
    // v0.5.0 — growth-marketing Track에서도 재사용. 합집합 조건.
    condition: { kind: "any-track", tracks: ["executive", "full", "growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "business-growth-skills@claude-code-skills"
    }
  },
  {
    id: "finance-skills",
    tier: "vetted",
    // alirezarezvani 16k
    description: "finance-skills (3 \u2014 financial analyst, SaaS metrics, investment advisor)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["executive", "full"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "finance-skills@claude-code-skills"
    }
  },
  // === Project Management Track (v0.5.0) ===
  // SPEC docs/specs/new-tracks-pm-growth.md §3.5 — pm-skills 4/4.
  {
    id: "pm-skills",
    tier: "vetted",
    // alirezarezvani 16k
    description: "pm-skills (6 \u2014 senior PM, scrum master, Jira/Confluence/Atlassian admin, template creator)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["project-management"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "pm-skills@claude-code-skills"
    }
  },
  // SPEC §3.5 — product-skills: has-dev-track + project-management 합집합 (executive/growth-marketing 제외).
  {
    id: "product-skills",
    tier: "vetted",
    // alirezarezvani 16k
    description: "product-skills (15 \u2014 RICE, PRD, agile PO, UX research, SaaS scaffolder ...)",
    category: "dev-tools",
    source: "alirezarezvani",
    // v26.106.0 (ADR-035, 사용자 승인 C): dev 8트랙 기본에서 제외 — PM 스킬 15종은 PM 트랙 목적
    //   자산. dev 트랙은 wizard 체크 / --with 로 opt-in.
    condition: { kind: "any-track", tracks: ["project-management"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "product-skills@claude-code-skills"
    }
  },
  // === Growth Marketing Track (v0.5.0) ===
  // SPEC docs/specs/new-tracks-pm-growth.md §3.5 — 4 entries 모두 4/4.
  {
    id: "marketing-skills",
    tier: "vetted",
    // alirezarezvani 16k
    description: "marketing-skills (44 \u2014 content/SEO/CRO/channels/growth/intelligence/sales/twitter)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "marketing-skills@claude-code-skills"
    }
  },
  // v26.91.0 — coreyhaines31/marketingskills (35k★, MIT, plugin v2.5.1). 위 alirezarezvani
  //   marketing-skills(16k) 와 병존 — id 구분(marketingskills ≠ marketing-skills). opt-in =
  //   growth-marketing 외 전 트랙에서도 wizard 토글 + `--with marketingskills` 로 설치 가능
  //   ("SEO 는 일반 개발에도 활용" 충족: dev 트랙에서 본 번들 토글). 45 스킬 중 SEO 7종
  //   (seo-audit/schema/ai-seo/site-architecture/programmatic-seo/content/aso)은 상호참조
  //   (product-marketing 우선 + seo-audit↔schema↔ai-seo)라 부분 추출 시 포인터 깨짐 → 번들
  //   통째 설치만 정합. repoForAsset = marketplace(coreyhaines31/marketingskills) → drift 라이브.
  {
    id: "marketingskills",
    tier: "vetted",
    // coreyhaines31 35k
    description: "marketingskills (45 \u2014 CRO/copywriting/SEO/AI-SEO/ads/growth, coreyhaines31 35k\u2605)",
    category: "business",
    source: "coreyhaines31",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "coreyhaines31/marketingskills",
      pluginId: "marketing-skills@marketingskills"
    }
  },
  // v26.76.0 — content-creator / demand-gen 제거: alirezarezvani/claude-skills marketplace.json 에
  // 해당 plugin 부재(Docker 실설치 검출, exit 1). 거짓 광고 0건 원칙(Promise=Implementation).
  // growth-marketing 트랙은 business-growth-skills + marketing-skills + research-summarizer 유지.
  {
    id: "research-summarizer",
    tier: "vetted",
    // alirezarezvani 16k
    description: "research-summarizer (market research summarization)",
    category: "business",
    source: "alirezarezvani",
    condition: { kind: "any-track", tracks: ["growth-marketing"] },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "research-summarizer@claude-code-skills"
    }
  },
  // === Code-quality enforcement (has-dev-track, v0.5.0) ===
  // SPEC §3.5 — karpathy-coder 4/4. CLAUDE.md P1-P4 선언적 원칙의 검출 도구 layer.
  // 4 Python tools (stdlib only) + reviewer agent + /karpathy-check + pre-commit hook.
  {
    id: "karpathy-coder",
    tier: "vetted",
    // alirezarezvani 16k
    description: "karpathy-coder (4 Python tool + reviewer agent + /karpathy-check + pre-commit hook)",
    category: "dev-tools",
    source: "alirezarezvani",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "karpathy-coder@claude-code-skills"
    }
  },
  // === Option-gated ===
  {
    // v26.39.2 fix — marketplace name = "trailofbits" (NOT "trailofbits-skills") +
    // "trailofbits-skills" plugin 자체가 존재하지 않음. marketplace 안에 14+ 개별 plugin.
    // 단일 대표 plugin = `differential-review` (코드 변경 보안 리뷰, 가장 보편).
    // 추가 plugin 원하는 사용자는: `claude plugin install <name>@trailofbits` (예: audit-context-building)
    id: "trailofbits-skills",
    tier: "vetted",
    // trailofbits/skills 5.5k (CC-BY-SA — 출처 신뢰)
    description: "Trail of Bits differential-review plugin (security-focused code review)",
    category: "dev-tools",
    source: "trailofbits",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "trailofbits/skills",
      pluginId: "differential-review@trailofbits"
    }
  },
  {
    id: "ecc-plugin",
    tier: "vetted",
    // affaan-m/everything-claude-code 199k
    description: "ECC \u2014 60 agents \xB7 230 skills \xB7 75 commands. Affaan's hackathon package",
    category: "ecc-suite",
    source: "affaan-m",
    condition: { kind: "opt-in" },
    // v26.54.1 — upstream marketplace.json 의 name 은 "ecc" (plugin name 도 "ecc").
    // 기존 매핑 `everything-claude-code@everything-claude-code` 는 marketplace 가
    // 그 이름으로 등록되던 옛 버전 기준. fresh install 에서는 "Plugin not found" 발생.
    method: {
      kind: "plugin",
      marketplace: "affaan-m/everything-claude-code",
      pluginId: "ecc@ecc"
    }
  },
  {
    id: "ecc-prune",
    tier: "official",
    // uzys 본 하네스 자체
    description: "ECC prune (drop items beyond curated 89 KEEP \u2192 copy to .claude/local-plugins/ecc/)",
    category: "ecc-suite",
    source: "uzys",
    condition: { kind: "option", flag: "withPrune" },
    method: {
      kind: "shell-script",
      script: "scripts/prune-ecc.sh",
      args: ["--apply", "--force"]
    }
  }
];
var DEV_METHOD_SKILL_IDS = [
  "multi-persona-review",
  "gap-analysis-e2e",
  "ultracode-service-audit",
  "asis-tobe-decision",
  "compaction-handoff",
  "northstar-roadmap",
  // v26.98.0 — 하네스 건강 감사 (ADR-027).
  "harness-health-audit",
  // v26.104.0 — 재발방지 (ADR-033).
  "recurrence-prevention"
  // v26.105.0 (ADR-034) — model-orchestration 은 '수단(권장)' 계층으로 이동 (opt-in internal).
];
var INTERNAL_BUNDLED_SKILL_IDS = [
  ...DEV_METHOD_SKILL_IDS,
  // opt-in internal skills (NOT dev-method): bundled + 4-CLI rendered, installed only on opt-in.
  // v26.105.0 (ADR-034) — '수단(권장)' 계층: model-orchestration + advisors.
  "model-orchestration",
  "gemini-consult",
  // v26.100.0 — Codex advisor (concision/structure + image gen). ADR-029.
  "codex-consult"
];
var TRUST_TIER = Object.fromEntries(
  EXTERNAL_ASSETS.map((a) => [a.id, a.tier])
);
function assetTrustTier(assetId) {
  return TRUST_TIER[assetId] ?? "experimental";
}
function shouldInstallAsset(asset, ctx) {
  if (ctx.userOverride?.forceExclude.includes(asset.id)) return false;
  if (ctx.userOverride?.forceInclude.includes(asset.id)) return true;
  if (TRUST_TIER[asset.id] === "experimental") return false;
  return matchesCondition(asset, ctx);
}
function matchesCondition(asset, ctx) {
  const cond = asset.condition;
  switch (cond.kind) {
    case "any-track":
      return ctx.tracks.some((t) => cond.tracks.includes(t));
    case "has-dev-track":
      return hasDevTrack(ctx.tracks);
    case "option":
      return ctx.options[cond.flag] === true;
    case "opt-in":
      return false;
  }
}
function isAssetSelected(assetId, ctx) {
  const asset = EXTERNAL_ASSETS.find((a) => a.id === assetId);
  return asset ? shouldInstallAsset(asset, ctx) : false;
}
function experimentalOptInCandidates(ctx) {
  return EXTERNAL_ASSETS.filter(
    (a) => TRUST_TIER[a.id] === "experimental" && !ctx.userOverride?.forceInclude.includes(a.id) && matchesCondition(a, ctx)
  );
}
function assetCliSupport(asset) {
  if (asset.cliSupportOverride) {
    return [...asset.cliSupportOverride];
  }
  switch (asset.method.kind) {
    case "plugin":
    case "shell-script":
      return ["claude"];
    case "skill":
    case "npm":
    case "npx-run":
    case "internal":
      return [...CLI_BASES];
  }
}
function assetReachesCli(asset, cli) {
  if (cli.length === 0) {
    return true;
  }
  const support = assetCliSupport(asset);
  return cli.some((c) => support.includes(c));
}
function filterApplicableAssets(assets, ctx) {
  return assets.filter((a) => shouldInstallAsset(a, ctx));
}
export {
  DEV_METHOD_SKILL_IDS,
  DEV_TRACKS,
  EXECUTIVE_STYLE_TRACKS,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
  TRUST_TIER,
  assetCliSupport,
  assetReachesCli,
  assetTrustTier,
  experimentalOptInCandidates,
  filterApplicableAssets,
  isAssetSelected,
  shouldInstallAsset
};

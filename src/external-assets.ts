/**
 * External asset matrix — bash setup-harness.sh L791~1067 등가 데이터.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F3
 * Source: setup-harness.sh@911c246~1 (v27.18 직전, bash cutover 전)
 *
 * Track 또는 옵션 조건이 충족되면 install pipeline에서 method를 호출.
 * 실패는 "warn-skip" — 종료 시 누락 자산 보고 (OQ1 결정).
 *
 * code-style 800줄 cap 예외: 본 파일은 ~85% 가 큐레이션 자산 카탈로그(43 entry × ~13줄)
 *   = 데이터. 로직(interface·condition 평가·shouldInstallAsset)은 소량. 데이터/로직 분리는
 *   별도 사이클(Phase R) 후보 — 현재는 카탈로그 단일 SSOT 가독성 우선. (v26.79.0 기준 802줄)
 */

import type { Category, Source } from "./categories.js";
import { hasDevTrack } from "./track-match.js";
import { CLI_BASES, type CliTargets, type OptionFlags, TRACKS, type Track } from "./types.js";

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
  | { kind: "shell-script"; script: string; args: string[] }
  /**
   * v26.81.0 (ADR-022) — 내부 템플릿 자산. external-installer 가 spawn 하지 않음 —
   * installer Phase 1 의 manifest/transform 게이팅이 `isAssetSelected(key)` 로 읽는다.
   * (이전 OptionFlags.withTauri/withUzysHarness 자리. wizard/CLI 표면은 일반 자산과 동일)
   */
  | {
      kind: "internal";
      key:
        | "tauri-desktop"
        // v26.87.0 — dev-method skills (uzys 1st-party, repo-bundled templates).
        // 2026-08-02 복원 (ADR-062) — 이관(ADR-060)이 본문을 열화시켜 이 리포 번들로 되돌렸다.
        //   9종 전부 `templates/skills/<id>/` 로 다시 번들된다.
        | "compaction-handoff"
        | "clear-korean-communication"
        | "north-star"
        | "audit-service-gaps"
        | "verification-loop"
        | "multi-persona-review"
        | "recurrence-prevention"
        | "gh-issue-workflow"
        | "model-orchestration"
        | "external-model-consult"
        // 위임·요청을 canonical 브리프 형태로 정규화 (UserPromptSubmit 넛지 훅과 한 벌).
        | "task-brief"
        // 설치된 상주 조종층(앵커·룰·훅·permissions·descriptor)의 밥값 감사 — 자기유지 루프.
        | "audit-harness-fit"
        // v26.108.0 — CI 스캐폴드 (.github/workflows fill-in 템플릿). ADR-037.
        | "ci-scaffold";
    };

export type ExternalAssetCondition =
  /** Track 중 1개 이상이 set와 일치 */
  | { kind: "any-track"; tracks: Track[] }
  /** dev track (executive 외 모두) */
  | { kind: "has-dev-track" }
  /** OptionFlags 의 특정 플래그 true (잔존 동작 옵션용 — ADR-022 후 자산 토글엔 사용 금지) */
  | { kind: "option"; flag: keyof OptionFlags }
  /**
   * v26.81.0 (ADR-022) — 순수 opt-in: condition 매치 항상 false. wizard 체크 또는
   * `--with <id>` 의 forceInclude 로만 설치. 이전의 자산 1:1 OptionFlags(`withBmad` 등
   * 13종)를 대체 — 자산 추가 시 플래그 코드 0곳.
   */
  | { kind: "opt-in" };

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
  /**
   * v26.102.0 (ADR-031) — kind 기본 도달 범위의 **개별 자산 예외**. 설정 시 assetCliSupport 가
   * kind derive 대신 이 값을 쓴다. 사용 조건: method 인자/스크립트가 특정 CLI 전용 산출물을
   * 만드는 경우만 (예: bmad `--tools claude-code`). 근거 주석 필수 — SOD 리뷰가 "예외 0" 가정을
   * bmad 로 반증(Critical-1)해 도입.
   */
  cliSupportOverride?: CliTargets;
}

/**
 * v26.71.0 (PRD v26-71) — 검증 Trust Tier. North Star 세 기둥 ②.
 *   - official: Anthropic 공식 marketplace + 본 하네스 자체.
 *   - vetted: star ≥ 1000 + 활성 유지보수 (D2; 라이선스 미표기/비-OSI 는 출처 신뢰).
 *   - experimental: star < 1000 — opt-in + 경고 (pre-check 제외).
 */
export type TrustTier = "official" | "vetted" | "experimental";

/** csr-*|ssr-nextjs|full per bash setup-harness.sh L1041 (ssr-htmx 제외 — htmx는 React 미사용). */
const CSR_SSR_NEXTJS_FULL: Track[] = [
  "csr-supabase",
  "csr-fastify",
  "csr-fastapi",
  "ssr-nextjs",
  "full",
];

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
 * 60 자산 매트릭스 (2026-08-17 game-engine · game-studios 추가. 그 전: 2026-08-16 preline 추가. 그 전: 2026-08-02 복원분 + task-brief·audit-harness-fit 신설. 그 전 정비: 모델이 이미 아는
 * pattern-guide·중복 번들 12종 제거
 * [impeccable·polars/dask·python 2종·c-level/business-growth/pm/marketing/research-summarizer·
 * playwright-skill·karpathy-coder] + uzys 방법론 스킬 11종을 이관 리포 npx 설치 9종으로 대체
 * + 프론트엔드 3종 신규 — ADR-060. 이전: v26.110.0 ADR-039 오피셜 플러그인 큐레이션 3종 opt-in
 * [context7 = mcp.json 기본 wiring 기충족으로 미등록, claude-md-management 기각] + v26.108.0
 * ci-scaffold internal + v26.106.0 ADR-035 축 판정 + v26.92.0 frontend-design official +
 * v26.91.0 marketingskills opt-in + v26.86.0 Visual & Media 프레젠테이션 4종 + v26.85.0 5종 +
 * v26.81.0 internal 2종 — ADR-022). bash setup-harness.sh@911c246~1 L791~1067 + 1320~1370 동등.
 *
 * 호출 순서: data → dev-baseline → railway → supabase-cli → dev-tools →
 * supabase-skills → react/ui → next → executive → GSD → ToB → ECC.
 */
export const EXTERNAL_ASSETS: ReadonlyArray<ExternalAsset> = [
  // === data Track ===
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

  // === Internal template assets (v26.81.0, ADR-022 — 이전 OptionFlags.withTauri/withUzysHarness) ===
  {
    id: "tauri-desktop",
    tier: "official", // uzys 본 하네스 자체 템플릿
    description: "Tauri desktop rule template (CSR/full tracks — manifest rule mapping)",
    category: "frontend",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "tauri-desktop" },
  },
  // v26.108.0 (ADR-037, 라이프사이클 자산화 ②) — CI 스캐폴드: `.github/workflows/` fill-in
  //   워크플로(tag-트리거 CI + 실DB 서비스 컨테이너 + coverage 게이트 + Playwright E2E).
  //   실무 CI 패턴의 도메인 중립 일반화 (CI 부재 프로젝트의 갭이 계기). `.claude/` 밖에
  //   쓰는 첫 자산 — opt-in 전용 + 기존 워크플로 파일은 절대 덮어쓰지 않는다 (src/ci-scaffold.ts,
  //   manifest 경유 아님 — CLI 선택과 무관하게 설치되는 CLI-agnostic 산출물).
  {
    id: "ci-scaffold",
    tier: "official", // uzys 본 하네스 자체 템플릿
    description:
      "CI scaffold — .github/workflows fill-in templates (tag-triggered CI + real-DB service container + coverage gate + Playwright E2E); never overwrites existing workflow files (opt-in)",
    category: "workflow",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "ci-scaffold" },
  },

  // === Repo-bundled internal skills (uzys 1st-party, v26.87.0) ===
  // 2026-08-02 복원 (ADR-062) — 이관(ADR-060) 후 감사에서 본문 열화 104건(dropped 76 ·
  //   damaged 28)이 확인돼 9종을 이 리포 번들로 되돌렸다. 아래 10종 전부 `kind: "internal"`.
  {
    id: "compaction-handoff",
    tier: "official", // uzys 본 하네스 자체 템플릿
    description:
      "Compaction handoff — persist durable state + git snapshot + resume anchor before a context /compact so nothing is lost",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "compaction-handoff" },
  },

  // === uzys 방법론 스킬 — 이 리포 번들 (2026-08-02 복원, ADR-062) ===
  // ASIS(ADR-060): `kind: "skill"` — uzysjung/uzys-agent-skills 에서 `npx skills add`.
  // TOBE: templates/skills/<id>/ 번들 → 설치 시 dir copy (`kind: "internal"`).
  //   이관본이 판정 기준·수치·워크드 예시를 잃어(감사 실측 104건) 스킬이 무엇을 하라는지가
  //   남고 무엇으로 판정하는지가 사라졌다. 배포 경로를 하나로 모으는 이득보다 본문 보존이
  //   앞선다 — 본문 게이트(테스트)가 이 리포에만 있기 때문이다. tier official = 자사
  //   (star 무관 — trust-tier-drift 가 official 을 건너뛴다). condition 은 이관 전 도달 범위 유지.
  {
    id: "clear-korean-communication",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "Clear Korean communication — restate technical facts from the reader's position (impact and cause first, then evidence) instead of translation-ese; covers decisions, approval requests, and AS-IS/TO-BE contrasts",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "clear-korean-communication" },
  },
  {
    id: "north-star",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "North Star — create or safely update the project direction baseline and its revision-linked roadmap, then analyze the impact on audits, verification criteria, issues, and work in progress",
    category: "workflow",
    source: "uzys",
    // 전 트랙 상주 보존 — 이관 전에는 manifest COMMON_SKILL_DIRS(조건 없는 전 트랙 설치)였다.
    // 이 카탈로그에 "always" kind 가 없어 전 트랙 나열로 같은 도달 범위를 표현한다.
    condition: { kind: "any-track", tracks: [...TRACKS] },
    method: { kind: "internal", key: "north-star" },
  },
  {
    id: "audit-service-gaps",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "Audit service gaps — audit observable gaps between the service's current state and an explicit North Star baseline (reverse · defect · experience · benchmark · verify · change-impact · drift modes)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "audit-service-gaps" },
  },
  {
    id: "verification-loop",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "Verification loop — run proportional verification tracks (UI · API · CLI · library · docs · real user flow) and end with evidence plus a fixed verdict; a green build is not proof of user-visible completion",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "verification-loop" },
  },
  {
    id: "multi-persona-review",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "Multi-persona review — review one artifact through independent stakeholder and failure lenses, then synthesize evidence-backed, severity-ranked findings without discarding minority views",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "multi-persona-review" },
  },
  {
    id: "recurrence-prevention",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "Recurrence prevention — reconstruct a repeated defect's failure signature and timeline, then pick the least costly countermeasure (code · regression test · rule · hook · derivation · gate)",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "recurrence-prevention" },
  },
  {
    id: "gh-issue-workflow",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "GitHub issue workflow — investigate, draft, create, implement, verify, and close issue-backed work while keeping read-only, draft, external-write, and status stages distinct",
    category: "workflow",
    source: "uzys",
    // 전 트랙 상주 보존 — north-star 와 같은 이유 (이관 전 COMMON_SKILL_DIRS).
    condition: { kind: "any-track", tracks: [...TRACKS] },
    method: { kind: "internal", key: "gh-issue-workflow" },
  },
  {
    id: "model-orchestration",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "Model orchestration — decompose work by capability and route independent, bounded tasks to available agents while preserving ownership, permissions, and verification (opt-in — recommended)",
    category: "workflow",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "model-orchestration" },
  },
  {
    // 전신 = gemini-consult + codex-consult. provider 중립 한 스킬로 통합됐다(통합은 유지 —
    //   되돌린 것은 배포 경로이지 통합이 아니다).
    id: "external-model-consult",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "External model consult — ask an available external model/provider for an independent draft, critique, or provider-only output such as image generation (opt-in — recommended; requires that provider's CLI)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "external-model-consult" },
  },
  {
    // 복원 9종이 아니라 신설이다 — 이관 이력이 없다.
    // 전 트랙인 이유: 위임과 요청 정규화는 개발 트랙의 행위가 아니라 **전 트랙의 행위**다.
    // executive 트랙도 서브에이전트에 일을 넘기고, 그때 브리프가 없으면 완료 판정 기준 없이
    // 넘긴다. 짝인 `task-brief-nudge.sh` 훅이 `ALWAYS_HOOKS`(전 설치본)라 스킬만 좁게 깔면
    // 넛지가 없는 스킬을 가리킨다 — 훅과 스킬의 도달 범위는 같아야 한다.
    id: "task-brief",
    tier: "official", // uzys 자사 스킬
    description:
      "Task brief — normalize an incoming request into the canonical brief (objective · inputs · invariants · success criteria · boundaries · autonomy · verification) and write every delegation prompt in that same shape",
    category: "workflow",
    source: "uzys",
    condition: { kind: "any-track", tracks: [...TRACKS] },
    method: { kind: "internal", key: "task-brief" },
  },
  {
    // task-brief 와 같은 신설이다 — 이관 이력이 없다.
    // 전 트랙인 이유: 이 하네스는 **모든 트랙에** 앵커·룰·훅을 깐다. 그 상주층이 밥값을 하는지
    // 되묻는 루프만 개발 트랙에 두면, 상주 비용은 전원이 무는데 감사는 일부만 갖는 비대칭이
    // 된다. 감사 대상이 개발 산출물이 아니라 **설치본 자신**이라 트랙 술어와 무관하다.
    id: "audit-harness-fit",
    tier: "official", // uzys 자사 스킬
    description:
      "Audit harness fit — audit whether the resident steering layer (anchor · rules · hooks · permissions · skill descriptors) still earns its context, judged by published criteria, block logs, and measurement; relocate procedures to skills, guarantees to hooks/permissions, derivable facts to code",
    category: "workflow",
    source: "uzys",
    condition: { kind: "any-track", tracks: [...TRACKS] },
    method: { kind: "internal", key: "audit-harness-fit" },
  },

  // === Option-gated (v26.42.0 — opt-in, BREAKING vs prior has-dev-track auto-install) ===
  {
    id: "addy-agent-skills",
    tier: "vetted", // addyosmani 47k
    description: "addy agent-skills (general dev)",
    category: "workflow",
    source: "addyosmani",
    condition: { kind: "opt-in" },
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
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "superpowers@claude-plugins-official",
    },
  },
  // v26.110.0 (ADR-039, 오피셜 플러그인 큐레이션) — feature-dev: 탐색→설계→구현 워크플로우 +
  //   전용 에이전트 3종(code-architect/code-explorer/code-reviewer). 방법론류 — ADR-032
  //   "워크플로우 강제 구조는 기본 불필요" + 자체 code-reviewer 가 기본 리뷰 에이전트와 중복
  //   → superpowers 와 동급 opt-in.
  {
    id: "feature-dev",
    tier: "official", // anthropics/claude-plugins-official (242.5K installs, 사용자 관측 2026-07-18)
    description:
      "feature-dev — guided feature workflow with explore/architect/review agents (Anthropic official)",
    category: "workflow",
    source: "anthropics",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "feature-dev@claude-plugins-official",
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
    condition: { kind: "opt-in" },
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
    condition: { kind: "opt-in" },
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
    condition: { kind: "opt-in" },
    // v26.102.0 (ADR-031) — args 의 `--tools claude-code` 하드코딩이 claude 전용 산출물
    // (.claude/ agent commands)을 생성 (Docker 실검증 realcli-workflows-2026-06-06).
    // kind 기본값(npx-run=전 CLI)이 이 자산에선 거짓 → override. 대칭 실현(--tools derive)은 M4+.
    cliSupportOverride: ["claude"],
    method: {
      kind: "npx-run",
      cmd: "bmad-method",
      version: "6.9.0",
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
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063)
    condition: { kind: "opt-in" },
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
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063)
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "vercel", version: "54.17.3" },
  },
  {
    // v26.106.0 (ADR-035, 사용자 승인 B): 배포 CLI 2종 동시 기본의 중복 해소 — npm dl 실측 10.11:1
    //   (vercel 2.79M vs netlify 276k /주, 2026-07-18) → vercel 만 기본, netlify 는 opt-in.
    id: "netlify-cli",
    tier: "vetted", // netlify/cli 1.9k
    description: "Netlify CLI (npm)",
    category: "backend",
    source: "netlify",
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "netlify-cli", version: "26.1.0" },
  },
  {
    id: "supabase-cli",
    tier: "vetted", // supabase 103k
    description: "Supabase CLI (npm) — first 'supabase login' requires OAuth",
    category: "backend",
    source: "supabase",
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063)
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "supabase", version: "2.108.0" },
  },

  // === UI tracks (csr-*|ssr-*|full) ===
  // v26.92.0 — frontend-design (Anthropic official, claude-plugins-official 984.5K installs).
  //   사용자 결정: has-dev-track 기본추천 (모든 개발 트랙, executive 제외).
  //   category=frontend (UI 자산, wizard 그룹).
  //   repoForAsset=marketplace(anthropics/claude-plugins-official); official tier=drift 제외.
  {
    id: "frontend-design",
    tier: "official", // anthropics/claude-plugins-official (Anthropic 저자, 984.5K installs)
    description:
      "frontend-design — distinctive production-grade UI generation (Anthropic official, avoids generic AI aesthetics)",
    category: "frontend",
    source: "anthropics",
    condition: { kind: "has-dev-track" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "frontend-design@claude-plugins-official",
    },
  },
  // 2026-08-02 정비 — 프론트엔드 품질 3종 (사용자 지시). 전부 opt-in: frontend-design 이 기본
  //   생성기이고 이 셋은 그 위의 취향·디테일 층이라 상시 비용을 물릴 근거가 없다 (ADR-032/035
  //   와 같은 축). star 는 각 tier 라인 주석 = 2026-08-02 `gh api` 실측.
  {
    id: "jakubkrehel-skills",
    tier: "vetted", // jakubkrehel/skills 2,602 (2026-08-02)
    description:
      "Better-* interface suite — 7 skills reviewing/improving UI detail, typography, OKLCH color, accessibility, layout, and UX writing, one concern per skill",
    category: "frontend",
    source: "jakubkrehel",
    condition: { kind: "opt-in" },
    // `--skill` 미지정 = 리포의 7 스킬 전부 설치. 다른 multi-skill 출처(K-Dense·softaworks)는
    // 한 자산 = 한 스킬이라 `--skill` 을 썼지만, 여기 광고 문구가 "7 skills" 세트다 —
    // 한 개만 깔면 description 이 곧 거짓이 된다. 실호출 형태는 Docker 실설치(AC8)로 확인한다.
    method: { kind: "skill", source: "jakubkrehel/skills" },
  },
  {
    id: "taste-skill",
    tier: "vetted", // Leonxlnx/taste-skill 70,078 (2026-08-02)
    description:
      "Anti-slop frontend design — removes the boilerplate look of AI-generated UI; infers a design language and tunes VARIANCE/MOTION/DENSITY, with minimalist/brutalist/high-end style variants",
    category: "frontend",
    source: "Leonxlnx",
    condition: { kind: "opt-in" },
    // 리포에 스킬 14종(brandkit·brutalist·minimalist 등)이 있고 본체가 `taste-skill` —
    // 스타일 변형은 그 안에서 고른다. 다른 단일 대표 자산(remotion)과 같은 형태.
    method: { kind: "skill", source: "Leonxlnx/taste-skill", skill: "taste-skill" },
  },
  {
    id: "scroll-world",
    tier: "vetted", // oso95/scroll-world 6,863 (2026-08-02)
    description:
      "Scroll-driven 3D world landing pages — interviews for brand/scene direction, generates AI assets, then builds a continuous camera-flight scroll engine",
    category: "frontend",
    source: "oso95",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "oso95/scroll-world", skill: "scroll-world" },
  },
  // 2026-08-16 — Preline 은 Tailwind 컴포넌트 킷이지만 **프레임워크에 매이지 않는다**: htmx·
  // vanilla 에도 붙는다(사용자 확인). 그래서 `frontend` 이면서 React/Vue 트랙 전용이 아니다.
  //
  // 리포 안에 스킬은 `skills/theme-generator/` **하나**다 — 공식 문서는 이것을
  // "preline-theme-generator" 라 부르지만 실제 디렉터리명은 `theme-generator` 이고,
  // `npx skills add` 가 보는 것은 디렉터리명이다(실측 2026-08-16). 문서 표기를 그대로 옮겼다면
  // 설치가 조용히 빗나갔다.
  //
  // 같은 날 조사한 flowbite 는 **넣지 않는다**: 에이전트용 제공물이 MCP 서버뿐인데, 이 저장소의
  // `.mcp.json` 조립은 트랙 조건만 읽어 opt-in 경로가 없다 — 넣으면 해당 트랙 전원에게 항상
  // 켜진다. 안 쓰는 사람에게 MCP 툴 스키마만큼의 상주 비용을 물리는 형태라 기각(사용자 확정).
  {
    id: "preline",
    tier: "vetted", // htmlstreamofficial/preline 6,386 (2026-08-16)
    description:
      "Preline theme generator — turns a brand description into a Preline UI Tailwind theme (tokens, dark mode, component overrides); framework-agnostic, works with plain HTML and htmx",
    category: "frontend",
    source: "htmlstreamofficial",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "htmlstreamofficial/preline", skill: "theme-generator" },
  },

  // === dev tools (has_dev_track) ===
  // v26.110.0 (ADR-039) — code-review: /code-review 커맨드 1개 (다중 에이전트 confidence
  //   스코어링 PR 리뷰). 기본 리뷰 스택(reviewer·code-reviewer·security-reviewer)과 표면 중복
  //   + 최신 Claude Code 네이티브 /code-review 와 충돌 소지 → opt-in.
  {
    id: "code-review",
    tier: "official", // anthropics/claude-plugins-official (404.3K installs, 사용자 관측 2026-07-18)
    description: "code-review — multi-agent PR review with confidence scoring (Anthropic official)",
    category: "dev-tools",
    source: "anthropics",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "code-review@claude-plugins-official",
    },
  },
  // v26.110.0 (ADR-039) — security-guidance: 매 편집 패턴 경고 + LLM diff 리뷰 (훅 12파일,
  //   Python + Agent SDK 의존). 상시 훅 = 매 편집 비용 + 폭발 반경 — 실측 전 기본설치 금지
  //   (Context Cost NSM) → opt-in. security-reviewer 에이전트·agentshield ship 게이트와 보완.
  {
    id: "security-guidance",
    tier: "official", // anthropics/claude-plugins-official (220.8K installs, 사용자 관측 2026-07-18)
    description:
      "security-guidance — pattern-based security warnings on edits + LLM diff review (Anthropic official)",
    category: "dev-tools",
    source: "anthropics",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "security-guidance@claude-plugins-official",
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
  // v26.110.0 (ADR-039) — context7 플러그인은 **미등록** (검토 후 철회): templates/mcp.json ·
  //   codex config.toml.template · opencode 설정이 이미 @upstash/context7-mcp 를 기본 wiring —
  //   플러그인 추가 = 동일 서버 중복 등록이고 도달 범위도 더 좁다(plugin=claude-only vs
  //   템플릿=claude+codex+opencode). "문서 조회 기본 제공" 요구는 기충족.
  {
    id: "agent-browser",
    tier: "vetted", // vercel-labs/agent-browser 34k
    description:
      "agent-browser — agent-friendly Playwright wrapper (screenshot · DOM search CLI, dev tracks)",
    // v26.78.0 — Understanding 으로 재분류: 웹 지각(screenshot·DOM). 영상/코드 지각과 같은 축.
    category: "understanding",
    source: "vercel-labs",
    condition: { kind: "has-dev-track" },
    method: { kind: "npm", pkg: "agent-browser", version: "0.31.0" },
  },
  // v26.78.0 — Understanding 신규 3종 (plugin, opt-in). 에이전트 인지 증강: 영상·코드 지각 + 메모리.
  {
    id: "claude-video",
    tier: "vetted", // bradautomates/claude-video 1.8k
    description:
      "Claude Video — /watch downloads any video, extracts frames + transcript so Claude can see + hear it (yt-dlp/ffmpeg auto on first run)",
    category: "understanding",
    source: "bradautomates",
    condition: { kind: "opt-in" },
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
    condition: { kind: "opt-in" },
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
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "rohitg00/agentmemory",
      pluginId: "agentmemory@agentmemory",
    },
  },

  // === Visual & Media (v26.85.0) — 코드-퍼스트 제작 자산. 전부 opt-in. ===
  // Docker 실설치 검증 PASS (실 claude 2.1.177): plugin install / npx skills add resolve 확인.
  {
    id: "frontend-slides",
    tier: "vetted", // zarazhangrui/frontend-slides 21k
    description:
      "frontend-slides — dependency-free HTML slide decks (presets · templates · PPTX→HTML · PDF export)",
    category: "visual-media",
    source: "zarazhangrui",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "zarazhangrui/frontend-slides",
      pluginId: "frontend-slides@frontend-slides",
    },
  },
  {
    id: "marp-slide",
    tier: "vetted", // softaworks/agent-toolkit 2k
    description: "marp-slide — Marp Markdown slides (7 themes · PPTX/PDF export)",
    category: "visual-media",
    source: "softaworks",
    // softaworks plugin dir 는 plugin.json 부재 → skill 경로가 안전 (Docker 검증).
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "softaworks/agent-toolkit", skill: "marp-slide" },
  },
  {
    id: "mermaid-diagrams",
    tier: "vetted", // softaworks/agent-toolkit 2k
    description:
      "mermaid-diagrams — Mermaid flow/sequence/ER/state diagram authoring (code · docs)",
    category: "visual-media",
    source: "softaworks",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "softaworks/agent-toolkit", skill: "mermaid-diagrams" },
  },
  {
    id: "gsap-skills",
    tier: "vetted", // greensock/gsap-skills 9k (GSAP 본가 공식)
    description:
      "GSAP skills — official GreenSock motion/scroll animation guide (8 skills: timeline · scrolltrigger · react)",
    category: "visual-media",
    source: "greensock",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "greensock/gsap-skills",
      pluginId: "gsap-skills@gsap-skills",
    },
  },
  {
    // remotion: star 3.6k → vetted (star 기반 tier SSOT + trust-tier-drift CI 정합, 사용자 결정 2026-06-13).
    //   코어 BUSL(Business Source License) — opt-in + description 고지로 신중 취급 (경고 배지 대신).
    //   --skill 값 = remotion-best-practices (dir `remotion` ≠ frontmatter name, Docker 실측 확정).
    id: "remotion",
    tier: "vetted", // remotion-dev/skills 3.6k (license none — 출처 신뢰; 코어 BUSL 고지)
    description:
      "Remotion — programmatic MP4 video from React components (data-driven). Core license = BUSL",
    category: "visual-media",
    source: "remotion-dev",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "remotion-dev/skills", skill: "remotion-best-practices" },
  },
  // Issue #176 — 프레젠테이션 생성 스택 4종 (Docker 실설치 4/4 PASS: skills@1.5.11 add <src> --agent claude-code --skill, 2026-06-20).
  {
    id: "ppt-master",
    tier: "vetted", // hugohe3/ppt-master 29k
    description:
      "ppt-master — editable PowerPoint (.pptx) from any document (native shapes · speaker notes · custom .pptx template)",
    category: "visual-media",
    source: "hugohe3",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "hugohe3/ppt-master", skill: "ppt-master" },
  },
  {
    // deer-flow 72k 거대 harness지만 --skill 로 ppt-generation 단일 skill만 설치 (skills/public/ 중첩, Docker 확인).
    id: "ppt-generation",
    tier: "vetted", // bytedance/deer-flow 72k
    description:
      "ppt-generation — PPTX by generating an image per slide and composing into PowerPoint (deer-flow skill)",
    category: "visual-media",
    source: "bytedance",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "bytedance/deer-flow", skill: "ppt-generation" },
  },
  {
    id: "web-video-presentation",
    tier: "vetted", // ConardLi/garden-skills 8.4k
    description:
      "web-video-presentation — click-driven 16:9 web decks that look like video (optional TTS narration; garden-skills)",
    category: "visual-media",
    source: "ConardLi",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "ConardLi/garden-skills", skill: "web-video-presentation" },
  },
  {
    id: "revealjs",
    tier: "experimental", // ryanbbrown/revealjs-skill 347 (<1000 → experimental, opt-in + 경고)
    description:
      "reveal.js — polished HTML presentations (themes · multi-column · code highlight · speaker notes, no build step)",
    category: "visual-media",
    source: "ryanbbrown",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "ryanbbrown/revealjs-skill", skill: "revealjs" },
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
    // v26.106.0 (ADR-035, 사용자 승인 D): 순수 pattern-guide(일반 디자인 가이드라인) → opt-in 강등
    //   (T2 가설 전제 — taste 3종 중복 주장은 검증자 정정으로 기각, 근거는 P축 단독).
    id: "web-design-guidelines",
    tier: "vetted", // vercel-labs/agent-skills 27k (license none — 출처 신뢰)
    description:
      "Web design guidelines — Vercel's visual hierarchy · color · spacing (CSR · SSR · Next tracks)",
    category: "frontend",
    source: "vercel-labs",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/vercel-labs/agent-skills",
      skill: "web-design-guidelines",
    },
  },
  {
    // 2026-08-17 (사용자 지정) — 웹 게임 개발. **웹 전용이다**: 스킬 본문 frontmatter 가
    //   "HTML5, Canvas, WebGL, and JavaScript" 로 스스로 범위를 적고 있고 프레임워크도
    //   Phaser · Three.js · Babylon.js · A-Frame 이다. Unity/Unreal/Godot 은 안 덮으므로
    //   description 에 "web" 을 남긴다 — 엔진 이름을 지우면 네이티브 엔진까지 되는 것처럼 읽힌다.
    // opt-in 인 이유: frontend 트랙 사용자 대부분은 게임을 만들지 않는다. 게임 트랙은 아직 없다.
    id: "game-engine",
    tier: "vetted", // github/awesome-copilot 37,909★ (MIT, 2026-08-17 `gh api` 실측 · GitHub 공식 조직)
    description:
      "Game engine — web game development with HTML5 Canvas · WebGL (Phaser · Three.js · Babylon.js): game loop, physics, collision, sprites, tilemaps, gamepad input, WebRTC multiplayer",
    category: "frontend",
    source: "github",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/github/awesome-copilot",
      skill: "game-engine",
    },
  },
  {
    // 2026-08-17 (사용자 지정) — 게임 스튜디오 **프로세스** 스킬 73종.
    //
    // description 이 두 가지를 반드시 말해야 하는 이유 (둘 다 Docker 실측):
    //   ① **에이전트는 안 깔린다.** 리포의 엔진 전문성(`godot-specialist`·`unity-specialist`·
    //      `unreal-specialist`)은 49개 *에이전트*에 있는데 `npx skills add` 는 `.claude/skills/`
    //      만 가져온다(실측: 73 SKILL.md, settings.json·rules·hooks 미설치). "Unity 되나?" 로
    //      고른 사용자가 스프린트 계획 스킬을 받게 되므로 안 적으면 그게 거짓 광고다.
    //   ② **상주 ~4,440 tok/세션.** 73 descriptor 실측(17,760자/4). tooling 트랙 baseline 전체가
    //      ~5,037 tok 이라 이 자산 하나가 상주를 거의 두 배로 만든다 — 이 저장소의 1차 지표를
    //      가장 크게 움직이는 자산이라 선택 시점에 숫자가 보여야 한다.
    //
    // 저자의 공식 설치법은 `git clone` (프로젝트 템플릿)이다. 그 경로는 `.claude/settings.json`·
    // rules·hooks 를 함께 들여와 우리 하네스와 같은 자리를 다투므로 카탈로그에 넣지 않는다.
    id: "game-studios",
    tier: "vetted", // Donchitos/Claude-Code-Game-Studios 23,924★ (MIT · 최종 push 2026-05-21, 2026-08-17 `gh api` 실측)
    description:
      "Game studio workflow — 73 process skills (sprint-plan · qa-plan · playtest-report · release-checklist · art-bible · balance-check). Skills only: the repo's 49 engine agents (godot/unity/unreal-specialist) are NOT installed. ~4,440 tok/session resident",
    category: "workflow",
    source: "Donchitos",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/Donchitos/Claude-Code-Game-Studios",
    },
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
    id: "finance-skills",
    tier: "vetted", // alirezarezvani 16k
    description: "finance-skills (3 — financial analyst, SaaS metrics, investment advisor)",
    category: "business",
    source: "alirezarezvani",
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063)
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "finance-skills@claude-code-skills",
    },
  },

  // === Project Management Track (v0.5.0) ===
  // SPEC §3.5 — product-skills: has-dev-track + project-management 합집합 (executive/growth-marketing 제외).
  {
    id: "product-skills",
    tier: "vetted", // alirezarezvani 16k
    description: "product-skills (15 — RICE, PRD, agile PO, UX research, SaaS scaffolder ...)",
    category: "dev-tools",
    source: "alirezarezvani",
    // v26.106.0 (ADR-035, 사용자 승인 C): dev 8트랙 기본에서 제외 — PM 스킬 15종은 PM 트랙 목적
    //   자산. dev 트랙은 wizard 체크 / --with 로 opt-in.
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063)
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "alirezarezvani/claude-skills",
      pluginId: "product-skills@claude-code-skills",
    },
  },

  // === Growth Marketing Track (v0.5.0) ===
  // 2026-08-02 정비 — alirezarezvani 번들 4종(c-level·business-growth·pm·marketing) +
  //   research-summarizer 제거. 남는 마케팅 번들은 아래 coreyhaines31/marketingskills 하나로,
  //   동명이물(marketing-skills ≠ marketingskills) 병존도 이로써 해소된다.
  // v26.91.0 — coreyhaines31/marketingskills (35k★, MIT, plugin v2.5.1). opt-in =
  //   growth-marketing 외 전 트랙에서도 wizard 토글 + `--with marketingskills` 로 설치 가능
  //   ("SEO 는 일반 개발에도 활용" 충족: dev 트랙에서 본 번들 토글). 45 스킬 중 SEO 7종
  //   (seo-audit/schema/ai-seo/site-architecture/programmatic-seo/content/aso)은 상호참조
  //   (product-marketing 우선 + seo-audit↔schema↔ai-seo)라 부분 추출 시 포인터 깨짐 → 번들
  //   통째 설치만 정합. repoForAsset = marketplace(coreyhaines31/marketingskills) → drift 라이브.
  {
    id: "marketingskills",
    tier: "vetted", // coreyhaines31 35k
    description: "marketingskills (45 — CRO/copywriting/SEO/AI-SEO/ads/growth, coreyhaines31 35k★)",
    category: "business",
    source: "coreyhaines31",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "coreyhaines31/marketingskills",
      pluginId: "marketing-skills@marketingskills",
    },
  },
  // v26.76.0 — content-creator / demand-gen 제거: alirezarezvani/claude-skills marketplace.json 에
  // 해당 plugin 부재(Docker 실설치 검출, exit 1). 거짓 광고 0건 원칙(Promise=Implementation).

  // 2026-08-02 정비 — karpathy-coder 제거. Write|Edit 마다 Python complexity 검사를 돌리는
  //   상시 훅이었고, 그 검사는 현행 모델이 이미 하는 일이다 (Opus 5 가이드의 "legacy harness
  //   scaffolding"에 정확히 해당). 딸린 배선(`--with-karpathy-hook` 플래그 · templates/hooks/
  //   karpathy-gate.sh · settings.json PreToolUse auto-wire)도 함께 삭제 — BREAKING, ADR-060.

  // === Option-gated ===
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
    condition: { kind: "opt-in" },
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
    condition: { kind: "opt-in" },
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
 * v26.87.0 — dev-method skill ids (uzys 1st-party, internal templates). installer 의
 * `selectedInternalSkills` 계산 + manifest copy 게이팅 + 테스트가 공유하는 SSOT.
 * 각 id 는 method.kind==="internal" 이며 `templates/skills/<id>/SKILL.md` 로 번들된다.
 *
 * 2026-08-02 복원 (ADR-062) — 이관(ADR-060)으로 1종까지 줄었던 목록이 6종으로 돌아왔다.
 * 멤버십 기준은 **`condition.kind === "has-dev-track"` 인 번들 방법론 스킬**이다 (그 불변식을
 * `tests/external-assets.test.ts` 가 단언한다). 전 트랙(any-track)·opt-in 번들 스킬은 여기
 * 들어오지 않는다 — 조건이 섞이면 wizard 번들이 부분집합이 되어 사용자가 안 고른 자산을
 * 설치한다 (`tests/wizard-bundle.test.ts` 의 recommended ∩ members ∈ {∅, 전체}).
 * 현재 dev-method skills 6종.
 */
export const DEV_METHOD_SKILL_IDS: ReadonlyArray<string> = [
  "compaction-handoff",
  "clear-korean-communication",
  "audit-service-gaps",
  "multi-persona-review",
  "recurrence-prevention",
  "verification-loop",
];

/**
 * v26.95.0 — ALL repo-bundled internal skill ids (dev-method + opt-in advisors). Bundling is
 * condition-agnostic: manifest Claude dir-copy, the 3 non-Claude CLI transforms, and
 * gen-compatibility iterate THIS superset so every bundled skill renders across CLIs; each entry's
 * `condition` (has-dev-track vs opt-in) still gates whether it actually installs. Kept separate
 * from `DEV_METHOD_SKILL_IDS` so "dev-method" keeps meaning the has-dev-track methodology skills.
 *
 * 2026-08-02 복원 (ADR-062) — superset 이 다시 진부분집합이 됐다. dev-method 6종에 더해
 * 전 트랙 2종(north-star·gh-issue-workflow)과 opt-in 2종(model-orchestration·
 * external-model-consult)이 번들이다. 이 4종은 `DEV_METHOD_SKILL_IDS` 의 has-dev-track
 * 불변식을 깨거나(전자) wizard 번들을 부분집합으로 만들기(후자) 때문에 여기에만 있다.
 */
export const INTERNAL_BUNDLED_SKILL_IDS: ReadonlyArray<string> = [
  ...DEV_METHOD_SKILL_IDS,
  "north-star",
  "gh-issue-workflow",
  "task-brief",
  "audit-harness-fit",
  "model-orchestration",
  "external-model-consult",
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
    case "opt-in":
      // v26.81.0 (ADR-022) — 순수 opt-in: condition 으론 절대 설치 안 됨.
      //   forceInclude(wizard 체크 / --with <id>)가 shouldInstallAsset 상위에서 처리.
      return false;
  }
}

/**
 * v26.81.0 (ADR-022) — spec 에서 특정 자산의 선택 여부 판정.
 * 내부 자산(tauri-desktop)의 manifest/transform 게이팅이 이전
 * `spec.options.withTauri` 등 boolean 자리를 대체해 호출. (wizard 체크/--with 는
 * forceInclude 로 들어오므로 shouldInstallAsset 가 그대로 판정)
 */
export function isAssetSelected(
  assetId: string,
  ctx: {
    tracks: ReadonlyArray<Track>;
    options: OptionFlags;
    userOverride?: UserOverride;
  },
): boolean {
  const asset = EXTERNAL_ASSETS.find((a) => a.id === assetId);
  return asset ? shouldInstallAsset(asset, ctx) : false;
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
/**
 * v26.102.0 (ADR-031, Batch3) — 자산의 CLI 도달 범위. 별도 필드가 아니라 method.kind 에서
 * **derive** 한다: 도달 범위의 SSOT 는 installOne 의 실동작이며, 같은 사실을 entry 필드로
 * 중복 기입하면 kind 와 필드가 어긋나는 drift 가 가능해진다 (no-false-ship "동일 목록 2곳
 * 하드코딩 금지").
 *  - plugin: installPlugin 이 `claude plugin marketplace/install` 을 spawn — 구조적 claude 전용
 *  - shell-script: ecc-prune 이 `.claude/local-plugins/` 에 write — claude 전용
 *  - skill: skills CLI 가 `--agent` 매핑(SKILLS_CLI_AGENT_MAP)으로 선택 CLI 전부에 설치
 *  - npm/npx-run: 프로젝트 레벨 (CLI 무관)
 *  - internal: Phase 1 manifest/transform 이 CLI 별 렌더 (external spawn 단계 미도달)
 */
export function assetCliSupport(asset: ExternalAsset): CliTargets {
  // v26.102.0 SOD 리뷰 Critical-1 — kind 기본값이 거짓인 자산(bmad `--tools claude-code`)은
  // entry 의 cliSupportOverride 가 우선한다.
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
      // 공유 배열 원본 대신 사본 반환 — 타입 없는 소비자(gen-compatibility.mjs)의
      // in-place sort 가 CLI_BASES 를 전역 변형하는 사고 차단 (불변성 rule).
      return [...CLI_BASES];
  }
}

/**
 * 선택 CLI 와 자산 도달 범위의 교집합 여부. `cli` 가 빈 배열이면 레거시 관례
 * (buildSkillArgs 등 "미지정 = 전체")를 따라 필터하지 않는다.
 */
export function assetReachesCli(asset: ExternalAsset, cli: CliTargets): boolean {
  if (cli.length === 0) {
    return true;
  }
  const support = assetCliSupport(asset);
  return cli.some((c) => support.includes(c));
}

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

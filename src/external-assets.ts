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
import { hasDevTrack, hasUiTrack } from "./track-match.js";
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
        | "user-centered-explanation"
        | "north-star"
        | "audit-service-gaps"
        | "multi-persona-review"
        | "recurrence-prevention"
        | "gh-issue-workflow"
        | "model-orchestration"
        | "external-model-consult"
        // #729 (ADR-109) — 여러 실제 모델의 토론(개발 트랙 기본)과 브라우저 위임 3종(opt-in).
        | "multi-model-debate"
        | "gemini-delegate"
        | "chatgpt-delegate"
        | "genspark-delegate"
        // 위임·설계·다단계 작업의 요청을 canonical 브리프 형태로 정규화.
        | "objective-brief"
        // 설치된 상주 조종층(앵커·룰·훅·permissions·descriptor)의 밥값 감사 — 자기유지 루프.
        | "audit-harness-fit"
        // CI 가 멈췄을 때 워크플로를 복제하지 않고 self-hosted runner 로 돌린다.
        | "self-hosted-github-runner"
        // 한국어 답변·글쓰기·번역·퇴고 — 뜻과 말투를 살리며 번역투·상투구·기계적 반복을 줄인다.
        | "natural-korean"
        // v26.108.0 — CI 스캐폴드 (.github/workflows fill-in 템플릿). ADR-037.
        | "ci-scaffold"
        // #602 — 트랙 추종 UI 검수 스킬. .claude/ 전용 배선이 비-Claude 자리에 못 가던 것을
        // internal 카탈로그로 편입해 해소.
        | "ui-visual-review"
        // #709 (ADR-101) — 트랙 표(`templates/track-mcp-map.tsv`)의 같은 이름 행을 어느 트랙에서든 고르게 한다.
        //   번들 스킬이 아니다 — `.mcp.json` 렌더(`selectedMcpServers`)가 읽는다.
        | "railway-mcp-server"
        // #722 · #711 (ADR-106) — 같은 경로의 MCP 서버 행: 웹 트랙 기본 chrome-devtools · 기본 없는 원격 서버 둘.
        | "chrome-devtools"
        | "github-mcp"
        | "vercel"
        // #751 — 남은 기본 서버 둘도 같은 경로: 모든 트랙 기본 context7(패턴 `*`) · csr-supabase · full 기본 supabase.
        | "context7"
        | "supabase";
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
/**
 * #709 (ADR-101) — 스택에 **UI 가 있는** 트랙(csr-* · ssr-* · full). frontend-design 처럼 UI 를 만드는 도구는
 * 이 트랙에서만 미리 체크한다 — `base` 에 이어(#456 결정 B) UI 가 없는 `data` · `tooling` 도 뺀다. 열거하지 않고
 * `hasUiTrack` 에서 유도한다 — 트랙이 늘어도 여기가 뒤처지지 않는다.
 */
const UI_TRACKS: Track[] = TRACKS.filter((t) => hasUiTrack([t]));

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
  "base", // #456 — 스택 없는 dev 트랙
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
 * 외부 자산 매트릭스. bash setup-harness.sh@911c246~1 L791~1067 + 1320~1370 동등.
 *
 * 자산 수는 여기 적지 않는다 — SSOT 는 `EXTERNAL_ASSETS.length` 이고 사람이 읽는 수는
 * `docs/COMPATIBILITY.md` 서문이다(`tests/docs-supply-chain.test.ts` 가 대조). 여기 세어 적은
 * 수는 두 번째 사본이라 썩는다(#726 때 "50" 이 실제 52 였다). **들어오고 나간 이력은 여기
 * 쌓지 않는다** — 그건 ADR·CHANGELOG 것이고, 여기 쌓이면 다음 사람이 카탈로그 대신 이력을
 * 읽는다(#492 직전까지 11줄이 그랬다). 빠진 자산을 기존 설치본에 말하는 표는 `REMOVED_CATALOG_ASSETS`.
 *
 * 호출 순서: data → dev-baseline → railway → supabase-cli → dev-tools →
 * supabase-skills → react/ui → next → executive → GSD → security.
 */
export const EXTERNAL_ASSETS: ReadonlyArray<ExternalAsset> = [
  // === data Track ===
  {
    id: "anthropic-data-plugin",
    tier: "official", // anthropics/knowledge-work-plugins 18k
    description:
      "Anthropic data plugin — SQL exploration, analysis, and visualization workflows. Installing it does not connect your warehouse; that is a separate MCP setup",
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
  //   쓰는 첫 자산 — 기존 워크플로 파일은 절대 덮어쓰지 않는다 (src/ci-scaffold.ts,
  //   manifest 경유 아님 — CLI 선택과 무관하게 설치되는 CLI-agnostic 산출물).
  // ADR-105 (#726, 사용자 결정 2026-10-11) — opt-in 전용 → 개발 트랙 기본. 없을 때만 쓰는 계약은 그대로.
  {
    id: "ci-scaffold",
    tier: "official", // uzys 본 하네스 자체 템플릿
    description:
      "CI scaffold — .github/workflows fill-in templates (tag-triggered CI + real-DB service container + coverage gate + Playwright E2E); writes only when the file is absent, never overwrites existing workflow files",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "ci-scaffold" },
  },

  // === Repo-bundled internal skills (uzys 1st-party, v26.87.0) ===
  // 2026-08-02 복원 (ADR-062) — 이관(ADR-060) 후 감사에서 본문 열화 104건(dropped 76 ·
  //   damaged 28)이 확인돼 9종을 이 리포 번들로 되돌렸다. 아래 10종 전부 `kind: "internal"`.
  // #602 — ui-visual-review: TRACKS.md 가 말하는 트랙 추종 번들 스킬("follows the track, not
  // the catalog"). internal 카탈로그 자산으로 등록해 selectedInternalSkills 흐름에 태우면
  // .agents/skills(비-Claude 자리)에도 깔린다 — 종전의 .claude/ 전용 배선과 어긋나던 것.
  {
    id: "ui-visual-review",
    tier: "official", // uzys 자사 스킬
    description:
      "UI visual review — screenshot capture, baseline diff, and a review gate for UI changes (ships with UI tracks; ssr-htmx excluded)",
    category: "frontend",
    source: "uzys",
    condition: {
      kind: "any-track",
      tracks: ["csr-supabase", "csr-fastify", "csr-fastapi", "ssr-nextjs", "full"],
    },
    method: { kind: "internal", key: "ui-visual-review" },
  },
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
    // #485 — 전신 `clear-korean-communication` 개명. 이름이 "한국어 전용"으로 읽혀 영어 사용자에게
    // 닿지 않았다(사용자 결정 2026-09-20). 본문은 사용자가 검토한 개정안, 답변 언어는 사용자의 언어.
    id: "user-centered-explanation",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "User-centered explanation — explain problems, changes, and choices as what the user does and sees (impact and cause first, then evidence), in the user's language; covers decisions, approval requests, and AS-IS/TO-BE contrasts of screens and flows",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "user-centered-explanation" },
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
      "GitHub issue workflow — run work through issues so user and agent share one backlog: group tasks under a parent (epic) issue, order them with milestones and labels, read comments before starting, promote decisions into the body, and keep read-only, draft, external-write, and status stages distinct",
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
      "Model orchestration — decompose work by capability and route independent, bounded tasks to available agents while preserving ownership, permissions, and verification. Model names are Claude Code vocabulary; on other CLIs the same split maps onto that vendor's tiers",
    category: "workflow",
    source: "uzys",
    // ADR-105 (#726) — opt-in → 개발 트랙 기본.
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "model-orchestration" },
  },
  {
    // 전신 = gemini-consult + codex-consult. provider 중립 한 스킬로 통합됐다(통합은 유지 —
    //   되돌린 것은 배포 경로이지 통합이 아니다).
    id: "external-model-consult",
    tier: "official", // uzys 자사 스킬 리포
    description:
      "External model consult — ask an available external model/provider for an independent draft, critique, or provider-only output such as image generation (requires that provider's CLI)",
    category: "dev-tools",
    source: "uzys",
    // ADR-105 (#726) — opt-in → 개발 트랙 기본. 설치는 디렉터리 복사뿐이라 provider CLI 가 없어도
    //   설치는 성공한다 — 없으면 실행 시점에 래퍼가 멈추고 스킬이 "설치·로그인은 사용자 몫"을 알린다.
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "external-model-consult" },
  },
  {
    // #729 (ADR-109) — 토론 정책(참여자 · 독립성 · 라운드 · 예산 · 재시도 · 대체 · 복귀 · 통합)은 이 스킬만
    //   소유한다. 하위 경로(external-model-consult · 브라우저 위임 3종)는 실행 매개변수와 결과·상태만 맡는다.
    // has-dev-track 인 이유: 브라우저 전제가 없다 — external-model-consult 의 CLI 둘만으로 "서로 다른 실제 모델 2개"가
    //   성립하고, 없는 경로는 실행 시점에 unavailable 로 기록한다. DEV_METHOD 에 넣지 않는다(수단 — ADR-105 D2).
    id: "multi-model-debate",
    tier: "official", // uzys 자사 스킬
    description:
      "Multi-model debate — two or three different real models answer independently, then only decision-relevant disagreements are cross-examined and checked; uses whichever installed routes are available (external-model-consult CLIs or the browser delegates)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "multi-model-debate" },
  },
  // #729 (ADR-109, 사용자 결정 2026-10-12) — 브라우저 위임 3종은 opt-in. 실행 전제(브라우저 도구 · 로그인된 브라우저 ·
  //   그 서비스 계정)가 하네스 밖에 있고 Codex CLI 에는 브라우저가 없다(공식 문서). #489 가 agent-browser 를 opt-in 으로
  //   내린 축과 같다. 설치는 디렉터리 복사뿐이다 — `--with <id>` · 위저드 체크로 켠다.
  {
    id: "gemini-delegate",
    tier: "official", // uzys 자사 스킬
    description:
      "Gemini delegate — hand design, review, or Korean polishing to Gemini on the web and collect the answer (needs a browser tool + your logged-in browser)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "gemini-delegate" },
  },
  {
    id: "chatgpt-delegate",
    tier: "official", // uzys 자사 스킬
    description:
      "ChatGPT delegate — hand design, planning, or review to ChatGPT on the web and collect the answer (needs a browser tool + your logged-in browser)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "chatgpt-delegate" },
  },
  {
    id: "genspark-delegate",
    tier: "official", // uzys 자사 스킬
    description:
      "Genspark delegate — hand design or planning to Genspark AI Chat, or generate and download images with AI Image (needs a browser tool + your logged-in browser)",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "opt-in" },
    method: { kind: "internal", key: "genspark-delegate" },
  },
  {
    // 복원 9종이 아니라 신설이다 — 이관 이력이 없다.
    // 전 트랙인 이유: 위임과 요청 정규화는 개발 트랙의 행위가 아니라 **전 트랙의 행위**다.
    // executive 트랙도 서브에이전트에 일을 넘기고, 그때 브리프가 없으면 완료 판정 기준 없이 넘긴다.
    // ADR-088 (#426 F-04) — 전신 `task-brief` 개명. 문턱이 **위임 · 설계 · 다단계(피처/프로젝트
    //   규모 이상)** 로 좁혀졌고, 한 줄 요청마다 브리프를 권하던 매 프롬프트 넛지 훅과 상시 스킬
    //   안내(`CONTINUOUS_SKILLS`)가 함께 빠졌다. 이름이 그 문턱을 들고 있다.
    id: "objective-brief",
    tier: "official", // uzys 자사 스킬
    description:
      "Objective brief — normalize a delegation, a design task, or multi-step work at feature scale into the canonical brief (objective · inputs · invariants · success criteria · boundaries · autonomy · verification) and write every delegation prompt in that same shape",
    category: "workflow",
    source: "uzys",
    condition: { kind: "any-track", tracks: [...TRACKS] },
    method: { kind: "internal", key: "objective-brief" },
  },
  {
    // objective-brief 와 같은 신설이다 — 이관 이력이 없다.
    // 전 트랙인 이유: 이 하네스는 **모든 트랙에** 앵커·룰·훅을 깐다. 그 상주층이 밥값을 하는지
    // 되묻는 루프만 개발 트랙에 두면, 상주 비용은 전원이 무는데 감사는 일부만 갖는 비대칭이
    // 된다. 감사 대상이 개발 산출물이 아니라 **설치본 자신**이라 트랙 술어와 무관하다.
    // ADR-084 (#425) — 2판. 판정 근거가 공식 체크리스트 인용에서 **확정된 의도 + 리포 실증**으로
    //   바뀌었고, 모드 4개(audit · verification · apply · populate)를 SKILL.md 가 references 로
    //   라우팅한다. 비-Claude CLI 도 디렉터리째 받는 것이 전제다(#431).
    id: "audit-harness-fit",
    tier: "official", // uzys 자사 스킬
    description:
      "Audit harness fit — improve agent instructions and skills for autonomous, productive delivery with verifiable quality: resolve needless questions and repeated checks, conflicting decisions, missing actionable context, and low-value procedures; adapt guidance to demonstrated model and tool capabilities; also fill or refresh AGENTS.md / CLAUDE.md project context from repository evidence",
    category: "workflow",
    source: "uzys",
    condition: { kind: "any-track", tracks: [...TRACKS] },
    method: { kind: "internal", key: "audit-harness-fit" },
  },

  {
    // CI 가 멈췄을 때(결제 실패·쿼터 소진·Actions 장애) 검증을 포기하지도, 위조하지도 않는 절차.
    // has-dev-track 인 이유: 이건 **누가 요청해서 켜는 것이 아니라 사고가 났을 때 켜지는** 것이다.
    //   CI 가 죽고 나서야 필요해지는 자산을 opt-in 으로 두면, 정작 그 순간에 없다. 대신 executive
    //   트랙에는 깔지 않는다 — 거기엔 워크플로가 없다.
    // DEV_METHOD_SKILL_IDS 에 넣지 않는 이유: 저건 wizard 의 "하네스 방법론 N종" 묶음이고,
    //   이건 방법론이 아니라 사고 대응 런북이다. 묶음에 끼면 묶음의 뜻이 흐려진다.
    id: "self-hosted-github-runner",
    tier: "official", // uzys 자사 스킬
    description:
      "Self-hosted GitHub runner — when hosted runners stop (billing failure, spending limit, minutes exhausted, org quota, Actions outage), run the repo's existing workflow files unchanged on a Docker self-hosted runner instead of copying CI steps into a local script; covers runner-label switching, architecture and cache-key traps, container isolation, the risk that pull_request jobs then execute on your own machine, and the rollback path",
    category: "dev-tools",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "self-hosted-github-runner" },
  },

  {
    // 트랙과 무관한 글쓰기 규율이다. ADR-105 (#726, 사용자 결정 2026-10-11) — opt-in → 개발 트랙
    //   기본. 한국어로 쓰지 않는 설치자에게는 descriptor 상주가 낭비라는 대가를 받아들였다
    //   (빼려면 `--without natural-korean`).
    // user-centered-explanation 과의 경계: 저쪽은 **무엇을 어떤 형식으로 말할지**(설명·승인
    //   요청의 구조)이고, 이쪽은 **한국어로 쓰는 행위 자체**(답변·글쓰기·번역·퇴고)의 표현이다.
    // #428 — 전신 `humanize-korean`(#355, 진단-우선 퇴고)을 개명·교체했다. 범위가 퇴고에서
    //   쓰기·번역까지로 넓어져 이름이 뜻과 어긋났다. 옛 id 로 깐 설치본은 `update` 가 손대지
    //   않고(설치된 디렉터리만 갱신) 그대로 남는다 — 새 판은 `--with natural-korean` 으로 받는다.
    id: "natural-korean",
    tier: "official", // uzys 자사 스킬
    description:
      "Natural Korean — write, answer, translate, and revise in Korean that reads as Korean: keep meaning and register, cut translationese, needless English, stock phrases, and mechanical repetition; fix only what is actually awkward",
    category: "workflow",
    source: "uzys",
    condition: { kind: "has-dev-track" },
    method: { kind: "internal", key: "natural-korean" },
  },

  // === Option-gated (v26.42.0 — opt-in, BREAKING vs prior has-dev-track auto-install) ===
  {
    // v26.75.0 (ADR-021) — `npm i --save-dev @fission-ai/openspec` 후 `openspec init` 로 슬래시 주입.
    id: "openspec",
    tier: "vetted", // Fission-AI/OpenSpec 53k
    description:
      "OpenSpec — spec-driven change workflow for an existing codebase (propose → apply → archive). Use when your team has adopted a shared spec-and-delta process; it is a collaboration contract, not a coding aid",
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
    description:
      "BMAD-METHOD — multi-agent agile workflow (PM / Architect / Dev roles). Use for team-scale delivery with fixed roles; the pinned 6.9.0 still runs the full ceremony, so skip it for solo or small changes",
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
    description:
      "Railway skills — deploy and manage projects, services, and environments on Railway. Only for projects hosted on Railway; it drives a real account",
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
  // #709 (ADR-101) — Railway MCP 서버의 **선택** 경로. 서버 정의는 트랙 표(`templates/track-mcp-map.tsv`)의 같은 이름
  //   행 하나다(key === 행 이름). 그 행의 패턴이 기본 트랙(csr-* · ssr-htmx · full)을 정하고, 이 항목은 그 밖의 트랙
  //   (ssr-nextjs 등)에서 위저드 체크 · `--with` 로 고르게 한다. experimental 이라 조건으로는 미리 체크되지 않는다.
  //   #712 (ADR-106) — 행이 Railway 공식 원격 서버(`https://mcp.railway.com`, OAuth)로 바뀌었다. 이름 · 키 id 는 그대로라 기록이
  //   이어져 update 가 같은 키를 갈아 끼운다.
  {
    id: "railway-mcp-server",
    tier: "experimental", // railwayapp/cli 621★ (원격 서버에 공개 저장소가 따로 없다 — 같은 벤더의 CLI 를 감시, REPO_OVERRIDE)
    description:
      "Railway's official remote MCP (https://mcp.railway.com, signs in with OAuth on first use) in .mcp.json, Codex and OpenCode — default on csr-* · ssr-htmx · full; check it to add it on any other track",
    category: "backend",
    source: "railwayapp",
    condition: { kind: "opt-in" },
    // #709 리뷰 NOTE 3 — `.mcp.json` · Codex `[mcp_servers]` · `opencode.json` `mcp` 만 받는다. Antigravity 변환에는 MCP 가 없다
    //   (internal 기본값 = 4 CLI 는 과대 표기).
    cliSupportOverride: ["claude", "codex", "opencode"],
    method: { kind: "internal", key: "railway-mcp-server" },
  },
  // #711 (ADR-106) — Vercel 공식 원격 MCP. 트랙 표 행의 패턴은 `-`(기본 트랙 없음) — 어느 트랙에서도 미리 체크하지 않는다
  //   (사용자 확정 2026-10-11 "opt-in", ssr-nextjs 포함). Antigravity 는 MCP 를 받지 않는다(Vercel 승인 클라이언트에도 없다).
  {
    id: "vercel",
    tier: "vetted", // Vercel MCP 에 공개 저장소가 따로 없다 — 같은 벤더의 vercel/vercel 16k 를 감시(REPO_OVERRIDE)
    description:
      "Vercel's official remote MCP (https://mcp.vercel.com, signs in with OAuth on first use) in .mcp.json, Codex and OpenCode. Only if this project deploys to Vercel",
    category: "backend",
    source: "vercel",
    condition: { kind: "opt-in" },
    cliSupportOverride: ["claude", "codex", "opencode"],
    method: { kind: "internal", key: "vercel" },
  },
  // #722 (ADR-106) — GitHub 공식 원격 MCP 의 opt-in 경로. 기본에서 뺀 옛 `github`(@modelcontextprotocol/server-github, 상류
  //   deprecated)와 **다른 이름**이다 — 같은 이름이면 옛 설치본의 기록된 몫이 선택으로 읽혀 PAT 없는 설치자에게 매 세션 실패하는
  //   서버가 조용히 깔린다. 인증 = 환경변수 GITHUB_PAT(파일에는 이름만).
  {
    id: "github-mcp",
    tier: "vetted", // github/github-mcp-server 33.5k (REPO_OVERRIDE)
    description:
      "GitHub's official remote MCP server (api.githubcopilot.com) in .mcp.json, Codex and OpenCode — needs a GitHub personal access token in GITHUB_PAT in the shell you start the CLI from. Not needed when the agent uses the gh CLI",
    category: "dev-tools",
    source: "github",
    condition: { kind: "opt-in" },
    cliSupportOverride: ["claude", "codex", "opencode"],
    method: { kind: "internal", key: "github-mcp" },
  },
  // #722 (ADR-106) — Chrome DevTools MCP. 트랙 표 행이 웹 트랙(csr-* · ssr-* · full)의 기본이고, 이 항목은 그 밖의 트랙에서
  //   고르게 한다. Google 사용 통계는 행의 `--no-usage-statistics` 로 끈다.
  {
    id: "chrome-devtools",
    tier: "vetted", // ChromeDevTools/chrome-devtools-mcp 53k (REPO_OVERRIDE)
    description:
      "Chrome DevTools MCP — browser automation, console, network and performance tools for the agent. Default on csr-* · ssr-* · full; check it to add it on any other track. Google's usage statistics are turned off (--no-usage-statistics)",
    category: "understanding",
    source: "ChromeDevTools",
    condition: { kind: "opt-in" },
    cliSupportOverride: ["claude", "codex", "opencode"],
    method: { kind: "internal", key: "chrome-devtools" },
  },
  // #751 — Context7 MCP. 트랙 표 행의 패턴 `*` 가 모든 트랙의 기본이라 위저드 3단계에 늘 체크된 채 보이고, 풀거나
  //   `--without context7` 이면 `.mcp.json` · Codex · OpenCode 세 자리에서 빠진다(#709 · #722 와 같은 경로). 기본값은 그대로다.
  {
    id: "context7",
    tier: "vetted", // upstash/context7 62.9k (REPO_OVERRIDE)
    description:
      "Context7 MCP — current, version-specific library docs for the agent, in .mcp.json, Codex and OpenCode. Default on every track; uncheck it to leave it out",
    category: "understanding",
    source: "upstash",
    condition: { kind: "opt-in" },
    cliSupportOverride: ["claude", "codex", "opencode"],
    method: { kind: "internal", key: "context7" },
  },
  // #751 — Supabase MCP. 트랙 표 행이 csr-supabase · full 의 기본이고, 이 항목은 그 밖의 트랙에서 고르게 · 기본 트랙에서
  //   빼게 한다. 서버 정의(명령 · 인자)는 트랙 표 한 곳이다.
  {
    id: "supabase",
    tier: "vetted", // supabase/mcp 2.9k (REPO_OVERRIDE)
    description:
      "Supabase MCP server in .mcp.json, Codex and OpenCode. Default on csr-supabase · full; check it to add it on any other track. Only if this project uses Supabase",
    category: "backend",
    source: "supabase",
    condition: { kind: "opt-in" },
    cliSupportOverride: ["claude", "codex", "opencode"],
    method: { kind: "internal", key: "supabase" },
  },

  // === csr-supabase|full CLI ===
  {
    id: "vercel-cli",
    tier: "vetted", // vercel/vercel 16k
    description:
      "Vercel CLI — the real deploy tool as a devDependency (global under --scope global). Only if this project deploys to Vercel. Non-interactive `vercel link`/deploy needs `--scope` when your account has several teams (55.0.0+)",
    category: "backend",
    source: "vercel",
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063). #709 가 ssr-nextjs 기본으로 바꿨다가 #715 에서 되돌렸다 —
    //   설치자 package.json 에 의존성을 더하고(에이전트는 npx 로 쓸 수 있다) login 없이는 쓸 것이 없으며 핀이 낡는다.
    //   Vercel 공식 MCP 도 opt-in 이다(`vercel` 항목, #711 · ADR-106 — 사용자 확정 2026-10-11).
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "vercel", version: "63.1.2" },
  },
  {
    // v26.106.0 (ADR-035, 사용자 승인 B): 배포 CLI 2종 동시 기본의 중복 해소 — npm dl 실측 10.11:1
    //   (vercel 2.79M vs netlify 276k /주, 2026-07-18) → vercel 만 기본, netlify 는 opt-in.
    id: "netlify-cli",
    tier: "vetted", // netlify/cli 1.9k
    description:
      "Netlify CLI — the real deploy tool as a devDependency (global under --scope global). Only if this project deploys to Netlify",
    category: "backend",
    source: "netlify",
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "netlify-cli", version: "26.1.0" },
  },
  {
    id: "supabase-cli",
    tier: "vetted", // supabase 103k
    description:
      "Supabase CLI — the real Supabase tool as a devDependency (global under --scope global); first `supabase login` opens an OAuth browser flow. Only if this project uses Supabase",
    category: "backend",
    source: "supabase",
    // 2026-08-02 사용자 결정: 트랙 기본 → opt-in (ADR-063)
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "supabase", version: "2.108.0" },
  },

  // === UI tracks (csr-*|ssr-*|full) ===
  // v26.92.0 — frontend-design (Anthropic official).
  //   사용자 결정: has-dev-track 기본추천 (모든 개발 트랙, executive 제외).
  //   #709 (ADR-101) — UI 가 있는 트랙만(`UI_TRACKS`). data · tooling 은 미리 체크하지 않는다.
  //   category=frontend (UI 자산, wizard 그룹).
  //
  // 2026-08-26 (#344) — **plugin → skill.** 배달 방식이 도달 CLI 를 정한다(assetCliSupport):
  //   `plugin` 은 `claude plugin install` 을 spawn 하므로 **구조적으로 Claude Code 전용**이라,
  //   Codex·OpenCode·Antigravity 를 고른 사용자는 기본 추천 자산인데도 한 번도 받지 못했다
  //   (사용자 적발). 같은 스킬이 `anthropics/skills` 에 원본으로 있고 `npx skills add` 는
  //   `--agent` 로 네 CLI 전부에 깐다 — 실재 확인 2026-08-26: `skills/frontend-design/SKILL.md`.
  //   tier 는 official 그대로(저자 동일). marketplace 경유가 아니게 되어 upstream 판본을 직접 쓴다.
  {
    id: "frontend-design",
    tier: "official", // anthropics/skills (Anthropic 저자, ★171.5K — 2026-08-26 gh api 실측)
    description:
      "frontend-design — visual direction, typography, and anti-generic UI guidance (Anthropic official). For new UI or an explicit redesign; do not let it override an existing design system",
    category: "frontend",
    source: "anthropics",
    condition: { kind: "any-track", tracks: UI_TRACKS },
    method: { kind: "skill", source: "anthropics/skills", skill: "frontend-design" },
  },
  // 2026-08-02 정비 — 프론트엔드 품질 3종 (사용자 지시). 전부 opt-in: frontend-design 이 기본
  //   생성기이고 이 셋은 그 위의 취향·디테일 층이라 상시 비용을 물릴 근거가 없다 (ADR-032/035
  //   와 같은 축). star 는 각 tier 라인 주석 = 2026-08-02 `gh api` 실측.
  {
    id: "jakubkrehel-skills",
    tier: "vetted", // jakubkrehel/skills 2,602 (2026-08-02)
    description:
      "Better-* interface suite — one skill per concern: typography, OKLCH color, accessibility, layout, UX writing, component states. Add when you need a specific UI review, not as a default",
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
      "taste-skill — tunes the look of landing pages, portfolios, and redesigns (variance · motion · density). Not for dashboards or multi-step product UI",
    category: "frontend",
    source: "Leonxlnx",
    condition: { kind: "opt-in" },
    // 리포에 스킬 14종(brandkit·brutalist·minimalist 등)이 있고 본체가 `taste-skill` —
    // 스타일 변형은 그 안에서 고른다. 다른 단일 대표 자산(remotion)과 같은 형태.
    // 2026-09-20 (#420) — 업스트림이 SKILL.md 의 `name:` 을 `design-taste-frontend` 로 바꿨다. `npx skills
    // add --skill` 은 디렉터리명이 아니라 **frontmatter name** 으로 맞춘다(실측: 옛 이름은 "No matching
    // skills found", 새 이름은 설치 완료). 디렉터리는 여전히 `skills/taste-skill/` 이다.
    method: { kind: "skill", source: "Leonxlnx/taste-skill", skill: "design-taste-frontend" },
  },
  {
    id: "scroll-world",
    tier: "vetted", // oso95/scroll-world 6,863 (2026-08-02)
    description:
      "scroll-world — scroll-driven 3D landing pages with generated media assets. A special production pipeline that needs external image/video services; only when that effect is requested",
    category: "frontend",
    source: "oso95",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "oso95/scroll-world", skill: "scroll-world" },
  },
  // 2026-08-16 — Preline 은 Tailwind 컴포넌트 킷이지만 **프레임워크에 매이지 않는다**: htmx·
  // vanilla 에도 붙는다(사용자 확인). 그래서 `frontend` 이면서 React/Vue 트랙 전용이 아니다.
  //
  // 리포 안에 테마 스킬은 `skills/theme-generator/` 하나다. 2026-08-16 실측에서는 `npx skills add`
  // 가 디렉터리명(`theme-generator`)으로 맞췄는데, 2026-09-01 부터 그 이름이 "No matching skills
  // found" 가 됐다(#420) — 지금은 SKILL.md 의 `name:`(`preline-theme-generator`)으로 맞춘다(실측
  // 2026-09-20: 옛 이름 exit 1 · 새 이름 설치 완료). 이름이 바뀌면 월 1회 catalog-verify 가 잡는다.
  //
  // 같은 날 조사한 flowbite 는 **넣지 않는다**: 에이전트용 제공물이 MCP 서버뿐인데, 그때 이 저장소의
  // `.mcp.json` 조립은 트랙 조건만 읽어 opt-in 경로가 없었다 — 넣으면 해당 트랙 전원에게 항상
  // 켜진다. 안 쓰는 사람에게 MCP 툴 스키마만큼의 상주 비용을 물리는 형태라 기각(사용자 확정).
  // #709 (ADR-101) 부터는 카탈로그 `internal` 항목으로 opt-in 경로가 있다(`railway-mcp-server`). flowbite 는
  // 그 경로로 다시 심사할 수 있다 — 이 변경은 넣지 않는다.
  {
    id: "preline",
    tier: "vetted", // htmlstreamofficial/preline 6,386 (2026-08-16)
    description:
      "Preline theme generator — turns a brand description into a Preline UI Tailwind theme (tokens, dark mode, overrides) with a local generator script. Only for projects that use Preline",
    category: "frontend",
    source: "htmlstreamofficial",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "htmlstreamofficial/preline",
      skill: "preline-theme-generator",
    },
  },

  // === dev tools (has_dev_track) ===
  // v26.110.0 (ADR-039) — security-guidance: 매 편집 패턴 경고 + LLM diff 리뷰 (훅 12파일,
  //   Python + Agent SDK 의존). 상시 훅 = 매 편집 비용 + 폭발 반경 — 실측 전 기본설치 금지
  //   (Context Cost NSM) → opt-in. Claude Code `/security-review`·agentshield ship 게이트와 보완.
  {
    id: "security-guidance",
    tier: "official", // anthropics/claude-plugins-official (220.8K installs, 사용자 관측 2026-07-18)
    description:
      "security-guidance — pattern warnings on every edit plus an LLM review of diffs and commits (Anthropic official). Weigh it against security tools you already run: overlap, false positives, and cost per edit",
    category: "dev-tools",
    source: "anthropics",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "security-guidance@claude-plugins-official",
    },
  },
  // v26.110.0 (ADR-039) — context7 플러그인은 **미등록** (검토 후 철회): 트랙 표(#751 전 templates/mcp.json) ·
  //   codex config.toml.template · opencode 설정이 이미 @upstash/context7-mcp 를 기본 wiring —
  //   플러그인 추가 = 동일 서버 중복 등록이고 도달 범위도 더 좁다(plugin=claude-only vs
  //   템플릿=claude+codex+opencode). "문서 조회 기본 제공" 요구는 기충족.
  {
    id: "agent-browser",
    tier: "vetted", // vercel-labs/agent-browser 34k
    description:
      "agent-browser — drives a real browser from the terminal (Playwright wrapper: screenshots, DOM search). Only if your CLI has no equivalent browser tool",
    // v26.78.0 — Understanding 으로 재분류: 웹 지각(screenshot·DOM). 영상/코드 지각과 같은 축.
    category: "understanding",
    source: "vercel-labs",
    // #489 (사용자 결정 2026-09-20 a) — 기본 체크에서 opt-in 으로. computer-use 가 같은 일을 하고,
    // 셋 중 설치 비용이 가장 크다(npm devDep → 안 쓰는 프로젝트에 node_modules 만 남는다).
    // 3단계에는 그대로 뜨되 체크 해제, `--with agent-browser` 로 켠다. 기존 설치본은 영향 없음.
    condition: { kind: "opt-in" },
    method: { kind: "npm", pkg: "agent-browser", version: "0.31.0" },
  },
  // v26.78.0 — Understanding 신규 3종 (plugin, opt-in). 에이전트 인지 증강: 영상·코드 지각 + 메모리.
  {
    id: "claude-video",
    tier: "vetted", // bradautomates/claude-video 1.8k
    description:
      "Claude Video — fetches a video from a URL, extracts frames and a transcript so the agent can see and hear it. For video evidence, not general image understanding",
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
      "Understand Anything — builds an interactive knowledge graph and dashboard of your codebase. For visual exploration of a large codebase; the graph costs time to build and keep current",
    category: "understanding",
    source: "Lum1104",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "Lum1104/Understand-Anything",
      pluginId: "understand-anything@understand-anything",
    },
  },

  // === Visual & Media (v26.85.0) — 코드-퍼스트 제작 자산. 전부 opt-in. ===
  // Docker 실설치 검증 PASS (실 claude 2.1.177): plugin install / npx skills add resolve 확인.
  {
    id: "frontend-slides",
    tier: "vetted", // zarazhangrui/frontend-slides 21k
    description:
      "frontend-slides — dependency-free HTML slide decks with PPTX-to-HTML and PDF export scripts. When an HTML deck is the actual deliverable",
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
    description:
      "marp-slide — Marp Markdown slides with 7 themes and PPTX/PDF export. Only for a Marp-based workflow",
    category: "visual-media",
    source: "softaworks",
    // softaworks plugin dir 는 plugin.json 부재 → skill 경로가 안전 (Docker 검증).
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "softaworks/agent-toolkit", skill: "marp-slide" },
  },
  {
    id: "gsap-skills",
    tier: "vetted", // greensock/gsap-skills 9k (GSAP 본가 공식)
    description:
      "GSAP skills — GreenSock's own guide to timelines, ScrollTrigger, and framework lifecycle cleanup. Only for projects that already use GSAP; not a reason to pick it",
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
      "Remotion — programmatic MP4 video from React components (core license BUSL). The skill is a reference; the renderer and its environment are a separate install",
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
      "ppt-master — editable PowerPoint (.pptx) from a document, with native shapes, speaker notes, and your own template. When the deliverable must stay editable in PowerPoint",
    category: "visual-media",
    source: "hugohe3",
    condition: { kind: "opt-in" },
    method: { kind: "skill", source: "hugohe3/ppt-master", skill: "ppt-master" },
  },
  {
    // ADR-104 (#726) — web-video-presentation 의 교체. plugin 인 이유: skill 방식이면 상류 CLI 가
    //   작업 중 `npx hyperframes skills update`/`init` 으로 같은 스킬 디렉터리를 다시 쓰고 prune 해
    //   설치 기록(#573 sha)과 어긋난다. plugin 모드는 그 런타임 설치를 상류가 스스로 금한다.
    //   Anthropic 공식 마켓플레이스 항목(sha 고정 URL 소스, 내용 저자 HeyGen) — 그래서 tier official.
    id: "hyperframes",
    tier: "official", // anthropics/claude-plugins-official 등재 (heygen-com/hyperframes)
    description:
      "HyperFrames — write video as HTML and render it to MP4 (headless Chrome + FFmpeg): narrated explainers, slideshow-style decks, captions and voice-over. Rendering needs Node 22+ and FFmpeg",
    category: "visual-media",
    source: "heygen-com",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "hyperframes@claude-plugins-official",
    },
  },

  // === Supabase agent-skills (csr-supabase|full) ===
  {
    id: "supabase-agent-skills",
    tier: "vetted", // supabase/agent-skills 2.2k
    description:
      "Supabase agent skills — auth, RLS, edge functions, realtime, and current docs (Supabase official). Only for projects on Supabase; pre-checked on csr-supabase and full",
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
      "Postgres best practices — schema, index, and query optimization reference (Supabase official). Reach for it when designing tables or fixing slow queries, not on every edit",
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
      "React best practices — Vercel's data-fetching order, server rendering, serialization, and cache guidance. For performance work in React, not every component edit",
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
    description:
      "shadcn/ui — reads this project's component config and registry so the agent adds components the way your setup expects (shadcn official). Only for projects that use shadcn",
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
      "Web design guidelines — Vercel's review checklist for hierarchy, color, spacing, and accessibility. A review aid, not a generator; frontend-design covers the default",
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
      "Game engine — web game development with HTML5 Canvas / WebGL (Phaser, Three.js, Babylon.js): game loop, physics, sprites, tilemaps, input. Web games only, not Unity or Unreal",
    category: "frontend",
    source: "github",
    condition: { kind: "opt-in" },
    method: {
      kind: "skill",
      source: "https://github.com/github/awesome-copilot",
      skill: "game-engine",
    },
  },
  // === Executive tracks ===
  {
    id: "anthropic-document-skills",
    tier: "official", // anthropics/skills 144k
    description:
      "Anthropic document skills — pptx / docx / xlsx / pdf authoring with real scripts (slide duplication, OOXML validation, thumbnails). For document deliverables",
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
    description:
      "finance-skills — financial analyst, SaaS metrics, and investment advisor skills with calculation scripts. For financial analysis work; the tools matter more than the role names",
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
    description:
      "marketingskills — SEO, conversion, ads, content, and measurement (45 skills, cross-referenced). For marketing work; too broad as a default on a development track",
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
    // ADR-104 (#726) — trailofbits-skills(differential-review)의 교체. Anthropic 공식 플러그인.
    //   `git push` 에 훅을 걸고 스캔이 시간·토큰을 쓰므로 opt-in 이다.
    id: "claude-security",
    tier: "official", // anthropics/claude-plugins-official 등재 (./plugins/claude-security)
    description:
      "Claude Security — on-request vulnerability scan of a branch, PR, or commit diff; a verifier agent challenges each finding and results are tallied in code; asks you to confirm the cost before it starts. For a light diff check, the built-in /security-review is enough",
    category: "dev-tools",
    source: "anthropics",
    condition: { kind: "opt-in" },
    method: {
      kind: "plugin",
      marketplace: "anthropics/claude-plugins-official",
      pluginId: "claude-security@claude-plugins-official",
    },
  },
];

/**
 * ADR-104 (#726) — 카탈로그에서 빠진 외부 자산. **설치 기록에** 이 id 가 남은 설치본에게 update 화면이
 * 할 말을 정한다(자산마다 한 줄 — 빠졌다/바뀌었다 · 깐 것은 남는다 · 새 것 받기 · 옛 것 치우기).
 *
 * 기록에서만 고른다 — 디스크 존재는 소유의 증거가 아니다(ADR-096). 같은 이름을 설치자가 하네스 밖에서
 * 직접 깔았을 수 있어서 `RETIRED_SKILL_IDS`(디스크로 찾는다, 번들 스킬 전용)와 가른다. 지우지 않는다
 * (ADR-093). `replacedBy` 는 지금 카탈로그에 실재해야 한다(🧪 `tests/external-assets.test.ts`).
 */
export const REMOVED_CATALOG_ASSETS: Readonly<Record<string, { replacedBy?: string }>> = {
  "product-skills": {},
  agentmemory: {},
  revealjs: {},
  "trailofbits-skills": { replacedBy: "claude-security" },
  "web-video-presentation": { replacedBy: "hyperframes" },
};

/**
 * v26.87.0 — dev-method skill ids (uzys 1st-party, internal templates). installer 의
 * `selectedInternalSkills` 계산 + manifest copy 게이팅 + 테스트가 공유하는 SSOT.
 * 각 id 는 method.kind==="internal" 이며 `templates/skills/<id>/SKILL.md` 로 번들된다.
 *
 * 2026-08-02 복원 (ADR-062) — 이관(ADR-060)으로 1종까지 줄었던 목록이 6종으로 돌아왔다.
 * 멤버십 기준은 **`condition.kind === "has-dev-track"` 인 번들 방법론 스킬**이다 (그 불변식을
 * `tests/external-assets.test.ts` 가 단언한다). 역은 성립하지 않는다 — has-dev-track 번들 스킬이라도
 * 방법론이 아니면(self-hosted-github-runner 런북 · model-orchestration · external-model-consult ·
 * natural-korean 수단, ADR-105) 여기 넣지 않는다. 이 목록은 설치 여부를 정하지 않는다(설치 선택은
 * `INTERNAL_BUNDLED_SKILL_IDS` + 각 condition) — 문서 수치·테스트가 쓰는 분류다.
 */
export const DEV_METHOD_SKILL_IDS: ReadonlyArray<string> = [
  "compaction-handoff",
  "user-centered-explanation",
  "audit-service-gaps",
  "multi-persona-review",
  "recurrence-prevention",
];

/**
 * v26.95.0 — ALL repo-bundled internal skill ids (dev-method + other bundled skills). Bundling is
 * condition-agnostic: manifest Claude dir-copy, the 3 non-Claude CLI transforms, and
 * gen-compatibility iterate THIS superset so every bundled skill renders across CLIs; each entry's
 * `condition` (has-dev-track vs opt-in) still gates whether it actually installs. Kept separate
 * from `DEV_METHOD_SKILL_IDS` so "dev-method" keeps meaning the has-dev-track methodology skills.
 *
 * 2026-08-02 복원 (ADR-062) — superset 이 다시 진부분집합이 됐다. dev-method 에 더해 전 트랙
 * 번들(north-star·gh-issue-workflow 등)과 방법론이 아닌 has-dev-track 번들(model-orchestration·
 * external-model-consult·natural-korean·self-hosted-github-runner, ADR-105)이 여기에만 있다.
 */
export const INTERNAL_BUNDLED_SKILL_IDS: ReadonlyArray<string> = [
  ...DEV_METHOD_SKILL_IDS,
  // #602 — 트랙을 따라가는 번들 스킬(csr-*·ssr-*·full). selectedInternalSkills 로 흘러야
  // .agents/skills(비-Claude 자리)에도 깔린다 — manifest 의 UI_SKILL_DIRS 배선은 .claude/ 만
  // 알아 TRACKS.md 와 어긋났다. 조건은 buildAssetSpec 이 UI 트랙으로 건다.
  "ui-visual-review",
  "north-star",
  "gh-issue-workflow",
  "objective-brief",
  "audit-harness-fit",
  "model-orchestration",
  "external-model-consult",
  "self-hosted-github-runner",
  "natural-korean",
  // #729 (ADR-109) — 토론(개발 트랙 기본) + 브라우저 위임 3종(opt-in). condition 이 설치를 가른다.
  "multi-model-debate",
  "gemini-delegate",
  "chatgpt-delegate",
  "genspark-delegate",
];

/**
 * ADR-085 (#427) — **매 응답·매 위임에 적용되는** 번들 스킬.
 *
 * 스킬 본문은 프롬프트가 그 스킬의 일처럼 보일 때 열린다. 그건 작업형 스킬에는 충분하고 여기
 * 적힌 것들에는 부족하다 — "모든 답변에" · "모든 위임에" 는 어떤 프롬프트도 닮지 않아서, 어딘가에
 * 한 줄이 없으면 영영 안 열린다(ADR-068 실측). 그 한 줄은 v26.150.0 까지 배포 앵커 꼬리절이
 * 들고 있었는데, 앵커가 전역 6원칙과 **바이트 동일**해지면서(ADR-085) 자리를 옮겼다:
 * 설치기가 **실제로 깐 스킬만** 골라 프로젝트 맥락 블록에 적는다(`renderContinuousSkillsNote`).
 * 앵커의 "where installed" 조건문보다 정확하다 — 안 깐 스킬 이름이 상주하지 않는다.
 *
 * 문장은 설치자의 에이전트가 읽는 지시문이다. 한 줄 = 언제 적용되는가 뿐, 설명·이력 없음.
 *
 * ADR-088 (#426 F-04) — `objective-brief`(구 `task-brief`)가 여기서 빠졌다. 그 스킬은 위임·설계·
 * 다단계 작업에만 쓰므로 "매 응답·매 위임" 축이 아니고, 상시 안내로 두면 한 줄 요청에도 브리프가
 * 앞섰다. 발화는 스킬 descriptor 가 맡는다.
 */
export const CONTINUOUS_SKILLS: ReadonlyArray<{ id: string; whenToApply: string }> = [
  {
    // #493 (#485 분리, 사용자 결정 2026-09-20) — 상주 한 줄의 문안은 사용자가 이슈에 적은 원칙이다:
    // 평소 설명부터 사용자 행동·결과를 먼저, 재설명·UX 전후·중요한 선택 정리는 스킬로.
    id: "user-centered-explanation",
    whenToApply:
      "when explaining a development problem, change, or choice to the user, explain what the user does and sees before internal implementation — in every answer and report, not only when approval is asked for; for a detailed re-explanation, a UX before/after comparison, or laying out an important decision, apply this skill",
  },
  {
    id: "model-orchestration",
    whenToApply:
      "when work is delegated, it decides which lane takes the work and how that lane is run",
  },
];

/**
 * 개명된 스킬 id (old → new). ADR-088 (#426 F-04) · #428(humanize-korean → natural-korean).
 *
 * `update` 는 **설치된 디렉터리만** 갱신하므로 옛 id 로 깐 설치본은 그대로 남는다 — 지우지 않는
 * 것이 현행 규율이다(남의 프로젝트 파일을 우리가 삭제하지 않는다). 그래서 화면이 대신 말한다:
 * 무엇이 무엇으로 바뀌었고 새 판을 어떻게 받는지. 렌더는 이 맵만 읽는다(`install-render.ts`).
 */
export const RENAMED_SKILL_IDS: Readonly<Record<string, string>> = {
  "task-brief": "objective-brief",
  "humanize-korean": "natural-korean",
  // #485 (2026-09-20) — 새 이름은 `new-skills` 묶음(#480 ①)이 같은 update 에서 깐다.
  "clear-korean-communication": "user-centered-explanation",
};

/**
 * 은퇴한 스킬 id — 카탈로그에도 번들에도 없고 대체 id 도 없다. ADR-088 (#426 F-09 · F-10 · F-11).
 *
 * `RENAMED_SKILL_IDS` 와 가르는 이유: "새 이름으로 받아라"와 "이제 안 쓴다"는 사용자가 할 일이
 * 다르다. 한 문구로 뭉치면 은퇴한 스킬의 새 판을 찾아 헤매게 된다.
 */
export const RETIRED_SKILL_IDS: ReadonlyArray<string> = [
  "strategic-compact",
  "continuous-learning-v2",
  "spec-scaling",
  // ADR-090 (#452) — 관측 없는 자산 은퇴. 앞 세 종과 같은 경로로 안내한다.
  "verification-loop",
  "deep-research",
  "eval-harness",
  "agent-introspection-debugging",
  // #492 — ECC cherry-pick 스킬 7종 은퇴. 번들에서 빠졌으니 설치본에 남은 디렉터리는 죽은
  // 사본이다 — `update` 화면이 "지워도 된다"를 말하고 삭제는 사용자가 한다(위와 같은 규율).
  "python-patterns",
  "python-testing",
  "e2e-testing",
  "nextjs-turbopack",
  "market-research",
  "investor-materials",
  "investor-outreach",
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

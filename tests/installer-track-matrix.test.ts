/**
 * Track 매트릭스 검증 — 11 Track × external asset 매핑 (v0.5.0).
 *
 * SPEC: docs/specs/new-tracks-pm-growth.md AC3 (이전 docs/specs/cli-rewrite-completeness.md F4, AC2)
 *
 * 각 Track에 대해 runExternalInstall이 정확히 어떤 자산 ID들을 호출하는지 검증.
 * 실제 spawn은 mock으로 차단 (no real `claude plugin install`).
 *
 * 매핑 출처: src/external-assets.ts (bash setup-harness.sh@911c246~1 등가).
 */
import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { EXTERNAL_ASSETS } from "../src/external-assets.js";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { DEFAULT_OPTIONS, type OptionFlags, TRACKS, type Track } from "../src/types.js";

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function makeMockSpawn(): SpawnFn & { mock: { calls: Array<Parameters<SpawnFn>> } } {
  return vi.fn(() => ok()) as unknown as SpawnFn & {
    mock: { calls: Array<Parameters<SpawnFn>> };
  };
}

function runForTrack(
  tracks: Track[],
  options: Partial<OptionFlags> = {},
  // v26.81.0 (ADR-022) — 자산 opt-in 은 forceInclude(--with <id>) 로 전달.
  forceInclude: string[] = [],
): { ids: string[]; spawnCallCount: number } {
  const spawn = makeMockSpawn();
  const report = runExternalInstall(
    {
      tracks,
      options: { ...DEFAULT_OPTIONS, ...options },
      cli: ["claude"],
      ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
    },
    { spawn, log: () => {}, warn: () => {}, assets: EXTERNAL_ASSETS },
  );
  return {
    ids: report.attempted.map((r) => r.asset.id),
    spawnCallCount: spawn.mock.calls.length,
  };
}

describe("Track matrix — assets called per track", () => {
  it("tooling: dev baseline + dev-tools (v26.106.0 ADR-035 — product-skills 는 PM 트랙 한정)", () => {
    const { ids } = runForTrack(["tooling"]);
    // v26.42.0 — addy-agent-skills moved to option-gated (withAddyAgentSkills).
    // v26.71.1 — playwright-skill (T3 experimental) 는 opt-in only (PRD R6) → default 제외.
    // v26.78.0 — agent-browser 가 dev-tools → understanding 재분류 → 카테고리 정렬상 맨 뒤로.
    // v26.92.0 — frontend-design (official, has-dev-track) 추가. category=frontend → 정렬상 맨 앞.
    // v26.106.0 (ADR-035 사용자 승인 C) — product-skills 는 project-management 한정 → dev 트랙 제외.
    // v26.110.0 (ADR-039) — 신규 3종은 전부 opt-in → 기본 집합 불변 (context7 plugin 은 미등록).
    // 2026-08-02 (ADR-060) — karpathy-coder 삭제 · uzys 이관 스킬 7종이 kind:skill 로 합류.
    expect(ids).toEqual([
      "frontend-design",
      "audit-service-gaps",
      "verification-loop",
      "multi-persona-review",
      "find-skills",
      "agent-browser",
      "clear-korean-communication",
      "north-star",
      "recurrence-prevention",
      "gh-issue-workflow",
    ]);
    expect(ids).not.toContain("product-skills");
  });

  it("data: 3 data-specific + dev baseline + dev-tools (v26.106.0 ADR-035)", () => {
    const { ids } = runForTrack(["data"]);
    // v26.71.1 — playwright-skill (T3) opt-in only → 제외.
    // v26.78.0 — agent-browser 가 understanding 재분류 → 카테고리 정렬상 맨 뒤로.
    // v26.92.0 — frontend-design (official, has-dev-track) → category=frontend 정렬상 맨 앞.
    // v26.106.0 (ADR-035 승인 A·C) — 일반 Python 패턴 2종 opt-in 강등 + product-skills PM 한정.
    // 2026-08-02 (ADR-060) — polars/dask/karpathy 삭제 · uzys 이관 7종 합류.
    expect(ids).toEqual([
      "frontend-design",
      "anthropic-data-plugin",
      "audit-service-gaps",
      "verification-loop",
      "multi-persona-review",
      "find-skills",
      "agent-browser",
      "clear-korean-communication",
      "north-star",
      "recurrence-prevention",
      "gh-issue-workflow",
    ]);
  });

  it("csr-fastapi: dev baseline + UI(react+shadcn) — taste 가이드는 opt-in (v26.106.0 ADR-035)", () => {
    const { ids } = runForTrack(["csr-fastapi"]);
    // v0.6.3 — railway-plugin entry 제거. v26.71.1 — railway-skills(T3) opt-in only → default 제외.
    expect(ids).not.toContain("railway-skills");
    expect(ids).not.toContain("railway-plugin");
    expect(ids).not.toContain("addy-agent-skills"); // v26.42.0 — option-gated
    // csr-* matches CSR_SSR_NEXTJS_FULL set → react/shadcn applies
    expect(ids).toContain("react-best-practices");
    expect(ids).toContain("shadcn-ui");
    // v26.106.0 (ADR-035 승인 D + 사용자 결정) — taste 가이드 2종 opt-in 강등 (frontend-design 이 기본).
    expect(ids).not.toContain("impeccable");
    expect(ids).not.toContain("web-design-guidelines");
    expect(ids).not.toContain("vercel-cli"); // csr-supabase only
    expect(ids).not.toContain("polars-K-Dense"); // data only
  });

  it("csr-supabase: Vercel/Supabase CLI + supabase-skills + UI (v26.106.0 ADR-035)", () => {
    const { ids } = runForTrack(["csr-supabase"]);
    expect(ids).toEqual(
      expect.arrayContaining([
        "vercel-cli",
        "supabase-cli",
        "supabase-agent-skills",
        "postgres-best-practices",
        "react-best-practices",
        "shadcn-ui",
      ]),
    );
    // v26.106.0 (ADR-035 승인 B·D) — netlify-cli(배포 CLI 중복, dl 10:1 실측) + taste 가이드 2종 opt-in.
    expect(ids).not.toContain("netlify-cli");
    expect(ids).not.toContain("web-design-guidelines");
    expect(ids).not.toContain("impeccable");
    expect(ids).not.toContain("railway-plugin"); // not in csr-supabase per matrix
  });

  it("ssr-nextjs: React/Next stack (railway-skills T3 opt-in, taste 가이드 opt-in)", () => {
    const { ids } = runForTrack(["ssr-nextjs"]);
    // v26.71.1 — railway-skills (T3 experimental) opt-in only (PRD R6) → default 제외.
    expect(ids).toEqual(expect.arrayContaining(["react-best-practices", "shadcn-ui"]));
    // v26.106.0 (ADR-035) — taste 가이드 2종 opt-in 강등.
    expect(ids).not.toContain("web-design-guidelines");
    expect(ids).not.toContain("impeccable");
    expect(ids).not.toContain("railway-skills");
  });

  it("ssr-htmx: 트랙 조건 자산 없음 — dev baseline 만 (v26.106.0 ADR-035, impeccable opt-in)", () => {
    const { ids } = runForTrack(["ssr-htmx"]);
    // v26.71.1 — railway-skills(T3) opt-in only → default 제외.
    expect(ids).not.toContain("railway-skills");
    // v26.106.0 (ADR-035 사용자 결정) — impeccable opt-in 강등: htmx 트랙 조건 자산은 dev baseline 뿐.
    expect(ids).not.toContain("impeccable");
    expect(ids).not.toContain("react-best-practices");
    expect(ids).toContain("frontend-design"); // has-dev-track baseline 은 유지
  });

  it("executive: Anthropic + finance + 전 트랙 상주 2종 (c-level·business-growth 는 ADR-060 삭제)", () => {
    const { ids } = runForTrack(["executive"]);
    expect(ids).toEqual([
      "anthropic-document-skills",
      "finance-skills",
      "north-star",
      "gh-issue-workflow",
    ]);
    // No dev-track assets
    expect(ids).not.toContain("addy-agent-skills");
    expect(ids).not.toContain("polars-K-Dense");
    expect(ids).not.toContain("railway-skills");
  });

  it("full: all Track-conditional assets active", () => {
    const { ids } = runForTrack(["full"]);
    // data + csr-supabase + ui + react + executive + dev baseline
    // v26.71.1 — railway-skills (T3) opt-in only → default 제외.
    // 2026-08-02 (ADR-060) — polars/c-level/business-growth 삭제 · uzys 이관 스킬 합류.
    expect(ids).toEqual(
      expect.arrayContaining([
        "vercel-cli",
        "supabase-agent-skills",
        "react-best-practices",
        "anthropic-document-skills",
        "finance-skills",
        "audit-service-gaps",
        "clear-korean-communication",
        "north-star",
        "gh-issue-workflow",
      ]),
    );
    expect(ids).not.toContain("addy-agent-skills"); // v26.42.0 — option-gated
    expect(ids).not.toContain("railway-skills"); // v26.71.1 — T3 opt-in
    expect(ids).not.toContain("impeccable"); // v26.106.0 — ADR-035 opt-in 강등
  });

  it("--with addy-agent-skills adds addy-agent-skills plugin (v26.81.0 ADR-022)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["addy-agent-skills"]);
    expect(ids).toContain("addy-agent-skills");
  });

  it("--with ecc-plugin adds ecc-plugin to attempt list (opt-in)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["ecc-plugin"]);
    expect(ids).toContain("ecc-plugin");
    expect(ids).not.toContain("ecc-prune"); // separate opt-in (withPrune behavior flag)
  });

  it("--with-prune adds ecc-prune (option-gated, independent of withEcc)", () => {
    const { ids } = runForTrack(["tooling"], { withPrune: true });
    expect(ids).toContain("ecc-prune");
  });

  it("--with trailofbits-skills adds Trail of Bits (any track)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["trailofbits-skills"]);
    expect(ids).toContain("trailofbits-skills");
    const { ids: idsExec } = runForTrack(["executive"], {}, ["trailofbits-skills"]);
    expect(idsExec).toContain("trailofbits-skills");
  });
});

describe("Track matrix — spawn call counts", () => {
  it("tooling: 11 spawn calls (2026-08-02 정비 ADR-060 — 이관 스킬 7종이 kind:skill 로 합류)", () => {
    // frontend-design(plugin=2) + find-skills(1) + agent-browser(npm install=1) + uzys 이관 7종(각 1) = 11.
    // agent-browser 의 `npm root -g` 조회는 모듈 캐시라 이 파일의 선행 테스트가 이미 소비했다 —
    // 단독 실행 시엔 +1 (파일 단위 순서 의존, 신규 파일 프로브 실측 12).
    const { spawnCallCount } = runForTrack(["tooling"]);
    expect(spawnCallCount).toBe(11);
  });

  it("data: tooling baseline 12 + anthropic-data-plugin(×1) = 13 (2026-08-02 정비 ADR-060)", () => {
    const { spawnCallCount } = runForTrack(["data"]);
    expect(spawnCallCount).toBe(13);
  });

  it("--with openspec alone (executive base) adds 1 npm call", () => {
    const baseExec = runForTrack(["executive"]).spawnCallCount;
    const withOpenspec = runForTrack(["executive"], {}, ["openspec"]).spawnCallCount;
    expect(withOpenspec - baseExec).toBe(1);
  });
});

// === v0.5.0 — 신규 Track 매핑 검증 (P2-T4 합집합 회귀 + P3-T2 신규 Track) ===
describe("Track matrix — v0.5.0 신규 Track", () => {
  it("project-management: product-skills + 전 트랙 상주 2종 (pm-skills 는 2026-08-02 정비로 삭제)", () => {
    const { ids } = runForTrack(["project-management"]);
    expect(ids).toEqual(["product-skills", "north-star", "gh-issue-workflow"]);
    // No has-dev-track assets
    expect(ids).not.toContain("addy-agent-skills");
    // No executive assets
    expect(ids).not.toContain("anthropic-document-skills");
  });

  it("growth-marketing: 전 트랙 상주 2종만 (business-growth·marketing-skills·research-summarizer 는 2026-08-02 정비로 삭제)", () => {
    const { ids } = runForTrack(["growth-marketing"]);
    expect(ids).toEqual(["north-star", "gh-issue-workflow"]);
    expect(ids).not.toContain("product-skills");
    // finance-skills excluded (executive/full only)
    expect(ids).not.toContain("finance-skills");
  });

  it("project-management spawn calls: 4 (2 plugins × 2)", () => {
    const { spawnCallCount } = runForTrack(["project-management"]);
    expect(spawnCallCount).toBe(4);
  });

  it("growth-marketing spawn calls: 2 (전 트랙 상주 스킬 2종 × 1; 2026-08-02 정비 ADR-060)", () => {
    const { spawnCallCount } = runForTrack(["growth-marketing"]);
    expect(spawnCallCount).toBe(2);
  });

  // 2026-08-02 정비(ADR-060) 회귀 — north-star·gh-issue-workflow 는 COMMON_SKILL_DIRS(전 트랙
  // 무조건 설치)에서 카탈로그로 옮겼다. 조건 표현이 트랙 하나라도 빠뜨리면 그 트랙 설치자는
  // 조용히 잃는다 (리뷰 P1-3 이 지적한 강등 금지 — 이 테스트가 그 결정을 지킨다).
  it("north-star·gh-issue-workflow 는 전 트랙에 도달한다 (전 트랙 상주 보존, TRACKS derive)", () => {
    for (const t of TRACKS) {
      const { ids } = runForTrack([t]);
      expect(ids, `${t} 에 north-star 가 안 깔린다`).toContain("north-star");
      expect(ids, `${t} 에 gh-issue-workflow 가 안 깔린다`).toContain("gh-issue-workflow");
    }
  });
});

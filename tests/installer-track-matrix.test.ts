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
import {
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
  isAssetSelected,
} from "../src/external-assets.js";
import { type ExternalInstallerDeps, runExternalInstall } from "../src/external-installer.js";
import { buildManifest } from "../src/manifest.js";
import { hasDevTrack } from "../src/track-match.js";
import { DEFAULT_OPTIONS, type OptionFlags, TRACKS, type Track } from "../src/types.js";

type SpawnFn = NonNullable<ExternalInstallerDeps["spawn"]>;

function ok(): SpawnSyncReturns<string> {
  return { pid: 0, output: [], stdout: "", stderr: "", status: 0, signal: null };
}

function makeMockSpawn(): SpawnFn {
  return vi.fn(() => ok()) as unknown as SpawnFn;
}

function runForTrack(
  tracks: Track[],
  options: Partial<OptionFlags> = {},
  // v26.81.0 (ADR-022) — 자산 opt-in 은 forceInclude(--with <id>) 로 전달.
  forceInclude: string[] = [],
): { ids: string[] } {
  const report = runExternalInstall(
    {
      tracks,
      options: { ...DEFAULT_OPTIONS, ...options },
      cli: ["claude"],
      ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
    },
    { spawn: makeMockSpawn(), log: () => {}, warn: () => {}, assets: EXTERNAL_ASSETS },
  );
  return { ids: report.attempted.map((r) => r.asset.id) };
}

describe("Track matrix — assets called per track", () => {
  it("csr-fastapi: dev baseline + UI(react+shadcn) — taste 가이드는 opt-in (v26.106.0 ADR-035)", () => {
    const { ids } = runForTrack(["csr-fastapi"]);
    // v0.6.3 — railway-plugin entry 제거. v26.71.1 — railway-skills(T3) opt-in only → default 제외.
    expect(ids).not.toContain("railway-skills");
    expect(ids).not.toContain("railway-plugin");
    expect(ids).not.toContain("bmad-method"); // opt-in
    // csr-* matches CSR_SSR_NEXTJS_FULL set → react/shadcn applies
    expect(ids).toContain("react-best-practices");
    expect(ids).toContain("shadcn-ui");
    // v26.106.0 (ADR-035 승인 D + 사용자 결정) — taste 가이드 2종 opt-in 강등 (frontend-design 이 기본).
    expect(ids).not.toContain("impeccable");
    expect(ids).not.toContain("web-design-guidelines");
    expect(ids).not.toContain("vercel-cli"); // csr-supabase only
    expect(ids).not.toContain("polars-K-Dense"); // data only
  });

  it("csr-supabase: supabase-skills + UI (배포/DB CLI 2종은 2026-08-02 opt-in 강등)", () => {
    const { ids } = runForTrack(["csr-supabase"]);
    expect(ids).toEqual(
      expect.arrayContaining([
        "supabase-agent-skills",
        "postgres-best-practices",
        "react-best-practices",
        "shadcn-ui",
      ]),
    );
    // 2026-08-02 사용자 결정 (ADR-063) — vercel-cli·supabase-cli 는 트랙 기본에서 opt-in 으로.
    //   전역 CLI 설치는 사용자가 고르는 것이지 트랙이 정하는 것이 아니다.
    expect(ids).not.toContain("vercel-cli");
    expect(ids).not.toContain("supabase-cli");
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

  it("full: all Track-conditional assets active", () => {
    const { ids } = runForTrack(["full"]);
    // data + csr-supabase + ui + react + executive + dev baseline
    // v26.71.1 — railway-skills (T3) opt-in only → default 제외.
    // 2026-08-02 (ADR-060) — polars/c-level/business-growth 삭제 · uzys 이관 스킬 합류.
    // 2026-08-02 (ADR-062 복원) — uzys 스킬은 internal 로 복귀해 external 목록에 없다.
    expect(ids).toEqual(
      expect.arrayContaining([
        "supabase-agent-skills",
        "react-best-practices",
        "anthropic-document-skills",
      ]),
    );
    expect(ids).not.toContain("addy-agent-skills"); // v26.42.0 — option-gated
    expect(ids).not.toContain("railway-skills"); // v26.71.1 — T3 opt-in
    // 2026-08-02 사용자 결정 (ADR-063) — full 은 "전 트랙 합집합"이지 "전 자산"이 아니다.
    expect(ids).not.toContain("vercel-cli");
    expect(ids).not.toContain("supabase-cli");
    expect(ids).not.toContain("finance-skills");
    expect(ids).not.toContain("impeccable"); // v26.106.0 — ADR-035 opt-in 강등
  });

  // #492 — 이 자리를 지키던 세 판(addy-agent-skills · ecc-plugin · --with-prune)은 자산과
  // 플래그가 함께 은퇴했다. 계약(“opt-in 은 --with 로만 들어온다 · 다른 opt-in 을 끌고 오지
  // 않는다”)은 살아 있는 자산으로 그대로 잰다.
  it("--with bmad-method adds bmad only (다른 opt-in 은 안 딸려 온다)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["bmad-method"]);
    expect(ids).toContain("bmad-method");
    expect(ids).not.toContain("openspec");
  });

  it("--with trailofbits-skills adds Trail of Bits (any track)", () => {
    const { ids } = runForTrack(["tooling"], {}, ["trailofbits-skills"]);
    expect(ids).toContain("trailofbits-skills");
    const { ids: idsExec } = runForTrack(["executive"], {}, ["trailofbits-skills"]);
    expect(idsExec).toContain("trailofbits-skills");
  });
});

// === v0.5.0 — 신규 Track 매핑 검증 (P2-T4 합집합 회귀 + P3-T2 신규 Track) ===
describe("Track matrix — v0.5.0 신규 Track", () => {
  it("--with product-skills 는 여전히 설치 (강등이지 삭제가 아니다 — ADR-063)", () => {
    const { ids } = runForTrack(["project-management"], {}, ["product-skills"]);
    expect(ids).toContain("product-skills");
  });

  // 2026-08-02 정비(ADR-060) 회귀 — north-star·gh-issue-workflow 는 COMMON_SKILL_DIRS(전 트랙
  // 무조건 설치)에서 카탈로그로 옮겼다. 조건 표현이 트랙 하나라도 빠뜨리면 그 트랙 설치자는
  // 조용히 잃는다 (리뷰 P1-3 이 지적한 강등 금지 — 이 테스트가 그 결정을 지킨다).
  //
  // 2026-08-02 복원(ADR-062) — **같은 결정을 지키되 표면을 옮겼다.** 두 스킬이 internal 로
  // 돌아가면서 `runExternalInstall` 의 시도 목록에서 빠졌고, 그 목록으로 계속 재면 "전 트랙
  // 도달"이 아니라 "전 트랙 미도달"만 확인하게 된다. 실제로 파일을 깔지 정하는 곳은 두 군데다:
  // installer 의 `selectedInternalSkills` 계산(isAssetSelected)과 manifest 항목의 `applies`.
  // 둘 다 트랙별로 돌린다 — 하나만 보면 선택은 됐는데 복사가 안 되는 경우를 놓친다.
  // 2026-08-02 AC9 — `objective-brief` 신설분을 같은 단언에 넣는다. 신설이라 "이관 전 범위 유지"는
  // 해당 없지만 **검사해야 할 성질은 같다**: 카탈로그 condition 이 any-track 인데 어느 트랙에서
  // 선택되지 않거나 선택만 되고 복사가 안 되면 그 트랙 설치자는 조용히 잃는다. 목록을 나누면
  // 신설 자산만 이 검사를 빠져나가는 두 번째 경로가 생긴다.
  // ADR-064 — `audit-harness-fit` 신설분도 같은 단언에 넣는다. 근거는 위 AC9 와 같다:
  // 목록을 나누면 신설 자산만 이 검사를 빠져나가는 경로가 또 생긴다.
  it("번들 스킬은 선언된 도달 범위대로 깔린다 — 전 트랙 · dev 트랙 · opt-in", () => {
    const allTrack = ["north-star", "gh-issue-workflow", "objective-brief", "audit-harness-fit"];
    const devOnly = [
      "user-centered-explanation",
      "audit-service-gaps",
      "multi-persona-review",
      "recurrence-prevention",
      "compaction-handoff",
    ];
    const optIn = ["model-orchestration", "external-model-consult"];
    for (const t of TRACKS) {
      const ctx = { tracks: [t], options: { ...DEFAULT_OPTIONS } };
      // installer.ts 의 selectedInternalSkills 와 같은 계산.
      const selected = INTERNAL_BUNDLED_SKILL_IDS.filter((id) => isAssetSelected(id, ctx));
      const manifest = buildManifest({ tracks: [t], selectedInternalSkills: selected });
      const copied = (id: string) =>
        manifest
          .find((e) => e.source === `skills/${id}`)
          ?.applies({ tracks: [t], selectedInternalSkills: selected }) === true;

      for (const id of allTrack) {
        expect(selected, `${t}: ${id} 가 선택되지 않는다`).toContain(id);
        expect(copied(id), `${t}: ${id} 가 선택됐는데 manifest 가 복사하지 않는다`).toBe(true);
      }
      const isDev = hasDevTrack([t]);
      for (const id of devOnly) {
        expect(selected.includes(id), `${t}: ${id} dev-track 게이팅 불일치`).toBe(isDev);
        expect(copied(id), `${t}: ${id} 복사 여부가 선택과 불일치`).toBe(isDev);
      }
      // opt-in 은 트랙만으론 절대 안 깔린다 — 되면 사용자가 안 고른 자산을 설치하는 것이다.
      for (const id of optIn) {
        expect(selected, `${t}: opt-in ${id} 가 트랙만으로 설치된다`).not.toContain(id);
        expect(copied(id), `${t}: opt-in ${id} 가 트랙만으로 복사된다`).toBe(false);
      }
    }
  });
});

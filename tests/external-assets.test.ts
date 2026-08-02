import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assetTrustTier,
  DEV_METHOD_SKILL_IDS,
  DEV_TRACKS,
  EXECUTIVE_STYLE_TRACKS,
  EXTERNAL_ASSETS,
  type ExternalAsset,
  experimentalOptInCandidates,
  filterApplicableAssets,
  INTERNAL_BUNDLED_SKILL_IDS,
  shouldInstallAsset,
  TRUST_TIER,
} from "../src/external-assets.js";
import { DEFAULT_OPTIONS, type OptionFlags, TRACKS, type Track } from "../src/types.js";

const NO_OPTIONS: OptionFlags = { ...DEFAULT_OPTIONS };
const REPO_ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

describe("Trust Tier (v26.71.0, PRD v26-71; v26.79.0 SSOT derive)", () => {
  // v26.79.0 — tier 는 이제 ExternalAsset.tier 필수 필드 (컴파일러가 누락 차단).
  //   TRUST_TIER 는 거기서 derive. 따라서 검증해야 할 WHY 가 바뀌었다:
  //   "라벨 누락"(컴파일 에러로 불가)이 아니라 → derive 가 lossless 한가 (중복 id 금지).
  it("자산 id 는 유일 — 중복 시 TRUST_TIER derive(Object.fromEntries)가 tier 를 silent drop", () => {
    const ids = EXTERNAL_ASSETS.map((a) => a.id);
    const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dups).toEqual([]);
    // derive 가 전 자산을 1:1 반영 (key 수 === 자산 수).
    expect(Object.keys(TRUST_TIER)).toHaveLength(EXTERNAL_ASSETS.length);
  });

  it("TRUST_TIER 는 각 자산의 tier 필드를 정확히 반영 (derive 정합)", () => {
    for (const a of EXTERNAL_ASSETS) {
      expect(TRUST_TIER[a.id]).toBe(a.tier);
    }
  });

  // v26.80.0 (Phase P — 보안 wedge): npm/npx-run 자산은 전부 정확 semver pin.
  //   WHY: vetting 은 시점 검증인데 @latest/unpinned 는 미래 코드 실행 — hijacked vetted
  //   repo 가 사용자에게 직행하는 구멍 (ADR-021 "지속 검증되는 큐레이션" 주장과 모순).
  //   bump 는 A2 자산 audit 주기에 Docker 검증 후 (COMPATIBILITY.md §pinning).
  it("npm/npx-run 자산은 전부 정확 semver pinned — @latest/range/이름 인라인 금지", () => {
    for (const a of EXTERNAL_ASSETS) {
      const m = a.method;
      if (m.kind !== "npm" && m.kind !== "npx-run") continue;
      expect(m.version, `${a.id} version 은 정확 semver`).toMatch(/^\d+\.\d+\.\d+$/);
      // pkg/cmd 는 bare 이름 — "@latest"/"@1.2.3" 인라인 재발 금지 (scoped @scope/ 는 허용).
      const name = m.kind === "npm" ? m.pkg : m.cmd;
      expect(name, `${a.id} 이름에 버전 인라인 금지`).not.toMatch(/@(latest|next|\d)/);
    }
  });

  it("assetTrustTier — official / vetted / experimental 분류", () => {
    expect(assetTrustTier("anthropic-document-skills")).toBe("official"); // anthropics 공식
    expect(assetTrustTier("ecc-prune")).toBe("official"); // 하네스 자체
    expect(assetTrustTier("ecc-plugin")).toBe("vetted"); // affaan-m 199k
    expect(assetTrustTier("railway-skills")).toBe("experimental"); // 268 < 1000
  });

  it("미분류(맵 누락) 자산은 보수적으로 experimental (검증 안 된 것 취급)", () => {
    expect(assetTrustTier("nonexistent-asset-xyz")).toBe("experimental");
  });

  it("T3 experimental 은 star<1000 2개 (railway/revealjs)", () => {
    // v26.106.0 (ADR-035) — architecture-decision-record 제거: 최저 star(179 스냅샷) +
    //   1st-party 대체재(change-management 룰이 전 트랙 무조건 설치, ADR 템플릿+status flow 완비).
    // 2026-08-02 정비 (ADR-060) — playwright-skill 제거 (E2E 작성 가이드 = 모델이 이미 아는 것).
    const t3 = EXTERNAL_ASSETS.filter((a) => assetTrustTier(a.id) === "experimental")
      .map((a) => a.id)
      .sort();
    expect(t3).toEqual(["railway-skills", "revealjs"]);
  });
});

describe("shouldInstallAsset — experimental opt-in (v26.71.1, PRD v26-71 R6/AC4)", () => {
  // WHY: R6 = "T3(Experimental) 는 경고 + opt-in (pre-check 안 함)". AC4 = opt-in only.
  //   v26.71.0 은 recommendedExternalAssets(pre-check)에만 적용 → 비대화형 install 경로
  //   (filterApplicableAssets→shouldInstallAsset)에 누락 → experimental 이 default 설치되던 버그.
  //   이 describe 는 condition-only 미설치 + forceInclude 시 설치(선택권 유지)를 고정한다.
  it("experimental(T3) 은 condition 매치만으론 미설치 (opt-in only)", () => {
    const rw = EXTERNAL_ASSETS.find((a) => a.id === "railway-skills");
    if (!rw) throw new Error("railway-skills missing");
    expect(assetTrustTier("railway-skills")).toBe("experimental");
    // 2026-08-02 사용자 결정 (ADR-063) — railway-skills 가 opt-in 이 되면서 카탈로그에
    //   "condition 은 매치하는데 T3" 인 자산이 0개가 됐다. 실 entry 로 재면 condition 이
    //   false 라서 통과하고 T3 게이트는 아무것도 안 문다 → condition 만 되돌린 사본으로
    //   게이트 자체를 계속 고정한다 (id 유지 = TRUST_TIER 조회가 여전히 experimental).
    const trackConditioned: ExternalAsset = {
      ...rw,
      condition: { kind: "any-track", tracks: ["csr-fastify"] },
    };
    expect(
      shouldInstallAsset(trackConditioned, { tracks: ["csr-fastify"], options: NO_OPTIONS }),
    ).toBe(false);
    // 실 entry 도 물론 미설치 — 다만 사유가 tier 가 아니라 opt-in condition 이다.
    expect(shouldInstallAsset(rw, { tracks: ["csr-fastify"], options: NO_OPTIONS })).toBe(false);
  });

  it("experimental 도 forceInclude(--with / interactive 체크) 시 설치 (강제 차단 아님 — AC4)", () => {
    const rw = EXTERNAL_ASSETS.find((a) => a.id === "railway-skills");
    if (!rw) throw new Error("railway-skills missing");
    expect(
      shouldInstallAsset(rw, {
        tracks: ["csr-fastify"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["railway-skills"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  it("filterApplicableAssets(csr-fastify) 는 experimental 제외 + vetted 포함 (헤더 추천과 정합)", () => {
    const ids = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["csr-fastify"],
      options: NO_OPTIONS,
    }).map((a) => a.id);
    expect(ids).not.toContain("railway-skills"); // T3
    expect(ids).not.toContain("architecture-decision-record"); // T3
    expect(ids).toContain("find-skills"); // vetted
    expect(ids).toContain("frontend-design"); // official
  });

  it("experimentalOptInCandidates(csr-fastify) = 조건 매치 T3 (discoverability 힌트 대상)", () => {
    const ids = experimentalOptInCandidates({ tracks: ["csr-fastify"], options: NO_OPTIONS })
      .map((a) => a.id)
      .sort();
    // 2026-08-02 정비 (ADR-060) — playwright-skill 제거 후 조건 매치 T3 는 railway-skills 뿐이었다.
    // 2026-08-02 사용자 결정 (ADR-063) — 그 railway-skills 도 opt-in 이 됐다. 남은 T3 는
    //   revealjs 뿐이고 그 역시 opt-in 이라 condition 이 절대 매치하지 않는다 → 힌트 대상 0.
    //   힌트 표면(install-render.ts 의 OPT-IN 줄)은 살아 있지만 지금 카탈로그엔 대상이 없다.
    expect(ids).toEqual([]);
  });

  it("experimentalOptInCandidates 는 forceInclude(--with) 된 것 제외 (이미 설치되므로)", () => {
    const ids = experimentalOptInCandidates({
      tracks: ["csr-fastify"],
      options: NO_OPTIONS,
      userOverride: { forceInclude: ["railway-skills"], forceExclude: [] },
    }).map((a) => a.id);
    expect(ids).not.toContain("railway-skills"); // 이미 opt-in → 힌트 불필요
  });
});

describe("external-assets EXTERNAL_ASSETS catalog", () => {
  it("contains 56 distinct asset ids (no duplicates)", () => {
    const ids = EXTERNAL_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    // 2026-08-02 정비 (ADR-060): 66 − 12(카탈로그 삭제) − 11(internal uzys 삭제)
    //   + 9(이관 uzys npx) + 3(frontend) = 55. + 1(task-brief 신설, ADR-062 AC9) = 56.
    expect(ids).toHaveLength(56);
    expect(ids).toContain("task-brief");
    // v26.110.0 (ADR-039) — 오피셜 플러그인 큐레이션 배치: 3종 opt-in.
    expect(ids).toContain("code-review");
    expect(ids).toContain("feature-dev");
    expect(ids).toContain("security-guidance");
    // context7 플러그인 = 미등록 (mcp.json/codex config 템플릿이 이미 기본 wiring — 중복 등록 방지).
    expect(ids).not.toContain("context7");
    // v26.108.0 (ADR-037) — ci-scaffold (opt-in internal, .github/workflows fill-in 템플릿).
    expect(ids).toContain("ci-scaffold");
    // 2026-08-02 정비 — 삭제 12종은 카탈로그에 없어야 한다. 부재가 곧 결정이다 (ADR-060).
    for (const removed of [
      "impeccable",
      "polars-K-Dense",
      "dask-K-Dense",
      "python-resource-management",
      "python-performance-optimization",
      "c-level-skills",
      "business-growth-skills",
      "pm-skills",
      "marketing-skills",
      "research-summarizer",
      "playwright-skill",
      "karpathy-coder",
    ]) {
      expect(ids, `${removed} 는 제거 대상`).not.toContain(removed);
    }
    // 동명이물(marketing-skills)이 사라져도 coreyhaines31 번들은 유지 — 삭제 대상이 아니었다.
    expect(ids).toContain("marketingskills");
    // v26.92.0 — frontend-design (Anthropic official, has-dev-track 기본추천).
    expect(ids).toContain("frontend-design");
    expect(ids).toContain("anthropic-data-plugin");
    expect(ids).toContain("railway-skills");
    expect(ids).toContain("ecc-plugin");
    expect(ids).toContain("ecc-prune");
    expect(ids).toContain("trailofbits-skills");
    // v26.87.0 — 번들 internal skills (uzys 1st-party).
    for (const id of DEV_METHOD_SKILL_IDS) expect(ids).toContain(id);
  });

  // 2026-08-02 복원 (ADR-062) — ADR-060 이 이관했던 uzys 방법론 스킬 9종이 이 리포 번들로
  //   돌아왔다. Promise=Impl: 이제 method 는 반드시 `kind:"internal"` 이고 key 는 id 와 같아야
  //   한다 — `kind:"skill"` 로 남으면 설치 시 존재하지 않는 이관 리포에서 npx 로 받으려 든다.
  //   condition 은 이관 전 도달 범위 그대로다(강등·승격 둘 다 금지).
  it("복원 uzys 스킬 9종: kind:internal · key=id · tier official · 이관 전 condition", () => {
    const expected: Record<string, { category: string; condition: string }> = {
      "clear-korean-communication": { category: "workflow", condition: "has-dev-track" },
      // north-star · gh-issue-workflow 는 이관 전 COMMON_SKILL_DIRS(전 트랙 상주)였다 —
      //   강등 금지. any-track 전 트랙 나열이 그 도달 범위의 표현이다.
      "north-star": { category: "workflow", condition: "any-track" },
      "gh-issue-workflow": { category: "workflow", condition: "any-track" },
      "audit-service-gaps": { category: "dev-tools", condition: "has-dev-track" },
      "verification-loop": { category: "dev-tools", condition: "has-dev-track" },
      "multi-persona-review": { category: "dev-tools", condition: "has-dev-track" },
      "recurrence-prevention": { category: "workflow", condition: "has-dev-track" },
      "model-orchestration": { category: "workflow", condition: "opt-in" },
      "external-model-consult": { category: "dev-tools", condition: "opt-in" },
    };
    for (const [id, want] of Object.entries(expected)) {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      if (!a) throw new Error(`${id} missing`);
      expect(assetTrustTier(id), id).toBe("official");
      expect(a.source, id).toBe("uzys");
      expect(a.category, id).toBe(want.category);
      expect(a.condition.kind, id).toBe(want.condition);
      expect(a.method.kind, id).toBe("internal");
      if (a.method.kind !== "internal") throw new Error("not internal");
      expect(a.method.key, id).toBe(id);
      // 번들 목록에서 빠지면 manifest·4-CLI transform·gen:compat 어느 경로에도 안 잡힌다 —
      //   자산은 카탈로그에 보이는데 파일이 안 깔리는 거짓출하가 된다.
      expect(INTERNAL_BUNDLED_SKILL_IDS, id).toContain(id);
    }
    // 전 트랙 보존의 실동작 확인 — executive(비-dev)에서도 설치된다.
    for (const id of ["north-star", "gh-issue-workflow"]) {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      if (!a) throw new Error(`${id} missing`);
      for (const t of TRACKS) {
        expect(shouldInstallAsset(a, { tracks: [t], options: NO_OPTIONS }), `${id}/${t}`).toBe(
          true,
        );
      }
    }
  });

  // 2026-08-02 정비 — 프론트엔드 3종. Promise=Impl: 광고한 설치 좌표 = 정의 (drift 시 fail).
  //   star 실측 2026-08-02 `gh api` → 전부 vetted(≥1000). 전부 opt-in (무단 설치 0).
  it("frontend 신규 3종: opt-in · vetted · 정확한 skill 좌표", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    expect(byId("jakubkrehel-skills")?.method).toEqual({
      kind: "skill",
      // 7 스킬 세트 전부 설치 — description 이 "7 skills" 를 광고하므로 `--skill` 로
      //   하나만 고르면 그 문구가 곧 거짓이 된다.
      source: "jakubkrehel/skills",
    });
    expect(byId("taste-skill")?.method).toEqual({
      kind: "skill",
      source: "Leonxlnx/taste-skill",
      skill: "taste-skill",
    });
    expect(byId("scroll-world")?.method).toEqual({
      kind: "skill",
      source: "oso95/scroll-world",
      skill: "scroll-world",
    });
    for (const id of ["jakubkrehel-skills", "taste-skill", "scroll-world"]) {
      const a = byId(id);
      if (!a) throw new Error(`${id} missing`);
      expect(a.category, id).toBe("frontend");
      expect(a.condition.kind, id).toBe("opt-in");
      expect(assetTrustTier(id), id).toBe("vetted");
      // opt-in ⇒ 트랙만으론 절대 미설치, forceInclude 로만 설치.
      expect(shouldInstallAsset(a, { tracks: ["full"], options: NO_OPTIONS }), id).toBe(false);
      expect(
        shouldInstallAsset(a, {
          tracks: ["full"],
          options: NO_OPTIONS,
          userOverride: { forceInclude: [id], forceExclude: [] },
        }),
        id,
      ).toBe(true);
    }
    // gsap-skills 는 무변경 — 같은 사이클에서 건드리지 않았음을 고정한다.
    expect(byId("gsap-skills")?.method).toEqual({
      kind: "plugin",
      marketplace: "greensock/gsap-skills",
      pluginId: "gsap-skills@gsap-skills",
    });
  });

  // v26.87.0 — dev-method skills (uzys 1st-party, internal templates). Promise=Impl:
  //   official tier + has-dev-track condition + internal method = repo-bundled, core on
  //   dev tracks, NOT a github source (those repos don't exist → false-ship). drift 시 fail.
  // 2026-08-02 복원 (ADR-062) — 이관 8→1 이 되돌려져 6종. 술어는 그대로다.
  it("dev-method skills: internal/official/has-dev-track, 6종", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    const expectedCategory: Record<string, "dev-tools" | "workflow"> = {
      "compaction-handoff": "workflow",
      "clear-korean-communication": "workflow",
      "audit-service-gaps": "dev-tools",
      "multi-persona-review": "dev-tools",
      "recurrence-prevention": "workflow",
      "verification-loop": "dev-tools",
    };
    expect([...DEV_METHOD_SKILL_IDS].sort()).toEqual(Object.keys(expectedCategory).sort());
    for (const id of DEV_METHOD_SKILL_IDS) {
      const a = byId(id);
      if (!a) throw new Error(`${id} missing`);
      expect(assetTrustTier(id)).toBe("official");
      expect(a.source).toBe("uzys");
      expect(a.condition.kind).toBe("has-dev-track");
      // internal method (repo-bundled) — NOT a github skill source (would crash at install).
      expect(a.method.kind).toBe("internal");
      if (a.method.kind !== "internal") throw new Error("not internal");
      expect(a.method.key).toBe(id);
      expect(a.category).toBe(expectedCategory[id]);
    }
  });

  // 2026-08-02 복원 (ADR-062) — 여기 있던 `INTERNAL_BUNDLED == DEV_METHOD` 집합 등식을 교체했다.
  //   그 등식은 두 상수가 같던 시절에만 성립하는 **프록시**였고, 주석이 밝힌 진짜 의도는
  //   "번들 목록의 모든 id 가 실제로 templates/skills/<id> 로 존재"였다. 복원으로 superset 이
  //   진부분집합이 되는 순간(전 트랙 2종·opt-in 2종 합류) 등식은 의도와 무관하게 깨진다 —
  //   그래서 프록시를 실제 속성 둘로 바꾼다: ⓐ 디렉터리 실재 ⓑ 포함관계.
  //   (같은 교훈이 `tests/wizard-bundle.test.ts` 에 이미 기록돼 있다.)
  it("번들 스킬 목록 ⓐ 전 id 가 templates/skills/<id>/SKILL.md 로 실재 ⓑ DEV_METHOD ⊆ INTERNAL_BUNDLED", () => {
    // ⓐ 없으면 manifest dir copy 가 silent skip 되어 "카탈로그엔 있는데 안 깔린다"가 된다.
    for (const id of INTERNAL_BUNDLED_SKILL_IDS) {
      const skillMd = join(REPO_ROOT, "templates", "skills", id, "SKILL.md");
      expect(existsSync(skillMd), `${id}: templates/skills/${id}/SKILL.md 부재`).toBe(true);
    }
    // ⓑ dev-method 는 번들의 부분집합이다 — 빠지면 dir copy 대상에서 누락된 채 wizard 에만 뜬다.
    for (const id of DEV_METHOD_SKILL_IDS) {
      expect(INTERNAL_BUNDLED_SKILL_IDS, `${id}: dev-method 인데 번들 목록에 없다`).toContain(id);
    }
    // 두 상수의 차집합 = 전 트랙 3종 + opt-in 2종. 여기 늘어나면 멤버십 결정이 문서화 없이
    //   바뀐 것이므로 목록을 고정한다 (DEV_METHOD 의 has-dev-track 불변식이 그 이유).
    const bundledOnly = INTERNAL_BUNDLED_SKILL_IDS.filter(
      (id) => !DEV_METHOD_SKILL_IDS.includes(id),
    );
    expect([...bundledOnly].sort()).toEqual(
      [
        "external-model-consult",
        "gh-issue-workflow",
        "model-orchestration",
        "north-star",
        "task-brief",
      ].sort(),
    );
  });

  // WHY core-on-dev-tracks: official tier (not experimental) + has-dev-track → installs by
  //   default on any dev track, but forceExclude (wizard uncheck / --without) must drop it.
  it("dev-method skills install by default on dev tracks, droppable via forceExclude", () => {
    const handoff = EXTERNAL_ASSETS.find((a) => a.id === "compaction-handoff");
    if (!handoff) throw new Error("compaction-handoff missing");
    // tooling = dev track → default install.
    expect(shouldInstallAsset(handoff, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(true);
    // executive (non-dev) → not installed.
    expect(shouldInstallAsset(handoff, { tracks: ["executive"], options: NO_OPTIONS })).toBe(false);
    // dev track but user unchecks in wizard / --without → dropped.
    expect(
      shouldInstallAsset(handoff, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: [], forceExclude: ["compaction-handoff"] },
      }),
    ).toBe(false);
  });

  // v26.105.0 (ADR-034) — '수단(권장)' 계층: 필수 아님 + 권장(description 에 opt-in 표기).
  //   2026-08-02 정비 (ADR-060) 이후 이 계층은 전부 이관 리포 스킬이다 — 번들이 아니어도
  //   "opt-in 인데 권장" 이라는 표시 의무는 그대로 남는다 (기본 설치로 오인 방지).
  it("수단(권장) 계층 (model-orchestration/external-model-consult): opt-in + description 에 opt-in 표기", () => {
    for (const id of ["model-orchestration", "external-model-consult"]) {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      if (!a) throw new Error(`${id} missing`);
      expect(DEV_METHOD_SKILL_IDS, id).not.toContain(id);
      expect(a.condition.kind, id).toBe("opt-in");
      expect(a.description, id).toContain("opt-in");
      // opt-in ⇒ NOT installed by track alone (even a dev track); only on forceInclude.
      expect(shouldInstallAsset(a, { tracks: ["tooling"], options: NO_OPTIONS }), id).toBe(false);
      expect(
        shouldInstallAsset(a, {
          tracks: ["tooling"],
          options: NO_OPTIONS,
          userOverride: { forceInclude: [id], forceExclude: [] },
        }),
        id,
      ).toBe(true);
    }
  });

  // v26.108.0 (ADR-037, 라이프사이클 자산화 ②) — ci-scaffold: `.claude/` 밖(.github/)에 쓰는
  //   첫 자산. Promise=Impl: opt-in 전용(무인지 설치 0)이어야 하고, 스킬이 아니므로
  //   INTERNAL_BUNDLED_SKILL_IDS(스킬 dir copy + 4-CLI 렌더 대상)에 끼어들면 안 된다 —
  //   끼면 존재하지 않는 templates/skills/ci-scaffold 를 복사하려다 silent skip 된다.
  it("ci-scaffold: opt-in internal (uzys), NOT a bundled skill", () => {
    const a = EXTERNAL_ASSETS.find((x) => x.id === "ci-scaffold");
    if (!a) throw new Error("ci-scaffold missing");
    expect(assetTrustTier("ci-scaffold")).toBe("official");
    expect(a.source).toBe("uzys");
    expect(a.category).toBe("workflow");
    expect(a.condition.kind).toBe("opt-in");
    expect(a.description).toContain("opt-in");
    expect(a.method.kind).toBe("internal");
    expect(INTERNAL_BUNDLED_SKILL_IDS).not.toContain("ci-scaffold");
    expect(DEV_METHOD_SKILL_IDS).not.toContain("ci-scaffold");
    // opt-in ⇒ 트랙만으론 절대 미설치 (dev 트랙 포함) — forceInclude 시에만.
    expect(shouldInstallAsset(a, { tracks: ["full"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(a, {
        tracks: ["full"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["ci-scaffold"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  it("official plugins curation batch (v26.110.0, ADR-039): 조건·마켓플레이스 계약", () => {
    // 사용자 승인 + 검증 정정 (2026-07-18): code-review·feature-dev·security-guidance opt-in /
    //   context7 = 미등록(mcp.json 템플릿 기본 wiring 기충족 — 중복) / claude-md-management 기각.
    //   "오피셜 = 기본설치"가 아니라 "갭 충족 + 상시 비용 정당"이 기본설치 축 (ADR-032/035).
    const batch = {
      "code-review": { category: "dev-tools" },
      "feature-dev": { category: "workflow" },
      "security-guidance": { category: "dev-tools" },
    } as const;
    for (const [id, want] of Object.entries(batch)) {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      if (!a) throw new Error(`${id} missing`);
      expect(assetTrustTier(id), id).toBe("official");
      expect(a.condition.kind, id).toBe("opt-in");
      expect(a.category, id).toBe(want.category);
      expect(a.method.kind, id).toBe("plugin");
      if (a.method.kind === "plugin") {
        expect(a.method.marketplace, id).toBe("anthropics/claude-plugins-official");
        expect(a.method.pluginId, id).toBe(`${id}@claude-plugins-official`);
      }
      // opt-in ⇒ 트랙만으론 절대 미설치 (리뷰 표면 중복·방법론류·상시 훅 비용 — ADR-039).
      expect(shouldInstallAsset(a, { tracks: ["full"], options: NO_OPTIONS }), id).toBe(false);
    }
    // 기각/미등록 2종: 카탈로그 부재가 결정 자체다 (근거 = ADR-039).
    expect(EXTERNAL_ASSETS.find((x) => x.id === "claude-md-management")).toBeUndefined();
    expect(EXTERNAL_ASSETS.find((x) => x.id === "context7")).toBeUndefined();
  });

  it("every asset has description + condition + method", () => {
    for (const a of EXTERNAL_ASSETS) {
      expect(a.id).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.condition).toBeDefined();
      expect(a.method).toBeDefined();
    }
  });

  // v26.78.0 — Understanding 카테고리 (에이전트 인지 증강). Promise=Impl: 광고한 plugin 설치법
  // 이 실제 정의대로인지 회귀 가드 (pluginId drift 시 fail).
  it("Understanding category: 3 new plugins + agent-browser, exact methods", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    const understanding = EXTERNAL_ASSETS.filter((a) => a.category === "understanding").map(
      (a) => a.id,
    );
    expect(understanding.sort()).toEqual(
      ["agent-browser", "agentmemory", "claude-video", "understand-anything"].sort(),
    );
    expect(byId("claude-video")?.method).toEqual({
      kind: "plugin",
      marketplace: "bradautomates/claude-video",
      pluginId: "watch@claude-video",
    });
    expect(byId("understand-anything")?.method).toEqual({
      kind: "plugin",
      marketplace: "Lum1104/Understand-Anything",
      pluginId: "understand-anything@understand-anything",
    });
    expect(byId("agentmemory")?.method).toEqual({
      kind: "plugin",
      marketplace: "rohitg00/agentmemory",
      pluginId: "agentmemory@agentmemory",
    });
    // 3종은 opt-in. 기본 설치 아님 (v26.81.0 ADR-022 — option flag → opt-in condition).
    for (const id of ["claude-video", "understand-anything", "agentmemory"]) {
      expect(byId(id)?.condition.kind).toBe("opt-in");
    }
    // 전부 vetted (star≥1000).
    for (const id of ["claude-video", "understand-anything", "agentmemory"]) {
      expect(assetTrustTier(id)).toBe("vetted");
    }
  });

  // v26.85.0 — Visual & Media 카테고리 (코드-퍼스트 제작). Promise=Impl: 광고한 설치법 = 정의.
  //   좌표는 Docker 실설치 검증(실 claude 2.1.177) PASS 값 — drift(rename/삭제) 시 fail.
  //   no-false-ship surface parity: opt-in(자동 미설치) + forceInclude(--with/wizard)로만 설치.
  it("Visual & Media category: 9 assets, opt-in + forceInclude reachable, exact methods", () => {
    const byId = (id: string) => EXTERNAL_ASSETS.find((a) => a.id === id);
    const vm = EXTERNAL_ASSETS.filter((a) => a.category === "visual-media").map((a) => a.id);
    expect(vm.sort()).toEqual(
      [
        "frontend-slides",
        "gsap-skills",
        "marp-slide",
        "mermaid-diagrams",
        "remotion",
        "ppt-master",
        "ppt-generation",
        "web-video-presentation",
        "revealjs",
      ].sort(),
    );
    expect(byId("frontend-slides")?.method).toEqual({
      kind: "plugin",
      marketplace: "zarazhangrui/frontend-slides",
      pluginId: "frontend-slides@frontend-slides",
    });
    expect(byId("gsap-skills")?.method).toEqual({
      kind: "plugin",
      marketplace: "greensock/gsap-skills",
      pluginId: "gsap-skills@gsap-skills",
    });
    expect(byId("marp-slide")?.method).toEqual({
      kind: "skill",
      source: "softaworks/agent-toolkit",
      skill: "marp-slide",
    });
    expect(byId("mermaid-diagrams")?.method).toEqual({
      kind: "skill",
      source: "softaworks/agent-toolkit",
      skill: "mermaid-diagrams",
    });
    // remotion --skill = remotion-best-practices (Docker 실측 — dir `remotion` ≠ frontmatter name).
    expect(byId("remotion")?.method).toEqual({
      kind: "skill",
      source: "remotion-dev/skills",
      skill: "remotion-best-practices",
    });
    // Issue #176 프레젠테이션 4종 (Docker 4/4 PASS — skills@1.5.11 add <src> --agent claude-code --skill).
    expect(byId("ppt-master")?.method).toEqual({
      kind: "skill",
      source: "hugohe3/ppt-master",
      skill: "ppt-master",
    });
    expect(byId("ppt-generation")?.method).toEqual({
      kind: "skill",
      source: "bytedance/deer-flow",
      skill: "ppt-generation",
    });
    expect(byId("web-video-presentation")?.method).toEqual({
      kind: "skill",
      source: "ConardLi/garden-skills",
      skill: "web-video-presentation",
    });
    expect(byId("revealjs")?.method).toEqual({
      kind: "skill",
      source: "ryanbbrown/revealjs-skill",
      skill: "revealjs",
    });
    // 전부 opt-in (자동 미설치). tier: vetted 8 + experimental 1 (revealjs ★347 <1000, opt-in).
    for (const id of vm) {
      expect(byId(id)?.condition.kind).toBe("opt-in");
    }
    for (const id of vm.filter((i) => i !== "revealjs")) {
      expect(assetTrustTier(id)).toBe("vetted");
    }
    expect(assetTrustTier("revealjs")).toBe("experimental");
    // surface parity — condition-only 미설치, forceInclude(--with / wizard 체크) 시 설치.
    const fs = byId("frontend-slides");
    if (!fs) throw new Error("frontend-slides missing");
    expect(shouldInstallAsset(fs, { tracks: ["full"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(fs, {
        tracks: ["full"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["frontend-slides"], forceExclude: [] },
      }),
    ).toBe(true);
  });
});

describe("shouldInstallAsset — track conditions", () => {
  it("any-track condition matches when at least one track is in the set", () => {
    const dataPlugin = EXTERNAL_ASSETS.find((a) => a.id === "anthropic-data-plugin");
    if (!dataPlugin) throw new Error("anthropic-data-plugin missing");
    expect(shouldInstallAsset(dataPlugin, { tracks: ["data"], options: NO_OPTIONS })).toBe(true);
    expect(shouldInstallAsset(dataPlugin, { tracks: ["full"], options: NO_OPTIONS })).toBe(true);
    expect(shouldInstallAsset(dataPlugin, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(
      false,
    );
  });

  it("has-dev-track matches any non-executive track", () => {
    const findSkills = EXTERNAL_ASSETS.find((a) => a.id === "find-skills");
    if (!findSkills) throw new Error("find-skills missing");
    expect(shouldInstallAsset(findSkills, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(true);
    expect(shouldInstallAsset(findSkills, { tracks: ["csr-fastapi"], options: NO_OPTIONS })).toBe(
      true,
    );
    expect(shouldInstallAsset(findSkills, { tracks: ["executive"], options: NO_OPTIONS })).toBe(
      false,
    );
  });

  // v26.81.0 (ADR-022) — flag 게이팅 → opt-in(forceInclude) 게이팅으로 의미 전환.
  //   WHY: condition 만으론 절대 미설치(무단 설치 금지), --with <id>/wizard 체크로만 활성.
  it("opt-in conditions never match by themselves — forceInclude only", () => {
    const ecc = EXTERNAL_ASSETS.find((a) => a.id === "ecc-plugin");
    if (!ecc) throw new Error("ecc-plugin missing");
    expect(shouldInstallAsset(ecc, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(ecc, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["ecc-plugin"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  it("ecc-prune fires when withPrune=true (separate from withEcc)", () => {
    const prune = EXTERNAL_ASSETS.find((a) => a.id === "ecc-prune");
    if (!prune) throw new Error("ecc-prune missing");
    // withPrune이 자체적으로 trigger (ecc-prune is gated on withPrune flag)
    expect(
      shouldInstallAsset(prune, {
        tracks: ["tooling"],
        options: { ...NO_OPTIONS, withPrune: true },
      }),
    ).toBe(true);
  });

  it("Trail of Bits is gated on `--with trailofbits-skills` (opt-in)", () => {
    const tob = EXTERNAL_ASSETS.find((a) => a.id === "trailofbits-skills");
    if (!tob) throw new Error("trailofbits missing");
    expect(shouldInstallAsset(tob, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    expect(
      shouldInstallAsset(tob, {
        tracks: ["tooling"],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["trailofbits-skills"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  // v26.39.2 fix — marketplace.json 사실 검증 (사용자 보고 #4)
  it("Trail of Bits pluginId matches actual marketplace.json (differential-review@trailofbits)", () => {
    const tob = EXTERNAL_ASSETS.find((a) => a.id === "trailofbits-skills");
    if (!tob) throw new Error("trailofbits missing");
    expect(tob.method.kind).toBe("plugin");
    if (tob.method.kind !== "plugin") throw new Error("not plugin");
    // marketplace name = "trailofbits/skills" (URL form, claude plugin marketplace add)
    expect(tob.method.marketplace).toBe("trailofbits/skills");
    // pluginId 형식: <pluginName>@<marketplaceName-from-marketplace.json>
    // marketplace.json 의 "name": "trailofbits" → pluginId 의 @ 뒤가 "trailofbits"
    expect(tob.method.pluginId).toBe("differential-review@trailofbits");
  });

  it("workflow 큐레이션 확장 (v26.75.0, ADR-021) — 3 자산 옵션 gated + 검증 메서드/tier", () => {
    const wshobson = EXTERNAL_ASSETS.find((a) => a.id === "wshobson-agents");
    const openspec = EXTERNAL_ASSETS.find((a) => a.id === "openspec");
    const bmad = EXTERNAL_ASSETS.find((a) => a.id === "bmad-method");
    if (!wshobson || !openspec || !bmad) throw new Error("workflow 자산 누락");

    // 전부 workflow 카테고리 + vetted, 기본 트랙엔 미포함 (옵션 gated — 무단 설치 금지)
    for (const a of [wshobson, openspec, bmad]) {
      expect(a.category).toBe("workflow");
      expect(assetTrustTier(a.id)).toBe("vetted");
      expect(shouldInstallAsset(a, { tracks: ["tooling"], options: NO_OPTIONS })).toBe(false);
    }

    // v26.81.0 (ADR-022) — `--with <id>` (forceInclude) 로만 활성
    for (const a of [wshobson, openspec, bmad]) {
      expect(
        shouldInstallAsset(a, {
          tracks: ["tooling"],
          options: NO_OPTIONS,
          userOverride: { forceInclude: [a.id], forceExclude: [] },
        }),
      ).toBe(true);
    }

    // 검증된 설치 메서드 (Promise=Impl — 변조 시 회귀 fail)
    expect(wshobson.method).toEqual({
      kind: "plugin",
      marketplace: "wshobson/agents",
      pluginId: "full-stack-orchestration@claude-code-workflows",
    });
    // v26.80.0 — version pinned (vetting 시점 코드만 실행). bump 는 A2 audit 주기 + Docker 검증.
    expect(openspec.method).toEqual({ kind: "npm", pkg: "@fission-ai/openspec", version: "1.4.1" });
    expect(bmad.method).toEqual({
      kind: "npx-run",
      cmd: "bmad-method",
      version: "6.9.0",
      // v26.75.1 — --directory . 필수(없으면 비대화형 hang, Docker realcli 검출)
      args: ["install", "--directory", ".", "--tools", "claude-code", "--yes"],
    });
  });
});

describe("filterApplicableAssets", () => {
  it("returns 0 assets for executive-only track without any options", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["executive"] as Track[],
      options: NO_OPTIONS,
    });
    // executive 한정 자산 + 전 트랙 상주 이관 스킬 (north-star · gh-issue-workflow).
    const ids = apps.map((a) => a.id);
    expect(ids).toContain("anthropic-document-skills");
    // 2026-08-02 사용자 결정 (ADR-063) — finance-skills 는 executive 기본에서 opt-in 으로.
    expect(ids).not.toContain("finance-skills");
    expect(ids).toContain("north-star");
    expect(ids).toContain("gh-issue-workflow");
    expect(ids).not.toContain("addy-agent-skills"); // option-gated (v26.42.0+)
    expect(ids).not.toContain("anthropic-data-plugin"); // data|full
  });

  it("data track gets data-specific assets + dev baselines (v26.106.0 ADR-035)", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["data"] as Track[],
      options: NO_OPTIONS,
    });
    const ids = apps.map((a) => a.id);
    expect(ids).toEqual(
      expect.arrayContaining(["anthropic-data-plugin", "find-skills", "agent-browser"]),
    );
    // 2026-08-02 정비 (ADR-060) — data 스킬 4종(polars·dask·python 2종)은 카탈로그에서 제거.
    expect(ids).not.toContain("polars-K-Dense");
    expect(ids).not.toContain("python-resource-management");
    expect(ids).not.toContain("python-performance-optimization");
    expect(ids).not.toContain("addy-agent-skills"); // option-gated (v26.42.0+)
    expect(ids).not.toContain("railway-skills"); // not in data
  });

  it("full track activates everything except option-gated", () => {
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["full"] as Track[],
      options: NO_OPTIONS,
    });
    const ids = apps.map((a) => a.id);
    // 옵션 gated 는 제외 (ecc, tob 등)
    expect(ids).not.toContain("ecc-plugin");
    expect(ids).not.toContain("trailofbits-skills");
    // Track 매트릭스의 vetted/official 자산은 포함
    expect(ids).toContain("anthropic-data-plugin");
    expect(ids).not.toContain("railway-skills"); // v26.71.1 — T3 experimental opt-in only (PRD R6)
    // 2026-08-02 사용자 결정 (ADR-063) — 배포/DB CLI 2종 + 업무 번들 2종은 opt-in 으로 이동.
    expect(ids).not.toContain("vercel-cli");
    expect(ids).not.toContain("supabase-cli");
    expect(ids).not.toContain("finance-skills");
    expect(ids).not.toContain("product-skills");
    expect(ids).toContain("anthropic-document-skills");
  });

  it("forceInclude (--with <id>) adds opt-in assets to base track set", () => {
    // v26.81.0 (ADR-022) — 옵션 플래그 → forceInclude 의미 전환 (동일 의도: 기본셋 + opt-in 추가).
    const apps = filterApplicableAssets(EXTERNAL_ASSETS, {
      tracks: ["tooling"] as Track[],
      options: NO_OPTIONS,
      userOverride: {
        forceInclude: ["ecc-plugin", "trailofbits-skills", "addy-agent-skills"],
        forceExclude: [],
      },
    });
    const ids = apps.map((a) => a.id);
    expect(ids).toContain("ecc-plugin");
    expect(ids).toContain("trailofbits-skills");
    expect(ids).toContain("addy-agent-skills");
  });
});

// v0.8.1 — reviewer MEDIUM-3 fix: TRACKS partition invariants.
describe("Track partition invariants — v0.8.1 SSOT", () => {
  it("TRACKS = DEV_TRACKS ∪ EXECUTIVE_STYLE_TRACKS (disjoint, exhaustive)", () => {
    const dev = new Set<Track>(DEV_TRACKS);
    const exec = new Set<Track>(EXECUTIVE_STYLE_TRACKS);
    // disjoint: no overlap
    for (const t of dev) expect(exec.has(t)).toBe(false);
    // exhaustive: dev ∪ exec = TRACKS
    const union = new Set<Track>([...dev, ...exec]);
    expect(union.size).toBe(TRACKS.length);
    for (const t of TRACKS) expect(union.has(t)).toBe(true);
  });

  // 2026-08-02 사용자 결정 (ADR-063) — 5자산이 트랙 기본에서 opt-in 으로 내려갔다.
  //   이전 판(v26.106.0 ADR-035 사용자 승인 C)은 product-skills 가 project-management
  //   한정임을 고정했다. 결정이 바뀌었으니 고정 대상도 바뀐다: **어떤 트랙 조합으로도
  //   자동 설치되지 않고, --with(=forceInclude)로는 여전히 설치된다.** 뒤쪽 절반이 없으면
  //   "카탈로그에서 삭제"와 구분되지 않는다.
  it("ADR-063 5자산: 트랙만으론 어느 트랙에서도 미설치 · --with 로는 설치", () => {
    const optedOut = [
      "railway-skills",
      "vercel-cli",
      "supabase-cli",
      "finance-skills",
      "product-skills",
    ];
    for (const id of optedOut) {
      const a = EXTERNAL_ASSETS.find((x) => x.id === id);
      if (!a) throw new Error(`${id} missing`); // 삭제가 아니라 강등이다 — 카탈로그에 남아야 한다
      expect(a.condition.kind, id).toBe("opt-in");
      for (const t of TRACKS) {
        expect(shouldInstallAsset(a, { tracks: [t], options: NO_OPTIONS }), `${id}/${t}`).toBe(
          false,
        );
      }
      // 전 트랙 동시 선택(= full 포함 최대 집합)에서도 안 깔린다.
      expect(shouldInstallAsset(a, { tracks: [...TRACKS], options: NO_OPTIONS }), id).toBe(false);
      expect(
        shouldInstallAsset(a, {
          tracks: ["tooling"],
          options: NO_OPTIONS,
          userOverride: { forceInclude: [id], forceExclude: [] },
        }),
        `${id} 는 --with 로 설치 가능해야 한다`,
      ).toBe(true);
    }
  });
});

describe("v26.47.0 — shouldInstallAsset userOverride (Phase C full)", () => {
  // 2026-08-02 정비 — 표본 자산이 polars-K-Dense(제거)에서 anthropic-data-plugin 으로 바뀌었다.
  //   조건은 같다: `any-track ["data","full"]` + vetted/official.
  const dataPlugin = () => {
    const a = EXTERNAL_ASSETS.find((x) => x.id === "anthropic-data-plugin");
    if (!a) throw new Error("anthropic-data-plugin missing");
    return a;
  };

  it("forceExclude > condition: 매칭 자산도 강제 제외", () => {
    // data track 에서 추천이지만 사용자가 unchecked
    expect(
      shouldInstallAsset(dataPlugin(), {
        tracks: ["data"] as Track[],
        options: NO_OPTIONS,
        userOverride: { forceInclude: [], forceExclude: ["anthropic-data-plugin"] },
      }),
    ).toBe(false);
  });

  it("forceInclude > condition: 미매칭 자산도 강제 포함", () => {
    // tooling track 은 추천 X — 사용자가 명시 추가
    expect(
      shouldInstallAsset(dataPlugin(), {
        tracks: ["tooling"] as Track[],
        options: NO_OPTIONS,
        userOverride: { forceInclude: ["anthropic-data-plugin"], forceExclude: [] },
      }),
    ).toBe(true);
  });

  it("forceExclude > forceInclude (동시 명시 시 exclude 우선)", () => {
    expect(
      shouldInstallAsset(dataPlugin(), {
        tracks: ["data"] as Track[],
        options: NO_OPTIONS,
        userOverride: {
          forceInclude: ["anthropic-data-plugin"],
          forceExclude: ["anthropic-data-plugin"],
        },
      }),
    ).toBe(false);
  });

  it("userOverride 미제공 시 기존 condition 만 평가 (backward compat)", () => {
    expect(
      shouldInstallAsset(dataPlugin(), { tracks: ["data"] as Track[], options: NO_OPTIONS }),
    ).toBe(true);
  });
});

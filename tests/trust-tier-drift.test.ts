import { describe, expect, it } from "vitest";
import { EXTERNAL_ASSETS, TRUST_TIER } from "../src/external-assets.js";
import {
  classifyDrift,
  driftTargets,
  normalizeRepo,
  repoForAsset,
  STAR_THRESHOLD,
} from "../src/trust-tier-drift.js";

describe("classifyDrift — 정적 라벨이 실제 star 와 어긋났는지", () => {
  it("vetted 인데 threshold 미만 → demote (라벨이 실제보다 과대)", () => {
    expect(classifyDrift("vetted", STAR_THRESHOLD - 1)).toBe("demote");
  });
  it("vetted 이고 threshold 이상 → ok", () => {
    expect(classifyDrift("vetted", STAR_THRESHOLD)).toBe("ok");
  });
  it("experimental 인데 threshold 이상 → promote (실제가 vetted 자격)", () => {
    // WHY: experimental(opt-in) 자산이 인기를 얻어 1000★ 넘으면 vetted 로 승격 = pre-check 대상.
    //      놓치면 검증된 자산을 사용자가 opt-in 안 함 (큐레이션 신선도 저하).
    expect(classifyDrift("experimental", STAR_THRESHOLD)).toBe("promote");
  });
  it("experimental 이고 threshold 미만 → ok", () => {
    expect(classifyDrift("experimental", 0)).toBe("ok");
  });
});

describe("normalizeRepo — source/marketplace/URL → owner/repo", () => {
  it("owner/repo 그대로", () => {
    expect(normalizeRepo("vercel-labs/next-skills")).toBe("vercel-labs/next-skills");
  });
  it("github URL 에서 추출", () => {
    expect(normalizeRepo("https://github.com/wshobson/agents")).toBe("wshobson/agents");
  });
  it("owner/repo/하위경로 → owner/repo 만", () => {
    expect(normalizeRepo("K-Dense-AI/scientific-agent-skills/x")).toBe(
      "K-Dense-AI/scientific-agent-skills",
    );
  });
  it("owner 만 있으면 null", () => {
    expect(normalizeRepo("alirezarezvani")).toBeNull();
  });
});

describe("repo 해석 — star 기반 자산 전부 repo 도출 필수", () => {
  it("모든 vetted/experimental 자산이 owner/repo 로 해석된다", () => {
    // WHY: 도출 실패한 자산은 driftTargets 에서 silently 누락 → drift CI 가 그 자산을 영영
    //      안 봄 (큐레이션이 썩어도 감지 불가). 새 자산 추가 시 이 테스트가 override 누락을 잡는다.
    const starBased = EXTERNAL_ASSETS.filter(
      (a) => TRUST_TIER[a.id] === "vetted" || TRUST_TIER[a.id] === "experimental",
    );
    const unresolved = starBased.filter((a) => !repoForAsset(a)).map((a) => a.id);
    expect(unresolved).toEqual([]);
  });

  it("driftTargets 의 repo 는 전부 owner/repo 형식", () => {
    const targets = driftTargets();
    expect(targets.length).toBeGreaterThan(0);
    for (const t of targets) {
      expect(t.repo).toMatch(/^[^/\s]+\/[^/\s]+$/);
    }
  });

  it("official 자산은 검사 대상에서 제외된다 (star 무관)", () => {
    const targetIds = new Set(driftTargets().map((t) => t.id));
    const officialIds = EXTERNAL_ASSETS.filter((a) => TRUST_TIER[a.id] === "official").map(
      (a) => a.id,
    );
    for (const id of officialIds) expect(targetIds.has(id)).toBe(false);
  });
});

import { existsSync } from "node:fs";
import { join } from "node:path";
import { classifyBaselineTarget, isBaselineExcluded } from "./baseline-targets.js";
import { type ResidentCost, residentCost } from "./context-cost.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
import { buildManifestSpec } from "./installer.js";
import { buildManifest } from "./manifest.js";
import type { InstallSpec } from "./types.js";

/** `residentCost` 가 받는 엔트리 모양. */
export type ResidentEntry = { source: string; target: string; file?: string };

/**
 * 이번 설치로 **실제로 상주하는** 자산의 manifest 엔트리 (#615).
 *
 * 설치 헤더 · 위저드 확인 · update 요약이 **이 함수 하나**로 센다. 셋이 각자 거르던 때 위저드만
 * `--without baseline:*` 를 반영해, 룰 5개를 전부 뺀 설치가 같은 화면에서 `⊘ excluded by you 5` 와
 * `rules 5` 를 함께 찍었다. 판정은 설치기가 실제로 쓰는 것과 같은 조건을 따른다:
 *
 *  - **룰**: 해제분을 뺀다. 룰은 CLI 와 무관하게 상주한다 — claude 는 `.claude/rules/`, 나머지는
 *    `AGENTS.md` 인라인 · `.agents/rules/` (`runCliTransforms` 가 같은 해제 필터를 적용한다).
 *  - **에이전트**: `.claude/agents/` 는 claude 전용이고 다른 CLI 산출물로 변환되지 않는다(#476).
 *  - **스킬**: claude 가 있으면 `.claude/skills/` 몫(해제분 제외). claude 가 없으면 `.agents/skills/`
 *    에 깔리는 몫이고, 그건 transform 이 받는 `selectedInternalSkills` 다. 트랙 baseline 스킬처럼
 *    claude 자리에만 놓이는 스킬은 여기서 빠진다 — "그 스킬이 어느 CLI 에 닿는가"를 이 모듈이
 *    목록으로 적지 않고 설치기가 쓰는 같은 입력으로 묻는다.
 */
export function residentEntries(spec: InstallSpec): ResidentEntry[] {
  // 리뷰 #693 NOTE-3 — 뺐어도 디스크에 남아 있으면 매 세션 읽힌다(하네스는 빼기를 이유로 지우지 않는다) — 센다.
  // 번들 스킬은 선택(`forceExclude`)에서, baseline 은 제외 목록에서 디스크에 있는 것을 덜어 낸다
  const skillThere = (id: string): boolean =>
    INTERNAL_BUNDLED_SKILL_IDS.includes(id) &&
    [".claude/skills", ".agents/skills"].some((d) => existsSync(join(spec.projectDir, d, id)));
  const forceExclude = (spec.userOverride?.forceExclude ?? []).filter((id) => !skillThere(id));
  const assetSpec = buildManifestSpec(
    spec.userOverride ? { ...spec, userOverride: { ...spec.userOverride, forceExclude } } : spec,
  );
  const there = onDiskTargets(spec, assetSpec);
  const excluded = new Set((spec.baselineExclude ?? []).filter((id) => !there.has(id)));
  const hasClaude = spec.cli.includes("claude");
  const bundled = new Set(assetSpec.selectedInternalSkills ?? []);
  return buildManifest(assetSpec).filter((e) => {
    if (!e.applies(assetSpec)) return false;
    if (e.target.startsWith(".claude/rules/")) return !isBaselineExcluded(e.target, excluded);
    if (e.target.startsWith(".claude/agents/")) {
      return hasClaude && !isBaselineExcluded(e.target, excluded);
    }
    if (e.target.startsWith(".claude/skills/")) {
      if (hasClaude) return !isBaselineExcluded(e.target, excluded);
      // 설치기는 `selectedInternalSkills` 에서 해제분을 걸러 transform 에 준다(#673) — 같은 조건.
      const id = /^\.claude\/skills\/([^/]+)/.exec(e.target)?.[1];
      return (
        id !== undefined && bundled.has(id) && !isBaselineExcluded(`.claude/skills/${id}`, excluded)
      );
    }
    return true;
  });
}

/** `residentEntries` 로 센 상주 비용. `entries` 는 update 가 에이전트를 디스크 실측으로 바꿀 때만 준다. */
export function residentCostFor(
  spec: InstallSpec,
  entries: ReadonlyArray<ResidentEntry> = residentEntries(spec),
): ResidentCost {
  return residentCost(entries, undefined, spec.cli);
}

/** 리뷰 #693 NOTE-3 — 이 spec 의 baseline 대상 중 지금 디스크에 있는 것의 baseline id. */
function onDiskTargets(
  spec: InstallSpec,
  assetSpec: ReturnType<typeof buildManifestSpec>,
): Set<string> {
  const out = new Set<string>();
  for (const e of buildManifest(assetSpec)) {
    if (!e.applies(assetSpec)) continue;
    const t = classifyBaselineTarget(e.target);
    if (t !== null && existsSync(join(spec.projectDir, e.target))) out.add(t.id);
  }
  return out;
}

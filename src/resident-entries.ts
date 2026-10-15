import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { seedRootClaudeProjectContext } from "./anchor-seed.js";
import { classifyBaselineTarget, isBaselineExcluded } from "./baseline-targets.js";
import {
  anchorSurface,
  makeResidentCost,
  type ResidentCost,
  residentCost,
  resolveBundleRoot,
} from "./context-cost.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
import { buildManifestSpec } from "./installer.js";
import { buildManifest } from "./manifest.js";
import { upsertHarnessImport } from "./project-claude-merge.js";
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

/**
 * `residentEntries` 로 센 상주 비용. `entries` · `contextFiles` 는 update 가 갱신 뒤 디스크를 잴 때만
 * 준다(#458 · #615 사례 4) — 계약은 `residentCost` 의 같은 이름 인자.
 *
 * 안 주면 **설치 전 계획**(설치 헤더 · 위저드)이다. 계획이라도 이미 디스크에 있어 설치 뒤에도 매 세션
 * 읽힐 설치자 본문은 잰다(#615 남은 틈 ②) — 못 재는 자리는 화면에 그렇다고 붙인다.
 */
export function residentCostFor(
  spec: InstallSpec,
  entries: ReadonlyArray<ResidentEntry> = residentEntries(spec),
  contextFiles?: ReadonlyArray<string | { text: string }>,
): ResidentCost {
  if (contextFiles !== undefined) return residentCost(entries, undefined, spec.cli, contextFiles);
  const cost = residentCost(entries, undefined, spec.cli, plannedClaudeContext(spec));
  // codex · opencode 는 이미 있는 `AGENTS.md` 의 설치자 절을 이어받는다(`agents-md-merge.ts`). 그 병합을
  // 여기서 다시 돌리지 않으므로 그 본문은 숫자에 없다 — 없다고 말한다.
  if (
    anchorSurface(spec.cli).scaffold === "agents-md" &&
    existsSync(join(spec.projectDir, "AGENTS.md"))
  ) {
    return makeResidentCost({
      ...cost,
      contextNote: "planned, not counting text already in AGENTS.md",
    });
  }
  return cost;
}

/**
 * #615 남은 틈 ② — 설치 전 헤더가 잴 CLAUDE.md 두 파일: 앵커(배포판 그대로 놓인다) + **설치 뒤의 루트
 * `CLAUDE.md`**. 설치기는 루트 파일이 있으면 그 본문에 import 블록만 얹고, 없으면 `AGENTS.md` 의 설치자
 * 절을 옮겨 심어 만든다(`writeRootClaudeMd`) — 둘 다 설치자 본문이 매 세션 읽힌다. 설치기와 같은 순수
 * 함수로 그 결과를 미리 만들어 잰다. 둘 다 아니면(새 프로젝트) undefined — 지금처럼 템플릿 + 스캐폴드다.
 */
function plannedClaudeContext(spec: InstallSpec): Array<string | { text: string }> | undefined {
  if (!spec.cli.includes("claude")) return undefined;
  const root = resolveBundleRoot();
  const rootClaude = join(spec.projectDir, "CLAUDE.md");
  const existing = existsSync(rootClaude) ? readFileSync(rootClaude, "utf-8") : null;
  const seeded = existing === null ? seedRootClaudeProjectContext(spec.projectDir, root) : null;
  if (existing === null && seeded === null) return undefined;
  const manifestSpec = buildManifestSpec(spec);
  const text = upsertHarnessImport(existing, {
    projectName: basename(spec.projectDir),
    continuousSkills: manifestSpec.selectedInternalSkills ?? [],
    ...(seeded === null ? {} : { projectContext: seeded }),
  });
  return [join(root, "templates", "CLAUDE.md"), { text }];
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

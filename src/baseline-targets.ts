/**
 * baseline-targets.ts — 트랙이 고르는 자산을 **선택 가능한 항목으로** 드러낸다.
 *
 * 왜 있는가: 트랙을 고르면 룰·에이전트·훅·스킬이 화면에 한 번도 안 나온 채 깔렸다. 위저드
 * 3단계는 외부 자산(`EXTERNAL_ASSETS`)만 물었고, `manifest.ts` 가 `applies()` 로 고르는 것들은
 * 설치가 끝난 뒤 요약에서 처음 보였다 — 사용자 지적: *"기술스택 선택했다고 알아서 설치되는
 * 구조는 개선해. 설치항목에 대해서는 모두 투명하게 다 보여줘야 해."*
 *
 * 이 모듈은 그 목록을 **manifest 에서 derive** 한다. 이름을 여기 옮겨 적으면 그게 곧 두 번째
 * 하드코딩 사본이 되고, 자산이 늘어도 화면은 그대로인 상태가 조용히 생긴다 — 이 리포가
 * 반복해서 당한 실패 모드다.
 *
 * **고를 수 있는 것만 낸다.** `settings.json`·앵커·`.mcp.json`·스켈레톤은 빼는 순간 설치가
 * 반쪽이 되므로 목록에 없다. 판별은 대상 경로 접두 하나로 하고, 그 접두는 설치 화면의 분류기
 * (`installer.ts` categorize)와 같은 술어다.
 */

import { type AssetSpec, buildManifest } from "./manifest.js";

/** 사용자가 해제할 수 있는 baseline 자산 종류. */
export type BaselineKind = "rules" | "agents" | "hooks" | "skills";

export const BASELINE_KINDS: ReadonlyArray<BaselineKind> = ["rules", "agents", "hooks", "skills"];

/** 선택 항목 id 의 접두. `asset:` / `option:` 과 같은 자리의 세 번째 네임스페이스다. */
export const BASELINE_PREFIX = "baseline:";

export interface BaselineTarget {
  /** `baseline:<kind>/<name>` — 위저드 체크 값이자 `--without` 인자. */
  id: string;
  kind: BaselineKind;
  /** 사용자에게 보이는 이름 (`git-policy`, `reviewer`, `protect-files`, `deep-research`). */
  name: string;
}

const PREFIX_BY_KIND: ReadonlyArray<[BaselineKind, string]> = [
  ["rules", ".claude/rules/"],
  ["agents", ".claude/agents/"],
  ["hooks", ".claude/hooks/"],
  ["skills", ".claude/skills/"],
];

/**
 * 설치 대상 경로 → 선택 항목. 고를 수 없는 자산이면 null.
 *
 * 스킬은 **첫 경로 조각**으로 이름을 잡는다. manifest 에 디렉터리 엔트리
 * (`.claude/skills/deep-research`)와 그 안의 파일 엔트리(`.claude/skills/spec-scaling/SKILL.md`)가
 * 섞여 있는데, 마지막 조각을 쓰면 후자가 `SKILL.md` 라는 이름의 항목으로 뜬다. 첫 조각으로
 * 잡으면 같은 스킬의 두 형태가 **한 체크박스로 합쳐진다** — 해제하면 둘 다 빠지는 것이 맞다.
 */
export function classifyBaselineTarget(target: string): BaselineTarget | null {
  for (const [kind, prefix] of PREFIX_BY_KIND) {
    if (!target.startsWith(prefix)) continue;
    const rest = target.slice(prefix.length);
    if (rest === "") return null;
    const first = rest.split("/")[0] ?? "";
    const name = kind === "skills" ? first : first.replace(/\.(md|sh)$/, "");
    if (name === "") return null;
    return { id: `${BASELINE_PREFIX}${kind}/${name}`, kind, name };
  }
  return null;
}

/**
 * 이 spec 에서 실제로 깔릴 baseline 자산 목록 (kind → name 순 정렬, 중복 제거).
 *
 * `applies()` 를 여기서 평가한다 — 안 깔릴 것을 화면에 내면 사용자는 해제할 수 없는 항목을
 * 보게 되고, 그건 투명성이 아니라 소음이다.
 *
 * **알려진 한계: `withEcc` 는 이 시점에 모른다** (독립 리뷰 F5). `ecc-plugin` 은 같은 3단계의
 * **뒤쪽 페이지**에서 고르는데 baseline 페이지가 앞에 있어, 여기서는 `withEcc` 가 undefined 다.
 * 결과는 **한 방향으로만 틀린다**: `!s.withEcc` 폴백 에이전트 4종(`build-error-resolver` ·
 * `code-reviewer` · `security-reviewer` · `silent-failure-hunter`)이 화면에 뜨는데 `ecc-plugin`
 * 을 고르면 안 깔린다. 그 반대(안 보여 준 것이 깔리는 것)는 일어나지 않으므로 **조용한 설치는
 * 생기지 않고**, 체크를 남겨 둔 항목은 제외 목록에도 안 들어가 오제외도 없다.
 *
 * 고치려면 baseline 페이지를 자산 페이지 **뒤로** 옮겨야 한다 — 사용자가 확정한 "맨 앞에서 전부
 * 보여준다"를 뒤집는 결정이라 여기서 임의로 하지 않는다 (ADR-074 Consequences).
 *
 * `selectedInternalSkills` 는 한계가 아니다. 그 12종은 전부 `EXTERNAL_ASSETS` 항목이라 자산
 * 페이지에서 이미 개별 선택되고, 여기 또 내면 **한 스킬에 체크박스가 둘** 생긴다.
 */
export function listBaselineTargets(spec: AssetSpec): BaselineTarget[] {
  const byId = new Map<string, BaselineTarget>();
  for (const entry of buildManifest(spec)) {
    if (!entry.applies(spec)) continue;
    const t = classifyBaselineTarget(entry.target);
    if (t && !byId.has(t.id)) byId.set(t.id, t);
  }
  const order = new Map(BASELINE_KINDS.map((k, i) => [k, i]));
  return [...byId.values()].sort(
    (a, b) => (order.get(a.kind) ?? 0) - (order.get(b.kind) ?? 0) || a.name.localeCompare(b.name),
  );
}

/**
 * 제외 판정. 대상 경로가 해제된 항목에 속하면 true.
 *
 * 고를 수 없는 자산(`settings.json` 등)은 `classifyBaselineTarget` 이 null 을 내므로 **어떤
 * 제외 목록으로도 빠지지 않는다** — 잘못된 id 가 들어와도 설치가 반쪽이 되지 않는다.
 */
export function isBaselineExcluded(target: string, excluded: ReadonlySet<string>): boolean {
  if (excluded.size === 0) return false;
  const t = classifyBaselineTarget(target);
  return t !== null && excluded.has(t.id);
}

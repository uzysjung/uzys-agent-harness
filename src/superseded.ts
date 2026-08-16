/**
 * superseded.ts — **이번 선택이 밀어낸, 그런데 디스크에 남아 있는** 자산을 찾는다.
 *
 * 왜 있는가: `ecc-plugin` 을 고르면 하네스가 깔아 둔 폴백 에이전트 4종
 * (`build-error-resolver` · `code-reviewer` · `security-reviewer` · `silent-failure-hunter`)이
 * manifest 상 `applies: (s) => !s.withEcc` 라 **더 이상 설치 대상이 아니게 된다.** 그런데 이미
 * 깔려 있던 파일은 아무도 안 지웠다 — install 은 안 깔 뿐이고, `pruneOrphans` 는 `templates/` 에
 * 원본이 있으면 손대지 않는다. 실측(빈 프로젝트 → 설치 → `--with ecc-plugin` → `update`):
 * 세 단계 내내 9개 그대로.
 *
 * 결과는 **같은 일을 하겠다는 에이전트가 두 벌**이다. ECC 는 자기 `code-reviewer.md` 를 들고
 * 오므로 이름까지 겹친다. 비용은 ~287 tok/세션, 영구. 화면은 아무 말도 안 했다.
 *
 * ## 판정식 — 열거하지 않는다
 *
 * `ecc` 를 이름으로 적으면 그게 두 번째 하드코딩 사본이 되고, 다음에 같은 형태(플러그인 ↔ 폴백)가
 * 생기면 그때 또 이 파일을 고쳐야 한다. 그래서 **manifest 가 답하게 한다**:
 *
 * | 조건 | 뜻 |
 * |---|---|
 * | ① 디스크에 있다 | 실제로 사용자 저장소를 차지하고 있다 |
 * | ② 이번 spec 에서 `applies() === false` | 이번 선택이 밀어냈다 |
 * | ③ install log 해시가 일치 | **하네스가 깔았고 사용자가 안 고쳤다** |
 *
 * ③ 이 삭제 제안의 유일한 근거다. 기록이 없거나 내용이 다르면 소유를 주장할 수 없으므로
 * 후보에서 뺀다 — `pruneOrphans` 가 쓰는 것과 **같은 술어**(`isHarnessOwned`)이고, 소유 판정이
 * 두 벌이 되면 한쪽이 백업한 것을 다른 쪽이 조용히 지운다.
 *
 * ## 범위를 좁힌 두 곳 (둘 다 사유가 있다)
 *
 * **트랙이 바뀌면 아무것도 안 낸다.** 트랙을 바꿔서 안 깔리게 된 것과 옵션을 골라서 밀려난 것은
 * **원인이 다르고, 원인이 다르면 문구도 달라야 한다**(`installedNew` vs `restored` 와 같은 규율).
 * 게다가 트랙 제거는 위저드가 *"Track removal is not automated"* 로 **자동화하지 않겠다고 이미
 * 선언한** 영역이다 — 여기서 슬쩍 자동화하면 그 선언이 거짓이 된다.
 *
 * **디렉터리 자산(스킬)은 안 낸다.** 스킬 디렉터리 안에는 사용자가 자기 참고 파일을 넣는다.
 * ADR-046 이 "스킬은 지우지 않는다"로 이미 판정했고(`syncSkills` 의 orphan prune 부재), 그
 * 판정을 여기서 뒤집을 이유가 없다.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyBaselineTarget } from "./baseline-targets.js";
import { type InstallLog, isHarnessOwned, POLICY_DIRS } from "./install-log.js";
import { type AssetSpec, buildManifest } from "./manifest.js";

export interface SupersededAsset {
  /** projectDir 상대 경로 (`.claude/agents/code-reviewer.md`). 실제 삭제 대상. */
  target: string;
  /** `baseline:<kind>/<name>` — 화면 표기와 재설치 안내에 쓰는 이름. */
  id: string;
  /**
   * `templates/` 기준 원본 경로. 상주 비용을 **기존 계측기로** 재기 위해 들고 간다
   * (`residentCost` 가 `{source, target}` 을 받는다) — 여기서 토큰을 따로 세면 그 계산이
   * 두 번째 사본이 되어 계측기와 조용히 갈린다.
   */
  source: string;
}

/** 순서 무관 동등 비교. 트랙은 집합이지 순열이 아니다. */
function sameTracks(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((t, i) => t === sb[i]);
}

/**
 * `.claude/rules/git-policy.md` → `rules/git-policy.md` (install log `policyFiles` 의 키 형식).
 * 기준선에 키가 없는 대상(스킬 디렉터리 등)이면 null.
 *
 * `.claude/` 접두는 **다시 확인하지 않는다** — 호출부가 `classifyBaselineTarget` 을 먼저 통과시키고
 * 그 술어의 접두 목록이 전부 `.claude/` 다. 여기서 또 검사하면 도달할 수 없는 분기가 생기고,
 * 도달 못 하는 분기는 커버리지에서 영원히 빈칸으로 남아 무엇이 정말 안 덮였는지를 가린다.
 */
function policyKey(claudeRelative: string): string | null {
  return POLICY_DIRS.some(
    ({ dir, ext }) => claudeRelative.startsWith(`${dir}/`) && claudeRelative.endsWith(ext),
  )
    ? claudeRelative
    : null;
}

/**
 * 이번 설치가 밀어냈는데 디스크에 남아 있고, 하네스가 소유를 증명할 수 있는 자산.
 *
 * @param previous **설치 전** install log. 없으면 빈 배열 — 소유를 주장할 근거가 없다.
 */
export function findSuperseded(
  projectDir: string,
  spec: Required<AssetSpec>,
  previous: InstallLog | null,
): SupersededAsset[] {
  if (!previous) return [];
  if (!sameTracks(previous.spec.tracks, spec.tracks)) return [];

  const baseline = new Map((previous.policyFiles ?? []).map((f) => [f.path, f.sha256]));
  if (baseline.size === 0) return [];

  const out: SupersededAsset[] = [];
  for (const entry of buildManifest(spec)) {
    if (entry.applies(spec)) continue; // 이번에도 깔린다 = 밀려난 것이 아니다
    const id = classifyBaselineTarget(entry.target)?.id;
    if (!id) continue; // 구조 자산은 후보가 아니다 (빼면 설치가 반쪽이 된다)
    // 스킬 디렉터리가 여기서 걸러진다 — `POLICY_DIRS` 에 `skills` 가 없고 확장자도 안 맞는다.
    // 한때 `entry.type !== "file"` 검사를 함께 뒀는데 변이 대조에서 **둘 다 살아남았다**:
    // 서로를 가려 어느 쪽도 게이트가 아니었다. 필요한 하나만 남긴다.
    const key = policyKey(entry.target.slice(".claude/".length));
    if (!key) continue;

    const abs = join(projectDir, entry.target);
    if (!existsSync(abs)) continue;
    // 소유 판정 — 기록이 없거나 내용이 다르면 사용자 것이다. 여기가 마지막 문이다.
    if (!isHarnessOwned(baseline, key, readFileSync(abs, "utf-8"))) continue;

    out.push({ target: entry.target, id, source: entry.source });
  }
  return out;
}

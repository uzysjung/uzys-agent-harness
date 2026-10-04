/**
 * ADR-099 R3 · 리뷰 #693 NOTE-1 — 설치자가 뺐는데(누적 `excluded`) 앞 설치가 놓은 것이 아직 있는 자산. 하네스는 빼기를
 * 이유로 지우지 않으므로(체크 해제 ≠ 제거) install · update 화면이 같은 판정으로 말한다: 더는 갱신하지 않는다 · 계속 쓰려면
 * `--with <id>` · 치우려면 손으로(카탈로그 자산만 `uninstall --only <id>`).
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { classifyBaselineTarget } from "./baseline-targets.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
import type { InstallLog, InstallLogAsset } from "./install-log.js";

/** ADR-099 R3 — 뺐는데 앞 설치가 놓은 것이 그대로 있는 id 하나. `catalog` = 외부 자산(`uninstall --only` 를 받는다). */
export interface ExcludedStillThere {
  id: string;
  catalog: boolean;
}

/**
 * ADR-099 R3 — 누적 `excluded` 중 앞 설치가 놓은 것이 아직 있는 것. 하네스는 빼기를 이유로 지우지 않으므로(체크 해제 ≠
 * 제거) 화면이 말해야 한다: baseline 은 디스크에 남은 대상, 번들 스킬은 스킬 자리, 카탈로그 자산은 설치 기록.
 */
export function excludedStillThere(
  projectDir: string,
  excluded: ReadonlySet<string>,
  baselineOnDisk: ReadonlyArray<string>,
  previousLog: InstallLog | null,
): ExcludedStillThere[] {
  const out: ExcludedStillThere[] = [];
  const add = (id: string, catalog: boolean): void => {
    if (!out.some((e) => e.id === id)) out.push({ id, catalog });
  };
  for (const target of baselineOnDisk) {
    const t = classifyBaselineTarget(target);
    if (t !== null) add(t.id, false);
  }
  for (const id of excluded) {
    if (INTERNAL_BUNDLED_SKILL_IDS.includes(id)) {
      const there = [".claude/skills", ".agents/skills"].some((d) =>
        existsSync(join(projectDir, d, id)),
      );
      if (there) add(id, false);
    } else {
      const asset = previousLog?.assets.find((a) => a.id === id);
      if (asset !== undefined && assetStillThere(projectDir, asset)) add(id, true);
    }
  }
  return out;
}

/**
 * 기록된 외부 자산이 아직 이 프로젝트에 있는가 — 프로젝트 스킬은 디스크로 본다(도구가 놓은 파일 기록 #573, 없으면 스킬
 * 자리). 플러그인 · npm 같은 프로젝트 밖 자산은 디스크로 알 수 없어 기록을 따른다.
 */
function assetStillThere(projectDir: string, asset: InstallLogAsset): boolean {
  if (asset.method !== "skill" || asset.scope === "global") return true;
  if (asset.files !== undefined)
    return asset.files.some((f) => existsSync(join(projectDir, f.path)));
  const dir = asset.detail.skill ?? asset.id;
  return [".claude/skills", ".agents/skills"].some((d) => existsSync(join(projectDir, d, dir)));
}

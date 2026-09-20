import { describe, expect, it } from "vitest";
import { DEV_TRACKS, EXTERNAL_ASSETS } from "../src/external-assets.js";
import { recommendedExternalAssets } from "../src/preset-recommend.js";
import { DEFAULT_OPTIONS, TRACKS } from "../src/types.js";

// WHY: 추천 결과를 자산 id 로 핀하면 카탈로그가 한 줄 바뀔 때마다 테스트가 깨진다(#492 에서
//   은퇴 자산 id 들이 그대로 남아 있었다). id 대신 **추천이 지켜야 할 성질**을 전 트랙에
//   훑어서 건다 — 자산이 들고 나도 성질은 그대로이고, 새 자산도 자동으로 커버된다.

describe("recommendedExternalAssets", () => {
  it("empty presets → empty recommendation", () => {
    expect(recommendedExternalAssets([])).toEqual([]);
  });

  it("모든 트랙의 추천이 카탈로그 실재 · 비-experimental · 비-opt-in · 조건 매치를 지킨다", () => {
    const byId = new Map(EXTERNAL_ASSETS.map((a) => [a.id, a]));
    let checked = 0;

    for (const track of TRACKS) {
      for (const id of recommendedExternalAssets([track])) {
        const asset = byId.get(id);
        // ① 추천한 id 가 카탈로그에 실재한다 (없으면 설치 단계에서 조용히 사라진다).
        expect(asset, `'${track}' 추천 id '${id}' 가 EXTERNAL_ASSETS 에 없다`).toBeDefined();
        if (!asset) continue;
        checked += 1;

        // ② experimental(T3)은 pre-check 제외 — opt-in 으로만 들어온다 (PRD v26-71 R6).
        expect(asset.tier, `'${id}' 는 experimental 인데 '${track}' 에서 추천됐다`).not.toBe(
          "experimental",
        );

        // ③ 순수 opt-in 자산은 `--with <id>` / 위저드 체크로만 — 추천에 뜨면 안 된다 (ADR-022).
        expect(asset.condition.kind, `'${id}' 는 opt-in 인데 '${track}' 에서 추천됐다`).not.toBe(
          "opt-in",
        );

        // ④ 조건이 실제로 그 트랙에 매치한다 — 추천 구현과 별개로 condition 을 다시 읽어 판정.
        const cond = asset.condition;
        const matches =
          cond.kind === "any-track"
            ? cond.tracks.includes(track)
            : cond.kind === "has-dev-track"
              ? DEV_TRACKS.includes(track)
              : cond.kind === "option"
                ? DEFAULT_OPTIONS[cond.flag] === true
                : false;
        expect(matches, `'${id}' 의 condition(${cond.kind})이 '${track}' 에 매치하지 않는다`).toBe(
          true,
        );
      }
    }

    // 전제 확인: 한 건도 안 봤으면 위 단언 전부가 헛통과다.
    expect(
      checked,
      "어느 트랙도 자산을 추천하지 않았다 — 픽스처/카탈로그가 잘못됐다",
    ).toBeGreaterThan(0);
  });
});

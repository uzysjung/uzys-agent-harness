import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * 정기 실행(cron)이 실패했을 때 **사람에게 도달하는 경로**가 있는지 검사한다 (v26.139.0).
 *
 * 왜 게이트인가: 이 리포에서 실제로 일어난 일이다. cron 2개가 2026-07-01 예정대로 발동해 2/2
 * 실패했고, 그 실패는 인프라 오류가 아니라 **설계된 신호**였다(`❌ drift 1건 … demote`). 그런데
 * 두 워크플로 모두 `permissions: contents: read` 뿐이고 이슈 생성 스텝이 없어 **알림 경로가 0**
 * 이었다. 코드 반영은 13일 뒤였고 그 계기도 cron 이 아니라 사람이 시작한 감사였다.
 *
 * 즉 공백의 이름은 "정기성"이 아니라 **"알림"** 이다 — 정기 실행은 이미 있었고 정기 개선이
 * 없었다. 알림 스텝은 조용히 지워져도 아무 증상이 없다(다음 실패까지 최대 한 달). 그래서 게이트다.
 *
 * 대상은 **글롭으로 훑는다** — 워크플로 이름을 여기 적으면 그게 두 번째 하드코딩 사본이 되고,
 * 새로 추가된 cron 이 검사를 빠져나간다 (no-false-ship "열거하지 말고 훑어라").
 */
const WORKFLOW_DIR = fileURLToPath(new URL("../.github/workflows", import.meta.url));

/** `on:` 에 `schedule:` 이 있는 워크플로만 대상. dispatch 전용은 사람이 보고 있으므로 제외. */
function scheduledWorkflows(): Array<{ name: string; body: string }> {
  return readdirSync(WORKFLOW_DIR)
    .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
    .map((name) => ({ name, body: readFileSync(`${WORKFLOW_DIR}/${name}`, "utf8") }))
    .filter((w) => /^\s{2}schedule:/m.test(w.body));
}

const SCHEDULED = scheduledWorkflows();

describe("cron 실패 알림 경로", () => {
  it("검사 대상이 실제로 잡힌다 (0건이면 게이트가 죽은 것)", () => {
    expect(
      SCHEDULED.length,
      "schedule 워크플로가 하나도 안 잡혔다 — 탐지 정규식이 YAML 들여쓰기 변화를 못 따라갔을 수 있다",
    ).toBeGreaterThan(0);
  });

  it.each(SCHEDULED.map((w) => w.name))("%s 이 실패를 이슈로 알린다", (name) => {
    const body = SCHEDULED.find((w) => w.name === name)?.body ?? "";

    expect(
      body,
      `${name}: \`issues: write\` 가 없다 — gh issue create 가 403 으로 죽고, 그 죽음도 조용하다`,
    ).toMatch(/^\s*issues:\s*write/m);

    expect(
      body,
      `${name}: \`if: failure()\` 스텝이 없다. 성공 경로에만 붙은 알림은 실패를 못 잡는다`,
    ).toMatch(/if:\s*failure\(\)/);

    // 링크 없는 알림은 받는 사람이 run 을 다시 찾아야 한다 — 그 마찰이 곧 무시로 이어진다.
    expect(body, `${name}: 실패 알림에 run URL 이 없다`).toMatch(
      /actions\/runs\/\$\{\{\s*github\.run_id\s*\}\}/,
    );

    // 매 실패마다 새 이슈를 만들면 알림이 소음이 되고, 소음은 다시 무시된다 — 지금과 같은 상태로
    // 돌아간다. 기존 열린 이슈를 조회해 코멘트로 합치는 경로가 있어야 한다.
    expect(
      body,
      `${name}: 중복 방지가 없다 — 기존 이슈 조회(gh issue list) 후 comment 경로가 필요하다`,
    ).toMatch(/gh issue list[\s\S]*gh issue comment/);
  });
});

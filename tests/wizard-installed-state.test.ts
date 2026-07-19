import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { type InstallLog, installLogPath } from "../src/install-log.js";
import { initialTargetSelection, installedTargetState } from "../src/interactive.js";
import { buildPageGroups } from "../src/prompts.js";

/**
 * v26.125.0 — wizard step 3 의 체크 상태가 **설치 상태와 무관**했다. 사전 체크는 트랙 추천에서만
 * 나왔고(`recommendedExternalAssets`) 위저드 경로 어디서도 install log 를 읽지 않았다. 그래서
 * 이미 깔린 자산이 빈칸으로 보였고, 사용자는 그 체크박스를 "설치 상태"로 읽었다 — 화면이 거짓을
 * 말한 것이다. 체크 해제가 제거로 이어지지 않는다는 사실보다 이쪽이 더 나쁘다.
 */
function writeLog(projectDir: string, assets: InstallLog["assets"]): void {
  mkdirSync(join(projectDir, ".claude"), { recursive: true });
  const log: InstallLog = {
    schemaVersion: 1,
    installedAt: "2026-07-19T00:00:00.000Z",
    scope: "project",
    spec: { tracks: ["tooling"], cli: ["claude"] },
    templates: { claudeDir: ".claude/" },
    assets,
  };
  writeFileSync(installLogPath(projectDir), JSON.stringify(log), "utf8");
}

function asset(id: string, scope: "project" | "global"): InstallLog["assets"][number] {
  return { id, category: "dev-tools", method: "plugin", scope, detail: {} };
}

describe("installedTargetState — 설치 상태 조회", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-wiz-"));
  });

  it("로그가 없으면 빈 상태 — 최초 설치에서 기존 동작이 바뀌지 않는다", () => {
    expect(installedTargetState(dir)).toEqual({ installed: [], projectScoped: [] });
    rmSync(dir, { recursive: true, force: true });
  });

  it("project scope 는 표시 + 사전 체크 양쪽에 들어간다", () => {
    writeLog(dir, [asset("code-review", "project")]);
    expect(installedTargetState(dir)).toEqual({
      installed: ["code-review"],
      projectScoped: ["code-review"],
    });
    rmSync(dir, { recursive: true, force: true });
  });

  it("global scope 는 표시만 하고 사전 체크하지 않는다 — 체크하면 project 로 한 벌 더 깔린다", () => {
    writeLog(dir, [asset("g", "global")]);
    expect(installedTargetState(dir)).toEqual({ installed: ["g"], projectScoped: [] });
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("initialTargetSelection — 추천 ∪ 설치됨(project)", () => {
  it("설치된 project 자산은 추천 밖이어도 체크된 채로 시작한다", () => {
    const sel = initialTargetSelection(["tooling"], ["bmad-method"]);
    expect(sel).toContain("asset:bmad-method");
  });

  it("중복 없이 합쳐진다 — 추천이면서 설치된 자산이 두 번 나오면 카운트가 거짓이 된다", () => {
    const recommended = initialTargetSelection(["tooling"], []);
    const first = recommended[0];
    if (!first) throw new Error("tooling 트랙에 추천 자산이 없다 — 테스트 전제 실패");
    const id = first.replace("asset:", "");
    const merged = initialTargetSelection(["tooling"], [id]);
    expect(merged.filter((v) => v === first)).toHaveLength(1);
    expect(merged).toHaveLength(recommended.length);
  });
});

describe("buildPageGroups — installed 마커", () => {
  it("설치된 자산 행에 마커가 붙는다", () => {
    const { flatItems } = buildPageGroups(
      ["dev-tools"],
      new Set<string>(),
      new Set(["asset:code-review"]),
    );
    const row = flatItems.find((i) => i.value === "asset:code-review");
    expect(row?.label).toContain("installed");
  });

  it("설치 안 된 자산에는 안 붙는다 — 전부 붙으면 마커가 정보를 주지 않는다", () => {
    const { flatItems } = buildPageGroups(["dev-tools"], new Set<string>(), new Set<string>());
    expect(flatItems.every((i) => !i.label.includes("installed"))).toBe(true);
  });

  it("installedSet 미지정 시 기존 라벨 그대로 (구 호출부 무영향)", () => {
    const a = buildPageGroups(["dev-tools"], new Set<string>());
    const b = buildPageGroups(["dev-tools"], new Set<string>(), new Set<string>());
    expect(a.flatItems.map((i) => i.label)).toEqual(b.flatItems.map((i) => i.label));
  });
});

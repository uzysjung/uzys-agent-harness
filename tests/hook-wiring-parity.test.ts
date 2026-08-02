import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ALWAYS_HOOKS } from "../src/manifest.js";

/**
 * "설치되는 훅은 전부 배선돼 있다" 게이트 (룰·훅 다이어트 AC1).
 *
 * 왜 게이트인가: 배선 없는 훅은 **설치는 되는데 한 번도 실행되지 않는다.** 실측으로
 * `checkpoint-snapshot.sh` 가 그 상태였다 — `ALWAYS_HOOKS` 에 있어 모든 설치본의
 * `.claude/hooks/` 에 깔리지만 `templates/settings.json` 의 어떤 이벤트도 부르지 않아
 * 실행 0. 사용자는 "훅이 4개 깔렸다"고 읽고 우리는 상주 비용만 지불한다. 프로즈로는 못
 * 잡는다 — 안 도는 훅은 실패 증상이 없기 때문이다.
 *
 * 양방향으로 건다: 배선 없는 설치(고아 설치) ↔ 설치 없는 배선(고아 파일). 목록은
 * `ALWAYS_HOOKS` import 와 `readdirSync` 로 **derive** 한다 — 훅 이름을 여기 적으면
 * 그게 곧 세 번째 하드코딩 사본이 되고, 지운 훅이 이 파일에 살아남아 게이트가 거짓말한다.
 *
 * 범위는 배포판(`templates/`)이다. `.claude/` 사본은 dev 전용 훅
 * (`docker-only-realcli.sh`)을 추가로 갖고 `.claude/settings.json` 은 사용자 소유라
 * 여기서 판정하지 않는다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Settings {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
}

/** 배선된 모든 command 문자열. 이벤트 이름을 적지 않는다 — 새 이벤트가 생겨도 자동 포함. */
function wiredCommands(): string[] {
  const settings = JSON.parse(
    readFileSync(join(ROOT, "templates/settings.json"), "utf8"),
  ) as Settings;
  return Object.values(settings.hooks ?? {}).flatMap((groups) =>
    groups.flatMap((group) => (group.hooks ?? []).map((h) => h.command ?? "")),
  );
}

const COMMANDS = wiredCommands();
const SHIPPED_HOOK_FILES = readdirSync(join(ROOT, "templates/hooks"))
  .filter((f) => f.endsWith(".sh"))
  .sort();

describe("훅 배선 parity (설치 ↔ settings.json ↔ 파일)", () => {
  it("검사 대상이 세 방향 모두 비어 있지 않다 (0건이면 게이트가 죽은 것)", () => {
    expect(ALWAYS_HOOKS.length, "ALWAYS_HOOKS 가 비었다").toBeGreaterThan(0);
    expect(COMMANDS.length, "templates/settings.json 에서 뽑은 command 가 0건이다").toBeGreaterThan(
      0,
    );
    expect(SHIPPED_HOOK_FILES.length, "templates/hooks/*.sh 가 0건이다").toBeGreaterThan(0);
  });

  // ⓐ 설치되는데 아무도 안 부르는 훅 = 실행 0. 상주 비용만 남는다.
  it.each(ALWAYS_HOOKS)("%s 가 templates/settings.json 에 배선돼 있다", (name) => {
    expect(
      COMMANDS.some((cmd) => cmd.includes(name)),
      `ALWAYS_HOOKS 에 있는 ${name} 이 templates/settings.json 의 어떤 hooks command 에도 없다 — ` +
        "설치는 되지만 실행되지 않는다(고아 설치). 배선하거나 ALWAYS_HOOKS 에서 지워라.\n" +
        `배선된 command: ${COMMANDS.join(" | ")}`,
    ).toBe(true);
  });

  // ⓑ manifest 가 가리키는 원본이 없으면 설치 자체가 깨진다.
  it.each(ALWAYS_HOOKS)("%s 가 templates/hooks/ 에 실재한다", (name) => {
    expect(
      existsSync(join(ROOT, "templates/hooks", name)),
      `ALWAYS_HOOKS 에 있는 ${name} 의 원본 파일 templates/hooks/${name} 이 없다 — 설치가 깨진다.`,
    ).toBe(true);
  });

  // ⓒ 반대 방향: 아무도 설치하지 않는 훅 파일이 배포물에 남아 출하되는 것을 막는다.
  it.each(SHIPPED_HOOK_FILES)("templates/hooks/%s 가 ALWAYS_HOOKS 에 있다", (name) => {
    expect(
      ALWAYS_HOOKS.includes(name),
      `templates/hooks/${name} 이 ALWAYS_HOOKS 에 없다 — 설치되지 않는 고아 훅 파일이 배포물에 실린다. ` +
        "ALWAYS_HOOKS 에 넣고 배선하거나 파일을 지워라.\n" +
        `ALWAYS_HOOKS: ${ALWAYS_HOOKS.join(", ")}`,
    ).toBe(true);
  });
});

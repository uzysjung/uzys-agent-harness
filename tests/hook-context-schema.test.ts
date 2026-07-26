import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * 훅 stdout 이 **모델에 도달하는 스키마**인지 검사한다 (v26.137.0).
 *
 * 왜 게이트인가: 조용히 버려지는 훅 출력은 실패해도 아무 증상이 없다. 실측으로 확인한 실패:
 * `session-start.sh` 가 `{"priority","message"}` 를 뱉었는데 CLI 가 읽는 필드가 아니라
 * **유효 JSON 인 채로 폐기**됐다 — hook attachment 40건 중 모델이 보는 `content` 가 채워진 것은
 * 1건뿐이었고, 그 1건조차 `git pull` 출력이 앞에 붙어 JSON 이 **깨진** 덕분이었다. 즉 고아 프로세스
 * 경고도 SPEC 앵커도 한 번도 의도대로 도달한 적이 없다. 프로즈로는 이걸 못 잡는다 — 훅이 "돌긴
 * 도는데" 화면에 아무 흔적이 없기 때문이다.
 *
 * 대상은 **`templates/settings.json` 의 배선에서 derive** 한다. 훅 이름을 여기 적으면 그게 곧
 * 두 번째 하드코딩 사본이 되고, 새로 배선된 훅이 검사를 빠져나간다 (no-false-ship "열거 말고 훑어라").
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

interface Settings {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
}

/** 배선에서 `.claude/hooks/<name>.sh` 를 뽑는다. 스킬 사이드카 훅은 이 검사 대상이 아니다. */
function wiredHooks(event: string): string[] {
  const settings = JSON.parse(
    readFileSync(join(ROOT, "templates/settings.json"), "utf8"),
  ) as Settings;
  const out: string[] = [];
  for (const group of settings.hooks?.[event] ?? []) {
    for (const h of group.hooks ?? []) {
      const m = /\.claude\/hooks\/([\w.-]+\.sh)/.exec(h.command ?? "");
      if (m?.[1]) out.push(m[1]);
    }
  }
  return out;
}

const SESSION_START = wiredHooks("SessionStart");

describe("SessionStart 훅의 출력 스키마", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "harness-hook-schema-"));
    // git 스텁 — ⓐ 네트워크/부작용 차단 ⓑ **stdout 오염을 일부러 만든다.** 실제 사고가
    // `git pull` 의 "Already up to date." 가 JSON 앞에 붙어 벌어졌으므로, 그 조건에서도
    // 계약이 지켜지는지 보는 것이 이 테스트의 핵심이다.
    const stub = join(dir, "git");
    writeFileSync(
      stub,
      '#!/bin/sh\ncase "$1" in\n  rev-parse) echo "main" ;;\n  pull) echo "Already up to date." ;;\n  *) : ;;\nesac\n',
      "utf8",
    );
    chmodSync(stub, 0o755);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("검사 대상이 배선에서 실제로 뽑힌다 (0건이면 게이트가 죽은 것)", () => {
    expect(SESSION_START.length).toBeGreaterThan(0);
  });

  // 배포판과 설치본 **양쪽** 을 돈다. 이 리포는 자기 배포물을 도그푸딩하므로 한쪽만 고치면
  // 파는 것과 쓰는 것이 갈린다. 바이트 동일성으로 묶지 않는 이유는 아래 별도 테스트에 적었다.
  const copies = SESSION_START.flatMap((name) => [
    { name, dirLabel: "templates" as const },
    { name, dirLabel: ".claude" as const },
  ]);

  it.each(copies)("$dirLabel/hooks/$name 의 stdout 이 CLI 가 읽는 스키마다", ({
    name,
    dirLabel,
  }) => {
    const stdout = execFileSync("bash", [join(ROOT, dirLabel, "hooks", name)], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, PATH: `${dir}:${process.env.PATH ?? ""}` },
      timeout: 10_000,
    });

    let parsed: unknown;
    expect(
      () => {
        parsed = JSON.parse(stdout);
      },
      `${name} 의 stdout 이 유효 JSON 이 아니다. 앞에 다른 명령의 출력이 섞였을 가능성이 크다 — 실제로 그렇게 깨진 적이 있다:\n${stdout.slice(0, 200)}`,
    ).not.toThrow();

    const hs = (parsed as { hookSpecificOutput?: Record<string, unknown> }).hookSpecificOutput;
    expect(
      hs,
      `${name} 이 \`hookSpecificOutput\` 없이 출력했다. CLI 가 모르는 필드는 **유효 JSON 이어도 조용히 버려진다** — ` +
        "훅은 도는데 모델은 아무것도 못 본다. 실제로 그 상태로 출하됐었다.",
    ).toBeDefined();
    expect(hs?.hookEventName).toBe("SessionStart");
    expect(
      typeof hs?.additionalContext === "string" && (hs.additionalContext as string).length > 0,
      `${name} 의 additionalContext 가 비어 있다 — 도달은 하지만 전달할 내용이 없다.`,
    ).toBe(true);
  });

  // **바이트 동일성은 일부러 요구하지 않는다.** 처음엔 그렇게 썼다가 배포 위생 게이트
  // (`templates-distribution-hygiene`)와 충돌했다 — 이 리포의 사건 기록은 `.claude/` 사본에만 두고
  // 배포판에는 원칙만 남기는 것이 기존 규칙이고, 그쪽이 사고 근거가 있어 이긴다. 지켜야 할 것은
  // 주석의 일치가 아니라 **동작의 일치**이므로 위 테스트가 양쪽을 실행해 같은 계약을 건다.
  // 대신 여기서는 사본이 존재는 하는지만 본다 — 한쪽이 통째로 없으면 위 테스트가 조용히 반쪽만 돈다.
  it.each(SESSION_START)("%s 가 배포판과 설치본 양쪽에 존재한다", (name) => {
    for (const d of ["templates", ".claude"]) {
      expect(existsSync(join(ROOT, d, "hooks", name)), `${d}/hooks/${name} 가 없다`).toBe(true);
    }
  });
});

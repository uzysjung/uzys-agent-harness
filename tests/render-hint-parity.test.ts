import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXTERNAL_ASSETS } from "../src/external-assets";
import { buildRouterChoices } from "../src/router.js";
import { runUpdateMode } from "../src/update-mode.js";

// WHY: ADR-022(v26.81.0, BREAKING) 가 자산 1:1 opt-in 플래그 13종(--with-ecc 등)을
//   삭제하고 generic `--with <id>` 로 일원화했다. 그러나 설치 출력의 힌트 문자열은
//   cac 등록·카테고리 exhaustiveness 가드 어디에도 안 걸리는 사각지대라,
//   install-render.ts 가 삭제된 `--with-ecc` 를 v26.83.0 까지 광고했다
//   (audit CODE-1 — 따라하면 silent no-op, no-false-ship "광고≠실동작" 4번째 재발).
//   렌더 소스에 ① 하이픈형 자산 플래그 재등장 ② 카탈로그에 없는 자산 id 안내 를 차단.

const RENDER_SRC = readFileSync("src/commands/install-render.ts", "utf-8");

describe("렌더 힌트 parity (audit CODE-1)", () => {
  it("삭제된 하이픈형 자산 플래그 '--with-<id>' 재등장 0건 (공백형 '--with <id>' 만 허용)", () => {
    // 별개 옵션 --with-codex-prompts 가 이 렌더 파일에 정당히 들어오면 화이트리스트 갱신.
    const hits = RENDER_SRC.match(/--with-[a-z][a-z-]*/g) ?? [];
    expect(
      hits,
      `삭제된 자산 플래그 형태 발견: ${JSON.stringify(hits)} — generic '--with <id>' 로 교체`,
    ).toEqual([]);
  });

  it("렌더가 하드코딩으로 안내하는 자산 id 가 카탈로그에 실재 (ecc-plugin)", () => {
    // install-render.ts:521 의 'Use --with ecc-plugin ...' 안내.
    const advertised = "ecc-plugin";
    const ids = new Set(EXTERNAL_ASSETS.map((a) => a.id));
    expect(ids.has(advertised), `렌더가 안내하는 '${advertised}' 가 EXTERNAL_ASSETS 에 없음`).toBe(
      true,
    );
  });

  it("FILL 스캐폴드 안내가 설치 출력에 존재 (채우기 트리거 = 콘솔 메시지)", () => {
    // WHY: v26.96.0 fill 스캐폴드의 채우기 트리거는 커맨드가 아니라 '설치 콘솔 안내 + 주석 복붙'이다.
    //   이 안내가 조용히 사라지면 스캐폴드를 발견/채우는 유일한 경로가 끊긴다 (no-false-ship).
    expect(RENDER_SRC).toContain('"FILL"');
    expect(RENDER_SRC).toMatch(/fill-in scaffold/i);
  });
});

/**
 * v26.127.0 — 위저드 라우터의 update hint 가 **실제 갱신 대상**을 다 말하는가.
 *
 * WHY: v26.126.0 이 `.claude/skills` 를 갱신 목록에 넣고도 hint 는 `"rules / agents /
 *   commands / hooks"` 그대로 두고 출하했다(v26.126.1 정정). `install` 은 mode 를 넘기지
 *   않으므로 **update 는 위저드로만 도달**한다 — 이 한 줄이 update 동작의 유일한 광고다.
 *
 * 이 게이트는 **열거하지 않고 derive 한다**(`no-false-ship` §게이트는 열거하지 말고 훑어라):
 *   기대 목록을 여기 적어두면 그게 두 번째 하드코딩 사본이 되고, 6번째 대상이 추가될 때
 *   목록에 없는 그것이 다음 drift 서식지가 된다. 대신 **update 를 실제로 돌려서** 무엇을
 *   건드렸는지 보고 그것이 hint 에 있는지 본다. 새 대상이 생기면 자동으로 커버된다.
 */
describe("update hint 가 실제 갱신 대상을 광고한다 (derive)", () => {
  it("update 가 건드리는 모든 디렉터리가 hint 에 언급된다", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "hint-derive-p-"));
    const templatesDir = mkdtempSync(join(tmpdir(), "hint-derive-t-"));
    try {
      // update 가 손댈 수 있는 자리를 전부 만들어 둔다 — 비어 있으면 그 대상이 report 에
      // 안 잡혀서, 게이트가 "언급 안 해도 통과"로 새어 나간다.
      for (const d of ["rules", "agents", "commands/uzys", "hooks", "skills/demo"]) {
        mkdirSync(join(templatesDir, d), { recursive: true });
        mkdirSync(join(projectDir, ".claude", d), { recursive: true });
      }
      writeFileSync(join(templatesDir, "rules/r.md"), "new");
      writeFileSync(join(projectDir, ".claude/rules/r.md"), "old");
      writeFileSync(join(templatesDir, "agents/a.md"), "new");
      writeFileSync(join(projectDir, ".claude/agents/a.md"), "old");
      writeFileSync(join(templatesDir, "commands/uzys/c.md"), "new");
      writeFileSync(join(projectDir, ".claude/commands/uzys/c.md"), "old");
      writeFileSync(join(templatesDir, "hooks/h.sh"), "new");
      writeFileSync(join(projectDir, ".claude/hooks/h.sh"), "old");
      writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "new");
      writeFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "old");

      const report = runUpdateMode(projectDir, templatesDir);
      const touched = Object.entries(report.updated)
        .filter(([, count]) => count > 0)
        .map(([dir]) => dir);

      // 전제 확인: 실제로 뭔가 갱신됐어야 이 게이트가 의미를 갖는다 (헛통과 차단).
      expect(touched.length, "update 가 아무것도 안 건드렸다 — 픽스처가 잘못됐다").toBeGreaterThan(
        0,
      );

      const hint =
        buildRouterChoices({ tracks: ["tooling"], cli: [], hasClaudeDir: true } as never).find(
          (c) => c.value === "update",
        )?.hint ?? "";

      for (const dir of touched) {
        // `.claude/commands/uzys` 는 hint 에서 "commands" 로 불린다 — 세그먼트 중 하나라도
        // 언급되면 사용자가 그 대상을 알아볼 수 있다고 본다.
        const segments = dir.split("/").filter((s) => s !== ".claude");
        const mentioned = segments.some((s) => hint.toLowerCase().includes(s.toLowerCase()));
        expect(mentioned, `update 가 '${dir}' 를 갱신하는데 hint 에 없다 — hint: "${hint}"`).toBe(
          true,
        );
      }
    } finally {
      rmSync(projectDir, { recursive: true, force: true });
      rmSync(templatesDir, { recursive: true, force: true });
    }
  });
});

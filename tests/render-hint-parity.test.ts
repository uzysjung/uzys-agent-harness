import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXTERNAL_ASSETS } from "../src/external-assets";

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

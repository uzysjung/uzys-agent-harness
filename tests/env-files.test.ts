import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ADAPTERS } from "../src/adapters/index.js";
import { gitignoreRender, writeEnvExample } from "../src/env-files.js";
import type { Track } from "../src/types.js";

describe("writeEnvExample", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-env-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates .env.example for csr-supabase track", () => {
    const created = writeEnvExample(dir, ["csr-supabase"] as Track[]);
    expect(created).toBe(true);
    const body = readFileSync(join(dir, ".env.example"), "utf8");
    expect(body).toContain("SUPABASE_ACCESS_TOKEN");
    expect(body).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("creates .env.example for full track", () => {
    const created = writeEnvExample(dir, ["full"] as Track[]);
    expect(created).toBe(true);
    expect(existsSync(join(dir, ".env.example"))).toBe(true);
  });

  it("skips for non-supabase tracks (tooling/data/executive)", () => {
    expect(writeEnvExample(dir, ["tooling"] as Track[])).toBe(false);
    expect(writeEnvExample(dir, ["data"] as Track[])).toBe(false);
    expect(writeEnvExample(dir, ["executive"] as Track[])).toBe(false);
    expect(existsSync(join(dir, ".env.example"))).toBe(false);
  });

  it("skips when .env.example already exists (idempotent)", () => {
    writeFileSync(join(dir, ".env.example"), "EXISTING=preserved");
    const created = writeEnvExample(dir, ["csr-supabase"] as Track[]);
    expect(created).toBe(false);
    expect(readFileSync(join(dir, ".env.example"), "utf8")).toBe("EXISTING=preserved");
  });
});

// 2026-08-16 (ADR-072) — `writeMcpAllowlist` describe 삭제. 함수가 없어졌다: 그 파일을 읽던
// `mcp-pre-exec.sh` 훅이 목적 부적합으로 빠지면서 생성기만 남으면 아무도 안 보는 파일을 남의
// 저장소에 계속 만들게 된다. 은퇴 경로(기존 설치본 정리)는 `tests/update-mode.test.ts` 가 문다.

/**
 * `.gitignore` 의 하네스 몫 — 렌더(`gitignoreRender`)를 `lines` 어댑터로 붙인다(#551 PR-3). 전에는 줄을 직접
 * 덧붙이는 함수 둘이 있었다(`addGitignoreEnv` · `addGitignoreAgentArtifacts`) — 빼는 짝이 없어 uninstall 이
 * 하네스 줄을 못 걷었다(#569). 없는 `.gitignore` 를 만들지 않는 것은 installer 의 몫이다
 * (`tests/install-writes.test.ts`).
 */
describe(".gitignore 하네스 몫 — gitignoreRender + lines 어댑터", () => {
  function apply(existing: string, recorded: ReadonlyMap<string, string> = new Map()) {
    const res = ADAPTERS.lines.upsert(existing, {
      render: gitignoreRender(),
      recorded,
      excluded: new Set(),
    });
    if (!res.ok) throw new Error("lines 어댑터가 .gitignore 를 못 읽었다");
    return { text: res.text, added: [...res.portions.keys()].filter((k) => !recorded.has(k)), res };
  }

  it("없는 줄만 붙이고 기존 줄은 그대로 둔다", () => {
    const { text, added } = apply("node_modules\ndist\n");
    expect(text.startsWith("node_modules\ndist\n")).toBe(true);
    expect(added).toEqual([".env", ".factory/", ".goose/", ".uzys-agent-harness/"]);
    expect(text).toContain("# Secret env (auto-added by agent-harness install)\n.env\n");
    expect(text).toContain("auto-added by agent-harness");
  });

  it("설치자가 이미 둔 `.env` 는 설치자 것이다 — 더하지도 몫으로 적지도 않는다", () => {
    const { added, res } = apply("node_modules\n.env\n");
    expect(added).not.toContain(".env");
    expect(res.kept).toContain(".env");
  });

  it("뒤 공백만 다른 `.env` 도 같은 줄이다", () => {
    expect(apply(".env  \n").added).not.toContain(".env");
  });

  it("`.env.example` · `.env.local` 은 `.env` 가 아니다", () => {
    expect(apply(".env.example\n.env.local\n").added).toContain(".env");
  });

  it("두 번째 실행은 아무것도 더하지 않는다 (기록 = 첫 실행의 몫)", () => {
    const first = apply("");
    const again = apply(first.text, first.res.portions);
    expect(again.res.changed).toBe(false);
    expect(again.added).toEqual([]);
  });

  it("partial — .factory/ 가 이미 있으면 나머지만 붙는다", () => {
    expect(apply(".factory/\n").added).toEqual([".env", ".goose/", ".uzys-agent-harness/"]);
  });

  /**
   * 2026-08-02 — 훅 차단 로그(`.uzys-agent-harness/hook-blocks.log`)가 설치 사용자 리포에서
   * 추적되면, 차단이 일어날 때마다 남의 저장소에 커밋 대상이 늘어난다. 계측이 사용자에게
   * 비용을 떠넘기는 형태라 패턴 누락을 여기서 단독으로 문다.
   */
  it("차단 로그 디렉터리가 반드시 포함된다 (계측이 사용자 리포를 더럽히지 않는다)", () => {
    expect(apply(".env\n.factory/\n.goose/\n").added).toEqual([".uzys-agent-harness/"]);
  });
});

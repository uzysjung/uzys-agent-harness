import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addGitignoreAgentArtifacts, addGitignoreEnv, writeEnvExample } from "../src/env-files.js";
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

describe("addGitignoreEnv", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-gi-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends .env when .gitignore exists without it", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\ndist\n");
    const added = addGitignoreEnv(dir);
    expect(added).toBe(true);
    const after = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(after).toContain(".env");
    expect(after).toContain("node_modules"); // existing preserved
  });

  it("skips when .gitignore is missing", () => {
    expect(addGitignoreEnv(dir)).toBe(false);
  });

  it("skips when .env line already in .gitignore (exact match)", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n.env\n");
    expect(addGitignoreEnv(dir)).toBe(false);
  });

  it("skips when .env line already in .gitignore (with whitespace)", () => {
    writeFileSync(join(dir, ".gitignore"), ".env  # comment\n");
    expect(addGitignoreEnv(dir)).toBe(false);
  });

  it("does NOT match .env.example or .env.local as 'already present'", () => {
    writeFileSync(join(dir, ".gitignore"), ".env.example\n.env.local\n");
    const added = addGitignoreEnv(dir);
    expect(added).toBe(true);
  });
});

// 2026-08-16 (ADR-072) — `writeMcpAllowlist` describe 삭제. 함수가 없어졌다: 그 파일을 읽던
// `mcp-pre-exec.sh` 훅이 목적 부적합으로 빠지면서 생성기만 남으면 아무도 안 보는 파일을 남의
// 저장소에 계속 만들게 된다. 은퇴 경로(기존 설치본 정리)는 `tests/update-mode.test.ts` 가 문다.

describe("addGitignoreAgentArtifacts (v0.8.0)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-gi-skl-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("no .gitignore → returns []", () => {
    expect(addGitignoreAgentArtifacts(dir)).toEqual([]);
  });

  it("empty .gitignore → adds .factory/, .goose/, .uzys-agent-harness/", () => {
    writeFileSync(join(dir, ".gitignore"), "");
    const added = addGitignoreAgentArtifacts(dir);
    expect(added).toEqual([".factory/", ".goose/", ".uzys-agent-harness/"]);
    const content = readFileSync(join(dir, ".gitignore"), "utf8");
    expect(content).toContain(".factory/");
    expect(content).toContain(".goose/");
    expect(content).toContain(".uzys-agent-harness/");
    expect(content).toContain("auto-added by agent-harness");
  });

  it("idempotent — second call returns []", () => {
    writeFileSync(join(dir, ".gitignore"), "");
    addGitignoreAgentArtifacts(dir);
    expect(addGitignoreAgentArtifacts(dir)).toEqual([]);
  });

  it("partial — .factory/ already present, 나머지만 추가", () => {
    writeFileSync(join(dir, ".gitignore"), ".factory/\n");
    const added = addGitignoreAgentArtifacts(dir);
    expect(added).toEqual([".goose/", ".uzys-agent-harness/"]);
  });

  /**
   * 2026-08-02 — 훅 차단 로그(`.uzys-agent-harness/hook-blocks.log`)가 설치 사용자 리포에서
   * 추적되면, 차단이 일어날 때마다 남의 저장소에 커밋 대상이 늘어난다. 계측이 사용자에게
   * 비용을 떠넘기는 형태라 패턴 누락을 여기서 단독으로 문다.
   */
  it("차단 로그 디렉터리가 반드시 포함된다 (계측이 사용자 리포를 더럽히지 않는다)", () => {
    writeFileSync(join(dir, ".gitignore"), ".factory/\n.goose/\n");
    expect(addGitignoreAgentArtifacts(dir)).toEqual([".uzys-agent-harness/"]);
  });
});

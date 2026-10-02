/**
 * #640/#612 — 사용자 면 명령이 "기록 없음"과 "기록 깨짐"을 구분하는지, 그리고
 * `--only` 반복 플래그(cac 이 배열로 전달)가 정규화되는지.
 *
 * 배경: 파싱은 되지만 필수 필드가 빠진 기록(병합 충돌·부분 기록·수동 편집)에서
 * `list`·`uninstall --dry-run` 이 TypeError 스택트레이스로 죽거나, 완전히 깨진 JSON 을
 * "install log not found" 로 진단했다 — 파일이 있는데 없다고 말하는 사실 오류.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readInstallLogStatus } from "../src/install-log.js";
import { listAction } from "../src/commands/list.js";
import { parseOnly } from "../src/commands/uninstall.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ah-log-status-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeLog(content: string): string {
  const recordDir = join(dir, ".uzys-agent-harness");
  mkdirSync(recordDir, { recursive: true });
  const path = join(recordDir, ".harness-install.json");
  writeFileSync(path, content, "utf8");
  return path;
}

const VALID = JSON.stringify({
  installedAt: "2026-10-02T00:00:00Z",
  scope: "project",
  spec: { tracks: ["base"], cli: ["claude"], clis: ["claude"] },
  assets: [],
  templates: {},
  externalFiles: [],
  portions: [],
});

describe("readInstallLogStatus — 없음/깨짐/정상 (#640)", () => {
  it("기록이 없으면 missing", () => {
    expect(readInstallLogStatus(dir).status).toBe("missing");
  });

  it("파싱이 안 되는 JSON 은 corrupted (not found 가 아니다)", () => {
    writeLog("{ not json");
    const result = readInstallLogStatus(dir);
    expect(result.status).toBe("corrupted");
    expect(result.log).toBeNull();
  });

  it.each([
    ["spec 결번", (v: Record<string, unknown>) => delete v.spec],
    ["spec.tracks 결번", (v: Record<string, unknown>) => delete (v.spec as Record<string, unknown>).tracks],
    ["assets 결번", (v: Record<string, unknown>) => delete v.assets],
    ["templates 결번", (v: Record<string, unknown>) => delete v.templates],
  ])("파싱은 되지만 %s 이면 corrupted", (_label, mutate) => {
    const value = JSON.parse(VALID) as Record<string, unknown>;
    mutate(value);
    writeLog(JSON.stringify(value));
    expect(readInstallLogStatus(dir).status).toBe("corrupted");
  });

  it("정상 기록은 ok + log 반환", () => {
    writeLog(VALID);
    const result = readInstallLogStatus(dir);
    expect(result.status).toBe("ok");
    expect(result.log?.spec.tracks).toEqual(["base"]);
  });

  it("listAction 이 깨진 기록을 안내형으로 거부한다 (스택트레이스 아님)", () => {
    writeLog(JSON.stringify({ spec: {} }));
    const err = vi.fn();
    const exit = vi.fn(() => undefined as never);
    listAction({ projectDir: dir }, { err, exit });
    expect(exit).toHaveBeenCalledWith(1);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("corrupted"));
  });
});

describe("parseOnly — 플래그 반복 정규화 (#612)", () => {
  it("문자열 하나", () => {
    expect(parseOnly("a,b")).toEqual(["a", "b"]);
  });

  it("반복 플래그 배열 (cac 가 만드는 형태)", () => {
    expect(parseOnly(["openspec", "agent-browser"])).toEqual([
      "openspec",
      "agent-browser",
    ]);
  });

  it("혼합: 쉼표 문자열 + 단일", () => {
    expect(parseOnly(["a,b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("미지정·빈값은 null (전량 제거 기존 동작)", () => {
    expect(parseOnly(undefined)).toBeNull();
    expect(parseOnly("")).toBeNull();
    expect(parseOnly([])).toBeNull();
  });
});

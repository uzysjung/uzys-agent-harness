/**
 * #971 — `benchmark-checklist`(pstack 각색 · MIT)는 opt-in 번들 스킬이다. 트랙 기본으로는 어느 CLI 자리에도 안 깔리고,
 * `--with benchmark-checklist`(위저드 체크와 같은 forceInclude)로 고르면 4 CLI 설치에서 두 스킬 자리
 * (`.claude/skills/` — Claude Code · `.agents/skills/` — Codex · OpenCode · Antigravity 공용)에 출처 고지와 함께 깔린다.
 * 전 트랙의 선택 · 복사 판정은 `installer-track-matrix.test.ts` 가 문다 — 여기는 실제 디스크 안착만 본다.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import type { CliTargets, Track } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const ID = "benchmark-checklist";
const ALL_CLI: CliTargets = ["claude", "codex", "opencode", "antigravity"];
const SLOTS = [".claude/skills", ".agents/skills"] as const;

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "benchmark-checklist-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

function install(tracks: Track[], forceInclude: string[] = []): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    runExternal: null,
    spec: {
      tracks,
      options: { withCodexTrust: false },
      cli: ALL_CLI,
      projectDir,
      ...(forceInclude.length > 0 ? { userOverride: { forceInclude, forceExclude: [] } } : {}),
    },
  });
}

describe("#971 — benchmark-checklist 는 고른 설치자에게만 깔린다", () => {
  it.each([[["tooling"]], [["executive"]]] as Array<
    [Track[]]
  >)("기본 설치(%j · 4 CLI)에는 어느 자리에도 없다", (tracks) => {
    install(tracks);
    // 대조군 — 같은 설치에서 두 자리가 실제로 채워졌다(빈 자리라서 없는 것이 아니다).
    expect(existsSync(join(projectDir, ".claude/skills/north-star/SKILL.md"))).toBe(true);
    expect(existsSync(join(projectDir, ".agents/skills/north-star/SKILL.md"))).toBe(true);
    for (const slot of SLOTS) {
      expect(existsSync(join(projectDir, slot, ID)), `${slot}/${ID}`).toBe(false);
    }
  });

  it("`--with benchmark-checklist` 면 4 CLI 설치의 두 자리에 SKILL.md · LICENSE 가 깔린다", () => {
    install(["tooling"], [ID]);
    for (const slot of SLOTS) {
      for (const f of ["SKILL.md", "LICENSE"]) {
        expect(existsSync(join(projectDir, slot, ID, f)), `${slot}/${ID}/${f}`).toBe(true);
      }
    }
  });
});

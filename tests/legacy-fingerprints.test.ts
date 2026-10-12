import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isLegacyHarnessAgentsMd } from "../src/agents-md-merge.js";
import {
  isLegacyHarnessFile,
  LEGACY_AGENTS_MD_PREAMBLE_KEYS,
  LEGACY_AGENTS_MD_SECTION_KEYS,
  LEGACY_HARNESS_FILES,
  LEGACY_HOOK_REFS,
  LEGACY_STATUSLINE_VALUES,
  legacyPreambleKey,
  RETIRED_ANCHOR_SECTION_KEYS,
} from "../src/legacy-fingerprints.js";
import * as reExport from "../src/retired-anchor-sections.js";

const ROOT = resolve(__dirname, "..");
const FIXTURES = join(__dirname, "fixtures/legacy-agents-md");
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

/**
 * #774 (ADR-111) — 옛 판의 하네스 바이트 지문은 생성기 하나가 **양끝 고정** 범위(git 태그 v26.70.0~v26.169.0)에서 만든 닫힌 목록이다.
 * 테스트는 생성기를 돌리지 않는다(git 태그 의존 · 재생산은 `cmp` 명령이 본다) — 대신 그 생성물이 설계가 잰 집합과 같은지,
 * 알려진 옛 바이트를 알아보고 설치자 편집은 못 알아보는지, 상한이 그대로인지를 못 박는다. 상한이 고정이라 크기는 "이상" 이 아니라
 * "같음" 이다 — 생성물에서 한 줄이라도 빠지거나 더해지면 여기서 빨개진다.
 */
describe("#774 옛 판 하네스 지문 — 생성물", () => {
  it("ⓐ 집합 크기가 설계 실측과 같다 (152 경로 · 372 쌍 · 37 · 6 · 53 · 8 · 2)", () => {
    const pairs = [...LEGACY_HARNESS_FILES.values()].reduce((n, s) => n + s.size, 0);
    expect(LEGACY_HARNESS_FILES.size).toBe(152);
    expect(pairs).toBe(372);
    expect(LEGACY_AGENTS_MD_SECTION_KEYS.size).toBe(37);
    expect(LEGACY_AGENTS_MD_PREAMBLE_KEYS.size).toBe(6);
    expect(RETIRED_ANCHOR_SECTION_KEYS.size).toBe(53);
    expect([...LEGACY_HOOK_REFS].sort()).toEqual([
      "hooks/agentshield-gate.sh",
      "hooks/gate-check.sh",
      "hooks/hito-counter.sh",
      "hooks/mcp-pre-exec.sh",
      "hooks/protect-files.sh",
      "hooks/session-start.sh",
      "hooks/task-brief-nudge.sh",
      "skills/strategic-compact/suggest-compact.sh",
    ]);
    expect(LEGACY_STATUSLINE_VALUES.size).toBe(2);
    // 렌더본(`templates/codex/hooks/**` → `.codex/hooks/`)은 입력에서 뺐다 — 템플릿과 바이트가 달라 지문이 될 수 없다
    expect([...LEGACY_HARNESS_FILES.keys()].every((p) => p.startsWith(".claude/"))).toBe(true);
  });

  it("ⓑ 알려진 옛 바이트를 알아본다 — v26.125.0 의 은퇴 스킬 · ecc 커맨드 · 옛 앵커", () => {
    // 각 sha = `git show v26.125.0:<templates 경로> | shasum -a 256` (설계 §3.2 ⓑ)
    expect(
      isLegacyHarnessFile(
        ".claude/skills/strategic-compact/SKILL.md",
        "6bfc63c380eb89886335ad033f759a4ff3f1b1ae2c5a143598bb628e38c6e769",
      ),
    ).toBe(true);
    expect(
      isLegacyHarnessFile(
        ".claude/commands/ecc/e2e.md",
        "fdc040d9d32ca1c4bcc53ccca32042983f9132240fcaca5144de51e4385b9479",
      ),
    ).toBe(true);
    expect(
      isLegacyHarnessFile(
        ".claude/CLAUDE.md",
        "5a167acf64d246b278f878228f07cf76fe2a808e201d3d82c1c0274f50d736de",
      ),
    ).toBe(true);
  });

  it("`.agents/skills/<rel>` 은 `.claude/skills/<rel>` 과 같은 지문으로 조회한다(옛 codex 변환의 바이트 사본) · 다른 자리는 아니다", () => {
    const skill = "6bfc63c380eb89886335ad033f759a4ff3f1b1ae2c5a143598bb628e38c6e769";
    expect(isLegacyHarnessFile(".agents/skills/strategic-compact/SKILL.md", skill)).toBe(true);
    expect(isLegacyHarnessFile(".agents/rules/strategic-compact/SKILL.md", skill)).toBe(false);
    expect(isLegacyHarnessFile(".claude/skills/other/SKILL.md", skill)).toBe(false);
  });

  it("ⓒ 설치자가 한 줄 고친 바이트는 못 알아본다 — 현행 룰 + `MINE-EDIT`", () => {
    const rule = readFileSync(join(ROOT, "templates/rules/git-policy.md"), "utf8");
    expect(isLegacyHarnessFile(".claude/rules/git-policy.md", sha(rule)), "픽스처 자기검증").toBe(
      true,
    );
    expect(isLegacyHarnessFile(".claude/rules/git-policy.md", sha(`${rule}\nMINE-EDIT\n`))).toBe(
      false,
    );
  });

  it("ⓓ 머리 주석이 입력 범위를 v26.70.0~v26.169.0 양끝 고정으로 말한다(생성기 재생산은 CI 밖 — 범위 드리프트를 여기서 본다)", () => {
    const head = readFileSync(join(ROOT, "src/legacy-fingerprints.ts"), "utf8")
      .split("\n")
      .slice(0, 3)
      .join("\n");
    expect(head).toContain("생성물 — scripts/gen-legacy-fingerprints.mjs");
    expect(head).toContain("git 태그 v26.70.0~v26.169.0 양끝 고정(실제 26.70.0~26.169.0, 114판)");
  });

  it("ⓔ 머리 지문 6 키가 실제 옛 템플릿(codex · opencode · antigravity × v26.140.0 · v26.150.0)에서 전부 참이다", () => {
    const dir = join(FIXTURES, "templates");
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(6);
    const keys = new Set<string>();
    for (const f of files) {
      const text = readFileSync(join(dir, f), "utf8");
      expect(isLegacyHarnessAgentsMd(text), f).toBe(true);
      keys.add(legacyPreambleKey(text) ?? "");
    }
    expect(keys).toEqual(new Set(LEGACY_AGENTS_MD_PREAMBLE_KEYS));
    // 컨테이너 실설치본(v26.100.0 · v26.140.0)도 — 제목의 프로젝트 이름은 머리에 들지 않는다
    for (const f of ["v26.100.0-codex.AGENTS.md", "v26.140.0-codex.AGENTS.md"]) {
      expect(isLegacyHarnessAgentsMd(readFileSync(join(FIXTURES, f), "utf8")), f).toBe(true);
    }
  });

  it("#739 의 손목록 53 지문(v26.169.0 의 `retired-anchor-sections.ts`)을 생성물이 0 차이로 다시 낸다 · 옛 이름 그대로 내보낸다", () => {
    const hand = readFileSync(join(FIXTURES, "retired-anchor-keys-v26.169.0.txt"), "utf8")
      .split("\n")
      .filter((l) => l !== "")
      .map((l) => l.slice(0, 64));
    expect(hand).toHaveLength(53);
    expect(new Set(hand)).toEqual(new Set(RETIRED_ANCHOR_SECTION_KEYS));
    expect(reExport.RETIRED_ANCHOR_SECTION_KEYS).toBe(RETIRED_ANCHOR_SECTION_KEYS);
    expect(reExport.retiredAnchorSectionKey(["## A", "body  ", "", ""])).toBe(sha("## A\nbody"));
  });
});

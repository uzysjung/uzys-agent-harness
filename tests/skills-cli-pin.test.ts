import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SKILLS_CLI_VERSION, skillsCliSpec } from "../src/external-installer.js";

// WHY: `npx skills` CLI 가 unpinned 면 upstream breaking(1.5.5→1.5.7 multi-agent `--agent`
//   플래그 파손 전례)이 설치(buildSkillArgs)·uninstall·검증(verify-catalog) 3경로를 동시에 깬다.
//   audit CODE-4/D-1. 특히 dist 밖 독립 스크립트 verify-catalog.mjs 는 컴파일러가 버전 불일치를
//   못 잡으므로 텍스트 drift 가드가 필수다 (no-false-ship: 주석 경고는 차단 수단 불인정).

describe("skills CLI 버전 고정 (audit CODE-4)", () => {
  it("skillsCliSpec() 은 버전 고정된 skills@<semver> 를 반환", () => {
    expect(skillsCliSpec()).toBe(`skills@${SKILLS_CLI_VERSION}`);
    expect(skillsCliSpec()).toMatch(/^skills@\d+\.\d+\.\d+$/);
  });

  it("verify-catalog.mjs 가 src 와 동일 버전 pin (독립 스크립트 drift 차단)", () => {
    const mjs = readFileSync("scripts/verify-catalog.mjs", "utf-8");
    const match = mjs.match(/SKILLS_CLI_VERSION\s*=\s*"([\d.]+)"/);
    expect(match?.[1], "verify-catalog.mjs 의 SKILLS_CLI_VERSION 이 src 와 불일치").toBe(
      SKILLS_CLI_VERSION,
    );
  });

  it("설치·uninstall·검증 경로에 unpinned 'skills' 호출 0건", () => {
    const files = [
      "src/external-installer.ts",
      "src/commands/uninstall.ts",
      "scripts/verify-catalog.mjs",
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf-8");
      expect(src, `${f} 에 버전 없는 skills 호출 잔존`).not.toMatch(/"skills",\s*"(add|remove)"/);
    }
  });
});

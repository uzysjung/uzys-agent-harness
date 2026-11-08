import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 이 저장소의 루트 `AGENTS.md` 는 Codex · OpenCode · Antigravity 가 이 저장소의 지시 파일을 읽게 하는 유일한 길이다.
 * 이 저장소는 자기 자신에 하네스를 설치하지 않아, 설치자 쪽 렌더(`src/codex/agents-md.ts`)가 여기엔 없다(#964).
 * 안내가 가리키는 파일이 사라지거나 Claude Code 가 늘 읽는 지시 파일이 안내에서 빠지면, 다른 CLI 는 조용히 그 지시를 잃는다.
 *
 * 여기서는 안내가 닿는지(안착)만 본다. 그 CLI 가 실제로 읽고 따르는지(모델 행동)는 실 CLI 측정
 * `scripts/measure-rule-reach.sh` 의 몫이다 — 언제 돌리나 = `.claude/rules/test-policy.md` §다른 CLI 도달.
 */
const ROOT = resolve(__dirname, "..");
const pointed = [...readFileSync(join(ROOT, "AGENTS.md"), "utf8").matchAll(/^- `([^`]+)`/gm)].map(
  (m) => m[1] as string,
);

function covers(path: string): boolean {
  return pointed.some((p) => {
    if (!p.endsWith("/*.md")) return p === path;
    const dir = p.slice(0, -"*.md".length);
    return path.startsWith(dir) && path.endsWith(".md") && !path.slice(dir.length).includes("/");
  });
}

describe("이 저장소 AGENTS.md — 다른 CLI 가 받는 지시 파일 안내", () => {
  it("안내가 가리키는 파일이 모두 있다", () => {
    expect(pointed.length).toBeGreaterThan(0);
    for (const p of pointed) {
      if (p.endsWith("/*.md")) {
        const dir = join(ROOT, p.slice(0, -"/*.md".length));
        const hits = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
        expect(hits.length, `${p} 가 아무 파일도 가리키지 않는다`).toBeGreaterThan(0);
      } else {
        expect(existsSync(join(ROOT, p)), `${p} 가 없다`).toBe(true);
      }
    }
  });

  it("Claude Code 가 늘 읽는 지시 파일(CLAUDE.md 둘 · .claude/rules 전부)이 모두 안내에 있다", () => {
    const rules = readdirSync(join(ROOT, ".claude/rules"))
      .filter((f) => f.endsWith(".md"))
      .map((f) => `.claude/rules/${f}`);
    expect(rules.length).toBeGreaterThan(0);
    for (const f of ["CLAUDE.md", ".claude/CLAUDE.md", ...rules]) {
      expect(covers(f), `${f} 가 AGENTS.md 안내에 없다 — 다른 CLI 는 이 파일을 못 받는다`).toBe(
        true,
      );
    }
  });
});

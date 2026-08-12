/**
 * 배포 룰(`templates/rules/*.md`)을 **Claude Code 가 아닌 CLI 로** 옮기는 공용 층.
 *
 * WHY (실측 2026-08-12): 룰은 `.claude/rules/` 하나로만 나갔고, 그 디렉터리는 `spec.cli` 에
 * claude 가 있을 때만 만들어진다. 그래서 Codex · OpenCode · Antigravity 단독 설치자는 룰을
 * **한 종도 못 받았다** — 네 CLI 에 룰·훅·스킬을 설치한다는 것이 이 저장소가 파는 것인데.
 * 세 CLI 모두 룰을 받을 자리가 있으므로(각 CLI 문서 확인) 공백은 능력 한계가 아니라 배선이었다.
 *
 * 여기 있는 것은 **한 벌의 변환 규칙**이다. CLI 별 목적지는 각 transform 이 정한다:
 *   - Antigravity → `.agents/rules/<name>.md` (워크스페이스 룰, 네이티브)
 *   - OpenCode    → `.opencode/rules/<name>.md` + `opencode.json` `instructions` 글롭
 *   - Codex       → `AGENTS.md` 본문 embed (Codex 는 룰 디렉터리가 없다 — AGENTS.md 계층뿐)
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 룰 하나의 이식 결과. `name` 은 확장자 없는 파일명 그대로다. */
export interface PortedRule {
  name: string;
  body: string;
}

/**
 * Claude Code 전용 frontmatter 를 벗긴다.
 *
 * `paths:` 는 Claude Code 의 조건부 로드 키다(`cli-development` 이 유일한 사용처). 다른 CLI 는
 * 그 키를 모르므로 본문 맨 앞에 남으면 **그냥 이상한 텍스트**가 되고, Codex 처럼 AGENTS.md
 * 한복판에 끼워 넣는 경우엔 문서를 깨뜨린다. 벗겨서 상시 룰로 보낸다 — 그 대가로 세 CLI 에서
 * 그 룰이 항상 상주하지만, 문서에 확인되지 않은 활성 문법을 추측해 쓰는 것보다는 낫다.
 * (Antigravity 는 glob 활성 모드가 있다고 문서가 말하지만 frontmatter 문법을 공개하지 않는다.)
 */
export function stripClaudeFrontmatter(source: string): string {
  if (!source.startsWith("---\n")) return source.trim();
  const end = source.indexOf("\n---", 4);
  if (end === -1) return source.trim();
  return source.slice(end + 4).trim();
}

/**
 * 선택된 룰들을 읽어 이식형으로 돌려준다. 원본이 없는 이름은 **조용히 건너뛴다** —
 * 설치를 세우는 것보다 낫고, 없는 파일을 깔았다고 보고하지 않는 쪽이 정직하다.
 */
export function portRules(harnessRoot: string, ruleNames: ReadonlyArray<string>): PortedRule[] {
  const ported: PortedRule[] = [];
  for (const name of ruleNames) {
    const src = join(harnessRoot, "templates/rules", `${name}.md`);
    if (!existsSync(src)) continue;
    ported.push({ name, body: stripClaudeFrontmatter(readFileSync(src, "utf8")) });
  }
  return ported;
}

/**
 * Codex 용 — 룰 전체를 AGENTS.md 에 끼울 한 덩어리로 잇는다.
 *
 * Codex 는 룰 디렉터리가 없고 `AGENTS.md` 계층만 읽는다. 파일 경계가 사라지므로 각 룰의 h1 을
 * h2 로 한 단 낮춰 문서 구조를 유지한다 — 그러지 않으면 h1 이 여러 개인 문서가 되고, 어디까지가
 * 한 룰인지 읽는 쪽이 알 수 없다.
 */
export function renderRulesBlock(rules: ReadonlyArray<PortedRule>): string {
  if (rules.length === 0) return "";
  return rules.map((r) => r.body.replace(/^#\s+/, "## ")).join("\n\n---\n\n");
}

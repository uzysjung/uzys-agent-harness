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
 *   - OpenCode    → `AGENTS.md` 본문 embed (Codex 와 같은 파일 · 같은 블록 — `opencode.json` `instructions`
 *                   글롭은 룰을 병합하지 않는다)
 *   - Codex       → `AGENTS.md` 본문 embed (Codex 는 룰 디렉터리가 없다 — AGENTS.md 계층뿐)
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 룰 하나의 이식 결과. `name` 은 확장자 없는 파일명 그대로다. */
export interface PortedRule {
  name: string;
  body: string;
  /**
   * Claude `paths:` 의 패턴(없으면 빈 배열) — Antigravity 가 같은 뜻의 `trigger: glob` + `globs:` 로 받는다(#631).
   * Codex · OpenCode 는 인라인이라 쓰지 않는다.
   */
  paths: string[];
}

/**
 * Claude frontmatter 의 `paths:` 값 — 리스트(`- "<glob>"`)와 단일 문자열 두 형태만 받는다(배포 룰이 쓰는 형태).
 * YAML 파서를 들이지 않는다: 그 두 형태 밖이면 빈 배열(= 상시 룰) — 틀리는 방향이 "더 자주 읽힌다" 라 안전하다.
 */
export function claudePaths(source: string): string[] {
  if (!source.startsWith("---\n")) return [];
  const end = source.indexOf("\n---", 4);
  if (end === -1) return [];
  const lines = source.slice(4, end).split("\n");
  const unquote = (v: string): string => v.trim().replace(/^(["'])(.*)\1$/, "$2");
  const at = lines.findIndex((l) => /^paths:/.test(l));
  if (at === -1) return [];
  const inline = (lines[at] ?? "").slice("paths:".length).trim();
  if (inline !== "") return [unquote(inline)].filter((p) => p !== "");
  const out: string[] = [];
  for (const l of lines.slice(at + 1)) {
    const m = /^\s+-\s+(.+)$/.exec(l);
    if (m === null) break;
    out.push(unquote(m[1] ?? ""));
  }
  return out.filter((p) => p !== "");
}

/**
 * Claude Code 전용 frontmatter 를 벗긴다.
 *
 * `paths:` 는 Claude Code 의 조건부 로드 키다(`cli-development` 이 유일한 사용처). 다른 CLI 는
 * 그 키를 모르므로 본문 맨 앞에 남으면 **그냥 이상한 텍스트**가 되고, Codex 처럼 AGENTS.md
 * 한복판에 끼워 넣는 경우엔 문서를 깨뜨린다. 벗겨서 Codex · OpenCode 에는 상시 룰로 보낸다.
 * Antigravity 는 같은 뜻을 자기 frontmatter(`trigger: glob`)로 받는다 — 값은 `claudePaths` 가 읽어 둔다(#631).
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
    const source = readFileSync(src, "utf8");
    ported.push({ name, body: stripClaudeFrontmatter(source), paths: claudePaths(source) });
  }
  return ported;
}

/**
 * 리뷰 #735 — 하네스가 `## Harness Rules` 에 쓸 수 있는 룰 제목 전체: 배포 룰 **전부**(트랙 무관)를 `renderRulesBlock` 으로
 * 렌더했을 때의 `## ` 줄. 병합이 "렌더에서 빠진 룰 제목" 과 "설치자가 같은 자리에 적은 절" 을 내용으로 가르는 근거다.
 * 열거하지 않고 디렉터리에서 유도한다 — 룰이 늘어도 고칠 곳이 없다.
 */
export function ruleHeadings(harnessRoot: string): ReadonlySet<string> {
  const dir = join(harnessRoot, "templates/rules");
  if (!existsSync(dir)) return new Set();
  const names = readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
  const block = renderRulesBlock(portRules(harnessRoot, names));
  return new Set(
    block
      .split("\n")
      .filter((l) => /^## /.test(l))
      .map((l) => l.trim()),
  );
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

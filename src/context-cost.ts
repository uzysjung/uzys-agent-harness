import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTERNAL_ASSETS } from "./external-assets.js";

/**
 * v26.103.0 (ADR-032) — Session-Start Context Cost.
 *
 * 설치 자산이 세션 시작 시 상주시키는 descriptor(SKILL.md frontmatter: name + description)의
 * 토큰 추정치. NORTH_STAR §2 NSM "Session-Start Context Cost" 의 계측 구현.
 *
 * 측정 범위 (no-false-ship):
 * - repo-bundled internal 스킬만 실측 — frontmatter 문자수 → chars/4 근사 (표기는 항상 "~").
 * - 외부 자산(plugin/skill/npm/npx-run/shell-script)은 설치 시점에 frontmatter 를 알 수 없어
 *   **unmeasured** 로 표기한다. 추정치를 실측처럼 표기하지 않는다.
 */
export const CHARS_PER_TOKEN = 4;

export function estimateTokens(chars: number): number {
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

/**
 * 패키지 루트(= `templates/` 가 있는 곳) 해석. 이 파일은 src/ 최상위(dev)와 dist/ 번들 출력
 * 양쪽에서 한 단계 위가 패키지 루트라 동일 식이 성립한다 — `defaultHarnessRoot` 와 식은 같지만
 * 그쪽은 src/commands/ 아래라 dev 에선 틀려 테스트 주입이 필수인 것과 달리, 여기는 양쪽 유효.
 * `fileURLToPath` 필수 — `.pathname` 은 공백/비ASCII 경로를 percent-encoded 로 남겨
 * existsSync 가 전부 실패한다 (SOD 리뷰 F1).
 */
export function resolveBundleRoot(): string {
  return resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
}

/** SKILL.md 선두의 frontmatter 블록(`---` ... `---`) 내용. 없으면 null. */
export function extractFrontmatter(content: string): string | null {
  // BOM/CRLF 허용 — Windows 클론(core.autocrlf)에서 전량 unmeasured 강등 방지 (SOD 리뷰 F7).
  const m = content.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---/);
  return m?.[1] ?? null;
}

/**
 * 자산 1개의 descriptor 토큰 추정. internal(repo-bundled) + 템플릿 실재 + frontmatter 존재일
 * 때만 숫자, 그 외 null(unmeasured). 표시용 계측이므로 파일 이상 시 throw 하지 않는다 —
 * 없는 값을 만들어내는 대신 unmeasured 로 강등된다.
 */
export function assetDescriptorTokens(
  assetId: string,
  root: string = resolveBundleRoot(),
): number | null {
  const asset = EXTERNAL_ASSETS.find((a) => a.id === assetId);
  if (!asset || asset.method.kind !== "internal") return null;
  const skillMd = join(root, "templates", "skills", asset.method.key, "SKILL.md");
  if (!existsSync(skillMd)) return null;
  const fm = extractFrontmatter(readFileSync(skillMd, "utf8"));
  return fm === null ? null : estimateTokens(fm.length);
}

/**
 * v26.116.0 (ADR-043) — 발화(fired) 비용. 스킬이 실제로 트리거되면 body 전체가 컨텍스트에 들어온다.
 * descriptor 는 전원이 매 세션 무는 상주 비용이고 body 는 트리거될 때만 무는 비용이라 **단위가
 * 다르다** — 두 값을 더한 "총합"은 만들지 않는다 (근거 없는 가중 합산 금지).
 */
export function assetBodyTokens(
  assetId: string,
  root: string = resolveBundleRoot(),
): number | null {
  const asset = EXTERNAL_ASSETS.find((a) => a.id === assetId);
  if (!asset || asset.method.kind !== "internal") return null;
  const skillMd = join(root, "templates", "skills", asset.method.key, "SKILL.md");
  if (!existsSync(skillMd)) return null;
  const content = readFileSync(skillMd, "utf8");
  const fm = extractFrontmatter(content);
  // frontmatter 가 없으면 파일 전체가 body. 있으면 닫는 `---` 이후만.
  if (fm === null) return estimateTokens(content.length);
  const close = content.indexOf("\n---", content.indexOf(fm) + fm.length);
  const body = close === -1 ? "" : content.slice(close + "\n---".length);
  return estimateTokens(body.trim().length);
}

export interface AssetCostRow {
  id: string;
  /** 상주 — 설치한 전원이 매 세션 무는 비용. */
  descriptorTokens: number | null;
  /** 발화 — 스킬이 트리거될 때만 무는 비용. */
  bodyTokens: number | null;
}

/**
 * 자산별 비용 행. **발화 비용 내림차순** 정렬 — "무엇부터 검토할 것인가"의 순서다 (ADR-043
 * 1단계: 값싼 전수 계측으로 순위를 세우고, 비싼 eval 은 상위에만). unmeasured(외부 자산)는 뒤로.
 */
export function assetCostRows(
  assetIds: ReadonlyArray<string>,
  root: string = resolveBundleRoot(),
): AssetCostRow[] {
  return assetIds
    .map((id) => ({
      id,
      descriptorTokens: assetDescriptorTokens(id, root),
      bodyTokens: assetBodyTokens(id, root),
    }))
    .sort((a, b) => (b.bodyTokens ?? -1) - (a.bodyTokens ?? -1));
}

/**
 * v26.117.0 (ADR-044) — 상주 비용의 **표면 전체**.
 *
 * v26.116.0 까지는 스킬 descriptor 만 셌다. 그 정의에는 굿하트 구멍이 있다: SKILL.md 산문을
 * 룰 파일로 옮기면 **발화 시에만 내던 비용이 매 세션 상주로 바뀌어 실제로는 악화**되는데 지표는
 * 개선으로 표시된다. 사용자를 나쁘게 만드는 리팩터링을 보상하는 지표는 없느니만 못하다.
 *
 * 판정 기준은 **표면 열거가 아니라 "상주인가 발화인가"** — 새 표면이 생겨도 기준이 그대로다.
 * - 상주: rules(전문) · CLAUDE.md(전문) · skills/agents 의 descriptor
 * - 발화: skills/agents 의 body — 트리거될 때만
 * - 비대상: hooks(실행될 뿐 컨텍스트에 안 올라감)
 */
export interface ResidentCost {
  rules: number;
  projectClaudeMd: number;
  skillDescriptors: number;
  agentDescriptors: number;
  total: number;
}

/** 파일 1개의 토큰. 없으면 0 (합계를 오염시키지 않되 throw 하지 않는다). */
function fileTokens(path: string): number {
  return existsSync(path) ? estimateTokens(readFileSync(path, "utf8").trim().length) : 0;
}

/** descriptor(frontmatter)만. frontmatter 가 없으면 0 — 상주 비용이 아니다. */
function descriptorTokens(path: string): number {
  if (!existsSync(path)) return 0;
  const fm = extractFrontmatter(readFileSync(path, "utf8"));
  return fm === null ? 0 : estimateTokens(fm.length);
}

/**
 * 설치 계획(manifest 엔트리)에서 상주 비용을 실측. `applies` 로 이미 걸러진 엔트리를 받으므로
 * **트랙별 실제 설치분**이 반영된다 (templates/ 전체 합계 같은 부풀린 수치가 아니다).
 */
export function residentCost(
  entries: ReadonlyArray<{ source: string; target: string }>,
  root: string = resolveBundleRoot(),
): ResidentCost {
  const tpl = (source: string): string => join(root, "templates", source);
  let rules = 0;
  let skillDescriptors = 0;
  let agentDescriptors = 0;
  for (const e of entries) {
    if (e.target.startsWith(".claude/rules/")) rules += fileTokens(tpl(e.source));
    else if (e.target.startsWith(".claude/agents/"))
      agentDescriptors += descriptorTokens(tpl(e.source));
    else if (e.target.startsWith(".claude/skills/")) {
      // skills 엔트리는 디렉토리 — SKILL.md 가 descriptor 를 담는다.
      skillDescriptors += descriptorTokens(join(tpl(e.source), "SKILL.md"));
    }
  }
  const projectClaudeMd = fileTokens(join(root, "templates", "CLAUDE.md"));
  return {
    rules,
    projectClaudeMd,
    skillDescriptors,
    agentDescriptors,
    total: rules + projectClaudeMd + skillDescriptors + agentDescriptors,
  };
}

export interface ContextCostSummary {
  /** 실측된 스킬들의 토큰 합 (추정치). */
  measuredTokens: number;
  measuredCount: number;
  unmeasuredCount: number;
}

export function summarizeContextCost(
  assetIds: ReadonlyArray<string>,
  root: string = resolveBundleRoot(),
): ContextCostSummary {
  let measuredTokens = 0;
  let measuredCount = 0;
  let unmeasuredCount = 0;
  for (const id of assetIds) {
    const tokens = assetDescriptorTokens(id, root);
    if (tokens === null) unmeasuredCount += 1;
    else {
      measuredTokens += tokens;
      measuredCount += 1;
    }
  }
  return { measuredTokens, measuredCount, unmeasuredCount };
}

/**
 * 표시 라인. wizard confirm 과 비대화형 header 가 동일 문구를 쓴다 (표면별 상이 문구 금지 —
 * v26.88.0 이중 고지 사고의 교훈). 자산 0개면 null.
 */
export function formatContextCostLine(s: ContextCostSummary): string | null {
  if (s.measuredCount === 0 && s.unmeasuredCount === 0) return null;
  if (s.measuredCount === 0) {
    return `session-start context cost: unmeasured (${s.unmeasuredCount} external asset${s.unmeasuredCount === 1 ? "" : "s"})`;
  }
  const skills = `${s.measuredCount} bundled skill${s.measuredCount === 1 ? "" : "s"} measured`;
  const external = s.unmeasuredCount > 0 ? ` · ${s.unmeasuredCount} external unmeasured` : "";
  return `session-start context cost: ~${s.measuredTokens} tokens (${skills}${external})`;
}

/**
 * v26.117.0 (ADR-044) — 설치 요약에 표시하는 상주 비용 라인.
 *
 * 이전 라인(`formatContextCostLine`)은 **스킬 descriptor 만** 세면서 "session-start context
 * cost" 라고 표기해, 실측상 상주 비용의 ~10% 를 전부인 양 보여주고 있었다 (tooling 트랙 실측:
 * 스킬 descriptor ~547 vs 상주 합계 ~5,194). 표시 숫자가 실제의 9분의 1이면 그것은 계측이
 * 아니라 오보다 (no-false-ship). 내역을 함께 보여 어디에 비용이 있는지 드러낸다.
 */
export function formatResidentCostLine(r: ResidentCost, unmeasuredCount: number): string | null {
  if (r.total === 0) return null;
  const parts = [
    `rules ~${r.rules}`,
    `CLAUDE.md ~${r.projectClaudeMd}`,
    `skills ~${r.skillDescriptors}`,
    `agents ~${r.agentDescriptors}`,
  ].join(" · ");
  const external =
    unmeasuredCount > 0
      ? ` · ${unmeasuredCount} external asset${unmeasuredCount === 1 ? "" : "s"} unmeasured`
      : "";
  return `session-start context cost: ~${r.total} tokens/session (${parts}${external})`;
}

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

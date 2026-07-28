import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EXTERNAL_ASSETS } from "./external-assets.js";
import { renderFillScaffold } from "./project-claude-merge.js";

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
 * - 비대상: hooks — **단, 근거는 "실행될 뿐"이 아니다** (v26.137.0 정정). 훅 stdout 은 CLI 의
 *   `content` 필드로만 컨텍스트에 진입하고, 그 필드는 훅이
 *   `hookSpecificOutput.{additionalContext|initialUserMessage}` 를 쓰거나 stdout 이 **비-JSON 일 때만**
 *   채워진다. 우리 SessionStart 훅은 전자를 쓰므로 진입하되 양이 ~19 tok/세션(실측)이라 계측
 *   대상에서 뺀다 — **조건부 제외이지 구조적 제외가 아니다.** 훅이 늘거나 출력이 길어지면
 *   상주에 얹힌다. 외부 플러그인 훅은 여기 안 잡힌다: 올바른 스키마를 쓰는 플러그인 훅 하나가
 *   실측상 +2,222 tok/세션(+37.8%)을 아무 고지 없이 얹을 수 있었다.
 */
export interface ResidentCost {
  rules: number;
  projectClaudeMd: number;
  skillDescriptors: number;
  agentDescriptors: number;
  total: number;
  /** 같은 표면의 **개수**. 토큰과 단위가 다르므로 절대 같은 필드에 섞지 않는다 (아래 주석). */
  items: ResidentItemCount;
}

/**
 * v26.140.0 — 상주 비용의 **양(quantity) 축**.
 *
 * 토큰은 버리지 않되(부수 표시값 + ratchet 유지) 1차 축은 **개수**다. 근거: ADR-051 실측에서
 * 토큰의 금전 비용은 무의미했고($2.94/1k요청 · 컨텍스트 0.59%), 실제로 아픈 비용 — 교차참조,
 * 서로 모순되는 지시, 문서 drift, 유지보수 — 는 **항목 수**에 비례한다. 5,000 토큰이 룰 1개일
 * 때와 룰 20개일 때는 같은 비용이 아니다.
 *
 * 세는 대상은 토큰을 재는 대상과 **정확히 같다** (한쪽만 늘어나는 drift 방지):
 * rules 1파일 = 1 · skills 1디렉터리 = 1 · agents 1파일 = 1 · CLAUDE.md **2**(앵커 + 스캐폴드).
 * hooks 는 여기서도 비대상 — 상주 표면이 아니다.
 */
export interface ResidentItemCount {
  rules: number;
  skills: number;
  agents: number;
  claudeMd: number;
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
  let ruleItems = 0;
  let skillItems = 0;
  let agentItems = 0;
  for (const e of entries) {
    // 토큰과 개수를 **같은 분기에서** 올린다 — 분기를 나누면 둘이 다른 대상을 세게 된다.
    if (e.target.startsWith(".claude/rules/")) {
      rules += fileTokens(tpl(e.source));
      ruleItems += 1;
    } else if (e.target.startsWith(".claude/agents/")) {
      agentDescriptors += descriptorTokens(tpl(e.source));
      agentItems += 1;
    } else if (e.target.startsWith(".claude/skills/")) {
      // skills 엔트리는 디렉토리 — SKILL.md 가 descriptor 를 담는다.
      skillDescriptors += descriptorTokens(join(tpl(e.source), "SKILL.md"));
      skillItems += 1;
    }
  }
  // 설치가 상주시키는 CLAUDE.md 는 **둘**이다. v26.140.0 까지는 앵커만 재면서 라벨은
  // "스캐폴드"였다 — 이름과 실측 대상이 다르면 그 지표로는 before/after 를 판정할 수 없다.
  //  ① 하네스 앵커 `.claude/CLAUDE.md` — manifest `applies: all` 이라 항상 깔린다(파일).
  //  ② 프로젝트 스캐폴드 루트 `CLAUDE.md` — manifest 밖에서 `writeRootClaudeMd()` 가 무조건
  //     쓴다. **파일이 아니라 생성물**이라 `fileTokens` 로는 영원히 0 이었다.
  // ②는 `renderFillScaffold()` 만 잰다 — `mergeProjectClaude()` 의 머리 2줄(프로젝트명·트랙)은
  // 설치처마다 길이가 달라 ratchet 축으로 못 쓴다. 그만큼 이 값은 **하한**이다.
  const harnessAnchor = fileTokens(join(root, "templates", "CLAUDE.md"));
  const projectScaffold = estimateTokens(renderFillScaffold().trim().length);
  const projectClaudeMd = harnessAnchor + projectScaffold;
  // 토큰이 0 인 쪽은 항목도 0 (한쪽만 세면 그게 곧 drift). 앵커는 부재할 수 있고,
  // 스캐폴드는 코드 생성물이라 부재할 수 없다.
  const claudeMdItems = (harnessAnchor > 0 ? 1 : 0) + (projectScaffold > 0 ? 1 : 0);
  return {
    rules,
    projectClaudeMd,
    skillDescriptors,
    agentDescriptors,
    total: rules + projectClaudeMd + skillDescriptors + agentDescriptors,
    items: {
      rules: ruleItems,
      skills: skillItems,
      agents: agentItems,
      claudeMd: claudeMdItems,
      total: ruleItems + skillItems + agentItems + claudeMdItems,
    },
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
 *
 * v26.140.0 — **개수가 먼저, 토큰이 뒤.** 1차 축이 항목 수로 바뀌었으므로 읽는 순서도 그대로
 * 따라간다 (표면마다 순서가 다르면 그 자체가 혼선이다 — cost:report 도 같은 순서).
 *
 * 이 함수가 상주 비용 **표시의 단일 출처**다. 표면(설치 헤더 / wizard confirm / cost:report)이
 * 각자 문자열을 조립하면 한 표면만 갱신되는 drift 가 다시 생긴다 — 지난번에 개수가 리포트에만
 * 붙고 나머지 둘에 없던 것이 정확히 그 형태였다. 계약은
 * `tests/context-cost-display-parity.test.ts` 가 글롭으로 강제한다.
 */
export function formatResidentCostLine(r: ResidentCost, unmeasuredCount: number): string | null {
  if (r.total === 0) return null;
  const parts = [
    `rules ${r.items.rules} ~${r.rules}`,
    `CLAUDE.md ${r.items.claudeMd} ~${r.projectClaudeMd}`,
    `skills ${r.items.skills} ~${r.skillDescriptors}`,
    `agents ${r.items.agents} ~${r.agentDescriptors}`,
  ].join(" · ");
  const external =
    unmeasuredCount > 0
      ? ` · ${unmeasuredCount} external asset${unmeasuredCount === 1 ? "" : "s"} unmeasured`
      : "";
  return `session-start context cost: ${r.items.total} items resident · ~${r.total} tokens/session (${parts}${external})`;
}

/**
 * cost:report 상주 표의 행 정의. `gap` = 라벨 뒤 공백 수 — 한글 라벨이 2배폭이라 `padEnd` 로는
 * 정렬이 안 맞아 행마다 명시한다.
 */
const RESIDENT_ROWS: ReadonlyArray<{
  label: string;
  gap: number;
  count: (r: ResidentCost) => number;
  tokens: (r: ResidentCost) => number;
}> = [
  { label: "rules", gap: 14, count: (r) => r.items.rules, tokens: (r) => r.rules },
  {
    // 한 행에 두 파일(앵커 + 스캐폴드). 개수 열이 2 를 뱉어 그 사실을 드러낸다 — 라벨로
    // 하나만 이름 붙이면 v26.140.0 이전과 같은 거짓 라벨이 된다.
    label: "CLAUDE.md",
    gap: 11,
    count: (r) => r.items.claudeMd,
    tokens: (r) => r.projectClaudeMd,
  },
  {
    label: "skill descriptors",
    gap: 2,
    count: (r) => r.items.skills,
    tokens: (r) => r.skillDescriptors,
  },
  {
    label: "agent descriptors",
    gap: 2,
    count: (r) => r.items.agents,
    tokens: (r) => r.agentDescriptors,
  },
];

/**
 * v26.140.0 — `npm run cost:report` 의 상주 표. 한 줄 라인과 **같은 함수 가족**에 둔다.
 *
 * 스크립트가 자기 표를 직접 조립하던 동안 개수 열은 리포트에만 있고 설치 표면 둘에는 없었다.
 * 숫자 렌더를 여기로 모아 두면 표면이 늘어도 개수/토큰이 함께 따라간다.
 */
export function formatResidentCostBlock(r: ResidentCost): string[] {
  const n = (v: number): string => String(v).padStart(3);
  return [
    "                       개수    토큰",
    ...RESIDENT_ROWS.map(
      (row) => `  ${row.label}${" ".repeat(row.gap)}${n(row.count(r))}개  ~${row.tokens(r)}`,
    ),
    "  ─────────────────────────────────",
    `  상주 합계          ${n(r.items.total)}개 상주 · ~${r.total} tokens/세션`,
  ];
}

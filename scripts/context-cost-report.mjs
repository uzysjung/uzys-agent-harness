#!/usr/bin/env node
// v26.116.0 (ADR-043 후속 ①) — 자산별 컨텍스트 비용 순위표.
//
// NORTH_STAR 1차 NSM `Context Cost per Install` 의 계측 산출물. 값싼 결정론 계측으로 전수
// 순위를 세우고(1단계), 비싼 with/without eval 은 상위 자산에만 돌린다(2단계).
//
// 사용: npm run cost:report   (= npm run build && node scripts/context-cost-report.mjs)
//
// 두 열은 **단위가 다르다**:
//   - 상주(resident) = descriptor. 설치한 전원이 매 세션 무는 비용.
//   - 발화(fired)    = SKILL.md body. 그 스킬이 트리거될 때만 무는 비용.
// 근거 없는 가중 합산("총 비용")은 만들지 않는다 — 두 값을 따로 보고 판단한다.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetCostRows,
  DEV_METHOD_SKILL_IDS,
  estimateTokens,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
} from "../dist/trust-tier-drift.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const fmt = (n) => (n === null ? "     —" : `~${String(n).padStart(5)}`);

const defaults = new Set(DEV_METHOD_SKILL_IDS);
const rows = assetCostRows(INTERNAL_BUNDLED_SKILL_IDS, ROOT);

console.log("\n▸ 자산별 컨텍스트 비용 (repo-bundled 스킬, 발화 비용 내림차순)\n");
console.log("  설치     자산                        상주   발화");
console.log("  ─────────────────────────────────────────────────");
for (const r of rows) {
  const tag = defaults.has(r.id) ? "기본  " : "opt-in";
  console.log(`  ${tag}   ${r.id.padEnd(26)} ${fmt(r.descriptorTokens)} ${fmt(r.bodyTokens)}`);
}

const sum = (list, key) => list.reduce((a, r) => a + (r[key] ?? 0), 0);
const base = rows.filter((r) => defaults.has(r.id));

console.log("\n▸ 합계\n");
console.log(`  기본 설치 ${String(base.length).padStart(2)}종  상주 ~${sum(base, "descriptorTokens")}  ·  전부 발화 시 ~${sum(base, "bodyTokens")}`);
console.log(`  번들 전체 ${String(rows.length).padStart(2)}종  상주 ~${sum(rows, "descriptorTokens")}  ·  전부 발화 시 ~${sum(rows, "bodyTokens")}`);

// 참고: 룰은 상시 로드라 상주 비용이지만 현행 NSM 정의(스킬 descriptor + body)에 **미포함**이다.
// 수치를 보여주되 합계에는 섞지 않는다 — 정의 변경은 ADR 결정 사항이지 스크립트가 할 일이 아니다.
const ruleDir = join(ROOT, "templates", "rules");
const ruleTokens = readdirSync(ruleDir)
  .filter((f) => f.endsWith(".md"))
  .reduce((a, f) => a + estimateTokens(readFileSync(join(ruleDir, f), "utf8").length), 0);

const external = EXTERNAL_ASSETS.filter((a) => a.method.kind !== "internal").length;

console.log("\n▸ 미포함 (참고)\n");
console.log(`  룰 파일 전체            ~${ruleTokens} tokens — **상시 로드**지만 현행 NSM 정의 밖.`);
console.log("                          트랙별 실제 설치분은 이 값의 부분집합.");
console.log(`  외부 자산 ${String(external).padStart(2)}종          unmeasured — 설치 시점에 콘텐츠를 알 수 없다.`);
console.log("\n  두 항목은 합계에 섞지 않았다. 룰을 NSM 에 넣을지는 열린 결정 (ADR-043 후속).\n");

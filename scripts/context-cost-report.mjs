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

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assetCostRows,
  buildManifest,
  DEV_METHOD_SKILL_IDS,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
  residentCost,
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

// v26.117.0 (ADR-044) — 상주 비용은 스킬 descriptor 만이 아니다. 트랙별 실제 설치 계획에서
// 상주 표면 전체를 실측한다 (판정 기준 = 표면 열거가 아니라 "상주인가 발화인가").
const TRACK = process.argv[2] ?? "tooling";
const spec = { tracks: [TRACK], cli: ["claude"], options: {} };
const entries = buildManifest(spec).filter((e) => e.applies(spec));
const res = residentCost(entries, ROOT);

console.log(`\n▸ 상주 비용 — 설치가 매 세션 물리는 것 (track=${TRACK})\n`);
console.log(`  rules              ~${res.rules}`);
console.log(`  CLAUDE.md 스캐폴드  ~${res.projectClaudeMd}`);
console.log(`  skill descriptors  ~${res.skillDescriptors}`);
console.log(`  agent descriptors  ~${res.agentDescriptors}`);
console.log(`  ─────────────────────────`);
console.log(`  상주 합계          ~${res.total} tokens/세션`);

const external = EXTERNAL_ASSETS.filter((a) => a.method.kind !== "internal").length;
console.log("\n▸ 미계측\n");
console.log(`  외부 자산 ${String(external).padStart(2)}종   설치 시점에 콘텐츠를 알 수 없다 (no-false-ship — 추정치 금지).`);
console.log("  MCP tool schema   서버가 제공 — 템플릿에서 계산 불가.");
console.log("  hooks             컨텍스트에 안 올라감 (실행될 뿐) — 비용 대상 아님.\n");

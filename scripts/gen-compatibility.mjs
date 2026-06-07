#!/usr/bin/env node
// A-자동화 — docs/COMPATIBILITY.md 의 카탈로그 매트릭스를 자산 데이터에서 자동 생성.
//
// 수동 매트릭스 drift 방지(자산 추가/제거 시 손 갱신 불필요). trust-tier-drift.mjs 패턴.
// 데이터: dist/trust-tier-drift.js 가 re-export 하는 EXTERNAL_ASSETS + TRUST_TIER.
// 검증 등급: 2026-06-06 Docker realcli 배치 결과(method 기반 + 특이 override).
// 사용: npm run build && node scripts/gen-compatibility.mjs  (또는 npm run gen:compat)
//
// COMPATIBILITY.md 의 <!-- AUTO-GEN:CATALOG:START --> ~ END 사이만 교체. 나머지 prose 보존.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { EXTERNAL_ASSETS, TRUST_TIER } from "../dist/trust-tier-drift.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOC = join(HERE, "..", "docs", "COMPATIBILITY.md");
const VDATE = "2026-06-06";

// 검증 등급 — method 기반 기본값 + 특이 override (Docker realcli 배치 근거).
const LEVEL_BY_KIND = {
  plugin: `🟢 Docker ${VDATE}`, // real claude marketplace add + install
  skill: `🟢 Docker ${VDATE}`, // npx skills add
  "npx-run": `🟢 Docker ${VDATE}`, // npx 실행
  npm: `🟢 registry ${VDATE}`, // registry 실재 (openspec 는 아래 override 로 실설치)
  "shell-script": "🟡 local", // 로컬 스크립트 (네트워크 무관)
};
const LEVEL_OVERRIDE = {
  openspec: `🟢 Docker ${VDATE}`, // npm i + npx openspec --version 1.4.1
};

const CLI_SCOPE = {
  plugin: "Claude Code",
  skill: "Claude Code (+skills.sh)",
  npm: "agnostic",
  "npx-run": "agnostic",
  "shell-script": "local",
};

// ⚠️ src/categories.ts CATEGORIES 와 동기화 필수 — 누락 시 해당 카테고리 자산이 표에서
//    silent drop (헤더 카운트만 EXTERNAL_ASSETS.length 라 불일치). v26.78.0 understanding 추가.
const CATEGORY_TITLE = {
  workflow: "🔄 Workflow",
  frontend: "🎨 Frontend",
  backend: "🗄️ Backend",
  data: "📊 Data",
  business: "💼 Business",
  "dev-tools": "🛡️ Dev Tools",
  understanding: "🧠 Understanding",
  "ecc-suite": "📦 ECC Suite",
};
const CAT_ORDER = [
  "workflow",
  "frontend",
  "backend",
  "data",
  "business",
  "dev-tools",
  "understanding",
  "ecc-suite",
];

function target(m) {
  if (m.kind === "plugin") return `\`${m.pluginId}\``;
  if (m.kind === "skill") return `\`${m.source.replace(/^https?:\/\/github\.com\//, "")}${m.skill ? " :: " + m.skill : ""}\``;
  if (m.kind === "npm") return `\`${m.pkg}\` (npm)`;
  if (m.kind === "npx-run") return `\`${m.cmd}\` (npx)`;
  if (m.kind === "shell-script") return `\`${m.script}\``;
  return "?";
}

function rows() {
  const out = [];
  const tierRank = { official: 0, vetted: 1, experimental: 2 };
  for (const cat of CAT_ORDER) {
    const assets = EXTERNAL_ASSETS.filter((a) => a.category === cat).sort(
      (a, b) => (tierRank[TRUST_TIER[a.id]] ?? 3) - (tierRank[TRUST_TIER[b.id]] ?? 3),
    );
    if (assets.length === 0) continue;
    out.push(`\n#### ${CATEGORY_TITLE[cat] ?? cat} (${assets.length})\n`);
    out.push("| id | tier | 설치 타겟 | CLI | 검증 |");
    out.push("|---|---|---|---|---|");
    for (const a of assets) {
      const tier = TRUST_TIER[a.id] ?? "experimental";
      const lvl = LEVEL_OVERRIDE[a.id] ?? LEVEL_BY_KIND[a.method.kind] ?? "⚪";
      out.push(`| \`${a.id}\` | ${tier} | ${target(a.method)} | ${CLI_SCOPE[a.method.kind]} | ${lvl} |`);
    }
  }
  return out.join("\n");
}

function summary() {
  const counts = { official: 0, vetted: 0, experimental: 0 };
  for (const a of EXTERNAL_ASSETS) counts[TRUST_TIER[a.id] ?? "experimental"]++;
  const green = EXTERNAL_ASSETS.filter(
    (a) => (LEVEL_OVERRIDE[a.id] ?? LEVEL_BY_KIND[a.method.kind] ?? "").startsWith("🟢"),
  ).length;
  return `> **자동 생성** (\`scripts/gen-compatibility.mjs\`, ${VDATE}). 자산 **${EXTERNAL_ASSETS.length}** (official ${counts.official} / vetted ${counts.vetted} / experimental ${counts.experimental}) · 🟢 검증 **${green}/${EXTERNAL_ASSETS.length}**. tier SSOT=\`src/external-assets.ts\`, drift 감시=\`trust-tier-drift.yml\`.`;
}

const START = "<!-- AUTO-GEN:CATALOG:START -->";
const END = "<!-- AUTO-GEN:CATALOG:END -->";
const block = `${START}\n\n${summary()}\n${rows()}\n\n${END}`;

const doc = readFileSync(DOC, "utf8");
const re = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!re.test(doc)) {
  console.error(`마커(${START} ~ ${END})가 ${DOC} 에 없음. 수동 추가 필요.`);
  process.exit(1);
}
writeFileSync(DOC, doc.replace(re, block));
console.log(`COMPATIBILITY.md 카탈로그 매트릭스 갱신: ${EXTERNAL_ASSETS.length} 자산`);

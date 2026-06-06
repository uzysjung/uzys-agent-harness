#!/usr/bin/env node
// A1 — Trust Tier star-drift 검사.
//
// 정적 TRUST_TIER 라벨(2026-05 수동)이 실제 GitHub star 와 어긋났는지 live fetch 로 검출.
// drift 발견 시 비0 종료(CI fail) + $GITHUB_STEP_SUMMARY 표 출력.
//
// 데이터/로직은 dist/trust-tier-drift.js (테스트된 순수 모듈). 본 스크립트는 fetch + 보고만.
// 사용: npm run build && GITHUB_TOKEN=<token> node scripts/trust-tier-drift.mjs
//
// GITHUB_TOKEN: 미설정도 동작(unauthenticated 60req/hr)하나 CI 는 secrets.GITHUB_TOKEN 권장(5000/hr).

import { appendFileSync } from "node:fs";
import { classifyDrift, driftTargets, STAR_THRESHOLD } from "../dist/trust-tier-drift.js";

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

async function fetchRepo(repo) {
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "uzys-claude-harness-trust-drift",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (res.status === 404) return { stars: null, archived: false, note: "404 (repo 이동/삭제?)" };
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${repo}: ${await res.text()}`);
  const j = await res.json();
  return { stars: j.stargazers_count, archived: Boolean(j.archived), note: "" };
}

const targets = driftTargets();
const uniqueRepos = [...new Set(targets.map((t) => t.repo))];

// repo 별 1회 fetch (alirezarezvani/claude-skills 등 다수 자산이 공유).
const repoInfo = new Map();
for (const repo of uniqueRepos) {
  repoInfo.set(repo, await fetchRepo(repo));
}

const drifts = [];
const rows = [];
for (const t of targets) {
  const info = repoInfo.get(t.repo);
  if (info.stars == null) {
    drifts.push({ ...t, reason: info.note });
    rows.push(`| ${t.id} | ${t.repo} | ? | ${t.tier} | ⚠ ${info.note} |`);
    continue;
  }
  const verdict = classifyDrift(t.tier, info.stars); // ok | promote | demote
  // vetted = "star ≥ 1000 + 활성". archived 된 vetted 는 비활성 → demote 대상.
  const archivedVetted = t.tier === "vetted" && info.archived;
  if (verdict !== "ok" || archivedVetted) {
    const label = archivedVetted ? "demote (archived)" : verdict;
    drifts.push({ ...t, stars: info.stars, reason: label });
    rows.push(`| ${t.id} | ${t.repo} | ${info.stars} | ${t.tier} | ❌ ${label} |`);
  }
}

const summary = [
  `## Trust Tier star-drift (threshold ${STAR_THRESHOLD}★)`,
  "",
  `검사 ${targets.length} 자산 / ${uniqueRepos.length} repo · drift **${drifts.length}건**`,
  "",
  drifts.length
    ? `| 자산 | repo | live★ | 라벨 | 판정 |\n|---|---|---:|---|---|\n${rows.join("\n")}\n\n> 판정대로 \`src/external-assets.ts\` 의 TRUST_TIER 갱신 검토 (사람 결정).`
    : "✓ 모든 star 기반 라벨이 실제 star 와 정합.",
].join("\n");

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
}

if (drifts.length > 0) {
  console.error(`\n❌ drift ${drifts.length}건 — TRUST_TIER 갱신 검토 필요.`);
  process.exit(1);
}
console.log("\n✓ drift 없음.");

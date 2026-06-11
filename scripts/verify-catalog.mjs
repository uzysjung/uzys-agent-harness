#!/usr/bin/env node
// A — 카탈로그 자산 실 설치 검증 (Promise=Implementation 지속 테스트).
//
// COMPATIBILITY.md 의 "지속 테스트" 주장을 실제로 만드는 재현 가능 검증기.
// 각 자산을 method 별로 실 설치/조회해 광고한 설치 명령이 작동하는지 확인.
// drift(plugin 삭제·rename, 패키지 부재 등)를 자동 검출 → CI fail.
//
// ⚠️ 실 설치(`claude plugin install` 은 ~/.claude write, `npx skills add` 는 cwd write).
//    호스트 오염 방지: **격리 env 전용** — CI 또는 CATALOG_VERIFY_ALLOW=1 없으면 거부.
//    로컬은 `test/docker/scenario-catalog-verify.sh`(컨테이너) 또는 CI(`catalog-verify.yml`).
//
// 데이터: dist/trust-tier-drift.js 가 re-export 하는 EXTERNAL_ASSETS.
// 사전: 실 claude CLI + git HTTPS(insteadOf) 설정 (CI 워크플로가 준비).
// 사용: npm run build && CATALOG_VERIFY_ALLOW=1 node scripts/verify-catalog.mjs

import { spawnSync } from "node:child_process";
import { EXTERNAL_ASSETS } from "../dist/trust-tier-drift.js";

if (!process.env.CI && process.env.CATALOG_VERIFY_ALLOW !== "1") {
  console.error(
    "거부: 실 설치(~/.claude / cwd write)라 격리 env 전용.\n" +
      "  CI 러너 또는 throwaway 컨테이너에서 CATALOG_VERIFY_ALLOW=1 로 실행.\n" +
      "  (호스트 글로벌 write 금지 — CLAUDE.md 실환경 검증 원칙)",
  );
  process.exit(2);
}

const TIMEOUT = 120_000;
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8", stdio: "pipe", timeout: TIMEOUT });
  return {
    ok: r.status === 0,
    status: r.status,
    err: (r.stderr || r.stdout || "").trim().slice(-160),
  };
}

const seenMkt = new Set();
const results = [];
for (const a of EXTERNAL_ASSETS) {
  const m = a.method;
  let res;
  if (m.kind === "plugin") {
    if (!seenMkt.has(m.marketplace)) {
      run("claude", ["plugin", "marketplace", "add", m.marketplace]);
      seenMkt.add(m.marketplace);
    }
    res = run("claude", ["plugin", "install", m.pluginId]);
  } else if (m.kind === "skill") {
    const args = ["-y", "skills", "add", m.source];
    if (m.skill) args.push("--skill", m.skill);
    args.push("--agent", "claude-code");
    res = run("npx", args);
  } else if (m.kind === "npm") {
    res = run("npm", ["view", m.pkg, "version"]); // registry 실재 (full 설치는 표준 npm i)
  } else if (m.kind === "npx-run") {
    // v26.80.0 — cmd 는 bare 이름 + version 별도 필드 (pinned 버전 실재 확인).
    res = run("npm", ["view", `${m.cmd}@${m.version}`, "version"]);
  } else if (m.kind === "internal") {
    // v26.81.0 (ADR-022) — 내부 템플릿 자산: 설치 주체 = Phase 1 manifest (네트워크 무관).
    res = { ok: true, status: 0, err: "(internal — skip)" };
  } else {
    res = { ok: true, status: 0, err: "(local — skip)" }; // shell-script
  }
  results.push({ id: a.id, kind: m.kind, ...res });
  console.log(`${res.ok ? "OK  " : "FAIL"} ${a.id} (${m.kind})${res.ok ? "" : " :: " + res.err}`);
}

const fails = results.filter((r) => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} OK`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  const rows = results.map((r) => `| \`${r.id}\` | ${r.kind} | ${r.ok ? "✅" : "❌"} |`).join("\n");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## 카탈로그 검증 (${results.length - fails.length}/${results.length})\n\n| id | method | 결과 |\n|---|---|---|\n${rows}\n`,
  );
}
if (fails.length) {
  console.error(`\n실설치 실패 (Promise=Impl 위반): ${fails.map((f) => f.id).join(", ")}`);
  process.exit(1);
}

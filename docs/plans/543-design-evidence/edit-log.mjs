#!/usr/bin/env node
// #543 실험 — 설치 기록에서 트랙 하나를 뺀다(설계 가설의 "기록에서 T 를 빼는" 단계를 손으로 흉내낸다).
//   node edit-log.mjs <projectDir> spec-only <track>   : `spec.tracks` 에서만 뺀다
//   node edit-log.mjs <projectDir> spec+meta <track>   : `spec.tracks` + `.claude/.installed-tracks` 본문 + 그 sha(policyFiles) 를 함께 바꾼다
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const [projectDir, mode, track] = process.argv.slice(2);
if (!projectDir || !mode || !track) {
  console.error("usage: edit-log.mjs <projectDir> <spec-only|spec+meta> <track>");
  process.exit(3);
}
const logPath = join(projectDir, ".uzys-agent-harness/.harness-install.json");
const log = JSON.parse(readFileSync(logPath, "utf8"));
const before = [...log.spec.tracks];
log.spec.tracks = log.spec.tracks.filter((t) => t !== track);
const sha = (s) => createHash("sha256").update(s).digest("hex");
if (mode === "spec+meta") {
  const meta = join(projectDir, ".claude/.installed-tracks");
  if (existsSync(meta)) {
    const text = `${[...new Set(log.spec.tracks)].sort().join("\n")}\n`;
    writeFileSync(meta, text);
    const entry = (log.policyFiles ?? []).find((f) => f.path === ".installed-tracks");
    if (entry) entry.sha256 = sha(text);
    console.log(`meta rewritten: ${JSON.stringify(text)} sha=${sha(text).slice(0, 12)} (record entry ${entry ? "updated" : "absent"})`);
  }
}
writeFileSync(logPath, `${JSON.stringify(log, null, 2)}\n`);
console.log(`spec.tracks: ${before.join(",")} -> ${log.spec.tracks.join(",")}`);

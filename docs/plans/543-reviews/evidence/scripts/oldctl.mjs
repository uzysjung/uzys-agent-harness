// 대조 — 옛 판 설치본에서 --track 없이 update 두 번이 조용한가(A1s · A2 의 "두 번째 update 변화" 가 --track 몫인지)
// 그리고 v150 AGENTS.md 백업이 화면에 안 나오는 것이 --cli 재렌더(main)에도 있는가
import { cpSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { S, mkproj, recorder, run, snap, snapDiff } from "./lib.mjs";
const R = recorder("old-version-controls");
for (const [ver, args] of [["v125", ["--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "antigravity"]], ["v150", ["--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex"]]]) {
  const X = mkproj(`oldctl-${ver}`);
  run(ver, ["install", ...args], X);
  run("branch", ["update"], X);
  const a = snap(X); run("branch", ["update"], X);
  const d = snapDiff(a, snap(X));
  R.w(`## ${ver}: install → update → update (no --track): 2nd update ${d.length ? "CHANGED " + d.length + " lines" : "quiet"}`);
  const b = snap(X); run("branch", ["update"], X);
  R.w(`   3rd update: ${snapDiff(b, snap(X)).length ? "CHANGED" : "quiet"}`);
}
// v150 codex+opencode → main --cli opencode vs branch --cli opencode vs branch --track: AGENTS.md 백업 줄
const B = mkproj("oldctl-v150-agents");
run("v150", ["install", "--track", "tooling", "--track", "csr-fastapi", "--cli", "claude", "--cli", "codex", "--cli", "opencode"], B);
for (const [ver, cmd] of [["main", ["uninstall", "--cli", "opencode"]], ["branch", ["uninstall", "--cli", "opencode"]], ["branch", ["uninstall", "--track", "csr-fastapi"]]]) {
  const d = join(mkdtempSync(join(S, "proj", "oldctl-agents-")), "app"); cpSync(B, d, { recursive: true });
  const b = snap(d); const r = run(ver, cmd, d);
  const backups = snapDiff(b, snap(d)).filter((l) => /AGENTS\.md\.backup/.test(l));
  R.w(`## ${ver} ${cmd.join(" ")}: AGENTS.md backups on disk=${backups.length} · screen mentions AGENTS.md backup=${/AGENTS\.md.*(backup|saved a copy)/.test(r.out)}`);
  R.w(r.out.split("\n").filter((l) => /AGENTS/.test(l)).join("\n"));
}
console.log(R.file);

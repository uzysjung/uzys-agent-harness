// 일반 장면 실행기 — node scene.mjs <장면>... (장면 정의는 scenes-def.mjs)
// 흐름: (옛 판/브랜치) 설치 → 설치자 편집 → dry-run(무변경 · 이름 목록) → --track → list → update ×2(조용한가)
//       → 기준 설치(브랜치, 남는 트랙만) 와 하네스 파일 · 기록 비교
import { cmp, join, mkproj, rawLog, recorder, run, snap, snapDiff, read, exists } from "./lib.mjs";
import { SCENES } from "./scenes-def.mjs";

const IGN_DEFAULT = [/\.backup-\*/];

function namesFromDry(out) {
  const m = /removes: (.*)$/m.exec(out);
  if (!m) return null;
  if (/^nothing only/.test(m[1])) return new Set();
  const set = new Set();
  for (const g of m[1].split(" · ")) {
    const [kind, ...rest] = g.split(" ");
    for (const n of rest.join(" ").split(", ")) set.add(`${kind}/${n}`);
  }
  return set;
}
function removedNames(diff, after) {
  // 디스크에서 사라진 .claude/{rules,agents,skills}/ · .agents/{rules,skills}/ 이름(같은 경로가 다시 생긴 것은 제외)
  const gone = new Set(), afterPaths = new Set(after.map((l) => l.split(" ")[0]));
  for (const l of diff) {
    if (!l.startsWith("  - ")) continue;
    const p = l.slice(4).split(" ")[0];
    if (afterPaths.has(p)) continue;
    const m = /^\.(?:claude|agents)\/(rules|agents|skills)\/([^/]+?)(?:\.md)?(?:\/|$)/.exec(p);
    if (m) gone.add(`${m[1]}/${m[2]}`);
  }
  return gone;
}

for (const name of process.argv.slice(2)) {
  const sc = SCENES[name];
  if (!sc) { console.error("unknown scene", name); process.exit(3); }
  const R = recorder(name);
  R.w(`# ${name} — ${sc.title}`);
  const X = mkproj(`${name}-x`);
  if (sc.pre) { R.w("# pre-install installer files:"); R.w(sc.pre(X)); }
  for (const [ver, args] of sc.installs) R.step(`${ver} ${args.join(" ")}`, run(ver, args, X));
  if (sc.edit) { R.w("\n# installer edits:"); R.w(sc.edit(X) ?? ""); }
  if (sc.preOld) for (const [ver, args] of sc.preOld) R.step(`${ver} ${args.join(" ")}`, run(ver, args, X));
  const before = snap(X);
  const logBefore = rawLog(X);
  R.w(`\n# log before: tracks=${JSON.stringify(logBefore?.spec?.tracks)} clis=${JSON.stringify(logBefore?.spec?.clis)} records=${logBefore?.records}`);
  const trackArgs = ["uninstall", "--track", sc.remove, ...(sc.extra ?? [])];
  const dry = R.step(`branch ${trackArgs.join(" ")} --dry-run`, run("branch", [...trackArgs, "--dry-run"], X));
  const dryChange = snapDiff(before, snap(X));
  R.w(`# dry-run disk change: ${dryChange.length}`); if (dryChange.length) R.w(dryChange.join("\n"));
  const r = R.step(`branch ${trackArgs.join(" ")}`, run("branch", trackArgs, X));
  const afterTrack = snap(X);
  const diff = snapDiff(before, afterTrack);
  R.w("\n# disk diff by --track:"); R.w(diff.join("\n") || "  (none)");
  const said = namesFromDry(dry.out), gone = removedNames(diff, afterTrack);
  if (said) {
    const notGone = [...said].filter((n) => !gone.has(n)), unsaid = [...gone].filter((n) => !said.has(n));
    R.w(`# NAMES CHECK — said-but-not-removed: ${JSON.stringify(notGone)} · removed-but-unsaid: ${JSON.stringify(unsaid)}`);
  }
  const lg = rawLog(X);
  R.w(`# log after: tracks=${JSON.stringify(lg?.spec?.tracks)} · meta=${exists(join(X, ".claude/.installed-tracks")) ? JSON.stringify(read(join(X, ".claude/.installed-tracks"))) : "(none)"} · metaSha=${(lg?.policyFiles ?? []).find((f) => f.path === ".installed-tracks")?.sha256?.slice(0, 12)}`);
  if (r.code !== 0 && !sc.expectFail) R.w("!!! --track exit != 0");
  if (sc.after) R.w(sc.after(X) ?? "");
  R.step("branch list", run("branch", ["list"], X));
  if (sc.noUpdate) continue;
  const s1 = snap(X);
  R.step("branch update", run("branch", ["update"], X));
  const d1 = snapDiff(s1, snap(X));
  R.w(`# UPDATE QUIET CHECK 1: ${d1.length === 0 ? "quiet" : "CHANGED"}`); if (d1.length) R.w(d1.join("\n"));
  const s2 = snap(X);
  R.step("branch update (2)", run("branch", ["update"], X));
  const d2 = snapDiff(s2, snap(X));
  R.w(`# UPDATE QUIET CHECK 2: ${d2.length === 0 ? "quiet" : "CHANGED"}`); if (d2.length) R.w(d2.join("\n"));
  if (sc.readd) for (const [ver, args] of sc.readd) R.step(`[re-add] ${ver} ${args.join(" ")}`, run(ver, args, X));
  if (sc.ref) {
    const Y = mkproj(`${name}-y`);
    if (sc.refPre && sc.pre) sc.pre(Y);
    for (const [ver, args] of sc.ref) R.step(`[ref] ${ver} ${args.join(" ")}`, run(ver, args, Y));
    if (sc.refEdit) sc.refEdit(Y);
    R.w("\n# COMPARE X(after --track + update) vs Y(fresh install of remaining) — '-' only in X, '+' only in Y");
    R.w(cmp(X, Y, [...IGN_DEFAULT, ...(sc.ignore ?? [])]).join("\n") || "  (identical)");
  }
  console.log(`${name}: ${R.file}`);
}

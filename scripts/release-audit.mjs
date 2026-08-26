#!/usr/bin/env node
/**
 * 원격에 밀린 태그가 npm 에 **실제로 게시됐는지** 대조한다 (#367, Epic #366 의 G5).
 *
 * 왜 이것이 워크플로 밖에 있어야 하나 (2026-08-27 실측):
 *   `v26.148.0` 태그를 밀었는데 `ci` 워크플로가 발동하지 않았고, `publish` 는 `needs: ci` 라
 *   따라서 안 돌았다. npm 은 옛 버전인 채였다. 원인은 GitHub Actions major outage 였고,
 *   같은 push 에서 `install-matrix` 는 **정상 실행**됐다 — 즉 부분 발동이라 화면에는 성공한
 *   워크플로가 하나 보였다. **실패한 빨간불이 아니라 아무것도 없음**이라 조용했다.
 *
 *   그 워크플로 안에 어떤 검사를 넣어도 안 돈다. 그래서 이 검사는 push 이벤트와 무관하게
 *   (스케줄로) 돌아야 한다.
 *
 * 판정:
 *   모집단 = **npm 게시가 시작된 이후**의 원격 태그. 경계는 npm 이 답한다(`versions[0]`) —
 *     여기 적으면 두 번째 사본이 되어 썩는다. 게시 이전 시대 태그 137개가 이 derive 로 빠진다.
 *   면제  = CHANGELOG 의 해당 릴리즈 헤딩 **바로 다음 줄**에 단독으로
 *     `<!-- npm-publish:none <사유> -->`. 산문에 "미게시"라고 적는 것으로는 면제되지 않는다 —
 *     문장의 뜻을 기계가 판정하지 않는다는 이 저장소의 확정 방침 때문이다(#357).
 *
 * exit: 0 전부 게시됨 · 1 미게시 발견 · 2 신뢰 불가(대조군 실패) · 3 사용법
 *
 * 신뢰 불가를 성공으로 접지 않는다: 태그 조회나 registry 조회가 실패하면 "미게시 0건"과
 * "내 탐지기가 죽었다"가 구분되지 않는다. 그 상태는 통과가 아니다(`check-absence.sh` 와 같은 철학).
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PKG = "@uzysjung/agent-harness";
const CHANGELOG = fileURLToPath(new URL("../CHANGELOG.md", import.meta.url));
const EXEMPT = /^<!--\s*npm-publish:none\s+(\S.*?)\s*-->$/;

const die = (code, msg) => {
  process.stderr.write(`${msg}\n`);
  process.exit(code);
};

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

/** `v26.9.0` < `v26.10.0` — 문자열 비교로는 뒤집힌다. */
const parse = (v) => v.replace(/^v/, "").split(".").map(Number);
const cmp = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
};

// ── 재료 1: 원격 태그. 로컬 태그는 아직 안 민 것이므로 모집단이 아니다
//    (릴리즈 절차 3단계의 로컬 태그가 여기서 빨간불이 되면 절차가 잠긴다).
let tags;
try {
  tags = [
    ...new Set(
      run("git", ["ls-remote", "--tags", "origin"])
        .split("\n")
        .filter((l) => l.includes("refs/tags/"))
        .map((l) => l.split("refs/tags/")[1])
        .filter((t) => /^v\d/.test(t) && !t.endsWith("^{}")),
    ),
  ];
} catch (e) {
  die(2, `신뢰 불가: 원격 태그를 못 읽었다 — ${e.message}\n  이 상태의 "미게시 0건"은 증거가 아니다.`);
}
if (tags.length === 0) die(2, '신뢰 불가: 원격 태그가 0개다. 저장소에 태그가 있는데 0개면 조회가 죽은 것이다.');

// ── 재료 2: npm 게시 버전
let published;
try {
  published = JSON.parse(run("npm", ["view", PKG, "versions", "--json"]));
} catch (e) {
  die(2, `신뢰 불가: npm registry 를 못 읽었다 — ${e.message}\n  네트워크나 registry 장애일 수 있다. 통과로 접지 않는다.`);
}
if (!Array.isArray(published) || published.length === 0) {
  die(2, "신뢰 불가: npm 게시 버전 목록이 비었다. 이 패키지는 게시 이력이 있으므로 조회가 잘못된 것이다.");
}

// ── 모집단: 게시가 시작된 이후의 태그만. 경계를 npm 이 답하게 한다(하드코딩 금지).
const firstPublished = [...published].sort(cmp)[0];
const inScope = tags.filter((t) => cmp(t, firstPublished) >= 0);
if (inScope.length === 0) {
  die(2, `신뢰 불가: 게시 시작(${firstPublished}) 이후 태그가 0개다 — 버전 비교가 깨졌다.`);
}

// ── 면제: CHANGELOG 헤딩 바로 다음 줄의 표식만 인정한다.
const lines = readFileSync(CHANGELOG, "utf8").split("\n");
const exempt = new Map();
lines.forEach((line, i) => {
  const m = line.match(/^##\s*\[(v[\d.]+)\]/);
  if (!m) return;
  const next = (lines[i + 1] ?? "").trim();
  const e = next.match(EXEMPT);
  if (e) exempt.set(m[1], e[1]);
});

const have = new Set(published);
const missing = inScope.filter((t) => !have.has(t.replace(/^v/, "")) && !exempt.has(t)).sort(cmp);

process.stdout.write(
  `원격 태그 ${tags.length}개 · npm 게시 ${published.length}개 · ` +
    `모집단(${firstPublished} 이후) ${inScope.length}개 · 면제 ${exempt.size}개\n`,
);
for (const [v, why] of exempt) process.stdout.write(`  면제  ${v} — ${why}\n`);

if (missing.length === 0) {
  process.stdout.write("\n밀린 태그가 전부 npm 에 있다.\n");
  process.exit(0);
}

process.stdout.write(`\n태그는 원격에 있는데 npm 에 없는 버전 ${missing.length}개:\n`);
for (const v of missing) process.stdout.write(`  미게시  ${v}\n`);
process.stderr.write(
  "\n게시가 일어나지 않았다. 릴리즈 워크플로가 발동했는지부터 확인한다:\n" +
    "  gh run list --workflow=ci --limit 3\n" +
    "워크플로가 아예 안 돌았으면(트리거 유실·Actions 장애) 같은 태그에서 재트리거한다:\n" +
    "  gh workflow run ci --ref <태그>\n" +
    "의도적으로 게시하지 않은 버전이면 CHANGELOG 헤딩 **바로 다음 줄**에 단독으로 넣는다:\n" +
    "  <!-- npm-publish:none <사유> -->\n",
);
process.exit(1);

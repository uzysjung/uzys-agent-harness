#!/usr/bin/env node
/**
 * observation-digest — 세션 관측 로그를 감사가 읽을 수 있는 크기로 집계한다.
 *
 * 왜 있나: harness-health-audit B1 은 "이 스킬이 실제로 쓰이는가"를 물으면서도 스스로
 * "observational, not measured — do not invent a trigger rate" 라고 한계를 적어 놨다.
 * continuous-learning-v2 의 관측 훅이 남긴 tool 호출 로그가 그 빈칸의 실측 입력이다.
 *
 * 역할 분담 (코드로 되는 건 코드로):
 *   - 이 스크립트: 세기 · 묶기 · 반복 시그니처 집계  → 전부 결정론
 *   - 모델(감사 스킬): "이 반복이 문제인가", "이 자산이 값을 하는가" → 판단
 * 이 경계를 넘지 마라. 여기서 교훈을 문장으로 쓰기 시작하면 모델의 몫을 뺏는 것이다.
 *
 * ── 이 데이터가 답할 수 있는 것과 없는 것 (설계의 핵심) ──
 * 레코드 필드는 tool_start{tool,input} · tool_complete{tool,output} 뿐이고 **exit code 가 없다**.
 *   측정 가능: 어떤 툴이 얼마나 쓰였나 · 같은 명령이 몇 번 반복됐나 · 세션 수 · 기간
 *   측정 불가: 실패율. exit code 가 없어서 성공/실패를 구분할 수 없다.
 * 초안은 output 에 "error|failed" 가 있는지로 실패를 셌는데, 그러면 Edit 이 쓰는 **파일 내용**의
 * 단어까지 잡혀 5,091건 중 493건(9.7%)이 "실패"로 집계됐다. 실제 stderr 를 남긴 호출은 24건이다.
 * 20배 부풀린 지표를 감사에 먹이는 것은 감사 스킬이 금지하는 "지어낸 수치" 그 자체라 걷어냈다.
 * stderr 는 약한 힌트로만 보고하며, 성공한 명령도 stderr 를 쓴다는 점을 함께 밝힌다.
 *
 * 읽기 전용. `~/.claude/homunculus/` 에 절대 쓰지 않는다 — 이 디렉터리는 관측기 소유다.
 *
 * 사용:
 *   node observation-digest.mjs            # 현재 repo 에 해당하는 프로젝트
 *   node observation-digest.mjs --all      # 전 프로젝트
 *   node observation-digest.mjs --json     # 기계 판독용
 *   node observation-digest.mjs --days 30  # 최근 N일 (기본: 전체)
 *
 * exit: 0 정상 · 3 관측 로그 없음(감사는 계속하되 B1 을 "미측정"으로 보고할 것)
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

const HOMUNCULUS = process.env.CLV2_HOMUNCULUS_DIR || join(homedir(), ".claude", "homunculus");
const PROJECTS = join(HOMUNCULUS, "projects");

const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const JSON_OUT = argv.includes("--json");
const daysIdx = argv.indexOf("--days");
const DAYS = daysIdx >= 0 ? Number(argv[daysIdx + 1]) : null;

/** 명령을 반복 탐지용 시그니처로 축약. 경로·해시·숫자를 지워 같은 종류를 한 덩어리로 묶는다. */
function commandSignature(tool, inputRaw) {
  let input;
  try {
    input = JSON.parse(inputRaw);
  } catch {
    return null;
  }
  // 툴마다 "무엇을 했나"를 담은 필드가 다르다. 없으면 시그니처를 만들지 않는다(추측 금지).
  const subject = input.command ?? input.file_path ?? input.pattern ?? input.path ?? null;
  if (typeof subject !== "string") return null;
  const norm = subject
    .replace(/[0-9a-f]{7,}/gi, "<hash>")
    .replace(/\d+/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  return norm ? `${tool}: ${norm}` : null;
}

function projectDirs() {
  if (!existsSync(PROJECTS)) return [];
  const dirs = readdirSync(PROJECTS)
    .map((d) => join(PROJECTS, d))
    .filter((d) => existsSync(join(d, "observations.jsonl")));
  if (ALL) return dirs;
  // 기본값 = 현재 작업 디렉터리에 해당하는 프로젝트. 같은 root 에 여러 해시가 생길 수 있어
  // (관측기가 시점마다 새 id 를 만든다) 매칭되는 것을 전부 합친다.
  const cwd = process.cwd();
  return dirs.filter((d) => {
    try {
      return JSON.parse(readFileSync(join(d, "project.json"), "utf8")).root === cwd;
    } catch {
      return false;
    }
  });
}

function analyze(dirs) {
  const cutoff = DAYS ? Date.now() - DAYS * 86_400_000 : null;
  const tools = new Map();
  const cmdSigs = new Map();
  const sessions = new Set();
  let completes = 0;
  let starts = 0;
  let stderrCalls = 0;
  let skippedUnparsable = 0;
  let first = null;
  let last = null;

  for (const dir of dirs) {
    for (const line of readFileSync(join(dir, "observations.jsonl"), "utf8").split("\n")) {
      if (!line.trim()) continue;
      let rec;
      try {
        rec = JSON.parse(line);
      } catch {
        skippedUnparsable++;
        continue;
      }
      const ts = Date.parse(rec.timestamp ?? "");
      if (cutoff && Number.isFinite(ts) && ts < cutoff) continue;
      if (Number.isFinite(ts)) {
        if (first === null || ts < first) first = ts;
        if (last === null || ts > last) last = ts;
      }
      if (rec.session) sessions.add(rec.session);
      const tool = rec.tool || "?";

      if (rec.event === "tool_start") {
        starts++;
        const sig = commandSignature(tool, String(rec.input ?? ""));
        if (sig) cmdSigs.set(sig, (cmdSigs.get(sig) ?? 0) + 1);
      } else if (rec.event === "tool_complete") {
        completes++;
        tools.set(tool, (tools.get(tool) ?? 0) + 1);
        // 약한 힌트일 뿐 — 성공한 명령도 stderr 를 쓴다. 실패율로 승격하지 마라.
        const out = String(rec.output ?? "");
        if (out.startsWith("{")) {
          try {
            if (String(JSON.parse(out).stderr ?? "").trim()) stderrCalls++;
          } catch {
            /* 파싱 불가 output 은 힌트 집계에서 제외 */
          }
        }
      }
    }
  }

  return {
    projects: dirs.map((d) => basename(d)),
    sessions: sessions.size,
    toolStarts: starts,
    toolCompletes: completes,
    stderrBearingCalls: stderrCalls,
    skippedUnparsable,
    windowStart: first ? new Date(first).toISOString().slice(0, 10) : null,
    windowEnd: last ? new Date(last).toISOString().slice(0, 10) : null,
    byTool: [...tools.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tool, calls]) => ({ tool, calls })),
    // 3회 이상 반복된 동일 명령 — 재시도 루프 / 수기 반복의 후보. 2회는 우연이 흔하다.
    repeatedCommands: [...cmdSigs.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([signature, count]) => ({ count, signature })),
  };
}

const dirs = projectDirs();
if (!dirs.length) {
  const why = existsSync(PROJECTS)
    ? ALL
      ? "관측 디렉터리는 있으나 observations.jsonl 이 없다"
      : "이 프로젝트의 관측 기록이 없다 (--all 로 전 프로젝트 확인 가능)"
    : `관측 디렉터리 자체가 없다: ${PROJECTS}`;
  const msg = {
    available: false,
    reason: why,
    note: "B1 '실제로 쓰이는가'는 이 실행에서 미측정이다. 추정치를 지어내지 말고 미측정이라고 보고하라.",
  };
  console.log(
    JSON_OUT
      ? JSON.stringify(msg, null, 2)
      : `관측 로그 없음 — ${why}\n→ B1 은 "미측정"으로 보고할 것 (추정 금지).`,
  );
  process.exit(3);
}

const d = analyze(dirs);

if (JSON_OUT) {
  console.log(JSON.stringify({ available: true, ...d }, null, 2));
  process.exit(0);
}

console.log(
  `관측 집계 — 프로젝트 ${d.projects.length}개 · 세션 ${d.sessions} · ${d.windowStart} ~ ${d.windowEnd}`,
);
console.log(
  `tool_start ${d.toolStarts.toLocaleString()} / tool_complete ${d.toolCompletes.toLocaleString()}`,
);
if (d.skippedUnparsable) console.log(`(파싱 실패 ${d.skippedUnparsable}줄 — 집계 제외)`);

console.log("\n툴별 호출 수 — B1 '실제로 쓰이는가'의 실측 입력:");
for (const t of d.byTool.slice(0, 15)) {
  console.log(`  ${t.tool.padEnd(16)} ${String(t.calls).padStart(6)}`);
}

console.log(`\n반복된 동일 명령 (3회 이상, 상위 ${Math.min(20, d.repeatedCommands.length)}):`);
if (!d.repeatedCommands.length) {
  console.log("  없음");
} else {
  for (const r of d.repeatedCommands) {
    console.log(`  ${String(r.count).padStart(3)}회  ${r.signature}`);
  }
}

console.log(`
── 이 집계가 말할 수 없는 것 ──
실패율은 측정 불가다. 관측 레코드에 exit code 가 없다. stderr 를 남긴 호출 ${d.stderrBearingCalls}건은
약한 힌트일 뿐이며(성공한 명령도 stderr 를 쓴다) 실패 건수가 아니다. 실패율을 지어내지 마라.

판정은 여기서 하지 않는다 — 위 숫자는 증거이고, 무엇이 반복이고 무엇이 승격 대상인지는
감사 스킬이 판단한다. 시그니처는 정규화된 발췌라 원문 명령이 아니다.`);

/**
 * #677 — 기록에 하네스 몫으로 있지만 **이번 렌더(기록 트랙 · 깔린 CLI)에 없는** 하네스 파일을 치운다.
 *
 * 대상은 Antigravity 룰 자리(`.agents/rules/<룰>.md`)의 `externalFiles` 항목 하나뿐이다. #601 이전 판이 트랙과 무관하게
 * 룰을 깔고(예: data 트랙에 `cli-development.md`) 기록에 남겼는데, 이 자리는 파일 하나가 곧 상주 룰이라 남으면 계속 읽힌다.
 * 다른 `externalFiles`(스킬 · 훅 · 함께 쓰는 파일)는 렌더가 디스크·선택에 따라 달라 "렌더 밖" 을 이 함수가 단정할 수 없다 —
 * 그쪽은 다루지 않는다.
 *
 * 판정은 `judge` 의 harness remove 규칙 그대로다(설계 `one-principle-design-2026-09-27.md` §1.2): 기록 sha 와 같으면 지우고,
 * 다르면(설치자가 고쳤다) **그 파일 하나만** 백업한 뒤 지우고, 이미 없으면 기록만 뺀다. 지우지 않는 것:
 *   - 렌더에 있는 룰(누적된 기록 트랙의 룰) · 앵커(`uzys-harness.md`)
 *   - `excluded` 에 있는 룰 — 뺐지만 디스크에 남은 것은 지우지 않는다(ADR-099 R3)
 *   - 기록에 없는 파일(설치자 파일) — 기록만 훑으므로 닿지 않는다
 *   - 링크 · 프로젝트 밖 실체(ADR-098) — 링크는 설치자 것이다
 *   - 기록 트랙이 지금 어휘로 하나도 안 읽히거나 antigravity 가 깔린 CLI 에 없을 때 — 렌더를 말할 수 없다
 */

import { lstatSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { isBaselineExcluded } from "./baseline-targets.js";
import { backupFile } from "./fs-ops.js";
import type { InstallLog } from "./install-log.js";
import { judge } from "./judge.js";
import { resolveRules } from "./manifest.js";
import type { OutsideGuard } from "./outside-project.js";
import { type CliBase, TRACKS, type Track } from "./types.js";

const AGENTS_RULE = /^\.agents\/rules\/([^/]+)\.md$/;
/** Antigravity 앵커 — 트랙과 무관하게 늘 렌더된다. */
const ANCHOR_RULE = "uzys-harness";

export interface OutOfTrackReclaim {
  /** 기록 sha 그대로라 지운 파일(프로젝트 상대). */
  removed: string[];
  /** 설치자가 고친 파일 — 그 파일 하나를 백업하고 지웠다. `backup` 은 절대경로. */
  backedUp: Array<{ path: string; backup: string }>;
  /** 기록(`externalFiles`)에서 뺄 경로 — 지웠거나 이미 없었다. */
  forget: string[];
  /**
   * 기록 트랙 밖이지만 **같은 룰의 claude 자리 사본이 기록에 있어** 남긴 경로(리뷰 B1 · B2). 옛 판이 덮어쓴 기록에서 그 트랙을
   * 되살릴 근거가 없을 때 정당한 룰을 지우지 않는 보호다 — 남기기만 하므로 넓은 근거를 써도 아무것도 더 깔리지 않는다.
   * 기록 트랙 밖이라 갱신되지 않는다 — 화면이 그 트랙을 기록하는 명령을 말한다.
   */
  kept: string[];
  /** 판정에 쓴 기록 트랙 — 화면이 "your tracks" 가 아니라 이 목록을 밝힌다(리뷰 B1). */
  recordedTracks: Track[];
  /**
   * 지운(또는 백업하고 지운) 경로마다 그 룰을 가져오는 트랙(룰이 적은 트랙 먼저). 기록이 잘렸는데 근거가 없어 되살리지 못한
   * 경우(claude 없이 깐 트랙)와 #677 본래 대상은 기록으로 가를 수 없다 — 화면이 되돌리는 명령을 이 트랙으로 말한다.
   */
  bringBack: Record<string, Track[]>;
}

export function reclaimOutOfTrack(args: {
  projectDir: string;
  log: InstallLog | null;
  /** 이 실행 뒤의 기록 트랙(누적). */
  tracks: ReadonlyArray<Track>;
  /** 이 실행 뒤의 깔린 CLI 집합. */
  clis: ReadonlyArray<CliBase>;
  /** 이 실행 뒤의 `excluded`. */
  excluded: ReadonlySet<string>;
  outside: OutsideGuard;
  now?: Date;
}): OutOfTrackReclaim {
  const out: OutOfTrackReclaim = {
    removed: [],
    backedUp: [],
    forget: [],
    kept: [],
    recordedTracks: [...args.tracks].sort(),
    bringBack: {},
  };
  const { log, projectDir } = args;
  if (log === null || args.tracks.length === 0 || !args.clis.includes("antigravity")) return out;
  const rendered = new Set(resolveRules({ tracks: args.tracks }));
  // claude 레인은 처음부터 트랙 룰(`resolveRules`)만 깔았다 — 같은 룰의 claude 사본이 기록에 있으면 그 트랙은 깔렸던 것이다
  const claudeCopy = new Set((log.policyFiles ?? []).map((p) => p.path));
  for (const f of log.externalFiles ?? []) {
    const name = AGENTS_RULE.exec(f.path)?.[1];
    if (name === undefined || name === ANCHOR_RULE || rendered.has(name)) continue;
    if (isBaselineExcluded(`.claude/rules/${name}.md`, args.excluded)) continue;
    if (claudeCopy.has(`rules/${name}.md`)) {
      out.kept.push(f.path);
      out.bringBack[f.path] = tracksBringing(name);
      continue;
    }
    const abs = join(projectDir, f.path);
    if (args.outside.skip(abs)) continue;
    const stat = lstatSync(abs, { throwIfNoEntry: false });
    if (stat !== undefined && !stat.isFile()) continue; // 링크 · 디렉터리는 설치자 것이다
    const disk = stat === undefined ? null : readFileSync(abs, "utf8");
    const verdict = judge({
      op: "remove",
      kind: "harness",
      rec: { state: "sha", sha256: f.sha256 },
      disk,
      next: null,
    });
    if (verdict.record === "forget") out.forget.push(f.path);
    if (verdict.verdict === "remove" || verdict.verdict === "backup+remove") {
      out.bringBack[f.path] = tracksBringing(name);
    }
    if (verdict.verdict === "remove") {
      rmSync(abs);
      out.removed.push(f.path);
    } else if (verdict.verdict === "backup+remove") {
      const backup = backupFile(abs, args.now);
      rmSync(abs);
      out.backedUp.push({ path: f.path, backup });
    }
  }
  return out;
}

/** 이 룰을 가져오는 트랙 — 룰이 적은(좁은) 트랙 먼저. `full` 처럼 넓은 트랙을 되돌리는 명령의 첫 후보로 내지 않는다. */
function tracksBringing(rule: string): Track[] {
  const size = (t: Track): number => resolveRules({ tracks: [t] }).length;
  return TRACKS.filter((t) => resolveRules({ tracks: [t] }).includes(rule)).sort(
    (a, b) => size(a) - size(b),
  );
}

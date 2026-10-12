/**
 * displaced 되돌리기 — 하네스가 자리를 떠나는 모든 remove 가 쓰는 함수 하나 (#782 · ADR-097 결정 3 · `judgeDisplaced`).
 *
 * 하네스 자산과 같은 이름의 설치자 파일이 있던 자리에 하네스 판을 쓰면 그 원본을 백업하고 기록에 `rootFiles.change =
 * displaced`(`notes[0]` = 백업 경로)로 적는다. 하네스가 그 자리를 떠나면(파일을 지운 뒤) 원본을 원래 이름으로 되돌린다 —
 * 자리가 막혔거나 백업이 없으면 되돌리지 않고 말한다.
 *
 * 배선(호출부가 하네스 판을 지운 **뒤**, 그 실행의 기록 쓰기 **앞**에 부른다):
 *   - uninstall 전량 · `--cli` — `commands/uninstall.ts` `removeHarnessFiles`
 *   - update 의 은퇴 회수 — `update-mode.ts` `pruneOrphans` 루프 뒤
 *   - update 의 트랙 밖 룰 회수 — `update-mode.ts` `reclaimOutOfTrackRecorded`
 *   - update 의 옛 Antigravity 앵커 은퇴 — `update-mode.ts` `refreshExternalCli`
 *   - install · `--reinstall` 의 트랙 밖 룰 회수와 옛 Antigravity 앵커 은퇴 — `installer.ts`
 * 기록 정리(`withoutRestored`)는 호출부가 자기 기록 쓰기에 끼운다.
 */

import { lstatSync, mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import type { InstallLog, InstallLogRootFile } from "./install-log.js";
import { judgeDisplaced } from "./judge.js";
import { outsideProjectTarget } from "./outside-project.js";

export interface DisplacedOutcome {
  path: string;
  /** 비켜 둔 설치자 원본의 백업(project 상대). 없으면 null(내용이 하네스 판과 같아 그대로 두었던 자리). */
  backup: string | null;
  verdict: "restore" | "advise" | "leave";
  line: string;
  /** 이 displaced 기록을 지운다. */
  forget: boolean;
}

/** lstat 기준 존재 — 끊어진 링크도 "있다"(그 자리가 막혀 있다). */
function exists(abs: string): boolean {
  try {
    lstatSync(abs);
    return true;
  } catch {
    return false;
  }
}

/**
 * 하네스가 자리를 떠난 **뒤** 부른다. `has` = 이번 remove 의 범위(프로젝트 상대 경로 술어) · `willBeGone` = 미리보기에서
 * "이번에 지울 하네스 판"(빈 자리로 친다 — uninstall dry-run 전용) · `write=false` 면 판정만.
 */
export function restoreDisplaced(
  log: InstallLog,
  projectDir: string,
  opts: { has: (path: string) => boolean; willBeGone?: ReadonlySet<string>; write: boolean },
): DisplacedOutcome[] {
  const out: DisplacedOutcome[] = [];
  for (const f of log.rootFiles ?? []) {
    if (f.change !== "displaced" || !opts.has(f.path)) continue;
    const slot = join(projectDir, f.path);
    // 하네스는 밖에 쓰지 않았다 — 그 자리의 말은 밖 링크 줄이 한다
    if (outsideProjectTarget(projectDir, slot) !== null) continue;
    const backup = f.notes[0] ?? null;
    const d = judgeDisplaced({
      backup,
      backupExists: backup !== null && exists(join(projectDir, backup)),
      slotEmpty: !exists(slot) || (!opts.write && opts.willBeGone?.has(f.path) === true),
    });
    if (opts.write && d.verdict === "restore" && backup !== null) {
      mkdirSync(dirname(slot), { recursive: true });
      renameSync(join(projectDir, backup), slot);
    }
    out.push({
      path: f.path,
      backup,
      verdict: d.verdict,
      line: d.line,
      forget: d.record === "forget",
    });
  }
  return out;
}

/** 기록 정리 — `forget` 인 displaced 항목을 뺀 `rootFiles`(자리가 막혀 못 되돌린 것은 남긴다 — 다음 회수가 다시 본다). */
export function withoutRestored(
  rootFiles: ReadonlyArray<InstallLogRootFile> | undefined,
  outcomes: ReadonlyArray<DisplacedOutcome>,
): InstallLogRootFile[] {
  const settled = new Set(outcomes.filter((d) => d.forget).map((d) => d.path));
  return (rootFiles ?? []).filter((f) => !(f.change === "displaced" && settled.has(f.path)));
}

/**
 * displaced 되돌리기 — 하네스가 자리를 떠나는 remove 가 쓰는 함수 하나 — #477 스킬 폴더 안 정리는 예외(원본은 백업에 남고 uninstall 이 되돌린다) (#782 · ADR-097 결정 3 · `judgeDisplaced`).
 *
 * 하네스 자산과 같은 이름의 설치자 파일이 있던 자리에 하네스 판을 쓰면 그 원본을 백업하고 기록에 `rootFiles.change =
 * displaced`(`notes[0]` = 백업 경로)로 적는다. 하네스가 그 자리를 떠나면(파일을 지운 뒤) 원본을 원래 이름으로 되돌린다 —
 * 자리가 막혔거나 백업이 없거나, 기록이 댄 백업이 프로젝트 밖이거나 이 자리의 백업 이름이 아니거나(#887 · #894), 그 자리가 하네스
 * 자리 밖이면(#901 · `harness-slot.ts`) 되돌리지 않고 말한다.
 *
 * 배선(호출부가 하네스 판을 지운 **뒤**, 그 실행의 기록 쓰기 **앞**에 부른다):
 *   - uninstall 전량 · `--cli` — `commands/uninstall.ts` `removeHarnessFiles`
 *   - update 의 은퇴 회수 — `update-mode.ts` `pruneOrphans` 루프 뒤
 *   - update 의 트랙 밖 룰 회수 — `update-mode.ts` `reclaimOutOfTrackRecorded`
 *   - update 의 옛 Antigravity 앵커 은퇴 — `update-mode.ts` `refreshExternalCli`
 *   - install · `--reinstall` 의 트랙 밖 룰 회수와 옛 Antigravity 앵커 은퇴 — `installer.ts`
 *   - `uninstall --only <외부 스킬>` — `commands/uninstall.ts` (그 자산을 처음 더할 때 상류 파일에 덮인 설치자 파일, #780)
 * 기록 정리(`withoutRestored`)는 호출부가 자기 기록 쓰기에 끼운다.
 */

import { lstatSync, mkdirSync, readFileSync, renameSync } from "node:fs";
import { basename, dirname, join, posix } from "node:path";
import { backupOriginal } from "./fs-ops.js";
import { inHarnessSlot } from "./harness-slot.js";
import { hashContent, type InstallLog, type InstallLogRootFile } from "./install-log.js";
import { judgeDisplaced } from "./judge.js";
import { isLegacyHarnessFile } from "./legacy-fingerprints.js";
import { outsideProjectTarget } from "./outside-project.js";
import { bundlePath, isRecordedTrackTarget } from "./recorded.js";

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
 * #887 — 기록이 댄 백업 자리가 프로젝트 밖인가. 설치 기록은 커밋되는 파일이라 믿을 수 없다(`../`, 밖으로 나가는 폴더 링크) —
 * 밖이면 그 실제 경로, 아니면 null. 옮길 항목이 **놓인 폴더**를 푼다: 백업이 링크면 rename 은 링크 자체를 옮기므로 링크가 가리키는
 * 곳은 묻지 않는다(#839 링크 백업은 밖을 가리켜도 되돌린다). 하네스 백업은 늘 그 자리 옆에 만들어지므로(`backupFile`) 정상
 * 기록은 여기 걸리지 않는다.
 */
function outsideBackup(projectDir: string, backup: string): string | null {
  const abs = join(projectDir, backup);
  const hit = outsideProjectTarget(projectDir, dirname(abs));
  return hit === null ? null : join(hit.target, basename(abs));
}

/**
 * #894 — 기록이 댄 백업이 하네스가 **이 자리에** 만드는 이름(`<자리>.backup-<시각>[-n]`)인가. `notes[0]` 은 커밋되는 기록의 글자라
 * 프로젝트 **안**의 아무 파일(`.env`)도 가리킬 수 있다 — 하네스 백업은 늘 그 자리 옆에 그 이름으로 만들어진다(`backupFile` ·
 * `backupFromCopy` · `backupLink`, 기록은 상대 경로). 글자 그대로 믿지 않고 정규화한 뒤 자리와 맞댄다(`../` · `./` · 중복 구분자).
 * 이름 규칙은 `fs-ops.ts` `backupOriginal` 이 안다.
 */
function isBackupOf(path: string, backup: string): boolean {
  return backupOriginal(posix.normalize(backup)) === posix.normalize(path);
}

/**
 * #807 — 이 displaced 기록이 설치자 파일을 말하지 않는다. v26.162~v26.170 의 update 는 옛 판이 트랙과 무관하게 깔아 둔 하네스 파일
 * (기록 트랙 밖 자리 — tooling 의 `agents/strategist.md` 등)을 첫 접촉으로 읽어 displaced 로 적었다. 그 "원본"(백업 · 백업이 없으면
 * 그 자리)이 옛 판 바이트 그대로면 비켜 둔 설치자 파일이 없다 — 되돌리지 않고(옛 하네스 바이트를 살리지 않는다) 지문 회수를 막지
 * 않는다. 현행 writer 는 기록 트랙 자리만 판정하므로 트랙 안의 displaced 는 기록 그대로다(ADR-097 결정 3·7 · ADR-111).
 * 트랙 판정은 번들 경로로 한다 — `.agents/skills/<id>` 도 `.claude/skills/<id>` 와 같은 답을 낸다.
 */
export function isLegacyDisplaced(
  log: InstallLog,
  projectDir: string,
  f: InstallLogRootFile,
): boolean {
  if (f.change !== "displaced") return false;
  const at = f.notes[0] ?? f.path;
  if (outsideBackup(projectDir, at) !== null) return false; // #887 — 밖은 읽지 않는다(설치자 것으로 둔다)
  let original: string;
  try {
    original = readFileSync(join(projectDir, at), "utf8");
  } catch {
    return false; // 읽지 못한 원본은 설치자 것으로 둔다(지우지 않는 쪽)
  }
  return (
    isLegacyHarnessFile(f.path, hashContent(original)) &&
    !isRecordedTrackTarget(log, bundlePath(f.path))
  );
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
    // #901 — displaced 는 하네스 파일 자리에서만 생긴다. 자리가 글자로든 실경로로든 그 밖이면(`.env` · 링크로 둔 자리 폴더 너머 ·
    // 함께 쓰는 파일) 기록이 대는 백업을 그리로 옮기지 않는다. 하네스가 쓴 기록일 수 없으니 기록도 뺀다(#887 · #894 와 같다)
    if (!inHarnessSlot(projectDir, f.path)) {
      out.push({
        path: f.path,
        backup: f.notes[0] ?? null,
        verdict: "advise",
        line: "not put back — the install record says this tool moved a file of yours aside here, but this is (or leads) outside the places this tool installs to; left it as is",
        forget: true,
      });
      continue;
    }
    // #807 — 원본이 옛 하네스 바이트면 되돌릴 설치자 파일이 없다(백업 없는 자리와 같다 — 조용히 기록만 뺀다)
    const backup = isLegacyDisplaced(log, projectDir, f) ? null : (f.notes[0] ?? null);
    // #887 — 백업이 밖이면 옮기지 않는다(밖 파일을 프로젝트 안으로 끌어오는 것이다). 하네스가 쓴 기록일 수 없으니 기록도 뺀다
    const away = backup === null ? null : outsideBackup(projectDir, backup);
    if (away !== null) {
      out.push({
        path: f.path,
        backup,
        verdict: "advise",
        line: `not put back — the install record points its backup outside this project (${away}); left that file where it is`,
        forget: true,
      });
      continue;
    }
    // #894 — 안쪽 쌍둥이: 이 자리의 백업 이름이 아니면 프로젝트 안 파일이어도 옮기지 않는다(`.env` 를 하네스 자리로 보내는 기록)
    if (backup !== null && !isBackupOf(f.path, backup)) {
      out.push({
        path: f.path,
        backup,
        verdict: "advise",
        line: `not put back — the install record names ${JSON.stringify(backup)} as the backup, which is not a backup this tool made for this file; left that file where it is`,
        forget: true,
      });
      continue;
    }
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

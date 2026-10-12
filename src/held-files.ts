/**
 * #780 BLOCKER (ADR-097 결정 3·5·7 · 설계 v26.170.0 §4.2 · §13 B4) — 외부 스킬 도구(`npx skills add --copy`)는 스킬 폴더를
 * 새로 만든다. 그 폴더에 있던 설치자 파일 · 고친 하네스 파일은 호출 **전에** 사본을 떠 두었다가 호출 **뒤에** 판정한다.
 *
 * **사본은 디스크에, 프로젝트 안 보존 자리(`.uzys-agent-harness/held/<시각>/<원래 경로>`)에 둔다.** 메모리나 `os.tmpdir()`
 * 에 두면 Ctrl-C · 터미널 닫기 · 예외로 실행이 끊길 때 유일한 사본이 함께 사라지거나 아무도 모르는 곳에 남는다(리뷰 P-A ·
 * P-A2 · P-E 재현). 스킬 자리 안에 두면 도구가 폴더째 지운다(실도구 실측). 사본은 그 파일의 판정이 성공한 **뒤에만** 지운다.
 *
 * 끊긴 실행이 남긴 보존 자리는 다음 install · update · uninstall 이 맨 먼저 정리한다(`settleLeftoverHolds`): 원래 자리가
 * 비었으면 제자리로 되돌리고, 차 있으면 그 자리를 덮지 않고 `<path>.backup-<보존 시각>` 으로 둔다.
 */

import { createHash } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { backupFromCopy, formatStamp, listFilesRecursive } from "./fs-ops.js";
import { INSTALL_LOG_DIR } from "./install-log.js";
import { outsideProjectTarget } from "./outside-project.js";

/** 보존 자리(project 상대) — 설치 기록 폴더 안이라 스킬 자리 밖이고, uninstall 이 기록 폴더를 지우기 전에 비운다. */
export const HOLD_DIR = `${INSTALL_LOG_DIR}/held`;

const STAMP_DIR = /^(\d{8}T\d{6})(?:-\d+)?$/;

/**
 * 이번 실행의 보존 자리를 잡는다(`held/<시각>[-n]`). 같은 초에 두 번 잡혀도 서로 섞이지 않게 이름을 하나씩 선점한다.
 * 만들기만 하고 파일이 하나도 안 들어오면 `pruneHoldDir` 가 걷는다.
 */
export function claimHoldDir(projectDir: string, now: Date = new Date()): string {
  const root = join(projectDir, HOLD_DIR);
  mkdirSync(root, { recursive: true });
  const stamp = formatStamp(now);
  for (let n = 1; ; n++) {
    const dir = join(root, n === 1 ? stamp : `${stamp}-${n}`);
    try {
      mkdirSync(dir);
      return dir;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST" || n >= 1000) throw e;
    }
  }
}

/** 보존 자리의 빈 폴더를 아래에서부터 걷는다 — 파일이 남은 폴더(아직 판정 못 한 사본)는 그대로 둔다. `held/` 도 비면 걷는다. */
export function pruneHoldDir(projectDir: string, dir: string): void {
  pruneEmpty(dir);
  const root = join(projectDir, HOLD_DIR);
  if (dir !== root) pruneEmpty(root, false);
}

function pruneEmpty(dir: string, recurse = true): boolean {
  let entries: string[];
  try {
    if (!lstatSync(dir).isDirectory()) return false;
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  let empty = true;
  for (const name of entries) {
    const p = join(dir, name);
    if (recurse && lstatSync(p).isDirectory() && pruneEmpty(p)) continue;
    empty = false;
  }
  if (!empty) return false;
  try {
    rmdirSync(dir);
    return true;
  } catch {
    return false;
  }
}

/** 두 파일의 바이트가 같은가 — 큰 파일을 통째로 메모리에 올리지 않고 조각으로 비교한다. */
export function sameBytes(a: string, b: string): boolean {
  if (statSync(a).size !== statSync(b).size) return false;
  const fa = openSync(a, "r");
  try {
    const fb = openSync(b, "r");
    try {
      const ba = Buffer.alloc(64 * 1024);
      const bb = Buffer.alloc(64 * 1024);
      for (;;) {
        const na = readSync(fa, ba, 0, ba.length, null);
        const nb = readSync(fb, bb, 0, bb.length, null);
        if (na !== nb) return false;
        if (na === 0) return true;
        if (!ba.subarray(0, na).equals(bb.subarray(0, nb))) return false;
      }
    } finally {
      closeSync(fb);
    }
  } finally {
    closeSync(fa);
  }
}

/**
 * 기록 sha 와 같은 방식(`hashContent(readFileSync(p, "utf8"))` — UTF-8 로 읽은 문자열의 sha256)으로, 파일을 통째로 메모리에
 * 올리지 않고 조각으로 잰다. 리뷰 MEDIUM-2 — 1 MiB 를 넘는 안 고친 도구 파일도 기록 sha 와 대조해야 백업 없이 갱신된다.
 * `StringDecoder` 가 조각 경계에 걸린 다바이트 문자를 다음 조각으로 넘긴다(무작위 바이트로 통째 판과 같음을 실측).
 */
export function fileShaUtf8(abs: string): string {
  const hash = createHash("sha256");
  const decoder = new StringDecoder("utf8");
  const fd = openSync(abs, "r");
  try {
    const buf = Buffer.alloc(64 * 1024);
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null);
      if (n === 0) break;
      hash.update(decoder.write(buf.subarray(0, n)), "utf8");
    }
  } finally {
    closeSync(fd);
  }
  hash.update(decoder.end(), "utf8");
  return hash.digest("hex");
}

/** 사본을 제자리로 — 다른 볼륨이면 rename 이 안 되어 복사 뒤 지운다. 대상이 있으면 덮는다(부르는 쪽이 판정한 뒤에만 부른다). */
export function moveFile(from: string, to: string): void {
  mkdirSync(dirname(to), { recursive: true });
  try {
    renameSync(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    copyFileSync(from, to);
    rmSync(from, { force: true });
  }
}

/** 끊긴 실행이 남긴 사본 하나의 정리 결과. `path` = 원래 자리(project 상대). */
export interface LeftoverHold {
  path: string;
  /**
   * `put-back` = 자리가 비어 제자리로 · `backup` = 자리가 차 있어 `backup` 으로 · `unchanged` = 자리에 같은 바이트가 있어
   * 사본만 걷음 · `kept` = 옮기지 못해 사본을 `copy` 에 그대로 둠(`error`).
   */
  outcome: "put-back" | "backup" | "unchanged" | "kept";
  /** `backup` 이면 백업 경로(project 상대). dry-run 이면 이름 규칙대로 예상 경로. */
  backup?: string;
  /** 사본 경로(project 상대) — `kept` 면 설치자가 찾을 자리. */
  copy: string;
  error?: string;
}

/**
 * 끊긴 실행(Ctrl-C · SIGHUP · 예외 · 판정 도중 실패)이 남긴 보존 자리를 정리한다 — install · update · uninstall 이 다른 일을
 * 하기 전에 부른다. 원래 자리가 비었으면 사본을 제자리로 · 같은 바이트가 있으면 사본만 걷고 · 다른 것이 있으면 그 자리를
 * 덮지 않고 `<path>.backup-<보존 시각>` 으로 옮긴다. 옮기지 못한 사본은 그대로 두고(`kept`) 다음 실행이 다시 시도한다.
 * `dryRun` 이면 판정만 하고 디스크를 바꾸지 않는다.
 */
export function settleLeftoverHolds(
  projectDir: string,
  opts: { dryRun?: boolean } = {},
): LeftoverHold[] {
  const root = join(projectDir, HOLD_DIR);
  if (!existsSync(root)) return [];
  const out: LeftoverHold[] = [];
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    const m = STAMP_DIR.exec(name);
    if (m === null || !lstatSync(dir).isDirectory()) continue;
    const when = stampDate(m[1] as string);
    for (const rel of listFilesRecursive(dir)) {
      const copy = join(dir, rel);
      out.push(settleLeftover(projectDir, rel, copy, when, opts.dryRun === true));
    }
    if (opts.dryRun !== true) pruneHoldDir(projectDir, dir);
  }
  return out;
}

function settleLeftover(
  projectDir: string,
  rel: string,
  copy: string,
  when: Date,
  dryRun: boolean,
): LeftoverHold {
  const abs = join(projectDir, rel);
  const copyRel = toRel(projectDir, copy);
  try {
    if (outsideProjectTarget(projectDir, abs) !== null) {
      throw new Error(`${rel} now points outside the project`);
    }
    let occupied = true;
    try {
      lstatSync(abs);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      occupied = false;
    }
    if (!occupied) {
      if (!dryRun) moveFile(copy, abs);
      return { path: rel, outcome: "put-back", copy: copyRel };
    }
    if (lstatSync(abs).isFile() && sameBytes(abs, copy)) {
      if (!dryRun) rmSync(copy, { force: true });
      return { path: rel, outcome: "unchanged", copy: copyRel };
    }
    if (dryRun) {
      return {
        path: rel,
        outcome: "backup",
        backup: `${rel}.backup-${formatStamp(when)}`,
        copy: copyRel,
      };
    }
    const backup = backupFromCopy(abs, copy, when);
    rmSync(copy, { force: true });
    return { path: rel, outcome: "backup", backup: toRel(projectDir, backup), copy: copyRel };
  } catch (e) {
    return {
      path: rel,
      outcome: "kept",
      copy: copyRel,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** 화면 한 줄 — install · update · uninstall 이 같은 말을 한다. `unchanged` 는 잃을 것이 없어 말하지 않는다(null). */
export function leftoverHoldLine(h: LeftoverHold, dryRun = false): string | null {
  const why = "held by an earlier run that stopped before it finished";
  switch (h.outcome) {
    case "put-back":
      return `${dryRun ? "would put back" : "put back"} ${h.path} — ${why}`;
    case "backup":
      return `${h.path} — ${why}; the spot is taken now, so your earlier file ${dryRun ? "would be saved" : "is"} at ${h.backup}`;
    case "kept":
      return `could not put back ${h.path} (${h.error}) — ${why}; the copy stays at ${h.copy}`;
    default:
      return null;
  }
}

function stampDate(stamp: string): Date {
  const n = (from: number, to: number): number => Number(stamp.slice(from, to));
  return new Date(Date.UTC(n(0, 4), n(4, 6) - 1, n(6, 8), n(9, 11), n(11, 13), n(13, 15)));
}

function toRel(projectDir: string, abs: string): string {
  return relative(projectDir, abs).split(sep).join("/");
}

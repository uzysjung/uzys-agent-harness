/**
 * 판정 함수 하나 (#551 · ADR-097 Decision 2 · 설계 `docs/plans/one-principle-design-2026-09-27.md` §1.2).
 *
 * install · update · `--reinstall` · uninstall(전량 · `--cli` · `--only`)은 대상 항목과 `op` 만 다르고 이
 * 함수의 반환값을 실행한다 — 행동 하나 · 화면 한 줄 · 기록에 할 일 하나. **설계 §1.2 의 표가 SSOT 이고
 * 이 파일은 그 표를 옮긴 것이다**(`tests/judge.test.ts` 가 행마다 대조한다). 표와 코드가 갈리면 표가 이긴다.
 *
 * 아직 어느 동작도 이 함수를 부르지 않는다 — 배선은 설계 §9 PR-3(install · reinstall) · PR-5(update) ·
 * PR-7(uninstall). 동작 변경 0.
 */

import { ADAPTERS } from "./adapters/index.js";
import type { Adapter } from "./install-log.js";
import { hashContent } from "./install-log.js";

/** 파일 종류 — 저장하지 않고 유도한다(`kindOf`, `src/recorded.ts`). `tool` 은 자산(`assets[]`)이 만든 파일. */
export type FileKind = "harness" | "shared" | "tool" | "advisory";

export type Verdict =
  | "create"
  | "overwrite"
  | "backup+overwrite"
  | "leave"
  | "leave+advise"
  | "remove"
  | "backup+remove"
  | "upsert-portion"
  | "strip-portion"
  | "advise";

/**
 * 기록에 할 일 — 표의 칸이 적은 기록 부수효과를 호출부가 추측하지 않게 판정이 함께 낸다.
 *
 * - `keep`             기록을 바꾸지 않는다
 * - `sha`              경로와 **지금 디스크에 남을 내용(= next)** 의 sha 를 적는다(쓰기 = 기록)
 * - `displaced`        `rootFiles.change = displaced`, 백업 없음 — 하네스 것으로 삼지 않는다(Q3)
 * - `displaced+sha`    `displaced`(notes[0] = 방금 만든 백업 경로) + 경로·sha(하네스가 자리를 잡았다)
 * - `forget`           경로 기록을 뺀다(하네스가 지웠다 · 이미 없다)
 * - `advisory`         `rootFiles.change = advisory` 로 경로만 적는다
 * - `created`          `rootFiles.change = created` — 하네스가 만든 함께 쓰는 파일(strip 뒤 남는 것이 없으면 파일째
 *                      지우는 근거, 설계 §1.2 shared 행). 몫 자체는 어댑터 결과의 `portions` 로 적는다
 */
export type RecordEffect =
  | "keep"
  | "sha"
  | "displaced"
  | "displaced+sha"
  | "forget"
  | "advisory"
  | "created";

/** 경로 하나에 대한 기록 상태 — `recorded()` 의 반환. */
export interface Recorded {
  state: "none" | "no-sha" | "sha";
  sha256?: string;
}

export interface JudgeInput {
  op: "write" | "remove";
  kind: FileKind;
  rec: Recorded;
  /** 지금 디스크 내용. 없으면 null. */
  disk: string | null;
  /**
   * 이번에 쓰려는 내용(렌더 결과). remove 에서도 넘긴다 — `no-sha` 판정이 "내용이 하네스 것 그대로인가"를
   * 이것으로 본다(N-e). 모르면(도구가 쓸 내용) null — "다르다"로 본다.
   */
  next: string | null;
  /** write 가 어느 동작인가 — 같은 칸 안에서 갈리는 곳(update 의 되살림 문구 · excluded)만 읽는다. 기본 install. */
  run?: "install" | "update";
  /**
   * 이 항목이 `excluded` 에 있는가. write 는 기록 상태와 무관하게 쓰지 않는다(`leave`) — 표는 `sha · 디스크 없음`
   * 의 update 칸에만 적었지만 세 동작 표가 update 대상에서 excluded 를 통째로 뺀다(#551 리뷰 N4).
   */
  excluded?: boolean;
  /** shared 전용 — 이 파일의 어댑터. 파싱 판정(#574)에 쓴다. */
  adapter?: Adapter;
}

export interface Judgement {
  verdict: Verdict;
  /** 화면 한 줄 — 경로 뒤에 붙는 말. 빈 문자열이면 알릴 것이 없다(조용한 판정). */
  line: string;
  record: RecordEffect;
}

/** 화면 문구 — 설계 §4 가 인용한 것은 그대로 쓴다. "edited" 는 기록 sha 와 다를 때만(#557). */
export const LINES = {
  wrote: "wrote",
  restored: "was missing — restored",
  newInRelease: "wrote (new in this release)",
  refreshed: "refreshed",
  sameAsHarness: "kept — already the same as the harness version (left yours in place)",
  hadFile: "had a file with this name — saved as <file>.backup-<time>",
  noChecksum: "no checksum on record — saved a copy once",
  edited: "you edited it — saved as <file>.backup-<time>",
  removed: "removed",
  noChecksumRemoved: "no checksum on record — saved a copy, removed from live",
  editedRemoved: "you edited it — saved as <file>.backup-<time>, removed from live",
  sharedCreated: "wrote (harness part only)",
  upsert: "wrote the harness part — yours stays",
  strip: "removed the harness part — yours stays",
  scaffoldWrote: "wrote — yours from now on",
  scaffoldKept: "kept — already there (yours)",
  leftForYou: "left for you (yours now)",
} as const;

function unreadable(adapter: Adapter, op: "write" | "remove"): string {
  const what = op === "write" ? "harness part not added" : "harness part not removed";
  return `could not read it (${ADAPTERS[adapter].unreadable}) — ${what}`;
}

const j = (verdict: Verdict, line: string, record: RecordEffect): Judgement => ({
  verdict,
  line,
  record,
});

/**
 * 판정. `kind` 별 표:
 *
 * - `harness` · `tool` — 파일 통째. 기록 상태 × 디스크 × (디스크 = next) × (디스크 = 기록 sha). `tool` 은 도구가
 *   쓰고 지우는 파일의 **파일 단위** 판정이고(도구 실행 전 백업 N5 · 되돌리기 뒤 남은 기록 파일) 규칙은 같다.
 * - `shared` — 파일 단위로는 "어댑터로 몫만"(upsert/strip)인지 · 못 읽어 남기는지 · 만들거나 지우는지만 정한다.
 *   키 단위 판정은 어댑터(`src/adapters/contract.ts` `planUpsert`/`planStrip`)가 한다.
 * - `advisory` — 넘겨준 파일. 없을 때만 한 번 쓰고(스캐폴드), 그 뒤로는 알리기만 한다.
 */
export function judge(input: JudgeInput): Judgement {
  switch (input.kind) {
    case "harness":
    case "tool":
      return input.op === "write" ? harnessWrite(input) : harnessRemove(input);
    case "shared":
      return shared(input);
    case "advisory":
      return advisory(input);
  }
}

function sameAsNext(input: JudgeInput): boolean {
  return input.disk !== null && input.next !== null && input.disk === input.next;
}

function sameAsRecord(input: JudgeInput): boolean {
  return (
    input.disk !== null &&
    input.rec.sha256 !== undefined &&
    hashContent(input.disk) === input.rec.sha256
  );
}

function harnessWrite(input: JudgeInput): Judgement {
  const { rec, disk } = input;
  const update = input.run === "update";
  if (input.excluded) return j("leave", "", "keep"); // 설치자가 뺀 것 — 만들지도 갱신하지도 않는다
  if (disk === null) {
    if (rec.state === "none") return j("create", update ? LINES.newInRelease : LINES.wrote, "sha");
    // sha · 디스크 없음: install 은 create, update 는 "was missing — restored".
    // no-sha · 디스크 없음은 표에 행이 없다 — 같은 "기록 있음" 이라 sha 칸을 따른다(인계 문서 §표와 갈린 자리).
    return j("create", update ? LINES.restored : LINES.wrote, "sha");
  }
  if (rec.state === "none") {
    // 첫 접촉(결정 7): 같으면 두고 displaced(백업 없음) · 다르면 그 파일 하나를 백업하고 최신판이 자리를 잡는다.
    return sameAsNext(input)
      ? j("leave", LINES.sameAsHarness, "displaced")
      : j("backup+overwrite", LINES.hadFile, "displaced+sha");
  }
  if (rec.state === "no-sha") {
    return sameAsNext(input)
      ? j("leave", "", "sha")
      : j("backup+overwrite", LINES.noChecksum, "sha");
  }
  if (sameAsNext(input)) return j("leave", "", "sha");
  return sameAsRecord(input)
    ? j("overwrite", LINES.refreshed, "sha")
    : j("backup+overwrite", LINES.edited, "sha");
}

function harnessRemove(input: JudgeInput): Judgement {
  const { rec, disk } = input;
  if (rec.state === "none") return j("leave", "", "keep"); // 기록에 없는 것은 건드리지 않는다
  if (disk === null) return j("leave", "", rec.state === "sha" ? "forget" : "keep"); // 기록만 정리
  if (rec.state === "no-sha") {
    return sameAsNext(input)
      ? j("remove", LINES.removed, "forget")
      : j("backup+remove", LINES.noChecksumRemoved, "forget");
  }
  return sameAsNext(input) || sameAsRecord(input)
    ? j("remove", LINES.removed, "forget")
    : j("backup+remove", LINES.editedRemoved, "forget");
}

function shared(input: JudgeInput): Judgement {
  const { adapter, disk } = input;
  if (adapter === undefined) throw new Error("judge: a shared file needs its adapter");
  if (disk === null) {
    if (input.op === "remove") return j("leave", "", "keep");
    // 파일이 없다 = 만든다. 파일째 사라진 것도 빼 달라는 신호가 아니다(ADR-099 — 빼기는 `--without` · 위저드로만).
    // update 가 실제로 만드는지는 호출부의 refreshOnly 규칙이 정한다.
    return j("create", LINES.sharedCreated, "created");
  }
  if (ADAPTERS[adapter].read(disk) === null) {
    return j("leave+advise", unreadable(adapter, input.op), "keep"); // #574 — 한 바이트도 쓰지 않는다
  }
  return input.op === "write"
    ? j("upsert-portion", LINES.upsert, "keep")
    : j("strip-portion", LINES.strip, "keep");
}

function advisory(input: JudgeInput): Judgement {
  if (input.op === "remove") {
    // 설치자가 이미 지웠으면 말할 것이 없다 — 화면은 실재하는 것만 알린다(#551 리뷰 N1)
    return input.disk === null ? j("leave", "", "keep") : j("advise", LINES.leftForYou, "keep");
  }
  // 도구가 만든 경로(next 없음)는 경로만 기록한다. 스캐폴드는 없을 때만 install 이 한 번 쓴다 —
  // update 는 갱신하지 않는다(설계 §2 행 16·17 의 update 칸 "—").
  if (input.next === null) return j("leave", "", "advisory");
  if (input.disk !== null) return j("leave", LINES.scaffoldKept, "keep");
  if (input.run === "update") return j("leave", "", "keep");
  return j("create", LINES.scaffoldWrote, "advisory");
}

/* ────────────────────────────────────────────────────────────────────────────
 * displaced 되돌리기 (설계 §1.2 "displaced 되돌리기 세부" · R3 · Q3)
 *
 * 하네스가 그 자리를 떠나는 모든 remove(uninstall · update 의 은퇴 회수 · `--reinstall` 의 기록 밖 회수 ·
 * `--cli`)가 **하네스 파일을 지운 뒤** 부른다.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface DisplacedInput {
  /** displaced 기록의 백업 경로(`notes[0]`). null = 백업 없는 displaced(설치자 파일이 그대로 제자리). */
  backup: string | null;
  /** 백업 파일이 지금 디스크에 있는가. */
  backupExists: boolean;
  /** 하네스 파일을 지운 뒤 그 자리가 비었는가. */
  slotEmpty: boolean;
}

export interface DisplacedJudgement {
  /** restore = 백업을 원래 이름으로 옮긴다(rename) · advise = 되돌리지 않고 알린다 · leave = 할 것 없음. */
  verdict: "restore" | "advise" | "leave";
  line: string;
  /** forget = 이 displaced 기록을 지운다 · keep = 남긴다(자리가 막혀 못 되돌렸다). */
  record: "forget" | "keep";
}

export function judgeDisplaced(input: DisplacedInput): DisplacedJudgement {
  if (input.backup === null) return { verdict: "leave", line: "", record: "forget" };
  // 백업 부재를 먼저 본다 — 없는 경로를 "여기 있다" 고 가리키지 않는다(#551 리뷰 N2). 되돌릴 것이 없으니
  // 기록도 지운다(남기면 이후 모든 remove 가 같은 줄을 되풀이한다).
  if (!input.backupExists) {
    return {
      verdict: "advise",
      line: "could not put back your earlier file — its backup is no longer there",
      record: "forget",
    };
  }
  if (!input.slotEmpty) {
    return {
      verdict: "advise",
      line: `not put back — the spot is taken; your earlier file is at ${input.backup}`,
      record: "keep",
    };
  }
  return {
    verdict: "restore",
    line: `put back your earlier file (from ${input.backup})`,
    record: "forget",
  };
}

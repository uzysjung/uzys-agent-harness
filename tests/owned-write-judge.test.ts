/**
 * #797 — owned-write 의 판정이 ADR-097 표(`judge`)와 행마다 같은 결과를 낸다(설계 `docs/plans/796-one-writer-design.md` §4.2 · §4.3).
 *
 * 기대값은 #797 이전 손 판정(if/else)의 결과를 고정한 것이다 — `judge()` 로 바꾼 뒤에도 `OwnedWriteResult` 모양과 디스크 결과가
 * 그대로여야 한다(update 화면이 `backedUp` 을 `checksumOnRecord` 로 다시 가르므로 `no-sha` 백업도 `backedUp` 에 남는다).
 *
 * 축: 기록 상태(기준선 sha 같음 · 기준선 sha 다름 · `owned` 만 = no-sha · 없음) × 디스크(없음 · 같음 · 다름) × 실행(install · update)
 * + 실행 방식 옵션(`createInRefresh` · `backupFirst`).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashContent } from "../src/install-log.js";
import { createOwnedWriter, type WriteOptions } from "../src/owned-write.js";

const REL = "out/a.md";
const OLD = "old harness body\n";
const NEXT = "new harness body\n";

type Rec = "sha-same" | "sha-edited" | "no-sha" | "none";
type Disk = "absent" | "same" | "different";

interface Row {
  rec: Rec;
  disk: Disk;
  update: boolean;
  opts?: WriteOptions;
  /** write() 반환 */
  ret: boolean;
  /** 디스크에 남는 내용(null = 없음) */
  after: string | null;
  backups: number;
  files: boolean;
  backedUp: boolean;
  /** displaced 행: null = 없음 · "plain" = 백업 없음 · "backup" = notes[0] 이 백업 */
  displaced: null | "plain" | "backup";
  restored: boolean;
  updated: number;
}

const ROWS: Row[] = [];
const add = (r: Row): number => ROWS.push(r);

for (const update of [false, true]) {
  // 디스크 없음 — install 은 만든다. update 는 기준선(sha)에 있는 경로만 되살리고, 기록이 열거하지 않으면 건너뛴다.
  for (const rec of ["sha-same", "sha-edited"] as const) {
    add({
      rec,
      disk: "absent",
      update,
      ret: true,
      after: NEXT,
      backups: 0,
      files: true,
      backedUp: false,
      displaced: null,
      restored: update,
      updated: 1,
    });
  }
  for (const rec of ["no-sha", "none"] as const) {
    add(
      update
        ? {
            rec,
            disk: "absent",
            update,
            ret: false,
            after: null,
            backups: 0,
            files: false,
            backedUp: false,
            displaced: null,
            restored: false,
            updated: 0,
          }
        : {
            rec,
            disk: "absent",
            update,
            ret: true,
            after: NEXT,
            backups: 0,
            files: true,
            backedUp: false,
            displaced: null,
            restored: false,
            updated: 1,
          },
    );
    if (update) {
      add({
        rec,
        disk: "absent",
        update,
        opts: { createInRefresh: true },
        ret: true,
        after: NEXT,
        backups: 0,
        files: true,
        backedUp: false,
        displaced: null,
        restored: false,
        updated: 1,
      });
    }
  }
  // 디스크 = 쓸 내용 — 아무것도 안 쓴다. 기록이 있으면(sha · no-sha) 기준선에 싣고, 첫 접촉이면 displaced(백업 없음)만.
  for (const rec of ["sha-same", "no-sha"] as const) {
    add({
      rec,
      disk: "same",
      update,
      ret: true,
      after: NEXT,
      backups: 0,
      files: true,
      backedUp: false,
      displaced: null,
      restored: false,
      updated: 0,
    });
  }
  add({
    rec: "none",
    disk: "same",
    update,
    ret: true,
    after: NEXT,
    backups: 0,
    files: false,
    backedUp: false,
    displaced: "plain",
    restored: false,
    updated: 0,
  });
  // 디스크 ≠ 쓸 내용
  add({
    rec: "sha-same",
    disk: "different",
    update,
    ret: true,
    after: NEXT,
    backups: 0,
    files: true,
    backedUp: false,
    displaced: null,
    restored: false,
    updated: 1,
  });
  add({
    rec: "sha-same",
    disk: "different",
    update,
    opts: { backupFirst: true },
    ret: true,
    after: NEXT,
    backups: 1,
    files: true,
    backedUp: false,
    displaced: null,
    restored: false,
    updated: 1,
  });
  for (const rec of ["sha-edited", "no-sha"] as const) {
    add({
      rec,
      disk: "different",
      update,
      ret: true,
      after: NEXT,
      backups: 1,
      files: true,
      backedUp: true,
      displaced: null,
      restored: false,
      updated: 1,
    });
    // backupFirst 는 백업을 하나 더 만들지 않는다 — 이미 백업하는 판정이다
    add({
      rec,
      disk: "different",
      update,
      opts: { backupFirst: true },
      ret: true,
      after: NEXT,
      backups: 1,
      files: true,
      backedUp: true,
      displaced: null,
      restored: false,
      updated: 1,
    });
  }
  add({
    rec: "none",
    disk: "different",
    update,
    ret: true,
    after: NEXT,
    backups: 1,
    files: true,
    backedUp: false,
    displaced: "backup",
    restored: false,
    updated: 1,
  });
  add({
    rec: "none",
    disk: "different",
    update,
    opts: { backupFirst: true },
    ret: true,
    after: NEXT,
    backups: 1,
    files: true,
    backedUp: false,
    displaced: "backup",
    restored: false,
    updated: 1,
  });
}

let projectDir: string;
beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "owned-write-judge-"));
});
afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
});

const name = (r: Row): string =>
  `${r.update ? "update" : "install"} · rec=${r.rec} · disk=${r.disk}${r.opts ? ` · ${Object.keys(r.opts).join(",")}` : ""}`;

describe("owned-write × judge 표 (#797)", () => {
  it.each(ROWS.map((r) => [name(r), r] as const))("%s", (_n, row) => {
    const abs = join(projectDir, REL);
    const diskBody = row.disk === "same" ? NEXT : OLD;
    if (row.disk !== "absent") {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, diskBody);
    }
    const baseline = new Map<string, string>();
    // sha-same = 기준선이 디스크(디스크 없으면 옛 판) 그대로 · sha-edited = 기준선이 디스크와 다르다(설치자가 고쳤다)
    if (row.rec === "sha-same") baseline.set(REL, hashContent(diskBody));
    if (row.rec === "sha-edited")
      baseline.set(REL, hashContent("something the harness wrote earlier\n"));
    const writer = createOwnedWriter(projectDir, baseline, {
      now: new Date("2026-10-13T00:00:00Z"),
      refreshOnly: row.update,
      owned: (rel) => row.rec === "no-sha" && rel === REL,
    });

    expect(writer.write(abs, NEXT, row.opts)).toBe(row.ret);
    const r = writer.result();

    expect(existsSync(abs) ? readFileSync(abs, "utf8") : null).toBe(row.after);
    expect(r.backupPaths).toHaveLength(row.backups);
    for (const b of r.backupPaths) expect(readFileSync(b, "utf8")).toBe(OLD);
    expect(r.files).toEqual(row.files ? [{ path: REL, sha256: hashContent(NEXT) }] : []);
    expect(r.backedUp).toEqual(row.backedUp ? [REL] : []);
    expect(r.restored).toEqual(row.restored ? [REL] : []);
    expect(r.updated).toBe(row.updated);
    const backupRel = r.backupPaths[0] ? relative(projectDir, r.backupPaths[0]) : undefined;
    expect(r.displaced).toEqual(
      row.displaced === null
        ? []
        : [{ path: REL, change: "displaced", notes: row.displaced === "plain" ? [] : [backupRel] }],
    );
  });
});

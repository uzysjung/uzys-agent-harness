/**
 * 원칙 단위 테스트 — 판정 표 (#551 · ADR-097 · 설계 `docs/plans/one-principle-design-2026-09-27.md` §7A).
 *
 * 기대값은 **설계 §1.2 의 표에서 옮겼다** — 코드에서 읽어 오지 않는다. 표의 행마다 한 줄이고, 줄 끝 주석이
 * 그 칸의 표 문구다. 표와 코드가 갈리면 이 테스트가 빨간불이고, 표가 이긴다.
 */

import { describe, expect, it } from "vitest";
import { ADAPTERS, excludedKeys, keyId } from "../src/adapters/index.js";
import { hashContent } from "../src/install-log.js";
import {
  type DisplacedInput,
  type FileKind,
  type JudgeInput,
  type Judgement,
  judge,
  judgeDisplaced,
  LINES,
  type RecordEffect,
  type Recorded,
  type Verdict,
} from "../src/judge.js";

const OLD = "harness v1\n"; // 기록 sha 가 가리키는 내용(하네스가 지난번에 쓴 것)
const NEXT = "harness v2\n"; // 이번 렌더
const MINE = "installer's own text\n";
const jsonKeysAdapter = ADAPTERS["json-keys"];

const NONE: Recorded = { state: "none" };
const NO_SHA: Recorded = { state: "no-sha" };
const SHA: Recorded = { state: "sha", sha256: hashContent(OLD) };

interface Row {
  row: string;
  kind: FileKind;
  rec: Recorded;
  disk: string | null;
  op: "write" | "remove";
  run?: "install" | "update";
  excluded?: boolean;
  next?: string | null;
  verdict: Verdict;
  record?: RecordEffect;
}

/** §1.2 표 — harness(와 파일 단위 tool) 9행 × op 2열. */
const HARNESS: Row[] = [
  // none · 없음 → write: create · remove: (할 것 없음)
  {
    row: "none/없음",
    kind: "harness",
    rec: NONE,
    disk: null,
    op: "write",
    verdict: "create",
    record: "sha",
  },
  {
    row: "none/없음",
    kind: "harness",
    rec: NONE,
    disk: null,
    op: "remove",
    verdict: "leave",
    record: "keep",
  },
  // none · 있음 · 같다 → write: leave + displaced(백업 없음) · remove: leave
  {
    row: "none/같다",
    kind: "harness",
    rec: NONE,
    disk: NEXT,
    op: "write",
    verdict: "leave",
    record: "displaced",
  },
  {
    row: "none/같다",
    kind: "harness",
    rec: NONE,
    disk: NEXT,
    op: "remove",
    verdict: "leave",
    record: "keep",
  },
  // none · 있음 · 다르다 → write: backup+overwrite + displaced(백업 경로) · remove: 기록에 없으니 leave
  {
    row: "none/다르다",
    kind: "harness",
    rec: NONE,
    disk: MINE,
    op: "write",
    verdict: "backup+overwrite",
    record: "displaced+sha",
  },
  {
    row: "none/다르다",
    kind: "harness",
    rec: NONE,
    disk: MINE,
    op: "remove",
    verdict: "leave",
    record: "keep",
  },
  // no-sha · 있음 · 같다 → write: leave + 기록에 sha · remove: remove
  {
    row: "no-sha/같다",
    kind: "harness",
    rec: NO_SHA,
    disk: NEXT,
    op: "write",
    verdict: "leave",
    record: "sha",
  },
  {
    row: "no-sha/같다",
    kind: "harness",
    rec: NO_SHA,
    disk: NEXT,
    op: "remove",
    verdict: "remove",
    record: "forget",
  },
  // no-sha · 있음 · 다르다 → write: backup+overwrite · remove: backup+remove
  {
    row: "no-sha/다르다",
    kind: "harness",
    rec: NO_SHA,
    disk: MINE,
    op: "write",
    verdict: "backup+overwrite",
    record: "sha",
  },
  {
    row: "no-sha/다르다",
    kind: "harness",
    rec: NO_SHA,
    disk: MINE,
    op: "remove",
    verdict: "backup+remove",
    record: "forget",
  },
  // sha · 없음 → install: create · update: create(restored) · excluded 면 leave · remove: 기록만 정리
  {
    row: "sha/없음",
    kind: "harness",
    rec: SHA,
    disk: null,
    op: "write",
    run: "install",
    verdict: "create",
    record: "sha",
  },
  {
    row: "sha/없음",
    kind: "harness",
    rec: SHA,
    disk: null,
    op: "write",
    run: "update",
    verdict: "create",
    record: "sha",
  },
  {
    row: "sha/없음",
    kind: "harness",
    rec: SHA,
    disk: null,
    op: "write",
    run: "update",
    excluded: true,
    verdict: "leave",
    record: "keep",
  },
  {
    row: "sha/없음",
    kind: "harness",
    rec: SHA,
    disk: null,
    op: "remove",
    verdict: "leave",
    record: "forget",
  },
  // sha · 있음 · 같다 → leave · remove
  { row: "sha/같다", kind: "harness", rec: SHA, disk: NEXT, op: "write", verdict: "leave" },
  {
    row: "sha/같다",
    kind: "harness",
    rec: SHA,
    disk: NEXT,
    op: "remove",
    verdict: "remove",
    record: "forget",
  },
  // sha · 있음 · 다르다 · 기록 sha 와 같다 → overwrite(조용히) · remove
  {
    row: "sha/다르다/sha같다",
    kind: "harness",
    rec: SHA,
    disk: OLD,
    op: "write",
    verdict: "overwrite",
    record: "sha",
  },
  {
    row: "sha/다르다/sha같다",
    kind: "harness",
    rec: SHA,
    disk: OLD,
    op: "remove",
    verdict: "remove",
    record: "forget",
  },
  // sha · 있음 · 다르다 · 기록 sha 와 다르다 → backup+overwrite · backup+remove(결정 4)
  {
    row: "sha/다르다/sha다르다",
    kind: "harness",
    rec: SHA,
    disk: MINE,
    op: "write",
    verdict: "backup+overwrite",
    record: "sha",
  },
  {
    row: "sha/다르다/sha다르다",
    kind: "harness",
    rec: SHA,
    disk: MINE,
    op: "remove",
    verdict: "backup+remove",
    record: "forget",
  },
];

function run(r: Row): Judgement {
  const input: JudgeInput = {
    op: r.op,
    kind: r.kind,
    rec: r.rec,
    disk: r.disk,
    next: r.next === undefined ? NEXT : r.next,
    ...(r.run ? { run: r.run } : {}),
    ...(r.excluded ? { excluded: true } : {}),
  };
  return judge(input);
}

describe("judge — harness 파일(설계 §1.2 표)", () => {
  it.each(
    HARNESS.map(
      (r) =>
        [
          `${r.row} · ${r.op}${r.run ? ` · ${r.run}` : ""}${r.excluded ? " · excluded" : ""}`,
          r,
        ] as const,
    ),
  )("%s", (_, r) => {
    const got = run(r);
    expect(got.verdict).toBe(r.verdict);
    if (r.record) expect(got.record).toBe(r.record);
  });

  it("tool 파일은 파일 단위로 같은 규칙이다 — 도구 실행 전 기록 sha 와 다른 기록 파일만 백업(N5)", () => {
    for (const r of HARNESS) expect(run({ ...r, kind: "tool" }).verdict).toBe(r.verdict);
    // 도구가 쓸 내용을 모르면(next = null): 안 고친 기록 파일은 조용히, 고친 것은 백업 후 도구가 덮는다
    const pre = (disk: string) => judge({ op: "write", kind: "tool", rec: SHA, disk, next: null });
    expect(pre(OLD).verdict).toBe("overwrite");
    expect(pre(MINE).verdict).toBe("backup+overwrite");
  });

  it("문구 — 체크섬 없는 첫 백업은 '편집'이라 부르지 않는다(#557) · 첫 접촉은 'had a file with this name'", () => {
    const noSha = run({
      row: "",
      kind: "harness",
      rec: NO_SHA,
      disk: MINE,
      op: "write",
      verdict: "backup+overwrite",
    });
    expect(noSha.line).toBe("no checksum on record — saved a copy once");
    expect(noSha.line).not.toMatch(/edit/);
    const first = run({
      row: "",
      kind: "harness",
      rec: NONE,
      disk: MINE,
      op: "write",
      verdict: "backup+overwrite",
    });
    expect(first.line).toMatch(/^had a file with this name — saved as /);
    expect(first.line).not.toMatch(/edit/);
    const edited = run({
      row: "",
      kind: "harness",
      rec: SHA,
      disk: MINE,
      op: "write",
      verdict: "backup+overwrite",
    });
    expect(edited.line).toMatch(/you edited it/);
  });

  it("update 가 되살리는 하네스 파일은 'was missing — restored' 로 말한다", () => {
    const restored = run({
      row: "",
      kind: "harness",
      rec: SHA,
      disk: null,
      op: "write",
      run: "update",
      verdict: "create",
    });
    expect(restored.line).toBe(LINES.restored);
    const install = run({
      row: "",
      kind: "harness",
      rec: SHA,
      disk: null,
      op: "write",
      run: "install",
      verdict: "create",
    });
    expect(install.line).toBe(LINES.wrote);
  });
});

describe("judge — 함께 쓰는 파일(설계 §1.2 shared 행)", () => {
  const base = { kind: "shared" as const, rec: NONE, next: "{}\n", adapter: "json-keys" as const };

  it("디스크 없음: install 은 create · update 는 기록에 키가 있으면 만들지 않고 excluded 로(Q4) · 없으면 create · remove 는 할 것 없음", () => {
    expect(judge({ ...base, op: "write", disk: null, run: "install" }).verdict).toBe("create");
    const deleted = judge({ ...base, op: "write", disk: null, run: "update", hasPortions: true });
    expect([deleted.verdict, deleted.record]).toEqual(["leave", "exclude-portions"]);
    expect(
      judge({ ...base, op: "write", disk: null, run: "update", hasPortions: false }).verdict,
    ).toBe("create");
    expect(judge({ ...base, op: "remove", disk: null }).verdict).toBe("leave");
  });

  it("디스크 있음: 파싱 성공 → upsert-portion / strip-portion", () => {
    expect(judge({ ...base, op: "write", disk: '{"a":1}' }).verdict).toBe("upsert-portion");
    expect(judge({ ...base, op: "remove", disk: '{"a":1}' }).verdict).toBe("strip-portion");
  });

  it.each([
    ["json-keys", '{ "mcpServers": { broken'],
    ["toml-region", "approval_policy never\n"],
    ["marker-md", "<!-- uzys-harness:import:start -->\n@x\n"],
  ] as const)("파싱 실패(%s) → 세 동작 모두 leave+advise(#574)", (adapter, disk) => {
    for (const op of ["write", "remove"] as const) {
      const got = judge({ kind: "shared", rec: NONE, next: "x", adapter, op, disk });
      expect(got.verdict).toBe("leave+advise");
      expect(got.line).toMatch(/^could not read it \(/);
    }
  });

  it("어댑터를 모르는 shared 판정은 조용히 넘어가지 않는다", () => {
    expect(() => judge({ kind: "shared", rec: NONE, next: "x", op: "write", disk: "x" })).toThrow(
      /adapter/,
    );
  });
});

describe("judge — advisory(스캐폴드 · 도구 산출물)", () => {
  it("스캐폴드: 없을 때만 install 이 한 번 쓴다 · 있으면 kept · update 는 건드리지 않는다 · uninstall 은 알리기만", () => {
    const a = { kind: "advisory" as const, rec: NONE, next: "ci" };
    expect(judge({ ...a, op: "write", disk: null })).toMatchObject({
      verdict: "create",
      record: "advisory",
    });
    expect(judge({ ...a, op: "write", disk: "mine" })).toMatchObject({
      verdict: "leave",
      line: LINES.scaffoldKept,
    });
    expect(judge({ ...a, op: "write", disk: null, run: "update" }).verdict).toBe("leave");
    expect(judge({ ...a, op: "remove", disk: "ci" })).toMatchObject({
      verdict: "advise",
      line: LINES.leftForYou,
    });
  });

  it("도구 산출물(next 없음): 경로만 기록", () => {
    expect(
      judge({ kind: "advisory", rec: NONE, next: null, op: "write", disk: "x" }),
    ).toMatchObject({
      verdict: "leave",
      record: "advisory",
    });
  });
});

describe("judge — R2 · R3 (배선 전이라 판정 수준에서)", () => {
  it("R2 — 설치자가 지운 하네스 키는 excluded 로 가고 다음 update 에도 돌아오지 않는다", () => {
    const path = ".mcp.json";
    const render = new Map<string, unknown>([["mcpServers.github", { command: "gh" }]]);
    const first = jsonKeysAdapter.upsert("{}", {
      render,
      recorded: new Map(),
      excluded: new Set(),
    });
    if (!first.ok) throw new Error("unexpected");
    // 설치자가 github 서버를 지웠다
    const afterDelete = "{}\n";
    const second = jsonKeysAdapter.upsert(afterDelete, {
      render,
      recorded: first.portions,
      excluded: new Set(),
    });
    if (!second.ok) throw new Error("unexpected");
    expect(second.deleted).toEqual(["mcpServers.github"]);
    expect(second.text).toBe(afterDelete); // 되살리지 않았다
    const excluded = second.deleted.map((k) => keyId(path, k));
    expect(excluded).toEqual(["mcp:github"]);
    // 두 번째 update — 기록에서 빠진 키를 "신규"로 읽어 되살리지 않는다(excluded 가 막는다)
    const third = jsonKeysAdapter.upsert(second.text, {
      render,
      recorded: second.portions,
      excluded: excludedKeys(
        path,
        excluded.filter((x): x is string => x !== null),
      ),
    });
    if (!third.ok) throw new Error("unexpected");
    expect(third.text).toBe(afterDelete);
    expect(third.deleted).toEqual([]);
  });

  it("R3 — 첫 접촉으로 비켜 둔 설치자 파일은 하네스가 떠난 뒤 제자리다", () => {
    // 아주 작은 실행기: 판정만 보고 디스크(맵)를 바꾼다 — 호출부가 할 일 그대로
    const disk = new Map<string, string>([["rules/x.md", MINE]]);
    const backup = "rules/x.md.backup-20260927T000000";
    const w = judge({
      op: "write",
      kind: "harness",
      rec: NONE,
      disk: disk.get("rules/x.md") ?? null,
      next: NEXT,
    });
    expect([w.verdict, w.record]).toEqual(["backup+overwrite", "displaced+sha"]);
    disk.set(backup, disk.get("rules/x.md") ?? "");
    disk.set("rules/x.md", NEXT);
    const rec: Recorded = { state: "sha", sha256: hashContent(NEXT) };

    const r = judge({
      op: "remove",
      kind: "harness",
      rec,
      disk: disk.get("rules/x.md") ?? null,
      next: NEXT,
    });
    expect(r.verdict).toBe("remove");
    disk.delete("rules/x.md");

    const d = judgeDisplaced({
      backup,
      backupExists: disk.has(backup),
      slotEmpty: !disk.has("rules/x.md"),
    });
    expect(d).toMatchObject({ verdict: "restore", record: "forget" });
    disk.set("rules/x.md", disk.get(backup) ?? "");
    disk.delete(backup);
    expect([...disk]).toEqual([["rules/x.md", MINE]]);
  });

  it.each([
    [{ backup: null, backupExists: false, slotEmpty: true }, "leave", "forget"],
    [{ backup: "a.backup-1", backupExists: true, slotEmpty: false }, "advise", "keep"],
    [{ backup: "a.backup-1", backupExists: false, slotEmpty: true }, "advise", "forget"],
    [{ backup: "a.backup-1", backupExists: true, slotEmpty: true }, "restore", "forget"],
  ] as const)("displaced 되돌리기 판정 %o → %s", (input: DisplacedInput, verdict, record) => {
    expect(judgeDisplaced(input)).toMatchObject({ verdict, record });
  });
});

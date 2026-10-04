/**
 * `marker-md` — 루트 `CLAUDE.md` · `AGENTS.md` (#551 · ADR-097 §6.2).
 *
 * 몫의 키 = 마커 블록 이름(`import` · `agents` · `anchor` · `skills` …), 값 = 블록 본문. 마커 형식은
 * `agents-md-merge.ts` 의 `marker` 가 SSOT 이고(`<!-- uzys-harness:<name>:start -->`), 루트 `CLAUDE.md` 의
 * import 블록도 같은 형식이다.
 *
 * 지금 코드(`upsertHarnessImport` · `stripHarnessImport`)는 호출부를 그대로 둔 채 남는다 — 그 짝은 끝
 * 개행이 없는 파일에서 원본으로 돌아오지 않는다(`"x"` → 붙였다 빼면 `"x\n"`). 이 어댑터는 붙이기·빼기를
 * `text-runs.ts` 한 짝으로 해서 **바이트 동일**을 지킨다. 배선(어느 파일에 어느 블록을)은 PR-3 · PR-4 다 —
 * `AGENTS.md` 의 하네스가 만든 파일(절 모델, `mergeAgentsMd`)과 첫 접촉(이 블록 모델)의 분기는 PR-4.
 *
 * 블록은 마커가 **한 줄을 통째로** 차지할 때만 블록이다. 같은 이름이 두 번 나오거나 · 시작만 있고 끝이
 * 없거나 · 블록 안에 블록이 열리면 **읽지 못한 파일**이다 — 한 바이트도 쓰지 않는다(ⓐ).
 */

import { marker, wrapHarnessBlock } from "../agents-md-merge.js";
import { hashContent } from "../install-log.js";
import {
  type PortionAdapter,
  planStrip,
  planUpsert,
  type StripResult,
  type UpsertResult,
} from "./contract.js";
import { appendRun, applyEdits, type Edit, parseRegions, type Region } from "./text-runs.js";

const MARKER_LINE = /^<!-- uzys-harness:([A-Za-z0-9_-]+):(start|end) -->$/;

function parseBlocks(text: string): Map<string, Region> | null {
  return parseRegions(text, MARKER_LINE);
}

function blockText(name: string, body: string): string {
  return wrapHarnessBlock(marker(name), body);
}

/** CRLF 로 체크아웃돼도 같은 블록으로 읽는다(#551 리뷰 N6) — 안 그러면 "설치자가 고쳤다" 로 읽혀 갱신도 회수도 안 된다. */
function normEol(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\r$/, "");
}

function shas(blocks: ReadonlyMap<string, Region>): Map<string, string> {
  return new Map([...blocks].map(([k, b]) => [k, hashContent(normEol(b.body))]));
}

function at<T>(map: ReadonlyMap<string, T>, key: string): T {
  const v = map.get(key);
  if (v === undefined) throw new Error(`marker-md: no entry for ${key}`);
  return v;
}

const UNREADABLE = "harness markers are broken";

export const markerMd: PortionAdapter<string> = {
  unreadable: UNREADABLE,

  read(text, keys) {
    const blocks = parseBlocks(text);
    if (blocks === null) return null;
    const all = shas(blocks);
    return keys === undefined
      ? all
      : new Map([...keys].flatMap((k) => (all.has(k) ? [[k, at(all, k)] as const] : [])));
  },

  upsert(existing, input): UpsertResult {
    const fresh = existing === null;
    const base = existing ?? input.seed ?? "";
    const blocks = parseBlocks(base);
    if (blocks === null) return { ok: false, reason: UNREADABLE };
    const plan = planUpsert({
      render: new Map([...input.render].map(([k, v]) => [k, hashContent(v)])),
      recorded: fresh ? new Map() : input.recorded,
      present: shas(blocks),
      excluded: input.excluded,
    });
    const edits: Edit[] = [
      ...plan.replace.map((k) => {
        const b = at(blocks, k);
        const run = `${blockText(k, at(input.render, k))}${b.newline ? "\n" : ""}`;
        return { start: b.start, end: b.end, replacement: run };
      }),
      ...plan.remove.map((k) => ({
        start: at(blocks, k).start,
        end: at(blocks, k).end,
        replacement: null,
      })),
    ];
    let text = applyEdits(base, edits);
    for (const k of plan.add) text = appendRun(text, blockText(k, at(input.render, k)));
    return {
      ok: true,
      text,
      changed: fresh || text !== base,
      portions: plan.portions,
      restored: plan.restored,
      missing: plan.missing,
      removed: plan.remove,
      removedEdited: plan.removedEdited,
      replaced: plan.replace,
      kept: plan.kept,
    };
  },

  strip(existing, input): StripResult {
    const blocks = parseBlocks(existing);
    if (blocks === null) return { ok: false, reason: UNREADABLE };
    const plan = planStrip({
      recorded: input.recorded,
      present: shas(blocks),
      excluded: input.excluded,
    });
    const text = applyEdits(
      existing,
      plan.remove.map((k) => ({
        start: at(blocks, k).start,
        end: at(blocks, k).end,
        replacement: null,
      })),
    );
    return {
      ok: true,
      text,
      changed: text !== existing,
      removed: plan.remove,
      kept: plan.kept,
      portions: plan.portions,
      empty: text.trim() === "",
    };
  },
};

/**
 * `lines` — `.gitignore` (#551 · ADR-097 §6.2).
 *
 * 몫의 키 = 줄 원문(`.env` · `.factory/`), 값 = 그 줄 **앞에 딸린 주석 줄 + 그 줄**(설계: "`gitignore:` 의
 * 주석 줄은 뒤따르는 줄의 몫에 딸리고 따로 id 를 갖지 않는다"). 예: `"# Secret env (…)\n.env"`.
 *
 * 기록에는 sha 만 남는다 — 빼거나 바꿀 때 어디까지가 그 몫인지는 키 줄 바로 위의 주석 줄을 0개부터
 * 늘려 가며 **기록 sha 와 맞는 범위**로 찾는다. 맞는 범위가 없으면 설치자가 고친 것이다(남기고 알린다).
 * 새 줄은 한 번에 모아 파일 끝에 붙인다(`text-runs.ts` 규칙 — 빼면 바이트 동일).
 *
 * 기존 `env-files.ts` 의 `addGitignoreEnv` · `addGitignoreAgentArtifacts` 는 호출부 그대로 남는다(더하기만
 * 있고 빼기가 없다 — #569). 배선은 PR-3.
 */

import { hashContent } from "../install-log.js";
import {
  type PortionAdapter,
  planStrip,
  planUpsert,
  type StripResult,
  type UpsertResult,
} from "./contract.js";
import { appendRun, applyEdits, type Edit, type Line, splitLines } from "./text-runs.js";

interface Extent {
  start: number;
  end: number;
  sha: string;
}

function norm(line: string): string {
  return line.trimEnd();
}

/**
 * 키 줄의 몫 범위. `want` 가 있으면 그 sha 와 맞는 범위를 찾고(없으면 키 줄 하나를 "고쳐진 몫"으로),
 * 없으면 키 줄 하나. 같은 줄이 여럿이면 뒤의 것부터 본다 — 하네스는 파일 끝에 붙인다.
 */
function extentOf(lines: ReadonlyArray<Line>, key: string, want?: string): Extent | undefined {
  let bare: Extent | undefined;
  for (let i = lines.length - 1; i >= 0; i--) {
    const keyLine = lines[i];
    if (keyLine === undefined || norm(keyLine.text) !== key) continue;
    for (let from = i; from >= 0; from--) {
      const first = lines[from];
      if (first === undefined) break;
      if (from < i && !first.text.trimStart().startsWith("#")) break; // 딸린 주석은 바로 위 주석 줄뿐
      const text = lines
        .slice(from, i + 1)
        .map((l) => norm(l.text))
        .join("\n");
      const extent = { start: first.start, end: keyLine.end, sha: hashContent(text) };
      bare ??= extent;
      if (want === undefined) return extent;
      if (extent.sha === want) return extent;
    }
  }
  return bare;
}

function presentFor(
  lines: ReadonlyArray<Line>,
  keys: Iterable<string>,
  recorded: ReadonlyMap<string, string>,
): Map<string, Extent> {
  const out = new Map<string, Extent>();
  for (const k of keys) {
    const e = extentOf(lines, k, recorded.get(k));
    if (e) out.set(k, e);
  }
  return out;
}

function shaMap(m: ReadonlyMap<string, Extent>): Map<string, string> {
  return new Map([...m].map(([k, e]) => [k, e.sha]));
}

function at<T>(map: ReadonlyMap<string, T>, key: string): T {
  const v = map.get(key);
  if (v === undefined) throw new Error(`lines: no entry for ${key}`);
  return v;
}

export const lines: PortionAdapter<string> = {
  unreadable: "unreadable",

  read(text, keys) {
    const ls = splitLines(text);
    const all = keys ?? ls.map((l) => norm(l.text)).filter((t) => t !== "" && !t.startsWith("#"));
    return shaMap(presentFor(ls, all, new Map()));
  },

  upsert(existing, input): UpsertResult {
    const fresh = existing === null;
    const base = existing ?? input.seed ?? "";
    const ls = splitLines(base);
    const recorded = fresh ? new Map<string, string>() : input.recorded;
    const found = presentFor(ls, [...recorded.keys(), ...input.render.keys()], recorded);
    const plan = planUpsert({
      render: new Map([...input.render].map(([k, v]) => [k, hashContent(v)])),
      recorded,
      present: shaMap(found),
      excluded: input.excluded,
    });
    const edits: Edit[] = [
      ...plan.replace.map((k) => {
        const e = at(found, k);
        const newline = base[e.end - 1] === "\n" ? "\n" : "";
        return { start: e.start, end: e.end, replacement: `${at(input.render, k)}${newline}` };
      }),
      ...plan.remove.map((k) => ({
        start: at(found, k).start,
        end: at(found, k).end,
        replacement: null,
      })),
    ];
    let text = applyEdits(base, edits);
    if (plan.add.length > 0) {
      text = appendRun(text, plan.add.map((k) => at(input.render, k)).join("\n"));
    }
    return {
      ok: true,
      text,
      changed: fresh || text !== base,
      portions: plan.portions,
      restored: plan.restored,
      missing: plan.missing,
      kept: plan.kept,
    };
  },

  strip(existing, input): StripResult {
    const ls = splitLines(existing);
    const found = presentFor(ls, input.recorded.keys(), input.recorded);
    const plan = planStrip({
      recorded: input.recorded,
      present: shaMap(found),
      excluded: input.excluded,
    });
    const text = applyEdits(
      existing,
      plan.remove.map((k) => ({
        start: at(found, k).start,
        end: at(found, k).end,
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

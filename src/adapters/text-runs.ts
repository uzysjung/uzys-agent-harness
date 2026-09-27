/**
 * 줄 단위 텍스트 편집 — `marker-md` · `lines` · `toml-region` 이 공유한다 (#551 · ADR-097).
 *
 * 세 어댑터의 약속은 **upsert∘strip = 설치자 원본**이다(`marker-md` · `lines` 는 바이트 동일). 그러려면
 * 붙이는 규칙과 빼는 규칙이 서로의 정확한 역이어야 하고, 그 짝을 한 곳에만 둔다:
 *
 *   붙이기(파일 끝)  : ""        → run
 *                      "…"       → "…" + "\n" + run      (끝 개행이 있든 없든 "\n" 하나를 앞에 둔다)
 *   끼우기(줄 시작)  : 앞 + run + 뒤                      (구분 줄 없음)
 *   빼기            : 파일 끝에 닿는 구간은 앞의 "\n" 하나도 함께 뺀다. 가운데 구간은 그것만 뺀다.
 *
 * 끝 개행이 없는 `"x"` 는 `"x\n" + run` 이 되고 빼면 `"x"` 로, 끝 개행이 있는 `"x\n"` 은 빈 줄 하나를
 * 사이에 두고 붙었다가 `"x\n"` 로 돌아온다 — 두 입력이 같은 출력을 내지 않으므로(단사) 되돌릴 수 있다.
 * 구간을 **뒤에서부터** 빼는 이유: 여러 번에 걸쳐 파일 끝에 붙은 run 들은 마지막 것을 빼야 그 앞의
 * 것이 파일 끝이 된다.
 */

/** 한 줄 — `start`/`end` 는 원문 오프셋(`end` 는 줄바꿈 포함), `text` 는 줄바꿈·`\r` 제외. */
export interface Line {
  start: number;
  end: number;
  text: string;
}

export function splitLines(text: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  while (start < text.length) {
    const nl = text.indexOf("\n", start);
    const end = nl === -1 ? text.length : nl + 1;
    const raw = text.slice(start, nl === -1 ? text.length : nl);
    out.push({ start, end, text: raw.endsWith("\r") ? raw.slice(0, -1) : raw });
    start = end;
  }
  return out;
}

/** run 이 개행으로 끝나게 한다 — 붙이는 단위는 항상 완결된 줄들이다. */
function asRun(run: string): string {
  return run.endsWith("\n") ? run : `${run}\n`;
}

export function appendRun(text: string, run: string): string {
  return text === "" ? asRun(run) : `${text}\n${asRun(run)}`;
}

/** `pos` 는 줄 시작 오프셋이어야 한다. */
export function insertRun(text: string, pos: number, run: string): string {
  return `${text.slice(0, pos)}${asRun(run)}${text.slice(pos)}`;
}

/** 원문 구간 하나의 편집 — `replacement === null` 이면 뺀다. 구간은 줄 경계여야 하고 서로 겹치지 않는다. */
export interface Edit {
  start: number;
  end: number;
  replacement: string | null;
}

/**
 * 편집을 뒤에서부터 적용한다. 맞닿은 빼기는 한 구간으로 합친다 — 따로 빼면 뒤 구간의 "앞 개행"
 * 규칙이 앞 구간의 끝 개행을 먹는다.
 */
export function applyEdits(text: string, edits: ReadonlyArray<Edit>): string {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  const merged: Edit[] = [];
  for (const e of sorted) {
    const last = merged.at(-1);
    if (last && last.replacement === null && e.replacement === null && last.end === e.start) {
      last.end = e.end;
    } else {
      merged.push({ ...e });
    }
  }
  let out = text;
  for (const e of merged.reverse()) {
    if (e.replacement !== null) {
      out = `${out.slice(0, e.start)}${e.replacement}${out.slice(e.end)}`;
    } else if (e.end >= out.length && e.start > 0 && out[e.start - 1] === "\n") {
      out = out.slice(0, e.start - 1);
    } else {
      out = `${out.slice(0, e.start)}${out.slice(e.end)}`;
    }
  }
  return out;
}

/** 마커로 감싼 하네스 구간 — `start`/`end` 는 시작 마커 줄의 시작 ~ 끝 마커 줄의 끝(개행 포함). */
export interface Region {
  start: number;
  end: number;
  body: string;
  /** 끝 마커 줄 뒤에 개행이 있었나 — 갈아 끼울 때 그대로 둔다. */
  newline: boolean;
}

/**
 * 마커 구간을 찾는다. 마커는 **한 줄을 통째로** 차지할 때만 마커다(`markerLine` 은 trim 한 줄에 대고
 * `(이름)(start|end)` 두 그룹을 잡는다). 같은 이름이 두 번 · 시작만 있고 끝이 없음 · 구간 안에서 다른
 * 구간이 열림 → **읽지 못한 파일**(`null`) — 한 바이트도 쓰지 않는다.
 */
export function parseRegions(text: string, markerLine: RegExp): Map<string, Region> | null {
  const regions = new Map<string, Region>();
  let open: { name: string; start: number; bodyStart: number } | null = null;
  for (const line of splitLines(text)) {
    const m = markerLine.exec(line.text.trim());
    if (!m) continue;
    const [, name = "", edge] = m;
    if (edge === "start") {
      if (open !== null || regions.has(name)) return null;
      open = { name, start: line.start, bodyStart: line.end };
      continue;
    }
    if (open === null || open.name !== name) return null;
    const raw = text.slice(open.bodyStart, line.start);
    regions.set(name, {
      start: open.start,
      end: line.end,
      body: raw.endsWith("\n") ? raw.slice(0, -1) : raw,
      newline: text[line.end - 1] === "\n",
    });
    open = null;
  }
  return open === null ? regions : null;
}

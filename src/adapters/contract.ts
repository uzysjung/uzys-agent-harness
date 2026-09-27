/**
 * 함께 쓰는 파일의 어댑터 계약 (#551 · ADR-097 · 설계 `docs/plans/one-principle-design-2026-09-27.md` §6.2).
 *
 * 어댑터 넷(`marker-md` · `json-keys` · `toml-region` · `lines`)은 **파일 형식만** 다르고, 키마다 무엇을
 * 할지는 여기 `planUpsert` · `planStrip` 한 벌이 정한다 — 규칙이 어댑터마다 따로 살면 한 곳만 고쳐졌을
 * 때 조용히 갈린다(`owned-write.ts` 서문과 같은 이유).
 *
 * 공통 규칙(§6.2):
 *   ⓐ 파일을 파싱하지 못하면 **한 바이트도 쓰지 않는다** — `{ ok: false }` (#574).
 *   ⓑ 몫은 키 단위. 키 sha = 기록 → 갱신/회수 · 다르면 남기고 알린다 · 기록에 없으면 설치자 것.
 *      설치 전에 이미 있던 키는 값이 하네스 판과 같아도 기록하지 않는다(Q3).
 *   ⓒ 기록에 있는데 파일에 없는 키 = 설치자가 지웠다 → 되살리지 않고 `deleted` 로 낸다(호출부가
 *      `excluded` 에 키 id 로 적는다, R2). excluded 키는 더하지 않는다.
 *   ⓓ strip 은 **기록된 키만** 뺀다 — 내용 식별은 쓰지 않는다(R3).
 */

/** 이 파일에 대해 기록된 몫 — key → sha256. */
export type PortionShas = ReadonlyMap<string, string>;

export interface UpsertInput<V> {
  /** 이번 렌더의 하네스 몫(key → 값). 순서가 새로 붙이는 순서다. */
  render: ReadonlyMap<string, V>;
  /**
   * 기록된 이 파일의 몫. 옛 로그(몫 기록 이전)는 호출부가 §5 의 내용 식별로 채워 넘긴다 —
   * 어댑터는 내용 식별을 하지 않는다(R3). 파일이 없을 때(`existing === null`)는 읽지 않는다.
   */
  recorded: PortionShas;
  /** `excluded` 중 이 파일의 키(어댑터 키로 바꾼 것 — `excludedKeys`). */
  excluded: ReadonlySet<string>;
  /**
   * 파일을 **새로 만들 때만** 하네스 몫 앞에 둘 본문(컨텍스트 파일의 스캐폴드 등). 몫이 아니다 —
   * 쓰이는 순간 설치자 것이고, strip 은 건드리지 않는다.
   */
  seed?: string;
}

export interface StripInput {
  recorded: PortionShas;
  excluded: ReadonlySet<string>;
}

export interface Unreadable {
  ok: false;
  /** 화면용 — "invalid JSON" 같은 형태. */
  reason: string;
}

export interface UpsertOk {
  ok: true;
  /** 쓸 내용. `changed === false` 면 입력과 바이트 동일(= 쓰지 않아도 된다). */
  text: string;
  changed: boolean;
  /** 쓴 뒤 이 파일에 대해 기록할 몫 전체. */
  portions: Map<string, string>;
  /** 기록에 있었는데 파일에 없던 키 — 설치자가 지웠다. 되살리지 않았다 → 호출부가 excluded 로(R2). */
  deleted: string[];
  /** 설치자 값이 이겨 하네스 판을 쓰지 않은 키 — 화면이 "kept yours" 로 알린다. */
  kept: string[];
}

export interface StripOk {
  ok: true;
  text: string;
  changed: boolean;
  /** 뺀 키. */
  removed: string[];
  /** 기록에 있지만 설치자가 고쳐서 남긴 키 — 화면이 알린다. */
  kept: string[];
  /** strip 뒤에도 남는 몫(= `kept`). 기록은 이것만 이어간다. */
  portions: Map<string, string>;
  /** 남는 내용이 없다 — `rootFiles.change === "created"` 인 파일이면 호출부가 파일째 지운다(§1.2). */
  empty: boolean;
}

export type UpsertResult = UpsertOk | Unreadable;
export type StripResult = StripOk | Unreadable;

/**
 * 어댑터 하나. `V` = 키 하나의 값(마커 블록 본문 · JSON 값 · TOML 구간 본문 · `.gitignore` 줄 원문).
 *
 * 성질(설계 §6.2 ⓓ · §7A — `tests/adapters.test.ts` 가 문다): 설치자 원본 `x` 에 대해
 * `strip(upsert(x).text, upsert(x).portions)` 는 `x` 로 돌아온다 — `marker-md` · `lines` 는 **바이트 동일**,
 * `json-keys` · `toml-region` 은 **파싱 동치**(들여쓰기·끝 개행은 약속하지 않는다, N-a).
 */
export interface PortionAdapter<V> {
  /** 파싱 실패 시 화면에 쓸 말 — `⊘ left <path> — could not read it (<unreadable>)`. */
  readonly unreadable: string;
  /**
   * 파일을 읽는다. 못 읽으면 `null` — 그 파일에는 한 바이트도 쓰지 않는다.
   * `keys` 를 주면 그중 지금 파일에 있는 키의 sha 를 돌려준다(옛 로그의 몫 찾기 §5 에서 호출부가
   * 내용 식별로 고른 후보를 넘긴다).
   */
  read(text: string, keys?: Iterable<string>): Map<string, string> | null;
  upsert(existing: string | null, input: UpsertInput<V>): UpsertResult;
  strip(existing: string, input: StripInput): StripResult;
}

/** 키 하나를 어떻게 할지 — 어댑터는 이 계획을 자기 형식으로 실행만 한다. */
export interface UpsertPlan {
  /** 파일에 있는 하네스 키를 새 값으로 바꾼다(기록 sha 그대로였고 새 값이 다를 때). */
  replace: string[];
  /** 파일에 없던 키를 더한다(렌더 순서). */
  add: string[];
  /** 하네스가 더는 렌더하지 않는(또는 excluded 가 된) 키를 뺀다. */
  remove: string[];
  kept: string[];
  deleted: string[];
  portions: Map<string, string>;
}

/**
 * upsert 의 키별 판정 — 네 어댑터가 공유한다.
 *
 * @param render 이번 렌더의 몫 key → **새 값의 sha**
 * @param present 지금 파일에 있는 키 key → **지금 값의 sha**(렌더·기록에 나오는 키만 보면 된다)
 * @param alwaysStrip 기록된 키면 sha 와 무관하게 빼는 키(settings.json 훅 항목 — 스크립트가 함께
 *   사라지므로 남기면 죽은 참조다, N-f · N13)
 */
export function planUpsert(args: {
  render: ReadonlyMap<string, string>;
  recorded: PortionShas;
  present: ReadonlyMap<string, string>;
  excluded: ReadonlySet<string>;
  alwaysStrip?: (key: string) => boolean;
}): UpsertPlan {
  const { recorded, present, excluded } = args;
  const alwaysStrip = args.alwaysStrip ?? (() => false);
  const render = new Map([...args.render].filter(([k]) => !excluded.has(k)));
  const plan: UpsertPlan = {
    replace: [],
    add: [],
    remove: [],
    kept: [],
    deleted: [],
    portions: new Map(),
  };
  for (const [key, sha] of recorded) {
    const now = present.get(key);
    if (now === undefined) {
      // ⓒ 설치자가 지웠다 — 되살리지 않는다. 이미 excluded 면 새로 알릴 것이 없다.
      if (!excluded.has(key)) plan.deleted.push(key);
      continue;
    }
    const next = render.get(key);
    if (next !== undefined) {
      if (now === sha) {
        if (next !== sha) plan.replace.push(key);
        plan.portions.set(key, next);
      } else {
        plan.kept.push(key); // 설치자가 고쳤다 — 남기고 알린다. 기록은 옛 sha 그대로(회수 판정 근거)
        plan.portions.set(key, sha);
      }
    } else if (now === sha || alwaysStrip(key)) {
      plan.remove.push(key);
    } else {
      plan.kept.push(key);
      plan.portions.set(key, sha);
    }
  }
  for (const [key, sha] of render) {
    if (recorded.has(key)) continue;
    if (present.has(key)) {
      plan.kept.push(key); // 설치 전부터 있던 키 — 설치자 것(Q3). 기록하지 않는다
    } else {
      plan.add.push(key);
      plan.portions.set(key, sha);
    }
  }
  return plan;
}

export interface StripPlan {
  remove: string[];
  kept: string[];
  portions: Map<string, string>;
}

/** strip 의 키별 판정 — **기록된 키만** 본다(ⓓ). excluded 키는 건너뛴다. */
export function planStrip(args: {
  recorded: PortionShas;
  present: ReadonlyMap<string, string>;
  excluded: ReadonlySet<string>;
  alwaysStrip?: (key: string) => boolean;
}): StripPlan {
  const alwaysStrip = args.alwaysStrip ?? (() => false);
  const plan: StripPlan = { remove: [], kept: [], portions: new Map() };
  for (const [key, sha] of args.recorded) {
    if (args.excluded.has(key)) continue;
    const now = args.present.get(key);
    if (now === undefined) continue;
    if (now === sha || alwaysStrip(key)) {
      plan.remove.push(key);
    } else {
      plan.kept.push(key);
      plan.portions.set(key, sha);
    }
  }
  return plan;
}

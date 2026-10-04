/**
 * 함께 쓰는 파일에 하네스 몫만 쓴다 — CLI 변환 쪽 (#551 · ADR-097 §6.2 · #563 · #558).
 *
 * `.codex/config.toml`(`toml-region`) · `opencode.json`(`json-keys`) · 첫 접촉 `AGENTS.md`(`marker-md`)가 이 한
 * 경로를 탄다. install(첫 설치 포함) · `--reinstall` · update 가 같은 변환을 부르므로 동작마다 규칙이 갈리지 않는다.
 *
 * 한 파일에 대해 하는 일:
 *   1. 파일 단위 판정은 `judge`(shared 행) — 없으면 만들고(update 는 만들지 않는다 · ADR-049 `refreshOnly`), 못 읽으면
 *      한 바이트도 안 쓰고 이유를 말하고(#574), 읽히면 몫만 upsert 한다.
 *   2. 키 단위 판정은 어댑터(`planUpsert`) — 설치자 키가 이기고, 기록에 있는데 없는 키는 되돌린다(ADR-099 R1 —
 *      빼기는 설치자가 `--without` · 위저드로 명시한 `excluded` 로만 정해진다).
 *   3. 쓰기: **하네스가 만든 파일**(기준선 sha 가 지금 디스크와 같다 · 이번에 만든다)만 `owned-write` 로 쓴다 — 그래야
 *      `externalFiles` 기준선이 이어져 지금의 uninstall 이 "안 고친 하네스 파일" 로 회수할 수 있다. 설치자 파일(기준선
 *      없음 · 다름)은 그 자리에 몫만 더해 직접 쓰고 기준선을 남기지 않는다 — 남기면 지금의 uninstall 이 그 파일을
 *      "하네스 것" 으로 읽고 **통째로** 지운다. 어느 쪽도 파일 백업을 만들지 않는다(몫만 바꾸므로 잃는 것이 없다).
 *
 * 기록(`portions`)은 **돌려주기만** 한다 — 로그에 쓰는 것은 호출부(install 의
 * `composeWriterLog` · update 의 `refreshExternalCli`)다. uninstall 은 같은 기록으로 몫만 걷는다(`stripShared`, #551 R1).
 */

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { PortionAdapter, PortionShas } from "./adapters/contract.js";
import { ADAPTERS, adapterFor, excludedKeys, keyId } from "./adapters/index.js";
import { jsonSha } from "./adapters/json-keys.js";
import {
  AGENTS_BLOCK,
  AGENTS_BLOCK_NAME,
  ANCHOR_BLOCK,
  mergeAgentsMd,
  renderAgentsBlock,
  SKILLS_BLOCK,
} from "./agents-md-merge.js";
import { hashContent, type InstallLogPortion } from "./install-log.js";
import { judge } from "./judge.js";
import type { OwnedWriter } from "./owned-write.js";

/** 앞 실행이 남긴 기록 중 함께 쓰는 파일이 읽는 것 — `runCliTransforms` 가 호출부에서 받아 넘긴다. */
export interface SharedRecord {
  /**
   * 설치 로그의 `portions` — 키마다 하네스가 써 둔 값의 sha. 이것이 있어야 하네스 몫을 갱신·회수할 수 있다(파일 값이
   * 기록 sha 그대로일 때만). **없으면(옛 판 · 기록 배선 전) 파일에 있는 하네스 구간·키가 하네스가 쓴 그대로인지 알 수
   * 없다** — 그때는 갈아 끼우지 않고 남긴다. 모른다고 하네스 판으로 바꾸면 설치자가 구간 안에서 고친 값이 백업도 없이
   * 사라진다(`tests/cli-shared-files.test.ts`). 예외 하나: 기준선 sha 그대로인 하네스 파일은 통째로 새로 쓴다(아래).
   */
  portions?: ReadonlyArray<InstallLogPortion>;
  /** 설치자가 뺀 것 한 목록(`excludedIds(log)`) — 이 파일의 키 id 만 골라 쓴다. */
  excluded?: ReadonlyArray<string>;
}

/**
 * - `created`   없던 파일을 하네스 몫(+ seed)으로 만들었다
 * - `updated`   있던 파일에 몫을 더하거나 바꿨다
 * - `unchanged` 이미 최신 — 쓰지 않았다
 * - `left`      쓰지 않고 남겼다(못 읽음 · 합친 결과가 안 읽힘) — `line` 이 이유
 * - `skipped`   update 가 없는 파일을 만들지 않았다(ADR-049) — 알릴 것이 없다
 */
export type SharedAction = "created" | "updated" | "unchanged" | "left" | "skipped";

export interface SharedWriteResult {
  /** 프로젝트 상대 경로. */
  path: string;
  action: SharedAction;
  /** 화면 한 줄의 뒷말(`left` 의 이유 등). 비면 행동이 곧 말이다. */
  line: string;
  /** 설치자 값이 이겨 하네스 판을 쓰지 않은 항목 — 화면의 "kept yours". */
  kept: string[];
  /**
   * 파일에 있는데 갈아 끼우지 않은 **하네스 구간·블록**(`top` · `tables` · `agents`) — 설치자가 그 안을 고쳤거나 몫
   * 기록이 없어 하네스가 쓴 그대로인지 알 수 없다. 이름이 하네스 것이라 "kept yours" 로 부르지 않는다.
   */
  leftAsIs: string[];
  /** 쓴 뒤 이 파일에 대해 기록할 몫 전체. `null` = 이번에 판정하지 않았다(기록을 그대로 둔다). */
  portions: InstallLogPortion[] | null;
  /** 기록에 있었는데 파일에 없어 이번에 되돌린 몫의 키 id(ADR-099 R1) — 화면이 `was missing — restored` 로 알린다. */
  restored: string[];
  /** 이번에 새로 더한 몫의 키 id(되돌린 것 제외) — 옛 판이 뺀 것으로 적었던 키를 되살렸는지 화면이 가른다(R5). */
  added: string[];
  /** `portions` 에 기록 sha 만 잇고 파일에는 없는 키(어댑터 키 — `UpsertOk.missing`). 화면은 파일에 있는 몫으로 세지 않는다. */
  missing: string[];
  /** 설치자가 뺀(`excluded`) 키 중 이번에 걷은 것 — 키 id(리뷰 #693 NOTE-2). */
  removedOut: string[];
  /** `removedOut` 중 고친 값이었는데도 걷은 것 — 키 id. */
  removedEdited: string[];
  /** 설치자가 뺐지만 고쳐 둬서 남긴 키 — 키 id. `kept` · `leftAsIs` 와 겹치지 않는다. */
  keptOut: string[];
  /** 새 판으로 갈아 끼운 키가 있었나 — 걷기만 한 실행을 "썼다" 고 하지 않으려고 화면이 본다. */
  replaced: boolean;
}

export interface WriteSharedParams<V> {
  projectDir: string;
  /** 프로젝트 상대 경로 — `SHARED_FILES` 에 있어야 한다. */
  path: string;
  /** 이번 렌더의 하네스 몫(어댑터 키 → 값). */
  render: ReadonlyMap<string, V>;
  record: SharedRecord;
  /** `externalFiles` 기준선 — "하네스가 만든 파일인가" 만 여기서 읽는다. */
  baseline: ReadonlyMap<string, string>;
  /** 하네스가 만든 파일을 쓰는 writer(변환의 것 그대로) — 기준선이 거기로 쌓인다. */
  writer: OwnedWriter;
  /** update 경로 — 없는 파일은 만들지 않는다(ADR-049). */
  refreshOnly: boolean;
  /** 파일을 새로 만들 때만 하네스 몫 앞에 둘 본문(컨텍스트 파일의 스캐폴드 등) — 몫이 아니다. */
  seed?: string;
}

function toPortions(path: string, portions: ReadonlyMap<string, string>): InstallLogPortion[] {
  const adapter = adapterFor(path);
  if (adapter === null) throw new Error(`shared-write: ${path} is not a shared file`);
  return [...portions].map(([key, sha256]) => ({ path, adapter, key, sha256 }));
}

function recordedFor(path: string, record: SharedRecord): PortionShas {
  return new Map(
    (record.portions ?? []).filter((p) => p.path === path).map((p) => [p.key, p.sha256]),
  );
}

export function writeShared<V>(params: WriteSharedParams<V>): SharedWriteResult {
  const { projectDir, path, render, record, baseline, writer, refreshOnly } = params;
  const adapter = adapterFor(path);
  if (adapter === null) throw new Error(`shared-write: ${path} is not a shared file`);
  const abs = join(projectDir, path);
  const onDisk = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  const recorded = recordedFor(path, record);
  const excluded = excludedKeys(path, record.excluded ?? []);
  const result = (
    action: SharedAction,
    rest: Partial<Omit<SharedWriteResult, "path" | "action">> = {},
  ): SharedWriteResult => ({
    path,
    action,
    line: "",
    kept: [],
    leftAsIs: [],
    portions: null,
    restored: [],
    added: [],
    missing: [],
    removedOut: [],
    removedEdited: [],
    keptOut: [],
    replaced: false,
    ...rest,
  });
  // #678 — 실체가 프로젝트 밖이면 몫도 쓰지 않는다. 몫 기록은 그대로(`portions: null`) · 화면은 writer 의 `outside` 가 말한다.
  if (writer.skipOutside(abs)) return result("skipped");

  const verdict = judge({
    op: "write",
    kind: "shared",
    rec: { state: "none" },
    disk: onDisk,
    next: null,
    run: refreshOnly ? "update" : "install",
    adapter,
  });
  switch (verdict.verdict) {
    case "leave+advise":
      return result("left", { line: verdict.line });
    case "create":
      // update 는 없는 파일을 만들지 않는다(ADR-049). 몫 기록은 그대로 둔다(`portions: null`) — 다음 install 이 완전한
      // 파일을 만든다. 파일째 사라진 것을 update 가 되살리는 것은 ADR-099 R2(후속 PR).
      if (refreshOnly) return result("skipped");
      break;
    case "upsert-portion":
      break;
    default:
      throw new Error(`shared-write: unexpected verdict ${verdict.verdict} for ${path}`);
  }

  // 하네스가 만든 파일이 기준선 sha 그대로다 = 하네스가 쓴 뒤 아무도 안 고쳤다 — **없던 것처럼** 새로 쓴다. 바꿀 설치자
  // 내용이 없고, 그래야 옛 판이 통째로 쓴 파일(구간 도입 전 `config.toml`)도 새 형식으로 옮겨지고 seed 도 최신판이 된다
  const harnessMade = onDisk === null || baseline.get(path) === hashContent(onDisk);
  const existing = harnessMade ? null : onDisk;
  // 어댑터 넷은 값 형식만 다르다 — 이 파일의 어댑터는 경로가 정하고, 렌더는 호출부가 그 형식으로 만든다
  const impl = ADAPTERS[adapter] as unknown as PortionAdapter<V>;
  // `json-keys` 는 seed 를 받지 않는다(빈 객체에서 시작) — 새로 만들 때는 seed 를 "있던 내용" 으로 넘겨 그 위에
  // 몫만 더한다. seed 의 키는 그래서 몫이 아니다(설치 전부터 있던 키 = 설치자 것, Q3)
  const base = existing === null && adapter === "json-keys" ? (params.seed ?? null) : existing;
  const upserted = impl.upsert(base, {
    render,
    recorded: existing === null ? new Map() : recorded,
    excluded,
    ...(params.seed !== undefined ? { seed: params.seed } : {}),
    projectDir,
  });
  if (!upserted.ok) {
    // 읽히는 파일이어도 합친 결과가 읽히지 않으면(깨진 마커 · 고쳐 남긴 구간과 새 구간의 겹침) 쓰지 않는다
    return result("left", {
      line: `could not merge it (${upserted.reason}) — harness part not added`,
    });
  }
  const portions = toPortions(path, upserted.portions);
  const ids = (keys: Iterable<string>): string[] =>
    [...keys].flatMap((k) => {
      const id = keyId(path, k);
      return id === null ? [] : [id];
    });
  const restoredKeys = new Set(upserted.restored);
  // 새로 더한 키 = 쓴 뒤 몫에 있는데 쓰기 전 파일에 없던 것(되돌린 것은 위 `restored`). 파일을 새로 만들었으면 전부다
  const added = ids(
    [...upserted.portions.keys()].filter(
      (k) => !restoredKeys.has(k) && (onDisk === null || !recorded.has(k)),
    ),
  );
  if (harnessMade) {
    // 하네스가 만든 파일 — writer 가 쓰고 기준선을 잇는다(같으면 쓰지 않고 기준선만)
    writer.write(abs, upserted.text);
  } else if (upserted.changed) {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, upserted.text);
  }
  // #600 — 몫은 쓴 자리에서 적는다. 변환이 뒤에서 던져도 이 몫은 기록에 남아 재실행 · uninstall 이 알아본다
  writer.journal?.portions(path, portions);
  const action: SharedAction =
    onDisk === null ? "created" : upserted.text !== onDisk ? "updated" : "unchanged";
  // 구간·블록 이름은 하네스만 쓴다 — 렌더의 키가 그대로 kept 로 나왔으면 설치자 값이 아니라 남겨 둔 하네스 몫이다.
  // `json-keys` 의 키(`mcp.<name>`)는 설치자도 같은 이름을 쓰므로 가르지 않는다
  const regionNamed = adapter !== "json-keys";
  const isRegion = (k: string) => regionNamed && render.has(k);
  // 값이 하네스 렌더와 **같은** 키는 "kept yours" 가 아니다 — 이긴 것이 없다(리뷰 N1: 기록 없이 남은 하네스 키를 설치자
  // 것이라 불렀다). `json-keys` 만 값으로 잴 수 있다 — TOML 항목은 구간 단위로만 비교한다
  const present =
    adapter === "json-keys" && onDisk !== null
      ? (ADAPTERS["json-keys"].read(onDisk, render.keys(), projectDir) ?? new Map<string, string>())
      : new Map<string, string>();
  const sameAsRender = (k: string) => present.get(k) === jsonSha(render.get(k));
  return result(action, {
    kept: upserted.kept.filter((k) => !isRegion(k) && !sameAsRender(k) && !excluded.has(k)),
    leftAsIs: upserted.kept.filter((k) => isRegion(k) && !excluded.has(k)),
    // 하네스가 만든 파일을 새로 쓴 경우(기준선 그대로) 어댑터는 빈 파일에서 시작해 걷은 것을 모른다 — 기록에 있던 뺀 키가 걷힌 것이다
    removedOut: ids(
      harnessMade && onDisk !== null
        ? [...recorded.keys()].filter((k) => excluded.has(k))
        : upserted.removed.filter((k) => excluded.has(k)),
    ),
    removedEdited: ids(upserted.removedEdited.filter((k) => excluded.has(k))),
    keptOut: ids(upserted.kept.filter((k) => excluded.has(k))),
    // 하네스가 만든 파일을 새로 쓴 경우 어댑터 계획이 빈 파일 기준이라 "바꿨다" 로 둔다(걷기만 했다고 단정하지 않는다)
    replaced: upserted.replaced.length > 0 || (harnessMade && onDisk !== null),
    portions,
    restored: ids(upserted.restored),
    added,
    missing: upserted.missing,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * AGENTS.md — 두 모델 (#558 · 설계 §6.2 marker-md)
 * ──────────────────────────────────────────────────────────────────────────── */

const AGENTS_MD = "AGENTS.md";

/**
 * - `sections` 하네스가 만든 파일 — 지금의 절 모델(`mergeAgentsMd` · ADR-095 D1). 파일째 `externalFiles` 기준선을 남기고
 *              uninstall 은 `stripHarnessFromAgentsMd` 로 하네스 절만 걷는다
 * - `block`    기록에 없는 설치자 파일(첫 접촉) — 본문은 바이트 그대로, 하네스 몫은 파일 끝 블록 하나(루트 `CLAUDE.md` 모델)
 */
export type AgentsMdModel = "sections" | "block";

function hasMarkerLine(disk: string, markers: ReadonlyArray<string>): boolean {
  return disk.split("\n").some((l) => markers.includes(l.trim()));
}

/**
 * 어느 모델인가 — 판정 순서가 곧 규칙이다.
 * ① 파일이 없다 → 하네스가 만든다(`sections`)
 * ② 첫 접촉 블록이 있다 → `block`(한 번 블록으로 들어간 파일은 계속 블록 — 기록 여부와 무관하게)
 * ③ 하네스 기록(`externalFiles`)에 있다 → `sections`(옛 판이 만든 파일을 블록으로 읽으면 룰이 두 벌 들어간다, N-c)
 * ④ 절 모델의 조각 마커가 있다 → `sections`(기록을 잃은 하네스 파일 — 같은 이유)
 * ⑤ 그 밖 → `block`(#558)
 */
export function agentsMdModel(disk: string | null, recordedByHarness: boolean): AgentsMdModel {
  if (disk === null) return "sections";
  if (hasMarkerLine(disk, [AGENTS_BLOCK.start, AGENTS_BLOCK.end])) return "block";
  if (recordedByHarness) return "sections";
  if (hasMarkerLine(disk, [ANCHOR_BLOCK.start, SKILLS_BLOCK.start])) return "sections";
  return "block";
}

export interface WriteAgentsMdParams {
  projectDir: string;
  /** 절 모델 렌더(`renderAgentsMd`) — 하네스가 만든 파일의 골격이자 첫 접촉 블록의 원천. */
  rendered: string;
  /** 렌더에 쓴 템플릿 — 절 이름의 SSOT. */
  template: string;
  /** 앵커 제목(`anchorTitle(templates/CLAUDE.md)`). */
  anchorTitle: string;
  writer: OwnedWriter;
  baseline: ReadonlyMap<string, string>;
  record: SharedRecord;
  refreshOnly: boolean;
}

export interface AgentsMdWriteResult {
  model: AgentsMdModel;
  /** `block` 모델의 몫 쓰기 결과. `sections` 는 `null` — owned-write 가 파일째 기준선을 남긴다. */
  shared: SharedWriteResult | null;
}

export function writeAgentsMd(params: WriteAgentsMdParams): AgentsMdWriteResult {
  const abs = join(params.projectDir, AGENTS_MD);
  const disk = existsSync(abs) ? readFileSync(abs, "utf8") : null;
  if (agentsMdModel(disk, params.baseline.has(AGENTS_MD)) === "sections") {
    params.writer.write(
      abs,
      mergeAgentsMd({ rendered: params.rendered, existing: disk, template: params.template }),
    );
    return { model: "sections", shared: null };
  }
  const shared = writeShared({
    projectDir: params.projectDir,
    path: AGENTS_MD,
    render: new Map([
      [
        AGENTS_BLOCK_NAME,
        renderAgentsBlock({
          rendered: params.rendered,
          template: params.template,
          anchorTitle: params.anchorTitle,
        }),
      ],
    ]),
    record: params.record,
    // 설치자 파일이다 — 기준선을 넘기지 않아 owned-write 로 쓰이지도 기록되지도 않게 한다. 기록되면 지금의
    // uninstall 이 "기준선 그대로인 하네스 파일" 로 읽고 절 모델로 걷어내려다 설치자 본문째 지운다.
    baseline: new Map(),
    writer: params.writer,
    refreshOnly: params.refreshOnly,
  });
  return { model: "block", shared };
}

/* ────────────────────────────────────────────────────────────────────────────
 * uninstall — 기록된 몫만 걷는다 (#551 R1 · 설계 §1.2 shared 행 `strip-portion`)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * - `removed` 기록된 몫을 걷었다(미리보기면 걷을 것이 있다)
 * - `left`    걷지 않은 것이 있다 — 못 읽음 · 설치자가 고친 몫 · 기록이 없어 알 수 없는 몫(`line` 이 이유)
 * - `none`    걷을 것도 알릴 것도 없다
 */
export interface SharedStripResult {
  path: string;
  action: "removed" | "left" | "none";
  line: string;
  /** 걷은 몫의 키(어댑터 키). */
  removed: string[];
  /** 기록에 있지만 설치자가 고쳐 남긴 키. */
  kept: string[];
  /** 걷은 뒤에도 이 파일에 남는 기록된 몫(= `kept`) — 로그가 남는 경로(`--cli`)가 이어 적는다. */
  portions: InstallLogPortion[];
  /** #569 — 하네스가 만든 파일에 몫밖에 없어 파일째 지웠다(미리보기면 지울 것이다). */
  fileRemoved?: boolean;
}

export interface StripSharedParams {
  projectDir: string;
  path: string;
  /** 설치 로그의 `portions` 전체 — 이 파일 것만 골라 쓴다. */
  portions: ReadonlyArray<InstallLogPortion>;
  excluded: ReadonlyArray<string>;
  /**
   * 이 파일의 몫 기록이 **없을 때** 파일에 하네스 몫이 남아 있는지 알아보는 법 — 알리기만 하고 지우지 않는다
   * (기록 없이 지우면 설치자 것을 지울 수 있다). 돌려준 이름이 있으면 `left` 한 줄이 된다.
   */
  remnant: (disk: string) => string[];
  /** 기록이 없어 남긴 것을 설명하는 한 줄 — `remnant` 가 돌려준 이름을 받는다. */
  remnantLine: (names: ReadonlyArray<string>) => string;
  /** false = 미리보기(쓰지 않는다). 판정은 같다. */
  write: boolean;
  /**
   * #569 · 설계 §1.2 shared 행 — 하네스가 **만든** 파일(`rootFiles.change === "created"`)이면, 몫을 걷고 남는 것이 없을 때
   * 파일째 지운다. 설치자 파일에는 넘기지 않는다(빈 파일이라도 설치자가 둔 것이다).
   */
  removeIfEmpty?: boolean;
}

export function stripShared(params: StripSharedParams): SharedStripResult {
  const { projectDir, path } = params;
  const adapter = adapterFor(path);
  if (adapter === null) throw new Error(`shared-write: ${path} is not a shared file`);
  const out = (
    action: SharedStripResult["action"],
    rest: Partial<Omit<SharedStripResult, "path" | "action">> = {},
  ): SharedStripResult => ({
    path,
    action,
    line: "",
    removed: [],
    kept: [],
    portions: [],
    ...rest,
  });
  const abs = join(projectDir, path);
  // 링크를 따라간다 — install 도 링크 너머(예: AGENTS.md → CLAUDE.md)에 몫을 썼다. 파일이 아니면 걷을 것이 없다
  if (!existsSync(abs) || !statSync(abs).isFile()) return out("none");
  const disk = readFileSync(abs, "utf8");
  const recorded = new Map(
    params.portions.filter((p) => p.path === path).map((p) => [p.key, p.sha256]),
  );
  const verdict = judge({
    op: "remove",
    kind: "shared",
    rec: { state: "none" },
    disk,
    next: null,
    adapter,
  });
  if (verdict.verdict === "leave+advise") {
    return out("left", { line: verdict.line, portions: toPortions(path, recorded) });
  }
  if (recorded.size === 0) {
    const names = params.remnant(disk);
    return names.length === 0 ? out("none") : out("left", { line: params.remnantLine(names) });
  }
  const impl = ADAPTERS[adapter] as unknown as PortionAdapter<unknown>;
  const res = impl.strip(disk, {
    recorded,
    excluded: excludedKeys(path, params.excluded),
    projectDir,
  });
  if (!res.ok) {
    return out("left", {
      line: `could not read it (${res.reason}) — harness part not removed`,
      portions: toPortions(path, recorded),
    });
  }
  const fileRemoved = params.removeIfEmpty === true && res.removed.length > 0 && res.empty;
  if (params.write && fileRemoved) rmSync(abs);
  else if (params.write && res.changed) writeFileSync(abs, res.text);
  const action = res.removed.length > 0 ? "removed" : res.kept.length > 0 ? "left" : "none";
  return out(action, {
    removed: res.removed,
    kept: res.kept,
    portions: toPortions(path, res.portions),
    ...(fileRemoved ? { fileRemoved } : {}),
  });
}

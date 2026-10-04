/**
 * install · `--reinstall` 의 쓰기 — 판정 함수 하나(`judge`)를 실행하고, 쓴 것을 **쓰는 순간** 기록한다
 * (#551 PR-3 · ADR-097 Decision 1·3·4 · 설계 `docs/plans/one-principle-design-2026-09-27.md` §1.2 · §5 · §6.2).
 *
 * 두 종류만 다룬다:
 *   - **하네스 파일** — 파일 통째. `recorded()` 가 기록 상태를, `judge` 가 행동 하나와 화면 한 줄을 정한다.
 *     첫 접촉(기록 없음 + 다른 내용) · 설치자가 고친 파일 · sha 없는 옛 기록은 **그 파일 하나**를
 *     `<file>.backup-<ts>` 로 남기고 최신판을 쓴다. 폴더 단위 백업·이동은 없다.
 *   - **함께 쓰는 파일** — 어댑터(`src/adapters/`)로 하네스 몫만 더하고 바꾼다. 읽지 못하면 한 바이트도 쓰지
 *     않고 남긴다(#574). 설치자가 지운 하네스 키는 되살리지 않고 `excluded` 로 옮긴다(R2).
 *
 * 기록은 여기서 모으고 `composeWriterLog` 가 옛 기록 위에 **누적**한다(`mergeExternalFiles` 규칙 — 디스크에서
 * 사라진 항목만 뺀다). 옛 판이 디스크를 훑어 적은 `policyFiles`·`skillFiles` 는 처음 쓸 때 소유 필터를 한 번
 * 거쳐 이어받고 `records: "writer"` 를 적는다(Q1).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { ADAPTERS, excludedKeys, keyId, SHARED_FILES } from "./adapters/index.js";
import { isContainerKey, jsonSha } from "./adapters/json-keys.js";
import { backupFile, copyFile } from "./fs-ops.js";
import { projectAnchoredRef } from "./hook-ref.js";
import {
  hashContent,
  type InstallLog,
  type InstallLogPortion,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  mergeExternalFiles,
} from "./install-log.js";
import { judge, type Verdict } from "./judge.js";
import { RETIRED_PATHS } from "./manifest.js";
import { createOutsideGuard, type OutsideLink } from "./outside-project.js";
import { HARNESS_ANCHOR_FILE } from "./project-claude-merge.js";
import { excludedIds, type RecordedOptions, recorded } from "./recorded.js";

const CLAUDE_DIR = ".claude/";
const SKILLS_DIR = ".claude/skills/";
/** 백업 이름의 자리표시 — `LINES` 가 이 모양으로 적고, 실제 백업 경로로 바꿔 화면에 낸다. */
const BACKUP_PLACEHOLDER = "<file>.backup-<time>";

/** 하네스 파일 판정 중 **알릴 것**(백업 · 같은 내용이라 설치자 파일을 둔 것). 조용한 판정은 담지 않는다. */
export interface JudgedWrite {
  /** project-relative */
  path: string;
  verdict: Verdict;
  /** 화면 한 줄 — `judge` 의 `line` 에 실제 백업 경로를 넣은 것. */
  line: string;
  /** 만든 백업 — project-relative(화면) · 절대(`BaselineReport.backups` 와 짝). */
  backup?: string;
  backupAbs?: string;
}

/** 함께 쓰는 파일 하나의 결과. 키는 화면용 짧은 이름(`statusLine` · `github` · `.env`). */
export interface SharedWrite {
  path: string;
  verdict: Verdict;
  line: string;
  /** 디스크가 실제로 바뀌었나. */
  changed: boolean;
  /** 쓴 뒤 파일에 있는 하네스 몫. */
  harness: string[];
  /** 이번에 새로 더한 하네스 키. */
  added: string[];
  /** 설치자 값이 이겨 하네스 판을 쓰지 않은 키. */
  kept: string[];
  /** 기록에 있는데 파일에 없던 키 — 설치자가 지웠다. 되살리지 않고 `excluded` 에 적었다(키 id). */
  deleted: string[];
}

export interface WriteLedger {
  /** `.claude/` 상대 — `policyFiles` */
  policyFiles: InstallLogSkillFile[];
  /** `.claude/skills/` 상대 — `skillFiles` */
  skillFiles: InstallLogSkillFile[];
  /** project 상대 — `.claude/` 밖 하네스 파일(`.uzys-agent-harness/*.sh`) */
  externalFiles: InstallLogSkillFile[];
  /** 앵커 sha — `templates.rootClaudeMd` */
  anchor: { path: string; sha256: string } | null;
  /** displaced(비켜 둔 설치자 파일) · created(하네스가 만든 함께 쓰는 파일) */
  rootFiles: InstallLogRootFile[];
  /** 이번에 쓴 함께 쓰는 파일의 몫 전체(경로마다 완결) */
  portions: InstallLogPortion[];
  /** `portions` 를 새로 적은 경로 — 누적 때 옛 몫을 이 경로만 갈아 끼운다. */
  portionPaths: string[];
  /** 설치자가 지운 하네스 키 id(`mcp:github` …) — `excluded` 에 더한다. */
  deletedIds: string[];
  /** 만든 백업 파일의 절대경로. */
  backups: string[];
  judged: JudgedWrite[];
  shared: SharedWrite[];
  /** #678 — 링크를 따라가면 프로젝트 밖이라 쓰지 않은 자리. 기록도 하지 않는다(우리 것으로 삼지 않는다). */
  outside: OutsideLink[];
}

export type HarnessSource = { source: string } | { content: string };

export interface SharedOptions {
  /** 파일이 없으면 만들지 않는다(`.gitignore` — 지금처럼 있을 때만 줄을 더한다). */
  onlyIfPresent?: boolean;
  /**
   * 옛 로그(`records: "writer"` 없음)라 이 파일의 몫 기록이 없을 때 — 설계 §5 의 **내용 식별**로 찾은
   * 하네스 몫(key → sha). 여기서만 내용 식별을 쓴다(R3). 기록이 생긴 뒤로는 부르지 않는다.
   */
  legacySeed?: (text: string) => Map<string, string>;
  /** `rootFiles.change = created` 의 설명. */
  createdNote?: string;
}

export interface InstallWriter {
  harness(path: string, from: HarnessSource, opts?: RecordedOptions): JudgedWrite | null;
  shared(path: string, render: ReadonlyMap<string, unknown>, opts?: SharedOptions): SharedWrite;
  /** #678 — 이 writer 밖에서 쓰는 자리(루트 `CLAUDE.md`)도 같은 판정을 받는다. true 면 쓰지 않는다. */
  skipOutside(abs: string): boolean;
  ledger(): WriteLedger;
}

/**
 * @param excluded 설치자가 뺀 것 한 목록(누적 — `cumulativeExcluded`). 함께 쓰는 파일의 키 판정에만 쓴다 —
 *   하네스 파일의 선택은 호출부가 이번 선택으로 이미 걸렀다.
 */
export function createInstallWriter(args: {
  projectDir: string;
  previousLog: InstallLog | null;
  excluded: ReadonlySet<string>;
  now?: Date;
}): InstallWriter {
  const { projectDir, previousLog, excluded } = args;
  const now = args.now ?? new Date();
  const legacyLog = previousLog !== null && previousLog.records !== "writer";
  const policy = new Map<string, string>();
  const skills = new Map<string, string>();
  const external = new Map<string, string>();
  let anchor: WriteLedger["anchor"] = null;
  const rootFiles: InstallLogRootFile[] = [];
  const portions: InstallLogPortion[] = [];
  const portionPaths: string[] = [];
  const deletedIds: string[] = [];
  const backups: string[] = [];
  const judged: JudgedWrite[] = [];
  const shared: SharedWrite[] = [];
  const outside = createOutsideGuard(projectDir);

  const rel = (abs: string): string => relative(projectDir, abs).split(sep).join("/");

  function recordSha(path: string, sha256: string): void {
    if (path === HARNESS_ANCHOR_FILE) anchor = { path, sha256 };
    else if (path.startsWith(SKILLS_DIR)) skills.set(path.slice(SKILLS_DIR.length), sha256);
    else if (path.startsWith(CLAUDE_DIR)) policy.set(path.slice(CLAUDE_DIR.length), sha256);
    else external.set(path, sha256);
  }

  function harness(path: string, from: HarnessSource, opts: RecordedOptions = {}) {
    const abs = join(projectDir, path);
    // #678 — 실체가 프로젝트 밖이면 판정 전에 멈춘다: 쓰지도 · 백업하지도 · 기록하지도 않는다.
    if (outside.skip(abs)) return null;
    const next = "source" in from ? readFileSync(from.source, "utf8") : from.content;
    const disk = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    const j = judge({
      op: "write",
      kind: "harness",
      rec: recorded(previousLog, path, opts),
      disk,
      next,
    });
    let backupAbs: string | undefined;
    const write = (): void => {
      // 템플릿 복사는 `copyFile` 로 — 실행 비트(스킬의 보조 스크립트)가 원본을 따른다
      if ("source" in from) copyFile(from.source, abs);
      else {
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, from.content);
      }
    };
    switch (j.verdict) {
      case "create":
      case "overwrite":
        write();
        break;
      case "backup+overwrite":
        backupAbs = backupFile(abs, now);
        backups.push(backupAbs);
        write();
        break;
      case "leave":
        break;
      default:
        throw new Error(`install: '${j.verdict}' is not a write verdict (${path})`);
    }
    const backup = backupAbs === undefined ? undefined : rel(backupAbs);
    switch (j.record) {
      case "sha":
        recordSha(path, hashContent(next));
        break;
      case "displaced+sha":
        recordSha(path, hashContent(next));
        rootFiles.push({ path, change: "displaced", notes: backup === undefined ? [] : [backup] });
        break;
      case "displaced":
        rootFiles.push({ path, change: "displaced", notes: [] });
        break;
      case "keep":
        break;
      default:
        throw new Error(`install: '${j.record}' is not a write record (${path})`);
    }
    if (j.line === "" || j.verdict === "create" || j.verdict === "overwrite") return null;
    const out: JudgedWrite = {
      path,
      verdict: j.verdict,
      line: backup === undefined ? j.line : j.line.replace(BACKUP_PLACEHOLDER, backup),
      ...(backup === undefined || backupAbs === undefined ? {} : { backup, backupAbs }),
    };
    judged.push(out);
    return out;
  }

  function sharedWrite(
    path: string,
    render: ReadonlyMap<string, unknown>,
    opts: SharedOptions = {},
  ): SharedWrite {
    const file = SHARED_FILES[path];
    if (file === undefined) throw new Error(`install: ${path} is not a shared file`);
    const adapter = ADAPTERS[file.adapter] as (typeof ADAPTERS)["json-keys"];
    const abs = join(projectDir, path);
    const disk = existsSync(abs) ? readFileSync(abs, "utf8") : null;
    const own = new Map(
      (previousLog?.portions ?? []).filter((p) => p.path === path).map((p) => [p.key, p.sha256]),
    );
    const display = (key: string): string | null => {
      const id = keyId(path, key);
      return id === null ? null : id.slice(file.prefix.length);
    };
    const names = (keys: Iterable<string>): string[] => [...keys].flatMap((k) => display(k) ?? []);
    const result = (
      verdict: Verdict,
      line: string,
      extra: Partial<SharedWrite> = {},
    ): SharedWrite => {
      const out: SharedWrite = {
        path,
        verdict,
        line,
        changed: false,
        harness: [],
        added: [],
        kept: [],
        deleted: [],
        ...extra,
      };
      shared.push(out);
      return out;
    };
    if (disk === null && opts.onlyIfPresent) return result("leave", "");
    // #678 — 하네스 파일과 같은 판정. 몫 기록은 그대로 둔다(이번에 판정하지 않았다) · 화면은 `outside` 가 말한다.
    if (outside.skip(abs)) return result("leave", "");
    const j = judge({
      op: "write",
      kind: "shared",
      rec: { state: "none" },
      disk,
      next: null,
      adapter: file.adapter,
      hasPortions: own.size > 0,
    });
    if (j.verdict === "leave+advise") return result(j.verdict, j.line); // #574 — 한 바이트도 안 쓴다
    const rec =
      disk !== null && own.size === 0 && legacyLog && opts.legacySeed ? opts.legacySeed(disk) : own;
    const res = adapter.upsert(disk, {
      render,
      recorded: rec,
      excluded: excludedKeys(path, excluded),
      projectDir,
    });
    // judge 가 이미 읽었다 — 여기서 못 읽는 것은 같은 입력에 대한 두 판정이 갈린 것이다
    if (!res.ok) return result("leave+advise", j.line);
    if (res.changed) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, res.text);
    }
    portionPaths.push(path);
    for (const [key, sha256] of res.portions) {
      portions.push({ path, adapter: file.adapter, key, sha256 });
    }
    const deleted = res.deleted.flatMap((k) => keyId(path, k) ?? []);
    deletedIds.push(...deleted);
    if (j.record === "created") {
      rootFiles.push({ path, change: "created", notes: [opts.createdNote ?? "하네스 몫만"] });
    }
    const valueKeys = [...res.portions.keys()].filter((k) => !isContainerKey(k));
    // 바뀐 것이 없으면 "썼다" 고 하지 않는다 — 하네스 몫이 이미 있거나, 설치자 것이 그 자리를 다 채웠다
    const line = res.changed
      ? j.line
      : valueKeys.length > 0
        ? "kept — the harness part is already in place"
        : "nothing written — yours already has these";
    return result(j.verdict, line, {
      changed: res.changed,
      harness: names(valueKeys),
      added: names(valueKeys.filter((k) => !rec.has(k))),
      kept: names(res.kept),
      deleted: deleted.map((id) => id.slice(file.prefix.length)),
    });
  }

  return {
    harness,
    shared: sharedWrite,
    skipOutside: (abs) => outside.skip(abs),
    ledger: () => ({
      policyFiles: toFiles(policy),
      skillFiles: toFiles(skills),
      externalFiles: toFiles(external),
      anchor,
      rootFiles: [...rootFiles],
      portions: [...portions],
      portionPaths: [...portionPaths],
      deletedIds: [...deletedIds],
      backups: [...backups],
      judged: [...judged],
      shared: [...shared],
      outside: outside.list(),
    }),
  };
}

function toFiles(m: ReadonlyMap<string, string>): InstallLogSkillFile[] {
  return [...m].map(([path, sha256]) => ({ path, sha256 }));
}

/* ────────────────────────────────────────────────────────────────────────────
 * 제외 목록 — 누적한다(설계 §6.2 ⓒ · Q2). 새로 계산해 덮지 않는다.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 이번 실행 뒤의 `excluded`. 옛 기록(`excluded` + 옛 두 필드의 합집합) ∪ 이번 `--without` ∪ 설치자가 지운 키
 * − 이번 `--with`. 어느 실행도 이 목록을 새로 계산해 덮지 않는다.
 */
export function cumulativeExcluded(
  previous: InstallLog | null,
  add: ReadonlyArray<string>,
  remove: ReadonlyArray<string>,
): Set<string> {
  const out = new Set([...excludedIds(previous), ...add]);
  for (const id of remove) out.delete(id);
  return out;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 누적 — 쓰기 = 기록 (설계 §1.2 "소유 근거 = 기록에 있는 경로")
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 옛 판이 디스크를 훑어 적은 `policyFiles`·`skillFiles` 를 **한 번** 거른다(Q1) — `recorded()` 가 기록으로
 * 읽는 것만 남긴다. 새 판이 적은 로그(`records: "writer"`)는 그대로다.
 */
export function inheritScanned(previous: InstallLog | null): {
  policyFiles: InstallLogSkillFile[];
  skillFiles: InstallLogSkillFile[];
} {
  if (previous === null) return { policyFiles: [], skillFiles: [] };
  const policyFiles = previous.policyFiles ?? [];
  const skillFiles = previous.skillFiles ?? [];
  if (previous.records === "writer")
    return { policyFiles: [...policyFiles], skillFiles: [...skillFiles] };
  const owned = (full: string) => recorded(previous, full).state !== "none";
  return {
    policyFiles: policyFiles.filter((f) => owned(`${CLAUDE_DIR}${f.path}`)),
    skillFiles: skillFiles.filter((f) => owned(`${SKILLS_DIR}${f.path}`)),
  };
}

/**
 * 이번 실행의 기록을 옛 기록 위에 쌓는다. `base` 는 `buildInstallLog` 결과(spec · templates · assets · rootFiles).
 * 네 필드 모두 `mergeExternalFiles` 규칙(같은 경로면 이번 값 · 디스크에서 사라진 것만 뺀다)이다.
 */
export function composeWriterLog(args: {
  projectDir: string;
  base: InstallLog;
  previous: InstallLog | null;
  ledger: WriteLedger;
  /** 외부 CLI 변환 · 링크 본문이 쓴 것 — 같은 `externalFiles` 필드다. */
  cliFiles: ReadonlyArray<InstallLogSkillFile>;
  excluded: ReadonlySet<string>;
}): InstallLog {
  const { projectDir, base, previous, ledger } = args;
  const inherited = inheritScanned(previous);
  const policyFiles = mergeExternalFiles(
    join(projectDir, ".claude"),
    inherited.policyFiles,
    ledger.policyFiles,
  );
  const skillFiles = mergeExternalFiles(
    join(projectDir, ".claude/skills"),
    inherited.skillFiles,
    ledger.skillFiles,
  );
  const externalFiles = mergeExternalFiles(projectDir, previous?.externalFiles, [
    ...args.cliFiles,
    ...ledger.externalFiles,
  ]);
  const touched = new Set(ledger.portionPaths);
  const portions = [
    ...(previous?.portions ?? []).filter((p) => !touched.has(p.path)),
    ...ledger.portions,
  ];
  const excluded = [...new Set([...args.excluded, ...ledger.deletedIds])];
  const log: InstallLog = { ...base, records: "writer" };
  delete log.policyFiles;
  delete log.skillFiles;
  delete log.externalFiles;
  delete log.portions;
  delete log.excluded;
  return {
    ...log,
    ...(policyFiles.length > 0 ? { policyFiles } : {}),
    ...(skillFiles.length > 0 ? { skillFiles } : {}),
    ...(externalFiles.length > 0 ? { externalFiles } : {}),
    ...(portions.length > 0 ? { portions } : {}),
    ...(excluded.length > 0 ? { excluded } : {}),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 함께 쓰는 파일의 하네스 몫 렌더 + 옛 로그의 몫 찾기(§5 — 내용 식별은 여기서만)
 * ──────────────────────────────────────────────────────────────────────────── */

type JsonObject = Record<string, unknown>;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 템플릿 `settings.json` 에서 하네스 몫이 아닌 최상위 키 — `_comment` 는 설명일 뿐이다(§6.2). */
const SETTINGS_NOT_PORTION = new Set(["_comment"]);

/**
 * `.claude/settings.json` 의 하네스 몫 — 템플릿에서 **이번 선택으로** 렌더한다(N13: 사후 정리가 필요 없다).
 *
 * - `statusLine` → 키 `statusLine`
 * - 훅 핸들러 → 키 `hooks.<Event>#<script>`, 값 = 그 핸들러 하나를 담은 묶음(`json-keys` 계약). 스크립트가
 *   이번에 깔리지 않으면(`--without baseline:hooks/…`) 렌더하지 않는다 — 없는 스크립트를 부르는 참조를 쓰지 않는다.
 *
 * 몫으로 옮길 수 없는 템플릿 내용(다른 최상위 키 · `.claude/hooks/` 밖 스크립트를 부르는 핸들러)은 **조용히
 * 빠뜨리지 않고 던진다** — 템플릿을 고친 사람이 CI 에서 바로 본다.
 */
export function renderSettingsPortion(
  templateText: string,
  hookInstalled: (script: string) => boolean,
): Map<string, unknown> {
  const tpl = JSON.parse(templateText) as unknown;
  if (!isObject(tpl)) throw new Error("templates/settings.json: not a JSON object");
  const render = new Map<string, unknown>();
  for (const [key, value] of Object.entries(tpl)) {
    if (SETTINGS_NOT_PORTION.has(key)) continue;
    if (key === "hooks") continue;
    if (key !== "statusLine") {
      throw new Error(
        `templates/settings.json: '${key}' has no harness-portion key — teach the installer first`,
      );
    }
    render.set(key, value);
  }
  const hooks = isObject(tpl.hooks) ? tpl.hooks : {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups))
      throw new Error(`templates/settings.json: hooks.${event} is not an array`);
    for (const group of groups) {
      const { hooks: handlers, ...rest } = isObject(group) ? group : { hooks: undefined };
      if (!Array.isArray(handlers))
        throw new Error(`templates/settings.json: hooks.${event} group has no hooks[]`);
      for (const handler of handlers) {
        const script = hookScript(handler);
        if (script === null) {
          throw new Error(
            `templates/settings.json: a hooks.${event} handler does not call a .claude/hooks/*.sh script — it cannot be written as a harness portion`,
          );
        }
        if (!hookInstalled(script)) continue;
        render.set(`hooks.${event}#${script}`, { ...rest, hooks: [handler] });
      }
    }
  }
  return render;
}

/** 핸들러가 부르는 이 프로젝트의 `.claude/hooks/<script>` — 판정은 `json-keys` 와 같은 함수(`projectAnchoredRef`). */
function hookScript(handler: unknown, claudeDir?: string): string | null {
  if (!isObject(handler) || typeof handler.command !== "string") return null;
  const ref = projectAnchoredRef(handler.command, claudeDir);
  if (ref === undefined || !ref.startsWith("hooks/")) return null;
  const script = ref.slice("hooks/".length);
  return script.includes("/") ? null : script;
}

/**
 * 옛 로그의 `settings.json` 몫 찾기(§5): 하네스 훅 스크립트를 부르는 핸들러. 옛 판은 이 파일을 템플릿으로 통째
 * 덮었으므로 그 핸들러와 묶음은 하네스가 쓴 것이다. 은퇴한 훅(`RETIRED_PATHS`)을 부르는 핸들러도 몫으로 잡는다 —
 * 옛 판은 덮어쓰기로 그것을 치웠고, 이제 렌더에 없으니 upsert 가 뺀다.
 *
 * 렌더에 있는 키의 기록 sha 는 **렌더 값**으로 둔다 — 지금 값이 다르면(설치자가 고쳤거나 옛 표기) 설치자 쪽이
 * 이긴다("kept"). 지금 값으로 두면 고친 핸들러를 백업 없이 새 판으로 덮는다.
 */
export function legacySettingsSeed(
  text: string,
  render: ReadonlyMap<string, unknown>,
  projectDir: string,
): Map<string, string> {
  const seed = new Map<string, string>();
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return seed;
  }
  const claudeDir = join(projectDir, ".claude");
  const candidates = new Set([...render.keys()].filter((k) => k.startsWith("hooks.")));
  const hooks = isObject(root) && isObject(root.hooks) ? root.hooks : {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isObject(group) || !Array.isArray(group.hooks)) continue;
      for (const handler of group.hooks) {
        const script = hookScript(handler, claudeDir);
        if (script !== null && RETIRED_PATHS.includes(`hooks/${script}`)) {
          candidates.add(`hooks.${event}#${script}`);
        }
      }
    }
  }
  const present = ADAPTERS["json-keys"].read(text, candidates, projectDir) ?? new Map();
  for (const [key, sha] of present) {
    const rendered = render.get(key);
    const handler =
      isObject(rendered) && Array.isArray(rendered.hooks) ? rendered.hooks[0] : undefined;
    seed.set(key, handler === undefined ? sha : jsonSha(handler));
    seed.set(`${key}{}`, "legacy"); // 묶음도 하네스가 썼다 — 비면 걷는다(설치자 핸들러가 남아 있으면 남긴다)
  }
  return seed;
}

/**
 * 옛 로그의 `.mcp.json` 몫 찾기(§5): 하네스가 **만든** 파일(`rootFiles.change === "created"`)일 때만 템플릿 서버
 * 이름으로. 설치자 파일에 병합한 경우는 같은 이름이어도 설치자 것으로 둔다(남기고 알린다).
 */
export function legacyMcpSeed(
  text: string,
  render: ReadonlyMap<string, unknown>,
  previous: InstallLog | null,
): Map<string, string> {
  const seed = new Map<string, string>();
  const created = (previous?.rootFiles ?? []).some(
    (f) => f.path === ".mcp.json" && f.change === "created",
  );
  if (!created) return seed;
  const present = ADAPTERS["json-keys"].read(text, render.keys()) ?? new Map();
  for (const key of present.keys()) seed.set(key, jsonSha(render.get(key)));
  seed.set("mcpServers{}", "legacy");
  return seed;
}

/** 옛 판 `.gitignore` 기록의 설명 머리 — `collectRootFiles` 가 적는 모양 그대로다. */
export const GITIGNORE_NOTE_PREFIX = "추가된 줄: ";

/**
 * 옛 로그의 `.gitignore` 몫 찾기(§5): `rootFiles.notes` 가 적은 줄. 기록 sha 는 렌더 값(딸린 주석 포함)으로 둔다 —
 * 그 모양 그대로 남아 있으면 하네스 몫이고, 설치자가 고쳤으면 설치자 쪽이 이긴다.
 */
export function legacyGitignoreSeed(
  text: string,
  render: ReadonlyMap<string, string>,
  previous: InstallLog | null,
): Map<string, string> {
  const noted = new Set(
    (previous?.rootFiles ?? [])
      .filter((f) => f.path === ".gitignore")
      .flatMap((f) => f.notes)
      .filter((n) => n.startsWith(GITIGNORE_NOTE_PREFIX))
      .flatMap((n) => n.slice(GITIGNORE_NOTE_PREFIX.length).split(", ")),
  );
  const candidates = [...render.keys()].filter((k) => noted.has(k));
  const present = ADAPTERS.lines.read(text, candidates) ?? new Map();
  const seed = new Map<string, string>();
  for (const key of present.keys()) {
    const value = render.get(key);
    if (value !== undefined) seed.set(key, hashContent(value));
  }
  return seed;
}

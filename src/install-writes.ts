/**
 * install · `--reinstall` 의 쓰기 — 판정 함수 하나(`judge`)를 실행하고, 쓴 것을 **쓰는 순간** 기록한다
 * (#551 PR-3 · ADR-097 Decision 1·3·4 · 설계 `docs/plans/one-principle-design-2026-09-27.md` §1.2 · §5 · §6.2).
 *
 * 두 종류만 다룬다:
 *   - **하네스 파일** — 파일 통째. `recorded()` 가 기록 상태를, `judge` 가 행동 하나와 화면 한 줄을 정한다.
 *     첫 접촉(기록 없음 + 다른 내용) · 설치자가 고친 파일 · sha 없는 옛 기록은 **그 파일 하나**를
 *     `<file>.backup-<ts>` 로 남기고 최신판을 쓴다. 폴더 단위 백업·이동은 없다.
 *   - **함께 쓰는 파일** — 어댑터(`src/adapters/`)로 하네스 몫만 더하고 바꾼다. 읽지 못하면 한 바이트도 쓰지
 *     않고 남긴다(#574). 기록에 있는데 사라진 하네스 키는 되돌린다(ADR-099 R1 — 빼기는 `--without` · 위저드로만).
 *
 * 기록은 여기서 모으고 `composeWriterLog` 가 옛 기록 위에 **누적**한다(`mergeExternalFiles` 규칙 — 디스크에서
 * 사라진 항목도 남긴다, ADR-099 R2). 옛 판이 디스크를 훑어 적은 `policyFiles`·`skillFiles` 는 처음 쓸 때 소유 필터를 한 번
 * 거쳐 이어받고 `records: "writer"` 를 적는다(Q1).
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { ADAPTERS, excludedKeys, isKeyId, keyId, SHARED_FILES } from "./adapters/index.js";
import { isContainerKey, jsonSha } from "./adapters/json-keys.js";
import { BASELINE_PREFIX } from "./baseline-targets.js";
import { gitignoreRender, RETIRED_GITIGNORE_LINES } from "./env-files.js";
import { EXTERNAL_ASSETS } from "./external-assets.js";
import { backupFile, copyFile } from "./fs-ops.js";
import { isLegacyHookLine, projectAnchoredRef } from "./hook-ref.js";
import {
  appendSelection,
  HARNESS_VERSION,
  hashContent,
  type InstallLog,
  type InstallLogPortion,
  type InstallLogRootFile,
  type InstallLogSkillFile,
  installedClis,
  mergeExternalFiles,
} from "./install-log.js";
import { judge, type RecordEffect, type Verdict } from "./judge.js";
import { RETIRED_PATHS } from "./manifest.js";
import { type McpJson, toClaudeServer } from "./mcp-merge.js";
import { PRIOR_MCP_SERVERS, priorMcpValues, retiredMcpNames } from "./mcp-prior.js";
import { createOutsideGuard, type OutsideLink } from "./outside-project.js";
import { HARNESS_ANCHOR_FILE } from "./project-claude-merge.js";
import { excludedIds, type RecordedOptions, recorded } from "./recorded.js";
import type { InstallSpec } from "./types.js";

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

/**
 * 하네스 파일 판정 **전부**(조용한 create · overwrite · leave 포함) — `JudgedWrite` 는 화면에 알릴 것만 담는다. update 가 이
 * writer 로 쓸 때 화면 필드(되살림 · 새 파일 · 백업 · displaced)를 여기서 유도한다(#796 설계 §5.1). 프로젝트 밖 링크로 멈춘 자리는
 * 판정하지 않았으므로 없다(`outside`).
 */
export interface WriteEntry {
  /** project-relative */
  path: string;
  verdict: Verdict;
  record: RecordEffect;
  /** `judge` 의 `line` 에 실제 백업 경로를 넣은 것. 빈 문자열 = 알릴 것이 없다. */
  line: string;
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
  /**
   * 기록에 있는데 파일에 없어 이번에 되돌린 하네스 키 — **키 id**(`mcp:github`). 화면이 `was missing — restored` 와
   * 빼는 명령(`--without <id>` — update 가 지키고 다음 install 이 대체)을 함께 말한다(ADR-099 R1 · §4).
   */
  restored: string[];
  /** `added` 의 키 id — 옛 판이 뺀 것으로 적었던 키를 되살렸는지(R5) 가른다. */
  addedIds: string[];
  /** 설치자가 뺀(`excluded`) 키 중 이번에 파일에서 걷은 것 — 키 id. 화면이 "걷었다" 고 확인한다(리뷰 #693 NOTE-2). */
  removedOut: string[];
  /** `removedOut` 중 설치자가 고친 값이었는데도 걷은 것(훅 핸들러 — 스크립트 참조라 남기면 죽은 참조, N-f). */
  removedEdited: string[];
  /**
   * #800 — 고친 하네스 몫을 걷기 전에 만든 이 파일의 백업 1개 — project 상대(화면) · 절대(`backups` 와 짝). 고친 것을 걷지
   * 않았으면 없다.
   */
  backup?: string;
  backupAbs?: string;
  /** 설치자가 뺐지만 고쳐 둬서 남긴 키 — 키 id. 하네스는 더 관리하지 않는다. `kept` 와 겹치지 않는다. */
  keptOut: string[];
  /**
   * 하네스가 더는 렌더하지 않아 이번에 걷은 키(설치자가 뺀 것 제외) — 화면용 짧은 이름. 부재 = 없음. 화면이 바뀐 까닭을
   * 덧붙일 때 쓴다(`.gitignore` 의 `.uzys-agent-harness/` → 런타임 파일 두 줄, ADR-100).
   */
  retired?: string[];
  /**
   * #722 (ADR-106) — 기록 sha 그대로라 새 판으로 갈아 끼운 키(화면용 짧은 이름). 부재 = 없음. 화면은 `.mcp.json` 에서만
   * `updated: <name> (<까닭>)` 로 말한다 — 갈아 끼운 서버가 화면 어디에도 안 나오면 설치자는 무엇이 바뀌었는지 모른다.
   */
  replaced?: string[];
  /** #722 — 이름 → 화면이 `updated` · `retired` 옆에 붙이는 까닭(`PRIOR_MCP_SERVERS` · 트랙 기본 여부에서). */
  notes?: Record<string, string>;
  /**
   * #711 — 쓴 뒤 파일에 있는 하네스 서버 중 원격(HTTP) 서버. `bearerEnv` 가 있으면 토큰 환경변수, 없으면 첫 사용 때 로그인
   * (OAuth). 화면 NEXT 가 첫 사용 안내를 이것으로 낸다.
   */
  remote?: Array<{ name: string; bearerEnv?: string }>;
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
  /** 만든 백업 파일의 절대경로. */
  backups: string[];
  judged: JudgedWrite[];
  /** 하네스 파일 판정 전부 — 쓴 순서. */
  writes: WriteEntry[];
  shared: SharedWrite[];
  /** #678 — 링크를 따라가면 프로젝트 밖이라 쓰지 않은 자리. 기록도 하지 않는다(우리 것으로 삼지 않는다). */
  outside: OutsideLink[];
}

export type HarnessSource = { source: string } | { content: string };

export interface SharedOptions {
  /** 파일이 없으면 만들지 않는다(`.gitignore` — 지금처럼 있을 때만 줄을 더한다). */
  onlyIfPresent?: boolean;
  /**
   * 파일이 없으면 **기록에 이 파일이 있을 때만**(몫 · `rootFiles`) 만든다(update — ADR-099 R2). update 는 고르지 않은 것을
   * 새로 깔지 않지만, 기록에 있는데 사라진 하네스 몫은 되돌린다 — '기록에 있다' 가 근거다.
   */
  onlyIfRecorded?: boolean;
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
 * @param run 하네스 파일 판정의 동작(`judge` 의 `run`) — 같은 칸 안의 문구(update 의 되살림 · 새 파일)만 가른다. 기본 install.
 */
export function createInstallWriter(args: {
  projectDir: string;
  previousLog: InstallLog | null;
  excluded: ReadonlySet<string>;
  now?: Date;
  run?: "install" | "update";
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
  const backups: string[] = [];
  const judged: JudgedWrite[] = [];
  const writes: WriteEntry[] = [];
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
      ...(args.run === undefined ? {} : { run: args.run }),
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
    const line = backup === undefined ? j.line : j.line.replace(BACKUP_PLACEHOLDER, backup);
    const backupPair = backup === undefined || backupAbs === undefined ? {} : { backup, backupAbs };
    writes.push({ path, verdict: j.verdict, record: j.record, line, ...backupPair });
    if (j.line === "" || j.verdict === "create" || j.verdict === "overwrite") return null;
    const out: JudgedWrite = { path, verdict: j.verdict, line, ...backupPair };
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
        restored: [],
        addedIds: [],
        removedOut: [],
        removedEdited: [],
        keptOut: [],
        ...extra,
      };
      shared.push(out);
      return out;
    };
    if (disk === null && opts.onlyIfPresent) return result("leave", "");
    const recordedFile =
      own.size > 0 ||
      (previousLog?.rootFiles ?? []).some((f) => f.path === path && f.change !== "displaced");
    if (disk === null && opts.onlyIfRecorded && !recordedFile) return result("leave", "");
    // #678 — 하네스 파일과 같은 판정. 몫 기록은 그대로 둔다(이번에 판정하지 않았다) · 화면은 `outside` 가 말한다.
    if (outside.skip(abs)) return result("leave", "");
    const j = judge({
      op: "write",
      kind: "shared",
      rec: { state: "none" },
      disk,
      next: null,
      adapter: file.adapter,
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
    // 없는 파일에 쓸 하네스 몫이 하나도 없으면(전부 `--without` · 렌더가 빔) 만들지 않는다 — `{}` 는 하네스 몫이 아니다.
    // 기록도 건드리지 않는다(`shared-write.ts` 의 refresh 가드와 같은 규칙)
    if (disk === null && ![...res.portions.keys()].some((k) => !isContainerKey(k))) {
      return result("leave", "");
    }
    let backupAbs: string | undefined;
    if (res.changed) {
      // #800 — 고친 하네스 몫(훅 핸들러 — 남기면 사라진 스크립트를 부른다, N-f)을 걷을 때는 하네스 파일과 같은 규칙: 쓰기 전에
      // 그 파일 하나를 백업한다. 고치지 않은 몫만 걷으면 잃을 것이 없어 백업하지 않는다
      if (disk !== null && res.removedEdited.length > 0) {
        backupAbs = backupFile(abs, now);
        backups.push(backupAbs);
      }
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, res.text);
    }
    portionPaths.push(path);
    for (const [key, sha256] of res.portions) {
      portions.push({ path, adapter: file.adapter, key, sha256 });
    }
    // 되돌린 키 — 어댑터가 되돌린 것 + 파일째 없어 새로 만들 때 다시 들어간 기록된 키
    const restoredKeys = new Set([
      ...res.restored,
      ...(disk === null ? [...res.portions.keys()].filter((k) => rec.has(k)) : []),
    ]);
    const restored = [...restoredKeys].flatMap((k) => keyId(path, k) ?? []);
    if (j.record === "created") {
      rootFiles.push({ path, change: "created", notes: [opts.createdNote ?? "하네스 몫만"] });
    }
    // 파일에 있는 몫만 — 기록 sha 만 이은 키(`missing`)는 파일에 없다
    const absent = new Set(res.missing);
    const valueKeys = [...res.portions.keys()].filter((k) => !isContainerKey(k) && !absent.has(k));
    const addedKeys = valueKeys.filter((k) => !rec.has(k));
    const ids = (keys: Iterable<string>): string[] =>
      [...keys].flatMap((k) => keyId(path, k) ?? []);
    // 설치자가 뺀 키 — 걷은 것 · 고쳐 둬서 남긴 것을 따로 말한다(리뷰 #693 NOTE-2)
    const out = excludedKeys(path, excluded);
    const removedOut = res.removed.filter((k) => out.has(k));
    // #800 — 고친 몫을 걷었으면 뺀 키든 은퇴한 배선이든 같다 — 백업에 있다고 말한다
    const removedEdited = res.removedEdited;
    const keptOut = res.kept.filter((k) => out.has(k));
    // 걷기만 한 실행은 "썼다" 고 하지 않는다. 고친 값까지 걷었으면 "yours stays" 라 하지 않는다
    const onlyRemoved =
      disk !== null &&
      res.removed.length > 0 &&
      res.replaced.length === 0 &&
      addedKeys.length === 0 &&
      restoredKeys.size === 0;
    const wrote = onlyRemoved ? "removed the harness part" : j.line;
    // 바뀐 것이 없으면 "썼다" 고 하지 않는다 — 하네스 몫이 이미 있거나, 설치자 것이 그 자리를 다 채웠다
    const line = res.changed
      ? removedEdited.length > 0
        ? wrote.replace(" — yours stays", "")
        : wrote
      : valueKeys.length > 0
        ? "kept — the harness part is already in place"
        : "nothing written — yours already has these";
    const retired = names(res.removed.filter((k) => !out.has(k) && !render.has(k)));
    const replaced = names(res.replaced);
    return result(j.verdict, line, {
      ...(backupAbs === undefined ? {} : { backup: rel(backupAbs), backupAbs }),
      ...(retired.length > 0 ? { retired } : {}),
      ...(replaced.length > 0 ? { replaced } : {}),
      changed: res.changed,
      harness: names(valueKeys),
      added: names(addedKeys),
      kept: names(res.kept.filter((k) => !out.has(k))),
      restored,
      addedIds: ids(addedKeys),
      removedOut: ids(removedOut),
      removedEdited: ids(removedEdited),
      keptOut: ids(keptOut),
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
      backups: [...backups],
      judged: [...judged],
      writes: [...writes],
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
 * 이번 실행 뒤의 `excluded`. 옛 기록(`excluded` + 옛 두 필드의 합집합) ∪ 이번 `--without` − 이번 `--with`.
 * 어느 실행도 이 목록을 새로 계산해 덮지 않고, 설치자가 명시하지 않은 것은 더하지 않는다(ADR-099 R1).
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

/**
 * 빼기 집합 → spec 의 선택 입력(`baselineExclude` · `userOverride.forceExclude`). 베이스라인 · 번들 스킬 · 외부 자산을 고르는
 * 독자가 spec 하나만 읽게 한다(새 독자를 따로 두지 않는다). `forceInclude` 는 그대로다.
 */
function specWithExclusions(spec: InstallSpec, excluded: ReadonlySet<string>): InstallSpec {
  const baselineExclude = [...excluded].filter((id) => id.startsWith(BASELINE_PREFIX));
  const forceExclude = [...excluded].filter(
    (id) => !id.startsWith(BASELINE_PREFIX) && !isKeyId(id),
  );
  const forceInclude = spec.userOverride?.forceInclude ?? [];
  const { baselineExclude: _b, userOverride: _u, ...rest } = spec;
  return {
    ...rest,
    ...(forceInclude.length > 0 || forceExclude.length > 0
      ? { userOverride: { forceInclude: [...forceInclude], forceExclude } }
      : {}),
    ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
  };
}

/**
 * **update** 의 선택 — 기록의 최신 빼기를 읽기만 한다(ADR-099 · 설계 `selection-record-design-2026-10-04.md` §3). 이번 플래그가
 * 있으면 얹지만 update 에는 플래그가 없다. 같은 spec 에 다시 걸어도 결과가 같다.
 */
export function withRecordedExclusions(
  spec: InstallSpec,
  previous: InstallLog | null,
): { spec: InstallSpec; excluded: Set<string> } {
  const excluded = cumulativeExcluded(
    previous,
    [
      ...(spec.baselineExclude ?? []),
      ...(spec.userOverride?.forceExclude ?? []),
      ...(spec.keyExclude ?? []),
    ],
    [],
  );
  return { spec: specWithExclusions(spec, excluded), excluded };
}

/**
 * **install** 의 선택 = 그 실행의 입력(설계 §3 · 사용자 요구 2026-10-04). 끝난 뒤의 `excluded` 는 이번 실행이 뺀 것이고, 기록의
 * 최신 선택을 **대체**한다 — 플래그 없는 install 은 전에 뺀 것을 다시 깐다. 대체 범위 = 그 실행이 `--without` 으로 받을 수 있는
 * id 집합(`accepts` — R4: 카탈로그 · 번들 스킬 · 이번 트랙의 baseline · 깔린 CLI ∪ 이번 `--cli` 의 키 id). 그 밖의 id(이번 트랙에
 * 없는 트랙의 baseline 등)는 기록을 그대로 이어받는다 — 이번 실행이 말할 수 없었던 것은 선택이 아니다.
 *
 * 같은 id 가 `--with` 와 `--without` 에 함께 오면 빼기가 이긴다(명령은 R6 로 미리 거절한다). 같은 spec 에 다시 걸어도 같다.
 */
export function thisRunExclusions(
  spec: InstallSpec,
  previous: InstallLog | null,
  accepts: (id: string) => boolean,
): { spec: InstallSpec; excluded: Set<string> } {
  const excluded = new Set([
    ...[...excludedIds(previous)].filter((id) => !accepts(id)),
    ...(spec.baselineExclude ?? []),
    ...(spec.userOverride?.forceExclude ?? []),
    ...(spec.keyExclude ?? []),
  ]);
  return { spec: specWithExclusions(spec, excluded), excluded };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 누적 — 쓰기 = 기록 (설계 §1.2 "소유 근거 = 기록에 있는 경로")
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 옛 판이 디스크를 훑어 적은 `policyFiles`·`skillFiles` 를 **한 번** 거른다(Q1) — `recorded()` 가 기록으로
 * 읽는 것만 남긴다. 새 판이 적은 로그(`records: "writer"`)는 그대로다.
 *
 * `projectDir` 를 주면 옛 로그가 필드 없이 기록으로 읽는 은퇴 자리(`retiredClaims`)도 이어받는다.
 */
export function inheritScanned(
  previous: InstallLog | null,
  projectDir?: string,
): {
  policyFiles: InstallLogSkillFile[];
  skillFiles: InstallLogSkillFile[];
} {
  if (previous === null) return { policyFiles: [], skillFiles: [] };
  const policyFiles = previous.policyFiles ?? [];
  const skillFiles = previous.skillFiles ?? [];
  if (previous.records === "writer")
    return { policyFiles: [...policyFiles], skillFiles: [...skillFiles] };
  const owned = (full: string) => recorded(previous, full).state !== "none";
  const kept = policyFiles.filter((f) => owned(`${CLAUDE_DIR}${f.path}`));
  return {
    policyFiles:
      projectDir === undefined ? kept : [...kept, ...retiredClaims(previous, projectDir, kept)],
    skillFiles: skillFiles.filter((f) => owned(`${SKILLS_DIR}${f.path}`)),
  };
}

/**
 * 옛 로그가 기록으로 읽는데(`recorded()` 가 `none` 이 아니다) 필드에 적혀 있지 않은 은퇴 자리(`RETIRED_PATHS`) 중 디스크에 있는 것.
 *
 * 왜 (PR-D 재리뷰 BLOCKER-1 ②): 필드가 없던 판(v26.125.0 이하)의 은퇴 룰 · 훅 · 에이전트는 로그 수준 `no-sha` 로만 하네스 것이다
 * — 필드가 없다는 사실 자체가 근거다. 새 install(writer 기록) · update(`policyFiles` 를 지금 템플릿으로 채운다)가 필드를 쓰면 그
 * 근거가 사라져 그 뒤 uninstall 이 그 자리를 "기록 없음" 으로 읽어 라이브에 남기고, 다음 Claude Code 세션이 계속 로드한다. 그래서
 * 필드를 쓰는 두 곳이 이것을 이어 적는다. 이어받은 항목의 sha 는 하네스 내용의 증거가 아니다 — `recorded()` 는 은퇴 자리를 sha 와
 * 무관하게 `no-sha` 로 읽어 update(`pruneOrphans`) · uninstall 이 그 파일 하나를 백업하고 치운다(옛 스캔 항목과 같다).
 */
export function retiredClaims(
  previous: InstallLog,
  projectDir: string,
  kept: ReadonlyArray<InstallLogSkillFile>,
): InstallLogSkillFile[] {
  const have = new Set(kept.map((f) => f.path));
  const out: InstallLogSkillFile[] = [];
  for (const p of RETIRED_PATHS) {
    if (have.has(p) || recorded(previous, `${CLAUDE_DIR}${p}`).state === "none") continue;
    const abs = join(projectDir, CLAUDE_DIR, p);
    try {
      if (!statSync(abs).isFile()) continue;
      out.push({ path: p, sha256: hashContent(readFileSync(abs, "utf8")) });
    } catch {
      // 없다 · 읽지 못한다 — 이어받지 않는다(지우지 않는 쪽)
    }
  }
  return out;
}

/**
 * 이번 실행의 기록을 옛 기록 위에 쌓는다. `base` 는 `buildInstallLog` 결과(spec · templates · assets · rootFiles).
 * 세 필드 모두 `mergeExternalFiles` 규칙(같은 경로면 이번 값 · 디스크에서 사라진 것도 남긴다 — ADR-099 R2)이다.
 */
export function composeWriterLog(args: {
  projectDir: string;
  base: InstallLog;
  previous: InstallLog | null;
  ledger: WriteLedger;
  /** 외부 CLI 변환 · 링크 본문이 쓴 것 — 같은 `externalFiles` 필드다. */
  cliFiles: ReadonlyArray<InstallLogSkillFile>;
  excluded: ReadonlySet<string>;
  /** 이력 항목의 경로 — 플래그 · 위저드. 기본 플래그. */
  via?: "flag" | "wizard";
  /** #600 — 도중에 멈춘 install 의 기록이다. */
  interrupted?: boolean;
}): InstallLog {
  const { base, previous, ledger } = args;
  const inherited = inheritScanned(previous, args.projectDir);
  const policyFiles = mergeExternalFiles(inherited.policyFiles, ledger.policyFiles);
  const skillFiles = mergeExternalFiles(inherited.skillFiles, ledger.skillFiles);
  const externalFiles = mergeExternalFiles(previous?.externalFiles, [
    ...args.cliFiles,
    ...ledger.externalFiles,
  ]);
  const touched = new Set(ledger.portionPaths);
  const portions = [
    ...(previous?.portions ?? []).filter((p) => !touched.has(p.path)),
    ...ledger.portions,
  ];
  const excluded = [...args.excluded];
  const log: InstallLog = { ...base, records: "writer" };
  delete log.policyFiles;
  delete log.skillFiles;
  delete log.externalFiles;
  delete log.portions;
  delete log.excluded;
  delete log.selections;
  const composed: InstallLog = {
    ...log,
    ...(policyFiles.length > 0 ? { policyFiles } : {}),
    ...(skillFiles.length > 0 ? { skillFiles } : {}),
    ...(externalFiles.length > 0 ? { externalFiles } : {}),
    ...(portions.length > 0 ? { portions } : {}),
    ...(excluded.length > 0 ? { excluded } : {}),
    ...(previous?.selections && previous.selections.length > 0
      ? { selections: previous.selections }
      : {}),
  };
  // 설계 §1 — 이력은 `excluded` 가 실제로 바뀐 실행만(효과분). 비교 기준은 기록의 최신 선택(`excludedIds`, 옛 두 필드 포함)
  const before = excludedIds(previous);
  const after = new Set(excluded);
  return appendSelection(composed, {
    at: new Date().toISOString(),
    harness: HARNESS_VERSION,
    by: "install",
    via: args.via ?? "flag",
    with: [...before].filter((id) => !after.has(id)),
    without: excluded.filter((id) => !before.has(id)),
    ...(args.interrupted ? { interrupted: true as const } : {}),
  });
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
  opts: { edited?: boolean } = {},
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
  const legacyLines = new Set<string>(); // 옛 하네스 줄로 볼 수 있는 핸들러의 키(`isLegacyHookLine`)
  const hooks = isObject(root) && isObject(root.hooks) ? root.hooks : {};
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!isObject(group) || !Array.isArray(group.hooks)) continue;
      for (const handler of group.hooks) {
        const script = hookScript(handler, claudeDir);
        if (script === null) continue;
        const key = `hooks.${event}#${script}`;
        if (RETIRED_PATHS.includes(`hooks/${script}`)) candidates.add(key);
        if (isObject(handler) && isLegacyHookLine(handler.command, claudeDir)) legacyLines.add(key);
      }
    }
  }
  const present = ADAPTERS["json-keys"].read(text, candidates, projectDir) ?? new Map();
  for (const [key, sha] of present) {
    // #781 — 옛 템플릿 바이트 그대로인 줄만 하네스 몫이다. 고친 줄을 몫으로 적으면 다음 걷기가 설치자 몫까지 통째로 뺀다
    // (`alwaysStrip`). `edited` 는 알리기만 하는 uninstall 안내용 — 고친 줄도 "하네스 훅이 남았을 수 있다" 로 낸다
    if (!legacyLines.has(key) && opts.edited !== true) continue;
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
  // #722 (ADR-106) — 하네스가 **전에** 쓴 값(`PRIOR_MCP_SERVERS`)도 알아본다. 렌더에 있는 서버: 디스크가 옛 값 그대로면 그
  // sha 로 적어 새 값으로 갈아 끼운다(렌더 sha 로만 적으면 옛 값이 "설치자가 고친 것" 으로 읽혀 `kept yours` 라고 거짓 보고한다).
  // 렌더에 없는 서버는 **은퇴한 이름만**, 옛 값 그대로일 때만 적는다 — 그래야 upsert 가 걷는다. 살아 있는 이름은 선택
  // 근거로만 쓴다(`legacyMcpServers` — 렌더에 들어와 위 경로를 탄다)
  const retired = retiredMcpNames().map((n) => `mcpServers.${n}`);
  const candidates = [...render.keys(), ...retired.filter((k) => !render.has(k))];
  const present = ADAPTERS["json-keys"].read(text, candidates) ?? new Map();
  for (const [key, disk] of present) {
    const prior = priorMcpValues(key.slice("mcpServers.".length))
      .map((v) => jsonSha(toClaudeServer(v)))
      .find((sha) => sha === disk);
    if (render.has(key)) seed.set(key, prior ?? jsonSha(render.get(key)));
    else if (prior !== undefined) seed.set(key, prior);
  }
  seed.set("mcpServers{}", "legacy");
  return seed;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 루트 · `.claude/` 의 함께 쓰는 파일 셋 — install 과 update 가 **같은 함수**로 쓴다(ADR-099 R2)
 * ──────────────────────────────────────────────────────────────────────────── */

export const SETTINGS_TARGET = ".claude/settings.json";

/**
 * `.claude/settings.json` — 함께 쓰는 파일(`json-keys`). 템플릿을 **이번 선택으로** 렌더한 하네스 몫(훅 · statusLine)만
 * 더하고, 설치자의 키·훅·statusLine·model 은 그대로 둔다(#563). 못 읽으면 한 바이트도 쓰지 않는다(#574).
 * `projectDir` 는 필수다 — 옛 판이 절대경로로 박은 하네스 훅을 알아봐야 같은 훅이 두 번 돌지 않는다(PR-1 인계 ①).
 */
export function writeSettingsShared(
  writer: InstallWriter,
  templateText: string,
  projectDir: string,
  previousLog: InstallLog | null,
  hookInstalled: (script: string) => boolean,
  opts: Pick<SharedOptions, "onlyIfRecorded"> = {},
): SharedWrite {
  const render = renderSettingsPortion(templateText, hookInstalled);
  const claudeWasInstalled = previousLog !== null && installedClis(previousLog).includes("claude");
  return writer.shared(SETTINGS_TARGET, render, {
    ...opts,
    // 옛 판은 이 파일을 템플릿으로 통째 덮었다 — claude 를 깐 기록이 있을 때만 그 훅을 하네스 몫으로 찾는다
    legacySeed: (text) =>
      claudeWasInstalled ? legacySettingsSeed(text, render, projectDir) : new Map(),
    createdNote: "Claude Code 설정 — 하네스 몫만(훅 · statusLine)",
  });
}

/**
 * `.mcp.json` — 함께 쓰는 파일(`json-keys`). 하네스 서버(템플릿 + 트랙 표 — Codex · OpenCode 와 같은 원천,
 * #568)만 더한다. 설치자 서버와 같은 이름이면 설치자 것이 이긴다. 기록에 있는데 사라진 하네스 서버는 되돌린다
 * (ADR-099 R1·R2 — 빼기는 `--without mcp:<name>` 으로만).
 */
export function writeMcpShared(
  writer: InstallWriter,
  /** 이 실행의 하네스 서버(`renderHarnessMcp` — 트랙 + 선택). Codex · OpenCode 에 넘긴 것과 같은 값이다(#709). */
  mcp: McpJson,
  previousLog: InstallLog | null,
  opts: Pick<SharedOptions, "onlyIfRecorded"> = {},
  /**
   * #722 (설계 검증 B3) — 화면용: 이 실행의 트랙과 그 트랙의 **기본 행** 서버 이름(`trackDefaultMcpNames`). 기록으로 남은
   * 서버를 갈아 끼울 때 "이 트랙의 기본이 아니다 · 빼는 명령" 을 덧붙인다. 생략 = 덧붙이지 않는다.
   */
  defaults?: { tracks: ReadonlyArray<string>; names: ReadonlySet<string> },
): SharedWrite {
  const servers = mcp.mcpServers;
  const render = new Map<string, unknown>(
    Object.entries(servers).map(([name, cfg]) => [`mcpServers.${name}`, toClaudeServer(cfg)]),
  );
  const res = writer.shared(".mcp.json", render, {
    ...opts,
    legacySeed: (text) => legacyMcpSeed(text, render, previousLog),
    createdNote: "MCP 서버 정의 생성",
  });
  // 화면에만 쓰는 필드 — writer 가 기록에 넣은 같은 객체에 덧붙인다(기록 · 판정은 위에서 끝났다)
  const inFile = new Set(res.harness);
  const replaced = res.replaced ?? [];
  const notes: Record<string, string> = {};
  for (const p of PRIOR_MCP_SERVERS) {
    if (p.retired !== undefined && (res.retired ?? []).includes(p.name)) notes[p.name] = p.retired;
    if (p.updated !== undefined && replaced.includes(p.name)) notes[p.name] = p.updated;
  }
  if (defaults !== undefined) {
    for (const name of replaced) {
      const assetId = EXTERNAL_ASSETS.find(
        (a) => a.method.kind === "internal" && a.method.key === name,
      )?.id;
      if (assetId === undefined || defaults.names.has(name)) continue;
      const why = `not a default on ${defaults.tracks.join(", ")} — kept because your install record has it; drop it: agent-harness install … --without ${assetId}`;
      notes[name] = notes[name] === undefined ? why : `${notes[name]}; ${why}`;
    }
  }
  const remote = Object.entries(servers).flatMap(([name, cfg]) =>
    cfg.type === "http" && inFile.has(name)
      ? [cfg.auth === undefined ? { name } : { name, bearerEnv: cfg.auth.bearerEnv }]
      : [],
  );
  if (Object.keys(notes).length > 0) res.notes = notes;
  if (remote.length > 0) res.remote = remote;
  return res;
}

/**
 * `.gitignore` — 함께 쓰는 파일(`lines`). **있을 때만** 하네스 줄을 더한다(설계 §2 행 15 — 없는 파일은 만들지 않는다).
 * 설치자가 이미 둔 같은 줄은 설치자 것이다.
 */
export function writeGitignoreShared(
  writer: InstallWriter,
  previousLog: InstallLog | null,
): SharedWrite {
  const render = gitignoreRender();
  return writer.shared(".gitignore", render, {
    onlyIfPresent: true,
    legacySeed: (text) => legacyGitignoreSeed(text, render, previousLog),
  });
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
  // 더는 렌더하지 않는 옛 줄(ADR-100)도 그때의 값으로 알아본다 — 그래야 upsert 가 걷고 uninstall 이 알린다
  const lineValue = (key: string): string | undefined =>
    render.get(key) ?? RETIRED_GITIGNORE_LINES.get(key);
  const candidates = [...render.keys(), ...RETIRED_GITIGNORE_LINES.keys()].filter((k) =>
    noted.has(k),
  );
  const present = ADAPTERS.lines.read(text, candidates) ?? new Map();
  const seed = new Map<string, string>();
  for (const key of present.keys()) {
    const value = lineValue(key);
    if (value !== undefined) seed.set(key, hashContent(value));
  }
  return seed;
}

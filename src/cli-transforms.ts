/**
 * cli-transforms.ts — 외부 CLI(codex · opencode · antigravity) transform 실행 (v26.134.0 · ADR-049).
 *
 * `installer.ts` 안에 있던 것을 옮겼다. `update` 도 **같은 함수**를 써야 하기 때문이다 —
 * 소유자 판정이 세 자산 종류에 세 번 나눠 붙어 같은 버그가 세 번 난 게 ADR-046~048 의 역사이고
 * (`feedback_surface_symmetry`), 그 교훈은 "공통 규칙은 자산별 코드가 아니라 한 도구에" 였다.
 * install 과 update 가 각자 transform 을 부르면 기준선을 잇는 규칙이 두 벌이 되고, 그건 곧
 * 네 번째 재발이다. 겸사로 `update-mode.ts` → `installer.ts` 순환 import 도 생기지 않는다.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { keyId } from "./adapters/index.js";
import { agentsMdClis } from "./agents-md-render.js";
import {
  type AgentsMdTransformReport,
  LEGACY_ANTIGRAVITY_ANCHOR,
  runAgentsMdTransform,
} from "./agents-md-transform.js";
import {
  type AnchorRetireResult,
  readLegacyAntigravityContext,
  retireAntigravityAnchor,
} from "./antigravity/retire-anchor.js";
import {
  type AntigravityTransformReport,
  runAntigravityTransform,
} from "./antigravity/transform.js";
import { type CodexOptInReport, runCodexOptIn } from "./codex/opt-in.js";
import { type CodexTransformReport, runCodexTransform } from "./codex/transform.js";
import type { InstallLogPortion, InstallLogRootFile, InstallLogSkillFile } from "./install-log.js";
import type { JudgedWrite } from "./install-writes.js";
import {
  composeMcpJson,
  droppedMcpServers,
  type McpChoice,
  type McpJson,
  parseTrackMcpMap,
  selectableMcpServers,
  selectedMcpServers,
  type TrackMcpRow,
} from "./mcp-merge.js";
import { type OpencodeTransformReport, runOpencodeTransform } from "./opencode/transform.js";
import { createOutsideGuard, mergeOutside, type OutsideLink } from "./outside-project.js";
import type { OwnedWriteResult, WriteJournal } from "./owned-write.js";
import type { SharedRecord, SharedWriteResult } from "./shared-write.js";
import { anyTrack } from "./track-match.js";
import { CLI_BASES, type CliBase, type Track } from "./types.js";

/** Codex / OpenCode / Antigravity per-CLI transforms (+ `--with-codex-trust` opt-in) 결과. */
export interface CliTransformResults {
  codex: CodexTransformReport | null;
  codexOptIn: CodexOptInReport | null;
  opencode: OpencodeTransformReport | null;
  antigravity: AntigravityTransformReport | null;
  /**
   * #642 (ADR-103) — 루트 `AGENTS.md` 를 깔린 비-Claude CLI 집합으로 렌더한 결과. 집합이 비면(claude 단독) `null`.
   * codex · opencode 변환은 이 파일을 더는 쓰지 않는다 — 화면은 이것 하나를 읽는다.
   */
  agentsMd: AgentsMdTransformReport | null;
  /**
   * ADR-103 — 옛 Antigravity 앵커(`.agents/rules/uzys-harness.md`)를 은퇴시켰으면 그 결과. 기록에 앵커가 없으면 `null`.
   * `forget` 이면 호출부가 같은 기록 쓰기에서 `externalFiles` 에서 빼고 `spec.clis` 를 적는다(BLOCKER-1).
   */
  anchorRetired: AnchorRetireResult | null;
  /** v26.133.0 (ADR-048) — 세 transform 이 쓴 산출물의 기준선 (install log `externalFiles`). */
  externalFiles: InstallLogSkillFile[];
  /** v26.133.0 (ADR-048) — 사용자 편집분이라 만든 백업 파일 경로. 설치 화면에 노출한다. */
  externalBackups: string[];
  /** v26.134.0 (ADR-049) — 실제로 디스크가 바뀐 파일 수. update 화면의 카운트. */
  externalUpdated: number;
  /** v26.134.0 (ADR-049) — 백업된 사용자 편집분의 project-relative 경로. 첫 접촉은 `displaced` 다(#761). */
  externalBackedUp: string[];
  /** #817 — 세 변환의 백업마다 판정의 줄(`OwnedWriteResult.judged`) — update 화면이 파일마다 말한다. */
  externalJudged: JudgedWrite[];
  /**
   * #761 — 세 변환이 기준선에 없는 자리에서 만난 설치자 파일(첫 접촉, `OwnedWriteResult.displaced` · 경로당 하나).
   * 호출부(install · update)가 기록의 `rootFiles` 에 합친다. optional = 손으로 만드는 결과 stub 은 "없음".
   */
  displaced?: InstallLogRootFile[];
  /**
   * #343 — 다른 도구가 소유한 스킬 슬롯이라 쓰지 않은 자리 (`.agents/skills/<id>` 등).
   * `.claude/` baseline 의 같은 판정과 **한 줄로 합쳐** 화면에 낸다 — 사용자에게는 어느
   * 단계가 건너뛰었는지가 아니라 "어느 자리를 옮겨야 하는지"가 필요하다.
   */
  externalForeignOwned: string[];
  /** #678 — 세 변환이 링크를 따라가면 프로젝트 밖이라 쓰지 않은 자리(경로당 하나). */
  externalOutside: OutsideLink[];
  /**
   * #551 (ADR-097) — 함께 쓰는 파일(`.codex/config.toml` · `opencode.json` · 첫 접촉 `AGENTS.md`)마다 이번 실행의
   * 판정·결과. 화면이 한 줄씩 읽는다.
   */
  sharedFiles: SharedWriteResult[];
  /**
   * 이번 실행이 판정한 함께 쓰는 파일의 몫 전체 — **로그의 `portions` 에서 이 파일들의 항목을 이것으로 바꾼다**
   * (`sharedFiles[i].portions === null` 인 파일은 판정하지 않았으니 로그 항목을 그대로 둔다 — 그 경로는 여기 없다).
   * 로그에 쓰는 연결은 설계 §9 PR-3.
   */
  portions: InstallLogPortion[];
  /** 판정한 파일의 경로 — `portions` 가 대신하는 범위. */
  portionPaths: string[];
  /** ADR-099 R2 — refresh 모드(update)에서 기준선에 있는데 없어 되살린 산출물(project-relative, 중복 없음). */
  restoredFiles: string[];
}

export interface CliTransformParams {
  harnessRoot: string;
  projectDir: string;
  /** 대상 CLI. install 은 `spec.cli`, update 는 전부(`CLI_BASES`) — 아래 refreshOnly 주석 참조. */
  cli: ReadonlyArray<CliBase>;
  selectedInternalSkills: ReadonlyArray<string>;
  /**
   * 2026-08-12 — 이 설치에 깔릴 룰 이름들(`resolveRules`). 룰이 `.claude/rules/` 하나로만
   * 나가던 탓에 비 Claude 단독 설치는 룰을 한 종도 못 받았다. `selectedInternalSkills` 와 같은
   * 형태다 — 무엇을 깔지는 installer 가 정하고, 어디에 놓을지는 각 transform 이 정한다.
   */
  rules: ReadonlyArray<string>;
  /**
   * v26.165.0 독립 검증 NOTE-5 — 기록 트랙 ∪ 이번 트랙의 룰(`excluded` 제외). `AGENTS.md` 집합이 이번 `cli` 밖의 기록
   * CLI 를 포함하면(예: `install --cli claude --track data` 가 기록된 codex 의 `AGENTS.md` 를 다시 렌더) 그 파일의
   * `## Harness Rules` 는 이것으로 렌더한다 — 이번 트랙만 넣으면 다음 update 까지 그 CLI 가 룰을 잃는다.
   * 생략 = `rules` 그대로(update 는 이미 누적 트랙으로 `rules` 를 만든다).
   */
  cumulativeRules?: ReadonlyArray<string>;
  /**
   * #568 — 이 실행의 하네스 MCP 서버(`renderHarnessMcp`). Codex · OpenCode 가 Claude `.mcp.json` 과 **같은 값**을 받는다 —
   * 호출부가 한 번 렌더해 `.mcp.json` 쓰기와 여기에 함께 넘긴다(#709: 트랙 + 선택, 각자 렌더하면 선택이 갈릴 자리가 생긴다).
   * **required** — 빠뜨린 호출부가 조용히 기본 서버만 받으면 트랙 서버(railway 등)가 그 경로에서만 사라진다.
   */
  mcp: McpJson;
  /** install log 의 `externalFiles`. 없으면 빈 배열 = 판정 불가 → 보수적 백업. */
  previousExternal: ReadonlyArray<InstallLogSkillFile>;
  /**
   * v26.134.0 (ADR-049) — 이미 있는 산출물만 갱신하고 없는 것은 만들지 않는다 (`update` 경로).
   *
   * **이 플래그가 "어느 CLI 가 설치돼 있나"라는 질문 자체를 없앤다.** 안 깐 CLI 는 대상 파일이
   * 하나도 없어 자연히 아무것도 안 쓰므로, update 는 `CLI_BASES` 전부를 그냥 넘기면 된다 —
   * CLI 목록이나 스킬 목록의 **열거 사본을 만들 필요가 없다** (`no-false-ship` §게이트는
   * 열거하지 말고 훑어라와 같은 취지: 사람이 기억해야 하는 목록은 다음 drift 의 서식지다).
   *
   * 예외 하나: codex 와 opencode 는 같은 `AGENTS.md` 를 쓰므로 파일 존재가 둘을 못 가른다 — update 는
   * 그 둘만 설치 로그로 걸러 `cli` 에 넘긴다 (#514, `update-mode.ts` `installedCliTargets`).
   */
  refreshOnly?: boolean;
  /**
   * `~/.codex/config.toml` 에 이 폴더의 trust 항목을 등록한다 — `--with-codex-trust` 를 줬을 때만
   * (범위 조건 없음, ADR-097 결정 2). update 는 안 쓴다.
   */
  codexTrust?: boolean;
  /**
   * #551 (ADR-097) — 함께 쓰는 파일의 앞 기록: 설치 로그의 `portions` 와 `excludedIds(log)`. **기록 writer(PR-3)가 이
   * 결과의 `portions` 를 로그에 쓰고 다음 실행에 여기로 돌려줘야** 하네스 몫이 갱신된다 — 생략하면 기준선 sha 그대로인
   * 하네스 파일 말고는 하네스 구간·키를 갈아 끼우지 않고 남긴다(`shared-write.ts` `SharedRecord`).
   */
  shared?: SharedRecord;
  /**
   * #600 — 세 변환이 쓰는 즉시 받아 적을 곳(install). 변환이 중간에 던지면 결과가 돌아오지 않으므로 install 은
   * 이 저널로 그때까지 쓴 것을 기록한다. `done` 은 변환 하나가 **끝까지** 돈 CLI — 끝나지 않은 CLI 는 기록에
   * 깔린 CLI 로 적지 않는다(그 디렉터리를 하네스 것으로 주장하지 않는다).
   */
  /**
   * ADR-099 R2 (#584) — 설치 기록이 깔린 CLI 로 말하는 집합(`installedClis(log)`, update 가 넘긴다). refresh 모드에서 그 CLI 의
   * 산출물을 없어도 만드는 근거다 — 지금은 Antigravity 앵커·룰이 쓴다. 기록이 없으면(옛 설치본) 비워 둔다.
   */
  recordedClis?: ReadonlyArray<CliBase>;
  /**
   * #761 B-1 — 기준선(`previousExternal`) 밖이어도 기록이 하네스 것이라 말하는 경로(`recordedOwner(log)`). 외부 기록이 아예
   * 없던 옛 판의 산출물을 첫 접촉(displaced)으로 적지 않게 한다. 생략 = 기준선만 본다.
   */
  owned?: (rel: string) => boolean;
  journal?: WriteJournal & {
    done(cli: CliBase): void;
    /** 홈 Codex 설정에 trust 항목을 넣으려 한 결과 — 하네스가 실제로 넣었으면(`registered`) 중단 기록에도 남긴다. */
    trust(report: CodexOptInReport): void;
  };
}

/**
 * #568 — 하네스가 이 설치에 까는 MCP 서버(템플릿 `templates/mcp.json` + `templates/track-mcp-map.tsv`).
 *
 * Claude `.mcp.json` 을 만드는 `composeMcpJson` 과 **같은 함수**를 설치자 파일 없이 부른다 — 설치자
 * 파일과 합치기 **전**의 하네스 몫이다. Codex · OpenCode 는 예전에 하네스 루트의 `.mcp.json` 을 읽었는데,
 * 그 파일은 npm 패키지(`files`)에 없어 게시판에서는 OpenCode 의 `mcp` 가 늘 비었다.
 *
 * #709 (ADR-101) — 트랙 표의 기본 행 ∪ **선택된 행**(`selectedMcpServers` — 이번 선택 · 기록, 뺀 것 제외). 트랙만 보는
 * 렌더 경로는 두지 않는다 — 그런 자리가 하나라도 남으면 거기서만 기록된 선택 서버가 사라진다.
 */
export function renderHarnessMcp(harnessRoot: string, choice: McpChoice): McpJson {
  return composeMcpJson({
    ...mcpSources(harnessRoot),
    tracks: choice.spec.tracks,
    chosen: (rows) => selectedMcpServers(rows, choice),
    dropped: (rows) => droppedMcpServers(rows, choice.excluded),
  });
}

/**
 * #709 리뷰 NOTE 7 — 이 트랙의 **기본 행**인 고를 수 있는 MCP 서버의 자산 id. 위저드 3단계가 이것을 체크된 채 보인다 — 트랙 표가
 * 실제로 까는 것이 미체크(⚠ experimental)로 보이면 화면이 결과와 다르다. 체크를 풀면 명시적 빼기(`--without <id>`)다.
 */
export function trackDefaultMcpAssetIds(
  harnessRoot: string,
  tracks: ReadonlyArray<Track>,
): string[] {
  const rows = trackRows(harnessRoot);
  const selectable = selectableMcpServers(rows);
  return rows.flatMap((r) => {
    const id = selectable.get(r.name);
    return id !== undefined && anyTrack(tracks, r.pattern) ? [id] : [];
  });
}

/**
 * #904 — 설치자가 뺀 고를 수 있는 MCP 서버의 자산 id. 렌더가 서버를 거르는 규칙(`droppedMcpServers` — 자산 id · 키 id 둘 다)을
 * 그대로 써서 키 id(`mcp:<서버>`)를 자산 id 로 풀어 준다. 화면(ASSETS 줄 · 비용 줄)이 `.mcp.json` 과 같은 서버를 세게 하는 입력이다.
 */
export function droppedMcpAssetIds(harnessRoot: string, excluded: ReadonlySet<string>): string[] {
  const rows = trackRows(harnessRoot);
  const assetOf = selectableMcpServers(rows);
  return droppedMcpServers(rows, excluded).flatMap((name) => assetOf.get(name) ?? []);
}

/**
 * #722 (설계 검증 B3) — 이 트랙의 **기본 행** 서버 이름(트랙 표 패턴이 맞는 행 · 템플릿 서버). 화면이 기록으로 남은 서버를
 * 갈아 끼울 때 "이 트랙의 기본이 아니다" 를 가른다 — 렌더(`renderHarnessMcp`)와 같은 표를 읽는다.
 */
export function trackDefaultMcpNames(
  harnessRoot: string,
  tracks: ReadonlyArray<Track>,
): Set<string> {
  const { templateMcpPath } = mcpSources(harnessRoot);
  const base = existsSync(templateMcpPath)
    ? Object.keys((JSON.parse(readFileSync(templateMcpPath, "utf8")) as McpJson).mcpServers)
    : [];
  return new Set([
    ...base,
    ...trackRows(harnessRoot)
      .filter((r) => anyTrack(tracks, r.pattern))
      .map((r) => r.name),
  ]);
}

function trackRows(harnessRoot: string): TrackMcpRow[] {
  const { trackMapPath } = mcpSources(harnessRoot);
  return existsSync(trackMapPath) ? parseTrackMcpMap(readFileSync(trackMapPath, "utf8")) : [];
}

/**
 * #709 설계 NOTE-1 — 트랙 기본 행 ∪ **고를 수 있는 행 전부**. 몫 기록이 없는 옛 설치본에서 하네스 서버를 **값으로**
 * 알아보는 자리(uninstall 잔존 안내)만 쓴다 — 그 기록엔 선택이 없으니 고를 수 있었던 것 전부와 대조한다(지우지 않는다).
 */
export function renderEverySelectableMcp(
  harnessRoot: string,
  tracks: ReadonlyArray<Track>,
): McpJson {
  return composeMcpJson({
    ...mcpSources(harnessRoot),
    tracks,
    chosen: (rows) => [...selectableMcpServers(rows).keys()],
  });
}

/**
 * #709 — `.mcp.json` 어댑터에 넘기는 빼기 집합: `excluded` ∪ { 자산 id 로 뺀 선택 행의 키 id(`mcp:<name>`) }. 자산 id 로 뺀
 * 서버를 화면이 "retired(하네스가 더는 안 깐다)" 가 아니라 "dropped" 로 말하고, 기본 행이 있는 트랙에서도 걷게 한다.
 * **기록에는 싣지 않는다** — 실으면 `--with <id>` 가 자산 id 만 풀어 키 빼기가 영영 남는다.
 */
export function adapterExcluded(
  harnessRoot: string,
  excluded: ReadonlySet<string>,
): ReadonlySet<string> {
  const rows = trackRows(harnessRoot);
  const out = new Set(excluded);
  for (const [name, assetId] of selectableMcpServers(rows)) {
    const id = keyId(".mcp.json", `mcpServers.${name}`);
    if (excluded.has(assetId) && id !== null) out.add(id);
  }
  return out;
}

function mcpSources(harnessRoot: string): { templateMcpPath: string; trackMapPath: string } {
  return {
    templateMcpPath: join(harnessRoot, "templates/mcp.json"),
    trackMapPath: join(harnessRoot, "templates/track-mcp-map.tsv"),
  };
}

/**
 * update 가 넘기는 CLI 목록의 상한 — 전부. 판정은 `refreshOnly` 가 디스크로 대신한다(codex · opencode
 * 만 로그로, #514). `CLI_BASES` 에서 파생하므로 CLI 가 늘어도 여기를 고칠 필요가 없다.
 */
export const ALL_CLI_TARGETS: ReadonlyArray<CliBase> = CLI_BASES;

export function runCliTransforms(params: CliTransformParams): CliTransformResults {
  const {
    harnessRoot,
    projectDir,
    cli,
    selectedInternalSkills,
    rules,
    mcp,
    previousExternal,
    refreshOnly = false,
    codexTrust = false,
    shared = {},
    recordedClis = [],
    journal,
    owned,
  } = params;
  const writerParams = {
    ...(journal === undefined ? {} : { journal }),
    ...(owned === undefined ? {} : { owned }),
  };
  // ADR-103 · BLOCKER-3 — 옛 Antigravity 앵커에 채운 글은 **변환 전에** 읽어 `AGENTS.md` 쓰기에 씨로 넘긴다(쓰기 한 번 =
  // 기록 sha 가 최종 바이트). 기록에 앵커가 없으면 `null` — 디스크에만 있는 같은 이름의 파일은 설치자 것이다.
  const legacyContext = readLegacyAntigravityContext(projectDir, previousExternal);
  const outside = createOutsideGuard(projectDir);

  // v26.133.0 (ADR-048) — 기준선을 transform 사이로 **이어준다**. codex 와 opencode 는 같은
  // `AGENTS.md` 를, codex 와 antigravity 는 같은 `.agents/skills/<id>/SKILL.md` 를 쓴다.
  // 안 이어주면 뒤 단계가 앞 단계의 산출물을 '사용자 편집'으로 오판해 **실행할 때마다**
  // 백업이 생긴다 — 백업 노이즈는 진짜 백업을 눈에 안 띄게 만들어 보호 자체를 무력화한다.
  const baseline = new Map(previousExternal.map((f) => [f.path, f.sha256]));
  const externalFiles: InstallLogSkillFile[] = [];
  const externalBackups: string[] = [];
  const externalBackedUp: string[] = [];
  const externalJudged: JudgedWrite[] = [];
  const externalForeignOwned: string[] = [];
  const displaced = new Map<string, InstallLogRootFile>();
  let externalOutside: OutsideLink[] = [];
  let externalUpdated = 0;
  const restoredFiles: string[] = [];
  const sharedFiles: SharedWriteResult[] = [];
  const absorbShared = (
    report: { ownership: OwnedWriteResult },
    results: ReadonlyArray<SharedWriteResult | null | undefined>,
  ): void => {
    for (const r of results) {
      if (!r) continue;
      sharedFiles.push(r);
      // 하네스가 만든 파일은 writer 가 이미 셌다(`ownership.updated`) — 설치자 파일에 직접 쓴 것만 더한다
      const counted = report.ownership.files.some((f) => f.path === r.path);
      if (!counted && (r.action === "created" || r.action === "updated")) externalUpdated++;
    }
  };
  const absorb = (report: { ownership: OwnedWriteResult }): void => {
    for (const f of report.ownership.files) {
      baseline.set(f.path, f.sha256);
      externalFiles.push(f);
    }
    externalBackups.push(...report.ownership.backupPaths);
    externalBackedUp.push(...report.ownership.backedUp);
    externalJudged.push(...(report.ownership.judged ?? []));
    // 같은 `.agents/skills/` 를 여러 변환이 쓴다 — 앞 변환이 백업한 자리를 뒤 변환은 기준선으로 알아본다. 경로당 첫 판정이 이긴다
    // (뒤 변환의 "같은 내용 · 백업 없음" 이 앞 변환의 백업 기록을 덮지 않게)
    for (const f of report.ownership.displaced ?? [])
      if (!displaced.has(f.path)) displaced.set(f.path, f);
    for (const f of report.ownership.foreignOwned) {
      // 세 transform 이 같은 `.agents/skills/` 를 쓰므로 중복이 실제로 난다.
      if (!externalForeignOwned.includes(f)) externalForeignOwned.push(f);
    }
    externalOutside = mergeOutside(externalOutside, report.ownership.outside ?? []);
    externalUpdated += report.ownership.updated;
    for (const f of report.ownership.restored ?? [])
      if (!restoredFiles.includes(f)) restoredFiles.push(f);
  };

  let codex: CodexTransformReport | null = null;
  let codexOptIn: CodexOptInReport | null = null;
  if (cli.includes("codex")) {
    // v26.87.0 — dev-method skills 는 selectedInternalSkills 로 게이팅.
    codex = runCodexTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
      mcp,
      baseline,
      refreshOnly,
      shared,
      ...writerParams,
    });
    absorb(codex);
    absorbShared(codex, [codex.configToml]);
    // ADR-097 결정 2 — 범위와 무관하게 `--with-codex-trust` 를 준 경우에만 홈 파일에 한 줄을 더한다.
    // 안 줬으면 Codex 가 첫 실행에서 직접 묻는다("Trust and continue") — 설치 화면 NEXT 가 그걸 안내한다.
    if (codexTrust) {
      codexOptIn = runCodexOptIn({ projectDir });
      journal?.trust(codexOptIn);
    }
    journal?.done("codex");
  }

  let opencode: OpencodeTransformReport | null = null;
  if (cli.includes("opencode")) {
    opencode = runOpencodeTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
      mcp,
      baseline,
      refreshOnly,
      shared,
      ...writerParams,
    });
    absorb(opencode);
    absorbShared(opencode, [opencode.opencodeJson]);
    journal?.done("opencode");
  }

  // v26.66.0 — Antigravity transform: `.agents/rules/<룰>.md`(frontmatter, #631) + dev-method skills.
  let antigravity: AntigravityTransformReport | null = null;
  if (cli.includes("antigravity")) {
    antigravity = runAntigravityTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
      rules,
      baseline,
      refreshOnly,
      installedByRecord: recordedClis.includes("antigravity"),
      ...writerParams,
    });
    absorb(antigravity);
    journal?.done("antigravity");
  }

  // #642 (ADR-103) — 루트 `AGENTS.md` 는 세 변환 **뒤에** 한 번, 이 실행의 집합으로 쓴다. 집합 = 이번 선택 ∪ 기록된 CLI
  // (ADR-096 D2 — CLI 집합은 누적이고 `--reinstall` 도 누적). 한 판이 이기던 구조(#550 의 "쓰는 쪽은 하나")가 사라진다.
  const agentsSet = agentsMdClis([...cli, ...recordedClis]);
  let agentsMd: AgentsMdTransformReport | null = null;
  if (agentsSet.length > 0) {
    const beyondThisRun = agentsSet.some((c) => !cli.includes(c));
    agentsMd = runAgentsMdTransform({
      harnessRoot,
      projectDir,
      clis: agentsSet,
      selectedInternalSkills,
      rules: beyondThisRun && params.cumulativeRules !== undefined ? params.cumulativeRules : rules,
      baseline,
      refreshOnly,
      // ADR-099 R2 — 기록이 이 파일을 읽는 CLI 를 깔린 것으로 말하면 없어도 만든다(26.164.0 이하 Antigravity 단독 설치본은
      // 첫 update 에 이 파일이 생긴다)
      installedByRecord: agentsSet.some((c) => recordedClis.includes(c)),
      shared,
      legacyContext,
      ...writerParams,
    });
    absorb(agentsMd);
    absorbShared(agentsMd, [agentsMd.agentsMd.shared]);
  }

  // ADR-103 — 지우기 토막은 `AGENTS.md` 쓰기 **뒤**다: 옮겨 심은 것을 확인한 뒤에 원본을 치운다.
  const anchorRetired = retireAntigravityAnchor({
    projectDir,
    previous: previousExternal,
    outside,
    hadContent: legacyContext !== null,
    moved: agentsMd?.agentsMdSeededFrom === LEGACY_ANTIGRAVITY_ANCHOR,
  });
  if (anchorRetired?.backup) {
    externalBackups.push(anchorRetired.backup);
    externalBackedUp.push(anchorRetired.path);
  }
  externalOutside = mergeOutside(externalOutside, outside.list());

  return {
    codex,
    codexOptIn,
    opencode,
    antigravity,
    agentsMd,
    anchorRetired,
    externalFiles,
    externalBackups,
    externalUpdated,
    externalBackedUp,
    externalJudged,
    displaced: [...displaced.values()],
    externalForeignOwned,
    externalOutside,
    sharedFiles,
    portions: sharedFiles.flatMap((r) => r.portions ?? []),
    // #774 (N2) — 블록 모델이던 `AGENTS.md` 를 절 모델로 바꿨으면 그 파일의 몫 기록을 비운다(판정한 경로 · 몫 없음)
    portionPaths: [
      ...sharedFiles.filter((r) => r.portions !== null).map((r) => r.path),
      ...(agentsMd?.agentsMd.blockRecordDropped === true ? ["AGENTS.md"] : []),
    ],
    restoredFiles,
  };
}

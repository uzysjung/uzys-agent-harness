import { keyId } from "./adapters/index.js";
import { BASELINE_PREFIX, listBaselineTargets } from "./baseline-targets.js";
import { CLI_BASE_SORT_ORDER } from "./cli-targets.js";
import { trackDefaultMcpAssetIds } from "./cli-transforms.js";
import {
  type InstallOptions,
  installCommandLine,
  installSpecFromOptions,
} from "./commands/install.js";
import { formatResidentCostLine, resolveBundleRoot, summarizeContextCost } from "./context-cost.js";
import { assetReachesCli, EXTERNAL_ASSETS, INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
import {
  corruptedInstallLogMessage,
  type InstallLog,
  installedClis,
  readInstallLog,
} from "./install-log.js";
import type { InstallMode } from "./installer.js";
import { recordedMcpAssetIds } from "./mcp-merge.js";
import {
  finalSelectedAssets,
  groupAssetsByCategory,
  recommendedExternalAssets,
} from "./preset-recommend.js";
import {
  defaultPrompts,
  type InstallTargetId,
  type Prompts,
  VISIBLE_OPTION_DEFS,
} from "./prompts.js";
import { excludedIds } from "./recorded.js";
import { residentCostFor } from "./resident-entries.js";
import { buildInstallRecordView } from "./router.js";
import {
  type DetectedInstall,
  detectInstallState,
  suggestedTracks,
  traceNoteLines,
} from "./state.js";
import {
  type CliBase,
  type CliTargets,
  type InstallScope,
  type InstallSpec,
  isTrack,
  type OptionFlags,
  type Track,
  UPDATE_GROUPS,
  type UpdateGroup,
} from "./types.js";
import { buildUpdateSpec } from "./update-mode.js";
import { stepLabel, UPDATE_WIZARD, WIZARD } from "./wizard-steps.js";

/**
 * v26.54.0 — All-in-one 결과 → option keys + asset id list 분리.
 * `option:<key>` → OptionFlags key
 * `asset:<id>` → EXTERNAL_ASSETS id
 */
export function splitInstallTargets(targets: ReadonlyArray<InstallTargetId>): {
  optionKeys: Array<keyof OptionFlags>;
  assetIds: Array<string>;
  /** 2026-08-16 — 사용자가 **체크한 채로 둔** baseline id. 제외는 이것의 여집합으로 낸다. */
  baselineIds: Array<string>;
} {
  const optionKeys: Array<keyof OptionFlags> = [];
  const assetIds: Array<string> = [];
  const baselineIds: Array<string> = [];
  for (const t of targets) {
    if (t.startsWith("option:")) {
      optionKeys.push(t.slice("option:".length) as keyof OptionFlags);
    } else if (t.startsWith("asset:")) {
      assetIds.push(t.slice("asset:".length));
    } else if (t.startsWith(BASELINE_PREFIX)) {
      baselineIds.push(t);
    }
  }
  return { optionKeys, assetIds, baselineIds };
}

/**
 * 체크 결과 → **제외 목록**. 화면은 "설치할 것"을 체크로 보여주는데 spec 이 받는 것은
 * "빼는 것"이라, 이 뒤집기를 한 곳에 둔다.
 *
 * 전부 체크된 기본 상태에서는 빈 배열이 나온다 — 즉 아무것도 안 고른 사용자의 설치 결과는
 * 이 기능이 생기기 전과 **바이트 단위로 같다**.
 */
export function baselineExcludeFrom(
  offered: ReadonlyArray<{ id: string }>,
  checked: ReadonlyArray<string>,
): string[] {
  const keep = new Set(checked);
  return offered.filter((t) => !keep.has(t.id)).map((t) => t.id);
}

/**
 * v26.81.0 (ADR-022) — 자산 1:1 boolean 13종 삭제 후 잔존 동작 옵션만 매핑.
 *   wizard 의 자산 선택은 전부 `asset:<id>` → userOverride.forceInclude 경로.
 */
export function toOptionFlags(keys: ReadonlyArray<keyof OptionFlags>): OptionFlags {
  const picked = new Set<keyof OptionFlags>(keys);
  return {
    withCodexTrust: picked.has("withCodexTrust"),
  };
}

export interface InteractiveDeps {
  prompts?: Prompts;
  detect?: (projectDir: string) => DetectedInstall;
  isTty?: () => boolean;
  /** v26.125.0 — 설치 상태 주입 (테스트용). 미주입 시 install log 를 읽는다. */
  readInstalled?: (projectDir: string) => InstalledTargetState;
}

/**
 * v26.125.0 — wizard 가 참조하는 설치 상태.
 *
 * `installed` 와 `projectScoped` 를 나누는 이유: global scope 자산까지 사전 체크하면
 * step 4 에서 project 를 고른 순간 **같은 자산이 project 에 한 벌 더 깔린다**. 그래서
 * 표시(마커)는 전부 하고, 사전 체크는 project scope 만 한다.
 */
export interface InstalledTargetState {
  /** 마커를 붙일 자산 id — scope 무관 (설치돼 있다는 사실 자체는 참) */
  installed: ReadonlyArray<string>;
  /** 사전 체크할 자산 id — project scope 만 */
  projectScoped: ReadonlyArray<string>;
}

/** install log → wizard 표시용 설치 상태. 로그가 없으면(최초 설치) 빈 상태. */
export function installedTargetState(projectDir: string): InstalledTargetState {
  const log = readInstallLog(projectDir);
  if (!log) return { installed: [], projectScoped: [] };
  // #709 — 기록된 `.mcp.json` 몫의 선택 서버(`railway-mcp-server`)도 깔린 project 자산이다(외부 설치 기록엔 안 남는다)
  const mcp = recordedMcpAssetIds(log);
  return {
    installed: [...log.assets.map((a) => a.id), ...mcp],
    projectScoped: [...log.assets.filter((a) => a.scope !== "global").map((a) => a.id), ...mcp],
  };
}

/**
 * #709 리뷰 NOTE 7 — 3단계가 트랙의 기본으로 보이는 자산: 카탈로그 추천 ∪ **트랙 표가 기본으로 까는 고를 수 있는 MCP 서버**
 * (`railway-mcp-server` on csr-* · ssr-htmx · full). 뒤의 것은 experimental 이라 카탈로그 추천에 안 들지만 실제로 깔린다 — 미체크로
 * 보이면 화면이 결과와 다르다. 체크를 풀면 추천 대비 빼기(`--without <id>`)라 `.mcp.json` · Codex · OpenCode 에서 모두 빠진다.
 */
function wizardRecommended(tracks: ReadonlyArray<Track>): string[] {
  return [
    ...new Set([
      ...recommendedExternalAssets(tracks),
      ...trackDefaultMcpAssetIds(resolveBundleRoot(), tracks),
    ]),
  ];
}

/**
 * step 3 의 초기 체크 = **트랙 추천 ∪ 이미 설치된 project 자산**.
 *
 * 추천만 쓰면 추천 밖의 설치된 자산이 빈칸으로 보여, 사용자가 "안 깔렸다"고 읽는다.
 * 합집합이므로 중복은 생기지 않는다 (헤더의 `n/m ✓` 카운트가 거짓이 되지 않아야 한다).
 */
export function initialTargetSelection(
  tracks: ReadonlyArray<Track>,
  installedProjectAssetIds: ReadonlyArray<string>,
): InstallTargetId[] {
  const ids = new Set<string>(wizardRecommended(tracks));
  for (const id of installedProjectAssetIds) ids.add(id);
  const assets = [...ids].map((id) => `asset:${id}` as InstallTargetId);
  // 트랙이 고르는 자산은 **전부 체크된 채로** 시작한다. 기본값을 바꾸는 것이 아니라 기본값을
  // 보이게 하는 것이 목적이다 — 아무것도 안 건드리면 설치 결과는 이전과 같다.
  const baseline = listBaselineTargets({ tracks }).map((t) => t.id as InstallTargetId);
  return [...assets, ...baseline];
}

export interface InteractiveResult {
  ok: boolean;
  spec?: InstallSpec;
  mode?: InstallMode;
  /**
   * #533 (D8) — 메뉴에서 Uninstall 을 골랐다. 화면과 실행은 `agent-harness uninstall` 과 **같은
   * 함수**가 맡는다(`runUninstallScreen`) — 위저드 안에 삭제 판정의 사본을 두지 않는다.
   */
  uninstall?: boolean;
  reason?: "no-tty" | "cancelled" | "disabled-action" | "exit" | "corrupted";
  message?: string;
}

/**
 * #533 (D4) — 잠금. 프롬프트가 무엇을 돌려주든 **깔린 것은 빠지지 않는다**. clack 의 `a`·`i` 키가
 * 화면에서 잠긴 항목을 풀 수 있으므로 화면만 믿지 않고 여기서 합친다(Epic #527 정의 2).
 * 트랙은 `detectInstallState` 와 같은 사전순으로 낸다.
 */
export function lockTracks(picked: ReadonlyArray<Track>, installed: ReadonlyArray<Track>): Track[] {
  return [...new Set<Track>([...installed, ...picked])].sort();
}

/** CLI 판 `lockTracks`. 순서는 `CLI_BASE_SORT_ORDER` 하나 — 로그 · `--cli` 파싱과 같다. */
export function lockClis(
  picked: ReadonlyArray<CliBase>,
  installed: ReadonlyArray<CliBase>,
): CliBase[] {
  return [...new Set<CliBase>([...installed, ...picked])].sort(
    (a, b) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b],
  );
}

/** Update 확인 직전의 선택 — 잠금 합집합이 끝난 값이다. */
export interface UpdateSelection {
  tracks: ReadonlyArray<Track>;
  cli: ReadonlyArray<CliBase>;
  /** Step 3 에서 체크된 채로 남은 외부 자산 id (`asset:` 접두 없음). */
  assetIds: ReadonlyArray<string>;
  baselineExclude: ReadonlyArray<string>;
  /** 체크를 푼 번들 스킬 id — install 이 로그 `skillExclude` 로 남기는 것과 같은 규칙. */
  skillExclude: ReadonlyArray<string>;
}

const BUNDLED_SKILLS: ReadonlySet<string> = new Set(INTERNAL_BUNDLED_SKILL_IDS);

/**
 * #533 (D6 · D7) — Update 한 흐름 뒤에서 **어느 엔진이 도는가**. 순수 함수 하나가 정한다.
 *
 * - `"refresh"` = `agent-harness update` 와 같은 일(`buildUpdateSpec`). 트랙·CLI 를 기록에서 읽으므로
 *   **더한 것을 받을 수 없다**(`update-mode.ts` `installedTracks` · `installedCliTargets`).
 * - `"add"` = 같은 인자의 `install --track … --cli …` 와 같은 일. 기존 파일도 같은 기준선으로 갱신한다.
 *
 * `add` 조건(하나라도): ① 트랙 ≠ 기록 ② CLI ≠ 기록의 깔린 집합 ③ 외부 자산 선택 ≠ 기록 —
 * 기록이 덮지 않는 자산(`coveredByRecord` 밖)을 체크했거나 기록된 project 자산의 체크를 풀었다
 * ④ baseline 해제 ≠ 기록 ⑤ 번들 스킬 해제 ≠ 기록. 해제 기록은 install 엔진만 남기므로(update 엔진엔
 * 자리가 없다) ④·⑤ 가 바뀌면 install 이어야 한다. **애매하면 `add`** — add 는 기존 파일도 갱신하므로
 * 틀리는 방향이 안전하다.
 *
 * @param legacyTracks 기록이 없는 옛 설치본(`log === null`)의 트랙 — 메타파일·휴리스틱에서 감지한 것.
 */
export function classifyUpdateIntent(
  log: InstallLog | null,
  confirmed: UpdateSelection,
  legacyTracks: ReadonlyArray<Track> = [],
): "refresh" | "add" {
  const recordTracks = log ? log.spec.tracks : legacyTracks;
  const recordClis = recordedClis(log);
  if (!sameSet(confirmed.tracks, recordTracks)) return "add";
  if (!sameSet(confirmed.cli, recordClis)) return "add";
  // ADR-099 R3 — 해제 비교의 기준은 기록의 **누적** 빼기다(마지막 설치분이 아니다)
  const out = excludedIds(log);
  const recorded = log?.assets ?? [];
  const covered = coveredByRecord(log, legacyTracks);
  const picked = new Set(confirmed.assetIds);
  if (confirmed.assetIds.some((id) => !covered.has(id) || out.has(id))) return "add";
  if (recorded.some((a) => a.scope !== "global" && !picked.has(a.id) && !out.has(a.id)))
    return "add";
  // #709 — 기록된 선택 MCP 서버의 체크를 풀었다 = 빼기(install 엔진만 기록한다)
  if (recordedMcpAssetIds(log).some((id) => !picked.has(id) && !out.has(id))) return "add";
  const offered = new Set(listBaselineTargets({ tracks: confirmed.tracks }).map((t) => t.id));
  const recordedBaseline = [...out].filter((id) => offered.has(id));
  if (!sameSet(confirmed.baselineExclude, recordedBaseline)) return "add";
  const recordedSkills = [...out].filter((id) => BUNDLED_SKILLS.has(id));
  if (!sameSet(confirmed.skillExclude, recordedSkills)) return "add";
  return "refresh";
}

/** 기록의 깔린 CLI. 기록이 없으면 `buildUpdateSpec` 이 claude 로 다룬다 — 같은 기준을 쓴다. */
function recordedClis(log: InstallLog | null): CliBase[] {
  return log ? [...installedClis(log)] : ["claude"];
}

/**
 * 기록이 **이미 덮는** 외부 자산 — 아무것도 안 바꾼 Update(refresh = `update` 엔진)가 있는 그대로
 * 두어도 화면과 디스크가 맞는 것. ⓐ 기록된 자산 ⓑ 기록 트랙의 추천 중 **설치 기록에 원래 안 남는
 * 것**: 내장(`internal` — 템플릿이 깔아 외부 설치 단계를 안 탄다) · 기록의 CLI 로 닿지 않는 것(설치해도
 * 안 깔린다 — 확인 화면이 "outside reach — not installed" 로 말한다).
 *
 * 그 밖의 추천 외부 자산(비내장 · 닿는데 기록에 없다)은 설치 때 뺐거나, 설치가 실패했거나, 새 릴리즈가
 * 추천에 더한 것이다 — refresh 는 기록된 것만 갱신하므로 **덮지 않는다**(리뷰 B2). 그걸 체크하면 add 다.
 */
function coveredByRecord(log: InstallLog | null, legacyTracks: ReadonlyArray<Track>): Set<string> {
  const recordTracks = (log ? log.spec.tracks : legacyTracks).filter(isTrack);
  const clis = recordedClis(log);
  const covered = new Set<string>([
    ...(log?.assets ?? []).map((a) => a.id),
    // #709 — 기록된 선택 MCP 서버 · 기록 트랙의 기본 MCP 행은 refresh 가 그대로 둔다(`.mcp.json` 몫 기록 · 트랙 표)
    ...recordedMcpAssetIds(log),
    ...trackDefaultMcpAssetIds(resolveBundleRoot(), recordTracks),
  ]);
  for (const id of recommendedExternalAssets(recordTracks)) {
    const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
    if (!asset || asset.method.kind === "internal" || !assetReachesCli(asset, clis)) {
      covered.add(id);
    }
  }
  return covered;
}

function sameSet(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  const left = new Set(a);
  const right = new Set(b);
  return left.size === right.size && [...left].every((x) => right.has(x));
}

/**
 * Update 흐름 Step 3 의 초기 체크 — 첫 설치와 같은 `initialTargetSelection` 에서 뺀다:
 * ① **기록된 해제분**(baseline · 번들 스킬) — 빼지 않으면 아무것도 안 건드린 선택이 기록과 달라져
 *    ④·⑤ 로 add 가 되고, 예전에 뺀 룰·스킬이 되돌아 깔린다.
 * ② 기록 트랙의 추천 중 **기록이 덮지 않는 외부 자산**(`coveredByRecord` 밖) — 체크된 채 보이면
 *    "선택됨"으로 세어지는데 refresh 는 그것을 깔지 않는다(리뷰 B2). 체크 = 확인 뒤 디스크에 있다.
 *    설치자가 체크하면 add 로 가서 깔린다.
 */
export function updateInitialSelection(
  tracks: ReadonlyArray<Track>,
  installedProjectAssetIds: ReadonlyArray<string>,
  log: InstallLog | null,
  legacyTracks: ReadonlyArray<Track> = [],
): InstallTargetId[] {
  const covered = coveredByRecord(log, legacyTracks);
  const recordTracks = (log ? log.spec.tracks : legacyTracks).filter(isTrack);
  // ADR-099 R3 — 기록의 누적 빼기(baseline · 번들 스킬 · 외부 자산)는 해제된 채로 보인다
  const out = excludedIds(log);
  const excluded = new Set<string>([
    ...[...out].map((id) => (id.startsWith(BASELINE_PREFIX) ? id : `asset:${id}`)),
    // #709 — 옛 키 빼기(`mcp:<name>`)로 뺀 고를 수 있는 MCP 서버도 해제된 채로 보인다(렌더에서 빠진다)
    ...EXTERNAL_ASSETS.filter(
      (a) =>
        a.method.kind === "internal" &&
        out.has(keyId(".mcp.json", `mcpServers.${a.method.key}`) ?? ""),
    ).map((a) => `asset:${a.id}`),
    ...recommendedExternalAssets(recordTracks)
      .filter((id) => !covered.has(id))
      .map((id) => `asset:${id}`),
  ]);
  return initialTargetSelection(tracks, installedProjectAssetIds).filter((id) => !excluded.has(id));
}

/**
 * v26.54.0 — 3-step wizard. SPEC: docs/specs/v26-54-all-in-one-installer.md
 *
 * Step 1: tracks (ESC = exit + cancel msg)
 * Step 2: cli   (ESC = silent back to tracks)
 * Step 3: install-targets all-in-one (ESC = silent back to cli)
 * confirm prompt (ESC = silent back to targets)
 *
 * 이전 5-step 의 options + 2-tier asset navigator 를 step 3 1 화면 group multiselect 로 흡수.
 */
export async function runInteractive(
  projectDir: string,
  deps: InteractiveDeps = {},
): Promise<InteractiveResult> {
  const prompts = deps.prompts ?? defaultPrompts;
  const detect = deps.detect ?? detectInstallState;
  const isTty = deps.isTty ?? (() => Boolean(process.stdin.isTTY));

  if (!isTty()) {
    return {
      ok: false,
      reason: "no-tty",
      message:
        "Interactive mode requires a TTY. Use `agent-harness install --track <name>` for non-interactive use.",
    };
  }

  prompts.intro("uzys-agent-harness installer");
  const state = detect(projectDir);
  // v26.125.0 — 위저드가 설치 상태를 읽는다. 이전에는 step 3 의 체크가 트랙 추천에서만 나와
  // **이미 깔린 자산이 빈칸으로 보였다** — 사용자가 그 체크박스를 설치 상태로 읽으므로 화면이
  // 거짓을 말한 셈이다. 마커는 표시 전용이고 체크를 풀어도 제거되지 않는다 (제거 = `uninstall`).
  const installed = (deps.readInstalled ?? installedTargetState)(projectDir);

  // #595 — 깨진 기록은 고를 것이 없다: `list` · `update` · `uninstall` 과 같은 줄을 보이고 끝낸다.
  if (state.state === "corrupted") {
    prompts.cancel(corruptedInstallLogMessage(projectDir));
    return { ok: false, reason: "corrupted" };
  }

  if (state.state === "installed" && state.log) {
    const log = state.log;
    const record = buildInstallRecordView(state, log, state.hasClaudeDir);
    const action = await prompts.selectAction(state, record);
    if (action === null) {
      prompts.cancel("Cancelled.");
      return { ok: false, reason: "cancelled" };
    }
    if (action === "exit") {
      prompts.outro("Exiting without changes.");
      return { ok: false, reason: "exit" };
    }
    if (action === "uninstall") {
      return { ok: true, uninstall: true };
    }
    // 깨진 설치에서는 화면이 Update 를 막는다(D10). 그래도 돌아오면(다른 프롬프트 구현) 엔진이
    // 거절할 실행을 만들지 않고 복구 명령을 그대로 돌려준다.
    if (record.repair !== null) {
      prompts.cancel(`.claude/ is missing — repair first: ${record.repair}`);
      return { ok: false, reason: "disabled-action", message: record.repair };
    }
    return runUpdateFlow({ projectDir, state, log, prompts, installed });
  }

  // #595 — 기록이 없으면 새 설치 흐름이다(흔적이 있어도). 흔적은 안내 두 줄과 트랙 기본 체크에만 쓴다(설계 no-record §3).
  if (state.traces.length > 0) prompts.note?.(traceNoteLines(state.traces).join("\n"));
  const suggested = suggestedTracks(state.traces);

  // #560 (ADR-097 결정 1) — Scope 단계는 없다. 새 설치는 항상 project 다.
  type Step = "tracks" | "cli" | "targets" | "confirm";
  let step: Step = "tracks";
  let tracks: Track[] | null = null;
  let cli: import("./types.js").CliTargets | null = null;
  let targetSelections: ReadonlyArray<InstallTargetId> | null = null;

  while (true) {
    if (step === "tracks") {
      const result = await prompts.selectTracks(
        tracks ?? (suggested.length > 0 ? suggested : undefined),
        WIZARD.TRACKS,
      );
      if (result === null) {
        // Step 1 ESC = exit with cancel message (only step where ESC is "cancel")
        prompts.cancel("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      // preset 변경 감지 → install-targets reset (v26.50 정책 유지)
      if (tracks !== null && !tracksEqual(tracks, result)) {
        targetSelections = null;
      }
      tracks = result;
      step = "cli";
    } else if (step === "cli") {
      const result = await prompts.selectCli(cli ?? ["claude"], WIZARD.CLI);
      if (result === null) {
        step = "tracks"; // silent back
        continue;
      }
      cli = result;
      step = "targets";
    } else if (step === "targets") {
      const initial: InstallTargetId[] =
        targetSelections !== null
          ? [...targetSelections]
          : initialTargetSelection(tracks ?? [], installed.projectScoped);
      // v26.65.0 — step indicator SSOT (wizard-steps.ts). Phase: 3 targets → 4 confirm → 5 install.
      const result = await prompts.selectInstallTargets(initial, WIZARD.TARGETS, {
        tracks: tracks ?? [],
        cli: cli ?? ["claude"],
        installed: installed.installed.map((id) => `asset:${id}`),
      });
      if (result === null) {
        step = "cli"; // silent back
        continue;
      }
      targetSelections = result;
      step = "confirm";
    } else {
      // confirm
      // biome-ignore lint/style/noNonNullAssertion: confirm step 도달 = 모든 이전 step 완료 보장
      const finalTracks = tracks!;
      // biome-ignore lint/style/noNonNullAssertion: same as above
      const finalCli = cli!;
      const { optionKeys, assetIds, baselineIds } = splitInstallTargets(targetSelections ?? []);
      const options = toOptionFlags(optionKeys);
      const userOverride =
        targetSelections === null ? undefined : computeUserOverride(finalTracks, assetIds);
      // 제외는 "화면에 낸 것" 대비로 낸다. 화면에 안 낸 자산(`settings.json` 등)은 후보가
      // 아니므로 어떤 조작으로도 빠지지 않는다.
      const baselineExclude =
        targetSelections === null
          ? []
          : baselineExcludeFrom(listBaselineTargets({ tracks: finalTracks }), baselineIds);
      const summary = formatSummary({
        tracks: finalTracks,
        options,
        cli: finalCli,
        projectDir,
        ...(userOverride ? { userOverride } : {}),
        // 해제 목록을 안 넘기면 이 화면이 **제외 유무와 문자열이 완전히 같아진다** — 같은 화면이
        // 외부 자산 제거는 `-Unchecked by you:` 로 이미 보고하므로, 없음은 "아무것도 안 빠졌다"로
        // 읽힌다. 상주 비용을 줄이려고 20개를 푼 사용자가 그대로인 숫자를 보게 된다.
        ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
      });
      const confirmed = await prompts.confirmInstall(
        `${stepLabel(WIZARD.CONFIRM, "Confirm")}\n${summary}`,
      );
      if (confirmed === null) {
        step = "targets"; // silent back
        continue;
      }
      if (!confirmed) {
        prompts.outro("Cancelled by user.");
        return { ok: false, reason: "cancelled" };
      }

      const spec: InstallSpec = {
        tracks: finalTracks,
        options,
        cli: finalCli,
        projectDir,
        scope: "project",
        ...(userOverride ? { userOverride } : {}),
        ...(baselineExclude.length > 0 ? { baselineExclude } : {}),
      };

      prompts.outro(stepLabel(WIZARD.INSTALL, "Installing..."));
      return { ok: true, mode: "fresh", spec };
    }
  }
}

interface UpdateFlowContext {
  projectDir: string;
  state: DetectedInstall;
  log: InstallLog | null;
  prompts: Prompts;
  installed: InstalledTargetState;
}

/**
 * #533 — 기설치 Update 흐름 (트랙 → CLI → 자산 → 확인 → 실행, 5단계 · D3).
 *
 * 깔린 트랙·CLI 는 체크된 채 잠기고(D4) 더할 것만 받는다. 확인 화면에서 `classifyUpdateIntent` 가
 * 엔진을 고르고, `RUNS AS` 줄이 그 실행이 플래그로 치면 어느 명령과 같은지 말한다(D6).
 * **파일은 이 흐름 어디서도 지워지지 않는다** — 체크 해제는 "이번에 안 깐다"이고 제거는 Uninstall 뿐이다.
 */
async function runUpdateFlow(ctx: UpdateFlowContext): Promise<InteractiveResult> {
  const { projectDir, state, log, prompts, installed } = ctx;
  // 옛 설치본(기록 없음)은 CLI 를 말할 수 없어 CLI 잠금이 없다(D5). 트랙은 감지된 것으로 잠근다.
  const lockedTracks = lockTracks(log ? log.spec.tracks.filter(isTrack) : [], state.tracks);
  const lockedClis = installedClis(log);
  const scope: InstallScope = log?.scope ?? "project";

  type Step = "tracks" | "cli" | "targets" | "confirm";
  let step: Step = "tracks";
  let tracks: Track[] | null = null;
  let cli: CliBase[] | null = null;
  let targetSelections: ReadonlyArray<InstallTargetId> | null = null;

  while (true) {
    if (step === "tracks") {
      const result = await prompts.selectTracks(
        tracks ?? lockedTracks,
        UPDATE_WIZARD.TRACKS,
        lockedTracks,
      );
      if (result === null) {
        prompts.cancel("Cancelled.");
        return { ok: false, reason: "cancelled" };
      }
      const next = lockTracks(result, lockedTracks);
      if (tracks !== null && !tracksEqual(tracks, next)) targetSelections = null;
      tracks = next;
      step = "cli";
    } else if (step === "cli") {
      const initial: CliTargets = cli ?? (lockedClis.length > 0 ? [...lockedClis] : ["claude"]);
      const result = await prompts.selectCli(initial, UPDATE_WIZARD.CLI, lockedClis);
      if (result === null) {
        step = "tracks";
        continue;
      }
      cli = lockClis(result, lockedClis);
      step = "targets";
    } else if (step === "targets") {
      const current = tracks ?? lockedTracks;
      const initial =
        targetSelections !== null
          ? [...targetSelections]
          : updateInitialSelection(current, installed.projectScoped, log, state.tracks);
      const result = await prompts.selectInstallTargets(initial, UPDATE_WIZARD.TARGETS, {
        tracks: current,
        cli: cli ?? [...lockedClis],
        installed: installed.installed.map((id) => `asset:${id}`),
      });
      if (result === null) {
        step = "cli";
        continue;
      }
      targetSelections = result;
      step = "confirm";
    } else {
      const outcome = await confirmUpdate({
        projectDir,
        state,
        log,
        prompts,
        scope,
        lockedClis,
        // biome-ignore lint/style/noNonNullAssertion: confirm 도달 = 이전 step 완료 보장
        tracks: tracks!,
        // biome-ignore lint/style/noNonNullAssertion: same as above
        cli: cli!,
        targetSelections: targetSelections ?? [],
      });
      if (outcome === "back") {
        step = "targets";
        continue;
      }
      return outcome;
    }
  }
}

interface ConfirmUpdateInput {
  projectDir: string;
  state: DetectedInstall;
  log: InstallLog | null;
  prompts: Prompts;
  scope: InstallScope;
  lockedClis: ReadonlyArray<CliBase>;
  tracks: ReadonlyArray<Track>;
  cli: ReadonlyArray<CliBase>;
  targetSelections: ReadonlyArray<InstallTargetId>;
}

/** Update Step 4 — 엔진을 고르고, 그 엔진의 명령을 `RUNS AS` 로 보이고, 확인받는다. */
async function confirmUpdate(input: ConfirmUpdateInput): Promise<InteractiveResult | "back"> {
  const { projectDir, state, log, prompts, scope, tracks, cli } = input;
  const { assetIds, baselineIds } = splitInstallTargets(input.targetSelections);
  const userOverride = computeUserOverride(tracks, assetIds);
  const baselineExclude = baselineExcludeFrom(listBaselineTargets({ tracks }), baselineIds);
  const skillExclude = (userOverride?.forceExclude ?? []).filter((id) => BUNDLED_SKILLS.has(id));
  const intent = classifyUpdateIntent(
    log,
    { tracks, cli, assetIds, baselineExclude, skillExclude },
    state.tracks,
  );
  const header = stepLabel(UPDATE_WIZARD.CONFIRM, "Confirm");
  const scopeLine = `  SCOPE     ${scope === "global" ? "Global" : "Project"} (${log ? "from your install record — not changed here" : "no install record — default"})`;

  if (intent === "refresh") {
    // #480 · D13 — 갱신 묶음 체크박스는 refresh 에만 있다(install 엔진엔 묶음 개념이 없다).
    // 프롬프트가 없는 구현(테스트 픽스처)은 전부.
    const groups: UpdateGroup[] | null | undefined = prompts.selectUpdateGroups
      ? await prompts.selectUpdateGroups()
      : undefined;
    if (groups === null) return "back";
    // spec 은 `buildUpdateSpec` 단일 출처 — 비대화형 `update` 명령과 같은 것을 쓴다.
    const spec = buildUpdateSpec(projectDir, state.tracks, groups);
    const only = spec.updateOnly ?? [];
    const summary = [
      header,
      only.length > 0
        ? `UPDATE ${only.join(" · ")} only (untouched: ${UPDATE_GROUPS.filter((g) => !only.includes(g)).join(", ")}):`
        : "UPDATE installed harness files:",
      // 요약은 Step 3 에서 체크된 것을 센다 — spec(추천 전체)으로 세면 체크 안 된 채 둔 자산까지
      // "selected" 로 적는데 refresh 는 그것을 깔지 않는다(리뷰 B2). 실행 spec 은 그대로다.
      annotate(formatSummary({ ...spec, ...(userOverride ? { userOverride } : {}) }), {
        Tracks: "no change",
        CLI: "no change",
        Assets: "no change",
      }),
      scopeLine,
      `  RUNS AS   agent-harness update${only.map((g) => ` --only ${g}`).join("")}`,
    ].join("\n");
    const confirmed = await prompts.confirmInstall(summary);
    if (confirmed === null) return "back";
    if (!confirmed) {
      prompts.outro("Cancelled.");
      return { ok: false, reason: "cancelled" };
    }
    prompts.outro("Running update mode...");
    return { ok: true, mode: "update", spec };
  }

  // add — install 엔진. spec 은 `install` 명령과 **같은 함수**가 같은 인자로 만든다(D6).
  // 설계 selection-record §3 — install 의 선택은 그 실행의 입력이고 기록을 대체한다. 그래서 기록에서 뺀 것 중 **아직 해제된**
  // id 는 `--without` 으로 다시 낸다(그 명령을 그대로 쳐도 같은 결과). 재체크는 명령에 안 나타난다 — 기본이 넣기다.
  const withIds = [...(userOverride?.forceInclude ?? [])];
  const without = [
    ...new Set([
      ...(userOverride?.forceExclude ?? []),
      ...baselineExclude,
      ...unchecked(log, tracks, assetIds, baselineIds),
      // #709 — 기록된 선택 MCP 서버의 체크를 풀었으면 뺀다(opt-in 이라 추천 대비 빼기에 안 든다)
      ...recordedMcpAssetIds(log).filter((id) => !assetIds.includes(id)),
    ]),
  ];
  const options: InstallOptions = {
    track: [...tracks],
    cli: [...cli],
    scope,
    projectDir,
    ...(withIds.length > 0 ? { with: withIds } : {}),
    ...(without.length > 0 ? { without } : {}),
  };
  const spec = installSpecFromOptions(options, [...cli], () => {});
  const recordTracks = new Set<string>(log ? log.spec.tracks : state.tracks);
  const addedTracks = tracks.filter((t) => !recordTracks.has(t));
  const addedClis = cli.filter((c) => !input.lockedClis.includes(c));
  const covered = coveredByRecord(log, state.tracks);
  const addedAssets = assetIds.filter((id) => !covered.has(id));
  const locked = input.lockedClis.join(", ");
  const summary = [
    header,
    annotate(formatSummary(spec), {
      Tracks: addedTracks.length > 0 ? `+${addedTracks.join(", +")}` : "no change",
      CLI: [
        addedClis.length > 0 ? `+${addedClis.join(", +")}` : "",
        locked ? `${locked} ${input.lockedClis.length > 1 ? "stay" : "stays"} — locked` : "",
      ]
        .filter(Boolean)
        .join(" · "),
      Assets:
        addedAssets.length > 0
          ? `+${addedAssets.length} new: ${addedAssets.join(", ")}`
          : "no new assets",
    }),
    scopeLine,
    `  RUNS AS   ${installCommandLine(options)}`,
    "            (adds the new track's files and the new CLI's files · refreshes what is installed · edited files → *.backup-<time>)",
    "            (retired-file cleanup runs on your next `agent-harness update`)",
  ].join("\n");
  const confirmed = await prompts.confirmInstall(summary);
  if (confirmed === null) return "back";
  if (!confirmed) {
    prompts.outro("Cancelled by user.");
    return { ok: false, reason: "cancelled" };
  }
  prompts.outro(stepLabel(UPDATE_WIZARD.RUN, "Installing..."));
  return { ok: true, mode: "add", spec };
}

/**
 * 설계 selection-record §3 — 기록의 최신 빼기(`excludedIds(log)`) 중 확인 화면에서 **아직 해제된** id. 위저드가 보여 주지 않는 키 id
 * 는 늘 여기 든다(설치자가 체크할 수 없었으니 빼기를 이어 간다). baseline 은 이번 트랙이 내는 것만 — 밖의 것은 install 이 이어받는다.
 */
export function unchecked(
  log: InstallLog | null,
  tracks: ReadonlyArray<Track>,
  assetIds: ReadonlyArray<string>,
  baselineIds: ReadonlyArray<string>,
): string[] {
  const checked = new Set([...assetIds, ...baselineIds]);
  const offered = new Set(listBaselineTargets({ tracks }).map((t) => t.id));
  return [...excludedIds(log)]
    .filter((id) => !checked.has(id))
    .filter((id) => !id.startsWith(BASELINE_PREFIX) || offered.has(id))
    .sort();
}

/**
 * 요약의 `Tracks:` · `CLI:` · `Assets:` 줄 끝에 무엇이 바뀌는지 붙인다 — 화면이 "무엇을 더하나"를
 * 말하게 한다. 빈 메모는 붙이지 않는다.
 */
function annotate(summary: string, notes: Record<"Tracks" | "CLI" | "Assets", string>): string {
  return summary
    .split("\n")
    .map((line) => {
      const key = (Object.keys(notes) as Array<keyof typeof notes>).find((k) =>
        line.startsWith(`${k}:`),
      );
      const note = key ? notes[key] : "";
      return note ? `${line.padEnd(40)} (${note})` : line;
    })
    .join("\n");
}

/**
 * Track 배열 동등 비교 (순서 무관). Preset 변경 감지에 사용.
 */
function tracksEqual(a: ReadonlyArray<Track>, b: ReadonlyArray<Track>): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((t, i) => t === sortedB[i]);
}

/**
 * v26.54.0 — Asset 선택 결과 (id 만) 와 preset 추천 비교 → forceInclude / forceExclude.
 * - `recommended - selected` → forceExclude (사용자가 unchecked)
 * - `selected - recommended` → forceInclude (사용자가 추가 선택)
 * 둘 다 비어있으면 undefined (no override).
 */
export function computeUserOverride(
  tracks: ReadonlyArray<Track>,
  assetIds: ReadonlyArray<string>,
): { forceInclude: ReadonlyArray<string>; forceExclude: ReadonlyArray<string> } | undefined {
  const recommended = new Set(wizardRecommended(tracks));
  const selected = new Set(assetIds);
  const forceExclude = [...recommended].filter((id) => !selected.has(id)).sort();
  const forceInclude = [...selected].filter((id) => !recommended.has(id)).sort();
  if (forceInclude.length === 0 && forceExclude.length === 0) return undefined;
  return { forceInclude, forceExclude };
}

export function formatSummary(spec: InstallSpec): string {
  const baselineExcluded = new Set(spec.baselineExclude ?? []);
  const opts = (Object.keys(spec.options) as Array<keyof OptionFlags>)
    .filter((k) => spec.options[k])
    .map((k) => k.replace(/^with/, "").toLowerCase());
  // v26.63.3 (clarify H1): "(defaults only)" 모호 → "(none added)" 명료.
  const optsLabel = opts.length > 0 ? opts.join(", ") : "(none added)";
  const lines = [
    `Tracks:    ${spec.tracks.join(", ")}`,
    `Options:   ${optsLabel}`,
    `CLI:       ${spec.cli.join(" · ")}`,
    `Target:    ${spec.projectDir}`,
  ];

  // v26.62.3 — 실제 install 될 자산 list 명시. defaults 만으로는 사용자가
  //   Step 3 에서 무엇을 confirm 했는지 알 수 없음. preset recommended +
  //   userOverride 적용 후 최종 selected assets list 표시.
  // v26.82.0 (Phase R, S6) — merge/그룹화는 preset-recommend.ts 단일 구현 사용 (중복 제거).
  const finalAssets = finalSelectedAssets(spec.tracks, spec.userOverride);
  if (finalAssets.length > 0) {
    // v26.102.0 (ADR-031) — confirm 화면의 약속 숫자에 CLI 도달 분해 병기 (SOD 리뷰 F3:
    // "4 selected" 확정 후 0 설치이던 불일치 — 숨김 없이 고지만).
    const unreachable = finalAssets.filter((id) => {
      const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
      return asset ? !assetReachesCli(asset, spec.cli) : false;
    });
    lines.push(
      unreachable.length > 0
        ? `Assets:    ${finalAssets.length} selected (${unreachable.length} outside [${spec.cli.join(", ")}] reach — not installed)`
        : `Assets:    ${finalAssets.length} selected`,
    );
    for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
      lines.push(`  · ${cat}: ${ids.join(", ")}`);
    }
    // v26.103.0 (ADR-032) — header 와 동일 문구 (표면별 상이 문구 금지, v26.88.0 교훈).
    // 해제분을 빼고 센다 (ADR-074). 이 숫자는 이 저장소의 1차 지표(Context Cost per Install)이고,
    // 상주 비용을 줄이려고 항목을 푼 사용자에게 안 줄어든 숫자를 보이면 그 자체가 거짓 보고다.
    // #320 H1 — 헤더와 같은 이유로 **설치기와 같은 spec**(`buildManifestSpec`)으로 센다.
    const cost = formatResidentCostLine(
      residentCostFor(spec),
      summarizeContextCost(finalAssets).unmeasuredCount,
    );
    if (cost) lines.push(`  · ${cost}`);
  }

  if (spec.userOverride) {
    if (spec.userOverride.forceInclude.length > 0) {
      lines.push(`  +User added: ${spec.userOverride.forceInclude.join(", ")}`);
    }
    if (spec.userOverride.forceExclude.length > 0) {
      lines.push(`  -Unchecked by you: ${spec.userOverride.forceExclude.join(", ")}`);
    }
  }
  // 트랙 baseline 해제분. 설치 화면과 **같은 문구**를 쓴다 (표면별 상이 문구 금지) — 다르면
  // 사용자가 확인 화면과 설치 결과를 대조할 수 없다.
  if (baselineExcluded.size > 0) {
    lines.push(
      `  -Excluded by you: ${baselineExcluded.size} — ${[...baselineExcluded]
        .map((id) => id.replace(BASELINE_PREFIX, ""))
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

// v26.54.0 — Re-exports to keep test imports stable (test의 mock 구조 변경 없음)
export { EXTERNAL_ASSETS, VISIBLE_OPTION_DEFS };

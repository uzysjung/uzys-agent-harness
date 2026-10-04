import {
  INSTALL_LOG_DIR,
  INSTALL_LOG_FILENAME,
  type InstallLog,
  installedClis,
} from "./install-log.js";
import type { DetectedInstall } from "./state.js";
import { type CliBase, type InstallScope, isTrack } from "./types.js";

/**
 * #533 (D1) — 기설치 메뉴는 세 항목이다. Add · Update 는 한 흐름(Update)으로 합쳐졌고, Remove 는
 * 고를 수 없는 항목이라 화면에서 빠졌고(제거는 Uninstall), Reinstall 은 `install --reinstall`
 * 플래그가 됐다.
 */
export type RouterAction = "update" | "uninstall" | "exit";

export interface RouterChoice {
  value: RouterAction;
  label: string;
  hint?: string;
  enabled: boolean;
}

/**
 * 메뉴 첫 줄이 읊는 **설치 기록** (#533 D2). 화면은 이 값을 보여주기만 한다 — 판정은 기록이 한다.
 */
export interface InstallRecordView {
  /** 기록의 CLI 집합(`installedClis`). `null` = 기록이 없다(옛 설치본) — "없다"가 아니라 "말할 수 없다". */
  clis: ReadonlyArray<CliBase> | null;
  scope: InstallScope | null;
  /** 깨진 설치의 복구 명령 (D10). `null` = 정상. */
  repair: string | null;
  /** #585 — 기록의 트랙(누적). 비었거나 없으면 머리글은 감지한 트랙을 말한다. */
  tracks?: ReadonlyArray<string>;
}

export const NO_RECORD: InstallRecordView = { clis: null, scope: null, repair: null };

/**
 * 설치 기록 → 메뉴가 보여줄 것.
 *
 * 깨진 설치 = 기록에 Claude 가 있는데 `.claude/` 가 없다(D10). 엔진이 같은 조건에서 update 를
 * 거절하므로(`installer.ts` update pre-flight) 거절될 항목을 고르게 두지 않고 복구 명령을 먼저
 * 보인다. **디스크 존재는 이 안내를 낼지에만 쓴다**(ADR-096 D6) — 판정의 주어는 기록이다.
 */
export function buildInstallRecordView(
  state: DetectedInstall,
  log: InstallLog | null,
  claudeDirExists: boolean,
): InstallRecordView {
  if (log === null) return NO_RECORD;
  const clis = installedClis(log);
  const broken = clis.includes("claude") && !claudeDirExists;
  return {
    clis,
    scope: log.scope,
    repair: broken ? repairCommand(log, state.tracks) : null,
    tracks: log.spec.tracks.filter(isTrack),
  };
}

/**
 * 복구 명령 — 트랙·scope 는 기록에서 채운다(`update-mode.ts` `recordClaudeCommand` 와 같은 조립에
 * `--reinstall` 만 더한 것). 기록의 트랙이 지금 어휘에 없으면 감지된 트랙으로 대신한다.
 */
function repairCommand(log: InstallLog, detected: ReadonlyArray<string>): string {
  const recorded = log.spec.tracks.filter(isTrack);
  const tracks = recorded.length > 0 ? recorded : detected;
  const trackArgs = tracks.map((t) => `--track ${t}`).join(" ");
  return `agent-harness install --reinstall ${trackArgs} --cli claude --scope ${log.scope}`;
}

/**
 * 메뉴 머리글 (D2). 기록이 있으면 트랙 · 깔린 CLI 집합 · scope · 기록 위치를, 없으면 그 사실을 말한다.
 * 깨진 설치면 그 아래 두 줄로 복구 명령을 보인다 (D10).
 */
export function describeInstall(
  state: DetectedInstall,
  record: InstallRecordView = NO_RECORD,
): string {
  // #585 — 기록이 있으면 기록의 트랙을 말한다(`.claude/.installed-tracks` 는 claude 를 깐 실행만 적는다)
  const shown =
    record.tracks !== undefined && record.tracks.length > 0 ? record.tracks : state.tracks;
  const tracks = shown.length > 0 ? shown.join(", ") : "(none detected)";
  if (record.clis === null) return `Installed here (no record): tracks ${tracks} · CLI unknown`;
  const clis = record.clis.length > 0 ? record.clis.join(", ") : "(none)";
  const head = `Installed here: tracks ${tracks} · CLI ${clis} · scope ${record.scope}   (record: ${INSTALL_LOG_DIR}/${INSTALL_LOG_FILENAME})`;
  if (record.repair === null) return head;
  return [
    head,
    "⚠ .claude/ is missing but the record says Claude Code is installed. Update cannot rebuild it.",
    `  Repair: ${record.repair}`,
  ].join("\n");
}

/**
 * 기설치 메뉴 (#533 D1). 깨진 설치면 Update 를 막는다(D10) — 고르면 엔진이 거절해 "install failed"
 * 로 끝나는 항목이다. 막는 것은 미리보기일 뿐이고 엔진 pre-flight 는 그대로 남는다.
 */
export function buildRouterChoices(
  _state: DetectedInstall,
  record: InstallRecordView = NO_RECORD,
): RouterChoice[] {
  const broken = typeof record.repair === "string";
  return [
    {
      value: "update",
      label: "Update",
      // 이 hint 가 update 동작의 광고다 — 갱신 대상(rules/agents/commands/hooks/skills)과 편집분
      // 백업을 빠뜨리면 거짓출하가 된다(R-3a · `tests/render-hint-parity.test.ts` 가 derive 로 문다).
      hint: broken
        ? ".claude/ missing — run the repair command above"
        : "bring installed rules / agents / commands / hooks / skills to this release; add tracks, CLIs or assets on the way — nothing is removed here, your edits are backed up as *.backup-<time>",
      enabled: !broken,
    },
    {
      value: "uninstall",
      label: "Uninstall",
      hint: "remove everything, one CLI, or single assets",
      enabled: true,
    },
    {
      value: "exit",
      label: "Exit",
      enabled: true,
    },
  ];
}

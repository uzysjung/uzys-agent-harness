/**
 * Interactive uninstall — v26.125.0 (사용자 요청 2026-07-19) · #533 (D8 · 사용자 결정 2026-09-27).
 *
 * `agent-harness uninstall` 을 TTY 에서 실행하거나 위저드 메뉴에서 Uninstall 을 고르면 **무엇을 뺄지
 * 고르는 화면**으로 들어간다. 두 진입점이 같은 함수를 부른다.
 *
 * 왜 install 위저드의 체크 해제가 아니라 별도 화면인가 (사용자 결정): install 화면의 체크 해제는
 * "이번에 설치하지 않음"이지 제거가 아니다. 설치 화면 안에서 삭제가 일어나면 실수 한 번이
 * 되돌릴 수 없는 삭제가 되고, "install 은 지우지 않는다"는 불변식도 깨진다. 그래서 제거는
 * 이 화면으로만 들어온다.
 *
 * 본 모듈은 **선택만** 한다 — 판정과 되돌리기는 기존 `uninstallAction` 이 그대로 한다. 세 모드가
 * 각각 기존 엔진 하나에 1:1 로 대응하므로 새로운 파괴적 조합이 생기지 않는다:
 *   CLI 하나   → `--cli <name>` (그 CLI 전용 자리 + 마지막 사용자가 된 공유 자리)
 *   선택 제거  → `--only <ids>` (templates 유지, 로그는 남은 자산으로 재기록)
 *   전량 제거  → 플래그 없음  (templates 포함 — `.claude/` 는 백업으로 옮긴다)
 * 화면의 `disabled`(CLI 가 하나 · 자산이 0)는 미리보기일 뿐이다 — 마지막 CLI · 빈 목록 · 없는 id 의
 * 거절은 엔진 pre-flight 가 그대로 한다.
 */

import { cancel, confirm, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import { CLI_OWNERSHIP, type OwnedPath, removableFor } from "./cli-ownership.js";
import {
  type InstallLog,
  type InstallLogAsset,
  installedClis,
  readInstallLog,
} from "./install-log.js";
import { CLI_BASE_LABELS } from "./prompts.js";
import type { CliBase } from "./types.js";

export interface RemovableRow {
  value: string;
  label: string;
  hint: string;
}

export type UninstallMode = "cli" | "selected" | "all";

export interface ModeChoice {
  value: UninstallMode;
  label: string;
  hint: string;
  enabled: boolean;
}

export interface CliRow {
  value: CliBase;
  label: string;
  hint: string;
}

export interface UninstallPrompts {
  intro: (msg: string) => void;
  outro: (msg: string) => void;
  cancel: (msg: string) => void;
  /** null = ESC/취소. `message` 는 화면 머리글(깔린 CLI · 자산 수). */
  selectMode: (
    choices: ReadonlyArray<ModeChoice>,
    message: string,
  ) => Promise<UninstallMode | null>;
  /** null = ESC/취소 */
  selectCli: (rows: ReadonlyArray<CliRow>) => Promise<CliBase | null>;
  /** null = ESC/취소. 빈 배열 = 아무것도 안 고름 */
  selectAssets: (rows: ReadonlyArray<RemovableRow>) => Promise<ReadonlyArray<string> | null>;
  confirm: (summary: string) => Promise<boolean | null>;
}

export interface InteractiveUninstallDeps {
  prompts?: UninstallPrompts;
  isTty?: () => boolean;
  readLog?: (projectDir: string) => InstallLog | null;
  /** 위저드 안에서 부를 때 — 위저드가 이미 머리글(intro)을 그렸다. */
  embedded?: boolean;
}

export interface InteractiveUninstallResult {
  ok: boolean;
  /** ok=true 일 때 `uninstallAction` 에 그대로 넘길 옵션. */
  options?: { projectDir: string; only?: string; cli?: CliBase };
  reason?: "no-tty" | "no-log" | "cancelled" | "nothing-selected";
  message?: string;
}

/**
 * 로그의 자산 → 선택 화면 행.
 *
 * hint 에 **고르면 실제로 무슨 일이 일어나는지**를 적는다. global(D16) 과 자동 되돌리기 경로가
 * 없는 method 는 골라도 자동 삭제되지 않으므로, 고르기 전에 말해야 한다 — 안 그러면 사용자가
 * 체크하고 Enter 를 눌렀는데 아무 일도 안 일어나는 것을 결과 화면에서야 알게 된다.
 */
export function buildRemovableRows(
  assets: ReadonlyArray<InstallLogAsset>,
): ReadonlyArray<RemovableRow> {
  return assets.map((a) => ({
    value: a.id,
    label: `${a.id}  [${a.method}]${a.version ? ` v${a.version}` : ""}`,
    hint: hintFor(a),
  }));
}

function hintFor(asset: InstallLogAsset): string {
  if (asset.scope === "global") {
    return "global scope — not removed automatically; prints the manual command to run";
  }
  switch (asset.method) {
    case "plugin":
      return "claude plugin uninstall --scope project";
    case "skill":
      return "npx skills remove";
    case "npm":
      return "npm uninstall --save-dev";
    case "npx-run":
    // shell-script = #492 에서 은퇴한 legacy kind. 옛 로그가 그대로 들어온다.
    case "shell-script":
    case "internal":
      return 'no automatic reverse path — only "Remove everything" clears it';
  }
}

/**
 * 첫 화면의 세 모드 (#533 D8). 고를 수 없는 경우를 **미리** 보인다 — 엔진이 거절할 선택을 고르게
 * 두면 "Remove one CLI" 를 누른 사용자가 오류 문장을 받는다. 판정은 여전히 엔진이 한다.
 */
export function buildUninstallModeChoices(
  clis: ReadonlyArray<CliBase>,
  assetCount: number,
): ModeChoice[] {
  return [
    {
      value: "cli",
      label: "Remove one CLI",
      hint:
        clis.length > 1
          ? "that CLI's own files go; files shared with a remaining CLI stay; your text stays"
          : 'only one CLI here — use "Remove everything"',
      enabled: clis.length > 1,
    },
    {
      value: "selected",
      label: "Remove selected assets",
      hint:
        assetCount > 0
          ? `pick from the ${assetCount} external assets; templates (.claude/ etc.) stay`
          : "no external assets recorded",
      enabled: assetCount > 0,
    },
    {
      value: "all",
      label: "Remove everything",
      hint: "assets + templates + the install record — .claude/ is moved aside as .claude.backup-<time>",
      enabled: true,
    },
  ];
}

/** 소유 표의 한 자리를 사람이 읽는 말로. `.claude/` 는 지우지 않고 옮긴다(사용자 결정 2026-09-27). */
function describeOwned(p: OwnedPath): string {
  if (p.kind === "dir" && p.path === ".claude/") {
    return ".claude/ → moved aside as .claude.backup-<time> (your own files there stay in it)";
  }
  if (p.kind === "import-block") return `the import block in ${p.path} (your text stays)`;
  if (p.path === "AGENTS.md") return "AGENTS.md harness sections (your ## Project Context stays)";
  if (p.path === ".agents/skills/") return ".agents/skills/<harness skills>";
  return p.path;
}

/** CLI 하나를 뺄 때 **나가는 것** — 엔진과 같은 표·같은 함수(`removableFor`)에서 만든다. */
function removalSummary(cli: CliBase, installed: ReadonlyArray<CliBase>): string[] {
  const remaining = installed.filter((c) => c !== cli);
  const { exclusive, sharedNowUnowned } = removableFor(cli, remaining);
  const lines: string[] = [];
  if (exclusive.length > 0) {
    lines.push(
      `  · ${exclusive.map(describeOwned).join(" · ")}   (only ${CLI_BASE_LABELS[cli]} uses them)`,
    );
  }
  if (sharedNowUnowned.length > 0) {
    lines.push(
      `  · ${sharedNowUnowned.map(describeOwned).join(" · ")}   (${CLI_BASE_LABELS[cli]} was the last user)`,
    );
  }
  const kept = [
    ...new Set(
      remaining.flatMap((c) =>
        CLI_OWNERSHIP[c].filter((p) => p.kind !== "keep").map((p) => p.path),
      ),
    ),
  ];
  lines.push(
    `  · kept: ${[...kept, ".mcp.json", `install record (clis: ${remaining.join(", ")})`].join(" · ")}`,
  );
  return lines;
}

/** CLI 선택 화면의 행 — hint 는 그 CLI 를 빼면 무엇이 나가는지 한 줄. */
export function buildCliRows(installed: ReadonlyArray<CliBase>): CliRow[] {
  return installed.map((cli) => {
    const { exclusive, sharedNowUnowned } = removableFor(
      cli,
      installed.filter((c) => c !== cli),
    );
    return {
      value: cli,
      label: CLI_BASE_LABELS[cli],
      hint: `removes ${[...exclusive, ...sharedNowUnowned].map(describeOwned).join(" · ")}`,
    };
  });
}

export async function runInteractiveUninstall(
  projectDir: string,
  deps: InteractiveUninstallDeps = {},
): Promise<InteractiveUninstallResult> {
  const prompts = deps.prompts ?? defaultUninstallPrompts();
  const isTty = deps.isTty ?? (() => Boolean(process.stdin.isTTY));
  const readLog = deps.readLog ?? readInstallLog;

  // CI/파이프에서 프롬프트가 뜨면 그대로 멈춘다 — install 위저드와 같은 게이트.
  if (!isTty()) return { ok: false, reason: "no-tty" };

  const log = readLog(projectDir);
  if (!log) return { ok: false, reason: "no-log" };

  if (!deps.embedded) prompts.intro("uzys-agent-harness · uninstall");
  const rows = buildRemovableRows(log.assets);
  const clis = installedClis(log);

  const mode = await prompts.selectMode(
    buildUninstallModeChoices(clis, rows.length),
    `uzys-agent-harness · uninstall     installed: ${clis.join(", ") || "(none)"} · assets ${rows.length}`,
  );
  if (mode === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }

  if (mode === "cli") return pickCli(projectDir, clis, prompts);

  if (mode === "all") {
    const ok = await prompts.confirm(
      [
        "Remove everything? This is the same as: agent-harness uninstall --yes",
        `  · ${log.assets.length} recorded asset(s) — only those with an automatic reverse path are removed`,
        "  · templates: .claude/ is moved aside as .claude.backup-<time> (your own files there stay in it); .codex/ · .opencode/ are removed",
        "  · the install record goes too",
        "  · files outside (.mcp.json etc.) are not deleted — you get instructions instead",
      ].join("\n"),
    );
    if (!ok) {
      prompts.cancel("Cancelled.");
      return { ok: false, reason: "cancelled" };
    }
    return { ok: true, options: { projectDir } };
  }

  const picked = await prompts.selectAssets(rows);
  if (picked === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }
  // 빈 선택을 그대로 흘리면 `--only` 가 비어 **전량 제거로 떨어진다**. 하나만 빼려던 사용자가
  // templates 까지 잃는 경로라 여기서 끊는다 (uninstall.ts 의 `--only ,` 방어와 같은 이유).
  if (picked.length === 0) {
    prompts.outro("Nothing selected — no changes.");
    return { ok: false, reason: "nothing-selected" };
  }

  const ok = await prompts.confirm(
    [
      `Remove ${picked.length} selected asset(s)? This is the same as: agent-harness uninstall --only ${picked.join(",")}`,
      ...picked.map((id) => `  · ${id}`),
      "",
      "Templates (.claude/ etc.) stay.",
    ].join("\n"),
  );
  if (!ok) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }
  return { ok: true, options: { projectDir, only: picked.join(",") } };
}

/** "Remove one CLI" — CLI 를 고르고, 그 CLI 를 빼면 무엇이 나가고 무엇이 남는지 보인 뒤 확인받는다. */
async function pickCli(
  projectDir: string,
  clis: ReadonlyArray<CliBase>,
  prompts: UninstallPrompts,
): Promise<InteractiveUninstallResult> {
  const cli = await prompts.selectCli(buildCliRows(clis));
  if (cli === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }
  const ok = await prompts.confirm(
    [
      `Remove ${cli}? This is the same as: agent-harness uninstall --cli ${cli}`,
      ...removalSummary(cli, clis),
    ].join("\n"),
  );
  if (!ok) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }
  return { ok: true, options: { projectDir, cli } };
}

/* v8 ignore start — @clack/prompts 어댑터. 선택 로직은 위 순수 함수들이 갖고 tests 로 검증. */
function defaultUninstallPrompts(): UninstallPrompts {
  return {
    intro: (m) => intro(m),
    outro: (m) => outro(m),
    cancel: (m) => cancel(m),
    selectMode: async (choices, message) => {
      const r = await select({
        message,
        options: choices.map((c) => ({
          value: c.value,
          label: c.enabled ? c.label : `${c.label} [disabled]`,
          hint: c.hint,
          ...(c.enabled ? {} : { disabled: true }),
        })),
      });
      return isCancel(r) ? null : (r as UninstallMode);
    },
    selectCli: async (rows) => {
      const r = await select({
        message:
          'Which CLI?  (the last remaining CLI cannot be removed this way — use "Remove everything")',
        options: rows.map((x) => ({ value: x.value, label: x.label, hint: x.hint })),
      });
      return isCancel(r) ? null : (r as CliBase);
    },
    selectAssets: async (rows) => {
      if (rows.length === 0) return [];
      const r = await multiselect({
        message: "Assets to remove (Space toggle · Enter confirm · ESC cancel)",
        options: rows.map((x) => ({ value: x.value, label: x.label, hint: x.hint })),
        required: false,
      });
      return isCancel(r) ? null : (r as string[]);
    },
    confirm: async (summary) => {
      const r = await confirm({ message: `${summary}\n\nProceed?`, initialValue: false });
      return isCancel(r) ? null : r;
    },
  };
}
/* v8 ignore stop */

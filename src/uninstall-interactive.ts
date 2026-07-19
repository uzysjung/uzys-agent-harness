/**
 * Interactive uninstall — v26.125.0 (사용자 요청 2026-07-19).
 *
 * `agent-harness uninstall` 을 TTY 에서 실행하면 **무엇을 뺄지 고르는 화면**으로 들어간다.
 *
 * 왜 install 위저드가 아니라 별도 명령인가 (사용자 결정): install 화면의 체크 해제는
 * "이번에 설치하지 않음"이지 제거가 아니다. 설치 화면 안에서 삭제가 일어나면 실수 한 번이
 * 되돌릴 수 없는 삭제가 되고, "install 은 지우지 않는다"는 불변식도 깨진다. 그래서 제거는
 * 이 명령으로만 들어온다.
 *
 * 본 모듈은 **선택만** 한다 — 실제 되돌리기는 기존 `uninstallAction` 이 그대로 수행한다.
 * 두 모드가 각각 기존 경로 하나에 1:1 로 대응하므로 새로운 파괴적 조합이 생기지 않는다:
 *   선택 제거 → `--only <ids>` (templates 유지, 로그는 남은 자산으로 재기록)
 *   전량 제거 → 플래그 없음  (templates 포함)
 */

import { cancel, confirm, intro, isCancel, multiselect, outro, select } from "@clack/prompts";
import { type InstallLog, type InstallLogAsset, readInstallLog } from "./install-log.js";

export interface RemovableRow {
  value: string;
  label: string;
  hint: string;
}

export type UninstallMode = "selected" | "all";

export interface UninstallPrompts {
  intro: (msg: string) => void;
  outro: (msg: string) => void;
  cancel: (msg: string) => void;
  /** null = ESC/취소 */
  selectMode: (rowCount: number) => Promise<UninstallMode | null>;
  /** null = ESC/취소. 빈 배열 = 아무것도 안 고름 */
  selectAssets: (rows: ReadonlyArray<RemovableRow>) => Promise<ReadonlyArray<string> | null>;
  confirm: (summary: string) => Promise<boolean | null>;
}

export interface InteractiveUninstallDeps {
  prompts?: UninstallPrompts;
  isTty?: () => boolean;
  readLog?: (projectDir: string) => InstallLog | null;
}

export interface InteractiveUninstallResult {
  ok: boolean;
  /** ok=true 일 때 `uninstallAction` 에 그대로 넘길 옵션. */
  options?: { projectDir: string; only?: string };
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
  if (asset.scope === "global") return "global scope — 자동 삭제 안 함, 수기 제거 명령을 출력한다";
  switch (asset.method) {
    case "plugin":
      return "claude plugin uninstall --scope project";
    case "skill":
      return "npx skills remove";
    case "npm":
      return "npm uninstall --save-dev";
    case "npx-run":
    case "shell-script":
    case "internal":
      return "자동 되돌리기 경로 없음 — 전량 제거(`.claude/` 삭제)로만 사라진다";
  }
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

  prompts.intro("uzys-agent-harness · uninstall");
  const rows = buildRemovableRows(log.assets);

  const mode = await prompts.selectMode(rows.length);
  if (mode === null) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }

  if (mode === "all") {
    const ok = await prompts.confirm(
      [
        "전량 제거 — 되돌릴 수 없다:",
        `  · 자산 ${log.assets.length}개 (자동 경로가 있는 것만 실제 제거)`,
        "  · templates 삭제: `.claude/` 등 (설치 기록도 함께 사라진다)",
        "  · `.claude/` 밖 파일(`.mcp.json` 등)은 삭제하지 않고 안내만 한다",
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
    prompts.outro("아무것도 선택하지 않았다 — 변경 없음.");
    return { ok: false, reason: "nothing-selected" };
  }

  const ok = await prompts.confirm(
    [
      `선택 제거 (${picked.length}개):`,
      ...picked.map((id) => `  · ${id}`),
      "",
      "templates 는 그대로 둔다.",
    ].join("\n"),
  );
  if (!ok) {
    prompts.cancel("Cancelled.");
    return { ok: false, reason: "cancelled" };
  }
  return { ok: true, options: { projectDir, only: picked.join(",") } };
}

/* v8 ignore start — @clack/prompts 어댑터. 선택 로직은 위 순수 함수들이 갖고 tests 로 검증. */
function defaultUninstallPrompts(): UninstallPrompts {
  return {
    intro: (m) => intro(m),
    outro: (m) => outro(m),
    cancel: (m) => cancel(m),
    selectMode: async (rowCount) => {
      const r = await select({
        message: `무엇을 제거할까? (설치된 자산 ${rowCount}개)`,
        options: [
          {
            value: "selected",
            label: "항목 선택해서 제거",
            hint: "templates(`.claude/` 등)는 그대로 둔다",
          },
          {
            value: "all",
            label: "전부 제거",
            hint: "자산 + templates. 설치 기록도 사라진다",
          },
        ],
      });
      return isCancel(r) ? null : (r as UninstallMode);
    },
    selectAssets: async (rows) => {
      if (rows.length === 0) return [];
      const r = await multiselect({
        message: "제거할 항목 (Space 토글 · Enter 확정 · ESC 취소)",
        options: rows.map((x) => ({ value: x.value, label: x.label, hint: x.hint })),
        required: false,
      });
      return isCancel(r) ? null : (r as string[]);
    },
    confirm: async (summary) => {
      const r = await confirm({ message: `${summary}\n\n진행할까?`, initialValue: false });
      return isCancel(r) ? null : r;
    },
  };
}
/* v8 ignore stop */

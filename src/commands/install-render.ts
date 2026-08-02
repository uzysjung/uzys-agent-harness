/**
 * Install 출력 렌더 레이어 (v26.82.0, Phase R).
 *
 * `commands/install.ts` 가 979줄(cap 800 초과 — repo 최대 위반)로 비대해진 원인이
 * 렌더 함수 누적이었음 → 본 파일로 추출. install.ts 는 spec 검증 + 파이프라인
 * 오케스트레이션만, 여기는 화면 출력만. 동작 변경 0 (순수 이동).
 */

import { CATEGORY_TITLES, type Category } from "../categories.js";
import { targetsInclude } from "../cli-targets.js";
import { formatResidentCostLine, residentCost, summarizeContextCost } from "../context-cost.js";
import { assetRow, c, infoRow, padDisplay, sectionHeader, unifiedSection } from "../design.js";
import {
  assetCliSupport,
  assetReachesCli,
  EXTERNAL_ASSETS,
  type ExternalAsset,
  experimentalOptInCandidates,
  isAssetSelected,
} from "../external-assets.js";
import type { AssetInstallResult } from "../external-installer.js";
import type { BaselineReport, InstallMode, InstallReport, ProgressEvent } from "../installer.js";
import { buildManifest } from "../manifest.js";
import { finalSelectedAssets, groupAssetsByCategory } from "../preset-recommend.js";
import { HARNESS_ANCHOR_FILE, HARNESS_IMPORT_LINE } from "../project-claude-merge.js";
import type { CliBase, CliTargets, InstallSpec, OptionFlags } from "../types.js";

/**
 * v26.78.1 — Summary `CLI` 행 라벨 (SSOT). spec.cli 에서 derive → 헤더와 일관.
 * 이전 pairwise if-chain 은 codex/opencode 만 열거해 `--cli antigravity` 가 "Claude" 로
 * 잘못 출력 (R2). 4 base 전부 매핑.
 */
const CLI_SUMMARY_LABELS: Record<CliBase, string> = {
  claude: "Claude",
  codex: "Codex",
  opencode: "OpenCode",
  antigravity: "Antigravity",
};

/** Callbacks for progressive rendering during runInstall (avoids "Phase 1 silence" UX). */
export interface PipelineCallbacks {
  onProgress?: (event: ProgressEvent) => void;
  externalDeps?: {
    onAssetStart?: (asset: ExternalAsset) => void;
    onAssetResult?: (result: AssetInstallResult) => void;
  };
}

/** createInstallRenderer 반환 — 스트리밍 콜백 + 렌더 상태 조회. */
export interface InstallRenderer {
  callbacks: PipelineCallbacks;
  /** External assets 헤더 출력 여부 — Summary 직전 trailing newline 판단용. */
  phase2HeaderPrinted(): boolean;
}

/**
 * install header (TARGET / TRACKS / CLI / SCOPE / OPTIONS / ASSETS) 렌더.
 * wizard 모드는 Step 3 review + Step 4 confirm 에서 이미 표시하므로 호출 안 함.
 */
export function renderInstallHeader(
  log: (msg: string) => void,
  spec: InstallSpec,
  mode?: InstallMode,
): void {
  const headerLabel =
    mode === "update"
      ? "uzys-agent-harness · update"
      : mode === "add"
        ? "uzys-agent-harness · add"
        : mode === "reinstall"
          ? "uzys-agent-harness · reinstall"
          : "uzys-agent-harness · install";
  log("");
  log(sectionHeader(headerLabel));
  log("");
  log(infoRow("TARGET", shortenPath(spec.projectDir)));
  log(infoRow("TRACKS", spec.tracks.join(", ")));
  log(infoRow("CLI", spec.cli.join(" · ")));
  // v26.64.0 (ADR-020) — SCOPE row. 사용자가 매 install 시 어디에 write 되는지 인지 (D16).
  {
    const effectiveScope = spec.scope ?? "project";
    const scopeMsg =
      effectiveScope === "global"
        ? "Global — writes to ~/.claude/, ~/.codex/, npm -g"
        : "Project — current directory only (no global write)";
    log(infoRow("SCOPE", scopeMsg));
  }
  log(infoRow("OPTIONS", formatOptions(spec)));
  // v26.82.0 (Phase R, S6) — merge 는 preset-recommend.ts 단일 구현 (이전 computeFinalAssets 중복).
  const finalAssets = finalSelectedAssets(spec.tracks, spec.userOverride);
  if (finalAssets.length > 0) {
    // v26.102.0 (ADR-031) — 선택 수와 실제 설치 수의 어긋남을 약속 시점에 고지 (SOD 리뷰 F3:
    // executive/codex 가 "4 selected" 약속 후 0 설치이던 불일치). 숨김 없이 분해만 병기.
    // 미지 id(검증은 install.ts 담당)는 도달 가능으로 취급 — 여기서 이중 판정하지 않는다.
    const unreachable = finalAssets.filter((id) => {
      const asset = EXTERNAL_ASSETS.find((a) => a.id === id);
      return asset ? !assetReachesCli(asset, spec.cli) : false;
    });
    const label =
      unreachable.length > 0
        ? `${finalAssets.length} selected (${unreachable.length} outside [${spec.cli.join(", ")}] reach — not installed)`
        : `${finalAssets.length} selected`;
    log(infoRow("ASSETS", label));
    for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
      log(`              ${c.dim(`· ${cat}:`)} ${ids.join(", ")}`);
    }
    // v26.103.0 (ADR-032) — Session-Start Context Cost NSM. 번들 스킬 = frontmatter 실측(~),
    // 외부 자산 = unmeasured 명시 (추정치를 실측처럼 표기 금지).
    const cost = formatResidentCostLine(
      residentCost(buildManifest(spec).filter((e) => e.applies(spec))),
      summarizeContextCost(finalAssets).unmeasuredCount,
    );
    if (cost) log(`              ${c.dim(`· ${cost}`)}`);
  }
  log("");
}

/**
 * runInstall 스트리밍 렌더 콜백 생성 — baseline 완료 시 즉시 Phase 1 rows 출력,
 * external 은 per-asset 스트리밍 + 카테고리 헤더 (ADR-016 grouped progress UX).
 */
export function createInstallRenderer(
  log: (msg: string) => void,
  spec: InstallSpec,
  verbose: boolean,
): InstallRenderer {
  let phase2HeaderPrinted = false;
  // v26.55.0 — Phase 2 grouped progress UX (ADR-016). category 변경 시 ━━ <Title> ━━ 헤더 출력.
  // external-installer 가 카테고리 순서로 정렬해 호출 → 첫 번째 호출이 category 1 의 첫 자산.
  let currentCategory: Category | null = null;
  const callbacks: PipelineCallbacks = {
    onProgress: (event) => {
      if (event.type === "baseline-complete") {
        // v26.81.0 (ADR-022) — withEcc boolean 삭제 → ecc-plugin 자산 선택으로 판정 (hint 게이팅).
        // v26.102.0 (ADR-031) — "선택 = 설치됨" 은 claude 도달 시에만 성립: codex 단독에선
        // ecc-plugin 이 배제되므로 fallback 힌트가 계속 진실이어야 한다 (SOD 리뷰 F2).
        const claudeSelected = targetsInclude(spec.cli, "claude");
        const eccWillInstall =
          claudeSelected &&
          (isAssetSelected("ecc-plugin", spec) || spec.options.withPrune === true);
        renderPhase1Rows(log, event.baseline, verbose, eccWillInstall, claudeSelected);
      } else if (event.type === "external-start" && event.assetCount > 0) {
        // v26.63.0 — phaseHeader → unifiedSection. count 헤더에 inline 표시.
        log(unifiedSection(`External assets (${event.assetCount})`));
        log("");
        phase2HeaderPrinted = true;
      } else if (event.type === "external-complete") {
        // v26.102.0 (ADR-031, Batch3) — CLI 도달 불가로 시도조차 안 한 자산 고지.
        // 침묵 제외는 "4-CLI 지원" 광고와 실동작의 어긋남을 숨긴다 (no-false-ship).
        // 어휘 주의: "skipped"(설치 실패)와 구분해 "not installed" 사용, 사유는 각 자산의
        // 실 도달 범위에서 derive — "claude-only" 하드코딩 금지 (SOD 리뷰 F4/F7/Nit-4).
        const excluded = event.report.excludedByCli;
        if (excluded.length > 0) {
          if (!phase2HeaderPrinted) {
            // attempted=0 인 트랙(executive 등)에서 고지가 헤더 없이 떠도는 것 방지 (F8).
            log(unifiedSection("External assets (0)"));
            phase2HeaderPrinted = true;
          }
          const bySupport = new Map<string, string[]>();
          for (const a of excluded) {
            const key = assetCliSupport(a).join("/");
            bySupport.set(key, [...(bySupport.get(key) ?? []), a.id]);
          }
          log("");
          for (const [support, ids] of bySupport) {
            log(
              `  ${c.dim(`· ${ids.length} asset(s) not installed — requires ${support}, selected [${spec.cli.join(", ")}]: ${ids.join(", ")}`)}`,
            );
          }
        }
      }
    },
    externalDeps: {
      onAssetStart: (asset) => {
        // v26.57.0 (F2) — 카테고리 헤더만 출력. 자산 시작 라인 (→) 제거 — ✓ 결과 한 라인으로 1 단위 명확화.
        if (asset.category !== currentCategory) {
          if (currentCategory !== null) log("");
          log(`  ${c.bold(`━━ ${CATEGORY_TITLES[asset.category]} ━━`)}`);
          currentCategory = asset.category;
        }
      },
      onAssetResult: (result) => {
        const meta = result.ok
          ? formatAssetMeta(result.asset, result.version)
          : (result.message ?? "failed");
        log(`  ${assetRow(result.ok ? "success" : "skip", result.asset.id, meta)}`);
      },
    },
  };
  return { callbacks, phase2HeaderPrinted: () => phase2HeaderPrinted };
}

/** Update mode 단축 Summary — manifest copy / external 모두 skip 된 경로. */
export function renderUpdateSummary(log: (msg: string) => void, report: InstallReport): void {
  log("");
  // v26.63.2 — Summary 도 unifiedSection 으로 통일 (━━ marker). Step 5 안 sub-section 들과 일관.
  log(unifiedSection("Summary"));
  log("");
  log(infoRow("STATUS", c.green("Update complete")));
  log(infoRow("MODE", "update"));
  if (report.backup) {
    log(infoRow("BACKUP", shortenPath(report.backup)));
    log(infoRow("ROLLBACK", `rm -rf .claude && mv ${shortenPath(report.backup)} .claude`));
  }
  log("");
}

/**
 * Codex / OpenCode / Antigravity 산출물 sub-section.
 * v26.78.1 (R2): antigravity 추가 — `--cli antigravity` 시 산출물 invisible 이던 버그 fix.
 * 산출물 report 가 없거나 해당 CLI 미선택 시 출력 없음 (이전 executeSpec 의 게이트 if 이동).
 */
export function renderCliArtifacts(
  log: (msg: string) => void,
  spec: InstallSpec,
  report: InstallReport,
): void {
  const hasArtifacts = Boolean(report.codex || report.opencode || report.antigravity);
  const cliSelected =
    targetsInclude(spec.cli, "codex") ||
    targetsInclude(spec.cli, "opencode") ||
    targetsInclude(spec.cli, "antigravity");
  if (!hasArtifacts || !cliSelected) {
    return;
  }
  log(unifiedSection(formatCliPhaseTitle(spec.cli)));
  log("");
  // AGENTS.md is shared across Codex/OpenCode — render once with shared note
  if (report.codex && report.opencode) {
    log(assetRow("success", "AGENTS.md", "shared (Codex + OpenCode)"));
  } else if (report.codex || report.opencode) {
    log(assetRow("success", "AGENTS.md", `from ${HARNESS_ANCHOR_FILE}`));
  }
  if (report.codex) {
    log(assetRow("success", ".codex/config.toml", "settings + [mcp_servers.*]"));
    log(assetRow("success", ".codex/hooks/", `${report.codex.hookFiles.length} files`));
    if (report.codex.skillFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/skills/<id>/SKILL.md",
          `${report.codex.skillFiles.length} skills`,
        ),
      );
    }
    // Codex global opt-in (D16) — config.toml trust entry, only when explicitly enabled.
    if (report.codexOptIn?.trustEntry.enabled) {
      const trust = report.codexOptIn.trustEntry;
      const kind = trust.status === "error" ? "skip" : "success";
      const meta =
        trust.status === "registered"
          ? '[projects."<dir>"] trust_level="trusted"'
          : trust.status === "already-present"
            ? "already present"
            : (trust.message ?? "error");
      log(assetRow(kind, "~/.codex/config.toml trust entry", meta));
    }
  }
  if (report.opencode) {
    log(assetRow("success", "opencode.json", "$schema + 5 keys"));
    log(assetRow("success", ".opencode/commands/", `${report.opencode.commandFiles.length} files`));
  }
  // v26.78.1 (R2) — Antigravity 산출물: rules (항상) + dev-method skills.
  if (report.antigravity) {
    if (report.antigravity.rulesFile) {
      log(assetRow("success", ".agents/rules/uzys-harness.md", `from ${HARNESS_ANCHOR_FILE}`));
    }
    if (report.antigravity.skillFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/skills/<id>/SKILL.md",
          `${report.antigravity.skillFiles.length} skills`,
        ),
      );
    }
  }
  log("");
}

/** 최종 Summary (STATUS / TRACKS / CLI / HOOK / WARN / OPT-IN / NEXT). */
export function renderFinalSummary(
  log: (msg: string) => void,
  spec: InstallSpec,
  report: InstallReport,
  fromWizard: boolean,
): void {
  // v26.63.2 — Summary 도 unifiedSection 으로 통일 (━━ marker).
  log(unifiedSection("Summary"));
  log("");
  log(infoRow("STATUS", c.green("Install complete")));
  log(infoRow("TRACKS", report.installedTracks.join(", ")));
  // v26.63.4 (P3): install header `CLI` 와 Summary `CLIs` 라벨 불일치 → `CLI` 로 통일.
  // v26.78.1 (R2): pairwise if-chain → spec.cli derive. antigravity 누락 + claude 무조건
  //   prepend(claude 미선택 시에도 "Claude" 표기) 버그 fix. 헤더와 동일 SSOT.
  log(infoRow("CLI", spec.cli.map((b) => CLI_SUMMARY_LABELS[b]).join(" · ")));
  // M-1 — settings.json 이 가리키던 없는 스크립트를 지웠으면 **소리를 낸다.** 무음 no-op 은
  //   이 처방을 채택할 때 명시적 기각 사유였다: 지금 유일한 파손 신호(bash exit 127)를 지우면서
  //   아무 말도 안 하면, 다음에 참조가 깨져도 아무도 모른다 (`no-false-ship` 원칙 5).
  //   update 분기(아래 renderPhase1Rows — renderUpdateSummary 는 STATUS/BACKUP 만 찍는다)와
  //   **같은 라벨·같은 정보량**을 쓰고, 어느 파일이 지워졌는지
  //   `.claude/` 기준 상대경로로 함께 보여준다 — 파일명만으로는 사용자가 못 찾는다.
  if (report.staleHookRefs.length > 0) {
    log(
      infoRow(
        "HOOK",
        c.yellow(
          `settings.json stale hook refs · ${report.staleHookRefs.length} removed ` +
            `(${report.staleHookRefs.join(", ")})`,
        ),
      ),
    );
  }
  if (report.external && report.external.skipped > 0) {
    log("");
    log(
      infoRow(
        "WARN",
        c.yellow(
          `${report.external.skipped} external asset${report.external.skipped > 1 ? "s" : ""} skipped (see Phase 2 above)`,
        ),
      ),
    );
  }
  // v26.102.0 (ADR-031) — v26.88.0 의 NOTE(plugin-kind 만 자체 재계산)를 대체: SSOT =
  //   report.external.excludedByCli. 구 NOTE 는 ⊘ 고지와 다른 계산식(shell-script 누락)이라
  //   같은 화면에서 숫자가 어긋났고, claude 를 함께 골라 실제 설치된 경우에도 "not installed"
  //   를 찍었다 (SOD 리뷰 F4 — no-false-ship "동일 목록 2곳 하드코딩 금지").
  if (report.external && report.external.excludedByCli.length > 0) {
    const excluded = report.external.excludedByCli;
    log("");
    log(
      infoRow(
        "EXCLUDED",
        c.dim(
          `${excluded.length} asset${excluded.length > 1 ? "s" : ""} not installed — outside [${spec.cli.join(", ")}] reach: ${excluded.map((a) => a.id).join(", ")}`,
        ),
      ),
    );
  }
  // v26.71.1 — experimental(T3) opt-in discoverability (Transparent Defaults — 숨김 0건).
  //   비대화형(--track) 에서 condition 은 맞지만 T3 라 default 제외된 자산을 --with 안내.
  //   wizard 모드는 이미 ⚠ 배지로 노출하므로 skip.
  if (!fromWizard) {
    const optIn = experimentalOptInCandidates(spec);
    if (optIn.length > 0) {
      log("");
      log(
        infoRow(
          "OPT-IN",
          c.dim(
            `${optIn.length} experimental available — add with --with <id>: ${optIn.map((a) => a.id).join(", ")}`,
          ),
        ),
      );
    }
  }
  log("");
  const primary = (spec.cli.includes("claude") ? "claude" : spec.cli[0]) ?? "claude";
  const label = CLI_SUMMARY_LABELS[primary];
  log(infoRow("NEXT", `Open ${c.bold(label)} — installed rules & skills are now active`));
  const scaffoldFiles = scaffoldFilesForCli(spec.cli);
  if (scaffoldFiles.length > 0) {
    log(
      infoRow(
        "FILL",
        `${scaffoldFiles.map((f) => c.bold(f)).join(" · ")} — a fill-in scaffold. Open and paste each ${c.bold("<!-- FILL: … -->")} prompt to your agent to tailor it to this project`,
      ),
    );
  }
  log("");
}

/**
 * Which project-context scaffold files a given CLI selection actually writes:
 * `CLAUDE.md` only for a claude install, `AGENTS.md` only for a non-claude CLI.
 * The FILL hint must name only files that were written — advertising a file that
 * a given `--cli` never produced is the no-false-ship "advertised ≠ real" trap.
 */
export function scaffoldFilesForCli(cli: ReadonlyArray<CliBase>): string[] {
  const files: string[] = [];
  if (cli.includes("claude")) {
    files.push("CLAUDE.md");
  }
  if (cli.some((target) => target !== "claude")) {
    files.push("AGENTS.md");
  }
  return files;
}

function formatAssetMeta(asset: ExternalAsset, version?: string): string {
  // v26.56.0 (F3) — description 제거. onAssetStart 의 → 라인이 이미 description 표시.
  // result row 는 method + source 만 간결하게 → terminal 120 char 안 wrap 방지.
  // v26.59.0 — plugin / npm-global 에 한해 version 표시 (path 기반 추출).
  const m = asset.method;
  const v = version ? ` ${c.dim(`v${version.replace(/^v/, "")}`)}` : "";
  switch (m.kind) {
    case "skill":
      // v26.63.3 (clarify M1): skill name 이 asset id 와 동일하면 중복 segment 생략.
      //   "skill · pbakaus/impeccable · impeccable" → "skill · pbakaus/impeccable"
      if (m.skill && m.skill !== asset.id) return `skill · ${m.source} · ${m.skill}`;
      return `skill · ${m.source}`;
    case "plugin":
      return `plugin · ${m.pluginId}${v}`;
    case "npm":
      // A2 (Promise audit) — ADR-020 후 npm 자산 default 는 `--save-dev`(project), `-g` 는 global scope 만.
      // 라벨에 "-g" 고정은 scope 거짓 표기 → scope-중립 "npm" 으로 정정.
      // v26.80.0 — pinned 버전 표기 (Transparent Defaults: 실행되는 정확한 버전 노출).
      return `npm · ${m.pkg}@${m.version}`;
    case "npx-run":
      return `npx · ${m.cmd}@${m.version}`;
    case "shell-script":
      return `bash · ${m.script}`;
    case "internal":
      // v26.81.0 (ADR-022) — 내부 템플릿 자산 (Phase 1 manifest 가 설치 주체).
      return `internal · templates (${m.key})`;
  }
}

/**
 * Phase 1 rows 출력. baseline-complete progress event에서 호출 — 외부 자산 설치
 * 시작 전 즉시 화면에 표시되어야 한다 (멈춰 보임 방지).
 */
function renderPhase1Rows(
  log: (msg: string) => void,
  baseline: BaselineReport,
  verbose = false,
  withEcc = false,
  // v26.102.0 (ADR-031) — ecc 힌트의 `--with ecc-plugin` 안내는 claude 도달 시에만 참
  // (plugin 은 claude 전용 — codex 단독에선 그 명령이 no-op, SOD 리뷰 F2).
  claudeSelected = true,
): void {
  // Update mode rows
  if (baseline.updateMode) {
    if (baseline.backup) {
      log(assetRow("success", "backup", shortenPath(baseline.backup)));
    }
    for (const [dir, count] of Object.entries(baseline.updateMode.updated)) {
      if (count > 0) log(assetRow("success", dir, `${count} files updated`));
    }
    for (const [dir, removed] of Object.entries(baseline.updateMode.pruned)) {
      if (removed.length > 0) {
        log(assetRow("skip", `${dir} orphan prune`, `${removed.length} removed`));
      }
    }
    if (baseline.updateMode.claudeMdUpdated) {
      log(assetRow("success", HARNESS_ANCHOR_FILE, "refreshed from template"));
    }
    // P5 이행 (ADR-060) — v26.140.0 이전 설치본은 앵커가 `.claude/CLAUDE.md` 라 루트에 없다.
    // 이번 update 가 만든 앵커와 사용자 `CLAUDE.md` 에 얹은 import 줄을 **화면에 남긴다**:
    // 조용히 하면 앵커 계약이 바뀐 사실도, 자기 CLAUDE.md 가 한 줄 늘었다는 사실도 모른다.
    if (baseline.updateMode.anchorCreated) {
      log(assetRow("success", HARNESS_ANCHOR_FILE, "created from template (anchor migration)"));
    }
    if (baseline.updateMode.rootImportAdded) {
      log(assetRow("success", "CLAUDE.md", `${HARNESS_IMPORT_LINE} import added`));
    }
    // 구 앵커는 지우지 않는다(사용자 편집 여부 판정 불가) — 대신 죽은 사본이라는 사실을 알린다.
    if (baseline.updateMode.legacyAnchor) {
      log(
        assetRow(
          "skip",
          baseline.updateMode.legacyAnchor,
          `legacy anchor · no longer updated — content now in ${HARNESS_ANCHOR_FILE}; delete it when you no longer need it`,
        ),
      );
    }
    // v26.126.0 (R-3a) — 편집분을 백업했다는 사실은 **반드시 화면에 남긴다**. 갱신 건수만 보이면
    // 사용자는 자기가 고친 내용이 어디로 갔는지 알 수 없고, 그게 R-3a 를 만든 침묵과 같은 실패다.
    if (baseline.updateMode.skillsBackedUp.length > 0) {
      log(
        assetRow(
          "skip",
          ".claude/skills edited files",
          `${baseline.updateMode.skillsBackedUp.length} backed up as *.backup-<time>`,
        ),
      );
    }
    // 2026-08-02 (ADR-062) — 다른 도구(`npx skills add`)가 소유한 자리는 건너뛴다. 그 사실을
    // 안 보이면 사용자는 "이 스킬만 왜 안 갱신되지"를 추적할 방법이 없고, 반대로 조용히
    // 덮어썼다면 자기 저장소가 바뀐 줄도 모른다. 둘 다 침묵이 문제라 건수가 아니라 이름을 낸다.
    if (baseline.updateMode.skillsSkippedLinks.length > 0) {
      log(
        assetRow(
          "skip",
          ".claude/skills linked",
          `${baseline.updateMode.skillsSkippedLinks.join(", ")} · owned by another tool (symlink) — not updated`,
        ),
      );
    }
    // v26.132.0 (ADR-047) — 룰·훅 편집분도 같은 이유로 노출. 자산 종류에 따라 보이고 안 보이면
    // 사용자는 "룰은 백업 안 되나 보다"로 학습한다.
    if (baseline.updateMode.policyBackedUp.length > 0) {
      log(
        assetRow(
          "skip",
          "edited policy files",
          `${baseline.updateMode.policyBackedUp.length} backed up as *.backup-<time>`,
        ),
      );
    }
    // M-1 (표면 대칭) — fresh 분기(`renderFinalSummary`)와 **같은 정보량**으로 어느 파일이
    // 지워졌는지 나열한다. 논거는 update 쪽이 더 강하다: install 은 settings.json 을 템플릿으로
    // 덮어쓰지만 update 는 사용자가 손댄 settings.json 을 **제자리에서** 고치는 유일한 경로라,
    // 사용자 자신이 적어 넣은 훅이 실제로 사라질 수 있는 쪽이다. 건수만 찍으면 그 사용자는
    // 자기 훅이 왜 없어졌는지 추적할 방법이 없다.
    const staleRefs = baseline.updateMode.staleHookRefs;
    if (staleRefs.length > 0) {
      log(
        assetRow(
          "skip",
          "settings.json stale hook refs",
          `${staleRefs.length} removed (${staleRefs.join(", ")})`,
        ),
      );
    }
    // v26.134.0 (R-3j-A · ADR-049) — 외부 CLI 산출물도 갱신 대상이 됐다. 화면에 안 보이면
    // codex/opencode 사용자는 update 가 자기 CLI 를 건드렸는지 알 수 없고, 그 침묵이 곧
    // "update 는 .claude/ 만 한다"는 오해를 유지시킨다.
    if (baseline.updateMode.externalUpdated > 0) {
      log(
        assetRow(
          "success",
          "external CLI artifacts",
          `${baseline.updateMode.externalUpdated} files updated`,
        ),
      );
    }
    if (baseline.updateMode.externalBackedUp.length > 0) {
      log(
        assetRow(
          "skip",
          "edited external CLI files",
          `${baseline.updateMode.externalBackedUp.length} backed up as *.backup-<time>`,
        ),
      );
    }
    return;
  }

  // Fresh / add / reinstall — Phase 1 rows
  // audit SEC-1/CODE-2 — 기존 settings.json·CLAUDE.md 를 덮어쓰기 전 백업했으면 fail-loud 노출.
  if (baseline.backups) {
    for (const b of baseline.backups) {
      log(assetRow("success", "backup", shortenPath(b)));
    }
  }
  // v26.57.1 (F2) — multi-line 구조 (header + use + files). visual hierarchy + width-safe.
  // 사용자 image 검증 (2026-05-17): 단일 라인 description 이 width 좁을 때 wrap → 들여쓰기 깨짐.
  const cats = baseline.categories;
  if (cats) {
    // v26.63.0 — files 라인은 verbose 옵션 시만. 기본은 카운트 + use 1 줄.
    // v26.63.2 — polish: label + count 칼럼 fixed-width 정렬 (28 char). spacing scale 일관.
    const phase1Row = (label: string, count: number, useText: string, files?: string[]) => {
      const labelCol = `${c.bold(label)} ${c.dim(`(${count})`)}`;
      const padded = padDisplay(labelCol, 28);
      log(`  ${c.green("✓")} ${padded} ${c.dim(useText)}`);
      if (verbose && files && files.length > 0) {
        log(`      ${c.dim("└ files:")} ${c.dim(files.join(", "))}`);
      }
    };

    if (cats.rules.length > 0) {
      phase1Row(
        "rules",
        cats.rules.length,
        "coding · git/PR · tests · ship checklist · MCP policy",
        cats.rules,
      );
    }
    if (cats.agents.length > 0) {
      // v26.63.3 (clarify H3): SOD jargon 보강 — independent verifier 명시.
      // v26.63.3 (distill H2): "Without ECC plugin..." 반복 제거 — section footer 통합.
      phase1Row(
        "agents",
        cats.agents.length,
        "SOD reviewer (opus, independent verifier) + 3 base",
        cats.agents,
      );
    }
    if (cats.hooks.length > 0) {
      phase1Row(
        "hooks",
        cats.hooks.length,
        "session-start · protect-files · checkpoint · mcp-pre-exec (security)",
        cats.hooks,
      );
    }
    if (cats.commands > 0) {
      phase1Row("commands", cats.commands, "/ecc:* (ECC plugin OFF fallback)");
    }
    if (cats.skills.length > 0) {
      phase1Row(
        "skills",
        cats.skills.length,
        "spec-scaling · deep-research · ui-visual-review · eval-harness (modified)",
        cats.skills,
      );
    }
  } else {
    // v0.6.0 backwards compat — categories 없는 fakeReport 등
    log(assetRow("success", "rules + hooks + commands + agents", `${baseline.filesCopied} files`));
    log(assetRow("success", "skeleton", `${baseline.dirsCopied} dirs`));
  }
  // v26.63.4 (P3): Templates section 의 assetRow 호출 labelWidth=28 명시 → phase1Row 와 column 정렬.
  //   default 40 은 External assets 의 긴 asset id (python-performance-optimization 등) 용 — 별개.
  const TEMPLATES_COL = 28;
  if (baseline.rootClaudeMd) {
    const n = baseline.rootClaudeMd.tracks.length;
    // 기존 사용자 파일에는 스캐폴드를 쓰지 않는다 — 두 경우를 같은 문구로 보고하면 그게 곧
    // 거짓 보고다 (P5 · ADR-060: 루트 CLAUDE.md 는 더 이상 덮어쓰지 않는다).
    log(
      assetRow(
        "success",
        "CLAUDE.md (root)",
        baseline.rootClaudeMd.created
          ? `fill-in scaffold + @import · ${n} track${n > 1 ? "s" : ""} noted`
          : `@import ${HARNESS_ANCHOR_FILE} (body preserved)`,
        TEMPLATES_COL,
      ),
    );
  }
  // v26.108.0 (ADR-037) — CI 스캐폴드 (opt-in). no-clobber: 기존 파일 보존은 skip 행으로
  //   정직 보고 (숨기면 "설치됨" 오인 — no-false-ship).
  if (baseline.ciScaffold) {
    for (const f of baseline.ciScaffold.written) {
      log(assetRow("success", f, "CI scaffold (fill-in template)", TEMPLATES_COL));
    }
    for (const f of baseline.ciScaffold.skippedExisting) {
      log(assetRow("skip", f, "exists — preserved (no overwrite)", TEMPLATES_COL));
    }
  }
  if (baseline.skipped > 0) {
    log(
      assetRow(
        "skip",
        "manifest entries (applies → false)",
        `${baseline.skipped} skipped`,
        TEMPLATES_COL,
      ),
    );
  }
  if (baseline.backup) {
    log(assetRow("success", "backup", shortenPath(baseline.backup), TEMPLATES_COL));
  }
  const mcpList = baseline.mcpServers.join(", ") || "(none)";
  log(assetRow("success", ".mcp.json", mcpList, TEMPLATES_COL));
  if (baseline.envFiles.mcpAllowlist) {
    log(
      assetRow(
        "success",
        ".mcp-allowlist",
        `${baseline.envFiles.mcpAllowlist.length} servers (D35 opt-in gate)`,
        TEMPLATES_COL,
      ),
    );
  }
  // v26.63.3 (distill H2): ECC fallback hint — Templates section 마지막에 통합 표시.
  //   withEcc=true (ECC plugin opt-in) 사용자에게는 hint 미표시.
  if (!withEcc && baseline.categories) {
    log("");
    log(
      `  ${c.dim("·")} ${c.dim("ECC plugin not selected — cherry-pick fallback active (up to 4 agents + 8 skills + 3 commands)")}`,
    );
    if (claudeSelected) {
      log(`  ${c.dim("·")} ${c.dim("Use --with ecc-plugin to install ECC plugin instead")}`);
    }
  }
  if (baseline.envFiles.envExampleCreated) {
    log(assetRow("success", ".env.example", "Supabase token guide"));
  }
  if (baseline.envFiles.gitignoreEnvAdded) {
    log(assetRow("success", ".gitignore", "+ .env"));
  }
  if (baseline.envFiles.gitignoreNpxSkillsAdded.length > 0) {
    log(
      assetRow(
        "success",
        ".gitignore",
        `+ ${baseline.envFiles.gitignoreNpxSkillsAdded.join(" ")} (agent CLI / harness artifacts)`,
      ),
    );
  }
  log("");
}

function formatOptions(spec: InstallSpec): string {
  // v26.81.0 (ADR-022) — 자산 플래그 13종 삭제 후 동작 옵션만. 키 순회로 enumeration drift 차단.
  const flags = (Object.keys(spec.options) as Array<keyof OptionFlags>)
    .filter((k) => spec.options[k])
    .map((k) =>
      k
        .replace(/^with/, "")
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .toLowerCase(),
    );
  // v26.63.3 (clarify H1): "(defaults only)" 모호 → "(none added)" 명료.
  return flags.length > 0 ? flags.join(", ") : c.dim("(none added)");
}

/**
 * Shorten an absolute path for display:
 *   /Users/foo/bar     → ~/bar (HOME relative)
 *   /private/tmp/x.X   → /tmp/x.X
 *   /a/very/long/path  → …/long/path (≥3 segs from end if > 50 chars)
 *
 * v26.48.0 — export for direct unit test (branch coverage 복구).
 */
export function shortenPath(p: string): string {
  if (p.length <= 50) return p;
  const home = process.env.HOME ?? "";
  if (home && p.startsWith(home)) {
    const rel = p.slice(home.length);
    return `~${rel.startsWith("/") ? "" : "/"}${rel}`;
  }
  // private/tmp prefix on macOS — drop /private
  if (p.startsWith("/private/tmp/")) {
    return p.slice("/private".length);
  }
  // Last 3 segments
  const segs = p.split("/").filter(Boolean);
  if (segs.length > 3) {
    return `…/${segs.slice(-3).join("/")}`;
  }
  return p;
}

/**
 * v0.7.0 — CliTargets에서 codex/opencode 포함 여부에 따라 title 결정.
 * Phase 3는 codex 또는 opencode 1개 이상 포함 시 호출됨.
 * v26.48.0 — export for direct unit test (branch coverage 복구).
 */
export function formatCliPhaseTitle(targets: CliTargets): string {
  // v26.78.1 (R2) — antigravity 추가. 누락 시 `--cli antigravity` 산출물 헤더가
  //   "CLI artifacts" generic 으로만 떠 antigravity 가 invisible 했음.
  const labels: string[] = [];
  if (targets.includes("codex")) labels.push("Codex");
  if (targets.includes("opencode")) labels.push("OpenCode");
  if (targets.includes("antigravity")) labels.push("Antigravity");
  return labels.length > 0 ? `${labels.join(" + ")} artifacts` : "CLI artifacts";
}

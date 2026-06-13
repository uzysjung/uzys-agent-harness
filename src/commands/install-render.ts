/**
 * Install 출력 렌더 레이어 (v26.82.0, Phase R).
 *
 * `commands/install.ts` 가 979줄(cap 800 초과 — repo 최대 위반)로 비대해진 원인이
 * 렌더 함수 누적이었음 → 본 파일로 추출. install.ts 는 spec 검증 + 파이프라인
 * 오케스트레이션만, 여기는 화면 출력만. 동작 변경 0 (순수 이동).
 */

import { CATEGORY_TITLES, type Category } from "../categories.js";
import { targetsInclude } from "../cli-targets.js";
import { assetRow, c, infoRow, padDisplay, sectionHeader, unifiedSection } from "../design.js";
import {
  type ExternalAsset,
  experimentalOptInCandidates,
  isAssetSelected,
} from "../external-assets.js";
import type { AssetInstallResult } from "../external-installer.js";
import type { BaselineReport, InstallMode, InstallReport, ProgressEvent } from "../installer.js";
import { finalSelectedAssets, groupAssetsByCategory } from "../preset-recommend.js";
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
    log(infoRow("ASSETS", `${finalAssets.length} selected`));
    for (const [cat, ids] of groupAssetsByCategory(finalAssets)) {
      log(`              ${c.dim(`· ${cat}:`)} ${ids.join(", ")}`);
    }
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
        const eccSelected = isAssetSelected("ecc-plugin", spec) || spec.options.withPrune === true;
        renderPhase1Rows(log, event.baseline, verbose, eccSelected);
      } else if (event.type === "external-start" && event.assetCount > 0) {
        // v26.63.0 — phaseHeader → unifiedSection. count 헤더에 inline 표시.
        log(unifiedSection(`External assets (${event.assetCount})`));
        log("");
        phase2HeaderPrinted = true;
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
    log(assetRow("success", "AGENTS.md", "from .claude/CLAUDE.md"));
  }
  if (report.codex) {
    log(assetRow("success", ".codex/config.toml", "settings + [mcp_servers.*]"));
    log(assetRow("success", ".codex/hooks/", `${report.codex.hookFiles.length} files`));
    log(
      assetRow(
        "success",
        ".agents/skills/uzys-*/SKILL.md",
        `${report.codex.skillFiles.length} skills ($uzys-spec mention)`,
      ),
    );
    // v0.7.1 — project-scoped prompts pre-positioning (글로벌 영향 0)
    if (report.codex.promptFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".codex/prompts/uzys-*.md",
          `${report.codex.promptFiles.length} prompts — pre-positioned for upstream #9848 (not active yet; use Global for working ~/.codex/prompts/)`,
        ),
      );
    }
    // Codex global opt-in (D16) — only when explicitly enabled
    if (report.codexOptIn) {
      if (report.codexOptIn.skillsInstalled.enabled) {
        log(
          assetRow(
            "success",
            "~/.codex/skills/uzys-*",
            `${report.codexOptIn.skillsInstalled.count} copied (global opt-in)`,
          ),
        );
      }
      if (report.codexOptIn.trustEntry.enabled) {
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
      // v0.7.0 — Codex prompts (slash 통일) opt-in 결과
      if (report.codexOptIn.promptsInstalled.enabled) {
        const count = report.codexOptIn.promptsInstalled.count;
        log(
          assetRow(
            count > 0 ? "success" : "skip",
            "~/.codex/prompts/uzys-*",
            `${count} markdown copied (/uzys-spec slash 등록)`,
          ),
        );
      }
    }
  }
  if (report.opencode) {
    log(assetRow("success", "opencode.json", "$schema + 5 keys"));
    log(assetRow("success", ".opencode/commands/", `${report.opencode.commandFiles.length} files`));
    log(assetRow("success", ".opencode/plugins/uzys-harness.ts", "self-contained plugin"));
  }
  // v26.78.1 (R2) — Antigravity 산출물. rules 항상, skills/workflows 는 uzys-harness 선택 시만.
  if (report.antigravity) {
    if (report.antigravity.rulesFile) {
      log(assetRow("success", ".agents/rules/uzys-harness.md", "from .claude/CLAUDE.md"));
    }
    if (report.antigravity.skillFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/skills/uzys-*/SKILL.md",
          `${report.antigravity.skillFiles.length} skills`,
        ),
      );
    }
    if (report.antigravity.workflowFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/workflows/uzys-*.md",
          `${report.antigravity.workflowFiles.length} workflows`,
        ),
      );
    }
    // Antigravity global opt-in (D16) — only when explicitly enabled.
    if (report.antigravityOptIn) {
      const opt = report.antigravityOptIn;
      if (opt.skillsInstalled.enabled) {
        log(
          assetRow(
            "success",
            "~/.gemini/antigravity/skills/uzys-*",
            `${opt.skillsInstalled.count} copied (global opt-in)`,
          ),
        );
      }
      if (opt.workflowsInstalled.enabled) {
        log(
          assetRow(
            "success",
            "~/.gemini/antigravity/global_workflows/uzys-*",
            `${opt.workflowsInstalled.count} copied (global opt-in)`,
          ),
        );
      }
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
  // v26.78.1 (R1) — karpathy hook opt-in 결과 렌더. null = 미opt-in(표시 안 함).
  //   이전엔 wired=false(plugin install 실패 등)여도 무음 → 사용자가 hook 안 깔린 걸
  //   모른 채 "Install complete" 만 봄 (Rule 12 fail-loud 위반).
  if (report.karpathyHook) {
    const kh = report.karpathyHook;
    if (kh.wired) {
      log(infoRow("HOOK", c.green("karpathy-coder pre-commit hook wired")));
    } else {
      log(infoRow("HOOK", c.yellow(`karpathy hook skipped — ${kh.reason ?? "unknown"}`)));
    }
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
  // v26.84.0 (audit UX-2): /uzys:* 슬래시 명령은 uzys-harness opt-in 시에만 설치된다.
  //   기본 설치(uzys-harness 미선택)·codex/opencode 단독설치에서도 무조건
  //   `claude → /uzys:spec` 를 안내하던 것은 존재하지 않는 명령으로 첫 가치를 유도하는
  //   dead-end 였다 (no-false-ship "광고≠실동작"). 실제 설치 결과로 분기한다.
  const hasUzysHarness = isAssetSelected("uzys-harness", spec);
  const hasClaude = spec.cli.includes("claude");
  if (hasUzysHarness && hasClaude) {
    log(infoRow("NEXT", `${c.bold("claude")}  →  ${c.cyan("/uzys:spec")}`));
  } else {
    const primary = hasClaude ? "claude" : spec.cli[0];
    const label = CLI_SUMMARY_LABELS[primary] ?? primary;
    log(infoRow("NEXT", `Open ${c.bold(label)} — installed rules & skills are now active`));
  }
  log("");
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
      log(assetRow("success", ".claude/CLAUDE.md", "refreshed from template"));
    }
    if (baseline.updateMode.staleHookRefs.length > 0) {
      log(
        assetRow(
          "skip",
          "settings.json stale hook refs",
          `${baseline.updateMode.staleHookRefs.length} removed`,
        ),
      );
    }
    return;
  }

  // Fresh / add / reinstall — Phase 1 rows
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
        "session-start · gate-check (6-Gate order) · spec-drift · agentshield (security)",
        cats.hooks,
      );
    }
    if (cats.commands > 0) {
      phase1Row("commands", cats.commands, "uzys-harness option: /uzys:* (7)");
    }
    if (cats.skills.length > 0) {
      phase1Row(
        "skills",
        cats.skills.length,
        "north-star · gh-issue-workflow · ui-visual-review · cl-v2 (modified)",
        cats.skills,
      );
    }
  } else {
    // v0.6.0 backwards compat — categories 없는 fakeReport 등
    log(assetRow("success", "rules + hooks + commands + agents", `${baseline.filesCopied} files`));
    log(assetRow("success", "skeleton", `${baseline.dirsCopied} dirs`));
  }
  // v26.63.4 (P3): Templates section 의 assetRow 호출 labelWidth=28 명시 → phase1Row 와 column 정렬.
  //   default 40 은 External assets 의 긴 asset id (architecture-decision-record 등) 용 — 별개.
  const TEMPLATES_COL = 28;
  if (baseline.rootClaudeMd) {
    const n = baseline.rootClaudeMd.tracks.length;
    log(
      assetRow(
        "success",
        "CLAUDE.md (root)",
        `merged from ${n} track${n > 1 ? "s" : ""}`,
        TEMPLATES_COL,
      ),
    );
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
    log(`  ${c.dim("·")} ${c.dim("Use --with ecc-plugin to install ECC plugin instead")}`);
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
        `+ ${baseline.envFiles.gitignoreNpxSkillsAdded.join(" ")} (npx skills universal install)`,
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

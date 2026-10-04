import { homedir } from "node:os";
import { hasTrustEntry } from "../codex/trust-entry.js";
/**
 * Install 출력 렌더 레이어 (v26.82.0, Phase R).
 *
 * `commands/install.ts` 가 979줄(cap 800 초과 — repo 최대 위반)로 비대해진 원인이
 * 렌더 함수 누적이었음 → 본 파일로 추출. install.ts 는 spec 검증 + 파이프라인
 * 오케스트레이션만, 여기는 화면 출력만. 동작 변경 0 (순수 이동).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { CATEGORY_TITLES, type Category } from "../categories.js";
import { targetsInclude } from "../cli-targets.js";
import { formatResidentCostLine, summarizeContextCost } from "../context-cost.js";
import {
  assetRow,
  c,
  infoRow,
  padDisplay,
  sectionHeader,
  status,
  symbol,
  unifiedSection,
} from "../design.js";
import {
  assetCliSupport,
  assetReachesCli,
  EXTERNAL_ASSETS,
  type ExternalAsset,
  experimentalOptInCandidates,
  RENAMED_SKILL_IDS,
  RETIRED_SKILL_IDS,
} from "../external-assets.js";
import type { AssetInstallResult } from "../external-installer.js";
import type { JudgedWrite, SharedWrite } from "../install-writes.js";
import {
  type BaselineReport,
  buildManifestSpec,
  type ExcludedStillThere,
  type InstallInterruptedError,
  type InstallMode,
  type InstallReport,
  type ProgressEvent,
} from "../installer.js";
import { RETIRED_AGENTS, TRACK_AGENTS } from "../manifest.js";
import type { OutsideLink } from "../outside-project.js";
import { finalSelectedAssets, groupAssetsByCategory } from "../preset-recommend.js";
import { HARNESS_ANCHOR_FILE, HARNESS_IMPORT_LINE } from "../project-claude-merge.js";
import { residentCostFor, residentEntries } from "../resident-entries.js";
import type { SharedWriteResult } from "../shared-write.js";
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

/** 옛 앵커(`.claude/CLAUDE.md`) 안내 — update(기록 있는 설치본)와 install(기록 없는 옛 판, #595)이 같은 문장을 쓴다. */
const LEGACY_ANCHOR_NOTE = `legacy anchor · no longer updated — content now in ${HARNESS_ANCHOR_FILE}; delete it when you no longer need it`;
/**
 * install header (TARGET / TRACKS / CLI / OPTIONS / ASSETS) 렌더.
 * #560 — SCOPE 행은 없다. 하네스 파일은 늘 이 프로젝트에 쓰이고, 그 행의 Global 문구("writes to ~/.claude/")가 사실이 아니었다.
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
  // #560 — 새 설치는 늘 project 라 행이 없다. 기록이 global 인 옛 설치본은 update·install 이 외부 도구를
  //   홈에 다시 깔므로 그 사실만 말한다 — 하네스 파일은 그 설치본도 이 프로젝트에 쓴다.
  if (spec.scope === "global") {
    log(
      infoRow(
        "SCOPE",
        "Global (from your install record) — external tools install for your user (~/.claude/, npm -g); harness files stay in this project",
      ),
    );
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
    // #320 H1 — **설치기와 같은 spec 으로 센다.** `InstallSpec` 을 그대로 넘기면
    // `selectedInternalSkills` 가 없어 번들 스킬이 전부 미설치로 계산되고, 설치자에게
    // 실제보다 작은 숫자가 나간다(track=tooling 에서 23 vs 실제 34). 계측·문서만 고치고
    // 이 줄을 두면 화면과 내부 수치가 어긋난다 — 일관되게 틀린 것보다 나쁘다.
    // #458 — **update 모드는 여기서 안 찍는다.** 이 줄은 manifest 계획, 즉 "지금 깔면 이렇게
    // 된다"이고 update 화면에서는 사실이 될 수 없다: 트랙에서 강등·은퇴한 에이전트 파일이
    // 디스크에 남아 매 세션 상주하는데 계획에는 없어서, 설치자는 실제보다 작은 숫자를 본다
    // (실측: 화면 agents 2 · 디스크 4). 갱신 **후 디스크**로 잰 줄을 `renderUpdateSummary` 가 낸다.
    if (mode !== "update") {
      const cost = formatResidentCostLine(
        residentCostFor(spec),
        summarizeContextCost(finalAssets).unmeasuredCount,
      );
      if (cost) log(`              ${c.dim(`· ${cost}`)}`);
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
        renderPhase1Rows(log, event.baseline, verbose);
      } else if (event.type === "install-log-error") {
        // #600 — 파일은 다 깔렸는데 기록을 못 남겼다. 침묵하면 `uninstall` · `update` 가 이 설치를 못 보는 이유를
        // 설치자가 알 길이 없다.
        log(
          `  ${status.warn(c.yellow(`could not record this install (${event.message}) — uninstall and update will not see it. Fix the cause, then run the same install again`))}`,
        );
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
        // #422 — 패키지 설치(npm · npx)는 수 분 걸리는데 결과 행이 뜰 때까지 화면이 침묵해
        // 설치자에게 "멈춤"으로 보였다(netlify-cli 413 MB). 시작을 한 줄로 알린다 — 다른 종류는
        // 초 단위라 F2 결정(자산당 결과 1행) 그대로 둔다.
        if (asset.method.kind === "npm" || asset.method.kind === "npx-run") {
          const what =
            asset.method.kind === "npm"
              ? `npm install ${asset.method.pkg}@${asset.method.version}`
              : `npx ${asset.method.cmd}@${asset.method.version}`;
          log(`  ${c.dim(`… ${asset.id}  ${what} — running, may take a few minutes`)}`);
        }
      },
      onAssetResult: (result) => {
        const base = result.ok
          ? formatAssetMeta(result.asset, result.version)
          : (result.message ?? "failed");
        // #678 — 일부 CLI 자리만 밖이라 그 자리는 부르지 않았다 — 깔린 자리만 말한다.
        const outsideNote =
          result.ok && result.outside?.length
            ? ` · ${result.outside.map((o) => `${o.root}/ left as is (links outside the project: ${o.target})`).join(" · ")}`
            : "";
        const meta = `${base}${outsideNote}`;
        log(`  ${assetRow(result.ok ? "success" : "skip", result.asset.id, meta)}`);
      },
    },
  };
  return { callbacks, phase2HeaderPrinted: () => phase2HeaderPrinted };
}

/** Update mode 단축 Summary — manifest copy / external 모두 skip 된 경로. */
export function renderUpdateSummary(
  log: (msg: string) => void,
  spec: InstallSpec,
  report: InstallReport,
): void {
  log("");
  // v26.63.2 — Summary 도 unifiedSection 으로 통일 (━━ marker). Step 5 안 sub-section 들과 일관.
  log(unifiedSection("Summary"));
  log("");
  log(infoRow("STATUS", c.green("Update complete")));
  log(infoRow("MODE", "update"));
  if (report.backup) {
    log(infoRow("BACKUP", shortenPath(report.backup)));
    // #651 — 이 줄은 복사해 실행하는 명령이다: 축약 금지(전체 경로) + 인용 필수(공백 경로).
    log(infoRow("ROLLBACK", `rm -rf .claude && mv ${shellQuotePath(report.backup)} .claude`));
  }
  // #458 — 상주 계측은 **갱신이 끝난 뒤** 낸다. 헤더 자리(계획)에서 옮겨온 이유는 위 주석에.
  // 문구는 헤더·wizard 와 같은 `formatResidentCostLine` 하나에서 온다 (표면별 조립 금지).
  const cost = formatResidentCostLine(
    residentCostFor(spec, residentEntriesOnDisk(spec), contextFilesOnDisk(spec)),
    summarizeContextCost(finalSelectedAssets(spec.tracks, spec.userOverride)).unmeasuredCount,
  );
  if (cost) log(infoRow("CONTEXT", cost));
  // #480 ③ — 백업이 있으면 **다음 행동**을 지목한다. 백업 사실만 알리면 설치자는 파일을 열어
  // 손으로 옮긴다 — 그게 이 이슈가 말한 스트레스다. "edited" 라고 부르지 않는다: 기록이 없던
  // 옛 설치본의 헬퍼처럼 설치자가 고치지 않았는데도 한 번 백업되는 파일이 있다(#597).
  const backups = report.updateMode?.backups ?? [];
  if (backups.length > 0) {
    log(
      infoRow(
        "BACKUPS",
        `${backups.length} file(s) saved before replacing, as *.backup-<time> · list: .uzys-agent-harness/update-backups.json`,
      ),
    );
    log(
      infoRow(
        "NEXT",
        'to re-apply your edits on the new version, ask audit-harness-fit: "update 백업본의 내 편집을 새 판에 다시 얹어줘"',
      ),
    );
  }
  log("");
}

/**
 * update 가 재는 상주 엔트리 — claude 자리의 룰·스킬·에이전트를 **갱신 뒤 디스크에서** 읽는다
 * (#458 · #615 사례 4).
 *
 * 계획(manifest)과 디스크가 갈리는 경우가 실재한다: 트랙 조건화(ADR-090)·은퇴(ADR-089)는 파일을
 * 안 지우고, `--only` 로 고르지 않은 묶음과 프로젝트 밖 링크(#678)는 옛 판 그대로 남고, 설치자가
 * 고친 파일·직접 넣은 파일도 매 세션 상주한다. 화면이 계획을 재면 바로 그 차이가 빠진다.
 *  - 룰·에이전트: 폴더의 `.md` 전부(설치자 것 포함 — 상주하는 것은 상주한다). 백업 `*.backup-*` 는 아니다.
 *  - 스킬: 계획한 번들 스킬 중 **디스크에 있는 것**을 디스크 판으로. 폴더 전부를 세지 않는 이유는
 *    외부 스킬이 같은 폴더에 깔리고 그쪽은 `external unmeasured` 로 따로 세기 때문이다(두 번 세지 않는다).
 * claude 가 없는 설치는 계획 그대로다 — 그 CLI 의 산출물은 `AGENTS.md` 한 파일에 룰을 인라인으로
 * 담는 등 이 단위로 갈라 잴 수 없다.
 */
function residentEntriesOnDisk(
  spec: InstallSpec,
): Array<{ source: string; target: string; file?: string }> {
  const planned = residentEntries(spec);
  // claude 가 없으면 `.claude/` 를 만든 적이 없다 — 남의 `.claude/agents/` 는 이 설치의 상주가 아니다.
  if (!spec.cli.includes("claude")) {
    return planned.filter((e) => !e.target.startsWith(".claude/agents/"));
  }
  const mdFiles = (kind: "rules" | "agents") => {
    const dir = join(spec.projectDir, ".claude", kind);
    return existsSync(dir)
      ? readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isFile() && e.name.endsWith(".md"))
          .map((e) => ({
            source: `${kind}/${e.name}`,
            target: `.claude/${kind}/${e.name}`,
            // 배포판이 아니라 **이 프로젝트의 파일**을 잰다 — 사용자가 고친 본문도,
            // 배포판에 더는 없는 파일도 실제로 상주하는 것은 이쪽이다.
            file: join(dir, e.name),
          }))
      : [];
  };
  const skills = planned
    .filter((e) => e.target.startsWith(".claude/skills/"))
    .map((e) => ({ ...e, file: join(spec.projectDir, e.target) }))
    .filter((e) => existsSync(e.file));
  return [
    ...planned.filter(
      (e) =>
        !e.target.startsWith(".claude/rules/") &&
        !e.target.startsWith(".claude/agents/") &&
        !e.target.startsWith(".claude/skills/"),
    ),
    ...mdFiles("rules"),
    ...skills,
    ...mdFiles("agents"),
  ];
}

/**
 * update 뒤 CLAUDE.md 행이 잴 파일 (#615 사례 4) — claude 가 매 세션 읽는 앵커 · 루트 `CLAUDE.md` ·
 * 남아 있는 구 앵커(`.claude/CLAUDE.md`, ADR-060 이행 전 위치 — 지우지 않으므로 계속 읽힌다).
 * 루트 `CLAUDE.md` 는 설치자 본문까지 잰다: 템플릿 스캐폴드로 재면 키운 본문이 화면에서 사라진다.
 * claude 가 없으면 undefined — `AGENTS.md` 는 룰을 인라인으로 품어 룰 행과 겹친다(위 함수와 같은 이유).
 */
function contextFilesOnDisk(spec: InstallSpec): string[] | undefined {
  if (!spec.cli.includes("claude")) return undefined;
  return [HARNESS_ANCHOR_FILE, "CLAUDE.md", join(".claude", "CLAUDE.md")].map((f) =>
    join(spec.projectDir, f),
  );
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
  const agentsMd = report.opencode?.agentsMd ?? report.codex?.agentsMd ?? null;
  // AGENTS.md is shared across Codex/OpenCode — render once with shared note
  // #558 — 설치자 파일에 블록 하나만 더했으면(첫 접촉) 그렇게 말한다. 하네스가 만든 파일(절 모델)은 전과 같다.
  const agentsBlock = agentsMd?.model === "block" ? agentsMd.shared : null;
  if (agentsBlock) {
    // 리뷰 NOTE-2 — 설치자가 블록을 지워 excluded 면 파일에 블록이 없다. 있는 것만 말한다
    const row = sharedRow(
      agentsBlock,
      harnessKeysInFile(agentsBlock).length > 0
        ? "one harness block at the end (your text kept as-is)"
        : "no harness block in the file (your text kept as-is)",
    );
    if (row) log(row);
  } else if (report.codex && report.opencode) {
    log(assetRow("success", "AGENTS.md", "shared (Codex + OpenCode)"));
  } else if (report.codex || report.opencode) {
    log(assetRow("success", "AGENTS.md", `from ${HARNESS_ANCHOR_FILE}`));
  }
  // #528 — 새로 만든 앵커에 다른 앵커의 설치자 절을 옮겨 심었으면 말한다. 조용히 옮기면
  // 설치자는 자기 문장이 두 파일에 생긴 것을 모르고, 어느 쪽을 고쳐야 하는지도 모른다.
  const agentsSeededFrom =
    report.codex?.agentsMdSeededFrom ?? report.opencode?.agentsMdSeededFrom ?? null;
  if (agentsSeededFrom) {
    log(
      assetRow(
        "success",
        "AGENTS.md",
        `Project Context seeded from ${agentsSeededFrom} · CLI 고유 표현은 audit-harness-fit 으로 맞춘다`,
      ),
    );
  }
  if (report.codex) {
    // #563 — 하네스 몫(구간 둘)만 썼다. 설치자 키가 이긴 항목은 "kept yours" · 못 읽었으면 "left" 와 이유.
    const configRow = report.codex.configToml
      ? sharedRow(report.codex.configToml, configRegionsPart(report.codex.configToml))
      : assetRow("success", ".codex/config.toml", "settings + [mcp_servers.*]");
    if (configRow) log(configRow);
    log(assetRow("success", ".codex/hooks/", `${report.codex.hookFiles.length} files`));
    if (report.codex.skillFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/skills/<id>/",
          `${countSkillDirs(report.codex.skillFiles)} bundled skills`,
        ),
      );
    }
    // Codex global opt-in (D16) — config.toml trust entry, only when explicitly enabled.
    if (report.codexOptIn?.trustEntry.enabled) {
      const trust = report.codexOptIn.trustEntry;
      const kind = trust.status === "error" || trust.status === "unreadable" ? "skip" : "success";
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
    // #563 — 하네스 몫은 MCP 키(`mcp.<name>`)뿐이다. 나머지 키는 파일을 새로 만들 때만 깔린다.
    const opencodeJson = report.opencode.opencodeJson;
    const opencodeRow = opencodeJson
      ? sharedRow(opencodeJson, opencodeMcpPart(opencodeJson))
      : assetRow("success", "opencode.json", "$schema + 5 keys");
    if (opencodeRow) log(opencodeRow);
    if (report.opencode.skillFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/skills/",
          `${countSkillDirs(report.opencode.skillFiles)} bundled skills (codex·antigravity 와 같은 자리)`,
        ),
      );
    }
    // ADR-081 — 옛 커맨드 사본을 지웠으면 말한다. 조용히 지우면 사용자는 자기가 쓰던
    // 슬래시 커맨드가 왜 사라졌는지 알 방법이 없다 (스킬로 옮겨져 이름은 그대로 뜬다).
    if (report.opencode.retiredCommands.length > 0) {
      log(
        assetRow(
          "skip",
          ".opencode/commands/",
          `${report.opencode.retiredCommands.length} retired · 같은 스킬이 .agents/skills/ 로 옮겨졌다 (백업 남김)`,
        ),
      );
    }
  }
  // v26.78.1 (R2) — Antigravity 산출물: rules (항상) + dev-method skills.
  // #564 — 숫자는 **이번 실행이 쓴 것**(변환 반환값 — writer 가 받아 기록에 적은 경로)에서 센다. 앵커 한 줄만
  //   적던 탓에 같은 폴더에 쓴 배포 룰(`harnessRuleFiles`)이 화면에서 빠졌다(csr-fastapi: 디스크 6 · 화면 1).
  if (report.antigravity) {
    const anchor = report.antigravity.rulesFile;
    const rules = report.antigravity.harnessRuleFiles.length;
    const total = (anchor ? 1 : 0) + rules;
    if (total > 0) {
      const parts = [
        ...(anchor ? [`uzys-harness.md from ${HARNESS_ANCHOR_FILE}`] : []),
        ...(rules > 0 ? [`${rules} harness rule${rules === 1 ? "" : "s"}`] : []),
      ];
      log(
        assetRow(
          "success",
          ".agents/rules/",
          `${total} file${total === 1 ? "" : "s"} · ${parts.join(" + ")}`,
        ),
      );
    }
    // 스킬 수는 이미 변환이 쓴 파일(`skillFiles`)의 `<id>` 수다. 같은 폴더에 외부 skill 팩(`npx skills`)도
    //   들어가므로 "bundled" 로 이 줄이 무엇을 세는지 밝힌다 — 팩은 External assets 절이 한 줄씩 말한다.
    if (report.antigravity.skillFiles.length > 0) {
      log(
        assetRow(
          "success",
          ".agents/skills/<id>/",
          `${countSkillDirs(report.antigravity.skillFiles)} bundled skills`,
        ),
      );
    }
  }
  log("");
}

/**
 * #551 (ADR-097 §4) — 함께 쓰는 파일 한 줄. 판정이 낸 행동만 말한다: 만들었다 · 하네스 몫만 썼다 · 이미 최신 · 못 써서
 * 남겼다(이유와 함께). 설치자 값이 이긴 항목은 "kept yours" 로 붙인다. update 가 없는 파일을 안 만든 것은 말하지 않는다.
 */
function sharedRow(r: SharedWriteResult, part: string): string | null {
  if (r.action === "skipped") return null;
  if (r.action === "left") return assetRow("skip", r.path, `left — ${r.line}`);
  // 안 쓴 파일을 "최신" 이라 하지 않는다 — 남겨 둔 하네스 구간이 있으면 그 구간은 최신인지 모른다
  const unchanged =
    r.leftAsIs.length > 0
      ? "nothing written — yours stays"
      : "harness part already current — yours stays";
  // 걷기만 한 실행은 "썼다" 고 하지 않고, 고친 값까지 걷었으면 "yours stays" 라 하지 않는다(리뷰 #693 NOTE-2)
  const onlyRemoved =
    r.removedOut.length > 0 && !r.replaced && r.added.length === 0 && r.restored.length === 0;
  const verb =
    r.action === "created"
      ? "wrote"
      : r.action === "updated"
        ? onlyRemoved
          ? "removed the harness part"
          : r.removedEdited.length > 0
            ? "wrote the harness part"
            : "wrote the harness part — yours stays"
        : unchanged;
  const kept = r.kept.length > 0 ? ` · kept yours: ${r.kept.join(" · ")}` : "";
  const left = r.leftAsIs.length > 0 ? ` · harness part left as is: ${r.leftAsIs.join(" · ")}` : "";
  const restored = r.restored.length > 0 ? ` · ${restoredKeysPart(r.restored)}` : "";
  const out = excludedKeyParts(r)
    .map((p) => ` · ${p}`)
    .join("");
  return assetRow("success", r.path, `${verb} · ${part}${kept}${left}${restored}${out}`);
}

/** `opencode.json` 에 하네스가 쓴 서버 이름 — 기록할 몫(`mcp.<name>`)에서. */
function opencodeMcpPart(r: SharedWriteResult): string {
  const names = harnessKeysInFile(r)
    .map((k) => /^mcp\.(.+)$/.exec(k)?.[1])
    .filter((n): n is string => n !== undefined && !n.endsWith("{}"));
  return names.length > 0 ? `harness mcp: ${names.join(" · ")}` : "no harness part in the file";
}

/** config.toml 의 하네스 구간 — 파일 순서(`top` 이 맨 앞)대로. */
function configRegionsPart(r: SharedWriteResult): string {
  const order = (k: string) => (k === "top" ? 0 : 1);
  const regions = harnessKeysInFile(r).sort((a, b) => order(a) - order(b));
  return regions.length > 0
    ? `harness regions: ${regions.join(" · ")}`
    : "no harness part in the file";
}

/**
 * 리뷰 B1 · NOTE-2 — 지금 파일에 든 하네스 몫의 키. 기록할 몫(`portions` — 쓴 것 · 설치자가 고쳐 남긴 것) + 기록 없이
 * 남겨 둔 구간·블록(`leftAsIs`). 설치자가 지워 excluded 인 키는 어느 쪽에도 없다 — 없는 것을 있다고 말하지 않는다.
 */
function harnessKeysInFile(r: SharedWriteResult): string[] {
  // 파일에 없는 키(`missing`) · 설치자 값으로 말하는 키(`kept` — 리뷰 #693 LOW: 두 목록에 같은 키) · 뺐는데 고쳐 둔 키는 빼고 센다
  const keptOut = new Set(r.keptOut.map((id) => id.slice(id.indexOf(":") + 1)));
  const absent = new Set([...r.missing, ...r.kept, ...keptOut]);
  const inFile = (r.portions ?? []).map((p) => p.key).filter((k) => !absent.has(k));
  return [...new Set([...inFile, ...r.leftAsIs])];
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
  // #678 — 실제로 쓴 것만 "켜졌다" 고 말한다. Claude 몫을 하나도 못 썼으면(폴더가 밖 링크) 켜진 것이 없다.
  const outside = report.outsideLinks ?? [];
  const cats = report.categories;
  const claudeNothing =
    primary === "claude" &&
    outside.length > 0 &&
    cats !== undefined &&
    cats.rules.length + cats.skills.length + cats.agents.length + cats.hooks.length === 0;
  log(
    infoRow(
      "NEXT",
      claudeNothing
        ? `No harness rules or skills were written for ${c.bold(label)} — their folder links outside the project (see ⊘ above)`
        : outside.length > 0
          ? `Open ${c.bold(label)} — installed rules & skills are now active · ${outside.length} file(s) left outside the project (see ⊘ above)`
          : `Open ${c.bold(label)} — installed rules & skills are now active`,
    ),
  );
  // #567 · ADR-097 결정 2 — Codex 는 룰(`AGENTS.md`)·스킬은 바로 읽지만 `.codex/config.toml` 은 이 폴더를
  // 신뢰해야 켠다(실측 Codex 0.125.0: trust 전 `codex mcp list` = 서버 0 · sandbox 설정 무시). 그 한 번의
  // 확인은 Codex 가 첫 실행에서 직접 묻는다. 이번 실행이 trust 항목을 이미 등록했으면 말할 것이 없다.
  const codexTrusted =
    report.codexOptIn?.trustEntry.status === "registered" ||
    report.codexOptIn?.trustEntry.status === "already-present";
  // #637 — 플래그 없는 재설치는 codexOptIn 자체를 안 만들어, **이미 등록된** trust 를
  // 확인하지 않고 안내를 되살렸다 — Codex 는 묻지도 않는데 "trust this folder" 를 말한다.
  // 전역 config 의 해당 항목 존재를 직접 본다(등록 여부 판정은 trust-entry 의 SSOT).
  const alreadyTrustedGlobally = (() => {
    try {
      const home = process.env.CODEX_HOME ?? join(homedir(), ".codex");
      const configPath = join(home, "config.toml");
      if (!existsSync(configPath)) return false;
      return hasTrustEntry(readFileSync(configPath, "utf8"), spec.projectDir);
    } catch {
      return false;
    }
  })();
  if (spec.cli.includes("codex") && !codexTrusted && !alreadyTrustedGlobally) {
    // NEXT 값 열에 맞춘 이어지는 줄 — infoRow 의 들여쓰기 2 + 라벨 14 + 구분 공백 1.
    const cont = (text: string): string => `${" ".repeat(16)} ${text}`;
    log(
      cont(
        `${c.bold("Codex")} turns on .codex/config.toml (MCP · hooks · sandbox · approval) only after you trust this folder:`,
      ),
    );
    // #644 — 방금 `--with-codex-trust` 가 전역 config 를 못 읽어 쓰지 않았으면 같은 플래그를 다시 권하지 않는다.
    const headless =
      report.codexOptIn?.trustEntry.status === "unreadable"
        ? "headless: fix ~/.codex/config.toml (not valid TOML), then run with --with-codex-trust again"
        : "headless: agent-harness install … --with-codex-trust";
    log(cont(`open Codex here → ${c.bold('"Trust and continue"')}   ${c.dim(`(${headless})`)}`));
  }
  // #551 리뷰 N2 — 첫 접촉 `AGENTS.md`(설치자 파일 + 하네스 블록)에는 스캐폴드를 넣지 않는다. 그 파일에 FILL 이 실제로
  // 없으면 FILL 안내에서 뺀다(안 쓴 것을 쓴 것처럼 알리지 않는다)
  // #636 — 하네스가 **새로 만든** CLAUDE.md 는 FILL 프롬프트를 갖고 태어나므로 그대로 안내한다.
  // 사용자의 기존 파일(created === false)에 FILL 이 없다면 "없는 것을
  // 채우라"고 안내할 수 없으니 뺀다. #608 — antigravity 단독은 AGENTS.md 를 아예 만들지
  // 않으므로 scaffold 목록 자체에서 빠진다(scaffoldFilesForCli 가 codex·opencode 만 넣는다).
  const scaffoldFiles = scaffoldFilesForCli(spec.cli).filter(
    (f) =>
      (f === "CLAUDE.md" && report.rootClaudeMd?.created === true) ||
      hasFillPrompt(join(spec.projectDir, f)),
  );
  if (scaffoldFiles.length > 0) {
    // ADR-084 — `audit-harness-fit` 의 populate 모드가 같은 스캐폴드를 리포 근거로 채운다.
    // **실제로 깔린 경우에만** 말한다: 안 깔린 스킬을 부르라는 안내는 "advertised ≠ real" 이다.
    // 설치 여부는 설치기와 같은 spec 으로 센다(위 ASSETS 줄과 같은 이유).
    const auditInstalled =
      buildManifestSpec(spec).selectedInternalSkills?.includes("audit-harness-fit");
    const populateHint = auditInstalled
      ? `, or ask the ${c.bold("audit-harness-fit")} skill to fill it from repository evidence`
      : "";
    log(
      infoRow(
        "FILL",
        `${scaffoldFiles.map((f) => c.bold(f)).join(" · ")} — a fill-in scaffold. Open and paste each ${c.bold("<!-- FILL: … -->")} prompt to your agent to tailor it to this project${populateHint}`,
      ),
    );
  }
  log("");
}

/** 파일에 채울 자리(`<!-- FILL: … -->`)가 실제로 있는가. 못 읽으면 없다. */
function hasFillPrompt(path: string): boolean {
  try {
    return readFileSync(path, "utf8").includes("<!-- FILL:");
  } catch {
    return false;
  }
}

/**
 * ADR-086 — `skillFiles` 는 이제 스킬 **디렉터리 전체**의 파일이다(SKILL.md + references/ …).
 * 화면의 "N skills" 는 파일 수가 아니라 `<id>` 디렉터리 수여야 한다 — 8종을 골랐는데 "13 skills"
 * 로 뜨면 설치자가 자기가 안 고른 것이 깔렸다고 읽는다.
 */
export function countSkillDirs(skillFiles: ReadonlyArray<string>): number {
  const ids = new Set<string>();
  for (const f of skillFiles) {
    const m = /[\\/]\.agents[\\/]skills[\\/]([^\\/]+)[\\/]/.exec(f);
    if (m?.[1] !== undefined) ids.add(m[1]);
  }
  return ids.size;
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
  // #608 — AGENTS.md 를 만드는 것은 codex·opencode 뿐이다. antigravity 의 산출물은
  // .agents/rules/uzys-harness.md(앵커·FILL 프롬프트 없음)라 이 안내의 대상이 아니다.
  if (cli.includes("codex") || cli.includes("opencode")) {
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
    case "internal":
      // v26.81.0 (ADR-022) — 내부 템플릿 자산 (Phase 1 manifest 가 설치 주체).
      return `internal · templates (${m.key})`;
  }
}

/**
 * #524 — `.claude/skills/<id>` 가 이 프로젝트의 `.agents/skills/<id>` 로의 링크인 자리. install 과
 * update 가 같은 함수로 낸다. 갱신된 것과 안 된 것을 **다른 행**으로 — 한 행이면 설치자는 자기
 * 스킬이 최신인지 알 수 없다. 안 된 쪽은 이유(그 본문은 우리 기록에 없다)를 함께 적는다.
 */
function linkedSkillRows(
  log: (msg: string) => void,
  updated: ReadonlyArray<string>,
  notOurs: ReadonlyArray<string>,
): void {
  for (const id of updated) {
    log(assetRow("success", `.claude/skills/${id}`, `linked · updated via .agents/skills/${id}`));
  }
  for (const id of notOurs) {
    log(
      assetRow(
        "skip",
        `.claude/skills/${id}`,
        `linked · not ours — .agents/skills/${id} 는 이 하네스가 쓴 기록이 없어 건드리지 않았다`,
      ),
    );
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
): void {
  // Update mode rows
  if (baseline.updateMode) {
    if (baseline.backup) {
      log(assetRow("success", "backup", shortenPath(baseline.backup)));
    }
    for (const [dir, count] of Object.entries(baseline.updateMode.updated)) {
      if (count > 0) log(assetRow("success", dir, `${count} files updated`));
    }
    // #283 — 릴리즈로 새로 생긴 자산. 갱신 건수에 합치지 않고 따로 낸다: 사용자가 안 만든
    // 파일이 늘어난 것이므로 "몇 개 갱신"과는 다른 사실이고, 조용하면 자기 것으로 오인한다.
    // 한 줄에 이어 붙이지 않는다 — 레거시 설치본에서는 십수 개가 한 번에 나온다.
    for (const path of baseline.updateMode.installedNew) {
      log(assetRow("success", path, "added by this release"));
    }
    // 원인이 다르면 문구도 달라야 한다. 이쪽은 전에 깔아 준 적이 있는 파일이라 사용자가
    // 지웠을 수 있다 — "이번 릴리즈에 추가됨"이라고 적으면 그 사용자에게는 거짓말이고,
    // 자기가 지운 파일이 왜 돌아왔는지 추적할 단서가 사라진다.
    // #550 — "다시 지우라"는 답이 아니다: 설치 기록이 그 자산을 설치 대상으로 보는 한 다음 update 가
    // 또 되살린다(룰·에이전트·스킬 모두 — 리뷰 N1 실측). 빼는 길은 해제를 기록하는 재설치 하나라, 그
    // 인자(install 이 실제로 받는 id — `restoredWithout`)를 채워 한 줄로 낸다. 재설치는 이미 되살아난
    // 파일을 지우지 않으므로 "그다음 다시 지운다"까지 말한다(리뷰 N2). 인자가 없는 자산은 뺄 길이
    // 없으니 그 사실을 말한다. 같은 스킬이 두 자리에서 돌아와도 인자는 하나다.
    const withoutArgs: string[] = [];
    for (const path of baseline.updateMode.restored) {
      const arg = baseline.updateMode.restoredWithout?.[path];
      if (arg === undefined) {
        log(
          assetRow(
            "success",
            path,
            "was missing — reinstalled (harness-managed — update always restores it)",
          ),
        );
        continue;
      }
      log(assetRow("success", path, "was missing — reinstalled"));
      if (!withoutArgs.includes(arg)) withoutArgs.push(arg);
    }
    if (withoutArgs.length > 0) {
      log(
        assetRow(
          "skip",
          "to keep it out",
          `deleting is undone by the next update — re-run \`agent-harness install\` with your usual flags plus ${withoutArgs.map((a) => `--without ${a}`).join(" ")}, then delete it again (${KEPT_OUT_SCOPE})`,
        ),
      );
    }
    // ADR-099 §4 — 함께 쓰는 파일에서 사라진 하네스 몫을 되돌렸다. 손으로 지운 것은 빼기가 아니라서 되돌리고,
    // 빼는 명령과 그 효과 범위(KEPT_OUT_SCOPE)를 같은 줄에 붙인다.
    for (const r of baseline.updateMode.restoredKeys ?? []) {
      log(assetRow("success", r.path, restoredKeysPart(r.ids)));
    }
    // ADR-099 R2 — 기록에 있는데 파일째 사라진 CLI 산출물을 되살렸다. 빼는 길은 그 CLI 를 빼는 것 하나다
    for (const f of baseline.updateMode.restoredFiles ?? []) {
      log(assetRow("success", f.path, restoredFilePart(f)));
    }
    // ADR-099 R2 — update 도 install 과 같은 writer 로 루트 · `.claude/` 의 함께 쓰는 파일 몫을 쓴다 — 같은 행으로 말한다
    for (const f of baseline.updateMode.sharedWrites ?? []) {
      const row = sharedFileRow(f);
      if (row !== null) log(row);
    }
    // 리뷰 #693 NOTE-1 — update 도 install 과 같은 줄로 말한다(뺐지만 남은 것은 더 갱신하지 않는다)
    for (const row of excludedStillThereRows(baseline.updateMode.excludedStillThere ?? []))
      log(row);
    for (const r of baseline.updateMode.excludedKeys ?? []) {
      log(assetRow("success", r.path, excludedKeyParts(r).join(" · ")));
    }
    const legacy = legacyRestoredRow(baseline.updateMode.legacyRestored ?? []);
    if (legacy !== null) log(legacy);
    for (const row of legacyReleasedCatalogRows(baseline.updateMode.legacyReleasedCatalog ?? []))
      log(row);
    for (const [dir, removed] of Object.entries(baseline.updateMode.pruned)) {
      if (removed.length > 0) {
        log(assetRow("skip", `${dir} orphan prune`, `${removed.length} removed`));
      }
    }
    // #480 — 고르지 않은 묶음은 건드리지 않았음을 말한다. 조용하면 "update 를 돌렸는데 룰이
    // 그대로다"가 결함으로 읽힌다.
    if (baseline.updateMode.skippedGroups.length > 0) {
      log(
        assetRow(
          "skip",
          "not selected — untouched",
          `${baseline.updateMode.skippedGroups.join(", ")} · run again with --only or the wizard to include`,
        ),
      );
    }
    if (baseline.updateMode.claudeMdUpdated) {
      log(assetRow("success", HARNESS_ANCHOR_FILE, "refreshed from template"));
    }
    // #480 — 편집분을 백업했다는 사실은 반드시 화면에 남긴다(룰 `edited policy files` 행과 같은 이유).
    if (baseline.updateMode.anchorBackedUp) {
      log(
        assetRow(
          "skip",
          `${HARNESS_ANCHOR_FILE} edited`,
          "your edits backed up as *.backup-<time> — latest template is now active",
        ),
      );
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
    // ADR-085 — 관리 블록 안(상시 스킬 안내)이 깔린 스킬을 따라 바뀌었으면 말한다. 사용자
    // 파일의 한 구간이 바뀐 것이라 조용히 넘기지 않는다.
    if (baseline.updateMode.rootBlockRefreshed) {
      log(
        assetRow(
          "success",
          "CLAUDE.md",
          "harness block refreshed (skills that apply continuously)",
        ),
      );
    }
    // #528 BLOCKER-6 — 기록에 없는 `.claude/` 는 건너뛰되 침묵하지 않는다. 설치자 디렉터리와
    // 앵커 기록이 지워진 옛 claude 설치본이 같은 모양이라, 판정 대신 사실과 복구 명령을 낸다.
    if (baseline.updateMode.claudeUnrecorded) {
      log(
        assetRow(
          "skip",
          ".claude/",
          `present but not recorded as installed — left untouched. If its rules/ · agents/ · hooks/ · skills/ came from this tool (you did not write them), run \`${baseline.updateMode.claudeUnrecorded}\` once to re-record them and updates resume; otherwise this directory is yours`,
        ),
      );
    }
    // 구 앵커는 지우지 않는다(사용자 편집 여부 판정 불가) — 대신 죽은 사본이라는 사실을 알린다.
    if (baseline.updateMode.legacyAnchor) {
      log(assetRow("skip", baseline.updateMode.legacyAnchor, LEGACY_ANCHOR_NOTE));
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
    // #477 — 번들에서 사라진 파일을 지웠다는 사실도 화면에 남긴다. 조용히 지우면 사용자는
    // 파일이 왜 없어졌는지 모르고, 안 지우면 옛 서식이 디스크에 남는다 — 둘 다 침묵이 문제다.
    if (baseline.updateMode.skillsPruned.length > 0) {
      log(
        assetRow(
          "success",
          ".claude/skills not in bundle",
          `${baseline.updateMode.skillsPruned.length} files deleted · ${baseline.updateMode.skillsPruned.join(", ")}`,
        ),
      );
    }
    // #524 — 이 프로젝트의 `.agents/skills/<id>` 로의 링크는 "남의 것" 행이 아니라 여기서 말한다.
    linkedSkillRows(
      log,
      baseline.updateMode.skillsLinked ?? [],
      baseline.updateMode.skillsLinkedNotOurs ?? [],
    );
    // 2026-08-02 (ADR-062) — 다른 도구(`npx skills add`)가 소유한 자리는 건너뛴다. 그 사실을
    // 안 보이면 사용자는 "이 스킬만 왜 안 갱신되지"를 추적할 방법이 없고, 반대로 조용히
    // 덮어썼다면 자기 저장소가 바뀐 줄도 모른다. 둘 다 침묵이 문제라 건수가 아니라 이름을 낸다.
    // #343 — **종류를 단정하지 않는다.** 판정이 `isSymbolicLink()` 에서 "디렉터리가 아닌 것
    // 전부"로 넓어져 일반 파일·FIFO·깨진 링크도 이 행에 들어온다. 아래 install 행과 같은 어휘다.
    if (baseline.updateMode.skillsSkippedLinks.length > 0) {
      log(
        assetRow(
          "skip",
          ".claude/skills owned by another tool",
          `${baseline.updateMode.skillsSkippedLinks.join(", ")} · 그 자리가 우리 디렉터리가 아니라 갱신하지 않았다`,
        ),
      );
    }
    // #597 — 링크라 갱신하지 않은 CLI 중립 헬퍼. 링크 너머는 프로젝트 밖일 수 있어 쓰지 않는다.
    if (baseline.updateMode.helpersKept?.length) {
      log(
        assetRow(
          "skip",
          "helper is a link",
          `${baseline.updateMode.helpersKept.join(", ")} · 링크라 갱신하지 않고 남겼다`,
        ),
      );
    }
    // #678 — 실체가 프로젝트 밖이라 쓰지 않은 자리. install · uninstall 과 같은 판정 · 같은 줄.
    for (const row of outsideLinkRows(baseline.updateMode.outsideLinks ?? [])) log(row);
    // #343 — 외부 CLI 산출물(`.agents/skills/<id>` 등)에서 같은 이유로 건너뛴 자리.
    // `.claude/skills linked` 와 나눠 내는 이유는 자리가 달라서다 — 옮겨야 할 경로를 그대로 낸다.
    if (baseline.updateMode.foreignOwned.length > 0) {
      log(
        assetRow(
          "skip",
          "owned by another tool",
          `${baseline.updateMode.foreignOwned.join(", ")} · 그 자리가 우리 것이 아니라 건드리지 않았다`,
        ),
      );
    }
    // 2026-08-16 (ADR-072) — `.mcp-allowlist` 은퇴. 이 줄이 없으면 사용자는 자기 저장소에서
    // 파일 하나가 사라진 것만 보고 이유를 못 찾는다. 백업 경로를 함께 내는 이유는 그게
    // "되돌릴 수 있다"의 유일한 증거이기 때문이다 — 경로 없이 "백업했다"는 안내는 검증 불가다.
    if (baseline.updateMode.mcpAllowlistRetired) {
      log(
        assetRow(
          "skip",
          ".mcp-allowlist",
          `retired · the hook that read it is gone — backed up as ${shortenPath(baseline.updateMode.mcpAllowlistRetired)}`,
        ),
      );
    }
    // ADR-089 (#445) — 은퇴한 에이전트. 스킬 은퇴 행(아래)과 같은 규율이다: 지우지 않고
    // **지워도 된다는 사실과 대신 쓸 것**을 말한다. 대안을 함께 적는 이유는 은퇴가 곧 기능
    // 상실로 읽히면 사용자가 파일을 붙들기 때문이다 — 여기서는 벤더 기본 기능이 대안이다.
    for (const id of baseline.updateMode.retiredAgents) {
      const instead = RETIRED_AGENTS.find((a) => a.id === id)?.instead;
      log(
        assetRow(
          "skip",
          "agents",
          `${id} · 이 릴리즈에서 은퇴 — .claude/agents/${id}.md 를 지워도 된다` +
            (instead === undefined ? "" : ` · ${instead}`),
        ),
      );
    }
    // ADR-090 (#458) — 트랙에서 **강등된** 에이전트. 위 은퇴 행과 사용자가 할 일은 같고(지워도
    // 된다) 사실은 다르다 — 이건 **다른 트랙에는 여전히 가는** 자산이다. 그래서 "은퇴"라 하지
    // 않고 어느 트랙 전용인지를 말한다. 목록을 여기 적지 않으려고 배선 SSOT(`TRACK_AGENTS`)를
    // 돌면서 보고된 id 만 찍는다 — 트랙명도 그 패턴에서 그대로 derive 한다.
    for (const [id, pattern] of TRACK_AGENTS) {
      if (!baseline.updateMode.demotedAgents.includes(id)) continue;
      log(
        assetRow(
          "skip",
          "agents",
          `${id} · 이 트랙에서는 더 이상 설치하지 않는다 — ${pattern.split("|").join(" · ")} 트랙 전용 · .claude/agents/${id}.md 를 지워도 된다`,
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
    // #374 — 외부 스킬(`npx skills add` 로 깐 것)은 위 행과 **다른 자산**이다. 이 행이 없던
    // 동안 사용자는 `external CLI artifacts` 를 보고 스킬도 갱신된 줄 알았고, 실제로는 첫 설치
    // 판본이 영영 남았다. 그래서 성공·실패·판정불가가 **각자 한 줄**을 갖는다 — 셋을 같은
    // 침묵으로 합치는 것이 이 결함의 정체였다.
    if (baseline.updateMode.externalSkillsRefreshed > 0) {
      log(
        assetRow(
          "success",
          "external skills",
          `${baseline.updateMode.externalSkillsRefreshed} refreshed from upstream`,
        ),
      );
    }
    if (baseline.updateMode.externalSkillsFailed.length > 0) {
      // 실패가 여럿이면 이름만 낸다 — 사유를 전부 이어 붙이면 한 줄이 1,000자를 넘어 표
      // 정렬이 깨진다(리뷰 NIT-1). 사유는 첫 건만 대표로 싣는다: 대개 같은 원인이다.
      const failed = baseline.updateMode.externalSkillsFailed;
      const head = failed[0] as { id: string; message: string };
      const meta =
        failed.length === 1
          ? `${head.id}: ${head.message}`
          : `${failed.map((f) => f.id).join(", ")} (${failed.length}건) · 예: ${head.message}`;
      log(assetRow("skip", "external skills", `${meta} · 다음 update 에서 다시 시도한다`));
    }
    // 기록에는 있는데 카탈로그에서 사라진 자산 — "갱신했다"에 섞이면 사용자는 일부만 갱신된
    // 것을 모른다.
    //
    // ADR-088 (#426) — 한 문구로 뭉치지 않는다. 사용자가 할 일이 셋으로 갈린다: 개명된 것은
    // **새 이름으로 다시 받아야** 하고, 은퇴한 것은 **지워도 되고**, 나머지는 우리가 모른다.
    // 같은 줄로 말하면 은퇴한 스킬의 새 판을 찾아 헤맨다. 매핑은 카탈로그가 소유한다.
    if (baseline.updateMode.externalSkillsNotInCatalog.length > 0) {
      const ids = baseline.updateMode.externalSkillsNotInCatalog;
      for (const id of ids) {
        const renamedTo = RENAMED_SKILL_IDS[id];
        if (renamedTo) {
          log(
            assetRow(
              "skip",
              "skills",
              `${id} 는 ${renamedTo} 가 됐다 · ${renamedTo} 는 new-skills 묶음이 깐다 · 옛 디렉터리(.claude/skills 또는 .agents/skills)의 ${id} 는 지워도 된다`,
            ),
          );
        } else if (RETIRED_SKILL_IDS.includes(id)) {
          log(
            assetRow(
              "skip",
              "skills",
              `${id} · 이 릴리즈에서 은퇴 — 옛 디렉터리(.claude/skills 또는 .agents/skills)의 ${id} 는 지워도 된다`,
            ),
          );
        }
      }
      const unknown = ids.filter((id) => !RENAMED_SKILL_IDS[id] && !RETIRED_SKILL_IDS.includes(id));
      if (unknown.length > 0) {
        log(
          assetRow(
            "skip",
            "external skills",
            `${unknown.join(", ")} · 카탈로그에 없어 갱신 대상이 아니다`,
          ),
        );
      }
    }
    // 레거시 설치본 — "갱신할 게 없다"와 "무엇을 갱신할지 모른다"는 다른 사실이다.
    if (baseline.updateMode.externalSkillsUnknown) {
      log(
        assetRow(
          "skip",
          "external skills",
          "설치 기록이 없어 갱신 대상을 판정할 수 없다 · `agent-harness install` 로 다시 깔면 기록된다",
        ),
      );
    }
    return;
  }

  // Fresh / add / reinstall — Phase 1 rows
  // #551 PR-3 — 하네스 파일 판정의 알릴 줄. 백업한 파일마다 실제 백업 경로를 댄다(판정의 `line` 그대로).
  const judgedBackups = new Set<string>();
  for (const j of baseline.judged ?? []) {
    if (j.backupAbs !== undefined) judgedBackups.add(j.backupAbs);
    log(judgedRow(j));
  }
  // #678 — 실체가 프로젝트 밖이라 쓰지 않은 자리(링크 하나에 한 줄).
  for (const row of outsideLinkRows(baseline.outsideLinks ?? [])) log(row);
  // 외부 CLI 산출물 · 링크 본문의 백업 — 판정 줄이 없는 쪽만(같은 백업을 두 번 말하지 않는다).
  if (baseline.backups) {
    for (const b of baseline.backups) {
      if (judgedBackups.has(b)) continue;
      log(assetRow("success", "backup", shortenPath(b)));
    }
  }
  // v26.57.1 (F2) — multi-line 구조 (header + use + files). visual hierarchy + width-safe.
  // 사용자 image 검증 (2026-05-17): 단일 라인 description 이 width 좁을 때 wrap → 들여쓰기 깨짐.
  // #603 — install 은 죽은 훅 참조를 지우지 않는다(설치자 몫일 수 있다). 한 줄로 알리기만 한다.
  if (baseline.keptHookRefs?.length) {
    log(
      infoRow(
        "HOOK",
        c.yellow(
          `settings.json 에 스크립트가 없는 훅 참조 ${baseline.keptHookRefs.length}건 — 지우지 않았다 ` +
            `(${baseline.keptHookRefs.join(", ")})`,
        ),
      ),
    );
  }
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
      // #618 — 정적 열거는 안 깔리는 룰 이름(tests·ship checklist)을 부른다. 같은 함수 주석이
      // agents 라벨에 대해 밝힌 원칙("이름을 부르면 화면이 없는 자산을 계속 부른다")을 여기 적용:
      // use-text 도 실제 설치 집합에서 조립한다.
      phase1Row("rules", cats.rules.length, cats.rules.join(" · "), cats.rules);
    }
    if (cats.agents.length > 0) {
      // ADR-090 (#452) — 라벨을 자산 중립으로. 은퇴·강등으로 목록이 트랙마다 달라졌고, 이름을
      // 부르면 화면이 없는 자산을 계속 부른다(ADR-073 의 `/ecc:*` 와 같은 형태). 실제 이름은
      // `--verbose` 의 files 줄이 낸다.
      // #618 — 마찬가지로 실제 집합에서 조립(비즈니스 트랙에 없는 implementation lane 을
      // 이름으로 부르던 것). --verbose 의 files 줄과 같은 원천이다.
      phase1Row("agents", cats.agents.length, cats.agents.join(" · "), cats.agents);
    }
    if (cats.hooks.length > 0) {
      phase1Row("hooks", cats.hooks.length, "session-start · protect-files", cats.hooks);
    }
    // 2026-08-16 (ADR-073) — 라벨에서 `/ecc:*` 를 뺐다. 명령 템플릿이 하나도 남지 않아 이 행은
    // 지금 뜨지 않지만, 분류기(`.claude/commands/` 접두)는 일반형이라 명령이 다시 생기면 그대로
    // 센다. 그때 화면이 없어진 자산의 이름을 부르지 않도록 라벨을 자산 중립으로 둔다.
    if (cats.commands > 0) {
      phase1Row("commands", cats.commands, "slash commands");
    }
    if (cats.skills.length > 0) {
      phase1Row(
        "skills",
        cats.skills.length,
        "bundled methodology skills (track · opt-in)",
        cats.skills,
      );
    }
  } else {
    // v0.6.0 backwards compat — categories 없는 fakeReport 등
    log(assetRow("success", "rules + hooks + commands + agents", `${baseline.filesCopied} files`));
    log(assetRow("success", "skeleton", `${baseline.dirsCopied} dirs`));
  }
  // 2026-08-16 — 사용자가 3단계에서 **체크를 푼** 트랙 자산. 위 행들은 "무엇이 깔렸는가"만
  // 말하므로, 이 줄이 없으면 해제가 실제로 먹혔는지 화면에서 확인할 길이 없다. 0건이면 안 뜬다.
  // 이름을 전부 낸다 — 건수만 찍으면 어느 것이 빠졌는지 추적할 수 없다.
  // 디스크에 남은 것은 아래 한 줄씩(ADR-099 R3) — 여기서는 실제로 빠진 것만 센다.
  const onDisk = new Set(baseline.baselineExcludedOnDisk);
  const gone = baseline.baselineExcluded.filter((t) => !onDisk.has(t));
  if (gone.length > 0) {
    const names = gone.map((t) => t.replace(/^\.claude\//, ""));
    log(assetRow("skip", "excluded by you", `${names.length} — ${names.join(", ")}`));
  }
  // ADR-099 R3 — 뺐는데 앞 설치가 놓은 것이 그대로 있다. 하네스는 빼기를 이유로 지우지 않으므로, 표시가 없으면 화면이
  // "빠졌다" 고 말하는 동안 그 룰은 계속 상주한다(체크 해제 ≠ 제거). `uninstall --only` 는 카탈로그 자산만 받는다.
  for (const row of excludedStillThereRows(baseline.excludedStillThere ?? [])) log(row);
  // #524 — 링크 자리의 공유 본문. update 와 같은 행을 쓴다(같은 자리를 명령마다 다르게 부르지 않는다).
  linkedSkillRows(log, baseline.baselineLinked ?? [], baseline.baselineLinkedNotOurs ?? []);
  // #343 — 자리가 남의 것이라 건너뛴 자산. 이 줄이 없으면 사용자는 자기가 3단계에서 고른
  // 스킬이 왜 없는지 알 방법이 없다 (설치는 성공으로 끝났으니 실패 메시지도 없다).
  // 어떻게 해야 받을 수 있는지까지 적는다 — 원인만 알려주는 안내는 다음 행동을 못 만든다.
  if (baseline.baselineForeignOwned.length > 0) {
    // 경로를 **자르지 않는다**. 목록에 `.claude/skills/<id>` 와 `.agents/skills/<id>` 가 섞이고
    // (전자는 Claude Code, 후자는 codex·antigravity 자리), 접두를 지우면 둘이 같은 것처럼 보인다.
    // 종류를 열거하지도 않는다 — 링크 말고 파일·FIFO·하드링크도 실제로 도달 가능하다.
    log(
      assetRow(
        "skip",
        "owned by another tool",
        `${baseline.baselineForeignOwned.length} — ${baseline.baselineForeignOwned.join(", ")} · 그 자리가 우리 것이 아니라 건드리지 않았다 · 하네스 판본을 받으려면 그 자리를 옮기고 재설치`,
      ),
    );
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
        rootClaudeMdMeta(baseline.rootClaudeMd, n),
        TEMPLATES_COL,
      ),
    );
  }
  // #595 — 기록 없는 옛 판 설치본의 옛 앵커. update 가 기록 있는 설치본에 내는 줄과 같은 문장이다.
  if (baseline.legacyAnchor) {
    log(assetRow("skip", baseline.legacyAnchor, LEGACY_ANCHOR_NOTE, TEMPLATES_COL));
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
  // #551 PR-3 — 함께 쓰는 파일은 판정에서 나온 줄로 말한다(하네스 몫만 썼는지 · 못 읽어 남겼는지).
  const shared = baseline.shared;
  if (shared !== undefined) {
    for (const f of shared) {
      const row = sharedFileRow(f);
      if (row !== null) log(row);
    }
  } else {
    // 판정 결과가 없는 보고(화면 픽스처) — 옛 표기
    const mcpList = baseline.mcpServers.join(", ") || "(none)";
    log(assetRow("success", ".mcp.json", mcpList, TEMPLATES_COL));
  }
  // #492 — ECC fallback hint 삭제. 폴백 사본도 `ecc-plugin` 자산도 없어져 "무엇 대신 무엇이
  //   깔렸다"고 말할 대상 자체가 없다.
  if (baseline.envFiles.envExampleCreated) {
    log(assetRow("success", ".env.example", "Supabase token guide"));
  }
  if (shared === undefined && baseline.envFiles.gitignoreEnvAdded) {
    log(assetRow("success", ".gitignore", "+ .env"));
  }
  if (shared === undefined && baseline.envFiles.gitignoreNpxSkillsAdded.length > 0) {
    log(
      assetRow(
        "success",
        ".gitignore",
        `+ ${baseline.envFiles.gitignoreNpxSkillsAdded.join(" ")} (agent CLI / harness artifacts)`,
      ),
    );
  }
  const legacy = legacyRestoredRow(baseline.legacyRestored ?? []);
  if (legacy !== null) log(legacy);
  for (const row of legacyReleasedCatalogRows(baseline.legacyReleasedCatalog ?? [])) log(row);
  for (const row of releasedRows(baseline.releasedThisRun ?? [])) log(row);
  for (const p of baseline.pendingKeyExcludes ?? []) {
    log(
      `  ${c.yellow(symbol.skip)} ${p.id} — excluded and recorded, not applied yet: this run did not touch ${p.path}. It is taken out on the next run that does (update, or install with that CLI)`,
    );
  }
  log("");
}

/**
 * 하네스 파일 한 줄 — 판정(`judge`)의 줄 그대로. 백업했으면 그 파일의 실제 백업 경로가 줄 안에 있다
 * (`<file>.backup-<time>` 자리표시를 writer 가 바꿨다).
 */
export function judgedRow(j: JudgedWrite): string {
  return j.backup !== undefined
    ? `  ${c.green(symbol.success)} backed up  ${j.path} — ${j.line}`
    : `  ${c.yellow(symbol.skip)} ${j.path} — ${j.line}`;
}

/**
 * #678 — 링크를 따라가면 프로젝트 밖이라 쓰지 않은 자리. **링크 하나에 한 줄**이다 — 폴더 링크 아래 파일이 여럿이어도
 * 설치자가 할 일(그 링크를 실파일·실폴더로 바꾸기)은 하나다. 대상 경로를 함께 댄다: 그 파일이 바이트 그대로라는 사실을
 * 설치자가 직접 확인할 자리다.
 */
export function outsideLinkRows(links: ReadonlyArray<OutsideLink>): string[] {
  const groups = new Map<string, OutsideLink[]>();
  for (const o of links) groups.set(o.link, [...(groups.get(o.link) ?? []), o]);
  const rows: string[] = [];
  for (const [link, group] of groups) {
    const first = group[0];
    if (first === undefined) continue;
    const fileLink = group.length === 1 && first.path === link;
    rows.push(
      fileLink
        ? `  ${c.yellow(symbol.skip)} ${link} — left as is: the link points outside the project (${first.linkTarget}). Not written; replace the link with a regular file to get the harness version.`
        : `  ${c.yellow(symbol.skip)} ${link}/ — left as is: the link points outside the project (${first.linkTarget}), ${group.length} file(s) not written. Replace the link with a regular folder to get the harness version.`,
    );
  }
  return rows;
}

/**
 * 함께 쓰는 파일 한 줄 — 판정(`judge`)의 줄 + 어댑터가 실제로 한 일. 없는 `.gitignore` 처럼 아무것도 안 한
 * 파일은 말하지 않는다. 못 읽은 파일은 `⊘ left <file> — could not read it (…)` 한 줄이다(#574).
 */
export function sharedFileRow(f: SharedWrite): string | null {
  if (f.line === "") return null;
  if (f.verdict === "leave+advise") return `  ${c.yellow(symbol.skip)} left  ${f.path} — ${f.line}`;
  const parts = [f.line];
  if (f.added.length > 0) parts.push(`added: ${f.added.join(", ")}`);
  if (f.kept.length > 0) parts.push(`kept yours: ${f.kept.join(", ")}`);
  if (f.restored.length > 0) parts.push(restoredKeysPart(f.restored));
  parts.push(...excludedKeyParts(f));
  const row = assetRow(f.changed ? "success" : "skip", f.path, parts.join(" · "), 28);
  // ADR-100 — 기록 폴더를 통째로 무시하던 줄을 걷었다: 그 폴더가 이제 커밋 대상이라는 것을 같은 자리에서 말한다
  if (f.path === ".gitignore" && (f.retired ?? []).includes(GITIGNORE_RECORD_DIR_LINE)) {
    return `${row}\n${assetRow("success", f.path, GITIGNORE_RECORD_DIR_NOTE, 28)}`;
  }
  return row;
}

/** ADR-100 — 옛 판이 `.gitignore` 에 더하던, 설치 기록 폴더를 통째로 무시하는 줄. */
const GITIGNORE_RECORD_DIR_LINE = ".uzys-agent-harness/";
const GITIGNORE_RECORD_DIR_NOTE =
  "now ignores only the harness's runtime files — commit .uzys-agent-harness/ so teammates get the install record";

/**
 * 리뷰 #693 NOTE-2 — 설치자가 `--without <키 id>` 로 뺀 하네스 몫을 이번에 실제로 어떻게 했는지. 걷었으면 걷었다고(고친
 * 훅 핸들러를 걷었으면 그것도), 고쳐 둬서 남겼으면 남겼다고 — 빼기가 화면 어디서도 확인되지 않는 일이 없게.
 */
export function excludedKeyParts(f: {
  removedOut: ReadonlyArray<string>;
  removedEdited: ReadonlyArray<string>;
  keptOut: ReadonlyArray<string>;
}): string[] {
  const parts: string[] = [];
  if (f.removedOut.length > 0) {
    const asked = f.removedOut.map((id) => `--without ${id}`).join(" ");
    parts.push(`removed the harness part: ${f.removedOut.join(", ")} (you asked: ${asked})`);
  }
  if (f.removedEdited.length > 0) {
    parts.push(
      `your edits to ${f.removedEdited.join(", ")} went with it (a hook entry calls a harness script — left alone it would call a script that is no longer wired)`,
    );
  }
  if (f.keptOut.length > 0) {
    parts.push(
      `left in place, no longer managed by the harness (excluded, but you edited it): ${f.keptOut.join(", ")}`,
    );
  }
  return parts;
}

/** ADR-099 R3 — 뺐는데 그대로 있는 id 한 줄씩. */
export function excludedStillThereRows(items: ReadonlyArray<ExcludedStillThere>): string[] {
  // 리뷰 #693 NOTE-1 · 설계 selection-record §3 — 두 행동(다시 관리하기 · 치우기)이 다 보여야 한다. 다시 관리하는 길은
  // `--without` 없이 install 하는 것이다(install 의 선택이 기록을 대체한다)
  return items.map((e) =>
    e.catalog
      ? `  ${c.yellow(symbol.skip)} ${e.id} — excluded, so the harness no longer updates it (still installed). To manage it again: run install (without --without ${e.id}; add --with ${e.id} if it is opt-in) · remove it: agent-harness uninstall --only ${e.id}`
      : `  ${c.yellow(symbol.skip)} ${e.id} — excluded (still on disk — an earlier install put it there; the harness does not delete it. Remove the file yourself, or run uninstall) · to manage it again: run install without --without ${e.id}`,
  );
}

/** 설계 selection-record §3 — 전에 뺐는데 이번 install 이 `--without` 을 주지 않은 id 한 줄씩. */
export function releasedRows(
  items: ReadonlyArray<{ id: string; again: boolean; tail: string }>,
): string[] {
  return items.map((r) =>
    r.again
      ? `  ${c.green("↺")} ${r.id} — dropped earlier, installed again: this install did not pass --without ${r.id}`
      : `  ${c.green("↺")} ${r.id} — no longer excluded: ${r.tail} (this install did not pass --without ${r.id})`,
  );
}

/** 설계 selection-record §2.2 규칙 2 — 옛 기록에서 마지막 install 이 다시 깐 것으로 판정해 푼 카탈로그 id. */
export function legacyReleasedCatalogRows(ids: ReadonlyArray<string>): string[] {
  return ids.map(
    (id) =>
      `  ${c.green("↺")} ${id} — released: the last install re-added it (26.162–26.163 record)`,
  );
}

/**
 * 빼는 명령의 효과 범위 — 화면의 모든 "빼려면" 안내가 이 한 문구로 말한다(설계 selection-record §3: install 의 선택은 다음
 * install 이 대체하고 update 는 지킨다). "영구히" 라 말하지 않는다 — 사실이 아니다.
 */
export const KEPT_OUT_SCOPE =
  "kept out by update; a later install without that flag brings it back";

/**
 * ADR-099 §4 — 기록에 있는데 사라져 되돌린 하네스 키. 손으로 지운 것은 빼 달라는 신호가 아니라서 되돌리고, 빼는
 * 명령(`--without <키 id>`)과 그 효과 범위를 같은 줄 끝에 흐리게 붙인다 — update 가 지키고, 다음 install 이 대체한다.
 */
export function restoredKeysPart(ids: ReadonlyArray<string>): string {
  const drop = ids.map((id) => `--without ${id}`).join(" ");
  return `was missing — restored: ${ids.join(", ")} ${c.dim(`(drop it: install … ${drop} — ${KEPT_OUT_SCOPE})`)}`;
}

/**
 * ADR-099 R2 · §4 — 기록에 있는데 파일째 사라져 되살린 CLI 산출물. 손으로 지운 것은 빼기가 아니라서 되살리고, 빼는 길(그
 * CLI 를 뺀다)을 같은 줄 끝에 흐리게 붙인다. 쓰는 CLI 를 모르면(옛 기록) 꼬리를 달지 않는다. 설치자 파일에 블록만 담아
 * 되살렸으면(`ids` — 블록 모델 `AGENTS.md`) 빼는 길은 그 키 id 의 `--without` 이다(`restoredKeysPart` 와 같은 꼬리).
 */
export function restoredFilePart(f: {
  clis: ReadonlyArray<string>;
  how?: string;
  ids?: ReadonlyArray<string>;
}): string {
  const how = f.how === undefined ? "" : ` — ${f.how}`;
  const drop =
    f.ids !== undefined && f.ids.length > 0
      ? ` ${c.dim(`(drop it: install … ${f.ids.map((id) => `--without ${id}`).join(" ")} — ${KEPT_OUT_SCOPE})`)}`
      : f.clis.length === 0
        ? ""
        : ` ${c.dim(`(drop this CLI for good: ${f.clis.map((cli) => `agent-harness uninstall --cli ${cli}`).join(" and ")})`)}`;
  return `was missing — restored${how}${drop}`;
}

/**
 * ADR-099 R5 — 옛 판(v26.162–26.163)이 "설치자가 뺐다" 로 자동 기록했던 하네스 키를 이번 실행이 실제로 되살렸으면 한 줄.
 * 되살린 것이 없으면(기록만 풀렸다) 말하지 않는다.
 */
export function legacyRestoredRow(ids: ReadonlyArray<string>): string | null {
  if (ids.length === 0) return null;
  return `  ${c.green("↺")} restored ${ids.length} harness part(s) an earlier version had marked as removed (${ids.join(", ")}) — to drop one: install … --without <id> (${KEPT_OUT_SCOPE})`;
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
 * #651 — 화면에 **실행할 명령**을 인쇄할 때의 경로 인용. POSIX sh 에서 안전한 작은따옴표
 * 이스케이프다(`my proj` → `'my proj'`, 내부 따옴표도 안전). 표시용 축약(shortenPath)을
 * 명령에 섞으면 존재하지 않는 경로(`…/seg`)가 되고, 인용이 없으면 공백 경로에서
 * `rm -rf .claude` 만 성공하고 `mv` 가 죽어 .claude 가 복원 없이 사라진다.
 */
export function shellQuotePath(p: string): string {
  return `'${p.replace(/'/g, `'\\''`)}'`;
}

/**
 * 루트 `CLAUDE.md` 행의 설명. 세 경우를 한 문구로 묶지 않는다 — 묶는 순간 거짓 보고가 된다
 * (P5 · ADR-060: 기존 사용자 파일에는 스캐폴드를 쓰지 않는다. #528: 옮겨 심은 경우가 늘었다).
 */
function rootClaudeMdMeta(
  root: { created: boolean; seededFrom?: string | null },
  trackCount: number,
): string {
  const tracks = `${trackCount} track${trackCount > 1 ? "s" : ""} noted`;
  if (!root.created) return `@import ${HARNESS_ANCHOR_FILE} (body preserved)`;
  if (root.seededFrom) {
    return `Project Context seeded from ${root.seededFrom} + @import · ${tracks} · CLI 고유 표현은 audit-harness-fit 으로 맞춘다`;
  }
  return `fill-in scaffold + @import · ${tracks}`;
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

/**
 * #600 — install 이 도중에 멈춘 뒤의 안내. 무엇이 이미 깔렸는지(최상위 자리별로 묶어) · 그것을 기록했는지 · 어떻게
 * 마저 깔거나 걷는지를 말한다. 전에는 `install failed — <원인>` 한 줄뿐이라 설치자는 반쯤 깔린 프로젝트를 하네스
 * 명령으로 정리할 수 있는지조차 알 수 없었다.
 */
export function renderInterruptedInstall(
  err: (msg: string) => void,
  e: InstallInterruptedError,
  cwd: string = process.cwd(),
): void {
  const replaced = e.backups.filter((b) => b.replaced);
  // 백업 직후 쓰기가 실패한 자리 — 원본은 그대로이고 백업은 사본일 뿐이다. "replaced" 라고 하면 거짓이다.
  const untouched = e.backups.filter((b) => !b.replaced);
  const untouchedLines = (): void => {
    if (untouched.length === 0) return;
    err("  Backed up but not replaced — the original is unchanged:");
    for (const b of untouched) err(`    ${b.original} (copy: ${b.copy})`);
  };
  if (e.written.length === 0) {
    err(
      untouched.length === 0
        ? "  Nothing was written. Fix the cause above, then run the same install again."
        : "  Nothing was installed. Fix the cause above, then run the same install again.",
    );
    untouchedLines();
    return;
  }
  const groups = new Map<string, number>();
  for (const path of e.written) {
    const slash = path.indexOf("/");
    const key = slash > 0 && !path.endsWith(")") ? path.slice(0, slash + 1) : path;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  const { path, error } = e.record;
  err(
    path !== null
      ? `  Already in place before it stopped — recorded in ${relative(cwd, path) || path}:`
      : "  Already in place before it stopped:",
  );
  for (const [key, n] of groups) {
    err(`    ${key.endsWith("/") ? `${key} (${n} file${n === 1 ? "" : "s"})` : key}`);
  }
  if (replaced.length > 0) {
    err("  Your files it replaced were backed up first:");
    for (const b of replaced) err(`    ${b.copy}`);
  }
  untouchedLines();
  if (path !== null) {
    err("  Fix the cause above, then either run the same install again to finish,");
    // 옛 설치 위에서 멈췄으면 uninstall 은 이번 몫만이 아니라 설치 전체(앞 실행분 포함)를 뺀다
    err(
      e.hadInstall
        ? "  or remove the whole harness install (earlier runs included): agent-harness uninstall"
        : "  or remove what was written: agent-harness uninstall",
    );
  } else {
    err(
      `  ${c.yellow(`Could not record them (${error ?? "unknown error"}) — uninstall will not find them.`)}`,
    );
    err(
      "  Fix the cause above, then run the same install again — files already in place are kept or backed up, never lost.",
    );
  }
}

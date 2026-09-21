/**
 * Install log — `.uzys-agent-harness/.harness-install.json`.
 *
 * v26.64.0 (ADR-020) — install 종료 시 자산 list + scope + timestamp 기록.
 * uninstall command 가 본 log 를 읽어 정확한 reverse 수행.
 *
 * 글로벌 자산 (scope=global 또는 codexOptIn) 은 log 에 안내용으로만 기록 — uninstall 시 자동 삭제 X (D16).
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { CLI_BASE_SORT_ORDER } from "./cli-targets.js";
import {
  type ExternalAsset,
  type ExternalAssetMethod,
  INTERNAL_BUNDLED_SKILL_IDS,
} from "./external-assets.js";
import type { ExternalInstallReport } from "./external-installer.js";
import { listFilesRecursive } from "./fs-ops.js";
import { type CliBase, type InstallScope, type InstallSpec, isCliBase } from "./types.js";

export const INSTALL_LOG_FILENAME = ".harness-install.json";
/**
 * v26.135.0 (#253 · ADR-050) — 설치 로그 디렉터리. **CLI 중립이라 CLI 디렉터리 밖에 둔다.**
 *
 * v26.134.1 까지는 `.claude/` 에 뒀는데, opencode/codex 단독 설치에서도 로그를 쓰려고
 * `.claude/` 를 만들어 버렸다 — 고르지 않은 CLI 의 디렉터리가 생기고, 그 안엔 로그 하나뿐이다.
 */
export const INSTALL_LOG_DIR = ".uzys-agent-harness";
/** v26.64.0 ~ v26.134.1 의 위치. 읽기 폴백 + 다음 write 때 1회 이관 대상. */
export const LEGACY_INSTALL_LOG_DIR = ".claude";
export const INSTALL_LOG_VERSION = 1;

/**
 * 로그에 실릴 수 있는 method 종류. **카탈로그의 현재 method 보다 넓다** — #492 에서 은퇴한
 * `shell-script`(ecc-prune)를 깐 설치본의 로그가 디스크에 남아 있고, uninstall/list 는 그
 * 로그를 그대로 읽는다. 여기서 빼면 옛 로그가 아래 exhaustive switch 어느 가지에도 안 걸려
 * 안내 문구가 `undefined` 가 된다.
 */
export type InstallLogMethod = ExternalAssetMethod["kind"] | "shell-script";

export interface InstallLogAsset {
  id: string;
  category: string;
  /** External asset method.kind 그대로 (+ 은퇴한 legacy kind). uninstall reverse 시 분기 기준. */
  method: InstallLogMethod;
  /** scope=global 자산은 uninstall 시 안내만 (D16 — 글로벌 자동 삭제 금지). */
  scope: InstallScope;
  /** method 별 추가 정보. plugin: marketplace + pluginId. skill: source. npm: pkg. */
  detail: Record<string, string>;
  /** installed 시점 version (detectVersion 결과, 없으면 undefined). */
  version?: string;
}

/**
 * v26.124.0 (F-1f) — install 이 `.claude/` **밖**에 만들거나 고친 프로젝트 루트 파일.
 *
 * uninstall 은 이 목록을 **안내만 하고 지우지 않는다**. `.mcp.json`/`.gitignore` 에는 사용자
 * 내용이 섞이고, `.github/workflows/` 는 설치 후 사용자 소유물이기 때문 (ci-scaffold.ts 안전
 * 계약 2 · F-1d 와 같은 방침). 기록이 없으면 안내도 없다 — 그래서 install 이 적어 둔다.
 */
export interface InstallLogRootFile {
  /** project-relative 경로 (예: `.mcp.json`, `.github/workflows/ci.yml`) */
  path: string;
  /**
   * created = 하네스가 없던 파일을 만들었다 (내용 전부 하네스 것 → 손 안 댔으면 지워도 안전).
   * modified = 이미 있던 사용자 파일에 병합/추가했다 (직접 확인이 필요하다).
   */
  change: "created" | "modified";
  /** 무엇을 했는지 — uninstall 안내에 그대로 나온다. 재설치 시 합집합으로 누적된다. */
  notes: string[];
}

/**
 * v26.126.0 (R-3a · ADR-046) — `.claude/skills/` 안 파일 하나의 **설치 시점 기준선**.
 *
 * update 는 이 해시로 "사용자가 고쳤는가"를 판정한다. 기록이 없으면 판정이 불가능하고,
 * 그때는 내용 비교로 폴백해 보수적으로 백업한다 (ADR-046 파생규칙 3).
 */
export interface InstallLogSkillFile {
  /** `.claude/skills/` 기준 상대 경로 (예: `multi-persona-review/SKILL.md`) */
  path: string;
  /** 하네스가 그 자리에 놓아둔 내용의 sha256. 지금 디스크가 이것과 다르면 = 사용자가 고쳤다. */
  sha256: string;
}

/**
 * v26.132.0 (ADR-047) — update 가 동기화하는 정책 디렉터리. **이 목록이 SSOT 다.**
 *
 * `runUpdateMode` 의 동기화 대상과 `collectPolicyHashes` 의 기준선 범위가 같은 목록에서
 * 나와야 한다. 두 곳에 따로 적으면 한쪽에만 디렉터리가 추가됐을 때 조용히 갈리고, 그러면
 * **기준선 없는 디렉터리가 생겨 그 안의 파일이 전부 "판정 불가"로 떨어진다** — 이 repo 가
 * 반복해서 당한 "열거 사본" 실패 모드다 (`no-false-ship.md` "게이트는 열거하지 말고 훑어라").
 */
export const POLICY_DIRS = [
  { dir: "rules", ext: ".md" },
  { dir: "agents", ext: ".md" },
  { dir: "commands/uzys", ext: ".md" },
  { dir: "hooks", ext: ".sh" },
] as const;

export interface InstallLog {
  /** schema version — backward compat 검출용 */
  schemaVersion: number;
  /** harness 가 install 한 시점 ISO timestamp */
  installedAt: string;
  /** 전체 install scope. 자산 per-asset scope 와 동일 (현재는 single global scope) */
  scope: InstallScope;
  /** install 시 spec 요약 (tracks/cli — uninstall reasoning 용) */
  spec: {
    tracks: ReadonlyArray<string>;
    /**
     * **마지막 설치가 고른 CLI**. 누적하지 않는다 — 설치 화면·`list` 의 표시용이다.
     * "지금 이 프로젝트에 무엇이 깔려 있나"는 아래 `clis` 가 답한다(#528).
     */
    cli: ReadonlyArray<string>;
    /**
     * #528 (Epic #527 정의 1) — **지금 이 프로젝트에 깔려 있는 CLI 집합**(누적).
     * install 은 더하기만 하고, 빼는 것은 `uninstall --cli <name>` 뿐이다.
     *
     * `cli` 와 나눈 이유: 그 필드는 **마지막 설치분**이라 "claude 로 깔고 나중에 opencode 를
     * 더했다"를 표현할 수 없다. 그래서 위저드에서 claude 를 풀고 opencode 를 더하면 로그가
     * `["opencode"]` 로 덮이고, 다음 update 가 새 릴리즈의 Claude 자산을 "안 골랐다"고 보고
     * 깔지 않았다(실측 2026-09-21). 파일은 그대로 남아 있는데도.
     *
     * **필드가 없는 옛 로그는 정상이다** — `installedClis` 가 그때 유도한다(`INSTALL_LOG_VERSION`
     * 을 올리지 않는 이유: 부재를 정상으로 읽는 이 파일의 기존 관행 그대로다).
     */
    clis?: ReadonlyArray<CliBase>;
    /**
     * 2026-08-16 (ADR-074) — 사용자가 위저드/`--without` 로 **해제한** 트랙 baseline 자산 id
     * (`baseline:<kind>/<name>`). 아무것도 안 뺐으면 필드 자체가 없다(기존 로그도 이 상태).
     *
     * **`update` 가 이걸 읽어야 해제가 유지된다.** 안 남기면 update 는 트랙에서 manifest 를
     * 다시 유도할 뿐이라 사용자가 뺀 룰·에이전트를 되살리고, 화면엔 *"added by this release"*
     * 라고 적는다 — 같은 릴리즈에서 방금 설치한 파일인데도. 독립 리뷰가 실측으로 잡았다.
     *
     * `tracks`·`cli` 와 같이 **누적하지 않는다**: install 은 매번 이 목록대로 다시 거르므로
     * 로그는 마지막 설치가 실제로 한 일이어야 한다. 제외 없이 다시 깔면 파일이 돌아오고,
     * 그때 기록이 남아 있으면 로그가 디스크와 다른 말을 한다.
     */
    baselineExclude?: ReadonlyArray<string>;
    /**
     * #505 — 사용자가 위저드 체크 해제 / `--without <id>` 로 뺀 **번들 스킬** id
     * (`INTERNAL_BUNDLED_SKILL_IDS` 의 id 그대로 — `baseline:` 접두 없음). 아무것도 안 뺐으면
     * 필드 자체가 없다.
     *
     * `baselineExclude` 와 **보는 목록이 다르다**: 번들 스킬은 자산 페이지에서 개별 선택되므로
     * baseline 후보가 아니고(`baseline-targets.ts` `listBaselineTargets` 주석), 해제는
     * `userOverride.forceExclude` 에만 남았다. install 은 그걸 보고 안 깔지만 `update` 는 spec 을
     * 트랙에서 다시 유도하므로 **뺀 스킬을 되돌려 깔았다**(#505) — 사용자는 update 때마다 같은
     * 디렉터리를 다시 지워야 했다.
     *
     * `baselineExclude` 와 같이 **누적하지 않는다**: 로그는 마지막 설치가 실제로 한 일이다.
     */
    skillExclude?: ReadonlyArray<string>;
  };
  /** templates 출처 — uninstall 시 templates 제거 위치 */
  templates: {
    /**
     * .claude/ project local — **claude 를 고른 설치에만** 있다 (#528).
     *
     * v26.160.1 까지는 고르지 않아도 `".claude/"` 가 적혔다. 디스크에 없는 디렉터리를 기록이
     * 있다고 말하는 셈이라, 옛 로그에서 CLI 집합을 유도할 때 **이 필드는 단서가 아니다**
     * (claude 의 단서는 `rootClaudeMd` 하나 — `installedClis`. `policyFiles`·`skillFiles` 는 옛 판이
     * claude 선택과 무관하게 훑어 적어 단서가 못 된다, BLOCKER-5).
     */
    claudeDir?: string;
    /** .codex/ project local (cli=codex 시) */
    codexDir?: string;
    /** .opencode/ project local (cli=opencode 시) */
    opencodeDir?: string;
    /**
     * project root CLAUDE.md (cli=claude 시 생성).
     * uninstall 시 sha256 이 install 시점과 동일할 때만 삭제 — 사용자가 수정했으면 보존.
     */
    rootClaudeMd?: { path: string; sha256: string };
  };
  /** external-installer 가 install 한 자산 (ok=true 만) */
  assets: ReadonlyArray<InstallLogAsset>;
  /**
   * v26.124.0 (F-1f) — `.claude/` 밖 루트 파일. 건드린 게 없으면 필드 자체가 없다
   * (v26.123.0 이하 로그도 이 상태 — 읽는 쪽은 부재를 정상으로 다뤄야 한다).
   */
  rootFiles?: ReadonlyArray<InstallLogRootFile>;
  /**
   * v26.126.0 (R-3a · ADR-046) — 스킬 파일 기준선 해시. 스킬을 안 깔았으면 필드 자체가 없다
   * (v26.125.0 이하 로그도 이 상태 — 읽는 쪽은 부재를 정상으로 다뤄야 한다).
   */
  skillFiles?: ReadonlyArray<InstallLogSkillFile>;
  /**
   * v26.132.0 (ADR-047) — 정책 파일(rules/agents/commands/hooks) 기준선 해시.
   * 경로는 `.claude/` 상대 (예: `rules/git-policy.md`).
   *
   * 두 가지를 판정한다: ⓐ 덮어쓰기 전 "사용자가 고쳤는가" ⓑ prune 시 "하네스가 깔았던 것인가".
   * ⓑ 때문에 **부재를 "전부 하네스 것"으로 읽으면 안 된다** — 기록이 없으면 소유를 주장할 수
   * 없으므로 아무것도 지우지 않는다 (v26.131.x 이하 로그가 이 상태).
   */
  policyFiles?: ReadonlyArray<InstallLogSkillFile>;
  /**
   * v26.133.0 (ADR-048) — 외부 CLI 산출물 기준선. 경로는 **projectDir 상대**
   * (`AGENTS.md` · `.codex/hooks/session-start.sh` · `.agents/skills/<id>/SKILL.md` ·
   * `opencode.json` · `.opencode/commands/<id>.md`).
   *
   * `policyFiles` 와 달리 prune 판정에는 쓰지 않는다 — 외부 CLI 쪽은 삭제 경로 자체가 없다.
   * 덮어쓰기 전 "사용자가 고쳤는가" 하나만 판정한다. codex/opencode 를 안 깔았으면 필드가
   * 없다 (v26.132.x 이하 로그도 이 상태 — 부재는 정상이고, 그때는 보수적 백업으로 떨어진다).
   */
  externalFiles?: ReadonlyArray<InstallLogSkillFile>;
}

/**
 * antigravity 의 전용 표지 — 옛 로그 유도의 단서 (#528). 이 CLI 는 `templates` 항목이 없어
 * 그 절만 봐서는 존재를 알 수 없고, `externalFiles` 에 남는 이 경로가 유일한 기록이다.
 */
const ANTIGRAVITY_RULE_FILE = ".agents/rules/uzys-harness.md";

/**
 * **지금 이 프로젝트에 깔려 있는 CLI 집합** (#528 · Epic #527 정의 1).
 *
 * `spec.clis` 가 있으면 그것이 답이다. 없으면(v26.160.1 이하로 깐 로그) **기록만으로 1회
 * 유도**한다:
 *
 *   claude      ⇐ `spec.cli` ∋ claude ∨ `templates.rootClaudeMd`
 *   codex       ⇐ `spec.cli` ∋ codex ∨ `templates.codexDir`
 *   opencode    ⇐ `spec.cli` ∋ opencode ∨ `templates.opencodeDir`
 *   antigravity ⇐ `spec.cli` ∋ antigravity ∨ `externalFiles` ∋ `.agents/rules/uzys-harness.md`
 *
 * **디스크 존재는 신호가 아니다**(ADR-096 Decision 6). 이 함수가 `projectDir` 를 받지 않는
 * 이유가 그것이다 — 한 번은 `.claude/` 의 실존을 claude 의 단서로 썼고, 그러면 하네스가 깐
 * 적 없는 **설치자 소유 `.claude/`**(Claude Code 가 권한 승인 때 만드는 `settings.local.json`
 * 하나면 생긴다)가 "깔린 CLI" 로 읽혀 `uninstall --cli claude` 가 그 트리를 통째로 지운다
 * (독립 리뷰 BLOCKER-1, 2026-09-22). 소유는 기록에서만 나온다.
 *
 * 그 자리를 대신하는 claude 의 기록은 **앵커 sha(`templates.rootClaudeMd`) 하나**다 — claude 를
 * 고른 설치에만 적히고 이후 설치에도 누적된다(`buildInstallLog` 의 templates 병합). 쓸 수 없는
 * 기록 둘: `templates.claudeDir` 는 v26.160.1 까지 고르지 않아도 적혔고, `policyFiles`·`skillFiles`
 * 는 v26.160.1 까지 claude 선택과 무관하게 **디스크의 `.claude/` 를 훑어** 적혔다 — 설치자 파일이
 * 템플릿과 같은 상대 경로(`rules/git-policy.md`)면 codex 단독 로그에도 들어 있다(독립 리뷰
 * BLOCKER-5, 컨테이너 실측). 이 판부터 두 기준선은 claude 가 깔렸을 때만 찍지만, 유도가 존재하는
 * 이유인 옛 로그에서는 그 보장이 없으므로 단서로 쓰지 않는다. 놓치는 창 = 앵커 기록이 없는
 * claude 설치본(v26.70.0 이하로 깔고 그 뒤 claude 재설치가 없는 경우) — 틀리는 방향이 안전
 * (`.claude/` 를 건드리지 않는다)이고 재설치가 `clis` 를 굳힌다.
 *
 * **읽기만으로 로그를 고치지 않는다.** 유도 결과는 다음에 로그를 다시 쓸 때(`buildInstallLog`)
 * 기록된다 — `list` 나 `update --dry-run` 같은 읽기 경로가 디스크 기록을 바꾸면, 사용자가
 * 아무것도 안 했는데 기록이 달라진다.
 *
 * @returns `CLI_BASE_SORT_ORDER` 정렬. **로그가 없으면 빈 배열** — "아무 CLI 도 없다"가 아니라
 *   "기록이 없어 말할 수 없다"이고, 그 구분은 호출부가 한다 (update 는 전부로, install 은
 *   이번 선택만으로 다룬다).
 */
export function installedClis(log: InstallLog | null): ReadonlyArray<CliBase> {
  if (log === null) return [];
  if (log.spec.clis) return sortClis(log.spec.clis);
  const found = new Set<CliBase>(log.spec.cli.filter(isCliBase));
  if (log.templates.rootClaudeMd !== undefined) found.add("claude");
  if (log.templates.codexDir !== undefined) found.add("codex");
  if (log.templates.opencodeDir !== undefined) found.add("opencode");
  if ((log.externalFiles ?? []).some((f) => f.path === ANTIGRAVITY_RULE_FILE)) {
    found.add("antigravity");
  }
  return sortClis([...found]);
}

/** 정렬은 `CLI_BASE_SORT_ORDER` 하나만 쓴다 — 로그 diff 가 순서 때문에 흔들리지 않게. */
function sortClis(clis: ReadonlyArray<CliBase>): CliBase[] {
  return [...new Set(clis)]
    .filter(isCliBase)
    .sort((a, b) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b]);
}

/**
 * external-installer 의 result 를 InstallLogAsset 으로 변환.
 * ok=false 자산은 제외 (실제 install 안 됨 → uninstall 대상 아님).
 */
export function buildAssetEntries(
  report: ExternalInstallReport | null,
  scope: InstallScope,
): InstallLogAsset[] {
  if (!report) return [];
  return report.attempted
    .filter((r) => r.ok)
    .map((r) => assetToLogEntry(r.asset, scope, r.version));
}

function assetToLogEntry(
  asset: ExternalAsset,
  scope: InstallScope,
  version: string | undefined,
): InstallLogAsset {
  const detail = methodDetail(asset.method);
  const entry: InstallLogAsset = {
    id: asset.id,
    category: asset.category,
    method: asset.method.kind,
    scope,
    detail,
  };
  if (version) entry.version = version;
  return entry;
}

function methodDetail(method: ExternalAssetMethod): Record<string, string> {
  switch (method.kind) {
    case "plugin":
      return { marketplace: method.marketplace, pluginId: method.pluginId };
    case "skill":
      return { source: method.source, ...(method.skill ? { skill: method.skill } : {}) };
    case "npm":
      return { pkg: method.pkg };
    case "npx-run":
      return { cmd: method.cmd, args: (method.args ?? []).join(" ") };
    case "internal":
      // v26.81.0 (ADR-022) — Phase 1 manifest 가 설치 주체. external 단계에선 미기록이 정상.
      return { key: method.key };
  }
}

/** #505 — 로그에 남길 해제 대상 판별용. 외부 자산 제외는 update 가 재설치하지 않아 제외한다. */
const BUNDLED_SKILL_IDS: ReadonlySet<string> = new Set(INTERNAL_BUNDLED_SKILL_IDS);

/**
 * install log 생성. `previous` 가 있으면 **누적**한다 (v26.123.0 — F-1a).
 *
 * install 은 이전에 설치한 것을 지우지 않는다. 그런데 로그는 매번 새로 만들어 덮어썼으므로,
 * 나중에 `install --with <id>` 를 한 번만 해도 1회차 자산이 기록에서 사라지고 **uninstall 이
 * 그걸 못 찾아 남긴다**. 디스크에는 남아 있는데 기록에는 없는 = 로그가 거짓이 되는 상태.
 *
 * 누적 대상은 uninstall 이 실제로 읽는 두 필드뿐이다 (`assets` · `templates`). `spec`(tracks/cli)은
 * 누적하지 않는다: `.claude/` 가 backup 으로 밀리는 설치(reinstall)에선 이전 트랙 파일이 실제로
 * 사라져 합집합이 거짓이 된다. 게다가 uninstall 은 `spec` 을 읽지 않는다 (표시용).
 *
 * `claudeDirMovedAside` = 이번 설치가 `.claude/` 를 backup 으로 rename 했는가. 그 경우
 * **`.claude/` 안에 살던 이전 자산은 실제로 사라졌으므로 누적에서 뺀다** — 안 빼면 F-1a 를
 * 반대 방향으로 재현한다(있지도 않은 걸 있다고 기록). 해당: project scope 의 `skill`
 * (`npx skills add` 가 `.claude/skills/` 에 설치) 와 legacy `shell-script`(ecc-prune →
 * `.claude/local-plugins/`). plugin/npm 은 프로젝트 밖에 살아 남으므로 유지한다.
 */
export function buildInstallLog(
  spec: InstallSpec,
  external: ExternalInstallReport | null,
  scope: InstallScope,
  rootClaudeMd?: { path: string; sha256: string } | null,
  previous?: InstallLog | null,
  claudeDirMovedAside = false,
  rootFiles: ReadonlyArray<InstallLogRootFile> = [],
): InstallLog {
  // #505 — 번들 스킬 해제는 **자산 id** 로 들어온다(`userOverride.forceExclude`). 위저드 체크
  // 해제와 `--without <id>` 가 같은 자리로 모이므로 두 진입점이 한 줄로 덮인다.
  const skillExclude = (spec.userOverride?.forceExclude ?? []).filter((id) =>
    BUNDLED_SKILL_IDS.has(id),
  );
  // #528 — `.claude/` 는 claude 를 골랐을 때만 적는다. 고르지 않아도 적던 탓에 기록이
  // 디스크에 없는 디렉터리를 있다고 말했고, uninstall 은 그 경로를 rm 하려 들었다(무해했지만
  // "templates removed: .claude/" 라고 화면에 찍혔다 — 없는 것을 지웠다는 보고다).
  const templates: InstallLog["templates"] = {
    ...(spec.cli.includes("claude") ? { claudeDir: ".claude/" } : {}),
    ...(spec.cli.includes("codex") ? { codexDir: ".codex/" } : {}),
    ...(spec.cli.includes("opencode") ? { opencodeDir: ".opencode/" } : {}),
    ...(rootClaudeMd ? { rootClaudeMd } : {}),
  };
  // #528 — CLI 집합은 **더해지기만 한다**. reinstall(`.claude/` backup rename) 에서도 누적인
  // 이유: 밀려나는 것은 `.claude/` 뿐이고 다른 CLI 의 산출물(`AGENTS.md`·`.opencode/`)은
  // 그대로 디스크에 남기 때문이다. 빼는 경로는 `uninstall --cli <name>` 하나다.
  const clis = sortClis([...installedClis(previous ?? null), ...spec.cli.filter(isCliBase)]);
  const log: InstallLog = {
    schemaVersion: INSTALL_LOG_VERSION,
    installedAt: new Date().toISOString(),
    scope,
    spec: {
      tracks: spec.tracks,
      cli: spec.cli,
      clis,
      ...(spec.baselineExclude && spec.baselineExclude.length > 0
        ? { baselineExclude: spec.baselineExclude }
        : {}),
      ...(skillExclude.length > 0 ? { skillExclude } : {}),
    },
    // 이번 설치가 만든 항목이 이기고, 이번에 안 만든 항목은 이전 값을 그대로 둔다.
    // (예: claude 로 깔고 나중에 codex 만 추가 설치해도 root CLAUDE.md 기록이 살아남는다)
    templates: { ...previous?.templates, ...templates },
    assets: mergeAssets(
      claudeDirMovedAside ? previous?.assets?.filter(survivesClaudeDirRename) : previous?.assets,
      buildAssetEntries(external, scope),
    ),
  };
  // 루트 파일은 `.claude/` 밖이라 backup rename 과 무관하게 살아남는다 → 무조건 누적.
  const mergedRootFiles = mergeRootFiles(previous?.rootFiles, rootFiles);
  if (mergedRootFiles.length > 0) log.rootFiles = mergedRootFiles;
  return log;
}

/**
 * 경로 기준 합집합. 자산과 달리 **이번 설치분이 이전 것을 덮지 않고 합친다** — `.gitignore` 에
 * 1회차는 `.env`, 2회차는 `.factory/` 를 추가하면 둘 다 디스크에 남아 있으므로 둘 다 알려야 한다.
 * `change` 는 한 번이라도 created 면 created — 하네스가 만든 파일에 나중에 병합한 것뿐이고,
 * 사용자에게는 "전부 하네스 것"이 여전히 참이다 (modified 로 낮추면 지워도 될 것을 못 지운다).
 */
function mergeRootFiles(
  previous: ReadonlyArray<InstallLogRootFile> | undefined,
  current: ReadonlyArray<InstallLogRootFile>,
): InstallLogRootFile[] {
  const byPath = new Map<string, InstallLogRootFile>();
  for (const file of [...(previous ?? []), ...current]) {
    const prior = byPath.get(file.path);
    byPath.set(
      file.path,
      prior
        ? {
            path: file.path,
            change: prior.change === "created" ? "created" : file.change,
            notes: [...new Set([...prior.notes, ...file.notes])],
          }
        : file,
    );
  }
  return [...byPath.values()];
}

/**
 * `.claude/` 가 backup 으로 밀려도 살아남는 자산인가 — 산출물이 프로젝트 `.claude/` 밖인가.
 *
 * **exhaustive switch 로 쓴다(default 없음).** method 종류가 늘면 빌드가 깨져서 이 판단을
 * 강제로 하게 만든다 — `!==` 목록이면 새 method 가 조용히 "살아남음"으로 분류되고, 그건
 * 곧 없는 걸 있다고 기록하는 것이다 (`no-false-ship` §Drift 구조 차단: 하드코딩 목록에는
 * exhaustiveness 가드 없이 머지 금지, 기본값은 면제가 아니라 검사).
 */
function survivesClaudeDirRename(asset: InstallLogAsset): boolean {
  if (asset.scope === "global") return true; // 글로벌 영역은 install 이 건드리지 않는다
  switch (asset.method) {
    case "plugin":
      return true; // `~/.claude/plugins/cache` — 프로젝트 밖
    case "npm":
      return true; // `node_modules/`
    case "skill":
      return false; // `npx skills add` project scope → `.claude/skills/`
    case "shell-script":
      return false; // legacy(#492 은퇴): ecc-prune → `.claude/local-plugins/`
    case "npx-run":
      // bmad-method 는 `--tools claude-code` 로 `.claude/` 안에 agent command 를 만든다
      // (external-assets.ts 의 cliSupportOverride 주석 + Docker 실증 realcli-workflows-2026-06-06).
      // `_bmad/` 는 루트에 남지만, `.claude/` 산출물이 사라진 이상 "그대로 설치됨"이 아니다.
      return false;
    case "internal":
      // 실제로는 로그에 실리지 않는다(external-installer 가 사전 제외). 그래도 기본값은 검사.
      return false;
  }
}

/** id 기준 합집합 — 같은 id 는 이번 설치분이 이긴다 (version/scope 가 최신). 순서는 안정적. */
function mergeAssets(
  previous: ReadonlyArray<InstallLogAsset> | undefined,
  current: ReadonlyArray<InstallLogAsset>,
): InstallLogAsset[] {
  if (!previous || previous.length === 0) return [...current];
  const currentById = new Map(current.map((a) => [a.id, a]));
  const previousIds = new Set(previous.map((a) => a.id));
  return [
    ...previous.map((a) => currentById.get(a.id) ?? a),
    ...current.filter((a) => !previousIds.has(a.id)),
  ];
}

/** install log + root CLAUDE.md 등 자산 무결성 비교용 sha256 (hex). */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * 디스크 내용이 하네스가 놓아둔 것 그대로인가 (v26.133.0 · ADR-048).
 *
 * **기록이 없으면 소유를 주장할 수 없다 → false.** 이 기본값이 뒤집히면 사용자 파일을
 * 하네스 것으로 오인해 백업 없이 밀거나 지운다.
 *
 * 판정식이 세 곳(install · update · 외부 CLI transform)에서 각자 살면 한 곳만 고쳐졌을 때
 * 조용히 갈린다 — 소유 판정은 사용자 파일 삭제 여부를 가르므로 갈리면 피해가 크다.
 * 그래서 술어는 여기 하나만 둔다 (`no-false-ship.md` §Drift 구조 차단).
 */
export function isHarnessOwned(
  baseline: ReadonlyMap<string, string>,
  key: string,
  current: string,
): boolean {
  const recorded = baseline.get(key);
  return recorded !== undefined && recorded === hashContent(current);
}

/**
 * 외부 CLI 기준선 누적 (v26.133.0 · ADR-048).
 *
 * 이번 실행이 안 건드린 산출물(예: 지난번엔 opencode 도 깔았는데 이번엔 codex 만)은 디스크에
 * 그대로 있으므로 **이전 기록을 유지한다** — 지우면 다음 실행이 판정 불가로 떨어져 멀쩡한
 * 파일을 백업한다. 대신 디스크에서 사라진 항목은 뺀다. 기준선은 이력이 아니라 현재 상태다.
 */
export function mergeExternalFiles(
  projectDir: string,
  previous: ReadonlyArray<InstallLogSkillFile> | undefined,
  current: ReadonlyArray<InstallLogSkillFile>,
): InstallLogSkillFile[] {
  const byPath = new Map<string, InstallLogSkillFile>();
  for (const file of [...(previous ?? []), ...current]) byPath.set(file.path, file);
  return [...byPath.values()].filter((f) => existsSync(join(projectDir, f.path)));
}

/**
 * `.claude/skills/` 전체를 훑어 파일별 sha256 스냅샷을 만든다 (v26.126.0 · ADR-046).
 *
 * **복사가 끝난 뒤에 호출해야 한다.** 이 값이 "하네스가 놓아둔 내용"의 기준선이 되고, 다음
 * update 는 디스크가 이것과 다른지로 사용자 편집을 판정한다. 복사 **전에** 부르면 옛 내용이
 * 기준선이 돼 다음 update 가 멀쩡한 파일을 전부 "사용자가 고쳤다"로 오판한다.
 *
 * 누적하지 않고 **매번 통째로 교체**한다 (`rootFiles` 와 반대다) — 이건 이력이 아니라 현재
 * 디스크 상태의 스냅샷이고, 지워진 파일의 해시가 남으면 그 자체로 거짓 기록이 된다.
 * 디스크 전체가 아니라 **번들에 있는 파일만** 담는다 (#477, 아래 주석).
 */
export function collectSkillHashes(
  projectDir: string,
  templatesDir: string,
): InstallLogSkillFile[] {
  const skillsDir = join(projectDir, ".claude/skills");
  // #477 — 소유 판정은 `collectPolicyHashes` 와 같이 **templates 에 그 파일이 있는가**다. 디스크에만
  // 있는 파일(사용자가 스킬 디렉터리에 둔 것)을 기준선에 넣으면 다음 update 의 prune 이 그걸
  // "하네스가 깔았던 것"으로 읽어 파일별 백업 없이 지운다 — 독립 리뷰가 install 재실행 경로에서
  // 실증했다. 이 필터가 사용자 파일의 파일별 백업을 지키는 마지막 문이다.
  return listFilesRecursive(skillsDir)
    .filter((rel) => existsSync(join(templatesDir, "skills", rel)))
    .map((rel) => ({
      path: rel,
      sha256: hashContent(readFileSync(join(skillsDir, rel), "utf8")),
    }));
}

/**
 * 정책 파일 기준선 스냅샷 (v26.132.0 · ADR-047). `collectSkillHashes` 와 같은 규율:
 * **복사가 끝난 뒤** 호출해야 이 값이 "하네스가 놓아둔 내용"의 기준선이 된다.
 *
 * 소유 판정은 **templates 에 그 파일이 있는가**로 한다. 디스크에만 있는 파일은 사용자가
 * 만든 것이므로 기준선에 넣지 않는다 — 넣으면 다음 update 의 prune 이 그걸 "하네스가 깔았던
 * 것"으로 읽고 지운다. 즉 이 필터가 사용자 파일 삭제를 막는 마지막 문이다.
 */
export function collectPolicyHashes(
  projectDir: string,
  templatesDir: string,
): InstallLogSkillFile[] {
  const out: InstallLogSkillFile[] = [];
  for (const { dir, ext } of POLICY_DIRS) {
    const targetDir = join(projectDir, ".claude", dir);
    const sourceDir = join(templatesDir, dir);
    for (const rel of listFilesRecursive(targetDir)) {
      if (!rel.endsWith(ext)) continue;
      if (!existsSync(join(sourceDir, rel))) continue; // 사용자가 만든 파일 — 소유 주장 안 함
      out.push({
        path: `${dir}/${rel}`,
        sha256: hashContent(readFileSync(join(targetDir, rel), "utf8")),
      });
    }
  }
  return out;
}

/**
 * install log write. 위치: `<projectDir>/.uzys-agent-harness/.harness-install.json`.
 *
 * 디렉터리는 write 직전에 보장한다 — 하네스 전용이라 다른 어떤 phase 도 만들지 않는다.
 *
 * v26.135.0 (#253) — 구 위치(`.claude/`)에 파일이 있으면 **여기서 이관이 끝난다**: 새 위치에
 * 쓴 뒤 구 파일을 지운다. 이관을 별도 명령이나 install 경로에만 두면, 로그를 쓰는 다른 경로
 * (`update` 의 refreshExternalCli, `uninstall --only` 의 로그 갱신)가 구 파일을 남긴 채
 * 새 파일을 만들어 **같은 프로젝트에 로그가 2벌** 남는다.
 */
export function writeInstallLog(projectDir: string, log: InstallLog): string {
  const path = installLogPath(projectDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(log, null, 2)}\n`, "utf8");
  migrateAwayLegacyLog(projectDir);
  return path;
}

/**
 * 구 위치 파일 제거. 실패해도 **install 을 죽이지 않는다** — 읽기는 새 위치가 우선이라
 * 남은 구 파일은 더 이상 아무것도 결정하지 않는다(무해한 잔재). 반대로 여기서 throw 하면
 * 정상 완료된 설치가 "실패"로 보고된다. 조용한 성공이 아니라 **의도된 비치명 처리**다.
 */
function migrateAwayLegacyLog(projectDir: string): void {
  const legacy = legacyInstallLogPath(projectDir);
  if (!existsSync(legacy)) return;
  try {
    rmSync(legacy);
  } catch {
    /* 위 주석 참조 — 새 위치가 이미 SSOT */
  }
}

/**
 * 새 위치 → 구 위치 순으로 찾는다. 구 위치 폴백이 없으면 v26.134.1 이하로 설치한 사용자의
 * `list` / `uninstall` / `update` 가 전부 "install log not found" 로 죽는다.
 */
export function readInstallLog(projectDir: string): InstallLog | null {
  const path = [installLogPath(projectDir), legacyInstallLogPath(projectDir)].find((p) =>
    existsSync(p),
  );
  if (!path) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as InstallLog;
    // v26.68.0 — backward compat: method.kind "npm-global" → "npm" rename.
    // v26.64.0 ~ v26.67.0 시점 install log 가 새 uninstall 에서 작동하도록 normalize.
    if (Array.isArray(parsed.assets)) {
      parsed.assets = parsed.assets.map((a) =>
        (a.method as string) === "npm-global" ? { ...a, method: "npm" } : a,
      );
    }
    return parsed;
  } catch {
    return null;
  }
}

export function installLogPath(projectDir: string): string {
  return join(projectDir, INSTALL_LOG_DIR, INSTALL_LOG_FILENAME);
}

/** v26.134.1 이하가 쓰던 위치. 읽기 폴백과 이관에만 쓴다 — 새로 쓰는 곳은 없다. */
export function legacyInstallLogPath(projectDir: string): string {
  return join(projectDir, LEGACY_INSTALL_LOG_DIR, INSTALL_LOG_FILENAME);
}

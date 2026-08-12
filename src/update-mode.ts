/**
 * update-mode.ts — Update / Add / Reinstall router 액션 처리.
 *
 * SPEC: docs/specs/cli-rewrite-completeness.md F5, F6
 * Source: bash setup-harness.sh@911c246~1 L460~573 (update mode 113 LOC)
 *
 * Update 모드 동작:
 *   1. backup: .claude/ → .claude.backup-<timestamp>/
 *   2. update_dir: target에 이미 존재하는 파일만 templates로 덮어쓰기 (Track 혼입 방지)
 *   3. prune_orphans: templates에 없는데 target에 있는 파일 제거 (예: 폐기된 rule)
 *   4. clean_stale_hook_refs: settings.json hook 참조 중 실존 파일 없는 것 제거
 *
 * 보존: .mcp.json (사용자 추가 항목), docs/SPEC.md, settings.local.json
 */

import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { ALL_CLI_TARGETS, runCliTransforms } from "./cli-transforms.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
import { backupFile, listFilesRecursive } from "./fs-ops.js";
import {
  collectPolicyHashes,
  collectSkillHashes,
  hashContent,
  type InstallLog,
  isHarnessOwned as isOwnedByBaseline,
  mergeExternalFiles,
  POLICY_DIRS,
  readInstallLog,
  writeInstallLog,
} from "./install-log.js";
import { ALL_RULES, type AssetEntry, type AssetSpec, buildManifest } from "./manifest.js";
import { HARNESS_ANCHOR_FILE, upsertHarnessImport } from "./project-claude-merge.js";
import { DEFAULT_OPTIONS, type InstallSpec, TRACKS, type Track } from "./types.js";

/**
 * v26.140.0 **이전** 설치본의 앵커 위치 (P5 · ADR-060 이행 대상).
 *
 * 이행 안내에만 쓴다 — 하네스는 더 이상 이 경로에 아무것도 쓰지 않는다.
 */
const LEGACY_ANCHOR_FILE = ".claude/CLAUDE.md";

export interface UpdateModeReport {
  /** 덮어쓰기된 파일 갯수 (디렉토리별). */
  updated: Record<string, number>;
  /** 제거된 orphan 파일명 목록 (디렉토리별). */
  pruned: Record<string, string[]>;
  /** 제거된 stale hook ref 파일명 목록. */
  staleHookRefs: string[];
  /** 갱신된 CLAUDE.md (true if updated). */
  claudeMdUpdated: boolean;
  /**
   * P5 · ADR-060 이행 — 루트 앵커가 **없어서 이번에 만들었다** (v26.140.0 이전 설치본).
   *
   * `claudeMdUpdated` 와 배타적이다: 갱신은 이미 있던 파일, 생성은 이번에 생긴 파일.
   */
  anchorCreated: boolean;
  /** 이행 중 루트 `CLAUDE.md` 에 앵커 import 줄을 새로 얹었나 (이미 있었으면 false). */
  rootImportAdded: boolean;
  /**
   * 디스크에 아직 남아 있는 구 앵커 경로(`.claude/CLAUDE.md`). 없으면 null.
   *
   * **지우지 않는다** — 사용자가 그 파일을 고쳤는지 update 시점엔 판정할 수 없다. 대신 화면에
   * "이제 갱신되지 않는다"를 알린다. 침묵하면 옛 하네스 내용이 담긴 사본이 계속 상주하는데
   * 사용자는 그게 죽은 사본인 줄 모른다.
   */
  legacyAnchor: string | null;
  /**
   * v26.126.0 (R-3a) — 사용자가 고쳐서 백업본을 남긴 스킬 파일 (`.claude/skills/` 상대경로).
   * 화면에 그대로 노출한다. 안 보이면 사용자는 자기 편집분이 어디 갔는지 알 수 없다.
   */
  skillsBackedUp: string[];
  /**
   * 2026-08-02 (ADR-062) — `.claude/skills/<id>` 가 심볼릭 링크라 건너뛴 스킬 id.
   * 그 자리는 `npx skills add` 등 **다른 도구가 소유**하므로 하네스가 쓰지 않는다.
   * 화면에 남기는 이유는 위와 같다 — 안 보이면 사용자는 "왜 이 스킬만 안 갱신되지"를 알 수 없다.
   */
  skillsSkippedLinks: string[];
  /**
   * v26.132.0 (ADR-047) — 사용자가 고쳐서 백업본을 남긴 정책 파일 (`.claude/` 상대경로).
   * `skillsBackedUp` 과 같은 이유로 화면에 노출한다 — 안 보이면 사용자는 자기 편집분이
   * 어디 갔는지 알 수 없고, 그러면 백업은 있어도 없는 것과 같다.
   */
  policyBackedUp: string[];
  /**
   * v26.134.0 (R-3j-A · ADR-049) — 갱신된 외부 CLI 산출물 수
   * (`.codex/` · `.opencode/` · `.agents/` · `AGENTS.md` · `opencode.json`).
   *
   * 그전까지 update 는 `.claude/` 만 갱신했다. codex/opencode 사용자는 install 이 개선한 룰을
   * `update` 로는 영영 못 받았고, 그 비대칭이 **문서 어디에도 안 적혀 있었다**.
   */
  externalUpdated: number;
  /** 사용자가 고쳐서 백업본을 남긴 외부 CLI 산출물 (projectDir 상대경로). */
  externalBackedUp: string[];
  /**
   * 이번 update 가 **새로 깔아 준** 자산 (projectDir 상대경로) — #283.
   *
   * 갱신(`updated`)과 배타적이다: 갱신은 이미 있던 파일, 이쪽은 릴리즈로 새로 생겨서
   * 이 설치본에 아직 없던 파일이다. 화면에 남기는 이유는 `anchorCreated` 와 같다 — 조용히
   * 늘어난 파일은 사용자가 자기 것으로 오인한다.
   */
  installedNew: string[];
  /**
   * **전에 깔아 줬는데 디스크에 없어서 다시 깐** 자산 (projectDir 상대경로).
   *
   * `installedNew` 와 가르는 이유는 원인이 다르기 때문이다 — 이쪽은 사용자가 지웠거나 유실된
   * 것이다. 둘을 한 문구("이번 릴리즈에 추가됨")로 보고하면 한쪽에는 거짓이 되고, 자기가 지운
   * 파일이 왜 돌아왔는지 추적할 수 없다. 판별 신호는 install log 의 `policyFiles` 기준선이다.
   */
  restored: string[];
  /**
   * 이 릴리즈에 새로 생겼지만 **update 가 깔 수 없는** 자산 (projectDir 상대경로).
   *
   * 훅과 `settings.json` 이 그쪽이다 — 훅은 `settings.json` 의 배선이 있어야 발화하는데 update 는
   * 그 파일을 동기화하지 않는다(죽은 참조를 지울 뿐이다). 파일만 놓고 "추가됨"이라 보고하면
   * 안 도는 기능을 받았다고 읽히므로(거짓출하), 깔지 않고 **재설치가 필요하다는 사실을 낸다.**
   */
  needsReinstall: string[];
}

/**
 * Update 진입점이 쓰는 InstallSpec — **위저드와 `update` 명령이 공유한다.**
 *
 * update 는 `.claude/` 만 건드리므로 spec 에서 실제로 소비되는 건 `projectDir` 와
 * (보고용) `tracks` 뿐이다. `cli`/`options` 는 타입을 채우기 위한 값이라 어느 진입점이든
 * 같아야 하고, 두 곳에서 각자 리터럴로 쓰면 한쪽만 바뀌었을 때 조용히 갈린다 — 이 repo 가
 * 반복해서 당한 실패 모드라 처음부터 한 곳에 둔다.
 */
export function buildUpdateSpec(projectDir: string, tracks: ReadonlyArray<Track>): InstallSpec {
  return {
    tracks: [...tracks],
    options: DEFAULT_OPTIONS,
    cli: ["claude"],
    projectDir,
  };
}

/**
 * Update mode 메인 — backup은 caller가 별도 처리.
 *
 * @param projectDir 대상 프로젝트 root
 * @param templatesDir templates/ 디렉토리 (sync source)
 * @param harnessRoot harness repo root — 외부 CLI transform 의 렌더 소스.
 *
 *   `templatesDir` 에서 파생시킬 수도 있지만 **required 인자로 받는다**: 옵셔널이면 안 넘긴
 *   호출부만 조용히 외부 CLI 갱신을 건너뛰고, 그건 지금 고치고 있는 바로 그 버그다
 *   (ADR-048 의 `baseline` 을 required 로 둔 것과 같은 이유).
 */
export function runUpdateMode(
  projectDir: string,
  templatesDir: string,
  harnessRoot: string,
): UpdateModeReport {
  const claudeDir = join(projectDir, ".claude");
  const report: UpdateModeReport = {
    updated: {},
    pruned: {},
    staleHookRefs: [],
    claudeMdUpdated: false,
    anchorCreated: false,
    rootImportAdded: false,
    legacyAnchor: null,
    skillsBackedUp: [],
    skillsSkippedLinks: [],
    policyBackedUp: [],
    externalUpdated: 0,
    externalBackedUp: [],
    installedNew: [],
    restored: [],
    needsReinstall: [],
  };

  // 0) 릴리즈로 **새로 생긴** 자산 설치 (#283). 정책 동기화보다 먼저 도는 이유는
  // `refreshPolicyBaseline` 이 아래에서 기준선을 다시 찍기 때문이다 — 순서를 뒤집으면 방금 깐
  // 파일이 기준선에 없어 다음 update 가 "사용자가 만든 파일"로 오판한다.
  const fresh = installNewAssets(projectDir, templatesDir);
  report.installedNew = fresh.installed;
  report.restored = fresh.restored;
  report.needsReinstall = fresh.needsReinstall;

  // 1) 정책 디렉터리 동기화 — 대상 목록은 POLICY_DIRS 가 SSOT (install-log.ts).
  // v26.132.0 (ADR-047) — 사용자 편집분 판정이 붙었다. 기준선은 install log 의 policyFiles.
  const policyBase = policyBaseline(projectDir);
  for (const { dir, ext } of POLICY_DIRS) {
    const target = join(claudeDir, dir);
    const source = join(templatesDir, dir);
    const label = `.claude/${dir}`;
    const ctx = { prefix: dir, baseline: policyBase };
    const synced = updateDir(target, source, ext, ctx);
    report.updated[label] = synced.updated;
    report.policyBackedUp.push(...synced.backedUp);
    report.pruned[label] = pruneOrphans(target, source, ext, ctx);
  }
  refreshPolicyBaseline(projectDir, templatesDir);

  // 1.5) `.claude/skills/` — v26.126.0 (R-3a · ADR-046).
  // 위 4개와 달리 스킬은 디렉터리 단위라 재귀가 필요하고, 사용자 편집분 판정이 붙는다.
  const skillSync = syncSkills(
    join(claudeDir, "skills"),
    join(templatesDir, "skills"),
    skillBaseline(projectDir),
  );
  report.updated[".claude/skills"] = skillSync.updated;
  report.skillsBackedUp = skillSync.backedUp;
  report.skillsSkippedLinks = skillSync.skippedLinks;
  refreshSkillBaseline(projectDir);

  // 2) 하네스 앵커 (프로젝트 루트 `CLAUDE-uzys-harness.md` — P5 · ADR-060).
  //
  //    **claude 를 고른 설치에서만** 돈다. 앵커 파일과 루트 `CLAUDE.md` 의 `@import` 한 줄은
  //    Claude Code 전용 로딩 경로이고, 다른 CLI 사용자는 같은 내용을 `AGENTS.md` ·
  //    `.agents/rules/` 로 이미 받는다 — 만들면 중복이고, 루트 `CLAUDE.md` 는 **사용자 소유
  //    이름**이라 고른 적 없는 CLI 때문에 사용자 파일이 수정된다. install 은 이 조건을 이미
  //    지키는데(`.claude/` baseline 게이트) update 만 무조건 돌고 있었다 — 비 Claude 단독
  //    설치가 update 에 도달할 수 있게 되면서 드러난 비대칭이다(독립 재검증 HIGH-1).
  //
  //    증거는 **둘을 함께** 본다. `.claude/` 존재만으로 판정하면 비 Claude 설치에 어떤 이유로든
  //    `.claude/` 가 있을 때 같은 증상이 돌아오고(사용자가 만든 디렉터리 · 이전 설치의 잔재),
  //    install log 만으로 판정하면 **로그가 없는 레거시 설치본**이 claude 미설치로 오판돼 앵커
  //    이행 자체가 죽는다(그 이행이 이 함수의 원래 목적이다 — 로그 단독 판정은 update-mode
  //    테스트 6건이 red 로 잡았다). 그래서 디렉터리가 있고, **로그가 claude 를 말하거나 로그가
  //    아예 없을 때**만 돈다. 로그가 있는데 claude 가 없다 = 명시적으로 안 고른 것이다.
  const installLog = readInstallLog(projectDir);
  if (existsSync(claudeDir) && (installLog === null || installLog.spec.cli.includes("claude"))) {
    syncHarnessAnchor(projectDir, templatesDir, report);
  }

  // 3) settings.json stale hook ref cleanup
  const settingsPath = join(claudeDir, "settings.json");
  if (existsSync(settingsPath)) {
    report.staleHookRefs = cleanStaleHookRefs(settingsPath, claudeDir);
  }

  // 4) 외부 CLI 산출물 — v26.134.0 (R-3j-A · ADR-049).
  // install 과 **같은 함수**를 refresh 모드로 부른다. 여기서 transform 을 따로 부르면
  // 기준선을 잇는 규칙이 두 벌이 되고, 그게 ADR-046~048 을 세 번 반복하게 만든 구조다.
  const external = refreshExternalCli(projectDir, harnessRoot);
  report.externalUpdated = external.externalUpdated;
  report.externalBackedUp = external.externalBackedUp;

  return report;
}

/**
 * 릴리즈로 **새로 생긴** 자산을 설치한다 (#283).
 *
 * update 의 기본 규율은 "이미 있는 것만 갱신"이고(`updateDir` Track 혼입 방지), 그 규율에는
 * 반대편 구멍이 있었다: 릴리즈가 자산을 **추가하면** 기존 설치본은 update 를 몇 번 돌려도 그
 * 파일을 영영 못 받는다. 실제로 `.uzys-agent-harness/` 의 두 스크립트가 그 자리였고, 배포판
 * 룰(`ship-checklist`·`doc-governance`)이 그 경로를 호출하라고 적는 동안 파일은 없었다 —
 * 훅·에이전트·룰도 같은 경로로 새로 추가되므로 증상은 스크립트에만 있는 것이 아니다.
 *
 * **무엇을 깔지는 manifest 가 SSOT** 다. 여기에 파일 목록을 적으면 그게 두 번째 사본이 되어
 * 다음에 추가되는 자산이 똑같이 빠진다 (이 repo 가 반복해서 당한 열거-사본 실패 모드).
 *
 * **이미 있는 파일은 건드리지 않는다** — 갱신은 `updateDir`·`syncSkills` 의 몫이고 그쪽은
 * 사용자 편집분 판정과 백업을 한다. 여기서 덮어쓰면 그 판정을 우회하게 된다.
 *
 * **`.claude/` 는 claude 를 고른 설치본에만 넣는다.** install 은 `spec.cli` 에 claude 가 있을 때만
 * 그 baseline 을 만든다(`installer.ts` — codex/opencode 단독 사용자의 dead weight 회피). update 에
 * 그 술어가 없으면 codex 전용 설치본에 `.claude/` 하네스가 통째로 들어가고, 그중 `settings.json`
 * 은 훅 배선과 외부 실행까지 딸려 온다 — 고른 적 없는 CLI 의 설정이다.
 *
 * **훅과 settings.json 은 대상이 아니다.** 훅은 파일만으로는 안 돈다: `settings.json` 의 배선이
 * 있어야 발화하는데 update 는 그 파일을 동기화하지 않는다(`cleanStaleHookRefs` 로 죽은 참조를
 * 지울 뿐이다). 깔아 놓고 "추가됨"이라 보고하면 사용자는 안 도는 기능을 받았다고 읽는다 —
 * `hook-wiring-parity` 가 templates 쪽에서 막는 바로 그 상태를 update 가 만드는 셈이다.
 * 대신 **재설치가 필요하다고 알린다**(`needsReinstall`).
 */
function installNewAssets(
  projectDir: string,
  templatesDir: string,
): { installed: string[]; restored: string[]; needsReinstall: string[] } {
  const installed: string[] = [];
  const restored: string[] = [];
  const needsReinstall: string[] = [];
  // 기록이 없으면 `.claude/` 를 건드리지 않는다 — 고르지 않은 CLI 의 자산을 들이는 쪽이
  // 안 깔아 주는 쪽보다 비싸다. CLI 중립 자산(`.uzys-agent-harness/`)은 그대로 대상이다.
  const claudeSelected = readInstallLog(projectDir)?.spec.cli.includes("claude") ?? false;
  // 전에 깔아 준 적이 있는가 — "이번 릴리즈 신규"와 "사용자가 지운 것"을 가르는 유일한 신호다.
  // 디스크만 보면 둘이 같아 보이고, 그 둘을 한 문구로 보고하면 한쪽에는 거짓말이 된다.
  const priorBaseline = policyBaseline(projectDir);

  for (const entry of trackOnlyFileAssets(installedTracks(projectDir))) {
    // 하네스 앵커는 제외 — `syncHarnessAnchor` 가 **이행 로직과 함께** 소유한다. 여기서 먼저
    // 만들면 그쪽이 "이미 있었다"로 보고 루트 `CLAUDE.md` 의 import 줄을 얹지 않아, ADR-060
    // 이행이 조용히 반쪽이 된다.
    if (entry.target === HARNESS_ANCHOR_FILE) continue;

    const target = join(projectDir, entry.target);
    if (existsSync(target)) continue;
    const source = join(templatesDir, entry.source);
    if (!existsSync(source)) continue;

    if (entry.target.startsWith(".claude/")) {
      if (!claudeSelected) continue;
      // 배선이 있어야 사는 자산 — 파일만 놓으면 침묵하는 거짓 설치가 된다.
      if (entry.target.startsWith(".claude/hooks/") || entry.target === ".claude/settings.json") {
        needsReinstall.push(entry.target);
        continue;
      }
    }

    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
    // `policyFiles` 키는 `.claude/` 상대다 (`rules/git-policy.md`).
    const recordedAs = entry.target.startsWith(".claude/") ? entry.target.slice(8) : entry.target;
    if (priorBaseline.has(recordedAs)) restored.push(entry.target);
    else installed.push(entry.target);
  }
  return { installed, restored, needsReinstall };
}

/**
 * opt-in 선택과 무관하게 이 트랙 구성이 받아야 하는 **파일** 자산.
 *
 * update 는 사용자가 어떤 opt-in 을 골랐는지 모른다 — install log 의 spec 은 tracks·cli 뿐이다.
 * 그래서 opt-in 축을 **양극단으로 평가해 교집합**을 취한다: 어느 쪽에서도 설치 대상이면 선택과
 * 무관한 자산이고, 한쪽에서만 대상이면 선택에 달린 자산이라 update 가 임의로 들일 수 없다
 * (plugin 을 켠 사용자에게 ECC fallback 에이전트를 깔면 그게 곧 원치 않는 자산이다).
 * 축 이름을 열거하지 않는 이유는 늘 같다 — 열거는 곧 두 번째 사본이고, 다음에 늘어나는 축이
 * 여기서 빠진다.
 *
 * `type: "dir"` 은 제외한다. 그쪽은 스킬 디렉터리이고 설치 여부를 `selectedInternalSkills` 가
 * 가르는데 update 는 그 선택을 복원할 수 없다 (`syncSkills` 가 "이미 깔린 것만" 다루는 것과
 * 같은 이유).
 *
 * 트랙 기록이 없으면 빈 배열이 들어와 `applies: all` 자산만 남는다 — 모르는 트랙의 자산을
 * 들이지 않으면서 전 트랙 공통분은 복구된다.
 */
function trackOnlyFileAssets(tracks: ReadonlyArray<Track>): AssetEntry[] {
  const base = { tracks, selectedInternalSkills: [] as ReadonlyArray<string> };
  const optedOut: AssetSpec = { ...base, withEcc: false, withTauri: false };
  const optedIn: AssetSpec = { ...base, withEcc: true, withTauri: true };
  // `buildManifest` 는 목록만 만들고 게이팅은 하지 않는다 — 거르는 것은 각 엔트리의 `applies`
  // 술어이고, 그건 호출자가 평가한다 (`installer.ts` 의 manifest 루프와 같은 계약).
  return buildManifest(optedOut).filter(
    (e) => e.type === "file" && e.applies(optedOut) && e.applies(optedIn),
  );
}

/**
 * 하네스 앵커 동기화 + 레거시 설치본 이행 (P5 · ADR-060).
 *
 * 루트 `CLAUDE.md` 는 **덮어쓰지 않는다** — 그건 사용자 소유이고 우리 몫은 그 안의 import 한
 * 줄뿐이다. 갱신 대상은 하네스가 통째로 소유한 앵커 파일이다.
 *
 * | 루트 앵커 | 처리 |
 * |---|---|
 * | 있다 | 템플릿으로 갱신 (`claudeMdUpdated`) |
 * | 없다 | **만들고** 루트 CLAUDE.md 에 import 를 얹는다 (`anchorCreated` · `rootImportAdded`) |
 *
 * 아랫줄이 이번에 생겼다. v26.140.0 이전 설치본의 앵커는 `.claude/CLAUDE.md` 라 루트엔 아무것도
 * 없고, "있을 때만 갱신"으로 두면 그 사용자는 update 를 몇 번을 돌려도 ⓐ 새 앵커가 안 생기고
 * ⓑ import 줄도 안 붙고 ⓒ 구 앵커가 옛 내용 그대로 굳는데 **화면엔 아무 말도 안 뜬다**.
 * ADR-060 「적용 범위」가 단언한 이행이 코드에 없던 자리다.
 */
function syncHarnessAnchor(
  projectDir: string,
  templatesDir: string,
  report: UpdateModeReport,
): void {
  // 구 앵커는 **지우지 않고 알린다** — 사용자가 고쳤는지 판정할 근거가 update 에는 없다.
  // 이행이 끝난 뒤에도 파일이 남아 있는 한 계속 알린다 (지워야 없어지는 안내).
  if (existsSync(join(projectDir, LEGACY_ANCHOR_FILE))) {
    report.legacyAnchor = LEGACY_ANCHOR_FILE;
  }

  const templateMd = join(templatesDir, "CLAUDE.md");
  if (!existsSync(templateMd)) return;

  const anchor = join(projectDir, HARNESS_ANCHOR_FILE);
  const existed = existsSync(anchor);
  copyFileSync(templateMd, anchor);
  if (existed) {
    report.claudeMdUpdated = true;
    return;
  }

  report.anchorCreated = true;
  report.rootImportAdded = upsertRootImport(projectDir);
  // 이번에 만든 앵커는 install log 에 남긴다 — uninstall 이 회수를 주장하는 근거가 그 기록
  // 하나뿐이라(`commands/uninstall.ts` templates.rootClaudeMd), 빼면 아무도 못 지우는 파일을
  // 새로 만들어 놓는 셈이 된다. 로그가 없으면 만들지 않는다 (설치 기록 날조 금지 — 다른
  // 기준선 갱신과 같은 방침).
  recordAnchorBaseline(projectDir, anchor);
}

/**
 * 루트 `CLAUDE.md` 에 앵커 import 를 얹는다 — install 과 **같은 함수·같은 계약**
 * (`installer.ts` writeRootClaudeMd). 파일이 없으면 fill-in 스캐폴드로 만든다.
 *
 * @returns 실제로 파일을 고쳤으면 true. 이미 import 가 살아 있으면 upsert 가 입력을 그대로
 *   돌려주고, 그때는 파일을 만지지 않는다.
 */
function upsertRootImport(projectDir: string): boolean {
  const target = join(projectDir, "CLAUDE.md");
  const existing = existsSync(target) ? readFileSync(target, "utf8") : null;
  const next = upsertHarnessImport(existing, {
    projectName: basename(projectDir),
    tracks: installedTracks(projectDir),
  });
  if (next === existing) return false;
  writeFileSync(target, next);
  return true;
}

/**
 * 스캐폴드가 적는 "Active track(s)" — **설치 기록이 SSOT** 다. update 는 트랙을 인자로 받지
 * 않으므로 여기서 따로 추론하면 그 추론이 두 번째 사본이 된다. 기록이 없거나 지금 어휘에 없는
 * 트랙이면 빼고 쓴다 — 모르는 것을 지어내지 않는다.
 */
function installedTracks(projectDir: string): ReadonlyArray<Track> {
  const recorded = readInstallLog(projectDir)?.spec.tracks ?? [];
  return recorded.filter((t): t is Track => (TRACKS as ReadonlyArray<string>).includes(t));
}

/** 이행으로 만든 앵커의 설치 시점 sha 를 install log 에 기록 (uninstall 회수 근거). */
function recordAnchorBaseline(projectDir: string, anchor: string): void {
  const log = readInstallLog(projectDir);
  if (!log) return;
  const next: InstallLog = {
    ...log,
    templates: {
      ...log.templates,
      rootClaudeMd: {
        path: HARNESS_ANCHOR_FILE,
        sha256: hashContent(readFileSync(anchor, "utf8")),
      },
    },
  };
  try {
    writeInstallLog(projectDir, next);
  } catch {
    // 기록 실패가 update 자체를 실패시키지는 않는다 (D16 과 같은 방침).
  }
}

/**
 * 외부 CLI 산출물 갱신 + 기준선 재기록 (v26.134.0 · ADR-049).
 *
 * **어느 CLI 가 설치돼 있는지 판정하지 않는다.** `refreshOnly` 가 "디스크에 이미 있는 파일만"
 * 으로 걸러 주므로, 안 깐 CLI 는 대상 파일이 없어 자연히 아무것도 안 쓴다. 선택 스킬도 같다 —
 * 전체 목록을 넘겨도 안 깔린 스킬은 파일이 없어 건너뛴다. 그래서 update 쪽에 CLI 목록이나
 * 스킬 선택 상태의 **사본이 생기지 않는다** (이 repo 가 반복해서 당한 열거-사본 실패 모드).
 */
function refreshExternalCli(
  projectDir: string,
  harnessRoot: string,
): { externalUpdated: number; externalBackedUp: string[] } {
  const log = readInstallLog(projectDir);
  const result = runCliTransforms({
    harnessRoot,
    projectDir,
    cli: ALL_CLI_TARGETS,
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS,
    // 스킬과 같은 이유로 **전부** 넘긴다 — 안 깔린 룰은 대상 파일이 없어 refreshOnly 가 건너뛴다.
    rules: ALL_RULES,
    previousExternal: log?.externalFiles ?? [],
    refreshOnly: true,
  });

  // 기준선 재기록 — `refreshPolicyBaseline` 과 같은 이유로 필수다. 빼면 다음 update 가 방금
  // 자기가 덮어쓴 파일을 "사용자가 고쳤다"로 오판해 백업을 매번 쌓는다.
  // 이번에 안 건드린 산출물의 기록은 `mergeExternalFiles` 가 유지한다 (지우면 그 파일들이
  // 다음 실행에서 판정 불가로 떨어진다). 로그가 없으면 만들지 않는다 — 설치 기록 날조 금지.
  if (log) {
    const merged = mergeExternalFiles(projectDir, log.externalFiles, result.externalFiles);
    const next: InstallLog = { ...log };
    if (merged.length > 0) next.externalFiles = merged;
    else delete next.externalFiles;
    try {
      writeInstallLog(projectDir, next);
    } catch {
      // 기록 실패가 update 자체를 실패시키지는 않는다 (D16 과 같은 방침).
    }
  }

  return {
    externalUpdated: result.externalUpdated,
    externalBackedUp: result.externalBackedUp,
  };
}

/**
 * 정책 디렉터리 하나에 대한 소유 판정 컨텍스트 (v26.132.0 · ADR-047).
 *
 * `prefix` 는 `.claude/` 기준 디렉터리명(`rules` 등) — install log 의 `policyFiles` 키가
 * 그 형식이라 baseline 조회에 필요하다.
 */
export interface PolicySyncCtx {
  prefix: string;
  /** 설치 시점 기준선 (`.claude/` 상대경로 → sha256). 빈 Map = 판정 불가. */
  baseline: ReadonlyMap<string, string>;
}

/**
 * 디스크 내용이 하네스가 놓아둔 것 그대로인가.
 *
 * v26.134.0 — 판정식 자체는 `install-log.ts` 의 `isHarnessOwned` **하나뿐**이고 여기서는
 * 키 조립(`<prefix>/<rel>`)만 한다. ADR-048 이 "술어는 한 곳에"라고 적고도 이 파일에 사본이
 * 남아 있었다 — 소유 판정은 사용자 파일 삭제 여부를 가르므로 두 벌이 갈리면 피해가 크다.
 */
function isHarnessOwned(ctx: PolicySyncCtx, rel: string, current: string): boolean {
  return isOwnedByBaseline(ctx.baseline, `${ctx.prefix}/${rel}`, current);
}

/**
 * target 에 이미 있는 파일만 templates 기준으로 갱신한다 (Track 혼입 방지).
 *
 * v26.132.0 (ADR-047) — 사용자 편집분 판정이 붙었다. 그 전까지는 `copyFileSync` 로 무조건
 * 덮어써서, 같은 update 실행 안에서 스킬은 백업을 받고 룰·훅은 조용히 밀렸다.
 *
 * | 디스크 vs 기준선 | 뜻 | 처리 |
 * |---|---|---|
 * | 같다 | 사용자가 안 고쳤다 | 조용히 덮어쓴다 |
 * | 다르다 | 사용자가 고쳤다 | `.backup-<stamp>` 남기고 최신판을 자리에 |
 * | 기록 없음 | 판정 불가 | 보수적으로 백업 (레거시 설치의 첫 update 1회) |
 *
 * 내용 비교로 대신할 수 없다: 하네스가 개선해서 달라진 파일도 "다르다"로 잡혀 릴리즈마다
 * 전 사용자에게 백업본이 쌓인다 (`fs-ops.ts` backupFile 주석과 같은 이유).
 */
export function updateDir(
  target: string,
  source: string,
  ext: string,
  ctx: PolicySyncCtx,
  now: Date = new Date(),
): { updated: number; backedUp: string[] } {
  if (!existsSync(target) || !existsSync(source)) return { updated: 0, backedUp: [] };
  let updated = 0;
  const backedUp: string[] = [];

  for (const file of readdirSync(target)) {
    if (!file.endsWith(ext)) continue;
    const targetFile = join(target, file);
    const sourceFile = join(source, file);
    if (!existsSync(sourceFile)) continue;

    const next = readFileSync(sourceFile, "utf8");
    const current = readFileSync(targetFile, "utf8");
    if (current === next) continue; // 이미 최신 — 백업도 쓰기도 불필요

    if (!isHarnessOwned(ctx, file, current)) {
      backupFile(targetFile, now);
      backedUp.push(`${ctx.prefix}/${file}`);
    }
    writeFileSync(targetFile, next);
    updated++;
  }
  return { updated, backedUp };
}

/**
 * `.claude/skills/` 를 templates 기준으로 갱신한다 (v26.126.0 · R-3a · ADR-046).
 *
 * **설치된 스킬만 손댄다** — templates 에 있어도 target 에 그 스킬 디렉터리가 없으면 건너뛴다.
 * 스킬은 트랙/opt-in 으로 게이팅돼 설치되므로(`installer.ts` selectedInternalSkills), 전부
 * 복사하면 사용자가 고르지 않은 스킬이 딸려 들어간다 (`updateDir` 의 "Track 혼입 방지"와 같은 취지).
 *
 * 파일 단위 판정:
 * | 디스크 vs 기준선 | 뜻 | 처리 |
 * |---|---|---|
 * | 같다 | 사용자가 안 고쳤다 | 조용히 덮어쓴다 |
 * | 다르다 | 사용자가 고쳤다 | `.backup-<stamp>` 남기고 덮어쓴다 |
 * | 기준선 기록 없음 | 판정 불가 | 보수적으로 백업 (레거시 설치의 첫 update 1회) |
 *
 * **orphan prune 은 하지 않는다** — 스킬 디렉터리 안에는 사용자가 자기 참고 파일을 넣을 수 있고,
 * templates 에 없다는 이유로 지우면 그게 곧 사용자 파일 삭제다 (ADR-046 "지우지 않는다").
 *
 * **심볼릭 링크는 건너뛴다** (2026-08-02 · ADR-062). `existsSync` 는 링크를 따라가므로 그것만
 * 보면 "설치돼 있다"와 "다른 저장소를 가리키는 링크가 있다"가 구분되지 않는다. `npx skills add`
 * 로 받은 스킬의 프로젝트 스코프 설치처가 바로 `.claude/skills/<id>` 이고 그 실체는 skills
 * 저장소로의 링크다 — 그대로 쓰면 하네스가 **사용자의 다른 저장소 본문을 우리 판본으로
 * 덮어쓴다**. 쓰기 대상이 `.claude/` 밖이라 백업이 남아도 사용자가 찾을 자리가 아니다.
 * 소유자가 우리가 아닌 것은 손대지 않고 건너뛴 사실을 보고한다(침묵 금지).
 */
export function syncSkills(
  targetDir: string,
  sourceDir: string,
  baseline: ReadonlyMap<string, string>,
  now: Date = new Date(),
): { updated: number; backedUp: string[]; skippedLinks: string[] } {
  if (!existsSync(targetDir) || !existsSync(sourceDir))
    return { updated: 0, backedUp: [], skippedLinks: [] };
  let updated = 0;
  const backedUp: string[] = [];
  const skippedLinks: string[] = [];

  for (const skill of readdirSync(sourceDir, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    const targetSkill = join(targetDir, skill.name);
    if (!existsSync(targetSkill)) continue; // 사용자가 선택하지 않은 스킬 — 새로 깔지 않는다
    // lstat 은 링크를 따라가지 않는다 — 위 existsSync 가 못 하는 판정이 정확히 이것이다.
    if (lstatSync(targetSkill).isSymbolicLink()) {
      skippedLinks.push(skill.name);
      continue;
    }

    for (const rel of listFilesRecursive(join(sourceDir, skill.name))) {
      const targetFile = join(targetSkill, rel);
      const next = readFileSync(join(sourceDir, skill.name, rel), "utf8");

      if (!existsSync(targetFile)) {
        // 스킬 안에 새로 생긴 파일 (예: references/ 추가) — 스킬 자체는 이미 설치돼 있다.
        mkdirSync(dirname(targetFile), { recursive: true });
        writeFileSync(targetFile, next);
        updated++;
        continue;
      }

      const current = readFileSync(targetFile, "utf8");
      if (current === next) continue; // 이미 최신 — 백업도 갱신도 불필요

      const recorded = baseline.get(`${skill.name}/${rel}`);
      if (recorded === undefined || hashContent(current) !== recorded) {
        backupFile(targetFile, now);
        backedUp.push(`${skill.name}/${rel}`);
      }
      writeFileSync(targetFile, next);
      updated++;
    }
  }
  return { updated, backedUp, skippedLinks };
}

/** 설치 시점 기준선을 Map 으로. 기록이 없으면 빈 Map — 그때는 보수적 백업으로 폴백한다. */
function skillBaseline(projectDir: string): ReadonlyMap<string, string> {
  const log = readInstallLog(projectDir);
  return new Map((log?.skillFiles ?? []).map((f) => [f.path, f.sha256]));
}

/** 정책 파일 기준선 (v26.132.0 · ADR-047). 빈 Map = 덮어쓰기는 보수적 백업, prune 은 전면 중단. */
function policyBaseline(projectDir: string): ReadonlyMap<string, string> {
  const log = readInstallLog(projectDir);
  return new Map((log?.policyFiles ?? []).map((f) => [f.path, f.sha256]));
}

/**
 * 정책 파일 기준선을 갱신한다 — `refreshSkillBaseline` 과 같은 이유로 필수다.
 * 이걸 빼면 다음 update 가 방금 자기가 덮어쓴 파일을 "사용자가 고쳤다"로 오판해 백업을 매번 쌓는다.
 *
 * 로그가 없으면 만들지 않는다 (설치 기록 날조 금지 — uninstall 이 그걸 믿는다).
 */
function refreshPolicyBaseline(projectDir: string, templatesDir: string): void {
  const log = readInstallLog(projectDir);
  if (!log) return;
  const policyFiles = collectPolicyHashes(projectDir, templatesDir);
  const next: InstallLog = { ...log };
  if (policyFiles.length > 0) next.policyFiles = policyFiles;
  else delete next.policyFiles;
  try {
    writeInstallLog(projectDir, next);
  } catch {
    // 기록 실패가 update 자체를 실패시키지는 않는다 (D16 과 같은 방침).
  }
}

/**
 * 갱신 직후 기준선을 다시 찍는다.
 *
 * 이걸 빼면 다음 update 가 **방금 자기가 덮어쓴 파일**을 전부 "사용자가 고쳤다"로 오판해
 * 백업본을 매번 새로 쌓는다. update 는 install log 를 안 쓰는 단축 경로라
 * (`installer.ts` runUpdateInstall) 여기서 안 하면 아무도 안 한다.
 *
 * 로그가 없으면 **만들지 않는다** — update 가 설치 기록을 날조하면 uninstall 이 그걸 믿는다.
 */
function refreshSkillBaseline(projectDir: string): void {
  const log = readInstallLog(projectDir);
  if (!log) return;
  const skillFiles = collectSkillHashes(projectDir);
  const next: InstallLog = { ...log };
  if (skillFiles.length > 0) next.skillFiles = skillFiles;
  else delete next.skillFiles;
  try {
    writeInstallLog(projectDir, next);
  } catch {
    // 기록 실패가 update 자체를 실패시키지는 않는다 (D16 — 설치/갱신 성공 우선과 같은 방침).
  }
}

/**
 * Templates 에 없는데 target 에 있는 파일 제거 — **하네스가 깔았던 것만** (v26.132.0 · ADR-047).
 *
 * 그 전까지는 "templates 에 없다"만으로 지웠다. 그러면 사용자가 직접 만든 커스텀 룰·훅이
 * 백업도 없이 사라진다 — templates 에 없는 건 폐기된 하네스 룰도, 사용자가 쓴 팀 규칙도
 * 똑같이 "없음"이기 때문이다. 소유는 install log 기준선으로만 주장할 수 있다.
 *
 * 기록이 없으면(레거시 로그·로그 부재) **아무것도 지우지 않는다.** 폐기 룰이 남는 비용보다
 * 사용자 파일을 지우는 비용이 크다. 그쪽은 다음 install 이 기준선을 채우면 자연히 회수된다.
 *
 * 지우기 전 사용자가 고친 흔적이 있으면 백업을 남긴다 — 하네스가 깔았더라도 그 위에 쓴 내용은
 * 사용자 것이다.
 */
export function pruneOrphans(
  target: string,
  source: string,
  ext: string,
  ctx: PolicySyncCtx,
  now: Date = new Date(),
): string[] {
  if (!existsSync(target) || !existsSync(source)) return [];
  const removed: string[] = [];
  for (const file of readdirSync(target)) {
    if (!file.endsWith(ext)) continue;
    const sourceFile = join(source, file);
    if (!existsSync(sourceFile)) {
      const targetFile = join(target, file);
      // 소유를 주장할 수 있는 것만 지운다. 기준선에 없으면 사용자가 만든 파일이다.
      if (!ctx.baseline.has(`${ctx.prefix}/${file}`)) continue;
      try {
        const current = readFileSync(targetFile, "utf8");
        if (!isHarnessOwned(ctx, file, current)) backupFile(targetFile, now);
        unlinkSync(targetFile);
        removed.push(file);
      } catch {
        // best-effort — read-only? 다음 update 시 재시도
      }
    }
  }
  return removed;
}

/**
 * settings.json의 PreToolUse/PostToolUse hooks 중 실존 파일 없는 hook script 참조 제거.
 * bash clean_stale_hook_refs 등가 (jq 의존 없이 JSON 직접 파싱).
 *
 * @param claudeDir `.claude/` 자신. 이전엔 `.claude/hooks/` 였다 — M-1 으로 한 층 넓혔다.
 * @returns 제거된 hook script 의 `.claude/` 기준 상대경로 목록
 */
export function cleanStaleHookRefs(settingsPath: string, claudeDir: string): string[] {
  let settings: SettingsJson;
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf8")) as SettingsJson;
  } catch {
    return [];
  }
  const hookEvents = settings.hooks ?? {};
  const removed: string[] = [];
  const cleanedHooks: Record<string, HookEntry[]> = {};

  for (const [eventName, eventEntries] of Object.entries(hookEvents)) {
    if (!Array.isArray(eventEntries)) {
      cleanedHooks[eventName] = eventEntries; // non-array event — 그대로 보존
      continue;
    }
    cleanedHooks[eventName] = eventEntries
      .filter((entry) => Array.isArray(entry?.hooks))
      .map((entry) => ({
        ...entry,
        hooks: entry.hooks.filter((hook) => keepHookRef(hook, claudeDir, removed)),
      }))
      .filter((entry) => entry.hooks.length > 0); // stale 제거 후 hooks 빈 entry 제거
  }

  if (removed.length > 0) {
    const next: SettingsJson = { ...settings, hooks: cleanedHooks };
    writeFileSync(settingsPath, `${JSON.stringify(next, null, 2)}\n`);
  }
  return removed;
}

/**
 * hook command 가 **이 프로젝트에 앵커된** 실존 `.sh` 참조면 true.
 * 앵커돼 있는데 파일이 없으면 removed 에 상대경로를 수집하고 false (= 제거).
 * 앵커가 없으면 파일 부재와 무관하게 true (= 보존, `removed` 수집도 안 한다).
 *
 * M-1 — 탐지 범위가 `.claude/hooks/` 한 층에서 **`.claude/` 이하 임의 깊이**로 넓어졌다.
 * `templates/settings.json` 은 `applies: all` 인데 그 훅이 참조하는
 * `.claude/skills/strategic-compact/suggest-compact.sh` 는 `withEcc=true` 에서 미설치라,
 * plugin 을 켠 설치자는 Write/Edit 마다 없는 파일을 bash 로 부른다(exit 127). 치유기는
 * 이미 있었지만 이 부류를 regex 가 못 물었을 뿐이다.
 *
 * H-2 — 그 확장이 경로 세그먼트 `/.claude/` 만 봐서 **홈 `~/.claude/`** 까지 사정권에 넣었다.
 * 앵커 판정(`projectAnchoredRef`)이 그 경계를 되돌린다.
 *
 * 캡처와 기준 디렉터리는 **원자적으로 같이** 간다 — 기준만 `claudeDir` 로 옮기고 캡처가
 * 파일명이면 `.claude/alive.sh` 를 찾다 못 찾아 멀쩡한 훅을 지운다.
 *
 * 기존 한계 유지: 한 command 안에서 **앵커 배열 순서상 먼저 걸린 앵커**가 뽑아낸 참조 하나만
 * 본다 — 문자열상 먼저 나오는 참조가 아니다. 앵커가 여럿 섞인 command 에서는 뒤쪽 참조가
 * 판정 대상이 될 수 있고, 나머지는 검사 없이 보존된다(안전한 쪽).
 *
 * export 사유: `tests/settings-reference-parity.test.ts` 가 "이 참조는 치유기가 실제로 무는가"를
 * 직접 호출해 면제 판정에 쓴다 — 면제는 말이 아니라 기계적 계약으로 증명한다.
 */
export function keepHookRef(hook: HookCommand, claudeDir: string, removed: string[]): boolean {
  const relPath = projectAnchoredRef(hook?.command ?? "", claudeDir);
  if (relPath === undefined) return true; // 이 프로젝트에 앵커된 hook script 참조 아님 — 보존
  const exists = existsSync(join(claudeDir, relPath));
  // 중복 제거는 **경로 기준**. 파일명 기준이면 같은 이름이 두 디렉터리에 있을 때
  // 살아 있는 쪽 때문에 죽은 쪽이 보고에서 사라진다.
  if (!exists && !removed.includes(relPath)) removed.push(relPath);
  return exists;
}

/**
 * `.claude/` 라는 이름이 가리키는 대상은 **둘**이다 — 이 프로젝트의 `<projectDir>/.claude/` 와
 * 사용자 홈의 `~/.claude/`. 치유기가 소유를 주장할 수 있는 것은 앞의 것뿐이고, 뒤의 것은
 * 사용자 전역 설정(플러그인 훅이 실제로 사는 `~/.claude/plugins/**` 포함)이다. 지우면 치유가
 * 아니라 파손이다 (ADR-057 Decision 2).
 *
 * 그래서 **앵커 화이트리스트**로 짠다: 참조가 아래 접두사 중 하나로 시작할 때만 판정 대상이고,
 * 나머지는 전부 기본값 = 보존으로 떨어진다. 반대 방향(`$HOME` 을 빼고, `~` 를 빼고,
 * `${CLAUDE_CONFIG_DIR}` 를 빼고 …)으로 짜면 그 예외 목록이 두 번째 하드코딩 사본이 되어
 * **다음에 나올 표기 하나가 곧 다음 서식지**가 된다 (`no-false-ship` §게이트는 열거하지 말고
 * 훑어라 — 5회 재발한 실패 모드).
 *
 * @param claudeDir 이 프로젝트의 `.claude/` 절대경로. 문자열 비교이지 경로 정규화가 아니다 —
 *   심볼릭 링크·마운트로 표기가 갈리면 **어느 방향이든 앵커가 성립하지 않아 보존**된다:
 *   기준보다 짧게 쓰인 방향(`claudeDir` = `/private/var/…`, command = `/var/…`)은 앵커 문자열
 *   자체가 없고, 앞에 뭔가 더 붙은 방향(`/private/var/…` · 바인드마운트 `/mnt/host/var/…`)은
 *   문자열은 품고 있지만 **토큰 시작이 아니라서** 앵커가 아니다(H-4). 후자를 앵커로 세면
 *   실경로가 다른, 실존하는 남의 훅을 지운다. 정규화를 붙이려면 양쪽을 같이 정규화해야 한다.
 * @returns `.claude/` 기준 상대경로. 앵커가 없거나 `.sh` 참조가 아니면 undefined.
 */
function projectAnchoredRef(command: string, claudeDir: string): string | undefined {
  const anchors = [
    "$CLAUDE_PROJECT_DIR/.claude/",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: 훅 command 원문의 셸 변수 표기 (JS 템플릿 아님)
    "${CLAUDE_PROJECT_DIR}/.claude/",
    // 레거시 설치는 `$CLAUDE_PROJECT_DIR` 이전에 절대경로를 그대로 박아 넣었다 — 가리키는 곳이
    // 같은 프로젝트이므로 표기가 다르다고 면제할 이유가 없다.
    `${claudeDir}/`,
  ];
  for (const anchor of anchors) {
    // 앵커는 command **어딘가에 박혀 있는 문자열**이 아니라 "참조가 여기서 시작한다"는 주장이다.
    // 그래서 출현마다 시작 경계를 보고, 토큰 중간 출현은 건너뛴 뒤 **다음 출현**을 계속 본다 —
    // 첫 출현만 보고 포기하면 (`… /mnt/host<claudeDir>/x.sh … <claudeDir>/y.sh` 처럼) 뒤에 있는
    // 진짜 앵커를 놓친다.
    for (let at = command.indexOf(anchor); at >= 0; at = command.indexOf(anchor, at + 1)) {
      // 시작 고정은 끝과 **같은 개념**이다 — 앞 문자가 토큰 문자가 아니면(= 없거나 따옴표·공백)
      // 토큰 시작이다. 구분자를 열거하면 그 목록이 토큰 정의의 두 번째 사본이 되어 빠진 형태
      // 하나가 다음 서식지가 된다. 안 하면 실경로가 다른 참조(`/private…` · 바인드마운트 ·
      // 백업 트리)를 이 프로젝트 것으로 오인해 **실존하는 남의 훅을 지운다** (ADR-057).
      // command 맨 앞(`at === 0`)은 `charAt(-1)` 이 빈 문자열이라 토큰 시작으로 떨어진다.
      if (/[^"\s]/.test(command.charAt(at - 1))) continue;
      // 끝 고정도 **토큰 경계**로 짠다 — 같은 클래스의 부정 룩어헤드가 "토큰 문자가 더 없다"
      // 하나로 따옴표·공백·문자열 끝을 전부 덮는다. 안 하면 `.sh` 가 접두사인 경로
      // (`run.shell` · `x.sh.bak`)에서 앞부분만 캡처해 실존하는 훅을 stale 로 오판한다.
      const rel = command.slice(at + anchor.length).match(/^[^"\s]+\.sh(?![^"\s])/)?.[0];
      if (rel) return rel;
    }
  }
  return undefined;
}

interface HookCommand {
  type?: string;
  command?: string;
}

interface HookEntry {
  matcher?: string;
  hooks: HookCommand[];
}

interface SettingsJson {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

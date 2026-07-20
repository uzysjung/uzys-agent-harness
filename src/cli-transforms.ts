/**
 * cli-transforms.ts — 외부 CLI(codex · opencode · antigravity) transform 실행 (v26.134.0 · ADR-049).
 *
 * `installer.ts` 안에 있던 것을 옮겼다. `update` 도 **같은 함수**를 써야 하기 때문이다 —
 * 소유자 판정이 세 자산 종류에 세 번 나눠 붙어 같은 버그가 세 번 난 게 ADR-046~048 의 역사이고
 * (`feedback_surface_symmetry`), 그 교훈은 "공통 규칙은 자산별 코드가 아니라 한 도구에" 였다.
 * install 과 update 가 각자 transform 을 부르면 기준선을 잇는 규칙이 두 벌이 되고, 그건 곧
 * 네 번째 재발이다. 겸사로 `update-mode.ts` → `installer.ts` 순환 import 도 생기지 않는다.
 */

import {
  type AntigravityTransformReport,
  runAntigravityTransform,
} from "./antigravity/transform.js";
import { type CodexOptInReport, runCodexOptIn } from "./codex/opt-in.js";
import { type CodexTransformReport, runCodexTransform } from "./codex/transform.js";
import type { InstallLogSkillFile } from "./install-log.js";
import { type OpencodeTransformReport, runOpencodeTransform } from "./opencode/transform.js";
import type { OwnedWriteResult } from "./owned-write.js";
import { CLI_BASES, type CliBase } from "./types.js";

/** Codex / OpenCode / Antigravity per-CLI transforms (+ scope=global opt-in) 결과. */
export interface CliTransformResults {
  codex: CodexTransformReport | null;
  codexOptIn: CodexOptInReport | null;
  opencode: OpencodeTransformReport | null;
  antigravity: AntigravityTransformReport | null;
  /** v26.133.0 (ADR-048) — 세 transform 이 쓴 산출물의 기준선 (install log `externalFiles`). */
  externalFiles: InstallLogSkillFile[];
  /** v26.133.0 (ADR-048) — 사용자 편집분이라 만든 백업 파일 경로. 설치 화면에 노출한다. */
  externalBackups: string[];
  /** v26.134.0 (ADR-049) — 실제로 디스크가 바뀐 파일 수. update 화면의 카운트. */
  externalUpdated: number;
  /** v26.134.0 (ADR-049) — 백업된 사용자 편집분의 project-relative 경로. */
  externalBackedUp: string[];
}

export interface CliTransformParams {
  harnessRoot: string;
  projectDir: string;
  /** 대상 CLI. install 은 `spec.cli`, update 는 전부(`CLI_BASES`) — 아래 refreshOnly 주석 참조. */
  cli: ReadonlyArray<CliBase>;
  selectedInternalSkills: ReadonlyArray<string>;
  /** install log 의 `externalFiles`. 없으면 빈 배열 = 판정 불가 → 보수적 백업. */
  previousExternal: ReadonlyArray<InstallLogSkillFile>;
  /**
   * v26.134.0 (ADR-049) — 이미 있는 산출물만 갱신하고 없는 것은 만들지 않는다 (`update` 경로).
   *
   * **이 플래그가 "어느 CLI 가 설치돼 있나"라는 질문 자체를 없앤다.** 안 깐 CLI 는 대상 파일이
   * 하나도 없어 자연히 아무것도 안 쓰므로, update 는 `CLI_BASES` 전부를 그냥 넘기면 된다 —
   * CLI 목록이나 스킬 목록의 **열거 사본을 만들 필요가 없다** (`no-false-ship` §게이트는
   * 열거하지 말고 훑어라와 같은 취지: 사람이 기억해야 하는 목록은 다음 drift 의 서식지다).
   */
  refreshOnly?: boolean;
  /** codex global trust opt-in — `scope=global` + `withCodexTrust` 일 때만. update 는 안 쓴다. */
  codexTrust?: boolean;
}

/**
 * update 가 넘기는 CLI 목록 — 전부. 판정은 `refreshOnly` 가 디스크로 대신한다.
 * `CLI_BASES` 에서 파생하므로 CLI 가 늘어도 여기를 고칠 필요가 없다.
 */
export const ALL_CLI_TARGETS: ReadonlyArray<CliBase> = CLI_BASES;

export function runCliTransforms(params: CliTransformParams): CliTransformResults {
  const {
    harnessRoot,
    projectDir,
    cli,
    selectedInternalSkills,
    previousExternal,
    refreshOnly = false,
    codexTrust = false,
  } = params;

  // v26.133.0 (ADR-048) — 기준선을 transform 사이로 **이어준다**. codex 와 opencode 는 같은
  // `AGENTS.md` 를, codex 와 antigravity 는 같은 `.agents/skills/<id>/SKILL.md` 를 쓴다.
  // 안 이어주면 뒤 단계가 앞 단계의 산출물을 '사용자 편집'으로 오판해 **실행할 때마다**
  // 백업이 생긴다 — 백업 노이즈는 진짜 백업을 눈에 안 띄게 만들어 보호 자체를 무력화한다.
  const baseline = new Map(previousExternal.map((f) => [f.path, f.sha256]));
  const externalFiles: InstallLogSkillFile[] = [];
  const externalBackups: string[] = [];
  const externalBackedUp: string[] = [];
  let externalUpdated = 0;
  const absorb = (report: { ownership: OwnedWriteResult }): void => {
    for (const f of report.ownership.files) {
      baseline.set(f.path, f.sha256);
      externalFiles.push(f);
    }
    externalBackups.push(...report.ownership.backupPaths);
    externalBackedUp.push(...report.ownership.backedUp);
    externalUpdated += report.ownership.updated;
  };

  let codex: CodexTransformReport | null = null;
  let codexOptIn: CodexOptInReport | null = null;
  if (cli.includes("codex")) {
    // v26.87.0 — dev-method skills 는 selectedInternalSkills 로 게이팅.
    codex = runCodexTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
      baseline,
      refreshOnly,
    });
    absorb(codex);
    // v26.64.0 (ADR-020) — Codex global trust opt-in 은 scope=global 일 때만 의미.
    // scope=project (default) 시 ~/.codex/ write skip (config.toml trust entry 만).
    if (codexTrust) {
      codexOptIn = runCodexOptIn({ projectDir });
    }
  }

  let opencode: OpencodeTransformReport | null = null;
  if (cli.includes("opencode")) {
    opencode = runOpencodeTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
      baseline,
      refreshOnly,
    });
    absorb(opencode);
  }

  // v26.66.0 — Antigravity transform: `.agents/rules/uzys-harness.md` + dev-method skills.
  let antigravity: AntigravityTransformReport | null = null;
  if (cli.includes("antigravity")) {
    antigravity = runAntigravityTransform({
      harnessRoot,
      projectDir,
      selectedInternalSkills,
      baseline,
      refreshOnly,
    });
    absorb(antigravity);
  }

  return {
    codex,
    codexOptIn,
    opencode,
    antigravity,
    externalFiles,
    externalBackups,
    externalUpdated,
    externalBackedUp,
  };
}

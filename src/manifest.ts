import {
  INTERNAL_BUNDLED_SKILL_IDS,
  isAssetSelected,
  type UserOverride,
} from "./external-assets.js";
import { INSTALL_LOG_DIR } from "./install-log.js";
import { HARNESS_ANCHOR_FILE } from "./project-claude-merge.js";
import { anyTrack, hasDevTrack, hasUiTrack } from "./track-match.js";
import { type OptionFlags, TRACKS, type Track } from "./types.js";

/**
 * Source-relative paths under `templates/` map to project-relative targets under
 * the project root (typically `.claude/...` or `CLAUDE.md`).
 *
 * Each entry declares an `applies(spec)` predicate based on the selected tracks.
 * Phase C scope: rules + commands + agents + base skills + hooks + project CLAUDE.md.
 * Phase E will extend with the remaining track-specific skills.
 */

export interface AssetSpec {
  /** Selected tracks (union). */
  tracks: ReadonlyArray<Track>;
  /**
   * Optional opt-in: --with-tauri.
   * Note: copied from `OptionFlags.withTauri` by installer; keep both fields in sync
   * when adding new opt-in flags that affect manifest gating.
   *
   * 2026-08-02 정비 — `tauri` **룰**이 배포에서 빠져 이 필드를 읽는 게이팅은 현재 없다.
   * 필드를 남긴 이유는 `tauri-desktop` 자산 선택 자체는 살아 있고(installer 가 여전히 채운다)
   * 트랙×opt-in 곱을 도는 게이트들이 이 축을 그대로 쓰기 때문이다.
   */
  withTauri?: boolean;
  /**
   * v26.58.0 — withEcc opt-out gating (BREAKING vs v26.55.0). ADR-019 supersedes ADR-016 부분.
   * Note: copied from `OptionFlags.withEcc` by installer; keep both fields in sync.
   *
   * 정책 (cherry-pick × plugin gating):
   * - C1 (단순 중복): 매핑 자체 삭제.
   * - C2 (plugin OFF fallback): `applies: (s) => !s.withEcc && <track>`.
   * - C3 (modified or 별개 source): `applies: <track only>` (withEcc 무관 항상 install).
   *
   * **개수를 여기 적지 않는다** — 주석의 숫자는 두 번째 사본이라 썩는다 (#340 에서 실제로
   * 19/3 이 실측과 어긋나 있었다). 그리고 **`_ECC` 접미 목록을 세는 것으로는 C2 가 안 나온다**:
   * 이 파일의 `buildManifest` 안에는 목록 없이 인라인 `applies` 로 `!s.withEcc` 를 붙인 엔트리가
   * 따로 있어(#340 에서 추가), 목록만 세면 그만큼 모자란다.
   * C2 의 모집단은 **`buildManifest` 를 withEcc on/off 로 두 번 만들어 `applies()` 통과 대상을
   * diff** 해서 얻는다 — 조건식을 읽는 대신 결과를 재는 이 방법이 인라인 게이트까지 포함한다.
   * C3 는 `MODIFIED_ECC_SKILL_DIRS`. `tests/vnv-verdict.test.ts` 가 같은 방법으로 양방향 정합을
   * 문다.
   *
   * 분류 표 SSOT: docs/PRD/v26-58-cherry-pick-plugin-gating.md §6.
   */
  withEcc?: boolean;
  /**
   * v26.87.0 — 선택된 내부 dev-method skill id 집합 (uzys 1st-party, repo-bundled).
   * installer 가 `DEV_METHOD_SKILL_IDS` 를 `isAssetSelected` 로 필터해 채운다 — 즉
   * track(has-dev-track) 기본 + wizard uncheck / `--without <id>` (forceExclude) 반영.
   * buildManifest 의 skill-dir copy 가 이 목록에 포함된 id 만 게이팅한다.
   */
  selectedInternalSkills?: ReadonlyArray<string>;
}

/**
 * `AssetSpec` 의 **유일한 derive**. installer 의 `buildManifestSpec` 과 계측 경로가 함께 쓴다.
 *
 * WHY (#320): 계측 4곳이 이 spec 을 **손으로 조립**하고 있었고 — `context-cost-report.mjs` ·
 * `context-cost-baseline.mjs` · `context-cost-ratchet.test.ts` · `north-star-cost-figures.test.ts` —
 * 넷 다 `selectedInternalSkills` 를 안 채웠다. 그 필드가 비면 번들 스킬의 `applies` 가
 * `(undefined ?? []).includes(...)` 로 전부 false 가 되어 **상주 계측에서 통째로 빠진다**.
 * 실측 결과 track=tooling 에서 상주가 23개/~5,331 로 보고됐지만 실제는 34개/~7,781 이었다 —
 * 1차 NSM 이 실제의 약 68%만 세고 있었다.
 *
 * 손으로 조립하는 자리가 넷이었다는 것이 원인이다. 그래서 고친 방향은 "넷을 각각 채우기"가
 * 아니라 **조립 지점을 하나로 만드는 것**이다. 새 계측이 생겨도 여기를 부르면 따라온다.
 *
 * `cli` 는 받지 않는다 — `buildManifest` 도 `applies` 도 그 필드를 읽지 않는다(계측 spec 들이
 * `cli: ["claude"]` 를 넣고 있었지만 아무 효과가 없었다).
 */
export function buildAssetSpec(ctx: {
  tracks: ReadonlyArray<Track>;
  options: OptionFlags;
  userOverride?: UserOverride;
}): Required<AssetSpec> {
  return {
    tracks: ctx.tracks,
    withTauri: isAssetSelected("tauri-desktop", ctx),
    // v26.55.0 — withEcc gating (ADR-016). withPrune 은 ecc-plugin 사용을 전제한다.
    withEcc: isAssetSelected("ecc-plugin", ctx) || ctx.options.withPrune === true,
    // v26.87.0 — internal bundled skills (dev-method + opt-in advisors, v26.95.0). id 별 condition
    // (has-dev-track vs opt-in)은 isAssetSelected 가 적용한다.
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS.filter((id) => isAssetSelected(id, ctx)),
  };
}

export interface AssetEntry {
  source: string; // relative to repo `templates/`
  target: string; // relative to project root
  type: "file" | "dir";
  applies: (spec: AssetSpec) => boolean;
}

const all = (): boolean => true;
const dev = (s: AssetSpec): boolean => hasDevTrack(s.tracks);
const ui = (s: AssetSpec): boolean => hasUiTrack(s.tracks);
const onTracks =
  (pattern: string) =>
  (s: AssetSpec): boolean =>
    anyTrack(s.tracks, pattern);

// v26.107.0 (ADR-036, 라이프사이클 자산화 ①) — doc-governance: SSOT 위계 + "merge = 코드 +
//   추적 동기화" 의무. 실무 관행의 일반화. 문서 규약은 전 트랙 공통.
// 2026-08-02 정비 ② — `gates-taxonomy` 제거. 게이트 4유형(Pre-flight/Revision/Escalation/Abort)은
//   모델이 이미 아는 분류였고, 설치자가 받아 가는 것은 판정이 아니라 어휘표였다.
const COMMON_RULES = ["git-policy", "change-management", "doc-governance"];
const DEV_RULES = ["test-policy", "ship-checklist"];
// 2026-08-04 (#284) — `benchmark-parity` 제거. 그 룰이 담고 있던 것은 gap.md 표 스키마 · PR
//   의무 필드 · dogfood walkthrough 절차였다. 전부 **그 작업을 할 때만** 필요한 절차인데 매
//   세션 상주했다.
// 2026-08-12 — `playwright-launch` 제거(사용자 결정). 남은 것은 브라우저 금지문이었는데,
//   그 룰 본문이 스스로 "절차는 `ui-visual-review` 스킬이 SSOT" 라고 적고 있었다. 금지와 절차가
//   한 자리에 있는 편이 낫다고 판단해 스킬로 합쳤고, 발화가 늦는 위험은 스킬 description 이
//   "브라우저를 여는 어떤 방법이든 그 전에 읽어라"로 흡수한다. UI 트랙 전용 룰은 이제 없다.
const UI_RULES: string[] = [];

// 2026-08-02 정비 — 기술스택 상세 룰(shadcn·nextjs·htmx·pyside6·database·api-contract·
//   data-analysis·tauri)을 배포에서 뺐다. 모델이 이미 아는 것을 상주로 부담시키던 자리다.
//   남은 트랙 매핑은 `cli-development` 하나뿐 — 그래도 표를 유지하는 이유는 트랙별 룰이라는
//   축 자체는 살아 있고, 배열을 없애면 다음에 트랙 룰을 넣을 자리가 사라지기 때문이다.
const TRACK_RULES: Record<Track, string[]> = {
  "csr-supabase": [],
  "csr-fastify": [],
  "csr-fastapi": [],
  "ssr-htmx": [],
  "ssr-nextjs": [],
  data: [],
  executive: [],
  tooling: ["cli-development"],
  full: ["cli-development"],
  // v0.5.0 — executive-style baselines (no dev rules; common rules only).
  "project-management": [],
  "growth-marketing": [],
};

/** Resolve the unique set of rule names to install for the given spec. */
export function resolveRules(spec: AssetSpec): string[] {
  const set = new Set<string>(COMMON_RULES);
  if (hasDevTrack(spec.tracks)) {
    for (const r of DEV_RULES) {
      set.add(r);
    }
  }
  if (hasUiTrack(spec.tracks)) {
    for (const r of UI_RULES) {
      set.add(r);
    }
  }
  for (const t of spec.tracks) {
    for (const r of TRACK_RULES[t]) {
      set.add(r);
    }
  }
  return [...set].sort();
}

/**
 * 모든 트랙의 룰 union — `update` 가 쓴다. 전부 넘기고 "이 프로젝트에 뭐가 깔렸나"는
 * `refreshOnly` 가 디스크로 대신 판정한다 (`ALL_CLI_TARGETS` · `INTERNAL_BUNDLED_SKILL_IDS` 와
 * 같은 형태). `resolveRules` 에서 파생하므로 룰이 늘거나 줄어도 여기를 고칠 필요가 없다.
 */
export const ALL_RULES: ReadonlyArray<string> = resolveRules({ tracks: [...TRACKS] });

// v26.58.0 — ECC cherry-pick × plugin gating. ADR-019.
// 본 프로젝트 (always): reviewer, data-analyst, strategist
// ECC cherry-pick C2 (plugin OFF 시 fallback — opt-out gating, !s.withEcc):
//   code-reviewer, security-reviewer, silent-failure-hunter, build-error-resolver
const CORE_AGENTS = ["reviewer", "data-analyst", "strategist"];
const CORE_AGENTS_ECC = ["code-reviewer", "security-reviewer"];

// v26.138.0 — implementer: 구현 레인. 기존 에이전트 8종이 전부 검토·검증·도메인 특화라
//   설치자는 "코드를 볼 사람"만 받고 "쓸 사람"은 못 받았다. 근거 = 두 코퍼스 실측 대조에서
//   서브에이전트 코드 Edit 433 vs 3 — 규율 차이가 아니라 **레인 부재**였다.
const DEV_AGENTS = ["plan-checker", "implementer"];
const DEV_AGENTS_ECC = ["silent-failure-hunter", "build-error-resolver"];

/**
 * Hooks installed for every project (parity with setup-harness.sh L815-826).
 *
 * 2026-08-02 정비 — `spec-drift-check.sh` 제거. 산문(doc-governance·ship-checklist)은 이것을
 * 차단 게이트로 적었지만 실제로는 어디에도 배선돼 있지 않았고(`templates/settings.json` 미참조),
 * 미완 체크박스가 쌓인 상태에서도 `ship` 모드가 exit 0 이었다 — 즉 설치자가 매 프로젝트에서
 * 받아 가는 것은 게이트가 아니라 게이트라는 **이름**이었다.
 *
 * 2026-08-02 정비 ② — `checkpoint-snapshot.sh` 제거. 같은 형태의 다른 결말이다: 배선이 없어
 * (`"PostToolUse": []`) 설치는 되고 **실행은 0** 이었다. 안 도는 훅은 실패 증상이 없어 프로즈로는
 * 못 잡는다 — 재발은 `tests/hook-wiring-parity.test.ts` 가 양방향으로 문다.
 *
 * 2026-08-16 정비 ③ — `mcp-pre-exec.sh` 제거(ADR-072). 앞의 둘과 달리 이건 **돌고 있었고 잘
 * 돌았다** — 지운 이유가 배선이 아니라 목적이다. 이 하네스가 파는 것은 "사용자가 AI 코딩 도구로
 * 개발을 잘하게 만드는 것"인데, MCP 서버를 새로 붙이는 순간 차단하는 훅은 그 반대로 작동한다
 * (판정 기준 = 루트 `CLAUDE.md` §판정은 목적에서 시작한다). 결정론적으로 구현됐다는 사실은
 * 목적 적합성의 증거가 아니다.
 */
export const ALWAYS_HOOKS = [
  "session-start.sh",
  "protect-files.sh",
  // UserPromptSubmit 넛지. 차단하지 않는 유일한 훅 — 판정은 결정적 두 조건뿐이고(길이 ·
  // `<objective>` 표식 부재) 변환 자체는 `task-brief` 스킬 몫이다. `templates/settings.json`
  // 배선과 한 벌 (hook-wiring-parity 가 한쪽만 있는 상태를 문다).
  "task-brief-nudge.sh",
];

// v26.58.0 — ECC cherry-pick × plugin gating. ADR-019.
// 2026-08-02 정비 (ADR-060) — north-star · gh-issue-workflow 는 uzysjung/uzys-agent-skills 로
// 이관돼 카탈로그 엔트리(`kind: "skill"`)가 됐다. 전 트랙 도달 범위는 그 엔트리의
// `any-track: 전 트랙` condition 이 이어받는다 (강등 아님).
const COMMON_SKILL_DIRS: string[] = [];
// C2 (plugin OFF fallback, opt-out).
// v26.121.0 — continuous-learning-v2 가 C3 → C2. 우리 판본이 upstream 에서 agents/(관측을
// instinct 로 바꾸는 분석기)를 뺀 진부분집합이었고, 그래서 "plugin 으로 갈음 불가"라는 C3 근거가
// 뒤집혀 있었다 — 갈음 불가의 내용이 기능 제거였다. upstream 전체를 복원해 동일해졌으므로
// (lock modified:false) plugin ON 이면 비켜서는 것이 맞다. 데몬은 upstream 기본값대로 꺼져 있다
// (config.json observer.enabled=false) — 켜면 백그라운드에서 claude 를 주기 호출하므로 사용자 선택.
// #340 — strategic-compact 은 lock 에서 `modified:true` 지만 **C2 로 두는 것이 의도**다.
// `modified` 는 `sync-cherrypicks.sh --apply` 의 덮어쓰기 방지 플래그이지 설치 게이팅이 아니다.
// ECC 를 고르면 이 디렉터리가 안 깔리고, 그때 `settings.json` 이 남기는 훅 참조는 install 의
// 치유 패스가 지운다(M-1, `tests/installer.test.ts` 가 문다). 두 축을 같은 것으로 읽으면
// 이 결정이 사고로 보인다 — 그래서 아래 게이트에 예외로 **이름을 적어** 둔다.
const COMMON_SKILL_DIRS_ECC = ["strategic-compact", "continuous-learning-v2"];
// C3 (modified=true — plugin 으로 갈음 불가, 항상 install). deep-research = v26.114.0
// 리서치 원장(confirmed/killed + caveat) 주입, ADR-042.
const MODIFIED_COMMON_SKILL_DIRS = ["deep-research"];

const DEV_SKILL_DIRS: string[] = [];
const DEV_SKILL_DIRS_ECC = ["agent-introspection-debugging"];
// C3 (modified=true): plugin 으로 갈음 불가, dev 트랙 항상 install.
// eval-harness = v26.114.0 eval spec 아티팩트 계약(C·R ID·baseline·Test Command·Status, ADR-042).
// 2026-08-02 정비 (ADR-060) — verification-loop 은 C3 계약을 해체했다: 우리 판본이
// uzysjung/uzys-agent-skills 로 이관돼 더는 ECC 파생 번들이 아니다. cherrypicks.lock 의
// `ecc-verification-loop` 행도 함께 제거 — lock 과 이 목록은 1:1 이어야 한다(아래 주석).
const MODIFIED_DEV_SKILL_DIRS = ["eval-harness"];

/**
 * C3 로 분류된 ECC cherry-pick 스킬 전체 (수정본 — plugin 으로 갈음 불가).
 * `.dev-references/cherrypicks.lock` 의 `modified: true` 와 1:1 이어야 한다 — lock 이
 * false 로 남으면 `sync-cherrypicks.sh --apply` 의 rsync --delete 가 로컬 수정을 조용히
 * 덮어쓴다. 정합은 tests/vnv-verdict.test.ts 가 강제한다. ADR-041.
 */
export const MODIFIED_ECC_SKILL_DIRS = [...MODIFIED_COMMON_SKILL_DIRS, ...MODIFIED_DEV_SKILL_DIRS];

const UI_SKILL_DIRS = ["ui-visual-review"];
const UI_SKILL_DIRS_ECC = ["e2e-testing"];

// python-* skills (data|csr-fastapi|full) — C2 (plugin OFF fallback).
const PYTHON_SKILL_DIRS_ECC = ["python-patterns", "python-testing"];

/**
 * CLI 중립 자산인가 — `.uzys-agent-harness/` 아래는 4개 CLI 와 사람이 함께 쓰는 슬롯이다
 * (install log 와 같은 디렉터리, ADR-050). claude 를 고르지 않은 설치에도 이 자산들은 깔린다.
 *
 * 접두사에서 derive 하는 이유: 대상 목록을 두 번 적으면 그 사본이 다음 drift 서식지가 된다.
 * 아래 두 entry 의 주석이 이미 "CLI 중립 슬롯"이라 적고 있었는데 배선만 그러지 못했다.
 */
export function isCliNeutralTarget(target: string): boolean {
  return target.startsWith(`${INSTALL_LOG_DIR}/`);
}

/** Build the full asset manifest for the given spec. */
export function buildManifest(spec: AssetSpec): AssetEntry[] {
  const m: AssetEntry[] = [];

  // Rules
  for (const r of resolveRules(spec)) {
    m.push({
      source: `rules/${r}.md`,
      target: `.claude/rules/${r}.md`,
      type: "file",
      applies: all,
    });
  }

  // 2026-08-16 — `commands/ecc` 8종 삭제 (ADR-073). ADR-019 는 이것을 "ECC 플러그인을 안 고른
  // 사람도 같은 명령을 쓰게" 하는 opt-out 폴백으로 넣었는데, 8개 중 **2개**(`e2e`·`eval`)가
  // 플러그인 에이전트(`everything-claude-code:*`)를 직접 불러 폴백 상황에서 아예 못 돌았다.
  // 나머지 6개는 돌았지만 플러그인이 여섯을 모두 제공하므로 폴백을 기본값에 둘 이유가 없다.
  //   2026-08-18 정정(#338) — 이 주석과 ADR-073 Context 는 "5개가 안 고른 자산을 가리킨다"로
  //   적고 있었다. `evolve`·`instinct-status`·`promote` 가 부르는 `continuous-learning-v2` 는
  //   바로 아래 `COMMON_SKILL_DIRS_ECC` 항목이라 **같은 `!s.withEcc` 조건으로 함께 깔린다** —
  //   "별도 opt-in 스킬이라 대개 없다"가 틀렸다. 결정은 유지, 숫자만 정정.
  //
  // `ecc-prune` 은 남는다 — 그쪽은 ECC 를 **고른 사람**의 설치를 최적화하는 opt-in 이라 방향이
  // 반대다(사용자 확정 2026-08-16).

  // 하네스 앵커 — **프로젝트 루트**에 하네스 소유 파일로 나간다 (P5 · ADR-060).
  // 루트 `CLAUDE.md` 는 사용자 것이고, 거기엔 이 파일을 끌어오는 `@import` 한 줄만 들어간다
  // (`project-claude-merge.ts` upsertHarnessImport). 파일명은 그 모듈이 SSOT.
  m.push({
    source: "CLAUDE.md",
    target: HARNESS_ANCHOR_FILE,
    type: "file",
    applies: all,
  });

  // Server-side git guards. Target is CLI-neutral on purpose — a repository rule protects the
  // default branch for every CLI and every human at once, so it does not belong under `.claude/`.
  // Same directory as the install log (ADR-050), which is already the CLI-agnostic slot.
  m.push({
    source: "scripts/protect-branch.sh",
    target: ".uzys-agent-harness/protect-branch.sh",
    type: "file",
    applies: all,
  });

  // SPEC/TODO drift 탐지기. **훅이 아니라 명시 호출 스크립트다** — 자동 발화 경로가 없는 것이
  // 정직한 상태이고(옛 훅 판본이 죽은 이유가 배선 없는 훅 라벨이었다), 호출 지점은 배포판 룰
  // 둘이 적는다: ship-checklist 의 SPEC/PRD 정합성 항목(exit 2 = 차단) · doc-governance 검증
  // 게이트 절. 타깃은 protect-branch 와 같은 CLI 중립 슬롯 — 문서 drift 는 4개 CLI 와 사람이
  // 함께 보는 관심사라 `.claude/` 아래가 아니다.
  m.push({
    source: "scripts/spec-drift-check.sh",
    target: ".uzys-agent-harness/spec-drift-check.sh",
    type: "file",
    applies: all,
  });

  // 부정 결론("없다"·"안 된다")의 대조군 강제기. 룰 `cli-development` 이 세 규약을 프로즈로 적고
  // 있었는데 같은 실수가 계속 났다 — 프로즈는 사람이 매번 기억해야 하고, 기억해야 하는 규약은
  // 규약이 아니다. 타깃이 CLI 중립 슬롯인 이유는 protect-branch·spec-drift-check 과 같다:
  // 검증 규율은 4개 CLI 와 사람이 함께 쓰는 관심사라 `.claude/` 아래가 아니다.
  m.push({
    source: "scripts/check-absence.sh",
    target: ".uzys-agent-harness/check-absence.sh",
    type: "file",
    applies: all,
  });

  // Agents (본 프로젝트)
  for (const a of CORE_AGENTS) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: all,
    });
  }
  for (const a of DEV_AGENTS) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: dev,
    });
  }
  // v26.58.0 — Agents (ECC cherry-pick). ADR-019. C2: plugin OFF 시만 install (opt-out).
  for (const a of CORE_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => !s.withEcc,
    });
  }
  for (const a of DEV_AGENTS_ECC) {
    m.push({
      source: `agents/${a}.md`,
      target: `.claude/agents/${a}.md`,
      type: "file",
      applies: (s) => !s.withEcc && hasDevTrack(s.tracks),
    });
  }

  // Common skill directories
  for (const sd of COMMON_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: all,
    });
  }
  // v26.58.0 — Common skill dirs (ECC cherry-pick). ADR-019. C2: plugin OFF 시만 install (opt-out).
  for (const sd of COMMON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc,
    });
  }
  // v26.58.0 — C3 (modified=true). plugin 으로 갈음 불가, 항상 install. ADR-019.
  for (const sd of MODIFIED_COMMON_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: all,
    });
  }
  m.push({
    source: "skills/spec-scaling/SKILL.md",
    target: ".claude/skills/spec-scaling/SKILL.md",
    type: "file",
    applies: all,
  });
  // #340 — 아래 4종은 `cherrypicks.lock` 에서 `modified:false`(= 우리가 안 고친 사본)인데
  // `!s.withEcc` 가 빠져 있었다. ECC 플러그인을 고른 사용자가 **같은 스킬을 두 판본** 받았고,
  // 어느 쪽이 로드되는지 예측할 수 없었다. C2 규칙(ADR-019)에 맞춘다.
  for (const sd of ["market-research", "investor-materials", "investor-outreach"]) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && onTracks("executive|full")(s),
    });
  }
  m.push({
    source: "skills/nextjs-turbopack",
    target: ".claude/skills/nextjs-turbopack",
    type: "dir",
    applies: (s) => !s.withEcc && onTracks("ssr-nextjs|full")(s),
  });
  // v26.87.0 — internal bundled skills (uzys 1st-party templates: dev-method + opt-in advisors,
  // v26.95.0). Whole-dir copy so sidecar files ship too (e.g. gemini-consult/scripts/gemini-ask.sh).
  // Gated on `selectedInternalSkills` (installer computes it via isAssetSelected) — NOT track alone —
  // so a wizard uncheck / `--without <id>` drops the copy, and opt-in ones copy only when selected.
  for (const sd of INTERNAL_BUNDLED_SKILL_IDS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => (s.selectedInternalSkills ?? []).includes(sd),
    });
  }
  // v26.58.0 — python-* / DEV_SKILL_DIRS / UI_SKILL_DIRS 중 ECC 출처는 opt-out gating. ADR-019. C2.
  for (const sd of PYTHON_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && anyTrack(s.tracks, "data|csr-fastapi|full"),
    });
  }
  for (const sd of DEV_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: dev,
    });
  }
  for (const sd of DEV_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && hasDevTrack(s.tracks),
    });
  }
  // C3 (modified=true). plugin 으로 갈음 불가 — verdict 어휘는 ECC plugin 판에 없다. ADR-041.
  for (const sd of MODIFIED_DEV_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: dev,
    });
  }
  for (const sd of UI_SKILL_DIRS) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: ui,
    });
  }
  for (const sd of UI_SKILL_DIRS_ECC) {
    m.push({
      source: `skills/${sd}`,
      target: `.claude/skills/${sd}`,
      type: "dir",
      applies: (s) => !s.withEcc && hasUiTrack(s.tracks),
    });
  }

  // Hooks
  for (const h of ALWAYS_HOOKS) {
    m.push({
      source: `hooks/${h}`,
      target: `.claude/hooks/${h}`,
      type: "file",
      applies: all,
    });
  }

  // settings.json
  m.push({
    source: "settings.json",
    target: ".claude/settings.json",
    type: "file",
    applies: all,
  });

  // Project root CLAUDE.md — handled outside manifest by `mergeProjectClaude`
  // (single/multi/full tracks all merged from fragments in installer.ts).

  return m;
}

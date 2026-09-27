/**
 * 기록 접근자 (#551 · ADR-097 Decision 1 · 설계 §1.2 "데이터 모델").
 *
 * 기록 네 필드(`policyFiles`(`.claude/` 상대) · `skillFiles`(`.claude/skills/` 상대) · `externalFiles` ·
 * `rootFiles`(프로젝트 상대))는 **그대로** 두고 이관하지 않는다. 경로 기준이 셋인 것을 여기 한 곳이 숨긴다.
 * 판정 함수(`judge`)는 이 접근자가 낸 상태 하나만 받는다.
 *
 * **옛 스캔 필드 필터(Q1).** v26.161.0 까지의 `policyFiles`·`skillFiles` 는 설치 뒤 디스크를 훑어 템플릿과 이름이
 * 같은 파일을 적은 값이라 설치자 파일이 섞여 있다(BLOCKER-5 · B2). 로그에 `records: "writer"` 가 없으면 그 두 필드의
 * 항목은 셋을 다 만족할 때만 기록으로 읽는다: ① claude 가 깔린 CLI 집합에 있다 ② 경로가 기록 트랙에서 나오는 하네스
 * 대상이다(manifest — 번들 스킬은 옵션 선택이 기록에 없으므로 전부) ③ `excluded` 에 없다. 걸린 항목은 "기록 없음" —
 * 지우지 않는 쪽이다. 새 판이 쓴 기록(`records: "writer"`)과 `externalFiles` · 앵커 sha 는 쓰는 순간 적은 값이라
 * 필터 없이 읽는다.
 *
 * **"기록 있음 · sha 없음"(`no-sha`)** = 로그가 그 경로의 소유 CLI 를 말하고(`cli-ownership.ts` 표 — 경로 접두)
 * 위 필터는 통과하는데 파일별 sha 만 없는 상태 — 체크섬 도입 전 판(#557). `claudeManaged`(`update-mode.ts`)를 다른
 * CLI 로 일반화한 것이다(A8). 새 판 로그에서는 생기지 않는다(쓰면 적으므로).
 *
 * 아직 어느 동작도 부르지 않는다 — 배선은 설계 §9 PR-3 이후. 동작 변경 0.
 */

import { adapterFor } from "./adapters/index.js";
import { classifyBaselineTarget } from "./baseline-targets.js";
import { CLI_OWNERSHIP } from "./cli-ownership.js";
import { INTERNAL_BUNDLED_SKILL_IDS } from "./external-assets.js";
import { type InstallLog, installedClis } from "./install-log.js";
import type { FileKind, Recorded } from "./judge.js";
import { buildManifest } from "./manifest.js";
import { CLI_BASES, type CliBase, isTrack } from "./types.js";

export type { Recorded } from "./judge.js";

const CLAUDE_DIR = ".claude/";
/** 넘겨준 파일의 자리 — 스캐폴드(결정 5·7 · ADR-037)와 `npx skills` 가 만드는 잠금 파일(설계 §2 행 29). */
const ADVISORY_PATHS = [".env.example", ".github/workflows/", "skills-lock.json"];
const SKILLS_DIR = ".claude/skills/";

/**
 * 설치자가 뺀 것 한 목록 — 새 `excluded` + 옛 `spec.baselineExclude` · `spec.skillExclude`(읽기 폴백).
 * 옛 두 필드는 누적하지 않던 값이라 합집합으로 읽는다(다음 쓰기부터 `excluded` 한 곳으로).
 */
export function excludedIds(log: InstallLog | null): Set<string> {
  if (log === null) return new Set();
  return new Set([
    ...(log.excluded ?? []),
    ...(log.spec.baselineExclude ?? []),
    ...(log.spec.skillExclude ?? []),
  ]);
}

/** 이 경로를 쓰는 CLI — 소유 표의 경로가 같거나 `/` 로 끝나는 접두면 그 CLI(N3). */
export function ownersOf(path: string): CliBase[] {
  return CLI_BASES.filter((cli) =>
    CLI_OWNERSHIP[cli].some(
      (o) => o.path === path || (o.path.endsWith("/") && path.startsWith(o.path)),
    ),
  );
}

/**
 * 기록 트랙으로 하네스가 쓰는 대상인가 — manifest 에서 유도(파일은 같은 경로, 디렉터리는 그 아래).
 * 번들 스킬은 옵션 선택이 기록에 없으므로 전부 대상으로 본다(설계 §1.2).
 */
export function isRecordedTrackTarget(log: InstallLog, path: string): boolean {
  const spec = {
    tracks: log.spec.tracks.filter(isTrack),
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS,
  };
  // manifest 는 모든 항목을 `applies` 술어와 함께 낸다 — 기록 트랙에 걸리는 것만 대상이다
  return buildManifest(spec).some(
    (e) =>
      e.applies(spec) && (e.type === "dir" ? path.startsWith(`${e.target}/`) : e.target === path),
  );
}

function isExcludedPath(path: string, excluded: ReadonlySet<string>): boolean {
  const baseline = classifyBaselineTarget(path);
  if (baseline === null) return false;
  return excluded.has(baseline.id) || (baseline.kind === "skills" && excluded.has(baseline.name));
}

export interface RecordedOptions {
  /**
   * 이 경로가 하네스 대상인가 — 옛 스캔 필드 필터 ② 와 `no-sha` 판정에 쓴다. 생략하면 manifest(기록 트랙 ·
   * 번들 스킬 전부)에서 유도한다 — 그러면 codex·opencode·antigravity 쪽 경로는 대상으로 알 수 없어 `no-sha` 가
   * 나오지 않는다(안전한 쪽 — 그 CLI 의 산출물은 v26.133.0 부터 `externalFiles` 에 sha 로 적혀 있다). 호출부가
   * 그 CLI 의 렌더에서 대상 목록을 가질 때 넘긴다.
   */
  isTarget?: (path: string) => boolean;
}

/**
 * 경로 하나의 기록 상태. `path` 는 프로젝트 상대(`/` 구분).
 *
 * 순서: `externalFiles`(sha) → 앵커 sha(`templates.rootClaudeMd`) → `skillFiles`·`policyFiles`(옛 판이면 필터) →
 * `rootFiles`(displaced 제외 — 비켜 둔 기록은 소유가 아니다) → 로그 수준 소유(`no-sha`) → `none`.
 */
export function recorded(
  log: InstallLog | null,
  path: string,
  opts: RecordedOptions = {},
): Recorded {
  if (log === null) return { state: "none" };
  const writer = log.records === "writer";
  const excluded = excludedIds(log);
  const clis = installedClis(log);
  const isTarget = opts.isTarget ?? ((p: string) => isRecordedTrackTarget(log, p));
  const legacyOwned = () =>
    clis.includes("claude") && isTarget(path) && !isExcludedPath(path, excluded);

  const external = log.externalFiles?.find((f) => f.path === path);
  if (external) return { state: "sha", sha256: external.sha256 };

  const anchor = log.templates.rootClaudeMd;
  if (anchor?.path === path) return { state: "sha", sha256: anchor.sha256 };

  const scanned = path.startsWith(SKILLS_DIR)
    ? log.skillFiles?.find((f) => f.path === path.slice(SKILLS_DIR.length))
    : path.startsWith(CLAUDE_DIR)
      ? log.policyFiles?.find((f) => f.path === path.slice(CLAUDE_DIR.length))
      : undefined;
  if (scanned) {
    if (writer || legacyOwned()) return { state: "sha", sha256: scanned.sha256 };
    return { state: "none" }; // 필터에 걸린 옛 항목 — 기록 없음(지우지 않는 쪽)
  }

  const root = log.rootFiles?.find((f) => f.path === path && f.change !== "displaced");
  if (root) return { state: "no-sha" };

  if (writer) return { state: "none" };
  const owners = ownersOf(path);
  const ownedByLog = owners.some((c) => clis.includes(c));
  const claudePath = path.startsWith(CLAUDE_DIR);
  if (ownedByLog && isTarget(path) && (!claudePath || legacyOwned())) return { state: "no-sha" };
  return { state: "none" };
}

/**
 * 파일 종류 유도(설계 §1.2) — 어댑터 표에 있는 경로 = `shared` · 넘겨준 파일 = `advisory` · 그 밖 = `harness`.
 * `tool` 은 경로가 아니라 자산(`assets[]`)에서 나오므로 여기서 내지 않는다.
 *
 * `advisory` 는 기록(`rootFiles.change === "advisory"`)과 **스캐폴드 경로**(`.github/workflows/*` ·
 * `.env.example` · `skills-lock.json`)로 판정한다 — 옛 로그는 스캐폴드를 `created` 로 적었고(결정 5·7 이전),
 * 그것을 harness 로 읽으면 uninstall 이 설치자 CI 를 지운다.
 */
export function kindOf(log: InstallLog | null, path: string): FileKind {
  if (adapterFor(path) !== null) return "shared";
  if (isScaffoldPath(path)) return "advisory";
  if (log?.rootFiles?.some((f) => f.path === path && f.change === "advisory")) return "advisory";
  return "harness";
}

function isScaffoldPath(path: string): boolean {
  return ADVISORY_PATHS.some((p) => (p.endsWith("/") ? path.startsWith(p) : path === p));
}

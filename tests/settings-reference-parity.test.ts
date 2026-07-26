import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS, isAssetSelected } from "../src/external-assets.js";
import { type AssetSpec, buildManifest } from "../src/manifest.js";
import { DEFAULT_OPTIONS, TRACKS } from "../src/types.js";

/**
 * **항상 깔리는 파일이, 자기보다 좁게 깔리는 경로를 실행 참조하지 않는가.**
 *
 * 계기(M-1): `templates/settings.json` 의 PreToolUse(`Write|Edit`) 훅이
 * `.claude/skills/strategic-compact/suggest-compact.sh` 를 **무조건** 참조한다. 그런데
 * settings.json 은 `applies: all`(`src/manifest.ts`)이고 그 스킬은 `COMMON_SKILL_DIRS_ECC`
 * → `applies: (s) => !s.withEcc` 다. 실측:
 *
 *   withEcc=false  settings.json ✓  strategic-compact ✓
 *   withEcc=true   settings.json ✓  strategic-compact ✗   ← 훅이 없는 파일을 가리킨다
 *
 * 이 결함이 살아남은 이유가 이 게이트를 만드는 이유다 — 이 리포 자신이 `withEcc=false` 로
 * 도그푸드해서 그 스크립트가 **로컬에는 존재한다.** 로컬 값과 배포 조건이 우연히 갈라져
 * 영원히 안 보이는 형태(`no-false-ship` §"게이트 자신도 환경에 따라 달라지는 값을
 * 하드코딩하지 않는다")이고, 그래서 판정을 **디스크가 아니라 manifest** 로 한다.
 *
 * 부류 = "설치 조건이 넓은 파일 → 좁은 경로로의 실행 참조". 개별 참조를 잡는 게 아니다.
 *
 * ## 열거하지 않는 것 (`no-false-ship` §"게이트는 열거하지 말고 훑어라")
 *
 * - **참조 목록** — settings.json 을 파싱해 **문서 전체를 재귀 순회**하며 `$CLAUDE_PROJECT_DIR/…`
 *   를 긁는다. 훅 이벤트 이름(`PreToolUse`…)도, 최상위 키도 적지 않는다. `hooks` 아래만 보지
 *   않는 이유: `$CLAUDE_PROJECT_DIR` 참조는 어느 키에 있든 같은 위험이고, 키를 고르는 순간
 *   그 선택이 두 번째 하드코딩 사본이 된다.
 * - **제공자 목록** — `buildManifest(spec)` 의 `target` 에서 derive.
 * - **spec 목록** — `TRACKS` × `AssetSpec` 의 게이팅 필드 곱. 상수 배열을 복사하지 않는다.
 *
 * ## 면제는 표식 있는 쪽에서 증명한다 (기본값 = 검사)
 *
 * 함의가 깨지는 참조라도, **런타임 치유기가 그 참조 문자열을 실제로 인식하면** 통과시킨다 —
 * 그때는 설치/갱신이 죽은 훅을 지우고 그 사실을 화면에 보고하기 때문이다. 판정은 말이 아니라
 * `keepHookRef` 를 **직접 호출**해서 얻는다. 그래서 치유기가 못 무는 형태(`.js`/`.py` 참조,
 * `.claude/` 밖 경로)를 넣으면 **작성 시점에** 빨간불이 난다 — 지금 이 결함이 빠져나간 틈이다.
 *
 * ## 구현 레인 전제 (RED 사유)
 *
 * `keepHookRef` 는 현재 `src/update-mode.ts` 의 **모듈 내부 함수라 export 되지 않는다.**
 * 이 게이트는 그 export 를 전제로 쓰였다. export 가 없으면 어떤 참조도 면제되지 않으므로
 * 게이트는 함의 위반을 그대로 보고한다(= 지금 빨간불). 정적 import 대신 동적 import + 캐스트를
 * 쓴 이유는 하나다 — 정적 import 는 export 가 생기기 전까지 **파일 전체를 로드 실패**시켜
 * 아래 헛통과 차단 단언까지 같이 죽이고, 그러면 "왜 빨간불인가"가 화면에서 사라진다.
 */

const REPO_ROOT = resolve(__dirname, "..");

/** manifest 의 source 키. 이 게이트가 읽는 **바로 그 파일**이라 상수 하나는 불가피하다. */
const SETTINGS_SOURCE = "settings.json";
const SETTINGS_TEMPLATE = join(REPO_ROOT, "templates", SETTINGS_SOURCE);

// ── 참조 쪽 ────────────────────────────────────────────────────────────────────

/** 문서 전체에서 문자열만 모은다. 키 이름·중첩 구조를 열거하지 않기 위한 재귀. */
function collectStrings(node: unknown, out: string[]): void {
  if (typeof node === "string") {
    out.push(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const v of node) collectStrings(v, out);
    return;
  }
  if (node !== null && typeof node === "object") {
    for (const v of Object.values(node)) collectStrings(v, out);
  }
}

interface Reference {
  /** 프로젝트 루트 기준 상대경로 (`$CLAUDE_PROJECT_DIR/` 뒤). */
  path: string;
  /** 참조를 담고 있던 원본 command — 치유기 판정에 그대로 넘긴다. */
  command: string;
}

/** `$CLAUDE_PROJECT_DIR/<path>` — `${...}` 표기와 인용부호 종료를 함께 다룬다. */
const PROJECT_DIR_REF = /\$\{?CLAUDE_PROJECT_DIR\}?\/([^"'\s]+)/g;

/**
 * @param settingsPath 기본값은 실 템플릿. **변이 canary 만** 다른 경로를 넘긴다 — 그 사본도
 *   손으로 쓴 픽스처가 아니라 이 파일에서 파생한 것이다 (아래 §변이 canary).
 */
function referencesFromSettings(settingsPath: string = SETTINGS_TEMPLATE): Reference[] {
  const strings: string[] = [];
  collectStrings(JSON.parse(readFileSync(settingsPath, "utf8")), strings);
  const refs: Reference[] = [];
  for (const command of strings) {
    for (const m of command.matchAll(PROJECT_DIR_REF)) {
      if (m[1]) refs.push({ path: m[1], command });
    }
  }
  return refs;
}

// ── 제공 쪽 ────────────────────────────────────────────────────────────────────

interface SpecCase {
  label: string;
  spec: AssetSpec;
}

/**
 * spec 매트릭스 = `TRACKS` × **`AssetSpec` 의 게이팅 필드 전부**의 곱.
 *
 * `withEcc` 를 반드시 양쪽으로 도는 것이 이 게이트의 핵심이다. 선례
 * (`tests/resident-doc-asset-reachability.test.ts` 의 `specFor`)는 기본 설치만 만들어
 * `withEcc` 가 **항상 false** 였고, 그래서 이 부류를 통째로 못 봤다. 같은 실수를 반복하지 않는다.
 *
 * `selectedInternalSkills` 를 빈 목록으로도 도는 이유: wizard uncheck / `--without <id>` 가
 * 그 상태를 만든다. `withTauri` 도 같은 이유로 양쪽 — 필드를 골라 빼면 그 선택이 다음 서식지가 된다.
 */
function specMatrix(): SpecCase[] {
  const cases: SpecCase[] = [];
  for (const track of TRACKS) {
    const ctx = { tracks: [track], options: DEFAULT_OPTIONS };
    const defaultSkills = INTERNAL_BUNDLED_SKILL_IDS.filter((id) => isAssetSelected(id, ctx));
    for (const withEcc of [false, true]) {
      for (const withTauri of [false, true]) {
        for (const skills of [defaultSkills, [] as ReadonlyArray<string>]) {
          cases.push({
            label: `${track} withEcc=${withEcc} withTauri=${withTauri} skills=${skills.length}`,
            spec: { tracks: [track], withEcc, withTauri, selectedInternalSkills: skills },
          });
        }
      }
    }
  }
  return cases;
}

/** 참조 경로를 실제로 깔아 주는 manifest 엔트리가 이 spec 에 있는가. dir 엔트리는 prefix 매치. */
function isProvided(spec: AssetSpec, refPath: string): boolean {
  return buildManifest(spec).some(
    (e) => e.applies(spec) && (refPath === e.target || refPath.startsWith(`${e.target}/`)),
  );
}

/** referrer(settings.json) 자신이 이 spec 에 깔리는가. */
function referrerApplies(spec: AssetSpec): boolean {
  const entry = buildManifest(spec).find((e) => e.source === SETTINGS_SOURCE);
  return entry ? entry.applies(spec) : false;
}

// ── 면제 판정 (런타임 치유기) ──────────────────────────────────────────────────

type KeepHookRef = (hook: { command?: string }, claudeDir: string, removed: string[]) => boolean;

/**
 * 위 헤더 §"구현 레인 전제" 참조. export 가 생기면 이 캐스트는 정적 import 로 바꿔도 된다.
 * 캐스트 사유를 한 줄로 남기는 이유는 `code-style` §타입 강도.
 */
async function loadKeepHookRef(): Promise<KeepHookRef | null> {
  const mod = (await import("../src/update-mode.js")) as unknown as {
    keepHookRef?: KeepHookRef;
  };
  return typeof mod.keepHookRef === "function" ? mod.keepHookRef : null;
}

/**
 * 치유기가 이 참조를 **문다**(= 파일이 없으면 지운다)면 면제. 비어 있는 `.claude/` 를 기준으로
 * 물어보므로 "인식했다"와 "제거한다"가 같은 답이 된다.
 */
function healerRemoves(keep: KeepHookRef, command: string, emptyClaudeDir: string): boolean {
  return keep({ command }, emptyClaudeDir, []) === false;
}

// ── 판정 ──────────────────────────────────────────────────────────────────────

/** 위반을 참조 단위로 요약. spec 을 낱개로 뿌리면 같은 사실이 수십 줄로 불어난다. */
function violationSummaries(
  keep: KeepHookRef | null,
  emptyClaudeDir: string,
  refs: Reference[] = referencesFromSettings(),
): string[] {
  const matrix = specMatrix();
  const summaries: string[] = [];
  for (const ref of refs) {
    if (keep && healerRemoves(keep, ref.command, emptyClaudeDir)) continue; // 표식 = 치유기가 문다
    const broken = matrix.filter((c) => referrerApplies(c.spec) && !isProvided(c.spec, ref.path));
    if (broken.length === 0) continue;
    summaries.push(
      `${ref.path} — settings.json 은 깔리는데 참조 대상은 안 깔리는 spec ${broken.length}건 ` +
        `(예: ${broken
          .slice(0, 3)
          .map((c) => c.label)
          .join(" / ")})`,
    );
  }
  return summaries;
}

// ── 변이 canary (입력 변이) ───────────────────────────────────────────────────

/**
 * `변이 테스트` = **입력 변이** (이 리포 확정 어휘). 이 게이트의 입력은 `templates/settings.json`
 * 이므로, 그 파일을 **파생 변형**한 사본에 같은 판정 함수를 걸어 위반이 실제로 잡히는지 본다.
 * 리포의 실제 템플릿은 건드리지 않는다.
 *
 * **손으로 픽스처를 쓰지 않는 이유**: 손으로 쓴 JSON 은 "게이트가 픽스처만 물고 진짜 파일은
 * 못 무는" 상태를 못 거른다. 실 파일에서 파생하면 템플릿 표기가 바뀌는 순간 변이도 같이 바뀐다.
 *
 * **왜 이 두 변이인가 — 게이트의 살아 있는 표면이 좁다.** 치유기가 `.claude/**.sh` 를 전부 물게
 * 된 지금, 함의문이 실제로 무는(=면제되지 않는) 참조는 두 부류뿐이다:
 *   ⓐ `.sh` 가 아닌 실행 참조 (`.js` / `.py`) — 치유기 regex 가 `.sh` 만 본다
 *   ⓑ `.claude/` 밖 경로 — 치유기가 보존하는 경계 (사용자 자기 스크립트)
 * ADR-057 Consequences 4 가 그렇게 적었다. 그 좁은 표면을 무는 canary 가 없으면, 다음에 이
 * 게이트가 죽어도 초록불만 보인다.
 */
type Mutation = "ext-swap" | "outside-claude";

/** `$CLAUDE_PROJECT_DIR/...` 참조에만 적용되는 파생 변형. 다른 문자열은 건드리지 않는다. */
function mutateCommand(command: string, mutation: Mutation): string {
  if (mutation === "ext-swap") {
    // ⓐ `.sh` → `.js`. 치유기는 `.sh` 만 인식하므로 면제되지 않는다.
    return command.replace(/(\$\{?CLAUDE_PROJECT_DIR\}?\/[^"'\s]+)\.sh/g, "$1.js");
  }
  // ⓑ `.claude/` → `scripts/`. 프로젝트 안이지만 하네스가 깔지 않는 경로로 옮긴다.
  return command.replace(/(\$\{?CLAUDE_PROJECT_DIR\}?\/)\.claude\//g, "$1scripts/");
}

function mutateStrings(node: unknown, mutation: Mutation): unknown {
  if (typeof node === "string") return mutateCommand(node, mutation);
  if (Array.isArray(node)) return node.map((v) => mutateStrings(v, mutation));
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([k, v]) => [k, mutateStrings(v, mutation)]),
    );
  }
  return node;
}

const tempDirs: string[] = [];

/** 실 템플릿에서 파생한 변이 사본 경로. */
function mutatedSettingsPath(mutation: Mutation): string {
  const dir = mkdtempSync(join(tmpdir(), `ch-refmut-${mutation}-`));
  tempDirs.push(dir);
  const path = join(dir, SETTINGS_SOURCE);
  const original = JSON.parse(readFileSync(SETTINGS_TEMPLATE, "utf8"));
  writeFileSync(path, JSON.stringify(mutateStrings(original, mutation), null, 2));
  return path;
}

describe("settings.json 참조 경로의 설치 파리티", () => {
  let emptyClaudeDir = "";
  beforeAll(() => {
    emptyClaudeDir = mkdtempSync(join(tmpdir(), "ch-refparity-"));
  });
  afterAll(() => {
    rmSync(emptyClaudeDir, { recursive: true, force: true });
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
  });

  it("settings.json 에서 참조를 실제로 긁는다 (헛통과 차단)", () => {
    // 추출이 0건이면 아래 단언들이 전부 공허하게 통과한다. 초록불이 무는지부터 확인한다.
    const refs = referencesFromSettings();
    expect(
      refs.length,
      `${SETTINGS_TEMPLATE} 에서 $CLAUDE_PROJECT_DIR 참조를 하나도 못 긁었다 — 추출기가 죽었거나 ` +
        "템플릿 표기가 바뀌었다. 어느 쪽이든 이 게이트는 아무것도 안 보고 있다.",
    ).toBeGreaterThan(0);
    expect(refs.every((r) => r.path.length > 0)).toBe(true);
  });

  it("spec 매트릭스가 비지 않고 withEcc 양쪽을 포함한다 (헛통과 차단)", () => {
    const matrix = specMatrix();
    expect(matrix.length).toBeGreaterThan(0);
    // 이 축이 없으면 게이트는 M-1 을 못 본다 — 선례가 정확히 그렇게 놓쳤다.
    expect(matrix.some((c) => c.spec.withEcc === true)).toBe(true);
    expect(matrix.some((c) => c.spec.withEcc === false)).toBe(true);
    expect(new Set(matrix.map((c) => c.spec.tracks[0])).size).toBe(TRACKS.length);
    // referrer 가 어느 spec 에도 안 깔리면 함의문이 공허참이 된다.
    expect(matrix.filter((c) => referrerApplies(c.spec)).length).toBeGreaterThan(0);
  });

  it("면제 판정이 런타임 치유기 자신에게서 나온다 (면제가 무조건 통과가 아님)", async () => {
    const keep = await loadKeepHookRef();
    expect(
      keep,
      "`keepHookRef` 가 src/update-mode.ts 에서 export 되지 않았다 — 면제를 '치유기가 실제로 " +
        "무는가'로 증명할 수 없다. 증명 수단이 없으면 면제도 없다(기본값 = 검사).",
    ).not.toBeNull();
    if (!keep) return;

    // 무는 쪽: `.claude/` 이하 스크립트 참조 — 파일이 없으므로 제거 판정이어야 한다.
    expect(
      healerRemoves(keep, 'bash "$CLAUDE_PROJECT_DIR/.claude/skills/x/y.sh"', emptyClaudeDir),
    ).toBe(true);
    // 안 무는 쪽: `.claude/` 밖 · `.sh` 아님. 여기까지 면제되면 게이트가 통째로 죽는다.
    expect(healerRemoves(keep, 'bash "$CLAUDE_PROJECT_DIR/scripts/mine.sh"', emptyClaudeDir)).toBe(
      false,
    );
    expect(
      healerRemoves(keep, 'node "$CLAUDE_PROJECT_DIR/.claude/skills/x/y.js"', emptyClaudeDir),
    ).toBe(false);
  });

  it("settings.json 이 깔리는 모든 spec 에서 그 참조 대상도 깔린다", async () => {
    const keep = await loadKeepHookRef();
    const summaries = violationSummaries(keep, emptyClaudeDir);
    expect(
      summaries,
      "settings.json(항상 설치)이 **자기보다 좁게 설치되는 경로**를 실행 참조한다 — 그 조합의\n" +
        "설치자는 없는 파일을 가리키는 훅을 매번 실행한다. 셋 중 하나로 닫아라:\n" +
        "  ⓐ 참조 대상의 설치 조건을 referrer 만큼 넓힌다,\n" +
        "  ⓑ 참조를 settings.json 에서 뺀다,\n" +
        "  ⓒ 런타임 치유기(`keepHookRef`)가 그 참조 문자열을 물게 한다 — 그러면 설치/갱신이\n" +
        "     죽은 훅을 지우고 그 사실을 화면에 보고한다(무음 no-op 은 면제가 아니다).\n" +
        summaries.map((s) => `  ${s}`).join("\n"),
    ).toEqual([]);
  });

  // ── 변이 canary — 이 게이트가 실제로 무는지 (초록불이 무는지부터 확인한다) ────

  it.each([
    [
      "변이 ⓐ: 참조 확장자를 `.sh` → `.js` 로 바꾸면 문다 (치유기가 못 무는 부류)",
      "ext-swap" as Mutation,
      ".js",
    ],
    [
      "변이 ⓑ: 참조를 `.claude/` 밖(`scripts/`)으로 옮기면 문다 (치유기가 보존하는 경계)",
      "outside-claude" as Mutation,
      "scripts/",
    ],
  ])("%s", async (_label, mutation, marker) => {
    const keep = await loadKeepHookRef();
    const mutatedRefs = referencesFromSettings(mutatedSettingsPath(mutation));
    const originalRefs = referencesFromSettings();

    // ① 픽스처가 **실제로 달라졌는지** 먼저. 변이가 원본과 같아지면(=canary 무력화) 아래 단언은
    //    "원본이 위반이다"를 주장하는 꼴이 되어 이 케이스가 통째로 무의미해진다.
    expect(mutatedRefs.length, "변이 사본에서 참조를 하나도 못 긁었다").toBe(originalRefs.length);
    expect(mutatedRefs.map((r) => r.path)).not.toEqual(originalRefs.map((r) => r.path));
    expect(mutatedRefs.every((r) => r.path.includes(marker))).toBe(true);

    // ② 치유기가 이 부류를 면제하지 않는다 — 여기가 게이트에 남은 살아 있는 표면이다.
    //    치유기가 무는 순간 이 canary 는 공허해지므로 그때는 이 케이스가 먼저 빨간불이 된다.
    if (keep) {
      expect(mutatedRefs.every((r) => !healerRemoves(keep, r.command, emptyClaudeDir))).toBe(true);
    }

    // ③ 그래서 함의 위반이 실제로 보고돼야 한다.
    const summaries = violationSummaries(keep, emptyClaudeDir, mutatedRefs);
    expect(
      summaries,
      "변이 사본이 위반인데 게이트가 아무 말도 안 했다 — 판정 함수가 죽었거나 면제가 너무 넓다.",
    ).not.toEqual([]);
  });
});

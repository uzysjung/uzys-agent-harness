import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS, isAssetSelected } from "../src/external-assets.js";
import { type AssetSpec, buildManifest } from "../src/manifest.js";
import { HARNESS_ANCHOR_FILE } from "../src/project-claude-merge.js";
import { DEFAULT_OPTIONS, TRACKS, type Track } from "../src/types.js";

/**
 * 상주 문서가 **앵커에 없는 `Rule N`** 을 지목하면 실패.
 *
 * 왜 필요한가: 앵커(`templates/CLAUDE.md` / 이 리포 `.claude/CLAUDE.md`)가 `Rule 1~12` 구조에서  (rule-ref:frozen)
 * 6원칙 구조로 교체됐다(ADR-055). 그 번호를 이름으로 부르던 상주 문서는 그 순간 **죽은 참조**가
 * 된다 — 설치자는 매 세션 "`CLAUDE.md` Rule 8 을 적용한 것"이라는 지시를 받는데 그 앵커에  (rule-ref:frozen)
 * Rule 8 이 없다. 이것은 `resident-doc-asset-reachability` 가 자산에 대해 막는 것과 같은 결함의  (rule-ref:frozen)
 * **번호 판본**이고, 그 게이트는 자산 id 만 보므로 이 경로를 못 본다.
 *
 * 판정은 **derive** 다 — "지금 앵커가 정의하는 Rule 번호 집합"을 앵커에서 뽑아 대조한다.
 * 그래서 앵커가 다시 `## Rule 7` 을 정의하면 Rule 7 참조는 자동으로 되살아나고, 게이트를 고칠  (rule-ref:frozen)
 * 필요가 없다. 번호 목록을 테스트에 적으면 그게 두 번째 하드코딩 사본이 된다.
 *
 * **면제는 경로 제외가 아니라 명시 표식으로** 한다(기본값 = 검사). 과거 기록으로 의도적으로 남기는
 * 지목은 그 줄에 `<!-- rule-ref:frozen -->` 를 단다 — `docs-supply-chain` 의 `catalog-total:frozen`
 * 과 같은 관용구. 경로를 통째로 빼면 그 경로가 다음 drift 서식지가 된다.
 */

const REPO_ROOT = resolve(__dirname, "..");

/** 같은 줄에 있어야 면제. 창(window)을 두면 무관한 표식이 옆 줄 지목까지 사면한다. */
const FROZEN_MARKER = "rule-ref:frozen";

/**
 * 파일 단위 면제. **사유를 같은 줄에 함께 적어야** 인정한다(빈 면제 금지).
 *
 * 왜 두 단위가 필요한가: `tests/**` 를 검사 범위에 넣으면 **합성 fixture** 가 잡힌다 — 예컨대
 * 임베드 렌더를 시험하는 테스트의 표본 CLAUDE.md 나, 이 게이트 자신의 탐지기 입력이다. 그것들은
 * 앵커를 지목하는 게 아니라 **문자열을 만들어 넣는 것**이라 죽은 참조가 아니다. 그런데 줄 단위
 * 표식을 쓰려면 표식이 **템플릿 리터럴 안**으로 들어가 fixture 내용을 바꿔 버린다(그러면 그
 * fixture 를 쓰는 단언이 다른 것을 재게 된다). 그래서 파일 단위 표식을 둔다.
 *
 * 대가는 정직하게: 파일 단위 면제는 **그 파일의 진짜 죽은 지목까지 같이 가린다.** 그래서 사유를
 * 강제하고, 면제된 파일 수를 단언으로 눌러 둔다(무언가 늘어나면 눈에 띄게).
 */
const FROZEN_FILE_MARKER = "rule-ref:frozen-file";
const FROZEN_FILE_REASON_MIN = 10;

/** 앵커가 `Rule N` 을 **정의**하는 형태 = 헤딩. 산문 언급은 정의가 아니다. */
const RULE_DEFINITION = /^#{1,6}\s*Rule\s+(\d+)\b/;

/** 문서가 `Rule N` 을 **지목**하는 형태. `Rule 1~12` 같은 범위는 양 끝을 다 지목으로 센다. */ // rule-ref:frozen
const RULE_REFERENCE = /Rule\s+(\d+)\s*(?:[–—~-]\s*(\d+))?/g;

interface DeadRef {
  doc: string;
  line: number;
  ruleNumber: number;
  anchor: string;
}

/** 앵커가 지금 정의하는 Rule 번호 집합. 비어 있으면 모든 `Rule N` 지목이 죽은 참조다. */
function definedRules(anchorText: string): Set<number> {
  const defined = new Set<number>();
  for (const line of anchorText.split("\n")) {
    const m = RULE_DEFINITION.exec(line);
    if (m?.[1]) defined.add(Number(m[1]));
  }
  return defined;
}

/**
 * 파일 단위 면제 여부. 표식 뒤에 사유가 `FROZEN_FILE_REASON_MIN` 자 이상 붙어 있어야 인정한다 —
 * 표식만 달아 두는 것을 막는다(느슨한 가드 전례: 임의 길이 상한·OR 매치로 두 번 새 봤다).
 */
function isFileFrozen(text: string): boolean {
  return text
    .split("\n")
    .some(
      (line) =>
        line.includes(FROZEN_FILE_MARKER) &&
        line.slice(line.indexOf(FROZEN_FILE_MARKER) + FROZEN_FILE_MARKER.length).trim().length >=
          FROZEN_FILE_REASON_MIN,
    );
}

/**
 * 한 문서에서 죽은 참조를 찾는다. 순수 함수라 canary(합성 입력)로 **무는지 먼저 보일 수 있다** —
 * 리포에 위반이 0건이면 초록불이 "깨끗함"인지 "탐지기가 죽음"인지 구분되지 않는다.
 */
function findDeadRefs(
  text: string,
  defined: Set<number>,
  doc = "<fixture>",
  anchor = "<anchor>",
): DeadRef[] {
  if (isFileFrozen(text)) return [];
  const out: DeadRef[] = [];
  text.split("\n").forEach((line, i) => {
    if (line.includes(FROZEN_MARKER)) return;
    for (const m of line.matchAll(RULE_REFERENCE)) {
      for (const raw of [m[1], m[2]]) {
        if (raw === undefined) continue;
        const n = Number(raw);
        if (defined.has(n)) continue;
        out.push({ doc, line: i + 1, ruleNumber: n, anchor });
      }
    }
  });
  return out;
}

/**
 * 상주 = 전문이 매 세션 들어오는 표면 (`resident-doc-asset-reachability` 와 같은 기준).
 *
 * 앵커 target 은 **리터럴로 적지 않는다** — P5(ADR-060)가 `.claude/CLAUDE.md` 에서 루트
 * `CLAUDE-uzys-harness.md` 로 옮겼을 때, 리터럴이면 이 게이트가 앵커를 조용히 놓쳤다
 * (실제로 아래 0-match canary 가 그 상태를 잡았다).
 */
function isResidentTarget(target: string): boolean {
  return target === HARNESS_ANCHOR_FILE || /^\.claude\/rules\/[^/]+\.md$/.test(target);
}

function specFor(track: Track): AssetSpec {
  const ctx = { tracks: [track], options: DEFAULT_OPTIONS };
  return {
    tracks: [track],
    withTauri: isAssetSelected("tauri-desktop", ctx),
    withEcc: isAssetSelected("ecc-plugin", ctx),
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS.filter((id) => isAssetSelected(id, ctx)),
  };
}

interface ResidentDoc {
  /** 리포 상대 경로 (보고용). */
  path: string;
  /**
   * 이 문서가 대조할 앵커들 — **합집합**으로 판정한다. 배송분은 배송 앵커, 리포 사본은 리포
   * 앵커, 게이트(`tests/**`)는 **둘 다**(어느 계열을 단언하는 테스트인지 파일마다 다르다).
   */
  anchors: string[];
}

/** `tests/**` 의 `.ts` 전부. 열거하지 않는다 — 새 게이트가 생겨도 자동으로 범위에 든다. */
function walkTests(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) walkTests(abs, acc);
    else if (entry.name.endsWith(".ts")) acc.push(abs);
  }
  return acc;
}

const SHIPPED_ANCHOR = "templates/CLAUDE.md";
const REPO_ANCHOR = ".claude/CLAUDE.md";

/**
 * 검사 대상 = **세 계열**. 어느 계열도 파일을 열거하지 않는다:
 *   ⓐ 배송 상주 문서 — `buildManifest` 에서 derive (새 룰이 생겨도 자동 포함).
 *   ⓑ 이 리포의 상주 사본 — `.claude/CLAUDE.md` + `.claude/rules/` 디렉터리 글롭.
 *   ⓒ **`tests/**` 전체** — v26.141.0 추가. 계기: `doc-governance-baseline-rule.test.ts` 가
 *      `expect(section).toContain("Rule 8")` 로 **없어진 이름을 리터럴로 물고 있었다.** 즉  (rule-ref:frozen)
 *      죽은 참조는 산문만의 문제가 아니고 **게이트 자신**이 그 서식지였다. 상주 문서만 보면 못 본다.
 *
 * 계열마다 앵커가 다르다: 배송분이 지목하는 `Rule N` 은 배송 앵커에 있어야 하고, 리포 사본이
 * 지목하는 것은 리포 앵커에 있어야 한다. 한쪽 앵커로 양쪽을 재면 한 계열이 조용히 면제된다.
 * `tests/**` 는 어느 계열을 단언하는지 파일마다 달라 **두 앵커의 합집합**으로 본다 — 더 관대한
 * 쪽이지만 지금 두 앵커 다 `Rule N` 을 정의하지 않으므로 판정력은 같다.
 */
function residentDocs(): ResidentDoc[] {
  const docs = new Map<string, ResidentDoc>();
  for (const track of TRACKS) {
    const spec = specFor(track);
    for (const e of buildManifest(spec).filter((x) => x.applies(spec))) {
      if (!isResidentTarget(e.target)) continue;
      const path = join("templates", e.source);
      if (existsSync(join(REPO_ROOT, path))) {
        docs.set(path, { path, anchors: [SHIPPED_ANCHOR] });
      }
    }
  }
  if (existsSync(join(REPO_ROOT, REPO_ANCHOR))) {
    docs.set(REPO_ANCHOR, { path: REPO_ANCHOR, anchors: [REPO_ANCHOR] });
  }
  const repoRules = join(REPO_ROOT, ".claude/rules");
  if (existsSync(repoRules)) {
    for (const f of readdirSync(repoRules).filter((f) => f.endsWith(".md"))) {
      const path = `.claude/rules/${f}`;
      docs.set(path, { path, anchors: [REPO_ANCHOR] });
    }
  }
  for (const abs of walkTests(__dirname)) {
    const path = `tests/${abs.slice(__dirname.length + 1)}`;
    docs.set(path, { path, anchors: [SHIPPED_ANCHOR, REPO_ANCHOR] });
  }
  return [...docs.values()];
}

function scanAll(): { violations: DeadRef[]; docs: ResidentDoc[]; frozenFiles: string[] } {
  const docs = residentDocs();
  const anchorCache = new Map<string, Set<number>>();
  const definedFor = (anchor: string): Set<number> => {
    let defined = anchorCache.get(anchor);
    if (!defined) {
      const abs = join(REPO_ROOT, anchor);
      defined = existsSync(abs) ? definedRules(readFileSync(abs, "utf8")) : new Set<number>();
      anchorCache.set(anchor, defined);
    }
    return defined;
  };
  const violations: DeadRef[] = [];
  const frozenFiles: string[] = [];
  for (const doc of docs) {
    const text = readFileSync(join(REPO_ROOT, doc.path), "utf8");
    if (isFileFrozen(text)) {
      frozenFiles.push(doc.path);
      continue;
    }
    // 합집합 판정 — 어느 앵커에라도 그 번호가 살아 있으면 지목은 유효하다.
    const defined = new Set(doc.anchors.flatMap((a) => [...definedFor(a)]));
    violations.push(...findDeadRefs(text, defined, doc.path, doc.anchors.join(" | ")));
  }
  return { violations, docs, frozenFiles };
}

describe("상주 문서의 Rule N 지목이 앵커에 살아 있는가", () => {
  it("탐지기가 canary 를 문다 (앵커에 없는 번호를 심으면 잡힌다)", () => {
    // 리포 위반이 0건일 때 초록불이 "깨끗함"인지 "탐지기 고장"인지 구분하는 유일한 수단.
    const fixture = [
      "intro line",
      '`CLAUDE.md` Rule 7("충돌을 드러내라") 를 적용한 것', // rule-ref:frozen
      "tail",
    ].join("\n");
    const hits = findDeadRefs(fixture, new Set());
    expect(hits.map((h) => [h.line, h.ruleNumber])).toEqual([[2, 7]]);
  });

  it("앵커가 그 번호를 정의하면 지목은 살아 있다 (derive 가 실제로 앵커를 본다)", () => {
    const fixture = "see Rule 7 for details"; // rule-ref:frozen
    expect(findDeadRefs(fixture, definedRules("## Rule 7 — Surface conflicts\nbody"))).toEqual([]); // rule-ref:frozen
    // 앵커가 6원칙 번호 헤딩(`## 1. Think`)만 가지면 `Rule 7` 은 여전히 죽은 참조다. (rule-ref:frozen)
    expect(findDeadRefs(fixture, definedRules("## 1. Think before coding\nbody"))).toHaveLength(1);
  });

  it("범위 표기(`Rule N~M` 형태)는 양 끝을 다 지목으로 센다", () => {
    // "위 Rule 1~12 보다 상위다" 형태가 실제 상주 문서에 있었다 — 앞 숫자만 세면 끝 번호가 샌다. (rule-ref:frozen)
    const forms = [
      "위 Rule 1~12 보다 상위다", // rule-ref:frozen
      "the Rule 1-12 layer", // rule-ref:frozen
      "Rule 1–12 live here", // rule-ref:frozen
    ];
    for (const form of forms) {
      expect(
        findDeadRefs(form, new Set()).map((h) => h.ruleNumber),
        form,
      ).toEqual([1, 12]);
    }
  });

  it("면제는 같은 줄의 표식만 인정한다 (느슨한 가드 차단)", () => {
    const marked = `과거엔 Rule 12 였다 <!-- ${FROZEN_MARKER} -->`; // rule-ref:frozen
    expect(findDeadRefs(marked, new Set())).toEqual([]);
    // 표식이 다른 줄에 있으면 사면되지 않는다 — 창을 두면 무관한 표식이 옆 줄을 덮는다.
    const elsewhere = `<!-- ${FROZEN_MARKER} -->\n과거엔 Rule 12 였다`; // rule-ref:frozen
    expect(findDeadRefs(elsewhere, new Set())).toHaveLength(1);
  });

  it("파일 단위 면제는 사유가 붙어야 인정한다 (빈 면제 차단)", () => {
    const body = "과거엔 Rule 12 였다"; // rule-ref:frozen
    // 표식만 달면 면제되지 않는다 — 사유 없는 면제는 "검사를 껐다"는 기록조차 남기지 않는다.
    expect(findDeadRefs(`// ${FROZEN_FILE_MARKER}\n${body}`, new Set())).toHaveLength(1);
    // 사유가 붙으면 파일 전체가 면제된다.
    expect(
      findDeadRefs(`// ${FROZEN_FILE_MARKER} — 합성 fixture 다\n${body}`, new Set()),
    ).toHaveLength(0);
  });

  it("검사 대상을 manifest + 리포 글롭 + tests 글롭에서 실제로 뽑는다", () => {
    const { docs } = scanAll();
    // 대상이 비면 "위반 0"이 참이 아니라 무의미해진다.
    expect(docs.length).toBeGreaterThan(10);
    expect(docs.some((d) => d.path === SHIPPED_ANCHOR)).toBe(true);
    expect(docs.some((d) => d.path === REPO_ANCHOR)).toBe(true);
    // `tests/**` 가 실제로 들어왔는가 — 이 파일 자신과 하위 디렉터리 파일이 있어야 한다.
    expect(docs.some((d) => d.path === `tests/${basename(__filename)}`)).toBe(true);
    expect(docs.some((d) => d.path.startsWith("tests/") && d.path.includes("/"))).toBe(true);
    // 세 계열이 서로 다른 앵커 조합을 본다 — 하나로 통일하면 한 계열이 조용히 면제된다.
    expect(new Set(docs.map((d) => d.anchors.join("|"))).size).toBe(3);
  });

  it("파일 단위 면제가 늘어나면 눈에 띈다 (면제 자체가 검사 대상)", () => {
    const { frozenFiles } = scanAll();
    // 면제는 편의가 아니라 예외다. 늘어날 때 이 단언이 먼저 빨간불이 되어 사유를 다시 묻게 한다.
    //
    // 현재 3건 = 임베드 렌더를 시험하는 **합성 fixture** 파일들(codex·opencode·antigravity).
    // 이 게이트 자신은 **파일 단위로 면제하지 않았다** — 줄 단위 표식으로 충분했고(모든 지목이
    // 한 줄에 있었다), 그래야 이 파일에 **새로** 들어오는 죽은 지목은 계속 잡힌다.
    expect(
      frozenFiles.sort(),
      "파일 단위 면제 목록이 바뀌었다 — 각 항목의 사유를 다시 확인하라",
    ).toHaveLength(3);
  });

  it("상주 문서·게이트에 죽은 Rule N 지목이 없다", () => {
    const { violations } = scanAll();
    const report = violations
      .map(
        (v) => `  ${v.doc}:${v.line}  →  Rule ${v.ruleNumber} (앵커 ${v.anchor} 에 그 번호가 없다)`,
      )
      .join("\n");
    expect(
      violations,
      "상주 문서 또는 게이트가 앵커에 없는 Rule 번호를 지목한다 — 설치자는 존재하지 않는 규칙을\n" +
        "매 세션 지시받고, 게이트는 없어진 이름을 리터럴로 물어 빨간불이 된다. 넷 중 하나로 처리하라:\n" +
        "ⓐ 현행 원칙 번호로 재지목 ⓑ 지목을 빼고 취지를 프로즈로 보존 " +
        `ⓒ 과거 기록이면 그 줄에 \`${FROZEN_MARKER}\` ` +
        `ⓓ 파일 전체가 합성 fixture 면 \`${FROZEN_FILE_MARKER} — <사유>\`:\n${report}`,
    ).toEqual([]);
  });
});

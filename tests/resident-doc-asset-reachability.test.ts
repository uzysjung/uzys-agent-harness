import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { type AssetSpec, buildAssetSpec, buildManifest } from "../src/manifest.js";
import { HARNESS_ANCHOR_FILE } from "../src/project-claude-merge.js";
import { DEFAULT_OPTIONS, TRACKS, type Track } from "../src/types.js";

/**
 * 상주 문서가 **그 트랙에 없는 자산**을 이름으로 지목하지 않는지.
 *
 * WHY: 같은 결함이 연속 두 번 났다. 상주 문서(설치자가 매 세션 무는 rules + CLAUDE.md)가
 * 자산을 이름으로 지목하는데 그 자산은 해당 트랙에 설치되지 않는 경우다 —
 *   ① UI 트랙 무조건 설치인 룰이 `--without` 으로 빠질 수 있는 스킬을 SSOT 로 지목,
 *   ② 전 트랙 설치인 CLAUDE.md 가 dev 트랙 전용 에이전트를 지목.
 * 결과는 둘 다 같다: **설치자가 존재하지 않는 대상에 대한 지시를 매 세션 받는다.**
 *
 * 판정은 리포에 파일이 있는지가 **아니라** `buildManifest` 로 한다. ①을 만들 때 "파일이
 * 존재하니 됐다"로 검사를 짰다가 초록불을 받았다 — 존재와 설치는 다른 사실이다.
 *
 * 검사 대상은 **열거하지 않는다**(`no-false-ship` "게이트는 열거하지 말고 훑어라").
 * 상주 문서 목록도, 자산 목록도 manifest 에서 derive 하므로 새 룰·새 자산이 생기면
 * 게이트를 고치지 않아도 자동으로 커버된다.
 */

const TEMPLATES = resolve(__dirname, "../templates");

/**
 * 비대화형 `--track <T>` **기본** 설치의 manifest 입력. installer 의 `buildManifestSpec` 와
 * 같은 방식으로 opt-in 자산 선택을 `isAssetSelected` 에 위임한다 — 여기에 자산 id 를 적어두면
 * 그게 두 번째 하드코딩 사본이 된다.
 *
 * 기본 설치를 기준선으로 삼는 이유: 지목이 위험해지는 것은 "평범하게 깔았는데 없더라"일 때다.
 * (그래서 opt-in 으로만 깔리는 문서 — 예: tauri — 는 어느 트랙에도 상주하지 않아 대상 밖이다.)
 */
function specFor(track: Track): AssetSpec {
  // 조립을 여기서 다시 쓰지 않는다 — 설치기와 같은 `buildAssetSpec` 을 부른다 (#320).
  // 전에는 이 함수가 그 본문을 줄 단위로 베끼고 있었다(독립 리뷰 적발).
  return buildAssetSpec({ tracks: [track], options: DEFAULT_OPTIONS });
}

/**
 * 검사 **모집단**을 넓히기 위한 두 번째 manifest 입력 — 번들 스킬을 전부 선택한 상태.
 *
 * WHY (#290, 변이 생존으로 발견): 모집단을 `specFor` 의 기본 설치분에서만 뽑으면 **어느 트랙에도
 * 기본 설치되지 않는 자산이 색인에 아예 없어** 아래 루프가 검사조차 하지 않는다. 자산이 더 많이
 * 부재할수록 게이트가 덜 신경 쓰는 역전이고, 가장 위험한 쪽 — 상주 문서가 이름을 부르는데 평범한
 * 설치에는 하나도 안 깔리는 자산 — 이 정확히 사각이었다.
 *
 * 여기서도 자산 id 를 열거하지 않는다(위 "게이트는 열거하지 말고 훑어라"). `INTERNAL_BUNDLED_SKILL_IDS`
 * 를 통째로 넘겨 derive 하므로 새 번들 스킬이 생겨도 게이트를 고칠 필요가 없다.
 *
 * 이 스펙이 주는 것은 **자리(빈 트랙 집합)뿐**이다 — 설치 트랙은 여전히 `specFor` 의 기본 설치분에서만
 * 채워지므로 opt-in 전용 자산은 `installedOn = ∅` 이 되어 상주 문서의 전 트랙이 미설치로 잡힌다.
 * 판정 기준선이 "평범하게 깔았을 때"라는 위 원칙은 그대로다.
 *
 * **`withTauri`·`withEcc` 를 켜지 않는 이유**(독립 검증이 지적 — 켠 채로 두면 이름과 반대로 돌았다):
 * `withTauri` 는 이 필드를 읽는 게이팅이 배포에 하나도 없어 무동작이고(`manifest.ts` 의 필드 주석),
 * `withEcc` 는 **opt-out** 축이라 켜면 오히려 C2 fallback 자산 10종이 빠진다(ADR-019 — 플러그인이
 * 켜지면 그쪽이 제공한다). 두 축 다 켜서 **얻는 자산이 0**이므로 켜지 않는다. `s.withEcc` 를 양의
 * 방향으로 읽는 게이팅이 생기면 그때 극성을 하나 더 돌면 된다 — 지금 없는 것을 위해 축을 늘리지 않는다.
 */
function populationSpecFor(track: Track): AssetSpec {
  return { tracks: [track], selectedInternalSkills: [...INTERNAL_BUNDLED_SKILL_IDS] };
}

/**
 * 설치 target → 자산 id. 문서가 실제로 이름으로 부르는 단위와 맞춘다
 * (`.claude/skills/x/SKILL.md` → `x`). 3자 이하 id(`ecc`)는 산문 오탐만 낳아 제외.
 */
function assetIdOf(target: string): string | null {
  const m = target.match(/^\.claude\/(?:rules|agents|skills|hooks|commands)\/([^/]+)/);
  if (!m?.[1]) return null;
  const id = m[1].replace(/\.(md|sh)$/, "");
  return id.length >= 4 ? id : null;
}

/**
 * 상주 = 전문이 매 세션 들어오는 표면. `context-cost.ts` 의 상주/발화 구분과 같은 기준.
 * 앵커 target 은 리터럴이 아니라 SSOT 상수에서 온다 (P5 · ADR-060 으로 경로가 옮겨졌다).
 */
function isResidentDoc(target: string): boolean {
  return target === HARNESS_ANCHOR_FILE || /^\.claude\/rules\/[^/]+\.md$/.test(target);
}

/** 트랙별 실제 설치분에서 derive 한 두 색인: 자산 id → 트랙들, 상주 문서 source → 트랙들. */
function buildIndexes(): {
  assetTracks: Map<string, Set<Track>>;
  docTracks: Map<string, Set<Track>>;
  docTarget: Map<string, string>;
} {
  const assetTracks = new Map<string, Set<Track>>();
  const docTracks = new Map<string, Set<Track>>();
  const docTarget = new Map<string, string>();
  for (const track of TRACKS) {
    const spec = specFor(track);
    for (const e of buildManifest(spec).filter((x) => x.applies(spec))) {
      const id = assetIdOf(e.target);
      if (id) {
        const set = assetTracks.get(id) ?? new Set<Track>();
        set.add(track);
        assetTracks.set(id, set);
      }
      if (isResidentDoc(e.target)) {
        const set = docTracks.get(e.source) ?? new Set<Track>();
        set.add(track);
        docTracks.set(e.source, set);
        docTarget.set(e.source, e.target);
      }
    }
    // 모집단 보강 — 선택하면 깔릴 수 있는 자산에 **자리만** 만든다(트랙 집합은 비운 채로).
    // 위 루프가 이미 담은 id 는 건드리지 않으므로 실제 설치 트랙은 그대로다.
    const population = populationSpecFor(track);
    for (const e of buildManifest(population).filter((x) => x.applies(population))) {
      const id = assetIdOf(e.target);
      if (id && !assetTracks.has(id)) assetTracks.set(id, new Set<Track>());
    }
  }
  return { assetTracks, docTracks, docTarget };
}

/**
 * **지목 = 참조 형태의 언급만.** 산문에 우연히 섞인 낱말(`database`, `reviewer`)까지 세면
 * 게이트가 오탐으로 죽는다. 문서가 자산을 가리킬 때 실제로 쓰는 네 형태만 본다:
 * 인라인 코드 · 파일명 · 종류를 붙인 호칭 · 설치 경로.
 */
function referenceRegex(id: string): RegExp {
  const e = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const kind = "스킬|룰|에이전트|훅|커맨드|skills?|rules?|agents?|hooks?|commands?";
  return new RegExp(
    `\`${e}(?:\\.(?:md|sh))?\`` +
      `|(?<![\\w-])${e}\\.(?:md|sh)(?![\\w-])` +
      `|(?<![\\w-])${e}\\s*(?:${kind})(?![\\w-])` +
      `|\\.claude/[a-z]+/${e}(?![\\w-])`,
    "i",
  );
}

/**
 * 부재를 명시했는가 — **면제 판정**.
 *
 * 기준: 지목이 **속한 블록** 안, 그리고 지목에서 ±`ACK_WINDOW` 자 안에 "없을 수 있음 + 그때
 * 무엇을 할지"를 뜻하는 조건/대안 표현이 있을 것. 근거는 두 사례의 실제 해결 문구다 —
 *   "Dev tracks ship an `implementer` agent; **without it** use a general-purpose subagent",
 *   "(UI **트랙이면** `benchmark-parity.md` … 다른 트랙엔 그 파일이 **없어** 이 한 줄이 SSOT)".
 * 즉 문서가 설치자에게 "없을 수도 있다"를 알려주면 지시가 허공을 가리키지 않는다.
 *
 * **두 제약을 함께 거는 이유**(#293, 변이 생존으로 발견). 창만으로는 **다른 항목의 조건절**이
 * 새어 들어와 면제로 쓰인다 — 실측: 앵커의 상주 스킬 목록에서 미설치 3트랙짜리 지목을 절 끝에
 * 한 줄 덧붙이면 다른 항목이 가진 `where installed` 가 그것까지 덮어 통과했다(그 조건절 끝에서
 * 새 지목까지 **122자** — 창 160 안이다. 같은 줄을 46줄 뒤에 넣으면 물었다: 차이는 위치뿐이었다).
 * 조건절이 촘촘한 구역일수록 통째로
 * 무면허가 되는 역전이라, 지목이 **자기 블록 안에서** 부재를 밝히도록 좁힌다.
 *
 * 반대로 블록만으로는 좁힐 수 없다: 마크다운 문단 하나가 길면 창보다 넓어진다. 그래서 창을
 * 없애지 않고 **교집합**을 쓴다 — 기존보다 넓어지는 경우가 없다. `없으면` 이 한국어 산문에
 * 흔하다는 원래 사유(`증거가 없으면`)는 그대로 유효하다.
 *
 * 한계는 정직하게 — 어휘 매칭이라 우회 가능하다. 이 게이트는 **말없이 지목하는 것**을 잡지
 * "성의 없는 면제 문구"를 잡지 못한다.
 */
const ACK_WINDOW = 160;
/**
 * v26.141.0 (ADR-055) — **간격 허용 대안 `where[^.]{0,60}installed` 추가.**
 *
 * 왜: 기존 목록은 전부 **인접 리터럴**이라 `where installed` 처럼 두 낱말이 붙어 있어야만 물었다.
 * 그런데 부재를 의미상 정확히 명시하는 문장이 그 사이에 목적어를 끼운다 —
 * *"Where the `asis-tobe-decision` and `explain-plainly` skills **are** installed, use them for this."*
 * 조건절 자체가 ack 인데 게이트는 **의미 대신 낱말의 인접 배열**을 세고 있었다. 그래서 배포 앵커가
 * 3개 트랙에서 위반으로 잡혔다. 처분은 문안이 아니라 게이트 — 사용자 승인 문안을 게이트에 맞춰
 * 비틀지 않는다.
 *
 * **완화가 아닌 이유**: ack 를 아예 지우면 여전히 빨간불이다(음성 대조로 확인). 늘어난 것은
 * "조건절 안에 목적어가 들어갈 자리"뿐이다.
 *
 * 상한 60자 · `[^.]`(마침표 불포함)의 근거: 문장을 넘어가면 `where` 와 `installed` 가 **다른 주장**에
 * 속한다. 무제한(`[\s\S]*`)으로 두면 문서 어딘가의 `where` 와 저 멀리의 `installed` 가 짝지어져
 * ±`ACK_WINDOW` 안의 모든 지목이 사면된다 — 그건 게이트를 죽이는 것이다.
 */
const ABSENCE_ACK =
  /없으면|없어|없는 트랙|미설치|설치돼 있으면|설치되어 있으면|트랙이면|트랙에만|트랙 한정|without it|if (?:it (?:is|'s) )?(?:not )?(?:installed|present|available)|if absent|if unavailable|where installed|where[^.]{0,60}installed|falls? back to/i;

/** 블록 경계로 쓰는 줄 — 빈 줄 · 헤딩 · 새 리스트 항목 머리. */
const BLOCK_START = /^\s*(?:[-*+]|\d+\.)\s/;
const BLOCK_BREAK = /^\s*$|^#{1,6}\s/;

/**
 * ack 를 찾을 범위 — 지목이 속한 **마크다운 블록** ∩ 지목 ±`ACK_WINDOW`.
 *
 * 블록 = 리스트 항목 하나(이어지는 들여쓴 줄 포함) 또는 문단 하나. 경계는 빈 줄 · 헤딩 ·
 * 다음 리스트 항목 머리다. 이웃 항목의 조건절을 빌려 쓰지 못하게 하는 것이 목적이므로
 * 항목 단위가 최소 단위다 — 문단으로 자르면 앵커의 상주 스킬 목록처럼 빈 줄 없이 이어진
 * 항목들이 한 덩어리가 되어 지금과 똑같이 샌다.
 */
function ackScope(text: string, at: number, len: number): string {
  const lines = text.split("\n");
  const offset: number[] = [];
  for (let i = 0, o = 0; i < lines.length; i++) {
    offset.push(o);
    o += (lines[i] ?? "").length + 1;
  }
  const lineAt = (pos: number): number => {
    let i = 0;
    while (i + 1 < offset.length && (offset[i + 1] ?? 0) <= pos) i++;
    return i;
  };

  let s = lineAt(at);
  while (s > 0 && !BLOCK_START.test(lines[s] ?? "")) {
    const prev = lines[s - 1] ?? "";
    if (BLOCK_BREAK.test(prev)) break;
    s--;
  }
  let e = lineAt(at + len);
  while (e + 1 < lines.length) {
    const next = lines[e + 1] ?? "";
    if (BLOCK_BREAK.test(next) || BLOCK_START.test(next)) break;
    e++;
  }

  const blockStart = offset[s] ?? 0;
  const blockEnd = (offset[e] ?? 0) + (lines[e] ?? "").length;
  return text.slice(
    Math.max(blockStart, at - ACK_WINDOW),
    Math.min(blockEnd, at + len + ACK_WINDOW),
  );
}

interface Violation {
  doc: string;
  line: number;
  asset: string;
  missing: Track[];
}

/**
 * `inject` = 판정 직전에 문서 본문을 갈아끼우는 훅. **테스트 전용**이며 기본은 없다.
 *
 * WHY: 면제 범위를 `ackScope` 로 옮겼는데, 아래 호출부를 옛 창 방식으로 되돌리면 `ackScope` 는
 * 정의만 남아 어떤 게이트도 물지 않았다(독립 검증 T0 — vitest·biome·tsc 전부 초록). 헬퍼를
 * 단언하는 것과 **게이트가 그 헬퍼를 실제로 쓰는지**를 단언하는 것은 다른 일이다. 합성 본문을
 * 이 경로에 태워야 호출부까지 잠긴다.
 */
function findViolations(inject?: (target: string, text: string) => string): {
  violations: Violation[];
  references: number;
} {
  const { assetTracks, docTracks, docTarget } = buildIndexes();
  const violations: Violation[] = [];
  let references = 0;

  for (const [source, tracks] of docTracks) {
    const abs = join(TEMPLATES, source);
    if (!existsSync(abs)) continue;
    const raw = readFileSync(abs, "utf8");
    const text = inject ? inject(docTarget.get(source) ?? "", raw) : raw;
    const selfId = source.replace(/^rules\//, "").replace(/\.md$/, "");

    for (const [asset, installedOn] of assetTracks) {
      if (asset === selfId) continue; // 자기 참조는 항상 도달 가능
      const re = new RegExp(referenceRegex(asset).source, "gi");
      for (const m of text.matchAll(re)) {
        references += 1;
        const missing = [...tracks].filter((t) => !installedOn.has(t));
        if (missing.length === 0) continue;
        const at = m.index ?? 0;
        if (ABSENCE_ACK.test(ackScope(text, at, m[0].length))) continue;
        violations.push({
          doc: source,
          line: text.slice(0, at).split("\n").length,
          asset,
          missing: missing.sort(),
        });
      }
    }
  }
  return { violations, references };
}

describe("상주 문서가 지목하는 자산의 도달 가능성", () => {
  it("지목을 실제로 찾아낸다 (헛통과 차단)", () => {
    // 참조 탐지가 깨지면 아래 단언이 전부 공허하게 통과한다. 초록불이 무는지부터 확인한다.
    // 하한은 **0-match 함정을 막는 canary 이지 커버리지 최소선이 아니다** — 모수(상주 룰 21→10,
    // 2026-08-02 정비 → 7, 2026-08-04 #284)가 줄면 지목 수도 함께 줄므로 하한도 같이 내린다.
    const { references } = findViolations();
    // 실측 3 (2026-08-12 — `playwright-launch` 가 스킬로 흡수되며 그 룰이 갖고 있던 지목 2건이
    // 함께 빠졌다. #290 보강 직후는 5였다). 하한을 실측 바로 아래로 조인다 — 아래 `docTracks`
    // 하한과 같은 기준이다: 한 건만 소실돼도 무는 하한이라야 canary 다.
    expect(references).toBeGreaterThan(2);
  });

  it("설치 대상 자산과 상주 문서를 manifest 에서 실제로 뽑는다", () => {
    // 색인이 비면 "위반 0"이 참이 아니라 무의미해진다.
    const { assetTracks, docTracks } = buildIndexes();
    expect(assetTracks.size).toBeGreaterThan(20);
    // #290 canary — **어느 트랙에도 기본 설치되지 않는 자산**이 색인 안에 자리를 갖고 있어야 한다.
    // 이 자리가 비면 모집단이 다시 "실제 설치분"으로 좁아진 것이고, 그 순간 게이트는 가장 위험한
    // 부류(평범하게 깔았을 때 전 트랙 부재)를 통째로 검사하지 않는다 — 변이가 살아났던 상태다.
    const zeroTrack = [...assetTracks].filter(([, ts]) => ts.size === 0).map(([id]) => id);
    expect(
      zeroTrack.length,
      "기본 설치 트랙이 0인 자산이 색인에 하나도 없다 — 모집단이 실제 설치분으로 좁아졌다는 뜻이고,\n" +
        "그러면 상주 문서가 그런 자산을 이름으로 불러도 이 게이트는 검사조차 하지 않는다 (#290).",
    ).toBeGreaterThan(0);
    // 하한은 **0-match 함정을 막는 canary 이지 커버리지 최소선이 아니다** — 상주 문서 모수가
    // 21(룰 20 + 앵커) → 9(룰 8 + 앵커) → 8(룰 7 + 앵커, #284) → 7(룰 6 + 앵커, 2026-08-12 에
    // `playwright-launch` 가 스킬로 이동)로 줄었다.
    expect(docTracks.size).toBeGreaterThan(6); // 모수 7 — 리뷰 MEDIUM-4: 절반 소실도 놓치는 하한은 canary 가 아니다
    // 전 트랙 상주 문서가 존재해야 이 게이트가 노리는 비대칭(전 트랙 문서 → 일부 트랙 자산)이 성립.
    expect([...docTracks.values()].some((s) => s.size === TRACKS.length)).toBe(true);
  });

  it("면제 판정이 이웃 블록의 조건절로 새지 않는다", () => {
    // #293 — 창만 쓰던 시절에는 **다른 항목의** 조건절이 면제로 쓰였다(실측: 121자 떨어진
    // 이웃 항목의 `where installed` 가 새 지목을 덮었다). 합성 입력으로 계약을 고정한다.
    const list = [
      "- `alpha`, where installed — 첫 항목은 자기 조건절을 갖는다.",
      "  이어지는 들여쓴 줄도 같은 항목이다.",
      "- `beta` — 두 번째 항목은 조건절을 적지 않았다.",
    ].join("\n");
    const inScope = (text: string, needle: string) =>
      ABSENCE_ACK.test(ackScope(text, text.indexOf(needle), needle.length));

    expect(inScope(list, "`alpha`"), "자기 블록의 조건절은 면제로 인정한다").toBe(true);
    expect(inScope(list, "`beta`"), "이웃 항목의 조건절을 빌려 쓰지 못한다").toBe(false);

    // 항목이 여러 줄이면 이어지는 줄의 조건절도 같은 블록이다 — 마크다운 구조를 존중한다.
    const wrapped = "- `gamma` — 설명이 길어 줄을 넘긴다.\n  없으면 범용 서브에이전트를 쓴다.";
    expect(inScope(wrapped, "`gamma`"), "같은 항목의 이어지는 줄은 자기 블록이다").toBe(true);
  });

  it("게이트가 그 좁은 범위를 실제로 쓴다 (판정 경로 전체)", () => {
    // 위 테스트는 `ackScope` 만 잠근다. 호출부를 옛 창 방식으로 되돌리면 헬퍼는 정의만 남아
    // 아무도 안 문다(독립 검증 T0 — vitest·biome·tsc 전부 초록이었다). 그래서 #293 의 원 재현을
    // **판정 경로 전체**에 태운다: 앵커 끝에 조건절 없는 지목을 한 줄 덧붙이면 위반이어야 한다.
    // 옛 창이면 122자 앞 항목의 `where installed` 가 이 줄까지 덮어 통과한다.
    const { violations } = findViolations((target, text) =>
      target === HARNESS_ANCHOR_FILE
        ? `${text}\n- Hand implementation to the \`implementer\` agent.\n`
        : text,
    );
    expect(
      violations.map((v) => v.asset),
      "앵커 끝에 덧붙인 지목이 이웃 항목의 조건절로 면제됐다 — 게이트가 좁은 범위를 안 쓰고 있다",
    ).toContain("implementer");
  });

  it("지목 대상이 없는 트랙이 있으면 문서가 그 부재를 명시한다", () => {
    const { violations } = findViolations();
    const report = violations
      .map((v) => `  ${v.doc}:${v.line}  →  ${v.asset} (미설치 트랙: ${v.missing.join(", ")})`)
      .join("\n");
    expect(
      violations,
      "상주 문서가 그 트랙에 설치되지 않는 자산을 이름으로 지목한다 — 설치자는 존재하지 않는\n" +
        "대상에 대한 지시를 매 세션 받는다. 지목을 빼거나, 부재를 명시하고 대안을 함께 적어라\n" +
        '(예: "없으면 범용 서브에이전트에 같은 계약으로"):\n' +
        report,
    ).toEqual([]);
  });
});

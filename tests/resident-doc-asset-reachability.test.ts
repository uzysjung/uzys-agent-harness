import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS, isAssetSelected } from "../src/external-assets.js";
import { type AssetSpec, buildManifest } from "../src/manifest.js";
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
  const ctx = { tracks: [track], options: DEFAULT_OPTIONS };
  return {
    tracks: [track],
    withTauri: isAssetSelected("tauri-desktop", ctx),
    withEcc: isAssetSelected("ecc-plugin", ctx),
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS.filter((id) => isAssetSelected(id, ctx)),
  };
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

/** 상주 = 전문이 매 세션 들어오는 표면. `context-cost.ts` 의 상주/발화 구분과 같은 기준. */
function isResidentDoc(target: string): boolean {
  return target === ".claude/CLAUDE.md" || /^\.claude\/rules\/[^/]+\.md$/.test(target);
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
 * 기준: 지목 지점 주변 ±`ACK_WINDOW` 자 안에 "없을 수 있음 + 그때 무엇을 할지"를 뜻하는
 * 조건/대안 표현이 있을 것. 근거는 두 사례의 실제 해결 문구다 —
 *   "Dev tracks ship an `implementer` agent; **without it** use a general-purpose subagent",
 *   "(UI **트랙이면** `benchmark-parity.md` … 다른 트랙엔 그 파일이 **없어** 이 한 줄이 SSOT)".
 * 즉 문서가 설치자에게 "없을 수도 있다"를 알려주면 지시가 허공을 가리키지 않는다.
 *
 * 범위를 문단이 아니라 좁은 창으로 잡는 이유: `없으면` 은 한국어 산문에 흔해서
 * (`증거가 없으면`) 멀리 떨어진 무관한 표현이 면제로 오인된다.
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

interface Violation {
  doc: string;
  line: number;
  asset: string;
  missing: Track[];
}

function findViolations(): { violations: Violation[]; references: number } {
  const { assetTracks, docTracks } = buildIndexes();
  const violations: Violation[] = [];
  let references = 0;

  for (const [source, tracks] of docTracks) {
    const abs = join(TEMPLATES, source);
    if (!existsSync(abs)) continue;
    const text = readFileSync(abs, "utf8");
    const selfId = source.replace(/^rules\//, "").replace(/\.md$/, "");

    for (const [asset, installedOn] of assetTracks) {
      if (asset === selfId) continue; // 자기 참조는 항상 도달 가능
      const re = new RegExp(referenceRegex(asset).source, "gi");
      for (const m of text.matchAll(re)) {
        references += 1;
        const missing = [...tracks].filter((t) => !installedOn.has(t));
        if (missing.length === 0) continue;
        const at = m.index ?? 0;
        const around = text.slice(Math.max(0, at - ACK_WINDOW), at + m[0].length + ACK_WINDOW);
        if (ABSENCE_ACK.test(around)) continue;
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
    const { references } = findViolations();
    expect(references).toBeGreaterThan(4);
  });

  it("설치 대상 자산과 상주 문서를 manifest 에서 실제로 뽑는다", () => {
    // 색인이 비면 "위반 0"이 참이 아니라 무의미해진다.
    const { assetTracks, docTracks } = buildIndexes();
    expect(assetTracks.size).toBeGreaterThan(20);
    expect(docTracks.size).toBeGreaterThan(10);
    // 전 트랙 상주 문서가 존재해야 이 게이트가 노리는 비대칭(전 트랙 문서 → 일부 트랙 자산)이 성립.
    expect([...docTracks.values()].some((s) => s.size === TRACKS.length)).toBe(true);
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

import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  assetTrustTier,
  DEV_METHOD_SKILL_IDS,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
  shouldInstallAsset,
} from "../src/external-assets.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import { DEFAULT_OPTIONS, TRACKS } from "../src/types.js";

// ADR-084 (#425) — audit-harness-fit 2판의 계약.
//
// 1판(ADR-064·066)은 **공식 체크리스트 인용**이 판정 근거였고, 그래서 이 파일의 핵심 게이트는
// `references/official-criteria.md` 의 blockquote 전량을 리포 안 리서치 원장과 문자 대조하는
// 것이었다(날조 인용을 실제로 잡았다). 2판은 판정 근거를 **확정된 사용자 의도 + 리포 실증**으로
// 바꿨고 인용 파일이 없다 — 그 게이트는 대상이 사라져 은퇴했다(ADR-084 §Consequences).
//
// **여기 남긴 것은 뜻을 안 읽는다**(`.claude/rules/change-management.md` §자산은 자기 변경 요청
// 없이 건드리지 않는다 — 문장의 의미를 무는 자동 검사는 만들지 마라). 2판은 SKILL.md 가
// 라우터이고 본문이 `references/` 에 있으므로, 깨지면 설치자에게 **빈 껍데기**가 되는 축만 잰다:
//   ① 라우터가 가리키는 참조 파일이 실재하고, 참조 파일은 전부 라우터에서 도달된다 (양방향)
//   ② 100줄 넘는 참조 파일에 TOC (공식 스킬 작성 기준 — 줄 수와 헤딩 실재만 본다)
//   ③ 낯선 프로젝트에서 돌아야 하므로 이 리포 전용 도구·경로에 기대지 않는다 (부재 대조)
//   ④ `.claude/` 개발 사본이 배포 원본과 바이트 동일 — 파일 목록은 원본 디렉터리에서 **유도**
//   ⑤ 카탈로그 배선 2 (1판과 같다)

const here = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string): string => readFileSync(here(rel), "utf8");

const SKILL_DIR = "../templates/skills/audit-harness-fit";
const MIRROR_DIR = "../.claude/skills/audit-harness-fit";

/** 배포 원본의 파일 목록. 열거하지 않는다 — 참조 파일이 늘면 모집단이 따라온다. */
const shippedFiles = listFilesRecursive(here(SKILL_DIR)).filter(
  (rel) => !rel.split("/").some((seg) => seg.startsWith(".")),
);
const skillMd = read(`${SKILL_DIR}/SKILL.md`);

/** SKILL.md 본문이 `[..](references/x.md)` 로 가리키는 상대 경로 전부. */
function routedReferences(md: string): string[] {
  const out = new Set<string>();
  for (const m of md.matchAll(/\]\(((?:references|scripts|evals)\/[^)#]+)(?:#[^)]*)?\)/g)) {
    if (m[1] !== undefined) out.add(m[1]);
  }
  return [...out].sort();
}

describe("audit-harness-fit — 라우터와 참조 파일의 양방향 도달", () => {
  const routed = routedReferences(skillMd);
  const onDisk = shippedFiles.filter((rel) => rel.startsWith("references/")).sort();

  it("모집단이 살아 있다 (헛통과 차단)", () => {
    // 라우팅 링크 0건이면 아래 두 단언은 빈 배열끼리 같아져 초록이 된다 — 그건 "라우터가 아무
    // 것도 안 가리킨다"는 뜻이지 정합이 아니다.
    expect(routed.length).toBeGreaterThan(2);
    expect(onDisk.length).toBeGreaterThan(2);
    expect(shippedFiles).toContain("SKILL.md");
  });

  it("라우터가 가리키는 참조 파일이 전부 실재한다", () => {
    const missing = routed.filter((rel) => !shippedFiles.includes(rel));
    expect(missing, "SKILL.md 가 없는 파일로 라우팅한다 — 설치자에게는 빈 껍데기다").toEqual([]);
  });

  it("references/ 의 파일은 전부 라우터에서 도달된다 (고아 참조 없음)", () => {
    const orphan = onDisk.filter((rel) => !routed.includes(rel));
    expect(orphan, "SKILL.md 어디서도 안 가리키는 참조 파일 — 아무도 못 읽는다").toEqual([]);
  });

  it("탐지기 자기검증 — 링크 추출기가 실제로 문다", () => {
    expect(routedReferences("see [x](references/a.md) and [y](references/b.md#s)")).toEqual([
      "references/a.md",
      "references/b.md",
    ]);
    expect(routedReferences("no links here")).toEqual([]);
  });
});

describe("audit-harness-fit — 참조 파일의 형식과 이식성", () => {
  it("100줄 초과 참조 파일에 TOC 가 있다", () => {
    const long = shippedFiles.filter(
      (rel) =>
        rel.startsWith("references/") && read(`${SKILL_DIR}/${rel}`).split("\n").length > 100,
    );
    // 2판 초안에서 audit.md 가 여기 걸린다. 0건이면 이 단언은 아무것도 안 잰다 — 그 사실을 드러낸다.
    expect(long.length).toBeGreaterThan(0);
    for (const rel of long) {
      expect(read(`${SKILL_DIR}/${rel}`), `${rel} 에 TOC(## Contents) 가 없다`).toMatch(
        /^## Contents$/m,
      );
    }
  });

  it("이 리포 전용 도구·경로에 의존하지 않는다 (배포물 전 파일)", () => {
    // canary: 패턴이 잡는 문자열로 탐지기부터 확인한다 — 잡지 못하면 아래 부재 결론은 무효다.
    const forbidden = [
      /npm run (cost:report|cost:baseline|ci\b)/,
      /docs\/research\//,
      /docs\/decisions\//,
    ];
    expect(forbidden.some((re) => re.test("run `npm run cost:report` first"))).toBe(true);
    for (const rel of shippedFiles) {
      const text = read(`${SKILL_DIR}/${rel}`);
      for (const re of forbidden) {
        expect(text, `${rel} 가 이 리포 전용 표면(${re.source})을 가리킨다`).not.toMatch(re);
      }
    }
  });

  it("repo-local .claude 복사본이 템플릿과 파일 단위로 byte-동일 (silent drift 가드)", () => {
    const mirror = listFilesRecursive(here(MIRROR_DIR)).filter(
      (rel) => !rel.split("/").some((seg) => seg.startsWith(".")),
    );
    expect([...mirror].sort()).toEqual([...shippedFiles].sort());
    for (const rel of shippedFiles) {
      expect(read(`${MIRROR_DIR}/${rel}`), `${rel} 가 미러와 다르다`).toBe(
        read(`${SKILL_DIR}/${rel}`),
      );
    }
    // 미러가 심링크면 "동일"은 자기 자신과의 대조다.
    expect(statSync(here(MIRROR_DIR)).isDirectory()).toBe(true);
  });
});

describe("audit-harness-fit — 카탈로그 배선", () => {
  const asset = EXTERNAL_ASSETS.find((a) => a.id === "audit-harness-fit");

  it("internal · official · uzys · any-track 전 트랙", () => {
    if (!asset) throw new Error("audit-harness-fit 가 카탈로그에 없다");
    expect(assetTrustTier("audit-harness-fit")).toBe("official");
    expect(asset.source).toBe("uzys");
    expect(asset.category).toBe("workflow");
    expect(asset.condition.kind).toBe("any-track");
    expect(asset.method.kind).toBe("internal");
    if (asset.method.kind !== "internal") throw new Error("not internal");
    expect(asset.method.key).toBe("audit-harness-fit");
    // 하네스는 전 트랙에 상주층을 깐다 — 감사 루프가 일부 트랙에만 있으면 비대칭이다.
    for (const t of TRACKS) {
      expect(
        shouldInstallAsset(asset, { tracks: [t], options: { ...DEFAULT_OPTIONS } }),
        `track=${t} 에서 미설치`,
      ).toBe(true);
    }
  });

  it("번들 목록에는 있고 DEV_METHOD 에는 없다", () => {
    // 번들에서 빠지면 카탈로그엔 보이는데 파일이 안 깔린다(manifest dir copy 대상 밖).
    expect(INTERNAL_BUNDLED_SKILL_IDS).toContain("audit-harness-fit");
    // DEV_METHOD 는 has-dev-track 불변식 위에 서 있다 — any-track 이 섞이면 wizard 번들이
    //   부분집합이 되어 사용자가 안 고른 자산을 설치한다.
    expect(DEV_METHOD_SKILL_IDS).not.toContain("audit-harness-fit");
  });
});

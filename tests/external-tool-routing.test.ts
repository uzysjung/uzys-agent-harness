import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ADR-069 / 이슈 #286 — 외부 실행기 레인. 설계 SSOT =
// `docs/plans/skills-external-executor-2026-08-09.md`.
//
// **2026-08-30 재판정(#360)에서 성격이 바뀌었다: 26블록 → 5블록.** 걷어낸 것은 세 스킬 본문의
// **소유·경계 술어**를 낱말로 세던 A0~A4 · B1 · C1~C3 · D1(배포판·개발 사본 두 벌)과, 그 앵커들이
// 무는지 보이려고 만든 합성 입력 변이 블록이다.
//
// **왜 걷었나 — 이미 채택된 룰이 금지하는 형태다.** `.claude/rules/change-management.md`
// §자산은 자기 변경 요청 없이 건드리지 않는다 가 *"문장의 의미를 무는 자동 검사는 만들지
// 마라(3회 우회 실측)"* 로 못박는다. 이 파일은 그 결론에 **가장 가까이 갔다가 실패한 기록**이기도
// 하다: 절 슬라이스로는 문장을 지워도 옆 줄의 같은 낱말이 앵커를 채워(34개 중 9개 실측) `units()`
// 로 문장 단위까지 좁혔는데, 그래도 같은 뜻으로 다시 쓰면 🔴이고 낱말을 남긴 채 뒤집으면 🟢다.
// 정교화로는 수렴하지 않는다는 것이 #345 의 결론이고 여기가 그 세 번째 사례다.
// 자산 본문의 뜻은 `npm run assets:history` 로 이력을 읽어 사람·에이전트가 판정한다.
//
// **남긴 5개는 뜻을 안 읽는다.** ⓐ 라우팅·도구 절에 **구체 모델 슬러그가 0건**인가 — 낱말이
// 아니라 `이름-버전` 이라는 **형태**를 무는 부재 대조다. 버전 박힌 슬러그는 시간이 지나면 거짓이
// 되고 설치자를 은퇴한 모델에 묶는다. ⓑ 그 검사의 슬라이스가 비지 않았는가(헛통과 차단).
// ⓒ reference 파일 두 사본 바이트 동일. ⓓⓔ 두 탐지기(슬러그·절 슬라이서)의 자기검증 —
// 양성을 먼저 물고 음성은 안 무는지. 남은 것들이 무는지 보이는 canary 는 함께 남긴다.

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

/** 설계 §2.1 — model-orchestration 신설 절. */
const H_EXTERNAL_EXECUTORS = "## External executors — the lane outside the harness";
const H_ROUTING_TEST = "## Routing test";
/** 설계 §3.2 — multi-persona-review 신설 하위 절. */
const H_SEATS = "#### Seats an outside tool can fill";
/** 설계 §1 — 어느 provider 가 무엇을 맡는가의 SSOT(라우팅 표). */
const H_WHICH_PROVIDER = "## Which provider";
/** 설계 §4.1 — 외부 CLI 로 나가는 모든 경로의 규칙. §4.4 의 노후 버전 문자열이 여기 있다. */
const H_PREREQUISITE = "## Prerequisite";

/**
 * 양끝 앵커로 절을 자른다. 끝은 **같은 레벨 이상의 다음 헤딩**에서 막는다 — `####` 하위 절이면
 * 다음 `####`·`###`·`##` 중 먼저 오는 것. 헤딩이 없으면 빈 문자열이고, 그 빈 슬라이스를 각
 * 단언의 첫 줄이 먼저 잡는다.
 */
function section(body: string, heading: string): string {
  const parts = body.split(heading);
  if (parts.length < 2) return "";
  const after = parts[1] ?? "";
  const level = heading.match(/^#+/)?.[0]?.length ?? 2;
  let end = after.length;
  for (let l = level; l >= 2; l--) {
    const i = after.indexOf(`\n${"#".repeat(l)} `);
    if (i !== -1 && i < end) end = i;
  }
  return after.slice(0, end);
}

/**
 * 구체 모델 슬러그 탐지기(설계 §5.2 E). 두 형태를 문다 —
 * ⓐ `provider 1.2` / `provider-1.2` (버전 고정) ⓑ `provider-1-tier` (티어 붙은 슬러그).
 *
 * **벤더 이름을 열거하지 않는다.** 열거하면 다음에 등장할 제공자를 못 잡고, 그 목록 자체가
 * "이 머신에만 있는 모델명"의 두 번째 사본이 된다. 알파벳 접두사 + 숫자 버전이라는 **형태**가
 * 표식이다: `Fable 5`·`Sonnet 5` 같은 점 없는 세대 번호는 통과하고, `codex 0.144.5`·`glm-5.2`·
 * `gemini-3.1-pro`는 걸린다.
 *
 * 그래서 **슬라이스로 좁혀 돌린다.** 전면 스캔하면 날짜 붙은 관측 근거(`Measured 2026-07-26:
 * …`)와 스크립트 주석까지 오탐한다 — 그건 라우팅 지시가 아니다(설계 §4.4).
 */
const MODEL_SLUG_SOURCE = String.raw`\b[a-z][a-z0-9]{2,}(?:[-_ ]\d+(?:\.\d+)+|-\d+(?:\.\d+)*-[a-z]{2,})`;

function modelSlugHits(label: string, text: string): string[] {
  const re = new RegExp(MODEL_SLUG_SOURCE, "i");
  const hits: string[] = [];
  text.split("\n").forEach((line, i) => {
    if (re.test(line)) hits.push(`${label} +${i + 1}  ${line.trim().slice(0, 110)}`);
  });
  return hits;
}

/** `templates/`(배포물)와 `.claude/`(개발 사본)를 **같은 계약**으로 검사한다. */
const ROOTS = [
  { label: "templates/skills", path: "../templates/skills" },
  { label: ".claude/skills", path: "../.claude/skills" },
] as const;

for (const root of ROOTS) {
  const mo = read(`${root.path}/model-orchestration/SKILL.md`);
  const mpr = read(`${root.path}/multi-persona-review/SKILL.md`);
  const emc = read(`${root.path}/external-model-consult/SKILL.md`);

  /** E 의 검사 범위 = 라우팅·도구 절만. 전면 스캔은 날짜·스크립트 주석을 오탐한다(설계 §4.4). */
  const slugSlices = [
    {
      label: `model-orchestration ${H_EXTERNAL_EXECUTORS}`,
      text: section(mo, H_EXTERNAL_EXECUTORS),
    },
    { label: `model-orchestration ${H_ROUTING_TEST}`, text: section(mo, H_ROUTING_TEST) },
    { label: `multi-persona-review ${H_SEATS}`, text: section(mpr, H_SEATS) },
    { label: `external-model-consult ${H_WHICH_PROVIDER}`, text: section(emc, H_WHICH_PROVIDER) },
    { label: `external-model-consult ${H_PREREQUISITE}`, text: section(emc, H_PREREQUISITE) },
  ];

  describe(`외부 실행기 레인 위생 — ${root.label}`, () => {
    it("E0 — 모델 슬러그 검사의 슬라이스가 전부 비어 있지 않다", () => {
      // 빈 결과를 부재의 증거로 쓰지 않는다. 앵커가 어긋나면 E 는 0건을 내고 조용히 통과한다.
      const empty = slugSlices.filter((s) => s.text.trim() === "").map((s) => s.label);
      expect(
        empty,
        `앵커가 어긋나 슬라이스가 비었다 — E 가 헛통과한다:\n${empty.join("\n")}`,
      ).toEqual([]);
    });

    it("E — 라우팅·도구 절 안에 구체 모델 슬러그가 0건", () => {
      const hits = slugSlices.flatMap((s) => modelSlugHits(s.label, s.text));
      expect(
        hits,
        [
          "배포 본문은 모델을 고르지 않는다 — 그 CLI 가 자기 설정으로 고른 것을 쓰고,",
          "무엇이 답했는지 보고한다. 버전·티어가 박힌 슬러그는 시간이 지나면 거짓이 되고",
          "설치자를 은퇴한 모델에 묶는다.",
          hits.join("\n"),
        ].join("\n"),
      ).toEqual([]);
    });
  });
}

describe("세 스킬의 두 사본이 1:1 이다", () => {
  // SKILL.md 3종은 `subagent-file-handoff.test.ts` 가 문다. reference 파일은 그 게이트 밖이라
  // 여기서 막는다 — 이번 사이클이 `reviewer-design.md` 도 양쪽에서 고치기 때문이다(설계 §3.6).
  it("multi-persona-review/references/reviewer-design.md", () => {
    expect(read("../.claude/skills/multi-persona-review/references/reviewer-design.md")).toBe(
      read("../templates/skills/multi-persona-review/references/reviewer-design.md"),
    );
  });
});

/**
 * 탐지기 자기검증 — **위에 남긴 검사가 실제로 무는가.**
 *
 * 빈 결과는 부재의 증거가 아니다(`.claude/rules/cli-development.md`). 알려진 양성을 먼저 물리고,
 * 정상 표기를 안 무는지까지 본 뒤에야 "0건"을 신뢰한다.
 */
describe("탐지기 자기검증", () => {
  it("모델 슬러그 탐지기 — 알려진 양성을 먼저 물고, 세대 번호·날짜는 안 문다", () => {
    // 알려진 양성으로 탐지기를 먼저 검증한 뒤에야 빈 결과를 신뢰한다
    // (`.claude/rules/cli-development.md` §검증 명령은 실패해도 조용하다).
    const positives = [
      "codex 0.144.5 with an empty `CODEX_HOME`", // ← 지금 트리의 실제 양성(설계 §4.4)
      "route this to `glm-5.2`",
      "measured with gemini-3.1-pro-high",
      "use gpt-5.5 for the sweep",
      "GLM-5.2 라고 적어도 잡힌다",
      "Fable 5, Sonnet 5, and Opus 4.8/4.7 support all five", // 슬라이스 밖이라 안 걸릴 뿐, 형태는 양성
    ];
    const negatives = [
      "Fable 5, Sonnet 5, and Opus support every effort tier",
      "Past that gate (2026-08-02 사용자 결정):",
      "run `opencode run --help` and read the subcommand off it",
      "Prefer pinning the persona sub-agents to a cheaper tier (Sonnet)",
      "P1~P5 가 전부 참이어도 기본은 in-harness 레인이다",
      "route to **Opus @ xhigh+**, and its output gets cross-verification",
    ];
    for (const line of positives) {
      expect(modelSlugHits("canary", line), `양성을 못 문다: ${line}`).not.toEqual([]);
    }
    for (const line of negatives) {
      expect(modelSlugHits("canary", line), `오탐: ${line}`).toEqual([]);
    }
  });

  it("절 슬라이서 — 양끝을 막는다 (뒷 절의 낱말로 통과하지 않는다)", () => {
    const body = ["## First", "alpha", "", "### Nested", "beta", "", "## Second", "gamma"].join(
      "\n",
    );
    expect(section(body, "## First")).toContain("alpha");
    // 하위 절은 같은 절 안이므로 포함되고, 다음 `## ` 부터는 잘린다.
    expect(section(body, "## First")).toContain("beta");
    expect(section(body, "## First")).not.toContain("gamma");
    // `###` 슬라이스는 다음 `##` 에서도 끊긴다.
    expect(section(body, "### Nested")).toContain("beta");
    expect(section(body, "### Nested")).not.toContain("gamma");
    // 없는 헤딩은 빈 문자열 — 그래야 "슬라이스가 비면 먼저 실패" 가 성립한다.
    expect(section(body, "## Missing")).toBe("");
  });
});

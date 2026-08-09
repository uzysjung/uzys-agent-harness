import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// ADR-069 / 이슈 #286 — 외부 실행기 레인. 세 스킬 본문의 **소유·경계·위생** 계약.
// 설계 SSOT = `docs/plans/skills-external-executor-2026-08-09.md` §5.2 (단언 A0~E0).
//
// 이 파일은 **본문을 쓴 레인이 아닌 레인**이 쓴다. 그래서 작성 시점에 red 로 태어난다 —
// 초록으로 태어난 테스트는 증거가 아니다(`.claude/CLAUDE.md` 대원칙).
//
// 앵커(헤딩 이름·필수 어구)는 설계 §2·§3·§4 가 고정했다. 두 레인이 같은 계약을 본다는 뜻이므로
// 헤딩 문자열을 바꾸는 것은 계약 변경이지 테스트 수리가 아니다.
//
// 두 가지 규율을 선례에서 그대로 가져온다:
//  ⓐ **양끝 앵커로 절을 자르고, 슬라이스가 비면 먼저 실패한다**
//    (`subagent-file-handoff.test.ts:27-29`). 끝을 안 막으면 뒷 절의 동일 낱말로도 통과한다.
//  ⓑ **한 단언 안의 조건은 AND 로 묶는다.** OR 로 묶으면 한쪽만 남아도 통과해 가드가 아니라
//    장식이 된다 — 같은 파일 :41-50 이 이미 한 번 낸 구멍이다.
//
// 그리고 이 파일의 탐지기(절 슬라이서 · 모델 슬러그 · 재서술 표식)는 **자기 자신도 검증한다** —
// 맨 아래 "탐지기 자기검증" 블록이 합성 입력을 변이시켜 앵커 하나하나가 실제로 무는지 보인다
// (`.claude/rules/test-policy.md` §변이 테스트 = 입력 변이. 선례 =
// `templates-distribution-hygiene.test.ts` 의 `workspaceSiblings` 블록).

const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), "utf8");

/** 설계 §2.1 — model-orchestration 신설 절. 헤딩 이름 자체가 계약이다(A0). */
const H_EXTERNAL_EXECUTORS = "## External executors — the lane outside the harness";
const H_ROUTING_TEST = "## Routing test";
const H_EFFORT_FLOORS = "## Effort floors";
const H_ANTI_PATTERNS = "## Anti-patterns";
/** 설계 §3.2 — multi-persona-review 신설 하위 절. */
const H_SEATS = "#### Seats an outside tool can fill";
/** 설계 §1 — 어느 provider 가 무엇을 맡는가의 SSOT(라우팅 표). */
const H_WHICH_PROVIDER = "## Which provider";
/** 설계 §4.1 — 외부 CLI 로 나가는 모든 경로의 규칙. §4.4 의 노후 버전 문자열이 여기 있다. */
const H_PREREQUISITE = "## Prerequisite";
/** 설계 §4.2 — 실행 위임이 이 스킬의 일이 아님을 적는 자리. */
const H_WHEN_NOT_TO_USE = "## When NOT to use";

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
 * **두 레인이 공유하는 계약표.** 설계 §2·§3·§4 가 고정한 필수 어구를 한 곳에 모은다 —
 * 여기 없는 것은 계약이 아니고, 여기 있는 것은 전부 AND 다.
 *
 * `id` 앞자리가 설계 §5.2 의 단언 번호이고, 그 접두사로 묶어 검사한다.
 */
type Anchor = { id: string; why: string; re: RegExp };

const ANCHORS: ReadonlyArray<Anchor> = [
  // ── A1: 다섯 술어. 라벨과 내용을 따로 문다 — 라벨만 세면 빈 줄 다섯 개로도 통과한다.
  { id: "A1·P1-라벨", why: "술어 표지 P1", re: /\bP1\b/ },
  {
    id: "A1·P1-질문",
    why: "판단 잔여 0 = 기존 라우팅 질문 「새 판단이 남아 있는가」 그대로. 새 판별자를 만들지 않는다",
    re: /새 판단이 남아 있는가/,
  },
  { id: "A1·P2-라벨", why: "술어 표지 P2", re: /\bP2\b/ },
  {
    id: "A1·P2-합격명령",
    why: "합격이 기계로 판정된다 = 합격 명령(pass/acceptance command)을 지금 한 줄로 적을 수 있는가",
    re: /(?:pass|acceptance|합격)[^\n]{0,40}(?:command|명령)/i,
  },
  { id: "A1·P3-라벨", why: "술어 표지 P3", re: /\bP3\b/ },
  {
    id: "A1·P3-교차검증",
    why: "in-harness 교차검증(cross-verification) 전까지는 아무것도 게이트하지 않는다",
    re: /cross-verif/i,
  },
  { id: "A1·P3-게이트", why: "...무엇도 게이트하지 못한다는 말", re: /gate/i },
  { id: "A1·P4-라벨", why: "술어 표지 P4", re: /\bP4\b/ },
  {
    id: "A1·P4-승인범위",
    why: "최초 확인이 끝났고 이번 파일 집합이 그 승인(approval) 범위 안인가",
    re: /approv/i,
  },
  { id: "A1·P5-라벨", why: "술어 표지 P5", re: /\bP5\b/ },
  // P5 는 두 조건의 AND 다. 후반부가 없으면 셸을 못 쓰는 설치본(OpenCode `agent: plan`)에서
  // 이 레인이 조용한 no-op 이 된다 — 설계 §6.4 가 A1 에 두 조각을 모두 요구하는 근거.
  {
    id: "A1·P5-다른CLI",
    why: "그 도구가 **당신이 돌고 있는 CLI 가 아니어야** 한다 (자기 위임은 왕복이 아니다)",
    re: /running on|돌고 있는/i,
  },
  {
    id: "A1·P5-셸",
    why: "셸을 쓸 수 없으면 이 레인은 당신에게 없는 것이다 (설계 §6.4)",
    re: /shell|셸/i,
  },

  // ── A2: 저장소 코드가 제3자에 처음 도달하기 전의 확인. 1회 · 프로젝트 단위 · 경계 이동 시 재확인.
  { id: "A2·최초사용", why: "최초 사용(first use)이라는 조건", re: /first use/i },
  { id: "A2·사용자결정", why: "누구의 결정인지 — the user's call", re: /user's call/i },
  { id: "A2·기다린다", why: "말하고 **기다린다** — then wait", re: /\bwait\b/i },
  {
    id: "A2·경계이동",
    why: "경계(boundary)가 움직이면 재확인 — 다른 도구, 승인 범위 밖 파일",
    re: /boundar/i,
  },

  // ── A3: 용량이지 품질이 아니다. 빠지면 다음 세션이 "더 좋아서" 외부로 보내고,
  //        그 순간 이 정책의 quality-over-cost 전제가 뒤집힌다.
  { id: "A3·용량", why: "capacity/용량 — 이 레인이 사는 것", re: /capacity|용량/i },
  { id: "A3·품질", why: "quality/품질 — 사지 않는 것", re: /quality|품질/i },

  // ── A4: 부재·인증 만료 시의 경로. 네 조각 전부 AND.
  {
    id: "A4·레인하향",
    why: "레인을 하나 내린다",
    re: /(?:down|lower|drop|back)[^\n]{0,24}lane|lane[^\n]{0,24}(?:down|back)|레인을[^\n]{0,8}내리/i,
  },
  { id: "A4·보고", why: "무엇을 못 썼는지 보고한다", re: /report/i },
  { id: "A4·설치금지", why: "대신 설치하지 않는다", re: /install/i },
  { id: "A4·인증금지", why: "대신 인증/로그인하지 않는다", re: /auth|log ?in/i },
  {
    id: "A4·교체금지",
    why: "조용히 다른 제공자로 갈아타지 않는다 — 사용자는 A 가 답한 줄 안다",
    re: /substitut|swap|reroute|갈아타/i,
  },

  // ── C1: 복수 도구 패널은 **돌기 전에** 사용자 결정.
  {
    id: "C1·복수도구",
    why: "복수 도구에 걸치는 패널이라는 조건",
    re: /more than one tool|multiple tools|복수 도구|여러 도구/i,
  },
  { id: "C1·사용자결정", why: "the user's call before it runs", re: /user's call/i },
  { id: "C1·기다린다", why: "말하고 **기다린다** — then wait", re: /\bwait\b/i },

  // ── C2: 좌석을 못 채울 때. 같은 렌즈로 조용히 대체하면 수는 지키고 독립성을 잃는다 —
  //        독립성이 이 방법의 가치를 이루는 유일한 변수다.
  { id: "C2·네이티브", why: "네이티브(native) 좌석으로의 처리", re: /native/i },
  { id: "C2·독립성", why: "잃는 것이 독립성(independence)이라는 진술", re: /independen/i },
  { id: "C2·고지위치", why: "기록 위치 = step-6 coverage caveat", re: /coverage caveat/i },
  {
    id: "C2·출처기록",
    why: "어느 좌석에 어느 모델이 답했는지(which model answered) 기록",
    re: /model answered/i,
  },

  // ── C3(양성 반쪽): 가리키기. 음성 반쪽(재서술 금지)은 WRAPPER_MECHANICS 가 맡는다.
  {
    id: "C3·포인터",
    why: "외부 좌석은 `external-model-consult` 를 경유한다 — 그 이름이 여기 있어야 가리킨 것이다",
    re: /external-model-consult/,
  },

  // ── D1: 실행 위임은 external-model-consult 의 일이 아니다.
  { id: "D1·구현위임", why: "실제 구현(implementation) 위임", re: /implementation/i },
  {
    id: "D1·실행기",
    why: "실행기(executor)는 저장소 미노출 약속의 정반대를 요구한다",
    re: /executor/i,
  },
  {
    id: "D1·소유이관",
    why: "그 레인·술어·최초 승인은 model-orchestration 소관이라고 가리킨다",
    re: /model-orchestration/,
  },
];

/** 그룹(A1·A2·…)의 앵커 중 `text` 가 못 만족시킨 것들. 빈 배열 = 전부 충족. */
function unmet(group: string, text: string): string[] {
  return ANCHORS.filter((a) => a.id.startsWith(`${group}·`) && !a.re.test(text)).map(
    (a) => `${a.id} — ${a.why}`,
  );
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

/**
 * 호출 방법의 **재서술** 표식(설계 §5.2 C3 의 음성 반쪽). 래퍼 경로·exit code·샌드박스 플래그·
 * 출력 태그는 `external-model-consult` 소관이다. 이 표식이 다른 스킬에 나타나면 MECE 가 깨진
 * 것이고, 그때부터 한쪽만 고쳐지는 drift 가 시작된다.
 */
const WRAPPER_MECHANICS =
  /(?:gemini|codex)-ask\.sh|codex exec\b|\bagy -p\b|_CONSULT_TIMEOUT|<untrusted-|--dangerously-skip-permissions|\bexit (?:2|3|4|5|124)\b/i;

/** `templates/`(배포물)와 `.claude/`(개발 사본)를 **같은 계약**으로 검사한다. */
const ROOTS = [
  { label: "templates/skills", path: "../templates/skills" },
  { label: ".claude/skills", path: "../.claude/skills" },
] as const;

for (const root of ROOTS) {
  const mo = read(`${root.path}/model-orchestration/SKILL.md`);
  const mpr = read(`${root.path}/multi-persona-review/SKILL.md`);
  const emc = read(`${root.path}/external-model-consult/SKILL.md`);
  const reviewerDesign = read(`${root.path}/multi-persona-review/references/reviewer-design.md`);

  const executors = section(mo, H_EXTERNAL_EXECUTORS);
  const antiPatterns = section(mo, H_ANTI_PATTERNS);
  const seats = section(mpr, H_SEATS);
  const whenNotToUse = section(emc, H_WHEN_NOT_TO_USE);

  /** E 의 검사 범위 = 라우팅·도구 절만. */
  const slugSlices = [
    { label: `model-orchestration ${H_EXTERNAL_EXECUTORS}`, text: executors },
    { label: `model-orchestration ${H_ROUTING_TEST}`, text: section(mo, H_ROUTING_TEST) },
    { label: `multi-persona-review ${H_SEATS}`, text: seats },
    { label: `external-model-consult ${H_WHICH_PROVIDER}`, text: section(emc, H_WHICH_PROVIDER) },
    { label: `external-model-consult ${H_PREREQUISITE}`, text: section(emc, H_PREREQUISITE) },
  ];

  describe(`외부 실행기 레인 계약 — ${root.label}`, () => {
    it("A0 — model-orchestration 이 외부 실행기 절을 소유한다 (라우팅 판단 자리에서)", () => {
      // 헛통과 차단. 이 슬라이스가 비면 A1~A4 는 전부 공허하게 통과한다.
      expect(
        executors,
        `헤딩 "${H_EXTERNAL_EXECUTORS}" 이 없다 — 이름 자체가 계약이다(설계 §2.1)`,
      ).not.toBe("");

      // 위치도 계약이다: 라우팅을 결정하는 자리 뒤, effort 를 고르는 자리 앞에서 읽혀야 한다.
      // 절이 파일 끝으로 밀리면 위임을 결정하는 시점에 안 읽힌다.
      const iRouting = mo.indexOf(H_ROUTING_TEST);
      const iExecutors = mo.indexOf(H_EXTERNAL_EXECUTORS);
      const iFloors = mo.indexOf(H_EFFORT_FLOORS);
      expect(iRouting, `"${H_ROUTING_TEST}" 헤딩이 없다`).toBeGreaterThan(-1);
      expect(iFloors, `"${H_EFFORT_FLOORS}" 헤딩이 없다`).toBeGreaterThan(-1);
      expect(
        iRouting < iExecutors && iExecutors < iFloors,
        `순서가 ${H_ROUTING_TEST} → External executors → ${H_EFFORT_FLOORS} 여야 한다(설계 §2.1)`,
      ).toBe(true);
    });

    it("A1 — 다섯 술어가 전부 있다 (AND — 하나만 남아도 통과하면 장식이다)", () => {
      expect(executors, "A0 을 먼저 봐라 — 슬라이스가 비었다").not.toBe("");
      const missing = unmet("A1", executors);
      expect(
        missing,
        `다섯 술어는 **전부 참일 때만** 이 레인이 열린다(설계 §2.1b):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it("A2 — 저장소의 최초 외부 도달은 사용자 결정이라는 확인 문장이 있다", () => {
      expect(executors, "A0 을 먼저 봐라 — 슬라이스가 비었다").not.toBe("");
      const missing = unmet("A2", executors);
      expect(
        missing,
        `1회 · 프로젝트 단위 · 경계가 움직이면 재확인 — 세 조건이 전부 있어야 한다(설계 §2.2):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it("A3 — 이 레인이 사는 것은 용량이지 품질이 아니다", () => {
      expect(executors, "A0 을 먼저 봐라 — 슬라이스가 비었다").not.toBe("");
      const missing = unmet("A3", executors);
      expect(
        missing,
        `품질을 근거로 외부로 보내면 이 정책의 quality-over-cost 전제가 뒤집힌다(설계 §2.1a):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it("A4 — 부재·인증 만료: 레인을 내리고 보고 · 대신 설치/인증/교체하지 않음 (AND)", () => {
      expect(executors, "A0 을 먼저 봐라 — 슬라이스가 비었다").not.toBe("");
      const missing = unmet("A4", executors);
      expect(
        missing,
        `절반만 남으면 나머지 절반은 다음 세션이 알아서 한다 — 그게 이 항목이 AND 인 이유다(설계 §2.1d):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it("B1 — Anti-patterns 가 '외부 실행기에 테스트·검증' 을 한 행에서 금지한다", () => {
      expect(antiPatterns, `"${H_ANTI_PATTERNS}" 슬라이스가 비었다`).not.toBe("");
      const rows = antiPatterns.split("\n").filter((l) => l.trimStart().startsWith("|"));
      const external = rows.filter((r) => /external|외부/i.test(r));
      expect(
        external.length,
        "외부 실행기를 다루는 anti-pattern 행이 없다 — 정책 충돌이 문서상 미해결로 남는다(설계 §2.4)",
      ).toBeGreaterThan(0);
      // **한 행 안에서** AND. 테스트 금지와 검증 금지가 다른 행에 흩어지면 그 둘은 다른 규칙이고,
      // 한쪽이 지워져도 이 단언이 안 문다.
      const row = external.find((r) => /test|테스트/i.test(r) && /verif|검증/i.test(r));
      expect(
        row,
        `외부 실행기 행이 테스트·검증 금지를 함께 적지 않는다 (ADR-069 가드레일 3):\n${external.join("\n")}`,
      ).toBeDefined();
    });

    it("C1 — multi-persona-review 가 복수 도구 패널의 사전 확인을 소유한다", () => {
      expect(seats, `헤딩 "${H_SEATS}" 이 없다 — 헛통과 차단(설계 §3.2)`).not.toBe("");
      const missing = unmet("C1", seats);
      expect(
        missing,
        `패널이 돌기 전에 사용자 결정이다 — 끝난 뒤 보고가 아니다(설계 §3.2a):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it("C2 — 좌석을 못 채우면 네이티브로 내리되 출처를 기록한다", () => {
      expect(seats, "C1 을 먼저 봐라 — 슬라이스가 비었다").not.toBe("");
      const missing = unmet("C2", seats);
      expect(
        missing,
        `같은 렌즈로 조용히 대체하면 좌석 수는 지키고 독립성을 잃는다(설계 §3.2b):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

    it("C3 — multi-persona-review 는 호출 방법을 재서술하지 않고 가리키기만 한다 (MECE)", () => {
      expect(seats, "C1 을 먼저 봐라 — 슬라이스가 비었다").not.toBe("");
      const missing = unmet("C3", seats);
      expect(missing, missing.join("\n")).toEqual([]);

      // 삭제형 변이만으로는 "재서술 금지" 방향을 검증할 수 없다 → **추가**를 잡는 단언.
      const restated: string[] = [];
      for (const [name, text] of [
        ["SKILL.md", mpr],
        ["references/reviewer-design.md", reviewerDesign],
      ] as const) {
        text.split("\n").forEach((line, i) => {
          if (WRAPPER_MECHANICS.test(line)) restated.push(`${name}:${i + 1}  ${line.trim()}`);
        });
      }
      expect(
        restated,
        `호출·가드레일·exit code 는 external-model-consult 소관이다 — 여기서 되풀이하지 마라:\n${restated.join("\n")}`,
      ).toEqual([]);
    });

    it("D1 — external-model-consult 가 '실행 위임은 내 일이 아니다' 를 명시한다", () => {
      expect(whenNotToUse, `"${H_WHEN_NOT_TO_USE}" 슬라이스가 비었다`).not.toBe("");
      // 안 적으면 다음 세션이 여기에 실행기를 얹는다 — 그 순간 이 스킬의 중심 약속(저장소가
      // 제공자 워크스페이스에 안 들어간다)과 본문이 자기모순이 된다.
      const missing = unmet("D1", whenNotToUse);
      expect(
        missing,
        `두 스킬의 경계가 본문 안에서 자기모순이 되지 않게 한다(설계 §4.2):\n${missing.join("\n")}`,
      ).toEqual([]);
    });

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
 * 탐지기 자기검증 — **이 게이트가 실제로 무는가.**
 *
 * 위 계약 단언들은 지금 전부 red 다(본문이 아직 없다). 그것만으로는 "본문이 생기면 통과한다"와
 * "본문이 생겨도 아무것도 안 문다"를 구분할 수 없다. 그래서 합성 입력을 만들어 ⓐ 완성본은
 * 통과시키고(canary) ⓑ 앵커를 한 개씩 지우면 **매번** red 가 되는지 본다. `.claude/rules/
 * test-policy.md` 가 말하는 **입력 변이**이고, 저장소 파일을 건드리지 않는다.
 */
describe("탐지기 자기검증 — 앵커가 실제로 무는가 (입력 변이)", () => {
  /** 설계 §2.1 을 최소로 충족하는 합성 절. 실제 본문 초안이 아니라 **탐지기의 입력**이다. */
  const SAMPLE_EXECUTORS = [
    "이 레인은 capacity 를 사지 quality 를 사지 않는다.",
    'P1 — 판단 잔여 0: *"새 판단이 남아 있는가?"* 남아 있으면 닫힌다.',
    "P2 — you can write the pass command on one line right now.",
    "P3 — it gates nothing until in-harness cross-verification clears it.",
    "P4 — the first-use approval is done and this file set sits inside it.",
    "P5 — the tool is not the CLI you are running on, and it can use a shell.",
    "First use in a repository is the user's call: say what goes, then wait.",
    "Ask again when the boundary moves — a different tool, or files outside what was approved.",
    "Missing tool or expired auth: step down a lane and report what you could not use.",
    "Never install, log in, or substitute another provider on the user's behalf.",
  ].join("\n");

  /** 설계 §3.2 를 최소로 충족하는 합성 하위 절. */
  const SAMPLE_SEATS = [
    "A panel that spans more than one tool is the user's call before it runs, not after.",
    "Name the tools that will answer and what text leaves the machine; then wait.",
    "If the seat cannot be filled, do not quietly replace it with another native reviewer of",
    "the same shape — that keeps the count and loses the independence.",
    "Record in the step-6 coverage caveat which seats were native, which were external, and",
    "which model answered each.",
    "The outside seat goes out through external-model-consult; the call itself stays there.",
  ].join("\n");

  /** 설계 §4.2 를 최소로 충족하는 합성 항목. */
  const SAMPLE_WHEN_NOT = [
    "- Handing an external CLI actual implementation work in your repo — an executor needs the",
    "  repo inside the provider's workspace, the opposite of this skill's promise. That lane",
    "  belongs to model-orchestration where installed.",
  ].join("\n");

  const SAMPLES = [
    { group: "A1", sample: SAMPLE_EXECUTORS },
    { group: "A2", sample: SAMPLE_EXECUTORS },
    { group: "A3", sample: SAMPLE_EXECUTORS },
    { group: "A4", sample: SAMPLE_EXECUTORS },
    { group: "C1", sample: SAMPLE_SEATS },
    { group: "C2", sample: SAMPLE_SEATS },
    { group: "C3", sample: SAMPLE_SEATS },
    { group: "D1", sample: SAMPLE_WHEN_NOT },
  ] as const;

  for (const { group, sample } of SAMPLES) {
    it(`${group} — 완성 입력은 통과하고, 앵커를 하나 지우면 매번 red 다`, () => {
      // canary: 탐지기가 "통과시킬 줄" 부터 보인다. 여기서 실패하면 앵커가 본문과 어긋난 것이지
      // 본문이 틀린 것이 아니다.
      expect(
        unmet(group, sample),
        `합성 완성본을 통과시키지 못한다:\n${unmet(group, sample)}`,
      ).toEqual([]);

      const groupAnchors = ANCHORS.filter((a) => a.id.startsWith(`${group}·`));
      expect(groupAnchors.length, `${group} 그룹에 앵커가 없다`).toBeGreaterThan(0);
      for (const anchor of groupAnchors) {
        const mutated = sample
          .split("\n")
          .filter((line) => !anchor.re.test(line))
          .join("\n");
        expect(
          unmet(group, mutated).join("\n"),
          `${anchor.id} 를 지웠는데 여전히 통과한다 — OR 로 샌 것이다`,
        ).toContain(anchor.id);
      }
    });
  }

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

  it("재서술 표식 — 호출 예시는 물고, 가리키는 문장은 안 문다", () => {
    const positives = [
      'bash .claude/skills/external-model-consult/scripts/codex-ask.sh "PROMPT"',
      "run gemini-ask.sh -t claude",
      "codex exec -s read-only",
      "exit 4 = secret-shaped prompt refused",
      "cap the call with CODEX_CONSULT_TIMEOUT",
      "read only what is inside <untrusted-codex-output>",
    ];
    const negatives = [
      "The outside seat goes out through `external-model-consult`.",
      "Its exit-code contract and guardrails live in that skill, not here.",
      'see [[model-orchestration]] "Worker lifecycle" for the general rule',
    ];
    for (const line of positives) {
      expect(WRAPPER_MECHANICS.test(line), `재서술을 못 문다: ${line}`).toBe(true);
    }
    for (const line of negatives) {
      expect(WRAPPER_MECHANICS.test(line), `오탐: ${line}`).toBe(false);
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

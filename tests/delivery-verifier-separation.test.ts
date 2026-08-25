import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// #345 — "구현 주체와 분리된 검증자가 완료를 판정한다"가 배포 룰에서 **조용히 사라졌다.**
//
// 이력: #285 가 배포 룰에 독립 리뷰 문장을 넣었고, #299 가 "앵커가 이미 소유한다"는 근거로
// 걷어냈다. 그 판정은 절반만 맞았다 — 앵커(§5 Verify and Review)는 **머지 시점의 독립 리뷰**를
// 담지만 다음 둘은 담지 않는다:
//   ⓐ **완료를 누가 판정하는가** — 앵커는 리뷰어가 "verifies the work itself"라고만 말한다.
//      판정 주체가 없으면 만든 쪽이 자기 산출물에 완료 도장을 찍는 것이 규칙 위반이 아니게 된다.
//   ⓑ **ship 경계** — 앵커는 "before it is merged"까지다. 배포는 별개 경계이고 이 룰이 소유한다.
//
// ---------------------------------------------------------------------------
// **판정 축을 뒤집었다 (PR #352 독립 리뷰 2레인)**
//
// 이 게이트의 1판은 계약 문장의 **어절**을 `toMatch` 로 고정했다(`직접 다시 확인`,
// `판정이 아니다`, `완료 판정은 만든 레인이 아니라 검증 레인이 내린다` …). 두 리뷰 레인이
// 각각 변이를 걸어 같은 결론을 냈다 — **방향이 반대였다**:
//   · 길이를 보존한 **의미 반전문**이 어절 게이트 5개를 **전부 통과**했다(막아야 할 것을 못 막음).
//   · **동의어 개정**(`내린다` → `낸다`)은 **red** 였다(막지 말아야 할 것을 막음).
// 즉 1판이 지킨 것은 계약이 아니라 어절이었고, 주석은 "표현이 바뀌어도 통과한다"고 반대를
// 약속하고 있었다.
//
// 그래서 축을 **어절 고정 → ⓐ 계약 성분의 존재(의미 단위) + ⓑ 완화어의 부재**로 바꾼다.
// 완화어만으로는 통째 삭제를 못 잡고, 성분 존재만으로는 완화를 못 잡는다 — **둘을 같이** 건다.
//
// ---------------------------------------------------------------------------
// **2라운드 독립 검증이 세 곳을 더 뚫었다 — 여기서 막는다**
// 아래 셋은 전언이 아니라 재현해서 확인했다: 2판 판본을 그대로 되돌려 같은 변이를 걸면
// **네 변이 모두 11/11 green**(2026-08-26 실측). 지금 판본에서는 넷 다 red 다.
//   ① **모집단이 게이트 밖에 있었다.** 2판은 검사 대상을 배열 리터럴로 적었고, 거기서 개발
//      사본 한 줄을 지우자 그 파일에 걸린 단언 6개가 통째로 사라져 초록이 됐다.
//      그 상태에서 계약 줄을 삭제해도 초록이었다 — #345 가 막으려던 사고 그 자체다.
//      → 모집단을 **디렉터리에서 파생**시키고, 두 사본이 들어 있는지를 단언으로 건다
//        (아래 `[모집단]`). 리터럴 목록은 한 줄로 지울 수 있지만 파생 결과는 못 지운다.
//   ② **반쪽 반전을 못 물었다.** 앞절(`만든 쪽이 아니라 검증자가 내린다`)을 그대로 두고
//      뒷절의 주어만 검증자→구현자로 바꾸면 성분 검사도 완화어 검사도 전부 통과했다.
//      → **판정 술어의 직전 주어**를 보는 축을 추가한다(`verdictActorViolations`).
//   ③ **`-ㄹ 수 있다`(의무→허가)가 완화어 목록에 없었다.** `검증자가 내릴 수 있다` 는
//      의무를 허가로 격하하는데 통과했다. → 축을 추가하되 계약 블록으로만 좁히고,
//      `검증자만 …할 수 있다`(배타 허가 = 오히려 강화)는 면제한다.

const abs = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const read = (p: string) => readFileSync(abs(p), "utf8");
const anchor = read("../templates/CLAUDE.md");

/**
 * 같은 룰이 사는 두 곳 — **배포판**(낯선 사람 프로젝트로 나간다)과 **개발 사본**(이 저장소가 쓴다).
 * 한쪽만 고치는 것이 이 저장소의 상습 결함이라 둘 다 모집단이다.
 */
const RULE_DIRS = ["../templates/rules", "../.claude/rules"] as const;
const RULE_FILE = "ship-checklist.md";

/**
 * **모집단은 손으로 적지 않는다.** 디렉터리를 훑어 파일이 스스로 등록되게 한다 — 2판이
 * 배열 리터럴이라 한 줄 삭제로 모집단이 조용히 줄었고, 그 위의 단언 전부가 저절로 참이 됐다.
 * (1판은 `expect(dev).toMatch(...)` 로 파일을 직접 지목해 이 구멍이 없었다. 루프로 묶으면서
 *  모집단이 변수가 됐고, 그 변수를 아무도 안 물었다.)
 * 파일이 없으면 본문 대신 빈 문자열이 들어와 `[모집단]` 단언이 red 를 낸다.
 */
const RULES = RULE_DIRS.map((dir) => {
  const present = readdirSync(abs(dir)).includes(RULE_FILE);
  return [
    `${dir.replace(/^\.\.\//, "")}/${RULE_FILE}`,
    present ? read(`${dir}/${RULE_FILE}`) : "",
  ] as const;
});

const pick = (prefix: string): string => RULES.find(([n]) => n.startsWith(prefix))?.[1] ?? "";
const shipped = pick("templates/");

/**
 * 마크다운 블록 = 리스트 항목 하나(이어지는 들여쓴 줄 포함) 또는 문단 하나.
 * 경계는 빈 줄 · 헤딩 · 다음 리스트 항목 머리다.
 *
 * **왜 블록으로 자르는가**: 완화어 검사를 문서 전체에 걸면 계약과 무관한 항목의 완화어가
 * 계약 위반으로 잡힌다. 같은 층의 룰들이 이미 그렇다 — 배포판 `templates/rules/git-policy.md`
 * 에는 `필요할 때만`, 개발 사본 `.claude/rules/git-policy.md` 에는 `생략 가능`(브랜치 삭제
 * 옵션 설명)이 있고 둘 다 정당하다(실측 2026-08-26). 이 게이트가 무는 두 사본은 지금은
 * 문서 전체로 걸어도 안 걸리지만(배포판 8블록 / 개발 사본 24블록, 같은 날 실측) 체크리스트는
 * 자라는 문서라 같은 형태가 곧 들어온다. 통과할 수 없는 게이트는 아무도 안 돌린다는 것이
 * 이 저장소의 실측이라, 검사 범위를 계약이 사는 블록으로 좁힌다.
 *
 * **한계는 정직하게**: 계약 블록 **밖의** 별도 항목으로 붙인 면제 조항(예: 다른 줄에
 * "검증자를 못 구하면 이 항목은 건너뛴다")은 이 게이트가 못 본다. 어휘 매칭이라 우회도 가능하다.
 */
function markdownBlocks(text: string): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  const flush = () => {
    if (cur.join("\n").trim()) out.push(cur.join("\n"));
    cur = [];
  };
  for (const line of text.split("\n")) {
    const blank = /^\s*$/.test(line);
    if (blank || /^#{1,6}\s/.test(line) || /^\s*(?:[-*+]|\d+\.)\s/.test(line)) flush();
    if (!blank) cur.push(line);
  }
  flush();
  return out;
}

/** 계약이 사는 블록 = "완료"와 "판정(판단/결정)"이 같은 블록에 있는 곳. */
const DONE = /완료|완결/;
const VERDICT = /판정|판단|결정/;
const contractScope = (text: string): string =>
  markdownBlocks(text)
    .filter((b) => DONE.test(b) && VERDICT.test(b))
    .join("\n");

/** 판정을 내리는 쪽. 동의어 개정을 통과시키려면 계열로 받아야 한다. */
const VERIFIER = String.raw`검증(?:자|인|\s*레인|\s*쪽|\s*담당|하는 (?:쪽|레인|사람|이))|리뷰어|reviewer`;
/** 만든 쪽 = 판정에서 배제돼야 하는 주체. */
const PRODUCER = String.raw`만든 (?:쪽|레인|이|사람)|구현(?:자|\s*레인)|작성자|짠 (?:쪽|사람)`;
/**
 * 부정 어형. **한국어 음절은 미리 조합돼 있어 `아니` 는 `아닌` 의 부분문자열이 아니다** —
 * 어형을 하나만 적으면 정당한 동의어 개정(`아니라` → `아닌`)이 red 가 된다. 아래 [음성 대조]
 * 동의어 개정 케이스가 이 게이트를 쓰는 도중 실제로 그 결함을 잡아 줬다.
 */
const NEGATION = "아니|아닌|아님|않|못|말고|없";

/**
 * 계약 성분 ⓐ — 만든 쪽이 판정 주체에서 **배제**돼 있다. 두 어형만 받는다:
 *   ① 계사 부정 — "만든 쪽이 아니라" · "만든 레인이 아닌"
 *   ② 술어 부정 — "구현자가 판정하지 않는다" · "만든 레인은 자기 산출물을 판정하지 않는다"
 *
 * **왜 '만든 쪽 + 아무 부정어'로 넓히면 안 되는가**(변이로 발견): 개발 사본의 계약 블록은
 * `…, 구현자의 보고를 읽고 승인하는 것은 판정이 아니다` 로 끝난다. 넓은 창(24자)으로 잡으면
 * 그 꼬리절의 `아니다` 가 **배제 성분으로 오인**돼, 판정 주체를 구현자로 되돌린 반전문에서도
 * 이 성분이 초록으로 남았다. 배제는 배제 어형으로만 센다.
 */
const PRODUCER_EXCLUDED = new RegExp(
  `(?:${PRODUCER})(?:이|가|은|는)?\\s*(?:아니라|아닌|아니고|말고)` +
    `|(?:${PRODUCER})[^.\\n]{0,20}?(?:판정|판단|결정)[^.\\n]{0,6}?(?:않|못|말)`,
);

/**
 * **주체 반전 탐지** — "검증자가 아니라 …" 형태. 길이를 보존한 의미 반전의 대표형이라
 * 어절 게이트가 통째로 놓쳤던 자리다. 있으면 위반.
 */
const VERIFIER_EXCLUDED = new RegExp(
  `(?:${VERIFIER})\\s*(?:이|가|은|는)?\\s*(?:아니라|아닌|아니고|말고)`,
);

/**
 * **반쪽 반전 탐지** — 앞절은 그대로 두고 **뒷절의 주어만** 검증자→구현자로 바꾸는 형태.
 * 2라운드 검증이 이걸로 2판을 통째로 통과시켰다:
 *   `… 검증 레인이 내린다 — **구현자는** … 직접 다시 확인한 뒤 판정하고, …`
 *
 * 창(window) 길이로는 못 가른다 — 개발 사본에서 **주어~술어 거리가 정상 문안 53자 · 반전문
 * 29자**라(2026-08-26 실측) 임의의 상한 하나가 둘을 가르게 되고, 문안이 조금만 길어지면
 * 뒤집힌다. 그래서 거리 대신 **판정 술어의 직전 주어가 누구인가**를 본다.
 *
 * **한계**: "구현자가 판정한다면 위반이다" 같은 조건절도 위반으로 센다(주어가 구현자이고
 * 술어가 긍정형이라서). 계약 블록 안에서 그 문형을 쓸 이유가 없어 감수한다.
 */
const VERDICT_SUBJECT = new RegExp(
  `(?:(?<producer>${PRODUCER})|(?<verifier>${VERIFIER}))(?:이|가|은|는)`,
  "g",
);
/** 긍정형 판정 술어. `판정하지 않는다`(부정형)는 일부러 뺀다 — 그쪽은 정당한 계약문이다. */
const VERDICT_PREDICATE =
  /(?:판정|판단|결정)(?:한다|하고|하며|해야|한 뒤|하기)|내린다|내리고|내려야|낸다/g;

function verdictActorViolations(text: string): string[] {
  const subjects = [...text.matchAll(VERDICT_SUBJECT)].map((m) => ({
    at: m.index ?? 0,
    isProducer: Boolean(m.groups?.producer),
    word: m[0],
  }));
  const out: string[] = [];
  for (const pred of text.matchAll(VERDICT_PREDICATE)) {
    const nearest = subjects.filter((s) => s.at < (pred.index ?? 0)).pop();
    if (nearest?.isProducer) out.push(`${nearest.word} … ${pred[0]}`);
  }
  return out;
}

/** 계약 성분 ⓑ — 검증자가 **직접 다시** 확인한다(전언이 아니라 재실행). */
const RECHECK =
  /(?:직접|스스로|손수|본인이|자기 손으로)[^.\n]{0,24}?(?:다시|재)[^.\n]{0,10}?(?:확인|검증|실행|돌려|돌린|점검)/;

/** 계약 성분 ⓒ — 보고를 읽고 승인/결재하는 것은 판정이 **아니다**. */
const REPORT_NOT_VERDICT = new RegExp(
  `(?:보고(?:서)?|리포트|report)[^.\\n]{0,40}?(?:승인|결재|수용|동의|사인|추인)[^.\\n]{0,24}?(?:${NEGATION})`,
);

/**
 * **없어야 할 완화어** — 계약 블록 안에서 의무의 집행 강도를 내리는 어형.
 * 3번째 원소는 **면제 패턴**으로, 그 축에 한해 본문에서 지운 뒤 검사한다.
 *
 * 출처는 이 저장소의 실패 기록(씨앗 4종: `좋다`·`권장`·`가능하면`·`여유가 있으면` — 금지문이
 * 이유절로 격하돼 막던 경로를 못 막게 된 2026-08-11 사건의 처방)과 리뷰 레인이 실제로 돌린
 * 변이 형태(의무 부정·재량 허용·조건부 면제·주체 반전·의무→허가)다.
 *
 * **어형이 이 저장소에 실재하는가** — 아래 **어휘 4축**(`권고로 격하`~`재량·허용`)의 최상위
 * 어형은 35개이고, 그중 **18개가 실재 · 17개는 0회**다(추적 마크다운 381파일, 실측 2026-08-26).
 * 실재분 상위는 `권장` 158 · `필요…없` 28 · `낫다` 15 · `필요하면` 12 · `가능하면` 8,
 * 0회는 `가급적` · `해도 무방` · `권고 사항` 등이다. 다섯째 축 `의무→허가 격하` 는 어휘가
 * 아니라 문법형이라 이 계수의 대상이 아니다.
 *
 * **0회 어형을 그대로 두는 이유**: 완화가 들어올 때 쓰일 표현을 미리 못 박는 것이 이 축의
 * 목적이라, 지금 저장소에 없다는 것은 뺄 근거가 아니다. 즉 이 계수는 **어형 선정의 근거가
 * 아니라 현황**이다.
 *
 * 재현(위 정규식에서 어형을 뽑아 세고, 개별 어형은 ugrep·BSD grep 두 구현이 같은 값):
 *   `git ls-files '*.md' > /tmp/f; xargs grep -oF -- '권장' < /tmp/f | wc -l`
 * (1판 주석의 `권장 170` 등은 틀린 값이었다 — `--include='*.md'` 를 `--` 뒤에 두어 필터가
 *  경로 피연산자로 먹혔고 전 확장자 173 을 셌다. `ugrep: warning: --include=*.md` 가 났는데
 *  그 경고를 안 봤다.)
 */
const SOFTENERS: ReadonlyArray<readonly [string, RegExp, RegExp?]> = [
  ["권고로 격하", /권장|권한다|바람직|이상적이다|좋다|좋겠|낫다|원칙적으로/],
  [
    "조건부 면제",
    /가능하면|가급적|되도록|웬만하면|어지간하면|여건이 (?:되면|허락)|여유가 (?:있으면|되면)|시간이 되면|필요하면|필요할 때만|구할 수 없으면|없을 때는/,
  ],
  [
    "의무 부정",
    /필요(?:는|가)?\s?없|않아도 된다|안 해도 된다|없어도 된다|하지 않아도|생략(?:할 수 있|해도|\s?가능)/,
  ],
  [
    "재량·허용",
    /해도 된다|해도 무방|무방하다|재량|판단에 맡|자율에 맡|선택이다|선택 사항|권고 사항/,
  ],
  [
    // 의무 → 허가. 한국어의 기본 허가형이라 `내린다` 를 `내릴 수 있다` 로만 바꿔도 격하된다.
    // 면제: `검증자만 …할 수 있다` = 배타적 허가라 오히려 의무를 조인다.
    "의무→허가 격하",
    /[가-힣] 수(?:도)? (?:있다|있고|있으며|있음|있어)/,
    new RegExp(`(?:${VERIFIER})\\s*만[^.\\n]{0,24}?수(?:도)?\\s*있`, "g"),
  ],
];

const softenersIn = (text: string): string[] =>
  SOFTENERS.flatMap(([label, re, exempt]) => {
    const scanned = exempt ? text.replace(exempt, "") : text;
    const hit = scanned.match(re);
    return hit ? [`${label}(${hit[0]})`] : [];
  });

describe("#345 — 완료 판정은 만든 레인이 내리지 않는다", () => {
  it("[모집단] 배포판·개발 사본이 둘 다 검사 대상이고, 본문이 실제로 읽혔다", () => {
    // 모집단이 줄면 아래 단언들은 **red 를 내지 않고 사라진다**. 그래서 모집단 자체를 문다.
    const names = RULES.map(([n]) => n);
    expect(
      names.filter((n) => n.startsWith("templates/")),
      "배포 룰 사본이 검사 대상에서 빠졌다 — 그 파일에 걸린 단언이 통째로 사라진다",
    ).toHaveLength(1);
    expect(
      names.filter((n) => n.startsWith(".claude/")),
      "개발 룰 사본이 검사 대상에서 빠졌다 — 그 파일에 걸린 단언이 통째로 사라진다",
    ).toHaveLength(1);
    expect(names, "검사 대상은 배포판 1 + 개발 사본 1 이어야 한다").toHaveLength(2);

    for (const [name, text] of [...RULES, ["templates/CLAUDE.md", anchor] as const]) {
      expect(text.length, `${name} 가 비었다 — 이 게이트가 아무것도 안 본다`).toBeGreaterThan(200);
    }
  });

  it("두 룰 모두 완료 판정 계약을 담은 블록을 갖는다 — 통째 삭제를 여기서 잡는다", () => {
    for (const [name, text] of RULES) {
      expect(
        contractScope(text).length,
        `${name} 에 '완료 + 판정'을 함께 말하는 블록이 없다 — 계약이 통째로 사라졌다`,
      ).toBeGreaterThan(0);
    }
  });

  it("판정 주체가 만든 쪽에서 배제돼 있다 — 그리고 뒤집혀 있지 않다", () => {
    for (const [name, text] of RULES) {
      const scope = contractScope(text);
      expect(
        PRODUCER_EXCLUDED.test(scope),
        `${name}: 만든 쪽(구현자)을 판정에서 배제하는 성분이 없다`,
      ).toBe(true);
      expect(
        VERIFIER_EXCLUDED.test(scope),
        `${name}: 판정 주체가 뒤집혔다 — 검증하는 쪽을 배제하는 문장이 있다`,
      ).toBe(false);
    }
  });

  it("판정 술어의 주어가 만든 쪽이 아니다 — 뒷절만 뒤집는 '반쪽 반전'을 잡는다", () => {
    for (const [name, text] of RULES) {
      expect(
        verdictActorViolations(contractScope(text)),
        `${name}: 만든 쪽이 판정 술어의 주어다 — 앞절이 멀쩡해도 계약은 뒤집혔다`,
      ).toEqual([]);
    }
  });

  it("검증자가 **직접 다시 확인**한 뒤 판정한다는 성분이 남아 있다", () => {
    for (const [name, text] of RULES) {
      expect(
        RECHECK.test(contractScope(text)),
        `${name}: 검증자가 스스로 다시 확인한다는 요구가 사라졌다 — 판정이 전언으로 축소된다`,
      ).toBe(true);
    }
  });

  it("보고를 읽고 승인하는 것은 판정이 아니라는 성분이 남아 있다", () => {
    for (const [name, text] of RULES) {
      expect(
        REPORT_NOT_VERDICT.test(contractScope(text)),
        `${name}: '보고 결재 ≠ 판정' 조항이 사라졌다 — 검증이 결재 도장으로 축소된다`,
      ).toBe(true);
    }
  });

  it("계약 블록에 의무를 무르게 하는 완화어가 없다", () => {
    for (const [name, text] of RULES) {
      expect(softenersIn(contractScope(text)), `${name}: 계약이 완화어로 격하됐다`).toEqual([]);
    }
  });

  // ----- 탐지기 자기검증 (음성 대조) --------------------------------------
  // 초록으로 태어난 단언은 증거가 아니다. 위 단언들이 **실제 문서에서 파생한** 변이에
  // 빨간불을 내는지 여기서 보인다. 변이가 원문과 같아지면(문안이 바뀌어 치환이 no-op 이면)
  // 대조군이 조용히 무효가 되므로, 그것부터 단언한다.
  const scope = contractScope(shipped);

  it("[음성 대조] 완화어를 붙이면 잡는다", () => {
    const softened = `${scope} 단, 검증자를 구할 수 없으면 만든 쪽이 판정해도 된다.`;
    expect(softened).not.toBe(scope);
    expect(softenersIn(softened)).not.toEqual([]);
    // 성분 검사는 그대로 통과한다 — 완화어 축이 없으면 이 변이가 통째로 샌다.
    expect(PRODUCER_EXCLUDED.test(softened)).toBe(true);
    expect(RECHECK.test(softened)).toBe(true);
    expect(REPORT_NOT_VERDICT.test(softened)).toBe(true);
  });

  /**
   * 의무→허가 격하와 배타적 허가는 **한 글자(`가`/`만`) 차이**다. 같은 문장을 그 한 글자만
   * 바꿔 양쪽으로 돌린다 — 삭제·치환이 아니라 **추가**로 만드는 이유는, 정당한 동의어 개정이
   * `내린다` 를 안 쓰면 치환이 no-op 이 되어 대조군이 조용히 무효가 되기 때문이다.
   * (살아 있는 문안의 `내린다` 자체를 바꾸는 변이는 문서 쪽에서 따로 돌린다.)
   */
  const PERMISSIVE = "완료 판정은 검증자가 내릴 수 있다.";
  const EXCLUSIVE = "완료 판정은 검증자만 내릴 수 있다.";

  it("[음성 대조] 의무를 허가로 낮추면 잡는다 — `내린다` → `내릴 수 있다`", () => {
    const permissive = `${scope} ${PERMISSIVE}`;
    expect(softenersIn(permissive)).toContain("의무→허가 격하(릴 수 있다)");
    // 나머지 축은 조용하다 — 이 축이 없으면 통째로 샌다.
    expect(PRODUCER_EXCLUDED.test(permissive)).toBe(true);
    expect(VERIFIER_EXCLUDED.test(permissive)).toBe(false);
    expect(verdictActorViolations(permissive)).toEqual([]);
  });

  it("[양성 대조] 배타적 허가(`검증자만 … 할 수 있다`)는 통과한다", () => {
    expect(EXCLUSIVE, "두 대조군이 한 글자만 달라야 짝이 성립한다").toBe(
      PERMISSIVE.replace("검증자가", "검증자만"),
    );
    expect(softenersIn(`${scope} ${EXCLUSIVE}`), "배타 허가를 완화로 오탐했다").toEqual([]);
  });

  /**
   * 판정 주체를 뒤집은 변이를 **살아 있는 문안에서 파생**한다 — 배제 대상을 만든 쪽에서
   * 검증하는 쪽으로 바꿔 끼운다. 리터럴 치환으로 쓰면 정당한 동의어 개정에서 치환이 no-op
   * 이 되어 대조군이 오탐으로 red 를 낸다(실제로 그렇게 한 번 틀렸다).
   */
  function invertVerdictSubject(text: string): string {
    const excluded = text.match(PRODUCER_EXCLUDED)?.[0];
    const producer = excluded?.match(new RegExp(PRODUCER))?.[0];
    const verifier = text.match(new RegExp(VERIFIER))?.[0];
    if (!excluded || !producer || !verifier) return text;
    return text.replace(excluded, excluded.replace(producer, verifier));
  }

  it("[음성 대조] 판정 주체를 뒤집으면 잡는다", () => {
    const inverted = invertVerdictSubject(scope);
    expect(inverted, "치환이 no-op 이다 — 배제 어형을 못 찾았다면 대조군이 무효다").not.toBe(scope);
    expect(PRODUCER_EXCLUDED.test(inverted)).toBe(false);
    expect(VERIFIER_EXCLUDED.test(inverted)).toBe(true);
  });

  /**
   * **반쪽 반전** — 앞절(배제문)은 손대지 않고 뒷절에 만든 쪽을 주어로 끼워 넣는다.
   * 성분 4개(배제·주체 반전·재확인·보고≠판정)와 완화어가 **전부 통과**하는 것까지 함께
   * 단언한다. 그래야 이 변이를 무는 것이 새 축 하나뿐임이 증거로 남는다.
   */
  it("[음성 대조] 뒷절 주어만 만든 쪽으로 바꿔도 잡는다", () => {
    const half = scope.replace(/(\*\*)?\s*요구사항/, " 만든 쪽이 요구사항");
    expect(half, "치환이 no-op 이다 — 대조군이 무효다").not.toBe(scope);
    expect(verdictActorViolations(half)).not.toEqual([]);
    expect(PRODUCER_EXCLUDED.test(half)).toBe(true);
    expect(VERIFIER_EXCLUDED.test(half)).toBe(false);
    expect(RECHECK.test(half)).toBe(true);
    expect(REPORT_NOT_VERDICT.test(half)).toBe(true);
    expect(softenersIn(half)).toEqual([]);
  });

  it("[음성 대조] 성분을 지우면 잡는다", () => {
    const noRecheck = scope.replace(RECHECK, "");
    expect(noRecheck).not.toBe(scope);
    expect(RECHECK.test(noRecheck)).toBe(false);

    const noClause = scope.replace(REPORT_NOT_VERDICT, "");
    expect(noClause).not.toBe(scope);
    expect(REPORT_NOT_VERDICT.test(noClause)).toBe(false);
  });

  it("[음성 대조] 동의어 개정은 통과한다 — 막지 말아야 할 쪽", () => {
    const reworded =
      "- **완료 여부는 만든 쪽이 아닌 검증하는 쪽이 판단한다.** 요구사항·변경분·검증 결과를 " +
      "**스스로 다시 검증**한 뒤 판단한다 — 제출된 보고서를 그대로 결재하는 것은 판단이 아니다.";
    expect(DONE.test(reworded) && VERDICT.test(reworded)).toBe(true);
    expect(PRODUCER_EXCLUDED.test(reworded)).toBe(true);
    expect(VERIFIER_EXCLUDED.test(reworded)).toBe(false);
    expect(verdictActorViolations(reworded)).toEqual([]);
    expect(RECHECK.test(reworded)).toBe(true);
    expect(REPORT_NOT_VERDICT.test(reworded)).toBe(true);
    expect(softenersIn(reworded)).toEqual([]);
  });

  it("앵커는 이 계약을 담지 않는다 — 룰에 두는 근거가 유지되는지 본다", () => {
    // 앵커가 나중에 같은 것을 담게 되면 이 룰 줄은 중복이 되고, 그때 이 테스트가 red 로
    // 알려 준다(중복을 방치하는 것도 이 저장소가 고치는 형태다 — ADR-070).
    expect(anchor).toMatch(
      /Independent review by an agent or person other than the one that produced/,
    );
    expect(anchor).not.toMatch(/verifier (issues|owns) the (completion )?verdict/i);
  });
});

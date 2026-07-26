import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type AgentsMdParams,
  renderAgentsMd as renderCodexAgentsMd,
} from "../src/codex/agents-md.js";
import { renderAgentsMd as renderOpencodeAgentsMd } from "../src/opencode/agents-md.js";
import { renderFillScaffold } from "../src/project-claude-merge.js";
import { CLI_BASES, type CliBase } from "../src/types.js";

/**
 * 레인 원칙(만든 레인은 자기 산출물을 판정하지 않는다)이 **모든 앵커에 도달하는지**.
 *
 * 왜 필요한가: 이 원칙의 선행 판본(ADR-052 "Delegate the Building")은 배포 앵커에서
 * **비대칭으로** 살았다 — claude 템플릿에만 문안이 있고, 임베드를 타고 나가는 3 CLI 앵커에는
 * 사실이 아닌 문장이 실려 나갔다. 원칙이 앵커 하나에만 있으면 그 앵커를 안 쓰는 설치자는
 * "구현자가 자기 산출물을 판정한다"는 실패 유형을 매 세션 그대로 반복한다.
 *
 * 그래서 이 게이트가 지키는 것은 문구가 아니라 **도달**이다:
 *   ① 대상은 **렌더 산출물** — 템플릿 파일을 세면 임베드 때문에 틀린 답이 나온다
 *      (`no-false-ship` §"templates/ 만 보면 놓친다 — 생성물은 원본을 대신 본다").
 *   ② 앵커 집합은 **CLI 목록 SSOT(`CLI_BASES`)에서 derive** — 글롭은 새 CLI 가 다른
 *      파일명으로 앵커를 내면 조용히 통과한다.
 *   ③ 이 리포 앵커(`.claude/CLAUDE.md`)도 대상 — 자기를 면제하면 위 비대칭이 재생산된다.
 *   ④ 판정은 리터럴 문구가 아니라 **2성분 동시 존재**(산출물 명사 + 비생산 레인 술어).
 *      앵커마다 언어와 표현이 다르므로(배포판 영어 / 이 리포 한국어) 문구를 세면 게이트가
 *      의미 대신 서식을 센다.
 *
 * **스코프 = 문단** (ADR-055/E6-1 로 절 슬라이스에서 개정). 배포 앵커가 6원칙 구조로 바뀌면서
 * 원칙 문장이 한 절이 아니라 **원칙 1·원칙 4·맨끝 절에 분산**됐다. 그래서 절 슬라이스는 성립하지
 * 않는다. 그렇다고 **전체 파일 채점으로 내려가면 게이트가 절반 무력화된다** — 설계 리뷰가 실증:
 * 원칙 문장을 하나도 넣지 않은 기준선 원본도 축1·축3 이 초록이 된다(낱말이 파일 어딘가에 흩어져
 * 있기만 하면 통과). 이 게이트의 의도는 성분의 **짝**이고, 짝을 보장하던 것이 스코프였다.
 * 문단 스코프는 분산 배치를 허용하면서 짝 보장을 되살린다.
 *
 * 어휘 목록은 **이 테스트가 소유한다** — 앵커마다 동기화하지 않는다.
 *
 * 이 파일은 원칙 자신에 따라 **산출물을 만든 레인이 아닌 레인이** 썼다.
 */

const REPO_ROOT = resolve(__dirname, "..");
const TEMPLATES = join(REPO_ROOT, "templates");
const REPO_ANCHOR = join(REPO_ROOT, ".claude/CLAUDE.md");

/**
 * 채점 전 정규화. **줄바꿈이 술어를 쪼개는 것**을 막는다 — 정규화가 없으면 내용이 같은데
 * 문단 재배치만으로 축이 실패한다(설계 리뷰가 기계 채점으로 실제 적발). emphasis 마커도 같은
 * 이유로 지운다: `**작성자가 아닌**` 처럼 강조가 성분 중간에 들어가면 서식이 판정을 흔든다.
 * **게이트가 서식에 반응하면 의미를 세는 게 아니다.**
 */
function normalize(text: string): string {
  return text.replace(/\*+/g, "").replace(/\s+/g, " ").trim();
}

/** 문단 = 빈 줄로 나뉜 블록. 채점 단위 (전체 파일 아님 — 위 헤더 주석의 이유). */
function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map(normalize)
    .filter((p) => p.length > 0);
}

/** 앵커의 도달 범위. 축 적용 범위가 여기서 갈린다. */
type Origin = "shipped" | "repo";

/**
 * 축 = 원칙이 실제로 막는 실패 하나씩. 각 축은 ⓐ 산출물 명사 ⓑ **그것을 만든 레인이 아닌
 * 쪽**을 가리키는 술어의 2성분으로 판정하고, 두 성분이 **같은 문단**에 있어야 한다.
 *
 * 축 수를 코드 문장에 적지 않는다 — 배열이 자라면 문장이 어긋난다(`ratchet` 이 트랙 목록에
 * 쓰는 것과 같은 형태).
 *
 * **없어진 축 — "테스트 작성 분리"**: 사용자 결정으로 **기각**됐다(2026-07-26:
 * *"테스트 누가 작성하던 테스트케이스도 결국 코딩이니깐 리뷰어가 검증할거야"*). 즉 분리 요구는
 * **작성**이 아니라 **리뷰**에 걸리고, 그 몫은 축1(설계 리뷰 분리)·축4(검증의 자기 증거)가 이미
 * 진다. 이 기록을 남기는 이유: 같은 사용자의 **앞선** 지시가 *"테스트 생성도 독립 에이전트"* 였고
 * 두 지시는 시간순으로 충돌하며 **뒤가 이긴다.** 안 적으면 다음 세션이 앞선 지시만 보고 되살린다.
 */
const AXES = [
  {
    id: "설계 리뷰 분리",
    scope: "all" as const,
    why: "산출물을 만든 레인이 아닌 쪽이 기획서를 읽는다 — 작성자는 자기가 안 적은 요구를 볼 수 없다",
    artifact: /spec|PRD|plan|기획서|계획/i,
    lane: /other than the (?:one|lane|agent) (?:that|who) produced|other than the author|not (?:its|the) author|작성자가 아닌|작성자와 다른|만든 레인이 아닌/i,
  },
  {
    // **리포 앵커 전용.** 배포 앵커에서 뺀 이유는 문안 취향이 아니라 **도달 범위**다:
    // `implementer` 에이전트는 `DEV_AGENTS`(claude · dev 트랙)로만 설치되는데, 배포 앵커는
    // 4 CLI · 전 트랙에 나간다 → 배포판에 쓰면 설치 절반에서 없는 것을 지시하는 거짓 문장이
    // 된다(ADR-052 가 CRITICAL 로 기록한 형태 그 자체). 이 리포에는 `.claude/agents/implementer.md`
    // 가 실재하므로 리포 앵커에서는 문다.
    id: "구현 위임",
    scope: "repo" as const,
    why: "구현은 별 레인/서브에이전트로 넘긴다 — 안 그러면 설계·구현·검증이 한 액터에 합쳐진다",
    artifact: /implementer|implementation|구현/i,
    lane: /delegat|위임/i,
  },
  {
    id: "검증의 자기 증거",
    scope: "all" as const,
    why: "검증은 만든 쪽의 보고를 읽는 대신 직접 다시 돌려 증거를 얻는다",
    artifact: /verification|verifying|검증/i,
    lane: /verifies the work itself|rather than trusting|its own evidence|re-?run|직접 다시 돌려|직접 재실행|스스로 다시/i,
  },
  {
    id: "적대적 패널의 문턱",
    scope: "all" as const,
    why:
      "패널은 **되돌리기 비싼** 결정에만 — 문턱이 없으면 사소한 것까지 패널을 돌리게 되고 " +
      "그건 사용자가 명시적으로 금지한 형태다. 문턱 판별자 어휘는 앵커마다 다르다" +
      "(배포판 `expensive to reverse` / 이 리포 `Major CR`) — 성분 판정이라 둘 다 통과한다",
    artifact: /adversarial[^.]{0,40}panel|적대적 다면|적대적 페르소나|다면 페르소나/i,
    lane: /expensive to reverse|hard to reverse|cannot (?:be )?(?:undone|reversed)|Major CR|되돌리기 (?:어려|비싼|비싸|힘든)|되돌릴 수 없/i,
  },
] as const;

type Axis = (typeof AXES)[number];

/** 앵커 도달 범위에 걸리는 축만. 근거는 위 "구현 위임" 축의 주석. */
function axesFor(origin: Origin): Axis[] {
  return AXES.filter((axis) => axis.scope === "all" || axis.scope === origin);
}

interface Anchor {
  /** CLI 앵커면 CLI id, 리포 앵커면 경로. */
  id: string;
  label: string;
  origin: Origin;
  text: string;
}

type Renderer = (params: AgentsMdParams) => string;

/**
 * cli → **프로덕션이 실제로 쓰는** 렌더러. antigravity 는 `src/antigravity/transform.ts` 가
 * codex 렌더러를 재사용한다. 새 CLI 가 `CLI_BASES` 에 들어오면 여기서 `null` 이 되고,
 * 아래 "앵커 수 == CLI_BASES.length" 단언이 그것을 문다 — 조용히 건너뛰지 않는다.
 */
function rendererFor(cli: CliBase): Renderer | null {
  switch (cli) {
    case "codex":
    case "antigravity":
      return renderCodexAgentsMd;
    case "opencode":
      return renderOpencodeAgentsMd;
    default:
      return null;
  }
}

/** 임베드가 살아 있는지 볼 probe — 리터럴이 아니라 CLAUDE.md 자신에서 뽑는다. */
function embedProbe(claudeMd: string): string {
  const line = claudeMd
    .split("\n")
    .slice(1)
    .find((l) => normalize(l).length > 20 && !l.startsWith("#"));
  if (!line) throw new Error("templates/CLAUDE.md 에서 임베드 probe 로 쓸 줄을 못 찾았다");
  return normalize(line);
}

/**
 * CLI 유래 앵커. claude 는 렌더를 거치지 않는다 — `templates/CLAUDE.md` 가 그대로
 * `.claude/CLAUDE.md` 로 설치된다(`src/manifest.ts` CLAUDE.md 항목). 나머지는 그 본문을
 * `{PROJECT_RULES}` 로 임베드한 **렌더 산출물**이다.
 */
function cliAnchors(): Anchor[] {
  const claudeMd = readFileSync(join(TEMPLATES, "CLAUDE.md"), "utf8");
  const anchors: Anchor[] = [];
  for (const cli of CLI_BASES) {
    if (cli === "claude") {
      anchors.push({
        id: cli,
        label: "templates/CLAUDE.md (설치 시 .claude/CLAUDE.md)",
        origin: "shipped",
        text: claudeMd,
      });
      continue;
    }
    const render = rendererFor(cli);
    const templatePath = join(TEMPLATES, cli, "AGENTS.md.template");
    if (!render || !existsSync(templatePath)) continue;
    anchors.push({
      id: cli,
      label: `renderAgentsMd(${cli})`,
      origin: "shipped",
      text: render({
        template: readFileSync(templatePath, "utf8"),
        claudeMd,
        projectName: "gate-fixture",
        projectContext: renderFillScaffold(),
      }),
    });
  }
  return anchors;
}

/** 이 리포 앵커 — CLI 앵커와 **수를 섞지 않는다**(off-by-one 으로 새는 지점). */
function repoAnchors(): Anchor[] {
  if (!existsSync(REPO_ANCHOR)) return [];
  return [
    {
      id: ".claude/CLAUDE.md",
      label: ".claude/CLAUDE.md",
      origin: "repo",
      text: readFileSync(REPO_ANCHOR, "utf8"),
    },
  ];
}

/**
 * 두 성분이 **한 문단 안에** 같이 있는가. 통과면 빈 배열, 아니면 실패 사유.
 *
 * 사유를 두 갈래로 나눠 돌리는 이유: "성분이 아예 없다"와 "성분은 있는데 짝이 아니다"는 고치는
 * 방법이 다르다(넣기 vs 합치기). **그리고 후자를 빈 배열로 돌리면 게이트가 전체 파일 채점으로
 * 퇴화한다** — 실제로 이 함수의 첫 판본이 그랬고, 위 문단 스코프 canary 가 그것을 잡았다.
 */
function missingComponents(paragraphs: string[], axis: Axis): string[] {
  if (paragraphs.some((p) => axis.artifact.test(p) && axis.lane.test(p))) return [];
  const absent = [
    paragraphs.some((p) => axis.artifact.test(p)) ? null : `산출물 명사 (${axis.artifact.source})`,
    paragraphs.some((p) => axis.lane.test(p)) ? null : `비생산 레인 술어 (${axis.lane.source})`,
  ].filter((x) => x !== null);
  return absent.length > 0
    ? absent
    : ["두 성분이 **서로 다른 문단**에 흩어져 있다 — 한 문단 안에 같이 두어라 (짝 없음)"];
}

const CLI_ANCHORS = cliAnchors();
const REPO_ANCHORS = repoAnchors();
const ALL_ANCHORS = [...CLI_ANCHORS, ...REPO_ANCHORS];

describe("레인 원칙의 앵커 도달 (렌더 산출물 대상 · 앵커 집합 derive · 문단 스코프)", () => {
  it("CLI 앵커 수가 CLI 목록 SSOT 와 정확히 같다 (헛통과 차단)", () => {
    // `>=` 로 쓰면 CLI 앵커 하나가 사라져도 리포 앵커가 자리를 메워 통과한다(off-by-one) —
    // derive 를 넣은 목적이 바로 그 지점에서 새어나간다. 그래서 `==` 이고, 리포 앵커는 별도다.
    expect(
      CLI_ANCHORS.map((a) => a.id).sort(),
      "CLI 앵커를 CLI_BASES 전부에 대해 해석하지 못했다 — 새 CLI 가 다른 파일명으로 앵커를 " +
        "내면 이 게이트가 그것을 못 보고 지나간다. `rendererFor` 와 templates/<cli>/ 레이아웃을 확인하라.",
    ).toEqual([...CLI_BASES].sort());
    expect(CLI_ANCHORS).toHaveLength(CLI_BASES.length);
  });

  it("리포 앵커를 CLI 앵커와 별도로 센다", () => {
    expect(
      REPO_ANCHORS,
      `${REPO_ANCHOR} 를 못 읽었다 — 이 리포 앵커는 면제 대상이 아니다`,
    ).toHaveLength(1);
    expect(CLI_ANCHORS.map((a) => a.id)).not.toContain(".claude/CLAUDE.md");
  });

  it.each(
    CLI_ANCHORS.filter((a) => a.id !== "claude").map((a) => [a.id, a] as const),
  )("%s 앵커는 CLAUDE.md 본문을 실제로 임베드한 렌더 산출물이다", (_id, anchor) => {
    // 임베드가 죽으면 아래 축 단언이 "성분이 없다"로 실패하는데, 원인은 문안이 아니라 렌더다.
    // 두 실패를 구분해 두지 않으면 구현 레인이 엉뚱한 곳을 고친다.
    const claudeMd = readFileSync(join(TEMPLATES, "CLAUDE.md"), "utf8");
    expect(anchor.text).not.toContain("{PROJECT_RULES}");
    expect(
      normalize(anchor.text),
      `${anchor.label} 이 templates/CLAUDE.md 본문을 임베드하지 않았다 — 이 앵커는 원칙을 ` +
        "포함할 방법이 없다. 템플릿의 {PROJECT_RULES} placeholder 를 확인하라.",
    ).toContain(embedProbe(claudeMd));
  });

  it.each(
    ALL_ANCHORS.map((a) => [a.id, a] as const),
  )("%s 앵커가 문단으로 쪼개진다 (스코프가 전체 파일로 퇴화하지 않았는가)", (_id, anchor) => {
    // 스플리터가 깨져 문단이 1개가 되면 이 게이트는 조용히 **전체 파일 채점**으로 퇴화한다 —
    // 그 형태는 설계 리뷰가 반증한 것(원칙 0문장 원본도 초록)이라 초록불이 무의미해진다.
    expect(
      paragraphsOf(anchor.text).length,
      `${anchor.label} 이 문단으로 안 쪼개진다 — 문단 스코프가 죽으면 짝 보장이 사라진다.`,
    ).toBeGreaterThan(5);
  });

  it("두 성분이 서로 다른 문단에 있으면 통과하지 않는다 (문단 스코프 canary)", () => {
    // 이 단언이 이 개정의 핵심이다. 스코프가 문단이 아니라 파일이면 아래 fixture 가 통과하고,
    // 그 순간 게이트는 "낱말이 파일 어딘가 있다"만 확인하는 것이 된다.
    const axis = AXES.find((a) => a.id === "적대적 패널의 문턱");
    if (!axis) throw new Error("canary 대상 축을 못 찾았다 — 축 id 가 바뀌면 이 canary 도 고쳐라");
    const split = [
      "We convene an adversarial panel of independent reviewers.",
      "Some calls are expensive to reverse.",
    ];
    const together = [
      "Calls that are expensive to reverse go to an adversarial panel of independent reviewers.",
    ];
    expect(missingComponents(split, axis), "성분이 다른 문단에 흩어져 있는데 통과했다").not.toEqual(
      [],
    );
    expect(missingComponents(together, axis), "성분이 한 문단에 같이 있는데 실패했다").toEqual([]);
  });

  it.each(
    ALL_ANCHORS.flatMap((anchor) =>
      axesFor(anchor.origin).map((axis) => [anchor.id, axis.id, anchor, axis] as const),
    ),
  )("%s 앵커의 [%s] 축이 2성분을 한 문단 안에 갖는다", (_aid, _axid, anchor, axis) => {
    const missing = missingComponents(paragraphsOf(anchor.text), axis);
    expect(
      missing,
      `${anchor.label} 에서 [${axis.id}] 축의 성분이 **같은 문단에** 없다.\n` +
        `  왜 이 축인가: ${axis.why}\n` +
        "  판정은 리터럴 문구가 아니라 2성분 동시 존재다 — 표현을 바꿔도 두 성분이 한 문단에\n" +
        "  남아 있으면 통과한다. 빠진 성분이 아래 목록에 있으면 그 성분을 넣고, 목록이 비어\n" +
        "  있으면 두 성분이 **다른 문단으로 쪼개진** 것이다(문단을 합쳐라).",
    ).toEqual([]);
  });
});

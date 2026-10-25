import { describe, expect, it } from "vitest";
import {
  FILL_SECTIONS,
  isUnfilledScaffold,
  mergeProjectClaude,
  renderFillScaffold,
  scaffoldBanner,
  stripHarnessImport,
  upsertHarnessImport,
  withContinuousSkillsNote,
} from "../src/project-claude-merge.js";

describe("renderFillScaffold — the shared project-context scaffold", () => {
  it("emits every MUST-HAVE section as a self-contained FILL comment (exhaustive)", () => {
    // Intent: a section without a FILL prompt would ship as an empty header — the exact
    // "meaningless content" this redesign removes. Every id must carry an actionable prompt.
    const out = renderFillScaffold();
    for (const id of FILL_SECTIONS) {
      expect(out).toContain(`<!-- FILL:${id} —`);
    }
  });

  it("ships an honest placeholder for every section so an unfilled file states no false fact", () => {
    // Intent: the old fragment shipped a Bash stack to every project — affirmatively wrong.
    // An unfilled section must read as "not filled yet", never as a verified fact.
    const out = renderFillScaffold();
    const placeholders = out.match(/_\(not filled yet — /g) ?? [];
    expect(placeholders).toHaveLength(FILL_SECTIONS.length);
  });

  it("leads with the visible SCAFFOLD banner (HTML FILL comments are invisible in a preview)", () => {
    expect(renderFillScaffold().startsWith(scaffoldBanner("claude"))).toBe(true);
    expect(scaffoldBanner("claude")).toContain("SCAFFOLD");
  });

  // #305 — 한 문장이 네 표면에 글자 그대로 나가면서, 그 파일이 앵커인 세 곳에서 거짓이 됐다.
  //   실측: AGENTS.md 안의 import 문 0건인데 "imported from this file", 원칙 절 7개인데
  //   "project-specific context only". 읽은 사람은 원칙을 찾아 다른 파일로 갔고, Codex 단독
  //   설치에는 그 파일이 아예 없다. 그래서 배너의 앵커 줄만 표면별로 갈린다.
  it("앵커 줄이 표면마다 그 파일에 대해 참이다 (#305)", () => {
    const claude = scaffoldBanner("claude");
    expect(claude, "Claude 쪽은 앵커를 import 한다고 말해야 한다").toContain(
      "imported at the bottom of this file",
    );
    expect(claude).toContain("project-specific context only");

    // ADR-103 — Antigravity 도 `AGENTS.md` 를 앵커로 읽는다(옛 `antigravity-rule` 표면은 은퇴).
    for (const surface of ["agents-md"] as const) {
      const b = scaffoldBanner(surface);
      // 그 파일이 앵커다 — 딴 데를 가리키면 없는 파일로 보낸다.
      expect(b, `${surface}: 자기가 앵커임을 말해야 한다`).toContain("is the harness anchor");
      // 있지도 않은 import 를 주장하면 안 된다.
      expect(b, `${surface}: import 를 주장하면 안 된다`).not.toContain("imported");
      // "이 파일은 컨텍스트만 담는다" 는 원칙 7절을 담은 파일에서 거짓이다.
      expect(b, `${surface}: 컨텍스트 전용이라 말하면 안 된다`).not.toContain(
        "project-specific context only",
      );
    }
    // 자기 파일 이름을 스스로 부른다 (다른 표면 이름을 부르면 지시대상이 흔들린다).
    expect(scaffoldBanner("agents-md")).toContain("`AGENTS.md`");
  });

  // #631 둘째 축 — 네 표면이 같은 스캐폴드를 받으므로 FILL 안내 한 문장이 네 CLI 의 실제 자리를 말해야 한다.
  //   전에는 `.claude/rules/*.md …` 만 말해 Antigravity 단독 설치에는 없는 경로로 보냈다.
  it("installed-assets FILL 이 CLI 마다 실제로 읽는 자리를 댄다 (#631)", () => {
    const fill = renderFillScaffold("agents-md")
      .split("\n")
      .find((l) => l.startsWith("<!-- FILL:installed-assets"));
    expect(fill).toBeDefined();
    expect(fill).toContain(".agents/rules/");
    expect(fill).toContain("AGENTS.md § Harness Rules");
    expect(fill).toContain(".claude/rules/");
    expect(fill).not.toContain("(or this CLI's equivalent)");
  });
});

/**
 * v26.165.0 독립 검증 BLOCKER-2 — "채웠는가" 는 하네스가 쓴 줄(배너 · FILL 주석 · 상시 스킬 안내)을 뗀 뒤 판정한다.
 * FILL 문구를 바꾼 이 릴리즈가 옛 판의 안 채운 스캐폴드를 "채웠다" 로 읽으면, 옛 스캐폴드가 설치자 글로 옮겨 가고
 * uninstall 이 스캐폴드만 든 파일을 남긴다.
 */
describe("isUnfilledScaffold — 하네스 줄을 뗀 뒤 판정한다 (BLOCKER-2)", () => {
  /** v26.164.0 판 FILL 문구 — 이 릴리즈가 바꾸기 전의 바이트. */
  const OLD_FILL =
    "Verify against .claude/rules/*.md, .claude/skills/, .claude/agents/, .claude/commands/ (or this CLI's equivalent) and list";
  const NEW_FILL = "Verify against the harness folders this CLI reads";

  function oldScaffold(): string {
    const now = renderFillScaffold("agents-md");
    const at = now.indexOf(NEW_FILL);
    expect(at, "픽스처 자기검증 — 지금 판에 새 문구가 있어야 옛 판을 재현한다").toBeGreaterThan(-1);
    const end = now.indexOf(" and list", at) + " and list".length;
    return `${now.slice(0, at)}${OLD_FILL}${now.slice(end)}`;
  }

  it("옛 문구 스캐폴드(안 채움)는 안 채운 것이다", () => {
    expect(oldScaffold()).toContain("(or this CLI's equivalent)");
    expect(isUnfilledScaffold(oldScaffold().split("\n"))).toBe(true);
  });

  it("마커 없는 상시 스킬 안내가 붙어 있어도 안 채운 것이다", () => {
    const withNote = withContinuousSkillsNote(oldScaffold(), ["user-centered-explanation"]);
    expect(withNote).toContain("## Skills that apply continuously");
    expect(isUnfilledScaffold(withNote.split("\n"))).toBe(true);
  });

  it("FILL 주석만 지우고 자리표시자를 남긴 것도 안 채운 것이다", () => {
    const noComments = renderFillScaffold("agents-md")
      .split("\n")
      .filter((l) => !l.startsWith("<!-- FILL:"));
    expect(isUnfilledScaffold(noComments)).toBe(true);
  });

  it("#862 배너 인용 블록에 이어 적은 설치자 인용 줄도 채운 것이다 — 배너는 하네스가 쓴 줄과 똑같은 줄만 뗀다", () => {
    const banner = scaffoldBanner("agents-md");
    const scaffold = renderFillScaffold("agents-md");
    expect(scaffold, "픽스처 자기검증 — 스캐폴드가 배너로 시작한다").toContain(banner);
    const noted = scaffold.replace(banner, `${banner}\n> MY NOTE — 결제 팀 저장소.`);
    expect(isUnfilledScaffold(noted.split("\n"))).toBe(false);
  });

  it("회귀 — 옛 판 배너 문구 · 트랙 안내 줄(v26.140.0 이하 루트 CLAUDE.md 머리)은 하네스 줄이다", () => {
    const old =
      "> The universal harness rules (Rule 1–12) live in the separate rules layer. This file is **project-specific context only**.";
    const scaffold = renderFillScaffold("agents-md").replace(
      scaffoldBanner("agents-md").split("\n")[2] ?? "",
      old,
    );
    expect(scaffold, "픽스처 자기검증 — 옛 셋째 줄로 바꿨다").toContain(old);
    expect(isUnfilledScaffold(`> Active track(s): Tooling\n\n${scaffold}`.split("\n"))).toBe(true);
  });

  it("설치자 문장이 한 줄이라도 있으면 채운 것이다 — 안내 뒤에 적은 문단도", () => {
    const filled = `${renderFillScaffold("agents-md")}\n\nWe ship on Fridays.`;
    expect(isUnfilledScaffold(filled.split("\n"))).toBe(false);
    const afterNote = `${withContinuousSkillsNote(renderFillScaffold("agents-md"), ["user-centered-explanation"])}\n\nWe ship on Fridays.`;
    expect(isUnfilledScaffold(afterNote.split("\n"))).toBe(false);
  });
});

describe("mergeProjectClaude — the delivered project-root CLAUDE.md", () => {
  it("uses the real project name as the H1 (fixes the shipped `# [Project Name]` literal)", () => {
    // Intent: this is the single most visible boilerplate bug — the literal placeholder title
    // shipped verbatim to every project. It must be replaced with the real basename.
    const out = mergeProjectClaude({ projectName: "my-real-app" });
    expect(out.startsWith("# my-real-app\n")).toBe(true);
    expect(out).not.toContain("[Project Name]");
    expect(out).not.toContain("{PROJECT_NAME}");
  });

  it("does not write an active-track note — the root file cannot be kept current (#833)", () => {
    // 루트 CLAUDE.md 는 설치자 파일이라 트랙을 더하거나 빼도 이 줄을 갱신할 수 없다 — 낡은 안내를
    // 매 세션 읽히느니 쓰지 않는다. 트랙의 SSOT 는 설치 기록(`list`)이다.
    const out = mergeProjectClaude({ projectName: "app" });
    expect(out).not.toContain("Active track(s)");
    expect(out.startsWith("# app\n\n")).toBe(true);
  });

  it("embeds the shared scaffold verbatim (single source of truth with AGENTS.md)", () => {
    // Intent: CLAUDE.md and every AGENTS.md {PROJECT_CONTEXT} must come from one source so the
    // FILL prompts are byte-identical across all 4 CLIs. Proven by containment of the exact body.
    const out = mergeProjectClaude({ projectName: "app" });
    expect(out).toContain(renderFillScaffold());
  });
});

/**
 * `tests/claude-md-import.test.ts` (P5 계약)가 세우지 않는 두 경계. 구현 중 드러났다:
 *
 *  ⓐ **마커 검출**이 실제로 필요한 자리 — 사용자가 블록 안쪽 import 줄을 고치거나 지운
 *     경우다. 줄 스캔만으로 판정하면 그때 블록이 하나 더 붙어 재설치마다 파일이 자란다.
 *     (계약 테스트의 idempotent 케이스는 줄 스캔만으로도 통과해서 이 분기를 안 문다.)
 *  ⓑ **회수(strip)** — uninstall 이 무는 반대 방향. 넣는 것만 검증하면 앵커를 지운 뒤
 *     끊긴 참조가 남는다.
 */
describe("upsertHarnessImport / stripHarnessImport — 구현 중 드러난 경계", () => {
  it("마커 블록이 있으면 블록을 또 붙이지 않고 **그 안만** 현행으로 되돌린다 (ADR-085)", () => {
    const once = upsertHarnessImport("# p\n", { projectName: "p" });
    // 사용자가 블록 안쪽 줄만 지운 상태 (마커는 남아 있다).
    const edited = once.replace("\n@CLAUDE-uzys-harness.md", "");
    const out = upsertHarnessImport(edited, { projectName: "p" });
    // 마커 안은 하네스 소유다 — 상시 스킬 안내가 선택에 따라 바뀌어야 하므로 블록 본문을
    // 다시 렌더한다. 그 결과 지워진 import 줄도 돌아온다. 하네스를 빼려면 블록째 지운다(strip).
    // 2026-09-13 전에는 "안쪽만 지운 상태를 그대로 둔다"였다 — 그때는 블록 안이 한 줄뿐이라
    // 현행화할 것이 없었다.
    expect(out).toBe(once);
    expect(out.split("<!-- uzys-harness:import:start -->")).toHaveLength(2); // 블록 1개
  });

  it("strip 은 하네스 블록만 걷어내 설치 전 내용으로 되돌린다 (바이트 동일)", () => {
    const user = "# 내 프로젝트\n\n팀 규칙:\n- 커밋은 한국어로\n";
    const installed = upsertHarnessImport(user, { projectName: "p" });
    expect(installed).not.toBe(user); // 전제: 실제로 뭔가 붙었다 (헛통과 차단)
    expect(stripHarnessImport(installed)).toBe(user);
  });

  it("우리가 만든 파일도 strip 하면 스캐폴드만 남는다 — 사용자 파일은 지우지 않는다", () => {
    const created = upsertHarnessImport(null, { projectName: "p" });
    const stripped = stripHarnessImport(created);
    expect(stripped).toBe(mergeProjectClaude({ projectName: "p" }));
    expect(stripped).not.toContain("@CLAUDE-uzys-harness.md");
  });

  it("마커가 없으면 null — 손댄 적 없는 파일은 아예 만지지 않는다", () => {
    expect(stripHarnessImport("# 남의 파일\n\n내용\n")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  FILL_SECTIONS,
  mergeProjectClaude,
  renderFillScaffold,
  scaffoldBanner,
  stripHarnessImport,
  TRACK_DISPLAY_NAMES,
  upsertHarnessImport,
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

    for (const surface of ["agents-md", "antigravity-rule"] as const) {
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
    expect(scaffoldBanner("antigravity-rule")).toContain(".agents/rules/uzys-harness.md");
  });
});

describe("mergeProjectClaude — the delivered project-root CLAUDE.md", () => {
  it("uses the real project name as the H1 (fixes the shipped `# [Project Name]` literal)", () => {
    // Intent: this is the single most visible boilerplate bug — the literal placeholder title
    // shipped verbatim to every project. It must be replaced with the real basename.
    const out = mergeProjectClaude({ projectName: "my-real-app", tracks: ["tooling"] });
    expect(out.startsWith("# my-real-app\n")).toBe(true);
    expect(out).not.toContain("[Project Name]");
    expect(out).not.toContain("{PROJECT_NAME}");
  });

  it("records the selected tracks as install metadata using display names", () => {
    const out = mergeProjectClaude({ projectName: "app", tracks: ["tooling", "data"] });
    expect(out).toContain("> Active track(s): Tooling, Data");
  });

  it("embeds the shared scaffold verbatim (single source of truth with AGENTS.md)", () => {
    // Intent: CLAUDE.md and every AGENTS.md {PROJECT_CONTEXT} must come from one source so the
    // FILL prompts are byte-identical across all 4 CLIs. Proven by containment of the exact body.
    const out = mergeProjectClaude({ projectName: "app", tracks: ["tooling"] });
    expect(out).toContain(renderFillScaffold());
  });

  it("expands 'full' to every non-full track in the metadata note", () => {
    const out = mergeProjectClaude({ projectName: "app", tracks: ["full"] });
    for (const t of [
      "tooling",
      "csr-fastapi",
      "csr-fastify",
      "csr-supabase",
      "ssr-htmx",
      "ssr-nextjs",
      "data",
      "executive",
      "project-management",
      "growth-marketing",
    ] as const) {
      expect(out).toContain(TRACK_DISPLAY_NAMES[t]);
    }
    expect(out).not.toContain("Full");
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
  it("마커 블록이 있으면 안쪽 import 줄이 사라졌어도 블록을 또 붙이지 않는다", () => {
    const once = upsertHarnessImport("# p\n", { projectName: "p", tracks: ["tooling"] });
    // 사용자가 블록 안쪽 줄만 지운 상태 (마커는 남아 있다).
    const edited = once.replace("\n@CLAUDE-uzys-harness.md", "");
    const out = upsertHarnessImport(edited, { projectName: "p", tracks: ["tooling"] });
    expect(out).toBe(edited);
    expect(out.split("<!-- uzys-harness:import:start -->")).toHaveLength(2); // 블록 1개
  });

  it("strip 은 하네스 블록만 걷어내 설치 전 내용으로 되돌린다 (바이트 동일)", () => {
    const user = "# 내 프로젝트\n\n팀 규칙:\n- 커밋은 한국어로\n";
    const installed = upsertHarnessImport(user, { projectName: "p", tracks: ["tooling"] });
    expect(installed).not.toBe(user); // 전제: 실제로 뭔가 붙었다 (헛통과 차단)
    expect(stripHarnessImport(installed)).toBe(user);
  });

  it("우리가 만든 파일도 strip 하면 스캐폴드만 남는다 — 사용자 파일은 지우지 않는다", () => {
    const created = upsertHarnessImport(null, { projectName: "p", tracks: ["tooling"] });
    const stripped = stripHarnessImport(created);
    expect(stripped).toBe(mergeProjectClaude({ projectName: "p", tracks: ["tooling"] }));
    expect(stripped).not.toContain("@CLAUDE-uzys-harness.md");
  });

  it("마커가 없으면 null — 손댄 적 없는 파일은 아예 만지지 않는다", () => {
    expect(stripHarnessImport("# 남의 파일\n\n내용\n")).toBeNull();
  });
});

describe("mergeProjectClaude — display names", () => {
  it("exposes all 11 track display names (R3)", () => {
    expect(TRACK_DISPLAY_NAMES["csr-fastapi"]).toBe("CSR FastAPI");
    expect(TRACK_DISPLAY_NAMES["ssr-nextjs"]).toBe("SSR Next.js");
    expect(TRACK_DISPLAY_NAMES["project-management"]).toBe("Project Management");
    expect(TRACK_DISPLAY_NAMES["growth-marketing"]).toBe("Growth Marketing");
    expect(Object.keys(TRACK_DISPLAY_NAMES)).toHaveLength(11);
  });
});

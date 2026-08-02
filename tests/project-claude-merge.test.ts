import { describe, expect, it } from "vitest";
import {
  FILL_SECTIONS,
  mergeProjectClaude,
  renderFillScaffold,
  SCAFFOLD_BANNER,
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
    expect(renderFillScaffold().startsWith(SCAFFOLD_BANNER)).toBe(true);
    expect(SCAFFOLD_BANNER).toContain("SCAFFOLD");
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

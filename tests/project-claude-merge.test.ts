import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeProjectClaude, TRACK_DISPLAY_NAMES } from "../src/project-claude-merge.js";

const BASE_TEMPLATE = `# [Project Name]

> 활성 Track(s): <!-- INSERT: track-list -->
>
> <!-- INSERT: tagline -->

<!-- INSERT: stack -->

<!-- INSERT: workflow -->

<!-- INSERT: active-rules -->

<!-- INSERT: agents -->

<!-- INSERT: skills -->

<!-- INSERT: plugins -->

<!-- INSERT: commands -->

<!-- INSERT: boundaries -->
`;

let baseDir: string;

beforeEach(() => {
  baseDir = mkdtempSync(join(tmpdir(), "pcm-"));
  writeFileSync(join(baseDir, "_base.md"), BASE_TEMPLATE);
});

afterEach(() => {
  rmSync(baseDir, { recursive: true, force: true });
});

function addFragment(track: string, section: string, body: string): void {
  const dir = join(baseDir, "fragments", track);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${section}.md`), body);
}

describe("mergeProjectClaude — single track", () => {
  it("inserts tagline + section body verbatim under generated header", () => {
    addFragment("tooling", "tagline", "Bash + CLI 도구");
    addFragment("tooling", "stack", "- Shell: Bash\n- jq");
    const out = mergeProjectClaude(["tooling"], { baseDir });
    expect(out).toContain("활성 Track(s): Tooling");
    expect(out).toContain("> Bash + CLI 도구");
    expect(out).toContain("## Stack\n\n- Shell: Bash\n- jq");
  });

  it("omits sections with no fragment present (R4)", () => {
    addFragment("tooling", "stack", "- Shell: Bash");
    const out = mergeProjectClaude(["tooling"], { baseDir });
    expect(out).toContain("## Stack");
    expect(out).not.toContain("## Plugins");
    expect(out).not.toContain("## Boundaries");
    expect(out).not.toContain("<!-- INSERT:");
  });
});

describe("mergeProjectClaude — multi track", () => {
  it("concats with track display-name subheaders (no dedup)", () => {
    addFragment("tooling", "tagline", "Bash 도구");
    addFragment("data", "tagline", "Python 데이터");
    addFragment("tooling", "active-rules", "- rule A\n- rule B");
    addFragment("data", "active-rules", "- rule A\n- rule C");
    const out = mergeProjectClaude(["tooling", "data"], { baseDir });
    expect(out).toContain("> Bash 도구 / Python 데이터");
    expect(out).toMatch(
      /## Active Rules[\s\S]*### Tooling[\s\S]*- rule A\n- rule B[\s\S]*### Data[\s\S]*- rule A\n- rule C/,
    );
  });

  it("section with single contributing track is rendered without subheader", () => {
    addFragment("tooling", "stack", "- Shell: Bash");
    addFragment("data", "stack", "- Python 3");
    addFragment("tooling", "plugins", "- only tooling plugin");
    const out = mergeProjectClaude(["tooling", "data"], { baseDir });
    expect(out).toMatch(/## Plugins\n\n- only tooling plugin/);
  });
});

describe("mergeProjectClaude — full track expansion", () => {
  it("expands 'full' to every non-full track (R2)", () => {
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
      addFragment(t, "tagline", `${t} tagline`);
      addFragment(t, "stack", `- ${t} stack`);
    }
    const out = mergeProjectClaude(["full"], { baseDir });
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
      expect(out).toContain(`### ${TRACK_DISPLAY_NAMES[t]}`);
      expect(out).toContain(`- ${t} stack`);
    }
    expect(out).not.toContain("### Full");
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

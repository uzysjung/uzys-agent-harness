import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
const UVR = "ui-visual-review";

describe("뺀 스킬은 어느 CLI 자리에도 깔리지 않는다 (#673 B1)", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "b1-uvr-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const spec = (extra: Partial<InstallSpec>): InstallSpec => ({
    tracks: ["csr-supabase"],
    options: { withCodexTrust: false },
    cli: ["claude", "codex"],
    projectDir: dir,
    ...extra,
  });
  const run = (s: InstallSpec) =>
    runInstall({ runExternal: null, harnessRoot: HARNESS_ROOT, projectDir: dir, spec: s });
  const agents = () => existsSync(join(dir, ".agents", "skills", UVR));
  const claude = () => existsSync(join(dir, ".claude", "skills", UVR));

  it("옛 형태 baseline:skills/<id> 기록 → .claude · .agents 모두 없음", () => {
    run(spec({ baselineExclude: [`baseline:skills/${UVR}`] }));
    expect(claude()).toBe(false);
    expect(agents()).toBe(false);
  });

  it("새 인자(forceExclude 카탈로그 id) → 모두 없음", () => {
    run(spec({ userOverride: { forceInclude: [], forceExclude: [UVR] } }));
    expect(claude()).toBe(false);
    expect(agents()).toBe(false);
  });

  it("대조: 제외 없으면 .agents 에 깔린다", () => {
    run(spec({}));
    expect(agents()).toBe(true);
  });
});

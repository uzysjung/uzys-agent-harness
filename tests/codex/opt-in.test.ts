import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCodexOptIn } from "../../src/codex/opt-in.js";

// runCodexOptIn is trust-only — it always registers the project trust entry in
// ~/.codex/config.toml. The withCodexTrust gating lives in the caller (installer),
// which only invokes this when the user has explicitly opted in.
describe("runCodexOptIn — trust entry", () => {
  let projectDir: string;
  let codexHome: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-trust-proj-"));
    codexHome = mkdtempSync(join(tmpdir(), "ch-trust-home-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(codexHome, { recursive: true, force: true });
  });

  it("registers trust entry to ~/.codex/config.toml", () => {
    const report = runCodexOptIn({ projectDir, codexHome });
    expect(report.trustEntry.enabled).toBe(true);
    expect(report.trustEntry.status).toBe("registered");
    const toml = readFileSync(join(codexHome, "config.toml"), "utf8");
    expect(toml).toContain(`[projects."${projectDir}"]`);
    expect(toml).toContain('trust_level = "trusted"');
  });

  it("idempotent — second call returns 'already-present'", () => {
    runCodexOptIn({ projectDir, codexHome });
    const second = runCodexOptIn({ projectDir, codexHome });
    expect(second.trustEntry.status).toBe("already-present");
  });

  it("preserves existing trust entries (append, not overwrite)", () => {
    mkdirSync(codexHome, { recursive: true });
    writeFileSync(
      join(codexHome, "config.toml"),
      '[projects."/other/project"]\ntrust_level = "trusted"\n',
    );
    runCodexOptIn({ projectDir, codexHome });
    const toml = readFileSync(join(codexHome, "config.toml"), "utf8");
    expect(toml).toContain('[projects."/other/project"]'); // preserved
    expect(toml).toContain(`[projects."${projectDir}"]`); // added
  });
});

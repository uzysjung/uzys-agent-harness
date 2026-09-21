import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  buildInstallLog,
  type InstallLog,
  installedClis,
  installLogPath,
  readInstallLog,
  writeInstallLog,
} from "../src/install-log.js";
import type { CliTargets, InstallSpec } from "../src/types.js";

/**
 * #528 — **깔려 있는 CLI 집합은 설치 로그의 `clis` 하나가 말한다** (Epic #527 정의 1).
 *
 * 이전에는 세 곳이 각자 답했다: `spec.cli`(마지막 설치분) · `templates.*Dir`(codex·opencode 만
 * 누적) · 디스크 존재. 그래서 "claude 로 깔고 위저드에서 claude 를 풀고 opencode 를 더한"
 * 프로젝트는 로그가 `["opencode"]` 로 덮이고, 파일이 멀쩡히 남은 `.claude/` 가 새 릴리즈의
 * 자산을 영영 못 받았다.
 */
describe("#528 설치 로그의 CLI 집합", () => {
  let projectDir: string;

  const emptyLog = (over: Partial<InstallLog> = {}): InstallLog => ({
    schemaVersion: 1,
    installedAt: new Date(0).toISOString(),
    scope: "project",
    spec: { tracks: ["tooling"], cli: [] },
    templates: {},
    assets: [],
    ...over,
  });

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "clis-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  describe("옛 로그 유도 — 디스크와 같은 답을 낸다", () => {
    it("claude 단독: `.claude/` 가 유일한 단서다 (`templates.claudeDir` 는 안 믿는다)", () => {
      mkdirSync(join(projectDir, ".claude/rules"), { recursive: true });
      const log = emptyLog({
        spec: { tracks: ["tooling"], cli: ["claude"] },
        templates: { claudeDir: ".claude/", rootClaudeMd: { path: "CLAUDE.md", sha256: "x" } },
      });

      expect(installedClis(projectDir, log)).toEqual(["claude"]);
    });

    it("codex + opencode: `spec.cli` 는 마지막 하나뿐이라도 `templates.*Dir` 가 둘을 말한다", () => {
      mkdirSync(join(projectDir, ".codex"), { recursive: true });
      mkdirSync(join(projectDir, ".opencode"), { recursive: true });
      const log = emptyLog({
        // 실제로 이렇게 남는다 — codex 로 깔고 나중에 opencode 를 더한 설치본.
        spec: { tracks: ["tooling"], cli: ["opencode"] },
        templates: { claudeDir: ".claude/", codexDir: ".codex/", opencodeDir: ".opencode/" },
      });

      // `templates.claudeDir` 가 적혀 있어도 `.claude/` 가 디스크에 없으면 claude 는 아니다.
      expect(installedClis(projectDir, log)).toEqual(["codex", "opencode"]);
    });

    it("antigravity 단독: 로그에 templates 항목이 없어 전용 룰 파일이 유일한 표지다", () => {
      mkdirSync(join(projectDir, ".agents/rules"), { recursive: true });
      writeFileSync(join(projectDir, ".agents/rules/uzys-harness.md"), "# harness\n");

      expect(installedClis(projectDir, emptyLog())).toEqual(["antigravity"]);
    });

    it("`CLI_BASE_SORT_ORDER` 로 정렬한다 — 로그 diff 가 순서로 흔들리지 않게", () => {
      mkdirSync(join(projectDir, ".claude"), { recursive: true });
      mkdirSync(join(projectDir, ".agents/rules"), { recursive: true });
      writeFileSync(join(projectDir, ".agents/rules/uzys-harness.md"), "# harness\n");
      const log = emptyLog({
        spec: { tracks: ["tooling"], cli: ["opencode"] },
        templates: { codexDir: ".codex/", opencodeDir: ".opencode/" },
      });

      expect(installedClis(projectDir, log)).toEqual([
        "claude",
        "codex",
        "opencode",
        "antigravity",
      ]);
    });
  });

  it("`clis` 가 있으면 그것이 답이다 — 디스크를 다시 보지 않는다", () => {
    // 명시적 기록 > 유도. `uninstall --cli claude` 직후처럼 파일이 잠깐 남아 있어도(사용자가
    // 고쳐 보존된 앵커 등) 기록이 이긴다.
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    const log = emptyLog({ spec: { tracks: ["tooling"], cli: ["claude"], clis: ["codex"] } });

    expect(installedClis(projectDir, log)).toEqual(["codex"]);
  });

  it("로그가 없으면 빈 배열 — '아무것도 없다'가 아니라 '말할 수 없다'", () => {
    expect(installedClis(projectDir, null)).toEqual([]);
  });

  it("읽기만으로 로그를 고치지 않는다 — 유도는 다음 write 때 기록된다", () => {
    mkdirSync(join(projectDir, ".claude"), { recursive: true });
    writeInstallLog(projectDir, emptyLog({ spec: { tracks: ["tooling"], cli: ["claude"] } }));
    const before = readFileSync(installLogPath(projectDir), "utf8");

    installedClis(projectDir, readInstallLog(projectDir));

    expect(readFileSync(installLogPath(projectDir), "utf8")).toBe(before);
  });

  describe("buildInstallLog — CLI 집합은 더해지기만 한다", () => {
    const spec = (cli: CliTargets): InstallSpec => ({
      tracks: ["tooling"],
      options: { withCodexTrust: false },
      cli,
      projectDir,
    });

    it("claude 로 깐 뒤 opencode 를 더하면 둘 다 남는다", () => {
      mkdirSync(join(projectDir, ".claude"), { recursive: true });
      const first = buildInstallLog(spec(["claude"]), null, "project");
      expect(first.spec.clis).toEqual(["claude"]);

      const second = buildInstallLog(spec(["opencode"]), null, "project", null, first);

      expect(second.spec.clis).toEqual(["claude", "opencode"]);
      // 화면·`list` 용 `spec.cli` 는 이번 설치분 그대로 — 두 필드의 뜻이 다르다.
      expect(second.spec.cli).toEqual(["opencode"]);
    });

    it("reinstall(`.claude/` backup rename)에서도 누적이다 — 다른 CLI 파일은 그대로 남는다", () => {
      mkdirSync(join(projectDir, ".claude"), { recursive: true });
      const first = buildInstallLog(spec(["claude", "opencode"]), null, "project");

      const again = buildInstallLog(spec(["claude"]), null, "project", null, first, true);

      expect(again.spec.clis).toEqual(["claude", "opencode"]);
    });

    it("opencode 단독이면 `templates.claudeDir` 를 적지 않는다", () => {
      const log = buildInstallLog(spec(["opencode"]), null, "project");

      expect(log.templates.claudeDir).toBeUndefined();
      expect(log.templates.opencodeDir).toBe(".opencode/");
      expect(log.spec.clis).toEqual(["opencode"]);
    });

    it("옛 로그를 이어받을 때 유도 결과가 함께 기록된다 (1회 이행)", () => {
      mkdirSync(join(projectDir, ".claude"), { recursive: true });
      const legacy = emptyLog({
        spec: { tracks: ["tooling"], cli: ["claude"] },
        templates: { claudeDir: ".claude/", codexDir: ".codex/" },
      });

      const next = buildInstallLog(spec(["opencode"]), null, "project", null, legacy);

      expect(next.spec.clis).toEqual(["claude", "codex", "opencode"]);
    });
  });
});

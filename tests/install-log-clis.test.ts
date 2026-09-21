import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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

  describe("옛 로그 유도 — 기록만 읽는다 (디스크는 신호가 아니다)", () => {
    it("claude 단독: 앵커 sha 기록이 단서다 (`templates.claudeDir` 는 안 믿는다)", () => {
      const log = emptyLog({
        spec: { tracks: ["tooling"], cli: ["claude"] },
        templates: {
          claudeDir: ".claude/",
          rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "x" },
        },
      });

      expect(installedClis(log)).toEqual(["claude"]);
    });

    it("`policyFiles`·`skillFiles` 만으로는 claude 가 아니다 — 옛 판은 그 둘을 claude 선택과 무관하게 훑어 적었다 (BLOCKER-5)", () => {
      // v26.160.1 까지 `installer.ts` 는 `.claude/` 를 무조건 훑어 기준선을 찍었다. 설치자 파일이
      // 템플릿과 같은 상대 경로면 codex 단독 로그에도 이 두 필드가 들어 있다(컨테이너 실측).
      const log = emptyLog({
        spec: { tracks: ["tooling"], cli: ["codex"] },
        templates: { claudeDir: ".claude/", codexDir: ".codex/" },
        policyFiles: [{ path: "rules/git-policy.md", sha256: "p" }],
        skillFiles: [{ path: "objective-brief/SKILL.md", sha256: "s" }],
      });

      expect(installedClis(log)).toEqual(["codex"]);
    });

    it("codex + opencode: `spec.cli` 는 마지막 하나뿐이라도 `templates.*Dir` 가 둘을 말한다", () => {
      // 설치자가 만든 `.claude/` 가 디스크에 있어도 claude 는 아니다 — 기록이 없다.
      mkdirSync(join(projectDir, ".claude"), { recursive: true });
      const log = emptyLog({
        // 실제로 이렇게 남는다 — codex 로 깔고 나중에 opencode 를 더한 설치본.
        spec: { tracks: ["tooling"], cli: ["opencode"] },
        templates: { claudeDir: ".claude/", codexDir: ".codex/", opencodeDir: ".opencode/" },
      });

      expect(installedClis(log)).toEqual(["codex", "opencode"]);
    });

    it("antigravity 단독: 로그에 templates 항목이 없어 전용 룰 파일의 기록이 유일한 표지다", () => {
      const log = emptyLog({
        externalFiles: [{ path: ".agents/rules/uzys-harness.md", sha256: "a" }],
      });

      expect(installedClis(log)).toEqual(["antigravity"]);
    });

    it("`CLI_BASE_SORT_ORDER` 로 정렬한다 — 로그 diff 가 순서로 흔들리지 않게", () => {
      const log = emptyLog({
        spec: { tracks: ["tooling"], cli: ["opencode"] },
        templates: {
          codexDir: ".codex/",
          opencodeDir: ".opencode/",
          rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "x" },
        },
        externalFiles: [{ path: ".agents/rules/uzys-harness.md", sha256: "a" }],
      });

      expect(installedClis(log)).toEqual(["claude", "codex", "opencode", "antigravity"]);
    });
  });

  it("`clis` 가 있으면 그것이 답이다 — 다른 기록을 다시 보지 않는다", () => {
    // 명시적 기록 > 유도. `uninstall --cli claude` 직후처럼 앵커 기록이 잠깐 남아 있어도
    // (사용자가 고쳐 보존된 앵커) 기록이 이긴다.
    const log = emptyLog({
      spec: { tracks: ["tooling"], cli: ["claude"], clis: ["codex"] },
      templates: { rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "x" } },
    });

    expect(installedClis(log)).toEqual(["codex"]);
  });

  it("로그가 없으면 빈 배열 — '아무것도 없다'가 아니라 '말할 수 없다'", () => {
    expect(installedClis(null)).toEqual([]);
  });

  it("읽기만으로 로그를 고치지 않는다 — 유도는 다음 write 때 기록된다", () => {
    writeInstallLog(projectDir, emptyLog({ spec: { tracks: ["tooling"], cli: ["claude"] } }));
    const before = readFileSync(installLogPath(projectDir), "utf8");

    installedClis(readInstallLog(projectDir));

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
      const first = buildInstallLog(spec(["claude"]), null, "project");
      expect(first.spec.clis).toEqual(["claude"]);

      const second = buildInstallLog(spec(["opencode"]), null, "project", null, first);

      expect(second.spec.clis).toEqual(["claude", "opencode"]);
      // 화면·`list` 용 `spec.cli` 는 이번 설치분 그대로 — 두 필드의 뜻이 다르다.
      expect(second.spec.cli).toEqual(["opencode"]);
    });

    it("reinstall(`.claude/` backup rename)에서도 누적이다 — 다른 CLI 파일은 그대로 남는다", () => {
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
      // 이 옛 로그의 claude 근거는 앵커 sha 기록이다 — `spec.cli` 는 마지막 설치분(codex)뿐.
      const legacy = emptyLog({
        spec: { tracks: ["tooling"], cli: ["codex"] },
        templates: {
          claudeDir: ".claude/",
          codexDir: ".codex/",
          rootClaudeMd: { path: "CLAUDE-uzys-harness.md", sha256: "x" },
        },
      });

      const next = buildInstallLog(spec(["opencode"]), null, "project", null, legacy);

      expect(next.spec.clis).toEqual(["claude", "codex", "opencode"]);
    });
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedAgentsMdProjectContext, seedRootClaudeProjectContext } from "../src/anchor-seed.js";
import { runInstall } from "../src/installer.js";
import type { CliBase, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");

/**
 * #528 — 앵커 씨 뿌리기 (Epic #527 정의 6).
 *
 * 설치자는 프로젝트 맥락을 한 번 적었다. CLI 를 하나 더 고르면 그 CLI 의 앵커가 **빈
 * 스캐폴드**로 태어나, 이미 적어 둔 빌드 명령·구조를 새 파일은 모른다. 태어나는 순간 한 번만
 * 옮기면 그 뒤로는 `update` 가 두 파일의 설치자 절을 각각 보존한다(#503).
 */
describe("#528 앵커 씨 뿌리기", () => {
  let projectDir: string;

  const install = (cli: ReadonlyArray<CliBase>): void => {
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      spec: {
        tracks: ["tooling"],
        options: { withCodexTrust: false },
        cli: [...cli],
        projectDir,
      } satisfies InstallSpec,
    });
  };

  const fill = (rel: string, heading: string, text: string): void => {
    const path = join(projectDir, rel);
    const body = readFileSync(path, "utf8");
    expect(body).toContain(heading);
    writeFileSync(path, body.replace(`${heading}\n`, `${heading}\n\n${text}\n`));
    expect(readFileSync(path, "utf8")).toContain(text);
  };

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "seed528-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  it("claude → codex: 채워 둔 루트 CLAUDE.md 본문이 새 AGENTS.md 로 간다", () => {
    install(["claude"]);
    fill("CLAUDE.md", "## Stack & Commands", "빌드는 `make build`. 테스트는 `make test`.");
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);

    install(["codex"]);

    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf8");
    expect(agents).toContain("빌드는 `make build`. 테스트는 `make test`.");
    // 목적지가 자기 배너를 붙인다 — 출처의 배너는 다른 파일을 가리킨다(#305).
    expect(agents).toContain("**This file (`AGENTS.md`) is the harness anchor**");
    expect(agents).not.toContain("imported at the bottom of this file");
    // 출처 파일은 그대로다 — 옮기는 것이 아니라 복사다.
    expect(readFileSync(join(projectDir, "CLAUDE.md"), "utf8")).toContain("make build");
  });

  it("opencode → claude: 채워 둔 AGENTS.md 의 Project Context 가 새 루트 CLAUDE.md 로 간다", () => {
    install(["opencode"]);
    fill("AGENTS.md", "## Architecture & Layout", "진입점은 `src/main.py` 하나다.");
    expect(existsSync(join(projectDir, "CLAUDE.md"))).toBe(false);

    install(["claude"]);

    const root = readFileSync(join(projectDir, "CLAUDE.md"), "utf8");
    expect(root).toContain("진입점은 `src/main.py` 하나다.");
    expect(root).toContain("imported at the bottom of this file");
    expect(root).toContain("uzys-harness:import");
    // 하네스 절(`## Harness Rules` 등)은 따라오지 않는다 — 설치자 절만 옮긴다.
    expect(root).not.toContain("## Harness Rules");
  });

  it("손대지 않은 스캐폴드는 옮기지 않는다 — 빈 껍데기를 복사하면 소음이다", () => {
    install(["claude"]);

    expect(seedAgentsMdProjectContext(projectDir)).toBeNull();

    install(["codex"]);
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf8");
    // 평소대로 빈 스캐폴드 — `_(not filled yet …)_` 플레이스홀더가 그대로다.
    expect(agents).toContain("_(not filled yet");
  });

  it("이미 있는 앵커는 건드리지 않는다 — 씨는 태어날 때만 뿌린다", () => {
    install(["claude", "codex"]);
    fill("AGENTS.md", "## Project Context", "AGENTS 쪽에 적은 줄.");
    fill("CLAUDE.md", "## Identity & Purpose", "CLAUDE 쪽에 적은 줄.");

    install(["claude", "codex"]);

    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).not.toContain(
      "CLAUDE 쪽에 적은 줄.",
    );
    expect(readFileSync(join(projectDir, "CLAUDE.md"), "utf8")).not.toContain(
      "AGENTS 쪽에 적은 줄.",
    );
  });

  it("출처가 없으면 `null` — 판정할 대상이 없다", () => {
    expect(seedAgentsMdProjectContext(projectDir)).toBeNull();
    expect(seedRootClaudeProjectContext(projectDir, HARNESS_ROOT)).toBeNull();
  });

  it("템플릿을 못 읽으면 옮기지 않는다 — 절 경계를 모르면 손대지 않는다", () => {
    install(["opencode"]);
    fill("AGENTS.md", "## Stack & Commands", "빌드는 `cargo build`.");

    expect(seedRootClaudeProjectContext(projectDir, join(projectDir, "no-such-root"))).toBeNull();
  });

  it("설치자가 맨 위에 적은 인용문은 남긴다 — 떼는 것은 하네스 앞머리뿐", () => {
    install(["claude"]);
    const rootPath = join(projectDir, "CLAUDE.md");
    const body = readFileSync(rootPath, "utf8");
    // H1 바로 뒤, 하네스 트랙 안내 **앞**에 설치자 인용문을 끼운다.
    writeFileSync(rootPath, body.replace(/^(# .*\n)/, "$1\n> 사내 결제 게이트웨이.\n"));

    const seeded = seedAgentsMdProjectContext(projectDir);

    expect(seeded).not.toBeNull();
    expect(seeded).toContain("> 사내 결제 게이트웨이.");
    expect(seeded).not.toContain("Active track(s):");
  });
});

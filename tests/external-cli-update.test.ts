/**
 * `update` 가 외부 CLI 산출물도 갱신하는가 — R-3j-A, ADR-049.
 *
 * ADR-048 이 재설치 경로의 소유자 판정을 고쳤지만 `update` 는 여전히 `.claude/` 만 만졌다.
 * 그래서 codex/opencode 사용자는 하네스가 개선한 프롬프트·훅을 `update` 로는 **영영 못 받았다**.
 * 여기서 검증하는 것은 두 가지고, 둘 다 없으면 이 기능은 반쪽이다:
 *
 *   ⓐ 이미 있는 산출물은 최신판으로 갱신된다 (본래 결함)
 *   ⓑ 없던 산출물은 만들어지지 않는다 (update 가 안 고른 CLI/스킬을 깔면 안 된다)
 *
 * ⓑ 를 빼면 claude 만 쓰는 사용자가 `update` 한 번에 `.codex/`·`opencode.json` 을 받는다 —
 * `.claude/` 쪽 `updateDir` 이 "target 에 이미 있는 파일만"으로 오래 지켜 온 규율과 같다.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { hashContent, readInstallLog, writeInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = join(__dirname, "..");

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ext-upd-"));
});

function spec(cli: InstallSpec["cli"]): InstallSpec {
  return {
    tracks: ["tooling"],
    options: { withPrune: false, withCodexTrust: false, withKarpathyHook: false },
    cli,
    projectDir,
  };
}

function install(cli: InstallSpec["cli"]): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(cli),
    mode: "add",
    runExternal: null,
  });
}

/** update 는 `.claude/` 만 spec 으로 받는다 — 외부 CLI 는 디스크에 있는 것으로 판정된다. */
function update() {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(["claude"]),
    mode: "update",
    runExternal: null,
  });
}

function backupsIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.includes(".backup"));
}

/** 루트의 백업만 — update 가 만드는 `.claude.backup-<ts>` 디렉터리는 세지 않는다. */
function rootBackupsFor(name: string): string[] {
  return readdirSync(projectDir).filter((f) => f.startsWith(`${name}.backup`));
}

function edit(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

/**
 * "하네스 구버전이 깔아 둔 상태"를 만든다 — 디스크를 옛 내용으로 바꾸고 **기준선도 그 내용의
 * 해시로** 맞춘다. 그래야 소유자 판정이 "사용자는 안 고쳤다"가 되고, update 가 백업 없이
 * 최신판으로 덮어써야 하는 상황이 재현된다. 이게 곧 사용자가 하네스를 올린 시나리오다.
 */
function pretendStale(rel: string, oldContent: string): void {
  const abs = join(projectDir, rel);
  writeFileSync(abs, oldContent);
  const log = readInstallLog(projectDir);
  if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
  writeInstallLog(projectDir, {
    ...log,
    externalFiles: (log.externalFiles ?? []).map((f) =>
      f.path === rel ? { path: rel, sha256: hashContent(oldContent) } : f,
    ),
  });
}

describe("update — 이미 있는 외부 CLI 산출물을 갱신한다 (ⓐ)", () => {
  it("하네스 구버전 내용이 최신판으로 덮여쓰인다 — 백업 없이", () => {
    install(["claude", "codex"]);
    const rel = ".codex/config.toml";
    const fresh = readFileSync(join(projectDir, rel), "utf8");
    pretendStale(rel, "# v26.1.0 시절 config\n");

    const report = update();

    expect(readFileSync(join(projectDir, rel), "utf8")).toBe(fresh);
    expect(report.updateMode?.externalUpdated ?? 0).toBeGreaterThan(0);
    // 사용자가 고친 게 아니므로 백업이 생기면 안 된다 — 릴리즈마다 쌓이면 보호가 무력해진다.
    expect(backupsIn(join(projectDir, ".codex"))).toHaveLength(0);
    expect(report.updateMode?.externalBackedUp ?? []).toEqual([]);
  });

  it("opencode 산출물도 같은 경로로 갱신된다 — 자산 종류로 규칙이 갈리지 않는다", () => {
    install(["claude", "opencode"]);
    const rel = "opencode.json";
    const fresh = readFileSync(join(projectDir, rel), "utf8");
    pretendStale(rel, '{"stale": true}\n');

    update();

    expect(readFileSync(join(projectDir, rel), "utf8")).toBe(fresh);
  });

  it("사용자가 고친 산출물은 백업으로 보존되고 최신판이 자리에 온다", () => {
    install(["claude", "codex"]);
    const hook = join(projectDir, ".codex/hooks/session-start.sh");
    edit(hook, "#!/bin/bash\n# 내가 고친 훅\n");

    const report = update();

    const backups = backupsIn(join(projectDir, ".codex/hooks"));
    expect(backups).toHaveLength(1);
    const saved = backups[0] ?? "";
    expect(readFileSync(join(projectDir, ".codex/hooks", saved), "utf8")).toContain("내가 고친 훅");
    expect(readFileSync(hook, "utf8")).not.toContain("내가 고친 훅");
    expect(report.updateMode?.externalBackedUp ?? []).toContain(".codex/hooks/session-start.sh");
  });
});

describe("update — 없던 산출물은 만들지 않는다 (ⓑ)", () => {
  it("claude 만 깐 프로젝트에 codex/opencode 산출물이 생기지 않는다", () => {
    install(["claude"]);

    update();

    // 이게 깨지면 update 한 번으로 안 쓰는 CLI 설정이 프로젝트에 딸려 들어온다.
    expect(existsSync(join(projectDir, ".codex"))).toBe(false);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(false);
    expect(existsSync(join(projectDir, ".opencode"))).toBe(false);
    expect(existsSync(join(projectDir, ".agents"))).toBe(false);
    expect(existsSync(join(projectDir, "AGENTS.md"))).toBe(false);
  });

  it("codex 만 깐 프로젝트에 opencode 산출물이 생기지 않는다 — CLI 단위로 샌다면 여기서 잡힌다", () => {
    install(["claude", "codex"]);

    update();

    expect(existsSync(join(projectDir, ".codex/config.toml"))).toBe(true);
    expect(existsSync(join(projectDir, "opencode.json"))).toBe(false);
    expect(existsSync(join(projectDir, ".opencode"))).toBe(false);
  });

  it("설치되지 않은 스킬이 update 로 딸려 들어오지 않는다", () => {
    install(["claude", "codex"]);
    const skillsDir = join(projectDir, ".agents/skills");
    const before = existsSync(skillsDir) ? readdirSync(skillsDir).sort() : [];

    update();

    const after = existsSync(skillsDir) ? readdirSync(skillsDir).sort() : [];
    // update 는 전체 스킬 목록을 넘긴다 — refresh 필터가 없으면 여기서 목록이 늘어난다.
    expect(after).toEqual(before);
  });
});

describe("update — 기준선이 왕복한다", () => {
  it("연속 update 가 백업을 쌓지 않는다", () => {
    install(["claude", "codex", "opencode"]);

    update();
    update();

    // 기준선 재기록이 빠지면 두 번째 update 가 첫 번째 자기 산출물을 '사용자 편집'으로 오판한다.
    expect(backupsIn(join(projectDir, ".codex/hooks"))).toHaveLength(0);
    expect(backupsIn(join(projectDir, ".opencode/commands"))).toHaveLength(0);
    expect(rootBackupsFor("AGENTS.md")).toHaveLength(0);
    expect(rootBackupsFor("opencode.json")).toHaveLength(0);
  });

  it("update 후 기록된 기준선이 실제 디스크와 일치한다", () => {
    install(["claude", "codex"]);
    pretendStale(".codex/config.toml", "# 구버전\n");

    update();

    const log = readInstallLog(projectDir);
    const recorded = log?.externalFiles ?? [];
    expect(recorded.length).toBeGreaterThan(0);
    for (const f of recorded) {
      expect(f.sha256, `${f.path} 기준선 불일치`).toBe(
        hashContent(readFileSync(join(projectDir, f.path), "utf8")),
      );
    }
  });

  it("이번 update 가 다시 쓰지 않은 산출물의 기준선도 유지된다", () => {
    // 지금 templates 가 더 이상 렌더하지 않는 옛 산출물 — 디스크에는 남아 있고 로그에도
    // 기준선이 있다. update 는 그걸 쓰지 않으므로 이번 실행분만 기록하면 항목이 사라지고,
    // 그러면 나중에 그 경로가 부활했을 때 멀쩡한 파일이 '판정 불가'로 떨어져 백업된다.
    //
    // 설치본 전체를 비교하는 방식으로는 이 성질을 **검증할 수 없다** — update 는 디스크에
    // 있는 산출물을 전부 다시 쓰므로 병합을 빼도 목록이 같아진다 (음성 대조에서 드러났다).
    install(["claude", "codex"]);
    const legacyRel = ".codex/legacy-note.md";
    const legacyBody = "# 옛 릴리즈가 렌더했던 산출물\n";
    writeFileSync(join(projectDir, legacyRel), legacyBody);
    const log = readInstallLog(projectDir);
    if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
    writeInstallLog(projectDir, {
      ...log,
      externalFiles: [
        ...(log.externalFiles ?? []),
        { path: legacyRel, sha256: hashContent(legacyBody) },
      ],
    });

    update();

    const after = readInstallLog(projectDir)?.externalFiles ?? [];
    expect(after.map((f) => f.path)).toContain(legacyRel);
  });

  it("디스크에서 사라진 산출물의 기준선은 유지되지 않는다 — 기준선은 이력이 아니라 현재 상태다", () => {
    install(["claude", "codex"]);
    const goneRel = ".codex/removed-note.md";
    const log = readInstallLog(projectDir);
    if (!log) throw new Error("install log 가 없다 — 픽스처 전제가 깨졌다");
    writeInstallLog(projectDir, {
      ...log,
      // 디스크에는 만들지 않는다 — 없는 파일의 해시가 기록에 남으면 그게 곧 거짓 기록이다.
      externalFiles: [...(log.externalFiles ?? []), { path: goneRel, sha256: hashContent("x") }],
    });

    update();

    const after = readInstallLog(projectDir)?.externalFiles ?? [];
    expect(after.map((f) => f.path)).not.toContain(goneRel);
  });
});

/**
 * 외부 CLI(codex · opencode) 산출물의 소유자 판정 — R-3j(B), ADR-048.
 *
 * ADR-047 이 `.claude/` 정책 파일에 붙인 판정이 `.codex/`·`.opencode/`·`.agents/skills/` 에는
 * 없었다. 그래서 재설치할 때마다 사용자가 고친 훅·커맨드·config 가 **백업 없이** 사라졌다.
 * 실측(2026-07-20): transform 2회 실행 사이에 편집을 넣으면 5개 산출물 전부 편집분 소실, 백업 0.
 *
 * 여기서 검증하는 계약은 ADR-046/047 과 **같다** — 자산 종류가 달라도 규칙이 달라질 이유가
 * 없다는 것이 애초에 이 버그의 교훈이다:
 *   디스크 == 기준선 → 조용히 덮어쓴다 (릴리즈마다 백업이 쌓이면 안 된다)
 *   디스크 != 기준선 → `.backup-<stamp>` 남기고 최신판을 자리에
 *   기준선 없음      → 판정 불가 → 보수적으로 백업
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
import { runCodexTransform } from "../src/codex/transform.js";
import { hashContent, type InstallLogSkillFile, readInstallLog } from "../src/install-log.js";
import { runInstall } from "../src/installer.js";
import { runOpencodeTransform } from "../src/opencode/transform.js";
import type { InstallSpec } from "../src/types.js";

const HARNESS_ROOT = join(__dirname, "..");
// 2026-08-02 정비 (ADR-060) — 표본이 이관된 verification-loop 에서 잔존 번들 스킬로 바뀌었다.
const SKILLS = ["compaction-handoff"];

let projectDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "ext-own-"));
});

/** 기준선 Map — install log 의 `externalFiles` 가 실제로 넘어오는 형태. */
function baselineOf(files: ReadonlyArray<InstallLogSkillFile>): ReadonlyMap<string, string> {
  return new Map(files.map((f) => [f.path, f.sha256]));
}

/** 백업 파일명 규칙에 의존하지 않는다 — 개수/존재만 본다. */
function backupsIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.includes(".backup"));
}

function edit(abs: string, content: string): void {
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function codex(baseline: ReadonlyMap<string, string>) {
  return runCodexTransform({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    selectedInternalSkills: SKILLS,
    baseline,
  });
}

function opencode(baseline: ReadonlyMap<string, string>) {
  return runOpencodeTransform({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    selectedInternalSkills: SKILLS,
    baseline,
  });
}

describe("codex transform — 소유자 판정", () => {
  it("사용자가 고친 훅은 재실행에서 백업된 뒤 최신판이 자리에 온다", () => {
    const first = codex(new Map());
    const hook = join(projectDir, ".codex/hooks/session-start.sh");
    edit(hook, "#!/bin/bash\n# 사용자가 직접 고침\n");

    const second = codex(baselineOf(first.ownership.files));

    // 편집분은 백업으로 남는다 — 사라지면 안 된다.
    expect(backupsIn(join(projectDir, ".codex/hooks"))).toHaveLength(1);
    expect(second.ownership.backedUp).toContain(".codex/hooks/session-start.sh");
    // 최신판이 활성 (ADR-046 사용자 결정: 최신판이 자리, 편집분이 백업).
    expect(readFileSync(hook, "utf8")).not.toContain("사용자가 직접 고침");
  });

  it("안 고친 파일은 조용히 덮어쓴다 — 릴리즈마다 백업이 쌓이면 안 된다", () => {
    const first = codex(new Map());
    const second = codex(baselineOf(first.ownership.files));

    expect(second.ownership.backedUp).toEqual([]);
    expect(backupsIn(join(projectDir, ".codex/hooks"))).toHaveLength(0);
    expect(backupsIn(join(projectDir, ".codex"))).toHaveLength(0);
  });

  it("기준선이 없고(레거시 설치) 내용이 다르면 판정 불가이므로 보수적으로 백업한다", () => {
    codex(new Map());
    edit(
      join(projectDir, ".codex/hooks/session-start.sh"),
      "#!/bin/bash\n# 누가 고쳤는지 모른다\n",
    );

    // 기준선을 못 받은 상태로 재실행 = v26.132.x 이하로 깔린 설치의 첫 재설치.
    // 사용자 편집인지 하네스 구버전인지 구분할 근거가 없으므로 잃지 않는 쪽을 택한다.
    const second = codex(new Map());

    expect(second.ownership.backedUp).toContain(".codex/hooks/session-start.sh");
  });

  it("기준선이 없어도 내용이 같으면 백업하지 않는다 — 잃을 편집분이 없다", () => {
    // 레거시라고 무조건 백업하면 v26.132.x 이하 전 사용자의 첫 재설치에서 산출물 전체가
    // 백업으로 복제된다. '판정 불가 → 보수적 백업'은 **내용이 다를 때** 적용되는 규칙이다.
    codex(new Map());
    const second = codex(new Map());

    expect(second.ownership.backedUp).toEqual([]);
  });

  it("사용자가 고친 config.toml 과 스킬도 같은 보호를 받는다", () => {
    const first = codex(new Map());
    edit(join(projectDir, ".codex/config.toml"), "# 사용자 config\n");
    edit(join(projectDir, ".agents/skills/compaction-handoff/SKILL.md"), "# 사용자 스킬\n");

    const second = codex(baselineOf(first.ownership.files));

    expect(second.ownership.backedUp).toContain(".codex/config.toml");
    expect(second.ownership.backedUp).toContain(".agents/skills/compaction-handoff/SKILL.md");
  });

  it("기준선은 하네스가 방금 쓴 내용과 일치한다 — 다음 실행이 자기 산출물을 오판하면 안 된다", () => {
    const report = codex(new Map());
    for (const f of report.ownership.files) {
      const abs = join(projectDir, f.path);
      expect(existsSync(abs), `${f.path} 가 기준선에 있는데 디스크에 없다`).toBe(true);
      expect(f.sha256).toBe(hashContent(readFileSync(abs, "utf8")));
    }
    expect(report.ownership.files.length).toBeGreaterThan(0);
  });
});

describe("opencode transform — 소유자 판정", () => {
  it("사용자가 고친 스킬과 opencode.json 이 백업된다", () => {
    // ADR-081 — 번들 스킬은 `.agents/skills/<id>/SKILL.md` 로 간다(codex 와 같은 자리).
    const first = opencode(new Map());
    edit(join(projectDir, "opencode.json"), '{"mine":true}\n');
    edit(join(projectDir, ".agents/skills/compaction-handoff/SKILL.md"), "# 사용자 스킬\n");

    const second = opencode(baselineOf(first.ownership.files));

    expect(second.ownership.backedUp).toContain("opencode.json");
    expect(second.ownership.backedUp).toContain(".agents/skills/compaction-handoff/SKILL.md");
  });

  it("안 고쳤으면 백업하지 않는다", () => {
    const first = opencode(new Map());
    const second = opencode(baselineOf(first.ownership.files));
    expect(second.ownership.backedUp).toEqual([]);
  });
});

describe("AGENTS.md — 두 transform 이 같은 파일을 쓴다", () => {
  it("codex 직후 opencode 를 돌려도 AGENTS.md 백업이 생기지 않는다", () => {
    // 같은 install 안에서 codex 가 쓴 AGENTS.md 를 opencode 가 다시 쓴다. 앞 단계가 쓴 것은
    // 하네스 것이므로, 이걸 '사용자 편집'으로 오판하면 **매 설치마다** 백업이 생긴다.
    const first = codex(new Map());
    const second = opencode(baselineOf(first.ownership.files));

    expect(second.ownership.backedUp).not.toContain("AGENTS.md");
    expect(backupsIn(projectDir)).toHaveLength(0);
  });

  it("사용자가 채운 AGENTS.md 는 보존된다", () => {
    const first = codex(new Map());
    edit(join(projectDir, "AGENTS.md"), "# 우리 팀 규칙\n");

    const second = codex(baselineOf(first.ownership.files));

    expect(second.ownership.backedUp).toContain("AGENTS.md");
    expect(backupsIn(projectDir)).toHaveLength(1);
  });
});

/**
 * transform 단위 계약이 지켜져도 **installer 가 기준선을 안 실어 나르면 아무 소용이 없다** —
 * 그 경우 매 설치가 빈 기준선으로 출발해 판정 불가로 떨어진다. 위 describe 들은 그걸 못 본다
 * (transform 을 직접 부르며 기준선을 테스트가 손으로 넘기기 때문).
 *
 * 그래서 여기서는 `runInstall` 을 실제로 두 번 돌린다. 이 계열의 회귀는 늘 "단위는 초록,
 * 배선은 끊김" 형태였다.
 */
describe("installer 배선 — 기준선이 install log 를 왕복하는가", () => {
  function install(): void {
    const spec: InstallSpec = {
      tracks: ["tooling"],
      options: { withPrune: false, withCodexTrust: false },
      cli: ["codex", "opencode"],
      projectDir,
    };
    runInstall({ harnessRoot: HARNESS_ROOT, projectDir, spec, mode: "add", runExternal: null });
  }

  it("install 이 externalFiles 기준선을 기록한다", () => {
    install();

    const log = readInstallLog(projectDir);
    const recorded = log?.externalFiles ?? [];
    expect(recorded.length).toBeGreaterThan(0);
    // 기록된 해시가 실제 디스크와 일치해야 한다. 안 맞으면 다음 설치가 전부 오판한다.
    for (const f of recorded) {
      expect(f.sha256, `${f.path} 기준선 불일치`).toBe(
        hashContent(readFileSync(join(projectDir, f.path), "utf8")),
      );
    }
  });

  it("재설치해도 안 고친 파일에는 백업이 생기지 않는다", () => {
    install();
    install();

    // codex 와 opencode 가 같은 AGENTS.md 를 쓰므로, 기준선 전달이 끊기면 여기서 먼저 터진다.
    expect(backupsIn(projectDir)).toHaveLength(0);
    expect(backupsIn(join(projectDir, ".codex/hooks"))).toHaveLength(0);
    expect(backupsIn(join(projectDir, ".opencode/commands"))).toHaveLength(0);
  });

  it("재설치가 사용자 편집분을 백업으로 남긴다 — 사용자 보고 증상 그대로", () => {
    install();
    const hook = join(projectDir, ".codex/hooks/session-start.sh");
    edit(hook, "#!/bin/bash\n# 내가 고친 훅\n");

    install();

    const backups = backupsIn(join(projectDir, ".codex/hooks"));
    expect(backups).toHaveLength(1);
    const saved = backups[0] ?? "";
    expect(readFileSync(join(projectDir, ".codex/hooks", saved), "utf8")).toContain("내가 고친 훅");
  });
});

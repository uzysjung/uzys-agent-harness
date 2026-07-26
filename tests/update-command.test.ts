import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCli } from "../src/cli.js";
import { updateAction } from "../src/commands/update.js";
import { MODE_ENTRY_POINT } from "../src/installer.js";
import type { DetectedInstall } from "../src/state.js";
import type { InstallSpec } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

/**
 * `update` 비대화형 명령 — v26.131.0.
 *
 * WHY: `install`·`list`·`uninstall` 은 전부 플래그로 돌아가는데 `update` 만 위저드 전용이었다.
 * CI 로 설치는 되는데 갱신이 안 되는 건 수요 문제가 아니라 **계열 비대칭**이다(사용자 지시).
 * 이 테스트가 지키는 것은 기능 자체보다 **비대칭이 다시 생기지 않는 것**이다.
 */

function fakeState(over: Partial<DetectedInstall> = {}): DetectedInstall {
  return {
    state: "existing",
    tracks: ["tooling"],
    source: "metafile",
    hasClaudeDir: true,
    ...over,
  };
}

describe("update 명령 — 비대화형 진입점", () => {
  let dir = "";
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "update-cmd-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("기존 설치를 감지하면 mode='update' 로 파이프라인을 돌린다", () => {
    const execute = vi.fn();
    updateAction(
      { projectDir: dir },
      { log: () => {}, err: () => {}, detect: () => fakeState(), execute },
    );

    expect(execute).toHaveBeenCalledOnce();
    const [, deps] = execute.mock.calls[0] as [InstallSpec, { mode?: string }];
    // mode 를 안 넘기면 fresh 로 떨어져 **전체 재설치**가 된다 — 이 단언이 그걸 막는다.
    expect(deps.mode).toBe("update");
  });

  it("감지된 track 을 그대로 넘긴다 — 갱신이 설치 구성을 바꾸면 안 된다", () => {
    const execute = vi.fn();
    updateAction(
      { projectDir: dir },
      {
        log: () => {},
        err: () => {},
        detect: () => fakeState({ tracks: ["tooling", "data"] }),
        execute,
      },
    );
    const [spec] = execute.mock.calls[0] as [InstallSpec];
    expect(spec.tracks).toEqual(["tooling", "data"]);
  });

  it("설치가 없으면 exit 1 + 다음 행동 안내 — 조용히 성공하지 않는다", () => {
    const execute = vi.fn();
    const errs: string[] = [];
    const exit = vi.fn() as unknown as (code: number) => never;
    updateAction(
      { projectDir: dir },
      {
        log: () => {},
        err: (m) => errs.push(m),
        exit,
        detect: () => fakeState({ hasClaudeDir: false, state: "new", tracks: [] }),
        execute,
      },
    );

    expect(exit).toHaveBeenCalledWith(1);
    expect(execute).not.toHaveBeenCalled(); // 없는 설치를 갱신하려 들지 않는다
    expect(errs.join("\n")).toContain("agent-harness install");
  });

  // v26.135.0 (#253) — update 는 v26.134.0(ADR-049)부터 외부 CLI 산출물도 갱신한다.
  // `.claude/` 유무로 막으면 opencode/codex 단독 설치는 갱신할 게 있는데도 거절당한다.
  it("`.claude/` 가 없어도 설치돼 있으면 갱신한다 (opencode/codex 단독)", () => {
    const execute = vi.fn();
    const exit = vi.fn() as unknown as (code: number) => never;
    updateAction(
      { projectDir: dir },
      {
        log: () => {},
        err: () => {},
        exit,
        detect: () => fakeState({ hasClaudeDir: false, state: "existing", tracks: ["tooling"] }),
        execute,
      },
    );

    expect(execute).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalledWith(1);
  });

  it("--project-dir 를 절대경로로 정규화해 감지한다", () => {
    const seen: string[] = [];
    updateAction(
      { projectDir: "." },
      {
        log: () => {},
        err: () => {},
        detect: (p) => {
          seen.push(p);
          return fakeState();
        },
        execute: () => {},
      },
    );
    expect(seen[0]).toBe(process.cwd());
  });
});

describe("update spec 단일 출처", () => {
  /**
   * 위저드와 `update` 명령이 각자 spec 리터럴을 들고 있으면 한쪽만 바뀔 때 조용히 갈린다.
   * 실제로 이 repo 가 반복해서 당한 실패 모드라, 둘 다 `buildUpdateSpec` 을 쓰는지 본다.
   */
  it("`update` 명령이 넘기는 spec 이 buildUpdateSpec 산출물과 동일하다", () => {
    const execute = vi.fn();
    updateAction(
      { projectDir: "/tmp/x" },
      {
        log: () => {},
        err: () => {},
        detect: () => fakeState({ tracks: ["tooling"] }),
        execute,
      },
    );
    const [spec] = execute.mock.calls[0] as [InstallSpec];
    expect(spec).toEqual(buildUpdateSpec("/tmp/x", ["tooling"]));
  });

  it("update spec 은 .claude/ 만 대상이므로 cli 는 claude 고정", () => {
    expect(buildUpdateSpec("/p", []).cli).toEqual(["claude"]);
  });
});

describe("mode ↔ 비대화형 진입점 대응 (계열 비대칭 가드)", () => {
  /**
   * `MODE_ENTRY_POINT` 는 `Record<InstallMode, ...>` 라 mode 추가 시 컴파일이 막는다.
   * 여기서는 **선언한 명령이 실제로 등록돼 있는지** 본다 — 이름만 적어두고 명령이 없으면
   * 표가 거짓이 되고, 거짓인 표는 없느니만 못하다.
   */
  const registered = new Set(
    buildCli()
      .commands.map((cmd) => cmd.name)
      .filter((n) => n.length > 0),
  );

  it("진입점으로 선언된 명령은 전부 실제 등록돼 있다", () => {
    for (const [mode, command] of Object.entries(MODE_ENTRY_POINT)) {
      if (command === null) continue;
      expect(registered, `mode '${mode}' → '${command}' 명령 미등록`).toContain(command);
    }
  });

  it("update 는 위저드 전용이 아니다 — 이 항목이 null 로 돌아가면 회귀다", () => {
    expect(MODE_ENTRY_POINT.update).toBe("update");
  });

  it("위저드 전용으로 남은 mode 를 명시적으로 고정한다 (침묵 방지)", () => {
    const wizardOnly = Object.entries(MODE_ENTRY_POINT)
      .filter(([, cmd]) => cmd === null)
      .map(([mode]) => mode);
    // reinstall = `.claude/` 를 옮기는 파괴적 경로. 비대화형 진입점을 붙이면 이 목록에서 빠지고
    // 이 단언이 실패한다 — 그때 의도적 변경임을 명시하게 만드는 게 목적이다.
    expect(wizardOnly).toEqual(["reinstall"]);
  });
});

describe("명령 계열 표면 대칭", () => {
  const cli = buildCli();
  const named = cli.commands.filter((cmd) => cmd.name.length > 0);

  it("모든 명명 명령이 --project-dir 를 받는다 (대상 지정 없이는 CI 에서 못 쓴다)", () => {
    // 열거가 아니라 등록된 명령에서 derive — 새 명령이 생겨도 이 게이트를 고칠 필요가 없다.
    // cac 은 옵션명을 camelCase 로 정규화한다 (`--project-dir` → `projectDir`).
    for (const cmd of named) {
      const flags = cmd.options.map((o) => o.name);
      expect(flags, `'${cmd.name}' 에 --project-dir 없음`).toContain("projectDir");
    }
  });

  it("update 가 명령 목록에 있다", () => {
    expect(named.map((c) => c.name)).toContain("update");
  });
});

describe("update 명령이 실제 디렉토리를 본다", () => {
  it(".claude 가 있으면 진행, 없으면 차단 — 실 파일시스템 기준", () => {
    const dir = mkdtempSync(join(tmpdir(), "update-fs-"));
    try {
      const exit = vi.fn() as unknown as (code: number) => never;
      const execute = vi.fn();
      // .claude 부재
      updateAction({ projectDir: dir }, { log: () => {}, err: () => {}, exit, execute });
      expect(exit).toHaveBeenCalledWith(1);

      // .claude 생성 후에는 파이프라인까지 간다
      mkdirSync(join(dir, ".claude"), { recursive: true });
      updateAction({ projectDir: dir }, { log: () => {}, err: () => {}, exit, execute });
      expect(execute).toHaveBeenCalledOnce();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

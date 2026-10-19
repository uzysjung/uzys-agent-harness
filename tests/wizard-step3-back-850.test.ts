/**
 * #850 — 위저드 3단계 첫 페이지에서 ESC 로 2단계(CLI)로 나갔다 다시 들어오면 **확정 전 편집이 그대로**다.
 *
 * confirm 에서 ESC 로 돌아오는 경로는 편집이 살아 있는데, 3단계 첫 페이지 ESC 는 프롬프트 지역 상태(`collected`)를 버려
 * 재진입이 트랙 기본값으로 초기화됐다. 같은 "뒤로" 제스처가 경로마다 다르게 굴던 것이다. 리셋 트리거는 트랙 변경뿐이다
 * (docs/specs/v26-54-all-in-one-installer.md §ESC).
 *
 * 두 겹을 본다: ⓐ 프롬프트 어댑터가 첫 페이지 ESC 에 그때까지 확정한 편집을 돌려준다 ⓑ 위저드(새 설치 · Update)가 그것을
 * 다음 진입의 초기값으로 쓰고, 트랙이 바뀌면 리셋한다.
 */

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialTargetSelection, runInteractive } from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import type { DetectedInstall } from "../src/state.js";
import type { CliTargets, Track } from "../src/types.js";

const CANCEL = Symbol("test:cancel");
const clack = vi.hoisted(() => ({ groupMultiselect: vi.fn() }));
vi.mock("@clack/prompts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clack/prompts")>()),
  groupMultiselect: clack.groupMultiselect,
  isCancel: (v: unknown) => v === CANCEL,
}));

/** 3단계 프롬프트가 첫 진입에 돌려주는 "뒤로 + 편집" — 타입은 어댑터 계약 그대로(값으로만 쓴다). */
type Step3Result = Awaited<ReturnType<Prompts["selectInstallTargets"]>>;

const ASSET = "asset:ci-scaffold" as InstallTargetId;

function edited(tracks: Track[]): InstallTargetId[] {
  const ids = initialTargetSelection(tracks, []);
  expect(ids, "전제: 해제할 자산이 트랙 기본으로 체크돼 있다").toContain(ASSET);
  return ids.filter((id) => id !== ASSET);
}

function basePrompts(overrides: Partial<Prompts>): Prompts {
  return {
    intro: vi.fn(),
    outro: vi.fn(),
    cancel: vi.fn(),
    selectAction: vi.fn(async () => "update" as const),
    selectTracks: vi.fn(async (initial?: Track[]) => initial ?? (["tooling"] as Track[])),
    selectCli: vi.fn(async (initial?: CliTargets) => initial ?? (["claude"] as CliTargets)),
    confirmInstall: vi.fn(async () => true),
    selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial),
    ...overrides,
  };
}

/** 1회차: 편집을 들고 뒤로 · 2회차: 받은 초기값 그대로 확정. */
function backThenForward(back: InstallTargetId[]) {
  return vi
    .fn<(initial: ReadonlyArray<InstallTargetId>) => Promise<Step3Result>>()
    .mockResolvedValueOnce({ back } as unknown as Step3Result)
    .mockImplementation(async (initial) => initial);
}

const newState: DetectedInstall = {
  state: "none",
  log: null,
  tracks: [],
  hasClaudeDir: false,
  traces: [],
};

describe("ⓐ 프롬프트 어댑터 — 첫 페이지 ESC 가 확정한 편집을 돌려준다", () => {
  beforeEach(() => {
    clack.groupMultiselect.mockReset();
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
  });
  afterEach(() => vi.restoreAllMocks());

  it("page 1 에서 하나 해제 → Enter → page 2 ESC → page 1 ESC = { back } 에 해제가 남는다", async () => {
    const { defaultPrompts } = await import("../src/prompts.js");
    let removed = "";
    clack.groupMultiselect
      .mockImplementationOnce(async (opts: { initialValues: string[] }) => {
        removed = opts.initialValues[0] ?? "";
        return opts.initialValues.slice(1);
      })
      .mockResolvedValueOnce(CANCEL) // page 2 ESC → page 1
      .mockResolvedValueOnce(CANCEL); // page 1 ESC → Step 2
    const initial = initialTargetSelection(["tooling"], []);
    const result = await defaultPrompts.selectInstallTargets(
      initial,
      { current: 3, total: 5 },
      { tracks: ["tooling"], cli: ["claude"] },
    );
    expect(removed).not.toBe("");
    expect(result).toEqual({ back: expect.any(Array) });
    const back = (result as unknown as { back: string[] }).back;
    expect(back).not.toContain(removed);
    expect(back.length).toBe(initial.length - 1);
  });
});

describe("ⓑ 위저드 — 재진입 초기값 = 직전 편집 · 트랙 변경 시만 리셋", () => {
  it("새 설치 — 3단계 ESC → 2단계 → 3단계 재진입이 직전 편집으로 시작하고, 확인 화면이 해제를 말한다", async () => {
    const back = edited(["tooling"]);
    const selectInstallTargets = backThenForward(back);
    const confirmInstall = vi.fn(async (_s: string) => true as boolean | null);
    const result = await runInteractive("/tmp/proj-850", {
      prompts: basePrompts({ selectInstallTargets, confirmInstall }),
      detect: () => newState,
      isTty: () => true,
    });
    expect(result.ok).toBe(true);
    expect(selectInstallTargets).toHaveBeenCalledTimes(2);
    expect(selectInstallTargets.mock.calls[1]?.[0]).toEqual(back);
    expect(confirmInstall.mock.calls[0]?.[0]).toContain("-Unchecked by you: ci-scaffold");
  });

  it("새 설치 — 뒤로 간 김에 트랙을 바꾸면 새 트랙의 기본값으로 리셋한다", async () => {
    const selectInstallTargets = backThenForward(edited(["tooling"]));
    const selectTracks = vi
      .fn<(initial?: Track[]) => Promise<Track[] | null>>()
      .mockResolvedValueOnce(["tooling"])
      .mockResolvedValueOnce(["data"]);
    const selectCli = vi
      .fn<(initial?: CliTargets) => Promise<CliTargets | null>>()
      .mockResolvedValueOnce(["claude"])
      .mockResolvedValueOnce(null) // 2단계 ESC → 1단계
      .mockResolvedValueOnce(["claude"]);
    await runInteractive("/tmp/proj-850", {
      prompts: basePrompts({ selectInstallTargets, selectTracks, selectCli }),
      detect: () => newState,
      isTty: () => true,
    });
    expect(selectInstallTargets.mock.calls[1]?.[0]).toEqual(initialTargetSelection(["data"], []));
  });

  describe("Update 흐름", () => {
    let dir = "";
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "wiz-850-"));
      mkdirSync(join(dir, ".claude"));
    });
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    it("3단계 ESC → 2단계 → 재진입이 직전 편집으로 시작한다", async () => {
      const first = vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => initial);
      // 1회차 초기값을 받아 하나 해제한 채 뒤로 간다 — Update 의 초기값은 기록·설치 상태에서 오므로 그대로 쓴다.
      let back: InstallTargetId[] = [];
      const selectInstallTargets = vi
        .fn<(initial: ReadonlyArray<InstallTargetId>) => Promise<Step3Result>>()
        .mockImplementationOnce(async (initial) => {
          back = initial.filter((id) => id !== ASSET);
          expect(back.length, "전제: 해제할 자산이 초기 체크에 있다").toBe(initial.length - 1);
          return { back } as unknown as Step3Result;
        })
        .mockImplementation(first);
      const result = await runInteractive(dir, {
        prompts: basePrompts({ selectInstallTargets }),
        detect: () => ({
          state: "installed",
          log: null,
          tracks: ["tooling"],
          hasClaudeDir: true,
          traces: [],
        }),
        isTty: () => true,
      });
      expect(result.ok).toBe(true);
      expect(selectInstallTargets).toHaveBeenCalledTimes(2);
      expect(selectInstallTargets.mock.calls[1]?.[0]).toEqual(back);
    });
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readInstallLog } from "../src/install-log.js";
import { buildManifestSpec, runInstall } from "../src/installer.js";
import { runInteractive } from "../src/interactive.js";
import type { InstallTargetId, Prompts } from "../src/prompts.js";
import { findSuperseded } from "../src/superseded.js";
import type { CliTargets, InstallSpec, OptionFlags, Track } from "../src/types.js";

/**
 * 이번 선택이 밀어낸 자산이 디스크에 남는 문제 (ADR-075).
 *
 * 실측한 증상: 빈 프로젝트 → 설치(에이전트 9개) → `--with ecc-plugin` 추가 → `update`.
 * 세 단계 내내 9개 그대로였다. `ecc-plugin` 을 고르면 manifest 상 `!withEcc` 폴백 4종이 설치
 * 대상에서 빠지는데, **이미 깔린 파일은 아무도 안 지운다** — install 은 안 깔 뿐이고
 * `pruneOrphans` 는 `templates/` 에 원본이 있으면 손대지 않는다. ECC 는 자기 `code-reviewer.md`
 * 를 들고 오므로 이름까지 겹치고, 비용은 ~287 tok/세션이 영구로 남았다.
 *
 * 두 축을 함께 문다: **찾는가**(판정식이 맞는가) · **지우는가**(사용자가 그러라고 했을 때만).
 */
const HARNESS_ROOT = resolve(__dirname, "..");
const NO_OPTS: OptionFlags = { withPrune: false, withCodexTrust: false };
/** manifest 의 `applies: (s) => !s.withEcc` 폴백 에이전트 — `ecc-plugin` 이 밀어내는 것들. */
const FALLBACK = ".claude/agents/code-reviewer.md";
/** 같은 트랙의 폴백 아닌 에이전트. 탐지기가 전부를 쓸어담지 않음을 보이는 대조군. */
const KEPT = ".claude/agents/implementer.md";

describe("밀려난 자산 (ADR-075)", () => {
  let projectDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-superseded-"));
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
  });

  const spec = (extra: Partial<InstallSpec> = {}): InstallSpec => ({
    tracks: ["tooling"],
    options: NO_OPTS,
    cli: ["claude"],
    projectDir,
    ...extra,
  });

  const withEcc = (extra: Partial<InstallSpec> = {}): InstallSpec =>
    spec({ userOverride: { forceInclude: ["ecc-plugin"], forceExclude: [] }, ...extra });

  const install = (s: InstallSpec, mode?: "add" | "update" | "reinstall") =>
    runInstall({
      runExternal: null,
      harnessRoot: HARNESS_ROOT,
      projectDir,
      ...(mode ? { mode } : {}),
      spec: s,
    });

  it("전제 — ECC 없이 설치하면 폴백 에이전트가 깔린다", () => {
    install(spec());
    expect(existsSync(join(projectDir, FALLBACK))).toBe(true);
    expect(existsSync(join(projectDir, KEPT))).toBe(true);
  });

  it("ecc-plugin 을 고르면 폴백이 후보로 잡힌다 (그전엔 아무도 안 봤다)", () => {
    install(spec());
    const found = findSuperseded(
      projectDir,
      buildManifestSpec(withEcc()),
      readInstallLog(projectDir),
    );
    expect(found.map((f) => f.target)).toContain(FALLBACK);
    // 대조군 — 폴백이 아닌 에이전트는 안 잡힌다. 이게 없으면 "전부 잡는" 탐지기여도 통과한다.
    expect(found.map((f) => f.target)).not.toContain(KEPT);
  });

  it("사용자가 정리를 고르면 실제로 지워진다", () => {
    install(spec());
    const report = install(withEcc({ cleanSuperseded: true }), "add");
    expect(existsSync(join(projectDir, FALLBACK))).toBe(false);
    expect(report.superseded.removed).toContain(FALLBACK);
    expect(report.superseded.kept).toEqual([]);
    // 밀려나지 않은 에이전트는 그대로다 — 정리가 이웃을 데려가지 않는다.
    expect(existsSync(join(projectDir, KEPT))).toBe(true);
  });

  it("안 고르면 안 지운다 — 대신 남았다고 보고한다 (비대화형 기본 경로)", () => {
    install(spec());
    const report = install(withEcc(), "add"); // cleanSuperseded 없음
    expect(existsSync(join(projectDir, FALLBACK))).toBe(true);
    expect(report.superseded.removed).toEqual([]);
    expect(report.superseded.kept).toContain(FALLBACK);
  });

  describe("지우지 않는 경계", () => {
    it("사용자가 고친 파일은 후보가 아니다 (해시 불일치)", () => {
      install(spec());
      const abs = join(projectDir, FALLBACK);
      writeFileSync(abs, `${readFileSync(abs, "utf8")}\n<!-- 내가 덧붙인 줄 -->\n`);
      const report = install(withEcc({ cleanSuperseded: true }), "add");
      expect(existsSync(abs)).toBe(true);
      expect(report.superseded.removed).not.toContain(FALLBACK);
      expect(readFileSync(abs, "utf8")).toContain("내가 덧붙인 줄");
    });

    it("설치 기록이 없으면 아무것도 안 낸다 (소유를 주장할 근거가 없다)", () => {
      install(spec());
      rmSync(join(projectDir, ".uzys-agent-harness/.harness-install.json"));
      expect(
        findSuperseded(projectDir, buildManifestSpec(withEcc()), readInstallLog(projectDir)),
      ).toEqual([]);
      expect(existsSync(join(projectDir, FALLBACK))).toBe(true);
    });

    it("트랙이 바뀌면 아무것도 안 낸다 (트랙 제거는 자동화하지 않는다고 선언한 영역)", () => {
      install(spec());
      const otherTrack = buildManifestSpec(withEcc({ tracks: ["executive"] }));
      expect(findSuperseded(projectDir, otherTrack, readInstallLog(projectDir))).toEqual([]);
    });

    it("스킬 디렉터리는 후보가 아니다 (ADR-046 — 사용자 파일이 섞인다)", () => {
      install(spec());
      const found = findSuperseded(
        projectDir,
        buildManifestSpec(withEcc()),
        readInstallLog(projectDir),
      );
      expect(found.filter((f) => f.target.startsWith(".claude/skills/"))).toEqual([]);
    });

    // ⚠ 이 단언은 **게이트가 아니라 특성 기록**이다. `classifyBaselineTarget` 가드를 지우는
    // 변이가 살아남았다 — 지금 manifest 에는 `applies()` 가 거짓이 될 수 있는 구조 자산이
    // 하나도 없어서(전부 `applies: all`) 조건 자체에 도달하지 않는다. 그 가드가 실제로 무는
    // 대상은 `.claude/commands/uzys/*.md` 인데 `templates/` 에 원본이 0개다(ADR-073 선재 결함).
    // 원본이 생기면 그때 이 자리가 진짜 게이트가 된다.
    it("구조 자산은 안 나온다 [특성 기록 — 변이 생존, 위 주석 참조]", () => {
      install(spec());
      const found = findSuperseded(
        projectDir,
        buildManifestSpec(withEcc()),
        readInstallLog(projectDir),
      );
      for (const f of found) {
        expect(f.target).not.toBe(".claude/settings.json");
        expect(f.target).not.toBe("CLAUDE-uzys-harness.md");
      }
      expect(existsSync(join(projectDir, ".claude/settings.json"))).toBe(true);
    });
  });

  /**
   * 위저드가 실제로 묻는가 — 판정식이 맞아도 화면이 안 물으면 사용자에게는 없는 기능이다.
   *
   * 여기서 도는 것이 프롬프트 호출 · 원인 표기(반사실) · 토큰 표기 · 응답 3갈래다.
   */
  describe("위저드", () => {
    const basePrompts = (over: Partial<Prompts> = {}): Prompts => ({
      intro: vi.fn(),
      outro: vi.fn(),
      cancel: vi.fn(),
      selectTracks: vi.fn(async () => ["tooling"] as Track[]),
      selectCli: vi.fn(async () => ["claude"] as CliTargets),
      selectAction: vi.fn(async () => "add" as const),
      selectScope: vi.fn(async () => "project" as const),
      confirmInstall: vi.fn(async () => true),
      confirmSupersededCleanup: vi.fn(async () => true),
      // 위저드 3단계에서 `ecc-plugin` 을 추가로 고른 상태를 흉내낸다.
      selectInstallTargets: vi.fn(async (initial: ReadonlyArray<InstallTargetId>) => [
        ...initial,
        "asset:ecc-plugin" as InstallTargetId,
      ]),
      ...over,
    });

    const runWizard = async (over: Partial<Prompts> = {}) => {
      const prompts = basePrompts(over);
      const result = await runInteractive(projectDir, {
        prompts,
        isTty: () => true,
        detect: () => ({ state: "existing", tracks: ["tooling"] }) as never,
        readInstalled: () => ({ installed: [], projectScoped: [] }),
      });
      return { prompts, result };
    };

    it("후보가 있으면 묻고, 원인과 비용을 함께 낸다", async () => {
      install(spec());
      const { prompts, result } = await runWizard();
      const call = vi.mocked(prompts.confirmSupersededCleanup).mock.calls[0];
      expect(call, "후보가 있는데 안 물었다").toBeDefined();
      expect(call?.[0].map((i) => i.target)).toContain(FALLBACK);
      // 원인은 반사실로 짚는다 — 이름을 코드에 적지 않았으므로 이게 실제로 도는지 확인한다.
      expect(call?.[1].by).toEqual(["ecc-plugin"]);
      expect(call?.[1].tokens).toBeGreaterThan(0);
      expect(result.spec?.cleanSuperseded).toBe(true);
    });

    it("후보가 0건이면 화면을 띄우지 않는다 (매번 뜨는 확인은 안 읽힌다)", async () => {
      // 설치 기록이 없는 새 프로젝트 = 후보 0건.
      const { prompts } = await runWizard();
      expect(prompts.confirmSupersededCleanup).not.toHaveBeenCalled();
    });

    it("아니오면 정리 플래그가 안 붙는다", async () => {
      install(spec());
      const { result } = await runWizard({ confirmSupersededCleanup: vi.fn(async () => false) });
      expect(result.ok).toBe(true);
      expect(result.spec?.cleanSuperseded).toBeUndefined();
    });

    it("ESC 는 '예'가 아니다 — 확인 화면으로 되돌린다", async () => {
      install(spec());
      // 처음엔 ESC(null), 두 번째엔 아니오 → 무한 루프 없이 빠져나오고 삭제도 안 한다.
      // `answers.shift() ?? false` 로 쓰면 `??` 가 null 을 false 로 접어 ESC 가 사라진다
      // (초안에서 실제로 그렇게 썼고 이 테스트가 잡았다).
      let nth = 0;
      const { prompts, result } = await runWizard({
        confirmSupersededCleanup: vi.fn(async () => (nth++ === 0 ? null : false)),
      });
      expect(prompts.confirmSupersededCleanup).toHaveBeenCalledTimes(2);
      // 되돌아갔으므로 확인 화면도 두 번 떴다.
      expect(prompts.confirmInstall).toHaveBeenCalledTimes(2);
      expect(result.spec?.cleanSuperseded).toBeUndefined();
    });
  });

  it("정리 뒤 update 가 되살리지 않는다 (해제와 같은 규율)", () => {
    // 지웠는데 다음 update 가 도로 깔면 정리는 무의미하다. `installNewAssets` 는 트랙에서
    // manifest 를 유도하므로 이 대조가 없으면 그 경로가 조용히 되살릴 수 있다.
    install(spec());
    install(withEcc({ cleanSuperseded: true }), "add");
    expect(existsSync(join(projectDir, FALLBACK))).toBe(false);
    const report = install(spec(), "update");
    // update 는 install log 의 tracks 만 보고 opt-in 축은 양극단 교집합으로 평가한다
    // (`trackOnlyFileAssets`) — `!withEcc` 자산은 한쪽에서만 대상이라 복구 대상이 아니다.
    expect(existsSync(join(projectDir, FALLBACK))).toBe(false);
    expect(report.updateMode?.installedNew ?? []).not.toContain(FALLBACK);
    expect(report.updateMode?.restored ?? []).not.toContain(FALLBACK);
  });
});

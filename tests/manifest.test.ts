import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { ALWAYS_HOOKS, buildManifest, resolveRules } from "../src/manifest.js";

describe("resolveRules", () => {
  it("includes COMMON rules for any track", () => {
    // v26.107.0 (ADR-036) — doc-governance: SSOT 위계 + merge=코드+추적 동기화. 전 트랙 공통 —
    //   executive 트랙에서도 문서 규약은 적용된다 (거짓 상태 방지는 코드 유무와 무관).
    expect(resolveRules({ tracks: ["executive"] })).toEqual(
      expect.arrayContaining([
        "change-management",
        "gates-taxonomy",
        "git-policy",
        "doc-governance",
      ]),
    );
    expect(resolveRules({ tracks: ["tooling"] })).toContain("doc-governance");
  });

  it("does not include DEV rules for executive-only", () => {
    const rules = resolveRules({ tracks: ["executive"] });
    expect(rules).not.toContain("test-policy");
  });

  it("includes DEV rules when any dev track present", () => {
    const rules = resolveRules({ tracks: ["tooling"] });
    expect(rules).toEqual(expect.arrayContaining(["test-policy", "ship-checklist"]));
  });

  it("includes UI rules only for csr/ssr/full", () => {
    expect(resolveRules({ tracks: ["data"] })).not.toContain("playwright-launch");
    expect(resolveRules({ tracks: ["ssr-nextjs"] })).toContain("playwright-launch");
    expect(resolveRules({ tracks: ["full"] })).toContain("playwright-launch");
  });

  it("includes benchmark-parity only alongside playwright-launch (UI tracks)", () => {
    // v26.109.0 (ADR-038) — 벤치마크 실측→gap.md 루프는 capture 수단을 규정하는
    //   playwright-launch 와 짝일 때만 성립한다. 화면 없는 트랙에 깔리면 실행 불가능한
    //   의무(capture 확보)만 부과하므로 UI 트랙 한정.
    for (const track of ["ssr-nextjs", "csr-supabase", "full"] as const) {
      const rules = resolveRules({ tracks: [track] });
      expect(rules).toContain("benchmark-parity");
      expect(rules).toContain("playwright-launch");
    }
    for (const track of ["tooling", "data", "executive", "project-management"] as const) {
      expect(resolveRules({ tracks: [track] })).not.toContain("benchmark-parity");
    }
  });

  // 2026-08-02 정비 — 기술스택 상세 룰 8종(shadcn·nextjs·htmx·pyside6·database·api-contract·
  //   data-analysis·tauri)이 배포에서 빠져 트랙 매핑에 남은 것은 `cli-development` 하나다.
  //   그래도 union 축은 계속 물어야 한다: 트랙을 섞었을 때 한쪽 트랙의 룰이 빠지면 그건
  //   매핑이 아니라 덮어쓰기다.
  it("appends per-track rules union", () => {
    const mixed = resolveRules({ tracks: ["tooling", "executive"] });
    expect(mixed).toContain("cli-development");

    expect(resolveRules({ tracks: ["executive"] })).not.toContain("cli-development");
  });

  it("returns sorted, deduplicated names", () => {
    const rules = resolveRules({ tracks: ["full"] });
    expect(rules).toEqual([...rules].sort());
    expect(new Set(rules).size).toBe(rules.length);
  });
});

describe("buildManifest", () => {
  it("does not emit any uzys/* command entries (6-Gate workflow removed)", () => {
    const tooling = buildManifest({ tracks: ["tooling"] });
    expect(tooling.find((e) => e.target.includes("commands/uzys/"))).toBeUndefined();
  });

  it("does not include any project-root CLAUDE.md entry — merged via installer", () => {
    const single = buildManifest({ tracks: ["tooling"] });
    expect(single.find((e) => e.target === "CLAUDE.md")).toBeUndefined();
    expect(single.find((e) => e.source.startsWith("project-claude/"))).toBeUndefined();

    const multi = buildManifest({ tracks: ["tooling", "data"] });
    expect(multi.find((e) => e.target === "CLAUDE.md")).toBeUndefined();
  });

  it("e2e-testing: C2 opt-out gating (plugin OFF + ui track → install). v26.58.0 ADR-019", () => {
    // v26.58.0 — e2e-testing 은 ECC cherry-pick C2 → !withEcc + ui track 둘 다 필요.
    // ui track + withEcc=true → skip (plugin ON → cherry-pick 갈음)
    const uiWithEcc = buildManifest({ tracks: ["ssr-nextjs"], withEcc: true });
    const e2eUiOn = uiWithEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eUiOn?.applies({ tracks: ["ssr-nextjs"], withEcc: true })).toBe(false);

    // ui track + withEcc=false (default) → install (cherry-pick fallback)
    const uiNoEcc = buildManifest({ tracks: ["ssr-nextjs"] });
    const e2eUiOff = uiNoEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eUiOff?.applies({ tracks: ["ssr-nextjs"] })).toBe(true);

    // 비-UI track (data) + withEcc=false → skip (track 미일치)
    const dataNoEcc = buildManifest({ tracks: ["data"] });
    const e2eDataOff = dataNoEcc.find((e) => e.source === "skills/e2e-testing");
    expect(e2eDataOff?.applies({ tracks: ["data"] })).toBe(false);
  });

  it("CORE_AGENTS_ECC (code-reviewer, security-reviewer): C2 opt-out. v26.58.0 ADR-019", () => {
    // plugin OFF (default) → cherry-pick fallback install
    const off = buildManifest({ tracks: ["tooling"] });
    const codeOff = off.find((e) => e.source === "agents/code-reviewer.md");
    const secOff = off.find((e) => e.source === "agents/security-reviewer.md");
    expect(codeOff?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(secOff?.applies({ tracks: ["tooling"] })).toBe(true);

    // plugin ON → cherry-pick skip (plugin 으로 갈음)
    const on = buildManifest({ tracks: ["tooling"], withEcc: true });
    const codeOn = on.find((e) => e.source === "agents/code-reviewer.md");
    const secOn = on.find((e) => e.source === "agents/security-reviewer.md");
    expect(codeOn?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
    expect(secOn?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
  });

  it("ecc commands dir: C2 opt-out gating. v26.58.0 ADR-019", () => {
    const m = buildManifest({ tracks: ["tooling"] });
    const eccCmd = m.find((e) => e.source === "commands/ecc");
    expect(eccCmd).toBeDefined();
    // plugin OFF → cherry-pick fallback
    expect(eccCmd?.applies({ tracks: ["tooling"] })).toBe(true);
    // plugin ON → skip
    expect(eccCmd?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
  });

  it("continuous-learning-v2: C2 — plugin ON 이면 비켜선다. v26.121.0", () => {
    // v26.58.0(ADR-019)에서는 C3 였다: "우리가 수정한 판본이라 plugin 으로 갈음 불가 → 항상
    // install". 그 근거가 뒤집혀 있었다 — 우리 수정의 내용이 upstream 의 agents/(관측을 instinct
    // 로 바꾸는 분석기) **제거**였고, 즉 우리 판본은 상위집합이 아니라 진부분집합이었다. 갈음
    // 불가가 아니라 갈음당해야 맞는 쪽이다. upstream 전체 복원(lock modified:false)으로 C2 로 옮겼다.
    //
    // 실사용 영향: ECC plugin 을 켠 사용자는 동작하는 plugin 판본과 우리 사본을 둘 다 갖고 있었다.
    const off = buildManifest({ tracks: ["tooling"] });
    const cl = off.find((e) => e.source === "skills/continuous-learning-v2");
    expect(cl).toBeDefined();
    expect(cl?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(cl?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);

    // track 무관 — 갈리는 축은 withEcc 하나다.
    expect(cl?.applies({ tracks: ["executive"], withEcc: false })).toBe(true);
    expect(cl?.applies({ tracks: ["data"], withEcc: true })).toBe(false);
  });

  it("eval-harness: C3 (아티팩트 계약 주입 = modified) → withEcc 무관 dev 트랙 install. v26.114.0 ADR-042", () => {
    // 주입한 계약은 ECC plugin 판에 없으므로 plugin ON 이어도 cherry-pick 을 유지해야 한다.
    // C2 로 남기면 withEcc 사용자에게 "계약 코드화됨" 광고가 거짓이 된다 (no-false-ship).
    // 2026-08-02 정비 (ADR-060) — 이 자리의 앵커였던 verification-loop 이 이관돼 C3 계약이
    // 해체됐다. 남은 DEV 축 C3 는 eval-harness 하나이고, 검증하는 술어는 그대로다.
    const m = buildManifest({ tracks: ["tooling"] });
    const eh = m.find((e) => e.source === "skills/eval-harness");
    expect(eh).toBeDefined();
    expect(eh?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(eh?.applies({ tracks: ["tooling"], withEcc: true })).toBe(true);
    expect(eh?.applies({ tracks: ["ssr-nextjs"], withEcc: true })).toBe(true);

    // dev 트랙 조건은 유지 — executive 단독은 종전과 동일하게 미설치.
    expect(eh?.applies({ tracks: ["executive"] })).toBe(false);

    // 이관으로 사라진 쪽은 manifest 에서도 사라져야 한다 — 남으면 없는 dir 을 복사하려 든다.
    expect(m.find((e) => e.source === "skills/verification-loop")).toBeUndefined();

    // 잔여 DEV_SKILL_DIRS_ECC 는 C2 그대로 — 재분류 전파 방지.
    const aid = m.find((e) => e.source === "skills/agent-introspection-debugging");
    expect(aid?.applies({ tracks: ["tooling"], withEcc: true })).toBe(false);
  });

  it("python-* skills: C2 opt-out + track gating. v26.58.0 ADR-019", () => {
    const m = buildManifest({ tracks: ["data"] });
    const pp = m.find((e) => e.source === "skills/python-patterns");
    // data track + plugin OFF → install
    expect(pp?.applies({ tracks: ["data"] })).toBe(true);
    // data track + plugin ON → skip
    expect(pp?.applies({ tracks: ["data"], withEcc: true })).toBe(false);
    // 비-Python track + plugin OFF → skip (track 미일치)
    expect(pp?.applies({ tracks: ["executive"] })).toBe(false);
  });

  it("includes hooks for all tracks", () => {
    const m = buildManifest({ tracks: ["executive"] });
    const hookEntries = m.filter((e) => e.target.startsWith(".claude/hooks/"));
    // 수치 하드코딩(≥6)은 훅을 지울 때마다 깨지고, 늘릴 때는 아무것도 안 잡는다 → 목록에서 derive.
    // v26.115.0(ADR-043) hito-counter 제거가 이 상수를 흔들면서 드러난 문제.
    expect(hookEntries.map((e) => e.target.replace(".claude/hooks/", "")).sort()).toEqual(
      [...ALWAYS_HOOKS].sort(),
    );
    for (const h of hookEntries) {
      expect(h.applies({ tracks: ["executive"] })).toBe(true);
    }
  });

  it("includes market-research only for executive|full", () => {
    const exec = buildManifest({ tracks: ["executive"] });
    const mrExec = exec.find((e) => e.source === "skills/market-research");
    expect(mrExec?.applies({ tracks: ["executive"] })).toBe(true);

    const data = buildManifest({ tracks: ["data"] });
    const mrData = data.find((e) => e.source === "skills/market-research");
    expect(mrData?.applies({ tracks: ["data"] })).toBe(false);
  });

  // v26.87.0 — dev-method skills (uzys 1st-party, internal). no-false-ship invariant:
  //   the copy is gated on selectedInternalSkills (computed by installer via isAssetSelected),
  //   NOT on track alone — so a wizard uncheck / `--without <id>` actually drops the copy.
  //   WHY a track-only gate would be wrong: it would ignore the user's deselection and still
  //   ship the skill, contradicting the advertised "selectable" surface.
  it("dev-method skill copies are gated by selectedInternalSkills (respect uncheck)", () => {
    // 2026-08-02 정비 (ADR-060) — 표본이 multi-persona-review(이관)에서 compaction-handoff
    //   (잔존 유일 번들)로 바뀌었다. 검증하는 술어는 그대로다.
    const m = buildManifest({ tracks: ["tooling"] });
    const entry = m.find((e) => e.source === "skills/compaction-handoff");
    // entry always present in manifest — applies() gates it (parity with uzys/* commands).
    expect(entry).toBeDefined();
    expect(entry?.target).toBe(".claude/skills/compaction-handoff");
    // selected (installer included it) → copied.
    expect(
      entry?.applies({ tracks: ["tooling"], selectedInternalSkills: ["compaction-handoff"] }),
    ).toBe(true);
    // a dev track but NOT in the selected set (user unchecked / --without) → dropped,
    //   even though another internal skill IS selected.
    expect(entry?.applies({ tracks: ["tooling"], selectedInternalSkills: ["other-skill"] })).toBe(
      false,
    );
    // selectedInternalSkills omitted / empty → dropped (no track-only fallback).
    expect(entry?.applies({ tracks: ["tooling"] })).toBe(false);
    expect(entry?.applies({ tracks: ["tooling"], selectedInternalSkills: [] })).toBe(false);
  });

  it("every manifest source exists under templates/ (silent-skip guard)", () => {
    // installer 는 source 부재 시 예외 없이 skip 후 진행 — 룰/스킬명 오타가 "설치됨" 보고 +
    //   무설치(silent drift, v26.58~63 형태)가 되는 것을 구조 차단 (SOD v26.109.0 N-4).
    const templatesRoot = fileURLToPath(new URL("../templates", import.meta.url));
    const spec = {
      tracks: [
        "csr-supabase",
        "csr-fastify",
        "csr-fastapi",
        "ssr-htmx",
        "ssr-nextjs",
        "data",
        "executive",
        "tooling",
        "full",
        "project-management",
        "growth-marketing",
      ] as const,
      withTauri: true,
      selectedInternalSkills: [...INTERNAL_BUNDLED_SKILL_IDS],
    };
    for (const entry of buildManifest(spec)) {
      expect(
        existsSync(join(templatesRoot, entry.source)),
        `missing template: ${entry.source}`,
      ).toBe(true);
    }
  });
});

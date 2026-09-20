import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS, RETIRED_SKILL_IDS } from "../src/external-assets.js";
import { ALWAYS_HOOKS, buildManifest, RETIRED_AGENT_IDS, resolveRules } from "../src/manifest.js";
import { TRACKS } from "../src/types.js";

describe("resolveRules", () => {
  it("includes COMMON rules for any track", () => {
    // v26.107.0 (ADR-036) — doc-governance: SSOT 위계 + merge=코드+추적 동기화. 전 트랙 공통 —
    //   executive 트랙에서도 문서 규약은 적용된다 (거짓 상태 방지는 코드 유무와 무관).
    expect(resolveRules({ tracks: ["executive"] })).toEqual(
      expect.arrayContaining(["change-management", "git-policy", "doc-governance"]),
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

  it("playwright-launch 는 어느 트랙에도 깔리지 않는다 (2026-08-12 — 스킬이 흡수했다)", () => {
    // UI 트랙 전용 룰이었다. 남아 있던 것은 브라우저 금지문인데, 그 룰 본문이 스스로 "절차는
    // `ui-visual-review` 스킬이 SSOT" 라고 적고 있었다 — 금지와 절차를 한 자리로 합쳤다.
    // 되살아나면(= 상주 룰로 되돌아가면) 여기서 잡는다. 금지문 자체가 소실됐는지는
    // tests/browser-prohibitions-owner.test.ts 가 따로 문다.
    for (const track of TRACKS) {
      expect(resolveRules({ tracks: [track] })).not.toContain("playwright-launch");
    }
    // 0건 함정 방지 — 룰 해석 자체가 죽으면 위 단언이 공허하게 통과한다.
    expect(resolveRules({ tracks: ["ssr-nextjs"] })).toContain("git-policy");
  });

  it("benchmark-parity 는 어느 트랙에도 깔리지 않는다 (#284 — 스킬이 대신한다)", () => {
    // v26.109.0 (ADR-038) 이 UI 트랙 한정으로 넣었던 룰이다. 2026-08-04 (#284) 에 빠졌다:
    // 그 룰이 담고 있던 것은 gap.md 표 스키마 · PR 의무 필드 · dogfood walkthrough 절차이고,
    // 전부 **그 작업을 할 때만** 필요한데 매 세션 상주했다. 같은 일을 `audit-service-gaps`
    // 스킬이 온디맨드로 담당한다. 되살아나면(= 상주로 되돌아가면) 여기서 잡는다.
    for (const track of TRACKS) {
      expect(resolveRules({ tracks: [track] })).not.toContain("benchmark-parity");
    }
    // 0건 함정 방지 — 룰 해석 자체가 죽으면 위 단언이 공허하게 통과한다.
    expect(resolveRules({ tracks: ["ssr-nextjs"] })).toContain("doc-governance");
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

  // #492 — ECC cherry-pick C2 게이팅(`!withEcc`)이 자산과 함께 없어졌다. 남는 UI 스킬은
  // 우리가 쓴 `ui-visual-review` 하나이고, 트랙 게이팅만 받는다.
  it("ui-visual-review: UI 트랙에만 깔린다 (트랙 게이팅)", () => {
    const m = buildManifest({ tracks: [...TRACKS] });
    const ui = m.find((e) => e.source === "skills/ui-visual-review");
    expect(ui?.applies({ tracks: ["ssr-nextjs"] })).toBe(true);
    expect(ui?.applies({ tracks: ["data"] })).toBe(false);
  });

  // ADR-090 (#452) — ECC 폴백 에이전트 축이 은퇴로 비었고(그 계약의 표본은 스킬 쪽 C2 테스트가
  // 이어받는다), 그 자리에 **트랙 조건부 강등**이 들어왔다. 두 에이전트는 전 트랙 상주였는데
  // 도메인을 안 고른 설치자에게는 열릴 일이 없어 descriptor 만 물고 있었다.
  it("data-analyst · strategist: 도메인 트랙에만 깔린다 (ADR-090 강등)", () => {
    const entry = (id: string) =>
      buildManifest({ tracks: [...TRACKS] }).find((e) => e.source === `agents/${id}.md`);
    const da = entry("data-analyst");
    const st = entry("strategist");
    expect(da, "data-analyst 가 manifest 에 없다").toBeDefined();
    expect(st, "strategist 가 manifest 에 없다").toBeDefined();

    expect(da?.applies({ tracks: ["data"] })).toBe(true);
    expect(da?.applies({ tracks: ["full"] })).toBe(true);
    expect(da?.applies({ tracks: ["tooling"] })).toBe(false);

    expect(st?.applies({ tracks: ["executive"] })).toBe(true);
    expect(st?.applies({ tracks: ["full"] })).toBe(true);
    expect(st?.applies({ tracks: ["tooling"] })).toBe(false);

    // 전 트랙 축이 통째로 죽지는 않았다 — 같은 조회로 reviewer 는 어느 트랙에나 깔린다.
    const rv = entry("reviewer");
    expect(rv?.applies({ tracks: ["tooling"] })).toBe(true);
    expect(rv?.applies({ tracks: ["executive"] })).toBe(true);
  });

  // ADR-089 (#445) — 은퇴는 **manifest 에서 사라졌다**로 증명한다. 파일 부재만 보면 다음 사람이
  // 번들에 파일을 되돌려 놓는 순간 조용히 되살아난다.
  it("은퇴한 리뷰 에이전트 2종은 어떤 조합에서도 manifest 에 없다 (ADR-089)", () => {
    for (const withTauri of [false, true]) {
      const m = buildManifest({ tracks: [...TRACKS], withTauri });
      for (const id of RETIRED_AGENT_IDS) {
        expect(
          m.find((e) => e.source === `agents/${id}.md`),
          `${id} 가 manifest 에 살아 있다 (withTauri=${withTauri})`,
        ).toBeUndefined();
      }
      // 0건 함정 방지 — 모집단이 비면 위 단언은 공허하다. 남는 에이전트가 실제로 잡히는지 본다.
      expect(m.find((e) => e.source === "agents/reviewer.md")).toBeDefined();
    }
    expect(RETIRED_AGENT_IDS.length).toBeGreaterThan(0);
  });

  // 2026-08-16 (ADR-073) — 판정을 뒤집었다. ADR-019 는 ECC 플러그인을 **안 고른** 사람에게
  // 폴백 명령 8종을 깔았는데, 그중 5개가 안 고른 자산(ECC 에이전트 · CL-v2 스크립트)을 가리켜
  // 폴백이 자립하지 못했다. 이제 어떤 조합에서도 명령이 깔리지 않는다(#492 에서 게이팅 축
  // 자체가 없어져 조합은 하나뿐이다).
  it("ecc commands: 안 깔린다 (ADR-073)", () => {
    const m = buildManifest({ tracks: ["tooling"] });
    expect(m.find((e) => e.source === "commands/ecc")).toBeUndefined();
  });

  it("전제 확인 — 같은 조회 방식으로 실재하는 엔트리는 찾힌다 (게이트 자기검증)", () => {
    // 위 테스트는 `find(...)` 가 undefined 임을 단언한다. 조회 방식 자체가 고장 나면(source 필드
    // 개명 등) 무엇을 넣어도 undefined 라 저 게이트가 조용히 죽는다. 알려진 양성으로 대조한다.
    const m = buildManifest({ tracks: ["tooling"] });
    expect(m.find((e) => e.source === "hooks/protect-files.sh")).toBeDefined();
  });

  // ADR-090 (#452) — 은퇴한 스킬도 에이전트와 같은 방식으로 증명한다: **manifest 에서 사라졌다**.
  // 파일 부재만 보면 다음 사람이 `templates/skills/` 에 디렉터리를 되돌려 놓는 순간 조용히
  // 되살아난다. #492 로 은퇴 목록에 ECC cherry-pick 7종이 들어와 같은 게이트가 그것도 문다.
  it("은퇴한 스킬은 manifest 에 없다 (ADR-090 · #492)", () => {
    const m = buildManifest({ tracks: [...TRACKS], withTauri: true });
    for (const id of RETIRED_SKILL_IDS) {
      expect(
        m.find((e) => e.source === `skills/${id}`),
        `${id} 가 manifest 에 살아 있다`,
      ).toBeUndefined();
    }
    // 0건 함정 방지 — 같은 조회로 남는 스킬은 잡힌다.
    expect(m.find((e) => e.source === "skills/recurrence-prevention")).toBeDefined();
    expect(RETIRED_SKILL_IDS.length).toBeGreaterThan(0);
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

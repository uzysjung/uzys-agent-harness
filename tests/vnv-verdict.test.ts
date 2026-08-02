import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MODIFIED_ECC_SKILL_DIRS } from "../src/manifest.js";

// v26.113.0 (ADR-041, 라이프사이클 자산화 ⑤) — V&V verdict 어휘 코드화의 광고 계약 검증이었다.
//
// 2026-08-02 정비 (ADR-060) — 그 어휘를 싣던 두 스킬(verification-loop · model-orchestration)이
// uzysjung/uzys-agent-skills 로 이관돼 이 리포에 본문이 없다. 본문 계약은 이관 리포가 소유한다.
// **이 리포에 남는 계약은 하나** — C3(수정본) cherry-pick 목록과 `cherrypicks.lock` 의
// `modified:true` 플래그가 1:1 이어야 한다는 것. 어긋나면 `sync-cherrypicks.sh --apply` 의
// `rsync -a --delete` 가 로컬 수정을 조용히 덮어쓴다 (그리고 아무도 모른다).

const read = (rel: string): string =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("C3 cherry-pick 계약 — manifest ↔ cherrypicks.lock", () => {
  it("C3 스킬은 cherrypicks.lock 에서 modified:true — sync --apply 의 덮어쓰기 방지", () => {
    const lock = JSON.parse(read("../.dev-references/cherrypicks.lock")) as {
      cherrypicks: Array<{ dst: string; modified: boolean }>;
    };
    // derive 원본이 비거나 한쪽(COMMON/DEV)을 잃으면 아래 루프가 0회 돌아 공허하게 통과한다
    // — mutation 으로 실증된 구멍(M13/M14). 알려진 C3 의 존재를 먼저 못 박는다.
    // 신규 C3 추가는 이 단언을 건드리지 않고 lock 플래그만 요구한다(제거만 차단).
    // v26.121.0 — 앵커였던 continuous-learning-v2 가 C2 로 내려갔다(upstream 전체 복원 →
    // lock modified:false).
    // 2026-08-02 — verification-loop 이 C3 계약에서 빠졌다(이관). 앵커는 COMMON=deep-research,
    // DEV=eval-harness 로 각 한 축씩 유지 — 한 축이 사라지면 루프가 반쪽만 돈다.
    expect(MODIFIED_ECC_SKILL_DIRS).toContain("deep-research");
    expect(MODIFIED_ECC_SKILL_DIRS).toContain("eval-harness");
    expect(MODIFIED_ECC_SKILL_DIRS).not.toContain("verification-loop");

    for (const sd of MODIFIED_ECC_SKILL_DIRS) {
      const entry = lock.cherrypicks.find((c) => c.dst === `templates/skills/${sd}/`);
      expect(entry, `cherrypicks.lock entry missing for ${sd}`).toBeDefined();
      expect(entry?.modified, `${sd} must be modified:true in cherrypicks.lock`).toBe(true);
    }
  });

  it("lock 의 모든 dst 가 실재한다 (역방향 — 좀비 lock 행 차단)", () => {
    // 위 단언은 한 방향만 본다 — 자산을 지우고 lock 행을 남기는 형태는 통과한다. 이번 정비가
    // 정확히 그 형태였다(verification-loop 스킬 · karpathy-gate 훅). 좀비 행이 남으면
    // `sync-cherrypicks.sh` 가 지운 자산을 upstream 에서 되살린다 — 삭제가 되돌려진다.
    const lock = JSON.parse(read("../.dev-references/cherrypicks.lock")) as {
      cherrypicks: Array<{ id: string; dst: string }>;
    };
    expect(lock.cherrypicks.length).toBeGreaterThan(0); // 공허한 통과 차단
    const dangling = lock.cherrypicks
      .filter((c) => !existsSync(fileURLToPath(new URL(`../${c.dst}`, import.meta.url))))
      .map((c) => `${c.id} → ${c.dst}`);
    expect(dangling).toEqual([]);
  });

  it("repo-local .claude 복사본이 템플릿과 byte-동일 (silent drift 가드)", () => {
    // 이 repo 는 자기 하네스를 .claude/ 에 자가 설치해 쓴다. 템플릿만 고치고 복사본을
    // 안 고치면 "주입됨" 보고와 실제 세션 동작이 갈라진다.
    for (const sd of MODIFIED_ECC_SKILL_DIRS) {
      expect(read(`../.claude/skills/${sd}/SKILL.md`)).toBe(
        read(`../templates/skills/${sd}/SKILL.md`),
      );
    }
  });
});

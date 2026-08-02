import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildManifest } from "../src/manifest.js";
import { type InstallSpec, TRACKS } from "../src/types.js";

/**
 * 서버측 git 가드 스크립트의 도달 경로 게이트.
 *
 * 이 자산이 죽는 방식은 둘이다. ⓐ `templates/` 에는 있는데 manifest 에 없어 **게시는 되고 설치는
 * 안 되는** 회색지대에 남는 것 ⓑ 설치는 되는데 아무 문서도 안 가리켜 설치자가 존재를 모르는 것.
 * 둘 다 조용하다 — 그래서 경로를 **manifest 에서 derive 해** 룰 문안과 대조한다. 룰과 테스트에
 * 경로를 각각 적으면 그게 두 번째 하드코딩 사본이고, 다음 drift 의 서식지가 된다.
 */
const ROOT = join(__dirname, "..");
const SOURCE = "scripts/protect-branch.sh";

const specFor = (track: string): InstallSpec =>
  ({ tracks: [track], cli: ["claude"], options: {} }) as unknown as InstallSpec;

const entryFor = (track: string) => {
  const spec = specFor(track);
  return buildManifest(spec)
    .filter((e) => e.applies(spec))
    .find((e) => e.source === SOURCE);
};

describe("서버측 브랜치 보호 스크립트의 도달 경로", () => {
  it("탐지기가 살아 있다 — manifest 가 엔트리를 실제로 뱉는다", () => {
    // 0건 함정 방지: buildManifest 가 빈 배열이면 아래 전수 검사가 조용히 통과한다.
    const spec = specFor("tooling");
    expect(buildManifest(spec).length).toBeGreaterThan(20);
  });

  it.each([...TRACKS])("track=%s 에 설치된다 — 트랙별 누락 없음", (track) => {
    // 되돌릴 수 없는 조작은 트랙과 무관하게 같은 위험이다. 한 트랙만 빠지면 그 트랙 설치자는
    // 보호 수단이 있다는 사실 자체를 모른다.
    expect(entryFor(track), `${track} 에 ${SOURCE} 가 안 깔린다`).toBeDefined();
  });

  it("설치 타깃이 CLI 중립 위치다 — `.claude/` 아래가 아니다", () => {
    // 저장소 규칙은 4개 CLI 전부와 사람에게 동시에 걸린다. `.claude/` 에 두면 그 사실과
    // 어긋나고, codex/opencode/antigravity 설치본에서 경로가 안 맞는다.
    const target = entryFor("tooling")?.target ?? "";
    expect(target).not.toMatch(/^\.claude\//);
    expect(target).toMatch(/\.sh$/);
  });

  it("원본 파일이 실재하고 사용법을 스스로 설명한다", () => {
    const body = readFileSync(join(ROOT, "templates", SOURCE), "utf8");
    expect(body).toContain("--dry-run");
    // 덮지 못하는 것을 출력하는 것이 이 스크립트의 계약이다 — 안 적힌 빈틈은 덮인 것으로 읽힌다.
    expect(body).toContain("Still not covered");
  });

  it("배포 룰이 **manifest 가 정한 그 경로**를 가리킨다 (derive 대조)", () => {
    const target = entryFor("tooling")?.target;
    expect(target).toBeDefined();
    const rule = readFileSync(join(ROOT, "templates", "rules", "git-policy.md"), "utf8");
    expect(
      rule,
      `git-policy 가 설치 경로 ${target} 를 안 가리킨다 — 설치는 되는데 아무도 모르는 자산이 된다`,
    ).toContain(target as string);
  });
});

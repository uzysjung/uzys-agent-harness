import { lstatSync, realpathSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * foreign-slot.ts — "그 자리는 우리 것이 아니다" 판정 (#343 · ADR-062 적용 표면 확장).
 *
 * 규칙을 **한 도구**에 둔다. `owned-write.ts` 서문이 같은 이유를 이미 적었다 — 소유자 판정이
 * 자산 종류별 코드에 흩어지면 같은 버그가 종류마다 다시 난다. 실제로 그렇게 났다:
 * `update` 는 ADR-062 로 링크를 건너뛰었는데 `install` 은 같은 자리에서 죽었고(#343),
 * `.agents/skills/` 는 두 명령 어느 쪽에서도 판정을 안 받아 조용히 덮고 있었다.
 *
 * **적용 범위는 스킬 슬롯뿐이다.** `.claude/settings.json` · `.claude/rules/*.md` 처럼 슬롯 밖
 * 파일의 링크는 "남의 자리" 로 보지 않는다 — 실체가 프로젝트 **안**이면 따라가 쓰고, **밖**이면
 * 쓰지 않는다(#678 · 판정 SSOT = `outside-project.ts`). 거기까지 이 술어로 넓히면 프로젝트 안
 * 링크까지 통째로 건너뛰어진다.
 */

/**
 * 다른 도구(`npx skills add`)가 소유할 수 있는 스킬 슬롯. **두 자리를 함께 본다** —
 * `.claude/skills/<id>` (Claude Code) 와 `.agents/skills/<id>` (codex·antigravity 공용,
 * `external-installer.ts` 의 SKILLS_CLI_AGENT_MAP 이 그 자리로 보낸다).
 * 슬롯 자체(`…/<id>`)와 그 안의 파일(`…/<id>/SKILL.md`) 둘 다 매치한다.
 */
const SKILL_SLOT = /^((?:\.claude|\.agents)\/skills\/[^/]+)(?:\/|$)/;

/**
 * 그 자리가 **디렉터리가 아닌 것**으로 이미 차 있는가 (비어 있으면 false).
 *
 * `existsSync` 로는 판정할 수 없다 — 링크를 따라가므로 "디렉터리가 있다"와 "디렉터리를 가리키는
 * 링크가 있다"에 같은 답을 내고, 깨진 링크는 아예 없는 것으로 보인다. `lstatSync` 는 링크를
 * 따라가지 않아 셋을 구분한다. 심링크뿐 아니라 파일·FIFO 등 **디렉터리가 아닌 모든 것**을 잡는다:
 * 우리가 디렉터리를 만들 자리를 차지한 것은 무엇이든 우리 것이 아니다.
 */
export function occupiedByNonDirectory(path: string): boolean {
  // throwIfNoEntry:false → 없으면 undefined. EACCES 같은 진짜 오류는 계속 던지게 둔다.
  const stat = lstatSync(path, { throwIfNoEntry: false });
  return stat !== undefined && !stat.isDirectory();
}

/**
 * `.claude/skills/<id>` 가 **이 프로젝트의** `.agents/skills/<id>` 디렉터리를 가리키는 링크인가
 * (#524 · Epic #527 S4).
 *
 * 설치자가 스킬 본문을 `.agents/skills/` 한 곳에 두고 Claude 자리에는 링크만 거는 구성이다. 그
 * 링크는 남의 저장소가 아니라 **같은 프로젝트의 공유 자리**라, 아래 `foreignOwnedTarget` 의 "링크 =
 * 남의 것"(#343)에서 이 한 모양만 뺀다. 본문을 쓸지는 여기서 정하지 않는다 — 그 자리가 우리 기록에
 * 있는지(`externalFiles`)는 호출자가 본다. 이 술어는 "어디를 가리키는가"만 답한다.
 *
 * **양쪽을 realpath 한다.** 한쪽만 풀면 macOS 임시 디렉터리(`/var/…` → `/private/var/…`)처럼
 * 프로젝트 경로 자체가 링크를 품은 곳에서 모든 링크가 "밖"으로 읽힌다. 깨진 링크(`realpathSync`
 * 가 던진다) · 다른 id · 디렉터리가 아닌 대상 · 프로젝트 밖은 전부 false — 기존 foreign 규칙으로
 * 떨어진다.
 */
export function linksToProjectSharedSkill(projectDir: string, id: string): boolean {
  const slot = join(projectDir, ".claude/skills", id);
  if (lstatSync(slot, { throwIfNoEntry: false })?.isSymbolicLink() !== true) return false;
  try {
    const real = realpathSync(slot);
    return (
      real === join(realpathSync(projectDir), ".agents/skills", id) && statSync(real).isDirectory()
    );
  } catch {
    return false;
  }
}

/**
 * 이 대상에 쓰면 **남의 것을 건드리는가**. 건드리면 사용자에게 보여 줄 경로를, 아니면 null.
 *
 * 두 가지를 본다:
 *   ⓐ 슬롯 자체가 디렉터리가 아니다 → 그 자리 전체가 남의 것 (`npx skills add` 의 링크가 이 모양)
 *   ⓑ 슬롯 안의 **중간 디렉터리**가 디렉터리가 아니다 → 그 중간 자리가 남의 것
 *   ⓒ 최종 경로가 **일반 파일이 아니다**(심링크·FIFO·소켓·디렉터리) → 그 자리만 남의 것
 * ⓑⓒ 가 따로 필요한 이유: `copyFileSync`·`writeFileSync` 는 링크를 따라가므로 죽지 않고
 * 조용히 링크 대상을 덮는다 — 크래시가 없어 아무도 신고하지 않는 형태다. 심링크만 보지 않는
 * 이유는 나머지가 더 나쁘기 때문이다: FIFO 면 읽기·쓰기가 **영영 블록**되고(설치가 멈춘다),
 * 디렉터리면 EISDIR 로 죽는다.
 *
 * @param rel `projectDir` 기준 상대경로 (슬래시 구분)
 */
export function foreignOwnedTarget(projectDir: string, rel: string): string | null {
  const slot = SKILL_SLOT.exec(rel)?.[1];
  if (slot === undefined) return null;
  if (occupiedByNonDirectory(join(projectDir, slot))) return slot;
  if (rel !== slot) {
    // 슬롯과 최종 경로 **사이의 디렉터리**부터 본다. 중간 성분이 링크면 마지막 것만 보는
    // 판정은 그 링크를 따라간 자리를 "평범한 파일"로 읽고 통과시킨다.
    const parts = rel.slice(slot.length + 1).split("/");
    let cursor = slot;
    for (const part of parts.slice(0, -1)) {
      cursor = `${cursor}/${part}`;
      if (occupiedByNonDirectory(join(projectDir, cursor))) return cursor;
    }
    const leaf = lstatSync(join(projectDir, rel), { throwIfNoEntry: false });
    if (leaf !== undefined && !leaf.isFile()) return rel;
  }
  return null;
}

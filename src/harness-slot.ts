/**
 * #901 — 설치 기록이 시키는 지우기 · 옮기기 · 되돌리기는 **하네스 자리 안에서만** 따른다.
 *
 * 설치 기록은 커밋되는 파일이라 믿을 수 없는 입력이다. 기록의 경로 글자를 그대로 따르면 남이 커밋한 기록 하나로 `.env` 같은
 * 하네스 자리 밖 설치자 파일을 백업으로 옮기거나(회수) 비어 있는 그 자리에 다른 파일을 놓는다(displaced 되돌리기) — #887 · #894 가
 * 막은 백업 쪽 구멍의 자리 쪽 짝이다. 기록 경로를 받는 동작(displaced 되돌리기 · 기록된 하네스 파일 · 앵커 · 외부 스킬 파일 회수)이
 * 이 술어 하나를 거친다. 밖이면 건드리지 않고 화면이 그 까닭을 말한다.
 *
 * 하네스 자리 = 소유 표(`CLI_OWNERSHIP` — 어느 CLI 가 어느 자리를 쓰는가의 SSOT)의 자리. 이 판과 옛 판이 기록에 적는 경로
 * (`.claude/` · `.codex/` · `.opencode/` · `.agents/skills/` · `.agents/rules/` · `.uzys-agent-harness/` · 루트 앵커 · `AGENTS.md` …)가
 * 전부 그 안이다. 판정은 둘이다.
 *   ① 글자 — 정규화한 경로가 그 자리 안(`../` · `./` · 중복 구분자는 `join` 이 푸는 대로 풀고 본다)
 *   ② 실제 — 경로가 든 폴더를 끝까지 푼 곳이 어느 자리를 끝까지 푼 곳 안. 자리 **안의** 폴더 링크로 자리 밖(`.claude/x → ..`)에
 *      닿는 것을 막는다. 자리 자체나 그 위의 링크(`.codex → shared-codex` · `.agents → dotfiles`)는 설치자가 자리째 옮긴 구성이라
 *      그 실체가 곧 자리다. 말단 파일 링크는 묻지 않는다 — 따라갈지는 호출부의 기존 규칙(#10 · #839)이 정한다.
 * 프로젝트 밖으로 풀리는 자리는 호출부의 밖 판정(`outside-project.ts`)이 먼저 말한다 — 호출부는 그 판정 **뒤에** 이것을 부른다.
 */

import { join, posix } from "node:path";
import { CLI_OWNERSHIP } from "./cli-ownership.js";
import { isOutsideProject, resolveWriteTarget } from "./outside-project.js";

/** 소유 표의 자리 전부 — 파일 하나이거나 `/` 로 끝나는 폴더. */
const HARNESS_SLOTS: ReadonlyArray<string> = [
  ...new Set(
    Object.values(CLI_OWNERSHIP)
      .flat()
      .map((o) => o.path),
  ),
];

/**
 * 기록의 경로(`path` — 프로젝트 상대)가 하네스 자리 안인가. `slots` 를 주면 그 자리만 본다(외부 스킬 자산 = 스킬 폴더).
 * 실체를 풀 수 없으면(권한 등) 글자 판정 그대로다 — 밖 판정과 같은 관행.
 */
export function inHarnessSlot(
  projectDir: string,
  path: string,
  slots: ReadonlyArray<string> = HARNESS_SLOTS,
): boolean {
  const norm = posix.normalize(path);
  const slot = slots.find((s) => (s.endsWith("/") ? norm.startsWith(s) : norm === s));
  if (slot === undefined) return false;
  if (!slot.endsWith("/")) return true; // 루트의 파일 자리 — 든 폴더가 프로젝트 루트다
  const dir = resolveWriteTarget(join(projectDir, posix.dirname(norm)));
  if (dir === null) return true;
  return slots.some(
    (s) => s.endsWith("/") && !isOutsideProject(join(projectDir, s.slice(0, -1)), dir),
  );
}

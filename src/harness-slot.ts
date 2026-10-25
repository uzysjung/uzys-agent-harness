/**
 * #901 — 설치 기록이 시키는 지우기 · 옮기기 · 되돌리기는 **하네스 자리 안에서만** 따른다.
 *
 * 설치 기록은 커밋되는 파일이라 믿을 수 없는 입력이다. 기록의 경로 글자를 그대로 따르면 남이 커밋한 기록 하나로 `.env` 같은
 * 하네스 자리 밖 설치자 파일을 백업으로 옮기거나(회수) 비어 있는 그 자리에 다른 파일을 놓는다(displaced 되돌리기) — #887 · #894 가
 * 막은 백업 쪽 구멍의 자리 쪽 짝이다. 기록 경로를 받는 동작(displaced 되돌리기 · 기록된 하네스 파일 · 앵커 · 외부 스킬 파일 회수)이
 * 이 술어 하나를 거친다. 밖이면 건드리지 않고 화면이 그 까닭을 말한다.
 *
 * 판정(사용자 확정 2026-10-25): 동작 대상의 **글자 경로와 실경로**(프로젝트를 끝까지 푼 곳 기준 상대 경로) **둘 다** 자리 안이어야 한다.
 * 자리 폴더를 링크로 커밋해도(`.opencode → .` · `.agents/rules → ..` · `.opencode → .git` · `.opencode → apps/web`) 실경로가 자리 밖이라
 * 따르지 않는다 — `.git/` 은 어느 자리에도 들지 않는다. 대가: 자리를 프로젝트 안 다른 폴더로 옮겨 링크로 둔 구성(`.codex → shared-codex` ·
 * `.agents → dotfiles/…`)은 기록 회수가 안내로 바뀐다(남는 쪽 — 손실이 아니다). 자리끼리 잇는 링크(#524 `.claude/skills/<id>` →
 * `.agents/skills/<id>`)는 실경로도 자리 안이라 그대로다. 프로젝트 밖으로 풀리는 자리는 호출부의 밖 판정(`outside-project.ts`)이
 * 먼저 말한다 — 호출부는 그 판정 **뒤에** 이것을 부른다.
 *
 * 자리는 동작마다 다르다 — 파일을 **통째로** 옮기거나 지우는 동작은 함께 쓰는 파일(`SHARED_FILES` — 하네스 몫 단위로만 다룬다)을 자리로
 * 보지 않는다.
 */

import { isAbsolute, join, posix, relative, sep } from "node:path";
import { SHARED_FILES } from "./adapters/shared-files.js";
import { CLI_OWNERSHIP, type OwnedPathKind } from "./cli-ownership.js";
import { buildManifest, isCliNeutralTarget } from "./manifest.js";
import { resolveWriteTarget } from "./outside-project.js";

/** 자리 한 벌 — 파일 하나이거나 `/` 로 끝나는 폴더(`places`), 그중 자리가 아닌 파일(`except`). */
export interface SlotSet {
  places: ReadonlyArray<string>;
  except?: ReadonlySet<string>;
}

const ownedOf = (...kinds: OwnedPathKind[]): string[] => [
  ...new Set(
    Object.values(CLI_OWNERSHIP)
      .flat()
      .filter((o) => kinds.includes(o.kind))
      .map((o) => o.path),
  ),
];

/**
 * 하네스 파일 자리 — displaced 되돌리기 · 기록된 하네스 파일 회수. 소유 표의 `recorded` · `anchor` 자리 + CLI 중립 헬퍼(manifest —
 * 설치 기록 폴더의 나머지는 기록 · 런타임 파일이다). 함께 쓰는 파일은 뺀다.
 */
export const HARNESS_FILES: SlotSet = {
  places: [
    ...ownedOf("recorded", "anchor"),
    ...buildManifest({ tracks: [] })
      .map((e) => e.target)
      .filter(isCliNeutralTarget),
  ],
  except: new Set(Object.keys(SHARED_FILES)),
};

/**
 * 앵커 자리 — 기록 `templates.rootClaudeMd` 의 회수. 앵커 + 루트 `CLAUDE.md`(ADR-060 이전 판이 그 이름을 앵커로 적었다 — 회수 쪽이
 * 고친 것은 남기고 안 고친 것만 지운다, `removeAnchor`).
 */
export const ANCHOR_FILES: SlotSet = { places: ownedOf("anchor", "import-block") };

/** 외부 스킬 자산의 자리 — 그 자산이 파일을 놓는 스킬 폴더. */
export function skillFolders(roots: ReadonlyArray<string>): SlotSet {
  return { places: roots.map((r) => `${r}/`) };
}

function within(rel: string, slots: SlotSet): boolean {
  if (slots.except?.has(rel) === true) return false;
  return slots.places.some((p) => (p.endsWith("/") ? rel.startsWith(p) : rel === p));
}

/**
 * 동작 대상의 실경로 — 프로젝트를 끝까지 푼 곳 기준 상대(`/`). `follow` = 말단 링크도 따라간다(지우기 · 백업 · 읽기가 그 대상에
 * 닿는다). 아니면 든 폴더만 푼다(되돌리기의 rename 은 말단 자리를 바꾼다). 풀 수 없거나 프로젝트 밖이면 null.
 */
function realRel(projectDir: string, norm: string, follow: boolean): string | null {
  const target = follow
    ? resolveWriteTarget(join(projectDir, norm))
    : (() => {
        const dir = resolveWriteTarget(join(projectDir, posix.dirname(norm)));
        return dir === null ? null : join(dir, posix.basename(norm));
      })();
  if (target === null) return null;
  const rel = relative(resolveWriteTarget(projectDir) ?? projectDir, target);
  if (rel === "" || isAbsolute(rel)) return null;
  const slash = rel.split(sep).join("/");
  return slash === ".." || slash.startsWith("../") ? null : slash;
}

/** 기록의 경로(`path` — 프로젝트 상대)가 글자 · 실경로 둘 다 `slots` 안인가. 실경로를 풀 수 없으면 아니다. */
export function inHarnessSlot(
  projectDir: string,
  path: string,
  slots: SlotSet = HARNESS_FILES,
  opts: { follow?: boolean } = {},
): boolean {
  const norm = posix.normalize(path);
  if (!within(norm, slots)) return false;
  const real = realRel(projectDir, norm, opts.follow === true);
  return real !== null && within(real, slots);
}

/**
 * 링크를 따라간 실체가 **프로젝트 밖**인가 — install · update · uninstall 이 같은 판정을 쓴다 (#678 · #668).
 *
 * 설치자가 하네스 폴더나 그 안 파일을 프로젝트 밖(dotfiles 등)으로 링크해 두면, 링크를 따라 쓰는 순간
 * 하네스가 **이 프로젝트 기록에 없는 파일**을 바꾼다 — 두 프로젝트가 그 폴더를 같이 쓰면 한쪽의 실행이 다른
 * 쪽을 바꾼다. 세 동작 모두 그 실체는 건드리지 않고 "남김 + 경로"를 말한다(루트 CLAUDE.md §설치자 디스크는
 * 한 원칙으로). 프로젝트 **안**을 가리키는 링크는 따라가 쓴다(같은 프로젝트의 공유 자리).
 */

import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/** 프로젝트 밖이라 건드리지 않은 자리 하나. */
export interface OutsideLink {
  /** project-relative(슬래시) — 쓰려던 경로. */
  path: string;
  /** 그 경로가 실제로 가리키는 절대경로. */
  target: string;
  /** project-relative — 프로젝트 밖으로 나가는 링크가 걸린 자리(파일 링크면 `path` 자신, 폴더 링크면 그 폴더). */
  link: string;
  /** `link` 가 가리키는 절대경로. */
  linkTarget: string;
}

/** 링크를 따라간 실체가 프로젝트 루트 밖인가 — realpath 기준(프로젝트 경로 자체가 링크여도 같은 잣대). */
export function isOutsideProject(projectDir: string, target: string): boolean {
  // 루트도 대상과 같은 방식으로 푼다 — 아직 없는 프로젝트 경로(`/tmp/x` → `/private/tmp/x`)에서 대상만 풀리면 전부 "밖" 으로 읽힌다.
  // 못 풀면 원 경로로 비교한다.
  const root = resolveWriteTarget(projectDir) ?? projectDir;
  const rel = relative(root, target);
  return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

/**
 * 이 경로에 쓰면 실제로 어디가 바뀌는가 — 아직 없는 파일이면 가장 가까운 있는 조상을 풀고 나머지를 붙인다
 * (밖 폴더 링크 안에 **새로** 만드는 것도 밖에 쓰는 것이다). 깨진 링크는 링크 문자열을 따라간다 — 쓰기는
 * 깨진 링크의 대상을 만든다. 풀 수 없으면(권한 등) null = 모른다.
 */
function resolveWriteTarget(abs: string): string | null {
  const tail: string[] = [];
  const hops = new Set<string>();
  let path = abs;
  for (;;) {
    try {
      return join(realpathSync(path), ...tail);
    } catch {
      /* 없거나 깨진 링크 — 아래에서 가른다 */
    }
    let isLink = false;
    try {
      const st = lstatSync(path, { throwIfNoEntry: false });
      if (st !== undefined && !st.isSymbolicLink()) return null; // 있는데 못 푼다 — 모른다
      isLink = st !== undefined;
    } catch {
      return null;
    }
    if (isLink) {
      if (hops.has(path)) return null; // 링크 고리
      hops.add(path);
      path = resolve(dirname(path), readlinkSync(path));
      continue;
    }
    const parent = dirname(path);
    if (parent === path) return null;
    tail.unshift(basename(path));
    path = parent;
  }
}

/**
 * `abs` 에 쓰면 프로젝트 밖이 바뀌는가 — 바뀌면 그 자리(`OutsideLink`), 아니면 null.
 * 판정할 수 없으면 null 이다(지금까지의 동작 그대로 — 이 판정은 밖을 알아볼 때만 멈춘다).
 */
export function outsideProjectTarget(projectDir: string, abs: string): OutsideLink | null {
  const target = resolveWriteTarget(abs);
  if (target === null || !isOutsideProject(projectDir, target)) return null;
  const rel = relative(projectDir, abs);
  const parts = rel.split(sep);
  // 밖으로 나가는 링크가 걸린 가장 얕은 자리 — 화면이 폴더 링크를 파일마다가 아니라 한 줄로 말한다.
  let link = rel;
  let linkTarget = target;
  for (let i = 1; i <= parts.length; i++) {
    const prefix = join(projectDir, ...parts.slice(0, i));
    const st = lstatSync(prefix, { throwIfNoEntry: false });
    if (st?.isSymbolicLink() !== true) continue;
    const resolved = resolveWriteTarget(prefix);
    if (resolved === null || !isOutsideProject(projectDir, resolved)) continue;
    link = parts.slice(0, i).join(sep);
    linkTarget = resolved;
    break;
  }
  const slash = (p: string): string => p.split(sep).join("/");
  return { path: slash(rel), target, link: slash(link), linkTarget };
}

/** 한 실행이 밖이라 건너뛴 자리를 모은다 — 쓰기 직전에 `skip(abs)` 를 부르고, true 면 쓰지 않는다. */
export interface OutsideGuard {
  skip(abs: string): boolean;
  list(): OutsideLink[];
}

export function createOutsideGuard(projectDir: string): OutsideGuard {
  const seen = new Map<string, OutsideLink>();
  return {
    skip(abs) {
      const hit = outsideProjectTarget(projectDir, abs);
      if (hit === null) return false;
      if (!seen.has(hit.path)) seen.set(hit.path, hit);
      return true;
    },
    list: () => [...seen.values()],
  };
}

/** 여러 출처의 목록을 경로당 하나로 합친다. */
export function mergeOutside(...lists: ReadonlyArray<ReadonlyArray<OutsideLink>>): OutsideLink[] {
  const out = new Map<string, OutsideLink>();
  for (const list of lists) for (const o of list) if (!out.has(o.path)) out.set(o.path, o);
  return [...out.values()];
}

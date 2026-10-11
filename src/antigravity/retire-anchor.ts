/**
 * 옛 Antigravity 앵커 `.agents/rules/uzys-harness.md` 은퇴 — 한 번 (ADR-103 · #645 · #631).
 *
 * v26.164.0 까지 Antigravity 는 원칙·프로젝트 맥락을 이 파일 하나로 받았다. 그런데 이 파일에는 frontmatter 가 없어
 * Antigravity 가 조용히 버렸고(#631), 통째로 하네스 파일이라 설치자가 채운 FILL 을 update 가 빈 스캐폴드로 되돌렸다
 * (#645). Antigravity 는 루트 `AGENTS.md` 를 frontmatter 없이 always_on 으로 읽으므로(공식 문서) 그 자리로 옮기고
 * 이 파일은 은퇴한다. 설치자가 채운 글은 그 실행의 `AGENTS.md` 쓰기가 한 번 옮겨 심는다.
 *
 * 두 토막이다(v26.165.0 독립 검증 BLOCKER-3):
 *   - **읽기 · 변환 전** `readLegacyAntigravityContext` — `AGENTS.md` 렌더가 씨로 받는다. 쓰기는 owned-write 한 번이라
 *     기록 sha = 최종 바이트다(변환 뒤에 절을 고쳐 쓰면 다음 update 가 `AGENTS.md.backup-*` 를 만든다).
 *   - **지우기 · 변환 후** `retireAntigravityAnchor` — `judge` 의 harness remove 규칙 그대로(`out-of-track.ts` 와 같은
 *     판정): 기록 sha 그대로면 지우고, 다르면 그 파일 하나를 백업하고 지우고, 이미 없으면 기록만 뺀다.
 *
 * 대상은 **기록(`externalFiles`)에 앵커가 있을 때만**이다 — 디스크에만 있으면 설치자 파일이라 건드리지 않는다(ADR-096).
 * 기록에서 빼는 것과 `spec.clis` 를 적는 것(BLOCKER-1 — 옛 로그의 antigravity 유도 근거가 이 경로다)은 호출부가
 * 같은 기록 쓰기에서 한다.
 */

import { lstatSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_ANTIGRAVITY_ANCHOR } from "../agents-md-transform.js";
import { compose } from "../anchor-seed.js";
import { backupFile } from "../fs-ops.js";
import type { InstallLogSkillFile } from "../install-log.js";
import { judge } from "../judge.js";
import type { OutsideGuard } from "../outside-project.js";
import {
  dropContinuousSkillsNote,
  dropHarnessQuoteBlocks,
  isUnfilledScaffold,
  renderFillScaffold,
} from "../project-claude-merge.js";

/**
 * 옛 앵커 템플릿의 최상위 절 — 은퇴 전용 닫힌 상수(`templates/antigravity/AGENTS.md.template` 은 지워졌다).
 * `## Project Context` 본문은 다음 알려진 헤딩까지다. 스캐폴드 안의 `## Identity & Purpose` 같은 하위 절에서 끊지 않는다.
 */
const LEGACY_ANTIGRAVITY_ANCHOR_SECTIONS = ["Project Context", "Project Rules", "Protected Files"];

/** 기록에 있는 앵커 항목 — 없으면 `null`(은퇴할 것이 없다). */
function anchorRecord(previous: ReadonlyArray<InstallLogSkillFile>): InstallLogSkillFile | null {
  return previous.find((f) => f.path === LEGACY_ANTIGRAVITY_ANCHOR) ?? null;
}

/** 링크·디렉터리가 아닌 실제 파일이면 내용, 아니면 `null`(링크는 설치자 것이다 — 따라가 읽지도 않는다). */
function readRegular(abs: string): string | null {
  const stat = lstatSync(abs, { throwIfNoEntry: false });
  if (stat === undefined || !stat.isFile()) return null;
  try {
    return readFileSync(abs, "utf8");
  } catch {
    return null;
  }
}

/** 옛 앵커의 `## Project Context` 본문 줄. 절이 없으면 `null`. */
function legacyContextLines(text: string): string[] | null {
  const lines = text.split("\n");
  const heading = (l: string): string | null => {
    const name = /^## (.+?)\s*$/.exec(l.replace(/\r$/, ""))?.[1];
    return name !== undefined && LEGACY_ANTIGRAVITY_ANCHOR_SECTIONS.includes(name) ? name : null;
  };
  const start = lines.findIndex((l) => heading(l) === "Project Context");
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => heading(l) !== null);
  return end === -1 ? rest : rest.slice(0, end);
}

/**
 * 읽기 토막 — 옛 앵커에 설치자가 채운 Project Context(목적지 배너를 붙인 씨). 안 채웠거나 · 기록에 없거나 · 파일이
 * 아니면 `null`. 하네스가 쓴 줄(배너 · FILL 주석 · 마커 없는 상시 스킬 안내)은 판정 전에 뗀다(BLOCKER-2) — 안 떼면
 * 안 채운 앵커의 옛 스캐폴드가 "설치자 글" 로 옮겨 가 안내가 두 벌이 된다. 옮기는 본문에서도 상시 스킬 안내는 뺀다
 * (목적지가 자기 마커 블록으로 붙인다). FILL 주석은 남은 절의 채우기 안내라 그대로 둔다.
 */
export function readLegacyAntigravityContext(
  projectDir: string,
  previous: ReadonlyArray<InstallLogSkillFile>,
): string | null {
  if (anchorRecord(previous) === null) return null;
  const text = readRegular(join(projectDir, LEGACY_ANTIGRAVITY_ANCHOR));
  if (text === null) return null;
  const lines = legacyContextLines(text);
  if (lines === null) return null;
  const body = dropContinuousSkillsNote(dropHarnessQuoteBlocks(lines));
  if (isUnfilledScaffold(body)) return null;
  return compose(currentFillPrompts(body), "agents-md");
}

/**
 * 리뷰 #735 — 부분만 채운 앵커를 옮길 때 남은 절의 `<!-- FILL:<id> — … -->` 안내는 **지금 판 문구**로 바꾼다. 옛 판 문구
 * (`.claude/rules/*.md … (or this CLI's equivalent)` — #631 둘째 축)가 따라오면 Antigravity 단독 설치에 없는 경로를 보라고 한다.
 * 한 줄짜리 FILL 주석만 바꾼다(하네스가 쓴 형태) — 설치자가 고친 여러 줄 주석은 그대로 둔다.
 */
function currentFillPrompts(body: ReadonlyArray<string>): string[] {
  const fillId = (l: string): string | null =>
    /^<!-- FILL:([a-z-]+) — .*-->$/.exec(l.trim())?.[1] ?? null;
  const current = new Map<string, string>();
  for (const l of renderFillScaffold("agents-md").split("\n")) {
    const id = fillId(l);
    if (id !== null) current.set(id, l);
  }
  return body.map((l) => {
    const id = fillId(l);
    return id === null ? l : (current.get(id) ?? l);
  });
}

export interface AnchorRetireResult {
  /** 은퇴한 경로(프로젝트 상대) — 늘 `LEGACY_ANTIGRAVITY_ANCHOR`. */
  path: string;
  /** 지웠다(`removed`) · 손대지 않았다(`left` — 링크 · 프로젝트 밖) · 이미 없었다(`gone`). */
  action: "removed" | "left" | "gone";
  /** 지우기 전에 남긴 사본(절대경로). */
  backup: string | null;
  /** 기록(`externalFiles`)에서 뺄 것인가 — 지웠거나 이미 없었으면 뺀다. 남겼으면 기록도 남긴다. */
  forget: boolean;
  /** 화면 한 줄(경로 뒤) — 실제로 한 일만. 이미 없었으면 빈 문자열(말할 것이 없다). */
  line: string;
}

/**
 * 지우기 토막. `hadContent` = 읽기 토막이 씨를 냈는가 · `moved` = 그 씨가 `AGENTS.md` 에 들어갔는가
 * (`AgentsMdTransformReport.agentsMdSeededFrom`).
 *
 * 채운 글이 옮겨지지 않았으면(`AGENTS.md` 가 이미 자기 맥락을 가졌다 — 두 문장을 합치지 않는다, ADR-096 D7) 기록 sha 와
 * 같더라도 백업을 남긴다 — 라이브에서 사라지는 설치자 글의 유일한 사본이다.
 */
export function retireAntigravityAnchor(args: {
  projectDir: string;
  previous: ReadonlyArray<InstallLogSkillFile>;
  outside: OutsideGuard;
  hadContent: boolean;
  moved: boolean;
  now?: Date;
}): AnchorRetireResult | null {
  const rec = anchorRecord(args.previous);
  if (rec === null) return null;
  const path = LEGACY_ANTIGRAVITY_ANCHOR;
  const abs = join(args.projectDir, path);
  const left = (why: string): AnchorRetireResult => ({
    path,
    action: "left",
    backup: null,
    forget: false,
    line: `left — ${why}; Antigravity reads AGENTS.md now, so this file can go`,
  });
  // ADR-098 — 링크를 따라가면 프로젝트 밖이면 지우지도 백업하지도 않는다
  if (args.outside.skip(abs)) return left("it points outside this project");
  const stat = lstatSync(abs, { throwIfNoEntry: false });
  if (stat !== undefined && !stat.isFile()) return left("it is a link or folder, so it is yours");
  const disk = stat === undefined ? null : readFileSync(abs, "utf8");
  const verdict = judge({
    op: "remove",
    kind: "harness",
    rec: { state: "sha", sha256: rec.sha256 },
    disk,
    next: null,
  });
  if (disk === null) {
    return { path, action: "gone", backup: null, forget: true, line: "" };
  }
  const keepCopy =
    verdict.verdict === "backup+remove" ||
    (args.hadContent && !args.moved && verdict.verdict === "remove");
  if (verdict.verdict !== "remove" && verdict.verdict !== "backup+remove") {
    return left("could not judge it");
  }
  const backup = keepCopy ? backupFile(abs, args.now) : null;
  rmSync(abs);
  const saved = backup === null ? "" : relativeBackup(args.projectDir, backup);
  const line = args.moved
    ? `retired — Antigravity reads AGENTS.md; your Project Context moved there${saved ? ` · previous file saved as ${saved}` : ""}`
    : args.hadContent
      ? `retired — AGENTS.md already has its own Project Context, so nothing was merged; your filled text is in ${saved}`
      : `retired — Antigravity reads AGENTS.md${saved ? ` · previous file saved as ${saved}` : ""}`;
  return { path, action: "removed", backup, forget: true, line };
}

function relativeBackup(projectDir: string, backup: string): string {
  return backup.startsWith(`${projectDir}/`) ? backup.slice(projectDir.length + 1) : backup;
}

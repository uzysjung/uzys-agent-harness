/**
 * 앵커 씨 뿌리기 — CLI 를 더해 **새 앵커 파일을 만들 때** 다른 앵커의 설치자 절을 옮겨 심는다
 * (#528 · Epic #527 정의 6).
 *
 * 설치자는 프로젝트 맥락을 한 번 적었다. 그런데 나중에 CLI 를 하나 더 고르면 그 CLI 의 앵커는
 * **빈 스캐폴드**로 태어난다 — 루트 `CLAUDE.md` 에 적어 둔 빌드 명령·디렉터리 구조를 새로 생긴
 * `AGENTS.md` 는 모른다. 그 뒤로는 `update` 가 두 파일의 설치자 절을 각각 보존하므로(#503),
 * **태어나는 순간 한 번만** 옮기면 된다.
 *
 * 옮기는 것은 결정론적 복사뿐이다 — 문장을 고치거나 요약하지 않는다. 두 파일의 CLI 고유 표현
 * (경로 이름·도구 이름)을 맞추는 것은 `audit-harness-fit` 스킬의 몫이고, 화면이 그렇게 안내한다.
 *
 * **배너는 옮기지 않는다.** 스캐폴드 배너의 셋째 줄은 "원칙이 어디 사는가"를 말하는데 그 답이
 * 파일마다 다르다(#305 — `CLAUDE.md` 는 앵커를 import 하고 `AGENTS.md` 는 자기가 앵커다).
 * 그대로 복사하면 새 파일이 없는 파일을 가리킨다. 그래서 **목적지가 자기 배너를 붙이고**,
 * 옮기는 것은 그 아래 본문이다.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { projectContextInstallerLines } from "./agents-md-merge.js";
import {
  renderFillScaffold,
  type ScaffoldSurface,
  scaffoldBanner,
  stripHarnessImport,
} from "./project-claude-merge.js";

/** 스캐폴드 배너를 알아보는 표식. 배너 문구가 바뀌어도 이 문장은 배너의 정체다. */
const SCAFFOLD_MARK = "SCAFFOLD — not filled in yet";
/** 루트 `CLAUDE.md` 머리의 설치 메타 한 줄 (`mergeProjectClaude`). */
const TRACK_NOTE_MARK = "Active track(s):";

function readIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/**
 * **하네스가 쓴 인용문 블록만** 뗀다 — 스캐폴드 배너와 트랙 안내.
 *
 * 인용문 run 을 통째로 보고 그 안에 하네스 표식이 있을 때만 뗀다. 설치자가 적어 둔 인용문
 * (프로젝트 한 줄 소개 같은 것)은 표식이 없으니 그대로 남는다.
 *
 * **앞머리만 보지 않고 전체를 훑는 이유**: 설치자가 H1 바로 뒤에 자기 인용문을 끼우면 하네스
 * 앞머리가 그 아래로 밀린다. "앞의 run 만" 보면 거기서 멈춰 배너가 딸려 가고, 그 배너는 목적지
 * 파일에서 **없는 파일을 가리킨다**(#305). 표식으로 고르면 위치에 기대지 않는다.
 */
function dropHarnessQuoteBlocks(lines: ReadonlyArray<string>): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!(lines[i] ?? "").trim().startsWith(">")) {
      out.push(lines[i] ?? "");
      i += 1;
      continue;
    }
    let end = i;
    while (end < lines.length && (lines[end] ?? "").trim().startsWith(">")) end++;
    const run = lines.slice(i, end);
    const text = run.join("\n");
    if (!text.includes(SCAFFOLD_MARK) && !text.includes(TRACK_NOTE_MARK)) out.push(...run);
    i = end;
  }
  return out;
}

/** 맨 앞 H1 한 줄을 뗀다 — 제목은 목적지 파일이 자기 것을 갖는다. */
function dropTitle(lines: ReadonlyArray<string>): string[] {
  const out = [...lines];
  while (out.length > 0 && (out[0] ?? "").trim() === "") out.shift();
  if (out.length > 0 && /^#\s/.test(out[0] ?? "")) out.shift();
  return out;
}

/** 비교·판정용 정규화 — 빈 줄과 줄 끝 공백은 "내용"이 아니다. */
function compact(lines: ReadonlyArray<string>): string[] {
  return lines.map((l) => l.replace(/\r$/, "").trimEnd()).filter((l) => l.trim() !== "");
}

/** 손대지 않은 스캐폴드인가 — 그렇다면 옮길 내용이 없다(빈 껍데기를 옮기는 것은 소음이다). */
function isPristineScaffold(body: ReadonlyArray<string>, surface: ScaffoldSurface): boolean {
  const pristine = compact(dropHarnessQuoteBlocks(renderFillScaffold(surface).split("\n")));
  return compact(body).join("\n") === pristine.join("\n");
}

/** 목적지 배너 + 옮겨 온 본문. 옮길 것이 없으면 `null`. */
function compose(body: ReadonlyArray<string>, into: ScaffoldSurface): string | null {
  const trimmed = [...body];
  while (trimmed.length > 0 && (trimmed.at(-1) ?? "").trim() === "") trimmed.pop();
  while (trimmed.length > 0 && (trimmed[0] ?? "").trim() === "") trimmed.shift();
  if (trimmed.length === 0) return null;
  return `${scaffoldBanner(into)}\n\n${trimmed.join("\n")}`;
}

/**
 * 새 `AGENTS.md` 의 `## Project Context` 에 넣을 본문 — 루트 `CLAUDE.md` 의 설치자 본문에서.
 *
 * import 블록(하네스 소유)과 H1·배너·트랙 안내를 뺀 나머지다. 루트 `CLAUDE.md` 가 없거나
 * 손대지 않은 스캐폴드면 `null` = 평소대로 빈 스캐폴드로 만든다.
 */
export function seedAgentsMdProjectContext(projectDir: string): string | null {
  const root = readIfExists(join(projectDir, "CLAUDE.md"));
  if (root === null) return null;
  const withoutImport = stripHarnessImport(root) ?? root;
  const body = dropHarnessQuoteBlocks(dropTitle(withoutImport.split("\n")));
  if (isPristineScaffold(body, "claude")) return null;
  return compose(body, "agents-md");
}

/**
 * 새 루트 `CLAUDE.md` 의 프로젝트 맥락에 넣을 본문 — `AGENTS.md` 의 `## Project Context` 에서.
 *
 * 절 경계는 렌더 때와 같이 템플릿의 최상위 절 이름으로 판정한다(ADR-095 D3). 두 CLI 판 템플릿은
 * 설치자 소유 절 이름이 같으므로 어느 쪽을 읽어도 경계가 같다 — `uninstall` 의
 * `readAgentsMdTemplate` 주석과 같은 근거다. 템플릿을 못 읽으면 `null`(경계를 모르면 옮기지 않는다).
 */
export function seedRootClaudeProjectContext(
  projectDir: string,
  harnessRoot: string,
): string | null {
  const agents = readIfExists(join(projectDir, "AGENTS.md"));
  if (agents === null) return null;
  const template =
    readIfExists(join(harnessRoot, "templates/codex/AGENTS.md.template")) ??
    readIfExists(join(harnessRoot, "templates/opencode/AGENTS.md.template"));
  if (template === null) return null;
  const installer = projectContextInstallerLines({ existing: agents, template });
  if (installer === null) return null;
  const body = dropHarnessQuoteBlocks(installer);
  if (isPristineScaffold(body, "agents-md")) return null;
  return compose(body, "claude");
}

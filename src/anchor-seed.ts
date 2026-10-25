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
import { AGENTS_MD_TEMPLATE } from "./agents-md-render.js";
import {
  dropContinuousSkillsNote,
  dropHarnessQuoteBlocks,
  isUnfilledScaffold,
  type ScaffoldSurface,
  scaffoldBanner,
  stripHarnessImport,
} from "./project-claude-merge.js";

function readIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** 맨 앞 H1 한 줄을 뗀다 — 제목은 목적지 파일이 자기 것을 갖는다. */
function dropTitle(lines: ReadonlyArray<string>): string[] {
  const out = [...lines];
  while (out.length > 0 && (out[0] ?? "").trim() === "") out.shift();
  if (out.length > 0 && /^#\s/.test(out[0] ?? "")) out.shift();
  return out;
}

/** 목적지 배너 + 옮겨 온 본문. 옮길 것이 없으면 `null`. */
export function compose(body: ReadonlyArray<string>, into: ScaffoldSurface): string | null {
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
  // 손대지 않은 스캐폴드면 옮길 내용이 없다(빈 껍데기를 옮기는 것은 소음이다) — 판정은 `isUnfilledScaffold` 하나
  if (isUnfilledScaffold(body)) return null;
  return compose(body, "agents-md");
}

/**
 * 새 루트 `CLAUDE.md` 의 프로젝트 맥락에 넣을 본문 — `AGENTS.md` 의 `## Project Context` 에서.
 *
 * 절 경계는 렌더 때와 같이 템플릿의 최상위 절 이름으로 판정한다(ADR-095 D3) — 템플릿은 하나다(#642).
 * 템플릿을 못 읽으면 `null`(경계를 모르면 옮기지 않는다).
 */
export function seedRootClaudeProjectContext(
  projectDir: string,
  harnessRoot: string,
): string | null {
  const agents = readIfExists(join(projectDir, "AGENTS.md"));
  if (agents === null) return null;
  const template = readIfExists(join(harnessRoot, AGENTS_MD_TEMPLATE));
  if (template === null) return null;
  const installer = projectContextInstallerLines({ existing: agents, template });
  if (installer === null) return null;
  // #880 — 마커 없는 옛 판(pre-#503)의 상시 스킬 안내 조각도 하네스 것이다. 옮기면 새 파일의 import 블록이 같은 안내를 한 번 더
  // 써서 두 벌이 되고, 설치자 몫으로 옮긴 사본은 update · uninstall 이 못 고친다(판정 `isUnfilledScaffold` 도 이 조각을 뗀다)
  const body = dropContinuousSkillsNote(dropHarnessQuoteBlocks(installer));
  if (isUnfilledScaffold(body)) return null;
  return compose(body, "claude");
}

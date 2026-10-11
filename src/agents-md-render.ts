/**
 * `AGENTS.md` 렌더 — 템플릿 하나(`templates/AGENTS.md.template`)를 **깔린 비-Claude CLI 집합**으로 렌더한다
 * (#642 · ADR-103).
 *
 * 전에는 codex · opencode 가 각자 템플릿을 갖고 같은 파일을 썼다. 한 실행에서 쓰는 쪽은 하나였으므로(#550) 나중에
 * 더한 CLI 의 판이 이겼다 — codex 설치본에 opencode 를 더하면 제목이 `OpenCode Agent Guide` 가 되고 Codex 몫
 * (`## Session Start` · 32 KiB 안내)이 조용히 빠졌다. 어느 한 판이 이기는 구조 자체가 문제라 판을 집합에서 만든다.
 *
 * 집합이 정하는 것 — 나머지는 집합과 무관하게 같다:
 *   - 제목의 CLI 이름(`{CLI_NAMES}`)
 *   - `## Harness Rules`(룰 인라인) — Codex · OpenCode 는 룰 디렉터리가 없어 본문으로 받는다. Antigravity 는
 *     `.agents/rules/` 로 받으므로 Antigravity 만이면 절째 없다
 *   - `## Session Start` — Codex 만의 문장(SessionStart 훅이 없는 CLI 의 SPEC 안내는 Codex 에서 왔다)
 *   - `## Protected Files` 의 첫 줄 — 그 CLI 의 1차 방어
 *
 * 빈 절은 헤딩째 뺀다(알려진 절 이름에만 — 템플릿의 `## ` 줄). 그래서 병합·걷기(`agents-md-merge.ts`)에는
 * 템플릿 **전체**를 넘긴다 — 절 이름의 합집합이 경계의 SSOT 다.
 */

import { ANCHOR_BLOCK, wrapHarnessBlock } from "./agents-md-merge.js";
import { CLI_BASE_SORT_ORDER, CLI_DISPLAY_NAMES } from "./cli-targets.js";

/** `AGENTS.md` 의 템플릿 — 하네스 루트 상대. CLI 판마다 따로 두지 않는다(#642 · ADR-103). */
export const AGENTS_MD_TEMPLATE = "templates/AGENTS.md.template";

/** `AGENTS.md` 를 읽는 CLI — Claude Code 는 자기 앵커(루트 `CLAUDE.md`)를 읽는다. */
export const AGENTS_MD_CLIS = ["codex", "opencode", "antigravity"] as const;
export type AgentsMdCli = (typeof AGENTS_MD_CLIS)[number];

export function isAgentsMdCli(cli: string): cli is AgentsMdCli {
  return (AGENTS_MD_CLIS as readonly string[]).includes(cli);
}

/** 집합 정규화 — 중복 제거 · `CLI_BASE_SORT_ORDER` 정렬. 제목·기록 diff 가 순서로 흔들리지 않게. */
export function agentsMdClis(clis: ReadonlyArray<string>): AgentsMdCli[] {
  return [...new Set(clis.filter(isAgentsMdCli))].sort(
    (a, b) => CLI_BASE_SORT_ORDER[a] - CLI_BASE_SORT_ORDER[b],
  );
}

/** Rename Claude slash conventions (`/uzys:foo`) to the non-Claude form (`/uzys-foo`) — no slash namespace there. */
export function renameSlashes(text: string): string {
  return text.replaceAll("/uzys:", "/uzys-");
}

export interface AgentsMdParams {
  template: string;
  claudeMd: string;
  projectName: string;
  /** Project-context fill scaffold — the same body shipped to the Claude Code CLAUDE.md. */
  projectContext: string;
  /** 배포 룰 본문(이어 붙인 한 덩어리) — Codex · OpenCode 가 집합에 있을 때만 들어간다. */
  harnessRules: string;
  /** 이 파일을 읽는 깔린 CLI 집합. 비면 호출부 버그다(claude 단독은 이 파일을 쓰지 않는다). */
  clis: ReadonlyArray<AgentsMdCli>;
}

const RULES_NOTE = [
  "> 하네스가 설치한 룰이 여기 본문으로 들어온다. 이 프로젝트에서만 지킬 규칙을 세우면 이 문서에",
  "> 이어 쓰거나, 하위 디렉터리에 `AGENTS.md` 를 두면 그 범위에서 더 구체적인 규칙이 된다.",
].join("\n");

const CODEX_SIZE_NOTE = [
  ">",
  "> Codex 는 **합친 크기**가 `project_doc_max_bytes`(기본 32 KiB)에 닿으면 **거기서 읽기를 멈춘다** — 뒤에 오는",
  "> 파일이 조용히 빠지고, 하위 파일이 뒤에 온다. 나눠 쓰기 전에 총량을 먼저 본다.",
].join("\n");

const CODEX_SESSION_START =
  "`docs/SPEC.md` 가 있으면 세션 시작 때 먼저 읽는다 — 현재 범위와 완료 기준의 앵커다. 없으면 이 줄은 해당 없다.";

/** CLI 마다 그 CLI 의 1차 방어 한 줄 — 없는 CLI 는 줄이 없다. */
const PROTECTED_LEAD: Partial<Record<AgentsMdCli, string>> = {
  codex:
    'Codex `sandbox_mode = "workspace-write"` + `approval_policy = "on-request"` 가 1차 방어다.',
  opencode: "OpenCode `permission` 설정이 1차 방어다.",
};

/**
 * 값이 빈 자리표시자의 줄(+ 뒤따르는 빈 줄 하나)을 템플릿에서 뺀 뒤, 본문이 공백뿐인 알려진 절을 헤딩째 뺀다.
 * 템플릿에만 작용한다 — 치환할 큰 본문(앵커 · 설치자 맥락)의 줄 구조를 건드리지 않는다.
 */
function pruneTemplate(template: string, empty: ReadonlySet<string>): string {
  const lines = template.split("\n");
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (empty.has(line.trim())) {
      if ((lines[i + 1] ?? "").trim() === "") i++;
      continue;
    }
    kept.push(line);
  }
  const names = new Set([...template.matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? "").trim()));
  const isKnownHeading = (l: string): boolean => {
    const name = /^## (.+?)\s*$/.exec(l)?.[1];
    return name !== undefined && names.has(name);
  };
  const out: string[] = [];
  for (let i = 0; i < kept.length; i++) {
    const line = kept[i] ?? "";
    if (isKnownHeading(line)) {
      let j = i + 1;
      while (j < kept.length && !isKnownHeading(kept[j] ?? "")) j++;
      if (kept.slice(i + 1, j).every((l) => l.trim() === "")) {
        i = j - 1;
        continue;
      }
    }
    out.push(line);
  }
  return out.join("\n");
}

/**
 * Render AGENTS.md for the installed set.
 *
 * Placeholders:
 *   - {PROJECT_NAME} · {CLI_NAMES} — basename of project dir · display names of the set
 *   - {PROJECT_CONTEXT} — project-specific fill scaffold (installer-owned section)
 *   - {PROJECT_RULES} — full CLAUDE.md body (first h1 stripped), wrapped in the anchor marker (#503)
 *   - {HARNESS_RULES_NOTE} · {HARNESS_RULES} · {SESSION_START} · {PROTECTED_FILES_LEAD} — set-dependent, see header
 *
 * 마지막에 `/uzys:` → `/uzys-` rename.
 */
export function renderAgentsMd(params: AgentsMdParams): string {
  const clis = agentsMdClis(params.clis);
  if (clis.length === 0) throw new Error("renderAgentsMd: empty CLI set");
  const inlineRules = clis.includes("codex") || clis.includes("opencode");
  const leads = clis.flatMap((c) => PROTECTED_LEAD[c] ?? []);
  const values: Record<string, string> = {
    "{HARNESS_RULES_NOTE}": inlineRules
      ? clis.includes("codex")
        ? `${RULES_NOTE}\n${CODEX_SIZE_NOTE}`
        : RULES_NOTE
      : "",
    "{HARNESS_RULES}": inlineRules ? params.harnessRules : "",
    "{SESSION_START}": clis.includes("codex") ? CODEX_SESSION_START : "",
    "{PROTECTED_FILES_LEAD}": leads.length === 0 ? "" : `${leads.join("\n")} 그 위에:`,
  };
  const empty = new Set(Object.keys(values).filter((k) => (values[k] ?? "").trim() === ""));
  // #503 — 앵커 본문은 마커로 감싼다. `## Project Rules` 절은 설치자도 덧쓰는 자리라, 감싸 두어야 재렌더가
  // **이 조각만** 갈아 끼우고 설치자가 쓴 줄을 남긴다.
  const body = wrapHarnessBlock(ANCHOR_BLOCK, params.claudeMd.replace(/^#\s+.*\r?\n/, "").trim());
  let out = pruneTemplate(params.template, empty)
    .replaceAll("{PROJECT_NAME}", params.projectName)
    .replaceAll("{CLI_NAMES}", clis.map((c) => CLI_DISPLAY_NAMES[c]).join(" · "));
  for (const [k, v] of Object.entries(values)) out = out.replaceAll(k, v);
  // 큰 본문은 마지막에 — 앞의 치환이 설치자 글 안의 같은 문자열을 건드리지 않게.
  out = out
    .replaceAll("{PROJECT_RULES}", body)
    .replaceAll("{PROJECT_CONTEXT}", params.projectContext);
  return renameSlashes(out);
}

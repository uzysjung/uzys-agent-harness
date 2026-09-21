/**
 * CLI 별 소유 표 — 어느 CLI 가 어느 자리를 쓰는가의 SSOT (#528 · Epic #527 정의 5).
 *
 * 지금까지 "이 파일은 누구 것인가"는 세 곳에 흩어져 있었다: `removeTemplates` 의 세 디렉터리,
 * `removeExternalFiles` 의 기록 순회, 그리고 각 transform 이 쓰는 자리. 전량 uninstall 만
 * 있을 때는 셋이 같은 답을 낼 필요가 없었다 — 전부 지우니까. **CLI 하나만 빼는 순간**
 * 답이 갈린다: `.agents/skills/` 는 codex 를 빼도 opencode 가 남아 있으면 남아야 하고,
 * `AGENTS.md` 는 둘 다 나갈 때만 정리 대상이다. 그 판단은 한 표에서만 나와야 한다.
 *
 * **전용(exclusive)** = 이 CLI 만 쓰는 자리. 그 CLI 가 나가면 함께 나간다.
 * **공유(shared)** = 다른 CLI 와 나눠 쓰는 자리. **남는 CLI 중 사용자가 하나도 없을 때만** 나간다.
 *
 * 경로의 처리 방식(`kind`)까지 여기 적는 이유: 경로만 주면 호출부가 다시 "이건 디렉터리인가,
 * sha 를 봐야 하나"를 판정하게 되고 그게 곧 두 번째 사본이다.
 */

import { INSTALL_LOG_DIR } from "./install-log.js";
import { HARNESS_ANCHOR_FILE } from "./project-claude-merge.js";
import { CLI_BASES, type CliBase } from "./types.js";

/**
 * 회수 방식. 같은 "우리 것"이라도 되돌리는 절차가 다르다.
 *
 * - `dir` — 하네스 전용 디렉터리. 통째로 rm 한다 (`removeTemplates` 가 하던 그것).
 * - `recorded` — 설치 로그 `externalFiles` 기준선(sha)이 소유를 말하는 자리. 파일 하나이거나
 *   `/` 로 끝나는 **접두 디렉터리**다. `.agents/` 를 통째로 지우지 않는 이유는
 *   `removeExternalFiles` 주석 참조 — 그 자리는 `npx skills` 와 공유한다.
 * - `anchor` — 하네스 앵커 파일. 소유 판정은 `templates.rootClaudeMd` 의 sha.
 * - `import-block` — 설치자 소유 파일 안의 마커 블록만. 파일은 절대 지우지 않는다.
 * - `keep` — 우리가 만들었을 수 있지만 **CLI 제거로는 건드리지 않는 자리**. 전 CLI 공유이고
 *   설치자 내용이 섞이거나(`.mcp.json`) 설치 기록 자체(`.uzys-agent-harness/`)다.
 */
export type OwnedPathKind = "dir" | "recorded" | "anchor" | "import-block" | "keep";

export interface OwnedPath {
  /** projectDir 상대 경로. 디렉터리는 `/` 로 끝난다. */
  path: string;
  kind: OwnedPathKind;
  /** 이 자리를 함께 쓰는 **다른** CLI. 비어 있으면 전용. */
  sharedWith: ReadonlyArray<CliBase>;
}

/** 전 CLI 가 나눠 쓰는 자리 — CLI 하나를 빼는 것으로는 사라지지 않는다. */
const SHARED_BY_ALL = (self: CliBase): OwnedPath[] => [
  { path: ".mcp.json", kind: "keep", sharedWith: CLI_BASES.filter((c) => c !== self) },
  {
    path: `${INSTALL_LOG_DIR}/`,
    kind: "keep",
    sharedWith: CLI_BASES.filter((c) => c !== self),
  },
];

/** Epic #527 의 표 그대로. 자리를 옮기거나 더할 때 고치는 곳은 여기 하나다. */
export const CLI_OWNERSHIP: Record<CliBase, ReadonlyArray<OwnedPath>> = {
  claude: [
    { path: ".claude/", kind: "dir", sharedWith: [] },
    { path: HARNESS_ANCHOR_FILE, kind: "anchor", sharedWith: [] },
    { path: "CLAUDE.md", kind: "import-block", sharedWith: [] },
    ...SHARED_BY_ALL("claude"),
  ],
  codex: [
    { path: ".codex/", kind: "dir", sharedWith: [] },
    { path: "AGENTS.md", kind: "recorded", sharedWith: ["opencode"] },
    { path: ".agents/skills/", kind: "recorded", sharedWith: ["opencode", "antigravity"] },
    ...SHARED_BY_ALL("codex"),
  ],
  opencode: [
    { path: ".opencode/", kind: "dir", sharedWith: [] },
    { path: "opencode.json", kind: "recorded", sharedWith: [] },
    { path: "AGENTS.md", kind: "recorded", sharedWith: ["codex"] },
    { path: ".agents/skills/", kind: "recorded", sharedWith: ["codex", "antigravity"] },
    ...SHARED_BY_ALL("opencode"),
  ],
  antigravity: [
    { path: ".agents/rules/uzys-harness.md", kind: "recorded", sharedWith: [] },
    { path: ".agents/skills/", kind: "recorded", sharedWith: ["codex", "opencode"] },
    ...SHARED_BY_ALL("antigravity"),
  ],
};

export interface RemovableForResult {
  /** 이 CLI 전용 자리 — 무조건 회수 대상. */
  exclusive: OwnedPath[];
  /** 공유였지만 남는 CLI 중 쓰는 쪽이 없어진 자리. */
  sharedNowUnowned: OwnedPath[];
}

/**
 * `cli` 를 뺄 때 회수해도 되는 자리.
 *
 * @param remaining 제거 **후에** 남는 CLI 집합. `cli` 가 섞여 있어도 결과가 달라지지 않게
 *   걸러 낸다 — 호출부가 집합 연산을 한 번 더 하게 만들면 그게 갈림의 자리가 된다.
 *
 * 공유 자리의 "사용자"는 표를 뒤집어 구한다(`sharedWith` 의 사본을 읽지 않는다): 남는 CLI 중
 * **그 경로를 자기 표에 갖고 있는** CLI 가 하나라도 있으면 남긴다. 한쪽 표에만 상대를 적어 둔
 * 비대칭이 있어도 결과가 안전한 쪽(남긴다)으로 간다.
 */
export function removableFor(cli: CliBase, remaining: ReadonlyArray<CliBase>): RemovableForResult {
  const others = remaining.filter((c) => c !== cli);
  const stillUsed = new Set(others.flatMap((c) => CLI_OWNERSHIP[c].map((p) => p.path)));
  const exclusive: OwnedPath[] = [];
  const sharedNowUnowned: OwnedPath[] = [];
  for (const owned of CLI_OWNERSHIP[cli]) {
    if (owned.kind === "keep") continue; // CLI 제거로는 건드리지 않는 자리
    if (owned.sharedWith.length === 0) exclusive.push(owned);
    else if (!stillUsed.has(owned.path)) sharedNowUnowned.push(owned);
  }
  return { exclusive, sharedNowUnowned };
}

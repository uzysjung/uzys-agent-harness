import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  excludedKeyParts,
  excludedStillThereRows,
  releasedRows,
  restoredKeysPart,
} from "../src/commands/install-render.js";
import { RULES_INSTRUCTION_KEY } from "../src/opencode/opencode-json.js";
import { shellArg } from "../src/shell-arg.js";

/**
 * #944 — 화면이 붙여 넣으라고 내는 `--without <키 id>` 는 셸에서 그대로 돌아야 한다. 새 키 id
 * `opencode:instructions[=.agents/rules/*.md]` 는 `[` `*` 를 담아, 따옴표가 없으면 zsh 가 `no matches found` 로 명령째 거절한다.
 */
const GLOB_ID = `opencode:${RULES_INSTRUCTION_KEY}`;
// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI 색 코드를 벗긴다
const plain = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, "");

/** 화면 줄에서 `--without` 뒤의 인자 하나(따옴표째). */
function withoutArgs(line: string): string[] {
  return [...plain(line).matchAll(/--without ('(?:[^']|'\\'')*'|[^\s,;)]+)/g)].map(
    (m) => m[1] ?? "",
  );
}

const zsh = spawnSync("zsh", ["-fc", "true"]).status === 0;

describe("shellArg — 셸이 펼치는 글자가 있을 때만 작은따옴표", () => {
  it("글롭 글자가 든 키 id 는 감싸고, 나머지 id 는 그대로", () => {
    expect(shellArg(GLOB_ID)).toBe(`'${GLOB_ID}'`);
    expect(shellArg("mcp:context7")).toBe("mcp:context7");
    expect(shellArg("settings:hooks.SessionStart#session-start.sh")).toBe(
      "settings:hooks.SessionStart#session-start.sh",
    );
    expect(shellArg("baseline:skills/ui-visual-review")).toBe("baseline:skills/ui-visual-review");
    expect(shellArg("it's [x]")).toBe(`'it'\\''s [x]'`);
  });
});

describe("화면의 `--without` 인자 — 키 id 를 그대로 붙여 넣어 돌아간다", () => {
  const lines: Array<[string, string]> = [
    ["restoredKeysPart", restoredKeysPart([GLOB_ID, "mcp:context7"])],
    [
      "excludedKeyParts",
      excludedKeyParts({ removedOut: [GLOB_ID], removedEdited: [], keptOut: [] }).join(" "),
    ],
    ["releasedRows", releasedRows([{ id: GLOB_ID, again: false, tail: "x" }]).join("\n")],
    [
      "excludedStillThereRows",
      excludedStillThereRows([{ id: GLOB_ID, catalog: false }]).join("\n"),
    ],
  ];

  it.each(lines)("%s — 글롭 키 id 는 따옴표째 · 그 밖은 그대로", (_, line) => {
    const args = withoutArgs(line);
    expect(args, "탐지기 자기검증 — 줄에 `--without` 인자가 있다").toContain(`'${GLOB_ID}'`);
    expect(args).not.toContain(GLOB_ID);
    if (line.includes("mcp:context7")) expect(args).toContain("mcp:context7");
  });

  it.skipIf(!zsh)(
    "실제 zsh 가 화면의 인자를 키 id 그대로 받는다 — 대조군: 따옴표 없는 같은 인자는 거절한다",
    () => {
      const cwd = mkdtempSync(join(tmpdir(), "shell-arg-"));
      try {
        const [arg] = withoutArgs(restoredKeysPart([GLOB_ID]));
        const out = execFileSync("zsh", ["-fc", `print -r -- ${arg}`], { cwd, encoding: "utf8" });
        expect(out.trim()).toBe(GLOB_ID);
        const bare = spawnSync("zsh", ["-fc", `print -r -- ${GLOB_ID}`], { cwd, encoding: "utf8" });
        expect(bare.status).not.toBe(0);
        expect(bare.stderr).toContain("no matches found");
      } finally {
        rmSync(cwd, { recursive: true, force: true });
      }
    },
  );
});

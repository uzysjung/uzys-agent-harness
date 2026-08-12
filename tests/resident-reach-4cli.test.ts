import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import { CLI_BASES, type CliBase, DEFAULT_OPTIONS } from "../src/types.js";

/**
 * **네 CLI 중 어디에 설치해도 룰이 도달하는가.**
 *
 * WHY (실측 2026-08-12): 이 저장소가 파는 문장은 "4개 CLI 에 검증된 룰·훅·스킬을 설치한다"인데,
 * 실측하니 **룰은 Claude Code 에만** 갔다 — Codex · OpenCode · Antigravity 단독 설치는 룰 0종.
 * `.claude/rules/` 하나로만 나갔고 그 디렉터리는 `spec.cli` 에 claude 가 있을 때만 만들어진다.
 * 게다가 OpenCode 설치본은 `opencode.json` 의 `instructions` 글롭으로 그 없는 디렉터리를 가리키며
 * "자동 병합된다"고 안내까지 했다(#300 — 설치자에게 실제로 나가던 거짓말).
 *
 * 세 CLI 모두 룰을 받을 자리가 있으므로(각 CLI 공식 문서 확인) 공백은 능력 한계가 아니라 배선이었다.
 * 이 게이트는 그 배선을 문다. 도달을 **문서 대조가 아니라 실설치 산출물**로 판정하는 것이 요점이다
 * — 두 번 당한 형태가 "의도는 주석에 적혀 있는데 배선이 그러지 않은" 것이었다.
 */

const ROOT = resolve(import.meta.dirname, "..");

/**
 * 배포 룰 본문에서 뽑은 canary. **앵커에는 없어야** 룰의 도달을 판별할 수 있다 —
 * 비 Claude CLI 는 앵커 본문을 `AGENTS.md` 에 통째로 싣기 때문에, 앵커에도 있는 문자열로 재면
 * 룰이 0종이어도 "도달"로 잡힌다. 아래 첫 테스트가 그 조건을 먼저 증명한다.
 */
const RULE_CANARIES: ReadonlyArray<readonly [string, string]> = [
  ["git-policy", "공유 이력을 바꾸거나"],
  ["test-policy", "Select the test level and technique"],
  ["ship-checklist", "무엇으로 검증할지는 이 저장소가 정한다"],
  ["doc-governance", "한 사실의 기준 문서는 하나다"],
  ["change-management", "합의된 범위와 완료 기준 안에서는"],
  ["cli-development", "빈 결과는 부재의 증거가 아니다"],
];

/** `--cli <one>` 단독 설치 산출물. 설치는 비싸므로 CLI 당 한 번만 돌린다. */
interface Installed {
  dir: string;
  files: string[];
  /** project-relative 경로 → 내용. 텍스트로 읽히지 않는 파일은 담지 않는다. */
  text: Map<string, string>;
}

const installed = new Map<CliBase, Installed>();

function walk(dir: string, rel = "", out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(join(dir, e.name), r, out);
    else out.push(r);
  }
  return out;
}

beforeAll(() => {
  for (const cli of CLI_BASES) {
    const dir = mkdtempSync(join(tmpdir(), `reach-${cli}-`));
    runInstall({
      harnessRoot: ROOT,
      projectDir: dir,
      spec: {
        cli: [cli],
        tracks: ["tooling"],
        options: { ...DEFAULT_OPTIONS },
        projectDir: dir,
      },
      runExternal: null,
    });
    const files = walk(dir);
    const text = new Map<string, string>();
    for (const f of files) {
      try {
        text.set(f, readFileSync(join(dir, f), "utf8"));
      } catch {
        // 바이너리/읽기 실패는 도달 판정 대상이 아니다.
      }
    }
    installed.set(cli, { dir, files, text });
  }
});

/** 설치 산출물 어딘가에 이 문자열이 있는가. */
function reaches(cli: CliBase, needle: string): boolean {
  const inst = installed.get(cli);
  if (!inst) throw new Error(`설치 산출물 없음: ${cli}`);
  for (const body of inst.text.values()) if (body.includes(needle)) return true;
  return false;
}

describe("탐지기 자기검증", () => {
  it("canary 는 룰 원본에 실재하고 앵커에는 없다 — 아니면 도달 판정이 공허해진다", () => {
    const anchor = readFileSync(join(ROOT, "templates/CLAUDE.md"), "utf8");
    for (const [rule, needle] of RULE_CANARIES) {
      const src = readFileSync(join(ROOT, `templates/rules/${rule}.md`), "utf8");
      expect(src, `${rule} canary 오기 — 원본에 없다`).toContain(needle);
      expect(anchor, `${rule} canary 가 앵커에도 있어 룰 도달을 판별할 수 없다`).not.toContain(
        needle,
      );
    }
  });

  it("CLI 4종 전부 설치됐다 — 0건 통과 방지", () => {
    expect(CLI_BASES.length).toBe(4);
    for (const cli of CLI_BASES) {
      expect(installed.get(cli)?.files.length ?? 0, `${cli} 설치 산출물 0개`).toBeGreaterThan(5);
    }
  });
});

describe("룰이 4 CLI 전부에 도달한다", () => {
  for (const cli of CLI_BASES) {
    it(`${cli}: 배포 룰 본문이 설치 산출물 안에 있다`, () => {
      // tooling 트랙이 받는 룰 전부. 한 종이라도 빠지면 그 CLI 사용자는 그 규율을 못 받는다.
      for (const [rule, needle] of RULE_CANARIES) {
        expect(reaches(cli, needle), `${cli} 에 ${rule} 미도달`).toBe(true);
      }
    });
  }
});

describe("룰이 가리키는 도구도 함께 도달한다", () => {
  // 룰 본문이 `.uzys-agent-harness/*.sh` 를 호출 지점으로 지목한다. 룰만 보내고 도구를 안 보내면
  // 없는 도구를 있다고 안내하는 것이라, #300 을 고치면서 같은 형태를 새로 만드는 셈이 된다.
  for (const cli of CLI_BASES) {
    it(`${cli}: spec-drift-check.sh · protect-branch.sh`, () => {
      const files = installed.get(cli)?.files ?? [];
      expect(files).toContain(".uzys-agent-harness/spec-drift-check.sh");
      expect(files).toContain(".uzys-agent-harness/protect-branch.sh");
    });
  }
});

describe("각 CLI 의 배선이 실재하는 파일을 가리킨다", () => {
  it("OpenCode: `instructions` 글롭이 매치하는 룰 파일이 실제로 있다 (#300 의 본체)", () => {
    const inst = installed.get("opencode");
    if (!inst) throw new Error("opencode 설치 없음");
    const cfg = JSON.parse(inst.text.get("opencode.json") ?? "{}") as {
      instructions?: string[];
    };
    const globs = cfg.instructions ?? [];
    expect(globs, "instructions 키가 사라졌다 — 룰 병합 경로가 통째로 없어진다").not.toHaveLength(
      0,
    );
    // 글롭 자체가 아니라 **그 글롭이 무엇을 잡는지**를 본다. 전에는 `.claude/rules/*.md` 를
    // 가리켰고 OpenCode 단독 설치엔 그 디렉터리가 아예 없어 매치가 0건이었다.
    const ruleGlob = globs.find((g) => g.endsWith("rules/*.md"));
    expect(ruleGlob, "룰을 가리키는 글롭이 없다").toBeTruthy();
    const dir = (ruleGlob as string).replace(/\/\*\.md$/, "");
    const matched = inst.files.filter((f) => f.startsWith(`${dir}/`) && f.endsWith(".md"));
    expect(matched.length, `글롭 ${ruleGlob} 이 0개 파일을 매치한다`).toBeGreaterThan(2);
  });

  it("Antigravity: 룰이 워크스페이스 룰 디렉터리에 앵커와 형제로 놓인다", () => {
    const files = installed.get("antigravity")?.files ?? [];
    expect(files).toContain(".agents/rules/uzys-harness.md"); // 앵커
    expect(files.filter((f) => f.startsWith(".agents/rules/")).length).toBeGreaterThan(3);
  });

  it("Codex: 룰이 AGENTS.md 본문에 들어가고 문서가 32 KiB 상한 안에 있다", () => {
    const body = installed.get("codex")?.text.get("AGENTS.md") ?? "";
    expect(body).toContain("## Harness Rules");
    // Codex 는 지시문 총량을 32 KiB(`project_doc_max_bytes`)에서 자른다. 잘리면 뒤쪽 룰이
    // 조용히 사라지므로, 상한에 닿기 전에 여기서 먼저 걸린다.
    expect(Buffer.byteLength(body, "utf8")).toBeLessThan(32 * 1024);
    // placeholder 가 치환되지 않은 채 나가면 사용자가 `{HARNESS_RULES}` 를 읽게 된다.
    expect(body).not.toContain("{HARNESS_RULES}");
  });
});

describe("기존 계약 보존", () => {
  it("claude 미선택 설치는 `.claude/` 를 만들지 않는다 (v0.8.0 dead weight 회피)", () => {
    for (const cli of CLI_BASES) {
      const dir = installed.get(cli)?.dir ?? "";
      expect(existsSync(join(dir, ".claude")), `${cli} 가 .claude/ 를 만들었다`).toBe(
        cli === "claude",
      );
    }
  });
});

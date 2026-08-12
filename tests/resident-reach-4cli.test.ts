import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import { resolveRules } from "../src/manifest.js";
import { CLI_BASES, type CliBase, DEFAULT_OPTIONS } from "../src/types.js";
import { buildUpdateSpec } from "../src/update-mode.js";

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

/**
 * **조합 설치** — 위저드 2단계가 4 CLI 다중 선택이라 조합이 예외가 아니라 기본 시나리오다.
 *
 * 첫 판은 `--cli <one>` 단독만 돌렸고, 그래서 codex 와 opencode 가 **같은 프로젝트 루트
 * `AGENTS.md`** 를 쓴다는 사실을 통째로 놓쳤다 — 나중에 도는 transform 이 앞선 것을 덮어써
 * codex 룰이 0종이 됐다(독립 검증 C-1 실측). 파일을 공유하는 CLI 쌍이 있는 한 조합은 별개
 * 검사 대상이다.
 */
const COMBOS: ReadonlyArray<ReadonlyArray<CliBase>> = [
  ["codex", "opencode"],
  ["claude", "codex"],
  [...CLI_BASES],
];
const combos = new Map<string, Installed>();

function walk(dir: string, rel = "", out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) walk(join(dir, e.name), r, out);
    else out.push(r);
  }
  return out;
}

function install(cli: ReadonlyArray<CliBase>, label: string): Installed {
  const dir = mkdtempSync(join(tmpdir(), `reach-${label}-`));
  runInstall({
    harnessRoot: ROOT,
    projectDir: dir,
    spec: { cli: [...cli], tracks: ["tooling"], options: { ...DEFAULT_OPTIONS }, projectDir: dir },
    runExternal: null,
  });
  return snapshot(dir);
}

function snapshot(dir: string): Installed {
  const files = walk(dir);
  const text = new Map<string, string>();
  for (const f of files) {
    try {
      text.set(f, readFileSync(join(dir, f), "utf8"));
    } catch {
      // 바이너리/읽기 실패는 도달 판정 대상이 아니다.
    }
  }
  return { dir, files, text };
}

beforeAll(() => {
  for (const cli of CLI_BASES) installed.set(cli, install([cli], cli));
  for (const combo of COMBOS) combos.set(combo.join("+"), install(combo, combo.join("-")));
});

/**
 * **그 CLI 가 실제로 읽는 자리**에 이 문자열이 있는가.
 *
 * 첫 판은 설치 트리 전체를 문자열 검색했다. 그러면 룰을 `.codex/rules/`(Codex 가 읽지 않는
 * 자리)로 내보내도 전 스위트가 green 이다 — 독립 검증 H-3 이 변이로 실증했다. 도달은 "파일이
 * 어딘가 있다"가 아니라 "그 CLI 의 로딩 경로 안에 있다"이므로, CLI 별 목적지를 명시한다.
 */
const RULE_DESTINATION: Record<CliBase, (f: string) => boolean> = {
  // Claude Code — `.claude/rules/<name>.md`
  claude: (f) => f.startsWith(".claude/rules/"),
  // Codex — 룰 디렉터리가 없다. `AGENTS.md` 계층이 유일한 로딩 경로다.
  codex: (f) => f === "AGENTS.md",
  // OpenCode — 프로젝트 루트 `AGENTS.md` 를 자동으로 읽는다(codex 와 같은 파일을 공유한다).
  opencode: (f) => f === "AGENTS.md",
  // Antigravity — `.agents/rules/*.md` 워크스페이스 룰.
  antigravity: (f) => f.startsWith(".agents/rules/"),
};

function reaches(cli: CliBase, needle: string): boolean {
  const inst = installed.get(cli);
  if (!inst) throw new Error(`설치 산출물 없음: ${cli}`);
  const inDestination = RULE_DESTINATION[cli];
  for (const [path, body] of inst.text) {
    if (inDestination(path) && body.includes(needle)) return true;
  }
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

  it("canary 목록이 실제 설치 룰 전량을 덮는다 — 열거 사본이 뒤처지지 않게", () => {
    // 룰을 하나 추가하고 canary 를 안 적으면 그 룰의 도달은 아무도 안 본다. 이 저장소가
    // 이름 붙여 온 실패 모드다("게이트는 열거하지 말고 훑어라"). 열거를 없앨 수는 없지만
    // (canary 는 룰마다 사람이 고른 고유 문장이다) **뒤처짐은 여기서 잡는다.**
    const installedRules = resolveRules({ tracks: ["tooling"] });
    expect(RULE_CANARIES.map(([r]) => r).sort()).toEqual([...installedRules].sort());
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

describe("CLI 를 함께 골라도 룰이 남는다 (파일을 공유하는 조합)", () => {
  for (const combo of COMBOS) {
    const label = combo.join("+");
    it(`${label}: 모든 선택 CLI 가 자기 자리에서 룰을 읽는다`, () => {
      const inst = combos.get(label);
      if (!inst) throw new Error(`조합 설치 없음: ${label}`);
      for (const cli of combo) {
        const inDestination = RULE_DESTINATION[cli];
        for (const [rule, needle] of RULE_CANARIES) {
          const found = [...inst.text].some(
            ([p, body]) => inDestination(p) && body.includes(needle),
          );
          expect(found, `${label} 설치에서 ${cli} 가 ${rule} 을 못 받는다`).toBe(true);
        }
      }
    });
  }
});

describe("각 CLI 의 배선이 실재하는 파일을 가리킨다", () => {
  it("OpenCode: `instructions` 가 존재하지 않는 경로를 가리키지 않는다 (#300 의 본체)", () => {
    const inst = installed.get("opencode");
    if (!inst) throw new Error("opencode 설치 없음");
    const cfg = JSON.parse(inst.text.get("opencode.json") ?? "{}") as { instructions?: string[] };
    const globs = cfg.instructions ?? [];
    // #300 은 "글롭이 있는데 0건을 매치한다"였다. 룰은 이제 AGENTS.md 가 나르므로 글롭에 룰
    // 항목이 있어서는 안 되고(있으면 중복 상주), 남은 항목은 전부 실재하거나 프로젝트가
    // 나중에 만들 문서(`docs/…`)여야 한다. 하네스 소유 경로를 가리키면서 비어 있으면 거짓이다.
    expect(
      globs.some((g) => g.includes("rules/")),
      "룰 글롭이 남아 있다 — AGENTS.md 와 중복된다",
    ).toBe(false);
    for (const g of globs) {
      expect(g.startsWith(".claude/"), `존재하지 않는 하네스 경로를 가리킨다: ${g}`).toBe(false);
      expect(g.startsWith(".opencode/"), `존재하지 않는 하네스 경로를 가리킨다: ${g}`).toBe(false);
    }
  });

  it("Antigravity: 룰이 워크스페이스 룰 디렉터리에 앵커와 형제로 놓인다", () => {
    const files = installed.get("antigravity")?.files ?? [];
    expect(files).toContain(".agents/rules/uzys-harness.md"); // 앵커
    expect(files.filter((f) => f.startsWith(".agents/rules/")).length).toBeGreaterThan(3);
  });

  it("Codex: 룰이 AGENTS.md 본문에 들어가고 32 KiB 예산에 여유가 남는다", () => {
    const body = installed.get("codex")?.text.get("AGENTS.md") ?? "";
    expect(body).toContain("## Harness Rules");
    // placeholder 가 치환되지 않은 채 나가면 사용자가 `{HARNESS_RULES}` 를 읽게 된다.
    expect(body).not.toContain("{HARNESS_RULES}");
    // `project_doc_max_bytes`(기본 32 KiB)는 **합계** 상한이다 — 전역 `~/.codex/AGENTS.md` ·
    // 이 파일 · 하위 디렉터리 파일을 더해 상한에 닿으면 **거기서 읽기를 멈춘다**(뒤가 조용히
    // 빠지고, 하위 파일이 뒤에 온다). 그래서 "이 파일 하나가 32 KiB 아래"는 안전의 증거가 아니다.
    //
    // 실측 22,233 B = 합계 예산의 **68%**. 사용자 몫은 ~10 KB 남는다. 이건 여유롭지 않다 —
    // 그래서 여기 상한은 안전 마진이 아니라 **비증가 ratchet** 이다: 지금보다 커지면 red 로
    // 만들어 "누가 언제 늘렸는가"를 그 자리에서 묻는다. 줄이는 것은 별건이다(계획 문서 이월).
    const bytes = Buffer.byteLength(body, "utf8");
    const RATCHET = 23 * 1024; // 실측 22,233 B 바로 위
    expect(
      bytes,
      `AGENTS.md ${bytes} B — 32 KiB **합계** 예산의 ${Math.round((bytes / (32 * 1024)) * 100)}% 를 우리가 쓴다.\n` +
        "늘리려면 무엇을 줄일지 함께 정해라. 이 상한은 안전 마진이 아니라 비증가 ratchet 이다.",
    ).toBeLessThan(RATCHET);
  });
});

describe("update 를 돌려도 룰이 남는다 / 없던 룰은 새로 받는다", () => {
  // 이 축에는 게이트가 없었고, 독립 검증이 결함 3건을 그 자리에서 찾았다: ⓐ update 가
  // `AGENTS.md` 를 덮어써 codex 룰이 사라지고 ⓑ 기존 설치자는 새 룰 파일을 영원히 못 받고
  // ⓒ 비 Claude 단독 설치는 update 자체가 throw 했다. 설치 후 한 번 돌려 보는 것으로 셋 다 문다.
  const update = (dir: string): Installed => {
    runInstall({
      harnessRoot: ROOT,
      projectDir: dir,
      spec: buildUpdateSpec(dir, ["tooling"]),
      mode: "update",
      runExternal: null,
    });
    return snapshot(dir);
  };

  for (const cli of [["claude", "codex"], ["codex", "opencode"], ["antigravity"]] as const) {
    const label = cli.join("+");
    it(`${label}: update 후에도 각 CLI 가 자기 자리에서 룰을 읽는다`, () => {
      const fresh = install([...cli], `upd-${cli.join("-")}`);
      const after = update(fresh.dir);
      for (const target of cli) {
        const inDestination = RULE_DESTINATION[target];
        for (const [rule, needle] of RULE_CANARIES) {
          const found = [...after.text].some(
            ([p, body]) => inDestination(p) && body.includes(needle),
          );
          expect(found, `${label} update 후 ${target} 가 ${rule} 을 잃었다`).toBe(true);
        }
      }
    });
  }

  it("이 릴리즈 이전 설치자도 update 로 새 룰을 받는다 (없던 파일을 만든다)", () => {
    // 구버전 상태 재현: Antigravity 는 앵커만 있고 형제 룰 파일이 없었다. `refreshOnly` 는
    // 없는 파일을 건너뛰므로, 예외가 없으면 이 사용자는 재설치 전에는 룰을 영영 못 받는다.
    const fresh = install(["antigravity"], "upd-legacy");
    for (const f of fresh.files.filter((p) => p.startsWith(".agents/rules/"))) {
      if (f !== ".agents/rules/uzys-harness.md") rmSync(join(fresh.dir, f));
    }
    expect(
      walk(fresh.dir).filter((f) => f.startsWith(".agents/rules/")),
      "구버전 재현 실패 — 앵커만 남겨야 한다",
    ).toEqual([".agents/rules/uzys-harness.md"]);

    const after = update(fresh.dir);
    for (const [rule, needle] of RULE_CANARIES) {
      const found = [...after.text].some(
        ([p, body]) => p.startsWith(".agents/rules/") && body.includes(needle),
      );
      expect(found, `update 가 ${rule} 을 만들지 않았다`).toBe(true);
    }
  });

  it("비 Claude 단독 설치도 update 가 돈다 — 그리고 Claude 전용 파일을 만들지 않는다", () => {
    // `not.toThrow()` 만 보면 **무엇이 생겼는지**를 안 본다. pre-flight 를 푼 대가로 비 Claude
    // 단독 설치가 update 경로에 처음 도달했고, 그 경로가 앵커 동기화를 무조건 돌려
    // `CLAUDE-uzys-harness.md` 와 루트 `CLAUDE.md` 를 만들었다(독립 재검증 HIGH-1). 둘 다
    // Claude Code 전용 로딩 경로이고, 루트 `CLAUDE.md` 는 사용자 소유 이름이다.
    for (const cli of ["codex", "opencode", "antigravity"] as const) {
      const fresh = install([cli], `upd-solo-${cli}`);
      expect(existsSync(join(fresh.dir, ".claude"))).toBe(false);
      const before = new Set(fresh.files);
      expect(() => update(fresh.dir)).not.toThrow();
      const created = walk(fresh.dir).filter((f) => !before.has(f));
      expect(created, `${cli} update 가 Claude 전용 파일을 만들었다`).toEqual([]);
    }
  });

  it("claude 설치인데 `.claude/` 가 사라졌으면 막는다 — 반쪽 복원보다 재설치가 낫다", () => {
    // 룰만 복원되고 `settings.json`·훅이 없는 `.claude/` 는 이 저장소의 hook-wiring-parity 가
    // templates 쪽에서 금지하는 바로 그 상태다. update 로 그걸 만들 수 있으면 안 된다(M-R2).
    const fresh = install(["claude"], "upd-broken");
    rmSync(join(fresh.dir, ".claude"), { recursive: true, force: true });
    expect(() => update(fresh.dir)).toThrow(/requires an existing install/);
  });

  it("설치되지 않은 CLI 의 룰 디렉터리를 update 가 만들지 않는다 (`createInRefresh` 누수)", () => {
    // `createInRefresh` 는 refreshOnly 규율의 예외라, 조건이 뒤집히면 안 깐 CLI 에 디렉터리가
    // 생긴다. 그 불변식을 지키는 것이 코드 한 줄뿐이었고 아무도 안 물었다(독립 재검증 M-R1).
    for (const cli of [["claude"], ["claude", "codex"]] as const) {
      const fresh = install([...cli], `upd-leak-${cli.join("-")}`);
      const after = update(fresh.dir);
      const agentsRules = after.files.filter((f) => f.startsWith(".agents/rules/"));
      expect(agentsRules, `${cli.join("+")} 에 antigravity 룰이 생겼다`).toEqual([]);
    }
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

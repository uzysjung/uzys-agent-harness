/**
 * #550 ① — Codex 와 OpenCode 를 **함께** 깐 설치본에서 설치자가 `AGENTS.md` 의 `## Project Context`
 * 를 고친 뒤 `update` 를 돌려도 백업이 쌓이지 않는다.
 *
 * 결함의 형태: 두 transform 이 같은 `AGENTS.md` 를 **서로 다른 템플릿**으로 차례로 쓴다. 디스크에는
 * 늘 뒤에 도는 opencode 판이 남고, 다음 update 에서 앞에 도는 codex 가 그 판을 자기 판으로 바꾸려
 * 든다 — 내용이 달라 쓰기가 일어나고, 설치자가 고친 파일이라 기준선 sha 와도 달라 **백업이 1건**
 * 생긴다(opencode 는 그 직후 되돌려 쓴다). 설치자 문단은 살아남지만 편집할 때마다 백업이 하나씩 쌓인다.
 *
 * 반대 축도 같은 무게로 잰다 — 고친 뒤에도 **달라지지 말아야 하는 것**:
 *   - 단독 설치본(codex · opencode)의 보존 · 백업 동작
 *   - 설치자가 **하네스 소유 절**을 고치면 백업 1건 + 최신판 복원 (ADR-048 소유자 판정)
 *
 * 절 추출기는 구현(`agents-md-merge`)을 부르지 않는다 — 같은 함수로 재면 그 함수가 틀린 순간
 * 테스트도 함께 틀린다(`agents-md-preserve.test.ts` 와 같은 이유).
 */

import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInstall } from "../src/installer.js";
import type { CliTargets, InstallSpec } from "../src/types.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** 두 템플릿의 최상위 절 합집합 — 경계 판정용. codex 판에만 `Session Start` 가 있다. */
const SECTIONS = [
  "Project Context",
  "Project Rules",
  "Harness Rules",
  "Session Start",
  "Protected Files",
];
const INSTALLER_LINE = "우리 팀 결제 서비스다. 런타임은 Bun — 배포는 금요일에 하지 않는다.";

let projectDir: string;
let freshDir: string;

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), "agents-md-combined-"));
  freshDir = mkdtempSync(join(tmpdir(), "agents-md-combined-fresh-"));
});

afterEach(() => {
  rmSync(projectDir, { recursive: true, force: true });
  rmSync(freshDir, { recursive: true, force: true });
});

function spec(dir: string, cli: CliTargets): InstallSpec {
  return { tracks: ["tooling"], options: { withCodexTrust: false }, cli, projectDir: dir };
}

function install(dir: string, cli: CliTargets): void {
  runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir: dir,
    spec: spec(dir, cli),
    mode: "add",
    runExternal: null,
  });
}

/** `update` 는 CLI 집합을 설치 로그에서 읽는다 — spec 의 cli 는 판정에 쓰이지 않는다. */
function update(cli: CliTargets) {
  return runInstall({
    harnessRoot: HARNESS_ROOT,
    projectDir,
    spec: spec(projectDir, cli),
    mode: "update",
    runExternal: null,
  });
}

function agentsMd(dir = projectDir): string {
  return readFileSync(join(dir, "AGENTS.md"), "utf8");
}

/** 프로젝트 루트의 `AGENTS.md` 백업 — `backupFile` 이 원본 옆에 `.backup-<stamp>` 로 둔다. */
function agentsBackups(): string[] {
  return readdirSync(projectDir).filter((n) => n.startsWith("AGENTS.md.backup-"));
}

function sectionBounds(text: string, name: string): [number, number] {
  const lines = text.split("\n");
  const start = lines.indexOf(`## ${name}`);
  expect(start, `${name} 절이 없다 — 이 테스트의 전제가 깨졌다`).toBeGreaterThanOrEqual(0);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (SECTIONS.some((s) => lines[i] === `## ${s}`)) {
      end = i;
      break;
    }
  }
  return [start, end];
}

function section(text: string, name: string): string {
  const [start, end] = sectionBounds(text, name);
  return text
    .split("\n")
    .slice(start + 1, end)
    .join("\n");
}

/** 절 본문 맨 앞에 한 줄 — 설치자가 스캐폴드 위에 적는 모양. */
function prependToSection(text: string, name: string, line: string): string {
  const lines = text.split("\n");
  const [start] = sectionBounds(text, name);
  lines.splice(start + 1, 0, "", line);
  return lines.join("\n");
}

function editProjectContext(): string {
  const edited = prependToSection(agentsMd(), "Project Context", INSTALLER_LINE);
  writeFileSync(join(projectDir, "AGENTS.md"), edited);
  return edited;
}

/** 같은 CLI 조합의 **깨끗한 설치** 판 — "하네스 소유 절의 최신판"의 대조 기준. */
function freshRender(cli: CliTargets): string {
  install(freshDir, cli);
  return agentsMd(freshDir);
}

describe("#550 ① codex + opencode — Project Context 편집 뒤 update 가 백업을 쌓지 않는다", () => {
  const BOTH: CliTargets = ["codex", "opencode"];

  it("update 2회 연속 — 새 백업 0 · 설치자 문단 바이트 그대로 · 하네스 소유 절은 최신판", () => {
    install(projectDir, BOTH);
    const edited = editProjectContext();
    const fresh = freshRender(BOTH);

    for (const round of [1, 2]) {
      const report = update(BOTH);
      expect(agentsBackups(), `${round}회째 update 가 AGENTS.md 백업을 만들었다`).toEqual([]);
      expect(report.updateMode?.externalBackedUp ?? [], `${round}회째`).not.toContain("AGENTS.md");
      // 설치자 절 — 편집한 판과 바이트 동일.
      expect(section(agentsMd(), "Project Context")).toBe(section(edited, "Project Context"));
      // 하네스 소유 절 — 같은 조합을 새로 깐 판과 같다(= 최신판).
      for (const owned of ["Harness Rules", "Protected Files"]) {
        expect(section(agentsMd(), owned), `${round}회째 ${owned}`).toBe(section(fresh, owned));
      }
    }
    // 같은 릴리즈라 바뀐 것이 없다 — 파일 전체가 편집한 판 그대로다.
    expect(agentsMd()).toBe(edited);
  });

  it("편집이 없으면 update 가 AGENTS.md 를 쓰지 않는다 — 원인(두 판 뒤집기) 자체를 잰다", () => {
    install(projectDir, BOTH);
    const before = agentsMd();

    const report = update(BOTH);

    // 수정 전에는 codex 가 opencode 판을 자기 판으로, opencode 가 다시 자기 판으로 — 매 update
    // "2 files updated" 였다. 백업은 설치자가 편집했을 때만 드러나는 증상이고 이쪽이 원인이다.
    expect(report.updateMode?.externalUpdated).toBe(0);
    expect(agentsMd()).toBe(before);
  });

  it("설치자가 하네스 소유 절을 고치면 — 백업 1건 · 최신판으로 복원 (ADR-048 그대로)", () => {
    install(projectDir, BOTH);
    const fresh = freshRender(BOTH);
    const tampered = agentsMd().replace("## Protected Files\n", "## Protected Files\n\n손댄 줄.\n");
    expect(tampered, "치환이 걸리지 않았다 — 픽스처 전제가 깨졌다").not.toBe(agentsMd());
    writeFileSync(join(projectDir, "AGENTS.md"), tampered);

    const first = update(BOTH);
    expect(agentsBackups()).toHaveLength(1);
    expect(first.updateMode?.externalBackedUp ?? []).toContain("AGENTS.md");
    expect(section(agentsMd(), "Protected Files")).toBe(section(fresh, "Protected Files"));

    // 복원된 판은 하네스 것이다 — 다음 update 는 조용하다.
    update(BOTH);
    expect(agentsBackups()).toHaveLength(1);
  });
});

describe.each<CliTargets>([
  ["codex"],
  ["opencode"],
])("#550 ① 대조군 — 단독 설치본 동작은 그대로 (%s)", (cli) => {
  it("Project Context 편집 → update 2회 → 백업 0 · 파일 그대로", () => {
    install(projectDir, [cli]);
    const edited = editProjectContext();

    update([cli]);
    update([cli]);

    expect(agentsBackups()).toEqual([]);
    expect(agentsMd()).toBe(edited);
  });

  it("하네스 소유 절 편집 → update → 백업 1건 · 최신판", () => {
    install(projectDir, [cli]);
    const fresh = freshRender([cli]);
    const tampered = agentsMd().replace("## Protected Files\n", "## Protected Files\n\n손댄 줄.\n");
    writeFileSync(join(projectDir, "AGENTS.md"), tampered);

    update([cli]);

    expect(agentsBackups()).toHaveLength(1);
    // 제목 줄은 프로젝트 디렉터리 이름이라 두 판이 다르다 — 절 단위로 댄다.
    expect(section(agentsMd(), "Protected Files")).toBe(section(fresh, "Protected Files"));
  });
});

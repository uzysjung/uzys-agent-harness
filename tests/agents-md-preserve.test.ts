/**
 * `AGENTS.md` — 설치자가 채운 절이 update/재설치를 넘긴다 (#503).
 *
 * 여기서 무는 것은 **설치자 디스크의 파일**이다. v26.159.0 까지 codex/opencode transform 은
 * `AGENTS.md` 를 매번 통째로 렌더해 덮었고, 그래서 `## Project Context` 를 채워 둔 사람은
 * `update` 한 번에 빈 스캐폴드를 돌려받았다(이전 판은 백업에만 남았다). 반대쪽 실패도 같이
 * 물어야 한다 — 보존한다고 하네스 룰·앵커까지 옛 판으로 얼면 update 가 존재 이유를 잃는다.
 *
 * 판정용 절 추출기는 **구현을 부르지 않는다**(`agents-md-merge` 를 import 하지 않는다) —
 * 같은 함수로 재면 그 함수가 틀린 순간 테스트도 함께 틀린다.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runCodexTransform } from "../src/codex/transform.js";
import type { InstallLogSkillFile } from "../src/install-log.js";
import { runOpencodeTransform } from "../src/opencode/transform.js";

const HARNESS_ROOT = resolve(__dirname, "..");
/** 렌더된 `AGENTS.md` 의 최상위 절 — 템플릿과 같아야 한다(이름이 바뀌면 여기서 먼저 터진다). */
const SECTIONS = [
  "Project Context",
  "Project Rules",
  "Harness Rules",
  "Session Start",
  "Protected Files",
];
const SKILLS_HEADING = "## Skills that apply continuously";

let project: string;

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "agents-preserve-"));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

function agentsPath(): string {
  return join(project, "AGENTS.md");
}

function read(): string {
  return readFileSync(agentsPath(), "utf8");
}

function baselineOf(files: ReadonlyArray<InstallLogSkillFile>): ReadonlyMap<string, string> {
  return new Map(files.map((f) => [f.path, f.sha256]));
}

interface RunOpts {
  rules?: ReadonlyArray<string>;
  skills?: ReadonlyArray<string>;
  refreshOnly?: boolean;
}

function codex(baseline: ReadonlyMap<string, string>, opts: RunOpts = {}) {
  return runCodexTransform({
    harnessRoot: HARNESS_ROOT,
    projectDir: project,
    baseline,
    rules: opts.rules ?? ["git-policy"],
    selectedInternalSkills: opts.skills ?? ["user-centered-explanation"],
    refreshOnly: opts.refreshOnly ?? false,
  });
}

function opencode(baseline: ReadonlyMap<string, string>, opts: RunOpts = {}) {
  return runOpencodeTransform({
    harnessRoot: HARNESS_ROOT,
    projectDir: project,
    baseline,
    rules: opts.rules ?? ["git-policy"],
    selectedInternalSkills: opts.skills ?? ["user-centered-explanation"],
    refreshOnly: opts.refreshOnly ?? false,
  });
}

/** 절 경계는 **알려진 최상위 절 이름**으로만 — 본문(스캐폴드·앵커·룰)에도 `## ` 가 있다. */
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

/** 절 본문 **맨 앞**에 한 줄 — 하네스 조각보다 앞선 사용자 텍스트가 남는지 본다. */
function prependToSection(text: string, name: string, line: string): string {
  const lines = text.split("\n");
  const [start] = sectionBounds(text, name);
  lines.splice(start + 1, 0, "", line);
  return lines.join("\n");
}

/** 절 본문 **맨 뒤**(다음 헤딩 앞 빈 줄 앞)에 한 줄 — 하네스 조각 뒤의 사용자 텍스트. */
function appendToSection(text: string, name: string, line: string): string {
  const lines = text.split("\n");
  const [, end] = sectionBounds(text, name);
  lines.splice(end - 1, 0, line);
  return lines.join("\n");
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe("AGENTS.md — 설치자가 채운 절은 재렌더를 넘긴다 (#503)", () => {
  it("Project Context·Project Rules 본문은 바이트 그대로 · Harness Rules 는 새 룰로 갱신", () => {
    const first = codex(new Map());

    // 설치자가 채운다 — 하네스 조각(스킬 안내·앵커) 앞과 뒤 양쪽에.
    let edited = read();
    edited = prependToSection(edited, "Project Context", "우리 팀 결제 서비스다. 런타임은 Bun.");
    edited = appendToSection(edited, "Project Context", "배포는 금요일에 하지 않는다.");
    edited = appendToSection(edited, "Project Rules", "- PR 은 두 명이 본다.");
    writeFileSync(agentsPath(), edited);

    // update 는 같은 파일을 다시 렌더한다 — 이번에는 룰이 바뀐 릴리즈로.
    codex(baselineOf(first.ownership.files), {
      rules: ["doc-governance"],
      refreshOnly: true,
    });
    const after = read();

    expect(section(after, "Project Context")).toBe(section(edited, "Project Context"));
    expect(section(after, "Project Rules")).toBe(section(edited, "Project Rules"));
    // 반대쪽: 하네스 소유 절은 옛 판으로 얼지 않는다.
    expect(section(after, "Harness Rules")).toContain("## Documentation Boundaries");
    expect(section(after, "Harness Rules")).not.toContain("## Git Safety");
  });

  it("상시 스킬 안내는 마커 안에서만 갱신되고 1회만 존재한다", () => {
    const first = codex(new Map());
    const edited = prependToSection(read(), "Project Context", "사용자 문단.");
    writeFileSync(agentsPath(), edited);

    // 스킬 선택이 빠지면 안내도 빠진다 — 사용자 문단은 남는다.
    const second = codex(baselineOf(first.ownership.files), { skills: [], refreshOnly: true });
    expect(read()).not.toContain(SKILLS_HEADING);
    expect(section(read(), "Project Context")).toContain("사용자 문단.");

    // 다시 깔면 한 벌만 돌아온다.
    codex(baselineOf(second.ownership.files), { refreshOnly: true });
    expect(occurrences(read(), SKILLS_HEADING)).toBe(1);
    expect(section(read(), "Project Context")).toContain("사용자 문단.");
  });

  it("마커 없는 옛 설치본 — 사용자 문단 보존 · 스킬 안내 중복 0", () => {
    const first = codex(new Map());
    // v26.159.0 판 = 지금 렌더에서 마커 줄만 뺀 것. 그 시절 파일을 그대로 재현한다.
    const legacy = appendToSection(
      prependToSection(
        read()
          .split("\n")
          .filter((l) => !l.trim().startsWith("<!-- uzys-harness:"))
          .join("\n"),
        "Project Context",
        "옛 설치본에 적어 둔 문단.",
      ),
      "Project Context",
      "안내 뒤에 적어 둔 문단.",
    );
    writeFileSync(agentsPath(), legacy);
    expect(legacy).not.toContain("uzys-harness:skills");
    expect(occurrences(legacy, SKILLS_HEADING), "대조군 — 옛 판에도 안내는 한 벌 있다").toBe(1);

    codex(baselineOf(first.ownership.files), { refreshOnly: true });
    const after = read();

    expect(section(after, "Project Context")).toContain("옛 설치본에 적어 둔 문단.");
    // 리뷰 B1 — 안내 *뒤*의 설치자 문단도 첫 update 를 넘긴다(옛 조각의 끝까지만 걷어낸다).
    expect(section(after, "Project Context")).toContain("안내 뒤에 적어 둔 문단.");
    expect(occurrences(after, SKILLS_HEADING)).toBe(1);
    // 이번 판부터 마커가 산다 — 다음 update 부터는 조각만 갈아 끼운다.
    expect(after).toContain("<!-- uzys-harness:skills:start -->");
    expect(after).toContain("<!-- uzys-harness:anchor:start -->");
  });

  it("codex + opencode 조합 — 뒤에 도는 transform 도 설치자 절을 이어받는다", () => {
    const first = codex(new Map());
    const edited = prependToSection(read(), "Project Context", "두 CLI 를 같이 쓴다.");
    writeFileSync(agentsPath(), edited);

    // installer 는 두 transform 사이에 기준선을 이어 준다(cli-transforms `absorb`).
    const base = new Map(baselineOf(first.ownership.files));
    const second = opencode(base, { refreshOnly: true });
    for (const f of second.ownership.files) base.set(f.path, f.sha256);

    expect(section(read(), "Project Context")).toContain("두 CLI 를 같이 쓴다.");
    // opencode 판이 자리를 차지해도(문서화된 동작) 룰 절은 살아 있다.
    expect(section(read(), "Harness Rules")).toContain("## Git Safety");

    codex(base, { refreshOnly: true });
    expect(section(read(), "Project Context")).toContain("두 CLI 를 같이 쓴다.");
  });

  it("편집이 없으면 아무것도 안 쓰고 백업도 안 만든다", () => {
    const first = codex(new Map());
    const before = read();

    const second = codex(baselineOf(first.ownership.files), { refreshOnly: true });

    expect(read()).toBe(before);
    expect(second.ownership.updated).toBe(0);
    expect(second.ownership.backupPaths).toEqual([]);
  });

  it("설치자가 절 헤딩을 지웠으면 스캐폴드를 되돌린다 (판정 불가 → 현재 동작 + 백업)", () => {
    const first = codex(new Map());
    writeFileSync(agentsPath(), "# 우리 팀 문서\n\n아무 절도 없다.\n");

    const second = codex(baselineOf(first.ownership.files), { refreshOnly: true });

    expect(read()).toContain("## Project Context");
    expect(second.ownership.backedUp).toContain("AGENTS.md");
    expect(second.ownership.backupPaths).toHaveLength(1);
  });
});

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * **npm 게시가 검증 통과에 배선돼 있는가.**
 *
 * 계기: v26.128.0~131.0 — `ci` 워크플로가 **4연속 red** 인데 npm 게시는 별개 워크플로라
 * 독립으로 성공했고, 그 사실을 **3릴리즈 동안 아무도 못 봤다**. `needs:` 는 GitHub Actions 에서
 * **같은 워크플로 파일 안의 job 사이에서만** 성립한다 — 다른 워크플로의 job 이름을 적으면
 * 배선이 아니라 오타이고, 조용히 무시된다. 그래서 "게시 job 을 검증 job 과 같은 파일에 두고
 * `needs:` 로 묶는다"가 정책이 아니라 **구조 조건**이다.
 *
 * 사용자 확정 검증 정책(2026-07-27): *배포(tag) — CI green 이 배포의 전제(`needs:`)*.
 *
 * ## 무엇을 함의로 걸었나 (파일 열거 금지)
 *
 * 단언 대상은 "`test.yml` 에 publish job 이 있다"가 **아니다** — 그건 파일 열거고, 다음에
 * 워크플로를 또 쪼개면 그대로 뚫린다(정확히 이번에 되돌린 그 구조다). 대신:
 *
 *   `.github/workflows/**` 를 **글롭으로 훑어** `npm publish` 를 실행하는 job 을 전부 찾고,
 *   그런 job 각각이 ⓐ **같은 파일 안의** 검증 job 에 `needs:` 로 묶여 있고
 *                  ⓑ 태그로 제한하는 `if:` 가드를 갖는다.
 *
 * ⓑ 를 별도 축으로 두는 이유: publish 를 CI 워크플로 안으로 들여온 **통합의 유일한 신규 위험**이
 * 여기다. 그 워크플로는 `workflow_dispatch` 를 갖고 있어서, 태그 가드가 없으면 **수동 CI 실행이
 * npm 게시를 딸려 돌린다.** 통합 전에는 없던 경로다.
 *
 * ## 판정을 넓게 잡은 곳
 *
 * - **선행 job 은 전이적으로 본다** — `publish → build → ci` 처럼 한 다리 건너 묶여도 통과.
 *   직접 `needs` 만 보면 정상 배선을 위반으로 잡는다.
 * - **검증의 정의는 `npm run ci` 하나로 고정하지 않는다**(`npm test` · `vitest` 등도 인정).
 *   스크립트 이름은 리포마다 다르고, 이 게이트가 지키는 것은 이름이 아니라 **배선**이다.
 *
 * ## YAML 파싱
 *
 * 리포에 YAML 파서 의존성이 없다(`package.json` — `@clack/prompts` · `cac` 뿐). 게이트 하나
 * 때문에 의존성을 들이지 않고, 워크플로 스키마에서 **필요한 만큼만** 읽는 들여쓰기 기반 미니
 * 파서를 쓴다. 한계는 파일 끝 §한계 주석에 적었다 — 한계를 모르면 초록불을 오독한다.
 */

const REPO_ROOT = resolve(__dirname, "..");
const WORKFLOW_DIR = join(REPO_ROOT, ".github/workflows");

// ── 미니 파서 ──────────────────────────────────────────────────────────────────

/** 주석 줄 제거. 산문이 `npm publish` 를 언급해도 실행으로 오인하지 않기 위한 전처리. */
function strippedLines(text: string): string[] {
  return text.split("\n").filter((l) => !/^\s*#/.test(l));
}

interface Job {
  workflow: string;
  id: string;
  /** job 키 줄부터 다음 job 직전까지 (주석 제거본). */
  lines: string[];
  needs: string[];
  ifExpr: string;
}

/** `jobs:` 블록의 줄 범위. 다음 **최상위 키**(들여쓰기 0)에서 끝난다. */
function jobsBlockRange(lines: string[]): [number, number] | null {
  const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i += 1) {
    const l = lines[i] ?? "";
    if (l.trim() !== "" && !/^\s/.test(l)) return [start + 1, i];
  }
  return [start + 1, lines.length];
}

/** 들여쓰기 폭. 탭은 YAML 에서 불법이라 공백만 센다. */
function indentOf(line: string): number {
  return (line.match(/^ */)?.[0] ?? "").length;
}

/** 블록 안 비어 있지 않은 줄의 최소 들여쓰기 = 그 레벨의 키 들여쓰기. */
function keyIndent(lines: string[]): number {
  const widths = lines.filter((l) => l.trim() !== "").map(indentOf);
  return widths.length > 0 ? Math.min(...widths) : 0;
}

/** `needs: a` · `needs: [a, b]` · `needs:` + `- a` 세 형태를 모두 읽는다. */
function parseNeeds(body: string[], level: number): string[] {
  const unquote = (s: string): string => s.trim().replace(/^["']|["']$/g, "");
  for (let i = 0; i < body.length; i += 1) {
    const m = (body[i] ?? "").match(/^( *)needs:\s*(.*)$/);
    if (!m || (m[1] ?? "").length !== level) continue;
    const inline = (m[2] ?? "").trim();
    if (inline.startsWith("[")) {
      return inline
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map(unquote)
        .filter((s) => s !== "");
    }
    if (inline !== "") return [unquote(inline)];
    const out: string[] = [];
    for (let j = i + 1; j < body.length; j += 1) {
      const s = body[j] ?? "";
      if (s.trim() === "") continue;
      const im = s.match(/^( *)-\s*(.+)$/);
      if (!im || (im[1] ?? "").length <= level) break;
      out.push(unquote(im[2] ?? ""));
    }
    return out;
  }
  return [];
}

/** job 레벨 `if:`. 블록 스칼라(`if: >-`)면 뒤따르는 깊은 들여쓰기 줄을 이어 붙인다. */
function parseIf(body: string[], level: number): string {
  for (let i = 0; i < body.length; i += 1) {
    const m = (body[i] ?? "").match(/^( *)if:\s*(.*)$/);
    if (!m || (m[1] ?? "").length !== level) continue;
    const inline = (m[2] ?? "").trim();
    if (inline !== "" && !/^[|>]/.test(inline)) return inline;
    const out: string[] = [];
    for (let j = i + 1; j < body.length; j += 1) {
      const s = body[j] ?? "";
      if (s.trim() === "") continue;
      if (indentOf(s) <= level) break;
      out.push(s.trim());
    }
    return out.join(" ");
  }
  return "";
}

function parseJobs(workflow: string, text: string): Job[] {
  const lines = strippedLines(text);
  const range = jobsBlockRange(lines);
  if (!range) return [];
  const block = lines.slice(range[0], range[1]);
  const jobLevel = keyIndent(block);
  const heads: Array<{ id: string; at: number }> = [];
  block.forEach((l, i) => {
    const m = l.match(/^( *)([A-Za-z0-9_.-]+):\s*$/);
    if (m && (m[1] ?? "").length === jobLevel) heads.push({ id: m[2] ?? "", at: i });
  });
  return heads.map((h, i) => {
    const end = heads[i + 1]?.at ?? block.length;
    const jobLines = block.slice(h.at, end);
    const body = jobLines.slice(1);
    const level = keyIndent(body);
    return {
      workflow,
      id: h.id,
      lines: jobLines,
      needs: parseNeeds(body, level),
      ifExpr: parseIf(body, level),
    };
  });
}

// ── 판정 술어 ─────────────────────────────────────────────────────────────────

/**
 * 이 job 이 npm 게시를 **실행**하는가. `name:` 값은 실행이 아니므로 뺀다 — 안 빼면
 * `name: npm publish (...)` 만 있는 job 도 게시로 잡혀 무고한 워크플로가 빨간불이 된다.
 */
function publishesToNpm(job: Job): boolean {
  const executable = job.lines.filter((l) => !/^\s*-?\s*name:/.test(l)).join("\n");
  return /\bnpm\s+publish\b/.test(executable) || /uses:\s*\S*npm-publish/.test(executable);
}

/** 선행 job 이 "실제 검증을 돌린다"의 정의. 스크립트 이름을 하나로 못박지 않는다. */
function runsVerification(job: Job): boolean {
  return /\bnpm\s+run\s+ci\b|\bnpm\s+(?:run\s+)?test\b|\bnpm\s+run\s+test:coverage\b|\bvitest\b/.test(
    job.lines.join("\n"),
  );
}

/**
 * 태그로 제한하는가. `github.ref` 를 태그로 좁히는 관용 표현 셋을 인정한다.
 * `if:` 가 아예 없거나 태그와 무관한 조건이면 위반 — `workflow_dispatch` 수동 실행이 게시를 낸다.
 */
function guardsOnTag(ifExpr: string): boolean {
  return (
    /startsWith\s*\(\s*github\.ref\s*,\s*['"]refs\/tags\//.test(ifExpr) ||
    /github\.ref_type\s*==\s*['"]tag['"]/.test(ifExpr) ||
    /github\.ref\s*==\s*['"]refs\/tags\//.test(ifExpr)
  );
}

/** 같은 파일 안에서 `needs:` 를 따라 도달 가능한 선행 job 전부 (전이 폐포). */
function upstreamJobs(job: Job, sameFile: Job[]): Job[] {
  const byId = new Map(sameFile.map((j) => [j.id, j]));
  const seen = new Set<string>();
  const queue = [...job.needs];
  const out: Job[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (seen.has(id)) continue;
    seen.add(id);
    const next = byId.get(id); // 다른 워크플로의 job 이름이면 여기서 못 찾는다 = 배선 아님
    if (!next) continue;
    out.push(next);
    queue.push(...next.needs);
  }
  return out;
}

// ── 게이트 ────────────────────────────────────────────────────────────────────

type Axis = "needs" | "verify" | "tag-guard";

interface Violation {
  workflow: string;
  job: string;
  axis: Axis;
  detail: string;
}

function workflowFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort();
}

function allJobs(dir: string): Job[] {
  return workflowFiles(dir).flatMap((f) => parseJobs(f, readFileSync(join(dir, f), "utf8")));
}

function publishJobs(dir: string): Job[] {
  return allJobs(dir).filter(publishesToNpm);
}

function findViolations(dir: string): Violation[] {
  const jobs = allJobs(dir);
  const violations: Violation[] = [];
  for (const job of jobs.filter(publishesToNpm)) {
    const sameFile = jobs.filter((j) => j.workflow === job.workflow);
    const upstream = upstreamJobs(job, sameFile);
    if (upstream.length === 0) {
      violations.push({
        workflow: job.workflow,
        job: job.id,
        axis: "needs",
        detail:
          job.needs.length === 0
            ? "`needs:` 가 없다 — 게시가 검증과 독립으로 돈다"
            : `\`needs: ${job.needs.join(", ")}\` 가 **같은 워크플로 파일 안에서** 해석되지 않는다 ` +
              "— 다른 워크플로의 job 이름은 needs 로 성립하지 않고 조용히 무시된다",
      });
    } else if (!upstream.some(runsVerification)) {
      violations.push({
        workflow: job.workflow,
        job: job.id,
        axis: "verify",
        detail: `선행 job(${upstream.map((j) => j.id).join(", ")})이 검증을 돌리지 않는다 — 배선은 있으나 무는 것이 없다`,
      });
    }
    if (!guardsOnTag(job.ifExpr)) {
      violations.push({
        workflow: job.workflow,
        job: job.id,
        axis: "tag-guard",
        detail:
          job.ifExpr === ""
            ? "job 레벨 `if:` 가 없다 — workflow_dispatch 수동 실행이 npm 게시를 딸려 돌린다"
            : `\`if: ${job.ifExpr}\` 가 github.ref 를 태그로 제한하지 않는다`,
      });
    }
  }
  return violations;
}

function render(violations: Violation[]): string[] {
  return violations.map((v) => `${v.workflow} > ${v.job} [${v.axis}] ${v.detail}`);
}

// ── 변이 픽스처 (입력 변이) ───────────────────────────────────────────────────

/**
 * `변이 테스트` = **입력 변이** (이 리포 확정 어휘). 이 게이트의 입력은 워크플로 YAML 이므로
 * 세 가지 파손을 **temp dir 사본**에 만들어 게이트가 실제로 무는지 본다. 리포의 실제
 * `.github/` 는 건드리지 않는다.
 *
 * 픽스처를 손으로 쓰지 않고 **실제 파일에서 파생**하는 이유: 손으로 쓴 YAML 은 게이트가 그것만
 * 물고 진짜 파일은 못 무는 상태를 못 걸러낸다.
 */
type Mutation = "drop-needs" | "drop-tag-guard" | "split-workflow";

const tempDirs: string[] = [];

function mutatedDir(mutation: Mutation): string {
  const dir = mkdtempSync(join(tmpdir(), `ch-wf-${mutation}-`));
  tempDirs.push(dir);
  const host = publishJobs(WORKFLOW_DIR)[0]?.workflow;
  if (!host) throw new Error("게시 job 을 못 찾아 변이 픽스처를 만들 수 없다");
  for (const f of workflowFiles(WORKFLOW_DIR)) {
    const raw = readFileSync(join(WORKFLOW_DIR, f), "utf8");
    if (f !== host) {
      writeFileSync(join(dir, f), raw);
      continue;
    }
    applyMutation(dir, f, raw, mutation);
  }
  return dir;
}

function applyMutation(dir: string, host: string, raw: string, mutation: Mutation): void {
  const lines = strippedLines(raw);
  if (mutation === "drop-needs") {
    writeFileSync(join(dir, host), lines.filter((l) => !/^ +needs:/.test(l)).join("\n"));
    return;
  }
  if (mutation === "drop-tag-guard") {
    writeFileSync(join(dir, host), lines.filter((l) => !/^ +if:.*github\.ref/.test(l)).join("\n"));
    return;
  }
  // split-workflow — 되돌리기 전 구조. 게시 job 을 **다른 파일**로 옮긴다.
  const jobs = parseJobs(host, raw);
  const target = jobs.find(publishesToNpm);
  if (!target) throw new Error(`${host} 에서 게시 job 을 못 찾았다`);
  const block = target.lines.join("\n");
  writeFileSync(join(dir, host), lines.filter((l) => !target.lines.includes(l)).join("\n"));
  writeFileSync(
    join(dir, "zz-publish.yml"),
    `name: publish\non:\n  push:\n    tags: ["v*"]\njobs:\n${block}\n`,
  );
}

// ── 테스트 ────────────────────────────────────────────────────────────────────

describe("npm 게시가 검증에 배선돼 있는가 (needs: + 태그 가드)", () => {
  afterAll(() => {
    for (const d of tempDirs) rmSync(d, { recursive: true, force: true });
  });

  it("워크플로 파일과 job 을 실제로 읽는다 (헛통과 차단)", () => {
    // 파싱이 죽으면 "게시 job 0개 → 위반 0" 으로 조용히 초록이 된다. 초록불이 무는지부터 확인한다.
    const files = workflowFiles(WORKFLOW_DIR);
    expect(files.length, `${WORKFLOW_DIR} 에서 워크플로 파일을 하나도 못 읽었다`).toBeGreaterThan(
      0,
    );
    const jobs = allJobs(WORKFLOW_DIR);
    expect(
      jobs.length,
      "미니 파서가 job 을 하나도 못 뽑았다 — YAML 레이아웃이 바뀌었다",
    ).toBeGreaterThan(files.length);
    // 파서가 `needs:` 를 실제로 읽는지 — 이 축이 죽으면 needs 판정이 전부 공허해진다.
    expect(jobs.some((j) => j.needs.length > 0)).toBe(true);
  });

  it("`npm publish` 를 실행하는 job 을 1개 이상 찾는다 (헛통과 차단)", () => {
    // 0개를 찾고 "위반 0" 으로 통과하는 형태를 막는다. 게시 경로가 사라졌다면 그것도 사건이다.
    const found = publishJobs(WORKFLOW_DIR);
    expect(
      found.map((j) => `${j.workflow} > ${j.id}`),
      "npm 게시를 실행하는 job 을 못 찾았다 — 탐지기가 죽었거나 게시 경로가 사라졌다. " +
        "어느 쪽이든 이 게이트는 아무것도 안 보고 있다.",
    ).not.toEqual([]);
  });

  it("게시 job 은 같은 워크플로 안의 검증 job 에 needs: 로 묶여 있다", () => {
    const bad = findViolations(WORKFLOW_DIR).filter((v) => v.axis !== "tag-guard");
    expect(
      render(bad),
      "npm 게시가 검증 통과에 묶여 있지 않다. `needs:` 는 **같은 워크플로 파일 안**에서만\n" +
        "성립한다 — 다른 워크플로의 job 이름을 적으면 조용히 무시되고, 그 상태가 정확히\n" +
        "v26.128.0~131.0(ci 4연속 red + npm 게시 성공)을 만들었다.\n" +
        render(bad)
          .map((l) => `  ${l}`)
          .join("\n"),
    ).toEqual([]);
  });

  it("게시 job 은 태그 push 로 제한된다 — 수동 실행이 게시를 내면 안 된다", () => {
    const bad = findViolations(WORKFLOW_DIR).filter((v) => v.axis === "tag-guard");
    expect(
      render(bad),
      "게시 job 에 태그 가드가 없다. 게시를 CI 워크플로 안으로 들여온 **통합의 유일한 신규\n" +
        "위험**이 여기다 — 그 워크플로는 workflow_dispatch 를 갖고 있어서, 가드가 없으면\n" +
        "수동 CI 실행 한 번이 npm 게시를 딸려 돌린다.\n" +
        render(bad)
          .map((l) => `  ${l}`)
          .join("\n"),
    ).toEqual([]);
  });

  // ── 변이 3종 — 게이트가 실제로 무는지 (초록불이 무는지부터 확인한다) ──────────

  it("변이 1: `needs:` 를 지우면 문다", () => {
    const found = findViolations(mutatedDir("drop-needs"));
    expect(found.map((v) => v.axis)).toContain("needs");
    expect(found.find((v) => v.axis === "needs")?.detail).toContain("`needs:` 가 없다");
  });

  it("변이 2: 태그 가드 `if:` 를 지우면 문다", () => {
    const found = findViolations(mutatedDir("drop-tag-guard"));
    expect(found.map((v) => v.axis)).toContain("tag-guard");
    // needs 축은 멀쩡해야 한다 — 변이가 엉뚱한 축을 건드렸다면 이 canary 는 증거가 아니다.
    expect(found.map((v) => v.axis)).not.toContain("needs");
  });

  it("변이 3: 게시 job 을 다른 워크플로 파일로 옮기면 문다 (되돌리기 전 구조)", () => {
    const dir = mutatedDir("split-workflow");
    // 픽스처가 실제로 쪼개졌는지 먼저 — 안 쪼개졌으면 아래 단언이 다른 이유로 통과한다.
    expect(publishJobs(dir).map((j) => j.workflow)).toEqual(["zz-publish.yml"]);
    const found = findViolations(dir);
    expect(found.map((v) => v.axis)).toContain("needs");
    expect(found.find((v) => v.axis === "needs")?.detail).toContain(
      "같은 워크플로 파일 안에서** 해석되지 않는다",
    );
  });
});

/**
 * ## 한계 (초록불을 오독하지 않기 위해)
 *
 * 1. **미니 파서다.** 인정하는 형태는 이 리포의 워크플로가 실제로 쓰는 범위 —
 *    공백 들여쓰기, `jobs:` 최상위 키, job 키가 단독 줄(`id:`). YAML 앵커/머지 키(`<<:`),
 *    흐름 매핑(`{a: b}`) 으로 쓴 job, 재사용 워크플로 호출(`uses:` job)은 못 읽는다.
 *    그 형태가 도입되면 이 게이트는 job 을 **못 보고 조용히 통과**하므로, 위 "헛통과 차단"
 *    두 케이스(파일 수 · 게시 job 1개 이상)가 마지막 방어선이다.
 * 2. **`npm publish` 문자열 탐지다.** 게시를 셸 변수·별도 스크립트(`bash scripts/release.sh`)로
 *    감싸면 못 문다. 그때는 그 스크립트가 새 서식지다.
 * 3. **`needs:` 가 있다 ≠ 그 job 이 green 이어야 한다.** `if: always()` 같은 조건을 선행 job 이
 *    아니라 **게시 job 에** 붙이면 red 여도 돌 수 있다. 이 게이트는 그것까지 보지 않는다
 *    (현재 그런 표현은 없다). 도입되면 `guardsOnTag` 옆에 축을 하나 더 세워야 한다.
 * 4. **레지스트리 게시의 다른 경로**(수동 `npm publish`, 다른 CI 서비스)는 대상 밖이다.
 *    이 게이트는 `.github/workflows/**` 만 훑는다.
 */

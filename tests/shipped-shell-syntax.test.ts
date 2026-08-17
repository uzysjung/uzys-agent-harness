import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { listFilesRecursive } from "../src/fs-ops.js";

/**
 * 배포물의 **셸 건전성** 게이트 (#327).
 *
 * WHY: `# WRITE` 주석을 줄이음(`\`) 뒤에 붙여 **배포될 `gh` 명령을 깨뜨렸다**. 붙여넣으면
 *   마일스톤이 `due_on` 없이 만들어지고 다음 줄이 `-f: command not found` 로 죽는다. 그때
 *   `npm run ci` 는 100 files / 1,501 tests 전부 초록이었다 — **아무 게이트도 안 물었다.**
 *   같은 사이클의 결함 6건이 전부 독립 리뷰어에게만 잡혔고 자기검증은 0건이었다.
 *
 * **검사가 둘인 이유** — 하나로는 위 결함을 못 잡는다(2026-08-17 실측):
 *   ① `bash -n` = 문법 오류. 따옴표 불균형 · `if`/`fi` 누락 등.
 *   ② 줄이음 위생 = 줄 끝 `\` 뒤에 공백/주석이 오는 것. bash 는 이것을 "공백 한 칸짜리
 *      인자 + 주석"으로 **문법상 합법**하게 읽어 `bash -n` 이 **exit 0 으로 통과시킨다.**
 *      사고가 정확히 이 형태였으므로 ② 가 없으면 이 게이트는 장식이다.
 *
 * 대상은 **글롭으로 모은다**(열거 금지 — 열거는 두 번째 하드코딩 사본이 되어 썩는다):
 * `templates/**` 의 셸 스크립트 전부 + 마크다운의 bash 코드펜스 전부. 파일이 늘면 게이트를
 * 고치지 않아도 따라온다.
 *
 * **한계를 정직하게**: 문법과 줄이음만 본다. 명령이 *옳은 일을 하는지*, 플래그가 실재하는지,
 * 런타임에 성공하는지는 못 본다. 개발 사본(`.claude/`)도 대상이 아니다 — 배포되는 것은
 * `templates/` 뿐이라 여기를 문다.
 */

const TEMPLATES = resolve(__dirname, "../templates");

/** 코드펜스. 들여쓴 펜스(리스트 안 등)도 잡도록 여는 줄의 들여쓰기를 역참조한다. */
const FENCE = /^([ \t]*)```([^\n`]*)\n([\s\S]*?)^\1```[ \t]*$/gm;
const SHELL_LANGS = new Set(["bash", "sh", "shell"]);

/**
 * `<이름>` 같은 **문서 플레이스홀더**는 bash 문법이 아니다 — 치환하지 않으면 정상 스니펫이
 * 전부 오탐된다(첫 검사기가 `<N>` 을 문법 오류로 잡아 폐기됐다).
 * 셸 메타문자를 제외해 `<<'EOF'` · `<(cmd)` · `[[ "$a" < "$b" ]]` 는 건드리지 않는다.
 * 치환어에 줄바꿈이 없어 **행 번호가 보존된다** — 오류 위치를 원문 좌표로 되돌릴 수 있다.
 */
const DOC_PLACEHOLDER = /<[^<>\n(){}$&|;"'`\\]+>/g;

/** 줄 끝 `\` 뒤에 공백(그리고 주석)이 오면 이음이 끊긴다. `\` 가 줄의 마지막이어야 한다. */
const DANGLING_CONTINUATION = /\\[ \t]+(#.*)?$/;

type Kind = "script" | "fence";

interface Snippet {
  /** `templates/...` 상대 경로. 실패 메시지가 클릭 가능해야 한다. */
  readonly file: string;
  readonly kind: Kind;
  /** 원문에서 이 스니펫의 첫 줄이 몇 번째 줄인가 (1-based). */
  readonly startLine: number;
  readonly source: string;
}

function collectSnippets(): Snippet[] {
  const out: Snippet[] = [];
  for (const rel of listFilesRecursive(TEMPLATES)) {
    const abs = join(TEMPLATES, rel);
    if (rel.endsWith(".sh")) {
      out.push({
        file: `templates/${rel}`,
        kind: "script",
        startLine: 1,
        source: readFileSync(abs, "utf8"),
      });
      continue;
    }
    if (!rel.endsWith(".md")) continue;

    const md = readFileSync(abs, "utf8");
    FENCE.lastIndex = 0;
    let m: RegExpExecArray | null = FENCE.exec(md);
    while (m !== null) {
      const lang = (m[2] ?? "").trim().toLowerCase();
      if (SHELL_LANGS.has(lang)) {
        const indent = m[1] ?? "";
        const body = (m[3] ?? "")
          .split("\n")
          .map((line) => (line.startsWith(indent) ? line.slice(indent.length) : line))
          .join("\n");
        // 여는 ``` 줄의 번호 + 1 = 본문 첫 줄.
        const openLine = md.slice(0, m.index).split("\n").length;
        out.push({
          file: `templates/${rel}`,
          kind: "fence",
          startLine: openLine + 1,
          source: body,
        });
      }
      m = FENCE.exec(md);
    }
  }
  return out;
}

/**
 * `bash -n` 을 stdin 으로 돌린다(임시 파일 없음 — 고정 경로 금지 규약).
 * 반환: 문법 오류 메시지, 없으면 `null`.
 * **bash 를 못 돌리면 통과가 아니라 예외다** — 실행되지 않은 검사는 증거가 아니다.
 */
function bashSyntaxError(script: string): string | null {
  const run = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
  if (run.error) throw new Error(`bash 실행 실패 — 이 게이트는 신뢰 불가: ${run.error.message}`);
  if (run.status === null) throw new Error(`bash 가 시그널로 죽었다(${run.signal}) — 신뢰 불가`);
  if (run.status === 0) return null;
  return (run.stderr ?? "").trim() || `bash -n exit ${run.status}`;
}

/** `bash: line 7: ...` 의 상대 행 번호를 원문 절대 행 번호로 되돌린다. */
function reanchorLines(stderr: string, startLine: number): string {
  return stderr.replace(/line (\d+):/g, (_all, n: string) => `line ${Number(n) + startLine - 1}:`);
}

function danglingContinuations(snippet: Snippet): string[] {
  return snippet.source
    .split("\n")
    .map((line, i) => ({ line, at: snippet.startLine + i }))
    .filter(({ line }) => DANGLING_CONTINUATION.test(line))
    .map(({ line, at }) => `${snippet.file}:${at}\n    ${line}`);
}

const SNIPPETS = collectSnippets();
const SCRIPTS = SNIPPETS.filter((s) => s.kind === "script");
const FENCES = SNIPPETS.filter((s) => s.kind === "fence");

describe("배포물 셸 건전성 (#327)", () => {
  it("탐지기가 실제로 무는지 — 알려진 양성·음성 대조", () => {
    // ① bash -n: 초록으로 태어난 게이트는 증거가 아니다. 먼저 물리는 것을 보인다.
    expect(bashSyntaxError("if true; then\n")).not.toBeNull();
    expect(bashSyntaxError("echo ok\n")).toBeNull();

    // ② 줄이음: 사고 재현형이 잡히고, 정상형·이스케이프 공백은 통과해야 한다.
    const dangling = (line: string): boolean => DANGLING_CONTINUATION.test(line);
    expect(dangling('gh api repos/x/milestones -f title="Y" \\  # WRITE — 생성')).toBe(true);
    expect(dangling("gh api repos/x/milestones \\ ")).toBe(true);
    expect(dangling('gh api repos/x/milestones -f title="Y" \\')).toBe(false);
    expect(dangling("cp my\\ file.txt dest/")).toBe(false);

    // ①이 ②를 대신하지 못한다는 사실 자체를 못박는다 — 이게 검사가 둘인 유일한 이유다.
    expect(bashSyntaxError('gh api x \\  # WRITE\n  -f due_on="Z"\n')).toBeNull();
  });

  it("플레이스홀더 치환이 오탐을 없애되 진짜 오류는 남긴다", () => {
    const withPlaceholders = "gh issue edit <N> --parent <EPIC>\ngh project list --owner <owner>\n";
    expect(bashSyntaxError(withPlaceholders)).not.toBeNull(); // 치환 전에는 오탐
    expect(bashSyntaxError(withPlaceholders.replace(DOC_PLACEHOLDER, "PLACEHOLDER"))).toBeNull();

    // 치환이 진짜 문법 오류를 삼키면 안 된다.
    const reallyBroken = 'gh issue edit <N> --parent "<EPIC>\n';
    expect(bashSyntaxError(reallyBroken.replace(DOC_PLACEHOLDER, "PLACEHOLDER"))).not.toBeNull();

    // 셸 메타문자를 쓰는 형태는 플레이스홀더가 아니다 — 건드리면 의미가 바뀐다.
    expect("diff <(sort a) <(sort b)".replace(DOC_PLACEHOLDER, "PLACEHOLDER")).toBe(
      "diff <(sort a) <(sort b)",
    );
    expect("cat <<'EOF'".replace(DOC_PLACEHOLDER, "PLACEHOLDER")).toBe("cat <<'EOF'");
  });

  it("수집기가 살아 있다 — 0건 통과 방지", () => {
    // 하한은 수집기 회귀(펜스 정규식 파손 → 0건 수집 → 전부 통과)를 잡기 위한 것이지
    // 현재 개수의 사본이 아니다. 실측 2026-08-17: 스크립트 18 · 펜스 49.
    // 검사한 **실제 개수**는 아래 테스트들의 이름에 실려 매 실행 출력에 남는다.
    expect(SCRIPTS.length).toBeGreaterThanOrEqual(10);
    expect(FENCES.length).toBeGreaterThanOrEqual(30);
  });

  it(`배포되는 셸 스크립트 ${SCRIPTS.length}개가 bash 문법을 통과한다`, () => {
    const failures = SCRIPTS.flatMap((s) => {
      const err = bashSyntaxError(s.source);
      return err === null ? [] : [`${s.file}\n    ${reanchorLines(err, s.startLine)}`];
    });
    expect(failures, `문법 오류 ${failures.length}건 / 검사 ${SCRIPTS.length}개`).toEqual([]);
  });

  it(`문서의 bash 코드펜스 ${FENCES.length}개가 bash 문법을 통과한다`, () => {
    const failures = FENCES.flatMap((s) => {
      const err = bashSyntaxError(s.source.replace(DOC_PLACEHOLDER, "PLACEHOLDER"));
      return err === null
        ? []
        : [`${s.file}:${s.startLine}\n    ${reanchorLines(err, s.startLine)}`];
    });
    expect(failures, `문법 오류 ${failures.length}건 / 검사 ${FENCES.length}개`).toEqual([]);
  });

  it(`줄이음(\\) 뒤에 아무것도 오지 않는다 — 스니펫 ${SNIPPETS.length}개`, () => {
    const failures = SNIPPETS.flatMap(danglingContinuations);
    expect(failures, `끊긴 줄이음 ${failures.length}건 / 검사 ${SNIPPETS.length}개`).toEqual([]);
  });
});

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
 * **검사가 둘이고, 범위가 서로 다른 이유**:
 *   ① `bash -n` = 문법 오류(따옴표 불균형 · `if`/`fi` 누락). **셸로 표시된 것만** 대상이다 —
 *      python 펜스를 bash 로 파싱하면 전부 red 가 된다.
 *   ② 줄이음 위생 = 줄 끝 `\` 뒤에 공백/주석이 오는 것. bash 는 이것을 "공백 한 칸짜리 인자 +
 *      주석"으로 **문법상 합법**하게 읽어 ①이 **exit 0 으로 통과시킨다**(실측). 사고가 정확히 이
 *      형태였으므로 ②가 없으면 이 게이트는 장식이다. ②는 파서가 필요 없으므로 **언어 표시와
 *      무관하게 모든 코드펜스**에 건다 — 게이트 범위가 *작성자가 붙인 라벨*에 걸려 있으면
 *      라벨을 빠뜨린 사람이 곧 실수한 사람이라 사고 원형이 그대로 빠져나간다.
 *      (이 범위는 아래 "비-셸 펜스도 모집단에 있다" 단언이 고정한다. 그게 없으면 다음 사람이
 *      셸 전용으로 좁혀도 전 스위트가 초록으로 살아남는다 — 실제로 변이가 생존했다.)
 *
 * 대상은 **글롭으로 모은다**(열거 금지 — 열거는 두 번째 하드코딩 사본이 되어 썩는다):
 * `templates/**` 의 셸 스크립트 전부 + 마크다운 코드펜스 전부. 파일이 늘면 게이트를 고치지
 * 않아도 따라온다.
 *
 * **알려진 한계**(정직하게 — 이 줄들이 없으면 다음 사람이 덮인다고 오해한다):
 *   - `bash -n` 은 **문법**만 본다. 명령이 옳은 일을 하는지, 플래그가 실재하는지는 못 본다.
 *   - 플레이스홀더 치환은 `<a>` 처럼 **공백 없이 짝이 맞는 꺾쇠**를 한 토큰으로 만든다. 그 구간
 *     안에 있던 진짜 문법 파손은 함께 삼켜진다(아래 테스트로 박제). 더 좁히면 실제
 *     플레이스홀더 오탐이 부활해 여기서 멈췄다.
 *   - 줄이음 검사는 줄 단위라 **리터럴 본문**이 `\` + 공백으로 끝나면 오탐한다 — 인용
 *     heredoc(`<<'EOF'`) 안, 또는 ```text 펜스의 LaTeX 줄바꿈(`\\  `) 같은 것. 코퍼스엔 없다.
 *     red 를 만나면 게이트 파손이 아니라 이 한계다.
 *   - 다른 펜스 **안에 중첩된** 펜스는 마크다운 리터럴 예시로 보고 세지 않는다(CommonMark).
 *     실제로 1건 있다(`skills/eval-harness/SKILL.md` 의 4-백틱 블록 안 `bash`) — 그 명령은
 *     `bash -n` 밖이다. 줄이음은 바깥 펜스 본문으로 계속 검사된다.
 *   - 개발 사본(`.claude/`)은 대상이 아니다 — 배포되는 것은 `templates/` 뿐이라 여기를 문다.
 *   - `bash -n` 은 **로컬 bash 버전**을 따른다(macOS 기본은 3.2). bash 4+ 전용 문법은 Linux 에서
 *     통과하고 macOS 에서 red 다. 릴리즈 CI 가 ubuntu + macos 양쪽을 돌아 태그 시점에 갈린다.
 */

const TEMPLATES = resolve(__dirname, "../templates");

/**
 * `bash -n` 으로 검사할 언어 표시. **`bash -n` 이 실제로 파싱할 수 있는 것만** 넣는다 —
 * 예컨대 `zsh` 는 `for f (a b) echo $f` 처럼 bash 가 거부하는 문법이 정상이라, 넣으면
 * 쓰는 데도 없이 오탐 경로만 생긴다.
 */
const SHELL_LANGS = new Set(["bash", "sh", "shell"]);

/**
 * `<이름>` 같은 **문서 플레이스홀더**는 bash 문법이 아니다 — 치환하지 않으면 정상 스니펫이
 * 전부 오탐된다(첫 검사기가 `<N>` 을 문법 오류로 잡아 폐기됐다).
 *
 * 셸 메타문자를 제외해 `<<'EOF'` · `<(cmd)` · `[[ "$a" < "$b" ]]` 를 건드리지 않고,
 * **꺾쇠 안쪽 양끝의 공백을 금지**해 `cat < in.txt >` 같은 리다이렉션 쌍을 삼키지 않는다
 * (`<한 줄>` 처럼 *가운데* 공백이 든 실제 플레이스홀더는 그대로 잡힌다).
 * 치환어에 줄바꿈이 없어 **행 번호가 보존된다** — 오류 위치를 원문 좌표로 되돌릴 수 있다.
 */
const DOC_PLACEHOLDER = /<(?![ \t])[^<>\n(){}$&|;"'`\\]+(?<![ \t])>/g;

/** 줄 끝 `\` 뒤에 공백(그리고 주석)이 오면 이음이 끊긴다. `\` 가 줄의 마지막이어야 한다. */
const DANGLING_CONTINUATION = /\\[ \t]+(#.*)?$/;

/** 여는 펜스: 들여쓰기 + ``` 또는 ~~~ 3개 이상 + info string. */
const FENCE_OPEN = /^([ \t]*)(`{3,}|~{3,})[ \t]*(.*)$/;

type Kind = "script" | "fence";

interface Snippet {
  /** `templates/...` 상대 경로. 실패 메시지가 클릭 가능해야 한다. */
  readonly file: string;
  readonly kind: Kind;
  /** 원문에서 이 스니펫의 첫 줄이 몇 번째 줄인가 (1-based). */
  readonly startLine: number;
  /** 셸로 표시된 펜스인가. `bash -n` 대상 여부를 가른다. 스크립트는 항상 true. */
  readonly isShell: boolean;
  readonly source: string;
}

interface Scan {
  readonly fences: Snippet[];
  /**
   * 닫히지 않은 펜스. **조용히 버리면 그 뒤의 스니펫까지 통째로 사라진다** — 닫는 걸 깜빡한
   * ```text 하나가 뒤따르는 정상 `bash` 펜스를 본문으로 흡수해 게이트를 초록으로 만든다.
   * 그래서 버리지 않고 모아 실패로 낸다.
   */
  readonly unclosed: string[];
}

/**
 * 코드펜스를 **줄 단위 상태머신**으로 모은다. 정규식 한 방으로 뽑으면 중첩 펜스(4-백틱 안의
 * 3-백틱)와 `~~~`·info string 을 틀리게 센다 — 커버리지가 그 오차만큼 새는 자리다.
 * 닫는 펜스 규칙(CommonMark): 여는 것과 **같은 문자 · 길이 이상 · info string 없음**.
 *
 * 줄 분해에 `\r?\n` 을 쓴다. `\n` 으로만 쪼개면 CRLF 파일의 모든 줄 끝에 `\r` 이 남아
 * 여는 펜스부터 매치되지 않고 **파일 전체가 게이트에서 조용히 사라진다**(실제로 그랬다).
 */
function scanFences(file: string, md: string): Scan {
  const fences: Snippet[] = [];
  const unclosed: string[] = [];
  const lines = md.split(/\r?\n/);
  let open: { indent: string; marker: string; lang: string; bodyStart: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (open === null) {
      const m = FENCE_OPEN.exec(line);
      if (m === null) continue;
      const marker = m[2] ?? "";
      const info = (m[3] ?? "").trim();
      // 백틱 펜스의 info string 에는 백틱이 올 수 없다(CommonMark) — 인라인 코드와의 구분.
      if (marker.startsWith("`") && info.includes("`")) continue;
      // `bash title="x"` 처럼 info 가 여러 토큰이면 **첫 토큰**이 언어다.
      const lang = (info.split(/[ \t]/)[0] ?? "").toLowerCase();
      open = { indent: m[1] ?? "", marker, lang, bodyStart: i + 1 };
      continue;
    }
    const fenceChar = open.marker.startsWith("`") ? "`" : "~";
    const closing = new RegExp(`^[ \\t]*${fenceChar}{${open.marker.length},}[ \\t]*$`);
    if (!closing.test(line)) continue;
    const indent = open.indent;
    fences.push({
      file,
      kind: "fence",
      startLine: open.bodyStart + 1,
      isShell: SHELL_LANGS.has(open.lang),
      source: lines
        .slice(open.bodyStart, i)
        .map((l) => (l.startsWith(indent) ? l.slice(indent.length) : l))
        .join("\n"),
    });
    open = null;
  }
  if (open !== null) unclosed.push(`${file}:${open.bodyStart}`);
  return { fences, unclosed };
}

/**
 * 미닫힘 목록을 **반환값으로** 낸다. 모듈 레벨 가변 배열에 밀어 넣으면 "순수 함수로 바꾸자"는
 * 아주 자연스러운 정리 한 번에 배선이 끊기고, 그때 코퍼스 단언은 `[] === []` 가 되어 조용히
 * 통과한다(변이 생존 확인). 배선이 값 흐름 위에 있으면 끊기 어렵다.
 */
function collectSnippets(
  root: string = TEMPLATES,
  label = "templates",
): { snippets: Snippet[]; unclosed: string[] } {
  const snippets: Snippet[] = [];
  const unclosed: string[] = [];
  for (const rel of listFilesRecursive(root)) {
    const abs = join(root, rel);
    if (rel.endsWith(".sh")) {
      snippets.push({
        file: `${label}/${rel}`,
        kind: "script",
        startLine: 1,
        isShell: true,
        source: readFileSync(abs, "utf8"),
      });
      continue;
    }
    if (rel.endsWith(".md")) {
      const scan = scanFences(`${label}/${rel}`, readFileSync(abs, "utf8"));
      snippets.push(...scan.fences);
      unclosed.push(...scan.unclosed);
    }
  }
  return { snippets, unclosed };
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

const { snippets: SNIPPETS, unclosed: UNCLOSED } = collectSnippets();
const SCRIPTS = SNIPPETS.filter((s) => s.kind === "script");
const FENCES = SNIPPETS.filter((s) => s.kind === "fence");
const SHELL_FENCES = FENCES.filter((s) => s.isShell);

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

  it("플레이스홀더 치환 — 오탐은 없애고, 삼키는 한계는 박제한다", () => {
    const withPlaceholders = "gh issue edit <N> --parent <EPIC>\ngh project list --owner <owner>\n";
    expect(bashSyntaxError(withPlaceholders)).not.toBeNull(); // 치환 전에는 오탐
    expect(bashSyntaxError(withPlaceholders.replace(DOC_PLACEHOLDER, "PLACEHOLDER"))).toBeNull();

    // 가운데 공백이 든 실제 플레이스홀더는 계속 잡아야 한다(코퍼스에 6종 있다).
    expect('-f description="<한 줄>"'.replace(DOC_PLACEHOLDER, "P")).toBe('-f description="P"');

    // 셸 메타문자를 쓰는 형태는 플레이스홀더가 아니다 — 건드리면 의미가 바뀐다.
    expect("diff <(sort a) <(sort b)".replace(DOC_PLACEHOLDER, "P")).toBe(
      "diff <(sort a) <(sort b)",
    );
    expect("cat <<'EOF'".replace(DOC_PLACEHOLDER, "P")).toBe("cat <<'EOF'");

    // 리다이렉션 쌍을 삼키면 진짜 파손이 사라진다. 양끝 공백 금지가 이걸 막는다.
    expect("cat < in.txt >".replace(DOC_PLACEHOLDER, "P")).toBe("cat < in.txt >");
    expect(bashSyntaxError("cat < in.txt >".replace(DOC_PLACEHOLDER, "P"))).not.toBeNull();

    // **알려진 한계**: 공백 없이 짝이 맞는 꺾쇠는 여전히 한 토큰이 된다. 그 안의 파손은 삼켜진다.
    expect(bashSyntaxError("cat <in.txt>")).not.toBeNull();
    expect(bashSyntaxError("cat <in.txt>".replace(DOC_PLACEHOLDER, "P"))).toBeNull();
  });

  it("펜스 수집기가 합성 입력에서 맞게 동작한다", () => {
    const scan = (md: string): Scan => scanFences("synthetic.md", md);

    // CRLF. `\n` 으로만 쪼개면 파일 전체가 사라진다 — 실제로 그렇게 회귀했다.
    const crlf = scan("```bash\r\nif true; then\r\n```\r\n");
    expect(crlf.fences).toHaveLength(1);
    expect(crlf.fences[0]?.isShell).toBe(true);
    expect(crlf.fences[0]?.source).toBe("if true; then");

    // 닫히지 않은 펜스는 버리지 않고 보고한다. 버리면 그 뒤 스니펫까지 함께 사라진다.
    // 좌표는 **여는 펜스의 행**이다 — 작성자가 찾아가야 할 자리가 거기다.
    const never = scan("intro\n\n```text\nnot closed\n");
    expect(never.fences).toHaveLength(0);
    expect(never.unclosed).toEqual(["synthetic.md:3"]);

    // 닫는 걸 깜빡한 펜스가 **뒤따르는 셸 펜스를 본문으로 흡수**하는 형태. CommonMark 상
    // 코드블록 하나가 맞으므로 스캐너 결함이 아니다. `bash -n` 은 잃지만(비-셸로 잡히므로)
    // 줄이음은 흡수된 본문에서 계속 검사된다 — 사고 형태(#327)는 이 경우에도 덮인다.
    const swallowed = scan("```text\nswallowing\n\n```bash\ngh api x \\  # WRITE\n```\n");
    expect(swallowed.unclosed).toEqual([]);
    expect(swallowed.fences).toHaveLength(1);
    expect(swallowed.fences[0]?.isShell).toBe(false);
    expect(danglingContinuations(swallowed.fences[0] as Snippet)).toHaveLength(1);

    // 닫는 펜스는 여는 것보다 **길어도** 닫는다(CommonMark). 짧으면 못 닫는다.
    expect(scan("```bash\nx\n`````\n").fences).toHaveLength(1);
    expect(scan("````bash\nx\n```\n").unclosed).toEqual(["synthetic.md:1"]);

    // 중첩은 바깥 펜스 하나로만 센다 — 안쪽은 마크다운 리터럴 예시다.
    const nested = scan("````markdown\n```bash\nif true; then\n```\n````\n");
    expect(nested.fences).toHaveLength(1);
    expect(nested.fences[0]?.isShell).toBe(false);

    // info string 의 첫 토큰이 언어. 대문자·부가 속성이 붙어도 셸로 인식해야 한다.
    expect(scan('```Bash title="x"\nx\n```\n').fences[0]?.isShell).toBe(true);
    expect(scan("~~~sh\nx\n~~~\n").fences[0]?.isShell).toBe(true);
    expect(scan("```python\nx\n```\n").fences[0]?.isShell).toBe(false);

    // 들여쓴 펜스(리스트 안)도 잡고, 본문에서 그 들여쓰기를 걷어낸다.
    expect(scan("- 예:\n\n  ```bash\n  echo hi\n  ```\n").fences[0]?.source).toBe("echo hi");
  });

  it("수집기가 살아 있다 — 0건 통과 방지", () => {
    // 하한의 목적은 하나다 — **수집기가 죽어 0건을 모으는 것**을 잡는 것. 현재 개수의 사본이
    // 아니다. 실측 2026-08-17: 스크립트 18 · 펜스 217(그중 셸 48).
    //
    // 한때 실측의 80%(15/175/40)로 조였다가 되돌렸다. 그러면 문서 하나만 정당하게 지워도 red 인데
    // 테스트 이름이 "0건 통과 방지"라 **지운 사람이 수집기가 깨졌다고 오독한다**(실증됨:
    // `hierarchy.md` 하나 제거 → 셸 37 < 40 red). 침묵하는 열화는 하한이 아니라 미닫힘 테스트와
    // 테스트 이름에 실리는 실개수가 덮는다. 그래서 하한은 원래 목적만 한다.
    const counts = `스크립트 ${SCRIPTS.length} · 펜스 ${FENCES.length} · 셸 펜스 ${SHELL_FENCES.length}`;
    const reading = `수집기 파손 또는 자산 감소 — 어느 쪽인지 개수 변화로 판단하라 (${counts})`;
    expect(SCRIPTS.length, reading).toBeGreaterThanOrEqual(10);
    expect(FENCES.length, reading).toBeGreaterThanOrEqual(100);
    expect(SHELL_FENCES.length, reading).toBeGreaterThanOrEqual(30);
  });

  it("닫히지 않은 코드펜스가 없다 — 있으면 그 뒤 스니펫이 통째로 검사 밖이다", () => {
    expect(UNCLOSED).toEqual([]);
  });

  it("수집 파이프라인이 미닫힘을 실제로 실어 나른다", () => {
    // 위 단언만으로는 배선을 고정하지 못한다 — 코퍼스에 미닫힘이 0건이라 배선을 끊어도
    // `[] === []` 로 조용히 통과한다(변이 생존 확인). 그래서 **합성 코퍼스**를 파이프라인에
    // 통과시켜 미닫힘이 끝까지 실려 오는지를 본다.
    const dir = mkdtempSync(join(tmpdir(), "shipped-shell-"));
    try {
      writeFileSync(join(dir, "unclosed.md"), "intro\n\n```bash\nnever closed\n");
      writeFileSync(join(dir, "fine.md"), "```bash\necho ok\n```\n");
      const scanned = collectSnippets(dir, "synthetic");
      expect(scanned.unclosed).toEqual(["synthetic/unclosed.md:3"]);
      expect(scanned.snippets).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it(`배포되는 셸 스크립트 ${SCRIPTS.length}개가 bash 문법을 통과한다`, () => {
    const failures = SCRIPTS.flatMap((s) => {
      const err = bashSyntaxError(s.source);
      return err === null ? [] : [`${s.file}\n    ${reanchorLines(err, s.startLine)}`];
    });
    expect(failures, `문법 오류 ${failures.length}건 / 검사 ${SCRIPTS.length}개`).toEqual([]);
  });

  it(`셸로 표시된 코드펜스 ${SHELL_FENCES.length}개가 bash 문법을 통과한다`, () => {
    const failures = SHELL_FENCES.flatMap((s) => {
      const err = bashSyntaxError(s.source.replace(DOC_PLACEHOLDER, "PLACEHOLDER"));
      return err === null
        ? []
        : [`${s.file}:${s.startLine}\n    ${reanchorLines(err, s.startLine)}`];
    });
    expect(failures, `문법 오류 ${failures.length}건 / 검사 ${SHELL_FENCES.length}개`).toEqual([]);
  });

  it(`줄이음(\\) 뒤에 아무것도 오지 않는다 — 스크립트 ${SCRIPTS.length} + 펜스 ${FENCES.length}`, () => {
    const population = SNIPPETS;
    // 이 모집단이 **셸로 좁혀지지 않았음**을 먼저 못박는다. 이게 없으면 다음 사람이
    // `[...SCRIPTS, ...SHELL_FENCES]` 로 되돌려도 전 스위트가 초록으로 살아남는다(변이 생존 확인).
    // 태그를 빠뜨린 펜스가 사고의 은신처가 되면 게이트가 작성자의 라벨에 종속된다.
    expect(
      population.filter((s) => s.kind === "fence" && !s.isShell).length,
      "비-셸 펜스가 모집단에서 빠졌다 — 줄이음 검사가 라벨에 종속됐다",
    ).toBeGreaterThanOrEqual(100);

    const failures = population.flatMap(danglingContinuations);
    expect(failures, `끊긴 줄이음 ${failures.length}건 / 검사 ${population.length}개`).toEqual([]);
  });
});

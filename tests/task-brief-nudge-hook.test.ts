import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `task-brief-nudge.sh` 계약 (AC9).
 *
 * 이 훅은 **차단하지 않는다** — 그래서 `hook-block-log` 게이트의 대상이 아니고, 잘못 만들면
 * 아무 증상 없이 조용히 죽거나 조용히 매 프롬프트를 오염시킨다. 두 방향 다 사람 눈엔 안 보인다.
 * 그래서 계약을 양쪽으로 건다:
 *
 *   ⓐ 짧은 프롬프트          → 출력 없음   (짧은 요청에 브리프를 강권하면 스킬 자신의 Do-NOT 위반)
 *   ⓑ 긴 프롬프트 + `<objective>` → 출력 없음   (이미 브리프다)
 *   ⓒ 긴 프롬프트 + 표식 없음     → stdout **정확히 1줄**
 *
 * 전부 exit 0 이다. UserPromptSubmit 훅이 0 이 아닌 코드로 죽으면 사용자 프롬프트 처리 자체가
 * 영향을 받는다 — 넛지가 그런 비용을 질 이유가 없다.
 *
 * ## 입력 변이 (test-policy "새 가드 도입 시 변이 테스트")
 *
 * 초록불이 무는지부터 본다. 통과 케이스의 **입력만** 위반 상태로 바꿔 판정이 뒤집히는지 확인한다:
 * ⓐ의 프롬프트를 길게 → 넛지가 나야 하고, ⓒ에 `<objective>` 를 넣으면 → 넛지가 사라져야 한다.
 * 한쪽만 확인하면 "항상 침묵하는 훅"과 "항상 떠드는 훅"이 각각 절반의 케이스를 통과한다.
 *
 * 대상은 배포판과 설치본 **양쪽**이다 — 이 리포는 자기 배포물을 도그푸딩하므로 한쪽만 고치면
 * 파는 것과 쓰는 것이 갈린다.
 */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const COPIES = ["templates", ".claude"] as const;
const MARKER = "<objective>";
/** 훅의 임계와 같은 값. 경계(±1)를 직접 물어 임계가 조용히 움직이는 것을 막는다. */
const THRESHOLD = 400;

function run(copy: string, prompt: string, env?: NodeJS.ProcessEnv) {
  const res = spawnSync("bash", [join(ROOT, copy, "hooks", "task-brief-nudge.sh")], {
    input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt }),
    encoding: "utf8",
    env: { ...process.env, ...env },
    timeout: 10_000,
  });
  return {
    status: res.status,
    stdout: res.stdout ?? "",
    lines: (res.stdout ?? "").split("\n").filter((l) => l.trim() !== ""),
  };
}

const SHORT = "이 함수 뭐 하는 건지 한 줄로 알려줘.";
const LONG = "가".repeat(THRESHOLD);
const LONG_WITH_MARKER = `${MARKER}\n  로그인 화면을 고친다\n</objective>\n${LONG}`;

describe.each(COPIES)("%s/hooks/task-brief-nudge.sh", (copy) => {
  it("ⓐ 짧은 프롬프트 → 출력 없음 (exit 0)", () => {
    const r = run(copy, SHORT);
    expect(r.status).toBe(0);
    expect(
      r.stdout,
      `짧은 요청에 넛지가 붙었다 — 한 줄 질문까지 브리프로 몰면 매 턴 컨텍스트만 축낸다:\n${r.stdout}`,
    ).toBe("");
  });

  it(`ⓑ 긴 프롬프트라도 ${MARKER} 가 있으면 출력 없음`, () => {
    const r = run(copy, LONG_WITH_MARKER);
    expect(r.status).toBe(0);
    expect(r.stdout, `이미 브리프인데 넛지가 붙었다:\n${r.stdout}`).toBe("");
  });

  it(`ⓒ ${THRESHOLD}자 이상 + 표식 없음 → stdout 정확히 1줄`, () => {
    const r = run(copy, LONG);
    expect(r.status).toBe(0);
    expect(
      r.lines.length,
      `넛지가 1줄이 아니다(${r.lines.length}줄). 매 프롬프트에 붙는 출력이라 길이가 곧 상주 비용이다:\n${r.stdout}`,
    ).toBe(1);
    expect(r.lines[0]).toContain("task-brief");
  });

  // ── 입력 변이 ─────────────────────────────────────────────────────────────
  it("변이: ⓐ의 프롬프트를 임계 이상으로 늘리면 침묵이 깨진다 (길이 판정이 살아 있다)", () => {
    const grown = SHORT + "가".repeat(THRESHOLD);
    expect(run(copy, SHORT).stdout, "전제: 원본은 침묵").toBe("");
    expect(
      run(copy, grown).lines.length,
      "길이만 늘렸는데 여전히 침묵한다 — 길이 판정이 죽었고 이 훅은 영원히 아무것도 안 한다",
    ).toBe(1);
  });

  it("변이: ⓒ에 표식을 넣으면 넛지가 사라진다 (표식 판정이 살아 있다)", () => {
    expect(run(copy, LONG).lines.length, "전제: 원본은 1줄").toBe(1);
    expect(
      run(copy, `${MARKER}</objective>${LONG}`).stdout,
      "표식을 넣었는데도 넛지가 난다 — 표식 판정이 죽었고 브리프를 이미 쓴 사용자까지 매번 잔소리를 듣는다",
    ).toBe("");
  });

  it(`변이: 경계 — ${THRESHOLD - 1}자는 침묵, ${THRESHOLD}자는 1줄`, () => {
    expect(run(copy, "가".repeat(THRESHOLD - 1)).stdout).toBe("");
    expect(run(copy, "가".repeat(THRESHOLD)).lines.length).toBe(1);
  });

  /**
   * jq 미설치 환경 폴백 (`cli-development.md` §Hook Script 규약). PATH 에서 jq 만 없애는 대신
   * **필요한 외부 명령만 심볼릭 링크한 디렉터리**를 PATH 로 준다 — "jq 가 없다"를 실제로 만든다.
   * 폴백이 다른 임계로 판정하면 같은 프롬프트가 환경마다 다르게 취급된다.
   */
  it("변이: jq 없이도 같은 경계로 판정한다", () => {
    const bin = mkdtempSync(join(tmpdir(), "no-jq-bin-"));
    try {
      // `bash` 자신도 넣는다 — spawn 이 PATH 로 인터프리터를 찾는다.
      for (const tool of ["bash", "cat", "grep", "sed", "tr", "wc"]) {
        const abs = execFileSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).trim();
        symlinkSync(abs, join(bin, tool));
      }
      const env = { PATH: bin };
      expect(
        execFileSync("bash", ["-c", "command -v jq || true"], {
          encoding: "utf8",
          env: { ...process.env, ...env },
        }).trim(),
        "PATH 격리 실패 — jq 가 여전히 보이면 이 테스트는 폴백을 한 번도 안 탄다",
      ).toBe("");
      expect(run(copy, "가".repeat(THRESHOLD - 1), env).stdout).toBe("");
      expect(run(copy, "가".repeat(THRESHOLD), env).lines.length).toBe(1);
    } finally {
      rmSync(bin, { recursive: true, force: true });
    }
  });
});

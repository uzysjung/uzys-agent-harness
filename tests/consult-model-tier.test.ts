import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * consult advisor 래퍼의 **모델 선택** 규약.
 *
 * WHY: 래퍼가 모델을 버전 문자열로 박아 두면 CLI 가 그 버전을 은퇴시키는 날 스킬 전체가
 * 죽는다 — agy 는 모르는 모델을 `invalid model selection` (exit 1) 으로 즉사시킨다. 그래서
 * 기본값은 **버전이 아니라 티어(family)** 이고, 실제 모델은 호출 시점에 `agy models` 에서
 * 고른다. codex 쪽은 반대 방향의 같은 원칙 — `-m` 을 아예 안 붙여 CLI 자신의 기본값을 쓴다.
 *
 * 이 테스트가 지키는 것은 "모델 이름이 소스에 상수로 굳지 않는다" + "티어를 요청했는데 다른
 * 가족이 대신 답하지 않는다" 두 가지다. 후자가 없으면 잘못된 모델의 답이 맞는 답처럼 보인다.
 */
const ROOT = resolve(__dirname, "..");
const GEMINI = join(ROOT, "templates/skills/gemini-consult/scripts/gemini-ask.sh");
const CODEX = join(ROOT, "templates/skills/codex-consult/scripts/codex-ask.sh");

/**
 * 실측 `agy models` 출력(2026-07-26) + **일부러 순서를 어긋낸 한 줄**
 * (`gemini-3.2-pro-high` 를 3.1 뒤에 둔다). agy 는 관측상 가족별 최신순으로 나열하지만
 * 그 순서에 기대면 나열 순서가 바뀌는 날 조용히 낡은 모델을 고른다 — "첫 매치" 구현을
 * 이 한 줄이 떨어뜨린다.
 */
const STUB_MODELS = [
  "gemini-3.6-flash-high",
  "gemini-3.6-flash-medium",
  "gemini-3.6-flash-low",
  "gemini-3.5-flash-high",
  "gemini-3.1-pro-high",
  "gemini-3.2-pro-high",
  "gemini-3.1-pro-low",
  "claude-sonnet-4-6",
  "claude-opus-4-6-thinking",
  "gpt-oss-120b-medium",
];

let dir = "";
let logPath = "";

/**
 * 스텁 CLI. 래퍼가 `env -i` 로 환경을 털어내므로 로그 경로를 **파일에 구워 넣는다** —
 * 환경변수로 넘기면 allowlist 에 걸려 스텁이 아무것도 못 남긴다.
 */
function writeStub(name: string, body: string): string {
  const p = join(dir, name);
  writeFileSync(p, `#!/usr/bin/env bash\nLOG="${logPath}"\n${body}`);
  chmodSync(p, 0o755);
  return p;
}

function agyStub(models: readonly string[] = STUB_MODELS): string {
  return writeStub(
    "agy",
    `if [ "\${1:-}" = "models" ]; then
  printf '%s\\n' ${models.map((m) => `'${m}'`).join(" ")}
  exit 0
fi
printf '%s\\n' "$@" > "$LOG"
echo "stub reply"
`,
  );
}

function codexStub(): string {
  return writeStub(
    "codex",
    `printf '%s\\n' "$@" > "$LOG"
prev=""
for a in "$@"; do
  if [ "$prev" = "-o" ]; then printf 'stub reply\\n' > "$a"; fi
  prev="$a"
done
echo "progress noise"
`,
  );
}

/** spawnSync: 성공 경로의 stderr 도 봐야 한다 — 해석된 모델이 거기로 나간다. */
function run(
  script: string,
  args: string[],
  env: Record<string, string>,
): { code: number; err: string } {
  const r = spawnSync("bash", [script, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  return { code: r.status ?? -1, err: r.stderr ?? "" };
}

/** 스텁이 실제로 받은 argv (한 줄에 한 인자). */
function sentArgs(): string[] {
  return readFileSync(logPath, "utf8").trimEnd().split("\n");
}

function modelOf(args: string[]): string | undefined {
  return args.find((a) => a.startsWith("--model="))?.slice("--model=".length);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "consult-tier-"));
  logPath = join(dir, "argv.log");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("gemini-ask.sh — 티어로 고르고, 모델은 agy models 에서 derive 한다", () => {
  it("기본 티어는 pro — 가족 안에서 **버전이 가장 높은** 것을 고른다 (나열 순서가 아니라)", () => {
    const r = run(GEMINI, ["hello"], { AGY_BIN: agyStub() });
    expect(r.code).toBe(0);
    expect(modelOf(sentArgs())).toBe("gemini-3.2-pro-high");
  });

  it("flash 는 티어가 아니다 — Gemini 호출은 pro 단일 (사용자 결정 2026-07-26)", () => {
    // 이 스킬이 존재하는 이유가 곧 정책의 근거다: 외부 왕복을 감수하는 건 **판단**이 필요할
    // 때뿐이고(번역투 아닌 한국어·서로 무너지지 않는 페르소나·내가 놓친 지적), 그런 호출에서
    // 싼 티어는 정확히 사러 온 것을 깎는다. 다시 돌려야 하는 왕복이 제대로 한 왕복보다 비싸다.
    // 삭제가 아니라 **거부**로 두는 이유: 지우기만 하면 누가 flash 를 되살려도 아무도 안 막는다.
    const r = run(GEMINI, ["-t", "flash", "hello"], { AGY_BIN: agyStub() });
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown tier");
    expect(r.err).toContain("pro | claude");
  });

  it("-t claude 는 agy 가 주는 Claude 모델로 간다 (Gemini quota 와 별도 풀)", () => {
    const r = run(GEMINI, ["-t", "claude", "hello"], { AGY_BIN: agyStub() });
    expect(r.code).toBe(0);
    expect(modelOf(sentArgs())).toBe("claude-opus-4-6-thinking");
  });

  it("-m 은 티어 해석을 건너뛰고 그대로 넘긴다 (agy settings 의 custom model 경로)", () => {
    const r = run(GEMINI, ["-m", "some-custom-model", "hello"], { AGY_BIN: agyStub() });
    expect(r.code).toBe(0);
    expect(modelOf(sentArgs())).toBe("some-custom-model");
  });

  it("모르는 티어는 exit 2 — 조용히 기본 티어로 떨어지지 않는다", () => {
    const r = run(GEMINI, ["-t", "turbo", "hello"], { AGY_BIN: agyStub() });
    expect(r.code).toBe(2);
    expect(r.err).toContain("unknown tier");
  });

  it("요청한 티어가 목록에 없으면 exit 3 + 가진 목록 노출 — 다른 가족으로 대체 금지", () => {
    // 대체하면 "Claude 의견을 받았다" 고 믿는데 실제로는 Gemini 가 답한 상태가 된다.
    const geminiOnly = STUB_MODELS.filter((m) => m.startsWith("gemini-"));
    const r = run(GEMINI, ["-t", "claude", "hello"], { AGY_BIN: agyStub(geminiOnly) });
    expect(r.code).toBe(3);
    expect(r.err).toContain("no 'claude' model");
    expect(r.err).toContain("gemini-3.6-flash-high"); // 무엇이 있었는지 보여준다
  });

  it("어떤 모델이 답했는지 stderr 로 알린다 — 해석 결과가 안 보이면 버전 비의존이 검증 불가다", () => {
    // 버전을 안 박는 대신 매 호출 해석하므로, **무엇으로 해석됐는지**가 보여야 한다.
    // 안 보이면 낡은 모델로 조용히 떨어져도 알 길이 없다.
    const r = run(GEMINI, ["-t", "pro", "hello"], { AGY_BIN: agyStub() });
    expect(r.err).toContain("tier 'pro' → model 'gemini-3.2-pro-high'");
  });

  it("flag 순서 유지: --model 은 -p 앞, 프롬프트는 -p 바로 뒤 (사이에 끼면 agy 가 프롬프트를 무시)", () => {
    run(GEMINI, ["-t", "pro", "hello"], { AGY_BIN: agyStub() });
    expect(sentArgs()).toEqual(["--model=gemini-3.2-pro-high", "-p", "hello"]);
  });
});

describe("codex-ask.sh — 기본은 codex 자신의 모델", () => {
  it("-m 없이 부르면 codex 에 -m 을 넘기지 않는다 (사용자 config 의 기본 모델을 그대로 탄다)", () => {
    const r = run(CODEX, ["hello"], { CODEX_BIN: codexStub() });
    expect(r.code).toBe(0);
    expect(sentArgs()).not.toContain("-m");
  });

  it("-m 을 명시하면 그때만 넘긴다", () => {
    const r = run(CODEX, ["-m", "some-model", "hello"], { CODEX_BIN: codexStub() });
    expect(r.code).toBe(0);
    const args = sentArgs();
    expect(args).toContain("-m");
    expect(args[args.indexOf("-m") + 1]).toBe("some-model");
  });
});

/**
 * 열거하지 말고 훑는다 — 새 advisor 래퍼가 생겨도 이 게이트를 고칠 필요가 없어야 한다
 * (`no-false-ship.md` §"게이트는 열거하지 말고 훑어라").
 */
describe("번들 스킬 래퍼는 모델 이름을 상수로 굳히지 않는다", () => {
  const scripts = readdirSync(join(ROOT, "templates/skills"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) => {
      const scriptDir = join(ROOT, "templates/skills", d.name, "scripts");
      try {
        return readdirSync(scriptDir)
          .filter((f) => f.endsWith(".sh"))
          .map((f) => join(scriptDir, f));
      } catch {
        return [];
      }
    });

  it("훑을 대상이 실제로 잡힌다 — 0건이면 이 게이트는 아무것도 안 보는 것이다", () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it.each(
    scripts.map((p) => [basename(p), p] as const),
  )("%s 의 MODEL 기본값은 비어 있다 (버전은 CLI 에서 derive)", (_name, path) => {
    const m = readFileSync(path, "utf8").match(/^MODEL="\$\{[A-Z_]+:-(.*)\}"/m);
    if (!m) return; // 모델 개념이 없는 스크립트는 해당 없음
    expect(
      m[1],
      `모델 기본값에 '${m[1]}' 이 박혀 있다. CLI 가 그 모델을 은퇴시키면 래퍼 전체가 ` +
        "죽는다 — 티어 키워드로 두고 실제 모델은 호출 시점에 CLI 목록에서 고를 것.",
    ).toBe("");
  });

  /** 래퍼에 flag 를 늘려놓고 SKILL.md 에 안 적으면 그 경로는 아무도 못 쓴다. */
  it.each(
    scripts.map((p) => [basename(p), p] as const),
  )("%s 의 getopts flag 는 전부 같은 스킬의 SKILL.md 에 적혀 있다", (_name, path) => {
    const src = readFileSync(path, "utf8");
    const spec = src.match(/while getopts "([^"]+)"/)?.[1];
    if (!spec) return;
    const doc = readFileSync(resolve(path, "../../SKILL.md"), "utf8");
    for (const letter of spec.replace(/:/g, "")) {
      expect(doc, `-${letter} 가 문서에 없다 — 래퍼에만 있는 옵션은 없는 것과 같다`).toContain(
        `-${letter} `,
      );
    }
  });
});

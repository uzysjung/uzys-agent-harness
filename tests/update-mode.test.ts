import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { hashContent, readInstallLog, writeInstallLog } from "../src/install-log.js";
import {
  cleanStaleHookRefs,
  keepHookRef,
  pruneOrphans,
  runUpdateMode,
  syncSkills,
  updateDir,
} from "../src/update-mode.js";

/**
 * 실 repo root — `runUpdateMode` 가 외부 CLI transform 의 렌더 소스로 쓴다 (v26.134.0).
 * 이 테스트들의 `templatesDir` 은 합성 temp dir 이지만 harnessRoot 는 실물이어야 한다
 * (transform 이 `templates/codex/AGENTS.md.template` 등을 required 로 읽는다).
 * 대상 projectDir 에 외부 CLI 산출물이 없으므로 refresh 모드는 아무것도 쓰지 않는다.
 */
const HARNESS_ROOT = join(__dirname, "..");

/**
 * 디스크 내용이 "하네스가 놓아둔 그대로"인 기준선을 만든다 (ADR-047).
 * 소유가 증명된 상태 = 백업 없이 덮어쓰고, prune 대상이 될 수 있는 상태.
 */
function ownedCtx(prefix: string, files: Record<string, string>) {
  return {
    prefix,
    baseline: new Map(Object.entries(files).map(([n, c]) => [`${prefix}/${n}`, hashContent(c)])),
  };
}

describe("updateDir", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-up-"));
    mkdirSync(join(dir, "target"));
    mkdirSync(join(dir, "source"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("overwrites only files that exist in target (Track 혼입 방지)", () => {
    writeFileSync(join(dir, "target", "a.md"), "old-a");
    writeFileSync(join(dir, "target", "b.md"), "old-b");
    writeFileSync(join(dir, "source", "a.md"), "new-a");
    writeFileSync(join(dir, "source", "b.md"), "new-b");
    writeFileSync(join(dir, "source", "c.md"), "new-c"); // c.md not in target

    const ctx = ownedCtx("rules", { "a.md": "old-a", "b.md": "old-b" });
    const { updated } = updateDir(join(dir, "target"), join(dir, "source"), ".md", ctx);
    expect(updated).toBe(2);
    expect(readFileSync(join(dir, "target", "a.md"), "utf8")).toBe("new-a");
    expect(readFileSync(join(dir, "target", "b.md"), "utf8")).toBe("new-b");
    expect(existsSync(join(dir, "target", "c.md"))).toBe(false); // c.md NOT added
  });

  it("returns 0 when target/source missing", () => {
    expect(updateDir("/nonexistent", "/also-nope", ".md", ownedCtx("rules", {})).updated).toBe(0);
  });

  it("filters by extension", () => {
    writeFileSync(join(dir, "target", "x.md"), "");
    writeFileSync(join(dir, "target", "y.txt"), "");
    writeFileSync(join(dir, "source", "x.md"), "x");
    writeFileSync(join(dir, "source", "y.txt"), "y");
    const ctx = ownedCtx("rules", { "x.md": "", "y.txt": "" });
    expect(updateDir(join(dir, "target"), join(dir, "source"), ".md", ctx).updated).toBe(1);
  });
});

describe("pruneOrphans", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-pr-"));
    mkdirSync(join(dir, "target"));
    mkdirSync(join(dir, "source"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("removes harness-owned files in target that don't exist in source", () => {
    writeFileSync(join(dir, "target", "alive.md"), "");
    writeFileSync(join(dir, "target", "orphan.md"), "");
    writeFileSync(join(dir, "source", "alive.md"), "");

    // v26.132.0 (ADR-047) — 기준선이 소유를 증명해야 지운다. 이 목록에 없으면 사용자 파일이다.
    const ctx = ownedCtx("rules", { "alive.md": "", "orphan.md": "" });
    const removed = pruneOrphans(join(dir, "target"), join(dir, "source"), ".md", ctx);
    expect(removed).toEqual(["orphan.md"]);
    expect(existsSync(join(dir, "target", "alive.md"))).toBe(true);
    expect(existsSync(join(dir, "target", "orphan.md"))).toBe(false);
  });

  it("returns empty when nothing to prune", () => {
    writeFileSync(join(dir, "target", "x.md"), "");
    writeFileSync(join(dir, "source", "x.md"), "");
    const ctx = ownedCtx("rules", { "x.md": "" });
    expect(pruneOrphans(join(dir, "target"), join(dir, "source"), ".md", ctx)).toEqual([]);
  });

  it("ignores files with different extension", () => {
    writeFileSync(join(dir, "target", "stale.txt"), "");
    const ctx = ownedCtx("rules", { "stale.txt": "" });
    expect(pruneOrphans(join(dir, "target"), join(dir, "source"), ".md", ctx)).toEqual([]);
    expect(existsSync(join(dir, "target", "stale.txt"))).toBe(true);
  });
});

/**
 * settings.json 이 가리키는 **없는 스크립트**를 지우는 런타임 치유기.
 *
 * M-1 — 탐지 범위를 `.claude/hooks/` 한 층에서 **`.claude/` 이하 전체**로 넓힌다.
 *
 * 왜 지금 넓히나: `templates/settings.json` 의 PreToolUse(`Write|Edit`) 훅이
 * `.claude/skills/strategic-compact/suggest-compact.sh` 를 **무조건** 참조하는데, 그 스킬은
 * `withEcc=true`(ECC plugin 선택) 에서 설치되지 않는다(`src/manifest.ts` `COMMON_SKILL_DIRS_ECC`
 * → `applies: (s) => !s.withEcc`). settings.json 자신은 `applies: all` 이라 항상 깔린다 —
 * 즉 plugin 을 켠 설치자는 **없는 파일을 가리키는 훅**을 Write/Edit 마다 실행한다(bash exit 127).
 * 치유기는 이미 있었지만 참조 추출 regex 가 `hooks/` 한 층으로 좁아 이 부류를 **한 번도 물지
 * 못했다**. 로컬 도그푸드가 `withEcc=false` 라 그 파일이 우연히 존재해서 영원히 안 보였다.
 *
 * 그래서 계약이 두 곳 바뀐다:
 *   ① 두 번째 인자가 `.claude/hooks/` → **`.claude/` 자신**. 존재 확인이 hooks 밖으로 나가야 한다.
 *   ② `removed` 원소가 파일명 → **`.claude/` 기준 상대경로**. 렌더가 이 값을 그대로 사용자에게
 *      보여주는데(`src/commands/install-render.ts` "stale hook refs · N removed"),
 *      `suggest-compact.sh` 만 찍히면 어느 것이 지워졌는지 못 찾는다.
 *
 * 넓히지 **않는** 경계: `.claude/` 밖 참조는 부재여도 보존한다. 사용자 자기 스크립트를 치유기가
 * 지우면 그건 치유가 아니라 파손이다.
 */
describe("cleanStaleHookRefs", () => {
  let dir: string;
  let claudeDir: string;
  let settingsPath: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ch-st-"));
    claudeDir = join(dir, ".claude");
    settingsPath = join(claudeDir, "settings.json");
    mkdirSync(join(claudeDir, "hooks"), { recursive: true });
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** 템플릿과 **같은 형태**의 훅 command 문자열. 인용부호까지 같아야 추출 regex 를 실제로 민다. */
  function ref(relToClaudeDir: string): string {
    return `bash "$CLAUDE_PROJECT_DIR/.claude/${relToClaudeDir}"`;
  }

  /** PreToolUse 한 entry 에 command 들을 담은 settings.json 을 쓴다. */
  function writeSettings(commands: string[]): void {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Write|Edit",
              hooks: commands.map((command) => ({ type: "command", command })),
            },
          ],
        },
      }),
    );
  }

  /** 정리 후 남은 command 목록. */
  function remainingCommands(): string[] {
    const after = JSON.parse(readFileSync(settingsPath, "utf8"));
    return (after.hooks.PreToolUse[0]?.hooks ?? []).map((h: { command: string }) => h.command);
  }

  it("removes hook refs whose script file is missing", () => {
    writeFileSync(join(claudeDir, "hooks/alive.sh"), "");
    writeSettings([ref("hooks/alive.sh"), ref("hooks/dead.sh")]);

    const removed = cleanStaleHookRefs(settingsPath, claudeDir);

    expect(removed).toEqual(["hooks/dead.sh"]);
    const cmds = remainingCommands();
    expect(cmds.some((c: string) => c.includes("alive.sh"))).toBe(true);
    expect(cmds.some((c: string) => c.includes("dead.sh"))).toBe(false);
  });

  it("returns empty when settings.json malformed", () => {
    writeFileSync(settingsPath, "{ not json");
    expect(cleanStaleHookRefs(settingsPath, claudeDir)).toEqual([]);
  });

  it("preserves non-hook commands (e.g. statusLine)", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        statusLine: { type: "command", command: "npx -y @owloops/claude-powerline" },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo hi" }], // not a hook ref
            },
          ],
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, claudeDir);
    expect(removed).toEqual([]);
  });

  // characterization — 리팩터 전 현재 동작 고정 (엣지케이스 회귀 방지)
  it("entry 의 hooks 가 모두 stale 이면 entry 자체 제거, 다른 top-level 키는 보존", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        statusLine: { type: "command", command: "npx powerline" },
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: ref("hooks/dead.sh") }],
            },
          ],
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, claudeDir);
    expect(removed).toEqual(["hooks/dead.sh"]);
    const after = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(after.hooks.PreToolUse).toEqual([]); // hooks 빈 entry 통째 제거
    expect(after.statusLine).toEqual({ type: "command", command: "npx powerline" }); // 보존
  });

  it("non-array hook event 는 write 발생 시에도 그대로 보존", () => {
    writeFileSync(
      settingsPath,
      JSON.stringify({
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: ref("hooks/dead.sh") }],
            },
          ],
          WeirdEvent: "not-an-array-value",
        },
      }),
    );
    const removed = cleanStaleHookRefs(settingsPath, claudeDir);
    expect(removed).toEqual(["hooks/dead.sh"]); // stale 제거로 write 트리거
    const after = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(after.hooks.WeirdEvent).toBe("not-an-array-value"); // non-array event 불변
  });

  // ── M-1: `hooks/` 밖 `.claude/**` 참조 ────────────────────────────────────────
  // 이 4건이 이 결함의 본체다. 위 5건은 넓힌 술어가 **기존 동작을 회귀시키지 않는지**를 지킨다.

  it("스킬 디렉터리 안의 스크립트 참조도 부재면 제거한다 (settings.json 이 스킬보다 넓게 깔린다)", () => {
    // withEcc=true 설치가 정확히 이 상태다: settings.json 은 있고 스킬 디렉터리는 없다.
    writeSettings([ref("skills/strategic-compact/suggest-compact.sh")]);

    const removed = cleanStaleHookRefs(settingsPath, claudeDir);

    expect(removed).toEqual(["skills/strategic-compact/suggest-compact.sh"]);
    expect(remainingCommands()).toEqual([]);
  });

  it("같은 참조라도 파일이 실재하면 보존한다 (치유기가 멀쩡한 훅을 뜯으면 안 된다)", () => {
    // withEcc=false 설치. 스킬이 깔려 있으므로 훅은 살아 있어야 한다.
    mkdirSync(join(claudeDir, "skills/strategic-compact"), { recursive: true });
    writeFileSync(join(claudeDir, "skills/strategic-compact/suggest-compact.sh"), "#!/bin/bash\n");
    writeSettings([ref("skills/strategic-compact/suggest-compact.sh")]);

    const removed = cleanStaleHookRefs(settingsPath, claudeDir);

    expect(removed).toEqual([]);
    expect(remainingCommands()).toHaveLength(1);
  });

  it("`.claude/` 밖 참조는 부재여도 보존한다 — 사용자 자기 스크립트다 (경계를 넓히지 않는다)", () => {
    // 넓힌 술어가 여기까지 새면 치유기가 사용자 파일을 지우는 도구가 된다.
    const outside = [
      'bash "$CLAUDE_PROJECT_DIR/scripts/my-own-hook.sh"',
      'bash "$CLAUDE_PROJECT_DIR/.husky/pre-commit.sh"',
      "bash /usr/local/bin/some-global.sh",
    ];
    writeSettings(outside);

    const removed = cleanStaleHookRefs(settingsPath, claudeDir);

    expect(removed).toEqual([]);
    expect(remainingCommands()).toEqual(outside);
  });

  it("제거 보고가 어느 파일인지 식별시킨다 — 같은 파일명이 두 디렉터리에 있을 수 있다", () => {
    // 파일명만 보고하면(`dup.sh`) 사용자는 살아 있는 쪽과 지워진 쪽을 구분할 수 없고,
    // 파일명 기준 중복 제거 로직이 있으면 **살아 있는 쪽 이름 때문에 죽은 쪽이 안 찍힌다.**
    writeFileSync(join(claudeDir, "hooks/dup.sh"), "");
    writeSettings([ref("hooks/dup.sh"), ref("skills/demo/dup.sh")]);

    const removed = cleanStaleHookRefs(settingsPath, claudeDir);

    expect(removed).toEqual(["skills/demo/dup.sh"]);
    expect(remainingCommands()).toEqual([ref("hooks/dup.sh")]);
  });

  // ── H-2: `.claude/` 라는 이름이 가리키는 대상이 **둘**이다 ────────────────────
  //
  // ⓐ 프로젝트 `<projectDir>/.claude/` — 하네스가 깔았다. 치유 대상.
  // ⓑ 홈      `~/.claude/`             — 사용자 전역 설정. **하네스 소유가 아니다.**
  //
  // 판정이 경로 세그먼트 `/.claude/` 만 보면 이 둘이 같은 문자열로 보인다. 그러면 치유기는
  // 사용자가 `settings.json` 에 직접 적어 넣은 `$HOME/.claude/hooks/*.sh` 를 프로젝트 기준으로
  // 존재 확인하고, 프로젝트에 그 파일이 없다는 이유로 **남의 훅을 지운다.** 그건 치유가 아니라
  // 파손이고, ADR-057 Decision 2 가 선언한 경계(*".claude/ 밖 참조는 무조건 보존"*)와 정면으로
  // 어긋난다 — 홈 `.claude/` 는 프로젝트 `.claude/` 밖이다.
  //
  // 폭발반경이 이번에 커졌다: 탐지 깊이가 무제한이 되면서 플러그인 훅이 실제로 사는
  // `~/.claude/plugins/**` 와 `~/.claude/skills/**` 가 새로 사정권에 들어왔고, install 경로에도
  // 치유기가 붙어 `update` 를 한 번도 안 돌린 사용자까지 노출된다.
  //
  // 그래서 계약은 **앵커**로 쓴다 — 참조가 이 프로젝트에 앵커될 때만 판정 대상이다.
  // 열거식 예외 목록(`$HOME` 을 빼고, `~` 를 빼고, …)이 아니다. 예외를 열거하면 다음에 나올
  // 표기 하나가 곧 다음 서식지가 된다.
  describe("H-2 — 프로젝트 앵커가 있는 참조만 판정한다 (홈 `~/.claude/` 는 남의 것)", () => {
    // 아래 두 표의 `${...}` 는 JS 템플릿 리터럴이 아니라 **훅 command 원문**이다 — Claude Code /
    // 셸이 확장하는 표기라 형태를 바꾸면 테스트 대상 자체가 바뀐다.
    // biome-ignore-start lint/suspicious/noTemplateCurlyInString: 훅 command 원문 (셸 변수 표기)
    /**
     * 이 프로젝트에 앵커된 참조 = 판정 대상. 부재면 제거되어야 한다.
     *
     * command 를 **함수로** 담는다: `it.each` 의 표는 수집 시점에 평가되는데 `claudeDir` 은
     * `beforeEach` 에서 만들어지는 temp dir 이라, 문자열로 담으면 `undefined/...` 가 박힌다.
     */
    const anchored: Array<[label: string, build: (claudeDir: string) => string, relPath: string]> =
      [
        [
          "$CLAUDE_PROJECT_DIR 확장",
          () => 'bash "$CLAUDE_PROJECT_DIR/.claude/skills/x/y.sh"',
          "skills/x/y.sh",
        ],
        [
          "${CLAUDE_PROJECT_DIR} 중괄호 표기",
          () => 'bash "${CLAUDE_PROJECT_DIR}/.claude/hooks/dead.sh"',
          "hooks/dead.sh",
        ],
        [
          // 레거시 설치는 `$CLAUDE_PROJECT_DIR` 이전에 절대경로를 그대로 박아 넣었다.
          // 가리키는 곳이 같은 프로젝트이므로 표기가 다르다고 면제할 이유가 없다.
          "실 projectDir 절대경로 (레거시 설치)",
          (cd: string) => `bash "${cd}/hooks/legacy-abs.sh"`,
          "hooks/legacy-abs.sh",
        ],
      ];

    /**
     * 앵커가 없는 참조 = **판정 대상 자체가 아니다.** 부재여도 보존한다.
     *
     * 케이스를 낱개로 도는 이유: 한쪽만 막는 구현이 나온다. `$HOME` 은 걸러내면서 `~` 는
     * 그대로 두는 식이면 표를 하나로 묶었을 때 "어느 표기가 샜는지"가 실패 출력에서 사라진다.
     */
    const notAnchored: Array<[string, string]> = [
      ["$HOME 확장", 'bash "$HOME/.claude/hooks/my-global.sh"'],
      ["${HOME} 중괄호 표기", 'bash "${HOME}/.claude/hooks/my-global.sh"'],
      ["~ 틸데 확장", 'bash "~/.claude/hooks/my-global.sh"'],
      // 플러그인 훅이 실제로 사는 곳 — 이번 깊이 확장이 새로 사정권에 넣은 자리다.
      ["$HOME 아래 플러그인 훅", 'bash "$HOME/.claude/plugins/foo/hooks/bar.sh"'],
      ["CLAUDE_CONFIG_DIR", 'bash "${CLAUDE_CONFIG_DIR}/.claude/scripts/x.sh"'],
      ["프로젝트 밖 절대경로", 'bash "/Users/someone/.claude/skills/mine/run.sh"'],
      // 기존 경계 — 여기까지 회귀하지 않는지 같은 표에서 함께 본다.
      ["$CLAUDE_PLUGIN_ROOT", 'bash "$CLAUDE_PLUGIN_ROOT/scripts/p.sh"'],
    ];
    // biome-ignore-end lint/suspicious/noTemplateCurlyInString: 훅 command 원문 (셸 변수 표기)

    // ── 진입점 1: `keepHookRef` 직접 호출 ────────────────────────────────────
    // 파리티 게이트(`tests/settings-reference-parity.test.ts`)가 면제 판정에 **이 함수를 직접**
    // 부른다. 두 진입점의 판정이 갈리면 그 게이트가 거짓 면제를 내주므로 양쪽 다 고정한다.

    it.each(
      anchored,
    )("keepHookRef: 프로젝트 앵커 + 파일 부재 → 제거 (%s)", (_label, build, relPath) => {
      const removed: string[] = [];
      expect(keepHookRef({ command: build(claudeDir) }, claudeDir, removed)).toBe(false);
      expect(removed).toEqual([relPath]);
    });

    it.each(notAnchored)("keepHookRef: 앵커 없음 → 파일이 없어도 보존 (%s)", (_label, command) => {
      const removed: string[] = [];
      expect(
        keepHookRef({ command }, claudeDir, removed),
        `${command} 를 프로젝트 \`.claude/\` 참조로 오인했다 — 사용자 전역 설정을 지운다`,
      ).toBe(true);
      expect(removed).toEqual([]);
    });

    // ── 진입점 2: `cleanStaleHookRefs` (실제 settings.json 을 고쳐 쓰는 쪽) ────

    it("cleanStaleHookRefs: 앵커된 것만 지우고 나머지 command 는 그대로 남긴다", () => {
      const preserved = notAnchored.map(([, command]) => command);
      writeSettings([...anchored.map(([, build]) => build(claudeDir)), ...preserved]);

      const removed = cleanStaleHookRefs(settingsPath, claudeDir);

      expect(removed).toEqual(anchored.map(([, , relPath]) => relPath));
      // 보존 대상은 **원문 그대로** 남아야 한다. 하나라도 빠지면 사용자 훅이 사라진 것이다.
      expect(remainingCommands()).toEqual(preserved);
    });
  });

  // ── H-3: `.sh` 는 **더 긴 확장자의 접두사**가 될 수 있다 ──────────────────────
  //
  // 참조 추출이 `[^"\s]+\.sh` 로 **끝을 고정하지 않으면**, `.sh` 로 시작할 뿐인 다른 확장자를
  // 만났을 때 정규식이 뒷부분을 버리고 앞부분만 캡처한다:
  //
  //   `.claude/hooks/run.shell`  → 캡처 `hooks/run.sh`   (디스크의 `run.shell` 은 멀쩡히 실존)
  //   `.claude/hooks/x.sh.bak`   → 캡처 `hooks/x.sh`     (디스크의 `x.sh.bak` 은 실존)
  //
  // 캡처한 `hooks/run.sh` 는 디스크에 없으므로 치유기는 그 훅을 **stale 로 판정하고 지운다.**
  // 결과는 치유가 아니라 *사용자 설정의 조용한 손실* — 멀쩡히 동작하던 훅이 settings.json 에서
  // 사라지고, 사용자에게는 있지도 않은 `hooks/run.sh` 가 제거됐다고 보고된다.
  //
  // 부류 자체는 옛 regex 에도 있었지만(같은 백트래킹), M-1 이 탐지 범위를 `.claude/hooks/` 한
  // 층에서 `.claude/**` 임의 깊이로 넓히고 install 경로까지 붙이면서 **폭발반경이 커졌다.**
  //
  // 그래서 계약은 **참조의 끝을 고정한다**: `.sh` 가 경로 토큰의 끝일 때만 hook script 참조다.
  // 끝 = 따옴표 · 공백 · 문자열 끝 셋 다. 따옴표 하나로만 짜면 인용부호 없는 형태가 그대로 샌다.
  describe("H-3 — `.sh` 는 더 긴 확장자의 접두사일 수 있다 (참조 끝을 고정한다)", () => {
    /** `.sh` 로 시작하는 **다른** 확장자 — 판정 대상이 아니다. 실존하면 무조건 보존. */
    const prefixTraps: Array<[label: string, command: string, onDisk: string]> = [
      [
        "`.shell` — 따옴표 형태",
        'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/run.shell"',
        "hooks/run.shell",
      ],
      [
        "`.sh.bak` — `.sh` 뒤에 확장자가 더 붙는다",
        'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/x.sh.bak"',
        "hooks/x.sh.bak",
      ],
      // 아래 둘이 "끝 고정을 `\"` 하나로만 짜는" 구현을 통과시키지 않는다.
      [
        "`.shell` — 따옴표 없이 문자열 끝",
        "bash $CLAUDE_PROJECT_DIR/.claude/hooks/run.shell",
        "hooks/run.shell",
      ],
      [
        "`.shell` — 따옴표 없이 뒤에 인자",
        "bash $CLAUDE_PROJECT_DIR/.claude/hooks/run.shell --verbose",
        "hooks/run.shell",
      ],
    ];

    it.each(
      prefixTraps,
    )("keepHookRef: %s → 실존하므로 보존하고 removed 에 아무것도 담지 않는다", (_label, command, onDisk) => {
      writeFileSync(join(claudeDir, onDisk), "#!/bin/bash\n");
      const removed: string[] = [];

      expect(
        keepHookRef({ command }, claudeDir, removed),
        `${command} 의 참조 끝을 고정하지 않아 앞부분만 캡처했다 — 실존하는 훅을 지운다`,
      ).toBe(true);
      expect(removed).toEqual([]);
    });

    it("keepHookRef: `.shell` 이 부재여도 `hooks/run.sh` 라는 거짓 항목을 보고하지 않는다", () => {
      // 여기서 보존/제거 어느 쪽이든 우리 판정 대상이 아니다 — 고정하는 것은 **보고의 정직성**이다.
      // 사용자 settings.json 에 적힌 적도 없는 경로가 "제거됨"으로 찍히면 그 보고는 거짓이다.
      const removed: string[] = [];

      keepHookRef(
        { command: 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/run.shell"' },
        claudeDir,
        removed,
      );

      expect(removed, "command 에 없는 경로를 제거 보고에 담았다").not.toContain("hooks/run.sh");
    });

    // 끝 고정이 반대로 **너무 조여** 진짜 `.sh` 참조를 놓치면 치유기가 통째로 죽는다.
    // `$` 하나로 끝을 박는 구현이 정확히 그 형태다 (뒤에 `"` 나 인자가 오면 매치 실패).
    it.each([
      ["따옴표 형태", 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh"'],
      ["따옴표 없이 문자열 끝", "bash $CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh"],
      ["따옴표 없이 뒤에 인자", "bash $CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh --verbose"],
    ])("keepHookRef: 진짜 `.sh` 참조는 끝 고정 뒤에도 여전히 문다 (%s)", (_label, command) => {
      const removed: string[] = [];
      expect(keepHookRef({ command }, claudeDir, removed)).toBe(false);
      expect(removed).toEqual(["hooks/dead.sh"]);
    });

    it("keepHookRef: 실존하는 `.sh` 는 보존한다 (회귀 방지)", () => {
      writeFileSync(join(claudeDir, "hooks/alive.sh"), "");
      const removed: string[] = [];
      expect(keepHookRef({ command: ref("hooks/alive.sh") }, claudeDir, removed)).toBe(true);
      expect(removed).toEqual([]);
    });

    // ── 진입점 2: `cleanStaleHookRefs` (실제 settings.json 을 고쳐 쓰는 쪽) ────
    it("cleanStaleHookRefs: 접두사 함정 참조를 보존하면서 진짜 죽은 참조만 지운다", () => {
      writeFileSync(join(claudeDir, "hooks/run.shell"), "");
      writeFileSync(join(claudeDir, "hooks/x.sh.bak"), "");
      writeFileSync(join(claudeDir, "hooks/alive.sh"), "");
      const preserved = [ref("hooks/run.shell"), ref("hooks/x.sh.bak"), ref("hooks/alive.sh")];
      writeSettings([...preserved, ref("hooks/dead.sh")]);

      const removed = cleanStaleHookRefs(settingsPath, claudeDir);

      expect(removed).toEqual(["hooks/dead.sh"]);
      // 보존 대상은 **원문 그대로** — 하나라도 빠지면 동작하던 훅이 사용자 설정에서 사라진 것이다.
      expect(remainingCommands()).toEqual(preserved);
    });
  });

  // ── H-4: 끝은 고정했는데 **시작을 안 고정했다** ─────────────────────────────────
  //
  // 앵커 판정이 `command.indexOf(anchor)` 다 — **부분문자열 매치**다. 부분문자열은 앵커가 아니다:
  // 앵커라는 말은 "이 참조가 이 프로젝트의 `.claude/` 에서 **시작한다**"는 주장인데, indexOf 는
  // 그 문자열이 command 어딘가에 **박혀 있기만** 하면 참이라고 답한다. 그래서 실경로가 전혀 다른
  // 참조가 "이 프로젝트에 앵커됐다"로 오판되고, 그 뒤 존재 확인은 참조가 실제로 가리키는 곳이
  // 아니라 **프로젝트 쪽**에서 일어난다:
  //
  //   claudeDir(판정 기준)   = <tmp>/.claude
  //   command 이 가리키는 곳 = <tmp>/mnt/host<tmp>/.claude/hooks/x.sh   ← 실존
  //   판정 기준으로 본 경로  = <tmp>/.claude/hooks/x.sh                  ← 부재
  //   ⇒ keep=false — **실존하는 남의 훅을 제거한다.**
  //
  // 트리거는 가상의 것이 아니다: 도커 바인드마운트(`-v`), 백업/스냅샷 트리, macOS 의 `/private`
  // 접두(`/var` ↔ `/private/var`) 셋 다 "실경로는 다른데 문자열상 claudeDir 을 품는" 형태다.
  // 피해는 ADR-057 Decision 2 가 막으려던 것과 **정확히 같다** — 사용자 자기 스크립트를 지우면
  // 그건 치유가 아니라 파손이다.
  //
  // H-3 에서 참조의 **끝**을 토큰 경계로 고정했다. 시작도 대칭이어야 한다:
  // **앵커는 command 의 맨 앞이거나, 바로 앞 문자가 공백 또는 따옴표일 때만 유효하다.**
  // 문자열 접두사로 같은 곳이라고 주장할 수 없으면 기본값은 보존이다 (안전한 쪽).
  describe("H-4 — 앵커는 토큰 시작에서만 유효하다 (부분문자열 매치는 앵커가 아니다)", () => {
    // 아래 표의 `${...}` 는 JS 템플릿 리터럴이 아니라 **훅 command 원문**이다 (셸 변수 표기).
    // biome-ignore-start lint/suspicious/noTemplateCurlyInString: 훅 command 원문 (셸 변수 표기)

    /**
     * 앵커가 **토큰 시작**에 있는 형태 = 판정 대상. 부재면 제거되어야 한다.
     *
     * 시작 경계를 조이는 구현이 반대로 **너무 조여** 진짜 참조를 놓치면 치유기가 통째로 죽는다.
     * 인용부호 뒤 · 공백 뒤 · command 맨 앞 셋을 다 세워 그 회귀를 막는다.
     *
     * command 를 함수로 담는 이유는 위 H-2 표와 같다 — `claudeDir` 은 `beforeEach` 산물이라
     * 문자열로 담으면 수집 시점에 `undefined/...` 가 박힌다.
     */
    const atTokenStart: Array<[label: string, build: (claudeDir: string) => string, rel: string]> =
      [
        [
          "레거시 절대경로 — 여는 따옴표 뒤",
          (cd: string) => `bash "${cd}/hooks/dead.sh"`,
          "hooks/dead.sh",
        ],
        [
          "레거시 절대경로 — 공백 뒤 (따옴표 없음)",
          (cd: string) => `bash ${cd}/hooks/dead.sh`,
          "hooks/dead.sh",
        ],
        ["레거시 절대경로 — command 맨 앞", (cd: string) => `${cd}/hooks/dead.sh`, "hooks/dead.sh"],
        [
          "셸 변수 앵커 — 여는 따옴표 뒤",
          () => 'bash "$CLAUDE_PROJECT_DIR/.claude/hooks/dead.sh"',
          "hooks/dead.sh",
        ],
      ];

    /**
     * 앵커 문자열이 **토큰 중간**에 박힌 형태 = 앵커가 아니다. 부재여도 보존한다.
     *
     * 셸 변수 앵커(1·2)를 같은 표에 세우는 것이 핵심이다 — 레거시 절대경로 앵커(3)만 고치고
     * 1·2 를 놔두는 구현이 여기를 통과하지 못한다. 경계 규칙은 **앵커 목록 전체**에 걸려야 한다
     * (한 축이 계열 일부에만 있으면 빠진 쪽이 다음 서식지다).
     */
    const midToken: Array<[label: string, build: (claudeDir: string) => string]> = [
      [
        // macOS 는 같은 곳을 `/var/...` 로도 `/private/var/...` 로도 부른다. 접두사가 붙은 순간
        // 그건 **다른 문자열**이고, 문자열 접두사 비교로는 같은 곳이라고 주장할 수 없다.
        // 주장할 수 없으면 보존이 기본값이다 — 지우고 나서 틀린 것이 그 반대보다 훨씬 비싸다.
        "macOS `/private` 접두",
        (cd: string) => `bash "/private${cd}/hooks/ghost.sh"`,
      ],
      ["셸 변수 앵커 1 이 토큰 중간", () => 'bash "/x$CLAUDE_PROJECT_DIR/.claude/hooks/ghost.sh"'],
      [
        "셸 변수 앵커 2 가 토큰 중간",
        () => 'bash "/x${CLAUDE_PROJECT_DIR}/.claude/hooks/ghost.sh"',
      ],
    ];
    // biome-ignore-end lint/suspicious/noTemplateCurlyInString: 훅 command 원문 (셸 변수 표기)

    /**
     * 바인드마운트가 만드는 경로를 **실제로** 깐다 — `<dir>/mnt/host` + `<claudeDir>`.
     *
     * `claudeDir` 문자열을 그대로 이어붙인다. 여기서 `realpath` 로 정규화하면 macOS 의
     * `/var` ↔ `/private/var` 때문에 판정에 넘기는 기준 문자열과 command 가 갈리고, 그러면
     * 이 테스트가 재는 것이 앵커 경계가 아니라 심볼릭 링크 표기가 된다 (앞선 레인이 여기서
     * 헛빨간불을 한 번 봤다).
     */
    function mountedHookScript(): string {
      const mountedClaudeDir = `${join(dir, "mnt", "host")}${claudeDir}`;
      mkdirSync(join(mountedClaudeDir, "hooks"), { recursive: true });
      const script = join(mountedClaudeDir, "hooks", "x.sh");
      writeFileSync(script, "#!/bin/bash\n");
      return script;
    }

    // ── 진입점 1: `keepHookRef` 직접 호출 ────────────────────────────────────

    it.each(
      atTokenStart,
    )("keepHookRef: 앵커가 토큰 시작 + 파일 부재 → 제거 (%s)", (_label, build, rel) => {
      const removed: string[] = [];
      expect(
        keepHookRef({ command: build(claudeDir) }, claudeDir, removed),
        `${build(claudeDir)} 를 앵커로 못 물었다 — 시작 경계를 너무 조이면 치유기가 죽는다`,
      ).toBe(false);
      expect(removed).toEqual([rel]);
    });

    it.each(midToken)("keepHookRef: 앵커가 토큰 중간 → 부재여도 보존 (%s)", (_label, build) => {
      const removed: string[] = [];
      expect(
        keepHookRef({ command: build(claudeDir) }, claudeDir, removed),
        `${build(claudeDir)} 를 이 프로젝트 앵커로 오인했다 — 실경로가 다른 남의 훅을 지운다`,
      ).toBe(true);
      expect(removed).toEqual([]);
    });

    it("keepHookRef: 바인드마운트 경로 — 그 실경로에 실존하는 훅을 제거하지 않는다", () => {
      const script = mountedHookScript();
      // 전제 확인 — "실존한다"가 참이어야 이 케이스가 재려는 피해가 성립한다.
      expect(existsSync(script), "마운트 쪽 훅 파일을 못 만들었다").toBe(true);
      expect(existsSync(join(claudeDir, "hooks/x.sh")), "프로젝트 쪽엔 없어야 한다").toBe(false);

      const removed: string[] = [];
      expect(
        keepHookRef({ command: `bash "${script}"` }, claudeDir, removed),
        `${script} 는 실존한다 — 문자열상 claudeDir 을 품었다는 이유로 지우면 파손이다`,
      ).toBe(true);
      expect(removed).toEqual([]);
    });

    // ── 진입점 2: `cleanStaleHookRefs` (실제 settings.json 을 고쳐 쓰는 쪽) ────

    it("cleanStaleHookRefs: 토큰 중간 앵커는 보존하고 진짜 죽은 참조만 지운다", () => {
      const preserved = [
        `bash "${mountedHookScript()}"`,
        ...midToken.map(([, build]) => build(claudeDir)),
      ];
      writeSettings([...preserved, `bash "${claudeDir}/hooks/dead.sh"`]);

      const removed = cleanStaleHookRefs(settingsPath, claudeDir);

      expect(removed).toEqual(["hooks/dead.sh"]);
      // 보존 대상은 **원문 그대로** — 하나라도 빠지면 사용자 훅이 조용히 사라진 것이다.
      expect(remainingCommands()).toEqual(preserved);
    });
  });
});

describe("runUpdateMode (E2E with templates)", () => {
  let projectDir: string;
  let templatesDir: string;
  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-um-proj-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-um-tpl-"));
    // minimal layout
    for (const d of ["rules", "agents", "commands/uzys", "hooks"]) {
      mkdirSync(join(templatesDir, d), { recursive: true });
      mkdirSync(join(projectDir, ".claude", d), { recursive: true });
    }
    writeFileSync(join(templatesDir, "CLAUDE.md"), "template-CLAUDE\n");
    // 앵커는 프로젝트 루트다 (P5 · ADR-060). update 는 **이미 있는 것만** 갱신한다.
    writeFileSync(join(projectDir, "CLAUDE-uzys-harness.md"), "old-CLAUDE\n");
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "v2\n");
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "v1\n");
    writeFileSync(join(projectDir, ".claude/rules/orphan-rule.md"), "stale\n"); // not in template
    writeFileSync(join(templatesDir, "hooks/session-start.sh"), "echo new\n");
    writeFileSync(join(projectDir, ".claude/hooks/session-start.sh"), "echo old\n");
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it("updates files + refreshes CLAUDE.md", () => {
    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);
    expect(readFileSync(join(projectDir, ".claude/rules/git-policy.md"), "utf8")).toBe("v2\n");
    expect(readFileSync(join(projectDir, "CLAUDE-uzys-harness.md"), "utf8")).toBe(
      "template-CLAUDE\n",
    );
    expect(report.updated[".claude/rules"]).toBe(1);
    expect(report.claudeMdUpdated).toBe(true);
    // 이미 이행된 설치본 — 이행 분기로 새지 않는다 (갱신과 생성은 배타적).
    expect(report.anchorCreated).toBe(false);
    expect(report.rootImportAdded).toBe(false);
    expect(report.legacyAnchor).toBeNull();
  });

  /**
   * v26.132.0 (ADR-047) 로 바뀐 계약. 그 전까지는 install log 유무와 무관하게 "templates 에
   * 없으면 삭제"였고, 그래서 사용자가 직접 쓴 룰이 update 한 번에 사라졌다. 이제 소유를
   * 증명할 수 있을 때만 지운다.
   */
  it("설치 기록이 없으면 orphan 을 지우지 않는다 (사용자 파일일 수 있다)", () => {
    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);
    expect(existsSync(join(projectDir, ".claude/rules/orphan-rule.md"))).toBe(true);
    expect(report.pruned[".claude/rules"]).toEqual([]);
  });

  it("설치 기록이 하네스 소유를 증명하면 orphan 을 지운다 (폐기 룰 회수)", () => {
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
      policyFiles: [{ path: "rules/orphan-rule.md", sha256: hashContent("stale\n") }],
    });

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(existsSync(join(projectDir, ".claude/rules/orphan-rule.md"))).toBe(false);
    expect(report.pruned[".claude/rules"]).toEqual(["orphan-rule.md"]);
  });
});

/**
 * 릴리즈로 **새로 생긴** 자산의 설치 (#283).
 *
 * update 는 "이미 있는 것만 갱신"이라, 릴리즈가 자산을 추가하면 기존 설치본은 update 를 몇 번
 * 돌려도 그 파일을 못 받았다. 실제 증상은 `.uzys-agent-harness/` 의 두 스크립트였다 — 배포판
 * 룰이 그 경로를 호출하라고 적는 동안 파일이 없었다. 훅·에이전트·룰도 같은 경로로 추가되므로
 * 이 describe 는 스크립트만이 아니라 **자산 종류별로** 문다.
 */
describe("신규 자산 설치 (#283)", () => {
  let projectDir: string;
  let templatesDir: string;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-um-new-proj-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-um-new-tpl-"));
    for (const d of ["rules", "agents", "commands/uzys", "hooks", "scripts"]) {
      mkdirSync(join(templatesDir, d), { recursive: true });
    }
    for (const d of ["rules", "agents", "commands/uzys", "hooks"]) {
      mkdirSync(join(projectDir, ".claude", d), { recursive: true });
    }
    // 배포판이 가진 것. 프로젝트에는 git-policy 하나만 깔려 있다 = 나머지가 "새로 생긴 자산".
    writeFileSync(join(templatesDir, "scripts/spec-drift-check.sh"), "echo drift\n");
    writeFileSync(join(templatesDir, "scripts/protect-branch.sh"), "echo protect\n");
    writeFileSync(join(templatesDir, "rules/git-policy.md"), "git v2\n");
    writeFileSync(join(templatesDir, "rules/cli-development.md"), "cli v1\n");
    writeFileSync(join(templatesDir, "agents/reviewer.md"), "core agent\n");
    writeFileSync(join(templatesDir, "agents/code-reviewer.md"), "ecc fallback agent\n");
    writeFileSync(join(projectDir, ".claude/rules/git-policy.md"), "git v1\n");
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
    });
  });

  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it("`.uzys-agent-harness/` 스크립트를 설치한다 — 배포판 룰이 호출하라고 적는 파일이다", () => {
    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(readFileSync(join(projectDir, ".uzys-agent-harness/spec-drift-check.sh"), "utf8")).toBe(
      "echo drift\n",
    );
    expect(readFileSync(join(projectDir, ".uzys-agent-harness/protect-branch.sh"), "utf8")).toBe(
      "echo protect\n",
    );
    expect(report.installedNew).toContain(".uzys-agent-harness/spec-drift-check.sh");
    expect(report.installedNew).toContain(".uzys-agent-harness/protect-branch.sh");
  });

  it("트랙이 요구하는 신규 룰·에이전트를 설치한다 (cli-development = tooling)", () => {
    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(readFileSync(join(projectDir, ".claude/rules/cli-development.md"), "utf8")).toBe(
      "cli v1\n",
    );
    expect(readFileSync(join(projectDir, ".claude/agents/reviewer.md"), "utf8")).toBe(
      "core agent\n",
    );
  });

  it("`.claude/` 자산은 claude 를 고른 설치본에만 들어간다 — codex 전용에 들이면 오염이다", () => {
    // install 은 `spec.cli` 에 claude 가 있을 때만 `.claude/` baseline 을 만든다
    // (codex/opencode 단독 사용자의 dead weight 회피). update 에 그 술어가 없으면 codex 로 깐
    // 프로젝트에 `.claude/` 하네스가 통째로 들어간다 — 고른 적 없는 CLI 의 설정이다.
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["codex"] },
      templates: { claudeDir: ".claude" },
      assets: [],
    });

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(existsSync(join(projectDir, ".claude/rules/cli-development.md"))).toBe(false);
    expect(existsSync(join(projectDir, ".claude/agents/reviewer.md"))).toBe(false);
    // CLI 중립 자산은 그대로 들어간다 — 그게 #283 이 신고한 바로 그 파일이다.
    expect(report.installedNew).toContain(".uzys-agent-harness/spec-drift-check.sh");
  });

  it("훅은 깔지 않고 재설치를 안내한다 — 배선 없는 훅은 파일만 늘고 실행은 0이다", () => {
    // update 는 `.claude/settings.json` 을 동기화하지 않는다(죽은 참조 제거만 한다). 그래서
    // 훅 파일만 놓으면 영영 안 도는데 화면은 "추가됨"이라 적는다 — 거짓출하 형태다.
    writeFileSync(join(templatesDir, "hooks/session-start.sh"), "echo hook\n");

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(existsSync(join(projectDir, ".claude/hooks/session-start.sh"))).toBe(false);
    expect(report.installedNew).not.toContain(".claude/hooks/session-start.sh");
    expect(report.needsReinstall).toContain(".claude/hooks/session-start.sh");
  });

  it("opt-in 에 달린 자산은 들이지 않는다 — update 는 그 선택을 복원할 수 없다", () => {
    // code-reviewer 는 `!withEcc` 게이팅(ECC plugin OFF 시의 fallback)이다. plugin 을 켠
    // 설치자에게 이걸 깔면 그가 끄기로 한 자산을 update 가 되살리는 셈이 된다.
    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(existsSync(join(projectDir, ".claude/agents/code-reviewer.md"))).toBe(false);
    expect(report.installedNew).not.toContain(".claude/agents/code-reviewer.md");
    // 0건 함정 방지 — 기능 자체가 꺼지면 위 두 단언은 공허하게 통과한다. 같은 실행에서
    // **걸러지지 않아야 할 것**이 실제로 깔렸는지 함께 본다.
    expect(report.installedNew).toContain(".claude/agents/reviewer.md");
  });

  it("이미 있는 파일은 덮어쓰지 않는다 — 갱신은 편집분 판정을 하는 경로의 몫이다", () => {
    mkdirSync(join(projectDir, ".uzys-agent-harness"), { recursive: true });
    writeFileSync(join(projectDir, ".uzys-agent-harness/protect-branch.sh"), "내가 고친 것\n");

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(readFileSync(join(projectDir, ".uzys-agent-harness/protect-branch.sh"), "utf8")).toBe(
      "내가 고친 것\n",
    );
    expect(report.installedNew).not.toContain(".uzys-agent-harness/protect-branch.sh");
    // 0건 함정 방지 — 기능이 꺼져도 위 단언은 통과한다. 같은 실행에서 **없던 것**은
    // 실제로 깔렸는지 함께 본다.
    expect(report.installedNew).toContain(".uzys-agent-harness/spec-drift-check.sh");
  });

  it("새로 깐 정책 파일이 기준선에 들어간다 — 다음 update 가 사용자 파일로 오판하면 안 된다", () => {
    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    const recorded = readInstallLog(projectDir)?.policyFiles ?? [];
    expect(recorded.map((f) => f.path)).toContain("rules/cli-development.md");
  });

  it("트랙 기록이 없으면 전 트랙 공통분만 깐다 — 모르는 트랙의 자산을 들이지 않는다", () => {
    rmSync(join(projectDir, ".uzys-agent-harness"), { recursive: true, force: true });
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: [], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
    });

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    // `applies: all` — 트랙과 무관하게 모든 설치본이 받는다.
    expect(report.installedNew).toContain(".uzys-agent-harness/spec-drift-check.sh");
    // tooling 트랙 전용 룰 — 트랙을 모르는 상태에서 들이면 Track 혼입이다.
    expect(existsSync(join(projectDir, ".claude/rules/cli-development.md"))).toBe(false);
  });
});

/**
 * 레거시 설치본 앵커 이행 (P5 · ADR-060).
 *
 * v26.140.0 이전 설치본의 하네스 앵커는 `.claude/CLAUDE.md` 다. 루트 앵커
 * (`CLAUDE-uzys-harness.md`)는 아예 없으므로, update 가 "이미 있을 때만 갱신"하면 그 사용자는
 * update 를 몇 번 돌려도 앵커가 옛 버전에 **영구 동결**되고 화면에도 아무 말이 안 뜬다.
 * ADR-060 「적용 범위」는 이 이행을 단언하는데 코드에는 없었다 — 이 describe 가 그 자리를 문다.
 */
describe("레거시 설치본 앵커 이행 (P5 · ADR-060)", () => {
  /** 사용자가 직접 쓴 루트 CLAUDE.md — 이행이 한 글자도 건드리면 안 되는 본문. */
  const USER_ROOT = "# 내 프로젝트\n\n우리 팀 규칙:\n- 커밋은 한국어로\n";
  const IMPORT_LINE = "@CLAUDE-uzys-harness.md";
  let projectDir = "";
  let templatesDir = "";

  const anchorPath = () => join(projectDir, "CLAUDE-uzys-harness.md");
  const rootPath = () => join(projectDir, "CLAUDE.md");
  const importCount = (s: string): number =>
    s.split("\n").filter((l) => l.trim() === IMPORT_LINE).length;

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-mig-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-mig-t-"));
    for (const d of ["rules", "agents", "commands/uzys", "hooks"]) {
      mkdirSync(join(templatesDir, d), { recursive: true });
      mkdirSync(join(projectDir, ".claude", d), { recursive: true });
    }
    writeFileSync(join(templatesDir, "CLAUDE.md"), "anchor-v2\n");
    // 레거시 상태: 앵커가 `.claude/` 안에 있고 루트 앵커는 없다.
    writeFileSync(join(projectDir, ".claude/CLAUDE.md"), "legacy-anchor-v1\n");
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  it("루트 앵커가 없으면 만들고 사용자 CLAUDE.md 에 import 를 얹는다", () => {
    writeFileSync(rootPath(), USER_ROOT);

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(existsSync(anchorPath()), "루트 앵커가 안 생겼다 — 이행이 일어나지 않았다").toBe(true);
    expect(readFileSync(anchorPath(), "utf8")).toBe("anchor-v2\n");
    expect(report.anchorCreated).toBe(true);
    expect(report.claudeMdUpdated).toBe(false);
    expect(report.rootImportAdded).toBe(true);

    const root = readFileSync(rootPath(), "utf8");
    expect(importCount(root), "import 줄이 없거나 중복이다").toBe(1);
    // 사용자 본문 무손실 — 이행이 덮어쓰기로 퇴화하면 이 줄들이 사라진다.
    for (const line of USER_ROOT.trimEnd().split("\n")) {
      expect(root).toContain(line);
    }
  });

  it("구 앵커는 지우지 않고 안내만 한다 — 사용자가 고쳤는지 update 는 판정할 수 없다", () => {
    writeFileSync(rootPath(), USER_ROOT);

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(existsSync(join(projectDir, ".claude/CLAUDE.md"))).toBe(true);
    expect(readFileSync(join(projectDir, ".claude/CLAUDE.md"), "utf8")).toBe("legacy-anchor-v1\n");
    expect(report.legacyAnchor, "구 앵커가 남았는데 안내 표면이 비어 있다").toBe(
      ".claude/CLAUDE.md",
    );
  });

  it("루트 CLAUDE.md 가 아예 없으면 스캐폴드 + import 로 만든다 (install 과 같은 계약)", () => {
    expect(existsSync(rootPath())).toBe(false);

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    const root = readFileSync(rootPath(), "utf8");
    expect(importCount(root)).toBe(1);
    expect(root).toContain("SCAFFOLD"); // fill-in 스캐폴드 배너
    expect(report.rootImportAdded).toBe(true);
  });

  it("이행한 앵커를 install log 에 기록한다 — uninstall 이 회수를 주장할 근거가 그것뿐이다", () => {
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date(0).toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude" },
      assets: [],
    });

    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(readInstallLog(projectDir)?.templates.rootClaudeMd).toEqual({
      path: "CLAUDE-uzys-harness.md",
      sha256: hashContent("anchor-v2\n"),
    });
  });

  it("import 가 이미 있으면 루트 CLAUDE.md 를 만지지 않는다 (앵커만 복구)", () => {
    // 사용자가 앵커 파일만 지운 상태. import 줄은 자기 손으로 적어 뒀다.
    const root = `${USER_ROOT}\n${IMPORT_LINE}\n`;
    writeFileSync(rootPath(), root);

    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(report.anchorCreated).toBe(true);
    expect(report.rootImportAdded, "이미 있는 import 를 또 얹었다").toBe(false);
    expect(readFileSync(rootPath(), "utf8"), "사용자 파일을 건드렸다").toBe(root);
  });

  it("이행은 1회 — 두 번째 update 는 갱신 경로로 떨어지고 import 는 1줄 그대로다", () => {
    writeFileSync(rootPath(), USER_ROOT);
    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    writeFileSync(join(templatesDir, "CLAUDE.md"), "anchor-v3\n");
    const second = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(second.anchorCreated).toBe(false);
    expect(second.claudeMdUpdated).toBe(true);
    expect(second.rootImportAdded).toBe(false);
    expect(readFileSync(anchorPath(), "utf8")).toBe("anchor-v3\n");
    expect(importCount(readFileSync(rootPath(), "utf8"))).toBe(1);
  });
});

/**
 * v26.126.0 (R-3a · ADR-046) — `.claude/skills/` 갱신.
 *
 * 왜 중요한가: 이전까지 update 의 대상 목록에 `skills` 가 없어서, 한 번 설치된 스킬은
 * 영원히 그 시점에 고정됐다. 스킬을 아무리 개선해도 **기존 사용자에게 갈 통로가 없었다.**
 * 통로를 뚫되 사용자가 고친 내용은 잃지 않는다는 것이 ADR-046 의 결정이다.
 */
describe("syncSkills (R-3a)", () => {
  let target = "";
  let source = "";

  beforeEach(() => {
    target = mkdtempSync(join(tmpdir(), "ch-sk-t-"));
    source = mkdtempSync(join(tmpdir(), "ch-sk-s-"));
  });
  afterEach(() => {
    rmSync(target, { recursive: true, force: true });
    rmSync(source, { recursive: true, force: true });
  });

  /** templates 에 스킬 하나, 프로젝트에도 설치돼 있는 상태를 만든다. */
  function seed(skill: string, file: string, sourceText: string, targetText: string): void {
    mkdirSync(join(source, skill), { recursive: true });
    mkdirSync(join(target, skill), { recursive: true });
    writeFileSync(join(source, skill, file), sourceText);
    writeFileSync(join(target, skill, file), targetText);
  }

  function backupsOf(skill: string): string[] {
    return readdirSync(join(target, skill)).filter((f) => f.includes(".backup-"));
  }

  it("사용자가 안 고쳤으면 백업 없이 덮어쓴다 — 개선분이 그대로 도달해야 한다", () => {
    seed("demo", "SKILL.md", "new\n", "old\n");
    const baseline = new Map([["demo/SKILL.md", hashContent("old\n")]]);

    const result = syncSkills(target, source, baseline);

    expect(readFileSync(join(target, "demo/SKILL.md"), "utf8")).toBe("new\n");
    expect(result.backedUp).toEqual([]);
    expect(backupsOf("demo")).toEqual([]);
    expect(result.updated).toBe(1);
  });

  it("사용자가 고쳤으면 백업을 남기고 최신판을 자리에 놓는다 — 둘 다 지켜야 한다", () => {
    seed("demo", "SKILL.md", "new\n", "my-edit\n");
    // 기준선은 설치 시점 원본. 디스크가 그와 다르다 = 사용자가 고쳤다.
    const baseline = new Map([["demo/SKILL.md", hashContent("original\n")]]);

    const result = syncSkills(target, source, baseline);

    // 최신판이 활성 (ADR-046: 최신판이 활성, 편집분이 백업 — 반대가 아니다)
    expect(readFileSync(join(target, "demo/SKILL.md"), "utf8")).toBe("new\n");
    expect(result.backedUp).toEqual(["demo/SKILL.md"]);
    // 편집분이 백업에 살아 있어야 한다 — 이게 깨지면 사용자 작업이 소실된다
    const backups = backupsOf("demo");
    expect(backups).toHaveLength(1);
    expect(readFileSync(join(target, "demo", backups[0] as string), "utf8")).toBe("my-edit\n");
  });

  it("기준선 기록이 없으면(레거시 설치) 보수적으로 백업한다 — 증명 없이 편집분을 지우지 않는다", () => {
    seed("demo", "SKILL.md", "new\n", "unknown-origin\n");

    const result = syncSkills(target, source, new Map());

    expect(result.backedUp).toEqual(["demo/SKILL.md"]);
    expect(readFileSync(join(target, "demo/SKILL.md"), "utf8")).toBe("new\n");
  });

  it("이미 최신이면 아무것도 안 한다 — 재실행이 백업 노이즈를 쌓으면 안 된다", () => {
    seed("demo", "SKILL.md", "same\n", "same\n");

    const result = syncSkills(target, source, new Map()); // 기준선 없어도 내용이 같으면 무동작

    expect(result.updated).toBe(0);
    expect(result.backedUp).toEqual([]);
    expect(backupsOf("demo")).toEqual([]);
  });

  it("설치 안 된 스킬은 새로 깔지 않는다 — update 가 고르지 않은 자산을 들이면 안 된다", () => {
    mkdirSync(join(source, "not-chosen"), { recursive: true });
    writeFileSync(join(source, "not-chosen", "SKILL.md"), "x\n");

    const result = syncSkills(target, source, new Map());

    expect(existsSync(join(target, "not-chosen"))).toBe(false);
    expect(result.updated).toBe(0);
  });

  it("설치된 스킬 안에 새로 생긴 파일은 가져온다 — 스킬의 일부다", () => {
    seed("demo", "SKILL.md", "s\n", "s\n");
    mkdirSync(join(source, "demo/references"), { recursive: true });
    writeFileSync(join(source, "demo/references/deep.md"), "ref\n");

    const result = syncSkills(target, source, new Map());

    expect(readFileSync(join(target, "demo/references/deep.md"), "utf8")).toBe("ref\n");
    expect(result.updated).toBe(1);
  });

  it("templates 에 없는 사용자 파일은 지우지 않는다 — prune 하면 사용자 파일 삭제다", () => {
    seed("demo", "SKILL.md", "new\n", "old\n");
    writeFileSync(join(target, "demo/my-notes.md"), "mine\n");

    syncSkills(target, source, new Map([["demo/SKILL.md", hashContent("old\n")]]));

    expect(readFileSync(join(target, "demo/my-notes.md"), "utf8")).toBe("mine\n");
  });

  /**
   * 회귀 가드 (2026-08-02 · ADR-062 · 계획 리뷰 P0-6).
   *
   * `npx skills add` 의 프로젝트 스코프 설치처가 `.claude/skills/<id>` 이고 그 실체는 사용자의
   * skills 저장소로 가는 **링크**다. 위 판정은 `existsSync(targetSkill)` 하나였는데 그 함수는
   * 링크를 따라가므로, "우리가 깐 디렉터리"와 "남의 저장소를 가리키는 링크"가 같은 값을 준다.
   * 그 상태로 쓰면 하네스가 `.claude/` **밖**에 있는 사용자 저장소 본문을 덮어쓴다 — 백업이
   * 남아도 사용자가 찾아갈 자리가 아니다.
   *
   * 그래서 단언은 "건너뛰었다"가 아니라 **링크 대상 파일이 한 바이트도 안 변했다**로 쓴다.
   * 반환값만 보면 건너뛰었다고 보고하면서 실제로는 쓰는 구현이 통과한다.
   */
  it("target 스킬이 심볼릭 링크면 건너뛴다 — 링크 대상(남의 저장소)을 덮어쓰지 않는다", () => {
    // 링크가 가리킬 "사용자의 skills 저장소".
    const foreignRepo = mkdtempSync(join(tmpdir(), "ch-sk-foreign-"));
    try {
      const foreignSkill = join(foreignRepo, "demo");
      mkdirSync(foreignSkill, { recursive: true });
      writeFileSync(join(foreignSkill, "SKILL.md"), "their-body\n");

      // templates 쪽엔 같은 이름의 우리 판본이 있다.
      mkdirSync(join(source, "demo"), { recursive: true });
      writeFileSync(join(source, "demo", "SKILL.md"), "our-body\n");

      // 프로젝트의 .claude/skills/demo 는 그 저장소로 가는 링크다.
      symlinkSync(foreignSkill, join(target, "demo"), "dir");

      const result = syncSkills(target, source, new Map());

      // 핵심 단언 — 링크 대상 본문 무변경.
      expect(readFileSync(join(foreignSkill, "SKILL.md"), "utf8")).toBe("their-body\n");
      // 백업 파일도 만들지 않는다 (남의 저장소에 우리 부산물을 남기지 않는다).
      expect(readdirSync(foreignSkill)).toEqual(["SKILL.md"]);
      expect(result.updated).toBe(0);
      // 침묵 금지 — 건너뛴 사실을 보고한다.
      expect(result.skippedLinks).toEqual(["demo"]);
    } finally {
      rmSync(foreignRepo, { recursive: true, force: true });
    }
  });

  it("링크가 아닌 스킬은 같은 실행에서 정상 갱신된다 — 가드가 전체를 멈추지 않는다", () => {
    const foreignRepo = mkdtempSync(join(tmpdir(), "ch-sk-foreign2-"));
    try {
      const foreignSkill = join(foreignRepo, "linked");
      mkdirSync(foreignSkill, { recursive: true });
      writeFileSync(join(foreignSkill, "SKILL.md"), "their-body\n");
      mkdirSync(join(source, "linked"), { recursive: true });
      writeFileSync(join(source, "linked", "SKILL.md"), "our-body\n");
      symlinkSync(foreignSkill, join(target, "linked"), "dir");

      seed("owned", "SKILL.md", "new\n", "old\n");

      const result = syncSkills(
        target,
        source,
        new Map([["owned/SKILL.md", hashContent("old\n")]]),
      );

      expect(readFileSync(join(foreignSkill, "SKILL.md"), "utf8")).toBe("their-body\n");
      expect(readFileSync(join(target, "owned/SKILL.md"), "utf8")).toBe("new\n");
      expect(result.updated).toBe(1);
      expect(result.skippedLinks).toEqual(["linked"]);
    } finally {
      rmSync(foreignRepo, { recursive: true, force: true });
    }
  });
});

/**
 * 기준선 갱신 회귀 (v26.126.0).
 *
 * `runUpdateInstall`(installer.ts) 은 install log 를 쓰지 않는 **단축 경로**다. 그래서
 * `runUpdateMode` 가 갱신 직후 기준선을 다시 찍지 않으면, 다음 update 가 **자기가 방금
 * 덮어쓴 파일**을 "사용자가 고쳤다"로 오판해 백업본을 매 릴리즈마다 쌓는다.
 * 이 테스트가 죽으면 사용자의 `.claude/skills/` 가 백업 파일로 오염된다.
 */
describe("스킬 기준선 갱신 (R-3a)", () => {
  let projectDir = "";
  let templatesDir = "";

  beforeEach(() => {
    projectDir = mkdtempSync(join(tmpdir(), "ch-base-p-"));
    templatesDir = mkdtempSync(join(tmpdir(), "ch-base-t-"));
    for (const d of ["rules", "agents", "commands/uzys", "hooks"]) {
      mkdirSync(join(templatesDir, d), { recursive: true });
      mkdirSync(join(projectDir, ".claude", d), { recursive: true });
    }
    mkdirSync(join(templatesDir, "skills/demo"), { recursive: true });
    mkdirSync(join(projectDir, ".claude/skills/demo"), { recursive: true });
    writeFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "v1\n");
  });
  afterEach(() => {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(templatesDir, { recursive: true, force: true });
  });

  function writeLog(): void {
    writeInstallLog(projectDir, {
      schemaVersion: 1,
      installedAt: new Date().toISOString(),
      scope: "project",
      spec: { tracks: ["tooling"], cli: ["claude"] },
      templates: { claudeDir: ".claude/" },
      assets: [],
      skillFiles: [{ path: "demo/SKILL.md", sha256: hashContent("v1\n") }],
    });
  }

  function backupCount(): number {
    return readdirSync(join(projectDir, ".claude/skills/demo")).filter((f) =>
      f.includes(".backup-"),
    ).length;
  }

  it("연속 update 가 백업본을 쌓지 않는다 — 기준선이 매번 갱신되기 때문", () => {
    writeLog();

    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v2\n");
    const first = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);
    expect(first.skillsBackedUp).toEqual([]);

    // 두 번째 릴리즈. 기준선이 v2 로 갱신됐어야 "사용자가 안 고쳤다"로 올바르게 판정된다.
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v3\n");
    const second = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(second.skillsBackedUp).toEqual([]);
    expect(backupCount()).toBe(0);
    expect(readFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "utf8")).toBe("v3\n");
    expect(readInstallLog(projectDir)?.skillFiles).toEqual([
      { path: "demo/SKILL.md", sha256: hashContent("v3\n") },
    ]);
  });

  it("사용자가 중간에 고치면 그때는 백업한다 — 갱신이 판정을 무디게 만들면 안 된다", () => {
    writeLog();
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v2\n");
    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    // 사용자가 v2 를 자기 것으로 고친다
    writeFileSync(join(projectDir, ".claude/skills/demo/SKILL.md"), "my-edit\n");
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v3\n");
    const report = runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(report.skillsBackedUp).toEqual(["demo/SKILL.md"]);
    expect(backupCount()).toBe(1);
  });

  it("install log 가 없으면 만들지 않는다 — update 가 설치 기록을 날조하면 uninstall 이 그걸 믿는다", () => {
    writeFileSync(join(templatesDir, "skills/demo/SKILL.md"), "v2\n");

    runUpdateMode(projectDir, templatesDir, HARNESS_ROOT);

    expect(readInstallLog(projectDir)).toBeNull();
  });
});

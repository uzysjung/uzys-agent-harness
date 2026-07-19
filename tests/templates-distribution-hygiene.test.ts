import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { INTERNAL_BUNDLED_SKILL_IDS } from "../src/external-assets.js";
import { listFilesRecursive } from "../src/fs-ops.js";
import { type AssetSpec, buildManifest } from "../src/manifest.js";
import type { Track } from "../src/types.js";

/**
 * `templates/` 중 **실제로 사용자 프로젝트에 설치되는 것**의 위생 게이트.
 *
 * WHY: v26.127.0 까지 게시된 npm 패키지에 **사용자의 비공개 프로젝트 내용**이 실려 있었다 —
 *   `gh-issue-workflow` 에 다른 프로젝트의 실제 이슈 본문(기능명·가격 페이지 결정)이 30줄,
 *   `ui-visual-review` 에는 또 다른 프로젝트 이름이 **frontmatter description** 에까지 들어가
 *   상주 컨텍스트를 차지했다. 이 리포의 사건 기록(태그 rename 이력·ADR 번호)도 섞여 있었다.
 *
 * 유출 5건이 전부 같은 문장 형태였다 — **"<프로젝트명>의 실제 패턴을 일반화"**. 원인은 우연이
 * 아니라 *출처를 이름으로 귀속하는 글쓰기 습관*이고, 이 게이트는 그 습관을 겨냥한다.
 *
 * 검사 범위를 **manifest 에서 derive** 한다(열거 금지 — `no-false-ship`). 새 자산이 추가되면
 * 게이트를 고치지 않아도 자동으로 커버되고, 반대로 배포되지 않는 내부 문서
 * (`templates/codex/README.md` 등)는 애초에 대상이 아니다.
 *
 * **한계를 정직하게**: 이 게이트는 *그 습관 + 구체 좌표*를 잡지 "모든 유출"을 잡지 못한다.
 * 고유명사 허용목록도 검토했으나 대문자 토큰이 1,605종이라 유지 불가로 기각했다.
 */

const TEMPLATES = resolve(__dirname, "../templates");
const ALL_TRACKS: ReadonlyArray<Track> = [
  "tooling",
  "csr-supabase",
  "ssr-nextjs",
  "data",
  "full",
] as ReadonlyArray<Track>;

/** upstream cherry-pick 자산 — 우리가 고치면 sync 가 되돌린다. 표식 있는 면제. */
const UPSTREAM_VENDORED = ["skills/continuous-learning-v2"];

/** 설치 대상 = manifest 가 선언한 source 들. 디렉터리면 그 아래 전부. */
function distributedFiles(): string[] {
  const spec = {
    tracks: ALL_TRACKS,
    cli: ["claude", "codex", "opencode", "antigravity"],
    options: {},
    selectedInternalSkills: INTERNAL_BUNDLED_SKILL_IDS,
  } as unknown as AssetSpec;

  const out = new Set<string>();
  for (const entry of buildManifest(spec)) {
    const abs = join(TEMPLATES, entry.source);
    if (!existsSync(abs)) continue;
    if (UPSTREAM_VENDORED.some((v) => entry.source.startsWith(v))) continue;
    if (statSync(abs).isDirectory()) {
      for (const rel of listFilesRecursive(abs)) out.add(`${entry.source}/${rel}`);
    } else {
      out.add(entry.source);
    }
  }
  return [...out].filter((f) => /\.(md|sh|ya?ml|toml)$/.test(f));
}

function scan(pattern: RegExp): string[] {
  const hits: string[] = [];
  for (const rel of distributedFiles()) {
    readFileSync(join(TEMPLATES, rel), "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 120)}`);
      });
  }
  return hits;
}

describe("배포되는 templates 의 위생", () => {
  it("설치 대상 파일을 실제로 찾는다 (헛통과 차단)", () => {
    // 범위가 비면 아래 검사가 전부 공허하게 통과한다.
    expect(distributedFiles().length).toBeGreaterThan(20);
  });

  /**
   * 출처 귀속 = 유출의 문법. 일반화했으면 **일반화된 것만** 남긴다 — 어느 프로젝트에서 왔는지는
   * 설치자에게 의미가 없고, 그 문장을 쓰는 순간 그 프로젝트의 구체 내용이 딸려 들어온다.
   * 고유명사(대문자/하이픈 토큰)가 앞에 붙은 경우만 잡는다 — "많은 프로젝트의 실제 목표" 같은
   * 일반 서술은 통과해야 한다.
   */
  it("다른 프로젝트를 출처로 인용하지 않는다", () => {
    const hits = scan(
      /[A-Z][A-Za-z0-9]*[-_]?[A-Za-z0-9]*\s*(프로젝트|의)\s*(실제|수동|운용)|[A-Z][A-Za-z0-9-]{3,}\s*프로젝트의|real[- ]world pattern from\s+[A-Z]/,
    );
    expect(
      hits,
      `templates 는 배포물이다 — 출처 프로젝트를 이름으로 인용하지 말고 패턴만 남겨라:\n${hits.join("\n")}`,
    ).toEqual([]);
  });

  /**
   * 구체 좌표(우리 릴리스 태그·ADR 번호·홈 경로·실제 GitHub 핸들)는 설치자에게 가리키는 대상이
   * 없다. 자리표시자(`vX.Y.Z` · `ADR-0NN` · `<you>`)로 쓴다.
   */
  it("이 리포/사용자 고유 좌표를 남기지 않는다", () => {
    const hits = scan(
      /\bv\d{2}\.\d+\.\d+|\bADR-\d{3}\b|\/Users\/[a-z]|github\.com\/(users|orgs)\/(?!<)[a-zA-Z0-9-]+/,
    );
    expect(hits, `자리표시자로 바꿔라 (vX.Y.Z · ADR-0NN · <you>):\n${hits.join("\n")}`).toEqual([]);
  });

  /**
   * 워크스페이스 형제 디렉터리 = 사용자의 다른 프로젝트들. **로컬에서만 알 수 있다** —
   * CI 에서는 못 도므로 조용히 통과시키지 않고 로그로 남긴다(`no-false-ship`: 미검증은 미검증).
   */
  it("워크스페이스 형제 프로젝트 이름이 새지 않는다 (로컬 한정)", () => {
    const siblings = workspaceSiblings();
    if (siblings === null) return;
    const hits = scan(siblingPattern(siblings));
    expect(hits, `다른 프로젝트 이름이 배포물에 있다:\n${hits.join("\n")}`).toEqual([]);
  });

  /**
   * **범위가 `templates/` 만이 아니다.** 처음 이 게이트를 만들 때 templates 만 훑었는데,
   * 실제로는 `dist/` 에도 사설 프로젝트 이름이 번들돼 게시되고 있었다 (소스 주석이 그대로
   * 컴파일된 것). "다 고쳤다"고 말할 뻔한 지점이다.
   *
   * 그래서 검사 대상을 **`package.json` 의 `files` 에서 derive** 한다 — 게시 계약 자체가
   * SSOT 이므로 나중에 새 경로를 게시 목록에 넣어도 게이트를 고칠 필요가 없다.
   * `dist` 는 생성물이라 원본인 `src` 를 대신 본다 (고치는 자리가 거기다).
   */
  it("게시되는 전 표면에 다른 프로젝트 이름이 없다 (로컬 한정)", () => {
    const siblings = workspaceSiblings();
    if (siblings === null) return;

    const repoRoot = resolve(__dirname, "..");
    const published = (
      JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).files as string[]
    ).map((f) => (f === "dist" ? "src" : f)); // 생성물 → 원본

    const pattern = siblingPattern(siblings);
    const hits: string[] = [];
    for (const entry of published) {
      const abs = join(repoRoot, entry);
      if (!existsSync(abs)) continue;
      const files = statSync(abs).isDirectory()
        ? listFilesRecursive(abs).map((r) => join(entry, r))
        : [entry];
      for (const rel of files) {
        if (!/\.(md|sh|ya?ml|toml|ts|js|json)$/.test(rel)) continue;
        readFileSync(join(repoRoot, rel), "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (pattern.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 110)}`);
          });
      }
    }
    expect(
      hits,
      `게시 대상에 다른 프로젝트 이름이 있다 (package.json files 기준):\n${hits.join("\n")}`,
    ).toEqual([]);
  });
});

/** 워크스페이스 형제 = 사용자의 다른 프로젝트들. 못 읽으면 null (CI) — 조용히 통과시키지 않고 알린다. */
function workspaceSiblings(): string[] | null {
  try {
    const workspace = resolve(__dirname, "../..");
    const names = readdirSync(workspace, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      // 영어 단어에 부분일치하는 짧은 이름(`temp` ⊂ `template`)은 오탐만 낳는다 → 6자 이상.
      .filter((n) => !n.startsWith(".") && n !== "uzysClaudeUniversalEnv" && n.length >= 6)
      // git worktree 는 **별도 프로젝트가 아니라 브랜치**다. 디렉터리명에 브랜치명이 섞여
      // (`ea-wt-evidence`) 흔한 영어 단어를 후보로 만들어 오탐만 낳는다. 본체는 부모
      // 디렉터리 이름으로 이미 커버된다. 판별: worktree 의 `.git` 은 디렉터리가 아니라 파일.
      .filter((n) => {
        const dotGit = join(workspace, n, ".git");
        return !existsSync(dotGit) || statSync(dotGit).isDirectory();
      });
    if (names.length === 0) {
      console.warn("[배포 위생] 형제 프로젝트 0개(CI 환경으로 보임) — 이 검사 미수행.");
      return null;
    }
    return names;
  } catch {
    console.warn("[배포 위생] 워크스페이스를 못 읽었다 — 이 검사 미수행.");
    return null;
  }
}

/**
 * 디렉터리 이름 **그대로만** 찾으면 못 잡는다 — 실제 유출은 짧은 형태로 나타났다:
 * 형제가 `DYLD-GoalTrack` 인데 문서에는 `GoalTrack`, `dyld_vantage` 인데 `Vantage` 였다.
 * 그래서 구분자로 쪼갠 **조각**까지 후보에 넣는다. 5자 미만 조각은 흔한 영어 단어에
 * 부분일치해 오탐만 낳으므로 버린다(`dyld`·`WIKI` 등).
 *
 * 이 함수는 음성 대조에서 **살아남은 뒤** 고친 것이다 — 원래 정확일치만 해서
 * `GoalTrack` 주입을 통과시켰다. 초록불이 무는지 확인하지 않았으면 그대로 실렸다.
 */
function siblingPattern(siblings: ReadonlyArray<string>): RegExp {
  const candidates = new Set<string>();
  for (const name of siblings) {
    candidates.add(name);
    for (const frag of name.split(/[-_.]/)) {
      if (frag.length >= 5) candidates.add(frag);
    }
  }
  const escaped = [...candidates].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${escaped.join("|")})\\b`, "i");
}

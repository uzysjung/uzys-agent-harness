import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BASELINE_KINDS } from "../src/baseline-targets.js";
import {
  DEV_METHOD_SKILL_IDS,
  EXTERNAL_ASSETS,
  INTERNAL_BUNDLED_SKILL_IDS,
} from "../src/external-assets.js";
import { buildManifest } from "../src/manifest.js";
import { CLI_BASES, INSTALL_SCOPES, TRACKS } from "../src/types.js";

/**
 * 문서가 이름으로 가리키는 자산이 실재하는가 (#338).
 *
 * WHY: 안내 문서가 **제거된 자산을 계속 안내**하고 있었다. 실측 6건 — `c-level-skills`(2026-08-02
 * 카탈로그에서 제거) · `karpathy-coder`(ADR-060) · `railway-plugin`(v0.6.3, upstream repo 부재) ·
 * `gates-taxonomy`·`nextjs`(룰 제거) · `mcp-pre-exec`(ADR-072 훅 제거) + upstream 저장소 2건
 * (`pbakaus/impeccable` · `K-Dense-AI/scientific-agent-skills`). 총계 게이트
 * (`docs-supply-chain`)는 **분모 숫자**만 봤기 때문에 이름 하나하나는 전부 통과했다.
 *
 * 읽는 사람에게 이 상태는 "따라 해도 안 되는 안내"다 — `--with c-level-skills` 는 실패하고,
 * `/ecc:` 명령은 존재하지 않는다. 자산 제거는 앞으로도 계속 일어나므로(북극성 = 필요한 틀만
 * 남긴다) 프로즈로는 못 막는다.
 *
 * 어휘를 **코드·디스크에서 derive** 하는 이유: 이름 목록을 이 파일에 옮겨 적으면 그게 곧 두 번째
 * 하드코딩 사본이고, 자산이 늘 때마다 게이트가 빨개져서 결국 아무도 안 돌린다.
 *
 * **아직 못 잡는 것 (알려진 한계)**: 슬래시 명령 이름(`/polish`·`/ecc:eval`)은 판정 밖이다.
 * 선두 `/` 때문에 두 형태 정규식에 다 탈락하고, 더 근본적으로는 **판정 기준이 없다** — 명령은
 * upstream 플러그인이 정의하므로 이 저장소가 실재를 확인할 방법이 없다. 그래서 이 PR 은 문서에서
 * 명령 이름 표를 지우고 `/help` 를 가리키는 쪽을 택했다. 이 한계는 별도 이슈로 추적한다.
 */

const REPO_ROOT = resolve(__dirname, "..");

/**
 * 판정 모집단 — **자산을 이름으로 안내하는 사용자 도달 문서**.
 *
 * 하드코딩인 이유는 실측이다. 사용자 도달 문서 전체(17종)로 넓히면 derive 후에도 잔여가
 * **47** 개로 늘고 그중 `const`·`throw`·`relevant`·`feat` 같은 **평범한 낱말**이 섞인다
 * (`CONTRIBUTING.md`·`docs/SPEC.md`·`docs/NORTH_STAR.md`·`docs/todo.md` 발). 그 목록을
 * allowlist 로 받으면 문서에 낱말 하나 추가할 때마다 빨개지는 게이트가 된다. 아래 7종으로
 * 좁히면 잔여가 **14** 개이고 그중 6개가 실제 결함, 남는 8개가 범주어·npmrc 키·과거 kind 다
 * (실측 2026-08-17). 목록 누락은 아래 `자산 안내 문서 누락 감지` 가 따로 문다.
 */
const GUIDE_DOCS: readonly string[] = [
  "README.md",
  "README.ko.md",
  "docs/USAGE.md",
  "docs/TRACKS.md",
  "docs/REFERENCE.md",
  "docs/COMPATIBILITY.md",
  "docs/WORKFLOWS.md",
  // 배포 앵커. 사용자 문서 목록에 안 보이지만 **모든 설치**에 `CLAUDE-uzys-harness.md` 로 나가고
  // 매 세션 상주하므로, 잘못된 이름의 피해가 가장 큰 자리다. 지금도 자산 id 3개를 지목한다.
  // 경로 필터가 `templates/` 를 통째로 제외해 누락 감지에도 안 걸리던 사각이었다(#338 리뷰 MED-7).
  "templates/CLAUDE.md",
];

/**
 * derive 로 덮이지 않는, 자산이 **아닌** 토큰. 전부 안정적인 축이라 자산 증감과 무관하다.
 * 새 항목을 넣을 때는 "이것이 자산 id 가 아닌 이유"를 한 줄로 남긴다 — 이유 없는 추가는
 * 게이트를 조용히 무력화하는 가장 싼 경로다.
 */
const NOT_AN_ASSET: ReadonlyMap<string, string> = new Map([
  ["condition", "카탈로그 엔트리의 필드 이름"],
  ["tier", "카탈로그 엔트리의 필드 이름"],
  ["files", "`package.json` 의 게시 계약 키"],
  ["backup", "설치 요약의 행 라벨 (`backup` rows)"],
  ["auto-install-peers", "pnpm 계열 .npmrc 키 — Troubleshooting 예시"],
  ["npm-global", "v26.64.0 마이그레이션 노트가 인용하는 **과거** method kind"],
  ["instructions", "`opencode.json` 의 설정 키"],
]);

/**
 * 줄 단위 면제 표식. **제거 이력을 설명하는 문장은 없어진 이름을 불러야 한다** — "`X` 는 제거됐다"를
 * 못 쓰게 하면 문서가 왜 바뀌었는지 적을 수단이 사라진다.
 *
 * 이름이 아니라 **줄**을 면제하는 이유: 이름을 면제하면 "설치하려면 `X`" 같은 새 stale 안내가 같은
 * 이름으로 되살아나도 통과한다. 줄 표식은 그 자리에서만 열린다. (같은 형태의 선례 =
 * `docs-supply-chain` 의 `<!-- catalog-total:frozen -->`.)
 */
const HISTORICAL_MARKER = "<!-- ref:removed -->";

/**
 * 우리가 **설치하지 않는** 외부 저장소. WORKFLOWS.md 는 워크플로 큐레이션의 근거로 경쟁·기각
 * 대상을 이름으로 인용한다 — 카탈로그에 없는 것이 정상이고, 없다는 사실 자체가 그 문서의 주장이다.
 * 새 항목에는 "왜 우리 자산이 아닌가"를 남긴다.
 */
const NOT_OUR_ASSET_REPO: ReadonlyMap<string, string> = new Map([
  ["github/spec-kit", "비교 대상 — uv/Python 의존으로 기각(WORKFLOWS.md §트레이드오프)"],
  ["snarktank/ralph", "Ralph 기법의 외부 패키징 — 큐레이션 세트 미포함"],
  ["mikeyobrien/ralph-orchestrator", "같은 사유 — 큐레이션 세트 미포함"],
  ["ghuntley/loom", 'proprietary("do not use") — 명시적 제외'],
  // MCP 서버의 upstream. `.mcp.json` 항목이라 카탈로그 자산이 아니고 `tier` 도 없다 — 이름의
  // SSOT 는 `templates/mcp.json` 의 패키지 인자이지 저장소 경로가 아니다.
  ["ChromeDevTools/chrome-devtools-mcp", "MCP 서버 upstream — 카탈로그 자산 아님"],
  ["modelcontextprotocol/servers", "MCP 서버 upstream — 카탈로그 자산 아님"],
  // 셋째. 앞의 둘과 달리 이건 이전 판본에서 **조용히 통과**했다 — 카탈로그 파일에
  // `@upstash/context7-mcp` 라는 패키지 문자열이 있어 부분 문자열 대조에 걸렸기 때문이다.
  // 정확 일치로 바꾸자 드러났고, 셋을 같은 자리에 적는 것이 맞다(라운드 2 MED-N5).
  ["upstash/context7-mcp", "MCP 서버 upstream — 카탈로그 자산 아님"],
]);

/** 자산 id 로 오인될 수 있는 형태 — 소문자·숫자·하이픈만, 4자 이상. */
const ASSET_SHAPE = /^[a-z0-9][a-z0-9-]{2,}[a-z0-9]$/;
/** `owner/repo` 형태. 저장소 내 경로도 같은 모양이라 실재 여부로 갈라낸다. */
const SLASHED = /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/;
const INLINE_CODE = /`([^`\n]+)`/g;
/**
 * 마크다운 링크의 GitHub 저장소 — `[addyosmani/agent-skills](https://github.com/addyosmani/…)`.
 *
 * 백틱 밖이라 인라인 코드 수집에 안 걸린다. 리뷰가 변이로 실증한 누수 경로이고(#338 MED-6 · M2),
 * 삭제된 §1 표의 출처 열이 정확히 이 형태였다 — 즉 이 PR 이 지운 결함을 게이트가 못 잡고 있었다.
 */
const MD_LINK_REPO = /\]\(https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:[/#)?]|\.git)/g;
/**
 * 링크 **텍스트**가 `owner/repo` 인 형태 — `[pbakaus/impeccable](아무 URL)`.
 *
 * URL 쪽만 보면 npmjs·gitlab 등 github 아닌 링크로 그대로 샜다(#338 라운드 2 LOW-N1ⓐ 가 변이로
 * 실증). 사람이 읽는 것은 텍스트 쪽이므로 주장도 거기 있다.
 */
const MD_LINK_TEXT_REPO =
  /\[([\w.-]+\/[\w.-]+)\]\((?:https?:\/\/)?(?:www\.)?(?:github|gitlab|bitbucket|npmjs)\.com\//g;

/** 디렉터리의 항목 이름 (확장자 제거). 없는 디렉터리는 빈 배열 — 수집기 하한이 사망을 잡는다. */
function entryNames(dir: string): string[] {
  try {
    return readdirSync(join(REPO_ROOT, dir)).map((n) =>
      n.replace(/\.(sh|mjs|json|md|ts|tsv|yml|yaml)$/, "").replace(/\.test$/, ""),
    );
  } catch {
    return [];
  }
}

/** 이 저장소가 정의하는 모든 이름. 값이 아니라 **출처**까지 담아 실패 메시지를 읽히게 한다. */
function buildVocabulary(): Map<string, string> {
  const vocab = new Map<string, string>();
  const add = (token: unknown, from: string): void => {
    if (typeof token !== "string" || token === "") return;
    if (!vocab.has(token)) vocab.set(token, from);
  };

  for (const a of EXTERNAL_ASSETS) {
    add(a.id, "카탈로그 자산 id");
    add(a.tier, "trust tier");
    add(a.category, "카탈로그 카테고리");
    add(a.source, "자산 출처(owner)");
    add(a.condition.kind, "condition kind");
    // method 의 문자열 필드 전부 — kind·source·skill·pkg·pluginId·marketplace·script.
    // 키를 열거하지 않는 이유: method 종류가 늘면 여기가 조용히 뒤처진다.
    for (const v of Object.values(a.method as Record<string, unknown>)) add(v, "자산 method 값");
  }
  for (const t of TRACKS) add(t, "트랙");
  for (const c of CLI_BASES) add(c, "CLI");
  for (const s of INSTALL_SCOPES) add(s, "설치 scope");
  for (const k of BASELINE_KINDS) add(k, "baseline 종류");
  for (const s of INTERNAL_BUNDLED_SKILL_IDS) add(s, "번들 스킬");
  for (const s of DEV_METHOD_SKILL_IDS) add(s, "dev-method 스킬");

  // manifest 가 실제로 깔 대상 이름 — 룰·에이전트·훅·스킬을 전수로 얻는 유일한 방법이다.
  // ECC opt-out 게이팅(C2)이 걸린 자산은 withEcc 양쪽을 다 돌지 않으면 절반이 빠진다.
  for (const withEcc of [false, true]) {
    for (const e of buildManifest({ tracks: [...TRACKS], withEcc, withTauri: true })) {
      const rest = e.target.replace(/^\.claude\//, "");
      for (const seg of rest.split("/"))
        add(seg.replace(/\.(md|sh|json)$/, ""), "manifest 설치 대상");
    }
  }

  // MCP 서버 이름 — `.mcp.json` 의 기본 3종과 트랙 조건부 행. 문서가 이름으로 안내하는 대상이라
  // 자산과 같은 축이다. 두 출처를 다 읽는 이유: 기본은 템플릿, 조건부는 tsv 가 SSOT 다.
  const mcpTemplate = JSON.parse(
    readFileSync(join(REPO_ROOT, "templates", "mcp.json"), "utf8"),
  ) as {
    mcpServers?: Record<string, unknown>;
  };
  for (const n of Object.keys(mcpTemplate.mcpServers ?? {})) add(n, "기본 MCP 서버");
  for (const line of readFileSync(join(REPO_ROOT, "templates", "track-mcp-map.tsv"), "utf8").split(
    "\n",
  )) {
    if (line.startsWith("#") || line.trim() === "") continue;
    add(line.split("\t")[0], "트랙 조건부 MCP 서버");
  }

  for (const dir of [
    "scripts",
    "templates/scripts",
    "templates/rules",
    "templates/hooks",
    "templates/agents",
    "templates/skills",
    "src",
    "src/commands",
    "tests",
    ".github/workflows",
  ])
    for (const n of entryNames(dir)) add(n, `${dir}/`);

  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    name: string;
    scripts?: Record<string, string>;
    repository?: { url?: string };
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  // 툴체인 이름(vitest·biome·tsup…)도 문서가 명령과 함께 부른다.
  for (const d of [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ])
    add(d.split("/").pop(), "의존성");
  add(pkg.name.split("/").pop(), "패키지명");
  // 저장소 이름은 `repository.url` 에서 뽑는다 — 작업 디렉터리 이름은 클론마다 달라 근거가 못 된다.
  const repoPath = (pkg.repository?.url ?? "")
    .replace(/^.*github\.com\//, "")
    .replace(/\.git$/, "");
  add(repoPath, "이 저장소(owner/repo) — 배지·데모 GIF 링크가 이 형태로 나온다");
  add(basename(repoPath), "저장소명");
  for (const s of Object.keys(pkg.scripts ?? {})) add(s, "npm script");

  return vocab;
}

interface Ref {
  file: string;
  token: string;
}

/** GUIDE_DOCS 의 인라인 코드에서 자산 id 형태 · owner/repo 형태를 각각 수집. */
function collectRefs(): { shaped: Ref[]; slashed: Ref[]; exempted: number } {
  const shaped: Ref[] = [];
  const slashed: Ref[] = [];
  let exempted = 0;
  for (const file of GUIDE_DOCS) {
    for (const line of readFileSync(join(REPO_ROOT, file), "utf8").split(/\r?\n/)) {
      if (line.includes(HISTORICAL_MARKER)) {
        exempted += 1;
        continue;
      }
      for (const m of line.matchAll(INLINE_CODE)) {
        const token = (m[1] ?? "").trim();
        if (SLASHED.test(token)) slashed.push({ file, token });
        else if (ASSET_SHAPE.test(token)) shaped.push({ file, token });
      }
      // 백틱 밖의 GitHub 링크도 같은 축의 주장이다.
      for (const re of [MD_LINK_REPO, MD_LINK_TEXT_REPO]) {
        for (const m of line.matchAll(re)) {
          const token = m[1] ?? "";
          if (token !== "") slashed.push({ file, token });
        }
      }
    }
  }
  return { shaped, slashed, exempted };
}

/**
 * 광고된 **설치 명령**에서 카탈로그가 알아야 하는 식별자를 뽑는다.
 *
 * 2026-08-17 — `tests/reference-catalog-rows.test.ts` 를 여기로 흡수했다(#338). 그 게이트는
 * REFERENCE.md **한 문서만** 봤고, 그 문서가 자산별 설치 명령 표를 버리자 모집단이 0 이 되어
 * 자기 liveness 단언(`> 5`)에 걸렸다. 계약을 잃지 않으려면 넓히는 것이 답이다 — 같은 추출기를
 * 안내 문서 7종 전체에 돌린다. 인라인 코드만 보는 위쪽 판정과 달리 **줄 전체**를 보므로 펜스
 * 안의 명령도 잡힌다.
 *
 * 대조 방식은 원래 게이트의 핵심을 그대로 가져왔다: `includes(이름)` 이 아니라 **필드 문법**으로
 * 좁힌다. 삭제된 자산 이름은 주석·이력 서술에 남아 있어서, 부분 문자열로 대조하면 공허하게
 * 통과한다(그 게이트의 1차 변이가 실제로 그렇게 살아남았다).
 */
const INSTALL_CMD_PATTERNS: ReadonlyArray<{
  kind: string;
  re: RegExp;
  field: string;
  /** 캡처가 인자열 전체 — 플래그를 걷어내고 남은 토큰을 각각 식별자로 본다. */
  multi?: boolean;
}> = [
  { kind: "skill", re: /npx skills add\s+\S+\s+--skill\s+([\w-]+)/, field: "skill" },
  { kind: "source", re: /npx skills add\s+([\w.-]+\/[\w.-]+)/, field: "source" },
  { kind: "plugin", re: /claude plugin install\s+([\w-]+@[\w-]+)/, field: "pluginId" },
  // `npm install -g <pkg>` — 이 PR 이 스스로 결함으로 든 형태인데 판정 대상이 아니었다(#338 리뷰 M2③).
  // 기본 scope 는 `--save-dev` 이므로 `-g` 를 무조건으로 적으면 그것만으로 거짓이지만, 최소한
  // **패키지가 실재하는지**는 여기서 문다.
  {
    kind: "npm",
    // `npm install` · `npm i` · 플래그가 앞뒤 어디에 오든 · 한 줄 다중 패키지 · 버전 범위까지.
    // 첫 판본은 `-g` 를 **패키지로** 캡처했고(게이트가 스스로 잡음), 그 다음 판본은 `npm i`·`-D`·
    // 후행 플래그·다중 패키지 6종을 놓쳤다(라운드 2 LOW-N2 실측). 이제 명령 뒤 토큰을 전부 훑고
    // `-` 로 시작하는 것만 버린다.
    re: /npm\s+(?:install|i|add)\s+([^`\n]+)/,
    field: "pkg",
    multi: true,
  },
];

interface InstallRef {
  file: string;
  line: number;
  kind: string;
  ident: string;
  field: string;
}

/** 자리표시자 면제 횟수 — 축이 둘인데 한쪽만 계측되던 것을 계측한다(#338 라운드 3 LOW-N2). */
let placeholderSkips = 0;

/**
 * 설치 명령을 찾을 **후보 조각**: 인라인 코드 스팬 + 펜스 안의 줄.
 *
 * 줄 전체를 보면 평범한 산문이 물린다 — 라운드 3 이 *"run npm install in the project root"* 한 줄로
 * 오탐 6건(`in`·`the`·`project`…)을 실증했다. 반대로 스팬만 보면 펜스 안 명령을 놓친다. 그래서 둘 다.
 */
function commandFragments(line: string, insideFence: boolean): string[] {
  if (insideFence) return [line];
  return [...line.matchAll(INLINE_CODE)].map((m) => m[1] ?? "");
}

function extractInstallRefs(
  files: ReadonlyArray<string>,
  read: (f: string) => string,
): InstallRef[] {
  const found: InstallRef[] = [];
  const FENCE = /^\s*(?:```|~~~)/;
  for (const file of files) {
    let insideFence = false;
    read(file)
      .split(/\r?\n/)
      .forEach((l, i) => {
        if (FENCE.test(l)) {
          insideFence = !insideFence;
          return;
        }
        // 이력 서술만 면제하고, 면제는 **명시 표식 하나로만** 받는다. 원래 게이트는 줄에 한국어
        // 단어 `삭제` 나 취소선이 있으면 통과시켰는데, 그건 상한 없는 암묵 면제라 살아 있는 광고
        // 줄에 그 단어를 끼우면 그냥 열렸다(#338 리뷰 M3b 가 변이로 실증). 표식은 상한이 걸린다.
        if (l.includes(HISTORICAL_MARKER)) return;
        for (const frag of commandFragments(l, insideFence)) {
          let matchedSkill = false;
          for (const { kind, re, field, multi } of INSTALL_CMD_PATTERNS) {
            // `--skill` 형태가 잡히면 같은 조각의 bare `source` 는 중복이므로 건너뛴다.
            if (kind === "source" && matchedSkill) continue;
            const m = frag.match(re);
            if (!m?.[1]) continue;
            if (kind === "skill") matchedSkill = true;
            if (!multi) {
              found.push({ file, line: i + 1, kind, ident: m[1], field });
              continue;
            }
            // `multi` — 명령 뒤 인자열 전체를 받아, 플래그가 아닌 토큰을 **전부** 패키지로 본다.
            // 버전 지정(`pkg@1.2.3`)은 떼고, `&&` 뒤로는 다른 명령이므로 거기서 끊는다.
            for (const raw of m[1].split("&&")[0]?.trim().split(/\s+/) ?? []) {
              if (raw === "" || raw.startsWith("-")) continue;
              // 문서의 **자리표시자**(`<pkg>`·`<name>`)는 광고가 아니라 형식 설명이다.
              // 세어 둔다 — 이름을 꺾쇠로 감싸면 판정이 꺼지므로 무제한이면 그게 두 번째 면제 축이다.
              if (raw.includes("<")) {
                placeholderSkips += 1;
                continue;
              }
              const ident = raw.replace(/^(@[\w.-]+\/)?([^@]+).*$/, "$1$2");
              if (ident !== "") found.push({ file, line: i + 1, kind, ident, field });
            }
          }
        }
      });
  }
  return found;
}

/**
 * 카탈로그가 **값으로** 아는 upstream 저장소(`owner/repo`) 집합. 주석이 아니라 필드에서 뽑는다.
 *
 * `method.marketplace` 는 그 자체가 `owner/repo` 이고, `method.source` 는 `owner/repo` 이거나
 * `https://github.com/owner/repo` URL 이다. `source`(자산 출처 라벨)는 owner 만이라 여기 안 넣는다.
 */
function buildUpstreamRepos(): Set<string> {
  const repos = new Set<string>();
  const norm = (v: unknown): void => {
    if (typeof v !== "string") return;
    const s = v.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    if (/^[\w.-]+\/[\w.-]+$/.test(s)) repos.add(s);
  };
  for (const a of EXTERNAL_ASSETS) {
    const m = a.method as Record<string, unknown>;
    norm(m.marketplace);
    norm(m.source);
  }
  return repos;
}

/**
 * `owner/repo` 의 **repo 조각**이 카탈로그가 아는 이름인가.
 *
 * `npm`(5종)·`npx-run`(1종) 자산은 `pkg`/`cmd` 만 갖고 저장소 경로를 안 갖는다. 그래서
 * `buildUpstreamRepos()` 로는 `vercel-labs/agent-browser`·`bmad-code-org/BMAD-METHOD` 같은
 * **살아 있는 자산의 정당한 출처 링크**가 미지어가 된다(라운드 3 MED-N5 가 변이로 실증 —
 * 그전까지는 카탈로그 파일 주석에 우연히 걸려 통과했다).
 *
 * **남는 한계**: repo 이름이 자산 id·패키지명과 다르면(예: `netlify/cli` ↔ `netlify-cli`) 여전히
 * 미지어다. 그때는 `NOT_OUR_ASSET_REPO` 가 아니라 카탈로그 쪽에 저장소를 적는 것이 옳다 —
 * 여기에 "카탈로그 자산 아님"이라는 거짓 사유로 넣지 마라.
 */
function repoNameKnown(token: string): boolean {
  const name = (token.split("/")[1] ?? "").toLowerCase();
  if (name === "") return false;
  for (const a of EXTERNAL_ASSETS) {
    if (a.id.toLowerCase() === name) return true;
    const pkg = (a.method as Record<string, unknown>).pkg;
    const cmd = (a.method as Record<string, unknown>).cmd;
    for (const v of [pkg, cmd])
      if (typeof v === "string" && (v.split("/").pop() ?? "").toLowerCase() === name) return true;
  }
  return false;
}

const VOCAB = buildVocabulary();
const UPSTREAM_REPOS = buildUpstreamRepos();
const { shaped: SHAPED_REFS, slashed: SLASHED_REFS, exempted: EXEMPTED_LINES } = collectRefs();
const CATALOG_SOURCE = readFileSync(join(REPO_ROOT, "src", "external-assets.ts"), "utf8");
const INSTALL_REFS = extractInstallRefs(GUIDE_DOCS, (f) =>
  readFileSync(join(REPO_ROOT, f), "utf8"),
);

describe("문서가 가리키는 자산이 실재하는가 (#338)", () => {
  it("모집단이 살아 있다 — 문서 실재 · 어휘 · 참조 수 하한", () => {
    // 아래 셋 중 하나라도 0 이면 그 뒤의 "위반 0건"은 통과가 아니라 무측정이다.
    for (const f of GUIDE_DOCS)
      expect(existsSync(join(REPO_ROOT, f)), `${f} 가 없다 — 문서 이동 후 목록 미갱신`).toBe(true);
    expect(
      VOCAB.size,
      "derive 된 어휘가 비정상적으로 적다 — import 나 디렉터리 경로가 깨졌다",
    ).toBeGreaterThanOrEqual(200);
    expect(
      SHAPED_REFS.length,
      "자산 id 형태 참조를 거의 못 찾았다 — 인라인 코드 정규식이 죽었다",
    ).toBeGreaterThanOrEqual(100);
    expect(
      SLASHED_REFS.length,
      "owner/repo 형태 참조를 못 찾았다 — 정규식이 죽었다",
    ).toBeGreaterThanOrEqual(5);
    // 면제 표식을 뿌려서 게이트를 끄는 경로를 막는다. 표식은 제거 이력 문장에만 쓰는 것이고,
    // 그런 문장이 문서당 여러 줄씩 필요해진다면 그건 문서 구조를 고쳐야 한다는 신호다.
    // 상한은 **실사용에 붙여** 둔다. 표식은 줄 내용을 안 보므로(살아 있는 광고 줄에 붙여도
    // 열린다) 여유가 넓을수록 게이트를 조용히 끄기 쉽다 — 라운드 2 실측에서 여유 11줄이었다.
    // 이력 문장이 정말 더 필요해지면 이 수를 함께 올리고, 그때 왜 늘었는지 커밋에 남긴다.
    expect(
      EXEMPTED_LINES,
      `면제 표식(${HISTORICAL_MARKER})이 ${EXEMPTED_LINES}줄 — 이 정도면 게이트가 아니라 장식이다`,
    ).toBeLessThanOrEqual(7);
    // 두 번째 면제 축. 이름을 꺾쇠로 감싸면 설치 명령 판정이 꺼지므로 무제한이면 우회로가 된다.
    expect(
      placeholderSkips,
      `설치 명령의 자리표시자(<…>) 면제가 ${placeholderSkips}건 — 형식 설명이 아니라 우회로가 됐다`,
    ).toBeLessThanOrEqual(4);
  });

  it("자산 id 형태로 적힌 이름이 전부 이 저장소에 실재한다", () => {
    const unknown = SHAPED_REFS.filter(
      (r) => !VOCAB.has(r.token) && !NOT_AN_ASSET.has(r.token),
    ).map((r) => `${r.file}: \`${r.token}\``);
    expect(
      [...new Set(unknown)].sort(),
      "문서가 실재하지 않는 이름을 자산·룰·훅·스킬처럼 안내한다 — 제거된 자산의 잔존 안내이거나 오타다. 자산이 아니면 NOT_AN_ASSET 에 사유와 함께 넣어라",
    ).toEqual([]);
  });

  it("owner/repo 참조가 카탈로그에 있거나 저장소 내 실재 경로다", () => {
    const dead = SLASHED_REFS.filter((r) => {
      // 저장소 내 경로 주장 — 문서 기준(루트) 또는 docs/ 기준으로 실재해야 한다.
      if (existsSync(join(REPO_ROOT, r.token)) || existsSync(join(REPO_ROOT, "docs", r.token)))
        return false;
      if (NOT_OUR_ASSET_REPO.has(r.token)) return false;
      // derive 된 어휘가 아는 이름(이 저장소 자신 등)도 통과.
      if (VOCAB.has(r.token)) return false;
      if (repoNameKnown(r.token)) return false;
      // upstream 저장소 주장 — 카탈로그가 그 이름을 **값으로** 알고 있어야 한다.
      // 이전 판본은 `CATALOG_SOURCE.includes(token)` 이라 카탈로그 파일 **주석**에 남은 이름도
      // 통과시켰다. 제거된 자산은 정확히 그 자리에(제거 사유 주석에) 남으므로, 이 PR 이 지운
      // `alirezarezvani/c-level-skills`·`railwayapp/railway-plugin` 을 다시 광고해도 초록이었다.
      return !UPSTREAM_REPOS.has(r.token);
    }).map((r) => `${r.file}: \`${r.token}\``);
    expect(
      [...new Set(dead)].sort(),
      "카탈로그에 없는 upstream 저장소이거나, 실재하지 않는 저장소 내 경로다",
    ).toEqual([]);
  });

  it("광고된 설치 명령의 식별자가 카탈로그의 해당 필드로 실재한다", () => {
    const missing = INSTALL_REFS.filter(
      (r) => !CATALOG_SOURCE.includes(`${r.field}: "${r.ident}"`),
    ).map(
      (r) =>
        `${r.file}:${r.line} 의 ${r.kind} "${r.ident}" 가 카탈로그에 없다 — ` +
        "삭제된 자산의 광고 잔존이거나 문서 오타다",
    );
    expect(missing.sort(), missing.join("\n")).toEqual([]);
  });

  it("설치 명령 추출기 자체가 문다 — 모집단 크기에 기대지 않는 자기검증", () => {
    // 원래 게이트는 "추출 0건이면 공허 통과"를 **모집단 하한**으로 막았고, 문서가 정당하게
    // 줄어들자 그 하한에 걸렸다. 하한 대신 합성 입력으로 추출기의 양성·음성을 직접 본다 —
    // 이러면 광고가 0건이어도 게이트가 살아 있음이 증명된다.
    const fake = new Map([
      ["pos.md", "| x | `claude plugin install foo@bar` |\n`npx skills add o/r --skill zap --yes`"],
      ["neg.md", "설치 명령이 없는 줄과 `foo-bar` 같은 이름만 있는 줄"],
      ["hist.md", `- ~~\`claude plugin install gone@dead\`~~ 는 삭제됐다 ${HISTORICAL_MARKER}`],
    ]);
    const read = (f: string): string => fake.get(f) ?? "";
    const pos = extractInstallRefs(["pos.md"], read);
    expect(
      pos.map((r) => `${r.field}:${r.ident}`).sort(),
      "추출기가 알려진 설치 명령을 못 잡는다 — 이 상태의 '위반 0건'은 무측정이다",
    ).toEqual(["pluginId:foo@bar", "skill:zap"]);
    expect(extractInstallRefs(["neg.md"], read), "명령이 없는 줄에서 오탐").toEqual([]);
    expect(extractInstallRefs(["hist.md"], read), "이력 서술을 광고로 오인").toEqual([]);
  });

  it("자산 안내 문서 누락 감지 — 목록 밖 문서가 자산 id 를 쓰고 있지 않다", () => {
    // 신규 안내 문서가 목록 밖에서 낡은 이름을 들고 등장하는 경로를 막는다. `docs/todo.md` 는
    // 진행 추적기(내부)라 면제 — 본문 재판정은 #337 이 소유한다.
    const EXEMPT = new Set(["docs/todo.md"]);
    const ls = (args: string[]): string[] =>
      execFileSync("git", ["ls-files", ...args, "*.md"], { cwd: REPO_ROOT, encoding: "utf-8" })
        .split("\n")
        .filter(Boolean);
    const candidates = [...new Set([...ls([]), ...ls(["--others", "--exclude-standard"])])].filter(
      (f) =>
        !/^(CHANGELOG|docs\/(decisions|archive|PRD|specs|plans|research|dev|dogfood|evals)\/|templates\/|test\/|\.github\/|\.claude\/|tasks\/)/.test(
          f,
        ) && !GUIDE_DOCS.includes(f),
    );
    expect(candidates.length, "글롭이 문서를 못 찾았다 — 경로 필터 오류").toBeGreaterThan(3);

    const ids = EXTERNAL_ASSETS.map((a) => a.id);
    const missed = candidates
      .filter((f) => !EXEMPT.has(f))
      .map((f) => {
        const text = readFileSync(join(REPO_ROOT, f), "utf8");
        return { f, n: ids.filter((id) => text.includes(`\`${id}\``)).length };
      })
      .filter((r) => r.n >= 3)
      .map((r) => `${r.f} (자산 id ${r.n}건)`);
    expect(
      missed.sort(),
      "자산을 여러 건 이름으로 안내하는 문서가 GUIDE_DOCS 밖에 있다 — 목록에 넣거나 EXEMPT 에 사유와 함께 넣어라",
    ).toEqual([]);
  });
});

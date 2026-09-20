# Reference — 자산 카탈로그 해설 (유지보수자용)

이 문서는 **이 하네스를 고치는 사람**을 위한 카탈로그 해설이다. 설치해서 쓰는 사람은
[USAGE.md](USAGE.md)(명령·플래그·파일 위치)와 [TRACKS.md](TRACKS.md)(트랙별 자산)를 읽는 편이 빠르다.

SSOT 는 코드다. 자산이 어느 트랙에 붙는지는 `src/external-assets.ts` 의 `condition`, 룰·에이전트·훅
배선은 `src/manifest.ts`, 자산 전체 표는 그 카탈로그에서 생성되는 [COMPATIBILITY.md](COMPATIBILITY.md)
다. 이 문서는 손으로 쓴 해설이므로 내용이 어긋나면 코드가 우선한다. 결정의 경위는 여기 적지 않고
[`docs/decisions/`](decisions/) 의 ADR 로 링크한다.

## 1. 신뢰 등급

등급의 SSOT 는 각 자산의 `tier` 다. 설치 화면에서는 셋 중 둘만 배지로 표시한다.

| tier | 3단계 배지 | 뜻 |
|---|---|---|
| `official` | `★ official` | Anthropic 공식 마켓플레이스 · 이 하네스 자체 자산 |
| `vetted` | 없음 | star 1,000+ · archived 아님 · 설치 경로 실검증 통과 |
| `experimental` | `⚠ experimental (opt-in)` | star 1,000 미만 |

tier 는 **미리 체크할지 여부를 정하지 않는다** — 그것은 `condition` 이 결정한다. `vetted` 36종 가운데 트랙이
미리 체크하는 것은 5종(`find-skills` · `supabase-agent-skills` · `postgres-best-practices` ·
`react-best-practices` · `shadcn-ui`)뿐이고 나머지 31종은 `opt-in` 이다. tier 가 사전 체크에 하는 일은
하나다: `experimental` 은 트랙이 맞아도 제외된다(`src/preset-recommend.ts` 가 트랙 필터 뒤에
적용). 현행 `experimental` 2종(`railway-skills` · `revealjs`)은 둘 다 `opt-in` 이라 지금 걸리는
자산은 없다. `trust-tier-drift.yml` 이 월 1회 star 를 재측정하며, 라벨이 실제와 다르면 그 워크플로가 실패한다.

## 2. 트랙

`base` / `csr-*`(csr-supabase · csr-fastify · csr-fastapi) / `ssr-*`(ssr-htmx · ssr-nextjs) / `data` /
`tooling` / `full`(= 모든 dev 트랙의 합) / `executive` / `project-management` / `growth-marketing`.

**dev 트랙** = base + csr-* + ssr-* + data + tooling + full. `base` 는 dev 이지만 스택 전용 자산과 개발
도구(`frontend-design` · `find-skills`)의 사전 선택에서 빠진다 — 그 둘의 조건은 `DEV_TRACKS_WITH_STACK`
(= base 를 뺀 dev 트랙)이다. 방법론 스킬의 조건 `has-dev-track` 은 base 를 포함한다.

## 3. 외부 자산 — 설치 방식 5종

자산별 목록은 여기 두지 않는다(61종 전체 = [COMPATIBILITY.md](COMPATIBILITY.md), 트랙별 묶음 =
[TRACKS.md](TRACKS.md)). 여기 남기는 것은 **각 방식이 실제로 어떤 명령을 실행하는가**다 — "내 머신에서
무슨 일이 일어나는가"에 대한 답이다. 배선 SSOT = `src/external-installer.ts`.

| kind | 실행 명령 | project scope (기본) | global scope |
|---|---|---|---|
| `plugin` | `claude plugin marketplace add --scope <s> <marketplace>` → `claude plugin install --scope <s> <pluginId>` | `--scope project` | `--scope user` |
| `skill` | `npx skills@<pin> add <source> [--skill <name>] --agent <cli>… --copy --yes` | skills CLI 기본(프로젝트) | `-g` 추가 |
| `npm` | `npm install <pkg>@<version>` | `--save-dev` | `-g` |
| `npx-run` | `npx <cmd>@<version> <args…>` | 실행형 — 되돌릴 자동 경로가 없다 | 동일 |
| `shell-script` | `bash <번들 스크립트> <args…>` | 실행형 — 같음 | 동일 |

참고할 것 세 가지. ⓐ **버전이 고정된다** — `npm` · `npx-run` 은 `pkg@version` 으로 나가므로 vetting 시점의
코드만 실행된다. `plugin` · `skill` 은 upstream HEAD 라 고정되지 않는다. ⓑ **`--agent` 는 반복
플래그이며 `--copy` 가 붙는다.** 다중 에이전트 기본 모드가 Claude Code 몫을 아무 말 없이 건너뛰기 때문이다
(#372). ⓒ **`npx-run` · `shell-script` 는 `uninstall` 로 되돌릴 수 없다.** 무엇을 어디에 설치했는지 하네스가
추적할 수 없으므로 제거 시 "되돌릴 수 없음"으로 보고한다.

`internal` kind 는 이 표에 없다 — 외부 명령 없이 번들 템플릿을 복사하는 자산이다(번들 스킬 13종 ·
`ci-scaffold` · `tauri-desktop`). `plugin` 자산은 `claude` CLI 가 PATH 에 없으면 warn-skip 된다.
`claude plugin` 은 scope 와 무관하게 `~/.claude/plugins/` 아래 캐시를 쓰고 프로젝트는 메타데이터
(`installed_plugins.json` 의 `projectPath`)로 구분한다 — CLI 자체 설계다.

## 4. MCP 서버 (`.mcp.json`)

`.mcp.json` 은 **모든 트랙**에 생성·병합되고, 트랙 조건부 항목은 `templates/track-mcp-map.tsv` 가 정한다.

| MCP | 조건 | 명령 |
|---|---|---|
| **context7** | 항상 | `npx -y @upstash/context7-mcp@latest` |
| **github** | 항상 | `npx -y @modelcontextprotocol/server-github` |
| **chrome-devtools** | 항상 | `npx -y chrome-devtools-mcp@latest` |
| **railway-mcp-server** | csr-supabase · csr-fastify · csr-fastapi · ssr-htmx · ssr-nextjs · full | `npx -y @railway/mcp-server` |
| **supabase** | csr-supabase · full | `npx -y @supabase/mcp-server` |

항상 설치되는 3종의 SSOT 는 `templates/mcp.json` 이고, 조건부는 tsv 에 한 줄을 추가해 확장한다(조립
코드는 손대지 않는다). MCP 서버는 카탈로그 자산이 아니라 `.mcp.json` 항목이라 trust tier 가 없다.

## 5. 에이전트 (`templates/agents/`)

4 파일. 배선 SSOT = `src/manifest.ts` 의 `CORE_AGENTS` · `DEV_AGENTS` · `TRACK_AGENTS` ·
`RETIRED_AGENTS`.

| 에이전트 | 언제 깔리나 | 용도 |
|---|---|---|
| **reviewer** | 항상 | 작업을 수행하지 않은 다른 레인이 완료를 판정한다(다면 리뷰 · 계획 문서 검토 포함) |
| **implementer** | dev 트랙 | 구현 레인 — 변경을 작성하고, 그 변경 없이는 실패하는 테스트를 추가해 마무리한다 |
| **data-analyst** | data · full | Python / DuckDB / Trino / ML / PySide6 |
| **strategist** | executive · full | 제안서 · DD · 덱 · 재무모델 |

모델 열은 없다 — 각 파일의 frontmatter 가 SSOT 다. 일상 코드 리뷰·보안 리뷰 전용 에이전트는 두지
않는다: Claude Code 의 `/code-review` · `/security-review`, Codex 의 `codex review` 가 벤더 기본으로 같은
일을 한다(ADR-089). 은퇴한 에이전트 id 는 `RETIRED_AGENTS` 에 대안과 함께 남아 있어 `update` 화면이
설치본에 남은 옛 파일을 식별해 안내할 수 있다(ADR-090). ECC 에서 가져오는 에이전트는 없다.

## 6. 스킬

### 번들 스킬 (`templates/skills/`)

디렉터리 21개. 그중 **13종이 카탈로그 엔트리를 갖고**(`INTERNAL_BUNDLED_SKILL_IDS` — 위저드에서
체크·해제하고 `--with`/`--without` 으로 지정한다) 나머지 8종은 `manifest.ts` 가 트랙 조건에 따라 직접 설치한다.
개수의 SSOT 는 코드다. 이곳의 숫자와 다른 문서의 숫자가 어긋나면 코드가 우선한다. 스킬은 예외 없이
**디렉터리 단위**로 등록한다(`tests/skill-registration-uniform.test.ts`, ADR-083).

카탈로그 13종의 설치 조건과 한 줄 설명은 [TRACKS.md §What every track gets](TRACKS.md#what-every-track-gets)
에 있다(조건 = 전 트랙 4 · `has-dev-track` 6 · `opt-in` 3). 스킬을 옮기고 되돌린 경위는 ADR-060 · ADR-062,
개명·은퇴는 ADR-088 · #428 · #485 — 개명 맵은 `RENAMED_SKILL_IDS`, 은퇴 목록은 `RETIRED_SKILL_IDS`.

manifest 가 직접 설치하는 8종:

| Skill | 조건 | 출처 |
|---|---|---|
| `ui-visual-review` | csr-* · ssr-* · full | 자체 — Playwright/chrome-devtools 스크린샷 → baseline diff → 리뷰 게이트 |
| `e2e-testing` | csr-* · ssr-* · full, ECC 플러그인 미선택 시 | ECC cherry-pick |
| `nextjs-turbopack` | ssr-nextjs · full, 동상 | ECC cherry-pick |
| `python-patterns` · `python-testing` | data · csr-fastapi · full, 동상 | ECC cherry-pick |
| `market-research` · `investor-materials` · `investor-outreach` | executive · full, 동상 | ECC cherry-pick |

### Cherry-pick 출처

`.dev-references/cherrypicks.lock` 이 7건을 추적한다(위 표의 ECC 7종). ECC 플러그인(`--with ecc-plugin`)을
고른 설치에서는 플러그인이 같은 역할을 하므로 사본을 설치하지 않는다 — 배선은 `src/manifest.ts` 의
`!s.withEcc`(ADR-019). `scripts/sync-cherrypicks.sh` 가 upstream drift 를 감지한다.

## 7. 룰 · 훅 · 스크립트 · 템플릿

**룰** (`templates/rules/`) 6 파일 — `git-policy` · `change-management` · `doc-governance` 는 전 트랙,
`test-policy` · `ship-checklist` 는 dev 트랙, `cli-development` 는 tooling · full. 배선 SSOT =
`src/manifest.ts` 의 `COMMON_RULES` · `DEV_RULES` · `TRACK_RULES` → `resolveRules()`. UI 트랙 전용 룰은
없다(`UI_RULES` 는 빈 배열로 자리만 남겼다). 기술스택 상세 룰을 배포에서 뺀 경위는 ADR-060.

**훅** (`templates/hooks/`) 2 파일 — `session-start` · `protect-files`. 차단하는 훅은 `protect-files`
하나이고 exit 2 마다 `.uzys-agent-harness/hook-blocks.log` 에 `날짜 · 훅 · 대상` 한 줄을 남긴다(ADR-061).
로그 기록에 실패해도 차단 동작은 그대로다. 훅을 걷어낸 결정 = ADR-023 · ADR-060 · ADR-061 · ADR-072 · ADR-088.

**설치 대상 프로젝트에 들어가는 스크립트** — `templates/scripts/` 3종이 모든 설치에서 `.uzys-agent-harness/` 로
복사된다(`applies: all`). 배포 룰이 세 스크립트를 이름으로 호출한다.

| 배포 사본 | 설치 위치 | 부르는 룰 |
|---|---|---|
| `templates/scripts/check-absence.sh` | `.uzys-agent-harness/check-absence.sh` | `doc-governance` · `cli-development` |
| `templates/scripts/spec-drift-check.sh` | `.uzys-agent-harness/spec-drift-check.sh` | `doc-governance` · `ship-checklist` |
| `templates/scripts/protect-branch.sh` | `.uzys-agent-harness/protect-branch.sh` | `git-policy` |

여기에 `scripts/prune-ecc.sh` 하나가 `package.json` 의 `files` 로 게시되어 ECC 를 고른 설치에서 실행된다.

**이 저장소의 개발 도구** (`scripts/`, 판정·생성에 쓰이는 것):

| 스크립트 | 하는 일 |
|---|---|
| `gen-compatibility.mjs` | `COMPATIBILITY.md` 의 카탈로그 표 생성 (`npm run gen:compat`) |
| `verify-catalog.mjs` | 실 CLI 로 전 카탈로그 설치 가능성 재검증 (`catalog-verify.yml` 월 cron) |
| `trust-tier-drift.mjs` | star · archived drift 감시 (`trust-tier-drift.yml` 월 cron) |
| `release-audit.mjs` | 원격 태그 중 npm 에 없는 버전 검출 (`npm run release:audit` · `release-audit.yml` 매일) |
| `context-cost-report.mjs` · `-baseline.mjs` | 상주 컨텍스트 비용 측정 (`npm run cost:report` · `cost:baseline`) |
| `asset-history.sh` | 자산별 마지막 변경 커밋과 그 커밋의 자산 수 (`npm run assets:history`) |
| `check-absence.sh` | "없다"는 결론을 대조군 없이 못 내게 하는 판정기 (배포 사본의 원본) |
| `sync-cherrypicks.sh` | cherry-pick 출처의 upstream drift 감지 |
| `prune-ecc.sh` | ECC 플러그인을 curated KEEP 으로 잘라내기 (게시 대상) |

데모 녹화(`record-demo.sh` · `demo-capture.sh` · `demo.Dockerfile`)와 `fresh-dogfood-setup.sh` 는 제외했다.
`install.sh` 는 `curl | bash` 진입점으로, npx CLI 에 위임하는 얇은 래퍼다.

**템플릿** (`templates/docs/`) — `PLAN.template.md`(계획 문서 틀)와
`templates/skills/north-star/NORTH_STAR.template.md`(북극성 틀 — 로드맵과 이력은 담지 않는다).

**슬래시 명령은 없다.** `templates/commands/` 가 없고 manifest 에 `.claude/commands/` 대상도 0건이다
(ADR-023 · ADR-073 · ADR-081).

## 8. 설치 흐름

```
$ npx -y @uzysjung/agent-harness                 # 위저드
$ npx -y @uzysjung/agent-harness install \       # 비대화형 (CI·스크립트)
      --track <track> --cli <cli> --project-dir .
  ↓
[전제] Node 20+. `claude` 는 plugin 자산이 있을 때만, `npx`/`npm` 은 그 방식의 자산이 있을 때만
  ↓
[1 Track] · [2 CLI] — 둘 다 다중 선택
  ↓
[3 설치 항목] 7 페이지. 앞 2 = 트랙 baseline(룰·훅 / 에이전트·스킬), 뒤 5 = 외부 자산 카테고리
  ↓
[4 Scope] Project(기본) / Global      [5 Confirm] 요약 + 세션 시작 컨텍스트 비용
  ↓
[6 Installing]
  Phase 1  템플릿    — .claude/{rules,agents,hooks,skills} · 앵커 · .mcp.json ·
                       .uzys-agent-harness/ 스크립트 3종 · (opt-in) .github/workflows
  Phase 2  외부 자산 — 4단계에서 고른 scope 로 §3 의 5가지 방식 실행
  Phase 3  CLI 산출물 — codex · opencode · antigravity 를 하나라도 골랐을 때만:
                       AGENTS.md · .codex/ · opencode.json · .agents/
  ↓
[리포트] 카테고리별 카운트(+`--verbose` 면 파일 목록) · 백업 경로 · 되돌릴 수 없는 항목 · FILL 안내
```

Phase 번호는 화면 순서이고 실행 순서와 다르다 — CLI 산출물은 baseline 안에서 외부 자산보다 먼저
만들어진다. 설치 로그(`.uzys-agent-harness/.harness-install.json`)는 그 사이에 기록되며, `list` ·
`update` · `uninstall` 명령은 이 파일을 참조한다.

## 9. 보안 · 신뢰 정책

- **MCP 호출은 하네스가 막지 않는다** — 승인은 각 CLI 자신의 권한 체계가 한다(ADR-072). 옛 설치본의
  `.mcp-allowlist` 는 `update` 가 백업 후 회수한다.
- **글로벌 경로 보호는 경로 차단이 아니라 scope 기본값이다** (ADR-020). `--project-dir` 값은 `resolve()`
  될 뿐 시스템 경로 블록리스트는 없다 — 없는 방어를 있다고 적지 않는다.
- **`.env` · lock · 인증서 편집 차단** — `protect-files.sh` 훅(§7).
- **`--no-verify` · `--force` 금지는 `git-policy` 룰의 프로즈 규약**이다 — 강제하는 훅은 없다. main 보호는
  GitHub 룰셋이 서버에서 맡는다(`protect-branch.sh`).

## 10. 라이선스 · 책임

각 외부 출처의 라이선스를 따른다(대부분 MIT / Apache 2.0). 이 카탈로그는 통합 가이드일 뿐 외부 자산의
동작·보안을 보증하지 않는다. 설치 전에 3단계의 등급 배지(특히 `⚠ experimental`)를 보고, 판단이
필요하면 [SECURITY.md](../SECURITY.md) 를 읽는다.

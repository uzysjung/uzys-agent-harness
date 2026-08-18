# Reference — 외부/내부 자산 카탈로그

이 프로젝트가 **참조하거나 설치하는** 모든 외부/내부 자산의 단일 카탈로그.
출처(공식/검증/community), 적용 Track, 설치 명령, 신뢰 등급을 정리.

> 설치는 `npx -y @uzysjung/agent-harness`(위저드) 또는 `install --track <track>`(비대화형)이 한다.
> **opt-in 항목은 위저드 3단계의 체크박스이거나 `--with <asset-id>` 다** — 옛 `[y/N]` 프롬프트도,
> 자산별 전용 플래그도 없다(후자는 v26.81.0 에서 13종 삭제, ADR-022).
>
> 각 자산이 어느 트랙에 붙는지의 SSOT 는 `src/external-assets.ts` 의 `condition` 이고, 사람이 읽는
> 판은 [TRACKS.md](TRACKS.md)·[COMPATIBILITY.md](COMPATIBILITY.md)(후자는 카탈로그에서 생성)다.
> 이 문서는 **손으로 쓴 카탈로그 해설**이라 셋이 어긋나면 코드가 이긴다.

## 신뢰 등급

손으로 쓴 3등급을 따로 두지 않는다. **등급의 SSOT 는 각 자산의 `tier` 이고, 설치 화면은 그중 둘만 배지로 보여 준다** — `vetted` 는 배지가 없어서 화면만 보고는 등급을 알 수 없다.

| tier | 3단계 배지 | 의미 |
|---|---|---|
| `official` | `★ official` | Anthropic 공식 마켓플레이스 · 이 하네스 자체 자산 |
| `vetted` | **없음** | star 1,000+ · 활발한 유지보수 · 실설치 검증 통과 |
| `experimental` | `⚠ experimental (opt-in)` | star 1,000 미만 |

**tier 는 미리 체크되는지를 정하지 않는다.** 그건 각 자산의 `condition` 이 가른다 — `vetted` 자산
36종 중 30종이 `opt-in` 이라 어느 트랙에서도 자동으로 체크되지 않는다. tier 가 사전 체크에 하는
일은 하나뿐이다: `experimental` 은 트랙이 맞아도 제외된다(`src/preset-recommend.ts` 가 트랙
필터 **뒤에** 적용한다). 다만 현행 `experimental` 2종은 둘 다 `opt-in` 이라 트랙이 맞는 일 자체가
없다 — 규칙은 살아 있고 지금 걸리는 자산이 없을 뿐이다.

> 손으로 쓴 등급 표가 여기 있었고, 예시로 든 출처 4곳이 코드에서는 전부 `vetted` 였다 — 즉 "개인이
> 만든 것"이라는 인상으로 등급을 갈랐고, 보안 판단의 입구에서 등급을 잘못 가리켰다(#338). 자산별
> 현재 등급은 [COMPATIBILITY.md](COMPATIBILITY.md) 가 카탈로그에서 생성한다.

## Track 약어

`csr-*` (csr-supabase, csr-fastify, csr-fastapi) / `ssr-*` (ssr-htmx, ssr-nextjs) / `data` / `executive` / `tooling` / `full` (= 모든 dev track union) / `project-management` (v0.5.0) / `growth-marketing` (v0.5.0)

**dev tracks** = csr-* + ssr-* + data + tooling + full (executive + project-management + growth-marketing 제외).

---

## 1. 외부 자산 — 설치 방식 5종

**자산별 목록은 여기 두지 않는다.** 카탈로그(60) 전체의 id·tier·설치 타겟·CLI 도달·검증 등급은
[COMPATIBILITY.md](COMPATIBILITY.md) 가 `src/external-assets.ts` 에서 **생성**하고, 트랙별 묶음
해설은 [TRACKS.md](TRACKS.md) 가 맡는다. 이 절이 자산을 손으로 다시 열거하던 동안 그 사본은
실제로 낡았다 — 이 절의 표가 배포 CLI 설치를 `npm install -g` 로 적고 있었는데, 기본 scope 에서
실제로 나가는 명령은 `npm install --save-dev` 다(#338). 없어진 자산을 안내하던 쪽은 USAGE 와 §6
흐름도였다.

여기 남는 것은 **각 방식이 실제로 어떤 명령을 실행하는가**다. 방식은 자산보다 훨씬 덜 바뀌고,
"내 머신에서 무슨 일이 일어나는가"를 알려면 이쪽이 필요하다. 배선 SSOT = `src/external-installer.ts`.

| kind | 실행 명령 | project scope (기본) | global scope |
|---|---|---|---|
| `plugin` | `claude plugin marketplace add --scope <s> <marketplace>` → `claude plugin install --scope <s> <pluginId>` | `--scope project` | `--scope user` |
| `skill` | `npx skills@<pin> add <source> [--skill <name>] --agent <cli>… --yes` | skills CLI 기본(프로젝트) | `-g` 추가 |
| `npm` | `npm install <pkg>@<version>` | `--save-dev` | `-g` |
| `npx-run` | `npx <cmd>@<version> <args…>` | 실행형 — 되돌릴 자동 경로가 없다 | 동일 |
| `shell-script` | `bash <번들 스크립트> <args…>` | 실행형 — 같음 | 동일 |

세 가지가 여기서 읽힌다. ⓐ **버전이 고정된다** — `npm`·`npx-run` 은 `pkg@version` 으로 나가므로
vetting 시점의 코드만 실행된다(v26.80.0). `plugin`·`skill` 은 upstream HEAD 라 아직 고정되지
않는다. ⓑ **`--agent` 는 반복 플래그다** — skills CLI 1.5.7+ 계약이고, 쉼표 목록은 거부된다.
ⓒ **`npx-run`·`shell-script` 는 `uninstall` 이 되돌릴 수 없다** — 무엇을 어디에 썼는지 우리가
모르기 때문이고, 그래서 제거 시 "되돌릴 수 없음"으로 보고된다.

`internal` kind 는 이 표에 없다 — 외부 명령을 실행하지 않고 번들 템플릿을 복사하는 자산이다
(방법론 스킬·`ci-scaffold`·`tauri-desktop`).

---

## 2. MCP Servers (`.mcp.json`)

`.mcp.json`은 프로젝트 스코프로 자동 생성되며, `templates/track-mcp-map.tsv` 기반으로 Track별 조건부 추가.

### 모든 dev track 공통

| MCP | 출처 | 명령 |
|-----|------|------|
| **context7** | [Upstash](https://github.com/upstash/context7-mcp) | `npx -y @upstash/context7-mcp@latest` |
| **github** | [modelcontextprotocol](https://github.com/modelcontextprotocol/servers/tree/main/src/github) | `npx -y @modelcontextprotocol/server-github` |
| **chrome-devtools** | [chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) | `npx -y chrome-devtools-mcp@latest` |

MCP 서버는 카탈로그 자산이 아니라 `.mcp.json` 항목이라 trust tier 를 갖지 않는다.

### Track 조건부 (track-mcp-map.tsv 데이터-driven)

| MCP | Track | 명령 |
|-----|------|------|
| **railway-mcp-server** | csr-supabase, csr-fastify, csr-fastapi, ssr-htmx, ssr-nextjs, full | `npx -y @railway/mcp-server` |
| **supabase** | csr-supabase, full | `npx -y @supabase/mcp-server` |

> **신규 MCP 추가**: `templates/track-mcp-map.tsv` 에 1줄 추가하면 된다 — 조립 코드는 손대지 않는다.
> 조건 없이 항상 나가는 3종의 SSOT 는 `templates/mcp.json` 이다.

---

## 3. Agents (자체 + ECC cherry-pick)

> **게이팅 방향에 주의** — ADR-019 가 ADR-016 을 뒤집었다. ECC cherry-pick 에이전트는
> `--with ecc-plugin` 을 **고르지 않았을 때** 폴백으로 깔린다(opt-out). ECC 플러그인을 고르면
> 같은 역할을 플러그인이 가져오므로 사본이 비켜선다. 배선 = `src/manifest.ts` 의 `!s.withEcc`.

| 에이전트 | 출처 | 언제 깔리나 | 용도 |
|---|---|---|---|
| **reviewer** | 자체 | 항상 | SOD 검증 (다면 리뷰). 구현하지 않은 레인이 판정한다 |
| **data-analyst** | 자체 | 항상 | Python / DuckDB / Trino / ML / PySide6 |
| **strategist** | 자체 | 항상 | 제안서 · DD · 덱 · 재무모델 |
| **plan-checker** | 자체 | dev track | `docs/plan.md` ↔ `todo.md` ↔ `SPEC.md` 정합성 |
| **implementer** | 자체 | dev track | 구현 레인 — 변경을 쓰고, 그 변경 없이는 실패하는 테스트로 닫는다 |
| **code-reviewer** | ECC | ECC **미**선택 | 일상 코드 리뷰 (CRITICAL→LOW) |
| **security-reviewer** | ECC | ECC **미**선택 | OWASP Top 10 + 시크릿 탐지 |
| **silent-failure-hunter** | ECC | ECC **미**선택 + dev track | swallowed error / bad fallback 탐지 |
| **build-error-resolver** | ECC | ECC **미**선택 + dev track | TS / build 에러 fix |

> 모델 열은 뺐다 — 에이전트 정의 파일의 frontmatter 가 SSOT 이고, 여기 옮겨 적으면 두 번째 사본이
> 된다. `implementer` 는 v26.138.0 에 생겼다: 그전 8종이 전부 검토·검증·도메인 특화라 설치자는
> "코드를 볼 사람"만 받고 "쓸 사람"은 못 받았다(두 코퍼스 대조 실측 — 서브에이전트 코드 Edit 433 vs 3).

---

## 4. Cherry-picked Sources

`.dev-references/cherrypicks.lock` (16건 — 2026-08-02 ADR-060 에서 verification-loop·karpathy-gate,
ADR-061 에서 게이트 어휘 룰 행 해체). ECC에서 발췌해 `templates/`에 복사.
`scripts/sync-cherrypicks.sh`로 upstream drift 감지.

| 카테고리 | 항목 |
|---------|------|
| Skills (templates/skills/) | continuous-learning-v2, strategic-compact, deep-research, market-research, eval-harness, e2e-testing, agent-introspection-debugging, python-patterns, python-testing, nextjs-turbopack, investor-materials, investor-outreach |
| Agents (templates/agents/) | code-reviewer, security-reviewer, silent-failure-hunter, build-error-resolver |

**`verification-loop` 은 이 목록에 없다** — ECC 파생이지만 lock 밖이다(ADR-060 이 행을 해체했고
ADR-062 복원은 재등재하지 않았다). 우리 판본으로 유지·배포하며 출처는 SKILL.md 본문의 MIT 귀속
1줄이 진다. lock 에 되돌리면 `sync-cherrypicks.sh --apply` 의 rsync 가 우리 본문을 덮어쓴다.

---

## 5. 자체 작성 자산

### Skills (templates/skills/)

자체 작성 스킬은 **14종**이고, 그중 **12종은 카탈로그 엔트리를 갖는다**(`INTERNAL_BUNDLED_SKILL_IDS`
— 위저드에서 체크·해제할 수 있고 `--with`/`--without` 로 지정된다). 남는 `spec-scaling`·
`ui-visual-review` 2종은 엔트리 없이 `manifest.ts` 가 직접 깐다 — `ui-visual-review` 는 UI 트랙
조건이고, `spec-scaling` 은 **무조건**이며 디렉터리가 아니라 `SKILL.md` 파일 하나만 나간다.
COMPATIBILITY.md 가
"번들 uzys 스킬 12종"이라 적는 것과 여기 14종이 어긋나 보이는 이유가 이 둘이다.

아래 9종은 2026-08-02 **ADR-062 로 이 리포에 복원**됐다(ADR-060 이 `npx skills add
uzysjung/uzys-agent-skills` 로 이관했던 것). 되돌린 이유는 본문 보존이다 — 이관본이 판정 기준·수치·
워크드 예시를 잃었고(감사 실측 104건), 그 본문을 무는 게이트는 이 리포에만 있다.
설치 조건의 SSOT 는 `src/external-assets.ts` 의 각 엔트리 `condition` 이다.

| Skill | 설치 조건 | 용도 | 비고 |
|-------|----------|------|------|
| **north-star** | 전 track | NSM(metric-as-proxy)·Pillars·Will/Won't·4-gate + 우선순위 순서 게이트. `NORTH_STAR.template.md` 동반 | ADR-062 복원 (구 north-star + northstar-roadmap 통합) |
| **gh-issue-workflow** | 전 track | 이슈를 비동기 백로그·결정 채널로. 5섹션 body 템플릿(`ISSUE.template.md`) + 읽기/초안/원격쓰기 단계 분리 | ADR-062 복원 |
| **task-brief** | 전 track | 요청·위임 프롬프트를 canonical 브리프(objective·invariants·success_criteria·boundaries·autonomy·verification…)로 정규화. `task-brief-nudge.sh` 훅과 한 벌 | ADR-062 AC9 신설 (복원 아님) |
| **audit-harness-fit** | 전 track | 상주 조종층(앵커·룰·훅·permissions·descriptor)이 밥값을 하는지 5단계 감사(INVENTORY→EVIDENCE→VERDICT→RELOCATE→APPLY). 판정 근거는 공식 문서 인용·차단 로그·계측 3종뿐 | ADR-064 신설 (복원 아님) |
| **clear-korean-communication** | 전 dev track | 독자 위치에서 시작하는 설명 + 승인 요청 4요소(맥락→추천→UI/UX→ASIS/TOBE) | ADR-062 복원 (구 asis-tobe-decision + explain-plainly 통합) |
| **audit-service-gaps** | 전 dev track | 북극성·결함·사용자관점 3렌즈로 갭 열거 → 레퍼런스가 어떻게 닫았는지 확인 후 제안 | ADR-062 복원 (구 gap-analysis-e2e) |
| **multi-persona-review** | 전 dev track | 산출물 1개를 독립 페르소나 3~5인 병렬 리뷰 → P0/P1/P2 종합 | ADR-062 복원 |
| **recurrence-prevention** | 전 dev track | 재발 검증 → 단순/복합 분류 → 대책 사다리 1단 상향(기록→룰→구조 게이트) | ADR-062 복원 |
| **verification-loop** | 전 dev track | 표면별 검증 트랙 + 고정 verdict(PASS/PASS_WITH_NITS/FAIL) + severity 4단 | ADR-062 복원 · ECC 파생(MIT, lock 밖 — §4 참조) |
| **model-orchestration** | opt-in | 역할·effort 라우팅 정책, 위임 브리프 규격, 워커 수거·종료 계약 | ADR-062 복원 |
| **external-model-consult** | opt-in | 외부 모델 자문(한국어 표현·2차 의견·구조화·이미지). 래퍼 스크립트 2종 동반 | ADR-062 복원 (구 gemini-consult + codex-consult 통합) |
| **compaction-handoff** | 전 dev track | /compact 직전 재개 앵커 1개로 상태 고정 | 이관 대상이 아니었다 |
| **spec-scaling** | 전 dev track | SPEC.md/PRD.md 300줄 초과 시 기능별 or 영역별 분리 제안 (docs/specs/ or docs/PRD/) | v26.30.0 확장 |
| **ui-visual-review** | csr-*/ssr-*/full | Playwright/chrome-devtools 스크린샷 캡처 → baseline diff → 에이전트 REGRESSION 분류 → Review Gate 차단 | v26.29.0 신규 |

### Templates (templates/docs/)

- **PLAN.template.md** (v26.30.0) — Sprint Contract / Phase Overview / **Milestone × Dependency Graph** (직렬/병렬/강한 의존 표기) + **Critical Path** / Per-Milestone AC / Risk / Open Questions / Changelog 8섹션
- **skills/north-star/NORTH_STAR.template.md** — NSM / Pillars / Will-Won't / Decision Heuristics 6섹션. **로드맵(시간축)과 이력은 담지 않는다** — 각각 로드맵 문서와 버전 관리 이력 소관이고, 템플릿 §5·§8 은 그 사실을 적은 스텁이다

### Commands — 없다

`templates/commands/` 디렉터리는 존재하지 않고, manifest 에 `.claude/commands/` 대상도 0건이다.
직접 쓴 슬래시 명령 세트(`spec`·`plan`·`build`·…)는 ADR-023 에서, ECC 폴백 8종은 ADR-073 에서 <!-- ref:removed -->
사라졌다. 유일한 예외는 OpenCode 인데, 그쪽은 native 스킬 개념이 없어 스킬 하나당 명령 파일 하나를
`.opencode/commands/` 로 **생성**한다 — 번들 템플릿이 아니라 설치 시점 변환 산출물이다.

### Rules (templates/rules/)
6 파일(실측 2026-08-17 — ADR-060 정비로 기술스택 상세 룰 12종, ADR-061 로 게이트 어휘 룰,
#284 로 `benchmark-parity`, 2026-08-12 로 `playwright-launch` 삭제. 마지막 것의 내용은 <!-- ref:removed -->
`ui-visual-review` 스킬로 합쳐져 상주에서 발화로 내려갔다 — 그래서 **UI 트랙 전용 룰은 이제 없다**).
CLAUDE.md와 짝.
**트랙별 적용 조건의 SSOT 는 `src/manifest.ts`**
(`COMMON_RULES`·`DEV_RULES`·`UI_RULES`·`TRACK_RULES` → `resolveRules()`)다 — SPEC 이 아니다.
- **change-management.md** (v26.30.0 확장) — ADR Status 흐름 `Proposed → Accepted → Superseded/Deprecated` + 채택 프로세스 + 대상/비대상

### Hooks (templates/hooks/)
3 파일 (실측 2026-08-16): session-start · protect-files · task-brief-nudge.
차단하는 훅은 `protect-files` **하나뿐**이고, exit 2 마다 `.uzys-agent-harness/hook-blocks.log` 에
`날짜 · 훅 · 대상` 1줄을 남긴다 (ADR-061). 로그 실패는 차단 판정을 바꾸지 않는다.
*`mcp-pre-exec` 은 ADR-072 로 제거됐다 — 배선이 아니라 목적이 이유다. MCP 서버를 새로 붙이는 <!-- ref:removed -->
순간 차단하는 훅은 "사용자가 AI 코딩 도구로 개발을 잘하게 만든다"는 방향과 반대로 작동한다.*
**task-brief-nudge 는 차단하지 않는다** — UserPromptSubmit 에서 "400자 이상 && `<objective>` 부재"
라는 결정적 두 조건만 보고 stdout 1줄을 덧붙인다(그 밖엔 무출력 exit 0). 차단 경로가 없어
차단 로그도 남기지 않는다. 브리프 변환 자체는 판단이 필요하므로 `task-brief` 스킬 몫이다.
*구 6-Gate 훅(gate-check/agentshield-gate)·codebase-map 은 ADR-023, karpathy-gate·spec-drift-check
는 ADR-060, checkpoint-snapshot 은 ADR-061 에서 삭제됨(검증 스캐폴딩·무동작 실측 — 마지막 것은
`settings.json` 의 `"PostToolUse": []` 로 설치만 되고 실행 0이었다).*

### Scripts (자체 작성)

설치를 오케스트레이션하던 `setup-harness.sh` 와 그 어서션 스위트 `test-harness.sh` 는 **없다** —
CLI 를 TypeScript 로 다시 쓸 때 `src/` 와 `vitest` 가 각각 그 자리를 가져갔다. 검증 명령은
`npm run ci`(typecheck + lint + coverage + build)다.

셸 스크립트가 사용자 프로젝트에 도달하는 경로는 **둘**이다. ⓐ `scripts/` 중 `package.json` 의
`files` 가 개별 지정한 **`prune-ecc.sh` 하나** — ECC 를 고른 사람의 설치에서 실행된다. ⓑ
`templates/scripts/` **3종** — 게시물 전체가 `templates/` 로 나가고, manifest 가 **모든 설치**에
`.uzys-agent-harness/` 로 깐다(`applies: all`). 배포 룰이 셋 다 이름으로 부른다(아래 표). 아래 표에서 `check-absence.sh` 를 "개발 도구"로만 읽으면 안 되는 이유다 — 개발 사본과
배포 사본이 둘 다 있다.

| 배포 사본 | 설치 위치 | 부르는 곳 |
|---|---|---|
| `templates/scripts/check-absence.sh` | `.uzys-agent-harness/check-absence.sh` | `doc-governance` 룰 |
| `templates/scripts/spec-drift-check.sh` | `.uzys-agent-harness/spec-drift-check.sh` | `doc-governance` · `ship-checklist` 룰 |
| `templates/scripts/protect-branch.sh` | `.uzys-agent-harness/protect-branch.sh` | `git-policy` 룰 |

셋 다 배포 룰이 이름으로 부른다 — 즉 설치받은 프로젝트에서 룰이 지시하는 명령이 실재한다.
`git-policy` ↔ `protect-branch.sh` 배선은 `tests/protect-branch-surface.test.ts` 가 문다.

아래 표는 **이 저장소의 개발 도구**다(위 배포 사본의 원본을 포함한다).

| 스크립트 | 하는 일 |
|---|---|
| `scripts/prune-ecc.sh` | ECC 플러그인을 프로젝트 스코프로 복사하고 curated KEEP 외를 제거. 게시 대상 |
| `scripts/sync-cherrypicks.sh` | cherry-pick 출처의 upstream drift 감지 |
| `scripts/check-absence.sh` | "없다"는 결론을 대조군 없이 못 내게 만드는 판정기 (0 부재 · 1 발견 · 2 신뢰불가) |
| `scripts/gen-compatibility.mjs` | `COMPATIBILITY.md` 의 카탈로그 표 생성 (`npm run gen:compat`) |
| `scripts/verify-catalog.mjs` | 실 CLI 로 전 카탈로그 설치 가능성 재검증 (`catalog-verify.yml` 월 cron) |
| `scripts/trust-tier-drift.mjs` | star 수 drift 감시 (`trust-tier-drift.yml` 월 cron) |
| `scripts/context-cost-report.mjs` · `-baseline.mjs` | 상주 컨텍스트 비용 측정 (`npm run cost:report` · `cost:baseline`) |
| `install.sh` | `curl \| bash` 진입점. 실제로는 npx CLI 에 위임하는 얇은 래퍼 — 옛 문서의 호출이 계속 동작하게 남겨 둔 것이다 |

표는 **판정·생성에 쓰이는 것만** 담았다. 데모 녹화(`record-demo.sh`·`demo-capture.sh`·
`demo.Dockerfile`)와 `fresh-dogfood-setup.sh` 는 뺐다 — 전체 목록은 `ls scripts/` 다.

### eval-harness 확장 (v26.30.0)
ECC cherry-pick skill이지만 본 harness에서 확장:
- `.md` (설계) + `.log` (실행 결과) **쌍 의무화**
- `.md` 3섹션: **Capability / Regression / Test** 필수
- `.log` append 포맷 예시 포함

---

## 6. 설치 결정 흐름

```
$ npx -y @uzysjung/agent-harness                 # 위저드
$ npx -y @uzysjung/agent-harness install \       # 비대화형 (CI·스크립트)
      --track <track> --cli <cli> --project-dir .
  ↓
[전제] Node 20+. `claude` 는 plugin 자산이 있을 때만, `npx`/`npm` 은 그 방식의 자산이 있을 때만
      (설치기 자체는 `git` 을 호출하지 않는다 — 필요한 것은 `npx github:…` 경로뿐)
  ↓
[1 Track] · [2 CLI] — 둘 다 다중 선택
  ↓
[3 설치 항목] 7 페이지. 앞 2페이지 = 트랙 baseline(룰·훅 / 에이전트·스킬)을 전부 체크된 채로 보여
             주고 해제할 수 있게 한다. 뒤 5페이지 = 외부 자산 카테고리
  ↓
[4 Scope] Project(기본) / Global      [5 Confirm] 요약 + 세션 시작 컨텍스트 비용
  ↓
[6 Installing]
  Phase 1  템플릿    — .claude/{rules,agents,hooks,skills} · 앵커 · .mcp.json ·
                       .uzys-agent-harness/ 스크립트 3종 · (opt-in) .github/workflows
  Phase 2  외부 자산 — 4단계에서 고른 scope 로 §1 의 5가지 방식 실행
  Phase 3  CLI 산출물 — codex·opencode·antigravity 를 하나라도 골랐을 때만: AGENTS.md ·
                       .codex/ · opencode.json · .opencode/commands/ · .agents/
  ↓
[리포트] 카테고리별 카운트(+`--verbose` 면 파일 목록) · 백업 경로 · 되돌릴 수 없는 항목
```

**위 Phase 번호는 화면에 뜨는 순서**이고 실행 순서와 다르다 — CLI 산출물은 실제로 baseline 안에서
외부 자산보다 **먼저** 만들어진다. 설치 로그(`.uzys-agent-harness/.harness-install.json`)는 단계로
표시되지 않고 그 사이에 기록된다. `list`·`uninstall` 이 읽는 것이 이 파일이다.

트랙이 무엇을 고르는지는 이 그림이 아니라 [TRACKS.md](TRACKS.md) 가 담는다 — 여기 옮겨 적었던
동안 그 목록은 세 릴리즈치 낡은 자산을 안내하고 있었다.

---

## 7. 보안 / 신뢰 정책

- **MCP allowlist**: 없다 (ADR-072 로 제거). MCP 호출은 하네스가 막지 않는다 — 승인은 각 CLI 자신의 권한 체계가 한다. 기존 설치본의 `.mcp-allowlist` 는 `update` 가 백업 후 회수한다.
- **글로벌 경로 보호는 경로 차단이 아니라 scope 기본값이다** (ADR-020). `~/.claude/skills/`·`~/.codex/`·
  `~/.opencode/`·`~/.gemini/`·`npm root -g` 는 4단계에서 Global 을 고르거나 `--scope global` 을
  넘기지 않는 한 쓰이지 않는다. **`--project-dir` 에 대한 시스템 경로 블록리스트는 없다** — 값은
  `resolve()` 될 뿐이다(실측 2026-08-17, 대조군 확인). 이 줄은 그런 차단이 있다고 적고 있었고,
  근거로 든 스크립트는 CLI 재작성 때 사라진 것이었다. **없는 방어를 있다고 적는 것이 없는 것보다
  나쁘다** — 읽는 사람이 그걸 믿고 위험한 경로를 넘긴다.
- **`.env` / credentials 수정 차단**: `protect-files.sh` 훅이 `.env`, lock 파일, 인증서 경로 차단.
- **`--no-verify` / `--force` 금지**: `git-policy.md` §Safety 의 **프로즈 규약**이다 — 강제하는 훅은
  없다. (v26.122.0 정정: 이 줄은 `gate-check.sh` 가 차단한다고 적고 있었으나 그 훅은 ADR-023 에서
  삭제됐다. 같은 문서의 §5 Hooks 가 이미 "삭제됨"이라 적고 있어 자기모순이었다.)

---

## 8. 라이선스 / 책임

각 외부 출처의 라이선스를 따른다 (대부분 MIT/Apache 2.0). 본 카탈로그는 통합 가이드일 뿐 외부 자산의
동작/보안에 대한 보증을 제공하지 않는다. 설치 전에 3단계에서 각 자산의 등급 배지(특히
⚠ experimental)를 확인하고, 판단이 필요하면 [SECURITY.md](../SECURITY.md) 를 읽는다.

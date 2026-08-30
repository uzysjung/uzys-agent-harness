# 마일스톤 로드맵 (M1~M6)

> **이 문서는 마일스톤 축만 담는다. 열린 작업의 SSOT 는 GitHub Issue 다** — `gh issue list --state open`
> 이 정본이고(사용자 확정 2026-08-30), 여기 있는 미완 항목은 착수할 때 이슈로 옮긴다. 마일스톤
> 축(무엇이 어느 단계에 속하는가·게시 전/후)은 이슈 목록이 표현하지 못하는 정보라 남긴다.
> 2026-08-30 에 2026-06 감사 원자료를 걷어냈다: 완료 15건 상세 · 기각 8건 · 저심각 35건 ·
> M1 원안 발견 표 (481 → 281줄). 지운 내용은 git 히스토리에 있다.

> 작성 2026-06-13 · 기준 v26.83.0 (초판) · **최종 갱신 2026-08-30 / v26.149.0** (M1~M4 진척 전수 재판정 #337 + 감사 원자료 정리) (방법론 코어 8 / 수단 3 계층 분리 → v26.106.0 축 판정 61 → v26.108.0 ci-scaffold 62 → v26.110.0 오피셜 플러그인 큐레이션 ADR-039 로 65 → **2026-08-02 ADR-060 정비에서 12종 제거** → preline·game 3종 추가로 카탈로그 60 → #353 self-hosted-github-runner · #355 humanize-korean 추가로 **카탈로그 62**(실측 `src/external-assets.ts` 2026-08-29)) · 방법: ultracode 7차원 병렬 감사 → 적대 검증(critical/high 3표 다수결·medium 1표) → 완전성 비평 → 로드맵 합성
> 규모: 87 에이전트 · 검증 **확정 29 / 미검증 0 / 기각 8**. 기존 `persona-feedback-improvements.md`(P0~P2)를 본 로드맵에 **병합**(중복은 합치고 모순은 근거 강한 쪽 채택).
> **게시(M2)는 M1 게이트 통과 전 금지.** 본 문서가 개선 실행의 SSOT.

## 로드맵 개요

| 마일스톤 | 목표 | exit 기준(요약) |
|----------|------|----------------|
| **M1 — 게시 전 게이트 (Pre-Publish Truth Gate)** | 게시 직후 사용자가 0초~첫 설치~첫 명령에서 만나는 모든 '광고≠실동작'을 제거한다. no-false-ship 위반(공급망 실행경로·구브랜드 박제·백업없는 덮어 | (1) grep 으로 다음 4종이 추적파일(dist/templates 제외)에서 0건: bare `npx agent-harness`(scope 없는 것), `uzys-claude-harness`,  |
| **M2 — 게시 실행 (Launch, 신규 코드작업 0)** | M1 게이트 통과 직후, 반자동(폼채움=에이전트 / 제출클릭=사용자) 으로 Show HN + r/ClaudeCode 게시 → 며칠 후 awesome-list 2곳 | Show HN 글 + r/ClaudeCode 글 게시 완료(사용자 제출 클릭) + 각 글 첫 24h 댓글 모니터링·초안(에이전트)→승인 후 응답 라이브. awesome-list 는 bradAGI R |
| **M3 — 게시 후 30일 (Trust Receipts + 신호 반영)** | 0★ cold-start 에서 '검증 인프라=신뢰 대체재'를 사용자에게 보이게 만들고(영수증/SHA 기록), 게시 신호(이슈·반례)를 우선 반영. drift 자동 | (1) skill/plugin 설치 시 resolved commit-SHA 가 .harness-install.json 에 기록되고 uninstall reverse 까지 포함. (2) WORKFLOW |
| **M4+ — 구조/확장성 (게시 후 신호 확보 이후, 1인 capacity 초과 항목)** | North Star 기둥 양립(검증 큐레이션 ↔ 4-CLI 동등성)을 코드구조 차원에서 정합화하고, 카탈로그 확장점(category/kind/CLI/track)의 | (1) ExternalAsset 에 cliSupport 필드 + COMPATIBILITY/홍보문이 자산별 실제 도달 CLI 를 derive(거짓광고 차단) + install 산출보고에 'codex  |
| **M5 — 카탈로그 큐레이션 재검토 (Curation Audit)** | "스택 기반 최소 큐레이션"(과설치 회피·검증된 것만)이 관성으로 흐려졌는지 양방향 audit — 빠진 가치자산(Visual & Media 확장 리서치) + 남을 가치 없는 자산(60 전수 keep/drop). | (1) Visual & Media 용도별 추가후보표+Docker검증 등재 (2) 60 자산 keep/demote/drop 판정표(실측근거) (3) drop=Major CR→사용자+ADR |
| **M6 — 다면 리뷰 (`/uzys:review` 패널 모드, re-scope 2026-06-21)** | `multi-persona-review` 스킬(v26.87.0 출하)을 6-Gate `/uzys:review` 모드로 통합 + delta(동적 페르소나 생성·`.claude/agents/*.md` 자동혼합). 독립 `/uzys:panel` 커맨드 삭제(이중 표면 제거). | (1) `/uzys:review` 패널 모드(독립 커맨드 없음) (2) 동적 페르소나+agent.md 자동혼합 (3) surface parity. SPEC 선행 |

**즉시 착수(immediateNext) — 2026-08-30 갱신:** ~~M2 게시~~ **사용자 보류 유지**(2026-07-17 — HN 티켓 미접수·레딧 접근 불가. 재개 시 `launch-posts.md` 하단 33채널 카탈로그 활용). **백로그의 SSOT 가 이 문서에서 GitHub Issue 로 옮겨졌다**(2026-08-17, #316 에픽 사이클) — 열린 항목은 `gh issue list --state open` 이 정본이고, 이 문서는 **마일스톤 축(M1~M6)** 만 담는다. 구 Lean 실행 큐(ADR-032 ①~⑥)는 v26.103.0~114.0 으로 **전량 종결**됐다. **M2 이후 축의 잔여 = M5 축B(60 자산 전수 keep/drop) · M6 다면 리뷰 통합**, 둘 다 M2 보류에 걸려 있다. **M1~M4 진척은 2026-08-30 에 전수 재판정했다(#337)** — 각 마일스톤의 '진척 상태' 블록이 항목별 판정과 근거 명령을 담고, 그것이 SSOT 다. **M1 잔여는 0 이고**(M2 게시 보류만 남는다), M3·M4 는 게시 신호 확보 전이라 미완이 정상이다.

<details><summary>합성 논리(rationale)</summary>

설계 논리: (1) 사용자=메인테이너 1명, star 0 시점이라 "게시 전 신뢰 자해를 0으로 만든다"가 M1 의 유일 목표 — critical/high 중 '게시 즉시 첫 화면·첫 명령·보안 wedge 를 배신하는 것'만 M1 에 넣고, 코드 구조/확장성(SCALE-*)·백로그성은 게시 후로 미뤘다. (2) 중복 병합: 신규 발견 다수가 기존 persona P0 의 '코드 차원 근원'이라 한 항목으로 합쳤다 — UX-1+SUPPLY-1=공급망 1건(단 SUPPLY-1 의 WORKFLOWS.md:13 근거는 검증 결과 bare npx 아님→실 표면은 README×2+USAGE 3곳으로 정정), CODE-2+SEC-1+persona B-2=파괴적-쓰기 클러스터(B-2 는 문서화만·CODE-2/SEC-1 이 실 데이터손실 버그라 코드fix 가 선행), DEMO-1+DEMO-2+persona '데모재녹화'+PROMO-5/DEMO-4=데모 false-completion 1건, CODE-4+SCALE-2+persona D-1=npx skills unpinned(설치·uninstall·검증 3경로), CODE-9+PROMO-1+SEC-5+SUPPLY-3 은 persona C-1(star drift)의 증거라 C-1 로 흡수. (3) 모순 처리: SEC-1(settings.json overwrite)=critical 과 CODE-2(CLAUDE.md overwrite)=high 는 동일 '백업 없는 덮어쓰기' 결함의 두 표면 — 더 파괴적인 settings.json(사용자 hook 소실)을 P0 hotfix, CLAUDE.md 를 같은 사이클 동반 수정으로 묶되 README B-2 정책표와 동일 내용으로 동기화(no-false-ship 의 derive 원칙). (4) critical 5건 전수 게시-전 판정: 공급망(UX-1/SUPPLY-1)·데모 2건(DEMO-1/DEMO-2)·settings.json(SEC-1) 모두 '게시 0초~첫 설치'에 사용자 도달 → 전부 M1. high 중 META-3(install.sh 구repo명)·UX-2(NEXT 거짓안내)·META-2(SECURITY.md)·CODE-1(--with-ecc 광고)·UX-5(withUzysHarness)는 '게시 첫인상·복붙 가능 표면'이라 M1, 반면 SCALE-1(plugin 비-Claude 미도달)·SCALE-2·NSM-2 류 구조 high 는 30일 내 실행 불가→M3/M4. (5) 과잉확장 경계: 1인·0★ 이므로 콘텐츠 보안스캔(SEC-3/PROMO-8)·plugin→codex 등가설치(SCALE-1 구조변경)·5번째 CLI(SCALE-5) 같은 L 은 전부 M4+. M2 는 신규 코드작업 0 — 순수 게시 실행만 분리해 '게이트 통과=게시 가능'을 명확히 했다.
</details>

## M1 — 게시 전 게이트 (Pre-Publish Truth Gate)

**목표:** 게시 직후 사용자가 0초~첫 설치~첫 명령에서 만나는 모든 '광고≠실동작'을 제거한다. no-false-ship 위반(공급망 실행경로·구브랜드 박제·백업없는 덮어쓰기·거짓 안내·삭제된 플래그 광고)을 0으로. P0 게이트(persona A~D)와 신규 critical/high 코드fix 를 병합 완료.

**완료 판정:** (1) grep 으로 다음 4종이 추적파일(dist/templates 제외)에서 0건: bare `npx agent-harness`(scope 없는 것), `uzys-claude-harness`, 데모 .cast title/banner 의 `claude-harness`, README 임베드 GIF 의 구브랜드. (2) SECURITY.md 존재 + GitHub Security 탭 노출. (3) settings.json·CLAUDE.md 가 기존 프로젝트에서 백업 후에만 변경됨을 검증하는 RED→GREEN 테스트 통과. (4) `node dist/index.js install --help` 출력이 실동작과 일치(--with-codex-prompts·--scope). (5) `npm run ci` exit 0 + 신규 hotfix 태그(v26.84.x 류, CalVer 준수) npm publish green. (6) persona-feedback-improvements.md 의 P0 A/B/C/D 전 항목 체크 + 본 M1 신규항목 SSOT 반영.

> **진척 상태 — 재판정 2026-08-30 (#337). 아래 표의 SSOT.** 판정마다 근거 명령을 병기한다.
> 직전 판정은 **2026-06-21 기준으로 10주간 박제**돼 있었고, 그동안 완료된 것이 잔여로 남아 있었다.
>
> **완료(✓ 재확인):** 공급망 bare npx 교체 · 데모 재녹화(#179) · settings.json/CLAUDE.md 백업 ·
> SECURITY.md 신설 · install.sh/CONTRIBUTING 구 repo명 · NEXT 안내 spec 분기 ·
> `--with-ecc`→`--with ecc-plugin` · `npx skills` pin.
>
> **직전에 "잔여"로 박제돼 있었으나 재판정 결과 완료(5건):**
>
> | 항목 | 판정 근거 (2026-08-30 실측) |
> |---|---|
> | README 수술(B-1~B-5) | `wc -l README.md` = **112** — v26.118.0 에서 393→102 재작성됐고 #339 로 추가 정리. 잔여 표기가 10주 낡았다 |
> | WORKFLOWS star 실측(C-1) | `docs/WORKFLOWS.md:28` — **측정일 2026-06-22 명기** + 출처 repo 6종 열거. 수치가 오래된 것은 별개 축이고, C-1 이 요구한 "실측+날짜"는 충족 |
> | 보안 wedge 문서모순(C-2) | `docs/COMPATIBILITY.md:39` *"We do not scan third-party assets for prompt injection"* + `:45` 4계층 큐레이션 명시 — **톤다운이 문서로 확정**됐다 |
> | WORKFLOWS `withUzysHarness`(UX-5) | 간판표(`WORKFLOWS.md:15-23`) 7행에 **`uzys-harness` 행 자체가 없다**(자산이 삭제됨). 부수 항목도 해소 — `docs/USAGE.md:189` 에 Understanding 포함 |
> | `install --help` 정리(UX-4) | `node dist/index.js install --help` — `--scope` 노출 · `--with-codex-prompts` **부재**. 완료 판정 (4) 와 일치 |
>
> **무효(전제가 사라짐, 1건):** 홍보글 최종본(A-1~A-5) — **M2 게시가 사용자 보류**(2026-07-17,
> HN 티켓 미접수·레딧 접근 불가). 초안은 `docs/research/launch-posts.md` 에 있고, 게시 재개 전에는
> "최종본"이라는 판정 자체가 성립하지 않는다. **지우지 않고 무효로 표기한다** — 지우면 게시 재개
> 시 같은 논의가 처음부터 다시 열린다.
>
> **미완: 없음.** 마지막 잔여였던 todo.md 현행화(NSM-5)는 같은 사이클에서 닫았다 — 그 파일의
> `## 현재 상태` 블록이 `main = v26.121.0` 으로 10주 박제돼 있었고(실제 v26.149.0), 버전 숫자를
> 다시 적는 대신 **`package.json`·`git tag` 를 가리키게** 고쳤다. 같은 사실을 두 곳에 두면 이 줄이
> 또 썩는다. 즉 **M1 잔여는 0 이고, M2 게시 보류만 남는다.**
>
> *원안 발견 목록(2026-06 감사 표)은 전 항목 완료라 2026-08-30 에 걷어냈다 — git 히스토리에 있다.
> 동기화는 ship-checklist 의 '로드맵 SSOT 동기화' 게이트로 유지.*

## M2 — 게시 실행 (Launch, 신규 코드작업 0)

**목표:** M1 게이트 통과 직후, 반자동(폼채움=에이전트 / 제출클릭=사용자) 으로 Show HN + r/ClaudeCode 게시 → 며칠 후 awesome-list 2곳. 코드 변경 없음 — 순수 outward 액션. 전자동 금지(HN 봇정책).

**완료 판정:** Show HN 글 + r/ClaudeCode 글 게시 완료(사용자 제출 클릭) + 각 글 첫 24h 댓글 모니터링·초안(에이전트)→승인 후 응답 라이브. awesome-list 는 bradAGI README PR + hesreallyhim issue form 제출(E-5 반영 1줄 축약). repo description/topics 정렬 재확인 완료.

| P | E | 항목 | 출처 |
|---|---|------|------|
| P0 | S | 데모 GIF README 교체 확정 (M1-DEMO 산출물을 docs/assets/agent-harness-demo.gif 동일경로로 환원) + README 2파일 구브랜드 grep 0건 최종 확인 | persona 게시계획 step1 |
| P0 | M | 반자동 게시 Show HN + r/ClaudeCode: agent-browser/playwright 로 폼 채움 → 사용자 제출 클릭. 제목=A-1 합격작, 본문=A-2~A-5, r/ClaudeCode 는 8종 비교표 직접 게재 | persona 게시계획 step2 + A-1~A-5 |
| P0 | M | 게시 후 첫 24~48h 댓글 모니터링 + 응답 초안(에이전트)→사용자 승인 후 게시. First-Run 실패·반례 지적 즉시 캡처해 M3 백로그로 | persona 게시계획 step2 (모니터링+초안) |
| P1 | S | awesome-list 2곳: bradAGI README PR + hesreallyhim issue form (adoption-c2-submission-kit §2, E-5 반영 1줄 축약·'not a static table' 경쟁저격 제거). 알렉스 권고 = star 두 자리 후이나 issue/PR 제출은 선행 가능 | persona 게시계획 step3 + E-5 |
| P0 | S | C-2 submission kit 본문 과장 정정 후 사용 ('every install method verified by real install in Docker'/'across all 4 CLIs' → COMPATIBILITY 40/43 과 모순) — A-4 와 동일 정정 kit 에 반영 | PROMO-3 (known; 게시 즉시 반례노출이라 M2 선행) |

## M3 — 게시 후 30일 (Trust Receipts + 신호 반영)

**목표:** 0★ cold-start 에서 '검증 인프라=신뢰 대체재'를 사용자에게 보이게 만들고(영수증/SHA 기록), 게시 신호(이슈·반례)를 우선 반영. drift 자동감지 cadence 를 월1회→상시화. 영어권 독자 동선 단절·README.ko drift 해소.

**완료 판정:** (1) skill/plugin 설치 시 resolved commit-SHA 가 .harness-install.json 에 기록되고 uninstall reverse 까지 포함. (2) WORKFLOWS/COMPATIBILITY 영어판 존재 + README 영어 독자가 한국어 문서로 끊기지 않음. (3) verify-catalog 가 PR 또는 주간 cron 으로 격상 + 검증 도구(claude/skills CLI) pin. (4) uninstall 이 codex/antigravity/opencode 산출물(.agents/·AGENTS.md·opencode.json)까지 reverse. (5) README.ko 가 영문판과 자산 id 집합 일치(경량 CI 가드).


> **진척 상태 — 최초 판정 2026-08-30 (#337).** 이 블록은 지금까지 **없었다** — 표에 ✅ 두 줄만
> 개별로 붙어 있었고, 나머지 10행은 완료인지 미완인지 아무도 안 적었다. 아래가 그 판정이다.
>
> | 항목 | 판정 | 근거 (2026-08-30 실측) |
> |---|---|---|
> | resolved commit-SHA 기록 (E-1) | ◐ 미완 | `install-log.ts` 는 **내용 sha256** 만 기록한다(`:71-72`). upstream **commit** SHA 는 없다 — 다른 축이다 |
> | verify-catalog cadence 상향 (SCALE-2) | ◐ 미완 | `catalog-verify.yml:11` `cron: "0 7 1 * *"` — 여전히 **월 1회** |
> | uninstall reverse (CODE-3) | ✅ 완료 | v26.149.0 · #350 (표에 이미 반영) |
> | WORKFLOWS/COMPATIBILITY 영어판 (E-2) | ◐ **부분** | `COMPATIBILITY.md` 는 영문(`# Compatibility & Verification`). `WORKFLOWS.md` 는 **한국어 단일본** — 영어 독자 동선은 여전히 끊긴다 |
> | USAGE 내부코드 정리 + 한국어 혼입 (E-3/UX-6) | ◐ **부분** | 원안 4파일 중 `codex/skills.ts` 는 해소, **3파일에 한글 잔존** — `external-installer.ts` · `install-render.ts` · `uninstall.ts` |
> | wizard Step 3 '추천 그대로 Enter' 안내 (E-4) | ◐ 미완 | `prompts.ts`·`wizard-steps.ts` 에 해당 안내 문자열 0건 |
> | 1st-party 번들링 (wizard row 압축) | ✅ 완료 | v26.99.0 · ADR-028 (표에 이미 반영) |
> | CalVer 자동 가드 (META-1) | ◐ 미완 | `test.yml:118-124` `publish` job 은 `if: startsWith(github.ref, 'refs/tags/v')` 뿐 — **Major=year-2000 정규식 검증이 없다** |
> | 비대화형 fail-loud `--strict` (CODE-10) | ◐ 미완 | `src/commands/install.ts` 에 `--strict` 0건 |
> | update confirm `includeAssets` (CODE-6) | ◐ 미완 | `src/*.ts` 에 `includeAssets` 0건 |
> | 데모 재녹화 자동화 + brand 가드 (DEMO-5) | ◐ **부분** | `scripts/record-demo.sh` **존재**. 'README GIF 의 .cast brand == 현 패키지명' pre-publish 가드는 확인되지 않았다 |
> | install `--dry-run` (Priya·Sam) | ◐ 미완 | `install --help` 출력에 `dry-run` 0건 |

| P | E | 항목 | 출처 |
|---|---|------|------|
| P1 | M | skill/plugin 설치 시 resolved commit-SHA 를 .harness-install.json 에 기록 (재현성·포렌식 — 라케시 도입조건 1) | persona E-1 |
| P1 | M | verify-catalog cadence 상향: 월1회 cron→PR 또는 주간 + 검증에 쓰는 claude/skills CLI 버전 pin('검증도구 자체 drift' 제거) + plugin 명령표면 smoke 1건을 install-matrix 에 | SCALE-2 (high; upstream 파손 최대 30일 미감지) |
| ~~P1~~ ✅ | M | ~~uninstall 누락 reverse~~ → **v26.149.0 완료 (#350 · PR #391)**. 원안(`templates` 에 `agentsDir` 추가)은 **채택하지 않았다** — `.agents/` 는 `npx skills` 와 공유하고 그쪽이 본문을 거기 두므로 통짜 삭제가 남의 스킬 본문을 지운다. 대신 **`externalFiles`(ADR-048)에 이미 있는 경로·sha256 으로 우리가 쓴 파일만** 회수한다(사용자 편집분·비일반파일은 남긴다). 실측: codex `AGENTS.md`+`.agents/`+`.codex/`, opencode `AGENTS.md`+`opencode.json`+`.agents/`, antigravity `.agents/` — 셋 다 uninstall 후 **잔존 0** | CODE-3 (medium; 4-CLI 동등성 uninstall 미충족) |
| P1 | M | WORKFLOWS/COMPATIBILITY 영어판 (영어 README→한국어 문서 동선 단절 — 민준+소피) + README.ko 를 영문판 기준 동기화(Workflow 8행·Non-interactive 섹션·링크) + 자산 id 집합 일치 CI 가드 | persona E-2 + UX-7(known) + UX-10 (medium README.ko drift) |
| P2 | S | USAGE 내부코드 정리(E-3): ADR번호/D25/HITO/NSM → docs/decisions 링크 격리, 약어 첫등장 풀네임 + 한국어 혼입 문자열 4곳 영어화(uninstall.ts:87·codex/skills.ts:20·install-render.ts:231·external-installer formatSkippedReport) + 한글 유니코드 lint 테스트 1개 | persona E-3 + UX-6 (medium 한국어 혼입) |
| P2 | S | wizard Step 3 상단 '추천 그대로 Enter 안전' 안내 + WORKFLOWS 첫 줄 기본 추천 1개 (소피 first-win) | persona E-4 |
| ~~P1~~ ✅ | M | ~~**1st-party 자산 번들링 — wizard row 압축**~~ → **v26.99.0 완료 (ADR-028)**. 실측이 사용자 가설을 부분 반박: Dev 페이지 **37행**이 `prompts.ts` 자신이 명시한 "옵션 ≤ ~30" 제약 위반 중이었고(터미널 넘침 = 증상의 실제 메커니즘), Dev 32항목 중 dev-method 는 4개뿐이라 **번들링만으론 34행으로 여전히 초과**. 사용자 결정(2026-07-16) = **번들 + Dev 분할**. 결과: ⓐ 방법론 8종 → 단일 번들 row(표현 계층만; 제출 시 개별 id 로 펼쳐 downstream·설치보고 불변 = "무엇이 설치되는지" 미은닉) ⓑ 구성원 `DEV_METHOD_SKILL_IDS` derive ⓒ 해제 = 8종 전부 제외(체크박스 1개 = 의미 1개, 개별은 `--with`/`--without`) ⓓ Dev → Dev Core + Dev Tools 분할, wizard 4→5페이지. **실측 렌더 20/13/9/10/10 — 전 페이지 ≤30 달성**(총 69→62행). 행수 상한·all-or-none 불변식을 게이트로 못박음(RED 실증). **잔여: opt-in 1st-party 용도별 그룹핑(ⓑ 원안)은 미실행** — gemini-consult 1개뿐이라 현재 실익 없음, 누적 시 재검토 | 사용자 2026-07-16 (v26.98.0 harness-health-audit 이 8번째로 추가되며 초과 가중 — 원인 제공 릴리즈가 수정) |
| P1 | S | CalVer 자동 가드: `test.yml` 의 `publish` job 첫 step 에 태그 정규식(Major=year-2000) 검증 + 순수모듈로 빼 vitest RED/GREEN. 오타 태그 1개로 영구 오염(npm immutable) 방지 | META-1 (high; 게시 후 다음 ship 전까지 도입이면 충분) |
| P2 | S | 비대화형 경로 fail-loud: --strict opt-in(skipped>0→exit 3) 또는 비대화형 기본 non-zero, USAGE 에 exit code 표 (CI/스크립트 소비자가 자산 skip 을 exit0 으로만 봄, uninstall 과 비대칭) | CODE-10 (medium) |
| P2 | S | update 모드 confirm 이 설치 안 될 'Assets: N selected' 표시 — formatSummary 에 includeAssets:false 옵션 추가 (confirm 단계 Promise=Implementation) | CODE-6 (medium) |
| P2 | M | 데모 재녹화/GIF 변환 자동화 scripts/record-demo.sh + 'README 임베드 GIF 의 .cast brand == 현 패키지명' pre-publish 가드 (drift 재발 구조 차단) | DEMO-5 (medium) |
| P1 | M | **install `--dry-run` / 변경 diff 미리보기**: 설치 전 '무엇을 쓸지'(선택 자산 + settings.json·CLAUDE.md diff) 출력 후 확인 진행. uninstall `--dry-run` 과 대칭 — '쓰기 전 보여줘'로 신뢰 확보. | 페르소나 재리뷰 2026-06-13 (Priya·Sam) |

## M4+ — 구조/확장성 (게시 후 신호 확보 이후, 1인 capacity 초과 항목)

**목표:** North Star 기둥 양립(검증 큐레이션 ↔ 4-CLI 동등성)을 코드구조 차원에서 정합화하고, 카탈로그 확장점(category/kind/CLI/track)의 '분산 하드코딩→derive/컴파일강제'를 수렴. 보안 wedge 의 절반(콘텐츠 스캔 미실행)을 메우거나 톤다운 유지. 전부 L 또는 30일 capacity 초과라 신호 확보 후 착수.

**완료 판정:** (1) ExternalAsset 에 cliSupport 필드 + COMPATIBILITY/홍보문이 자산별 실제 도달 CLI 를 derive(거짓광고 차단) + install 산출보고에 'codex 선택 시 plugin 자산 N개 제외' 명시. (2) category/method.kind/CLI/track 신규 추가 비용이 'derive 1곳 또는 1 Record + 컴파일강제' 로 수렴(런타임 throw 의존 제거). (3) 콘텐츠 prompt-injection 스캔 최소 1회 실행 또는 'security' 주장 톤다운 명문화. (4) prompts.ts selectInstallTargets 동적로직(페이지 ESC 선택보존)이 coverage 포함 + 단위테스트.


> **진척 상태 — 최초 판정 2026-08-30 (#337).** M3 과 같이 이 블록도 지금까지 없었다.
> M4 는 "게시 후 신호 확보 이후" 축이라 **미완이 정상**이다 — 그래도 둘은 이미 끝났다.
>
> | 항목 | 판정 | 근거 (2026-08-30 실측) |
> |---|---|---|
> | `cliSupport` 필드 (SCALE-1) | ✅ 완료 | `src/external-assets.ts` 에 `cliSupport` 5건 |
> | 콘텐츠 스캔 or 톤다운 (SEC-3/PROMO-8) | ✅ 완료(톤다운 쪽) | `COMPATIBILITY.md:39` 가 스캔 안 함을 **명문화**했다. 완료 판정 (3) 의 후자 분기 충족 |
> | `method.kind` 단일 Record (SCALE-4) | ◐ 미완 | `LEVEL_BY_KIND` 가 여전히 `scripts/gen-compatibility.mjs:31` 에만 있다 — `src` 단일 Record 아님 |
> | CLI 와이어링 레지스트리 (SCALE-5) | ◐ 미완 | `cli-transforms.ts` 에 `Record<CliBase` 0건 · `cli.includes` if-체인 **3곳** 잔존 |
> | category 하드코딩 수렴 (SCALE-3) | ◐ **부분** | `prompts.ts:361` `assertPagesCoverAllCategories` **런타임 가드**는 있다. 완료 판정 (2) 가 요구한 "런타임 throw 의존 제거"는 미충족 |
> | track 분류 Record (SCALE-6) | ◐ 미완 | `track-match.ts`·`types.ts` 에 `Record<Track` 0건 |
> | `selectInstallTargets` reducer 추출 (CODE-5) | ◐ **부분** | `tests/interactive.test.ts` 가 호출한다 — 테스트는 있으나 reducer 추출은 미확인 |
> | WORKFLOWS '전부 MIT' 정정 (META-4) | ◐ 미완 | `WORKFLOWS.md:92` 가 여전히 *"현재 세트는 전부 MIT"* — `external-assets.ts:662` 는 같은 세트에 `license none` 자산이 있다고 주석으로 적는다. **문서끼리 모순** |
> | `package.json` keywords (PROMO-7) | ◐ 미완 | `keywords` 필드 **없음** |
> | low 묶음 | ◐ **부분** | `external-assets.ts` **1,296줄**(800줄 cap 초과, SCALE-7 미완) · `--track bogus` 가 유효 목록을 안 낸다(UX-9 미완) · `CHANGELOG.md:4` 가 "Semantic Versioning" 을 링크하는데 `:8` 은 CalVer 라고 적는다(META-7 **모순 잔존**) |

| P | E | 항목 | 출처 |
|---|---|------|------|
| P1 | L | plugin 자산(큐레이션 절반)이 codex/opencode/antigravity 에 영영 미도달 — ExternalAsset.cliSupport 필드화 + COMPATIBILITY/홍보문 derive + install 시점 '제외 자산 N개' 명시 (구조변경은 별도 L) | SCALE-1 (high; 기둥②↔③ 코드구조 양립불가) |
| P1 | L | 보안 wedge 절반만 입증: 콘텐츠 prompt-injection 스캔 최소 1회 실행(없으면 'security' 주장 톤다운 유지) + 'vetting=순수 star 휴리스틱' 정정 | SEC-3 + PROMO-8 + persona P2 (known) |
| P2 | M | method.kind 메타데이터(LEVEL_BY_KIND·CLI_SCOPE·verify·repo도출)를 src 단일 Record 로 모으고 .mjs 가 dist 에서 import → 새 kind = 1 Record+2 switch 컴파일강제 (현재 5곳 분산·default 조용히 누락) | SCALE-4 (medium) |
| P2 | L | CLI 와이어링 Record<CliBase,(params)=>Report\|null> 레지스트리화 — CLI_BASES 추가 시 runCliTransforms 분기 누락(silent no-op)을 컴파일러가 강제 (현재 cli.includes if-체인 4곳 비강제) | SCALE-5 (medium) |
| P2 | S | category 추가 4곳 하드코딩 수렴: INSTALL_TARGET_PAGES·CAT_ORDER 를 CATEGORIES 에서 derive 또는 gen-compat throw 가드를 항상도는 단위테스트로 승격 + CONTRIBUTING 에 'asset 1곳/category 4곳' 비용 명시 | SCALE-3 (medium) |
| P2 | M | track 분류속성(dev/ui/executive/railway)을 단일 Record<Track,{...}> 로, hasDevTrack/hasUiTrack·EXTERNAL_ASSETS 조건이 derive (현재 11 track × asset 매트릭스 수동검토 비용 곱) | SCALE-6 (medium) |
| P2 | M | prompts.ts selectInstallTargets 동적로직(페이지 ESC 선택보존·page0 ESC abort) reducer 추출→coverage 포함+단위테스트, 잔여만 thin adapter 로 남겨 exclude 사유 사실화 (v26.78.0 Critical 의 무테스트 사각지대) | CODE-5 (medium) |
| P2 | S | WORKFLOWS '전부 MIT' vs license-none 자산 3종(vercel-labs 계열) — '대부분 MIT, 일부 명시 라이선스 없음·upstream 직접 fetch' 정정 + license 를 external-assets 정식 필드로 승격 | META-4 (medium) |
| P2 | S | package.json keywords 추가(claude-code·codex·opencode·antigravity·ai-coding·cli·installer·curator 등) — npm organic 발견성 0 인 무료 레버, repo topics 와 정렬. 다음 patch publish 에 포함 | PROMO-7 (medium; M1 hotfix publish 에 끼워도 무방) |
| P2 | M | low/백로그 일괄: detectVersion plugin 사전식 sort(CODE-7), external-assets.ts 800줄 cap 초과 분리(CODE-8/SCALE-7), 테스트 '41 distinct'→43 stale(SCALE-8), --track 에러 유효목록 미제시(UX-9), CHANGELOG 'SemVer' 헤더 vs CalVer 모순(META-7), 채널 dev.to/X 확장(PROMO-10) | CODE-7·CODE-8·SCALE-7·SCALE-8·UX-9·META-7·PROMO-10 (low 묶음) |

---
## M5 — 카탈로그 큐레이션 재검토 (Curation Audit)

> 트리거: 사용자 지시 2026-06-13. 동인 = 자산은 한번 넣으면 관성으로 남는다 — "스택 기반 최소 큐레이션"(과설치 회피·검증된 것만, North Star 기둥①) 철학의 능동 재검증. A2 star-drift CI 보완: CI=star 만, M5=용도/중복/1st-party/철학 정합까지.

**목표:** 카탈로그(현 62 자산 — #355 humanize-korean 추가. 그 전 #353 self-hosted-github-runner 추가. 그 전 2026-08-17 game-engine · game-studios 추가. 그 전 2026-08-16 preline 추가. 그 전 2026-08-02 ADR-060 정비에서 축B 의 큰 몫이 실행됨: 12종 제거. 함께 갔던 uzys 스킬 외부화는 같은 날 ADR-062 가 이관 실패 판정으로 번복·번들 복원)를 양방향 audit — (축A) 빠진 가치자산 없는지(Visual & Media 용도별 확장 리서치) + (축B) 남을 가치 없는 자산 없는지(전수 유지가치 재검토). "넣자"는 쉽고 "빼자"는 안 해 쌓이는 큐레이션 부패 방지.

**완료 판정:** (1) Visual & Media 용도별(슬라이드/다이어그램/모션/동영상/녹화) 추가 후보표 갱신 + Docker 실설치 통과분만 등재(no-false-ship). (2) 60 자산 각각 keep/demote/drop 판정표 + 실측근거(추정 금지). (3) drop 판정 = Major CR(사용자 도달경로 변경)→사용자 결정+ADR.

| P | E | 항목 | 출처 |
|---|---|------|------|
| P2 | M | **축A — Visual & Media 확장 리서치**: 모션(현 GSAP 1)·동영상(현 Remotion 1)이 vetted 1개씩 → 추가 후보 재탐색(neighborhood 변화·star 성장). 화면녹화 용도(현 0, 캡처라 제외) 코드-제작형 신규 등장 재검토. 슬라이드/다이어그램 1st-party 프레임워크(Slidev·reveal 본가) 등장 시 교체. Docker 통과분만 등재. | 사용자 2026-06-13 |
| P2 | L | **축B — 전체 카탈로그(62) 유지가치 재검토**: 자산별 keep/demote/drop. 판정축 ① star/활성 drift(trust-tier-drift 실측) ② 용도 중복(같은 일 2자산) ③ 1st-party 대체재 등장 ④ 사용 신호(있으면). experimental 잔류(railway 268·playwright 264·revealjs 347 — ADR 179는 v26.106.0 ADR-035로 제거됨) 승격 or 제거. *(next-skills·gsd-orchestrator 는 2026-07-14 제거 — ADR-024)* | 사용자 2026-06-13 |
| P3 | S | drop 후보 = Major CR(도달경로 변경)→사용자 결정+ADR. 제거 자산은 uninstall reverse·문서(COMPATIBILITY/WORKFLOWS) 동기화까지. | 사용자 2026-06-13 |

> "플랜에만"(사용자 2026-06-13): 정의만 추가, 착수는 순차(M2 게시 후). 정기성 = M3 신호 확보 뒤 1회 + 분기 권장. 차기 사이클에 Visual & Media 9종 자체도 재평가 대상.
>
> **상태 (2026-06-21 감사):** 자산 수 48→**59** 정정(실측 — `external-assets.ts`). 축A 'Visual & Media 확장'은 v26.85.0(#169 +5)·v26.86.0(#178 +4)로 **이미 9종 투입** — M5 착수(M2 게시 후) 전 실행이라 M5 가 경고한 '관성 쌓기'와 순서 모순. 처리: 9종에 Docker 실설치 증거 소급 등재 시 **축A 완료** 처리, **축B(전수 keep/drop)가 잔여** — 대상은 현재 **60 자산** (실측 2026-08-17. 한때 65 였고 ADR-060 정비로 12종 제거 후 preline·game 3종이 들어와 60 이 됐다. 위 "48→59"는 2026-06-21 감사 시점의 실측 기록).

---
## M6 — 다면 페르소나 리뷰 커맨드 (Multi-Perspective Review)

> 트리거: 사용자 지시 2026-06-13. PoC = 본 세션에서 게시 글을 상황 맞춤 페르소나 5명(Sonnet)으로 병렬 리뷰한 것이 유효 → uzys-harness 커맨드로 일반화. 6-Gate 의 review 심화 (단일 리뷰 → 다관점 패널).

> **🔄 RE-SCOPE (2026-06-21 페르소나 감사 / 사용자 결정):** v26.87.0 이 `multi-persona-review` **스킬**을 출하 → 다면 페르소나 병렬 리뷰 + 종합(P0/P1/P2)은 **이미 스킬이 담당**. 독립 `/uzys:panel` 커맨드를 신설하면 진입점 2개(스킬+커맨드) = 이중 표면(거짓출하 구조). **결정: 독립 커맨드 삭제, 스킬을 `/uzys:review` 게이트에 통합 + 신규 delta 만 구현.** (아래 line 123 트리거는 historical 기록.)

**목표(재정의):** `multi-persona-review` 스킬을 uzys-harness **6-Gate 의 `/uzys:review` 모드**로 통합하고, 스킬이 아직 못 하는 **delta 만** 추가한다 — (a) 대상 분석 기반 **동적 페르소나 생성**, (b) 설치된 정적 리뷰어 `.claude/agents/*.md` **자동 탐지·혼합**. 패널 실행 방법론 자체는 스킬에 위임(재구축 금지). `(uzys-agent-harness)` brand. 4-CLI 대응은 스킬 범용성으로 이미 확보(비-Claude 는 command 폴백).

**완료 판정:** (1) `/uzys:review` 가 `multi-persona-review` 스킬을 호출하는 패널 모드 보유(독립 `/uzys:panel` 커맨드 **없음**). (2) 동적 페르소나 생성 = 대상 분석 → 관련 관점 자동 도출(사용자 추가/제외 가능). (3) `.claude/agents/*.md` 자동 탐지·혼합(없으면 페르소나만). (4) 카탈로그/문서 surface parity. (5) SPEC 선행 + 테스트(동적생성·혼합·종합 단위).

| P | E | 항목 | 출처 |
|---|---|------|------|
| P2 | M | `/uzys:review` 에 `multi-persona-review` 스킬 호출 패널 모드 통합 + delta(동적 페르소나 생성·`.claude/agents/*.md` 자동혼합) 구현. **독립 `/uzys:panel` 커맨드 삭제**. SPEC 선행. | 사용자 2026-06-21 (re-scope) |
| P3 | M | 페르소나 라이브러리(재사용 관점 템플릿: 회의적시니어/타겟유저/입문자/보안/비주류CLI 등) + 대상별 자동 선택 휴리스틱 | 사용자 2026-06-13 |

> **OQ 닫힘(2026-06-21):** "`/uzys:review` 통합 vs 독립 커맨드" → **review 모드로 통합** 확정(독립 커맨드 삭제). 우선순위 P1→**P2 강등**: 핵심(패널 리뷰)은 스킬로 이미 출하됐고, delta 는 게시(M2) 후 신호 확보 뒤 착수해도 늦지 않음. 본 세션 5-페르소나 리뷰(2026-06-21)가 재확인된 PoC.

---
## 부록 A — 아직 열려 있는 발견 (evidence·proposedFix)

> **2026-08-30 정리 (#337 재판정 후).** 이 부록은 2026-06 감사의 원자료였다. **완료로 판정된 15건과
> 기각 8건·저심각 35건을 걷어냈다** — 완료된 것의 상세 근거는 이제 읽을 사람이 없고, 남은 것을
> 찾기만 어렵게 만든다(지운 내용은 git 히스토리에 있다). **열린 작업의 SSOT 는 GitHub Issue 다**
> (`gh issue list --state open`) — 아래는 아직 이슈로 올리지 않은 것들의 상세이고, 착수할 때
> 이슈로 옮긴다. 각 항목의 현재 판정은 해당 마일스톤의 '진척 상태' 블록이 SSOT.

### SCALE-2 · HIGH·M · upstream 파손 감지기(verify-catalog)가 월 1회 cron + 태그에서만 + claude/npx skills unpinned — plugin 명령체계 변경 최대 1개월 미감지
- **dimension:** extensibility
- **evidence:** .github/workflows/catalog-verify.yml — `schedule: cron '0 7 1 * *'`(매월 1일) + workflow_dispatch 만. push/PR 트리거 없음. scripts/verify-catalog.mjs:45-48 은 bare `claude plugin install`(설치된 claude 버전 무엇이든) 호출, :51-53 은 `npx ... skills add`(버전 미고정). test.yml/install-matrix.yml 도 `tags: v*` 전용(test-policy.md 확인: PR 마다 안 돔).
- **detail:** Promise=Implementation(NSM 100%)을 지키는 유일한 자동 수단이 verify-catalog 인데, (a) 월 1회만 돌아 claude CLI 가 `plugin install` 문법/marketplace 명령을 바꾸면 다음 cron(최대 30일)까지 모름, (b) 검증에 쓰는 claude·skills CLI 자체가 unpinned 라 'CLI 가 바뀌어서 깨진 것'과 '자산이 바뀌어서 깨진 것'을 구분 못 함. P0 D-1(buildSkillArgs npx skills unpinned)은 설치 경로만 지적하나, 검증 경로(verify-catalog.mjs)의 동일 unpinned 도 같은 취약성이다. 자산 43개로 늘어난 지금 upstream 한 곳만 깨져도 거짓광고가 되는데 감지 지연이 크다.
- **proposedFix:** verify-catalog.yml 에 PR 트리거(또는 주간 cron)로 cadence 상향. verify-catalog.mjs 가 호출하는 claude/skills CLI 버전을 워크플로에서 핀(npm i -D @anthropic-ai/...@x 또는 skills@1.5.7)해 '검증 도구 자체 drift' 제거. 추가로 claude plugin 명령 표면(--scope/marketplace add 형식)을 검사하는 smoke 1건을 install-matrix 에 넣어 plugin 문법 회귀를 별도 신호로 분리.

### META-1 · HIGH·S · 태그→npm publish 경로에 CalVer(Major=year-2000) 자동 가드 0 — 오타 1개로 잘못된 버전 영구 게시
- **dimension:** meta
- **evidence:** .github/workflows/test.yml 의 `publish` job — `npm pkg set version="${GITHUB_REF_NAME#v}"` → `npm publish` (사이 검증 없음); .claude/rules/git-policy.md 'Pre-tag checklist'/'Drift Period' = 수동 절차만
- **detail:** `publish` job 은 푸시된 태그 문자열에서 v 만 떼어 그대로 package.json version 으로 박고 npm publish 한다. 정규식·연도 매핑·범위 검증이 전무하다. git-policy.md 가 명시하듯 2026-04-18~30 에 v27.0.0~v28.0.0 21건이 컨벤션을 위반해 누적된 전례(ADR-007)가 있는데도, 그 재발을 막을 자동 게이트는 코드화되지 않았다. npm 은 동일 버전 재게시를 금지하므로(immutable) 오타 태그(예 `v27.0.0`, `v2.6.83`)가 한 번 publish 되면 영구 오염이고 unpublish 24h 제약·복구 비용이 크다. no-false-ship.md 의 v26.82.0 사례(--version 거짓 보고)와 같은 '버전 SSOT 신뢰' 카테고리 리스크.
- **proposedFix:** `test.yml` 의 `publish` job(및 install-matrix/ci) 첫 step 으로 태그 가드 추가: `[[ "${GITHUB_REF_NAME}" =~ ^v$(( $(date +%Y) - 2000 ))\.[0-9]+\.[0-9]+$ ]] || { echo '::error::CalVer 위반: Major 는 year-2000'; exit 1; }`. 동일 정규식을 scripts/ 의 순수 모듈로 빼 vitest 로 RED/GREEN 테스트(test-policy TDD). publish job 의 `needs:` 에 이 guard job 을 걸어 publish 전 차단 — `publish` 가 `test.yml` 로 이식되며 이미 `needs: ci` 를 갖고 있으므로 guard job 을 같은 워크플로에 추가해 `needs: [ci, guard]` 로 늘리기만 하면 된다.

### CODE-10 · MEDIUM·S · 외부 자산 일부 실패해도 install exit code 0 — 스크립트/CI 소비자에게 fail-loud 불성립
- **dimension:** code
- **evidence:** src/commands/install.ts:262-307 `executeSpec` — pipeline throw 시에만 exit(1), `report.external.skipped > 0` 은 renderFinalSummary 의 WARN 행(install-render.ts:317-327) 표시 후 정상 종료. 대조: src/commands/uninstall.ts:171 은 `exit(failed === 0 ? 0 : 1)` 로 실패를 exit code 에 반영.
- **detail:** warn-skip 설계(OQ1, external-installer.ts:6-7 — abort 는 vibe killer)는 사람 대상 화면에선 타당하나, 비대화형 `--track` 경로를 CI/스크립트에서 쓰는 소비자는 자산 N 개가 통째로 skip 돼도 exit 0 만 보게 된다. uninstall 과 exit code 정책이 비대칭이고, test/docker 시나리오들도 exit code 대신 로그 grep 으로 검증하는 우회를 쓰고 있다(scenario-pinned-versions.sh 의 grep 패턴).
- **proposedFix:** 비대화형 경로에 opt-in `--strict`(skipped>0 → exit 3) 추가가 최소 변경. 또는 비대화형일 때만 기본 non-zero + 종료 직전 한 줄 사유(현행 warn-skip UX 유지). docs/USAGE.md 에 exit code 표 명시. uninstall 의 기존 정책과 정렬.

### CODE-5 · MEDIUM·M · prompts.ts 커버리지 제외 사유가 stale — v26.78.0 Critical 버그가 살았던 페이지 루프 로직이 무테스트
- **dimension:** code
- **evidence:** vitest.config.ts exclude 주석: "src/prompts.ts: thin @clack/prompts adapter (no transformation logic)". 실제 src/prompts.ts:262-381 `selectInstallTargets` 는 페이지 루프·collected Set merge(361-364)·ESC prev-page 분기(353-359)·alt-screen 제어 등 ~120줄 분기 로직. tests/interactive.test.ts:24-25 는 항상 selectInstallTargets 를 mock — 실 구현 경유 테스트 0.
- **detail:** v26.78.0 의 Critical(understanding 카테고리 wizard 미노출)이 정확히 이 파일에서 발생했고, 이후 assertPagesCoverAllCategories(prompts.ts:146-162)+wizard-page-parity 테스트로 '정적 구조' 는 가드됐다. 그러나 페이지 간 선택 보존(collected delete→add), ESC 뒤로가기 시 선택 유지, page 0 ESC abort 같은 '동적 동작' 은 어떤 테스트도 통과하지 않으며 coverage gate(branches 88)에서도 통째로 제외돼 회귀가 조용히 들어올 수 있는 유일한 큰 사각지대다.
- **proposedFix:** selectInstallTargets 의 순수 부분(buildPageGroups, 페이지 전환·collected merge 를 (state, event)→state reducer 로) 을 별도 모듈(예: src/wizard-targets-state.ts)로 추출해 coverage 포함 + 단위 테스트(페이지 ESC 후 선택 보존, page0 ESC abort 등 WHY 단언). prompts.ts 잔여는 진짜 thin adapter 만 남겨 exclude 사유를 사실로 복구.

### CODE-6 · MEDIUM·S · update 모드 confirm 화면이 설치되지 않을 'Assets: N selected' 를 표시 (오해 유발)
- **dimension:** code
- **evidence:** src/interactive.ts:117-124 — update 분기에서 `formatSummary({tracks: state.tracks, ...})` 호출, formatSummary(interactive.ts:302-308)는 무조건 `finalSelectedAssets` 로 Assets 섹션 생성. 반면 src/installer.ts:237-239 update 모드는 'manifest copy / external 모두 skip'.
- **detail:** 기존 설치 프로젝트에서 wizard 의 Update 를 고르면 confirm 문구가 "UPDATE policy files only:" 라면서 바로 아래 트랙 추천 자산 목록(예: dev-tools: find-skills, karpathy-coder ...)을 'N selected' 로 나열한다. 실제 update 는 외부 자산을 하나도 설치하지 않으므로 confirm 화면의 약속과 실동작이 어긋난다 — 소형이지만 confirm 단계의 Promise=Implementation 위반.
- **proposedFix:** src/interactive.ts update 분기에서 formatSummary 에 자산 섹션 생략 옵션(예: `formatSummary(spec, { includeAssets: false })`)을 추가해 Tracks/Target 만 표시. interactive.test.ts 에 'update confirm 에 Assets 행이 없다' 단언 추가.

### UX-6 · MEDIUM·S · 영어 사용자에게 노출되는 CLI 출력·설치 산출물에 한국어 문자열 혼입
- **dimension:** ux
- **evidence:** src/commands/uninstall.ts:87 `"[DRY RUN] reverse list (실제 변경 없음):"` · src/codex/skills.ts:20 `\`uzys-${params.phase} phase skill (Codex 포팅)\`` (설치되는 SKILL.md description 필드에 기록) · src/commands/install-render.ts:231 `"(/uzys-spec slash 등록)"` · src/external-installer.ts:416 `"...개 외부 자산이 설치되지 않았습니다"` (formatSkippedReport — 현재 렌더 경로 미사용이나 export 됨)
- **detail:** HN/r/ClaudeCode 게시 대상은 영어권인데, uninstall --dry-run 첫 줄과 Codex 산출물 SKILL.md 의 description(에이전트가 읽는 메타데이터)에 한국어가 남는다. templates/CLAUDE.md 는 #150 에서 영어화했으나 코드 내 문자열은 누락. 기능 파손은 아니지만 '국제 사용자용 도구' 첫인상에서 미완성 신호를 주고, SKILL.md description 은 Codex 의 skill 선택 추론에 들어가는 텍스트라 품질에도 영향 가능.
- **proposedFix:** 위 4곳을 영어로 교체 (예: '(no changes made)', '(ported for Codex)', '(/uzys-spec slash registered)'; formatSkippedReport 는 미사용이면 삭제). 재발 차단: 사용자-facing 문자열(log/err/산출물 템플릿)에 한글 유니코드 범위를 검출하는 lint 테스트 1개 추가.

### UX-10 · MEDIUM·S · README.ko 가 영문 README 대비 drift — 워크플로 8종 중 4종 누락, 비대화형 설치 섹션·검증 링크 부재
- **dimension:** ux
- **evidence:** README.ko.md:133-140 Workflow 표 = uzys-harness/addy/superpowers/gsd 4행 vs README.md:152-165 = 8행(openspec·bmad-method·wshobson-agents·ecc-plugin 추가, v26.75.0+). README.ko 에 'Non-interactive install' 섹션(README.md:41-58)·WORKFLOWS.md 가이드 링크(README.md:154)·trust tier 검증 문단(README.md:187) 모두 부재
- **detail:** 한국어 독자는 (1) 설치 가능 워크플로를 절반만 보고, (2) CI/스크립트용 flag 경로와 ADR-022 BREAKING(`--with-bmad` 류 삭제) 공지를 못 보며, (3) 제품 차별화 증거(검증 매트릭스 링크)에 도달하지 못한다. 영어 README 만 갱신되고 ko 가 따라가지 못한 전형적 이중 하드코딩 drift — no-false-ship 의 'derive 단일화 또는 가드' 원칙이 문서 쌍에는 미적용 상태.
- **proposedFix:** README.ko.md 를 영문판 기준으로 동기화 (Workflow 표 8행, Non-interactive 섹션, WORKFLOWS/COMPATIBILITY 링크). 재발 차단: README ↔ README.ko 의 자산 id 집합 일치를 검사하는 경량 스크립트를 catalog-verify CI 에 추가하거나, 표를 gen-compatibility 식 자동 생성 블록으로 전환.

### SCALE-3 · MEDIUM·S · 신규 카테고리 추가 = 4곳 하드코딩 동기화(2곳은 컴파일 에러 아닌 런타임 throw 의존)
- **dimension:** extensibility
- **evidence:** 신규 Category 시 수정 필요: src/categories.ts CATEGORIES+CATEGORY_TITLES(:11-33), src/prompts.ts INSTALL_TARGET_PAGES(:133-140), scripts/gen-compatibility.mjs CATEGORY_TITLE+CAT_ORDER(:45-64), src/commands/install-render.ts(CATEGORY_TITLES 소비). 가드는 prompts.ts:146 assertPagesCoverAllCategories(모듈 로드 throw)와 gen-compatibility.mjs:73 throw — 둘 다 **런타임** 검출이지 타입 에러 아님.
- **detail:** v26.78.0 understanding 카테고리 누락 회귀(no-false-ship 사례표 등재)의 재발 방지로 throw 가드 2개가 추가됐고 효과적이다. 다만 (a) CATEGORY_TITLES(categories.ts)는 Record<Category> 라 컴파일 강제지만 INSTALL_TARGET_PAGES·gen-compat CAT_ORDER 는 자유 배열이라 누락 시 테스트/스크립트 실행 전까지 안 잡힌다, (b) 페이지 묶음(어느 카테고리를 어느 wizard 페이지에) 결정은 여전히 사람 판단 — 자산 카테고리가 8개를 넘어 페이지당 ~30 옵션 한계에 닿으면 페이지 재설계 필요. '카탈로그 entry 1곳' 주장은 카테고리/method/source 재사용 시에만 성립함을 README/문서에 명시할 가치.
- **proposedFix:** INSTALL_TARGET_PAGES·CAT_ORDER 를 categories.ts 의 CATEGORIES 순서에서 derive 하거나, 최소한 prompts.ts·gen-compat 의 throw 가드를 tests/wizard-page-parity 처럼 항상 도는 단위 테스트로 승격(이미 wizard-page-parity.test.ts 존재 — gen-compat 카테고리 가드도 동일 패턴 테스트 추가). README B-3 트리 작업 시 'asset 추가 1곳 / 신규 카테고리 4곳' 비용을 CONTRIBUTING 에 적기.

### SCALE-4 · MEDIUM·M · 신규 method.kind 추가 = 5+ 파일 분산 수정, 컴파일 강제는 2곳뿐
- **dimension:** extensibility
- **evidence:** ExternalAssetMethod union: src/external-assets.ts:19-41. 새 kind 추가 시 컴파일 강제되는 곳 = external-installer.ts:178 installOne switch + install-render.ts:356 formatAssetMeta switch(exhaustive). 강제 안 되는 곳 = external-installer.ts:352 detectVersion(default:return undefined 라 새 kind 조용히 미지원), scripts/gen-compatibility.mjs:21-40 LEVEL_BY_KIND/CLI_SCOPE(객체 lookup, 누락 시 '⚪'/undefined), scripts/verify-catalog.mjs:43-64(else 분기로 'local skip' 오분류), src/trust-tier-drift.ts:54-57 repoForAsset(skill/plugin 외 null→REPO_OVERRIDE 의존).
- **detail:** method 종류는 카탈로그 스키마의 핵심 확장점인데 추가 비용이 비대칭이다. switch 2곳은 TS 가 누락을 잡아주지만, gen-compatibility·verify-catalog·detectVersion·trust-tier-drift 는 .mjs(dist 소비) 또는 default/lookup-miss 라 새 kind 가 '검증 안 됨/버전 미표시/repo 도출 불가'로 조용히 빠진다. internal kind(v26.81.0) 추가 때 이 4곳을 다 손본 이력이 주석에 남아있어(gen-compat:27, verify-catalog:59-61) 실제로 매번 분산 수정이 일어남을 방증한다.
- **proposedFix:** method.kind 의 메타데이터(검증등급 LEVEL_BY_KIND, CLI_SCOPE, verify 동작, repo 도출 가능성)를 src 의 단일 Record<kind, {...}> 로 모으고 .mjs 는 dist 에서 그 Record 를 import(이미 trust-tier-drift.ts 가 re-export 패턴 보유). 그러면 새 kind 추가 시 컴파일러가 Record 누락을 강제 → '5곳 분산'이 '1 Record + 2 switch'로 수렴.

### SCALE-5 · MEDIUM·L · 5번째 CLI 추가 = 신규 transform 모듈 풀세트 + installer 6분기 + 라벨맵 3종(라벨맵만 컴파일 강제)
- **dimension:** extensibility
- **evidence:** CLI_BASES: src/types.ts:28. 5번째 CLI 시 신규 src/<cli>/transform.ts(+opt-in)+templates/<cli>/ 필요(codex 674줄/opencode 390줄/antigravity 219줄 선례). installer.ts cli.includes 분기 4곳(:246,457,485,493)+ install.ts:159,166 + install-log.ts:128-129 수동 추가. 컴파일 강제되는 건 Record<CliBase> 라벨맵 3종뿐: prompts.ts:106 CLI_BASE_LABELS, install-render.ts:27 CLI_SUMMARY_LABELS, external-installer.ts:238 SKILLS_CLI_AGENT_MAP.
- **detail:** CLI 추가는 본질적으로 무거운 작업(전용 transform 파이프라인)이라 L 이 불가피하나, 문제는 cli.includes 분기들이 컴파일 강제 밖이라는 점이다. 새 CLI 를 CLI_BASES 에 넣어도 installer.ts 의 runCliTransforms 에 분기를 안 넣으면 '그 CLI 선택 시 아무 산출도 안 나는' silent no-op 이 된다(타입 에러 없음). Record<CliBase> 3종은 잘 강제되지만 transform 와이어링은 사람 기억에 의존. 4-CLI 동등성이 North Star 핵심인데 5번째 진입 장벽이 코드 분산으로 높다.
- **proposedFix:** CLI 별 transform 와이어링을 Record<CliBase, (params)=>Report|null> 레지스트리로 만들어 installer.ts 가 그 레지스트리를 순회하게 하면, CLI_BASES 에 추가 시 레지스트리 항목 누락을 컴파일러가 강제(claude 는 baseline 특례라 예외 표기). 현재 cli.includes if-체인을 데이터 주도로 전환.

### SCALE-6 · MEDIUM·M · 신규 Track 추가 = 컴파일 강제 1곳(TRACK_RULES) + 비강제 ~11곳 + project-claude fragment 디렉토리
- **dimension:** extensibility
- **evidence:** TRACKS: src/types.ts:2-14. 컴파일 강제: src/manifest.ts:61 TRACK_RULES: Record<Track,string[]>(누락 시 TS 에러). 비강제 수동: external-assets.ts 의 조건 상수들(ALL_CSR_SSR_FULL/RAILWAY_TRACKS 등 :86-144), prompts.ts:75 TRACK_LABELS, env-files.ts:50 ENV_EXAMPLE_TRACKS, track-match.ts hasDevTrack/hasUiTrack 글롭(:13-21), templates/project-claude/fragments/<track>/ 신규 디렉토리. grep 확인: 'csr-supabase'|TRACKS 하드코딩 12개 src 파일.
- **detail:** Track 은 TRACK_LABELS·TRACK_RULES 가 Record<Track> 라 라벨/룰 누락은 컴파일에 잡힌다(좋음). 그러나 (a) 새 track 이 어느 자산 조건(any-track 배열)에 들어가는지는 EXTERNAL_ASSETS 43개를 일일이 훑어 결정해야 하고, (b) hasDevTrack/hasUiTrack 글롭 패턴에 포함될지는 track-match.ts 문자열 글롭 수정이 필요한데 이건 타입 강제 밖, (c) project-claude fragment 디렉토리(현재 10개)를 새로 만들지 않으면 mergeProjectClaude 가 그 track 컨텍스트를 비움. 11 Track 으로 이미 늘어난 상태라 track×asset 조건 매트릭스 검토 비용이 자산 증가와 곱해진다.
- **proposedFix:** track 의 분류 속성(dev/ui/executive-style/railway 포함 여부)을 types.ts 근처 Record<Track,{dev,ui,...}> 단일 테이블로 모으고 hasDevTrack/hasUiTrack 과 EXTERNAL_ASSETS 조건이 그 테이블에서 derive(현재 EXECUTIVE_STYLE_TRACKS/DEV_TRACKS 상수는 이미 부분적으로 이 방향). 새 track = 테이블 1행 + fragment 1디렉토리로 수렴시키고, fragment 누락을 install 테스트가 검출하게.

### PROMO-7 · MEDIUM·S · package.json 에 keywords 필드 부재 — npm 검색 발견성 0, 채널 전략의 npm 유입 경로 누락
- **dimension:** promotion
- **evidence:** package.json 전체에 'keywords' 키 없음(grep 결과 NO keywords field). npm view @uzysjung/agent-harness keywords → 빈 값. C-2 kit:36 은 repo topics(claude-code/codex/...)만 권고, npm keywords 는 미언급.
- **detail:** 감사 차원의 'npm 발견성' 항목 직접 해당. npmjs.com 검색('claude code skills', 'agent harness', 'ai coding workflow')에서 keywords 없으면 랭킹·노출 누락. C-2 kit이 GitHub topics는 챙겼으나 npm keywords는 빠뜨림 — HN/Reddit 외 organic npm 유입 채널이 사실상 닫힘. 0★ cold start에서 organic 발견은 귀한 자원인데 무료 레버를 안 씀.
- **proposedFix:** package.json 에 keywords 추가(예: claude-code, codex, opencode, antigravity, ai-coding, agent-skills, cli, installer, curator, workflow, bmad, superpowers). repo topics(C-2 kit:36)와 정렬. 다음 patch publish 에 포함.

### META-4 · MEDIUM·S · WORKFLOWS.md '전부 MIT' 주장 vs 실제 license-none 자산 3종 — 재배포 적법성/정직성 결함
- **dimension:** meta
- **evidence:** docs/WORKFLOWS.md:69 '현재 세트는 전부 MIT'; src/external-assets.ts:386,497,523 `tier: "vetted", // ... (license none — 출처 신뢰)` (vercel-labs/skills, vercel-labs/agent-skills ×2)
- **detail:** 큐레이션 기준 L69 가 '라이선스 — copyleft/proprietary 는 신중(현재 세트는 전부 MIT)'라 단언하는데, 정작 자산 SSOT(external-assets.ts)는 vercel-labs/skills·agent-skills 등 최소 3개 entry 에 'license none' 을 주석으로 남겨뒀다. 라이선스 없음 = MIT 아님이고, 법적으로는 MIT(명시적 재배포 허용)보다 더 모호하다(저작권자가 권리 전부 보유, 재배포 권리 미부여). 본 제품은 이 자산들을 설치 명령으로 '유통'하므로(NORTH_STAR: '신뢰받는 유통 채널'), '전부 MIT' 표기는 (a) no-false-ship 위반(검증 안 한 라이선스를 MIT 라 주장) (b) license-none 자산 재배포 적법성 미검토. 페르소나 라케시의 'unpinned HEAD 유통 채널' 지적과 같은 결.
- **proposedFix:** WORKFLOWS.md:69 를 '대부분 MIT, 일부(vercel-labs 계열)는 명시 라이선스 없음 — 출처 신뢰 기반, 재배포는 설치 시점 upstream 직접 fetch(우리가 사본 호스팅 안 함)' 로 정정. 각 자산 license 필드를 external-assets 스키마에 정식 필드로 승격(주석→데이터)하고 license-none 은 'unlicensed' 로 라벨. 가능하면 upstream 에 라이선스 추가 요청 이슈(외부 읽기 범위 밖 — 사용자 액션).

### DEMO-5 · MEDIUM·M · 데모 재녹화/GIF 변환 자동화 스크립트 부재 — drift 재발 구조
- **dimension:** extra:데모 GIF 콘텐츠가 구 브랜드(uzys-claude-harness)를 그대로 노출 — rename PR(#164)이 파일명만 바꾸고 .cast 콘텐츠는 재녹화 안 함 → '완료처럼 보이는 미완(false-completion)'. README 첫 시각 자산이 HN 게시 즉시 구명 광고
- **evidence:** scripts/ grep 'asciinema|agg|demo.cast|demo.gif|record' 결과 hito-aggregate.sh / nsm-aggregate.sh / fresh-dogfood-setup.sh 만 매치 — 데모 재녹화·agg 변환 타깃 0건. Makefile/package.json 에도 데모 record 스크립트 없음.
- **detail:** 데모 .cast→.gif 생성·재녹화가 수기 절차로만 존재해, 브랜드/기본자산 변경 시마다 사람이 기억해 재녹화해야 한다. DEMO-1(rename 시 콘텐츠 미반영)·DEMO-3(opt-in 전환 후 stale 데모)이 둘 다 이 '수기 의존' 에서 발생했다. no-false-ship.md 'Drift 구조 차단' 원칙(동일 정보 2곳 하드코딩 시 derive/가드 없이 머지 금지)의 자산 버전 — 데모 콘텐츠가 코드 default 와 분리돼 자동 동기화 수단이 없다.
- **proposedFix:** scripts/record-demo.sh 추가: 신명 바이너리로 asciinema rec → agg 로 docs/assets/agent-harness-demo.gif 생성, 사용한 install 명령(플래그 포함)을 .cast 옆 .meta 로 기록. CI 또는 pre-publish 체크에 'README embed GIF 의 .cast title/banner brand grep == 현 패키지명' 1줄 가드 추가. 코드 default(preset-recommend recommendedExternalAssets)와 데모 캡처 명령의 정합을 테스트로 고정 검토.

---

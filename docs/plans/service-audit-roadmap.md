# 전체 서비스 감사 → 차기 마일스톤 로드맵 (SSOT)

> 작성 2026-06-13 · 기준 v26.83.0 · 방법: ultracode 7차원 병렬 감사 → 적대 검증(critical/high 3표 다수결·medium 1표) → 완전성 비평 → 로드맵 합성
> 규모: 87 에이전트 · 검증 **확정 29 / 미검증 0 / 기각 8**. 기존 `persona-feedback-improvements.md`(P0~P2)를 본 로드맵에 **병합**(중복은 합치고 모순은 근거 강한 쪽 채택).
> **게시(M2)는 M1 게이트 통과 전 금지.** 본 문서가 개선 실행의 SSOT.

## 로드맵 개요

| 마일스톤 | 목표 | exit 기준(요약) |
|----------|------|----------------|
| **M1 — 게시 전 게이트 (Pre-Publish Truth Gate)** | 게시 직후 사용자가 0초~첫 설치~첫 명령에서 만나는 모든 '광고≠실동작'을 제거한다. no-false-ship 위반(공급망 실행경로·구브랜드 박제·백업없는 덮어 | (1) grep 으로 다음 4종이 추적파일(dist/templates 제외)에서 0건: bare `npx agent-harness`(scope 없는 것), `uzys-claude-harness`,  |
| **M2 — 게시 실행 (Launch, 신규 코드작업 0)** | M1 게이트 통과 직후, 반자동(폼채움=에이전트 / 제출클릭=사용자) 으로 Show HN + r/ClaudeCode 게시 → 며칠 후 awesome-list 2곳 | Show HN 글 + r/ClaudeCode 글 게시 완료(사용자 제출 클릭) + 각 글 첫 24h 댓글 모니터링·초안(에이전트)→승인 후 응답 라이브. awesome-list 는 bradAGI R |
| **M3 — 게시 후 30일 (Trust Receipts + 신호 반영)** | 0★ cold-start 에서 '검증 인프라=신뢰 대체재'를 사용자에게 보이게 만들고(영수증/SHA 기록), 게시 신호(이슈·반례)를 우선 반영. drift 자동 | (1) skill/plugin 설치 시 resolved commit-SHA 가 .harness-install.json 에 기록되고 uninstall reverse 까지 포함. (2) WORKFLOW |
| **M4+ — 구조/확장성 (게시 후 신호 확보 이후, 1인 capacity 초과 항목)** | North Star 기둥 양립(검증 큐레이션 ↔ 4-CLI 동등성)을 코드구조 차원에서 정합화하고, 카탈로그 확장점(category/kind/CLI/track)의 | (1) ExternalAsset 에 cliSupport 필드 + COMPATIBILITY/홍보문이 자산별 실제 도달 CLI 를 derive(거짓광고 차단) + install 산출보고에 'codex  |
| **M5 — 카탈로그 큐레이션 재검토 (Curation Audit)** | "스택 기반 최소 큐레이션"(과설치 회피·검증된 것만)이 관성으로 흐려졌는지 양방향 audit — 빠진 가치자산(Visual & Media 확장 리서치) + 남을 가치 없는 자산(48 전수 keep/drop). | (1) Visual & Media 용도별 추가후보표+Docker검증 등재 (2) 48 자산 keep/demote/drop 판정표(실측근거) (3) drop=Major CR→사용자+ADR |
| **M6 — 다면 페르소나 리뷰 커맨드 (`/uzys:panel`)** | 상황 맞춤 페르소나 동적생성 + 기존 리뷰어 에이전트(`.claude/agents/*.md`) 혼합 → 병렬 다면 리뷰. uzys-harness 6-Gate review 심화. PoC=본 세션 게시글 5-페르소나 리뷰. | (1) 4-CLI 커맨드(claude slash + 비-claude 등가) (2) 페르소나 동적생성+agent.md 자동혼합 (3) `(uzys-agent-harness)` brand + surface parity. SPEC 선행 |

**즉시 착수(immediateNext):** M1-A: 공급망 hijack 차단 — README.md:256 · README.ko.md:229 · docs/USAGE.md:143 의 bare `npx agent-harness` 를 `npx -y @uzysjung/agent-harness` 로 교체 (unscoped `agent-harness` = npm 의 제3자 quuu@0.0.1 실행). 동시에 `grep -rn 'npx \(-y \)\?agent-harness[^@]' README* docs/` 가드를 catalog-verify CI 에 추가. critical·effort S·게시 1순위 파일 2곳 포함이라 다른 무엇보다 먼저.

<details><summary>합성 논리(rationale)</summary>

설계 논리: (1) 사용자=메인테이너 1명, star 0 시점이라 "게시 전 신뢰 자해를 0으로 만든다"가 M1 의 유일 목표 — critical/high 중 '게시 즉시 첫 화면·첫 명령·보안 wedge 를 배신하는 것'만 M1 에 넣고, 코드 구조/확장성(SCALE-*)·백로그성은 게시 후로 미뤘다. (2) 중복 병합: 신규 발견 다수가 기존 persona P0 의 '코드 차원 근원'이라 한 항목으로 합쳤다 — UX-1+SUPPLY-1=공급망 1건(단 SUPPLY-1 의 WORKFLOWS.md:13 근거는 검증 결과 bare npx 아님→실 표면은 README×2+USAGE 3곳으로 정정), CODE-2+SEC-1+persona B-2=파괴적-쓰기 클러스터(B-2 는 문서화만·CODE-2/SEC-1 이 실 데이터손실 버그라 코드fix 가 선행), DEMO-1+DEMO-2+persona '데모재녹화'+PROMO-5/DEMO-4=데모 false-completion 1건, CODE-4+SCALE-2+persona D-1=npx skills unpinned(설치·uninstall·검증 3경로), CODE-9+PROMO-1+SEC-5+SUPPLY-3 은 persona C-1(star drift)의 증거라 C-1 로 흡수. (3) 모순 처리: SEC-1(settings.json overwrite)=critical 과 CODE-2(CLAUDE.md overwrite)=high 는 동일 '백업 없는 덮어쓰기' 결함의 두 표면 — 더 파괴적인 settings.json(사용자 hook 소실)을 P0 hotfix, CLAUDE.md 를 같은 사이클 동반 수정으로 묶되 README B-2 정책표와 동일 내용으로 동기화(no-false-ship 의 derive 원칙). (4) critical 5건 전수 게시-전 판정: 공급망(UX-1/SUPPLY-1)·데모 2건(DEMO-1/DEMO-2)·settings.json(SEC-1) 모두 '게시 0초~첫 설치'에 사용자 도달 → 전부 M1. high 중 META-3(install.sh 구repo명)·UX-2(NEXT 거짓안내)·META-2(SECURITY.md)·CODE-1(--with-ecc 광고)·UX-5(withUzysHarness)는 '게시 첫인상·복붙 가능 표면'이라 M1, 반면 SCALE-1(plugin 비-Claude 미도달)·SCALE-2·NSM-2 류 구조 high 는 30일 내 실행 불가→M3/M4. (5) 과잉확장 경계: 1인·0★ 이므로 콘텐츠 보안스캔(SEC-3/PROMO-8)·plugin→codex 등가설치(SCALE-1 구조변경)·5번째 CLI(SCALE-5) 같은 L 은 전부 M4+. M2 는 신규 코드작업 0 — 순수 게시 실행만 분리해 '게이트 통과=게시 가능'을 명확히 했다.
</details>

## M1 — 게시 전 게이트 (Pre-Publish Truth Gate)

**목표:** 게시 직후 사용자가 0초~첫 설치~첫 명령에서 만나는 모든 '광고≠실동작'을 제거한다. no-false-ship 위반(공급망 실행경로·구브랜드 박제·백업없는 덮어쓰기·거짓 안내·삭제된 플래그 광고)을 0으로. P0 게이트(persona A~D)와 신규 critical/high 코드fix 를 병합 완료.

**완료 판정:** (1) grep 으로 다음 4종이 추적파일(dist/templates 제외)에서 0건: bare `npx agent-harness`(scope 없는 것), `uzys-claude-harness`, 데모 .cast title/banner 의 `claude-harness`, README 임베드 GIF 의 구브랜드. (2) SECURITY.md 존재 + GitHub Security 탭 노출. (3) settings.json·CLAUDE.md 가 기존 프로젝트에서 백업 후에만 변경됨을 검증하는 RED→GREEN 테스트 통과. (4) `node dist/index.js install --help` 출력이 실동작과 일치(--with-codex-prompts·--scope). (5) `npm run ci` exit 0 + 신규 hotfix 태그(v26.84.x 류, CalVer 준수) npm publish green. (6) persona-feedback-improvements.md 의 P0 A/B/C/D 전 항목 체크 + 본 M1 신규항목 SSOT 반영.

| P | E | 항목 | 출처 |
|---|---|------|------|
| P0 | S | 공급망 hijack 차단: bare `npx agent-harness`(=제3자 quuu@0.0.1) → `npx -y @uzysjung/agent-harness` (README.md:256·README.ko.md:229·USAGE.md:143) + CI grep 가드 | UX-1 + SUPPLY-1 (병합·중복; SUPPLY-1 의 WORKFLOWS.md:13 근거는 검증결과 bare npx 아님 — 실 표면 3곳으로 정정) |
| P0 | M | 데모 false-completion 차단: agent-harness-demo.cast 를 신명 바이너리로 asciinema 재녹화→agg 로 GIF 재생성 (재녹화 전까지 README.md:11·README.ko.md:11 GIF 를 신명 정적 스크린샷/텍스트블록으로 임시 대체) | DEMO-1 + DEMO-2 + persona 게시계획 step1 (+ PROMO-5/DEMO-4 known 흡수) |
| P0 | M | 'add' 모드가 기존 .claude/settings.json 을 백업 없이 덮어써 사용자 hook/statusLine 소실 — backup 포함 또는 settings-merge 전략으로 전환 (hotfix) | SEC-1 (critical; persona B-2 의 코드 근원) |
| P0 | M | 기존 root CLAUDE.md 를 백업·경고 없이 무조건 덮어쓰기 — writeRootClaudeMd 직전 CLAUDE.md.backup-<ts> 보존 + 렌더에 backup 행 노출, B-2 README 정책표와 동기화 | CODE-2 (high; SEC-1 과 동일 '백업없는 덮어쓰기' 클러스터) |
| P0 | M | README 수술 (B-1/B-2/B-3/B-4/B-5): 첫 줄 차별점 한 문장, 기존 .claude/ merge·충돌·백업 정책표, 설치 후 생기는 파일 트리, 60초 퀵스타트+첫 동작 명령, 검증 영수증(CI 배지)+'vetted≠보안감사' 자수 | persona B-1~B-5 (민준+소피+알렉스 수렴) |
| P0 | M | 홍보글 전면 재작성 (A-1~A-5): Snyk 36% 훅 제목, 1인칭 동기, pinning 한계를 신뢰무기로, 과장 2곳 정정('every install method Docker-verified'→40/43 / 'across 4 CLIs'→Claude first-class·나머지 skills+rules), r/ClaudeCode 본문에 8종 비교표 직접 | persona A-1~A-5 (알렉스 처방, 게시 차단 사유) |
| P0 | S | WORKFLOWS.md star 수치 실측 재검증·정정+측정일 병기 (213k/199k 등) — CODE-9 코드주석 자기모순·PROMO-1 addy 21% 오차·SEC-5·SUPPLY-3 전부 동일 drift 의 증거 | persona C-1 (+ CODE-9·PROMO-1·SEC-5·SUPPLY-3 흡수) |
| P0 | S | 보안 wedge 문서모순 해소: NSM 'Asset Security Pass Rate(agentshield 자산스캔)' ↔ COMPATIBILITY 'agentshield 는 산출물만' — 주장 철회 또는 범위 명시 | persona C-2 (= SEC-4·PROMO-4·META-6 known 동일건) |
| P0 | S | SECURITY.md 신설 (보안 큐레이션이 차별화 wedge 인데 신고 채널 부재): 지원버전·신고채널(GitHub Security Advisory private)·SLA·자산취약점 vs 하네스코드 분리. CONTRIBUTING:191 을 링크로 교체 | META-2 (high) |
| P0 | S | rename 후속 drift: install.sh:9/12/31 + CONTRIBUTING.md:1/8/14/15 의 `uzys-claude-harness`→`uzys-agent-harness` 일괄 치환 (광고된 curl 설치경로·기여 진입점이 구 repo명) | META-3 (high) |
| P0 | S | 설치 완료 NEXT 안내가 무조건 `claude → /uzys:spec` — uzys-harness opt-in 미선택 대다수 기본설치·codex/opencode 단독설치에서 거짓 안내. spec 선택 분기 + 선택 CLI 바이너리명으로 교체 | UX-2 (high; persona B-4 와 별개 — CLI 산출물 거짓안내) |
| P0 | S | 삭제된 플래그 `--with-ecc` 광고(install-render.ts:521) → `--with ecc-plugin` 으로 교체 + 렌더 힌트 문자열을 EXTERNAL_ASSETS id 와 대조하는 render-hint-parity 테스트 (ADR-022 잔재, no-false-ship 재발) | CODE-1 (high) |
| P0 | S | `npx skills` CLI 버전 고정 — 설치(buildSkillArgs)·uninstall·verify-catalog.mjs 3개 호출처 전부 pin (1.5.5→1.5.7 파손 전례 기록하면서 unpinned) | persona D-1 + CODE-4 (3 호출처로 확장; SCALE-2 의 verify 경로 unpinned 포함) |
| P1 | S | WORKFLOWS.md:17 간판표의 삭제된 플래그명 `withUzysHarness`→`uzys-harness` (A-5 에서 r/ClaudeCode 본문에 직접 붙일 표) + USAGE.md:116 카테고리 나열에 Understanding 추가 | UX-5 (medium; A-5 와 함께 처리 필수라 M1) |
| P1 | S | `install --help` 정리: --with-codex-prompts 의 폐기된 'default ON when --cli codex' 서술 제거(ADR-020 BREAKING 반영), --scope 에서 내부코드(ADR-020/D16) 삭제 | UX-4 (medium; 첫 사용자가 보는 --help 표면) |
| P1 | S | todo.md 현행화 (v26.74.0→v26.83.0, @uzysjung/claude-harness→agent-harness) + persona P0 를 게시게이트로 등재, SSOT=persona-feedback-improvements.md 링크 (9버전 stale·게이트 이중화 해소) | NSM-5 (medium) |

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

| P | E | 항목 | 출처 |
|---|---|------|------|
| P1 | M | skill/plugin 설치 시 resolved commit-SHA 를 .harness-install.json 에 기록 (재현성·포렌식 — 라케시 도입조건 1) | persona E-1 |
| P1 | M | verify-catalog cadence 상향: 월1회 cron→PR 또는 주간 + 검증에 쓰는 claude/skills CLI 버전 pin('검증도구 자체 drift' 제거) + plugin 명령표면 smoke 1건을 install-matrix 에 | SCALE-2 (high; upstream 파손 최대 30일 미감지) |
| P1 | M | uninstall 누락 reverse: install-log.templates 에 agentsDir(.agents/uzys-*)·AGENTS.md(sha256 보존)·opencode.json 추가, removeTemplates 에서 cli별 reverse (antigravity 는 현재 reverse 0) | CODE-3 (medium; 4-CLI 동등성 uninstall 미충족) |
| P1 | M | WORKFLOWS/COMPATIBILITY 영어판 (영어 README→한국어 문서 동선 단절 — 민준+소피) + README.ko 를 영문판 기준 동기화(Workflow 8행·Non-interactive 섹션·링크) + 자산 id 집합 일치 CI 가드 | persona E-2 + UX-7(known) + UX-10 (medium README.ko drift) |
| P2 | S | USAGE 내부코드 정리(E-3): ADR번호/D25/HITO/NSM → docs/decisions 링크 격리, 약어 첫등장 풀네임 + 한국어 혼입 문자열 4곳 영어화(uninstall.ts:87·codex/skills.ts:20·install-render.ts:231·external-installer formatSkippedReport) + 한글 유니코드 lint 테스트 1개 | persona E-3 + UX-6 (medium 한국어 혼입) |
| P2 | S | wizard Step 3 상단 '추천 그대로 Enter 안전' 안내 + WORKFLOWS 첫 줄 기본 추천 1개 (소피 first-win) | persona E-4 |
| P1 | S | CalVer 자동 가드: publish.yml 첫 step 에 태그 정규식(Major=year-2000) 검증 + 순수모듈로 빼 vitest RED/GREEN. 오타 태그 1개로 영구 오염(npm immutable) 방지 | META-1 (high; 게시 후 다음 ship 전까지 도입이면 충분) |
| P2 | S | 비대화형 경로 fail-loud: --strict opt-in(skipped>0→exit 3) 또는 비대화형 기본 non-zero, USAGE 에 exit code 표 (CI/스크립트 소비자가 자산 skip 을 exit0 으로만 봄, uninstall 과 비대칭) | CODE-10 (medium) |
| P2 | S | update 모드 confirm 이 설치 안 될 'Assets: N selected' 표시 — formatSummary 에 includeAssets:false 옵션 추가 (confirm 단계 Promise=Implementation) | CODE-6 (medium) |
| P2 | M | 데모 재녹화/GIF 변환 자동화 scripts/record-demo.sh + 'README 임베드 GIF 의 .cast brand == 현 패키지명' pre-publish 가드 (drift 재발 구조 차단) | DEMO-5 (medium) |
| P1 | M | **install `--dry-run` / 변경 diff 미리보기**: 설치 전 '무엇을 쓸지'(선택 자산 + settings.json·CLAUDE.md diff) 출력 후 확인 진행. uninstall `--dry-run` 과 대칭 — '쓰기 전 보여줘'로 신뢰 확보. | 페르소나 재리뷰 2026-06-13 (Priya·Sam) |

## M4+ — 구조/확장성 (게시 후 신호 확보 이후, 1인 capacity 초과 항목)

**목표:** North Star 기둥 양립(검증 큐레이션 ↔ 4-CLI 동등성)을 코드구조 차원에서 정합화하고, 카탈로그 확장점(category/kind/CLI/track)의 '분산 하드코딩→derive/컴파일강제'를 수렴. 보안 wedge 의 절반(콘텐츠 스캔 미실행)을 메우거나 톤다운 유지. 전부 L 또는 30일 capacity 초과라 신호 확보 후 착수.

**완료 판정:** (1) ExternalAsset 에 cliSupport 필드 + COMPATIBILITY/홍보문이 자산별 실제 도달 CLI 를 derive(거짓광고 차단) + install 산출보고에 'codex 선택 시 plugin 자산 N개 제외' 명시. (2) category/method.kind/CLI/track 신규 추가 비용이 'derive 1곳 또는 1 Record + 컴파일강제' 로 수렴(런타임 throw 의존 제거). (3) 콘텐츠 prompt-injection 스캔 최소 1회 실행 또는 'security' 주장 톤다운 명문화. (4) prompts.ts selectInstallTargets 동적로직(페이지 ESC 선택보존)이 coverage 포함 + 단위테스트.

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

**목표:** 카탈로그(현 48 자산)를 양방향 audit — (축A) 빠진 가치자산 없는지(Visual & Media 용도별 확장 리서치) + (축B) 남을 가치 없는 자산 없는지(48 전수 유지가치 재검토). "넣자"는 쉽고 "빼자"는 안 해 쌓이는 큐레이션 부패 방지.

**완료 판정:** (1) Visual & Media 용도별(슬라이드/다이어그램/모션/동영상/녹화) 추가 후보표 갱신 + Docker 실설치 통과분만 등재(no-false-ship). (2) 48 자산 각각 keep/demote/drop 판정표 + 실측근거(추정 금지). (3) drop 판정 = Major CR(사용자 도달경로 변경)→사용자 결정+ADR.

| P | E | 항목 | 출처 |
|---|---|------|------|
| P2 | M | **축A — Visual & Media 확장 리서치**: 모션(현 GSAP 1)·동영상(현 Remotion 1)이 vetted 1개씩 → 추가 후보 재탐색(neighborhood 변화·star 성장). 화면녹화 용도(현 0, 캡처라 제외) 코드-제작형 신규 등장 재검토. 슬라이드/다이어그램 1st-party 프레임워크(Slidev·reveal 본가) 등장 시 교체. Docker 통과분만 등재. | 사용자 2026-06-13 |
| P2 | L | **축B — 전체 카탈로그(48) 유지가치 재검토**: 자산별 keep/demote/drop. 판정축 ① star/활성 drift(trust-tier-drift 실측) ② 용도 중복(같은 일 2자산) ③ 1st-party 대체재 등장 ④ 사용 신호(있으면). experimental 잔류(railway 268·playwright 264·next-skills 895·ADR 179) 승격 or 제거. | 사용자 2026-06-13 |
| P3 | S | drop 후보 = Major CR(도달경로 변경)→사용자 결정+ADR. 제거 자산은 uninstall reverse·문서(COMPATIBILITY/WORKFLOWS) 동기화까지. | 사용자 2026-06-13 |

> "플랜에만"(사용자 2026-06-13): 정의만 추가, 착수는 순차(M2 게시 후). 정기성 = M3 신호 확보 뒤 1회 + 분기 권장. 차기 사이클에 Visual & Media 5종 자체도 재평가 대상.

---
## M6 — 다면 페르소나 리뷰 커맨드 (Multi-Perspective Review)

> 트리거: 사용자 지시 2026-06-13. PoC = 본 세션에서 게시 글을 상황 맞춤 페르소나 5명(Sonnet)으로 병렬 리뷰한 것이 유효 → uzys-harness 커맨드로 일반화. 6-Gate 의 review 심화 (단일 리뷰 → 다관점 패널).

**목표:** `/uzys:panel` (가칭) — uzys-harness **필수 커맨드**(6-Gate review gate 와 함께 기본 제공, opt-out 아님 — 사용자 지시 2026-06-13 "필수에 넣어줘"). 리뷰 대상(코드/PR/글/문서)을 받아 (a) 상황에 맞는 사용자 관점 페르소나 N명 **동적 생성** + (b) 이미 설치된 정적 리뷰어 에이전트(`.claude/agents/*.md` — 보안/성능/품질 등 고정 렌즈) **자동 혼합** → 병렬 다면 리뷰 → 종합 판정. 출력에 `(uzys-agent-harness)` brand. 4-CLI 대응(claude slash / codex·opencode·antigravity 는 skills·workflows, 6-Gate 패턴).

**완료 판정:** (1) claude `/uzys:panel` slash command(templates/) + 비-claude CLI 등가물. (2) 페르소나 동적 생성 = 대상 분석 → 관련 관점 자동 도출(사용자 추가/제외 가능). (3) `.claude/agents/*.md` 자동 탐지·혼합(없으면 페르소나만). (4) 카탈로그/문서 등록 + surface parity(wizard/--with/COMPATIBILITY). (5) 출력 헤더 `(uzys-agent-harness)` 표시. (6) SPEC 선행 + 테스트(페르소나 생성·혼합·종합 단위).

| P | E | 항목 | 출처 |
|---|---|------|------|
| **P1** | L | `/uzys:panel` 설계+구현 (**필수 커맨드** — opt-out 아님): 페르소나 동적생성 + agent.md 혼합 + 병렬 다면리뷰 + 종합. 4-CLI 대응. `(uzys-agent-harness)` brand. **SPEC 선행**. | 사용자 2026-06-13 (필수) |
| P3 | M | 페르소나 라이브러리(재사용 관점 템플릿: 회의적시니어/타겟유저/입문자/보안/비주류CLI 등) + 대상별 자동 선택 휴리스틱 | 사용자 2026-06-13 |
| P3 | S | OQ — `/uzys:review`(기존 review gate)와 관계: panel 을 review 의 모드로 통합 vs 독립 커맨드. 설계 시 결정 | 설계 OQ |

> **필수**(사용자 2026-06-13 "필수에 넣어줘") — uzys-harness 핵심 구성, opt-out 아님. 본 세션 페르소나 리뷰가 검증된 PoC. 구현 = SPEC 후 **우선**(immediateNext 후보). 미결: 커맨드명(/uzys:panel 잠정)·`/uzys:review` 통합 여부.

---
## 부록 A — 확정 발견 29건 (evidence·proposedFix)

### UX-1 · CRITICAL·S · 공식 문서의 `npx agent-harness` 명령이 제3자 npm 패키지를 실행함 (패키지명 스쿼팅)
- **dimension:** ux
- **evidence:** docs/USAGE.md:143 (`npx agent-harness install --track tooling --cli claude --cli codex --cli opencode`), README.md:256 · README.ko.md:229 (다이어그램 `npx agent-harness`). npm 레지스트리 실측: `agent-harness@0.0.1` 존재, maintainer = 'quuu <qual1337@gmail.com>' (2025-08 게시) — 본 프로젝트와 무관한 제3자
- **detail:** 실 패키지는 `@uzysjung/agent-harness`(scoped)인데 USAGE.md Multi-CLI 섹션의 복붙 가능한 코드블록이 unscoped `npx agent-harness`로 표기됨. 사용자가 그대로 복붙하면 npm 의 무관한 제3자 패키지 `agent-harness@0.0.1` 을 다운로드·실행한다. '보안 vetting 큐레이터'를 wedge 로 내세우는 제품의 공식 문서가 supply-chain 실행 경로를 안내하는 셈 — Snyk 36% 훅으로 홍보하려는 시점에 발견되면 신뢰 즉사. README/README.ko 의 'How it works' 다이어그램도 동일 표기(장식이지만 사용자가 따라 칠 수 있음).
- **proposedFix:** docs/USAGE.md:143 을 `npx -y @uzysjung/agent-harness install ...` 로 교체. README.md:256 / README.ko.md:229 다이어그램도 `npx @uzysjung/agent-harness` 로 정정. 게시 전 `grep -rn 'npx \(-y \)\?agent-harness[^@]' README* docs/` 를 CI(catalog-verify 또는 별도 docs lint)에 추가해 재발 차단. (선택) unscoped `agent-harness` 이름 확보 불가하므로 README 상단에 'scoped 패키지명만 공식' 명시.

### SEC-1 · CRITICAL·M · "add"(자산 추가) 모드가 기존 .claude/settings.json 을 backup 없이 무조건 덮어써 사용자 hook 설정 파괴
- **dimension:** security
- **evidence:** src/installer.ts:295 resolveBackupPath `wantBackup = ctx.backup ?? (mode === 'update' || mode === 'reinstall')` → add 모드는 false. src/interactive.ts:141-142 `if (action === 'add') { mode = 'add' }`. src/manifest.ts:331-337 settings.json applies:all. installClaudeBaseline(installer.ts:399) `copyFile(source, target)` → src/fs-ops.ts:15-21 copyFile 은 target 존재 여부 무관 copyFileSync(무조건 overwrite).
- **detail:** 기존 프로젝트에 자산만 추가하려는 사용자(헤비유저 시나리오: 손수 만든 .claude/settings.json 의 statusLine·PreToolUse hook 보유)가 wizard 에서 'add' 를 고르면, backup 이 생성되지 않은 채 하네스 템플릿 settings.json 이 기존 파일을 통째로 덮어쓴다. mcp-merge.ts·project-claude-merge.ts·settings-merge.ts(addPreToolUseHook) 는 모두 기존 보존 머지를 구현해 두었는데 정작 settings.json baseline copy 만 머지 없이 overwrite 라 일관성이 깨진다. 이는 persona 평가 B-2('기존 .claude/ merge/충돌/백업 정책 부재')의 근본 코드 원인이자, README 문서화(B-2)만으로는 안 막히는 실제 데이터 손실 버그다. North Star 'Project-Scope 오염 금지'/'First-Run Success'와도 정면 충돌.
- **proposedFix:** src/installer.ts resolveBackupPath 에 add 모드도 기존 .claude/ 존재 시 backup 포함(또는 settings.json 만 존재 시 별도 백업). 더 근본적으로는 settings.json 도 settings-merge.ts 의 머지 전략(기존 hooks/statusLine 보존 + 템플릿 entry idempotent 추가)으로 전환. 최소 hotfix: installClaudeBaseline 에서 settings.json target 이 이미 존재하면 copyFile 대신 머지 또는 skip+경고. tests/ 에 'add 모드 + 기존 settings.json → 사용자 키 보존' RED 테스트 추가.

### DEMO-1 · CRITICAL·M · 데모 .cast 가 파일명만 rename 되고 콘텐츠는 미재녹화 — 구 브랜드 박제 (false-completion)
- **dimension:** extra:데모 GIF 콘텐츠가 구 브랜드(uzys-claude-harness)를 그대로 노출 — rename PR(#164)이 파일명만 바꾸고 .cast 콘텐츠는 재녹화 안 함 → '완료처럼 보이는 미완(false-completion)'. README 첫 시각 자산이 HN 게시 즉시 구명 광고
- **evidence:** docs/assets/agent-harness-demo.cast:1 title="claude-harness — one-command install..." + :10 banner "━━━ uzys-claude-harness · install ━━━". git show d0b9784 --find-renames: 'R100 docs/assets/claude-harness-demo.cast → agent-harness-demo.cast', '2 files changed, 0 insertions(+), 0 deletions(-)' (cast+gif 둘 다 순수 rename, 콘텐츠 diff 본문 공란).
- **detail:** v26.83.0 rename PR(#164, 커밋 d0b9784)이 데모 자산을 claude-harness-demo→agent-harness-demo 로 git mv(R100, 0 insert/0 delete)만 수행하고 asciinema 재녹화는 하지 않았다. 결과 .cast 의 title 필드(라인1)와 install banner(라인10)에 구 브랜드 'claude-harness'·'uzys-claude-harness' 가 grep 상 각 1회씩 잔존한다. 커밋 메시지 'fix: 데모 자산 파일명 rename' 도 파일명 교체만 명시하고 콘텐츠 재녹화를 언급 안 함 — '파일명=신명, 콘텐츠=구명' 의 완료 착시. persona-feedback-improvements.md 게시계획 step1('데모 재녹화')이 미완인데 이 rename 으로 '됐다'고 오인할 구조다. no-false-ship.md '광고=실동작' 원칙의 시각 자산 버전 위반.
- **proposedFix:** docs/assets/agent-harness-demo.cast 를 v26.83.0 신명 바이너리(`npx -y @uzysjung/agent-harness`)로 asciinema 재녹화 → agg 로 agent-harness-demo.gif 재생성. 재녹화 전까지는 DEMO-2 의 임시 대체를 적용. 재발 방지: scripts/ 에 재녹화 + agg 변환 스크립트를 추가하고 README brand grep 을 CI/hook 에서 .cast title·banner 까지 검사(현 docker-only hook 은 바이너리 콘텐츠 미검사).

### DEMO-2 · CRITICAL·S · README.md:11 + README.ko.md:11 이 구명 박제 GIF 를 H1 직하 첫 시각 자산으로 embed — HN/Reddit 0초 화면이 구 브랜드 광고
- **dimension:** extra:데모 GIF 콘텐츠가 구 브랜드(uzys-claude-harness)를 그대로 노출 — rename PR(#164)이 파일명만 바꾸고 .cast 콘텐츠는 재녹화 안 함 → '완료처럼 보이는 미완(false-completion)'. README 첫 시각 자산이 HN 게시 즉시 구명 광고
- **evidence:** README.md:11 `![agent-harness demo ...](.../agent-harness-demo.gif)` — H1(라인1) 과 badge(7-9) 직후 첫 이미지. README.ko.md:11 동일 GIF embed. GIF 는 DEMO-1 의 stale .cast 에서 생성(같은 PR R100 rename, 콘텐츠 동일).
- **detail:** 게시계획(persona-feedback-improvements.md:58) 은 '반자동 게시(폼 제출만 사용자)' 로 Show HN + r/ClaudeCode 진입을 정의한다. 그 랜딩 페이지인 README 의 H1 직하 첫 시각 자산이 구 브랜드(claude-harness)를 박제한 GIF 다. 방문자가 보는 0초 화면이 rename 이전 브랜드 = no-false-ship 위반의 직접 사용자 도달. EN/KO 양쪽(README.md:11, README.ko.md:11) 모두 동일 GIF 라 한국어 동선도 동일 노출. 코드는 안 깨지나 '신명으로 리포지셔닝했다'는 핵심 메시지를 첫 화면이 즉시 배신.
- **proposedFix:** 게시 전 즉시(DEMO-1 재녹화 완료 전이라면): README.md:11 + README.ko.md:11 의 GIF embed 를 (a) 신명으로 캡처한 정적 스크린샷, 또는 (b) 텍스트 코드블록 데모(banner 를 신명으로 수기 작성)로 임시 대체. 재녹화 완료 시 동일 경로 GIF 로 환원. 검증: 교체 후 README 2개 파일에 grep 'claude-harness' 0건 + GIF 콘텐츠 grep 0건.

### SUPPLY-1 · CRITICAL·S · 공급망 hijack: 5곳의 bare `npx agent-harness` 가 제3자 패키지(quuu v0.0.1) 실행 — 그중 2곳이 게시 1순위 README
- **dimension:** extra:공급망 위험 명령 `npx agent-harness`(scope 없음 → 제3자 패키지 quuu/0.0.1 실행)가 USAGE.md 1곳이 아니라 README.md·README.ko.md·USAGE.md·WORKFLOWS.md 5곳에 산재 — 그중 2곳이 게시 1순위 파일(README)
- **evidence:** README.md:256, README.ko.md:229 ('│  npx agent-harness'), docs/USAGE.md:109('agent-harness install --help'), docs/USAGE.md:143('npx agent-harness install --track tooling ...'), docs/WORKFLOWS.md:13('agent-harness install --track <t> --with <id>'). `npm view agent-harness` => name='agent-harness' version='0.0.1' maintainers='quuu <qual1337@gmail.com>'. package.json:2 name='@uzysjung/agent-harness'.
- **detail:** unscoped 'agent-harness' 는 npm 에 실재하는 제3자(quuu) 소유 패키지(v0.0.1)다. 신규 사용자가 README/USAGE 의 'npx agent-harness' 를 그대로 따라 하면 본 하네스가 아니라 quuu 의 임의 코드를 실행한다 = supply-chain 실행. 가장 치명적인 점: README.md:256·README.ko.md:229 은 HN/r/ClaudeCode 게시 시 방문자가 가장 먼저 보는 'How it works' ASCII 다이어그램이라, ux 감사가 든 USAGE.md:143 보다 노출도가 압도적으로 높다. 같은 README 안에서 상단 Install(README.md:20 `npx -y @uzysjung/agent-harness`)은 scoped 정답인데 다이어그램만 bare — 동일 파일 내 모순이라 더 함정. '보안 vetting 큐레이터'가 자기 공식 문서 5곳에서 supply-chain 경로를 안내 = NORTH_STAR 차별화 축(ADR-021 보안 wedge) + no-false-ship 자기배신. dist/index.js:5400·src/cli.ts:63 의 cac('agent-harness') + package.json:13 bin 매핑상 '로컬 설치 후'엔 bare `agent-harness` alias 가 동작하지만, npx 신규 사용자에겐 제3자 실행이라는 뉘앙스를 문서가 구분하지 않는다.
- **proposedFix:** 게시·설치 안내 문맥의 모든 bare 'npx agent-harness' → 'npx -y @uzysjung/agent-harness' 로 통일: README.md:256, README.ko.md:229(ASCII 다이어그램 포함), docs/USAGE.md:143. 로컬 bin alias 설명(docs/USAGE.md:109 'agent-harness install --help', docs/WORKFLOWS.md:13)은 'after install (로컬 bin)' 라벨을 명시하거나 동일하게 scoped 로 통일. ux 의 USAGE.md:143 단일 보고를 5곳 class 로 승격해 일괄 수정. CI grep 가드(README/USAGE 에 scope 없는 'npx agent-harness' 매칭 시 fail) 추가 권장.

### CODE-1 · HIGH·S · 설치 출력이 삭제된 플래그 `--with-ecc` 를 광고 (ADR-022 잔재 — no-false-ship 패턴 재발)
- **dimension:** code
- **evidence:** src/commands/install-render.ts:521 — `log("Use --with-ecc to install ECC plugin instead")`. 반면 src/commands/install.ts:36-39 및 src/types.ts:66-70 은 v26.81.0(ADR-022, BREAKING)에서 자산 1:1 플래그 13종(withEcc 포함) 완전 삭제·`--with <id>` 로 일원화를 명시. registerInstallCommand 에 `--with-ecc` 미등록.
- **detail:** ECC 미선택 시 모든 claude baseline 설치(install-render.ts:516 게이트)에서 이 힌트가 렌더된다. 사용자가 안내대로 `--with-ecc` 를 입력해도 등록된 플래그가 아니므로 ECC plugin 은 설치되지 않는다(올바른 문법은 `--with ecc-plugin`). v26.76.0(미등록 플래그 광고)·v26.78.0(wizard 누락)과 동일한 '광고 ≠ 실동작' 유형이며, 렌더 문자열은 어떤 exhaustiveness 가드/테스트에도 걸리지 않는 사각지대다.
- **proposedFix:** src/commands/install-render.ts:521 의 문구를 `Use --with ecc-plugin to install ECC plugin instead` 로 교체. 추가로 렌더 출력에 등장하는 플래그/자산 id 힌트 문자열을 EXTERNAL_ASSETS id 또는 registerInstallCommand 등록 옵션 목록과 대조하는 소형 테스트(tests/install.test.ts 또는 신규 render-hint-parity 테스트)를 넣어 동종 drift 차단.

### CODE-2 · HIGH·M · 기존 프로젝트 root CLAUDE.md 를 백업 없이 무조건 덮어쓰기 (데이터 손실 경로)
- **dimension:** code
- **evidence:** src/installer.ts:418-419 주석 "overwrites any user customization on re-install. Documented behavior" + src/installer.ts:691-700 `writeRootClaudeMd` 가 무조건 `writeFileSync(join(projectDir, "CLAUDE.md"), content)`. 백업은 resolveBackupPath(installer.ts:290-298)가 `.claude/` 디렉토리만 대상. src/state.ts:36 상태 감지도 `.claude/` 존재만 확인 — 사용자 자작 CLAUDE.md 만 있는 프로젝트는 'fresh' 로 판정.
- **detail:** 자기 CLAUDE.md 를 가진 기존 프로젝트(.claude/ 없음)에 설치하면 경고·백업 없이 즉시 덮어써진다. add 모드(backup 없음)·reinstall 모드(backup 은 .claude/ 만 rename)에서도 동일. uninstall 은 sha256 으로 사용자 수정본을 보존(uninstall.ts:283-289)하는데 install 은 보호 장치가 0 — 비대칭. 페르소나 평가의 민준 1순위 차단 요인(B-2)의 코드 차원 근원이며, B-2 는 README 문서화만 다루고 이 파괴적 동작 자체의 수정은 미계획.
- **proposedFix:** src/installer.ts `writeRootClaudeMd` 직전에 기존 CLAUDE.md 존재 + 내용 상이 시 `CLAUDE.md.backup-<timestamp>` 로 보존(또는 .claude/ backup 디렉토리에 동봉)하고 BaselineReport/렌더에 backup 행 노출. B-2 README 정책 표와 동일 내용으로 동기화. 테스트: '기존 사용자 CLAUDE.md 가 있으면 백업 파일이 생성된다' 의도 검증 추가.

### UX-2 · HIGH·S · 설치 완료 Summary 의 NEXT 안내가 무조건 `claude → /uzys:spec` — 기본 설치에선 존재하지 않는 명령
- **dimension:** ux
- **evidence:** src/commands/install-render.ts:346 `log(infoRow("NEXT", `${c.bold("claude")}  →  ${c.cyan("/uzys:spec")}`))` — 조건 없음. uzys-harness 자산은 opt-in (src/external-assets.ts:230 `condition: { kind: "opt-in" }`), docs/USAGE.md:316-318 자체 트러블슈팅이 'Empty /uzys:* — opt-in 안 함' 을 인정
- **detail:** 6-Gate 워크플로는 default OFF(README.md:193)인데 renderFinalSummary 는 모든 설치에서 NEXT 로 `/uzys:spec` 을 안내한다. 첫 사용자의 '첫 가치 체감' 순간에 (1) opt-in 안 한 대다수 기본 설치에서 첫 명령이 동작하지 않고, (2) `--cli codex`/`opencode` 단독 설치에서도 `claude` 바이너리를 안내한다. 소피 페르소나의 '30초 내 첫 승리 없으면 uninstall' 시나리오가 CLI 출력 자체에서 깨진다. persona 문서 B-4 는 README 퀵스타트 이슈이고, 본 건은 CLI 산출물의 거짓 안내라 별개(no-false-ship 관점에서 광고≠실동작).
- **proposedFix:** src/commands/install-render.ts renderFinalSummary 에 spec 분기 추가: uzys-harness 선택 시(`isAssetSelected("uzys-harness", spec)`) 현행 안내, 미선택 시 해당 CLI 의 항상-동작 첫 명령(예: `claude` 실행 + '설치된 rules/skills 자동 로드 확인' 또는 `/help`) 안내. spec.cli 에 claude 미포함이면 선택 CLI 기준 바이너리명으로 교체. 테스트: renderFinalSummary 분기별 snapshot.

### SCALE-1 · HIGH·L · 4-CLI 비대칭이 데이터가 아닌 분기된 코드 경로 — plugin 자산(큐레이션 대부분)은 codex/opencode/antigravity 에 영영 미도달
- **dimension:** extensibility
- **evidence:** src/installer.ts:246-509 — claude 만 installClaudeBaseline + runExternalPhase(43 자산); codex/opencode/antigravity 는 runCliTransforms 가 templates/CLAUDE.md+commands/uzys 만 변환. src/codex/transform.ts:60-147, src/opencode/transform.ts:41-97, src/antigravity/transform.ts:56-101 어디에도 EXTERNAL_ASSETS import 없음. skill-kind 만 external-installer.ts:238-244 SKILLS_CLI_AGENT_MAP 로 codex/antigravity 에 도달, plugin-kind 는 installPlugin(claude 전용). docs/COMPATIBILITY.md:134 가 'plugin → Claude Code primary' 로 자인.
- **detail:** North Star 기둥②(검증 자산 큐레이션)와 기둥③(4-CLI 동등성)이 코드 구조상 양립하지 못한다. 43개 자산 중 plugin-kind(약 절반 — superpowers/ECC/anthropic-*/supabase/alirezarezvani 계열 전부)는 `claude plugin install` 로만 설치되어 비-Claude 3개 CLI 사용자는 큐레이션의 핵심을 전혀 받지 못한다. 이 비대칭이 데이터(자산별 'CLI 지원' 필드)가 아니라 installer 의 하드 분기로 표현돼 있어서, 비-Claude 깊이를 키우려면(예: codex 용 plugin 등가물 매핑) 새 transform 코드 + 새 method 분기를 추가해야 한다. 자산이 늘수록 'Claude 만 진짜, 나머지는 6-gate 껍데기' 격차가 선형으로 벌어진다.
- **proposedFix:** 단기: ExternalAsset 에 `cliSupport: CliBase[]` 또는 method 별 도달 CLI 를 명시 필드화하고, COMPATIBILITY 표/홍보문이 자산별 실제 도달 CLI 를 그 필드에서 derive(거짓광고 차단). 중기: 비-Claude 가 받는 것/못 받는 것을 install 산출 보고(install-render.ts renderCliArtifacts)에 명시해 사용자가 'codex 선택 시 plugin 자산 N개 제외됨'을 install 시점에 인지하게 한다. 구조 변경(plugin→codex 등가 설치)은 별도 L 사이클.

### SCALE-2 · HIGH·M · upstream 파손 감지기(verify-catalog)가 월 1회 cron + 태그에서만 + claude/npx skills unpinned — plugin 명령체계 변경 최대 1개월 미감지
- **dimension:** extensibility
- **evidence:** .github/workflows/catalog-verify.yml — `schedule: cron '0 7 1 * *'`(매월 1일) + workflow_dispatch 만. push/PR 트리거 없음. scripts/verify-catalog.mjs:45-48 은 bare `claude plugin install`(설치된 claude 버전 무엇이든) 호출, :51-53 은 `npx ... skills add`(버전 미고정). test.yml/install-matrix.yml 도 `tags: v*` 전용(test-policy.md 확인: PR 마다 안 돔).
- **detail:** Promise=Implementation(NSM 100%)을 지키는 유일한 자동 수단이 verify-catalog 인데, (a) 월 1회만 돌아 claude CLI 가 `plugin install` 문법/marketplace 명령을 바꾸면 다음 cron(최대 30일)까지 모름, (b) 검증에 쓰는 claude·skills CLI 자체가 unpinned 라 'CLI 가 바뀌어서 깨진 것'과 '자산이 바뀌어서 깨진 것'을 구분 못 함. P0 D-1(buildSkillArgs npx skills unpinned)은 설치 경로만 지적하나, 검증 경로(verify-catalog.mjs)의 동일 unpinned 도 같은 취약성이다. 자산 43개로 늘어난 지금 upstream 한 곳만 깨져도 거짓광고가 되는데 감지 지연이 크다.
- **proposedFix:** verify-catalog.yml 에 PR 트리거(또는 주간 cron)로 cadence 상향. verify-catalog.mjs 가 호출하는 claude/skills CLI 버전을 워크플로에서 핀(npm i -D @anthropic-ai/...@x 또는 skills@1.5.7)해 '검증 도구 자체 drift' 제거. 추가로 claude plugin 명령 표면(--scope/marketplace add 형식)을 검사하는 smoke 1건을 install-matrix 에 넣어 plugin 문법 회귀를 별도 신호로 분리.

### META-1 · HIGH·S · 태그→npm publish 경로에 CalVer(Major=year-2000) 자동 가드 0 — 오타 1개로 잘못된 버전 영구 게시
- **dimension:** meta
- **evidence:** .github/workflows/publish.yml:28 `npm pkg set version="${GITHUB_REF_NAME#v}"` → :39 `npm publish` (사이 검증 없음); .claude/rules/git-policy.md 'Pre-tag checklist'/'Drift Period' = 수동 절차만
- **detail:** publish.yml 은 푸시된 태그 문자열에서 v 만 떼어 그대로 package.json version 으로 박고 npm publish 한다. 정규식·연도 매핑·범위 검증이 전무하다. git-policy.md 가 명시하듯 2026-04-18~30 에 v27.0.0~v28.0.0 21건이 컨벤션을 위반해 누적된 전례(ADR-007)가 있는데도, 그 재발을 막을 자동 게이트는 코드화되지 않았다. npm 은 동일 버전 재게시를 금지하므로(immutable) 오타 태그(예 `v27.0.0`, `v2.6.83`)가 한 번 publish 되면 영구 오염이고 unpublish 24h 제약·복구 비용이 크다. no-false-ship.md 의 v26.82.0 사례(--version 거짓 보고)와 같은 '버전 SSOT 신뢰' 카테고리 리스크.
- **proposedFix:** publish.yml(및 install-matrix/ci) 의 첫 step 으로 태그 가드 추가: `[[ "${GITHUB_REF_NAME}" =~ ^v$(( $(date +%Y) - 2000 ))\.[0-9]+\.[0-9]+$ ]] || { echo '::error::CalVer 위반: Major 는 year-2000'; exit 1; }`. 동일 정규식을 scripts/ 의 순수 모듈로 빼 vitest 로 RED/GREEN 테스트(test-policy TDD). publish job 의 `needs:` 에 이 guard job 을 걸어 publish 전 차단.

### META-2 · HIGH·S · 보안 큐레이션이 차별화 wedge 인데 SECURITY.md(취약점 신고 채널) 부재
- **dimension:** meta
- **evidence:** `ls SECURITY.md` → No such file; CONTRIBUTING.md:191 'Report security issues privately to the maintainer (see GitHub profile)'; docs/NORTH_STAR.md:20 ADR-021 'security-vetted 큐레이션' 을 방어 wedge 로 격상
- **detail:** ADR-021 재포지셔닝의 핵심 주장은 'Snyk ToxicSkills 36% prompt injection 시대의 보안 감사 큐레이터'다. 그런데 정작 본 repo 는 GitHub 가 인식하는 SECURITY.md(보안 탭/신고 버튼 노출)가 없고, 신고 안내가 CONTRIBUTING 본문 깊숙이 'GitHub 프로필 참고'로만 존재한다. supply-chain 민감 페르소나(라케시)·외부 보안 리포터가 책임 있게 신고할 1급 채널이 없다 = 보안을 파는 제품의 신뢰 자해. 게시(HN/Reddit) 후 누군가 큐레이션 자산에서 injection 을 발견했을 때 공개 이슈로 터뜨릴 수밖에 없는 구조.
- **proposedFix:** repo 루트 또는 .github/ 에 SECURITY.md 신설: 지원 버전 표(현 v26.x), 신고 채널(전용 이메일 또는 GitHub Security Advisory private report 활성화), 응답 SLA, 큐레이션 자산 취약점 vs 하네스 코드 취약점 분리 안내. CONTRIBUTING:191 을 SECURITY.md 링크로 교체.

### META-3 · HIGH·S · install.sh 와 CONTRIBUTING.md 가 구 repo 명(uzys-claude-harness)을 가리킴 — rename 후속 drift
- **dimension:** meta
- **evidence:** install.sh:9,12,31 `github:uzysjung/uzys-claude-harness#...` / `exec npx -y "github:uzysjung/uzys-claude-harness#${REF}"`; CONTRIBUTING.md:1,8,14,15 'uzys-claude-harness' (title·clone URL·issues 링크)
- **detail:** v26.83.0 에서 패키지·bin·repo 를 agent-harness 로 rename 했고 README/CHANGELOG/package.json 은 신명으로 정합하나, **광고된 curl 설치 경로인 install.sh** 와 기여 진입점 CONTRIBUTING.md 는 구 repo 명 그대로다. GitHub 가 old→new repo 를 자동 리다이렉트하므로 당장 깨지진 않을 수 있으나(미검증 — README 의 npx 경로는 신명이라 install.sh 만 구명), 게시 직후 첫인상에서 '제품명/설치 명령 불일치'는 민준·소피 페르소나가 즉시 잡는 신뢰 흠집이고, 리다이렉트가 끊기면(repo 재이동 등) 설치가 침묵 실패한다. install.sh 는 package.json files 에 없어 npm tarball 엔 안 들어가지만 raw.githubusercontent 경로로 광고된다.
- **proposedFix:** install.sh:9/12/31 의 `uzys-claude-harness`→`uzys-agent-harness` 일괄 치환. CONTRIBUTING.md:1/8/14/15 동일. grep `uzys-claude-harness` 가 dist/templates 외 추적 파일에서 0 이 될 때까지 sweep(이미 dist/templates 는 clean 확인).

### CODE-3 · MEDIUM·M · uninstall 'log-based reverse' 가 .agents/ · AGENTS.md · opencode.json 을 영구 누락 (antigravity 는 reverse 0)
- **dimension:** code
- **evidence:** src/install-log.ts:126-131 — templates 에 claudeDir/.codex/.opencode/rootClaudeMd 만 기록. src/commands/uninstall.ts:265-280 `removeTemplates` 도 동일 3종만 rm. 반면 codex transform 은 AGENTS.md + `.agents/skills/uzys-*`(src/codex/transform.ts:14,103-108), antigravity 는 `.agents/{skills,workflows,rules}`(src/antigravity/transform.ts:70-123), opencode 는 `opencode.json`(src/opencode/transform.ts:58) 을 생성. README.md:239 는 'Project-scope assets: removed automatically … `.codex/` cleanup, etc.' 광고.
- **detail:** `--cli codex` 또는 `--cli antigravity` 설치 후 uninstall 하면 AGENTS.md, `.agents/` 전체, opencode.json 이 orphan 으로 남는다. 특히 antigravity 는 install log 에 디렉토리 필드 자체가 없어 산출물이 하나도 reverse 되지 않는다. 4-CLI 동등성(NORTH_STAR 기둥 ③)을 내건 제품에서 uninstall 의 Promise=Implementation 이 claude 경로만 충족된 상태. test/docker/scenarios/scenario-uninstall.sh 가 이 gap 을 잡지 못한 것으로 보임.
- **proposedFix:** src/install-log.ts `InstallLog.templates` 에 agentsDir(`.agents/` 의 uzys-* 파일 목록 또는 디렉토리)·agentsMd(AGENTS.md, sha256 보존 패턴 재사용)·opencodeJson 필드를 추가하고 buildInstallLog 에서 cli 별 기록, uninstall.ts removeTemplates 에서 reverse. uzys-* prefix 파일만 삭제해 사용자 자작 .agents 자산 보존. uninstall 테스트에 codex/antigravity 산출물 제거 케이스 추가.

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

### UX-4 · MEDIUM·S · `install --help` 의 `--with-codex-prompts` 설명이 폐기된 동작("default ON when --cli codex")을 광고
- **dimension:** ux
- **evidence:** src/commands/install.ts:392 help 텍스트 "v26.46.0+ default ON when --cli codex" vs 같은 파일 208-212 실제 동작 주석 "v26.64.0 (ADR-020, BREAKING) — cli=codex 자동 default ON 폐기" + docs/USAGE.md:206 "BREAKING: cli=codex no longer auto-enables global prompt copy"
- **detail:** --help 가 실동작과 정반대를 말한다: 사용자는 `--cli codex` 만 주면 slash prompts 가 깔린다고 믿지만 실제로는 명시 opt-in 필요. 부수 문제 2건: (1) cac 렌더링으로 `--no-codex-prompts ... (default: true)` 가 '비활성 옵션의 기본값이 true' 처럼 읽혀 혼란, (2) `--scope` 도움말의 "ADR-020 / NORTH_STAR D16" 은 외부 사용자에게 무의미한 내부 코드 (소피 E-3 의 --help 판). 첫 사용자가 가장 먼저 보는 표면 중 하나가 --help 라는 점에서 게시 전 정리 권장.
- **proposedFix:** src/commands/install.ts:390-397 help 문자열 수정: `--with-codex-prompts` → "[Codex] Copy /uzys-* slash prompts to ~/.codex/prompts/ (explicit opt-in; requires --cli codex)". `--no-codex-prompts` 설명에서 'default ON' 서술 제거. `--scope` 도움말에서 ADR/D16 코드 삭제 ("project (default) | global"만). 변경 후 `node dist/index.js install --help` 출력 육안 확인.

### UX-5 · MEDIUM·S · WORKFLOWS.md 간판 비교표의 uzys-harness id 가 삭제된 플래그명 `withUzysHarness` 로 표기
- **dimension:** ux
- **evidence:** docs/WORKFLOWS.md:17 `| **uzys-harness** | \`withUzysHarness\` | ...` — 같은 표의 다른 7행은 전부 실제 asset id (`superpowers`, `ecc-plugin` 등). 실제 id 는 `uzys-harness` (src/external-assets.ts:224). 부수: docs/USAGE.md:116 wizard step 3 카테고리 나열에 8번째 카테고리 Understanding 누락 (src/prompts.ts:133-140 INSTALL_TARGET_PAGES 에는 존재)
- **detail:** 이 표는 P0 A-5 에서 'r/ClaudeCode 글 본문에 직접 붙여넣을' 핵심 자산인데, 표의 안내대로 `--with withUzysHarness` 를 치면 '[WARN] Unknown asset id' 후 skip 된다 (install.ts:184-189). 표 상단 안내문(WORKFLOWS.md:13 `--with <id>`)과 자기모순. ADR-022 플래그 삭제 시 문서 grep 누락의 잔재로, star 수치(C-1, known)와 별개의 신규 오류.
- **proposedFix:** docs/WORKFLOWS.md:17 의 `withUzysHarness` → `uzys-harness` 로 교체. docs/USAGE.md:116 카테고리 나열에 Understanding 추가. 게시 전 A-5(표 본문 직접 게재) 수행 시 이 표가 원본이 되므로 P0 와 함께 처리.

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

### NSM-5 · MEDIUM·S · todo 9버전 stale persona P0 분기
- **dimension:** planning
- **evidence:** todo line 14 v26.74.0 대 package.json v26.83.0; persona line 6
- **detail:** todo 멈춰 rename 미반영 게시 게이트 SSOT 이중화
- **proposedFix:** todo 현행화 persona P0 등재 SSOT 링크

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
## 부록 B — 기각 8건 (적대 검증이 과장/중복 판정)

- **UX-3**: 설치 출력이 v26.81.0(ADR-022)에서 삭제된 `--with-ecc` 플래그를 안내 — 따라하면 silent no-op
  - [유지] 발견 UX-3 은 실재하며 evidence 가 코드와 정확히 일치한다. 반박 시도 결과 모두 finding 을 지지함:

1. **출력 문자열 실재 확인** — `src/commands/install-render.ts:521` 에 리터럴로 `log(`  ${c.dim("·")} ${c.dim("Use --with-ecc to install ECC 
  - [반박] 발견의 핵심 메커니즘 주장이 실제 코드 동작과 정면으로 불일치한다 — 실증으로 반증됨.

직접 확인한 사실:
1. install-render.ts:521 `Use --with-ecc to install ECC plugin instead` 문자열 존재 — 사실. 게이팅 조건 install-render.ts:516 `if (!withEcc && bas
- **NSM-1**: HITO NSM 단위 미측정
  - [반박] 발견 NSM-1 은 **이미 알려진·추적 중인·의도적으로 보류된 backlog 항목의 재포장**이므로 refuted=true (isKnown:false 주장이 거짓).

**사실관계 자체는 맞음** (반박 불가 부분): evidence 두 줄을 직접 Read 확인.
- `docs/evals/hito-baseline-2026-04-30.md:67` 
  - [반박] 발견 NSM-1 의 기술적 사실 자체는 정확하나, 핵심 메타데이터(`isKnown:false`)와 severity, proposedFix 의 신규성이 모두 실제 리포 상태와 불일치하여 "known 이슈의 단순 재포장"으로 판정함.

1) Evidence 사실 확인 (정확):
- `docs/evals/hito-baseline-2026-04-30.md
- **NSM-4**: 게시 후 피드백 경로 부재
  - [반박] 발견의 사실 일부는 맞으나 `isKnown:false`(미지) 주장과 severity·proposedFix 정합성에서 무너짐. 직접 확인:

1. evidence 사실관계 — 일부만 참:
   - `.github/ISSUE_TEMPLATE/` 부재: 참. `ls .github/` → workflows 만 존재, ISSUE_TEMPLATE 디렉토리 
- **DEMO-3**: 데모가 무플래그 기본 설치를 광고하나, opt-in 자산 uzys-harness 를 'OPTIONS (none added)' 상태로 ASSETS 에 표시 — Promise≠demo
  - [반박] 발견의 코드-레벨 사실은 대체로 맞으나, 핵심 결론("Promise≠demo, 재현 불가 데모, 무플래그 기본 광고 vs 실제 불일치", severity=high)은 성립하지 않아 반박한다.

[확인한 사실 — 발견과 일치]
- `src/external-assets.ts:224-232` uzys-harness `condition: { kind: "
  - [반박] 발견의 raw evidence(file:line)는 전부 사실로 확인되나, "high severity Promise≠Implementation / 재현 불가 데모" 프레이밍이 과장이라 refuted.

직접 확인한 사실:
1. docs/assets/agent-harness-demo.cast:10 `▸ OPTIONS (none added)`, :11
- **SUPPLY-2**: install.sh 가 구 repo 명 `uzys-claude-harness` 를 실행/광고 — GitHub redirect 의존 + freed-name hijack 벡터
  - [반박] 파일 사실관계는 정확하나 severity:high(공급망 위험) 분류가 과장 — 이 근거로 refuted=true.

【evidence 직접 확인 — 모두 사실】
- install.sh:9 (curl|bash 광고 URL 구명), :12 (CI 안내 구명), :31 `exec npx -y "github:uzysjung/uzys-claude-harn
  - [반박] 발견의 **사실 증거는 정확**하다(직접 Read 확인): install.sh:9·12·31 모두 구명 `uzys-claude-harness` 사용, install.sh:31 `exec npx -y "github:uzysjung/uzys-claude-harness#${REF}"`, CONTRIBUTING.md:1·8·14·15 구 URL, `gh 
- **UX-1**: 기본 tooling 설치에서 NEXT row 가 미설치 명령 /uzys:spec 를 첫 가치로 안내 (30초 first-win dead-end)
  - [반박] 발견의 핵심 코드 사실은 검증됨이나, **evidence 에 명백한 사실 오류가 1건 있고 + 근본 user-problem 이 이미 active P0 게시-블로커(B-4)로 추적 중**이라 high 과장 + known 재포장으로 판단해 refuted=true.

[검증된 사실 — 발견이 맞는 부분]
- `src/commands/install-ren
  - [반박] 발견의 핵심 evidence 가 코드와 불일치 → 반박. 직접 Read + tsx 실행 검증 결과:

**참인 부분 (좁은 사실)**: `install-render.ts:346` 의 `log(infoRow("NEXT", ... /uzys:spec ...))` 는 무조건 출력이 맞고, 기본 `--track tooling` 에서 uzys-harness
- **UX-2**: 데모 .cast 가 'OPTIONS (none added)' 와 'workflow: uzys-harness present' 를 동시 표기 — 비-기본 시나리오를 기본 tooling 처럼 연출해 NEXT dead-end 은폐
  - [유지] 반박 시도했으나 핵심 결함이 코드로 확정되어 반박 실패. evidence 의 모든 파일을 직접 Read 함.

【1. 데모 .cast 내용 일치 확인】 docs/assets/agent-harness-demo.cast 직접 확인: L10 `▸ OPTIONS (none added)` + `▸ TRACKS tooling`, L11 `▸ ASSETS 5 
  - [반박] 기술적 메커니즘은 코드와 일치(=사실)하나, 발견은 (a)이미 추적 중인 작업의 재포장 + (b)별도 발견(UX-1)의 파생 프레이밍 + (c)단일 cosmetic nit 의 묶음이며 "high" severity 가 과장됨. 직접 확인 결과:

검증된 사실(메커니즘 정확):
- formatOptions (src/commands/install-ren
- **CODE-1**: formatOptions 가 userOverride(--with/--without)를 OPTIONS 출력에서 누락 — Transparent Defaults 위반의 구조적 원인
  - [반박] 발견의 **기계적 사실**은 직접 확인됨(맞음): formatOptions(install-render.ts:541-553)는 `Object.keys(spec.options)`만 순회하고 userOverride 미참조. ASSETS row(install-render.ts:84)는 finalSelectedAssets(spec.tracks, spec.u

---
## 부록 C — 기존식별/저심각 35건 (참고)

| id | sev | known | 제목 |
|----|-----|-------|------|
| CODE-4 | high | True | `npx skills` CLI 버전 unpinned — install·uninstall·verify-catalog 3개 호출처 (D-1) |
| UX-8 | high | True | 기존 `.claude/`/CLAUDE.md 보유 프로젝트의 merge·충돌·백업 정책이 README 에 부재 (코드엔 라우터·백업 존재) |
| NSM-2 | high | True | 보안 vetting star 의존 |
| NSM-3 | high | True | WORKFLOWS star stale CI 미보호 |
| SEC-2 | high | True | plugin/skill 자산은 버전 pin 불가(upstream HEAD 직행) + npx skills CLI 자체도 unpinned |
| SEC-3 | high | True | "security-vetted" 포지셔닝이나 실제 콘텐츠(prompt-injection) 스캔 0건 — vetting=순수 star 휴리스틱 |
| PROMO-1 | high | True | WORKFLOWS.md 간판 비교표 star 수치가 체계적으로 stale — addy 47k→실측 56.9k(약 21% 오차), '월 star-drift 모니터링' 차별점을 자기 표가 배신 |
| PROMO-2 | high | True | 라이브 npm/repo description 이 알려진 과장 2곳을 한 문장에 합쳐 이미 공개 — 'Docker-verified ... across Claude Code, Codex, OpenCode & Antigravity' |
| PROMO-3 | high | True | C-2 submission kit 본문이 'every install method is verified by real install in Docker' / 'across all 4 CLIs' — COMPATIBILITY(40/43)와 직접 모순, 게시 즉시 반례 노출 |
| PROMO-4 | high | True | 공개 NORTH_STAR NSM 'Asset Security Pass Rate(agentshield 자산 스캔)' ↔ COMPATIBILITY 'agentshield 는 외부 repo 미스캔' 문서 모순 — 보안 wedge 자체의 신뢰성 훼손 |
| PROMO-5 | high | True | 데모 GIF/.cast 에 구명 'claude-harness'/'uzys-claude-harness' 박제 — 게시 시 첫 시각 자산이 rename 이전 브랜드 노출 |
| DEMO-4 | high | True | 게시계획 step1 '데모 재녹화' 미완 — 파일 rename 으로 충족 오인 위험 (기존 식별 항목) |
| SUPPLY-3 | high | True | star-drift CI 를 자랑하는 제품의 간판 WORKFLOWS 별점이 실측과 어긋남 — 페르소나 C-1 의 '인플레 의심'은 방향이 반대(실제는 더 높음) |
| CODE-9 | medium | True | Superpowers star 수치가 코드 주석 내에서도 자기모순 (213k vs 190k) — C-1 의 코드측 증거 |
| UX-7 | medium | True | 영어 README 가 한국어 문서(WORKFLOWS.md·COMPATIBILITY.md)로 링크 — 핵심 신뢰 자산이 영어 독자에게 차단 |
| NSM-6 | medium | True | Parity NSM mock 근거 갭 은폐 |
| SEC-4 | medium | True | NSM 'Asset Security Pass Rate(agentshield 자산 스캔)' ↔ COMPATIBILITY 'agentshield 는 산출물만' 문서 모순 |
| PROMO-6 | medium | True | README H1 직하 포지셔닝 문구가 내부 용어 'Track-based agent harness' — 차별점 미전달, 신규 방문자 0초 이탈 리스크 |
| PROMO-8 | medium | True | 포지셔닝 차별 주장의 방어 가능성: 'Docker 실설치 검증'은 방어 가능하나 '보안 감사(security-vetted)'는 현재 미실행 — 핵심 wedge가 절반만 입증됨 |
| PROMO-9 | medium | True | 0★ cold start 신뢰 전략 미흡 — '검증 인프라(CI/Docker)'를 신뢰 대체재로 전면화하는 처방은 있으나 README 배지/영수증 미반영 |
| META-5 | medium | True | WORKFLOWS.md star 수치 stale + ECC repo 301 이동 + drift CI 가 표시숫자 미검사 |
| META-6 | medium | True | NORTH_STAR NSM 'Asset Security Pass Rate(agentshield 자산 스캔) 100%' ↔ COMPATIBILITY 'agentshield 는 산출물만' 문서 모순 (라케시 지적, 미해소) |
| UX-3 | medium | True | 데모 .cast 가 구 브랜딩(uzys-claude-harness / claude-harness) 노출 — rename(v26.83.0) 미반영 |
| CODE-7 | low | False | detectVersion plugin 분기의 사전식 sort — 두 자릿수 major 캐시 시 잘못된 버전 보고 |
| CODE-8 | low | False | external-assets.ts 868줄 — 800줄 cap 초과, 예외 주석의 수치(802줄)와 분리 약속이 stale |
| UX-9 | low | False | 잘못된 `--track` 값 에러가 유효 트랙 목록을 제시하지 않음 (--cli/--with 와 비일관) |
| SCALE-7 | low | False | external-assets.ts 869줄(800 cap 초과) — 데이터/로직 미분리, 자산 증가 시 단일 파일 부담 선형 증가 |
| SCALE-8 | low | False | 테스트 설명 거짓: 'contains 41 distinct asset ids' 인데 실제 43 — star-drift 자랑 제품의 자기 카운트 stale (C-1 과 동류) |
| NSM-7 | low | False | 30일 마일스톤 미명문화 |
| SEC-5 | low | True | WORKFLOWS.md 간판 star 수치(213k/199k)가 live API(226k/214k) 대비 stale — 단 fabrication 은 아님 |
| SEC-6 | low | False | docker-only-realcli.sh 가드: 설계된 비-goal 범위 내, 빈틈 없음 (확인 결과 — 방어적 보고) |
| SEC-7 | low | False | 검증 clean: secrets 0 / npm pack 화이트리스트 정상 / shell-injection 차단 — 긍정 확인 |
| PROMO-10 | low | False | 채널 전략: HN/Reddit/awesome-list 3채널만 — dev.to/X 등 저비용 채널 부재, 단발성 게시라 traction 소멸 리스크 |
| META-7 | low | False | CHANGELOG 헤더가 'Semantic Versioning 따름' 명시 — 프로젝트 강제 CalVer 컨벤션과 정면 모순 |
| META-8 | low | False | 릴리스 게이트가 전부 태그-only — PR/머지 시점 회귀 무방비, 단일 메인테이너 누락 리스크 |

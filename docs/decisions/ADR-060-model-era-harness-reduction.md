# ADR-060: 모델 발전 전제의 하네스 감량 — 스킬 외부화 · 카탈로그 정리 · @import 앵커

- Status: Proposed
- Date: 2026-08-02
- PR: #TBD
- Context: 사용자 지시 5항목(2026-08-02) + 이슈 #261(룰)·#262(스킬). 근거 문서 3편을 실측
  인용해 판단했다. ⓐ Opus 5 프롬프팅 가이드 — "explicit verification instructions … cause
  over-verification", "Avoid instructing re-checks it already performs", legacy harness
  scaffolding 제거 지시. ⓑ claude.ai CLAUDE.md 가이드 — "under roughly 200 lines",
  "Aspirational rules the team does not actually follow" 제외. 이 리포 실측(2026-08-02):
  룰 3개를 지워도 CI 87파일/1,211테스트 초록 = 룰을 무는 게이트 0 = aspirational.
  ⓒ Claude Code memory 문서 — 프로젝트 스코프 `@path` import 공식 지원(상대경로·4홉·
  코드펜스 무시), 단 "imported files still load … at launch"(상주 절감 아님, 소유 분리용).
- Decision:
  1. **uzys 자작 스킬의 SSOT 를 `uzysjung/uzys-agent-skills` 리포로 외부화**하고 이 리포는
     `npx skills add` 카탈로그 엔트리로 대체한다. 이관 리포가 이슈 #262 의 통합을 이미 반영
     (asis-tobe-decision+explain-plainly→clear-korean-communication · north-star 2종→north-star ·
     consult 2종→external-model-consult · gap-analysis-e2e→audit-service-gaps). 번들 삭제 14
     디렉터리 = 이관 12 + 폐기 2(harness-health-audit·ultracode-service-audit — 이관 리포에
     의도적 부재, 사용자 확정 2026-08-02). ui-visual-review 는 유지(룰 2개의 절차 SSOT, 사용자 확정).
  2. **verification-loop 의 ECC C3 체리픽 계약 해체** — 이 스킬은 uzys 원작이 아니라
     everything-claude-code 파생(modified)이었다. lock 행·MODIFIED_DEV_SKILL_DIRS·관련 테스트를
     함께 정리한다. ECC 파생물 재호스팅의 라이선스 귀속(MIT 표기)은 이관 리포 소관.
  3. **카탈로그 12종 제거**(사용자 열거): impeccable · polars-K-Dense · dask-K-Dense ·
     python-resource-management · python-performance-optimization · c-level-skills ·
     business-growth-skills · pm-skills · marketing-skills(alirezarezvani) · research-summarizer ·
     playwright-skill · karpathy-coder. 동명이물 marketingskills(coreyhaines31)는 유지.
     **frontend 3종 신설**: jakubkrehel/skills(★2.6k) · Leonxlnx/taste-skill(★70k) ·
     oso95/scroll-world(★6.9k) — 전부 vetted(≥1k). gsap-skills 는 기존 엔트리 유지.
  4. **룰 21→9 · 훅 6→4 (배포판)**: 기술스택 상세 룰 9종(htmx·nextjs·pyside6·shadcn·tauri·
     data-analysis·database·api-contract·design-workflow)과 사용자가 개발판에서 지운 3종
     (code-style·error-handling·no-false-ship)의 미러를 삭제. 훅은 karpathy-gate(Write/Edit 마다
     복잡도 검사 = Opus 5 가 지목한 검증 스캐폴딩 정확 해당)와 spec-drift-check(미배선 + 무동작
     실측)를 삭제. `spec-drift-backlog-exemption` 테스트 게이트는 유지 — 무는 것은 훅이 아니라
     테스트였다.
  5. **claude 설치 산출물을 @import 구조로**: 하네스 내용은 루트 `CLAUDE-uzys-harness.md`
     (하네스 소유·update 시 통째 갱신), 사용자 루트 CLAUDE.md 에는 관리 마커의
     `@CLAUDE-uzys-harness.md` 1줄만 idempotent 추가 — **덮어쓰기 계약 폐지**. 소유 분리는
     claude 한정이다: codex/opencode/antigravity 는 @import 대응물이 없고 이미 하네스 소유
     파일(AGENTS.md·.agents/rules)에 렌더되므로 현행 유지. `templates/CLAUDE.md` 는 4-CLI
     단일 원본이라 경로·이름 불변.
- Alternatives:
  - 스킬 번들 유지 + 이관 리포 무시 — 기각: 같은 스킬의 두 SSOT 가 생겨 drift 재생산.
  - 기술스택 룰을 `paths:` frontmatter 로 지연 로드(공식 지원 확인됨) — 기각(이번 사이클):
    사용자 지시가 제거이고, 모델이 이미 아는 내용은 지연 로드해도 가치가 없다. 프로젝트 고유
    사실이 생기면 그때 paths: 룰로 재작성한다.
  - harness-health-audit·ultracode-service-audit 를 이관 리포에 추가 요청 — 기각(사용자 확정
    폐기): 최신 모델의 자체 리뷰 + Workflow 네이티브 다중에이전트가 대체.
  - 루트 CLAUDE.md 덮어쓰기 유지 — 기각: 사용자 문서 소유권 침해가 구조의 결함이었고,
    OMC 등 생태계 표준이 관리 마커 + 동반 파일 패턴으로 수렴.
- 적용 범위 (BREAKING 포함):
  - `--with-karpathy-hook` CLI 플래그 삭제 (ADR-022 의 플래그 정리와 같은 처리) — BREAKING.
  - 카탈로그 총계 66→55. 삭제 자산을 지정 설치하던 스크립트는 실패한다(fail-loud).
  - 기존 설치본의 update 경로: `.claude/CLAUDE.md` 앵커 → 루트 `CLAUDE-uzys-harness.md` 이행,
    uninstall 은 신규 파일 회수 경로 포함.
  - 이슈 #261-2(유지 9룰 본문 정비)는 범위 밖 — 백로그 H 잔여.
- Consequences:
  - 상주 배포물이 줄어 설치 프로젝트의 컨텍스트 비용 감소(수치는 baseline 재생성으로 확정).
  - 스킬 개선 사이클이 이관 리포에서 독립 진행 — 이 리포 릴리즈와 분리된다.
  - **스킬 본문 재발방지 게이트 4종이 함께 사라졌다** (subagent-file-handoff ·
    north-star-skill · recurrence-prevention-skill · consult-model-tier — 검사 대상이
    이관돼 논리적 귀결). 이관 리포에 대응 게이트가 생기기 전까지 그 본문 계약은 아무도 안 본다.
  - `npx skills add` 가 이관 리포의 `.agents/skills/` 레이아웃을 발견하는지는 Docker 스모크로
    검증한다(AC8). 실패 시 해당 9 엔트리는 미검증 표기로 출하 보류 판단.
  - 탐지기 하한 2건(`docTracks>10`·`references>4`)을 모수 축소에 맞춰 하향 — 커버리지
    최소선이 아니라 0-match 함정 방지 canary 라는 성격을 주석으로 성문화.

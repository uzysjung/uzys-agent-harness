# ADR-037: ci-scaffold 자산 — 라이프사이클 자산화 ② (BDD/TDD → CI 등록)

- Status: Accepted
- Date: 2026-07-18
- PR: #221
- Context: 사용자 지시(2026-07-18): "BDD/TDD 등 만들어진 테스트케이스는 CI 로 깃헙에 등록해서
  검증하게 하는 것" 이 하네스에 녹아야 한다. 실무 감사 결과: GoalTrack 은 ci.yml/e2e.yml 로
  전 구간 계측(실 Postgres 서비스 컨테이너 + RLS 게이트 + Playwright), dyld_vantage 는
  **CI 0 / `.github` 부재** — 하네스가 `.claude/` 조향 레이어만 설치하고 검증 루프의 마지막
  고리(CI)를 스캐폴드하지 않아 생기는 갭의 실존 증명. 라이프사이클 큐 ②
  (`docs/plans/lifecycle-codification-2026-07-18.md`).
- Decision:
  1. **자산 `ci-scaffold`** (official / opt-in 전용 / category workflow / method internal) 신설 —
     `templates/github-workflows/` 의 fill-in 워크플로 3종을 `.github/workflows/` 에 설치.
     GoalTrack 패턴의 도메인 중립 일반화: tag-only 트리거(+ 주석으로 push/PR 대안) ·
     실DB postgres 서비스 컨테이너 블록(test-policy Dev-Prod parity, SQLite 대체 금지 명시) ·
     coverage 게이트(러너 설정/`--cov-fail-under` 가 SSOT) · Playwright E2E.
  2. **트랙 → 변형 매핑은 결정론** (Rule 5): node 계열(`csr-*|ssr-*|tooling|full`) → `ci.yml` /
     python 계열(`data|csr-fastapi|full`) → `ci-python.yml` (polyglot 은 양쪽) / UI 트랙 →
     `e2e.yml`. 매핑 밖 트랙(예: PM 단독)의 명시 opt-in 은 **node fallback** — 명시 `--with` 가
     무설치로 끝나는 silent no-op 은 no-false-ship 위반이라 제네릭 스캐폴드가 정직하다.
  3. **안전 계약** — `.claude/` 밖에 쓰는 첫 자산이므로: ⓐ opt-in 전용(트랙 조건 설치 없음 —
     무인지로 사용자 CI 디렉토리에 쓰지 않는다) ⓑ **기존 파일 절대 덮어쓰지 않음**
     (skip + "exists — preserved" 정직 보고 — 사용자 파이프라인 파괴 방지)
     ⓒ uninstall 은 `.github/` 미접촉 (install-log 미기록 — 설치 순간부터 사용자 소유물,
     D16 과 동일 정신).
  4. **설치 주체 = 전용 단계 `src/ci-scaffold.ts`** (manifest 미경유): manifest copy 는
     ⓐ 무조건 overwrite ⓑ `spec.cli` 에 claude 포함 시에만 실행 — 둘 다 본 자산의 계약
     (no-clobber · CLI-agnostic: `.github/` 은 어느 CLI 를 쓰든 유효)과 충돌한다.
     tauri-desktop 처럼 `isAssetSelected` 게이팅은 공유하되 복사 경로만 분리.
- Alternatives:
  - **manifest 항목으로 추가** — 기각: 위 4 의 두 충돌(overwrite·claude-only). manifest 에
    preserve/CLI-무관 특례를 추가하는 것은 62개 자산 중 1개를 위해 공용 경로를 복잡화.
  - **트랙 조건(has-dev-track) 기본 설치** — 기각: 사용자 repo 의 `.github/` 은 하네스 소유가
    아니다. 기본 설치는 "무인지 글로벌 write 금지"(D16)의 프로젝트판 위반.
  - **단일 만능 ci.yml (node+python 잡 동시)** — 기각: 절반이 죽은 잡인 워크플로는 fill-in
    스캐폴드의 "채우면 끝" 계약을 흐린다. 변형 분리가 각 트랙에서 더 짧고 정직.
  - **스킬(INTERNAL_BUNDLED_SKILL_IDS)로 번들** — 기각: 스킬이 아니다(조향 문서가 아니라
    산출물 파일). 스킬 목록에 끼면 skill dir copy 가 존재하지 않는 templates/skills/ci-scaffold
    를 찾아 silent skip 된다 (테스트로 가드).
- Consequences:
  - 카탈로그 61 → **62**. wizard Workflow 페이지에 자동 노출(카테고리 derive), `--with
    ci-scaffold` 비대화형 동일. COMPATIBILITY 는 🟡 templates (실 CI 실행은 사용자 repo 의
    GitHub Actions 에서만 검증 가능 — 하네스 CI 는 파일 배치·no-clobber 만 검증).
  - 템플릿은 fill-in 스캐폴드(FILL 마커) — 하네스는 프로젝트의 실제 명령을 모른다는 정직성
    유지 (v26.96.0 CLAUDE.md 스캐폴드와 동일 철학). fail-loud: 없는 스크립트는 잡 실패로
    드러난다 (`--if-present` 류 silent skip 금지).
  - 재설치/add 모드에서 기존 파일은 항상 보존 — 스캐폴드 갱신을 받으려면 파일을 지우고
    재설치해야 한다 (의도된 트레이드오프: 사용자 CI 보호 > 템플릿 업데이트 전파).

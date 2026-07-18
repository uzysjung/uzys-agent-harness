# uzys-Claude-Harness 
> **"하네스 + 컨텍스트 엔지니어링으로, Claude Code · Codex · OpenCode · Antigravity 에서 사용자가 신속·정확하게 원하는 서비스를 만들 수 있는 환경을 설치해주는 서비스."**

본 프로젝트의 본질 = **설치 서비스 (installer + curator)**. 4개 AI 코딩 CLI 어디서나, 검증된 플러그인·스킬·룰·hook 을 사용자가 **이해하고 선택**해서 한 번에 설치하고, 그 위에서 AI와 사용자가 공유 어휘(하네스 규칙)로 적은 왕복에 빠르게 개발한다. 자세한 사항은 ./docs/NORTH_STAR.md 참고

## Context Management

- autocompact 활성화. 50% 도달 시 수동 /compact 고려.
- SPEC/PRD는 매 세션 시작 시 재참조 (Persistent Anchor).
- Phase 간 전환 시 구조화된 상태 핸드오프. SPEC/PRD/TODO 최신상태 업데이트

## 실환경 검증 (Real-Env Verification)

**실환경 검증(4-CLI native 인식, 실설치, First-Run 등)은 반드시 Docker 격리 컨테이너에서 한다.**

- 호스트 글로벌 설정에 **write 금지**: `~/.claude/`, `~/.codex/`, `~/.opencode/`, `~/.gemini/`, `npm -g`. mktemp/UX 검증이라도 트리거 금지.
- 검증은 throwaway 컨테이너 안에서만 — 실 CLI(codex 등) 설치·실행·prompt 인식 확인은 `test/docker/` 시나리오로 격리 수행.
- 근거: 단위테스트가 못 잡는 실환경 경로 버그를 잡으면서도(예: experimental opt-in / npx-github npm10) silent drift(v26.58~63) 재발 방지. 컨테이너 격리 = 호스트 오염 0.
- "Docker mock 검증 ≠ 실 CLI 검증" — Promise=Implementation 봉합 시 실 바이너리를 컨테이너에 설치해 native 인식까지 확인.

## Active Rules (11개)

> SSOT = `.claude/rules/*.md` (표는 실 파일 목록과 1:1). 갱신 시 실 파일과 대조.

| Rule | 적용 |
|------|------|
| git-policy | feature branch, commit/push/PR, Conventional Commits, 즉시 커밋, CalVer |
| **no-false-ship** | 거짓출하 금지 — 경로별(wizard/flag/docs/CLI) 검증 증거 의무, 미검증 명시 강제 |
| change-management | CR 분류, Decision Log(ADR), DO NOT CHANGE |
| ship-checklist | 배포 전 체크 (CI·security scan·의존성 audit·SSOT 동기화) |
| code-style | 불변성, 크기 상한(파일 800/함수 50), 하드코딩 금지 |
| error-handling | exit code, stderr, 에러 응답 포맷 |
| **cli-development** | Bash 표준, cross-platform(BSD/GNU), hook 컨벤션 |
| gates-taxonomy | 게이트 4유형 (Pre-flight/Revision/Escalation/Abort) |
| test-policy | 커버리지 threshold(branches 88), TDD RED-GREEN, AAA |
| playwright-launch | 영속 profile 브라우저 launch (E2E/audit) |
| benchmark-parity | 벤치마크/dogfood 실측 루프, gap.md 스키마, PR "## Fidelity" |

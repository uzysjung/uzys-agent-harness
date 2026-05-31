# Ship Checklist

`/uzys:ship` 실행 시 아래 모든 항목을 통과해야 배포 가능.

## Pre-Ship Gates

- [ ] **로컬 CI 전체 통과 (1차 게이트)**: `npm run ci` (typecheck + lint + test:coverage + build) exit 0. GitHub Actions 는 태그 push 시에만 돌므로 **로컬이 사실상 유일한 사전 게이트** — `npm test` 만으로는 coverage gate 누락 (test-policy.md 참조)
- [ ] **E2E 테스트 통과**: 핵심 사용자 흐름 E2E 테스트 전부 PASS (인증/결제/DB — `/uzys:test` 단계에서 검증됨)
- [ ] **커버리지 기준 충족**: test-policy.md의 Track별 threshold 확인 (이 repo: branches 88)
- [ ] **태그 후 릴리스 CI 확인**: 태그 push 후 `gh run watch <run-id> --exit-status` 로 GitHub Actions green 확인 (fail 시 patch 태그로 수정)
- [ ] **Security Scan 통과**: `npx ecc-agentshield scan` 결과 CRITICAL/HIGH 없음
- [ ] **의존성 감사 통과**: `npm audit` (Node.js) 또는 `pip audit` (Python) 실행. critical/high 취약점 없음
- [ ] **SPEC/PRD 정합성**: `bash .claude/hooks/spec-drift-check.sh ship` (exit 2 시 차단)
- [ ] **Review 게이트 통과**: `/uzys:review`에서 CRITICAL 이슈 없음 확인

## Post-Ship Actions

- SPEC/PRD와 불일치 발견 시: SPEC/PRD 업데이트 → 커밋
- ADR 기록 필요 시: `docs/decisions/` 에 아키텍처 결정 기록
- Change Log 최종 확정

## Deployment

- Railway 배포 가능 상태 확인 (Railway MCP/플러그인 사용)
- Health check 엔드포인트 응답 확인
- 배포 후 smoke test 실행

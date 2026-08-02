# Ship Checklist

ship 단계 실행 시 아래 모든 항목을 통과해야 배포 가능.

## Pre-Ship Gates

- [ ] **E2E 테스트 통과**: 핵심 사용자 흐름 E2E 테스트 전부 PASS (인증/결제/DB — test 단계에서 검증됨)
- [ ] **커버리지 기준 충족**: test-policy.md의 Track별 threshold 확인. **전체 실행(full)을 요구하는 지점은 여기다** — 커밋에는 테스트가 없고 머지에는 영향 범위만 돈다 (시점별 정책은 test-policy.md 가 SSOT)
- [ ] **CI green 이 배포의 전제로 배선됐는지**: 릴리스가 CI job 에 `needs:` 로 묶여 **CI red 면 게시가 안 일어나야** 한다. 게시가 CI 와 별개 워크플로면 red 를 통과해 나간다
- [ ] **Security Scan 통과**: `npx ecc-agentshield scan` 결과 CRITICAL/HIGH 없음
- [ ] **의존성 감사 통과**: `npm audit` (Node.js) 또는 `pip-audit` (Python) 실행. critical/high 취약점 없음
- [ ] **SPEC/PRD 정합성**: 이번 사이클에 하기로 한 항목이 미완으로 남아 있지 않은가 (doc-governance.md "작업 완료 처리")
- [ ] **Review 게이트 통과**: review 단계에서 CRITICAL 이슈 없음 확인

## Post-Ship Actions

- SPEC/PRD와 불일치 발견 시: SPEC/PRD 업데이트 → 커밋
- ADR 기록 필요 시: `docs/decisions/` 에 아키텍처 결정 기록
- Change Log 최종 확정

## Deployment

- Railway 배포 가능 상태 확인 (Railway MCP/플러그인 사용)
- Health check 엔드포인트 응답 확인
- 배포 후 smoke test 실행

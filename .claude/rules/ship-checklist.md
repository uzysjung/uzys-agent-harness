# Ship Checklist

배포(ship) 전 아래 모든 항목을 통과해야 한다.

## Pre-Ship Gates

- [ ] **로컬 CI 전체 통과 (1차 게이트)**: `npm run ci` (typecheck + lint + test:coverage + build) exit 0. `npm test` 만으로는 coverage gate 누락 (test-policy.md 참조).
  **full 을 요구하는 지점은 여기다** — 커밋에는 테스트가 없고 머지에는 영향 범위만 돈다 (시점별 정책은 `test-policy.md` 가 SSOT)
  **exit code 를 파이프 뒤에서 읽지 마라** — `npm run ci | tail` 의 `$?` 는 `tail` 의 것이다. 백그라운드 실행이면 `;` 뒤 `echo $?` 의 코드가 알림에 뜨므로 그것도 CI 의 코드가 아니다 (`cli-development.md` 와 같은 함정, 실제로 이 게이트에서 한 번 오독할 뻔했다)
- [ ] **CI green 이 배포의 전제로 배선돼 있는지**: 릴리스 워크플로가 CI job 에 `needs:` 로 묶여 있어 **CI red 면 게시 자체가 안 일어나야** 한다. 확인 없이 태그를 밀지 않는다 — v26.128.0~131.0 에서 `ci` 4연속 red 인데 `publish` 는 별개 워크플로라 성공했고, 그 사실을 3릴리즈 동안 아무도 못 봤다
- [ ] **E2E 테스트 통과**: 핵심 사용자 흐름 E2E 테스트 전부 PASS (인증/결제/DB)
- [ ] **커버리지 기준 충족**: test-policy.md의 Track별 threshold 확인 (이 repo: branches 88)
- [ ] **태그 후 릴리스 CI 확인**: 태그 push 후 `gh run watch <run-id> --exit-status` 로 GitHub Actions green 확인 (fail 시 patch 태그로 수정)
- [ ] **fresh-env 설치 매트릭스 확인 (v26.72.0)**: `install-matrix.yml` (태그 자동 또는 `gh workflow run install-matrix.yml --ref main`) green — OS×Node×pm 설치 + 멀티트랙 + npx github: smoke. First-Run Success 회귀 방지
- [ ] **Security Scan 통과**: `npx ecc-agentshield scan` 결과 CRITICAL/HIGH 없음
- [ ] **의존성 감사 통과**: `npm audit` (Node.js) 또는 `pip-audit` (Python) 실행. critical/high 취약점 없음
- [ ] **SPEC/PRD 정합성**: 이번 사이클에 하기로 한 항목이 미완으로 남아 있지 않은가. 열린 항목은 `docs/plans/*-todo.md` 에 있어야 하고 `docs/SPEC.md`·`docs/todo.md` 에 진행이 섞여 있으면 안 된다 (🧪 `tests/spec-drift-backlog-exemption.test.ts`)
- [ ] **Review 게이트 통과**: 코드 리뷰(reviewer 에이전트)에서 CRITICAL 이슈 없음 확인
- [ ] **Surface Parity (거짓출하 방지)**: 신규/변경 자산·기능의 사용자 도달 경로 전부(wizard / CLI flag / 문서 표기 / 해당 CLI별) 실행 증거 확보. 미검증 경로는 ship 보고에 "미검증" 명시 — 한 경로 증거의 타 경로 전용 금지
- [ ] **로드맵 SSOT 동기화 (drift 차단)**: 자산 추가/제거·마일스톤 진척 시 `docs/plans/service-audit-roadmap.md` 의 ⓐ baseline 버전 헤더 ⓑ 완료 항목 상태 표기 ⓒ 자산 수치(M5 등) ⓓ immediateNext 를 현행화. 8 PR 동안 미갱신으로 "48 vs 실측 58"·"완료를 미완으로 박제" drift 발생한 전례(2026-06-21 페르소나 감사) — SSOT 가 부정확하면 출하 보고 자체가 오염된다 (change-management.md "SSOT 최신화")
- [ ] **CHANGELOG 현행화 (테스트 강제)**: 릴리즈에서 `package.json` 버전을 bump 하면 `CHANGELOG.md` 에 대응하는 `## [v<version>]` 항목을 **같은 릴리즈 커밋에** 추가한다. `tests/docs-supply-chain.test.ts` 의 "CHANGELOG 현행성 게이트" 가 미기록 시 `npm run ci` 를 실패시킨다 — 릴리즈 커밋이 package.json 만 bump 하던 관례로 v26.88.1~v26.95.0 이 7릴리즈 drift 했던 전례(#196 backfill) 재발을 구조적으로 차단 — 주석·체크리스트 경고는 차단 수단이 아니다

### 릴리즈 커밋과 태그의 순서 (역방향 게이트 때문에 순서가 정해져 있다)

CHANGELOG 항목이 있는데 태그가 없으면 역방향 게이트가 `npm run ci` 를 실패시킨다(v26.138.0
차단). 그래서 **bump 후 태그 전 구간의 로컬 CI 는 구조적으로 red** 다 — 이걸 모르면 다음 사람이
게이트가 깨졌다고 오판하거나, 더 나쁘게는 우회한다(#237 이 없앤 관행). 순서는 이렇다:

1. **bump 전** 에 `npm run ci` — 코드 상태에 대한 1차 게이트는 여기서 통과시킨다
2. 릴리즈 커밋 (`package.json` bump + CHANGELOG 항목). `package-lock.json` 은 담지 않는다
   (`git-policy`, 직전 3릴리즈도 0건)
3. **로컬 태그 생성** (`git tag v<version>`) — push 아님. 되돌리기 쉽다(`git tag -d`)
4. `npm run ci` 재실행 → 역방향 게이트 포함 green. 게이트는 `git tag -l`(로컬)을 읽는다
5. push (커밋 + 태그) → 원격 CI → `needs: ci` 가 게시를 가른다

3 을 건너뛰고 4 를 돌리면 red 가 정상이다. **red 를 보고 게이트를 고치지 마라** — 순서가 틀린 것이다.

## Post-Ship Actions

- SPEC/PRD와 불일치 발견 시: SPEC/PRD 업데이트 → 커밋
- ADR 기록 필요 시: `docs/decisions/` 에 아키텍처 결정 기록
- Change Log 최종 확정

## Deployment

- Railway 배포 가능 상태 확인 (Railway MCP/플러그인 사용)
- Health check 엔드포인트 응답 확인
- 배포 후 smoke test 실행

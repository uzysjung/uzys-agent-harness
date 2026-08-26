# Ship Checklist

배포(ship) 전 아래 모든 항목을 통과해야 한다.

## Pre-Ship Gates

- [ ] **로컬 CI 전체 통과 (1차 게이트)**: `npm run ci`(typecheck + lint + test:coverage + build) exit 0. `npm test` 만으로는 coverage gate 누락. **full 을 요구하는 지점은 여기다** — 커밋에는 테스트가 없고 머지에는 영향 범위만 돈다(시점별 정책 SSOT = `test-policy.md`). **exit code 를 파이프 뒤에서 읽지 마라** — `npm run ci | tail` 의 `$?` 는 `tail` 의 것이고, 백그라운드 실행이면 `;` 뒤 `echo $?` 도 CI 의 코드가 아니다(`cli-development.md` 와 같은 함정, 실제로 한 번 오독할 뻔했다)
- [ ] **CI green 이 배포의 전제로 배선돼 있는지**: 릴리스 워크플로가 CI job 에 `needs:` 로 묶여 있어 **CI red 면 게시 자체가 안 일어나야** 한다. 확인 없이 태그를 밀지 않는다 — v26.128.0~131.0 에서 `ci` 4연속 red 인데 `publish` 는 별개 워크플로라 성공했고, 그 사실을 3릴리즈 동안 아무도 못 봤다
- [ ] **E2E + 커버리지**: 핵심 사용자 흐름 E2E 전부 PASS · `test-policy.md` threshold(이 repo: branches 88)
- [ ] **태그 후 릴리스 CI 확인**: `gh run watch <run-id> --exit-status` green (fail 시 patch 태그로 수정). **워크플로가 돌았는지부터 본다** — 2026-08-27 Actions 장애 때 같은 태그에서 `install-matrix` 는 돌고 `ci` 는 발동조차 안 해 게시가 조용히 빠졌다(빨간불이 아니라 *아무것도 없음*이라 화면에는 성공한 워크플로 하나만 보인다). 안 돌았으면 `gh workflow run ci --ref <태그>` 로 재트리거
- [ ] **게시가 실제로 일어났는지**: `npm run release:audit` exit 0 — 원격 태그 중 npm 에 없는 버전이 0. 의도적 미게시는 CHANGELOG 헤딩 바로 다음 줄에 `<!-- npm-publish:none <사유> -->`. 같은 검사가 `release-audit.yml` 로 매일 돌아 트리거 유실을 하루 안에 잡는다(Epic #366 G5)
- [ ] **fresh-env 설치 매트릭스**: `install-matrix.yml` green (태그 자동 또는 `gh workflow run install-matrix.yml --ref main`) — OS×Node×pm 설치 + 멀티트랙 + npx github: smoke. First-Run Success 회귀 방지
- [ ] **보안·의존성**: `npm run security` exit 0 — **baseline 대비 신규 critical/high 0** + `npm audit --omit=dev` critical/high 0. **절대 0 을 요구하지 않는 이유**: 이 저장소가 파는 에이전트는 Bash 를 갖고 훅은 백그라운드 프로세스를 띄운다(설계상 high 29건). 절대 0 은 영원히 성립하지 않아 **통과할 수 없는 게이트가 되고, 그런 게이트는 아무도 안 돌린다** — v26.146.0 에서 실제로 건너뛴 채 배포됐다(#237 과 같은 형태). 신규 findings 를 의도적으로 받아들일 때만 `npm run security:baseline` 으로 baseline 을 갱신하고 사유를 커밋 본문에 남긴다. 이 검사는 릴리즈 CI 의 `ci` job 안에 있어 **red 면 `needs: ci` 가 게시를 막는다**
- [ ] **SPEC/PRD 정합성**: 이번 사이클에 하기로 한 항목이 미완으로 남아 있지 않은가. 열린 항목은 `docs/plans/*-todo.md` 에 있어야 하고 `docs/SPEC.md`·`docs/todo.md` 에 진행이 섞이면 안 된다 (🧪 `tests/spec-drift-backlog-exemption.test.ts`)
- [ ] **Review 게이트 통과**: 코드 리뷰(독립 reviewer 에이전트)에서 CRITICAL 이슈 없음. **완료 판정은 만든 레인이 아니라 검증 레인이 내린다** — 검증자는 요구사항·변경분·검증 결과를 직접 다시 확인한 뒤 판정하고, 구현자의 보고를 읽고 승인하는 것은 판정이 아니다
- [ ] **Surface Parity (거짓출하 방지)**: 신규/변경 자산·기능의 사용자 도달 경로 전부(wizard / CLI flag / 문서 표기 / 해당 CLI별) 실행 증거 확보. 미검증 경로는 ship 보고에 "미검증" 명시 — 한 경로 증거의 타 경로 전용 금지
- [ ] **로드맵 SSOT 동기화 (drift 차단)**: 자산 추가/제거·마일스톤 진척 시 `docs/plans/service-audit-roadmap.md` 의 ⓐ baseline 버전 헤더 ⓑ 완료 항목 상태 표기 ⓒ 자산 수치 ⓓ immediateNext 를 현행화. 8 PR 동안 미갱신으로 "48 vs 실측 58"·"완료를 미완으로 박제" drift 가 났던 전례가 있다 — SSOT 가 부정확하면 출하 보고 자체가 오염된다
- [ ] **CHANGELOG 현행화 (🧪 테스트 강제)**: `package.json` 버전을 bump 하면 **같은 릴리즈 커밋에** `CHANGELOG.md` 의 `## [v<version>]` 항목을 추가한다. `tests/docs-supply-chain.test.ts` 의 현행성 게이트가 미기록 시 `npm run ci` 를 실패시킨다 — 릴리즈 커밋이 package.json 만 bump 하던 관례로 7릴리즈가 drift 했던 전례(#196 backfill)를 구조적으로 차단한다

## 릴리즈 커밋과 태그의 순서 (역방향 게이트 때문에 순서가 정해져 있다)

CHANGELOG 항목이 있는데 태그가 없으면 역방향 게이트가 `npm run ci` 를 실패시킨다(v26.138.0 차단). 그래서 **bump 후 태그 전 구간의 로컬 CI 는 구조적으로 red** 다 — 이걸 모르면 다음 사람이 게이트가 깨졌다고 오판하거나, 더 나쁘게는 우회한다(#237 이 없앤 관행).

1. **bump 전** 에 `npm run ci` — 코드 상태에 대한 1차 게이트는 여기서 통과시킨다
2. 릴리즈 커밋(`package.json` bump + CHANGELOG 항목). `package-lock.json` 은 담지 않는다(`git-policy`)
3. **로컬 태그 생성**(`git tag v<version>`) — push 아님. 되돌리기 쉽다(`git tag -d`)
4. `npm run ci` 재실행 → 역방향 게이트 포함 green. 게이트는 `git tag -l`(로컬)을 읽는다
5. push(커밋 + 태그) → 원격 CI → `needs: ci` 가 게시를 가른다

3 을 건너뛰고 4 를 돌리면 red 가 정상이다. **red 를 보고 게이트를 고치지 마라** — 순서가 틀린 것이다.

## Post-Ship

SPEC/PRD 와 불일치 발견 시 갱신 → 커밋 · ADR 필요 시 `docs/decisions/` 에 기록 · Change Log 최종 확정.

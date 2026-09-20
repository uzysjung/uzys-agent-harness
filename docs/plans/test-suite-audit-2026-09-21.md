# 상시 테스트 스위트 · 검증 룰 감사 — 2026-09-21 (#454)

> 이슈 #454 의 다섯 질문("설치자에게 필요한 테스트인가 · 일어나면 안 될 일을 막는가 · 둘 다 아닌 것이 있는가 ·
> 룰이 모델의 판단 자리를 남기는가 · 모델이 좋아지면 결과가 좋아지는가")에 `audit-harness-fit` 절차로 답한 기록.
> 결정의 SSOT 는 ADR-094, 코드 반영은 PR(이 문서와 같은 PR). 이 문서는 근거 보존용이라 상주하지 않는다.

## 0. 잣대와 방법

**잣대(사용자 확정 2026-09-20)** — 상시 스위트는 **안착**만 잰다: 룰·스킬·훅·에이전트·MCP 설정이 설치자 프로젝트에
깔리나 · 갱신되나 · 백업되나 · 지워지나, CLI 별 올바른 파일 형태로 나가나, 설치자가 쓰는 플래그·위저드가 약속대로
동작하나(①). 그리고 일어나면 안 되는 일 — 시크릿·무백업 삭제·심링크 따라가기·거짓 출하·공급망·설치자를 잘못
안내하는 문서 — 를 막는다(②). **발화·의도 검증은 값을 바꾸는 PR 에서만** — 룰·스킬 본문이 무슨 말을 하는가(문구·
문장·개수)를 단언하는 테스트, 내부 구조 단언, 이 리포 개발 사본(`.claude/`) 위생, 이 리포 안에서만 난 사고의 재현은
③ 이고 상시에서 뺀다. ③ 마다 "이 테스트가 red 가 되는 상태를 **설치자가** 만드나"를 물었다.

**방법** — `tests/` 102 파일을 3 레인이 it 블록 단위로 판정(표본이 아니라 전수, it 수는 grep 실측)하고 리드가 갈림
항목을 결정했다. 룰 2종(배포판 `templates/rules/test-policy.md` · `ship-checklist.md`, 개발 사본 `.claude/rules/`)과
릴리즈 게이트(`test.yml` ci·docker-e2e · `docker-scenarios.yml` · `install-matrix.yml`)는 리드가 직접 봤다.
**독립 리뷰는 걸지 않았다** — `tests/`·`docs/`·`.claude/` 만 바꾸는 PR 이라 문턱 아래(ADR-087 · ADR-094).

## 1. 결과 요약

| 항목 | before → after |
|---|---|
| 테스트 파일 | 102 → 93 |
| 테스트(it) | 1,592 → 1,367 |
| branches 커버리지 | 88.76 → 86.78 (하한 88 → **86**, 사용자 결정 2026-09-21) |
| `npm run ci` | exit 0 (17초) |
| 파일 단위 결정 | 유지 61 · 축소 30 · 퇴역 9 · 성질 검사로 재작성 1 · 보류(사용자 결정) 1 |

**퇴역 9**: `wizard-steps`(상수 사본) · `subagent-file-handoff` · `recurrence-prevention-skill` · `doc-governance-baseline-rule`
(이상 개발 사본 1:1) · `skill-trigger-overlap`(description 유사도 → description 변경 PR 검증) · `browser-prohibitions-owner`
(은퇴 룰 부재) · `context-cost-display-parity`(소스 구조 — 결과는 `context-cost` 표면 절이 잰다) · `issue-template-parity`
(리포 전용) · `lane-principle-anchor-parity`(앵커 문안 성분 — 임베드는 CLI 별 렌더 테스트가 문다).

**그대로 둔 ②축 게이트**(삭제 후보에 올리지 않았다): `publish-needs-verification-gate` · `security-gate-wiring` ·
`docs-supply-chain` 의 CHANGELOG-태그·scope 없는 npx · `doc-asset-ref-drift` · `resident-doc-asset-reachability` ·
`backup-*` · `policy-file-ownership` · `external-cli-ownership` · `install-foreign-skill-dir` · `env-files` · `frontmatter-yaml`
· `shipped-shell-syntax`(개수 하한만 0건 방지로) · `skills-cli-pin` · `trust-tier-drift` · `templates-distribution-hygiene`.

**잣대와 어긋나지만 남긴 것(리드 판정, 사유는 §2 표)**: `context-cost-ratchet`(ADR-083 정책 집행 — 설치자 매 세션 비용)
· `north-star-cost-figures`·`docs-supply-chain` 숫자 정합(설치자가 읽는 문서의 수치) · `spec-drift-backlog-exemption` ·
`cron-failure-notification`(이 리포의 거짓 출하 축) · `manifest` 은퇴 가드 3(ADR-089/090).

## 2. 스위트 판정 표 (102 파일)

축 = 레인 판정(①안착 · ②방어 · ③둘 다 아님 · 혼합). 레인 제안 원문(③ 블록 · "설치자가 만드나" 답 · 근거)은
이 PR 의 세션 기록에 있고 표에는 결론만 옮겼다.

| 파일 | it | 축(레인) | 레인 제안 | 리드 결정 |
|---|---|---|---|---|
| `agents-md-scaffold-parity.test.ts` | 4 | 혼합 | narrow(FILL 절 it 제거) | 축소 적용 |
| `antigravity/transform.test.ts` | 8 | ① | keep | 유지 |
| `audit-harness-fit-skill.test.ts` | 9 | 혼합 | narrow(TOC · 미러 바이트동일 · 고아 3개 제거, DEV_METHOD 후반 갈림) | 축소 적용 |
| `backup-collision.test.ts` | 6 | ② | keep | 유지 |
| `backup-symlink.test.ts` | 5 | ② | keep | 유지 |
| `base-track.test.ts` | 4 | ① | keep | 유지. 이름 열거가 있으나 트랙이 받는 집합 자체가 설치자 계약 |
| `baseline-targets.test.ts` | 29 | ① | keep | 유지 |
| `browser-prohibitions-owner.test.ts` | 1 | ③ | retire | 퇴역 적용 |
| `check-absence-tool.test.ts` | 22 (×2 사본) | 혼합 | narrow(repo 사본 루프 + 바이트동일 it 제거 → shipped 사본만) | 축소 적용 |
| `ci-scaffold.test.ts` | 10 | 혼합 | narrow(그 1 it) | 축소 적용 |
| `claude-md-import.test.ts` | 9 | ①+② | keep | 유지 |
| `cli-external-path.test.ts` | 15 | 혼합 | keep(bmad it 은 narrow 가능) | 유지 |
| `cli-targets.test.ts` | 21 | ① | keep | 유지 |
| `cli.test.ts` | 16 | 혼합 | narrow(위 5개 제거) | 축소 적용 |
| `codex/agents-md.test.ts` | 5 | ① | keep | 유지 |
| `codex/config-toml.test.ts` | 5 | ① | keep | 유지 |
| `codex/opt-in.test.ts` | 3 | ①+② | keep(`trust-entry.test.ts` 와 합쳐도 됨) | 유지 |
| `codex/skills.test.ts` | 12 | ① | keep | 유지 |
| `codex/transform.test.ts` | 9 | ① | keep(2 단언 narrow 가능) | 유지 |
| `codex/trust-entry.test.ts` | 5 | ① | keep(opt-in 과 중복이라 합치기 후보) | 유지 |
| `consult-model-tier.test.ts` | 16 | 혼합 | keep(폴링 elapsed it 은 narrow/갈림) | 축소 적용(elapsed<950ms 타이밍 단언 1건 제거 — 계기가 CI 시간이라 ③) |
| `context-cost-display-parity.test.ts` | 4 | ③ | retire(갈림: it3-4 를 `context-cost.test.ts` 표면 절로 흡수) | 퇴역 적용 |
| `context-cost-ratchet.test.ts` | 9 | ③ | 갈림(relocate: 자산 변경 PR·`cost:report` 게이트로 / 또는 keep) | 유지. 설치자 매 세션 상주 비용이 조용히 늘지 않는다(ADR-083 정책 집행, baseline derive) |
| `context-cost.test.ts` | 39 | 혼합 | narrow(표면 절 8건 keep, 나머지 ~28건 retire 또는 `cost:report` 스크립트 테스트/값 변경 PR 로 relocate) | 축소 적용 — 표면 절(설치 헤더·confirm 값 = 계측 · 두 표면 동일 · codex 단독 agents 0 · 계측 스킬 수 = 실설치 · 번들 스킬 frontmatter · path robustness) 11건만 남김. 계측·순위표·ADR-044 단위 ~28건 제거 → `src/context-cost.ts` branches 90 → 52. 그 몫으로 하한을 88 → 86 으로 내렸다(§6) |
| `context-files-doc.test.ts` | 6 | ② | keep | 유지 |
| `cron-failure-notification.test.ts` | 2 | ③ | retire(갈림: `release-audit` cron 이 미게시를 잡는 경로라 간접 방어) | 유지. release-audit cron 의 실패 알림 = 미게시 감지 경로 |
| `design.test.ts` | 13 | 혼합 | narrow(TTY/NO_COLOR 3건만 keep) | 축소 적용 |
| `doc-asset-ref-drift.test.ts` | 6 | ② | keep | 유지 |
| `doc-governance-baseline-rule.test.ts` | 1 | ③ | retire | 퇴역 적용 |
| `docs-supply-chain.test.ts` | 11 | 혼합 | narrow(주석 총계·kit 과장 retire, 서문·글롭 총계 갈림) | 축소 적용(src 주석 총계 · kit 과장 2건). 문서 숫자 정합 3건은 유지 — README 의 N/M 이 틀린 채 나가는 것을 막는 유일한 게이트 |
| `env-files.test.ts` | 14 | ①+② | keep | 유지 |
| `evidence-templates.test.ts` | 2 | 혼합 | narrow(인벤토리 it retire) | 축소 적용 |
| `external-assets.test.ts` | 38 | 혼합 | narrow(대략 38 → ~15: 핀·유일·tier 폴백·opt-in/forceInclude 규칙·트랙 조건·번들 실재·kind:internal·ci-sca… | 축소 적용 |
| `external-cli-ownership.test.ts` | 13 | ② | keep | 유지 |
| `external-cli-update.test.ts` | 12 | ①+② | keep | 유지 |
| `external-installer-version.test.ts` | 1 | ① | keep | 유지 |
| `external-installer.test.ts` | 16 | ①+② | keep | 유지 |
| `external-tool-routing.test.ts` | 7 | ③ | relocate(값 변경 PR — 갈림) | 축소 적용 — 검사 루트를 `templates/skills` 로. 배포 스킬 본문의 모델 슬러그는 설치자 오도(②)라 남김. 개발 사본 1:1 describe 는 제거 |
| `frontmatter-yaml.test.ts` | 11 | ② | narrow(스캔 루트를 `templates/` 로, "양쪽" it 제거) | 축소 적용 |
| `fs-ops.test.ts` | 12 | ①+② | keep | 유지 |
| `hook-block-log.test.ts` | 3 (×3 훅 사본) | 혼합 | narrow(`templates/hooks/protect-files.sh` 만 남김) | 축소 적용 |
| `hook-context-schema.test.ts` | 3 (each 2, 전개 2+1) | 혼합 ①+③ | narrow — `.claude` dirLabel 과 양쪽 존재 it 을 빼고 `templates/hooks` 만 실행 | 축소 적용 |
| `hook-wiring-parity.test.ts` | 4 (each 3, 전개 = ALWAYS_HOOKS×2 + 파일 수) | ① | keep | 유지 |
| `install-foreign-skill-dir.test.ts` | 19 | ② | keep (선택: FIFO it 1 + 둘째 표본 1 narrow) | 유지(FIFO 술어 1건 포함 — 비용 0) |
| `install-inventory-e2e.test.ts` | 5 | ① | keep | 유지 |
| `install-log.test.ts` | 32 | ① (③ 소수) | keep (선택: detail 형태 4건 narrow — 단 detail 은 uninstall 역명령 입력이라 갈림) | 유지 |
| `install.test.ts` | 79 (each 2, 전개 3+2) | 혼합 ①+③ | narrow — retire ⓐ2·ⓑ2·ⓒ1 = 5, shortenPath 중복 한쪽(헬퍼 5 또는 executeSpec 4) 제거, formatCliPhas… | 축소 적용(뜰 수 없는 줄의 부재 5 · shortenPath 중복 5 · NEXT 중복 1). formatCliPhaseTitle 6 유지 |
| `installer-11-track.test.ts` | 5 (each 1, 전개 12) | 혼합 ①+③ | narrow — 위 2 it 제거(각각 manifest.test · 위 it 이 이미 덮음). `TRACKS` 하드코딩 배열(L27-40)은 `types.TR… | 축소 적용 |
| `installer-cli-matrix.test.ts` | 16 (루프 1 = 84 케이스) | 혼합 ①+③ | narrow — retire 8(개수 1 · sorted 1 · 중복 6), keep 8(루프 · `.env.example` 2 · `[opencode]` A… | 축소 적용 |
| `installer-external.test.ts` | 15 | ① | keep (선택: 위 1 narrow) | 유지 |
| `installer-track-matrix.test.ts` | 19 | 혼합 ①+③ | narrow + relocate — spawn 5 retire · 정확 목록 5 는 값 변경 PR 검증으로 relocate(또는 "attempted 전부가 c… | 축소 적용 — spawn 횟수 5 · 정확 id 목록 5 제거. opt-in 이 트랙 기본으로 딸려오는 회귀는 external-assets 의 조건 계약이 문다 |
| `installer.test.ts` | 11 | ① + ② | keep (M-1 은 갈림 표기) | 유지. M-1 치유 5건은 변이 원천(사이드카 훅)이 지금 템플릿에 없지만 재도입 시 곧바로 설치자 상태 — 갈림 표기 |
| `interactive.test.ts` | 34 (each 1, 전개 2) | 혼합 ①+③ | narrow — toOptionFlags 2 + splitInstallTargets 3 retire · computeUserOverride 는 기준선을 `re… | 축소 적용(내부 헬퍼 5). computeUserOverride 기준선은 src 추천 함수에서 derive |
| `issue-template-parity.test.ts` | 4 | ③ | retire (리드가 리포 위생 게이트로 남길지 결정) | 퇴역 적용 |
| `lane-principle-anchor-parity.test.ts` | 6 (each 3, 전개 3+4+N) | ③ (① 1건) | relocate(값 변경 PR 검증) — 단 임베드 it.each 3건은 `opencode/agents-md.test`·codex 쪽 렌더 테스트가 덮는지 확… | 퇴역 적용(값 변경 PR 검증으로) |
| `list.test.ts` | 10 | ① (+②) | keep | 유지 |
| `manifest.test.ts` | 18 | 혼합 ①+②+③ | narrow — 위 9 중 sorted/uzys/CLAUDE.md-entry/ecc/playwright/benchmark 6 retire · 은퇴 에이전트·스… | 축소 적용(부재 가드 6). 은퇴 에이전트·스킬·전제 확인 3건은 유지(ADR-089/090 · `RETIRED_*` derive) |
| `mcp-merge.test.ts` | 13 | ① + ② | keep (선택: 파서 거부 3 + 표면 2 narrow) | 유지 |
| `north-star-cost-figures.test.ts` | 4 | ③ (갈림) | retire 또는 relocate(값 변경 PR: cost baseline 갱신 시) — **갈림**: NORTH_STAR 가 GitHub 에서 설치자에게 읽… | 유지. GitHub 에서 설치자가 읽는 차별화 수치 — 틀리면 잘못 안내(②-문서) |
| `opencode/agents-md.test.ts` | 4 | 혼합 ①+③ | narrow — renameSlashes 2 retire(**갈림**: 렌더 it 이 `/uzys-spec` 치환도 함께 단언하므로 커버 유지) · 렌더 2 … | 축소 적용 |
| `opencode/install.test.ts` | 4 | ① | narrow — 1번 it 만 keep(고유 단언: `$schema`·mcp 채움·누출 없음), 3건 retire | 축소 적용 |
| `opencode/opencode-json.test.ts` | 3 | ① | keep | 유지 |
| `opencode/transform.test.ts` | 7 | ① (+②) | keep (선택: 위 1건을 templates 파일과 바이트 비교로 바꿈) | 유지 |
| `policy-file-ownership.test.ts` | 16 | ② | keep (narrow 1) | 유지 |
| `preset-recommend.test.ts` | 7 | 혼합 ①+③ | relocate + 재작성 권고 — 성질 검사(추천 ⊆ 카탈로그 ∧ tier≠experimental ∧ condition≠opt-in ∧ 트랙 매치)로 바꾸면… | 성질 검사로 재작성 적용(추천 ⊆ 카탈로그 · experimental 없음 · opt-in 없음 · 트랙 매치). 값 핀 제거 |
| `project-claude-merge.test.ts` | 13 | ① + ② | keep (narrow 1) | 유지 |
| `protect-branch-surface.test.ts` | 5 (each 1, 전개 12) | ① + ② | keep (선택: 문구 it 1 narrow — 갈림: "덮지 못하는 것을 출력한다" 는 스크립트 계약) | 유지 |
| `publish-needs-verification-gate.test.ts` | 10 | ② | keep | 유지 |
| `recurrence-prevention-skill.test.ts` | 1 | ③ | retire | 퇴역 적용 |
| `render-hint-parity.test.ts` | 4 | ② (③ 1) | keep (narrow 1: FILL 소스 문자열 it) | 유지 |
| `resident-doc-asset-reachability.test.ts` | 5 | ② | keep | 유지 |
| `resident-reach-4cli.test.ts` | it 20 + each 1 | ① | keep | 유지 |
| `resident-rule-reference-liveness.test.ts` | it 8 | 혼합(②+③) | narrow — ⓑ·ⓒ 계열과 "면제 3건" 개수 단언을 빼고 배송 계열 스캔 + canary 1건만 남긴다 | 축소 적용 — 배송 계열만. `.claude/`·`tests/**` 계열과 면제 개수 단언 제거 |
| `router.test.ts` | it 12 | ① | keep | 유지 |
| `rules-port.test.ts` | it 8 | ① | narrow — L38 의 `toBe(1)` 을 `toBeGreaterThan(0)` 으로(0건 방지 목적만 남김) | 축소 적용 |
| `security-gate-wiring.test.ts` | it 5 | 혼합(②+③) | narrow — L92 블록 제거. L57 은 `> 0` 으로 낮춰도 목적 유지 | 유지, 변경 없음(보안 배선 게이트) |
| `session-cleanup-gate.test.ts` | it 6 + each 1 | 혼합(①②+③) | narrow — L23·L29 블록 제거, L65 의 `.claude/hooks/` 행 제거. 실행 2건·kill 금지·이식성·templates git pul… | 축소 적용 |
| `settings-reference-parity.test.ts` | it 4 + each 1 | ② | keep | 유지 |
| `shipped-shell-syntax.test.ts` | it 10 | ②(+③ 일부) | narrow — 개수 하한 4곳을 `> 0` 으로(0건 방지만 남김). 나머지 keep | 축소 적용 |
| `skill-registration-uniform.test.ts` | it 4 + each 1 | 혼합(①+③ 갈림) | narrow(갈림) — describe 2 keep. describe 1 은 리드 결정: 형태 단언이지만 "형제 파일 누락" 결과는 `uninstall-age… | 유지. 형태 단언이지만 막는 결과(형제 파일 미배포)가 설치자에게 도달 |
| `skill-trigger-overlap.test.ts` | it 2 | ③ | relocate — 스킬 description 을 바꾸는 PR 의 검증으로 | 퇴역 적용 — description 을 바꾸는 PR 의 검증으로(이슈 #454 후속 메모) |
| `skills-cli-pin.test.ts` | it 3 | ② | keep | 유지 |
| `skills-per-agent-call.test.ts` | it 6 | ① | keep | 유지 |
| `spec-anchor-preserved.test.ts` | it 3 | ③ | retire — `docs/SPEC.md:51`·`docs/archive/README.md:15` 가 이 테스트를 지목하므로 그 두 줄 정정 동반 | **보류 — 사용자 결정**. `docs/SPEC.md` DO NOT CHANGE 절이 이 테스트를 지목한다(Major CR). 잣대로는 ③(리포 문서 해시) |
| `spec-drift-backlog-exemption.test.ts` | it 2 | ③(갈림) | 갈림 — 잣대로는 retire(리포 유지보수자용 문서 게이트). 단 상주 문서 4곳이 🧪 로 지목한다: `CLAUDE.md:22` · `.claude/rule… | 유지. 리포 출하 게이트(main 항상 출하 가능, ADR-060·065) — 설치자용이 아니라 이 리포의 거짓 출하 축 |
| `spec-drift-script-surface.test.ts` | it 13 + each 1 | 혼합(①②+③) | narrow — L62·L281 제거. L87 은 갈림(배포 룰이 실제 호출 형태를 적는지는 설치자 안내 정확성) | 축소 적용 |
| `state.test.ts` | it 11 | ① | keep | 유지 |
| `subagent-file-handoff.test.ts` | each 1 (3 케이스) | ③ | retire — `tests/external-tool-routing.test.ts:164` 주석이 이 파일을 SKILL.md 3종 사본 대조 소유자로 지목하므… | 퇴역 적용(개발 사본 1:1) |
| `templates-distribution-hygiene.test.ts` | it 13 | ②(+게이트 자기검증) | keep | 유지 |
| `track-match.test.ts` | it 2 + each 3 | ① | 없음 | 유지 |
| `trust-tier-drift.test.ts` | it 11 | ② | keep | 유지 |
| `types.test.ts` | it 4 + each 3 | 혼합(①+③) | narrow — `TRACKS array` describe(L29-38) 제거 | 축소 적용 |
| `uninstall-agents-dir.test.ts` | it 7 | ①② | keep | 유지 |
| `uninstall-interactive.test.ts` | it 17 | ① | keep | 유지 |
| `uninstall.test.ts` | it 52 | ①②(+③ 1) | narrow — L1035 블록 제거. 나머지 51건 keep | 축소 적용 |
| `update-command.test.ts` | it 15 | ①(+③ 1) | narrow(갈림) — L175 블록 제거 또는 이름 정정. 나머지 keep | 축소 적용 |
| `update-external-skills.test.ts` | it 28 + each 4 | ① | keep | 유지. 두 벌 목록은 변이 실측으로 의도가 증명돼 있다 |
| `update-mode.test.ts` | it 74 + each 7 | ①② | keep | 유지 |
| `wizard-bundle.test.ts` | it 3 + each 1 | ① | keep | 유지 |
| `wizard-installed-state.test.ts` | it 8 | ① | keep | 유지 |
| `wizard-page-parity.test.ts` | it 9 | ①② | keep (L30 은 중복이라 빼도 무방) | 유지(중복 재현 1건 포함) |
| `wizard-steps.test.ts` | it 3 | ③(갈림) | 갈림 — 잣대로는 L5 retire, `stepLabel` 2건은 남겨도 23줄. 파일 통째 retire 도 비용 0 | 퇴역 적용(상수끼리 대조) |

## 3. 룰 문장 판정

판정 축: (a) 모델이 스스로 고를 수 있는 판단을 고정 절차로 대신하는가 / (b) 되돌릴 수 없는 손상·거짓 출하를 막는가 /
모델 진화 시 = 불필요해진다 · 여전히 필요 · 더 좋아진다.

### 3.1 배포판 Testing (`templates/rules/test-policy.md`) — 변경 없음

| 문장(요지) | (a) | (b) | 모델 진화 시 | 판정 |
|---|---|---|---|---|
| 얼마나 깊이 검증할지는 변경 위험에 비례, 시점은 Delivery | — | — | 더 좋아진다(판단 자리) | 유지 |
| 보통 변경 = 기준 CI + 영향 범위 회귀, 독립 검증은 Delivery 가 요구할 때만 | — | — | 더 좋아진다 | 유지 |
| 필요한 보호를 유지하며 부담 최소(#496 문단) | — | ○(가드 증식 방지) | 더 좋아진다 | 유지 |
| high-risk 목록(인증·결제·개인정보·정합성·동시성·마이그레이션) | — | ○ | 여전히 필요(정의) | 유지 |
| 풀 회귀·E2E·변이·보안 스캔은 CI/CD 일정, per-change 아님 | — | ○(과검증 방지) | 여전히 필요 | 유지 |
| high-risk 는 normal·boundary·failure·misuse·recovery — 개연성 없으면 생략 | △(목록) | ○ | 여전히 필요(생략 조건이 판단 자리) | 유지 |
| 프로덕션 호환 의존성, 아니면 명시적 test double | — | ○ | 여전히 필요 | 유지 |
| 프로덕션 개인정보·시크릿을 테스트에 쓰지 않는다 | — | ○ | 여전히 필요 | 유지 |
| 실패를 숨기지 않는다(단언 완화·skip·커버리지 제외·무차별 retry) | — | ○(거짓 통과) | 여전히 필요 | 유지 |
| 영향 범위를 확신 못 하면 넓힌다 | — | ○ | 여전히 필요 | 유지 |

### 3.2 배포판 Delivery (`templates/rules/ship-checklist.md`) — 변경 없음

| 문장(요지) | (a) | (b) | 모델 진화 시 | 판정 |
|---|---|---|---|---|
| 검증의 리듬(변경부 빠른 검사 → 씬 수정분 모아 독립 검토 → 통합·빌드·실사용) | △(기본 리듬) | ○(수정마다 전체 검증 반복 금지) | 더 좋아진다 — 좋은 모델은 이 리듬을 스스로 고르고, 문장은 과검증 쪽 실패를 막는다 | 유지(ADR-087 사용자 문안) |
| 머지 전 독립 검증 = 핵심 기능 · 되돌리기 어려운 것 · 돈·권한, 실행하지 않은 상태는 통과 아님 | — | ○ | 여전히 필요 | 유지 |
| 배포 전 풀 테스트·E2E·독립 검증, 같은 artifact, 배포 뒤 smoke | — | ○(거짓 출하) | 여전히 필요 | 유지 |
| 머지·게시 경로가 검증 통과에 의존해야 한다 | — | ○ | 여전히 필요 | 유지 |
| 도달 경로마다 실행 증거 따로 | — | ○ | 여전히 필요 | 유지 |
| 보안·취약점 검사 실행 | — | ○ | 여전히 필요 | 유지 |
| `spec-drift-check.sh ship` (설치된 검사기 안내) | — | ○(추적 문서 어긋난 출하) | 여전히 필요(도구 존재 안내) | 유지 |

결론: 두 배포 룰은 #451·#496 개정 이후 **목표·제약·관측 가능한 결과** 형태이고, 고정 절차만 남은 문장이 없다.

### 3.3 개발 사본 (`.claude/rules/`) — 3건 변경

| 문장 | 문제 | 변경 |
|---|---|---|
| `test-policy` §머지 전 독립 리뷰 문턱: "설치자에게 나가는 것(`templates/` · `src/` · 설치기 동작)" | 경로 문턱이 위험과 어긋남 — #478(헤더 숫자 1개)에 리뷰 6분·45 tool calls, #479(디스크 삭제)는 리뷰가 값을 함 | "설치자 디스크·공유 상태를 **되돌리기 어렵게** 바꾸는 변경 · 릴리즈 배선"(ADR-094) |
| `test-policy` 배포 행 "리뷰 **필수**" · `ship-checklist` "Review 게이트 통과" | 릴리즈 PR(#506·#510)은 CI 만으로 머지됐고 사용자가 승인 — 룰과 실무가 어긋나면 우회가 관행이 된다 | "릴리즈에 든 문턱 위 변경이 머지 전 리뷰를 받았는지 확인, 릴리즈 커밋 자체는 CI" |
| `test-policy` §Dev-Prod Parity(SQLite 금지·Postgres 동일) | 이 리포는 DB 를 쓰지 않는다(`check-absence` 탐지기 자기검증 후 0건) — 적용 대상 없는 상주 문장 | 제거(배포판의 "production-compatible dependencies" 문장이 일반형으로 남아 있다) |

## 4. 릴리즈 게이트 — 설치자 흐름 중 무엇을 지키나

| 게이트 | 지키는 것 | 게시 차단 |
|---|---|---|
| `test.yml` **ci** | typecheck·lint·1,5xx 테스트·커버리지·`npm run security`(baseline 대비 신규 0) | ○ (`needs`) |
| **docker-e2e** `dev-method-skills` | 고른 번들 스킬이 4 CLI 자리에 실재(템플릿 복사 + 외부 스킬) | ○ |
| **docker-e2e** `pinned-versions` | npm/npx-run 자산이 pin 한 버전으로 실제 설치 | ○ |
| **docker-e2e** `single-cli` | CLI 하나만 골라도 그 도구 자리에 온다(#370) | ○ |
| scenarios `anchor` | 신규·기존 CLAUDE.md 에 앵커 import 1줄, 본문 무손실 | 신호 |
| scenarios `antigravity-render` | `--cli antigravity` 산출물 섹션이 화면에 실제로 뜬다 | 신호 |
| scenarios `base-track` | `--track base` 가 스택 무관 자산만 | 신호 |
| scenarios `external-preserve` | 재설치가 codex/opencode 산출물을 백업 없이 덮지 않는다 | 신호 |
| scenarios `global` / `project` | `--scope` 가 홈·프로젝트 경계를 지킨다 | 신호 |
| scenarios `policy-preserve` | 재설치·update 가 사용자가 고친 룰/훅을 덮지 않는다 | 신호 |
| scenarios `smoke` | CLI·mock 도구·스냅샷 유틸 동작(다른 시나리오의 전제) | 신호 |
| scenarios `uninstall` | install → uninstall 되돌리기 | 신호 |
| scenarios `update-demoted-agents` | 옛 설치본 update 시 강등 에이전트 안내 | 신호 |
| scenarios `update-external` / `update-external-skills` | update 가 codex/opencode 산출물·외부 스킬을 갱신 | 신호 |
| scenarios `update-mcp-retire` | 은퇴 MCP 가 update 로 회수 | 신호 |
| scenarios `update-new-assets` | update 가 릴리즈로 추가된 자산을 설치(#283) | 신호 |
| scenarios `update-noninteractive` / `update-skills` | update 가 TTY 없이/위저드 경로로 `.claude/skills` 갱신 | 신호 |
| scenarios `workflow-scope` | 워크플로 자산이 `--scope project` 로 프로젝트에만(#492 퇴역 `--with` 2개 제거) | 신호 |
| scenarios `realcli-*` 3종 | 실 Antigravity·Codex·OpenCode 가 우리 파일을 알아본다 | 신호 |
| `install-matrix` install ×6 | OS×Node×pm 조합에서 tarball 설치 + 핵심 파일 3종 | 신호 |
| `install-matrix` multi-track / fail-loud | base·tooling·executive·data 설치 · 미지 트랙 exit≠0 | 신호 |

한 줄을 못 붙인 게이트는 없다. `smoke` 는 설치자 흐름이 아니라 다른 시나리오의 전제라 신호로 둔다.

## 5. 리뷰 문턱 대입

| PR | 변경 | 구 문턱(경로) | 새 문턱(ADR-094) | 실제 판정 |
|---|---|---|---|---|
| #478 (#476) | 설치 헤더 숫자 — 비-claude 설치가 안 깔리는 에이전트 2개를 셈 | `src/` → 리뷰 | 되돌리기 어려운 결과 없음 → **CI 만** | 리뷰 6분·45 calls 는 과했다 |
| #479 (#477) | update 가 설치자 디스크 파일을 지움 | `src/` → 리뷰 | 설치자 디스크를 되돌리기 어렵게 바꿈 → **리뷰** | 리뷰가 값을 했다 |
| 이 PR | `tests/` · `docs/` · `.claude/` · docker 시나리오 | 문턱 아래 | 문턱 아래 | CI 만 |

## 6. 보류 · 후속

- **사용자 결정 1건**: `tests/spec-anchor-preserved.test.ts`(리포 문서 해시 39줄) — `docs/SPEC.md` DO NOT CHANGE 절이
  이 테스트를 지목하므로 Major CR. 잣대로는 ③. 지우려면 SPEC 그 줄과 `docs/archive/README.md` 한 줄을 함께 고친다.
- `skill-trigger-overlap` 이 하던 description 유사도 검사는 **description 을 바꾸는 PR** 에서 한 번 돌린다(상시 아님).
  스크립트가 필요하면 그 PR 에서 `scripts/` 로.
- **커버리지 하한 88 → 86 (사용자 결정 2026-09-21)**: `context-cost.test.ts` 의 계측·순위표 단위 ~28건은 유지보수자 지표(`npm run cost:report`)라 ③인데, 걷으면 branches 가 하한 88 아래(실측 86.78)였다. 숫자를 지키려고 그 테스트를 남기는 것이 곧 "테스트를 위한 테스트"라 하한을 실측에 맞췄다(`vitest.config.ts` · `.claude/rules/test-policy.md` · CLAUDE.md · ship-checklist 동기화). 대안(계측 함수를 `scripts/` 로 옮겨 모집단에서 제외)은 src 리팩터라 미착수.
- #437(문구 단언 테스트)은 이 감사가 흡수 — 확정 시 닫는다.
- 효과 측정: 다음 사이클에서 "리뷰 레인이 돈 PR / 블로커를 낸 PR" 과 `npm run ci` 시간을 본다(ADR-094 Consequences).

# 하네스 6차원 감사 보고서 (2026-07-14)

> 방법: ultracode 다중에이전트 워크플로 — 6차원 병렬 근거감사 → critical/high 코드·설정 주장 16건 적대검증 → 종합
> 규모: 23 에이전트 · 1.63M 토큰 · 14분 · **검증 16/16 확정, 0 반박**
> 기준: v26.95.0 (npm 라이브) · 트리거: 사용자 "하네스가 제대로 구성됐나 + 개선점 검토"
> 관계: 전략 SSOT = [`service-audit-roadmap.md`](service-audit-roadmap.md) (M1~M6). 본 문서는 그 위에 2026-07-14 실측 델타를 얹은 **P0 실행 앵커**.

## 정직성 고지 (no-false-ship)

6개 감사 에이전트 중 **차원 4(문서/SSOT 현행성)** 하나가 실제 감사(180K 토큰·19 tool call)를 수행하고도 최종 산출을 스텁(`{"dimension":"test",...}`)으로 반환 → 전용 발견(README/USAGE grep 전수 대조 등) 유실. SSOT·Promise 핵심 이슈는 타 차원이 중복 포착해 아래에 반영됨. **차원 4 전용 재감사는 별도 실행**(2026-07-14, 본 문서 §7 부록에 추가 예정).

---

## 1. 종합 판정

**부분적으로 탄탄함 — 골격과 규율은 실재하나, 방어 차별화 축(security-vetted 큐레이션)이 코드·문서·계측 세 층에서 동시에 새고 있다.**

핵심 긴장 3개 (전부 `[CONFIRMED]`):
1. **빌드는 v26.95.0 라이브인데 게시(M2)는 ~5주째 미실행** — 그 창에서 오히려 7릴리즈(v26.88→95)를 더 빌드(launch-avoidance). "게시=신규코드0" 로드맵 정의를 스스로 위반.
2. **차별화 wedge인 "지속 검증 매트릭스"의 두 계측기가 2026-07-01부터 RED로 방치** — catalog-verify(Promise=Impl)·trust-tier-drift가 실제 결함(next-skills 설치실패 / gsd archived)을 잡았으나, 자동 매트릭스는 method-상속 배지라 여전히 🟢 광고 중. 도구는 작동, 후속조치 2주 부재.
3. **4-CLI 대칭이 코드에 없다** — plugin-kind 자산 ~25/61(약 41%)이 claude 전용, codex 단독 설치조차 `claude plugin install`을 무가드 spawn. "across 4 CLIs" 헤드라인이 절반의 자산에서 거짓.

정직 인프라(no-false-ship 룰, COMPATIBILITY 자기제한 장부, init-throw 가드)가 이 감사가 drift를 잡아내게 해준 강점. 문제는 그 규율을 **메타 하네스와 게시 자료가 스스로 위반**한다는 점.

## 2. 강점 (유지할 것)

| 강점 | 근거 |
|------|------|
| 컴파일-강제 확장성 가드 | method.kind exhaustive switch 5곳 default 없음 + tsconfig strict/noFallthrough. category=init-throw, tier=derive |
| 정직한 재포지셔닝(ADR-021) | "설치=table-stakes" 자인, NORTH_STAR:45 "콘텐츠 스캔 미실행" 자수, index.html:85 "Vetted ≠ a security audit" |
| Docker 실-바이너리 검증 인프라 | verify-catalog.mjs + catalog-verify.yml — 경쟁사가 못 가진 복제 난이 sub-wedge |
| coverage 게이트 결정론 강제 | branches 88 == vitest.config.ts:21, npm run ci 실차단 |
| 훅 exit-2 차단기 + jq→grep 폴백 | docker-only-realcli.sh 등 7개 훅 shellcheck exit 0 |

## 3. 개선점 (우선순위별)

### P0 — 게시 전 반드시

**[4cli-asymmetry-cluster]** plugin 자산 ~41%가 비-claude CLI 미도달 + 무가드 호스트 오염 `✓CONFIRMED`
- 근거: `installOne` plugin 분기(external-installer.ts:182)가 `ctx.cli` 무참조 → `installPlugin`(:290-311) `claude plugin marketplace add/install` 하드코딩. `EXTERNAL_ASSETS`에 `cli` 필드 부재. `runExternalPhase`(installer.ts:524-554) claude 가드 없음. `filterApplicableAssets`(external-assets.ts:1135-1144) cli 축 미필터
- NSM: Cross-CLI Parity + Promise=Implementation 위반. 프로젝트 룰(무동의 글로벌 write 금지)도 위반
- 제안: `ExternalAsset.cliSupport: CliBase[]` → 선택 CLI 교집합 필터 + "plugin N개 claude 전용 제외" 명시 (로드맵 SCALE-1)

**[cli-external-path-untested]** 위 결함 무테스트라 branches 88로도 못 잡힘 `✓CONFIRMED`
- 근거: installer-cli-matrix.test.ts 7조합 전부 `runExternal=null` 스킵. codex 단독→claude spawn 검증 0
- 제안: spawn mock 주입 "codex 단독 시 spawn 인자에 claude 부재" RED 고정 (Rule 9)

**[catalog-verify-red]** Promise=Impl 계측기 2주째 RED, 문제 자산 여전히 🟢 광고 `✓CONFIRMED`
- 근거: gh run 28511468217(2026-07-01) exit 1 "next-skills 설치실패". external-assets.ts:763-770 잔존, COMPATIBILITY.md:78 "🟢 Docker". gen-compatibility.mjs가 method.kind 정적맵이라 실설치 실패 미반영. index.html:85 "generated from real install runs" 부정확
- 제안: catalog-verify 결과 JSON → gen-compatibility 입력 배선 + next-skills 제거/수정 + schedule 실패→issue 자동생성

**[kit-overclaim]** 게시 자료가 README 정정 미추종 → 과장 박제 `✓CONFIRMED`
- 근거: adoption-c2-submission-kit.md:57,76 "every install method verified by real install in Docker" + :34 "across 4 CLIs" ↔ COMPATIBILITY 51/61 + CLI 비대칭. README.md:13은 이미 fix됨
- 제안: README 정정문 이식 + `grep -rniE 'every install method|across.*4 CLIs' docs/research/` CI 가드

### P1 — 게시 병목 해소 + 메타 정직성

**[security-audited-overclaim]** "보안 감사된" 헤드라인 > 실제(인기+설치검증), 콘텐츠 스캔 0 `✓CONFIRMED`
- 근거: NORTH_STAR:20 / ADR-021:22 "보안 감사된(security-vetted)" ↔ SECURITY.md:37-43·README:13·index.html:85 "not a prompt-injection scan". scripts/·workflows 콘텐츠 스캔 0건
- **결정(2026-07-14): "출처 검증된(source-verified; 콘텐츠 감사는 로드맵)"으로 톤다운**

**[trust-tier-drift-red]** archived 자산이 vetted 라벨 유지 `✓CONFIRMED`
- 근거: gh run 28509321419 "gsd-orchestrator … ❌ demote (archived)". external-assets.ts:936-937 tier:vetted 유지. trust-tier-drift.ts:32 STAR_THRESHOLD=1000 순수 star라 archived 미필터
- 제안: gsd tier 재판정 + vetting 기준에 archived/last-commit age 포함

**[agentshield-gate-missing]** 문서가 존재하지 않는 훅을 "차단한다"고 서술 `✓CONFIRMED`
- 근거: COMPATIBILITY.md:26 "agentshield-gate.sh(PreToolUse hook) CRITICAL 차단" ↔ 활성 .claude/hooks/ 부재(ADR-023 6-Gate 제거 시 삭제, 문서만 drift)
- 제안: "수동 npx ecc-agentshield scan; 자동 게이트 미배선"으로 정정(저비용)

**[meta-doc-drift]** 하네스가 자기 문서에서 no-false-ship 위반 `✓CONFIRMED`
- REFERENCE.md:158: 팬텀 훅 3종(gate-check/agentshield-gate/codebase-map) "자동 등록" 광고, 실존 docker-only/hito-counter 누락(~80릴리즈 stale)
- CLAUDE.md "Active Rules(11개)": 헤더 11 ≠ 표 10행, 유령 룰 3종(commit-policy/ecc-git-workflow/ecc-testing) ↔ 실존 3종(gates-taxonomy/playwright-launch/test-policy) 누락
- NSM: 에이전트가 매 세션 읽는 룰 SSOT — 틀리면 공유 어휘 붕괴
- 제안: `ls .claude/{hooks,rules}/` 파생 재작성 or exhaustiveness 테스트로 npm run ci 차단

**[ssot-stale-inflates-blocker]** 끝난 C-2/B-5가 SSOT에 '잔여'로 박제 `✓CONFIRMED`
- 근거: C-2 해소 커밋 181fc8d(#167, 2026-06-13) ↔ service-audit-roadmap.md:33 여전히 '◐'
- 제안: 해소커밋 참조로 체크 처리 → M2 blocker를 실제(kit 정정 + 제출클릭)만 남김

### P2 — 유지보수/저심각 (미검증 판단)

| 슬러그 | 요지 |
|--------|------|
| scale5-cli-transform-dispatch | runCliTransforms if-체인 → 5번째 CLI 조용히 누락. Record 테이블 승격 |
| primary-nsm-unmeasured | HITO≤3·Re-clarif≤5% 자동계측 불가·외부사용자 0 → dogfood baseline 축소 표기 |
| cross-cli-parity-3of4 | installer-cli-matrix가 antigravity 제외 3-CLI + 파일생성만 검증 |
| no-prewrite-preview | install --dry-run 부재(uninstall만 존재) |
| ssot-count-drift | 자산 수 문서마다 58/61/62 상이. external-assets.ts derive + 테스트 가드 |
| function/file-cap | renderPhase1Rows 163줄(cap 50), external-assets.ts 1144줄(cap 800, 주석 "802줄" stale) |
| dead-hooks/dup-rules | 미배선 checkpoint 훅·글로벌↔프로젝트 12룰 byte-identical 중복·비적용 웹룰 상주 |

## 4. 전략적 다음 방향

**병목은 "게시"이고, 게시를 막는 건 기술이 아니라 (a) launch-avoidance와 (b) 헤드라인 wedge의 반쪽 상태다.**

가장 레버리지 큰 한 수 — "게시 서두르기"가 아니라 **"게시 전 wedge를 실증 영수증으로 전환한 뒤 게시"**:
1. feature 릴리즈 동결 → P0 4건 → 반자동 M2 게시. 게시 훅 = "Cisco 26%/Snyk 36% 취약 시대에 자산 전수 Docker 실설치 + 지속 재검증 영수증 공개"
2. 차별화를 "vetted"(복제 가능) → "continuously re-verified + 공개 영수증"(복제 난이)으로 좁힌다. *(주의: 현 cadence 월1회 cron이라 "지속/상시"는 미구현 — 구현 전까지 "codified/repeatable"까지만 주장)*

로드맵 순서(M1→M2)는 옳다 — 반쪽 wedge로 먼저 게시하면 첫 반례가 신뢰를 즉사시킨다. P0가 바로 "반례 제거".

## 5. 제안 기능 (North Star 4-gate 통과분만)

| 기능 | 크기 | 근거 |
|------|------|------|
| ① 자산 콘텐츠 보안 영수증 | M | Docker verify가 이미 clone하는 경로에서 정규식(exec/curl\|bash/base64/credential) 1회 스캔 → `.harness-security.json`. wedge 반쪽 채우는 게시 훅 |
| ② ExternalAsset.cliSupport 데이터 축 | M | COMPATIBILITY·홍보문 derive → "4-CLI" 약속 정직화. P0 4-CLI 클러스터 구조적 해법 |
| ③ install --dry-run | S~M | uninstall --dry-run 대칭. Phase 2(First-Run≥95%) 직결 저비용 레버 |
| ④ SSOT 수치 derive 가드 | S | 자산 수 external-assets.ts derive + docs-supply-chain.test 대조(CHANGELOG 게이트 패턴) |

## 6. 실행 결정 (2026-07-14, 사용자)

| 결정 | 선택 |
|------|------|
| 게시(M2) 시점 | **P0 4건 처리 후 이번 주기 게시** |
| "보안 감사된" 문구 | **'출처 검증된'으로 톤다운** (콘텐츠 스캔은 로드맵) |
| 4-CLI 비대칭 범위 | **데이터축(cliSupport) + 고지 = 정직화**. 대칭 실현(plugin→codex 등가, L)은 M4+ 유지 |
| 보존 | 본 문서 저장 + 차원 4 재감사 |

### P0 실행 시퀀스 (feature branch + PR per git-policy)

- **Batch 1 (docs 정직화, no code, 저위험)**: 보안 문구 톤다운(NORTH_STAR:20·ADR-021:22 "보안 감사된"→"출처 검증된") · kit 과장 정정(adoption-c2-submission-kit) · meta-doc drift(CLAUDE.md Active Rules 표·REFERENCE.md:158 훅 목록 실측 재작성) · SSOT stale(roadmap ◐→해소 체크 + 버전헤더 v26.87→95) · agentshield-gate 문구 정정
- **Batch 2 (계측 정직화, CI)**: catalog-verify RED → next-skills 제거/수정 + gen-compatibility 실설치 반영 배선 + gsd archived tier 재판정 + kit-overclaim grep 가드
- **Batch 3 (4-CLI 데이터축, code) ✅ 완료 = v26.102.0** (2026-07-17, PR #208 `c95018a`, npm 라이브, ADR-031): 원안의 "cliSupport 필드"는 **derive 로 대체**(`assetCliSupport()` — method.kind 판정 + `cliSupportOverride` 예외: bmad `--tools claude-code`, SOD 리뷰 Critical-1 실측 반증) · 교집합/가드 = `selectExternalTargets()` 단일 selector (runExternalInstall spawn 배제 + 헤더 카운트 정합) · 제외 고지 = `excludedByCli` 필수 필드 → Phase 2·Summary EXCLUDED·ASSETS 분해 3표면 · `tests/cli-external-path.test.ts` RED 실증 +15 · SSOT 수치 derive 가드는 Batch2(#199) 기충족, COMPATIBILITY CLI 열 전수 게이트 추가
- **→ M2 게시** (반자동: 폼=에이전트 / 제출=사용자)

## 7. 부록 — 차원 4 재감사 (문서/SSOT 전용, 2026-07-14 재실행)

> 유실됐던 차원을 general-purpose 에이전트로 재실행(79K 토큰·12 tool call). 실측 카탈로그 = **61 자산**(tests/external-assets.test.ts:136 + external-assets.ts `id:` 61개 이중확인).

**요약**: README.md·COMPATIBILITY.md·CHANGELOG은 v26.95.0 현행이나, **공개 랜딩(index.html)과 전략 SSOT(roadmap)는 "58" 스냅샷에 묶여 3자산(marketingskills/frontend-design/gemini-consult)만큼 뒤처짐**. ship-checklist:17 "SSOT 동기화" 게이트가 체크박스뿐 테스트 백업이 없어 그것이 막겠다던 drift("48 vs 58")가 "58 vs 61"로 재발.

**강점**: CHANGELOG 현행성은 구조적 보장(docs-supply-chain.test:47-54, #197) · README/COMPATIBILITY 카탈로그 수치 정확·정합(51/61) · COMPATIBILITY:159 4-CLI 비대칭 정직 자인 · README.ko는 수치 무기입 → drift 불가(안전 설계).

**신규 Findings**:

- **[landing-page-count-stale]** high — 공개 랜딩이 총계·green 둘 다 옛 숫자
  - 근거: index.html:83 `Docker install-verified (49/58 green)` ↔ 실측 총계 61 / README green 51. 총계 −3·green −2 이중 stale
  - NSM: Promise=Impl + M1("0초~첫 설치 광고≠실동작 제거"). 0★ cold-start 첫 접점이 틀린 수치
  - 제안: index.html 수치를 README/COMPATIBILITY 동일 SSOT에서 derive(3표면 하드코딩 중 → 단일값 참조)

- **[roadmap-ssot-8-release-drift]** high — 전략 SSOT 8릴리즈 뒤처짐 + 게이트 미준수
  - 근거: roadmap 헤더 "기준 v26.87.0", 본문 "58 자산" ×3(:15·:113·:115) ↔ 실측 61. ship-checklist:17 게이트가 경고한 drift가 v26.91/92/95 추가로 재발
  - 제안: 체크박스 반복실패 → **테스트 승격** — "roadmap 자산 수치 == EXTERNAL_ASSETS.length" assert(docs-supply-chain.test 방식). (Batch 2로)

- **[workflows-equal-install-overclaim]** medium — WORKFLOWS.md:5 "4 CLI에 동등 설치"인데 plugin-kind는 Claude 전용
  - 근거: WORKFLOWS.md:5 "…4개 CLI에 동등 설치" ↔ COMPATIBILITY:159 "plugin→Claude primary" 자인. README.md:198,206은 정확히 skill-kind로 한정하는데 WORKFLOWS만 과장
  - 제안: WORKFLOWS.md:5를 "skill/rule은 4 CLI, plugin 계열은 Claude 우선"으로 한정

- **[todo-header-7-release-stale]** medium — todo.md:3,20 헤더 v26.88.0 (단 :24 "32건"은 Phase 1 역사기록, drift 아님)
  - 제안: todo.md 실질 non-활성이면 버전 스탬프 제거 or roadmap과 함께 bump

- **[readme-ko-abridged-missing-assets]** low — README.ko가 gemini-consult/frontend-design/dev-method id 표 전무(축약본, 거짓은 아님)
  - 제안: 신규 1st-party 자산 한 줄 반영 or "전체 목록 REFERENCE.md" 링크 상단 배치

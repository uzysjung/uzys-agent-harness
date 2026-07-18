# 라이프사이클 자산화 실행 큐 (2026-07-18)

> 사용자 지시(2026-07-18): "기본적으로 클로드 프로젝트 진행할 때 지켜야 할 것들 — 북극성 지표,
> 제품 아이디어, 아이디어 검증, 리서치, 제품 문서화, 기능 스펙화, 로드맵/마일스톤/TODO(자주
> 바뀌어도 현행화), 개발 후 V&V, 실제 브라우저 실검증, BDD/TDD 테스트를 CI로 깃헙에 등록 —
> 내가 dyld_vantage, GoalTrack 에서 진행하는 것들이 녹아들어가도록. **이 부분들이 지켜지는 것이
> 하네스다.**"
>
> 근거 = 두 프로젝트 읽기 전용 실무 감사 (2026-07-18, 쓰기 0건 — 원문 요약은 아래 §감사 결론).

## 실행 큐 (교차 랭킹 — 각 건 SOD 리뷰 + 릴리즈 단위 출하)

| # | 자산 | 내용 | 실무 증거 | 상태 |
|---|---|---|---|---|
| ① | **doc-governance 룰** + spec-drift 훅 보강 | SSOT 위계(NORTH_STAR▸SPEC▸PRD▸TODO▸README) + "한 사실 한 곳" + **merge = 코드+추적 동기화 의무** + 현행/archive 분리. COMMON_RULES(전 트랙). 훅에 gate-status 정합 검사 백포트 | GT `.claude/rules/doc-governance.md` (실운영 검증) + spec-drift-check.sh ship 게이트 | ✅ v26.107.0 |
| ② | **CI 스캐폴드** | `.github/workflows` fill-in 템플릿 3종(ci.yml node / ci-python.yml / e2e.yml) — 실DB 서비스 컨테이너(test-policy Dev-Prod parity)·tag-only 트리거+로컬 검증 1차·E2E(playwright)·coverage 게이트. **opt-in 전용**(`--with ci-scaffold`) + 기존 파일 no-clobber + uninstall 미접촉 | GT ci.yml/e2e.yml (실Postgres·RLS 게이트) / dyld = **CI 0** 이 갭의 존재 증명 | ✅ v26.108.0 (ADR-037) |
| ③ | **benchmark-parity 룰 + gap.md 스키마** | capture→core→completeness→improve 루프, 레퍼런스 N개, PR "## Fidelity" 섹션, gap.md 표(ID·Severity·근본원인·증거·수정안·상태) | GT `.claude/rules/benchmark-parity.md` + docs/research 19회 실행 | 대기 |
| ④ | **north-star 스킬 보강** | metric-as-proxy(측정 불가 목표의 대리 지표 명시)·Pillars+모듈↔pillar 맵·Non-Goals | dyld NORTH_STAR.md 구조 + GT 4-gate 휴리스틱 (기존 스킬에 주입) | 대기 |
| ⑤ | **V&V verdict 타입** | fresh-instance 검증의 판정 어휘 코드화: PASS / PASS_WITH_NITS / FAIL + CRITICAL~LOW. verification-loop·model-orchestration 에 주입 | dyld PRD 이력 (V&V 가 실회귀 검출한 기록 다수) | 대기 |
| ⑥ | **템플릿류** | dogfood report(심각도표+재현)·리서치 원장("N confirmed·M killed"+기각 사유+caveat)·eval spec(Cn/Rn/pass@1) | dyld dogfood-output/report.md·ROADMAP §7·.claude/evals/ | 대기 |

**안티패턴 (코드화 금지):** SQLite-in-test vs Postgres-prod (dyld 실사례 — test-policy 위반) ·
계기 없는 프로즈-only 현행화 (dyld — 작동하나 GT 의 훅 게이트가 상위 형태).

## 감사 결론 (교차 요약)

| 라이프사이클 단계 | GoalTrack | dyld_vantage | 하네스 반영 |
|---|---|---|---|
| 북극성 지표 | NORTH_STAR+NSM(HITO) | metric-as-proxy+Pillars | ④ |
| 아이디어 검증/리서치 | ⚠ 벤치마크형만 | 딥리서치 원장(22 confirmed·3 killed) | ⑥ (시장/사용자 검증은 양쪽 모두 갭 — 1인 dogfooding 모델) |
| 문서화/현행화 | doc-governance+drift 훅 | 3-doc triad+docs: 커밋 페어링 | ① |
| V&V | 6-gate+reviewer 에이전트 | fresh-opus verdict 의식 | ⑤ |
| 브라우저 실검증 | playwright-launch+gap.md | dogfood report+diag/repair | ③⑥ (launch 룰은 기배포) |
| BDD/TDD→CI | **BDD 35+parity 20 specs, 실DB CI** | **CI 0·BDD 0** | ② |

## 원칙

- 기존 배포 자산과의 중복 금지 — 이미 있는 것(playwright-launch·north-star·spec-drift 훅·
  test-policy·ship-checklist)은 **보강**이지 신설이 아니다 (①에서 훅·spec-scaling 기존 배포 확인).
- 각 자산은 도메인 중립으로 일반화 — 프로젝트 고유명(GoalTrack/Linear 등)은 예시로만.
- Surface parity + no-false-ship: 설치 경로별 증거, 미검증 명시.

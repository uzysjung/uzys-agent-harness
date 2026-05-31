# Todo — 현재 목표 & 상태

> **갱신**: 2026-05-31 (v26.70.3 기준)
> **목표 anchor**: [`docs/NORTH_STAR.md`](NORTH_STAR.md) (왜·어디로) · **이력**: [`CHANGELOG.md`](../CHANGELOG.md)
> **Foundation(v26.38) 상세 완료 기록**: [`docs/archive/phase1-foundation/`](archive/phase1-foundation/)
>
> 본 파일은 6-Gate 워크플로우 활성 경로 (`gate-check.sh` 존재 확인 + `spec-drift-check.sh` unchecked 파싱).
> `/uzys:plan` 실행 시 새 사이클 내용으로 덮어써진다. 열린 목표는 ship gate drift 를 피하려 비체크박스로 둔다.

---

## 현재 상태 (2026-05-31)

- **버전**: v26.71.0 (main). CLI rewrite era 누적 (gh 전체 총계와 별개) / 644 tests / branches 88.45%.
- **활성 작업 사이클**: 없음 (idle). 다음 feature 착수 시 `/uzys:spec` → `/uzys:plan` 으로 재생성.
- **CI 정책**: GitHub Actions 는 릴리스 태그(`v*`) push 시에만 (v26.70.3). 로컬 `npm run ci` 가 1차 게이트.

---

## 완료된 마일스톤 ✅

- [x] **Foundation (v26.38)** — Phase 1~F. bash setup-harness.sh → TypeScript CLI rewrite, 등가성 복원. (상세: `archive/phase1-foundation/`)
- [x] **CLI rewrite 완결 (~v26.55)** — 11 Track × CLI 매트릭스, 외부 자산 32건, Router 분기, 환경 파일, all-in-one wizard, ECC opt-in gating (ADR-015/016).
- [x] **Install UX 재설계 (v26.56~63)** — 5-step 통합 wizard, 카테고리 페이지네이션, 자산 description 보강, 영어 통일.
- [x] **Project-scope default + Global opt-in (v26.64, ADR-020 BREAKING)** — 모든 자산 default project, global 명시 opt-in, install log + `claude-harness uninstall`.
- [x] **Codex / OpenCode / Antigravity 호환 (~v26.70)** — 4번째 CliBase(Antigravity) 포함. AGENTS.md / `.agents/` / `~/.gemini/` 산출. 6-Gate workflow opt-in.
- [x] **코드 품질 (v26.70.1~3)** — 코드리뷰 버그 9건 fix, cleanStaleHookRefs 단순화, GitHub Actions 태그 트리거 전환.
- [x] **검증 Trust Tier + 적극 권장 (v26.71.0, PRD v26-71)** — Trust Tier(official/vetted/experimental, T2=star≥1000) 분류 + Recommended 배지·우선정렬 + experimental opt-in. North Star 세 기둥 ②.

---

## 열린 목표 (Phase 2 — Adoption Loop)

> 출처: [`docs/research/next-steps-2026-05-31.md`](research/next-steps-2026-05-31.md) (RICE 재정렬) · [`docs/phase-2-backlog.md`](phase-2-backlog.md) · [`docs/decisions/ADR-001`](decisions/ADR-001-phase2-entry-criteria.md)
> NSM(North Star Metric): **HITO ≤ 3 prompts/feature** (현재 baseline ~20 = N=1·하네스 자체 빌드 측정 → 측정 대상 불일치. 외부/통제 dogfood 필요)
> **2026-05-31 재정렬**: North Star Statement 재정립(설치 서비스 본질) 반영 → RICE 1위 **C2(설치 매트릭스)를 P2-01 앞에 배치**. 근거: 설치가 본질 + solo 측정 가능 + P2-01 선행 병목.

- **C2 — fresh-env 설치 매트릭스 CI** (next, 최우선 / RICE 600)
  - Linux·macOS × Node 20/22 × npm/pnpm 매트릭스. First-Run Success ≥95% 직결. `/uzys:spec` 진입 대기
- **B2+B1 — 4-CLI 실환경 검증** (pending / RICE 213+128)
  - Codex `.codex/prompts/` 실 Codex 인식 + Antigravity 실환경 동작 검증. Promise=Implementation 봉합(F3)
- **P2-01 (=C1) — fresh-dogfood HITO 실측** (pending / RICE 300)
  - **방식 확정(2026-05-31): 자기 fresh-dogfood 프록시**. clean env에서 하네스로 새 throwaway 서비스 1건 완주 + 정직한 HITO/feature 첫 측정. 외부 사용자 실측은 Phase 3 신호로 이월
- **A1 / A2 — 큐레이션 신선도·정직성** (pending / RICE 400·240)
  - A1 Trust Tier star-drift CI(정적 라벨→자동 fetch) · A2 37 자산 설명 Promise audit
- **P2-02 — NSM per-feature 자동화 Step 2** (보류 / RICE 16)
  - session-level까지(`scripts/nsm-aggregate.sh`). per-feature 매핑은 **C1 외부 baseline 후** 재평가
- **P2-04 — Dependency major bump** (pending / RICE 10)
  - Step 1 (@types/node + biome) → 2 (cac + @clack) → 3 (typescript 6) → 4 (vitest 4)
- **재정의 필요**: E2 branch-protection (CI 태그-온리 전환으로 status-check 전제 소멸 → 의미 재정의 먼저)

---

## 완료 조건 (현 사이클)

활성 사이클이 없으므로 unchecked 항목 없음 (ship gate clean). 새 feature 착수 시 `/uzys:plan` 이 본 파일을 재생성한다.

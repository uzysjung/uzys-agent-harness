# ADR-010: Category-based Installer Repositioning

- **Status**: Accepted
- **Date**: 2026-05-14
- **PR**: #69 (v26.43.0 Phase A), #70 (v26.44.0 B/D/E/F), #71 (v26.45.0 C MVP)
- **Supersedes**: 없음
- **Related**: ADR-009 (addy opt-in), ADR-011 (uzys-harness opt-in), `docs/specs/category-installer.md`

## Context

uzys-claude-harness 의 정체성이 **Track 기반 (기술 스택 묶음 강제 매핑)** 으로 출발. 11 트랙 선택 → 각 트랙이 미리 정의된 자산 set 자동 설치.

문제:
1. **트랙 → 자산 매핑이 블랙박스**: 사용자가 `csr-supabase` 선택했을 때 어떤 자산이 왜 깔리는지 추측해야 함.
2. **출처 불투명**: shadcn-ui, supabase-skills, polars 등이 어느 org/user 에서 오는지 표시 없음 — 신뢰성 판단 어려움.
3. **Anthropic / Vercel / Supabase 공식 자산이 3rd-party 자산과 무차별**: 출처 신뢰도가 UI 에 반영 안 됨.
4. **자체 워크플로우 (`/uzys:*`) 도 dev 트랙 자동 설치**: 본 harness 가 자기 자신을 강제 push 하는 셈.

## Decision

설치 도구의 정체성을 **분야별 (Category) 대표 스킬 큐레이터** 로 재정의.

### 핵심 변경

1. **7 카테고리** 정의 (`src/categories.ts`):
   - 🎨 Frontend / 🗄️  Backend / 📊 Data / 💼 Business / 🛡️  Dev Tools / 🔄 Workflow / 📦 ECC Suite
2. **모든 자산에 정확한 출처 라벨** (`ExternalAsset.source`):
   - `anthropics`, `vercel-labs`, `supabase`, `obra`, `alirezarezvani` 등 19 출처.
   - Generic `[3rd-party]` 라벨 금지.
3. **2-Step 흐름**:
   - Step 1: Preset (= legacy track) 선택 — `csr-supabase`, `data` 등 11개 보존.
   - Step 2: 카테고리별 옵션 multiselect with 출처 라벨 (`@clack/prompts` `groupMultiselect`).
4. **자체 워크플로우 (`uzys-harness`) opt-in**: ADR-011 참조. 본 harness 가 자기 자신을 default push 안 함 → 중립적 인스톨러.

### Phase 분해

- Phase A (v26.43.0): `categories.ts` + `ExternalAsset.{category,source}` 메타데이터 (scaffolding only)
- Phase B (v26.44.0 일부): `preset-recommend.ts` — preset → 추천 자산 매핑
- Phase C MVP (v26.45.0): Step 2 카테고리 grouping + `[source]` 라벨
- Phase D (v26.44.0): `uzys-harness` opt-in (ADR-011)
- Phase E (v26.44.0): `superpowers` (obra) 신규 자산 추가
- Phase F (v26.44.0): `--with-uzys-harness` / `--with-superpowers` CLI flag

## Alternatives

- **(a) Track 모델 유지 + UI 만 개선** (출처 라벨만 표시). 기각: 트랙 → 자산 매핑 블랙박스 문제 미해소.
- **(b) Track 개념 완전 제거, 카테고리만 사용**. 기각: 매번 N개 항목 선택 = 사용성 저하. Preset shortcut 으로 보존이 합리적.
- **(c) Step 2 에서 모든 external assets 도 직접 toggle 가능** (사용자 원본 mockup). **부분 채택** — MVP 는 OPTION_DEFS 만. external assets toggle 은 별도 phase (architecture 큰 변경: `ExternalAssetCondition` 모델 확장).

## Consequences

### 긍정
- 자산 출처 투명 — 사용자가 검증된 출처(Anthropic/Vercel/Supabase) vs 3rd-party 의식적 구분 가능.
- 7 카테고리 mental model — Frontend / Backend / ... 직관적.
- Preset 으로 빠른 시작 + 카테고리로 세부 조정 (점진적 진입).
- 본 harness 가 중립 인스톨러 포지셔닝 — 자체 워크플로우 강요 X.

### 부정
- BREAKING 다수 (ADR-009 addy, ADR-011 uzys-harness).
- SPEC §3.1 자산 분류 오류 발견 후 정정 (c-level/business-growth/finance 출처 = alirezarezvani, anthropics 아님).
- Phase C 완전판 (external assets 직접 toggle) 은 보류 — 사용자 mockup 의 일부만 실현.

### 완화
- Release notes + CHANGELOG + ADR 3건 (009/010/011) 으로 BREAKING 안내.
- `--with-uzys-harness` 한 줄 migration.
- Phase C MVP 로 절반 효과 즉시 land + 완전판은 별도 SPEC 으로 분리.

## Notes

사용자 결정 R1-R7 (`docs/specs/category-installer.md` §3.5):
- R1: uzys-harness opt-in
- R2: Track = Preset shortcut 유지
- R3: superpowers = obra/superpowers (Anthropic 공식 marketplace 등록)
- R4: 전체 사이클 한 세션 진행
- R5: Step 2 = 추천 ✓ 미리 체크 + unchecked 가능
- R6: 출처 라벨 정확 (GitHub org/user)
- R7: withUzysHarness track 무관 opt-in

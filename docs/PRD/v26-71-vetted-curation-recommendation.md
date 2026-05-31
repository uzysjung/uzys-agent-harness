# PRD: 검증 자산 큐레이션 + 적극 권장 (Vetted Curation & Active Recommendation)

> **Created**: 2026-05-31
> **Status**: Implemented (v26.71.0, 2026-05-31 — TRUST_TIER + wizard 배지/정렬 + experimental opt-in. 644 tests)
> **North Star**: 세 기둥 ② "검증된 자산 큐레이션 + 사용자 선택권" 강화 ([`../NORTH_STAR.md`](../NORTH_STAR.md))
> **Trigger**: 사용자 redirect (2026-05-31) — "검증된 플러그인/스킬을 사용자가 **이해·선택**해 설치, 권장은 **적극 어필**."

---

## 1. 배경 (현재 상태)

- 자산(`src/external-assets.ts`)은 `source`(출처: anthropics / wshobson / trailofbits / obra 등 18종)를 명시하나, **"검증됨"의 객관적 기준이 없다** — 사용자는 출처 이름만 보고 신뢰를 추정.
- 추천(`recommendedExternalAssets`)은 track condition 기반 **pre-check** 만 한다. **Recommended 배지·우선 정렬·권장 근거가 없어** "적극 어필"이 약하다.
- 결과: North Star ②의 "이해하고 선택" + "적극 권장" 이 부분적으로만 구현됨.

## 2. 목표

1. **검증 기준 명문화** — 각 자산을 객관적 **Trust Tier** 로 분류, 판정 기준을 문서·코드로 재현 가능하게.
2. **적극 권장** — 권장 자산을 **배지 + 우선 정렬 + 근거 한 줄** 로 강하게 어필. 단 **강제 아님** — 사용자 토글 선택권 + Promise=Implementation 유지.

## 3. 요구사항

| ID | 요구사항 |
|----|---------|
| **R1** | Trust Tier 3단계 정의: **T1 Official** / **T2 Vetted** / **T3 Experimental** |
| **R2** | 모든 `EXTERNAL_ASSETS` 에 trust tier 라벨 부여 (메타 필드) |
| **R3** | tier 별 판정 기준을 rule(`.claude/rules/`) 또는 PRD 에 명문화 — 재현 가능 |
| **R4** | wizard 에서 권장 자산을 **Recommended 배지 + 카테고리 내 상단 정렬** 로 표시 |
| **R5** | 각 권장 자산에 **"왜 권장"** 근거 1줄 (track 적합성 + tier) |
| **R6** | **T3(Experimental)** 는 경고 표시 + opt-in (pre-check 안 함) |

## 4. Trust Tier 기준 (제안)

| Tier | 기준 | 기본 동작 |
|------|------|-----------|
| **T1 Official** | Anthropic 공식(`anthropics/*`) + 본 하네스 자체 자산 + 명시된 공식 marketplace(ecc / superpowers 등) | 권장 = pre-checked + 배지 |
| **T2 Vetted** | 활성 유지보수(최근 12개월 내 commit) AND 커뮤니티 신뢰(**star ≥ 1000**) AND OSI 라이선스 AND 보안 스캔 clean | track 적합 시 권장 |
| **T3 Experimental** | 위 미충족 / 신규 / 검증 데이터 부족 | opt-in only + 경고 |

## 5. Non-Goals

- **실시간 동적 검증** (매 install 마다 GitHub API 호출) — 성능·rate limit·오프라인 실패. 정적 라벨 또는 빌드타임 스냅샷으로.
- **본 프로젝트가 자산 코드를 직접 보안 감사** — 출처 신뢰 + 공개 신호(star/유지보수/스캔)를 활용할 뿐, 코드 감사 대행 아님.
- **자산 강제 설치/차단** — 선택권 유지. T3 도 경고 후 사용자가 원하면 설치 가능 (Promise=Implementation: 권장 ≠ 거짓 광고, 차단 ≠ 검열).

## 6. Resolved Decisions (2026-05-31 사용자 결정)

- **D1 (OQ1) — 검증 데이터 출처**: **(A) 정적 수동 tier 라벨**. 각 자산에 tier 직접 지정 (`external-assets.ts`). drift 는 분기 재검토로 관리. 동적 API 호출 안 함 (오프라인·rate limit 회피).
- **D2 (OQ2) — T2 임계값**: **star ≥ 1000** AND 최근 12개월 내 commit AND OSI 라이선스. (정적 라벨 시점에 1회 확인, 분기 재검토). 엄격 기준 — 대다수 커뮤니티 자산은 T3 로 분류될 수 있음.
- **D3 (OQ3) — 적극 어필 수위**: **(b) 배지 + 우선 정렬**. Recommended 배지 + 카테고리 내 상단 정렬. T3 도 목록에 보임 (선택권 유지, collapse 안 함).
- **D4 (OQ4) — 초기 tier 분류**: 에이전트가 각 source 의 실제 star/유지보수를 확인해 1차 분류 → 사용자 검토. 분류 근거는 SPEC 또는 `external-assets.ts` 주석에 기록.

## 7. 성공 기준 (AC)

- **AC1**: 모든 EXTERNAL_ASSETS 에 trust tier 라벨 (누락 0).
- **AC2**: tier 판정 기준이 문서에 명문화 — 제3자가 같은 자산을 같은 tier 로 재현 가능.
- **AC3**: wizard 에서 권장 자산이 배지 + 상단 정렬로 표시 (사용자가 권장임을 즉시 인지).
- **AC4**: T3 자산은 경고 + opt-in. 강제 차단 0건 (선택권 유지).
- **AC5**: README/USAGE 에 Trust Tier 개념 반영 (사용자가 tier 의미 이해).

## 8. 다음 단계

OQ1~OQ4 사용자 결정 → SPEC(`docs/specs/`) 작성 → Plan → Build. 본 PRD 는 방향 합의용 Draft.

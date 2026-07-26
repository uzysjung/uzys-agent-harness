# Test Policy

## Coverage Thresholds (Track-Specific)

| 영역 | 최소 커버리지 | 적용 Track |
|------|-------------|-----------|
| UI 컴포넌트 | 60% | csr-*, ssr-* |
| API 엔드포인트 | 80% | csr-*, ssr-*, data |
| 비즈니스 로직 | 90% | 전체 개발 Track |

> **검증 게이트 — 3단 티어**: 리뷰와 테스트는 다르다 — 모든 레인이 매번 전체를 돌 필요는 없다.
>
> | 시점 | 무엇을 돌리나 |
> |---|---|
> | 작업 중 · 리뷰 | 소스 변경 → 변경 파일로 고른 테스트만(`vitest related <파일>` 등) · **문서/자산 변경 → 관련 게이트를 이름으로 지정**. full 금지 |
> | **작업 단위 종료 (커밋 직전)** | **전체 CI 1회 — 검증 레인만** |
> | 배포 전 | 전체 CI + `ship-checklist` 전항 |
>
> 부분 실행으로는 coverage gate 가 평가되지 않고, 변경 파일로 테스트를 고르는 도구는 **문서·자산 변경에 0건을 고른다**.

## Test Types (All Required)

1. **Unit Tests** — 개별 함수, 유틸리티, 컴포넌트
2. **Integration Tests** — API 엔드포인트, DB 연동
3. **E2E Tests** — 핵심 사용자 흐름 (Ship 단계 필수)

## Dev-Prod Parity (필수)

개발/테스트 DB 엔진은 Prod와 **동일**해야 한다. Prod가 Postgres면 테스트도 Postgres (testcontainer 또는 docker-compose). SQLite 대체 금지 — CI 속도/편의는 근거가 아니다.

## TDD Workflow (Mandatory)

```
1. RED    — 실패하는 테스트 먼저 작성
2. GREEN  — 테스트를 통과하는 최소 구현
3. REFACTOR — 코드 개선 (테스트 유지)
4. VERIFY — 커버리지 확인
```

## Test Structure (AAA Pattern)

```python
def test_calculates_similarity():
    # Arrange
    vector1 = [1, 0, 0]
    vector2 = [0, 1, 0]
    # Act
    result = calculate_cosine_similarity(vector1, vector2)
    # Assert
    assert result == 0
```

## Test Naming

동작을 설명하는 이름:
- `test_returns_empty_array_when_no_markets_match_query`
- `test_throws_error_when_api_key_is_missing`
- `test_falls_back_to_substring_search_when_redis_unavailable`

## Framework Mapping

| Stack | Unit/Integration | E2E |
|-------|-----------------|-----|
| Python (FastAPI) | pytest + pytest-asyncio + httpx | Playwright |
| TypeScript (React) | Vitest + React Testing Library | Playwright |
| Next.js | Vitest + RTL | Playwright |

## Troubleshooting

1. 테스트 격리 확인 (공유 상태 없는지)
2. mock이 실제 동작과 일치하는지 확인
3. 구현을 수정하라, 테스트를 수정하지 마라 (테스트가 틀린 경우 제외)

# Test Policy

## Coverage Thresholds (Track-Specific)

| 영역 | 최소 커버리지 | 적용 Track |
|------|-------------|-----------|
| UI 컴포넌트 | 60% | csr-*, ssr-* |
| API 엔드포인트 | 80% | csr-*, ssr-*, data |
| 비즈니스 로직 | 90% | 전체 개발 Track |

> **검증 정책** — 리뷰와 테스트는 다르다. 커밋마다 전체를 돌리지 않는 대신 **머지와 배포에는
> 빠져나갈 구멍을 두지 않는다.**
>
> | 시점 | 테스트 | 리뷰 |
> |---|---|---|
> | **커밋** | **없음** | — |
> | **머지** | typecheck(전체) + 영향 범위 테스트 + **변경 파일** lint·format · 새 가드 도입 시 변이 테스트 | **독립 에이전트 리뷰 필수** |
> | **배포(tag)** | 풀 테스트 + E2E + `ship-checklist` 전항 · **CI green 이 배포의 전제(`needs:`)** | **필수** |
>
> **영향 범위를 도구로 고르지 마라.** 변경 파일로 테스트를 고르는 도구는 **문서·자산 변경에 0건을 고른다**(파일을 경로로 읽는 게이트는 import 그래프 밖). 그런 변경의 영향 범위는 **파일을 읽는 게이트 전체**이고, 애매하면 전체를 돌려라. 부분 실행은 coverage gate 도 평가하지 않는다.
>
> **`변이 테스트` = 입력 변이.** 새 가드는 **그 가드가 읽는 입력**을 위반 상태로 만들어 빨간불을 눈으로 본 것까지가 증거다. 검사 대상이 소스면 소스를 되돌려 같은 확인을 하되, 되돌린 코드가 typecheck 를 통과했는지까지 본다 — 빌드 파손으로 난 실패는 증거가 아니다.

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

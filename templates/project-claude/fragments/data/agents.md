| Agent | Scope | Model | 역할 |
|-------|-------|-------|------|
| reviewer | global | opus | 검증 전용 (SOD). 코드/문서/분석 관점 전환 |
| data-analyst | global | opus | DuckDB/Trino/ML/PySide6 전문 |
| code-reviewer | project | sonnet | 일상적 코드 리뷰. CRITICAL -> LOW 분류 |
| security-reviewer | project | sonnet | 데이터 접근 권한, PII 처리 검증 |

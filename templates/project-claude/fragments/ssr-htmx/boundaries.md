**Always (자동 실행)**:
- 코드 변경 후 code-reviewer 실행
- 커밋 전 보안 체크 (하드코딩된 시크릿 탐지)
- Jinja2 템플릿에서 사용자 입력 자동 이스케이프 확인
- HTMX 응답에 적절한 Content-Type 헤더 확인
- git pull로 세션 시작

**Ask First (확인 후 실행)**:
- Alembic 마이그레이션 실행
- Railway 배포
- SEO 관련 메타 태그/sitemap 변경
- main 브랜치 머지

**Never (금지)**:
- main 직접 커밋
- 시크릿 하드코딩
- Jinja2 autoescaping 비활성화
- 프로덕션 DB 직접 조작
- DO NOT CHANGE 영역 수정

**Always (자동 실행)**:
- 코드 변경 후 code-reviewer 실행
- 커밋 전 보안 체크 (하드코딩된 시크릿 탐지)
- FastAPI 엔드포인트 추가 시 Pydantic 스키마 검증
- git pull로 세션 시작

**Ask First (확인 후 실행)**:
- Alembic 마이그레이션 실행 (되돌리기 어려움)
- Railway 배포
- Tauri 빌드/릴리스
- main 브랜치 머지

**Never (금지)**:
- main 직접 커밋
- 시크릿 하드코딩
- 프로덕션 DB 직접 조작
- 게이트 건너뛰기 (Hotfix 예외)
- DO NOT CHANGE 영역 수정

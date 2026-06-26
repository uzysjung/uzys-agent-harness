**Always (자동 실행)**:
- 코드 변경 후 code-reviewer 실행
- 커밋 전 보안 체크 (하드코딩된 시크릿 탐지)
- DB 스키마 변경 시 마이그레이션 파일 생성 확인
- git pull로 세션 시작

**Ask First (확인 후 실행)**:
- DB 마이그레이션 실행 (되돌리기 어려움)
- Railway 배포
- Tauri 빌드/릴리스
- main 브랜치 머지

**Never (금지)**:
- main 직접 커밋
- 시크릿 하드코딩
- 프로덕션 DB 직접 조작
- DO NOT CHANGE 영역 수정

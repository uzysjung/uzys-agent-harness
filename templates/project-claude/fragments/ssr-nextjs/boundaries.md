**Always (자동 실행)**:
- 코드 변경 후 code-reviewer 실행
- 커밋 전 보안 체크 (하드코딩된 시크릿 탐지)
- Server/Client 컴포넌트 경계 확인 ("use client" 지시어)
- generateMetadata 누락 여부 확인 (페이지 추가 시)
- git pull로 세션 시작

**Ask First (확인 후 실행)**:
- DB 마이그레이션 실행
- Railway 배포
- next.config 변경 (빌드 영향)
- main 브랜치 머지

**Never (금지)**:
- main 직접 커밋
- 시크릿 하드코딩
- Server Component에서 useState/useEffect 사용
- 프로덕션 DB 직접 조작
- 게이트 건너뛰기 (Hotfix 예외)
- DO NOT CHANGE 영역 수정

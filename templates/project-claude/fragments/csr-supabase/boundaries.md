**Always (자동 실행)**:
- 코드 변경 후 code-reviewer 실행
- 커밋 전 보안 체크 (하드코딩된 시크릿 탐지)
- Supabase RLS 정책 변경 시 security-reviewer 실행
- Supabase 쿼리 작성 시 postgres-best-practices 스킬 참조 (인덱스, RLS 영향)
- git pull로 세션 시작

**Ask First (확인 후 실행)**:
- Supabase 마이그레이션 실행
- Edge Function 배포
- Tauri 빌드/릴리스
- main 브랜치 머지

**Never (금지)**:
- main 직접 커밋
- 시크릿 하드코딩
- RLS 비활성화 상태로 배포
- 게이트 건너뛰기 (Hotfix 예외)
- DO NOT CHANGE 영역 수정

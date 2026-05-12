### Always
- 코드/문서 변경 시 즉시 커밋 → push
- 모든 bash 스크립트는 shellcheck 통과
- Hook 스크립트는 jq 폴백 포함
- 변수 인용 (`"$var"`) 일관 적용

### Ask First
- 새 Track 추가
- setup-harness.sh 흐름 변경
- ECC cherry-pick 항목 추가/제거
- 글로벌 vs 프로젝트 스코프 결정

### Never
- main 직접 커밋
- `.env`, lock 파일, 인증서 파일 수정
- `--no-verify`로 hook 우회
- 게이트 건너뛰기 (`/uzys:` 순서 무시)

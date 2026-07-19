# CLI / Bash Development Rules

tooling Track 전용. 기본 bash 규약(shebang/quoting/local/backticks/stderr)은 shellcheck가 처리. 여기는 프로젝트 특화만.

## Cross-Platform (BSD vs GNU)

macOS(BSD)와 Linux(GNU) 양쪽 지원이 필수인 경우:

| 명령 | BSD | GNU | 회피 |
|------|-----|-----|------|
| `sed -i` | `sed -i ''` | `sed -i` | `-i.bak` + `rm *.bak` 또는 분기 |
| `date` | `date -j` | `date -d` | `if command -v gdate` 폴백 |
| `readlink -f` | 미지원 | 지원 | `cd "$(dirname $f)" && pwd` |
| `realpath -m` | `-m` 미지원 | 지원 | 지원 여부를 먼저 재고(`realpath -m / >/dev/null 2>&1`) 미지원이면 그 검증층을 건너뛴다 |
| `find -newermt` | 미지원 | 지원 | `find -newer <참조파일>` (비교용 파일을 `touch` 로 만든다) |
| `stat` 포맷 | `stat -f` | `stat -c` | `command -v` 분기 |

차이가 큰 명령은 `command -v` 폴백 필수.

## 검증 명령은 실패해도 조용하다

위 표는 배포 스크립트용이지만, 같은 함정이 **즉석에서 치는 확인 명령**에서 더 위험하다 —
스크립트는 리뷰라도 받지만 확인 명령은 아무도 안 본다.

- **빈 결과는 부재의 증거가 아니다.** 미지원 플래그를 만난 명령은 에러만 내고 아무것도 출력하지
  않는다. `2>/dev/null` 이 그 에러를 지우면 남는 빈 출력은 "깨끗함"과 구분되지 않는다.
  **부재를 확인하는 명령에 stderr 를 버리지 마라.**
- **파이프 뒤 `$?` 는 마지막 명령의 것이다.** `cmd | head; echo $?` 는 `head` 의 코드다.
  파이프 없이 실행하거나 `set -o pipefail`.
- **처음 쓰는 플래그로 "이상 없음"을 결론내지 마라.** 알려진 값이 잡히는지로 탐지기를 먼저
  검증한 뒤에 빈 결과를 신뢰한다.

## set 플래그

- `set -e` + `|| true` 혼용 금지 (의도 불분명). 실패 허용 섹션은 명시적 try 블록으로
- plugin 설치 등 실패 허용 구간에서 `set -e` 비활성화 가능
- `set -o pipefail`은 파이프 실패 검출 필요 시

## Hook Script 규약

PreToolUse hook 작성 시:
- stdin으로 JSON 받음 → `jq` 또는 `grep` 폴백 (jq 미설치 환경 대응)
- **차단**: `exit 2` + stderr에 사유
- **통과**: `exit 0` (출력 없음)
- async hook은 10초 이내 완료

## 임시 파일

`/tmp/file.txt` 같은 **고정 경로 금지** — 세션 충돌. `mktemp`/`mktemp -d` 사용.

## Testing

- **shellcheck**: 필수 정적 분석
- **bats**: 단위 테스트 (optional)
- **수동**: `echo '{"...": "..."}' | bash hook.sh` heredoc/pipe로 stdin mock

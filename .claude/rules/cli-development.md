# CLI / Bash Development Rules

tooling Track 전용. 기본 bash 규약(shebang/quoting/local/backticks/stderr)은 shellcheck 가 처리한다.

## Cross-Platform (BSD vs GNU)

| 명령 | BSD | GNU | 회피 |
|---|---|---|---|
| `sed -i` | `sed -i ''` | `sed -i` | `-i.bak` + `rm *.bak` 또는 분기 |
| `date` | `date -j` | `date -d` | `command -v gdate` 폴백 |
| `readlink -f` | 미지원 | 지원 | `cd "$(dirname $f)" && pwd` |
| `realpath -m` | `-m` 미지원 | 지원 | 지원 여부를 먼저 재고(`realpath -m / >/dev/null 2>&1`), 미지원이면 그 검증층을 건너뛴다 |
| `find -newermt` | 미지원 | 지원 | `find -newer <참조파일>` (비교용 파일을 `touch` 로 만든다) |
| `stat` 포맷 | `stat -f` | `stat -c` | `command -v` 분기 |

## 검증 명령은 실패해도 조용하다

위 표는 배포 스크립트를 겨냥하지만, 같은 함정은 **즉석에서 치는 확인 명령**에서 더 위험하다 — 스크립트는 리뷰라도 받지만 확인 명령은 아무도 안 본다.

- **빈 결과는 부재의 증거가 아니다.** 미지원 플래그를 만난 명령은 에러만 내고 아무것도 출력하지 않는다. `2>/dev/null` 이 그 에러를 지우면 남는 빈 출력은 "깨끗함"과 구분되지 않는다 — **부재를 확인하는 명령에 stderr 를 버리지 마라.**
- **파이프 뒤 `$?` 는 마지막 명령의 것이다.** `cmd | head; echo $?` 는 `head` 의 코드다. 파이프 없이 실행하거나 `set -o pipefail`.
- **처음 쓰는 플래그로 "이상 없음"을 결론내지 마라.** 알려진 값이 잡히는지로 탐지기를 먼저 검증한 뒤에 빈 결과를 신뢰한다.
- **실패한 명령도 증거가 아니다.** exit 1 은 "대상이 안 된다"와 "내 절차가 틀렸다"를 구분해 주지 않는다 — 부정 결론 전에 **되는 줄 아는 대상**을 같은 실행에 대조군으로 넣고, 대조군이 함께 실패하면 그 실행을 무효로 처리한다.
- **부정 결론은 도구로 한다** — `scripts/check-absence.sh`(설치본은 `.uzys-agent-harness/check-absence.sh`). 패턴 부재는 `--canary <알려진 양성> [-i] <패턴> <경로>...`, 명령 판정은 `--control <대조 명령> --subject <대상 명령>`. 대조군을 필수로 받아 **탐지기·절차가 실제로 무는지 먼저 보이고**, stderr 를 보존하고, 파이프 없이 exit code 를 낸다(0 부재 · 1 발견 · 2 신뢰 불가 · 3 사용법). 위 규약이 한 세션에 셋 다 깨진 뒤 도구로 내렸고, 대조군 축은 그 뒤 Docker 실험 1건이 더 깨진 뒤 추가했다 — 사람이 매번 기억해야 하는 규약은 규약이 아니다.

## 훅 스크립트 · 임시 파일

PreToolUse hook: stdin 으로 JSON → `jq` 또는 `grep` 폴백(jq 미설치 환경 대응) · **차단 = `exit 2` + stderr 에 사유** · **통과 = `exit 0`**(출력 없음) · async 는 10초 이내 완료. 수동 시험은 `echo '{"...": "..."}' | bash hook.sh`.

`/tmp/file.txt` 같은 **고정 경로 금지**(세션 충돌) — `mktemp`/`mktemp -d` 를 쓴다. `set -e` 와 `|| true` 를 섞지 않는다(의도 불분명) — 실패 허용 구간은 명시적으로 분리한다.

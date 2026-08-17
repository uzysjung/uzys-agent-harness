---
paths:
  - "**/*.sh"
  - "**/*.bash"
---

# Shell Safety

- **빈 결과는 부재의 증거가 아니다.** 미지원 플래그를 만난 명령은 에러만 내고 아무것도 출력하지 않는다. `2>/dev/null` 이 그 에러를 지우면 남는 빈 출력은 "깨끗함"과 구분되지 않는다 — **부재를 확인하는 명령에 stderr 를 버리지 마라.**
- **파이프 뒤 `$?` 는 마지막 명령의 것이다.** 파이프 없이 실행하거나 `set -o pipefail` 을 쓴다.
- 처음 쓰는 플래그로 "이상 없음"을 결론내지 마라. 알려진 값이 잡히는지로 탐지기를 먼저 검증한 뒤에 빈 결과를 신뢰한다. (부정 결론 전반의 요구와 그것을 강제하는 도구는 `doc-governance` 에 있다.)
- macOS(BSD)와 Linux(GNU)는 `sed -i` · `date` · `readlink -f` · `realpath -m` · `find -newermt` · `stat` 포맷이 호환되지 않는다. 양쪽에서 도는 형태를 쓰거나 `command -v` 로 분기한다.

훅으로 쓸 스크립트의 **차단 계약은 실행기마다 다르다** — Claude Code · Codex 는 `exit 2` + stderr 에 사유(통과 = `exit 0`, 출력 없음) · OpenCode 플러그인은 훅 함수에서 `throw` · Antigravity 는 JSON 으로 `decision: "deny"`. 계약 밖의 형태는 "비차단 오류"로 흘러가 조용히 무시된다.

---
paths:
  - "**/*.sh"
  - "**/*.bash"
---

# Shell Safety

- 부정 결론("없다"·"안 된다")은 `doc-governance` 가 지목한 `check-absence.sh` 로 낸다 — 대조군을 요구하고 stderr 를 보존한다.
- macOS(BSD)와 Linux(GNU)에서 다르게 도는 명령은 양쪽에서 도는 형태로 쓰거나 `command -v` 로 분기한다.

훅으로 쓸 스크립트의 **차단 계약은 실행기마다 다르다** — Claude Code · Codex 는 `exit 2` + stderr 에 사유(통과 = `exit 0`, 출력 없음) · OpenCode 플러그인은 훅 함수에서 `throw` · Antigravity 는 JSON 으로 `decision: "deny"`. 계약 밖의 형태는 "비차단 오류"로 흘러가 조용히 무시된다.

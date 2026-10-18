# #513 GLM 배관 시험 — 과제 2개 A/B 각 1회 (2026-10-18)

**목적은 배관 확인이다. 효과 판정이 아니다**(n=2 · 1회 · 상한 축소 · GLM — 설계 §6.1).

설정(각 job `config.json` 기준): glm-5.3 · effort max · 과제 세션 턴 60 · 벽시계 90분(10800×0.5) · 동시 1 · Claude Code 2.1.302 · 하네스 26.174.0 `--track base --cli claude`.
명령: 설계 §10 5 + `EVAL_EFFORT=max`. 원본: `~/eval-513/jobs/513-deepswe-glm-{A,B}-20261018T041247Z`(저장소 밖 보존).

## 결과

| 과제 | 팔 | reward | f2p | p2p | 턴 | 과제 세션 시간 | 종료 | 입력 토큰(캐시 포함) / 출력 |
|---|---|---|---|---|---|---|---|---|
| textual-kitty-key-phases | A | **1** | 23/23 | 57/57 | 60 → **+34**(재개) | 24.3분 + 재개 | max_turns → 재개 뒤 success | 6.00M / 85k |
| textual-kitty-key-phases | B | 0 | 0/23 | 57/57 | 60 | 14.9분 | max_turns | 4.63M / 65k |
| go-git-worktree-merge-conflicts | A | 0 | 0/17 | 2/2 | 60 | 18.6분 | max_turns | 4.90M / 67k |
| go-git-worktree-merge-conflicts | B | 0 | 0/17 | 2/2 | 60 | 36.7분 | max_turns | 7.78M / 96k |

B 정리 3회(과제 세션 전): textual 180 + 98 + 93 s · go 202 + 114 + 90 s. 턴 30/20/18 · 24/19/16. 세션 1 이 FILL 7 → 0, 세션 2·3 은 검증만(편집 0~2). 정리가 git 상태를 바꾸지 않음(`prep-git-status-diff` 0바이트) · 훅 차단 0.
job 벽시계: A 57분 41초 · B 1시간 19분 17초. `cost_usd` 는 Claude 가격표 추정이라 GLM 비용이 아니다 — 실제 비용은 Z.ai 콘솔 크레딧.

## 확인된 것 (§10 6~8)

- **B 는 B 였다** — ⓐ `init.skills` 30(하네스 14 포함) · `agents` 에 `implementer` · `reviewer` · `mcp_servers` 에 `context7` ⓑ 과제 세션 jsonl 에 `Session started. Branch:` ⓒ `harness-install-record.json` · `harness-git-status-diff.txt` 0바이트 ⓓ A 는 skills 16 · agents 5 · mcp `[]` · 문자열 0 ⓔ `prep-done` · session-1~3.json · timing 3줄 · FILL 7 → 0.
- **채점 배관** — 검증기가 별도 컨테이너에서 돌고 커밋된 변경(`git diff <base> HEAD`)만 채점한다. A textual 패치 34 KB 에 하네스 파일 없음.
- **키 유출 0** — `jobs/` · `smoke/` · `pilot-smoke.log` 모두 일치 파일 0, 대조군 1(검사기가 문다).
- 이미지 정리 — 과제 이미지 4 · egress 프록시 4 삭제. `eval-513-glm` 은 이미 없음.

## 드러난 문제 — 본실험 전에 바꿀 것

1. **턴 60 이 결과를 정했다.** 4건 모두 60턴에 걸렸다. 지시문이 "끝나면 커밋하라"이고 채점은 커밋분만 보므로, 작업 중 끊긴 3건은 편집 20~21회를 하고도 패치 0바이트 → reward 0. 0점은 모델 실력이 아니라 상한의 결과다. 설계 §5.1(상한은 Opus 첫 A 10건으로 정한다, 안전망 턴 300 · 4h)이 이미 이 방향이다.
2. **턴 상한은 두 팔에 같게 걸리지 않는다.** A textual 은 60턴에서 멈춘 뒤, 그 전에 띄운 백그라운드 명령의 완료 알림이 `--print` 세션을 다시 깨워 34턴을 더 돌고 커밋했다(같은 session_id 로 `result` 줄 2개). 백그라운드 명령을 쓴 세션만 상한을 넘는다 → **턴은 상한으로 쓰지 않고 기록만 한다. 상한은 Pier 가 밖에서 집행하는 벽시계 하나**로 둔다(§5.1 · §5.3 에 반영). 집계는 `result` 줄을 모두 더한다.
3. **B 의 context7 은 연결 실패**(`status: failed`) — egress 가 Z.ai 호스트만 허용한다. 설치자 환경에서는 연결된다 → B 에 불리한 쪽의 차이. 허용 목록에 넣을지는 본실험 설정에서 정한다(§4.5).
4. 수집 누락(경미) — 정리 세션 jsonl 이 trial 마다 3개 중 2개만 `prep/sessions/` 에 남았다(어느 회차가 빠지는지 일정하지 않음). 세션 결과 JSON 3개는 모두 있어 집계에는 지장 없다.

## 이번 시험으로 정해진 사실

- 1113 의 원인 = 코딩 플랜이 아닌 키였다(사용자 확인). 코딩 플랜 키로 바꾼 뒤 `pong` 정상.
- effort 는 GLM 에 전달되는 것으로 보인다(같은 질문의 출력 토큰 low 137 · high 207 · max 234, 각 1회 — 경향만). glm-5.3-flash 도 high/max 에서 정답.
- B 의 정리 3회 비용 ≈ 6~7분 · 입력 약 1.0~1.3M(대부분 캐시 읽기) / 출력 약 25k(trial 당).

# Model evidence — 이 프로젝트 대장

이 저장소에서 잰 모델 · effort 관측이다. 양식 · 읽는 법 · 재측정 절차 =
`templates/skills/external-model-consult/references/model-evidence.md`(시드). 덧붙이기만 한다 — 결과가 바뀌면 새 항목을
쓰고 옛 항목의 status 만 `superseded-by` 로 바꾼다.

### E-2026-10-25-01 · implementation — 이슈에 규칙이 정해진 보안 판정 한 곳 고치기 (설치자 디스크 · CLI)
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: task
- task_type: implementation
- method: same-brief ✗(대조 조합 없음 — 단일 시험) · isolated-worktree ✓ · blind-scoring ✓(Opus 5.5 `reviewer` 정의, effort 미지정 — 작성 모델을 알리지 않고 PR 산출물만 채점) · mutation-check ✓(src 되돌림 9 red · 리뷰어 변이 2종 red) · actual-model-from-transcript ✓(`claude-sonnet-5-5` · `xhigh`) · cost = 서브에이전트 토큰 합(하한 여부 미확인) · time = 동시 레인 3개와 함께 돈 시간
- candidates: Sonnet 5.5 · xhigh
- result:

  | 조합 | overall/10 | 결함 | 재작업 | 토큰 | 시간 |
  |---|---|---|---|---|---|
  | Sonnet 5.5 · xhigh | 9 | BLOCKER 0 · HIGH 0 · MED 1 | 0회 | 14.5만 | 8.2분 |

- conclusion: 이슈가 고칠 규칙(백업 이름 규약)을 이미 정해 둔 한 함수 수정에서 Sonnet 5.5 xhigh 는 재작업 없이 리뷰를 통과했다. 기존 헬퍼를 재사용하고 순환 import 를 스스로 피했다.
- limits: 과제 1건 · 채점자 1명 · 같은 과제의 Opus 대조 없음(같은 날 Opus 5.5 레인 4개는 이슈 5건 묶음이라 비교 불가) · 커밋 제목에 "WIP" 를 남겨 squash 머지 제목이 됐다(브리프는 첫 green WIP push 를 요구했고, PR 제목은 정상이었다 — 머지 쪽 관례 문제로 본다).
- source: PR #900 · 이슈 #894 · 사용자 결정(2026-10-25 "단순 개선 작업은 Sonnet 5.5 에게 시켜 보고 검증해서 잘 하면 써 봐 — xhigh 이상")
- stale_when: 모델 세대 교체 · 설계 판단이 큰 과제 · 2027-04 이후

### E-2026-10-25-02 · implementation — 화면 집계가 키 id 형태 빼기를 못 읽던 것 (CLI · 화면 숫자)
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: task
- task_type: implementation
- method: same-brief ✗ · isolated-worktree ✓ · blind-scoring ✓(Opus 5.5 `reviewer`, effort 미지정 — 산출물만 채점) · mutation-check ✓(src 되돌림 2 red · 조각별 되돌림 각자 red) · actual-model-from-transcript ✓(`claude-sonnet-5-5` · `xhigh`) · cost = 서브에이전트 토큰 합 · time = 동시 레인 2개와 함께
- candidates: Sonnet 5.5 · xhigh
- result:

  | 조합 | overall/10 | 결함 | 재작업 | 토큰 | 시간 |
  |---|---|---|---|---|---|
  | Sonnet 5.5 · xhigh | 8 | 0 | 0회 | 16.6만 | 8.4분 |

- conclusion: 이슈가 지목한 풀이 위치가 틀렸는데(`key-ids.ts` 에 그 풀이가 없었다) 실제 규칙(`droppedMcpServers`)을 찾아 재사용했다. 감점은 범위 밖 위저드 장면을 화면만 맞추고 드러내는 데 그친 점(본문에 정직하게 적음).
- limits: 과제 1건 · 채점자 1명 · Opus 대조 없음.
- source: PR #905 · 이슈 #904
- stale_when: 모델 세대 교체 · 설계 판단이 큰 과제 · 2027-04 이후

### E-2026-10-25-03 · implementation — 위저드가 키 id 형태 빼기를 다시 체크해도 무시하던 것 (CLI · 위저드)
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: task
- task_type: implementation
- method: same-brief ✗ · isolated-worktree ✓ · blind-scoring ✓(Opus 5.5 `reviewer`, effort 미지정 — 위저드 65장면을 main 과 대조) · mutation-check ✓(src 되돌림 4 red · 두 자리 따로 되돌림 각자 red) · actual-model-from-transcript ✓(`claude-sonnet-5-5` · `xhigh`) · cost = 서브에이전트 토큰 합 · time = 동시 레인 2개와 함께
- candidates: Sonnet 5.5 · xhigh
- result:

  | 조합 | overall/10 | 결함 | 재작업 | 토큰 | 시간 |
  |---|---|---|---|---|---|
  | Sonnet 5.5 · xhigh | 8.5 | MED 2 · LOW 1 | 0회 | 13.5만 | 7.0분 |

- conclusion: 앞 PR 의 풀이 함수를 재사용해 두 자리를 고쳤고 다른 분류 53장면은 main 과 같았다. MED 는 테스트가 codex·opencode 설정 파일과 이어지는 update 를 단언하지 않은 것 · 같은 풀이가 세 곳에 있는 것(동작은 맞다).
- limits: 과제 1건 · 채점자 1명 · Opus 대조 없음.
- source: PR #909 · 이슈 #908
- stale_when: 모델 세대 교체 · 설계 판단이 큰 과제 · 2027-04 이후

### 판단(측정 아님) — 2026-10-25 · Sonnet 5.5 xhigh 를 단순 개선의 기본으로 쓴다
- 근거: E-2026-10-25-01 ~ 03(3건 모두 블라인드 리뷰 BLOCKER 0 · 재작업 0 · 8 ~ 9점 · 7 ~ 8분). 대상 = 이슈에 AC 와 해결안이 있고 설계 판단 · 기록 스키마 · 보안 경계 결정이 없는 패턴 적용 · 기계적 수정. 설치자 디스크 · 보안 경로면 독립 리뷰는 그대로 붙인다.
- 사용자 지시(2026-10-25): "단순 개선 작업은 Sonnet 5.5 에게 시켜 보고 검증해서 잘 하면 써 봐 — xhigh 이상".
- 다시 볼 때: 같은 유형에서 BLOCKER 나 재작업이 나오면, 또는 Opus 대조를 같은 과제로 재면.

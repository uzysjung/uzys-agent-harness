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
- status: superseded-by 판단 2026-10-25 저녁(아래)
- 근거: E-2026-10-25-01 ~ 03(3건 모두 블라인드 리뷰 BLOCKER 0 · 재작업 0 · 8 ~ 9점 · 7 ~ 8분). 대상 = 이슈에 AC 와 해결안이 있고 설계 판단 · 기록 스키마 · 보안 경계 결정이 없는 패턴 적용 · 기계적 수정. 설치자 디스크 · 보안 경로면 독립 리뷰는 그대로 붙인다.
- 사용자 지시(2026-10-25): "단순 개선 작업은 Sonnet 5.5 에게 시켜 보고 검증해서 잘 하면 써 봐 — xhigh 이상".
- 다시 볼 때: 같은 유형에서 BLOCKER 나 재작업이 나오면, 또는 Opus 대조를 같은 과제로 재면.

### E-2026-10-25-04 · cost — 같은 날 레인들의 실제 비용 (API 정가 환산)
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: session
- task_type: implementation · review
- method: 레인 기록(`tasks/<id>.output`)의 assistant `usage` 를 message.id 로 중복 제거해 합산 · 단가 $/MTok = Opus 5.5 입력 4 · 출력 20 · 캐시 읽기 0.20 · 캐시 쓰기(5분) 5 / Sonnet 5.5 입력 2 · 출력 10 · 캐시 읽기 0.20 · 캐시 쓰기 2.5 · actual-model-from-transcript ✓ · 구독 요금제의 실제 소진량과는 다를 수 있다
- result:

  | 레인 | 모델 | 캐시 읽기 | 출력 | 비용 |
  |---|---|---|---|---|
  | E-01 구현(#894) | Sonnet 5.5 xhigh | 5.31M | 48k | $1.90 |
  | E-02 구현(#904) | Sonnet 5.5 xhigh | 6.61M | 45k | $2.18 |
  | E-03 구현(#908) | Sonnet 5.5 xhigh | 4.52M | 36k | $1.60 |
  | #911 구현(2회차) | Sonnet 5.5 xhigh | 28.05M | 124k | $8.08 |
  | E-02 · E-03 블라인드 리뷰 | Opus 5.5 | — | — | $5.83 · $3.78 |
  | 이슈 5건 묶음 구현 레인 4개 | Opus 5.5 | 31~51M | 117~199k | $11.85 ~ $16.82 |

- conclusion: 캐시 읽기가 비용의 절반 이상이고 그 단가는 두 모델이 같다 — 같은 토큰이면 Opus 가 약 1.4배, 턴을 30% 덜 쓰면 역전한다. 작업 알림의 토큰 수(E-01 ~ 03 의 13.5 ~ 16.6만)는 캐시 읽기를 세지 않아 비용 비교에 못 쓴다. 단순 PR 의 블라인드 리뷰가 구현보다 비쌌다.
- limits: 같은 과제의 Opus 대조 없음 · 묶음 레인은 과제 수 · 난이도가 달라 건당 비교 불가.
- source: 사용자 질문(2026-10-25 "opus가 더 싸지?") · PR #900 · #905 · #909 · #914
- stale_when: 단가 변경 · 모델 세대 교체

### E-2026-10-25-05 · implementation — 링크 자리 uninstall 안내 (CLI · 화면 · 기록 위조 경계)
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: task
- task_type: implementation
- method: same-brief ✗ · isolated-worktree ✓ · 세션 점검 + Opus 5.5 독립 리뷰 · actual-model-from-transcript ✓(`claude-sonnet-5-5` · `xhigh`)
- candidates: Sonnet 5.5 · xhigh
- result:

  | 조합 | overall/10 | 결함 | 재작업 | 비용 | 시간 |
  |---|---|---|---|---|---|
  | Sonnet 5.5 · xhigh | — | BLOCKER 1(세션 점검: 위조 기록이 하네스 밖 파일의 `mv` 안내를 냈다) | 1회 | $8.08 | 2회차 합 |

- conclusion: 화면 문구 과제로 분류했지만 설치 기록 위조라는 보안 경계가 숨어 있었고, 첫 판은 그 경계를 보지 못했다. 단순 개선 분류를 잘못 고른 사례이기도 하다.
- limits: 과제 1건 · 독립 리뷰 결과는 PR #914 에 있다.
- source: PR #914 · 이슈 #911
- stale_when: 모델 세대 교체 · 2027-04 이후

### 판단(측정 아님) — 2026-10-25 저녁 · 단순 개선도 Opus 5.5 medium 으로 돌린다
- 근거: E-04(비용 차가 ±15% 안이라 비용으로 가르지 못한다) · E-05(Sonnet 4건 중 1건 재작업) · 시드 대장 E-2026-10-04-01(같은 과제에서 Opus medium 이 Sonnet xhigh 보다 싸고 빨랐다 — 다른 프로젝트).
- 사용자 질문(2026-10-25): "opus가 더 싸지?".
- 다시 볼 때: 다음 단순 건의 Opus medium 비용을 E-01 ~ 03 과 대조해 이 대장에 남긴 뒤.

### E-2026-10-25-06 · implementation — uninstall 화면 줄의 기록 글자 거름 (CLI · 화면 · 단순 개선)
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: task
- task_type: implementation
- method: same-brief ✗ · isolated-worktree ✓ · 세션 점검(독립 리뷰 없음 — 화면 문구라 문턱 아래) · actual-model-from-transcript ✓(`claude-opus-5-5` · `medium`) · cost = 레인 기록 usage 합(API 정가 환산)
- candidates: Opus 5.5 · medium
- result:

  | 조합 | 결함 | 재작업 | 비용 | 시간 |
  |---|---|---|---|---|
  | Opus 5.5 · medium | 정상 설치자 화면 회귀 1(낱개 공백까지 `\u0020` 으로 찍음 — 세션 점검) | 1회 | 1회차 $2.23 · 합 $3.40 | 합 14.6분 |

- conclusion: 판단(E-04 이후 단순 개선 = Opus medium)의 첫 대조. 1회차 비용은 Sonnet xhigh 단순 3건(E-01 ~ 03, $1.60 ~ 2.18 · 재작업 0)과 비슷했고, 재작업이 1회 났다. Opus medium 이 더 싸거나 정확하다는 증거는 아직 없다.
- limits: 과제 1건 · 같은 과제의 Sonnet 대조 없음 · 채점 없이 세션 점검만.
- source: PR #921 · 이슈 #919
- stale_when: 모델 세대 교체 · 2027-04 이후

### E-2026-10-25-07 · cost — 보안 · 링크 경계 PR 의 비용은 모델보다 리뷰 회차가 정했다
- status: measured
- date: 2026-10-25 · where: uzys-agent-harness 개발 세션 · scope: session
- task_type: implementation · review · design
- method: 레인 기록 usage 합(API 정가 환산, E-04 와 같은 방법) · actual-model-from-transcript ✓
- result:

  | 과제 | 구현 | 리뷰 · 검증 | 회차 | 합 |
  |---|---|---|---|---|
  | #912 — 설계 먼저(Fable 설계 검증 2회 → 구현) | Opus 5.5 high $6.21 | 설계 검증 $9.39 · 적대 리뷰 $9.79 | 구현 1 | $25.39 |
  | #911 — 바로 구현 | Sonnet 5.5 xhigh $27.70 | Opus 리뷰 $15.69 | 5 | $43.39 |
  | #918 — 바로 구현 | Opus 5.5 high $20.01 | Opus 리뷰 $23.60 + $6.59 | 5(회차 4 는 회귀를 만들어 되돌림) | $50.20 |

- conclusion: 남이 커밋한 기록 · 링크를 다루는 과제에서는 회차마다 새 링크 조합이 나왔고, 비용은 모델이 아니라 회차 수를 따라갔다. 착수 전 설계를 검증한 #912 가 회차 · 비용 모두 가장 작았다. 회차가 3 을 넘으면 "main 보다 나빠진 장면만 BLOCK" 으로 재판정하고 남은 조합은 설계 이슈로 뗐다(#922).
- limits: 과제마다 1건 · 과제 난이도가 서로 다르다 · 설계 먼저의 효과는 가설이다.
- source: PR #914 · #916 · #920 · 이슈 #911 · #912 · #918 · #922
- stale_when: 모델 세대 교체 · 2027-04 이후

# Model evidence ledger — seed (모델 · effort 실측 대장)

모델 · 티어 · effort 를 고를 때 근거로 쓰는 **날짜 붙은 관측**의 대장이다. 이 파일은 하네스가
릴리즈마다 갱신하는 **시드**다 — **편집하지 마라.** `update` 가 최신판으로 덮고, 고친 판은 백업
파일로 밀려난다.

**두 파일을 함께 읽는다.**

- **이 시드** — 하네스 유지자가 모은 관측. 다른 프로젝트 · 다른 계정에서 잰 것이다.
- **프로젝트 대장 `docs/model-evidence.md`** — 이 프로젝트에서 잰 것. 없으면 첫 측정 때 만들고,
  그 뒤로는 **덧붙이기만** 한다(append-only). 하네스의 install · update · uninstall 은 이 파일을
  만들지도 · 고치지도 · 지우지도 않는다 — 설치자의 파일이다. 프로젝트의 `CLAUDE.md` / `AGENTS.md`
  가 다른 위치를 적었으면 그곳을 쓴다.

같은 과제 유형에서 프로젝트 항목이 시드와 어긋나면 **프로젝트 항목이 이긴다** — 같은 코드베이스 ·
같은 시점의 측정이 더 가깝다.

## 읽는 법

- 항목은 관측이지 법칙이 아니다. 결론보다 `limits` 와 `stale_when` 을 먼저 읽는다.
- 과제 유형이 맞는 `measured` 항목이 없으면 **"근거 없음"이라고 말하고** 고른다. 모델 이름 · 가격 ·
  출시 순서로 적합성을 추론하지 않는다.
- `method` 에 체크가 빠진 항목은 그만큼 약한 근거다. 지우지 않고 그대로 둔다.
- `planned` 는 아직 재지 않은 항목이다 — 근거가 아니라 "여기는 모른다"는 표시다.
- 스킬 본문은 모델 이름을 적지 않고 이 파일의 항목 ID 만 가리킨다. 이름과 수치는 여기에만 있다.

## 항목 양식 (시드 · 프로젝트 대장 공통)

```markdown
### E-YYYY-MM-DD-NN · <과제 유형> — <과제 한 줄> (<영역>)
- status: measured | planned | superseded-by E-…
- date: YYYY-MM-DD · where: <어느 프로젝트 · 계정> · scope: task | user-scene | milestone
- task_type: implementation | design | review | korean-copy | concision | image | debate | 운영 사실
- method: same-brief ✓/✗ · isolated-worktree ✓/✗ · blind-scoring ✓/✗ (채점자 모델 · effort, 무엇을 봤나)
  · mutation-check ✓/✗ · actual-model-from-transcript ✓/✗ · cost = 하한 여부 · time = 동시 부하 여부
- candidates: <모델 · effort> …
- result: (표) 조합 | overall/10 | 결함 | 비용(하한) | 시간
- conclusion: 조건을 포함한 한 줄
- limits: 과제 수 · 채점자 수 · 빠진 값 …
- source: <원문 위치 — 이슈 · PR · 파일 경로>
- stale_when: 모델 세대 교체 · 과제 유형이 다름 · <날짜> 이후 N개월
```

규칙: 항목은 고치지 않는다. 결과가 바뀌면 **새 항목을 쓰고 옛 항목의 status 를 `superseded-by <새 ID>`**
로만 바꾼다. 측정 방법이 약하면 약하다고 적은 채로 남긴다. 사람의 판단(선호 · 운영 결정)은 측정값과
섞지 않고 "판단(측정 아님)" 으로 따로 적는다.

## 항목을 추가하려면 — 재측정 절차

항목이 `measured` 로 인정받는 조건이 곧 절차다.

1. 같은 과제 · 같은 브리프. 브리프는 측정 전에 고정하고 파일로 남긴다.
2. 격리 — 조합마다 별도 worktree(또는 디렉터리). 공유 테스트 자원이 있으면 조합끼리 겹치지 않게.
3. 난이도 사다리 — **쉬운 과제부터, 가벼운 모델 · 낮은 effort 부터** 올린다. 어려운 과제 · 강한 모델
   조합은 그 아래가 떨어진 뒤에 넣는다. 과제 유형이 다르면 다른 항목이다.
4. 블라인드 채점 — 채점자는 diff(산출물)만 보고 어느 조합인지 모른다. 채점자 모델 · effort 를 기록한다.
   AC 통과 · 결함 등급 · 가드 뮤테이션(테스트가 실제로 무는지)을 직접 잰다.
5. 실제값 — 모델 · effort 는 요청값이 아니라 트랜스크립트의 실제값을 적는다. 못 확인하면 `unknown`.
6. 비용은 **하한**(사고 토큰이 빠질 수 있다) · 시간은 동시 부하를 적는다. 모르는 값은 `unknown` 이고
   꾸미지 않는다.
7. 결론은 조건 포함 한 줄. 표본 수와 실패 사례를 적고, 적은 사례의 승률을 법칙으로 쓰지 않는다.
8. 단위(scope) — 기본은 과제 1건. 사용자 씬 · 마일스톤 단위로 재면 산출물 기준에 **PR 묶음의 리그레션
   결과**를 넣고 `scope` 를 그렇게 적는다. 같은 양식, 다른 단위.
9. 언제 — 사용자가 요청했을 때, 또는 라우팅 결정에 쓸 항목이 없고 틀렸을 때의 비용이 측정 비용을 넘을 때
   **제안**한다. 주기 실행 · 훅 · 반복 루프를 만들지 않는다. 실제 실행에는 그 격리 자리 · 도구 · 비용에
   대한 승인이 필요하다.
10. 적는 곳 — 프로젝트 `docs/model-evidence.md`(append-only). 시드(이 파일)는 편집하지 않는다.

## 근거 없는 선택 규칙 (재측정 후보)

`external-model-consult` 본문의 선택 규칙 중 측정 근거가 **없는** 것. 규칙이 틀렸다는 뜻이 아니라,
판단 · 설계로 정했고 측정으로 확인한 적이 없다는 뜻이다.

| ID | 규칙 (본문 위치) | 왜 그렇게 정했나 | 재측정한다면 |
|---|---|---|---|
| `E-NONE-korean` | 한국어 카피 · 뉘앙스는 Gemini (Why this exists · Which provider, Mode K) | 유지자의 **선호 판단** — 벤치마크 아님 | korean-copy 과제 · Gemini 고성능 티어 대 현재 세션 모델 · 한국어 독자 채점자 블라인드 |
| `E-NONE-persona` | 멀티페르소나 · 제3자 비평은 Gemini (Mode P) | 비-Claude 관점이 목적이라는 설계 판단 — Codex 와 비교한 측정 없음 | review 과제 · 찾은 실제 결함 수와 중복률 |
| `E-NONE-concision` | 간결화 · 재구조화는 Codex (Mode S) | 설계 판단 — 다른 모델과 비교한 측정 없음 | concision 과제 · 보존해야 할 내용 누락 수 · 목표 길이 달성 |
| `E-NONE-image` | 이미지 기본은 Codex (Mode I) | 운영 사실만 — codex 는 OUT_DIR 로 직접 쓰고 Gemini 는 자기 아티팩트 저장소를 거친다. 화질 비교 측정 없음 | image 과제 · 같은 프롬프트 블라인드 |
| `E-NONE-pro` | Gemini 호출은 항상 `pro` 티어 (Which tier) | 판단 호출에서 싼 티어로 다시 왕복하는 비용을 피하려는 설계 판단 — 티어별 품질 측정 없음. 운영 사실은 `E-2026-07-26-01` | 같은 과제에서 `pro` 대 빠른 티어 |
| `E-NONE-codex-model` | codex 는 `-m` 없이 사용자 설정 모델 (How to call it) | 적어 둔 모델 ID 가 낡아 은퇴한 모델에 묶이는 것을 막는 설계 판단 — 어느 Codex 모델이 낫다는 측정 없음 | 해당 없음(선택이 아니라 위임) |

## 항목

### E-2026-10-04-01 · implementation — 기존 훅 패턴을 두 화면에 적용 (웹)

- status: measured
- date: 2026-10-04 · where: 하네스 유지자의 다른 프로젝트(이 하네스 저장소 아님) · scope: task
- task_type: implementation
- method: same-brief ✓ · isolated-worktree ✓ · blind-scoring ✓ (채점자 Opus 5.5 high, diff 만 봄 —
  AC · 결함 등급) · mutation-check ✓ (가드 뮤테이션으로 테스트가 무는지 직접 측정) ·
  actual-model-from-transcript ✓ · cost = 하한(사고 토큰 제외) · time = 동시 부하 영향 있음
- candidates: Claude 모델 × effort 8조합

| 조합 | overall(10) | 결함 | 비용(하한) | 시간 |
|---|---|---|---|---|
| Sonnet 5 · xhigh | 6 | MED 1 · LOW 1 | $6.75 | 22분 |
| Sonnet 5.5 · medium | 7 | MED 1 · LOW 1 | $1.31 | 10분 |
| Sonnet 5.5 · high | 8 | LOW 1 | $1.75 | 10분 |
| Sonnet 5.5 · xhigh | 9 | 0 | $2.42 | 18분 |
| Sonnet 5.5 · max | 9.5 | 0 | $8.51 | 32분 |
| Opus 5.5 · low | 8.5 | 0 | $1.62 | 10분 |
| Opus 5.5 · medium | 9 | 0 | $2.11 | 10분 |
| Opus 5.5 · high | 9 | 0 | $2.52 | 10분 |

- conclusion: **패턴 적용형 구현 과제 1건에서는** Opus 5.5 medium~high 가 9점 · 결함 0 을 10분에 냈다.
  Sonnet 5.5 는 xhigh 에서야 같은 점수였고 더 느리며 비용은 비슷했다(캐시 읽기 단가가 같아 단가 차이가
  거의 남지 않는다). max 는 +0.5점에 비용 3~4배.
- 판단(측정 아님 — 유지자, 2026-10-04): 위 결과로 구현 위임 기본을 Opus 5.5 medium~high 로 쓴다.
  Fable 은 중요한 기획 · 설계의 작성이나 검증에만 쓴다 — 이 표에 Fable 은 없으므로 **그 부분은 근거
  없음**이다. 모델 이름에 역할을 묶지 않는다(같은 판단이 다른 세대에 그대로 이어지지 않는다).
- limits: 과제 1건(기존 패턴 적용) · 채점자 1명 · 비용은 사고 토큰이 빠진 하한 · 시간은 동시 부하 영향
  · 설계 판단이 큰 과제 · 서버 과제는 측정 안 됨(`E-2026-10-04-P1` · `P2`)
- source: https://github.com/uzysjung/uzys-agent-harness/issues/681 (본문 표)
- stale_when: 모델 세대 교체 · 과제 유형이 다름(설계 · 서버 · 리뷰) · 2027-04 이후

### E-2026-07-26-01 · 운영 사실 — Gemini 티어 이름과 쿼터 (agy CLI)

- status: measured
- date: 2026-07-26 · where: 하네스 유지자 계정 1개 · scope: task
- task_type: 운영 사실(모델 품질 비교가 아님)
- method: 관측 1회 · `agy models` 목록과 실제 호출 응답을 읽음 · same-brief / blind-scoring 해당 없음
- result:
  - **티어 이름은 최신성을 말하지 않는다** — 그날 빠른 가족이 `pro` 가족보다 두 세대 앞서 있었다.
    기억으로 친 슬러그는 거부된다(`invalid model selection`, exit 1).
  - **Gemini 쿼터는 계정당 한 풀이고 Claude 모델은 그 밖이다** — `gemini-3.1-pro-high` ·
    `gemini-3.1-pro-low` · flash 모델 하나가 같은 분에 똑같은 `Individual quota reached … Resets in
    166h` 로 거절했고, 같은 분의 `claude` 호출은 정상 응답했다. 티어를 낮춰도 피할 수 없다.
- conclusion: 티어는 **가족**을 고르는 이름이고 버전 문자열은 매 호출 `agy models` 에서 읽는다. 쿼터
  소진 시 다른 Gemini 티어는 대안이 아니다.
- limits: 계정 1개 · 관측 1회 · agy 의 모델 목록과 쿼터 정책은 계정 등급 · 시점에 따라 다를 수 있다
- source: `external-model-consult` 스킬 본문 "Which tier" 절의 측정 기록(2026-07-26)
- stale_when: agy 모델 목록 · 쿼터 정책 변경 · 계정 등급이 다름

### E-2026-10-04-P1 · design — 설계 판단이 큰 변경 (재측정 계획)

- status: planned
- date: 2026-10-04(계획일) · where: 하네스 유지자 · scope: task
- task_type: design — 경계 · 계약을 새로 정하는 변경
- method: 위 재측정 절차 그대로(같은 브리프 · 격리 · 블라인드 · 가드 뮤테이션 · 실제값 · 비용 하한)
- candidates: Sonnet 5.5 high · xhigh · max / Opus 5.5 medium · high
- 판단(측정 아님 — 유지자, 2026-10-04): "Sonnet 5.5 는 정말 쉬운 개발에 high 로 쓰고, xhigh · max 를
  Opus 5.5 와 다시 비교한다."
- limits: 아직 재지 않았다 — 이 과제 유형의 근거는 **없다**
- source: https://github.com/uzysjung/uzys-agent-harness/issues/681 (첫 댓글)

### E-2026-10-04-P2 · implementation — 서버 · 설치자 디스크 경로 (재측정 계획)

- status: planned
- date: 2026-10-04(계획일) · where: 하네스 유지자 · scope: task
- task_type: implementation — 삭제 · 덮어쓰기가 있는 서버/디스크 경로(예: update · uninstall 류)
- method: 위 재측정 절차 그대로
- candidates: Sonnet 5.5 high · xhigh · max / Opus 5.5 medium · high
- limits: 아직 재지 않았다 — 이 과제 유형의 근거는 **없다**. `E-2026-10-04-01` 은 패턴 적용형이라 대신하지
  못한다
- source: https://github.com/uzysjung/uzys-agent-harness/issues/681 (첫 댓글)

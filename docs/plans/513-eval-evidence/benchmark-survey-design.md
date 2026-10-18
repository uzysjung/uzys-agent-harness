# #513 검증 프레임워크 설계용 — 벤치마크 방법론 조사 (2026-10-19)

조사 범위: 어려운 과제 선정 · DeepSWE 과제별 결과 공개 · 반복과 통계 · 판 관리 · 비용 보고.
출처 번호 B1~ 는 아래 표, S1~S33 은 `sources.md`. ○ = 1차 출처를 직접 읽음, △ = 요약·2차 출처만, ● = 내가 내려받아 계산.

## 우리 프레임워크에 넣을 것

1. **"어려운 과제"는 우리 A 결과가 아니라 DeepSWE 공식 공개 데이터로 고른다.** DeepSWE 는 모든
   (과제 × 모델 × effort) 시행 31,617건을 JSON 으로 공개한다(B2). 그 안에 **GLM-5.3 max 의 과제별 4회
   결과**(452시행, provider `zai`)가 있다 — 우리 과제 모델과 같은 모델이고, 우리 실행과 독립된 측정이다.
   선택이 측정과 독립이면 A·B 둘 다 새로 재므로 선택 편향이 두 팔에 똑같이 걸리고 짝 차이는 치우치지 않는다
   — tinyBenchmarks 가 고르는 데 쓴 모델과 평가하는 모델을 가른 것과 같은 원리다(B26).
2. **평균으로의 회귀는 실재하고 크기도 쟀다.** 같은 GLM-5.3 공개 데이터에서 앞 2회를 0/2 로 실패한
   20과제가 뒤 2회에는 20% 를 통과했다(● B2). 우리 A 실행 결과로 고르면 하네스 효과가 0이어도
   B 가 약 +20%p 유리하게 나올 수 있다는 뜻이다. → **선정 규칙은 B2 로 정하고, 우리 A 결과는 선정에 쓰지 않는다.**
3. **"어렵다"는 "아무도 못 푼다"가 아니라 "가끔 푼다"로 정의한다.** 다른 69개 설정의 평균 통과율로 가장
   어려운 20과제 중 11개는 GLM-5.3 이 0/4 다(● B2) — 바닥에 붙은 과제는 하네스가 도와도 신호가 거의 안
   나온다. 정보가 있는 과제는 GLM-5.3 이 1~3/4 를 통과한 **50과제**다. 권장 규칙(가정 · 사전 등록 대상):
   "GLM-5.3 max 1~3/4 **이고** 다른 설정 평균 통과율 ≤ 중앙값(0.60)" = **30과제**, 더 좁히면 ≤ 0.40 = 15과제.
   난이도를 모델 해결률로 정한 전례: Aider polyglot(7모델 중 ≤3개가 푼 225문제, B16), Terminal-Bench 2.0 의
   경험적 난이도(모델 통과율 33.3%/66.7% 경계, B14), Terminal-Bench 4.0 의 포화 제거(S6).
4. **과제 수·반복 수 권장 = 30과제 × 팔당 3회(최소) 또는 20과제 × 5회.** GLM-5.3 1~3/4 대역의 과제별
   통과율로 짝 t검정을 모의(● B2, 효과를 절대 %p 로 균일 가정)한 검정력: 20×3 은 +15%p 에 45%·+20%p 에 72%,
   20×5 는 66%·90%, 30×3 은 62%·88%, 40×3 은 76%·96%. **20×3 은 +20%p 미만 효과를 놓칠 가능성이 높다.**
   시행 수가 비슷하면(20×5=100 대 30×3=90) 검정력도 비슷하다. 대역이 50과제뿐이라 과제를 늘릴 여지에는
   상한이 있다. 모의의 효과 0 기각률은 3%(보수적). 외부 근거: 단일 실행 pass@1 이
   2.2~6.0%p 흔들림(B22), 같은 설정 반복 차이가 설정 간 차이보다 큼(B23), 짝 비교는 분산을 줄임(B20 권고 4).
5. **판정은 과제 단위 짝 차이 + 과제 군집 기준 불확실성으로 낸다.** 과제별 (B 통과율 − A 통과율)을
   단위로 삼고 과제 재표집 부트스트랩 또는 짝 t 로 CI 를 낸다(B20: 짝 표준오차 · 군집 표준오차 · 검정력
   분석 · B7: 과제군→과제→실행 3단 부트스트랩). pass@1 외에 pass^k(k회 모두 성공, B18 · S24)를 함께 낸다
   — 하네스는 "가끔 → 매번" 개선일 수 있다.
6. **판 간 비교는 "같은 날 A 를 다시 돈다"로 유지한다.** 모델 제공자 상태·시간대·자원이 점수를 움직인다
   (자원 설정만으로 6%p, 3%p 미만 차이는 설정 확인 전 의심하라 — B19). DeepSWE 도 판이 바뀌면 같은 설정을
   다시 돌려 비교했다(v1→v1.1 9개 설정 재실행, S2). → 하네스 판 N 을 잴 때마다 **같은 과제 고정 목록에
   A 와 B 를 섞어 같은 기간에** 돌리고, 과거 A 와 비교하지 않는다. A·B 순서는 과제마다 무작위로 섞는다.
7. **과제 묶음은 이름 붙은 판으로 고정한다.** 고정 항목: DeepSWE v1.1 + 과제 ID 목록 해시 + 선정 규칙 +
   Pier·Claude Code·모델 판 + 자원·시간 한도. 바뀌면 판을 올린다 — Terminal-Bench 의 의미 있는 판 번호
   (첫 자리 = 다시 돌림, 둘째 = 다시 채점, 셋째 = 재사용, S6)를 그대로 빌린다. METR 도 과제 묶음이 커지자
   TH1.0→1.1 로 판을 갈랐다(B8).
8. **비용·토큰을 정확도 옆에 함께 낸다.** DeepSWE(평균 비용·출력 토큰·스텝, 벽시계는 외부 변수라 폐지,
   S2 · B3), SWE-rebench(문제당 비용·토큰·캐시 비율, B11), Aider(총비용, B17), 정확도-비용 파레토(B24 · B25).
   우리는 구독 크레딧이라 달러보다 **토큰·스텝·턴·시간 한도 도달 수**를 1급 지표로 낸다.
9. **오염 관리는 우리 목적에선 부차적이다.** A·B 가 같은 모델이라 오염은 두 팔에 똑같이 걸린다. 다만 하네스
   B 가 과제를 외워 풀 수단(인터넷 검색 등)을 더하지 않는지는 DeepSWE 의 상류 저장소 검사·커밋 패치 채점(S2)과
   같은 방식으로 B 궤적만 따로 본다.
10. **이 근거의 한계** — 공개 데이터는 mini-swe-agent 하네스 결과이고 우리는 Claude Code 다. 우리 중단 결과
    9과제와 대조하면 GLM-5.3 공개 4/4 인 5과제는 우리 A 도 전부 통과, 0/4 인 2과제는 전부 실패, 3/4 인 2과제는
    둘 다 실패였다(● B2 × `full-partial/README.md`) — 방향은 대체로 맞지만 n=9 라 전이를 증명하지 못한다.

## 1. 어려운 과제 선정 · 난이도 정의

| 벤치마크 | 난이도 정의 | 선정 데이터와 평가 데이터 분리 | 근거 |
|---|---|---|---|
| SWE-bench Verified | 사람 추정 소요시간 4구간(<15분 · 15분~1h · 1~4h · >4h), "코드베이스에 몇 시간 익숙해진 엔지니어" 기준. 39% / 52% / 8% / 3건 | 사람 주석이라 모델 결과와 독립. METR 실측은 <15분 과제에 8~84분 — 낙관적 추정 | B6 ○ · B7 ○ · OpenAI 원문 △ |
| SWE-bench Pro | 정식 지표 없음. "전문가에게 몇 시간~며칠", 1~10줄 사소한 수정 제외, 저장소당 50~100개 상한 | 공개(copyleft) · 비공개 보류 · 상용 세트로 분리 — 보류 세트는 "향후 과적합 검사용" | B9 ○ |
| SWE-rebench | 미세조정 Qwen2.5-72B 가 Task Complexity 등 3개 라벨을 예측해 메타데이터로 제공(불완전하다고 명시). 1~15파일 변경 필터 | 모델 출시일 이전 이슈는 오염 가능으로 표시 | B10 ○ |
| SWE-bench-Live | 난이도 정의 미확인. 2024년 이후 이슈 1,319개 | 시간 기준 신선도 | B29 ○(초록) |
| Multi-SWE-bench | 주석자 2명이 독립 추정한 시간 → 쉬움 ≤15분 · 보통 15분~1h · 어려움 ≥1h | 사람 주석. 모델 해결률이 이 등급과 "밀접히 일치"했다고 보고 | B12 ○ |
| SWE-Lancer | 실제 Upwork 지급액($50~$32,000)을 가치·난이도 대리로 사용, 총 $1M | 가격은 모델과 독립. 공개 분할 = Diamond | B13 ○ |
| Terminal-Bench 2.0 | 저자 추정 사람 난이도(medium/hard) + 전문가·주니어 소요시간 추정. 별도로 **경험적 난이도** = 모델 통과율 ≥66.7% 쉬움 · 33.3~66.7% 보통 · <33.3% 어려움. 둘의 상관 r=0.436 | 두 정의를 따로 두고 비교함 | B14 ○ |
| Terminal-Bench 4.0 | 난이도 필드 설명 없음. 최신 세대 모델 전부가 5/5 푼 과제 = 포화로 제거 | 모델 결과로 **제거**만 함 | S6 ○ |
| METR (HCAST·RE-Bench·SWAA) | 성공한 사람 기준선의 기하평균 시간(800+ 기준선, 2,529시간). 기준선 없는 21개는 연구자 추정 | 난이도를 모델 결과에서 학습하지 않는다고 명시(IRT 와 차이) | B7 ○ |
| LiveCodeBench | 플랫폼 라벨(LeetCode) · 레이팅 구간(AtCoder 0–200/200–400/400–500, Codeforces ≤800/800–1000/1000–1300) | 플랫폼 값이라 모델과 독립 | B15 ○ |
| Aider polyglot | 697문제를 7모델이 풀어 **3개 이하가 푼 225문제**만 남김 — 점수가 5~50%에 퍼지도록 | 선정 모델과 평가 모델이 겹침(분리 안 함) | B16 ○ |
| BRIDGE · tinyBenchmarks | 모델 결과로 2PL IRT 난이도 추정, 로그 사람 시간과 선형 관계 / 100문항 앵커로 오차 ~2% | tinyBenchmarks 는 선정용 "train" 모델과 평가용 "test" 모델을 분리 | B27 ○(초록) · B26 ○ |

**우리 상황에 대한 함의**: 사람 시간 주석은 DeepSWE 에 없다(B4 의 과제 필드는 언어·저장소·프롬프트 길이뿐).
가장 가까운 독립 근거는 **공개 모델 해결률**이고, Aider·Terminal-Bench 가 그 방식을 쓴다. Aider 는 선정 모델로
평가도 했지만, 우리는 선정 데이터(B2)와 평가 실행이 완전히 분리된다는 점이 다르다.

## 2. DeepSWE 과제별 결과 공개 여부 — **공개돼 있다**

- 블로그(S2)에 113과제 과제별 통과율 표(v1 대 v1.1, 두 판 공통 설정 합산)가 있다. 본문은 "9 configurations",
  표 설명은 "10 configurations" 라고 적어 수가 서로 다르다.
- 데이터 화면 `https://deepswe.datacurve.ai/data/v1.1`(B1): 과제 × 모델 히트맵 · 과제 목록 · 시행 표.
  시행 하나하나의 궤적 화면 = `/data/v1.1/trials/<trial_name>`.
- **내려받는 법**(화면 JS 가 부르는 정적 JSON, 인증 없음, 2026-10-19 실측 HTTP 200):
  `curl -sL https://deepswe.datacurve.ai/artifacts/v1.1/trials.json` (51 MB, 31,617행, B2) ·
  `.../v1.1/leaderboard-live.json` (70설정, B3) · `.../v1.1/tasks.json` (113과제, B4) · `.../v1/trials.json` (v1, 24 MB).
- `trials.json` 한 행의 필드: `task_name · model · provider · harness(전부 mini-swe-agent) · config · reasoning_effort ·
  passed · outcome · included_in_score · f2p_passed/f2p_total · p2p_passed/p2p_total · cost_usd · n_output_tokens ·
  n_agent_steps · agent_duration_seconds · started_at · has_trajectory` 등 47개. 채점 제외 155건(`excluded_error`).
- 리더보드 정의(B3 `unit`): pass@1 = 채점된 시행의 통과 비율, pass@4 = 4회 중 한 번이라도 통과한 과제 비율,
  문맥창 초과·시간 초과는 실패로 세고 제공자·채점기·네트워크 오류는 뺀다. 설정당 `n_runs`=4(113과제 전체를 4번),
  `ci_method` = "95% run-to-run: 1.96 · std(runs)/√R". GLM-5.3 max = pass@1 0.690(±0.030) · pass@4 0.876 · 평균 $3.99 ·
  124스텝(B3, S2 에도 "69%±3%").
- 평가와 독립적인 난이도 근거로 쓸 수 있는가: **쓸 수 있다**(결론 1~3). 한계 = 하네스 차이(결론 10), 4회라
  과제별 추정 자체도 거칠다(GLM-5.3 앞 2회·뒤 2회 과제별 통과율 상관 0.62, ● B2).
- 재현(●): `trials.json` 에서 `included_in_score` 참 · `config == "mini_swe_agent_glm_5_3_max"` 로 과제별 통과 수를
  세면 0/4 14 · 1/4 10 · 2/4 14 · 3/4 27 · 4/4 48과제(1과제는 3회).

## 3. 반복 · 변동성 · 통계

| 출처 | 과제당 반복 | 불확실성 표기 |
|---|---|---|
| DeepSWE v1.1 | 설정당 전체 4회(S2 의 Fable 은 2,260시행 = 과제당 20) | 실행 간 표준오차 95%(B3). 설정별 ±0.5~6.5%p, 중앙값 2.6%p(● B3) |
| SWE-rebench | 모델당 전체 5회 | 평균의 표준오차 + pass@5(B10). 라이브 화면은 ± 와 Pass@5 만 표기, ± 정의는 화면에 없음(B11) |
| Terminal-Bench 2.0 | 에이전트·모델 조합당 최소 5회, 총 32,155시행 | 95% CI 를 내지만 계산법 미기재(B14) |
| METR | 논문 8회 · 현행 페이지 6회 | 논문 = 3단 계층 부트스트랩 1만 회, 과제군 크기의 역제곱근 가중(B7). 현행 그래프는 부트스트랩 CI 없음(B8) |
| LiveCodeBench | 문제당 10개 표본(temp 0.2) | pass@1(B15) |
| Epoch AI | 벤치마크별 8~16회 | 평균 ±1 표준오차, 방법은 B20 따름(B21) |
| AI Agents That Matter | 에이전트당 5회 | 평균 정확도·평균 비용, 오차 막대가 드문 것을 문제로 지적(B24) |
| τ-bench | k회 | pass^k = k회 모두 성공, gpt-4o 소매 pass^8 < 25%(B18) |

잡음 크기 보고: SWE-bench Verified 6만 궤적에서 단일 실행 pass@1 이 2.2~6.0%p 차이, temp 0 에서도 표준편차 >1.5%p,
"2~3%p 개선은 잡음일 수 있다"(B22) · 같은 설정 52회 반복에서 실행 간 차이가 설정 간 차이보다 크고 "수십~백 회 이상"
필요(B23, 과제 1개짜리 실험) · 자원 설정만으로 Terminal-Bench 2.0 6%p, 3%p 미만 차이는 의심, 여러 날·여러 시간대에
돌려 평균하라(B19) · 짝 차이는 상관 0.5 에서 분산 1/3 감소, 표본 수 공식 n=(z_{α/2}+z_β)²(ω²+σ_A²/K_A+σ_B²/K_B)/δ²(B20).

## 4. 오염 · 시간 관리와 판 관리

- **시간 창**: SWE-rebench = 모델 출시일 이전 이슈는 오염 가능 표시(B10), 라이브 화면은 날짜 창을 골라 그 창의 문제만
  집계(관측 시 15/05/2026~01/07/2026, 111문제·65저장소, B11). LiveCodeBench = 모델 학습 마감 뒤 공개 문제만,
  창을 "scrolling"(B15). SWE-bench-Live = 2024년 이후 이슈(B29).
- **비공개 보류 세트**: SWE-bench Pro 보류·상용 세트(B9), AI Agents That Matter 의 비공개 권고(B24).
- **판 번호와 재실행**: Terminal-Bench 의미 있는 판 번호와 `terminal-bench@4.0.0` 고정 호출(S6) · METR TH1.0→1.1(B8) ·
  DeepSWE v1→v1.1 은 과제는 같고 실행·채점만 바꾼 뒤 공통 설정을 다시 돌려 차이를 공개(S2), 가격이 바뀌면 비용을
  재계산하고 변경 기록을 남김(B5).
- **결과 보관**: SWE-bench 는 제출마다 해결 과제 목록 + 과제별 `patch.diff`·`report.json`·궤적을 요구(B28).
  → 우리도 판마다 과제별 원시 결과(reward·F2P·P2P·토큰·스텝)와 궤적을 남겨 나중 판과 과제 단위로 맞댈 수 있게 한다.

## 5. 비용 · 시간 보고

DeepSWE: 평균 비용·출력 토큰·스텝 + 기준 가격을 설정마다 문장으로 남김(`cost_basis`), 벽시계는 외부 변수라 폐지(S2 · B3 · B5).
SWE-rebench: 문제당 비용·토큰·캐시 토큰 비율(B11). Aider: 총비용·토큰·과제당 초(B17). AI Agents That Matter · HAL:
정확도-비용 파레토, HAL 은 21,730시행 약 $40,000 를 표준 실행기로(B24 · B25).

## 출처 표

| B번호 | 내용 | URL | 확인 |
|---|---|---|---|
| B1 | DeepSWE 데이터 화면(히트맵·과제·시행) | https://deepswe.datacurve.ai/data/v1.1 | ○ |
| B2 | DeepSWE v1.1 전 시행 JSON (31,617행) | https://deepswe.datacurve.ai/artifacts/v1.1/trials.json | ○ ● |
| B3 | DeepSWE v1.1 리더보드 JSON (pass@1·pass@4·CI 방법·비용) | https://deepswe.datacurve.ai/artifacts/v1.1/leaderboard-live.json | ○ ● |
| B4 | DeepSWE v1.1 과제 목록 JSON (난이도 필드 없음) | https://deepswe.datacurve.ai/artifacts/v1.1/tasks.json | ○ |
| B5 | DeepSWE 변경 기록 (재가격·재실행) | https://deepswe.datacurve.ai/changelog | ○ |
| B6 | Epoch — SWE-bench Verified 난이도 분포 | https://epoch.ai/publications/what-skills-does-swe-bench-verified-evaluate | ○ |
| B7 | METR 시간 지평 논문 (기준선·로지스틱·8회·3단 부트스트랩) | https://arxiv.org/html/2503.14499v4 | ○ |
| B8 | METR 시간 지평 현행 페이지 (TH1.1, 6회) | https://metr.org/time-horizons/ | ○ |
| B9 | SWE-bench Pro 논문 | https://arxiv.org/html/2509.16941 | ○ |
| B10 | SWE-rebench 논문 (5회·SEM·pass@5·난이도 라벨) | https://arxiv.org/html/2505.20411 | ○ |
| B11 | SWE-rebench 리더보드 | https://swe-rebench.com/ | ○ |
| B12 | Multi-SWE-bench 논문 (시간 기반 난이도) | https://arxiv.org/html/2504.02605 | ○ |
| B13 | SWE-Lancer 논문 | https://arxiv.org/abs/2502.12115 | ○ |
| B14 | Terminal-Bench 2.0 논문 (예측 대 경험적 난이도, ≥5회) | https://arxiv.org/html/2601.11868 | ○ |
| B15 | LiveCodeBench 논문 | https://arxiv.org/html/2403.07974 | ○ |
| B16 | Aider polyglot 선정 방식 | https://aider.chat/2024/12/21/polyglot.html | ○ |
| B17 | Aider 리더보드 | https://aider.chat/docs/leaderboards/ | ○ |
| B18 | τ-bench (pass^k) | https://arxiv.org/abs/2406.12045 | ○ |
| B19 | Anthropic — 인프라 잡음 | https://www.anthropic.com/engineering/infrastructure-noise | ○ |
| B20 | Miller — Adding Error Bars to Evals | https://arxiv.org/html/2411.00640 | ○ |
| B21 | Epoch 벤치마킹 허브 방법 | https://epoch.ai/benchmarks/about | ○ |
| B22 | On Randomness in Agentic Evals | https://arxiv.org/abs/2602.07150 | ○(초록) |
| B23 | Identical Runs, Different Results | https://arxiv.org/abs/2609.33812 | ○(초록) |
| B24 | AI Agents That Matter | https://arxiv.org/html/2407.01502 | ○ |
| B25 | Holistic Agent Leaderboard | https://arxiv.org/abs/2510.11977 | ○(초록) |
| B26 | tinyBenchmarks (앵커·IRT, train/test 모델 분리) | https://arxiv.org/html/2402.14992 | ○ |
| B27 | BRIDGE (IRT 난이도 ↔ 사람 시간) | https://arxiv.org/abs/2602.07267 | ○(초록) |
| B28 | SWE-bench experiments 저장소 (제출 산출물 구조) | https://github.com/SWE-bench/experiments | ○ |
| B29 | SWE-bench-Live | https://arxiv.org/abs/2505.23419 | ○(초록) |
| B30 | OpenAI — SWE-bench Verified 소개 | https://openai.com/index/introducing-swe-bench-verified/ | △ (403, 2차 출처로만) |

## 기각 · 확인 실패 원장 — 29 confirmed · 8 killed

confirmed = B1~B29 직접 읽음(초록만 읽은 6개는 표에 표시). killed(본문 결론에 쓰지 않음):
1. SWE-bench Verified 쉬운 196 · 어려운 45 개수와 주석자 구성 — OpenAI 원문 403(영문·스페인어판 둘 다), 검색 요약에만 있음.
2. DeepSWE 궤적 일괄 내려받기 형식 — 시행별 화면 경로는 있으나 궤적 파일 URL·형식은 확인 못 함.
3. Terminal-Bench 4.0 의 과제별 difficulty 필드 의미 — 4.0 공지(S6)에 설명 없음. 2.0 논문(B14) 정의만 썼다.
4. SWE-rebench 라이브 화면의 ± 정의와 현재 반복 횟수 — 화면에 없음. 논문(B10)의 5회·SEM 만 썼다.
5. METR TH1.0→1.1 전환 때 옛 모델을 다시 재서 이었다는 설명 — 2차 출처(futuresearch)만, METR 원문에서 못 찾음.
6. "팔당 16·sd²/gap² 회, 3회 비교는 28~44% 순위 오류" — agentpatterns.ai 가 B23 을 인용했지만 B23 초록에 그 수치 없음.
7. HAL "다회 일관성 검사 시 60%→25%" · Epoch "스캐폴드만으로 11~15%p" — 2차 기사만.
8. SWE-bench Pro 분할 개수 731/858/276 — 중국어 2차 기사만, 논문 본문에서 확인 못 함.

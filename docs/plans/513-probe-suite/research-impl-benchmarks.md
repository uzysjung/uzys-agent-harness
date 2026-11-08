# #513 조사 C — 구현 중심 벤치마크에서 "하네스가 결과를 바꾸는가"를 싸게 가를 과제 고르기 (조사 2026-11-09)

- 범위: 공개 논문·저장소·리더보드 읽기만 했다. 모델·벤치마크 실행 없음, 저장소 수정 없음(이 파일만 씀).
  공개 결과 JSON 두 묶음(FeatBench 논문 결과 · Harbor 패리티 결과)은 내려받아 집계만 했다(벤치마크 코드는 실행하지 않음 — §4.1 ✱).
- 표기: **○** 1차 출처(논문 본문·공식 저장소·공식 리더보드)를 직접 열어 확인 · **△** 2차 요약·검색 스니펫·집계 사이트 · **✗** 확인 못 함 ·
  **✱** 공개 데이터로 내가 계산·추정한 값. 접근일은 전부 **2026-11-09**.
- 앞선 조사(`research-tasks-tiers.md` · `research-item-selection.md`)와 우리 측정(`screen-v1.md` · `confirm-v1.md` · `superlight-recheck/README.md`)에서
  이미 다룬 것(SWE-bench Verified 변별 58 · OverEager · ImpossibleBench · FixedBench · CTXbench 등)은 다시 조사하지 않았다.

## 1. 결론 요약

1. **주 소스는 FeatBench(Harbor 판 `featbench`)다.** 코드 힌트 없는 자연어 기능 요청 · 실제 저장소 · 결정적 채점(F2P + 기존 테스트 P2P)이고,
   실패의 73.6%가 "요청보다 넓게 고쳐 기존 기능을 깨뜨림(scope creep → 회귀)"이다 — 하네스의 범위 · 검증 · 독립 리뷰가 겨냥하는 바로 그 실패다.
   중위 모델 9회 공개 실행에서 깨끗한 136과제 중 **42과제가 통과율 0.2–0.8 대역**(✱)이라 변별 후보를 처치 없이 미리 고를 수 있다(§4.1에 22개 목록).
2. **보안 축은 BaxBench**로 잰다. 기능 테스트와 전문가가 쓴 실제 공격 코드로 판정해 결정적이고, 1회가 작아(앱 1개) 싸다. 2025년 모델 기준 "맞게 돌지만 뚫리는" 비율이 약 절반이라 중간 대역이다.
   단 "보안 상기 문구"는 보안을 +1.6%p만 올리고 정답률을 −8%p 떨어뜨린 1차 증거가 있어, 효과가 작거나 음수일 수 있다는 것을 사전 등록한다.
3. **품질 축(선택)은 SlopCodeBench**의 결정적 정적 지표(장황도 · 구조 침식)로 잰다 — 우리 LLM 쌍대 판정(순서 일관성 6/12)을 대체한다.
   비싸므로 상위 등급이나 예산이 남을 때 문제 4개 × 앞 체크포인트 3개로만 돈다.
4. **예상 비용(두 소스, 선별 + 확인 A/B 3회)**: Opus 5.5 약 $360 · GLM-5.3 약 94k 크레딧(비혼잡 시간이면 약 47k, Pro 1주 안) · GLM-5.3-flash 약 31k 크레딧(✱, ±2배).
   과제 15개 × 3회로 통과/실패 차이를 잡으려면 약 +28–31%p가 필요하므로, 판정의 주력은 연속 지표(깨뜨린 기존 테스트 수 · 범위 밖 변경량 · 뚫린 CWE 수 · 토큰 · 시간)다.
5. **가장 큰 위험은 실행 환경이다**: 하네스(CLAUDE.md · 룰 · 훅 · 에이전트)를 Harbor의 Claude Code 에이전트 컨테이너에 넣는 공식 옵션은 스킬(`--skill`)과 설정(`--ak config=`)뿐이라
   사용자 정의 에이전트가 필요하고, B 팔이 2.5–8배 느리므로 시간 상한이 B를 불리하게 자르지 않게 해야 한다.

## 2. 후보 표

### 2-1. 기본 정보 (기능 구현 → 보안 → 유지보수 순)

| # | 소스 · 링크 | 과제 수 | 언어 | 과제 모양 | 환경 · 라이선스 | 오염 위험 |
|---|---|---|---|---|---|---|
| 1 | **FeatBench** — [arXiv 2509.22237](https://arxiv.org/html/2509.22237v2) (v1 2025-09-26, v2 2026-02-18) · [GitHub](https://github.com/TsinghuaISE/FeatBench) · [Harbor 어댑터](https://github.com/harbor-framework/harbor/tree/main/adapters/featbench) | 157(논문) · 156(저장소 · Harbor) · Verified 155([HF](https://huggingface.co/datasets/PGCodeLLM/FeatBench-Verified/blob/main/README.md)) ○ | Python ○ | 실제 저장소에 "이런 기능을 원한다"는 자연어 요청. **함수 시그니처 등 코드 힌트 없음** ○ | 과제별 Docker 이미지(GHCR) ○ · MIT ○ · Harbor `featbench` 어댑터 병합(2026-04, [PR #1218](https://github.com/harbor-framework/harbor/pull/1218)) ○ | 중 — 2024–25년 공개 PR 기반(created_at 범위 ✗). 6개월마다 갱신 계획(△), v2 판은 못 찾음 ✗ |
| 2 | **FeatureBench** — [arXiv 2602.10975](https://arxiv.org/html/2602.10975v1) (ICLR 2026 ○) | 200 · Lite 30(무작위) ○ | Python ○ | 기능을 지운 저장소에 기능 구현. **인터페이스(시그니처 · import 경로) 명시** ○ | Docker ○ · Harbor `featurebench`(200/30) ○([레지스트리](https://meridianlabs-ai.github.io/inspect_harbor/registry.html)) · 라이선스 ✗ | 중 |
| 3 | **NoCode-bench Verified** — [arXiv 2507.18130](https://arxiv.org/html/2507.18130v3) · [GitHub](https://github.com/NoCode-bench/NoCode-bench) | 634 · Verified 114 ○ | Python(10개 프로젝트, 대부분 SWE-bench와 같은 저장소) ○ | 사용자 문서 변경 → 그 기능 구현 ○ | Docker Hub ○ · MIT ○ · **리더보드 도메인(nocodebench.org)은 2026-11-09 현재 도박 광고 페이지** ✗ | 높음(SWE-bench 저장소) |
| 4 | FEA-Bench — [arXiv 2503.06680](https://arxiv.org/abs/2503.06680) · [GitHub](https://github.com/microsoft/FEA-Bench) | 1,401 ○ | Python ○ | PR 기반 새 함수 · 클래스 구현 | **전체 데이터 미공개 — GitHub 스크래핑으로 재구성** ○ · MIT ○ | 중–높음 |
| 5 | SWE-Dev — [arXiv 2505.16975](https://arxiv.org/abs/2505.16975v3) | 테스트 500 ○ | Python △ | 기능 주도 개발 ○ | [GitHub](https://github.com/DorothyDUUU/SWE-Dev) ○ · 라이선스 ✗ | 중 |
| 6 | **SWE-bench Pro (공개 731)** — [arXiv 2509.16941](https://arxiv.org/html/2509.16941) · [GitHub](https://github.com/scaleapi/SWE-bench_Pro-os) · [리더보드](https://labs.scale.com/leaderboard/swe_bench_pro_public) | 731(전체 1,865) ○ | Python · Go · JS · TS ○ | 버그 · 기능 · 리팩터 혼합. **문제 + 요구사항 + 인터페이스 명세를 준다** ○ · 평균 107줄 · 4.1파일 ○ | ghcr 이미지 ○ · MIT ○ · Harbor `scale-ai/swe-bench-pro`(731) ○ | 중(공개 GPL 저장소) |
| 7 | **Senior SWE-Bench v2026.06** — [Snorkel 블로그](https://snorkel.ai/blog/senior-swe-bench-evaluating-coding-agents-like-senior-engineers/) (2026-07-16) · [리더보드](https://snorkel.ai/leaderboard/senior-swe-bench/) · [GitHub](https://github.com/snorkel-ai/senior-swe-bench-v2026.06) | 100(공개 50) ○ | Python · TS · Elixir · Go · Rust ○ | **일부러 덜 명세된** "조사해서 고쳐라 / 설계해서 만들어라" 요청 ○ | Harbor 호환 ○ · 라이선스 ✗ | 낮음–중(2026-02 이후 PR ○, GLM-5.3 출시 2026-08 △) |
| 8 | FeatureLoop — [arXiv 2610.35488](https://arxiv.org/abs/2610.35488) (v2 2026-10-29) | 61 ○ | Go · Rust · JS · TS · Python ○ | 기능 요청 → 단계별 요구 추가(2–8단계) ○ | **코드 · 데이터 공개 없음** ✗ | — |
| 9 | Multi-SWE-bench — [arXiv 2504.02605](https://arxiv.org/abs/2504.02605) | 1,632 ○ | Java · TS · JS · Go · Rust · C · C++ ○ | 이슈(주로 버그) 해결 △ | HF 데이터 △ · CC BY 4.0(논문) ○ | 중 |
| 10 | SWE-Lancer Diamond — [GitHub(보관됨)](https://github.com/openai/SWELancer-Benchmark) | Harbor 판 463 = IC 198 + 관리자 265 ○ | JS/TS(Expensify) △ | 실제 외주 과제 | **원 저장소 2025-07-18 보관, openai/preparedness로 이관** ○ · Harbor ○ | 중 |
| 11 | Commit0 — [arXiv 2412.01769](https://arxiv.org/abs/2412.01769) | 54 라이브러리 △ | Python ○ | 명세 + 테스트로 라이브러리 처음부터 작성 ○ | 공개 ○ | 중 |
| 12 | DevBench — [arXiv 2403.08604](https://arxiv.org/abs/2403.08604v2) | 22 저장소 △ | Python · C/C++ · Java · JS △ | 설계 → 구현 → 테스트 수명주기 △ | 공개 △ | 높음 |
| 13 | SWE-rebench — [swe-rebench.com](https://swe-rebench.com/) | 창 2026-05-15–07-01, 111 ○ | 주로 Python(07-2026 묶음은 다언어 ○) | 최근 이슈 해결(버그 위주) | Docker · HF ○ · Harbor `swe-rebench-07-2026`(111) ○ | **낮음**(매달 새로 수집) |
| 14 | **BaxBench** — [arXiv 2502.11844](https://arxiv.org/html/2502.11844v3) · [GitHub](https://github.com/logic-star-ai/baxbench) · [HF](https://huggingface.co/datasets/LogicStar/BaxBench) | 392 = 시나리오 28 × 프레임워크 14 ○ | Go · JS · PHP · Python · Ruby · Rust ○ | OpenAPI + 글 명세로 백엔드 앱(단일 파일 위주) 작성 ○ | 테스트 · 공격은 Docker ○ · MIT ○ · v1.0.0(2025-09-13) ○ | 중(명세 · 테스트 공개) |
| 15 | **SusVibes** — [arXiv 2512.03262](https://arxiv.org/html/2512.03262v2) (v2 2026-02-16) · [GitHub](https://github.com/LeiLiLab/susvibes) | 200 · 프로젝트 108 · CWE 77 ○ | Python ○ | 과거 보안 수정이 있던 기능을 지우고 "이 기능을 만들어라" ○ · 평균 162K줄 맥락 · 정답 172줄 ○ | 과제별 이미지(x86_64) ○ · **300 GB 권장** ○ · MIT ○ | 중 |
| 16 | SecureVibeBench(구 SecureAgentBench) — [arXiv 2509.22097](https://arxiv.org/pdf/2509.22097) · ACL 2026 △ | 105 △ | C/C++(OSS-Fuzz) △ | 사람이 취약점을 넣었던 장면 재구성 △ | [GitHub](https://github.com/iCSawyer/SecureAgentBench) 옛 저장소는 2026-04-12 보관 ○ | 중 |
| 17 | SecRepoBench — [arXiv 2504.21205](https://arxiv.org/abs/2504.21205) (v3 2026-02-14) | 318 · C/C++ 27 저장소 · CWE 15 ○ | C/C++ ○ | 저장소 안 코드 완성 ○ | HF △ | 중 |
| 18 | CWEval — [arXiv 2501.08200](https://arxiv.org/abs/2501.08200) | △ | 다언어 △ | 함수 단위 보안 과제 △ | 공개 △ | 중 |
| 19 | SecCodePLT — [arXiv 2410.11096](https://arxiv.org/html/2410.11096v1) | △ | Python 중심 △ | CWE별 함수 과제 △ | HF △ | 중 |
| 20 | **SlopCodeBench** — [arXiv 2603.24755](https://arxiv.org/html/2603.24755) (v2 2026-05-07) · [scbench.ai](https://www.scbench.ai) · [GitHub](https://github.com/SprocketLab/slop-code-bench) | 36 문제 · 196 체크포인트(문제당 3–8) ○ | Python 트랙만 평가 ○ | **자기 코드를 계속 확장**하는 다단계 명세 ○ | 자체 CLI(Claude Code 에이전트 지원) ○ · MIT ○ · Harbor `gabeorlanski/slopcodebench`(36) ○ | 낮음–중 |
| 21 | **SWE Atlas 리팩터링** — [arXiv 2605.08366](https://arxiv.org/html/2605.08366v1) · [GitHub](https://github.com/scaleapi/SWE-Atlas) · [리더보드](https://labs.scale.com/leaderboard/sweatlas-refactoring) | 70 ○ | (묶음 전체) Go · Python · TS/JS · C/C++ ○ | **덜 명세된 목표형** 리팩터 요청(64%는 인터페이스 명시) ○ · 정답 35–2,073줄 ○ | Harbor + Modal ○ · Apache-2.0 ○ · v1.1(2026-11, 새 판정자로 재채점) ○ | 중 |
| 22 | CodeThread — [arXiv 2606.21804](https://arxiv.org/html/2606.21804v1) (2026-06-19) | 1,377(두 단계 과제) ○ | 10개 언어 ○ | 1단계 구현 → 2단계 원 이슈를 그 위에 ○ | [GitHub](https://github.com/shaswatpatel123/CodeThread) ○ · 라이선스 ✗ | 원 벤치마크와 같음 |
| 23 | SWE-CI — [arXiv 2603.03823](https://arxiv.org/html/2603.03823) | 100 △ | △ | 평균 71커밋 · 233일 진화를 CI 루프로 △ | HF · GitHub △ | 중 |
| 24 | SWE-EVO · EvoClaw — [2512.18470](https://arxiv.org/abs/2512.18470v1) · [2603.13428](https://arxiv.org/html/2603.13428) | 48 · 98 △ | △ | 릴리스 노트 · 마일스톤 단위 진화 △ | △ | 중 |

### 2-2. 채점 · 비용 · 하네스 근거

| # | 성공 채점 | pass/fail 너머 신호 (결정성) | 1회 비용 · 시간 | 스캐폴드 · 지시 · 등급 근거 | 이번 목적 |
|---|---|---|---|---|---|
| 1 FeatBench | F2P(새 기능, 평균 2.2개) **와** P2P(기존 테스트, 평균 1,692개) 모두 통과 ○ | **회귀(P2P 깨짐)가 실패의 주원인**: Trae 실패 122건 중 73.6% "회귀를 낸 구현" ○. 파일 단위 위치 일치율 ○. 과제별 `success_f2p` · `success_p2p` · 통과 테스트 목록 · 토큰 공개 ○ — 전부 결정적 | Trae 기준 과제당 1.07–2.90M 토큰(평균 1.98M) ○. Harbor 패리티는 시간 배수 3.0 사용 ○ | 2025 모델(Trae): 15.9–29.9% ○. **Harbor 패리티(2026-03~04): deepseek-v3.2 49.4% · gpt-5-mini 42.1% · codex+gpt-5-mini 48.3%** ○ — 중위 모델이 정확히 중간 대역. 같은 모델에서 Agentless ↔ Trae 차이 큼 ○ | **주 소스** |
| 2 FeatureBench | F2P + P2P(F2P 평균 62.7개) ○ | 통과 비율(연속) ○ | 과제당 입력 수백만 토큰(표 단위 모호 △) · 최대 500단계 ○ | Claude Code+Opus 4.5 Full 11.0% / Lite 20.0% ○. 인터페이스 제거 시 하락, 테스트 보여주면 급등 ○ | 바닥 위험(강한 모델도 11%) — 비추천 |
| 3 NoCode-bench V | F2P + P2P ○ | RT%(회귀 통과율) Agentless 67–80% · OpenHands 46–69% ○ | 과제당 0.1–2.3M 토큰 ○ | Claude-4-Sonnet: Agentless 28.1% · OpenHands 25.4% ○ | 오염 · 리더보드 문제로 보조 |
| 4 FEA-Bench | 단위 테스트(SWE-bench 하네스) ○ | 없음 | ✗ | DeepSeek-R1 약 10% △ | 데이터 재구성 부담 — 제외 |
| 5 SWE-Dev | 단위 테스트 ○ | 없음 | ✗ | 단일 턴 22.5%(어려움) · OpenHands 56.4% ○ | 제외 |
| 6 SWE-bench Pro | F2P + P2P(사람 검토) ○ | 없음 | 50턴 · $2 상한 분석 실행 ○ | Opus 4.6 51.9 · glm-4.6 9.67 ○. 같은 모델 스캐폴드 차 49.8–51.8 △. **문제만 줄 때 GPT-5 25.9→8.4%** ○ | 명세가 상세해 하네스 이득 자리가 좁다 — 보조 |
| 7 Senior SWE-Bench | 결정적 검증기 + 검증 에이전트 테스트 + LLM 루브릭 + "취향" 판정(Sonnet 4.6 + GPT-5.4 평균, A–F 중 D 초과) ○ | **"취향 있는 해결률" vs "기본 해결률" 차이**가 곧 품질 신호 ○. 판정자 · 사람 일치도 수치 없음 ✗ | Opus 4.8 약 $8/과제, Fable 5 약 $29 ○ · 풀이 상한 6시간 ○ | Opus 5.5 39.3/61.8 · **GLM-5.2 17.9/35.8** ○. Claude Code · Codex 조합이 "다소 높았다"(수치 없음) ○. 공개 50과제 중 약 절반이 0%, 11–89% 과제 11개 ○ | 상위 등급 보조(비쌈) |
| 8 FeatureLoop | 단계별 실행 검사 + 기준 회귀 스위트 ○ | 앞서 통과한 요구가 나중에 깨지는 비율(전체 11.4%) ○ | ✗(토큰만) | **Claude Code 2.1.74로 12모델: GLM 5.3 44.3% · GLM 5.3 Flash 36.1%(Full)** ○, 61과제 중 38개가 "일부 모델만 통과" ○ | 등급 근거로만(데이터 없음) |
| 13 SWE-rebench | 숨은 테스트 ○ | pass@5 공개 ○ | GLM-5.2 $1.40/문제 · Claude Code $3.39 ○ | **GLM-5.2 62.9% / pass@5 81.1%** ○ → 반복에 따라 갈리는 과제가 많다 | 기능 과제 아님 — 오염 낮은 회귀 경보용 |
| 14 BaxBench | 기능 테스트 전부 통과 ○ | **전문가 공격 코드(SQLi · 경로 탐색 · 평문 비밀 저장 등)가 하나도 안 먹혀야 sec_pass** ○ — 결정적. CWE 13종, 시나리오당 평균 3.3 ○ | 앱 1개 · 단발. 비용 ✗(§4.3 추정 ✱) | 2025 모델: o1 정답 62% · **맞는 코드의 약 절반이 뚫림** ○. Claude-3.5 Sonnet: 상기 없음 53.6/32.9 → **일반 보안 상기 45.5/34.5** → 정답 CWE 제공 41.0/35.4(정답/정답+안전, %) ○. 같은 모델의 OpenHands 에이전트: 59.5/31.8 → 47.7/35.1 → 45.9/39.0 ○(에이전트라도 일반 상기의 보안 이득은 +3.3%p) | **보안 축 추천** |
| 15 SusVibes | 기능 테스트(FuncPass) · 보안 테스트(SecPass, 상류 보안 수정 커밋의 테스트) ○ | 결정적 테스트 ○ | ✗ | **Claude Code + Claude 4 Sonnet 44.0/6.0**, SWE-agent 61.0/10.5 ○. 보안 프롬프트 2종 모두 순이득 없음(52.5/9.5 · 56.0/10.5) ○ | SecPass 바닥(≤12.5%) — 보조 |
| 16 SecureVibeBench | 기능 + 보안(정적 · 동적) △ | △ | ✗ | 최고 23.8% △. 명시적 보안 지시가 유의하게 안 올림 △ | C/C++ — 제외 |
| 17–19 | 테스트 · 크래시 · 보안 오라클 △ | △ | 작음 △ | GPT-5 39.3% secure-pass(SecRepoBench) △ | 함수 · 완성 단위 — 제외 |
| 20 SlopCodeBench | 체크포인트별 숨은 테스트: core · error · functionality · **regression(앞 체크포인트 테스트 전부)** ○ | **장황도 = (AST-grep 137규칙 표시 줄 ∪ 복제 줄) / LOC · 구조 침식 = 순환 복잡도 >10 함수의 복잡도 질량 비율** ○ — 정적 분석(결정적) | 체크포인트당 GLM 5.1 $1.47 · Opus 4.7 $2.17 · Opus 4.6 $3.17 ○ · 실행당 2시간 ○ | GLM 5.1 strict 9.7 · iso 13.8 · core 40.3 ○. **품질 지시(anti-slop · plan-first): 초기 침식 최대 −62.3% · 장황도 최대 −34.8%, 대신 strict −2.4/−3.6%p · 비용 +12.1%, 악화 속도는 그대로** ○ | **품질 축(선택)** |
| 21 SWE Atlas RF | 회귀 검사(P2P · 숨은 테스트 · **테스트 파일 수정 = 자동 실패**) + 필수 루브릭 전부 ○ | 과제당 루브릭 17.4개(유지보수성 · 잔여물 정리 · 안티패턴). **판정자 Opus 4.5 ↔ 사람 κ 0.88**(200건, 묶음 전체) ○ — 결정적은 아니나 신뢰도 공개 | ✗(6시간 상한 ○) | **같은 모델의 스캐폴드 차: Opus 4.7 Claude Code 48.6 vs mini-SWE 38.6, Opus 4.6 35.6 vs 29.6** ○ · GLM 5 24.2 → GLM 5.2 42.4 ○. 테스트만 보면 60–80%, 루브릭까지 15–40%p 낮음 ○ | 상위 등급 품질 대안 |
| 22 CodeThread | 2단계 P2P + F2P ○ | 정적 복잡도 4종 ○ | $3/인스턴스 상한(SWE-agent) ○ | **GLM 4.7: 남이 쓴 코드 위 → 자기 코드 위 Pro −13.1%p** ○ · 리팩터 과제가 가장 크게 하락(−8.2) ○ | 설계 참고 |
| 23–24 | 테스트 △ | EvoScore · 회귀 △ | 긴 진화(비쌈) △ | △ | 제외(작고 싼 시험에 안 맞음) |

**표에서 읽을 것**
- 하네스가 주장하는 가치(범위 · 회귀 · 엣지 케이스 · 덜 명세된 요청)를 **결정적으로** 재면서 **중위 등급이 중간 대역**인 공개 자산은 FeatBench가 유일하다.
  FeatureBench는 너무 어렵고, SWE-bench Pro는 명세를 다 줘서 하네스가 메울 빈칸이 좁다.
- "지시로 보안 · 품질이 오르나"의 1차 증거는 **세 곳 모두 같은 모양**이다: 지시는 표적 지표를 조금 올리고 성공률을 조금 깎는다(BaxBench · SusVibes · SlopCodeBench).
  우리 하네스도 같은 모양일 수 있으므로, **성공과 품질 · 보안을 따로 보고하고 합산하지 않는다**(기존 설계 §1 유지).
- 스캐폴드 민감도의 1차 증거는 SWE Atlas(같은 모델 +6~10%p)와 FeatBench(Agentless ↔ Trae 큰 차)다. 등급 근거는 FeatureLoop(GLM 5.3 44% · Flash 36%, Claude Code 위)다.

## 3. 축별 채점 방법

| 축 | FeatBench | BaxBench | SlopCodeBench(선택) |
|---|---|---|---|
| **성공** | Harbor 보상(F2P 전부 + P2P 전부 통과 = 1). F2P 통과 비율과 P2P 통과 여부를 **따로** 기록(어느 쪽이 움직였나) | 기능 테스트 전부 통과(pass@1) | 체크포인트별 core · iso 통과 |
| **회귀 · 사고** | ① 깨뜨린 P2P 테스트 수(연속) ② **이미 있던 테스트 파일을 고쳤는가**(기준 커밋에 있던 테스트 경로의 diff — SWE Atlas의 "테스트 수정 = 실패" 규칙을 기록용으로) ③ 시간 초과는 실패가 아니라 별도 범주 | 해당 없음(새 앱) | 체크포인트 2부터 regression 테스트 통과율 |
| **품질 · 보안** | **범위**: 정답 패치 파일 집합(`patch_files`) 밖의 비테스트 파일 변경 수 · 비테스트 변경 줄 수 ÷ 정답 줄 수(결정적, 우리 구성). 보조: 변경 파일의 ruff 위반 증감 · radon 복잡도 증감 | **sec_pass**(기능 통과 AND 공격 0건 성공) · 뚫린 CWE 수 · "맞은 것 중 뚫린 비율" | 장황도 · 구조 침식(논문 정의, 정적 분석)과 체크포인트에 따른 기울기 |
| **토큰** | Claude Code 결과 JSON 사용량을 출력 · 비캐시 입력 · 캐시 쓰기 · 캐시 읽기로 나눠 기록. 리뷰어 하위 에이전트 몫은 stream-json으로 따로. B/A 비율과 성공 1건당 | 같음 | 같음(체크포인트별) |
| **시간** | 컨테이너가 찍은 세션 시작–끝(confirm-v1에서 고친 방식). B/A 비율 | 같음 | 같음 |
| **과정(보조)** | 마지막 편집 뒤 기존 테스트를 돌렸나 · 리뷰어가 떴나 · 리뷰 뒤 수정 수 — 결과 지표와 분리 | 서버를 띄워 직접 호출해 봤나 | — |

- 우리가 새로 만드는 결정적 지표(범위 · 테스트 파일 수정)는 쓰기 전에 **변이 대조**한다: 정답 패치(0이어야 함) · 아무것도 안 한 패치 · 정답 + 무관한 파일 한 줄 편집(1이어야 함)에서 기대값이 나오는지 본다.
- 품질 판정자가 꼭 필요하면 SWE Atlas 방식(이진 루브릭 · 판정자-사람 κ 0.88 공개)을 쓴다. 자유 쌍대 비교는 우리 측정에서 순서 일관성 6/12로 실패했다.
- 통계는 `research-item-selection.md` 그대로: 과제 단위 정확 조건부 검정(성공) · 과제로 짝지은 log 비율 t(토큰 · 시간 · 연속 품질 지표).
  15과제 × 3회 × 두 팔의 통과/실패 검출 한계는 약 +28–31%p라 **성공 Δ는 큰 이득 · 해악 경보로만** 쓴다.

## 4. 과제 고르는 법과 예상 비용

### 4.1 FeatBench — 처치를 보지 않고 미리 고른 22개 (✱)

**방법**: 두 공개 결과를 합쳤다. 하네스 실행이 하나도 섞이지 않으므로 처치를 보지 않은(blind) 선별이고, 같은 과제를 다시 재도 귀무 오류율이 지켜진다(`research-item-selection.md` Q3).
- Harbor 패리티 9회 = trae+deepseek-v3.2 ×3 · trae+gpt-5-mini ×3 · codex+gpt-5-mini ×3(2026-03-31~04-10) — [results_collection](https://huggingface.co/datasets/harborframework/parity-experiments/tree/main/adapters/featbench/results_collection)의 `harbor__*.json`
- 논문 8구성 = 4모델 × Trae/Agentless — [paper_evaluation_results](https://github.com/TsinghuaISE/FeatBench/tree/main/paper_evaluation_results). "F2P는 통과했는데 P2P를 깨뜨린 구성 수"를 **회귀 서명**으로 셌다.
- 어댑터 README의 문제 과제는 뺐다(P2P가 늘 깨지는 4개 · 정답이 깨진 `tox-dev__tox-3534` · 흔들리는 `modelcontextprotocol__python-sdk-699` · xarray 전부).
- 결과(깨끗한 136과제): 9회 통과 0회 40개 · 9회 중 8회 이상 31개 · **0.2–0.8 대역 42개**, 그중 회귀 서명이 있는 것 27개.

| # | instance_id | 패리티 통과(9회) | 논문 Trae 통과(4모델) | 회귀 서명(8구성 중) |
|---|---|---|---|---|
| 1 | dynaconf__dynaconf-1237 | 7/9 | 0/4 | 8 |
| 2 | conan-io__conan-17123 | 4/9 | 0/4 | 7 |
| 3 | conan-io__conan-17300 | 7/9 | 1/4 | 7 |
| 4 | huggingface__smolagents-1314 | 4/9 | 2/4 | 5 |
| 5 | slackapi__bolt-python-1104 | 6/9 | 0/4 | 5 |
| 6 | huggingface__smolagents-1570 | 5/9 | 0/4 | 4 |
| 7 | stanfordnlp__dspy-8110 | 5/9 | 0/4 | 4 |
| 8 | conan-io__conan-17092 | 5/9 | 0/4 | 4 |
| 9 | huggingface__datasets-7309 | 7/9 | 0/4 | 3 |
| 10 | huggingface__datasets-7025 | 5/9 | 2/4 | 2 |
| 11 | iterative__dvc-10754 | 4/9 | 0/4 | 2 |
| 12 | FreeOpcUa__opcua-asyncio-1655 | 6/9 | 0/4 | 2 |
| 13 | fonttools__fonttools-3894 | 7/9 | 2/4 | 2 |
| 14 | stanfordnlp__dspy-7964 | 4/7 | 0/4 | 1 |
| 15 | jpadilla__pyjwt-979 | 7/9 | 3/4 | 1 |
| 16 | huggingface__datasets-7160 | 2/9 | 1/4 | 1 |
| 17 | aiogram__aiogram-1474 | 4/9 | 2/4 | 0 (대조) |
| 18 | encode__starlette-2732 | 4/9 | 1/4 | 0 (대조) |
| 19 | huggingface__smolagents-1302 | 5/9 | 2/4 | 0 (대조) |
| 20 | openai__openai-agents-python-842 | 4/9 | 3/4 | 0 (대조) |
| 21 | pybamm-team__PyBaMM-4073 | 5/8 | 1/4 | 0 (대조) |
| 22 | conan-io__conan-17470 | 4/9 | 0/4 | 0 (대조) |

- 1–16은 "범위를 넘겨 기존 기능을 깨뜨리기 쉬운" 과제(하네스 표적), 17–22는 회귀 서명이 없는 대조다 — 하네스가 표적에서만 이기는지, 아니면 전반적으로 달라지는지를 가른다.
- conan이 회귀 서명 상위를 차지한다(P2P가 수천 개). 묶음 안 conan은 4개 이하로 제한했다(2 · 3 · 8 · 22).
- **상위 등급(Opus 5.5)**: 위 대역은 2025–26년 중위 모델 기준이라 Opus는 천장으로 밀릴 수 있다. 패리티 1/9 대역(`conan-io__conan-18249` · `encode__starlette-2501` ·
  `huggingface__datasets-6931` · `huggingface__datasets-7162` · `instructlab__instructlab-3286` · `iterative__dvc-10573`)과 0/9 일부를 후보에 더한다.
- 트라이얼 이름이 잘려 ID를 확정하지 못한 2개(`koxudaxi__datamodel-code-generat…` · `openai__openai-agents-python-108…`)는 뺐다.

**절차(등급마다)**
1. 이미지마다 **정답 패치 1회 · 빈 패치 1회**(oracle · no-op)로 F2P · P2P 기준선을 확인한다 — 흔들리는 과제를 여기서 거른다. 모델 호출 0.
2. **A만 2회** 돌려 22개 중 A 통과가 1/2인 과제와 2회 합 기준 0.3–0.7 근처를 남긴다(목표 12–15개). 이 실행은 효과 계산에 쓰지 않고 버린다.
3. 남은 과제로 **새 시행 3회 × A · B**를 한 배치로 돈다(예산이 되면 위약 P 팔 추가 — "규칙 파일이 있다는 것 자체"의 효과를 가르는 팔).

### 4.2 BaxBench — 보안 축 후보 20개

- 프레임워크는 **Python-FastAPI · JavaScript-express** 두 개로 좁힌다(우리 설치자 생태계 · 컨테이너 단순).
- 시나리오는 데이터셋의 `potential_cwes` 수(✱, [HF 데이터](https://huggingface.co/datasets/LogicStar/BaxBench))로 내용 기준 선별하되, ffmpeg · imagemagick 같은 외부 바이너리가 필요한 것은 뺀다:
  **SecretStorage(5) · ImageTransfer(5) · Login(4) · ProfileCollection(4) · ShopOverview(4) · ShoppingCartService(4) · UserCreation(4) · Forum(3) · FileSearch(3) · Calculator(3, CWE-94)** × 2 = 20.
- 에이전트화: BaxBench 환경 이미지 안에서 Claude Code에 같은 명세를 주고(서버 실행 · 자체 확인 허용), 생성 파일을 BaxBench `results/` 경로에 넣어 `--mode test`로 채점한다(외부 생성 해법 투입 지원 ○, 저장소 README).
- 선별: A 2회. **A가 기능은 통과하고 공격은 일부 먹히는** 과제를 우선해 10–12개를 남긴다(그래야 보안 차이가 보인다). 확인은 새 시행 3회 × A · B.

### 4.3 SlopCodeBench — 품질 축(선택)

- 문제 4개 × **앞 체크포인트 3개**(체크포인트 2–3에서 regression 테스트 · 침식 기울기를 볼 수 있는 최소 길이). 문제는 체크포인트 수 4–5개인 것으로 고른다(문제별 수는 별도 `scb-problems` 저장소에 있음 — 확인 ✗).
- 정적 지표는 연속값이라 과제 수가 적어도 검출력이 높다. 예산상 **Opus 5.5 · GLM-5.3 중 한 등급, 2회 반복**부터 시작한다.

### 4.4 1회 비용과 등급별 예산 (✱ 추정 — 첫 실행의 실제 사용량으로 바꾼다)

**가정**
- 단가 = `research-tasks-tiers.md` §5의 공식 값 재사용. Opus 5.5: 캐시 쓰기 $5 · 캐시 읽기 $0.20 · 출력 $20 /MTok.
  GLM 크레딧 = (입력×배수 + 캐시 입력×배수 + 출력×배수) ÷ 10,000, 배수 GLM-5.3 6.9/1.7/24 · Flash 2.3/0.56/8.
- FeatBench A 1회 = 캐시 쓰기 120k · 캐시 읽기 1.45M · 출력 30k. 공개 결과에서 Trae 실행의 과제당 토큰 중앙값이 1.57M(✱)이다.
- BaxBench A 1회 = 캐시 쓰기 40k · 캐시 읽기 360k · 출력 10k.
- B 배수: FeatBench 2.2(우리 DeepSWE 재분석의 비용 비) · BaxBench 2.5(보안 성격 중간 과제에서 리뷰어가 6/6 떴음).
- GLM-5.3은 장황하다는 관측이 있다(FeatureLoop: 성공 1건당 토큰이 Grok 4.6의 약 7배 ○). 그래서 ±2배 폭을 둔다.

| 단위 | Opus 5.5 | GLM-5.3 (크레딧) | GLM-5.3-flash (크레딧) |
|---|---|---|---|
| FeatBench A 1회 / B 1회 | $1.5 / $3.3 | 400 / 880 | 130 / 290 |
| BaxBench A 1회 / B 1회 | $0.47 / $1.2 | 110 / 280 | 37 / 93 |
| SlopCodeBench 체크포인트 1개(A) | 약 $2.2(Opus 4.7 실측 ○ 준용) | 약 920 | 약 300 |

| 계획(등급당) | 실행 수 | Opus 5.5 | GLM-5.3 | flash |
|---|---|---|---|---|
| FeatBench 선별 22×A2 + 확인 15×3×(A+B) | 44 + 90 | ≈ $280 | ≈ 75k | ≈ 25k |
| BaxBench 선별 20×A2 + 확인 12×3×(A+B) | 40 + 72 | ≈ $78 | ≈ 19k | ≈ 6k |
| **두 소스 합** | 246 | **≈ $360** | **≈ 94k**(비혼잡 ≈ 47k) | **≈ 31k**(비혼잡 ≈ 16k) |
| (선택) SlopCodeBench 4문제×3체크포인트×2회×(A+B) | 체크포인트 48 | ≈ $160 | ≈ 66k | ≈ 22k |

- GLM 두 등급 합(두 소스)은 비혼잡 시간 기준 약 63k 크레딧 — Pro 주간 60k를 약간 넘는다. Max 1주(140k)면 혼잡 시간에도 들어간다.
- 앞서 계획한 작은 판단 과제 묶음(Opus 약 $17)보다 약 20배다. 구현 과제는 이 비용이 기본값이라, **GLM-5.3에서 FeatBench 22×A1(≈ 9k 크레딧)로 대역부터 확인**하고 본 실행을 정한다.
- 벽시계: Harbor 패리티가 시간 배수 3.0을 썼다 ○. B는 우리 측정에서 2.5–8배 느렸다. FeatBench 1회 10–30분(✗ — Harbor SWE-bench 안내의 일반값 △)이면 등급당 246회는 동시 2개로 약 1–2일이다.

**왜 이 과제들이 두 팔을 가를 것으로 보나**
- FeatBench: 실패의 대부분이 회귀를 낸 구현이고, 하네스는 "요청이 필요로 하는 만큼만 바꾸고 기존 계약을 지킨다 · 실행해 보지 않은 것은 통과가 아니다 · 결과에 영향 큰 변경은 독립 리뷰"를 지시한다.
  비슷한 규칙 한 줄("관련 없는 리팩터 금지")을 빼자 −20%p가 났다는 선행 결과가 있다(`research-tasks-tiers.md` R1, Opus 4.6). 중위 모델 대역이 0.2–0.8이라 양쪽이 모두 0이나 100으로 붙을 가능성이 낮다.
  반대 증거: 컨텍스트 파일은 성공률을 못 올렸다(CTXbench, 같은 문서 R4). → **성공보다 깨뜨린 기존 테스트 수 · 범위 밖 변경량이 먼저 움직일 것**으로 사전 등록한다.
- BaxBench: 맞는 코드의 약 절반이 뚫린다(2025). 하네스 B 팔은 보안 성격 과제에서 리뷰어가 늘 떴다. 상기 문구 하나는 효과가 거의 없었으므로 이 축은 **"리뷰어가 상기 문구 이상을 하는가"**를 보는 자리다. 효과가 0 또는 음수(정답률 하락)일 수 있다.
- SlopCodeBench: 품질 지시가 초기 침식 · 장황도를 최대 1/3–2/3 줄였다. 하네스의 "가장 단순한 충분한 해법" 원칙이 같은 방향으로 작동하는지를 결정적 지표로 본다.

## 5. 위험과 미확인

**실행 환경**
- **하네스 주입**: Harbor의 Claude Code 에이전트는 과제 컨테이너 안에 설치 · 실행되고(△ — `skip_install` 설명에서 유추), 공식 문서가 밝힌 주입 경로는 `--skill`(스킬 → `$CLAUDE_CONFIG_DIR/skills`) ○ ·
  `--ak config=<settings.json>` ○ · `--ae`(환경변수) ○ · `--base-url` ○뿐이다. CLAUDE.md · `.claude/rules` · 훅 · 에이전트 정의를 넣는 옵션은 문서에서 못 찾았다 ✗.
  → Claude Code 에이전트를 상속한 **사용자 정의 에이전트**에서 설치 단계에 하네스 파일을 복사한다([custom agents 문서](https://docs.harborframework.com/agents/custom-agents.md) 존재 ○, 내용 미확인 ✗).
- 배포 훅 2개는 bash다(이 저장소 `templates/hooks/*.sh` 확인 ○, jq는 선택). 설치기는 Node(npx)가 필요하므로 **호스트에서 설치한 파일 묶음을 복사**하는 쪽이 Python 이미지에서 안전하다.
- GLM 연결: Harbor `--base-url`이 통합의 추측보다 우선한다 ○. Z.ai 엔드포인트 · 모델 고정은 앞선 조사의 방식(`--model` 명시)을 따른다.
- **시간 상한이 B를 자른다**: B가 2.5–8배 느렸다. 상한은 A 중앙값의 3배 이상으로 두고, 시간 초과는 실패가 아니라 별도 범주로 센다(사전 등록). 체계적으로 B만 잘리면 그것 자체를 비용 결과로 보고한다.
- 이미지: SusVibes는 x86_64 · 300 GB 권장 ○. FeatBench GHCR 이미지의 아키텍처 · 크기는 ✗ — Apple Silicon에서는 에뮬레이션으로 느릴 수 있어 x86 호스트를 권한다.
- 흔들리는 테스트: FeatBench는 어댑터가 문제 과제를 걸러 주지 않는다 ○ → §4.1의 제외 목록 + 이미지별 oracle · no-op 1회.

**측정 타당성**
- 사전 선별 대역은 2025–26년 중위 모델(deepseek-v3.2 · gpt-5-mini 등) 기준이다. GLM-5.3 등급에 그대로 옮겨진다는 것은 추론이다(FeatureLoop의 GLM 5.3 44% · Flash 36%가 근거 △). 그래서 등급별 A 선별을 생략하지 않는다.
- 오염: FeatBench · NoCode-bench · BaxBench는 모두 모델 학습 시점 이전에 공개됐다. 짝지은 A/B 차이에는 대체로 상쇄되지만 **천장을 올려** 변별 과제를 줄인다.
  네트워크를 막아 상류 PR 조회를 차단한다(Senior SWE-Bench는 GitHub 검색 같은 보상 해킹으로 과제를 점수에서 뺐다 △ — 26개는 검색 요약 수치).
- 지시의 양면성: 보안 상기(BaxBench) · 보안 프롬프트(SusVibes) · 품질 프롬프트(SlopCodeBench) 모두 성공률을 깎았다 ○. 하네스가 품질을 올리고 성공을 낮추는 결과도 "효과 없음"이 아니라 결과로 보고한다.
- 위약 팔: 무작위 규칙 파일도 큐레이션 규칙만큼 효과를 냈다는 선행 결과(R1)가 있어, 예산이 되면 P 팔을 더한다. 없으면 "내용 효과"를 주장하지 않는다.

**확인하지 못한 것 ✗ · △**
- BaxBench 현행 리더보드 수치(페이지 행이 로드되지 않음) ✗ — 2026년 모델의 "뚫리는 비율"이 아직 절반인지 모른다.
- SusVibes 과제별 결과 · 비용 ✗ · Senior SWE-Bench 라이선스 · 판정자-사람 일치도 ✗ · SWE Atlas 리팩터 비용 ✗ · FeatureBench 토큰 표의 단위 △.
- FeatBench `created_at` 범위 · 차기 판(v2) ✗ · GLM-5.3의 SWE-bench Pro 공식 수치 ✗(집계 사이트에 엇갈린 값만 있음 △).
- Harbor 패리티 원자료 폴더(`harbor_parity/`, 3.13 GB)의 시행별 궤적은 열어 보지 않았다. §4.1은 결과 요약 JSON(과제별 보상)만 썼다.
- SlopCodeBench 문제별 체크포인트 수 ✗ · Harbor 판 SlopCodeBench가 정적 품질 지표까지 내는지 ✗(저장소 README에는 LLM 판정 명령도 있다 ○).
- NoCode-bench 리더보드 도메인이 도박 광고로 바뀌어 있었다(2026-11-09) — 그 사이트의 수치는 쓰지 않는다.

# 기능 구현 밖의 판단을 재는 과제 소스 조사

- 조사일: 2026-11-09 · 방법: 웹 검색과 1차 출처(논문 본문 · 공식 저장소 README와 파일 트리 · 데이터셋 카드 · HF API 목록) 열람. 외부 코드는 실행하지 않았다. 과제별 결과 집계는 공개 JSON 을 내려받아 내가 쓴 집계 스크립트로만 셌다.
- **표기**: **[검증]** = 1차 출처를 열어 확인(페이지 요약 도구를 거쳤으므로 숫자를 인용하기 전에 원문을 한 번 더 보는 편이 안전하다) · **[집계]** = 공개된 과제별 결과 파일을 직접 세서 얻은 값 · **[2차]** = 검색 요약이나 2차 출처에만 있음 · **[추정]** = 내 추론이나 계산(근거를 함께 적음).
- 이미 조사한 소스는 다시 평가하지 않았다: FeatBench · NoCode-bench · SWE-bench Verified/Pro(버그 수정 한 줄 확인만 2.7에) · Multi-SWE-bench · FEA-Bench · SWE-Dev · BaxBench/AutoBaxBench · CWEval · SecRepoBench · SlopCodeBench · OverEager-Bench · ImpossibleBench · FixedBench · CTXbench · SABER · EvilGenie · OctoBench · DeepSWE · SWT-bench.
- **추가 기준(2차 지시)**: "강한 모델이 실패한 공개 과제"에서 고르려 하므로 각 표에 **과제별 공개 결과** 열을 더했다. 강한 모델 = GPT-5 이상 · Claude Opus/Sonnet 4.x 이상 · Gemini 2.5 Pro 이상(그리고 같은 세대의 GLM-5.x 등). 과제별 결과가 없거나 그보다 약한 모델 결과뿐인 소스는 우선순위를 내렸다.

---

## 1. 결론 요약

**과제별 공개 결과 기준을 적용한 뒤의 판정**

| 관점 | 추천 (우선순위 순) | 한 줄 판정 |
|---|---|---|
| 1. 기술 선택 | **자작 패턴 T1–T4** | 전용 공개 벤치를 찾지 못했다. 가까운 공개 소스(SWE-Lancer Manager · RepoExec · LLM 라이브러리 선호 데이터) 중 **강한 모델의 과제별 결과를 공개한 것은 하나도 없다**. 공개 소스에서 "강한 모델이 실패한 과제"를 고르는 방법은 이 관점에서 쓸 수 없다. 자작 과제의 난도는 우리 쪽 시험 실행으로 보정해야 한다. |
| 2. 아키텍처 · 설계 | **CodeTaste 열린 트랙** → 자작 D1–D4 / 보류: SWE-Lancer Manager | CodeTaste 는 Opus 4.6 · Sonnet 4.5 · GPT-5.2 · GPT-5.1-Codex-Max 의 **과제별 출력과 평가 결과를 내려받을 수 있다**(약 4.5 GB). 열린 트랙의 최고 정렬 점수가 7.9% 라 거의 모든 과제가 강한 모델에게 미해결이다. SWE-Lancer Manager 는 결정적 채점과 라벨 일치 99% 가 장점이지만 과제별 결과가 없고, 논문 모델도 Claude 3.5 Sonnet · o1 · GPT-4o 세대라 우선순위를 내린다. |
| 3. 그린필드 | **NL2Repo-Bench**(집계만 있음) · E2EDev / 보조: DevBench · PRDBench | **강한 모델의 과제별 결과를 공개한 그린필드 소스는 찾지 못했다**. NL2Repo 는 집계 표에서 Claude Code + Sonnet 4.5 가 104개 중 **3개만 완전히 통과**했으므로 101개는 그 설정에서 완전 통과하지 못했다[추정: 표의 값에서 뺌]. 하지만 어느 과제인지는 알 수 없다. ProjectEval · DevAI 는 과제별 결과가 있지만 GPT-4o · Gemini 2.0 · 2024년 에이전트 세대라 기준에 못 미친다. |
| 4. 유지보수성 침식 | **EvoClaw(SWE-Milestone)** → FeatureArc / 보조: SWE-CI · MaintainBench · SWE-EVO | EvoClaw 는 **마일스톤별 평가 결과를 담은 궤적 데이터셋을 공개**했고, Claude Code 위의 Opus 4.5–4.8 · Sonnet 4.5/4.6 · **GLM-5.3**, Codex 위의 GPT-5.2–5.6, Gemini CLI 위의 Gemini 3 Pro/3.1 Pro 가 들어 있다[검증: HF 목록]. HF 로그인과 조건 동의가 있어야 받을 수 있어 못 푼 수는 세지 못했다. FeatureArc 는 GLM-5.3 이 체인 게이트 31.5% 로 측정돼 있지만 집계뿐이고 공개 여부도 확인하지 못했다. |
| 5. 동작 보존 리팩터링 | **CodeTaste** → RefactorBench · SWE-Bench ProMax | CodeTaste 만 강한 모델의 과제별 결과를 공개했다. 나머지는 집계뿐이거나 결과가 없다. |
| 6. 명확화 · 가정 공개 | **LHAW(SWE-Bench Pro 부분)** → 자작 C1 / 보류: Ambig-SWE · HumanEvalComm · ClarifyCodeBench | LHAW 는 변형마다 시행 결과에서 도출한 라벨("결과에 결정적" 등)과 시행별 체크포인트 벡터를 공개한다. 다만 **어느 모델의 시행인지는 데이터에 없다**[검증: HF 행 조회]. 논문은 SWE-Pro 에서 GPT-5.2 · Sonnet 4.5 · Gemini 3 Pro/Flash 를 돌렸다. SWE-Pro 쿼터상 "결과에 결정적" 변형은 50개다[검증]. 다른 소스는 과제별 결과가 없거나 구형 모델 결과뿐이다. |
| 참고: 버그 수정 | SWE-bench Verified · **SWE-bench Pro V2 HARD-51** | 아래 2.7 한 줄 참고. |

**추천 순위표 — 과제별 공개 결과 기준(ⓐ · ⓑ · ⓒ)**

정렬 규칙: ⓐ 과제별 결과가 실재하고 ⓑ 강한 모델 결과를 포함한 공개 소스 → 자작 패턴 → 집계만 있는 공개 소스 → 결과가 없거나 구형 모델 결과뿐인 공개 소스. 자작 패턴은 이 기준과 무관하다(우리 파일럿으로 실패 항목을 직접 만든다).

| 관점 | 순위 | 소스 | ⓐ 과제별 결과 실재 (경로) | ⓑ 모델 · 스캐폴드 (강한 모델 포함?) | ⓒ 강한 모델이 못 푼 수 |
|---|---|---|---|---|---|
| 1 기술 선택 | 1 | 자작 T1–T4 | 해당 없음 | 해당 없음 | 파일럿으로 직접 만든다 |
| | 2 | MigrationBench (보조) | **없음** — 리더보드 집계(`docs/leaderboard.md`)뿐, 제출 브랜치에는 양식만 [검증] | Claude Sonnet 4.5(Strands, Hybrid/Agentic) · GLM-5 · Qwen3-Coder · DeepSeek-V3.1 — **포함** [검증] | 공개 수 없음. 집계로 Sonnet 4.5 최대 이전 약 140/300 · 최소 이전 약 85/300 미해결 [추정: 비율 × 300] |
| | 3 | SWE-Lancer Manager | **없음** — preparedness 에 과제 목록 CSV · 이슈 데이터만 [검증: 트리] | 논문: Claude 3.5 Sonnet · o1 · GPT-4o — **미달** [검증] | 공개 수 없음. Claude 3.5 Sonnet Diamond 44.9% → 약 146/265 [추정] |
| 2 아키텍처 · 설계 | 1 | **CodeTaste 열린 트랙** | **있음** — GitHub logic-star-ai/codetaste 릴리스 v1.0.0 `outputs.z01–z04` + `outputs.zip`(합계 약 4.5 GB). 과제별 `outputs/<track>/<mode>/<owner>/<repo>/<hash>/<agent>/evaluation/evaluation_result.json` [검증: README · 릴리스 크기] | 에이전트 폴더 `agents/claude/{opus46, sonnet45, haiku45, minimax-m2.7}` · `agents/codex/{gpt52, gpt51-codex(-max/-mini), gpt5-nano}` · `agents/qwen-code/…` — **포함**(Opus 4.6 · Sonnet 4.5 · GPT-5.2) [검증: 트리]. 폴더 이름으로 보아 Claude Code · Codex CLI 스캐폴드 [추정] | 공개 수 없음 — 내려받아 세야 한다(이번에는 용량 때문에 안 셈). 열린 트랙 최고 정렬 7.9%(direct) · 15.1%(plan) [검증] → 대부분 미해결 [추정] |
| | 2 | 자작 D1–D4 | 해당 없음 | 해당 없음 | 파일럿으로 직접 만든다 |
| | 3 | SWE-Lancer Manager | 없음 (위와 같음) | 미달 | 위와 같음 |
| 3 그린필드 | 1 | NL2Repo-Bench | **없음** — 논문 집계만, 과제별 표 · 궤적 공개 문구 없음 [검증] | Claude Code · OpenHands · Cursor + Sonnet 4.5, Cursor + Gemini 3 Pro, OpenHands + GPT-5 — **포함** [검증] | 완전 통과 못 한 수: Sonnet 4.5 + Claude Code 101/104 · Gemini 3 Pro 101/104 · GPT-5 103/104 [추정: 표의 Pass@1 수에서 뺌]. 어느 과제인지 모름 |
| | 2 | E2EDev | **없음** — 저장소에 예시 결과 1개 [검증] | 미확인 | 없음 |
| | 3 | PRDBench | **없음** [검증: 트리] | 논문 집계에 Claude Code [2차] | 없음 |
| | 4 | DevBench | **없음** [검증: 트리] | GPT-4 세대 — 미달 | 없음 |
| | — | (ProjectEval · DevAI) | 있음(`official-result/` · `benchmark/judgment/`) [검증] | GPT-4o · Gemini 1.5/2.0 Pro · 2024년 에이전트(GPT-Pilot · MetaGPT · OpenHands) — **미달** | 기준 밖 |
| 4 유지보수성 침식 | 1 | **EvoClaw / SWE-Milestone** | **있음** — HF `DeepCommit-ai/SWE-Milestone-log` 의 `<repo>/{e2e_trial, mstone_trial}/<agent>/evaluation/<milestone>/evaluation_result.json`. MIT, 로그인 · 조건 동의 필요 [검증: HF API 목록 · 카드] | ripgrep 기준 e2e 35종: Claude Code + Opus 4.5/4.6/4.7/4.8 · Sonnet 4.5/4.6 · GLM-5/5.1/5.2/**5.3** · Kimi K3 · DeepSeek V4 Pro, Codex + GPT-5.2–5.6, Gemini CLI + Gemini 3 Pro/3.1 Pro · 3/3.5 Flash, OpenHands + Opus 4.6 등 — **포함** [검증] | 공개 수 없음 — 조건 동의 후 세야 한다. 집계: e2e 최고 해결률 13.37%(Gemini 3 Pro) · 최고 점수 38.03% [검증] → 마일스톤 대부분이 미해결 [추정] |
| | 2 | FeatureArc | **없음** — 공개 문구를 찾지 못함 [검증] | Claude Opus 5.5 · GPT-6 Astra · GLM-5.3 등 10종 — **포함** [검증] | 공개 수 없음. 집계로 Opus 5.5 약 37/73 · GLM-5.3 약 50/73 체인 게이트 실패 [추정: 73 × (1 − 비율)] |
| | 3 | SWE-CI | **없음** [검증: 트리] | 18개 모델(Claude Opus 등) — 포함 [검증] | 없음(그림으로만 보고) |
| | 4 | MaintainBench · SWE-EVO | **없음** | 미확인 / GPT-5.4 + OpenHands 25% [검증] | 없음 |
| 5 리팩터링 | 1 | **CodeTaste**(지시 · 열린 트랙) | **있음** (관점 2 와 같음) | **포함** (관점 2 와 같음) | 공개 수 없음 — 세야 한다. 지시 트랙 최고 정렬 69.6%(GPT-5.2) [검증] |
| | 2 | SWE-Bench ProMax | **없음** — HF 카드에 과제별 결과 · 궤적 언급 없음 [검증] | GPT-5.2 + OpenHands 등 — 포함 [2차] | 공개 수 없음. 최고 41.2% → 약 100/170 [추정] |
| | 3 | RefactorBench | **없음** [검증: 트리] | 2024년 세대 — 미달 [추정] | 없음 |
| 6 명확화 | 1 | **LHAW (SWE-Bench Pro 부분)** | **부분** — HF `ScaleAI/lhaw` 변형마다 `terminal_states`(시행별 0/1 체크포인트 벡터) · `ambiguity_class` [검증: 행 조회] | 데이터에 **모델 이름 없음**. 논문 SWE-Pro 평가: GPT-5.2 · Sonnet 4.5 · Gemini 3 Pro · Gemini 3 Flash(SWE-agent 포크) — 포함 [검증] | "결과에 결정적" 변형 **50/100**(시행 에이전트가 정보 없이 계속 실패, 정의상) [검증] |
| | 2 | 자작 C1 | 해당 없음 | 해당 없음 | 파일럿으로 직접 만든다 |
| | 3 | Ambig-SWE | **없음** [검증: 트리] | OpenHands + Claude Sonnet 4 등 — 일부 포함 [검증] | 없음 |
| | 4 | HumanEvalComm · ClarifyCodeBench | **없음** / 미확인 | 구형 / 미확인 | 없음 |
| 버그 수정 | — | SWE-bench Verified · Pro | **있음** — swe-bench/experiments · SWE-bench_Pro-os `traj/` · `v2/hard51_ids.txt` | Opus 4.5/4.6 · GPT-5.2 · Gemini 3 Pro · Sonnet 4.5 · GPT-5 | Verified 상위 6개 모두 실패 **66/500** · Pro v1 Sonnet 4.5 + GPT-5 둘 다 실패 **352/730** [집계] · Pro V2 **HARD-51** [검증] (2.7 참고) |

**공통 주의**
- **"강한 모델이 모두 실패" ≠ "판별력 있음"** — 시험이 깨졌거나 명세가 모호해서 실패했을 수 있다. SWE-bench Pro V2 는 정답 패치 통과 · 빈 패치 실패로 과제를 거르고 모호한 3개를 뺀 뒤 HARD-51 을 냈다[검증]. 다른 소스에서 고를 때도 같은 관문(정답 통과 · 빈 패치 실패 · 명세 재검토)이 필요하다[추정].
- 함수 단위 소스(MaintainBench · HumanEvalComm · Aider refactor)는 GLM-5.3 급에서 천장일 위험이 크고 과제별 강한 모델 결과도 없다. 둘 다 우선순위를 낮추는 쪽이다[추정].

---

## 2. 관점별 상세

열 설명: **형태 · 수 · 언어** / **채점**(결정성 · 판정자–사람 일치도) / **공개 · Docker · 라이선스** / **과제당 비용 · 시간** / **판단 분리**(그 판단을 구현 능력 등 다른 요인과 떼어 재는가) / **오염 위험** / **과제별 공개 결과** — ⓐ 과제별(인스턴스별) 결과가 실제로 있는지(파일 · 저장소 경로 · 다운로드) · ⓑ 어느 모델 · 스캐폴드의 결과인지(강한 모델 포함 여부) · ⓒ 그 강한 모델들이 못 푼 과제 수(공개 수치 또는 집계에서 계산한 값).

**과제별 결과 확인 방법**: 각 공개 저장소의 파일 트리에서 `result|leaderboard|score|traj|judg` 패턴으로 결과 파일을 찾았다. 같은 검색이 ProjectEval 의 `official-result/` 와 CodeTaste 의 에이전트 폴더를 찾았으므로 검출기는 동작한다(대조군). 그래도 저장소 밖(S3 · 별도 HF 데이터셋 · 저자 문의)에 있는 결과는 놓쳤을 수 있다. "없음"은 **저장소와 논문 본문에서 못 찾음**이라는 뜻이다.

### 2.1 관점 1 — 기술 선택

**대조 검색 기록 (전용 벤치 "없음"의 근거)**
- 넓은 검색 3회: "benchmark LLM library selection third-party dependency recommendation constraints license evaluation"(extended) · "benchmark LLM technology stack selection framework choice requirements constraints agent evaluation"(extended) · "LLM third-party library recommendation evaluation dataset hallucinated deprecated packages". 결과는 연구(라이브러리 선호 편향 · 패키지 환각 · 표준 라이브러리 대 외부 라이브러리 성능)와 에이전트 평가 일반론뿐이었고, **제약을 주고 선택을 채점하는 벤치는 나오지 않았다**.
- 대조군: 같은 방식의 검색이 다른 관점에서는 알려진 벤치(RefactorBench · Commit0 · DevBench)를 첫 결과로 찾았다. 그러니 검색 도구가 아예 못 무는 상태는 아니다. 그래도 다른 이름(예: "constraint-following", "dependency hygiene")으로 있는 벤치를 놓쳤을 수 있다. "없음"은 **이 검색 범위에서 못 찾음**이라는 뜻이다.
- 지시 따르기 벤치 CodeIF 에는 "File" 범주(파일 간 의존 · 외부 라이브러리 호출)가 있다 [2차]. 라이브러리 금지 같은 제약을 결정적으로 검사하는지는 확인하지 못했다.

| 소스 | 형태 · 수 · 언어 | 채점 | 공개 · Docker · 라이선스 | 비용 · 시간 | 판단 분리 | 오염 | 과제별 공개 결과 (ⓐ 실재 · ⓑ 모델 · 스캐폴드 · ⓒ 못 푼 수) |
|---|---|---|---|---|---|---|---|
| **SWE-Lancer Manager** (OpenAI, 2025) | 실제 프리랜서 제안서 4–5개 중 하나를 고름. 전체 724개, 공개 Diamond 265개. Expensify 저장소(JS/TS). 고르는 동안 코드베이스를 읽을 수 있다 [검증] | 원래 매니저가 고른 제안서와 일치하는지(결정적). 숙련 엔지니어 검증에서 원래 선택과 **99% 일치** [검증] | Docker 이미지 공개 [검증]. 원 저장소는 2025-07 보관 처리되고 openai/preparedness 로 합쳐짐 [검증]. 데이터 라이선스는 확인 못 함 | 추정 $0.3–1.5 · 3–10분 [추정] | **높음** — 구현 없이 선택만 잰다. 다만 대부분 버그 수정 접근법이라 **라이브러리 선택 전용은 아니다** [추정] | **높음**(2023–24 공개 GitHub 이슈) [추정] | **없음** — preparedness 에는 과제 목록 CSV 와 이슈 데이터만 있다[검증: 파일 트리]. 논문 모델은 Claude 3.5 Sonnet 44.9% · o1 · GPT-4o 로 기준 미달. 후속 논문 SWE-Manager 의 GPT-5 결과도 집계뿐 [2차] |
| **RepoExec** (FSoft, 2024) | 저장소 단위 함수 생성 355개, Python. 쓸 수 있는 의존성을 함께 준다 [2차] | pass@k + **Dependency Invocation Rate**(주어진 의존성 중 실제로 호출한 비율, 결정적) [2차] | GitHub FSoft-AI4Code/RepoExec · 라이선스 확인 못 함 | 추정 < $0.2 · 1–3분 [추정] | **중** — 재사용만 따로 잰다. 함수 단위라 천장 위험이 크다 [추정] | 중–높음 [추정] | 확인 못 함. 논문 세대(2024) 모델은 기준 미달 [추정] |
| **LLM 라이브러리 · 언어 선호 연구** (Twist 외, ACL 2026 Findings) | BigCodeBench 525개 과제(34개 라이브러리) + 프로젝트 초기화 프롬프트 5종(라이브러리)과 5종(언어) [검증] | import 를 정답과 비교. 추출 코드 단위 시험 + 100개 표본 사람 검증 [검증] | GitHub itsluketwist/llm-code-bias [검증] | 응답당 몇 센트 [추정] | **중** — **제약 준수가 아니라 편향**을 잰다 [추정] | 중 | 응답별 결과는 공개됐으나 모델이 GPT-4o-mini · Claude 3.5 Sonnet/Haiku · GPT-3.5 등이라 **기준 미달** [검증: 모델 목록] |
| **MigrationBench** (Amazon, KDD 2026) | Java 8 → 17 저장소 이전. 전체 5,102개, 선별 300개 [2차] | 결정적: 컴파일 + 시험 통과 + 시험 메서드 불변 + 시험 수 비감소. "최대 이전"은 의존성을 최신 안정 메이저로 올려야 함 [2차] | GitHub amazon-science/MigrationBench · HF 데이터 [2차] | 추정 $2–10 · 15–60분 [추정] | **낮음–중** [추정] | 중 | **집계만** — 리더보드에 Claude Sonnet 4.5 최대 이전 53.33% · 최소 이전 71.67%, GLM-5 45.33% [검증]. 300개 기준이면 Sonnet 4.5 가 최대 이전에서 약 140개를 못 풀었다[추정: 300×(1−0.5333)]. 어느 저장소인지는 공개되지 않음(제출 브랜치에는 양식만 있음 [검증]) |

참고(기준선): 에이전트가 만든 PR 26,760건 중 새 의존성을 추가한 것은 **1.3%**, import 를 쓴 것은 29.5% [검증, arXiv 2512.11589]. "새 의존성 수" 하나만으로는 판별력이 낮을 수 있으니, 자작 패턴은 **의존성을 늘리는 쪽이 유혹이 되는 상황**을 일부러 만들어야 한다 [추정].

### 2.2 관점 2 — 아키텍처 · 설계

대조 검색: "benchmark LLM software architecture design decisions evaluation dataset 2025"(extended)로 SAKE · ArchBench · R2ABench · 설계 근거 생성 연구를 찾았다. "API design extensibility next change" 검색에서는 API **사용** 벤치(WAPIIBench)만 나왔고, **API 설계의 확장성이나 하위 호환을 채점하는 공개 벤치는 찾지 못했다**.

| 소스 | 형태 · 수 · 언어 | 채점 | 공개 · Docker · 라이선스 | 비용 · 시간 | 판단 분리 | 오염 | 과제별 공개 결과 (ⓐ 실재 · ⓑ 모델 · 스캐폴드 · ⓒ 못 푼 수) |
|---|---|---|---|---|---|---|---|
| **CodeTaste 열린 트랙** (ICML 2026) | 리팩터링할 영역만(평균 38자) 주고 무엇을 할지 에이전트가 찾게 함. 100개, 87개 저장소, 6개 언어 [검증] | 결정적: 시험 통과 × 규칙 적합률(Semgrep 류 AST 규칙). 최고 정렬 점수 7.9%(GPT-5.2), Plan 모드 15.1% [검증] | GitHub logic-star-ai/codetaste · 컨테이너 이미지 공개 [검증]. 라이선스 확인 못 함 | 지시 트랙 기준 $3.46–5.17, 과제당 예산 $11 [검증] | 중 — "어떤 구조 개선이 맞나"를 결정적으로 잰다. 점수가 낮아 0.5 근처 항목이 적을 수 있다 [추정] | 중(2023–25 커밋) | **있음** — GitHub 릴리스의 미리 계산된 출력(분할 zip 약 4.5 GB)에 과제별 `evaluation_result.json` 이 있다. 에이전트 폴더: **Opus 4.6 · Sonnet 4.5 · GPT-5.2 · GPT-5.1-Codex(-Max/-Mini)** · Haiku 4.5 · MiniMax M2.7 · Qwen3-Coder 등 [검증: README · 트리 · 릴리스 크기]. 못 푼 수는 용량 때문에 세지 않았다. 열린 트랙 최고 7.9% 이므로 대부분 미해결로 보인다[추정] |
| **SWE-Lancer Manager** | 2.1 과 같음 | 결정적 일치 + 라벨 일치 99% | 2.1 과 같음 | 2.1 과 같음 | **설계 선택만** 따로 잼 | 높음 | **없음**(2.1 참고) → 우선순위 하향 |
| **DevBench 설계 단계** (2024) | PRD → UML(클래스 · 시퀀스, Mermaid) + 파일 트리. 저장소 22개, 4개 언어 [검증] | **LLM 판정**(GPT-4-Turbo 쌍대, 두 순서 모두 돌리고 엇갈리면 무승부). 사람 다수결과의 일치율: 무승부 제외 79.2% / 83.2%, 무승부 포함 60.4% / 51.6% [검증] | Apache-2.0 · CC BY 4.0 · Docker [검증] | 추정 $0.1–0.5 [추정] | 중 — 설계 산출물만 따로 채점. 무승부 포함 일치율이 낮다 | 중–높음 | **없음**(저장소에 모델별 결과 파일 없음 [검증: 트리]). 논문 모델은 GPT-4 세대라 기준 미달 |
| **R2ABench** (2026-04) | SRS → PlantUML 아키텍처 도면. 프로젝트 68개 [검증] | 문법 · 그래프 구조 지표(결정적) + 의미 채점 + 안티패턴 탐지. 판정자 일치도 미보고 [검증] | Figshare · 데이터 라이선스 미명시 [검증] | 추정 $0.1–0.5 [추정] | 중 | 중 | 확인 못 함(Figshare 안에 모델 출력이 있는지는 열어 보지 않음) |

비추천: **SAKE**(아키텍처 지식 객관식 2,154문항 — 에이전트 행동이 아니라 지식을 잰다) [2차] · **ArchBench**(ADR 생성 등을 ROUGE/BLEU 로 채점 — 표면 유사도라 판단을 재지 못한다) [2차].

### 2.3 관점 3 — 요구사항 → 설계 → 구현 그린필드

| 소스 | 형태 · 수 · 언어 | 채점 | 공개 · Docker · 라이선스 | 비용 · 시간 | 판단 분리 | 오염 | 과제별 공개 결과 (ⓐ 실재 · ⓑ 모델 · 스캐폴드 · ⓒ 못 푼 수) |
|---|---|---|---|---|---|---|---|
| **NL2Repo-Bench** (ICML 2026) | 요구사항 문서 하나(평균 약 1.9만 토큰) + 빈 작업 공간 → 설치 가능한 Python 라이브러리. 과제 104개 [README 검증] | **결정적**: 원 오픈소스 프로젝트의 pytest. 최고 평균 통과율 40.2%(Claude Code + Sonnet 4.5) [검증] | 공개 · Docker 필수(OpenHands 이미지) [검증]. 라이선스 미기재 | 추정 $5–20 · 30–90분 [추정] | 낮음–중 — 뼈대가 없어 설계 판단이 점수에 섞인다 | **높음**(원 프로젝트 공개) [추정] | **집계만** — 과제별 표나 궤적 공개 문구 없음 [검증]. 완전 통과(Pass@1) 수: Claude Code + Sonnet 4.5 **3/104**, Gemini 3 Pro 3, GPT-5 1 [검증] → 그 설정들이 완전 통과 못 한 것은 100개 이상[추정]. 어느 과제인지 모름 |
| **E2EDev** (ACL 2026) | 실제 오픈소스 웹 앱 기반 프로젝트 46개 · 요구사항 244개 · BDD 시나리오 703개 [2차·README 검증(46)] | **결정적**: Behave + ChromeDriver [검증] | GitHub SCUNLP/E2EDev · HF [검증]. Docker · 라이선스 미기재 | 추정 $1–5 · 10–30분 [추정] | 낮음 — 요구사항 단위 점수라 0.5 근처 항목을 고르기 쉽다 | 중 | **없음** — 저장소에는 예시 결과 1개만 있다 [검증: 트리] |
| **DevBench** (2024) | PRD → 설계 → 환경 → 구현 → 인수 · 단위 시험. 22개 저장소 · 4개 언어 [검증] | 설계만 LLM 판정(일치도 보고), 나머지는 결정적 [검증] | Apache-2.0 / CC BY 4.0 · Docker [검증] | 전 단계 추정 $3–15 [추정] | **단계별로 분리**돼 설계 점수를 따로 볼 수 있다 | 중–높음 | **없음**(2.2 참고) |
| **PRDBench** (AAMAS 2026) | 구조화된 PRD + 채점 기준을 갖춘 Python 프로젝트 50개 [2차] | Agent-as-a-Judge. 판정 모델 PRDJudge 가 인터페이스 고정 시나리오에서 **사람과 90% 넘게 일치** [2차] | MIT · HF 공개 [검증] | 추정 $2–10 + 판정 비용 [추정] | 낮음 | 중 | **없음** — 모델 결과 파일 없음 [검증: 트리]. 논문 집계 Claude Code 45.5% [2차] |
| **DevAI** (ICML 2025) | AI 개발 과제 55개 · 계층형 요구사항 365개 · 선호 1–3개 [검증] | 에이전트 판정이 사람 합의와 **90%** 일치(LLM 판정 70%) [2차] | MIT [검증] | 학습 · GPU · Kaggle API 가 필요한 과제가 섞임 [검증] | 낮음 | 중 | 요구사항별 판정 공개(GPT-Pilot · MetaGPT · OpenHands) [검증: 트리]. 2024년 에이전트 세대라 **기준 미달** |

비추천: **Commit0**(54개 라이브러리[논문] / README 는 57개 [검증], MIT, Docker 또는 Modal). 함수 시그니처 뼈대를 주므로 **설계 판단이 빠진다**. **ProjectEval**(GPL-3.0). 시험에 넣을 매개변숫값을 에이전트가 스스로 답하므로 채점이 모델 출력에 의존한다. `official-result/` 에 과제별 결과가 있지만 GPT-4o · Gemini 1.5 Pro · Gemini 2.0 Pro-exp · Llama 등이라 **기준 미달**이다 [검증: 트리].

### 2.4 관점 4 — 반복 확장 시 유지보수성 침식 (SlopCodeBench 제외)

| 소스 | 형태 · 수 · 언어 | 채점 | 공개 · Docker · 라이선스 | 비용 · 시간 | 판단 분리 | 오염 | 과제별 공개 결과 (ⓐ 실재 · ⓑ 모델 · 스캐폴드 · ⓒ 못 푼 수) |
|---|---|---|---|---|---|---|---|
| **EvoClaw / SWE-Milestone** (ICML 2026) | 마일스톤 98개 · 저장소 7개(진화 경로 7개). Go · Rust · Java · TS · Python [검증] | **결정적**: 마일스톤마다 F2P(평균 17.1개) + P2P(평균 6,218개). 점수 = 재현율과 정밀도의 조화 평균. 최고 해결률 13.37% [검증] | 마일스톤마다 Docker 이미지 · GitHub DeepCommit-ai/SWE-Milestone · 데이터와 궤적 HF(궤적은 MIT, 로그인과 조건 동의 필요) [검증] | **Claude Code + Opus 4.6 전체 약 $88 · 2.7시간** [검증] → 경로당 약 $12.6 [추정] | 중 — 회귀 누적을 잰다. 마일스톤 단위 모드도 있다 | 중 | **있음** — 궤적 데이터셋에 저장소별 `e2e_trial/` · `mstone_trial/` 이 있고 마일스톤마다 `evaluation_result.json` 이 들어 있다. ripgrep 기준 e2e 실행 35종: Claude Code 위 **Opus 4.5/4.6/4.7/4.8 · Sonnet 4.5/4.6 · GLM-5/5.1/5.2/5.3** · Kimi K3 · DeepSeek V4 Pro, Codex 위 **GPT-5.2–5.6**, Gemini CLI 위 **Gemini 3 Pro/3.1 Pro** · 3/3.5 Flash, OpenHands 등 [검증: HF API 목록]. 조건 동의가 필요해 못 푼 수는 세지 못했다 |
| **FeatureArc** (Tencent Hunyuan, 2026-10) | 한 기능을 2–10단계로 나눠 차례로 줌. 73개 과제 · 263단계 · 53개 저장소. Python 21 · Go 20 · TS 18 · Rust 14 [검증] | **결정적**: 단계마다 숨은 F2P + P2P, 마지막에 체인 게이트 [검증] | **코드 · 데이터 공개 문구를 찾지 못함** [검증: 본문 두 구간] | 추정 $3–15 · 20–60분 [추정] | **중–높음** — 실패한 뒤 단계의 72.9% 가 물려받은 결함 [검증] | **낮음–중**(2026-10) | **집계만** — 체인 게이트: Claude Opus 5.5 49.3 · GPT-6 Astra 37.0 · **GLM-5.3 31.5** · Gemini 3.8 Flash 23.3 · Kimi K3 19.2 등 10종 [검증]. 73개 기준으로 Opus 5.5 가 약 37개를 못 풀었다[추정: 73×0.507]. 과제별 표 없음 |
| **SWE-CI** (2026-03) | 기준 커밋 → 목표 커밋(평균 233일 · 71커밋). 100개 과제 · 68개 저장소 · Python [검증] | 결정적 pytest. 최대 20회 CI 반복. **EvoScore** = 반복별 정규화 변화량의 가중 평균 [검증] | 과제마다 Docker · HF/GitHub [검증] | 전체 실험 100억 토큰 이상 [검증] → 모델 · 과제당 약 560만 토큰 [추정] | 중 — 기본이 Architect–Programmer 두 에이전트 프로토콜(iFlow CLI)이라 단일 Claude Code 로 옮기면 프로토콜을 바꿔야 한다 | 중 | **없음** — 코드 저장소(파일 31개)에 결과 파일 없음 [검증: 트리]. 논문은 그림으로만 보고 |
| **MaintainBench** (NeurIPS 2025) | 함수 단위 500개 이상 · Python. 1단계 코드에 4종 요구 변경 [검증] | 결정적: 변경 후 Pass@5 · Codediff · AST 유사도 [검증] | GitHub IAAR-Shanghai/MaintainCoder [검증] | 추정 < $0.3 [추정] | **높음** — 하지만 천장 위험이 매우 크다 [추정] | 높음 | 확인 못 함. 함수 단위라 강한 모델 실패 과제가 적을 것 [추정] |
| **SWE-EVO** (2025-12) | 릴리스 노트에서 만든 과제 48개 · Python 프로젝트 7개 · 평균 21개 파일 [검증] | 시험 묶음(평균 874개) + Fix Rate [검증] | 데이터 링크를 확인 못 함 [검증] | 추정 $5–20 [추정] | 낮음 | 중 | **없음**(데이터 링크조차 확인 못 함). 집계: GPT-5.4 + OpenHands 25% [검증] |

### 2.5 관점 5 — 동작 보존 리팩터링

| 소스 | 형태 · 수 · 언어 | 채점 | 공개 · Docker · 라이선스 | 비용 · 시간 | 판단 분리 | 오염 | 과제별 공개 결과 (ⓐ 실재 · ⓑ 모델 · 스캐폴드 · ⓒ 못 푼 수) |
|---|---|---|---|---|---|---|---|
| **CodeTaste** (ICML 2026) | 100개 과제 · 87개 저장소 · 6개 언어. 큰 리팩터링(평균 91.5개 파일 · 2,605줄) [2차·본문 검증 일부] | **결정적**: Pass(기준 상태와 정답 상태를 5번씩 돌려 정한 범위) × 규칙 적합률. 규칙 필터의 사람 감사 일치 80%(κ 0.60), 매칭 자체는 결정적 [검증] | GitHub · 다언어 컨테이너 · 네트워크 차단 [검증]. 라이선스 확인 못 함 | $3.46–5.17 · 예산 $11 [검증] | **높음** — 지시 트랙(평균 1,921자)과 열린 트랙(38자)이 같은 과제 | 중 | **있음**(2.2 참고) — 지시 · 열린 트랙 × direct/plan/multiplan 별 과제 출력과 평가. 지시 트랙 최고 69.6%(GPT-5.2) [검증] |
| **RefactorBench** (ICLR 2025) | 다중 파일 리팩터링 100개 · Python 9개 저장소 · 지시 3종 [2차·README 검증(저장소)] | 결정적: AST 기반 맞춤 시험. 기본 지시 에이전트 22%, 사람 87% [2차] | 보관 처리 · Docker 권장 [검증] | 추정 $1–5 [추정] | 중–높음 | 중–높음 | **없음** — 저장소에 결과 파일 없음 [검증: 트리]. 논문 모델은 2024년 세대라 기준 미달 [추정] |
| **SWE-Bench ProMax** (COLM 2026) | 다언어 리팩터링 170개(Py 29 · TS 28 · Java 26 · Go 23 · C++ 22 · Rust 22 · C 20) · 평균 11.4개 파일 [검증: HF 카드]. 2025년 이후 이슈만 사용 [검증] | 과제별 평가 스크립트(`data/eval.json`) · Docker 실행기 [검증] | HF 공개 · 라이선스 미기재 [검증] | 추정 $3–15 [추정] | 중 | **낮음–중** | **집계만** — 최고 41.2%(GPT-5.2 + OpenHands) [2차]. HF 카드에 과제별 결과 · 궤적 언급 없음 [검증]. 170개 기준으로 최고 설정이 약 100개를 못 풀었다[추정: 170×0.588] |
| **MigrationBench** | 2.1 참고 | 시험 메서드 불변 · 시험 수 비감소로 **동작 보존을 결정적으로 강제** [2차] | 2.1 참고 | 2.1 참고 | 중 | 중 | **집계만**(2.1 참고) |

비추천: **Aider refactor benchmark**(큰 메서드 89개, Python). 오래된 소스라 천장 위험과 오염 위험이 둘 다 크다 [2차].

### 2.6 관점 6 — 덜 명세된 요청에서의 명확화 · 가정 공개

| 소스 | 형태 · 수 · 언어 | 채점 | 공개 · Docker · 라이선스 | 비용 · 시간 | 판단 분리 | 오염 | 과제별 공개 결과 (ⓐ 실재 · ⓑ 모델 · 스캐폴드 · ⓒ 못 푼 수) |
|---|---|---|---|---|---|---|---|
| **LHAW** (Scale AI, 2026) | 285개 변형. SWE-Bench Pro 부분은 75개 과제 → 100개 변형. 목표 · 제약 · 입력 · 맥락 중 하나를 삭제 · 모호화 · 일반화. 라벨은 결과에 결정적 / 갈림 / 무해, SWE-Pro 쿼터 50/30/20 [검증] | 과제는 시험(pass@k). 질문 행동(Ask% · 궤적당 질문 수 · 질문당 이득)은 도구 호출 로그에서 결정적으로 계산. 변형 분류에는 LLM 판정 사용 [검증] | 저장소 MIT · 데이터 CC BY 4.0. SWE-Pro 는 Modal + SWE-agent 포크, 시뮬레이션 사용자는 MCP 도구 [검증] | 추정 $2–8 × 3시행 [추정] | **높음** — "무해" 변형에서 묻는 것을 과잉 명확화로 벌할 수 있다 | 중 | **부분** — 변형마다 시행별 체크포인트 0/1 벡터(`terminal_states`)와 시행에서 도출한 라벨이 공개돼 있다. 하지만 **모델 이름이 데이터에 없다** [검증: HF 행 조회]. 논문 SWE-Pro pass@3(덜 명세 → ask_user 사용 시): GPT-5.2 69.0 → 91.0 · Sonnet 4.5 79.0 → 79.0 · Gemini 3 Pro 69.0 → 73.0 [검증]. "결과에 결정적" 변형 50개가 곧 시행 모델이 정보 없이 계속 실패한 변형이다(정의상) [검증] |
| **Ambig-SWE** (CMU, 2025 — 게재처 미확인) | SWE-bench Verified 500개를 GPT-4o 로 요약해 덜 명세된 판으로 만듦. Python 12개 저장소 [검증] | 해결률(숨김 · 상호작용 · 전체 정보). 감지는 질문 여부로 판정(결정적으로 보임). 질문 품질만 GPT-4o 판정 [검증]. 독려하지 않으면 거의 묻지 않음 [검증] | GitHub sani903/InteractiveSWEAgents · OpenHands Docker [검증] | 추정 $1–4 [추정] | 중–높음 | **높음** | **없음** — 저장소(OpenHands 포크)에 과제별 결과 파일 없음 [검증: 트리]. 논문 모델 중 기준 충족은 Claude Sonnet 4 뿐 [검증] |
| **HumanEvalComm** (TOSEM 2025) | HumanEval 164문제 × 변형 6종 = 762개 · Python [검증] | 소통률(결정적). 좋은 질문 비율은 GPT-3.5 판정, 사람과 κ 0.72–0.96 [검증]. 거짓 회복 0–40% [검증] | GitHub jie-jw-wu/human-eval-comm [검증] | < $0.05 [추정] | 높음. 함수 단위라 천장 위험 [추정] | 높음 | **없음** — 저장소에는 벤치 데이터만 있다 [검증: 트리]. 논문 모델은 기준 미달 세대 [추정] |
| **ClarifyCodeBench** (2026-07) | LiveCodeBench 기반 모호 과제 419개 [2차] | 다회차 프로토콜, 상세 미확인 [2차] | 미확인 | < $0.1 [추정] | 중 | 낮음–중 | 확인 못 함 |

보류: **ClarEval**(2026-02). 저장소 README 가 사실상 비어 있어 과제 수와 채점법을 확인하지 못했다 [검증].

**headless 적용 시 주의** — Claude Code headless 실행에는 답할 사람이 없다. 질문 행동을 재려면 LHAW 처럼 **시뮬레이션 사용자를 MCP 도구(ask_user)로 붙이고, 그 도구 호출을 로그로 세야** 한다. headless 에서 내장 질문 도구가 어떻게 동작하는지는 이번 조사에서 확인하지 않았다.

### 2.7 참고 — 버그 수정 (한 줄씩)

- **SWE-bench Verified**: swe-bench/experiments 의 과제별 결과에서 상위 6개 시스템(Claude Opus 4.5 를 쓴 OpenHands · live-swe-agent · Sonar, Claude Opus 4.6 mini-swe-agent, GPT-5.2 high mini-swe-agent, Gemini 3 Pro live-swe-agent, 해결 364–396/500)이 **모두 못 푼 과제는 500개 중 66개**, 6개 중 1개만 푼 과제는 18개 [집계]. Gemini 3 Pro high mini-swe-agent 결과 파일은 500개 전부 미해결로 적혀 있어 자료 이상으로 보고 뺐다 [집계].
- **SWE-bench Pro**: v1 공개 730개에서 Claude Sonnet 4.5 와 GPT-5(250턴, 무제한 비용 실행)가 **둘 다 못 푼 과제는 352개** [집계: 저장소 `traj/*/eval_results.json`]. 검증판 **V2(642개)** 에는 **HARD-51** 이 있다. Claude Opus 5 · **GLM-5.3** · Kimi-K3 · Inkling · Gemini 3.8 Flash 다섯 계열 중 둘 이상이 실패한 과제에서, 나중에 모호하다고 판명된 3개를 뺀 51개이며, 정답 패치는 모두 통과하고 빈 패치는 모두 실패한다 [검증: v2/README · hard51_ids.txt 51줄].

---

## 3. 자작 과제 패턴

과제별 공개 결과 기준은 자작 과제에 적용할 수 없다. 기술 선택과 아키텍처에는 강한 모델의 과제별 결과를 공개한 소스가 없거나 CodeTaste 열린 트랙 하나뿐이므로, 자작 과제를 쓴다면 **강한 모델(예: Opus 5.5)로 파일럿을 먼저 돌려 실패한 항목만 남기는** 방식으로 같은 기준을 우리 쪽에서 만들어야 한다[추정 — 설계 제안].

공통 기반 [추정 — 설계 제안]:
- **로컬 패키지 인덱스 + 합성 패키지**: devpi/pypiserver(Python) 또는 verdaccio(npm)를 Docker 네트워크 안에 띄우고, 우리가 만든 이름 없는 합성 패키지만 둔다. 모델이 사전 지식으로 답할 수 없으니 **README · 메타데이터라는 증거를 읽고 고르는지**만 남는다(앵커의 "증거 기반 결정"). 오염 위험도 사실상 0 이다.
- **숨은 시험은 에이전트 실행이 끝난 뒤 별도 컨테이너에서** 돌린다(SWE-bench Pro V2 의 "검증기는 에이전트 샌드박스에서 돌리지 않는다"와 같은 원칙 [검증]). 정답 해법 통과 · 빈 해법 실패를 과제 채택 관문으로 둔다.
- 모든 채점을 결정적 신호(시험 통과 · lockfile diff · 설치된 패키지 메타데이터 · 호출 계측)로 만든다. LLM 판정은 C1 의 가정 공개 하나에만 쓰고, 이진 루브릭으로 사람 라벨과의 일치도를 먼저 잰다.

### 3.1 기술 선택

| 패턴 | 설정 | 채점 | 오판 위험 → 완화 |
|---|---|---|---|
| **T1 오프라인 제약 함정** | 과제: "폐쇄망 배포 — 실행 시점에 네트워크 없음"을 명시. 인덱스에 합성 패키지 A(첫 사용 때 모의 CDN 호스트에서 데이터를 받는다고 README 에 적음)와 B(데이터 동봉)를 둔다. 개발 중에는 모의 CDN 에 닿으므로 A 를 골라도 에이전트 쪽 시험은 통과한다 | 숨은 시험을 `--network none` 으로 실행해 통과/실패(결정적). 보조로 고른 패키지(lockfile) | ① A 를 고르되 빌드 때 데이터를 미리 받아 두는 해법 → 결과 기준으로 통과 처리(정당한 해법). ② 문서가 너무 숨어 있으면 독해력 시험이 된다 → README 첫 단락에 적는다. ③ 에이전트가 스스로 네트워크를 끄고 시험하면 하네스의 "검증" 효과와 섞인다 → 그것도 측정 대상이라 분리하지 않고 궤적에서 따로 센다 |
| **T2 기존 의존성 · 유틸 재사용** | 저장소에 이미 HTTP 클라이언트와 사내 `retry_policy()` 유틸이 있다. 과제: "외부 API 호출에 재시도 추가". 인덱스에는 인기 있어 보이는 재시도 라이브러리 합성본을 둔다 | ① 새 최상위 의존성 수(lockfile diff, 결정적). ② **숨은 시험이 `retry_policy` 를 계측(monkeypatch)해 호출 횟수를 센다** — 직접 재시도 루프를 짰으면 0회라 실패. RepoExec DIR 을 행동 시험으로 바꾼 셈 | 새 의존성이 정당한 경우 → 과제 문장에서 기존 유틸로 충분함이 드러나게 만든다. 계측 시험이 구현 세부를 강제한다는 비판 → 유틸 사용을 과제 요구사항으로 적지 않고 저장소 CONTRIBUTING 에만 "재시도는 retry_policy 로"라고 둔다(앵커의 "구현 전에 기존 코드를 살핀다"를 잼) |
| **T3 라이선스 · 유지보수 상태 함정** | 저장소 LICENSE 는 상용 배포, CONTRIBUTING 에 "copyleft 금지". 기능이 같은 합성 패키지 C(AGPL, 최신)와 D(MIT)를 둔다. 변형으로 E("DEPRECATED — 2023년 이후 미유지, CVE 공지" 메타데이터)와 F(유지 중)도 둔다 | 최종 환경의 설치 패키지 라이선스 · 이름(결정적, pip-licenses 류 메타데이터) | 제약이 명시되지 않으면 함정이 불공정하다 → 제약을 문서에 반드시 둔다. C/E 를 더 매력적으로 꾸미되 기능은 같게 해서 기능 차이로 고르지 않게 한다 |
| **T4 성능 예산 숨은 벤치** | 과제: "10만 건을 1초 안에 처리" 같은 예산을 명시. 인덱스에 순수 파이썬 O(n²) 패키지와 효율적인 패키지를 두거나 표준 라이브러리로도 풀리게 한다 | 숨은 벤치를 `--cpus=1` 고정 컨테이너에서 5회 돌린 중앙값. 같은 컨테이너에서 **기준 해법 시간 대비 비율**로 판정 | 실행 잡음 → 순진한 해법이 예산의 10배 이상 느리도록 규모를 정해 경계 근처 판정을 없앤다. 좋은 해법 · 나쁜 해법으로 문턱을 먼저 보정한다 |

### 3.2 아키텍처 · 설계

| 패턴 | 설정 | 채점 | 오판 위험 → 완화 |
|---|---|---|---|
| **D1 "다음 변경" 교차 시험** (MaintainBench · FeatureArc 를 일반화) | 1단계 명세를 팔 A/B 가 각각 구현한다. 끝나면 숨겨 둔 2단계 요구를 **고정된 제3의 에이전트(같은 모델, 하네스 없음)**가 양쪽 1단계 결과 위에 구현한다. 2단계 실행자가 같으니 차이는 **1단계 설계에서 온 것**이다 | 2단계 숨은 F2P + 1단계 P2P 통과, 1단계 파일에 대한 2단계 diff 줄 수, 건드린 파일 수(모두 결정적). 1단계 통과를 관문으로 둔다 | ① 1단계 과설계가 2단계를 쉽게 만들 수 있다 — 앵커는 "투기적 확장점 금지"를 주장하므로 **하네스가 오히려 불리할 수 있다**. 1단계 코드 크기도 함께 보고해 그 균형을 드러낸다. ② 2단계 실행자의 분산 → 1단계 산출물마다 2단계를 3회 이상 돌린다. ③ 변경 유형을 여러 개(인터페이스 · 자료구조 · 기능 확장) 섞는다 |
| **D2 숨은 아키텍처 계약** | 저장소에 계층 구조를 설명한 ARCHITECTURE.md 를 둔다(예: domain 은 infra 를 import 하지 않음). 과제는 두 계층을 다 건드려야 하는 기능 추가. import-linter(Python) / dependency-cruiser(JS) 계약은 **숨긴다** | 숨은 계약 검사 통과 여부 + 기능 시험(결정적) | 문서가 발견되기 어려우면 탐색력 시험이 된다 → 루트 README 에서 링크한다. 앵커의 "편집 전에 계약을 살핀다"를 직접 잰다 |
| **D3 숨은 하위 소비자 호환** | 공개 API 가 있는 라이브러리. 과제: 기능 추가(요구를 만족하는 길이 둘 — 시그니처를 바꾸는 쉬운 길과 보존하는 길). 저장소에 없는 **하위 소비자 코드의 시험**을 숨겨 둔다 | 숨은 소비자 시험 통과 + 공개 API 스냅샷 diff(Python 은 griffe 류, TS 는 api-extractor 류 — 도구 동작은 미확인)로 깨진 변경 수 | 깨는 것이 정당한 과제를 섞지 않는다. 스냅샷 도구가 오탐하면 소비자 시험만으로 판정한다. 앵커의 "기존 계약 보존"을 그대로 잰다 |
| **D4 설계 선택형** (SWE-Lancer Manager 형식) | 우리가 고른 실제 변경 사례에 설계 제안 3–4개를 붙여 하나를 고르게 한다. 정답은 **그 뒤 N번의 변경에서 살아남은 설계**(이후 이력에서 되돌려지지 않음) | 정답 일치(결정적). 과제당 비용이 작아 시행 5회를 돌리기 쉽다 | 라벨 타당성 → 엔지니어 2명 이상이 독립으로 라벨을 붙이고 일치율을 보고한다(SWE-Lancer 는 99%). 모델이 실제 이력을 기억할 수 있으니 2026-07 이후 사례만 쓴다 |

### 3.3 명확화 · 가정 공개 (공개 소스 보완)

| 패턴 | 설정 | 채점 | 오판 위험 → 완화 |
|---|---|---|---|
| **C1 되돌리기 비용 갈래** | 같은 과제를 두 판으로 만든다. (a) 되돌리기 비싼 모호성(예: 데이터 마이그레이션에서 열 삭제 여부 · 공개 API 이름) — 기대 행동은 ask_user MCP 도구 호출. (b) 싼 모호성(내부 함수 이름 · 기본 정렬 순서) — 기대 행동은 진행하면서 가정을 밝히는 것. 해석마다 숨은 시험을 둔다 | ① 질문 여부: 도구 호출 로그(결정적). ② 고른 해석: 해석별 숨은 시험(결정적). ③ 가정 공개: 최종 보고가 "그 가정을 이름으로 밝혔는가" 이진 루브릭을 Opus 5.5 가 판정. 사람 라벨 30개 정도로 일치도(κ)를 먼저 잰다 | 시뮬레이션 사용자가 묻지도 않은 정보를 흘리면 측정이 오염된다(HumanEvalComm 의 거짓 회복 0–40%) → 시뮬레이터는 질문에 들어 있는 항목에만 답하게 제한한다. LHAW 의 "무해" 라벨과 같은 축이라 공개 소스 결과와 대조할 수 있다 |

---

## 4. 출처 목록

**관점 1 · 2**
- SWE-Lancer 논문: https://arxiv.org/abs/2502.12115 (본문 https://arxiv.org/html/2502.12115v1)
- SWE-Lancer 저장소(보관 처리 · preparedness 로 합쳐짐): https://github.com/openai/SWELancer-Benchmark · https://github.com/openai/preparedness
- SWE-Manager(Manager 과제 후속): https://arxiv.org/abs/2601.22956
- RepoExec: https://arxiv.org/abs/2406.11927 · https://github.com/FSoft-AI4Code/RepoExec
- LLM 라이브러리 · 언어 선호 연구: https://arxiv.org/abs/2503.17181 · https://github.com/itsluketwist/llm-code-bias
- 에이전트 PR 의 라이브러리 사용: https://arxiv.org/abs/2512.11589
- 에이전트 의존성 갱신의 보안 위험: https://arxiv.org/abs/2601.00205
- 표준 라이브러리 대 외부 라이브러리(zerodep): https://arxiv.org/abs/2605.21405
- 패키지 환각: https://arxiv.org/abs/2406.10279
- CodeIF: https://arxiv.org/abs/2502.19166
- MigrationBench: https://arxiv.org/abs/2505.09569 · https://github.com/amazon-science/MigrationBench (리더보드 `docs/leaderboard.md`)
- DevBench: https://arxiv.org/abs/2403.08604 · https://github.com/open-compass/DevBench
- R2ABench: https://arxiv.org/abs/2604.06683
- ArchBench: https://arxiv.org/abs/2603.17833
- SAKE: https://arxiv.org/abs/2606.29520
- WAPIIBench(API 사용 — 설계 아님): https://arxiv.org/abs/2509.20172

**관점 3**
- NL2Repo-Bench: https://arxiv.org/abs/2512.12730 (본문 https://arxiv.org/html/2512.12730v2) · https://github.com/multimodal-art-projection/NL2RepoBench
- E2EDev: https://arxiv.org/abs/2510.14509 · https://github.com/SCUNLP/E2EDev
- PRDBench: https://arxiv.org/abs/2510.24358 · https://github.com/AGI-Eval-Official/PRDBench
- Agent-as-a-Judge / DevAI: https://arxiv.org/abs/2410.10934 · https://proceedings.mlr.press/v267/zhuge25a.html · https://huggingface.co/datasets/DEVAI-benchmark/DEVAI · https://github.com/metauto-ai/agent-as-a-judge (요구사항별 판정 `benchmark/judgment/`)
- Commit0: https://arxiv.org/abs/2412.01769 · https://github.com/commit-0/commit0
- ProjectEval: https://arxiv.org/abs/2503.07010 · https://github.com/RyanLoil/ProjectEval (`official-result/`)

**관점 4**
- FeatureArc: https://arxiv.org/html/2610.37434
- EvoClaw / SWE-Milestone: https://arxiv.org/abs/2603.13428 · https://swe-milestone.com/ · https://github.com/DeepCommit-ai/SWE-Milestone · https://huggingface.co/datasets/DeepCommit-ai/SWE-Milestone-data · https://huggingface.co/datasets/DeepCommit-ai/SWE-Milestone-log
- SWE-CI: https://arxiv.org/abs/2603.03823 · https://github.com/SKYLENAGE-AI/SWE-CI
- MaintainCoder / MaintainBench: https://arxiv.org/abs/2503.24260 · https://github.com/IAAR-Shanghai/MaintainCoder
- SWE-EVO: https://arxiv.org/abs/2512.18470

**관점 5**
- CodeTaste: https://arxiv.org/abs/2603.04177 · https://codetaste.logicstar.ai · https://github.com/logic-star-ai/codetaste (릴리스 v1.0.0 의 `outputs.z01–z04/zip`)
- RefactorBench: https://arxiv.org/abs/2503.07832 · https://github.com/microsoft/RefactorBench
- SWE-Bench ProMax: https://arxiv.org/abs/2608.09802 · https://huggingface.co/datasets/swe-bench-promax/SWE-Bench-ProMax
- Aider refactor benchmark: https://aider.chat/docs/leaderboards/refactor.html

**관점 6**
- LHAW: https://arxiv.org/abs/2602.10525 · https://github.com/scaleapi/lhaw · https://huggingface.co/datasets/ScaleAI/lhaw
- Ambig-SWE: https://arxiv.org/abs/2502.13069 · https://github.com/sani903/InteractiveSWEAgents
- HumanEvalComm: https://arxiv.org/abs/2406.00215 · https://github.com/jie-jw-wu/human-eval-comm
- ClarifyCodeBench: https://arxiv.org/abs/2607.00711
- ClarEval: https://arxiv.org/abs/2603.00187 · https://github.com/JialinLi13/ClarEval

**버그 수정 참고(2.7)**
- SWE-bench 과제별 결과: https://github.com/swe-bench/experiments (`evaluation/verified/<제출>/results/results.json` · `per_instance_details.json`)
- SWE-bench Pro: https://github.com/scaleapi/SWE-bench_Pro-os (`traj/*/eval_results.json` · `v2/README.md` · `v2/hard51_ids.txt`) · https://arxiv.org/abs/2509.16941

# #513 사용자 제시 벤치마크 목록 조사 (2026-10-19)

> 목적: 하네스 설치(B) vs 순정(A)을 같은 모델·같은 `claude -p` 로 비교할 때, 목록 중 **하네스가 점수를 움직일 자리가 있고 로컬(맥 arm64 · Docker 8 CPU/18.5 GiB · amd64 는 Rosetta)이나 저비용으로 돌릴 수 있는 것**을 가린다.
> "하네스 영향"은 전부 **가설**이다(실측 아님). 출처 번호 U# 는 맨 아래 표.

## 목록의 출처

**DeepSeek-V4.1-Flash-1017 업데이트(2026-10-17) 공지**다 — DeepSeek API 변경 기록에 11개 이름·점수가 그대로 있고, 비교 대상은 같은 기록의 2026-09-10 V4.1-Flash 항목이다(U1). Terminal-Bench 4.0 31.2→42.3 · DeepSWE v1.1 74.2→77.0 · ProgramBench 20.3→29.1 · NL2Repo 65.4→68.2 · Automation-Bench 54.8→60.5 · ALE 31.8→35.4 · Chartography 78.9→83.0 · BabyVision 89.6→92.5 · ZeroBench 49.0→51.0 · HLE(무도구) 36.8→42.6.
같은 공지 주석: **Terminal-Bench 4.0 은 Claude Code 프레임워크로 측정**, DeepSWE 는 Mini-SWE-V2(U1). 모델 카드: 코드 에이전트 벤치는 "DeepSeek Harness Minimal 모드 + 1M 컨텍스트", **시각 3종은 Claude Code 하네스**, ALE·AutomationBench 는 각자 공식 스캐폴드(U2). 모델 카드 기준 ProgramBench 지표는 **Almost@1**(≥95% 테스트 통과 과제 비율)(U2).
불일치: 모델 카드의 V4.1-Flash NL2Repo 는 64.0(변경 기록 65.4)(U2). 2차 기사(U3)는 Apex 이전값을 64.6 으로 적었으나 변경 기록의 이전 행은 "MathArena Apex: 65.6"(U1) — 기사 값은 버린다.

## 판정표

| 벤치마크 | 정체 한 줄 | 하네스 영향 | 로컬 실행 | 공인 | 추천 |
|---|---|---|---|---|---|
| **NL2Repo-Bench** | 자연어 명세(평균 1.88만 토큰) → 빈 폴더에서 파이썬 라이브러리 전체 작성, 원본 pytest 로 채점 · 104과제 | **높음** | 조건부(자체 배선 필요, 과제당 1 CPU/2 GB) | ICML 2026 · ByteDance Seed | **1순위** |
| **ProgramBench** | 실행 파일+문서만 보고 프로그램 전체 재구현, 숨은 행동 테스트 · 200과제 | **높음** | 조건부(amd64 전용·무거움·과제당 최대 6시간) | ICML/NeurIPS 2026 · Meta · Anthropic 시스템 카드 사용(△) | **2순위(소수 과제)** |
| **Automation-Bench v1.0.6** | Zapier 업무 자동화 — 47개 모의 SaaS API 를 호출해 최종 상태를 맞춤 · 공개 600과제 | 낮음~중간 | 가능(Harbor 포크 · 2 CPU/4 GB · 30분) | arXiv · Zapier · Artificial Analysis | 3순위(대조군) |
| **Agents' Last Exam** | 55개 직군 실무(Blender·MuseScore 등 GUI+CLI)를 실제 OS 샌드박스에서 · v1.1 122과제 | 낮음 | 불가에 가까움(Linux 호스트·amd64·HF 승인 데이터) | arXiv · Berkeley RDI·Snorkel | 비추천 |
| **Apex Bench v1.1** | **정체 미확정** — MathArena Apex 계열(수학 최종답) 유력 | 무관(수학) | — | — | 비추천 |
| Terminal-Bench 4.0 | 터미널 과제(기존 파악) | 중간 | 가능(Harbor) | 공인 | 기존 계획 유지 |
| DeepSWE v1.1 | 저장소 버그 수정(기존 파악) | 중간 | 가능(Pier) | 공인 | 기존 계획 유지 |
| HLE(무도구) | 2,500문항 객관식·단답 지식 시험 | 무관 | — | 공인 | 제외 |
| Chartography / BabyVision / ZeroBench | 전문 차트 100과제 / 시각 기초 388문항 / 초고난도 시각 100문항 — DeepSeek 은 **도구 사용판**을 Claude Code 로 측정 | 무관에 가까움 | — | 논문 | 제외 |

## 추천과 사전 선정 기준

1. **NL2Repo-Bench(1순위)** — 하네스 메커니즘이 정면으로 작동할 자리가 가장 많다: 다파일 설계·의존 관리·장기 세션·"테스트가 숨겨져 있어 스스로 검증해야 함". 논문이 보고한 실패 유형(조기 종료 · 사용자 입력 대기로 미완 · `__init__.py` 누락 같은 파일 간 결합 붕괴 · 시그니처 불일치)이 test-policy·objective-brief·reviewer 가 겨냥하는 결함과 겹친다(U5). 채점은 pytest 통과율(연속값)이라 작은 차이도 잡히고 유료 LLM 판정이 없다. 논문 최고점이 **Claude Code+Sonnet 4.5 40.2%**(U5)라 Claude Code 를 꽂는 전례가 있다.
   - **사전 선정 규칙**: 과제 폴더마다 `test_case_count.txt` 가 있고(U6) 논문이 원본 LOC 로 Easy(≤1,500)·Medium(1,500–4,000)·Hard(≥4,000)를 나눈다(U5). → **Medium + Hard 중 테스트 수 상위**를 고른다(파일 간 결합·장기 세션이 생기는 크기, 바닥 효과 회피). 카테고리 9종(시스템 도구 24 · 데이터 18 · 테스팅 13 …)을 층화한다.
2. **ProgramBench(2순위, 10~20과제)** — 숨은 테스트 + 실행 가능한 원본 바이너리라 "원본과 대조하는 자체 테스트를 쓰고 돌리는가"가 점수를 가른다(test-policy 의 회귀 테스트·검증 깊이). 모델이 단일 파일 몰빵(중앙값 3파일 vs 원본 15)을 한다는 관측(U8)이 있어 구조 지침의 효과도 볼 수 있다. Harbor 어댑터에 **claude-code 실행 설정이 이미 있다**(U10).
   - **사전 선정 규칙**: ① 원본 바이너리 자체 점수 <0.9 인 과제 제외(Anthropic 이 34개 제외해 166개 사용했다는 Harbor 인용, U9 △) ② 원본 코드 줄 수 하위~중위(중앙값 8,635줄, U8) — Rosetta 위 컴파일 시간과 6시간 상한 때문 ③ 지표는 resolved(최고 4.5%)가 아니라 **테스트 통과율(`reward`)**·almost_resolved(U9·U11) ④ 언어 태그(`keywords` 에 언어, U10)로 Rust/Go/C 층화. Harbor `--split pilot|parity` 로 작은 고정 묶음도 있다(U9).
3. **Automation-Bench(3순위, 음성 대조군)** — 코딩이 아니라 하네스가 도울 이유가 거의 없다. 그래서 **"하네스가 토큰·턴을 늘려 50턴 예산 안의 작업을 해치는가"**를 싸게 보는 대조군으로 쓴다. 단, 지침의 "명시 안 된 부작용 금지"·가드레일 위반 0점(U13·U15)은 change-management(범위 밖 수정 금지)와 겹쳐 소폭 양의 효과 가설도 있다. 과제 `task.toml` 에 `difficulty` 필드가 있다(U14) → `hard` 만 고르거나 도메인 6종 층화.

## 후보별 상세

### NL2Repo-Bench (U4·U5·U6·U7)
- **정체**: 104과제, 파이썬 라이브러리 9개 범주. 입력 = 명세 문서 하나 + 빈 작업 폴더. 원본 저장소의 pytest(`pip install -e .` → `pytest --continue-on-collection-errors tests`, U6)로 통과율과 완전 통과 수(Pass@1)를 낸다. 테스트는 기본 숨김 — 공개하면 Sonnet 4.5 가 40.2→59.4%(U5). ICML 2026(PMLR 306) 게재(U4).
- **하네스 영향(가설)**: test-policy(숨은 테스트를 대신할 자체 테스트) · objective-brief(1.9만 토큰 명세를 완료 기준으로 정규화) · implementer/reviewer(파일 간 결합 검토) · compaction-handoff(평균 약 90회 도구 호출, U7) · CLAUDE.md 맥락은 빈 폴더라 약함 · git-policy·보호 파일 훅은 자리 없음.
- **실행**: 공식 저장소는 **OpenHands 헤드리스 전용**(U6) — Claude Code 배선은 직접 해야 한다(논문은 Claude Code 로 돌렸지만 스크립트 미공개, 미확인). OpenReward 판 저장소는 Apache 2.0·103과제·과제당 1 CPU/2 GB·네트워크 허용(U7); 원 저장소 라이선스 표기 없음(U6). 이미지 아키텍처 미확인 — 순수 파이썬이라 arm64 재빌드는 쉬울 것(가설). 반복 상한 없음(어블레이션에서 200턴 근처 정체, U5). 채점 LLM 불필요.
- **불리한 점**: 명세가 길어 하네스 상주 문서와 합쳐 컨텍스트 압박 · "사용자 입력 대기로 미완"이 원래 실패 유형(U5) — **하네스의 '먼저 묻기' 성향은 `claude -p` 에서 곧 미완 종료**다 · 백그라운드 리뷰어 대기 중 세션 종료 실측과 같은 위험.

### ProgramBench (U8·U9·U10·U11·U12)
- **정체**: 200과제(Rust·Go·C/C++ 다수, Java·Haskell 각 1). 바이너리(실행 전용 권한)와 문서만 주고 코드베이스 전체를 짓게 한다. 테스트는 에이전트 퍼징으로 만든 숨은 행동 테스트(과제 중앙값 770개). 지표 % Resolved · % Almost(≥95%) · % Tests Passed(U8). Meta, MIT(U12). 리더보드 1위 Claude Opus 5(xhigh) resolved 4.5% · almost 37% · 과제당 $50.53(mini-SWE-agent, U11).
- **하네스 영향(가설)**: 원본 바이너리와 출력 대조하는 테스트 작성(test-policy) · 다파일 구조(현재 모델은 단일 파일 경향, U8) · 장기 세션(Opus 4.6 은 29/200 이 6시간 초과, U8). git-policy·훅은 자리 없음.
- **실행**: 공식 하네스 + Harbor 어댑터(200과제, claude-code 설정 6시간·500턴·동시 2, U9·U10). 인터넷 차단(LLM API 만 허용 목록, U9). **이미지 linux/amd64 전용, 에뮬레이션은 느림**(U12). 논문 환경 20 CPU/60 GB, Harbor 기본 12 CPU/8 GB(U8·U9) → 맥 8 CPU 에선 동시 1, Rosetta 위 컴파일 — 시간 상한 초과 위험. 채점은 컨테이너 내 pytest, 유료 LLM 불필요(부정행위 판정은 자동 judge, 정체 미확인).
- **불리한 점**: 바닥 효과(resolved 거의 0) · 과제당 수 시간 · 하네스 토큰 증가가 곧 비용 · 공식 리더보드는 mini-SWE-agent 만 받는다(Claude Code 는 "불투명하게 바뀐다"는 이유, U11) — 우리 비교는 리더보드 비교가 아니라 A/B 내부 비교로만 쓴다.

### Automation-Bench v1.0.6 (U13·U14·U15·U16)
- **정체**: Zapier. 공개 600과제(6개 도메인×100) + 채점 제외 simple 200. 모의 SaaS 47종을 도구로 조작하고 최종 상태를 단언(assertion)으로 채점 — 전부 통과해야 1점(U13). 1.0.6 = 2026-07-31(공정성 수정·비공개 세트 강화, U13). 공식 리더보드는 비공개 세트, 로컬은 공개 세트라 1:1 비교 불가(U13). AA 판(657과제)은 목표 달성 비율·가드레일 위반 시 0점(U15). MIT(U13).
- **하네스 영향(가설)**: 코딩 메커니즘은 무관. change-management(시키지 않은 부작용 금지)만 약하게 닿는다.
- **실행**: 공식은 자체 도구호출 루프(`uv run auto-bench`, 최대 50스텝, U13) — Claude Code 가 아니다. **Osmosis-AI 의 Harbor 포크 어댑터**가 1.0.6 을 과제당 CLI(`automationbench_cli.py`)로 감싸 Claude Code 같은 CLI 에이전트를 꽂게 해 준다(2 CPU/4 GB · 에이전트 30분 · 채점 별도 이미지, amd64, U14). 상류 Harbor 에는 없다(U17). 유료 LLM 판정 불필요.
- **불리한 점**: 비공식 어댑터 의존 · 지침이 "질문 금지·50턴"을 못박아 하네스의 묻기·검증 단계와 충돌 가능.

### Agents' Last Exam (U18·U19)
- **정체**: Berkeley RDI 주도. v1.1 활성 122과제(55개 하위 직군), 숨은 참조 + 결정적 채점기(0~1). 에이전트는 과제 설명만 받고 끝까지 일한 뒤 산출물로 채점. 소프트웨어 Apache-2.0 · 데이터 CC-BY-4.0(U18). Snorkel 리더보드(U19).
- **하네스 영향(가설)**: 낮음 — 과제가 GUI 전문 소프트웨어 작업이라 코딩 규율이 닿는 자리가 적다. Claude Code 는 공식 통합(`--dangerously-skip-permissions`, `--max-turns` 기본 무제한)이 있어 CLAUDE.md 를 심는 것 자체는 가능(U18).
- **실행**: 로컬 Docker 판은 78과제·**Linux 호스트(Ubuntu/Debian)·amd64**·Hugging Face 승인 데이터 필요(U18). 맥은 공식 경로 밖 → 사실상 불가. 권장 경로는 GCP VM.

### Apex Bench v1.1 — 정체 미확정
- 후보 ①(유력) **MathArena Apex** 계열: 2025 대회 최종답 난제 12문항(U20). DeepSeek 9월 기록의 같은 자리 행이 "MathArena Apex 65.6"이고 모델 카드에서도 추론 그룹(U1·U2). 단 MathArena 목록엔 v1.1 이 없고 Apex·Apex Shortlist 모두 Deprecated(U21) — "v1.1" 명칭은 미확인.
- 후보 ② **Mercor APEX-Agents 1.1**(240과제, 루브릭+LLM 판정, U22): DeepSeek-V4.1-Flash 점수가 39.5%(U23)로 65.6 과 안 맞아 **기각**. Mercor APEX-1(단일 턴 지식 업무, LLM 판정)도 v1.1 표기 없음(U24).
- 어느 쪽이든 수학(도구 없음)이거나 전용 루프·LLM 판정이라 우리 비교에 부적합.

### 나머지 한 줄 확인
- **HLE(무도구)**: 2,500문항 객관식·단답(U25). 도구가 없으면 룰·스킬·훅·서브에이전트가 작동할 자리가 없다 → **무관 판단 맞음**.
- **시각 3종**: "도구 없는 과제" 전제는 **틀렸다** — DeepSeek 은 Chartography·BabyVision·ZeroBench 를 **도구 사용판**으로, **Claude Code 하네스**로 쟀다(U1·U2). 다만 도구는 이미지 자르기·파이썬 수준(U26)이고 과제가 이미지 판독이라 코딩 규율이 닿지 않는다 → **무관에 가까움**(가설). Chartography 100과제·20회 평균 pass@1(U27) · BabyVision 388문항(U28) · ZeroBench 100문항(U29).

## 출처

| U | 내용 | URL | ○/△ |
|---|---|---|---|
| U1 | DeepSeek 변경 기록 — V4.1-Flash-1017 · V4.1-Flash 점수, Terminal-Bench 4.0 Claude Code 주석 | https://api-docs.deepseek.com/updates/ | ○ |
| U2 | DeepSeek-V4.1-Flash 모델 카드 — 표·하네스 주석·ProgramBench Almost@1 | https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash | ○ |
| U3 | MindStudio 2차 기사(Apex 이전값 64.6 — 불일치) | https://www.mindstudio.ai/blog/deepseek-v4-1-flash-1017-release | ○ |
| U4 | NL2Repo 논문 초록·ICML | https://arxiv.org/abs/2512.12730 · https://proceedings.mlr.press/v306/ding26j.html | ○ / △ |
| U5 | NL2Repo 본문 — 난이도 구분·Claude Code 40.2%·실패 유형·테스트 공개 어블레이션 | https://arxiv.org/html/2512.12730v1 | ○ |
| U6 | NL2Repo 공식 저장소 — OpenHands 전용, 과제 폴더 구조·테스트 명령 | https://github.com/multimodal-art-projection/NL2RepoBench | ○ |
| U7 | NL2Repo OpenReward 판 — 103과제·1 CPU/2 GB·Apache 2.0·평균 90 호출 | https://github.com/EnvCommons/NL2RepoBench | ○ |
| U8 | ProgramBench 논문 본문 — 설정·비용·단일 파일 경향·과제 크기 | https://arxiv.org/html/2605.03546 | ○ |
| U9 | Harbor ProgramBench 어댑터 README — 지표 3종·분할·자원·Anthropic 시스템 카드 인용 | https://github.com/harbor-framework/harbor/tree/main/adapters/programbench | ○ (시스템 카드 자체는 △) |
| U10 | Harbor ProgramBench claude-code 설정·task 템플릿 | https://github.com/harbor-framework/harbor/blob/main/adapters/programbench/configs/run_programbench_full_claudecode_docker.yaml | ○ |
| U11 | ProgramBench 리더보드 | https://programbench.com | ○ |
| U12 | ProgramBench 저장소·사용 안내(amd64 전용, 인터넷 금지, MIT) | https://github.com/facebookresearch/ProgramBench/blob/main/docs/README.md | ○ |
| U13 | AutomationBench 저장소 README·CHANGELOG 1.0.6·MIT | https://github.com/zapier/AutomationBench | ○ |
| U14 | AutomationBench Harbor 과제(Osmosis) — CLI 도구·자원·difficulty | https://github.com/Osmosis-AI/automationbench-harbor | ○ |
| U15 | Artificial Analysis AutomationBench-AA | https://artificialanalysis.ai/evaluations/automationbench-aa | ○ |
| U16 | AutomationBench 논문 초록 | https://arxiv.org/abs/2604.18934 | ○ |
| U17 | 상류 Harbor 어댑터 목록(programbench 있음, automationbench·nl2repo 없음) | https://github.com/harbor-framework/harbor/tree/main/adapters | ○ |
| U18 | ALE 저장소 README·로컬 Docker 안내·Claude Code 배포자 | https://github.com/rdi-berkeley/agents-last-exam | ○ |
| U19 | Snorkel ALE 리더보드 | https://snorkel.ai/leaderboard/agents-last-exam/ | △(검색 요약만) |
| U20 | MathArena Apex | https://matharena.ai/apex/ | ○ |
| U21 | MathArena 대회 목록(Apex Deprecated) | https://matharena.ai/competitions | ○ |
| U22 | Mercor APEX-Agents 리더보드 | https://www.mercor.com/apex/apex-agents-leaderboard/ | ○ |
| U23 | BenchLM APEX-Agents 1.1 — DeepSeek-V4.1-Flash 39.5% | https://benchlm.ai/benchmarks/mercorapexagents11 | ○(집계 사이트) |
| U24 | Mercor APEX-1 리더보드 | https://mercor.com/apex/apex-v1-leaderboard/ | ○ |
| U25 | Humanity's Last Exam 논문 | https://arxiv.org/abs/2501.14249 | ○ |
| U26 | BenchLM Chartography(tools) — 컨테이너·이미지 자르기 | https://benchlm.ai/benchmarks/chartographywithtools | △(검색 요약만) |
| U27 | Chartography 논문 | https://arxiv.org/abs/2608.10677 | ○ |
| U28 | BabyVision 논문 | https://arxiv.org/abs/2601.06521v1 | △(검색 요약만) |
| U29 | ZeroBench 논문 | https://arxiv.org/abs/2502.09696 | △(검색 요약만) |

## 원장 — 21 confirmed · 6 killed

- **confirmed**: 목록 출처 = DeepSeek-V4.1-Flash-1017 · 점수 쌍 일치 · TB4.0 Claude Code 측정 · 시각 3종 Claude Code 하네스 · ProgramBench 지표 Almost@1 · NL2Repo 104과제/난이도 3단/pytest 채점 · NL2Repo Claude Code 최고점 · NL2Repo 실패 유형 · NL2Repo 과제별 테스트 수 파일 · ProgramBench 200과제/숨은 테스트 · ProgramBench amd64 전용 · ProgramBench Harbor claude-code 설정 · ProgramBench 6시간·1000스텝 · ProgramBench MIT · AutomationBench 1.0.6 날짜·MIT · AutomationBench 단언 채점(LLM 불필요) · AutomationBench Harbor 포크·difficulty 필드 · ALE Claude Code 공식 통합 · ALE 로컬 Docker = Linux 호스트·amd64 · HLE 2,500문항 · MathArena Apex 12문항·Deprecated.
- **killed**: ① "Apex Bench v1.1 = APEX-Agents 1.1"(점수 39.5 ≠ 65.6) ② MindStudio 의 Apex 이전값 64.6(원 기록 65.6) ③ "NL2Repo 공식 저장소가 Claude Code 지원"(OpenHands 전용) ④ "ProgramBench 를 맥에서 네이티브로"(amd64 전용) ⑤ "ALE 를 맥 로컬 Docker 로"(Linux 호스트 전용) ⑥ "시각 3종은 도구 없는 과제"(도구 사용판·Claude Code 측정).
- **미확인**: Apex Bench v1.1 의 정체 · NL2Repo 이미지 아키텍처·원 저장소 라이선스·논문의 Claude Code 실행 스크립트 · ProgramBench 부정행위 judge 의 정체 · Anthropic 시스템 카드 원문(Harbor 인용만 읽음).

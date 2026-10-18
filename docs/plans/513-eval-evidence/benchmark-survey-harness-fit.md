# #513 하네스 효과를 보여줄 공인 벤치마크 — 메커니즘 적합성 조사 (2026-10-19)

- 방법: 1차 출처(arXiv 초록·본문, 공식 저장소·리더보드, Harbor 레지스트리)를 직접 페치해 읽었다. 검색 요약으로만 본 것은 출처 표에 △, 못 본 것은 "미확인"이라고 적었다.
- 선정 원칙: 결과를 보기 전에 **하네스 메커니즘 → 그 메커니즘이 움직일 지표**의 순서로 골랐다. 벤치마크마다 **예측 방향을 미리 적고, 질 것으로 예상하는 벤치마크(능력 지표)도 함께 넣었다** — 이긴 것만 고르면 홍보 근거로 쓸 수 없다.
- 방법론(짝 A/B·반복·통제 변수)은 `benchmark-survey-harness.md`, 과제 난이도·통계는 `benchmark-survey-design.md`에 있다. 이 문서는 **무엇을 돌릴지**만 다룬다.

## 추천 순위 (사전 등록용)

**1. SWT-bench Verified — 테스트 작성 능력** (근거 F1–F4, F22, F33)
- 왜 맞나(가설): implementer의 "변경 없이는 실패하는 테스트로 마감"과 test-policy가 노리는 바로 그 능력을 잰다. 이슈를 받아 **수정 전에는 실패하고 수정 후에는 통과하는 테스트**를 만드는지 보고, 변경 코드의 커버리지 증가(ΔC)도 함께 잰다(F2). 예측: 성공률(S)과 ΔC 상승.
- 공인 정도: NeurIPS 2024 본 트랙 논문이다(F1 △). LogicStar가 운영하는 공개 리더보드가 있고, 제출물은 운영자가 직접 재실행해 검증한다(F3).
- 실행 난이도: 낮다. Harbor 레지스트리에 `swt-bench/swt-bench-verified`(433과제)가 있다(F4). 자체 하네스도 Docker 기반이고 임의 에이전트의 패치(JSONL)를 받는다(F2). 433과제 × 2팔 × 3회 = 2,598시행. 1달러 단위 비용은 미확인이다.
- 불리할 수 있는 점:
  - 원본이 SWE-bench Verified다. OpenAI가 오염과 결함 테스트를 이유로 평가를 중단했다(F33 △). 오염은 두 팔에 똑같이 작용하므로 짝 차이로만 보고하고 절대 점수는 내세우지 않는다.
  - TDD 절차 지시만 넣으면 회귀가 6.08%에서 9.94%로 **늘었다**는 반례가 있다(F22). 프로즈 절차 룰이 오히려 해가 될 수 있다.
  - 과제는 "테스트만 쓰기"인데 하네스가 구현까지 고치려 들 수 있다. 소스 변경이 채점에 어떻게 반영되는지는 미확인이다.

**2. SlopCodeBench — 반복 확장에서의 코드 침식·장황함** (F6, F11–F13)
- 왜 맞나(가설): 에이전트가 자기 코드를 체크포인트마다 확장하는 장기 반복 과제다. change-management(범위 밖 수정 금지), reviewer(독립 검증), 루트 CLAUDE.md의 "가장 단순한 해법" 원칙이 침식(erosion)과 장황함(verbosity)을 움직일 수 있다. 저자들은 프롬프트에 품질 지침을 넣으면 초기 장황함·침식이 최대 1/3 줄지만 **악화 속도는 그대로**라고 보고했다(F11). 지시가 이 지표를 움직인다는 직접 증거다. 예측: 초기값은 하락하고, 악화 기울기는 "판별 불가"로 남을 가능성이 크다.
- 공인 정도: NeurIPS 2026 채택이다(F12 △). 공개 리더보드에 Claude Code·Codex 하네스 항목이 있다(F13).
- 실행 난이도: 중간. Harbor에 `gabeorlanski/slopcodebench`(36과제)가 있다(F6). 문제 36개에 체크포인트 196개라 시행당 시간이 길다.
- 불리할 수 있는 점: 최고 에이전트의 체크포인트 통과율이 14.8%라 바닥 효과가 있다(F11). 리뷰어 단계가 체크포인트마다 토큰과 시간을 늘린다.

**3. Terminal-Bench 2.1 — 표준 능력 지표 (비열등성 확인용)** (F5, F8–F10)
- 왜 넣나: 하네스가 "능력을 깎지 않는다"를 보여줄 공인 지표가 필요하다. 하네스를 바꿔 비교한 리더보드가 실제로 있는 몇 안 되는 벤치마크다(F10: 같은 GPT-5.5가 하네스에 따라 순위가 갈린다). test-policy의 검증 깊이 룰이 Terminal-Bench 실패 분류의 "검증" 범주를 줄일 수 있다는 가설은 약하다. 예측: 정답률은 ±(판별 불가), 비용·시간은 상승. **질 것을 예상하고 넣는 대조 지표다.**
- 공인 정도: 저자 85명의 논문(F8)과 tbench.ai·Snorkel 리더보드(F10)가 있다. 학회 채택은 미확인이다.
- 실행 난이도: 낮다. Harbor 공식 하네스에 `--agent claude-code`가 있다(F9 △). 레지스트리 기준 89과제(F5).
- 불리할 수 있는 점:
  - 기존 조사에서 Opus 4.5가 Terminus 2에서 57.8%, Claude Code에서 52.1%였다(`benchmark-survey-harness.md` H7 △). 기준선부터 불리하다.
  - 과제별 시간 제한 안에 백그라운드 리뷰어를 기다리다 끊길 수 있다. DeepSWE에서 이미 본 실패와 같은 축이다.
  - git 정책과 문서 거버넌스는 이 과제들과 무관하다.

**4. OverEager-Bench (아티팩트 공개 시) · 대체 SABER — 범위 밖 행동·파괴적 행동 회피** (F14–F18)
- 왜 맞나(가설): 메커니즘이 가장 정확히 겹친다. 범주에 `.env.old` 삭제(정리 과잉), 강제 푸시(`git_push_force`), 설정 과잉 수정, SSH·AWS 자격증명 읽기가 있다(F15). git-policy, change-management, 보호 파일 훅이 막으려는 행동 그대로다.
  - Claude Code에서 과제 프롬프트의 "Scope of consent" 블록을 빼면 과잉 행동률이 0.0%에서 17.1%로 뛰었다(McNemar p=2.4e-4, F14). 프롬프트 수준의 범위 선언이 지표를 크게 움직인다는 뜻이다.
  - 예측: 블록 없는 변형에서 하네스 팔의 과잉 행동률이 하락.
- 공인 정도: 낮다. 2026-05 arXiv 프리프린트이고 학회는 미확인이다. 시나리오 500개, 약 7,500시행, Claude Code 2.1.117 고정(F14·F15).
- 실행 난이도: 현재 불가. 아티팩트는 "출판 시 공개" 상태다(F15).
  - 대체안 SABER는 Docker 과제 716개가 공개돼 있고 범주 8개(파일시스템 파괴·정보 유출·코드 변조 등)를 다룬다(F17·F18).
  - 다만 SABER 어댑터는 LangGraph·Pi뿐이라 Claude Code 어댑터를 직접 써야 한다. 과제 일부는 주입 공격 시나리오여서 하네스 설계 대상 밖이다.
- 불리할 수 있는 점: 시나리오당 제한이 300초다(F15). 하네스의 브리프·리뷰 단계 때문에 과제를 못 끝내면 "안전"이 아니라 무효로 처리해야 한다. 과제 프롬프트에 동의 블록이 있으면 기준선이 이미 0%라 천장에 막힌다.

**5. SWE-CI — 장기 유지보수에서 회귀 억제** (F23, F7)
- 왜 맞나(가설): 실제 저장소 이력(평균 233일, 커밋 71개)을 따라 수십 라운드 동안 코드를 진화시키며 유지보수성을 잰다(F23). test-policy의 회귀 테스트·검증 깊이 룰과 compaction-handoff(긴 세션 인계)가 겨냥하는 축이다. 예측: 회귀 0 비율 상승.
- 공인 정도: 2026-03 프리프린트다. 학회는 미확인이다.
- 실행 난이도: 높다. Harbor에 없다(F7: 같은 검색창에서 `swt`는 잡히고 `swe-ci`·`doc2feat`은 0건). 과제 100개를 라운드마다 반복하므로 비용이 가장 크다.
- 불리할 수 있는 점: 세션이 길어 상주 룰의 토큰 비용이 누적된다(F20: 지시 파일이 비용을 +20% 안팎 올렸다).

**순위와 별도로 지금 바로 할 일 (추가 비용 0)**: 이미 돌린 DeepSWE·SWE-bench Pro 결과에서 보조 지표를 뽑는다. 대상은 ① 기존에 통과하던 테스트가 깨진 수(P2P), ② diff 크기와 과제 밖 파일 수정 수, ③ 보호 파일 접촉 수다. FrontierCode도 같은 축(파일 범위·diff 크기 제한)을 채점에 넣는다(F30). TensorBench도 기존 테스트를 깬 패치 비율을 따로 보고한다(F40 △). 단, 이 지표는 결과를 본 뒤 정한 지표이므로 **탐색용으로만 표시한다.**

## 후보 비교표 (●=메커니즘 직접 겨냥 · ○=간접 · –=무관)

| 벤치마크 | test-policy·implementer | change-mgmt(범위) | git·보호훅(파괴) | reviewer | objective-brief | compaction | 공인 | Harbor |
|---|---|---|---|---|---|---|---|---|
| SWT-bench Verified | ● | – | – | ○ | ○ | – | NeurIPS'24·리더보드 | ○(433) |
| SlopCodeBench | ○ | ● | – | ● | – | ○ | NeurIPS'26△·리더보드 | ○(36) |
| Terminal-Bench 2.1 | ○ | – | – | ○ | – | – | 다수 랩 리더보드 | ○(89) |
| OverEager-Bench | – | ● | ● | – | ○ | – | 프리프린트 | ✗(미공개) |
| SABER | – | ○ | ● | – | – | – | 프리프린트 | ✗ |
| SWE-CI | ● | ○ | – | ○ | – | ● | 프리프린트 | ✗ |
| FixedBench | – | ● | – | ○ | ● | – | 프리프린트(ETH) | ✗(코드 미표기) |
| Ambig-SWE | – | – | – | – | ● | – | ICLR'26 | 미확인 |
| Doc2Feat-bench | ○ | – | – | – | – | – | ASE'26 | ✗ |
| FeatureBench | ○ | – | – | – | – | – | ICLR'26△ | ○(lite 30) |
| SkillsBench | – | – | – | – | – | – | NeurIPS'26△·vals.ai | ○(87) |
| CTXbench | ○ | – | – | – | – | – | 프리프린트(ETH) | 미확인 |
| SWE-bench Pro | ○ | – | – | – | – | – | Scale·OpenAI 권고 | ○(731) |

## 후보별 상세 (추천 밖)

- **FixedBench**(F19): 이미 고쳐진 코드에 낡은 버그 리포트를 주고, 아무것도 고치지 않는(빈 패치) 것을 정답으로 친다. 200과제이고 Claude Code(Sonnet 4.6)도 측정 대상이다.
  - 불필요한 수정이 35~65% 나왔다. "그만두는 것도 성공"이라고 프롬프트에 적으면 GPT-5.4 Mini의 올바른 보류가 60.5%에서 88.5%로 올랐다.
  - 하네스 효과 가설: objective-brief의 완료 기준과 change-management가 "행동 편향"을 줄인다.
  - 위험: 같은 지시가 부분만 고쳐진 코드에서는 과잉 보류를 낳았다. 코드 공개 여부는 미확인이고 원본은 SWE-bench Verified다. **5위 다음 예비 후보.**
- **Ambig-SWE**(F27): ICLR 2026. 정보를 덜 준 SWE-bench Verified 변형이다. 사용자 대리인에게 질문할 수 있으면 성능이 최대 74% 올랐다.
  - 하네스 가설: objective-brief가 모호성 탐지를 돕는다.
  - 위험: `claude -p` 비대화 실행에는 질문할 상대가 없다. 대리인 구현이 따로 필요하고, 하네스가 질문을 기다리다 멈출 수 있다. 비대화 실행이 원칙인 이번 평가와 충돌한다.
- **Doc2Feat-bench**(구 NoCode-bench, F26): ASE 2026. 문서 변경을 받아 기능을 구현한다. 634과제, Verified 114과제, 최고 37.72%(OpenHands + Qwen3-Coder-480B).
  - doc-governance는 "코드에 맞춰 문서를 동기화"하는 방향이라 이 과제와 방향이 반대다. 메커니즘 적합도가 낮다. Docker와 리더보드 세부는 미확인.
- **FeatureBench**(F25 △, F5): ICLR 2026. 기능 개발 과제이고 Harbor lite판이 30과제다. DeepSWE와 같은 축(숨은 테스트로 기능 구현을 채점)이라 효과가 작을 것으로 예상한다. 새 정보가 적다.
- **SkillsBench**(F28·F42 △): 큐레이션 스킬이 평균 +16.6%p였다. 그러나 스킬이 **과제 도메인 전용**이고, 우리 스킬 14종은 범용 작업 규율이라 메커니즘이 겹치지 않는다.
  - 소프트웨어 공학에 한정한 SWE-Skills-Bench에서는 스킬 49종 중 39종이 효과 0이었고, 평균은 +1.2%, 토큰은 최대 +451%였다(F29). 스킬 효과가 작다는 사전 증거다.
- **CTXbench**(F20): 138과제. LLM이 만든 지시 파일은 −0.5~−2%p(유의하지 않음), 개발자가 쓴 지시 파일은 +2.4%p(p=0.21)였다. 비용은 +19~23%였다.
  - 지시 이행 자체는 확인됐다. 지시에 `uv`가 있으면 인스턴스당 1.6회 썼고, 없으면 0.01회 미만이었다.
  - 하네스 효과를 정답률로 보이기 어렵다는 직접 근거다. 효율 지표 쪽 근거로는 AGENTS.md가 런타임 중앙값 −28.64%, 출력 토큰 −16.58%를 냈다는 연구가 있다(F21 △).
- **SWE-bench Pro**(F34 △, F5): OpenAI가 Verified 대신 권고한다(F33 △). Harbor에 731과제가 있다. 하네스 팔과의 차이는 DeepSWE와 같이 작을 것으로 예상하고, 능력 대조군으로만 쓴다.
- **컨텍스트 압축 축**: 압축(compaction)을 거치면 세션 제약이 평균 17%만 보존됐다(COMPINT, F36 △). compaction-handoff 스킬이 겨냥하는 축이다. 다만 이 연구는 압축기를 평가하지 에이전트 하네스를 평가하지 않아 그대로 쓸 수 없다. LoCoBench-Agent는 1차 출처를 못 읽어 미확인이다.
- **코드 리뷰 축**: SWR-Bench(FSE 2026, PR 1,000건, F37 △)는 리뷰 코멘트 생성을 잰다. 우리 reviewer는 자기 변경을 검증하는 역할이라 과제 형태가 다르다.

## 출처 표

| F | 내용 | URL | ○/△ |
|---|---|---|---|
| F1 | SWT-bench NeurIPS 2024 본 트랙 | https://proceedings.neurips.cc/paper_files/paper/2024/hash/94f093b41fc2666376fb1f667fe282f3-Abstract.html | △ |
| F2 | SWT 저장소: Docker, Full 2,294 · Lite 276 · Verified 433, 지표 S·W·ΔC·P→P | https://github.com/logic-star-ai/swt-bench | ○ |
| F3 | SWT 리더보드: 제출물을 운영자가 재실행 | https://swtbench.com/ | ○ |
| F4 | Harbor `swt-bench/swt-bench-verified` 433과제 | https://hub.harborframework.com/datasets?q=swt | ○ |
| F5 | Harbor 레지스트리 1쪽(TB 2.1 89, SWE-bench Pro 731, skillsbench 87, featurebench-lite 30, deep-swe 113) | https://hub.harborframework.com/datasets | ○ |
| F6 | Harbor `gabeorlanski/slopcodebench` 36과제 | https://hub.harborframework.com/datasets?page=2 | ○ |
| F7 | Harbor 검색 `doc2feat`·`swe-ci` 0건(대조군 `swt`는 잡힘) | https://hub.harborframework.com/datasets?q=swe-ci | ○ |
| F8 | Terminal-Bench 2.0 논문: 89과제, 최고 65% 미만 | https://arxiv.org/abs/2601.11868 | ○ |
| F9 | Harbor `--agent claude-code` 실행 예시 | https://huggingface.co/datasets/harborframework/terminal-bench-2.0/blob/main/README.md | △ |
| F10 | TB 2.0 리더보드: 하네스×모델 순위, 95% CI | https://snorkel.ai/leaderboard/terminal-bench-2-0/ | ○ |
| F11 | SlopCodeBench: 36문제 · 체크포인트 196개, 최고 14.8%, 품질 지침의 효과 | https://arxiv.org/abs/2603.24755 | ○ |
| F12 | SlopCodeBench NeurIPS 2026 포스터 | https://neurips.cc/virtual/2026/poster/138903 | △ |
| F13 | SlopCodeBench 리더보드: Claude Code·Codex 항목 | https://www.scbench.ai/ | ○ |
| F14 | OverEager 초록: 500시나리오, 동의 블록을 빼면 0.0%→17.1% | https://arxiv.org/abs/2605.18583 | ○ |
| F15 | OverEager 본문: 범주(.env·강제 푸시·자격증명), CC 2.1.117, 300초, 아티팩트 출판 시 공개 | https://arxiv.org/html/2605.18583 | ○ |
| F16 | SABER 초록: 최고 모델도 HSR 54% 초과 | https://arxiv.org/abs/2606.01317 | ○ |
| F17 | SABER 본문: 716과제, 범주 8개, Docker, 13모델 | https://arxiv.org/html/2606.01317v2 | ○ |
| F18 | SABER 저장소: LangGraph·Pi 어댑터, Apache-2.0 | https://github.com/sssr-lab/saber | ○ |
| F19 | FixedBench: 200과제, 불필요 수정 35~65% | https://arxiv.org/abs/2605.07769 · https://www.alphaxiv.org/abs/2605.07769.md | ○ |
| F20 | CTXbench: 138과제, 지시 파일 효과·비용 | https://arxiv.org/html/2602.11988v3 | ○ |
| F21 | AGENTS.md 효율: 런타임 −28.64%, 출력 토큰 −16.58% | https://arxiv.org/abs/2601.20404v1 | △ |
| F22 | TDAD: TDD 절차 지시만 넣으면 회귀 6.08%→9.94% | https://arxiv.org/abs/2603.17973 | ○ |
| F23 | SWE-CI: 100과제, 233일 · 커밋 71개 | https://arxiv.org/abs/2603.03823 | ○ |
| F24 | SWE-EVO: 48과제, 장기 진화 | https://arxiv.org/abs/2512.18470v1 | △ |
| F25 | FeatureBench ICLR 2026 | https://proceedings.iclr.cc/paper_files/paper/2026/hash/25203d1cc8c58381eab578f4fcf9c4f8-Abstract-Conference.html | △ |
| F26 | Doc2Feat-bench ASE 2026: 634 · Verified 114 | https://arxiv.org/abs/2507.18130 | ○ |
| F27 | Ambig-SWE ICLR 2026: 대화로 최대 +74% | https://arxiv.org/abs/2502.13069 | ○ |
| F28 | SkillsBench: 87과제, +16.6%p | https://arxiv.org/abs/2602.12670 | ○ |
| F29 | SWE-Skills-Bench: 49종 중 39종 효과 0, 평균 +1.2% | https://arxiv.org/abs/2603.15401 | ○ |
| F30 | FrontierCode: 150과제 비공개, 범위·diff 채점 | https://cognition.com/blog/frontier-code | ○ |
| F31 | FrontierCode @ Artificial Analysis: 과제 비공개, Stirrup 하네스 | https://artificialanalysis.ai/articles/frontiercode | ○ |
| F32 | METR: 테스트를 통과한 PR의 메인테이너 병합률이 약 24%p 낮다 | https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/ | ○ |
| F33 | OpenAI의 SWE-bench Verified 평가 중단 | https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/ | △ |
| F34 | SWE-bench Pro: 공개 731 · 보류 858 · 상용 276 | https://arxiv.org/html/2509.16941v2 | △ |
| F36 | Lost in Compaction(COMPINT): 제약 17% 보존 | https://arxiv.org/abs/2608.11242 | △ |
| F37 | SWR-Bench FSE 2026: PR 1,000건 | https://arxiv.org/abs/2509.01494 | △ |
| F38 | AgentHazard: 2,653건, 공격 성공률 73.63% | https://arxiv.org/abs/2604.02947 | ○ |
| F39 | ClayBuddy: COLM 2026 워크숍, 코드 미표기 | https://arxiv.org/abs/2606.19380 | ○ |
| F40 | TensorBench: 기존 테스트를 깬 패치 비율 | https://arxiv.org/abs/2606.05570 | △ |
| F42 | vals.ai SkillsBench 리더보드 | https://vals.ai/benchmarks/skillsbench | △ |

(F35 TDD-Bench Verified https://arxiv.org/abs/2412.02883 △ — IBM, 449과제, tddScore. SWT-bench와 같은 축이라 1위로 대체된다. F41 하네스 판 변화 연구 https://arxiv.org/abs/2607.03691 ○ — 모델을 고정하고 하네스만 바꿔도 품질이 출렁였다. Claude Code는 대상 아님.)

## 원장 — 29 confirmed · 11 killed

- confirmed: 출처 표에서 ○로 표시한 29건. 직접 읽은 1차 출처다(F41 포함).
- killed:
  1. CTXbench의 ICLR 2026 채택 — arXiv v3 페이지에 학회 표기가 없고, 제목 검색에서도 포스터가 나오지 않았다. **미확인으로 둔다.**
  2. SWE-CI의 "모델 75%가 회귀를 낸다" — 2차 기사에만 있다.
  3. Terminal-Bench "Claude Code 58.0% vs KIRA 74.7%" — 블로그 주장이고 리더보드에서 확인하지 못했다.
  4. Vercel 평가 "AGENTS.md 100% vs 스킬 79%" — 2차 요약뿐이다.
  5. "AI 코드의 이슈가 1.7배 많다"(byteiota) — METR 원문에 없다.
  6. FrontierCode를 후보로 쓰는 안 — 과제가 비공개라 직접 돌릴 수 없다(F30·F31). 채점 축만 차용한다.
  7. METR 병합 연구를 후보로 쓰는 안 — 메인테이너 리뷰를 비공개로 진행해 재현할 수 없다(F32).
  8. AgentHazard·RedCode — 악의적 목표를 단계로 쪼갠 공격을 잰다. 하네스의 설계 대상(선의의 사용자 작업 범위)과 다르다.
  9. ClayBuddy·DeleteEverythingBench — 초록에 벤치마크명과 코드가 없다(F39).
  10. SkillsBench를 주력으로 쓰는 안 — 스킬이 도메인 전용이라 메커니즘이 어긋난다(F28·F29).
  11. LoCoBench-Agent — 1차 출처를 읽지 못했다.

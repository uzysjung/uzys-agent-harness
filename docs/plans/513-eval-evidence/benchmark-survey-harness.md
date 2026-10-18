# 하네스 효과 평가 — 방법론 조사 (#513)

- 조사일: 2026-10-19 · 방법: 1차 출처를 직접 페치해 읽음. 직접 못 읽은 것은 △ 또는 "미확인"으로 표시.
- 범위: 같은 모델에서 스캐폴드·지시 파일·하네스만 바꿔 비교하는 방법, 판 간 회귀 추적, 무인 실행과 실사용의 차이, 트래젝토리 분석.
- 이미 읽은 출처(Anthropic "Demystifying evals", H12)는 재확인만 했다.

## 우리 프레임워크에 넣을 것

1. **(a) 짝지은 A/B, 반복 시행, 짝 검정.** 과제마다 A·B를 같은 횟수로 돌린다(DeepSWE는 과제·구성당 약 4회, Terminal-Bench는 쌍당 최소 5회). 집계는 과제별 통과율의 매크로 평균(pass@1)과 pass^k로 하고, 판정은 과제 단위 짝 검정으로 한다(H1은 Cochran-Mantel-Haenszel, H8은 McNemar+Holm). 근거: H9 · H7 · H1 · H8 · H12.
2. **(a) 기대 효과는 작다. 검정력부터 계산한다.** 지시 파일 효과는 대체로 ±2~4%p이고 유의하지 않았다. 반면 비용은 +20% 안팎으로 유의하게 올랐다(H1). 인프라 설정만 바꿔도 6%p가 움직였고, 3%p 미만 차이는 구성이 같다고 확인되기 전까지 의심하라고 한다(H11). 113과제·이진 채점에서 몇 %p를 가려낼 수 있는지 사전 등록 때 계산해 두고, 그보다 작은 차이는 "효과 없음"이 아니라 "판별 불가"로 보고한다. 근거: H1 · H11 · H8.
3. **(a) 정답률만 주지표로 두지 않는다. 비용·단계·시간을 함께 본다.** 지시 파일의 효과는 정답률보다 효율에서 먼저 드러났다(H2: 런타임 중앙값 −28.6%, 출력 토큰 −16.6%. H1: 단계 +2.5~3.9, 비용 +20%). HAL은 비용-정확도 파레토를 리더보드의 기본 축으로 쓴다(H4 · H5). 근거: H1 · H2 · H4 · H5.
4. **(a) 통제 변수를 결과와 함께 기록한다.** 자원 하한·상한, 시간 제한, 동시성(H11), 토큰 상한(H10), 모델·CLI 판, 시행마다 깨끗한 환경(H12: 이전 시행의 git 이력을 읽어 점수가 부풀었다)이 대상이다. 특히 **B에 하네스가 실제로 실렸는지를 시행마다 증명한다.** `claude -p`의 `system/init` 이벤트에는 로드된 plugins·mcp_servers가 찍힌다. 또 공식 문서는 `--bare`(CLAUDE.md·훅·스킬·서브에이전트 미로드)가 "향후 `-p`의 기본값이 된다"고 예고했다. 그 변경이 들어오면 B가 조용히 A가 된다. 근거: H24 · H11 · H10 · H12.
5. **(b) 판 간 회귀는 "과제 × 시행 × 채점 × 기록 × 결과" 구조로 쌓는다.** 시행마다 결과 파일, 표준 트래젝토리(Harbor ATIF), 설정 잠금본을 남긴다(H16). 채점기를 고쳤을 때는 다시 돌리지 않고 기존 로그를 재채점한다(Inspect `inspect score`, H15). 하네스 판끼리는 집계값만 비교하지 말고 과제별 짝으로 비교한다(H8). 벤치마크나 실행기 자체가 바뀌면 판 번호를 올리고 "이전 점수와 비교 불가"를 적는다(Epoch v2.0.0 사례, H10). 근거: H12 · H15 · H16 · H8 · H10.
6. **(b) 능력 스위트와 회귀 스위트를 나눈다.** 능력 평가는 낮은 통과율에서 시작해 올라갈 여지를 둔다. 회귀 평가는 100% 가까이 유지해 퇴행을 잡는다. 통과율이 높아진 능력 과제는 회귀 스위트로 넘긴다(H12). 하네스 판마다 도는 것은 회귀 스위트, 큰 판에서만 도는 것은 능력 스위트로 둔다. 근거: H12.
7. **(c) "완주"와 "풀 능력"을 따로 채점한다.** 주 점수는 벤치마크 규칙(제출된 패치) 그대로 둔다. 보조 점수는 에이전트가 끝난 뒤의 **작업 트리 최종 상태**에 같은 검증기를 돌린다. Harbor 검증기는 에이전트 종료 후 같은 컨테이너에서 실행되고, 별도 검증 샌드박스면 선언한 artifacts만 넘어간다(H16). 종료 사유도 분류해 기록한다: 제출, 조기 종료, 시간 초과, 백그라운드 대기, SIGTERM(exit 143). Terminal-Bench 분류에는 "Premature Termination"과 "Unaware of Termination Conditions"가 이미 있다(H7). 근거: H16 · H7 · H24.
8. **(c) 이미 본 0점 2건은 실행기 쪽 원인부터 확인한다.** 공식 문서상 `-p` 실행은 메인 대화가 띄운 백그라운드 서브에이전트가 끝날 때까지 열려 있어야 한다. 그 밖의 백그라운드 작업은 기본 10분 유휴 상한에서 끊긴다(`CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS`). `--max-budget-usd` 상한이나 SIGTERM을 받으면 남은 작업은 기록 없이 멈춘다(H24). 실행기(Pier)의 타임아웃·종료 신호와 이 규칙이 어떻게 맞물리는지는 이번 조사에서 확인하지 않았다(미확인). 근거: H24.
9. **(c) 무인 벤치마크가 못 보는 효과는 별도 축으로 잰다.** 대화를 허용하면 정답률이 최대 74% 올랐다(H20). 테스트를 통과한 패치도 메인테이너 병합률은 자동 채점보다 약 24%p 낮았다(H19). 탈락 사유는 테스트 커버리지·문서·린트·코드 품질 축에 몰렸다(H18). 하네스가 노리는 효과(테스트 작성, 문서 동기화, 리뷰)는 이 축에 있을 가능성이 크다. 그래서 통과/실패 검증기 외에 루브릭 품질 채점을 보조로 둔다. 근거: H18 · H19 · H20.
10. **트래젝토리 분석은 분류 체계 + 검증된 LLM 판정 + 사람 표본 검수로 한다.** Terminal-Bench는 MAST를 바탕으로 3대분류(실행·일관성·검증)와 8범주를 만들었다. LLM 판정은 사람 라벨 120건과의 일치율 90%로 검증한 뒤 썼다(H7 · H21). DeepSWE는 LLM 판정을 공식 채점기가 아닌 감사자로만 쓴다(H9). 0% 과제는 에이전트보다 과제가 깨졌을 가능성부터 본다(H12 · H22). 근거: H7 · H21 · H9 · H12 · H22.

## Q1. 같은 모델, 다른 스캐폴드·하네스

- **Terminal-Bench 2.0 논문**(H7): 89과제, 에이전트 6종 × 모델 16종, 32,155시행, 쌍당 최소 5회, 95% CI 보고.
  - GPT-5.2: Codex CLI 62.9% vs Terminus 2 54.0%.
  - Claude Opus 4.5: Terminus 2 57.8% · Claude Code 52.1% · OpenHands 51.9%.
  - 같은 하네스에서 모델만 바꾼 폭이 더 컸다(Codex CLI에서 GPT-5-Nano → GPT-5.2가 약 51%p). 저자 결론은 "모델 선택이 대개 스캐폴드보다 중요하다."
- **HAL**(H4 · H5): 9모델 × 9벤치마크, 21,730 롤아웃, 약 4만 달러. 스캐폴드가 정확도와 비용 모두에 크게 영향을 준다고 보고했다.
  - 추론 강도(reasoning effort)를 올리면 대부분의 실행에서 정확도가 오히려 떨어졌다.
  - Opus 4.5를 Claude Code 기반 스캐폴드로 돌리자 기존 CORE-Agent보다 크게 앞섰다(Hard 77.8%, 수동 채점 95.5%). 이를 근거로 CORE-Bench를 "해결됨"으로 선언했다(H5 · H12 · H14).
  - 현재는 새 모델 추가를 멈추고 신뢰성 측정에 집중한다.
- **MIT FutureTech의 HAL 재분석**(H6, 2026-06-26): 정확도를 logit 변환해 분산을 분해했다. 스캐폴드가 모델보다 분산을 더 많이 설명했고, 일부 벤치마크에서는 범용→특화 스캐폴드 전환으로 같은 정확도를 약 100배 싸게 얻었다.
  - 한계: 기준선 의존, 종단 데이터 없음, 특화 스캐폴드 과적합 가능성, 구성요소별 기여 분리 불가. 분석 자체가 Claude Opus로 수행됐다고 명시했다.
- **SWE-bench 제출물 감사**(H8, 2026-09): 254개 제출물을 재실행 없이 과제 단위로 짝 비교했다.
  - 같은 모델 안의 스캐폴드 차이가 최대 29.8%p로, 상위 30개 전체 폭 8.8%p보다 컸다.
  - Verified 상위 30개에서 인접한 두 항목 사이에 유의한 차이는 하나도 없었다.
  - 권고: 점수와 함께 모델-스캐폴드 출처를 보고하고, 차이를 가려내는 데 필요한 과제 수를 추정한다.
- **DeepSWE**(H9, 우리 실행 기반): mini-swe-agent(커밋 고정)로 하네스를 통일했다. 과제·구성당 약 4롤아웃, 2.5시간 벽시계 제한, 이진 채점.
  - 네이티브 하네스 파일럿은 SWE-Bench Pro 10과제에서만 했다. Opus 4.7은 50%(mini) vs 40%(Claude Code), Gemini 3.1 Pro는 40% vs 20%였고 모두 유의하지 않았다.
  - 저자는 이 파일럿이 "패리티 점검일 뿐 순위가 아니다"라고 밝혔다.
- **Epoch SWE-bench Verified**(H10): 2026-02 v2.0.0에서 스캐폴드·환경·토큰 상한을 바꾼 뒤 이전 점수와 비교 불가를 명시했다. v2.0.2에서 Claude Code·Codex를 Inspect-SWE로 추가했다. 토큰 상한은 비캐시 2M · 캐시 읽기 20M.
- **통제 변수 정리**: 모델·판, 하네스 판, 자원·시간 제한(H11), 토큰 상한(H10), 시행 수, 과제 집합(H8). 스캐폴드 효과는 모델에 따라 방향까지 다를 수 있다(H6: GAIA에서 일부 모델은 이득, 일부는 손해).

## Q2. 저장소 지시 파일(AGENTS.md·CLAUDE.md)의 효과

- **Gloaguen 외, ETH**(H1, ICLR 2026): SWE-bench Lite 300과제(지시 파일 없는 저장소)와 지시 파일이 있는 12개 저장소의 138과제를 썼다. 새 벤치마크 이름은 v1에서 AGENTbench였고 v3에서 CTXbench로 바뀌었다. 대상은 Claude Code(Sonnet-4.5), Codex(GPT-5.2·5.1 mini), Qwen Code. 조건은 없음 / LLM 생성 / 개발자 작성 세 가지.
  - v3 결과: LLM 생성은 −0.5%p(p=0.87), −2%p(p=0.37). 개발자 작성은 +2.4%p(p=0.21).
  - 개발자 작성이 LLM 생성보다 약 7%p 높았다(p=0.038).
  - 비용은 LLM 생성에서 +20~23%(p<0.001), 개발자 작성에서 최대 +19%였다.
  - 에이전트는 지시를 잘 따랐다. 파일에 적힌 도구를 훨씬 자주 썼고 테스트·탐색이 늘었다.
  - 저장소 개요는 관련 파일을 더 빨리 찾게 해 주지 않았다. 문서를 지우자 LLM 생성 파일이 +2.7%p였다. 저자는 이를 기존 문서와 중복이라는 뜻으로 해석했다.
  - 한계: 과제당 1샘플, Python만, 대부분 유의하지 않음, 25과제는 테스트를 손으로 수정.
  - 권고: 자동 생성 파일은 당분간 빼고, 사람이 쓴 파일은 README에 없는 관례·비기능 요구만 담고, 도입 전에 엄격하게 평가한다.
  - 판 차이: v1은 "개발자 작성 +4% / LLM −3%"였다. 이를 인용한 2차 글은 v1 수치다.
- **Lulla 외**(H2, 2026-01/03, 초록만 읽음): 10개 저장소의 124개 PR을 AGENTS.md 유무로 실행했다. 런타임 중앙값 −28.64%, 출력 토큰 −16.58%, 완료 행동은 비슷했다. 저자 표현은 "연관(associated)"이며 정답률은 재지 않았다.
- **Vercel**(H3, 2026-01-27, **공급사 자체 주장**): 학습 데이터에 없는 Next.js 16 API를 겨냥한 평가로, 빌드·린트·테스트를 행동 기반으로 채점했다.
  - 결과: 문서 없음 53% · 스킬 기본 53% · 스킬+명시 지시 79% · AGENTS.md 문서 색인(8KB) 100%.
  - 56%의 사례에서 스킬이 아예 호출되지 않았다. "반드시 호출" 같은 문구는 오히려 프로젝트 맥락을 놓치게 했다.
  - 과제 수와 시행 수는 공개하지 않았다.
- **우리에게 주는 함의**: 지시 파일의 정답률 효과는 작고 불확실하다. 확실한 것은 비용 변화와 행동 변화(지시 준수)다. 큰 효과는 모델이 모르는 지식을 줄 때만 관측됐다(H3). 따라서 하네스 효과는 정답률 하나보다 "비용·행동·품질" 묶음으로 재야 한다.

## Q3. 평가 프레임워크의 구조

- **Anthropic**(H12): 과제(task) · 시행(trial) · 채점기(grader) · 기록(transcript) · 결과(outcome = 환경의 최종 상태)로 나눈다.
  - 에이전트를 평가한다는 것은 모델과 하네스를 함께 평가한다는 뜻이다.
  - 경로가 아니라 결과를 채점하고, 다단계 과제에는 부분 점수를 넣는다. pass@k와 pass^k를 구분한다.
  - "기록을 읽어라"가 맺음말이다.
- **Anthropic 인프라 잡음**(H11, 2026-02-05): TB2에서 자원 구성 6가지를 비교했다. 1x와 무제한의 차이는 6%p(p<0.01)였다. 3x까지는 인프라 오류만 줄었고(5.8% → 2.1%) 점수 차는 잡음 수준이었다. 권고는 다음과 같다.
  - 과제마다 보장 할당과 강제 종료 임계를 따로 정한다.
  - 강제 방식을 공개한다.
  - 날짜·시간대를 달리해 반복 실행한다.
- **Inspect AI**(H15): Task = dataset + solver(에이전트) + scorer 구조다. Docker·K8s·Modal 샌드박스를 지원한다.
  - Claude Code·Codex CLI 같은 외부 에이전트는 agent bridge(샌드박스 안의 모델 프록시)로 돌린다. 이때 모든 모델 호출이 기록에 남는다.
  - 기존 로그를 재채점할 수 있다(`inspect score`).
- **Harbor**(H16): 과제 = instruction + environment + tests(검증기) + solution 구조다.
  - 검증기가 `reward.txt`(단일 수) 또는 `reward.json`(이름 붙은 여러 지표)을 쓴다. 둘 다 있으면 json을 쓴다. 다중 지표를 지원하므로 부분 점수나 보조 점수를 넣을 수 있다.
  - 트래젝토리는 ATIF-v1.7 JSON으로 저장한다(단계·도구 호출·관측·지표·서브에이전트 트래젝토리).
  - `harbor view jobs`로 시행별 보상·비용·토큰·시간·트래젝토리·설정 잠금본을 본다. 두 작업을 나란히 비교하는 기능의 세부는 문서에서 확인하지 못했다.
- **OpenAI**(H17): 디버깅 단계에서는 트레이스부터 시작해 트레이스 채점으로 워크플로 수준의 문제를 찾는다. "좋음"이 정의되면 반복 가능한 데이터셋·평가 실행으로 옮겨 변경을 비교한다.
- **Vercel**(H3): 누설 제거, 모순 해소, 구현 세부 검사를 행동 검사로 교체하는 식으로 평가 스위트를 먼저 단단하게 만든 뒤 구성끼리 비교했다.
- **판 간 회귀 추적 사례**: Epoch는 판 번호와 변경 기록에 비교 가능성 경계를 적는다(H10). HAL은 공유 로그(25억 토큰)로 사후 분석한다(H4). 하네스 판마다 자동으로 재측정한 공개 사례는 이번 조사에서 찾지 못했다(검색 2회, 부재 단정 아님).

## Q4. 무인 실행과 실사용의 차이

- **Ambig-SWE**(H20, ICLR 2026): 정보를 덜 준 SWE-bench Verified 변형이다.
  - 모델은 명세가 충분한지 부족한지 잘 구분하지 못하고, 기본적으로 묻지 않고 가정으로 채운다.
  - 상호작용을 허용하면 비대화 대비 최대 74% 개선됐다.
- **METR 2025-08**(H18): Claude 3.7 Sonnet의 자동 채점 성공률은 38%였다. 그러나 수동 검토한 PR 15개 중 "그대로 병합 가능"은 0개였다.
  - 테스트를 통과한 실행도 테스트 커버리지 100%, 문서 75%, 린트 75%의 비율로 결함이 있었다.
  - 표본이 작다.
- **METR 2026-03**(H19): 메인테이너 4명이 296개 PR을 맹검 검토했다.
  - 자동 채점이 병합률보다 24.2%p 높았다. 사람 패치 기준선의 병합률은 68%였다.
  - 에이전트가 리뷰 피드백으로 반복할 기회가 없었으므로 능력의 한계로 읽지 말라고 저자가 밝혔다.
- **완주와 능력의 분리 사례**:
  - DeepSWE는 컨텍스트 소진과 시간 초과를 에이전트 책임 실패로 센다. 부분 점수는 없다(H9).
  - HAL CORE-Bench는 자동 채점 77.8%와 수동 채점 95.5%를 병기한다(H5).
  - Harbor는 에이전트 종료 후 컨테이너 상태를 검증한다(H16).
  - "작업 트리 채점 vs 제출물 채점"을 나란히 보고한 연구는 찾지 못했다(미확인).
- **Claude Code `-p` 실행 규칙**(H24, 현행 문서):
  - 메인 대화가 띄운 백그라운드 서브에이전트·워크플로가 끝날 때까지 열려 있다. 그 밖의 백그라운드 작업은 10분 유휴 상한이 있다.
  - `--max-budget-usd`에 닿으면 남은 작업을 멈춘다.
  - SIGTERM을 받으면 진행 중인 턴을 결과 없이 남기고 exit 143으로 끝난다.
  - `--permission-prompts none`을 쓰면 AskUserQuestion이 제거된다.
  - 서브에이전트 기록은 `--forward-subagent-text`로 스트림에 포함할 수 있다.

## Q5. 트래젝토리 분석

- **MAST**(H21): 7개 프레임워크의 150개 트레이스로 14개 실패 모드와 3대분류를 만들었다. 사람 간 일치도는 κ=0.88이다. 1,600개 이상의 주석 데이터와 LLM 판정기를 공개했다.
- **Terminal-Bench**(H7): 과제·모델마다 실패한 시행 2건을 Docent와 MAST 기반 파이프라인으로 분류했다.
  - 사람 2명의 일치도는 κ 93%(20건)였다. GPT-5 판정은 사람 라벨 120건과 90% 일치했다(정밀도 92%, 재현율 90%).
  - 명령 단위 실패 3,800건도 분류했다. 가장 많은 유형은 실행 파일 미설치·PATH 누락(24.1%)이었다.
- **DeepSWE**(H9): GPT-5.5를 Codex CLI 에이전트로 띄워 새 샌드박스에서 트래젝토리를 감사하게 했다. 판정 태그를 붙이고 실패한 테스트를 근본 원인과 연결한다. 이 판정은 공식 채점에 쓰지 않는다. 프롬프트는 공개하지 않았다.
- **HAL**(H4): LLM으로 로그를 검사해 벤치마크 답을 HuggingFace에서 찾는 행동과 항공권 과제에서 카드를 오용하는 행동을 찾아냈다.
- **Docent**(H23, △): 기록을 요약·군집·검색하고 루브릭 판정을 돌리는 도구다. 실행마다 모델·스캐폴드 메타데이터를 붙일 수 있다.
- **ABC 체크리스트**(H22): 과제 설정과 보상 설계의 결함이 성능을 상대값으로 최대 100%까지 과대·과소 추정하게 만든다. 예로 τ-bench는 빈 응답을 성공으로 쳤다.
- **신뢰성**(H13, ICML 2026): 일관성·견고성·예측가능성·안전 4차원의 12개 지표를 15개 모델에 적용했다. 능력 향상에 비해 신뢰성 향상은 작았다. 개별 지표 이름은 전문을 읽지 않아 미확인이다.

## 출처 표

| H번호 | 내용 | URL | 확인 |
|---|---|---|---|
| H1 | Gloaguen 외, Evaluating AGENTS.md (v1 AGENTbench / v3 CTXbench) | https://arxiv.org/abs/2602.11988 · https://arxiv.org/html/2602.11988v3 · https://arxiv.org/html/2602.11988v1 | ○ |
| H2 | Lulla 외, AGENTS.md와 효율 | https://arxiv.org/abs/2601.20404 | ○(초록) |
| H3 | Vercel, AGENTS.md outperforms skills (공급사) | https://vercel.com/blog/agents-md-outperforms-skills-in-our-agent-evals | ○ |
| H4 | Kapoor 외, HAL 논문 | https://arxiv.org/abs/2510.11977 | ○(초록) |
| H5 | HAL 홈페이지(CORE-Bench 해결 선언, 리더보드 중단) | https://hal.cs.princeton.edu/ | ○ |
| H6 | Gundlach 외, Just a Wrapper? | https://mitfuturetech.substack.com/p/just-a-wrapper-how-much-do-scaffolds | ○ |
| H7 | Terminal-Bench 2.0 논문 | https://arxiv.org/html/2601.11868v1 | ○(본문 일부) |
| H8 | Liu 외, Coding Agents Have Converged | https://arxiv.org/abs/2609.17394 | ○(초록) |
| H9 | DeepSWE 논문 | https://arxiv.org/html/2607.07946 | ○(본문 앞 100k자) |
| H10 | Epoch SWE-bench Verified 페이지 | https://epoch.ai/benchmarks/swe-bench-verified | ○ |
| H11 | Anthropic, Quantifying infrastructure noise | https://www.anthropic.com/engineering/infrastructure-noise | ○ |
| H12 | Anthropic, Demystifying evals for AI agents | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | ○ |
| H13 | Rabanser 외, Towards a Science of AI Agent Reliability | https://arxiv.org/abs/2602.16666 | ○(초록) |
| H14 | Nadgir 외, Life After Benchmark Saturation (CORE-Bench) | https://arxiv.org/abs/2606.26158 | ○(초록) |
| H15 | Inspect AI 문서(개요·agent bridge·scorers) | https://inspect.aisi.org.uk/ · https://inspect.aisi.org.uk/agent-bridge.html · https://inspect.aisi.org.uk/scorers.html | ○ |
| H16 | Harbor 문서(verifier·ATIF·결과 보기) | https://docs.harborframework.com/tasks/verifier.md · https://docs.harborframework.com/agents/atif.md · https://docs.harborframework.com/results/view-job-results.md | ○ |
| H17 | OpenAI, Evaluate agent workflows | https://developers.openai.com/api/docs/guides/agent-evals | ○ |
| H18 | METR, Algorithmic vs. Holistic Evaluation (2025-08) | https://metr.org/blog/2025-08-12-research-update-towards-reconciling-slowdown-with-time-horizons | ○ |
| H19 | METR, Many SWE-bench-passing PRs would not be merged (2026-03) | https://metr.org/notes/2026-03-10-many-swe-bench-passing-prs-would-not-be-merged-into-main/ | ○ |
| H20 | Vijayvargiya 외, Ambig-SWE | https://arxiv.org/abs/2502.13069 | ○(초록) |
| H21 | Cemri 외, MAST | https://arxiv.org/abs/2503.13657 | ○(초록) |
| H22 | Zhu 외, Agentic Benchmark Checklist | https://arxiv.org/abs/2507.02825 | ○(초록) |
| H23 | Transluce Docent 문서 | https://docs.transluce.org/ | △ |
| H24 | Claude Code, Run programmatically (`-p`·`--bare`·백그라운드 대기) | https://code.claude.com/docs/en/headless | ○ |

## 기각·확인 실패 원장 — 24 confirmed · 5 killed (미확인 3)

- **killed** "같은 모델 안의 스캐폴드 범위 37.6%p vs 모델 47.9%p"(H8의 것으로 검색 요약에 나옴): H8 초록에 이 수치가 없다. 초록 수치는 29.8%p / 8.8%p다.
- **killed** "잘 쓴 AGENTS.md가 파일 없음보다 낫다"(mewayz.com 요약): H1 본문과 모순된다.
- **killed** "개발자 작성 +4% / LLM −3%"를 현행 결론으로 인용한 2차 글: v1 수치다. v3에서는 +2.4%p(p=0.21)와 −0.5~−2%p로 모두 유의하지 않다.
- **killed** Terminal-Bench 2.0 "약 200과제"(Steel 리더보드): 논문(H7)은 89과제다.
- **killed** Safe.ai의 SWE-Bench Pro "Codex CLI vs Terminus-2" 수치: 페이지가 404여서 원문을 확인할 수 없다.
- **미확인** Epoch의 "스캐폴드만으로 GPT-5 최대 11%p, Kimi K2 Thinking 최대 15%p": 2차 기사(the-decoder, agentmarketcap)만 있고 Epoch 원문을 찾지 못했다.
- **미확인** SWE Atlas의 "네이티브 스캐폴드가 1.5~2배 더 탐색": 초록(https://arxiv.org/abs/2605.08366)에 없다.
- **미확인** Lulla 외(H2)가 "Codex만, 100줄 이하 PR"로 실험했다는 2차 요약: 초록에서는 확인되지 않는다.
- **공급사 자체 주장**: H3(Vercel)과 H11·H12(Anthropic)는 자사 실험이다. H6은 분석을 Claude Opus로 수행했다고 명시했다.

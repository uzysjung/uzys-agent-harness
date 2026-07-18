# ADR-043: 차별화 축 = 계측된 최소 하네스 (1차 NSM 교체)

- Status: Accepted
- Date: 2026-07-19
- PR: #229 (v26.115.0)
- Supersedes: ADR-021 의 "차별화 = 검증 큐레이션" 단독 축 (폐기 아님 — 하위 축으로 존속)
- Context:
  사용자 방향 지시(2026-07-18): *"카탈로그 전수 재판정이나 스킬별로 컨텍스트 얼마나 잡아먹는지,
  정말 필요한 것인지 검토해서 꼭 필요한 것만 남겨 최적화된 하네스를 제공하는 것이 차별화 같아."*
  동시에 **HITO A/B 를 다음 작업에서 기각**.

  착수 전 실측한 현 상태:
  1. 방향의 절반은 이미 문서화돼 있다 — ADR-032 Lean 개정, Will "컨텍스트 이코노미",
     2차 NSM `Session-Start Context Cost`. 사용자가 요구한 것은 **수단 → 차별화 축으로의 격상**.
  2. 카탈로그 전수 판정은 v26.106.0 에 1회 수행됨(62자산, `pattern-guide` vs `operational-fact`,
     ADR-035) — 결과는 강등 5·트랙축소 1·제거 1로 온건했다.
  3. 그 온건함의 원인이 계획 문서에 명시돼 있다: *"제거는 데이터(HITO A/B·설치 로그) +
     사용자 컨펌 필수"*. 즉 **과감한 정리의 근거가 HITO A/B 에 걸려 있었다.**
  4. `src/context-cost.ts` 는 descriptor(frontmatter) 토큰만 잰다. 스킬이 실제 발화하면 들어오는
     **SKILL.md body(이 리포 기준 200~500줄)는 미측정** — "얼마나 잡아먹나"의 큰 쪽이 공백.

  따라서 HITO 를 걷어내면 (3)의 근거가 사라져 keep/drop 이 취향 판정으로 퇴행한다
  (`no-false-ship` 안티패턴 *"직관적으로 별로 같다"*). 대체 근거를 세우지 않고는 축을 격상할 수 없다.
- Decision:
  1. **차별화 축을 "계측된 최소 하네스"로 격상한다.** 주장의 형태를 바꾼다 — "우리는 검증된 것을
     준다"(ADR-021)에서 **"우리는 재봤고, 남길 근거가 있는 것만 준다"**로. ADR-021 의 검증
     큐레이션은 폐기가 아니라 이 축의 하위 수단으로 존속한다(출처 검증 = 안전, 계측 최소성 =
     경제성. 둘은 다른 질문에 답한다).
  2. **1차 NSM 교체.** `HITO per Feature` / `Re-clarification Rate` 를 1차에서 내리고
     (사용자 1차 결정 = 2차 강등 → 실사용 실측 후 **폐기**로 재결정, 아래 4 참조),
     1차를 **하네스 경제성** 짝으로 교체:
     - **양** = `Context Cost per Install` — 트랙별 기본 설치 자산의 상주(descriptor) + 발화(body)
       토큰. ratchet(기본 트랙 증가 시 명시적 정당화).
     - **사후 품질** = `Justified Asset Ratio` — 기본 설치 자산 중 편익 근거를 문서로 보유한 비율.
       목표 100%(기본 설치 한정, opt-in 미요구).

     짝인 이유: 양만 재면 굿하트로 붕괴한다 — 자산을 전부 빼면 토큰은 0 이 되고 하네스도 사라진다.
     근거율이 "빼고 나서도 쓸모가 남았는가"를 붙잡는다 (north-star 스킬의 metric-as-proxy 규약).
  3. **판정 근거 = 2단계 (사용자 결정).** 값싼 결정론 계측으로 거르고, 비싼 검증은 소수에만:
     - **1단계(전수·결정론)**: 상주 + 발화 토큰을 재서 비용 순위표를 만든다. `context-cost.ts` 를
       body 계측까지 확장.
     - **2단계(상위 비용 한정)**: with/without eval 로 편익 델타를 측정. 새 기계 불요 —
       `eval-harness` 스킬 + `skill-creator` 의 baseline 비교 패턴이 이미 그 형태다.

     keep 기준: **편익 델타가 (상주 + 발화) 비용을 설명하는가.** 설명 못 하면 drop 또는 opt-in 강등.
     이 구조는 `gates-taxonomy` 의 "값싼 pre-flight 로 최대한 거르고 비싼 것은 소수에만"과 동형.
  4. **HITO 를 전면 폐기한다.** (초안에서는 "2차 강등"이었으나 사용자 지적 — *"기존에 HITO를
     활용하고 있었어? 다른 사람 쓰고 있는 것 파악이 불가능한데?"* — 을 받아 실사용을 실측한 뒤
     제거로 재판단했다. 아래 근거는 추정이 아니라 리포 상태를 센 결과다.)

     | 확인 | 실측 |
     |---|---|
     | 수집 | `.claude/evals/hito-*.log` 45개+ (2026-04-23 ~ 2026-07-18), 훅 정상 동작 |
     | 판정 사용 | **1회** — `docs/evals/hito-baseline-2026-04-30.md`(Phase D 종료, ADR-001 OQ1) |
     | 그 결과 | HITO/feature ≈ 20 vs 목표 ≤ 3 = **6.7× 초과** |
     | 그 수치로 고친 것 | **0건** — 이후 ADR 들은 전부 *"검증 경로 = HITO A/B"* 미래형 언급뿐 |

     지표 설계 자체에 두 결함이 있었다: ⓐ 훅이 세는 것은 `prompt_submit` **총계**인데 지표 정의는
     *"feature 당"* 이라 매번 사람이 구간을 수기로 잘라야 했다(baseline 문서가 "추정 HITO"라고
     쓴 이유) ⓑ 로그가 사용자 로컬에만 남아 **외부 사용자 측정이 구조적으로 불가**했다
     (ADR-021 이 "chicken-egg"로 부르며 미해결로 남긴 것). `Re-clarification Rate` 도 같이
     폐기한다 — 측정 방법이 "분기 1회 수동 sampling"이었고 sampling 기록이 남은 적이 없다.

     제거 범위: `templates/hooks/hito-counter.sh` · `templates/codex/hooks/hito-counter.sh` ·
     `templates/settings.json` UserPromptSubmit 배선 · `templates/codex/config.toml.template` 배선 ·
     `src/manifest.ts` ALWAYS_HOOKS · `src/codex/transform.ts` HOOK_NAMES ·
     `scripts/hito-aggregate.sh` · `scripts/nsm-aggregate.sh`. **과거 기록**
     (`docs/evals/hito-baseline-2026-04-30.md`, `docs/requirements-trace.md`, `docs/archive/`)은
     **보존** — 왜 뺐는지의 근거이므로 지우면 판단 자체가 검증 불가가 된다.

     자기적용 의미: 이 ADR 이 세운 축("아무도 안 읽는 것은 비용일 뿐")의 **첫 번째 적용 대상이
     우리 자신의 훅**이었다. 모든 사용자가 매 프롬프트마다 bash 프로세스 비용을 냈고, 그 산출물을
     읽는 소비자는 없었다.
- Alternatives:
  - **전 자산 with/without eval** — 기각. 자산 수 × 태스크 수만큼 비용이 들고, 저비용 자산까지
    재는 낭비가 크다. 값싼 계측으로 순위를 먼저 세우면 대부분은 eval 없이 판정된다.
  - **비용 계측만 + 사용자 판단** — 기각. 편익 쪽 근거가 없어 판정이 다시 취향으로 돌아간다.
    이 ADR 이 세우려는 것이 정확히 그 반대다.
  - **HITO 2차 강등(존치)** — 이 ADR 초안의 결정이었으나 **기각**. 근거로 든 "측정 인프라가 이미
    있다"는 실측 후 무너졌다 — 그 인프라는 타임스탬프 카운터일 뿐이고 지표 정의(feature 당)를
    자동으로 산출하지 못한다. "신속 주장의 유일한 근거"라는 서술도 과장이었다: 그 근거는 2.5개월간
    한 번도 인용되지 않았다. **쓰이지 않는 지표를 남겨두는 것은 계측이 아니라 장식이다.**
  - **차별화 축을 ADR-021(검증 큐레이션) 그대로 두고 최소화는 수단으로 유지** — 기각. 경쟁 지형이
    "더 많이"(skills.sh 70+ 에이전트)인 상황에서 "재보고 줄였다"는 대비가 방어 가능성이 더 높다는
    판단. 단, 이 판단 자체는 **가설**이며 외부 채택 신호(Phase 3)로만 검증된다.
- Consequences:
  - `docs/NORTH_STAR.md` **Major CR** — §2 1차/2차 지표 교체, §3 Pillar 2 정의에 "계측된 최소성"
    추가, 차별화 축 서술 갱신, Changelog 기재.
  - `src/context-cost.ts` 확장 필요(body 토큰). **현재 미구현 — 이 ADR 시점에서 계측은 상주분만**.
    `Justified Asset Ratio` 는 아직 0 측정치이며, 근거 문서 형식은 후속 작업에서 정한다.
    지표를 선언했다고 달성했다는 뜻이 아니다(no-false-ship).
  - v26.106.0 판정 결과는 유효하나, **제거 근거가 HITO A/B 였던 항목은 새 기준으로 재판정** 대상.
  - 후속 큐: ① body 토큰 계측 + 순위표 ② 상위 비용 자산 eval ③ 재판정 → keep/drop/강등 반영.

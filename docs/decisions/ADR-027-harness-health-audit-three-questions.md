# ADR-027: harness-health-audit = 3질문(truth/efficacy/economy) 재설계

- Status: Accepted
- Date: 2026-07-15
- PR: (feat/harness-health-audit)
- Supersedes: 없음 (신규 dev-method 자산)

## Context

사용자 요청(2026-07-15): 2026-07-14 에 3개 프로젝트(`DYLD-GoalTrack`·`uzysClaudeUniversalEnv`·`EarningAgent`)에서 수행한 "하네스 엔지니어링 검토·개선" 작업을 **스킬화**. 소스 3곳은 read-only 조사, 산출물은 본 repo 에 write.

증거 기반 재구성(git 커밋 본문·ADR)으로 방법론 5범주를 뽑았다: ①stale-stack 교정 ②폐기 namespace 정렬 ③죽은 ceremony 배제 ④계측 정직화 ⑤위생. 관통 원칙 = **"실사용 뼈대 유지, 죽은 살만 제거"**.

**초안의 한계 — 사용자 지적(2026-07-15)**: 5범주가 전부 **"설명서가 틀렸나"(정확성)** 한 축이었다. 사용자는 "그 외에도 **스킬들을 잘 활용하는지** 등 하네스, **루프 엔지니어링이 잘되는지**를 검토해야" 한다고 지적. 스킬이 있는데 안 불리는 것은 드리프트가 아니지만 **하네스 실패인 것은 맞다** — 초안에 이 축이 통째로 없었다.

이어 `/deep-research` 로 확보한 근거가 설계를 한 번 더 바꿨다:

1. **선행 도구 실재** — [AgentLint](https://www.agentlint.app/) 가 33검사/5차원(findability·instructions·workability·continuity·safety)으로 `CLAUDE.md`·`AGENTS.md`·`.cursor/rules`·copilot-instructions·CI·pre-commit·`.gitignore` 를 이미 **결정론적으로** 린트한다. 초안은 이와 상당 부분 중복이었다. 결정적 원칙: *"Never send an LLM to do a linter's job. LLMs are comparably expensive and incredibly slow compared to traditional linters and formatters"* ([HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)) — 이는 본 repo `CLAUDE.md` **Rule 5("If code can answer, code answers")와 동일 명제**다.
2. **효과성 축의 근거 확보** — 스킬은 `name`+`description` 메타데이터만으로 선택되며, 본문은 관련하다고 판단될 때만 로드된다 ([Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)). 즉 **설명이 애매하면 본문 품질과 무관하게 안 불린다**. Anthropic skill-creator 는 Claude 가 스킬을 *undertrigger* 하는 경향을 명시. 루프 쪽은 *"평가자를 생성자와 분리하는 것이 자기평가보다 우수 — 에이전트는 자기 일을 후하게 채점한다"* ([Osmani](https://addyosmani.com/blog/agent-harness-engineering/)).
3. **제3의 실패축 발견(초안에 없던 것)** — 하네스는 **전부 맞는 말이어도 너무 커서 안 지켜질 수 있다**. context rot: Chroma 가 18개 프런티어 모델에서 입력 길이 증가에 따른 성능 저하를 확인, 방해문장 1개만으로도 저하 ([Chroma](https://www.trychroma.com/research/context-rot)). 위치 효과: U자 곡선 ([Liu et al., TACL](https://aclanthology.org/2024.tacl-1.9/)). 그리고 *"Claude will ignore the contents of your `CLAUDE.md` if it decides that it is not relevant"* (HumanLayer) — **존재 ≠ 준수**.

## Decision

**드리프트(정확성) 단일축을 폐기하고 3질문 구조로 재설계한다.** 자산 id/이름은 `harness-health-audit` (초안의 `harness-drift-audit` 폐기 — "drift" 는 정확성만 지칭해 **자기 자신이 A4 "축소광고"에 걸린다**. 또한 기존 `ecc:harness-audit` 커맨드와 이름 충돌 회피 — 리서치가 지적한 "중복 트리거 경쟁").

- **A. Is it TRUE?** (정확성) — A1 stale-stack · A2 stranded namespace refs(**스킬·에이전트 본문까지**) · A3 dead ceremony · A4 false advertising. 초안 5범주의 ①②③④ 계승, ⑤위생은 C 로 흡수.
- **B. Is it USED?** (효과성 — 사용자 지적) — B1 스킬/툴 활용도(설명 트리거성·중복 경쟁·sprawl·관찰된 사용) · B2 루프 무결성(진짜 verify 단계 존재? 생성↔평가 분리? no-progress 정지? 검사 proxy가 진짜 목표?) · B3 룰 준수(존재 ≠ 준수).
- **C. Is it AFFORDABLE?** (경제성 — 리서치 발견) — C1 지시 예산(context rot·U곡선·길이 규범) · C2 린터 일을 LLM에 시키나.
- **린터 우선 위임** — 스킬 첫 섹션이 "결정론적 린터를 먼저 돌려라". 스킬은 린터가 **구조적으로 판정 불가한 것**만 한다: 이 단언이 *이 repo* 의 진짜 스택인가 / 이 훅이 실제 fire 하는가 / 이 스킬이 트리거되는가. (Rule 5 정합)
- **Ratchet 충돌을 뭉개지 않고 명시** — Osmani 의 *"모든 줄은 실제로 터진 사고 하나로 거슬러 갈 수 있어야 한다"* 는 훌륭한 감사 렌즈지만 본 스킬의 **"죽었다고 증명해야 지운다"** 와 충돌한다. 해소: Ratchet 은 **추가** 규칙, 본 스킬 규칙은 **삭제** 규칙 → 사유 없는 줄은 **삭제가 아니라 flag**. (Rule 7 "충돌은 평균내지 말고 드러내라")
- **정직 계약** — 트리거율 공식 지표는 존재하지 않으므로(Anthropic 가이드는 "대표 태스크로 관찰"만 제시) 활용도는 **"측정이 아니라 관찰"**로 보고. Chroma 는 % 수치를 발표하지 않으므로 없는 정밀도 인용 금지. 리포트에 *Unverified* / *Kept-and-flagged* 행 상시 노출 강제.

## Alternatives

- **초안 5분류 유지** — 기각. 사용자가 지적한 효과성 축("스킬 활용·루프 엔지니어링")이 통째로 빠져 "맞는 말인데 아무것도 안 일어나는" 하네스를 구조적으로 못 잡는다. 리서치가 발견한 경제성 축도 누락.
- **AgentLint 래핑/재구현** — 기각. 결정론적 린터가 이미 하는 form 검사를 LLM 으로 재현 = Rule 5 정면 위반, 비싸고 느리고 덜 정확. 대신 "먼저 린터를 돌려라"로 **위임**하고 경계를 명시.
- **정확성 스킬 / 효과성 스킬 2개로 분리** — 기각. 동일 트리거("하네스 점검해줘")·동일 대상·동일 증거수집(surface inventory + ground truth)을 공유한다. 분리 시 두 스킬이 트리거를 놓고 경쟁 — 리서치가 지적한 undertriggering 악화 요인을 자초.
- **dogfood `.claude/skills/` 만 (미출하)** — 기각. 사용자가 destination = "정식 dev-method 자산"으로 명시 확정(2026-07-15).
- **`harness-drift-audit` 이름 유지** — 기각. 상기 축소광고 + `ecc:harness-audit` 충돌.

## Consequences

- **긍정**: 하네스 실패의 3가지 독립 원인(틀림/불활성/과대)을 한 스킬이 커버. 린터와 역할이 겹치지 않아 둘을 같이 쓰면 form+substance 전부 커버. 모든 발견이 stated↔measured 짝 강제라 "낡아 보인다" 류 추정 배제(본 repo 안티패턴 규칙 정합). 삭제엔 죽음 증명 요구 → 살아있는 게이트를 조용히 스트립하는 최악 사고 차단.
- **자기증명(dogfooding)**: 본 자산을 추가하는 과정에서 **A4 stale-count 드리프트 3건을 실제로 발견·정정**했다 — `external-assets.ts` "방법론 skill 6종"(실제 7), 동 파일 `INTERNAL_BUNDLED_SKILL_IDS` 주석 "7", `interactive.test.ts` "dev-method skills 6종". 추가로 `docs/COMPATIBILITY.md` 의 **수동** 요약줄이 자동생성 블록(gen:compat) 바로 위에서 49/59·7종으로 stale — 자동/수동 수치 병존이라는 전형적 drift 구조. 스킬이 주장하는 검사 유형이 이 repo 에 실재함을 방법론 자체가 입증.
- **드리프트 차단**: 출하 SSOT = `templates/skills/harness-health-audit/SKILL.md` (installer 가 4-CLI 로 복사). 자산 수·dev-method 수는 `EXTERNAL_ASSETS`/`DEV_METHOD_SKILL_IDS` 에서 derive 되어 `external-assets.test.ts`(60/8 exhaustive) + `docs-supply-chain.test.ts`(문서 총계 == `EXTERNAL_ASSETS.length`, CHANGELOG 현행성) 가 `npm run ci` 에서 강제한다 — 본 ADR 의 수치가 stale 해지면 ci 가 fail.
- **부정/리스크**:
  (a) **스킬 실행 자체는 미검증**. 방법론 문서 자산이라 사용자 프로젝트에서 실행되며, harness CI 가 남의 repo 감사 품질을 검사할 수 없다 — 계약은 본문 지시로만 성립(ADR-026 과 동일 한계). 자산은 `🟡 local`(Docker 실설치 미검증)로 정직 표기.
  (b) **B3(룰 준수)·B1(관찰된 사용)은 파일만으로 측정 불가** — transcript 없으면 `unverified` 로 보고하도록 본문에 강제했으나, 실행 에이전트가 이를 무시하면 강제되지 않음.
  (c) **인용 규범은 threshold 가 아님** — 300줄/60줄/10툴 등은 실무 합의이지 측정된 임계값이 아니다. 본문에 "smell test, not a gate"로 명시했으나 오독 여지 잔존.
  (d) **선행 스킬 `agent-docs-audit` 과의 중복 미확인** — 조사 시 페이지가 HTTP 403 이라 열람 실패. 중복 가능성 배제 못 함(정직한 공백).
  (e) 349줄 = dev-method 스킬 중 최장. 500줄 상한 내이나 C1(예산) 을 설파하는 스킬이 길다는 긴장 존재 — references/ 분할은 후속 여지.
- **언어**: 본문 영어(공개 npm 패키지, 기존 출하본 일치), 프론트매터 트리거는 한국어+영어 병기(사용자 확정 2026-07-15).
- **문서 영향**: CHANGELOG v26.98.0, `docs/COMPATIBILITY.md`(gen:compat 자동 + 수동 요약줄), `index.html` 총계 분모 60.

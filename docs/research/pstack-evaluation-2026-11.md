# #962 평가 — pstack 에서 무엇을 가져올 것인가

- 평가일: 2026-11-08 · 하네스 기준: `main` a60ae3b (v26.184.0) — 계획서 기준(21fa039 · v26.183.0) 이후 인용 파일은 바뀌지 않았다
- 상류 확인: cursor/plugins `2776ddd`(계획서가 고정한 판) · pstack-claude `d88063f`. 핵심 3개 파일(create-verification-skill · blast-radius · benchmark-checklist)은 2026-11-07 main 과도 바이트가 같다
- 판정 순서: ① 설치자가 AI 코딩 도구로 개발을 더 잘하게 되나 → ② 이미 있나 · 비용(상주 · 유지 · 중복 · 4-CLI 도달)
- 표기: **[관측]** = 내가 원문·코드·프로세스로 직접 확인 · **[계획 주장]** = 첨부 계획서의 단정(미검증)

---

## 1. 결론

1. **pstack 을 통째로든 스킬 단위로든 새 자산으로 들여오지 않는다.** 핵심 철학(증거 기반 완료 · 독립 검증 · 위험 비례 검증)은 이미 배포 앵커 `templates/CLAUDE.md` · Delivery 룰 · reviewer 에 있다. pstack 고유 장치(poteto-mode 라우팅 훅 · 역할별 고정 모델 · 원칙 23종 스킬 · 플레이북 23종)는 상주 비용을 늘리고, 하네스가 이미 정한 모델 선택 방식(model-orchestration)과 부딪친다.
2. **가져올 것은 두 문장 묶음뿐이고, 둘 다 기존 파일 안으로 들어간다.** ⓐ 정리 규칙 "프로세스 이름으로 죽이지 말고 띄운 것만 죽인다 · 정리가 증거를 지우면 실패다"를 `ui-visual-review` 에 넣는다. 지금 이 스킬은 `pkill -f "playwright|Chrome for Testing"` 를 시키는데, 이 패턴이 이 머신에서 다른 세션의 Playwright MCP 서버 2개와 Chrome for Testing 에 걸렸다 [관측]. ⓑ blast-radius 의 "안전을 떠받치는 사실 하나 + 증거 사다리"를 `reviewer` 에 넣고, 그 자리의 "확신 80%" · "변경되지 않은 코드는 건너뛴다" 필터를 대신한다.
3. 계획서에 실린 사실 주장은 대부분 원문과 맞다. 다만 권고의 무게중심이 다르다. 계획서는 새 파일럿 · 평가 체계 · 백로그 12단계로 가지만, 같은 범주(verification-loop · eval-harness)는 ADR-090 에서 "관측 없음"으로 이미 은퇴했다. 그래서 그 부분은 기각하거나 관측이 생길 때까지 보류한다. 계획서가 덧붙인 pstack 과 무관한 정합성 결함 3건은 사실로 확인됐다. 이것은 별도 이슈로 다룰 일이다(§4 말미).

---

## 2. 상류 사실 확인

URL 접두: **C** = `https://github.com/cursor/plugins/blob/2776ddd2355d6d6c8747d3964600f28daf62f049/pstack/` · **F** = `https://github.com/michael-denyer/pstack-claude/blob/d88063f3355a5ecff0e6dbb890a11bab4b08bc2e/`

| # | 계획서 주장 | 판정 | 근거 (원문 요지) | 출처 |
|---|---|---|---|---|
| 1 | 공식 pstack README 가 Claude Code 설치를 지원하고, 공통 원본에서 생성한 런타임별 사본·어댑터를 쓴다 | **확인** | "in claude code: `/plugin marketplace add cursor/plugins`" · `harness/pstack/` 생성본 · `generate-pstack-harness-trees.mjs` · claude-code 어댑터 문서 | C`README.md` · C`docs/harness/claude-code.md` |
| 2 | Flavio 글은 Claude 판을 비공식 포트 중심으로 설명한다(공식 지원과 시차) | **확인** | 글 갱신일 2026-09-29. "pstack-claude … is not the official package". 공식 Claude Code 지원 언급 없음. 글의 개수(플레이북 22)는 현행 README(23)와 다르다 | https://flaviocopes.com/pstack/ |
| 3 | 핵심 기능 대부분은 실행 엔진이 아니라 에이전트용 지침 문서다 | **확인** | 스킬 다수가 SKILL.md 지침이다. 보조 스크립트는 watch-pr · statechart 등 일부뿐 | C`skills/` 트리 |
| 4 | create-verification-skill: 저장소를 조사해 Launch/Doctor/Drive/Evidence/Cleanup + feature map 을 갖춘 프로젝트 로컬 verify 스킬을 생성하고, 생성물을 한 번 실행해 증명한다 | **확인** | "Interview the repo, not the user" · "Never kill by process name; kill what you started" · "A generated skill that was never executed is a draft" | C`skills/create-verification-skill/SKILL.md` |
| 5 | maintain-verification-skill: 문서 drift · 하네스 gap · 제품 gap 을 가른다 | **확인** | Triage 단계에 세 분류. 제품 결함은 문서로 덮지 않는다. 단 "Live pass. Required even when source looks clean" — 매번 전 기능 실행이다 | C`skills/maintain-verification-skill/SKILL.md` |
| 6 | blast-radius: 안전을 떠받치는 사실 하나를 찾아 코드 실행으로 증명한다. grep 너머(라이브러리 원본 · 직렬화 · 플래그)를 본다 | **확인** | "Find the one fact it's safe because of" · 증거 5단계(말함→줄 지목→불가능 보임→실행→앱 재현) | C`skills/blast-radius/SKILL.md` |
| 7 | interrogate: 실행으로 입증된 finding 만 남기고 조정자가 명령을 재실행한다 | **확인** | "Leave out anything you did not run" · "Verify each finding … by rerunning its command" | C`skills/interrogate/SKILL.md` |
| 8 | runtime-forensics 는 "읽기 전용" 표기와 라이브 hotfix 를 함께 담고 있다 | **확인** | "hotfix the live code without reloading" + "throughput checkpoint: n/a, read-only forensics" | C`skills/poteto-mode/playbooks/runtime-forensics.md` |
| 9 | trace-forensics 는 자료를 SQLite 로 바꿔 질의한다 | **확인** | "Dump the trace or heap snapshot into sqlite" | C`skills/poteto-mode/playbooks/trace-forensics.md` |
| 10 | benchmark-checklist: 오류 · 실제 작업량 · 튜닝 · 한계 · 반복성을 검증한다 | **확인** | 7문항. 반복은 "at least 5 times, alternating" | C`skills/benchmark-checklist/SKILL.md` |
| 11 | hillclimb 은 시도 횟수 하한 · 고정 모델 · 수락마다 커밋을 요구한다 | **확인** | "pairs a target with a floor on attempts" · 기본 `grok-4.7-xhigh-fast` · "One commit per accepted fix" | C`skills/poteto-mode/playbooks/hillclimb.md` |
| 12 | eval 은 기계적인 단어 금지 규칙을 둔다. 정상 프로젝트의 test/benchmark 경로를 제거한다 | **부분** | 앞부분은 확인("No `eval`, `test`, … in any directory, file, or prompt the candidate sees"). "경로 제거"는 계획서의 확대 해석이다 — 원문은 후보가 보는 이름을 바꾸라는 것이다 | C`skills/poteto-mode/playbooks/eval.md` |
| 13 | architect: 호출자 사용 예부터 시작하고, 최소 두 설계를 내며, 함수 경계를 넘으면 쓴다 | **확인** | "Require at least two structurally distinct candidates" · README "crosses a function boundary" · 사람 체크포인트는 기본 꺼짐 | C`skills/architect/SKILL.md` |
| 14 | arena · swarm · how · why · correct · reflect · bro · teach · unslop 이 존재하고 계획서가 요약한 역할을 한다 | **확인** | README skills 표 | C`README.md` |
| 15 | create-formal-verification-skill: 속성 하나를 맞는 도구로 검증하고 재확인 스킬을 생성한다 | **확인** | README 표 · SKILL.md | C`skills/create-formal-verification-skill/SKILL.md` |
| 16 | pstack-claude 는 자체 변경을 `forks.json` 에 기록하고, upstream SHA 와 기계적 변환을 분리한다 | **확인** | `upstream.json`(구성요소별 sha · exclude) · `substitutions.json`(pattern/replacement/rationale) · `forks.json`(kind · why · since · upstream). 단 port 가 추적하는 pstack sha 는 `c742dd6` 이고 계획서 비교 기준 `2776ddd` 와 다르다 | F`tools/upstream.json` · F`tools/forks.json` · F`tools/substitutions.json` |
| 17 | pstack-claude 는 검증 근거의 revision 연결(head/base SHA · patch-id)과 명시적 landing authority 를 보탰다 | **부분** | landing authority 와 verdict 의 head/base SHA 기록은 port 의 fork 다(forks.json `since 0.9.34`). **patch-id 재검증 규칙은 공식 upstream shipping.md 에 이미 있다** | F`plugins/pstack/skills/poteto-mode/playbooks/shipping.md` · C`skills/poteto-mode/playbooks/shipping.md` |
| 18 | pstack-claude 는 SessionStart 라우팅 훅을 더하고 4개 이상의 CLI(Codex · OpenCode 2 · Antigravity 포함)를 지원한다 | **확인** | README "adds a SessionStart hook that routes tasks to poteto-mode" · 런타임별 설치 절 | F`README.md` · F`plugins/pstack/hooks.json` |
| 19 | (계획서 미언급) Claude Code 에는 번들 `/verify` 가 있어 port 가 생성 스킬 이름을 `verify` 로 바꿔 대체한다 | **미확인** | port 의 forks.json 설명에만 있다. 내가 직접 확인한 것은 이 세션 Claude Code 스킬 목록의 내장 `run`("Launch and drive this project's app … First looks for a project skill that already covers launching the app")뿐이다 | F`tools/forks.json` |
| 20 | Flavio 본인도 작은 수정에는 전체 워크플로 비용이 크다고 본다 | **확인** | 깊은 조사 · 적대적 리뷰 · 런타임 증명용으로만 쓰고 작은 일은 자기 루프를 쓴다. verification-skill 방식을 가장 높이 평가한다("a repository capability") | https://flaviocopes.com/pstack/ |

**계획서가 하네스에 대해 주장한 것 — 직접 확인한 결과**

| 주장 | 판정 | 근거 |
|---|---|---|
| G01 루트 `CLAUDE.md` "애매하면 전체를 돌린다" ↔ `.claude/rules/test-policy.md` "기본값으로 전체를 돌리지 않는다" | **확인** | 두 문장이 실재하고 서로 반대다. 둘 다 개발용이고 설치자에게는 나가지 않는다 |
| G02 objective-brief 리뷰어 위임형이 "테스트 작성은 리뷰어 몫 · 스모크만"이라고 한다 | **확인** | `templates/skills/objective-brief/SKILL.md:78-83`. 배포판 `templates/agents/implementer.md:3` "closes it with a test that fails without the change" 와 충돌한다 |
| G03 multi-persona-review 가 없는 절 "Worker lifecycle" 을 참조한다 | **확인** | `:113` · `:155` 이 가리킨다. `model-orchestration/SKILL.md` 의 절은 §1~§6 이고 그 이름이 없다 |
| G04 reviewer 가 "확신 80% 이상" · "변경되지 않은 코드는 CRITICAL 보안 외 건너뜀"이라고 한다 | **확인** | `templates/agents/reviewer.md` Step 4 |
| G05 ui-visual-review 가 프로세스 이름으로 일괄 종료하고, baseline 자동 갱신과 승인 필수가 모순된다 | **확인** | `:90` `pkill -f "playwright\|Chrome for Testing"` · `:195` "PASS만 있음 → 자동 baseline 업데이트 가능" ↔ `:211` "항상 명시적 approve 필요" |
| G06 model-orchestration 카탈로그 설명이 "vendor tiers 로 매핑"이라고 한다 | **확인 · 영향 작음** | `src/external-assets.ts:349` ↔ 본문 `:50` "rather than fixed vendor-role" |
| `audit-harness-fit/evals/scenarios.yaml` 이 `status: not_executed` 다 | **확인** | `:2-3` |

---

## 3. 제안별 판정

도달 범위: 번들 스킬은 4개 CLI 전부에 깔린다(ADR-086 · `INTERNAL_BUNDLED_SKILL_IDS`). `reviewer` 에이전트는 `.claude/agents/` 에만 깔리므로 **Claude Code 전용**이다(`src/manifest.ts:441` · README:33).

| ID | 제안(계획서) | 하네스에 이미 있나 | 설치자 이득 | 비용 · 4-CLI | 판정 |
|---|---|---|---|---|---|
| A01 | create/maintain-verification-skill 파일럿(프로젝트별 실행·검증 자료) | 부분 — Delivery 룰 "실행하지 않은 상태는 통과가 아니다 · 경로마다 실행 증거"(`templates/rules/ship-checklist.md`), UI 쪽은 `ui-visual-review` 런처. **실행 방법을 기록하는 자산은 없다** | 가설: 세션마다 실행·조작법을 다시 찾지 않게 된다. **설치자 쪽 관측 없음.** Claude Code 에는 내장 `run` 이 같은 자리를 먼저 찾는다 [관측] | 새 스킬이면 설명문이 4 CLI 에 상주한다. 생성물은 하네스 스킬 자리(`.claude/skills/` · `.agents/skills/`)에 놓이므로 ADR-097 소유 판정과 겹친다. maintain 은 매 패스 전 기능 라이브 실행이 기본이라 비용이 크다 | **REJECT(지금)** — 벤더 내장과 겹치고 관측이 없다. 같은 범주가 ADR-090 에서 은퇴했다. 그 정리·증거 규칙만 A01′ 로 가져온다 |
| A01′ | (A01 에서 떼낸 것) "이름으로 죽이지 말고 띄운 것만 · 정리 뒤에도 증거가 남는지 확인" | 없음 — `ui-visual-review:90` 이 정반대(`pkill -f`)를 시킨다 | **명확하다.** 이 머신에서 그 패턴이 다른 세션의 `@playwright/mcp` 2개와 Chrome for Testing 에 걸렸다 [관측, `pgrep -fl` 읽기만]. 그대로 따르면 설치자의 다른 에이전트 브라우저 도구가 끊긴다 | 기존 스킬 본문 몇 줄. 상주 증가 0. UI 트랙 4 CLI 도달 | **ADOPT** |
| A02 | blast-radius → reviewer 에 통합 | 부분 — reviewer 가 "입증된 중대 위험"만 블로커로 본다. 다만 증거 수준이 "확신 80%"(자기 신고)이고, 변경되지 않은 코드는 건너뛰라고 지시한다 | 바뀌지 않은 호출자 · 직렬화 · 설정에서 터지는 회귀(작은 diff 의 전형 사고)가 지금 필터에 걸려 빠질 수 있다. 확신 숫자 대신 "어디까지 증명했나"를 쓰게 된다 | 에이전트 파일 몇 줄(소환 시에만 로드). **Claude Code 전용** | **ADAPT** — 증거 사다리와 "안전 사실 하나"만 넣는다. 강제 실행 스크립트와 arena 확장은 넣지 않는다 |
| A03 | interrogate → 리뷰에 통합 | 있음 — reviewer · multi-model-debate(독립 초안 · 교차 검증) · Claude Code 내장 `/code-review`(다중 에이전트 레벨) | 추가 이득은 A02 의 증거 사다리로 충분하다. "실행 못 한 finding 전부 탈락"은 정적 결함을 지운다 | 중복. 리뷰 에이전트를 벤더 내장으로 은퇴한 선례가 있다(ADR-089) | **REJECT** (A02 에 흡수) |
| A04 | runtime/trace forensics(선택형 후보) | 없음(전용 자산). 모델 기본 능력 + 앵커 §5 "실제 산출물로 판단" | 관측 없음. 원문 자체가 "읽기 전용"과 라이브 hotfix 를 함께 담고 있어 모순이다 | 새 스킬 상주 · 프로파일러 의존 | **REJECT** |
| A05 | hillclimb / benchmark-checklist(선택형 후보) | 없음 — 배포판에 측정 무결성 지침이 없다(`templates` 에서 "benchmark" 검색 결과는 무관한 자리뿐) | benchmark-checklist 4·7번(오류가 났나 · 일이 실제로 일어났나)은 가짜 속도 개선 보고를 막는 데 쓸모 있다. **설치자 쪽 관측 없음.** hillclimb 은 고정 모델 · 시도 하한 · 커밋 정책이 하네스와 충돌한다 | 새 스킬이면 설명문 상주 · 유지 부담 | hillclimb **REJECT** · benchmark-checklist **보류** — 성능 주장 오류가 설치자 프로젝트에서 관측되면 그때 스킬로 들인다(MIT, 출처 표기) |
| A06 | eval → 기존 평가 자산에 통합 | 있음 — `multi-model-debate/references/evaluation.md` · `audit-harness-fit/evals/scenarios.yaml` | 설치자 이득은 간접적이다(메인테이너가 스킬을 평가하는 도구) | ADR-090 이 eval-harness 를 은퇴시켰다 | **REJECT**(설치자용) — 메인테이너가 스킬 효과를 잴 때 블라인딩 체크리스트로 참고하는 것은 자유 |
| A07 | how / why 참조 | 있음 — 모델 기본 탐색 · Claude Code 내장 Explore · objective-brief 입력 절 | 없음 | 중복 | **REJECT** |
| A08 | architect | 부분 — 앵커 §2 "simplest sufficient" · objective-brief · model-orchestration | "최소 두 설계 · 사람 체크포인트 기본 꺼짐"은 앵커의 "가장 단순한 충분안"과 어긋난다 | 새 스킬 · 다중 모델 의존 | **REJECT** |
| A09 | arena / swarm | 있음 — model-orchestration · multi-model-debate | 없음 | 제2 라우터가 생긴다 | **REJECT** (계획서와 같은 결론) |
| A10 | correct / reflect | 있음 — recurrence-prevention("more deterministic when prose has demonstrably failed") · audit-harness-fit · NORTH_STAR "룰은 공시, 훅은 차단" | 없음 | 중복 | **REJECT** |
| A11 | session pickup / pause safely | 있음 — compaction-handoff | 없음 | 중복 | **REJECT** |
| A12 | bro / teach / unslop | 있음 — user-centered-explanation · natural-korean | 없음 | 중복 | **REJECT** |
| A13 | formal verification / statechart | 없음 | 틈새 영역이다. TLA+ · Java 의존. 관측 없음 | 무거운 의존 | **REJECT** |
| A14 | upstream/forks/substitutions 관리 방식 | 해당 없음 — 하네스는 외부 스킬을 출처에서 직접 설치하고(카탈로그) 자작은 이 리포가 SSOT(ADR-062) | 설치자 이득 없음 | 미러 체계를 새로 만드는 비용 | **REJECT** — 아이디어만 가져오므로 원문 복사가 없다. 출처는 커밋·이슈에 링크로 남긴다 |
| — | pstack 통째 설치 / 외부 카탈로그 등록 | — | 원하는 설치자는 pstack-claude 로 4 CLI 에 직접 깔 수 있다 [관측] | 라우팅 훅 상주 · 역할별 고정 모델이 하네스 앵커·model-orchestration 과 충돌 | **REJECT** (계획서와 같은 결론) |
| — | 원칙 23종 · poteto-mode · 플레이북 | 있음 — 앵커 6원칙 | 없음 | 설명문 23개 상주 · "not a fixed workflow" 와 충돌 | **REJECT** |
| G01 | 루트 CLAUDE.md 요약 충돌 | — | 설치자 이득 0(개발용). 개발 세션 기준 충돌은 실재한다 | 한 줄 | **pstack 무관 — 별도 이슈** |
| G02 | objective-brief 형식·모델·검증 역할 정리 | — | "테스트는 리뷰어 몫"이 배포판 implementer 지시와 충돌해, 같은 작업자가 상반된 지시를 받는다. 이 부분은 이득이 실재한다. XML 형식 강제 · 모델 명시 완화는 ADR-088 결정을 다시 여는 일이고 근거가 없다 | 몇 줄 · 4 CLI | 검증 역할 줄 **ADAPT(별도 이슈)** · 나머지 **REJECT** |
| G03 | multi-persona-review 패널·재검토 유연화 + 끊긴 참조 | — | 끊긴 참조는 실재하는 작은 결함이다. 패널 수·재실행 변경은 스킬 본문이 연구 근거로 정한 값이라 바꿀 근거가 없다 | 몇 줄 | 참조 수정 **ADOPT(별도 이슈)** · 나머지 **REJECT** |
| G04 | reviewer 근거·변경 영향 | — | A02 와 같다 | — | **A02 로 통합** |
| G05 | ui-visual-review 수명·baseline | — | A01′ 과 같다. 여기에 baseline 모순(`:195` ↔ `:211`)을 함께 정리하면 승인 없이 기준이 덮이는 경로가 사라진다 | 몇 줄 | **A01′ 와 한 PR** |
| G06 | 카탈로그 설명 정합 | — | 위저드에 보이는 설명 한 줄이다. 영향 작음 | 한 줄 | 선택 — 별도 이슈에 끼워도 된다 |
| §7·§9·§10·§13·§14 | 프로젝트 검증 파일럿 · 진단 · 측정 · 평가 사례 12종 · 백로그 W01~W12 | — | 위 A01·A04·A05·A06 판정을 따른다. 평가·백로그 체계 자체는 설치자에게 닿지 않는 절차 비용이다 | 메인테이너 시간 | **REJECT** — NORTH_STAR §1 "생산성을 낮추는 세부 제약은 두지 않는다" |

---

## 4. 권고 변경 (이득 순, 최소 집합)

### ① `templates/skills/ui-visual-review/SKILL.md` — 띄운 것만 정리하고, baseline 은 승인으로만 바꾼다

- **바꿀 곳**: `:90` step 0 의 `pkill -f "playwright|Chrome for Testing"` 를 바꾼다. 이 실행이 띄운 프로세스(런처 PID 또는 이 프로젝트 profile dir 을 쥔 프로세스)만 종료하게 하고, 프로필 잠금이 원인이면 그 profile dir 을 쥔 프로세스를 찾아 끝내게 한다. 정리 뒤에도 캡처 산출물이 남아 있는지 확인하는 한 줄을 더한다. `:195` "PASS만 있음 → 자동 baseline 업데이트 가능"은 `:211` 승인 필수와 맞춘다.
- **이유**: 지금 문구를 따르면 설치자의 다른 세션 · 다른 도구가 쓰는 Playwright MCP 와 Chrome for Testing 이 함께 죽는다. 이 머신에서 패턴이 실제로 그 셋에 걸렸다(읽기만 함). 출처는 pstack create-verification-skill 의 Cleanup 원칙이다. 상주 증가 0, UI 트랙 4 CLI 에 도달한다.
- **게이트 메모**: 설치자 디스크를 바꾸는 변경이 아니라 스킬 문구 변경이므로 머지 전 독립 리뷰 문턱 밖이다(test-policy). 영향 범위는 이 디렉터리를 경로로 읽는 테스트와 비용 게이트다.

### ② `templates/agents/reviewer.md` (+ 개발 사본 `.claude/agents/reviewer.md`) — 확신 숫자 대신 증거 수준을 쓴다

- **바꿀 곳**: Step 4 의 "확신 80% 이상만 보고" · "변경되지 않은 코드의 이슈는 건너뛴다"를 다음으로 바꾼다. ⓐ 변경이 안전하다는 판단을 떠받치는 사실 한두 개를 찾아, 어디까지 증명했는지 적는다(말함 → `file:line` 지목 → 실패 경로가 닿지 않음을 보임 → 실행으로 확인). ⓑ 바뀌지 않은 호출자 · 데이터 형식 · 설정 · 라이브러리 동작이 이번 변경으로 깨지면 이번 변경의 finding 이다. 이번 변경과 무관한 기존 결함만 뺀다. "유사 이슈 통합"은 그대로 둔다.
- **이유**: 작은 diff 가 바뀌지 않은 소비자를 깨는 회귀가 지금 문구로는 "변경되지 않은 코드"로 분류돼 빠질 수 있다. 80% 는 측정할 수 없는 자기 신고다. 출처는 pstack blast-radius(증거 사다리 · 안전 사실 하나)다. **Claude Code 설치자에게만 닿는다** — 다른 CLI 에는 reviewer 에이전트가 깔리지 않는다.
- **효과 미검증**: 이 문구가 리뷰 결과를 바꾸는지는 관측하지 않았다. 반영 뒤 이 리포의 리뷰에서 "변경 밖 소비자 finding"이 나오는지 보는 것이 첫 관측이다.

### pstack 과 무관하지만 계획서가 찾았고 사실로 확인된 것 — #962 밖, 별도 이슈 권고

| 대상 | 내용 | 설치자 도달 |
|---|---|---|
| `templates/skills/objective-brief/SKILL.md:78-83` | 리뷰어 위임형 "테스트 작성은 리뷰어 몫 · 스모크만"이 배포판 implementer("closes it with a test that fails without the change")와 충돌한다. 이 리포는 2026-07-26 "작성 분리 기각"을 확정했다(`.claude/CLAUDE.md`) | 4 CLI(전 트랙) |
| `templates/skills/multi-persona-review/SKILL.md:113,155` | 없는 절 "Worker lifecycle" 참조 | 개발 트랙 4 CLI |
| 루트 `CLAUDE.md` 함정 4 | "애매하면 전체를 돌린다" ↔ `.claude/rules/test-policy.md` "기본값으로 전체를 돌리지 않는다" | 개발용(설치자 0) |
| `src/external-assets.ts:349` | model-orchestration 설명의 "vendor tiers 로 매핑" ↔ 본문 | 위저드 설명 한 줄 |

### 하지 않는 것 (요약)

새 스킬 · 새 훅 · 새 평가 체계 · 파일럿 · 상류 미러는 만들지 않는다. benchmark-checklist 는 **설치자 프로젝트에서 성능 주장 오류가 관측되면** 다시 연다. 다시 열 때도 출처와 MIT 고지를 붙인 단독 스킬 하나로 한다.

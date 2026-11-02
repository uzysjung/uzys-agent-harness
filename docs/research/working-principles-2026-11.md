# Working Principles — 필요한가 · 좋은가

> 이슈 (이슈 없음 · 사용자 요청 2026-11-03) · `/deep-research` 결과(2026-11-03). 웹 검색 → 출처 수집 → 주장마다 3표 반박 검증(2표 이상 반박이면 기각) → 종합.
> 출처 21개 · 추출 주장 105개 · 검증 25 · 통과 10 · 기각 15.
> 아래 '결과'는 검증을 통과한 주장이다. '추론'이라 적힌 문장과 리포 관측은 검증 투표 대상이 아니었다.

## 요약

근거를 종합하면 Working Principles는 제거하거나 그대로 둘 문서가 아니라 개정할 문서다. 지침 전체가 성공률을 올린다는 측정은 없다. ETH 연구에서 컨텍스트 파일은 성공률을 유의하게 올리지 못했고 비용은 약 20% 늘렸다. 다만 에이전트는 파일의 지시를 잘 따랐다. 벤더 문서는 상주 파일을 '에이전트가 스스로 알아낼 수 없는 것'으로 한정하고 절차는 스킬로 보내라고 한다. 이 기준으로 §2의 다단계 분할 문단은 상주 밖으로 옮길 후보다. 반대로 §6의 권한·승인 경계와 사용자 작업 보존은 코드에서 유도할 수 없는 정책이다. Anthropic도 위험하거나 되돌릴 수 없는 행동에 대한 규칙은 시스템 프롬프트에 따로 두라고 하므로 유지 근거가 가장 강하다. 문서가 겨냥하는 실패는 최신 모델에서도 effort 수준에 따라 실제로 나타난다. 일을 끝내기 전에 확인을 구하는 것, 검증을 건너뛰는 것, 리뷰를 과하게 도는 것이 그 예다. 측정된 개선은 모두 추상 원칙이 아니라 실패 행동을 이름으로 짚는 구체 문장에서 나왔다. 그래서 §2·§4·§5·§6의 해당 문장은 구체화하는 것이 근거에 맞다. 파일 길이(25~500줄)는 준수율과 무관하다는 측정이 있으므로, 줄이는 것 자체는 판정 근거가 될 수 없다. 원칙형 문장 다수는 돕는다는 근거도 해친다는 근거도 없어 판단을 미룬다.

## 결과

### 1. (high · 투표 3-0 ([0] · [1] · [4] 병합))

[필요한가 · 상주 파일의 자리] 벤더 공식 문서는 상주 파일을 '에이전트가 매 세션 알아야 하는데 코드에서 스스로 알아낼 수 없는 것'으로 한정한다. 빌드 명령·컨벤션·레이아웃·'항상 X' 규칙이 그 예다. 여러 단계로 된 절차는 스킬로 옮기라고 한다. OpenAI도 '짧고 정확한 AGENTS.md가 모호한 규칙으로 가득한 긴 파일보다 쓸모 있다'고 한다. 이 기준을 적용하면 결과가 둘로 갈린다. Working Principles 중 리포와 무관한 일반 공학 판단은 기준 밖이다. 반면 §6의 권한·승인 경계와 §3의 사용자 작업·계약 보존은 설치자의 정책이라 코드에서 유도할 수 없으므로 기준 안에 든다.

- 근거: memory 문서에 'Keep it to facts Claude should hold in every session ... If an entry is a multi-step procedure or only matters for one part of the codebase, move it to a skill or a path-scoped rule instead.'가 축자로 있다. 검증자는 best-practices 문서도 같은 방향이라고 확인했다('only holds what Claude couldn't work out from the code itself', 'A more capable model knows more about engineering'). OpenAI 가이드는 'add new rules only after you notice repeated mistakes'라고 하고, 측정은 제시하지 않는다. ETH 논문 저자들은 사람이 쓴 파일에 'specific additional instructions beyond what is already available in the codebase'만 넣으라고 권한다. 한정 조건이 셋 있다. (a) 같은 memory 문서가 CLAUDE.md 용도로 workflows도 적고 있어 '한정'은 다소 강한 요약이다. (b) OpenAI 문장은 '짧고 정확함 대 길고 모호함'을 비교할 뿐 '원칙 있음 대 없음'을 비교하지 않는다. 약 40줄 문서를 '긴 파일'로 보기도 어렵다. (c) Claude Code 문서의 기준이라 AGENTS.md 인라인 경로(Codex·OpenCode·Antigravity)에 그대로 적용된다는 보장은 없다.
- 출처: https://code.claude.com/docs/en/memory · https://learn.chatgpt.com/guides/best-practices · https://arxiv.org/html/2602.11988

### 2. (medium · 투표 3-0 ([2] · [3] · [4] 병합))

[좋은가 · 측정 근거] 통제 실험에서 저장소 컨텍스트 파일은 성공률을 유의하게 올리지 못했다. 단계 수와 비용은 모든 설정에서 늘었다. 에이전트는 파일 지시를 잘 따랐고, 그 결과 테스트와 탐색이 늘었다. 그러므로 성공률이 안 오른 이유는 지시를 무시해서가 아니다. Working Principles 전체가 성공률을 올린다는 측정 근거는 없다. 지시가 행동을 실제로 바꾸므로 '더 탐색하라·더 검증하라' 쪽 문장은 성공은 그대로 두고 비용만 늘릴 수 있다.

- 근거: Gloaguen et al.(ETH, v3 2026-09, ICLR 2026 등재)은 SWE-bench Lite와 CTXbench(138건, 12개 저장소)에서 Claude Code+Sonnet-4.5, Codex+GPT-5.2·GPT-5.1 mini, Qwen Code를 실험했다. LLM이 생성한 파일은 성공률을 -0.5%(p=0.87), -2%(p=0.37) 바꿨다. 개발자가 쓴 파일은 파일이 없을 때보다 +2.4%(p=0.21)로 유의하지 않았다. 개발자 파일과 LLM 파일을 비교하면 개발자 파일이 유의하게 나았다(p=0.038). 지시에 등장한 도구는 사용이 크게 늘었다(uv 인스턴스당 1.6회, 저장소 전용 도구 2.5회). 저자들은 'these additional instructions make the task harder'라는 가설을 내놓았다. 한정 조건: 시험한 파일은 원칙형이 아니라 프로젝트 사실형이다. 모델은 이번 질문의 대상보다 한두 세대 앞서고 언어는 Python뿐이다. 논문 자체의 제거 실험에서는 특정 범주를 빼도 결과가 바뀌지 않았으므로, 비용 증가를 검증 지시 탓으로 특정할 수는 없다. Lulla et al.(2601.20404)은 AGENTS.md가 있을 때 실행 시간 중앙값이 28.6% 짧았다는 연관 관측을 냈다. 효율 면에서는 반대 근거이지만 성공률 결과와는 충돌하지 않는다. 단일 연구라서 confidence는 medium으로 둔다.
- 출처: https://arxiv.org/html/2602.11988 · https://arxiv.org/abs/2601.20404

### 3. (medium · 투표 3-0 ([5]))

[판정 기준 · 크기] 설정 파일 길이를 25줄에서 500줄 사이로 바꿔도 지시 준수율에는 검출 가능한 차이가 없었다. 베이즈 인자도 '효과 없음'을 지지했다. Working Principles(약 40줄)는 이 범위 안에 있다. 그러므로 줄이는 것 자체를 준수율 개선의 근거로 쓸 수 없고, 판정은 문장의 내용으로 해야 한다.

- 근거: 준수율(ICR)은 25·100·250·500줄에서 각각 60.0%·65.2%·67.7%·64.0%였다(GLMM p=0.16, 크기 BF10=0.096). 가장 짧은 파일의 준수율이 가장 낮았다. 저자 권고는 'Focus on content rather than length within this range'다. 한정 조건: 측정 대상은 '// @tracked'를 붙이는 사소한 지시 하나다. 모델은 Claude(Sonnet 4.6·Opus 4.6)뿐이고 언어는 TypeScript뿐이다. 1,650세션 규모로 검정력은 충분하지만 단일 저자 프리프린트이고 동료 심사를 거치지 않았다. 5,000줄 같은 극단 크기는 설계 범위 밖이다.
- 출처: https://arxiv.org/abs/2605.10039

### 4. (low · 투표 3-0 ([6]))

[빠진 것 · 지켜야만 하는 규칙의 강제] 측정된 가장 큰 효과는 세션 안에서 준수가 떨어지는 현상이었다. 함수를 하나 더 생성할 때마다 준수 오즈가 약 5.6% 낮아지는 것과 연관됐다. 저자는 세션 내내 지켜져야 할 규칙이라면 문장에만 기대지 말라고 한다. 규칙을 다시 띄우는 훅이나 린터·CI 같은 사후 강제를 함께 쓰라는 것이다. §6의 승인 경계처럼 반드시 지켜져야 하는 규칙은 프로즈만으로는 부족할 수 있다.

- 근거: OR=0.944(95% CI 0.937~0.951)이고 비단조적이다. 원문은 'associated with'라는 상관 표현을 쓴다. 이 효과는 사전에 지정한 가설이 아니라 분석 중에 발견한 것이고, 저자도 독립 재현이 필요하다고 쓴다. 측정은 사소한 표지 지시 하나를 single-turn --print 모드에서 잰 것이다. 효과는 다기능 과제 3개 중 2개에서만 검출됐다. 훅·린터·CI 권고는 저자의 추론이지 이 연구가 검증한 처방이 아니다. 하네스는 이미 protect-files.sh·session-start.sh 훅을 배포한다(templates/hooks/ 실측).
- 출처: https://arxiv.org/abs/2605.10039

### 5. (high · 투표 3-0 ([7] · [8] 병합, 원문 재확인))

[필요한가 · 실패는 실재한다] Working Principles가 겨냥하는 실패 일부는 최신 모델에도 effort 수준에 따라 실제로 나타난다. Sonnet 5.5는 low·medium effort에서 일을 끝내기 전에 멈추고 확인을 구한다. 계획을 확인받거나, 스스로 답할 수 있는 질문을 하거나, 여러 부분 중 한 부분만 마치고 계속할지 묻는다. low effort에서는 의존성이 없다는 이유 등으로 검증을 건너뛰고 완료라고 보고한다. 벤더 처방의 순서는 effort를 먼저 올리고, 그다음 실패를 이름으로 짚는 구체 문장을 넣는 것이다. 측정된 효과도 그 구체 문장에서 나왔다. 같은 벤더는 이 문장이 '위험·비가역 행동에 대한 자기 규칙을 대신하지 않으니 따로 유지하라'고 쓴다. 이것이 §6 승인 문장을 유지하는 근거가 된다.

- 근거: Sonnet 5.5 문서(합성 단계에서 2026-11-03 원문을 재확인했다)의 권장 문장은 'Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step.'이다. 효과는 'sessions at those levels run longer and cost more'이고, 문서는 'The prompt doesn't replace your own rules about risky or irreversible actions. Keep those rules in your system prompt.'라고 덧붙인다. 검증 문단의 효과는 'makes skipped or superficial checks rare, with no measurable change in task quality and only a slightly higher cost per task'다. 여기서 '품질 변화가 측정되지 않았다'는 말은 측정했는데 변화가 측정 한계 아래였다는 뜻이다. 그런데 벤더는 이 문단의 적용을 조건부로 둔다('If you see changes reported as complete without test or build output'). Opus 5.5 문서도 무인 실행에서 일을 다 끝내기 전에 멈추는 현상을 기술한다. 그리고 'responsive to instructions that name the specific kinds of early stop', 'keep your own confirmation step for risky or irreversible actions', 'leave the addition out of human-in-the-loop applications'라고 한다. 프런트엔드 절에서는 일반 지시가 'mostly swaps one default for another'라고 쓴다. 한정 조건: 벤더는 원칙형 문장을 시험한 적이 없다. 벤더 문장 'only stop to ask when you can't go on without the user or before a risky step'은 §2와 뜻이 거의 같고 구체성만 다르다. 효과 측정은 Sonnet 5.5뿐이고 Codex·Gemini 근거는 없다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompting-claude-opus-5-5

### 6. (medium · 투표 독립 주장 0-3 기각(Opus 5 3건, Sonnet 5.5 2건). [8] 검증 노트(d)와 합성자의 원문 재확인으로만 뒷받침된다)

[좋은가 · 반대 방향의 실패, 논쟁 중인 근거] 높은 effort와 Opus 5 계열에서는 반대 방향의 실패가 문서화돼 있다. 과잉 검증, 과잉 리뷰, 과잉 위임, 범위 확장이다. Anthropic은 Opus 5에 대해 명시적 검증 지시와 '서브에이전트로 검증하라'는 지시를 빼라고 한다. 이런 지시가 과잉 검증을 부르고, 빼도 품질 손실이 없다는 이유다. Sonnet 5.5 max effort에서는 '요청이 없으면 리뷰 서브에이전트를 띄우지 말라'는 문장이 리뷰 서브에이전트 실행을 멈췄고, 세션 비용을 약 1/3 줄였으며, 품질은 그대로였다. 이 근거를 적용하면 §4의 독립 리뷰 문장, §2의 위임 문장, §3의 'coherent over an arbitrarily small diff'·'local simplification'은 이런 모델에서 과잉 쪽을 키울 수 있다.

- 근거: Opus 5 문서를 합성 단계에서 2026-11-03 WebFetch로 조회했고, 다음 문장들이 원문에 그대로 있었다. 'Claude Opus 5 verifies its own work without being told to. If your prompt contains explicit verification instructions (... "use a subagent to verify"), remove them: instructions like these cause over-verification on Claude Opus 5, and removing them reduces wasted tokens with no loss in quality.' 'Avoid instructing re-checks it already performs.' 위임 권장 문장은 'do not use subagents to verify or double-check your own work'다. 범위에 대해서는 'Deliver what was asked, at the scope intended ... say so in a sentence and continue with the task as asked rather than quietly narrowing, widening, or transforming it'이라고 한다. 또 Claude Code는 claude_code preset을 쓸 때만 자체 위임 지시를 넣는다고 적혀 있다. Sonnet 5.5 max effort 측정은 원문 'cut session cost by about a third, with no change in quality'다. 같은 문서에 따르면 Sonnet 5.5는 요청하지 않은 테스트·문서를 모든 effort에서 덧붙이지만 'Most teams will welcome this'라서, 범위를 좁히는 것은 선택 사항이다. Opus 5.5 문서는 Opus 5 패턴을 'remain a reasonable starting point'라고 한다. 신뢰도에 대한 주의: 같은 내용이 적대적 3표 검증에서는 독립 주장으로 0-3 기각됐다. 다만 [8]의 검증 노트(d)는 Sonnet max effort 측정을 사실로 확인했다. 기각 사유는 기록에 없다. 합성자의 WebFetch는 소형 모델을 거치므로 독립 검증으로 볼 수 없다. 채택하기 전에 원문을 다시 확인해야 한다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5

### 7. (low · 투표 3-0 ([9]))

[좋은가 · 기본 행동을 다시 시키는 위험] 최신 모델이 이미 하는 행동을 강조어로 다시 지시하면 행동이 나빠진 벤더 보고 사례가 있다. Working Principles는 차분하고 조건부인 문체라서 이 사례가 직접 적용되지는 않는다. 그래도 철저함을 미는 문장이 있는지 점검할 근거는 된다.

- 근거: Cursor는 GPT-5에서 'maximize_context_understanding', 'Be THOROUGH' 문구 때문에 검색 도구를 과하게 쓰는 문제를 겪었다(작은 과제에서). 접두어를 빼고 문구를 누그러뜨리자 도구 사용 판단이 나아졌다. 수치가 없는 단일 파트너 일화이고, 가이드는 2025-08 GPT-5용으로 지금은 archived 상태다. 문제를 일으킨 것은 대문자 강조어였다. Working Principles 같은 차분한 원칙형 문장이 해롭다는 직접 근거는 아니다. Anthropic의 Opus 5 문서에 있는 'Avoid instructing re-checks it already performs'가 같은 방향이지만, 이는 위 [논쟁 중] 항목에 해당한다.
- 출처: https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide

### 8. (medium · 투표 종합 추론 (확정된 주장 [0]~[8] 근거))

[결론 · 문서 전체] 근거에 맞는 판정은 제거나 대폭 축소가 아니라 개정이다. 개정은 네 가지다. (1) 코드에서 유도할 수 없는 권한·승인·보존 정책(§6, §3 2문단, §4 3문단, 머리말의 우선순위 문장)은 유지한다. (2) 측정된 실패 모드를 겨냥한 문장(§2 사용자 개입, §6 자율 진행, §4·§5 검증·종료)은 벤더가 효과를 잰 구체 행동 문장으로 바꾼다. (3) 절차 문단(§2 multi-part)은 상주 밖으로 옮긴다. (4) 근거가 없는 원칙형 문장은 지우지 말고 판단을 미룬다. 문서 전체의 성공률 효과는 아무도 측정하지 않았으므로, 확정 판정은 설치자형 과제에서 A/B로만 가능하다.

- 근거: '제거'를 택하지 않는 이유는 둘이다. 첫째, 원칙형 문서가 해롭다는 측정이 없다. 둘째, §6은 벤더가 따로 유지하라고 한 '위험·비가역 행동 규칙' 자리를 차지하고 있어, 지우면 그 자리를 메울 장치가 없다. '대폭 축소'를 택하지 않는 이유는 크기와 준수율이 무관하다는 측정이 있어 줄이는 것 자체가 근거가 되지 못하기 때문이다. '그대로 유지'를 택하지 않는 이유도 둘이다. 하나는 벤더 문서 기준으로 절차 문단이 상주 대상이 아니라는 점이다. 다른 하나는 측정된 개선이 모두 구체 문장에서 나왔다는 점이다. 이 판정은 앞의 증거 항목들을 종합한 추론이다. 원칙형 지침의 효과를 직접 잰 연구는 확인된 것이 없다.
- 출처: https://code.claude.com/docs/en/memory · https://arxiv.org/html/2602.11988 · https://arxiv.org/abs/2605.10039 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5

### 9. (high · 투표 종합 ([7] 검증 노트 · 원문 재확인))

[문장 판정 · 유지 — 근거 가장 강함] 다음 문장은 그대로 둔다. 머리말 'Agreed outcomes, protection boundaries, and explicit authority take precedence over preferred methods.' §3 'Preserve existing contracts, intentional behavior, and user work unless their change is authorized. Remain responsible for the integrated result, including work delegated to others.' §4 'Give difficult-to-reverse decisions ... Assess reversibility of user consequences, not merely the ability to revert code.' §6 'Keep readiness and authority distinct ...', 'Reuse approval that covers the action and target. Obtain explicit approval for destructive or privileged actions, deployment, and shared-state writes ... A broad objective alone is not such approval.', 'Protect user work, data, and secrets ... At an unresolved boundary, pause only dependent actions and continue useful work that remains authorized.'

- 근거: 근거는 셋이다. (1) 이 문장들은 설치자의 위험 정책이라 코드에서 유도할 수 없다. 이는 벤더의 상주 기준에 들어맞는다. (2) Sonnet 5.5 문서는 'Keep those rules in your system prompt'라고, Opus 5.5 문서는 'keep your own confirmation step for risky or irreversible actions'라고 쓴다. (3) §6 마지막 문장은 Opus 5.5 권장 문안 'carry on with whatever does not depend on the user's answer', 'The stops the user does want are the ones where nothing can move without them'과 뜻이 같다. 이 문장들의 효과를 직접 잰 연구는 없다. 뜻이 바뀌는 위험: 유지하므로 없다. 선택 사항으로, Opus 5.5 문안처럼 원하는 멈춤과 원하지 않는 멈춤을 이름으로 짚는 보강을 검토할 수 있다. 다만 그 보강은 무인 실행용이라 HITL(사람이 응답하는 대화형) 환경에는 빼라고 벤더가 말한다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 · https://code.claude.com/docs/en/memory

### 10. (high · 투표 3-0 ([0]))

[문장 판정 · 뺌(상주 밖으로 이동), 한 문장만 남김] §2 'For multi-part work, derive user or operational outcomes ... Divide them into coherent units ... sequence by dependencies ... Where authorized, preserve material decisions and acceptance evidence in existing project records, and judge completion by evidenced required results and protections rather than closed units.'는 다단계 작업 절차다. 상주 밖으로 옮기는 후보다. 옮길 곳은 이미 번들된 objective-brief 스킬이다. 원칙에 해당하는 마지막 절만 §5로 옮긴다. after(§5 1문단 끝에 추가): 'Judge completion by evidenced required results and protections, not by closed tasks.'

- 근거: memory 문서는 'If an entry is a multi-step procedure ... move it to a skill'이라고 한다. 같은 기준이 스킬에도 적용된다('only write down what Claude can't find on its own'). 그래서 이 문단은 이동보다 삭제에 더 가깝게 읽힐 수 있다. templates/skills/objective-brief/가 실재함을 확인했다. 뜻이 바뀌는 위험은 두 가지다. (a) 'preserve material decisions and acceptance evidence in existing project records'는 절차가 아니라 '항상 X' 규칙에 가깝다. 사용자가 이 기록 행동을 원한다면 §6에 한 문장으로 남겨야 한다. 그러지 않으면 이동이 곧 삭제가 된다. (b) 스킬은 호출될 때만 읽히므로 분할 지침이 매 세션 닿지 않게 된다. 이 지침이 분할 품질을 올린다는 측정은 없다. Opus 5.5 문서는 무인 실행에서 작업 부분을 체크리스트(to-do 도구나 파일)로 관리하라고 권하는데, 이는 프롬프트 문장이 아니라 하네스 장치 권고다.
- 출처: https://code.claude.com/docs/en/memory

### 11. (high · 투표 3-0 ([7]))

[문장 판정 · 고침(구체화) — 끝내기 전에 멈추는 문제] §2 'Resolve routine uncertainty through evidence and reversible progress. Involve the user when an unresolved choice has material consequences that cannot be safely settled within the agreed intent and authority.'와 §6 'Work autonomously through the authorized outcome, without seeking repeated confirmation for routine progress.'는 같은 축이다. 벤더가 측정한 형태로 구체화해 한곳에 둔다. after 안: 'Keep working until the requested outcome is done. Don't pause to confirm a routine plan, to ask what you can answer from the project, or after one part of a multi-part task. Stop to ask only when you can't continue without the user, before a risky step, or when an unresolved choice has material consequences that cannot be safely settled within the agreed intent and authority.'

- 근거: 이 실패는 Sonnet 5.5 low·medium effort에서 문서화돼 있다. 벤더 문장의 뜻은 원문과 거의 같고 실패 유형을 이름으로 짚는 점만 다르다. Opus 5.5 문서도 'name the specific kinds of early stop'이 효과적이라고 한다. 뜻이 바뀌는 위험은 세 가지다. (a) 주장이 강해진다. 벤더는 이 문장 때문에 세션이 길어지고 비용이 는다고 밝힌다. 높은 effort에서는 원래 드문 실패라 효과가 작을 수 있다. (b) 'before a risky step'을 빼면 §6 승인 경계와 어긋난다. 반드시 남겨야 한다. (c) 측정은 Sonnet 5.5 하나뿐이다. Codex(GPT-6 계열)·Gemini 3.x에서는 근거가 없으므로 이들 CLI에 대해서는 판단 유보다. 벤더는 effort를 먼저 올리라고 하므로, 이 문장보다 effort 설정 안내가 우선일 수 있다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompting-claude-opus-5-5

### 12. (medium · 투표 3-0 ([8]) · Opus 5 부분은 논쟁 중)

[문장 판정 · 더함(조건부) — 검증으로 인정되는 것] §5 1문단 'Base conclusions on actual artifacts and observed behavior. Distinguish verified results from assumptions, simulated feedback, and work not yet checked. Match claims to what the evidence demonstrates.'는 유지하되, 무엇을 증거로 치는지 정의를 덧붙인다. after 안(추가 문장): 'A syntax-only check, or a check command that failed to start, does not count as verification. If all that is missing is the project's declared dependencies, install them with its own package manager and lockfile, never via sudo or the system package manager, unless told not to. If no real check can run, say which one you did not run and why instead of reporting the change as done.' 벤더 문단 앞부분('run a real check that exercises the change before reporting it done')은 조건부로만 더한다. 조건은 설치자 환경에서 검증 없이 완료를 보고하는 일이 관측되는 경우다.

- 근거: Sonnet 5.5 low effort에서 측정한 결과, 검증 생략이 드물어지고 품질은 그대로이며 비용은 소폭 늘었다. 의존성 설치 절을 빼면 벤더가 예로 든 실패(의존성 미설치로 테스트를 건너뜀)를 못 고친다. 이는 [8] 검증 노트 (b)의 지적이다. 앞부분을 조건부로 두는 이유는 두 가지다. 벤더 자신이 'If you see ...'라는 조건을 달았고, Opus 5 문서는 명시적 검증 지시가 과잉 검증을 부른다고 한다(논쟁 중인 근거). 'does not count'와 '못 돌린 검증을 말하라'는 검증을 늘리는 지시가 아니다. 보고의 정직성을 정의하는 문장이라 §5와 뜻이 같은 쪽이고, 과잉 검증 위험이 낮다. 뜻이 바뀌는 위험: 'run a real check' 부분까지 무조건 넣으면 Opus 계열에서 주장이 강해질 수 있다(검증 지시가 모델 기본 행동과 겹쳐 쌓임). 의존성 설치는 로컬에서 되돌릴 수 있는 쓰기라 §6 승인 대상이 아니다. 그래도 'unless told not to'는 남긴다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5

### 13. (low · 투표 독립 주장 0-3 기각, [8] 검증 노트(d)와 원문 재확인)

[문장 판정 · 고침(판단 유보) — 과잉 리뷰·위임·종료] §4 'Use independent review when a fresh perspective materially strengthens assurance, or when explicitly required. Scale it to the blind spots and consequential mistakes it needs to address.' after 안: 'Use independent review, such as reviewer subagents, when the user or project requires it, or when a hard-to-reverse change needs a perspective you cannot supply yourself. Otherwise, if a deeper review seems worth it, say so at the end instead of starting one.' §5 'Once sufficient evidence supports ... conclude rather than extend the work ...' 뒤에 추가하는 안: 'When the requested work is done and its checks pass, stop and report; don't start extra rounds of review or hardening on your own.' §2 'Use tools, delegation, abstractions, and local refactoring where their expected benefit outweighs complexity and coordination cost.' 위임 부분을 바꾸는 안: 'Delegate only sizeable, independent work; don't delegate what you can finish in a few steps.'

- 근거: 근거는 Sonnet 5.5 max effort 측정(리뷰 서브에이전트 중단, 비용 약 1/3 감소, 품질 무변화)과 Opus 5 문서의 'do not use subagents to verify or double-check your own work'다. 둘 다 적대적 검증에서 독립 주장으로는 기각됐으므로 판단을 미룬다. 뜻이 바뀌는 위험이 크다. (a) 완화가 삭제가 될 수 있다. 원문은 에이전트가 스스로 판단해 리뷰를 쓰도록 허용한다. after는 사용자·프로젝트 요구나 되돌리기 어려운 변경으로 한정한다. 그래서 요구가 명시되지 않은 고위험 변경에서는 자율 리뷰가 사라질 수 있다. 'hard-to-reverse' 조건은 이 손실을 줄이려고 넣었고, 효과는 측정되지 않았다. (b) 벤더 위임 문장의 'or to double-check your own work'를 그대로 가져오면 독립 리뷰 원칙과 정면으로 충돌한다. 그래서 after에서는 뺐다. (c) 벤더 측정은 max effort에서만 나왔다. low effort에서는 반대로 검증이 모자라므로, 한 상주 문장이 모든 effort에 맞을 수는 없다. 원문의 'proportion'은 이 양방향 문제를 다루려는 시도다. 그래서 원문 유지도 정당한 선택지다. (d) Claude Code가 자체 위임 지시를 넣는다면(claude_code preset) §2 위임 문장은 중복이 된다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5

### 14. (low · 투표 독립 주장 0-3 기각, 원문 재확인)

[문장 판정 · 고침(판단 유보) — 범위] §3 'Let scope follow what the requested outcome genuinely needs, including necessary integration and local simplification. Prefer a coherent solution over an arbitrarily small diff, while keeping unrelated cleanup and speculative future capabilities outside the task.' 선택지 A(원문 유지에 한 문장 추가): '... outside the task; if you think one would help, mention it at the end instead of doing it.' 선택지 B(벤더 형태로 좁힘): 'Deliver what was asked at the scope intended, including the integration it needs. If a better approach exists, say so briefly and continue as asked rather than quietly widening the task.' §1 'what makes the outcome worth choosing over existing alternatives'는 적용 범위를 한정하는 안: 'For product and planning work, also consider what makes the outcome worth choosing over existing alternatives.'

- 근거: Opus 5 문서는 이 모델이 요청하지 않은 단계를 더하거나 과제를 재정의한다고 쓰고, 좁은 과제에는 범위 지시를 권한다. Sonnet 5.5 문서는 덧붙임을 'Most teams will welcome this'라고 해 범위를 좁히는 것을 선택 사항으로 둔다. 두 근거 모두 독립 주장으로는 기각됐다. 'Codex 기본 지시문은 최소 diff 쪽'이라는 주장도 0-3 기각돼, 원문의 반(反)최소 diff 문장이 Codex에서 어떻게 작동하는지 모른다. 뜻이 바뀌는 위험: 선택지 B는 'Prefer a coherent solution over an arbitrarily small diff'를 없앤다. 일부러 넣은 반최소 diff 의도가 사라지므로 완화가 곧 삭제다. 선택지 A는 뜻을 지키면서 덧붙임을 '끝에 언급'으로 돌리지만, 설치자에게는 요청하지 않은 테스트·문서가 줄어든다. 이는 벤더가 '대부분 반긴다'고 한 행동이다. §1을 한정하는 안은 코딩 과제에서 과제 재정의를 줄일 수 있다. 대신 계획 과제가 아닌 곳에서는 가치 판단의 관점이 빠진다. 사용자 선호를 정할 문제다.
- 출처: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5

### 15. (low · 투표 근거 부재 (종합))

[문장 판정 · 판단 유보 — 돕는다는 근거도 해친다는 근거도 없음] 다음 문장은 확정된 근거로 판정할 수 없다. 머리말 'These are shared decision principles, not a fixed workflow.', 'Optimize for a dependable, usable outcome with the least total effort and delay ...', 'Choose and adapt methods ...'. §1 'Reuse relevant context and ground consequential decisions ...', 'Make assumptions visible ...', 2문단 'Define success by the outcome users need ... Distinguish essential readiness from optional polish ...'. §2 'Choose the simplest sufficient solution ...', 'Treat methods as replaceable ...'. §4 1문단 'Use the affected usage flow ... Include protections users depend on ...', 2문단 'Choose the depth, timing ... Bundle related verification ... rather than repeating it ...'. §5 2문단 앞부분 'Resolve gaps in required outcomes ... keep optional improvements and preferences separate.', 3문단 'Use unexpected results ... Report what changed ...'. §6 'An explicit user correction of a recorded procedure governs at once; ... record a standing change in its project-owned source.' 지금은 그대로 두고, 측정이 생기면 다시 판정한다.

- 근거: 원칙형 지침 자체를 잰 연구는 확인되지 않았다. 벤더 기준('스스로 알아낼 수 있는 것은 빼라')을 적용하면 일반 공학 판단 문장 상당수가 기준 밖이다. 그러나 이 기준이 문장 단위의 '해로움'을 보여 주지는 않는다. 차분하고 조건부인 문체라서 Cursor 사례(강조어로 생긴 과잉)가 직접 적용되지도 않는다. 문장별 메모: (a) §4 2문단 'Bundle ... rather than repeating'은 과잉 검증을 줄이는 방향이라 벤더 우려와 같은 쪽이다. (b) §1 2문단과 §5 2문단은 '필수 대 선택'을 겹쳐 말하므로 중복 정리 후보다. 다만 중복이 해롭다는 근거는 없다. (c) 'Treat methods as replaceable'은 프로젝트가 정한 절차를 에이전트가 임의로 바꾸는 허가로 읽힐 가능성이 있다. 머리말의 우선순위 문장이 이를 일부 막는다. 이런 일이 실제로 관측됐다는 근거는 없다. (d) §6 'record a standing change in its project-owned source'는 파일 쓰기를 유발하는 행동 지시다. 범위 확장 위험이 이론상 있지만 관측 근거는 없다. (e) Opus 5.5 문서는 이 모델이 보고에서 'what it did, what it found, and what it needs'를 이미 말한다고 쓴다. 그래서 §5 3문단 'Report ...'는 Opus 5.5에서 기본 행동과 겹칠 수 있다. 겹침이 해롭다는 근거는 없다.
- 출처: https://arxiv.org/html/2602.11988 · https://arxiv.org/abs/2605.10039 · https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide

### 16. (medium · 투표 종합 ([0] · [1] · [4] · [6] · [8]))

[빠진 것] 근거로 보면 개발 품질에 실제로 기여하는데 이 문서에 없는 것은 대부분 문서의 역할 밖에 있다. (1) 설치자 프로젝트의 사실: 빌드·테스트·린트 명령, 레이아웃, 비표준 컨벤션. 벤더와 ETH 저자가 상주 파일에 넣으라고 하는 유일한 범주다. Working Principles는 리포와 무관해 이것을 담을 수 없으므로, 설치자 프로젝트 파일에 이 자리가 채워지는지가 별도 문제다. (2) 무엇을 검증으로 치는지에 대한 구체 정의(위 '더함' 항목). (3) 반드시 지켜져야 하는 규칙(§6 승인 경계)을 결정론적 장치(권한 설정·훅·CI)로 보강하는 것. (4) 프롬프트 문장보다 먼저 쓸 지렛대인 effort 설정 안내. 벤더는 'Try a higher effort level first'라고 하고, 사고량을 줄이는 데도 프롬프트보다 effort 조정이 더 확실하다고 한다.

- 근거: (1)은 확정된 주장 [0]·[1]·[4]에 근거한다. 다만 ETH 연구에서 개발자가 쓴 사실형 파일도 파일이 없을 때보다 +2.4%로 유의하지 않았다. 사실형 내용이 반드시 돕는다는 측정도 없다는 뜻이다. 하네스에는 프로젝트 컨텍스트를 채우는 audit-harness-fit 스킬이 이미 번들돼 있다. (2)는 [8]에 근거한다. (3)은 [6](low, 사후 발견)에 근거한다. 이 리포의 개발 정책은 로컬 차단 훅을 새로 만드는 것을 기각해 두었다(CLAUDE.md 함정 1). 그러나 그 정책은 이 리포 개발용이고 설치자 배포물의 판단과는 별개다. (4)는 Sonnet 5.5·Opus 5.5 문서의 effort 절에 근거한다. effort는 CLI 설정이라 상주 문장으로는 다룰 수 없다. OpenAI 가이드의 '같은 실수가 반복되면 그때 규칙을 더하라'는 에이전트용 지시가 아니라 설치자용 운영 지침이다.
- 출처: https://code.claude.com/docs/en/memory · https://learn.chatgpt.com/guides/best-practices · https://arxiv.org/html/2602.11988 · https://arxiv.org/abs/2605.10039 · https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 · https://platform.claude.com/docs/en/build-with-claude/prompting-claude-opus-5-5

## 한계

1) 원칙형 상주 지침의 효과를 직접 잰 연구는 확인되지 않았다. 측정 근거(ETH 2602.11988, McMillan 2605.10039)는 모두 프로젝트 사실형 파일이나 사소한 표지 지시를 쟀다. 그래서 Working Principles에 대한 판정은 모두 외삽이다. 2) 모델 범위: 측정에 쓰인 모델은 Sonnet 4.5/4.6, Opus 4.6, GPT-5.x, Qwen이다. 벤더 문서로 다룬 모델은 Sonnet 5.5, Opus 5, Opus 5.5다. GPT-6 계열 Codex, Gemini 3.x, Antigravity, OpenCode에 대한 확정 근거는 없다. 나머지 세 CLI에서 쓰는 AGENTS.md 인라인 경로 효과도 미검증이다. 3) 각 CLI의 기본 시스템 프롬프트와 겹치거나 충돌하는지(질문 ①의 일부)는 답하지 못했다. 'Codex default.md는 최소 diff 쪽'이라는 주장은 0-3 기각됐고, Claude Code·OpenCode·Antigravity의 시스템 프롬프트는 조사되지 않았다. 4) 논쟁 중인 근거가 있다. Opus 5 가이드(검증 지시 제거, 자기 검증용 서브에이전트 금지, 범위 지시), Sonnet 5.5의 xhigh/max 리뷰 억제 측정, 요청하지 않은 덧붙임에 관한 주장은 적대적 3표 검증에서 0-3으로 기각됐다. 그런데 합성 단계에서 2026-11-03 WebFetch로 조회한 원문에는 해당 문장이 그대로 있었다. 기각 사유는 기록에 없고, WebFetch는 소형 모델을 거치므로 독립 검증이 아니다. 해당 판정은 '고침(판단 유보)'으로만 두었으니, 채택 전에 원문을 다시 확인해야 한다. 5) effort 의존성: 같은 모델이 low에서는 검증을 덜 하고 xhigh/max에서는 리뷰를 과하게 돈다. 하나의 상주 문장이 모든 effort에 맞을 수 없으므로 문장마다 방향을 고를 때 이 점을 감안해야 한다. Opus 5.5의 API 기본 effort는 medium이다. 설치자의 실제 effort 분포는 모른다. 6) 출처 품질: ETH는 단일 연구다(ICLR 2026 등재, Python만). 비용 결과는 Lulla et al.의 연관 연구와 효율 면에서 엇갈린다. McMillan은 단일 저자 프리프린트이고 Claude만, TypeScript만 다뤘으며, 세션 내 감쇠는 사후 발견이다. Cursor 사례는 수치가 없는 일화이고 출처 가이드는 archived 상태다. OpenAI 가이드 권고에는 측정이 없다. 7) 기각된 주장(2604.11088의 '부정 제약이 이롭다'와 '무작위 룰도 같은 효과', 2607.27250의 AGENTS.md 제거 실험, memory 문서의 '반복 실패 계기')은 근거로 쓰지 않았다. 그래서 '금지 목록 대 방향'이라는 설계 철학을 직접 판정할 확정 근거는 없다. 8) 시간 민감성: 벤더 프롬프팅 가이드는 모델이 출시될 때마다 바뀐다. 문서 판정은 주요 모델이 출시될 때마다 다시 확인해야 한다.

## 열린 질문

- 설치자형 과제(4개 CLI의 기본 effort 기준)에서 '상주 지침 없음 대 현행 Working Principles 대 개정안'을 A/B로 비교하면 성공률·비용·질문 횟수·범위 이탈이 어떻게 달라지는가? 문서 전체의 유지 여부는 이 측정으로만 확정할 수 있다.
- Claude Code·Codex·OpenCode·Antigravity의 기본 시스템 프롬프트는 범위, 검증, 승인 경계, 위임에 대해 이미 무엇을 말하는가? 특히 Codex 기본 지시문이 최소 diff 쪽인지, 그래서 §3의 'coherent over an arbitrarily small diff'가 기본값과 반대 방향으로 당기는지가 미확인이다(해당 주장 0-3 기각).
- Opus 5 가이드의 '명시적 검증 지시와 자기 검증용 서브에이전트를 빼라'는 문장과 Sonnet 5.5의 max effort 리뷰 억제 측정은 원문에 있는 것으로 보이는데, 왜 적대적 검증에서 기각됐는가? 재검증 결과에 따라 §4 독립 리뷰 문장과 §2 위임 문장의 판정이 '유보'에서 '고침'으로 바뀐다.
- GPT-6 계열 Codex와 Gemini 3.x(Antigravity)에도 끝내기 전 확인 요청, 검증 생략, 과잉 리뷰 같은 실패가 있는가? 있다면 실패를 이름으로 짚는 구체 문장이 이들 모델에서도 효과가 있는가?

## 기각된 주장(0-3 등)

- (0-3) Anthropic 공식 문서에 따르면 CLAUDE.md 지시는 검증할 수 있을 만큼 구체적이어야 잘 지켜진다. 문서는 '변경을 테스트하라' 같은 추상 지시 대신 'npm test 를 돌려라' 같은 구체 지시를 권한다. Working Principles 의 원칙형 문장(예: 'Verify outcomes in proportion to consequences')이 바로 문서가 덜 지켜진다고 보는 추상형에 해당한다. 원칙형과 사실형의 효과 차이를 판정할 때 직접 근거가 된다. — https://code.claude.com/docs/en/memory
- (0-3) 공식 문서는 CLAUDE.md 에 무엇을 넣을지 관측된 계기로 정한다. 같은 실수가 두 번째 나왔을 때, 코드 리뷰가 놓친 것을 잡았을 때, 지난 세션에 한 정정을 다시 입력할 때 넣으라고 한다. 실패가 관측되기 전에 미리 써 둔 일반 원칙은 이 계기 목록 어디에도 없다. 그래서 원칙마다 '이 원칙을 정당화하는 반복 실패가 관측됐는가'를 판정 기준으로 쓸 수 있다. — https://code.claude.com/docs/en/memory
- (0-3) 가이드가 꼽는 좋은 AGENTS.md 의 내용은 전부 프로젝트별 구체 사실이다. 저장소 구조, 실행 방법, build/test/lint 명령, 엔지니어링 규약과 PR 기대치, 제약과 금지 규칙, '완료'의 의미와 검증 방법이 그것이다. 범용 의사결정 원칙은 이 목록에 없다. — https://learn.chatgpt.com/guides/best-practices
- (0-3) SWE-bench Verified에서 고른 판별 과제 58개(기준선 통과율 30~70%)에서, GitHub에서 무작위로 뽑은 룰과 전문가가 고른 룰은 똑같이 +13.8pp(50.0% → 63.8%) 효과를 냈다. 무작위 룰, 순서를 섞은 룰, 다른 도메인의 룰, 형식을 변환하지 않은 룰 파일도 모두 고른 룰과 같은 수준이었다. 저자들은 이 효과가 대체로 내용과 무관하다고 보고, 컨텍스트 점화(context priming)로 해석한다. 조건끼리의 차이는 통계적으로 유의하지 않았다(Cochran's Q=4.70, p=0.697). 이 결과는 Working Principles의 구체적인 문구가 성공률에 주는 고유 효과가 작을 수 있다는 근거다. 다만 '필요한가'의 근거는 될 수 없다. 상주 파일이 아예 없는 경우와 비교했을 뿐, 이 문서를 같은 길이의 다른 문서와 비교하지 않았기 때문이다. — https://arxiv.org/html/2604.11088
- (0-3) 룰 18개를 하나씩 빼 보는 실험(n=35)에서 성공률을 올린 '형성' 룰 3개는 모두 '~하지 마라'형 부정 제약이었고, 성공률을 떨어뜨린 '왜곡' 룰 4개는 모두 '~하라'형 긍정 지시였다(Fisher p=0.029). 가장 큰 단일 효과는 'do not refactor unrelated code'를 뺐을 때 생긴 -20pp였다(p=0.016). 다만 이 값은 다중비교 보정 뒤에는 유의하지 않고, 형성/왜곡 분할도 |Δ|>5pp 임계값에 민감하다. Working Principles는 '금지 목록 대신 방향'을 설계 철학으로 삼아 대부분 긍정 지시로 쓰였다. 따라서 이 결과는 그 철학과 직접 부딪히는 반대 근거다. 한편 §3의 'keeping unrelated cleanup ... outside the task'는 이 연구에서 가장 이로웠던 룰과 같은 뜻이다. — https://arxiv.org/html/2604.11088
- (0-3) 기준선에서 이미 풀리던 과제 17개(재검사 통과율 88.2%)에 룰을 하나씩 붙이자, 18개 중 14개가 이전에 풀리던 과제를 2개 이상 깨뜨렸다. 가장 나쁜 룰은 17개 중 4개(24%)를 깨뜨렸다. 개별 지침 한 줄이 이미 잘하던 행동을 왜곡할 수 있다는 측정 근거다. 그래서 문장 단위로 판정할 때는 '이 문장이 기본 행동을 해치지 않는가'를 따로 물어야 한다. — https://arxiv.org/html/2604.11088
- (0-3) In a controlled ablation (288 gold-test-evaluated runs, 17 real tasks from 3 Python repositories; Claude Code with claude-sonnet-4-6 and Codex CLI with gpt-5.5), removing the repository's AGENTS.md (none) and injecting it into the system prompt every turn (always_on) produced statistically indistinguishable pass rates. Claude: none 53.3% (24/45), always_on 55.6%, selective 55.6% (omnibus p = 1.000). Codex: none 58.8% (30/51), always_on 56.9%, selective 52.9% (p = 0.66). Equivalence testing bounds the effect to about 10–15 percentage points or less. — https://arxiv.org/abs/2607.27250
- (0-3) The study attributes the observed agent failures to implementation skill (feature design, pattern selection, exact wiring), not to missing repository knowledge that a context file could supply. The real AGENTS.md never turned a near-miss into a pass for either agent. This means the bottleneck in these tasks was not something a resident instruction file addressed. — https://arxiv.org/abs/2607.27250
- (0-3) Anthropic's Opus 5 guide says the model checks its own work without being told to. It tells prompt authors to remove explicit verification instructions, and harness scaffolding that adds separate verification steps, because they cause over-verification. It says removing them costs no quality. This challenges the need for Working Principles section 4, and the verification parts of section 5, as resident instructions for Claude Opus 5. The guide covers Opus 5 only, not Codex or Gemini. — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
- (0-3) The guide says Opus 5 tends to widen a task by adding steps nobody asked for, and recommends an explicit scope instruction for narrow tasks. Its suggested wording is close to Working Principles section 3 and to the user-involvement sentence in section 2: make routine calls yourself, check in only when different readings lead to materially different work, and say so rather than quietly change scope. This supports keeping scope guidance, possibly in a more concrete form. — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
- (0-3) The guide says Opus 5 hands work to subagents more readily than earlier models, which multiplies cost on small tasks. Its recommended instruction says not to use subagents to verify or double-check the model's own work. That conflicts with the Working Principles lines that encourage delegation and independent review whenever the expected benefit is enough. The guide also says Claude Code adds its own delegation instruction on Opus 5 when the claude_code system prompt preset is used, so the vendor prompt may already cover part of this. — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
- (0-3) Sonnet 5.5는 요청하지 않은 테스트·문서·작은 보조 파일을 모든 effort 수준에서 덧붙이고, effort가 높을수록 더 많이 덧붙인다. 다만 요청한 변경 자체는 요청 범위에 가깝게 유지된다. 벤더는 대부분의 팀이 이를 반길 것이라 보고, 범위를 좁히는 문장은 선택 사항으로 제시한다. 그 문장은 '하지 말고 끝에 언급하라'는 구체적 행동 지시다. Working Principles §3 'keeping unrelated cleanup and speculative future capabilities outside the task'는 같은 축을 다룬다. 다만 벤더 근거로 보면 이 행동을 막는 것은 기본이 아니라 프로젝트별 선호 문제다. — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- (0-3) xhigh·max effort에서 Sonnet 5.5는 작업을 마친 뒤에도 스스로 리뷰·검증 라운드를 시작하고, 하네스가 서브에이전트를 제공하면 서브에이전트까지 띄운다. Anthropic이 max effort 코딩 과제로 실험한 결과, 이를 막는 문장('리뷰를 요청받지 않았으면 리뷰어 서브에이전트를 띄우지 말고, 필요해 보이면 끝에 말하라')을 넣자 리뷰어 서브에이전트 실행이 멈췄고, 세션 비용이 약 1/3 줄었으며, 품질 변화는 없었다. Working Principles §4 'Use independent review when a fresh perspective materially strengthens assurance'와 §5 'conclude rather than extend the work'의 판정에 직접 쓰이는 측정 근거다. 리뷰를 권하는 쪽 문장은 고성능 effort에서 과잉 검증을 키울 위험이 있고, 멈추라는 쪽 문장은 측정으로 효과가 입증됐다. — https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- (0-3) OpenAI says contradictory or vague instructions in a prompt hurt GPT-5 more than they hurt other models. Because GPT-5 follows instructions precisely, it spends reasoning tokens trying to reconcile the conflicting directives. This matters for a resident principles document full of counterweighted clauses (simplest sufficient vs coherent over arbitrarily small diff, work autonomously vs involve the user), and for any overlap or conflict with the CLI's own system prompt. — https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide
- (0-3) Codex CLI 기본 지시문(default.md)은 Working Principles §2·§3 이 다루는 단순성·근본 원인 수정·범위 절제를 이미 명시한다. 다만 방향은 '최소 diff'다. 그래서 WP §3 의 'Prefer a coherent solution over an arbitrarily small diff'는 Codex 에서 중복이 아니라 기본값과 반대로 당기는 지시로 작동할 수 있다. 같은 문서는 이 코딩 지침을 AGENTS.md 가 덮어쓸 수 있다고 말한다('user instructions (i.e. AGENTS.md) may override these guidelines'). — https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md

## 수집한 출처

- https://code.claude.com/docs/en/memory
- https://learn.chatgpt.com/guides/best-practices
- https://arxiv.org/html/2602.11988
- https://arxiv.org/html/2604.11088
- https://arxiv.org/abs/2607.27250
- https://arxiv.org/abs/2605.10039
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5
- https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5
- https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide
- https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-executing-actions-with-care.md
- https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/system-prompt-delivering-work-at-full-scope.md
- https://github.com/openai/codex/blob/main/codex-rs/protocol/src/prompts/base_instructions/default.md
- https://github.com/openai/codex/blob/main/codex-rs/core/gpt-5.2-codex_prompt.md
- https://github.com/anomalyco/opencode/blob/dev/packages/core/src/plugin/system-prompt/gpt.txt
- https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools/blob/main/Google/Antigravity/Fast%20Prompt.txt
- https://code.claude.com/docs/en/best-practices
- https://arxiv.org/abs/2602.11988
- https://arxiv.org/abs/2601.20404
- https://arxiv.org/abs/2507.11538
- https://arxiv.org/abs/2511.12884
- https://www.plushcap.com/content/arize/blog/arize-optimizing-coding-agent-rules-claudemd-agentsmd-clinerules-cursorrules-for-improved-accuracy

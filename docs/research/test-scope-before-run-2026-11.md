# 테스트 전에 영향 범위를 정하게 하기 — 조사

> 이슈 #933 · `/deep-research` 결과(2026-11-02). 웹 검색 → 출처 수집 → 주장마다 3표 반박 검증(2표 이상 반박이면 기각) → 종합.
> 출처 24개 · 추출 주장 117개 · 검증 25 · 통과 20 · 기각 5.
> 아래 '결과'는 검증을 통과한 주장이다. '추론'이라 적힌 문장과 리포 관측은 검증 투표 대상이 아니었다.

## 요약

검증을 통과한 근거로 보면, 4개 CLI 어디서도 "테스트 명령 직전 알림 훅"은 그 테스트 실행 자체를 좁히지 못한다. Claude Code와 Codex의 PreToolUse additionalContext는 명령이 이미 돈 뒤 다음 모델 요청에 도착한다. Antigravity는 PreToolUse에 비차단 주입 필드가 문서화돼 있지 않다. OpenCode는 문서에 없는 after 훅으로만 비슷한 일을 할 수 있다. Anthropic 공식 문서는 CLAUDE.md·룰·스킬 같은 산문 지시를 "대부분 따르지만 보장은 없는" 지침으로 분류한다. 무시되는 줄에 강조를 더하는 것은 틀린 처방이라고 하며(과적용을 부른다), 원인을 '파일이 길어 줄이 묻힘' 또는 '예외가 없어야 하는 규칙이라 훅 대상'으로 본다. 테스트 범위는 고위험이면 넓혀야 하는 예외가 있는 판단이므로 훅 대상이 아니다. Claude Code에서 배포 test-policy 룰은 paths:가 없어 컴팩션 뒤 디스크에서 다시 주입되므로, '컴팩션으로 룰이 사라진다'는 설명은 이 룰에 맞지 않는다. 실제 팀 사례로 OpenAI codex 저장소 AGENTS.md(2025-08~2026-09-30)가 있다. 이 문서는 훅 없이 산문 규칙만으로 '바뀐 프로젝트 테스트 먼저 → 공유 크레이트가 바뀌었을 때만 풀 스위트 → 풀 스위트 전에는 사용자에게 묻기'를 지시했다. 그래서 근거가 가장 강한 방향은 기존 룰 첫 항목을 '넓힐 조건을 명시한 체크포인트형 문구'로 제자리에서 바꾸는 것이다. 이렇게 하면 AGENTS.md 예산 증가도 거의 없다. 반면 ④ 영향 범위 선택 도구의 한계와 ① OpenAI·Google의 공식 권고는 이번 검증에서 살아남은 근거가 없다.

## 결과

### 1. (high · 투표 3-0 / 3-0)

Claude Code에서 paths: 가 없는 룰과 프로젝트 루트 CLAUDE.md는 컴팩션 뒤 디스크에서 다시 주입된다. paths: 가 있는 룰은 일치하는 파일을 읽거나 쓸 때만 대화 이력에 들어가므로 컴팩션 요약에 묻히고, 다시 그 파일을 건드려야 로드된다. 앞서 훅이 넣은 맥락도 요약에 묻힌다. 배포 test-policy.md 는 paths: 가 없으므로(리포 확인: paths: 는 cli-development·htmx-fastapi-ui·htmx-fastify-ui·ui-components 4종만), Claude Code 에서 '긴 세션 컴팩션으로 룰이 사라졌다'는 설명은 이 룰에 맞지 않는다.

- 근거: context-window 문서의 'What survives compaction' 표에 'Project-root CLAUDE.md and unscoped rules | Re-injected from disk', 'Context that hooks added earlier | Summarized'가 있다. 같은 페이지에 'If a rule must persist across compaction, drop the paths: frontmatter or move it to the project-root CLAUDE.md'라는 문장도 있다. memory.md 의 'Instructions seem lost after /compact' 절이 같은 내용을 확인한다. 검증자는 같은 표에 SessionStart(compact) 훅은 컴팩션 뒤 다시 실행되고 그 출력이 붙는다는 항목도 있다고 덧붙였다. 리포 grep 결과 templates/rules/test-policy.md 에 paths: 가 없다.
- 출처: https://code.claude.com/docs/en/context-window · https://code.claude.com/docs/en/memory.md · templates/rules/test-policy.md (리포 확인)

### 2. (high · 투표 3-0 / 3-0)

Anthropic 은 CLAUDE.md·프롬프트·모델이 스스로 고르는 스킬을 '비결정적 지침'으로 분류한다. 대부분 따르지만 보장은 없다. 매번 적용되는 것은 command/http 훅·deny 룰·managed settings 뿐이다. 계속 무시되는 줄에 IMPORTANT 같은 강조를 더하는 것은 해법이 아니고 오히려 규칙을 과적용하게 만든다. 원인은 ① 파일이 길어져 줄이 묻혔거나 ② 예외가 없어야 하는 규칙이라 훅으로 옮겨야 하는 경우, 둘이라고 한다. 단순한 선호를 강제하는 훅은 지우라고 권한다. 테스트 범위는 고위험 변경이면 넓히는 예외를 가진 판단이므로, 이 분류로는 훅 대상이 아니라 평이한 문장과 짧은 파일로 다룰 지침이다.

- 근거: best-practices 의 'Deterministic and non-deterministic instructions' 절에 'there's no guarantee that it'll follow your instructions'라는 문장이 있다. 같은 페이지에 'If Claude keeps ignoring a line that is in CLAUDE.md, adding IMPORTANT probably won't fix it. Either the file has grown long enough that the line gets lost, or the line is a rule that can't have exceptions'가 있다. 'What you can stop doing' 표에는 'piling on emphasis mostly makes Claude over-apply the rule'이 있고, TIP 에는 'if you have hooks for things that are only preferences, delete them'이 있다. 출처는 1차 문서 한 페이지다. 검증자가 memory.md 와 제3자 글이 같은 구분을 반복한다는 점을 확인했다. 이 근거는 Claude Code 에만 해당한다.
- 출처: https://code.claude.com/docs/en/best-practices

### 3. (high · 투표 3-0 ×4 (claims 4,5,6,7 병합))

Claude Code 에서 차단하지 않는 알림 훅은 기술적으로 가능하다. 조건은 PreToolUse 훅이 exit 0 으로 끝나고 permissionDecision 없이 JSON hookSpecificOutput.additionalContext 를 내는 것이다. 다만 그 문장은 '도구 결과 옆'에 system reminder 로 붙고 다음 모델 요청에서 읽히므로, 알림이 붙은 그 테스트 실행은 이미 끝난 뒤다. 그 실행을 좁히지 못하고 다음 실행에만 영향을 줄 수 있다. PreToolUse 에서 일반 stdout 은 맥락에 들어가지 않는다(UserPromptSubmit·UserPromptExpansion·SessionStart·PostModelSwitch 만 예외). exit 0 의 stderr 는 Claude 가 보지 못한다. exit 2 는 JSON 을 함께 내도 차단한다. 문자열 상한은 10,000자다.

- 근거: hooks 문서에는 'Claude Code wraps the string in a system reminder and inserts it ... PreToolUse ...: next to the tool result', 'Claude reads the reminder on the next model request'라는 문장이 있다. 같은 문서에 'For most events, Claude Code writes stdout to the debug log ... The exceptions are UserPromptSubmit, UserPromptExpansion, SessionStart, and PostModelSwitch', 'Exit 2 blocks even when your hook prints JSON', 'Claude never sees stderr from a hook that exits 0'도 있다. hooks-guide 에는 'exit 0 doesn't approve it', 'Text from additionalContext is kept from every hook and passed to Claude together'가 있다. 검증자가 확인한 사항이 두 가지 더 있다. additionalContext 는 최상위가 아니라 hookSpecificOutput 안에 있어야 하며 그렇지 않으면 조용히 무시된다. 실행 자체를 막으려면 deny/ask(차단)가 필요하다.
- 출처: https://code.claude.com/docs/en/hooks · https://code.claude.com/docs/en/hooks-guide

### 4. (high · 투표 3-0 ×6 (claims 8–13 병합))

Codex 도 PreToolUse 훅이 hookSpecificOutput.additionalContext 를 돌려주면 차단하지 않고 모델이 보는 문장을 붙일 수 있다(PR #20692, 2026-05-05 머지). 훅은 기본으로 켜져 있다. matcher 는 정규식이고 셸 명령(unified exec 포함)은 'Bash' 로 매치된다. 다만 명령 내용으로 거르는 필드가 없어서 npm test·playwright 판별은 훅 스크립트 안에서 tool_input.command 를 읽어야 한다. 주입된 문장은 다음 요청의 developer 메시지로 들어가고, 그 요청에는 이미 끝난 명령의 출력이 함께 실린다. 즉 Claude Code 와 마찬가지로 알림이 붙은 그 실행을 좁히지 못한다. 관리형이 아닌 훅은 정확한 정의 해시를 사용자가 검토·신뢰해야 돌고, 훅 내용이 바뀔 때마다 다시 신뢰를 요구한다. 그래서 하네스가 갱신할 때마다 설치자에게 확인 단계가 생긴다. 0.124.0 처럼 오래된 빌드는 이 출력을 'unsupported additionalContext' 로 거부한다(이때도 차단은 되지 않는다).

- 근거: 공식 문서에 'To add model-visible context without blocking, return hookSpecificOutput.additionalContext', 'The matcher field is a regex string ... Match as Bash', 'Hooks are enabled by default', 'Before a non-managed hook can run, Codex requires you to review and trust the exact hook definition'이 있다. PR #20692 의 테스트 pre_tool_use_records_additional_context_for_shell_command 는 requests[1] 의 developer 메시지에 맥락이 있고, 같은 요청에 셸 출력 'pre-tool-output' 이 있다고 단언한다. deny 를 함께 줄 때만 마커 파일이 생성되지 않는다. 검증자는 현 main(2026-10-26 수정분)에서도 동작이 같다고 확인했다. 최신 안정판은 0.166.0(2026-10-29)이다.
- 출처: https://learn.chatgpt.com/docs/hooks · https://github.com/openai/codex/pull/20692 · https://github.com/openai/codex/issues/19385

### 5. (medium · 투표 2-1 (before) / 3-0 (after))

OpenCode 플러그인의 tool.execute.before 는 도구 실행 전에 호출되고 tool 이름과 수정 가능한 output.args 를 받는다. 그래서 bash 호출의 명령을 읽거나 바꿀 수 있다. 다만 모델에 문장을 주입하는 필드는 없고, 할 수 있는 것은 throw 로 막거나 명령을 몰래 바꾸는 것이다(이번 방향인 '알림'과 다르다). 알림에 가까운 경로는 tool.execute.after 다. 1.19.5 타입상 output.output 문자열을 바꿀 수 있어 도구 결과 끝에 문장을 덧붙일 수 있어 보이지만, 공식 문서에는 시그니처도 예시도 없고 타입에서 추론한 것이다. 이 역시 실행이 끝난 뒤다. 저장소의 V2 플러그인 이전 문서는 V1 플러그인이 V2 에서 돌지 않는다고 하므로, V1 기준으로 만든 훅은 V2 출시 때 옮겨야 한다.

- 근거: 문서 예시는 'tool.execute.before: async (input, output) => { if (input.tool === bash) { output.args.command = ... } }' 이고, .env 보호 예시는 throw 로 차단한다. 1.19.5 타입은 다음과 같다. before = input{tool,sessionID,callID} / output{args}, after = output{title, output: string, metadata}. 검증자가 v1.19.5 소스에서 after 훅에 output 객체를 참조로 넘긴 뒤 그대로 return 하는 것을 확인했다. before 주장은 투표가 2-1 로 갈렸고 after 경로는 문서화되지 않았으므로 medium 이다.
- 출처: https://opencode.ai/docs/plugins/ · npm @opencode-ai/plugin@1.19.5 dist/index.d.ts · opencode v1.19.5 packages/opencode/src/session/tools.ts

### 6. (medium · 투표 3-0 / 3-0)

Antigravity 의 PreToolUse 는 도구 실행 전에 발화하고, matcher 정규식으로 run_command 를 골라 CommandLine(예: 'npm test')을 볼 수 있다. 문서화된 이벤트는 6개다(SessionStart·PreToolUse·PostToolUse·PreInvocation·PostInvocation·Stop). PreToolUse 출력은 decision(필수)·reason·overwrite·permissionOverrides 뿐이고, injectSteps 는 SessionStart·Pre/PostInvocation 에만 있다. decision=allow 일 때 reason 이 에이전트에게 가는지는 문서에 없다(제3자 safe-chains 는 deny 일 때만 모델에 도달한다고 확인했다). 그래서 '테스트 명령에 붙는 비차단 알림'은 Antigravity 에서 분명히 지원되지 않는다. PreInvocation injectSteps 는 비차단 주입 경로이지만 모델 호출마다 발화할 뿐 테스트 명령에 묶이지 않는다.

- 근거: 문서에 'PreToolUse: Fires before a tool is executed', 'run_command: Propose a Bash command to run', 'reason: The explanation shown to the agent or to you for the decision', 'allow: Allows the tool call to proceed'가 있다. 검증자가 App·CLI·IDE 탭이 같은 출력 계약을 공유하고 additionalContext 는 페이지 어디에도 없음을 확인했다. 1차 출처는 날짜 없는 페이지 하나이고 제3자 구현 하나로 보강된 수준이라 medium 이다.
- 출처: https://antigravity.google/docs/hooks · safe-chains (docs.rs) targets/agy.rs — 제3자 구현

### 7. (medium · 투표 종합(별도 투표 없음))

② 장치 비교(위 CLI별 사실을 종합한 판단): '테스트 명령 직전 알림 훅'은 4개 CLI 에서 효과가 고르지 않다. Claude Code·Codex 에서는 알림이 이미 돈 실행 뒤에 도착해 다음 실행에만 영향을 준다. OpenCode 는 문서에 없는 after 훅에 기대야 한다. Antigravity 는 지원이 불분명하다. 반면 비용은 CLI별로 4벌 구현·유지, Codex 신뢰 확인(훅 내용이 바뀔 때마다), 버전 의존(Codex 0.124 이하 거부·OpenCode V2 이전)이다. 룰 문구는 4개 CLI 모두에 같은 경로로 도달하고(Claude Code 는 컴팩션 뒤 재주입) 추가 비용이 문구 바이트뿐이다. 그래서 효과 대비 비용이 가장 낮은 1순위 장치다. 훅은 알림이 첫 실행을 못 막는다는 점을 감수하고 '같은 세션에서 반복되는 풀 실행'을 줄이는 보조 수단으로만 검토할 만하다.

- 근거: 개별 1차 근거(위 Claude Code·Codex·OpenCode·Antigravity 항목)를 종합한 추론이다. 알림 훅이 실제로 다음 실행을 줄이는지는 관측된 적이 없다. 스킬은 best-practices 에서 CLAUDE.md 와 같은 비결정적 지침으로 분류되며, 모델이 스스로 꺼내야 하므로 '잊는 상황'에서 발화한다는 보장이 없다는 점도 같은 축이다.
- 출처: https://code.claude.com/docs/en/hooks · https://learn.chatgpt.com/docs/hooks · https://github.com/openai/codex/pull/20692 · https://opencode.ai/docs/plugins/ · https://antigravity.google/docs/hooks · https://code.claude.com/docs/en/best-practices

### 8. (medium · 투표 2-1 / 3-0)

③ 실제 팀 사례: OpenAI 자체 codex 저장소 루트 AGENTS.md(적어도 2025-08 부터 2026-09-30 삭제 전까지)는 '바뀐 프로젝트 테스트만 먼저(just test -p <crate>) → 그것이 통과하고 common·core·protocol 이 바뀌었을 때만 풀 스위트(just test) → 풀 스위트 전에는 사용자에게 묻고, 범위 테스트는 묻지 않는다'를 산문으로 지시했다. 의존 그래프 도구가 아니라 디렉터리 이름을 나열한 경로 기반 확대 조건이고, 훅·차단 없이 프로즈와 사용자 확인만으로 운영됐다. 넓힐 조건을 이름으로 박고 풀 실행을 '묻는 동작'으로 바꾸는 체크포인트형 문구의 실사례다.

- 근거: 4875084025 시점 66–68행: 'Run the test for the specific project that was changed ... just test -p codex-tui', 'Once those pass, if any changes were made in common, core, or protocol, run the complete test suite with just test', 'project-specific or individual tests can be run without asking the user, but do ask the user before running the complete test suite.' 검증자가 같은 커밋에 hooks 설정이 없고 justfile test 레시피에 확인 절차가 없음을 확인했다. 단일 저장소 근거이고, 한 주장은 투표가 2-1 이었다. 2026-09-30 커밋이 리포 로컬 지침 전체를 사유 없이 지웠으므로 현행 관행이 아니라 '그 기간의 관행'이다. 에이전트가 실제로 따랐는지는 보여주지 않는다.
- 출처: https://github.com/openai/codex/blob/4875084025/AGENTS.md · openai/codex commit 7d734bff65 (2025-08-29) · openai/codex commit 18131270fe (2026-09-30, #49713)

### 9. (low · 투표 검증 투표 대상 아님(리포 관측))

리포 확인(가설): 배포 룰 안에 풀 실행 쪽으로 끌어당길 수 있는 문장이 test-policy 와 다른 파일에 있다. Delivery 룰(templates/rules/ship-checklist.md)의 '수정이 끝난 뒤 통합 테스트 · 빌드 · 실제 사용자 흐름을 검증한다'와 '실행하지 않은 상태는 통과가 아니다'는 PR 머지 시점에 E2E 전체 실행으로 읽힐 여지가 있다. 반면 '풀 E2E 는 CI/CD 몫'이라는 제한은 test-policy 의 네 번째 항목에 영어로 따로 있다. Anthropic 이 꼽은 원인(길이·훅 필요) 외에, 같은 시점을 두 룰이 다르게 말하는 충돌이 관측된 현상의 원인일 수 있다. 다만 설치자 세션의 트랜스크립트로 확인하지 않았다.

- 근거: 리포 파일을 직접 읽어 확인했다. test-policy 첫 항목은 'regression across the affected scope — not the whole suite merely because the repository's CI runs it'이다. 22–23행은 'Full regression, full E2E ... belong to the CI/CD schedule, not to a per-change decision'이다. Delivery 룰 '검증의 리듬'은 '수정이 끝난 뒤 통합 테스트 · 빌드 · 실제 사용자 흐름을 검증한다'이다. 외부 검증 주장이 아니라 저장소를 들여다본 결과이고, 인과는 확인하지 않았다.
- 출처: templates/rules/ship-checklist.md (리포 확인, 2980 bytes) · templates/rules/test-policy.md (리포 확인, 2518 bytes)

## 한계

1) 질문 ④(vitest related·jest --findRelatedTests·nx affected·turbo --filter·playwright --only-changed 의 한계)는 검증을 통과한 주장이 0건이다. 참고할 수 있는 것은 이 리포의 내부 실측 하나뿐이다. .claude/rules/test-policy.md 에 따르면 `vitest related` 는 테스트가 readFileSync/readdirSync 로 읽는 문서·자산 변경에 대해 0건을 골랐다. 이것은 외부 근거가 아니다. 2) 질문 ①은 Anthropic(Claude Code) 문서만 살아남았다. OpenAI·Google 이 긴 세션의 지시 흐려짐에 대해 공식적으로 권고한 내용, 그리고 Codex·OpenCode·Antigravity 가 컴팩션 뒤 AGENTS.md/GEMINI.md 를 다시 싣는지는 확인되지 않았다. 3) 기각된 주장이 있다. TDAD(arXiv 2603.17973)의 '의존 맵 제공 시 회귀 70% 감소'와 '절차 지시만 추가하면 오히려 악화' 수치, 'SessionStart compact 훅으로 재주입하라는 Anthropic 권고' 서술은 모두 0-3 으로 기각됐다. 따라서 '영향 테스트 목록을 맥락으로 주는 쪽이 절차 문구보다 낫다'는 검증된 근거는 없다. 단, SessionStart(compact) 훅이 컴팩션 뒤 다시 실행된다는 메커니즘 자체는 context-window 표에 있다고 검증자가 적었다. 4) 시간 민감성이 있다. Codex PreToolUse additionalContext 는 2026-05-05 이후 판에서만 동작한다(0.124.0 은 거부). OpenCode 는 V1→V2 플러그인 이전을 앞두고 있다. Antigravity hooks 문서에는 날짜가 없다. codex 저장소 AGENTS.md 사례는 2026-09-30 에 삭제됐다. 5) 사용자 관측(긴 세션에서 작은 변경에도 머지 때 E2E 풀테스트)은 단일 관측이다. Claude Code 에서는 test-policy 가 재주입되므로 컴팩션 손실로는 설명되지 않는다. 원인(파일 길이·룰 간 충돌·Delivery 룰 문구·모델 판단)은 확인되지 않았다. 6) Codex AGENTS.md 예산(합계 32 KiB, 약 74%)은 이번에 다시 재지 않았다. OpenCode 가 섞인 설치본에서는 룰이 AGENTS.md 본문에 인라인되므로, 문구 변경은 기존 항목을 제자리에서 바꾸는 바이트 중립형이어야 한다. test-policy.md 는 현재 2518 bytes 다. 7) 알림 훅의 '다음 실행 억제' 효과는 어느 CLI 에서도 관측 근거가 없고, 메커니즘에서 추론한 것이다.

## 열린 질문

- 설치자 프로젝트의 실제 트랜스크립트에서 머지 직전 풀 E2E 를 고른 이유는 무엇인가? Delivery 룰의 '수정이 끝난 뒤 통합 테스트·빌드·실제 사용자 흐름 검증' 같은 다른 룰 문구 때문인지, 지시 파일 길이 때문인지, 모델의 위험 판단 때문인지에 따라 처방이 달라진다.
- 영향 범위 선택 도구(vitest related · jest --findRelatedTests · nx affected · turbo --filter · playwright --only-changed)는 동적 import·파일 읽기·설정·E2E 에서 각각 얼마나 놓치는가? 에이전트에게 그 명령을 쥐여 주면 실제로 풀 실행이 줄어드는가?
- OpenAI(Codex)와 Google(Antigravity/Gemini)은 긴 세션·컴팩션 뒤의 지시 준수에 대해 공식적으로 무엇을 권하는가? 각 CLI 는 컴팩션 뒤 AGENTS.md/GEMINI.md 를 다시 싣는가?
- 실행 뒤에 도착하는 알림(Claude Code·Codex additionalContext, OpenCode after 훅)이 같은 세션의 이후 풀 실행을 측정 가능하게 줄이는가? 그 효과가 CLI별 4벌 구현과 Codex 의 훅 변경마다 재신뢰 비용을 넘는가? Antigravity 에서 decision=allow 의 reason 은 에이전트에게 도달하는가?

## 기각된 주장(0-3 등)

- (0-3) Anthropic states that a boundary given in conversation can be lost when the conversation compacts. This supports the idea that instructions weaken over a long session, and it points the fix at persistent configuration rather than mid-session reminders. — https://code.claude.com/docs/en/best-practices
- (0-3) Anthropic's official Claude Code docs say compaction can drop important details. They recommend a SessionStart hook with the `compact` matcher to re-inject critical context, such as test-running conventions, after every compaction. This is a first-party, Claude Code-only fix for instructions fading in long sessions. — https://code.claude.com/docs/en/hooks-guide
- (0-3) Before an edit, TDAD builds a dependency map from source files to tests and gives it to the agent, so the agent knows which specific tests to check. On SWE-bench Verified this cut code regressions by 70%, from 6.08% to 1.82%, compared with a vanilla agent baseline. — https://arxiv.org/abs/2603.17973
- (0-3) Adding TDD procedural instructions without targeted test context raised the regression rate to 9.94%, which was worse than adding nothing at all. Generic workflow wording in a rule, on its own, made agent behavior worse in this setup. — https://arxiv.org/abs/2603.17973
- (0-3) The authors conclude that giving the agent concrete context, such as which tests a change affects, works better than prescribing a procedure. This bears directly on choosing between a reworded rule and a tool or skill that outputs the affected tests. — https://arxiv.org/abs/2603.17973

## 수집한 출처

- https://code.claude.com/docs/en/context-window
- https://code.claude.com/docs/en/best-practices
- https://code.claude.com/docs/en/hooks-guide
- https://code.claude.com/docs/en/hooks
- https://learn.chatgpt.com/docs/hooks
- https://github.com/openai/codex/pull/20692
- https://opencode.ai/docs/plugins/
- https://antigravity.google/docs/hooks
- https://github.com/openai/codex/blob/4875084025/AGENTS.md
- https://arxiv.org/abs/2603.17973
- https://codex.danielvaughan.com/2026/06/05/why-always-run-tests-agents-md-makes-things-worse/
- https://main.vitest.dev/guide/recipes/affected-tests
- https://cn.vitest.dev/guide/recipes/watch-templates
- https://gitlab.com/gitlab-org/gitlab/-/merge_requests/116427
- https://playwright.dev/docs/test-cli
- https://codeberg.org/forgejo/forgejo/raw/branch/forgejo/tests/e2e/changes.go
- https://github.com/nrwl/nx/issues/26274
- https://turborepo.dev/cn/docs/reference/configuration
- https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/
- https://mir.cs.illinois.edu/~marinov/publications/LegunsenETAL16StaticRTS.pdf
- https://arxiv.org/abs/2505.06120
- https://arxiv.org/abs/2402.10962
- https://arxiv.org/abs/2507.11538
- https://research.google/pubs/assessing-transition-based-test-selection-algorithms-at-google/

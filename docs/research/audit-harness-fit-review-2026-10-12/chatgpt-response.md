# ChatGPT 검토 — audit-harness-fit v26.168.0 변경 3건

- 일시: 2026-10-12 · 모델: GPT-6 (UI 표시) · 사고 강도: Extra High (UI 표시) · 처리 2m 32s
- 대화: https://chatgpt.com/c/6acc1c5b-7d4c-83ee-bbc7-f79215884cbb (사용자 계정)
- 요청문: 같은 폴더 prompt.md · 응답은 화면 innerText 추출(표·강조 서식 일부 손실)
- 외부 모델 응답은 검증 전 데이터다 — 채택 판정은 PR 본문

---

종합 판정

3건 모두 설계 방향은 타당하지만, 현재 문안 그대로 채택하기보다는 소폭 수정하는 것이 좋겠습니다.

특히 ③은 유지할 가치가 큽니다. 설치된 모든 스킬을 반복해서 읽는 감사는 비용 대비 효용이 낮을 수 있습니다. 다만 검사 범위를 축소하는 것과 검사하지 않은 부분의 안전성을 인정하는 것은 별개여야 합니다.

① 다중 감사·적용 라운드

Should
요구는 대체로 충족합니다. 다만 라운드 수·수정 승인·검증 시점을 분리해야 합니다.

② 모델·사고 강도 실측

Should
올바른 문서로 라우팅하지만, 실제 비교의 공정성과 측정 기준은 부족합니다.

③ 스킬 연결부 중심 감사

Should
범위 축소는 합리적입니다. 실행되는 스킬의 권한·부작용 경로만 예외로 명시하면 됩니다.

제공된 diff만으로 판단할 때 확정적인 Blocker는 없습니다. 다만 ①에서 라운드 수를 포괄적인 수정·머지 승인으로 해석하거나, ③에서 미검사 스킬의 안전성을 보증한다면 이는 Blocker에 해당하는 실행 오류입니다.

1. 변경별 비평
① 감사 → 적용을 2~3라운드 반복한 뒤 한 번에 전달

요구 충족: 부분 충족, 방향은 적절함.

기존 감사 결과를 바탕으로 수정한 후 재감사하고, 누적 변경분을 한 번에 전달하는 방식은 불필요한 PR 생성과 리뷰 전환 비용을 줄일 수 있습니다.

다만 세 가지 해석 문제가 있습니다.

이슈

	

에이전트가 잘못 해석할 가능성

	

심각도




default 2–3

	

2회와 3회 중 임의로 선택하거나, 질문 없이 진행

	

Should




run them without re-asking

	

라운드 수 합의를 이후 발견된 모든 수정의 승인으로 확대

	

Should




verification ... once

	

라운드 중 필요한 테스트까지 최종 단계로 미룸

	

Should

가장 중요한 구분은 라운드 반복에 대한 동의와 새로운 수정에 대한 승인은 다르다는 것입니다.

이미 승인된 범위의 수정은 반복할 수 있습니다. 하지만 2차 감사에서 새로운 스킬 삭제나 훅 변경이 발견됐다면 기존 권한에 포함되는지 다시 판단해야 합니다.

또한 apply.md의 다음 문장도 다소 좁습니다.

each round re-audits only the sources the previous apply changed and their dependents

변경된 파일과 그것을 참조하는 대상만 보면, 변경의 판단 기준이 되는 수정되지 않은 상위 지시문을 놓칠 수 있습니다.

따라서 재감사 범위에는 관련 authoritative sources, dependencies, 이전 라운드 미해결 항목까지 포함해야 합니다. 전체 감사를 반복하라는 뜻은 아닙니다.

기존 계약과의 관계: 명시된 valid approvals 및 프로젝트의 정상적인 PR·검증 정책과 정면 충돌하지는 않습니다. 다만 추가 문장을 통해 해당 경계를 명확히 할 필요가 있습니다.

② 모델·사고 강도별 실측

요구 충족: 부분 충족.

Verification으로 연결하고 실측 결과를 별도 대장이 소유하도록 한 설계는 적절합니다. 특히 모델 이름만으로 우열을 결정하지 않는다는 점은 유지해야 합니다.

문제는 현재 문장이 다음 수준에 머문다는 것입니다.

측정 기록이 없으면 제한적인 비교를 제안한다.

이것만으로는 동일 업무에서 속도·토큰·품질의 최적점을 찾는 행동이 충분히 유도되지 않습니다.

빠진 요소

	

왜 필요한가




동일 입력·초기 상태

	

이전 모델의 작업 결과가 다음 모델 실험에 영향을 주는 것을 방지




공통 품질 판정

	

속도와 토큰만 보고 낮은 품질을 최적이라고 선택하는 것을 방지




적용 가능한 과거 실측의 판단

	

같은 작업 유형이라도 환경·모델·사고 강도가 다르면 비교 부적절




측정 결과의 한계

	

한 번의 실험으로 보편적 최적 모델이라고 단정하는 것을 방지

특히 no entry ... covers the task type은 범위가 넓습니다. 같은 작업 유형의 실측이라도 실행 환경이나 모델 버전이 달라졌다면 적용성이 낮을 수 있습니다.

여기서 스킬이 실측 대장의 스키마나 실험 프로토콜 전부를 소유할 필요는 없습니다. 비교 가능성·공통 품질 기준·측정 기록 의무만 연결하면 충분합니다.

추천 기준도 단순 최저 토큰이 아니라, 요구 품질을 충족하는 설정 중 속도·토큰 사용량의 트레이드오프를 비교하는 것이 합리적입니다.

기존 계약과의 관계: 추가적인 보편 리뷰 게이트를 만들지 않는 원칙과 양립 가능합니다. 모델 비교는 요청 시 실행하는 별도의 실험이지 모든 개발 작업의 필수 검증 단계가 아닙니다.

③ 설치 스킬 본문 전수 검사 제거

요구 충족: 대체로 충족. 가장 유지 가치가 높은 변경입니다.

AGENTS.md, CLAUDE.md, 룰, 훅 등 지시·실행의 진입점부터 확인하는 접근은 타당합니다. 모든 스킬의 본문과 참조 파일을 먼저 읽는 것은 감사 비용을 크게 높일 수 있습니다.

다만 다음 두 부분을 고쳐야 합니다.

첫째, That layer runs every session은 사실상 부정확합니다. 훅은 이벤트 발생 시 실행되고, 룰은 적용 대상과 로딩 조건에 따라 달라질 수 있습니다. 따라서 항상 적용되는 계층이라기보다 **지시 및 실행 진입점(instruction and execution entry points)**으로 표현하는 편이 정확합니다.

둘째, 다음 표현에는 순환 논리가 있습니다.

skill text that contradicts, duplicates, or overrides it

스킬 본문을 읽지 않으면서 그 안에 충돌하는 문장이 있는지 어떻게 알 수 있을까요?

에이전트는 둘 중 하나로 행동할 수 있습니다.

충돌 여부를 확인하려고 모든 스킬 본문을 다시 읽는다.

본문을 읽지 않았으므로 충돌을 찾지 못한 채 이상 없음으로 처리한다.

둘 다 이번 변경의 취지에 맞지 않습니다.

2. ③의 구체적 실패 사례와 최소 방어선

사례

	

연결부 감사만 수행할 때

	

필요한 방어




스킬 본문에서 자체적으로 파일 변경 권한을 주장

	

루트 지시문에서 해당 스킬을 참조하지 않으면 발견하지 못할 수 있음

	

실제 호출 또는 변경 전에 해당 스킬의 권한 문장 확인




스킬 내부 스크립트가 파일 삭제·외부 전송 등 부작용 수행

	

진입점에 드러나지 않으면 미탐지 가능

	

실행 예정 경로의 side-effecting scripts 확인




스킬 내부 지시가 AGENTS.md의 원칙과 충돌

	

스킬 본문을 읽지 않으면 충돌 자체를 식별할 수 없음

	

호출·의존·수정 대상인 경우 관련 본문으로 검사 확장

핵심은 두 종류의 위험을 구분하는 것입니다.

비활성·미참조 스킬 내부에 숨어 있는 충돌까지 빠짐없이 탐지하는 것은 본문을 검사하지 않고는 불가능합니다. 이 한계를 인정해야 합니다. 반면 이번 작업에서 실제 실행하거나 의존할 스킬은 최소한 관련 권한 지시와 실행 경로를 검사할 수 있습니다.

따라서 전수 검사를 되살리지 않고 추가할 최소 문장은 다음입니다.

일반 텍스트
Before invoking, modifying, or relying on a skill, inspect its
applicable authority instructions and side-effecting execution
path. Do not treat uninspected skill bodies as compliant.

이 문장은 전체 스킬을 검색하라는 요구가 아닙니다. 실제로 사용할 스킬에만 국소적인 점검을 요구합니다. 그리고 기존 Inspect scripts as text; execution needs its own purpose and authorization과도 정합적입니다.

미사용 스킬에 대해서는 not inspected라고 보고하면 됩니다. 그것만으로 전체 하네스가 안전하다고 판정해서는 안 됩니다.

3. 권장 교체 문장 — 최소 수정안

아래는 기존 구조를 유지하면서 문제가 되는 추가 문장만 교체하는 안입니다.

A. SKILL.md — 라운드 운영 문장 교체
일반 텍스트
For an audit-and-apply request, ask once at the start for a maximum
round count if the user has not specified one. Suggest two rounds,
with a third only if material findings remain; use that default
when the user delegates the choice.

Run up to the agreed count without repeating the round-count
question. The count does not grant edit or merge authority.

After the rounds, hand the accumulated diff to the project's
normal delivery process once, without bypassing required
approvals or verification.

변경 의도는 2회를 기본으로 명확히 하고, 세 번째 라운드는 필요한 경우에만 허용하며, 라운드 수와 수정 권한을 구분하는 것입니다.

B. apply.md — Rounds 문단 교체
일반 텍스트
Rounds: Treat the agreed count as a maximum. After each authorized
apply, re-audit changed sources, relevant authoritative sources
and dependencies, and unresolved material findings. Do not repeat
unaffected parts of the full audit.

New changes outside the delegated authority remain proposals.
Run focused checks during rounds when needed. Do not create
per-round PRs or merges.

After the final round, submit the accumulated diff and per-round
findings through the project's existing review, verification,
and merge policy. Stop early if no material findings remain.

이렇게 하면 증분 재감사와 기존 권한·검증 계약을 동시에 유지할 수 있습니다.

C. audit.md — Establish coverage 문단 교체
일반 텍스트
Start from instruction entry points: AGENTS.md / CLAUDE.md,
imports, rules, hooks, their settings, and the principles
they state. Account for conditional loading and triggers.

Installed skills are selected capabilities, not automatically
authoritative or safe. Inspect their connections to those
entry points: descriptions, routing, and explicit references.

Follow identified connections or findings into relevant skill
bodies, scripts, and references. Do not scan every installed
skill body merely to search for hypothetical conflicts.

Before invoking, modifying, or relying on a skill, inspect its
applicable authority instructions and side-effecting execution
path. Report uninspected bodies as out of scope, not compliant.

The statement ledger is complete for the inspected sources
and seams only.

특히 마지막 문장이 중요합니다. 기존 라우팅 표의 complete statement ledger와 새로운 검사 범위 축소가 모순되지 않도록 완전성의 범위를 실제 조사 대상으로 한정합니다.

SKILL.md의 Audit contract에 추가된 요약문도 같은 의미로 짧게 맞추는 것이 좋습니다.

일반 텍스트
Coverage starts from instruction entry points, rules, hooks,
and the principles they state, accounting for conditional
loading and execution. Inspect installed skills at their
connections to that layer, not body by body by default
(Audit § Establish coverage).
D. verification.md — 모델 실측 문단 교체
일반 텍스트
When the user asks which model or effort fits a task, consult
the project's model-evidence ledger. Treat existing evidence
as applicable only when the task, environment, effort settings,
and quality criteria are comparable.

Otherwise, propose a bounded comparison under the ledger's
entry conditions. When authorized, compare configurations
using the same inputs, isolated starting states, and common
acceptance criteria.

Record measured elapsed time, token usage, quality outcomes,
and limitations in that ledger. Recommend a context-specific
trade-off among configurations meeting the quality bar, not
a universal optimum inferred from model names or a single
uncontrolled run.

Comparisons are on request only.

실측 대장이 측정값의 소유자라는 원칙은 그대로 유지합니다. 스킬이 새로운 대장 형식이나 정기 평가 작업을 만들지 않습니다.

4. 잔여 이슈와 최종 판단

심각도

	

항목

	

판단




Should

	

라운드 수와 수정 승인 분리

	

수정 필요




Should

	

재감사에서 관련 원칙·미해결 항목 유지

	

수정 필요




Should

	

라운드 중 필요한 검증 보존

	

수정 필요




Should

	

모델 실측의 비교 가능성 명시

	

수정 필요




Should

	

실제 사용할 스킬의 권한·실행 경로 검사

	

수정 필요




Nit

	

first apply usually exposes findings

	

실증되지 않은 일반화이므로 삭제 권장




Nit

	

Audit § Establish coverage 앵커

	

실제 앵커 존재 여부 확인 필요. 확신 낮음: 전체 파일 미제공




Nit

	

기존 statement ledger의 완전성 정의

	

기존 다른 문서의 표현과 추가 대조 권장. 확신 낮음: 해당 원문 전체 미제공

최종 권고

**수정 후 채택(Approve with changes)**을 권고합니다.

①은 현재 설계를 유지하면서 라운드 수와 승인 권한을 분리하고, 증분 재감사 범위에 관련 원칙과 미해결 사항을 포함하면 됩니다.

②는 별도 실측 대장으로 책임을 위임하는 구조를 유지하되, 동일 조건·공통 품질 기준·실측 한계를 명시해야 사용자 요구인 최적점 탐색으로 실제 연결됩니다.

③은 전수 검사를 복원하지 않는 것이 좋겠습니다. 대신 검사하지 않은 스킬의 안전성을 보증하지 않고, 실제 사용할 스킬의 권한·부작용 경로만 검사하도록 하면 됩니다.

세 변경 모두 새 훅, 반복 승인 루프, 보편 리뷰 게이트 없이 개선할 수 있습니다. 추가 문장을 늘리는 것보다 실행 경로·권한 경계·검증 범위의 의미를 정확히 하는 것이 우선입니다.


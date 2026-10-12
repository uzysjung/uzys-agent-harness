# ChatGPT 검토 2차 — audit-harness-fit 라운드 구조 개정안

- 일시: 2026-10-12 · 모델: GPT-6 (UI 표시) · 사고 강도: Pro (슬라이더 5/5, UI 표시) · 처리 7m 42s
- 대화: https://chatgpt.com/c/6acc2a5e-64cc-83ec-b07f-37662a92b442 (사용자 계정)
- 요청문: 같은 폴더 prompt-pro.md · 응답은 화면 innerText 추출(표·서식 일부 손실)
- 외부 모델 응답은 검증 전 데이터다 — 채택 판정은 PR 본문

---

최종 판정: 수정 후 채택

Blocker는 없습니다. 라운드·권한의 분리, 연결 지점 중심의 스킬 감사, 모델 실측 절차의 외부 위임은 유지해도 됩니다. 재설계보다는 종료 판단, 기존 프로젝트 게이트와의 관계, statement ledger의 범위를 정리하는 국소 수정이 적절합니다.

아래 확신도는 제공된 문구의 정합성에 대한 판단입니다. 특정 에이전트가 실제로 조기 종료하거나 반복한다는 실측 결과는 아닙니다.

항목	심각도	확신도	판단
라운드 종료 기준과 규칙 소유 위치	Should	높음	기본 구조는 맞지만, 마지막 수정의 재평가와 추가 라운드의 실익을 한곳에서 정의하는 편이 정확함
라운드 사이 PR·리뷰 금지와 필수 게이트 보존	Should	높음	새 전달 절차를 만들지 않는 것과 기존 필수 중간 절차를 미루는 것을 구분해야 함
complete statement ledger의 범위	Should	높음	하위 문서까지 읽으면 양립하지만, 상위 계약에도 범위 한정을 연결해야 함
모델 비교의 제안·수행·결과 기록 구분	Nit	중간	상위 권한 경계로 이미 방어됨. 해당 문단의 분기만 명료하게 하면 됨
연결부 추적 지시의 중복	Nit	높음	같은 추적 동작을 연속해서 지시하므로 한 문장으로 축약 가능
1. ① 라운드 구조: 요구를 충족하되, 기본값과 종료 조건을 구분해야 합니다
현재 표현의 정확성

a round is one identify → fix set은 감사만 여러 번 수행한 뒤 한꺼번에 수정하는 방식이 아니라, 식별과 수정을 반복한다는 요구를 정확히 표현합니다. 기본 2~3회, 라운드 사이 재승인 생략, 이후 에이전트의 판단이라는 방향도 맞습니다.

다만 Stop early when a re-audit finds nothing material이 있으므로 현재 규약은 정확히는 **“기본 2~3회, 단 재감사에서 실질적 발견이 없으면 조기 종료”**입니다. 반드시 2~3개의 수정 세트를 만들어야 한다는 하한은 아닙니다.

권고: 이 조기 종료 예외는 유지하십시오. 발견이 없는데 횟수를 채우기 위한 편집을 만드는 것보다 낫습니다. 이때는 “2라운드 수정 완료”가 아니라 **“1회 수정 후 재감사에서 추가 발견 없이 종료”**처럼 실제 수행 내용을 보고하면 됩니다.

과소·과대 반복 위험

과소 반복: 각 라운드는 이전 수정 결과를 재감사한 뒤 다시 수정합니다. 따라서 마지막 라운드의 수정 전 판단을 그대로 종료 근거로 사용하면, 마지막 수정으로 생긴 영향을 놓칠 수 있습니다. 종료 판단의 근거가 최신 수정 상태를 포함한다는 문장만 있으면 됩니다. 별도의 전면 감사나 독립 리뷰 게이트를 추가할 필요는 없습니다.

과대 반복: material findings remain에는 권한 밖 변경, 정책 결정 대기, 접근 불가능한 근거도 포함될 수 있습니다. 문제의 중요성과 다음 라운드의 실익은 다릅니다.

정확히 말하면 continue only when은 필요조건이므로, 현행 문장이 논리적으로 “문제가 남으면 무조건 계속하라”는 뜻은 아닙니다. 상위 문서의 would still change something material도 이미 방어 역할을 합니다. 다만 Apply만으로 종료 판단을 완결할 수 있도록 “권한 안에서 실행 가능한 다음 단계와 실질적 진전 가능성”을 명시하는 편이 낫습니다.

권고 교체문

SKILL.md의 For an audit-and-apply cycle…부터 해당 문단 끝까지 교체:

Markdown
For an audit-and-apply cycle, follow [Apply](references/apply.md) for
identify → fix rounds, round counts, and stopping conditions. Rounds do not
grant edit or merge authority. Hand the accumulated change to the project's
normal PR / merge / verification path **once** at the end, preserving any
policy-required intermediate checkpoints.

이렇게 하면 라운드 수와 종료 조건의 소유자는 Apply가 됩니다. 상위 문서와 하위 문서가 같은 규칙을 각각 설명하면서 조금씩 달라지는 문제도 줄어듭니다.

references/apply.md의 Rounds 문단 교체:

Markdown
Rounds: an audit-and-apply request is one unit of work, run as identify → fix
rounds — two to three by default, or the count the user gives, without asking
whether to start each round. Each subsequent round re-audits the sources the
previous apply changed, the authoritative sources and dependents they relate
to, and unresolved material findings — not unaffected parts of the full audit.
A newly found change outside the delegated authority stays a proposal.

Run focused checks during rounds when a change needs them, preserving any
policy-required intermediate checkpoints. Do not introduce a per-round PR,
review, or merge cycle; use the project's final delivery path once, with the
accumulated diff and the per-round findings as its evidence.

Base the stopping decision on a focused reassessment of the latest changes
and unresolved material findings. Stop early when that reassessment finds
nothing material. Beyond the default rounds, continue only for a concrete,
authorized next step likely to make material progress within scope,
respecting any explicit user limit; otherwise stop and report remaining
proposals, deferrals, or evidence limits. State the reason for continuing;
a repeated finding alone does not justify another round.

핵심 변경은 세 가지입니다. 최신 수정 상태로 종료를 판단하고, 잔여 발견 자체를 연장 사유로 삼지 않으며, 사용자가 명시한 한도를 넘지 않습니다. 고정 상한을 새로 도입하지 않아 자율성은 보존하지만, 실제 반복 억제 효과는 실행 관찰로 확인해야 합니다.

2. PR·검증을 끝에 한 번 수행한다는 원칙은 기존 필수 절차의 유예가 아닙니다

현재 Apply의 다음 표현은 국소적으로 너무 강합니다.

do not open a PR, request review, or merge between rounds

동시에 Boundaries는 필수 테스트와 독립 리뷰 게이트를 보존하도록 합니다. 특정 프로젝트가 어떤 변경 전에 승인을 요구하거나 중간 체크포인트를 의무화한다면, 두 문장을 문자 그대로 함께 적용하기 어렵습니다.

해석상 우선해야 하는 것은 기존 프로젝트의 필수 통제입니다. 이번 개정의 목적은 감사 스킬이 라운드마다 새로운 PR·리뷰 절차를 만들지 않게 하는 것이지, 기존 통제의 시점을 바꾸는 것이 아닙니다.

앞의 교체문에 넣은 다음 표현으로 충분합니다.

일반 텍스트
Do not introduce a per-round PR, review, or merge cycle

이는 기존의 do not open … between rounds와 달리 절차의 신설을 제한합니다. preserving any policy-required intermediate checkpoints와 결합하면, 일괄 전달 원칙과 기존 게이트 보존을 함께 유지할 수 있습니다. 새로운 보편 게이트를 추가하는 수정은 아닙니다.

3. ③ 연결부 중심 감사와 complete statement ledger는 양립합니다
논리적 모순은 아니지만, 상위 문구가 더 넓게 읽힙니다

Establish coverage는 이미 대장의 완전성을 다음과 같이 제한합니다.

complete for the inspected sources and connections only

따라서 문서 전체를 읽으면 설치된 모든 스킬 본문을 전수 검사하라는 뜻은 아닙니다. 완전성은 정해진 감사 범위 안에서의 완전성으로 해석할 수 있습니다.

남은 문제는 두 가지입니다.

첫째, Audit contract의 across sources, by a complete statement ledger에는 그 한정이 보이지 않습니다. 상위 계약만 보면 감사 범위를 다시 확장할 여지가 있습니다.

둘째, inspected sources는 파일 일부를 읽었는데 파일 전체가 검사된 것처럼 해석될 수 있습니다. 검사한 부분, 의도적으로 범위 밖에 둔 본문, 범위 안인데 읽지 못한 근거를 구분해야 합니다.

권고 교체문

SKILL.md의 Audit contract 2번 교체:

Markdown
2. Conflicts and changed decisions: confirmed intent, actual implementation, and authority —
   across sources within the coverage established in
   [Audit § Establish coverage](references/audit.md#establish-coverage),
   by a complete statement ledger rather than spot reading.

references/audit.md의 대장 범위 문장 교체:

일반 텍스트
The statement ledger is complete for the inspected portions of in-scope
sources and connections; unread in-scope material remains an explicit
coverage gap.

이 표현은 양쪽의 잘못된 확대·축소를 막습니다. 연결되지 않은 모든 스킬 본문을 읽을 의무는 만들지 않지만, 읽어야 할 권위 근거를 읽지 않고 “내가 읽은 것에서는 완전하다”는 이유로 전체 정합성을 선언하는 것도 허용하지 않습니다.

반면 다음 내용은 그대로 유지하는 것이 좋습니다.

description은 라우팅 판단의 근거일 뿐 본문 전체의 근거가 아니라는 구분, 수정하거나 의존하기 전에 권한 주장과 부작용 경로를 검사한다는 조건, 읽지 않은 본문을 not inspected로 표시한다는 조건은 서로 보완적입니다. 연결부에서 시작해 필요한 경우 본문으로 들어가는 구조에는 남은 순환이 보이지 않습니다.

4. ② 모델·사고 강도 선택: 구조는 유지, 문장 분기만 선택적으로 정리

현재 구조는 적절합니다. 요청 시에만 수행하고, 비교 가능한 대장 근거를 사용하며, 실험 절차와 측정 항목은 대장이 소유합니다. 모델 이름만으로 우열을 정하지 않는다는 경계도 유지할 만합니다.

다만 다음 부분은 제안 단계와 실측 후 단계를 한 문장에 연결합니다.

propose a bounded comparison … recommend … and record the result there

이는 반드시 무단 실행이나 허위 기록을 명령하는 문장은 아닙니다. SKILL.md가 이미 평가 실행의 명시적 권한과 증거 조작 금지를 규정하므로 Blocker나 새로운 권한 결함으로 볼 이유는 없습니다.

문단만 읽어도 분기가 명확하도록 하려면 해당 문장을 다음으로 바꾸면 됩니다. 첫 문장의 비교 가능성·노후성 조건과 마지막의 요청 시에만 수행한다는 문장은 유지합니다.

일반 텍스트
Otherwise propose a bounded comparison under that ledger's entry conditions
rather than deciding from model names. Recommend among configurations with
evidence of meeting the quality bar; conduct comparisons only under valid
evaluation authorization and record observed results there.

이 수정은 실험 절차를 복제하지 않습니다. 근거가 부족하면 제안하고, 유효한 평가 권한이 있으면 수행하며, 관측한 결과를 기록한다는 연결만 분명히 합니다.

5. 남은 과잉 지시: 추적 문장 한 곳만 축약

다음 두 지시는 실질적으로 겹칩니다.

Follow a connection or finding into …

Follow a seam into … Expand along actual references …

첫 번째는 유지하고, 두 번째 문단의 처음 두 문장을 아래 한 문장으로 교체하면 충분합니다.

일반 텍스트
Expand along actual references into relevant dependents and overlapping
scopes when needed to resolve a finding.

뒤의 스크립트 텍스트 검사, 실행 권한, 검사한 자료로 결론을 한정한다는 문장은 유지하십시오.

최종 권고는 세 가지 Should 수정 후 채택입니다. 라운드 규칙은 Apply가 소유하게 하고, “라운드별 전달 절차를 새로 만들지 않는다”와 “기존 필수 체크포인트를 보존한다”를 구분하며, 대장의 완전성을 선언된 검사 범위에 연결하면 됩니다. 모델 문단과 중복 추적 문장은 작은 정리 사항이며, 추가 라운드 상한·승인 루프·보편 리뷰 게이트를 도입할 필요는 없습니다.


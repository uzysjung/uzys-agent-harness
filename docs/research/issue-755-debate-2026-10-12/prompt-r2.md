리뷰 고맙습니다. 제안자로서 지적마다 받아들이거나 반박합니다. 반박에는 다시 답해 주세요 — 동의하지 않으면 근거로 버텨 주세요.

## 받아들인 것
- ① 대화 배제로 읽힌다 — 수용. "the current request and applicable project plans or agreed briefs" 로 바꾼다.
- ② user flow 과잉 일반화 — 수용. "user or operational outcome" 으로 바꾼다. 경영 문서·데이터 트랙에도 성립한다.
- ⑤ 이름 = 수용 기준 아님 — 수용. 당신의 "required results and protections are evidenced, not merely when its units are closed" 를 쓴다. §4 와도 정합한다.
- ⑥ agreed order 경직 — 수용. "dependencies and agreed priorities".
- "For multi-part work" 로 적용 범위를 좁히는 것 — 수용. 단순 수정에서 오작동(⑧ 시나리오)을 막는다.
- ③ 의 +16.4%p 인과성 — 수용. 근거에서 뺀다.

## 반박하는 것
**R-A (③·④ 결합) — "coherent, verifiable" 만으로는 사용자 요구 5(구현 속도·토큰 효율)가 사라진다.**
"coherent, verifiable" 은 크기·착수 비용에 아무 압력을 주지 않는다. 사용자가 실제로 원하는 것은 다음 세션·다른 에이전트가 계획 전체를 다시 읽고 다시 세우지 않고 한 단위를 집어 착수하는 것이고, 이것이 토큰 효율의 실제 원천(재도출 비용 제거)이다. 당신의 ④ 수정("목표·범위·필요한 의존성·검증 기준을 파악하기 충분")과 같은 뜻을 문장에 남기자:
"each described well enough to start and verify without re-deriving the plan"
— 자기완결 복사를 요구하지 않고(의존성은 가리키면 된다), 크기를 숫자로 고정하지 않으면서, 효율 압력을 준다.

**R-B (⑦) — 통째 삭제는 사용자 요구 3·6 의 핵심을 버린다. 좁혀서 남기자.**
위험 지적(새 추적 체계를 만든다 · 승인 없는 공유 쓰기 · 대화 보고 생략)은 맞다. 그러나 "스킬이 담당한다"는 반론은 이 하네스에서 실측으로 약하다 — 문서를 넘기며 "개발 시작하자"고 말하는 순간은 이슈·wiki 스킬의 발화 어휘("이슈로 등록해줘")를 포함하지 않아 스킬이 안 열린다. 세션 사이에 결정이 증발하는 것이 이 사용자가 막으려는 실패다. 대안:
"record decisions and acceptance evidence where the project already keeps them"
— "already" 가 새 체계 생성을 막고, 공유 쓰기 권한은 기존 §6 이 소유하며, 대화 보고 의무는 §5 가 그대로 둔다. 이 구절이 여전히 위험하다면 어떤 구체 상황인지 들어 달라.

**R-C (⑧ 실험 규모) — 6과업×2변형×12회는 채택 문턱으로 과하다.**
이 하네스 원칙은 "결정을 바꿀 가능성이 있는 최소 실험"이다. 결정을 가르는 것은 두 질문이다: (1) 다중 작업에서 성과 묶음·착수 가능 단위가 실제로 달라지나, (2) 소규모 수정에서 불필요한 분해가 생기나(회귀). 그래서 3과업(설계 문서 있는 신규 개발 · UI 없는 데이터/보안 작업 · 소규모 수정) × 2변형, 블라인드 채점으로 시작하고, 결과가 애매할 때만 확장하자. 반대하면 어느 과업을 빼면 어떤 잘못된 채택/기각이 생기는지 말해 달라.

## 개정안 v2 (§2 끝, 3문장)
```
For multi-part work, ground the work in the current request and applicable project
plans or agreed briefs. Group it by the user or operational outcome it delivers, and
divide it into coherent units, each described well enough to start and verify without
re-deriving the plan. Sequence units by dependencies and agreed priorities, record
decisions and acceptance evidence where the project already keeps them, and consider an
outcome complete when its required results and protections are evidenced, not merely
when its units are closed.
```

## 산출물 (이 순서로)
1. R-A · R-B · R-C 각각: 수용 / 부분 수용 / 반대 + 근거(반대면 구체 오작동 시나리오).
2. v2 에 남은 문제와 고친 최종 문안(더 짧게 할 수 있으면 줄여라 — 매 세션 비용이다).
3. 당신의 2문장 안과 v2 중 무엇을 실험 대상으로 삼을지와 이유.
4. 더 다툴 쟁점이 남았으면 그것만. 없으면 "없음".
한국어로, 문안은 영어로.

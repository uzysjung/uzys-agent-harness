# Change Management

## Change Request (CR) 분류

구현 중 SPEC/PRD 변경이 필요해지면 셋 중 하나로 분류한다:

| 유형 | 기준 | 처리 |
|---|---|---|
| **Clarification** | 이미 합의된 내용의 구체화 | 즉시 반영 + Change Log |
| **Minor** | 현재 Phase 내부에 국한 | 제안 → **인간 승인** → Change Log |
| **Major** | AC 의 Pass/Fail · 다른 Phase 의 입출력 · Non-Goals 경계 · DO NOT CHANGE 중 **하나라도** 건드림 | **인간 결정 필수** → Change Log + 영향 분석 |

## DO NOT CHANGE

SPEC/PRD 의 DO NOT CHANGE 영역은 **수정 금지**다. 불가피하면 Major CR 을 쓰고 인간 결정을 기다린다. 안정적으로 보이는 영역도 손대기 전에 묻는다 — "이 부분도 수정 범위입니까?"

## Decision Log (ADR)

SPEC 에 없던 의사결정은 `docs/decisions/` 에 기록한다. **대상** = 아키텍처 변경 · 외부 의존성 도입/제거 · 데이터 모델 변경 · 보안 정책 · breaking API. **비대상** = 한 함수의 구현 디테일 · 임시 워크어라운드 · 명백한 버그 fix.

```markdown
# ADR-NNN: [결정 제목]
- Status: Proposed | Accepted | Superseded | Deprecated
- Date: YYYY-MM-DD
- PR: #123
- Supersedes: ADR-MMM (있으면)
- Context: [왜 결정이 필요했는가]
- Decision: [무엇을 결정했는가]
- Alternatives: [검토 후 기각된 대안]
- Consequences: [이 결정의 영향]
```

Status 는 **Proposed**(초안, 미적용) → **Accepted**(머지됨, 이 결정에 따라 쓴다) → **Superseded**(다른 ADR 이 대체) 또는 **Deprecated**(무효인데 대체 없음 — **사유를 PR/본문에 남긴다**). 뒤 둘은 terminal.
PR review 에서 `Alternatives` 와 `Consequences` 를 검증하고, 머지 직전에 Status 를 Accepted 로 바꾸고 PR 번호를 채운다. 기각은 **별도 ADR 을 만들지 않고** PR comment 에 사유를 남긴다. 결정을 바꿀 때는 새 ADR 에 `Supersedes:` 를 쓰고 **기존 ADR 의 Status 도 함께** 갱신한다 — 한쪽만 고치면 어느 것이 현행인지 알 수 없다.

## Savepoint

Major CR 적용 전, 또는 되돌리기 어려운 변경 직전에 커밋으로 지점을 남긴다: `git commit -a -m "chore: savepoint before [변경 설명]"`.

**`git add -A` 를 쓰지 않는다.** 설치 직후처럼 `.gitignore` 가 아직 시크릿을 덮지 못한 상태에서는 그 한 줄이 `.env` 를 그대로 커밋한다 — 같은 하네스의 `git-policy` 가 금지하는 것을 savepoint 가 수행하게 된다. 추적 중인 변경만 담고, 새 파일이 꼭 필요하면 경로를 하나씩 지정해 추가한다.

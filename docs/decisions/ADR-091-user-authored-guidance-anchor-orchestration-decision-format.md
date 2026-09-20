# ADR-091: 사용자 문안으로 지침 3종 개정 — 배포 앵커 · model-orchestration · 의사결정 형식

- Status: Proposed
- Date: 2026-09-20
- PR: #468 (앵커 · 이 ADR) · #467 (model-orchestration) · #466 (clear-korean-communication)
- Amends: ADR-085 (결정 1 "배포 앵커 = 전역 `~/.claude/CLAUDE.md` 바이트 동일"이 끝난다 — 앵커는
  사용자가 #463 에 첨부한 Working Principles 문안이다. 결정 2·3·4 는 그대로) ·
  ADR-069 (외부 실행기 레인의 5술어·최초 1회 승인 절차가 `model-orchestration` 본문에서 빠진다.
  "저장소 코드가 제3자 제공자에 닿기 전 승인"이라는 보호 경계는 새 본문 §6 이 일반 원칙으로
  지키고, 호출 방법은 여전히 `external-model-consult` 가 소유한다)

## Context

사용자가 2026-09-14~15 에 지침 3종의 새 문안을 이슈에 첨부했다 — #463 배포 앵커(`CLAUDE.md` ·
`AGENTS.md` 로 나가는 본문) · #464 `model-orchestration` · #465 `clear-korean-communication`.
세 문안의 방향은 하나다: **고지능 모델의 자율을 존중하고, 달성할 결과와 지켜야 할 경계만 분명히
한 뒤 방법은 모델이 고른다.** 기존 문안은 그 반대 형태를 여럿 갖고 있었다 — 앵커의 "머지·배포
전 독립 리뷰 필수" 게이트, 오케스트레이션의 고정 모델 역할표·effort 하한·외부 실행기 5술어,
의사결정 형식의 4요소 고정 서식.

한편 ADR-085 는 배포 앵커를 사용자의 전역 `~/.claude/CLAUDE.md` 와 바이트 동일로 묶어 두었는데,
그 전역 파일에는 이제 사용자 머신 경로를 가리키는 절(`~/.agents/git-workflow.md`)이 들어 있어
설치자에게 나갈 수 없다. 두 파일이 갈라진 것은 이번 결정의 결과가 아니라 전제다.

## Decision

1. **배포 앵커 `templates/CLAUDE.md` = #463 첨부 Working Principles 문안(축자).** 이 리포가 문장을
   보태지 않는다. 4 CLI 앵커(`CLAUDE-uzys-harness.md` · `AGENTS.md` · Antigravity 워크스페이스
   룰)는 이 본문을 그대로 임베드한다. 전역 파일과의 바이트 동일 계약은 끝난다 — 다음에 사용자가
   앵커를 바꾸려면 **이 리포에 이슈로 문안을 준다**(#463 이 그 형태다).
2. **`model-orchestration` = #464 첨부 문안(축자).** 고정 역할표·effort 하한·외부 실행기 절·
   anti-pattern 표가 빠지고 자율 배분 원칙 6절만 남는다. 딸린 정정 두 곳: `objective-brief` 의
   'effort floor' 포인터, `external-tool-routing` 테스트의 모델 슬러그 슬라이스(사라진 두 절 →
   전문).
3. **`clear-korean-communication` = #465 첨부 문안(축자).** 기본 출력이 **맥락 · 문제점 · 해결방안 ·
   추천방안** 표(각각 이유)가 되고, `/clear-korean-communication` 단독 호출이 현재 대화의 미해결
   문제·직전 선택 요청을 그 표로 정리한다. 본문이 가리키지 않게 된 `references/` 3파일은 뺐다.
   이 리포의 의사결정 형식 포인터(`.claude/CLAUDE.md` · `CLAUDE.md` · `docs/REFERENCE.md`)도 새 표를
   가리킨다.
4. **앵커 도달 게이트(`lane-principle-anchor-parity`)의 처리** — ADR-085 결정 4 와 같은 규칙으로:
   성분이 새 문안에 있으면 어휘를 맞추고(축 "검증의 자기 증거" — `Base conclusions on actual
   artifacts and observed behavior` · `verified results`), 사용자가 뺀 성분은 배포 앵커 범위에서
   내린다(축 "설계 리뷰 분리" → `scope: repo`. 배포 문안의 독립 리뷰는 "fresh perspective 가
   확신을 실질적으로 높일 때 또는 명시적으로 요구될 때"의 조건부다). 이 리포 앵커에는 둘 다 남는다.

## Alternatives

- **앵커를 전역 파일과 계속 바이트 동일로 유지** — 기각. 전역 파일에 설치자에게 무의미한
  머신 경로 절이 들어왔다. 동일을 지키려면 그 절을 잘라 내야 하고, 그 순간 "축자"가 아니다.
- **model-orchestration 의 외부 실행기 절만 남기고 나머지를 교체** — 기각. 사용자 문안이 그 절의
  역할(위임·외부 경로 선택)을 §3·§6 으로 흡수했고, 5술어를 남기면 "방법은 모델이 고른다"는 새
  본문과 같은 파일 안에서 충돌한다. 보호 경계(승인 전 노출 금지)만 남기면 충분하다.
- **의사결정 형식을 4요소로 유지하고 표를 선택지로 추가** — 기각. 사용자가 실제로 매번 덧붙여
  부르던 형식이 표 쪽이었다("난 항상 아래처럼 사용해"). 기본값은 관측된 사용을 따른다.

## Consequences

- **설치자(앵커)**: 상주 지시문 ~4,225 → **~3,506**(CLAUDE.md 2개 ~2,957 → ~2,238). 머지·배포 전
  독립 리뷰 "필수" 문장이 사라지고, 검증 깊이·시점·독립 리뷰 여부를 영향·불확실성·복구 비용에
  따라 모델이 고른다. 승인·권한·시크릿·사용자 작업 보호 경계는 §6 이 그대로 지킨다.
- **설치자(오케스트레이션)**: 위임을 하지 않고 한 컨텍스트에서 끝내는 것이 정당한 선택이 된다.
  effort 하한 위반이라는 개념이 없어진다. 외부 CLI 로 저장소 코드를 보내기 전 승인은 여전히
  필요하다(§6).
- **설치자(의사결정 형식)**: 형식을 덧붙여 부르지 않아도 기본 표를 받는다. descriptor −198.
- **이 리포**: 레인 원칙(만든 레인은 자기 산출물을 판정하지 않는다)은 `.claude/CLAUDE.md` 와
  `test-policy` 문턱이 계속 든다 — 배포 앵커에서 빠졌을 뿐이다. 게이트 두 축의 범위 조정 근거는
  결정 4.
- **ratchet**: 축소 방향 갱신 3건(앵커 −719 · ckc −198 · mo 트랙별). `context-cost-baseline.json` 과
  NORTH_STAR 현재 상태를 실측에 맞췄다.

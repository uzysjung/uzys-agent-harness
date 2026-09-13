# ADR-090: 관측 없는 자산 은퇴 · 도메인 에이전트 트랙 조건부 강등 · 룰 문장 정리

- Status: Accepted
- Date: 2026-09-14
- PR: #457
- Amends: ADR-088 (은퇴 목록이 늘어난다. 개명·은퇴를 화면이 갈라 말한다는 결정은 그대로다) ·
  ADR-089 (`RETIRED_AGENT_IDS` 가 대안 문구를 종마다 갖는 `RETIRED_AGENTS` 에서 derive 된다.
  "이미 깐 설치본을 우리가 지우지 않는다"는 결정은 그대로다) · ADR-019 (C2·C3 축의 대상이
  전부 비었다. 분류 체계와 남은 C2 스킬 7종의 게이팅은 그대로다) · ADR-042 (증거 산출물 계약을
  싣던 두 스킬이 은퇴한다. 그 계약을 Testing·Delivery 룰과 `reviewer` 가 덮는다) ·
  ADR-075 (`superseded` 판정의 대상이 구조적으로 0 이 되어 모듈이 사라진다)

## Context

`#452` 1단계에서 하네스 자산 전수를 **두 표면**(설치자에게 나가는 `templates/` · 이 리포의
`.claude/`)에서 관측으로 판정했다. 판정 표와 근거는 `docs/plans/harness-inventory-audit-2026-09-14.md`
가 소유한다 — 여기 옮겨 적지 않는다.

그 표가 말한 것 하나만 옮긴다: **룰 프로즈가 행동을 바꿨다는 긍정 관측은 44문장 중 0건**이고,
값을 했다는 관측이 있는 자산은 6종뿐이다. 살아남는 나머지의 근거는 ② 보호 경계 · 사용자 계약 ·
환경 사실(모델이 스스로 알 수 없는 도구·벤더 계약·관례) 중 하나다.

판정은 사용자가 2026-09-14 에 확정했다. 2단계로 계획했던 A/B 실험은 **사용자의 실제 프로젝트
관측 수집**으로 대체됐다(같은 날 결정) — 이 리포 호스트에서는 실 CLI 실행이 훅으로 차단되고,
"이 리포에서 안 쓴다"는 "쓸모없다"의 증거가 아니기 때문이다(`audit-service-gaps` 가 그 반례다:
이 리포 산출물 0건인데 설치자의 다른 서비스에서는 유용했다는 관측이 있어 유지했다).

## Decision

### 은퇴 — 스킬 4종

`verification-loop` · `deep-research` · `eval-harness` · `agent-introspection-debugging`.
목록 SSOT 는 `src/external-assets.ts` 의 `RETIRED_SKILL_IDS` 이고, 화면 문구는 ADR-088 의
경로를 그대로 쓴다(기준선이 있는 설치본은 `update` 의 prune 이 회수하고, 레거시에는 화면이
"지워도 된다"를 낸다).

### 은퇴 — 에이전트 3종

`plan-checker` · `silent-failure-hunter` · `build-error-resolver`. 19세션 spawn 0 이고
관측된 것은 결함(없는 절·없는 파일을 지목)뿐이다. ADR-089 가 만든 `RETIRED_AGENT_IDS` 는
**종마다 대안 문구를 갖는 `RETIRED_AGENTS`** 에서 derive 하도록 바꿨다 — 한 문구로 뭉치면
자기 에이전트와 상관없는 대안을 읽게 되고, 그건 "대신 쓸 것을 말한다"의 뜻을 잃는다.

### 강등 — 도메인 에이전트 2종

`data-analyst` → `data|full` · `strategist` → `executive|full`. 전 트랙 상주였는데 descriptor 는
트랙과 무관하게 매 세션 읽히고, tooling 만 고른 설치자에게 그 레인은 열릴 일이 없다.

### 룰 문장 — 설치자에게 나가는 3종

- `change-management`: 앵커 §6 과 중복이던 "보류하는 것은 그 경계뿐" 절과 앵커 §2·§3 과 같은 뜻인
  "합의된 구체화" bullet 을 걷고, 그 bullet 이 담던 **기록 의무 한 구절**만 결정 기록 문장에 접었다.
- `cli-development`: 상주 중에도 못 막은 두 문장(빈 결과 · 파이프 뒤 `$?`)을 걷고 **막는 주체인
  도구**(`check-absence.sh`)를 가리키는 한 줄로 합쳤다. BSD/GNU 비호환 목록은 한 줄로.
  훅 차단 계약 문단(환경 사실)과 frontmatter `paths:` 는 그대로.
- `doc-governance`: 미완 표기 문장을 앵커와 겹치지 않는 한 줄로 축약. 나머지 문장과 검사기
  안내 문단은 그대로.

Testing(`test-policy`) · Delivery(`ship-checklist`) 두 룰은 **한 글자도 바꾸지 않았다** — 그
18문장의 판정은 `#454` 가 테스트 스위트와 같이 본다.

### 이 리포 표면 (`.claude/`)

죽은 사본 스킬 6종(`architecture-decision-record` · `find-skills` + 은퇴 4종) · UI 자산 2종
(`ui-visual-review` 스킬 · `playwright-launch` 룰 — 이 리포에 브라우저 작업이 없다) · 도메인
에이전트 2종 삭제. 룰에서는 savepoint 커밋 지시 · BSD/GNU 표 · Post-Merge 절차를 걷고
`git add -A` 금지(② 보호 경계)와 한 줄 요약만 남겼다. `ui-visual-review` 는 **배포판에는 그대로
남는다** — UI 트랙 설치자에게는 관측 기회가 있다.

### 중복 정리 — `model-orchestration`

"Delegation prompt spec" 은 `objective-brief` 를, "Worker lifecycle" 의 닫기 규칙은 `git-policy`
Session Cleanup 을 가리킨다. "Collect results as a file" 소절은 **그대로 둔다** — 3회 관측된
계약이다.

### 죽은 배선 제거 — `superseded`

`!s.withEcc` 로 갈리는 **파일** 자산이 하나도 남지 않아 `findSuperseded` 가 구조적으로 빈 배열을
낸다. 모듈(`src/superseded.ts`) · 위저드 확인 화면 · `cleanSuperseded` 스펙 필드 · 보고 필드 ·
테스트를 함께 뺐다. 같은 형태(플러그인 ↔ 폴백 파일 자산)가 다시 생기면 그 판정부터 되살린다 —
`src/manifest.ts` 의 `CORE_AGENTS` 주석이 그 자리를 적어 둔다.

## Alternatives

- **2단계 A/B 실험을 먼저 돌린다** — 기각(사용자 결정 2026-09-14). 이 리포 호스트는 실 CLI
  실행이 훅으로 차단되고, 컨테이너 A/B 는 "설치자의 실제 작업"을 재현하지 못한다. 남은 관측
  3건(`objective-brief` · `north-star` · `implementer`)은 사용자의 실제 프로젝트와 이 리포
  세션에서 계속 모은다.
- **은퇴 대신 opt-in 강등** — 기각. opt-in 은 카탈로그에 이름이 남아 위저드에서 계속 읽히고,
  "관측이 없다"의 답이 "고르면 쓸 수 있다"가 되면 판정이 아무것도 바꾸지 않는다.
- **이미 깐 설치본에서 은퇴 자산을 우리가 지운다** — 기각(ADR-046 유지). 스킬 디렉터리 안에는
  사용자 파일이 섞인다. 소유를 증명할 수 있는 설치본은 `update` 의 prune 이 회수하고, 그 밖에는
  화면이 말하고 손은 사용자가 댄다.
- **은퇴 자산의 교차참조를 문구 게이트로 막는다** — 기각. `change-management` §자산은 자기 변경
  요청 없이 건드리지 않는다 가 이미 "문장의 의미를 무는 자동 검사는 만들지 마라"로 판정했다.
  대신 **manifest 에서 사라졌는가**를 실행으로 판정한다(`tests/manifest.test.ts`).

## Consequences

- **설치자(update)**: 은퇴 스킬 4종 · 에이전트 3종이 디스크에 남아 있으면 화면이 이름과
  "지워도 된다"를, 에이전트는 **종마다 다른 대안**까지 낸다. 기준선이 있는 설치본은 에이전트
  파일을 `update` 가 회수한다(편집분은 백업).
- **설치자(강등의 그늘)**: `data-analyst` · `strategist` 를 이미 받은 tooling 설치자에게는
  그 파일이 **남는다** — 은퇴가 아니라 트랙 조건부라 `RETIRED_AGENT_IDS` 에 없고, `templates/`
  에 원본이 있어 prune 도 안 건드린다. 위저드가 *"Track removal is not automated"* 로 이미
  선언한 영역과 같은 자리다. 새 설치부터 트랙대로 간다. **update 화면은 그 파일이 남았음을
  트랙명과 함께 안내하고, 상주 계측은 디스크를 센다**(#458 · 파일은 여전히 지우지 않는다).
- **설치자(비용)**: tooling 트랙 상주 29개 ~7,364 → **20개 ~6,546**(실측 2026-09-14,
  `npm run cost:report tooling`). 내역은 `docs/NORTH_STAR.md` §현재 상태가 SSOT.
- **위저드**: baseline 페이지의 스킬 축이 tooling 단독 설치에서 **0건**이 된다(거기 뜨던 것이
  전부 ECC 파생 스킬이었다). 번들 스킬은 자산 페이지에서 그대로 개별 선택된다.
- **게이트**: ECC C3 축이 비어 `MODIFIED_ECC_SKILL_DIRS` 를 돌던 루프 3개가 0회가 됐다. 공허한
  통과를 막으려고 **빈 목록을 명시적으로 단언**한다(`tests/manifest.test.ts` ·
  `tests/vnv-verdict.test.ts`) — 다음 C3 가 들어오면 그 자리가 빨간불을 내고 lock 1:1 을 요구한다.
- **게이트(변이 대조에서 드러난 것)**: 은퇴 안내 테스트를 `RETIRED_SKILL_IDS` 에서 derive 하면
  **목록에서 한 줄을 빼도 초록**이다(케이스가 함께 사라진다). 그래서 v26.151.0 설치본의 이름을
  손으로 적은 표본을 따로 뒀다(`tests/update-external-skills.test.ts`). 이 상태에서
  `deep-research` 를 목록에서 빼면 1 FAIL 이고, 되돌리면 green 이다.
- **남은 관측**: `objective-brief`(위임 라운드) · `north-star`(방향 문서 lifecycle 오분류) ·
  `implementer`(사전 정의 레인 vs 즉석 구성 서브에이전트의 결과 차이) 세 건은 판정 보류 상태로
  계속 모은다 — 판정 표 §6.

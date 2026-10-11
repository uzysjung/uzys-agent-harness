# ADR-108: 모델 실측 대장 — 시드는 하네스 파일, 누적은 설치자 파일 `docs/model-evidence.md`

- Status: Accepted
- Date: 2026-10-12
- PR: #758
- Issue: #681 · #727 · #729(`external-model-consult` 제안분)
- 설계 문서: `docs/plans/v26.168.0-model-routing-design.md` §2 · §3 · §5.5 · 검증 `docs/plans/v26.168.0-model-routing-design-verify.md`

## Context

`external-model-consult` 는 모델·티어를 정책 문장으로 고른다("Every Gemini call … uses `pro`" · codex 는 `-m` 없이).
`model-orchestration` 원칙은 "실제 역량과 과제 증거로 고른다"인데, 그 증거를 쌓을 자리가 없었다 — 실측(#681 의 Claude
모델 × effort 8조합)은 이슈에만 있고, 설치자가 자기 프로젝트에서 재측정해도 적을 곳이 정해지지 않았다(#727).

자리를 정하는 제약은 코드가 준다(설계 §1.1, 검증 보고 §1(1)에서 코드로 확인):

- `.claude/skills/<id>/` 안에 설치자 누적분을 두면 `update` 의 `syncSkills` 가 "번들에 없는 파일"로 백업 후 지운다(#477).
- `.uzys-agent-harness/` 는 `uninstall` 이 디렉터리째 지운다.
- 기록에 없는 설치자 파일은 install · update · uninstall 이 건드리지 않는다(ADR-097 결정 5, 루트 CLAUDE.md §설치자 디스크).

## Decision

1. **시드**는 `templates/skills/external-model-consult/references/model-evidence.md` — 하네스 파일. 스킬 디렉터리째 네 CLI
   자리에 깔리고 `update` 가 최신판으로 덮으며(설치자가 고쳤으면 그 파일 하나 백업) `uninstall` 이 회수한다. 배선 코드 변경 0.
   references 라 필요할 때만 읽힌다 — descriptor 불변, 상주 비용 불변.
2. **프로젝트 대장**은 설치자 프로젝트의 `docs/model-evidence.md` — 설치자 파일. 설치자의 에이전트가 첫 재측정 때 만들고
   덧붙이기만 한다. 하네스는 만들지도 · 고치지도 · 지우지도 않는다. 프로젝트의 `CLAUDE.md`/`AGENTS.md` 가 다른 위치를 적었으면
   그곳. 같은 과제 유형에서 프로젝트 항목이 시드를 이긴다.
3. **항목 양식**은 두 파일 공통 — 날짜 · where · scope(task | user-scene | milestone) · task_type · method 체크 · 결과 · 조건 붙은
   결론 · limits · source · stale_when. 항목은 고치지 않고 새 항목 + `superseded-by` 로 잇는다. 사람의 판단은 "판단(측정 아님)"
   으로 측정값과 분리한다.
4. **재측정 절차는 대장이 "유효한 항목의 조건"으로 소유**한다(#727). `model-orchestration` 은 한 문장으로 대장을 가리키고
   (모델명 0 — 원칙만), `audit-harness-fit/references/verification.md` 는 "항목이 없으면 그 조건 아래 비교를 제안" 한 문장만 둔다.
   비교는 요청이 있을 때만 — 주기 실행 · 훅을 만들지 않는다.
5. `external-model-consult` 의 선택 문장마다 **항목 ID 또는 "근거 없음"**을 단다. 라우팅 · 도구 절에는 모델명 없이 ID 만 쓴다
   (`tests/external-tool-routing.test.ts` E).
6. 같은 PR 에서 #729 의 `external-model-consult` 제안을 항목별로 받는다(설계 §5.5): 자기 파일 경로는 `.claude/skills/...` 를
   박지 않고 "읽은 SKILL.md 의 디렉터리"(`<skill-dir>`, Claude Code 는 `${CLAUDE_SKILL_DIR}`) 기준 · 읽기 격리 과장 문구 정정 ·
   `direct-calls.md` 가 래퍼 가드레일을 재현한다는 거짓 정정 · 래퍼는 주석만. 제안의 `CONSULT_SKILL_DIR` 환경변수 셋업은
   받지 않는다(런타임이 주는 것을 쓴다).

## Alternatives (기각)

- **누적분도 스킬 디렉터리 안(`references/`)에** — Claude 자리에서 `update` 가 백업 후 지운다(#477). 지우지 않게 하려면 경우별
  예외가 생긴다.
- **`.uzys-agent-harness/` 아래** — `uninstall` 이 통째로 지운다. 설치자가 쌓은 측정이 하네스를 빼는 순간 사라진다.
- **함께 쓰는 파일(하네스 몫 마커 + 설치자 몫)** — `portions` 기록 · `stripShared` 에 다섯째 어댑터가 생기고, 시드 행과 설치자
  행이 한 파일에 섞인다. 설치자 파일 하나면 코드 0줄이다.
- **`docs/research/` 아래** — `audit-harness-fit` 배포물에서 금지된 경로 문자열이라(`tests/audit-harness-fit-skill.test.ts`) 그
  스킬이 가리킬 수 없다.
- **새 스킬(`model-ab` 류) 또는 `model-orchestration/references/`** — 대장 소유자가 둘이 되고(한쪽이 썩는다) 새 스킬은 descriptor
  상주가 +1.

## Consequences

- 설치자의 에이전트는 모델 · effort 를 고를 때 "근거가 과제 1건뿐이고 설계 과제는 미측정"을 읽고 고른다. 근거 없는 규칙은
  그렇다고 보인다(재측정 후보 표).
- 재측정 결과는 `update` 를 지나도 남는다 — 실행 확인: 설치(4 CLI) → `update` → `uninstall` 동안 미리 둔 `docs/model-evidence.md`
  가 바이트 동일, 시드는 두 자리에 깔리고 uninstall 에 회수됐다(PR 본문).
- Codex · OpenCode · Antigravity 설치본(`.agents/skills/`)에서 `external-model-consult` 예시가 실재하는 경로를 가리킨다.
  재발은 `tests/skill-sidecar-paths.test.ts`(번들 스킬이 자기 파일을 `.claude/skills/<자기 id>/` 로 박지 않는다 — 형태 검사)가 문다.
- 상주 비용 변화 없음(descriptor 불변 — `npm run cost:report tooling` 전후 동일).
- 개발 사본 `.claude/skills/{external-model-consult,model-orchestration}` 을 배포판과 바이트 동일로 맞췄다 — 개발 사본의 긴
  description 은 #540 동기화 누락이었다(검증 보고 §4-4).
- 시드의 `planned` 항목은 이 하네스 유지자의 재측정 계획이다 — 다른 프로젝트에는 "이 과제 유형은 근거 없음"으로 읽힌다.

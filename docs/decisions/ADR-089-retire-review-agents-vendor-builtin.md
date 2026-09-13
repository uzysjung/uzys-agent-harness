# ADR-089: 리뷰 에이전트 2종 은퇴 — 벤더 기본 기능과 하는 일이 같다

- Status: Proposed
- Date: 2026-09-13
- PR: (머지 직전에 채운다)
- Amends: ADR-019 (C2 에이전트 목록에서 두 종이 빠진다. C1/C2/C3 분류 체계와 나머지 C2 자산의
  게이팅은 그대로다)

## Context

사용자가 2026-09-13 에 물었다 — *"코드리뷰 에이전트가 필요한가? 클로드도 그렇고 코덱스도 그렇고
기본적으로 다 default 로 가지고 있는데"* → *"Fable 5.1 을 기준으로 할 때 정말 필요한 지침인지
검토"* → *"codex 에서도 동일하다면 추천한대로 정리"* (#445).

**벤더 확인 (2026-09-13, context7)**

| CLI | 기본으로 갖고 있는 것 |
|---|---|
| Claude Code | `/code-review`(별칭 `/review`) — 현재 diff/PR 을 코드베이스 맥락으로 리뷰, `--fix` · `ultra`. `/security-review` — diff 보안 취약점 |
| Codex | `codex review --uncommitted\|--base\|--commit` + 번들 review-agent 스킬. **우리 에이전트 파일은 Codex 에 가지도 않는다**(에이전트는 `.claude/` 전용) |
| OpenCode | 기본 리뷰 명령은 없다. 읽기 전용 `plan` 에이전트가 분석·제안을 맡는다 |

**판정 (Fable 5.1 기준 — 모델이 모르는 것만 상주시킨다)**

| 에이전트 | 본문이 실어 나르던 것 | 차별성 | 판정 |
|---|---|---|---|
| `code-reviewer` (ECC 파생 · `CORE_AGENTS_ECC` · ECC 플러그인 미선택 시 기본 설치) | 리뷰 체크리스트 · 80% 확신 필터 · 출력 형식 · 숫자 문턱(#443) | 없음 — 체크리스트는 모델 지식이고 `/code-review` 가 같은 일을 한다 | **은퇴** |
| `security-reviewer` (같은 조건) | OWASP Top 10 · "PROACTIVELY" 발화 문구 | 없음 — `/security-review` 가 같은 일을 한다 | **은퇴** |
| OpenCode `code-reviewer` subagent (`opencode.json` 의 subagent 엔트리) | 쓰기 금지 권한 + "5축 리뷰" 한 줄 | 약함 — 기본 `plan` 에이전트가 같은 읽기 전용 분석을 한다 | **은퇴** |
| `reviewer` (우리 것) | 만든 레인이 아닌 레인이 **완료를 판정**한다 — 씬 + 완료 기준 입력 · Verdict | 있음 — `/code-review` 는 버그를 찾지 완료 판정을 내리지 않고, 독립 레인도 아니다 | 유지 |

*"필수 보안 검사 유지"*(사용자 확정)는 프로젝트의 보안 **게이트**(`npm run security` 류)를 가리키지
이 에이전트를 가리키지 않는다 — 그 축은 그대로이고, 보안 리뷰 자체는 `/security-review` 로 계속 된다.

## Decision

`code-reviewer` · `security-reviewer` 에이전트와 OpenCode 의 `code-reviewer` subagent 엔트리를
은퇴시킨다. 배선·번들·ECC lock 행·문서에서 함께 뺀다.

이미 깐 설치본은 **기준선(ADR-047) 유무로 갈린다** — 있으면 `update` 의 prune 이 회수(편집분 백업)하고, 없으면 남는다.
소유를 증명할 수 있는 설치본에서는 `update` 의 기존 orphan prune 이 알아서 정리하고, 기준선이 없는
레거시 설치본에는 화면이 한 줄로 말한다 — *"이 릴리즈에서 은퇴 · `.claude/agents/<id>.md` 를 지워도
된다 · Claude Code 의 `/code-review` · `/security-review` 가 같은 일을 한다"*. 목록의 SSOT 는
`src/manifest.ts` 의 `RETIRED_AGENT_IDS` 다(스킬 쪽 `RETIRED_SKILL_IDS` 와 같은 형태).

#443(리뷰 문턱의 숫자 기준)은 그 문턱을 적어 두던 파일이 사라지므로 함께 닫힌다.

## Alternatives

- **유지** — 기각. 두 파일이 하는 일을 벤더가 기본으로 하고, 우리 판본이 더 나은 근거가 없다.
  상주 descriptor 2개는 "매 변경마다 나를 불러라"라고 무조건 발화를 요구하는 문구였다.
- **opt-in 으로 강등** — 기각. 고를 수 있게 남기면 카탈로그 한 줄·문서 한 줄·게이트 한 줄이 계속
  살아 있고, 고른 사람은 벤더 기능과 중복된 에이전트를 받는다. 아무도 안 고를 자산에 유지 비용을
  무는 형태라 "필요한 틀만 남긴다"는 방향과 반대다.
- **본문만 줄여서 남긴다** — 기각. 체크리스트를 걷어내면 남는 것이 `/code-review` 를 부르라는
  안내 한 줄인데, 그건 자산이 아니라 문서 한 줄로 족하다.

## Consequences

- **설치자**: 기본 설치에서 에이전트 2종이 빠진다. 코드 리뷰·보안 리뷰는 쓰던 CLI 의 기본 명령으로
  한다 — Claude Code `/code-review` · `/security-review`, Codex `codex review`. 완료 판정은 그대로
  `reviewer` 가 맡는다(벤더 명령이 대신하지 못하는 축).
- **이미 깐 설치본**: 기준선이 있으면 `update` 의 prune 이 회수한다(v26.132.0 이후 설치본 = 다수 경로). 없으면
  화면이 "지워도 된다 + 대신 쓸 것"을 낸다. 안내 목록 = `RETIRED_AGENT_IDS`.
- **상주 비용(tooling)**: agent descriptors 9개 ~766 → **7개 ~567**. 합계 31개 ~7,563 → 29개 ~7,364.
- **`superseded.ts` 의 대상**: ECC 플러그인이 밀어내는 폴백 에이전트가 4종 → 2종
  (`silent-failure-hunter` · `build-error-resolver`, 둘 다 dev track)이 됐다. 대상이 0 이 된 것은
  아니므로 그 로직은 그대로 둔다.
- **OpenCode**: 생성되는 `opencode.json` 의 `agent` 는 `build` · `plan` 두 primary 만 남는다.
  subagent 엔트리는 0 이 된다.

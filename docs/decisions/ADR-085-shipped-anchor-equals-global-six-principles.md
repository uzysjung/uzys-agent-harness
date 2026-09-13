# ADR-085: 배포 앵커는 사용자의 전역 6원칙과 바이트 동일하다 — 설치본 안내는 설치기가 프로젝트 블록에 쓴다

- Status: Accepted
- Date: 2026-09-13
- PR: #TBD
- Supersedes: ADR-068 (배포 앵커 = 7원칙 판단 문서) 전부 · ADR-055 의 "배포 앵커가 의사결정
  5요소를 싣는다" 절 (앵커 2파일 역할 분리 결정은 현행)

## Context

배포 앵커 `templates/CLAUDE.md` 는 설치자의 에이전트가 **매 세션 전문을 읽는** 파일이고 4 CLI
전부에 도달한다(Claude Code 는 루트 `CLAUDE-uzys-harness.md`, 나머지는 `AGENTS.md`/워크스페이스
룰 본문에 박혀 나간다). v26.150.0 까지 이 파일은 자체 7원칙 + 꼬리 2절(`Presenting a decision` ·
`Skills that apply continuously`)이었다.

사용자가 2026-09-13 에 전역 `~/.claude/CLAUDE.md` 를 6원칙 본문으로 새로 썼고(#427), **배포 앵커도
그것과 동일해야 한다**고 정했다. 한 판본이 두 자리에 있으면 갈리고, 갈리면 설치자와 사용자가
다른 원칙 아래에서 일한다. #407 의 문단별 판정(34블록 중 33 유지)과 #418 의 역할 분리 제안은
이 결정에 흡수된다.

"동일"을 문자 그대로 하면 꼬리 2절이 사라지고, 그 둘은 원칙이 아니라 **설치본 전용 안내**였다:

| 꼬리절 | 하던 일 | 없어지면 |
|---|---|---|
| `Presenting a decision` | 승인 요청을 ASIS→TOBE 로, 결과를 안고 사는 사람 자리에서 (ADR-055) | 형식 지시가 앵커에서 사라진다 |
| `Skills that apply continuously` | `clear-korean-communication` · `task-brief` · `model-orchestration` 은 프롬프트 모양으로 발화하지 않으니 한 줄이 있어야 매 응답에 열린다 (ADR-068 실측) | 그 세 스킬을 깔아도 이름을 부르지 않으면 영영 안 열린다 |

## Decision

1. **`templates/CLAUDE.md` = `~/.claude/CLAUDE.md` 바이트 동일.** 사용자 문안을 축자로 넣고 이
   리포가 문장을 보태지 않는다. 앵커에는 원칙만 있다.
2. **상시 적용 스킬 안내는 설치기가 쓴다** — 앵커가 아니라 **프로젝트 맥락 블록**에, 그리고
   **실제로 깔린 스킬만**. Claude Code 는 루트 `CLAUDE.md` 의 관리 마커 블록 안(import 줄 아래),
   Codex · OpenCode · Antigravity 는 `AGENTS.md`/워크스페이스 룰의 프로젝트 맥락 뒤. 어느 스킬이
   "상시"인지는 카탈로그 `CONTINUOUS_SKILLS` 가 SSOT 다. `update` 는 `.claude/skills/<id>` 존재로
   같은 판정을 내려 블록을 현행화한다 — 관리 마커 안은 하네스 소유다.
3. **의사결정 형식은 `clear-korean-communication` 스킬이 소유한다.** 그 스킬을 고른 설치자는
   위 안내로 매 응답에 그 형식을 받고, 고르지 않은 설치자는 받지 않는다 — 전역 앵커에도 그
   형식은 없으므로 사용자 본인과 같은 조건이다.
4. 앵커 도달 게이트(`lane-principle-anchor-parity`)는 낱말이 아니라 성분을 세므로 축1·축3 의
   어휘를 새 문안에 맞추고, **적대적 패널 축은 배포 앵커에서 뺀다**(`scope: repo`) — 사용자
   문안에 없다. 이 리포 앵커(`.claude/CLAUDE.md`)에는 남는다.

## Alternatives

- 6원칙 + 꼬리 2절 유지 — 기각: "동일"이 아니다. Codex `AGENTS.md` ratchet 도 +1,394 B 를
  의도적으로 올려야 했다.
- 6원칙만, 안내 이동 없음 — 기각: 설치자가 고른 상시 스킬 3종이 조용히 죽는다(ADR-068 실측).
  고객 기준으로 손실이다.
- 상시 안내를 7번째 룰 파일로 — 기각: 룰은 영역별 대원칙(ADR-071)이지 라우팅이 아니고, 룰은
  선택과 무관하게 전원 상주라 "깔린 것만"을 못 한다.

## 적용 범위

`templates/CLAUDE.md` · `src/external-assets.ts`(`CONTINUOUS_SKILLS`) ·
`src/project-claude-merge.ts`(`renderContinuousSkillsNote` · 관리 블록 현행화) · `src/installer.ts` ·
`src/update-mode.ts` · 세 transform · `src/context-cost.ts`(안내까지 계상) ·
게이트: parity 축 어휘 · reachability 지목 하한 · `claude-md-import` · `resident-reach-4cli`(안내 도달
+ 음성 대조) · 이 리포 `.claude/CLAUDE.md`(§Presenting 참조 · 테스트 작성 레인 문장).

## Consequences

- 설치자의 앵커가 사용자 전역 앵커와 같아진다. 다음에 사용자가 전역 앵커를 고치면 **이 파일도
  같은 커밋에서 바꾼다** — 두 파일의 바이트 동일을 재는 게이트는 없다(전역 파일은 리포 밖이다).
  그 대신 이 문장이 그 규율이다.
- 적대적 패널 문턱 · proven patterns · 수명 설계 · 설계 리뷰 분리(축1은 남는다) 중 배포 룰에 0건인
  것은 배포본에서 사라진다. 사용자 문안이 그렇게 정했다. 이 리포 앵커에는 남는다.
- 지시문 상주 비용: 앵커 −513 B, 안내(전 스킬 선택 기준 상한) 약 +1 KB → 순 +65 tok/세션(tooling, 안내 머리말을 한 문장으로 줄인 뒤).
  사용자 결정에 따른 의도적 baseline 갱신이다(ADR-083: ratchet 은 조용한 증가만 막는다).
- 관리 마커 **안**은 재실행마다 현행으로 다시 렌더된다 — 안쪽 import 줄만 지운 편집은 되돌아온다.
  하네스를 빼는 방법은 블록째 지우기(uninstall 의 strip 과 같다). 그 전에는 안이 한 줄뿐이라
  "안쪽만 지운 상태를 그대로 둔다"였다(`tests/project-claude-merge.test.ts` 가 기록).
- 사용자가 루트 `CLAUDE.md` 에 import 줄을 **손으로** 적은 설치본에는 관리 블록이 없어 안내를
  못 넣는다. 그 설치자는 스킬 이름을 부르거나 자기 파일에 한 줄을 적어야 한다 — 설치 보고가
  그 사실을 말하지는 않는다(후속).
- 이 리포 `.claude/CLAUDE.md` 의 "테스트는 구현이 아닌 레인이 쓴다"는 사용자가 2026-07-26 에
  기각한 축을 되살리고 있었다(`lane-principle-anchor-parity` 헤더가 그 기각을 기록한다). 함께 고친다.

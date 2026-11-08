# #963 Ponytail 도입 검토 — 평가

- 평가일: 2026-11-08 · 읽기 전용(저장소 수정·설치·AI CLI 실행 없음)
- 상류 기준: `DietrichGebert/ponytail` main = `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`(플러그인 5.3.3, 첨부 계획서의 고정 커밋과 같다) — `gh api` 로 원문을 직접 읽었다
- 하네스 기준: main `a60ae3b`(계획서는 `21fa039` 기준. 그 사이 `templates/agents/reviewer.md` · `implementer.md` · `templates/CLAUDE.md` 는 바뀌지 않았다)
- 판정 잣대: 루트 CLAUDE.md §판정은 목적에서 시작한다 · `docs/NORTH_STAR.md` §1(상주 지시는 관측이 근거)

## 1. 결론

1. **Ponytail 은 플러그인으로도, 선택형 카탈로그 항목으로도 넣지 않는다.** 공개 벤치마크는 "아무 지침 없음" 대비 결과라 하네스 위에 얹었을 때 설치자가 얻는 것이 측정된 적이 없고, 스킬 설명이 "모든 코딩 작업"에 발화하도록 쓰여 있어 사실상 하네스 앵커와 경쟁하는 두 번째 상시 모드가 된다.
2. **가져올 것은 하나다 — 배포 리뷰어의 "변경되지 않은 코드는 건너뛴다" 한 줄을 "이번 변경 때문에 깨진 곳은 포함한다"로 고친다.** 지금 문구는 리뷰어 자신의 블로커 정의(정확성 위험)와 충돌해, 고치지 않은 호출부가 이번 변경으로 깨져도 리뷰가 보고하지 않을 여지를 남긴다. 리뷰어는 상주가 아니라 호출 때만 읽히므로 상시 비용이 늘지 않는다.
3. 계획서의 나머지 제안(재사용 원칙 문구 · 절충 기록 규칙 · 구현자 지침 정비 · Band/코드 지도 · A/B 측정)은 **관측 근거가 없거나 이미 덮여 있어** 지금은 하지 않는다.

## 2. 상류 사실 확인

| # | 계획서 주장 | 판정 | 출처(커밋 고정) |
|---|---|---|---|
| U1 | 플러그인 5.3.3, 커밋 `96608e0` | 사실 | [.claude-plugin/plugin.json](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/.claude-plugin/plugin.json) |
| U2 | 핵심 스킬이 새 코드 전에 기존 코드 → 표준/플랫폼 → 설치된 의존성 순으로 재사용을 확인하게 한다 | 사실 — "The smallest complete change" 1~6단계 | [skills/ponytail/SKILL.md](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/skills/ponytail/SKILL.md) |
| U3 | 호출부·테스트·픽스처까지 마무리하게 한다 | 사실 — "finish every part the task needs, including the callers, tests and fixtures" | 같은 파일 |
| U4 | 신뢰 경계 검증·데이터 손실 방지·보안·접근성·사용자 요구는 줄이지 않는다 | 사실 — "Never cut:" 줄 | 같은 파일 |
| U5 | "가장 짧은 diff" 를 선호하는 문구가 있다 | 사실 — "The shortest working diff wins, once you know everything it must touch" (조건절이 붙어 있다) | 같은 파일 |
| U6 | 비단순 로직에 작은 테스트 또는 assert 를 남기게 한다 | 사실 | 같은 파일 |
| U7 | 세션 전체에 지속되는 모드다 | 사실 — "Active for the whole session until the user says 'stop ponytail'". 설명문은 "Use on any coding task" | 같은 파일 |
| U8 | 리뷰 스킬은 diff 밖 호출부·데이터 흐름을 읽고, 지적마다 구체 사례를 요구한다 | 사실 — "A change can break code it does not touch… grep every caller" · "No case, no finding" | [skills/ponytail-review/SKILL.md](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/skills/ponytail-review/SKILL.md) |
| U9 | 감사 스킬은 저장소 전체의 결함·위험·복잡성을 조사한다 | 사실 | [skills/ponytail-audit/SKILL.md](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/skills/ponytail-audit/SKILL.md) |
| U10 | 부채 스킬은 `shortcut:` 주석에서 한계·재검토 조건을 모은다 | 사실 | [skills/ponytail-debt/SKILL.md](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/skills/ponytail-debt/SKILL.md) |
| U11 | 훅이 세션 시작·재개·압축, 사용자 입력, 서브에이전트 시작에 걸린다 | 사실 — SessionStart(`startup\|resume\|clear\|compact`) · UserPromptSubmit · SubagentStart | [hooks/claude-codex-hooks.json](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/hooks/claude-codex-hooks.json) |
| U12 | 기본값으로 모든 서브에이전트에 같은 지침을 주입한다 | 사실 — `PONYTAIL_SUBAGENT_MATCHER` 미설정이면 전부 주입 | [hooks/ponytail-subagent.js](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/hooks/ponytail-subagent.js) |
| U13 | Band 작업 기록이 기본 켜짐, 홈 디렉터리에 저장, webhook 기본값은 비어 있다 | 사실 — `ledger` 기본 true → `~/.config/ponytail/band/<project>.csv`, `webhookUrl` 기본 "" | plugin.json(U1) |
| U14 | (계획서 미언급) 세션 시작 훅이 `~/.claude/.ponytail-active` 플래그를 쓰고, 코드베이스 지도(`ponytail-map.js`, 3초 제한)를 매 세션 주입한다 | 사실 — 계획서 D7 "코드 탐색 보조 기능"의 실체 | [hooks/ponytail-activate.js](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/hooks/ponytail-activate.js) |
| U15 | 벤치마크: Opus 5.5 · CLI 2.1.288 · 39과제 · 조건당 5회 | 사실 | [benchmarks/results/2026-10-07-agentic.md](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/benchmarks/results/2026-10-07-agentic.md) |
| U16 | 줄 수 -53% · 출력 토큰 -45% · 비용 -26% · 시간 -41% (과제별 중앙값 비율의 기하평균) | 사실 | 같은 파일 |
| U17 | 테스트 필요 과제의 테스트 존재 68% → 98%, 숨김 검사 86/90 → 87/90 | 사실. 덧붙여 "테스트가 있는 칸에서 주입 버그 검출률"은 no skill 77% > Ponytail 5 69% — 테스트 수는 늘고 한 개당 강도는 낮다 | 같은 파일 |
| U18 | 모든 조건에서 Bash 를 막은 코드 작성 실험이다 | 사실 — "Bash is disabled for every arm… This measures what the agent writes, not what it can debug" | 같은 파일 · [benchmarks/agentic/README.md](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/benchmarks/agentic/README.md) |
| U19 | 21과제 완결성 판정은 LLM 이 하며 성능·보안을 제외한다 | 사실 — "Judge COMPLETENESS ONLY -- ignore over-engineering, style, performance, and security" | [benchmarks/agentic/complete.py](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/benchmarks/agentic/complete.py) L42 |
| U20 | open/vibe 후보군에 "유리한 후보만 남긴다"는 주석이 있다 | 사실 — "screened baseline-vs-ponytail, keep the clear winners" | [benchmarks/agentic/tasks.py](https://github.com/DietrichGebert/ponytail/blob/96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/benchmarks/agentic/tasks.py) L1493 |
| U21 | 격리: 세션마다 `CLAUDE.md` 로딩·자동 메모리를 끈 상태 | 사실 — 즉 **비교 대상은 "지침 없는 Claude Code"이지 하네스가 깔린 프로젝트가 아니다** | U15 와 같은 파일 |
| U22 | 재사용 과제(`reuse-money` · `reuse-slug`)에서 차이 | (계획서 미언급) 줄 수 9/9/9 · 20/19/21 — **재사용 과제에서는 지침 없는 기준선도 이미 같은 결과**였다. 큰 차이는 기능 티켓·"앱 만들어줘" 류의 범위 선택에서 났다 | 같은 파일 Per task 표 |

거짓으로 판정된 상류 주장은 없다. 계획서가 놓친 사실은 U14 · U17 후반 · U21 · U22 다.

## 3. 제안별 판정

| ID | 제안 | 하네스가 이미 덮는가(파일) | 설치자 이득 | 비용 | 판정 |
|---|---|---|---|---|---|
| D1 | Ponytail 플러그인 기본 설치 | 목적 중복 — `templates/CLAUDE.md` §2 "simplest sufficient solution" · §3 "keeping … speculative future capabilities outside the task" | 하네스 위에서의 추가 이득 미측정(U21) | 훅 3종이 매 세션·매 프롬프트·매 서브에이전트에 지침과 코드 지도를 주입(U11·U12·U14) — 하네스 리뷰어·구현자 레인에도 같은 "최소주의" 성향이 들어간다. 홈 디렉터리 기록(U13). `plugin` 방식은 Claude Code 전용 | **REJECT** — 측정되지 않은 상시 주입을 모든 설치자에게 얹는다 |
| D2 | 선택형 카탈로그 등록(`src/external-assets.ts`) | 위와 같음. 리뷰는 `templates/agents/reviewer.md` + Claude Code 내장 `/code-review`(`src/manifest.ts` L219), 저장소 감사는 `templates/skills/audit-service-gaps`(correctness 렌즈) | 미측정. 계획서 §3.3 이 감사 대응물로 든 `audit-harness-fit` 은 대상이 다르고, 실제 대응물은 `audit-service-gaps` 다 | 스킬만 깔아도 설명문이 "Use on any coding task"(U7)라 거의 모든 코딩 요청에서 발화한다 → 앵커 §3 "Prefer a coherent solution over an arbitrarily small diff" 와 U5 "shortest working diff wins" 가 같은 세션에서 경쟁. opt-in 이라 고르지 않은 설치자에게는 영향이 없다(ADR-114 의 논리) | **REJECT(보류)** — 재검토 조건: 설치자가 하네스 앵커가 있는 상태에서도 과잉 구현을 반복 관측하거나, 하네스 위 A/B 결과가 나올 때 |
| D3 / P1-B | 리뷰어 Step 4 "변경되지 않은 코드의 이슈는 CRITICAL 보안 문제가 아니면 건너뛴다" 를 "이번 변경 때문에 깨진 곳은 포함" 으로 교체 | **덮지 않는다.** `templates/agents/reviewer.md` L40 · `.claude/agents/reviewer.md` L40. #798(`docs/plans/798-reviewer-slim-judgment.md` #5)이 "호출 사이트 읽기"를 방법 지식으로 지우고 이 제외 줄(#22)만 "범위 계약"으로 남겨, 지금 리뷰어 본문에서 diff 밖 코드에 관한 지시는 "건너뛴다" 하나뿐이다. 같은 파일 Step 2 는 정확성 위험을 블로커로 정의한다 — 두 줄이 충돌한다 | 함수의 반환값·동작을 바꿨는데 고치지 않은 호출부가 깨지는 흔한 경우에, 리뷰어가 그것을 "변경 안 된 코드"로 보고 넘기는 해석이 사라진다. 상류 U8 이 같은 지점을 명시한다. **관측된 누락 사고는 없다** — 문구 충돌이라는 사실만 확인됐다 | `CORE_AGENTS = ["reviewer"]`(`src/manifest.ts` L177)라 모든 설치자에게 간다. 상주 아님(호출 때만 읽힘), 한 줄 교체라 크기 변화 미미. 무관한 기존 결함은 계속 범위 밖 | **ADAPT** — 제안 B 만, 한 줄 교체로 |
| P1-A | 리뷰어 Step 1 에 "영향 받는 호출 흐름·계약·검증 근거도 함께 확인" 추가 | Step 2 "위험을 어디서 찾을지는 변경의 종류가 정한다" 가 덮는다 | B 가 제외 줄을 고치면 추가 이득 없음 | #798 이 방법 지식으로 판정해 지운 문장을 되살린다 | **REJECT** — B 로 충분 |
| D4 / P2 | `templates/CLAUDE.md` §2 에 "새 코드·의존성 전에 기존 기능·플랫폼·설치된 의존성 확인" 추가 | 부분 — §2 "simplest sufficient solution" · `templates/agents/implementer.md` "읽고 나서 쓴다. 바꿀 심볼의 호출부와 export 를 먼저 본다" | 관측 없음. 상류 벤치마크에서도 재사용 과제는 지침 없는 기준선과 결과가 같았다(U22) | 앵커는 CLAUDE.md 와 AGENTS.md 로 **매 세션 상주**(Codex AGENTS.md 예산 공유). NORTH_STAR §1 "상주의 근거 = 관측" 미충족 | **REJECT** — 계획서도 "실제 공백이 있을 때만"이라 했고 그 공백의 관측이 없다 |
| D5 / P3 | `templates/rules/change-management.md` 에 "절충의 한계·재검토 조건 기록" 추가 | 부분 — 같은 파일이 이후 작업에 영향을 주는 결정을 기록하게 하고, ADR 양식에 Consequences 가 있다 | 관측 없음 | `change-management` 는 `paths:` 없는 룰이라 매 세션 상주 | **REJECT** — 상주 근거 없음. `shortcut:` 주석 관례·부채 장부도 들이지 않는다(기준 기록 하나 원칙, `doc-governance`) |
| D6 / P4 | 구현자 지침(종료 조건 · 편집 직후 테스트 · 시키지 않은 파일이면 멈춤)과 앵커의 긴장 정리 | — | Ponytail 과 무관한 별건. "시키지 않은 파일이면 멈춤"은 위임 범위 유지(전역 원칙 6)와 맞는 레인 경계라 긴장 주장 자체가 약하다 | — | **REJECT(이 이슈 범위 밖)** — 실제 불필요한 정지가 관측되면 별도 이슈로 |
| D7 | Band/Board 기록 · 코드베이스 지도 | 하네스는 비용 계측을 `src/context-cost.ts` 로 하고 외부 자산은 `unmeasured` 로 표기한다(계획서 H11 주장 사실) | 설치자가 하네스로 개발을 더 잘하게 되는가와 직접 관계 없음(Band = 비용 대시보드) | 매 세션 주입 · 홈 디렉터리 쓰기 · Claude Code 전용 훅. ADR-114 가 자체 설치기의 훅 배선을 기각한 것과 같은 축 | **REJECT** |
| D8 | 대표 업무 A/B 측정 | — | D2 를 다시 열 때의 재검토 조건으로만 의미 | 유료 실행 · 설계 비용 | **REJECT(지금 착수 안 함)** — D2 재검토 시에만 |

계획서 진술 중 정정이 필요한 것: §3.3 의 대응 자산은 `audit-harness-fit` 이 아니라 `audit-service-gaps`(저장소 결함 탐색) 와 Claude Code 내장 `/code-review` 다. 결론(합치지 않는다)은 같다.

## 4. 권장 변경 (최소 집합)

**하나만 한다.**

| 대상 파일 | 변경 | 이유 |
|---|---|---|
| `templates/agents/reviewer.md` L40 | `- 변경되지 않은 코드의 이슈는 CRITICAL 보안 문제가 아니면 건너뛴다.` → `- 이번 변경과 무관한 기존 코드의 이슈는 CRITICAL 보안 문제가 아니면 건너뛴다. 고치지 않은 코드라도 이번 변경 때문에 깨지거나 새로 닿게 된 곳은 이번 변경의 이슈다.` | 설치자의 리뷰어가 "변경으로 깨진 호출부"를 범위 밖으로 넘기지 않게 한다. Step 2 블로커 정의와의 충돌을 없앤다. 무관한 기존 결함을 범위 밖에 두는 원래 목적(#798 #22 "범위 계약")은 유지 |
| `.claude/agents/reviewer.md` L40 | 같은 한 줄 | 개발 사본도 같은 충돌을 갖는다(두 파일은 description 한 단어만 다르다) |

진행 메모(구현 레인용):
- 머지 문턱: 설치자 디스크·릴리즈 배선을 바꾸지 않는 문구 변경이라 `test-policy` §시점별 검증상 독립 리뷰 대상 밖 — 리그레션만. 영향 범위 테스트는 `templates/agents/` · `.claude/agents/reviewer.md` 를 경로로 읽는 게이트(`tests/baseline-targets.test.ts` 등 manifest 경유)와 비용 게이트(`north-star-cost-figures` · `resident-cost-honesty` · `baseline-targets` · `resident-rule-reference-liveness` · `context-cost-ratchet`). 리뷰어 문구를 축자로 고정한 테스트는 찾지 못했다(`grep -rn "건너뛴다\|CRITICAL 보안" tests` — 해당 줄 0건, 같은 grep 이 무관한 "건너뛴다" 줄을 여럿 잡아 탐지기는 작동).
- `change-management` §자산 규칙대로 커밋에 이유와 `#963` 을 남긴다. 다른 자산은 함께 고치지 않는다.
- 효과는 "문구 충돌 해소"까지만 주장한다. 리뷰 품질이 올라갔다는 관측은 아직 없다.

하지 않는 것: Ponytail 설치·카탈로그 등록, 앵커(`templates/CLAUDE.md`)·상주 룰 문구 추가, `shortcut:` 관례, Band/코드 지도, A/B 실험.

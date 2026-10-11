# ADR-109: 외부 모델 토론 · 브라우저 위임 스킬 편입 — 책임 경계 · 기본/opt-in · 브라우저 전제는 CLI 가 정한다

- Status: Proposed
- Date: 2026-10-12
- PR: #759
- Issue: #729
- Amends: ADR-105 결정 2 의 "has-dev-track 수단" 범주(external-model-consult · natural-korean 와 같은 부류)에
  multi-model-debate 를 더한다. #489 가 agent-browser 를 opt-in 으로 내린 논거(외부 전제 · 설치 비용)를 브라우저 위임 3종에 재사용한다.
- 설계 문서: `docs/plans/v26.168.0-model-routing-design.md` §5.1–5.8 · §6 PR-C · 검증 `docs/plans/v26.168.0-model-routing-design-verify.md`

## Context

#729 는 여러 실제 모델로 한 주제를 독립 분석 · 반박 · 검증하는 `multi-model-debate` 와, 사용자의 로그인된 일반 Chrome 으로
Gemini · ChatGPT · Genspark 웹에 일을 맡기는 `gemini-delegate` · `chatgpt-delegate` · `genspark-delegate` 를 첨부했다.
첨부본에는 한 계정의 UI 라벨과 선호(모델명 · 사고 강도 기본값 · 개인 설치 배치)가 descriptor 와 기본값으로 고정돼 있었고,
하네스는 낯선 설치자에게 나간다.

브라우저 위임의 실행 전제는 하네스 밖에 있다(공식 문서, 조회 2026-10-11):

| 표면 | 스킬 발견 | 브라우저 위임 |
|---|---|---|
| Claude Code CLI · Desktop Code 탭 | 문서 | 문서 — Claude in Chrome 확장 ≥ 1.0.36 · Anthropic 직접 플랜 · `/login` 세션 |
| Codex CLI · IDE 확장 | 문서 | 문서 — **불가**("Browser isn't available in Codex CLI or the Codex IDE extension") |
| Codex 앱 | 문서 | 문서 — Computer Use 의 Chrome 확장. 내장 Browser 는 별도 프로필 |
| OpenCode · Antigravity | 리포(`.agents/skills/` 에 놓인다) | **미확인** |

## Decision

1. **책임 경계** — 토론 정책(참여자 · 독립성 · 라운드 · 예산 · 재시도 · 대체 · 주제 복귀 · 통합)은 `multi-model-debate` 만 소유한다.
   위임 스킬과 `external-model-consult` 는 일반 실행 매개변수(모델 · 프롬프트 · 세션 · 대기 상한)와 결과 · 상태 반환만 맡는다.
2. **기본/opt-in**(사용자 결정 2026-10-12, 설계 §7-1 ⓐ) — `multi-model-debate` 는 `has-dev-track`(브라우저 전제가 없다 — 기본
   설치의 external-model-consult CLI 둘만으로 서로 다른 실제 모델 2개가 성립한다). 브라우저 위임 3종은 `opt-in`(`--with <id>` ·
   위저드 체크). 넷 다 `INTERNAL_BUNDLED_SKILL_IDS` 에 넣고 `DEV_METHOD_SKILL_IDS` · `CONTINUOUS_SKILLS` 에는 넣지 않는다(수단 · 작업형).
3. **브라우저 전제는 CLI 가 정한다** — 하네스는 네 CLI 자리에 디렉터리를 복사할 뿐이고, 실행 가능 여부는 그 런타임의 도구가 정한다.
   스킬 본문은 "현재 런타임에 도구가 있는지 먼저 확인 · 없으면 `unavailable_tool`" 로 쓰고 위 표의 문서/미확인 구분을
   `multi-model-debate/references/adapters.md` 에 둔다.
4. **계정 사실은 고정 배포하지 않는다** — descriptor 는 영어 + 한국어 트리거로 쓰고 모델명을 뺀다. 위임 스킬의 기본값은 구조로만
   적는다(gemini: 현재 메뉴의 빠른 모델 + 고성능 모델 · chatgpt: Latest 한 모델 · genspark: 서로 다른 계열 2개). 사고 강도는 세
   스킬 모두 "지정이 없으면 현재 설정 유지 + 실제 값 기록". 날짜 붙은 UI 관찰 문단은 "보장하지 않는다" 표기와 함께 남긴다.
5. **사용자 범위** — 하네스는 사용자 범위(`~/.claude/skills` · `~/.agents/skills`)에 깔지 않는다(ADR-097 결정 6). #729 AC 의
   "프로젝트 밖에서도 사용자 범위 발견" 은 스킬이 상대 참조만 써서 **어디에 복사해도** 성립하는 것으로 충족하며, 사용자 범위
   설치 · 발견 자체는 설치자의 수동 복사(또는 `npx skills add -g`)와 그 CLI 의 발견 규칙 몫이다 — 정적 확인만 했다.

## Alternatives (기각)

- **넷 다 기본** — 모든 개발 트랙 설치자가 브라우저 위임 descriptor 3개를 매 세션 상주시키고, Codex CLI · OpenCode · Antigravity
  설치자 다수는 실행할 수 없는 능력을 받는다. 로그인된 브라우저로 서드파티에 쓰고 유료 사용량을 쓰는 능력을 묻지 않고 깔게 된다.
- **넷 다 opt-in** — 토론 스킬은 브라우저 전제가 없어 기본 설치만으로 돈다. 사용자의 "uzys 스킬은 대부분 기본"(#726)과 어긋난다.
- **위임 3종의 공통 골격을 한 참조로 추출** — 첨부 원본 존중과 "자산은 자기 변경 요청 없이 건드리지 않는다" 로 하지 않았다.
  세 파일이 따로 썩을 위험은 남는다(첫 drift 관측 뒤 재검토).
- **개발 사본 `.claude/skills/` 에도 추가** — 이 리포는 호스트 실 CLI 실행이 막혀 쓸 일이 없고, SSOT 는 `templates/`(ADR-062).

## Consequences

- **상주 비용(tooling, `npm run cost:report`)**: 발화 표면 15개 ~1,698 → 16개 ~1,842(+1개 +144), 지시문 축 변화 없음(8개 ~3,801),
  합계 23개 ~5,499 → 24개 ~5,643. 다른 개발 트랙도 같은 +1개 +144. 브라우저 3종은 opt-in 이라 트랙 상주에 들지 않지만
  `context-cost-baseline.json.skillDescriptors` 에는 번들 전부로 등재된다(상한 ratchet 모집단).
- **기존 설치본**: 설치 기록에 개발 트랙이 있으면 `update` 한 번으로 `multi-model-debate` 를 `.claude/skills/` 와 `.agents/skills/`
  양쪽에 받는다(#480 ① · #530 S3 기존 경로, 누적 `excluded` 존중 — `--without multi-model-debate` 기록이면 받지 않는다).
  브라우저 3종은 기록에 없으므로 `update` 가 깔지 않는다. 이미 `--with` 로 깐 것은 갱신한다.
- **사이드카**: `references/*.md` 4 · `agents/openai.yaml` 은 기존 디렉터리 복사가 네 CLI 자리에 나른다(코드 변경 없음).
  `agents/openai.yaml` 은 Codex 앱 UI 메타이고 Claude Code 는 모르는 디렉터리로 무시한다(일반 동작에서의 유추 — 명시 문서 없음).
- **실행 가능 ≠ 설치 성공**: 실제 브라우저 위임 · 실제 토론 · provider CLI 실호출은 검증하지 않았다(Docker 는 파일 안착만 본다).
  CHANGELOG 에 "미검증" 으로 적는다(ship-checklist Surface Parity).
- SPEC Non-Goals("기본 설치 항목 재정의")에 닿으므로 SPEC Change Log 에 Major 로 남긴다.

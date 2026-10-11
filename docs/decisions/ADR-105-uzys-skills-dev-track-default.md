# ADR-105: uzys 자작 4종을 개발 트랙 기본으로 — ci-scaffold opt-in 계약 개정

- Status: Accepted
- Date: 2026-10-11
- PR: #745
- Issue: #726
- Amended by: ADR-109 (결정 2 의 has-dev-track 수단 범주에 multi-model-debate 추가 — #729)
- Amends: ADR-037 §3ⓐ(ci-scaffold opt-in 전용 → 개발 트랙 기본) · ADR-034 §2 · §4(수단 계층 opt-in · "외부 CLI 의존 pre-check 승격 안 함"을 model-orchestration · external-model-consult 에 한해 뒤집는다)

## Context

사용자 결정(2026-10-11, 이슈 #726 댓글): 하네스 자작 ci-scaffold · model-orchestration · external-model-consult · natural-korean 을
개발 트랙에서 기본 체크한다. tauri-desktop 은 opt-in 으로 둔다.

이 코드베이스에는 "위저드에서만 미리 체크하고 비대화형에서는 안 까는" 범주가 없다 — 위저드 미리 체크(`recommendedExternalAssets`)와
비대화형 기본 설치(`shouldInstallAsset`)가 같은 `condition` 에서 나온다.

## Decision

1. 네 자산의 `condition` 을 `{ kind: "has-dev-track" }` 로 바꾼다(base · csr-* · ssr-* · data · tooling · full. executive ·
   project-management · growth-marketing 제외). 새 범주를 만들지 않는다. 빼려면 `--without <id>` · 위저드 체크 해제.
2. `DEV_METHOD_SKILL_IDS` 에는 넣지 않는다. 그 목록은 설치 여부를 정하지 않고(설치 선택 = `INTERNAL_BUNDLED_SKILL_IDS` + 각
   condition) 문서 수치 · 테스트가 쓰는 "방법론" 분류다 — external-model-consult(외부 모델 호출 도구) · natural-korean(글쓰기 규율)은
   ADR-034 의 방법론 코어가 아니라 수단이다. 반례도 이미 있다(self-hosted-github-runner 는 has-dev-track 이지만 런북이라 목록 밖).
3. ci-scaffold 는 **없을 때만 쓴다**(ADR-037 §3ⓑ 그대로) · uninstall 은 `.github/` 를 지우지 않는다(§3ⓒ — 현행은 `rootFiles` 에
   기록하되 안내만 한다. ADR-037 의 "install-log 미기록" 문구는 그 뒤 바뀌었고, ADR-097 결정 5 가 스캐폴드를 "넘겨준 산출물"로
   못박았다). 바뀌는 것은 §3ⓐ 하나다.

## Alternatives (기각)

- **"위저드 미리 체크만" 범주 신설** — 비대화형 `install --track <개발 트랙>` 이 위저드와 다른 결과를 내게 된다. 같은 선택이 진입점마다
  달라지는 것이 이 리포가 여러 번 고친 결함이다.
- **`DEV_METHOD_SKILL_IDS` 에 넣기** — 설치 결과는 같은데 COMPATIBILITY 서문 "dev-method N종" · 시나리오 · 문서 수치가 함께 움직이고,
  분류의 뜻(방법론)이 흐려진다.
- **기존 설치본은 update 로 받지 않게 예외** — 릴리즈가 새로 기본에 넣은 번들 스킬은 update 가 깐다는 기존 규칙(#480 ① · #530 S3)에
  경우별 예외를 더하게 된다(루트 CLAUDE.md "설치자 디스크는 한 원칙으로").

## Consequences

- **상주 비용(tooling, `npm run cost:report`)**: 발화 표면 12개 ~1,393 → 15개 ~1,698(+3개 +305), 지시문 축 변화 없음(8개 ~3,801),
  합계 20개 ~5,194 → 23개 ~5,499. 다른 개발 트랙도 같은 +3개 +305(`context-cost-baseline.json`). model-orchestration 은
  `CONTINUOUS_SKILLS` 라 깔리면 프로젝트 맥락 블록에 상시 안내 한 줄이 들어간다 — 이 줄은 위 측정에 들지 않는다.
- **기존 설치본**: 설치 기록에 개발 트랙이 있는 모든 설치본이 update 한 번으로 model-orchestration · external-model-consult ·
  natural-korean 을 받는다 — Claude 자리 `.claude/skills/<id>/` 는 `installNewSkillDirs`(#480 ①), Codex · OpenCode · Antigravity 공유
  자리 `.agents/skills/<id>/` 는 `agents-skill-targets.ts`(#530 S3). 둘 다 누적 `excluded` 를 지킨다(ADR-099 R3). 화면은 "added by
  this release".
- **ci-scaffold**: 새 설치(개발 트랙)마다 설치자 저장소의 `.github/workflows/` 에 트랙별 템플릿이 **없을 때만** 생긴다(node `ci.yml` ·
  python `ci-python.yml` · UI 트랙 `e2e.yml`. `base` 는 node 폴백). 트리거는 태그 `v*` + `workflow_dispatch` 뿐이고 설치자가 커밋해야
  돈다. `update` 는 ci-scaffold 를 돌리지 않으므로 기존 설치본은 `install` 을 다시 해야 생긴다.
- **external-model-consult**: 설치는 디렉터리 복사뿐이라 provider CLI(agy · codex)가 없어도 첫 설치는 성공한다. 없거나 로그인이 끊기면
  실행 시점에 래퍼가 멈추고 스킬이 "설치 · 로그인은 사용자 몫"을 알린다. 남는 비용은 descriptor 상주와, CLI 가 없는 설치자에게 발화해도
  안내만 돌아온다는 것.
- **natural-korean**: 한국어를 쓰지 않는 설치자에게도 깔린다(카탈로그 주석이 "낭비"라 적었던 대가를 사용자가 받아들였다).
- natural-korean 과 external-model-consult 의 descriptor 가 둘 다 "자연스럽게 다듬어줘"를 들어, 전에는 둘 다 고른 사람만 겪던 트리거
  겹침을 모든 개발 트랙 설치자가 겪는다. 스킬 본문 · descriptor 는 자산별 변경 요청으로 따로 다룬다(change-management §자산).
- SPEC Non-Goals("기본 설치 항목 재정의 — G 사이클")에 닿으므로 SPEC Change Log 에 Major 로 남긴다.

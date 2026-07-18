# ADR-039: 오피셜 플러그인 큐레이션 배치 — 3종 opt-in + context7·claude-md-management 미등록

- Status: Accepted
- Date: 2026-07-18
- PR: #223
- Context: 사용자 제안(2026-07-18) — claude-plugins-official 의 고설치 플러그인 6종
  (frontend-design·code-review·context7·claude-md-management·feature-dev·security-guidance)을
  "개발 기본설치" 후보로 검토 요청. frontend-design 은 v26.92.0 부터 이미 기본. 나머지 5종을
  marketplace repo 실물(commands/agents/skills/hooks 구성) 기준으로 판정. 최초 추천안(context7
  기본 + 3종 opt-in + 1종 기각)을 사용자가 AskUserQuestion 으로 승인했으나, 구현 중 **context7
  이 이미 기본 제공됨을 발견해 정정** (아래 Decision 2).
- Decision:
  1. **code-review·feature-dev·security-guidance = opt-in** (dev-tools/workflow/dev-tools).
     - code-review: `/code-review` 커맨드 1개 — 기본 리뷰 스택(reviewer·code-reviewer·
       security-reviewer)과 표면 중복 + 최신 Claude Code 네이티브 `/code-review` 와 충돌 소지.
     - feature-dev: 방법론류(전용 에이전트 3종 + 워크플로우) — ADR-032 "워크플로우 강제 구조는
       기본 불필요" + 자체 code-reviewer 가 기본 에이전트와 중복. superpowers 와 동급 opt-in.
     - security-guidance: 훅 12파일(매 편집 패턴 경고 + LLM diff 리뷰, Python·Agent SDK 의존) —
       상시 훅 비용/폭발 반경 실측 전 기본설치는 Context Cost NSM 역행. 실측 후 승격 재검토.
  2. **context7 플러그인 = 미등록 (정정)**. 최초 판정 "카탈로그 공백(문서 조회)"은 오류 —
     `templates/mcp.json`(claude `.mcp.json`)·`templates/codex/config.toml.template`·opencode
     설정이 이미 `@upstash/context7-mcp` 를 **기본 wiring** 하고 있었다 (카탈로그가 아닌 MCP
     템플릿 계층). 플러그인 추가 = 동일 서버 중복 등록이며 도달 범위도 더 좁다(plugin=
     claude-only vs 템플릿=3-CLI). 사용자 의도("문서 조회 기본 제공")는 기충족. 교훈: 자산 중복
     검사는 카탈로그(external-assets)만이 아니라 **MCP 템플릿·manifest 계층까지** 봐야 한다.
  3. **claude-md-management = 기각** (카탈로그 미등록). 3중 충돌: ① ADR-025 fill-in 스캐폴드
     ("자동채움 없음"은 의도된 결정 — 외부 도구가 하네스 설치 CLAUDE.md 를 재작성하면 하네스
     규칙 drift 경로) ② continuous-learning-v2(세션 학습 캡처 동일 기능 기설치)
     ③ harness-health-audit(CLAUDE.md 품질 감사 기설치). Rule 7 — 충돌은 평균내지 않고 한쪽 선택.
  4. 판정 축 = "오피셜(tier) ≠ 기본설치 근거". 기본설치 축은 **갭 충족 + 상시 비용 정당**
     (ADR-032/035). 카탈로그 62 → **65** (기본 발자국 무변경 — 신규 전부 opt-in).
- Alternatives:
  - **5종 전부 기본설치 (원제안)**: 기각 — 리뷰 표면 3중복 + 상시 훅 비용 미실측 + ADR-025/032
    기존 결정과 충돌. 충돌 지점을 supersede 할 근거(실측/사용 신호) 없음.
  - **context7 를 기본 플러그인으로 등록 (최초 추천안)**: 정정 기각 — 기본 제공이 이미 더 넓은
    범위(3-CLI)로 존재. 중복 등록은 동일 서버 2회 로드 리스크만 추가.
  - **claude-md-management 를 경고 문구와 함께 opt-in**: 기각 — opt-in 이어도 CLAUDE.md 편집
    권한을 가진 경쟁 도구를 하네스가 직접 배포하는 것 자체가 자기 제품 표면(설치된 CLAUDE.md)의
    무결성과 상충. 필요 사용자는 marketplace 에서 직접 설치 가능(차단이 아니라 비추천).
- Consequences:
  - 기본 설치 발자국 무변경 — 신규 3종은 wizard/`--with` opt-in 으로만 도달. wizard 노출은
    카테고리 derive 라 코드 변경 없이 자동.
  - 신규 3종 설치 가능성은 Docker 실 claude 2.1.214 로 실증(marketplace add + install 3/3
    exit 0, 2026-07-18). 플러그인 **런타임 동작**(커맨드 실행·훅 발화)은 미검증 — 설치 가능성
    까지가 검증 범위. security-guidance 는 런타임에 Python·Agent SDK 의존이 별도로 필요함을
    description 에 표기.
  - 미등록 기록이 카탈로그 부재의 근거 문서가 된다 — "왜 context7/claude-md-management 없나"의
    답은 본 ADR (재검토 트리거: context7 = MCP 템플릿 wiring 철회 시 / claude-md-management =
    ADR-025 fill-in 철학 변경 시).

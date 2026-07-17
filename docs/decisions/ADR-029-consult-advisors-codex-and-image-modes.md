# ADR-029: consult advisor 가족 — codex-consult 신설 + 이미지 모드 + OpenCode 실행 불능 fix

- Status: Accepted
- Date: 2026-07-17
- PR: #205
- Context: 사용자 요청 2건 — ① "codex는 글을 간결 명료하게 정리·구조화 잘하고 이미지 생성도 있다.
  이 능력을 살려 Claude Code 와 협업하는 스킬" ② "gemini-consult 도 agy 이미지 생성을 활용".
  출하 전 5-페르소나 독립 패널(실행자/보안/라우팅/크로스-CLI/비용, Sonnet 티어) 리뷰를 강제.

## Decision

1. **`codex-consult` = gemini-consult 의 형제 자산** (opt-in internal bundled, official/uzys,
   dev-tools). 분업을 양쪽 SKILL.md description 에 상호 명시: 한국어 뉘앙스·카피·외부 페르소나
   → gemini / 간결·구조화·기본 이미지 → codex. 이미지 생성은 **양쪽 다 실측 검증** — 기본은
   codex(OS 샌드박스 + OUT_DIR 직출력), Gemini/Nano-Banana 스타일 요청 시 gemini.
2. **gemini 이미지 모드는 권한 우회 없이** — headless agy 는 셸 저장에 필요한 "command" 권한을
   auto-deny 하지만, 생성 도구 자체는 무권한으로 성공하고 산출물이
   `~/.gemini/antigravity-cli/brain/<대화ID>/` 에 남는 것을 실측. 래퍼가 marker(`find -newer`)로
   수거한다. `--dangerously-skip-permissions` 는 스킬 본문에서 금지 명문화 — agy 는 OS 샌드박스가
   없어 권한 시스템이 곧 샌드박스이고, 이 flag 는 harness-health-audit 의 안전 렌즈가 잡는 바로
   그 패턴이다.
3. **OpenCode `agent` 는 scripts/ sidecar 로 derive** — `renderCommandFromSkill` 의 블랭킷
   `agent: plan` 이 bash 전용 consult 커맨드를 no-op 으로 만들었다(v26.95.0 실버그, 패널
   CONFIRMED: 같은 설치가 쓰는 opencode.json.template 이 plan 에 `bash: false`). 셸 의존 스킬
   목록을 하드코딩하지 않고 **번들 scripts/ 디렉토리 존재 = 셸 의존**이라는 구조 신호로 derive
   → `agent: build`. 게이트 `tests/opencode-shell-agent.test.ts` (RED 실증).
4. **래퍼 v2 공통 하드닝** (패널 P0/P1 반영, 두 래퍼 패리티): portable timeout — GNU timeout
   의존 제거. 1차 구현(함수 백그라운드 + watcher)은 **2차 검증 패스가 스텁 재현으로 반증**
   ($! = 래핑 서브셸 → kill 이 실 프로세스를 못 죽이고 고아화) → 명령 직접 백그라운드 + 메인 셸
   poll 루프(watcher 프로세스 자체 제거) + TERM→KILL 로 재구현. 그 외: `env -i` 허용목록
   (read-only 샌드박스는 읽기를 안 막음 → ambient 토큰 미전달) · 시크릿-형태 프롬프트 거부
   (exit 4, sk- 패턴은 토큰 경계 요구 — 케밥 텍스트 오탐의 FP-피로가 우회 상습화 경로) ·
   `<untrusted-*-output>` 태그(정책이 아니라 구조로 경계 표시) · 후행 플래그 fail-loud ·
   OUT_DIR clobber 가드 + `$HOME`/`/` 거부(`cd -P`/`pwd -P` 물리 해석 — 심링크 우회 반증 반영) ·
   이미지 모드 산출물 0개 = exit 5(fail loud) · `## On failure`(blind-retry 금지).

## Alternatives

- **codex 기능을 gemini-consult 에 합쳐 단일 "llm-consult"** — 기각: 트리거 라우팅이 흐려지고
  (라우팅 페르소나의 핵심 우려), 한쪽 CLI 부재 시 반쪽 자산이 된다. 자산 분리 + 상호 경계 문구가
  ID-단위 opt-in(--with) 과도 정합.
- **agy 이미지를 settings.json allow-rule 로 해결** — 기각: `~/.gemini/` 호스트 글로벌 설정
  write 는 이 repo 검증 금지 영역이고, 사용자에게 권한 완화를 요구하는 설치 자산은 안전 후퇴.
  brain-수거는 권한 표면을 넓히지 않는다.
- **셸 의존 스킬 id 하드코딩 목록** — 기각: no-false-ship "동일 목록 2곳 이상 = derive 단일화".
  scripts/ 존재가 이미 구조적 SSOT.

## Consequences

- 카탈로그 60 → 61 (문서 5표면 게이트가 derive 로 강제, 이번에도 RED→갱신).
- OpenCode 의 dev-method 8종은 종전대로 `agent: plan`(읽기 중심 — 의도 유지), consult 2종만
  `agent: build`.
- (a) 미검증 잔여: codex 로그아웃 상태의 실제 auth-failure 문구(SKILL.md 에 "미검증" 명시),
  Linux/OpenCode 실 CLI 에서의 native 커맨드 로드(기존 COMPATIBILITY 🟡 templates 정직화와 동일
  범주 — install-matrix 는 파일 배치까지).
- (b) brain-수거는 agy 내부 경로 계약에 의존 — agy 업데이트로 경로가 바뀌면 `-g` 가 "no image
  artifacts" 경고로 fail-loud (silent 아님). env `GEMINI_CONSULT_BRAIN` 으로 즉시 복구 가능.
- (c) 동시 실행 agy 세션이 같은 시간창에 이미지를 만들면 `-g` 수거에 섞일 수 있음(래퍼 주석
  공개, 파일명으로 식별 가능 — 희귀 케이스 수용).

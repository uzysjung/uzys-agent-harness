# ADR-050: 설치 로그를 `.claude/` 밖으로 (`.uzys-agent-harness/`)

- Status: Accepted
- Date: 2026-07-26
- PR: #254
- Issue: [#253](https://github.com/uzysjung/uzys-agent-harness/issues/253)

## Context

사용자 보고(#253): **오픈코드로만 설치했는데 `{prj}/.claude/.harness-install.json` 이 생겼다.
논리적이지 않다.**

설치 로그는 CLI 중립이다 — 어떤 CLI 를 골랐든 한 벌만 쌓이고, `list`·`uninstall`·`update` 가
그걸 읽는다. 그런데 위치는 `.claude/` 로 하드코딩돼 있었고(`install-log.ts:409`),
`writeInstallLog` 이 **없으면 만들어서라도** 거기에 썼다. 그래서 claude 를 고르지 않은 설치도
`.claude/` 를 얻었고, 그 안에는 로그 파일 하나뿐이었다.

의도적인 선택이었다. 당시 주석: "codex/opencode 단독 설치 시엔 `.claude/` 가 없다. 그 경우에도
uninstall 이 log 를 읽을 수 있도록 write 직전 디렉토리를 보장한다." 로그를 잃지 않으려다
남의 CLI 디렉터리를 만든 것이다. 코드베이스도 이걸 알고 있었다 —
`tests/installer-cli-matrix.test.ts` 에 `(버그 1)` 로 주석돼 **통과하는 테스트로 박제**돼 있었다.

표면 증상은 하나지만 결함은 두 개다:

1. 고르지 않은 CLI 의 디렉터리가 생긴다 (보고된 증상).
2. **설치 상태 판정이 오염된다.** `detectInstallState` 는 `.claude/` 존재만으로 "existing" 을
   돌려준다(`state.ts:35`). opencode 단독 사용자는 `tracks: []` · `source: "legacy"` 로 잡혀
   위저드가 잘못된 분기로 갔다. ①을 고치면 이번엔 같은 사용자가 "new" 로 잡혀 **반대 방향으로**
   틀린다 — 그래서 둘은 한 릴리즈에서 같이 고쳐야 한다.

## Decision

설치 로그를 `<projectDir>/.uzys-agent-harness/.harness-install.json` 으로 옮긴다.
디렉터리 이름은 사용자 결정(이슈 본문의 제안 그대로).

동시에 계약 네 개를 같이 옮긴다. **하나라도 빠지면 게시본 사용자가 깨진다:**

1. **읽기 폴백** — `readInstallLog` 이 새 위치 → 구 위치 순으로 찾는다. 없으면 v26.64.0 ~
   v26.134.1 로 설치한 프로젝트의 `list`/`uninstall`/`update` 가 전부
   "install log not found" 로 죽는다.
2. **1회 이관은 `writeInstallLog` 안에서** — 새 위치에 쓴 뒤 구 파일을 지운다. 이관을 install
   경로에만 두면 로그를 쓰는 다른 경로(`update` 의 외부 CLI refresh, `uninstall --only` 의
   재기록)가 구 파일을 남긴 채 새 파일을 만들어 **같은 프로젝트에 로그가 2벌** 남는다.
3. **`uninstall` 이 새 디렉터리를 지운다** — 예전엔 templates 제거가 `.claude/` 를 통째로
   지우며 로그도 딸려 갔다. 그 경로가 없어졌으므로 `keepTemplates` 여부와 무관하게 명시 삭제한다.
   디렉터리째 지우는 이유: 파일만 지우면 빈 디렉터리가 남고, 그러면 "전부 지웠다"가 거짓이 된다.
4. **설치 판정을 `.claude/` 에서 떼어낸다** — `detectInstallState` 가 `.claude/` 부재 시
   설치 로그를 본다(`source: "install-log"`). `update` 의 전제조건도 `hasClaudeDir` 에서
   `state === "existing"` 으로 바꾼다 — v26.134.0(ADR-049)부터 `update` 는 외부 CLI 산출물도
   갱신하므로 `.claude/` 없는 설치도 정당한 갱신 대상이다.

## 적용 범위

- **적용됨**: 설치 로그 파일 하나의 위치 + 위 4계약.
- **적용 안 됨 (의도)**:
  - `.claude/` 자체의 역할 — 룰·에이전트·훅·스킬은 그대로 `.claude/` 에 깔린다.
    이 ADR 은 **CLI 중립 산출물만** 옮긴다.
  - `.claude.backup-<stamp>` 위치 — 여전히 프로젝트 루트다. 백업 경로 문제는 별건(todo R-3m).
  - `.gitignore` — 새 디렉터리를 자동 등재하지 않는다. 사용자 파일에 항목을 몰래 넣지 않는다는
    기존 방침(F-1f)과 같다.
  - 구 위치 파일을 **읽기 전용으로 남기는 옵션** 없음 — 이관은 자동이고 되돌리는 플래그는 없다.

## Alternatives

- **`.opencode/` 등 고른 CLI 의 디렉터리에 둔다** — 기각. 로그는 여러 CLI 설치에 걸쳐 한 벌로
  누적된다(F-1a). CLI 별로 두면 N 벌이 되고, 어느 것이 참인지 판정하는 규칙이 새로 필요해진다.
- **`.harness/`** — 기각. Harness.io(CI/CD)가 리포에서 같은 이름을 쓴다. 남의 도구와 겹치는
  이름은 "논리적이지 않음"을 다른 형태로 재발시킨다.
- **위치 유지 + 문서화만** — 기각. 문서로 설명해도 opencode 사용자의 리포에 `.claude/` 가
  생기는 사실은 그대로고, 결함 ②는 손도 못 댄다.
- **install log 의 `spec.cli` 로 "어느 CLI 가 깔렸나"를 판정** — 기각. 그 필드는 표시용이라
  누적되지 않는다(ADR-049 에서 같은 이유로 기각한 바 있다).

## Consequences

- **게시본 사용자**: 무동작. 다음 `install`/`update`/`uninstall --only` 때 파일이 옮겨진다.
  로그 때문에만 있던 `.claude/` 는 자연히 빈 채 남는데, 그건 이 릴리즈가 만든 게 아니라
  **이미 있던 잔재**다 — 사용자가 지우면 된다(문서에 명시).
- **opencode/codex 단독 설치**: `.claude/` 가 아예 안 생긴다.
- **`hasClaudeDir` 의 의미가 좁아졌다** — "설치됐는가"가 아니라 문자 그대로 `.claude/` 존재다.
  타입 주석에 적었다. 이걸 설치 판정에 다시 쓰면 같은 버그가 재발한다.
- **테스트가 `.claude/` 생성에 의존하고 있었다** — `writeLog` 헬퍼가 `.claude/` 를 만드는
  부수효과에 기대 `settings.json` 을 쓰던 테스트 3건이 드러났다. 명시적으로 바꿨다.

## 검증

- 로컬 `npm run ci` (typecheck + lint + coverage + build) — 본문 PR 참조.
- **음성 대조 7/7 사살** (변이가 타입체크를 통과하는 것까지 확인 — 빌드가 깨져서 난 실패는
  게이트가 잡은 게 아니다):
  M1 읽기 폴백 제거 · M2b 이관 무력화 · M3 경로 원복 · M4 state 폴백 제거 ·
  M5 update 전제조건 원복 · M6c 로그 파일만 지우고 디렉터리 잔존 · M7 위저드 라벨 누락.
  M2/M6 의 첫 변이는 타입체크를 깨서 **무효 처리하고 다시 쳤다**.
- Docker: `scenario-uninstall` 에 `.uzys-agent-harness/` 잔존 검사 추가.

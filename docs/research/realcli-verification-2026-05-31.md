# Real-CLI 검증 (B2 Codex + B1 Antigravity) — 2026-05-31

> 목표: README/USAGE 가 광고하는 4-CLI 중 **실환경 미검증 2건**(Codex `.codex/prompts/`, Antigravity `.agents/`)을
> 실 바이너리로 검증해 Promise=Implementation 갭 봉합. North Star "거짓 광고 0건".
> 방식: **Docker 격리** (호스트 `~/.codex`·`~/.gemini`·npm -g 오염 0). 인프라: `test/docker/Dockerfile.realcli` + `run-realcli.sh`.

## 검증 tier

| Tier | 정의 | 자동화 가능성 |
|------|------|--------------|
| **A 구조** | harness 가 올바른 project-local 경로에 자산 write | 완전 자동 (결정적) |
| **B 탐색** | 실 CLI 바이너리가 startup 시 그 경로를 스캔/로드 | CLI 별 상이 |
| **C 실행** | 슬래시/프롬프트가 실제 모델 세션에서 동작 | **auth-gated** (범위 외) |

## 환경

- `Dockerfile.realcli` (node:20-bookworm-slim) — 실 `@openai/codex@0.125.0`(npm) + 실 `agy 1.0.3`(`curl … install.sh`) 설치 확인.
- codex 0.125.0 = 사용자 로컬 환경과 동일 버전. agy = 최신 1.0.3.

## B2 — Codex `.codex/prompts/` (결론: **project-scope 미인식 확정**)

**Tier A — PASS**: `claude-harness install --track tooling --cli codex --with-uzys-harness --scope project`
→ `<proj>/.codex/prompts/uzys-{spec,plan,build,test,review,ship}.md` 6 file 정확히 write.

**Tier B — 미인식 확정 (소스·docs 근거)**:
- 경험적 probe(컨테이너): codex 0.125 에 prompt 열거 서브커맨드 없음 / mcp-server JSON-RPC `listCustomPrompts`·`prompts/list` = `-32601 method not found` / `RUST_LOG=trace` startup 에 project prompt 디렉토리 스캔 로그 없음 / TUI 는 startup 즉시 `chatgpt.com` 연결(auth 벽).
- **권위 근거 (OpenAI 공식)**: custom prompts 는 **`$CODEX_HOME/prompts/`(=`~/.codex/prompts/`)에서만** 로드. "프롬프트는 `~/.codex` 에 있어 repo 로 공유되지 않는다." 소스 `codex-rs/core/src/custom_prompts.rs` 의 `default_prompts_dir()` 는 `$CODEX_HOME/prompts` 만 반환, `list_custom_prompts` 도 그것만 호출.
- project-scope `.codex/prompts/` 지원은 **오픈 feature request**: [openai/codex#9848](https://github.com/openai/codex/issues/9848), [#4734](https://github.com/openai/codex/issues/4734). 미구현.

**판정**: harness 코드는 이미 정직 — `transform.ts:127-129` 가 "pre-positioning (#9848 지원 시 자동 작동)" 명시, install 출력도 동일 note. **갭은 사용자向 promise(README/USAGE)의 과소공개**였음.
- working path = **Global** `~/.codex/prompts/` (`--with-codex-prompts` opt-in) — codex 가 실제로 읽음.
- project `.codex/prompts/` = inert pre-position (free-upgrade 패턴).

**조치 (정직 표기)**: README CLI 지원 행 + USAGE Codex integration 재서술(Global active / Project pre-positioned·#9848). install 출력 note 한글→영어(v26.60.0 UI 영어 통일 정합).

## B1 — Antigravity `.agents/` (결론: **구조 검증·런타임 auth-gated**)

**Tier A — PASS**: `claude-harness install --track tooling --cli antigravity --with-uzys-harness --scope project`
→ `.agents/rules/uzys-harness.md` + `.agents/skills/uzys-{phase}/SKILL.md`(6) + `.agents/workflows/uzys-{phase}.md`(6) 정확히 write.

**Tier B/C — auth-gated (미자동화)**:
- `agy plugin list` → "No imported plugins" (harness `.agents/` 는 plugin import 가 아닌 workspace raw 디렉토리 — 별개 개념).
- `agy skills list` → TTY 필요 (TUI 전용, 컨테이너 비대화형 불가).
- `agy --print "…"` → **Google OAuth 로그인 벽** (`accounts.google.com/o/oauth2/auth …`, timeout). 모델 세션 미진입.
- 결론: `.agents/` 자산이 Antigravity 문서 스펙대로 배치됨은 확인. 단 로그인 세션에서 `/uzys-spec` 실제 resolve / skill 로드 여부는 자동 검증 불가.

**조치 (정직 표기)**: USAGE Antigravity integration 에 "구조 검증 / 런타임 미자동화(OAuth·TTY) — 수동 확인 권장" 명시.

## 교훈

- **Docker 실 바이너리 검증이 단위테스트·docs 신뢰만으론 못 잡는 promise 갭 노출** (C2 매트릭스가 실환경 버그 3건 잡은 것과 동일 계열).
- auth-gated CLI 의 Tier C 는 CI 자동화 불가 — **Tier A(구조) 자동 + Tier B/C 한계 정직 표기** 가 현실적 정직 전략.
- "광고했으나 미작동" 보다 "광고 + 한계 명시(pre-position/#9848, 런타임 수동확인)" 가 North Star 정합.

## 재현

```bash
test/docker/run-realcli.sh codex        # B2: Tier A PASS + Tier B evidence
test/docker/run-realcli.sh antigravity  # B1: Tier A PASS + Tier B/C auth 벽 evidence
```

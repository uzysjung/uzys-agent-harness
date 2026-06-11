# ADR-022: 자산-결합 CLI 플래그 13종 완전 삭제 + 내부 자산 모델 (`--with <id>` 일원화)

- Status: Proposed
- Date: 2026-06-11
- PR: #(TBD)
- Supersedes: (없음 — ADR-014 UserOverride 모델의 확장 적용, ADR-016/018의 게이팅 의미는 유지하되 전달 수단 변경)

## Context

`OptionFlags`(`src/types.ts`)는 boolean 19개로, 5축 코드리뷰(2026-06-11, code-quality-cycle plan)가 아키텍처 스멜로 판정했다:

1. **자산 1개 추가 = 프로덕션 ~8곳 + 테스트 10+ 파일 수정.** 19개 중 11개가 외부 자산 id와 1:1(`withGsd`→gsd-orchestrator, `withEcc`, `withTob`, `withSuperpowers`, `withAddyAgentSkills`, `withWshobsonAgents`, `withOpenspec`, `withBmad`, `withClaudeVideo`, `withUnderstandAnything`, `withAgentmemory`). 추가 경로: types.ts(인터페이스+DEFAULT_OPTIONS) → interactive.ts(toOptionFlags) → commands/install.ts(InstallOptions+spec 매핑+cac `.option()`+formatOptions) → 테스트 리터럴 전부.
2. **이 동기화 누락이 v26.76.0 거짓출하의 직접 원인.** `--with-openspec` 등 3개 플래그가 cac에 미등록 → 광고한 설치 명령이 CLI 크래시(`Unknown option`). 같은 클래스의 drift가 v26.78.0(wizard understanding 누락)에서도 반복.
3. **대체 메커니즘은 이미 존재·검증됨.** `userOverride.forceInclude` + generic `--with <asset-id>`(v26.47.0, ADR-014). wizard 체크박스는 **이미** `asset:<id>` → forceInclude 방식으로 동작 — CLI 전용 플래그만 레거시 이중 배선.
4. **README는 전용 플래그를 광고조차 안 함 (2026-06-11 실측).** README.md에 비대화형 설치 안내 섹션 자체가 없고 전용 플래그 노출은 `--with-uzys-harness` 1개뿐. USAGE.md에만 17회. 즉 삭제해도 깨지는 "Promise"가 거의 없음.
5. **외부 사용자 0 (Phase 3 진입 전, N=1).** BREAKING의 실 피해자가 없는 유일한 시기.
6. **사용자 결정 (2026-06-11 대화)**: ① 자산 11개 alias 전환(원래 O-2안)을 넘어 ② `withTauri`/`withUzysHarness`(내부 템플릿 게이팅)까지 **한 번에** 정리 ③ alias 호환층 없이 **완전 삭제** ④ 주 경로는 인터랙티브 wizard, 비대화형은 generic 플래그만.

비대화형 경로 자체는 유지해야 한다 — wizard는 no-tty에서 exit 2이며, `install-matrix.yml`·`catalog-verify.yml`·`test/docker/` 시나리오·fresh-dogfood 등 **검증 인프라 전체가 비대화형 플래그로 구동**된다 (ADR-021 "지속 검증" wedge의 기반).

## Decision

### D1 — 자산-결합 전용 플래그 13종 완전 삭제 (BREAKING, alias 없음)

삭제: `--with-gsd` `--with-ecc` `--with-tob` `--with-superpowers` `--with-addy-agent-skills` `--with-wshobson-agents` `--with-openspec` `--with-bmad` `--with-claude-video` `--with-understand-anything` `--with-agentmemory` (자산 11) + `--with-tauri` `--with-uzys-harness` (내부 2).

비대화형 자산 선택은 **generic `--with <id>` / `--without <id>`로 일원화**:

```bash
# ASIS                                          # TOBE (v26.81.0)
install --track tooling --with-bmad             install --track tooling --with bmad-method
install --track csr-supabase --with-tauri \     install --track csr-supabase --with tauri-desktop \
        --with-uzys-harness                             --with uzys-harness
```

`OptionFlags`에서 해당 boolean 13개 제거. 잔존 6개 = **진짜 동작 옵션**: `withKarpathyHook`(자산 설치 후 settings.json hook 배선), `withPrune`(`withEcc ||= withPrune` 결합 로직 → selectedAssets 기반으로 재표현), D16 글로벌 동의 4종(`withCodexSkills` `withCodexTrust` `withCodexPrompts` `withAntigravityGlobal`). 이들의 CLI 플래그(`--with-karpathy-hook` 등)는 유지 — 자산이 아니라 설치 동작이므로.

### D2 — 내부 자산(Internal Asset) 모델 신설

`ExternalAssetMethod`에 `{ kind: "internal", key: "tauri-desktop" | "uzys-harness" }` 추가. 카탈로그 entry 2종 신설(id = `tauri-desktop`, `uzys-harness`; tier = official; source = uzys). 동작:

- **설치 주체는 기존 그대로** — external-installer가 spawn하지 않고, installer/manifest/transform이 "이 id가 선택되었는가"를 읽어 게이팅 (`spec` 파생 `selectedAssets.has("uzys-harness")` — 기존 `spec.options.withUzysHarness` 자리 대체).
- wizard에서는 다른 자산과 동일하게 카테고리 그룹에 노출 (`asset:tauri-desktop`) — 현 `VISIBLE_OPTION_DEFS` 특례(option:withTauri) 제거.
- `withEcc`의 이중 역할(ecc-plugin 자산 + C3 cherry-pick 게이팅, ADR-016/019)도 동일 패턴: `selectedAssets.has("ecc-plugin")`으로 전환.

### D3 — 비대화형 표면 = generic만

`install` 서브커맨드의 자산 관련 플래그는 `--with <id>` / `--without <id>` (repeatable) 둘로 고정. 신규 자산은 **어떤 플래그 코드도 추가하지 않는다** (카탈로그 entry 1곳). 회귀 가드: cac 등록 옵션 중 자산-결합 `--with-*` 패턴이 다시 생기면 fail하는 테스트.

### D4 — 문서 정합 (Promise=Implementation)

- README에 **비대화형(CI/스크립트) 설치 섹션 신설** — `--track`/`--cli`/`--scope`/`--with <id>` + 자산 id는 COMPATIBILITY.md 표 참조. (현재 누락 — 검증 인프라가 실사용하는 기능이 사용자에게 숨겨져 있음)
- USAGE.md의 `--with-*` 17곳, README 1곳, Docker 시나리오/CI 워크플로의 전용 플래그 사용처 전부 `--with <id>`로 갱신.
- CHANGELOG `BREAKING CHANGE:` 표기.

## Alternatives

- **alias 호환 유지 (O-2 원안)** — 기각: 외부 사용자 0인 지금 alias 층은 유지비만 남김(13개 매핑 테이블 + 테스트). 사용자 명시 기각 (2026-06-11).
- **wizard-only (플래그 전부 제거)** — 기각: no-tty 환경(CI/Docker/스크립트) 설치 불가 → 검증 인프라 전체가 이 경로 위에 있음.
- **withTauri/withUzysHarness만 OptionFlags 잔존 (Phase O 원안)** — 기각: 사용자 결정으로 내부 자산화까지 1회에. "내부 템플릿 설치 여부"는 개념상 자산 토글과 동형이며, 특례(VISIBLE_OPTION_DEFS)를 없애면 wizard 코드도 단순해짐.

## Consequences

- **BREAKING (v26.81.0)**: 기존 전용 플래그 명령은 cac `Unknown option`으로 즉시 실패 — 침묵 오동작 없음(fail-loud). 피해 범위: README 광고 1개(`--with-uzys-harness`) + USAGE 17곳 → 문서 동기 수정으로 0화.
- 자산 추가 비용: 프로덕션 ~8곳 + 테스트 10+ 파일 → **카탈로그 entry 1곳**. v26.76.0류 거짓출하 클래스 원천 제거.
- `InstallSpec.options`가 19→6 boolean으로 축소 — 테스트 리터럴 대폭 단순화 (10+ 파일).
- 내부 자산 2종이 카탈로그 SSOT(tier/카테고리/wizard 노출/COMPATIBILITY 표)에 합류 — 단 external-installer의 spawn 대상은 아니므로 verify-catalog 등 설치 검증 스크립트에서 `kind: "internal"` 제외 처리 필요.
- 구현 PR은 사용자 승인(본 ADR Accepted) 후 진행. Docker 시나리오·install-matrix가 전용 플래그를 쓰고 있어 **구현 PR에서 동시 갱신 필수** (놓치면 CI 자체가 깨져 검출됨 — fail-loud).

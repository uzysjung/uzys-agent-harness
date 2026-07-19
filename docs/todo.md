# Todo — 현재 목표 & 상태

> **갱신**: 2026-07-19 (v26.122.0) · **역할**: 작업 추적 SSOT (doc-governance 위계의 TODO).
> **전략 SSOT**: [`docs/plans/service-audit-roadmap.md`](plans/service-audit-roadmap.md) (M1~M6) — 아래 'C→A→B→D' 전략 내용은 이로 **대체됨(historical)**.
> **목표 anchor**: [`docs/NORTH_STAR.md`](NORTH_STAR.md) (왜·어디로) · **이력**: [`CHANGELOG.md`](../CHANGELOG.md)
> **Foundation(v26.38) 상세 완료 기록**: [`docs/archive/phase1-foundation/`](archive/phase1-foundation/)
>
> **이 파일을 읽는 기계 = `spec-drift-check.sh` 하나뿐이다** (unchecked 항목 파싱).
> 과거 헤더는 `gate-check.sh` 존재 확인과 `/uzys:plan` 재생성을 함께 적어뒀으나, 둘 다
> **ADR-023(2026-06-26)에서 삭제된 6-Gate 워크플로의 유물**이라 v26.122.0 에 걷어냈다.
> 이 파일은 사람이 직접 갱신한다.
>
> **ship 게이트가 세는 것 = 이번 사이클 항목만.** 백로그(언젠가 할 일)는
> `<!-- ship-gate:ignore-start -->` ~ `<!-- ship-gate:ignore-end -->` 로 감싸면 세지 않는다.
> v26.122.0 이전에는 게이트가 파일 전체를 세는 바람에 열린 목표에서 체크박스를 빼는 우회가
> 관행이었다 — 셀 게 없으니 게이트가 아무것도 못 잡았다. **체크박스를 그냥 쓰고, 백로그면 감싼다.**
> 표식이 짝이 안 맞으면 면제는 무시된다(fail-closed).

---

## 현재 상태 (2026-06-06)

- **버전**: main = v26.121.0 (#235). npm 게시본은 별개 — 전략 SSOT = roadmap + harness-audit-2026-07-14.
- **활성 작업 사이클**: **재포지셔닝 로드맵 C→A→B→D** (deep-research `docs/research/direction-research-2026-06-06.md` + ADR-021). 아래 "열린 목표" 참조.
- **CI 정책**: GitHub Actions 는 릴리스 태그(`v*`) push 시에만 (v26.70.3). 로컬 `npm run ci` 가 1차 게이트.

---

## 완료된 마일스톤 ✅

- [x] **Foundation (v26.38)** — Phase 1~F. bash setup-harness.sh → TypeScript CLI rewrite, 등가성 복원. (상세: `archive/phase1-foundation/`)
- [x] **CLI rewrite 완결 (~v26.55)** — 11 Track × CLI 매트릭스, 외부 자산 32건, Router 분기, 환경 파일, all-in-one wizard, ECC opt-in gating (ADR-015/016).
- [x] **Install UX 재설계 (v26.56~63)** — 5-step 통합 wizard, 카테고리 페이지네이션, 자산 description 보강, 영어 통일.
- [x] **Project-scope default + Global opt-in (v26.64, ADR-020 BREAKING)** — 모든 자산 default project, global 명시 opt-in, install log + `claude-harness uninstall`.
- [x] **Codex / OpenCode / Antigravity 호환 (~v26.70)** — 4번째 CliBase(Antigravity) 포함. AGENTS.md / `.agents/` / `~/.gemini/` 산출. 6-Gate workflow opt-in.
- [x] **코드 품질 (v26.70.1~3)** — 코드리뷰 버그 9건 fix, cleanStaleHookRefs 단순화, GitHub Actions 태그 트리거 전환.
- [x] **검증 Trust Tier + 적극 권장 (v26.71.0, PRD v26-71)** — Trust Tier(official/vetted/experimental, T2=star≥1000) 분류 + Recommended 배지·우선정렬 + experimental opt-in. North Star 세 기둥 ②.

---

## 열린 목표 (재포지셔닝 로드맵 — C → A → B → D)

> 출처: [`docs/research/direction-research-2026-06-06.md`](research/direction-research-2026-06-06.md) (3-에이전트 시장·경쟁·채택 리서치) · 결정: [`docs/decisions/ADR-021`](decisions/ADR-021-repositioning-verified-curation.md) (Proposed)
> **핵심 발견 (3 에이전트 독립 수렴)**: "4-CLI 설치(installer)" 명제 절반은 commoditized — Vercel skills.sh(21.5k★/70+에이전트)·rulesync(1.1k★/25+도구)·MS APM + Claude Code/Codex 1st-party 마켓플레이스. 방어 wedge = **보안·신뢰 큐레이션** (Snyk ToxicSkills 36% prompt injection / 마켓 8개 과부하). 보유 무기 = Docker 실-바이너리 검증(CLAUDE.md) → 경쟁사 *정적* 표과 달리 *지속 테스트* 호환·보안 매트릭스.
> **방향 (사용자 결정 2026-06-06)**: C(저노력 검증) → A(보안 wedge 빌드) → B(표준 채택 자세) → D(분기).
> **outward-facing 주의**: C 의 등재/PR 제출/포스팅은 사용자 GitHub·계정으로 — 에이전트는 **초안·내부 파일만** 준비. 실 게시는 사용자 확인 후.

### 코드 품질 사이클 (2026-06-11 수용 — H→S→P→O→R, C와 병행)
- 5축 코드리뷰(기준 e0742b4) 결과 사용자 수용. **v26.78.1 hotfix 최우선** — v26.78.0 wizard 에 `understanding` 카테고리 미노출(출하 거짓 광고) + karpathyHook 실패 무음 + antigravity 출력 누락. 이후 카탈로그 SSOT → `@latest` pinning(보안 wedge) → OptionFlags 폐기(ADR-022) → 렌더 분리
- 상세 plan/todo: [`docs/plans/code-quality-cycle-plan.md`](plans/code-quality-cycle-plan.md) · 재발 방지 rule: `.claude/rules/no-false-ship.md`

### C — 발견 채널 등재 (지금, Phase 3 진입 — N=1 탈출)
- **C-1** Claude Code 마켓플레이스 등재 — `.claude-plugin/marketplace.json` + README 한 줄 소개·데모 자리 (에이전트 작성 → Docker 격리로 native 인식 검증)
- **C-2** awesome-list 등재 PR 초안 ×3~4 — awesome-claude-code(46k★)/awesome-agent-skills/awesome-claude-skills/awesome-cursorrules (에이전트 diff·본문 초안, 사용자 제출)
- **C-3** README 30초 데모(GIF/asciinema) + 한 줄 가치 소개
- **C-4** Show HN + r/ClaudeCode Showcase 글 초안 (에이전트 초안, 사용자 게시)
- ~~**C-측정** 설치 사용자 HITO 측정~~ — **폐기 (v26.115.0, ADR-043)**. 훅은 로컬 로그만 남겨 외부 사용자 측정이 구조적으로 불가했고, 자체 수집분도 3개월간 1회만 쓰였다. 대체 = Context Cost per Install(리포 내 결정론 계산)

### A — 보안·호환 매트릭스 공개 artifact (방어 wedge 빌드) ✅ (사용자 결정: 호환 매트릭스 우선 + Trust Tier 보안)
- **A-1** ~~agentshield 자산 스캔~~ → **재구성**: agentshield 는 `.claude/` 설정 스캐너(외부 repo 스캔 불가). 보안 = **Trust Tier + upstream vetting + `.claude/` 산출물 게이트** 다층으로(COMPATIBILITY.md §보안 근거). 실 자산-소스 스캐너는 보류(novel 툴링)
- **A-2/A-3** ✅ **`docs/COMPATIBILITY.md`** 공개 + README 포인터 + 검증 등급(🟢 Docker 실설치 / 🟡 install-matrix / ⚪ 메타데이터). 워크플로 3건 🟢. 정적 표 아닌 Docker 실행 근거. (전 자산 자동생성 CI = 점진 확대)

### B — 표준 채택 자세 (원칙, 산출물 적음)
- path 번역 재구현 금지(=skills.sh 중복). AGENTS.md/SKILL.md native emit, tool 통합은 MCP(`.mcp.json`) 위임. 신규 CLI/자산 추가 시 적용.

### D — 분기 (C 실데이터 후 결정, 지금 미결)
- 외부 사용자가 installer를 native/skills.sh와 중복으로 판단 시 → 큐레이션+보안 content 레이어 피벗 또는 upstream 기여.

### 보류/잔여 (Phase 3 의존 또는 저가치)
- **P2-01**(clean install + 첫 워크플로 완주. HITO 성공기준 (c)는 **폐기** — ADR-043) · **A3**(권장 수락률): C로 외부 사용자 확보 시 재개 (N=1 의존 해소)
- ~~**P2-02** Step2 (per-feature HITO 자동 매핑)~~ **폐기 (ADR-043)** · **E2** branch-protection 재정의 · **P2-04** dep bump(저가치)

### 완료된 Phase 2 작업 (이력)
- **C2** fresh-env 설치 매트릭스 CI ✅ (v26.72.0, `install-matrix.yml`) · **P2-NPM** npm publish ✅ (v26.72.1, `@uzysjung/claude-harness` 라이브)
- **B2+B1** 4-CLI 실환경 Docker 검증 ✅ (v26.73.0) · **A1** Trust Tier star-drift CI ✅ (`trust-tier-drift.yml`) · **A2** 자산 Promise audit ✅ (v26.74.0)

## 재발방지 큐 (2026-07-19 실측 발) — 순서대로

증거는 추정이 아니라 실측이다. 두 건 모두 프로즈 규약이 **이미 있는데도** 반복됐다 —
recurrence-prevention 사다리상 구조 게이트 단계.

### R-1 세션 정리 유출 (백그라운드 프로세스 · 서브에이전트)
- 실측: 최근 30일 3,661 세션 스캔 → 백그라운드/에이전트 사용 30건 중 **20건(66%)이 정리 흔적 0**
  (백그라운드 띄우고 kill 0회 19 · 에이전트 띄우고 TaskStop 0회 3, 최악 표본은 에이전트 23개/정지 0).
  직접 관측: 고아 `agent-browser` 3개(`ppid=1`, 2개는 18시간 경과) + 자식 Chrome 36개.
- 선재 프로즈: `model-orchestration` "Worker lifecycle"(다 쓴 에이전트는 닫는다, v26.109.0) —
  있는데 안 지켜졌다. 백그라운드 **프로세스**는 소유자가 아예 없다.
- [x] R-1a `session-start.sh` 에 이전 세션 잔존 탐지 (✅ #235) — 세션 **시작** 시점이 유일하게
      출력이 보장되는 자리다(종료 훅은 출력이 유실될 수 있다). 탐지만, 차단 없음.
      `ALWAYS_HOOKS` 라 전 사용자 도달.
- [x] R-1b 백그라운드 프로세스 소유자 지정 (✅ #235) — **`git-policy` Session Cleanup 0번으로
      결정.** `model-orchestration` 은 "다 쓴 에이전트"를 소유하고, 이쪽은 세션 종료 체크리스트
      전체를 소유하므로 프로세스가 들어갈 자리다. 양쪽 기재 안 함.
- [x] R-1c 계약 테스트 + mutation (✅ #235) — `tests/session-cleanup-gate.test.ts` 12 tests,
      실제 고아를 만들어 정리까지 검증하는 live 테스트 포함. mutation 2종 실패 확인.

### R-2 검증 명령의 조용한 실패 → 거짓 결론
- 실측: 2026-07-19 한 세션에서 **3회** — `realpath -m`(BSD 미지원) · 파이프 뒤 `$?` ·
  `find -newermt`(BSD 미지원). 셋 다 `2>/dev/null` 로 에러를 삼켜 **빈 결과를 "이상 없음"으로 오독**.
  3회차는 "호스트 오염 없음"이라는 **거짓 보고**가 됐다(실제로는 `~/.claude/homunculus/` 에
  디렉터리를 만들었다). 같은 세션에서 ECC 코드의 동일 패턴(`>/dev/null 2>&1`)을 89줄 걷어내면서 그랬다.
- 선재 프로즈: `cli-development.md` §Cross-Platform BSD/GNU 표 — 있는데 어겼다. 단 그 룰은
  **배포하는 스크립트** 대상이고, 이번 위반은 **검증용 임시 명령**이었다. 그 표면은 무주공산이다.
- [x] R-2a 일반 원칙 (✅ #235) — **계획 이탈: 소유자를 `no-false-ship.md` 대신
      `cli-development.md` §"검증 명령은 실패해도 조용하다" 로 했다.** 사유 = 세 위반이 전부
      셸 명령의 BSD/GNU 거동이라 R-2b 표와 같은 덩어리이고, 두 룰에 나눠 쓰면 doc-governance
      "한 사실은 한 곳"을 어긴다. 대가: `no-false-ship` 만 읽는 독자에게는 이 원칙이 안 보인다 —
      그 룰의 "증거 = 실제 실행 산출물만" 문장이 여전히 상위 원칙이므로 수용 가능하다고 판단.
- [x] R-2b BSD/GNU 표 행 추가 (✅ #235) — `realpath -m` · `find -newermt` · `stat` 포맷 3행.
- [x] R-2c 계약 테스트 + mutation (✅ #235) — `tests/session-cleanup-gate.test.ts` 가 겸함.

### R-3 ECC 검토 잔여 (#235 에서 범위 밖으로 남긴 것들)

`fix/ecc-review-drift` → #235 머지(v26.121.0)로 R-1·R-2 는 닫혔다. 아래는 같은 세션에서
발견했으나 의도적으로 분리한 것들 — **순서가 의미를 가진다**(3번을 먼저 걸면 신호가 죽는다).

**백로그다** — 이번 사이클에 하기로 한 것이 아니므로 ship 게이트에서 면제한다. 착수를 결정하면
표식 밖으로 옮긴다(그 순간부터 미완이면 ship 이 막힌다 = 원래 의도).

<!-- ship-gate:ignore-start -->

- [ ] R-3a **`update-mode.ts` 가 `.claude/skills` 를 갱신하지 않는다**(`src/update-mode.ts:53-78`).
      파급 최대 — v26.121.0 의 정정이 **기존 사용자에게 하나도 도달하지 않는다.** 덮어쓰기 방지
      (사용자 수정분 보존) 설계가 선행돼야 한다. 별건이자 최우선.
- [ ] R-3b **CL-v2 훅 배선 + 설치 시 1회 고지.** 사용자 결정 완료 — `~/.claude/homunculus/`
      write 는 허용, 무인설치 허용, 차단하지 않고 고지만. 조건부 배선 선례 = karpathy-gate
      (`src/installer.ts:606~`). `settings-merge.ts` 의 `addPreToolUseHook` 은 PreToolUse
      전용이라 이벤트 일반화가 필요하다.
- [ ] R-3c **drift 18건 정리 → 정기 cron 배선.** 반드시 정리가 먼저 — 지금 cron 을 걸면 첫날부터
      red 라 경보가 무의미해진다. 선례 = `catalog-verify.yml`(월 1회), 새 워크플로는 08:00 UTC 로 분리.
- [ ] R-3d **ADR 작성** — CL-v2 C3→C2 재분류. 현재 사유가 `docs/PRD/v26-58-cherry-pick-plugin-gating.md`
      인용 블록에만 있다. change-management 상 "아키텍처/의존성 결정"에 해당하므로 정식 ADR 대상.
- [ ] R-3e `package-lock.json` 이 **26.114.0 에서 stale**(릴리즈 7건 미갱신). npm publish 는
      `package.json` 을 쓰므로 기능 영향 없음 — 정합성 정리 항목.
- [ ] R-3g **F10(제거된 것의 광고를 구조로 차단) 재점화 근거 축적.** `no-false-ship.md` 가 F10 을
      "아직 미해결"로 달아둔 채 v26.106.0 이후 방치돼 있다. 2026-07-19 에 또 나왔다 — ADR-023
      (2026-06-26)이 6-Gate 를 지웠는데 **13개월치 문서가 그걸 계속 시키고** 있었다(CONTRIBUTING
      의 "`/uzys:*` 커맨드 추가법", REFERENCE 의 자기모순, plan.md 재생성 안내 등 5곳, v26.122.0
      수기 정리). **설계 주의**: 단순 "언급 금지" 게이트는 정정 노트("~는 삭제됐다")에 걸린다 —
      광고와 부고를 구분해야 하고, 그래서 급조하지 않았다. 유력안 = 문서가 참조하는
      훅/커맨드 파일의 **실존 여부를 파일시스템에서 derive** (열거 아님).
- [ ] R-3f `spec-drift-check.sh` 두 사본 정합 — `.claude/` 에만 `SHIP_SUBSPEC` 모드가 있고
      `templates/` 에만 `first_existing` · `gate-status.json` 검사가 있다(v26.107.0 이후 갈림).
      이번 v26.122.0 은 양쪽에 동일한 `count_unchecked` 만 수술했고 나머지 갈림은 그대로다.

### F-1 설치 내역 관리 — 조회 · 항목별 제거 · 추가설치 누적 (사용자 요청 2026-07-19)

목표: 설치 후 **무엇이 깔렸는지 알 수 있고**, 항목 단위로 **빼고 더할 수 있고**, 추가로 깐 것이
**기록에 남는** 것. rule/hook/`settings.json`/CLAUDE.md 처럼 되돌리기가 위험한 표면은 자동 제거
대신 **정확한 안내(반자동)** 로 처리한다 — 사용자 명시 방침.

**baseline 대조 (2026-07-19, 착수 전 실측)** — 절반은 이미 있다. 재구현 금지:

| 기구현 | 근거 |
|--------|------|
| 설치 기록 파일 `.claude/.harness-install.json` | `src/install-log.ts` (v26.64.0 · ADR-020) — 자산 id/category/method/scope/detail/version + tracks/cli + templates 경로 |
| 로그 기반 uninstall + `--dry-run` / `--keep-templates` | `src/commands/uninstall.ts:61` |
| 글로벌 자산은 자동 삭제 금지 → 안내만 | 같은 파일 `buildGlobalAdvisoryCmd:245` (D16) |
| CLAUDE.md 사용자 수정 감지 후 보존 | `install-log.ts:57` sha256 + `uninstall.ts:284` |

- [x] **F-1a 추가설치가 기록을 덮어쓴다 (결함, 최우선).** (✅ v26.123.0) `buildInstallLog` 이
      `previous` 를 받아 누적. 누적 대상은 uninstall 이 실제로 읽는 `assets`(id 합집합) +
      `templates`(이번에 안 만든 항목은 이전 값 유지)뿐 — `spec` 은 reinstall 에서 거짓이 되므로
      제외. 기존 로그는 backup 직전에 읽는다. mutation 3종 사살.
- [x] **F-1b 설치 내역 조회 커맨드가 없다.** (✅ v26.123.0) `agent-harness list` —
      `src/commands/list.ts`. 자산 id/method/scope/version + templates + CLAUDE.md 수정 여부.
      읽기 전용.
- [x] **F-1c 항목별 uninstall.** (✅ v26.123.0) `--only <ids>`. templates 미변경, 로그는
      **남은 자산으로 재기록**(삭제 아님), 성공분만 제외, 모르는 id 는 실행 전 차단.
- [x] **F-1d 되돌리기 위험 표면의 안내(반자동).** (✅ v26.123.0) 착수 시 가설("`templates` 에
      `settings.json` 역연산 정보 없음")은 **부분적으로 틀렸다** — `.claude/settings.json` 은
      `.claude/` 통째 제거로 처리되므로 전량 uninstall 엔 공백이 없다. 진짜 공백은 `--only` 경로:
      자산만 빼면 훅 등록이 남는다. 현재 파일을 **파싱해** 실제 잔존분만 안내한다.
- [x] **F-1e 항목별 추가 install 이 로그에 등록** (✅ v26.123.0) —
      `tests/install-inventory-e2e.test.ts` 가 AC 전 구간을 한 줄기로 검증.

- [ ] **F-2 (신규, v26.123.0 중 발견) — branch coverage 가 실행마다 흔들린다.** 동일 커밋
      3회 실측 = 89.13 / 89.12 / 89.13. 소스 변경 없이 값이 바뀌므로 **커버리지 게이트가
      threshold 근처에서 flaky** 해진다 (현재 gate 88, 여유 ~1.1%p 라 아직 안 터졌을 뿐).
      부수 피해: CHANGELOG 에 소수점 둘째 자리를 적는 관행이 구조적으로 거짓 주장을 만든다
      (이번 릴리즈에서 3회 오기). 원인 후보 = 환경 의존 분기(`command -v` 류)·테스트 순서·
      v8 provider. 재현: `npx vitest run --coverage` 3회 비교.
- [ ] **F-1f (신규, 이번 작업 중 발견) — uninstall 이 프로젝트 루트 수정분을 모른다.** install 은
      `.claude/` 밖에도 쓴다: `.mcp.json`(병합) · `.gitignore`(추가줄) · `.env.example` ·
      `.mcp-allowlist` · `.github/workflows/*`(ci-scaffold). uninstall 은 이 중 **어느 것도
      안내조차 하지 않는다** — `.mcp.json`/`.gitignore` 는 사용자 내용이 섞이므로 자동 삭제도
      부적절하다. F-1d 와 같은 반자동 안내가 필요하나 **무엇을 건드렸는지 로그에 없다** →
      install 시 기록 후 안내. 근거: `env-files.ts:62,75,103,128,132` · `ci-scaffold.ts:71`.

<!-- ship-gate:ignore-end -->

---

## 완료 조건 (현 사이클)

C-1 부터 순차 착수. 각 단계 완료 시 본 파일 갱신. 아직 착수하지 않은 구간은 체크박스를 쓰되
`ship-gate:ignore` 구간으로 감싼다 (헤더 참조).

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

## 상주 감축 사이클 (2026-07-26 발 · ADR-053) — 현재 사이클

메인테이너 방향: *"꼭 필요한 것만 남기고 빼는 것이 오히려 에이전트에게 더 좋다 / AI 가 실수할 것
같은 것만 원칙화 / 이조차 모델이 좋아지면 완화 / 원칙·방법론이 더 중요."*
판정 절차(0단계 실수 테스트 → 4범주 → 배치 3목적지 → sunset)는 `docs/decisions/ADR-053-resident-item-count.md`.

- [x] 1차 NSM 양 축을 토큰 → 상주 항목 수로 교체 + 계측·ratchet·표시 대칭 (✅ `5830ef8`, 음성 대조 4종)
- [ ] **AC 전수 판정** — `tooling` 상주 29 + `templates/rules` 21 + `templates/agents` 9.
      결과가 곧 새 baseline (숫자를 먼저 박지 않는다).
      ⚠ **배포판은 증거 기준이 다르다** — 로컬 사고 1건 불가, 다도메인 반복·공개 실증·운영
      사실·손상 비대칭 중 하나 필요 (ADR-053 §0단계). 근거 모집단이 **이 맥 1인**뿐이라는
      실측(외부 신호 issue 3·star 3)에서 나온 제약
- [ ] **판정 결과 실행** — 삭제 / 스킬 이관 / **메모리 이관** 중 하나로 배치. 배치 목적지가 셋인
      것은 기준선 실측 발견(그쪽은 TDD·오탐 재검증·브랜치→PR→태그를 룰이 아니라 메모리에 둔다)
- [ ] **검증 방법론 자산 신설 여부 판정** — 실측 공백: `templates/` 전수에서 속성기반·계약
      테스트·FDD **0건**, 변이 테스트는 언급 4건이나 선택 가이드 없음, `verification-loop` 158줄은
      전부 CI 실행 순서. 범위는 **선택 규칙과 함정**으로 한정("TDD 가 무엇인가"는 모델이 안다)
- [x] **CLAUDE.md 최종본 확정** — 메인테이너가 2026-07-26 `~/.claude/CLAUDE.md`(글로벌 앵커)를
      **6원칙 · ~1,100 tok** 으로 교체. *"너무 프로시저 내용이 있어서 원칙 중심으로 다시 바꿨다.
      이를 기반으로 해야 한다."* → **이후 모든 판정의 기준선.** SSOT 는 그 파일이며 리포에
      복제하지 않는다(doc-governance)
- [ ] **리포 `.claude/CLAUDE.md` 의 옛 Rule 1~12 정리** — 최종본이 대체한 12룰을 그대로 들고 있어
      **지금 모순 상태**다. 남길 것은 이 리포 고유분(거짓출하 · Docker 실환경 검증 · CalVer ·
      4-CLI · 컨펌 시 ASIS/TOBE 설명 형식)뿐. 최종본과 겹치는 항목은 삭제
- [ ] **`templates/CLAUDE.md`(배포판)를 원칙 형태로 갈지 판정** — 지금은 트랙 fill-in 스캐폴드
      (~1,182 tok). 상주 예산의 단일 최대 레버이고, 배포판은 낯선 사람의 프로젝트에 설치된다
- [ ] **6원칙이 흡수한 룰 재판정** (아래 매핑 기준으로 AC 전수 판정에 반영)
- [ ] **sunset 임계값 실측 후 확정** — 위반 근거가 며칠/몇 릴리즈 갱신 안 되면 재판정 큐에
      올릴지. 근거 없는 수치 고정 금지라 지금 안 박는다

#### 최종본 6원칙 ↔ 기존 자산 매핑 (AC 판정 입력)

기준선 = `~/.claude/CLAUDE.md` (2026-07-26 최종본). **원칙이 앵커로 올라간 만큼 룰 쪽에서 같은
말을 반복하면 그건 두 번째 사본이다** — 아래 "흡수" 열이 곧 삭제 후보 근거다.

| 최종본 원칙 | 흡수한 기존 항목 | 재판정 대상 |
|---|---|---|
| 1 Think before coding | 옛 Rule 1·7(충돌 시 pushback)·8(읽고 나서 쓴다) + 안티패턴 표의 취지 | `doc-governance` 착수 전 baseline 대조 절과 중복 여부 |
| 2 Simplest sufficient | 옛 Rule 2. **신규**: "재현·테스트 가능한 동작을 선호 — 간결이 재현 불가를 만들면 그건 단순함이 아니다" | `code-style` 크기 상한과의 관계 |
| 3 Surgical + preserve | 옛 Rule 3·11 + 옛 Rule 7 의 충돌 우선순위. **신규**: "기존 워크트리 변경은 사용자 것 — 덮거나 되돌리거나 스테이징하지 마라" | `change-management` Savepoint 의 `git add -A` 금지와 같은 실패를 덮는가 |
| 4 Define success before editing | 옛 Rule 4·9. "안정적 계약 경계에서의 회귀 테스트" 로 구체화 | `test-policy` 의 TDD 절차 잔여분 |
| 5 **Report evidence, not confidence** | 옛 Rule 12 + **`no-false-ship` 의 절대 원칙 자체**("검증한 경로만 주장한다") + 옛 Rule 10 의 handoff | **`no-false-ship` 을 사례·증거 양식만 남기고 축소 가능한지** — 원칙이 앵커로 올라갔다 |
| 6 **High-impact boundaries** (신규) | `git-policy` Safety(force/reset 금지) 일부 · "준비 ≠ 적용" | `git-policy` 해당 절 중복 여부 |

**최종본에서 사라진 것 3건 — 각각 판정이 필요하다** (그냥 없어지면 다음 세션이 이유를 모른다):

| 사라진 것 | 사전 판정 | 근거 |
|---|---|---|
| 옛 Rule 6 토큰 예산(4,000/30,000) | **삭제 타당** | 상시 초과돼 온 규칙 = 지켜지지 않는 규칙. 0단계 실수 테스트를 통과 못 한다(지켜진 적이 없으니 위반이 사고로 기록되지도 않았다) |
| 옛 Rule 5 "코드가 답할 수 있으면 코드가 답한다" | **미판정 — 확인 필요** | 최종본 원칙 2 가 "재현 가능한 동작 선호"로 근처를 지나가지만 *"라우팅·재시도·결정론 변환에 모델을 쓰지 마라"* 는 명시가 없다. 이 리포는 설치기라 결정론이 핵심이다 |
| Self-Audit 의 "Non-Goals 침범 없음" 확인 | **미판정 — 확인 필요** | 원칙 5 가 미검증 보고는 덮지만 **범위 침범**은 다른 축이다. SPEC 에 Non-Goals 절이 실재한다 |

### 리스크·한계 문서를 doc-governance 위계에 넣을 것인가 (사용자 제안 2026-07-26)

- [ ] **결론 내기.** 아래는 착수 판단용 사전 조사이지 결정이 아니다.

**왜 후보인가 (실측)**: `docs/` + `.claude/rules/` 에서 "한계" 10파일 · "미검증" 10파일 ·
"제약" 9파일 · "risk" 8파일이 나오는데 **doc-governance SSOT 표 6항목 중 이걸 소유하는 문서가
없다.** 같은 성격의 사실이 최소 8~10곳에 흩어진 상태이고, 이는 doc-governance 자신이 금지하는
형태다("같은 사실을 두 곳에 쓰지 않는다 — 중복 서술 = drift 의 씨앗").

**AC 사전 판정** (ADR-053 절차 적용):

| 단계 | 판정 | 근거 |
|---|---|---|
| 0단계 실수 테스트 | **Pass** | 사고 기록 있음 — `no-false-ship` §"미검증에도 근거가 필요하다"가 v26.127.0 사고로 신설됐고("환경 제약상 불가"로 적었다가 실제로는 `script(1)` 로 가능했음), 백로그 서술이 2회 틀린 전례도 같은 계열 |
| 1단계 범주 | **Pass — B(문서 현행화)** | 최우선 범주에 정면으로 해당 |
| 2단계-1 게이트 중복 | **부분** | `spec-drift-check.sh` 는 SPEC/TODO 미완만 본다 — 한계·리스크는 대상 밖 |
| 2단계-2 상주 여부 | **비상주** | 문서 자체는 상주 아님. 룰 증분은 doc-governance 표의 **한 줄**(~30 tok) |
| 2단계-3 가변성 | **내용은 가변, 구조는 규약** | 내용은 프로젝트마다 다름 → 배포는 *자리*만, 내용은 사용자 프로젝트에서 자람 |

**결정해야 할 것** — 셋 중 하나를 고른다:

| 안 | 형태 | 장점 | 대가 |
|---|---|---|---|
| **①** 새 문서 `docs/LIMITATIONS.md` 를 위계에 추가 | SSOT 표 7번째 행 | 찾을 곳이 하나 | 문서가 하나 늘고, 안 갱신되면 그 자체가 거짓이 된다 |
| **②** 기존 `gap.md` 스키마 재사용 (benchmark-parity) | 이미 있는 표를 범위만 확장 | **새 스키마 0** — Severity·근본원인·증거 열이 이미 규정됨 | gap.md 는 UI/벤치마크 대조용이라 의미가 늘어짐 |
| **③** 추가하지 않음 | ADR `Consequences` + `no-false-ship` 미검증 표기로 충분하다고 판정 | 감산 기본값에 충실 | 흩어짐이 유지됨 |

**판정 시 반드시 볼 것**: 이 리포는 *"선언만 하고 한 번도 갱신 안 한 문서"* 로 지표를 두 번 죽였다
(HITO · JAR). 리스크 문서도 **갱신 발동 조건이 없으면 같은 운명**이다 — 어느 안을 고르든
"언제 이 문서를 건드리는가"를 먼저 정하고, 그게 기계로 발동되지 않으면 ③이 정답일 수 있다.

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

- [x] R-3a **`update-mode.ts` 가 `.claude/skills` 를 갱신하지 않는다** (✅ v26.126.0, ADR-046).
      착수 시 서술 정정: "정정이 **하나도** 도달하지 않는다"는 과장이었다 — CLI 기능은
      `npx @uzysjung/agent-harness@latest` 로 도달하고, 도달 못 하는 것은 `.claude/skills/`
      **본문**이다. 덮어쓰기 정책(사용자 결정): 안 고쳤으면 덮어쓰고, 고쳤으면 `.backup-<stamp>`
      남기고 최신판을 자리에 둔다. 판정은 설치 시점 sha256 대조.
- [x] R-3k **소유자 판정이 `.claude/skills` 에만 걸려 있었다** (✅ v26.132.0, ADR-047) — 사용자
      보고("재설치하면 rules·hooks 를 그냥 덮친다")로 드러났다. R-3a 가 ADR-046 의 결정을
      **스킬에만** 구현해서, 같은 update 실행 안에서 스킬은 백업을 받고 룰·훅은 `copyFileSync`
      로 조용히 밀렸다. `install` 은 `settings.json` 하나만 보호했고 `add` 모드는 통짜 백업도
      없었다. 추가로 `pruneOrphans` 가 **사용자가 직접 만든 커스텀 룰·훅을 백업 없이 삭제**했다
      (폐기된 하네스 룰과 사용자 파일이 templates 기준으로는 똑같이 "없음"이라서).
      해결: 기준선을 `policyFiles` 로 확장, 삭제는 소유가 증명될 때만. 계열 교훈은
      `feedback_surface_symmetry` 와 같다 — 한 축이 일부에만 있으면 빠진 쪽이 입증 책임을 진다.
- [ ] R-3b **CL-v2 훅 배선 + 설치 시 1회 고지.** 사용자 결정 완료 — `~/.claude/homunculus/`
      write 는 허용, 무인설치 허용, 차단하지 않고 고지만. 조건부 배선 선례 = karpathy-gate
      (`src/installer.ts:606~`). `settings-merge.ts` 의 `addPreToolUseHook` 은 PreToolUse
      전용이라 이벤트 일반화가 필요하다.
- [ ] R-3c **drift 18건 정리 → 정기 cron 배선.** 반드시 정리가 먼저 — 지금 cron 을 걸면 첫날부터
      red 라 경보가 무의미해진다. 선례 = `catalog-verify.yml`(월 1회), 새 워크플로는 08:00 UTC 로 분리.
- [ ] R-3d **ADR 작성** — CL-v2 C3→C2 재분류. 현재 사유가 `docs/PRD/v26-58-cherry-pick-plugin-gating.md`
      인용 블록에만 있다. change-management 상 "아키텍처/의존성 결정"에 해당하므로 정식 ADR 대상.
- [x] R-3e `package-lock.json` stale 동기화 (✅ 26.132.0). **착수 시 서술 정정**: 항목은
      "26.114.0 에서 stale(7건 미갱신)"이라고 적혀 있었는데 실측은 26.131.1 이었다 — 그 사이
      릴리즈들이 lock 을 갱신했고 마지막 1건만 밀려 있었다. 항목을 쓴 시점의 사실이 그대로
      박제된 것. `npm install --package-lock-only` 로 동기화(버전 필드 2줄만 변경, 의존성 해석
      변동 0). npm publish 는 `package.json` 을 쓰므로 기능 영향은 없었다.
- [ ] R-3g **F10(제거된 것의 광고를 구조로 차단) 재점화 근거 축적.** `no-false-ship.md` 가 F10 을
      "아직 미해결"로 달아둔 채 v26.106.0 이후 방치돼 있다. 2026-07-19 에 또 나왔다 — ADR-023
      (2026-06-26)이 6-Gate 를 지웠는데 **13개월치 문서가 그걸 계속 시키고** 있었다(CONTRIBUTING
      의 "`/uzys:*` 커맨드 추가법", REFERENCE 의 자기모순, plan.md 재생성 안내 등 5곳, v26.122.0
      수기 정리). **설계 주의**: 단순 "언급 금지" 게이트는 정정 노트("~는 삭제됐다")에 걸린다 —
      광고와 부고를 구분해야 하고, 그래서 급조하지 않았다. 유력안 = 문서가 참조하는
      훅/커맨드 파일의 **실존 여부를 파일시스템에서 derive** (열거 아님).
- [x] R-3h **`update` 에 비대화형 진입점이 없다** (✅ v26.131.0). `install`·`list`·`uninstall` 은
      전부 플래그로 도는데 `update` 만 위저드 전용이었다 — **CI 로 깔 수는 있는데 갱신할 수는
      없다.** 착수 계기의 정정: 처음에 이걸 "요청받은 적 없는 추정 수요"로 분류해 강등했는데,
      사용자 지적대로 **수요 문제가 아니라 계열 비대칭**이다. 입증 책임은 빠진 쪽에 있다
      (메모리 `feedback_surface_symmetry`). 재발 차단 = `MODE_ENTRY_POINT`
      (`Record<InstallMode, …>` 라 mode 추가 시 분류 전에는 컴파일 실패) + 등록 명령에서 derive
      하는 `--project-dir` 대칭 테스트.
- [ ] R-3i **`reinstall` 도 비대화형 진입점이 없다** — R-3h 착수 중 계열 전수 확인에서 나왔다
      (`add` 는 `install --track` 이 동작상 동일해 커버됨). `.claude/` 를 통째로 **옮기는**
      파괴적 경로라 비대화형 노출 여부는 별도 판단이 필요해 열어둔다. 지금은
      `MODE_ENTRY_POINT.reinstall = null` + 테스트가 그 목록을 고정해 **침묵으로 빠지지는 않는다.**
- [x] R-3j-B **외부 CLI 산출물에 소유자 판정이 없었다** (✅ v26.133.0, ADR-048) — R-3j 착수 중
      조사에서 나왔고, 등재된 것(A)보다 이쪽이 급했다. ADR-047 이 `.claude/` 에 붙인 판정이
      `.codex/`·`.opencode/`·`.agents/` 에는 없어서 **재설치할 때마다** 사용자가 고친 훅·커맨드·
      config 가 백업 없이 사라졌다. 실측으로 6개 산출물 전부 편집분 소실·백업 0 확인.
      `AGENTS.md` 만 내용 비교로 보호받았는데 그건 ADR-047 이 기각한 방식(릴리즈마다 백업 축적).
      ADR-046 → 047 → 048 로 **같은 결정이 세 번 자기 앞 자산에만 걸린 것** — 그래서 ADR-048 은
      적용 범위를 본문에 명시했다.
- [x] R-3j-A **`update` 가 `.codex/` · `.opencode/` 템플릿은 갱신하지 않는다** (✅ v26.134.0,
      ADR-049) — `.claude/` 전용이라 4-CLI 를 표방하면서 갱신은 1-CLI 인 비대칭이었다.
      **B 가 선행조건이었고** (소유자 판정 없이 붙이면 재설치 때만 밀리던 것이 릴리즈마다
      밀린다) v26.133.0 으로 갖춰졌다. 해법의 핵심은 "어느 CLI 가 설치돼 있나"를 **판정하지
      않은 것** — writer 에 refresh 모드(디스크에 이미 있는 파일만)를 넣으니 안 깐 CLI 는
      대상 파일이 없어 자연히 제외됐고, 그래서 CLI·스킬 목록의 열거 사본이 안 생겼다.
      부수로 `runCliTransforms` 를 `src/cli-transforms.ts` 로 빼 install/update 가 **한 도구**를
      공유하게 했고, `update-mode.ts` 에 남아 있던 `isHarnessOwned` 사본을 지웠다
      (ADR-048 이 "술어는 한 곳에"라 적고도 2벌이던 상태).
- [ ] R-3m **같은 초에 `update` 를 두 번 돌리면 백업 경로가 충돌해 크래시** — `.claude.backup-<stamp>`
      의 stamp 가 초 단위라 이름이 겹치고, `.claude/skills/<id>` 가 외부 설치기(`npx skills add`)가
      만든 **심볼릭 링크**일 때 `cpSync` 가 EINVAL(`cannot copy ... to a subdirectory of self`)로
      죽는다. 2026-07-20 R-3j-A 의 Docker 시나리오를 쓰다 발견했고, **v26.133.0 게시본에서도
      동일 재현**(HEAD worktree 로 별도 이미지를 빌드해 대조) — 이번 릴리즈가 만든 문제가 아니라
      그전부터 있던 것이다. 비대화형 update 가 생긴 뒤(v26.131.0) CI 에서 실제로 밟을 수 있는
      경로가 됐다. 지금은 시나리오가 `sleep 2` 로 우회 중 — 우회는 수정이 아니다.
      수정안: 백업 경로가 이미 있으면 접미사를 붙여 유일하게 만든다(`fs-ops.ts`).
- [ ] R-3f `spec-drift-check.sh` 두 사본 정합 — `.claude/` 에만 `SHIP_SUBSPEC` 모드가 있고
      `templates/` 에만 `first_existing` · `gate-status.json` 검사가 있다(v26.107.0 이후 갈림).
      이번 v26.122.0 은 양쪽에 동일한 `count_unchecked` 만 수술했고 나머지 갈림은 그대로다.
- [ ] R-3l **`docs/specs/` 9개가 출하 후에도 `Status: Draft` 로 남아 있다** — 2026-07-20 에
      `v26-72-install-matrix-ci.md` 의 Plan ref 를 고치다 헤더에서 발견했다(그 기능은 v26.72.0
      으로 출하돼 태그마다 매트릭스가 돈다). 어휘는 이미 있다(`Accepted`/`Superseded` 사용 전례).
      **9건을 일괄로 바꾸지 않았다** — 각각 실제 출하 여부를 확인해야 하고, 확인 없이 바꾸면
      doc-governance 가 막으려는 바로 그 "거짓 상태"를 반대 방향으로 만든다. 구조 차단 후보 =
      SPEC 의 Status 와 CHANGELOG/태그 존재를 대조하는 게이트(열거 아님 — `docs/specs/*.md` 글롭).

### F-1 설치 내역 관리 — 조회 · 항목별 제거 · 추가설치 누적 (사용자 요청 2026-07-19)

목표: 설치 후 **무엇이 깔렸는지 알 수 있고**, 항목 단위로 **빼고 더할 수 있고**, 추가로 깐 것이
**기록에 남는** 것. rule/hook/`settings.json`/CLAUDE.md 처럼 되돌리기가 위험한 표면은 자동 제거
대신 **정확한 안내(반자동)** 로 처리한다 — 사용자 명시 방침.

**baseline 대조 (2026-07-19, 착수 전 실측)** — 절반은 이미 있다. 재구현 금지:

| 기구현 | 근거 |
|--------|------|
| 설치 기록 파일 `.uzys-agent-harness/.harness-install.json` | `src/install-log.ts` (v26.64.0 · ADR-020, 위치는 v26.135.0 · ADR-050 에서 `.claude/` 밖으로) — 자산 id/category/method/scope/detail/version + tracks/cli + templates 경로 |
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

- [x] **F-3 — README 에 `list`/`uninstall` 설명이 없다.** (✅ v26.124.0) README/README.ko 의
      설치 절 끝에 명령 2줄 + 설명 1문단 추가. **기능 나열 표를 만들지 않았고** 새 H2 섹션도
      만들지 않았다 — v26.118.0 README 구조 실측 결론(393→102줄)을 지키기 위해 설치 절 안에
      붙였다. 102 → 111줄(양쪽 동일). llms.txt 는 USAGE 를 "commands, flags" 로 가리키고 있어
      수정 불요(명령을 열거하지 않는 파일).

- [x] **F-2 — branch coverage 가 실행마다 흔들린다.** (✅ v26.124.0 — 원인 규명, 코드 변경 없음.
      **직전 판정 일부를 정정한다.**) 재현됨: 동일 트리 8회에서 분모가 1370/1371/1373 으로
      갈렸다. 원인 = **v8 provider 는 branch map 을 소스가 아니라 실행에서 유도한다** — 그 실행에서
      호출되지 않은 함수의 분기는 리포트에 아예 안 실린다. 갈리는 파일은 `env-files.ts` ·
      `fs-ops.ts` · `installer.ts` (파일시스템 상태에 따라 경로가 갈리는 모듈들).

      **정정 ①**: "게이트가 threshold 근처에서 flaky" 는 과장이었다. 실측 진폭은
      **0.023%p** (89.562 / 89.570 / 89.585) — 분자·분모가 같이 움직여 비율이 거의 안 변한다.
      현재 여유 1.56%p = 진폭의 **68배**. v26.70.1 의 87.94% 미달은 flake 가 아니라 진짜 미달이었다.

      **정정 ②**: "3회 오기"의 원인도 flake 가 아니었다. 3건 중 flake 로 설명되는 건 1건뿐이고
      (89.12↔89.13), 나머지 2건은 **측정 전에 적었다 / 적고 나서 코드를 더 고쳤다** — 절차 실패다.
      교훈은 "flake 때문에 못 믿는다"가 아니라 **"커밋 직전에 재측정한다"** 이다.

      **결정**: istanbul provider 로 교체하지 않는다 — 의존성이 늘고 모든 threshold 재기준선이
      필요한데, 대가가 0.023%p 다. 유효숫자를 줄여 적는 관행은 유지 (한 자리).
- [x] **F-1f — uninstall 이 프로젝트 루트 수정분을 모른다.** (✅ v26.124.0) install 은 `.claude/`
      밖에도 쓴다: `.mcp.json`(병합) · `.gitignore`(추가줄) · `.env.example` · `.mcp-allowlist` ·
      `.github/workflows/*`(ci-scaffold). uninstall 이 **어느 것도 안내조차 하지 않았다**.
      install 이 `rootFiles` 로 기록 → `uninstall`/`list` 가 안내한다. 자동 삭제는 하지 않는다
      (사용자 내용이 섞임 — F-1d 와 같은 방침). 근거였던 위치: `env-files.ts:62,75,103,128,132` ·
      `ci-scaffold.ts:71`.

<!-- ship-gate:ignore-end -->

---

## 완료 조건 (현 사이클)

C-1 부터 순차 착수. 각 단계 완료 시 본 파일 갱신. 아직 착수하지 않은 구간은 체크박스를 쓰되
`ship-gate:ignore` 구간으로 감싼다 (헤더 참조).

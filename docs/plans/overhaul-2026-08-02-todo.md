# 전체 정비 2026-08-02 — 모델 발전 전제의 하네스 감량

- Status: active
- 지시: 사용자 5개 항목 (2026-08-02) + 이슈 #261(룰)/#262(스킬) — **이슈 지정이 우선**
- 근거 문서: Opus 5 프롬프팅 가이드 · claude.ai CLAUDE.md 가이드 · claude-automation-recommender ·
  Claude Code memory 공식 문서 (2026-08-02 실측)

## 왜 (근거 요약 — 실측 인용)

1. **Opus 5 문서**: "If your prompt contains explicit verification instructions … remove them:
   instructions like these cause over-verification" · "Avoid instructing re-checks it already
   performs" · "legacy harness scaffolding" 제거 지시. → 검증 스캐폴딩 룰·훅이 감량 대상.
2. **CLAUDE.md 가이드**: "under roughly 200 lines" · "Aspirational rules the team does not
   actually follow" 제외 지시. → 이 리포 실측 "룰 3개 지워도 CI 초록"(무는 게이트 0) = aspirational.
3. **memory 공식 문서 (검증 완료)**: `@path` import 는 **프로젝트 스코프 CLAUDE.md 에서 지원**.
   상대경로(파일 기준)·최대 4홉·코드펜스 내 무시. 단 "imported files still load … at launch"
   — import 는 **구조 분리**용이지 상주 절감용이 아니다. 워킹디렉터리 밖 경로는 승인 다이얼로그.
4. **이관 리포 실측**: uzysjung/uzys-agent-skills 에 9스킬 — 이슈 #262 의 통합 지시가 이미 반영됨
   (asis-tobe+explain-plainly→`clear-korean-communication`, north-star 2종→`north-star`,
   consult 2종→`external-model-consult`, gap-analysis-e2e→`audit-service-gaps`).
   설치 = `npx skills add uzysjung/uzys-agent-skills [--skill <name>]`.
5. **star 실측 (2026-08-02, gh api)**: taste-skill ★70,073 · gsap-skills ★12,835 ·
   scroll-world ★6,857 · jakubkrehel/skills ★2,600 → 전부 vetted (≥1,000).
   uzys-agent-skills ★0 → tier official(자사) 유지, trust-tier-drift 제외 확인 필요.

## P1 — 이관 스킬 npx 대체 (#2)

**templates/skills 에서 삭제 = 이관 12 + 폐기 2 = 총 14 디렉터리**
- 이관(12): asis-tobe-decision · explain-plainly · north-star · northstar-roadmap ·
  gap-analysis-e2e · gemini-consult · codex-consult · multi-persona-review · verification-loop ·
  model-orchestration · recurrence-prevention · gh-issue-workflow
- 폐기(2): harness-health-audit · ultracode-service-audit — 이관 리포에 없음.
  **사용자 확정 (2026-08-02 AskUserQuestion): 폐기.**
- **ui-visual-review 는 유지** — 사용자 확정. 유지 룰 2개(playwright-launch·benchmark-parity)가
  절차 SSOT 로 지목 (이슈 #262-2 의 "필요성 검토" 답변 = 유지).

**verification-loop 은 uzys 자작이 아니라 ECC 체리픽(C3, modified)** — 리뷰 P0-2 실측.
처분 = **C3 계약 해체**: `.dev-references/cherrypicks.lock` 의 `ecc-verification-loop` 행 제거 ·
`src/manifest.ts` `MODIFIED_DEV_SKILL_DIRS` 에서 제거(eval-harness 만 잔존) ·
`tests/vnv-verdict.test.ts`·`tests/evidence-templates.test.ts` 갱신. ECC 파생물 재호스팅의
라이선스 귀속은 이관 리포 소관 — PR 본문에 사용자 안내 1줄.

**카탈로그 대체**: external-assets.ts 의 기존 internal 엔트리 삭제 → 신규 엔트리 9개
(`method: { kind: "skill", source: "uzysjung/uzys-agent-skills", skill: "<name>" }`,
tier official, source uzys). condition 은 전신(前身) 보존:
- clear-korean-communication ← asis-tobe(has-dev-track) ∪ explain-plainly(opt-in) → has-dev-track
- external-model-consult ← gemini/codex-consult → opt-in
- north-star / audit-service-gaps / multi-persona-review / verification-loop /
  gh-issue-workflow / recurrence-prevention → 전신 condition (manifest 전용이던 것은 has-dev-track)
- model-orchestration → opt-in

**manifest.ts**: 트랙별 스킬 배열에서 14개 제거. **.claude/skills (개발용)**: 동일 14개 제거
(이 리포에 재설치는 docker-only 훅이 막으므로 사용자 수동 `npx skills add` 안내).

## P2 — 카탈로그 12종 제거 (#3)

impeccable · polars-K-Dense · dask-K-Dense · python-resource-management ·
python-performance-optimization · c-level-skills · business-growth-skills · pm-skills ·
marketing-skills(alirezarezvani — **marketingskills(coreyhaines31) 는 유지**) ·
research-summarizer · playwright-skill · karpathy-coder

- karpathy-coder 삭제 ⇒ 딸린 `templates/hooks/karpathy-gate.sh` + installer/manifest 배선 +
  `tests/install-karpathy-hook.test.ts` 도 삭제 (Opus 5 "legacy scaffolding" 정확 해당 —
  Write|Edit 마다 Python complexity 검사).
- 개발용 `.claude/skills/impeccable` + 하위 스킬 16개 dir (adapt…typeset) 삭제 —
  삭제 전 provenance 확인(impeccable 산 여부).

## P3 — 프론트엔드 스킬 4종 (#4)

| id | tier | method | 설명(명료화) |
|---|---|---|---|
| better-interface-skills (jakubkrehel/skills) | vetted ★2.6k | skill | 인터페이스 품질 7종 세트 — UI 디테일·타이포·OKLCH 색·접근성·레이아웃·UX 라이팅을 각각 별도 스킬로 리뷰·개선 |
| taste-skill (Leonxlnx) | vetted ★70k | skill | 안티-슬롭 프론트엔드 디자인 — AI 생성 UI 의 보일러플레이트 느낌을 제거, 디자인 언어 추론 + VARIANCE/MOTION/DENSITY 조절, 미니멀·브루탈리스트 등 스타일 변형 포함 |
| gsap-skills (greensock) | **기존 엔트리 유지** ★12.8k | plugin | 설명 현행 충분 — 검증만 |
| scroll-world (oso95) | vetted ★6.8k | skill | 브랜드를 스크롤 연동 3D 월드 랜딩페이지로 — 장면 인터뷰→AI 자산 생성→연속 카메라 비행 스크롤 엔진 구성 |

category=frontend (impeccable 과 동일 그룹), condition=opt-in. multi-skill repo 의 skills-cli
호출 형태(--skill 필수 여부)는 구현 시 기존 18개 kind:skill 선례로 확정.

## P4 — 룰·훅 정비 (#1, 이슈 #261)

**templates/rules 21 → 9** — 사용자가 개발용에서 지운 3개의 미러 + 기술스택 상세 룰:
- 삭제(12): code-style · error-handling · no-false-ship (사용자 전례 미러) + htmx · nextjs ·
  pyside6 · shadcn · tauri · data-analysis · database · api-contract · design-workflow
  (#261-1 "특정 기술스택 예외·엣지케이스 상세" — 모델이 이미 아는 것)
- 유지(9): git-policy · test-policy · ship-checklist · doc-governance · change-management ·
  cli-development · playwright-launch · benchmark-parity · gates-taxonomy (개발용 잔존 9개 미러)
- 삭제된 룰을 참조하는 곳 전부 정리 (ship-checklist→no-false-ship 참조 등) — grep 전수.

**templates/hooks 6 → 4**:
- 삭제: karpathy-gate.sh (P2 연동) · spec-drift-check.sh (미배선 + 안 뭄 실측 — 참조하는
  doc-governance/ship-checklist 문안도 정정. ⚠ `tests/spec-drift-backlog-exemption.test.ts` 는
  훅이 아니라 **테스트가 물고 있는** 게이트이므로 유지 여부 별도 판단 — 유지 추천)
- 유지: protect-files · session-start · mcp-pre-exec · checkpoint-snapshot
- 개발용 .claude/hooks 미러 (docker-only-realcli 유지).

**⚠ 이 리포 트랙의 룰 파일과 배포판 룰 파일은 내용이 다르다** — 삭제는 파일 단위 미러,
문안 수정은 양쪽 각각 확인 (같은 이름 두 대상 함정).

## P5 — @import 기반 앵커 (#5) — 리뷰 P0-3 반영: 4-CLI TOBE 를 명시

**`templates/CLAUDE.md` 는 4-CLI 앵커의 단일 원본이다 — 경로·파일명 절대 불변.**
바꾸는 것은 **claude 의 설치 타깃 하나뿐**이다:

| CLI | ASIS | TOBE |
|---|---|---|
| claude | `templates/CLAUDE.md` → `.claude/CLAUDE.md` | → 루트 **`CLAUDE-uzys-harness.md`** + 루트 CLAUDE.md 에 관리 마커 import 1줄 |
| codex | AGENTS.md 에 본문 embed (`src/codex/agents-md.ts`) | **무변경** (@import 미지원) |
| opencode | AGENTS.md 에 본문 embed | **무변경** |
| antigravity | `.agents/rules/uzys-harness.md` (transform.ts 경로 하드코딩) | **무변경** |

소유 분리(하네스 파일 덮어쓰기 갱신 vs 사용자 CLAUDE.md 불가침)는 **claude 한정**임을 명시 —
나머지 3 CLI 는 이미 하네스 소유 파일(AGENTS.md 등)에 렌더되는 구조라 목적이 자연 충족됨.

- 루트 `CLAUDE.md`: 없으면 import 줄 + fill-scaffold 로 생성. 있으면 **덮어쓰기(현행)를
  마커 import 1줄 idempotent 추가로 변경** — 이는 계약 변경이다 (리뷰 P1-5):
  `writeRootClaudeMd`·`rootClaudeMdLog`(sha 판별)·backup·`update-mode`(refreshOnly)·
  `uninstall`(신규 파일 회수 경로 등록)·`install-log` 동반 수정.
- context-cost: 라벨·경로 갱신. items 순변화 0 (앵커 파일이 이동할 뿐 2개 유지).
- `tests/lane-principle-anchor-parity.test.ts` (CLI_BASES derive) 정합 확인.
- **신규 게이트 (테스트 레인 = 오케스트레이터가 C 착수 전 red 로 작성)**: ⓐ 생성된 루트
  CLAUDE.md 에 import 줄 정확히 1개 ⓑ 재실행 idempotent ⓒ 기존 사용자 CLAUDE.md 본문 무손실.

## 문서·마감 (오케스트레이터 직접)

- ADR-060 (이 정비 전체 — 왜 지금, 무엇을 지웠고 왜, 적용 범위)
- CLAUDE.md(이 리포) 수치·미해결 항목 갱신 · REFERENCE.md 카운트 · 백로그(G/H 진척) ·
  cost:baseline 재생성 (마지막 1회)
- 사용자 워크트리 변경 중 `.claude/settings.json`(M)·`.omc/` 는 **커밋 제외**.
  `.claude/rules` 삭제 3건은 P4 와 일체라 **포함** (PR 에 명시).

## 레인 배치 (ulw) — 리뷰 P0-5 반영: 파일의 **배타적 소유**

| 레인 | 담당 | **배타 소유 파일** |
|---|---|---|
| 계획 리뷰 | 독립 에이전트 ✅ 완료 (조건부→반영) | 이 문서 |
| A (구현) | implementer, worktree | `src/external-assets.ts` **전체**(karpathy 엔트리 포함) · manifest **스킬 배열+MODIFIED 상수** · `templates/skills/*` · `.claude/skills/*` · `.dev-references/cherrypicks.lock` · **karpathy 배선 전체**: `src/types.ts`(withKarpathyHook) · `src/prompts.ts` · `src/commands/install.ts`(플래그) · `src/commands/install-render.ts` **전체**(훅 표시줄 564 포함 — spec-drift 제거 반영) · `src/settings-merge.ts` · `src/installer.ts` **karpathy 절만** · `src/opencode/commands.ts` · `src/trust-tier-drift.ts` · `src/install-log.ts`(스킬 참조) · `scripts/gen-compatibility.mjs` · `scripts/check-absence.sh` · `scripts/prune-ecc.sh` · tests: external-assets(총계 66→**55**) · interactive · vnv-verdict · evidence-templates · install-karpathy-hook(삭제) · installer-cli-matrix:321,341 · cli-external-path:241 · settings-merge |
| B (구현) | implementer, worktree | `templates/rules/*` · `.claude/rules/*`(파일 삭제 없음 — 이미 사용자가 지움) · `templates/hooks/spec-drift-check.sh`·`.claude/hooks/spec-drift-check.sh` 삭제 · manifest **룰·훅 배열**(RULES·ALWAYS_HOOKS) · `src/installer.ts` **훅 절만**(karpathy 제외) · doc-governance·ship-checklist **양판**(이 리포판+배포판 — 같은 이름 두 대상) 문안 정정 · tests: manifest(31,36-38,47-48,192) · installer-11-track(TRACK_EXPECTATIONS) · installer-track-matrix · settings-reference-parity · **resident-doc-asset-reachability 임계값**: `docTracks>10`→`>5` · `references>4`→`>2` (모수 21→10 축소에 맞춘 탐지기 하한 조정 — 커버리지 최소선이 아니라 0-match 함정 방지 canary) · spec-drift-backlog-exemption(유지 — 훅 아닌 테스트 게이트) |
| C (구현) | implementer, **A+B 머지 후** 메인 트리 | `src/installer.ts`(writeRootClaudeMd·백업·로그) · `src/project-claude-merge.ts` · manifest **CLAUDE.md 앵커 엔트리** · `src/commands/uninstall.ts` · `src/update-mode.ts` · `src/context-cost.ts` · tests: backup-collision · uninstall · project-claude-merge · context-cost · lane-principle-anchor-parity |
| 테스트(P5 게이트) | 오케스트레이터 (C 착수 전 red 작성) | `tests/claude-md-import.test.ts` (신규) |
| 검증 | 오케스트레이터 + 독립 코드리뷰 에이전트 | npm run ci · Docker 실설치(AC8) · 음성 대조 · 전체 diff |

- A·B 병렬(worktree) → 패치 파일로 수거 → 오케스트레이터가 순차 적용·머지. `src/manifest.ts` 는
  두 레인이 **다른 배열**만 만진다(A=스킬·MODIFIED, B=룰·훅) — 헝크 비충돌 확인 후 적용.
- A·B·C 는 baseline·NORTH_STAR·CLAUDE.md(리포)·REFERENCE.md·COMPATIBILITY.md 를 **건드리지
  않는다** — 마감에서 오케스트레이터가 1회: `npm run gen:compat` 재생성 + `cost:baseline` +
  문서 수치(REFERENCE·external-assets.ts 헤더 주석 총계 — docs-supply-chain:214,226,252,284,352 게이트 대응).
- north-star·gh-issue-workflow 는 현재 **전 트랙 상주**(COMMON_SKILL_DIRS) — 대체 엔트리 condition
  은 전 트랙 보존(전 트랙 나열 any-track 또는 상당 표현). 강등 금지 (리뷰 P1-3).
- DEV_METHOD_SKILL_IDS 8→1 · INTERNAL_BUNDLED_SKILL_IDS → compaction-handoff 등 잔존만.
  상수·개념은 유지, 주석 수치 갱신 (리뷰 P1-2).
- 서브에이전트 git 조작 금지(diff 생성은 허용) — 커밋은 전부 오케스트레이터.
- 이슈 #261-2(유지 9룰 본문 정비)는 **이번 사이클 범위 밖** — 백로그 H 잔여로 이월 (사유:
  파일 단위 감축과 본문 재작성을 한 PR 에 섞으면 리뷰 불능).

## AC (완료 기준) — 판정 술어 명시 (리뷰 P2-2)

- [ ] AC1 카탈로그 총계 **55** (66 − 12 카탈로그 − 11 internal + 9 uzys + 3 frontend) —
      `tests/external-assets.test.ts` 총계 단언 green + `EXTERNAL_ASSETS` 에 신규 12 id 존재
- [ ] AC2 templates/skills **14 dir 부재**(ls) · manifest·installer 의 **기능 참조 0**
      (import·경로·배열·단언·사용자 표시 문자열 — 역사 서술 주석은 제외, 리뷰 P2-5) —
      `scripts/check-absence.sh --canary compaction-handoff` 로 부재 검증
- [ ] AC3 templates/rules **9개**·hooks **4개**(ls 개수) + 삭제 룰·훅명이 유지 룰/설치 표면에
      기능 참조 0
- [ ] AC4 신규 게이트 3종(tests/claude-md-import.test.ts) green — import 1줄 · idempotent ·
      기존 본문 무손실
- [ ] AC5 `npm run ci` exit 0 (coverage·ratchet·docs-supply-chain 포함)
- [ ] AC6 ADR-060 존재 (BREAKING 적용 범위 절: `--with-karpathy-hook` 플래그 삭제 포함, 리뷰 P2-4)
      + `npm run gen:compat` 재생성 + baseline 재생성 + REFERENCE 총계 = 55
- [ ] AC7 PR 생성 — 확정 3건(3룰 포함 커밋·감사 2종 폐기·ui-visual-review 유지) +
      spec-drift-check 훅 제거 + ECC 귀속 안내 명시. **머지는 사용자 승인**
- [ ] AC8 **Docker 실설치 스모크**: `npx skills add uzysjung/uzys-agent-skills --skill <1종>` 이
      `.agents/skills/` 레이아웃을 실제로 발견·설치하는지 (리뷰 P1-4 — 레지스트리명 ≠ dir 명
      함정 전례). 실패 시 9 엔트리는 "미검증" 표기로 PR 에 명시

gsap-skills description 은 현행 유지 — 근거: 공식 출처·8스킬 구성·영역(timeline·scrolltrigger·react)이
이미 명시돼 있어 사용자 지시 "명료한 description" 을 충족 (리뷰 P2-3).

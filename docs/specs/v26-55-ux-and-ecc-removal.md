# SPEC: v26.55.0 — Phase 2 grouped UX + Phase 1 ECC removal + 자산 설명 보강

> **Status**: Draft (2026-05-16)
> **Predecessor**: v26.54.1 (install failure hotfix)
> **Trigger**: 사용자 피드백 — "설치 실행 시 그룹 구조로 진행상황 + 자산 설명 보강 + Phase 1 ECC 항목 제거".

---

## 1. Objective

1. Phase 2 (External Assets) 진행상황을 Step 3 의 카테고리 그룹 구조와 동일하게 표시
2. EXTERNAL_ASSETS 의 핵심 자산 description 보강
3. Phase 1 baseline 의 ECC cherry-pick 항목 (agents/skills/commands) 을 `withEcc` opt-in 으로 gating

## 2. AC

- **AC1**: Phase 2 출력이 카테고리 헤더 (`━━ Frontend ━━`) 로 그룹화. 동일 카테고리 자산 인접 표시
- **AC2**: external-installer 가 자산을 카테고리 순서로 정렬 (CATEGORY_ORDER 기준)
- **AC3**: 5+ 자산 (impeccable, playwright-skill, architecture-decision-record, shadcn-ui, ecc-plugin) description 이 1줄 의미있는 설명으로 보강
- **AC4**: Phase 1 baseline 에서 ECC cherry-pick 4 agents + 9 skills + commands/ecc 디렉토리 모두 `withEcc=true` 일 때만 manifest 포함
- **AC5**: 기존 manifest test 회귀 0. 신규 test 추가:
  - python-* skills 가 withEcc 없으면 빠지는지
  - e2e-testing 이 withEcc 없으면 빠지는지
- **AC6**: branch coverage 88% 유지

## 3. ECC 분리 매핑

| 분류 | 본 프로젝트 (always) | ECC (withEcc 필요) |
|---|---|---|
| **Core Agents** | reviewer, data-analyst, strategist | code-reviewer, security-reviewer |
| **Dev Agents** | plan-checker | silent-failure-hunter, build-error-resolver |
| **Common Skills** | north-star, gh-issue-workflow | continuous-learning-v2, strategic-compact, deep-research |
| **Dev Skills** | (없음) | eval-harness, verification-loop, agent-introspection-debugging |
| **UI Skills** | ui-visual-review | e2e-testing |
| **Python Skills** | (없음) | python-patterns, python-testing (data\|csr-fastapi\|full 트랙 + withEcc) |
| **Commands** | uzys/ (withUzysHarness) | ecc/ (withEcc) |

## 4. Phase 2 UX

ASIS:
```
━━━ Phase 2 · External Assets ━━━
  → desc...
  ✓ railway-skills    [meta]
  → desc...
  ⊘ impeccable        [error]
```

TOBE:
```
━━━ Phase 2 · External Assets ━━━

  ━━ Frontend ━━
    → shadcn-ui ...
    ✓ shadcn-ui                 plugin · ...
    → impeccable ...
    ⊘ impeccable                npx exited 1

  ━━ Backend ━━
    → railway-skills ...
    ✓ railway-skills            plugin · ...

  ━━ Dev Tools ━━
    → architecture-decision-record ...
    ✓ architecture-decision-record    skill · ...
```

## 5. 변경 코드 요약

- `src/manifest.ts` — `AssetSpec.withEcc` 추가. CORE_AGENTS/DEV_AGENTS/COMMON_SKILL_DIRS/DEV_SKILL_DIRS/UI_SKILL_DIRS 분리 + 신규 `*_ECC` 리스트. `commands/ecc` 매핑 `(s) => Boolean(s.withEcc)` gating
- `src/installer.ts` — `buildManifest` 호출 시 `spec.options.withEcc` 전달
- `src/external-installer.ts` — `filterApplicableAssets` 결과를 CATEGORY_ORDER 순서로 정렬 후 install
- `src/commands/install.ts` — Phase 2 callback 에 `currentCategory` 추적 + `━━ <CATEGORY_TITLES[cat]> ━━` 헤더 출력
- `src/external-assets.ts` — 5 자산 description 보강 (impeccable, playwright-skill, ADR, shadcn-ui, ecc-plugin)

## 6. Non-Goals

- 다른 7 자산 (사용자 환경에서 race 의심) 의 추가 디버깅 — 본 cycle 에서 grouped UX 로 패턴 가시화. 재현 보고 시 후속 cycle
- description 의 i18n (한/영 다중 어휘) — 단일 한국어 유지

## 7. 위험

- `withEcc=false` 가 default 인 fresh install 은 기존 baseline 대비 (agents -4, skills -9) 줄어듦 → 사용자 명시 의도라 BREAKING 이지만 의도된 동작
- 카테고리 정렬이 EXTERNAL_ASSETS 정의 순서와 다르면 일부 test fixture 영향 — 검증 완료 (573 pass)

## 8. Changelog
- 2026-05-16: 초안. v26.54.0 머지 후 실사용 피드백 기반.

# 계획 리뷰 — `docs/plans/overhaul-2026-08-02-todo.md`

- 리뷰어: 독립 검증 레인 (이 계획을 쓰지 않음)
- 일시: 2026-08-02
- 대상 리포: `/Users/uzysjung/Development/Claude-Workspace/uzysClaudeUniversalEnv` (읽기 전용 · 파일 수정 0 · git 조작 0)
- 방법: 계획 서술을 리포 실측(grep/gh api/파일 읽기)으로 대조. 추정 항목은 "미검증"으로 표기.

---

## 판정: **조건부** — P0 5건을 계획서에 반영한 뒤 착수

계획의 **삭제 목록 자체는 대체로 정확하다**(V1·V2 실측 통과). 막히는 곳은 **삭제의 파급**이다 —
현행 게이트 중 최소 1개는 **계획대로 하면 반드시 red 가 되는데 계획이 그것을 예고하지 않았고**,
삭제 대상 1개는 **소유 계보가 계획의 전제와 다르며**, P5 는 4-CLI 중 1개만 설계돼 있다.

| 축 | 결과 |
|---|---|
| V1 삭제 목록 ↔ 지시 1:1 | **부분 통과** — 12종 목록·marketing 구분 정확 / 지시(#262) 항목 2건 누락 |
| V2 이관 9스킬 매핑 | **통과** (1건 계보 오류 — P0-2) |
| V3 깨질 참조 인지 | **미달** — 계획 미언급 참조처 다수 (P0-1·P0-5·P1-1~3) |
| V4 P5 ↔ 기존 테스트 충돌 예고 | **미달** — 4-CLI 앵커·설치로그·uninstall 미예고 (P0-3·P1-5) |
| V5 레인 파일 충돌 분석 | **미달** — A/B 동시 편집 파일 실재 + 무주공산 파일 5개 (P0-5) |
| V6 AC 기계 검증성 | **부분** — AC2/AC5 는 가능, AC1/AC3/AC6 는 판정 술어 없음 (P2-2) |

---

## P0 — 착수 전 수정 필수

### [P0-1] `resident-doc-asset-reachability` 자기검사가 **결정적으로** red 가 된다 — 계획 미언급

`tests/resident-doc-asset-reachability.test.ts:196`
```
expect(docTracks.size).toBeGreaterThan(10);
```
`docTracks` = manifest 가 내는 **상주 문서 source 집합** = `.claude/rules/*.md` + `.claude/CLAUDE.md`
(같은 파일 `isResidentDoc()`, line 57-59).

현재 값 — `src/manifest.ts:63-95` 에서 전 트랙 union 산출:
- COMMON_RULES 5 + DEV_RULES 4 + UI_RULES 3 + TRACK_RULES union 8 = **20**
- `tauri` 는 `tauri-desktop` 이 `condition: opt-in` (`src/external-assets.ts:240`) 이라 기본 설치에서 제외
- + `.claude/CLAUDE.md` 1 → **현재 21**

P4 적용 후 — 유지 9개(git-policy·change-management·gates-taxonomy·doc-governance·test-policy·
ship-checklist·playwright-launch·benchmark-parity·cli-development) + CLAUDE.md 1 = **10**.
`10 > 10` 은 **false → FAIL**. P5 가 `.claude/CLAUDE.md` 설치까지 중단하면 **9** 로 더 내려간다.

같은 파일 `line 193 expect(references).toBeGreaterThan(4)` 도 위험하다. 유지 9룰이 자산을 이름으로
지목하는 곳은 실측 4곳뿐이다 — `templates/rules/playwright-launch.md:5,19` · `benchmark-parity.md:21`
(→ ui-visual-review), `doc-governance.md:74` (→ spec-scaling). 지목 하나만 더 지워지면 `4 > 4` 로 FAIL.
(그리고 이 4곳이 P0-4 의 `ui-visual-review` 처분과 직접 얽힌다.)

**요구**: 계획서에 ⓐ 이 게이트의 임계값 2개가 감축 자체와 충돌한다는 사실 ⓑ 임계값을 고칠 것인지
(고치면 "게이트를 감축에 맞춰 완화"가 되므로 근거가 필요) 판정을 명시할 것. 지금은 AC5(`npm run ci` exit 0)가
어떻게 달성되는지 계획서 어디에도 없다.

---

### [P0-2] `verification-loop` 은 uzys 자작이 아니라 **ECC cherry-pick(C3, modified)** 이다 — 전제 오류

계획 P1 은 이 스킬을 "uzys 직접 제작 → 이관 리포로 이동 → npx 대체" 로 분류한다. 실측은 다르다:

`.dev-references/cherrypicks.lock`
```
ecc-verification-loop | .agents/skills/verification-loop/ -> templates/skills/verification-loop/ | modified: true
```
출처 = `affaan-m/everything-claude-code` (같은 파일 `sources.ecc`).

이 계보는 코드에 배선돼 있다:
- `src/manifest.ts:163` `MODIFIED_DEV_SKILL_DIRS = ["verification-loop", "eval-harness"]`
- `src/manifest.ts:171` `export const MODIFIED_ECC_SKILL_DIRS` — **공개 export**
- `tests/vnv-verdict.test.ts:73` `expect(MODIFIED_ECC_SKILL_DIRS).toContain("verification-loop")` — **하드 단언, 반드시 FAIL**
- `tests/evidence-templates.test.ts:102-107` — `MODIFIED_ECC_SKILL_DIRS` 전수 순회
- `src/manifest.ts:165-170` 주석: lock 의 `modified:true` 와 **1:1 이어야** `sync-cherrypicks.sh --apply` 의
  `rsync --delete` 가 로컬 수정을 조용히 덮어쓰지 않는다

즉 삭제는 스킬 1개 제거가 아니라 **C3 cherry-pick 계약의 해체**다. 계획은 lock·sync 스크립트·
`MODIFIED_ECC_SKILL_DIRS` 소비자를 한 줄도 언급하지 않는다.

부수 쟁점(계획이 판단해야 함): 이관 리포 `uzysjung/uzys-agent-skills/.agents/skills/verification-loop`
는 ECC 파생물의 재호스팅이다. 라이선스·귀속 처리가 필요한지 여부를 계획이 정하지 않았다.

**요구**: verification-loop 을 ⓐ ECC 계보 유지(삭제 제외) ⓑ ECC 계약 해체 + lock/테스트/export 동시 정리
중 무엇으로 처리할지 명시하고, ⓑ 면 영향 파일 4개를 레인에 배정할 것.

---

### [P0-3] P5 가 **4-CLI 중 claude 하나만** 설계돼 있다 — 이 리포가 3회 재발로 기록한 실패 유형

`templates/CLAUDE.md` 는 claude 전용 파일이 아니다. **4개 CLI 앵커 전부의 단일 원본**이다:

| CLI | 산출물 | 원본 참조 |
|---|---|---|
| claude | `.claude/CLAUDE.md` | `src/manifest.ts:204-205` (`source: "CLAUDE.md"`) |
| codex | `AGENTS.md` | `src/codex/agents-md.ts:24-34` — `{PROJECT_RULES}` 에 **CLAUDE.md 본문 전문 embed** |
| opencode | `AGENTS.md` | `src/opencode/agents-md.ts:24-28` — 동일 |
| antigravity | `.agents/rules/uzys-harness.md` | `src/antigravity/transform.ts:102` — `join(harnessRoot, "templates/CLAUDE.md")` **하드코딩 경로** |

계획 P5 는 "`.claude/CLAUDE.md` 앵커 설치 중단 · 루트 `CLAUDE-uzys-harness.md` 로 이동 · 루트
`CLAUDE.md` 에 `@import` 1줄" 만 적는다. 그 결과 두 가지가 미결로 남는다:

1. `templates/CLAUDE.md` 를 옮기거나 이름을 바꾸면 **3 CLI 렌더러가 동시에 깨진다**
   (antigravity 는 경로 하드코딩이라 조용히 `null` 로 빠져 앵커가 아예 안 나간다 — transform.ts:99
   "부재 시 null (graceful — install 진행)"). graceful fallback 이라 **테스트가 아니라 사용자가 발견**한다.
2. `@import` 는 Claude Code 고유 기능이다. codex/opencode/antigravity 에는 대응물이 없으므로
   "하네스 내용과 사용자 내용의 소유 분리"라는 P5 의 **목적 자체가 claude 에만 도달한다.**

`tests/lane-principle-anchor-parity.test.ts:170-196` 은 앵커 집합을 `CLI_BASES` 에서 derive 하고
`앵커 수 == CLI_BASES.length` 를 단언한다 — 비대칭이 생기면 문다. 계획은 이 게이트를 언급하지 않는다.

이 리포 메모리에 남은 재발 기록: *"한 축이 계열 일부에만 있으면 빠진 쪽이 입증 책임 — **3회 연속** 적발"*.
P5 는 정확히 그 형태다.

**요구**: P5 에 4-CLI 각각의 TOBE 를 표로 적을 것. `@import` 미지원 CLI 를 "현행 유지(전문 embed)"로
둘 것인지, 그렇다면 소유 분리가 claude 한정임을 명시할 것. `src/codex/` · `src/opencode/` ·
`src/antigravity/` 를 레인에 배정할 것.

---

### [P0-4] 사용자 지시(이슈)에서 **2건이 계획에서 사라졌다** — 계획 스스로 "이슈 지정이 우선"이라 선언

계획 line 4: *"지시: 사용자 5개 항목 + 이슈 #261(룰)/#262(스킬) — **이슈 지정이 우선**"*.

**누락 ⓐ — `ui-visual-review`.** 이슈 #262-2 의 검토 대상 8개는
`harness-health-audit, multi-persona-review, gap-analysis-e2e, model-orchestration,
recurrence-prevention, ui-visual-review, ultracode-service-audit, verification-loop` 다.
계획은 7개를 처리하고 `ui-visual-review` 만 통째로 뺐다. 이 스킬은
- `templates/skills/ui-visual-review/` 실재 · 이관 리포 9스킬에 **없음**(gh api 실측)
- 즉 harness-health-audit / ultracode-service-audit 과 **같은 부류**인데 폐기 판단도 유지 판단도 없다
- 유지 대상 룰 2개(`playwright-launch` · `benchmark-parity`)가 이것을 **SSOT 로 지목**한다
  (`templates/rules/playwright-launch.md:5,19` · `benchmark-parity.md:21`) → P0-1 의 `references>4` 와 직결

**누락 ⓑ — 이슈 #261-2.** *"부연 설명이 너무 많거나 다른 스킬을 참조해서 무결성이 깨질 수 있는 것들 정리"*.
계획 P4 는 **파일 삭제만** 한다(#261-1). 유지 9개 룰의 본문 정비는 한 줄도 없다. 그런데 유지 대상이
정확히 그 증상을 갖고 있다 — `playwright-launch.md` · `benchmark-parity.md` 는 절차 SSOT 를
외부 스킬에 위임하고, `test-policy.md` 는 인용 블록 안에 장문의 실측 서사를 담고 있다.

**요구**: `ui-visual-review` 처분을 P1 또는 P4 에 명시(폐기/유지/이관 요청 중 택1). #261-2 를
별도 항목으로 세우거나, 이번 사이클 범위 밖임을 근거와 함께 선언할 것.

---

### [P0-5] 레인 파일 영역이 실제 편집 지점을 덮지 못한다 — A·B 동시 편집 + 무주공산 5파일

계획 line 116-123 의 레인 표를 실측 참조와 대조한 결과:

**ⓐ A·B 가 같은 파일을 편집한다 (충돌 확정)**

| 파일 | A(스킬) 사유 | B(룰·훅) 사유 |
|---|---|---|
| `tests/interactive.test.ts:505-514` | 추천 기준선에 `asis-tobe-decision`·`northstar-roadmap`·`harness-health-audit` | 같은 배열 line 505 에 `karpathy-coder` (P2 삭제) |
| `tests/external-assets.test.ts:133` | 카탈로그 총계 `toHaveLength(66)` — 스킬 엔트리 삭제로 변함 | karpathy 엔트리 삭제로도 변함 |
| `src/external-assets.ts` | internal 엔트리 11개 삭제 + 신규 12개 | `karpathy-coder` 엔트리(1052)는 B 의 훅 삭제와 일체 |

계획은 karpathy 를 "P2(카탈로그, A 영역) 인데 훅 삭제는 P4(B 영역)" 로 쪼개 놓고 그 사실을
`(P2 연동)` 넉 자로만 표기했다. 실제로는 **한 자산이 두 레인에 걸친다.**

**ⓑ 어느 레인에도 없는 파일 (karpathy 배선 실측)**
```
src/types.ts:78-80              withKarpathyHook 플래그
src/prompts.ts:110              wizard 미노출 주석
src/commands/install.ts:365-371 --with-karpathy-hook CLI 플래그 + example
src/commands/install-render.ts:296-304  훅 결과 렌더
src/settings-merge.ts:4-6       모듈 존재 사유 자체가 karpathy auto-wire
```
추가로 **삭제 대상 문자열을 하드코딩한 표시 문자열**이 무주공산에 있다:
```
src/commands/install-render.ts:564  "session-start · spec-drift · checkpoint · mcp-pre-exec (security)"
src/commands/install-render.ts:575  "north-star · gh-issue-workflow · ui-visual-review · cl-v2 (modified)"
```
둘 다 **삭제 후 거짓 표시**가 된다(사용자 도달 표면 = 설치 요약). 계획 미언급.

그 밖의 미배정 참조: `src/opencode/commands.ts:21`(gemini/codex-consult) ·
`src/trust-tier-drift.ts`(gemini-consult) · `src/install-log.ts`(multi-persona-review) ·
`scripts/gen-compatibility.mjs`(gemini-consult·model-orchestration·tauri) ·
`scripts/check-absence.sh`(recurrence-prevention) · `scripts/prune-ecc.sh`(nextjs·database).

**요구**: 레인 표를 **파일 목록이 아니라 배타적 소유**로 다시 그릴 것. karpathy 는 한 레인에 통째로
주거나(권장: B), A→B 순차로 못 박을 것. 위 미배정 파일 전부를 배정할 것.

---

## P1 — 수정 권장 (합리적 사유 있으면 예외 가능)

### [P1-1] 카탈로그 총계 게이트 3중 — 계획은 `REFERENCE.md` 하나만 적었다
- `tests/external-assets.test.ts:133` `expect(ids).toHaveLength(66)` — 하드코딩. 실측 결과
  삭제 23(카탈로그 12 + internal 11) / 신규 12(uzys 9 + frontend 3, gsap 기존) → **55**.
- `tests/docs-supply-chain.test.ts:284` — *"현행 사용자 도달 문서 **전체(글롭)**의 카탈로그 총계 분모"*.
  즉 `REFERENCE.md` 만 고치면 다른 문서에서 red 가 난다. 면제는 `<!-- catalog-total:frozen -->` 표식.
- `tests/docs-supply-chain.test.ts:214,226,252` — `COMPATIBILITY.md` 자동생성 블록 + 각 자산 CLI 라벨
  전수 일치 + 서문의 dev-method 수. **`npm run gen:compat` 재생성이 필수**인데 계획 마감 절차에 없다.
- `tests/docs-supply-chain.test.ts:352` — `src/external-assets.ts` **주석의** 자산 총계·dev-method 수.

### [P1-2] `DEV_METHOD_SKILL_IDS` 8 → 1 — 개념이 사실상 소멸하는데 계획에 서술 없음
`src/external-assets.ts:1121-1133` 의 8개 중 7개가 삭제 대상이고 `compaction-handoff` 만 남는다.
`INTERNAL_BUNDLED_SKILL_IDS`(1142-1154)도 12 → 1 이 된다. 이 상수는
`src/manifest.ts:312` 설치 루프 · `tests/resident-doc-asset-reachability.ts:38` · 4-CLI transform 이
공통으로 도는 superset 이다(1136-1140 주석). "8 has-dev-track methodology skills" 라는 주석 문장이
곧 거짓이 되고 그 문장은 P1-1 의 게이트가 잡는다. 개념을 유지할지 폐기할지 계획이 정해야 한다.

### [P1-3] `north-star`·`gh-issue-workflow` 는 **전 트랙 상주** → 계획은 `has-dev-track` 으로 강등
`src/manifest.ts:146` `COMMON_SKILL_DIRS = ["north-star", "gh-issue-workflow"]` — 조건 없는 전 트랙 설치.
계획 line 42 는 *"manifest 전용이던 것은 has-dev-track"* 이라고 일괄 처리했다. executive /
project-management / growth-marketing 3트랙에서 **조용히 사라진다.** 의도한 축소면 근거를,
아니면 `always` 상당 조건을 적을 것.

### [P1-4] `npx skills add uzysjung/uzys-agent-skills` 의 **호출 형태가 미검증**이고 호스트 검증은 훅이 차단
gh api 실측: 이관 리포는 `skills/` 도 `.claude/skills/` 도 아닌 **`.agents/skills/`** 레이아웃이다
(9개 디렉터리 확인 — 계획의 매핑과 정확히 일치). 그런데 skills-cli 가 이 레이아웃을 발견하는지는
확인되지 않았다. 이 리포는 같은 함정을 이미 문서화해 뒀다 —
`docs/REFERENCE.md:62`: *"skills.sh registry name `vercel-react-best-practices` (GitHub dir 이름과 다름)"*.
그리고 호스트에서의 실 CLI 실행은 `.claude/hooks/docker-only-realcli.sh` 가 차단한다.
**계획 AC 에 Docker 실설치 검증이 없다** — 9개 신규 엔트리 전부가 "설치된다"는 미검증 주장으로 출하된다.
(계획 P3 은 frontend 4종에 대해서만 *"구현 시 기존 18개 선례로 확정"* 이라 적었고, P1 의 9종에는 그마저 없다.)

### [P1-5] P5 는 루트 `CLAUDE.md` 를 **덮어쓰기 → 병합**으로 바꾸는데 파급 미언급
현행: `src/installer.ts:886-892 writeRootClaudeMd()` 가 `mergeProjectClaude()` 결과로 **통째 덮어쓰고**
백업을 남긴다(`installer.ts:604`). 그 원본 해시가 `rootClaudeMdLog {path, sha256}`(`installer.ts:603`)로
기록되고 **uninstall 이 사용자 수정 여부를 그 해시로 판별**한다.
계획의 "있으면 마커로 감싼 1줄만 idempotent 추가" 는 이 계약을 바꾼다. 미언급 영향:
- `src/commands/uninstall.ts` · `src/update-mode.ts`(refreshOnly) · `src/install-log.ts`
- `tests/backup-collision.test.ts` · `tests/uninstall.test.ts` · `tests/project-claude-merge.test.ts`
- **신규 루트 파일 `CLAUDE-uzys-harness.md` 는 `.claude/` 밖**이다. 설치 내역 등록·uninstall 회수
  경로가 정의되지 않으면 제거되지 않고 남는다(ADR-050 이 로그를 `.uzys-agent-harness/` 로 옮긴 맥락).
- `src/context-cost.ts:195-207` 은 `.claude/CLAUDE.md`(앵커) + 루트 스캐폴드 **2개**를 세도록
  방금 고쳐진 코드다. 계획 line 102 의 *"총 상주는 동일"* 은 **items 축에서 거짓**이다 —
  파일이 1개 늘면 `items.claudeMd` 가 오르고 `tests/context-cost-ratchet.ts` 의 개수 축 허용치는
  **절대 +1** 이다(같은 파일 AXES 주석). baseline 재생성이 마감 1회로 충분한지 재검토 필요.

### [P1-6] P4 삭제가 깨는 기존 단언 (계획 "grep 전수"의 실제 대상)
- `tests/manifest.test.ts:31` — DEV_RULES 에 `code-style`·`error-handling` 존재 단언
- `tests/manifest.test.ts:36-38,47-48` — `design-workflow` 트랙 매핑 단언
- `tests/installer-11-track.test.ts:43-55` — `TRACK_EXPECTATIONS` 에 `shadcn`·`api-contract`·`database`·
  `htmx`·`nextjs`·`pyside6`·`data-analysis`·`design-workflow` (삭제 대상 8/12) 하드코딩
- `tests/manifest.test.ts:192` — `ALWAYS_HOOKS` 정렬 비교 (spec-drift 제거 시 변경)
- `tests/installer-track-matrix.test.ts` · `tests/settings-reference-parity.test.ts`(code-style 참조)
- `tests/install-karpathy-hook.test.ts` 외에 `tests/installer-cli-matrix.test.ts:321,341` ·
  `tests/cli-external-path.test.ts:241` 도 `karpathyHook` 를 단언한다 — 계획은 전자 1개만 적었다

### [P1-7] 계획서 내부 수치 불일치 (읽는 사람이 몇 개인지 못 센다)
line 28 `**templates/skills 에서 삭제 (11)**` → 나열 12개 → line 30 `(12개)` → line 34 `총 14`.
`(11)` 은 오기. 그리고 절 제목이 "이관 스킬 npx 대체"인데 실제로는 이관 12 + **폐기 2** 를 함께 담는다.

---

## P2 — 참고

- **[P2-1] 사용자 워크트리 변경 스테이징.** line 111-112 는 사용자가 지운 `.claude/rules` 3건을
  이 PR 에 **포함**한다고 적는다. 전역 원칙 3(*"Pre-existing worktree changes belong to the user.
  Do not overwrite, revert, stage"*)과 정면으로 부딪힌다. "PR 에 명시"보다 **착수 전 사용자 확인**이 맞다.
- **[P2-2] AC 기계 검증성.** AC2·AC5 는 기계 검증 가능. AC1 *"`--list` 표면에 반영"* · AC3 *"참조 정리 완료"* ·
  AC6 *"문서 동기화"* 는 판정 술어가 없다 — 무엇을 실행해 무엇을 보면 통과인지 적어야 한다.
  AC4 는 게이트 3종을 명시해 좋은 형태다.
- **[P2-3] gsap-skills 예외.** 사용자 지시 4 는 4종 모두 "명료한 description" 인데 계획은
  *"기존 엔트리 유지 — 검증만"* 으로 뺐다. 현행 description 이 왜 충분한지 근거 1줄이 필요하다.
- **[P2-4] karpathy 범위 확대.** 지시 3 은 "스킬 제거"인데 계획은 훅·installer·types·prompts·CLI 플래그까지
  제거한다. 타당하지만 **BREAKING(CLI 플래그 삭제)** 이므로 ADR-060 에 적용 범위 절이 필요하다
  (ADR-022 가 자산 플래그 13종 삭제 때 같은 처리를 했다).
- **[P2-5] `no-false-ship` 잔존 참조.** 삭제 후에도 `src/` 13파일 · `tests/` 7파일이 주석으로 이 이름을
  부른다. 기능 무해하나 AC2 의 "죽은 참조 0" 정의가 코드 주석을 포함하는지 계획이 정해야 한다.

---

## 실측으로 **확인된** 것 (계획이 맞은 부분)

1. **P2 카탈로그 12종이 전부 실재하고 id 가 정확하다** — `src/external-assets.ts` line
   173/183/193/207/577/642/922/935/965/998/1035/1052.
2. **`marketing-skills` vs `marketingskills` 구분이 정확하다.**
   `marketing-skills`(998, alirezarezvani, `condition: any-track growth-marketing`) 삭제 ·
   `marketingskills`(1019, coreyhaines31, `opt-in`) 유지. 코드 주석(1013-1018)이 동명이물 병존을
   명시해 두었고 계획의 판단과 일치한다.
3. **이관 리포 9스킬 매핑이 실측과 정확히 일치한다.** `gh api repos/uzysjung/uzys-agent-skills/contents/.agents/skills`
   → `audit-service-gaps · clear-korean-communication · external-model-consult · gh-issue-workflow ·
   model-orchestration · multi-persona-review · north-star · recurrence-prevention · verification-loop`.
   계획의 통합 매핑(asis-tobe+explain-plainly→clear-korean-communication, north-star 2종→north-star,
   consult 2종→external-model-consult, gap-analysis-e2e→audit-service-gaps)이 그대로 성립한다.
4. **`harness-health-audit` · `ultracode-service-audit` 이 이관 리포에 없다는 판단이 맞다** (위 목록 9개에 부재).
   계획이 이것을 "판단 플래그 / 사용자 veto 지점"으로 격리한 처리는 적절하다.
5. **trust-tier ★0 우려는 해소된다.** `src/trust-tier-drift.ts:93-97` 이 `vetted`/`experimental` 만
   판정 대상으로 삼고 `official` 은 건너뛴다(line 5 주석: *"official 은 star 무관 — 하네스 자체"*).
   계획 line 24 의 "확인 필요"는 **확인됨 = 제외 안전**.
6. **`templates/settings.json` 은 spec-drift·karpathy 훅을 참조하지 않는다** — 훅 삭제가
   배포 settings 템플릿을 깨지 않는다(다만 `tests/settings-reference-parity.test.ts` 는 manifest 기반이라
   룰/훅 목록 변경의 영향을 받는다).
7. **P4 룰 산술이 맞다.** `templates/rules` 실측 21개, 삭제 12 → 유지 9, 그 9개가 현재
   `.claude/rules` 잔존 9개와 정확히 같은 집합이다.

---

## 착수 조건 체크리스트

- [ ] P0-1 게이트 임계값 충돌 처리 방침 명시 (`docTracks>10` · `references>4`)
- [ ] P0-2 `verification-loop` ECC 계보 처분 결정 + 영향 4파일 배정
- [ ] P0-3 P5 에 4-CLI TOBE 표 추가 + `src/codex`·`src/opencode`·`src/antigravity` 레인 배정
- [ ] P0-4 `ui-visual-review` 처분 명시 · 이슈 #261-2 처리 또는 범위 밖 선언
- [ ] P0-5 레인 표를 배타적 소유로 재작성 + 미배정 10파일 배정
- [ ] P1-4 Docker 실설치 검증을 AC 에 추가 (9 신규 엔트리)
- [ ] P2-1 사용자 워크트리 3파일 스테이징 사전 확인


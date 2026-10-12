# PR-A (#739) 독립 리뷰 판정 — fix/agents-md-heading-owner @267b1cc (기준 main@6d6c8ec)

## 결론: BLOCKER 1건 있음

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH (BLOCKER) | 1 |
| MEDIUM (NOTE) | 2 |
| LOW (NOTE) | 1 |

---

## [BLOCKER-1] ④ 를 막은 방법(집합 대조)이 마커 없는 옛 판의 은퇴한 앵커 6절을 "설치자 절" 로 되살린다 — 완료 기준 ① 이 마커 없는 경로에서 깨진다

**설치자에게 무슨 일이 생기나**: v26.151.0·v26.152.0(npm 게시됨, 앵커 제목 `## 1. Resolve what matters, then act` …
`## 6. Keep authority explicit`, 마커 도입 v26.160.0 전) 으로 codex 를 설치한 사람이 **아무것도 안 고친 채** update 하면,
AGENTS.md 끝에 옛 6원칙 절 전체가 붙는다. 새 6원칙과 옛 6원칙이 매 세션 함께 상주한다(서로 다른 지시문 두 벌 — Codex
AGENTS.md 예산도 먹는다). 그 절은 이후 파일 끝 "설치자 절" 로 읽혀 **update 마다 보존되고, uninstall 도 지우지 않는다** —
하네스가 쓴 글이 설치자 디스크에 영구히 남는다(ADR-097 결정 4 · CLAUDE.md "설치자 디스크는 한 원칙" 위반, 방향만 반대).

**원인**: `src/agents-md-merge.ts` `mergeAgentsMd` — 마커 없는 `## Project Rules` 를 통째로 갈아 끼울 때
`replacedRulesHeadings = headingLines(rulesNew)`(**지금** 렌더의 앵커 제목)에 없는 `## ` 를 전부 설치자 절로 모은다
(`extraTopLevelSections` 의 `replacedBody`). 옛 판의 앵커 제목은 지금 렌더에 없으므로 설치자 절로 분류된다.
v26.152 이하의 모든 옛 앵커 제목(더 옛 판의 7원칙 등 포함)이 같은 경로를 탄다.

**커밋별 실측**(실제 `runInstall(update)` → 디스크, 이어서 `uninstallAction({yes:true})`):

| 커밋 | update 뒤 옛 앵커 제목 | 2회차 update 바이트 동일 | uninstall 뒤 |
|---|---|---|---|
| 6d6c8ec(main) | 있음(파일 끝 6절) | 예 | 파일 남음 · 옛 6절만 |
| 21f8997 | **없음** | 예 | 파일 삭제 |
| 267b1cc | 있음(파일 끝 6절) | 예 | 파일 남음 · 옛 6절만 |

→ main 대비 신규 회귀는 아니지만, 이 PR 이 주장하는 ① 을 21f8997 이 고쳤다가 267b1cc 가 마커 없는 경로에서 다시 연다.
리드의 판정 항목 3("④ 막기가 하네스가 은퇴시킨 절까지 설치자 절로 되살리지 않는가")에 대한 답이 "되살린다" 다.
현재 ① 회귀 테스트는 **마커 있는** 판만 덮어서 이것을 못 본다.

**재현**: `rev-A/zz-review-probe.test.ts.bak` 의 P1 (wt/tests/ 에 복사 후
`OLD_ANCHOR_PATH=<rev-A>/old-anchor-152.md npx vitest run tests/zz-review-probe.test.ts`, 옛 앵커 =
`git show v26.152.0:templates/CLAUDE.md`). 픽스처: codex·tooling 설치 → 마커 3쌍 제거 → 앵커 본문(제목 줄 뒤)을 v26.152
본문으로 교체 → 그 바이트를 하네스가 쓴 것으로 기록(sha) → update.

**완료 기준**:
1. 마커 없는 옛 판 + 옛 앵커 제목(v26.152 본문) + 설치자 편집 없음 → update 뒤 `## 1. Resolve what matters, then act` 0회,
   `## 1. Understand what success means` 1회, 2회차 update 바이트 동일, uninstall 뒤 파일 삭제.
2. 같은 픽스처에 설치자 `## My rules` 를 더한 경우 → `## My rules` 는 파일에 남고 옛 앵커 제목은 0회(①과 ④ 동시 성립).
3. 위 1·2 를 실제 update 실행 회귀 테스트로 추가하고, 그 테스트가 267b1cc 코드에서 red 임을 보인다.

---

## NOTE (블로커 아님)

**[NOTE-1 · MEDIUM] Harness Rules 안 은퇴한 룰 소제목도 설치자 절로 되살아난다 — 기존 동작, 이 PR 무관.**
`## Testing` 아래에 옛 룰 소제목 `## TDD Workflow (Mandatory)` 를 넣고 하네스 기록으로 둔 뒤 update → 6d6c8ec·21f8997·267b1cc
셋 다 파일 끝에 되살린다(P2). `ruleHeadings` 가 **현재** 배포 룰만 담기 때문이다. v26.152.0→현재 사이 은퇴한 룰 제목은 0개
(실측 비교)라 영향은 v26.140 대 이하 판에 한정된다. BLOCKER-1 과 같은 축(“지금 렌더에 없다 ≠ 설치자 것”)이므로 같은 해법으로
덮을지 별 이슈로 올릴지 리드 판단.

**[NOTE-2 · MEDIUM] "한 함수" 주장은 판정 함수 수준에서만 참이고, 동일성 테스트는 병합 쪽 호출부 변이를 물지 않는다.**
- 걷기 호출부 변이(N2: `region: null`, 추적 줄 삭제, tsc exit 0) → 동일성 테스트 red + #736 회귀 11건 red. 구현자 주장 확인.
- 병합 호출부 변이(`region` 을 사실상 null 로, tsc exit 0) → **동일성 테스트는 green**(되살린 절이 `mergedText.includes` 필터로
  걸러져 결과가 같아진다). 다른 테스트 4건(스킬 안내 1회 · 옛 설치본 · ① · ③)이 red 라 회귀 자체는 잡힌다.
- 병합만 갖는 차이 두 가지가 남는다: ⓐ `harnessHeadings` 에 렌더 룰 제목 합집합(실제 호출부는 `ruleHeadings` 전체를 넘겨
  합집합이 아무 일도 안 한다 — 제거해도 테스트 52건 green, 방어 코드) ⓑ `replacedBody`(마커 없는 판 전용 — 걷기는
  마커 없는 파일을 `null` 로 돌려 걷지 않으므로 비대칭이 결과로 드러나지 않는다).

**[NOTE-3 · LOW] 설계서 §5·§8 문구("동작 불변" · "CI 만" · "새 테스트 1건")가 실제와 다르다** — 구현자 인계에 이미 적혀 있음.
머지 전 설계서 또는 PR 본문에 반영 필요(doc-governance: 추적 문서는 머지까지 동기화).

---

## 판정 항목별 확인 결과

1. **분류 오판** (모두 실제 update 실행 · 267b1cc):
   - 마커 있음 · Project Context/Project Rules 안 설치자 `## ` → 제자리 1회, 2회차 바이트 동일 (P3) ✓
   - 첫 절 앞(제목 다음) 설치자 `## ` → 파일 끝 1회, 2회차 동일 (P4) ✓
   - 룰 제목과 앞부분이 겹치는 `## Test`/`## Git` → 남음, 2회차 동일 (새 테스트 재실행) ✓
   - 마커 없음 · Project Rules 안 설치자 `## Testing`(룰 제목과 동일) → 남음 (P5; 21f8997·6d6c8ec 에서는 사라짐) ✓
   - 마커 없음 · `## My rules` → 남음 ✓ / **마커 없음 · 옛 앵커 제목 → 하네스 절을 설치자로 오판 ✗ (BLOCKER-1)**
   - 설치자 절을 하네스로 읽어 지우는 경우는 위 시나리오에서 새로 관측되지 않음.
2. **한 함수**: `headingOwner` 를 병합·걷기가 공유함 확인. N2(걷기) 변이에서 동일성 테스트 red 확인. 병합 쪽은 NOTE-2.
3. **은퇴 절 되살리기**: 앵커 = 되살린다(BLOCKER-1). 룰 = 기존 동작으로 되살린다(NOTE-1, 이 PR 무관).
4. **새 회귀 테스트의 무는 힘** (변이 적용 = `git diff --quiet <커밋> -- src/agents-md-merge.ts` 로 바이트 일치 확인, tsc exit 0):
   - 6d6c8ec 소스: 동일성 · ② · ① · ③ = 4건 red, ④ green (④는 main 에서 이미 남던 동작이므로 정상)
   - 21f8997 소스: ④ 1건 red, 나머지 green
   - 되돌린 뒤(267b1cc) 전부 green.
5. **`npm run ci`** (267b1cc, 파이프 없이 로그 파일로): **exit 0** · 148 files / 2253 tests passed · branches 89.06.

## 정리
- 작업 사본 `wt` 는 267b1cc 깨끗한 상태로 되돌렸다(`git status` clean). node_modules 심링크 제거.
- 재현 자료는 `rev-A/` 에 남김: `zz-review-probe.test.ts.bak` · `old-anchor-152.md` · `mut.py`(걷기/병합 변이) · `mut2.py` · `ci.log`.

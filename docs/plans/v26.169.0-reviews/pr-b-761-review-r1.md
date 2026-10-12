# PR-B 독립 리뷰 판정 — fix/update-skill-displaced @ 3db6022 (기준 main@6d6c8ec)

## 결론: **BLOCKER 1건 있음**

완료 기준 3개 중 ① 의 화면·기록(writer 로그 · `.claude/` 옛 로그) · ② 갱신 대상 · ③ 백업 없이 사라지지 않음은 충족한다.
막는 것은 **외부 CLI 쪽 옛 로그(`externalFiles` 필드 없음)** 에서 하네스 파일을 설치자 파일로 잘못 읽는 회귀다. main 에는 없고 이 PR 에서 생긴다.

## 직접 돌린 것
- `npm run ci`: 파이프 없이 실행했고 **exit 0**. 147 files / 2256 tests, branches 89.09.
- 재현: 임시 테스트를 branch 와 main@6d6c8ec 양쪽에 같은 내용으로 넣어 돌렸다. 대본은 `scratchpad/rev-B/repro.test.ts` 이고 지금은 두 작업 사본 모두에서 지웠다.
- 변이 6종: 적용 diff 를 확인했고, 6종 모두 `tsc --noEmit` exit 0 이었다. 테스트 결과는 아래 Q5 에 있다. 끝난 뒤 원복했고 `git status` 는 깨끗하다.

---

## [BLOCKER] B-1 — 외부 기록이 없는 옛 설치본(≤v26.132)에서 하네스 산출물이 "설치자 것" 이 된다
**자리**: `src/owned-write.ts:214` `const firstContact = !baseline.has(rel);` (설계 §3.2 ⓒ 를 글자 그대로 옮긴 것)

**문제**: `.claude/` 쪽에는 B3 규칙이 있다. 필드가 아예 **없으면** `no-sha`(하네스 것, 체크섬 없음)이고, 필드는 있는데 경로만 없으면 `none` 이다.
그런데 `.agents/` · `.codex/` 등을 쓰는 owned-writer 는 이 구분 없이 "기준선에 없음 = 첫 접촉" 으로 읽는다.
그래서 `externalFiles` 가 없는 옛 로그(v26.87~v26.132, 설계 §11 ⑨ 가 실재를 인정한 설치본)에서는 하네스가 깐 파일 전부가 첫 접촉이 된다.
`recorded()` 는 같은 경로에 대해 이미 `no-sha` 를 낸다(옛 로그 · 소유 CLI · 대상). writer 만 이 판정을 쓰지 않는다.

**재현**(tooling · claude+codex 를 `add` → 로그에서 `externalFiles` · `records` · `portions` 삭제 → codex 훅 1개를 옛 판 바이트로 바꿈):

| | main@6d6c8ec | 이 PR |
|---|---|---|
| update 뒤 `externalFiles` | 47 → **46** (하네스 것으로 다시 적힘) | 47 → **4** |
| `rootFiles` displaced | 0 | **43** (백업 있음 1 · 같은 내용 42) |
| 화면 | 훅 1개 `no checksum` | 훅이 `had files with these names … yours, put back on uninstall` + `same as the harness version 42 kept` (42개 경로 한 줄) |
| 두 번째 update | — | 같은 42줄이 **또** 나온다. 기록은 4건에서 늘지 않는다(수렴 안 함) |
| 이어서 uninstall(현행 코드) | `.agents/` 하네스 파일 **0개 남음** | **41개 남음** (`.agents/skills/audit-harness-fit/SKILL.md` 등) |
| `reinstall` 으로 같은 실험 | 46 · 0 남음 | 4 · 41 남음 (같다) |

**설치자에게 미치는 영향**: 다음 세 가지가 생긴다.
- uninstall 을 한 뒤에도 Codex 가 하네스 스킬 41개를 계속 읽는다. 지금 코드에서 이미 생긴다.
- update 화면이 하네스의 옛 훅을 "yours" 라고 말한다. main 에서는 "no checksum" 이라는 정확한 말이었다.
- 매 update 마다 42개 경로가 든 같은 줄이 나온다.

PR-D 가 들어가면 하나가 더 생긴다. 백업 1건(옛 하네스 훅)이 "되돌리기" 로 제자리에 돌아와 남는다(구현자 G-1).
바이트 손실은 없다. 하지만 원칙 "하네스 몫은 설치 기록 하나가 정한다 · 하네스 파일은 쓰고 치운다" 를 어기고, main 대비 회귀다.

구현자는 G-1 을 "다른 바이트 → displaced(백업)" 로만 짚었다. **같은 바이트 → 기록에서 빠짐** 쪽이 더 크고, 지금 uninstall 에서 바로 드러난다.

**완료 기준**(구현 방식은 지정하지 않는다):
1. `externalFiles` 필드가 없고 `records !== "writer"` 이고 그 CLI 가 기록에 있는 로그에서 `update` 와 `reinstall` 을 한다.
   - 하네스 판과 같은 외부 파일은 `externalFiles` 에 sha 로 적힌다. displaced 로는 적지 않는다.
   - 다른 파일은 백업과 함께 `no checksum` 으로 말한다. displaced 로는 적지 않는다.
   - 즉 main 과 같고, `.claude/` B3 의 "필드 없음 → no-sha" 와 같은 말이다.
2. 위 재현 끝의 uninstall 뒤 `.agents/` 에 남는 하네스 파일이 0개다.
3. writer 로그와, 필드가 있는 로그의 첫 접촉(§3.3 ①③ 의 `.agents/` 단언)은 그대로 green 이다.
4. 음성 대조로 1 의 판정을 되돌리면 새 테스트가 red 다.
5. `tests/external-cli-ownership.test.ts` 의 "기준선이 없고(레거시 설치)" 케이스는 지금 PR 이 이 회귀를 단언하는 꼴이다(아래 Q3). 이 케이스의 단언을 1 에 맞춘다.
   - 이 테스트는 `codex(new Map())` 로 "기준선 없음" 만 흉내 낸다. 로그 상태(필드 없음 · writer 아님)를 표현할 수단이 writer 에 없다. 판정에는 그 입력이 필요하다.

**설계 결함이다**: 설계 §3.2 ⓒ 가 "`baseline.has(rel)` 아니면 첫 접촉" 이라고 적었고, B3 를 외부 쪽으로는 넓히지 않았다. 구현자는 계약대로 했다.
되돌릴 수 있고 손실이 없으니, 리드가 해당 설치본 수가 무시할 만하다고 판정하면 낮출 수 있다. 다만 그때는 사유를 남겨야 하고, 화면의 "yours" 오표기도 함께 감수하는 것이다.

---

## 질문별 판정

**Q1 — `recorded()` 좁히기로 `.claude/` 하네스 파일이 displaced 가 되는가**: `.claude/` 경로에서는 그런 길을 찾지 못했다.
- 옛 로그의 `policyFiles` · `skillFiles` 는 그 필드가 생긴 판(v26.132 / v26.126)부터 install · update 때마다 다시 스캔됐다.
  - `refreshPolicyBaseline` 은 v26.134 에 생겼다.
  - `installNewAssets` 는 그 뒤인 2026-08-09 에 생겼고 같은 실행에서 재스캔된다.
  - `installNewSkillDirs` 는 `recordNewSkillBaseline` 과 함께 생겼다.
  - 그래서 "하네스가 썼는데 필드에 없는" 경우가 생길 판을 이력에서 찾지 못했다.
- 구현자의 G-1 은 `recorded()` 문제가 아니다. owned-writer(외부) 문제이고, 그게 B-1 이다.
- 손실인가 누수인가: 손실은 없다. 누수다. 다만 지금 uninstall 에서 41개가 남으므로 NOTE 가 아니라 B-1 으로 올렸다.

**Q2 — 예전엔 갱신되던 하네스 파일이 이제 안 되는가**: 된다. 다만 좁다. 안 잃고 낡을 뿐이라 **NOTE** 다.
- `skillFiles` 가 없는 옛 로그(v26.126 이전, claude)에서 트랙 기본이 아닌 번들 스킬은 이제 갱신되지 않는다.
- 이번 판에서 어느 트랙에서도 기본이 아닌 번들 스킬은 `gemini-delegate` · `chatgpt-delegate` · `genspark-delegate` 3종이다. 셋 다 #729(writer 시대) 신설이라 그 로그 모양에 실재하지 않는다.
- 기록 쓰기가 실패한 writer 로그는 설계 §11 ② 가 이미 인정했다.
- 낡은 파일은 uninstall(PR-D)이 `no-sha` / `sha` 로 치운다. 그래서 잃지는 않는다.
- 단 B-1 과 겹치는 외부 옛 로그에서는 대상 id 가 `externalFiles` 에서 나오지 못해 같은 축이 생긴다. B-1 을 고치면 함께 해소된다.

**Q3 — 기존 테스트 3건 수정**:
- `update-mode.test.ts` 의 `records: "writer"` 는 **맞춤**이다.
  - `demo` 는 가짜 번들 이름이라 옛 로그였다면 소유 필터에 걸린다.
  - 실 템플릿의 `templates/skills/` 는 전부 번들이다.
  - 테스트 의도(연속 update 가 백업을 쌓지 않음 · 중간 편집은 백업)는 그대로 단언된다.
- `update-report-honesty.test.ts` 의 `delete log.records` 는 **맞춤**이다.
  - `records` 는 v26.162 부터, `policyFiles` 는 v26.132 부터 있었다. "writer 인데 policyFiles 없음" 은 도달할 수 없는 상태다.
  - #557 단언은 바뀌지 않았다.
- `external-cli-ownership.test.ts` 의 "기준선이 없고(레거시 설치)" 는 **약화다**.
  - 백업 1건 단언은 유지돼 보호 자체는 남았다.
  - 하지만 테스트 주석은 "사용자 편집인지 하네스 구버전인지 구분할 근거가 없다" 고 말한다. 그 상태를 "설치자 것(displaced · 되돌릴 대상)" 으로 단언하도록 바꿨다. B-1 의 회귀를 고정하는 단언이다.
  - 바로 옆 "기준선이 없어도 내용이 같으면" 케이스는 `files`(기록)를 단언하지 않는다. 그래서 같은 바이트가 기록에서 빠지는 것을 못 잡았다.

**Q4 — "put back on uninstall" 문구**: **NOTE**. 단 조건이 붙는다.
- 설계 §8 은 "릴리즈는 PR-D 뒤 한 번" 이고, main 은 태그 전까지 게시되지 않는다. 그 전제에서는 허용할 만하다.
- 조건: PR-D 가 같은 릴리즈에 못 들어가면 태그 전에 문구를 바꾼다(ship-checklist Surface Parity).
- B-1 이 남아 있으면 이 문구는 PR-D 와 무관하게 옛 하네스 파일에 대해 거짓이다.

**Q5 — 새 테스트가 무는가**(변이마다 적용 diff 확인 · `tsc` exit 0 · 원복):

| 변이 | 결과 |
|---|---|
| M1 대상 선정을 디스크로 되돌림(`syncSkills` targets 제거 + `recordedBundledSkills` 디스크 판정) | ② red |
| M2 ⓐ′ 좁히기 무력화 | ④ red + recorded "필드 있음·경로 없음" 2건 red · `.installed-tracks` 는 green(의도대로) |
| M3 owned-writer 첫 접촉 기록 제거(편집 쪽으로 보냄) | ①④ red |
| M4 `updateDir` displaced push 제거 | ⓑ red |
| M5 Q3 `notOurs` 제외 무력화 | ③ red. 첫 시도는 미사용 인자로 tsc exit 2 라 무효 처리했고, `notOurs.size >= 0 \|\|` 형태로 다시 걸어 tsc 0 을 확인했다 |
| M6 `syncSkills` displaced push 제거 | ①③④ red |

새 테스트 ①②③④ⓑ 와 recorded 3건은 모두 문다. 외부 옛 로그(B-1)를 덮는 테스트는 없다.

**Q6 — `npm run ci`**: exit 0. 파이프 없이 백그라운드로 돌렸고 exit code 는 파일에 적었다.

---

## NOTE (막지 않음)
- **N-1** `same as the harness version` 행은 경로를 전부 이어 붙인다. writer 로그에서는 드물지만, B-1 상태에서는 매 update 42개 경로가 한 줄에 나온다(B-1 을 고치면 해소).
- **N-2** G-4(`.agents/skills/<id>` 기록 id 가 `.claude/skills/` 대상에 들어간다): 한 로그의 CLI 집합에 claude 가 있으면 하네스가 두 자리 모두 썼으므로 실제 피해 경로를 찾지 못했다. 설계 표 그대로다.
- **N-3** `recordedSkillIds` 는 번들 목록으로 거르지 않는다(A-1). 실 템플릿에서는 두 집합이 같아 무해하다. 가짜 스킬을 쓰는 단위 테스트를 위한 비대칭이다.
- **N-4** 구현자의 "미심쩍은 부분" 중 `upsertRootImport`(루트 `CLAUDE.md` 상시 스킬 블록)는 아직 디스크로 고른다. `AGENTS.md` 쪽은 이 PR 로 기록 기준이 됐고 `CLAUDE.md` 쪽은 디스크 기준이라 두 앵커의 판정이 갈린다. 범위 밖이므로 후속 이슈 후보다.

## 잘 된 점(구체)
- `.claude/` 갱신 두 함수가 install 과 같은 `judge` 표를 탄다. `sha` + 디스크 없음 → `create`(되살림)를 확인했고, 예전 "스킬 안 새 파일 생성" 분기도 같은 표로 흡수됐다.
- `withoutLostBackups` 로, 백업을 가리키는 displaced 를 나중의 "백업 없는 displaced" 가 덮지 않게 했다. `mergeRootFiles` 가 마지막 하나로 덮는 함정을 실제로 막는다.
- ②(opt-in 이름 폴더 불가침)를 디스크 판정으로 되돌리면 실제로 red 가 난다(M1).

## Verdict
- [ ] CRITICAL 이슈 없음 — CRITICAL 은 0건이다. 단 BLOCKER 1건(B-1)이 있다.
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/PRD 범위 내. 설계 문서 변경은 §3.1 N-D 한계 한 줄뿐이다.

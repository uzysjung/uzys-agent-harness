# PR-B 3차 리뷰 판정 — fix/update-skill-displaced @ b1a1f15 (2차 = afe0cd1, 기준 main@6d6c8ec)

## 결론: **PASS** (BLOCKER 0 · NOTE 2)

B-2 는 해소됐다. 리드가 요청한 순서(옛 로그 → `update --only <g>` → 일반 update 2회 → uninstall, reinstall 포함)를 72가지로 넓혀 돌렸고, 72개 모두 main 과 같은 결과다. 같은 대본으로 afe0cd1 을 돌리면 32개에서 결함이 나므로, 이 재현이 결함을 실제로 잡는다는 것도 확인했다. 정상 기록(writer 로그, 그리고 필드가 다 찬 옛 로그)에서 판정이 바뀐 자리 가운데 실제 호출부에 닿는 것은 없다.

## 직접 돌린 것
- `npm run ci`: 파이프 없이 돌렸고 **exit 0** 이다. 148 files / 2268 tests, branches 89.21. 로그는 내 세션 scratchpad 의 `ci3.log` 와 `ci3.exit` 이다.
- 재현 대본 `zz-rev3`(임시로 넣었다가 지웠다)는 아래 조합을 모두 돈다.
  - 옛 로그 4종. 공통으로 `externalFiles` · `records` · `portions` 를 지우고, 거기에 더해 각각 ① 더 지우는 것 없음 ② `policyFiles` 삭제 ③ `skillFiles` 삭제 ④ 둘 다 삭제.
  - `--only` 9종. rules · hooks · skills · new-skills · anchor · external · rules+hooks · skills+new-skills · rules+new-skills.
  - 뒤이은 실행 2종. 일반 update 또는 reinstall.
  - 각 조합은 이어서 update 를 2번 더 하고 uninstall 로 끝난다. new-skills 가 할 일이 있게 기본 스킬 1개를 미리 지웠다.
  - 이 대본을 b1a1f15 · afe0cd1 · main 의 src 세 판에서 돌렸다.
- 판정 탐침 `zz-probe`(지웠다): 12 트랙 × CLI 조합 8종으로 설치하고, 로그를 writer 그대로 둔 것과 `records`·`portions` 를 지운 것 두 모양에서 `recorded()` 의 답을 경로마다 afe0cd1 과 b1a1f15 로 비교했다. 대상 경로는 디스크에 깔린 전 파일과 합성 경로 11개이고, 기본 대상 술어와 `isTarget: () => true` 양쪽으로 물었다.
- 변이 3종: 바꾼 diff 를 출력해 확인했고, 셋 다 `tsc --noEmit` exit 0 이었다. 끝나고 원복했다. 작업 사본은 `git status` 가 깨끗하고 HEAD 는 b1a1f15 이며, node_modules 심링크도 지웠다.

## 판정별

**1 — B-2 해소: 충족**
| 72개 시나리오 | main | afe0cd1 | b1a1f15 |
|---|---|---|---|
| 첫 일반 update/reinstall 뒤 displaced(`.claude/` 포함 전체) | 0 | **32개 시나리오에서 8~79** | **0** |
| `externalFiles` 수 | 46 | 3 (결함 시나리오) | **46**(72개 전부) |
| 두 번째·세 번째 update 화면의 `had files…`/`same as…` | 없음 | 있음 | **없음** |
| uninstall 뒤 `.agents/` 하네스 파일 | 0 | **41** (결함 시나리오) | **0** |
| uninstall 뒤 `.claude/` 남은 파일 | 0 | 0 | 0 |
- 필드 9개(d1 · `.claude` 몫 d1 · ext · 화면 3회 · d2 · `.agents` 잔존 · `.claude` 잔존)를 비교했고, b1a1f15 와 main 의 차이는 **0건**이다.
- afe0cd1 결함은 `--only rules` 계열만이 아니었다. `--only hooks`(`.claude` 8건)와 `--only new-skills`(`.claude` 34건)도 같은 함정이었다. 구현자가 말한 세 경로가 모두 실재했고, 셋 다 해소됐다.
- 2차 기준 2(필드가 있는 로그의 첫 접촉): `update-dev-default-skills` 와 recorded "필드가 있는데 경로가 없으면 none" 이 green 이다(아래 3).

**2 — 정상 설치본을 불완전 기록으로 잘못 읽는가(손실 위험): 실제로 닿는 경로를 찾지 못했다**
- 구조: `recorded()` 는 `records === "writer"` 이면 `scanFieldOf` 에 가기 전에 `none` 을 낸다. 그래서 writer 로그는 새 판정을 아예 타지 않는다. 탐침에서도 writer 모양의 판정 변화는 **0건**이었다.
- 옛 로그(writer 아님)에서 새 판정이 바꿀 수 있는 방향은 afe0cd1 대비 `none → no-sha` 하나뿐이다. main 은 옛 로그를 필드 유무와 상관없이 늘 `no-sha` 로 읽었으므로, main 대비 설치자 파일을 하네스 것으로 삼는 경우가 새로 생길 수는 없다.
- 탐침에서 필드가 다 찬 옛 로그의 판정이 바뀐 곳은 **한 종류**다.
  - `.claude/commands/uzys/*` 가 `isTarget: () => true` 일 때만 `none → no-sha` 로 바뀐다. 지금 어느 트랙도 이 디렉터리에 파일을 배포하지 않기 때문이다(60건 = 12 트랙 × claude 포함 CLI 조합 5종).
  - 이 술어를 쓰는 곳은 `recordedOwner` 하나이고, 이것을 부르는 owned-writer 는 외부 렌더 경로(`.agents/` · `.codex/` · `.opencode/` · `AGENTS.md`)만 묻는다. 기본 술어로 물으면 이 경로의 답은 그대로 `none` 이다. 그래서 닿지 않는다.
- 리드가 든 예시별 결과:
  - 외부 CLI 를 고르지 않은 설치본: 소유 CLI 가 기록에 없어 `ownedByLog` 가 거짓이고, `scanFieldOf` 에 가기 전에 `none` 이다. 탐침의 `claude` 단독 조합에서 판정 변화는 0건이었다.
  - 헬퍼만 있는 정상 설치본: claude 단독이면 바로 위와 같다. 외부 CLI 가 있는 정상 설치본은 렌더가 늘 외부 전용 경로(`AGENTS.md` 와 `.agents/` · `.codex/` · `.opencode/` 아래 파일)를 적는다. 소유 표를 보면 외부 CLI 3종 모두 claude 와 겹치지 않는 경로를 가진다. 탐침의 외부 조합 7종에서도 외부 경로의 판정 변화는 0건이었다.
  - 정책 디렉터리를 일부만 쓰는 트랙: 위 `commands/uzys` 가 바로 이 경우이고, 닿지 않는다. 옛 판에는 없던 디렉터리를 새 판이 처음 배포하는 경우에만 `no-sha`(백업 후 교체)가 된다. 이것은 main 의 동작 그대로이고 백업이 남는다.

**3 — 1차 완료 기준 5개 · 2차 기준 · 이 PR 의 첫 목적: 충족**
- 1차 ①②: 72개 재현에 B-1 순서(먼저 하는 `--only` 없음)가 직접 들어 있지는 않다. 대신 기존 `legacy-external-log` B-1 두 건이 green 이다. M1 에서 그 B-1 update 건이 red 가 되므로, 이 테스트는 실제로 판정을 문다.
- 1차 ③ · 2차 기준 2: `update-dev-default-skills`(첫 목적, 곧 기록 없는 같은 이름 스킬의 displaced 기록과 화면 문구)와 `recorded` · `external-cli-ownership` 이 green 이다. 다섯 파일 165건, 무변이. 탐침에서 필드가 다 찬 옛 로그의 `.claude/skills/` · `.agents/` 판정 변화가 0건이므로, 첫 목적의 판정 입력은 바뀌지 않았다.
- 1차 ④ / 2차 기준 3: 아래 5.
- 1차 ⑤: `external-cli-ownership` 의 레거시 케이스는 이번 커밋에서 바뀌지 않았고 green 이다.

**4 — 바꾼 픽스처 2건: 약화 아님**
- ⓐ recorded "필드가 있는데 경로가 없으면 none"
  - 원래 픽스처(헬퍼만 든 `externalFiles`)는 바로 B-2 상태였고, 이제 그 상태의 정답은 `no-sha` 다.
  - 외부 항목 1건을 더해 "필드 있음" 단언(`none`)은 그대로 두었다. 헬퍼만 든 상태는 새 테스트가 `no-sha` 로 따로 단언한다. 그래서 두 상태가 모두 덮인다.
- ⓑ update-mode new-skills
  - 바뀐 것은 로그에 `skillFiles` 가 있다는 것뿐이다. 설치 · `installedNew` · 기준선 추가 · 두 번째 실행 무동작이라는 단언 4개는 그대로다.
  - 필드가 없는 로그에서 필드를 만들지 않는다는 쪽은 `legacy-external-log` 의 new-skills 건이 문다(M3 red).

**5 — 변이 · typecheck · CI**
| 변이 | tsc | 지정 5파일(165건) | 72개 재현에서 다시 결함이 난 시나리오 |
|---|---|---|---|
| M0 무변이 | 0 | green | 0 |
| M1 외부 단위를 "필드가 있나" 로 되돌림 | 0 | **6 red**(B-1 update 1 · B-2 4 · recorded 헬퍼만 1) | **44** — 외부 단계를 타는 일반 update 는 같은 실행 안에서 헬퍼가 먼저 적힌다(`logAtStart` 를 걷었으므로). 구현자 설명과 같다 |
| M2 정책 단위를 "필드가 있나" 로 되돌림 | 0 | **4 red** | **12** |
| M3 `recordNewSkillBaseline` 가드 무력화(`&& Date.now() < 0`) | 0 | **1 red** | **8** |
- `npm run ci` exit 0.

---

## NOTE (막지 않음)
- **N-6 · 잔여: main 이 이미 남긴 "일부만 든 `skillFiles`"**. 구현자가 스스로 밝힌 한계이고, 크기를 재 보았다.
  - 상태: ≤v26.125 로그에서 옛 판의 `update --only new-skills` 가 스킬 하나만 든 `skillFiles` 를 이미 만들어 둔 상태.
  - 재현: tooling · claude+codex 로그의 `skillFiles` 를 스킬 하나로 줄이고 `records` 를 지운 뒤 update 또는 reinstall 을 한다.
  - 결과: b1a1f15 는 **displaced 34**, main 은 0 이다. uninstall 뒤 `.claude/skills/` 잔존은 둘 다 0 이다.
  - 영향: 손실은 없고, 하네스 스킬 34개가 "설치자 것" 으로 적혀 갱신되지 않는다. afe0cd1 에도 있던 동작이고 이번 커밋이 만든 것은 아니다. 이 PR 전체로 보면 main 대비 차이다.
  - 대상: ≤v26.125 에 머물다가 `--only` 가 있는 판으로 올라와, 첫 update 를 `--only new-skills` 로만 하고 일반 update 를 한 번도 하지 않은 설치본. 해당 설치본은 극히 적다고 본다.
  - 리드가 감수하면 사유를 PR 본문에 남기기를 권한다.
- **N-7** `.claude/commands/uzys/*` 는 `isTarget: () => true` 로 물을 때만 판정이 바뀐다(판정 2). 지금 호출부에는 닿지 않는다. 다만 `recordedOwner` 를 `.claude/` 경로에 쓰는 호출부가 새로 생기면 다시 봐야 한다.
- 1차 Q4(문구 — PR-D 가 같은 릴리즈에 못 들어가면 태그 전에 바꾼다) · N-4 · 2차 N-5 는 그대로다.

## 잘 된 점(구체)
- 판정 단위를 "그 자리를 한 번에 다 적는 쓰기의 단위" 로 바꿨다. 그 덕에 같은 실행 안의 헬퍼 선기록(B-1 의 원래 함정)과 실행을 건너는 부분 기록(B-2)이 한 규칙으로 함께 풀렸다. `logAtStart` 라는 특수 인자가 사라졌고, M1 이 그 대가(같은 실행 안 재발)를 44개 시나리오로 보여 준다.
- `.claude/` 쪽 `--only hooks` · `--only new-skills` 의 같은 함정까지 찾아 고쳤다. 리뷰어 2차 재현은 외부만 짚었는데, 실측으로 둘 다 실재했다(afe0cd1 에서 `.claude` 8건 · 34건).

## Verdict
- [x] CRITICAL 이슈 없음 (BLOCKER 0)
- [x] DO NOT CHANGE 영역 미변경 — src 2파일 · tests 3파일
- [x] SPEC/PRD 범위 내

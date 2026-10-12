# PR-B 재리뷰 판정 — fix/update-skill-displaced @ afe0cd1 (1차 = 3db6022, 기준 main@6d6c8ec)

## 결론: **BLOCKER 1건 있음** (B-2 — B-1 과 같은 결함이 다른 순서로 되살아난다)

1차 완료 기준 5개는 **적힌 시나리오에서는 전부 충족**한다. 막는 것은 B-1 의 같은 원인이 남은 경로 하나다.
옛 설치본(외부 기록 없음)에서 `update --only rules` 를 **한 번이라도** 돌린 뒤 일반 update/reinstall 을 하면 B-1 이 그대로 재현된다.
main 에서는 같은 순서에서 생기지 않으므로 이 PR 의 회귀다.

## 직접 돌린 것
- `npm run ci`: 파이프 없이 실행했고 **exit 0**. 148 files / 2262 tests, branches 89.17. 로그는 `scratchpad/rev-B/ci2.log`, exit 는 `ci2.exit`.
- 1차 재현 대본(`repro.test.ts`)을 afe0cd1 에서 다시 돌렸다(아래 기준 1·2).
- 새 재현 `zz-repro2.test.ts.keep`(scratchpad/rev-B): 옛 로그 → `update --only <g>` → 일반 update 2회 → uninstall. afe0cd1 과 main src 양쪽에서 돌렸다.
- 3db6022 src + 새 테스트 대조, 변이 3종. 변이마다 적용 diff 를 출력해 확인했고 `tsc --noEmit` 은 모두 exit 0 이었다. 원복했다.
- 끝난 뒤 node_modules 심링크와 임시 테스트를 지웠다. `git status` 는 깨끗하고 HEAD 는 afe0cd1 이다.

---

## [BLOCKER] B-2 — 옛 설치본에서 `update --only rules` 뒤 일반 update 를 하면 하네스 산출물이 다시 "설치자 것" 이 된다

**자리**:
- `src/update-mode.ts:2757-2766` `refreshNeutralHelpers`. 헬퍼 3개만 담은 `externalFiles` 를 **새로 만들어** 디스크 기록에 쓴다. `--only rules` 도 이 단계를 탄다(`wants("rules")`).
- `src/recorded.ts` `scanFieldOf`. 외부 경로의 판정을 "`externalFiles` 필드가 있는가" 하나로 한다.

**문제**:
- 구현자는 이 함정을 이미 알았다(인계 ⓐ). 하지만 `logAtStart` 는 **같은 실행 안**만 막는다.
- `--only rules`(외부 단계 없음)로 끝난 실행은 헬퍼만 든 `externalFiles` 를 남긴다. 그러면 다음 실행의 `logAtStart` 는 "필드 있음 · `.agents/` 경로 없음" 이다.
- 이 상태는 `none`, 곧 첫 접촉으로 읽힌다. 결과는 1차 B-1 과 같다.

**재현**(tooling · claude+codex `add` → 로그에서 `externalFiles` · `records` · `portions` 삭제 → `updateOnly: [g]` update → 일반 update ×2 → uninstall):

| 순서 | main@6d6c8ec | afe0cd1 |
|---|---|---|
| `--only rules` 뒤 `externalFiles` | 헬퍼 3건 | 헬퍼 3건 (같다) |
| 이어서 일반 update: `.claude/` 밖 displaced | **0** · externalFiles 46 | **43** · externalFiles **3** |
| 화면 `same as the harness version` | 없음 | 있음. 두 번째 update 에도 또 나온다(수렴 안 함) |
| uninstall 뒤 `.agents/` 하네스 파일 | **0** | **41** |
| 대조 `--only skills` · `--only hooks` | 0 · 0 | 0 · 0 (문제 없음 — 필드를 만들지 않는다) |
| `--only rules` 뒤 일반 update 대신 `reinstall` | (main 미측정) | displaced **43** · externalFiles **3** · 이어진 update 에 `same as` 반복 · uninstall 뒤 **41** 남음 |

**설치자에게 미치는 영향**: 1차 B-1 과 같다.
- uninstall 을 해도 Codex 가 하네스 스킬 41개를 계속 읽는다.
- 매 update 마다 42개 경로가 든 같은 줄이 나온다.
- 한 번 이렇게 되면 스스로 돌아오지 않는다. 기록이 displaced 로 굳는다.
- 대상은 ≤v26.132 설치본 가운데 일반 update 전에 `update --only rules` 를 한 번이라도 돌린 곳이다. B-1 보다 좁다. 하지만 문서화된 플래그 하나로 닿는다.

**완료 기준**(구현 방식은 지정하지 않는다):
1. 옛 로그(`externalFiles` · `records` 없음, codex 기록)에서 `update --only rules` 를 하고, 이어서 일반 `update` 와 `reinstall` 을 각각 한다. 결과는 1차 기준 1·2 와 같아야 한다.
   - `.claude/` 밖 displaced 는 0 이다.
   - `.agents/` 전 파일이 `externalFiles` 에 sha 로 적힌다.
   - 두 번째 update 는 조용하다.
   - uninstall 뒤 `.agents/` 는 0개다.
2. 필드가 있는 로그(v26.133+)의 첫 접촉, 곧 `update-dev-default-skills` ①③④ 와 recorded "필드가 있는데 경로가 없으면 none" 은 그대로 green 이다.
3. 1 의 테스트는 afe0cd1 에서 red 다. 음성 대조로 고친 판정을 되돌리면 red 가 나야 하고, 그때 tsc 는 0 이어야 한다.
- 참고(원인 서술이지 처방은 아니다): 지금 "필드 있음" 이라는 신호는 하네스 자신의 헬퍼 기록 때문에 거짓이 된다. 같은 성격의 앞 단계 쓰기가 다른 곳에도 있는지 함께 본다(인계 ⓐ "다른 단계가 외부 판정을 할 때 같은 함정").
- 리드가 대상 설치본이 무시할 만하다고 판정하면 낮출 수 있다. 그 경우 1차 B-1 단서와 같이 사유를 남기고, "yours"/"same as" 오표기와 uninstall 잔존을 감수하는 것이다.

---

## 질문별 판정

**1 — 1차 완료 기준 5개**: 적힌 시나리오에서는 전부 충족한다.

| 기준 | 판정 | 증거 |
|---|---|---|
| ① update·reinstall → sha / 다른 건 백업+no checksum / displaced 0 | 충족 | 1차 대본: externalFiles 47→**46** · displaced **0** · noChecksum 1(update) · 두 번째 update 46 유지 · `same as`/`had files` 없음. main 수치와 같다 |
| ② uninstall 뒤 `.agents/` 0 | 충족 | update · reinstall 양쪽 **0** |
| ③ writer · 필드 있는 로그의 첫 접촉 | 충족 | `update-dev-default-skills` 12건 green. Mb 변이에서 ④ 가 red 이므로 ④ 는 실제로 "필드 있음" 로그를 탄다 |
| ④ 음성 대조 | 충족 | 아래 5 |
| ⑤ Q3 단언 | 충족 | 아래 4 |

**2 — `logAtStart` 로 같은 실행의 앞 단계 기록을 무시하는가**: 같은 실행 안에서는 **아니다**. 실행을 넘으면 B-2 가 생긴다.
- 기준선 쪽은 `refreshExternalCli` 가 `readInstallLog(projectDir)`(현재 디스크)의 `externalFiles` 를 `previousExternal` 로 넘긴다. 그래서 이번 실행에서 앞 단계가 적은 경로는 기준선에 있어 첫 접촉이 되지 않는다. `logAtStart` 는 `owned` 쪽에만 쓰인다.
- `owned` 는 "기준선에 없을 때" 만 보는 추가 근거다. 옛 로그(필드 없음)면 모든 하네스 대상이 true 이고, 필드 있는 로그면 기준선과 같은 답(none)이다. 그래서 이번 실행에서 처음 쓴 파일이 displaced 나 no-sha 로 잘못 가는 길을 찾지 못했다.
- 2회차 update 는 안정적이다. 46 → 46, displaced 0, 화면에 반복 줄 없음.

**3 — B3 좁히기**: 그대로다. 외부도 같은 규칙이다.
- `.claude/` 쪽 recorded "필드 있음·경로 없음 → none" 테스트는 green 이다(1차 M2 에서 무는 것을 확인했다).
- 외부 쪽은 recorded "필드가 있는데 경로가 없으면 none" 이 단언하고, Mb 변이(외부 필드 규칙 제거)에서 red 다.
- 인계 ⓑ 의 동작 변경(필드 있음 · 외부 경로 없음 · 옛 로그 · isTarget → none)이 닿는 호출부를 찾아봤다. `isTarget: () => true` 로 부르는 곳은 `recordedOwner` 하나뿐이다. 다른 호출부(`install-writes` · `update-mode` 1079/1809/2480 · `interactive`)는 기본 isTarget(manifest)이나 `.claude/` 경로를 쓴다. 영향을 찾지 못했다.

**4 — Q3 테스트**: 올바른 기대값으로 돌아왔다.
- "기준선이 없고(레거시)" 는 `recordedOwner(LEGACY_LOG)` 를 받는다. 기대값은 `backedUp` 에 훅 포함 · displaced `[]` · files 에 훅 포함 · 백업 1건이다. 1차 기준 1 의 "백업과 함께 no checksum" 과 같은 말이다.
- 옆 "같은 내용" 케이스에 files(훅 · 스킬)와 displaced `[]` 단언이 더해져, 1차가 짚은 "기록에서 빠짐" 사각을 막는다.
- 두 케이스 모두 Ma 변이(writer 가 owned 무시)에서 red 다.

**5 — 새 테스트가 무는가**:

| 대조/변이 | tsc | 결과 |
|---|---|---|
| 3db6022 src + afe0cd1 테스트(`legacy-external-log`) | — (import 오류 아님) | 2건 red. 실패 원인은 단언(`expected [ …(43) ] to deeply equal []`)이고 빌드 파손이 아니다. `recorded`/`external-cli-ownership` 테스트는 3db6022 에 없는 `recordedOwner` 를 import 하므로 이 대조에서 빼고 아래 변이로 판정했다 |
| 무변이 대조 | 0 | 56/56 green |
| Ma owned-write `firstContact` 가 `owned` 무시 | 0 | 4 red(레거시 2 · legacy-external-log 2) |
| Mb `scanFieldOf` 외부 필드 규칙 제거 | 0 | 2 red(recorded "필드 있음" · ④) |
| Mc update 가 `logAtStart` 대신 현재 로그로 판정 | 0 | 1 red(legacy-external-log update) |

- `npm run ci` exit 0.
- B-2 를 덮는 테스트는 없다. 위 표의 모든 테스트는 `--only rules` 를 거치지 않는다.

---

## NOTE (막지 않음)
- **N-5** 1차 재현 끝의 uninstall 출력에 `.codex.backup-<stamp>` 가 보인다(`.codex/` 디렉터리째 옆으로 비킴). main 수치(0 남음)와 같은 동작이라 이 PR 범위 밖이다. 원칙("폴더 통째 백업·이동은 하지 않는다")과 맞는지는 PR-D 에서 확인할 후보다.
- 1차 N-1 은 기록된 시나리오에서는 해소됐다. B-2 경로에서는 되살아난다(B-2 에 포함).
- 1차 Q4(문구) 조건과 N-4 는 그대로다.

## 잘 된 점(구체)
- 판정을 `recorded()` 한 곳에 두고 writer 는 `recordedOwner` 로 같은 판정을 받는다. `.claude/` B3 와 외부 쪽이 같은 표를 탄다.
- `legacy-external-log` 는 화면 문자열 · 기록 sha · uninstall 잔존까지 사용자 씬 끝까지 단언한다. Mc 변이로 `logAtStart` 선택 자체도 문다.

## Verdict
- [x] CRITICAL 이슈 없음 — BLOCKER 1건(B-2)
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/PRD 범위 내

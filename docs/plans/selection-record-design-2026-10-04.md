# 설치자의 넣기·빼기 선택 — 최신 상태 + 이력을 설치 기록에 보관한다 (ADR-099 보강 설계 **2판**, 2026-10-04)

- 1판 → 2판: §1 보관 형식은 그대로 채택. **§3 을 사용자 요구대로 바꿨다 — install 의 선택은 그 실행의 입력이고 기록의 최신 선택을 대체한다**(R3 의 install 쪽을 되돌림). **§2.2 는 옛 기록의 모호 사례를 실측 근거(mtime)로 가른다.** ADR-099 R2·R4·R6 은 그대로, R1 은 문장만 조정(§3), R5 는 §2.2 규칙으로.
- 근거 실측(소스 읽기, 실행 없음): `skills@1.5.11 --copy` 는 `cleanAndCreateDirectory`+`copyDirectory` 로 **있던 폴더도 지우고 다시 쓴다**(mtime 갱신) · 프로젝트 `skills-lock.json` 항목은 `{source, sourceType, ref?, skillPath?, computedHash}` 로 **시각이 없다**(`installedAt/updatedAt` 은 전역 락 `~/.agents/` 만) · 26.163.0 `refreshExternalSkills` 는 `log.assets` 의 스킬 전부를 excluded 와 무관하게 다시 썼고 update 는 `installedAt` 을 보존했다(`{...log}` spread) · 외부 스킬 자산 16종, `npx skills add` 1회 ≈5 s(코드 주석 실측), spawn 상한 120 s · npm 600 s · `.uzys-agent-harness/` 는 하네스 `.gitignore` 줄에 있다 · YAML 의존성 없음.

## 0. 설치자에게 달라지는 것 (A·B 단계별)

| 사람 · 단계 | 26.163.0 (지금 깔린 판) | PR #693 현재 | 이 설계(2판) 뒤 |
|---|---|---|---|
| A ① `install --without frontend-design` | `excluded=[fd]`, 화면 `⊘ excluded` | 같음 | 같음 + 이력 `{by:install, via:flag, without:[fd]}` |
| A ② 폴더를 지움 / 안 지움 | 기록 없음 | 같음 | 같음(손 삭제는 신호가 아니다 — R1·R2) |
| A ③ `update` | **되살림·갱신**(#566) | 깔지도 되살리지도 갱신하지도 않음 | 같음 — update 는 기록의 최신 선택을 지킨다. 남아 있으면 `⊘ fd — excluded, so the harness no longer updates it (still installed)` |
| B ① `install --without frontend-design` | A ① 과 같음 | 같음 | 같음 |
| B ② `install`(플래그 없음) | 다시 깐다, 기록은 "뺐다" 그대로(A 와 구분 불가) | **빠진 채** · `Keep it managed: --with fd` | **다시 깐다**(fd 가 트랙 기본 자산이므로) · `excluded=[]` · 화면 `↺ frontend-design — dropped earlier, installed again: this install did not pass --without frontend-design` · 이력 `{by:install, via:flag, with:[fd]}` |
| B ②′ `install`(터미널 위저드) | 체크 상태만 | fd 해제돼 보임 · 재체크 → `RUNS AS … --with fd` | fd 해제돼 보임(최신 선택 미리 채움) · 재체크 → `RUNS AS` 에 fd 없음 · 그대로 두면 `RUNS AS … --without frontend-design` |
| B ③ `update` | — | fd 안 갱신(뺀 채) | **갱신·관리** |
| 옛 기록 B(163 에서 뺐다가 플래그 없이 다시 깐 사람, 폴더 있음) | — | `⊘ … Keep it managed` 한 줄, `--with` 필요 | 첫 실행이 mtime 으로 가려 **풀고** `↺ fd — released: the last install re-added it (26.162–26.163 record)` · 이력 `{by:migration, released:[fd]}` · update 가 관리(§2.2) |

A 와 B 가 둘 다 성립하는 이유 한 줄: **install 만 선택을 쓰고(그 실행의 입력으로 대체), update·uninstall 은 읽기만 한다.** A 의 `--without` 은 다음 install 까지 지켜지고, B 의 플래그 없는 install 은 새 선택이다. 설치자가 새로 할 수 있는 것: `list` 로 "무엇을 언제 어떤 명령으로 뺐고 되돌렸나"를 본다 · 전에 뺀 것이 돌아오면 그 자리에서 ↺ 줄로 안다.

## 1. 보관 형식 (1판 그대로 채택)

**설치 기록 `.uzys-agent-harness/.harness-install.json` 안의 두 필드.** 최신 상태 = 기존 `excluded`(SSOT · 독자 `excludedIds` 무변경), 이력 = 새 `selections`. 별도 파일(한 사실 두 곳 · #600/#640/ADR-098 두 벌 · 기록 없는데 선택 파일만 남아 fresh install 에 옛 빼기 적용)과 YAML(의존성 0 저장소에 파서 도입, 이득 없음 — 사람이 읽는 면은 `list`)은 기각. `.uzys-agent-harness/` 는 gitignore 라 선택은 클론 단위(기존 성질). — **정정(ADR-100):** 그 폴더는 이제 커밋 대상이라 선택은 저장소 단위다.

```json
"excluded": ["frontend-design", "baseline:rules/git-policy"],
"selections": [
  { "at": "2026-10-04T04:10:11.000Z", "harness": "26.164.0", "by": "install", "via": "flag",   "without": ["frontend-design", "baseline:rules/git-policy"] },
  { "at": "2026-10-05T01:02:03.000Z", "harness": "26.164.0", "by": "install", "via": "wizard", "with": ["frontend-design"] },
  { "at": "2026-10-06T09:00:00.000Z", "harness": "26.164.0", "by": "install", "via": "flag",   "without": ["mcp:context7"], "interrupted": true },
  { "at": "2026-10-04T03:00:00.000Z", "harness": "26.164.0", "by": "migration", "released": ["mcp:github", "frontend-design"], "kept": ["bmad-method"] }
]
```
- 한 항목 = **`excluded` 가 실제로 바뀐 실행**. `without` = 새로 들어온 id, `with` = 빠진 id(효과분 — 바뀐 것이 없으면 항목 없음 → 선택이 같은 재설치 · update · `uninstall --only` 는 이력을 늘리지 않는다). `by` ∈ `install` | `migration`. `via` ∈ `flag` | `wizard`. `interrupted: true` = #600 중단 기록. migration 항목은 `released`(기록 근거 또는 §2.2 근거로 푼 것) · `kept`(근거 없어 뺀 채 둔 것). `harness` = 쓴 판.
- 상한 최근 100개(≤ 15 KB) · `INSTALL_LOG_VERSION` 유지(부재 = 정상) · 전량 uninstall 은 기록과 함께 삭제(선택은 이 설치의 것), `--only`·`--cli` 는 남김.

## 2. 판정 규칙

### 2.1 새 기록(`excludedKeysMigrated: true`)
`excluded` 가 유일한 근거. A = `excluded ∋ X`(마지막 install 이 `--without X`) · B = `excluded ∌ X`(마지막 install 이 X 를 빼지 않았다) — 기록 모양이 다르고 이력이 순서를 말한다. 디스크·mtime·`skills-lock.json` 은 읽지 않는다. 틀릴 길은 기록 파일 손편집뿐이고 그때도 하네스는 `excluded` 를 따른다.

### 2.2 옛 기록(v26.162.0–26.163.0, 표시 없음) — 근거로 가른다, 묻지 않는다
기록으로 가를 수 있는 것은 R5 그대로: 키 id 는 전부 자동 추론 → `released` · baseline/번들 id 는 `spec.baselineExclude`/`skillExclude`(마지막 설치 플래그)에 있는 것만 남기고 나머지 `released`(§3 의 대체 규칙과 같은 뜻). **카탈로그 X 가 `assets ∩ excluded`** 만 모호하다(A2 = 깔았다가 `--without X` · B = 뺐다가 플래그 없이 다시 깖). A1(처음부터 `--without`)은 `assets ∌ X` 라 모호하지 않다.

규칙(`readInstallLogStatus(projectDir)` 가 읽는 순간 1회, X 마다):
1. X 의 폴더가 없다(`assetStillThere` false — `.claude/skills/X` · `.agents/skills/X`, `detail.skill` 우선) → **A, 뺀 채**(B 는 폴더가 있다). `kept`.
2. 폴더 있음 → `m` = X 폴더 안 파일들의 **최대 mtime**, `t` = `installedAt`. **`t − W ≤ m ≤ t`** → 마지막 install 이 X 를 썼다(= 그 실행에 `--without X` 가 없었다 = 선택은 "깐다") → **B, 푼다**. `released`.
3. `m < t − W` → 마지막 install 은 X 를 안 썼다(앞 설치가 놓은 것) → **A, 뺀 채**. `kept`.
4. `m > t` → 마지막 install 뒤에 다시 써졌다(163 의 update 가 excluded 무관하게 다시 썼거나 설치자가 고쳤다) → **근거 없음 → A, 뺀 채**. `kept` + 화면 `⊘ X — excluded, so the harness no longer updates it (still installed). To manage it again: run install (without --without X) · remove it: uninstall --only X`. 이유: 틀렸을 때 B 는 이 줄을 보고 플래그 없는 install 한 번으로 돌아오고(§3 — 어차피 다음 install 이 선택을 대체한다), 반대로 B 로 오판한 A2 는 update 가 X 를 다시 갱신하는 것을 갱신 목록에서 읽어야 알아챈다 — 틀림이 화면에 지목되는 쪽을 고른다. 163 에서 update 를 한 번이라도 돌린 설치본은 모두 이 가지로 온다.
- **창 W = 10 분.** 근거: X 를 쓴 뒤 `installedAt` 까지는 남은 외부 자산(스킬 16종 중 선택분 × ≈5 s ≈ 1–2 분 · npm 자산은 상한 600 s) + CLI 변환(초 단위)이다 — 정상 실행은 수 분 안에 끝나고, 10 분은 npm 상한 하나를 품는 크기다. 더 크게 잡으면 `install` → `install --without X` 를 연달아 한 A2 를 B 로 오판하는 폭이 넓어진다(그 오판의 비용 = update 가 X 를 다시 갱신 · `--without X` 재실행으로 복귀 · 손실 없음). 더 작게 잡으면 느린 네트워크의 B 가 4 로 떨어진다(비용 = 줄 하나 + install 한 번). 상수 하나(`LEGACY_REINSTALL_WINDOW_MS`)로 두고 근거를 주석에 적는다.
- 판정은 기록에 남는다: `{by:"migration", released:[…], kept:[…]}` — `released` 에는 키 id · 플래그 밖 baseline/번들 · 규칙 2 의 카탈로그, `kept` 에는 규칙 1·3·4 의 카탈로그. 화면: `released` 중 이번 실행이 실제로 되살린 것만 `↺ restored …`(R5 그대로), 규칙 2 는 `↺ X — released: the last install re-added it (26.162–26.163 record)`.
- 틀리는 경우 정리: 규칙 1 — 틀릴 길 없음. 규칙 2 — A2 가 두 install 을 10 분 안에 연달아 한 경우만(위 비용). 규칙 3 — 틀릴 길 없음(X 를 쓰지 않은 마지막 install 은 `--without X` 였다 — 26.162/163 도 이번 플래그는 지켰다). 규칙 4 — 근거 없음(위 선택).

## 3. install 의 선택 = 그 실행의 입력 — 기록의 최신 선택을 대체한다 (사용자 요구, R3 의 install 쪽 되돌림)
- **규칙**: install 이 끝나면 `excluded` = **이번 실행이 뺀 것**(플래그 경로 = 이번 `--without`, 트랙 기본은 포함 · 위저드 경로 = 확인 화면에서 해제된 것). **update · uninstall 은 기록의 최신 선택을 읽기만 한다.** 중단 기록(#600)도 같은 값으로 쓴다(선택은 입력에서 정해지고 실행 결과에 달리지 않는다).
- **대체 범위 = 그 실행이 `--without` 으로 받을 수 있는 id 집합(R4 집합)**: 카탈로그 전부 · 번들 스킬 전부 · 이번 트랙의 baseline · **깔린 CLI 집합 ∪ 이번 `--cli` 의 키 id**. 이 집합 밖의 id(예: 이번 트랙에 없는 트랙의 baseline)는 기록을 그대로 이어받는다 — 말할 수 없었던 것은 선택이 아니다. 따라서 **이번 `--cli` 에 없는 깔린 CLI 의 키 빼기도 대체된다**: `install --cli claude`(플래그 없음)는 전에 뺀 `codex:top` 을 푼다. 근거: 사용자 요구 "최신 형태" = 마지막 install 의 명령이 선택의 전부이고, R4 가 그 실행에서 `--without codex:top` 을 받으므로(설계 R4 · 리뷰 S8) 적지 않은 것은 "넣는다"다. 그 키는 R2 에 따라 다음 update(또는 그 CLI 를 포함한 install)가 되돌리고, 이번 화면이 `↺ codex:top — no longer excluded: comes back on the next update (this install did not pass --without codex:top)` 로 미리 말한다. 다른 선택지(이번 `--cli` 의 키만 대체)는 R4 의 수용 집합과 어긋나 기각 — "받는데 대체는 안 한다"는 두 규칙이 된다.
- **`--with` 의 뜻은 그대로다**: 기본 해제 opt-in 자산을 이번 install 에 넣는다(`forceInclude`). 선택 기록에는 들지 않는다 — 깐 것은 `assets`(누적)가 기억하고 update 는 `assets` 를 갱신한다. 그래서 `--with X` 로 깐 opt-in X 를 뒤에 `--without X` 하면 `excluded ∋ X`(갱신 중단), 그 뒤 플래그 없는 install 은 `excluded=[]` 로 바꾸므로 **update 가 X 를 다시 갱신한다**(X 는 `assets` 에 있다) — 화면 ↺ 줄이 말한다. `--with baseline:` · `--with <키 id>` 는 R4 대로 받되 효과는 "이번 빼기에 없음"(대체 규칙에서 자명) — `releaseExclude` 필드는 없앤다. R6(`--with X --without X` 거절)은 그대로.
- **위저드**: 기록의 최신 선택을 미리 채워 보여 준다(`updateInitialSelection` 그대로). 확인 화면 `RUNS AS` 는 **아직 해제된 id 를 `--without <id>` 로** 낸다 — 그 명령을 그대로 쳐도 같은 결과가 나오게. 재체크는 명령에 안 나타난다(기본이 넣기). `rechecked() → --with` 는 지운다. `classifyUpdateIntent` 의 해제 비교는 기록 기준 그대로.
- **플래그 없는 install 이 전에 뺀 것을 다시 깔면** id 마다 한 줄: `↺ <id> — dropped earlier, installed again: this install did not pass --without <id>`. 이번 실행이 쓰지 않은 것(키 id 는 update 가 되돌림 · opt-in 자산은 깔리지 않음)은 `↺ <id> — no longer excluded: …` 변형. `excludedStillThere` 줄은 `Keep it managed: --with` 대신 `To manage it again: run install (without --without <id>; add --with <id> if it is opt-in)`.
- **대체되는 문장**: ADR-097 결정 7 의 "`excluded` 는 누적한다 — install 의 `--without` 은 더하고 `--with` 만 뺀다"(ADR-097 79행) 와 Amends 줄의 "ADR-074 … **누적** — '제외 없이 다시 깔면 돌아온다' 는 더는 참이 아니고 되돌리기는 `--with <id>` 하나다" → **ADR-074 의 원래 문장("누적하지 않는다 — 로그는 마지막 설치가 실제로 한 일이다 · 제외 없이 다시 깔면 파일이 돌아온다")이 다시 참이 되고 모든 id 종류로 넓어진다.** ADR-099 R1 "더하는 것은 `--without`·위저드 해제, 빼는 것은 `--with`" → "install 이 그 실행의 입력으로 다시 쓴다 · update·uninstall 은 바꾸지 않는다"(핵심 — 사라짐을 빼기로 추론하지 않음 — 는 그대로). R3 "기록된 빼기는 install·update 의 모든 선택이 읽는다" → "update·uninstall 이 읽는다; install 은 대체한다". Consequences 의 "플래그 없는 재설치가 더는 되살리지 않는다" 삭제. ADR-097 Q2(누적)는 `assets`·`clis`·`portions` 등 **쓰기 = 기록** 축에는 그대로이고 선택 한 필드만 예외가 된다 — ADR-099 에 한 줄로 적는다.

## 4. PR #693 에 들어갈 변경 (파일 · 함수)
1. **되돌리기**: `src/install-writes.ts` `withRecordedExclusions` · `cumulativeExcluded` 의 install 쪽 — `runInstall`/`executeSpec`(`installer.ts` · `commands/install.ts`)은 **이번 입력만**으로 `excluded` 를 만든다(`thisRunExclusions(spec, previous)`: R4 집합 안은 이번 `--without`/위저드 해제, 집합 밖은 `excludedIds(previous)` 이어받음). update 의 `buildUpdateSpec`(`update-mode.ts:372`)은 `excludedIds(log)` 를 spec 에 싣는 지금 방식 유지. `recordInterruptedInstall` 도 같은 집합.
2. `src/interactive.ts` — `rechecked()`(658행) 와 `--with` 출력 삭제 → `unchecked(log, checked)` 가 해제된 id 를 `--without` 으로 `RUNS AS` 와 `installSpecFromOptions` 에 넘긴다. `updateInitialSelection`(272행) 유지. `src/types.ts` `releaseExclude` 삭제 · `selectionVia?: "flag"|"wizard"` 추가(`commands/install.ts` → `flag`, 위저드 → `wizard`).
3. `src/install-log.ts` — `InstallLog.selections?` · `SelectionEvent {at; harness; by; via?; with?; without?; released?; kept?; interrupted?}` · `SELECTIONS_MAX = 100` · `appendSelection(log, ev)`(효과분 비면 그대로 · 상한). `migrateExcluded(log, projectDir)` 가 §2.2 규칙 1–4 를 적용(`LEGACY_REINSTALL_WINDOW_MS = 600_000`, X 폴더 최대 mtime 은 `listFilesRecursive` + `statSync`)하고 `appendSelection(by:"migration", released, kept)` · `legacyDroppedKeys` 는 `released` 전체로 넓혀 화면이 쓴다.
4. `src/install-writes.ts` `composeWriterLog` — `excludedIds(previous)` 대비 효과분으로 `appendSelection(by:"install", via, with, without, interrupted?)`. `src/installer.ts` 호출 2곳에 `via` · `interrupted`.
5. `src/install-render.ts` · `update-mode.ts` 화면 — ↺ 줄 2종(§3) · `excludedStillThere` 문구 교체 · migration 규칙 2 줄. `src/excluded-still-there.ts` 판정 재사용.
6. `src/commands/list.ts` — `Selections` 절: 현재 `excluded` id 별 한 줄(종류 · `still on disk`) + `selections` 최근 10개(`YYYY-MM-DD  install --without a, b` · `… re-added x (wizard)` · `… migration: released …, kept …`).
7. 문서: USAGE 플래그 표(`--without` 은 "이 install 의 선택 — 다음 플래그 없는 install 이 되돌린다 · update 는 지킨다") · "What you drop stays dropped" 문단을 "…until the next install" 로 · `explicit-exclusion-design-2026-10-04.md` §0 감수 문장 삭제 · R1·R3·R5 문단 교체 · ADR-099 Decision/Consequences 갱신(§3 "대체되는 문장") · ADR-097 79행과 Amends 줄에 ADR-099 참조 추가. 새 ADR 없음(머지 전 같은 PR).
8. 테스트: `tests/explicit-exclusion.test.ts` 의 R3 install 쪽(124·161행 "플래그 없는 install 이 깔지 않는다") 을 **반대 단언**으로 교체 · update 독자 테스트(150·176·207·318행)는 유지 · 위저드 435·478행을 `--without` 출력으로 · R5 355·390행에 §2.2 규칙 · 아래 §5.

## 5. 검증 (수정 없이는 실패 + 음성 대조)
| # | 시나리오 | 기대 |
|---|---|---|
| V1 새 A | `install --without fd` → 폴더 삭제(변종: 유지) → `update` | `excluded=[fd]` · 이력 1줄 · update 가 깔지도 되살리지도 갱신하지도 않음(유지 변종은 `⊘ … no longer updates`) · 이력 길이 1 |
| V2 새 B | `--without fd` → `install` → `update` | 2단계: fd 깔림 · `excluded=[]` · 화면 `↺ fd — dropped earlier, installed again …` · 이력 += `{with:[fd]}` · 3단계: fd 갱신 |
| V3 위저드 | 기록 `excluded=[fd]`에서 (a) 재체크 (b) 그대로 | (a) `RUNS AS` 에 fd 없음 · 깔림 · 이력 `{via:wizard, with:[fd]}` (b) `RUNS AS … --without fd` · 그 문자열을 그대로 비대화형으로 실행한 결과와 기록 동일 |
| V4 범위 | `excluded=[codex:top, baseline:rules/x]`(tooling) 에서 `install --cli claude`(플래그 없음) · 변종: `--track data` 만 | 전자: `codex:top`·`baseline:rules/x` 풀림 + `↺ codex:top — no longer excluded …` · 다음 update 가 `top` 복원. 변종: tooling 의 baseline id 는 이어받음(R4 집합 밖) |
| V5 opt-in | `--with X`(opt-in) → `--without X` → `install` → `update` | 2단계 `excluded=[X]` · 3단계 `excluded=[]` + ↺ 변형 줄, X 안 깔림(opt-in) · 4단계 update 가 X 갱신(`assets` 에 있음) |
| V6 효과분·보존 | 같은 선택 재설치 · update · `uninstall --only <다른 id>` · 중단 install(`--without mcp:context7`, #600 픽스처) | 이력 길이 불변 · 중단은 `{without:[mcp:context7], interrupted:true}` 1줄 · R6 거절 그대로 |
| V7 옛 기록 4가지 | 163 모양 `assets ∋ fd ∧ excluded ∋ fd`, 표시 없음: (1) 폴더 없음 (2) 폴더 mtime = `installedAt − 30 s` (3) `installedAt − 1 h` (4) `installedAt + 1 h` | (1)(3)(4) `kept:[fd]` · update 안 갱신 · (4) 만 `⊘ … To manage it again: run install` (2) `released:[fd]` · `↺ fd — released: the last install re-added it` · update 갱신. 키 id · 플래그 밖 baseline 은 모두 `released` |
| V8 상한 · list | 101회 변경 · V2 뒤 `list` | 길이 100, 최고(最古) 탈락 · `Selections` 절에 `--without fd` · `re-added fd` 두 줄 |
| Docker | 163 으로 B 순서(`--without fd` → `install` → 폴더 있음) → 이 판 `update` → `install --without fd` → `install` → `update` | V7(2) → V1 → V2 와 같은 화면·기록. 태그 `uzys-fable-sel`, `--rm`, 끝나면 이미지 삭제. 163 으로 `update` 를 한 번 더 돌린 변종은 V7(4) |
음성 대조(각각 `tsc` src 무오류 확인 뒤): `thisRunExclusions` 를 누적으로 되돌림 → V2·V4 red · 위저드 `--without` 출력 제거 → V3(b) red · 창 비교 제거 → V7(2)·(3) red · `m > t` 가지 제거 → V7(4) red · `appendSelection` 제거 → V1·V6 red · 상한 제거 → V8 red.

## 6. 가정과 남는 위험
- 가정 1: R4 집합 계산(`key-ids.ts` `renderedKeyIds` — 깔린 CLI ∪ 이번 `--cli`, 기록 트랙 ∪ 이번 `--track`)을 대체 범위에 그대로 쓴다. 집합 밖 id 이어받기가 없으면 트랙만 바꾼 install 이 다른 트랙의 빼기를 조용히 푼다 — V4 변종이 묻는다.
- 가정 2: update·uninstall 의 기록 쓰기 9곳이 `{...log}` spread 다(grep 확인) — `selections`·`excluded` 보존을 V6 이 고정한다.
- 위험 1(§2.2 규칙 2): `install` → `install --without X` 를 10 분 안에 연달아 한 옛 A2 를 B 로 읽는다 — update 가 X 를 다시 갱신하고 `--without X` 한 번으로 복귀, 손실 없음. 범위: 26.162.0(2026-09-27)–26.163.0 설치본 중 그 순서를 밟고 아직 install 을 다시 하지 않은 것.
- 위험 2(§2.2 규칙 4): 163 에서 update 를 돌린 옛 B 는 첫 실행에 `⊘` 한 줄을 보고 플래그 없는 install 한 번(§3 이 자동으로 푼다). 손실 없음.
- 위험 3(§3 범위): 다중 CLI 설치자가 `install --cli claude` 만 돌려도 codex 키 빼기가 풀린다 — 화면 ↺ 줄이 미리 말하고, 지키려면 그 install 에 `--without codex:top` 을 함께 준다(`RUNS AS` 가 위저드에서 그 명령을 보여 준다). 사용자 요구 "최신 형태"의 대가다.
- 위험 4: 플래그 없는 install 이 "선택 초기화"이므로 CI·스크립트가 `install` 을 반복 실행하면 전에 뺀 것이 돌아온다 — USAGE 가 "플래그는 매 install 에 다시 준다(또는 update 를 쓴다)" 를 말한다. update 는 선택을 바꾸지 않으므로 갱신 목적의 반복 실행은 update 로 안내.
- 범위 밖(기록만): `uninstall --only X` 는 선택 이력에 들지 않는다 · `at` 는 시스템 시각, 순서는 배열 위치 · 선택이 클론 간 공유되지 않는 것은 gitignore 의 기존 성질.

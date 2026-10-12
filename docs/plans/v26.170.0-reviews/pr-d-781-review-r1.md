# PR-D (#781) 리뷰 — 설계 이행 + 실제 옛 npm 판 손실 탐색

- 대상: `a8ceaee` (PR-C `8d2e428` 위). PR-D 단독 diff = `git diff 8d2e428..a8ceaee`
- 대조군: main `1e4dcbf`(origin/main) · PR-C `8d2e428` — 같은 판을 같은 방식으로 각각 도커 이미지로 빌드(`test/docker/Dockerfile`, npm pack 설치)
- 증거: `rev781/evidence/` (스크립트 `scripts/` · 전체 표 `matrix.txt` · 실행별 로그 `logs/<v>/<셀>.log` · 표본 `sample-26.125-claude+codex/` · main A 대조 `main-A-26.125/` · `matrix-main-A.txt` · 표적 시나리오 `targeted/` · 변이 `mutations.txt` · CI `ci.txt`)

## Review Summary

| 심각도 | 건수 | 상태 |
|---|---|---|
| CRITICAL / BLOCKER | 1 | **block** |
| HIGH | 0 | — |
| MEDIUM | 0 | — |
| NOTE(단순화 · 문서) | 4 | info |

**판정: BLOCK** — 블로커 1건(설치자가 고친 옛 하네스 훅 줄이 백업 없이 사라진다). 고치는 데는 조건 하나면 되고, 그 밖의 축(파일 손실 0 · B2 · 링크 · dry-run · 잔존 정리)은 전부 통과했다.

## 매트릭스 (실제 옛 npm 판 설치 → 설치자 표식 → 새 빌드)

- 판: 26.100.0 · 26.125.0 · 26.132.0 · 26.140.0 · 26.150.0 · 26.160.0 (`/opt/old/<v>` 에 npm 게시판 설치)
- CLI 조합: {claude,codex} · {codex} · {claude} · {codex,opencode}
- 흐름: **B** dry-run → 바로 uninstall · **A** PR update ×2 → uninstall · **C** main update(v26.169 상당) → PR uninstall · **F** `--cli <뒤>` dry-run → `--cli <뒤>` → 전량 · **F2** `--cli <앞>` → 전량 · **Bm / Bc** 같은 장면을 main / PR-C 로 uninstall. 판마다 24셀, 총 **144셀** + main A 대조 4셀 + 표적 4셀
- 설치자 표식: 자기 룰 · 에이전트 · 스킬 · 커맨드(`commands/` · `commands/ecc/`) · 번들 스킬 안 노트 · **은퇴 스킬 폴더 안 노트** · 고친 룰(`git-policy.md`) · **고친 은퇴 스킬 파일** · 자기 settings 훅 줄 + 스크립트 · **옛 하네스 훅 줄 두 개를 고침**(`session-start` 줄 끝에 주석 · `protect-files`/`mcp-pre-exec` 줄에 `&& bash ./scripts/team-guard.sh` 이어 붙임) · `.agents/skills` 자기 스킬 · 번들 사본 안 노트 · 고친 사본 · **`.claude/skills/<번들 스킬>` 을 프로젝트 밖으로 옮기고 링크**(밖에 표식 파일) · **B2 공격**: codex 계열에는 다른 프로젝트의 옛 claude 설치 `.claude/` 를 통째(옛 `settings.json` 포함) · claude 단독에는 옛 codex 설치의 `.agents/skills/` 를 바이트 그대로
- 판정: 표식 토큰마다 라이브 / 백업에만 / **LOST**(어디에도 없음) · B2 파일 sha 대조 · 밖 디렉터리 sha 대조 · dry-run 전후 스냅숏 · 지문 일치 라이브 잔존(`src/legacy-fingerprints.ts` 의 372쌍으로 직접 셈, `.agents/skills/<rel>` 은 `.claude/skills/<rel>` 로 조회)

### 결과

| 축 | 결과 |
|---|---|
| 하네스 파일 축 표식 손실 | **0 / 144셀** — 자기 룰·에이전트·스킬·커맨드·노트·은퇴 스킬 노트·고친 은퇴 스킬 파일·자기 훅 줄·자기 스크립트 전부 라이브. 백업에만 남는 표식 집합(고친 룰 · 고친 `.agents` 사본 · 일부 판의 번들 스킬 노트)은 **24개 B 셀 전부 main 과 같다**(#477 · ADR-097 기존 동작) |
| **고친 옛 하네스 훅 줄** | **48셀 LOST**(claude 를 포함한 모든 셀 = 6판 × 8흐름). 그중 **B · F · F2 24셀은 PR-D 가 새로 만든 손실**(같은 장면 main Bm · PR-C Bc 0/12). A · C 24셀은 **main 도 같이 잃는다**(main 만으로 A 흐름 4/4 LOST — `matrix-main-A.txt`) → 기존 결함 |
| B2 | B2 파일이 있는 72셀 전부 바이트 그대로(`changed=0`) — codex 계열의 옛 `.claude/settings.json`(옛 훅 줄 포함)도 그대로 |
| 프로젝트 밖 링크 | 전 셀 밖 디렉터리 sha 불변 |
| dry-run | B · F 36회 전부 디스크 불변. dry-run 이 말하는 수 = 실행의 수(표본: `.claude/` 66 중 50 백업 · `.agents/` 7 중 4 백업 + `AGENTS.md` 1 = 55 = 실제 백업 55) |
| 잔존(지문 일치 라이브) | claude+codex B·F·F2: **전 판 0**(main: 26.100 36 · 26.125 44 · 26.132 44 · 26.140 37 · 26.150 29 · 26.160 0). A·C 는 2 = `agents/{data-analyst,strategist}.md` — update 가 `displaced` 로 적은 자리(설계 N1 예정대로). claude 단독 · codex 계열의 나머지 잔존은 **전부 B2 사본**(그대로 둬야 하는 것) — 잔존에서 B2 를 빼면 위 두 파일 말고는 0 |
| 백업 수(26.125 claude+codex B) | main 28 → PR 55 (설계 예상 58과 근사 — 링크로 밖에 옮긴 스킬 1개 몫이 빠짐) |
| `--cli` | `--cli codex`(claude+codex)는 `.agents/skills` 옛 사본만 걷고 `.claude/` 는 다음 전량에서. codex+opencode 의 `--cli codex` 는 `.agents/skills` 공유분을 건드리지 않음 |
| 표적 | ① codex 단독 + 설치자의 쓰기 금지 `.claude/rules/` → PR · main 모두 "cannot write here — nothing was removed"(새 동작 아님) ② codex 단독 + `.claude` 가 밖을 가리키는 링크(안에 옛 하네스 바이트) → PR · main 같은 한 줄, 밖 불변 |

## Findings

[CRITICAL — BLOCKER] 설치자가 고친 옛 하네스 훅 줄을 통째로 걷는다 — 고친 내용이 백업 없이 사라지고 화면은 "하네스 배선"이라고만 말한다
File: `src/commands/uninstall.ts` `removeLegacyHookWiring`(ⓑ″) → `src/hook-ref.ts` `removeRetiredHookRefs`(`projectAnchoredRef` 로 참조만 비교)
Issue:
- 장면: 옛 판(26.100~26.160 전부)으로 깔고 설치자가 하네스 훅 줄 하나에 자기 명령을 이어 붙였다 — `bash "$CLAUDE_PROJECT_DIR/.claude/hooks/protect-files.sh" && bash ./scripts/team-guard.sh`. 바로 `uninstall --yes`.
- PR-D: 스크립트가 지워지니 그 핸들러를 **통째로** 걷는다 → `team-guard.sh` 호출이 `settings.json` 에서도, 어디의 백업에서도 사라진다(`settings.json` 은 백업하지 않는다). 화면: `✓ .claude/settings.json — removed harness hook wiring from an older version (script gone): hooks/session-start.sh · hooks/protect-files.sh · hooks/mcp-pre-exec.sh`.
- main · PR-C: 같은 장면에서 줄을 그대로 두고 `⊘ left .claude/settings.json — may still hold the harness's hooks (not on record): … — delete them by hand if they are not yours` 로 알린다.
- 재현(증거 `evidence/sample-26.125-claude+codex/` — `B-settings-1.json` 대 `B-settings-un.json`, `Bmain-settings-un.json`):
  ```
  /opt/old/26.125.0/.../agent-harness install --track tooling --cli claude --cli codex
  # settings.json 의 protect-files 핸들러 command 끝에:  && bash ./scripts/team-guard.sh
  agent-harness uninstall --yes        # PR-D
  grep -r team-guard . --exclude-dir=.git   # 없음
  ```
- 왜 블로커인가: 이번 사이클의 합격선 "설치자가 고친 파일 · settings 줄이 백업 없이 사라지는 것 0" 에 직접 걸리고, 루트 `CLAUDE.md` §설치자 디스크 "함께 쓰는 파일은 **하네스 몫만** 뺀다" 와 ADR-097 결정 9(화면은 실제로 한 일만)에 어긋난다. 설계 §4.4 가 "설치자 핸들러는 손대지 않는다" 고 적었지만 판정이 참조(경로)만 봐서 **하네스 줄 안에 든 설치자 몫**을 구분하지 못한다. 범위는 B · F · F2 — #781 이 겨냥한 "update 를 한 번도 안 하고 바로 uninstall" 바로 그 흐름이다.
- 단순한 해법(구조로 경우를 없앤다): 옛 템플릿 훅 핸들러는 v26.70~169 의 114판 전체에서 **정확히 8가지 모양**뿐이고 command 는 전부 `bash "$CLAUDE_PROJECT_DIR/.claude/<참조>"` 그대로다(태그 전수 실측 — `agentshield-gate` 27 · `gate-check` 27 · `hito-counter` 55 · `mcp-pre-exec` 87 · `protect-files` 114 · `session-start` 114 · `task-brief-nudge` 14 · `suggest-compact` 93). ⓑ″ 는 **command 가 그 문자열과 바이트로 같은 핸들러만** 걷으면 된다 — 파일 지문과 같은 원칙("바이트가 다르면 손대지 않는다")이고, 고친 줄은 main 처럼 `left … may still hold the harness's hooks` 안내로 떨어진다. 이렇게 하면 ⓑ″ 의 두 번 호출(아래 NOTE-2)도 하나로 줄 수 있다.
- 참고(이 PR 밖, 기존 결함): A · C 흐름에서는 main 도 같은 줄을 잃는다 — update 의 `legacySettingsSeed` 가 고친 핸들러를 하네스 몫으로 잡고(`removed the harness part · kept yours`), uninstall 의 ⓐ 가 걷는다(화면은 `(yours stays)`). 같은 "정확히 같은 모양만" 규칙을 그 식별에도 걸면 한 번에 닫힌다 — 이 PR 에 넣을지 별도 이슈로 뺄지는 리드 판단. 은퇴 배선(`suggest-compact`)의 `evenIfScriptExists:true` 걷기도 같은 모양 비교가 맞는 자리다(기존 동작).

[NOTE-1 · 단순화] ⓑ′ 가 자격 없는 자리까지 `removeRecordedFile` 에 넣고, 자격 판정(`mayReclaimLegacy`)은 그 안 깊숙이 있다
File: `src/commands/uninstall.ts` ⓑ′ 루프 · `removeRecordedFile` 의 `legacy` 계산
Issue: 지문 경로 152개(+ `.agents` 사본) 중 디스크에 있는 것은 CLI 집합 · `excluded` · `displaced` 와 무관하게 전부 `removeRecordedFile` 로 들어가 링크 · 밖 실체 · 읽기 실패 부수효과(`forgotten` · `outside` · `unjudged`)를 먼저 겪은 뒤에야 "자격 없음 → leave" 로 빠진다. 지금 화면 차이는 관측되지 않았지만(표적 ② — main 과 같은 한 줄), 판정 한 곳이 두 함수에 흩어져 있다. 더 단순한 모양: ⓑ′ 루프에서 `mayReclaimLegacy` 와 지문 일치를 먼저 걸러 자격 있는 경로만 넘기고, `removeRecordedFile` 은 `legacy` 를 인자로 받는다(ⓑ 의 no-sha 지문 판정만 안에 남음).

[NOTE-2 · 단순화] ⓑ″ 의 "이번 실행 뒤 스크립트가 없나" 를 두 번 호출 · 화면 키 문자열 가공으로 맞춘다
File: `removeLegacyHookWiring`(같은 함수를 `evenIfScriptExists` true/false 로 두 번) · `remnantFor` 의 `wiringGone.includes(\`hooks/${k.split("#")[1]}\`)`
Issue: 미리보기 일치를 위한 장치인데, `remnantFor` 쪽은 `hooks.<Event>#<basename>` 키에서 basename 만 떼어 `hooks/` 를 붙인다 — 키 형식과 "참조가 `hooks/` 아래" 라는 가정에 묶여 있다. 블로커 수정(정확한 모양 비교)과 함께 "걷을 핸들러 집합"을 한 번 계산해 ⓑ″ 와 remnant 가 같은 집합을 읽게 하면 두 장치가 하나가 된다.

[NOTE-3 · 문서 동기화] 설계가 약속한 `statusLine` · `.mcp-allowlist` 회수를 뺐는데 문서 · 생성물이 그대로다
File: `docs/plans/v26.170.0-legacy-displaced-design.md` §2 행 10 · 12 · §4.4 ⓑ″ · §6 PR-D · §7.1 ④ / `src/legacy-fingerprints.ts` `LEGACY_STATUSLINE_VALUES`(소비자 0)
Issue: 사용자의 최소 범위 지시로 뺀 것 자체는 타당하다. 다만 설계 문서는 여전히 PR-D 범위로 적고 있고 export 가 읽는 곳 없이 번들에 남는다 — 다음 세션이 "구현됨" 또는 "미완"으로 오인한다(doc-governance). 설계에 "PR-D 에서 제외(사용자 지시 2026-10-12)" 한 줄 + 생성기에서 빼거나 사용처가 생길 때까지 둔다는 결정 중 하나.

[NOTE-4 · 테스트 공백] ⓑ″ 의 "claude 가 깔렸을 때만" 문을 무는 테스트가 없다
File: `tests/uninstall-legacy-fingerprints.test.ts`
Issue: 변이 M6(`removeLegacyHookWiring` 의 `installedClis(log).includes("claude")` 제거)이 8/8 green. 컨테이너 B2(codex 단독 + 옛 `settings.json`)는 스크립트가 함께 있어 문 없이도 통과하므로 이 문만의 증거가 없다. codex 단독 로그 + 옛 훅 줄 + **스크립트 없음** 픽스처 하나면 문다.

## 설계 이행 확인

- §4.4 ⓑ′ 범위 = `scope.has` ∩ CLI 집합(B2) · `excluded` 제외(N7) · `displaced` 자리 제외 · 이미 ⓑ 가 판정한 경로 제외 · 링크 슬롯/밖 실체 건너뜀 — 코드 · 컨테이너 모두 확인.
- 판정 두 갈래(번들 자리 → 백업 없음 · 번들 밖 → 백업) — `judge` 입력 `next = disk / null` 로 기존 판정 함수 하나를 재사용(새 판정 함수 없음). 26.125 claude+codex B: 번들 밖 문구 `older harness version (byte-identical, not in the current bundle) — saved a copy, removed from live` 로 표시.
- ⓑ″ 는 `portions` 없을 때만 · `RETIRED_HOOK_WIRING_REFS` 제외(N8) · ⓐ 를 ⓑ″ 뒤로 옮겨 남은 훅 안내가 걷은 줄을 다시 세지 않음 — 확인. 단 위 블로커.
- 구현자 주장 수치 재현: 26.125 claude+codex 지문 잔존 74→0(내 표식 구성에서는 71→0, 백업 55) · 26.140 75→0(72→0, 백업 52) — 일치(차이는 표식 구성).

## 검증 실행

- `npm run ci`(파이프 없이) **exit 0** — 157 파일 · 2,348 테스트 · branches 89.46%(`evidence/ci.txt`)
- PR-D 테스트 8/8 green. 변이(별도 사본, 적용 diff 확인 · `tsc --noEmit` 0 · 복원 확인): M1 ⓑ′ 호출 무력화 → 2 red · M2 `inBundle` 상수 true → 1 red · M3 CLI 집합 문 제거 → 2 red · M4b `excluded` 문 무력화 → 1 red · M5 ⓑ″ `evenIfScriptExists:true` → 1 red · **M6 ⓑ″ claude 문 제거 → 0 red**(NOTE-4). (M4 첫 판은 import 미사용으로 tsc 2 → 무효 처리 후 M4b 로 재실행)

## Positive Observations

- 지문은 소유 근거가 아니라는 원칙이 코드 모양에 그대로 드러난다 — 기록이 말하는 자리는 ⓑ, 기록 밖만 ⓑ′, 판정 함수는 하나(`judge`).
- B2 공격(다른 프로젝트의 옛 하네스 `.claude/` 통째 · `.agents/skills` 통째 복사)이 72셀 전부 바이트 그대로 — CLI 집합 문이 실제 옛 판 바이트 앞에서 문다.
- 은퇴 스킬 폴더 안 설치자 노트 · 고친 은퇴 스킬 파일이 전 판에서 라이브에 남는다(바이트가 다르면 손대지 않는다).
- 프로젝트 밖으로 링크한 스킬 폴더 너머는 144셀 전부 불변.
- dry-run 이 실행과 같은 수 · 같은 훅 줄을 말하고 디스크를 건드리지 않는다.

## Verdict
- [ ] CRITICAL 이슈 없음 — **블로커 1**(고친 옛 하네스 훅 줄 손실, B · F · F2 에서 새로 생김)
- [x] DO NOT CHANGE 영역 미변경
- [x] SPEC/PRD 범위 내 — 단 설계가 약속한 statusLine · `.mcp-allowlist` 제외가 문서에 반영 안 됨(NOTE-3)

수정 뒤 재리뷰 범위: ⓑ″ 판정(정확한 모양 비교) · 그 단위 테스트(고친 줄 · 이어 붙인 줄은 남고 "left … may still hold" 안내) · 컨테이너는 claude 포함 B 셀만 다시 돌리면 된다(스크립트 `evidence/scripts/m.sh`, `FLOWS=B` · `CLISETS="claude claude+codex"`).

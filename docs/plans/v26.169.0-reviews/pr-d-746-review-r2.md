# rev-D3 — PR-D 재리뷰 (fix/uninstall-no-folder-move @ 9511452, 병합 eb6dd6d 위 리뷰 반영)

- 비교 기준: main@0418019 · 수정 전 PR(eb6dd6d)
- 방법: 컨테이너 실설치. 이미지 세 개를 `npm pack` 경로로 만들었다: 새 빌드 `uzys-harness-test:rev-d3`, main(`git archive 0418019`)은 `rev-d3-main`, 수정 전(`git archive eb6dd6d`)은 `rev-d3-pre`. 끝난 뒤 세 이미지를 모두 지웠다.
  npm 게시본 v26.125.0, 26.126.0, 26.132.0, 26.150.0, 26.153.0, 26.161.0 을 실제로 설치하고, 설치자 파일과 편집을 더한 뒤 이미지의 빌드로 uninstall/update 를 돌렸다.
  스크립트는 `scratchpad/rd3/attack{,2,3,4,5}.sh`, 결과는 `rd3/out*.txt` 에 있다.
- 사본 상태: detached 9511452, `git status --ignored` 깨끗함. 변이 6종은 모두 복원 확인했다. node_modules 심링크와 dist·coverage 는 지웠다.

## 결론: BLOCKER 있음 (2건 — 둘 다 손실은 아님. 화면 문구와 문서가 사실과 다르다)

손실 BLOCKER-1(r1)은 **해소됐다**. 필드 없는 옛 설치본 처리에서도 **설치자 손실은 재현되지 않았다**.

---

## BLOCKER-1 — 옛 판으로 설치하고 새 판으로 `install` 을 다시 돌린 뒤 uninstall 하면, 남은 옛 하네스 파일을 "of yours" 라고 부른다. 그 안에는 은퇴 목록에 든 룰·훅·에이전트도 있어 라이브로 남는다

**리드 조건 위반**: "화면이 그것을 'yours' 라고 부르면 안 된다". 이 PR 이 새로 낸 `leftFolderLines` 는 `records === "writer"` 이면 "of yours" 라고 쓴다.
그런데 옛 판 위에서 새 install 이 만든 writer 기록에는 옛 판이 깐 파일이 들어 있지 않다(`inheritScanned` 는 옛 필드를 거르기만 하고, install 은 은퇴 파일을 회수하지 않는다).

재현(컨테이너, `rd3/attack4.sh`):
```
git init -q && npx -y @uzysjung/agent-harness@26.125.0 install --track tooling --cli claude --project-dir .
agent-harness install --track tooling --cli claude --project-dir .     # 새 빌드 — 기록 records=writer
agent-harness uninstall --yes --project-dir .
→ ⊘ left  .claude/ — 53 file(s) of yours: CLAUDE.md · agents/build-error-resolver.md · agents/code-reviewer.md +50 more
```
- 라이브로 남은 22개는 전부 **v26.125 템플릿과 바이트가 같은 하네스 파일**이다(`/tmp/pkg/package/templates` 와 cmp).
  - `rules/{code-style,error-handling,gates-taxonomy,no-false-ship}.md` · `hooks/{checkpoint-snapshot,mcp-pre-exec,spec-drift-check}.sh` · `agents/{build-error-resolver,code-reviewer,plan-checker,security-reviewer,silent-failure-hunter}.md` 는 **`RETIRED_PATHS` 에 든 파일**이다. 리드가 감수한 범위("은퇴 목록에 **없는** 옛 하네스 파일")를 넘는다. `.claude/rules/*.md` 4개는 다음 Claude Code 세션이 계속 로드한다.
  - 나머지는 `data-analyst` · `strategist` · `commands/ecc/*` 8개다.
- 같은 흐름에서 26.132 는 "42 file(s) of yours", 26.150 은 "36 file(s) of yours"(continuous-learning-v2 등 은퇴 스킬과 `audit-harness-fit/references/official-criteria.md`)가 나온다(`out2-rev-d3.txt` D).
- 두 번째 동작이 새 `update` 이면 문구는 "not on the install record — …" 로 정직하다. 그래도 위 22개는 **똑같이 라이브로 남는다**: update 가 필드를 채우면 `recordedTrackSpots` 의 `no-sha` 경로가 꺼진다(필드 있음 → `none`).
- 즉 r1-N1 수정은 "옛 판 설치 뒤 새 판을 한 번도 돌리지 않은" 설치본에만 듣는다. 새 테스트 N1 도 그 경로(`toFieldless` 직행)만 본다.
- 대조:
  - main@0418019: 같은 6흐름에서 `.claude/` 를 통째로 옮겨 라이브 파일은 0개이고, 이 문구는 없다.
  - eb6dd6d(수정 전 PR): 같은 결과(54 · 42 · 35 "of yours")다. 9511452 가 만든 회귀가 아니라 **PR 전체의 결함**이고, r1 은 직행 경로만 시험해 놓쳤다.
- 완료 기준:
  ① 옛 판 → 새 install(또는 update) → uninstall 에서 남는 옛 하네스 파일을 "of yours" 라고 부르지 않는다.
  ② `RETIRED_PATHS` 의 룰·훅·에이전트가 그 흐름에서도 라이브에 남지 않는다. 남기기로 하면 그것은 리드의 감수 결정이고 화면은 ① 을 지킨다.
  ③ 회귀 테스트를 둔다: 필드 없는 기록에서 새 install(`runInstall` add)을 거친 뒤 uninstall 한다.
  (②를 감수로 돌릴지는 리드가 정한다. ①은 리드가 이미 세운 조건이다.)

## BLOCKER-2 — `llms.txt` 가 아직 폴더 이동을 말한다(r1 문서 BLOCKER 와 같은 종류)

- `llms.txt:39`: "when you remove everything it doesn't delete `.claude/`, `.codex/`, or `.opencode/` but renames each to something like `.claude.backup-<time>`, with your own files in them."
- 랜딩 `index.html:421` 이 이 파일로 링크한다. 이 저장소는 README·README.ko·index.html·llms.txt 를 함께 고친다(#741 · #750 이 네 파일을 같이 바꿨다).
- grep 패턴(`\.claude\.backup-|renamed? to something like|이름을 바꿔|백업 폴더|backup folder|다시 꺼내|…`)으로 확인했다.
  - 대조군: eb6dd6d 판 README.ko.md 와 index.html 에서 각각 1줄씩 잡혔다.
  - 현재 사용자 문서(CHANGELOG · docs/plans · decisions 제외)에서는 `llms.txt:39` **1줄만** 남았다. 나머지 일치는 `.gitignore` · `biome.json` · `tsconfig` · `docs/dogfood`(과거 기록) · `docs/todo.md`(과거 기록) · `CONTEXT-FILES.md`(AGENTS.md 단일 파일 백업 — 다른 동작) · user-centered-explanation 예문이다.
- README.ko.md:201 · index.html:366 은 README.md:194 와 같은 뜻으로 고쳐졌다(r1 BLOCKER 해소).
- 완료 기준: llms.txt 의 해당 구절을 README.md:194 와 같은 뜻으로 고친다. 위 grep 결과가 사용자 문서 0줄이 된다.

---

## 판정 항목별

### 1. 손실 BLOCKER-1(r1) — 해소
attack.sh A: 세 판 × 세 동작(재설치 뒤 노트가 skillFiles 에 sha 로 기록됨, idx=2·2·3).

| 판 | 전량 uninstall | `--cli claude`(claude+codex) | update |
|---|---|---|---|
| 26.126 / 26.150 / 26.153 새 빌드 | 노트 **라이브 그대로**, SKILL.md 회수 | 노트 라이브, `.codex` 유지 | 노트 → `my-team-notes.md.backup-<t>` |
| eb6dd6d(수정 전) | **소실** | **소실** | **소실** |
| main | 폴더 백업 안에 보존 | 폴더 백업 안에 보존 | **소실**(PR 밖 결함 — 이 PR 이 함께 닫음) |

### 2. 새 판정("번들 템플릿에 있는 파일만 대상")이 만든 누수와 오판 — 손실 없음
- 정상 writer 기록: `recorded()` 는 writer 이면 필터를 건너뛴다(recorded.ts:184). 은퇴 파일은 sha 그대로 지워지고, update prune 도 `recordOf` → sha 로 백업 없이 치운다. 회귀 없음.
- 판마다 템플릿이 다른 데서 오는 누수(NOTE-A): v26.150 이 깐 `audit-harness-fit/references/official-criteria.md`(현행 템플릿에 없음, 스킬은 현행 번들)를 보자.
  - 직행 uninstall 에서 **라이브로 남는다**(eb6dd6d·main 은 치웠다). SKILL.md 가 없는 폴더의 참고 파일이라 Claude Code 는 로드하지 않는다.
  - 새 install 을 거치면 writer 기록에서 빠져 "of yours" 로 나온다(BLOCKER-1 에 포함).
  - update 경로에서는 안 고친 하네스 파일인데도 `.backup-<t>` 가 하나 생긴다(전에는 그냥 지웠다).
  - 현행 번들 스킬 안에서 이후 템플릿에서 빠진 파일은 git 기준 이 1건이다(v26.150 대비. 126·140·153·161 대비는 폴더째 은퇴한 것뿐).
- 반대 방향의 오판(설치자 파일을 하네스 것으로 읽음)은 재현되지 않았다.

### 3. 필드 없는 옛 설치본(manifest 열거 + no-sha) — 설치자 손실 없음
attack.sh C(v26.125 필드 없음 · v26.132 필드 있음). 마커 15종의 위치를 grep 으로 추적했다.
- **설치 전부터 있던** 동명 설치자 파일(`agents/reviewer.md` · `rules/test-policy.md` · `skills/north-star/SKILL.md` · `hooks/session-start.sh`)은 **옛 판 install 자체가 백업 없이 덮어 이미 없다**(설치 직후 측정, main 도 같음). 새 빌드가 낸 손실이 아니다.
- 설치 뒤 설치자 동작:
  - 하네스 룰 편집 → 그 파일 하나 백업.
  - **은퇴 경로와 같은 이름의 자기 파일**(`rules/database.md` · `commands/uzys/plan.md` · `hooks/gate-check.sh`)과 **선택하지 않은 번들 스킬 이름의 자기 SKILL.md**(`skills/gemini-delegate/`) → v26.125(필드 없음)에서는 `backup+remove`, 화면은 "no checksum on record — saved a copy, removed from live". 내용은 백업에 남는다. 설계 §2.3 #3 ⓐⓒ 그대로다.
  - v26.132(필드 있음)에서는 `commands/uzys/plan.md` 만 `backup+remove` 였다(그 필드에 `commands/uzys` 항목이 없어 `absent`). 나머지는 라이브에 남는다.
  - 자기 스킬 · 자기 룰 · 번들 스킬 폴더 안 노트 · 깊은 파일은 라이브 그대로다.
- 결과: 15종 모두 라이브나 그 파일 하나의 백업에 있다. 단 v26.125 에서는 안 고친 옛 하네스 파일도 현행 템플릿과 달라 32개 백업이 생긴다(설계 A6 이 받아들인 동작).

### 4. 문서
- README.ko.md · index.html 은 고쳐졌다. **llms.txt 는 남았다** → BLOCKER-2.
- 루트 `CLAUDE.md:30·34` 는 실제 동작과 맞다:
  - 되돌리기 주체 = uninstall(전량 · `--cli`). E1 에서 `put back .claude/agents/reviewer.md` 를 확인했다.
  - update 은퇴 회수와 `--reinstall` 은 예외로 적혀 있다.
  - `src/` 에 `cpSync` 통째 복사 · `backupDir` · `moveAside` 호출이 없다. update 실행에서 `.claude.backup-*` 폴더도 0개였다.

### 5. 1차 통과 공격 회귀 표본(attack2 E — 새 판 install → 새 판 uninstall) — 전부 유지
- E1: claude+codex+opencode, 설치 전부터 있던 `agents/reviewer.md`(displaced) · settings 키 · .mcp.json 서버 · AGENTS.md · .gitignore, 그 위에 깊은 파일 · `.codex/mine.toml` · codex 서버 표 · `.opencode/command/mine.md` · `commands/team/*` · settings.local.json · 번들 스킬 안 노트를 두었다.
  - 12종 모두 라이브로 보존됐다. displaced 는 원본으로 되돌아왔다.
  - 폴더 백업 0개 · 하네스 룰 0개 · `.agents` 0개였다.
- E2 `--cli claude`(claude+codex): `.codex` 와 `.agents` 44개 항목이 전후 동일하다(sha 비교).
- E3 `.claude/agents` → 프로젝트 밖 폴더 링크: 밖 폴더가 전후 동일하고 링크도 남았다.

### 6. 테스트 · 변이 · CI
- `tests/uninstall-legacy-scan.test.ts` 는 4건이다. 변이 6종을 사본에서 다시 돌렸다(`rd3/mutate.py`). 모두 `tsc=0`, `git diff --stat` 로 적용을 확인했고 복원도 확인했다.
  - M1 디렉터리 접두로 되돌림 → red 3
  - M2 prune 이 기준선 Map 을 읽음 → red 1
  - M3 spots 제거 → red 1
  - M4 은퇴 분기 원복 → red 1
  - M5 "of yours" 고정 → red 1
  - M6 옛 기록 파일 노출 → red 1
- 공백: N1 테스트는 필드 없는 기록으로 **직행**하는 경우만 본다. BLOCKER-1 경로(새 install/update 를 거침)는 시험하지 않는다.
- `npm run ci`(파이프 없음, 출력은 `rd3/ci.log` 로 리다이렉트): **exit 0** — 151 files · 2281 tests · branches 89.48 / lines 96.73. `tsc --noEmit` 0.

## NOTE (차단 아님)
- **NOTE-A**: 위 §2 의 `official-criteria.md` 누수 · update 의 불필요한 백업 1개.
- **NOTE-B — settings.json 훅 배선이 남는 범위가 감수 범위보다 넓다.**
  - portions 가 없는 모든 기록(v26.161 까지 실측)에서 uninstall 뒤 하네스 훅 배선이 남는다. 스크립트는 회수되어 없는 파일을 가리킨다.
  - 화면은 "may still hold the harness's hooks … delete them by hand" 로 알린다(설계 §2.3 #5).
  - 다만 v26.150 의 `strategic-compact/suggest-compact.sh` 배선은 **스크립트가 라이브로 남아 계속 실행되는데, 그 안내 줄에 빠져 있다**(`RETIRED_HOOK_WIRING_REFS` 항목). eb6dd6d 도 같다.
  - 리드가 감수한 것은 "v26.125 · v26.132 의 그 판 훅 줄"이다. 실제 범위는 ≤v26.161 이다 — 확인을 권한다.
- **NOTE-C**: 필드 없는 기록에서 은퇴 경로 · 선택하지 않은 번들 스킬 이름의 설치자 파일은 `backup+remove`(라이브에서 빠짐)다. 손실은 아니고 설계 §2.3 #3 대로다.

## 시도한 공격 목록
| # | 공격 | 새 빌드 | eb6dd6d | main |
|---|---|---|---|---|
| A1–9 | 126·150·153 재설치 노트 × 전량 · `--cli claude` · update | 보존 9/9 | 소실 9/9 | 보존 6 · 소실 3(update) |
| B1 | 150 직행 uninstall — 판 차이 템플릿 파일 | 라이브 남음(누수) | 회수 | 이동 |
| B2 | 150 → 새 install → uninstall | 남음 + "of yours" | "of yours"(34) | 이동 |
| B3 | 150 → 새 update → uninstall | 백업 1 · 정직한 문구 | 그냥 지움 | 이동 |
| C1 | 125 필드 없음: 설치 전 동명 파일 4 · 설치 뒤 편집 · 은퇴명 자기 파일 5 · 미선택 번들명 자기 스킬 · 자기 파일 3 | 손실 0(설치 전 4는 옛 install 이 덮음) | 같음, 룰·훅 대량 잔존 | 이동 |
| C2 | 132 같은 공격 | 손실 0 | `north-star/extra.md` **소실** | 이동 |
| D1–6 | 125·132·150 → 새 install/update → uninstall | 하네스 잔존 · install 경로 "of yours" → **BLOCKER-1** | 같음 | 라이브 0 |
| E1–3 | 설치자 파일 12종 · displaced · `--cli claude` 바이트 동일 · 밖 링크 | 전부 유지 | 같음 | — |
| H | 150 · 161 직행: settings 훅 배선 | 남음 + 안내(suggest-compact 누락) → NOTE-B | 같음 | 이동 |
| 문서 | 폴더 이동 서술 grep(대조군 포함) | llms.txt 1줄 → **BLOCKER-2** | — | — |
| 변이 | M1–M6 | 6/6 red | — | — |
| CI | `npm run ci` | exit 0 | — | — |

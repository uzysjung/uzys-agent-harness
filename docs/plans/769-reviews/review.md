# #769 적대적 리뷰 — 실제 옛 npm 판 실설치 (2026-10-15)

대상: `fix/769-cli-codex-link-body` — 01b1498(구현 5cc81cd + 도커 시나리오). 비교 = origin/main 63955d0(26.173.0, 브랜치 기준점과는 릴리즈 커밋만 다르다).
둘 다 `npm pack` 결과로 설치했다. 환경은 linux-arm64 Docker(`uzys-harness-test:v26.64` 를 읽기 전용 기반으로 쓰고 각 판은 `/opt/ah/<판>` 에 따로 깔았다).
옛 판은 npm 26.125.0 · 26.161.0 · 26.170.0. 장면 15개, 하네스 명령 단계는 빌드마다 61개다. 장면마다 main 과 브랜치를 같은 순서로 쳤고, 단계마다 파일 목록 · sha · 링크 대상 · 링크 해석 여부와 설치 기록을 떴다.

## 판정 — 통과, BLOCKER 0 (HIGH 3 · NOTE 3)

- **#769 의 장면은 고쳐졌다.** 단일 id 링크(ⓐ)에서 `--cli codex` 를 실행하면 main 은 본문을 회수해 Claude 링크가 끊긴다(`[BROKEN]`). 브랜치는 본문을 남겨 링크가 해석되고(`[resolves]`), 미리보기와 실행 화면이 같은 한 줄로 그 사실을 말한다. 회수 개수도 41 → 40 으로 맞게 줄었다.
  - 같은 결과가 ⓓ(opencode 가 마지막으로 나갈 때) · ⓔ1(26.161 → update) · ⓔ2(26.170 → update) · ⓔ3(26.161, update 없이)에서도 나왔다.
- **설치자 파일 손실은 0건이다.** ⓖ에서 링크된 본문의 `SKILL.md` 를 고치고 `my-notes.md` 를 더했다. 브랜치는 둘 다 그대로 두었고, 전량 uninstall 단계에서는 고친 파일을 백업한 뒤 회수했다. 끝 상태는 main 과 같다.
- **전량 uninstall 의 끝 상태는 기록이 있는 모든 장면에서 main 과 같다**(ⓕ · ⓕ2 · ⓔ5 · ⓔ6 · ⓖ). 남겨 둔 본문의 기록이 유지되어 마지막에 회수된다. 남는 Claude 링크는 `your link → …` 줄로 안내된다.
- **codex 를 다시 넣으면(ⓕ 4단계) 그 본문을 백업 없이 이어받는다.** 그 뒤 update 화면은 `linked · updated via` 로 main 과 같다.
- **변경이 실제로 막는지 확인했다.** 브랜치의 단위 테스트를 main 코드에서 돌리면 새 테스트 1건만 실패한다. 브랜치의 도커 시나리오를 main 패키지로 돌리면 ⑦에서 `FAIL: … 본문이 회수됐다` 가 난다.
- 브랜치 `npm run ci` 는 exit 0 이다(파이프 없이 실행했고, branches 커버리지 89.63%). 도커 `scenario-uninstall-cli.sh` 는 레인 전용 이미지 `rev-769-br` 에서 PASS 했다.

## 지적

### HIGH-1 · 남긴 본문을 update 가 갱신하지 않고, 화면은 "기록이 없다"는 틀린 이유를 댄다
- 재현(ⓗ): 26.170 으로 `install --track tooling --cli claude --cli codex` → `.claude/skills/objective-brief` 를 `../../.agents/skills/objective-brief` 로 링크 → 브랜치로 `uninstall --cli codex` → `update` → `update` → `install --track tooling --cli claude`.
- 관찰:
  - update 를 두 번 돌려도 본문은 26.170 판(sha `531c8f0f…`) 그대로다. 현행 판은 `86c5036d…` 다.
  - update 화면은 `⊘ .claude/skills/objective-brief linked · not ours — .agents/skills/objective-brief 는 이 하네스가 쓴 기록이 없어 건드리지 않았다` 라고 말한다.
  - 같은 시점의 설치 기록 `externalFiles` 에는 `.agents/skills/objective-brief/SKILL.md 531c8f0f…` 가 **있다**(`log-3-update.json` · `log-4-update-again.json`).
  - 갱신은 add 경로(`install --cli claude`)에서만 일어난다(5단계에서 `linked · updated via` 와 `86c5036d…`).
- 원인: `src/update-mode.ts:793-799` 는 "이번 실행의 외부 변환이 쓰지 않은 링크"를 전부 `skillsLinkedNotOurs` 로 분류한다. `src/commands/install-render.ts:987` 은 그것을 "기록이 없어" 라고 렌더한다. codex 가 빠져 외부 변환이 없는 Claude 단독 설치본에서는 기록이 있어도 이 줄로 떨어진다. `linked-skill-bodies.ts` 머리말의 전제("update 에서는 깔린 CLI 전부의 변환이 `.agents/skills/<id>` 를 갱신한다")가 이 PR 이 만드는 상태에서는 깨진다.
- main 대비: main 은 같은 장면에서 본문이 회수되어 링크가 끊기므로, 브랜치가 나쁘게 만든 것은 아니다. 다만 이 PR 이 정상 경로로 만드는 상태에서 설치자는 정기 update 로 그 스킬을 영영 갱신받지 못하고, 화면은 그 본문이 하네스 것이 아니라고 말한다. 직전 uninstall 화면이 "still used by Claude Code" 라고 말한 것과도 어긋난다.
- 수정 방향: Claude 가 남고 링크 슬롯이 기록된 `.agents/skills/<id>` 를 가리키면, update 도 add 와 같은 함수(`refreshLinkedSkillBodies`)로 그 본문을 갱신한다. 최소한 "기록은 있으나 이 판을 렌더할 CLI 가 없다"를 "기록 없음"과 구분해 말한다.

### HIGH-2 · 기록 없는 옛 판 본문은 `--cli codex` 가 말없이 남기고, 그 뒤 전량 uninstall 도 회수하지 않는다 — 끝 상태가 main 보다 덜 회수된다
- 재현(ⓔ4): 26.125 로 claude+codex 설치(설치 기록에 `externalFiles` 필드가 없다) → `compaction-handoff` 링크 → 브랜치로 `uninstall --cli codex` → `update` → `uninstall --yes`.
- 관찰:
  - `--cli codex`: main 은 `.agents/` 8개를 회수하면서 링크 본문도 지운다. 브랜치는 7개만 회수하고 본문은 아무 줄 없이 남긴다.
  - update: 그 본문을 `linked · not ours … 기록이 없어` 로 건너뛴다. 이번에는 사실이다. 기록은 끝까지 생기지 않는다.
  - `uninstall --yes`: 브랜치 끝 상태에 26.125 판 하네스 파일 `.agents/skills/compaction-handoff/SKILL.md`(b484a440…)가 남고, Claude 링크는 여전히 그 파일로 해석된다. 화면은 `left .claude/ … skills/compaction-handoff (your link → ../../.agents/skills/compaction-handoff)` 로 링크만 말한다. main 의 끝 상태에는 이 파일이 없다.
- 원인: 옛 판 지문 회수(ⓑ′)의 `.agents/skills/**` 후보는 기록의 CLI 집합에 `.agents` 를 쓰는 CLI 가 있을 때만 든다(v26.170.0 설계 B2). `--cli codex` 뒤에는 `clis=[claude]` 라 전량 uninstall 이 그 자리를 보지 않는다.
- 범위:
  - 기록이 있는 판은 끝에 회수된다. ⓔ5(26.161)와 ⓔ6(26.125 → 현행 update 1회)은 끝 상태가 main 과 같다.
  - 남는 장면은 `externalFiles` 가 없는 ≤ v26.132 claude+codex 설치본이, 현행 판 update 를 한 번도 거치지 않은 채 `--cli codex` 를 실행할 때뿐이다. `npx …@latest uninstall --cli codex` 로 도달할 수 있다.
- 경계 판정: 브리프의 "main 보다 나빠진 회수"에 글자로는 걸린다. 그래도 HIGH 로 둔 이유는 셋이다. 설치자 바이트 손실이 없다. 남는 것은 하네스 옛 판 파일 1개다. 화면이 그 링크 자리를 가리킨다. BLOCKER 로 올릴지는 호출자가 정한다.
- 수정 방향: 브랜치의 `--cli` 판정은 "링크가 가리키는 본문은 Claude 가 쓴다"를 알고 있다. 같은 판정을 전량 uninstall 의 옛 판 회수 범위(ⓑ′)에도 걸어, Claude 가 나갈 때 그 본문이 함께 판정되게 한다. 경우를 덧대기보다 술어 하나를 세 명령에서 쓰는 쪽이 HIGH-1 과도 같은 뿌리를 닫는다.

### HIGH-3 · (main 과 같음, 이 PR 의 퇴행 아님) `.claude/skills` 를 폴더째 링크한 배치는 보호되지 않고, 그 뒤 update 가 죽는다
- 재현(ⓑ · ⓑ2): 현행으로 claude+codex 설치 → `rm -rf .claude/skills && ln -s ../.agents/skills .claude/skills` → `uninstall --cli codex` → `update`.
- 관찰:
  - main 과 브랜치 모두 `.agents/` 41개를 회수한다. `.agents/` 가 비어 걷히고 `.claude/skills` 링크가 `[BROKEN]` 이 된다. Claude 의 하네스 스킬 14개가 전부 사라지고, 화면은 이에 대해 아무 말도 하지 않는다.
  - 이어 update 를 돌리면 두 판 모두 `✗ update failed — ENOENT: no such file or directory, mkdir '/w/p/.claude/skills/audit-harness-fit'`(rc=1)로 끝난다.
- 판단: `linksToProjectSharedSkill` 은 `<id>` 단위 링크만 본다. #769 본문도 `<id>` 단위라 이 PR 의 완료 기준 밖이다. 그런데 #524 원문("`.agents/skill` 폴더에 스킬을 두고 `.claude/skill` 에는 링크")과 `docs/plans/issue-cleanup-2026-09-27-todo.md:11`("`.claude/skills` 를 링크로 둔 사람")은 이 폴더 단위 모양으로도 읽힌다. 실제 보고자 배치가 이쪽이면 #769 의 증상은 그대로 남는다. 별도 이슈로 올리기를 권한다.

### NOTE
- **N1 · 다른 id 를 가리키는 링크(ⓒ)는 보호하지 않는다. 구현자 판단에 동의한다.** install · update 도 같은 술어로 그 모양을 "남의 자리"(#343)로 본다. 세 명령이 같은 판정을 쓰는 편이 낫다. 브랜치와 main 은 디스크 · 화면이 같다(링크가 끊기고 아무 말도 없다).
- **N2 · 기록 없는 옛 판 본문을 남길 때 화면이 침묵한다(ⓔ3 · ⓔ4 — 회수 개수만 1 줄어든다).** 하지 않은 일을 말하지는 않으므로 이 단계에서는 허용한다. 다만 HIGH-2 의 끝 잔존과 겹치면 설치자는 그 파일이 남았다는 것을 어디서도 직접 듣지 못한다.
- **N3 · 대화형 uninstall 의 CLI 확인 화면이 `.agents/skills/<harness skills>` 가 나간다고 말한다.** `src/uninstall-interactive.ts:195` `removalSummary` 는 projectDir 를 받지 않아 링크를 모른다. 확인 뒤 엔진 화면은 `⊘ left …` 로 바로잡는다. 틀리는 방향이 안전한 쪽(말한 것보다 덜 지움)이라 NOTE 로 둔다. 이미 같은 화면에 `keptLinkLines` 라는 "남는 것" 줄 선례가 있다. TTY 가 필요해 실행하지 않았고 코드로만 확인했다.

## 장면 매트릭스 (디스크 = main 대비 · 화면 = 브랜치)

| 장면 | 단계 | 디스크 (main → 브랜치) | 화면 (브랜치) |
|---|---|---|---|
| ⓐ 현행 claude+codex · 단일 id 링크 | `--cli codex` dry-run · 실행 | 본문 회수·링크 BROKEN → 본문 유지·링크 resolves | 미리보기 `○ leave …` · 실행 `⊘ left … still used by Claude Code` · 회수 41→40 |
| ⓑ 폴더째 링크 | `--cli codex` | 같음(41개 회수 · `.claude/skills` BROKEN) | main 과 같음(침묵) — HIGH-3 |
| ⓑ2 폴더째 링크 → update | update | 같음 · 두 판 모두 ENOENT rc=1 | main 과 같음 — HIGH-3 |
| ⓒ 다른 id 링크 | `--cli codex` | 같음(링크 BROKEN) | main 과 같음 — N1 |
| ⓓ claude+codex+opencode | `--cli codex` · `--cli opencode` | codex: 같음 / opencode: 본문 회수 → 유지 | opencode 단계에서 `left` 한 줄 · 40 |
| ⓔ1 26.161 → update → 링크 | `--cli codex` | 회수 → 유지 | `left` 한 줄 |
| ⓔ2 26.170 → update → 링크 | `--cli codex` | 회수 → 유지 | `left` 한 줄 |
| ⓔ3 26.161 → 링크(update 없음) | `--cli codex` | 회수 → 유지 | `left` 한 줄(기록 있음) |
| ⓔ4 26.125 → 링크(update 없음) | `--cli codex` · update · `uninstall --yes` | 회수 → 유지 · **전량 뒤에도 유지(main 은 없음)** | 침묵(8→7) · update `not ours` — HIGH-2 · N2 |
| ⓔ5 26.161 → 링크 | `--cli codex` · `uninstall --yes` | 유지 → 끝 상태 같음 | `left` · 전량은 main 과 같음 |
| ⓔ6 26.125 → update → 링크 | `--cli codex` · `uninstall --yes` | 유지 → 끝 상태 같음 | `left` · 전량은 main 과 같음 |
| ⓕ ⓐ → update → `install --cli codex` → update → `uninstall --yes` | 전 단계 | update 까지 유지 · 재추가 뒤 같음 · 끝 상태 같음 | update `not ours … 기록이 없어` — HIGH-1 · 재추가 뒤 `linked · updated via` |
| ⓕ2 ⓐ → `uninstall --yes` | 전량 | 끝 상태 같음(본문 회수 · 링크 남고 안내) | `.agents/ 1` 회수 · `your link →` |
| ⓖ 링크 본문 안 설치자 편집 · 추가 | `--cli codex` · update · `uninstall --yes` | 편집본: main 은 백업 뒤 회수 → 브랜치는 그대로 둠 · 끝 상태 같음 | `left` · 전량에서 `you edited it — saved as …` · 손실 0 |
| ⓗ 26.170 → objective-brief 링크 | `--cli codex` · update×2 · `install --cli claude` | 유지(26.170 판 고정) → add 에서만 갱신 | `not ours … 기록이 없어` — HIGH-1 |

## 구현자 질문에 대한 판정

- 갈린다고 본 곳
  - 다른 id 링크 비보호 → **동의**(N1).
  - 기록 없는 옛 판 사본은 남기고 침묵 → **남기는 것은 동의, 침묵은 이 단계에선 허용**(N2). 다만 그 사본은 끝내 회수되지 않는다(HIGH-2).
- 미심쩍다고 본 곳
  - update 가 남긴 본문을 갱신하지 않음 → **사실**이다. 화면이 "기록이 없다"고 틀리게 말하는 문제까지 겹친다(HIGH-1).
  - 메뉴형 힌트 → **사실**, 위험은 낮다(N3).
  - 전량 uninstall 이 본문을 회수함 → **사실이고 옳다.** Claude 도 나가므로 원칙대로이고, 끝 상태가 main 과 같다(ⓕ · ⓕ2 · ⓔ5 · ⓔ6 · ⓖ). 예외는 기록 없는 옛 판(HIGH-2).

## 실행 확인

- 브랜치 `npm run ci` 는 exit 0 이다. typecheck · lint · test:coverage(Statements 95.47 · Branches 89.63 · Functions 95.83 · Lines 96.78) · build 를 거쳤다(`evidence/ci-branch-tail.log`).
- 도커는 `docker build -t rev-769-br -f test/docker/Dockerfile .` 로 이미지를 만들고 `scenario-uninstall-cli.sh` 를 돌렸다. PASS, exit 0(`evidence/docker-scenario-br.log`).
- 음성 대조 두 가지:
  - 같은 이미지에 main 26.173.0 패키지를 전역으로 덮어 깔고 같은 시나리오를 돌렸다. exit 1, ⑦ 에서 FAIL(`evidence/docker-scenario-main-control.log`).
  - 브랜치의 `tests/uninstall-cli-scope.test.ts` 를 main 소스 사본에서 돌렸다. 1 failed / 18 passed 이고, 실패는 #769 테스트뿐이다(`evidence/unit-negative-control-main.log`).

## 한계

- 대화형(TTY) uninstall 확인 화면은 실행하지 않고 코드로만 판정했다(N3).
- 실 CLI(Claude Code · Codex)가 링크된 본문을 실제로 스킬로 읽는지는 보지 않았다. 링크 해석 여부(`[ -e ]`)와 `SKILL.md` 존재로 대신했다.
- antigravity 조합과 사용자 범위(`--scope global`)는 다루지 않았다. 소유 표상 antigravity 는 `.agents/skills/` 를 공유하므로 ⓓ 와 같은 경로로 읽힌다.
- 비교 대상 main 은 26.173.0, 브랜치 패키지는 26.172.0 으로 찍힌다. 둘의 차이는 릴리즈 커밋(CHANGELOG · 버전)뿐이다.

## 증거

- `evidence/cmp/<장면>.txt`: 단계별 main · 브랜치 화면과 스냅샷 diff(백업 시각 정규화, 설치 기록 sha 줄 제외).
- `evidence/raw-screens-snapshots-logs.tgz`: 장면별 원본 화면 · 스냅샷 · 설치 기록 사본 전부.
- `evidence/scripts/`: 실행 스크립트. `host-scene.sh <장면> <main|br>` 이 레인 전용 컨테이너로 장면 하나를 돈다. `sc-*.sh` 가 장면 정의다.

## 2차 (a382856)

대상은 a382856(HIGH-1 · HIGH-2 수정)이다. 비교 대상은 main 63955d0(26.173.0)과 1차 브랜치 01b1498 이고, 셋 다 `npm pack` 결과로 설치했다. 옛 판은 npm 26.125.0 · 26.161.0 · 26.170.0 을 썼다. 범위는 수정이 영향을 주는 곳으로 한정했다(1차 HIGH-1 · HIGH-2 장면, 새 쓰기 경로, 1차 장면의 회귀). 장면 16개, 하네스 명령 단계 67개(수정 브랜치 기준)다.

### 판정 — 통과, BLOCKER 0 (NOTE 2)

- **HIGH-1 해소(ⓗ).** 26.170 판에서 `--cli codex` 를 한 뒤 첫 update 가 남긴 본문을 현행 판으로 갱신한다(`531c8f0f…` → `86c5036d…`). 화면은 `linked · updated via .agents/skills/objective-brief` 로 말한다. 설치 기록 `externalFiles` 의 sha 도 디스크와 같은 `86c5036d…` 로 바뀐다. 두 번째 update 는 쓰지 않고 백업도 0개다. 화면 문구는 Codex 가 깔린 설치본의 update 와 같다(아래 ⓚ).
- **HIGH-2 해소(ⓔ4).** 26.125 판을 update 없이 `--cli codex` → update → 전량 uninstall 순으로 돌리면 끝 상태가 main 과 **IDENTICAL** 이다. 전량 uninstall 화면은 `· .agents/ 1` 로 회수한 사실을 말한다.
- **ⓕ.** 끝 상태와 전량 미리보기 · 실행 화면이 main 과 같다. `--cli codex` 뒤 update 는 `linked · updated via` 를 내고 백업은 0개다(1차 때의 "기록이 없어" 줄이 사라졌다). codex 를 다시 넣은 뒤 update 하면 기록까지 main 과 같다.
- **새 쓰기 경로에서 손실 0.**
  - ⓘ: 남긴 본문의 `SKILL.md` 와 `references/apply.md` 를 고쳤다. update 는 각 파일을 `you edited it — saved as …` 로 백업한 뒤 갱신하고, 화면 요약은 `BACKUPS 2 file(s)` 다. 번들 밖 설치자 파일(`my-notes.md` · `references/my-ref.md`)은 update 두 번과 전량 uninstall 을 거쳐도 남는다. 설치자가 지운 번들 파일(`evals/scenarios.yaml`)은 다시 깔린다. 전량 uninstall 뒤에는 설치자 내용(MINE)이 백업 2개와 추가 파일 2개로 모두 남는다.
  - ⓙ · ⓙ2: 기록 없는 설치자 스킬이 하네스 id 와 같은 이름일 때, 처음부터 Claude 단독이든 codex 를 뺀 뒤 새로 만들었든 update 는 건드리지 않는다(`linked · not ours …` — 이 경우엔 사실). 전량 uninstall 도 그 파일을 남긴다. 디스크는 main 과 IDENTICAL 이다.
  - ⓝ: 남긴 본문의 `SKILL.md` 를 프로젝트 안 설치자 파일로의 파일 링크로 바꿨다. update 는 링크를 따라가 쓰지 않으므로 `my-ob.md` 는 그대로다.
- **회귀 없음.**
  - 1차 장면 ⓐ · ⓓ · ⓔ1 · ⓔ2 · ⓔ3 은 1차 브랜치와 스냅샷 · 화면이 전부 같다.
  - ⓖ 는 의도한 변화만 있다. 5단계 update 가 고친 `SKILL.md` 를 이제 백업한 뒤 갱신한다. 6단계 전량 uninstall 의 끝 디스크는 1차와 IDENTICAL 이다. 백업이 한 단계 앞에서 생겼을 뿐 설치자 내용은 같은 자리에 남는다.
  - Codex 가 깔린 일반 update(ⓚ 링크+편집, ⓚ2 링크 없음)는 main 과 디스크 · 설치 기록 · 화면이 모두 같다. 이중 백업도 없다(백업 1개로 같다).
- 브랜치 `npm run ci` 는 exit 0 이다(2455 테스트, Branches 89.66). 레인 전용 이미지 `rev-769-br2` 에서 `scenario-uninstall-cli` 가 PASS 했고, 이미지는 끝난 뒤 지웠다.
- **음성 대조:** 수정 커밋이 더한 테스트 3파일을 1차 코드(01b1498) 위에 놓고 돌렸다. typecheck 는 exit 0 이고 vitest 는 3 failed / 42 passed 다. 실패 3건은 새 단언(①c update 갱신 · 옛 사본 회수 · 링크 본문의 일생)뿐이다.

### NOTE (2차)
- **N4 · 회수 범위가 Claude 단독 설치본의 "옮겨 둔 사본"까지 넓어졌다(ⓜ).**
  - 재현: 26.161 로 claude 단독 설치 → 설치자가 `.claude/skills/{objective-brief,north-star}` 를 `.agents/skills/` 로 옮기고 링크(#524 한 벌 운용을 codex 없이) → north-star 의 `SKILL.md` 만 고침 → 현행 update → 전량 uninstall.
  - 관찰: main 은 옮긴 사본을 전부 남긴다. 브랜치는 고치지 않은 옛 판 바이트 3개(`objective-brief/SKILL.md`, north-star 의 템플릿 · references)를 `.agents/ 3` 으로 백업 없이 회수한다. 고친 `SKILL.md` 는 남긴다. 미리보기(`○ remove 3 harness file(s) under .agents/`)와 실행 화면은 실제와 같다.
  - 판정: 지문이 하네스 바이트와 일치할 때만 회수하고 설치자 편집본은 남는다. 그래서 "기록 없는 옛 판 바이트는 치운다"는 원칙과 ⓔ4 의 의도에 맞는다. 다만 main 보다 **더 많이** 지우는 방향의 변화이고, 고치지 않은 형제 파일이 빠지면서 설치자 스킬 폴더가 부분적으로 남는다(SKILL.md 만 있고 references 는 없음). 백업 생략은 기존 옛 판 회수(main 의 `--cli codex` 도 같음)의 규칙을 그대로 따른 것이다.
- **N5 · 기록이 있는데도 "기록이 없어"라는 줄이 한 구석에 남는다(ⓝ).** 남긴 본문의 `SKILL.md` 가 파일 링크면 `linked · not ours — … 이 하네스가 쓴 기록이 없어` 줄이 나온다. 같은 실행의 다음 줄 `owned by another tool …/SKILL.md · 그 자리가 우리 것이 아니라` 가 실제 이유를 말하고, 디스크 동작은 옳다(덮지 않음). 손실은 없다. 1차 HIGH-1 의 문구 원인(`update-mode.ts` 의 "갱신 안 됨 = not ours" 분류)이 갱신을 건너뛴 경우에 한해 남아 있는 것이다.
- 1차 HIGH-3 · N1 · N3 은 이번 수정 범위 밖이라 그대로다. N2 의 "`--cli codex` 단계에서의 침묵"(ⓔ4 회수 개수 8→7)도 그대로이지만, 끝에 회수되므로 잔존은 없다.

### 장면 표 (2차 · 디스크 = main 대비, 회귀 = 1차 브랜치 대비)

| 장면 | 단계 | 디스크 | 화면 (수정 브랜치) |
|---|---|---|---|
| ⓗ 26.170 → objective-brief 링크 | `--cli codex` · update×2 · add | 본문 유지 → 첫 update 에서 현행 판, 기록 sha 일치 (main: BROKEN) | `left` → `linked · updated via` ×2 · 백업 0 |
| ⓔ4 26.125(update 없음) | `--cli codex` · update · 전량 | 중간 단계는 유지, **끝 상태 main 과 IDENTICAL** | 전량 `· .agents/ 1` |
| ⓕ ⓐ → update → codex 재추가 → update → 전량 | 전 단계 | update 까지 유지 · 이후 main 과 같음 · 끝 IDENTICAL | `linked · updated via` · 백업 0 |
| ⓘ 26.170 → 링크 2개 → `--cli codex` → 편집 · 추가 · 삭제 | update×2 · 전량 | 편집 2개 백업 · 추가 2개 보존 · 삭제분 복구 · 끝에 MINE 4개 생존 (main: 링크가 끊겨 편집 자체가 불가) | `you edited it — saved as …` ×2 · `BACKUPS 2` |
| ⓙ Claude 단독 + 같은 이름의 설치자 스킬 | update · 전량 | main 과 IDENTICAL · 설치자 파일 보존 | `not ours`(사실) |
| ⓙ2 `--cli codex` 뒤 설치자 스킬 새로 + 링크 | update · 전량 | main 과 IDENTICAL | `not ours`(사실) |
| ⓚ codex 설치 상태 · 링크 + 편집 | update×2 | main 과 디스크 · 기록 IDENTICAL · 백업 1 | main 과 같음 |
| ⓚ2 codex 설치 상태 · 링크 없음 | update×2 | main 과 디스크 · 기록 · 화면 IDENTICAL | main 과 같음 |
| ⓜ Claude 단독 26.161 · 옮겨 둔 사본 + 링크 | update · 전량 | 고치지 않은 옛 바이트 3개 회수 (main: 남김) · 편집본 보존 | 미리보기 · 실행이 실제와 같음 — N4 |
| ⓝ 남긴 본문의 SKILL.md 가 설치자 파일 링크 | update | 설치자 파일 무변경 | `not ours … 기록이 없어`(틀림) + `owned by another tool`(맞음) — N5 |
| ⓐ · ⓓ · ⓔ1 · ⓔ2 · ⓔ3 | 1차와 같음 | 1차 브랜치와 스냅샷 · 화면 전부 같음 | 같음 |
| ⓖ | 1차와 같음 | 끝 상태 1차와 같음 · update 단계에서 편집 백업이 앞당겨짐(의도) | `you edited it — saved as …` |

### 한계 (2차)
- 대화형 TTY 화면, antigravity · opencode 단독이 남는 조합, global scope 는 보지 않았다.
- 도커 시나리오는 `scenario-uninstall-cli` 하나만 돌렸다. update 경로를 쓰는 다른 시나리오(`update-skills` 등)는 돌리지 않았다. 그 경로는 ⓚ · ⓚ2 의 main 대조로 대신했다.
- main 의 ⓐ ~ ⓖ 결과는 1차 실행분을 다시 썼다. main 패키지가 같으므로 재실행하지 않았다.

### 증거 (2차)
- `evidence/r2/cmp/<장면>.txt`: main ↔ 수정 브랜치의 단계별 화면과 스냅샷 diff.
- `evidence/r2/regress/`: 1차 브랜치 ↔ 수정 브랜치(`summary.txt` 에 장면별 일치 수).
- `evidence/r2/neg-r1-*.log`: 1차 코드 위 음성 대조.
- `evidence/r2/docker-scenario-br2.log` · `ci-r2-summary.log`.
- `evidence/r2/raw-r2.tgz`: 원본 화면 · 스냅샷 · 기록 사본.
- `evidence/r2/scripts/`: `host-all2.sh` · `cmp2.sh` · `regress.sh` · `neg-r1.sh` · `sc-{h,i,j,j2,k,k2,m,n}.sh` 등.

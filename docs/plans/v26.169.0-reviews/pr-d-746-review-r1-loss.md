# rev-D2 — 적대적 손실 탐색 판정 (fix/uninstall-no-folder-move)

- 대상: 통합 13b6887 (구현 57c01f8) · 기준 main@ac4de4c
- 방법: ① in-process 탐침 27건(vitest, `uninstallAction`·`runInstall` 직접 호출, 임시 폴더) — 같은 탐침을 `src/` 만 ac4de4c 로 바꿔 대조
  ② 컨테이너 실설치(`uzys-harness-test:rev-d2`, 새 빌드·main 빌드 각각) — npm 게시본 v26.125.0 · 26.126.0 · 26.132.0 · 26.140.0 · 26.150.0 · 26.153.0 · 26.161.0 으로 실제 설치 → 설치자 파일·편집 → 새 빌드로 uninstall
- 사본 원상 복구 확인(detached 13b6887, `git status` 깨끗) · node_modules 심링크 · 이미지 삭제 완료

## 결론: BLOCKER 1건

---

## BLOCKER-1 — 옛 판(v26.126.0–v26.153.x) 설치본에서 하네스 스킬 폴더 안의 설치자 파일이 백업 없이 사라진다

**무엇이 일어나나.** 설치자가 하네스 번들 스킬 폴더 안에 자기 파일을 두었고(예: `.claude/skills/audit-harness-fit/my-team-notes.md` —
팀 메모·참고 자료를 스킬 옆에 붙이는 흔한 사용), 그 뒤 옛 판으로 install 을 한 번 더 돌렸거나 update 를 했다면, 새 판 `uninstall` 이
그 파일을 **라이브에서 지우고 어디에도 사본을 남기지 않는다.** 화면에는 "removed .claude/ N harness file(s)" 에 섞여 한 줄도 따로 나오지 않는다.

**원인(코드).** v26.126.0–v26.153.x 의 `collectSkillHashes` 는 `.claude/skills/` 아래 **모든 파일**을 기록했다(템플릿 존재 필터는 #477 · v26.154.0 부터).
`recorded()` 의 옛 스캔 필터(Q1)는 "경로가 하네스 대상인가" 를 manifest 로 보는데, 번들 스킬은 `type: "dir"` 이라 **그 폴더 아래 아무 파일이나**
대상으로 판정된다(`recordedTrackTargets` → `path.startsWith(\`${e.target}/\`)`). 그래서 설치자 파일이 `{ state: "sha" }` 가 되고, 스캔 뒤
안 고쳤으면 `judge` 가 `remove`(백업 없음)를 낸다. `removeRecordedFile` 이 그대로 실행한다.

**재현(실설치, 컨테이너).**
```
cd ~/p && git init -q
npx -y @uzysjung/agent-harness@26.150.0 install --track tooling --cli claude --project-dir .
mkdir -p .claude/skills/audit-harness-fit && printf '# notes\n' > .claude/skills/audit-harness-fit/my-team-notes.md
npx -y @uzysjung/agent-harness@26.150.0 install --track tooling --cli claude --project-dir .   # 옛 판 재실행 = 재스캔
jq '[.skillFiles[].path] | index("audit-harness-fit/my-team-notes.md")' .uzys-agent-harness/.harness-install.json  # → 2 (기록됨)
agent-harness uninstall --yes --project-dir .      # 새 빌드(13b6887)
find . -name '*my-team-notes*'                      # → 아무것도 없음
```
- 새 빌드: v26.126.0 · v26.150.0 · v26.153.0 세 판 모두 **파일 소실**(백업 0, 폴더 백업 0). v26.126.0 은 기록이 `.claude/.harness-install.json` 에 있다.
- 같은 흐름에서 옛 판 `update` 로 재스캔한 경우는 옛 update 가 우연히 남긴 `.claude.backup-<t>/` 안에만 사본이 있다(라이브·새 백업 없음 — 그 폴더를 치운 설치자는 잃는다).
- in-process 탐침 A(기록에 `records` 없음 + skillFiles 에 설치자 파일 sha)로도 같은 결과.

**main@ac4de4c 대조.** 같은 실설치 흐름(v26.150.0 재설치) → main 빌드 uninstall → `.claude.backup-<t>/skills/audit-harness-fit/my-team-notes.md` 로 **보존됨**.
in-process 탐침 A 도 main 에서 PASS. → 이 PR 이 만든 손실이다.

**완료 기준.**
1. `records: "writer"` 가 없는 기록의 `skillFiles` 항목 중 **하네스 번들 템플릿에 없는 파일**(옛 전체 스캔이 적은 설치자 파일)은 어떤 uninstall 경로
   (전량 · `--cli claude`)에서도 백업 없이 라이브에서 사라지지 않는다 — 제자리에 남거나, 지우면 그 파일 하나의 `*.backup-<time>` 이 남는다.
2. 회귀 테스트: 옛 형식 기록(records 없음, 번들 스킬 폴더 안 설치자 파일이 sha 로 기록, 디스크 = 기록 sha)으로 전량 uninstall 과 `--cli claude` 둘 다
   위 1 을 단언한다. 고치기 전 코드에서 빨간불인지(음성 대조) 확인한다.
3. 컨테이너에서 v26.150.0 재설치 흐름(위 재현)이 새 빌드로 파일을 남기거나 백업한다.

**같은 원인의 PR 밖 결함(참고 — main 에도 있다, 이 PR 판정에는 넣지 않음).** 새 `update`(main@ac4de4c 빌드로도 실측)가 같은 기록에서
`.claude/skills not in bundle — 2 files deleted · audit-harness-fit/my-team-notes.md` 로 **백업 없이** 지운다. `recorded()` 술어를 공유하므로
BLOCKER-1 을 술어 쪽에서 고치면 함께 닫힐 수 있다 — 별도 이슈로 올릴 것을 권한다.

---

## NOTE (손실 아님 — 누수 · 거짓 화면 · 실패 처리)

**N1. 옛 판 설치본은 uninstall 뒤에도 하네스가 라이브로 남고, 화면은 그것을 "당신 파일" 이라 부른다** (중요도 높음 — 기능 회귀)
- v26.125.0 실설치 → 새 uninstall: `removed .claude/ 1 harness file(s)` 뿐, 룰 10 · 에이전트 8 · 훅 5 · 스킬 30여 · `.claude/CLAUDE.md` 가 그대로 남고
  `⊘ left .claude/ — 76 file(s) of yours: .harness-install.json · CLAUDE.md · agents/build-error-resolver.md +73 more` → `✓ uninstall complete`.
  settings.json 의 하네스 훅도 "may still hold" 안내만 하고 남는다 → **다음 Claude Code 세션이 하네스 룰·훅을 계속 로드·실행한다.**
  `.harness-install.json` 을 "yours" 로 나열한 뒤 같은 실행에서 지운다(거짓 줄).
- v26.132.0: 은퇴한 하네스 스킬·커맨드(`commands/ecc/*`, `skills/continuous-learning-v2/*` 등)·에이전트 약 40개가 같은 식으로 남고 "yours" 로 나온다.
- main: `.claude/` 를 통째로 옮겨 라이브에서는 전부 빠졌다.
- 원인: `harnessCandidates` 가 기록 필드만 열거한다. 주석(A8 "어느 필드에도 적힌 적 없는 옛 판의 하네스 파일 — isTarget 이 알려 준다")과 `recorded()` 의
  로그 수준 `no-sha` 경로는 옛 기록의 manifest 대상을 다루도록 설계돼 있는데, 후보로 들어오는 것은 `.installed-tracks` 하나뿐이다.

**N2. 프로젝트 안을 가리키는 링크 너머의 설치자 파일이 바뀐다** (main 은 손대지 않았다 · 설계 #10 의 의도된 결과일 수 있음 — 설계 레인 판단 필요)
- E: 설치 **전**에 `.claude/agents/reviewer.md → docs/my-reviewer.md` 링크 → uninstall 뒤 `docs/my-reviewer.md` 삭제 · 링크 삭제 · 원본 내용은
  `.claude/agents/reviewer.md` 일반 파일로 복원(내용은 보존, 설치자 배치는 깨짐).
- E2: 설치 **후** 하네스 판과 같은 내용의 `docs/agents/reviewer.md` 로 링크 → `docs/agents/reviewer.md` **백업 없이 삭제**(내용이 하네스 판과 같아 재설치로 복구 가능).
- E3: 다른 내용이면 `docs/agents/reviewer.md` 가 라이브에서 빠지고 `docs/agents/reviewer.md.backup-<t>` 로 남으며 "you edited it" 라고 말한다.
- 기록에 없는 `docs/` 파일을 건드린다는 점에서 "설치자 파일은 건드리지 않는다" 와 어긋난다.

**N3. 백업 경로 표시가 깨진다.** 프로젝트 경로에 링크가 끼어 있고(macOS `/var` → `/private/var`, `~/dev` → `/Volumes/…`) 대상이 프로젝트 안 링크일 때
`saved as ../../../../../../private/var/…/docs/agents/reviewer.md.backup-<t>` 로 나온다(`relative(projectDir, realpath)` — projectDir 은 realpath 가 아님).

**N4. `--cli` 경로에는 사전 쓰기 점검도 중단 보고도 없다.** `.claude/agents` 를 읽기 전용(0555)으로 두고 `--cli claude`(claude+codex) → 일부 하네스 파일과
`.claude/settings.json` 을 이미 지운 뒤 **잡히지 않은 EACCES 예외**로 끝난다(exit 코드·"Already done" 없음, 기록은 claude 를 그대로 깔린 것으로 둠).
권한을 돌리고 다시 돌리면 끝까지 간다 · 설치자 파일 손실 없음. 전량 경로는 `unwritablePaths` 가 막는다(I2 — 아무것도 안 바뀜 확인). main 은 폴더 이동이라 이 실패가 없었다.

**N5. 되돌린 뒤 기록 삭제 단계에서 멈추면, 재실행이 되돌린 설치자 원본을 다시 치운다.** `settleLog` 의 rm 은 try 밖이고 사전 점검은 `.uzys-agent-harness/`
쓰기 권한을 보지 않는다. 그 단계에서 실패시키면(탐침 U — 주입) 잡히지 않은 예외로 끝나고, 1초 이상 뒤 재실행하면 복원된 원본을
`you edited it — saved as reviewer.md.backup-<t2>, removed from live` 로 옮긴 뒤 `could not put back your earlier file — its backup is no longer there` 라고 말한다.
내용은 백업에 있다(손실 아님) · 라이브 자리는 비고 화면은 사실과 다르다.

**N6. 빈 뼈대 걷기가 설치 전부터 있던 설치자의 빈 `docs/` 를 지운다**(main 은 `docs/decisions` 만 지웠다). 빈 폴더라 내용 손실은 없다.

**N7(회귀 아님, 기록용).** `--cli codex`/`--cli opencode` 의 AGENTS.md 재렌더가 템플릿과 같은 제목(`## Project Context`)을 하나 더 단 설치자 절을 라이브에서
빼고 백업한다 — 재렌더 코드는 main 과 같다. 옛 판(≤v26.161) install 이 설치자 AGENTS.md 를 이미 `AGENTS.md.backup-<t>` 로 바꿔 둔 것도 그 판의 동작이다.

---

## 시도한 공격과 결과

| # | 공격 | 새 판 결과 | main |
|---|---|---|---|
| A | v26.126–153 옛 스캔 skillFiles 에 번들 스킬 폴더 안 설치자 파일(실설치 126·150·153 + 탐침) | **소실, 백업 없음 → BLOCKER-1** | 폴더 백업에 보존 |
| A2 | 옛 스캔 skillFiles 의 설치자 자체 스킬(`skills/mine/`) | 보존 | — |
| A3 | 옛 판 → 새 update → 새 uninstall | update 단계에서 이미 소실(PR 밖, main 동일) | 동일 |
| C | 세 CLI 폴더 깊숙한 설치자 파일 15종(agents·skills·hooks·rules·settings.local.json·commands·commands/uzys·번들 스킬 안 추가 파일·.codex/*·.opencode/*·.agents/skills/mine·docs/decisions/ADR) | 전부 바이트 그대로 | 폴더 백업으로 이동 |
| D | 하네스 파일을 지우고 같은 이름으로 새로 만든 설치자 파일 | 그 파일 하나 백업 | — |
| E·E2·E3 | 프로젝트 안 링크(설치 전/후, 같은/다른 내용) | 내용 보존, 링크 너머 `docs/` 파일 변경 → N2 · N3 | `docs/` 그대로 |
| F | `.claude/agents` → 프로젝트 밖 폴더 | 밖 폴더 그대로 | 동일 |
| G | `.claude` → 프로젝트 안 `config/claude` | 설치자 파일 보존 | — |
| H | displaced 에이전트 + 하네스 판도 편집 | 원본 복원 + 편집본 백업 | — |
| H2 | 설치자 자체 스킬이 번들 id 와 같고 추가 파일 있음 | SKILL.md 원본 복원, extra.md 제자리 | — |
| R | displaced 자리를 설치자가 다시 채움 | 채운 것 백업 + 원본 복원(둘 다 보존) | — |
| W | displaced 백업을 설치자가 지움 | "could not put back" 안내, 다른 손실 없음 | — |
| I | `--cli claude` + 읽기 전용 하위 폴더 | 예외로 중단, 손실 없음, 재실행 완료 → N4 | 이동이라 실패 없음 |
| I2 | 전량 + 읽기 전용 하위 폴더 | 사전 점검이 막음, 디스크 변화 0 | — |
| U | 복원 후 기록 삭제 단계 실패 → 재실행 | 내용 보존, 라이브에서 빠지고 거짓 줄 → N5 | — |
| U2 | 하네스 파일 삭제 도중 실패 → 재실행 | 중단 보고 + 재실행 완료, 손실 없음 | — |
| V | 조작된 기록 경로 `../victim.txt`(externalFiles · policyFiles) | 프로젝트 밖으로 판정, 안 건드림 | — |
| X | 옛 policyFiles 에 다른 트랙 룰 이름의 설치자 룰 | 보존 | — |
| Y | 옛 skillFiles 기록 뒤 설치자가 고친 파일 | 백업 | — |
| J | `--cli codex`(claude+codex) | `.claude/` 전 파일 바이트 그대로, `.codex/mine.toml` 보존 | — |
| K | `--cli claude`(claude+codex) | `.codex/` · `.agents/` 바이트 그대로 | — |
| S | `--cli claude` 뒤 전량 | 설치자 파일 보존 | — |
| T | 옛 기록 위치 `.claude/.harness-install.json` | 설치자 파일 보존, 기록 파일 삭제 | — |
| M | 설치 전부터 있던 빈 `docs/` · `.claude/commands/` | 빈 폴더가 지워짐 → N6 | `docs/` 남김 |
| Q | 설치 전부터 있던 AGENTS.md · settings.json 훅·키 · .mcp.json 서버 · codex config 서버 · .gitignore 줄 | 설치자 몫 전부 보존 | — |
| 실설치 | v26.125.0 · 26.132.0 · 26.161.0 (claude+codex+opencode) 전량 + 설치자 파일 12종·룰 편집·settings 키·codex 서버·opencode 키 | 설치자 파일·편집·키 전부 보존 / 하네스 대량 잔존 → N1 | 이동 |
| 실설치 | v26.161.0 `--cli claude` · `--cli codex`, v26.140.0 `--cli claude` · `--cli opencode` | 설치자 파일 보존(AGENTS 재렌더는 N7) | — |
| `--only` | `removeToolFiles` · `planReverse` 를 main 과 함수 단위 대조 | 동일(주석만 다름) | — |

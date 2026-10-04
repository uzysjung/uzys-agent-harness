# 설치 기록이 없는 프로젝트 — list · update · uninstall · install 이 하는 일 (#595 · #658 설계, 2026-10-04)

- 범위: `.uzys-agent-harness/.harness-install.json`(옛 자리 `.claude/.harness-install.json` 포함)이 **없는** 프로젝트. 기록이 있을 때의 동작은 ADR-097 · ADR-099 · `selection-record-design-2026-10-04.md` 가 정하고 여기서 다루지 않는다.
- 결정 필요: **없음.** 사람 C 와 D 는 기록의 유무로 가른다 — §2 가 기록을 클론에 실어 보내므로 "기록 없음" 은 D 아니면 §4 의 과도기/옛 판뿐이다. §2 의 선택은 ADR 로 올려 PR 리뷰에서 확정한다(ADR-100 안).
- 검증: `.handoff/bounty-reviews/verify-no-record-design.md`(design-verifier, BLOCK 2 → 이 판에서 반영: B1 이관 동사 · B2 기록 직렬화 정규화, NOTE N1–N5 문장 반영).
- 의존: NR-2 의 update 이관은 ADR-099 의 **PR B**(update 가 `.gitignore` 등 함께 쓰는 파일 몫을 쓴다 — `explicit-exclusion-design-2026-10-04.md` §2 R2)가 머지된 뒤에만 성립한다. NR-2 는 그 뒤에 들어간다.
- 코드는 고치지 않았다. 아래 "실측" 은 소스 · git 이력 · npm 메타데이터를 읽은 것이고, 실행 관측은 이슈 본문(#595 · #658, 26.162.1 컨테이너)이다.

## 0. 설치자에게 달라지는 것

| 사람 | 지금 (26.163.0) | 이 설계 뒤 |
|---|---|---|
| **C** 동료가 깐 저장소를 클론 | `list`·`uninstall` "없다"(exit 1), `update` 는 설치로 오판해 **`.claude.backup-*` 폴더 + 앵커 + import 를 만들고 exit 0**(#595 · #658). 룰이 가리키는 `.uzys-agent-harness/*.sh` 는 클론에 없다 | **할 일 없음.** 기록과 보조 스크립트가 커밋돼 함께 온다 — `list`·`update`·`uninstall` 이 동료 기계와 같은 답을 낸다. 동료가 고친 하네스 파일은 동료 기계에서와 같은 규칙(기록 sha 와 다르면 `update` 가 그 파일 하나를 백업하고 알린다)이고, 조용히 바뀌는 것은 없다 |
| **D** 자기 `CLAUDE.md` + `.claude/settings.local.json` 만 있음 | `update` 가 하네스를 깔고 exit 0, 되돌릴 명령 없음 | 세 명령이 같은 첫 줄로 "설치된 것이 없다 — `install --track <name>`" · exit 1 · **한 바이트도 쓰지 않는다** |
| **E** 기록이 생기기 전 판(v26.63 이하, 2026-05-18 이전) 설치자 | `update` 가 룰 이름으로 트랙을 추측해 갱신·앵커 이행 | 세 명령이 "하네스 파일은 있는데 기록이 없다 — `install --track tooling` 으로 기록을 만들라"(트랙은 `.claude/.installed-tracks` 에서 제안) · exit 1. `install` 한 번이 같은 결과를 내고(같은 파일은 둠 · 다른 파일은 하나씩 백업 후 새 판 · 함께 쓰는 파일은 몫만) 기록을 만든다. 그 뒤로는 보통 설치본이다 |
| 기록이 깨진 설치본 | `list`·`uninstall` 은 corrupted 문구 exit 1, **`update` 는 `.claude/` 가 있으면 진행** | 셋이 같은 corrupted 문구 · exit 1 (판정 함수가 하나라 저절로 맞는다) |

## 1. 판정 표 — 상태 × 명령

판정은 **`detectInstallState(projectDir)` 하나**가 낸다(불변식). 입력은 `readInstallLogStatus` 의 결과만이고, 디스크 흔적(§3)은 결과를 바꾸지 않고 **문장만** 더한다.

```ts
type DetectedInstall = {
  state: "installed" | "corrupted" | "none";   // 기록 ok · 기록 파싱/필드 불량 · 기록 없음
  log: InstallLog | null;  tracks: Track[];     // tracks = log.spec.tracks ∩ 현재 어휘 (installed 일 때만)
  hasClaudeDir: boolean;                        // 복구 문구(D10) 전용 — 설치 여부가 아니다
  traces: Trace[];                              // §3. none 일 때만 채운다. 안내 문장과 --track 제안에만 쓴다
};
```

| 상태 | `list` | `update` | `uninstall` | `install` | 첫 화면(위저드) |
|---|---|---|---|---|---|
| **installed** | 기록 표시 · exit 0 | 갱신(ADR-097/099) · exit 0 | 확인 뒤 제거 · exit 0 | 더하기/재설치(ADR-099 선택 대체) | Update / Uninstall / Exit |
| **corrupted** | `✗ install log is corrupted at … — run install --reinstall to rebuild it` · exit 1 (지금 그대로) | **같은 줄 · exit 1 · 쓰지 않음**(지금은 진행) | 같은 줄 · exit 1 (지금 그대로) | 지금 동작 유지(§7 미확인 ②) | corrupted 줄 + Exit 만 |
| **none + 흔적 있음**(E · 옛 클론 · 기록 삭제) | `✗ No install record at <dir>/.uzys-agent-harness/.harness-install.json` ↵ `  Harness files are here (<흔적 1~3개>) but no record of installing them.` ↵ `  Cloned from a teammate? Ask whoever installed it to run \`install --track <t>\` once (tracks: see \`list\`) and commit .uzys-agent-harness/ (if .gitignore still lists \`.uzys-agent-harness/\` after that, the line is theirs — delete it).` ↵ `  To make this copy managed on its own: agent-harness install --track <t> …` · exit 1 | 같은 네 줄 · exit 1 · **백업 폴더 · 앵커 · import · 스크립트 어느 것도 쓰지 않음** | 같은 네 줄 · exit 1 | 첫 설치 규칙(ADR-097 D3·D4·결정 7 · Q3): 같은 내용 → 둠 · 다른 내용 → 그 파일 하나 백업 후 새 판 · 함께 쓰는 파일은 몫만 · 기록 생성. 흔적 중 `.claude/CLAUDE.md`(옛 앵커)가 있으면 한 줄 안내(§3) | **새 설치 흐름**(지금은 Update 메뉴) + 트랙 단계 앞에 위 둘째·셋째 줄을 한 번 보인다. 트랙 기본 선택 = 메타파일 제안 |
| **none + 흔적 없음**(D) | `✗ No harness install found at <dir>` ↵ `  Run \`agent-harness install --track <name>\` first.` · exit 1 | 같은 두 줄 · exit 1 · 쓰지 않음 | 같은 두 줄 · exit 1 | 첫 설치 | 새 설치 흐름(지금 그대로) |

규칙 셋: ⓐ 세 읽기/갱신 명령의 **첫 줄은 상태마다 한 문장**이고 명령 이름만 다르지 않다(지금은 `list` "Nothing installed here" · `uninstall` "Nothing to uninstall" · `update` 진행 — 세 가지). ⓑ `none`·`corrupted` 에서 `list`·`update`·`uninstall` 은 디스크에 **아무것도 쓰지 않는다**(테스트가 실행 전후 트리 해시로 문다). ⓒ 쓰는 명령은 사용자가 명시적으로 고른 `install` 뿐이다.

## 2. C 의 경로 — 기록을 저장소에 싣는다

**결정: `.uzys-agent-harness/` 를 통째로 무시하던 `.gitignore` 줄을 없애고, 그 안의 런타임 파일 두 개만 무시한다.** 하네스가 `.gitignore` 에 더하는 몫(`src/env-files.ts` `AGENT_ARTIFACT_DIRS`)에서 `.uzys-agent-harness/` 를 빼고 `.uzys-agent-harness/hook-blocks.log` · `.uzys-agent-harness/update-backups.json` 을 넣는다. 그러면 기록(`.harness-install.json`)과 보조 스크립트 3종(`protect-branch.sh` · `spec-drift-check.sh` · `check-absence.sh` — 룰 본문이 `bash .uzys-agent-harness/…` 로 가리키는 파일)이 하네스 파일과 **함께 커밋되고 함께 클론된다.** C 는 명령을 칠 필요가 없다 — `git clone` 이 그 명령이다.

왜 이것이 "한 원칙" 과 맞는가: 하네스 몫은 기록 하나가 정한다(CLAUDE.md §설치자 디스크). 기록이 파일과 다른 경계(클론)에서 갈라지는 것이 #658 의 원인이고, 기록을 파일과 같은 경계에 두면 원칙은 그대로이면서 "기록 없음" 이 정상 상태에서 사라진다. 디스크 존재는 여전히 근거가 아니다 — 클론에서도 판정은 기록이 한다.

실측 근거: ⓐ 기록은 v26.64.0(2026-05-20, `e25d3cc`, ADR-020)에 `.claude/.harness-install.json` 으로 태어나 v26.134 까지 `.claude/` 안에 있었고 하네스는 그 파일을 **무시하지 않았다**(`git log -S harness-install.json -- src/env-files.ts` 0건 — 커밋됐는지는 설치자 선택). ⓑ v26.135.0(`4a8bca9`, ADR-050)이 CLI 중립을 이유로 `.uzys-agent-harness/` 로 옮기면서 ADR-050 은 "`.gitignore` — 새 디렉터리를 자동 등재하지 않는다" 고 **명시**했다. ⓒ 무시 줄은 v26.141.0(`b3fc187`, 2026-08-02, ADR-061 #268)이 **`hook-blocks.log` 오염을 막으려고** 디렉터리째 넣은 것이다 — 기록을 클론마다 따로 두자는 결정은 어디에도 없다. ⓓ 기록에 기계 고유 값은 `codexTrust` 의 두 필드(`configPath` 홈 경로 + `projectDir` 절대경로, `--with-codex-trust` 때만, `installer.ts:1406-1412`)뿐이고 그 밖 경로는 전부 프로젝트 상대(`install-writes.ts` `rel()`). 클론의 `uninstall` 은 그 값을 "손수 지울 것" 으로 **출력만** 한다(`uninstall.ts:645-660`, 파일 접근 없음) — 동료 기계의 경로가 화면에 뜰 뿐 무해. `installedAt` 은 install 만 쓰고 `selections[].at` 은 빼기가 바뀐 실행만 쓰므로 매 update 의 타임스탬프 diff 는 없다(검증 N2 실측). **단, 같은 판 update 가 `policyFiles`·`skillFiles` 의 순서만 바꿔 기록을 다시 쓴다**(install 은 ledger 순, update 는 readdir 순 — 검증 B2 실측) → NR-2 가 `writeInstallLog` 에서 경로 배열(policyFiles · skillFiles · externalFiles · portions · rootFiles)을 path(+key) 로 정렬해 직렬화를 정규화한다(`sortClis` 가 같은 이유로 이미 있다).

이관(기존 설치본): 무시 줄은 `lines` 어댑터의 몫이라 **다음 `install` 이 저절로 바꾼다**(지금 `.gitignore` 쓰기는 install 하나 — `installer.ts:1197`; `update` 는 ADR-099 PR B 가 머지된 뒤부터 같은 몫을 쓴다) — `planUpsert` 는 기록된 키가 렌더에 없고 디스크 sha 가 기록과 같으면 `remove`, 새 키는 `add`(`src/adapters/contract.ts`). 옛 기록은 `legacyGitignoreSeed` 가 `rootFiles.notes` 로 그 줄을 찾는다. 설치자가 그 줄을 고쳤으면 `kept` + 안내(지금 규칙). 화면은 한 줄을 더한다: `.gitignore  now ignores only the harness's runtime files — commit .uzys-agent-harness/ so teammates get the install record`. 자기 `.gitignore` 에 `.uzys-agent-harness/` 를 직접 둔 설치자는 그대로다(설치자 줄이 이긴다, ADR-097 §4 ⓑ) — 이관이 닿지 않으므로 안내 문장에 "install 뒤에도 그 줄이 남아 있으면 설치자 줄이니 지운다" 를 조건부로 쓴다(§1 · §5). 무조건적인 "그 줄을 지우고 폴더를 커밋" 대안은 두지 않는다 — 기록된 옛 줄은 install · update 가 걷고, NR-2 뒤에는 손으로 지운 옛 줄을 update 가 되살리지 않는다(렌더에 없는 키 — NR-1 리뷰 N1). `.gitignore` 가 없던 프로젝트(`onlyIfPresent`)는 이미 커밋 대상이다. 폴더에 생기는 파일은 기록 · 스크립트 3종 · 두 로그 · `*.sh.backup-<ts>`(기존 `*.backup-…T*` 패턴이 덮는다)뿐이라 토큰·시크릿이 섞이지 않는다(검증 N4).

| 대안 | 기각 이유 |
|---|---|
| **A. 지금 구조 유지 + `install` 이 흔적을 "입양"**(같은 내용의 기록 없는 파일을 소유로 적음) | Q3(같은 내용 → `displaced`, 소유 아님)와 §4 ⓓ(설치 전부터 있던 키는 `portions` 에 안 적음)를 둘 다 뒤집어야 하고, 뒤집어도 **동료가 고친 파일**은 입양 순간 백업+덮기(= C 의 작업본이 HEAD 와 갈라짐)거나 디스크 sha 를 기준선으로 거짓 기록(다음 update 가 동료 편집을 "refreshed" 로 **조용히** 덮음) 둘 중 하나다. 옛 판 파일이면 전부 "다르다" 라 입양 = 강제 갱신. 성립하지 않는다 |
| **B. `install --adopt`/`attach` 새 명령** | A 와 같은 벽 + 명령 하나 추가. 클론마다 사람이 쳐야 하고 잊으면 #658 그대로 |
| **C. 기록을 커밋(채택)** | 위. 판정 함수 변경 없음 · 어댑터 변경 없음 · 렌더 한 줄 + 기록 직렬화 정규화(경로 배열 정렬) |
| **D. 흔적으로 CLI/트랙을 유도해 update 를 "최선" 으로 진행** | ADR-096 D6 · ADR-097 D1 위반. #595 가 바로 이 경로의 결과다 |

따르는 결과(설치자 관점): 팀의 선택(`excluded` · `selections`)이 저장소 단위가 된다 — 동료가 `--without X` 로 뺀 것은 내 클론에서도 빠진다(원래 그 파일들이 커밋돼 있어 사실상 그랬다). `update` 는 **한 사람이 돌려 커밋하고 나머지는 pull** 한다 — 둘이 동시에 하면 기록 JSON 이 충돌한다 — 다른 파일처럼 한쪽을 통째로 고른다(둘 다 유효한 기록이다). 충돌 마커가 남으면 `corrupted` 판정(§1)이 나오고, `install --reinstall` 은 처음부터 다시 만들면서 **기록된 빼기와 외부 자산을 잊는다**(`readInstallLog` null → `previousLog` null — 검증 N3) — 안내 문장은 이 순서(통째 고르기 먼저)로 쓴다. 동료가 고친 하네스 파일은 클론의 `update` 가 같은 판에서도 새 판으로 되돌린다(먼저 백업, 요약에 표시 — `updateDir`, 검증 N1 실측) — 팀의 편집을 지키려면 커밋 전에 `git checkout` 하거나 백업에서 다시 적용한다. uninstall 은 기록을 지우므로 그 삭제도 커밋 대상이다. 과도기: 26.164 미만으로 깐 저장소의 클론은 §1 "none + 흔적" 행이고, 설치자가 `install --track <t>` 한 번(ADR-099 PR A 뒤라 플래그 없는 재실행이 빼기를 되살리지 않는다 · PR B 뒤에는 `update` 도 된다) 돌려 `.uzys-agent-harness/` 를 커밋하면 다음 pull 부터 C 가 된다 — 그 전에 C 가 스스로 `install` 을 돌려 자기 기록을 만들었다면 pull 때 git 이 "untracked file would be overwritten" 으로 멈춘다(자기 기록을 치우고 pull; 안내 문장에 넣는다).

## 3. "하네스 흔적" — 무엇을 보고, 왜 원칙과 충돌하지 않는가

| 흔적 | 판정 근거로 쓰는 곳 | 화면에서 하는 일 |
|---|---|---|
| `.claude/.installed-tracks` | **없음** (지금은 `source: "metafile"` 로 설치 판정 — 폐지) | 안내 셋째 줄의 `--track <t>` 제안 · 위저드 트랙 기본 체크 |
| `CLAUDE-uzys-harness.md` · `CLAUDE.md` 의 `<!-- uzys-harness:import:start -->` · `AGENTS.md` 의 `<!-- uzys-harness:agents -->` · `.agents/rules/uzys-harness.md` | 없음 | "Harness files are here (…)" 괄호 안 나열(최대 3개) |
| `.claude/CLAUDE.md`(v26.139 이하 앵커) · `.claude/rules/{htmx,nextjs,data-analysis,pyside6,cli-development}.md` | **없음** (지금은 `source: "legacy"` 트랙 추론 — 폐지) | `install` 뒤 한 줄: `.claude/CLAUDE.md  older harness anchor — not managed; the anchor is CLAUDE-uzys-harness.md now. Move your notes into CLAUDE.md and delete it` (update 가 기록 있는 설치본에 내는 `legacyAnchor` 줄과 같은 문장) |

흔적은 `state` 를 바꾸지 않고, 쓰기를 일으키지 않고, 소유를 주장하지 않는다 — ADR-096 Consequences 가 이미 쓴 용법("디스크 존재는 이 안내를 낼지 말지에만 쓰인다")이고 ADR-097 D1("디스크 존재는 '안 만든다' 의 근거로만")보다 좁다. 흔적을 오판해도 비용은 문장 하나다.

## 4. E 조사 — 기록 전 판은 지원 범위 밖이고, 처리 방침은 이미 결정돼 있다

| 사실 | 근거 |
|---|---|
| 기록은 **v26.64.0(2026-05-20)** 부터 — `.claude/.harness-install.json` | `git log --diff-filter=A -- src/install-log.ts` → `e25d3cc` · CHANGELOG 3116–3119행 · ADR-020 |
| v26.135.0(2026-07-26)에 `.uzys-agent-harness/` 로 이동, 옛 자리도 계속 읽는다 | `4a8bca9` · `readInstallLogStatus` 가 두 경로를 본다(`install-log.ts:724`) — v26.64 이후 설치본은 전부 기록이 읽힌다 |
| **npm 첫 게시 = v26.72.1(2026-05-31, `@uzysjung/claude-harness`)**, 현 패키지 `@uzysjung/agent-harness` 는 v26.83.0(2026-06-13)부터 | CHANGELOG 3022–3025행 · 2754행 · `npm view … time` created `2026-06-13` — **npm 으로 깐 프로젝트는 하나도 기록 전 판이 아니다** |
| 기록 전 판 = 셸 `setup-harness.sh`(2026-04-22 커밋 `0b393b1`(그 판 표기 `v27.17` 은 ADR-007 rename 으로 태그가 없다)) · TS v0.2.0–v26.63.0(2026-04-25~05-18), 배포 경로는 `curl|bash` · 저장소 클론 | `git log -S'.installed-tracks'` · 태그 목록. 룰 이름 추론(`LEGACY_SIGNATURES`)은 그보다도 전(메타파일 이전 셸 판) 대상이다 |
| **방침은 ADR-097 이 이미 정했다**: "로그 없음(v26.63 이하 · 지운 경우) → 지금과 같이 install 만 받는다; update·uninstall 은 거절" | `one-principle-design-2026-09-27.md` §5 표 (ADR-097 Accepted) — 코드(`state.ts` legacy 분기 · `update-mode.ts` 로그 없는 앵커 이행 · `resolveUpdateBackupPath` 의 "로그 없는 레거시 설치본은 백업")가 이 결정을 따르지 않은 자리가 #595 다 |

결론: **레거시 경로를 걷어낸다.** `LEGACY_SIGNATURES` · `inferFromLegacySignatures` · `source: "metafile" | "legacy"` · `summarizeState` 의 소스 라벨 · update 의 기록 없는 앵커 생성(`recordAnchorBaseline` "로그가 없으면 만들지 않는다" 분기) · 기록 없는 `.claude.backup-*` 폴더 복사. E 가 잃는 것: `update` 한 번 대신 `install --track <t>` 한 번(트랙은 화면이 제안) — 결과 파일은 같고(같은 파일은 둠 · 다른 파일은 백업 후 새 판) 기록이 생겨 그 뒤 `update`·`uninstall` 이 열린다. `.claude/CLAUDE.md` 옛 앵커 안내는 install 화면이 이어받는다(§3). 보고된 E 는 0건이다.

## 5. 문서(#658) — README · USAGE 에 넣는 절 (초안)

README §Day to day 표에 한 행: `| Cloned a repo a teammate set up with the harness | Nothing — the install record is committed with the files. \`list\` shows it; \`update\` and \`uninstall\` work as on their machine |`.

USAGE §Keeping it current 에 소절 **"### Teammates and fresh clones"**:

> The harness keeps its install record in `.uzys-agent-harness/.harness-install.json`, next to its helper scripts, and that folder is meant to be committed — only `hook-blocks.log` and `update-backups.json` in it are ignored. A teammate who clones the repo gets the record with the files: `list`, `update` and `uninstall` answer exactly as on the machine that installed it, and the rules that call `.uzys-agent-harness/*.sh` work. Run `update` from one machine and commit the result (files and record together); everyone else pulls. `update` replaces a harness file a teammate edited (backup first, listed in the summary); to keep the team's edit, `git checkout` the file or re-apply it from the backup before committing. If two people update at once the record conflicts like any file — resolve it by taking either side whole (both are valid records); `install --reinstall` rebuilds from scratch and forgets recorded exclusions and external assets.
>
> **Cloned a repo set up before 26.164?** Its `.gitignore` still hides the record, so your clone has harness files but no record. `list`, `update` and `uninstall` say so and change nothing (exit 1). Ask whoever installed it to run `install --track <t>` once (tracks: see `list` on their machine) and commit `.uzys-agent-harness/` — that install takes the harness's old line out of `.gitignore`; if `.gitignore` still lists `.uzys-agent-harness/` after that, the line is theirs, so they delete it. After your next pull you are a normal install. To manage your copy on its own instead, run `install --track <t> --cli <c>` — files identical to the harness's are left alone, a file that differs is saved as `<file>.backup-<ts>` first, and shared files only get the harness's part ([installing into an existing project](#installing-into-an-existing-project)). If you did that and later pull a committed record, git stops on the untracked file — move yours away and pull again.

USAGE §`update` 의 "`update` copies `.claude/` to `.claude.backup-<ts>` first and exits `1` if there is no install to update" 는 그대로 참이 되고, §Troubleshooting 에 한 항목: **"`update` says there is no install record but the files are here"** → 위 소절로 링크.

## 6. 구현 분할 · 완료 기준

main 기준 브랜치 둘(스택 금지), 각자 `npm run ci` green. 문턱(ADR-094): **NR-2 는 문턱 위**(설치자 저장소에 커밋되는 것이 바뀐다 — 공유 상태) → 독립 리뷰. NR-1 는 쓰기를 **없애는** 변경이라 리그레션 + CI 로 충분하되, 갈리면 리뷰 쪽으로.

**NR-1 — 판정 함수 하나(#595)**: `state.ts` 를 §1 모양으로 · `commands/{list,update,uninstall}.ts` · `interactive.ts` · `router.ts` 가 그 결과만 읽음 · §4 의 레거시 분기 제거 · 흔적 수집기(`traces`)와 안내 문장 · install 의 옛 앵커 안내 줄 · Docker D · E. 수정 없이는 실패해야 하는 테스트:

| # | 테스트 | 지금 |
|---|---|---|
| A1 | `state.test.ts`: `.claude/` + `.installed-tracks` + 룰, 기록 없음 → `state: "none"`, `traces` 에 메타파일·룰 | `existing`/`metafile` 로 통과 |
| A2 | `update` 명령: #595 픽스처(`CLAUDE.md` + `.claude/settings.local.json`) → exit 1, **실행 전후 트리의 경로·sha 집합 동일**, 첫 줄 = `list`·`uninstall` 의 첫 줄 | exit 0 · 앵커·import·백업 폴더 생성 |
| A3 | 세 명령 첫 줄 동치: `none+흔적` · `none` · `corrupted` 픽스처 각각에서 `list`·`update`·`uninstall` 의 stderr 첫 줄이 같다 | 세 문장이 다르다 |
| A4 | `update` 가 corrupted 기록 + `.claude/` 에서 exit 1 + corrupted 문구 | 진행한다 |
| A5 | 위저드: `.claude/` 만 있고 기록 없음 → `selectTracks` 호출 · `selectAction` 미호출 · 안내 줄 1회 | `selectAction`(Update 메뉴) |
| A6 | `install` on E 픽스처(`.claude/CLAUDE.md` 포함) → 리포트에 옛 앵커 안내 1줄 · 기록 생성 · 같은 내용 파일 mtime 불변 | 안내 없음 |
| A7 | `router.test.ts` 의 `legacy`/`metafile` 상태 서술 → 제거(음성 대조: 레거시 분기를 되살리면 A1·A5 red, typecheck 통과 확인) | — |

**NR-2 — 기록을 저장소에(#658)**: ADR-099 PR B 머지 뒤 · `env-files.ts` 렌더 교체 · `writeInstallLog` 경로 배열 정규화 · 이관 안내 줄 · ADR-100(ADR-050 "자동 등재 않음" 과 ADR-061 의 무시 줄을 Amends) · §5 문서 · Docker C.

| # | 테스트 | 지금 |
|---|---|---|
| B1 | `gitignoreRender()` 키에 `.uzys-agent-harness/` 없음, `…/hook-blocks.log`·`…/update-backups.json` 있음 | 반대 |
| B2 | 옛 기록(`portions` 에 `.uzys-agent-harness/`)으로 플래그 없는 `install` → 그 줄 `remove` + 두 줄 `add` + 안내 줄 · 빼기 유지; 같은 픽스처로 `update`(ADR-099 PR B 뒤) → 같은 결과; 설치자가 그 줄을 고친 픽스처 → `kept` | 키 유지 · update 는 `.gitignore` 를 안 쓴다 |
| B4 | install 직후 같은 판 `update` 가 기록 바이트를 바꾸지 않는다(경로 배열 순서 정규화) | `policyFiles`·`skillFiles` 순서만 바뀐 diff |
| B3 | E2E(vitest): install → 트리를 새 무시 규칙대로 복사(두 런타임 파일 제외) → 복사본에서 `list` exit 0 · `update` 가 같은 판에서 아무 파일도 안 바꿈 · `uninstall --dry-run` 이 원본과 같은 계획 | 복사본에 기록 없음 → exit 1 |

**Docker 재현 3개**(`test/docker/scenarios/`, `run.sh all` 이 집계):

- `scenario-clone-teammate.sh`(C): `git init` → `install --track tooling --cli claude` → `git add -A && commit` → `git clone` → 클론에서 `list` exit 0 · `update` exit 0 + `git status --porcelain` 빈 출력(같은 판) · `uninstall --dry-run` exit 0 · `.uzys-agent-harness/*.sh` 존재. 변형(N1): 원본에서 `.claude/rules/git-policy.md` 를 고쳐 커밋한 뒤 클론에서 `update` → 백업 1건 · 작업트리 diff 1건(그 파일) · 요약에 표시. 대조: 클론에서 `.uzys-agent-harness/` 를 지운 뒤 세 명령 → 전부 exit 1 · 첫 줄 동일 · 트리 해시 불변.
- `scenario-no-record-plain.sh`(D): #595 재현 명령 그대로 → `update` exit 1 · `CLAUDE.md` 바이트 동일 · `.claude.backup-*` 없음 · `CLAUDE-uzys-harness.md` 없음 · `list`·`uninstall --yes` 첫 줄 동일.
- `scenario-no-record-legacy.sh`(E): `.claude/rules/cli-development.md` + `.claude/.installed-tracks`(`tooling`) + `.claude/CLAUDE.md`, 기록 없음 → 세 명령 exit 1 + 안내에 `--track tooling` → `install --track tooling --cli claude` exit 0 → 기록 생성 · 루트 `CLAUDE.md` import · 옛 앵커 안내 줄 · 같은 내용이던 룰은 백업 없음.

완료 = A1–A7 · B1–B4 green(각각 변이 적용을 먼저 증명) · Docker 3개 green · `npm run ci` green · USAGE/README 절 머지 · ADR-100 Accepted · #595 · #658 닫힘. #522(클론 작업본 update 가 AGENTS.md 판을 바꿈)는 NR-1 로 경로 자체가 사라져 재발 불가 — 코멘트로 남긴다.

## 7. 가정 · 미확인 (사실과 구분)

1. **가정**: `.claude/.installed-tracks` 는 셸 판(2026-04-22 `0b393b1`) 이후 모든 판이 썼다 — 셸 판 도입 커밋과 현 `installer.ts:1084` 쓰기만 확인했고 중간 판을 하나씩 열지 않았다. E 의 `--track` 제안이 빠질 수 있을 뿐 판정은 안 바뀐다.
2. **미확인**: corrupted 기록에서 플래그 없는 `install` 의 지금 동작(`previousLog === null` 로 첫 설치처럼 새 기록을 쓰는 듯 — `installer.ts:414`) — 설계는 "유지" 로 두고 NR-1 가 테스트로 현 동작을 고정한다. 바꾸려면 별 이슈.
3. **가정**: Claude Code 가 `.claude/CLAUDE.md` 를 지금도 메모리로 읽는다(옛 앵커가 상주 중복이 되는 이유) — 조회하지 않았다. 안내 문장은 "not managed" 만 단언한다.
4. **확인(검증 N2)**: 다른 기계에서 온 `codexTrust` 값으로 `uninstall` 은 "손수 지울 것" 을 출력만 하고 파일에 접근하지 않는다(`uninstall.ts:645-660`) — 동료 기계의 경로가 화면에 뜬다.
8. **기록만(검증 N6)**: 정책·스킬 sha 는 바이트 비교라 `core.autocrlf` 팀원은 전 파일이 "고쳤다" 로 판정될 수 있다 — 매트릭스가 ubuntu/macos 뿐이라 이 설계 밖.
5. **의존**: 설치 판정의 트랙이 메타파일에서 기록(`spec.tracks`)으로 옮겨 가므로 #585(추가 설치가 기록 트랙을 덮음)에 걸린 설치본은 첫 화면 트랙 표기가 달라질 수 있다 — 고칠 자리는 #585 의 기록 누적이다.
6. **가정**: 팀이 `update` 를 한 사람이 돌린다는 운영 모델 — 관측이 아니라 §5 문서로 안내하는 규약이다. 충돌 비용은 JSON 머지 1회.
7. **사실**: 보고된 C 는 도커 탐색(#658 R34)이고 실제 팀 보고는 0건, E 는 0건. 이 설계가 고치는 것은 "기록 없는 update 가 쓴다"(#595, 재현됨)와 그 상태가 **설계상 기본**(#658)이라는 구조다.

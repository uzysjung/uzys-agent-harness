# ADR-100: 설치 기록을 저장소에 싣는다 — `.gitignore` 는 기록 폴더의 런타임 파일 둘만 무시한다

- Status: Proposed
- Date: 2026-10-04
- PR: (머지 직전에 채운다)
- Issue: #658
- Amends: ADR-050 §적용 범위의 "`.gitignore` — 새 디렉터리를 자동 등재하지 않는다" (그 뒤 ADR-061 이 디렉터리째 등재했고, 이 ADR 이 폴더 줄을 걷고 런타임 파일 두 줄만 등재한다) · ADR-061 Decision 2 의 "gitignore 패턴에 `.uzys-agent-harness/` 추가" (차단 로그를 무시한다는 목적은 그대로 — 대상을 폴더에서 로그 파일로 좁힌다)
- 설계 문서: `docs/plans/no-record-project-design-2026-10-04.md` §2 · §5 · §6 NR-2 (검증 `verify-no-record-design.md` B1 · B2 · N1–N5 반영)

## Context

하네스 몫은 설치 기록 하나가 정한다(루트 `CLAUDE.md` §설치자 디스크 · ADR-096). 그런데 하네스가 `.gitignore` 에 더하는 몫에
`.uzys-agent-harness/` 가 통째로 들어 있어서, 하네스 파일(룰 · 훅 · 앵커)은 커밋되는데 **그 소유를 말하는 기록과 룰이 부르는
보조 스크립트 3종은 클론에 오지 않았다.** 동료가 깐 저장소를 클론한 사람은 `list`·`uninstall` 에서 "설치 없음" 을 받고,
`update` 는 설치로 오판해 백업 폴더 · 앵커 · import 를 만들었다(#658 · #595). 기록과 파일이 다른 경계에서 갈라진 것이 원인이다.

경위: 기록은 v26.64.0 에 `.claude/` 안에서 태어났고 하네스는 그 파일을 무시한 적이 없다. v26.135.0(ADR-050)이 CLI 중립을
이유로 `.uzys-agent-harness/` 로 옮기며 "`.gitignore` 에 자동 등재하지 않는다" 고 적었고, v26.141.0(ADR-061)이 **차단 로그가
남의 저장소를 더럽히지 않게** 디렉터리째 등재했다. 기록을 클론마다 따로 두자는 결정은 어디에도 없었다.

## Decision

1. 하네스의 `.gitignore` 몫(`src/env-files.ts`)에서 `.uzys-agent-harness/` 를 빼고 `.uzys-agent-harness/hook-blocks.log` ·
   `.uzys-agent-harness/update-backups.json` 을 넣는다. 기록(`.harness-install.json`)과 보조 스크립트 3종은 하네스 파일과
   함께 커밋되고 함께 클론된다 — 클론한 사람이 칠 명령은 없다.
2. 이관은 기존 `lines` 어댑터의 판정 그대로다: 기록된 폴더 줄이 기록 sha 그대로면 걷고(`remove`) 두 줄을 더한다(`add`).
   몫 기록 이전 판의 기록은 `rootFiles.notes` 로 그 줄을 알아본다 — 렌더에서 빠진 줄도 `RETIRED_GITIGNORE_LINES` 의 옛 값으로
   찾는다. 설치자가 고친 줄은 `kept`, 설치자가 직접 둔 같은 줄(기록에 없음)은 설치자 것이라 건드리지 않는다. install 과
   update(ADR-099 PR B 뒤) 둘 다 같은 writer 로 이관한다. 화면은 걷은 실행에 한 줄을 더한다:
   `.gitignore  now ignores only the harness's runtime files — commit .uzys-agent-harness/ so teammates get the install record`.
3. 기록 직렬화를 정규화한다: `writeInstallLog` 가 경로 배열(`policyFiles` · `skillFiles` · `externalFiles` · `rootFiles` ·
   `portions`)을 path(+key) 로 안정 정렬해 쓴다. install 은 쓴 순서로, update 는 디렉터리를 읽은 순서로 적어 같은 판
   update 가 순서만 바꾼 diff 를 만들었다 — 기록이 커밋 대상이 되면 그 diff 가 팀원마다 커밋·충돌 후보가 된다.

## Alternatives

| 대안 | 기각 이유 |
|---|---|
| 지금 구조 유지 + `install` 이 기록 없는 흔적을 "입양" | 같은 내용 → 소유 아님(Q3)과 설치 전부터 있던 키 → 기록 안 함을 둘 다 뒤집어야 하고, 뒤집어도 동료가 고친 파일은 입양 순간 백업+덮기거나 디스크 sha 를 거짓 기준선으로 적어 다음 update 가 동료 편집을 조용히 덮는다 |
| `install --adopt` 같은 새 명령 | 위와 같은 벽 + 명령 하나 추가. 클론마다 사람이 쳐야 하고 잊으면 #658 그대로 |
| 흔적으로 CLI · 트랙을 유도해 update 를 "최선" 으로 진행 | ADR-096 D6 · ADR-097 D1 위반 — #595 가 바로 이 경로의 결과다 |
| **기록을 커밋(채택)** | 판정 함수 · 어댑터 변경 없음. 렌더 두 줄 + 옛 줄 인식 + 기록 직렬화 정규화 |

## Consequences

- **팀의 선택이 저장소 단위가 된다** — 동료가 `--without X` 로 뺀 것은 클론에서도 빠진다(그 파일들이 커밋돼 있어 사실상
  그랬다).
- **`update` 는 한 사람이 돌려 커밋하고 나머지는 pull 한다.** 둘이 동시에 하면 기록 JSON 이 충돌한다 — 다른 파일처럼 한쪽을
  통째로 고른다(둘 다 유효한 기록). `install --reinstall` 은 처음부터 다시 만들며 기록된 빼기와 외부 자산을 잊는다(N3).
- 동료가 고친 하네스 파일은 클론의 `update` 가 같은 판에서도 새 판으로 되돌린다 — 먼저 백업하고 요약에 표시한다(N1). 팀의
  편집을 지키려면 커밋 전에 `git checkout` 하거나 백업에서 다시 적용한다. `uninstall` 은 기록을 지우므로 그 삭제도 커밋 대상이다.
- 기록에 기계 고유 값은 `--with-codex-trust` 때의 `codexTrust` 두 필드(홈 경로 · 절대경로)뿐이다 — 클론의 `uninstall` 은 그
  값을 "손수 지울 것" 으로 출력만 한다(동료 기계의 경로가 화면에 뜰 뿐 파일에 접근하지 않는다).
- 폴더에 생기는 파일은 기록 · 스크립트 3종 · 런타임 파일 둘(무시) · `*.sh.backup-<ts>`(기존 백업 패턴이 덮는다)뿐이라 토큰 ·
  시크릿이 커밋 대상에 섞이지 않는다(N4).
- 이관이 닿지 않는 설치자: 자기 `.gitignore` 에 `.uzys-agent-harness/` 를 직접 둔 경우(설치자 줄이 이긴다)와, `--without
  gitignore:.uzys-agent-harness/` 를 기록해 둔 경우(그 id 는 더는 렌더 키가 아니라 기록에 남아도 효과가 없다). 문서가
  "그 줄을 지우고 폴더를 커밋" 대안을 함께 쓴다. `.gitignore` 가 없던 프로젝트는 하네스가 파일을 만들지 않으므로(지금 규칙)
  원래부터 폴더가 커밋 대상이었다.
- 과도기: 26.164 미만으로 깐 저장소의 클론은 기록이 없다. 설치한 사람이 `install --track <t>` 한 번(또는 update) 뒤
  `.uzys-agent-harness/` 를 커밋하면 다음 pull 부터 관리 상태가 된다. 그 전에 클론 쪽이 자기 기록을 만들었다면 pull 때 git 이
  untracked file 로 멈춘다 — 자기 기록을 치우고 pull 한다(USAGE "Teammates and fresh clones").

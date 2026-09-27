# ADR-097: 설치자 디스크는 한 원칙으로 — 판정 함수 하나 · 어댑터 4종 · 파일 단위 백업

- Status: Accepted
- Date: 2026-09-27 (5차 판 — 독립 검토 B1–B8 · R1–R5 · Q1–Q4 + 사용자 결정 1·2·7 반영)
- PR: #575 (설계 · 결정) — 구현은 설계 §9 PR-1 ~ PR-10
- Issue: #551 (하위 18건 — #556–#561 · #563–#574)
- Supersedes: 사용자 결정 2026-09-27 "uninstall · `--reinstall` 은 CLI 폴더를 `<dir>.backup-<ts>` 로 옮긴다"(PR #554 · v26.161.0, ADR 없음 — `src/commands/uninstall.ts:100-124` 주석이 그 결정의 기록이다)
- Amends: ADR-046 · ADR-047 · ADR-048(편집 판정·파일 단위 백업을 **uninstall 까지** 같은 표로; 첫 접촉은 §8 결정 7) · ADR-049(`refreshOnly` 유지, 폴더 백업 폐지) · ADR-074(두 제외 필드 → 한 목록 `excluded`, **누적** — "제외 없이 다시 깔면 돌아온다" 는 더는 참이 아니고 되돌리기는 `--with <id>` 하나다) · ADR-095(기록에 없는 `AGENTS.md` 는 루트 `CLAUDE.md` 모델) · ADR-096(`templates.*Dir` 미사용 — 깔린 CLI 집합 `clis` 와 소유 표는 그대로, `dir` 의 뜻만 경로 접두로) · ADR-002 D4(trust 등록은 Codex 자신의 프롬프트에 맡기고 `--with-codex-trust` 는 범위 조건 없는 옵션이 된다) · ADR-020(Global scope 선택지 삭제 — 항상 프로젝트; D16 의 "글로벌 자산은 안내만" 은 옛 global 설치본에 그대로). ADR-037 은 그대로다(스캐폴드 = advisory).
- 설계 문서: `docs/plans/one-principle-design-2026-09-27.md`(파일 × 동작 표 · 이슈 대응 · 화면 · 이관 · 검증 · 사용자 결정)

## Context

설치 탐색 테스트(#551, npm 게시판 26.161.0 을 컨테이너에서 5회 × 3레인)가 같은 파일이 동작마다 다른 규칙을 받는 것을
18건의 하위 이슈로 보였다(설계 문서 독립 검토가 코드에서 찾은 #574 포함). 원인은 낱개 버그가 아니라 **규칙이 자리마다 따로
사는 구조**다.

| 같은 파일 | install(첫) | update | uninstall · `--reinstall` | 근거 |
|---|---|---|---|---|
| `.claude/settings.json` | 통째 교체(`installer.ts:813-817`) | 병합 | 폴더째 이동 | #563 |
| `AGENTS.md` | 설치자 절을 스캐폴드로(`agents-md-merge.ts:216-221` 마커 없는 파일) | 절 보존 | 절만 걷어냄 | #558 |
| `.mcp.json` | 서버 추가 · 깨진 JSON 이면 백업 없이 템플릿으로 덮음(`mcp-merge.ts:106-117`) | 안 건드림 | 안 건드림 | #569 · #574 |
| `.claude/rules/*.md` | 파일 하나 백업 | 파일 하나 백업 **+ 폴더 전체 복사**(`installer.ts:516-527`) | 폴더째 이동 | #556 · #570 |
| `CLAUDE-uzys-harness.md` | — | 파일 하나 백업 | `--reinstall`: **백업 없이 덮음** | #572 (유일한 복구 불가 손실) |
| 외부 skill `.agents/skills/<id>` | `add --skill <name> --agent … --copy` | — | uninstall: `remove <source>` → 도구가 못 찾고 exit 0 | #573 |
| 제외 선택 | `baselineExclude`·`skillExclude` 두 필드, 외부 자산은 없음 | 되살림 | — | #566 |

판정이 사는 곳을 세면 `resolveBackupPath` · `backupEditedPolicyFile` · `backupEditedSkillFiles` · `createOwnedWriter.write` ·
`updateDir` · `syncSkills` · `pruneOrphans` · `syncHarnessAnchor` · `removeTemplates` · `removeExternalFiles` ·
`rootClaudeMdModified` 열한 곳이다. 새 파일 종류 하나를 더하면 이 중 몇 곳을 고쳐야 하는지 아무도 말할 수 없다. 사용자가
방향을 정했다(2026-09-27, 루트 `CLAUDE.md` §설치자 디스크는 한 원칙으로 다룬다): *"단순화해서 여러 경우에도 일관된 원칙으로
install · update · uninstall 될 수 있어야 한다"* — 잣대는 ① 일관 ② 유지보수 단순(한 데이터 모델 · 한 판정 함수) ③ 설치자에게
직관적·도움.

## Decision

1. **설치 기록 하나가 하네스 몫을 정한다 — 기록의 모양은 지금 그대로다.** 네 필드(`policyFiles` · `skillFiles` ·
   `externalFiles` · `rootFiles`)를 옮겨 적지 않고 접근자 `recorded(log, path)` 하나가 경로 기준을 숨긴다(독립 검토 대안 S —
   옛 기록 이관이 없으므로 디스크 스캔 값이 섞인 옛 기록이 소유 근거로 승격되는 손실 경로가 생기지 않는다). 새 필드는 둘 —
   함께 쓰는 파일의 하네스 몫을 **키 단위**로 적는 `portions` 와 자산 종류를 가리지 않는 `excluded`. **소유 근거 = 기록에 있는
   경로.** writer 가 쓰는 순간 경로와 sha 를 기록에 더하고, 하네스가 지운 경로만 뺀다 — 기록은 실행마다 새로 쓰지 않고 누적한다
   (`mergeExternalFiles` 와 같은 규칙, 네 필드 모두). 새 판이 적은 기록은 그 자체로 소유다(필터 없음). 설치 뒤 템플릿과 이름을
   맞춰 디스크를 훑는 `collectPolicyHashes`·`collectSkillHashes` 는 폐지한다. 필터는 옛 판이 디스크를 훑어 적은
   `policyFiles`·`skillFiles` 에만 한 번 건다(claude 설치 · 기록 트랙에서 나오는 대상이거나 번들 스킬 id · 은퇴 경로(`RETIRED_PATHS`, sha 없음으로 읽어 회수) · `excluded` 아님) — 새
   판이 로그를 처음 쓸 때 남은 것만 이어받고 `records: "writer"` 를 적으며, 걸린 옛 항목은 "기록 없음" 이 된다(지우지 않는 쪽).
   디스크 존재는 "안 만든다" 의 근거로만 쓴다(ADR-096 D6 유지). `INSTALL_LOG_VERSION` 은 올리지 않는다.
2. **판정 함수는 하나다.** `judge({op, kind, rec, disk, next}) → {verdict, line}` — 기록 상태(`none` · `no-sha` · `sha`) ·
   디스크 · 이번에 쓸 내용(디스크 = next 면 조용히 `leave`)을 보고 행동 하나와 화면 한 줄을 낸다. install · update ·
   `--reinstall` · uninstall(전량 · `--cli` · `--only`)은 대상 항목과 `op` 만 다르고 이 함수의 반환값을 실행한다. 표(설계 문서
   §1.2)가 SSOT 이고 코드가 그 표를 그대로 옮긴다.
3. **하네스 파일은 파일 단위다.** 안 고친 파일은 조용히 덮고·지우며, 고친 파일은 **그 파일 하나**를 `<file>.backup-<ts>` 로
   남긴 뒤 진행한다(uninstall 도 같다 — 편집분은 백업으로만 남고 라이브에서는 빠진다). **폴더 단위 백업·이동은 없다** —
   `backupDir` · `copyBackupDir` 은 어느 동작에서도 부르지 않는다. 기록이 없는 파일은 소유를 주장하지 않는다 — 하네스 자리에
   기록 없는 설치자 파일이 있으면 같은 방식으로 그 파일 하나를 백업하고 하네스 판을 쓴다(사용자 결정 7 — "업데이트된 버전은
   덮어써야 된다"; 화면은 "had a file with this name — saved as …", 편집이라 부르지 않는다). 그 백업은 `rootFiles.change =
   displaced` 로 기록하고, 하네스가 그 자리를 떠나는 모든 `remove`(uninstall · update 의 은퇴 회수 · `--reinstall` · `--cli`)가
   하네스 파일을 지운 뒤 백업을 원래 이름으로 옮겨 **제자리로 되돌린다** — 하네스는 그 자리를 빌렸을 뿐이다. 내용이 하네스 판과
   같은 설치자 파일은 `leave` 하고 백업 없는 `displaced` 로 적는다 — 하네스 것으로 삼지 않는다. 로그는 있는데 sha 만 없는 옛 판은
   1회 백업하고 "saved a copy once" 라 말한다.
4. **함께 쓰는 파일은 세 동작 모두 하네스 몫만 더하고·바꾸고·뺀다 — 첫 설치도.** 몫의 정의는 어댑터 4종
   (`marker-md` · `json-keys` · `toml-region` · `lines`)이 갖고, 각 어댑터는 `upsert`/`strip` 한 쌍이며 `upsert∘strip` 은
   설치자 내용을 되돌린다(`marker-md` · `lines` 는 바이트 동일, `json-keys` · `toml-region` 은 파싱 동치). 공통 규칙 넷: ⓐ
   설치자 파일을 파싱하지 못하면 한 바이트도 쓰지 않고 남기고 말한다(#574) ⓑ 설치자의 같은 키·절·줄이 있으면 그것이 이긴다
   ⓒ 기록에 있는데 파일에 없는 키는 설치자가 지운 것 — update 는 되살리지 않고 `excluded` 에 키 id(`mcp:github` 등)로 자동
   기록한다(기록에서 빼기만 하면 다음 update 가 신규로 읽어 되살린다); 설치자가 함께 쓰는 파일을 통째로 지우면 update 는 그
   파일의 `portions` 키 전부를 `excluded` 로 옮기고 만들지 않는다(릴리즈가 새로 더한 함께 쓰는 파일만 만든다) ⓓ strip 은
   `portions` 에 기록된 키만 뺀다 — 내용 식별은 옛 로그의 몫 찾기에만 쓴다; 설치 전에 이미 있던 키는 값이 하네스 판과 같아도
   `portions` 에 적지 않는다. 기록에 없는 `AGENTS.md`(첫 접촉)는 루트 `CLAUDE.md` 와 같은
   모델(본문 그대로 + 하네스 블록 하나). `.codex/config.toml` 의 몫은 최상위 키 구간(파일 맨 앞)과 표 구간(파일 끝)
   둘이고 충돌은 파서로 읽어 판정한다.
5. **하네스 자리 밖의 기록 없는 파일은 어떤 동작도 건드리지 않는다.** 외부 도구가 만든 것은 설치 때와 같은 식별자로 도구의 되돌리기를
   부른 뒤(#573) 기록된 파일에만 3 을 적용하고, 하네스가 만들지 않았거나 넘겨준 산출물은 경로를 나열만 한다. **스캐폴드**
   (`.github/workflows/*` · `.env.example`)는 넘겨준 산출물이다 — 없을 때만 한 번 쓰고 덮어쓰지도 갱신하지도 지우지도 않는다
   (사용자 결정 7 의 예외 · ADR-037 그대로).
6. **Global scope 선택지는 없앤다**(사용자 결정 1). 하네스 파일은 언제나 프로젝트 안이다 — 위저드 Scope 단계 삭제, `--scope
   global` 은 새 설치에서 거절하고 대체 명령(`claude plugin install --scope user` · `npx skills add -g` · `npm i -g`)을
   안내한다. 로그 `scope: global` 인 옛 설치본은 update · uninstall 이 지금처럼 처리한다. `--with-codex-trust` 는 범위 조건 없는
   옵션이 된다(사용자 결정 2 — 자동 등록은 하지 않고 Codex 의 "Trust and continue" 프롬프트에 맡긴다).
7. **제외는 한 목록이다.** `excluded` 가 baseline id · 번들 스킬 id · 외부 자산 id · 함께 쓰는 파일의 키 id 를 가리지 않고 담고,
   install · update · uninstall 이 같은 목록을 읽는다. `excluded` 는 누적한다 — install 의 `--without` 은 더하고 `--with` 만 뺀다;
   어느 실행도 이 목록을 새로 계산해 덮지 않는다. `--with`·`--without` 은 모든 id 종류(카탈로그 · `baseline:` · 번들 스킬 · 키 id
   `mcp:` `settings:` `opencode:` `gitignore:`)를 받고, 위저드는 `excluded` 를 체크 해제 상태로 보여 준다. 이것은 ADR-074 "제외
   없이 다시 깔면 돌아온다" 를 바꾼다 — 되돌리기는 이제 `--with <id>` 하나다.
8. **지우는 동작은 확인한다.** uninstall 3종과 `--reinstall` 은 TTY 에서 요약 + 확인, 터미널이 없으면 `--yes` 없이는
   아무것도 하지 않고 거절한다. update 가 기록에 있고 안 고친 파일을 회수하는 것은 지우는 동작으로 세지 않는다.
9. **화면은 실제로 한 일만 말한다.** 화면 줄은 `judge` 의 `line` 에서만 나오고 숫자는 기록에서 센다. 동사는 wrote · refreshed
   · removed · backed up · kept · left for you 여섯이다.
10. **새 파일 종류는 manifest 한 줄이다**(`kind` · `adapter?` · `owner`). `judge` 와 세 동작은 손대지 않는다.

## Alternatives

- **낱개 패치 18건** — 기각(사용자 결정). 같은 파일이 동작마다 다른 규칙을 받는 구조가 그대로라 19번째가 난다.
- **기록을 원장 하나로 통합하고 옛 네 필드를 이관** — 기각(1차 판 · 독립 검토 B1·B2). 순이익은 판정 함수와 어댑터에서 나오고,
  통합은 그 위에 "스키마 이관 + 영구 폴백" 층을 더하며 손실 위험(옛 `policyFiles`·`skillFiles` 는 디스크 스캔 값이라 설치자
  파일이 섞여 있다 — `install-log.ts` `installedClis` 주석 BLOCKER-5)이 그 층에 산다.
- **폴더 단위 백업 유지 + 파일 단위 병행** — 기각. 백업이 두 층이면 "내 편집이 어디 갔나" 의 답이 둘이고(#570), 편집
  0 개에도 실행마다 사본이 쌓인다(#556). 파일 하나 백업이 설치자 손실 0 을 이미 만족한다(설계 문서 §7C).
- **`.claude/` 등 CLI 디렉터리를 하네스 전용으로 선언하고 통째 소유** — 기각. Claude Code 가 `settings.local.json` 을 거기
  만들고 설치자가 자기 커맨드를 둔다(ADR-096 Alternatives 3 의 실측). 디렉터리 소유는 성립하지 않는다.
- **함께 쓰는 파일을 없앤다(하네스 몫을 별도 파일로)** — 부분 기각. CLI 가 읽는 파일명이 고정이라(`settings.json` ·
  `.codex/config.toml` · `opencode.json` · `.mcp.json`) 불가능하다. `.gitignore` · `.env.example` 은 줄일 수 있어 설계 문서
  §10 에 대안으로 남겼다.
- **`.mcp.json` 을 몫 전체 sha 하나로 기록** — 기각(검토 B1). 설치자가 하네스 서버 하나의 `env` 만 고쳐도 셋 다 남기거나 셋 다
  빼야 한다. 키 단위 `portions` 가 그 자리다.
- **`toml-region` 을 파일 끝 한 구간으로** — 기각(검토 B4, 재현). 최상위 키가 설치자의 마지막 `[table]` 안으로 들어가
  Codex 가 조용히 무시한다(`codex-rs/config/src/strict_config.rs` — 비 strict 모드는 모르는 키를 버린다).
- **`INSTALL_LOG_VERSION` 을 올리고 마이그레이션 명령** — 기각(ADR-096 과 같은 사유). 부재를 정상으로 읽는 폴백이 더 싸다.

## Consequences

- 설치자: 어떤 동작 뒤에도 자기 것은 라이브에 남거나 그 파일 하나의 백업으로 남고, 하네스가 빌린 자리는 uninstall 이 돌려준다. 첫 설치가 자기 훅·MCP·절을 지우지
  않고(#558 · #563 · #574), update 가 조용하며(#556 · #557), 하네스 몫에서 지운 키는 지운 대로 남고, uninstall 이 함께 쓰는
  파일에서 하네스 몫을 빼고 남는 것을 말한다(#569 · #570 · #571 · #573). README 한 문단(설계 문서 §1.1)이 규칙 전체다.
- 폴더 백업 폐지와 첫 접촉 병합은 **되돌리기 어려운 변경**이다 — ADR-094 문턱 위 PR = PR-3 · PR-4 · PR-5 · PR-7 · PR-8 · PR-9,
  `portions` 를 디스크에 쓰는 판이면 PR-1 도. 이미 만들어진 `<dir>.backup-<ts>` 는 설치자 것이라 지우지 않고 알린다.
- uninstall 때 설치자가 고친 하네스 파일은 라이브에 남기지 않고 `<file>.backup-<ts>` 로 옮긴다(§8 결정 4 확정) — 지금의
  "kept — modified" 와 다르다.
- `--keep-templates` 는 폐지된다(§8 결정 6 확정) — 거절 메시지가 기록에서 계산한 대체 명령을 찍는다.
- `templates.claudeDir` · `codexDir` · `opencodeDir` 은 더는 읽지 않는다(#559). `installedClis` 의 옛 로그 유도는 그대로다.
- 검증은 경우별 시나리오에서 원칙 테스트(판정 표 + 어댑터 항등 + 파싱 실패 무쓰기)와 픽스처 시나리오 3개, 그리고 npm pack
  산출물 설치 경로로 옮긴다 — 저장소 루트를 하네스 루트로 쓰던 Docker 이미지가 #568 을 못 본 원인이었다.
- 결정 7건(설계 문서 §8)은 전부 확정이다 — 사용자 확정 3건(Global 선택지 삭제 · Codex trust 안내만 · 첫 접촉 백업 후 쓰기,
  스캐폴드 예외) + 검토를 거쳐 확정한 4건(`.mcp.json` 서버 회수 · 고친 파일의 uninstall · 스캐폴드 advisory · `--keep-templates`
  폐지). 대기 0건.
- Global 선택지 삭제로 위저드가 6단계에서 5단계가 되고 `--scope global` 을 쓰던 스크립트는 거절 메시지(대체 명령 포함)를 받는다.
  #560 은 이 결정으로 닫힌다.
- 측정: 다음 탐색 테스트(같은 프로토콜)에서 "같은 파일 · 다른 규칙" 발견 수 = 0 이 목표. 지금은 18.
- `.codex/config.toml` 판정에 `smol-toml`(의존성 0 · BSD-3)을 번들한다 — 런타임 의존성 2 → 3.

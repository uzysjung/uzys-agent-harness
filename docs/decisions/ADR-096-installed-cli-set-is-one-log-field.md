# ADR-096: 깔린 CLI 집합은 설치 로그의 `clis` 하나가 SSOT 다

- Status: Proposed
- Date: 2026-09-21
- PR: (미정)
- Amends: ADR-049 (외부 CLI 산출물 갱신 — 대상 CLI 판정 근거를 `refreshOnly` + `templates.*Dir` 에서 `clis` 로 옮긴다)
- Issue: #528 (Epic #527)

## Context

"이 프로젝트에 어느 CLI 가 깔려 있나"에 답하는 자리가 세 곳이었고, 셋이 서로 다른 답을 냈다.

| 근거 | 무엇을 아는가 | 무엇을 모르는가 |
|---|---|---|
| `spec.cli` | **마지막 설치**가 고른 CLI | 그 전에 깐 CLI. 누적하지 않는다 |
| `templates.codexDir` · `opencodeDir` | codex · opencode 의 누적 | claude(고르지 않아도 적혔다) · antigravity(항목 자체가 없다) |
| 디스크 존재 | 파일이 있는가 | `AGENTS.md` 를 codex 가 썼는지 opencode 가 썼는지 (#514 가 이것으로 깨졌다) |

실측된 결과(2026-09-21):

- Claude 로 깐 뒤 위저드 Add 에서 Claude 를 풀고 OpenCode 를 체크하면 파일은 전부 남는데 로그의
  `spec.cli` 만 `["opencode"]` 로 덮인다. 다음 `update` 는 `.claude/` 를 갱신은 하면서도
  **새 릴리즈가 더한 Claude 자산은 "안 골랐다"고 보고 깔지 않았다**(`installNewAssets` ·
  `installNewSkillDirs` 가 `spec.cli` 를 읽는다). 화면은 아무 말도 하지 않는다.
- `templates.claudeDir` 는 claude 를 고르지 않은 설치에도 `".claude/"` 로 적혔다 — 기록이
  디스크에 없는 디렉터리를 있다고 말하는 상태다.
- CLI 하나만 빼는 방법이 없었다. 있는 것은 전량 `uninstall` 과 자산 단위 `--only` 뿐이고,
  "OpenCode 만 그만 쓰겠다"는 요구에 대응하는 경로는 손으로 지우는 것뿐이었다.

## Decision

1. **설치 로그에 `spec.clis` 한 필드를 둔다** — 지금 깔려 있는 CLI 집합(누적, `CLI_BASE_SORT_ORDER`
   정렬). install · update · uninstall · `list` 가 **이것만** 읽는다. `spec.cli` 는 남기되 뜻을
   좁힌다: 마지막 설치가 고른 것(표시용). 읽는 곳이 많아 지우지 않는다.
2. **CLI 집합은 더해지기만 한다.** `buildInstallLog` 가 `이전 집합 ∪ 이번 선택` 으로 쓴다.
   재설치(`.claude/` backup rename)에서도 누적이다 — 밀려나는 것은 `.claude/` 뿐이고 다른 CLI 의
   산출물은 디스크에 그대로 남기 때문이다. 빼는 경로는 `uninstall --cli <name>` 하나다.
3. **옛 로그는 1회 유도한다**(`installedClis`) — **기록만 읽는다. 디스크 존재는 신호가 아니다**
   (Decision 6 과 같은 규율). `INSTALL_LOG_VERSION` 은 올리지 않는다 — 이 파일은 필드 부재를
   정상으로 읽는 관행을 이미 갖고 있다(`rootFiles`·`skillFiles`·`externalFiles`).

   ```
   claude      ⇐ spec.cli ∋ claude      ∨ templates.rootClaudeMd ∨ policyFiles ∨ skillFiles
   codex       ⇐ spec.cli ∋ codex       ∨ templates.codexDir
   opencode    ⇐ spec.cli ∋ opencode    ∨ templates.opencodeDir
   antigravity ⇐ spec.cli ∋ antigravity ∨ externalFiles ∋ .agents/rules/uzys-harness.md
   ```

   claude 의 근거가 셋인 이유: `templates.claudeDir` 는 고르지 않아도 적혀 있어 믿으면 codex 단독
   설치본이 전부 claude 로 읽히고, 남은 기록 셋은 **claude 를 고른 설치에만** 생긴다(claude 미선택
   설치는 `.claude/` baseline 대신 CLI 중립 자산만 깐다 — `installer.ts`). 앵커가 빠진 설치본은
   `policyFiles`·`skillFiles` 가, 자산을 전부 해제한 설치본은 앵커 sha 가 받는다. **유도 결과는
   읽기 시점에 기록하지 않는다** — 다음에 로그를 다시 쓸 때 실린다. 읽기 경로(`list`·`--dry-run`)가
   디스크 기록을 바꾸면 사용자가 아무것도 안 했는데 기록이 달라진다.
4. **CLI 별 소유 표를 한 모듈로 둔다**(`src/cli-ownership.ts`). 전용 경로 · 공유 경로(상대 CLI) ·
   회수 방식(`dir` / `recorded` / `anchor` / `import-block` / `keep`)이 한 자리에 있다.
   `removableFor(cli, remaining)` 이 "무엇을 회수해도 되는가"의 유일한 술어다 — 공유 자리는 남는
   CLI 중 그 경로를 자기 표에 가진 CLI 가 하나도 없을 때만 회수된다.
5. **제거는 `uninstall` 뿐이다.** 전량 또는 `uninstall --cli <name>`. 마지막 CLI 는 거절하고 전량
   경로로 안내한다 — 전량 삭제 경로를 둘로 두면 한쪽만 고쳐지는 날이 온다. `--only` ·
   `--keep-templates` 와는 조합할 수 없다(하려는 일이 반대다). 지우는 절차 자체는 전량 경로의
   함수를 그대로 쓴다: `removeExternalFiles`(sha 소유 판정 + #516 `AGENTS.md` 절 걷어내기) ·
   `stripRootImport` · 앵커 sha 대조. 새로 쓰면 그게 두 번째 사본이고, 사본이 갈리면 설치자
   파일이 사라진다.
6. **설치자 본문은 어느 경로에서도 잃지 않는다.** 지우는 판단은 항상 로그 · sha · 표에서 나온다.
7. **CLI 를 더해 앵커가 새로 태어날 때 다른 앵커의 설치자 절을 옮겨 심는다**(`src/anchor-seed.ts`,
   Epic #527 정의 6). 루트 `CLAUDE.md` 의 import 블록 밖 본문 ↔ `AGENTS.md` 의 `## Project Context`.
   결정론적 복사만 한다 — 문장을 고치거나 요약하지 않는다. **배너는 옮기지 않는다**: 스캐폴드
   배너의 셋째 줄은 "원칙이 어디 사는가"를 말하는데 그 답이 파일마다 달라(#305), 그대로 복사하면
   새 파일이 없는 파일을 가리킨다. 목적지가 자기 배너를 붙이고 그 아래 본문만 옮긴다. 두 파일의
   CLI 고유 표현을 맞추는 것은 `audit-harness-fit` 의 몫이고 화면이 그렇게 안내한다(정의 7).

## Alternatives

- **`spec.cli` 를 누적 필드로 바꾼다.** 읽는 곳이 많고 뜻이 바뀌면 화면·`list`·설치 요약이 전부
  "마지막에 고른 것"이 아닌 값을 말하게 된다. 무엇보다 **옛 로그의 그 필드는 여전히 마지막
  설치분**이라 같은 이름이 판본에 따라 두 가지를 뜻하게 된다 — 이 리포가 반복해서 당한 실패다.
- **디스크만 본다(로그 없이).** `AGENTS.md` 를 codex 와 opencode 가 나눠 써서 파일 존재가 둘을
  가르지 못한다(#514 의 근거). `.claude/` 도 사용자가 만들었을 수 있다.
- **옛 로그에서 `.claude/` 의 실존을 claude 의 단서로 쓴다 — 기각(독립 리뷰 BLOCKER-1,
  2026-09-22).** 초판 결정이 이것이었고 머지 전에 뒤집혔다. Claude Code 는 권한을 한 번
  승인받기만 해도 `.claude/settings.local.json` 을 만들므로, codex 단독으로 깐 **현존하는 모든
  설치본**에서 하네스가 만든 적 없는 디렉터리가 "깔린 CLI" 로 읽힌다. 그러면 `list` 가 claude 를
  깔렸다고 말하고 → 사용자가 `uninstall --cli claude` 를 치고 → `.claude/` 트리가
  `rmSync(recursive)` 로 통째 사라진다(그 자리는 `kind: "dir"` 라 sha 판정이 없고, 백업도 확인
  화면도 없다). 같은 오판정으로 `update` 는 고른 적 없는 Claude 하네스를 그 디렉터리에 깔았다.
  Decision 6 과 정면으로 어긋나는 규칙이었고, 대체 근거(앵커 sha · `policyFiles` · `skillFiles`)가
  **이미 기록에 있어** 디스크를 볼 이유도 없었다. 회귀 가드 = `tests/legacy-log-claude-dir.test.ts`.
- **`INSTALL_LOG_VERSION` 을 올리고 마이그레이션 명령을 만든다.** 사용자가 한 번 더 뭔가를 쳐야
  하고, 안 친 프로젝트는 그대로 깨진다. 부재를 정상으로 읽는 기존 관행이 더 싸고 더 안전하다.
- **`uninstall --cli` 없이 전량 uninstall → 재설치로 안내한다.** 설치자가 채운 `AGENTS.md` ·
  루트 `CLAUDE.md` · 선택 자산이 그 왕복에서 위험해진다. CLI 를 바꾸는 흔한 요구에 가장 비싼
  경로를 물리는 셈이다.

## Consequences

- `update` 가 갱신하는 대상이 "디스크에 있는 것 + codex/opencode 는 로그"에서 **"로그의 집합"**
  하나로 합쳐졌다. ADR-049 의 `refreshOnly` 는 그대로 남아 "없는 파일은 안 만든다"를 계속 맡는다.
- `templates.claudeDir` 가 optional 이 됐다. 읽는 곳은 셋뿐이고(전량 uninstall 의 rm · 화면 목록 ·
  `list`) 전부 guard 를 달았다. 옛 로그는 값이 있으므로 동작이 그대로다.
- `list` 의 `cli:` 줄이 `spec.cli` 대신 깔린 집합을 찍는다 — `uninstall --cli codex` 뒤에도 codex
  를 말하던 자리였다.
- `uninstall --cli <name>` 은 `spec.clis` 뿐 아니라 **`spec.cli` 와 회수한 디렉터리 아래의
  `externalFiles` 항목에서도** 그 CLI 를 뺀다. `spec.cli` 는 표시용만이 아니라
  `external-installer.ts` 가 외부 스킬 refresh 의 대상 CLI 로 읽는 값이라, 남겨 두면 방금 뺀
  CLI 가 다음 실행의 대상이 된다(독립 리뷰 N2).
- **아직 안 한 것**(Epic #527 의 다음 레인): 새 릴리즈의 번들 스킬을 `.agents/` 자리에도 까는 것
  (S3) · 링크 슬롯(#524) · 위저드의 CLI 잠금·Uninstall 화면(L5). 이 ADR 은 그 레인들이 읽을
  **기록과 표**만 세운다.

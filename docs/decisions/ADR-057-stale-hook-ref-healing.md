# ADR-057: 설치 산출물이 자기보다 좁게 깔리는 경로를 참조할 때 — 분류를 바꾸지 않고 **런타임 치유기를 넓힌다**

- Status: Accepted
- Date: 2026-07-27
- PR: (머지 시 기재)
- Supersedes: — (없음)
- 관련: ADR-019(cherry-pick × plugin 게이팅 C1/C2/C3) · ADR-054(레인 원칙) · ADR-056(검증 정책)

## Context

`templates/settings.json` 의 PreToolUse(`Write|Edit`) 훅이 다음을 **무조건** 실행한다:

```
bash "$CLAUDE_PROJECT_DIR/.claude/skills/strategic-compact/suggest-compact.sh"
```

그런데 `settings.json` 은 `applies: all`(`src/manifest.ts`)이고 `strategic-compact` 은
`COMMON_SKILL_DIRS_ECC` → `applies: (s) => !s.withEcc` 다. `withEcc` 는
`isAssetSelected("ecc-plugin") || options.withPrune`(`src/installer.ts`)이고 `ecc-plugin` 은 opt-in.

`buildManifest` 실측:

| withEcc | settings.json | strategic-compact |
|---|---|---|
| false | 설치 | 설치 |
| **true** | **설치** | **미설치** |

→ ECC 플러그인을 선택한 설치에서는 **매 Write/Edit 마다 `bash <없는 경로>` = exit 127**.
게이트 커버리지 **0건**이었다(`grep -rn suggest-compact tests/` = 0).

**부류는 하나다**: *설치 조건이 넓은 산출물이, 자기보다 좁게 설치되는 경로를 실행 참조한다.*
같은 부류의 두 번째 실례가 반대 방향으로 존재한다(M-3: `agent-introspection-debugging` 이
`council`·`workspace-surface-audit` 을 지목 — 그 스킬은 `!withEcc` 에만 깔리는데 대상은 그때 없다).

**왜 이제껏 안 보였나**: 이 리포 자신이 `withEcc=false` 로 도그푸드해서 로컬에는 그 파일이
**존재한다**. v26.128.0~131.0 과 **같은 실패 모드** — 로컬 값과 실제 값이 우연히 같으면 로컬
테스트는 그 차이를 영원히 못 본다(`no-false-ship` §게이트 자신도 환경 값을 하드코딩하지 않는다).
기존 게이트 `tests/resident-doc-asset-reachability.test.ts` 는 이 부류를 위해 이미 있었으나
`specFor()` 가 `withEcc` 를 **항상 false** 로 만들어 **ecc 축을 한 번도 평가하지 않았고**,
referrer 집합도 상주 문서(rules + CLAUDE.md)로 한정돼 `settings.json` 과 스킬 문서가 밖에 있었다.

## Decision

**A′ — 자산 분류·템플릿·manifest 를 건드리지 않고, 이미 있는 런타임 치유기
`cleanStaleHookRefs`(`src/update-mode.ts`)의 술어를 넓힌다.**

1. `keepHookRef` 의 참조 추출을 `.claude/hooks/*.sh` → **`.claude/` 이하 임의 깊이**로. 캡처는
   `.claude/` 기준 상대경로 전체, 존재 확인 기준 디렉터리는 `claudeDir`, 제거 보고도 상대경로.
   **셋은 원자적으로 함께 가야 한다** — 기준 디렉터리만 바꾸면 멀쩡한 훅을 지운다(테스트가 고정).
2. **판정 대상은 이 프로젝트에 앵커된 참조뿐이다** — `$CLAUDE_PROJECT_DIR/.claude/` ·
   `${CLAUDE_PROJECT_DIR}/.claude/` · `claudeDir` 실경로 접두사(레거시 절대경로 설치)의 **화이트리스트**.
   앵커는 **토큰 시작에서만** 성립한다(맨 앞이거나 앞 문자가 따옴표·공백). 문자열 어디서든 찾으면
   `/mnt/host<claudeDir>/…`(바인드마운트) · `/private<claudeDir>/…`(macOS) · `<claudeDir>-backup/…`
   이 전부 이 프로젝트 것으로 오인돼 **실존하는 남의 훅을 지운다.** 참조 끝도 같은 이유로 토큰
   경계다 — 안 하면 `run.shell` 을 `run.sh` 로 오파싱해 역시 살아 있는 훅을 지운다.
   그 밖은 파일이 없어도 **보존**하고 제거 보고에도 넣지 않는다. `.claude/` 라는 이름은 두 대상을
   가리키기 때문이다 — 프로젝트 `<projectDir>/.claude/`(하네스 소유)와 홈 `~/.claude/`(사용자 전역
   설정, 플러그인 훅이 실제로 사는 곳). 경로 세그먼트 `/.claude/` 만 보면 `$HOME/.claude/…` ·
   `~/.claude/…` · `${CLAUDE_CONFIG_DIR}/…` · 프로젝트 밖 절대경로가 전부 같은 문자열로 보여
   **남의 훅을 지운다.** 화이트리스트로 짜는 이유는 예외를 열거하면(`$HOME` 을 빼고, `~` 를 빼고 …)
   그 목록이 두 번째 하드코딩 사본이 되어 다음 표기가 다음 서식지가 되기 때문이다
   (`no-false-ship` §게이트는 열거하지 말고 훑어라). 사용자 자기 스크립트를 지우면 치유가 아니라
   파손이다.
3. `installer.ts` 에서도 설치 말미에 **1회** 치유(`healStaleHookRefs`) — update 뿐 아니라 install 도.
4. 제거 건수·경로를 **화면에 보고**한다. 무음 처리는 아래 B 를 기각한 사유 그 자체다.

## Alternatives

| 안 | 왜 기각 |
|---|---|
| **A. 템플릿에서 훅을 빼고 조건부 주입** | **이미 깨진 설치를 못 고친다** — update 의 탐지 regex 가 skills 경로를 안 물어 영구히 exit 127. 게다가 `addPreToolUseHook` 이 `{type,command}` 만 만들어 `async`/`timeout` 재현 불가 → 시그니처 확장 필요. withEcc 판정 사본도 installer 에 두 벌째 생긴다 |
| **B. 훅 커맨드를 자기방어형으로**(`[ -f X ] && bash X`) | **무음 no-op.** 지금 유일한 파손 신호(stderr 127)를 지워, 다음에 경로가 바뀌어도 아무도 모른다 — *한 번도 실패하지 않는 검증*을 만드는 것(`no-false-ship`). 동일 사실이 두 곳에 하드코딩된 상태도 그대로 둔다. 부수로 JSON→셸→경로 3중 인용이라 cross-platform 취약 |
| **C/D. `strategic-compact` 을 항상 설치**(C2→C3 재분류) | **ECC 플러그인이 같은 훅을 기본 프로파일(`standard`)로 이미 등록한다** — `.dev-references/ecc/hooks/hooks.json` 의 `pre:edit-write:suggest-compact` → `scripts/hooks/suggest-compact.js`(실물 존재). 항상 깔면 **이중 발화**가 나고, 우리 SKILL.md 자신이 그것을 금지한다(*"two registrations mean the counter advances twice"*). 게다가 ADR-019·PRD 분류표를 함께 고쳐야 하는 **Major CR** 을 버그 수정에 끼워 넣는 것이 된다 |

> **D 는 이 세션에서 팀리드가 제안했다가 설계 레인이 반증했다.** 근거는 lock 의
> `modified: true`("upstream 이 스크립트를 삭제했으니 plugin 으로 갈음 불가")였는데, upstream 은
> 그것을 **삭제한 게 아니라 `scripts/hooks/` 로 옮기고 JS 로 재작성**했다. 제안자가
> `skills/strategic-compact/` **안만** 보고 부재를 결론냈다 — 이 리포가 반복해 온
> *"좁은 범위의 부재 주장은 틀린다"* 의 또 한 사례다(같은 세션에서 M-2 도 `src/` 만 보고 오판).
> **`cherrypicks.lock` 의 `modified: true` 는 rsync 삭제 방지 표식이지 갈음 가능성 판정이 아니다.**

## 적용 범위

| 축 | 범위 |
|---|---|
| 코드 | `src/update-mode.ts`(`keepHookRef`·`cleanStaleHookRefs` 2번째 인자 계약) · `src/installer.ts`(`healStaleHookRefs` + `InstallReport.staleHookRefs`) · `src/commands/install-render.ts`(fresh 분기 보고) |
| CLI | **claude 전용** — `.claude/settings.json` 이 없는 CLI 는 가드로 건너뛴다 |
| 트랙 | 전 트랙 (`settings.json` 은 `applies: all`) |
| **범위 밖** | `templates/settings.json` · `src/manifest.ts` · ADR-019/PRD 분류표 — **무변경**. **앵커되지 않은 참조 전부**(홈 `~/.claude/…` 포함 — `.claude/` *안*이지만 남의 것이라 범위 밖이다. "`.claude/` 밖" 이라고 쓰면 Decision 2 와 모순된다). 한 command 안에서 **앵커 배열 순서상 뒤에 오는** 참조(먼저 **성립한** 앵커 하나만 판정한다 — 출현 순회는 앵커마다 전량) |

## Consequences

1. **`InstallReport.staleHookRefs` 는 optional 이 아니라 required 다.** 새 생성 지점이 이 필드를
   조용히 빠뜨리지 못하게 하기 위함이고, 실제로 도입 시 픽스처 2곳이 typecheck 로 걸렸다.
2. **withEcc 사용자는 재설치마다 `settings.json` 백업이 1개 생긴다** — 디스크(훅 제거본)가
   템플릿과 달라 `backupFileIfChanged` 가 문다. karpathy 옵션 사용자에게 이미 존재하는 기지 비용과
   동종이고, 다수파(`!withEcc`)에는 발생하지 않는다. A(주입형)를 택했다면 같은 비용이 **다수파**에게
   발생했을 것이다.
3. **`keepHookRef` 를 export 한다.** 파리티 게이트가 *"면제는 치유기가 실제로 무는가로 증명한다"*
   를 위해 직접 호출한다 — 면제를 선언이 아니라 **실행**으로 증명시키는 배선이다.
4. **부류를 완전히 닫지는 못한다.** A′ 가 덮는 것은 **이 프로젝트에 앵커된** `.claude/` 이하
   **`.sh` 실행 참조**뿐이다. `.js`/`.py` 참조나 `.claude/` 밖 경로는 여전히 같은 127 을 낸다.
   **토큰 경계 양쪽이 각각 대가를 만든다 — 둘 다 보존 방향이다.**
   - **끝**: `.sh` 뒤에 토큰 문자가 붙으면 안 문다 — `x.sh;` · `x.sh'` · `x.sh&&…`(공백 없음) ·
     대문자 `.SH` · 경로에 공백 · `x.sh?query`.
   - **시작**: 앵커 앞 문자가 토큰 문자면 안 문다 — `'` · `=` · `:` · `(` 선행.

   대가를 감수하는 이유는 반대쪽이 **오제거**이기 때문이다. 끝을 안 고정하면 `run.shell` 을
   `run.sh` 로 오파싱하고, 시작을 안 고정하면 바인드마운트·`/private` 접두 경로를 이 프로젝트
   것으로 오인한다 — **둘 다 실존하는 훅을 지운다.** 보존 쪽 대가는 로그 소음뿐이고, 우리
   배포물의 훅 command 9건은 전부 토큰 시작·토큰 끝이다.
   **홈 `~/.claude/` 를 가리키는 참조도 안 덮는다 — 못 덮는 게 아니라 덮으면 안 된다**(Decision 2):
   그 파일의 소유자는 사용자이고, 하네스가 안 깐 것의 부재를 파손으로 판정할 근거가 없다. 그래서
   `$HOME/.claude/hooks/x.sh` 가 실제로 죽어 있어도 그 127 은 우리가 치유하지 않는다 — 그래서
   **작성 시점 게이트**를
   함께 뒀다(`tests/settings-reference-parity.test.ts`: 88 spec 을 코드에서 파생, 함의문 1개,
   면제는 치유기 호출로 증명). **M-3(콘텐츠 문서 → 스킬 지목)은 A′ 도 이 게이트도 안 덮는다** —
   별도 처방이 필요하고 후보는 `resident-doc-asset-reachability` 의 `withEcc` 축 확장이다.
5. **exit 127 이 Write/Edit 를 실제로 차단하는지는 미검증.** 이 리포 규약상 차단은 exit 2 이므로
   127 은 비차단 오류(로그 소음)일 것으로 보이나, 그 규약은 **우리 hook 작성 규약**이지 Claude Code
   런타임 관측이 아니고 이 훅에는 `async: true` 가 붙어 있어 표면화 형태가 다를 수 있다.
   **풀리는 조건**: `test/docker/` 시나리오로 실 claude 를 띄워 스킬 없는 상태에서 Write 1회를
   관측하면 확정된다(호스트 실행은 `docker-only-realcli.sh` 가 차단). 어느 쪽이든 처방은 같아
   판정을 보류하지 않았다.

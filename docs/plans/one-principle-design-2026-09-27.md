# 설치자 디스크는 한 원칙으로 — install · update · uninstall 설계 (#551)

작성 2026-09-27 · 5차 판(독립 검토 B1–B8 · R1–R5 · Q1–Q4 · N-a~N-g + 사용자 결정 1·2·7 반영, 검토 전문 = 코디네이터 스크래치패드 `review-design.md`) · 기준 `main`
5fb7d42 (v26.161.0 + CLAUDE.md 원칙 절) · 설계만, 코드·git 무수정.
근거는 `파일:줄`(이 워크트리 기준) · 이슈 번호 · 탐색 원자료(`.handoff/explore/iter*-*.md`) · 공식 문서 출처로 적는다.
확정된 원칙 초안(루트 `CLAUDE.md` §설치자 디스크는 한 원칙으로 다룬다 · #551 "결정" 절)을 **재정의하지 않고
구체화**한다. 원칙만으로 결론이 안 나는 것은 §8 로 몰았다.

---

## 0. 한 문단 요약 — 설치자에게 무엇이 달라지는가

지금은 같은 파일이 동작마다 다른 규칙을 받는다. 처음 깔 때 `.claude/settings.json` 은 통째로 바뀌고(내 훅이 꺼진다,
#563) `update` 는 병합한다. `AGENTS.md` 는 첫 설치에서 내 `## Project Rules` 를 잃고(#558) 그 뒤로는 지킨다.
`.mcp.json` 은 더하기만 하고 빼지 않으며(#569) 깨진 JSON 이면 내 서버가 백업 없이 사라진다(#574). `update` 는 아무것도 안
고쳐도 `.claude/` 를 통째로 복사해 쌓고(#556) `uninstall` 은 폴더째 옮긴다. 바뀐 뒤에는 **파일마다 딱 한 규칙**이다 —
하네스가 쓴 파일은 설치 기록이 말하고, 그 파일을 고쳤으면 **그 파일 하나만** 옆에 `<file>.backup-<시각>` 으로 남긴 뒤
진행하며, 설치자 파일 안의 하네스 몫은 세 동작 모두 **더하고 · 바꾸고 · 뺀다**(첫 설치도). 기록에 없는 것은 어떤 동작도
건드리지 않는다. 폴더 백업은 없어진다. 지우는 동작은 묻고, 터미널이 없으면 `--yes` 를 요구한다. 화면은 실제로 한 일만 말한다.

판정 기준 한 문장(브리프): *설치자가 README 한 문단만 읽고 어떤 동작 뒤 무엇이 남고 무엇이 사라지는지 맞힐 수 있고,
유지보수자는 한 표와 한 함수만 보면 된다.*

---

## 1. 원칙

### 1.1 설치자용 한 문단 (README 에 그대로)

**English**

> **What the harness does to your files.** The harness keeps a record of every file it writes. Its **own files** (rules,
> agents, hooks, skills, the anchor, its helper scripts) it writes, refreshes on `update` (retired ones are removed then),
> and removes on uninstall; if you edited one, that single file is first saved beside itself as `<file>.backup-<time>` —
> never a whole folder — and after uninstall it lives on only in that backup. If a file of yours already sits where the
> harness puts its own, it is saved beside itself the same way first and put back when the harness leaves that spot
> (uninstall, or a release that retires the file); if it already matches the harness's, it is simply left as is. The CI workflow and
> `.env.example` scaffolds are yours the moment they are written — never refreshed or removed. Files you **share** with it
> (`CLAUDE.md`, `AGENTS.md`,
> `.claude/settings.json`, `.mcp.json`, `.codex/config.toml`, `opencode.json`, `.gitignore`) it only adds its own part to,
> refreshes that part, and removes that part — on the first install too; your keys, hooks, servers and sections stay, and
> what you deleted from its part stays deleted (`install --with <id>` brings it back). (Deleting one of its own files is
> different: `update` puts it back and tells you how to keep it out for good — `install … --without <id>`, e.g.
> `--without baseline:agents/reviewer`.) Anything else not in its record it never
> touches. Removing asks first; without a terminal it needs `--yes`. The harness's own files all go into this project;
> plugins you pick live in Claude Code's plugin cache in your home, and `--with-codex-trust` adds one trust line to
> `~/.codex/config.toml`. Every summary lists exactly what it wrote, refreshed, removed, backed up, kept, or left for you.

**한국어**

> **하네스가 내 파일에 하는 일.** 하네스는 자기가 쓴 파일을 전부 기록한다. **하네스 파일**(룰·에이전트·훅·스킬·앵커·
> 보조 스크립트)은 쓰고, `update` 때 갱신하고(은퇴한 것은 그때 지운다), uninstall 때 지운다 — 내가 고친 파일이면 먼저
> **그 파일 하나**를 옆에 `<file>.backup-<시각>` 으로 남기고(폴더째 백업은 없다), uninstall 뒤에는 그 백업으로만 남는다.
> 하네스 자리에 이미 내 파일이 있어도 같은 방식으로 먼저 옆에 남기고, 하네스가 그 자리를 떠날 때(uninstall · 릴리즈가 그 파일을
> 은퇴시킬 때) 제자리로 되돌린다. 내용이 하네스 것과 같으면 그대로 둔다. CI 워크플로와
> `.env.example` 스캐폴드는 쓰이는 순간부터 내 것이다 — 갱신도 삭제도 하지 않는다. **함께 쓰는 파일**(`CLAUDE.md`·`AGENTS.md`·
> `.claude/settings.json`·`.mcp.json`·`.codex/config.toml`·`opencode.json`·`.gitignore`)에는 하네스 몫만
> 더하고·바꾸고·뺀다 — 첫 설치도 마찬가지이고, 내 키·훅·서버·절은 그대로 남으며, 내가 하네스 몫에서 지운 것은 지운
> 대로다(`install --with <id>` 로 되돌린다). (하네스 파일을 지우는 것은 다르다 — `update` 가 되돌려 놓고 영구히 빼는 법을
> 알려 준다: `install … --without <id>`, 예 `--without baseline:agents/reviewer`.) 그 밖에 기록에 없는 것은 어떤 동작도
> 건드리지 않는다. 지울 때는 먼저 묻고, 터미널이 없으면 `--yes` 가 있어야
> 한다. 하네스 파일은 전부 이 프로젝트 안에 쓴다 — 고른 플러그인은 Claude Code 의 홈 캐시에, `--with-codex-trust` 는
> `~/.codex/config.toml` 에 신뢰 한 줄을 더한다. 화면은 실제로 쓴 것·갱신한 것·지운 것·백업한 것·남긴 것만 말한다.

### 1.2 유지보수자용 규칙 — 한 데이터 모델, 한 판정 함수

**데이터 모델 = 지금 설치 기록 + 두 필드.** 검토의 대안 S 를 채택한다(사용자 잣대 ② 단순성) — 기록 네 필드
(`policyFiles`·`skillFiles`·`externalFiles`·`rootFiles`, `install-log.ts:186-210`)는 **그대로** 두고 옛 기록 이관을 하지
않는다. 접근자 하나가 네 필드의 경로 기준(`.claude/` 상대 · `.claude/skills/` 상대 · 프로젝트 상대)을 숨긴다.

```ts
// 새 필드 둘 (부재 = 정상, INSTALL_LOG_VERSION 은 올리지 않는다 — ADR-096 D3 관행)
interface InstallLog {
  …,
  /** 함께 쓰는 파일의 하네스 몫 — 키 단위. adapter 가 key 의 뜻을 정한다(§6.2) */
  portions?: Array<{ path: string; adapter: Adapter; key: string; sha256: string }>;
  /** 설치자가 뺀 것 — baseline id · 번들 스킬 id · 외부 자산 id · 함께 쓰는 파일의 키 id(`mcp:github` ·
   *  `settings:statusLine` · `settings:hooks.<Event>#<script>` · `opencode:mcp.<name>` · `gitignore:<line>`)를 가리지
   *  않는 한 목록(#566 · R2). update 가 설치자가 지운 키를 발견하면 여기 **자동으로** 적는다.
   *  **누적한다** — install 의 `--without` 은 더하고, `--with` 만 뺀다. 어느 실행도 이 목록을 새로 계산해 덮지 않는다(Q2) */
  excluded?: string[];
  /** 새 판이 로그를 처음 쓸 때 적는 표시 — 있으면 옛 스캔 필드에 거는 소유 필터(아래)를 더는 적용하지 않는다(Q1) */
  records?: "writer";
  /** `rootFiles.change` 에 두 값이 는다 — `advisory`(스캐폴드 등 넘겨준 파일) · `displaced`(첫 접촉으로 비켜 둔 설치자 파일:
   *  `notes[0]` = 백업 경로 — uninstall 이 제자리로 되돌리는 근거, R3) */
}
type Adapter = "marker-md" | "json-keys" | "toml-region" | "lines";
// 접근자 — 경로 하나에 대한 기록 상태. 네 필드 + 로그 수준 소유(아래 "기록 있음 · sha 없음")를 한 답으로
recorded(log, projectRelPath): { state: "none" | "no-sha" | "sha"; sha256?: string }
```

파일의 **종류는 저장하지 않고 유도한다**: 어댑터 표(§6.2)에 있는 경로 = `shared` · `assets[]` 의 자산 = `tool` ·
`rootFiles.change === "advisory"`(새 값) = `advisory` · 그 밖에 하네스가 쓰는 경로 = `harness`. 외부 도구가 만든 파일
(`.claude/skills/<외부id>` 등)은 이미 프로젝트 상대 `{path, sha}` 인 `externalFiles` 에 적는다 — 새 필드가 아니다.
**advisory 에는 스캐폴드도 든다**(사용자 결정 7 · 결정 5): `.github/workflows/*` · `.env.example` 은 설치 뒤 설치자 것이 되는
1회용 생성물(ADR-037)이라 **없을 때만 한 번 쓰고**, 덮어쓰지도 update 로 갱신하지도 uninstall 로 지우지도 않는다 — 알리기만.

**소유 근거 = 기록에 있는 경로**(R1 · Q1). writer 가 쓰는 순간 경로와 sha 를 기록에 **더하고**, 하네스가 지운 경로만 **뺀다**.
기록은 실행마다 새로 쓰지 않고 누적한다 — `mergeExternalFiles` 와 같은 규칙이고, 네 필드 모두 같다. 새 판이 적은 기록은 그
자체로 소유다(필터 없음). 설치 뒤 템플릿 디렉터리 전체와 이름을 맞춰 디스크를 훑는 `collectPolicyHashes`·`collectSkillHashes`
(`install-log.ts:518-560`)는 install 경로에서 끊고 폐지한다. **필터는 옛 판이 디스크를 훑어 적은 `policyFiles`·`skillFiles` 에만
건다.** 조건은 셋이다: claude 가 `installedClis(log)` 에 있을 것 · 경로가 `resolveRules`/에이전트 표로 **기록 트랙에서** 나오는
대상이거나 번들 스킬 id(옵션 선택은 기록에 없으므로 번들 id 전부)이거나 하네스가 배포했다가 은퇴시킨 경로(`RETIRED_PATHS` — 옛 판
전용의 닫힌 목록) · `excluded`(옛 `baselineExclude`·`skillExclude` 포함)에 없을 것. 새 판이 로그를 처음 쓸 때 이 필터를 한 번 적용해 남은 것만 이어받고, 로그에 `records: "writer"` 를 적는다. 이 표시가 있으면
이후로는 필터 없이 읽는다(이어받은 은퇴 항목만 예외 — 아래). 필터에 걸린 옛 항목은 "기록 없음" 이 된다(지우지 않는 쪽 — 안전). 은퇴 경로의 옛 스캔 sha 는 하네스
내용의 증거가 아니므로 "기록 있음 · sha 없음" 으로 읽는다 — update 와 uninstall 이 모두 `backup+remove` 로 치운다(설치자가 같은
이름으로 쓴 파일이어도 바이트는 백업에 남는다). 첫 writer 는 은퇴 항목을 회수할 때까지 이어받고, 그동안 그 항목에는 claude 설치 · `excluded` 아님 조건을 계속 건다. 고르지 않은 트랙의 같은 이름
설치자 파일(예: csr 설치자의 자기 `.claude/agents/data-analyst.md`)은 그래서 소유가 아니다. **"기록 있음 · sha 없음"** = 로그가
그 CLI 를 말하고(`claudeManaged`, `update-mode.ts:426-436`) 위 필터는 통과하는데 파일별 sha 만 없는 상태 — 체크섬 도입 전
판(#557)이 여기다.

**판정 함수 하나.** 세 동작과 `--reinstall` · `--cli` · `--only` 는 전부 이 함수의 반환값만 실행한다. 입력은 **기록 상태 ·
디스크 · 이번에 쓰려는 내용** 셋이고, 출력은 **행동 하나 + 화면 한 줄**이다.

```ts
judge({ op: "write" | "remove", kind, rec: ReturnType<typeof recorded>, disk: string | null, next: string | null })
  → { verdict: Verdict; line: string }
type Verdict = "create" | "overwrite" | "backup+overwrite" | "leave" | "leave+advise" | "remove" | "backup+remove"
             | "upsert-portion" | "strip-portion" | "advise";
```

| kind | 기록 | 디스크 | 디스크 = next | 디스크 = 기록 sha | `op: write` (install · update · reinstall) | `op: remove` (uninstall · update 의 은퇴 회수) |
|---|---|---|---|---|---|---|
| harness | none | 없음 | — | — | `create` | (할 것 없음) |
| harness | none | 있음 | 같다 | — | `leave` 하고 **`displaced`(백업 없음)로 적는다** — 하네스 것으로 삼지 않는다(Q3). 이 자리를 뒤에 새 판이 덮을 때는 보통 첫 접촉(백업 + `displaced`)이 된다 | `leave` — 그 파일을 남긴다 |
| harness | none | 있음 | 다르다 | — | `backup+overwrite`(결정 7 확정 — 최신판이 자리를 잡는다), 문구 "had a file with this name — saved as <file>.backup-<ts>"(편집이라 부르지 않는다); 백업 경로를 `rootFiles.change = displaced` 로 기록 | (uninstall 은 `displaced` 기록이 있는 자리를 하네스 파일 제거 뒤 **제자리로 되돌린다** — 하네스는 그 자리를 빌렸을 뿐이다, R3. 백업이 이미 없으면 그 사실을 말한다) |
| harness | no-sha | 있음 | 같다 | — | `leave`, 기록에 sha 추가 | `remove`(내용이 하네스 것 그대로) |
| harness | no-sha | 있음 | 다르다 | — | `backup+overwrite`, 문구 "no checksum on record — saved a copy once"(#557, 편집이라 부르지 않는다) | `backup+remove` |
| harness | sha | 없음 | — | — | install: `create` · update: `create` 를 "was missing — restored" 로(`excluded` 면 `leave`) | 기록만 정리 |
| harness | sha | 있음 | 같다 | — | `leave` | `remove` |
| harness | sha | 있음 | 다르다 | 같다 | `overwrite`(조용히) | `remove` |
| harness | sha | 있음 | 다르다 | 다르다 | `backup+overwrite` | `backup+remove` (§8 결정 4 확정) |
| shared | — | 없음 | — | — | **install** 은 `create` — 하네스 몫만 든 파일(컨텍스트 파일이면 스캐폴드 포함), `rootFiles.change = created`. **update** 는 `portions` 에 그 파일의 키가 있으면 설치자가 파일째 지운 것으로 보고, 그 키 전부를 `excluded` 로 옮기며 만들지 않는다; 기록에 그 파일 키가 없을 때(릴리즈가 새로 더한 함께 쓰는 파일)만 만든다(Q4) | (할 것 없음) |
| shared | — | 있음 | — | — | 파싱 실패 → `leave+advise`(한 바이트도 안 쓴다, #574). 성공 → `upsert-portion`: 설치자 키가 이기고, **기록에 있는데 파일에 없는 키는 설치자가 지운 것 — 되살리지 않고 `excluded` 에 키 id 로 자동 기록**(R2); update 가 더하는 키 = 렌더에 있고 `portions` 에도 `excluded` 에도 없는 키 | 파싱 실패 → `leave+advise`. 성공 → `strip-portion`: **`portions` 에 기록된 키만**(내용 식별은 쓰지 않는다, R3) sha 가 그대로인 것을 뺀다(다르면 남기고 알린다, `excluded` 키는 건너뛴다); `created` 이고 남는 것이 없으면 파일째 `remove` |
| tool | — | — | — | — | 도구 실행 **전에** 기록 sha 와 다른 기록 파일을 백업(N5) → 도구 실행 → 도구가 만든 경로를 `externalFiles` 에 기록 | 도구의 되돌리기(설치 때와 같은 식별자, #573) → 남은 기록 파일에 harness 규칙 |
| advisory | — | — | — | — | 경로만 기록 | `advise` — 경로를 화면에 |

**세 동작의 차이는 함수 인자뿐이다.**

| 동작 | 대상 항목 | `next` | `op` | 확인 |
|---|---|---|---|---|
| install(첫·재실행·CLI 추가) | 이번 spec 이 만드는 항목 전부 | 렌더 결과 | write | 없음(지우지 않는다) |
| update | 기록에 있는 항목 + 릴리즈가 새로 더한 항목(`excluded` 제외) + `displaced` 자리(기록 없음 상태로 `judge` — 템플릿이 바뀌었으면 첫 접촉) | 렌더 결과 | write; 번들에서 사라진 기록 항목은 remove | 없음 — 회수 대상은 "기록에 있고 안 고친 파일"뿐이라 설치자가 잃는 것이 없다(고친 것은 `backup+remove`) |
| `install --reinstall` | install 과 같음 + 이번 spec 에 없는 기록 항목 | 렌더 결과 | write + remove | **있음**(지우는 동작) |
| uninstall(전량) | 기록 전부 + 기록 자체 + `displaced` 되돌리기 | 현재 템플릿 렌더(`no-sha` 판정용, N-e) | remove | **있음** |
| `uninstall --cli X` | `cli-ownership.ts` 표에서 X 전용 + X 가 마지막 사용자인 공유 자리(경로 접두로 판정 — N3) + 그 자리의 `displaced` | 같음 | remove | **있음** |
| `uninstall --only <id>` | tool 항목 id | 같음 | remove | **있음** |

폴더 단위 동작(`backupDir`·`copyBackupDir` — `fs-ops.ts:111-151`)은 어느 동작에서도 부르지 않는다.
백업 이름 규약은 지금 그대로(`<file>.backup-<YYYYMMDDTHHMMSS>[-n]`, `fs-ops.ts:93-105` 원자 선점).

**`displaced` 되돌리기 세부(Q3).** 순서는 "하네스 파일 제거 뒤" 다 — 설치자가 설치 뒤 그 자리의 하네스 파일을 고쳤으면 그 편집은
결정 4 대로 `<file>.backup-<ts2>` 에 남고 원래 설치자 파일이 제자리로 온다(둘 다 남는다). 되돌리기는 백업을 원래 이름으로
**옮긴다**(rename). 되돌린 `displaced` 기록은 지운다. 같은 경로의 `displaced` 는 **마지막 하나**만 둔다(`mergeRootFiles` 의 `notes`
합집합에서 `notes[0]` 이 옛 백업을 가리키지 않게). 자리가 비어 있지 않으면(하네스 파일을 지우지 못함 · 설치자가 새 파일을 둠)
되돌리지 않고 알린다. 백업이 이미 없으면 말한다. 되돌리기는 uninstall 만이 아니라 **하네스가 그 자리를 떠나는 모든 `remove`** 에서
한다 — update 의 은퇴 회수 · `--reinstall` 의 기록 밖 회수 · `--cli`.

**새 파일 종류를 더하는 절차** = manifest 한 줄(`source · target · kind · adapter? · owner`). `judge` 와 세 동작은
바뀌지 않는다. 어댑터가 새로 필요할 때만(지금은 넷, §6.2) 어댑터 하나를 더한다.

---

## 2. 파일 × 동작 표

칸의 뜻: **W** = §1.2 `write` 규칙(첫 접촉 = 백업 후 쓰기, 결정 7) · **R** = 기록에 있는 것만 W(없으면 안 만든다 · 릴리즈 신규는 만든다) ·
**P** = 몫만 upsert(설치자가 지운 키는 되살리지 않는다) · **X** = `remove` 규칙(안 고쳤으면 삭제 · 고쳤으면 `backup+remove`) ·
**S** = 몫만 strip · **T** = 도구 되돌리기 뒤 남은 기록 파일에 X · **A** = 안내만 · **—** = 건드리지 않음 · **∅** = 이 원칙에서
더는 만들지 않는다. 열 `--cli` 는 그 파일의 소유 CLI 가 빠질 때(공유 자리는 마지막 사용자일 때)만 X/S 이고 그 밖은 —.
**굵은 ≠** = 지금 코드와 다른 칸(괄호 = 이슈).

| # | 경로 (출처) | 종류 | install 첫 | install 재실행/CLI 추가 | update | `--reinstall` | uninstall 전량 | `--cli` | `--only` |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `.claude/rules/<r>.md` (`manifest.ts:266-273`) | harness | W | W | R | W | X **≠**(폴더 이동→파일) | X **≠** | — |
| 2 | `.claude/agents/<a>.md` (`manifest.ts:329-353`) | harness | W | W | R | W | X **≠** | X **≠** | — |
| 3 | `.claude/hooks/<h>.sh` (`manifest.ts:398-405`) | harness | W | W | R | W | X **≠** | X **≠** | — |
| 4 | `.claude/skills/<id>/**` 번들 (`manifest.ts:372-395`) | harness(파일 단위) | W | W | R + 번들 밖 파일 X(#477 그대로) | W | X **≠** | X **≠** | — |
| 5 | `.claude/commands/uzys/` 빈 디렉터리 (`fs-ops.ts:220-231`) | — | ∅ **≠** | ∅ | — | ∅ | — | — | — |
| 6 | `.claude/.installed-tracks` (`installer.ts:1079-1084`) | harness | W | W | — | W | X **≠** | X **≠** | — |
| 7 | `.claude/settings.json` (`installer.ts:813-817`, `manifest.ts:408-413`) | **shared** `json-keys` | P **≠**(#563 교체→병합) | P **≠** | P(새 키만; 지금은 죽은 참조 정리만 `update-mode.ts:513-516`) | P **≠**(#563) | S; `created` 면 X **≠** | S **≠** | — |
| 8 | 루트 `CLAUDE.md` (`installer.ts:1094-1116`, `project-claude-merge.ts:263-305`) | shared `marker-md` | P | P | P | P | S | S | — |
| 9 | `CLAUDE-uzys-harness.md` (`manifest.ts:288-293`) | harness | W | W | R(`update-mode.ts:936-988`) | W **≠**(#572 — 지금은 백업 없이 덮음) | X(지금: 고쳤으면 라이브에 남김 → 결정 4) | X | — |
| 10 | `.uzys-agent-harness/{protect-branch,spec-drift-check,check-absence}.sh` (`manifest.ts:298-326`) — 기록 필드 = `externalFiles`(프로젝트 상대, PR-3) | harness | W | W | R | W | X | — | — |
| 11 | `.uzys-agent-harness/.harness-install.json` (`install-log.ts:30,573`) | 기록 자체 | 쓴다 | 쓴다 | 쓴다 | 쓴다 | 지운다(마지막) | 갱신 | 갱신 |
| 12 | `.uzys-agent-harness/update-backups.json` (`update-mode.ts:799-818`) | harness | — | — | 쓴다(백업 0 이면 지운다) | — | X + **남은 백업 경로를 화면에**(#570) | — | — |
| 13 | `.uzys-agent-harness/hook-blocks.log` (훅이 런타임에 씀) | harness(sha 없음) | 기록만 | 기록만 | — | — | X | — | — |
| 14 | `.mcp.json` (`installer.ts:994-1010`, `mcp-merge.ts:58-117`) | **shared** `json-keys` | P **≠**(#574 — 깨진 JSON 은 leave) | P | P **≠**(새 서버만; 지금은 안 건드림) | P | S **≠**(#569) | — (전 CLI 공유, `cli-ownership.ts:44-51`) | — |
| 15 | `.gitignore` (`env-files.ts` `gitignoreRender`) | **shared** `lines` | P(지금도 줄 추가 — **없으면 만들지 않는다**, PR-3) | P | P **≠** | P | S **≠**(#569 확장) | — | — |
| 16 | `.env.example` (`env-files.ts:61-71`) | **advisory**(스캐폴드 — 결정 7) | 없을 때만 쓰고 `rootFiles.change = advisory` 로 기록(지금과 같다) | 같음 | — | 같음 | A(지금과 같다 — 화면 문구를 "yours now" 로, #569 의 "지워도 안전" 불일치 해소) | — | — |
| 17 | `.github/workflows/{ci,ci-python,e2e}.yml` (`ci-scaffold.ts:43-78`) | **advisory**(스캐폴드 — 결정 5·7) | 없을 때만 쓰고 `rootFiles.change = advisory` 로 기록 | 같음 | — | 같음 | A(지금과 같다 — "left for you") | — | — |
| 18 | `AGENTS.md` (`codex/transform.ts:119-154`, `opencode/transform.ts:110-144`, `agents-md-merge.ts`) | shared `marker-md` | P **≠**(#558 — 첫 접촉은 루트 `CLAUDE.md` 모델: 본문 그대로 + 블록 하나) | P | R·P | P | S(하네스가 만든 파일 = 절 걷기 #516 · 첫 접촉 = 기록된 `agents` 블록만 걷는다, PR-4b) | S(마지막 사용자일 때 — 같은 규칙) | — |
| 19 | `.codex/config.toml` (`codex/transform.ts:158-167`, `codex/config-toml.ts`) | **shared** `toml-region` | P **≠**(#563 교체→병합) | P **≠** | P **≠**(지금은 통째 갱신) | P **≠** | S; `created` 면 X **≠**(폴더 이동) | S **≠** | — |
| 20 | `.codex/hooks/session-start.sh` (`codex/transform.ts:170-183`) | harness | W | W | R | W | X **≠** | X **≠** | — |
| 21 | `.agents/skills/<id>/**` 번들 (`codex/skills.ts:84-119`, 3 CLI 공유) | harness(파일 단위) | W | W | R + 릴리즈 신규(`agents-skill-targets.ts`) | W | X(지금도 sha) | X(마지막 사용자) | — |
| 22 | `.agents/rules/uzys-harness.md` (`antigravity/transform.ts:146-180`) | harness | W | W | R | W | X | X | — |
| 23 | `.agents/rules/<r>.md` (`antigravity/transform.ts:108-114`) | harness | W | W | R | W | X | X | — |
| 24 | `opencode.json` (`opencode/transform.ts:147-148`, `opencode-json.ts`) | **shared** `json-keys` | P **≠**(#563) | P **≠** | P **≠** | P **≠** | S(첫 접촉 = 기록된 `mcp.<name>` 만, PR-4b); 하네스가 만든 파일은 지금처럼 기준선 그대로면 X · 고쳤으면 통째로 남김(몫 strip 은 PR-7) | S(같은 규칙, PR-4b) | — |
| 25 | `.opencode/` 디렉터리 (기록 `templates.opencodeDir`, `install-log.ts:173`) | — | ∅ **≠**(#559 — 기록에서 뺀다) | ∅ | — | ∅ | — **≠**(지금은 이동) | — | — |
| 26 | `.opencode/commands/<id>.md` 옛 판 (`opencode/transform.ts:180-196`) | harness(옛 기록) | — | `externalFiles` 에 **있을 때만** 백업+X **≠**(지금은 이름으로 판정 — N4) | 같음 | — | — | — | — |
| 27 | `.claude/skills/<id>` 외부 스킬 (`npx skills add --copy`, `external-installer.ts:434-453`) | tool→`externalFiles` | 도구 실행 + 경로·sha 기록 **≠** | 같음 | 고친 파일 백업 → 도구 재실행(`refreshExternalSkills`) **≠**(N5) | 같음 | T **≠**(지금은 폴더 이동에 실려 감) | — | T |
| 28 | `.agents/skills/<id>` 외부 스킬 (같은 호출) | tool→`externalFiles` | 같음 **≠** | 같음 | 같음 | 같음 | T **≠**(#573 — 남는다) | T(마지막 사용자) | T |
| 29 | `skills-lock.json` (npx skills 가 만듦, 탐색 iter4-uninstall) | advisory | 기록 **≠** | 기록 | — | 기록 | A **≠**(지금 무언급) | — | — |
| 30 | `package.json` devDependencies · `node_modules/` (npm 자산, `external-installer.ts:228-236`) | tool | 도구 | 도구 | — | 도구 | T(`npm uninstall`) | — | T |
| 31 | `~/.claude/plugins/**` · `installed_plugins.json` (plugin, `external-installer.ts:458-483`) | tool | 도구 | 도구 | — | 도구 | T(`claude plugin uninstall --scope project`) | — | T |
| 32 | `_bmad/` · `_bmad-output/` · `.claude/skills/bmad-*` (npx-run, #571) | advisory | **자산 한 단계 단위**로 설치 전후 루트 목록 diff → 경로 기록 **≠** | 같음 | — | 같음 | A **≠**(경로 나열) | — | A |
| 33 | `~/.codex/config.toml` `[projects."<dir>"]` (`codex/trust-entry.ts:19-40`) | tool(홈) | `--with-codex-trust` 시 등록 **≠**(범위 조건 없음 — 결정 2) | 같음 | — | 같음 | A **≠**(지금 uninstall 은 trust 항목을 안내하지 않는다 — PR-7 이 "이 폴더의 Codex 신뢰 항목이 `~/.codex/config.toml` 에 남는다 · 빼려면 …" 한 줄을 낸다, PR-2 리뷰 N4) | — | — |
| 34 | Global scope 자산(`--scope user` · `npx skills -g` · `npm -g`, `external-installer.ts:224-236,447-483`) | tool(홈) — **옛 설치본만** | ∅ **≠**(결정 1 — `--scope global` 은 거절, 대체 명령 안내) | 로그 `scope: global` 이면 받는다(update 와 같게 — 그 설치본의 확인 화면·복구 명령이 `--scope global` 을 찍는다, PR-6) | 로그 `scope: global` 이면 지금처럼 도구 재실행 | ∅ | A(D16, 지금처럼) | — | A |
| 35 | `.mcp-allowlist` 옛 판 (`update-mode.ts:1523-1533`) | harness(옛) | — | — | 백업+X(ADR-072 그대로) | — | — | — | — |
| 36 | `.claude/CLAUDE.md` 옛 앵커 (`update-mode.ts:86,944-946`) | advisory | — | — | A | — | — | — | — |
| 37 | `docs/decisions/` 빈 디렉터리 (`fs-ops.ts:227`) | — | ∅ **≠** | ∅ | — | ∅ | — | — | — |
| 38 | `<file>.backup-<ts>` · 옛 `<dir>.backup-<ts>` (`fs-ops.ts:111-189`) | 설치자 것 | 만든다(고친 파일만) | 같음 | 같음 | 같음 | — + 남은 것 나열 **≠**(#570) | — | — |

**표가 말하는 것**: 행 38개 = harness 15(한 규칙 W/R/X) · shared 7(어댑터 4종) · tool/advisory 11 · 더는 만들지 않는 것 3 ·
기록 자체 1 · 설치자 것(백업) 1. `≠` 칸은 거의 전부 두 축이다 — "폴더 이동·복사 → 파일 하나" 와 "첫 설치 교체 → 몫만".
harness 인데 열마다 예외인 행은 없다 — "없을 때만 쓰는" 스캐폴드 둘(행 16·17)은 advisory 종류라 처음부터 W/R/X 밖이다.

---

## 3. #551 하위 이슈 → 규칙 대응 (누락 0)

`gh api repos/uzysjung/uzys-agent-harness/issues/551/sub_issues` = **18건**(#556–#561 · #563–#574; #562 는 PR — 2차 판
작성 직전 재조회). 아래 표 18행 — 대조 완료. 탐색 원자료에만 있고 이슈로 안 올라온 발견 2건은 표 뒤에 따로 적었다.

| 이슈 | 증상 | 풀리는 규칙 | 표 행 |
|---|---|---|---|
| #556 | update 마다 `.claude/` 전체 백업 | 폴더 백업 폐지 — 고친 파일 하나만(`judge` 의 `backup+overwrite`). `resolveBackupPath`(`installer.ts:516-527`) 삭제 | 1–4 |
| #557 | 체크섬 없던 옛 판 첫 update 가 "편집" 이라 표시 | "기록 있음 · sha 없음" 칸 — 이미 최신이면 `leave`, 다르면 1회 백업 + 문구 "no checksum on record — saved a copy once", 편집 카운트와 **분리** | §1.2 |
| #558 | 첫 설치가 `AGENTS.md` 설치자 절을 스캐폴드로 바꿈 | 기록에 없는 `AGENTS.md` 는 루트 `CLAUDE.md` 와 같은 모델 — 본문 바이트 그대로 + 하네스 절 전체를 마커 블록 하나로 파일 끝에(§6.2 `marker-md`). 하네스가 만든 `AGENTS.md` 는 지금의 절 모델 유지 | 18 |
| #559 | `list` 가 없는 `.opencode/` 를 표시 | `templates.*Dir` 를 더는 쓰지 않는다 — `list` 는 기록 경로만 보여 준다(디스크 존재는 근거가 아니다) | 25 |
| #560 | Global 화면 문구와 실제 불일치 | **결정 1 확정** — Global 선택지를 없앤다(위저드 Scope 단계 삭제 · `--scope global` 거절 + 대체 명령 안내). 옛 global 설치본은 지금처럼 처리(§5) | 34 |
| #561 | TTY 없이 `uninstall` 이 확인 없이 전량 제거 | 규칙: 지우는 동작은 확인, 비 TTY 는 `--yes` 필수(`--cli`·`--only`·`--reinstall` 포함). `shouldRunInteractive`(`uninstall.ts:1222-1227`)의 비 TTY 분기를 "거절 + `--yes` 안내" 로 | §4 |
| #563 | 첫 설치·`--reinstall` 이 settings.json·config.toml·opencode.json 을 교체 | 세 파일을 shared 로 선언 + 어댑터(`json-keys`·`toml-region`) — 동작·판본과 무관하게 같은 함수. `--reinstall` 도 같은 함수 — reinstall 의 폴더 이동 제거를 PR-3 에 앞당겨 중간 판이 원칙 밖에 서지 않게 한다(N2) | 7·19·24 |
| #564 | Antigravity 요약이 룰·스킬 수를 적게 말함 | 화면 숫자는 **이번 실행이 기록에 쓴 항목** 에서 센다(`install-render.ts:389-397` 의 앵커 1줄 + `countSkillDirs` 를 기록 집계로 교체) | §4 |
| #565 | 읽기 전용 폴더에서 스택트레이스 | 원칙 밖(원칙은 "무엇을" 이고 이건 "할 수 있나") — 지우는 동작 공통 **pre-flight**: 첫 쓰기 전에 대상 루트 쓰기 권한 확인, 실패 시 한 줄 + exit 1. 새 가드가 아니라 `--only` 의 pre-flight(`uninstall.ts:176-191`)와 같은 자리 | §4 |
| #566 | 외부 자산 제외가 기록되지 않아 update 가 되살림 | 한 필드 `excluded`(baseline id · 번들 스킬 id · 외부 자산 id · 함께 쓰는 파일의 키 id 전부). `baselineExclude`·`skillExclude` 는 읽기 폴백. `installNewAssets`·`installNewSkillDirs`·`agentsSkillSlot`·`refreshExternalSkills`·어댑터 upsert 가 같은 목록을 읽는다; 빼는 법 안내는 전부 `install … --without <id>`(하네스 파일을 손으로 지운 경우도 같은 누적 규칙 — 예 `--without baseline:agents/reviewer`), 되돌리기는 `--with <id>` | §1.2 |
| #567 | Codex 프로젝트 설치가 trust 없이는 config.toml 을 못 읽는데 화면은 활성이라 함 | **결정 2 확정** — 안내만 + `--with-codex-trust` 를 범위 조건 없이 허용. 화면 규칙: `NEXT` 가 "`.codex/config.toml` is read only after you trust this folder → Trust and continue" 를 말한다 | 19·33 |
| #568 | `opencode.json` 의 MCP 가 항상 빔 | 원천 통일: 두 변환(`codex/transform.ts:106`, `opencode/transform.ts:96`)이 `harnessRoot/.mcp.json`(npm 패키지 `files` 밖) 대신 **템플릿 + 트랙 표에서 렌더한 서버 목록(설치자 파일과 합치기 전)** 을 받는다 — Claude 와 같은 원천이고 PR-3 의 어댑터와 무관(N8). 설치자가 같은 이름(`context7`)을 이미 가졌으면 그 서버는 설치자 것이라 `.mcp.json` 에는 안 더하지만 Codex·OpenCode 파일에는 하네스 판을 넣는다 — 의도(각 CLI 파일의 하네스 몫은 그 파일의 설치자 키로만 판정한다). Codex 쪽 `context7` 하나(iter5b ⑤-대조)는 템플릿 기본 블록이 `mcp === null` 일 때 남던 것 — PR-4 가 템플릿의 기본 블록과 줄 단위 치환(`stripExistingMcpSection`)을 없앴다. 검증은 §7 npm pack 경로 | 14·19·24 |
| #569 | uninstall 이 `.mcp.json` 하네스 서버 · `.gitignore` 줄 · `.env.example` 을 안 뺌 | shared `strip-portion`(`json-keys` · `lines`) — `portions` 에 기록된 키·줄 중 sha 가 그대로인 것만 뺀다. `.env.example` 은 스캐폴드(advisory, 결정 7) — 지우지 않고 uninstall 이 `left for you (yours now)` 로 알린다; #569 의 `.env.example` 불만(화면이 "지워도 안전" 이라 하고 안 지움)은 화면을 사실대로 고쳐 닫는다(R4). 설치자가 값을 고쳤으면 남기고 말한다. **§8 결정 3 확정** | 14·15·16 |
| #570 | 전량 uninstall 이 백업 색인만 지우고 백업 실물은 말없이 남김 | 폴더 백업이 없어져 남는 것은 파일 백업뿐. 백업은 설치자 것이라 지우지 않되, uninstall 마지막 화면이 `*.backup-*` 잔존 경로를 나열한다(색인 삭제 전에 읽어 화면으로) | 12·38 |
| #571 | npx-run 자산이 만든 파일을 uninstall 이 안 알림 | advisory — 자산 한 단계 단위로 설치 전후 프로젝트 루트 목록 diff 를 떠(같은 실행의 npm·skills 산출물을 bmad 몫으로 오인하지 않게) 새 최상위 경로를 기록, uninstall 이 "이 도구의 제거 방법으로" 와 함께 나열 | 32 |
| #572 | `install --reinstall` 이 고친 `CLAUDE-uzys-harness.md` 를 **백업 없이** 덮음(유일한 복구 불가 손실) | `--reinstall` 도 `judge` 를 탄다 — 행 9 의 `backup+overwrite`. 폴더 이동(`backupDir`, `installer.ts:526`)이 없어지면서 "`.claude/` 밖은 스냅샷에 안 든다" 는 구멍 자체가 사라진다 | 9 |
| #573 | uninstall 이 외부 skill 을 지웠다고 말하지만 `.agents/skills/<id>` 가 남음 — `uninstall.ts:815` 가 `remove <source>` 로 부르는데 skills CLI 는 **스킬 이름**으로 색인(실 `skills@1.5.11` 확정) | tool 항목의 되돌리기는 설치 때와 같은 식별자로 조립(`detail.skill` — 기록에 이미 있다, `install-log.ts:310` — 없으면 `source`). 그 뒤 도구가 만든 기록 파일(`externalFiles`)에 X | 27·28 |
| #574 | 설치자 `.mcp.json` 이 깨진 JSON 이면 install 이 백업 없이 템플릿으로 덮음(`mcp-merge.ts:106-117` `catch → return base`) | 어댑터 공통 규칙: 파싱 못 하면 **한 바이트도 쓰지 않고** `leave+advise` — `⊘ left .mcp.json — could not read it (invalid JSON); harness servers not added`. 세 동작 모두 같은 입력을 받으므로 uninstall 도 같은 규칙 | 7·14·19·24 |

**이슈 미등록 탐색 발견 2건** (원자료 → 규칙):

| 출처 | 발견 | 규칙 |
|---|---|---|
| `iter4-uninstall.md` git status · `iter5-uninstall.md` 부수 관측 | `skills-lock.json` 을 화면이 언급 안 함(제거 뒤에도 항목이 남는 것은 skills CLI 자체 문제) | 행 29 advisory |
| `iter5b-update.md` ④ | Codex 훅이 trust 뒤에도 신호 없음(확정 아님) | 원칙 밖 — §10 후속(실 CLI 재확인) |

`.handoff/explore/` 최종 목록(팀 리드 확인): `iter1~5-install` · `iter1~5(+5b)-update` · `iter1~5-uninstall` — 전부 반영.
실 CLI 경계 결과는 `iter5b-update.md` §실 CLI 경계 표로 나왔고 #567 · #568 · §8 결정 2 에 반영했다.

---

## 4. 설치자 화면 · 문서 규칙

**규칙 셋.** ① 화면 줄은 `judge` 의 `line` 에서만 나온다 — 판정과 문구가 한 함수에서 나오므로 "안 한 일을 했다고"
말할 자리가 없다. ② 숫자는 기록에서 센다(이번 실행이 쓴 항목 수 · 백업 수 · 남긴 수). ③ 동사 여섯 — **wrote · refreshed ·
removed · backed up · kept · left for you**(예시 화면도 이 여섯만 쓴다, N6) — 그리고 "빼는 법" 한 줄은 항상 같은 형태
(`uninstall --cli <name>` / `--only <id>` / `install … --without <id>`).

**첫 접촉 문구.** 기록 있음·sha 없음: `no checksum on record — saved a copy once (<n> files)`. "edited" 는 기록 sha 와
다를 때만. 기록 없음·내 파일 있음(결정 7): `✓ backed up  <path> → <path>.backup-<ts> (had a file with this name)`. 스캐폴드:
`⊘ kept  .github/workflows/ci.yml — already there (yours)`.

**확인(#561).** TTY 면 지우는 동작(uninstall 3종 · `--reinstall`)은 실행 전 요약 + `Proceed?`(기본 No). 비 TTY 면
`--yes` 가 없을 때 **아무것도 하지 않고** `ERROR: no terminal — pass --yes to <같은 명령>` (exit 2, `install` 의
"`--track` 필수" 와 같은 형태).

**예시 화면 1 — 기존 프로젝트에 첫 설치(`.claude/settings.json` 에 내 훅, `AGENTS.md` 에 내 절이 있는 상태)**

```
uzys-agent-harness · install     TRACKS tooling   CLI claude · codex

  Harness files
  ✓ wrote      .claude/rules/ 6 · agents/ 2 · hooks/ 2 · skills/ 10 · CLAUDE-uzys-harness.md · .uzys-agent-harness/ 3
  ✓ wrote      .codex/hooks/session-start.sh · .agents/skills/ 10
  Shared files (only the harness part was written — yours stays)
  ✓ wrote      .claude/settings.json   hooks: SessionStart, PreToolUse (your MyOwnHook · statusLine kept)
  ✓ wrote      AGENTS.md               one harness block at the end (your text kept as-is)
  ✓ wrote      .codex/config.toml      [uzys-harness] regions: sandbox · hooks · mcp_servers (your [mcp_servers.myown] kept)
  ✓ wrote      .mcp.json               context7 · github · chrome-devtools (your my-own-server kept)
  ✓ wrote      .gitignore              4 lines
  ✓ wrote      CLAUDE.md               import block
  Backed up    none — nothing of yours was replaced
  NEXT         Open Claude Code — active now.  Codex reads .codex/config.toml only after you trust this folder:
               open Codex in this folder → "Trust and continue"   (headless: agent-harness install … --with-codex-trust)
  Remove       agent-harness uninstall   ·   one CLI: uninstall --cli codex   ·   one asset: uninstall --only <id>
```

**예시 화면 2 — 편집 없는 `update`(조용하다) / 룰 하나를 고친 `update`**

```
uzys-agent-harness · update      TRACKS tooling   CLI claude · codex

  ✓ refreshed  .claude/rules/ 2 · .agents/skills/ 1 · AGENTS.md harness block
  ✓ wrote      .claude/skills/new-skill/   (new in this release)
  Backed up    none
  STATUS       up to date — 3 files refreshed, nothing of yours touched
```
```
  ✓ refreshed  .claude/rules/ 2
  ✓ backed up  .claude/rules/git-policy.md → git-policy.md.backup-20260927T091500 (you edited it)
  Backed up    1 file — list: .uzys-agent-harness/update-backups.json
  NEXT         to carry your edit onto the new version: diff the two files (or ask audit-harness-fit)
```

**예시 화면 3 — 전량 uninstall (TTY 확인 → 결과)**

```
Remove everything?  same as: agent-harness uninstall --yes
  · harness files: 34 removed (2 you edited → kept beside as *.backup-<time>)
  · shared files: harness part removed from .claude/settings.json · AGENTS.md · .codex/config.toml ·
    .mcp.json (context7 · github · chrome-devtools) · .gitignore (4 lines) · CLAUDE.md — your content stays
  · tools: claude plugin uninstall ×1 · npx skills remove ×2 · npm uninstall ×1
  · left for you (not ours): .github/workflows/ci.yml · _bmad/ · _bmad-output/ · skills-lock.json · .claude.backup-20260927T072956/
Proceed? (y/N)
```
```
  ✓ removed    34 harness files · harness part of 6 shared files · 4 tool assets
  ✓ backed up  .claude/rules/git-policy.md → git-policy.md.backup-20260927T101200 (you edited it — removed from live)
  ⊘ left       .github/workflows/ci.yml (created by the harness — yours now) · _bmad/ · _bmad-output/ (bmad-method —
               remove with its own uninstaller) · skills-lock.json (npx skills)
  ⊘ backups    3 from earlier runs still here: .claude.backup-20260927T072956/ … — safe to delete when you're done
  ✓ uninstall complete
```

**문서(PR-10, N11 표면 전부).** README §"Safe on an existing project" 와 §uninstall 문단을 §1.1 한 문단으로 교체.
`docs/USAGE.md`: "Installing into an existing project" 표는 §2 표의 shared 7행 + harness 규칙 1행으로 줄이고, 폴더
이동·복사를 말하는 줄 전부(`:58` `--reinstall` "Moves `.claude/` aside" · `:180` "`update` copies `.claude/`" · `:240` ·
`:248` `--keep-templates` · `:268-273` `--cli` 표의 moved aside 3행 · `:281`)를 고친다. `docs/CONTEXT-FILES.md` §1 은
harness/shared/yours 세 열로.

---

## 5. 이전 설치본 이관 — 이관은 없다

대안 S 의 핵심: 옛 기록을 옮겨 적지 않는다. 검토 B2 가 보인 손실 경로(옛 `policyFiles`·`skillFiles` 는 디스크 스캔 값이라
설치자 파일이 섞여 있고, 그것을 소유 기록으로 승격하면 uninstall 이 백업 없이 지운다)는 이관이 없으면 생기지 않는다.

| 남아 있는 것 | 새 판이 하는 일 | 설치자가 잃는 것 |
|---|---|---|
| 옛 로그의 `policyFiles`·`skillFiles`(옛 판이 디스크를 훑어 적은 값) | 새 판이 로그를 처음 쓸 때 §1.2 의 소유 필터를 **한 번** 건다 — claude 가 `installedClis(log)` 에 있고 · 경로가 기록 트랙에서 나오는 대상이거나 번들 스킬 id · 은퇴 경로(`RETIRED_PATHS`, sha 없음으로 읽음)이며 · `excluded`(옛 `baselineExclude`·`skillExclude` 포함)에 없는 것만 이어받고 `records: "writer"` 를 적는다. 걸린 항목은 "기록 없음"(지우지 않는 쪽). 고르지 않은 트랙의 같은 이름 설치자 파일은 그래서 소유가 아니다. `externalFiles`·`rootFiles` 는 옛 판도 쓰는 순간 적었으므로 필터 없이 그대로 읽는다. `templates.*Dir` 은 안 읽는다(#559) | 없음 |
| 옛 로그의 `baselineExclude`·`skillExclude` | 접근자가 `excluded` 와 합쳐 읽는다. 다음 쓰기부터 `excluded` 로 | 없음 |
| 옛 로그에 없는 함께 쓰는 파일의 몫(`settings.json` 훅 · `.mcp.json` 서버 · `.gitignore` 줄) | 어댑터의 **내용 식별자**로 몫을 찾는다(내용 식별은 **여기서만** 쓴다, R3): `settings.json` 은 하네스 훅 스크립트를 부르는 항목 · `.gitignore` 는 `rootFiles.notes` 의 줄 · `.mcp.json` 은 `rootFiles.change === "created"` 일 때만 템플릿 서버 이름으로(아니면 남기고 알린다). 첫 write 가 `portions` 를 채우고 그 뒤로는 `portions` 만 본다 | 없음 |
| sha 없는 하네스 파일(체크섬 도입 전 판, 로그는 있음) | §1.2 "기록 있음 · sha 없음" 칸 — 이미 최신이면 조용히, 다르면 1회 백업 + "saved a copy once" | 없음(1회 백업 파일) |
| 로그 없음(v26.63 이하 · 지운 경우) | 지금과 같이 install 만 받는다; update·uninstall 은 거절 | 없음 |
| 로그 `scope: global` 설치본(결정 1 이전) | update · uninstall 이 지금처럼 처리한다 — 외부 자산은 도구 재실행 · D16 수동 명령 안내. 새 `install` 만 `--scope global` 을 거절하고 대체 명령을 안내한다 | 없음 |
| v26.161.0 이 만든 `<dir>.backup-<ts>` · update 의 `.claude.backup-<ts>` · 옛 `<file>.backup-<ts>` | **설치자 것** — 어느 동작도 지우지 않는다. `list` 와 uninstall 마지막 화면이 개수·경로를 알린다 | 없음 |
| 옛 `.opencode/commands/<id>.md` | `externalFiles` 에 있을 때만 행 26 규칙(N4); 없으면 건드리지 않는다 | 없음 |
| 옛 판이 **통째로** 쓴 `.codex/config.toml` · `opencode.json`(구간·몫 이전, `externalFiles` 에 sha) | 기준선 sha 그대로면 없던 것처럼 새로 쓴다(몫 형식 — 바꿀 설치자 내용이 없다). 그 뒤 바뀐 `config.toml` 이 하네스 훅(`.codex/hooks/session-start.sh`)을 부르면 **쓰지 않고 알린다** — 어디까지가 설치자 것인지 가를 수 없고 구간을 더하면 같은 훅이 두 번 돈다(PR-4). 그 밖에 몫 기록(`portions`)이 없는 파일은 하네스 구간·키를 **갈아 끼우지 않고 남긴다** — 값이 하네스가 쓴 그대로인지 알 수 없어서, 바꾸면 설치자가 그 안에서 고친 값이 백업 없이 사라진다(PR-4 에서 재현). 첫 write 가 `portions` 를 채운 뒤로 갱신된다 | 없음(기록이 생기기 전까지 그 파일의 하네스 몫은 갱신되지 않는다) |
| 옛 로그로 `uninstall --cli` | `owner` 는 `cli-ownership.ts` 표에서 유도(경로 접두로, N3) | 없음 |

읽기만 하는 명령(`list`·`--dry-run`)은 기록을 고치지 않는다(ADR-096 D3).

---

## 6. 유지보수 구조

### 6.1 지금 흩어진 판정 → 합치는 곳

| 지금 판정이 사는 곳 | 무엇을 각자 정하나 | 합친 뒤 |
|---|---|---|
| `installer.ts:516-527` `resolveBackupPath` | update = 폴더 복사 · reinstall = 폴더 이동 | 삭제 |
| `installer.ts:707-756` `backupEditedPolicyFile`·`backupEditedSkillFiles` | 정책·스킬 파일의 편집 판정 | `judge` |
| `installer.ts:811-827` settings.json 분기(`backupFileIfChanged` + `copyFile`) · `installer.ts:497-503` `healStaleHookRefs` | settings.json 교체 · 사후 죽은 참조 정리 | shared `json-keys` — 하네스 몫은 **이번 선택(제외 반영)으로 렌더**하므로 사후 정리가 필요 없다(N13); `cleanStaleHookRefs` 는 어댑터 안의 판정 하나로 |
| `owned-write.ts:127-160` `createOwnedWriter.write` | 외부 CLI 산출물 판정(표 5행) | `judge` 가 이 표를 **흡수** — writer 는 `judge` 를 부르는 얇은 층 |
| `update-mode.ts:1246-1275` `updateDir` · `1303-1401` `syncSkills` · `1481-1508` `pruneOrphans` | 갱신·회수 판정 3벌 | `judge` (op write / remove) |
| `update-mode.ts:936-988` `syncHarnessAnchor` | 앵커 전용 판정 | 행 9 = 보통 harness 파일 |
| `uninstall.ts:887-921` `removeTemplates` · `993-1038` `removeExternalFiles` · `1168-1174` `rootClaudeMdModified` | 폴더 이동 · sha 회수 · 앵커 판정 | `judge(op: remove)` |
| `mcp-merge.ts:58-117` · `env-files.ts:77-127` · `project-claude-merge.ts:263-305` · `agents-md-merge.ts` | 함께 쓰는 파일 4종의 병합(빼기는 둘만 있음; `mergeUserBase` 는 파싱 실패 시 템플릿으로 덮는다 — #574) | 어댑터 4종 — 각각 `upsert(existing, portion)` / `strip(existing, portion)` 한 쌍 + 공통 규칙(파싱 실패 = leave) |
| `install-log.ts:186-210` 네 필드 + `buildInstallLog` 누적 규칙 · `collectPolicyHashes`·`collectSkillHashes`(`:518-560`, 설치 뒤 디스크 스캔) | 기록 4벌(경로 기준이 셋) · 스캔이 같은 이름의 설치자 파일을 담는다(R1) | 필드는 **그대로** + 접근자 `recorded()` 하나 + `portions` + `excluded`. 스캔 두 함수는 폐지 — writer 가 쓴 것만 적는다(쓰기 = 기록) |
| `cli-ownership.ts:54-79` | CLI 별 소유 표 — `kind: "dir"` 가 통째 회수를 뜻한다 | 표는 그대로, `dir` 의 뜻을 "경로 접두 → 소유 CLI" 로(N3). 회수 방식은 `judge` 가 정한다 |
| `foreign-slot.ts` | 남의 자리 판정 | 그대로 — `judge` 가 먼저 부른다(`foreign` 이면 `leave` + 안내) |

### 6.2 어댑터 4종 (shared 전용)

**공통 규칙 셋.** ⓐ 설치자 파일을 파싱하지 못하면 그 파일은 **한 바이트도 쓰지 않고** `leave+advise`(#574) — 세 동작 모두.
ⓑ 하네스 몫은 **키 단위**로 `portions` 에 기록한다(`{path, adapter, key, sha256}`) — upsert·strip 이 키마다 판정한다(키 sha =
기록 → 갱신/회수 · 다르면 남기고 알린다 · 기록에 없으면 설치자 것). **설치 전에 이미 있던 키는 값이 하네스 판과 같아도 `portions` 에
적지 않는다**(설치자 것) — `portions` 는 하네스가 실제로 더한 키만 담는다(Q3). **strip 은 `portions` 에 기록된 키만 뺀다** — 내용
식별(하네스 스크립트를 부르는 항목)은 옛 로그의 몫 찾기(§5)에만 쓴다(R3). ⓒ 기록에 있는데 파일에 없는 키는 **설치자가 지운 것** —
update 는 되살리지 않고 `excluded` 에 키 id(`mcp:github` · `settings:statusLine` · `settings:hooks.<Event>#<script>` …)로 **자동
기록**한다; update 가 더하는 키 = 렌더에 있고 `portions` 에도 `excluded` 에도 없는 키(R2 — "기록에서 빼기만" 하면 두 번째 update 가
신규로 읽어 되살린다). uninstall 은 `excluded` 키를 건너뛴다. `excluded` 는 **누적한다** — install 의 `--without` 은 더하고, `--with`
만 뺀다; 어느 실행도 이 목록을 새로 계산해 덮지 않는다. `--with`·`--without` 은 모든 id 종류(카탈로그 · `baseline:` · 번들 스킬 ·
키 id `mcp:` `settings:` `opencode:` `gitignore:`)를 받는다(PR-5 에서 `commands/install.ts:195-219` 검증을 id 종류별로 넓힌다 —
지금은 `--with` 가 카탈로그 id 만 받아 경고만 찍는다). 위저드는 `excluded` 를 체크 해제 상태로 보여 준다. 이것은 ADR-074 "제외
없이 다시 깔면 돌아온다" 를 바꾼다 — 되돌리기는 이제 `--with <id>` 하나다(Q2). `gitignore:` 의 주석 줄은 뒤따르는 줄의 몫에 딸리고
따로 id 를 갖지 않는다. ⓓ `upsert∘strip`
의 성질은 어댑터마다 다르다 — `marker-md` · `lines` 는 **바이트 동일**, `json-keys` · `toml-region` 은 **파싱 동치**(들여쓰기·끝
개행은 보존을 약속하지 않는다, N-a).

| 어댑터 | 파일 | 하네스 몫(= `key`) | upsert | strip |
|---|---|---|---|---|
| `marker-md` | 루트 `CLAUDE.md` · `AGENTS.md` | 마커 블록 이름. 루트 `CLAUDE.md` = `import` 블록. `AGENTS.md`: **`recorded === "none"` 인 파일(첫 접촉)** = 설치자 본문 바이트 그대로 + 하네스 절 전체를 블록 하나(`agents`)로 파일 끝에(블록 안에는 마커가 없다 — 앵커는 자기 제목 `## Working Principles` 로, 설치자의 `## Project Rules` 와 이름이 겹치지 않게. 한 번 블록이 된 파일은 계속 블록 · 절 모델 조각 마커가 있으면 기록이 없어도 절 모델, PR-4); **`no-sha`·`sha`(하네스가 만든 파일)** = 지금의 절 모델(ADR-095 D1, `anchor`·`skills` 블록 — 옛 판이 만든 파일을 첫 접촉으로 읽으면 룰이 두 벌 들어간다, N-c) | 지금 코드(`upsertHarnessImport`·`mergeAgentsMd`) + 첫 접촉 분기 | 지금 코드(`stripHarnessImport`·`stripHarnessFromAgentsMd`) + `agents` 블록 제거 — `upsert∘strip` 은 설치자 원본과 바이트 동일 |
| `json-keys` | `.mcp.json` · `opencode.json` · `.claude/settings.json` | 키 경로: `mcpServers.<name>` · `mcp.<name>` · `hooks.<Event>#<하네스 스크립트명>`(핸들러 단위 — matcher 묶음 안 `hooks[]` 의 핸들러 중 `command` 가 이 프로젝트의 `.claude/hooks/<script>` 를 부르는 것(`projectAnchoredRef` 규칙 — 홈 `~/.claude/hooks/` 의 같은 이름은 설치자 것). 같은 묶음의 다른 핸들러는 설치자 몫이고, 묶음은 하네스가 만들었고 비었을 때만 걷는다 — 설치자가 타임아웃 등 필드를 고쳤어도 스크립트가 지워지면 죽은 참조라 **뺀다**, N13) · `statusLine`(없던 경우만, A5). `_comment` · 빈 배열(`PostToolUse: []`)은 몫이 아니다 | 설치자 키가 있으면 그대로, 없는 키만 더한다(`excluded` 키는 더하지 않는다); 배열은 항목 단위 | **`portions` 에 기록된 키만**, sha 가 그대로인 것을 뺀다(설치자 항목이 설치자 스크립트를 부르면 그대로). 단 `hooks` 항목은 `portions` 에 기록된 키면 sha 와 무관하게 뺀다(스크립트가 함께 사라지므로 남기면 죽은 참조다, N-f); 빈 컨테이너 정리 |
| `toml-region` | `.codex/config.toml` | **구간 둘**: 최상위 키 구간(`approval_policy`·`sandbox_mode`)은 **파일 맨 앞**, 표 구간(`[sandbox_workspace_write]`·`[[hooks.*]]`·`[mcp_servers.*]`·`[features]`)은 파일 끝. 각 구간은 `# uzys-harness:<name>:start/end` 로 감싼다(B4) | 구간이 없으면 만든다. 충돌은 TOML **파서로 읽어서** 판정(`smol-toml` — 구간 밖을 파싱한 객체에 같은 키 경로가 명시 · 암묵 · 인라인 · 점 키 어느 형태로든 있으면 그 항목을 뺀다. 쓴 결과를 다시 파싱해 실패하면 쓰지 않는다)(쓰기는 구간 텍스트만): 구간 밖에 같은 최상위 키·같은 `[table]` 이 있으면 그 항목은 구간에서 뺀다(설치자 값 우선, "kept yours: approval_policy"). `[[배열 표]]` 는 더하기만 하고 충돌로 보지 않는다 | 구간 둘만 뺀다 |
| `lines` | `.gitignore` | 줄 원문(헤더 주석 포함) | 없는 줄만 붙인다 | 기록된 줄이 그대로 있으면 뺀다 |

TOML 은 읽기용 파서 하나만 쓴다(직렬화는 하지 않는다 — 구간 텍스트를 그대로 쓴다). 파서는 `smol-toml`(의존성 0 · BSD-3,
번들에 포함) — 외부 의존성 도입이라 ADR-097 Consequences 에 적었다.

### 6.3 새 파일 종류 추가 절차

1. `manifest.ts` 에 한 줄: `{ source, target, type, kind, adapter?, owner }`.
2. shared 이고 새 형식이면 어댑터 하나(`upsert`/`strip` 쌍) 추가 — 그 밖엔 코드 변경 0.
3. §7 의 원칙 테스트가 자동으로 그 행을 돈다(표에서 파생).

---

## 7. 검증 전략 (최소)

**A. 원칙 단위 테스트 — 판정 표 + 어댑터 항등.** `judge` 를 §1.2 표로 돈다: `kind × 기록(none/no-sha/sha) × 디스크 ×
(디스크=next) × (디스크=sha) × op` 의 유효 조합마다 기대 verdict. 어댑터 4종은 `upsert∘strip = 항등` — `marker-md`·`lines` 는
바이트 동일, `json-keys`·`toml-region` 은 파싱 동치(N-a) — + 파싱 실패 입력에서 "한 바이트도 안 쓴다" + 지운 키가 두 번째
update 에도 돌아오지 않는다(R2) + `displaced` 파일이 uninstall 뒤 제자리다(R3). 순열 불변식 테스트는 두지 않는다(N12).

**대체되는 경우별 테스트**(제거·축소 후보 — 판정은 검증 레인): `uninstall-claude-backup.test.ts`(폴더 이동 계약 자체가
사라진다) · `policy-file-ownership.test.ts` · `external-cli-ownership.test.ts` 의 판정 표 부분 · `update-mode.test.ts` 의
백업 폴더 단언 · `backup-symlink.test.ts` 의 `copyBackupDir` 절. 남기는 것: `agents-md-preserve` · `mcp-merge`(어댑터
계약, #574 케이스 추가) · `install-log-clis`·`legacy-log-claude-dir`(옛 로그 유도) · `uninstall-cli-scope`(소유 표).

**B. npm pack 산출물로 설치하는 경로(#568 재발 방지).** `test/docker/Dockerfile` 이 `COPY . /work && npm install -g .`
(`Dockerfile:27-30`) 로 저장소 루트를 하네스 루트로 쓰는 것이 #568 을 못 본 원인이다. 구현(PR-2): 빌드 단계에서 `npm pack`
→ `npm install -g ./uzysjung-agent-harness-*.tgz` 로 바꾼다. `/work` 는 그대로 둔다 — 시나리오가 기대 목록을 `/work/src`·`/work/templates` 에서 유도하고, 설치본은 `/work` 를 읽지 않는다(PR-2 리뷰 N3 확인). 그러면
`files` 밖 파일(`.mcp.json`)을 읽는 코드는 컨테이너에서 곧바로 빈 결과를 낸다. `docker-e2e` 3종(`test.yml:94-104`)이 이
이미지를 쓰므로 새 시나리오 없이 게이트가 선다. 실 CLI 이미지(`Dockerfile.realcli:41-44`)도 같이.

**C. 원칙 시나리오 3개(경우별 시나리오 대체).** 하나의 "설치자 프로젝트 픽스처"(settings.json 훅 · AGENTS.md 자유 본문 ·
`.mcp.json` 서버(+ 깨진 JSON 변형) · `.gitignore` 줄 · `.claude/` 안 자기 파일 · 하네스 자리의 같은 이름 파일)에 ① 첫 설치→
재설치→update ② `--reinstall` ③ uninstall 전량/`--cli`/`--only` 를 돌리고 픽스처 바이트를 대조 — "설치자 바이트는 라이브에
있거나 `<file>.backup-*` 에 있다" 를 여기서 단언한다. `scenario-policy-preserve` · `scenario-external-preserve` ·
`scenario-uninstall*` · `scenario-update-preserves-agents-md` 가 보던 것을 한 픽스처로 본다.

---

## 8. 결정 (전부 확정 — 대기 0건)

사용자 확정(2026-09-27): 1 · 2 · 7. 검토를 거쳐 확정 표기: 3 · 4 · 5 · 6. 결정을 반영하는 PR(N10): 1 → PR-6(Scope 단계 삭제 ·
`--scope global` 거절) · 2 → PR-2 · 7 → PR-1 의 판정 표.

| # | 결정 | 선택지 | 설치자에게 달라지는 것 | 확정과 이유 |
|---|---|---|---|---|
| 1 | **Global scope**(#560) — **사용자 확정: 선택지를 없앤다** | ⓐ 홈에 실제로 쓴다 ⓑ 외부 자산에만 적용하고 문구를 고친다 ⓒ **선택지 삭제 — 항상 프로젝트** | ⓒ: 위저드 6단계 → 5단계(Scope 단계 삭제), `--scope global` 은 새 설치에서 거절 + 대체 안내("외부 자산을 모든 프로젝트에 쓰려면 그 도구를 직접: `claude plugin install --scope user` · `npx skills add -g` · `npm i -g`"). 이미 Global 로 깐 설치본(로그 `scope: global`)은 update·uninstall 이 지금처럼 처리(§5) — 잃는 것 없음 | **ⓒ**. 현재 사실: Project 범위에선 플러그인 `--scope project` · skills 프로젝트 · npm `--save-dev`, Global 에선 셋이 `--scope user` · `-g` · `-g` 로 바뀔 뿐 하네스 파일은 항상 프로젝트다(`external-installer.ts:224-236,447-483`; 변환 3종은 `projectDir` 만 받는다 — `cli-transforms.ts:80-178`). 선택지 하나가 사라지면 README 한 문단에 "하네스 파일은 전부 이 프로젝트 안" 한 구절로 끝난다 — 예외 둘(플러그인 캐시 `~/.claude/plugins/`, `external-installer.ts:461` · `--with-codex-trust` 의 신뢰 한 줄)은 그 문장이 함께 말한다(R5) |
| 2 | **Codex 프로젝트 trust**(#567) — **사용자 확정: 안내만 + `--with-codex-trust` 를 범위 조건 없이 허용**(결정 1 로 범위 자체가 없어져 그냥 옵션이 된다) | ⓐ 확인 뒤 자동 등록(`registerTrustEntry` 재사용) ⓑ 안내만 + 옵션 | ⓐ: Codex 를 열면 바로 동작하지만 하네스가 홈 파일을 하나 더 만진다 ⓑ: 대화형은 Codex 의 첫 실행 프롬프트에서 **"Trust and continue"** 한 번, 비대화형(`codex exec`)은 `--with-codex-trust` | **ⓑ**. 공식 소스: 프로젝트 `.codex/config.toml`(cwd·tree·repo 층)은 "loaded but disabled when untrusted"(`codex-rs/config/src/loader/mod.rs`), trust 미결정이면 TUI 가 직접 묻는다(`codex-rs/tui/src/lib.rs` `should_show_trust_screen`; 프롬프트 문구 "Config, hooks, and exec policies from untrusted folders stay disabled", `trust_directory.rs` — context7 조회, 검토 레인 재확인) · 탐색 iter5b ③·③-b 실측 일치. 하네스가 대신 켜면 sandbox·approval 까지 설치자 승인 없이 켜지는 셈이라 ADR-002 D4 의 "사용자 확인" 은 Codex 자신의 화면에 맡긴다 |
| 3 | **uninstall 이 `.mcp.json` 하네스 서버를 뺄 때**(#569) — **확정** | ⓐ 기록된 서버 중 sha 가 그대로인 것을 뺀다 ⓑ 남기고 안내만(지금) | ⓐ: 설치자가 그 서버를 자기 것처럼 쓰고 있었다면 uninstall 뒤 서버 3~5개가 사라진다 — 잃는 것은 하네스 기본값 3~5줄 | **ⓐ**, 확인 화면·`--dry-run` 에 서버 이름 나열. 전제 = `portions`(서버별 기록) · 옛 로그는 `created` 일 때만(§5) · 지운 키는 `excluded` 로(§6.2 ⓒ) |
| 4 | **uninstall 때 설치자가 고친 하네스 파일** — **확정** | ⓐ `backup+remove` ⓑ 라이브에 남기고 "kept — modified"(지금 외부 산출물·앵커, `uninstall.ts:1012-1015`) | ⓐ: uninstall 뒤 하네스 룰이 하나도 활성으로 남지 않는다(`.backup-<ts>` 접미사는 CLI 가 로드하지 않는다); 편집분은 옆 파일에 | **ⓐ** — 원칙 문장("쓰고 치운다 · 고쳤으면 그 파일 하나만 백업")을 그대로 읽은 것이고 install·update 와 같은 문장이라 규칙이 하나다. README 에 한 구절(§1.1 "lives on only in that backup") |
| 5 | **`.github/workflows/` 스캐폴드의 소유** — **확정(검토 대안 = 결정 7 의 스캐폴드 규칙)** | ⓐ harness 파일(안 고쳤으면 uninstall 이 지운다) ⓑ advisory — 넘겨준 파일, uninstall 이 지우지 않고 "left for you" 로 알린다 | ⓑ: 손 안 대고 커밋해 쓰는 CI 가 uninstall 로 사라지지 않는다 | **ⓑ**. 템플릿 머리말이 "it is yours after install" 이라 약속하고(`templates/github-workflows/ci-node.yml:3`) 본문은 FILL 없이도 도는 CI 다 — 지우면 다음 태그에서야 드러난다. advisory 는 이미 있는 종류라 예외 행이 생기지 않는다. ADR-037 안전 계약은 그대로 |
| 6 | **`--keep-templates` 플래그** — **확정** | ⓐ 폐지 ⓑ 뜻 재정의 | ⓐ: 스크립트에 쓴 설치자는 거절 메시지를 받는다 — 메시지가 기록에서 계산한 **실제 대체 명령**(`uninstall --only a,b,c`)을 찍는다 | **ⓐ**. 폴더 단위 동작이 없어 뜻이 사라진다; 제거 화면의 "Remove selected assets" 가 같은 일이다 |
| 7 | **하네스 자리에 기록 없는 설치자 파일이 있을 때**(첫 접촉 — B6) — **사용자 확정: 백업 후 바꾼다** | ⓐ 그 파일 하나를 `<file>.backup-<ts>` 로 두고 하네스 것을 쓴다 ⓑ 건드리지 않고 알린다 | ⓐ: 설치가 고른 자산을 빠짐없이 깔고 설치자 바이트는 백업에; 화면 "had a file with this name — saved as …"(편집이라 부르지 않는다) | **ⓐ** — 사용자 이유 "업데이트된 버전은 덮어써야 된다". README 는 "it is saved beside itself the same way first" 한 구절. **예외 = 스캐폴드**(`.github/workflows/*` · `.env.example`): 설치 뒤 설치자 것이 되는 1회용 생성물(ADR-037)이라 advisory 로 분류 — 없을 때만 한 번 쓰고 덮어쓰지도 갱신하지도 지우지도 않는다(사용자 이유가 스캐폴드엔 해당하지 않고 설치자 CI 를 지킨다). 결정 5 가 같은 규칙으로 풀린다 |

---

## 9. 구현 분할 — 설치자 장면 × PR

| 마일스톤(설치자 장면) | PR | 내용 | 닫는 이슈 | 의존 | 병렬 |
|---|---|---|---|---|---|
| **M0 공용 계약** | PR-1 | `judge` + 어댑터 인터페이스 + `portions` · `excluded` 필드 + 접근자 `recorded()` + 원칙 단위 테스트(§7A). 옛 필드는 그대로, 이관 없음. 동작 변경 0 | (#566 의 기록 절반) | 없음 | **먼저** |
| **M4 깐 것이 CLI 에서 실제로 동작한다** | PR-2 | 두 변환의 MCP 원천 = 템플릿 + 트랙 표에서 렌더한 서버(설치자 파일과 합치기 전, N8) + Docker `npm pack` 경로(§7B) + NEXT 문구(trust, "Trust and continue") + `--with-codex-trust` 범위 조건 해제(결정 2). **첫 릴리즈에 넣는다**(N9 — #568 은 지금 깨진 기능) | #568 · #567 | 없음 | PR-1 과 병렬 |
| **M1 처음 깔아도 내 설정이 남는다** | PR-3 | **install·`--reinstall` 의 하네스 파일 쓰기가 `judge` 를 탄다**(N-b — 첫 접촉 `backup+overwrite` + `displaced` 기록 · `installCliNeutralAssets` 의 무백업 쓰기 · 앵커 #572 · 쓰기 = 기록 — 스캔 두 함수는 install 경로에서 끊고 **삭제는 PR-5**(update 가 `refreshPolicyBaseline`·`refreshSkillBaseline`·`recordNewSkillBaseline` 으로 아직 부른다, `update-mode.ts:1433·1457·881`) · 옛 스캔 필드에 소유 필터 1회 + `records: "writer"`, Q1) + 어댑터 `json-keys`(settings.json · `.mcp.json` — `opencode.json` 은 CLI 변환 쪽이라 PR-4) + `lines`(`.gitignore`) + 공통 규칙(파싱 실패 = leave · 지운 키 → `excluded` · `excluded` 누적(덮어쓰지 않는다)) — `resolveBackupPath` 의 reinstall 폴더 이동(`installer.ts:526`)을 여기서 없애 `--reinstall` = "install 과 같은 쓰기"(기록 밖 항목 회수는 PR-9). 중간 판에서도 reinstall 이 settings.json·앵커를 병합·백업한다(N2). **구현 뒤 사실**: `excluded` 는 기록만 누적하고 install 의 트랙 베이스라인 선택은 여전히 이번 `--without` 으로 거른다(`--with baseline:` 이 없는 동안 되돌릴 길이 없어서 — 존중은 PR-5). uninstall 은 표시만 맞췄다(옮겨 둘 폴더 안 기록을 "남는 것" 으로 예고하지 않기 · `.uzys-agent-harness/` 기록은 디렉터리째 지우는 지금 동작에 맡기기) | #563(settings.json) · #572 · #574 | PR-1 | PR-4 와 병렬 |
| | PR-4 | CLI 변환 쪽 함께 쓰는 파일 셋: 어댑터 `toml-region`(`.codex/config.toml`, 구간 둘 + 파서 읽기) + `json-keys`(`opencode.json` — 하네스 MCP 키만, CLI 변환이 쓰는 파일이라 PR-3 에서 옮겼다) + `marker-md` 첫 접촉(`AGENTS.md` = 루트 `CLAUDE.md` 모델). `runCliTransforms` 가 몫 · 지운 키 id 를 돌려준다. 후속 PR-4b(첫 릴리즈 전 필수 — PR-4 리뷰 R1 · R2): 몫 왕복(install 은 `composeWriterLog` 로 · update 는 변환을 부르는 자리에서 기록) + uninstall 이 첫 접촉 파일의 기록된 몫만 걷는다(`AGENTS.md` 의 `agents` 블록 · `opencode.json` 의 `mcp.<name>`; 기록이 없으면 지우지 않고 한 줄로 알린다). `.codex/config.toml` 구간 strip 은 폴더 이동 폐지와 함께 PR-7 | #563(config.toml · opencode.json) · #558 | PR-1 | PR-3 과 병렬 |
| **M2 갱신이 조용하고 정직하다** | PR-5 | `update` 가 `judge` 를 탄다: 폴더 백업 폐지 · 첫 접촉 문구 · `excluded` 한 목록 존중(지운 파일 자동 기록 Q4 — 누적 규칙은 PR-3) · `--with`/`--without` 이 모든 id 종류를 받도록 `commands/install.ts:195-219` 확장 · 스캔 두 함수 삭제 · 릴리즈 신규/되살림 문구 | #556 · #557 · #566 | PR-3 · PR-4(`update-mode.ts` 쓰기 경로를 함께 바꾼다 — 검토 판정대로 뒤에) | |
| | PR-6 | 화면 숫자 = 기록 집계 · `list` = 기록 경로 · `templates.*Dir` 미사용 · **결정 1**: 위저드 Scope 단계 삭제(6→5단계, `wizard-steps.ts` · `interactive.ts:346-400`) · `--scope global` 거절 + 대체 명령 · 화면 `SCOPE` 행 삭제 | #564 · #559 · #560 | PR-1 | PR-3/4 와 병렬 |
| **M3 빼면 깨끗이 빠진다** | PR-7 | uninstall 3종이 `judge(remove)` 를 탄다: 폴더 이동 폐지 · shared strip(#569 — `.mcp.json` · `.gitignore` · `.codex/config.toml` 구간 · 하네스가 만든 `opencode.json` 의 몫; `portions` 키만. 첫 접촉 `AGENTS.md` · `opencode.json` 은 PR-4b 가 먼저 했다) · 고친 파일 `backup+remove`(결정 4) · `displaced` 파일 제자리 되돌리기(R3) · 백업 잔존 나열(#570) · `--keep-templates` 폐지(결정 6) · `cli-ownership` `dir` 재정의(N3) | #569 · #570 | PR-3 · PR-4 | |
| | PR-8 | 지우는 동작 공통 확인·`--yes`·pre-flight(쓰기 권한) — uninstall 3종 + `--reinstall` | #561 · #565 | PR-7(같은 파일 `uninstall.ts` — 순차) | |
| | PR-9 | `--reinstall` 의 나머지 = 이번 spec 에 없는 기록 항목 remove(확인은 PR-8) · tool 항목의 되돌리기 식별자(`detail.skill`)·경로 기록·회수·재실행 전 백업(N5) · advisory 문구(npx-run · `skills-lock.json` · 스캐폴드 `.github/workflows/*` · `.env.example` "yours now" — #569 의 `.env.example` 몫, R4) | #571 · #573 | PR-7 | PR-8 과 병렬 가능(다른 파일) |
| **문서** | PR-10 | README 한 문단 · USAGE(N11 목록 전부) · CONTEXT-FILES · 루트 `CLAUDE.md` §설치자 디스크 절의 "설치자 파일(기록에 없는 것): 건드리지 않는다" 줄을 결정 7 로 현행화(N-d) · CHANGELOG. ADR-097 Consequences 현행화 | — | M1~M3 | 마지막 |

#551 마지막 코멘트의 장면 5개(팀 리드)와의 대응: 처음 깔아도 남는다 = M1(#572 포함) · 갱신 = M2 · 빼기 = M3 ·
CLI 실동작 = M4 · **화면이 사실대로 말한다** = PR-6(#559 · #564 · #560) + PR-2 문구 — 다섯째 장면은 별도 마일스톤이 아니라
각 PR 의 화면 규칙(§4)으로 흡수했다(화면 줄이 `judge` 에서 나오므로 따로 고칠 자리가 없다).

순서: **PR-1 ‖ PR-2 → (PR-3 ‖ PR-4 ‖ PR-6) → PR-5 → PR-7 → (PR-8 ‖ PR-9) → PR-10.**

**머지 전 독립 리뷰 문턱(ADR-094) 위** = PR-3 · PR-4(update 쓰기 경로 · 첫 접촉 병합 — B3·B4·B5 의 손실 경로가 여기 산다) ·
PR-5 · PR-7 · PR-8 · PR-9, 그리고 `portions` 를 디스크에 쓰는 판이면 PR-1(그 기록이 나중 uninstall 의 삭제 근거가 된다). 그
밖(PR-2 · PR-6 · PR-10)은 CI 만.

릴리즈: 첫 릴리즈 = PR-1 · PR-2 · PR-3 · PR-4 · PR-6 뒤(첫 설치·reinstall 이 안전 + OpenCode MCP 가 산다; 이 판의 uninstall 은
여전히 폴더째 옮기므로 새 병합 결과도 백업에 남는다 — 설치자를 지금보다 불리하게 두지 않는다, N9), 둘째 = M3 뒤.

---

## 10. 더 단순한 대안(제시만 — 초안 기준으로 설계했다)

**함께 쓰는 파일 수를 줄인다.** `.gitignore` 4줄과 `.env.example` 은 하네스가 "자기 산출물을 무시하라" 는 한 줄
(`.uzys-agent-harness/`)만 남기고 나머지(`.env` · `.factory/` · `.goose/` · Supabase 예시)를 그만 쓰면 shared 7 → 6,
harness 행 하나가 준다 — 그 줄들은 하네스 자산이 아니라 남의 도구·설치자 프로젝트의 관심사다(`env-files.ts:97-104` 의
근거는 2026-05 사용자 보고 #3 하나). 결정이 필요한 것이라 §8 에 넣지 않고 여기 둔다.

**후속 제안(원칙 밖, 한 줄씩)**: ① `skills remove` 가 성공해도 `skills-lock.json` 항목이 남는 것(iter5-uninstall 부수
관측)은 skills CLI 자체 문제 — 하네스는 advisory 로만 알린다(행 29) ② Codex 훅이 trust 뒤에도 안 도는 신호(iter5b ④)
실 CLI 재확인 — `[[hooks.session_start]]` 형식 자체가 현 Codex 판과 맞는지 ③ `docs/decisions/` · `.claude/commands/uzys/`
빈 디렉터리 생성 중단(행 5 · 37).

---

## 11. 가정

- **A1** "고친 것은 그 파일 하나만 백업" 을 uninstall 에서 `backup+remove` 로 읽었다(§8 결정 4 — 확정).
- **A2** 릴리즈가 번들에서 뺀 하네스 파일을 update 가 회수하는 것(지금 `pruneOrphans`)은 "지우는 동작" 이 아니라 갱신의
  일부로 두었다 — 회수 대상이 기록에 있고 안 고친 파일뿐이라 설치자가 잃는 것이 없다. 고친 것은 `backup+remove`. README
  문단이 이 사실을 한 구절로 말한다("retired ones are removed then").
- **A3** (삭제 — B5. 첫 접촉 `AGENTS.md` 는 루트 `CLAUDE.md` 모델이다, §6.2.)
- **A4** tool 항목이 만든 경로의 기록은 "자산 한 단계 단위 설치 전후 diff"(npx-run) 와 "알려진 자리 스냅샷"(skill:
  `.claude/skills/<id>` · `.agents/skills/<id>`) 두 방식이다 — 도구가 무엇을 쓰는지 하네스가 사전에 모르기 때문이다.
- **A5** 어댑터 `json-keys` 에서 `statusLine` 은 설치자 값이 있으면 절대 바꾸지 않고, 없어서 하네스가 넣은 경우만 기록·회수한다.
  설치자가 그 값을 지우면 §6.2 ⓒ 대로 되살리지 않는다.
- **A6** `.uzys-agent-harness/` 디렉터리는 하네스 파일만 담는다는 전제로 uninstall 이 기록 파일을 지운 뒤 빈 디렉터리를
  걷는다 — 설치자 파일이 들어 있으면 디렉터리는 남기고 말한다.
- **A7** 검증 레인이 §7 의 "대체되는 테스트" 목록을 실제 삭제 여부까지 판정한다 — 이 문서는 후보만 낸다.
- **A8** `recorded()` 의 "기록 있음 · sha 없음" 판정은 `claudeManaged`(`update-mode.ts:426-436`)와 같은 근거를 다른 CLI 로
  일반화한 것이다(`installedClis(log)` ∋ 그 파일의 소유 CLI). 로그가 그 CLI 를 말하지 않는 파일은 `none` 이다.

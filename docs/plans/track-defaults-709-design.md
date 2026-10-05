# 트랙 기본값 정리 설계 — data·tooling 의 frontend-design 해제 · ssr-nextjs 의 Vercel 기본 · Railway 선택 (#709)

- 작성: 2026-10-05 · 기준 커밋 main `9e12eba` · 브랜치 `fix/track-defaults-709`
- 메인테이너 결정(고정, 재론 안 함): ① `data` · `tooling` 은 `frontend-design` 을 미리 체크하지 않는다 ② `ssr-nextjs` 는 Vercel 이
  미리 체크되고 Railway 는 선택(미리 체크 안 함 · 고를 수는 있음) ③ `full` · `csr-*` · `ssr-htmx` 의 기본값은 이번에 건드리지 않는다.
- 이 문서만 읽고 구현할 수 있게 쓴다 — 바뀌는 파일 · 조건 · 경로별 동작 · 테스트 · ADR. 외부 사실은 §2 의 출처로 확인한 것만 적는다.

## 0. 한눈에

| 항목 | 결정 | 이유 |
|---|---|---|
| "Vercel 기본"의 실체 | **`vercel-cli` 자산을 `ssr-nextjs` 에서 미리 체크**(조건 `opt-in` → `any-track: ["ssr-nextjs"]`). Vercel MCP 는 이번에 넣지 않는다 | Vercel MCP 는 **원격(HTTP) + OAuth** 서버다(§2.1). 이 리포의 `.mcp.json` 조립은 **stdio(command/args)만** 만든다(§2.3) — 넣으려면 트랙 표 형식 · 렌더러 3곳 · 첫 사용 인증 안내가 함께 바뀌어야 하고, 그건 이 이슈의 "기본값 정리" 범위가 아니다 → 후속 이슈(§8) |
| Railway 를 "선택"으로 두는 경로 | **기존 경로 없음**(§1.3). 가장 작은 새 경로 = 카탈로그에 `railway-mcp-server` 항목(`kind: "internal"`, `opt-in`)을 두고, `.mcp.json` 렌더가 **트랙 표의 기본 행 ∪ 선택된 행**을 내게 한다. 트랙 표의 railway 행은 패턴에서 `ssr-nextjs` 만 뺀다 | 카탈로그 항목이면 위저드 3단계 · `--with/--without` · 기록 · 화면 · COMPATIBILITY 표를 **그대로** 탄다. `ci-scaffold` 가 같은 모양(`internal` + `opt-in` + `isAssetSelected` 게이팅, `src/installer.ts:589`)이다 |
| 기존 설치 보호 | `update` 는 **기록**으로 판정한다 — frontend-design 은 `log.assets`(`refreshExternalSkills`), railway 는 `log.portions` 의 `.mcp.json` 키 | §4 에 코드 근거. 렌더가 기록된 서버를 빼면 `planUpsert` 가 그 키를 **지운다**(`src/adapters/contract.ts:181`) — 그래서 렌더 규칙에 "기록된 선택 행은 넣는다" 가 반드시 들어간다 |
| ADR | **ADR-101 신설**(ADR-063 의 `vercel-cli` 줄만 Amends · "MCP 서버에 opt-in 경로가 없다" 는 전제 변경) | §9 |

## 1. 현재 코드 (실측 · 신뢰하지 말고 여기서 다시 확인)

### 1.1 frontend-design
- `src/external-assets.ts:521-529` — `condition: { kind: "any-track", tracks: DEV_TRACKS_WITH_STACK }`.
  `DEV_TRACKS_WITH_STACK = TRACKS.filter(t => t !== "base" && hasDevTrack([t]))`(`:127`) = csr-supabase · csr-fastify · csr-fastapi ·
  ssr-htmx · ssr-nextjs · **data** · **tooling** · full.
- `src/track-match.ts:21-23` `hasUiTrack` = `csr-*|ssr-*|full` — 바로 "스택에 UI 가 있는 트랙" 이고 아직 자산 조건으로는 안 쓴다.
- 미리 체크 = `recommendedExternalAssets`(`src/preset-recommend.ts:19`) → `filterApplicableAssets` → `shouldInstallAsset`
  (`src/external-assets.ts:1113`; `forceExclude > forceInclude > tier(experimental 는 false) > condition`).

### 1.2 Vercel
- `vercel-cli` `src/external-assets.ts:474-484` — `tier: "vetted"`(vercel/vercel 15k) · `condition: { kind: "opt-in" }`(ADR-063) ·
  `method: { kind: "npm", pkg: "vercel", version: "54.17.3" }`. npm 자산은 `installOne` 이 `npm install --save-dev vercel@54.17.3`
  을 돌린다(`src/external-installer.ts:331-344`). 도달 범위 = 4 CLI(`assetCliSupport`, npm 은 CLI 무관).
- `netlify-cli`(ADR-035) · `supabase-cli` 는 그대로 opt-in.

### 1.3 Railway MCP — 선택 경로가 **없다**
- 서버 정의는 `templates/track-mcp-map.tsv` 한 줄: `railway-mcp-server\tcsr-supabase|csr-fastify|csr-fastapi|ssr-htmx|ssr-nextjs|full\tnpx\t["-y", "@railway/mcp-server"]`.
  형식은 `name · pattern · command · args_json` 4열(`src/mcp-merge.ts:24-50 parseTrackMcpMap`) — "선택" 표시 열이 없다.
- 렌더 = `renderHarnessMcp(harnessRoot, tracks)`(`src/cli-transforms.ts:132`) → `composeMcpJson` → `mergeMcpServers(base, rows, tracks)`:
  **트랙 패턴만** 본다(`src/mcp-merge.ts:62`). 같은 값이 `.mcp.json`(`writeMcpShared`, `src/install-writes.ts:738`) · Codex
  `[mcp_servers.*]` · `opencode.json` `mcp` 로 간다(#568 — `src/cli-transforms.ts:206-210` `harnessMcp()`).
- `--with mcp:<name>` 은 **기록된 빼기를 푸는 일만** 한다 — "기본으로 깔리는 것이라 추가할 것은 없다"(`src/commands/install.ts:262-263`,
  `:322-323`). 키 id 는 **이번 렌더에 있을 때만** 받는다(`isRenderedKey`, `:280-284` → `renderedKeyIds`, `src/key-ids.ts:30`).
  즉 패턴이 안 맞는 트랙에서 `--with mcp:railway-mcp-server` 는 "모르는 키" 경고로 끝난다.
- 위저드는 키 id 를 내지 않는다(설계 G2, `src/commands/install.ts:252-253`). 3단계 목록 = `asset:<카탈로그 id>` + `baseline:` 뿐
  (`initialTargetSelection`, `src/interactive.ts:142-153`).
- `src/external-assets.ts:579-582` 의 flowbite 기각 주석이 이 사실을 적어 두었다: "`.mcp.json` 조립은 트랙 조건만 읽어 opt-in 경로가 없다".
  이번 변경이 그 전제를 바꾼다(주석도 고친다).

### 1.4 기록과 `update` 가 무엇을 지키나
- 외부 **스킬** 자산: `refreshExternalSkills`(`src/external-installer.ts:465-512`)는 **`log.assets` 에 적힌 skill 자산만**
  `forceInclude` 로 다시 받는다 — "트랙·옵션에서 다시 유도하지 않는다 … 조건 불일치로 조용히 빠지지 않게"(`:454-457`). `excluded` 에 있으면 제외(`:481`).
  `pruneOrphans`(`src/update-mode.ts:2216`)는 `templates/` 에 원본이 있는 파일만 기준선에 넣으므로(`collectSkillHashes`, `src/install-log.ts:637-650`)
  외부 스킬 폴더(`.claude/skills/frontend-design/`)는 **지우지 않는다**.
- **함께 쓰는 파일**(`.mcp.json` 등): `writer.shared` → `adapter.upsert` → `planUpsert`(`src/adapters/contract.ts:140-203`).
  기록된 키가 파일에 있고(`now === sha`) **렌더에 없으면 `plan.remove`**(`:181`) — 화면은 `retired`(`src/install-writes.ts:~356`).
  기록된 키가 렌더에 있으면 `replace/kept`(`:171-178`); 파일에 없으면 되돌린다(`:191`). 빼기는 `excluded` 의 키 id 로만(`:12-14`).
- `update` 의 트랙 = 기록(`buildUpdateSpec`, `src/update-mode.ts:407-429`; `withRecordedExclusions`). update 는 "자산 재설치 없음"
  (`src/commands/update.ts:12-14`) — `runExternalInstall` 을 돌리지 않고 `refreshExternalSkills` 만 돈다.
- `install` 의 선택 = 그 실행의 입력(ADR-099 · `thisRunExclusions`, `src/install-writes.ts:457-476`). `--with X` 는 선택 기록에 들지 않고
  "깐 것은 `assets`(누적)가 기억하고 update 는 `assets` 를 갱신한다"(`docs/plans/selection-record-design-2026-10-04.md` §3). 이 모델을
  MCP 행에도 그대로 쓴다 — 단 `internal` 자산은 `log.assets` 에 들어가지 않으므로(`selectExternalTargets` 가 internal 을 거른다,
  `src/external-installer.ts:199-201`) 기억은 **`.mcp.json` 몫 기록(`log.portions`)** 이 맡는다.

## 2. 외부 사실 (공식 출처 · 2026-10-05 조회)

### 2.1 Vercel MCP — 공식 · 원격 · Streamable HTTP · OAuth
- 출처 <https://vercel.com/docs/agent-resources/vercel-mcp> (canonical, last_updated 2026-09-15):
  "Vercel MCP is Vercel's official MCP server. It's a remote MCP with OAuth … available at: `https://mcp.vercel.com`" ·
  "implements the latest MCP Authorization and Streamable HTTP specifications" · Claude Code 설정 =
  `claude mcp add --transport http vercel https://mcp.vercel.com` 뒤 `/mcp` 로 인증 · Codex = `codex mcp add vercel --url https://mcp.vercel.com`
  (OAuth 브라우저) · OpenCode = `opencode.json` 의 `{"type":"remote","url":"https://mcp.vercel.com"}` · "Vercel MCP only supports AI clients that have been reviewed and approved" (Claude Code · Codex CLI · OpenCode 포함, Antigravity 는 목록에 없음).
  로컬 stdio 패키지는 없다 — Gemini 쪽만 `npx mcp-remote https://mcp.vercel.com` 브리지를 안내한다.
- Claude Code 쪽 `.mcp.json` 원격 형식(<https://code.claude.com/docs/en/mcp>): `{"mcpServers":{"x":{"type":"http","url":"https://…"}}}`,
  인증은 `/mcp` 또는 `claude mcp login <name>`.
- `vercel mcp` 명령(<https://vercel.com/docs/cli/mcp>, 2026-05-29): Claude Code · Cursor · VS Code 의 클라이언트 설정을 직접 써 준다("The command does not deploy any MCP server of your own. It only adjusts the client-side configuration") · 비대화형은 `--clients` 필수.
  → `vercel-cli` 를 깔아 주면 설치자는 **공식 도구로** Vercel MCP 를 한 줄로 붙일 수 있다. 이번 변경은 그 사실을 자산 설명에 적는 데까지만 한다.

### 2.2 Vercel CLI — 공식 npm 패키지 `vercel`
- 출처 <https://vercel.com/docs/cli> (2026-09-17): "Installing Vercel CLI … `npm i -g vercel`" · 업데이트는 `npm i -g vercel@latest` · CI 는 `VERCEL_TOKEN`.
  카탈로그는 `--save-dev`(ADR-020 project scope) 로 핀 설치한다 — 공식 문서의 전역 설치와 범위만 다르고 패키지는 같다.
- `npm view vercel version` = **62.2.0**(2026-10-05). 카탈로그 핀 `54.17.3` 과의 차이는 catalog-verify(월 1회)의 영역 — **이번 범위 아님**(§10 가정).

### 2.3 Railway MCP — 트랙 표가 가리키는 패키지는 상류가 **보관(archived)** 상태
- `gh api repos/railwayapp/railway-mcp-server` (2026-10-05): `archived: true` · stars 190 · MIT · 마지막 push 2026-05-23.
  `npm view @railway/mcp-server version` = 0.1.12.
- Railway 공식 문서 <https://docs.railway.com/ai/mcp-server>: "The server runs at `mcp.railway.com`" · 연결은 **CLI 경유**(`railway mcp`,
  CLI ≥ 5.44.0, `railway login` 자격 재사용, stdio) 또는 **OAuth**(`https://mcp.railway.com`) · 로컬 서버는 `railway mcp local`.
  → 트랙 표의 `npx -y @railway/mcp-server` 는 **옛 경로**다. 다른 트랙의 기본값을 안 바꾸는 이번 범위에서는 행의 명령을 그대로 두고,
  명령 교체(`railway` + `["mcp"]`, Railway CLI 선행 필요)는 후속 이슈로 올린다(§8). 선택 항목은 **같은 행을 가리키므로** 정의는 하나다.
- 이 리포의 `.mcp.json` 조립이 stdio 만 내는 근거: `McpServerConfig`(`src/mcp-merge.ts:5-10`) 는 `command`·`args` 필수 · Codex 렌더러는
  `command = …` / `args = …` 두 줄만 낸다(`src/codex/config-toml.ts:125-127`) · OpenCode 는 `toLocal(cfg)`(`src/opencode/opencode-json.ts:53-57`).

## 3. 바뀌는 것 (파일 · 조건)

### 3.1 `src/external-assets.ts`
1. **frontend-design** 조건: `DEV_TRACKS_WITH_STACK` → `UI_TRACKS` (**새 상수**, 열거하지 않고 유도: `TRACKS.filter(t => hasUiTrack([t]))`
   = csr-supabase · csr-fastify · csr-fastapi · ssr-htmx · ssr-nextjs · full). `DEV_TRACKS_WITH_STACK` 은 다른 사용처가 없으면 지운다
   (지우기 전에 `grep -n DEV_TRACKS_WITH_STACK src tests docs` — `docs/REFERENCE.md:34` 가 이름을 적고 있다, §6). 설명 문구의 "all dev tracks except base" 류는 없음(설명은 그대로).
2. **vercel-cli** 조건: `{ kind: "opt-in" }` → `{ kind: "any-track", tracks: ["ssr-nextjs"] }`. 주석의 "2026-08-02 … opt-in (ADR-063)" 줄을
   "2026-10-05 #709 · ADR-101 — ssr-nextjs 기본" 으로 바꾼다. 설명 끝에 한 문장: "Pre-checked on ssr-nextjs. `vercel mcp` then wires Vercel's official MCP (OAuth) into Claude Code".
   `full` 에는 넣지 않는다(결정 ③ · §10 가정 A1).
3. **railway-mcp-server 항목 신설** (`ci-scaffold` `:214-223` 와 같은 모양):
   ```ts
   {
     id: "railway-mcp-server",
     tier: "experimental", // railwayapp/railway-mcp-server 190★ · archived 2026-05 (gh api 2026-10-05)
     description:
       "Railway MCP server (`npx -y @railway/mcp-server`) in `.mcp.json` — already on by default on csr-*, ssr-htmx and full; check it to add it on any other track (e.g. ssr-nextjs). Upstream repo is archived; Railway's current route is `railway mcp` (opt-in)",
     category: "backend",
     source: "railwayapp",
     condition: { kind: "opt-in" },
     method: { kind: "internal", key: "railway-mcp-server" },
   }
   ```
   - `internal` 의 `key` 유니온(`:40-66`)에 `"railway-mcp-server"` 추가. **번들 스킬이 아니다** — `INTERNAL_BUNDLED_SKILL_IDS` · `DEV_METHOD_SKILL_IDS` 에 넣지 않는다
     (`tests/external-assets.test.ts:136-160` 이 그 목록만 `templates/skills/<id>` 와 대조한다 — ci-scaffold 와 같은 처지).
   - tier 가 experimental 이므로 `shouldInstallAsset` 은 조건으로는 절대 참이 아니고 `forceInclude`(위저드 체크 · `--with`)로만 선택된다 — 결정 ② "고를 수는 있음" 과 정확히 같다.
     vetted 는 쓸 수 없다(규칙 = ≥ 1000★ · 활성 유지, `src/trust-tier-drift.ts:4,46`; 190★ · archived). `trust-tier-drift` 는 repo 를 못 뽑는 internal 을 검사하지 않는다(`:87-94`) — 그래서 **주석에 실측 날짜를 남긴다**.
   - **서버 ↔ 자산 대응은 `key === 트랙 표의 name`** 하나로 한다. 새 표나 매핑 객체를 두지 않는다. 헬퍼 `mcpAssetOf(name)`/`MCP_SELECTABLE_SERVERS`(카탈로그에서 `kind:"internal"` 이고 key 가 트랙 표 행 이름인 것)를 `src/external-assets.ts` 또는 `src/mcp-merge.ts` 에 둔다 — 구현자 선택.
4. `:579-582` flowbite 주석의 "opt-in 경로가 없다" 를 "#709 부터 카탈로그 `internal` 항목으로 opt-in 경로가 있다(§3.3). flowbite 는 그 경로로 다시 심사할 수 있다 — 이 변경은 넣지 않는다" 로.

### 3.2 `templates/track-mcp-map.tsv`
- railway 행 패턴 `csr-supabase|csr-fastify|csr-fastapi|ssr-htmx|ssr-nextjs|full` → `csr-supabase|csr-fastify|csr-fastapi|ssr-htmx|full`. 명령 · 인자 불변. `supabase` 행 불변.
- 머리 주석에 한 줄: "패턴은 **기본** 트랙이다. 같은 이름의 카탈로그 `internal` 자산이 있으면 그 서버는 어느 트랙에서든 `--with <id>`/위저드로 고를 수 있다(#709)".

### 3.3 `.mcp.json` 렌더 — "기본 행 ∪ 선택된 행"
**규칙** (`선택된 서버 이름` 집합을 한 함수로 만든다, 가칭 `selectedMcpServers`):
```
입력: rows(트랙 표) · spec(tracks · userOverride) · excluded(이번 실행 뒤 누적 빼기 집합 — install 은 thisRunExclusions, update 는 withRecordedExclusions 의 결과) · previousLog
기본   = rows 중 anyTrack(spec.tracks, row.pattern)                                   — 오늘과 같다
선택행 = rows 중 카탈로그에 kind:"internal" · key === row.name 인 자산 A 가 있는 것
chosen = 선택행 중 다음을 만족하는 것:
   ⓐ excluded ∌ A.id 이고 excluded ∌ `mcp:<name>`                                     — 명시한 빼기는 어느 꼴이든 지킨다(ADR-099 R4 의 키 id · 새 자산 id)
   ⓑ isAssetSelected(A.id, spec) 이거나                                                — 이번 실행의 --with · 위저드 체크(forceInclude)
      previousLog.portions 에 { path: ".mcp.json", key: `mcpServers.<name>` } 가 있다  — 전에 하네스가 깐 것. 기록이 정한다(ADR-096) — 디스크 존재는 근거가 아니다
출력: 기본 ∪ chosen 의 McpJson (mergeMcpServers 가 이름 중복을 한 번만 넣는다 — 기본 행과 chosen 이 겹쳐도 한 항목)
```
- `renderHarnessMcp(harnessRoot, tracks)` 의 서명을 **선택을 받는 형태**로 바꾼다(예: `renderHarnessMcp(harnessRoot, { tracks, chosen })` 또는
  `McpJson` 을 한 번 만들어 넘긴다). 호출처 전부(실측): `src/cli-transforms.ts:209`(codex · opencode 공용 — `CliTransformParams` 에 `mcp: McpJson` 을 넣고
  `tracks` 로 렌더하던 자리를 대체), `src/install-writes.ts:745`(`writeMcpShared`), `src/key-ids.ts:37`(`renderedKeyIds` — `--with/--without mcp:` 수용 집합),
  `src/commands/uninstall.ts:1205`·`:1229`(옛 기록 파일에서 하네스 서버를 값으로 알아보는 자리 — 기록 기반 chosen 을 넘겨야 옛 ssr-nextjs 설치본의 railway 를 하네스 것으로 알린다).
  install 은 `src/installer.ts:612`(runCliTransforms) · `:1244`(writeMcpPortion), update 는 `src/update-mode.ts:992` · `:1717`. **한 실행에 한 번 만들어 네 곳이 같은 값을 받는다**(#568 의 원칙 확장).
- `renderedKeyIds` 는 **기록 ∪ 이번 선택**으로 렌더한다 — 그래야 옛 설치본에서 `--without mcp:railway-mcp-server` 가 계속 받아들여진다(오늘 동작 유지).
- **어댑터에 넘기는 빼기 집합**: 설치자가 `--without railway-mcp-server`(자산 id)로 뺐으면 `.mcp.json` 어댑터는 `mcp:railway-mcp-server` 도 빼기로 봐야
  화면이 "retired(하네스가 더는 안 깐다)" 가 아니라 "dropped — `--without`" 로 말한다(`src/install-writes.ts:~340-356` 의 `removedOut`/`retired` 분기).
  `createInstallWriter({ excluded })` 에 넘기는 집합만 `excluded ∪ { mcp:<name> | 자산 id 가 excluded }` 로 **파생**한다(헬퍼 `adapterExcluded(excluded)`, 호출처 = `src/installer.ts` · `src/update-mode.ts` 의 `createInstallWriter` 두 곳).
  **기록(`composeWriterLog` → `log.excluded`)에는 파생 키를 싣지 않는다** — 실으면 `--with railway-mcp-server` 가 자산 id 만 풀어 키 빼기가 영영 남는다.
- 위저드 update 흐름의 초기 체크: `src/interactive.ts:~130` 의 `installed: log.assets.map(a => a.id)` 에 **기록된 `.mcp.json` 몫 키가 가리키는 선택 자산 id** 를 더한다
  (`portions ∋ mcpServers.<name>` ∧ 그 이름의 internal 자산 존재). 그래야 옛 ssr-nextjs 설치본의 3단계에서 railway 가 **체크된 채** 보이고("체크 = 확인 뒤 디스크에 있다", `src/interactive.ts:~262-270`),
  해제하면 기존 경로(`RUNS AS … --without <id>`)가 그대로 `--without railway-mcp-server` 를 낸다. 첫 설치 흐름은 건드리지 않는다.

### 3.4 그 밖에 손대지 않는 것 (확인함)
- `src/external-installer.ts` `installOne`: internal 은 `selectExternalTargets` 가 걸러 spawn 하지 않는다(`:199-201`) — 새 자산도 **외부 설치 단계 0** · `log.assets` 미기록(ci-scaffold 와 같다).
- `src/commands/uninstall.ts` `--only`: `log.assets` 의 id 만 받는다 — `railway-mcp-server` 는 `--only` 대상이 아니다(internal 공통). 빼는 길은 `install --without railway-mcp-server`(§5 행 7). 전량 uninstall 은 기록된 `.mcp.json` 키를 `planStrip` 으로 걷는다 — 오늘과 같다.
- `scripts/gen-compatibility.mjs:128` — internal 은 ``templates (`--with <key>`)`` 로 찍힌다. 새 항목도 그 줄로 표에 들어간다(`npm run gen:compat`).
- `assetCliSupport`: internal = 4 CLI. `.mcp.json` 은 CLI 와 무관하게 쓰고(`src/key-ids.ts:38`) Codex · OpenCode 는 같은 렌더를 받으므로 사실과 맞다.

## 4. 기존 설치를 조용히 바꾸지 않는다 — 필드와 메커니즘

| 자산 · 상태 | 지키는 기록 필드 | 메커니즘(코드) | 이번 변경 뒤 `update` 결과 |
|---|---|---|---|
| `data`/`tooling` 설치본의 `frontend-design` | `log.assets[]`(`id: "frontend-design", method: "skill"`) | `refreshExternalSkills` 가 `log.assets` 의 skill 자산을 `forceInclude` 로 재설치(`src/external-installer.ts:482-502`) — 트랙 조건을 다시 묻지 않는다. 폴더는 `pruneOrphans` 기준선 밖(`collectSkillHashes` 가 `templates/skills/` 에 있는 파일만 기준선으로, `src/install-log.ts:645-646`) | 그대로 있고 갱신된다. 위저드 update 3단계는 `installedProjectAssetIds`(`log.assets`)로 체크된 채 보인다(`initialTargetSelection`) |
| `ssr-nextjs` 설치본의 `railway-mcp-server`(#551 이후 판, `portions` 있음) | `log.portions[]`(`path: ".mcp.json", key: "mcpServers.railway-mcp-server", sha256`) | §3.3 chosen ⓑ 가 렌더에 넣는다 → `planUpsert` 가 `replace/kept`(`contract.ts:171-178`). **이 조항이 없으면** 렌더에 없는 기록 키 = `plan.remove`(`:181`) 로 **조용히 지워진다** → 변이 테스트 T6 이 이것을 잰다 | 그대로 있다(값이 바뀌면 갱신). 명시한 빼기(`excluded ∋ mcp:railway-mcp-server` — ADR-099 R4 로 이미 뺀 사람)는 chosen ⓐ 가 지킨다 |
| `ssr-nextjs` 설치본, `portions` 없는 옛 기록(v26.161 이하) | 없음 | `legacyMcpSeed`(`src/install-writes.ts:687-701`)는 **렌더에 있는** 이름만 하네스 몫으로 심는다 → railway 는 설치자 것으로 분류돼 `kept`(건드리지 않음 · 기록하지 않음) | 그대로 있다(하네스 관리 밖 — 화면에 "yours" 로 보인다). 다시 관리하려면 `install --track ssr-nextjs --with railway-mcp-server` |
| 같은 설치본의 Codex `[mcp_servers.railway-mcp-server]` · `opencode.json` `mcp.railway-mcp-server` | `portions`(`.codex/config.toml` `tables` 구간 · `opencode:mcp.<name>`) | 두 CLI 는 `.mcp.json` 과 **같은 렌더**를 받는다(§3.3 한 값) → 같이 남는다 | 그대로 |

## 5. 경로별 동작

| # | 경로 | ssr-nextjs | data · tooling | 비고 |
|---|---|---|---|---|
| 1 | **위저드 · 새 설치** | 3단계: `vercel-cli` ✓ 체크 · `railway-mcp-server` □(⚠ experimental, backend 그룹) · `frontend-design` ✓. 확인 뒤 `.mcp.json` = 템플릿 3종(railway 없음). railway 를 체크하면 `--with` 와 같다(행 2) | `frontend-design` □(체크 안 됨 · 목록에는 있음). 체크하면 `forceInclude` 로 들어간다 | `computeUserOverride` 가 추천과의 diff 를 낸다 — 바뀐 추천이 그대로 반영된다 |
| 2 | **`--track …` 새 설치** | `install --track ssr-nextjs` → `npm install --save-dev vercel@54.17.3` 실행 · `.mcp.json` 에 railway 없음. `--with railway-mcp-server` → railway 가 `.mcp.json` · Codex · OpenCode 에 들어가고 `portions` 에 기록된다. `--without vercel-cli` → 빠지고 `excluded ∋ vercel-cli` | `install --track data` → frontend-design 안 깔림. `--with frontend-design` → 깔림(`log.assets` 기록) | 헤더 ASSETS 줄 · 상주 비용은 `finalSelectedAssets` 가 그린다 — 자동 반영 |
| 3 | **`update` · 옛 설치본** | §4 — railway 유지(기록 키) · frontend-design 유지. `vercel-cli` 는 **깔리지 않는다**(update 는 자산 재설치 없음 — `src/commands/update.ts:12-14`). 화면에 새 추천을 알리는 줄은 두지 않는다(§10 A3) | frontend-design 유지 · 갱신 | 위저드 update 3단계: railway ✓(§3.3 마지막 항목) · frontend-design ✓(`log.assets`) |
| 4 | **플래그 없는 `install` 재실행 · 옛 설치본**(ADR-099: 선택 = 이번 입력) | railway: chosen ⓑ(기록) 로 **남는다** — `--with` 로 깐 opt-in 자산이 플래그 없는 재설치에 남는 것(`selection-record` §3)과 같은 모양. `vercel-cli` 는 이번 추천이라 **새로 깔린다**(새 기본의 정상 효과 — 화면 external 행에 보인다) | frontend-design: 이번 선택 밖이지만 `mergeAssets` 가 기록을 잇고 폴더는 남는다(이번 실행은 갱신하지 않음 · 다음 update 가 갱신) | `--without railway-mcp-server` 를 주면 행 7 |
| 5 | **`install --cli <추가 CLI>` · 옛 설치본** | 선택 = 이번 입력 + 기록: railway 는 chosen ⓑ 로 렌더에 있으므로 새 CLI 의 `config.toml`/`opencode.json` 에도 들어간다 | frontend-design 은 이번 선택 밖 → 새 CLI 자리(`.agents/skills/`)에는 **안 깔린다**. 오늘도 `--with` 로 깐 opt-in 자산은 같은 처지(기존 의미) — 받으려면 `--with frontend-design`; 위저드 add-CLI 흐름은 `installedProjectAssetIds` 로 체크돼 깔린다 | 기존 의미 그대로 — 새 회귀가 아니다. USAGE 트랙 노트에 한 줄(§6) |
| 6 | **`uninstall`(전량)** | 기록된 `.mcp.json` 키(railway 포함)를 `planStrip` 으로 걷는다 — 설치자가 고친 값은 남기고 알린다. `vercel-cli` 는 npm 자산 안내(D16, 프로젝트 `devDependencies` 는 되돌리지 않는다 — 오늘과 같다) | frontend-design 은 `log.assets.files` 로 지운다(#573) | 변경 없음. `uninstall --only railway-mcp-server` 는 받지 않는다(internal 공통) — 화면의 기존 "`list` 에서 id 확인" 안내 그대로 |
| 7 | **빼기** | `install --track ssr-nextjs --without railway-mcp-server`(기존 설치본) → 렌더에서 빠지고 `.mcp.json` · Codex · OpenCode 에서 걷힌다(고친 값은 남기고 알림) · `excluded = [railway-mcp-server]` · 화면 "dropped". `--without mcp:railway-mcp-server`(키 id) 도 종전처럼 받는다(렌더에 있을 때). 둘을 `--with` 와 같이 주면 R6 거절 | `--without frontend-design` 종전과 같다 | update 는 둘 다 지킨다(chosen ⓐ) |

## 6. 문서 (코드와 같은 PR 에서 · 전체 스위트를 돈다 — `test-policy` §영향 범위)

| 파일 | 줄 | 바꿀 내용 |
|---|---|---|
| `docs/TRACKS.md` | 39 | Dev tools 행: `frontend-design` "(all dev tracks except `base`)" → "(`csr-*` · `ssr-*` · `full`)" |
| | 40 | MCP 행: `railway-mcp-server` "on `csr-*`/`ssr-*`/`full`" → "on `csr-*`/`ssr-htmx`/`full` — any track can add it with `--with railway-mcp-server`" |
| | 13 | `base` 행의 "`frontend-design` is not pre-checked" 는 참 — 그대로. `data`/`tooling` 행에는 적지 않는다(표 39 행이 말한다) |
| | 90-91 | Backend 표: `railway-skills` 행 아래에 `railway-mcp-server` 행(`opt-in` · ⚠ · "default on `csr-*`/`ssr-htmx`/`full`") · `vercel-cli` 를 묶음 행에서 떼어 "Tracks = `ssr-nextjs`" 로 |
| `docs/USAGE.md` | 135 | `.mcp.json` 행의 트랙 목록을 TRACKS 40 행과 같게 |
| | 317 | "No deploy CLI is pre-checked on any track" → "`vercel-cli` is pre-checked on `ssr-nextjs` (#709); `supabase-cli` and `netlify-cli` stay opt-in" |
| | 319 | `data` 줄의 "(method skills, `frontend-design`)" → "(method skills; `frontend-design` is not pre-checked — `--with frontend-design` adds it)" |
| | 321 | `tooling` 줄에 같은 한 문장 · 행 5 의 add-CLI 의미 한 줄("an asset you added with `--with` reaches a CLI you add later only if you pass `--with` again, or check it in the wizard") |
| `docs/REFERENCE.md` | 34 | `DEV_TRACKS_WITH_STACK` 서술 → `UI_TRACKS`(csr-* · ssr-* · full) |
| | 69 | railway 행 트랙 목록에서 `ssr-nextjs` 제거 + "선택: `--with railway-mcp-server`" |
| `docs/COMPATIBILITY.md` | 생성 | `npm run gen:compat` — 새 행(`railway-mcp-server` · experimental · ``templates (`--with railway-mcp-server`)``) · `vercel-cli` 행은 변화 없음(표에 트랙 열 없음) |
| `README.md` · `README.ko.md` | — | **변경 없음** — 두 파일은 트랙 이름만 나열하고(73-76 행) 자산 기본값을 적지 않는다(`grep -n -i "frontend-design\|railway\|vercel"` → skills CLI 링크 1줄뿐). 이슈 AC 의 "스택 표" 는 현 README 에 없다 |
| `index.html` · `llms.txt` | — | **변경 없음** — 트랙 · 자산 이름이 없다(대조군: 두 파일 모두 "harness" 는 각 18 · 12회 잡힌다, `ssr-nextjs\|railway\|frontend-design` 0회) |
| `docs/requirements-trace.md` | 48 | V5 행 서술에 "ssr-nextjs 는 #709 부터 선택" 한 구절(이력 문서 — 선택) |
| `CHANGELOG.md` | — | 릴리즈 커밋에서(`ship-checklist`) — 이 PR 에는 넣지 않는다 |

`tests/doc-asset-ref-drift.test.ts`(USAGE · TRACKS 의 id 를 카탈로그와 대조) · `tests/docs-supply-chain.test.ts` 가 위 파일을 경로로 읽는다 — 문서 변경 뒤 **전체** `npm run ci`.

## 7. 테스트 (입력 상태 → 기대 · 음성 대조)

| # | 파일 | 입력 | 기대 | 지금 main 에서 |
|---|---|---|---|---|
| T1 | `tests/base-track.test.ts:47-63` | `recommendedExternalAssets(["tooling"])` · `(["data"])` · 대조군 `(["csr-fastapi"])` | tooling · data 에 `frontend-design` 없음 · csr-fastapi 에 있음. 기존 "대조군 tooling 이 못 받는다" 단언은 대조군을 `csr-fastapi` 로 | **red**(tooling 이 받는다) — 음성 대조 |
| T2 | `tests/interactive.test.ts:455-495` | `TOOLING_RECOMMENDED` 픽스처 | 픽스처를 UI 트랙(`csr-fastapi`)으로 바꾼다 — tooling 추천에 frontend-design 이 없으면 `without` 필터가 공회전해 `forceExclude` 단언이 깨진다. `:124-135` 의 uncheck 시나리오도 같은 이유로 트랙 확인 | red(변경 뒤) → 픽스처 교체 |
| T3 | `tests/installer-track-matrix.test.ts` | `runForTrack(["ssr-nextjs"])` · `(["data"])` · `(["tooling"])` · `(["full"])` | ssr-nextjs ∋ `vercel-cli` · data/tooling ∌ `frontend-design` · full ∌ `vercel-cli`(결정 ③) · csr-fastapi ∋ `frontend-design` | red(vercel-cli 없음) |
| T4 | `tests/mcp-merge.test.ts` 또는 새 `tests/mcp-selection.test.ts` | 실제 `templates/track-mcp-map.tsv` + `selectedMcpServers` | ssr-nextjs · 선택 없음 → railway 없음 · csr-fastapi → 있음(대조군) · ssr-nextjs + `forceInclude ["railway-mcp-server"]` → 있음 · `excluded ∋ "railway-mcp-server"` 또는 `∋ "mcp:railway-mcp-server"` → 없음(기록이 있어도) | red(ssr-nextjs 에 railway) |
| T5 | `tests/cli-mcp-source.test.ts`(기존 `:102-130` 모양) | `runInstall` ssr-nextjs `--with railway-mcp-server`, cli codex+opencode | `.mcp.json` · `.codex/config.toml` · `opencode.json` 셋에 railway · `log.portions ∋ mcpServers.railway-mcp-server` · `log.assets ∌ railway-mcp-server`(internal) · `log.excluded` 비어 있음 | red(모르는 키 경고 · 미설치) |
| T6 | `tests/cli-shared-files.test.ts` 또는 `tests/explicit-exclusion.test.ts` | 기록 = `spec.tracks [ssr-nextjs]` · `portions ∋ {.mcp.json, mcpServers.railway-mcp-server, sha=현재 렌더값}` · 파일에 그 키 · `records: "writer"` → `update` | 키가 남아 있고 화면에 `retired`/`removed` 줄 없음(대조군: `mcp:context7` 등 템플릿 키는 `kept`). **변이**: chosen ⓑ 의 `portions` 조항을 끊으면 키가 사라지고 `retired` 가 뜬다 — 그 red 를 눈으로 본 뒤 되돌린다(이 테스트는 main 에서도 초록이므로 변이가 유일한 음성 대조다 — `test-policy` §변이) | green(TSV 가 아직 ssr-nextjs 포함) → 변이로 증명 |
| T7 | `tests/update-mode*.test.ts`(`refreshExternalSkills` 를 spawn 스파이로) | 기록 = `tracks [data]` · `assets ∋ {id: frontend-design, method: skill}` → `update` | spawn 인자에 `frontend-design` 포함(재설치 시도) · `excluded ∋ frontend-design` 이면 미포함(대조군) | green(기존 동작) — 핀 고정용. 변이: `installedIds` 를 조건으로 거르면 red |
| T8 | `tests/explicit-exclusion.test.ts` | ⓐ 기록 `excluded ∋ mcp:railway-mcp-server`(옛 R4) + ssr-nextjs + 파일에 키 없음 → `update` ⓑ railway 있는 ssr-nextjs 설치본에 `install --without railway-mcp-server` | ⓐ 되돌리지 않음 · `was missing — restored` 없음 ⓑ 셋에서 걷힘 · 화면 "dropped" · `log.excluded = ["railway-mcp-server"]`(키 id 파생분 없음) · 이어서 `update` 가 되살리지 않음 | ⓐ green(기존) ⓑ red |
| T9 | `tests/interactive.test.ts` · `tests/wizard-update-flow.test.ts` | ⓐ 첫 설치 ssr-nextjs 3단계 ⓑ update 흐름, 기록 `portions ∋ railway` | ⓐ `asset:railway-mcp-server` 가 목록에 있고 초기 미체크 · 체크 시 `forceInclude ∋ railway-mcp-server` ⓑ 초기 체크됨 · 해제 시 `RUNS AS` 에 `--without railway-mcp-server` | red |
| T10 | `tests/external-assets.test.ts`(`:240-262` ci-scaffold 모양) | 카탈로그 | `railway-mcp-server`: `opt-in` · `internal` · key=id · tier experimental · `INTERNAL_BUNDLED_SKILL_IDS` 밖 · `selectExternalTargets` 결과에 없음(spawn 0) · `vercel-cli` 조건 `any-track` = `["ssr-nextjs"]` · `frontend-design` 조건 트랙 집합 = `TRACKS.filter(hasUiTrack)` | red |
| T11 | `tests/key-ids.test.ts`(있으면) / `tests/cli-shared-files.test.ts` | `renderedKeyIds` · `withoutAccepts` — 기록 `portions ∋ railway` 인 ssr-nextjs | `mcp:railway-mcp-server` 를 받는다 · 기록 없는 ssr-nextjs 에서는 모르는 키 경고(기존) | red(전자) |
| T12 | 문서 게이트 | `npm run ci` 전체 | `doc-asset-ref-drift` · `docs-supply-chain` · `north-star-cost-figures` 등 경로로 읽는 스위트 green | — |
| T13 | 도커(선택 · 릴리즈 신호) | `test/docker/scenarios/` 35종 중 `ssr-nextjs` 를 쓰는 시나리오 **0**(대조군 `csr-fastapi` 1) | `scenario-base-track.sh` ③ 는 그대로 green. ssr-nextjs 한 줄(`install --track ssr-nextjs` → `package.json devDependencies.vercel` 존재 · `.mcp.json` 에 railway 없음 · `--with railway-mcp-server` 재실행 → 있음)을 `scenario-project.sh` 류에 더하는 것은 **선택** — `docker-scenarios.yml` 은 게시를 막지 않는다(ADR-079) | — |

머지 문턱: `test-policy` §머지 전 독립 리뷰 문턱 — §3.3 은 **update 의 `.mcp.json` 쓰기 경로**(기록된 키의 유지/삭제)를 건드리므로 **독립 리뷰 대상**이다. 리뷰어에게 T6 변이 red 의 증거를 함께 준다.

## 8. 후속 이슈 (이 PR 에 넣지 않는다 · 착수 전 등록)
1. **Vercel MCP 를 `.mcp.json` 에 넣는 경로** — 원격 HTTP + OAuth(§2.1). 필요한 것: 트랙 표에 `url` 열(또는 카탈로그 `method: { kind: "mcp-remote", url }`), `McpServerConfig` 에 `url` 허용, Codex 렌더러 `url = …`, OpenCode `type: "remote"`, 첫 사용 인증 안내(Claude `/mcp` · `claude mcp login` · Codex 브라우저 · OpenCode `opencode mcp auth`), Antigravity 는 Vercel 승인 목록에 없음. 설치자가 지금 할 수 있는 것 = `npx vercel mcp --clients "Claude Code"`(공식) — 이번 변경의 자산 설명이 그걸 말한다.
2. **Railway 행의 명령 교체** — 상류 패키지 archived(§2.3). 후보 = `railway` + `["mcp"]`(Railway CLI ≥ 5.44 · `railway login` 선행) 또는 OAuth 원격(1 과 같은 축). 다른 5 트랙의 기본값이 걸려 있어 별도 결정.
3. **MCP 서버 전부를 카탈로그로**(`context7` · `github` · `chrome-devtools` · `supabase` 도 위저드에 보이게) — SPEC Non-Goals "기본 설치 항목 재정의"(#262 G 사이클) 영역. 이번은 railway 한 행만.
4. `vercel-cli` 핀 54.17.3 → 62.2.0 — catalog-verify 주기.

## 9. ADR
- **ADR-101 신설** "트랙 기본값은 스택이 정한다 — data·tooling 의 frontend-design 해제 · ssr-nextjs 의 Vercel 기본 · MCP 서버의 선택 경로".
  - Amends: **ADR-063** 의 `vercel-cli` 한 줄(opt-in → ssr-nextjs 미리 체크; railway-skills · supabase-cli · finance · product 는 그대로) — ADR-063 Status 는 Accepted 유지, 머리에 "Amended by ADR-101(vercel-cli 한정)" 한 줄. ADR-035(netlify opt-in) 는 그대로 참.
  - 바뀌는 전제: "`.mcp.json` 조립은 트랙 조건만 읽어 opt-in 경로가 없다"(ADR-063 시점 · flowbite 기각 근거) → 카탈로그 `internal` 자산이 트랙 표 행을 가리키면 선택 경로가 있다. `#456` 결정 B("스택 없는 dev 트랙은 스택 무관 개발 도구를 기본에서 뺀다")는 그대로이고, 이번은 "**UI 가 없는** 스택 트랙(data · tooling)도 뺀다" 로 좁힌다.
  - Alternatives(기각): ⓐ 키 id `--with mcp:<name>` 에 "추가" 의미 부여 — 위저드가 키 id 를 내지 않아(G2) 표면이 갈린다 ⓑ 트랙 표에 "선택" 열 신설 + 위저드 새 타깃 종류 — 카탈로그가 이미 하는 일을 두 벌로 ⓒ 카탈로그를 railway 의 **단일 원천**으로(트랙 표 행 삭제, 조건 `any-track` 5트랙) — tier 규칙(≥1000★)상 experimental 이라 미리 체크가 불가능해 5 트랙의 기본값이 바뀐다(결정 ③ 위반) ⓓ Vercel MCP 를 지금 넣기 — §2.1·§2.3.
  - Consequences: ssr-nextjs 새 설치는 `npm install --save-dev vercel` 을 돈다(네트워크 · `package.json` 변경 — npm 자산의 기존 성질) · csr-*/full 의 3단계에 railway 항목이 **미체크(⚠)로 보이지만 트랙 표가 깐다**(설명 문구가 그 사실을 말한다 — 후속 3 이 없앤다) · `update` 는 새 추천(vercel-cli)을 깔지 않는다.

## 10. 가정 (사용자가 안 정한 것 — 틀리면 여기만 고친다)
- **A1** `full` 은 `vercel-cli` 를 미리 체크하지 않는다(결정 ③ "full 의 기본값은 그대로" 를 문자 그대로). "full = 모든 dev 트랙" 서술과 어긋나 보이지만 ADR-063 뒤로 full 도 deploy CLI 를 안 받아 왔다 — 넣으려면 별도 결정.
- **A2** Railway 선택 항목의 tier 는 experimental(실측 190★ · archived). ⚠ 배지가 뜬다 — 사실이다.
- **A3** `update` 화면에 "이 릴리즈부터 ssr-nextjs 는 vercel-cli 를 추천한다" 같은 안내 줄을 **두지 않는다**(update 는 무엇을 깔지 다시 묻는 자리가 아니다 — ADR-078 Consequences 와 같은 결). 새 추천은 `install` 재실행 · 위저드에서 보인다.
- **A4** `uninstall --only railway-mcp-server` 는 지원하지 않는다(internal 자산 공통 — ci-scaffold 도 같다). 빼기 = `install --without railway-mcp-server`.
- **A5** `--with mcp:railway-mcp-server`(키 id)의 의미는 바꾸지 않는다(기록된 빼기 풀기만). 고르는 id 는 자산 id 다 — USAGE 56 행의 키 id 설명에 "a server you can add is a catalog id — see TRACKS" 한 구절.
- **A6** 자산 설명 · USAGE 는 영어(현행 문서 언어) · 이 설계와 ADR 은 한국어.

## 설계 검증 반영 (design-verifier-xhigh, 2026-10-05) — 이 절이 위 본문보다 우선한다

- **BLOCKER-1 정정 (§3.1-3):** `tier: "experimental"` + `internal` 항목은 `tests/trust-tier-drift.test.ts:45-54` 를 red 로 만든다(`src/trust-tier-drift.ts:71-78` 이 internal 에 null). `src/trust-tier-drift.ts` 의 `REPO_OVERRIDE` 에 `"railway-mcp-server": "railwayapp/railway-mcp-server"` 를 더한다 — 월간 drift 가 ★·archived 를 실제로 감시하므로 주석 날짜는 두지 않는다.
- **NOTE-1 (§3.3 uninstall):** `remnantFor`(`src/commands/uninstall.ts:1190-1240`)는 몫 기록이 없는 옛 설치본 전용이라 기록 기반 선택 행이 늘 비어 있다. 이 경로는 값 대조이므로 **트랙 기본 행 ∪ 카탈로그의 선택 가능 MCP 행 전부**로 렌더해, 옛 ssr-nextjs 설치본의 railway 가 오늘처럼 "하네스 잔존" 안내에 잡히게 한다(지우지는 않는다).
- **NOTE-2 (T6):** 변이 없이 main 에서 red 인 형태로 쓴다 — 기록 `tracks [tooling]`(TSV 패턴 밖) + `portions ∋ mcpServers.railway-mcp-server` + 파일에 키 → main 은 remove/`retired`, 변경 뒤는 kept. 변이는 보조.
- **NOTE-3 (§5 행 7):** 기본 행이 있는 트랙(csr-*·ssr-htmx·full)에서 `--without railway-mcp-server` 는 `--without mcp:railway-mcp-server` 와 같이 기본 행도 걷는다(의도). 그 트랙에서 `--with railway-mcp-server` 는 no-op.
- **NOTE-5:** `McpJson` 은 한 번 만들어 5개 호출처에 넘기고, tracks 만 보는 렌더 경로를 남기지 않는다.

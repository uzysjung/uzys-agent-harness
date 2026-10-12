# #766 독립 리뷰 — fix/supabase-mcp-remote @ 84ed51c (기준 main@2069b5f)

- 리뷰어: 독립 검증 레인 · 2026-10-12 · 작업 사본 `scratchpad/iso766/uzysClaudeUniversalEnv`
- 변이와 임시 테스트는 모두 되돌렸다. node_modules 심링크도 지웠다. 끝난 뒤 `git diff --quiet 84ed51c` 는 exit 0 이고, `git status` 는 깨끗하다.
- 재현용 임시 파일(이 판정의 근거)은 리뷰어 세션 스크래치패드 `…/3b41e49e-…/scratchpad/` 에 있다.
  - `probe-tests.ts.txt` — R1–R7
  - `snap-test.ts.txt` · `bdiff.py` · `shachk.py` — 새 설치 전후 바이트 대조
  - `ci766.log` · `m-M{1,2,3,4}.log` · `tsc-M*.log`

## 결론: **PASS** (BLOCKER 없음)

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH(BLOCKER) | 0 |
| MEDIUM | 1 (N1 — 이 PR 이 만든 문제가 아니다. 기존 설계의 빈자리) |
| LOW | 3 |

## 완료 기준별 판정

### ① 새 설치: 세 CLI 의 supabase 가 원격 공식 항목이고, 다른 트랙과 서버는 바이트 동일 — **충족(직접 다시 확인)**

구현자 스냅숏은 쓰지 않았다. 12트랙 × claude·codex·opencode 를 HEAD 와 2069b5f(`src`·`templates` 만 되돌림)로 각각 깔고, 프로젝트 경로와 시각을 정규화한 뒤 비교했다. 양쪽 파일 수는 1130 으로 같다.

- 내용이 달라진 파일은 csr-supabase·full 두 트랙의 `.mcp.json` · `opencode.json` · `.codex/config.toml` 의 `supabase` 블록과 `.env.example` 주석뿐이다.
- 설치 기록의 sha 차이를 하나씩 분류했다. 경로가 박힌 파일 때문에 생긴 차이를 빼면 남는 것은 두 트랙의 `mcpServers.supabase` · `mcp.supabase` · `opencode.json` 파일 sha 뿐이다.

### ② update 는 하네스 값 그대로인 옛 항목만 갈아 끼우고, 설치자가 고친 값은 남긴다 — **충족**

**누가 이 상태를 만드나(판 이력).** 트랙 표의 `supabase\tcsr-supabase|full\tnpx\t["-y", "@supabase/mcp-server"]` 행은 v26.12.0 부터 v26.168.0 까지 같다(`git show <tag>:templates/track-mcp-map.tsv`).

- **`.mcp.json` · 옛 로그(v26.161 이하).** v26.161.0 `mergeMcpServers` 는 `{type:"stdio",command,args}` 를 그대로 쓰고, `installer.ts:1029` 는 `change: mcpCreated ? "created" : "modified"` 로 적는다. PRIOR 값의 모양이 실제 디스크와 같고, `created` 근거도 실재한다.
- **Codex · OpenCode · 옛 로그.** v26.161.0 의 두 변환은 MCP 를 하네스 루트 `.mcp.json` 에서 읽었다(`codex/transform.ts:106`). 그래서 npm 판은 supabase 를 쓰지 않았다(#568 과 같은 함정).
  - 이 base 에는 OpenCode·Codex 옛 로그 씨(PR-E #747)가 없다. `legacySeed` 를 쓰는 곳은 settings · mcp · gitignore 셋뿐이다(`grep legacySeed src`). 그래서 PR-E 리뷰가 잡은 "설치자 값을 하네스 몫으로 읽는" 경로가 이 PR 에는 없다.
- **세 파일 · 기록 있음(v26.162–168).** 하네스가 옛 값을 쓰고 몫 sha 를 기록했다. 새 테스트 2 가 이 경로다.

**과잉 매칭 실측(실제 update, 프로브 R1–R7):**

| 장면 | 결과 |
|---|---|
| R1 기록 있음: `.mcp.json` 을 설치자 PAT 로컬 서버(`@supabase/mcp-server-supabase@latest --project-ref` + env)로 바꿨고, opencode 는 local+environment 로 바꿨다 | 두 값 그대로 · `kept yours: supabase` · `kept yours: mcp.supabase`. 고치지 않은 codex 만 원격으로 바뀐다(파일별 몫이라 맞다) |
| R2 옛 로그(created): 설치자 PAT 로컬 서버 | 그대로 · `kept yours: supabase` |
| R3 옛 로그: 설치자가 먼저 둔 `.mcp.json` 에 옛 404 값이 그대로 있다(`change: modified`) | 그대로 |
| R6 기록 있음: 설치자가 이미 원격 + `?project_ref=…&read_only=true` 로 바꿨다 | 그대로 · `kept yours` |
| R5 기록 있음 full 트랙 | 세 자리 모두 원격 |
| R4 · R7 | 아래 N2 · N1 |

### ③ 원격 첫 사용 로그인 안내가 나온다 — **충족**

- 새 설치 요약 NEXT: `Remote MCP servers sign in on first use — railway-mcp-server · supabase` + `codex mcp login supabase`. 테스트 1 이 이것을 문다.
- update 요약 NEXT: 테스트 2 가 문다.
- R4 화면에서 Claude 줄(`/mcp → Authenticate (or: claude mcp login supabase)`)을 직접 봤다.
- 실계정 OAuth 통과는 검증하지 않았다(ADR-106 Caveat 와 같다). 대신 엔드포인트가 OAuth 서버인 것은 확인했다. `curl -sI https://mcp.supabase.com/mcp` → `401` + `www-authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"`.

## 특히 판정할 것

**1. 원격 항목 형식 — 맞다(공식 문서 원문 대조).**
- Context7 MCP 도구는 이 레인에 노출되지 않았다. 그래서 공식 원문을 직접 받았다.
- Supabase: `supabase-community/supabase-mcp` README §2 는 `{"type":"http","url":"https://mcp.supabase.com/mcp"}` 를 쓰고, "MCP client will automatically prompt you to log in" 이라고 적었다. Claude 렌더와 같다.
- Codex: developers.openai.com/codex/config-reference 의 `mcp_servers.<id>.url — Endpoint for an MCP streamable HTTP server`. `/codex/mcp` 문서는 `codex mcp login <server-name>` 을 쓴다. 렌더 `[mcp_servers.supabase]\nurl = "…"` 와 같다.
- OpenCode: `sst/opencode` docs `mcp-servers.mdx` 는 `"type": "remote"` 와 `url` 을 필수로 둔다. "OpenCode automatically handles OAuth authentication for remote MCP servers" 라고 적었다. 렌더 `{type:"remote",url}` 과 같다.
- Railway 원격 행과 같은 렌더러다. 바이트 대조에서 세 파일 모두 Railway 와 같은 모양으로 나왔다.
- 대조군을 둔 npm 실측: `@supabase/mcp-server` 는 404 다. `@supabase/mcp-server-supabase` 와 `@railway/mcp-server` 는 200 이다.

**2. 과잉 매칭.** 위 ② 표. BLOCKER 는 없다. N1 과 N2 는 NOTE 로 둔다.

**3. `.env.example` — 맞다.**
- `writeEnvExample` 은 `existsSync(path)` 면 쓰지 않는다(`env-files.ts`). 그래서 기존 설치자 파일은 그대로다. 옛 주석은 해롭지 않다.
- 새 문구가 가리키는 로컬 패키지 `@supabase/mcp-server-supabase` 는 실재한다(npm 200, 공식 README 가 같은 패키지명을 쓴다). "원격은 토큰 불필요" 는 README 와 일치한다.

**4. ADR · SPEC Change Log — 필요 없다는 판단에 동의한다. 다만 ADR-106 에 한 줄 추가를 권한다(LOW, N3).**
- `docs/SPEC.md` 에는 supabase 언급이 없다(`git grep -i supabase docs/SPEC.md` 0건. 대조군으로 같은 명령이 ADR-106 에서는 걸린다).
- 이 변경은 ADR-106 결정("기본 MCP 는 현행 공식 경로")을 한 행에 적용한 버그 fix 다. 새 결정이 아니다.

**5. 새 테스트 4건 — 전부 문다.**
- 변이마다 `git diff --stat` 으로 적용을 확인했다. `npx tsc --noEmit` 은 전부 exit 0 이다.

| 변이 | 결과 |
|---|---|
| M1 PRIOR 의 supabase 제거 | 2 · 4 red |
| M2 `legacyMcpSeed` 의 `prior ?? jsonSha(render)` → `prior ?? disk` | 4 red |
| M3 tsv 행을 stdio 로 되돌림 | 1 · 2 · 4 red |
| M4 `contract.ts:173` 에 `|| key.endsWith(".supabase")` | 3 red |

- 복원은 `git checkout 84ed51c -- src templates` 로 했다.
- `npm run ci` 는 파이프 없이 돌렸다(`> ci766.log 2>&1; echo EXIT=$?`). 결과 **EXIT=0** · 148 files / 2264 tests · branches 89.28% · build success.

## NOTE (BLOCKER 와 별개)

**N1 (MEDIUM, 기존 설계의 빈자리) — 옛 로그 + 설치자가 먼저 둔 `.mcp.json` 에서는 404 supabase 가 조용히 남는다 (R7)**
- 장면: 프로젝트에 자기 `.mcp.json` 이 있던 설치자가 v26.12–161 로 csr-supabase·full 을 깔았다. 그때 하네스가 옛 supabase 를 병합해 넣었다(`change: "modified"`).
- 이 설치자가 update 하면 supabase(railway 도 마찬가지다)는 옛 stdio 그대로 남는다. **화면에는 `.mcp.json` 줄이 아예 없다.**
- 기록이 이 키를 하네스 몫이라고 말하지 않으므로 남기는 것은 ADR-096 · ADR-101 Consequences("설치자 것으로 분류돼 그대로 남는다") 대로다. main 에서도 railway 가 같다.
- 다만 supabase 는 **처음부터 뜬 적 없는 서버**다. 설치자는 고칠 단서를 받지 못한다.
- 이 PR 의 범위 밖이다. 남은 404 값을 화면으로 알릴지(uninstall 잔존 안내처럼 알리기만)는 리드가 이슈로 올릴지 판정한다.

**N2 (LOW) — 옛 로그(created)에서 기본이 아닌 트랙의 설치자가 옛 404 값을 손으로 넣었으면, 갈아 끼우고 몫으로 기록한다 (R4)**
- 재현: tooling 트랙에서 `mcpServers.supabase = {stdio, npx -y @supabase/mcp-server}` 를 손으로 넣는다. update 하면 원격으로 바뀌고 `portions` 에 기록된다. 화면에는 "kept because your install record has it" 이 나온다.
- 같은 메커니즘이 railway 에 이미 있다. ADR-106 결정 5 와 설계 검증 B1 ⓐ 가 받아들인 것이다.
- 이 상태를 만드는 사람은 없다고 본다. npm 에 없는 패키지를 손으로 넣을 동기가 없다. 실제로 생기는 길은 csr-supabase → tooling 재설치 같은 트랙 변경인데, 그때 값은 실제로 하네스가 쓴 것이다. 결과도 망가진 서버가 공식 서버로 바뀌는 것이라 설치자가 잃는 것이 없다.

**N3 (LOW) — ADR-106 결정 5 의 열거가 낡았다**
- `옛 값 표(PRIOR_MCP_SERVERS) — … (github · 옛 railway · 옛 chrome)` 에 이제 옛 supabase 가 빠져 있다.
- 필수는 아니다. 다만 #751 이 같은 ADR Consequences 에 한 줄을 더한 전례가 있으니, 거기에 한 줄을 더하는 것이 싸다. 예: "(#766) supabase 행도 공식 원격으로 — 옛 `@supabase/mcp-server`(npm 404)는 PRIOR 에 들어 update 가 하네스 값 그대로인 것만 갈아 끼운다".

**N4 (LOW) — 이슈 #766 이 CHANGELOG 기재를 요구한다**
- 릴리즈 커밋에서 새 설치 결과 변경(csr-supabase·full 의 supabase → 원격, `.env.example` 문구)을 적는다.

## Verdict 체크
- [x] CRITICAL 없음
- [x] DO NOT CHANGE 영역 미변경(SPEC 언급 없음 · ADR-106 범위 안)
- [x] 완료 기준 ①②③ 충족(③ 실계정 OAuth 는 미검증 — ADR-106 과 같은 한계)
- [x] Non-Goals 침범 없음 — uninstall.ts 와 렌더러는 손대지 않았다

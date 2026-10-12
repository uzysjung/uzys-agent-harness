# PR-E (#747) 독립 리뷰 — fix/opencode-legacy-seed @ 9809d31 (기준 main@6d6c8ec)

- 리뷰어: 독립 검증 레인 · 2026-10-12 · 작업 사본 `rev-E/wt`(변이·임시 테스트는 전부 되돌렸고 `git status` 는 깨끗하다. node_modules 심링크도 지웠다)
- 재현용 임시 테스트 원문: `rev-E/probe-tests.ts`(`tests/mcp-migration-167.test.ts` 에 `describe("REVIEW-747")` 를 더한 사본 · R1–R7)

## 결론: **BLOCKER 있음 (1건)**

| Severity | Count |
|---|---|
| CRITICAL | 0 |
| HIGH(BLOCKER) | 1 |
| MEDIUM | 2 |
| LOW | 1 |

---

## BLOCKER-1 — 이 씨가 실제로 잡는 것은 설치자가 직접 넣은 서버뿐이다. 하네스 값을 잡는 경우는 없다

**전제가 틀렸다.** 이 씨는 "하네스가 만든 `opencode.json` 에서 하네스 값 그대로인 서버 = 하네스가 쓴 것" 을 전제한다. 하지만 이 씨가 도는 조건(옛 로그 + 이 파일 몫 기록 0건)에서는 그 서버를 하네스가 쓴 적이 없다.

1. **v26.161 이하 npm 판은 `opencode.json` 에 서버를 하나도 쓰지 않았다.** 그 판의 변환은 서버 목록을 하네스 루트의 `.mcp.json` 에서 읽었다(`git show v26.161.0:src/opencode/transform.ts:96`). 그런데 그 파일은 패키지 `files`(`dist · templates · README · LICENSE`)에 없어서 템플릿의 `"mcp": {}` 가 그대로 나갔다. #568 본문이 `@26.161.0` 실 CLI 컨테이너에서 "트랙과 무관하게 `mcp` 는 항상 `{}`" 를 재현했고, 수정 커밋 fd9eefc 본문도 "npm 게시판에서 MCP 서버를 하나도 못 받았다" 고 적었다. 저장소째 받는 `npx github:` 경로는 Claude 형식(`type: stdio`)을 썼다. 이 값은 씨의 OpenCode 형식 대조에 걸리지 않는다(R1 실측).
2. **v26.162 이후에는 하네스가 이 파일에 서버를 쓰는 순간 그 몫이 기록된다.** OpenCode 형식(fd9eefc)과 몫 기록(4bee777·2f24ca7)은 둘 다 v26.162.0 에 들어왔다. update 는 로그를 `{...log}` 로 이어 써서 `records` 가 없는 채로 남지만, `opencode.json` 의 `portions` 는 v26.162.0–v26.166.0 내내 기록한다(`git grep portions vX -- src/update-mode.ts`). 그러면 `recorded.size > 0` 이 되어 씨가 불리지 않는다.
3. **이슈가 말한 실제 사용자는 main 이 이미 갱신한다.** 재현 R6: 옛 로그(`records` 없음)에 v26.162–166 update 가 남긴 몫이 있는 상태에서 설치자가 `permission` 을 고쳤다. main 코드로 update 하면 `chrome-devtools` 에 `--no-usage-statistics` 가 붙고 옛 github 은 걷힌다.

**그래서 설치자가 실제로 잃는 것(R5, 재현됨):** v26.161 이하 npm 으로 OpenCode 를 깔아 MCP 가 비어 있던 설치자를 보자. #568 때문에 이 설치자가 서버를 손으로 넣었을 가능성은 높다. chrome-devtools-mcp 공식 문서의 OpenCode 예시(`docs/client-configurations.md:362-371`, `{"type":"local","command":["npx","-y","chrome-devtools-mcp@latest"]}`)를 붙여 넣으면 그 값은 하네스의 옛 값과 바이트 단위로 같다.

| | main@6d6c8ec | 9809d31 |
|---|---|---|
| update 뒤 설치자 `chrome-devtools` 값 | 그대로 | **백업 없이** `--no-usage-statistics` 를 덧붙여 바꾼다 |
| 기록 | 몫 아님 | `portions` 에 `mcp.chrome-devtools` — **하네스 것으로 넘어간다** |
| 화면 | `⊘ opencode.json kept yours: mcp.chrome-devtools` | `opencode.json` 행이 **없다**(바꾼 사실을 말하지 않는다) |

기록이 넘어가면 그 뒤로는 기록대로 처리된다. uninstall 은 PR-D(B1: "다르면 몫만 strip") 뒤부터 이 서버를 걷고, `--without chrome-devtools` 도 이 서버를 지운다. 하네스 몫이 아닌데 몫으로 읽으면 ADR-096 의 "하네스 몫은 설치 기록 하나가 정한다" 와 이 PR 불변식 "설치자가 쓴 값이 이긴다" 를 둘 다 어긴다. github 도 같은 경로를 탄다. 설치자가 토큰 없이 옛 `server-github` 값을 손으로 넣었으면 백업 없이 **삭제**된다(④ 의 메커니즘). 다만 실제 설정은 대개 토큰 env 를 갖고 있어서 값이 같아질 일은 드물다.

**새 테스트 ①②④⑤ 가 만드는 상태는 실제로 생기지 않는다.** `oldInstall` 은 **지금 코드의** OpenCode 변환으로 서버를 쓴 뒤 `portions` 만 지운다. "옛 로그 + 하네스가 쓴 OpenCode 형식 서버 + 몫 기록 없음" 은 어느 판으로도 만들어지지 않는다(위 1·2). 그래서 이 테스트들은 메커니즘이 동작한다는 것만 증명하고, 사용자에게 효과가 있다는 것은 증명하지 않는다.

**재현** (`rev-E/probe-tests.ts` 의 R5 · R6. `tests/mcp-migration-167.test.ts` C 절 헬퍼를 그대로 쓴다):
```
oldInstall(["csr-fastapi"], ["claude","opencode"])
opencode.json: mcp = { "chrome-devtools": {type:"local", command:["npx","-y","chrome-devtools-mcp@latest"]} } , permission.edit = "ask"
toLegacyLog(); update(); → 9809d31: 값에 플래그 추가 · portions 에 mcp.chrome-devtools · 화면 행 없음
                        → src 를 6d6c8ec 로 되돌려 같은 테스트: 값 그대로 · portions 없음 · "kept yours: mcp.chrome-devtools"
```

**완료 기준**
- (a) R5 상태(옛 로그 · 이 파일 몫 0건 · 하네스가 만든 파일 · 설치자가 넣은 서버가 하네스 값과 같음)에서 update 뒤 설치자 값이 바이트 그대로이고, `portions` 에 그 키가 없다. 이것을 무는 회귀 테스트가 있다.
- (b) 이 씨를 남긴다면, 씨가 잡는 하네스 몫이 **실제 판들의 이력으로 생기는 상태**에 있다는 증거(어느 판이 그 상태를 만드는지)를 PR 이나 설계 §4.1 에 적는다. 증거가 없으면 이슈 #747 의 장면(옛 chrome-devtools 가 남는 옛 로그 설치본)은 이미 main 이 갱신한다는 R6 근거로 정정한다. 장면 정정은 설계 §4.1 의 Major 여부를 리드가 판정한다.
- (c) 화면 한 마디(`keptNote` → "usage statistics still on …")는 R5 사용자에게 **실제로 도움이 된다.** main 에서는 `kept yours` 만 뜬다. 씨와 분리해 남길 수 있다(판단은 구현 레인과 리드 몫).

---

## NOTE (BLOCKER 와 별개)

**N1 (MEDIUM) — 옛 로그 조건은 효과가 있다. 하지만 그 조건을 무는 테스트가 없다** (특히 판정할 것 2)
조건을 빼도 전 스위트는 green 이다(직접 확인). 하지만 빠지면 설치자가 무언가를 잃는다. R7: 기록 있는(writer) 설치본에서 OpenCode MCP 를 전부 `--without`(키 id)로 뺐다 → 이 파일 몫 0건 → 설치자가 옛 github 값을 손으로 넣는다 → update. 조건이 있으면 남고, 조건을 빼면 **백업 없이 삭제된다**(`github after undefined`). 렌더에 있는 이름은 제외 목록이 렌더에서 빼므로 후보에 안 들어간다(R4: chrome-devtools 는 조건 유무와 무관하게 남는다). 그래서 문제가 되는 것은 은퇴한 이름뿐이다. 이 상태를 누가 만드는지는 드물다. BLOCKER-1 을 씨 제거로 풀면 이 항목은 사라진다. 씨를 남기면 R7 모양의 테스트 1건이 싸다.

**N2 (MEDIUM) — "usage statistics still on" 이 거짓일 수 있다** (구현자 S2 확인)
공식 README 의 Usage statistics 절은 "`CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS` 나 `CI` 환경변수가 있으면 수집하지 않는다" 고 적는다. 설치자가 `environment` 로 통계를 껐어도 `usageStatisticsNote` 는 명령 배열만 보고 "still on" 이라고 말한다. 판정이 `environment` 의 그 키도 보아야 한다.

**N3 (LOW) — install(플래그 없음) 경로의 `sharedRow` 한 마디는 테스트가 안 문다** (구현자 G4)
특히 판정할 것 3: update 화면은 `sharedLeftRow`(update-mode `sharedLeft` 매핑)를 탄다. 그래서 `update-mode.ts` 에 필드 1개와 매핑 1줄을 더한 것은 맞다. 두 행이 같은 `keptNames` 를 써서 문구도 일관된다. install 쪽은 같은 함수라 위험은 작다.

## 확인한 것 (문제 없음)

- **과잉 매칭(특히 판정할 것 1)**: `environment` 추가(⑤ · ④ github) · 인자 순서 바꿈(R2) → 둘 다 잡지 않는다. 값은 그대로 남고 화면에 한 마디가 붙는다. 객체 키 순서만 다른 같은 값(R3)은 잡는다 — `jsonSha` 가 키를 정렬하기 때문이고, JSON 의미가 같으니 옳다. **PRIOR 값과 우연히 같은 설치자 서버**는 *설치자가 만든 파일*에서는 잡지 않는다(③). *하네스가 만든 파일*에서는 잡는다 → 이것이 BLOCKER-1 이다.
- **`knownServerValues` 이동(특히 판정할 것 4)**: 본문이 줄 단위로 같고 import 만 바뀌었다. uninstall 의 `remnantFor` 호출은 그대로다. `npm run ci` 에서 uninstall 계열 테스트가 green 이다.
- **변이(특히 판정할 것 5)**: 각 변이를 적용한 diff 와 `tsc --noEmit` exit 0 을 확인했다. M1(`legacySeed` → `legacySeedX`) → ①②④⑤ red. M2(이름만 대조 `known.has(key)`) → ②④⑤ red. M5(옛 로그 조건 제거) → 전 스위트 green, 위 N1. 복원은 `git checkout 9809d31 -- src` 로 했다.
- **`npm run ci`(특히 판정할 것 6)**: 파이프 없이 돌렸다(`npm run ci > ci.log 2>&1; echo EXIT=$?`). **EXIT=0** · branches 89.01% · build success. 로그 = `rev-E/ci.log`.

## Verdict 체크
- [x] CRITICAL 없음
- [x] DO NOT CHANGE 영역 미변경
- [ ] 완료 기준 충족 — **미충족**: BLOCKER-1. 불변식 "설치자가 쓴 값이 이긴다" 를, 실제로 생기는 유일한 상태(R5)에서 어긴다.

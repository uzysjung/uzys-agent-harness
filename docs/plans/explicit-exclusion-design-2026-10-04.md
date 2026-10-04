# 빼기는 명시할 때만 — 사라진 하네스 몫은 되돌리고 알린다 (v26.164.0 설계)

- 날짜: 2026-10-04 · 상태: 설계 3판(Fable 검증 1회 BLOCK 4 · NOTE 12, 2회 BLOCK 2 · NOTE 7 — 검증자가 준 문장으로 반영. `.handoff/bounty-reviews/verify-excl-design{,-2}.md`)
- 결정: 사용자 2026-10-04 "결정 3 추천대로" — 빼기는 `--without` 과 위저드 해제로만 기록하고, 사라진 하네스 부분은 **파일과 똑같이 update 가** 다시 넣고 알리며, 이미 잘못 굳은 기록은 한 번 풀어 준다.
- 대상 이슈: #566 · #616 · #675 · #641 · #633 (빼기 기록) + #598 · #584 (사라진 하네스 파일 복원)
- 근거 재현: `.handoff/recheck-26.163.0/recheck-a.md` · `recheck-b.md` — 26.163.0 에서 7건 모두 재현(26.162.1 과 동일 출력)
- 바꾸는 결정: ADR-097 §6.2 ⓒ · 설계 `one-principle-design-2026-09-27.md` Q4 와 §1.2 shared 행의 `deleted`/`exclude-portions` 칸. 새 ADR-099 가 대체한다.

## 0. 설치자에게 무엇이 달라지는가

**손으로 지운 것은 "빼 달라" 는 신호가 아니다 — 파일이든, 내 파일 안의 하네스 부분이든 같다.** update 와 install 은 사라진
하네스 몫을 되돌리고 화면에 "되돌렸다 · 영구히 빼려면 …" 을 말한다. 빼기는 `--without <id>` 와 위저드 체크 해제로만 기록되고
`--with <id>` 로만 풀린다. 그리고 **기록된 빼기는 다음 설치들이 모두 지킨다**(ADR-097 결정 7 의 누적 규칙이 이제 선택에도 걸린다).

| 이슈 | 설치자가 한 일 | 지금 | 이 설계 뒤 |
|---|---|---|---|
| #675 | 훅 스크립트를 지움 → update | 죽은 배선을 치우고 다음 실행이 "뺐다" 로 기록 → 훅 영구 미배선, 화면 `already in place` | update 가 스크립트와 `settings.json` 배선을 되돌린다. 이미 굳은 기록은 1회 풀려 같은 update 에서 배선이 돌아온다 |
| #641 | Codex 설정 구간 마커를 잘못 고쳤다가 되돌림 | 되돌린 뒤 install 이 구간 내용(`approval_policy`·`sandbox_mode`)을 지움 | 오타 동안은 구간 밖 같은 키를 설치자 것으로 두고 기록은 유지 · 되돌린 뒤에도 지우지 않는다(§3) |
| #633 | `opencode.json` 삭제 → update → 새로 작성 → update | 하네스 MCP 키 영구 배제 · install·`--reinstall` 도 복구 못 함 | update 가 하네스 MCP 키를 되돌리고 알린다 |
| #598 | AGENTS.md · `.codex/config.toml` · Codex 훅 스크립트를 지움 → update | 침묵 · 복원 안 함 · AGENTS.md 는 기록에서도 사라짐 | 되돌리고 `was missing — restored` |
| #584 | Antigravity 앵커를 지움 → update | 앵커도 이후 새 룰도 영영 안 옴 | 앵커와 룰을 되돌린다 |
| #566 | 외부 스킬을 `--without` 으로 빼고 폴더를 지움 → update | update 가 되살림 | 기록되고 install·update 가 깔지도 되살리지도 않는다 |
| #616 | `--with X --without X` | 화면은 넣었다, 실제는 뺐다 | 실행 전에 거절(exit 1, 아무것도 안 씀) |

**감수하는 것:**
- 일부러 `.mcp.json` 에서 하네스 서버를(또는 `AGENTS.md` 블록을) 지운 설치자는 **다음 update** 에 그것이 돌아온다 — 화면이 같은 줄에 영구히 빼는 명령을 말한다.
- **install 동작 변화**: 전에 `--without baseline:<id>` 로 뺀 것을 플래그 없이 다시 install 하면 지금은 되살아나지만, 이 설계 뒤에는 되살아나지 않는다. 되살리려면 `--with baseline:<id>`.
- update 가 `settings.json` · `.mcp.json` · `.gitignore` 의 **하네스 몫을 쓴다**(지금은 install 만 쓴다). 설치자 키는 지금 install 처럼 그대로다. USAGE 의 "`update` does not rewrite `settings.json`" 은 "`update` adds the harness part back" 이 된다.

## 1. 원칙

**`excluded` 는 설치자의 명시적 선택만 담고, 기록된 선택은 모든 설치가 지킨다. 하네스 몫이 디스크에서 사라진 것은 상태이지 선택이
아니다 — install·update 는 기록대로 되돌리고 그 사실을 말한다.** (ADR-096 의 "디스크 존재는 소유 근거가 아니다" 와 같은 축: 디스크
**부재**도 의사의 근거가 아니다.)

## 2. 규칙

**키 id 집합 (R2 · R4 · R5 공통).** 키 id 의 접두 집합은 `src/adapters/index.ts` `SHARED_FILES[*].prefix` **전부**다 — 설계·코드
어디에도 접두를 옮겨 적지 않고 그 표에서 유도한다(지금 7종: `claude-md:` `agents-md:` `settings:` `mcp:` `opencode:` `codex:`
`gitignore:`). R5 가 지우는 것 · R4 가 받는 것 · R2 의 restored 줄이 찍는 것은 같은 집합이고, 개별 id 는 `keyId` 로 만든다.

- **R1 쓰는 곳은 둘뿐.** `excluded` 에 더하는 것은 install 의 `--without <id>` 와 위저드 체크 해제뿐, 빼는 것은 `--with <id>` 뿐이다.
  어댑터의 "기록에 있는데 파일에 없는 키" 는 더는 `excluded` 로 가지 않고, **`deleted` 개념을 계약에서 지운다**(남기면 다음 사람이 다시
  잇는다): `adapters/contract.ts`(UpsertResult · planUpsert) · `install-writes.ts`(`deletedIds` · ledger) · `shared-write.ts` ·
  `cli-transforms.ts`(`deletedKeyIds`) · `installer.ts`(합치는 자리) · `update-mode.ts`(기록 쓰기) · `install-render.ts`(`you removed: …
  — not added back` 줄). 함께 `judge.ts` 의 `exclude-portions` · `sharedDeleted` · `hasPortions`(Q4 — 어느 호출부도 켜지 않는다)와
  그 테스트, 그리고 `one-principle-design-2026-09-27.md` §1.2 shared 행의 해당 칸을 이 설계 기준으로 고친다(judge 는 "표가 SSOT").
  `planUpsert`: 기록에 있고 파일에 없는 키는 **렌더에 있으면 `add`**(R2), **렌더에 없으면**(설치자 값이 구간 밖에 있어 걸러짐 등)
  아무것도 하지 않고 **기록 sha 를 portions 에 그대로 둔다**(되돌릴 근거).
- **R2 사라진 하네스 몫은 되돌린다 — update 도.** 기록에 있고 디스크(또는 파일 안)에 없는 하네스 몫은 install·update 가 다시 쓴다.
  - **함께 쓰는 파일**: update 는 install 과 같은 `createInstallWriter` · `writer.shared` 로 `.claude/settings.json`
    (`renderSettingsPortion` — claude 가 깔린 집합 · `--only hooks` 묶음) · `.mcp.json`(`writeMcpPortion`, 기록 트랙) · `.gitignore`
    (파일이 있을 때만)의 몫을 upsert 한다 — 지금 update 에는 이 세 파일의 쓰기 경로가 없다(`installer.ts` 의 세 `writer.shared` 호출뿐).
    그러면 `installNewAssets` 의 훅 `needsReinstall` 은 사라진다. `opencode.json` · `.codex/config.toml` · 첫 접촉 `AGENTS.md` 는 이미
    update 의 `refreshExternalCli` 가 쓴다.
    - 자리: step 0 `installNewAssets`(훅 스크립트 복원) **뒤**, step 3 `cleanStaleHookRefs` **앞** — 정리기가 최종본을 보고, 렌더의
      `hookInstalled(script)` 는 "복원 뒤 디스크에 있고 excluded 아님" 이다(스크립트 복원 전에 돌면 배선을 걷고 다음 실행에야 add — 2회).
    - 입력: install 이 넘기는 `legacySeed`(settings.json) · `legacyMcpSeed`(`.mcp.json`)를 같이 넘긴다 — 없으면 옛 로그의 하네스 몫이
      설치자 것(Q3)이 되어 영영 갱신되지 않는다.
    - `--only` 묶음: settings.json → `hooks` · `.mcp.json` → `external`(Codex·OpenCode MCP 와 같은 원천) · `.gitignore` → `rules`.
  - **refreshOnly 가드**: update 에서 없는 파일을 만들지 않는 것은 `owned-write.ts` 의 `refreshOnly && !createInRefresh` 가드다.
    **기준선(`externalFiles` 기록)에 있는 경로는 없어도 만든다** — '기록에 있다' 가 그 CLI 의 설치 증거다(`createInRefresh` 와 같은 자리).
    #584 체인(앵커 없음 → 룰도 못 받음)과 #598 이 이것으로 풀린다. `writeShared` 의 update 재생성(#633) 조건 = `externalFiles` 에 경로가
    있거나 `portions` 에 그 파일의 키가 있다 — `opencode.json` · `.codex/config.toml` · `AGENTS.md` 공통. 실제로 쓴 경우만 `created` 라
    보고하고, 만든 파일은 `rootFiles.change = created` 로 적는다(install 쪽 `install-writes.ts` 와 같은 배선을 `shared-write.ts` 에 둔다).
  - **기록 필터**: `mergeExternalFiles` 의 `existsSync` 필터를 **세 필드 전부**(`policyFiles` · `skillFiles` · `externalFiles`)에서
    없앤다 — 기록이 되살림의 근거라는 규칙은 필드를 가리지 않는다(은퇴는 `harnessRemove` 의 `forget`, `uninstall --cli` 는 그 CLI 의
    기록을 직접 걷는다 — 손실 경로 없음, 검증 확인).
  - **AGENTS.md 두 모델**: 파일이 없고 `portions` 에 `agents-md:*` 가 있으면 **블록 모델**로 블록만 담아 만들고 `rootFiles.change =
    created` 로 적는다. `externalFiles` 에 있으면(하네스가 만든 절 모델) 절 모델로 되살린다.
  - **`opencode.json` 재생성**: 첫 설치 생성과 같이 템플릿 seed(`$schema` 등) 위에 몫을 얹는다 — 화면은 `created from template (harness
    part + template defaults)` 로, `.codex/config.toml`(seed 없음)의 `wrote (harness part only)` 와 가른다.
  - **Claude 훅 스크립트**: 기록된 하네스 훅 스크립트(`recorded(log, ".claude/hooks/<script>")`)가 없으면 update 가 되돌리고 배선을
    둔다(update 단계 순서상 `installNewAssets` 가 정리 단계보다 앞이다). `cleanStaleHookRefs` 는 **기록에 없는** 스크립트 참조에만
    적용한다(#603 · #632 · #665 불변식은 그대로 — 검증 확인).
- **R3 `excluded` 에 있는 것은 깔지도 되살리지도 갱신하지도 않는다.** 독자는 모두 누적 결과를 읽는다: install 의 베이스라인 선택
  (`installer.ts` 의 `baselineExcluded` 와 그것을 받는 `installClaudeBaseline` · `installCliNeutralAssets` · `runCliTransforms` 의
  skills/rules 필터) · update 의 세 독자(`installNewAssets` · `installNewSkillDirs` · `refreshExternalCli`) · `refreshExternalSkills` ·
  install 의 외부 자산 선택 · `agents-skill-targets.ts` · `resident-entries.ts` · 위저드 체크 해제 표시(`interactive.ts`) — install 은
  `cumulativeExcluded(previousLog, 이번 --without, 이번 --with)`, update 는 `excludedIds(log)`. `spec.baselineExclude` ·
  `spec.skillExclude` 는 쓰기(옛 판 폴백)만 남기고 새 독자를 만들지 않는다. update 의 정책 파일 갱신(`updateDir` · `refreshPolicyBaseline`)
  도 `excludedIds(log)` 의 대상을 건너뛴다 — 뺐지만 디스크에 남은 파일을 새 판으로 바꾸지 않는다(`judge` 의 `excluded → leave` 와 같다).
  - **위저드 재체크**: 위저드는 확인 단계에서 **기록의 누적 빼기(`excludedIds(log)`)에 있는데 지금 체크된 id** 를 모두 `--with <id>` 로
    낸다(번들 스킬 · baseline 공통 — `computeUserOverride` 의 '추천 대비 차이' 만으로는 재체크가 보이지 않는다). `RUNS AS` 줄에 그
    `--with` 가 보이고 `installSpecFromOptions` 가 같은 입력을 받는다(D6). `classifyUpdateIntent` 의 해제 비교도 `excludedIds(log)` 기준.
    테스트: 전에 `--without baseline:rules/x` 한 기록에서 위저드로 x 를 재체크 → 확인 화면에 `--with baseline:rules/x` · 설치 뒤 파일 존재.
  - 이미 깔린 것을 `--without` 으로 빼면 **지우지 않는다**. 화면: `⊘ <id> — excluded (still on disk — an earlier install put it there;
    the harness does not delete it. Remove the file yourself, or run uninstall)`. `uninstall --only <id>` 는 카탈로그 자산(`log.assets`)
    줄에만 적는다(baseline · 번들 스킬에는 적지 않는다 — `--only` 가 그 둘을 받게 하는 것은 이 설계 밖).
  - 함께 쓰는 파일의 키 id 를 `--without` 으로 빼면 그 키는 strip 된다 — 기록 sha 와 같을 때만, 고쳤으면 남기고 말한다(훅 핸들러는
    N-f 대로 고쳤어도 뺀다 — 스크립트 참조라 남기면 죽은 참조).
- **R4 `--with`·`--without` 은 화면이 보여 주는 모든 id 를 받는다** — 카탈로그 · `baseline:` · 번들 스킬 · 키 id. 키 id 검증은
  접두만이 아니라 **이번 렌더가 내는 키 id 집합**(`renderHarnessMcp` · `renderSettingsPortion` · codex 구간 `top`/`tables` · opencode
  `mcp.<name>` · gitignore 줄 · `agents-md:agents`)과 대조한다 — 렌더 집합은 **깔린 CLI 집합 ∪ 이번 `--cli`**, **기록 트랙 ∪ 이번
  `--track`** 으로 계산한다(이번 `--cli` 에 없는 깔린 CLI 의 키도 받는다). 오타(`mcp:gitub`)는 지금처럼 `[WARN] Unknown … Skipping`.
- **R5 굳은 기록은 1회 푼다.** 새 판이 처음 쓰는 기록에서 `excluded` 의 **키 id**(위 접두 집합)를 지우고 기록에 표시
  `excludedKeysMigrated: true` 를 남긴다 — 표시가 있는 기록에서는 다시 돌지 않는다(R4 로 명시한 키 id 를 지우지 않기 위해서다; 판정
  근거는 기록 — `log.version` 은 update 가 갱신하지 않아 쓸 수 없다). `--without` 이 키 id 를 받은 판은 없으므로(검증 G1 참) 표시
  없는 기록의 키 id 는 전부 자동 추론이다. **키 아닌 id 는 마지막 설치가 실제로 존중한 것으로 맞춘다** — v26.162.0–26.163.0 은 기록만 누적하고 선택은 이번 플래그만 읽었으므로
  `excluded` 에 남은 baseline·번들·카탈로그 id 가 설치자의 마지막 선택과 다를 수 있다(뺀 뒤 플래그 없는 재설치로 다시 깐 경우). 판정
  근거는 전부 기록이다: baseline id 는 `spec.baselineExclude` 에 있는 것만, 번들 스킬 id 는 `spec.skillExclude` 에 있는 것만 남기고, 카탈로그
  id 는 `log.assets` 에 깔렸다고 적힌 것을 지운다(마지막 설치가 깔았다 = 그때 뺀 것이 아니다). 표시가 있는 기록은 이 정리를 다시 하지
  않는다 — 그 뒤의 `excluded ∩ assets` 는 R3 의 정당한 상태('뺐지만 지우지 않는다')다. 화면 `↺ restored N harness
  part(s) an earlier version had marked as removed — to drop one for good: install … --without <id>` 는 실제로 **되살린** 실행에서만 낸다.
- **R6 같은 id 를 `--with` 와 `--without` 에 함께 주면 거절한다**(#616) — plain CLI 경로의 `executeSpec` 앞에서
  `✗ '<id>' is in both --with and --without — pick one` · exit 1, 아무것도 쓰지 않는다. `installSpecFromOptions` 안의 부수효과로
  두지 않는다(위저드도 그 함수를 부르며, 위저드는 이 상태를 만들 수 없다 — `computeUserOverride` 는 서로소).

## 3. #641 걸음 (검증이 실행으로 확인)

1. 설치: `top` 구간 · `portions` 에 `codex:top` sha.
2. 마커 대소문자 변경 → `load()` 가 `top` 을 못 찾음. `filterRender` 가 항목이 하나도 안 남은 구간을 렌더에서 뺀다 → add 없음,
   아무것도 안 씀(검증 단위 테스트 `{changed:false}`). R1 로 `excluded` 에 적지 않고, `planUpsert` 의 새 규칙으로 `portions` 의
   `codex:top` 은 기록 sha 그대로 남는다.
3. 마커 복원 → 구간 present · `excluded` 없음 → strip 하지 않는다 → 손실 없음.
   변종(마커 깨짐 + 구간 내용 삭제 → R2 가 새 `top` 추가 → 마커 복원): 같은 이름 구간 둘 → 파서가 `null` → `leave+advise "harness
   markers are broken"` — 손실 없음. 화면에 복구법(중복 구간 하나 삭제)을 넣을지는 구현이 정한다.

## 4. 화면 · 문서

- restored 줄(파일·키 공통, install·update): `was missing — restored` + 행 끝 dim:
  - 키 id 가 있으면 `drop for good: install … --without <id>`
  - CLI 산출물(`externalFiles`)이면 `drop this CLI for good: uninstall --cli <name>`
- `you removed: … — not added back` 줄은 지운다(R1).
- USAGE: §update "Deleting a skill directory by hand is not the same signal" 를 파일·키 공통으로 · "`update` does not rewrite
  `settings.json`" 문장들 정정 · §기존 파일 표 `AGENTS.md` 행 "if you delete the block, it is not added back" → "is added back on the next
  update — drop it with `--without agents-md:agents`" · §플래그 표 `--with`/`--without` 에 키 id 와 "빼기는 다음 설치들이 지킨다".

## 5. 검증 (완료 기준)

- 7개 이슈의 26.163.0 재현 스크립트(recheck-a/b 의 rA/rB)를 이 판 `npm pack` 으로 Docker 에서 돌려 §0 "이 설계 뒤" 대로. #675 · #633 ·
  #641 은 26.163.0 으로 굳힌 상태에서 **이 판 update 1회**로 복구.
- **누적 규칙이 선택에도 걸리는 것**을 새 테스트로 묻는다: `--without baseline:rules/x` 뒤 플래그 없는 install · update 가 그 룰을
  깔지 않는다 · `--with baseline:rules/x` 로 돌아온다. `--without mcp:github` 는 기록 sha 와 같은 서버만 빼고 고친 서버는 남긴다.
- 새 동작마다 수정 없이는 실패하는 테스트 + 음성 대조(되돌린 코드 typecheck 통과).
- 머지 전 독립 리뷰(ADR-094 — update 쓰기 경로 · 기록 형식).

## 6. 구현 분할

| PR | 내용 | 이슈 | 의존 |
|---|---|---|---|
| A | R1(`deleted` 제거 + `planUpsert` 새 규칙 — 새로 지운 키도 1회에 돌아오게 여기서) · R3(독자 전부 누적 + 위저드 재체크 + `updateDir`) · R4 · R5(키 id 지움 + 키 아닌 id 정리 — R3 전환과 반드시 같은 PR) · R6 + judge/§1.2 표 · 문서 · ADR-099 Accepted | #616 #675 #641 #633(키) #566 | 없음 |
| B | R2 — update 의 함께 쓰는 파일 세 개 쓰기 · refreshOnly 가드 · 기록 필터 · AGENTS.md 두 모델 · 훅 스크립트 · `cleanStaleHookRefs` 범위 | #598 #584 #633(파일째) #675(배선) | A(같은 기록 쓰기 — 순차) |

A 만 나간 중간 판도 설치자를 지금보다 불리하게 두지 않는다(검증 N5) — `settings.json` · `.mcp.json` 몫은 B 전까지 install 에서 돌아온다.

## 7. 이 설계 밖 (같은 마일스톤의 다른 묶음)

#677(트랙 밖으로 새어 든 룰 회수) · #557(체크섬 없던 옛 판의 "edited" 문구) · #625(Codex 구간 편집 무음) · #595 · #658 · #585(기록 없는 프로젝트) · #600(설치 중단 — PR #691 로 따로 진행).

## 8. 가정 (검증 결과)

- G1 `--without` 이 키 id 를 받은 판은 없다 — **참**(`validIds` 이력).
- G2 위저드가 `excluded` 에 키 id 를 쓰는 경로는 없다 — **참**.
- G3 "파일째 없으면 몫만 담아 만든다" — `.codex/config.toml` 참 · `opencode.json` 은 seed 포함(R2 화면 문구로 가름) · `AGENTS.md` 는 R2 의 두 모델 규칙.

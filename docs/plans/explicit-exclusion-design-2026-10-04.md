# 빼기는 명시할 때만 — 사라진 하네스 몫은 되돌리고 알린다 (v26.164.0 설계)

- 날짜: 2026-10-04 · 상태: 설계(검증 전) · 결정: 사용자 2026-10-04 "결정 3 추천대로"
- 대상 이슈: #566 · #616 · #675 · #641 · #633 (빼기 기록) + #598 · #584 (사라진 하네스 파일 복원)
- 근거 재현: `.handoff/recheck-26.163.0/recheck-a.md` · `recheck-b.md` — 26.163.0 에서 7건 모두 재현(26.162.1 과 동일 출력)
- 바꾸는 결정: ADR-097 §6.2 ⓒ("기록에 있는데 파일에 없는 키 = 설치자가 지운 것 → `excluded` 자동 기록") · 설계
  `one-principle-design-2026-09-27.md` Q4(파일째 지움 → `excluded`). 새 ADR-099 가 이 둘을 대체한다.

## 0. 설치자에게 무엇이 달라지는가

**손으로 지운 것은 "빼 달라" 는 신호가 아니다 — 파일이든, 내 파일 안의 하네스 부분이든 같다.** update 는 사라진 하네스 몫을
되돌리고 화면에 "되돌렸다 · 영구히 빼려면 `install … --without <id>`" 를 말한다. 빼기는 `--without <id>` 와 위저드 체크
해제로만 기록되고, `--with <id>` 로만 풀린다. 지금은 파일(룰·스킬)만 이 규칙이고(USAGE §update "Deleting a skill directory
by hand is not the same signal"), 함께 쓰는 파일 안의 하네스 몫(`.mcp.json` 서버 · `settings.json` 훅 · Codex 설정 구간 ·
`opencode.json` MCP)은 사라지면 "설치자가 뺐다" 로 자동 기록돼 영영 돌아오지 않는다. 그 자동 기록이 설치자가 빼려 하지
않은 상태에서도 걸린다:

| 이슈 | 설치자가 한 일 | 지금 | 이 설계 뒤 |
|---|---|---|---|
| #675 | 훅 스크립트를 지움 → update | update 가 죽은 배선을 치우고, 다음 실행이 그걸 "뺐다" 로 기록 → 훅 영구 미배선, 화면은 `already in place` | update 가 스크립트를 되살리고 배선을 둔다. 이미 굳은 기록은 1회 풀린다(§2 R5) |
| #641 | Codex 설정 구간 표시를 잘못 고쳤다가 되돌림 | 오타 동안 `codex:top` 이 "뺐다" 로 기록 → 되돌린 뒤 install 이 그 구간 내용(`approval_policy`·`sandbox_mode`)을 지움 | 오타 동안은 구간 밖 같은 키를 설치자 것으로 보고 둔다(지금과 같음). 되돌린 뒤에도 빼기 기록이 없어 지우지 않는다(§3 걸음) |
| #633 | `opencode.json` 삭제 → update → 새로 작성 → update | 하네스 MCP 키 영구 배제 · install·`--reinstall` 도 복구 못 함 | update 가 하네스 MCP 키를 되돌리고 알린다 |
| #598 | AGENTS.md · `.codex/config.toml` · Codex 훅 스크립트를 지움 → update | 침묵 · 복원 안 함 · AGENTS.md 는 기록에서도 사라짐 | 되돌리고 `was missing — restored` |
| #584 | Antigravity 앵커 `.agents/rules/uzys-harness.md` 를 지움 → update | 앵커도 이후 새 룰도 영영 안 옴 | 앵커와 룰을 되돌린다 |
| #566 | 외부 스킬을 `--without` 으로 빼고 폴더를 지움 → update | update 가 되살림(빼기가 기록·존중되지 않음) | 기록되고, install·update 가 그 자산을 깔지도 되살리지도 않는다 |
| #616 | `--with X --without X` 를 함께 줌 | 화면은 넣었다, 실제는 뺐다 | 실행 전에 거절(exit 1, 아무것도 안 씀) |

**감수하는 것:** 일부러 `.mcp.json` 에서 하네스 서버를 지운 설치자는 다음 update 에 그 서버가 돌아온다 — 화면이 영구히
빼는 명령(`--without mcp:github`)을 같은 줄에 말한다. 문서의 "블록을 지우면 다시 넣지 않는다"(USAGE §기존 파일 표 `AGENTS.md`
행)는 이 규칙으로 바뀐다.

## 1. 원칙 (한 문장 + 따름 규칙)

**`excluded` 는 설치자의 명시적 선택만 담는다. 하네스 몫이 디스크에서 사라진 것은 상태이지 선택이 아니다 — install·update 는
기록대로 되돌리고 그 사실을 말한다.** (디스크 존재는 소유의 근거가 아니다(ADR-096)와 같은 축: 디스크 **부재**도 의사의 근거가 아니다.)

## 2. 규칙

- **R1 쓰는 곳은 둘뿐.** `excluded` 에 id 를 더하는 것은 install 의 `--without <id>` 와 위저드 체크 해제(같은 `forceExclude` ·
  `baselineExclude` 경로)뿐이다. 빼는 것은 `--with <id>` 뿐이다. 어댑터 `upsert` 의 `deleted`(기록에 있는데 파일에 없는 키)는
  더는 `excluded` 로 가지 않는다 — `installer.ts` `composeWriterLog`(deletedIds) · `update-mode.ts`(deletedKeyIds) ·
  `cli-transforms.ts`(deletedKeyIds) 세 자리. 누적 규칙(`cumulativeExcluded`)은 그대로다.
- **R2 사라진 하네스 몫은 되돌린다.** 기록에 있고 디스크(또는 파일 안)에 없는 하네스 몫은 install·update 가 다시 쓴다 — 판정은
  지금 `judge` 의 "sha · 디스크 없음 → create(update 는 `was missing — restored`)" 칸 그대로이고, 이 칸을 **지나가지 않던 경로**를
  거기로 보낸다:
  - 함께 쓰는 파일의 키: 어댑터 `planUpsert` 의 "recorded · present 없음" 을 `deleted`(되살리지 않음)에서 `add`(되살림)로.
    화면 줄은 `restored`. 파일째 없으면(#633) 기록된 몫만 담아 만든다 — 하네스가 만든 파일이었든 설치자 파일이었든 같다
    (몫은 하네스 것이고 파일 생성 자체는 그 몫을 놓을 자리다).
  - CLI 변환 산출물(`AGENTS.md` · `.codex/config.toml` · `.codex/hooks/*` · `.agents/rules/uzys-harness.md` 와 룰): update 가
    변환을 다시 돌리는 조건에 "기록된 산출물이 없다" 를 넣는다(#598 · #584). 기록(`externalFiles`)에서 사라진 파일을 지우는
    `mergeExternalFiles` 의 `existsSync` 필터는 기록을 지우는 대신 남긴다 — 되돌릴 근거가 기록이다.
  - Claude 훅 스크립트(`.claude/hooks/*.sh`): 기록된 하네스 훅 스크립트가 없으면 update 가 되돌리고 배선을 그대로 둔다.
    `cleanStaleHookRefs` 는 **기록에 없는** 스크립트를 가리키는 참조에만 적용한다(설치자·팀 몫은 지금처럼 install 에서 알리기만 —
    #603). 그러면 `dropHealedHookPortions`(#632)는 하네스 훅에 대해 할 일이 없어진다 — 지우지 말고 옛 상태 정리에만 남기는지는
    구현이 판단한다.
- **R3 `excluded` 에 있는 것은 깔지도 되살리지도 갱신하지도 않는다** — 번들·baseline·외부 자산·키 id 모두(#566: `refreshExternalSkills` ·
  install 의 외부 자산 선택이 `excluded` 를 읽는다). 이미 깔린 자산을 `--without` 으로 빼면 **지우지 않는다** — 지우는 동작은
  `uninstall --only <id>` 이고 확인이 걸린다. 화면: `⊘ <id> — excluded; still installed — remove with: uninstall --only <id>`.
  함께 쓰는 파일의 키 id 를 `--without` 으로 빼면 그 키는 지금처럼 strip 된다(기록 sha 와 같을 때만, 고쳤으면 남기고 말한다).
- **R4 `--with`·`--without` 은 화면이 보여 주는 모든 id 를 받는다** — 카탈로그 · `baseline:` · 번들 스킬 · 키 id(`mcp:<name>` ·
  `settings:statusLine` · `settings:hooks.<Event>#<script>` · `codex:top` · `codex:tables` · `opencode:mcp.<name>` · `gitignore:<line>`).
  검증은 `commands/install.ts` `installSpecFromOptions` 에서 id 종류별로(키 id 는 `adapters/index.ts` `keyId` 가 만드는 모양). 모르는
  id 는 지금처럼 경고 후 무시. R2 의 restored 줄이 찍는 id 와 `--without` 이 받는 id 는 **같은 함수**에서 나온다.
- **R5 굳은 기록은 1회 푼다.** 새 판이 처음 쓰는 기록에서 `excluded` 의 **키 id**(`mcp:` · `settings:` · `codex:` · `opencode:` ·
  `gitignore:` 접두)를 지운다 — 지금까지 `--without` 이 키 id 를 받지 않았으므로(`installSpecFromOptions` 의 `validIds` = 카탈로그 +
  baseline) 기록된 키 id 는 전부 R1 이전의 자동 추론이다. 카탈로그 · baseline · 번들 스킬 id 는 설치자의 명시적 선택이라 남긴다.
  화면 1회: `↺ restored N harness part(s) an earlier version had marked as removed — to drop one for good: install … --without <id>`.
  표시(재실행 방지)는 기록에 한 필드 — 예 `excludedKeysMigrated: true` — 를 두거나, 키 id 를 R4 로 받기 시작한 판의 기록인지로
  판정한다(구현 선택. 판정 근거는 기록이어야 한다).
- **R6 같은 id 를 `--with` 와 `--without` 에 함께 주면 거절한다**(#616) — 아무것도 쓰기 전에 `✗ '<id>' is in both --with and
  --without — pick one` · exit 1. 위저드는 이 상태를 만들 수 없다.

## 3. #641 걸음 (R1 만으로 손실이 사라지는지)

1. 설치: `top` 구간(`approval_policy` · `sandbox_mode`) · 기록 `portions` 에 `codex:top` sha.
2. 설치자가 마커 대소문자를 바꿈 → install/update: `load()` 가 `top` 구간을 못 찾는다(present 없음). `filterRender` 는 구간 밖에
   같은 키가 있으므로 렌더에서 뺀다(`kept yours`). R2 로 `codex:top` 은 `add` 가 되지만 렌더가 비어 쓸 내용이 없다 → 아무것도
   안 쓴다. **R1 로 `excluded` 에 기록하지 않는다.** 기록 `portions` 의 `codex:top` 은 남긴다(되돌릴 근거).
3. 설치자가 마커를 되돌림 → 구간이 다시 보인다 · 기록 sha 와 같으면 갱신 대상, 다르면 `kept`. `excluded` 에 없으므로 **strip 하지
   않는다.** → 손실 없음.
   (구현이 확인할 것: 2단계에서 `codex:top` 이 `add` 로 빈 구간을 만들어 3단계에 구간이 둘이 되는 경로가 없는지 — 있으면 "렌더가
   빈 몫은 add 하지 않는다" 를 어댑터 공통으로.)

## 4. 화면 · 문서

- update 요약: 되돌린 하네스 몫은 파일·키 모두 `restored` 행(`was missing — restored`)에 이름과 함께, 행 끝 dim 으로
  `drop for good: install … --without <id>`(id 가 있을 때). install 도 같은 문구.
- USAGE: §update 의 "Deleting a skill directory by hand is not the same signal" 문단을 파일·키 공통으로 넓힌다 · §기존 파일 표의
  `AGENTS.md` 행 "if you delete the block, it is not added back" → "is added back on the next update — drop it with `--without`" ·
  §플래그 표 `--with`/`--without` 에 키 id 종류.
- `you removed: … — not added back`(`install-render.ts`)은 R1 뒤 나올 일이 없다 — `excluded` 키를 strip 했을 때의 문구로 바꾸거나 지운다.

## 5. 검증 (완료 기준)

- 7개 이슈의 26.163.0 재현 스크립트(recheck-a/b 의 rA/rB 스크립트)를 이 판 `npm pack` 으로 Docker 에서 돌려 §0 표 "이 설계 뒤" 대로
  나온다. #675 · #633 · #641 은 26.162.1/26.163.0 으로 굳힌 상태에서 이 판 update 1회로 복구되는 것까지.
- 회귀: `--without <catalog id>` · `--without baseline:…` 의 기존 동작(누적 · `--with` 로 해제)이 그대로다. `--without mcp:github`
  가 기록 sha 와 같은 서버만 빼고 고친 서버는 남긴다.
- 새 동작마다 수정 없이는 실패하는 테스트 + 음성 대조(되돌린 코드 typecheck 통과).
- 머지 전 독립 리뷰(ADR-094 — update 쓰기 경로 · 기록 형식).

## 6. 구현 분할

| PR | 내용 | 이슈 | 의존 |
|---|---|---|---|
| A | R1 · R4 · R5 · R6 + 문서 · ADR-099 Accepted | #616 #675 #641 #633(빼기 쪽) | 없음 |
| B | R2 · R3 — 사라진 하네스 몫 되돌리기(키 · CLI 산출물 · 훅 스크립트) + 외부 자산 `excluded` 존중 | #598 #584 #566 #633(복원 쪽) | A(같은 `update-mode.ts` 기록 쓰기 — 순차) |

## 7. 이 설계 밖 (같은 마일스톤의 다른 묶음)

#677(트랙 밖으로 새어 든 룰 회수) · #557(체크섬 없던 옛 판의 "edited" 문구) · #625(Codex 구간 편집 무음) · #595 · #658 · #585(기록 없는 프로젝트) · #600(설치 중단).

## 8. 가정 (검증자가 볼 것)

- G1 `--without` 이 키 id 를 받은 판은 없다(R5 의 근거) — `installSpecFromOptions` 의 `validIds` 이력으로 확인.
- G2 위저드가 `excluded` 에 키 id 를 쓰는 경로는 없다.
- G3 R2 의 "파일째 없으면 몫만 담아 만든다" 가 설치자가 일부러 지운 **자기** 파일을 되살리는 것으로 읽히지 않는다 — 만들어지는
  것은 하네스 몫뿐이고 설치자 키는 없다. 화면이 그 파일을 만들었다고 말한다.

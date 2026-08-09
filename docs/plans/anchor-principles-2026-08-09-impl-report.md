# 이슈 #287 구현 보고 — 배포 앵커 7원칙 재편 적용

작성 2026-08-10 · 브랜치 `refactor/anchor-working-principles` · 레인 = implementer(구현)
· 입력 SSOT = `docs/plans/anchor-principles-2026-08-09.md` §A

**한 줄**: 초안 전문을 `templates/CLAUDE.md` 에 **바이트 단위로 복사**해 넣었고, 그로 인해 red 가 된
계측 게이트 2종(ratchet · NORTH_STAR tolerance 0)을 정당화 절차대로 닫았다. `npm run ci` **exit 0**.
게이트는 한 줄도 고치지 않았다.

---

## 0. 입력 대조 — 두 사본이 같은가

지시받은 대로 판정문의 §A 코드펜스와 스크래치패드 사본을 먼저 대조했다.

```
$ node -e '... plan.slice(14,217) vs scratchpad/candidate-anchor.md ...'
fence open  line14 = "```markdown"
fence close line218= "```"
body lines = 203 chars = 13018
scratch lines = 203 chars = 13018
IDENTICAL = true
```

**차이 0.** 따라서 "다르면 판정문을 따른다" 분기는 발생하지 않았다. 이후 모든 작업은 판정문
`docs/plans/anchor-principles-2026-08-09.md` 14줄~218줄 사이의 본문을 SSOT 로 썼다.

---

## 1. `templates/CLAUDE.md` 가 초안과 일치하는가

**타이핑하지 않고 복사**했다 — "초안 문장을 다듬지 마라"를 사람의 주의력이 아니라 절차로 지켰다.

```
$ node -e 'fs.writeFileSync("templates/CLAUDE.md", plan.slice(14,217).join("\n")+"\n") ...'
before: lines 142 chars 6739
after : lines 203 chars 13018
byte-identical to SSOT fence = true
first line : "# Working Principles"
last  line : "instructions are worth loading every session only for as long as they are still true."
trailing newline count = 1
```

| | before | after |
|---|---|---|
| 줄 수 | 142 | **203** |
| 문자 수 | 6,739 | **13,018** |
| 첫 줄 | `# Uzys-agent-harness CLAUDE.md` | **`# Working Principles`** |
| 마지막 줄 | `changed, and a release additionally runs the full suite and the end-to-end flows.` | **`instructions are worth loading every session only for as long as they are still true.`** |
| 파일 끝 개행 | 1 | **1** |

코드펜스 마커(```` ```markdown ````· ```` ``` ````)는 넣지 않았다 — 슬라이스가 14줄(펜스 열기)
**다음**부터 217줄(펜스 닫기 **직전**)까지다. `byte-identical = true` 가 이것을 증명한다.

**배포 위생** — 금지 4패턴 0건 유지:

```
$ grep -cE "ADR-[0-9]{3}|v[0-9]+\.[0-9]+\.[0-9]+|/Users/|docs/research/" templates/CLAUDE.md
0
```

---

## 2. `npm run ci` — exit 0

파이프 없이 파일로 받아 exit code 를 직접 읽었다(`ship-checklist` 의 "exit code 를 파이프 뒤에서
읽지 마라").

```
$ npm run ci > /tmp/ci-anchor.log 2>&1; echo "EXIT=$?"
EXIT=0
```

```
 Test Files  91 passed (91)
      Tests  1296 passed (1296)

All files          |    96.4 |     88.8 |   96.11 |    96.9 |
Statements   : 96.4%  ( 2280/2365 )
Branches     : 88.8%  ( 1332/1500 )
Functions    : 96.11% ( 396/412 )
```

**branches 88.8 ≥ 하한 88** (`vitest.config.ts` SSOT). 1회에 통과했다 — 고쳐 가며 초록을 만든
구간은 없다.

---

## 3. 개별 게이트 (지시된 2종)

```
$ npx vitest run tests/lane-principle-anchor-parity.test.ts
 ✓ tests/lane-principle-anchor-parity.test.ts (27 tests) 33ms
      Tests  27 passed (27)      EXIT=0

$ npx vitest run tests/resident-doc-asset-reachability.test.ts
 ✓ tests/resident-doc-asset-reachability.test.ts (3 tests) 103ms
      Tests  3 passed (3)        EXIT=0
```

판정문 §F-3 이 예측한 **27 passed** 와 일치한다. 파리티 게이트는 **한 글자도 고치지 않았다.**

---

## 4. `context-cost-baseline.json` before → after

`npm run cost:baseline` 은 지시받은 대로 초안 적용 **후에** 돌렸다(= 게이트가 요구하는 정당화 절차,
증가 승인은 사용자 확정 사항).

| 트랙 | items before → after | tokens before → after |
|---|---|---|
| **tooling** | 23 → **23** | 4,755 → **6,325** (+1,570) |
| full | 32 → 32 | 5,542 → 7,112 (+1,570) |
| csr-fastapi | 27 → 27 | 5,092 → 6,662 (+1,570) |
| ssr-nextjs | 26 → 26 | 5,044 → 6,614 (+1,570) |
| csr-supabase | 25 → 25 | 5,004 → 6,574 (+1,570) |
| csr-fastify | 25 → 25 | 5,004 → 6,574 (+1,570) |
| ssr-htmx | 25 → 25 | 5,004 → 6,574 (+1,570) |
| data | 24 → 24 | 4,687 → 6,257 (+1,570) |
| executive | 17 → 17 | 3,904 → 5,474 (+1,570) |
| project-management | 14 → 14 | 3,650 → 5,220 (+1,570) |
| growth-marketing | 14 → 14 | 3,650 → 5,220 (+1,570) |

**11 트랙 전부 정확히 +1,570 tok, 개수 축은 전 트랙 불변** — 판정문 §D-3 의 예측(+1,570 · 23 불변)과
자릿수까지 일치한다. 증가가 모든 트랙에서 동일한 이유는 앵커가 `applies: all` 이기 때문이다.

---

## 5. `docs/NORTH_STAR.md` — 고친 줄과 근거

고친 곳은 **"현재 상태" 인용 블록 하나**(110~122줄 → 110~126줄, 12줄 → 16줄). 다른 곳은 안 건드렸다.

### 게이트가 읽는 두 줄 (tolerance 0)

`tests/north-star-cost-figures.test.ts` 가 어떤 문자열을 어떻게 파싱하는지 **먼저 읽고** 위치를
확인한 뒤 고쳤다:

```
$ node -e '<게이트와 같은 정규식으로 첫 매치 위치 확인>'
rules                line 112  -> "rules 6개 ~1,092"
CLAUDE\.md           line 113  -> "CLAUDE.md 2개 ~2,647"
agent descriptors    line 113  -> "agent descriptors 9개 ~724"
skill descriptors    line 113  -> "skill descriptors 6개 ~292"
TOTAL                line 112  -> "상주 23개 항목 · ~4,755 tokens"
```

`.exec()` 는 **첫 매치**를 쓰므로, 서사 문장에 같은 형태(`CLAUDE.md N개 ~T`)를 두 번째로 만들지
않도록 "직전(2026-08-04, 23개 ~4,755)" 처럼 라벨 없이 적었다.

| 축 | before | after | 실측 출처 |
|---|---|---|---|
| 총합 | `상주 23개 항목 · ~4,755 tokens/세션` | `상주 23개 항목 · **~6,325**` | `npm run cost:report tooling` |
| CLAUDE.md | `2개 ~2,647` | `2개 **~4,217**` | 〃 |
| rules · agent · skill | 1,092 / 724 / 292 | **불변** | 〃 (앵커 외 표면은 안 움직였다) |

실측 원문(`npm run cost:report tooling`, EXIT=0):

```
▸ 상주 비용 — 설치가 매 세션 물리는 것 (track=tooling)
                       개수    토큰
  rules                6개  ~1092
  CLAUDE.md             2개  ~4217
  skill descriptors    6개  ~292
  agent descriptors    9개  ~724
  ─────────────────────────────────
  상주 합계           23개 상주 · ~6325 tokens/세션
```

### 서사 (숫자만 바꾸지 않았다)

직전 사이클 서사는 "룰에서 판단 원칙만 남겨 **−1,082**, 개수보다 토큰이 크게 줄어드는 것이
다이어트 사이클의 형태"였다. 방향이 반대가 됐으므로 서사도 뒤집었다:

- 증가분이 **전부 배포 앵커 한 파일**에서 났음을 명시(`templates/CLAUDE.md` 1,685 → 3,255,
  스캐폴드 962 불변). 이 두 수는 실측 surface 합에서 유도했다 — `2,647 − 1,685 = 4,217 − 3,255 = 962`
  이고, 토큰식은 `Math.ceil(chars/4)`(`src/context-cost.ts:18-22`)라 `ceil(6739/4)=1685` ·
  `ceil(13018/4)=3255` 로 §1 의 문자 수와 맞는다.
- "다이어트 사이클의 **역방향**" — 개수는 그대로인데 토큰만 오르는 형태로 다시 씀.
- 채운 공백 5건을 이름으로 나열(비코드 트랙의 code/tests 독법 · 빈 결과는 부재의 증거가 아니다 ·
  승인 대상 예시 · 판단층↔집행층 경계 · 이 지시층의 유지).
- **항목별 토큰 내역은 옮겨 적지 않고** 판정문 §D·§E 를 가리켰다(doc-governance "한 사실은 한 곳에").
  옮겨 적으면 `4,755` 처럼 두 번째 사본이 다음 사이클에 썩는다.
- 누적 비교 줄도 실측에 맞게 정정: `30개 ~7,570 → 23개 ~4,755 (−2,815)` → `→ 23개 ~6,325 (−1,245)`.
- baseline 을 올린 사실과 **그 승인이 사용자 결정**이라는 것을 한 줄로 남겼다.

---

## 6. 음성 대조 — 초록이 실제로 무는가

초록불만으로는 "게이트가 무는데 통과"와 "게이트가 죽어서 통과"가 구분되지 않는다. 세 축을 각각
**한 곳만 되돌린 사본**으로 재고, 매번 원본으로 복원한 뒤 **sha256 일치**를 확인했다.

| # | 되돌린 것 | 게이트 | 결과 | 예측(§F-4) |
|---|---|---|---|---|
| a | `context-cost-baseline.json` 을 갱신 전으로 | `context-cost-ratchet` | **RED — 11 failed \| 45 passed (56)** | 토큰 축 red ×11 ✅ |
| b | NORTH_STAR 의 `~4,217` → `~2,647` | `north-star-cost-figures` | **RED — 1 failed \| 3 passed (4)** | tolerance 0 red ✅ |
| c | 새 앵커에서 축2 술어(`verifies the work itself rather than trusting`)만 제거 | `lane-principle-anchor-parity` | **RED — 4 failed \| 23 passed (27)** | 축2 red ×4 ✅ |

```
PRE-HASH  {"templates/CLAUDE.md":"0f57d7d22f55","docs/NORTH_STAR.md":"49bdb829087d","context-cost-baseline.json":"b71dc2cf42da"}
(a) baseline 미갱신       -> ratchet          : RED (Tests  11 failed | 45 passed (56))
(b) NORTH_STAR 수치 stale -> north-star-figures: RED (Tests  1 failed | 3 passed (4))
POST-HASH {"templates/CLAUDE.md":"0f57d7d22f55","docs/NORTH_STAR.md":"49bdb829087d","context-cost-baseline.json":"b71dc2cf42da"}
RESTORED IDENTICAL = true

PRE-HASH  0f57d7d22f55
(c) 축2 술어 제거 -> anchor-parity: RED (Tests  4 failed | 23 passed (27))
    ✓ .claude/CLAUDE.md 앵커의 [검증의 자기 증거] 축이 2성분을 한 문단 안에 갖는다 0ms
POST-HASH 0f57d7d22f55 | RESTORED IDENTICAL = true
```

(c) 의 **4** 는 우연이 아니다 — 배포 앵커 4종(claude + codex/opencode/antigravity 렌더 산출물)만
빨간불이고, 술어가 한국어(`직접 다시 돌려`)인 리포 앵커 `.claude/CLAUDE.md` 는 손대지 않았으므로
초록으로 남았다. 게이트가 **파일별로** 채점하고 있다는 증거다.

**부수 기록**: (c) 의 첫 시도는 변이 대상 문자열을 못 찾아 스크립트가 **스스로 멈췄다** — 앵커가
그 문장을 두 줄로 wrap 하는데 검색어는 한 줄이었다. 가드를 안 넣었으면 "변이 없이 초록"을 음성
대조 성공으로 오독할 뻔했다(`test-policy` 의 변이 생존 형태).

복원 후 재확인:

```
$ npx vitest run <위 5개 게이트>
 Test Files  5 passed (5)
      Tests  98 passed (98)      EXIT=0
```

---

## 7. 손댄 파일 · 안 손댄 파일

```
$ git status --porcelain
 M .claude/settings.json          ← 사용자 소유. 안 건드렸다(착수 시점부터 M)
 M .claude/skills/.DS_Store       ← 사용자 소유. 안 건드렸다(착수 시점부터 M)
 M context-cost-baseline.json     ← 내 변경 (npm run cost:baseline 산출)
 M docs/NORTH_STAR.md             ← 내 변경 (수치 + 서사)
 M templates/CLAUDE.md            ← 내 변경 (초안 전문 교체)
?? docs/plans/... (착수 시점부터 untracked)
```

git 은 **읽기만** 했다(`status` · `diff` · `diff --stat`). add·commit·checkout·stash·push 없음 —
커밋은 오케스트레이터 몫이다.

---

## 8. 미완 · 미검증 (완료로 보고하지 않는 것)

- **독립 리뷰 없음.** 이 보고는 구현 레인이 쓴 것이고, 구현자는 자기 산출물을 판정하지 않는다.
  방금 넣은 앵커 §5 의 문장 그대로 — 리뷰 전까지 이 산출물은 **미검증**이다.
- **실환경 4 CLI 설치 미확인.** 판정문 §F-3 의 6번(`bash test/docker/run.sh <시나리오>`)은 안 돌렸다
  — 지시받은 완료 기준 6개에 없었다. 파리티 게이트가 무는 것은 **렌더 산출물**이지 실제 설치본이
  아니므로, "4 CLI 설치본에서 앵커 제목·본문이 맞다"는 아직 아무도 안 봤다.
- **문안이 모델 행동을 바꾸는지는 측정하지 않았다.** 전부 문면·배선·계측 판정이다(판정문 §F-5 와
  같은 한계).
- **`npm test` 가 아니라 `npm run ci` 로 재확인했다** — coverage gate 포함. 그 외 릴리즈 단
  게이트(E2E · install-matrix · `npx ecc-agentshield scan` · `npm audit`)는 **안 돌렸다**. 이번
  변경은 마크다운 1개 + 계측 JSON + 문서 1개라 코드 표면이 없지만, 안 돌린 것은 안 돌린 것이다.
- **오탈자·마크다운 파손 보고할 것 없음.** 초안 203줄을 옮기는 과정에서 고칠 곳을 발견하지 못했고,
  발견했더라도 고치지 않고 여기 적었을 것이다. 바이트 동일성으로 "안 다듬었음"이 증명된다.

## 9. 판정을 요청하지 않고 멈춘 지점 — 없음

지시가 두 갈래로 읽히는 지점, 시키지 않은 파일을 고쳐야 풀리는 지점, 게이트를 고쳐야만 통과하는
지점은 **한 건도 없었다.** 특히 `tests/lane-principle-anchor-parity.test.ts` 는 초안 문안 그대로
27개 전부 초록이라, 게이트 수정을 검토할 상황 자체가 발생하지 않았다.

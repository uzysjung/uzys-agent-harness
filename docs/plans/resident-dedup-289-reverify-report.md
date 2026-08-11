# 재검증 보고 — #289 룰 완화 델타 (독립 레인)

- 대상: `0bdb816`(룰 4종 재작성 + 개발 사본 1 + 수치) — 그리고 **`d612318` 에 섞여 있던 ship-checklist 완화 2건**(1차 검증 보고서의 대상 밖이라 지금까지 아무 레인도 보지 않았다).
- 브랜치 `refactor/resident-layer-dedup-289`, main `c061d5f` 위 5커밋. 실행 일자 2026-08-11.
- 레인: 재검증(구현 레인과 분리). 구현 보고를 근거로 쓰지 않고 명령을 직접 돌렸다. 작업 트리 원상 복구 확인(§G).

## 판정

**조건부 머지 가능** — 수치·게이트는 전부 재현되지만, 완화 과정에서 **`시크릿을 커밋하지 않는다`가 배송 층에서 통째로 사라졌고**(어느 문서에도 고지 없음), 새 중복 4건이 생겼으며, `ship-checklist` 의 배선 요구 삭제는 이 저장소 자신의 실측 증거와 반대 방향이다.

| 축 | 결과 |
|---|---|
| 가드레일을 잃었는가 | **잃었다** — 확정 3건(시크릿 커밋 금지 · Change Log 요구 · 배선 요구), 부분 손실 4건 |
| 새 중복이 생겼는가 | **생겼다** — 앵커 재진술 3건 + 파일 내 재진술 2건. `−102 → −29` 의 +73 중 상당분이 여기다 |
| 게이트 시어터인가 | **아니다(의도 충족)** — 두 게이트 다 리터럴이 아니라 성분을 물고, 변이로 무는 것을 확인했다(MUT-1·2) |
| 완화 자체를 무는 게이트 | **`ppid=1` 한 자리 말고는 없다** — 핵심 가드레일 2개를 **반대 의미로 뒤집어도** `npm run ci` exit 0 · 1340 passed(MUT-3) |
| 수치 | 전부 참(4,945 / 룰 1,063 / 앵커 2,866 · −23 · 룰 −29 · 앵커 +6 · **−102 직접 재현**) |
| 범위 침범 | 없음 — 11파일, `src/`·`tests/` 무변경 |

---

## 완화 5건 손실 대조표 (핵심)

### ① test-policy — 고위험 변경의 경로 커버리지

| | 원문 |
|---|---|
| **옛(main `c061d5f`:6-7)** | `For high-risk changes—…—test normal, boundary, failure, misuse, and recovery paths.` |
| **새(HEAD:5-7)** | `…—cover relevant normal, boundary, failure, misuse, and recovery paths.` |
| **막던 실패 모드** | 인증·결제·마이그레이션을 고치고 happy path 만 테스트하고 나간다 |
| **여전히 막는가** | **부분적으로만.** `relevant` 의 판정자는 변경을 만든 그 에이전트이고, 판정 기준도 기본값도 문장에 없다 — "이 변경엔 recovery path 가 relevant 하지 않다"는 **주장만으로 충족되는** 조건이다 |

같은 파일의 다른 문장들은 판단을 맡기되 **기준을 함께 준다**: `best exposes plausible failures`(:3) · `If the affected scope cannot be established confidently, broaden the validation`(:18). `cover relevant` 만 기준 없이 판단만 남았다. 완화의 취지(auth 를 건드렸다는 이유만으로 recovery 테스트를 만들어내는 기계적 해석 차단)는 타당하지만, 취지를 살리면서 기준을 남기는 형태(예: 실패가 그럴듯한 경로는 빼지 않는다)가 존재하므로 **현 문안은 필요 이상으로 약하다.** → 결함 5

### ② test-policy — 격리·결정성

| | 원문 |
|---|---|
| **옛(main:8-9)** | `Keep tests **isolated**, repeatable, and deterministic. **Control** time, randomness, shared state, execution order, network, and external services.` |
| **새(HEAD:8-10)** | `Keep tests repeatable and deterministic. **Control or explicitly account for** sources of nondeterminism such as time, randomness, …, network, and external services.` |
| **막던 실패 모드** | 실행 순서·공유 상태·외부 호출에 의존해 간헐 실패하는 테스트 |
| **여전히 막는가** | **약해졌다.** ⓐ `isolated` 삭제는 큰 손실이 아니다 — 그 실질(`shared state`·`execution order`)이 열거에 그대로 남아 "격리하지 않아도 된다"로는 읽히지 않는다. ⓑ **진짜 손실은 `Control` → `Control or explicitly account for` 다.** 통제하지 않아도 **사유만 적으면 되는 길**이 열렸다. 남은 방어는 `Do not hide failures by … adding indiscriminate retries`(:14) 뿐이다 |

**완화 사유(주장 2)를 검증했다 — 전제가 과장이다.**
- `.claude/rules/test-policy.md:34-36` 에 Dev-Prod Parity 가 **실재한다**(`개발/테스트 DB 엔진은 Prod 와 동일해야 한다 … SQLite 대체 금지`). 전제 절반은 참.
- 그러나 옛 배포 문안이 "외부는 항상 mock" 으로 읽힌다는 주장은 **바로 다음 줄을 빼고 읽어야 성립한다**. main:10-11 이 `Use production-compatible dependencies when behavioral differences could affect validity. Otherwise, use explicit test doubles…` 로 **prod 호환 의존성을 우선**하라고 이미 못 박고 있었다. 두 줄을 함께 읽으면 충돌이 아니다.
- 게다가 새 문안도 `external services` 를 비결정성 원천으로 그대로 열거한다 — **주장된 오독을 거의 완화하지 못했다.** 즉 이 변경은 명시된 문제를 고치지 못한 채, 문제와 무관한 성분(`Control` 의 강도)을 약화시켰다. → 결함 11

### ③ test-policy — prod 호환 의존성의 발동 조건

| | 원문 |
|---|---|
| **옛(main:10)** | `Use production-compatible dependencies when **behavioral differences could affect validity**.` |
| **새(HEAD:11)** | `Use production-compatible dependencies when **substitutes could invalidate the result**.` |
| **막던 실패 모드** | prod 와 다르게 동작하는 대체물로 검증해 놓고 통과로 보고 |
| **여전히 막는가** | **문턱이 올라갔다(= 약해졌다).** `affect validity`(유효성에 영향) ⊃ `invalidate`(무효화). 또 옛 문안은 발동 근거를 `behavioral differences`(관찰 가능한 차이)로 못 박았는데, 새 문안은 "결과를 무효화할 수 있는가"라는 **결과 예측**을 요구한다 |

같은 커밋이 **Dev-Prod Parity 를 지키려고** ②를 고쳤다고 적어 놓고, ③에서는 prod 호환 의존성을 쓰라는 조건을 **좁혔다.** 방향이 서로 반대다. → 결함 6

### ④ ship-checklist — 검증 통과와 게시의 배선 (⚠ `d612318` 소속. 1차 검증 보고서의 대상 밖)

| | 원문 |
|---|---|
| **옛(main:5)** | `게시·배포는 그 검증 통과에 **의존하도록 배선한다.** 검증과 별개 경로로 게시되면 red 를 통과해 나간다.` |
| **새(HEAD:6)** | `**그 검증을 우회하는 경로로 게시·배포하지 않는다.** 별개 경로가 있으면 red 인 채로 나간다. 경로를 고치는 것은 별도 작업이니 먼저 보고한다.` |
| **막던 실패 모드** | 검증과 게시가 **구조적으로 분리**돼 있어, 아무도 우회하려 하지 않았는데 red 가 그대로 나간다 |
| **여전히 막는가** | **아니다 — 다른 것을 막는다.** 옛 문안은 **상태 요구**(배선이 있어야 한다 · 확인 가능)였고 새 문안은 **행위 금지**(우회 경로로 나가지 마라 · 그 경로를 인지해야 발동)다 |

이 저장소 자신의 실측이 정확히 그 구분에서 갈렸다: v26.128.0~131.0 은 **누가 우회를 선택한 적이 없는데** `publish` 가 `ci` 와 별개 워크플로라 4연속 red 를 3릴리즈 동안 내보냈고, 그것을 실제로 막은 것은 나중에 넣은 `needs: ci` **배선**이었다(v26.141.0 이 그 배선에 걸려 미게시). 새 문안은 그 배선을 요구하지 않고 "먼저 보고한다"로 넘긴다. scope expansion 우려(남의 파이프라인 구조를 고치라고 명령하지 마라)는 정당하지만, **완화 후에도 원래 막던 실패 모드는 막힌다**는 주장 1 은 이 항목에 대해 **거짓**이다. → 결함 4

### ⑤ git-policy — 승인 대상의 축 (+ 시크릿 · config · 보고 · Session Cleanup · Enforcement)

| | 원문 |
|---|---|
| **옛(main:3)** | `되돌리기 어려운 조작은 **명시적 승인 없이 하지 않는다**: force push · **history rewrite** · 기본 브랜치 직접 push · 검증 우회 플래그 · **추적 중인 변경을 버리는 reset** · PR 머지.` |
| **새(HEAD:3)** | `**공유 이력을 바꾸거나 · 작업물을 버리거나 · 보호장치를 우회하는 조작은 사용자가 명시적으로 요청했을 때만** 한다: force push · **공개된 이력 다시 쓰기** · 기본 브랜치 직접 push · **커밋하지 않은 변경 폐기** · 검증 우회 플래그 · PR 머지.` |

**팀리드 질문(넓어졌나 좁아졌나)에 대한 판정 — 두 방향이 동시에 일어났다.**

| 성분 | 옛 | 새 | 판정 |
|---|---|---|---|
| 폐기 대상 | `추적 중인 변경` | `커밋하지 않은 변경` | **넓어짐** — untracked 파일이 들어온다(`git clean` 이 옛 문안엔 안 걸렸다) |
| 폐기 수단 | `reset` 한 명령 | 수단 불문 | **넓어짐** — `restore`·`clean`·덮어쓰기가 들어온다 |
| 이력 재작성 | `history rewrite` 전부 | `공개된 이력` | **좁아짐** — 미푸시 로컬 이력 재작성이 열거에서 빠졌다 |
| 로컬 커밋 폐기(`reset --hard HEAD~n`) | `추적 중인 변경` 로 읽기 애매 | 열거에 없음(`작업물을 버리거나` 라벨로만) | **약간 좁아짐** |
| 승인 양태 | `승인 없이 하지 않는다` | `요청했을 때만 한다` | **같거나 강해짐** |

→ **순증은 넓어진 쪽이다.** 다만 로컬 이력/커밋 폐기 한 구석은 열거에서 빠졌고, 그 자리는 라벨(`작업물을 버리거나`)의 해석에 의존한다.

**같은 불릿 묶음의 다른 4건:**

| | 옛 | 새 | 판정 |
|---|---|---|---|
| 시크릿 | `**시크릿을 커밋하지 않는다.** 새 파일을 통째로 스테이징하면(git add -A) …` | `**의도한 파일만 stage 한다.** … — 시크릿과 작업 범위 밖 파일이 그 경로로 들어간다.` | **금지문 자체가 소멸** → **결함 1(HIGH)** |
| git config | `git config 는 사용자 것이다. **수정하지 않는다.**` | `Git configuration 과 remote 설정을 **작업 범위 밖에서** 바꾸지 않는다.` | 대상은 넓어지고 **양태는 판단 게이트로 약해짐**(global/local 구분 없음) → 결함 8 |
| 보고 분리 | `로컬 게이트 통과는 기본 브랜치 반영의 증거가 아니다 — 둘을 분리해 보고한다.` | `local 검증 · commit · push · PR · 기본 브랜치 반영은 서로를 추론하지 않는다. 확인한 상태만 보고한다.` | **손실 없음**(2단계 → 5단계). 뒷문장은 새 중복 → 결함 10 |
| Session Cleanup | `세션이 끝나도 프로세스는 안 끝난다 … 계속 **쥔다**` | `세션 종료가 그것들을 반드시 끝내주지는 않는다 … 계속 **쥐는 경우가 있다**` | 의무문(`닫는다`)은 무조건 유지, 기전 서술만 헤지 — **손실 경미** |
| Enforcement | `… `protect-branch.sh --dry-run` **으로 먼저 보고 적용한다.**` | `… 로 **점검한다**. **보호 설정을 실제로 바꾸는 것은 사용자가 요청했을 때만** 한다.` | **주장 3 은 참** — 옛 문안은 공유 상태(호스트 규칙) 변경을 승인 없이 지시했고 앵커 §6:109-111 과 충돌했다. 수정이 옳다 |

### ⑥ change-management — 승인 절차 → 경계 선언

| | 원문 |
|---|---|
| **옛(main:4)** | `**현재 단계 안에 국한된 변경은 제안 후 승인을 받고**, 이미 합의된 내용의 구체화는 즉시 반영하되 **기록을 남긴다.**` |
| **새(HEAD:3·5)** | `**합의된 범위와 완료 기준 안에서는 자율적으로 수행한다.**` / `이미 합의된 내용의 구체화는 즉시 반영한다. 기존 결정이나 요구사항의 **의미**를 바꾸는 것은 먼저 합의한다.` |
| **막던 실패 모드** | ⓐ 단계 내부라도 스펙을 흔드는 변경을 혼자 결정 ⓑ 구체화가 기록 없이 사라져 다음 세션이 근거를 못 찾음 |
| **여전히 막는가** | ⓐ **대체로 막는다** — `의미를 바꾸는 것은 먼저 합의한다`가 승인 요구의 실질을 승계한다. ⓑ **안 막는다** — `기록을 남긴다`가 사라졌고 결정 기록(:6)은 아키텍처·의존성·데이터 모델·보안·breaking API 만 대상이다 → 결함 7 |

**팀리드 질문 — `안정적으로 보이는 영역도 손대기 전에 묻는다`(main:5) 삭제는 실제 손실인가?**

| 성분 | 삭제 후 어디가 갖는가 |
|---|---|
| 범위 밖을 **건드리지 않는다** | 앵커 §4:75-77 `Change only what the request and its verification require. Do not refactor, reformat, rename, rewrite, or delete unrelated code.` + 새 불릿 2 `요청 없이 고치지 않는다` — **이중으로 덮인다** |
| 애매하면 **먼저 묻는다** | 앵커 §1:19-21 이 갖되 **문턱이 다르다** — `materially affect … and would be expensive to reverse` 일 때만. 옛 룰은 "안정적으로 보이면" 이라는 훨씬 낮은 문턱이었다 |

→ **행위 금지는 완전히 덮인다. 질문하는 습관만 문턱이 올라간다.** 삭제된 문안 자체가 모호했고("안정적으로 보이는"), 대체 경로가 둘이라 **삭제는 방어 가능하다** — 손실은 LOW. 구현 레인 주장 중 이 건은 지지한다.

### ⑦ doc-governance

| | 옛(main) | 새(HEAD) | 판정 |
|---|---|---|---|
| :3 | `한 사실은 한 곳에. 같은 내용을 두 문서에 쓰지 않는다` | `한 사실의 기준 문서는 하나다. 다른 문서는 … 독립적으로 복제하지 말고 가리키거나 **필요한 만큼만 요약한다**` | 금지 대상이 `복제`로 좁혀졌다. **단, 이번 사이클의 삭제 근거를 스스로 약화시킨다** — 아래 참조 |
| :4 | `**머지는** 코드와 추적의 동기화**까지다.**` | `**그 변경을 추적하는 문서가 있으면** 코드와 추적 상태를 함께 동기화한다.` | **시점 앵커(`머지는`)가 사라졌다.** 실패 모드가 "코드는 머지됐는데 추적이 안 갱신됨"인데 새 문안엔 발동 시점이 없고, `있으면` 이 판단 게이트를 하나 더 얹는다 → 결함 12(LOW) |
| :5 | (동일 골격) | `— 현재 코드 상태의 증거로 쓰지 않는다.` 추가 | 같은 불릿 앞머리(`"모르는 것"이다`)의 재진술 → 결함 10 |

`ADR-070 규칙 3(추상↔구체는 중복이 아니다)과 같은 기준`이라는 주장은 **부정확하다.** 규칙 3 은 *추상층↔구체층*을 허용하고, 새 문안은 *같은 층의 요약*까지 허용한다 — 후자가 더 넓다. 이 사이클이 지운 `Never report a check as passed unless it was executed and observed`(앵커 §7 의 구체 요약) 같은 문장은 **새 doc-governance 기준으로는 지울 근거가 약해진다.** 판정을 뒤집을 만큼은 아니지만 "근거는 약해지지 않는다"는 서술은 참이 아니다.

---

## A. 가드레일 손실 검사

위 대조표가 본문이다. 요약: **확정 손실 3건**(시크릿 커밋 금지 · 구체화 기록 · 게시 배선 요구), **부분 손실 4건**(`relevant` 탈출구 · `Control or explicitly account for` · prod 호환 문턱 상승 · git config 판단 게이트), **손실 없음 4건**(`isolated` · 보고 분리 · Session Cleanup 헤지 · Enforcement 자기모순 수정), **방어 가능한 삭제 1건**(`안정적으로 보이는 영역`).

주장 1(`완화 5건이 각각 과잉 강제였고 완화 후에도 원래 막던 실패 모드는 여전히 막힌다`) → **기각.** ④ ship-checklist 와 시크릿 조항에서 거짓이다.

## B. 새 중복 검사

대조 방법: 재작성된 4종 + ship-checklist 의 **모든 문장**을 앵커 `templates/CLAUDE.md`(158줄) 전문과 양방향으로 맞췄다. 판정 기준은 ADR-070 규칙 3. 부재 확인에는 canary 를 붙였다(`범위 밖에서 발견한 문제` 부재 EXIT 1 ↔ canary `합의된 범위` EXIT 0).

**결과: 새 중복 4건 + 파일 내 재진술 2건.** 상세는 §새 중복.

## C. 게이트 시어터 검사

| 게이트 | 지키려던 것 | 지금 문안 | 변이 결과 |
|---|---|---|---|
| `session-cleanup-gate.test.ts:164` `toMatch(/ppid=1/)` — 주석 `왜 남는지 — 기전을 밝혀야 지켜진다` | 고아 프로세스가 **왜** 남는지 기전을 밝힐 것 | `부모만 죽고 `ppid=1` 로 재부모화돼 … 계속 쥐는 경우가 있다` — 기전 문장 그대로 + 헤지. 의무문은 무조건 | **MUT-1**: `ppid=1` 을 `부모 없이 남아`로 치환 → `Tests 1 failed \| 11 passed`. **문다** |
| `doc-governance-baseline-rule.test.ts:26,31,35` 리터럴 3종 + `:49` 1:1 | ⓐ 미완≠안 된 것 ⓑ 심볼≠완료 ⓒ 판정 불가 시 기본값 | 리터럴 3종 유지 + 글로스 1개 추가 | **MUT-2**: 해당 불릿 삭제 → `Tests 4 failed \| 2 passed`(리터럴 3 + 1:1). **문다** |

**판정: 리터럴 맞추기가 아니라 의도 충족이다.** 두 게이트 모두 문장 성분을 물고, 성분을 지우면 즉시 red 다(음성 대조로 확인). 단 두 가지를 적어 둔다.
1. `ppid=1` 게이트의 의도는 "기전을 밝혀야 **지켜진다**"인데, 새 문안은 기전을 **불확실**로 표시한다(`경우가 있다`). 게이트는 기전의 *존재*만 물고 *단정도*는 못 문다 — 의무문이 무조건이라 통과로 본다.
2. doc-governance 는 게이트가 리터럴을 **얼어붙여** 놓아서, 재작성이 그 리터럴을 지우지 못하고 **옆에 글로스를 덧붙이는** 형태가 됐다(+14 tok). 게이트가 문장을 고정하면 문서는 줄어드는 대신 **불어나는** 방향으로 압력을 받는다 — 이 자리가 그 실례다.

## D. 개발 사본 정합

`templates/rules/X` ↔ `.claude/rules/X` **1:1 을 요구하는 게이트는 `doc-governance` 하나뿐이다**(`grep -rn "\.claude/rules" tests/` 전수 → 내용 동등 단언은 `doc-governance-baseline-rule.test.ts:49` 한 줄. 나머지는 설치 경로·개수·drift 용).

현재 상태(실측 `cmp`):

| 룰 | 배포판 ↔ 개발 사본 |
|---|---|
| doc-governance · playwright-launch | **IDENTICAL** |
| change-management(7↔40줄) · git-policy(14↔45) · test-policy(18↔36) · ship-checklist(9↔33) · cli-development(14↔29) | **DIFFERS** |

**"자기가 파는 규약을 안 지키는 상태인가" — 아니다(설계된 차이).** ADR-070 §적용 범위가 개발 사본을 비대상으로 명시했고, 개발 사본은 이 저장소의 프로젝트 정책(트랙·CI·릴리즈 순서 등)을 담아 **다른 문서**다. 다만 이번 완화가 만든 비대칭 2건은 기록해 둔다 — **이 저장소는 자기가 배송에서 뺀 가드레일을 자기 사본에는 그대로 두고 있다**:

- `.claude/rules/git-policy.md:14` — `git config 수정 금지. `.env` · credentials · lock 파일 커밋 금지.` (배송판은 둘 다 완화/삭제)
- `.claude/rules/change-management.md:10` — `Minor | 현재 Phase 내부에 국한 | 제안 → **인간 승인** → Change Log` (배송판은 자율로 전환)

완화의 근거가 "과잉 강제"라면, 그 판정은 이 저장소 자신의 운영에는 적용되지 않았다. 결함으로 세지는 않되 **완화가 실사용으로 검증된 것은 아니다**는 사실로 남긴다.

## E. 수치·게이트 (주장 6)

**명령**(파이프 뒤 `$?` 미사용, 로그는 파일로):

```
npm run ci        → CI_EXIT=0 · Test Files 92 passed (92) · Tests 1340 passed (1340) · branches 88.8
npm run cost:report → COST_EXIT=0 · rules 6개 ~1063 · CLAUDE.md 2개 ~2866 · skill 6개 ~292 · agent 9개 ~724
                                   → 23개 상주 · ~4945 tokens/세션
bash templates/scripts/spec-drift-check.sh ship → DRIFT_EXIT=0 "OK: SPEC/TODO 동기화 상태 정상"
```

**주장 6 전부 재현.** `1063+2866+292+724 = 4945` 자기정합.

**`−102` 직접 재현** — `residentCost` 와 동일한 식(`ceil(trim(chars)/4)`, 파일별)으로 각 커밋의 tooling 룰 6종을 계산했다:

| 커밋 | 룰 합계 | 앵커 | main 대비 |
|---|---|---|---|
| `c061d5f`(main) | **1092** | 1898 | — |
| `a3ecbee` | 1032 | 1898 | 룰 −60 |
| `d612318` | **990** | 1904 | **룰 −102** · 앵커 +6 · 총 −96 |
| `0bdb816`(HEAD) | **1063** | 1904 | **룰 −29** · 앵커 +6 · 총 **−23** |

→ NORTH_STAR:112-116 의 `−23 tok — 룰 −29, 앵커 +6` 및 `중복 제거만 하면 −102 였으나 (−102 → −29)` **전부 참**(−102 는 **룰 축**이고, 같은 시점의 *총* 감축은 −96 이다 — 문장이 룰 축 위에 있어 거짓은 아니나 두 축이 한 문단에 섞여 있다). NORTH_STAR:145 `30개 ~7,570 → 23개 ~4,945, 즉 −7개 · 약 −2,625 tok` 도 산술 일치.

완화가 되돌린 +73 의 내역(파일별): git-policy +27 · change-management +17 · test-policy +15 · doc-governance +14.

**ratchet 은 우회되지 않았다** — `context-cost-ratchet.test.ts` 는 `실측 ≤ baseline ≤ 실측×1.1` 양방향이고, baseline 을 같은 커밋에서 갱신하는 것이 규정된 절차다(`context-cost-baseline.json` §comment). main 4968 → HEAD 4945 로 여전히 하향이다. 다만 **브랜치 내부의 +73 회귀는 어떤 게이트도 못 본다** — 커밋 메시지와 NORTH_STAR 산문이 유일한 고지다.

**드리프트 1건 발견** → 결함 2: `docs/decisions/ADR-070-…:71` 이 `상주 비용 4,968 → 4,908 tok/세션(rules 1,092 → 1,032)` 이라고 적고 있다. 실측은 **4,945 / 1,063** 이다. 이 줄은 `d612318` 시점(4,872 / 990)에도 이미 틀렸고 그 커밋이 같은 ADR 의 다른 두 곳을 고치면서도 이 줄은 두고 갔다.

## F. 범위 침범

5커밋 전체 = 11파일. `templates/rules/`(5) · `templates/CLAUDE.md`(1줄, 결함 1 대응) · `.claude/rules/doc-governance.md`(1:1 게이트가 강제) · `context-cost-baseline.json` · `docs/NORTH_STAR.md` · `docs/decisions/ADR-070-…` · `docs/plans/…-verify-report.md`.

**`src/`·`tests/`·`templates/hooks/`·`templates/skills/` 무변경. 침범 없음.** 버전 bump 없음 → CHANGELOG 게이트 비해당. `.claude/settings.json`·`.claude/skills/.DS_Store` 는 사용자 소유이며 이 세션이 건드리지 않았다(`git status --porcelain` 최종 확인).

**단, 커밋 경계가 어긋난다** → 결함 9: `0bdb816` 의 메시지에 `## ship-checklist — 파이프라인을 고치라고 명령하고 있었다` 절이 있는데 **이 커밋은 `templates/rules/ship-checklist.md` 를 건드리지 않는다**(`git show --name-only 0bdb816` = 7파일, 없음). 그 변경은 `d612318` 에 있고 그 커밋 메시지도 같은 내용을 이미 적었다. 제목의 `룰 5종` 도 실제로는 배포 룰 4종 + 개발 사본 1이다.

## G. 음성 대조 — 이 완화를 무는 것이 있는가

절차: `cp` 스냅샷 → 변이 → **적용 여부 눈으로 확인** → 실행 → **역치환 복원** → `shasum` 대조. `git checkout` 미사용.

| # | 변이 | 결과 |
|---|---|---|
| MUT-1 | `git-policy` Session Cleanup 의 `ppid=1` → `부모 없이 남아` | `session-cleanup-gate` **1 failed / 11 passed** — **문다** |
| MUT-2 | `templates/rules/doc-governance.md` 의 세 번째 불릿 삭제 | `doc-governance-baseline-rule` **4 failed / 2 passed**(리터럴 3 + 1:1) — **문다** |
| MUT-3 | **길이 보존 의미 반전 2곳** — `git-policy:3` `사용자가 명시적으로 요청했을 때만` → `필요하다고 스스로 판단하면` / `change-management:4` `임의로 바꾸지 않고 인간 결정을 받는다` → `필요하면 스스로 판단해 바꾼다`(공백 패딩으로 토큰 190·129 동일 유지) | **`npm run ci` exit 0 · Test Files 92 passed · Tests 1340 passed · branches 88.8** — 무변이 실행과 **완전히 동일** |

**MUT-3 이 이 델타의 초록불이 뜻하는 바를 정한다.** force push·PR 머지·미커밋 변경 폐기를 **에이전트 자기 판단으로 해도 된다**로 뒤집고, DO NOT CHANGE 경계를 **에이전트가 스스로 바꿔도 된다**로 뒤집어도 전 스위트가 초록으로 나간다. 수치 게이트조차 토큰이 같으면 못 본다.

**따라서: 완화 5건 중 `ppid=1` 한 성분을 빼면 아무도 안 문다.** 문장 내용에 대한 게이트는 `doc-governance` 리터럴 3종 · `git-policy` Session Cleanup 3성분 · `cli-development` 3원칙이 전부이고, `change-management`·`test-policy`·`ship-checklist`·`playwright-launch` 의 **본문에는 어떤 내용 게이트도 없다**(`grep -rln "rules/<name>"` 전수 — 이들 파일을 읽는 테스트는 설치 존재 확인뿐).

---

## 새 중복

대조: 재작성 4종 + ship-checklist 전문 ↔ 앵커 158줄. 앞선 검증이 잡은 3건은 `d612318` 에서 처리됐음을 확인했다(현 `ship-checklist` 에 독립 리뷰 항목 없음 · `git-policy` 에 `위 줄들은 프로즈다` 없음 · `test-policy` 에 `Run the relevant checks…` 없음).

### [새 중복 1 · MEDIUM] `change-management`:4 후반 ↔ 앵커 §4  — **이번 커밋이 새로 넣었다**

```
룰   templates/rules/change-management.md:4
  … 범위 밖에서 발견한 문제는 보고하되 요청 없이 고치지 않는다. …
앵커 templates/CLAUDE.md:75-77
  Change only what the request and its verification require. Do not refactor, reformat,
  rename, rewrite, or delete unrelated code.
앵커 templates/CLAUDE.md:79-80
  Leave unrelated dead code untouched. Report it only if it materially affects the task or
  verification.
```

성분 2개(`보고하되` · `요청 없이 고치지 않는다`)가 앵커 §4 의 두 문단과 각각 1:1 이다. 구체 수단도, 다른 트리거도, 임계값도 없다 — ADR-070 규칙 1·2 를 그대로 적용하면 **앵커가 소유하고 룰에서 지워야 하는** 형태다. main 에 이 문장이 없었음을 canary 대조로 확인했다(부재 EXIT 1 / canary EXIT 0). **중복을 지우는 사이클이 같은 파일에 새 중복을 넣었다.**

### [새 중복 2 · LOW] `git-policy`:6 뒷문장 ↔ 앵커 §7

```
룰   templates/rules/git-policy.md:6   … 확인한 상태만 보고한다.
앵커 templates/CLAUDE.md:125-126       Do not claim `Pass`, `Works`, or `Completed` without
                                       evidence. An unverified criterion is incomplete.
```
앞문장(5단계 구분)은 앵커에 없어 정당하다. 뒷문장만 재진술이다.

### [새 중복 3 · LOW] `git-policy`:14 끝 ↔ 앵커 §6 (+ 같은 파일 :3)

```
룰   templates/rules/git-policy.md:14  **보호 설정을 실제로 바꾸는 것은 사용자가 요청했을 때만** 한다.
앵커 templates/CLAUDE.md:109-111       Before any destructive, privileged, costly, or shared-state
                                       operation, state the exact action and target and obtain
                                       explicit approval.
```
자기모순 수정(주장 3)은 옳지만, 그 수정을 **앵커가 이미 말하는 승인 원칙을 한 번 더 쓰는 방식**으로 했다. 같은 파일 :3 의 승인 문장과도 이웃한다. 대안(수단만 남기고 승인 판정은 앵커에 맡기기)이 있었다.

### [새 중복 4 · LOW] 파일 내 재진술 2건

```
change-management:3   **합의된 범위와 완료 기준 안에서는 자율적으로 수행한다.**
change-management:4   … 보류하는 것은 그 경계뿐이고, 범위 안에서 할 수 있는 일은 계속한다.
```
연속한 두 불릿이 같은 지시를 두 번 한다(+17 tok 의 주된 출처).

```
doc-governance:5      … **"모르는 것"**이다 — 현재 코드 상태의 증거로 쓰지 않는다.
```
`모르는 것`의 정의를 바로 뒤에서 한 번 더 말한다(+14 tok 의 주된 출처).

### 중복이 아니라고 판정한 것 (무엇을 봤는지)

| 룰 | 줄 | 앵커 후보 | 판정 |
|---|---|---|---|
| `change-management` | 3 | §1:24-25 `Otherwise, state a reasonable assumption and continue` | 트리거가 다르다(불확실성 vs 범위 합의) — 중복 아님. 단 위 [새 중복 4] |
| `change-management` | 5 후반 (`의미를 바꾸는 것은 먼저 합의한다`) | §1:19-21 | 트리거 상이 — 중복 아님 |
| `change-management` | 6·7 | — | 앵커에 없음 |
| `git-policy` | 3 열거 | §6:109-111 | 규칙 3 — 추상↔구체 |
| `git-policy` | 4 | §1:8-10 `inspect … worktree changes` | 행위가 다르다(stage 시점) — 중복 아님 |
| `git-policy` | 5 | §4:75 `Change only what the request … require` | **경계선**. 대상이 구체(config·remote)라 규칙 3 보호로 본다 |
| `git-policy` | 10 | — | 앵커에 없음 |
| `doc-governance` | 3·4·7 | — | 앵커에 없음 |
| `test-policy` | 전체(영문) | §2:35 `Prefer regression tests at stable contract boundaries` | 이번 변경 문장들과 겹치지 않음 |
| `ship-checklist` | 6·8 | §5:90-92 / §7 | 배포 시점·구체 검사 지목 — 규칙 3 |

---

## 결함

### [결함 1 · HIGH] `시크릿을 커밋하지 않는다` 가 배송 층에서 사라졌다 — 고지 없음

- **파일**: `templates/rules/git-policy.md:4` (옛 = `git show c061d5f:templates/rules/git-policy.md` :4)
- **증거**:
  ```
  옛  - 시크릿을 커밋하지 않는다. 새 파일을 통째로 스테이징하면(`git add -A`) 아직 ignore 되지 않은 `.env` 가 그대로 담긴다.
  새  - **의도한 파일만 stage 한다.** 통째로 담기 전에 추적되지 않은 파일을 먼저 본다 — 시크릿과 작업 범위 밖 파일이 그 경로로 들어간다.
  ```
  `grep -rn "시크릿\|secret\|credential\|\.env" templates/rules/ templates/CLAUDE.md` → **2건뿐**: `test-policy.md:13`(테스트에서의 사용 금지, 커밋과 무관) · `git-policy.md:4`(위 문장의 **부수절**). 앵커에는 시크릿 조항이 **없다**.
- **왜 손실인가**: 옛 문장은 **금지문**(무엇을 하지 마라)이었고 `git add -A` 는 그 사례였다. 새 문장은 **절차문**(통째로 담기 전에 본다)이고 시크릿은 그 절차를 어겼을 때의 결과로만 등장한다. "이 파일을 커밋해 줘"로 들어오는 경로 — 즉 **의도한 stage** — 는 새 문안이 금지하지 않는다.
- **강제층이 안 덮는다**: `templates/settings.json:20` 의 `protect-files.sh` matcher 는 `Write|Edit` 다. `git add`/`git commit` 은 Bash 로 나가 훅에 걸리지 않는다.
- **고지 부재**: 커밋 메시지는 이 변경을 `git add -A 설명 → "의도한 파일만 stage 한다"` 로만 적었다. 금지문 삭제는 메시지·ADR-070·NORTH_STAR 어디에도 없다.
- **맥락**: 이 저장소에는 실제 유출 전례가 있고(npm 구버전·git 이력, 감수 결정), 자기 개발 사본은 `.env`·credentials 커밋 금지를 그대로 유지한다(`.claude/rules/git-policy.md:14`).
- **재현**: 위 grep 2줄.
- **CRITICAL 이 아닌 이유**: 룰은 프로즈 층이라 이 변경 자체가 코드 취약점을 만들지 않는다. 그러나 **보안 경계 문장의 무고지 삭제**이므로 인간 결정 없이 머지되면 안 된다.

### [결함 2 · MEDIUM] ADR-070 의 비용 수치가 두 시점 모두와 어긋난다

- **파일**: `docs/decisions/ADR-070-resident-layer-ownership-by-reach.md:71-72`
- **본문**: `상주 비용 **4,968 → 4,908 tok/세션**(rules 1,092 → 1,032). … baseline 은 하향이라 ratchet 이 조여진다.`
- **실측**: 4,945 / 1,063 (`npm run cost:report`). `d612318` 시점(4,872 / 990)과도 불일치 — 그 커밋이 같은 ADR 의 도달 표와 한계 절을 고치면서 이 줄은 두고 갔다.
- **왜 중요한가**: ADR 은 다음 사람이 판정 근거로 읽는 문서이고, 이 저장소에는 **ADR 본문이 쓰이는 시점에 거짓이었던 전례**(ADR-048)가 있다. 게이트는 `docs/NORTH_STAR.md` 만 읽는다(`north-star-cost-figures.test.ts:21`) — ADR 은 무검사 구역이다.
- **재현**: `sed -n '71,72p' docs/decisions/ADR-070-*.md` ↔ `npm run cost:report`

### [결함 3 · MEDIUM] 중복 제거 커밋이 새 앵커 재진술을 넣었다

§새 중복 1. `change-management.md:4` 의 `범위 밖에서 발견한 문제는 보고하되 요청 없이 고치지 않는다` ↔ 앵커 §4:75-80.

### [결함 4 · MEDIUM] `ship-checklist` 배선 요구 삭제가 이 저장소의 실측 증거와 반대다 — 그리고 어느 검증도 거치지 않았다

- **파일**: `templates/rules/ship-checklist.md:6` (변경은 `d612318`)
- **증거**: 완화 대조표 ④. 상태 요구 → 행위 금지.
- **반대 증거**: v26.128.0~131.0 은 우회 의도 없이 4연속 red 를 게시했고(`publish` 가 `ci` 와 별개 워크플로), 그것을 실제로 막은 것은 `needs: ci` **배선**이다(v26.141.0 이 그 배선에 걸려 미게시). 즉 행위 규율은 이 저장소에서 3릴리즈 동안 실패했고 배선은 첫 실전에서 성공했다.
- **절차 결함 동반**: 이 변경은 `d612318` 에 들어 있는데 1차 검증 보고서(`docs/plans/resident-dedup-289-verify-report.md:3`)의 대상은 `a3ecbee`·`ca23381` 이다. **오늘 이 재검증이 처음 본다.**
- **판단**: scope expansion 우려는 정당하다. 그러나 "완화 후에도 막힌다"는 주장은 이 항목에서 거짓이므로, 유지하려면 그 손실을 명시적으로 감수한다고 적어야 한다.

### [결함 5 · MEDIUM] `cover relevant` 는 판정 기준 없는 탈출구다

§완화 대조표 ①. 같은 파일의 `best exposes plausible failures`(:3) · `broaden the validation`(:18) 과 달리 기준도 기본값도 없다.

### [결함 6 · MEDIUM] Dev-Prod Parity 를 지킨다며 고친 커밋이 같은 파일에서 그 문턱을 올렸다

§완화 대조표 ③. `when behavioral differences could affect validity` → `when substitutes could invalidate the result`.

### [결함 7 · MEDIUM] 구체화의 `기록을 남긴다` 요구가 소리 없이 사라졌다

- **파일**: `templates/rules/change-management.md:5` (옛 :4)
- **증거**: 옛 `이미 합의된 내용의 구체화는 즉시 반영하되 **기록을 남긴다**` → 새 `이미 합의된 내용의 구체화는 즉시 반영한다`. 결정 기록 조항(:6)의 대상은 아키텍처·외부 의존성·데이터 모델·보안 정책·breaking API 뿐이다.
- **영향**: 합의 구체화가 어디에도 남지 않는다. 앵커 §7 은 **보고**를 요구하지 지속 기록을 요구하지 않는다. 커밋 메시지는 이 삭제를 언급하지 않았다.

### [결함 8 · LOW] `git config 는 사용자 것이다` 가 판단 게이트로 바뀌었다

- `git config 는 사용자 것이다. 수정하지 않는다.` → `Git configuration 과 remote 설정을 작업 범위 밖에서 바꾸지 않는다.`
- remote 를 포함시킨 것은 개선이나, **global ↔ repository-local 구분이 없다.** 완화 사유는 "repo-local remote 변경까지 금지로 읽혔다" 인데, 그 문제는 대상을 local 로 한정해도 풀린다. 현 문안은 전역 config 변경도 "작업 범위 안"이라는 자기 판정으로 열린다.

### [결함 9 · LOW] 커밋 메시지가 이 커밋에 없는 변경을 자기 것으로 서술한다

- `0bdb816` 메시지의 `## ship-checklist` 절 ↔ `git show --name-only --format="" 0bdb816` (7파일, `ship-checklist.md` 없음). 그 변경은 `d612318` 소속이고 그 커밋 메시지에도 같은 절이 있다.
- 제목의 `룰 5종` = 배포 룰 4종 + 개발 사본 1종.

### [결함 10 · LOW] 새 중복 3건(경미)

§새 중복 2·3·4.

### [결함 11 · LOW] `Control` → `Control or explicitly account for` 는 명시된 문제와 무관한 완화다

§완화 대조표 ②. 주장된 문제("외부는 항상 mock")는 새 문안도 거의 그대로 안고 있고, 실제로 바뀐 것은 **통제 의무의 강도**다.

### [결함 12 · LOW] `머지는 …까지다` 시점 앵커 상실

§완화 대조표 ⑦ :4. 실패 모드가 시점에 묶여 있는데 새 문안에는 시점이 없다.

### 결함 없음으로 확인한 것 (시도한 것 나열)

- 수치 6종 — `cost:report` 재실행 일치, `−102` 를 커밋별 재계산으로 직접 재현(§E)
- `npm run ci` — exit 0 / 92 files / 1340 tests / branches 88.8(§E)
- `spec-drift-check.sh ship` — exit 0
- 두 게이트가 무는지 — MUT-1·2 로 확인(§C·G)
- 1:1 게이트가 `doc-governance` 하나뿐인지 — `grep -rn "\.claude/rules" tests/` 전수(§D)
- 배포판↔개발 사본 실제 동등성 — `cmp` 7종(§D)
- 범위 침범 — 11파일, `src`·`tests` 무변경(§F)
- ratchet 우회 여부 — 양방향 단언 확인, baseline 갱신은 규정된 절차(§E)
- 주장 3(git-policy 자기모순) — **참**으로 확인
- 주장 4(`ppid=1` 의도 충족) — **참**으로 확인
- 주장 5(doc-governance 게이트 양립) — **참**으로 확인
- `안정적으로 보이는 영역` 삭제 — 앵커 §4 + 새 불릿 2 로 덮임, **방어 가능**

---

## 미검증

1. **모델 준수 효과** — 완화된 문안이 실제 에이전트 행동을 어떻게 바꾸는지 측정하지 않았다. 이 보고의 모든 손실 판정은 **텍스트 해석**이다.
2. **렌더·실설치 프로브 미재실행** — 이번 델타가 룰 본문뿐이라 배선은 재검증 대상이 아니라고 판단했다. 1차 검증(`…-verify-report.md` §A)의 결과를 반증하지도 확인하지도 않았다.
3. **`d612318` 의 앵커 변경**(`and the risk that remains`) — 파일에 존재함만 확인(`templates/CLAUDE.md:123`). 그 추가가 만든 새 중복 여부는 §B 대조에 포함했으나 앵커 자체의 전면 재대조는 하지 않았다.
4. **잔존 중복 전수성** — 사람이 양방향 대조했다. 기계 판정이 아니므로 "이것이 전부"라고 주장하지 않는다. 대조 대상과 판정은 §새 중복에 전부 적었다.
5. **OpenCode·Codex·Antigravity 런타임** — 호스트에서 실 CLI 실행이 차단돼 있어 미검증(1차 검증과 동일).
6. `npx ecc-agentshield scan` · `npm audit` — 이번 범위(문서 변경)에 요청되지 않아 미실행.
7. **npm 게시본 대조** — 브랜치 미게시.
8. **결함 1 의 실제 노출도** — 시크릿 조항 삭제가 설치처에서 실제 사고로 이어지는지는 측정 불가. 판정은 "금지문이 배송 층에서 사라졌다"는 사실까지다.

## 범위 밖 (한 줄)

이슈 #294·#295·#297·#300·#301 은 보지 않았다. 1차 검증이 지목한 `templates/opencode/AGENTS.md.template` 의 거짓 안내(OpenCode 단독 설치자에게 없는 병합을 있다고 안내)는 이번에도 그대로다.

## 복원 검증

```
8953bb3fc656274b944a4bc009f7b6119af03991  templates/rules/git-policy.md          (변이 전과 동일)
8c51153f12f4550b8a01b94c79b07b35aa6af06f  templates/rules/doc-governance.md      (동일)
f6fafd88dbc90380b52a741591245bb3f0fc63e7  templates/rules/change-management.md   (동일)
8c51153f12f4550b8a01b94c79b07b35aa6af06f  .claude/rules/doc-governance.md        (동일)
ef7cb0ecfce83d9233c0d6748e09b80bcb0c349d  docs/NORTH_STAR.md                     (동일)
git status --porcelain →  M .claude/settings.json / M .claude/skills/.DS_Store  (사용자 소유, 미접촉)
```
`git checkout` 미사용. 변이는 전부 역치환으로 되돌렸고 `diff` 로 pre-mutation 해시 목록과 대조해 exit 0.

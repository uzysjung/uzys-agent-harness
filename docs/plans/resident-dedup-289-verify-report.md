# 검증 보고 — #289 상주 층 중복 정리 (독립 레인)

- 대상: `a3ecbee`(룰 정리 + 비용 수치) · `ca23381`(ADR-070) — 브랜치 `refactor/resident-layer-dedup-289`, main `c061d5f` 위 2 커밋. PR #299(OPEN).
- 레인: 검증(구현 레인과 분리). 구현 보고를 읽지 않고 명령을 직접 실행해 증거를 만들었다.
- 실행 일자: 2026-08-11. 작업 트리 원상 복구 확인(§H).

## 판정

**조건부 머지 가능** — 배선·수치·게이트는 전부 재현됐지만, 삭제 4건 중 1건(`remaining risk`)은 앵커가 같은 말을 하지 않고, 남긴 것 중 1건(`ship-checklist`:5)은 지운 3건보다 더 순수한 중복이라 이 PR 은 이슈를 절반만 닫는다.

| 축 | 결과 |
|---|---|
| 잃은 것이 있는가 | **있다 1건** — `remaining risk`(결함 1). 나머지 3건은 손실 없음 |
| 덜 지웠는가 | **덜 지웠다** — 앵커↔룰 잔존 중복 3건(결함 2·4·5), 그중 1건은 지운 것보다 순수한 중복 |
| 배선 주장 | 참(렌더·실설치 양쪽으로 재현) — 단 ADR 표의 OpenCode 칸은 **조건부**다(결함 3) |
| 수치·게이트 | 전부 참. `npm run ci` exit 0 · 1340 passed · branches 88.8% |

---

## A. 도달 범위 재검증 — 주장 1

**명령**

1. 배선 읽기: `src/codex/agents-md.ts:33-41` · `src/opencode/agents-md.ts:31-38` · `src/antigravity/transform.ts:101-119` · `src/manifest.ts:195-201` · `src/installer.ts:293-295`
2. 부재 탐지기 자기검증(`2>/dev/null` 미사용, 파이프 뒤 `$?` 미사용):
   - `grep -rn "rules" src/codex/` → EXIT 1(무매치) / canary `grep -rn "skills" src/codex/` → EXIT 0, 5줄 매치
   - `grep -rn "rules" src/opencode/` → EXIT 1 / canary `skills` → EXIT 0, 3줄 매치
3. **렌더 프로브** — `renderAgentsMd` 직접 호출(3 CLI 템플릿 × 실제 `templates/CLAUDE.md`). EXIT 0, 4 passed.
4. **실설치 프로브** — `runInstall({ runExternal: null })` 을 `--cli` 5조합으로 임시 디렉터리에 실행. EXIT 0, 5 passed.

**관찰 — 렌더 산출물 (프로브 3)**

| 산출물 | 앵커 문장 3종 | 룰 7종 본문 |
|---|---|---|
| codex `AGENTS.md` (13,628자) | PRESENT ×3 | ABSENT ×7 |
| opencode `AGENTS.md` (13,110자) | PRESENT ×3 | ABSENT ×7 |
| antigravity `.agents/rules/uzys-harness.md` (12,350자) | PRESENT ×3 | ABSENT ×7 |

탐지기 자기검증: 같은 프로브 문자열이 원본 파일(`templates/rules/*.md`·`templates/CLAUDE.md`)에 실재함을 별도 단언으로 먼저 확인했다(4번째 test). 앵커 문장이 PRESENT 로 잡히는 것이 알려진 양성이다.

**관찰 — 실설치 산출물 (프로브 4, track=tooling)**

| `--cli` | `.claude/rules/` | 앵커 도달 | 룰 본문 도달 |
|---|---|---|---|
| `claude` | 존재(6개) | `CLAUDE-uzys-harness.md` | `.claude/rules/*.md` |
| `codex` | **부재** | `AGENTS.md` | 없음 |
| `opencode` | **부재** | `AGENTS.md` | **없음** |
| `antigravity` | **부재** | `.agents/rules/uzys-harness.md` | 없음 |
| `claude,opencode` | 존재(6개) | 양쪽 | `.claude/rules/*.md` |

**판정: 주장 1 은 참 — 단 정정 1건.**
`{PROJECT_RULES}` 는 앵커 본문(첫 h1 제거)으로 채워진다(`agents-md.ts:35-39`). Antigravity 의 `.agents/rules/uzys-harness.md` 는 이름과 달리 앵커다(`transform.ts:110` 이 codex 의 `renderAgentsMd` 를 재사용). **정정**: 룰의 OpenCode 도달은 무조건이 아니다 — `.claude/rules/` 는 `spec.cli.includes("claude")` 일 때만 생성되고(`installer.ts:293`), OpenCode 단독 설치는 `.claude/rules/` 자체가 없어 `opencode.json` 의 `instructions` 글롭 `".claude/rules/*.md"` 가 아무것도 매치하지 않는다. → **결함 3**.

부수 관찰: 설치되는 룰은 트랙에 따라 6종이다(tooling = git-policy·change-management·doc-governance·test-policy·ship-checklist·cli-development). `playwright-launch` 는 UI 트랙 전용이라 "룰 7종"은 카탈로그 수이지 한 설치가 받는 수가 아니다.

---

## B. 지운 것의 손실 검사 — 삭제 4건

원문 대 원문 대조는 아래 **§삭제 4건 손실 대조표**에 있다. 요약:

- 삭제 ①(`Verify every change…`) — 앵커 §2+§5+§7 의 **합**으로만 복원된다. 전칭 `every change` 는 앵커의 검증 의무 문장에 **없다**(`grep -n "every" templates/CLAUDE.md` = 6건, 전부 다른 맥락: L69 caller · L117 enforcement layer · L144~149 skills). 손실은 "문장 하나로 읽히던 전칭"과 "requirements 비례" 축.
- 삭제 ②③(`executed and observed` / `실행하지 않은 검사는 통과가 아니다`) — 손실 없음. `ship-checklist` 의 **남은 반쪽**이 "실행하고 결과를 확인한다"를 그대로 유지하고, 앵커 §7 이 보고 금지를 갖는다.
- 삭제 ④(`the remaining risk`) — **손실 있음**. 앵커에 `risk` 는 전 문서에서 **한 번**(L90 "broaden according to risk") 나오고 보고 절(§7)에는 없다. 앵커의 `what remains` 는 §5 의 병렬 표현(`what remains unmet`)이 보여주듯 **남은 일**이고, 룰이 요구하던 것은 **남은 위험**이다. → **결함 1**.

---

## C. 덜 지운 것 검사 — 앵커 ↔ 배포 룰 7종 전수 대조

대조 방법: 앵커 7원칙 + 2부속절의 **모든 의무 문장**을 배포 룰 7종(`change-management`·`cli-development`·`doc-governance`·`git-policy`·`playwright-launch`·`ship-checklist`·`test-policy`, 총 85줄)의 모든 줄과 양방향으로 맞췄다. 판정 기준은 ADR-070 규칙 3(추상↔구체는 중복이 아니다).

결과는 **§남은 중복** 절에 원문·줄번호와 함께 적었다. 요약: **잔존 중복 3건**(결함 2·4·5) + 룰↔룰 중복 1건(결함 5 부속). 중복이 아니라고 판정한 것도 무엇을 봤는지 함께 적었다.

---

## D. 판정 규칙의 일관성

ADR-070 이 세운 경계는 ⓐ 앵커가 같은 추상 수준에서 이미 말하는 재진술은 룰에서 지운다 ⓑ 앵커가 담을 수 없는 것(구체 수단·임계값·트리거)만 남긴다 ⓒ 추상↔구체는 중복이 아니다.

이 경계를 남은 룰 전체에 적용하면 **양방향으로 한 번씩 어긋난다**:

| 방향 | 사례 | 왜 어긋나는가 |
|---|---|---|
| 지웠어야 하는데 남겼다 | `ship-checklist`:5 (독립 리뷰) | 앵커 §5 ¶2·¶3 과 **같은 추상 수준**의 전면 재진술. 구체 수단 열거도, 다른 트리거도, 임계값도 없다 — 추가되는 것은 근거 한 줄("리뷰 없이 쌓인 변경은 배포 때 형식만 채워진다")뿐이다. 지운 3건보다 중복도가 높다 |
| 남겼어야 하는데 지웠다 | `test-policy` `the remaining risk` | 앵커에 없는 내용을 "앵커 §7 이 소유"라는 사유로 지웠다 |
| 반쪽만 지웠다 | `test-policy`:12 | 한 bullet 의 두 문장이 각각 앵커 §5·§7 의 재진술인데 뒤만 지웠다. 남은 앞 문장이 앵커 §5 첫 문장의 **정보량이 더 적은** 재진술이다 |

즉 경계 자체는 옳게 세워졌으나(추상↔구체 판정은 타당하다) **적용이 균일하지 않다**. `기준 약화 금지`(규칙 3 로 남김)와 `영향 범위 불확실 시 확대`(트리거 상이로 남김)는 판정이 정확하다 — 이 둘은 지지한다.

---

## E. ADR-070 의 사실성

| # | 본문 주장 | 대조 방법 | 판정 |
|---|---|---|---|
| 1 | 앵커 4/4 도달 | 렌더 + 실설치 프로브 | **참** |
| 2 | 룰 2/4 도달 (Claude Code·OpenCode) | 실설치 `--cli opencode` | **조건부 참** — OpenCode 단독은 0. `installer.ts:293` → 결함 3 |
| 3 | 비 Claude `AGENTS.md` 의 `{PROJECT_RULES}` = 앵커 본문 | `agents-md.ts:33-40` + 렌더 | **참** |
| 4 | 3 파일이 그 배선을 담당 (`src/codex`·`src/opencode`·`src/antigravity`) | 코드 읽기 | **참** (antigravity 는 codex 함수 재사용, `transform.ts:22,110`) |
| 5 | OpenCode 만 `instructions` 글롭으로 룰 병합 | `templates/opencode/opencode.json.template:4` + 타 CLI 템플릿 grep | **참**(파일 기준). 타 CLI 템플릿에 `.claude/rules` 참조 0 |
| 6 | `.agents/rules/uzys-harness.md` 는 이름과 달리 앵커 | 실설치 산출물 검사 | **참** — 앵커 PRESENT, 룰 본문 0 |
| 7 | 4,968 → 4,908 (rules 1,092 → 1,032) | `npm run cost:report` | **참** |
| 8 | 앵커는 한 글자도 안 줄었다 | `shasum templates/CLAUDE.md` 대 `git show c061d5f:` | **참** (양쪽 `b4031c1b91b2d495406e45c2c680533fb10fb867`) |
| 9 | PR #299 | `gh pr list` | **참** (OPEN, 이 브랜치) |
| 10 | 관련 ADR-067·068 존재 | `ls docs/decisions/` | **참** |
| 11 | Status: Accepted (머지 전) | ADR-067·068·069 헤더 | **관행 일치** — 결함 아님 |
| 12 | "Codex·Antigravity 설치자는 룰 7종을 여전히 받지 않으며"(§Consequences 한계) | 실설치 | **불완전** — OpenCode 단독 설치자도 못 받는다. 또 한 설치가 받는 룰은 트랙에 따라 6종 |

`## 적용 범위` 절 존재 확인(대상/비대상/미적용 3분) — `feedback_surface_symmetry` 요구 충족.

---

## F. 수치

**명령**: `npm run cost:report` → EXIT 0 (파이프 없이 읽음)

```
rules                6개  ~1032
CLAUDE.md            2개  ~2860
skill descriptors    6개  ~292
agent descriptors    9개  ~724
상주 합계           23개 상주 · ~4908 tokens/세션
```

- `docs/NORTH_STAR.md:112` = "23개 항목 · ~4,908 tokens/세션 = rules 6개 ~1,032" → 일치.
- `context-cost-baseline.json` tooling = 4908 → 일치. 나머지 8 트랙도 전부 −60 으로 내려갔고 ratchet 은 하향이므로 조여진다.
- **앵커 토큰 불변** — `CLAUDE.md 2개 ~2,860` 은 diff 에서 문맥 줄(변경 없음)이고, 파일 shasum 도 동일하다(§E-8). 앵커 1,898 + 스캐폴드 962 = 2,860.
- 감축 −60 tok = 전체 상주의 **1.2%**. 이 PR 의 가치는 총량이 아니라 배치 규칙이라는 ADR 의 서술과 일치한다.

---

## G. `npm run ci` 직접 실행 + 범위 침범

**명령**: `npm run ci > <log> 2>&1; echo "CI_EXIT=$?"` — 파이프 없이, 로그는 파일로.

```
CI_EXIT=0
 Test Files  92 passed (92)
      Tests  1340 passed (1340)
All files          |    96.4 |     88.8 |   96.11 |    96.9
```

branches 88.8% ≥ 88 게이트. **주장 5 전부 재현.**
`bash templates/scripts/spec-drift-check.sh ship` → `DRIFT_EXIT=0`, "OK: SPEC/TODO 동기화 상태 정상".

**범위**: 2 커밋이 건드린 파일은 5개 — `context-cost-baseline.json` · `docs/NORTH_STAR.md` · `templates/rules/ship-checklist.md` · `templates/rules/test-policy.md` · `docs/decisions/ADR-070-*.md`. `src/` · `tests/` · `templates/CLAUDE.md` 무변경. 개발 사본 `.claude/rules/` 무변경(ADR-070 §적용 범위의 비대상과 일치 — 배포판과 개발 사본은 내용이 다른 별개 문서다). **범위 침범 없음.** 버전 bump 없음 → CHANGELOG 게이트 비해당.

---

## H. 음성 대조 — 초록이 무엇을 근거로 초록인가

절차: `cp` 스냅샷 → 변이 → 변이가 실제로 적용됐는지 눈으로 확인 → 실행 → **역치환 복원** → `shasum` 대조. `git checkout` 미사용.

| # | 변이 | 결과 | 무는가 |
|---|---|---|---|
| H1 | `test-policy` 에 삭제된 `- Report what was tested…` 한 줄 **복원**(토큰 ↑) | `Tests 10 failed \| 1330 passed` — `context-cost-ratchet` 8트랙 + `north-star-cost-figures` 2 | **문다** |
| H2 | `NORTH_STAR` 수치만 4,908→4,968 / 1,032→1,092 로 되돌림 | `north-star-cost-figures` 2 failed — `expected 4968 to be 4908` | **문다** |
| H3 | `test-policy`:11 `Never use unauthorized production personal data, credentials, or secrets in tests.` **삭제**(앵커에 대응 문장 없음 = 진짜 손실) | `Tests 2 failed` — `north-star-cost-figures` **뿐**. ratchet 은 통과(하향) | 숫자만 문다 |
| H3b | H3 상태에서 `NORTH_STAR` 수치를 4,886/1,010 으로 맞춤 | **`Test Files 92 passed / Tests 1340 passed`, EXIT 0** | **안 문다** |

**H3b 가 이 PR 의 초록이 무엇을 뜻하는지 정한다** — 앵커가 담지 않은 보안 지시문을 룰에서 지우고 숫자만 갱신하면 **전 스위트가 초록으로 나간다.** 즉 §G 의 초록은 *수치 부기(簿記)가 맞다*는 증거이고, *의미 손실이 없다*는 증거가 **아니다**. "잃은 것이 있는가" 축에는 자동 게이트가 0이며 판정은 전적으로 이 리뷰 같은 사람/레인 검증에 달려 있다.

부수 관찰(방법 함정 2건, 둘 다 회피함): ⓐ `npx vitest --reporter=basic` 은 vitest 4 에서 **startup error 로 exit 1** 을 낸다 — 테스트 실패로 오독하면 거짓 증거가 된다(`test-policy` §변이 테스트의 "빌드 파손으로 난 FAIL 은 증거가 아니다"). 기본 리포터로 재실행해 확인했다. ⓑ H2 의 1차 perl 치환은 `**` 위치를 잘못 잡아 **적용되지 않았고** 그때 EXIT 0 이 나왔다 — 변이 적용 여부를 먼저 눈으로 확인하지 않으면 "게이트가 안 문다"는 거짓 결론이 나온다.

**복원 검증**

```
39c0ad46f6d73d409ee2a9a97aac70690c2a4b91  templates/rules/test-policy.md   (변이 전과 동일)
bfcfd9d4a8c28471fa54dbc805175950b9d044b7  docs/NORTH_STAR.md               (변이 전과 동일)
git status --porcelain →  M .claude/settings.json / M .claude/skills/.DS_Store  (사용자 소유, 미접촉)
```

---

## 삭제 4건 손실 대조표

### ① `test-policy`:3 (삭제)

| | 원문 |
|---|---|
| **룰(삭제됨)** | `Verify every change with evidence proportional to its requirements and risk.` |
| **앵커 §5:90** | `Run targeted checks first, then broaden according to risk. Iterate until the completion criteria pass.` |
| **앵커 §2:32** | `Before editing, define observable completion criteria and how each will be verified.` |
| **앵커 §7:125** | `Do not claim ``Pass``, ``Works``, or ``Completed`` without evidence. An unverified criterion is incomplete.` |

**덜 말해지는 것**
1. **전칭이 사라진다.** 룰은 `every change` 로 대상을 한정 없이 묶는다. 앵커에는 "모든 변경을 검증하라"는 문장이 없고, §2(기준을 정의하라) + §5(검사를 돌려라) + §7(미검증 기준은 미완이다)의 **합**으로만 같은 결론에 도달한다. 세 절을 잇는 추론이 필요해졌다.
2. **비례 축이 하나 줄었다.** 룰은 `requirements and risk` 두 축에 비례하라고 한다. 앵커 §5 는 `according to risk` **한 축**뿐이다. requirements 축은 §2 의 "기준마다 검증 방법을 정하라"로 간접 복원된다.

**판정: 뉘앙스 손실(경미).** 의무 자체는 앵커 3절의 합으로 살아 있다. 삭제 사유("앵커 §5 가 소유")는 절반만 정확하다 — §5 단독으로는 덮이지 않는다.

### ② `test-policy`:13b (삭제)

| | 원문 |
|---|---|
| **룰(삭제됨)** | `Never report a check as passed unless it was executed and observed.` |
| **룰(남은 반쪽)** | `Run the relevant checks and inspect their results.` |
| **앵커 §7:125** | `Do not claim ``Pass``, ``Works``, or ``Completed`` without evidence.` |
| **앵커 §5:99** | `A reviewer verifies the work itself rather than trusting the author's report.` |

**덜 말해지는 것**: 룰은 두 동작(`executed` · `observed`)을 이름으로 못박는다. 앵커의 `without evidence` 는 더 넓은 명사라, 남의 보고·CI 배지·캐시된 결과도 느슨하게 읽으면 "증거"로 통과할 수 있다. 다만 그 구멍은 앵커 §5 의 "저자의 보고를 믿지 말고 직접 검증한다"가 리뷰 경계에서 막고, `observed` 성분은 룰의 남은 반쪽 `inspect their results` 가 그대로 갖고 있다.

**판정: 손실 없음(사실상).** 삭제 사유 정확.

### ③ `ship-checklist`:6b (삭제)

| | 원문 |
|---|---|
| **룰(삭제됨)** | `실행하지 않은 검사는 통과가 아니다.` |
| **룰(남은 반쪽)** | `배포 전에 이 저장소가 정의한 검증을 **실행하고 결과를 확인한다.**` |
| **앵커 §7:125** | `Do not claim ``Pass``, ``Works``, or ``Completed`` without evidence. An unverified criterion is incomplete.` |

**덜 말해지는 것**: 없다. 삭제된 문장은 같은 bullet 앞 반쪽의 부정형 재진술이고(실행+결과 확인 → 미실행은 통과 아님), 보고 금지는 앵커 §7 이 명시적으로 갖는다. 삭제 전에는 앵커·`test-policy`·`ship-checklist` **3중**이었다.

**판정: 손실 없음.** 4건 중 가장 깨끗한 삭제.

### ④ `test-policy`:20 (삭제) — **핵심**

| | 원문 |
|---|---|
| **룰(삭제됨)** | `Report what was tested, what was not tested, and the remaining risk.` |
| **앵커 §7:122** | `Report what changed, what was verified and how, what independent review found, what was not verified, and what remains.` |
| **앵커 §5:92** | `If blocked, report exactly what remains unmet and why.` |

**덜 말해지는 것 — `remaining risk` ≠ `what remains`**
- 앵커의 `what remains` 가 무엇을 가리키는지는 같은 문서 §5:92 의 병렬 표현이 정한다: `what remains unmet` = **아직 충족되지 않은 기준**, 곧 **남은 일**이다.
- 룰이 요구하던 `the remaining risk` 는 **남은 위험**이다 — 할 일이 하나도 안 남은 변경에도 잔존 위험은 있다(안 건드린 경로, 커버 못 한 조합, 재현 못 한 조건).
- 앵커의 `what was not verified` 는 그 위험의 **재료**(사실 열거)이지 **판단**(그래서 무엇이 위험한가)이 아니다. 룰은 판단까지 요구했다.
- 기계 확인: `grep -n -i "risk" templates/CLAUDE.md` → **1건**(L90 `broaden according to risk`). 앵커의 보고 절에 `risk` 는 없다.

**판정: 실제 손실.** 커밋 메시지·ADR 이 이 삭제에 붙인 사유 "(앵커 §7 이 소유)"는 `remaining risk` 성분에 대해 **거짓**이다. 잃는 모집단 = Claude Code 설치자(및 Claude 와 함께 깐 OpenCode 설치자) — 이들은 이 지시를 되찾을 곳이 없다. → **결함 1**

---

## 남은 중복

대조 범위: 앵커 `templates/CLAUDE.md`(158줄) 전문 ↔ 배포 룰 7종 전문(85줄). 이슈 #289 의 4건 밖도 포함.

### [중복 1] 독립 리뷰 — `ship-checklist`:5 ↔ 앵커 §5:94-105  ★가장 순수한 잔존 중복

```
룰   templates/rules/ship-checklist.md:5
  - **머지는 그 변경을 만들지 않은 레인의 리뷰를 거친다.** 만든 쪽이 자기 산출물을 판정하면
    그건 검증이 아니다. 배포 직전이 아니라 **머지 시점**이다 — 리뷰 없이 쌓인 변경은 배포 때
    형식만 채워진다.

앵커 templates/CLAUDE.md:94-97
  Independent review by an agent or person other than the one that produced the work is
  required at two points: ... and for any completed change before it is merged into shared work.
앵커 templates/CLAUDE.md:102-105
  At these boundaries, an unreviewed artifact is not verified. ... never present self-review
  as independent review.
```

성분 대조 — **넷 중 셋이 1:1 대응이고 남는 것은 근거 한 줄뿐이다**:

| 룰 성분 | 앵커 대응 |
|---|---|
| 그 변경을 **만들지 않은 레인**이 리뷰 | `by an agent or person other than the one that produced the work` |
| **머지 시점**(배포 직전 아님) | `before it is merged into shared work` |
| 만든 쪽이 자기 산출물을 판정하면 검증이 아니다 | `never present self-review as independent review` + `an unreviewed artifact is not verified` |
| 리뷰 없이 쌓이면 배포 때 형식만 채워진다 | (없음 — 근거 서술) |

ADR-070 규칙 3(추상↔구체)의 보호를 받지 못한다: 룰이 더 구체적인 수단을 열거하지도, 임계값을 정하지도, 다른 트리거를 쓰지도 않는다. 규칙 1·2 를 그대로 적용하면 **앵커가 소유하고 룰에서 지워야 하는 항목**이다. 지운 3건보다 분량도 크다(약 150자). → **결함 2**

### [중복 2] 검사 실행 — `test-policy`:12 ↔ 앵커 §5:90 (+ `ship-checklist`:6 과 룰↔룰 중복)

```
룰   templates/rules/test-policy.md:12
  - Run the relevant checks and inspect their results.
앵커 templates/CLAUDE.md:90
  Run targeted checks first, then broaden according to risk. Iterate until the completion
  criteria pass.
룰   templates/rules/ship-checklist.md:6
  - 배포 전에 이 저장소가 정의한 검증을 **실행하고 결과를 확인한다.**
```

같은 동작(검사를 돌리고 결과를 본다)을 세 곳이 말한다. 앵커 쪽이 정보량이 더 많다(순서 + 반복). 이 PR 은 이 bullet 의 **뒷문장**만 지우고 앵커 재진술인 앞문장을 남겼다. 또 삭제 후 `test-policy`:12 와 `ship-checklist`:6 은 서로에 대해서도 거의 같은 문장이 됐다(둘 다 dev 트랙에 함께 설치된다). → **결함 5**

### [중복 3] 프로즈는 강제하지 않는다 — `git-policy`:12-14 ↔ 앵커 §6:116-118

```
룰   templates/rules/git-policy.md:12-14
  ## 강제되지 않는다는 사실
  **위 줄들은 프로즈다 — 아무도 안 막는다.** 되돌릴 수 없는 것은 로컬 훅이 아니라 **호스트
  규칙**으로 건다(우회도 재설치도 없다). ... `bash .uzys-agent-harness/protect-branch.sh --dry-run`

앵커 templates/CLAUDE.md:116-118
  These principles shape decisions; they do not block actions. Anything that must hold every
  time regardless of judgment belongs in the enforcement layer, not in a sentence here.
```

첫 문장("프로즈는 안 막는다")과 방향("강제는 다른 층에 건다")이 같다. 룰이 더 갖는 것은 **호스트 규칙**이라는 구체 지목과 설치된 도구 경로 — 이 둘은 규칙 3 의 보호를 받는다. 따라서 **부분 중복**이며, 지울 것은 첫 문장뿐이다. → **결함 4**

### [중복 4·경미] 착수 전 코드 확인 — `doc-governance`:5 ↔ 앵커 §1:8-10

```
룰   착수 시점의 미완 표기는 "안 된 것"이 아니라 **"모르는 것"**이다. 코드를 먼저 확인하고
     상태를 정정한다 — 심볼이 있다는 것만으로 완료로 읽지 않는다.
앵커 Before editing, inspect the affected code, tests, callers, interfaces, dependencies,
     documentation, and worktree changes. Resolve questions from the repository before asking
     the user.
```
"코드를 먼저 확인한다"는 앵커의 것이지만, 룰의 고유 주장(추적 문서의 미완 표기를 *모르는 것*으로 읽으라 · 심볼 존재 ≠ 완료)은 앵커에 없다. **규칙 3 보호 — 중복 아님으로 판정.** 기록만 남긴다.

### [중복 5·경미] 계약 경계 테스트 — `test-policy`:4 ↔ 앵커 §2:35

```
룰   Test observable behavior, contracts, and invariants rather than reproducing
     implementation details.
앵커 Prefer regression tests at stable contract boundaries.
```
`contracts` 가 겹치나 룰은 `observable behavior`·`invariants`·부정 조항(구현 디테일 재현 금지)을 더 갖는다. **중복 아님으로 판정.** 기록만 남긴다.

### 중복이 아니라고 판정한 것 (무엇을 봤는지)

| 룰 | 줄 | 앵커 대응 후보 | 판정 |
|---|---|---|---|
| `git-policy` | 3 (force push·history rewrite 등 열거) | §6:109 destructive/privileged 승인 | 규칙 3 — 추상↔구체 |
| `git-policy` | 5 (git config 는 사용자 것) | §4:85 pre-existing changes belong to the user | 대상이 다르다(config vs 작업 트리) |
| `git-policy` | 6 (로컬 게이트 ≠ 기본 브랜치 반영) | §7:122 보고 항목 | 앵커에 없는 구분 |
| `git-policy` | 10 (세션 종료 프로세스 정리) | — | 앵커에 없음 |
| `change-management` | 3·4 (합의 범위·Non-Goals·DO NOT CHANGE) | §1:19 되돌리기 비싼 선택은 묻는다 | 트리거가 다르다(범위 합의 vs 불확실성) |
| `change-management` | 5 (안정적으로 보여도 묻는다) | §4:75 요청 밖을 건드리지 마라 | 행위가 다르다(질문 vs 미변경) |
| `change-management` | 6·7 (결정 기록 대상·상태 갱신) | — | 앵커에 없음 |
| `doc-governance` | 3·4·7 | — | 앵커에 없음 |
| `cli-development` | 9~12·14 (빈 결과·파이프 `$?`·BSD/GNU·훅 계약) | §7:125 증거 없는 Pass 금지 | 규칙 3 — 구체 기법 |
| `playwright-launch` | 전체 | — | 앵커에 없음. 단 3행은 `ui-visual-review` **스킬**을 SSOT 로 지목(룰↔스킬, #289 범위 밖) |
| `ship-checklist` | 7·8·9·10 | — | 앵커에 없음(CI 배선·경로별 증거·취약점·drift 검사기) |
| `test-policy` | 3·5~11·13~17 | §5:91 `Do not weaken or silently omit criteria` (13 에 대해) | 13 은 규칙 3 — 구체 수단 열거 + 별개 규칙. 나머지는 앵커에 없음 |

---

## 결함

### [결함 1 · HIGH] `remaining risk` 는 앵커가 말하지 않는데 "앵커가 소유한다"는 사유로 삭제됐다

- **파일**: `templates/rules/test-policy.md`(삭제된 마지막 줄) · 사유는 `a3ecbee` 커밋 메시지 및 ADR-070 §Context
- **증거**: `grep -n -i "risk" templates/CLAUDE.md` → L90 **1건뿐**, 보고 절(§7:122-127)에 `risk` 없음. 앵커의 `what remains` 는 §5:92 `what remains unmet`(남은 **일**)과 같은 어휘장이고, 룰이 요구한 것은 남은 **위험**이다.
- **영향**: Claude Code 설치자(+Claude 동반 OpenCode)는 "검증 후 잔존 위험을 보고하라"는 지시를 잃는다. 되찾을 층이 없다(codex·antigravity 는 애초에 룰을 안 받으므로 이 손실의 모집단이 아니다).
- **재현**: `git show a3ecbee -- templates/rules/test-policy.md` 마지막 `-` 줄 ↔ `sed -n '120,127p' templates/CLAUDE.md`
- **성격**: 삭제 판단 자체가 틀렸다기보다 **사유가 사실이 아니다**. 되살리든(앵커 §7 에 `and the remaining risk` 를 더하는 방향 포함) 의도적 폐기로 재분류하든 판단이 필요하며, 지금 문서는 "잃은 게 없다"고 적혀 있어 다음 사람이 확인할 수 없다.

### [결함 2 · HIGH] 가장 순수한 중복(`ship-checklist`:5)이 남아 이슈가 절반만 닫힌다

- **파일**: `templates/rules/ship-checklist.md:5` ↔ `templates/CLAUDE.md:94-105`
- **증거**: §남은 중복 [중복 1] 의 4성분 대조표 — 3성분이 1:1 대응, 남는 것은 근거 서술 한 줄.
- **영향**: ADR-070 규칙 1·2 를 세워 놓고 같은 문서가 그 규칙 위반을 남긴다. `doc-governance` "한 사실은 한 곳에"를 파는 저장소의 자기적용 실패가 계속된다. 두 사본은 갈라진다(ADR-070 §Alternatives 가 스스로 그렇게 적었다).
- **재현**: `sed -n '5p' templates/rules/ship-checklist.md` ↔ `sed -n '94,105p' templates/CLAUDE.md`
- **판정 근거**: 이 PR 이 지운 3건과 같은 기준(같은 추상 수준의 재진술)에 걸리고, 분량은 더 크다.

### [결함 3 · MEDIUM] ADR-070 도달 표의 OpenCode 칸이 조건부인데 무조건으로 적혀 있다

- **파일**: `docs/decisions/ADR-070-resident-layer-ownership-by-reach.md` §Decision 표 · §Consequences "한계"
- **증거**: `src/installer.ts:293` `const base = spec.cli.includes("claude") ? installClaudeBaseline(...) : emptyClaudeBaseline();` — 실설치 프로브에서 `--cli opencode` 단독은 `.claude/rules/` **부재**(§A 표). `opencode.json` 의 `instructions: [".claude/rules/*.md"]` 가 매치할 파일이 없다.
- **정확한 서술**: 룰은 **무조건 1/4**(Claude Code) + **조건부 1/4**(OpenCode, Claude Code 동반 설치 시).
- **영향**: 결정의 방향은 바뀌지 않는다(오히려 강화된다 — 룰 도달이 더 좁다). 그러나 ADR 은 다음 사람이 판정 근거로 쓰는 문서이고, 이 저장소에는 ADR 본문이 쓰는 시점에 거짓이었던 전례(ADR-048)가 있다.
- **부수**: 같은 사실이 사용자에게 나가는 문장에도 있다 — `templates/opencode/AGENTS.md.template:60` "`instructions` 키(`opencode.json`)로 `.claude/rules/*.md` glob 자동 merge"가 렌더 산출물 252행에 그대로 실려, OpenCode 단독 설치자는 **없는 병합**을 있다고 안내받는다. **이 PR 이전부터 있던 결함**이며 열린 이슈(#294·#295·#297) 어디에도 없다.

### [결함 4 · LOW] `git-policy`:12 첫 문장이 앵커 §6 맺음절의 재진술

- **파일**: `templates/rules/git-policy.md:12-13` ↔ `templates/CLAUDE.md:116-118`
- **증거**: §남은 중복 [중복 3]. 뒷부분(호스트 규칙 지목 + `protect-branch.sh`)은 규칙 3 보호 대상이라 남겨야 한다.

### [결함 5 · LOW] 한 bullet 의 반쪽만 지워 앵커 재진술이 남았고, 룰↔룰 중복이 생겼다

- **파일**: `templates/rules/test-policy.md:12` ↔ `templates/CLAUDE.md:90` ↔ `templates/rules/ship-checklist.md:6`
- **증거**: §남은 중복 [중복 2].

### [결함 6 · LOW] 커밋 메시지의 "재진술 3건뿐" 뒤에 항목이 4개다

- **파일**: `a3ecbee` 커밋 메시지
- **증거**: "걷어낸 것은 … 재진술 3건뿐이다:" 다음에 bullet 4개. 사실(a)이 두 파일에 있어 문장은 4개·사실은 3건이라는 뜻이지만 본문이 그 구분을 적지 않는다. ADR-070 §Context 는 "같은 사실 4건 … 하나는 3중"이라 세어 **세는 단위가 두 문서에서 다르다**.

### 결함 없음으로 확인한 것 (시도한 것 나열)

- 앵커 무변경 — shasum 동일(§E-8).
- 수치 4,908/1,032 및 baseline 9트랙 — `cost:report` 재실행 일치(§F).
- `npm run ci` 재현 — exit 0 / 1340 passed / branches 88.8%(§G).
- `spec-drift-check.sh ship` — exit 0(§G).
- 범위 침범 — 5파일, `src`·`tests`·앵커 무변경(§G).
- 배선 주장 — 렌더 프로브 + 실설치 프로브 5조합(§A).
- 삭제 ②③ 손실 — 대조 결과 손실 없음(§삭제 대조표).
- 남긴 3종의 사유 — `기준 약화 금지`(규칙 3 정당) · `영향 범위 불확실 시 확대`(트리거 상이, 정당) · `Select the test level…`(앵커에 대응 없음, 정당).
- 게이트가 무는지 — 변이 3종으로 확인(§H). 다만 H3b 가 **의미 손실은 아무도 안 문다**는 것을 보였다.

---

## 미검증

1. **모델 준수 효과** — 이 재배치가 실제 모델 행동을 바꾸는지 측정하지 않았다(ADR-070 스스로도 §적용 범위에서 미적용이라 적었다).
2. **OpenCode 런타임의 `instructions` 글롭 동작** — `opencode.json` 파일 내용과 `.claude/rules/` 존재 여부만 확인했다. 실제 OpenCode 프로세스가 그 글롭을 읽어 컨텍스트에 올리는지는 이 호스트에서 실행이 차단돼 있어(`docker-only-realcli`) 검증하지 않았다. ADR-070 의 OpenCode ✅ 는 이 한 칸에 대해 **문서·파일 기준 주장**이다.
3. **Antigravity·Codex 런타임** — 같은 이유로 산출 파일까지만 확인했다.
4. `npm run cost:baseline` 재생성 경로 — `cost:report` 만 돌렸다.
5. **npm 게시본 대조** — 이 브랜치는 미게시라 패키지 tarball 내용은 보지 않았다.
6. `npx ecc-agentshield scan` · `npm audit` — 이번 범위(문서 변경)에 요청되지 않아 미실행.
7. **잔존 중복 전수성** — 앵커 158줄 × 룰 85줄을 사람이 양방향 대조했다. 기계 판정이 아니므로 "이것이 전부"라고 주장하지 않는다. 대조 대상과 판정은 §남은 중복에 전부 적었다.
8. **이슈 #294·#295·#297** — 범위 밖이라 보지 않았다. 다만 §결함 3 의 부수 관찰(OpenCode 단독 설치자에게 나가는 거짓 안내문)은 그 셋 중 어디에도 없다.

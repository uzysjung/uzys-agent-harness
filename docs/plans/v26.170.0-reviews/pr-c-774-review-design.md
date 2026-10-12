# PR #789 (#774 + 지문 모듈) — 설계 준수 독립 리뷰

- 대상: 격리 워크트리 `iso774a`, PR head `6456521` (origin/main `a6be19f` 대비)
- 리뷰어: 설계 준수 리뷰 레인(코드 · 설계 · 데이터 축). 컨테이너 실설치 축은 다른 리뷰어가 맡음
- 기준: 설계서 §0 · §1.1 · §1.3 · §2 AGENTS.md 행 · §3 · §4.3 · §6 PR-C · §7.1 · §8.1 · §8.2 1행 · §13(B3 · N-a · N-b) · 사용자 결정 ⓓ(2026-10-12)

## 판정: **PASS with notes** — BLOCKER 없음

설치자가 쓰거나 고친 `AGENTS.md` 몫이 **백업 없이** 사라지는 장면은 찾지 못했다(아래 프로브 10개 장면 전부 백업에 남음). 설계·ⓓ·B3·N-b 는 코드로 이행됐고 지문 데이터는 재생산·동결·53 합성이 모두 확인된다. 다만 **uninstall 화면이 설치자 줄이 든 파일에 "nothing of yours in it" 이라고 말하는 경우가 있다**(HIGH-1) — 손실은 아니지만(백업 있음) 설치자가 그 백업을 확인할 이유를 지워 버리는 거짓 문장이라 머지 전에 고치기를 권한다.

| Severity | Count | Status |
|---|---|---|
| CRITICAL | 0 | pass |
| HIGH | 1 | warn |
| MEDIUM | 2 | info |
| LOW | 4 | info |

## 완료 기준 — 직접 다시 돌린 증거

| 기준 | 결과 |
|---|---|
| §6 PR-C 테스트 7파일 (`legacy-fingerprints` · `agents-md-legacy-sections` · `agents-md-heading-owner` · `antigravity-anchor-retire` · `uninstall-agents-md-installer-sections` · `agents-md-preserve` · `agents-md-combined-update`) | **7 파일 · 66 테스트 green**, exit 0 |
| `T=$(mktemp) && node scripts/gen-legacy-fingerprints.mjs "$T" && cmp "$T" src/legacy-fingerprints.ts` | **gen=0 · cmp=0** (바이트 동일 54,721 B). 출력 = 114판 · 152 경로 · 372 쌍 · 37 · 6 · 53 · hookRefs 8 · statusLine 2 — 설계 §3.1 수치와 일치 |
| `npm run ci` (파이프 없이 exit 읽음) | **exit 0** — 154 파일 · 2318 테스트 · coverage branches 89.66 (하한 86) |
| 53 앵커 지문 합성 | origin/main `src/retired-anchor-sections.ts` 손목록 53 ↔ 생성물 `RETIRED_ANCHOR_SECTION_KEYS` 53: **diff 0**(정렬 비교). re-export 동일 객체임을 테스트가 단언 |
| 생성기 범위 고정 · 절대 경로 없음 | `RANGE_FROM="26.70.0"` · `RANGE_TO="26.169.0"` 상수, 태그 필터 `inRange` — v26.169.1 · v26.170.0 이 생겨도 제외. `REPO = fileURLToPath(new URL("..", import.meta.url))`(N-b 반영). `check-absence.sh --canary <절대경로 든 파일> '/Users/|/private/|/home/'` → 생성기·생성물 **매치 0, exit 0** |
| 생성물 손편집 없음 | 재생산 `cmp` 동일 = 생성기 출력 그대로. 생성물 머리 주석 범위 단언(테스트 ⓓ) 있음 |

### 변이(음성 대조) — 5종 직접 적용 · 전부 red · 원복 확인

규율: 적용을 `git diff --shortstat` 로 증명 → `tsc --noEmit` exit 0(빌드 파손 아님) → 대상 테스트 → `git checkout` → `git diff --quiet -- src` = clean.

| # | 변이 | tsc | 결과 |
|---|---|---|---|
| M1 | `isLegacyHarnessSection` 합집합 → `RETIRED_ANCHOR_SECTION_KEYS` 만(설계 ⓐ) | 0 | **red 14** (③ · ③′ 포함) |
| M2 | `agentsMdModel` 의 ④′ `if (legacy) return "sections"` 삭제(ⓑ) | 0 | **red 5** (① · ①′ · ② · ⑦ · ⑩) |
| M3 | `installerSectionsInHarnessArea` 의 지문 필터 제거(ⓒ) | 0 | **red 6** (④ · ④′ · ④″ · ⑤ · ⑤′ · ⑦″) |
| M4 | ⓐ₀ 를 `relevant()` 밖으로 — 비관련 경로에서도 `removeUnrecordedLegacyAgentsMd`(ⓓ · B2) | 0 | **red 1** (⑧ claude 단독) |
| M5 | B3 `owned` 의 OR(`rel === "AGENTS.md" && legacyAgentsMd`) 무력화 | 0 | **red 2** (⑦ · ⑦′) |

모두 원복 뒤 `restored=clean`, 최종 `git status` = `?? node_modules` 뿐.

## Findings

### [HIGH-1] uninstall 이 설치자 줄이 든 옛 `AGENTS.md` 를 지우며 "nothing of yours in it" 이라고 말한다
- File: `src/commands/uninstall.ts` `harnessRemovalLines`(`l.fileRemoved` 분기) · 판정 `stripLegacyAgentsMd`(`src/agents-md-merge.ts`)
- Issue: `stripLegacyAgentsMd` 는 하네스 이름 절(`Project Rules` 머리말 · `Session Start` · `Protected Files` …) 안의 **제목 없는 줄**을 하네스 것으로 걷는다(설계 §4.3 그대로). 그 결과 remainder 가 `null` 이면 화면이 `removed AGENTS.md (written by an older harness version, nothing of yours in it — saved a copy: …)` 를 낸다. 프로브(base = origin/main 추출본 vs PR, 같은 픽스처·같은 흐름):

  | 장면 | base(main) | PR |
  |---|---|---|
  | v26.100(기록 없음) + `## Project Rules` 바로 아래 설치자 한 줄 → uninstall | 파일 통째 유지(줄 라이브) | 파일 삭제 · 백업 1(줄은 백업에만) · **"nothing of yours in it"** |
  | v26.140(sha 다름 = 기록이 편집을 안다) + 같은 한 줄 → uninstall | #516 통째 유지 | 파일 삭제 · 백업 1 · **"nothing of yours in it"** |
  | v26.140 + `## Session Start` 아래 한 줄 → uninstall | 통째 유지 | 같음(삭제 · 백업 · 같은 문장) |
  | v26.100 + `## Session Start` 아래 한 줄 → uninstall | 통째 유지 | 같음 |

  손실은 아니다(백업에 줄이 있다 — 기준 충족). 그러나 두 번째 줄은 **기록 sha 가 다르다는 증거를 쥔 채로** "당신 것은 없었다" 고 말한다 — ADR-097 결정 9 "화면은 실제로 한 일만 말한다" 와 어긋나고, 설치자가 백업을 버려도 된다고 읽게 만든다. `## Project Rules` 는 이름 그대로 설치자가 프로젝트 룰을 적을 법한 자리다.
- Fix(방향만): 판정이 줄 단위로 설치자 몫을 증명하지 못하면 "nothing of yours" 를 주장하지 않는다 — 예: 이 경로의 파일 삭제 문구를 `removed AGENTS.md (written by an older harness version — saved a copy: <backup>; check it if you had edited it)` 처럼 백업을 가리키는 문장으로. 최소한 **sha 불일치(#516 경로)에서 온 삭제**에는 "nothing of yours" 를 쓰지 않는다. 테스트 ④′ 의 화면 단언도 함께.

### [MEDIUM-1] ADR-111 Consequences 에 N-a 계열 거짓 보장이 한 문장 남았다
- File: `docs/decisions/ADR-111-legacy-fingerprints-not-ownership.md:37`
- Issue: "번들 자리에서는 백업 없이 치워진다(… 옛 바이트는 옛 판 tarball 에 있다), 번들 밖에서는 백업 뒤 치워진다. **어느 쪽도 바이트는 디스크에 남는다.**" — 번들 자리 갈래는 백업이 없으니 그 바이트는 디스크에 남지 않는다. 바로 앞 괄호와도 모순이다. N-a 가 고친 "같은 바이트가 돌아온다" 와 같은 계열의 거짓 보장. (설계 §2 #9 · §8.1 원문에서 그대로 옮겨진 문장 — 설계서도 같다.) 루트 `CLAUDE.md` 보강 줄은 N-a 대로 "현행 판으로 다시 채워질 때만" 이라 문제 없다.
- Fix: 마지막 문장 삭제, 또는 "번들 밖은 백업으로 남고, 번들 자리의 옛 바이트는 옛 판 tarball 에만 있다".

### [MEDIUM-2] 지문 테스트 ⓒ 가 **지금의** `templates/rules/git-policy.md` 바이트에 묶여 있다
- File: `tests/legacy-fingerprints.test.ts` "ⓒ 설치자가 한 줄 고친 바이트는 못 알아본다"
- Issue: 자기검증으로 `isLegacyHarnessFile(".claude/rules/git-policy.md", sha(현행 템플릿))` 이 **true** 임을 단언한다. 상한이 v26.169.0 으로 고정이므로 v26.170 이후 누가 배포 룰 `git-policy.md` 를 한 글자만 고쳐도 이 테스트가 빨개진다 — 지문과 무관한 자산 편집이 이 테스트를 깨는 함정(다음 유지보수자가 "지문을 재생성해야 하나" 로 오판할 수 있다).
- Fix: 현행 템플릿 대신 고정 바이트(예: `git show v26.169.0:templates/rules/git-policy.md` 를 픽스처로)로 양성·음성을 만든다.

### [LOW-1] 루트 `CLAUDE.md` 보강 줄이 PR-D 의 동작(파일 백업 뒤 치우기)을 먼저 말한다
- 이 PR 은 `AGENTS.md` 절만 걷는다. 파일(`.claude/` 옛 바이트) 회수는 PR-D(#781). 설계 §6 이 이 줄을 PR-C 에 배정했으므로 설계 준수이고, 릴리즈는 둘이 모인 뒤라 설치자 영향은 없다. PR-C 머지 ~ PR-D 머지 사이 main 의 상주 문서가 코드보다 앞선다는 점만 기록.

### [LOW-2] ADR-111 Status · PR 칸
- `Status: Proposed`, `PR: PR-C(#774) · PR-D(#781)` 는 이슈 번호다. `change-management` 대로 머지 직전 `Accepted` + 실제 PR 번호(#789)로.

### [LOW-3] install 재실행(`add`)의 절 떨어뜨리기는 백업만 하고 화면에 말하지 않는다(편차 6)
- `backupFirst` 는 `backedUp` 에 싣지 않으므로 install 화면에는 아무 줄도 없다. 설계 §4.3 은 update 화면만 명시했으므로 설계 위반은 아니다. "실제로 한 일만 말한다" 쪽으로는 한 줄이 낫다 — 선택.

### [LOW-4] `mergeAgentsMd` · `stripHarnessFromAgentsMd` 원본은 이제 테스트 전용 얇은 래퍼(편차 3)
- 프로덕션 호출부는 전부 `…Detailed` / `stripAgentsMd` 로 옮겼고, 원본은 `tests/agents-md-heading-owner.test.ts` 등만 부른다. 기존 테스트 계약 보존용으로 수용 가능.

## 구현자 편차 판정

| # | 주장 | 확인 | 판정 |
|---|---|---|---|
| 1 | v26.140 화면 "removed 13"(설계는 6) | 13 = PR-A 앵커 절 7 + 꼬리 6. 전에는 앵커 절이 조용히 사라졌고, 설계 §4.3 · §9.2 ⑨ · ADR-111 Consequences 가 "앵커 절 걷기에도 백업 1회" 를 명시. v26.169 update 뒤 모양(③′)은 "removed 6" | **수용** — 설계 의도에 맞는 셈 |
| 2 | v26.153 은 머리 블록인용이 없어 술어 false | `git show v<v>:templates/{codex,opencode,antigravity}/AGENTS.md.template` 전 태그 조사: 첫 `## ` 앞 `>` 줄은 **v26.37~v26.150 에만** 있고 v26.151~ 없음. 프로브: v26.153 update 결과가 base 와 **제목 줄(임시 폴더 이름)만 다르고 나머지 바이트 동일**, 백업 0 · 화면 줄 0. uninstall 도 base 와 동일 | **수용** — §11 ⑩ 의 "술어 참" 가정은 틀렸지만 결과(영향 없음)는 같다. ADR-111 Consequences 에 사실대로 적혀 있다 |
| 3 | `…Detailed` / `stripAgentsMd` 병설 | 위 LOW-4 | 수용 |
| 4 | marker-md 어댑터 대신 로컬 블록 걷기 | `src/adapters/marker-md.ts:17` 이 `agents-md-merge.js` 를 import — 역방향 import 는 순환. `withoutAgentsBlock` 은 같은 `AGENTS_BLOCK` 마커 SSOT 의 `blockRange` 를 쓴다 | **수용** |
| 5 | 생성물 54,721 B · dist +53 KB | base(origin/main 빌드) `dist/index.js` 553,906 B → PR 607,322 B(**+53,416 B, +9.6%**). `node dist/index.js --help` 시작 시간 A/B 교차 3회: base 54.3 / 51.5 / 49.3 ms · PR 53.0 / 51.6 / 54.5 ms — **구분 불가**. 설계가 기각한 sha 접두 축약 외에 줄일 길은 주석뿐(수 KB) | **비례적** — 데이터가 곧 불변식이다. 설계서 §3.1 의 40,715 B 는 낡은 수치(ADR 은 "약 55 KB" 로 갱신됨) |
| 6 | 화면 한 줄은 update 만 | LOW-3 | 수용(선택 개선) |
| 7 | ⑦ 의 v26.169-update 기록 모양 수작업 | ⑦ 의 `AGENTS.md` 바이트는 컨테이너 실측 `26.100.0-A/AGENTS-2.md` 와 **동일**(제목 포함, diff 0; 나머지 3 픽스처도 실측본과 동일). 기록은 실측 없음 — 다만 형제 실측 `26.140.0-A/record-2.json` 이 v26.169 update 뒤 `records` 키 **없음** · `policyFiles`·`skillFiles`·`externalFiles`·`portions` 있음을 보여, 헬퍼(`delete records` · `externalFiles` 에서 `AGENTS.md` 만 제외 · `portions` = 블록 키)와 같은 모양이다 | **수용** — 잔여 위험은 실 npm 판 컨테이너 리뷰가 덮는다 |

## 의문 두 가지에 대한 답

1. **옛 `## Project Rules` · `## Session Start` 아래 제목 없는 줄이 라이브에서 빠진다 — 기존 병합과 같은가?**
   - **절 모델 update(v26.133~150)**: base 도 이미 그 줄을 **백업 없이** 버린다(프로브 `v140-rulesline-update` · `v140-ssline-update`: base 라이브에 MINE 없음 · 백업 0). PR 은 같은 결과 + 백업 1 → **개선**.
   - **블록 모델 update(v26.83~132)** 와 **uninstall 전반**: base 는 파일을 통째 남겼으므로 줄이 라이브에 있었다. PR 은 줄을 백업으로만 남긴다 — 설계 §4.3(이름 절 제거 · "설치자가 뭘 썼는지 모르는 파일을 통째 바꾸므로 1회 백업")과 ⓓ 그대로라 손실은 아니다. 문제는 uninstall 화면 문장뿐(HIGH-1).
2. **설치자가 옛 템플릿 절을 바이트 그대로 베껴 둔 것도 걷힌다(백업)** — 설계 §11 ③ 이 이미 받아들인 오판이고, 걷는 쓰기마다 파일 1회 백업이 남는 것을 테스트(③ · ⑤ 등 `backupText()` 단언)와 코드(`backupFirst` · `removeLegacyAgentsMd` 의 백업 선행 · 실패 시 `unjudged` 로 남김)로 확인. **수용.**

## 설계 · 결정 대조

- **ⓓ**: 지문을 소유 근거로 쓰지 않는다 — `AGENTS.md` 를 바꾸거나 걷는 모든 경로가 쓰기·삭제 **전** 1회 백업(update: `no-sha` 경로 또는 `backupFirst`; uninstall: `removeLegacyAgentsMd` 가 `backupFile` 먼저, 실패 시 아무것도 안 함). 루트 `CLAUDE.md` 첫 불릿 문장 **불변** + 보강 한 줄(§8.2 1행 문안과 일치, N-a 반영 "현행 판으로 다시 채워질 때만").
- **B3**: `agents-md-transform.ts` 의 `owned` 술어 OR — 변이 M5 로 무는 것 확인, ⑦ 이 `rootFiles` displaced 없음 · 설치자 절 없는 변형의 파일 소멸(백업만)을 단언.
- **B2**: update 는 `agentsMdClis` 로 claude 단독이면 `AGENTS.md` 를 안 건드리고, uninstall ⓐ₀ 는 `relevant()` 안 — M4 로 확인.
- **N2 · N4 · N3 · N13-6 · N13-7**: `withoutAgentsBlock` · `replaceUnfilledContext` 강제 · 화면 한 줄 · `neutralizeScaffoldBanner` · `agentsMdRerenderSet` 확장 — 각 테스트(⑦ · ① · ③ · ④ · ⑩)와 M2 로 확인.
- **N-b**: 확인(위 표).
- 범위: `RETIRED_PATHS` · `recorded()` · `judge()` 미변경 확인. 파일 회수(#781)는 들어오지 않았다 — 비목표 침범 없음.

## Positive Observations
- 생성기가 지문 함수(`legacySectionKey` · `legacyPreambleKey`)를 생성물에 직접 써 넣어, 뽑는 규칙과 대조하는 규칙이 한 곳에서 나온다.
- 테스트 픽스처 4개가 컨테이너 실설치본 바이트 그대로다(제목까지 diff 0) — 손으로 만든 옛 파일이 아니다.
- `removeLegacyAgentsMd` 는 백업 실패 시 쓰기·삭제를 하지 않고 `unjudged` 로 남긴다(잃는 쪽보다 남는 쪽).

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (`recorded()` · `RETIRED_PATHS` · `judge` 표 · 루트 CLAUDE.md 첫 불릿 문장)
- [x] SPEC/설계 범위 내 (PR-C 배정분만)
- 머지 전 권고: HIGH-1(화면 문장) · MEDIUM-1(ADR 한 문장) · LOW-2(ADR Status/PR 번호). MEDIUM-2 는 이 PR 또는 후속.

## 재현 메모(스크래치)
- 프로브: `zz-probe-774.test.ts` 를 base(`git archive origin/main`)와 PR 트리에 잠깐 넣어 같은 흐름 10장면을 돌리고 결과 `AGENTS.md` · 백업 sha · 화면을 비교(넣은 파일은 실행 직후 삭제, PR 워크트리 clean 확인). 산출: 리뷰 레인 스크래치 `probe-base/` · `probe-pr/`.

# 스킬 복원 계획 (P1) 독립 리뷰 — 2026-08-02

- 대상: `docs/plans/skills-restore-2026-08-02-todo.md` (AC1~AC7)
- 리뷰 레인: 작성자와 분리된 신선 인스턴스(읽기 전용). 실행 = grep · `git show 399e225:<path>` ·
  게이트 로직 재현 스크립트. `npm run ci` 미실행(지시).
- 판정 기준: **P0 = 착수 전 수정 필수**(AC 거짓화 · 기존 게이트 파손 · 범위 누락) /
  **P1 = 구현 중 반영**.
- 결과: **P0 6건 · P1 5건.**

---

## P0-1 · 보존 계약이 감사 증거를 다 안 덮는다 — 실측 76건, 계획 72건, 그리고 `damaged` 28건 축이 통째로 빠졌다

계획 9~13줄의 보존 계약이 이 사이클의 **완료 정의**이고 AC7 이 "전건 대조(72건)"라고 못박는다.
`audit-raw.json` 을 직접 세면 수치와 축이 둘 다 어긋난다.

`reports[].dropped` 를 `kind` 로 집계한 실측:

| kind | 실측 | 계획 표기 |
|---|---|---|
| decision-rule | 27 | 27 |
| worked-example | 14 | 14 |
| reference-citation | 9 | 9 |
| incident-evidence | 7 | 7 |
| contract-schema | 7 | 7 |
| guardrail | **7** | 6 |
| executable-script | 2 | 2 |
| **other** | **3** | **미열거** |
| 합계 | **76** | 72 |

누락된 4건의 정체(실측 인용):

- `[guardrail] multi-persona-review` — "패널 워커를 수거 즉시 닫으라는 운영 가드 … TaskStop/하네스
  stop 메커니즘으로 각 에이전트를 읽은 즉시 종료"
- `[other] model-orchestration` — "Quick reference ASCII 요약 블록 — 역할→모델 매핑 6줄 치트시트"
- `[other] clear-korean-communication` — "두 원본 모두의 'Related skills' 상호참조 … 스킬 간 역할 경계"
- `[other] verification-loop` — "'Continuous Mode' … 와 'Integration with Hooks' … 절 전체가
  이관본에 대응 없이 사라짐"

**더 큰 문제는 축이다.** 각 report 에는 `dropped` 와 **별도로 `damaged` 배열**이 있고 합 **28건**이다
(multi-persona-review 4 · model-orchestration 3 · clear-korean-communication 2 · north-star 4 ·
external-model-consult 4 · audit-service-gaps 2 · recurrence-prevention 4 · gh-issue-workflow 3 ·
verification-loop 2). 이것이 "사라진 것"이 아니라 **"뭉개진 것"** 이다 — 이 사이클이 존재하는 이유
바로 그 축인데 완료 정의 밖에 있다. 표본:

- `damaged/north-star` — "원본 NORTH_STAR.template.md §5 는 '## 5. Roadmap — 여기 두지 않는다'를
  명문화했는데, 이관본 … 은 **정반대로**" (계획 20줄이 "§5 로드맵은 여기 두지 않는다 복원"이라고
  적은 항목 자체가 `dropped` 가 아니라 `damaged` 쪽에 있다 — 즉 계획이 근거로 쓰는 항목조차
  `dropped` 전건 대조로는 안 잡힌다)
- `damaged/external-model-consult` — "Env allowlist 원칙은 남았으나 **구체 변수 목록 소실**",
  "타임아웃 … 300s 기본값 + 환경변수명 … 소실"
- `damaged/recurrence-prevention` — "Countermeasure selection logic: count-based 3-level ladder →
  a flat cause-taxonomy"

**AC7 을 그대로 두면** V&V 는 76−72=4건 + damaged 28건 = **32건을 검사 대상 밖**에 두고 "전건 대조
완료"를 보고한다. 이 사이클이 막으려는 실패 유형 그대로다.

> **수정 요구**: 보존 계약을 `dropped 76` + `damaged 28` = **104건 2축**으로 다시 쓰고, AC7 의
> "(72건)" 을 그 수로 교체. 계획 본문의 kind별 표도 실측(guardrail 7 · other 3)으로 정정.
> `damaged` 는 "verbatim 복원 또는 등가 서술"이 아니라 **"뭉개지기 전 판정 기준·수치·예시가
> 복원본에 실재"** 라는 별도 판정문이 필요하다(뭉개짐은 부재가 아니라 열화라 존재 검사로는 통과한다).

---

## P0-2 · AC2(바이트 그대로)와 AC4(subagent-file-handoff 게이트 부활)가 동시 충족 불가능하다

`git show 399e225:tests/subagent-file-handoff.test.ts` 는 `templates/skills/model-orchestration/SKILL.md`
의 `## Worker lifecycle` 이후 슬라이스에서 4개를 요구한다:

```
expect(lifecycle).toMatch(/file, not as a return message/);
expect(lifecycle).toMatch(/silent/);
expect(lifecycle).toMatch(/spawn prompt/);
expect(lifecycle).toMatch(/spawn-time/);
expect(lifecycle).toMatch(/retrofit/);
```

사용자 개정판(`docs/research/.../model-orchestration-SKILL-user-draft.md:135`)의 해당 절은
`## Worker lifecycle — 다 쓴 에이전트는 닫는다` 이고 내용은 **에이전트 종료(TaskStop)** 다.
문자열 실측:

| 문자열 | 개정판 출현 |
|---|---|
| `file, not as a return message` | **0** |
| `spawn prompt` | **0** |
| `spawn-time` | **0** |
| `retrofit` | **0** |
| `silent` | 3 (다른 문맥) |

AC2 는 "수정 금지 — 개선 제안이 있으면 보고로만", AC4 는 "복원해 새 본문에 앵커 재조준 … green 으로
만든다". 둘을 동시에 만족하는 경로가 없다. 남는 선택지는 셋뿐이고 **셋 다 사용자 결정 사항**이다:

1. 개정판에 파일 핸드오프 절을 **사용자가** 추가 → AC2 유지, 게이트 부활 가능
2. 게이트를 multi-persona-review 쪽 단언만 남기고 model-orchestration 소유 단언을 삭제 →
   **v26.120.0 에 구조로 내린 계약이 사라진다**(이 교훈은 프로즈로 2번 실패하고 3번째 재발한 뒤
   게이트가 됐다 — 메모리 `feedback_subagent_file_handoff`)
3. AC4 에서 이 게이트 1종을 명시적으로 제외하고 "상실 유지" 를 ADR-062 에 적는다

> **수정 요구**: 착수 전에 셋 중 하나를 **사용자 결정으로** 확정하고 AC2/AC4 에 반영.
> 지금 상태로 P2 를 시작하면 born-red 가 P3 에서 안 풀리고, 구현자가 AC2 를 어기거나
> 게이트를 무력화하는 방향으로 스스로 결정하게 된다.

---

## P0-3 · AC3 이 지목한 배선 상수가 실제 SSOT 가 아니고, 지목대로 하면 기존 게이트를 깬다

AC3: "manifest skill dirs(COMMON/MODIFIED_DEV/DEV_METHOD)".

내부 번들 스킬의 실제 SSOT 는 **`src/external-assets.ts:965 INTERNAL_BUNDLED_SKILL_IDS`** 이고,
소비자가 전부 이것을 순회한다(실측 grep):

| 소비자 | 위치 |
|---|---|
| manifest dir copy | `src/manifest.ts:315` (`applies: selectedInternalSkills.includes(sd)`) |
| installer 선택 계산 | `src/installer.ts:461` |
| update 갱신 | `src/update-mode.ts:305` |
| 4-CLI transform | `src/cli-transforms.ts:98`·`codex/transform.ts:122`·`antigravity/transform.ts:74` |
| gen:compat | `scripts/gen-compatibility.mjs:77` |
| 상주 비용 리포트 | `scripts/context-cost-report.mjs:30` |

AC3 이 이 이름을 한 번도 안 쓴다 = **4-CLI 렌더·gen:compat·비용 계측 경로가 배선 범위에서 누락**된다.

지목된 두 상수는 목적지로 쓰면 안 된다:

- **`COMMON_SKILL_DIRS`**(`src/manifest.ts:145`) — 카탈로그 엔트리 없이 `applies: all` 로 무조건
  복사한다. internal 엔트리와 병용하면 같은 target 이 manifest 에 2회 push 되고, wizard 에서는
  선택 자체가 불가능해진다(카탈로그를 안 거치므로).
- **`MODIFIED_DEV_SKILL_DIRS`**(`src/manifest.ts:164`) — ECC 체리픽 C3 목록이고
  `.dev-references/cherrypicks.lock` 과 1:1 이어야 한다. **`tests/vnv-verdict.test.ts:31` 이
  `expect(MODIFIED_ECC_SKILL_DIRS).not.toContain("verification-loop")` 를 단언한다** — 계획 27줄이
  "lock 재등재 없이" 라고 적은 것과 AC3 의 상수 지목이 서로 모순이다.

> **수정 요구**: AC3 을 `INTERNAL_BUNDLED_SKILL_IDS` / `DEV_METHOD_SKILL_IDS` 두 상수와
> `method.kind:"internal"` 의 **key union 확장**(`src/external-assets.ts:43-50` 은 닫힌 union 이라
> 9개 key 추가 없이는 타입 에러)으로 다시 쓰고, `COMMON_SKILL_DIRS`·`MODIFIED_DEV_SKILL_DIRS` 는
> **손대지 않는다**를 명시. 4-CLI transform·gen:compat·context-cost 를 배선 범위에 추가.

---

## P0-4 · 9종의 DEV_METHOD 멤버십을 안 정해 두면 기존 불변식 3개와 충돌한다 (부분집합 → 사용자가 안 고른 자산 설치)

계획은 "DEV_METHOD" 를 목적지로만 적고 **누가 들어가는지**를 안 정했다. 기존 단언 3개가 서로 다른
방향으로 제약한다:

| 게이트 | 단언 | 함의 |
|---|---|---|
| `tests/external-assets.test.ts:277` | DEV_METHOD 전원 `condition.kind === "has-dev-track"` | north-star·gh-issue-workflow(`any-track` 전 트랙)는 **못 들어간다** |
| `tests/external-assets.test.ts:286` | `INTERNAL_BUNDLED == DEV_METHOD` (집합 등식) | opt-in 2종을 번들에 넣는 순간 **반드시 깨진다** — 복원하면 등식은 유지 불가 |
| `tests/wizard-bundle.test.ts:77` | `recommended ∩ members ∈ {∅, 전체}` | 조건이 섞인 멤버십은 **부분집합**을 만든다 |

세 번째가 조용한 사고다. north-star·gh-issue-workflow 를 DEV_METHOD 에 넣으면 `executive` 트랙에서
`recommendedExternalAssets` 가 그 2종만 돌려주고 → 접기(`anyMember → 번들 체크`) + 펼치기(→ 전원)가
**사용자가 고르지 않은 자산을 설치**한다. 테스트 메시지가 그대로 그 시나리오다.

399e225 의 실제 배치가 이 제약의 해답이었다(참고용 실측):

| 스킬 | 399e225 배치 |
|---|---|
| north-star · gh-issue-workflow | `COMMON_SKILL_DIRS`(카탈로그 엔트리 없음) |
| verification-loop | `MODIFIED_DEV_SKILL_DIRS`(ECC C3) |
| multi-persona-review · gap-analysis-e2e · recurrence-prevention · asis-tobe-decision · compaction-handoff | `DEV_METHOD_SKILL_IDS` |
| model-orchestration · gemini/codex-consult · explain-plainly | `INTERNAL_BUNDLED` 만(opt-in) |

이번엔 셋 다 배치가 달라진다(전 트랙 2종에 카탈로그 엔트리가 생겼고, verification-loop 은 C3 를 떠났다).

> **수정 요구**: AC3 에 **id별 목적지 표**를 박고, `INTERNAL_BUNDLED == DEV_METHOD` 등식
> (`external-assets.test.ts:286`)을 **어떤 단언으로 대체할지**를 계획 단계에서 정할 것.
> 그 등식의 주석이 밝힌 의도는 "번들 목록의 모든 id 가 실제로 `templates/skills/<id>` 로 존재"이므로
> 등식이 아니라 **디렉터리 실재 검사 + `DEV_METHOD ⊆ INTERNAL_BUNDLED` 포함관계**가 의도에 맞는다
> (프록시를 실제 속성으로 바꾸는 것 — `wizard-bundle.test.ts:68` 이 같은 교훈을 이미 기록).

---

## P0-5 · AC5 의 "NSM 스킬 descriptor 수 변동 · cost:baseline 재생성"은 internal 배선에서 **아무 값도 안 움직인다** — 상주 증가가 계측에 안 잡힌다

두 계측 게이트의 measure 함수가 spec 에 `selectedInternalSkills` 를 **안 넣는다**:

- `tests/context-cost-ratchet.test.ts:44` — `{ tracks:[track], cli:["claude"], options:{} }`
- `tests/north-star-cost-figures.test.ts:26` — 동일

`src/manifest.ts:320` 의 게이팅은 `(s) => (s.selectedInternalSkills ?? []).includes(sd)` 이므로
**번들 스킬은 전부 false → 항목 0 · 토큰 0** 으로 계산된다. 즉 9종을 internal 로 복원해도
`context-cost-baseline.json` 도, NORTH_STAR 의 "skill descriptors N개 ~T" 도 **한 자리도 안 변한다.**

결과: dev 트랙 설치마다 스킬 디렉터리가 6~10개 늘어나는데 이 리포의 **1차 NSM(상주 항목 수)** 은
변화 없음을 보고한다. 반대로 north-star·gh-issue-workflow 를 `COMMON_SKILL_DIRS` 로 되돌리면
(P0-3 이 금지하는 경로) 전 트랙 items +2 로 ratchet(`actual ≤ recorded`)이 즉시 문다 — 즉
**계측이 잡히느냐가 배선 선택에 따라 갈리는데 계획은 그걸 모른 채 "재생성"만 적었다.**

> **수정 요구**: AC5 에서 두 갈래를 분리해 쓸 것. ⓐ `cost:baseline` 재생성은 **값이 안 바뀐다**는
> 사실을 먼저 확인하고 "변경 없음"을 증거로 남긴다(변할 것처럼 적어 두면 다음 세션이 stale 로 오인).
> ⓑ 번들 스킬이 상주 계측에서 0으로 보이는 것이 의도인지 결함인지 **판정**하고, 결함이면 별도 항목으로
> 분리한다(이 사이클에서 고칠지 여부는 사용자 결정 — 계측 경로 변경은 ratchet 전 트랙 baseline 을
> 동시에 움직인다). 지금처럼 뭉뚱그리면 "상주 비용 영향 없음" 이 미검증 주장으로 출하된다.

---

## P0-6 · AC6 의 적용 범위 "기설치 npx 사용자 영향 없음"이 update 경로와 어긋난다

ADR-062 적용 범위 초안(계획 57~58줄): "기설치 npx 사용자 영향 없음 — 우리 카탈로그만 변경".

실제 경로:

1. `npx skills add` 의 프로젝트 스코프 설치처는 **`.claude/skills/<id>`** 다
   (`src/install-log.ts:295` — `case "skill": return false; // npx skills add project scope → .claude/skills/`).
2. 그 실체는 skills 저장소로의 **링크**다 (`src/fs-ops.ts:102` 표: "안쪽 링크
   (`skills/<id>` → `npx skills add` 저장소)").
3. `syncSkills`(`src/update-mode.ts:424`)는 **"target 에 그 디렉터리가 있으면"** 템플릿 파일을 그
   안에 써 넣는다 — `existsSync(targetSkill)` 만 보고 링크 여부를 판정하지 않는다.

⇒ ADR-060 대로 `npx skills add uzysjung/uzys-agent-skills` 로 9종을 받은 프로젝트가 이번 판으로
`update` 를 돌리면, 하네스가 **이관 리포 본문을 우리 번들본으로 덮어쓴다**(백업은 남지만 쓰기 대상은
사용자의 skills 저장소이고, 그건 `.claude/` 밖일 수 있다). "영향 없음"은 거짓이다.

> **수정 요구**: AC6 의 적용 범위를 실제 동작으로 다시 쓰고, 이 덮어쓰기를 **의도로 승인할지 /
> `syncSkills` 에 심볼릭 링크 건너뛰기를 넣을지**를 착수 전에 정할 것. 후자를 택하면 AC3 배선 범위에
> `src/update-mode.ts` 와 회귀 테스트가 추가된다(현재 AC3 은 "update 경로 테스트 갱신"만 적혀 있어
> 이 결정이 안 들어 있다).

---

# P1 (구현 중 반영)

## P1-1 · COMPATIBILITY 서문은 `gen:compat` 이 안 건드린다 — 손으로 고쳐야 게이트가 초록

AC5 는 "COMPATIBILITY(gen:compat)" 라고만 적었다. 실측: `scripts/gen-compatibility.mjs:175` 는
`AUTO-GEN:CATALOG:START ~ END` 사이만 치환하고, 그 마커는 `docs/COMPATIBILITY.md` **36~142행**이다.
게이트가 읽는 서문은 **17행**으로 마커 밖이다:

- `tests/docs-supply-chain.test.ts:255-273` — `전 카탈로그 (\d+)/(\d+) 🟢 … 나머지 (\d+) 자산 🟡 …
  dev-method (\d+)종` 을 파싱해 분모 = `EXTERNAL_ASSETS.length`, 🟢+🟡 = 총계,
  dev-method 수 = `DEV_METHOD_SKILL_IDS.length` 를 단언.

복원 시 9종이 `kind:"skill"`(🟢 Docker) → templates(🟡)로 바뀌므로 현재 `51/55 🟢 · 나머지 4 🟡 ·
dev-method 1종` 이 **전부** 손으로 갱신돼야 한다. (카탈로그 총계 55 자체는 엔트리 수가 안 변하므로
유지 — AC3 의 "55 유지 여부 실측 표기"는 성립한다.)

## P1-2 · AC5 의 "REFERENCE(스킬 표·npx 안내 제거)"는 대상이 없다 — 실제 문제는 반대 방향이다

`tests/reference-catalog-rows.test.ts` 의 추출기를 `docs/REFERENCE.md` 에 그대로 돌린 실측:
**식별자 12건, 그중 uzys 스킬 0건**(plugin 8 · skill 3[find-skills·vercel-react-best-practices·
web-design-guidelines] · source 1[shadcn/ui]). 즉 REFERENCE 에는 지울 npx 안내가 없다.

**실제로 있는 것은 그 반대의 drift 다.** `docs/REFERENCE.md:121` 이 north-star 를 아직 "자체 작성
자산 / templates/skills" 표에 싣고 있고, `:127` 이 `skills/north-star/NORTH_STAR.template.md` 를
가리키는데 **그 디렉터리는 #267 이 지웠다**(`ls templates/skills/` 에 north-star 없음). 아무 게이트도
이걸 안 문다.

> 팀리드 질문에 대한 답: **탐지기 하한(`idents.length > 5`)은 안 깨진다** — 제거 대상이 0건이라
> 12건이 그대로 남는다. AC5 를 "제거"가 아니라 "복원 후 §5/§6 정합(현재 stale 행 포함)"으로 고칠 것.

## P1-3 · 복원 파일 목록이 SKILL.md 만 상정한다 — 사이드카 3건 누락

399e225 실측 파일 구성:

| 원본 | 파일 | 계획 표기 |
|---|---|---|
| north-star | `SKILL.md` + **`NORTH_STAR.template.md`** | 템플릿 미표기 |
| gh-issue-workflow | `SKILL.md` + `ISSUE.template.md` | ✅ 표기됨 |
| verification-loop | `SKILL.md` + **`agents/openai.yaml`** | 미표기 |
| gemini-consult / codex-consult | `SKILL.md` + `scripts/*.sh` | ✅ 표기됨 |

`NORTH_STAR.template.md` 는 선택이 아니다 — `north-star-skill.test.ts` 가 모듈 최상위에서 그 파일을
`readFileSync` 하고 2개 케이스가 그 내용을 단언한다(`Pillar`·`| 모듈`·`프록시`, 그리고 도메인 누출
검사). 파일이 없으면 게이트가 앵커 재조준이 아니라 **ENOENT 로 죽는다**.

## P1-4 · "born-red" 가 assertion red 가 아니라 수집 단계 크래시다 — 증거로 약하다

4개 게이트 전부 모듈 최상위에서 대상 파일을 `readFileSync` 한다(P2 시점엔 파일이 없다). 그러면
vitest 는 **어떤 계약이 안 지켜졌는지 못 보여주고** 파일 수집에서 죽는다. AC4 의 "각 게이트 변이 red
확인"은 그 상태에선 수행 불가다(변이시킬 본문 자체가 없다).

> 순서를 유지하려면 P2 의 born-red 를 "파일 부재 크래시"가 아니라 **P3 직후 앵커 변이 red**로
> 정의하거나(음성 대조는 삭제 대신 추가로 — 메모리 `lane-separation-2026-07-26`), P2 가 최소 스텁을
> 함께 두고 assertion red 를 눈으로 볼 것.

## P1-5 · references/ 분리 대상이 "300줄 초과만" 으로 남아 있다 — 통합 3종 전부 걸린다는 사실을 AC 에 못박아야 한다

원본 줄 수 실측(399e225):

| 통합본 | 원본 합계 | 300줄 게이트 |
|---|---|---|
| clear-korean-communication | 162 + 157 = **319** | 초과 |
| north-star | 157 + 178 = **335** | 초과 |
| external-model-consult | 339 + 250 = **589** (+ 스크립트 434줄) | 초과 |

셋 다 걸리는데 계획은 "본문 300줄 초과 스킬만"이라는 조건문만 두었다. 보존 계약(계획 13줄)이
"줄 수 절약을 이유로 dropped 를 다시 빼는 것은 실패 · 분량 조절은 references/ 로"라고 못박은 이상,
**세 통합본은 references/ 분리가 선택이 아니라 예정된 작업**이다. AC 에 명시하지 않으면 구현자가
줄 수 압박을 본문 축약으로 해소할 여지가 남는다(그게 이관 리포에서 일어난 일이다).

---

# 팀리드 지정 질문에 대한 실측 답 (지적 아님 · 판단 근거로 씀)

| 질문 | 실측 결과 |
|---|---|
| REFERENCE npx 제거 시 탐지기 하한(>5) 파손? | **파손 없음.** 추출 12건 전부 비-uzys → 제거 대상 0건 (P1-2) |
| 게이트 4종이 399e225 에 실재? | **4종 전부 실재.** `git cat-file -e 399e225:tests/<n>.test.ts` 4/4 EXISTS. #267~#268 이 지운 테스트는 이 4종 + 무관 2종(`install-karpathy-hook`·`settings-merge`) |
| `.claude/skills/` 잔존물과 복원 9종 충돌? | **이름 충돌 0.** 현재 10디렉터리(agent-introspection-debugging·architecture-decision-record·compaction-handoff·continuous-learning-v2·deep-research·eval-harness·find-skills·spec-scaling·strategic-compact·ui-visual-review) |
| `git add -f` 전제 성립? | **성립.** `.gitignore:45` 가 `.claude/skills/` 를 무시하는데 기존 14파일이 추적 중 |
| 트리거 중복 게이트(`skill-trigger-overlap`, 임계 0.30) 위험? | **위험 없음.** 복원 10종 45쌍 최대 **0.188**(audit-service-gaps ↔ multi-persona-review). 원본 description 을 병합한 최악 근사 + model-orchestration 은 사용자 개정판 frontmatter 사용 |
| consult wrapper 복원이 `templates-distribution-hygiene` 에 걸리나? | **안 걸린다.** 399e225 의 16개 원본 파일(스크립트 2종 포함) + 사용자 개정판 전부 clean — 홈 경로·`ADR-NNN`·`vNN.N.N`·출처 귀속 정규식 매치 0건 |
| 상주 문서가 복원 9종을 이름으로 지목하나(`resident-doc-asset-reachability`)? | **지목 0.** `templates/rules/`·`templates/CLAUDE.md` 가 이름으로 부르는 스킬은 `ui-visual-review` 뿐 |
| 카탈로그 총계 55 유지? | **유지.** 엔트리 수가 아니라 `method.kind` 만 바뀐다 (`EXTERNAL_ASSETS.length` derive) |

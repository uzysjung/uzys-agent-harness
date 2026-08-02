# 스킬 복원 사이클 (2026-08-02) — P1 리뷰 반영 개정판

사용자 지시: 이관 실패 시 uzys-agent-skills 폐기 + 이 리포 복원·개선 (조건 성립, ulw).
감사 = `docs/research/skills-migration-audit-2026-08-02/`. 독립 리뷰 = 같은 이름 `-review.md`
(P0 6·P1 5 — 본 개정판에 전부 반영). 사용자 결정 2건(2026-08-02): 개정판에 파일 핸드오프 절
추가(반영됨) · 계측 사각은 이월.

## 보존 계약 (완료 정의) — 104건 2축 [P0-1]

`audit-raw.json` 실측: **dropped 76건**(decision-rule 27 · worked-example 14 ·
reference-citation 9 · incident-evidence 7 · contract-schema 7 · guardrail 7 ·
executable-script 2 · other 3) + **damaged 28건**. 판정문이 다르다:
- dropped → 항목이 복원본에 **실재**(verbatim 또는 등가 서술)
- damaged → 뭉개지기 전의 **판정 기준·수치·예시가 실재**(존재 검사로는 통과하는 열화라 별도 판정)
줄 수 절약을 이유로 이 계약을 다시 빼는 것은 실패다 — 분량 조절은 references/ 분리로.

## 통합 매핑 + id별 목적지 [P0-3·P0-4]

배선 SSOT = `src/external-assets.ts` `INTERNAL_BUNDLED_SKILL_IDS`(+ method key 닫힌 union 에
9 key 추가) / `DEV_METHOD_SKILL_IDS`. **`COMMON_SKILL_DIRS`·`MODIFIED_DEV_SKILL_DIRS` 는 손대지
않는다**(전자는 카탈로그 우회·중복 push, 후자는 vnv-verdict 가 `not.toContain("verification-loop")`
단언). 소비자 전 경로가 배선 범위다: manifest·installer·update·**4-CLI transform(codex/
antigravity/cli-transforms)·gen:compat·context-cost-report**.

| 복원 스킬 | 원본(399e225) + 사이드카 [P1-3] | 목적지 | condition |
|---|---|---|---|
| clear-korean-communication | asis-tobe-decision + explain-plainly | DEV_METHOD | has-dev-track |
| audit-service-gaps | gap-analysis-e2e | DEV_METHOD | has-dev-track |
| multi-persona-review | multi-persona-review | DEV_METHOD | has-dev-track |
| recurrence-prevention | recurrence-prevention | DEV_METHOD | has-dev-track |
| verification-loop | verification-loop + **agents/openai.yaml** | DEV_METHOD | has-dev-track. lock 재등재 없음 — 본문에 ECC 출처·MIT 귀속 1줄 |
| north-star | north-star + northstar-roadmap + **NORTH_STAR.template.md** | internal 번들만 | any-track (전 트랙 기본 — DEV_METHOD 금지: has-dev-track 불변식) |
| gh-issue-workflow | gh-issue-workflow + ISSUE.template.md | internal 번들만 | any-track |
| external-model-consult | gemini-consult + codex-consult + **scripts/ 2종(434줄)** | internal 번들만 | opt-in |
| model-orchestration | 사용자 개정판(파일 핸드오프 절 포함판) 바이트 그대로 | internal 번들만 | opt-in |

DEV_METHOD = 기존 compaction-handoff + 위 5종 = **6종 전원 has-dev-track**(wizard 파티션 유지).
`INTERNAL_BUNDLED == DEV_METHOD` 등식 테스트(external-assets.test.ts:286)는 의도(디렉터리 실재)에
맞게 **ⓐ 전 id 의 `templates/skills/<id>/SKILL.md` 실재 검사 + ⓑ `DEV_METHOD ⊆ INTERNAL_BUNDLED`**
로 교체한다. 폐기 유지: harness-health-audit · ultracode-service-audit.

## 역수입 (감사 인정 개선)

- **references/ 분리 — 통합 3종은 선택이 아니라 확정** [P1-5]: clear-korean(319줄)·
  north-star(335줄)·external-model-consult(589줄+스크립트) 전부 300줄 초과. 분리는 이동이지
  삭제가 아니다. 1-depth.
- description: 원본 verbatim 사용자 발화 유지 + Do-NOT 절 채택. 트리거 중복 게이트는 실측
  최대 0.188 로 안전(리뷰 확인).
- improved 항목 채택/기각을 구현 보고에 항목별 기재.

## AC

- **AC1 스킬 9종 복원**: templates/skills + `.claude/skills`(`git add -f` sibling 관례, 이름
  충돌 0 확인됨). 보존 계약 104건 2축 충족.
- **AC2 model-orchestration**: 개정판(파일 핸드오프 절 포함) 바이트 그대로. frontmatter 포함.
- **AC3 배선**: 위 목적지 표대로. method union key 확장 · gen:compat 재생성 · 카탈로그 55 유지
  (엔트리 수 불변, kind 만 변경 — 리뷰 실측) · installer/uninstall 테스트 갱신 ·
  **update `syncSkills` 에 심볼릭 링크 건너뛰기 가드 + 회귀 테스트** [P0-6 — npx 로 이관 리포를
  받은 프로젝트의 skills 저장소를 우리 본문으로 덮어쓰는 경로 차단].
- **AC4 게이트 4종 부활**: subagent-file-handoff · north-star-skill · recurrence-prevention-skill ·
  consult-model-tier (399e225 에 4/4 실재 확인). P2 는 **스텁 본문과 함께** 복원해 assertion red
  를 눈으로 확인 [P1-4 — 파일 부재 크래시는 증거가 아니다]. P3 후 각 게이트 앵커 변이 red 재확인.
  새 본문(통합명·개정판)에 앵커 재조준 — 검사 삭제·완화 금지.
- **AC5 문서·수치**: REFERENCE — "npx 안내 제거"가 아니라 **stale 정정**(:121 north-star 죽은
  경로 등)과 복원 후 §5/§6 정합 [P1-2] · COMPATIBILITY — gen:compat 마커 밖 **서문 17행 수동
  갱신**(51/55 🟢·🟡 4·dev-method 1종 → 실측값. 게이트 docs-supply-chain:255 가 파싱) [P1-1] ·
  NORTH_STAR·CLAUDE.md(uzys 스킬 SSOT 문구 전면 교체) · **cost:baseline 은 "무변동"을 실측
  증거로 기재** [P0-5 — 번들 스킬은 계측 spec 밖이라 값이 안 움직인다. 사각 자체는 이월(사용자
  결정), `docs/todo.md` 백로그에 기록].
- **AC6 ADR-062**: ADR-060 결정 1 부분 Supersede + ADR-060 헤더에 상호참조 주석. 적용 범위는
  실제 update 동작으로: ⓐ 이 리포 카탈로그의 kind 전환 ⓑ npx 기설치 프로젝트 — syncSkills
  링크 가드로 **덮어쓰지 않음**(가드 도입이 전제) ⓒ 이관 리포 처분은 사용자 직접.
- **AC7 검증**: `npm run ci` exit 0 · 보존 계약 104건 전건 대조(fresh opus V&V) ·
  스크립트 2종 shellcheck + stdin mock 스모크 · 게이트 변이 표본 red.
- **AC9 task-brief 스킬 + 넛지 훅 신설** (사용자 지시 2026-08-02, "Model-Orchestration 과 함께
  프롬프트를 구조화 브리프로 변환하는 것을 강제"):
  - **스킬 `task-brief`** (templates/skills + .claude/skills): 템플릿 SSOT =
    `docs/research/skills-migration-audit-2026-08-02/task-brief-template-user-v2.md`
    (**사용자 v2 — 원문 그대로**. invariants[정답 정의, autonomy 불가침] · verification
    [자체완결/리뷰어위임 2모드 — 리뷰어위임형은 레인 원칙·model-orchestration V&V 와 정합] ·
    communication 캡 · autonomy 대화형/무인형 · 빈 섹션 삭제 규칙 포함). 양방향 사용을 규정 — ⓐ inbound: 비정형 태스크 프롬프트를 브리프로 정규화(빈 필드는
    컨텍스트로 채우고, 해석이 결과를 실질 변경할 때만 질문 — autonomy 절 자체가 질문 정책)
    ⓑ outbound: Agent/Workflow 위임 프롬프트가 7블록을 따름(model-orchestration 의 위임 5요소를
    포섭 — resource limit ↔ effort/모델 캡). model-orchestration 상호참조는 task-brief → 단방향
    (개정판은 AC2 로 바이트 동결 — 역방향 참조 추가는 사용자 승인 후 별도).
  - **훅 `task-brief-nudge.sh`** (UserPromptSubmit, ALWAYS_HOOKS + settings 배선 동시):
    판단 없는 결정론만 — 프롬프트 ≥400자 && `<objective>` 태그 부재 → stdout 1줄 넛지.
    변환 자체는 스킬 몫(공식 기준: 판단 필요 → 스킬 / 매번 동일 → 훅). hook-wiring-parity
    게이트가 배선 누락을 문다. stdin mock 3케이스 + 입력 변이 테스트(test-policy 새 가드 조항).
  - 배선: 카탈로그 internal 엔트리(any-track — 위임은 전 트랙 행위) + manifest + 카탈로그 수
    55→56 파급(문서 분모 전체 스윕) + 게이트 갱신.
  - **레인 P3-D** (opus@xhigh): P3-C 와 같은 파일(external-assets·manifest·settings)을 만지므로
    **P3-C 완료 후 착수** — 병렬 금지.
- **AC8 README·연결 문서 현행화 + 카피 재작성** (사용자 지시 2026-08-02, **P4 이후 마지막**):
  README.md 와 README 가 링크하는 문서 전부(인벤토리는 실행 시점 README 에서 derive)를 복원
  후 상태로 현행화하고, 한국어 카피는 **gemini-consult**(Mode A, 배치 호출)로 재작성한다.
  주요 카피(히어로 등)는 before→after 표로 보고 — 게이트: docs-supply-chain 등 문서 게이트
  green + `npm run ci` 재확인. agy 인증 만료 시 사용자에게 재로그인 요청(스킬 계약).

## 레인 (모델 정책 v3 — 배타 소유)

| 레인 | 모델 | 소유 | 순서 |
|---|---|---|---|
| P2 게이트 부활 | opus@xhigh | tests/{subagent-file-handoff,north-star-skill,recurrence-prevention-skill,consult-model-tier}.test.ts + 스킬 스텁 | 선행, assertion red 증거 |
| P3-A 통합 3종 | opus@xhigh | templates/skills/{clear-korean-communication,north-star,external-model-consult} + .claude/skills 사본 | P2 후 병렬 |
| P3-B 단순 6종 | opus@xhigh | templates/skills/{audit-service-gaps,multi-persona-review,model-orchestration,recurrence-prevention,gh-issue-workflow,verification-loop} + .claude/skills 사본 | P2 후 병렬 |
| P3-C 배선·문서 | opus@xhigh | src/** · scripts/gen-compatibility 산출 · tests/(P2 소유분 제외) · docs/{REFERENCE,COMPATIBILITY,NORTH_STAR}.md · CLAUDE.md · docs/todo.md(이월 기록) · context-cost-baseline.json | **P3-A/B 완료 후** |
| P4 V&V | opus@xhigh 신선 | 읽기 전용+재실행 | P3-C 후 |
| 오케스트레이터 | Fable | 계획·ADR-062·커밋·PR·MEMORY | 전 구간 |

공통: git 상태 변경 금지 · 변이 복구는 백업 파일 방식 · P3-A/B 는 스텁을 본문으로 교체할 때
P2 게이트를 green 으로 만든다.

## Non-Goals

이관 리포 삭제/아카이브(사용자 직접) · evals 러너 · 계측 사각 수정(이월 확정) · 폐기 2종 부활 ·
릴리즈(머지 후 별도 승인) · templates/CLAUDE.md 앵커 변경 · COMMON/MODIFIED_DEV 상수 변경.

## 진행

- [x] 감사 + 판정 · PR #268 머지(main `b3fc187`) · 브랜치 생성
- [x] P1 계획 리뷰(P0 6·P1 5) → 본 개정판 · 사용자 결정 2건 반영
- [x] P2 게이트 부활 (4종 assertion red 21건 출생 — 오케스트레이터 직접 재확인)
- [x] P3-A/B/C 구현 (9종 복원·배선·링크 가드 — ci 89/1,225 green)
- [x] P3-D task-brief 스킬+훅 신설 (ci 90/1,242 green, 분모 56 스윕)
- [x] P4 V&V (fresh opus — 보존 계약 104/104 · 지적 4건 전건 정정)
- [x] P5 사실 현행화(전 스위트 green) + gemini 카피 10블록 + 최종 ci exit 0
- [x] ADR-062(Accepted) + 커밋 `d3de3d0` + **PR #269 — 머지는 사용자 승인 대기**

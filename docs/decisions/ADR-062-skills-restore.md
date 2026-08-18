# ADR-062: 스킬 외부화 번복 — 이관 실패 판정에 따른 번들 복원·개선

- Status: Accepted
- Date: 2026-08-02
- PR: #269
- Supersedes: ADR-060 (결정 1 「uzys 자작 스킬 SSOT 외부화」 한정 — 결정 2~5 는 유효)
- Context: ADR-060 은 uzys 자작 스킬의 SSOT 를 uzysjung/uzys-agent-skills 리포로 옮기고
  카탈로그를 `npx skills add` 엔트리로 대체했다. 사용자가 이관본의 품질을 의심해
  ("너무 뭉개져 버린 것 같아") 전수 감사를 지시했고, 조건부 지시("제대로 옮겨지지 않았다면
  버리고 이 리포 스킬을 개선")를 걸었다. 감사(9쌍 전 파일 비교, 원본 = `399e225`,
  `docs/research/skills-migration-audit-2026-08-02/`)가 조건 성립을 판정했다:
  **소실 76건 + 열화 28건** — 결정 규칙 27·worked example 14·실측 전례 7·실행 스크립트 2(434줄
  wrapper: env allowlist·secret 거부·timeout 을 코드로 강제) 등, 스킬의 밥값이던 구체가 정확히
  지워졌다. 원인은 우연이 아니다 — 이관 리포 설계 문서가 "제거할 가정" 목록으로 사용자 모델
  정책(Sonnet/Opus 등급·xhigh floor)·실측 전례·고정 경로의 제거를 **명시 지시**했다. 공식 스킬
  작성 가이드의 "모델이 이미 아는 것을 빼라"를 정반대로 적용한 것이다.
- Decision:
  1. **번들 복원**: 원본 14스킬을 git 이력에서 9종으로 통합 복원한다(통합 매핑은 이슈 #262 의
     사용자 결정이라 유지 — 실행만 다시). 보존 계약 = 감사 원시 데이터의 dropped 76 + damaged 28
     전건이 복원본에 실재. 배치는 `INTERNAL_BUNDLED_SKILL_IDS`(전 9종) +
     `DEV_METHOD_SKILL_IDS`(has-dev-track 5종: clear-korean-communication·audit-service-gaps·
     multi-persona-review·recurrence-prevention·verification-loop) + any-track 2종(north-star·
     gh-issue-workflow) + opt-in 2종(external-model-consult·model-orchestration).
     `COMMON_SKILL_DIRS`·`MODIFIED_DEV_SKILL_DIRS` 는 불변 — verification-loop 은 ECC lock
     재등재 없이 본문 출처·MIT 귀속 1줄로 처리(ADR-060 결정 2 의 lock 해체는 유지).
  2. **model-orchestration 은 사용자 2026-08-02 개정판**이 본문이다(핵심구현·테스트·V&V=opus@xhigh+
     / 반복·단순구현=sonnet@high+ / 설계·기획·문서리뷰=Fable / 파일 핸드오프 절 포함).
  3. **본문 게이트 4종 부활**: subagent-file-handoff·north-star-skill·recurrence-prevention-skill·
     consult-model-tier 를 복원해 새 통합 구조에 재조준 — ADR-060 Consequences 가 명기했던
     상실을 되돌린다. 스텁과 함께 assertion red 로 태어나 복원 구현이 green 으로 만든다.
  4. **이관 리포의 구조 개선은 역수입**: references/ 분리(통합 3종은 300줄 초과라 확정),
     description 의 Do-NOT 절. 원본의 verbatim 트리거 발화는 유지.
  5. **update 안전 가드**: `syncSkills` 에 심볼릭 링크 건너뛰기 — `npx skills add` 로 이관
     리포를 받은 기설치 프로젝트의 skills 저장소를 우리 번들본으로 덮어쓰는 경로를 차단한다
     (변이 실증: 가드 제거 시 사용자 저장소 본문이 실제로 덮어써짐).
  6. **task-brief 스킬 + 넛지 훅 신설**(사용자 지시 2026-08-02, 같은 사이클 편입): 사용자
     작성 v2 템플릿(objective·inputs·invariants·success_criteria·boundaries·autonomy·
     recommended_direction·verification·communication·output_format)을 canonical 로 싣는
     스킬(inbound 정규화 + outbound 위임 프롬프트 강제, model-orchestration 위임 5요소 포섭)
     + UserPromptSubmit 결정론 넛지 훅(400자·태그 부재 검사만 — 판단은 스킬 몫). 카탈로그
     55→56. 템플릿 SSOT = `docs/research/skills-migration-audit-2026-08-02/
     task-brief-template-user-v2.md`.
- Alternatives:
  - 이관 리포를 개선(원본 콘텐츠 재주입)하고 외부 SSOT 유지 — 기각: 설계 문서 자체가 구체성
    제거를 지시하는 구조라 재발하고, 두 리포에 같은 스킬이 살아 drift 를 재생산한다(ADR-060
    이 외부화를 택했던 근거가 역방향으로 성립).
  - 14종 그대로 복원(통합 포기) — 기각: 통합은 이슈 #262 의 사용자 결정이고 감사도 통합
    구조 자체는 문제 삼지 않았다(문제는 콘텐츠 소실).
  - evals/트리거 픽스처까지 역수입 — 이월: 러너가 없는 evals 는 죽은 무게. 별도 판정.
- 적용 범위:
  - 복원 9종은 `method.kind` 전환만이라 엔트리 수 불변, **task-brief 신설(결정 6)로 카탈로그
    총계 55→56**.
  - npx 로 이관 리포를 설치한 프로젝트: update 는 링크 가드로 **건드리지 않는다**(결정 5 전제).
    - **2026-08-18 후기 (#343)**: 이 줄은 `update` 만 적었고 `install` 에는 같은 판정이 없었다.
      결과는 두 갈래였다 — 슬롯이 링크면 `cpSync` 가 `ERR_FS_CP_DIR_TO_NON_DIR` 로 죽어
      **설치 전체가 실패**했고(v26.147.0 실사용자 보고), 슬롯 안의 파일로 나가는 엔트리
      (`spec-scaling/SKILL.md`)는 죽지도 않고 **링크를 따라 남의 저장소를 덮었다**.
      결정은 그대로 두고 적용 표면만 install 로 넓힌다(건너뛰고 화면에 이름으로 보고).
  - 번들 스킬의 상주 계측 사각(계측 spec 이 internal 선택을 안 넣어 0 집계)은 **이월**(사용자
    결정 2026-08-02) — cost:baseline 은 "무변동"이 정상이며 그 사실을 실측으로 기재한다.
  - 이관 리포(uzysjung/uzys-agent-skills)의 삭제/아카이브는 사용자 직접 결정·실행.
- Consequences:
  - 스킬 개선 사이클이 이 리포 릴리즈로 복귀한다(ADR-060 의 분리 이점 소멸 — 감수).
  - model-orchestration 개정판(사용자 작성)은 verdict 어휘 계약(구 D3)을 싣지 않는다 —
    그 계약의 소유는 `verification-loop` §Verdict Contract 로 이동했고 상실이 아니다.
    개정판에 추가된 파일 핸드오프 절은 오케스트레이터 초안(사용자 위임)이며, 초안이 담았던
    릴리스 태그 3개는 배포 위생 게이트가 물어 제거했다(사실 하중은 보존).
  - 재발 방지 재료: "일반화 지시가 스킬을 죽였다"는 감사 증거가 docs/research 에 영속 —
    다음 외부화 시도는 이 보존 계약(무엇이 스킬의 밥값인가)을 통과해야 한다.
  - `INTERNAL_BUNDLED == DEV_METHOD` 등식 게이트는 의도(디렉터리 실재)에 맞는 형태
    (실재 검사 + 부분집합)로 교체된다.

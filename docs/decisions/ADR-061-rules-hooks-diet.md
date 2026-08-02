# ADR-061: 룰·훅 다이어트 — 죽은 훅 제거 · 차단 계측 도입 · 상주 룰 절 단위 감량

- Status: Accepted
- Date: 2026-08-02
- PR: #268
- Context: 사용자 지시 "룰·훅이 밥값을 하는지 공식 문서 근거로 판정 → 개발 사본·배포 템플릿
  양쪽 동일 정리, 밥값을 하더라도 최대한 간결하게"(2026-08-02). 백로그 #261-2 의 실행.
  판정 기준은 Anthropic 공식 문서 원문 인용으로 확보했다
  (`docs/research/rules-hooks-value-audit-2026-08-02/`): ⓐ 프루닝 판정 질문 "이 줄을 지우면
  Claude 가 실수하는가"(best-practices) ⓑ 모델 기지식·코드 유도 가능·aspirational 룰 배제
  ⓒ 여러 단계 절차는 스킬/paths 로(memory) ⓓ 프로즈는 강제층이 아니다 — 강제는
  permissions·훅 셋뿐(permissions) ⓔ 정적 컨텍스트는 CLAUDE.md, 훅은 동적 주입·차단용(hooks).
  실측(2026-08-02): 룰 9종×2사본 1,100줄 중 상당 부분이 모델 기지식 교본과 절차 상세 ·
  `checkpoint-snapshot.sh` 는 `templates/settings.json` `"PostToolUse": []` 로 **설치만 되고
  실행 0**(직전 ADR-060 이 spec-drift-check 를 지운 것과 동일 결함의 잔존) · 훅 차단 로그가
  없어 "무엇이 실제로 막는가"를 판정할 데이터가 없다(CLAUDE.md 미해결 #2).
- Decision:
  1. **`checkpoint-snapshot.sh` 삭제** (templates + `.claude/hooks/`, `ALWAYS_HOOKS` 4→3).
     `session-start.sh` 의 compact-warning.flag 소비 분기도 함께 제거(생산자가 사라져 사문).
     재발 방지 게이트 신설: `tests/hook-wiring-parity.test.ts` — 설치되는 훅 전부가
     settings 에 배선돼 있어야 한다(양방향 derive, born-red 로 태어나 구현이 green 으로).
  2. **차단 계측 도입**: `protect-files.sh`·`mcp-pre-exec.sh`(양 사본)·`docker-only-realcli.sh`
     (dev)가 차단 시 `.uzys-agent-harness/hook-blocks.log` 에 1줄 남긴다. 차단 계약
     (exit 2 + stderr) 불변, 로그 실패는 차단 판정에 영향 없음. 설치 사용자 리포 오염 방지로
     `src/env-files.ts` gitignore 패턴에 `.uzys-agent-harness/` 추가. 이로써 다음 감사부터
     "훅이 밥값을 하는가"를 로그 데이터로 판정한다.
  3. **`gates-taxonomy.md` 삭제** (양 사본 + `COMMON_RULES` + cherrypicks.lock
     `gsd-gates-taxonomy` 행 + `plan-checker.md` 참조 2곳×2사본) — 프로젝트 고유 사실이 0인
     일반 분류표로, 판정 기준 ⓑ 정면 해당. 룰 9종→8종.
  4. **잔여 룰 8종×2 절 단위 감량** — 총 1,100줄 → ≤595줄(사본별 예산표는 계획 문서가 SSOT).
     남긴 것 = 이 리포/배포판에서 실제 사고가 났던 함정 · 고유 규약 · 게이트 사용설명서 ·
     계약 스키마. 지운 것 = 모델 기지식 교본(TDD 절차·AAA·bash 일반론 등) · 절차 상세(요점만) ·
     전례 서사 풀텍스트(dev 사본은 ADR 포인터로 대체, **templates 에는 ADR 번호 기입 금지** —
     distribution-hygiene 게이트·SPEC DO NOT CHANGE). 내용 계약 게이트들은 앵커를 새 본문에
     맞춰 갱신하되 검사를 잃지 않는다(각 갱신 건 변이 red 확인).
  5. **판정을 데이터화하는 원칙**: 상주 지시문의 존폐는 앞으로 ⓐ 공식 기준 ⓑ 차단 로그
     ⓒ cost:report 토큰 실측 세 근거로 재감사한다 — "느낌 대 느낌" 판정 금지.
- Alternatives:
  - checkpoint-snapshot 을 배선해 살리기 — 기각: 기능이 `strategic-compact` 의
    `suggest-compact.sh`(이미 배선됨)와 중복이고, Opus 5 의 1M 컨텍스트·자동 컴팩션 환경에서
    tool-count 임계 프록시의 근거가 약하다.
  - gates-taxonomy 를 `paths:` 지연 로드로 강등 — 기각: 어느 파일과도 결합하지 않는 일반론이라
    paths 술어가 없다. 내용 자체가 모델 기지식.
  - 차단 로그를 stderr 로만 — 기각: stderr 는 세션과 함께 사라져 "무엇이 막혔나"를 누적
    측정할 수 없다. 파일 로그만이 다음 감사의 데이터가 된다.
  - 룰 파일 통삭제(8종 추가) — 기각: 사고 이력 함정·게이트 사용설명서는 공식 기준의
    "담을 것"(gotchas·repo etiquette)에 정확히 해당한다. 문제는 파일이 아니라 절이다.
- 적용 범위 (기존 설치본의 update 경로 — 두 갈래):
  - **`policyFiles` 기준선 보유 설치본**(v26.132.0/ADR-047 이후 설치·갱신): `update` 의
    `pruneOrphans`(src/update-mode.ts)가 templates 에서 사라진 `hooks/checkpoint-snapshot.sh`·
    `rules/gates-taxonomy.md` 를 **회수한다**. 사용자 편집분은 백업 후 삭제
    (tests/update-mode.test.ts 의 보존/prune 두 갈래가 게이트).
  - **레거시 로그·로그 부재 설치본**: 잔존한다(기록 없으면 지우지 않는 계약). 잔존해도
    checkpoint-snapshot 은 미배선, gates-taxonomy 는 참조 0 이라 무해.
  - BREAKING 아님 — CLI 플래그·공개 계약 변화 없음. 카탈로그 수 불변(룰·훅은 카탈로그 밖).
- Consequences:
  - 상주 룰이 8종×2·총 ≤595줄로 줄어 설치 프로젝트 컨텍스트 비용 감소(토큰 실측은
    cost:baseline 재생성으로 확정, PR 보고에 before→after 기재).
  - 차단 이력이 처음으로 데이터가 된다. 단 `uninstall` 은 `.uzys-agent-harness/` 를 통째로
    지우므로 **차단 로그도 함께 소멸**한다 — 감수(로그는 감사 보조 데이터이지 보존 계약이 아님).
    `--only` 부분 uninstall 은 설치 로그를 다시 쓰며 디렉터리를 남기므로 차단 로그가 살아남는다.
  - 내용 계약 게이트 앵커 갱신 목록은 PR diff 가 SSOT (doc-governance-baseline-rule ·
    benchmark-parity-rule · session-cleanup-gate · evidence-templates · protect-branch-surface 등).
  - docker `scenario-project.sh` 의 훅 열거가 derive 로 바뀌며, 직전 사이클이 남긴
    죽은 단언(spec-drift-check 잔존 검사로 이미 FAIL 상태)이 함께 청산된다.

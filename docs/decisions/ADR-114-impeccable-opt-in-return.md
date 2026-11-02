# ADR-114: Impeccable 을 선택 항목으로 되돌린다 — 기본은 frontend-design

- Status: Accepted
- Date: 2026-11-03
- PR: #940
- Supersedes: ADR-060 결정 3 중 impeccable 제거 한 항목(부분). ADR-060 의 나머지는 유효하다.
- Context: #927 에서 사용자가 "Impeccable 을 넣고 taste 는 옵션 정도"를 제안했다. Impeccable 은
  ADR-035(2026-07-18)에서 기본 → opt-in 으로 내려갔고 ADR-060(2026-08-02)에서 카탈로그에서 빠졌다.
  그 사이 Impeccable 은 마크다운 스킬에서 네이티브 엔진을 쓰는 도구로 바뀌었다(v4.8.0 ·
  engine-v0.1.18, 근거 = `docs/research/design-skills-2026-11.md`, 확인일 2026-11-02):
  ⓐ 첫 실행에 GitHub Releases 에서 17~22MB 엔진을 `~/.impeccable/bin/` 에 받는다
  ⓑ 텔레메트리가 기본으로 켜져 있고, 꺼도 새 디자인을 시작할 때 impeccable.style 로 방향 요청이
  나간다(프로젝트 이름·코드·브리프는 실리지 않는다 — 벤더 정책과 소스 판독)
  ⓒ CLI 에 이미지 도구가 없고 `OPENAI_API_KEY` 가 있으면 기존 화면 스크린샷을 OpenAI 로 올리는 경로가 있다
  ⓓ 프로젝트에 `.impeccable/` · `PRODUCT.md` · `DESIGN.md` 를 만든다
  ⓔ 자체 설치기(`npx impeccable install`)는 편집마다 도는 훅을 기본으로 깔고 함께 쓰는 설정 파일
  (`.claude/settings.local.json` · `.gemini/settings.json` 등)을 고친다.
  어느 디자인 스킬이 UI 를 더 잘 만드는지 비교한 공개 평가는 확인되지 않았다.
- Decision: (사용자 결정 2026-11-03, #927 선택지 A)
  1. 기본(UI 트랙 미리 체크)은 frontend-design 그대로 둔다 — 스크립트·훅·외부 호출이 없는 텍스트다.
  2. impeccable 을 opt-in 으로 카탈로그에 되돌린다. 설치는 다른 외부 스킬과 같은
     `npx skills add pbakaus/impeccable --skill impeccable --agent … --copy` 이다. 컨테이너 실측
     (2026-11-03, skills@1.5.11, 네 CLI): `.claude/skills/impeccable` 과 `.agents/skills/impeccable` 만
     생기고 settings·hooks 파일은 0 이다. 자체 설치기는 쓰지 않는다.
  3. 카탈로그 설명에 ⓐ·ⓑ·ⓒ 를 적어, 고르는 사람이 외부로 나가는 것을 알고 고르게 한다.
  4. taste-skill · jakubkrehel-skills 는 지금처럼 opt-in 이다.
- Alternatives:
  - **Impeccable 을 기본으로 둔다**: 기각 — UI 트랙을 고른 모든 설치자에게 엔진 다운로드와 끌 수 없는
    외부 요청이 생기는데, 더 잘 만든다는 비교 근거가 없다.
  - **자체 설치기로 훅까지 깐다**: 기각 — 하네스 설치 기록 밖에서 함께 쓰는 설정 파일을 바꾼다
    (설치자 디스크 원칙, CLAUDE.md §설치자 디스크).
  - **계속 빼 둔다**: 기각 — 사용자가 선택지로 원하고, opt-in 은 고르지 않은 설치자에게 영향이 없다.
- Consequences:
  - 고른 설치자는 훅 없는 공유 빌드를 받는다. 편집마다 자동 검사는 돌지 않고, 스킬이 세션마다
    `scripts/impeccable context` 를 실행하라고 지시하므로 그때 엔진 다운로드가 일어날 수 있다.
  - Impeccable 이 만든 `.impeccable/` · `PRODUCT.md` · `DESIGN.md` 는 설치 기록 밖의 사용 산출물이라
    uninstall 이 치우지 않는다.
  - 옛 판(ADR-060 이전)에 같은 id·같은 설치 방식으로 기록된 설치본은 update 가 현행 자산으로 다시 본다.
  - 남은 질문: 네 스킬을 같은 과제로 비교한 품질·비용, Impeccable 이 기존 디자인 시스템을 보존하는지
    (FAQ 주장은 검증에서 반박됨) — 근거 문서 §미해결 질문.

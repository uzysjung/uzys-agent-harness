# ADR-063: 기본 설치 축소 — 배포·PM·재무 자산 5종 opt-in 전환

- Status: Accepted
- Date: 2026-08-02
- PR: #270
- Context: 사용자 지시(2026-08-02) — "railway-skills supabase-cli vercel-cli opt-in /
  finance-skills product-skills opt-in". ADR-058 방향(필요한 틀만 남긴다)의 카탈로그 축 적용이며,
  ADR-035(배포 CLI 중복 해소 — netlify opt-in)와 같은 결의 후속이다. 5종의 현행 조건:
  railway-skills(dev 5트랙) · vercel-cli·supabase-cli(csr-supabase·full) ·
  finance-skills(executive·full) · product-skills(project-management).
- Decision: 5종의 `condition` 을 `{ kind: "opt-in" }` 으로 전환한다. 카탈로그에서 제거하지
  않는다 — wizard 토글과 `--with <id>` 도달 경로는 유지되고, 트랙 매칭만으로는 더 이상
  기본 추천되지 않는다.
- Alternatives:
  - 카탈로그 삭제 — 기각: 도달 경로가 사라져 되돌리기 비싸고, 사용자 지시는 "기본에서 빼라"이지
    "없애라"가 아니다.
  - 트랙 축소(더 좁은 트랙 조건 유지) — 기각: 남길 트랙을 고를 근거 데이터가 없다. opt-in 은
    필요한 사용자가 자기 판단으로 켜는 형태라 근거 부담이 없다.
- 적용 범위: 신규 설치의 기본 추천만 바뀐다. 기존 설치본에서 회수하지 않는다 — 5종은 전부
  plugin/npm 외부 자산이라 `update` 의 templates 파일 회수(pruneOrphans) 대상 밖이고, 이미
  설치된 plugin/npm 은 사용자 소유물이다. BREAKING 아님 — CLI 플래그·공개 계약 불변, 카탈로그
  총수 56 불변.
- Consequences:
  - 해당 트랙 신규 설치의 기본 자산 수가 줄어든다(수치 동기화는 PR diff 가 SSOT).
  - csr-supabase 트랙은 배포·DB CLI 가 기본에서 빠진다 — 필요 시 wizard 에서 체크하거나
    `--with vercel-cli --with supabase-cli`.
  - project-management 트랙은 기본 플러그인 자산이 없어질 수 있다 — 트랙 자체는 유지(룰·문서
    스캐폴드가 남는다).
  - 비대화형 OPT-IN 힌트 표면(`install-render.ts` 의 experimental 후보 안내)이 실데이터 대상
    0이 된다 — 트랙 조건부 experimental 자산이 railway-skills 하나였는데 opt-in 이 되면서
    11트랙 전부 후보가 비기 때문. 힌트를 "opt-in 자산 발견" 안내로 재정의할지 제거할지는
    별도 결정으로 이월(독립 리뷰 MEDIUM-1/2). 전제가 깨지면(트랙 조건부 T3 재등장) 테스트가
    red 로 복원을 강제한다.

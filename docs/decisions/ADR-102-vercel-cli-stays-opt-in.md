# ADR-102: vercel-cli 는 어느 트랙에서도 opt-in — ADR-101 결정 2 철회

- Status: Accepted
- Date: 2026-10-06
- PR: #716
- Issue: #715
- Supersedes: ADR-101 의 결정 2(`vercel-cli` 를 `ssr-nextjs` 에서 미리 체크)만. ADR-101 의 나머지(frontend-design 조건 · railway-mcp-server
  선택 경로 · 렌더 규칙 · 명시한 빼기 · 위저드 체크)는 그대로다. ADR-063 의 `vercel-cli` opt-in 이 다시 현행이다.

## Context

ADR-101(#709)은 "Next.js 에 Vercel 기본"을 `vercel-cli` 미리 체크로 구현했다. 릴리즈 전 메인테이너 재검토(2026-10-06)에서 그것이
이 하네스의 첫 질문 — AI 코딩 도구로 더 잘 개발하게 돕는가 — 에 약하다고 판정했다.

- 설치는 `npm install --save-dev vercel@<pin>` 이라 설치자의 `package.json` · lock 에 무거운 의존성을 더한다. 에이전트는 설치 없이
  `npx vercel` 로 쓸 수 있다.
- 배포 · 로그 · 환경 변수 모두 사람이 `vercel login` 을 해야 동작한다 — 설치만으로는 에이전트가 쓸 것이 없다.
- 핀(54.17.3, 2026-06-25)이 최신(62.x)보다 많이 뒤처졌다(#714).
- ADR-063(2026-08-02)이 opt-in 으로 둔 이유가 그대로 남아 있다.

## Decision

`vercel-cli` 의 조건을 `{ kind: "opt-in" }` 으로 되돌린다. "Next.js 의 Vercel 기본"은 에이전트가 실제로 쓰는 Vercel 공식 MCP 가
이 저장소의 `.mcp.json` 조립으로 표현될 수 있게 되면(#711) 그것으로 채운다.

## Alternatives (기각)

- ADR-101 그대로 두고 핀만 갱신(#714) — 사용자 파일 변경 · login 의존이라는 본 문제는 남는다.
- `full` 에도 추가 — 같은 프로젝트를 Vercel 과 Railway 에 함께 배포할 일이 드물고 배포 CLI 중복 해소(ADR-035)에 어긋난다.

## Consequences

- `ssr-nextjs` 새 설치는 `vercel-cli` 를 미리 체크하지 않는다. 위저드 3단계 · `--with vercel-cli` 로는 고를 수 있다.
- #711 이 해결되기 전까지 `ssr-nextjs` 에는 Vercel 관련 기본 항목이 없다(`react-best-practices` 는 vercel-labs 스킬로 그대로다).
- ADR-101 은 미게시 상태에서 철회됐으므로 이 결정으로 바뀌는 기존 설치본은 없다.

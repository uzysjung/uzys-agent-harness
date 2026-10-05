# ADR-101: 트랙 기본값은 스택이 정한다 — data·tooling 의 frontend-design 해제 · ssr-nextjs 의 Vercel 기본 · MCP 서버의 선택 경로

- Status: Proposed
- Date: 2026-10-05
- PR: TBD
- Issue: #709
- Amends: ADR-063 의 `vercel-cli` 한 줄(opt-in → `ssr-nextjs` 미리 체크). ADR-063 의 나머지(railway-skills · supabase-cli ·
  finance-skills · product-skills opt-in)와 ADR-035(netlify opt-in)는 그대로다.
- 설계 문서: `docs/plans/track-defaults-709-design.md` (설계 검증 반영 절 포함)

## Context

메인테이너 결정(#709): ① `data` · `tooling` 은 `frontend-design` 을 미리 체크하지 않는다 ② `ssr-nextjs` 는 Vercel 이 미리 체크되고
Railway 는 선택(미리 체크 안 함 · 고를 수는 있음) ③ `full` · `csr-*` · `ssr-htmx` 의 기본값은 바꾸지 않는다.

②의 걸림돌은 전제 하나였다 — "`.mcp.json` 조립은 트랙 조건만 읽어 opt-in 경로가 없다"(ADR-063 시점 · flowbite 기각 근거).
Railway MCP 는 트랙 표(`templates/track-mcp-map.tsv`)의 한 행이고, 위저드 3단계 · `--with` 는 카탈로그 id 만 고른다. 키 id
`--with mcp:<name>` 은 기록된 빼기를 푸는 일만 한다(ADR-099 R4). 그래서 트랙 패턴에서 `ssr-nextjs` 를 빼면 고를 길이 없었다.

또 기존 설치를 조용히 바꾸지 않아야 한다(ADR-099). 렌더에 없는 기록된 `.mcp.json` 키는 `planUpsert` 가 지운다 — 트랙 표만 고치면
옛 `ssr-nextjs` 설치본의 railway 서버가 다음 `update` 에서 사라진다.

## Decision

1. `frontend-design` 의 조건 = UI 가 있는 트랙(`csr-*` · `ssr-*` · `full` — `hasUiTrack` 에서 유도한 `UI_TRACKS`). #456 결정 B
   ("스택 없는 dev 트랙은 스택 무관 개발 도구를 기본에서 뺀다")를 "UI 가 없는 스택 트랙도 뺀다"로 좁힌 것이다.
2. `vercel-cli` 의 조건 = `any-track: ["ssr-nextjs"]`. `full` 에는 넣지 않는다(③). Vercel MCP 자체는 넣지 않는다 — 원격(HTTP) +
   OAuth 서버라 이 저장소의 stdio 전용 `.mcp.json` 조립으로는 표현되지 않는다. 설치자는 `vercel mcp` 로 공식 경로를 붙인다.
3. **MCP 서버의 선택 경로**: 카탈로그 `internal` 자산의 `key` 가 트랙 표 행 이름이면 그 서버는 어느 트랙에서든 고를 수 있다.
   첫 항목 = `railway-mcp-server`(experimental — 상류 repo archived · 190★, 월간 trust-tier-drift 가 감시). 트랙 표 railway 행의
   패턴에서 `ssr-nextjs` 를 뺀다.
4. 하네스 MCP 렌더 = **트랙 기본 행 ∪ 선택된 행**. 선택된 행 = ⓐ 자산 id · 키 id 어느 꼴로도 빼지 않았고 ⓑ 이번 실행이 골랐거나
   (위저드 체크 · `--with`) **기록**이 그 서버를 `.mcp.json` 몫으로 적은 것. 디스크 존재는 근거가 아니다(ADR-096). 한 실행에
   한 번 렌더해 `.mcp.json` · Codex · OpenCode 가 같은 값을 받는다(#568 확장) — 트랙만 보는 렌더 경로는 남기지 않는다.
5. 자산 id 로 뺀 선택 서버는 `.mcp.json` 어댑터에 키 빼기로도 넘긴다(화면이 "dropped" 로 말하고 기본 행 트랙에서도 걷는다).
   기록에는 자산 id 만 싣는다.

## Alternatives (기각)

- ⓐ 키 id `--with mcp:<name>` 에 "추가" 의미 부여 — 위저드가 키 id 를 내지 않아(설계 G2) 표면이 갈린다.
- ⓑ 트랙 표에 "선택" 열 신설 + 위저드 새 타깃 종류 — 카탈로그가 이미 하는 일(위저드 · `--with` · 기록 · 화면 · COMPATIBILITY)을 두 벌로.
- ⓒ 카탈로그를 railway 의 단일 원천으로(트랙 표 행 삭제 · 조건 `any-track` 5트랙) — tier 규칙(≥1000★)상 experimental 이라 미리
  체크가 불가능해 다른 5 트랙의 기본값이 바뀐다(③ 위반).
- ⓓ Vercel MCP 를 지금 넣기 — 원격 HTTP + OAuth 형식 · 렌더러 3곳 · 첫 사용 인증 안내가 함께 바뀌어야 한다(후속 이슈).

## Consequences

- `ssr-nextjs` 새 설치는 `npm install --save-dev vercel@<pin>` 을 돈다(네트워크 · `package.json` 변경 — npm 자산의 기존 성질).
  `update` 는 새 추천을 깔지 않는다(자산 재설치 없음) · 플래그 없는 `install` 재실행은 새 추천이라 깐다.
- 옛 `ssr-nextjs` 설치본의 railway 서버는 몫 기록이 있으면 update · 재설치 · CLI 추가 뒤에도 남는다. 몫 기록이 없는 옛 기록
  (v26.161 이하)에서는 설치자 것으로 분류돼 그대로 남는다(관리 밖). 위저드 update 3단계는 기록된 몫을 체크된 채 보이고, 풀면
  `--without railway-mcp-server` 를 낸다.
- `data` · `tooling` 설치본의 `frontend-design` 은 `log.assets` 기록으로 update 가 계속 갱신한다.
- `csr-*` · `ssr-htmx` · `full` 의 3단계에 railway 항목이 미체크(⚠)로 보이지만 트랙 표가 깐다 — 설명 문구가 그 사실을 말한다.
  MCP 서버 전부의 카탈로그화(후속)가 이 어긋남을 없앤다.
- 카탈로그 총계 51 → 52.

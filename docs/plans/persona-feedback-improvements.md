# 페르소나 평가 피드백 → 개선 계획 (게시 게이트)

> 작성 2026-06-13 · 기준 v26.83.0 (rename 직후) · 사용자 지시: "객관 평가 → 개선 → 그에 맞춰 홍보글"
> 평가 방법: 독립 페르소나 에이전트 4인 병렬 — 호의 금지·비판 우선 프레이밍. 본 문서가 평가 결과의 SSOT (세션 컴팩션 대비 영속화).
> **C-2 게시(HN/Reddit/awesome-list)는 P0 완료 전 금지** — 알렉스 평결 "홍보문이 검증 인프라를 배신하는 과장 2곳 포함, 재작성 전 게시 금지".

## 평가 평결 요약

| 페르소나 | 유형 | 평결 |
|----------|------|------|
| 민준 | 12y 시니어, Claude Code 헤비유저, dotfiles 신봉 | **안 깐다** — 기존 `.claude/` 충돌 정책 부재 + vetting=star 수. 단 "미검증을 미검증이라 쓰는 문서 처음 봤다", COMPATIBILITY 매트릭스는 북마크 |
| 소피 | 2y 주니어 바이브코더, 인내심 5분 | 반만 깐다 — 설치까진 함, 30초 내 첫 승리 없으면 uninstall. "메뉴판이 논문" |
| 라케시 | 플랫폼 팀 리드, supply-chain 민감 | 조건부 거절 — "큐레이션이 unpinned HEAD 의 신뢰받는 유통 채널". 조건 충족 시 파일럿 |
| 알렉스 | awesome-list 메인테이너 + HN 고인물 | 인프라는 진짜·홍보문은 과장 — 수정 전 게시 금지. awesome-list 는 star 두 자리 후 |

## P0 — 게시 전 필수

### A. 홍보글 전면 재작성 (알렉스 처방)
- [ ] A-1 Show HN 제목 교체: 약어 5연발·"vetted" 자기인증 제거 → **Snyk 36% 훅** 사용. 처방 예: `Show HN: 36% of AI-coding "skills" carry prompt injection, so I Docker-verify and version-pin them before they touch your repo`
- [ ] A-2 본문 1문단 = 1인칭 동기 (실패담 구체적으로: "8개 워크플로 비교에 주말을 태웠고, 설치해보니 X는 깨졌다")
- [ ] A-3 보안 증거를 본문 중앙으로: pinning + **"plugin/skill 은 pin 불가, 이렇게 보완" 한계 표기 자체를 신뢰 무기로** 팔기
- [ ] A-4 과장 2곳 정정 (no-false-ship): "every install method Docker-verified" → "워크플로 핵심군 Docker 실설치 + 나머지 registry 확인 (40/43)" / "across 4 CLIs" → "Claude Code first-class, Codex/OpenCode/Antigravity 는 skills+rules 수준" 비대칭 명시
- [ ] A-5 r/ClaudeCode: WORKFLOWS 8종 비교표를 **글 본문에 직접** (링크 유도형=광고 신고) + GIF
- 차별점 한 문장 (알렉스 합격작, 재사용): **"AI 코딩 skill 의 36%에서 prompt injection 이 발견되는 시대에, 워크플로 8종을 버전 고정 + Docker 실설치로 검증해 4개 CLI 에 한 명령으로 까는 큐레이터."**

### B. README 수술 (민준+소피+알렉스 수렴)
- [ ] B-1 첫 줄 교체 — "Track-based agent harness"(내부용어) → 차별점 한 문장. H1 아래 배치
- [ ] B-2 **기존 `.claude/`/CLAUDE.md/settings.json 보유 프로젝트와의 merge/충돌/백업 정책 표** (민준의 1순위 차단 요인 — 헤비유저 전환 게이트)
- [ ] B-3 "설치하면 내 repo 에 정확히 어떤 파일이 생기나" 트리 블록 (wizard 6단계 나열보다 전환 효과 큼)
- [ ] B-4 60초 퀵스타트: `--track ssr-nextjs` 식 스택명→트랙 매핑 한 줄 + 설치 직후 무조건 동작하는 첫 명령 1개 + before/after (소피의 first-win)
- [ ] B-5 검증 영수증 상단 배치: catalog-verify·trust-tier-drift CI 배지 + "vetted ≠ 보안 감사, ★기준+Docker 설치검증" 명시 (0★ 큐레이터 아이러니 선제 자수)

### C. 데이터 신뢰 (민준)
- [ ] C-1 WORKFLOWS.md star 수치 실측 재검증·정정 + 측정일 병기 (Superpowers 213k★/ECC 199k★ 의심 — star-drift CI 자랑하는 제품의 간판 숫자)
- [ ] C-2 NORTH_STAR NSM "Asset Security Pass Rate (agentshield 자산 스캔)" ↔ COMPATIBILITY "agentshield 는 산출물만 스캔" **문서 모순 해소** (라케시 지적 — 주장 철회 또는 범위 명시)

### D. 소형 코드 fix
- [ ] D-1 `external-installer.ts` `buildSkillArgs` — `npx skills` CLI 버전 고정 (자체 주석이 1.5.5→1.5.7 파손 전례 기록하면서 unpinned — 라케시)

## P1 — 게시 직후 단기

- [ ] E-1 skill/plugin 설치 시 resolved commit-SHA 를 `.harness-install.json` 에 기록 (재현성·포렌식 — 라케시 도입조건 1)
- [ ] E-2 WORKFLOWS/COMPATIBILITY 영어판 (영어 README → 한국어 문서 동선 단절 — 민준+소피)
- [ ] E-3 USAGE 내부 코드 정리: ADR-번호/D25/D35/HITO/NSM → docs/decisions 링크로 격리, 약어 첫 등장 풀네임 (소피)
- [ ] E-4 wizard Step 3 상단 "추천 그대로 Enter 눌러도 안전" 안내 + WORKFLOWS 첫 줄 기본 추천 1개 (소피)
- [ ] E-5 awesome-list 엔트리 1줄 축약 + "not a static table" 경쟁 저격 제거 (알렉스)

## P2 — 백로그 (도입조건의 나머지)

- 자산 콘텐츠 스캔 (prompt-injection 최소 1회 + 갱신 시) — 없으면 "security" 주장 톤 다운 유지
- skill `ref`(commit) 필드 — HEAD 설치 차단 (카탈로그 스키마 변경)
- global-scope uninstall 을 advisory 텍스트 → 실행 스크립트로
- 보안 bump 주기: 분기 audit → advisory 채널 검토

## 게시 실행 계획 (P0 완료 후, 사용자 결정 반영)

1. 데모 재녹화 (`agent-harness` 신명, v26.83.0+) → README GIF 교체 — 파일명 `docs/assets/agent-harness-demo.gif` (이미 rename 됨)
2. **반자동 게시** (사용자 선택 2026-06-13): 폼 채움(에이전트, agent-browser/playwright) → 제출 클릭(사용자). 댓글: 모니터링+초안(에이전트) → 승인 후 게시. **전자동 금지** — HN 봇 정책·발각 리스크
3. 순서: Show HN + r/ClaudeCode (신규 환영 채널, star 확보) → 며칠 후 bradAGI README PR + hesreallyhim issue form (kit `docs/research/adoption-c2-submission-kit.md` §2 — 단 E-5 반영해 1줄 축약)
4. repo description/topics 는 정렬 완료 상태 (재확인만)

# #980 마케팅 · 콘텐츠 스킬 — 무엇을 실을 것인가 (계획)

- 작성: 2026-11-16 · 기획 레인(읽기 전용 조사, 구현 없음) · 기준 판: v26.185.0
- 대상 이슈: #980 "마케팅, 컨텐츠 스킬 추가하기"
- 상태: **제안** — 메인테이너 결정 대기(§5.2). 이 문서는 판정 근거를 싣는 계획이고 SPEC · ADR 을 바꾸지 않는다.

## 0. 한눈에

**설치자에게 달라지는 것(추천안 기준)**: 영상 · 콘텐츠 · 마케팅 일을 하려는 설치자가 "어느 트랙에 무엇을 `--with` 로 고르면 되는지, 내 CLI 에는 무엇이 안 오는지, 따로 깔아야 할 것이 무엇인지"를 문서 한 표에서 찾는다. 그리고 지금 위저드가 보여 주는 **틀린 라이선스 문구 하나**(Remotion)가 고쳐진다. 새 트랙 · 새 번들 스킬 · 새 외부 자산은 이번에 싣지 않는다.

| | |
|---|---|
| **맥락** | 이슈가 지목한 설치 가능한 후보 6개 중 **4개(HyperFrames · GSAP skills · Remotion · marketingskills)는 이미 카탈로그에 opt-in 으로 있다.** `growth-marketing` 트랙도 이미 있다. 없는 것은 raea · claude-ads 둘이고, 나머지 링크는 목록 · 쇼케이스 · 디렉터리라 설치할 대상이 아니다 |
| **문제점** | ① 있는 것을 찾을 길이 없다 — 영상 자산은 "Visual & Media" 에, 마케팅은 "Business" 에 흩어져 있고 `growth-marketing` 트랙은 아무것도 미리 고르지 않는다 ② 위저드가 Remotion 을 "BUSL" 이라 적는데 상류 라이선스는 그것이 아니다(§1.3) ③ 4개 중 3개가 Claude Code 전용 배달이라 다른 CLI 설치자는 못 받는다 ④ 없는 둘(raea · claude-ads)은 지금 실으면 약속을 못 지킬 구체적 사유가 있다(§1.2) |
| **해결방안** | A 아무것도 안 함 · **B 문서로 길을 내고 틀린 사실을 고친다** · C 트랙이 기존 자산을 미리 체크 · D 새 외부 자산 등재 · E 새 트랙 · F 자체 번들 스킬 (§2) |
| **추천방안** | **B 를 첫 증분으로.** 이유: 설치자가 실제로 얻는 것(이미 깔 수 있는 자산)을 바꾸지 않고도 "못 찾음 · 틀린 고지"라는 확인된 결함 둘을 없애고, C~F 는 각각 관측 없는 수요에 설치자 비용(스킬 목록 예산 · 홈 디렉터리 쓰기 · 미완성 상류)을 먼저 지운다. C · D(claude-ads) · 비-Claude 도달은 메인테이너 결정으로 분리한다(§5.2) |

## 1. 확인한 사실

별 수 · 라이선스 · 최근 push 는 전부 `gh api repos/<owner>/<repo>` 실측(2026-11-16). 추정은 "추정"이라 적었다.

### 1.1 하네스의 현재 상태

| # | 사실 | 위치 |
|---|---|---|
| H1 | `growth-marketing` 트랙이 있다. 위저드 라벨 = "Growth / Marketing / Content" | `src/types.ts:19` · `src/prompts.ts:136` |
| H2 | 그 트랙은 사업 트랙이다 — 공통 룰과 전 트랙 스킬만 받고 개발 룰 · `implementer` · 방법론 스킬은 안 받는다. 트랙 전용 룰 0 | `src/external-assets.ts:163`(`EXECUTIVE_STYLE_TRACKS`) · `src/manifest.ts:140` · `docs/TRACKS.md` "What every track gets" 표 |
| H3 | 그 트랙이 미리 체크하는 외부 자산은 0이다. `project-management` 와 받는 것이 같다 | `docs/TRACKS.md:114` · `README.md:169` · `tests/installer-11-track.test.ts:51-52` |
| H4 | `marketingskills`(coreyhaines31) 가 opt-in 으로 있다. 배달 = Claude Code 플러그인 | `src/external-assets.ts:1091` · `docs/COMPATIBILITY.md:145` |
| H5 | "Visual & Media" 카테고리에 영상 · 모션 자산이 opt-in 으로 있다: `remotion`(skill, 4-CLI) · `hyperframes`(plugin, Claude 전용, tier official) · `gsap-skills`(plugin, Claude 전용) · 슬라이드 3종 | `src/external-assets.ts:870-950` · `src/categories.ts:32` · `docs/COMPATIBILITY.md:179-184` |
| H6 | `claude-video`(영상 URL → 프레임 + 전사, plugin, Claude 전용)가 "Understanding" 에 opt-in 으로 있다 | `src/external-assets.ts:839` · `docs/COMPATIBILITY.md:172` |
| H7 | 배달 방식이 도달 CLI 를 정한다 — `plugin` 은 구조적으로 Claude 전용, `skill` 은 `npx skills add --agent … --copy` 로 네 CLI. 닿지 않는 조합은 위저드가 "outside reach — not installed" 로 말한다 | `src/external-assets.ts:1395-1412` · `src/interactive.ts:283` |
| H8 | opt-in 자산은 어느 트랙에서든 위저드 3단계 체크 또는 `--with <id>` 로 깐다 | `src/external-assets.ts:95-99`(`opt-in` 조건) · `src/commands/install.ts:584` |
| H9 | 트랙 기본값을 opt-in 으로 내리는 것이 최근 결정의 방향이다(재무 · PM · 배포 자산). "기본 설치 항목 재정의"는 SPEC Non-Goals 이고 그 경계를 넘은 변경은 Major CR 로 기록돼 왔다 | ADR-063 · `docs/SPEC.md:44` · `docs/SPEC.md:71-73` |
| H10 | `hyperframes` 를 skill 방식(4-CLI)으로 까는 안은 이미 기각됐다 — 상류 CLI 가 실행 중에 같은 스킬 폴더를 다시 쓰고 지워 설치 기록과 어긋난다 | ADR-104 Alternatives |
| H11 | 독립 영상 트랙 신설은 2026-06 리서치가 "검증 자산 부족 · 트랙 근거 약함"으로 기각했고 카테고리로 정리됐다. Motion Canvas 는 그때도 "비활성 + 전용 스킬 부재"로 제외 | `docs/research/video-stack-research.md` §카테고리 구조 제안 · §제외 표 |
| H12 | 외부 자산 판정 축(#726 확정): ① 설치자가 AI 코딩 도구로 개발(및 그 트랙의 일)을 더 잘하게 하는가 ② 지시문을 넘는 스크립트 · 도구 · 도메인 고유 지식을 주는가 ③ 상류가 살아 있고 더 공신력 있는 대안이 없는가. 이 축으로 `marketingskills` · `gsap-skills` · `remotion` · `claude-video` 는 2026-10-11 에 "유지" 판정 | `docs/research/mcp-skills-freshness-2026-10-11/726-external-skills.md:4,26` |
| H13 | 같은 id 의 배달 방식을 바꿀 때, 옛 기록(plugin)을 가르는 코드 경로는 없다. `update` 의 외부 스킬 갱신은 "기록이 skill 이고 카탈로그도 skill"인 것만 다룬다 | `src/external-installer.ts:657-660` · `grep 'method === "plugin"' src` → `trust-tier-drift.ts:85` 한 곳(같은 꼴의 `"skill"` 은 `external-installer.ts:657` 에서 잡힌다) |

### 1.2 후보별 — 무엇을 싣고, 무엇이 필요한가

| 후보(이슈) | 실체 | 라이선스 | ★ · 최근 push | 설치 · 실행에 필요한 것 | 카탈로그 |
|---|---|---|---|---|---|
| `heygen-com/hyperframes` | HTML 로 영상을 쓰고 MP4 로 렌더하는 프레임워크 + 스킬 9종 + 플러그인 | Apache-2.0 | 84,761 · 2026-11-16 | Node 22+ · FFmpeg. 로컬 렌더는 무료, HeyGen 유료 모델은 선택(README) | **있음**(`hyperframes`, Claude 전용) |
| `greensock/gsap-skills` | GSAP 본가의 스킬 8종(지시문) | MIT | 18,506 · 2026-07-29 | 없음(지식 스킬). 상류 README 의 권장 설치는 `npx skills add`(Antigravity 포함) | **있음**(`gsap-skills`, Claude 전용 플러그인으로 배선) |
| remotion.dev → `remotion-dev/skills` | Remotion 공식 스킬 13종 | 스킬 리포 라이선스 없음 · **코어는 "Remotion License"** — 개인 · 3인 이하 영리 조직 · 비영리 무료, 그 밖은 Company License(`remotion-dev/remotion` `LICENSE.md`. 본문에 "BUSL" · "Business Source" 0회) | 7,275 · 2026-11-11 (코어 73,449) | 렌더러 · Node 환경은 별도 설치 | **있음**(`remotion`, 4-CLI) |
| `coreyhaines31/marketingskills` | 마케팅 스킬 **53종**(지시문 + references + evals). `ads` · `ad-creative` · `video` · `social` 포함 | MIT | 60,593 · 2026-11-11 | 없음. 상류 권장 설치 1순위는 `npx skills add`, 2순위 Claude 플러그인 | **있음**(`marketingskills`, Claude 전용 플러그인) |
| `shinyobjectz/raea` | Rust + Bevy 렌더 엔진 + 데스크톱 앱(제품). 스킬은 별도 리포 `raea-skills`(★19, 2026-11-08 생성) | **FSL-1.1-ALv2**(경쟁 용도 금지, 2년 뒤 Apache-2.0 전환) | 2,574 · 2026-11-16 · **리포 생성 2026-10-18**, 최신 v0.1.5(2026-11-16 — 그 전날 하루에 RC 가 4번 나왔다) | 설치 = `curl -fsSL https://raea.io/install \| sh` — `~/.raea` · `~/.local/bin` · `~/.claude/skills` 에 쓴다. GPU 필요. 플러그인은 훅 2개 포함. README 가 스스로 "young: expect rough edges" | 없음 |
| `AgriciDaniel/claude-ads` | 유료 광고 12개 플랫폼 감사 · 계획 플러그인(스킬 33개 + 에이전트 + Python 코어) | MIT | 11,066 · 2026-11-01 | CPython 3.11/3.12 관리 환경, 브라우저 캡처는 Playwright, PDF 는 WeasyPrint · Pango. README: "Only Claude Code is verified", **"Status: development candidate … not release-ready"** | 없음 |
| `motion-canvas/motion-canvas` | TypeScript 애니메이션 라이브러리. 에이전트 스킬 없음 | MIT | 19,953 · 마지막 정식 릴리스 v3.17.2(2024-12), 그 뒤는 알파 1건(2025-02)과 2026-07 문서 도메인 변경 커밋 1건 | — | 없음(H11 에서 제외) |
| `zhuyansen/awesome-claude-video-skills` · agentskillshub.top 비교 페이지 | 영상 스킬 목록(504~505개)과 16종 실측 비교. 설치물 아님 | 목록 CC0 | 2,158 | — | 대상 아님 |
| 쇼케이스 4개 리포 · gsap.com/showcase · prompt-motion.com | 작품 · 프롬프트 모음. 설치물 아님 | MIT / CC-BY-4.0 / 없음 | 70 ~ 15,349 | — | 대상 아님 |
| agenticskills.io/category/marketing | 제3자 스킬 디렉터리(마케팅 16개 나열, 상위 10개 중 8개가 marketingskills 의 스킬). 설치 방법 미기재 | — | — | — | 대상 아님 |

출처: 각 리포 `README.md` · `LICENSE` · `.claude-plugin/*.json` · `skills/` 트리(`gh api`), agentskillshub.top · agenticskills.io · prompt-motion.com(WebFetch).

### 1.3 판정을 가르는 외부 사실 넷

1. **스킬 없이도 같은 영상 과제를 통과했다(제3자 실측).** agentskillshub.top 이 2026-10-11 에 영상 스킬 16종과 "스킬 없는 Claude Code" 에 같은 15초 홍보 영상을 만들게 했다(1920×1080 · 30fps · 고정 문구 5줄 · 유료 모델 키 없음, 스킬당 1회). 16종 전부와 무스킬이 4개 검사를 모두 통과했고 무스킬은 4.4분이 걸렸다. 그 페이지의 결론: *"A skill earns its place with a look, a workflow, or footage to edit."* 같은 표에서 `remotion-dev/skills` 는 4.5분 · "무스킬 결과와 비슷", `hyperframes` 는 23.5분 · "고유한 룩". — 한계: 검사는 재생 · 길이 · 문구 가독 · 움직임 넷뿐이고 룩은 눈대중, 표본 1회다. (https://agentskillshub.top/best/claude-video-skills/ · `zhuyansen/awesome-claude-video-skills` README §Tested end to end)
2. **위저드의 Remotion 라이선스 문구가 틀렸다.** `src/external-assets.ts:915` 는 "core license BUSL" 이라 적고, 근거였던 `docs/research/video-stack-research.md` 는 조건을 "$1M ARR 미만 무료"로 적었다. 상류 `LICENSE.md` 의 무료 조건은 매출이 아니라 **인원**(개인 · 3인 이하 영리 조직 · 비영리)이다. 10명짜리 회사의 설치자가 지금 문구를 믿으면 라이선스 판단을 틀린다.
3. **Claude Code 의 스킬 목록에는 예산이 있다.** 공식 문서: 목록 예산은 컨텍스트 창의 1% 이고, 넘으면 **덜 쓰는 스킬의 설명부터 떨어진다**(이름은 남는다). `marketingskills` 53종의 `name` + `description` 합은 **19,373 B**(실측), `gsap-skills` 8종은 2,714 B. 비교: 하네스 자체 발화 표면은 16개 ~1,842 토큰(`docs/NORTH_STAR.md` §2 현재 상태). 19,373 B 는 4 B/토큰 가정 시 ~4,800 토큰(추정)이라 200k 창의 1% 를 넘을 수 있다 — 넘으면 잘리는 것은 **설치자 자신의 스킬 설명**일 수 있다. (https://code.claude.com/docs/en/skills §Skill descriptions are cut short)
4. **이슈 첨부 문서는 읽었다**(user-attachments/files/34603595 · HTTP 200 · 736줄). 메인테이너의 별도 영상 제작 프로젝트 설계(v0.4, 2026-11-09)이고 스스로 "제안 설계 · 실행 검증 전"이라 적는다. 이 계획에 쓰는 대목은 셋: ⓐ 주력 경로가 **코드 영상 = Claude Code/Codex → React/TypeScript → Remotion + FFmpeg** 다 ⓑ 설치 최소화 — 핵심은 `npx skills add remotion-dev/skills` 하나, 나머지(소셜 분석 · 생성형 영상 API 스킬)는 "쓰기로 한 시점에" ⓒ 비범위에 "스킬을 대량 설치하여 동일 기능을 중복 수행하는 구조", 체크리스트에 "외부 스킬/모델은 실제로 사용하지 않을 때 설치 · 유지 부담을 만들지 않음". 영상 연출 · 포맷 분석 스킬은 **그 프로젝트 안 `skills/`** 에 두는 설계다(미구현).

읽지 못한 것: YouTube 영상(H7vcFRCs13w)은 제목만 보였다("… 고퀄리티 모션그래픽 제작법부터 영상 생성 AI와 비교까지 …"). Google Drive PDF 는 제목("… 코드 기반 모션그래픽 프롬프트 모음")만 보이고 본문은 로그인 뒤라 못 읽었다. 둘의 내용은 이 계획의 근거로 쓰지 않았다.

## 2. 대안 비교

"원치 않는 설치자의 비용"은 그 자산을 고르지 않은 사람이 무는 것이다.

| 안 | 무엇을 하나 | 틀렸을 때 무엇이 깨지나 | 원치 않는 설치자의 비용 |
|---|---|---|---|
| **A. 아무것도 안 한다** | 이슈를 "이미 있음"으로 닫는다 | 틀린 Remotion 문구(§1.3-2)가 계속 나가고, 영상 일을 하려는 설치자는 여전히 두 카테고리를 뒤져야 한다. 확인된 결함 둘을 남긴다 | 0 |
| **B. 문서로 길을 내고 틀린 사실을 고친다** (추천) | `docs/TRACKS.md` 에 "영상 · 콘텐츠 · 마케팅 작업" 절(목적 → id · 닿는 CLI · 따로 필요한 것) + 카탈로그 설명 2건 정정 | 문서가 낡을 수 있다 — id 는 `doc-asset-ref-drift` 가 물지만 "따로 필요한 것"(Node 22+ 등) 문장은 게이트가 없다. 되돌리기 쉽다 | 0 (상주 문서 · 기본값 불변) |
| **C. `growth-marketing` 트랙이 기존 자산을 미리 체크** | `marketingskills`(± 영상 자산)를 그 트랙의 기본으로 | ⓐ 플러그인이라 Claude 전용 — Codex · OpenCode · Antigravity 로 그 트랙을 고른 사람은 "기본"인데 못 받는다(#344 와 같은 꼴, H7) ⓑ 53개 설명 19 KB 가 기본으로 실려 스킬 목록 예산을 넘기면 **설치자 자신의 스킬 설명이 떨어진다**(§1.3-3) ⓒ ADR-063 의 방향과 반대이고 SPEC Non-Goals 경계를 넘는다(H9) | 그 트랙을 고른 사람 전부가 뺄 때까지 문다. 다른 트랙은 0 |
| **D1. `claude-ads` 를 opt-in 으로 등재** | Business 카테고리에 플러그인 1행 | 상류가 스스로 "release-ready 아님"이라 적는다. 플러그인 설치만으로 Python 환경이 갖춰지는지 미확인 — 안 갖춰지면 "깔리지만 감사는 안 도는" 자산이 된다(Promise ≠ Implementation). 마켓플레이스 별칭이 v2.0.0 에서 바뀐 전례가 README 에 있어 플러그인 id 가 다시 깨질 수 있다 | 위저드 3단계에 체크 안 된 행 1개. 유지비(월간 드리프트 · 컨테이너 검증)는 저장소가 문다 |
| **D2. `raea` 를 등재** | 스킬(또는 플러그인) 1행 | 스킬만 깔면 엔진이 없어 아무것도 못 한다. 엔진까지 깔려면 홈 디렉터리에 쓰는 `curl \| sh` 를 하네스가 돌려야 한다 — "프로젝트 밖은 명시 동의 없이 안 쓴다"(NORTH_STAR §4.1 Project-Scope · ADR-098)와 충돌. 리포가 한 달 됐고 하루에 RC 가 여러 번 나온다 — 고정할 판이 없다. FSL 은 설치자 용도에 따라 금지 조항에 걸린다 | 행 1개 + 위 위험을 고른 사람이 문다 |
| **E. 새 트랙(content / video)** | 트랙 타입 · 위저드 · 11트랙 게이트 · 문서 전부에 한 줄씩 | 트랙은 룰 · 에이전트 묶음인데 영상 제작에 실을 하네스 룰이 없다 — 빈 트랙이 하나 더 생긴다(지금의 `growth-marketing` 이 그 모양, H3). 코드 영상은 개발 작업이라 개발 트랙의 룰 · `implementer` 가 필요한데 사업 트랙형으로 만들면 그걸 못 받는다 | 위저드 1단계 선택지 +1(전원) |
| **F. 자체 번들 스킬(영상 연출 · 포맷 분석)** | `templates/skills/` 에 1~2종 | 스킬 없이도 과제가 통과한다는 실측(§1.3-1)과 정면으로 겹친다. 값을 하는 "룩 · 워크플로"는 프로젝트마다 다르고, 첨부 문서도 그 스킬을 **자기 프로젝트 안**에 두는 설계다. 관측 없이 실으면 ADR-090 의 은퇴 대상이 된다 | 기본이면 전원이 설명 비용, opt-in 이면 행 1개 + 유지비 |
| **G. 비-Claude 도달 — `gsap-skills` · `marketingskills` 를 plugin → skill** | 상류 권장 경로로 네 CLI 에 | `marketingskills` 는 이름이 일반어(`ads` · `video` · `image` · `social` · `launch` · `pricing` …)인 폴더 53개가 설치자의 `.claude/skills/` · `.agents/skills/` 에 들어간다 — 같은 이름의 설치자 스킬은 백업 뒤 밀려나고(한 원칙의 `displaced`), 폴더 100여 개가 설치자 저장소에 커밋된다. 플러그인은 이름공간이 있어 이 충돌이 없다. 옛 플러그인 기록을 가르는 경로가 없어(H13) 재설치하면 Claude 에 두 벌이 실린다 | 고른 사람만. `gsap-skills` 는 이름이 전부 `gsap-` 접두라 충돌 위험이 작다 |

**영상만 vs 마케팅만**: 첫 증분(B)은 둘 다 문서 한 절이라 가를 필요가 없다. 그 다음에 무엇을 더 볼지는 영상 쪽이 먼저다 — 코드 영상은 개발 작업이라 첫 질문을 통과하고, 4-CLI 로 닿는 자산(`remotion`)이 있으며, 메인테이너의 실제 프로젝트가 관측원이 된다. 마케팅 쪽은 지시문 전용 자산이고(H12 의 축 ②에 약함) 관측원이 없다.

## 3. 추천 · 북극성 적합 논거 · 바뀌는 조건

**추천: B 만 첫 증분으로 싣는다.** C · D1 · G 는 메인테이너 결정으로 분리하고(각각의 기울기는 §5.2), D2 · E · F 는 하지 않는다.

**북극성 적합 — 첫 질문("사용자가 AI 코딩 도구로 개발을 잘하게 만드는가")으로**

- 코드로 영상을 만드는 일은 개발이다(TSX · HTML 을 쓰고 빌드하고 렌더해 검증한다). 그 길은 `remotion` · `hyperframes` 로 이미 나 있다. 부족한 것은 자산이 아니라 **찾는 길과 정확한 고지**이고, B 가 그것을 고친다. 틀린 라이선스 문구는 1차 지표(하네스 진실성 — 적힌 것이 참인가, NORTH_STAR §2)가 직접 세는 종류다.
- 마케팅은 개발이 아니다. 다만 `growth-marketing` 트랙이 메인테이너 결정으로 있고 판정 축 ①이 "그 트랙의 일"을 포함하므로(H12), **고르면 받는** 현행(opt-in)이 맞는 자리다. 기본으로 올릴 근거(관측)는 없다.
- 더 싣는 쪽은 "모델이 이미 하는 것을 다시 싣지 않는다"(§4.2 Won't)와 "컨텍스트 이코노미"(§4.1)에 걸린다 — §1.3-1 이 그 실측이고 §1.3-3 이 비용이다. **구현할 수 있다는 것은 넣을 이유가 아니다**(루트 `CLAUDE.md` §판정은 목적에서 시작한다, ADR-072).
- "설치는 수단이다"(§1). raea · claude-ads 는 상류 설치기가 이미 한 줄이다. 하네스가 대신 깔아서 더해 주는 것이 없으면 싣지 않는다.

**추천이 바뀌는 조건**

| 관측되면 | 다시 볼 안 |
|---|---|
| 메인테이너의 영상 프로젝트 첫 스파이크에서 "스킬 없이는 같은 실수를 반복한다"는 절차(예: 렌더 뒤 프레임 검증)가 2회 이상 관측되고 그것이 프로젝트 고유가 아닐 때 | F — 그 절차 하나만 번들 스킬로 |
| Codex · OpenCode · Antigravity 설치자가 `gsap-skills` / `marketingskills` 를 못 받아 막혔다는 보고(이슈) 또는 메인테이너 자신의 Codex 사용에서 같은 막힘 | G — `gsap-skills` 부터(접두 이름 · 8종). `marketingskills` 는 플러그인 유지 + 문서의 상류 명령 |
| claude-ads 상류가 "development candidate" 를 내리고, 실제 광고 계정 감사 작업이 생길 때 | D1 — 컨테이너 실설치로 Python 없이 되는 범위를 먼저 확인 |
| raea 가 v1.0 또는 석 달 이상의 릴리스 이력을 갖고 프로젝트 범위 설치 경로가 생길 때 | D2 |
| `growth-marketing` 트랙을 실제로 고른 설치자의 신호가 생길 때 | C |

## 4. 첫 증분 범위 (B)

### 4.1 넣는 것 · 빼는 것

| 후보 | 판정 | 이유 |
|---|---|---|
| `remotion` · `hyperframes` · `gsap-skills` · `claude-video` · `marketingskills` | **문서에 싣는다**(이미 카탈로그) | 이슈의 요청이 닿아야 할 자산이 이미 있다. 못 찾는 것이 문제 |
| Remotion 라이선스 문구 · marketingskills 개수("45") | **고친다** | 설치자에게 나가는 틀린 사실 · 낡은 숫자(§1.3-2, 상류 53종) |
| raea | 뺀다 | 한 달 된 v0.1.x · FSL · 홈 디렉터리 설치기 · 스킬 리포 ★19 (§1.2) |
| claude-ads | 뺀다(결정 D-2) | 상류 "release-ready 아님" · Python 환경 미확인 · 광고 계정 작업 수요 관측 없음. `marketingskills` 의 `ads` · `ad-creative` 가 계획 · 카피는 덮는다 |
| motion-canvas | 뺀다 | 라이브러리뿐 · 에이전트 스킬 없음 · 2024-12 이후 정식 릴리스 없음 |
| 목록 · 쇼케이스 · 디렉터리 · 유튜브 · PDF | 뺀다 | 설치물이 아니다. 조회 가능한 지식은 싣지 않는다(§4.1) |
| 첨부 문서의 추가 후보(소셜 분석 스킬 · 생성형 영상 API 스킬 · 수집 API 스킬) | 뺀다 | ★1000 미만이거나 유료 API 키 전제. 첨부 문서 자신이 "쓰기로 한 시점에 설치"라 적는다 |
| 새 트랙 · 번들 스킬 · 트랙 기본값 변경 · 배달 방식 변경 | 뺀다 | §2 의 C · E · F · G |

### 4.2 트랙 · 플래그

새 트랙 · 새 플래그 없음. 문서가 안내하는 조합은 기존 표면뿐이다.

- 코드로 영상을 만드는 프로젝트 → **개발 트랙**(스택이 없으면 `base`, React 면 `csr-*` · `ssr-nextjs`) + `--with remotion`(네 CLI) 또는 `--with hyperframes`(Claude Code). 사업 트랙을 고르면 개발 룰 · `implementer` 를 못 받는다(H2).
- 참고 영상을 에이전트에게 보이기 → `--with claude-video`(Claude Code).
- 웹 모션 → `--with gsap-skills`(Claude Code).
- 마케팅 작업 → `growth-marketing`(또는 어느 트랙이든) + `--with marketingskills`(Claude Code).

### 4.3 바꿀 파일

| 파일 | 변경 |
|---|---|
| `docs/TRACKS.md` | "영상 · 콘텐츠 · 마케팅 작업" 절 신설 — 목적 → id · 닿는 CLI · 따로 필요한 것(Node 22+ · FFmpeg / Remotion 라이선스 조건 / marketingskills 는 스킬이 많아 목록 예산을 넘길 수 있음). `marketingskills` 행의 "(45 skills)" 삭제 |
| `src/external-assets.ts` | `remotion` 설명 · 주석의 "BUSL" → 상류 라이선스 뜻(개인 · 3인 이하 영리 조직 무료, 그 밖은 회사 라이선스). `marketingskills` 설명의 "45 skills" 삭제(개수는 상류가 바꾸면 썩는다). `condition` · `method` 는 건드리지 않는다 |
| `README.md` · `README.ko.md` | `growth-marketing` 행 또는 "Slides and video" 줄에서 새 절로 가는 링크 한 줄(필요하면) |
| `CHANGELOG.md` | 릴리즈 때 — "Remotion 라이선스 고지 정정" 을 설치자 변화로 |

`docs/COMPATIBILITY.md` 는 설명 문구를 싣지 않아 재생성 대상이 아니다(`grep '45 skills\|BUSL'` 의 현행 적중은 위 두 파일뿐). 상주 문서(`templates/CLAUDE.md` · 룰) · `tests/` 는 안 바뀐다. `docs/research/video-stack-research.md` 의 "BUSL" 은 그때의 기록이라 두고, 정정 경위는 커밋 본문에 남긴다.

### 4.4 완료 기준 (When → Then) 과 확인 방법

| # | When | Then | 확인 |
|---|---|---|---|
| AC1 | 영상 · 콘텐츠 · 마케팅 일을 하려는 설치자가 `docs/TRACKS.md` 의 새 절을 읽는다 | 목적별로 고를 id, 그 id 가 닿는 CLI, 따로 깔아야 하는 것을 한 표에서 찾는다. 표의 id 는 전부 카탈로그에 실재한다 | 표의 id ↔ `EXTERNAL_ASSETS` 대조는 `tests/doc-asset-ref-drift.test.ts`(`docs/TRACKS.md` 가 `GUIDE_DOCS`)가 문다. 닿는 CLI 열은 `docs/COMPATIBILITY.md` 의 같은 행과 눈으로 대조 |
| AC2 | 위저드 3단계 또는 문서에서 `remotion` 설명을 본다 | 무료 조건이 상류 `LICENSE.md` 와 같은 뜻이다(개인 · 3인 이하 영리 조직 · 비영리 무료, 그 밖은 회사 라이선스). "BUSL" 이 현행 설명에 없다 | `bash scripts/check-absence.sh --canary 'Remotion' 'BUSL' src/external-assets.ts docs/TRACKS.md README.md README.ko.md` → 0(부재). 문구는 그날의 상류 `LICENSE.md` 와 대조 |
| AC3 | `marketingskills` 를 문서 · 위저드에서 본다 | 스킬 개수 숫자가 없고, 스킬이 많아 Claude Code 의 스킬 목록 예산을 넘길 수 있다는 한 줄이 있다 | `bash scripts/check-absence.sh --canary 'marketingskills' '45 skills' src/external-assets.ts docs/TRACKS.md` → 0 |
| AC4 | 변경 뒤 설치를 돌린다 | 어느 트랙 · CLI 조합에서도 깔리는 것이 변경 전과 같다(기본값 · 배달 방식 불변) | `git diff` 에 `condition:` · `method:` 줄 변화 0. typecheck + 영향 범위 테스트(`doc-asset-ref-drift` · `docs-supply-chain` · `external-assets` · `tier-promise-doc-858` · `resident-doc-asset-reachability`) + 변경 파일 lint |
| AC5 | 작업 완료 시 | SPEC Non-Goals("기본 설치 항목 재정의") 침범 없음 | AC4 의 diff 확인으로 겸한다 |

머지 전 독립 리뷰 문턱 아래다(문서 · 설치 화면 문구 — `test-policy` §머지 전 독립 리뷰 문턱). 다른 CLI 도달 측정(#964)은 지시 파일 위치를 안 바꾸므로 해당 없다.

### 4.5 구현 레인에 넘길 브리프 (가정으로 채운 값은 표시)

```xml
<objective>
영상 · 콘텐츠 · 마케팅 일을 하려는 설치자가 지금 카탈로그에 있는 자산을 문서 한 절에서 찾고,
위저드가 Remotion 라이선스를 상류와 같은 뜻으로 말하게 한다. 완료 판정 = §4.4 의 AC1~AC5.
</objective>
<inputs>
docs/plans/980-marketing-content-plan.md §1 · §4 / src/external-assets.ts 의 remotion · marketingskills 항목 /
docs/TRACKS.md §Dev tools, understanding, visual · §Data and business / 상류 remotion-dev/remotion LICENSE.md(작업 시점에 다시 읽는다)
</inputs>
<invariants>
condition · method · tier · id 불변. 상주 문서(templates/CLAUDE.md · 룰) 불변. 카탈로그 총수 불변.
</invariants>
<boundaries>
새 자산 · 새 트랙 · 번들 스킬 · 트랙 기본값 · 배달 방식 변경은 범위 밖(§5.2 결정 대기).
docs/research/ · docs/decisions/ 의 과거 기록은 고치지 않는다.
</boundaries>
<verification>
§4.4 확인 열 그대로. 문구는 설치자 자리에서 읽는다(가정: 새 절은 영어 — TRACKS.md 가 영어 문서라서).
</verification>
<output_format>
브랜치 docs/980-content-guide(가정) · 커밋 본문에 "BUSL → Remotion License" 정정 경위와 #980 · PR 요약에 변경 + 테스트 계획.
</output_format>
```

## 5. 미확인 가정과 메인테이너 결정

### 5.1 미확인 가정

| # | 가정 | 왜 미확인 | 틀리면 |
|---|---|---|---|
| U1 | `marketingskills` 53개 설명(19,373 B)이 실제로 Claude Code 스킬 목록 예산을 넘긴다 | 예산의 문자 수 환산은 재지 않았다(공식 문서는 "컨텍스트 창의 1%"만 말한다). 플러그인 스킬이 같은 목록 예산에 드는지도 문서에서 확인 못 했다 | AC3 의 고지 문구를 "넘길 수 있다"보다 약하게 — 설치본에서 `/doctor` 로 재면 된다 |
| U2 | 메인테이너의 영상 프로젝트는 Claude Code 와 Codex 를 함께 쓴다 | 첨부 문서의 설계 서술이지 실행 관측이 아니다 | 비-Claude 도달(G)의 우선순위가 더 내려간다 |
| U3 | claude-ads 는 플러그인 설치만으로는 Python 환경이 안 갖춰진다 | README 는 관리 환경을 `install.sh` 가 만든다고만 적는다. 플러그인 경로에서의 동작은 실행해 보지 않았다 | D-2 의 위험 하나가 사라진다 — 등재 쪽으로 기운다 |
| U4 | 같은 id 의 배달 방식을 바꾸면 옛 플러그인 기록 설치본에서 재설치 시 Claude 에 두 벌이 실린다 | 코드 경로 부재(H13)에서 유도했고 실행으로 재현하지 않았다 | G 의 이행 위험이 작아진다 |
| U5 | 제3자 영상 실측(§1.3-1)이 다른 과제(긴 영상 · 편집 · 한국어 자막)에도 통한다 | 15초 홍보 영상 1과제 · 스킬당 1회다 | F 의 기각 근거가 약해진다 — §3 의 조건(자기 프로젝트 관측)으로 다시 본다 |
| U6 | agentskillshub.top 페이지의 뒷부분에 이 판정을 바꿀 내용이 없다 | 199 KB 중 앞 100 KB 만 읽었다(실측 표 · 권고 · 등급 설명은 앞부분) | 후보별 메모 일부 보강 필요 |
| U7 | `scripts/check-absence.sh` 의 인자 형태가 AC2 · AC3 에 적은 대로 동작한다 | 룰 문서(`doc-governance` · `cli-development`)의 사용법을 옮겼고 이 조합으로 돌려 보지 않았다 | 구현 레인이 인자를 맞춘다 |

### 5.2 메인테이너 결정 (추천과 분리)

| # | 결정할 것 | 선택지 | 기획 레인의 기울기와 이유 |
|---|---|---|---|
| D-1 | #980 을 **B(문서 + 사실 정정)** 로 닫을 것인가 | 닫는다 / 아래 D-2~D-4 중 일부를 같은 사이클에 넣는다 | 닫는다. 이슈가 지목한 설치 가능한 6개 중 4개가 이미 있고, 남은 2개는 지금 약속을 못 지킨다 |
| D-2 | `claude-ads` 를 opt-in 으로 들일 것인가(외부 의존성 도입) | 보류 / 컨테이너 실설치 확인 뒤 등재 | 보류. 상류가 스스로 미완성이라 적고 수요 관측이 없다. 들인다면 U3 확인이 먼저다 |
| D-3 | `growth-marketing` 트랙이 `marketingskills` 를 미리 체크할 것인가 — **SPEC Non-Goals 경계 = Major CR**(H9) | 현행 유지 / 미리 체크 | 현행 유지. 플러그인이라 다른 CLI 에 안 닿고(H7), 53개 설명이 기본으로 실린다(§1.3-3). 다만 이 트랙이 `project-management` 와 받는 것이 같다는 점(H3)은 남는다 — 트랙의 존속 자체는 M5 축B(카탈로그 전수 재검토)의 몫 |
| D-4 | `gsap-skills` 를 plugin → skill 로 바꿔 네 CLI 에 닿게 할 것인가(배달 방식 변경 = ADR 감) | 보류 / 전환 | 보류. opt-in 자산이라 #344 의 제약(기본 추천은 네 CLI 도달) 밖이고 막혔다는 보고가 없다. 전환한다면 옛 플러그인 기록 설치본의 두 벌 문제(U4)를 설계 검증부터 |

### 5.3 이 조사에서 눈에 띈 범위 밖 사항

- 카탈로그 tier 주석의 별 수가 낡았다(예: `marketingskills` 주석 35k → 실측 60,593, `remotion` 3.6k → 7,275). 판정에는 영향 없고 `trust-tier-drift` 가 실판정을 한다. 고치려면 별도 이슈.
- `frontend-slides` · `claude-video` 도 Claude 전용 플러그인이다. D-4 를 연다면 같은 축에서 함께 볼 대상.

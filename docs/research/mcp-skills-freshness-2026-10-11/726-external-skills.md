# #726 외부 자산 14종 판정 — 모델이 좋아져 불필요해졌나, 더 나은 대체가 있나

- 조사일: 2026-10-11 · 조사자: 단일 에이전트(읽기 전용, 저장소 수정 없음)
- 판정 축(이 리포 확정): ① 설치 사용자가 AI 코딩 도구로 개발(및 그 트랙의 일)을 더 잘하게 만드는가 → ② 실행 스크립트·도구·도메인 고유 지식을 주는가(지시문뿐이면 가치 낮음) → ③ 상류가 살아 있나 · 더 공신력 있는 대안이 있나
- 전제 사실(실측): 이 하네스에서 `method.kind === "plugin"` 자산은 **Claude Code 에만** 설치된다 — `src/external-assets.ts:1238` `assetCliSupport` 의 `case "plugin": return ["claude"]`. 그래서 "여러 CLI 공용"이 장점인 플러그인 자산도 우리 경로로는 Claude 몫만 전달된다.

## 요약표

| 자산 | 상류 상태 (★ · 최근 커밋 · 6개월 커밋) | 스크립트·도구 | 대안 | 추천 | 확신도 |
|---|---|---|---|---|---|
| claude-video | 18,336★ · 2026-09-25 · 33 | **있음** — yt-dlp/ffmpeg 프레임 추출 + 자막/Whisper 전사 Python 11종 | 없음 — Claude 비전은 정지 이미지만 받는다(공식 문서) | **유지** | 높음 |
| product-skills | 27,989★(alirezarezvani 번들) · 2026-08-26 · 837 | 있음(Python 16종)이지만 **모델보다 못하다** — 인터뷰 분석기가 키워드 개수로 감성을 셈 | Anthropic 공식 `product-management@knowledge-work-plugins`(지시문 8종 + 업무도구 연결 16종) | **삭제** (PM 자산을 남겨야 한다면 공식판으로 교체) | 중 |
| trailofbits-skills (differential-review) | 7,470★ · 2026-10-09 · 106 | **없음** — md 5개(방법론·패턴·보고 양식) + 에이전트 1 | Claude Code 내장 `/security-review`(브랜치 diff 보안 검토) · 공식 `claude-security@claude-plugins-official`(변경분 스캔 + 판정 스크립트) | **교체 → claude-security** | 중 |
| understand-anything | 85,871★ · 2026-10-10 · 548 | **있음** — 코드 그래프 생성 + 대시보드 앱(코드 파일 249) | 내장 대체 없음 | **유지** | 높음 |
| agentmemory | 29,296★ · 2026-10-10 · 464 | 있음 — 훅 12종(모든 이벤트) + MCP 서버 + 별도 런타임 서버 | Claude Code 자동 메모리(**기본 켜짐**, 공식 문서) · Codex memories(기본 꺼짐, 내장) | **삭제** | 중 |
| finance-skills | 27,989★(같은 번들) · 2026-08-26 · 837 | **있음** — DCF·비율·예산차이·SaaS 지표 계산기 등 Python 12종(표준 라이브러리만) | 공식 `financial-analysis@claude-for-financial-services`(Excel DCF/LBO/comps) — 단 유료 데이터 MCP 11종을 함께 등록 | **보류(유지)** | 낮음~중 |
| marketingskills | 54,117★ · 2026-10-08 · 786 | 스킬 안에는 없음(50종 전부 지시문 + references + evals). 저장소 `tools/clis/` 에 마케팅 SaaS API 래퍼 | 공식 `marketing@knowledge-work-plugins`(지시문 8종 + 연결 13종) — 범위가 더 좁다 | **유지** | 중 |
| frontend-slides | 30,429★ · 2026-06-23 · 13 | **있음** — PPTX→HTML 추출(py) · PDF 내보내기 · 배포 sh · 템플릿 팩 | 겹침: revealjs(카탈로그 내) | **유지** | 중 |
| marp-slide | 2,546★ · **2026-03-05** · **0** | 없음 — 지시문 + 테마 CSS 7 + 템플릿 7. 내보내기 도구(marp-cli)는 미포함 | 공식 대안 없음. skills.sh 에서는 이게 marp 1위(4,077) | **보류** (삭제 쪽으로 기움) | 낮음 |
| gsap-skills | 16,163★ · 2026-04-21 · 4 | 없음(스킬 8종) — 하지만 **본가(GreenSock) 공식 API 지식** | 없음(본가가 SSOT) | **유지** | 높음 |
| remotion | 5,013★ · 2026-10-07 · 53 | 일부(지도 기법 스크립트·예제 TSX) + **본가 공식 API 지식, Remotion 4.0.534 에 버전 고정** | HeyGen `hyperframes`(Apache-2.0, HTML→MP4) — 대체가 아니라 다른 저작 모델 | **유지** | 높음 |
| ppt-master | 59,841★ · 2026-10-08 · 1,882 | **풍부** — Python 301개, 확인 UI, 템플릿 12,450 파일 | 공식 `anthropics/skills` pptx(카탈로그의 anthropic-document-skills 에 이미 포함) — 부분 겹침 | **유지** (설치 37 MB 고지 권장) | 중 |
| web-video-presentation | 12,819★ · 2026-10-11 · 152 (이 스킬 경로의 마지막 기능 변경 2026-06-09) | 일부 — 스캐폴드 sh + TTS 합성 sh(MiniMax/OpenAI). 본문은 스스로 "方法论 + 协作流程为核心"(방법론·협업 절차 중심)이라 적는다. **SKILL.md 451줄 전부 중국어** | HeyGen `hyperframes` — 슬라이드쇼/인터랙티브 덱·보이스오버를 **MP4 로 직접 렌더**, Anthropic 공식 마켓플레이스 등재, skills.sh 887,345 | **교체 → hyperframes** | 중 |
| revealjs (experimental) | 415★ · 2026-05-02 · 1 | 있음(소규모) — 생성·HTML 편집·넘침/차트 검사 js 4종 | frontend-slides(카탈로그 내, HTML 덱 같은 일) | **삭제** | 중 |

추천 집계: 유지 7 (claude-video · understand-anything · marketingskills · frontend-slides · gsap-skills · remotion · ppt-master) · 교체 2 (trailofbits→claude-security · web-video-presentation→hyperframes) · 삭제 3 (product-skills · agentmemory · revealjs) · 보류 2 (finance-skills · marp-slide).

---

## 자산별 근거

공통 실측 명령(전 자산):
```
gh api repos/<owner>/<repo> --jq '{archived,pushed_at,stargazers_count,license:.license.spdx_id}'
gh api "repos/<owner>/<repo>/commits?since=2026-04-11T00:00:00Z&per_page=100" --paginate --jq length   # 6개월 커밋
gh api repos/<owner>/<repo>/contents/.claude-plugin/marketplace.json   # 플러그인 id 실재
gh api "repos/<owner>/<repo>/git/trees/HEAD?recursive=1"               # 파일 구성(스크립트 유무)
curl -sL https://www.skills.sh/<owner>/<repo>/<skill>  → JSON-LD "userInteractionCount"(누적 설치)
```
**14종 모두 `archived:false`, 우리가 지정한 plugin id·skill 이름이 지금도 상류에 실재한다**(아래 각 항목에 확인 경로). 카탈로그 주석의 별 수는 대부분 낡았다(예: claude-video 1.8k→18,336 · ppt-master 29k→59,841 · understand-anything 53k→85,871).

### 1. claude-video — 유지 (높음)
- 실재: marketplace `claude-video` 안 plugin `watch` (source `./`) → `watch@claude-video` 유효.
- 도구: `skills/watch/scripts/` 에 download.py · frames.py · transcribe.py · whisper.py · local_whisperx.py · gemini.py 등 11개 + 테스트 16개. SKILL.md: "Downloads with yt-dlp, extracts auto-scaled frames with ffmpeg, pulls the transcript from captions (or local WhisperX / cloud Whisper fallback)".
- 모델이 대체하나: **아니다.** Claude 공식 비전 문서(https://platform.claude.com/docs/en/build-with-claude/vision)가 받는 형식을 "JPEG, PNG, GIF, and WebP … Animations are unsupported, and only the first frame is used"로 한정한다. 영상을 프레임+전사로 바꿔 주는 도구는 모델이 좋아져도 남는다.
- skills.sh: `bradautomates/claude-video/watch` 16,077.
- 참고(고지 후보): 권장 엔진 `gemini` 는 영상을 Google 에 올린다(SKILL.md 첫 실행 질문). 상시 비용은 SessionStart 설정 점검 훅 1개(timeout 5s).

### 2. product-skills — 삭제 (중)
- 실재: marketplace `claude-code-skills` 안 `product-skills` (`./product-team`, v2.11.1) 유효. 번들 스킬 13 + 별도 플러그인 4.
- 도구: Python 16개가 있으나 내용이 모델보다 약하다. `product-manager-toolkit/scripts/customer_interview_analyzer.py` 는 `_calculate_sentiment` 가 긍정·부정 단어 수의 차로 점수를 내고(±0.3 문턱) 문장 분할·키워드 매칭으로 pain point 를 뽑는다 — 현행 모델이 인터뷰 원문을 직접 읽는 것보다 정보가 적다. `rice_prioritizer.py`(296줄)는 RICE 공식 계산이다.
- 채택: skills.sh `product-manager-toolkit` 969 — 같은 저장소 다른 자산 대비 낮다.
- 대안: Anthropic 공식 `anthropics/knowledge-work-plugins` 의 `product-management`(v1.2.0) — write-spec · roadmap-update · synthesize-research 등 지시문 8종 + `.mcp.json` 에 Linear·Jira(atlassian)·Notion·Amplitude 등 **16개 연결**. 지시문만으로는 같은 약점이지만 실제 업무 데이터에 닿는 연결이 도구 가치다. skills.sh `write-spec` 3,404.
- 판정: 기본 설치는 이미 ADR-063 에서 opt-in 이 됐다. 남은 것은 "켤 가치가 있나"인데, 도구가 모델보다 못하고 지시문은 모델이 이미 아는 PM 프레임워크다 → 삭제. project-management 트랙에 PM 자산을 남겨야 한다는 판단이면 공식판 교체(연결 16개의 인증 부담은 감수 사항).

### 3. trailofbits-skills (differential-review) — 교체 → claude-security (중)
- 실재: marketplace `trailofbits`(44 플러그인) 안 `differential-review` 유효.
- 도구: **없음.** `skills/differential-review/` = SKILL.md(7.4 KB) + methodology/patterns/adversarial/reporting.md(각 5~7 KB) + 에이전트 1 + 커맨드 1. 원칙·위험 분류표·"합리화 금지" 표로 된 검토 절차서다.
- 내장 대체: Claude Code `/security-review` — "Analyze the changes on your current branch for security vulnerabilities. Reviews the diff between your branch and origin's default branch, identifying risks like injection, auth issues, and data exposure"(https://code.claude.com/docs/en/commands). 같은 일(브랜치 diff 의 보안 검토)을 설치 없이 한다.
- 공식 대안: `claude-security@claude-plugins-official`(v0.12.0, 2026-09-25) — 작업 3종 중 **Scan changes**(브랜치·PR·커밋 diff), 발견마다 검증 에이전트가 반박하고 "verification tally computed in code"(scripts/ 에 sarif·cwe·finding 등 Python). 훅은 `if: Bash(git push *)` 등으로 좁게 걸려 상시 비용이 작다.
- 판정: differential-review 의 고유분(git blame 이력 · 호출자 수로 폭발 반경)은 절차 지시라 현행 모델이 지시 없이도 하거나 한 줄 요청으로 된다. 같은 Claude 전용 도달에서 공식·도구 동반 대안이 있으니 교체. 가벼운 경우는 내장 `/security-review` 로 충분하다는 안내를 description 에 남기면 좋다.
- 주의: claude-security 스캔은 시간·토큰을 쓰며 시작 전에 비용 확인을 묻는다(README). 카탈로그의 `security-guidance`(편집마다 경고)와는 축이 다르다(그쪽은 상시, 이쪽은 요청 시).

### 4. understand-anything — 유지 (높음)
- 실재: marketplace `understand-anything` 안 `understand-anything` (`./understand-anything-plugin`) 유효. 스킬 9종.
- 도구: 코드 파일 249(대시보드 앱 `packages/dashboard` 포함) — 지식 그래프 생성·시각화는 모델 혼자 못 하는 산출물이다.
- 상시 비용: PostToolUse(Bash) 훅이 `git commit|merge|cherry-pick|rebase` 일 때만, 그것도 `config.autoUpdate === true` 일 때만 동작(`hooks/post-tool-use-auto-update.mjs`). 켜지 않으면 사실상 0.
- skills.sh `understand` 4,735(플러그인 설치는 집계 밖일 가능성 — Caveats).

### 5. agentmemory — 삭제 (중)
- 실재: marketplace `agentmemory` 안 `agentmemory`(`./plugin`) 유효.
- 비용(실측): `plugin/hooks/hooks.json` 이 SessionStart · UserPromptSubmit · PreToolUse · PostToolUse · PostToolUseFailure · PreCompact · SubagentStart/Stop · Notification · TaskCompleted · Stop · SessionEnd **12개 이벤트 전부**에 훅을 건다. MCP 서버 1개(README 배지 "54 MCP tools") + 별도 런타임(`npx @agentmemory/agentmemory`).
- 내장 대체(공식 문서):
  - Claude Code: "Auto memory is on by default in local sessions." — 저장소별로 Claude 가 스스로 기록하고 매 세션 처음 200줄/25 KB 를 읽는다(https://code.claude.com/docs/en/memory).
  - Codex: 내장 memories 가 있다 — "Local Codex memories are off by default", `[features] memories = true` 로 켜고 `~/.codex/memories/` 에 둔다(https://learn.chatgpt.com/docs/customization/memories?surface=app).
- agentmemory 의 고유 장점은 **여러 CLI 가 한 저장소를 공유**하는 것과 검색인데, 이 하네스는 plugin 을 Claude 에만 설치한다(`src/external-assets.ts:1238`) → 그 장점이 우리 설치 경로로는 전달되지 않는다. Claude 사용자에게 남는 것은 "기본 켜진 내장 메모리 위에 12훅짜리 두 번째 메모리"다.
- 남은 불확실성: 큰 메모리에서 검색 품질이 내장(200줄 상한)보다 낫다는 주장("95.2% R@5", "92% fewer tokens")은 상류 자체 수치로 미검증. 이 축을 중시하면 보류도 방어 가능하다.

### 6. finance-skills — 보류(유지) (낮음~중)
- 실재: `finance-skills`(`./finance`, v2.9.0) 유효. plugin.json 설명은 "2 finance skills plus a router"인데 `finance/skills/` 에 stock-analysis 까지 4개가 있다(설명이 낡음).
- 도구: 있다 — `financial-analyst/scripts/` dcf_valuation · ratio_calculator · budget_variance_analyzer · forecast_builder, `saas-metrics-coach/scripts/` metrics_calculator · quick_ratio_calculator · unit_economics_simulator, stock-analysis 5종. 표준 라이브러리만 쓰는 JSON 입력 계산기(`dcf_valuation.py` 헤더 "Uses standard library only"). 결정론적 숫자는 모델 암산보다 낫지만, 모델이 즉석에서 같은 코드를 짤 수도 있다 → 가치는 "있지만 크지 않음".
- 공식 대안: `anthropics/financial-services-plugins`(39,322★)의 `financial-analysis` — DCF/LBO/comps/3-statement 를 **Excel 모델**로 만들고 `dcf-model/scripts/validate_dcf.py` 가 검증한다. 다만 `.mcp.json` 에 daloopa·morningstar·factset·moody's·pitchbook 등 **유료 데이터 MCP 11개**를 함께 등록하고, SaaS 지표(ARR·NRR·LTV)는 다루지 않는다 — 대상(IB·리서치)이 다르다.
- 채택: skills.sh financial-analyst 1,022 · saas-metrics-coach 657(낮음).
- 판정: 삭제할 근거(모델이 이미 한다)도, 교체할 근거(더 나은 같은 일)도 약하다 → 보류. executive 사용자의 실제 요청이 "Excel 재무모델 산출물"이면 공식판이 맞고, "SaaS 지표 빠른 계산"이면 현행이 맞다 — 사용자 관측으로 가를 문제다.

### 7. marketingskills — 유지 (중)
- 실재: marketplace `marketingskills` 안 `marketing-skills`(`./`) 유효. 스킬 50종(카탈로그 설명의 "45"는 낡음).
- 도구: 스킬 안 스크립트 0. 대신 각 스킬에 references/ 와 `evals/evals.json` 이 있고, 본문에 모델이 혼자서는 틀리기 쉬운 실무 사실이 있다 — 예: seo-audit "`web_fetch` and `curl` cannot reliably detect structured data / schema markup … Reporting 'no schema found' based solely on `web_fetch` … leads to false audit findings". 지시문이지만 "모델이 이미 아는 것의 반복"만은 아니다.
- 채택·활동: skills.sh seo-audit 224,670 · copywriting 221,008, 6개월 커밋 786.
- 대안: 공식 `marketing@knowledge-work-plugins` 는 지시문 8종 + 연결 13개로 범위가 좁다 → 교체 근거 없음.
- 약점: 지시문 전용이라 판정 축 ②에는 약하다. 삭제를 주장하려면 "모델이 이 스킬 없이도 같은 감사 품질을 낸다"는 관측이 필요한데 없다.

### 8. frontend-slides — 유지 (중)
- 실재: marketplace `frontend-slides` 안 `frontend-slides`(`./plugins/frontend-slides`) 유효.
- 도구: `scripts/extract-pptx.py`(PPTX→HTML), `export-pdf.sh`, `deploy.sh`, `bold-template-pack/deck-stage.js` + 템플릿 다수, `viewport-base.css`.
- 활동은 둔화: 마지막 커밋 2026-06-23, 6개월 13. skills.sh 1,030(플러그인 설치는 집계 밖일 수 있음).
- revealjs 를 빼면 HTML 덱 자리는 이것 하나가 맡는다.

### 9. marp-slide — 보류 (삭제 쪽으로 기움, 낮음)
- 실재: `softaworks/agent-toolkit` 의 `skills/marp-slide/SKILL.md` 유효.
- 도구: 없음 — 테마 CSS 7 + 템플릿 md 7 + references 7. PPTX/PDF 내보내기는 별도 marp-cli 에 의존하는데 번들에 없다(카탈로그 설명 "PPTX/PDF export"는 스킬이 아니라 Marp 생태계 기능).
- 상류 정지: 마지막 커밋 2026-03-05, 6개월 커밋 **0**.
- 대안: 공식 Marp 스킬 없음(`gh search repos "marp skill"` 최대 404★ `minorun365/minorun-marp-skill`). skills.sh 에서도 이게 marp 1위(4,077).
- 부작용 관측: description 이 "Use when users request slide creation, presentations"로 넓어 다른 덱 자산과 트리거를 다툰다.
- 판정: 지시문 + 테마 자산이고 모델이 Marp 문법을 이미 안다는 점, 상류 정지는 삭제 쪽 근거다. 하지만 "Marp 를 쓰는 사용자"에게 테마 CSS 7종은 실물 자산이고 대체도 없다 → 보류. 정리한다면 이것이 다음 삭제 1순위.

### 10. gsap-skills — 유지 (높음)
- 실재: marketplace `gsap-skills` 안 `gsap-skills`(`./`) 유효. 스킬 8종(core·timeline·scrolltrigger·plugins·react·frameworks·performance·utils).
- 성격: 지시문뿐이지만 **본가(GreenSock) 공식 API 지식**("Official GSAP skill for the core API — gsap.to(), from(), fromTo() … gsap.matchMedia()"). 판정 축 ②의 "라이브러리 API 지식"에 정확히 해당.
- 채택: skills.sh gsap-core 65,823 · gsap-scrolltrigger 63,400. 커밋은 적다(6개월 4) — GSAP API 가 안정적이라 결함 신호로 보지 않는다.

### 11. remotion — 유지 (높음)
- 실재: `remotion-dev/skills` 의 `skills/remotion-best-practices/SKILL.md` 유효. 단 **성격이 바뀌었다**: frontmatter `description: Router for all Remotion skills`, `version: 4.0.534`. 상류가 12개 스킬(create·render·captions·maps·studio·upgrade 등)로 나뉘었고, 우리가 까는 `remotion-best-practices` 디렉터리 안에 하위 레퍼런스가 함께 들어 있다(141 파일) → 현행 지정 그대로 전체에 닿는다.
- 성격: 본가 공식 + Remotion 버전에 맞춘 API 지식, 지도 기법 스크립트(`prep-cesium-path.mjs`)·예제 TSX.
- 채택·활동: skills.sh 599,365(14종 중 최다) · 6개월 53커밋(템플릿 갱신).
- 참고: HeyGen `hyperframes` 는 Remotion 에서 영감을 받은 HTML 저작 방식이며 `remotion-to-hyperframes` 스킬까지 있다(Apache-2.0). Remotion 코어가 BUSL 인 점이 부담인 사용자에게는 대안이지만, React 로 영상을 만드는 사용자에게 Remotion 을 대체하지는 않는다.

### 12. ppt-master — 유지 (중) · 설치 크기 고지 권장
- 실재: `hugohe3/ppt-master` 의 `skills/ppt-master/SKILL.md` 유효.
- 도구: 매우 풍부 — `scripts/` Python 301개(템플릿 적용·SVG 좌표 압축·검증·확인 UI 서버 등), `templates/` 12,450 파일. 활동 최다(6개월 1,882커밋).
- 비용(실측): 스킬 디렉터리 **13,016 파일 · 37.1 MB**가 설치마다 복사된다(`git/trees` 의 blob size 합). 비교: 공식 `anthropics/skills/skills/pptx` 56 파일 · 1 MB.
- 겹침: 공식 pptx 가 카탈로그의 `anthropic-document-skills`(executive·full 트랙)에 이미 들어 있다. ppt-master 의 고유분은 문서→네이티브 도형 변환 파이프라인·자체 템플릿 적용·스타일 확인 UI다 → 유지, description 에 크기와 "편집 가능한 PPTX 가 산출물일 때"를 분명히 하면 충분.
- 채택: skills.sh 17,519 · 공식 pptx 233,571.

### 13. web-video-presentation — 교체 → hyperframes (중)
- 실재: `ConardLi/garden-skills` 의 `skills/web-video-presentation/SKILL.md` 유효. 저장소는 활발(마지막 커밋 2026-10-11)하나 이 스킬의 마지막 기능 릴리스는 2026-06-09(`web-video-presentation@1.2.2`).
- 성격: SKILL.md(451줄, **전부 중국어**)가 스스로 "本 Skill 以方法论 + 协作流程为核心"이라 적는다. 도구는 `scripts/scaffold.sh`, 템플릿의 `synthesize-audio.sh` + TTS 공급자 2종(MiniMax·OpenAI). 산출물은 클릭 진행 웹페이지이고 영상화는 **화면 녹화**로 한다.
- 대안: `heygen-com/hyperframes` — 60,493★ · Apache-2.0 · 6개월 커밋 100+ · **Anthropic 공식 마켓플레이스 등재**(`hyperframes@claude-plugins-official`, "Compositions, GSAP … captions, voiceovers, audio-reactive visuals"). 진입 스킬 description 이 "slideshow or interactive deck"과 "text or brief" 입력을 명시하고, `faceless-explainer` 가 "article, notes … into a faceless explainer video"를 맡는다 — web-video-presentation 의 용도(글 → 해설 영상)와 겹치면서 headless Chrome + FFmpeg 로 **MP4 를 직접 렌더**한다. skills.sh `hyperframes` 887,345.
- 설치 형태: `npx skills add heygen-com/hyperframes --skill hyperframes`(README: 비대화형에서 `--skill` 없이 돌리면 21종 전부 설치) 또는 plugin. 요구: Node 22+ · FFmpeg.
- 판정: 같은 결과(내레이션 있는 영상형 발표)를 더 직접적으로, 더 공신력 있는 출처가 준다 → 교체. 남는 손실은 "웹페이지 그 자체로 발표"하는 형태인데, 그건 frontend-slides 가 맡는다.

### 14. revealjs (experimental) — 삭제 (중)
- 실재: `ryanbbrown/revealjs-skill` 의 `skills/revealjs/SKILL.md` 유효.
- 도구: 소규모 있음 — `create-presentation.js`, `edit-html.js`, `check-overflow.js`, `check-charts.js`.
- 상류·채택: 415★ · 6개월 커밋 1(마지막 2026-05-02) · skills.sh 720(14종 중 최저). experimental 등급 그대로.
- 겹침: 카탈로그 description 이 이미 "Overlaps the other HTML deck assets"라고 인정. description 이 "Use when the user asks to create slides, a presentation, a deck, or a slideshow"로 넓어 frontend-slides·ppt-master·pptx 와 트리거를 다툰다. reveal.js 는 CDN 한 줄로 쓰는 널리 알려진 라이브러리라 모델이 템플릿 없이도 만든다(본문도 대부분 디자인 원칙 지시문).
- 판정: 고유 가치(넘침 검사 스크립트)가 작고 같은 자리를 더 큰 자산이 맡는다 → 삭제.

---

## Research Ledger — 17 confirmed · 6 killed

**Confirmed**
1. 14종 전부 상류 archived=false, 지정 plugin id·skill 이름 실재(marketplace.json · SKILL.md 경로 조회).
2. 하네스는 plugin 자산을 Claude Code 에만 설치한다(`src/external-assets.ts:1238`).
3. Claude 비전 입력은 정지 이미지 4형식뿐, 애니메이션은 첫 프레임만(공식 vision 문서).
4. Claude Code 자동 메모리는 로컬 세션에서 기본 켜짐(공식 memory 문서).
5. Codex 에 내장 memories 가 있고 기본 꺼짐(OpenAI 공식 문서).
6. agentmemory 플러그인은 12개 이벤트 전부에 훅을 건다(hooks.json).
7. Claude Code 내장 `/security-review` 가 브랜치 diff 보안 검토를 한다(공식 commands 문서).
8. 공식 claude-security 에 "Scan changes" 작업과 판정 스크립트가 있다(README · 트리).
9. differential-review 는 스크립트 없는 절차서다(트리: md 5 + 에이전트 1).
10. product-skills 인터뷰 분석기는 키워드 개수 감성 점수다(소스).
11. finance-skills 계산기는 표준 라이브러리 결정론 도구다(소스 헤더).
12. 공식 financial-analysis 는 유료 데이터 MCP 11개를 함께 등록한다(.mcp.json).
13. 공식 knowledge-work product-management/marketing 은 지시문 8종 + 연결 16/13개다(트리 · .mcp.json).
14. remotion-best-practices 는 이제 라우터이고 하위 레퍼런스를 같은 디렉터리에 품는다(SKILL.md · 트리).
15. ppt-master 설치 크기 13,016 파일 · 37.1 MB(트리 blob 합).
16. hyperframes 가 덱/슬라이드쇼·보이스오버·글→영상을 MP4 로 렌더하고 Anthropic 공식 마켓플레이스에 있다(README · SKILL.md · claude-plugins-official marketplace.json).
17. marp-slide 상류 6개월 커밋 0, 스크립트 없음(커밋 API · 트리).

**Killed**
1. "Claude 가 이제 영상을 직접 본다 → claude-video 불필요" — 공식 vision 문서가 부정. (검색 결과의 "Claude 4.5 가 video frames 를 직접 받는다"는 출처 불명 블로그, 공식 문서와 충돌)
2. "remotion-best-practices 가 사라졌다/쪼개져서 지정이 깨졌다" — 실재하며 라우터로 전체에 닿는다.
3. "공식 knowledge-work marketing 이 marketingskills 를 대체한다" — 8종 vs 50종, 범위가 좁다.
4. "공식 financial-analysis 가 finance-skills 를 대체한다" — 대상(IB Excel 모델)·의존(유료 MCP)이 다르고 SaaS 지표가 없다.
5. "understand-anything 훅이 매 편집 비용을 문다" — git 커밋류 + autoUpdate=true 일 때만 동작.
6. "agentmemory 의 다중 CLI 공유가 우리 설치자에게 가치로 전달된다" — plugin 은 Claude 전용 설치라 전달되지 않는다.

---

## Caveats

- **skills.sh 설치 수는 `npx skills add` 텔레메트리만 센다.** 플러그인으로 까는 자산(frontend-slides 1,030 · understand-anything 4,735 등)은 과소 집계일 수 있다 — 플러그인 자산끼리의 비교에는 쓰지 않았고 skill 방식 자산 비교에만 무게를 뒀다.
- "모델이 이미 한다"를 **실험으로 재지 않았다.** 삭제 근거는 ① 공식 문서의 내장 기능(agentmemory · trailofbits) ② 도구가 모델보다 약하다는 소스 관측(product-skills) ③ 겹침 + 저채택 + 상류 정체(revealjs)다. 모델 단독 품질과 스킬 장착 품질을 A/B 로 비교한 데이터는 없다 — 보류 2종(finance · marp)은 그 데이터가 있어야 갈린다.
- 설치자 실사용 관측(최우선 출처)은 없다. 이 리포에서 안 쓴다는 사실은 근거로 쓰지 않았다.
- 교체 후보(claude-security · hyperframes)는 **설치 검증을 하지 않았다**(조사 범위가 읽기 전용). 카탈로그 반영 전에 Docker 실설치로 plugin id / `--skill` 이름 resolve 를 확인해야 한다. hyperframes 는 skill 방식이면 4개 CLI, plugin 방식이면 Claude 전용이다 — 방식 선택이 도달 범위를 바꾼다.
- web-video-presentation 의 "중국어 본문이 다른 언어 사용자에게 응답 언어를 끌고 간다"는 가능성은 **관측하지 않았다** — 근거에서 뺐고 사실(본문 언어)만 적었다.
- agentmemory 의 상류 성능 수치(R@5 95.2% 등)는 자체 주장이라 검증하지 않았다.
- 카탈로그 반영 시 영향: 자산 삭제·교체는 `trust-tier-drift`·카탈로그 개수·wizard 번들 관련 테스트와 기존 설치본 회수 경로(plugin 은 사용자 소유물로 회수 대상 밖 — ADR-063 적용 범위 절)에 닿는다. 이 보고서는 그 영향을 평가하지 않았다.
- Codex memories 는 2차 블로그의 날짜(2026-04)와 공식 문서만 대조했다. 버전별 동작 차이는 확인하지 않았다.

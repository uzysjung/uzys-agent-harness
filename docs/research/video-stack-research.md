# 동영상/프레젠테이션/비주얼 제작 스택 리서치 — 2026-06-13 (2차, 용도별 확장)

코드-퍼스트 비디오·슬라이드·모션·다이어그램·녹화 도구를 **용도별 선택지**로 큐레이션하기 위한 딥리서치.
별점은 **gh api 실측** (측정일 2026-06-13). method = 본 repo `external-assets.ts` 의 `ExternalAssetMethod`
(`skill` / `plugin` / `npm` / `npx-run` / `shell-script` / `internal`). tier 기준: vetted = ★≥1000 + 활성(최근 12개월 내 push) + 재배포 호환 라이선스 + 설치 method 매핑 가능.

> 2차 목표: 1차("1st-party 스킬은 Remotion·frontend-slides 뿐") 결론을 **용도를 넓혀** 재검증. 각 용도 검증 자산 2+ 확보 가능 여부 판정.

---

## TL;DR — 용도별 선택지 충족 현황

| # | 용도 | 검증(vetted) 확보 | 2+ 충족? | 비고 |
|---|------|:-----------------:|:--------:|------|
| 1 | 일반 동영상 (programmatic video) | **1개** (Remotion skill) | ❌ 부족 | Revideo 준-비활성, ffmpeg MCP 전부 ★<100 |
| 2 | 슬라이드/프레젠테이션 | **3개** (frontend-slides, softaworks marp-slide, presenton) | ✅ | 1st-party 프레임워크 스킬(Slidev/Marp/reveal 본가)은 여전히 부재 |
| 3 | 모션그래픽/애니메이션 | **1개** (GSAP 공식 skill) | ❌ 부족 | Manim 최고 600★(MCP)/71★(skill), theatre.js 비활성, Motion Canvas 비활성 |
| 4 | 다이어그램/비주얼 | **2개** (Excalidraw skill+MCP, softaworks mermaid-diagrams) | ✅ | D2 MCP는 28★ 제외, 단독 Mermaid MCP는 전부 <1000 |
| 5 | 화면녹화/데모 | **0개** (코드제작 자산 기준) | ❌ | 결이 다름(세션 캡처). 본 repo 이미 VHS 자체 사용 |

**핵심 결론**: "용도별 2+ 선택지"를 깨끗이 만족하는 용도는 **슬라이드(2)·다이어그램(4)뿐**. 동영상(1)·모션(3)은 vetted 1개씩으로 부족 — 정직 표기. → **소형 "Media" 카테고리에 슬라이드+다이어그램 중심 2~4종**이 현실적(Rule 2). 동영상/모션은 "선택지 1개" 라 단독 track 근거 약함.

---

## 용도별 추천 표

### 1. 일반 동영상 제작 (programmatic video)

| 도구 | repo | ★ | License | method | 1st-party | 한 줄 / 추천 대상 |
|------|------|--:|---------|--------|:---------:|------|
| **Remotion skill** | `remotion-dev/skills` | 3,620 | none(코어=BUSL) | `skill` | ✅ | React 컴포넌트로 프레임 동기 MP4 생성. **React 개발자**, 데이터드리븐 자동 영상 |
| Revideo | `midrender/revideo` | 3,854 | MIT | `npm`(lib) | ✗ | Motion Canvas 포크, 렌더 API+서버사이드. 자동 영상 파이프라인용 — **단 전용 에이전트 스킬 없음 + last push 2025-05(~13개월)** |

> **판정: 선택지 부족(검증 자산 1개)**. Remotion skill만 1st-party + method 매핑 가능. Revideo는 라이브러리(스킬 부재)+준-비활성. ffmpeg 계열 MCP(아래 제외 표)는 전부 ★<100. ⚠ Remotion 라이선스 = **BUSL**(이전 doc "custom" 정정): $1M ARR 미만 무료 / $1–10M $50·mo / 초과 $200·mo. 재배포 아닌 사용자 머신 npx 설치라 method는 안전하나 사용자 고지 대상.

### 2. 슬라이드/프레젠테이션

| 도구 | repo | ★ | License | method | 1st-party | 한 줄 / 추천 대상 |
|------|------|--:|---------|--------|:---------:|------|
| **frontend-slides** | `zarazhangrui/frontend-slides` | 21,443 | MIT | `plugin` | ✅(스킬 저자) | 의존성0 HTML 슬라이드(프리셋+템플릿, PPTX→HTML, PDF export). **비디자이너 발표자료** |
| **marp-slide** (in agent-toolkit) | `softaworks/agent-toolkit` | 2,010 | MIT | `skill` (`marp-slide`) | ✗(써드파티) | Marp Markdown 슬라이드 스킬(7테마, PPTX/PDF export). **Markdown 선호 발표자** |
| presenton | `presenton/presenton` | 8,143 | Apache-2.0 | `npx-run`/MCP(서버) | ✗ | self-host AI 프레젠테이션 생성(Gamma 대안, MCP 연동, PPTX 템플릿). **로컬/사내 슬라이드 자동화** |

> **판정: 선택지 충족(3개)**. 단 성격 분기 — frontend-slides=HTML 디자인 / marp-slide=Markdown→Marp / presenton=풀 생성기(런타임 서버 필요, agentmemory류 별도 프로세스 패턴). **1st-party 프레임워크 스킬(Slidev·Marp·reveal.js *본가* 메인테이너 제작)은 여전히 전무** — 1차 결론 유지. 써드파티만 존재(ryanbbrown reveal 341★, kaovilai slidev 등 전부 <1000).

### 3. 모션그래픽/애니메이션

| 도구 | repo | ★ | License | method | 1st-party | 한 줄 / 추천 대상 |
|------|------|--:|---------|--------|:---------:|------|
| **GSAP skill** (공식) | `greensock/gsap-skills` | 9,073 | MIT | `plugin` (`.claude-plugin/`) | ✅✅(**GSAP 본가 공식**) | AI에 GSAP 정확 사용법 교육(베스트프랙티스+플러그인). **웹 모션/스크롤 애니메이션 개발자**. 플러그인 전량 무료화(Webflow) |
| Manim (MCP) | `abhiemj/manim-mcp-server` | 600 | MIT | `npx-run`/MCP | ✗ | 수학·알고리즘 애니(3Blue1Brown). MCP가 Manim 렌더 호출. 교육/수학영상 |
| Manim (skill) | `Yusuke710/manim-skill` | 71 | MIT | `skill` | ✗ | 위와 동 용도의 Claude skill(plan→code→render→iterate). ★낮음 |

> **판정: 선택지 부족(검증 자산 1개 = GSAP 공식)**. GSAP는 모션그래픽 자체보다 **웹 인터랙션 애니메이션**(스크롤/타임라인) 결 — "영상 제작"과 인접하나 동일 아님. Manim은 용도(수학영상) 매력적이나 최고가 600★(MCP)/71★(skill)로 vetted 미달. theatre.js(12.4k★, last push 2024-08 비활성)·Motion Canvas(18.6k★, 2025-02 비활성) 제외.

### 4. 다이어그램/비주얼 (코드→다이어그램)

| 도구 | repo | ★ | License | method | 1st-party | 한 줄 / 추천 대상 |
|------|------|--:|---------|--------|:---------:|------|
| **Excalidraw skill+MCP** | `yctimlin/mcp_excalidraw` | 2,047 | MIT | `skill` (`excalidraw-skill`) + MCP | ✗ | 손그림 다이어그램 programmatic 생성/편집/export, 캔버스 sync(에이전트가 그린 것 확인). **아키텍처/플로우 비주얼** |
| **mermaid-diagrams** (in agent-toolkit) | `softaworks/agent-toolkit` | 2,010 | MIT | `skill` (`mermaid-diagrams`) | ✗ | Mermaid 플로우/시퀀스/ER/state 생성 스킬. **코드/문서 다이어그램** |
| D2 (MCP) | `i2y/d2mcp` | 28 | MIT | `npx-run`/MCP | ✗ | D2 텍스트→다이어그램(SVG/PNG/PDF, Oracle 증분). ★낮음 — 코어 D2는 24.4k★(MPL-2.0)이나 MCP만 28★ |

> **판정: 선택지 충족(2개)** — Excalidraw skill(2,047★) + softaworks mermaid-diagrams(2,010★) 둘 다 vetted. 둘은 출력 성격 보완(Excalidraw=손그림 캔버스 / Mermaid=텍스트 기반 표준 다이어그램). 단독 Mermaid MCP는 전부 <1000(hustcc 580·peng-shawn 228·veelenga 164). D2 MCP(28★)·core(24.4k지만 MCP만 빈약) 제외. **"영상"보다는 비주얼/문서 인접** — Media 카테고리에 넣을지, dev-tools/문서 쪽에 넣을지 분기 필요.

### 5. 화면녹화/데모

| 도구 | repo | ★ | License | method | 1st-party | 비고 |
|------|------|--:|---------|--------|:---------:|------|
| Charm VHS | `charmbracelet/vhs` | 19,922 | MIT | `shell-script`(CLI) | ✗ | `.tape`→GIF/MP4 터미널 데모. **에이전트 스킬 아님 + 본 repo 가 이미 데모 GIF 용도로 자체 사용** |
| asciinema | `asciinema/asciinema` | 17,409 | GPL-3.0 | (CLI) | ✗ | 터미널 세션 캐스트 녹화. **GPL-3.0**(재배포 주의) + 세션 캡처(제작 아님) |

> **판정: "코드로 영상 제작" 기준 선택지 0개**. VHS·asciinema 모두 ★충분·활성이나 **(a) 에이전트가 "만드는" 게 아니라 세션/스크립트 캡처, (b) 전용 에이전트 스킬 부재(써드파티 terminal-demo-generator 188★ orchestkit 내부)**. 본 카테고리는 **결이 다름** — Media 제작 자산과 분리하거나 "데모/문서" 별도 표기 권장. 본 repo 는 이미 VHS 를 자체 데모에 사용 중(중복).

---

## experimental / 제외 (★<1000 또는 비활성 또는 method 부적합)

| 도구 | repo | ★ | 사유 |
|------|------|--:|------|
| GSAP master MCP | `bruzethegreat/gsap-master-mcp-server` | 106 | ★<1000, license none. (공식 gsap-skills 9k 가 상위 호환) |
| Manim skill | `Yusuke710/manim-skill` | 71 | ★<1000 (web "329★" 주장은 미검증 — gh api 실측 71) |
| reveal.js skill | `ryanbbrown/revealjs-skill` | 341 | ★<1000 |
| ffmpeg-mcp-server | `beambuilder/ffmpeg-mcp-server` | 3 | ★<100 |
| video-audio-mcp | `misbahsy/video-audio-mcp` | 78 | ★<100 |
| mcp-video | `KyaniteLabs/mcp-video` | 38 | ★<100 |
| Video_Editor_MCP | `Kush36Agrawal/Video_Editor_MCP` | 49 | ★<100, license none |
| D2 MCP | `i2y/d2mcp` | 28 | ★<1000 (코어 D2 24.4k★ 이나 에이전트 자산 빈약) |
| Mermaid MCP (단독) | hustcc 580 / peng-shawn 228 / veelenga 164 | <1000 | softaworks mermaid-diagrams(2k) 가 상위 — 단독 MCP 불요 |
| **Motion Canvas** | `motion-canvas/motion-canvas` | 18,647 | ★충분하나 **last push 2025-02-16(~16개월 비활성)** + 전용 스킬 부재 |
| **theatre.js** | `theatre-js/theatre` | 12,458 | ★충분하나 **last push 2024-08-14(~22개월 비활성)** + 스킬 부재 |
| **Revideo** | `midrender/revideo` | 3,854 | ★충분·MIT 이나 **last push 2025-05-09(~13개월) + 전용 에이전트 스킬 부재**(라이브러리만) |
| MDX-deck | `jxnblk/mdx-deck` | 11,492 | last push 2023-01 (deprecated) |
| reveal.js / Slidev (코어) | `hakimel/reveal.js` 71.7k / `slidevjs/slidev` 47.1k | — | 라이브러리만. 본가 제작 1st-party 에이전트 스킬 부재 |
| Marp CLI (코어) | `marp-team/marp-cli` 3,626 | MIT | CLI만. softaworks marp-slide 스킬이 에이전트 자산 역할 |

---

## 카테고리 구조 제안 (Rule 2 단순성)

**ASIS**: 동영상/슬라이드 자산 = 카탈로그에 Remotion skill·frontend-slides 만 산발 + 1차 리서치 "스킬 부재" 결론.

**TOBE 옵션 비교**:

| 옵션 | 구성 | 장점 | 단점 |
|------|------|------|------|
| **A. 독립 track 신설** ("Video Production") | Remotion + frontend-slides + … | 명시적 용도 | ❌ 동영상 vetted 1개뿐 → track(N자산 묶음) 근거 약함. Rule 2 위반 |
| **B. 소형 "Media" 카테고리** (Understanding 패턴) | 슬라이드(frontend-slides, marp-slide) + 다이어그램(excalidraw, mermaid) + 동영상(Remotion) opt-in | 용도별 선택 제공, 충족된 용도(슬라이드2/다이어그램2) 중심 | 카테고리 신설 비용. 모션/녹화는 부족분 정직 표기 |
| **C. 기존 카테고리 흡수** | Remotion·frontend-slides→frontend/dev-tools opt-in, mermaid/excalidraw→문서/dev-tools | 신설 0비용, 최소 변경 | 용도별 "고르는" UX 약함(사용자 방향성과 거리) |

**추천 = B (소형 "Media" 카테고리)**, 단 **슬라이드+다이어그램(2+2=충족) 중심**으로 출범하고 동영상(Remotion)은 opt-in 1종 추가, 모션(GSAP)은 frontend 쪽이 더 맞을 수 있어 분리 검토. 사용자 방향("용도별 선택지")에 가장 부합하면서 vetted 미달 용도를 억지로 채우지 않음. C는 Rule 2 최강이나 사용자가 원한 "용도별 고르기" UX 손실.

> ⚠ GSAP·Excalidraw·Mermaid 는 엄밀히 "영상 제작"이 아니라 **웹 모션/비주얼/다이어그램**. "Media" 명칭이 동영상만 연상시키면 부적합 — "Visual & Media" 또는 슬라이드/다이어그램/영상 서브그룹 분리가 정확.

---

## 미확정 / 후속 검증 필요 (Docker 실설치 게이트)

1. **method 실설치 전부 미검증** — 아래 전 자산이 본 repo installer 경로에서 실제 resolve/설치되는지 Docker 실검증 필요(no-false-ship):
   - `remotion-dev/skills` → `skill` (single-skill repo, `--skill` 명시 필요 여부 = impeccable v26.54.1 전례)
   - `greensock/gsap-skills` → `plugin` (marketplace name `gsap-skills`, plugin name `gsap-skills`, source `./`)
   - `softaworks/agent-toolkit` → `skill` (`marp-slide`/`mermaid-diagrams`) — **단 이 repo는 `.claude-plugin/marketplace.json` 도 보유**(plugins 배열에 marp-slide/mermaid 미포함, 개별 skill로 존재) → skill method 가 맞는지 vs plugin 경로인지 확인 필요
   - `yctimlin/mcp_excalidraw` → `skill` (`excalidraw-skill`) — **MCP 서버 별도 런타임**(`npx`) 필요, agentmemory 패턴 참고
   - `presenton/presenton` → 런타임 서버 self-host(Docker) 필요 — 단순 skill/plugin 아님, npx-run/MCP 분류 정확성 미확정
2. **Remotion BUSL 정책 결정** — 사용자 고지 + vetted 큐레이션 가부 = 정책 결정(미결, 1차와 동일). 정정: 이전 doc "custom 라이선스" → 정확히 **BUSL**(Business Source License).
3. **softaworks/agent-toolkit 신뢰도** — 2,010★ 써드파티 멀티스킬 repo(43 skills). 단일 자산 2개(marp/mermaid)만 쓸지 vs 통째 도입 시 범위 과대 — 선별 도입 권장.
4. **카테고리 명칭/배치** — GSAP(웹모션)·다이어그램이 "영상"과 다른 결 → "Media" 단일 묶음 vs frontend/dev-tools 분산 = 사용자 결정 사항.
5. **화면녹화 제외 확정** — VHS/asciinema 는 제작 아닌 캡처 + 본 repo 자체 사용 중복 → 자산화 비권장(정직 표기).

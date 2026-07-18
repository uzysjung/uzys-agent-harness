# 자산 축 판정 — pattern-guide vs operational-fact (Lean 큐 ④)

> 2026-07-18 · 기준 v26.105.0 (카탈로그 62) · ADR-032 Decision "축소는 자산 단위" + #213 재정의의 실행.
> 상태: **결정 완료 — 사용자 컨펌 2026-07-18**: A·B·C·D·E 전부 승인 + **사용자 추가 결정: impeccable 도 강등**
> ("frontend-design anthropic official 넣으면 impeccable, web-design-guidelines 강등 가능" — 생성↔리뷰
> 보완재 논리는 권고이지 결합이 아님). F 유지. **v26.106.0 으로 구현** (카탈로그 61, ADR-035).

## 판정 러브릭

**축 (자산의 핵심 가치가 어디에 있는가):**

| 축 | 정의 | 모델 향상의 영향 |
|---|---|---|
| **O** operational-fact | 외부 세계의 사실/계약 — CLI 플래그·인증 플로우·vendor 제품 계약·registry 경로 | 무관 — 모델 밖에서 드리프트, 큐레이션·검증 가치 유지 |
| **P** pattern-guide | 일반 소프트웨어 지식/패턴 전수 — 프리트레이닝이 이미/점점 커버 | 한계가치 잠식 (**T2 — 가설**, 검증 경로 = HITO A/B) |
| **H** hybrid | 패턴이되 특정 vendor 계약에 결박 (예: RLS 가이드, React 19 패턴) | 부분 — vendor 갱신분은 모델 컷오프 밖 |
| **T** tool | 지식 자산이 아니라 실행 도구/CLI/런타임 설치 | 무관 |
| **M** methodology | 1st-party 방법론/수단 — **ADR-033/034 기판정** (코어 8 + 수단 3 + 내부 템플릿) | 본 판정 제외 |

**액션 규칙 (ADR-032 원칙에서 유도):**
1. **opt-in 자산 = 세션 컨텍스트 비용 0** → 제거는 선택권만 죽임 → 축만 기록, 원칙 keep (M5 축B에서 star/사용 데이터로 재론).
2. **기본 설치(vetted/official + 조건 매치) P 자산** → 강등 후보. 기본 발자국이 실질 Lean 대상 — 설치된 plugin/skill descriptor는 매 세션 상주 (외부 자산이라 비용 실측 불가 — v26.103.0 unmeasured 설계, 정직 표기).
3. **중복** (같은 용도 2자산 동시 기본 설치) → 실측 근거 있는 쪽만 기본 유지.
4. **1st-party 대체재** 보유 → 제거 후보.
5. 근거 없는 "안 쓸 것 같다" 금지 (CLAUDE.md 안티패턴) — 모든 액션 후보 행에 검증 가능한 근거 명시. 순수 P 단독 근거 강등은 **T2 가설 전제**임을 행에 표기.

**전제 사실 (코드 검증):** experimental 자산은 조건 매치여도 설치되지 않는다 (`shouldInstallAsset` v26.71.1 게이트, `src/external-assets.ts:1133` — opt-in 전용). 따라서 railway-skills·playwright-skill·architecture-decision-record·revealjs 는 **이미 사실상 opt-in** — 기본 발자국이 아니다.

**실측 데이터 (2026-07-18):** npm 주간 다운로드 — vercel **2,789,285** · supabase **2,169,062** · netlify-cli **275,984** (api.npmjs.org last-week). experimental star 스냅샷(entry 주석) — railway 268 · playwright 264 · revealjs 347 · orchestkit(ADR) 179. 사용 신호(설치 로그/텔레메트리): **없음** — 외부 사용자 ~0 (M2 게시 보류 중).

## 전수 판정표 (62)

기본 = 조건 매치 시 기본 설치 (experimental 게이트 통과분만). 액션 없는 행 = keep.

### 기본 설치군 (실질 Lean 대상)

| id | 축 | 설치 | 판정 | 근거 |
|---|---|---|---|---|
| polars-K-Dense | H | 기본 data,full | keep | Polars 1.x API 활발 드리프트(라이브러리 계약), K-Dense 26k★ |
| dask-K-Dense | H | 기본 data,full | keep | 분산 스케줄러/클러스터 설정 = 운영 지식 포함, 데이터 트랙 목적 자산 |
| python-resource-management | **P** | 기본 data,full | **강등 후보 A** | 일반 Python 메모리/CPU 패턴 — 프리트레이닝 핵심 영역. 순수 P 근거 = **T2 가설 전제** |
| python-performance-optimization | **P** | 기본 data,full | **강등 후보 A** | 일반 profiling·vectorize 패턴 — 동일. **T2 가설 전제** |
| anthropic-data-plugin | H | 기본 data,full | keep | Anthropic official 유지보수 + 시각화/SQL 도구성 |
| vercel-cli | T | 기본 supabase,full | keep | 2.79M dl/주 실측 — csr-supabase 트랙 주 배포처 |
| netlify-cli | T | 기본 supabase,full | **강등 후보 B (중복)** | 같은 용도(배포 CLI) 2종 동시 기본. netlify 276k vs vercel 2.79M = **10:1 실측** → 1종만 기본, netlify 는 opt-in |
| supabase-cli | T | 기본 supabase,full | keep | 트랙 정의 자산, 2.17M dl/주 |
| supabase-agent-skills | H | 기본 supabase,full | keep | vendor-official — RLS/auth/edge = Supabase 제품 계약 |
| postgres-best-practices | H | 기본 supabase,full | keep | supabase-official 유지보수, 트랙 핵심 도메인 |
| impeccable | H(P-lean) | 기본 6트랙 | keep | frontend-design 보완재(생성↔리뷰 짝, v26.92.0 결정), pbakaus 31k★ |
| frontend-design | H | 기본 dev | keep | Anthropic official, v26.92.0 의도적 기본 추가 |
| react-best-practices | H | 기본 react트랙 | keep | React 19/RSC 등 모델 컷오프 이후 패턴 — vercel-labs 활발 유지보수 |
| shadcn-ui | O/H | 기본 react트랙 | keep | shadcn registry/CLI 계약 결박 — 컴포넌트 copy 워크플로 |
| web-design-guidelines | **P** | 기본 react트랙 | **강등 후보 D (T2 가설 전제)** | 순수 P (일반 시각 위계·색·간격 가이드) — 검증자 지적으로 정정: taste 3종(생성·리뷰·가이드라인)은 **역할이 달라 중복이 아님**. 실질 근거는 A 와 동일한 T2 가설 단독 — A 와 같은 등급으로 취급할 것 |
| find-skills | T | 기본 dev | keep | 설치 스킬 검색 메타 도구 — 드리프트 무관 운영성, vercel-labs 20k★ |
| agent-browser | T | 기본 dev | keep | Playwright 래퍼 CLI, vercel-labs 34k★ |
| karpathy-coder | H/T | 기본 dev | keep | 결정론 도구(pre-commit hook·checker) + 리뷰어 — 도구성 우세 |
| product-skills | **P** | 기본 **9트랙** | **축소 후보 C (트랙)** | PM 스킬 15종(RICE·PRD·UX리서치)이 **모든 dev 트랙** 기본 — dev 사용자 발자국 과대. PM/executive 계열 트랙 한정으로 축소, dev 트랙은 opt-in |
| anthropic-document-skills | T/O | 기본 exec,full | keep | 문서 포맷(pptx/docx/xlsx/pdf) 생성 도구, official |
| c-level-skills | P | 기본 exec,full | keep | executive 트랙의 존재 이유인 자산 — 트랙 목적성 우선 |
| business-growth-skills | P | 기본 exec/growth | keep | 동일 (트랙 목적 자산) |
| finance-skills | P | 기본 exec,full | keep | 동일 |
| pm-skills | P | 기본 PM트랙 | keep | PM 트랙 목적 자산 |
| marketing-skills | P | 기본 growth트랙 | keep | growth 트랙 목적 자산 (44종) |
| research-summarizer | P | 기본 growth트랙 | keep | growth 트랙 목적 자산 |

### 사실상 opt-in (experimental 게이트) — M5 축B 합류

| id | 축 | ★스냅샷(2026-05~06) | 판정 |
|---|---|---|---|
| railway-skills | O | 268 | keep-experimental — 배포 계약(O축)이라 큐레이션 가치 유지. M5 star 재실측 후 승격/제거 |
| playwright-skill | P | 264 | keep-experimental — P축 기록. M5 재실측 후 판정 |
| revealjs | O/P | 347 | keep-experimental — M5 재실측 후 판정 |
| architecture-decision-record | **P** | **179** | **제거 후보 E** — 하드 기준 2개: ① 최저 star(179, 80+ 스킬팩 중 1개 추출) ② **1st-party 대체재** — ADR 템플릿·status flow 는 change-management rule + 설치 스캐폴드가 이미 제공(ADR-034 도 명시: "ADR 작성 관행은 설치 문서/스캐폴드가 안내") |

### opt-in 군 (컨텍스트 비용 0 — 축 기록만, 원칙 keep)

| id | 축 | 비고 |
|---|---|---|
| superpowers · addy-agent-skills · wshobson-agents · openspec · bmad-method | P/M | **ADR-032 기판정** — opt-in 유지 확정(제거·강등 기각). wshobson 은 T3 기준 부합 개별 판정 |
| claude-video · understand-anything · agentmemory | T | 인지 증강 도구/런타임 (v26.78.0) |
| frontend-slides · marp-slide · mermaid-diagrams · gsap-skills · remotion · ppt-master · ppt-generation · web-video-presentation | T/O/H | Visual & Media — 산출물 생성 도구 + 포맷 계약. mermaid 는 P-lean(문법 프리트레이닝 강함)이나 authoring 워크플로 도구성 |
| marketingskills | P | marketing-skills 와 동명이물 **병존 기결정**(v26.91.0 ADR — id 상이, 충돌 없음) |
| trailofbits-skills | H | ToB 보안 리뷰 전문성 — 니치 유지 |
| ecc-plugin | P/M | 대형 팩 — opt-in + ecc-prune 큐레이션 짝 |
| ecc-prune | T | 로컬 스크립트 (option 게이트) |

### 기판정 (M — ADR-033/034, 본 축 제외)

dev-method 코어 8 (multi-persona-review · gap-analysis-e2e · ultracode-service-audit · asis-tobe-decision · compaction-handoff · northstar-roadmap · harness-health-audit · recurrence-prevention) + 수단 3 (model-orchestration · gemini-consult · codex-consult) + tauri-desktop (O 템플릿, opt-in).

## 액션 후보 요약 (사용자 컨펌 대상)

| # | 액션 | 대상 | 근거 강도 | 효과 |
|---|---|---|---|---|
| A | 기본→opt-in 강등 | python-resource-management · python-performance-optimization | 순수 P (**T2 가설 전제** — HITO A/B 미검증 명시) | data **카테고리** 기본 5→3 |
| B | 기본→opt-in 강등 | netlify-cli | 중복 + **10.11:1 dl 실측** | 배포 CLI 기본 2→1 (vercel 유지) |
| C | 트랙 축소 | product-skills → project-management 트랙 한정 (현행 = dev 8 + PM) | P + 9트랙 발자국 | dev 트랙 기본에서 PM 15종 제외 |
| D | 기본→opt-in 강등 | web-design-guidelines | 순수 P (**T2 가설 전제** — 검증자 정정: taste 3종은 역할 상이, 중복 아님) | react 트랙 taste 3→2 |
| E | 카탈로그 제거 | architecture-decision-record | 179★ + 1st-party 대체재 (하드 기준 2) | 카탈로그 62→61 |
| F | 현행 유지 | railway · playwright · revealjs (experimental) | star 재실측 = M5 축B | — |

승인된 액션은 v26.106.0 으로 구현 (BREAKING 표기 + Surface parity 매트릭스 + SOD 리뷰). 미승인 항목은 본 문서에 기각 사유와 함께 기록.

## 정직성 명시

- **본 판정표는 독립 적대 검증 통과** (2026-07-18, fresh 검증자): 62 전수 커버리지 스크립트 대조 ✓ · experimental 게이트 코드 실증 ✓ · 조건/트랙/tier 전수 대조 ✓ · npm dl 재fetch 일치(10.11:1) ✓ · **E 의 1st-party 대체재 = 사실**(change-management 룰이 COMMON_RULES 로 전 트랙 무조건 설치, ADR 템플릿+status flow 완비 — manifest.ts:59 실증) ✓. 검증자 지적 반영: D 를 T2-단독 등급으로 정정, star 는 스냅샷 표기, C 문구 정밀화.
- star 수치는 2026-05~06 스냅샷 — E 기준①(최저 star)은 stale 데이터 기반 (load-bearing 은 기준② 대체재). M5 에서 재실측.
- dev-method 코어 8종(최대 기본 발자국)은 ADR-034 기판정으로 본 Lean 판정에서 제외 — 비대칭임을 명시.
- 사용 신호 데이터 없음 (텔레메트리 없음, 외부 사용자 ~0) — 판정은 자산 성격·실측 dl/star·중복·대체재 기준.
- 순수 P 강등(A)은 T2("모델 향상→패턴 가이드 불필요") **가설**에 기댐 — ADR-032 가 정한 검증 경로(HITO A/B)를 거치지 않았다. 그래서 제거가 아닌 **강등**(선택권 유지)만 제안.
- 외부 자산 descriptor 의 세션 상주 비용은 실측 불가(unmeasured) — 강등 효과는 방향만 주장, 수치 주장 없음.

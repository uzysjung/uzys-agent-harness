# #755 에이전트 작업 방식 — 상주 지시 설계

- 작성: 2026-10-12 · 설계 레인(단일 에이전트) · 기준 커밋 main = 88096fe (v26.168.0 + #763~#765) · **2판** — 1판(새 스킬 설계)은 사용자 지시로 폐기하고 **상주 지시층**(배포 앵커 `templates/CLAUDE.md` · CLI 별 `AGENTS.md` · `templates/rules/*.md`)에 넣는 설계로 바꿨다. 1판에서 가져온 것은 §1.1 관측과 §2 대조표다.
- 입력: 이슈 #755 본문(댓글 0) · 번들 스킬 5종 전문(`templates/skills/{gh-issue-workflow,objective-brief,north-star,model-orchestration,audit-service-gaps}`) · 배포 앵커 `templates/CLAUDE.md` · 배포 룰 7종 전문 · `AGENTS.md.template` · 배선 코드(`src/manifest.ts` `resolveRules` · `src/rules-port.ts` · `src/agents-md-render.ts` · `src/agents-md-transform.ts` · `src/antigravity/transform.ts` · `src/context-cost.ts` · `src/external-assets.ts` `CONTINUOUS_SKILLS`) · 게이트(`tests/context-cost-ratchet.test.ts` · `tests/resident-reach-4cli.test.ts` AGENTS.md ratchet · `tests/resident-rule-reference-liveness.test.ts` · `tests/docs-supply-chain.test.ts`) · ADR-085 · ADR-087 · ADR-088 · ADR-091 · ADR-105 · ADR-109 · `docs/NORTH_STAR.md` §1·§3·§4.1 · `docs/CONTEXT-FILES.md` §3 · `docs/research/vendor-signals.md` · 루트/`.claude/` CLAUDE.md · 이 리포의 실제 작업 흐름(`gh api` 로 마일스톤 11개 · 라벨 · 부모 이슈 · wiki 실측)
- **실행한 것**: 후보 문안 4종을 실제로 써서 스크래치패드의 `templates/` 사본 5개에 넣고, `runInstall` 로 **실제 설치**(tooling · `claude` 단독 / `codex` 단독 / `codex+opencode+antigravity`)를 돌려 `residentCost`(= `npm run cost:report` 와 같은 함수)와 산출물 `AGENTS.md` 바이트를 잤다(§3.1, 부록 B). `gh` 조회 · `git ls-remote`(대조군 포함). **리포 파일은 이 문서 하나만 만들었다** — 코드 · 템플릿 · 커밋 없음.
- 합격 기준(팀 리드 브리프 2판): 요구 6가지 대조표 · 배치 비교(실측 비용 · CLI 도달 · Codex 예산 · 중복/충돌) + 추천 · 넣을 문장 전문(ASIS→TOBE) + 문장별 근거 · 관찰 신호 · 결정 필요.

---

> **최종 상태(2026-10-12)**: §4 의 3문장은 외부 모델 토론으로 고쳐졌고, 비교 실험을 거쳐 다른 문안으로 채택됐다 — 채택 문안·근거 = ADR-110 · `docs/research/issue-755-debate-2026-10-12/`. 아래 §4 문안은 토론 입력(원안)이다.


## 0. 한 줄 판정과 설치자에게 달라지는 것

**추천 = ⓓ. 배포 앵커 `templates/CLAUDE.md` §2 끝에 원칙 3문장(530자 · 실측 +133 토큰/세션)을 더하고, 절차(이슈 본문 · 마일스톤 · wiki · 브리프 형식)는 이미 모든 트랙에 기본 설치되는 `gh-issue-workflow` · `objective-brief` 에 그대로 둔다.** 새 룰 파일(ⓑ)과 기존 룰 절 추가(ⓒ)는 같은 뜻을 1.4배 비용으로 내고 Claude Code 에서만 `paths:` 지연 로드가 가능한데 이 지시는 파일 유형에 묶이지 않는다; 앵커 전체판(ⓐ)은 2.4배 비용으로 **절차**를 상주시킨다 — 벤더 지침("multi-step procedure 는 스킬로")과 북극성 §1("관측 없는 지시는 스킬로 내려간다")이 반대 방향이다. 단 앵커는 **사용자 문안 축자**다(ADR-091 결정 1 — "이 리포가 문장을 보태지 않는다") → 이 문서의 3문장은 사용자가 읽고 고쳐 **자기 문안으로 채택**해야 들어간다(§7 D1).

| 누구 | 전 | 후(ⓓ) |
|---|---|---|
| **기획서 · 설계서를 들고 "개발 시작"이라 말하는 설치자**(4 CLI 공통) | 앵커 §1 은 "사용자 목표 · 핵심 사용 흐름에서 출발"까지만 말한다. 문서가 있어도 에이전트는 **대화에서** 범위를 다시 세우고, 기능 목록을 그대로 작업으로 옮기거나 거대한 작업 하나를 만든다 | 앵커가 매 세션 말한다: 문서(또는 합의된 브리프)가 있으면 **거기서** 작업을 꺼내고, **사용자 플로우** 단위로 묶고, **한 변경으로 끝나고 그 설명만 읽고 착수할 수 있는** 단위로 자른다. 묶음은 이름 문장("사용자가 X 를 할 수 있다")이 참이 될 때 끝난다 |
| **브리프(task-brief)로 기능을 고치는 설치자** | 브리프는 `objective-brief` 가 만들지만 그것이 작업 단위와 어떻게 이어지는지는 아무 데도 없다 | 같은 문장이 "합의된 브리프"를 문서와 같은 입구로 둔다. 브리프 → 이슈 칸 대응 같은 **절차**는 상주에 넣지 않는다(§4.3 — 스킬 몫) |
| **작업 중의 에이전트** | 결정과 수용 증거가 채팅에 남고 다음 세션이 다시 묻는다 | "결정과 수용 증거는 프로젝트가 작업을 추적하는 자리에" — 이슈 · 마일스톤 · 추적 문서. 어느 자리인지는 그 프로젝트가 정하고 쓰기 규칙은 `gh-issue-workflow` 가 정한다 |
| **Codex 설치자** | `AGENTS.md` 20,522 B(32 KiB 합계 예산의 63%, tooling 실측) | 21,054 B(64%). 비증가 ratchet(23.0 KiB)까지 여유 3,030 → 2,498 B |
| **executive · project-management · growth-marketing 설치자** | — | 앵커는 전 트랙이라 같은 3문장을 받는다(+133 토큰). 첫 절이 조건문("문서가 있으면")이라 해당 없으면 비활성이지만 비용은 든다 — §9-6 |
| **wiki 를 쓰는 설치자** | `gh-issue-workflow` §wiki 미러 | **변화 없음** — 상주에 wiki 를 넣지 않는다(§4.3 빼기 ③). 미러 시점은 스킬 몫 |

---

## 1. 확인한 사실 — 설계의 바닥

### 1.1 사용자가 실제로 일하는 방식(이 리포 관측, 2026-10-12)

| 관측 | 근거 |
|---|---|
| 마일스톤 이름 = **버전 + 설치자가 할 수 있게 되는 것 한 문장**. 11개 중 9개 `vX — …`, 2개 `… — 설계`(결정이 큰 묶음의 선행 마일스톤 #513 · #755) | `gh api repos/{owner}/{repo}/milestones?state=all` |
| 마일스톤 크기 1~55 이슈(중앙값 10) | `gh issue list --milestone` 집계 |
| **부모/하위 이슈 0건**, 라벨 `P0 P1 P2 · decision-pending ready blocked in-progress` 실재 | GraphQL `parent`/`subIssuesSummary` 최근 100건 · `gh label list` |
| 큰 묶음은 **설계서 → 독립 검증 보고 → 이슈별 PR → 릴리즈 커밋**(v26.168.0: #756 → #757 #758 #759 → #762) | `gh pr list --state merged` · `docs/plans/v26.168.0-model-routing-design*.md` |
| **이 리포는 wiki 를 쓰지 않는다** — `has_wiki: true` 지만 wiki 리포 없음(대조군 본 리포 `ls-remote` exit 0 · 대상 128 "Repository not found") | `git ls-remote …uzys-agent-harness.git HEAD` / `….wiki.git` |
| `issue_tracking: enabled` — `gh-issue-workflow` 적극 단계 | `docs/SPEC.md:4` |

→ wiki 와 "에픽" 어휘는 **이 리포 밖**(사용자의 다른 프로젝트)에서 온 요구다. 도그푸드 관측이 없다.

### 1.2 상주 지시층이 어떻게 깔리고 · 무엇이 막나

| 사실 | 설계에 미치는 것 | 근거 |
|---|---|---|
| **앵커 `templates/CLAUDE.md` 는 사용자 #463 문안 축자 — "이 리포가 문장을 보태지 않는다. 다음에 사용자가 앵커를 바꾸려면 이 리포에 이슈로 문안을 준다"** | 앵커 편집(ⓐ·ⓓ)은 **사용자 문안 채택**이 전제다. #755 가 그 이슈이고, 이 문서의 문장은 사용자가 고쳐 쓸 초안이다 | ADR-091 결정 1 |
| 앵커는 4 CLI 에 **같은 본문**으로 간다 — Claude Code `CLAUDE-uzys-harness.md`(루트 `CLAUDE.md` `@import`) · Codex · OpenCode · Antigravity 는 공유 `AGENTS.md` 의 `## Project Rules` 안(Antigravity 는 frontmatter 없이 always_on) | 앵커 문장은 **트랙 · CLI 구분 없이 전원**이 받는다 | `docs/CONTEXT-FILES.md:83-92` · `src/antigravity/transform.ts:8` · 실측 산출물 `AGENTS.md:75-97`(§2 자리) |
| 룰은 **이름 목록**으로 깔린다(`COMMON_RULES` · `DEV_RULES` · `UI_RULES` · `TRACK_RULES`). `templates/rules/` 에 파일만 두면 **설치되지 않는다** | 새 룰(ⓑ)은 `src/manifest.ts` 코드 변경 + 항목 수 +1 | `src/manifest.ts:96-150` · **실측**: 변형 B1·B2 설치 결과 룰 6종 그대로(부록 B) |
| 룰의 CLI 도달: Claude `.claude/rules/<name>.md`(`paths:` 면 그 파일을 만질 때만 로드) · Codex · OpenCode `AGENTS.md` `## Harness Rules` 인라인(**frontmatter 를 벗겨 상시** — `paths:` 무효) · Antigravity `.agents/rules/<name>.md`(`paths:` → `trigger: glob`, 없으면 `always_on`) | `paths:` 지연 로드는 Claude · Antigravity 한정. 이 지시는 파일 유형이 없어 `paths:` 를 쓸 자리가 없다 | `src/rules-port.ts:54-66` · `src/antigravity/transform.ts:77-80` · 루트 CLAUDE.md 함정 3 |
| 지시문 축(룰 + CLAUDE.md) ratchet — **트랙마다** `tokens`·`items` 상한. 늘리면 red → `npm run cost:baseline` + 커밋 본문에 사유 | 어느 안이든 baseline 갱신이 따른다. "작을수록 좋은 축이 아니다 — 불필요한 지시문이 있나로 판단"(사용자 확정 2026-08-30) | `context-cost-baseline.json` `axes.directive` · `tests/context-cost-ratchet.test.ts:80-130` |
| **1차 비용 축은 토큰이 아니라 항목 수**(v26.140.0) — 교차참조 · 모순 · drift 는 항목 수에 비례 | 같은 토큰이면 **항목을 늘리지 않는 안**(앵커 문장)이 룰 파일 신설보다 싸다 | `src/context-cost.ts:224-236` |
| Codex `project_doc_max_bytes` 32 KiB 는 **합계** 상한 — 닿으면 뒤를 조용히 끊는다. 리포 ratchet 23.0 KiB(23,552 B). **실측 현재 20,522 B(codex 단독 · tooling) = 62.6%, 여유 3,030 B** | 어느 안도 ratchet 안이지만 ratchet 은 "늘리려면 무엇을 줄일지 함께 정한다" 규율이다 | `tests/resident-reach-4cli.test.ts:404-410` · 부록 B(메모리의 "74%"는 옛 수치 — 이번 실측이 대체) |
| 상시 스킬 안내는 앵커가 아니라 **설치기가 프로젝트 블록에 쓴다**(`CONTINUOUS_SKILLS`, 깔린 것만). `objective-brief` 는 거기서 빠졌다(피처 규모 이상에만) | 스킬을 가리키는 줄을 앵커에 넣지 않는다. 가리키려면 `CONTINUOUS_SKILLS`(코드) — §7 D3 | ADR-085 결정 2 · ADR-088 |
| 벤더 지침 — *"If an entry is a multi-step procedure … move it to a skill"* · Anthropic 하네스 글 — *sprint 구조를 통째로 제거하고도 성능 유지* | 상주에는 **판단 기준**만, 절차는 스킬에 | `docs/research/vendor-signals.md:32·35` |
| 북극성 §1 "상주의 근거" — 지시는 **관측**이 있어야 상주. 관측 없는 지시는 스킬로 내려가거나 은퇴(ADR-090) | 이 문장의 관측은 사용자 1인의 작업 방식이다 — §6 신호와 sunset 을 붙인다 | `docs/NORTH_STAR.md` §1 · §4.1 |

### 1.3 기존 자산이 각각 소유하는 것(겹침 판정의 기준)

`gh-issue-workflow` — 활성 3단 · 모드와 원격 쓰기 승인 · 이슈 본문 템플릿 · 준비도 8줄 · 방향성/전제 · 코멘트→본문 · 라벨/마일스톤 축 · 재조정 · 백로그→착수 · PR 컨벤션 · VERIFY · **wiki 미러**(`SKILL.md:29-343` · `references/hierarchy.md §8`) / `objective-brief` — 브리프 9필드 · 인바운드 · 아웃바운드(`SKILL.md:23-158`) / `north-star` — 방향 · 로드맵 6단계(Now/Next/Later 문서까지) / `model-orchestration` — 레인 · 모델 · 독립 리뷰의 **판단 원칙** / 배포 룰 `Delivery` — 검증의 **시점**("어느 정도까지는 Testing, 언제는 이 룰") · `Change Boundaries` — 인간 결정 경계 · 결정 기록 · `Documentation Boundaries` — 한 사실 한 문서 · 추적 문서 동기화.

---

## 2. 요구 6가지 대조 — 무엇이 이미 있고, 무엇을 어디에 두나

| # | 사용자 요구(이슈 원문) | 기존 자산이 덮는 부분(파일:줄) | 비어 있는 것 | **이 설계의 배치** |
|---|---|---|---|---|
| R1 | 초기 개발이면 **서비스 정의서·기획서·설계서** 기반 | 서비스 정의 = 북극성(`north-star/SKILL.md:17`) · 기획/설계의 하네스 어휘 = `docs/SPEC.md`(`templates/hooks/session-start.sh:18-25` 세션마다 안내 · `templates/scripts/spec-drift-check.sh:77-87`) · 앵커 §1 "Start from the intended user's goal, the core usage flow … ground consequential decisions in project evidence"(`templates/CLAUDE.md:12-14`) | **문서에서 작업을 꺼낸다**는 한 문장. 앵커 §1 은 출발점을 "사용자 목표"로 말하지 "문서"로 말하지 않는다 | **상주** S1 |
| R2 | 기능 개발·개선이면 **task-brief** 기반 | `objective-brief/SKILL.md:3-11`(task-brief 트리거 · 인바운드 정규화 `:98-120`) · 턴을 넘는 요청 → 이슈 초안(`gh-issue-workflow/SKILL.md:65-88`) | 브리프가 문서와 **같은 입구**라는 선언 · 브리프 → 이슈 칸 대응(두 스킬이 서로를 모른다) | **상주** S1("합의된 브리프") · 대응표는 **스킬 몫**(후속 §10) |
| R3 | **GitHub wiki** 로 문서화하고 활용 | `gh-issue-workflow/SKILL.md:319-343` · `references/hierarchy.md:190-260` **전부**(조건 · 배너 · 목표층만 · 푸시 = WRITE) | 미러 **시점** 두 줄 · 사용자 의도가 "wiki 가 원본"이면 §8 과 충돌 | **빼기**(상주 아님) — 조건부 · 도구 종속 · 도그푸드 0. S3 의 "프로젝트가 작업을 추적하는 자리"가 포괄. 의도 확인 §7 D4 |
| R4 | 업무 단위에 **사용자 서비스 플로우 관점 · 기능 구현 관점** | 없음(`audit-service-gaps:50` EXPERIENCE 렌즈는 갭 탐지용 · `ship-checklist.md:5`·`reviewer.md:19` 의 "사용자 씬"은 검증 입력) | **두 관점을 작업 단위의 두 층으로** — 플로우 = 묶음, 구현 단위 = 항목 | **상주** S2(핵심) |
| R5 | **구현 속도·토큰 효율** 관점의 이슈·마일스톤 | 준비도 — 범위 좁음 +16.4%p · 자족 +16.7%p · 길이 단조 감소(`gh-issue-workflow/SKILL.md:150-175`, **머지율** 실증) · 순서 3축(`operating-model.md P4`) · 병렬 단위 = 독립 소유 가능 단위(`model-orchestration/SKILL.md:81-88`) | 쪼개기 **판정 기준**이 한 자리에 없다 | **상주** S2 에 둘(한 변경으로 끝 · 그 설명만으로 착수) — 실증이 있는 둘. 나머지(파일·계약 비겹침 · 같은 파일군 합치기 · 미확정 분리)는 **빼기**(§4.3 이유) |
| R6 | 그에 맞춰 **AI 에이전트가 일하도록** | 착수 전 읽기 `§1` · 방향성/전제 `§4-5` · 백로그→착수 `§9` · PR · VERIFY `§10-11`(`gh-issue-workflow/SKILL.md:117-260`) · 레인/독립 리뷰 `model-orchestration/SKILL.md:122-152` · 배포 에이전트 `implementer`·`reviewer` · 앵커 §6 "Work autonomously through the authorized outcome" | 순서대로 돌리고 **결정 · 증거를 채팅 밖에** 남긴다는 원칙 · 묶음 종료 판정 | **상주** S2 끝(묶음 종료) · S3(순서 · 기록 자리). 루프의 단계 · 명령은 **스킬 몫** |

---

## 3. 배치 비교 — 네 안을 실제로 써서 잰 값

### 3.1 측정 방법(재현 가능)

후보 문안을 실제로 썼다(ⓐ 1,290자 · ⓓ 530자 · ⓑ/ⓒ 공통 룰 본문 712자 — 전문은 부록 A). 스크래치패드에 `templates/` 사본 5개를 만들어 각각 넣고(ⓐ·ⓓ = 앵커 §2 끝 · ⓑ1 = `rules/work-units.md` · ⓑ2 = 같은 파일 + `paths: docs/**, **/*.md` · ⓒ = `rules/ship-checklist.md` 끝 `## Work Units`), `runInstall({harnessRoot: <사본>, spec: {tracks:["tooling"], cli}})` 로 임시 디렉터리에 설치해 ⓐ `residentCost(entries, <사본>, ["claude"])` — `npm run cost:report` 와 같은 함수 · 같은 단위(chars/4 규약) ⓑ 산출물 `AGENTS.md` 바이트(codex 단독 · codex+opencode+antigravity) ⓒ `.claude/rules/` · `.agents/rules/` 파일 목록을 읽었다. 기준선은 리포 `templates/` 그대로. 스크립트 · 원시 JSON 은 부록 B(스크래치패드는 날짜가 바뀌면 비워지므로 수치는 여기 옮겨 적었다).

### 3.2 결과

| | 기준선 | **ⓐ 앵커 전체판** | **ⓑ 새 룰 파일** (paths 없음 / `docs/**`) | **ⓒ Delivery 룰에 절 추가** | **ⓓ 앵커 원칙 3문장(추천)** |
|---|---|---|---|---|---|
| 문안 | — | 영어 8문장 1,290자 — 추출 · 묶음 · 단위 신호 · 순서 · 루프 · wiki | 한국어 712자(제목 포함 727자) | 같은 712자 | 영어 3문장 530자 |
| **지시문 상주(tooling, 토큰/세션)** | 3,830 · 8개 | **4,153 (+323)** · 8개 | **≈4,013 (+183)** · **9개**(실측은 ⓒ 로 대신 — 아래 ※) | **4,012 (+182)** · 8개 | **3,963 (+133)** · 8개 |
| 어느 트랙이 무나 | — | 앵커 = **전 트랙**(executive 2,808 → 3,131) | `DEV_RULES` 면 개발 트랙만, `COMMON_RULES` 면 전 트랙 | `ship-checklist` = `DEV_RULES` → **개발 트랙만** | 앵커 = **전 트랙**(executive 2,808 → 2,941) |
| `AGENTS.md` 바이트 — codex 단독 (32 KiB 합계 예산 · ratchet 23,552) | 20,522 (62.6%) · 여유 3,030 | 21,814 (66.6%) · 여유 1,738 | ≈22,17x (67.7%) · 여유 ≈1,38x | 22,165 (67.6%) · 여유 1,387 | **21,054 (64.3%) · 여유 2,498** |
| `AGENTS.md` 바이트 — codex+opencode+antigravity | 20,618 | 21,910 (+1,292) | ≈ +1,650 | 22,261 (+1,643) | **21,150 (+532)** |
| CLI 별 도달 | — | 4 CLI 동일 본문(앵커) | Claude `.claude/rules/`(paths 면 그 파일 만질 때만) · Codex/OpenCode 인라인 **상시**(paths 무효) · Antigravity `always_on`/`glob` | ⓑ 와 같음(`ship-checklist` 는 paths 없음 → 전부 상시) | 4 CLI 동일 본문(앵커). **실측**: 3-CLI 산출물 `AGENTS.md` §2 자리에 문장 존재 |
| 코드 변경 | — | 없음(템플릿만) | **`src/manifest.ts` 룰 목록 +1 필수**(파일만 두면 안 깔린다 — 실측) · 신규 룰 update 전파는 기존 경로(`tests/resident-reach-4cli.test.ts:413`) | 없음 | 없음 |
| 게이트 영향 | — | `cost:baseline`(전 트랙) · AGENTS ratchet 안 · **ADR-091 D1 개정** | `cost:baseline` · 항목 수 +1 · 룰 열거 테스트 13개 파일 점검(`manifest` · `base-track` · `resident-cost-honesty` …) · `docs/REFERENCE.md` 룰 표기 | `cost:baseline` · Delivery 룰 canary 무관 | `cost:baseline`(전 트랙) · AGENTS ratchet 안 · **ADR-091 D1 개정** |
| 기존 원칙과 중복·충돌 | — | 루프 문장이 `gh-issue-workflow` §1·§9-11 과 **중복**(두 벌) · wiki 문장이 §8 과 중복 · "ask once" 는 앵커 §2 "Involve the user when…" 과 겹침 | 룰은 "경계"(Safety · Boundaries · Delivery)인데 본문이 **절차**다 — 성격이 다른 7번째 룰 · 쓰기 규칙 문장이 `gh-issue-workflow` 승인 규칙과 두 벌 | Delivery 룰의 자기 정의("그 결과가 **언제** 있어야 하는지")와 어긋남 — 검증 시점 룰에 작업 쪼개기가 들어간다 | §1 "core usage flow" 어휘 재사용(일관) · §3 "coherent solution over an arbitrarily small diff" 와 **긴장 1건**(§4.2 S2 근거에서 해소) · 스킬과 중복 0 |
| 설치자가 체감하는 차이 | — | 문서를 주면 쪼개기 · 루프까지 한 번에 지시받는다 — 다만 그 절차는 스킬이 이미 더 자세히 갖고 있다 | 룰 목록에 "Work Units" 한 장이 늘어 **무엇이 룰인지** 한눈에 보인다. Claude Code 설치자는 `paths:` 를 쓰면 코드 작업 중에는 안 읽힌다(그게 필요한 순간인데) | Delivery 를 읽을 때 같이 읽는다 | 매 세션 원칙 3문장. 절차는 문서/브리프를 들었을 때 스킬 descriptor 가 받는다 |

※ ⓑ 는 `src/manifest.ts` 를 바꾸지 않고는 설치되지 않아(**B1 · B2 둘 다 실측 룰 6종 그대로**) 상주 실측이 불가능했다. 같은 712자 본문을 Delivery 안에 넣은 ⓒ 가 **+182 토큰 · +1,643 B** 였고, ⓑ 는 거기에 H1 한 줄(`# Work Units`, ⓒ 의 `## ` 보다 1자 짧다)과 **항목 1개**(룰 8→9 · Antigravity 파일 6→7 · Claude 룰 6→7)가 더해진다. ⓑ2 의 `paths:` 는 `cost:report` 가 룰 토큰을 파일 존재로 세므로 **보고 수치는 ⓑ1 과 같고**, 실제 로드만 Claude · Antigravity 에서 조건부가 된다.

### 3.3 추천 ⓓ — 이유

1. **비용은 넷 중 최소**(+133 토큰 · +532 B)이고 **항목 수가 늘지 않는다**(1차 축). ⓑ·ⓒ 는 1.4배, ⓐ 는 2.4배.
2. **상주에 맞는 것만 상주한다.** 앵커는 자기 머리에 "shared decision principles, not a fixed workflow" 라고 적었다. S1–S3 은 판단 기준이고, 절차(이슈 칸 · 마일스톤 명령 · wiki · 루프 단계)는 스킬에 이미 있다. ⓐ 는 그 절차를 두 벌로 만들고, ⓑ·ⓒ 의 본문도 절차다.
3. **4 CLI 에 같은 문장이 같은 자리로 간다** — 실측으로 Codex·OpenCode·Antigravity 공유 `AGENTS.md` §2 에 들어갔다. 룰은 CLI 마다 로드 조건이 갈린다(`paths:` 가 Codex·OpenCode 에서 무효).
4. **룰의 성격과 다르다.** 배포 룰 7종은 전부 "경계"다(Safety · Boundaries · Delivery · Testing). 작업을 어떻게 꺼내고 자르는가는 경계가 아니라 접근 방식이고, 앵커 §2 "Choose and adapt the approach" 가 그 자리다.
5. 대가도 적는다: ⓐ·ⓓ 는 **전 트랙**이 받는다(executive 포함 +133) — 룰이면 개발 트랙으로 좁힐 수 있었다. 그리고 앵커는 **사용자 문안**이라 리포가 임의로 못 보탠다(ADR-091 D1) — 이 설계의 문장은 사용자가 채택해야 한다. 둘 다 §7·§9 에 올렸다.

---

## 4. 추천안 — 넣을 문장 전문

### 4.1 ASIS → TOBE

**위치**: `templates/CLAUDE.md` `## 2. Choose and adapt the approach` 의 마지막 단락("Treat methods as replaceable. …") **뒤**, `## 3. Keep changes focused and coherent` **앞**에 한 단락. (§3 첫 단락 뒤도 후보였다 — §8 A4.)

ASIS (`templates/CLAUDE.md:21-34`, 변경 없음):

```
## 2. Choose and adapt the approach

Choose the simplest sufficient solution, …
Resolve routine uncertainty through evidence and reversible progress. …
Treat methods as replaceable. Improve or replace them when new evidence,
capabilities, or circumstances offer a better path to the same required outcomes
and protections.
```

TOBE — 위 단락 뒤에 더하는 **한 단락(3문장, 530자)**:

```
When a project has direction, plan, or design documents, or an agreed brief for a
change, derive the work from them rather than from the conversation. Group that work
by the user flow it completes and cut it into units that one change can finish and
that can be started from their own description alone; a grouping is done when the
user can do what its name says, not when its items are closed. Work the units in
their agreed order, and keep decisions and acceptance evidence where the project
tracks its work rather than in chat.
```

### 4.2 문장별 근거 — 왜 이 단어인가(외부 모델 토론용)

| 문장 | 한국어 뜻 | 담는 요구 | 단어 선택의 근거 | 의도적으로 **안 쓴** 말 |
|---|---|---|---|---|
| **S1** "When a project has direction, plan, or design documents, or an agreed brief for a change, derive the work from them rather than from the conversation." | 프로젝트에 방향 · 기획 · 설계 문서가 있거나 변경에 합의된 브리프가 있으면, 작업은 대화가 아니라 그 문서에서 꺼낸다 | R1 · R2 | **조건문**("When a project has")으로 시작 — 문서를 만들라는 지시가 아니라 **있을 때의 출처**를 정한다. 없는 프로젝트에 새 의무가 생기지 않는다(스코프 불변). **"direction, plan, or design documents"** = 서비스 정의서 · 기획서 · 설계서를 하네스 어휘로 — `north-star`(direction) · `SPEC/PRD`(plan) · 설계서(design). 문서 이름을 박지 않아 설치자의 파일명에 묶이지 않는다. **"an agreed brief"** = task-brief/objective-brief — "agreed" 가 `objective-brief` 의 "judgeable definition of done" 을 뜻한다. **"rather than from the conversation"** — 막으려는 실패 하나를 이름 붙였다: 문서가 있는데 채팅에서 범위를 다시 세우는 것 | "SPEC.md" · "north star" 같은 파일/스킬 이름(앵커는 자산 이름을 적지 않는다 — ADR-085) · "always" · "must" |
| **S2a** "Group that work by the user flow it completes and cut it into units that one change can finish and that can be started from their own description alone;" | 그 작업을 그것이 완성하는 사용자 플로우로 묶고, 한 변경으로 끝나며 자기 설명만 읽고 착수할 수 있는 단위로 자른다 | R4 · R5 | **두 층이 두 동사다**: "Group … by the user flow" = 사용자 서비스 플로우 관점(묶음) · "cut it into units" = 기능 구현 관점(항목). **"user flow"** 는 앵커 §1 "core usage flow" 와 같은 어휘(새 용어를 들이지 않는다). **"one change can finish"** — "one PR" 이 아니다: PR 이 없는 프로젝트 · CLI 가 있다(도구 중립). **"started from their own description alone"** = `gh-issue-workflow` 준비도의 "자족"(+16.7%p 머지율 실증) — 토큰 효율의 실제 원천(재읽기 제거)이면서 **실증이 있는 기준**이다. 실증 있는 둘만 남겼다 | "small" · "one PR" · "issue" · "milestone"(GitHub 전용 어휘) · 파일 수 · 개수 상한(실측 근거 없음 — 숫자는 목표가 된다) |
| **S2b** "a grouping is done when the user can do what its name says, not when its items are closed." | 묶음은 이름 문장이 참이 될 때 끝난다 — 항목이 다 닫혔다고 끝나지 않는다 | R4 · R6 | 사용자의 실제 관행(마일스톤 11/11 이 "사용자가 할 수 있게 되는 것" 문장)을 **종료 판정**으로 적었다 — 이름 규칙이 아니라 판정 규칙으로 적어야 "vX —" 접두 같은 리포 관행이 설치자에게 강제되지 않는다. **"not when its items are closed"** — `gh-issue-workflow` "에픽은 하위가 다 닫혀도 사람이 확인하고 닫는다" 와 같은 뜻을 묶음 일반으로 | "milestone" · "epic" · 이름 형식(`vX —`) |
| **S3** "Work the units in their agreed order, and keep decisions and acceptance evidence where the project tracks its work rather than in chat." | 단위를 합의된 순서로 진행하고, 결정과 수용 증거는 채팅이 아니라 프로젝트가 작업을 추적하는 자리에 남긴다 | R6 · (R3 포괄) | **"in their agreed order"** — "one at a time" 이 아니다: 레인 여럿을 병렬로 돌리는 것은 정당하고(`model-orchestration` §3) 순서는 사용자가 정한 것(라벨 · `blocked-by`)을 따른다는 뜻. **"decisions and acceptance evidence"** = `gh-issue-workflow` §6(결정은 본문으로) · §11(AC 증거 코멘트)의 **원칙**만 — 어디 · 어떻게는 그 스킬. **"where the project tracks its work"** — 이슈 · 마일스톤 · 추적 문서 · wiki 를 한 구절로 포괄, GitHub 를 전제하지 않는다(비활성 저장소는 로컬 추적 문서). **"rather than in chat"** — 막으려는 실패: 다음 세션이 결정을 다시 묻는 것 | "GitHub" · "issue" · "wiki" · "one at a time" · 쓰기 승인 규칙(스킬이 소유) |

**기존 원칙과의 관계 점검**: ⓐ 앵커 §1 "Start from the intended user's goal, the core usage flow" — S1·S2 는 그 출발점을 **문서와 작업 단위**로 이어 준다(중복 아님, 연결). ⓑ 앵커 §3 "Prefer a coherent solution over an arbitrarily small diff" — S2a 의 단위 기준은 "작게"가 아니라 "한 변경으로 끝나고 자족"이다. §3 은 **단위 안에서** diff 를 어떻게 잡나를, S2 는 **단위를 어디서 자르나**를 말한다 — 충돌이 아니라 층이 다르다. 토론에서 이 긴장이 지적되면 S2a 에 "coherent" 를 넣는 대안이 있다(§9-3). ⓒ 앵커 §6 "Work autonomously through the authorized outcome" — S3 의 "agreed order" 는 그 권한 안에서의 순서다. ⓓ Delivery 룰 "사용자 씬의 수정분이 모였을 때" — "user flow" 와 같은 대상을 가리킨다.

### 4.3 요구 6가지 — 상주에 담는 것 / 스킬로 위임하는 것 / 빼는 것

| 분류 | 항목 | 이유 |
|---|---|---|
| **상주(S1–S3)** | R1 문서에서 꺼낸다 · R2 브리프도 같은 입구 · R4 두 층 · R5 중 "한 변경으로 끝 · 자족" · R6 중 "합의된 순서 · 결정과 증거는 추적 자리에" · 묶음 종료 판정 | 어떤 프롬프트 모양으로도 발화하지 않는 **판단 기준**이다 — 문서를 넘기며 "시작하자"는 말은 어느 스킬 descriptor 도 안정적으로 받지 못한다(ADR-068 실측과 같은 형태). 4 CLI 공통 · 도구 중립 어휘로만 썼다 |
| **스킬 위임(변경 없음)** | 이슈 본문 · 마일스톤 · 라벨 · 원격 쓰기 승인 · 백로그→착수 · PR · VERIFY → `gh-issue-workflow` / 브리프 형식 · 아웃바운드 → `objective-brief` / 레인 · 독립 리뷰 → `model-orchestration` / 방향 → `north-star` | 절차이고 이미 있다. 둘 다 전 트랙 기본 설치(`condition: any-track`)라 상주 문장이 가리킬 필요 없이 descriptor 가 받는다("이슈로", "브리프로"). 두 스킬이 서로를 모르는 것(브리프 → 이슈 칸)은 **후속 자산 변경**(§10) |
| **빼기 ①** | R5 의 세부 신호 — 파일·계약 비겹침 · 같은 파일군 합치기 · 미확정 결정 분리 | 비겹침은 `model-orchestration` §3 이 위임 시점에 이미 말한다 · 미확정 분리는 `gh-issue-workflow` §4-5(방향성 OPEN → 착수 불가 · `decision-pending`) · 합치기는 모델 판단. **실증 없는 기준을 매 세션 상주시키지 않는다** |
| **빼기 ②** | R6 의 루프 단계(고르기 → 브리프 → 레인 → 검증 → 닫기 → 다음) | 절차. `gh-issue-workflow` §1·§9-11 + `model-orchestration` §5 가 전부 갖고 있다. 벤더 지침 "multi-step procedure → skill" |
| **빼기 ③** | R3 wiki | 조건부(`has_wiki` + 리포 실재 + 첫 페이지는 사용자) · 도구 종속 · 도그푸드 0. `gh-issue-workflow` §8 이 소유. S3 "where the project tracks its work" 가 포괄한다. 사용자 의도(원본/미러)는 §7 D4 |
| **빼기 ④** | 숫자 상한(이슈당 파일 수 · 마일스톤당 항목 수 · 레인 수) | 실측 근거 없음 · 숫자는 목표가 된다 |

### 4.4 포인터(스킬 이름을 어디에 적나)

앵커에는 적지 않는다(ADR-085 — 스킬 안내는 설치기가 **깔린 것만** 프로젝트 블록에 쓴다). `gh-issue-workflow` 를 `CONTINUOUS_SKILLS` 에 올리면 매 세션 한 줄(모든 트랙 · 코드 변경)이 더 들고, 그 스킬의 descriptor 는 이미 "이슈 · 백로그 · 우선순위" 어휘로 발화한다. **기본은 포인터 없음** — §7 D3.

---

## 5. 구현 PR 이 건드리는 자리(코드는 쓰지 않았다)

| 자리 | 변경 | 근거 |
|---|---|---|
| `templates/CLAUDE.md` | §2 끝에 §4.1 TOBE 단락 — **사용자가 채택한 문안 그대로** | ADR-091 D1 |
| `docs/decisions/ADR-1xx` | ADR-091 결정 1 개정("#463 문안" → "#463 + #755 문안") · 기각 대안 ⓐ·ⓑ·ⓒ · Consequences 에 **실측** before → after(tooling 지시문 3,830 → 3,963 · codex `AGENTS.md` 20,522 → 21,054 B · 다른 트랙 수치) | `change-management` §ADR |
| `context-cost-baseline.json` | `npm run cost:baseline` — **전 트랙** directive +133(앵커라 executive · pm · growth 포함) · 커밋 본문에 사유 | ratchet 규율 |
| `tests/resident-reach-4cli.test.ts` AGENTS.md ratchet | **변경 없음** — 21,054 B < 23,552 B. 단 ratchet 주석 관행대로 "+532 B · 무엇을 줄였나/안 줄였나"를 PR 본문에 | `:404-410` |
| `.claude/CLAUDE.md`(이 리포 개발 사본) | **변경 없음** — 이 리포 레인 원칙은 별 파일. 사용자 전역 `~/.claude/CLAUDE.md` 와의 동기화는 사용자 몫(ADR-091 로 바이트 동일 계약은 끝났다) | ADR-091 |
| `docs/SPEC.md` Change Log | **불필요** — Non-Goals "기본 설치 항목 재정의"는 자산 집합이고 앵커 문장은 자산이 아니다. 갈리면 Clarification 한 줄 | SPEC Non-Goals |
| 기존 설치본 | `update` 가 앵커를 기준선 대조로 갱신 — 설치자가 앵커를 고쳤으면 백업 뒤 교체(`anchorBackedUp`), `AGENTS.md` 는 마커 블록만 갈아 끼운다 | `src/update-mode.ts:177-187` · `src/agents-md-render.ts:148-150` |
| 영향 범위 테스트 | 문서·자산 변경 → **전체**(`npm run ci`) | `test-policy` §영향 범위 |

---

## 6. 이 문장이 행동을 바꾸는지 — 관찰 신호

하네스에는 발화 로그가 없다. 그래서 ⓐ **채택 전 비교 1회**와 ⓑ **채택 뒤 GitHub 에 이미 남는 것**만 쓴다. 새 도구는 만들지 않는다.

| 신호 | 어떻게 | 좋은 방향 | 한계 |
|---|---|---|---|
| **with/without 비교(채택 전, 1회)** — 같은 기획서 1부를 문장 있는 설치본과 없는 설치본에 주고 "개발 시작하자"만 말한다 | 두 응답에서 ① 묶음이 사용자 플로우 단위인가 ② 각 항목이 한 변경으로 끝나고 자족인가 ③ 범위를 대화에서 새로 세웠는가 를 센다(ADR-043 의 with/without eval 경로 — 이 리포가 자산에 걸기로 한 바로 그 검증) | ①②가 늘고 ③이 준다 | 표본 1 · 채점자 1. 방향만 — 그래도 **이 문장을 넣을 유일한 직접 증거**다 |
| 마일스톤 소속 항목 중 **PR 1개로 닫힌 비율** | `gh issue list --milestone … --json closedByPullRequestsReferences` | ↑ | 기준선 없음 — 첫 두 묶음이 기준선 |
| 묶음을 닫을 때 **이름 문장이 참**이었나 | 닫는 코멘트 | 거짓 0 | 에이전트 자기 판정 — 사용자가 확인한 것만 |
| 착수 뒤 **범위 재질문** · 다음 세션의 **결정 재질문** | 대화(사용자 관측) | ↓ | 측정 아님 |
| **문장 없이도 같은 결과** | 문장이 없는 프로젝트(설치 전 · 다른 하네스)에서 같은 쪼개기가 나오는가 | — | **은퇴 판정의 입력**(ADR-090 — 모델이 이미 그렇게 하면 상주에서 뺀다) |

sunset: 채택 뒤 **두 릴리즈** 안에 위 표의 어느 신호도 사용자 프로젝트에서 관측되지 않으면 `audit-harness-fit` 감사에 "상주 → 스킬 강등 후보"로 올린다. 날짜 · 모델 좌표는 ADR 에 적는다(NORTH_STAR §4.1 "만료 시계").

---

## 7. 결정 필요 — 사용자만 답할 수 있는 것

| # | 질문 | 선택지 | **추천과 이유** |
|---|---|---|---|
| D1 | §4.1 의 3문장을 **사용자 문안으로 채택**하나(앵커는 ADR-091 D1 로 사용자 문안 축자) | ⓐ 그대로 채택 ⓑ 고쳐서 채택(ChatGPT 토론 뒤) ⓒ 앵커 대신 룰(ⓑ/ⓒ 안) | **ⓑ** — 토론이 예정돼 있다. 고친 문안이 "사용자가 #755 에 준 문안"이 되면 ADR-091 D1 의 조건을 그대로 만족한다. 고칠 때 §4.2 의 "안 쓴 말" 열을 기준으로 — 도구 이름 · 숫자 · 절차가 들어오면 ⓓ 가 ⓐ 로 바뀐다 |
| D2 | 묶음 **이름 규칙** — S2b 는 "이름 문장이 참일 때 끝난다"로만 적었다. `gh-issue-workflow` P7 은 Now/Next/Later(확신도) 를 권한다 | ⓐ S2b 그대로(종료 판정만) · P7 은 그대로 두고 별도 이슈 ⓑ S2b 를 빼고 P7 에 맡김 ⓒ P7 을 "결과 문장" 으로 고친다(자산 변경) | **ⓐ** — 11/11 관측이 S2b 쪽이다. P7 과의 갈림은 남지만 S2b 는 **이름 형식을 강제하지 않는다**(종료 조건만). P7 수정은 §10 후속 이슈 |
| D3 | `gh-issue-workflow` 를 `CONTINUOUS_SKILLS`(매 세션 한 줄) 에 올려 **포인터**를 둘 것인가 | ⓐ 안 둔다 ⓑ 둔다 | **ⓐ** — descriptor 가 이미 "이슈 · 백로그 · 우선순위" 어휘로 발화하고, 포인터는 모든 트랙 매 세션 비용 + 코드 변경이다. ADR-088 이 같은 이유로 `objective-brief` 를 뺐다. 신호(§6)가 "스킬이 안 열린다"를 보이면 그때 |
| D4 | wiki 는 **미러**(현행 `gh-issue-workflow` §8 — 원본은 `docs/`)인가 **원본**인가 | ⓐ 미러(현행) ⓑ wiki 가 기획서·설계서의 원본 | **ⓐ** — 에이전트가 첫 페이지를 못 만들고, wiki 에는 리뷰 · 게이트가 없고, 원본이 둘이면 한쪽이 썩는다. 상주 문장은 어느 쪽이든 바뀌지 않지만(S3 "where the project tracks its work"), 이슈 원문 "위키를 활용해 문서화"가 ⓑ 라면 §8 자체를 바꾸는 별도 결정이다 |

---

## 8. 가정과 기본값(모호해서 정한 것 — 전부 뒤집을 수 있다)

- **A1 문체 = 앵커 현행(영어 · 원칙형 · 긍정형).** 룰은 한국어지만 앵커는 영어다(#463 문안). 한국어 뜻은 §4.2 표에 붙였다.
- **A2 "task-brief" = `objective-brief`**(ADR-088 개명). descriptor 가 "task-brief requests" 를 트리거로 가진다.
- **A3 문서 3종의 템플릿은 주지 않는다.** S1 은 "있으면" 이다. 설치자가 자기 형식을 갖고 있다는 사용자 말("이미 익숙")을 따른다.
- **A4 위치 = §2 끝.** §3 첫 단락 뒤(단위 크기 ↔ coherent diff)도 후보였다. §2 는 "접근 방식"이고 이 단락은 작업을 **어떻게 꺼내고 구조화하나**라 §2 로 뒀다. 비용은 위치와 무관하다.
- **A5 ⓑ 의 트랙 = `DEV_RULES`** 로 가정해 비교했다(개발 트랙만). `COMMON_RULES` 면 앵커와 같은 전 트랙이다.
- **A6 ⓐ·ⓑ/ⓒ 후보 문안**(부록 A)은 비교를 위해 **내가** 썼다 — 채택 대상이 아니다. 더 짧게 쓸 수 있고, 그러면 비용 차는 줄지만 §3.3 의 성격 논거(절차 vs 원칙 · 항목 수 · CLI 로드 조건)는 바뀌지 않는다.
- **A7 측정 단위 = chars/4 규약**(`src/context-cost.ts:19`). 실제 토크나이저 값이 아니다 — 이 리포의 모든 상주 수치와 같은 단위라 **상대 비교**에 쓴다.
- **A8 SPEC Change Log 불필요**로 봤다(앵커 문장은 "기본 설치 항목"이 아니다). 검증자가 갈리면 Clarification 한 줄.

---

## 9. 검증자 · 외부 토론에게 — 미심쩍은 부분 전부(심각도로 거르지 않았다)

1. **근거가 관측 1인분이다.** "문서 → 플로우 묶음 → 한 변경 단위" 가 더 낫다는 것은 사용자의 작업 방식이고 with/without 실측은 0건. 반대 증거: Anthropic 하네스 글(*sprint 구조 제거 후 성능 유지*). 그래서 §6 첫 행(채택 전 비교 1회)을 **채택 조건**으로 올릴지 토론에 부친다.
2. **앵커는 사용자 문안이다**(ADR-091 D1). 이 문서가 문장을 쓴 것 자체가 그 결정의 글자와 어긋난다 — 해소는 D1(사용자가 채택해야 들어간다). 토론에서 문장이 많이 바뀌면 그게 정상이다.
3. **§3 "coherent solution over an arbitrarily small diff" 와 S2a 의 긴장.** "units that one change can finish" 를 "작게 자르라"로 읽는 모델이 있을 수 있다. 대안 문구: "units that one coherent change can finish". 넣으면 +9자.
4. **"one change" 가 모호할 수 있다.** PR · 커밋 · 변경 세트 어느 것인가 — 도구 중립을 택한 대가. 토론 질문: "one reviewable change" 가 더 나은가(+11자).
5. **"derive the work from them rather than from the conversation" 이 대화의 요청을 무시하라로 읽힐 위험.** 뜻은 "범위의 출처가 문서"다. 대안: "start the work from them, not from the conversation alone".
6. **전 트랙 비용.** 앵커라서 executive · project-management · growth-marketing 설치자도 +133 토큰을 매 세션 낸다 — 그 트랙에 "user flow" · "units" 가 맞는 어휘인가. 룰(`DEV_RULES`)이면 피할 수 있었다. 이것이 ⓓ 의 가장 큰 대가다.
7. **S3 "agreed order" 의 "agreed" 가 누구와의 합의인가** — 라벨 · `blocked-by` · 사용자 지시. 명시하지 않았다(도구 이름 회피). 토론 질문.
8. **ⓑ 상주 수치는 실측이 아니라 ⓒ 실측의 대리값**이다(같은 본문 · H1 1자 차 · 항목 +1). `src/manifest.ts` 를 바꾸지 않고는 깔리지 않아 그렇게 했다 — 구현 전에 재면 ±2 토큰 안일 것이다.
9. **ratchet 은 "늘리려면 무엇을 줄일지 함께 정한다"다.** 이 설계는 줄이는 것을 제안하지 않았다(+133 · +532 B 를 그대로 올린다). ADR-087·088 전례는 같은 PR 에서 상계분을 찾았다. 후보: 앵커 §2 둘째 단락 "Involve the user when…" 은 §6 과 겹치는가 — 내가 보기엔 다르다(§2 는 결정 시점, §6 은 권한). 줄일 곳을 못 찾았다고 적는다.
10. **`gh-issue-workflow` P7(Now/Next/Later)과 사용자 관행(결과 문장)의 갈림**은 S2b 로 해소되지 않는다 — S2b 는 종료 판정만 적어 **회피**했다. D2.
11. **wiki 도그푸드 0 · 부모 이슈 0.** R3 의 "활용"이 미러 이상을 뜻하면(D4 ⓑ) 상주 문장은 그대로여도 `gh-issue-workflow` §8 이 바뀌어야 한다.
12. **4 CLI 비대칭은 상주 밖에 남는다** — `implementer`·`reviewer` 는 Claude 전용. S3 은 레인을 말하지 않아 영향이 없지만, R6 의 "만든 레인이 판정하지 않는다"는 Codex·OpenCode·Antigravity 에서 `model-orchestration` §5 문장에만 의존한다.
13. **측정 스크립트는 스크래치패드에 있다**(날짜가 바뀌면 사라진다). 수치는 부록 B 에 옮겼고 방법은 §3.1 에 적었다 — 재현은 같은 절차로 다시 돌리면 된다(10초).

---

## 10. 후속 제안(이번 범위 밖 — 한 줄씩)

- `objective-brief` ↔ `gh-issue-workflow` 역참조와 **브리프 → 이슈 칸 대응표**(1판 §4.3 의 표) — 두 스킬 중 한쪽에 자산 변경 이슈로.
- `gh-issue-workflow/references/operating-model.md` P7 에 "결과 문장 이름"을 대안으로 — D2 ⓐ 면 별도 이슈.
- R5 의 세부 신호(비겹침 · 합치기 · 미확정 분리)를 `gh-issue-workflow` 준비도 8줄 옆에 **쪼개기 신호** 절로 — 상주가 아니라 스킬에.
- `design-verifier` 배포 여부(설계서를 구현 전에 다른 레인이 읽는 단계) — 이 리포는 매 묶음 쓰지만 배포 자산이 아니다.
- 메모리 "Codex AGENTS.md 예산 74%" 는 옛 수치 — 이번 실측 62.6%(tooling · codex 단독)로 갱신.

---

## 부록 A — 비교에 쓴 후보 문안 전문(채택 대상 아님 — ⓐ·ⓑ/ⓒ 의 비용 근거)

**ⓐ 앵커 전체판(영어 8문장 · 1,290자 · 실측 +323 토큰)**

```
When a project has direction, plan, or design documents, or an agreed brief for a
change, derive the work from them rather than from the conversation. Read them for
the user flows they describe, each flow's observable completion criteria, the stated
non-goals, and the decisions still open; if the flows are not clear, ask once, because
every grouping below depends on them. Group work by the user flow it completes and
name each grouping by what the user can newly do; it is done when that sentence is
true, not when its items are closed. Cut each grouping into units that one change can
finish, that can be started from their own description alone, and that do not share
files or contracts with work in flight; keep units that would reopen the same files
together, and separate anything still waiting on a decision. Order units by real
dependencies first and current priority second. Work them one at a time: read what
was decided, state the unit's definition of done, build it, have the outcome verified
by someone other than its author in proportion to the risk, record the acceptance
evidence, close it, and pick the next. Keep decisions and evidence where the project
tracks its work rather than in chat, and mirror only direction-level documents to a
wiki when the project keeps one.
```

**ⓑ/ⓒ 룰 본문(한국어 · 712자 · ⓒ 실측 +182 토큰 · +1,643 B)** — ⓑ 는 `# Work Units` 제목, ⓒ 는 `## Work Units` 절 제목 아래 같은 본문.

```
프로젝트에 방향 · 기획 · 설계 문서가 있거나 변경에 합의된 브리프가 있으면, 작업은 대화가 아니라 그 문서에서 꺼낸다.

- **두 층으로 자른다.** 사용자 플로우 하나가 묶음 하나다 — 이름은 "사용자가 무엇을 할 수 있게 되나" 한 문장이고, 그 문장이 참이 될 때 닫는다(항목이 다 닫혔다는 사실로 닫지 않는다). 구현 단위 하나가 작업 항목 하나다.
- **알맞은 단위의 신호**: 한 변경(PR)으로 닫힌다 · 그 항목만 읽고 착수할 수 있다 · 진행 중인 다른 항목과 파일·계약(스키마 · API · 기록 키)이 겹치지 않는다 · 검증이 그 항목 안에서 사용자 표면으로 끝난다. 같은 파일군을 연속으로 고치는 두 항목은 하나로 합친다 — 쪼개기 과잉은 컨텍스트를 두 번 세운다. 결정이 미확정인 부분은 떼어 내 그 결정에 걸어 둔다.
- **순서**는 사실인 의존을 먼저, 오늘의 우선순위를 그 다음에 둔다. 한 번에 하나씩 — 결정된 것을 읽고, 완료 정의를 적고, 만들고, 위험에 맞게 만든 쪽이 아닌 쪽이 확인하고, 증거를 남기고 닫은 뒤 다음을 고른다.
- 결정과 수용 증거는 채팅이 아니라 **프로젝트가 작업을 추적하는 자리**(이슈 · 마일스톤 · 추적 문서)에 남긴다. 그 자리의 쓰기 규칙과 본문 형식은 설치된 이슈 워크플로 스킬이, 완료 정의의 형식은 브리프 스킬이 정한다. wiki 는 그 프로젝트가 쓸 때만, 방향 층 문서의 사본으로만.
```

## 부록 B — 측정 원시 수치(2026-10-12 · tooling · main 88096fe)

측정 스크립트(스크래치패드 `m755/measure.ts`, esbuild 로 번들해 node 실행): 변형마다 `runInstall({harnessRoot, projectDir: mkdtemp, spec: {cli, tracks: ["tooling"], options: DEFAULT_OPTIONS}, runExternal: null})` 를 `["claude"]` · `["codex"]` · `["codex","opencode","antigravity"]` 로 돌리고, `residentCost(buildManifest(buildAssetSpec({tracks:["tooling"], options})).filter(applies), harnessRoot, ["claude"])` 와 산출물 바이트를 읽었다.

| 변형 | directive 토큰 | Δ | items | rules 토큰 | CLAUDE.md 토큰 | `.claude/rules` 바이트 | `AGENTS.md` 3-CLI B | Δ | `AGENTS.md` codex B | Δ | Claude 룰 수 / Antigravity 룰 수 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| baseline | 3,830 | 0 | 8 | 1,530 | 2,300 | 9,849 | 20,618 | 0 | 20,522 | 0 | 6 / 6 |
| A-anchor-full | 4,153 | +323 | 8 | 1,530 | 2,623 | 9,849 | 21,910 | +1,292 | 21,814 | +1,292 | 6 / 6 |
| D-anchor-min | 3,963 | +133 | 8 | 1,530 | 2,433 | 9,849 | 21,150 | +532 | 21,054 | +532 | 6 / 6 |
| B1-rule-nopaths | 3,830 | 0 | 8 | 1,530 | 2,300 | 9,849 | 20,618 | 0 | 20,522 | 0 | 6 / 6 — **설치 안 됨**(배선 없음) |
| B2-rule-paths | 3,830 | 0 | 8 | 1,530 | 2,300 | 9,849 | 20,618 | 0 | 20,522 | 0 | 6 / 6 — **설치 안 됨** |
| C-delivery-section | 4,012 | +182 | 8 | 1,712 | 2,300 | 11,492 | 22,261 | +1,643 | 22,165 | +1,643 | 6 / 6 (ship-checklist 안에 `## Work Units` 실재 · Antigravity 판 `trigger: always_on`) |

기준선 수치는 `npm run cost:report`(2026-10-12)의 tooling 행(지시문 8개 ~3,830 · rules 6개 ~1,530 · CLAUDE.md 2개 ~2,300)과 일치한다. 후보 문안 길이: ⓐ 1,290자/323토큰 · ⓓ 530자/133토큰 · ⓑ/ⓒ 본문 712자/178토큰(UTF-8 1,627 B). AGENTS.md ratchet = 23.0 KiB = 23,552 B(`tests/resident-reach-4cli.test.ts:404`). Codex 합계 예산 = 32 KiB = 32,768 B.

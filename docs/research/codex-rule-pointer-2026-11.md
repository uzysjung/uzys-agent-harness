# Codex 는 `AGENTS.md` 의 "이 룰 파일을 읽어라" 포인터를 따르는가 — 실측 (2026-11-03)

- 질문(사용자, 2026-11-03): Codex 가 섞인 조합에서 룰 본문을 `AGENTS.md` 에 인라인하지 않고 "레퍼런스(룰 파일)를 참조하라"로 풀 수 있는가.
- 배경: Codex 는 `AGENTS.md` 안의 경로를 로더가 따라가지 않는다(`codex-rs/core/src/agents_md.rs` — 폴더마다 파일 하나를 이어 붙일 뿐, include 요청 openai/codex#6038 · #17401 OPEN). 포인터는 **모델이 읽기로 해야만** 닿는다. 공개 측정은 찾지 못했다(#944 §근거).
- 도구·스크립트: `docs/plans/codex-pointer-spike/`(픽스처 생성 · 실행 · 분석), 원자료 요약 = 같은 폴더 `results.tsv`.

## 방법

- **Codex**: codex-cli 0.163.0 · 모델 `gpt-6-astra` · 추론 강도 `xhigh`(사용자 설정값). `codex exec -s workspace-write --ephemeral --json`, 네트워크 꺼짐, 환경 변수는 external-model-consult 래퍼와 같은 허용 목록. 실행 폴더는 저장소가 아닌 **합성 픽스처**(공개 배포물 Working Principles · `ui-components` 룰 + 가짜 Next.js/shadcn 프로젝트).
- **작업**(모든 조건 같은 문장): "`src/components/price-tag.tsx` 에 가격(원)과 할인율(%)을 받아 원래 가격과 할인가를 보여 주는 PriceTag 컴포넌트를 만들어 줘."
- **표식**: 룰 본문 첫 항목에 "UI 컴포넌트 파일은 첫 줄에 `// ui-rule: v7` 주석을 둔다"를 심었다. 판정 둘 — ⓐ 실행 기록(`--json` 의 command_execution)에 룰 파일 읽기가 있는가 ⓑ 만든 `.tsx` 첫 줄이 표식인가.
- **조건**(`AGENTS.md` 의 `## Harness Rules` 자리):

| 조건 | 내용 |
|---|---|
| A 인라인 | 룰 본문을 그대로(지금 Codex 조합의 방식) — 양성 대조 |
| B1 조건부 포인터 | "`**/*.tsx` · `**/*.jsx` 를 만들거나 고치기 전에 `.agents/rules/ui-components.md` 를 읽고 따른다." |
| B2 시작 포인터 | "작업을 시작하기 전에 그 폴더(`.agents/rules/`)의 룰 파일을 모두 읽고 따른다." |
| C 스킬 | 절 없음, 같은 본문을 `.agents/skills/ui-components/SKILL.md`(설명: .tsx/.jsx UI 컴포넌트를 만들거나 고칠 때) |
| D 없음 | 룰 없음 — 음성 대조(표식이 우연히 나오지 않는가) |

- **환경 두 가지**: ① 사용자 실제 `~/.codex`(전역 `AGENTS.md` 가 다른 파일을 읽으라고 지시하고, 실제로 그 파일 · 메모리를 읽었다 — 포인터 따르기를 부풀릴 수 있다) ② 전역 지시문 · 메모리 없는 `CODEX_HOME`(인증 링크 + 모델 두 줄만). ②의 실행은 전역 파일을 한 번도 읽지 않았다(확인).

## 결과

| 조건 | ① 사용자 환경 | ② 전역 설정 없음 | 합계(끝난 실행) |
|---|---|---|---|
| A 인라인 | 표식 2/2 | 1/1 | **3/3** |
| B1 조건부 포인터 | 읽음·표식 4/4 | 3/3 | **7/7** |
| B2 시작 포인터 | 1/1 (+ 시간 초과 2 — 1회는 룰을 읽은 뒤) | — | 근거 부족 |
| C 스킬 | 3/3 | 2/2 | **5/5** |
| D 없음 | 표식 0/2 | 0/1 | **0/3** |

- B1 · C 는 끝난 모든 실행에서 **첫 명령 한두 개 안에** 룰 파일 · `SKILL.md` 를 읽었다(파일을 쓰기 전).
- 첫 묶음(4개 동시)에서 6회가 서버 쪽 실패(`Selected model is at capacity` 2 · 300 s 시간 초과 4)였고 다시 돌렸다. 측정에서 뺀 것은 끝나지 않은 실행뿐이다.
- 실행당 입력 토큰 12만~58만(대부분 캐시). 인라인이 포인터보다 적다는 경향은 이 표본으로 말할 수 없다.

## 이 측정이 말하지 않는 것

- **작업 하나**(새 `.tsx` 만들기, 작업 문장이 대상 파일 종류를 직접 말한다). 긴 세션 중간에 다른 일을 하다 `.tsx` 를 건드리는 경우, 대상 파일 종류가 작업 문장에 안 드러나는 경우는 재지 않았다.
- **모델 하나 · 강도 하나**(`gpt-6-astra` xhigh). 낮은 강도나 다른 모델은 다를 수 있다.
- 짧은 `AGENTS.md`(약 6 KB). 실제 설치본(20 KB 대 + 설치자 글)에서 포인터 한 줄이 덜 눈에 띌 수 있다.
- 표식은 눈에 띄는 인위적 규칙이다 — "읽고 적용했는가"를 재지, 룰 전체를 얼마나 지켰는지는 재지 않는다.
- B2(늘 적용되는 룰을 세션 시작에 읽게 하기)는 끝난 실행이 1회뿐이다.

## 2차 측정 — 실제 배포 형태 · 덤으로 고치는 작업 · 낮은 강도 (같은 날)

1차가 비워 둔 장면을 쟀다. 스크립트 = `make-fixture2.py` · `run2.sh` · `analyze2.py`, 전역 설정 없는 `CODEX_HOME`.

- **배포 형태**: `## Harness Rules` 에 늘 적용되는 룰 5종(git · test · doc · change · ship)은 본문 그대로, 경로 룰 2종은 포인터 목록으로 —
  `> 아래 파일을 만들거나 고치기 전에 그 룰을 읽고 따른다 — 본문은 여기 없다.` 다음 줄에 `**/*.tsx` · `**/*.jsx` → `.agents/rules/ui-components.md`,
  `**/*.sh` → `.agents/rules/cli-development.md`. `AGENTS.md` 약 15.6 KB(인라인 대조 17.4 KB).
- **덤으로 고치는 작업**: "할인가는 원 단위 내림으로 계산해야 한다는 정책이 정해졌다. `src/lib/price.ts` 를 고치고, 화면에 예전 규칙이 드러나는 곳이
  있으면 함께 맞춰 줘." — 작업 문장에 `.tsx` 가 없고, 기존 `price-tag.tsx`("할인가(반올림)" 배지)를 덤으로 고쳐야 한다.
- **강도**: `xhigh` 와 `medium`(`-c model_reasoning_effort`).

| 장면 · 강도 | 인라인 대조 | 포인터 | 룰 없음 |
|---|---|---|---|
| 덤으로 고치기 · xhigh | 표식 2/2 | 읽음·표식 **3/3**(1회는 적용 뒤 서버 용량 오류로 끝을 못 냄) | 0/1 |
| 새로 만들기 · medium | 1/1 | **3/3** | — |
| 덤으로 고치기 · medium | 1/1 | **2/2** | — |

- 포인터 8회 모두 **`.tsx` 를 쓰기 전에** 룰 파일을 읽었다(실행 기록의 순서 READ → WRITE_TSX). 원래 일(`Math.floor` 로 내림)도 전부 했다.
- 1차와 합치면 포인터 **15/15**(끝까지 간 실행 14), 인라인 6/6, 룰 없음 0/4.

남는 한계: 모델 하나(`gpt-6-astra`) · 작업 종류 둘 · 실행당 짧은 세션. OpenCode 의 포인터 따르기는 5차에서 쟀다.

## 3차 — 실제 하네스 설치본 (#948 구현 브랜치 6e7ac63)

- 하네스를 컨테이너 안에서 `install --track ssr-nextjs --cli codex --cli antigravity` 로 설치한 프로젝트(`install-in-docker.sh`). 렌더된 `AGENTS.md` 21,333 B, `## Harness Rules` 블록 끝에 측정한 형태 그대로의 포인터 목록(`**/*.tsx` · `**/*.jsx` → `.agents/rules/ui-components.md`), 가리키는 파일은 Antigravity 가 쓴 것.
- 룰 본문은 **실제 배포 룰 그대로**(표식 없음) — 판정은 실행 기록의 읽기 순서만 본다(`run-e2e.sh`, 전역 설정 없는 `CODEX_HOME`, xhigh).

| 작업 | 룰을 `.tsx` 쓰기 전에 읽음 |
|---|---|
| 덤으로 고치기 | **3/3** |
| 새로 만들기 | **1/1** |

## 4차 — 포인터가 `.claude/rules/` 를 가리킬 때 (Claude Code + Codex 설치본)

- 질문: Codex 가 다른 도구(Claude Code)의 폴더 `.claude/rules/` 안 파일도 포인터를 따라 읽는가 — Claude Code + Codex 설치에는 그 파일이 이미 있다.
- 방법: main(v26.182.0)으로 컨테이너 안에서 `install --track ssr-nextjs --cli claude --cli codex`(`install-claude-codex-in-docker.sh`) → 렌더된 인라인 `## UI Components` 절을
  측정한 형식의 포인터 한 줄(`**/*.tsx` · `**/*.jsx` → `.claude/rules/ui-components.md`)로 손으로 바꿨다. 가리킨 파일은 하네스가 Claude Code 용으로 쓴
  실제 파일(`paths:` frontmatter 포함). 실행 · 판정은 3차와 같다(`run-e2e.sh`, 전역 설정 없는 `CODEX_HOME`, xhigh).

| 작업 | `.claude/rules/ui-components.md` 를 `.tsx` 쓰기 전에 읽음 |
|---|---|
| 덤으로 고치기 | **3/3** |
| 새로 만들기 | **1/1** |

(첫 시도 4회는 측정용 `CODEX_HOME` 에 인증 링크를 다시 만들지 않아 401 로 끝났다 — 측정에서 뺐다.)

## 5차 — OpenCode 도 같은 포인터를 따르는가 (OpenCode 2.2.5, 4 CLI 설치본)

- 질문: OpenCode 가 섞인 설치(지금은 늘 인라인)에도 같은 경로 룰 포인터를 쓸 수 있는가.
- 설치본: main(v26.183.0)으로 컨테이너 안에서 `install --track ssr-nextjs --cli claude --cli codex --cli opencode --cli antigravity` → 3·4차의 가짜
  Next.js 파일을 얹고 `AGENTS.md` 의 인라인 `## UI Components` 절을 측정한 형식의 포인터 한 줄로 바꿨다 — 대상 폴더 둘(`.claude/rules/` ·
  `.agents/rules/`, 둘 다 하네스가 쓴 실제 파일) · 대조군은 그 절을 지우기만(룰 없음). `opencode.json` 은 하네스 판에서 `mcp` 키만 뺐다.
- 실행: OpenCode 2.2.5 `run --standalone --auto --format json -m openai/gpt-6-astra#xhigh`, 호스트에서 **측정 폴더 안으로만**(사용자 결정 —
  Docker 대신 범위 제한): 셸 · 코드 실행 · 웹 · 하위 에이전트를 끄고 폴더 밖 접근을 거부(`opencode-scope.json`, 네 가지 시도 프롬프트로
  거부를 먼저 확인), 사용자 전역 설정 · 개인 지시문 · 외부 스킬 · 세션 DB 를 쓰지 않는다(`env-oc.sh`). 판정은 3·4차와 같은 읽기 순서
  (`analyze-oc.py`), 작업 문장도 같다.

| 조건 | 덤으로 고치기 | 새로 만들기 |
|---|---|---|
| 포인터 → `.claude/rules/ui-components.md` | 룰을 `.tsx` 쓰기 전에 읽음 **3/3** | **1/1** |
| 포인터 → `.agents/rules/ui-components.md` | **2/2** | — |
| 룰 없음(대조군) | 그 파일을 읽지 않고 `.tsx` 를 고침 **0/1** | **0/1** |

- 범위를 막기 전의 첫 실행 1회(셸 · 웹이 열려 있었다)도 읽은 뒤 고쳤다(`claude-incidental-1`) — 위 표에는 넣지 않았다. 서버 기동 실패 1회는
  다시 돌렸다(`none-create-1`). 원자료 요약 = `results-opencode.tsv`.
- 남는 한계: 모델 하나 · 강도 하나(Codex 측정과 같은 `gpt-6-astra` xhigh) · 셸을 끈 환경(설치자 환경은 셸이 열려 있다 — 열린 1회도 읽었다).

## 판단에 쓰는 법

- **경로가 정해진 룰**(`paths:` — `cli-development` · `ui-components` · `htmx-*-ui`)을 Codex 조합에서 조건부 포인터로 바꾸는 근거가 된다(1·2차 15/15, 덤으로 고치기 · medium 포함). 스킬(C)도 5/5 였다. 이 룰들은 Claude Code 에서도 "그 파일을 고칠 때만 읽는다"로 쓰이고, #944 조합의 초과 바이트가 바로 이 룰들이다.
- **늘 적용되는 룰 · Working Principles** 를 포인터로 바꾸는 근거는 되지 않는다(B2 근거 부족 · 매 세션 첫 판단부터 적용되는 층).

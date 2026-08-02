# Prompt templates & worked examples

Mode 별 프롬프트 원형과 실사례. SKILL.md 의 Mode 요약을 읽고 실제로 호출하기 직전에 본다.
(원본 스킬 대응: Mode K·P·이미지 = gemini-consult 의 Mode A·B·C · Mode S·이미지 =
codex-consult 의 Mode A·B.)

## Mode K — 한국어 카피/뉘앙스 (Gemini)

```
너는 한국어 카피라이터야. 아래 문구를 더 자연스럽고 세련된 한국어로 다듬어줘.
- 맥락: <표면(브로셔 히어로/버튼/토스트 등)> · 청중: <대상> · 톤: <담백/친근/전문 등>
- 제약: <길이/줄 수>. 아래 영문 제품 명사는 그대로 유지: <Operating System, Inbox, Project, Initiative, ...>
- 의미는 유지하되 과장·번역투 금지.
후보만 3개, 설명 없이 번호로.

문구: "<원문>"
```

Then show the candidates to the user and ask which to use (or blend).

**Worked example**

- Input: 브로셔 히어로 — "제품은 성장하는 팀과 AI를 위한 단 하나의 Operating System입니다."
- Call: the wrapper with the template above — 맥락 = 브로셔 히어로, 톤 = 담백·확신,
  keep-list = `Operating System`.
- Output: present the 3 returned candidates → user picks one → then apply.

**The keep-list is not optional.** Without it, agy renders "Operating System" →
"운영 체제". Any product noun the project deliberately keeps in English has to be
listed in the prompt, or the polish pass quietly translates your brand vocabulary.

## Mode P — 멀티페르소나 / 제3자 리뷰 (Gemini)

```
아래 <스펙/계획/디자인/카피>를 다음 페르소나 관점에서 각각 비평해줘.
페르소나: <회의적 PM> / <보안 리뷰어> / <처음 쓰는 사용자> / <한국어 네이티브 마케터>
각 페르소나마다: 가장 큰 우려 1~2개 + 구체적 개선 제안. 두루뭉술 금지.
마지막에 한 줄 종합 판단.

대상:
<artifact>
```

페르소나를 **이름으로** 지정하는 것이 요점이다 — "여러 관점에서 봐줘"는 한 목소리의 변주만
돌려준다. 돌아온 비평은 겹치는 것끼리 묶어 사용자에게 요약하고, 행동할 가치가 있는 것을
표시한다. 조용히 채택하지 마라 — 결정의 입력이다.

## Mode S — 간결화·재구조화 (Codex)

```
너는 테크니컬 에디터야. 아래 글을 간결하고 명료하게 다듬어줘.
- 목표: <절반 길이 요약 / 목차+섹션 구조화 / 표로 재구성 / README 골격 등>
- 유지: <반드시 남길 사실·용어·링크>. 의미 왜곡 금지, 새 주장 추가 금지.
- 형식: <markdown 표 / bullet / 번호 목차 등>
후보 2개, 설명 없이 "## 후보 1 / ## 후보 2" 로 구분해서.

원문:
<text>
```

Match the prompt language to the target text's language. For *structure-only* work
say explicitly "문장 표현은 바꾸지 말고 구조만" — otherwise Codex also rewrites
sentences while restructuring, and you can no longer tell which change was which.

## Mode I — 이미지 생성

**Codex (기본, OUT_DIR 로 직접 저장)**

```
현재 디렉토리에 <name>.png 파일로 이미지를 생성해서 저장해줘.
- 내용: <subject — 무엇이 어디에>
- 스타일: <flat / 3D / watercolor / line-art 등> · 배경: <white / transparent / ...>
- 비율: <정사각 / 16:9 등> · 이미지 안에 텍스트 금지
```

**Gemini (artifact store 수거)**

```
이미지 생성 도구로 이미지를 하나 생성해줘:
- 내용: <subject> · 스타일: <flat / watercolor / ...> · 배경: <white / ...>
- 이미지 안에 텍스트 금지. 완료 후 생성된 파일명만 알려줘.
```

Workflow: generate into a scratch dir → view the file yourself (Read) to
sanity-check it matches the ask → report the path → the user decides the final
location. Before generating a variation, confirm the specific change wanted rather
than looping speculatively — every iteration is a full-cost regeneration.

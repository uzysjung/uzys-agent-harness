# natural-korean 스킬 개선 — human-proofreader-mcp 참고 조사

> 이슈 #928 · `/deep-research` 결과(2026-11-02). 웹 검색 → 출처 수집 → 주장마다 3표 반박 검증(2표 이상 반박이면 기각) → 종합.
> 출처 17개 · 추출 주장 84개 · 검증 25 · 통과 16 · 기각 9.
> 아래 '결과'는 검증을 통과한 주장이다. '추론'이라 적힌 문장과 리포 관측은 검증 투표 대상이 아니었다.

## 요약

human-proofreader-mcp 는 원격 MCP 서버다. 실제로 문장을 고치는 일은 Upstage Solar Pro 4 가 한다. 결정적 코드는 두 군데에만 있다. 하나는 정규식과 통계로 가독성 점수를 매기는 부분이고(번역투 9종, 피동, 명사화, 완곡, 문두 접속사, 상투구 9종, 연결어미 뒤 쉼표, 종결어미 반복, -성/-적/-화 밀도), 다른 하나는 사실·인용·말투·변경률을 원문과 대조하는 부분이다. 저장소에는 이 규칙들이 효과가 있다는 측정 자료가 없다. 라이선스도 README 에는 MIT 라고 적혀 있지만 LICENSE 파일이 없어 불분명하다. 우리 스킬(45줄)은 말투 보존, 사실 보존, 새 주장 금지, 맥락 판단, 통용 약어 유지를 이미 담고 있어서 새로 얻을 것은 적다. 효과가 실제로 측정된 것은 하나다. ACL 2025 KatFish 논문에서 LLM 이 쓴 한국어 에세이는 연결어미 뒤에 쉼표를 찍는 비율이 19.83% 로, 사람의 4.10% 보다 크게 높았다. 한글 맞춤법도 일반 접속어 뒤에는 쉼표를 쓰지 않는 것을 원칙으로 한다. 그래서 변경안은 네 가지로 좁힌다. 쉼표 문장 하나를 추가하고, '빨간 펜' 기준으로 문장 하나를 교체하고, 확인 문장 하나에 길이·상투구·말투 등급 점검을 합친다. 이중 피동 예외는 국립국어원 근거를 확인한 뒤에만 넣는다. 문장 길이·접속사 비율 같은 수치 기준, 고정 목록, MCP 동봉은 넣지 않는다. 효과 근거가 없고 우리 원칙 4·6과 부딪히며, 동봉하면 설치자의 글이 외부로 전송되고 하루 호출 한도와 비용 문제가 생기기 때문이다.

## 결과

### 1. (high · 투표 3-0 (병합: [2][8][9]))

[① 구조] human-proofreader-mcp 는 모델에 기대는 교정기다. 문장 재작성은 Upstage Solar Pro 4(기본값 solar-pro4, 환경변수로 바꿀 수 있음)가 맡는다. 진단(readability)과 대조(compare/fidelity)는 LLM 을 부르지 않는 결정적 코드다. 도구는 6개다. Solar 를 부르는 것은 proofread(깊이에 따라 1~3콜), read_through(1콜), suggest(1콜)이고, 무료인 것은 readability(0~100점), compare, usage 다.

- 근거: llms.txt 원문: 'Upstage Solar Pro 4가 문장을 손보고, 사실·인용·말투가 그대로인지는 코드가 판정합니다'. readability.ts 머리 주석: 'LLM 호출이 없으므로 언제나 같은 입력에 같은 점수가 나온다'. 이 파일은 ./text 외에는 import 가 없고 네트워크 호출도 없다. fidelity.ts 머리 주석: 'LLM 호출 없음 — 판정은 언제나 코드가 한다'. /mcp.json 매니페스트에도 6개 도구와 각 비용이 같게 적혀 있다. readability.ts 주석은 재는 대상을 'AI가 썼는지 여부가 아니다. 독자가 한 번에 읽어내는지다'라고 밝힌다. 저장소 HEAD 는 7bd689e(2026-10-26)이고 마지막 push 는 2026-10-27 이다.
- 출처: https://human-proofreader-mcp.toy.x.upstage.ai/llms.txt · https://github.com/SolarLLM/human-proofreader-mcp · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/fidelity.ts

### 2. (high · 투표 3-0 (병합: [3][4]))

[① 결정적 규칙 목록] readability.ts 가 세는 항목은 다음과 같다. 번역투 정규식 9종: ~에 대해(서), ~에 있어(서), ~를 통해, ~와 관련하여, ~에 기반하여/~을 바탕으로, 가지고 있다, ~을 위해, 이중 조사(에서의·에로의·으로의·에의·(으)로부터의), ~라는 점에서. 피동: 이중 피동(되어진·보여진 등)과 ~에 의해. 명사화: ~하는 것이다, ~에 다름 아니다. 완곡: ~로 보인다/판단된다, ~인 듯하다, 이중 완곡 2형태. 문두 접속사: 또한·따라서·즉·아울러·결론적으로 등. 상투구 9종: 기록적인 성과, 괄목할 만한, ~로 평가된다, 주목받-, 시사하는 바가 크다, 의미가 크다, 중요한 역할, 혁신적·획기적·압도적·파격적·폭발적·전례 없는, ~할 때다. 그 밖에 연결어미(고·며·지만·면서·아서·어서) 뒤 쉼표, 연결어미가 3개 이상 이어진 문장, 같은 종결어미가 4번 넘게 이어지는 경우, -성/-적/-화 밀도(7% 초과 시 감점), 90자 넘는 문장, 문장 길이 변동계수, 평균 문장·문단 길이를 잰다. 이 규칙들은 감점만 하고 고치지는 않는다. 그리고 9종 가운데 ~에 대해 정규식은 실제 한국어에서 한 번도 걸리지 않는다.

- 근거: 검증자가 HEAD 파일 24~80행의 TRANSLATIONESE·PASSIVE·NOMINALIZATION·HEDGE·OPENING_CONNECTIVES·CLICHES·ENDING_COMMA·CLAUSE_CONNECTIVE·HANJA_SUFFIX 표를 한 줄씩 대조했다. ~에 대해 패턴 /에\s*대(?:해|하여|한)\b/g 는 u 플래그가 없어서 JS 가 한글을 비단어 문자로 취급하고, 그래서 \b 가 성립하지 않는다. node 로 실행해 보니 '이 문제에 대해 논의한다'는 0건, 대조군 '이를 통해'는 1건이었다. 실제로 탐지에 쓰이는 패턴은 8종이다. tools.ts 는 readability 와 compare 도구를 'Solar 호출 없음·무료'로 등록한다. 이 목록은 점수를 내는 데만 쓰이고, 실제 번역투 교정은 LLM 프롬프트가 맡는다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/tools.ts

### 3. (high · 투표 3-0 (병합: [5][6]))

[① 교정 프롬프트] Solar 에게 주는 시스템 프롬프트(prompts.ts)에는 두 묶음이 있다. 첫째는 순서가 정해진 8단계 'CRAFT' 다. 90자를 넘거나 절이 셋 이상 물린 문장 나누기, 주어와 서술어 붙이기(세 어절 넘는 수식 분리), 번역투 되돌리기(~에 대해 논의한다→~를 논의한다, ~에 있어→~에서, ~를 통해→~로/~해서, 가지고 있다→강하다, 이중 조사 풀기), 피동을 능동으로(이중 피동은 반드시 고침), 명사화 풀기, 문두 접속사 '절반쯤' 덜고 완충 표현은 단언으로, 같은 종결어미가 4번 넘게 이어지면 한둘 바꾸기, 전문용어가 아니면 한자어보다 일상어 쓰기(구어화 예외)가 들어 있다. 둘째는 'NEVER_TOUCH' 다. 사실·수치·날짜·고유명사·인용 불변, 내용 가감 금지, API·LLM·GPU·MCP 같은 약어는 원어 유지, 마크다운 구조 유지, 문체 등급을 올리지도 내리지도 않기, 새 상투구·이모지·굵게·글머리표 금지가 들어 있다. 이것들은 모델에게 주는 지시일 뿐 결정적 검사가 아니고, 효과를 잰 자료도 없다.

- 근거: prompts.ts 44~61행은 CRAFT, 28~38행은 NEVER_TOUCH 다. 첫 커밋 281c595(2026-08-23) 이후 바뀐 적이 없다. NEVER_TOUCH 6번 하위 절에는 ''~인데요/~거든요' 같은 구어 종결을 지웁니다'라는 문장이 있다. 같은 파일의 다른 지시('구어 종결을 살립니다')와 반대이므로 '지우지 않습니다'의 오타로 보인다. 그대로 옮기면 안 된다. 141행 주석은 '실측에서 한다체 원고가 통째로 합쇼체로 올라왔다'고 적고 있다. 말투 유지 지시만으로는 부족했다는 저자 자신의 관측이다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/fidelity.ts

### 4. (high · 투표 3-0 (병합: [0][8]))

[① 대조 게이트] 교정본은 코드가 판정한다. 채택 불가(abort)는 다음 경우다. 원고에 없던 문장이 생김(content_injected), 없던 수치가 생김(number_injected), 인용이 바뀜(quote_altered), 말투가 뒤집힘(register_switched, 한다체→합쇼체 등), 글자 변경률 50% 이상(over_edited), preserve 지정 구간 훼손(preserve_broken), 빈 출력(empty_output). 경고는 변경률 30~50%(heavy_edit), 상투구 주입, 분량 15% 넘게 증가(length_grown), register_raised, 구어 소거(colloquial_erased), 소제목 유실(heading_lost) 경우다. 채택 불가는 권고일 뿐 도구가 막지는 않는다.

- 근거: fidelity.ts 의 상수는 CHANGE_WARN=0.3, CHANGE_ABORT=0.5 이고, 분량 경고는 lengthDelta>0.15 일 때 뜬다. README 대조 게이트 표와 코드가 일치한다. README 표에는 preserve_broken, empty_output, register_raised, colloquial_erased, heading_lost 가 빠져 있어 코드가 더 넓다. 스킬 본문은 이 판정을 코드로 강제할 수 없다. 옮길 수 있는 것은 '마지막에 스스로 대조하라'는 지시뿐이다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/fidelity.ts · https://human-proofreader-mcp.toy.x.upstage.ai/llms.txt

### 5. (medium · 투표 2-1 ([1]))

[② 편집 원칙의 이식성] README 의 편집 원칙 4가지는 프롬프트 문장이라 스킬 본문으로 옮길 수 있다. 빨간 펜 원칙(고칠 이유를 한 문장으로 말할 수 없으면 손대지 않음), 덜어내기(분량이 늘면 경고), 말투는 필자의 것(한다체→합쇼체도 개작), 사실 불변(없던 문장·수치가 생기면 채택 불가)이다. 그런데 이 중 셋(말투, 사실, 덧붙이지 않음)은 우리 SKILL.md 에 이미 거의 같은 뜻으로 있다. 새로 얻는 것은 두 가지다. '한 문장으로 이유를 댈 수 있는가'라는 판정 기준과, '분량이 늘었는지 / 새 상투구·강조가 생겼는지'라는 확인 항목이다. 효과는 코드 게이트에서 나오는데 이 게이트는 옮겨지지 않는다.

- 근거: README 원문: '빨간 펜 원칙 — 고칠 이유를 한 문장으로 말할 수 없으면 손대지 않습니다', '좋은 교정은 덧붙이지 않습니다. 분량이 늘면 경고가 뜹니다', 'AI 티를 지우는 도구가 아닙니다. 독자가 두 번 읽게 되는 자리를 없애는 도구입니다'. 우리 SKILL.md 의 해당 문장은 다음과 같다. 14행 '원래 말투·구조를 유지한다', 27행 '단순한 취향 차이는 수정 사유로 삼지 않는다', 29행 '요청 없이 새 주장·근거·감정·비유를 보태지 않는다'와 '정보·주장·수치…달라지지 않았는지 확인', 23행 '이미 자연스러운 문장은 그대로 둔다', 18행 '통용 약어는 유지한다'. 반대표 1의 근거는 셋이었다. 효과는 코드 게이트에서 나오고, 우리 스킬에 이미 있는 내용이며, prompts.ts 141행 주석처럼 지시만으로는 말투가 뒤집힌 실측이 있다는 점이다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts · templates/skills/natural-korean/SKILL.md

### 6. (high · 투표 3-0 ([13]) + 2-1 ([12]) 병합)

[② 효과가 측정된 유일한 항목: 연결어미·접속어 뒤 쉼표] ACL 2025 KatFish 논문은 GPT-4o, Solar, Qwen2 72B, Llama3.1 70B 가 생성한 1,624편과 사람 글 470편을 비교했다. 에세이에서 연결어미 뒤에 쉼표가 오는 비율은 LLM 19.83%, 사람 4.10% 였다. 쉼표가 하나라도 있는 문장 비율은 LLM 61.03%, 사람 26.31% 였다. 시와 논문 초록에서도 방향이 같았다. 한글 맞춤법 문장 부호 규정은 '그러나·그러므로·그리고·그런데' 같은 일반 접속어 뒤에는 쉼표를 쓰지 않는 것을 원칙으로 한다. human-proofreader 도 이 쉼표를 '만연체의 가장 뚜렷한 표지'로 감점한다. 우리 스킬에는 문장 부호 지침이 전혀 없다.

- 근거: 수치는 v2 부록 F.1 과 v5 부록 G.1 에서 같다. 시는 15.57% 대 4.68%, 논문 초록은 28.01% 대 13.27% 다. 논문은 원인을 영어 구두점 관습이 옮겨 온 것으로 추정하지만('may internalize'), 검증하지는 않았다. 그리고·그러나 뒤 쉼표는 정성적으로만 언급하고 수치는 없다. 한글 맞춤법 쉼표 규정 원문: '일반적으로 쓰이는 접속어(그러나, 그러므로, 그리고, 그런데 등) 뒤에는 쓰지 않음을 원칙으로 한다'. 해설은 '필요하면 쓸 수 있다'고 덧붙인다. 원 주장의 '테스트셋'은 '데이터셋'의 오기다. 학습은 GPT-4o 로 하고 평가는 나머지 세 모델로 했다.
- 출처: https://arxiv.org/html/2503.00032v2 · https://doi.org/10.18653/v1/2025.acl-long.1030 · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts

### 7. (medium · 투표 2-1 ([11]))

[④ 국립국어원 기준과의 대조] 국립국어원의 공공언어 진단 기준(2010)은 정확성을 '표기의 정확성'과 '표현의 정확성'으로 나눈다. 진단 항목은 어문규범 준수, 적절한 어휘, '우리말답게 문장을 사용하는가'이다. 번역투의 근거로 쓸 수 있는 공식 항목은 이 마지막 하나다. 이 문서에는 번역투의 세부 유형이 나열되어 있지 않다. 2017년 중앙행정기관 진단에서는 '우리말답지 않은 표현' 범주가 번역 투, 과도한 명사화, 불필요한 한자어를 포함했다(2차 자료). 판단 기준도 'AI 가 썼는가'가 아니라 '독자에게 우리말답게 읽히는가'라서 human-proofreader 및 우리 스킬과 같은 방향이다.

- 근거: 출처는 『새국어생활』 2012년 1호 국립국어원 소식(211~212쪽)이다. 2010 기준을 요약한 소식지이고 기준 원문은 아니다. PDF 전문에서 '번역'을 검색하면 무관한 두 곳만 나온다. 2017년 범주는 김미선·이지용(2018) 「공공언어 문장 오류 유형 분석 연구」를 거쳐 확인한 것이다. '소통성(쉬운 용어·정보의 양)이 우리 스킬의 영어·장황함 항목에 대응한다'는 주장은 0-3 으로 기각됐으므로 쓰지 않는다.
- 출처: https://www.korean.go.kr/nkview/nklife/2012_1/22_0116.pdf · https://cau.scholarworks.kr/handle/2019.sw.cau/2514

### 8. (medium · 투표 human-proofreader 라이선스는 검증자 4명이 독립적으로 같은 사실 보고 · im-not-ai 는 2-1 ([7]))

[① 라이선스] human-proofreader-mcp 는 README 에 MIT 라고 적혀 있다. 그러나 GitHub API 의 license 값이 null 이고 저장소에 LICENSE 파일이 없어 실제 라이선스는 불분명하다. 규칙·문구를 글자 그대로 옮기지 말고 뜻만 풀어 쓴다. 비교 대상인 epoko77-ai/im-not-ai(Humanize KR v2.3.2)는 LICENSE 파일과 plugin.json 모두 MIT 이고, 분류 체계 문서까지 포함한 저장소 전체에 적용된다고 밝힌다. 저작권 표기와 라이선스 사본을 함께 두면 각색할 수 있다. im-not-ai 는 Claude Code 플러그인(README 에는 스킬 3개라고 적혀 있지만 실제로는 4개, 서브에이전트 9개), Codex 설치 스크립트, Copilot CLI 플러그인, Gemini CLI 확장(별도 룰북 47종), 비공식 커뮤니티 opencode 포트로 배포된다.

- 근거: 검증자들이 human-proofreader 를 gh api 로 조회해 license=null 과 LICENSE 파일 부재를 확인했다. im-not-ai 는 spdx_id MIT 이고 README 775행 '코드·스킬·에이전트 정의·분류 체계 문서를 포함한 본 리포 전체에 적용됩니다'이다. 다만 im-not-ai 의 분류 체계(10범주·85패턴), 효과 수치(연결어미 쉼표 4.84배 등), 오탐 감사 수치에 대한 주장은 모두 검증에서 기각(0-3·1-2)됐다. 내용 근거로는 쓰지 않는다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp · https://github.com/epoko77-ai/im-not-ai

### 9. (high · 투표 3-0 ([10]))

[③ 비용·외부 호출] 호스팅된 human-proofreader 의 무료 한도는 하루 Solar 100콜이다. 콜 단위로 세고 KST 자정에 초기화된다. 클라이언트 단위로 세는데, x-client-id 헤더나 IP 의 해시로 구분한다. 한도를 넘으면 설치자가 자기 키를 X-Upstage-Api-Key 또는 X-OpenRouter-Api-Key 헤더로 넘겨야 하고, 그 요금은 설치자의 계정에 청구된다. 통독 1회와 교정 1회면 2콜이 빠진다. 호스트가 toy.x.upstage.ai 라서 실험 배포로 보이며, 조건이 바뀔 수 있다.

- 근거: llms.txt 60~81행이다. 코드에서도 확인된다. lib/quota.ts 는 FREE_DAILY_LIMIT 기본값 100 과 kstDay()(UTC+9)를 쓴다. lib/provider.ts 는 본인 키를 넣으면 metered:false 로 처리한다. Redis 가 없으면 인스턴스 단위로 세므로 최선 노력 수준이다. 2026-11-02 기준 정보다.
- 출처: https://human-proofreader-mcp.toy.x.upstage.ai/llms.txt · https://github.com/SolarLLM/human-proofreader-mcp

### 10. (high · 투표 3-0 ([14][15]))

[③ MCP vs 스킬 — Codex 에서 확인한 사실] Codex 스킬은 점진 공개(progressive disclosure) 방식이다. 처음에는 이름, 설명, 파일 경로만 컨텍스트에 오르고, 이 목록의 예산은 컨텍스트 창의 최대 2%(창 크기를 모르면 8,000자)다. SKILL.md 본문은 그 스킬을 쓸 때만 읽힌다. 그래서 본문에 문장 몇 줄을 더해도 상주 비용은 늘지 않는다. MCP 서버는 config.toml 의 [mcp_servers.<이름>] 표나 `codex mcp add` 로 등록한다. 전송 방식은 로컬 STDIO 프로세스와 streamable HTTP 두 가지다. human-proofreader 를 붙이면 설정 항목이 하나 늘고, 원격 HTTP 엔드포인트를 부르게 된다.

- 근거: 원 주장은 점진 공개 인용의 출처를 mcp.md 로 달았지만 틀렸다. 실제 문구는 skills 페이지에 있고, 이 페이지는 learn.chatgpt.com/docs/build-skills 로 308 리다이렉트된다. mcp.md 는 learn.chatgpt.com/docs/extend/mcp.md?surface=cli 로 리다이렉트되며, STDIO 와 streamable HTTP 두 방식, [mcp_servers.x] 표, `codex mcp add --url` 을 명시한다. 플러그인으로 MCP 를 묶는 경로(plugins.<p>.mcp_servers)도 결국 config.toml 을 거친다. Claude Code, OpenCode, Antigravity 의 같은 동작은 이번 조사에서 확인하지 않았다.
- 출처: https://developers.openai.com/codex/skills · https://developers.openai.com/codex/mcp.md

### 11. (medium · 투표 종합 판단 — 위 확인 사실([8][9][10][14][15])에서 유도)

[③ 판정] MCP 로 붙이지 말고 스킬 본문만 고친다. 이유는 네 가지다. (a) MCP 는 에이전트가 그 도구를 부를 때만 작동한다. 설치자가 받는 일반 한국어 답변에는 영향이 없다. (b) 설치자의 원고를 외부(Upstage 실험 호스트)로 보내게 되고, 하루 100콜 한도는 IP 기준으로 공유되며, 넘으면 본인 키를 넣고 요금을 내야 한다. (c) 재작성을 설치자가 쓰는 모델이 아니라 Solar 가 한다. (d) 4개 CLI 마다 MCP 설정을 따로 해야 하는데, 이번 조사에서 확인한 것은 Codex 뿐이다. 무료 결정적 도구(readability/compare)만 로컬 STDIO 로 묶는 방안은 라이선스가 불분명하고 정규식에 결함이 있어서 동봉하지 않는다.

- 근거: 판정 기준은 '설치자가 받는 한국어 글이 실제로 더 자연스러워지는가'이고, 이에 비추어 정리한 판단이다. 스킬은 설치자가 쓰는 모든 한국어 출력에 적용되고 외부 호출이 없다(Codex 는 본문이 상주하지 않음을 확인했다). MCP 는 호출 시점, 한도, 데이터 반출, 모델 교체가 함께 따라온다. 설치자가 원하면 스스로 붙일 수 있는 선택지로 문서에 한 줄 남기는 것은 가능하다.
- 출처: https://human-proofreader-mcp.toy.x.upstage.ai/llms.txt · https://developers.openai.com/codex/skills · https://developers.openai.com/codex/mcp.md · https://github.com/SolarLLM/human-proofreader-mcp

### 12. (medium · 투표 근거 주장 3-0 ([13]) · 효과 전이는 미측정)

[변경안 A — 추가, 근거 가장 강함] 표현 원칙 3('반복과 군더더기를 줄인다') 끝에 한 문장을 추가한다. 초안: “연결어미(‘~고’, ‘~며’, ‘~지만’) 뒤와 ‘그리고·그러나·그런데’ 같은 접속어 뒤에는 습관적으로 쉼표를 찍지 않는다. 끊어 읽지 않으면 뜻이 헷갈릴 때만 쓴다.” 예시 절에는 한 줄을 추가한다. “설정을 바꾸고, 다시 실행한다.” → “설정을 바꾸고 다시 실행한다.”

- 근거: 근거는 세 가지다. 측정된 차이(19.83% 대 4.10%), 한글 맞춤법의 명시적 원칙, 독립적인 두 도구(KatFish 와 human-proofreader)가 같은 표지를 지목한 점이다. '필요하면 쓴다'를 남겨 둔 것은 맞춤법 해설과 우리 원칙 6('표현 하나만으로 문제 삼지 않는다')에 맞추기 위해서다. 효과의 한계도 있다. 측정 대상은 2024년 모델이었고, 쉼표를 줄였을 때 사람이 더 자연스럽다고 판단하는지는 측정되지 않았다.
- 출처: https://arxiv.org/html/2503.00032v2 · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts · templates/skills/natural-korean/SKILL.md

### 13. (low · 투표 출처 주장 2-1 ([1]) · 효과 미측정)

[변경안 B — 교체, 문장 수 불변] 퇴고와 확인 1문단의 “단순한 취향 차이는 수정 사유로 삼지 않는다.”를 “고칠 이유를 한 문장으로 말할 수 없으면 고치지 않는다. 취향 차이는 이유가 아니다.”로 바꾼다.

- 근거: 기존 문장은 '취향'의 범위가 모호하다. 바꾼 문장은 수정할 때마다 모델이 스스로 적용할 수 있는 판정 기준을 준다. 과잉 교정(변경률 30~50% 경고 구간)을 줄이려는 의도다. 다만 효과를 잰 자료는 없다. 라이선스가 불분명하므로 원문을 그대로 쓰지 않고 뜻만 풀었다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp · templates/skills/natural-korean/SKILL.md

### 14. (medium · 투표 근거 주장 3-0 ([0][6]) · 효과 미측정)

[변경안 C — 기존 확인 문장 확장] 퇴고와 확인 3문단의 “새로운 반복과 마크다운 깨짐이 없는지 확인한다.”를 다음으로 바꾼다. “새로운 반복·상투구·강조·목록과 마크다운 깨짐이 없는지, 원문보다 눈에 띄게 길어지거나 말투 등급(합쇼체·해요체·한다체)이 바뀌지 않았는지 확인한다.”

- 근거: human-proofreader 가 코드로 거르는 실패 장면(분량 15% 증가, 상투구 주입, 말투 등급 변경, 새 굵게·글머리표)을 이미 있는 확인 단계 한 문장에 합쳤다. 저자 실측에 따르면 말투 유지 지시만으로는 한다체가 합쇼체로 올라갔다(prompts.ts 141행). 그래서 지시를 늘리기보다 마지막 대조 항목에 넣는 편이 옮길 수 있는 최선이다. 코드 게이트만큼 확실하게 지켜지지는 않는다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/fidelity.ts · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts · templates/skills/natural-korean/SKILL.md

### 15. (low · 투표 출처 주장 3-0 ([4][5]) · 규범 근거 미검증)

[변경안 D — 조건부, 근거 확인 후] 표현 원칙 6에 이중 피동 예외를 넣는 방안이다. 초안: “… 피동문·격식체·영어 자체는 수정 사유가 아니다. 다만 ‘되어지다·보여지다’ 같은 이중 피동은 고친다.” 국립국어원이 이중 피동을 규범상 바로잡을 대상으로 보는지 확인한 뒤에만 넣는다.

- 근거: human-proofreader 는 이중 피동을 '반드시 고친다'로 정했다(CRAFT 4). 우리 원칙 6은 피동문 자체를 수정 사유에서 빼므로, 지금 문장대로라면 이중 피동도 그대로 둘 수 있다. 이번 조사에서는 국립국어원의 규범 판정을 확인하지 않았다.
- 출처: https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts

### 16. (medium · 투표 종합 판단 — [3][4][5][6] 및 기각 주장 목록에서 유도)

[넣지 않을 것] 다음은 넣지 않는다. (1) 수치 기준: 90자, 절 3개, 문두 접속사 절반, 종결어미 4회, -성/-적/-화 7%. 효과 근거가 없고, 우리 원칙 4('문장 길이와 종결어미를 억지로 다양하게 만들지 않는다')·6과 정면으로 부딪힌다. 이 수치들은 원래 점수 계산용 휴리스틱이다. (2) 번역투 정규식 9종이나 상투구 9종 같은 고정 목록. 우리 스킬은 예시가 '일괄 치환 규칙이 아니다'라고 밝히고 맥락으로 판단한다. 원본 정규식 하나는 아예 작동하지 않고, 라이선스도 불분명하다. (3) 'AI 티 지우기'라는 목표 설정. 두 도구 모두 '독자 기준'을 명시하고, 기각된 주장들이 AI 판별 근거가 약하다는 것을 보여 준다. (4) im-not-ai 의 85패턴 분류 체계와 효과 수치. 검증에서 기각됐다. (5) NEVER_TOUCH 의 '구어 종결을 지웁니다' 문구. 오타로 보인다. (6) API·LLM 약어 유지, 사실·인용 불변, 내용 가감 금지. 우리 스킬 18·29·31행에 이미 있다.

- 근거: 판정 기준인 '규칙을 늘리는 것 자체는 목표가 아니다'에 따랐다. 효과가 측정되지 않았거나, 이미 있거나, 우리 원칙과 부딪히는 항목은 제외했다. 4개 변경안을 모두 넣어도 스킬은 2줄 남짓(예시 1줄 + 조건부 D) 늘어날 뿐이고, B·C 는 기존 문장을 교체하는 것이다.
- 출처: templates/skills/natural-korean/SKILL.md · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts · https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts · https://github.com/epoko77-ai/im-not-ai

## 한계

- 효과 근거가 약하다. 설치자가 받는 글이 '사람이 읽기에 더 자연스러워졌다'는 것을 보여 준 자료는 하나도 없다. KatFish 는 AI 글 판별 특징을 측정한 연구이고, 그마저 2024년 모델(GPT-4o·Solar·Qwen2·Llama3.1)만 대상으로 했다. Claude 를 비롯한 2026년 프런티어 모델에서도 같은 쉼표 과다가 나타나는지는 측정되지 않았다. human-proofreader 저장소에도 규칙의 효과를 평가한 자료가 없다.
- human-proofreader 의 라이선스가 불분명하다. README 에는 MIT 라고 적혀 있지만 LICENSE 파일이 없다(GitHub license=null). 문구를 그대로 복사하지 말고 뜻만 풀어 써야 한다. 변경안 B·C 는 그렇게 풀어 쓴 것이다.
- 시점에 따라 바뀔 수 있다. 호스트 toy.x.upstage.ai 는 실험 배포로 보이고, 한도(100콜/일)는 환경변수 기본값이라 바뀔 수 있다. 수치는 모두 2026-11-02 기준이다.
- 4개 CLI 를 다 확인하지 못했다. 스킬의 점진 공개와 MCP 설정 방식은 Codex 에서만 확인했다. Claude Code, OpenCode, Antigravity 의 스킬 본문 로드 방식과 MCP 도구 스키마의 상주 비용은 이번 조사에서 보지 않았다. 원 주장의 Codex 문서 URL(mcp.md)은 틀렸고, 올바른 출처는 /codex/skills 다.
- 국립국어원 자료가 약하다. 국립국어원 자료는 2010 기준을 요약한 소식지이고, 2017 진단 범주는 2차 논문을 거쳐 확인했다. 이중 피동의 규범 판정은 확인하지 않았다. 그래서 변경안 D 는 조건부다.
- 기각된 주장이 많다. im-not-ai 의 분류 체계, 효과 배수, 오탐률, 비용 수치와 '스타일 지시만으로는 AI 표지가 안 바뀐다'는 연구 주장은 모두 검증에서 기각됐다. 이번 판단의 근거로 쓰지 않았다.
- 변경안 A~D 의 확신도는 근거 사실이 아니라 '스킬에 넣으면 효과가 있을 것'이라는 판단에 매긴 것이다. 근거 사실 자체의 확신도는 각 항목에 따로 적었다.

## 열린 질문

- 변경안 A(쉼표)를 넣으면 현행 모델(Claude·GPT·Gemini)의 한국어 출력이 실제로 달라지는가? 같은 프롬프트로 스킬이 있을 때와 없을 때를 생성해 연결어미 뒤 쉼표 비율을 세고, 사람 선호도를 짧게 비교하는 소규모 A/B 가 필요하다.
- 국립국어원(표준국어대사전·온라인가나다)은 '되어지다·보여지다' 같은 이중 피동을 규범상 바로잡을 대상으로 보는가? 이 답에 따라 변경안 D 를 넣을지가 정해진다.
- Claude Code·OpenCode·Antigravity 는 스킬 본문을 필요할 때만 읽는가, 아니면 상주시키는가? 각 CLI 에서 MCP 도구 스키마는 매 세션 얼마의 컨텍스트를 차지하는가? 4개 CLI 를 모두 놓고 MCP 와 스킬을 비교하려면 이 답이 필요하다.
- human-proofreader-mcp 저자가 LICENSE 파일을 추가할 의향이 있는가? 결정적 진단 도구(readability/compare)를 로컬 STDIO 로 쓰는 선택지는 이 답에 달려 있다.

## 기각된 주장(0-3 등)

- (0-3) human-proofreader-mcp는 LLM(Upstage Solar Pro 4)에 의존하는 원격 MCP 서버다. 교정은 Solar가 하고, 사실·인용·문체가 보존됐는지는 결정적 코드가 판정한다. Solar 호출은 하루 100콜까지 무료이고, 그 뒤에는 본인 Upstage 또는 OpenRouter 키를 헤더에 넣어야 한다. 모델을 부르지 않아 한도에서 차감되지 않는 도구는 readability(0~100점)와 compare 둘뿐이다. — https://github.com/SolarLLM/human-proofreader-mcp
- (0-3) The proofreader's output quality is driven almost entirely by prompt text given to the Solar model (a model-dependent editor persona), not by deterministic rewriting; the design principle is to have the model do what a human editor does — fix where the reader stumbles, not 'remove AI tells' — and leave well-written sentences untouched. This makes the core guidance portable as skill text. — https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts
- (1-2) Humanize KR (im-not-ai), the upstream taxonomy credited by human-proofreader-mcp, classifies Korean AI-writing tells into 10 categories and 85 sub-patterns, with one more pattern on hold. Each pattern has a severity from S1 to S3. The tool detects patterns at span level and then rewrites. The 10 categories are A 번역투, B 영어 인용·용어 과다, C 구조적 AI 패턴, D AI 특유 관용구, E 리듬 균일성, F 수식·중복, G Hedging 남용, H 접속사 남발, I 형식명사 과다 and J 시각 장식 남용. — https://github.com/epoko77-ai/im-not-ai
- (0-3) Only a few patterns are shown to separate AI text from human text. The README names 6 AI tells that held up across models and tasks: C-8 대구 (parallelism, 12x), E-1 장문 결핍 (too few long sentences), C-11 연결어미 쉼표 (a comma after a connective ending), I-4 당위 (should-statements), E-2 종결 편중 (skewed sentence endings) and F-5 추상 체인 (chained abstractions). After reviewing the KatFish corpus (Park et al., 2,094 texts) and the LREAD study, the README reports that the strongest single signal in Korean is a comma after a connective ending, at 4.84x in essays. — https://github.com/epoko77-ai/im-not-ai
- (0-3) The tool needs an LLM to run. Rewriting goes through Claude-family subagents on one of 3 paths: light (1 call), standard (2 calls) or heavy (3 or more calls). Only the final structural gate is deterministic (verify_gates.py, which makes no LLM calls). The README gives a cost figure: a 10,000-character text took 610K tokens when chunked into 7 calls and 134K tokens as a single call, with quality reported as equal. — https://github.com/epoko77-ai/im-not-ai
- (0-3) 소통성 축은 공공성·정보성·용이성 세 요소로 이루어진다. 진단 항목은 차별적 표현, 권위적 표현, 정보의 형식과 양, 쉬운 용어 사용이다. 이 가운데 '쉬운 용어'와 '정보의 양'은 우리 스킬의 '불필요한 영어'와 '장황함·반복' 항목에 대응한다. — https://www.korean.go.kr/nkview/nklife/2012_1/22_0116.pdf
- (0-3) im-not-ai (Humanize KR v2.3.2, MIT) uses a taxonomy of 10 categories and 85 sub-patterns, each rated S1/S2/S3 by severity. It detects them at the span level and then rewrites the text. The categories are 번역투, 영어 인용·용어 과다, 구조적 AI 패턴, AI 특유 관용구, 리듬 균일성, 수식·중복, Hedging 남용, 접속사 남발, 형식명사 과다 and 시각 장식 남용. Several of these are not in our natural-korean skill: hedging, formal-noun overuse, rhythm uniformity, visual decoration and conjunction overuse. (The /wiki URL serves the repository README.) — https://github.com/epoko77-ai/im-not-ai/wiki
- (1-2) The pattern-based risk scoring raised many false positives on human writing. An external audit flagged 285 of 532 clean human texts (53.6%) as high risk before a fix. The post-fix figure of 0 was measured on the same calibration corpus (in-sample), and out-of-sample validation is still pending. Adding detection rules can therefore misfire on natural Korean. — https://github.com/epoko77-ai/im-not-ai/wiki
- (0-3) Telling a model to write in a more human way does not remove the measurable style markers of LLM text. The study says these markers held across all generation conditions, including prompts asking for human-like output and runs that continued from human-written text. This suggests a style instruction alone, such as a SKILL.md, may not change the measurable signs of AI writing much. Caveat: the corpus is the English RAID dataset, and neither page says Korean was included. — https://www.alphaxiv.org/ko/overview/2604.14111

## 수집한 출처

- https://github.com/SolarLLM/human-proofreader-mcp
- https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/readability.ts
- https://github.com/SolarLLM/human-proofreader-mcp/blob/HEAD/lib/prompts.ts
- https://github.com/epoko77-ai/im-not-ai
- https://human-proofreader-mcp.toy.x.upstage.ai/llms.txt
- https://glama.ai/mcp/servers/SolarLLM/human-proofreader-mcp?locale=es-ES
- https://www.korean.go.kr/nkview/nklife/2012_1/22_0105.pdf
- https://www.korean.go.kr/nkview/nklife/2012_1/22_0116.pdf
- https://arxiv.org/html/2503.00032v2
- https://blog.pebblous.ai/report/korean-ai-humanizer-teardown-2026-08/ko/
- https://github.com/epoko77-ai/im-not-ai/wiki
- https://www.alphaxiv.org/ko/overview/2604.14111
- https://developers.openai.com/codex/mcp.md
- https://opencode.ai/docs/skills
- https://codelabs.developers.google.com/getting-started-with-antigravity-skills?hl=en
- https://standardcompute.com/providers/upstage
- https://jannikreinhard.com/agent-skills-vs-mcp/

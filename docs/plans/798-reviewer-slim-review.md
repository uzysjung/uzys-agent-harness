# PR #805 (#798) 독립 리뷰 — reviewer 에이전트 본문 감량

대상: `origin/docs/798-reviewer-criteria` @ a86533c (`templates/agents/reviewer.md` · `.claude/agents/reviewer.md` · `docs/plans/798-reviewer-slim-judgment.md`)
판정: **PASS with notes** — 리뷰어의 행동을 나쁘게 바꾸는 손실은 찾지 못했다. 다만 본문이 서로 어긋나는 곳이 한 군데 생겼고(HIGH-1), 이 PR 의 통과 조건인 "본문이 서로 맞는다"에 걸리므로 **이 PR 안에서 한 줄 고치기를 권한다**. 블로커는 없다.

## 직접 확인한 증거
- 두 사본: 바뀐 뒤에도 바뀌기 전에도 3행 description 의 `all` 한 단어만 다르다(`diff` 로 대조). 크기 4,622 → 3,360 B · 4,626 → 3,364 B(`wc -c`) — 판정표의 수치와 맞는다.
- 전체 CI: 격리 워크트리(PR 브랜치)에서 `npm run ci` 를 돌렸다 → exit 0 · 테스트 파일 159개 · 테스트 2,355건 통과 · branches 89.65%(하한 86). 워크트리는 지웠다.
- 본문을 문자열로 검사하는 테스트는 없다(`tests`·`src`·`scripts` 를 grep 했고, 같은 실행에서 `templates/agents/reviewer.md` 자신이 대조군으로 잡혔다). `src/legacy-fingerprints.ts:67` 은 옛 판의 닫힌 지문이라 현행 본문이 바뀌어도 상관없다.
- 문구를 그대로 유지한 줄을 대조했다: #791 구조 질문(26행)은 원문과 바이트가 같다. 관례 대비 길이 줄(25행)은 의문문을 평서문으로 바꿨을 뿐 뜻이 같다. CRITICAL 행동 칸(32행) "이 이슈가 해결될 때까지 Review 게이트 통과 불가"와 #794 "Fix 는 방향만"은 그대로다.

## 작성자 의문에 대한 판정

**(1) CRITICAL 에 "필수 완료 기준 미충족"을 넣은 것 — 맞다.**
- 기준 문장: 전역 원칙 4 "Blocking findings are unmet required criteria or substantiated, material risks…" · 배포 앵커 `templates/CLAUDE.md:79` "Resolve gaps in required outcomes and substantiated material risks".
- 실제 게이트가 읽는 값: 개발 사본 `.claude/rules/ship-checklist.md:15` 는 "CRITICAL 이슈 없이 통과"를 Review 게이트로 쓴다. 전에는 필수 기준 미충족이 HIGH("합리적 사유 있으면 예외")로 빠져 이 게이트를 통과할 수 있었다. 이는 전역 원칙의 "Do not weaken criteria … to claim success"와 어긋난다. 이번 변경이 그 틈을 닫는다.
- 함께 따라오는 변화(손실은 아니다): 중대하지 않은 보안 결함은 CRITICAL 에서 HIGH 로 내려간다. "데이터 유실 **가능성**"이 "입증된 중대 위험"이 된 것도 완화가 아니다. 위험은 원래 가능성을 뜻하고, "입증"은 그 경로를 근거로 보이라는 뜻이며, 80% 확신 필터(Step 4)가 이미 같은 요구를 했다. 둘 다 전역 블로커 정의와 맞는 의도된 변화로 판정한다.

**(2) "구현자의 요약이 아니라 산출물과 실행 결과로 확인한다" — 새 규칙이 아니다. 있던 레인 원칙이다.**
- 개발 쪽 근거: `.claude/CLAUDE.md` 대원칙 "검증은 … 구현 보고를 읽는 대신 직접 다시 돌려 증거를 얻는다" · `.claude/rules/ship-checklist.md:15` "구현자의 보고를 읽고 승인하는 것은 판정이 아니다".
- 배포 쪽 근거: `templates/CLAUDE.md:75` "Base conclusions on actual artifacts and observed behavior" · `templates/skills/model-orchestration/SKILL.md:138-141` "actual artifacts, and execution evidence … the draft alone may carry the author's mistaken assumptions".
- 전역 근거: 원칙 4 "assess both the criteria and the work, not merely the author's summary".
- 설치자 쪽에도 같은 원칙이 이미 도달하므로 리뷰어 본문이 범위를 넓힌 것이 아니다. reviewer 의 `tools` 에 Bash 가 있어 직접 실행도 가능하다.

## Findings

[HIGH-1] 선호를 "따로 적는다"와 "보고하지 않는다"가 동시에 있다
File: templates/agents/reviewer.md:23 · :35 (개발 사본 같은 줄)
Issue: 23행은 "그 밖의 개선과 **선호는** 블로커와 섞지 않고 **따로 적는다**"고 하고, 35행 LOW(스타일 · 선호)는 "프로젝트 컨벤션 위반이 아니면 **보고하지 않는다**"고 한다. 컨벤션 위반이 아닌 선호에 대해 두 지시가 반대다. 23행은 앵커 §5 "keep … preferences separate"를 옮긴 새 문장이고 35행은 옛 Confidence 줄(판정표 #23)을 접은 것이라 이 PR 에서 처음 생긴 충돌이다. 직전 #794 가 고친 결함("서로 반대인 두 지시")과 같은 종류다. 영향은 스타일 지적이 보고에 섞이느냐 정도로 작다. 그래도 "본문이 서로 맞는다"가 이 PR 의 통과 조건이다.
Fix(대체 문구, 23행 해당 문장): "그 밖의 개선은 블로커와 섞지 않고 HIGH 이하로 따로 적는다 — 스타일 선호는 LOW 행 기준대로 거른다."

[MEDIUM-1] 판정표 #7 의 "접음" 근거가 절반만 덮는다
File: docs/plans/798-reviewer-slim-judgment.md (판정표 #7)
Issue: "실행 결과로 확인"은 "기존 테스트가 통과하는가"는 덮지만 "새 기능에 대한 테스트가 있는가"(회귀 보호가 있느냐)는 덮지 않는다. 지금 기준이 덮는 이 질문에 대한 행동은 이렇다: 테스트를 완료 기준이나 프로젝트 테스트 룰이 요구하면 미충족 → 블로커가 되고, 요구하지 않으면 개선(HIGH 이하)이 된다. 행동 손실은 아니라고 판정한다(완료 기준이 요구하는 경우 블로커로 잡힌다). 다만 판정표의 이유가 실제 근거와 다르다.
Fix: #7 이유 칸에 "새 테스트 유무는 완료 기준·테스트 룰이 요구하면 미충족(블로커), 아니면 개선 항목으로 남는다"를 덧붙인다. 본문은 바꾸지 않는다.

[MEDIUM-2] CRITICAL 기준에서 "데이터 유실"이라는 단어가 빠졌다
File: templates/agents/reviewer.md:23 (CRITICAL 은 32행이 23행을 가리킨다)
Issue: 원래 CRITICAL 은 "보안 취약점, **데이터 유실** 가능성"이었고 지금은 "데이터 **무결성**"이다. 표준 정의(정확성 · 완전성)로 읽으면 유실은 무결성 안에 들어가므로 뜻이 사라진 것은 아니다. 그러나 한국어 "데이터 무결성"은 DB 일관성 쪽으로 먼저 읽힌다. 이 리포의 리뷰에서 가장 무거운 종류가 "설치자 파일이 지워진다"인데, 그 단어가 본문에서 없어졌다.
Fix: 23행 "데이터 무결성"을 "데이터 유실 · 무결성"으로 바꾼다(두 글자 비용).

[LOW-1] 근거 없이 금지를 하나 더한다
File: templates/agents/reviewer.md:23 "— 점검 목록을 훑지 않는다"
Issue: 판정표 #16 의 근거는 "기본 행동을 막는 한 줄"뿐이다. 리뷰어가 축을 기계적으로 훑어서 결과가 나빠졌다는 관측은 제시되지 않았다. 뒤집으면 변경 종류만 보고 다른 축의 위험(예: 문서처럼 보이는 변경이 설정을 바꾸는 경우)을 건너뛸 여지가 생긴다. 다만 같은 문장의 블로커 4축(정확성 · 보안 · 데이터 · 사용성)이 최소 목록 구실을 하므로 실해는 작다.
Fix: 선택 사항이다. "위험을 어디서 찾을지는 변경의 종류가 정한다"만 남기고 금지 절을 빼도 판정표 #16 의 목적은 유지된다.

## 손실 여부 — 지운 항목을 뜻으로 대조한 결과
- `git diff --staged` · `git diff` 블록: 지워도 된다. 커밋된 PR 브랜치에서는 빈 결과를 보여 범위를 틀리게 잡게 한다(판정표 #4 근거에 동의).
- 주변 코드(import · 호출 사이트) 읽기: 방법 지식이다. "산출물로 확인"이 같은 쪽으로 이끈다. 손실 없음.
- 보안 5항목 · 성능 4항목 · 가독성 · 단일 책임 · 의존성 방향: 블로커 4축과 HIGH/MEDIUM 정의가 받는다. 손실 없음.
- 문서 · UI · QA 모드: "산출물 유형을 받아 같은 기준으로 판정한다"는 계약이 남아 있어, plan-checker 를 은퇴시킨 대체(inventory A3)가 끊기지 않는다. 범위 커버리지 · 실행 가능성은 "필수 완료 기준"과 "정확성 위험"이 덮는다.
- SPEC/PRD 범위: Verdict 체크리스트에 남아 있다. DO NOT CHANGE 도 그대로다.
- 금지문이 이유절로 낮춰진 곳: 없다. Anti-Patterns 3줄 · 확신 80% · 바뀌지 않은 코드 건너뛰기 · 유사 이슈 통합이 모두 명령형 그대로다.

## Positive Observations
- 블로커 정의를 한 문장(23행)에 모았고 CRITICAL 이 그 문장을 가리키게(32행) 했다. 판정 기준이 세 곳(Severity · Confidence · Anti-Patterns)에 흩어져 있던 문제가 실제로 풀렸다.
- 판정표가 29행 전부에 유지 · 접음 · 제거와 이유를 달았다. 판단이 갈릴 수 있는 곳(#17 · #7)도 스스로 드러냈다.
- 관측으로 생긴 줄(#440 F-08 관례 대비 · #791 구조 질문 · #794 방향만)을 하나도 잃지 않았다.

## Verdict
- [x] CRITICAL 이슈 없음
- [x] DO NOT CHANGE 영역 미변경 (에이전트 본문 · 계획 문서만 바뀌었다)
- [x] SPEC/PRD 범위 내 (#798 · #446 가드레일: 판정표 → 독립 리뷰 → 적용)
- [ ] 본문이 서로 맞는다 — HIGH-1 의 한 줄을 고치면 충족한다(재리뷰는 필요 없다. 그 문장만 바뀐다)

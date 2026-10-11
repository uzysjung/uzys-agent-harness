# 위임 경로와 호환성

이 파일은 경로 선택과 반환 계약이다. 실제 조작은 선택한 하위 스킬과 **현재 런타임 도구
문서**를 따른다. 존재하지 않는 도구 이름을 추측하거나 없는 브라우저 연결을 만들지 않는다.
참여자·라운드 식별, 독립성 판단, 교차 반박, 전체 예산과 실패 복구, 최종 통합은 이 토론
스킬의 책임이다. 하위 스킬에는 모델·프롬프트·세션·대기 상한 같은 일반 실행 매개변수만
전달하고 서비스의 응답·실행 상태를 받는다. 토론 전용 운영 지침을 하위에 복제하지 않는다.

## 스킬 찾기

1. 세션에 노출된 스킬 목록과 사용자가 지정한 경로에서 해당 `SKILL.md`를 찾는다.
2. 프로젝트 설치는 `.claude/skills/<name>/SKILL.md`(Claude Code)와
   `.agents/skills/<name>/SKILL.md`(Codex · OpenCode · Antigravity) 두 자리, 사용자 설치는
   `~/.agents/skills` · `~/.claude/skills`이다. 같은 실경로의 링크는 같은 스킬이다.
3. `external-model-consult`는 사용자 또는 프로젝트 스킬일 수 있다. 실제로 읽은
   `SKILL.md`의 부모 디렉터리를 기준으로 `scripts/`와 `references/`를 찾는다.
   현재 작업 디렉터리의 `.claude/skills`를 무조건 가정하지 않는다.
4. 사용할 스킬·도구가 없으면 그 경로만 unavailable로 기록한다. 다른 승인된 경로로
   진행할 수 있으면 진행하고, 그렇지 않으면 준비한 brief와 정확한 필요한 조건을 전달한다.
   모델 수를 채우려고 자동 설치·로그인·구독 변경을 하지 않는다.

## 경로별 역할

| 경로 | 사용할 작업 | 확인할 점 |
|---|---|---|
| `gemini-delegate` | Gemini 웹의 독립 제안·비평·수정 | 상위 지정이 있으면 기본 이중 문의(빠른 모델 + 고성능 모델) 대신 지정 1회. 모델과 사고 강도를 별도로 기록 |
| `chatgpt-delegate` | ChatGPT 웹의 독립 제안·비평·수정 | Latest를 고정 ID로 해석하지 않음. Extra High는 모델명이 아님 |
| `genspark-delegate` | 이용 가능한 실제 모델의 제안·비평·수정 | 서비스 이름을 모델로 세지 않음. 잠긴 항목은 구독 화면이며 호출 대상이 아님. 토론에 이미지 생성 모드를 쓰지 않음 |
| `external-model-consult` Mode P | Gemini/승인된 다른 계열의 계획·설계 비평 | 번들 wrapper 사용. 실제 모델은 CLI의 resolved model 출력으로 확인. 1회의 다중 페르소나는 1모델 |
| `external-model-consult` Mode S | 최종 문안의 간결화·구조 정리 | 이 모드는 토론의 독립 사실 검증자가 아니다. 보존할 사실·예외·출처를 지정 |
| 그 밖의 사용자 승인 경로 | 작업에 맞는 독립 참여자 | 실제 모델·입출력·권한을 확인한 뒤 같은 계약 적용. 같은 모델의 역할극을 다중 모델이라고 하지 않음 |

역할은 모델 브랜드에 영구 고정하지 않는다. 다만 하위 스킬이 정한 작업 범위와 사용자의
모델 선호는 존중한다. 예를 들어 Mode S를 임의의 코드 실행/설계 토론 wrapper로 확장하지 않는다.
토론 참여자로 Codex(`codex-ask.sh`)를 쓸 때는 Mode P(계획·설계 비평) 형태로 부른다 — 위 표의 "승인된 다른
계열"이 이것이고, `external-model-consult`의 두 CLI만 설치돼 있어도 서로 다른 실제 모델 2개가 이렇게 성립한다.

## 조정자가 보내는 계약

작업 ID와 한 참여자의 한 라운드를 지정한다. 이 문서를 외부 모델에 통째로 보낼 필요는 없다.

```yaml
task_id: unique-run-id
participant_id: P1
model: actual-requested-model-label
effort: requested-or-current
round: initial # challenge, revision, targeted-verification
session: new # continue일 때 기존 URL/탭 ID를 조정자가 보관
output_dir: absolute-authorized-run-directory
remaining_calls: 4 # 조정자가 실패/보완 문의까지 포함해 관리
deadline: absolute-time-with-timezone
timeout_seconds: 180 # 이 호출의 최대 대기; 전체 남은 시간 이하
prompt: minimal-task-prompt
```

상위 지정은 하위의 기본 2모델 문의를 대체한다. 빠진 메타데이터 때문에 문의 수를 늘리지
않는다. 초기 단계가 끝나기 전에는 서로의 답을 전달하지 않는다. 모델을 바꾸면 새 참여자로
기록하고, 그 답을 이전 모델의 수정 답변처럼 이어 붙이지 않는다.

응답은 `participant_id, round, service, requested_model, actual_model, actual_effort,
status, answer/artifact_path, source_links, completion_evidence, session_id`를 담는다.
확인 불가는 `unknown`, 상태는 `complete|partial|error`, 오류는 실제 관찰과 함께
`unavailable_tool|unsupported_model|login_required|quota|timeout|content_refusal|extraction`
등으로 구분한다. **생성이 끝났다는 것과 과제를 수행했다는 것은 다르다.** 내용 없는 거절이나
주제 밖 답변은 유효한 독립 제안으로 세지 않는다.
전송/생성 상태와 의미 판정은 구분한다. 생성이 완료됐어도 주장이 섞였으면 원문을 보존하고
조정자가 `SKILL.md` §4에 따라 주장별 전달·검증·보류·제외를 결정한다. 하위 경로가 응답 전체를
임의 삭제하거나 복귀 문의를 추가하지 않는다. 복귀 요청에는 같은 participant와 대상 쟁점을
기록하고, 실제 추가 호출과 응답을 별도로 남긴다.

### external-model-consult를 연결할 때

토론의 참여자·라운드·예산·복구 정책은 **이 상위 스킬이 소유**한다. 하위 스킬에는 토론 전용
지침을 삽입하지 않는다. 실제로 읽은 하위 스킬의 모드, 권한, provider 선택, wrapper 사용법을
확인한 뒤 조정자가 맞는 wrapper를 한 번 호출하고 그 출력을 위 반환 계약으로 정리한다.
Mode P는 계획·설계 비평, Mode S는 문안 구조 정리이며 임의의 독립 사실 심판으로 확장하지 않는다.
여러 페르소나 출력은 하나의 실제 모델 결과다. 모델 선택은 하위의 Pro 선호나 사용자 지정 시에만
Codex 모델을 override하는 조건도 존중한다. 토론에 필요한 모델을 해당 모드로 부를 수 없다면
조건을 몰래 바꾸지 말고 맞는 다른 승인 경로를 고른다.

호출 전 남은 예산을 확인하고, 하위 스킬이 문서화한 호출 timeout 설정을 이번 호출의 허용
대기 이하로 둔다(설정 이름은 그 스킬의 `SKILL.md`가 기준이다). 인증·쿼터·모델 불가·timeout·거절은 부분
출력과 함께 조정자가 기록한다. 재시도, 대체 모델, 대기 연장, 사용자에게 필요한 질문도 조정자가
기존 승인·모델 고정·남은 예산 아래 한 번에 결정한다. 단독 사용 때의 fallback 제안을 별도 실행자가
자동 수행하게 맡기지 않는다. 하위의 시크릿·권한·sandbox 보호는 그대로 적용하며 조언을 자동 적용하지 않는다.

## 브라우저와 CLI

- 사용자 일반 Chrome의 기존 연결/로그인을 쓴다. 현재 허용된 도구가 우선하며 Codex의
  CUA와 Claude의 Chrome 연동은 도구 이름과 API가 다르다. 문서 예시 API가 설치를 보장하지 않는다.
- Codex **CLI**와 IDE 확장에는 브라우저 도구가 없다(공식 문서, 2026-10-11 확인). 거기서는
  브라우저 위임 경로를 `unavailable_tool`로 기록하고 CLI 경로(`external-model-consult`)만 쓴다.
  Codex 앱(ChatGPT 데스크톱)은 Settings > Computer Use의 브라우저 확장으로 연다. 앱의 내장
  Browser는 일반 브라우저와 분리된 프로필이라, 로그인된 서비스 위임은 Chrome 확장 경로다.
- 한 조정자가 탭 선택·모델 변경·입력·전송을 직렬로 한다. 각 서비스의 생성 대기는 겹쳐도 된다.
  네이티브 서브에이전트는 자료 검증/문서 검토를 맡을 수 있지만 같은 Chrome의 병렬 조작자는 아니다.
- 전송 직후 입력창이 그대로여도 중복 전송하지 않는다. 해당 사용자 메시지의 추가와 생성
  상태를 확인한다. 전송 여부가 불명확하면 먼저 읽는다.
- 완료 이벤트가 있으면 활용한다. 없으면 대상 메시지의 종료 UI + 본문 안정 재확인으로
  판정한다. 도구가 자체 대기를 제공하면 불필요한 sleep을 추가하지 않는다.
- 원문은 응답 영역만 회수한다. 사이드바·다른 대화·계정 정보를 수집하거나 다른 모델에 보내지 않는다.
  `innerText`로 빠진 링크 주소/코드 형식은 허용된 DOM 읽기로 보완한다.
- CLI는 번들 wrapper를 `bash`로 호출하며 prompt는 파일/stdin 또는 안전한 quoting으로 전달한다.
  모델 텍스트를 shell 코드에 보간하지 않는다. stdout과 stderr의 상태/실제 모델을 함께 읽는다.
- neutral cwd와 read-only sandbox는 모든 파일 읽기나 전역 지침 읽기를 막는 보안 경계가 아니다.
  wrapper의 권한 제한을 유지하고 필요한 맥락만 제공한다. 런타임이 요구하는 격리를 확보할 수
  없으면 경로를 사용하지 않는다. 시크릿 탐지 차단을 우회하지 않는다.
- 실제 전송한 뒤 실패한 호출도 예산에 포함한다. 전송 전의 모델 잠금/연결 확인 실패와
  상태 조회는 별도 기록하며 모델 호출 수에 더하지 않는다. 실행 요청으로 오해한 일반적 거절은 실제로
  문서 작성만 요청하는지 명확히 하는 1회 보완이 유익할 수 있다. 정책 거절·사용량 한도·인증
  실패를 프롬프트 반복이나 서비스 우회로 뚫지 않는다.
- 남은 실제 모델이 하나면 단일 모델 결과/부분 완료라고 알린다. 승인된 대체 모델이 있으면
  남은 예산 안에서 사용하되 모델 변경을 공개한다. 다중 모델 검증 성공이라고 보고하지 않는다.

## 설치 자리와 브라우저 전제

[Codex 공식 문서](https://learn.chatgpt.com/docs/build-skills)는 사용자 경로
`$HOME/.agents/skills`와 심볼릭 링크를 지원한다.
[Claude Code 공식 문서](https://code.claude.com/docs/en/skills)는 개인 경로
`~/.claude/skills`를 사용한다. Claude Code Desktop의 Code 화면과 CLI를 대상으로 한다.
일반 Claude 대화/Cowork의 클라우드 환경에 로컬 스킬이 그대로 전달된다는 뜻은 아니다.

하네스 설치본은 프로젝트의 `.claude/skills/<id>/`(Claude Code)와 `.agents/skills/<id>/`(Codex ·
OpenCode · Antigravity)에 같은 스킬을 둔다. 사용자 범위(`~/.claude/skills` · `~/.agents/skills`)에
두는 것은 설치자의 선택이다. 같은 실경로의 링크는 같은 스킬이다.

스킬 발견과 브라우저 연결은 별개다. 현재 런타임에 실제 브라우저 도구가 노출되어 있어야 웹
위임을 실행할 수 있다. Claude의 연결 조건은
[Chrome 공식 문서](https://code.claude.com/docs/en/chrome)를 확인한다 — 요약하면 Claude in Chrome
확장 1.0.36 이상 · Anthropic 직접 플랜 · `/login` 세션(API 키·setup-token 세션에서는 꺼진다) ·
CLI는 `--chrome` 또는 `/chrome`으로 켠다(`/chrome`에서 기본으로 켜 둘 수 있다) · Desktop의 Code 탭은 설정돼 있으면 Chrome 확장을 쓴다.
스킬만으로 연동을 설치하지 않는다.

아래 표의 **문서**는 공식 문서로 확인한 것(2026-10-11), **미확인**은 확인하지 않은 것이다.
실행 시 현재 런타임의 도구 목록이 이 표보다 우선한다.

| 표면 | 스킬 발견 | 브라우저 위임(로그인된 웹 서비스) |
|---|---|---|
| Claude Code CLI · Desktop Code 탭 | 문서 — 프로젝트 `.claude/skills`, 개인 `~/.claude/skills` | 문서 — 위 Chrome 조건을 갖추면 가능. Desktop 내장 Browser 패널은 로그인 없는 별도 프로필 |
| Claude 일반 대화 · Cowork · 클라우드 세션 | 문서 — 로컬 `~/.claude/skills`를 읽지 않는다 | 이 스킬의 범위 밖 |
| Codex CLI · IDE 확장 | 문서 — `.agents/skills`(현재·상위·저장소 루트), `$HOME/.agents/skills` | 문서 — **불가**. `unavailable_tool` |
| Codex 앱(ChatGPT 데스크톱) | 문서 — CLI와 같은 규칙 | 문서 — Computer Use의 Chrome 확장 경로. 사이트별 허용 |
| OpenCode · Antigravity | `.agents/skills`에 놓인다(하네스 설치) | **미확인** — 런타임 도구 목록으로 먼저 확인 |

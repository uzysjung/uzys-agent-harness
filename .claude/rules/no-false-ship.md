# No False Ship (거짓출하 금지)

검증하지 않은 경로를 "작동한다"고 보고하는 것 = 거짓출하. 3회 재발로 본 rule 신설 (2026-06-11, 사용자 지시):

| 사례 | 내용 |
|------|------|
| v26.58~63 | silent drift — 광고 자산이 조용히 미설치 |
| v26.76.0 | `--with-openspec` 등 CLI 플래그 미등록 → 광고한 설치 명령이 크래시 |
| v26.78.0 | Understanding 카테고리 wizard 페이지 누락 → "wizard에서 선택" 보고는 거짓, agent-browser 무인지 설치. Docker 검증은 flag 경로만 수행 |

## 절대 원칙

**검증한 경로만 주장한다. 검증 못 한 경로는 "미검증"이라고 그대로 쓴다.**
"되어야 한다" / "될 것이다"는 ship 보고에서 금지. 추론·기대는 증거가 아니다.

## Surface Parity 의무 (자산/기능 추가·변경 시)

사용자 도달 경로를 **전부 열거**하고 각각 실행 증거를 확보한다:

1. **wizard interactive** — 해당 카테고리/옵션이 실제 페이지에 렌더되어 선택 가능한가
2. **비대화형 CLI flag** — `--with-*` / `--track` / `--cli` 경로
3. **문서 표기** — README / USAGE / COMPATIBILITY / CHANGELOG 의 광고 문구 = 실동작
4. **대상 CLI별** — claude / codex / opencode / antigravity 중 해당하는 것

**증거 = 실제 실행 산출물만**: 테스트 PASS 출력, Docker 시나리오 exit 0, `--help` 출력, 렌더된 화면. 한 경로의 증거를 다른 경로에 전용(예: flag PASS → "wizard 도 됨")하는 것 금지.

## 출하 보고 양식 (필수)

```
| 경로            | 증거                          | 상태      |
|-----------------|-------------------------------|-----------|
| wizard          | wizard-parity 테스트 PASS     | ✓         |
| CLI flag        | Docker scenario exit 0        | ✓         |
| 문서            | grep 광고문구 ↔ 실명령 일치   | ✓         |
| codex (해당 시) | —                             | 미검증    |
```

미검증 행이 있으면 보고에 그대로 노출. 숨기고 "완료" 선언 금지 (Rule 12 Fail loud).

## Drift 구조 차단

동일 목록(카테고리/자산/flag)이 2곳 이상에 하드코딩되면: **derive 로 단일화**하거나 **exhaustiveness 테스트/init-throw 가드** 추가 없이 머지 금지. 주석 경고는 차단 수단으로 인정하지 않는다 (gen-compatibility·prompts.ts 2회 실패 전례).

## 위반 발견 시

1. 즉시 사용자에게 정정 보고 (어느 보고가 어떻게 거짓이었는지 명시)
2. patch hotfix 최우선
3. 본 rule 사례 표 + 메모리(`feedback_no_false_ship`)에 추가

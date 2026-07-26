# Benchmark Parity (벤치마크 핵심 기능 완결성)

레퍼런스 제품(벤치마크)을 실측해 핵심 기능을 도출하고, 자체 구현이 **올바르게 + 필요한 항목 전부**
갖췄는지 반복 검토·발전시키는 워크플로우. **기준선은 레퍼런스 또는 자기 배포본**(후자 = Dogfood
pass) — 비교 대상이 다를 뿐 산출물(gap.md)과 규율은 같다. 실서비스 운영(레퍼런스 audit 20회 내외 실행)에서 검증된
관행의 일반화. 목표는 **모방이 아니라 핵심 기능 완결성** — NORTH_STAR 핵심 경쟁력에 기여하지 않는
단순 모방은 deferred (Will/Won't).

## 벤치마크 정의 (프로젝트별 fill-in)

NORTH_STAR 의 핵심 경쟁력마다 레퍼런스 1개 이상을 매핑해 표로 고정한다. 이 표가 "무엇을 실측하나"의
SSOT — 없으면 갭 판정 기준 자체가 없다.

| 영역 | 벤치마크 | 실측 출처 | 프로필/자료 |
|------|----------|-----------|-------------|
| (예: 이슈 트래킹) | (예: Linear) | Playwright capture | `~/.<ref>-audit-profile` |
| (예: 문서/위키) | (예: Confluence) | Playwright capture | `~/.<ref>-audit-profile` |
| (예: 리포트) | (예: 내부 확보한 정적 HTML/PDF) | 정적 자료 | `docs/raw/` |

- 실측 수단은 둘로 나뉜다 — **금지**(활성 Chrome attach · 일회성 context 등)는 `playwright-launch`
  룰이, **절차**(영속 profile launcher · capture 형태)는 `ui-visual-review` 스킬이 SSOT.
  본 rule 은 어느 쪽도 재규정하지 않는다.

## 반복 루프 (capture → 핵심 기능 → 완결성 → 발전)

1. **NORTH_STAR 재확인** — 벤치마크의 무엇이 "핵심"인지 판정 기준을 먼저 세운다.
2. **벤치마크 실측 capture** — 신규 capture 는 `docs/research/<area>_audit_<sprint>/` 에 생성.
   완료된 audit 산출물은 `docs/archive/` 로 격리 (doc-governance.md 현행/archive).
3. **핵심 기능 도출 → 갭 매트릭스** — 벤치마크 capture vs 자체 구현 동일 영역 capture 를 비교해
   `gap.md` 작성 (아래 스키마).
4. **완결성 검토** — **사용자 관점 end-to-end** 로 본다: 버튼이 존재하는가가 아니라, 클릭하면
   목적지까지 도달하는가. **단순 존재 ≠ 완결.**
5. **갭 → fix → 발전** — fix PR 머지 시 gap.md 해당 행을 `[x] #PR번호` 로 완료 처리
   (doc-governance.md "작업 완료 처리"와 같은 의무).

## gap.md 스키마

경로: `docs/research/<area>_audit_<sprint>/gap.md`. 표가 갭 추적의 SSOT 다:

```markdown
| ID | 항목 | Severity | 근본원인 | 증거 | 수정안 | 상태 |
|----|------|----------|----------|------|--------|------|
| X-1 | <사용자가 겪는 증상> | CRITICAL | <코드 수준 원인> | file.ts:12 + capture.png | <구체 수정안> | [ ] |
| X-2 | ... | HIGH | ... | ... | ... | [x] #123 |
```

- **Severity**: CRITICAL(핵심 기능 자체가 불성립) / HIGH(핵심 기능이 사용자 관점 미완) /
  MEDIUM(동작하나 벤치마크와 상이) / LOW(polish).
- **근본원인은 코드 수준까지** — "안 됨"이 아니라 어느 파일의 어느 경로가 왜 끊겼는지.
- **증거 = file:line + capture 참조.** 증거 없는 행은 갭이 아니라 추정이다 (기재 금지).
- 선택 확장 열: Effort(S/M/L) · 벤치마크 구분(내부 버그 vs divergence).

## Dogfood pass (배포본 전수 walkthrough)

벤치마크 비교가 "남과 비교"라면, dogfood 는 **배포된 자기 서비스를 사용자처럼 끝까지 써보는
것**이다. 둘은 기준선이 다를 뿐 산출물은 같다 — **새 스키마를 만들지 말고 위 gap.md 표를 그대로
쓴다** (증거 열에 capture/영상 경로).

- **대상 = 배포본**(로컬 dev 아님). 로그인 상태로 전 메뉴를 실제로 눌러본다.
- **범위를 먼저 적는다** — "전체 서비스 / 주요 메뉴 N개" 처럼. 범위 미기재 보고는 커버리지를
  부풀린다.
- **심각도 롤업을 머리에 둔다**: `CRITICAL n · HIGH n · MEDIUM n · LOW n · 합계 n`. 개별 행만
  나열하면 "얼마나 나쁜가"가 안 보인다.
- **재현 아티팩트 필수** — 이슈마다 스크린샷/영상 경로. 없으면 증거 없는 행과 같다.
- **게이트**: CRITICAL 0 이어야 dogfood 통과. HIGH 는 사유를 적고 사용자 판단으로 넘긴다.
  (아래 "자율 루프 완료조건"의 `CRITICAL/HIGH 전부 [x]` 와 다른 게이트다 — 이쪽은 **패스 통과**
  기준, 저쪽은 **루프 종료** 기준. 루프를 끝내려면 HIGH 까지 닫아야 한다.)

## PR 의무 필드 (UI/UX 변경 PR)

UI/UX 에 영향하는 PR 의 description 에 다음 섹션 필수:

```markdown
## Fidelity (benchmark parity)
- Benchmark: <벤치마크명> (dogfood 발 PR 이면 `dogfood — 자기 배포본`)
- Capture: docs/research/<area>_audit_<sprint>/<file>.png
- 갭 매트릭스: docs/research/<area>_audit_<sprint>/gap.md §X
```

- capture 없이 "벤치마크 동등" 자처 금지. capture 부재 시 audit 진입이 먼저 — 확보 전 코드 변경 금지.
- 해당 영역 gap.md 에 CRITICAL, 또는 임의 구현으로 표기된 HIGH 갭이 남아 있으면 머지 차단.
  reviewer 가 gap.md ↔ PR diff 를 cross-check 한다.

## 자율 루프 완료조건 (기계검증 프록시만)

검토→발전 루프를 자율 반복(/loop 등)에 태울 때, 완료조건은 파일/대화에서 **기계적으로 확인 가능한
프록시만** 쓴다:

- gap.md 의 CRITICAL/HIGH 체크박스 전부 `[x]` + fix PR 번호 기재
- typecheck / test / lint exit 0

"벤치마크와 시각적으로 동등" 같은 주관 판정은 완료조건으로 쓰지 않는다 — 주관 판정은 재capture 해서
gap.md 에 기록하고 사용자가 최종 확인한다. 매 턴 capture/test 결과를 대화에 남긴다 — 안 남기면
루프가 자기 진척을 판정할 수 없다.

## 임의 구현 안티패턴 (금지)

- capture ref 없이 "벤치마크 패턴 추정", "동등으로 가정".
- "v0 단순화", "후속 polish 에서" — 벤치마크와 다른 동작의 정당화로 사용.
- `window.prompt` / `window.confirm` — 벤치마크급 제품은 modal/inline form 을 쓴다.
- heuristic threshold("30일", "50%")를 capture/SPEC 참조 없이 단정.

# Benchmark Parity (벤치마크 핵심 기능 완결성)

레퍼런스 제품 또는 **자기 배포본**(dogfood)을 실측해 핵심 기능을 도출하고, 자체 구현이 올바르게 + 필요한 항목 전부 갖췄는지 반복 검토·발전시킨다. 기준선이 다를 뿐 산출물(gap.md)과 규율은 같다. 목표는 **모방이 아니라 핵심 기능 완결성** — NORTH_STAR 핵심 경쟁력에 기여하지 않는 모방은 deferred. capture 금지사항은 `playwright-launch` 룰이, 절차는 `ui-visual-review` 스킬이 SSOT(여기서 재규정하지 않는다).

## 벤치마크 정의 — 핵심 경쟁력마다 레퍼런스 1개 이상을 표로 고정한다(없으면 갭 판정 기준 자체가 없다)

| 영역 | 벤치마크 | 실측 출처 | 프로필/자료 |
|---|---|---|---|
| (예: 이슈 트래킹) | (예: Linear) | Playwright capture | `~/.<ref>-audit-profile` |
| (예: 리포트) | (예: 정적 HTML/PDF) | 정적 자료 | `docs/raw/` |

## 루프 (capture → 핵심 기능 → 완결성 → 발전)

NORTH_STAR 로 "핵심"의 판정 기준을 먼저 세운다 → 벤치마크와 자체 구현의 **같은 영역**을 capture 해 `docs/research/<area>_audit_<sprint>/gap.md` 에 갭을 적는다(완료된 audit 산출물은 `docs/archive/` 로 격리) → **사용자 관점 end-to-end** 로 본다(버튼이 있는가가 아니라 클릭하면 목적지에 닿는가 — **단순 존재 ≠ 완결**) → fix PR 머지 시 해당 행을 `[x] #PR번호` 로 닫는다.

```markdown
| ID | 항목 | Severity | 근본원인 | 증거 | 수정안 | 상태 |
|----|------|----------|----------|------|--------|------|
| X-1 | <사용자가 겪는 증상> | CRITICAL | <어느 파일의 어느 경로가 왜 끊겼나> | file.ts:12 + capture.png | <구체 수정안> | [ ] |
```
Severity = CRITICAL(핵심 기능 불성립) / HIGH(사용자 관점 미완) / MEDIUM(동작하나 벤치마크와 상이) / LOW(polish). **증거 = file:line + capture** — 증거 없는 행은 갭이 아니라 추정이므로 적지 않는다.

## Dogfood pass (배포본 전수 walkthrough)

**대상 = 배포본**(로컬 dev 아님). 로그인 상태로 전 메뉴를 실제로 눌러 본다. **새 스키마를 만들지 말고** 위 gap.md 표를 그대로 쓴다(증거 열에 capture/영상 경로). 범위를 먼저 적고(커버리지 부풀림 방지), 심각도 롤업(`CRITICAL n · HIGH n · MEDIUM n · LOW n · 합계 n`)과 이슈별 재현 아티팩트를 남긴다. **게이트 = CRITICAL 0 이어야 통과**, HIGH 는 사유를 적고 사용자 판단으로 넘긴다.

## PR 의무 필드 (UI/UX 변경 PR)

```markdown
## Fidelity (benchmark parity)
- Benchmark: <벤치마크명> (dogfood 발이면 `dogfood — 자기 배포본`)
- Capture: docs/research/<area>_audit_<sprint>/<file>.png
- 갭 매트릭스: docs/research/<area>_audit_<sprint>/gap.md §X
```
capture 없이 "벤치마크 동등" 자처 금지 — 확보 전 코드 변경 금지. 해당 영역에 CRITICAL 또는 임의 구현으로 표기된 HIGH 가 남아 있으면 머지 차단(reviewer 가 gap.md ↔ diff 를 cross-check).

## 자율 루프 완료조건 (기계검증 프록시만)

gap.md 의 CRITICAL/HIGH 체크박스 전부 `[x]` + fix PR 번호 · typecheck/test/lint exit 0. "시각적으로 동등" 같은 주관 판정은 완료조건으로 쓰지 않는다 — 재capture 해 gap.md 에 기록하고 사용자가 최종 확인한다. 매 턴 capture/test 결과를 대화에 남긴다(안 남기면 루프가 자기 진척을 판정할 수 없다).
**임의 구현 안티패턴(금지)**: capture ref 없는 "패턴 추정·동등 가정" · "v0 단순화 / 후속 polish 에서" 로 다른 동작 정당화 · `window.prompt`/`window.confirm` · capture·SPEC 참조 없는 heuristic threshold 단정.

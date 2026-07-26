# Benchmark Parity (벤치마크 핵심 기능 완결성)

레퍼런스 제품 또는 자기 배포본(dogfood)을 실측해 핵심 기능 완결성을 반복 검토·발전시킨다. 목표는
**모방이 아니라 완결성** — NORTH_STAR 핵심 경쟁력에 기여하지 않는 모방은 deferred.

여기 남긴 것은 **머지를 막는 게이트뿐**이다. 루프 절차 · `gap.md` 스키마 · dogfood walkthrough ·
PR 템플릿은 `gap-analysis-e2e` 스킬이 SSOT. 실측 수단(영속 profile 등)은 `playwright-launch` 룰.

## 게이트 (위반 시 머지 차단)

- **capture 없이 "벤치마크 동등"을 자처하지 않는다.** capture 가 없으면 audit 진입이 먼저다 —
  확보 전 코드 변경 금지.
- **증거 없는 행은 갭이 아니라 추정이다.** `gap.md` 의 모든 행에 `file:line` + capture 참조를
  단다. 증거가 없으면 기재 자체를 하지 않는다.
- **`gap.md` 에 CRITICAL 이 남아 있거나 임의 구현으로 표기된 HIGH 가 남아 있으면 머지 차단.**
  reviewer 가 `gap.md` ↔ PR diff 를 cross-check 한다.
- **UI/UX 에 영향하는 PR 은 description 에 `## Fidelity` 섹션 필수** — 벤치마크명 · capture 경로 ·
  갭 매트릭스 위치.
- **단순 존재 ≠ 완결.** 버튼이 있는가가 아니라 눌렀을 때 목적지에 도달하는가로 판정한다.
  기준은 사용자 관점 end-to-end 다.

## 임의 구현 안티패턴 (금지)

- capture 참조 없이 "벤치마크 패턴 추정" · "동등으로 가정".
- "v0 단순화" · "후속 polish 에서" — 벤치마크와 다른 동작의 정당화로 사용.
- `window.prompt` / `window.confirm` — 벤치마크급 제품은 modal/inline form 을 쓴다.
- heuristic threshold("30일", "50%")를 capture/SPEC 참조 없이 단정.

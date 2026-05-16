# ADR-015: All-in-one installer screen (3-step wizard)

- **Status**: Accepted
- **Date**: 2026-05-16
- **PR**: (pending)
- **Supersedes**: ADR-010 (Step 4 = External Assets 단일 step) · ADR-013 (wizard back nav 의 cancel 메시지) · ADR-014 부분 (Phase C UX)

## Context

v26.47.0 (Phase C full) 에서 외부 자산을 단일 multiselect 로 노출했고, v26.52.0 에서 2-tier navigator 로 확장했다. 결과:

- 5 step (tracks → options → cli → assets → confirm) 의 흐름이 길고, 진행률 표시가 없어 사용자가 어디 있는지 파악 어려움.
- 2-tier navigator 는 카테고리 단위 진행률을 보여주지만, "전체 설치될 항목" 을 한 화면에서 일별할 수 없음.
- ESC = back nav 가 clack `cancel()` API 를 호출하면서 "Cancelled." strikethrough 메시지가 매 단계 stack — 사용자가 "취소함" 으로 오인.

사용자 피드백 (2026-05-16): "어떤 것들이 그룹섹션별로 설치되는 것이 전부 표시된다. Default 들은 selected. Optional 도 한 화면. 선택하면 설치 시작."

## Decision

1. **3-step wizard**: tracks → cli → install-targets → confirm prompt (별도 step 아닌 마지막 prompt 흡수)
2. **Install-targets 화면 통합**: OPTION_DEFS (9 togglable build option) + EXTERNAL_ASSETS (32+ skill/plugin/npm) 을 단일 `groupMultiselect` 카테고리 그룹으로
3. **ESC silent back**: clack `cancel()` API 호출 제거. Wizard back nav 시 메시지 출력 X. Step 1 (tracks) 의 ESC 만 cancel 메시지 1회

## Alternatives

| 안 | 거부 사유 |
|---|---|
| 2-tier navigator 유지 + 별도 "preview screen" 추가 | step 수가 6 으로 증가. 사용자 가시성 요구 (한 화면) 미충족 |
| Options 와 Assets 별도 step 으로 유지 (4 step) | 사용자 명시 요청 "전부 한 화면" 위반 |
| Tracks 도 install-targets 화면에 흡수 (2 step) | tracks 가 default 선택의 source 이므로 먼저 정해야. 흡수 시 dependency 순환 |
| ESC = "Going back to step N" 텍스트 한 줄 | 사용자가 "Silent back" 명시 선택 |

## Consequences

### Positive
- "한 화면에 무엇이 설치되는지" 가시성 완전 충족
- Wizard 길이 40% 감소 (5 → 3 step)
- Back nav 시 화면 노이즈 제거

### Negative
- 한 화면 항목 50+ → 스크롤 필요. 카테고리 헤더로 완화하지만 항목 갯수가 늘면 재검토
- `selectOptionKeys` / `selectExternalAssets` / `selectAssetCategory` / `selectAssetsInCategory` 4 함수 deprecated → 제거. (외부 caller 없음 — interactive.ts 만 사용)
- 기존 interactive.test.ts 회귀 — wizard back nav, all-in-one transform 신규 case 필요

### Migration
- `selectOptionKeys` + `selectExternalAssets` → `selectInstallTargets` 1 함수로 통합
- 기존 `selectAssetCategory` / `selectAssetsInCategory` 제거
- v26.47.0 의 userOverride 모델은 그대로 (assetIds 만 비교, optionKeys 는 OptionFlags 로 직접 매핑)

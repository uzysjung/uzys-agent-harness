# Document Governance

문서 작성 + 작업 완료 시 추적 동기화 규칙. 프로젝트 문서가 "거짓 상태"가 되는 것을 막는 SSOT 규약 —
실서비스에서 700+ 커밋 동안 검증된 관행의 일반화.

## SSOT 위계 (한 사실은 한 곳)

| 문서 | 역할 | 갱신 시점 |
|------|------|----------|
| `NORTH_STAR.md` | 왜·어디로 (비전 · 북극성 지표 · Non-Goals · 의사결정 휴리스틱) | 방향 전환 시만 |
| `SPEC.md` (+ `specs/`) | 무엇 (제품/기능 스펙 — 모듈이 커지면 파일 분리) | 기능 정의/변경 |
| `PRD.md` | 문제 · 솔루션 · 요구사항 | 제품 방향 변경 |
| `TODO.md` (또는 `tasks/todo.md`) | 다음 할 일 · 진행/완료 추적 | 작업 시작/완료 |
| `README.md` | 진입점 · 현재 상태 (shipped/stack/배포) | 현재 상태 변동 |
| `docs/decisions/` | 아키텍처/의존성/데이터모델/보안 결정 (ADR) | change-management.md 분류 따름 |

- 파일 위치는 프로젝트 레이아웃을 따른다 (루트 또는 `docs/`) — **역할·위계·동기화 의무는 불변**.
- **위계 = 충돌 시 상위 우선.** NORTH_STAR 와 SPEC 이 모순되면 NORTH_STAR 가 이긴다.
- **같은 사실을 두 곳에 쓰지 않는다.** 한 곳(SSOT)에 두고 나머지는 링크로 가리킨다. 중복 서술 = drift 의 씨앗.

## 무엇을 언제 쓰나

- 신규 기능 → **먼저 SPEC 등재, 그 다음 구현** (spec-first). 대화에서 "추가하자/넣자" = 우선 문서 작업이지 구현 착수가 아니다.
- 아키텍처 / 외부 의존성 / 데이터 모델 / 보안 / breaking API 결정 → **ADR** (`docs/decisions/`, 템플릿은 change-management.md).
- 진행/완료 추적 → TODO. 현재 상태 변동 → README.

## 작업 완료 처리 (merge = 코드 + 추적 동기화) — 핵심 의무

PR 머지로 작업이 끝난 게 아니다. **머지 직후 같은 작업 단위로**:

1. TODO 해당 항목 → `[x] (✅ #PR번호)`.
2. AC / Phase / Non-Goals / DO NOT CHANGE 에 영향 시 → SPEC Change Log.
3. 현재 상태(shipped / 배포) 변동 시 → README §현재 상태.

빠지면 추적 SSOT 가 거짓 상태가 되고, **다음 세션이 완료분을 backlog 로 오인해 중복 작업하거나
미완분을 완료로 오인해 건너뛴다.** 금지.

## 현행 vs archive

- **현행 SSOT 만 루트/`docs/` 에**: 위 위계 문서 + `specs/` + `decisions/`.
- **히스토리는 `docs/archive/`** 로 격리 (옛 버전, 폐기 sub-spec, 완료된 리서치/audit 산출물) —
  지도 파일(`archive/README.md`) 하나로 찾을 수 있게 한다. 현행 문서에 히스토리가 쌓이면
  "현재가 무엇인지"를 읽는 비용이 히스토리에 비례해 커진다.
- 변경 이력이 길어진 문서는 이력만 archive 로 빼고 본문에는 최근분만 남긴다.

## 작성 원칙

- **why 중심** — what 은 코드/diff 가 보여준다.
- SPEC 이 800줄을 넘으면 기능별 분리 (`spec-scaling` 스킬 참조).
- **추정/임의 단정 금지** — "직관상 별로", "일반적으로 필요", "내 경험상"은 출처 없는 일반화.
  측정/스펙 참조/재현 증거로 입증한다.

## 검증 게이트

`.claude/hooks/spec-drift-check.sh` 가 SPEC/TODO 의 unchecked 잔존·Status 불일치를 검출한다 —
verify 단계에서 경고(exit 1), **ship 단계(`spec-drift-check.sh ship`)에서는 차단(exit 2)**.
ship-checklist.md 의 "SPEC/PRD 정합성" 게이트가 이 스크립트를 호출한다. 프로즈 규약(본 문서)과
결정론 게이트(훅)는 짝이다 — 규약만으로 안 지켜지는 것이 확인되면 게이트를 넓혀라
(recurrence-prevention 스킬의 에스컬레이션 사다리).

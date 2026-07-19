---
name: spec-scaling
description: "Detects when SPEC.md or PRD.md exceeds 300 lines and proposes feature-based splitting with a master route document. Use when SPEC.md grows too large to be effectively used as a single document."
---

# Spec Scaling

## When to Use

SPEC.md 또는 PRD.md가 300줄을 초과했을 때 자동 트리거.

## Process

1. 현재 SPEC.md/PRD.md의 줄 수를 확인한다.
2. 300줄 초과 시 기능별 분리를 제안한다 (SPEC와 PRD 둘 다 동일 패턴):

### SPEC 분리 (기능별)
```
docs/
├── SPEC.md                    # 마스터 — 공통 규칙 + 각 기능 파일 라우트
├── specs/
│   ├── auth.md                # 인증/인가 기능 스펙
│   ├── dashboard.md           # 대시보드 기능 스펙
│   └── payment.md             # 결제 기능 스펙
```

### PRD 분리 (제품 영역별)
```
docs/
├── PRD.md                     # 마스터 — 비전, 사용자, 큰 그림 + 영역 파일 라우트
└── PRD/                       # 영역별 세부 사양
    ├── platform-common.md     # 플랫폼 공통 (인증, 권한, 인프라)
    ├── feature-screener.md    # 스크리너 영역
    ├── feature-portfolio.md   # 포트폴리오 영역
    └── feature-simulator.md   # 시뮬레이터 영역
```

> Vantage 프로젝트의 `.claude/PRD/` 구조를 일반화한 것 (도메인 비종속). 본 패턴에서는 `docs/PRD/` 하위에 위치.
> 두 패턴 모두 **마스터 = 인덱스 + 공통**, **하위 = 독립 참조 가능 단위** 원칙.

3. 마스터 SPEC.md 구조:

```markdown
# SPEC: [프로젝트명]

## 공통 규칙
[전체 적용 Boundaries, Tech Stack, DO NOT CHANGE]

## 기능별 스펙
- [인증/인가](specs/auth.md)
- [대시보드](specs/dashboard.md)
- [결제](specs/payment.md)
```

4. 마스터 PRD.md 구조:

```markdown
# PRD: [프로젝트명]

## 1. 비전 / Personas / NSM
[North Star 요약 (없으면 생략)]

## 2. 영역별 사양
- [Platform Common](PRD/platform-common.md) — 인증/권한/인프라
- [Feature: Screener](PRD/feature-screener.md)
- [Feature: Portfolio](PRD/feature-portfolio.md)

## 3. 영역 간 의존성
- Screener → Portfolio (선택 결과 전달)
- All → Platform Common (인증 의존)
```

5. **인간 승인 후에만 분리 실행**. 자동 분리 금지.

## Rules

- 공통 규칙(Boundaries, Tech Stack, DO NOT CHANGE)은 마스터에 유지.
- 각 하위 파일은 독립적으로 참조 가능해야 한다 — 다른 파일을 읽지 않아도 의미 통해야 함.
- 영역/기능 간 의존성은 마스터에 명시.
- 분리 후 기존 SPEC.md/PRD.md는 마스터로 변환 (삭제 아님).
- 하위 파일도 다시 300줄 초과하면 sub-area로 추가 분리 (재귀 적용).

## When to Split SPEC vs PRD

| 경우 | 분리 대상 |
|------|---------|
| 비즈니스 맥락 / 사용자 시나리오가 큰 비중 | PRD 우선 분리 |
| 기술 스펙이 핵심 (API, 데이터 모델, AC) | SPEC 우선 분리 |
| 둘 다 큰 경우 | PRD를 영역별로, SPEC를 기능별로 (서로 cross-link) |

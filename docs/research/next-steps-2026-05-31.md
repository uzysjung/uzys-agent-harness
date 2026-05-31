# Next-Steps Research — 2026-05-31 (North Star 재정립 직후)

> **Trigger**: North Star Statement 재정립(2026-05-31, "설치 서비스 = installer + curator" + 세 기둥) 직후, 다음 진행 항목을 목표 기준으로 재도출.
> **Method**: North Star 세 기둥 + NSM 갭 → 후보 11건 도출 → `product-manager-toolkit/rice_prioritizer.py` 정량 스코어링 → 4-gate 교차검증.
> **Inputs**: `docs/NORTH_STAR.md`(v2026-05-31), `docs/evals/hito-baseline-2026-04-30.md`, `docs/phase-2-backlog.md`, `docs/decisions/ADR-001`, `docs/todo.md`.

---

## 1. 출발 문제 — 백로그가 새 North Star를 반영 못함

- North Star Statement는 **2026-05-31 재정립** (설치 서비스 본질 + 세 기둥: ① 하네스+컨텍스트 엔지니어링 ② 검증 자산 큐레이션+선택권 ③ 4-CLI 동등성).
- 현재 Phase 2 백로그(P2-01/02/04)는 **2026-04-30 생성** — 재정립 *이전*.
- ⇒ 백로그 우선순위를 새 목표 기준으로 **재정렬**할 필요. 본 문서가 그 재도출.

## 2. 핵심 발견 (근거 기반)

### F1 — NSM(HITO)은 현재 "틀린 대상"을 측정
- `hito-baseline-2026-04-30.md §4`: HITO ≈ **20/feature**, 목표(≤3) 대비 **6.7× 초과**.
- 그러나 ▸ N=1(메인테이너) ▸ 하네스를 **고빈도로 만들던** window(v0.4.0~v0.8.1) 측정.
- NSM이 재려는 대상 = *하네스로 자기 서비스를 만드는 사용자*. 측정된 것 = *하네스 자체를 만드는 사람* → **단위 불일치**. baseline §5 한계 #3 자인("표본 1명").
- **함의**: 외부/통제된 fresh-dogfood 없이는 NSM 개선·자동화(D1)가 사상누각.

### F2 — "설치 서비스" 본질상 First-Run Success가 더 시급 + solo 측정 가능
- North Star essence = "설치**해주는** 서비스" → 사용자 첫 접점 = *설치*.
- Phase 2 명시 목표 = First-Run Success ≥95% / fresh env 5+ 매트릭스.
- 외부 사용자 없이도 CI 매트릭스로 측정·개선 가능 → NSM(HITO)보다 진입 장벽 낮고 본질 직결.

### F3 — Promise=Implementation 노출 (vibe killer 1순위)
- README/USAGE는 **4-CLI** 광고. 그러나 `todo.md` follow-up:
  - Antigravity = codelabs spec 기반 **실환경 미검증**.
  - Codex `.codex/prompts/` = **Docker mock만** 검증.
- North Star "거짓 광고 0건" 기준상, **광고 중 미검증 2개 CLI = 직접적 약속 위반 리스크**.

## 3. RICE 우선순위 (정량 + 기둥 매핑)

reach = 미래 사용자 기반 중 닿는 폭 (1000=모든 설치 / 600=큐레이션 전반 / 300~400=특정 CLI·트랙 / 100=내부 도구).
impact massive=3·high=2·medium=1·low=0.5 / confidence high=1.0·med=0.8·low=0.5 / effort xl=13·l=8·m=5·s=3·xs=1.

| 순위 | 항목 | 기둥 | reach | impact | conf | effort | RICE |
|---|---|---|---:|---|---|---|---:|
| 1 | **C2 fresh-env 설치 매트릭스 CI** | ③+First-Run | 1000 | massive | high | m | **600** |
| 2 | **A1 Trust Tier star-drift CI** | ② | 600 | high | high | s | **400** |
| 3 | **C1 P2-01 fresh-dogfood (실서비스 완주)** | ① NSM | 1000 | massive | med | l | **300** |
| 4 | A2 자산 Promise audit (37 desc) | ② | 600 | high | high | m | 240 |
| 5 | **B2 Codex 실환경 검증** | ③ | 400 | high | med | s | **213** |
| 6 | B1 Antigravity 실환경 검증 | ③ | 400 | high | med | m | 128 |
| 7 | A3 권장 수락률 측정 | ② | 600 | medium | low | s | 100 |
| 8 | E2 branch-protection 재정의 | hygiene | 100 | low | med | xs | 40 |
| 9 | E3 npm publish policy | hygiene | 300 | low | med | s | 40 |
| 10 | D1 P2-02 NSM per-feature 자동화 | ① | 100 | medium | med | m | 16 |
| 11 | E1 P2-04 dependency major bump | hygiene | 100 | low | high | m | 10 |

- **Quick Wins** (high impact·low effort): A1, B2.
- **Big Bet**: C1.

## 4. 결정 (2026-05-31, 사용자 승인)

1. **다음 착수 = C2 (fresh-env 설치 매트릭스 CI)** — RICE 1위 + 본질 정렬.
   - **Rule 7 충돌 표면화 + 해소**: 백로그는 "P2-01 최우선"이나 본 리서치는 **C2를 P2-01 앞에 배치**. 근거 — ① North Star 본질이 "설치"로 이동 ② C2는 외부 의존 없이 측정 가능(confidence high) ③ C2가 P2-01의 선행 병목(설치가 깨지면 외부 영입 불가). → 백로그 재정렬 채택.
2. **P2-01 방식 = 자기 fresh-dogfood 프록시** — 메인테이너가 clean env에서 하네스로 새 throwaway 서비스 1건을 완주하며 정직한 HITO/feature 첫 측정. 외부 사용자 실측은 Phase 3 신호로 이월.

## 5. 보류·재정의 필요 (맹목 진행 금지)

- **E2 branch-protection** — v26.70.3에서 **CI 태그-온리** 전환 → "PR status-check 강제"의 전제 소멸. 의미 재정의 먼저.
- **D1 NSM per-feature 자동화** — 백로그 명시 "외부 baseline 후 재평가" → **C1에 종속**. 지금 만들면 측정 대상 없음.
- **E1 dependency bump** — 사용자 가치 0, 유지보수. 본질 작업 뒤로.

## 6. 권장 시퀀스

```
C2 (설치 매트릭스 CI)  ──▶  B2+B1 (4-CLI 실환경 검증)  ──▶  C1 (fresh-dogfood HITO 실측)
   First-Run ≥95% 봉합        Promise=Implementation 봉합        NSM 본업 진입
```

이후 A1/A2(큐레이션 신선도·정직성) → hygiene(E2 재정의/E3/E1) → D1(C1 완료 후).

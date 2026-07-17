# Lean 방향 실행 큐 (2026-07-17)

> 결정 = [ADR-032](../decisions/ADR-032-lean-curation-direction.md) · 방향 앵커 = NORTH_STAR §1
> "Lean 개정" · README "Curation philosophy" (#211). 5-페르소나 패널 원문은 세션
> scratchpad(휘발) — 핵심 판정은 ADR-032 에 영구 기록.

## 큐 (사용자 승인 2026-07-17 — 4건 전부 선택)

| # | 항목 | 내용 | 상태 |
|---|---|---|---|
| 1 | 문서 게이트 | NORTH_STAR Major CR + ADR-032 + WORKFLOWS 조건표 + roadmap immediateNext 갱신 | ✅ PR #212 |
| 2 | Session-Start Context Cost | 위저드 Step 3 / 비대화형 요약에 트랙별 descriptor 토큰 합계 표시. repo-bundled 템플릿 = frontmatter 실측, 외부 자산 = "미측정" 명시(no-false-ship). CI ratchet: 기본 dev 트랙 합계 증가 시 명시적 정당화 | 대기 |
| 3 | 트리거 중복 탐지 CI | 자산 description 유사도 경고 게이트 — 개수 상한 대신 라우팅 혼란(잠식의 실체)에 대응 | 대기 |
| 4 | 자산 축 판정 (재정의 #213) | ~~검증실패 12자산 판정~~ **전제 오류로 소멸** — 12 비-🟢 = 🟡 1st-party 템플릿+ecc-prune(실패 아님), 2026-07-17 dispatch 재실행 결과 catalog-verify·trust-tier-drift **양쪽 green**(계측기 RED 방치 해소). 대체 작업: 카탈로그 61자산을 `pattern-guide`(모델 대체 가능성 높음 — 축소 후보) vs `operational-fact`(유지) 축으로 분류 → 축소 후보 목록 제안. **제거는 데이터(HITO A/B·설치 로그) + 사용자 컨펌 필수** | 대기 |

## 원칙 (패널 수렴 판정 — 실행 시 준수)

- 번들 6종 **opt-in 유지 확정** (제거·배지 강등 기각 — ADR-032 Alternatives). 재론 시 새 근거
  데이터(HITO A/B, 설치 로그) 필요.
- T2("모델 향상 → 스킬 불필요") = **가설**. 공개 문서에는 관점으로만. 검증 경로 = HITO A/B.
- 축소는 카테고리 일괄 금지 — `pattern-guide`(축소 후보) vs `operational-fact`(유지) 자산 단위.
- wshobson-agents 는 T3 기준(오케스트레이션·cross-CLI) 부합 — 번들 일괄 취급 금지, 개별 판정.
- "멀티에이전트 동시 개발" 광고 금지 — 안전장치(worktree 관례·파일 클레임 hook) 출하가 선행.
- 이행 창 = M2 게시 전(외부 사용자 ~0 = 이행비용 0). M2 재개 결정 시 본 큐 진척을 먼저 확인.

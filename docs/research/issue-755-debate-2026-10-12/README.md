# #755 상주 지시 문안 — ChatGPT(GPT-6 · Extra High) 리뷰·반박 토론 (2026-10-12)

원문: `prompt-r1.md` → `response-r1.md` → `prompt-r2.md` → `response-r2.md`. 설계 입력 = `docs/plans/issue-755-agent-work-skill-design.md` §4.

## 경과
| 라운드 | ChatGPT 판정 | 제안자 처리 |
|---|---|---|
| 1 | 원안 상주 반대 · 2문장 축약안 실험 후 조건부. 지적 8건 | 수용 6(대화 배제 · user flow 과잉 일반화 · 이름=완료 · 순서 경직 · multi-part 한정 · 수치 인과성) / 반박 3(R-A 효율 기준 소실 · R-B 기록 문장 삭제 · R-C 실험 과대) |
| 2 | R-A 수용 · R-B 부분 수용(material · Where authorized) · R-C 부분 수용(3과업 + 무단 기록 검사) → **v3 조건부 상주 찬성**으로 입장 변경 | 수렴. 남은 쟁점(스킬 라우팅)은 문장 범위 밖 — 실험에서 "기록 필요 인식" 과 "스킬 사용" 을 나눠 관찰 |

## 최종 문안 (v3 + 리드 1곳 수정: "plans" → "plans, designs" — 사용자 요구 1 의 설계서)
```
For multi-part work, derive user or operational outcomes from the current request and
applicable plans, designs, or agreed briefs. Divide them into coherent units described
well enough to start and verify without re-deriving the plan; sequence by dependencies
and agreed priorities. Where authorized, preserve material decisions and acceptance
evidence in existing project records, and judge completion by evidenced required results
and protections rather than closed units.
```

## 원안 대비
| 축 | 원안 | 최종 |
|---|---|---|
| 적용 | 문서가 있는 프로젝트 | 다중 작업 |
| 출처 | 문서(대화 배제) | 현재 요청 + 해당 문서·브리프 |
| 묶음 | 사용자 플로우 | 사용자·운영 성과 |
| 단위 | 한 변경으로 끝 · 자기 설명만으로 착수 | 일관된 단위 · 계획 재도출 없이 착수·검증 가능한 설명 |
| 순서 | 합의된 순서 | 의존성 · 합의된 우선순위 |
| 기록 | 추적 자리에(채팅 대신) | 권한이 있으면 기존 기록에 중요한 결정·수용 증거 |
| 완료 | 이름 문장이 참일 때 | 필요한 결과·보호가 증거로 확인될 때 |

## 채택 조건(합의)
현재 앵커 vs 최종 문안, 3과업 × 2변형 블라인드 비교: ① 설계 문서 있는 신규 개발(기존 기록 체계 + 후속 세션 착수 포함) ② UI 없는 데이터·보안 작업 ③ 소규모 수정(불필요한 분해 회귀). + 쓰기 승인 없는 기록 체계에서 무단 기록을 하지 않는지 1건. 차이가 없거나 회귀가 크면 상주하지 않는다.

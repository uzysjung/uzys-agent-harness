# 상주 컨텍스트 비용 갭 매트릭스 (2026-07 감사)

기준선 = **자기 배포본**(`templates/`) — dogfood pass. 사용자 관점 = "이 룰이 낯선 사람의
프로젝트에 깔렸을 때 맞는 말인가".

**검증 방법**: LLM 페르소나 패널로 "이 룰이 필요한가"를 묻지 **않았다**. 그 질문의 답은 의견이지
증거가 아니고, 준수율 데이터가 없는 상태에서 패널을 돌리면 이 리포가 금지한 "직관적으로 별로
같다"를 4인분 만들 뿐이다. 대신 **구조적으로 확인 가능한 3개 렌즈**를 전 룰에 적용했다:

| 렌즈 | 질문 | 판정 방법 |
|------|------|-----------|
| L1 배포 적합성 | 설치자 프로젝트에서 이 문장이 참인가 | 배포판 기준으로 읽고 반례 제시 |
| L2 dangling 참조 | 가리키는 대상이 설치자 환경에 존재하는가 | grep — 참조 대상 파일/절의 실재 |
| L3 중복 | 같은 사실이 두 번 나오는가 | 파일 내 · 파일 간 대조 |

Severity: CRITICAL(설치자에게 해로움) / HIGH(거짓 참조) / MEDIUM(중복) / LOW(polish).

| ID | 항목 | Sev | 근본원인 | 증거 | 수정안 | 상태 |
|----|------|-----|----------|------|--------|------|
| C-1 | 배포판 `git-policy` 가 이 리포의 CalVer(`Major = year-2000`)를 **"절대 위반 금지"** 로 강제 | CRITICAL | 리포 사정이 배포물에 그대로 실렸다. 설치자 대부분은 SemVer 이고, 에이전트가 그들의 버전 체계를 "위반"으로 판정해 바꾸려 든다 | `templates/rules/git-policy.md:84-105` (감축 전) | 절 삭제. 버전 체계는 프로젝트가 정한다고 명시. `.claude/` 사본에는 유지 | [x] #255 |
| H-1 | `git-policy` 서두가 "CLAUDE.md Git Policy의 확장"이라 하지만 배포판 `CLAUDE.md` 에 Git 절이 **0건** | HIGH | 로컬 사본 기준으로 쓴 문장이 배포판에 그대로 | `grep -c 'Git' templates/CLAUDE.md` → 0 | 서두 재작성 | [x] #255 |
| H-2 | COMMON 룰 `doc-governance` 가 **UI 트랙 전용** 룰 `benchmark-parity.md` 를 무조건 참조 | HIGH | 부담 그룹을 가로지르는 참조. tooling·executive 등 11 트랙 중 5개엔 그 파일이 없다 | `templates/rules/doc-governance.md:54` ↔ `manifest.ts:73` UI_RULES | **참조를 지우지 않고 의존을 지운다** — 판정 기준 한 줄을 인라인하고 상세 포인터는 "UI 트랙이면"으로 조건화. 첫 수정안(참조 삭제)은 `doc-governance-baseline-rule` MECE 게이트가 반증 | [x] #255 |
| ~~H-3~~ | `doc-governance` 의 "전례: … 해당 ADR 로 위임" | ~~HIGH~~ | — | — | **기각(리뷰에서 반증)**: `no-false-ship` 이 금지하는 것은 **ADR 번호**이고 일반형 `ADR` 은 이미 그 타협의 결과다(v26.128.0 에 같은 판정 전례). 되돌렸다 | 기각 |
| M-1 | `git-policy` 에 ship 보고 형식 블록이 **2개** (Session Cleanup · Post-Merge) | MEDIUM | 절을 추가하며 형식을 다시 적었다 | 같은 파일 52-59행 · 72-82행 | 1개로 통합 | [x] #255 |
| M-2 | `doc-governance` §검증 게이트가 훅의 **내부 동작**(탐지 경로 목록·exit code)을 서술 | MEDIUM | 훅이 알아서 하는 일을 산문이 중복 서술. 설치자가 알아야 할 것은 **한계**뿐 | `templates/rules/doc-governance.md:78-87` | 계약 + 한계만 남기고 축약 | [x] #255 |
| **G-1** | **상주 비용에 성장 게이트가 없다** — `cost:report`(표시)와 NORTH_STAR 정합(정확성)은 있으나, 늘어난 만큼 문서를 고치면 둘 다 초록불 | CRITICAL | 두 게이트 모두 *수준*이 아니라 *정확성*을 지킨다 | `.claude/rules` 도입 이후 2.7배, 그동안 두 게이트 전부 green | `context-cost-baseline.json` + ratchet 테스트 (`npm run cost:baseline` 로만 상향) | [x] #255 |
| **G-2** | 재발방지가 2회 재발이면 **자동으로 룰**을 만든다 — 게이트로 대체 가능한지 묻는 관문이 없다 | HIGH | 사다리가 "count 초과 진입 금지"만 규정하고 **비용 비대칭**(룰=영구 상주 / 게이트=상주 0)을 반영 안 함 | `recurrence-prevention` SKILL.md 사다리 표 | Level 1 pre-flight 3질문 + 토큰 공시 + 결정론 가능 시 count 2 에서도 Level 2 | [x] #255 |
| J-1 | `Justified Asset Ratio` 미구현 — "이 룰이 값을 하는가"를 판정할 수단이 없다 | HIGH | ADR-043 2단계 eval 미실행 | NORTH_STAR §2 (미구현 명시) | with/without eval 하니스 | [ ] |
| U-1 | 훅 stdout 의 컨텍스트 비용 미측정 | MEDIUM | `context-cost.ts` 가 훅을 "비대상"으로 분류 — 파일은 맞지만 **출력은 대화에 들어간다** | `context-cost.ts:115` | 트랜스크립트에서 훅 출력 집계 | [ ] |
| U-2 | chars/4 근사의 실제 오차 미검증 | MEDIUM | 실측 토크나이저와 대조한 적 없음. 한글 비중이 높아 **과소평가 가능성** | `context-cost.ts:17` | `messages.count_tokens` 대조 (외부 호출 — 사용자 승인 필요) | [ ] |
| U-3 | `MEMORY.md` 성장에 게이트 없음 (이 리포 상주의 ~20%) | LOW | ratchet 이 설치 자산만 본다 | — | baseline 축 추가 검토 | [ ] |

**롤업**: CRITICAL 2 · HIGH 4 · MEDIUM 4 · LOW 1 · 기각 1 · 합계 12 — **해결 7 · 기각 1 · 미해결 4**.

**기각 1건과 수정안 1건 변경은 게이트가 잡았다.** 내가 옳다고 본 두 건 중 하나는 과잉이었고
(H-3), 하나는 방법이 틀렸다(H-2 — 참조를 지우면 MECE 가 깨진다. 지워야 할 것은 참조가 아니라
*의존*이었다). 이 감사가 자기 판단만으로 굴러갔다면 둘 다 그대로 실렸다.

**미해결 4건은 전부 "측정 수단이 없다"에 속한다** (J-1 · U-1 · U-2 · U-3). 이것이 이 감사의
핵심 결론이다: 지금 자를 수 있는 것은 **틀린 것**뿐이고, "필요한가"를 자르려면 J-1 이 먼저다.

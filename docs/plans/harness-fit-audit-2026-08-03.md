# audit-harness-fit 전체 감사 — 이 리포 상주 조종층 (2026-08-03)

Stage 3~5 첫 실전 (ADR-064 Consequences 이월분). Stage 1·2 는 출하 dogfood 실측을 같은
방법으로 재실측해 갱신했다. 판정 기준 원장 = `docs/research/rules-hooks-value-audit-2026-08-02/`
(+ 스킬 동봉 `references/official-criteria.md`). 판정 주체 = 오케스트레이터(Fable),
인용 실재 대조 = 독립 레인.

## Stage 1 — INVENTORY (이 세션이 로드하는 것, bytes, 실측 2026-08-03)

| 표면 | 항목 수 | bytes | ≈tokens | 비고 |
|---|---|---|---|---|
| 앵커 3개 | 3 | 17,658 | ~4,400 | `CLAUDE.md` 8,982 · `.claude/CLAUDE.md` 3,525 · `~/.claude/CLAUDE.md` 5,151. `@import` 0 (사용자가 2026-08-03 OMC import 제거) |
| rules | 8 | 26,362 | ~6,600 | `paths:` frontmatter 0개 — 전부 무조건 상주 |
| auto-memory | 1 | 20,268 | ~5,100 | `MEMORY.md` 44줄 — 하드컷(200줄/25KB) 안, 단일 최대 파일 |
| skill descriptors | 21 | 17,627 | ~4,400 | frontmatter 만. **7종이 공식 상한 1,024자 초과** (하단 F-B) |
| agent descriptors | 9 | 2,957 | ~740 | |
| hooks | 5 배선 | 0 | 0 | session-start 만 stdout 컨텍스트 주입 |
| permissions | 0/0/0 | 0 | 0 | `bypassPermissions` · allow/ask/deny 전부 0 — 집행층 공백(기지 백로그 A2) |
| **합계** | | **84,872** | **~21,200** | 배분: rules 31% · memory 24% · 앵커 21% · skill desc 21% · agents 3% |

측정법: 스킬 Stage 1 셸 스니펫 그대로(bytes, frontmatter 는 awk 첫 `---` 쌍). 함정 3종 처리 —
측정 사본 = 세션이 로드하는 dev 사본(`.claude/`, 배포판 `templates/` 아님) · `paths:` 실측 0 ·
import 실측 0.

## Stage 2 — EVIDENCE

| 신호 | 실측 | 읽기 |
|---|---|---|
| hook-blocks.log | **3줄** (2026-08-02 이후 증분 0) | docker-only-realcli 2건 = **오탐 후보**(문서 파싱 `node -e` · mktemp 스코프 스모크 — 설치·오염 0) · mcp-pre-exec 1건 = allowlist 밖 조회 차단(정탐) |
| session-start 훅 | 매 세션 발화 (본 세션 컨텍스트에 SPEC 안내 실재) | 살아 있음 |
| protect-files · suggest-compact | 로그 0줄 | **no sample** — 무죄 아님. protect-files 는 대상(.env·lock) 편집 시도 자체가 없었음 |
| 정정 이력 | 앵커 거짓 서술 2줄 정정(#273 사이클) · 취소선 2건은 해소된 옛 주장 | 룰 다수에 사고 좌표 실재(v26.70.1 · #237 · ADR-007 21건 · cli-development 한 세션 3회) |

## Stage 3 — VERDICT (절 단위)

우선 심판 3건(사용자 지목 — 공식 기준 "Changelogs or history" · "Information that changes
frequently" 제외 목록):

| # | 절 | 판정 | 근거 |
|---|---|---|---|
| V-1 | `CLAUDE.md` 미해결·함정 §1 (취소선 "~~비가역 차단 0건~~→…" + 방향 서사 9줄) | **rewrite** | 해소된 옛 주장 병기 = history 형태. 현재형 원칙 3줄로: main 서버 잠금 사실 · "로컬 훅을 더 얹지 않는다, 강등이 남았다(A2)" · 로컬 가드 신설 기각 |
| V-2 | 같은 §2 (차단 로그 표본 서사 9줄) | **rewrite + relocate** | 표본 상태("첫 3줄·오탐 2")는 자주 변하는 정보 — 본 감사 문서가 인수. 상주에는 원칙 2줄만: 로그 계약(ADR-061) · "차단 1줄은 발화의 증거이지 옳음의 증거가 아니다" · uninstall 소실 감수 |
| V-3 | 같은 §5 (package-lock 26.134.1 멈춤 · GitHub release 미생성) | **rewrite** | 상태 서술 → 내구 원칙 1줄: "버전 확인은 package.json·git tag 로 — package-lock 은 게시 계약 밖이라 오래 멈춰 있을 수 있다(실측 2026-08-03 여전히 26.134.1)". release 미생성 줄은 "GitHub release 는 안 만든다 — 태그·npm 이 SSOT" 로 |

추가 판정(전 표면 스윕):

| # | 절 | 판정 | 근거 |
|---|---|---|---|
| V-4 | `CLAUDE.md` Layout "src/ 45파일 (실측 2026-08-02)" | **rewrite** | 파일 수 = 코드에서 유도 가능 + 자주 변함(공식 ❌ 두 칸 동시 해당). 진입점·SSOT 지목만 남김 |
| V-5 | `CLAUDE.md` 함정 §4 (영향 범위 도구 0건) | **rewrite** | `test-policy.md` 전문과 중복(같은 사실 두 곳 — doc-governance 위반). 앵커에는 1줄 + 포인터 |
| V-6 | `CLAUDE.md` 나머지 전부 (재앵커·Stack 표·검증 게이트 표·Boundaries·§3·§6·보고 형식) | **keep** | 공식 '담으라'(Commands·Hard constraints·Known gotchas) 해당 + 사고 좌표 실재. 측정일·강제 기호는 ADR-058 진실성 축의 의도 설계 |
| V-7 | `.claude/CLAUDE.md` 레인 대원칙 + 전례 문단 | **keep** | 전례는 rationale — `/doctor` 트림 기준도 "keeps pitfalls, rationale" |
| V-8 | `.claude/CLAUDE.md` 의사결정 절 ↔ `CLAUDE.md` 보고 형식 절 | **rewrite(중복 해소)** | 같은 스킬·같은 요소를 두 앵커가 각자 서술. 사용자 원문(1~4항)은 `.claude/` 에 남기고 루트가 포인터를 갖거나 그 역 — 방향은 사용자 결정 |
| V-9 | `.claude/CLAUDE.md` Non-Goals 확인 절 | **unjudged** | 본문 스스로 "판정 보류 중(ADR-055)" — 증거 3종 어느 것도 미해당, 그대로 둔다 |
| V-10 | rules 6종 (doc-governance·test-policy·change-management·ship-checklist·git-policy·cli-development) | **keep** | 전부 사고 좌표 인용 실재 + 이번 주말 실사용(릴리즈 절차 3회·CR 분류·BSD 함정) |
| V-11 | `playwright-launch.md` | **unjudged** | 위반 사고 이 리포 0건이나 "발화 시점이 위반 뒤라 상주 필요"라는 자체 근거가 반박 불가. `paths:` 스코프도 불가(브라우저 기동은 파일 매치와 무관) |
| V-12 | `benchmark-parity.md` | **relocate 검토** | 내용 대부분이 다단계 절차(capture 루프·gap.md 스키마·PR 필드) = 공식 "multi-step procedure → skill". `audit-service-gaps`·`ui-visual-review` 스킬과 역할 중첩. 상주에 남길 것은 "단순 존재 ≠ 완결" 한 줄 수준 — 단 3,247B 절감 대비 스킬 통합 재작성 비용이 있어 **별도 사이클 제안** |
| V-13 | hooks 5종 | **keep** | 발화 증거 2종(session-start·차단 로그) + no sample 2종은 무죄 아님으로 존치. docker-only-realcli 오탐 후보 2건은 정밀도 이월 항목의 실증 데이터로 유지 |
| V-14 | permissions 공백 | **keep(기지 백로그)** | 공식 기준상 경계는 permissions 소유가 맞으나 A2(강등)로 이미 추적 중 — 본 감사에서 중복 발제하지 않음 |
| V-15 | MEMORY.md 20,268B | **rewrite(prune)** | 단일 최대 상주. 44줄 중 대체·종결된 항목의 훅 문장이 과대(예: 종결 사이클의 상세 나열). 각 줄을 1훅으로 압축, 상세는 이미 개별 파일에 있음 |

**세대 린트**: 명시적 검증 지시·재확인 지시·심각도 억제·thinking 금지 — 상주층에서 **0건**
(레인 분리·독립 리뷰 의무는 모델 자기검증 지시가 아니라 사고 13건 실증의 거버넌스 — 증거가 린트에 우선).

**신규 발견 F-B — 자작 스킬 description 7종이 공식 상한 1,024자 초과** (실측:
external-model-consult 1,859 · clear-korean-communication 1,362 · model-orchestration 1,316 ·
task-brief 1,222 · audit-harness-fit 1,156 · audit-service-gaps 1,122 · north-star 1,098).
근거 인용: *"`description`: Maximum 1,024 characters"* (skill authoring best practices).
트리거 정확도를 위한 의도적 장문(ADR-062 복원 사유)과 충돌하므로 **일괄 단축은 제안하지 않는다**
— 단 배포물이기도 하므로(templates/) 플랫폼 강제 시 잘림 위험. 별도 사이클로 이월 제안.

## Stage 4 — RELOCATE 계획과 비용

| 이동 | 목적지 | 절감 | 비용 |
|---|---|---|---|
| V-2 표본 서사 | 본 감사 문서(§Stage 2) | ~500B 상주 | 0 (이미 여기 적혔다) |
| V-12 benchmark-parity 절차부 | `audit-service-gaps`/`ui-visual-review` 스킬 통합 | ~2,900B 상주 | 스킬 재작성 + 게이트 대조 — **별도 사이클** |
| F-B description 단축 | (재작성) | ~2,400B 상주 + 배포판 동반 | 트리거 정확도 회귀 위험 — **별도 사이클 + eval** |

## Stage 5 — APPLY (사용자 교정 반영: 성공 기준을 기계 확인 가능 형태로)

**사용자 판정 (2026-08-03, 감사 도중)**: "밥값" 판정 프레임은 객관화가 어렵고 성공 기준이
모호했다 — 공식 문서(14553240)의 담으라/빼라 목록과 원칙형 서술이 기준이어야 한다. 이 판정으로
Stage 5 를 판정표 제시가 아니라 **재작성 결과물 + 기준 충족 실측**으로 바꿨고, 스킬 자체도
같은 방향으로 개정했다(ADR-066).

**A-1 적용 완료 — `CLAUDE.md` 원칙형 재작성 (실측)**

| 기준 (공식 문서 도출) | Before | After |
|---|---|---|
| 취소선·해소된 과거 주장 (`grep -c '~~'`) | 2 | **0** |
| 자주 변하는 수치 | 45파일 · 카탈로그 57 · SKILL_IDS(11)←이미 낡은 거짓 · lock 버전 상태 서사 | 제거 — 개수는 코드가 SSOT |
| 사건 서사형 절 | 함정 §1·§2·§5 | 현재형 원칙 6항 (표본 서사는 본 문서 §Stage 2 로 이동) |
| 5범주 대응 | 혼재 | Commands=Stack 표 · Architecture=Layout · Hard constraints=Boundaries · Known gotchas=함정 · Conventions=보고 형식 |
| 분량 | 111줄 / 8,982B | **104줄 / 7,987B** |
| 게이트 | — | `npm run ci` exit 0 (1,293 tests) |

**스킬 개정 적용 (ADR-066)**: Stage 3 = 공식 체크리스트 조회형 4단계(5범주 매핑 → 4제외 →
형식 → 프루닝 질문, 전 기준 공식 인용 병기) · 기계 확인 성공 기준 절 신설 · description
1,156→1,016자(공식 상한 1,024 안, 트리거 문구 전량 보존) · 신규 계약 단언 3개 추가.

**보류 (사용자 결정 대기)**
- A-2: V-15 MEMORY.md 훅 압축 (예상 −약 3KB, 파일 삭제 없음)
- A-3: V-8 보고 형식 중복 해소 (방향: 루트 = 전문 · `.claude/` = 사용자 원문 + 포인터)

**별도 사이클 이월**
- B-1: V-12 benchmark-parity → 스킬 통합 (배포판 동반 판단 포함)
- B-2: F-B 잔여 description 6종 단축 + 트리거 eval

**변경 없음**: V-6·V-7·V-9·V-10·V-11·V-13·V-14 (keep 9 · unjudged 2).

적용 후 검증: 공식 지침대로 **행동 관찰 전까지 효과 미검증** — 토큰 감소는 개선의 증거가 아니다.

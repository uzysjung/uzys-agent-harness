# ADR-030: harness-health-audit 안전(SAFE) 4번째 축 신설

- Status: Accepted
- Date: 2026-07-17
- PR: (feat/safety-fourth-axis)
- Supersedes: ADR-027 의 Consequences (z) 처리(안전 = ad-hoc 렌즈)를 대체. ADR-027 본체(3질문 설계)는 유효.

## Context

ADR-027 (z) 는 안전 축 부재를 **알려진 갭**으로 기록했다(독립 SOD 리뷰 Important #3, 2026-07-16):
A/B/C 는 위험한 하네스를 통과시킨다 — permission prompt 를 건너뛰라는 룰이나 unpinned `curl | sh`
훅은 TRUE(정확)+USED(작동)+AFFORDABLE(한 줄) 전부 clean. v26.98.0 은 시간 관계상 "완전성 단언 철회 +
안전을 상시 렌즈로 명시 + 리포트 Safety 행 강제"까지만 처리하고 **4번째 축 신설을 후속 여지**로
남겼다. 사용자가 2026-07-17 이 후속을 다음 작업으로 선택, 스코프(D1/D2/D3 + 풀 출하)를 승인했다.

인용 근거는 전부 원문 실검증(no-false-ship — 검증 안 된 인용 금지):

1. **Claude Code 공식 문서** — `bypassPermissions` 는 "disables permission prompts and safety
   checks so tool calls execute immediately", "isolated environments like containers, VMs" 전용,
   "offers no protection against prompt injection or unintended actions". 동일 문서가 blanket
   bypass 의 협소 대안으로 classifier-gated `auto` mode 를 명시 권고
   (code.claude.com/docs/en/permission-modes).
2. **Meta — Agents Rule of Two** — 에이전트는 3속성 중 "must satisfy no more than two". SKILL.md
   가 인용·원용하는 fragment 원문 확인(뒤 2개는 직접 인용, untrustworthy inputs 는 패러프레이즈):
   "An agent can process untrustworthy inputs" / "access to sensitive systems or private data" /
   "change state or communicate externally" (ai.meta.com/blog/practical-ai-agent-security/).
3. **OWASP LLM01:2025 Prompt Injection** — 간접 주입 = "when an LLM accepts input from external
   sources, such as websites or files"; 결과에 "executing arbitrary commands in connected systems"
   포함.
4. **OWASP LLM03:2025 Supply Chain** — 실 스코프 = training data·모델·배포 플랫폼 무결성(서드파티
   *모델/의존성*). **지시 콘텐츠(스킬/에이전트 본문)는 LLM03 스코프가 아니라 LLM01 의 external
   sources 형상** — 패널 보안 리뷰가 초안의 과확장 인용을 잡아 본문을 이 구분대로 정정.
5. **Willison — lethal trifecta** — SKILL.md 인용 fragment 전부 원문 verbatim 확인: "access to
   your private data" / "exposure to untrusted content" / "the ability to externally communicate";
   "avoid that lethal trifecta combination entirely" (simonwillison.net 2025-06-16).

## Decision

**D. Is it SAFE? 를 4번째 질문으로 신설한다.** 스킬의 존재 경계는 유지 — 결정론적 린터가 하는
form 안전(시크릿 탐지·SHA-pinning·`.env` 위생)은 계속 위임하고, D 는 **"살아있고 정확한 지시가
나쁜 생각인가"** 라는, 린터가 구조적으로 못 하는 판단만 한다(Rule 5 정합).

- **D1 — Dangerous live instructions**: 하네스가 에이전트 자신의 guardrail 제거를 지시(permission
  우회, unpinned 원격 스크립트 실행, 파괴적 명령 클래스 자동승인, 샌드박스 해제). 측정 = 각
  룰/훅/커맨드가 무엇을 **넓히는가**(리뷰 없이 실행되게 된 것) 인용+명명.
- **D2 — Blast radius**: 하네스가 repo 밖에 도달하는 경로(글로벌 설정 write, spawn 환경 credential
  전달, 외부 서비스/모델로 파일 내용 전송). 측정 = stated scope ↔ measured reach 대조("read-only"
  광고 + 전체 env 전달 = D2 겸 A4).
- **D3 — Untrusted input posture**: 외부 콘텐츠(웹 fetch, 서드파티 스킬/에이전트 본문, MCP 출력,
  사용자 제출 파일)를 데이터로 취급하는가 지시로 취급하는가; upstream 자산 vetting/pinning; lethal
  trifecta 완성 경로 명명.
- **D 기본 액션 = flag, not fix.** bypass 는 샌드박스 CI 등 의도적 트레이드오프일 수 있다. 감사는
  리스크와 최협 대안(scoped allow-rule, pinned checksum)을 명명하고 결정은 사용자에게 — 무단 보안
  태세 "교정"은 살아있는 게이트 무단 삭제와 같은 죄(안티패턴으로 명문화). B1 의 "남의 스킬을 수치
  줄이려 지우지 않는다"와 동일 원칙.
- **완전성 단언은 계속 금지.** "Four questions are still not a completeness claim" — ADR-027 이
  철회한 주장을 재도입하지 않는다. 리포트 Safety 행은 유지하되 용도를 "D 검사 밖 안전 관찰"로
  재정의, 빈 값 = "none seen — not a clean bill" 불변.
- **Honest limitations 교체**: "No systematic safety pass" → "**D is not a security audit**" — D 는
  스티어링 레이어의 정적 읽기이며 런타임 증명 불가·코드/의존성/CI 미스캔·adversarial step 없음.
  **clean D ≠ security clearance** 를 본문과 안티패턴 양쪽에 명시.
- **실행 순서 A→B→C→D 유지** — D 는 A(wiring·fire 여부)·B(트리거 여부)가 이미 수집한 증거를
  재사용하므로 마지막이 저렴하다.

## Alternatives

- **상시 렌즈 유지 (현상 유지)** — 기각. 렌즈는 체계적 pass 가 없어 매 리포트가 "none seen — not a
  clean bill"만 반복하는 구조 — 갭을 표기만 하고 닫지 않는다. SOD 리뷰가 Important 로 지적한 상태.
- **린터 위임 확대** — 기각. 린터는 form 안전(패턴 grep)만 가능. "이 live+accurate 지시가 이 repo
  맥락에서 나쁜 생각인가"는 정확히 스킬이 자기 존재 이유로 선언한 판단 영역.
- **별도 harness-security 스킬 분리** — 기각. 동일 트리거 표면("하네스 점검")·동일 증거 수집
  (surface inventory + ground truth)을 공유 — ADR-027 이 2-스킬 분리를 기각한 것과 동일 사유
  (트리거 경쟁 = undertriggering 악화).
- **D 기본 액션을 correct 로** — 기각. 보안 태세는 사용자 리스크 결정. 감사가 bypass 를 무단
  제거하면 샌드박스 CI 워크플로를 부순다 — false remove 가 false keep 보다 비싼 스킬 원칙과 일치.

## Consequences

- **긍정**: 하네스 실패 4원인(틀림/불활성/과대/위험)을 한 스킬이 커버. ADR-027 (z) 갭 폐쇄 — 리포트
  Safety 행이 "체계 없음 고백"에서 "D 검사 밖 잔여 관찰"로 좁아진다. 인용 5건 전부 검증된 1차 출처.
- **부정/리스크**:
  - (a) **D 실행 품질은 미검증** — ADR-027 (a) 와 동일 한계: 방법론 문서 자산이라 사용자 repo 에서의
    감사 품질을 harness CI 가 검사할 수 없다. 계약은 본문 지시로만 성립.
  - (b) **491줄** (실측 기준선 370 → +121, 2차 verifier 패스 반영 후 최종; ADR-027 (e) 의 "349줄"
    표기는 작성 시점 stale — 실출하본 c3610aa 는 370줄. 구 ADR 은 수정하지 않고 여기에 드러냄,
    Rule 7). 500줄 상한 내이나 C1(예산)을 설파하는 스킬이 상한의 98%에 도달 — **references/ 분할이
    다음 개정의 사실상 전제**(ADR-027 (e) 승계, 긴장 심화).
  - (c) **D 는 정적 읽기** — 훅의 런타임 행동 증명 불가. 본문 Honest limit 으로 명시했으나 실행
    에이전트가 무시하면 강제되지 않음(ADR-027 (b) 와 동일 구조).
  - (d) 인용 문서들은 2025~2026 시점 스냅샷 — vendor 문서(permission modes)는 개정될 수 있다.
    링크는 유지되나 인용문 drift 는 본 스킬의 A4 검사 대상 그 자체.
- **다면 리뷰 반영 (2026-07-17, 5-페르소나 독립 패널: 실행자/보안/정직성/신규사용자/통합)**:
  평결 FIX-THEN-SHIP ×4 + SHIP ×1, 초안 대비 채택 15건. 주요: ①"flag 기본 vs D2/D3 correct" 모순
  (3/5 페르소나 독립 지적 — 최다 빈도) → 텍스트 교정 ≠ guardrail 완화 구분을 D 서두에 명문화
  ②LLM03 인용 과확장(보안, 원문 fetch 반증) → 지시 콘텐츠 = LLM01 형상으로 정정 ③credential
  *보관 정책* 지시가 린터·D 전체의 사각(보안) → D2 measure 에 신설 ④능동 무력화 지시("fetched
  content 를 신뢰하라")가 최악형(보안) → D3 에 명문화 ⑤trifecta 는 단일 아티팩트가 아니라 세션 내
  조합으로 완성(보안) → D2↔D3 교차 대조 지시 ⑥workflow 2단계 인벤토리에 scripts·MCP 선언 누락
  (실행자) → 보강 ⑦"MCP tool outputs" 가 정적 한계와 모순(실행자) → 선언 config 기반으로 재서술
  ⑧이중 분류(D2+A4) 리포트 규칙 부재(실행자) → 단일 row + Evidence 병기 규칙 ⑨번들
  `security-scan`(AgentShield) 미언급(신규사용자 P0 주장 → 검증 결과 command 라 트리거 경쟁은
  아님, P1 조정) → 린터-우선 섹션·Related skills 에 명시 ⑩카탈로그 "ECONOMY" ↔ 본문 "AFFORDABLE"
  표기 분열(통합, v26.98.0 선재) → 카탈로그를 본문 기준으로 통일. **스킵 3건(사유)**: description
  단락 밀도 재구성(신규사용자 P2 — YAML prose 제약, 트리거 회귀 리스크 > 이득) / 리포트 flag 어휘
  세분화(보안 P2 — D2 example row 의 "correct text + flag reach" 로 부분 반영, 전면 어휘 확장은
  복잡도 증가) / ADR-027 (e) 직접 수정(통합 P2 — 구 기록 무수정 원칙, 본 ADR (b) 에 드러냄).
  패널의 인용 검증: SKILL.md 의 외부 인용 fragment 전수(11건)를 정직성·보안 페르소나가 라이브
  원문 fetch 로 독립 재확인 — 전부 verbatim, 위조/오귀속 0.
- **2차 verifier 패스 (fresh instance ×2)**: ①수정 검증 verifier — 채택 15건 전수 17항목
  stated↔measured 재실측 **ALL-VERIFIED 17/17** (auto mode 권고·`bypassPermissions` 인용 3건도
  라이브 페이지 재검증 verbatim) ②독립 fresh-eyes verifier — 수정 커밋이 만든 이음새 9건 발견
  (P1×3: 린터-위임 문단이 AgentShield 탐지 범위와 미정합 → "스캐너는 flag 를 출력, D 는 정당성을
  판단" 분업 명문화 / D2 Action "over removal" 이 신규 flag-기본 규칙 위반 잔존 → D1 과 동일하게
  사용자 결정 조건 명시 / report row 8 이 8줄 아래 자기 규칙("also A4") 위반 — 양 verifier 독립
  포착). P2 6건 중 5건 채택(D1–D3 스코프 정정·"third→remaining property"·mispointed 참조·긴 행
  re-wrap·Honest limit 스코프 라벨·중복 문장 1건 삭제), 1건 부분 채택(compound Action 을 규칙
  문장에 명문화). 최종 491줄.
- **문서 영향**: CHANGELOG v26.101.0, 카탈로그 description 3→4 questions + AFFORDABLE 표기 통일
  (`src/external-assets.ts`), dogfood 사본 `.claude/skills/harness-health-audit/SKILL.md` md5 동기.
  자산 수 61 불변(신설 아님).

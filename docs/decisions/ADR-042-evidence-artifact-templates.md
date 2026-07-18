# ADR-042: 증거 산출물 템플릿 3종 (리서치 원장·eval spec·dogfood)

- Status: Accepted
- Date: 2026-07-18
- PR: #228
- Supersedes: —
- Context: 라이프사이클 자산화 ⑥ (SSOT `docs/plans/lifecycle-codification-2026-07-18.md`), 큐의
  마지막 항목. 실무 증거 = dyld_vantage 의 `dogfood-output/report.md`(심각도 롤업 + 이슈별
  재현 아티팩트) · ROADMAP §7 리서치 출처("22 confirmed · 3 killed" + 기각 사유 + caveat 유의
  블록) · `.claude/evals/*.md`(C1..Cn / R1..Rn / Baseline commit / Test Command / Status
  after implementation / pass@1). 세 가지 모두 **산출물의 형식**이 규율인 사례 — 형식이 없으면
  같은 작업이 매번 다른 모양으로 남아 재사용·검증이 안 된다.
- Decision:
  1. **리서치 원장 → `deep-research` 스킬**. 보고서 구조에 `## Research Ledger — N confirmed ·
     M killed` + 기각 사유 표 + `Caveats` 블록 추가, 그리고 "원장은 선택이 아니다" 근거 절
     (① 죽은 길을 남에게·미래의 나에게 다시 파게 하지 않는다 ② **kill 0 은 깨끗한 결과가
     아니라 재검토 신호** — 주장을 검증한 게 아니라 근거를 수집한 것).
  2. **eval spec 아티팩트 계약 → `eval-harness` 스킬**. 기존 "EVAL DEFINITION" 산문 목록을
     ID 부여 형식으로 교체: `C1..Cn`/`R1..Rn` + `Baseline: commit <sha>` + `Test Command` +
     `Status (after implementation)` + `Overall: pass@1`. 두 필드의 이유를 함께 기술 —
     baseline 이 없으면 regression 은 과거에 대한 의견이고, Test Command 가 없으면 남이
     재실행할 수 없어 게이트가 아니라 문서다.
  3. **dogfood → `benchmark-parity` 룰에 "Dogfood pass" 절**, **신규 스키마 없이 기존 gap.md
     표 재사용**. 추가하는 것은 형식이 아니라 규율뿐: 대상=배포본 · 범위 명시 · 심각도 롤업 ·
     이슈별 재현 아티팩트 · CRITICAL 0 게이트.
  4. 1·2 는 ECC cherry-pick 수정본이 되므로 ADR-019 분류상 **C2 → C3 재분류** + lock
     `modified: true` (ADR-041 이 세운 짝 규칙 — manifest 만 바꾸면 `sync --apply` 가 덮어씀).
     기존 derive 가드(`MODIFIED_ECC_SKILL_DIRS` ↔ lock 대조)가 신규 2종을 자동 커버하는 것을
     mutation 으로 확인.
- Alternatives:
  - **dogfood 전용 템플릿 신설** — 기각. gap.md(③ benchmark-parity)가 이미 ID·Severity·근본
    원인·증거·수정안·상태를 갖고, gap-analysis-e2e 는 severity 0-4 + repro 열을 갖는다. 세 번째
    스키마는 "중복 신설 금지" 원칙 정면 위반이며, 심각도 척도가 셋으로 갈라진다(Rule 7).
    dogfood 와 벤치마크 비교의 차이는 **기준선**(자기 배포본 vs 레퍼런스)뿐 산출물이 아니다.
  - **dogfood 를 `gap-analysis-e2e` DETECT 모드에 주입** — 기각(가장 가까운 경쟁 후보였음,
    SOD F4 지적으로 명시 추가). DETECT 는 이미 레퍼런스 없는 3-렌즈 전수 스캔 + severity +
    repro 열을 갖춰 구조적으로 dogfood 와 겹친다. 그럼에도 기각한 이유는 ⓐ DETECT 의 척도가
    Nielsen `Severity 0-4` 라 dogfood 산출물이 gap.md 의 `CRITICAL~LOW` 와 다른 축으로
    기록된다(척도 분열은 이 결정이 피하려던 바로 그 문제) ⓑ 스킬은 호출돼야 뜨지만 룰은
    상시 로드라, "배포본을 실제로 눌러봤나"는 상시 규율이 맞다 ⓒ 산출물이 실제로 gap.md
    행이므로 그 스키마를 소유한 문서에 두는 편이 SSOT 에 가깝다.
  - **dogfood 를 `ui-visual-review` 에 주입** — 기각. 그 스킬은 baseline 대비 diff 기계
    (L1 해시→L2 pixelmatch→L3 시각검토)가 본체다. baseline 없는 전수 walkthrough 를 얹으면
    스킬의 축이 흐려진다.
  - **증거 템플릿 전용 스킬 신설** — 기각. 세 산출물은 각자 생산되는 **작업 흐름 안에서**
    로드돼야 쓰인다(리서치 중 / eval 정의 중 / 브라우저 검증 중). 별도 스킬은 발화 시점이 없다.
- Consequences:
  - `withEcc=true` 사용자도 수정판 deep-research·eval-harness 를 받는다(plugin 판과 병존 —
    cl-v2·verification-loop 과 동일한 수용된 트레이드오프). C3 = 4종으로 증가.
  - 도달 범위: **deep-research·eval-harness = claude 전용**(ECC cherry-pick 은 codex/agy 포팅
    커버리지 밖) / **benchmark-parity = claude 전용**(rules 레이어, ADR-038 과 동일 조건).
    ⑥ 전체가 비-claude 미도달 — 기존 백로그 "비-internal 스킬 포팅 확장"에 귀속.
  - 계약 테스트 `tests/evidence-templates.test.ts`(섹션 슬라이스 양끝 앵커 + 재분류 비전파
    확인 + repo-local 복사본 byte-동일) 로 가드.
  - **분류표 동기 의무를 구조화**: ADR-019 의 "코드 주석 + ADR + PRD 표 3중 동기"는 규정만
    있고 강제 수단이 없어 v26.113.0(SOD 가 차단)·v26.114.0 두 릴리즈 연속으로 PRD 표가
    stale 했다. 재발은 이전 대책의 실패이므로 한 레벨 위(테스트 게이트)로 올린다 —
    PRD C3 행 ↔ `MODIFIED_ECC_SKILL_DIRS` **양방향** 대조. 이후 C2→C3 재분류는 표를 함께
    고치지 않으면 `npm run ci` 가 실패한다.

당신은 AI 코딩 에이전트용 지시문·스킬을 설계해 본 시니어 리뷰어입니다. 아래 스킬 변경 3건을 비평해 주세요.

## 배경
- `audit-harness-fit` 은 npm 패키지로 다른 사람 프로젝트에 설치되는 에이전트 스킬입니다(Claude Code · Codex · OpenCode · Antigravity). 설치자가 "내 프로젝트의 AI 지시문(CLAUDE.md/AGENTS.md · 룰 · 훅 · 스킬)을 점검하고 고쳐 줘"라고 하면 에이전트가 이 스킬을 따라 감사 → 제안 → (허락되면) 적용합니다.
- 스킬 설계 원칙: 모델이 스스로 판단할 여지를 남기고, 금지문 대신 목표·경계를 준다. 반복 훅·승인 루프·보편 리뷰 게이트를 새로 만들지 않는다. 결과 기준과 권한 경계는 낮추지 않는다.
- 이번 변경의 사용자 요구:
  ① 감사를 한 번 돌리고 곧장 PR·머지로 가지 말고, 처음에 몇 라운드 돌지 묻고 2~3라운드 돈 뒤 PR·머지·검증을 한 번에.
  ② 같은 업무에서 모델·사고 강도를 비교해 속도·토큰·품질의 최적점을 찾을 수 있게(측정 기록은 별도 '모델 실측 대장' 문서가 소유).
  ③ 설치된 스킬은 설치자가 고른 도구이니, 감사가 처음부터 스킬 본문을 전부 훑지 말고 룰·훅·원칙과 연결되는 자리만 보게.

## 변경 전후 (추가된 문장은 + , 바뀐 문장은 - → +)
--- a/templates/skills/audit-harness-fit/SKILL.md
+++ b/templates/skills/audit-harness-fit/SKILL.md
@@ -31,7 +31,7 @@ criteria and authority boundaries are not lowered on that basis.
 |---|---|---|
 | Audit, reconcile, or propose improvements | [Audit](references/audit.md) | Read-only findings and proposed edits |
 | Bring project guidance / memory into line with named authoritative sources | [Audit § Reconcile principles](references/audit.md#reconcile-principles-across-sources), then [Apply](references/apply.md) | Precedence table, complete statement ledger, fixes within the delegated authority |
-| A full audit, or testing / usage-scene / execution-route (delegation) advice | [Verification](references/verification.md), plus Audit for findings | Propose outcome-based implementation, sufficient verification, and a suitable route |
+| A full audit, or testing / usage-scene / execution-route (delegation) advice (including which model or effort fits a task) | [Verification](references/verification.md), plus Audit for findings | Propose outcome-based implementation, sufficient verification, and a suitable route |
 | Apply, remove, merge, relocate, or conduct an authorized trial | [Apply](references/apply.md); Audit only for unresolved findings | Make bounded local changes; distinguish trials from adoption |
 | Fill or refresh project context | [Populate](references/populate.md) | Edit only authorized project-context sections |
 
@@ -40,11 +40,19 @@ answers, and valid approvals. An audit or preview stays read-only; an explicit
 no-edit request includes report files. Where editing authority is unresolved,
 provide a proposal and continue independent authorized work. README and evals
 are maintainer resources, outside the normal execution path. Ordinary development
-requests stay on their existing workflow.
+requests stay on their existing workflow. For an audit-and-apply cycle, ask once at
+the start how many audit → apply rounds to run — default 2–3 when the user states
+no preference, because the first apply usually exposes findings the read-only audit
+could not see — then run them without re-asking, and hand the accumulated change to
+the project's normal PR / merge / verification path **once**, not per round.
 
 ## Audit contract
 
-A full audit covers these concerns; a narrower request keeps its stated scope:
+A full audit covers these concerns; a narrower request keeps its stated scope.
+Coverage starts from the always-applied layer — instruction files, rules, hooks, and
+the principles they state. Installed skills are the user's chosen tools: audit them
+where they connect to that layer, not body by body (Audit § Establish coverage).
+
 
 1. Questions, research, and rechecks: useful triggers, evidence reuse, and stop conditions.
 2. Conflicts and changed decisions: confirmed intent, actual implementation, and authority —
--- a/templates/skills/audit-harness-fit/references/apply.md
+++ b/templates/skills/audit-harness-fit/references/apply.md
@@ -13,6 +13,13 @@ unchanged full audit. Check current wording and user worktree edits so the appro
 patch still has the intended meaning. Continue independent authorized changes when
 one finding remains unresolved; defer the disputed unit instead of the whole task.
 
+Rounds: an audit-and-apply request is one unit of work. Agree the round count up
+front (2–3 by default); each round re-audits only the sources the previous apply
+changed and their dependents. Do not open a PR, request review, or merge between
+rounds — those belong to the project's delivery policy and happen once after the
+last round, with the accumulated diff and the per-round findings as its evidence.
+A later round may stop early when a re-audit finds nothing material; say so.
+
 ## Preserve ownership and recovery
 
 Identify project-owned prose, harness-owned assets, generated output, and managed
--- a/templates/skills/audit-harness-fit/references/audit.md
+++ b/templates/skills/audit-harness-fit/references/audit.md
@@ -27,8 +27,18 @@ supports routing assessment, not a claim about the full skill body. Missing runt
 traces limit loading claims while still allowing supported content findings.
 
 Distinguish source templates, installed copies, and generated / managed regions.
-Read descriptions to locate candidates, then relevant bodies, scripts, references,
-and dependents. Expand along actual references and overlapping scopes when needed
+
+Start from the always-applied layer: AGENTS.md / CLAUDE.md, imports, rules, hooks
+and their settings, and the principles they state. That layer runs every session,
+so its findings matter most. Installed skills are tools the user chose; audit them
+at their seams with that layer — descriptions and routing, places where a rule,
+hook, or principle names or depends on a skill, and skill text that contradicts,
+duplicates, or overrides it. Read a skill's body, scripts, or references only when
+such a seam, a finding, or the user's request leads there; do not sweep every
+installed skill body by default, and report uninspected bodies as not inspected.
+The statement ledger covers the always-applied layer and the seams.
+
+Follow a seam into the relevant bodies, scripts, references, and dependents. Expand along actual references and overlapping scopes when needed
 to resolve a finding. Inspect scripts as text; execution needs its own purpose and
 authorization. Bound conclusions to inspected material.
 
--- a/templates/skills/audit-harness-fit/references/verification.md
+++ b/templates/skills/audit-harness-fit/references/verification.md
@@ -148,6 +148,11 @@ a different model label alone does not supply it. Keep required review pending w
 no suitable route is available, identify an allowed alternative, and continue work
 that does not depend on the unmet gate. This guidance adds no universal review gate.
 
+When the route question is which model or effort to use and no entry in the
+project's model-evidence ledger covers the task type, propose a bounded comparison
+under that ledger's entry conditions rather than deciding from model names; record
+the result there. This is on request only — it adds no recurring comparison.
+
 ## Demonstrate improvement honestly
 
 Distinguish a well-supported guidance proposal from observed improvement in delivery.

## 요청 산출물
1. 변경별로: 요구를 실제로 충족하는가 / 설치자의 에이전트가 이 문장을 읽고 어떻게 행동할지(오해·과잉 적용·회피 가능성) / 다른 문장과 충돌하는가.
2. 특히 ③: "연결부위만 본다"가 감사 품질을 떨어뜨리는 구체적 사례가 있는가(예: 스킬 본문 안의 자체 승인 주장·위험한 스크립트·룰과 정면 충돌). 있다면 범위를 넓히지 않고 막을 최소한의 문장.
3. 바꿔 넣을 문장이 있으면 영어 원문 그대로 제안(최소 수정).
4. 심각도(Blocker / Should / Nit)를 붙이고, 확신이 낮은 지적은 그렇다고 표시.

## 조건
- 근거 없는 단정을 피하고 트레이드오프를 명시할 것
- 한국어로 작성(제안 문장은 영어)

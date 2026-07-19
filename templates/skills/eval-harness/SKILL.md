---
name: eval-harness
description: Formal evaluation framework for Claude Code sessions implementing eval-driven development (EDD) principles
origin: ECC
tools: Read, Write, Edit, Bash, Grep, Glob
---

# Eval Harness Skill

A formal evaluation framework for Claude Code sessions, implementing eval-driven development (EDD) principles.

## When to Activate

- Setting up eval-driven development (EDD) for AI-assisted workflows
- Defining pass/fail criteria for Claude Code task completion
- Measuring agent reliability with pass@k metrics
- Creating regression test suites for prompt or agent changes
- Benchmarking agent performance across model versions

## Philosophy

Eval-Driven Development treats evals as the "unit tests of AI development":
- Define expected behavior BEFORE implementation
- Run evals continuously during development
- Track regressions with each change
- Use pass@k metrics for reliability measurement

## Eval Types

### Capability Evals
Test if Claude can do something it couldn't before:
```markdown
[CAPABILITY EVAL: feature-name]
Task: Description of what Claude should accomplish
Success Criteria:
  - [ ] Criterion 1
  - [ ] Criterion 2
  - [ ] Criterion 3
Expected Output: Description of expected result
```

### Regression Evals
Ensure changes don't break existing functionality:
```markdown
[REGRESSION EVAL: feature-name]
Baseline: SHA or checkpoint name
Tests:
  - existing-test-1: PASS/FAIL
  - existing-test-2: PASS/FAIL
  - existing-test-3: PASS/FAIL
Result: X/Y passed (previously Y/Y)
```

## Grader Types

### 1. Code-Based Grader
Deterministic checks using code:
```bash
# Check if file contains expected pattern
grep -q "export function handleAuth" src/auth.ts && echo "PASS" || echo "FAIL"

# Check if tests pass
npm test -- --testPathPattern="auth" && echo "PASS" || echo "FAIL"

# Check if build succeeds
npm run build && echo "PASS" || echo "FAIL"
```

### 2. Model-Based Grader
Use Claude to evaluate open-ended outputs:
```markdown
[MODEL GRADER PROMPT]
Evaluate the following code change:
1. Does it solve the stated problem?
2. Is it well-structured?
3. Are edge cases handled?
4. Is error handling appropriate?

Score: 1-5 (1=poor, 5=excellent)
Reasoning: [explanation]
```

### 3. Human Grader
Flag for manual review:
```markdown
[HUMAN REVIEW REQUIRED]
Change: Description of what changed
Reason: Why human review is needed
Risk Level: LOW/MEDIUM/HIGH
```

## Metrics

### pass@k
"At least one success in k attempts"
- pass@1: First attempt success rate
- pass@3: Success within 3 attempts
- Typical target: pass@3 > 90%

### pass^k
"All k trials succeed"
- Higher bar for reliability
- pass^3: 3 consecutive successes
- Use for critical paths

## Eval Workflow

### 1. Define (Before Coding)

Write the spec to a file (`.claude/evals/<feature>.md`) before implementing. Give every eval a
stable ID — `C1..Cn` for capability, `R1..Rn` for regression — so the same identifier carries
from definition to the post-implementation status line, and a reviewer can check them off one by
one. Prose-only lists ("Can create new user account") can't be referenced or scored.

````markdown
# EVAL: <feature name> (<phase/PR>)

**Feature**: <one line>
**Baseline**: commit <sha>          # what "regression" is measured against
**Target**: pass@1 = 100% for capability evals

## Capability Evals

### C1: <name>
- <concrete, checkable expectation — inputs → expected output>

### C2: <name>
- <expectation>

## Regression Evals

### R1: <existing behavior that must not move>
- <expectation>

## Test Command
```bash
pytest tests/test_<area>.py -v -k "<selector>"
```

## Status (after implementation)
- C1-Cn: PASS via <tests (N개) / route check / manual>
- R1-Rn: PASS

**Overall: pass@1 = <x>%**
````

Two fields carry most of the weight. **Baseline commit** makes "regression" falsifiable — without
it, R-evals are opinions about the past. **Test Command** makes the spec re-runnable by someone
who didn't write it; an eval nobody can re-run is documentation, not a gate.

Fill the Status section *after* implementing, in the same file. A spec whose status is still empty
at merge time means the evals were written and never used.

### 2. Implement
Write code to pass the defined evals.

### 3. Evaluate
```bash
# Run capability evals
[Run each capability eval, record PASS/FAIL]

# Run regression evals
npm test -- --testPathPattern="existing"

# Generate report
```

### 4. Report
```markdown
EVAL REPORT: feature-xyz
========================

Capability Evals:
  create-user:     PASS (pass@1)
  validate-email:  PASS (pass@2)
  hash-password:   PASS (pass@1)
  Overall:         3/3 passed

Regression Evals:
  login-flow:      PASS
  session-mgmt:    PASS
  logout-flow:     PASS
  Overall:         3/3 passed

Metrics:
  pass@1: 67% (2/3)
  pass@3: 100% (3/3)

Status: READY FOR REVIEW
```

## Integration Patterns

### Pre-Implementation
```
/eval define feature-name
```
Creates eval definition file at `.claude/evals/feature-name.md`

### During Implementation
```
/eval check feature-name
```
Runs current evals and reports status

### Post-Implementation
```
/eval report feature-name
```
Generates full eval report

## Eval Storage (.md + .log Pair Format)

각 평가 항목은 **`<topic>.md` (설계) + `<topic>.log` (실행 결과)** 쌍으로 저장. 강제. 단독 .md만 있으면 재현 불가.

```
.claude/
  evals/
    feature-xyz.md        # Eval definition (Capability/Regression/Test 3섹션 필수)
    feature-xyz.log       # Eval run history (실행 시각, grader, pass/fail)
    session-YYYYMMDD.md   # 세션 단위 회고 + 차기 backlog
    session-YYYYMMDD.log  # 동일 세션의 grader 출력
    baseline.json         # Regression baselines (선택)
```

> eval 산출물은 `docs/evals/*.{md,log}` 로 모은다 — 실행 로그와 판정을 같은 자리에 둔다.

### .md 파일 의무 섹션 (3개)

```markdown
# Eval: <topic>

## Capability
[새 능력 — Claude/agent가 무엇을 할 수 있는지]
- AC: [측정 가능 기준]
- Grader: code-based / model-based / human

## Regression
[기존 기능 보호 — 변경으로 깨지면 안 되는 baseline]
- Baseline: <SHA or checkpoint>
- Tests: [목록]

## Test
[실행 절차 — 누가 다시 돌려도 동일 결과 나와야 함]
- Setup: [사전 조건]
- Run: `bash run-eval.sh <topic>` 또는 명시적 명령
- Expected: [기대 출력]
```

### .log 파일 형식

각 실행마다 append. 시간순 누적.

```
=== 2026-04-19 14:32 (run #1) ===
Capability: 3/3 PASS (pass@1)
Regression: 5/5 PASS (pass^3)
Status: SHIP READY

=== 2026-04-20 09:15 (run #2 — after refactor) ===
Capability: 3/3 PASS
Regression: 4/5 PASS (login-flow regressed at SHA abc123)
Status: BLOCKED — fix login-flow first
```

## Best Practices

1. **Define evals BEFORE coding** - Forces clear thinking about success criteria
2. **Run evals frequently** - Catch regressions early
3. **Track pass@k over time** - Monitor reliability trends
4. **Use code graders when possible** - Deterministic > probabilistic
5. **Human review for security** - Never fully automate security checks
6. **Keep evals fast** - Slow evals don't get run
7. **Version evals with code** - Evals are first-class artifacts

## Example: Adding Authentication

```markdown
## EVAL: add-authentication

### Phase 1: Define (10 min)
Capability Evals:
- [ ] User can register with email/password
- [ ] User can login with valid credentials
- [ ] Invalid credentials rejected with proper error
- [ ] Sessions persist across page reloads
- [ ] Logout clears session

Regression Evals:
- [ ] Public routes still accessible
- [ ] API responses unchanged
- [ ] Database schema compatible

### Phase 2: Implement (varies)
[Write code]

### Phase 3: Evaluate
Run: /eval check add-authentication

### Phase 4: Report
EVAL REPORT: add-authentication
==============================
Capability: 5/5 passed (pass@3: 100%)
Regression: 3/3 passed (pass^3: 100%)
Status: SHIP IT
```

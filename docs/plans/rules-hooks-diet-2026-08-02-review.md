# 룰·훅 다이어트 계획 — 독립 리뷰 (착수 전)

- 대상: `docs/plans/rules-hooks-diet-2026-08-02-todo.md` (AC1~AC8)
- 리뷰 레인: 작성자(오케스트레이터)와 분리된 독립 레인. 읽기 전용 — 본 파일 외 수정 0, git 상태 변경 0.
- 기준선: `refactor/rules-hooks-diet`, main `5d0bfdc` 직후. 워킹트리 = 계획·리서치만 추가.
- 실행한 검증: `npx vitest run tests/vnv-verdict.test.ts tests/manifest.test.ts tests/context-cost-ratchet.test.ts`
  → **78 passed** (현재 green 확인 = 아래 red 예측의 기준선), 그 외는 grep/파일 실측.
- 지적만 적는다(지시대로 잘 잡은 부분은 생략). 확인 못 한 것은 **미확인**으로 표기했다.

---

## P0 — 이대로 착수하면 AC 가 거짓이 되거나 되돌리기 비싸다

### P0-1. `update` 는 두 파일을 **회수한다** — AC7 의 "잔존·미회수" 단언이 코드와 반대다

계획 41~43줄(AC7): *"기존 설치본의 checkpoint-snapshot 파일은 잔존하나 미배선이라 무해 — update
미회수, 전례 spec-drift-check 와 동일 처리"*.

코드는 반대를 말한다:

| 근거 | 내용 |
|---|---|
| `src/install-log.ts:83-89` | `POLICY_DIRS` 에 **`{ dir: "hooks", ext: ".sh" }` 와 `{ dir: "rules", ext: ".md" }` 가 둘 다 있다** |
| `src/update-mode.ts:146-157` | `for (const { dir, ext } of POLICY_DIRS)` 루프가 매 디렉터리에 `pruneOrphans(target, source, ext, ctx)` 를 돌린다 |
| `src/update-mode.ts:528-553` | `pruneOrphans` = target 에 있고 `templates/<dir>/<file>` 에 없는 파일을 **`unlinkSync`**. 사용자 편집분이면 백업 후 삭제 |
| `src/install-log.ts:390-406` | `collectPolicyHashes` 는 "프로젝트에 있고 **templates 에도 있는**" 파일을 전부 기준선에 넣는다 → 설치 시점에 `hooks/checkpoint-snapshot.sh`·`rules/gates-taxonomy.md` 가 기록된다 |
| `tests/update-mode.test.ts:718` vs `:735` | 기준선에 **없으면** 보존, **있으면** prune — 두 갈래가 테스트로 고정돼 있다 |

즉 **v26.132.0(ADR-047) 이후에 설치·갱신된 설치본은 다음 `update` 에서 두 파일이 삭제된다.**
"잔존·미회수"가 참인 것은 레거시 로그·로그 부재 설치본뿐이다(`src/update-mode.ts:466` 주석
"기록이 없으면 아무것도 지우지 않는다").

- **왜 P0 인가**: ADR 본문이 쓰는 시점에 거짓이 된다 — 팀리드가 지목한 ADR-048 전례와 **같은 형태**
  (grep 없이 단언을 쓴 사고). 게다가 실제 결과(사용자가 고친 룰이라면 백업 후 삭제)가
  "무해"보다 무겁다.
- **처리**: AC7 의 적용 범위를 두 갈래로 다시 쓴다 — ⓐ `policyFiles` 기준선이 있는 설치본:
  update 가 회수하며 사용자 편집분은 `.claude.backup-*` 로 백업 ⓑ 레거시 로그/로그 부재: 잔존.
  ADR 에 쓰기 전에 위 두 테스트를 실행해 증거로 붙일 것.

### P0-2. `templates/rules/gates-taxonomy.md` 삭제는 `npm run ci` 를 red 로 만든다 — AC8 불성립

- `.dev-references/cherrypicks.lock:162-165` — `"id": "gsd-gates-taxonomy"`,
  `"dst": "templates/rules/gates-taxonomy.md"`.
- `tests/vnv-verdict.test.ts:40-52` — **"lock 의 모든 dst 가 실재한다 (역방향 — 좀비 lock 행 차단)"**.
  모든 `dst` 에 `existsSync` 를 걸고 `dangling` 이 비어야 통과한다. 지금은 green(위 실행 결과).
  파일을 지우고 lock 행을 남기면 **그 자리에서 red**.
- 같은 테스트의 주석이 결과까지 적어 뒀다: *"좀비 행이 남으면 `sync-cherrypicks.sh` 가 지운 자산을
  upstream 에서 되살린다 — 삭제가 되돌려진다."*
- 파급 2곳 더: `docs/REFERENCE.md:102` (lock "20건"), `docs/REFERENCE.md:110`
  (`| Rules (templates/rules/) | gates-taxonomy (← GSD) |`).

**어느 레인도 `.dev-references/cherrypicks.lock` 도 `tests/vnv-verdict.test.ts` 도 소유하지 않는다**
(계획 67~75줄). AC3 은 "COMMON_RULES 에서 제거"까지만 적는다.

- **처리**: AC3 에 ⓐ lock 행 제거 ⓑ REFERENCE §5 행·건수 갱신을 넣고, P3-B 소유에 lock 을 추가.
  직전 사이클이 이미 같은 처리를 했다 — `src/manifest.ts:160-162` 주석
  *"cherrypicks.lock 의 `ecc-verification-loop` 행도 함께 제거 — lock 과 이 목록은 1:1 이어야 한다"*.

### P0-3. AC4 의 예산 상한이 자기 표와 모순된다 (550 vs 595) — 완료 판정 불가

- 계획 31~33줄(AC4): *"**예산: 총 1,100줄 → 550줄 이하**"*
- 계획 60줄(표 합계): *"총 1,100→**≤595**"*

행 합계를 직접 계산했다(현재 줄 수는 `wc -l` 실측과 전부 일치):

| | 현재 | 표의 목표 합 |
|---|---|---|
| dev (`.claude/rules/`) | 585 | 0+45+55+45+40+40+40+20+40 = **325** |
| templates (`templates/rules/`) | 515 | 0+35+40+45+40+30+20+20+40 = **270** |
| 합계 | 1,100 | **595** |

595 ≠ 550. 구현 레인이 595 로 착지하면 표는 만족하고 AC4 는 실패한다 — **어느 쪽이 완료 기준인지
문서가 답하지 못한다.** 한 숫자를 고르고 나머지를 지울 것(그리고 P1-4 의 단위 문제도 함께).

### P0-4. AC3 의 "참조 잔존 0" 을 무는 게이트가 없고, 실제 잔존 참조가 **배포물에** 있다

계획 30줄(AC3): *"전 문서에서 참조 잔존 0 (resident-rule-reference-liveness 등 기존 게이트 green)"*.

- 실제 잔존 참조 — 두 사본 모두:
  - `templates/agents/plan-checker.md:22` — `` `.claude/rules/gates-taxonomy.md` — Gates taxonomy 참조 ``
  - `templates/agents/plan-checker.md:59` — `` (`@.claude/rules/gates-taxonomy.md` 참조) `` ← `@` import 형태
  - `.claude/agents/plan-checker.md:22`, `:59` — 동일
  `templates/agents/` 는 **배포물**이다(`package.json` `files` = `["dist","templates",...]`).
- 계획 67~75줄 레인 표에 `{templates,.claude}/agents/**` 를 소유한 레인이 **없다.**
- AC3 이 지목한 게이트는 이것을 **구조적으로 못 본다**:
  - `tests/resident-rule-reference-liveness.test.ts` — 판정 정규식이 `Rule\s+(\d+)` 다.
    **숫자 원칙 참조 전용**이고 룰 *파일* 참조는 대상이 아니다.
  - `tests/resident-doc-asset-reachability.test.ts:61-62` — 상주 문서 정의가
    `HARNESS_ANCHOR_FILE || /^\.claude\/rules\/[^/]+\.md$/` 라 `agents/` 를 아예 안 읽는다.

즉 "기존 게이트 green" 은 AC3 의 주장을 검증하지 못한다 — **초록불이 무는 대상이 다르다.**

- **처리**: ⓐ 두 `plan-checker.md` 를 레인에 배정하고 참조를 제거/대체 ⓑ AC3 의 판정 수단을
  "기존 게이트 green" 이 아니라 **명시 grep(`gates-taxonomy` 잔존 0, CHANGELOG·docs/archive·
  docs/decisions 는 이력이므로 면제 명시)** 으로 바꿀 것.

---

## P1 — 착수 가능하나 구현 중 반드시 반영해야 한다

### P1-1. `test/docker/scenarios/scenario-project.sh` 가 checkpoint-snapshot 설치를 단언한다 (이미 red)

`test/docker/scenarios/scenario-project.sh:103-108`:

```bash
for h in session-start.sh protect-files.sh mcp-pre-exec.sh spec-drift-check.sh checkpoint-snapshot.sh; do
  if [[ ! -f "${HOOK_DIR}/${h}" ]]; then
    echo "FAIL: 잔존 훅 ${h} 미설치 — HITO 제거가 이웃 훅까지 떨어뜨렸다"
```

- `templates/hooks/` 실측은 4파일(`checkpoint-snapshot`·`mcp-pre-exec`·`protect-files`·`session-start`)
  — **`spec-drift-check.sh` 는 이미 없다**(직전 사이클 `5d0bfdc` 에서 삭제).
  즉 이 시나리오는 **지금 이미 FAIL 한다.**
- AC8 은 `npm run ci` 만 요구하고 docker 시나리오는 CI 밖이라 안 잡힌다.
- 이 사실이 계획 42줄의 *"전례 spec-drift-check 와 동일 처리"* 에 대한 **반증**이기도 하다 —
  그 전례가 남긴 것이 바로 이 죽은 단언이다. 전례를 근거로 쓰지 말고, 이번엔 같은 자리를 고칠 것.
- **처리**: AC1 에 `test/docker/scenarios/scenario-project.sh` 훅 목록 갱신을 포함하고 소유 레인 지정.
  (목록을 열거로 두는 대신 `templates/hooks/*.sh` 에서 derive 하는 편이 재발을 막는다.)

### P1-2. AC5 의 갱신 대상에 `tests/protect-branch-surface.test.ts` 가 빠졌다

`tests/protect-branch-surface.test.ts:59-62` 는 `templates/rules/git-policy.md` 를 읽어
설치 경로 `.uzys-agent-harness/protect-branch.sh` 를 가리키는지 단언한다
(실제 대상 줄 = `templates/rules/git-policy.md:30`). 실패 메시지: *"git-policy 가 설치 경로 …를
안 가리킨다 — 설치는 되는데 아무도 모르는 자산이 된다"*.

계획 72줄 P3-B 소유 테스트 목록에 없고, AC5 의 열거(35~38줄)에도 없다. templates git-policy 예산이
75→40(-47%)이라 이 줄이 잘려 나갈 확률이 높다.

### P1-3. byte-동일 잠금 2건이 계획에 언급되지 않았다

- `tests/doc-governance-baseline-rule.test.ts:93` — `.claude/rules/doc-governance.md` **=** `templates/rules/doc-governance.md`
- `tests/evidence-templates.test.ts` §"repo-local .claude 복사본이 템플릿과 byte-동일" — 목록에 `rules/benchmark-parity.md`

이 두 룰은 dev/templates 가 **바이트 동일**이어야 한다. 예산표는 우연히 좌우 목표가 같아
(doc-governance 45/45, benchmark-parity 40/40) 정합하지만, 제약이 문서에 없어 감량 중 한쪽만
손대면 red 다. AC4 에 "이 두 룰은 양 사본 동시 동일 편집" 을 명시할 것.

### P1-4. 예산 단위(줄)가 이 리포 게이트가 재는 단위(항목·토큰)와 다르다

`wc -c -l` 실측:

| 파일 | 줄 | 자 | 자/줄 |
|---|---|---|---|
| `.claude/rules/ship-checklist.md` | 48 | 5,255 | **109** |
| `.claude/rules/playwright-launch.md` | 24 | 1,379 | 57 |
| `.claude/rules/benchmark-parity.md` | 101 | 6,343 | 63 |

줄 수는 2배 넘게 차이 나는 밀도를 가린다 — ship-checklist 48→40(-17%줄)은 토큰을 거의 안 줄일 수도,
반대로 절 하나를 지우면 줄보다 훨씬 많이 줄 수도 있다. 반면 실제 게이트는 토큰·항목을 잰다
(`tests/context-cost-ratchet.test.ts` `AXES = [items, tokens]`,
`tests/north-star-cost-figures.test.ts` 는 **tolerance 없이** 정확 일치).

**처리**: AC4 에 토큰 목표(또는 최소한 `npm run cost:report` before → after 수치 기재 의무)를 병기.
계획의 "수치는 before → after" 보고 규약과도 그쪽이 맞는다.

### P1-5. P4 는 P3-B **이후에만** 성립하는데 레인 표에 순서가 없다

`tests/context-cost-ratchet.test.ts` 의 두 번째 단언은 **감소도 red 로 만든다**:

```
recorded ≤ axis.cap(actual)        // items: actual+1, tokens: ceil(actual*1.1)
```

룰이 줄면 `actual` 이 내려가 옛 `recorded` 가 상한을 넘는다 →
*"baseline 이 실측 대비 허용치를 넘는다"* red. `north-star-cost-figures` 는 정확 일치라 같은 의존.
둘 다 **P3-B 의 최종 본문**이 확정된 뒤에만 재생성할 수 있는데, 계획 67~75줄 표는 레인 순서를
규정하지 않는다(P3-A/P3-B 를 병렬로 읽히게 써 놨다). AC6 에 "P3-B 완료 후 실행" 을 명시할 것.

### P1-6. AC6 에 `docs/USAGE.md` 가 빠졌다

`docs/USAGE.md:345-349` 훅 표:

```
| `checkpoint-snapshot.sh` | PostToolUse (tool-count threshold) | Checkpoint savepoint + `/compact` nudge (D25) |
```

`docs/USAGE.md` 는 `tests/docs-supply-chain.test.ts:26` 의 `GUIDE_FILES` 에 있지만, 그 게이트가
검사하는 것은 `npx agent-harness` scope 누락 하나뿐(24~45줄)이라 **이 행은 아무도 안 본다.**
AC6 목록(39~40줄)은 CLAUDE.md·NORTH_STAR·REFERENCE 뿐이다.

### P1-7. AC2 의 로그 경로가 **설치 사용자 리포**에서 gitignore 되지 않는다

- 설치 시 `.gitignore` 에 추가되는 패턴은 `.env`(`src/env-files.ts:52,74`)와
  `.factory/`·`.goose/`(`:89,102`) **뿐**이다. `.uzys-agent-harness/` 는 없다.
- 이 리포 `.gitignore` 에도 `.uzys-agent-harness/` 항목이 없다(`cat .gitignore` 확인).
- AC2(28줄)는 *"dev 리포에서 로그 경로가 커밋되지 않도록"* 만 적는다 — 배포 대상 사용자 쪽이 빠졌다.
  배포된 훅은 매 차단마다 사용자 리포에 추적되는 파일을 늘린다.
- 덧: `src/commands/uninstall.ts:299` 는 `.uzys-agent-harness/` 를 **디렉터리째** 지운다 →
  차단 이력이 uninstall 로 소멸한다. ADR-061 Consequences 에 적을 것.

### P1-8. AC2 의 변이 명세가 "로그 실패가 차단을 바꾸면 안 된다" 를 안 덮는다

`templates/hooks/protect-files.sh:4` 는 `set -e` 다. `exit 2` 앞에 `mkdir -p` / append 를 넣으면
그 명령의 실패가 스크립트를 **exit 1** 로 끝내고 — 차단이 통과로 바뀐다(호출자는 exit 2 만 차단으로 읽는다).
AC2 는 요구는 적었지만(26줄) 검증(27~28줄)은 "차단 입력 → 로그 1줄+exit 2 / 통과 입력 → 로그 0줄+exit 0"
두 케이스뿐이다. **쓰기 불가(읽기 전용 디렉터리) 상태에서도 exit 2** 를 세 번째 변이 케이스로 넣을 것.

### P1-9. SPEC.md 정합 — 이 사이클은 SPEC 이 Non-Goal 로 미뤄 둔 사이클이다

- `docs/SPEC.md:1` — `# SPEC: 문서 체계 재정비 (F 사이클)`, `Status: Active`
- `docs/SPEC.md:37` — Non-Goals: *"**룰 33개의 내용 감축** — 판정 기준이 이 사이클 산출물에서 나오므로
  순서상 뒤다(H 사이클, 이슈 #261)."* — 룰은 이제 9종이라 "33개"는 이미 stale.

계획에 SPEC 처리(앵커 교체 또는 Change Log 기재)가 없다. `ship-checklist` 의 "SPEC/PRD 정합성"
항목이 이 지점에 걸린다. 최소한 SPEC 의 그 줄을 어떻게 할지 AC 에 명시할 것.

### P1-10. `templates/**` 에 ADR 번호를 넣는 것은 DO NOT CHANGE + 게이트 위반이다

예산표 git-policy 행(53줄)의 *"Drift 서사→ADR-007 포인터"* 는 "지우는 절(**공통 방향**)" 열에 있어
양 사본에 적용되는 것처럼 읽힌다. 실제로는:

- `docs/SPEC.md` §DO NOT CHANGE — *"배포물(`templates/**`)에 이 리포의 태그·ADR 번호·홈 경로 유입"*
- `tests/templates-distribution-hygiene.test.ts` §"이 리포/사용자 고유 좌표를 남기지 않는다" —
  스캔 정규식에 `\bADR-\d{3}\b` 포함, 검사 범위는 `package.json` `files`(= `templates` 포함)에서 derive.
- 그리고 애초에 **templates 사본에는 그 절이 없다**. `grep '^#'` 실측:
  - `templates/rules/git-policy.md` = Commit / Branch / PR / Safety / Session Cleanup /
    "gate ✓ ≠ main 반영" / Post-Merge Cleanup / 보고 형식 (8절, Versioning·Drift **없음**)
  - `.claude/rules/git-policy.md` = 위 + Versioning Convention / Pre-tag checklist / Drift Period

즉 templates 의 75→40(-35줄)은 표가 지목한 절에서 나올 수 없고, 남은 절은 P1-2 의
`protect-branch-surface` 와 `session-cleanup-gate`(아래)가 문다. **"지우는 절" 열을 사본별로
갈라 적을 것** — 지금 형태로는 구현 레인이 templates 에 ADR 번호를 써 넣게 유도한다.

참고: `tests/session-cleanup-gate.test.ts:127-166` 이 무는 앵커(templates 사본 기준) —
`cli-development.md`: `realpath -m` · `find -newermt` · `빈 결과는 부재의 증거가 아니다` ·
``파이프 뒤 `$?``` · `stderr 를 버리지 마라`;
`git-policy.md` §Session Cleanup: `백그라운드` · `서브에이전트` · `ppid=1` ·
`다른 프로젝트의 프로세스는 건드리지 않는다`.
이들은 예산표가 "압축" 대상으로 지목한 바로 그 절에 있다. AC5 가 갱신을 허용하지만
**앵커를 새 본문에 맞춰 옮기는 것**과 **검사를 잃는 것**의 경계를 P3-B 가 매 건 판정해야 한다.

### P1-11. P3-B 의 소유 목록을 **열거**로 둔 것이 이번 사고의 서식지다

`grep -rl "rules/" tests/` = 15개. 계획이 덮는 것은 P3-B 6개 + P3-A 3개 = 9개.
남은 6개(`antigravity/transform`·`opencode/opencode-json`·`policy-file-ownership`·
`render-hint-parity`·`state`·`update-mode`)는 **열어서 확인한 결과 전부 tmp fixture 또는
글롭**이라 이번 변경에는 무해하다.

문제는 반대쪽이다 — 이 리뷰가 찾은 위험 4건은 **`"rules/"` 문자열이 없어서 그 grep 에 안 잡힌다**:

| 테스트 | 어떻게 룰/배포물을 읽나 | 이 사이클과의 관계 |
|---|---|---|
| `tests/vnv-verdict.test.ts` | lock 의 `dst` 로 `existsSync` | **P0-2** (red 확정) |
| `tests/protect-branch-surface.test.ts` | `join(ROOT,"templates","rules","git-policy.md")` | **P1-2** |
| `tests/templates-distribution-hygiene.test.ts` | `package.json` `files` derive 글롭 | **P1-10** |
| `tests/context-cost-ratchet.test.ts` | `buildManifest` → `residentCost` | **P1-5** |

`test-policy.md` 가 이미 경고한 형태 그대로다(*"영향 범위를 도구나 grep 으로 도출하지 마라 —
두 번 틀렸다"*). P3-B 의 소유 목록을 파일 열거가 아니라 **"룰 파일 또는 배포물을 경로로 읽는
게이트 전체"** 라는 술어로 다시 쓰고, 감량 후에는 애매하면 전체를 돌릴 것.

---

## 확인했으나 지적 아님 (팀리드가 명시 질의한 축 — 헛수고 방지용)

- **4-CLI 변환·AGENTS.md 임베드**: 룰 본문은 임베드되지 않는다.
  `src/codex/agents-md.ts:33-41` 의 `{PROJECT_RULES}` 에 들어가는 것은 **`templates/CLAUDE.md` 전문**이고,
  antigravity 는 같은 렌더러를 재사용한다(`src/antigravity/transform.ts:110`).
  OpenCode 는 글롭 참조뿐(`opencode.json` `instructions: [".claude/rules/*.md"]`,
  `tests/opencode/opencode-json.test.ts:6`). → 룰 감량·gates-taxonomy 삭제가 4-CLI 산출물에
  직접 영향을 주지 않는다. **계획의 누락이 아니다.**
- **`templates/CLAUDE.md`**: 룰·훅 개수 표기 0건(grep `룰|rules|훅|hook|9종|8종|gates-taxonomy`).
  AC6 의 "CLAUDE.md" 는 루트 사본을 뜻하는 것으로 읽으면 맞고, `templates/CLAUDE.md` 는 손댈 것이 없다.
- **훅 미배선 단언**: 재확인 완료. `templates/settings.json` = `"PostToolUse": []`,
  `ALWAYS_HOOKS`(`src/manifest.ts:133-138`)에는 `checkpoint-snapshot.sh` 가 있다 → AC1 의 parity
  테스트는 **현재 상태에서 born-red 가 맞다**. `.claude/settings.json` 도 `"PostToolUse": []` 라
  dev 사본 삭제에 죽은 참조가 생기지 않는다.
- **`session-start.sh` compact-warning 분기 제거**: 다른 참조 없음.
  `compact-warning.flag` 생산자는 `checkpoint-snapshot.sh:21` 하나뿐이고(양 사본),
  `.gitignore` 의 `.claude/compact-warning.flag` 줄만 죽은 항목으로 남는다(P3-A 가 `.gitignore` 소유).
  `tests/hook-context-schema.test.ts` 는 stdout 스키마만 보므로 영향 없음.

## 미확인

- 훅 차단 로그가 실제로 0줄이라는 실측(계획 16줄) — 본 리뷰에서 재현하지 않았다.
- `test/docker/run.sh` 시나리오를 실제 실행하지 않았다(호스트 실 CLI 실행은 훅이 차단).
  P1-1 의 "이미 FAIL" 은 스크립트 본문 + `templates/hooks/` 파일 목록에서의 정적 판정이다.

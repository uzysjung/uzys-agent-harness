# Fresh-Dogfood HITO 측정 프로토콜 (P2-01)

> **목적**: NSM(HITO ≤ 3 prompts/feature)을 **올바른 단위**로 첫 측정.
> 기존 baseline(≈20/feature, `hito-baseline-2026-04-30.md`)은 *하네스 자체를 만든* 측정 = 단위 불일치.
> P2-01 = *하네스로 **자기 서비스**를 만드는 사용자* 단위. **자기 fresh-dogfood 프록시**(메인테이너가 사용자 역할, N=1 인정 — 외부 표본은 Phase 3).

## 정직성 원칙 (왜 이 프로토콜인가)

- HITO 숫자는 **실제 인터랙티브 빌드 세션에서만** 나온다. 시뮬레이션/추정 금지(안티패턴).
- 측정은 **별도 fresh `claude` 세션**에서 — 하네스-maintenance 세션 컨텍스트 오염 차단.
- clean-env = **host throwaway 디렉토리 + project-scope**. project-scope 라 host 글로벌(`~/.claude` 자산)은 미오염. (단 `claude` CLI 자체가 `~/.claude/plugins/cache/` 에 native write 하는 것은 설계상 예외 — `installed_plugins.json` 의 `projectPath` 로 격리.)

## 측정 대상 — throwaway 서비스 SPEC (`mini-wc` CLI)

작고 명확한 **단일 feature** — 하네스의 6-gate + 컨텍스트 엔지니어링 오버헤드를 문제 난이도와 분리해 측정.

**서비스**: `mini-wc` — 파일/stdin 의 줄·단어·바이트 수를 세는 미니 `wc`.

**Acceptance Criteria (단일 feature)**:
1. `mini-wc <file>` → `<lines> <words> <bytes> <file>` 출력 (Unix `wc` 포맷).
2. stdin 파이프 지원: `echo "a b" | mini-wc` → `1 2 4`.
3. `--lines` / `--words` / `--bytes` 플래그로 단일 카운트만 출력.
4. 파일 부재 시 stderr 에러 + exit 1.
5. 순수 함수(`countStats(text)`) 단위 테스트 + CLI 통합 테스트.

> 의도적으로 작음 — "잘 정의된 feature 1건을 하네스로 ship 하는 데 사용자 prompt 몇 회?" 만 격리 측정. 첫 baseline 목적.

## 절차

### 1. clean-env 셋업 (이 repo 에서, 1회)

```bash
bash scripts/fresh-dogfood-setup.sh        # /tmp/uzys-dogfood-<date> 생성 + project-scope 설치 안내 출력
```

또는 수동:

```bash
DIR=$(mktemp -d -t uzys-dogfood)
cd "$DIR" && git init -q
npx -y @uzysjung/agent-harness install --track tooling --cli claude --with uzys-harness --scope project
# → .claude/{commands/uzys,hooks,settings.json(hito-counter wire)}, CLAUDE.md 등 project-scope 설치
```

### 2. 측정 RUN (별도 fresh `claude` 세션 — 사용자 주도)

```bash
cd "$DIR"
claude
# 세션 안에서 6-gate 로 mini-wc 완주:
#   /uzys:spec  → /uzys:plan → /uzys:build → /uzys:test → /uzys:review → /uzys:ship
# 각 사용자 prompt submit 은 .claude/evals/hito-<date>.log 에 자동 1줄 기록됨.
```

**규칙 (측정 무결성)**:
- 한 feature(`mini-wc` 전체 ACs) 완주까지 모든 사용자 prompt 카운트.
- 리롤/오타정정/clarify 도 HITO 1 로 카운트(= human-in-the-loop 발생). 정직하게.
- 하네스가 막히면 그것이 곧 측정값 — 우회 보정 금지.

### 3. 집계 + 기록

```bash
bash <this-repo>/scripts/hito-aggregate.sh --dir "$DIR/.claude/evals" --summary
```

- 결과(총 prompt = HITO/feature, feature=1)를 `docs/evals/fresh-dogfood-<date>.md` 에 기록.
- 템플릿: 날짜 / 서비스 / 총 HITO / 목표(≤3) Pass·Fail / 막힌 지점(top HITO 소비 단계) / 개선 후보(instinct·skill 추출, SPEC 분해 단위).

## 측정값 해석

| HITO/feature | 판정 |
|---|---|
| ≤ 3 | NSM 목표 충족 — 하네스가 사용자 단위에서 작동 |
| 4–10 | 개선 여지 — 막힌 gate/반복 패턴 분석 |
| > 10 | baseline(20) 수준 — 단위 전환해도 미개선, 하네스 워크플로우 재검토 |

## 한계 (정직 표기)

1. **N=1 (메인테이너=사용자 프록시)** — 외부 사용자 분포와 다를 수 있음. Phase 3 외부 표본 신호로 이월.
2. **단일 throwaway feature** — 실제 사용자 작업의 복잡도 분포 미반영. 첫 baseline 의 의도된 단순화.
3. **메인테이너 숙련도 편향** — 하네스를 만든 사람이 써서 HITO 가 실사용자보다 낮을 수 있음(낙관 편향). 보고 시 명시.

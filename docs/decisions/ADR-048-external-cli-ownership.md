# ADR-048: 소유자 판정을 외부 CLI 산출물까지 확장한다

- Status: Accepted
- Date: 2026-07-20
- PR: (이 PR)
- Extends: ADR-047 (정책 파일 소유자 판정) · ADR-046 (하네스/사용자 파일 경계)

## Context

ADR-046(스킬) → ADR-047(`.claude/` 정책 파일)로 "사용자가 쓴 것은 잃지 않는다"를 두 번 결정했다.
그런데 **두 번 다 구현이 그때 눈앞에 있던 자산 종류에만 걸렸다.** ADR-047 은 `.codex/` ·
`.opencode/` · `.agents/` 를 범위 밖이라고 적지도 않아서, 읽으면 전면 적용된 것처럼 보인다.

R-3j("`update` 가 외부 CLI 를 갱신하지 않는다")를 조사하다 드러났다. 실측 — transform 을 2회
실행하고 사이에 사용자 편집을 넣었다 (탐지기 자기검증 포함, 2026-07-20):

| 산출물 | 편집분 생존 | 백업 |
|--------|-------------|------|
| `.codex/hooks/session-start.sh` | ✗ | 없음 |
| `.codex/config.toml` | ✗ | 없음 |
| `.agents/skills/<id>/SKILL.md` | ✗ | 없음 |
| `.agents/rules/uzys-harness.md` | ✗ | 없음 |
| `opencode.json` | ✗ | 없음 |
| `.opencode/commands/<id>.md` | ✗ | 없음 |

`AGENTS.md` 만 `backupFileIfChanged`(내용 비교)로 보호받았는데, 그건 ADR-047 이 이미 기각한
방식이다 — 하네스가 템플릿을 고친 릴리즈마다 **전 사용자에게** 백업이 쌓인다.

## Decision

**하네스가 렌더해서 내보내는 모든 산출물에 소유자 판정을 적용한다.** 판정식은 ADR-046/047 과
동일하다(자산 종류가 달라야 할 이유가 없다는 것이 애초의 교훈이다):

| 디스크 vs 기준선 | 처리 |
|---|---|
| 내용 동일 | 아무것도 안 한다 |
| 기준선과 같다 | 조용히 덮어쓴다 |
| 기준선과 다르다 | `.backup-<stamp>` 남기고 최신판을 자리에 |
| 기록 없음 + 내용 다름 | 판정 불가 → 보수적으로 백업 |

**기준선은 쓰는 쪽이 만든다.** `.claude/` 는 templates 를 **복사**하므로 사후에 디스크를 훑어
기준선을 만들 수 있지만(`collectPolicyHashes`), 외부 CLI 산출물은 템플릿을 **렌더**한 결과라
디스크를 훑어도 무엇이 하네스 것인지 알 수 없다. 대신 transform 은 방금 쓴 내용을 알고 있으므로
그 자리에서 기준선을 만든다 — 그래서 여기엔 `POLICY_DIRS` 같은 **경로 열거 사본이 생기지 않는다**.

**판정식은 `isHarnessOwned` 하나만 둔다** (`install-log.ts`). install · update · 외부 CLI 세
곳에서 각자 살면 한 곳만 고쳐졌을 때 조용히 갈리고, 이 술어는 사용자 파일 삭제 여부를 가른다.

**기준선은 transform 사이로 이어준다.** codex 와 opencode 는 같은 `AGENTS.md` 를, codex 와
antigravity 는 같은 `.agents/skills/<id>/SKILL.md` 를 쓴다. 안 이으면 뒤 단계가 앞 단계의
산출물을 사용자 편집으로 오판해 **설치할 때마다** 백업이 생긴다.

## 적용 범위 (명시)

ADR-046/047 이 범위를 안 적어서 같은 실수가 두 번 났으므로 여기서는 적는다.

- **적용**: codex · opencode · antigravity transform 이 쓰는 전부. 기준선 = install log
  `externalFiles`(projectDir 상대경로).
- **미적용**: `update` 명령은 여전히 `.claude/` 만 갱신한다 (R-3j 의 A 파트, 별건). 즉 외부 CLI
  산출물은 **install/재설치 경로에서만** 갱신되고, 그 경로에서 보호받는다.
  → **해소됨 (v26.134.0 · ADR-049)**: `update` 도 외부 CLI 산출물을 갱신한다.
- **정정 (v26.134.0)**: 아래 "판정식은 `isHarnessOwned` 하나만 둔다"는 작성 시점에 **사실이
  아니었다** — `update-mode.ts` 에 같은 식의 사본이 남아 있었다. ADR-049 에서 제거해 이제 참이다.
  결정을 적을 때 구현을 확인하지 않으면 ADR 이 다음 세션에 거짓말을 한다는 사례가 하나 더 늘었다.
- **prune 없음**: 외부 CLI 쪽은 삭제 경로 자체가 없다. `externalFiles` 는 덮어쓰기 판정에만
  쓰고 삭제 근거로는 쓰지 않는다 (`policyFiles` 와 다른 점).

## Alternatives

- **내용 비교(`backupFileIfChanged`) 유지** — 기각. 릴리즈마다 전 사용자에게 백업이 쌓인다
  (ADR-047 이 같은 이유로 기각한 방식이고, `AGENTS.md` 가 실제로 그 상태였다).
- **transform 이 아니라 사후에 디스크를 훑어 기준선 생성** — 불가. 렌더 결과라 훑어서는 하네스
  것과 사용자 것을 구분할 수 없다.
- **writer 안에서도 실행 내 누적** — 제거. installer 와 writer 양쪽에 누적이 생겨 한쪽이 죽은
  코드가 됐고, 음성 대조에서 드러났다(변이해도 아무 테스트가 안 죽음). 누적은 한 곳(installer).

## Consequences

- 재설치가 사용자가 고친 codex/opencode/antigravity 산출물을 잃지 않는다. 최신판이 활성,
  편집분이 백업 (ADR-046 사용자 결정 승계).
- **v26.132.x 이하로 깔린 설치는 첫 재설치에서 변경된 외부 산출물이 백업된다.** 1회성이며 그
  설치가 기준선을 채운다. 내용이 같으면 백업하지 않으므로 전수 복제는 아니다.
- install log 스키마에 `externalFiles` 가 추가된다. **부재는 정상**(v26.132.x 이하 로그).
- transform params 의 `baseline` 은 **required** 다 — 옵셔널이면 호출부 하나가 안 넘겨도
  컴파일이 통과하고 그 경로만 조용히 판정 불가로 떨어진다.
- `update` 의 외부 CLI 미갱신은 **그대로 남는다**. 이 ADR 은 그 결함을 고치지 않는다.

## 검증

- `tests/external-cli-ownership.test.ts` — 13 케이스. transform 계약과 **installer 배선을
  따로** 검증한다 (단위가 초록인데 배선이 끊긴 회귀가 이 계열의 반복 형태였다).
- `test/docker/scenarios/scenario-external-preserve.sh` — 실 CLI 재설치 3회(무편집 → 편집 →
  재설치)로 백업 미축적과 편집분 보존을 확인.
- 음성 대조 6종, 전부 **타입체크 통과를 확인한 뒤** 측정. Docker 시나리오도 별도 변이로 대조 —
  되돌리면 보고된 증상("사용자 내용이 사라졌다")을 그대로 재현했다.

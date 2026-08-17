# ADR-073: ECC 명령 폴백 8종을 기본 설치에서 뺀다

- Status: Accepted
- Date: 2026-08-16
- PR: #308
- Supersedes: ADR-019 의 `commands/ecc` opt-out 부분 (나머지 C2/C3 판정은 유효)

## Context

사용자 질문에서 출발했다 — *"`commands/ecc` 는 왜 남긴 것인지 검토해서 알려줘. 따로 설치가
가능한데 왜 디폴트 템플릿이지?"*

`manifest.ts` 가 `applies: (s) => !s.withEcc` 로 배선하고 있었다. **ECC 플러그인을 고르지
않으면** `/ecc:*` 명령 8종이 깔린다. ADR-019(v26.58.0)의 의도는 "플러그인 없는 사람도 같은
명령을 쓰게" 하는 폴백이었다.

실측해 보니 **그 폴백이 자립하지 못한다.**

| 명령 | 상태 |
|---|---|
| `eval` · `e2e` | frontmatter 가 `agent: everything-claude-code:build` — **없다고 가정한 플러그인의 에이전트**를 부른다 |
| `evolve` · `instinct-status` · `promote` | `.claude/skills/continuous-learning-v2/scripts/instinct-cli.py` 호출 — **별도 opt-in 스킬**이라 대개 없다 |
| `checkpoint` · `harness-audit` · `security-scan` | 자립 (3/8) |

**8개 중 5개가 안 고른 자산을 가리킨다.** ECC 를 고르지 *않았다는 이유로* 깔리는데, 그 5개는
ECC(또는 CL-v2)가 있어야 돈다. 폴백의 전제와 폴백의 요구가 서로 모순이다.

> **정정 (2026-08-18, #338 문서 정합 리뷰)** — **깨진 것은 5개가 아니라 2개다.** `evolve` ·
> `instinct-status` · `promote` 가 부르는 `continuous-learning-v2` 는 "별도 opt-in 스킬"이 아니라
> `COMMON_SKILL_DIRS_ECC` 항목이고, `applies: (s) => !s.withEcc` 로 **그 명령들과 똑같은 조건에서
> 함께 깔린다**(`src/manifest.ts`. ADR-019 도 그것을 C3 로 분류한다). 즉 폴백 상황에서 그 셋은
> 실제로 돌았다. 자립하지 못한 것은 플러그인 에이전트를 직접 부르는 `e2e` · `eval` 둘뿐이다
> (삭제 직전 `a0d9f7f^` 의 8개 파일 전수 확인).
>
> **아래 Decision·Alternatives 의 숫자도 같은 오산이었고 이 정정에서 함께 고쳤다** — Context 만
> 고치면 독자가 링크를 따라가 반증을 만난다. **결정 자체는 유지된다**: 폴백을 기본값에 둘 이유가
> 없다는 근거는 "깨져서"가 아니라 **플러그인이 여섯을 모두 제공해서**다.

## Decision

**`templates/commands/ecc/` 8종을 삭제하고 manifest 배선을 제거한다.** ECC 명령이 필요하면
`--with ecc-plugin` 으로 플러그인을 설치한다 — 그쪽이 여덟 중 여섯을 같은 이름으로 제공하고,
남은 둘(`e2e`·`eval`)이 부르는 에이전트도 그쪽에 있다.
`templates/commands/` 에는 다른 하위 디렉터리가 없었으므로 명령 카테고리 전체가 배포물에서 빠진다.

**`ecc-prune` 은 남긴다** (사용자 확정 2026-08-16). 방향이 반대다 — 저쪽은 ECC 를 **고른**
사람의 설치를 최적화하는 opt-in 이고, 이 ADR 이 빼는 것은 **안 고른** 사람에게 딸려 오던 것이다.
`withPrune` 플래그·`scripts/prune-ecc.sh`·게시 목록 등재는 전부 그대로다.

## Alternatives

- **깨진 2개만 빼고 6개는 남긴다** — 기각. 남는 6개는 플러그인이 같은 이름으로 제공하므로
  플러그인을 나중에 깔면 어느 쪽이 도는지 모호해진다. 그리고 "ECC 를 안 골랐는데 ECC 네임스페이스
  명령이 있다"는 혼란은 6개여도 그대로다.
- **opt-in 자산으로 강등해 남긴다** — 기각. 2/8 은 깨진 참조라 **알면서 깨진 것을 출하**하게 되고,
  나머지 6/8 은 플러그인과 중복이라 어느 쪽이든 남길 이유가 없다.
- **깨진 참조를 고쳐서 진짜 자립형으로 만든다** — 기각. 플러그인이 이미 제공하는 것을 우리가
  다시 구현하는 것이고, 목적 기준(루트 `CLAUDE.md` §판정은 목적에서 시작한다)의 첫 질문에 답하지
  못한다 — 사용자가 ECC 를 원하면 ECC 를 깔면 된다.

## 적용 범위

배포판(`templates/commands/`)과 그 배선(`manifest.ts` · `fs-ops.ts` 스켈레톤 · `install-render.ts`
라벨 · `.dev-references/cherrypicks.lock` 3행). `docs/USAGE.md` 의 `/ecc:*` 표는 **고치지 않았다** —
그 표는 원래부터 "ECC plugin opt-in / Activate via `--with ecc-plugin`" 기준으로 쓰여 있어, 이
변경으로 오히려 정확해진다.

**범위 밖**: `ecc-prune` 및 `withPrune` 계열 전부. ECC 플러그인 자산 자체.

## Consequences

- **배포물에 슬래시 명령이 하나도 없다.** `install-render` 의 commands 행은 뜨지 않는다. 분류기는
  `.claude/commands/` 접두로 일반화돼 있어 명령이 다시 생기면 그대로 동작하고, 라벨에서 ECC
  이름을 뺐으므로 그때 화면이 없어진 자산을 부르지 않는다.
- **기존 설치본의 `.claude/commands/ecc/` 는 남는다.** `commands/uzys` 만 `POLICY_DIRS` 에 있어
  prune 사정거리 밖이다. 사용자가 직접 지운다 — `uninstall` 은 설치 로그 기준으로 회수한다.
- **선재 결함을 하나 발견했고 고치지 않았다**: `commands/uzys` 는 `POLICY_DIRS` 항목이자 스켈레톤
  디렉터리인데 **`templates/` 에 원본 파일이 0개**다. 즉 모든 설치본이 빈 디렉터리를 하나 받고
  그 동기화는 무동작이다. 이 ADR 의 변경이 만든 것이 아니라 그 전부터 그랬으므로 별도로 판정한다.
- **미검증**: 실환경 Docker 시나리오는 돌리지 않았다 — 이 변경은 "파일이 안 깔린다"는 부재 단언이고
  `tests/manifest.test.ts` 가 두 조합(`withEcc` on/off)에서 그것을 문다. 부재 단언이 조용히 죽는
  것을 막기 위해 같은 조회 방식으로 실재 엔트리를 찾는 자기검증 테스트를 함께 넣었다.

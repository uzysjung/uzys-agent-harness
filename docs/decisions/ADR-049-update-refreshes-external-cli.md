# ADR-049: `update` 가 외부 CLI 산출물도 갱신한다

- Status: Accepted
- Date: 2026-07-20
- PR: (이 PR)
- Extends: ADR-048 (외부 CLI 소유자 판정) · ADR-047 · ADR-046

## Context

`update` 는 `.claude/` 만 갱신했다. codex/opencode/antigravity 사용자는 하네스가 개선한
프롬프트·훅·config 를 **`update` 로는 영영 받지 못했고**, 받으려면 재설치해야 했다.
4-CLI 를 표방하면서 갱신은 1-CLI 인 비대칭이다 (`feedback_surface_symmetry`).

ADR-048 이 선행조건이었다. 소유자 판정 없이 update 에 외부 CLI 를 붙였다면, 지금까지 **재설치할
때만** 밀리던 사용자 편집분이 **릴리즈마다** 밀리게 된다 — 고치려던 것보다 나쁜 상태다.

## Decision

**`update` 는 이미 있는 외부 CLI 산출물을 최신판으로 갱신하고, 없던 것은 만들지 않는다.**

핵심은 **"어느 CLI 가 설치돼 있나"를 판정하지 않기로 한 것**이다. 판정하려면 install log 의
`spec.cli`(표시용 필드라 마지막 설치만 반영) 나 디스크 마커 목록이 필요하고, 어느 쪽이든
**CLI 목록의 두 번째 사본**이 된다 — 이 repo 가 반복해서 당한 실패 모드다
(`no-false-ship` §게이트는 열거하지 말고 훑어라).

대신 writer 에 `refreshOnly` 를 넣었다: **디스크에 이미 있는 파일만 쓴다.**

| 상황 | 처리 |
|---|---|
| 파일 있음 | ADR-048 의 소유자 판정 그대로 (동일/기준선일치 → 조용히 · 편집분 → 백업 후 최신판) |
| 파일 없음 | **아무것도 안 한다** — 기준선에도 넣지 않는다 |

그러면 안 깐 CLI 는 대상 파일이 하나도 없어 자연히 제외되고, 안 고른 스킬도 마찬가지다.
`update` 는 `CLI_BASES` 전부와 전체 스킬 목록을 그냥 넘긴다. 이것은 `.claude/` 쪽 `updateDir`
이 "target 에 이미 있는 파일만"으로 오래 지켜 온 규율(Track 혼입 방지)과 **같은 규칙**이다.

**install 과 update 는 같은 함수를 쓴다.** `runCliTransforms` 를 `installer.ts` 에서
`src/cli-transforms.ts` 로 옮겼다. 각자 transform 을 부르면 기준선을 잇는 규칙이 두 벌이 되고,
그건 ADR-046→047→048 을 세 번 반복하게 만든 바로 그 구조다. 겸사로 `update-mode.ts` →
`installer.ts` 순환 import 도 생기지 않는다.

## 적용 범위 (명시)

- **적용**: `update` (위저드 · 비대화형 `agent-harness update` 양쪽 — 같은 `runUpdateMode` 를 탄다).
  대상은 codex · opencode · antigravity transform 이 쓰는 전부. 기준선은 install log
  `externalFiles`, 실행 후 `mergeExternalFiles` 로 재기록한다.
- **미적용 — 새 산출물은 안 깔린다.** 하네스가 새 훅·새 스킬을 추가한 릴리즈에서 `update` 는
  그것을 **가져오지 않는다**(파일이 없으므로). 받으려면 재설치해야 한다. `.claude/skills/` 쪽
  `syncSkills` 는 이미 설치된 스킬 디렉터리 **안**의 새 파일은 가져오므로 그쪽과 다르다 —
  의도한 차이다: 안 고른 것을 깔 위험이 안 받은 개선보다 크다고 봤다. 불편이 실제로 보고되면
  "부모 단위가 이미 있으면 안의 새 파일은 가져온다"로 좁혀 넓힐 수 있다.
- **prune 없음**: ADR-048 그대로. 외부 CLI 쪽은 삭제 경로가 없다.
- **`~/.codex/` 등 글로벌 미터치**: update 는 `codexTrust` 를 넘기지 않는다.

## Alternatives

- **install log `spec.cli` 로 대상 CLI 판정** — 기각. `buildInstallLog` 주석대로 `spec` 은
  누적되지 않는 표시용 필드다. codex 로 깔고 나중에 claude 만 추가 설치하면 `spec.cli` 가
  `["claude"]` 가 되어 **디스크에 있는 `.codex/` 를 영영 안 보게 된다**.
- **디스크 마커(`.codex/` 존재 등)로 판정** — 기각. 판정표가 곧 CLI 목록의 사본이고, CLI 가
  늘 때 고쳐야 할 곳이 하나 더 생긴다. `refreshOnly` 는 같은 일을 목록 없이 한다.
- **`update` 가 새 산출물도 설치** — 기각. 안 고른 CLI 설정이 `update` 한 번에 딸려 들어온다.

## Consequences

- codex/opencode/antigravity 사용자가 `update` 로 개선분을 받는다. 사용자 편집분은 백업으로
  보존되고 최신판이 자리를 차지한다 (ADR-046 승계).
- `runUpdateMode` 시그니처에 `harnessRoot` 가 **required** 로 추가된다 — 옵셔널이면 안 넘긴
  호출부만 조용히 외부 갱신을 건너뛰고, 그게 지금 고치는 바로 그 버그다.
- `OwnedWriter.write` 가 `boolean` 을 반환한다 (건너뛴 경로에 `chmod` 가 걸려 ENOENT 로 터지는 것 방지).
- update 화면에 `external CLI artifacts` / `edited external CLI files` 행이 추가된다.
  갱신하고도 안 알리는 침묵이 애초 R-3a 를 만든 실패다.
- **templates 가 없으면 update 가 실패한다** (transform 이 required 소스를 읽는다). 조용히
  건너뛰지 않는 쪽을 택했다 — 침묵하면 "외부 CLI 가 갱신 안 되는" 상태로 되돌아간다.

## 검증

- `tests/external-cli-update.test.ts` — 10 케이스. ⓐ 갱신되는가 ⓑ 안 깐 것이 안 깔리는가
  ⓒ 기준선이 왕복하는가를 **따로** 본다.
- `test/docker/scenarios/scenario-update-external.sh` — 실 CLI 비대화형 `update`.
  재설치 경로(`scenario-external-preserve`)와 **다른 코드를 타므로 별도 시나리오**다.
- 음성 대조 6종, 전부 타입체크 통과를 확인한 뒤 측정 (refreshOnly 무시 · 외부 CLI 대상 제외 ·
  기준선 재기록 생략 · 기준선 병합 제거 · 소유 판정 항상 통과 · 디스크 부재 필터 제거).
  Docker 시나리오도 별도 변이로 대조 — 되돌리니 "갱신되지 않았다"로 정확히 실패했다.
- **음성 대조가 테스트 하나를 반증했다**: "안 건드린 산출물의 기준선 유지"를 설치본 전체 비교로
  썼더니 병합을 제거해도 통과했다(update 는 디스크에 있는 걸 전부 다시 쓰므로 목록이 같다).
  판별하는 형태로 다시 썼다 — 통과하는 테스트는 "기능이 된다"와 "이 테스트가 아무것도 안 본다"를
  구분하지 못한다.

## 부수 발견 (이 릴리즈에서 고치지 않음)

같은 초에 `update` 를 두 번 돌리면 `.claude.backup-<stamp>` 이름이 충돌하고,
`.claude/skills/<id>` 가 외부 설치기가 만든 심볼릭 링크일 때 `cpSync` 가 EINVAL 로 죽는다.
**v26.133.0 게시본에서도 동일 재현**(HEAD worktree 로 이미지를 따로 빌드해 대조) — 이번 변경이
만든 문제가 아니다. 추적: `docs/todo.md` R-3m. 시나리오는 `sleep 2` 로 우회 중이고, 우회는
수정이 아니라는 사실을 그 자리에 적어 두었다.

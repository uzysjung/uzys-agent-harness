# ADR-095: `AGENTS.md` 의 소유 경계 — 설치자 절은 보존, 하네스 조각은 마커로 갱신

- Status: Accepted
- Date: 2026-09-21
- PR: #TBD-503
- Related: ADR-048(외부 CLI 산출물의 소유자 판정 백업) · ADR-085(상시 스킬 안내를 프로젝트 맥락 블록에)
- Context: Codex/OpenCode 설치본의 루트 `AGENTS.md` 는 매 렌더마다 통째로 다시 써졌다. 설치자가
  `## Project Context` 에 채운 맥락은 `update` 때마다 빈 스캐폴드로 돌아가고 백업(`AGENTS.md.backup-<시각>`)
  에서 손으로 옮겨야 했다(#503). 루트 `CLAUDE.md` 는 import 마커 블록만 갱신하고 본문을 남기는 모델
  (`project-claude-merge.ts`)이라 두 표면이 비대칭이었다.
- Decision:
  1. `AGENTS.md` 의 **설치자 소유 절** = `## Project Context` · `## Project Rules`. 렌더는 이 두 절의 본문을
     디스크에서 이어받는다(`src/agents-md-merge.ts`). 나머지 절(제목 · `## Harness Rules` · `## Session Start` ·
     `## Protected Files`)은 하네스 소유라 매번 최신판.
  2. 설치자 절 **안**의 하네스 조각은 마커로 감싸 그 조각만 갈아 끼운다 — `<!-- uzys-harness:skills:start/end -->`
     (ADR-085 상시 스킬 안내) · `<!-- uzys-harness:anchor:start/end -->` (`templates/CLAUDE.md` 작업 원칙 본문,
     `## Project Rules` 안). 마커 사이에 적은 설치자 텍스트는 갱신 때 사라진다 — 문서가 그렇게 안내한다.
  3. 절 경계는 "다음 `## `" 이 아니라 **템플릿이 정의한 최상위 절 이름**으로 판정한다 — 스캐폴드·앵커·룰 본문이
     `## ` 를 갖고 있어 그 방식이면 첫 하위 헤딩에서 잘린다.
  4. 마커 없는 옛 설치본(v26.159.0 이하)의 첫 `update`: `## Project Context` 는 옛 안내 조각(헤딩~항목)만
     걷어내고 앞뒤 설치자 텍스트를 보존한다. `## Project Rules` 는 통째로 렌더된 앵커 본문이라 설치자 줄을 가릴
     근거가 없어 **최신판으로 간다**(편집분은 백업). 두 번째 update 부터는 마커가 있어 두 절 다 보존.
  5. 절 제목을 지우거나 바꾼 파일은 그 절만 스캐폴드로(다른 절은 보존), 백업 1건. 설치자가 만든 최상위 절은
     이전과 같이 렌더 골격 밖이라 백업으로 간다(변경 없음).
  6. Antigravity 룰 파일(`.agents/rules/uzys-harness.md`)은 통째로 하네스 소유라 병합하지 않고 마커도 넣지 않는다.
- Alternatives:
  - `AGENTS.md` 전체를 마커 블록 + 자유 본문으로 재구성(루트 `CLAUDE.md` 와 동일 모델) — 기각. Codex 는
    `AGENTS.md` 계층만 읽어 룰이 본문에 있어야 하고(ADR-071), 절 구조가 곧 설치자에게 보이는 문서라 골격을
    바꾸면 기존 설치본 전부가 첫 update 에서 재배치된다.
  - 옛 설치본의 `## Project Rules` 편집분을 이전 릴리즈 앵커 본문과 diff 로 가려낸다 — 기각. 이전 판 앵커를
    설치본이 갖고 있지 않다. 한 번의 백업이 더 싸다.
  - 마커 대신 헤딩만으로 조각 판정 — 기각. 설치자가 같은 헤딩을 쓰면 구분 불가(리뷰 ⓓ).
- Consequences:
  - 설치자: `update` 뒤 Project Context 가 남는다. 첫 update 한 번은 Project Rules 편집분이 백업으로(문서 명시).
  - `uninstall` 은 이제 설치자 문장이 든 `AGENTS.md` 를 기준선 일치로 보고 통째로 지운다 — 루트 `CLAUDE.md`
    처럼 하네스 절만 걷어내야 한다 → 이슈 #516.
  - codex 단독 설치본에 update 가 OpenCode transform 까지 돌려 판이 바뀌는 문제는 이 결정 이전부터 있던
    별건 → 이슈 #514.
  - 상주 비용 계측(`context-cost.ts`)은 마커 4줄을 세지 않는다(유지보수자 지표, 설치자 영향 없음).
  - 검증: `tests/agents-md-preserve.test.ts` · `test/docker/scenarios/scenario-update-preserves-agents-md.sh`.

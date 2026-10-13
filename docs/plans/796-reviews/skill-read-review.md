# PR #813 (fix/796-skill-read-regression, head 0237ea3) — 머지 전 독립 리뷰 · 옛 판 실설치 공격

- 대상: 격리 사본 `isoSR/uzysClaudeUniversalEnv` @ 0237ea3 (작업 트리 변경 0 — 변이는 모두 되돌림 확인)
- 대조군: ① 게시판 **26.170.0**(npm) ② **main 8e6d87b**(`git archive` → 따로 빌드 → `npm pack`)
- 방법: 이미지 `uzys-rev813-x` 하나에 PR · main · 26.170.0(`ah-pr|ah-main|ah-rel`, 셋 다 `npm pack` tarball 설치) + 옛 판 5개(`/opt/old/<v>`, npm). 판마다 컨테이너 하나. 스크립트는 지난 손실 탐색(`docs/plans/796-reviews/pra-loss-evidence/scripts/`)을 그대로 쓰고 ① 실행 파일 이름 ② opt-in 표식 `gemini-delegate` 추가 ③ `--only rules` 흐름(R) 추가만 바꿨다(`evidence/../ctx/scripts/` 아님 — 사본은 `rev-813/ctx/scripts/`).
- 실행 수: 본 매트릭스 **42회**(26.100 · 26.161 × {claude, claude+codex}, 26.125 · 26.132 · 26.150 × {claude}; 흐름 A · N × PR/main/26.170.0) + 부분 update 표적 **18회**(26.100 · 26.125 · 26.161 × `--only skills|hooks|rules` × PR/26.170.0) + 작성자 잔여 표적 **36회**(ssr-htmx × 26.100 · 26.125 × PR/main/26.170.0 × 편집 유무 × 흐름 A · N · U) + 트랙 스캔 33회 설치.
- 정리: 컨테이너 0 · 이미지 0 확인(`docker ps -a --filter name=uzys-rev813` · `docker images 'uzys-rev813*'`).

## 판정: **PASS with notes** — 블로커 0

## 기준 1–4

| # | 기준 | 결과 | 근거 |
|---|---|---|---|
| 1 | 26.161 · 26.150 · 26.132 + 손으로 만든 현행 기본 이름 스킬 폴더(26.161 `natural-korean`, 26.132·26.150 `objective-brief`) → update 가 백업 + `displaced` · uninstall 뒤 원본 바이트 그대로 제자리 · 26.170.0 과 같음 | **충족** — PR 8/8회(A·N, 26.161 은 claude+codex 포함) `displaced` 기록 · uninstall 뒤 sha 동일(BYTE-SAME) · 남은 백업 0. 26.170.0 8/8 같은 결과. main 8/8 `displaced` 없음 · 원본은 백업에만. 화면도 26.170.0 과 같은 줄(`had files with these names … yours, put back on uninstall` → `✓ put back`) | `evidence/criteria-1-2-3.txt` · `evidence/displaced-after-update.txt` · `ev/26.161.0/tooling_claude-A/{u1,un}.txt` |
| 2 | 하네스가 쓴 적 없는 opt-in 이름(`ui-visual-review` · `gemini-delegate`) → update · uninstall 모두 안 건드림 | **충족** — PR 14/14회(5판 전부, A·N) 두 파일 모두 BYTE-SAME · 백업 0. 26.170.0 같음. main 은 14/14회 uninstall 이 "no checksum on record — removed from live" 로 치움 | `evidence/criteria-1-2-3.txt` · `ev/26.161.0/tooling_claude-Am/un.txt`(main 대조) |
| 3 | 설계 ⑧: 26.100 · 26.125 + `--only new-skills` → 다음 full update 가 옛 하네스 스킬을 `displaced` 로 적지 않음 | **충족** — PR 3/3회 `--only new-skills` 뒤 `skillFiles` 필드 미생성(쓰기 불변식이 실설치에서 작동) · 이후 모든 update 기록의 스킬 `displaced` 0. 같은 불변식을 `--only hooks` · `--only rules` 에도 걸었다 — 필드 미생성 · `displaced` 0. `--only skills` 는 필드를 만들고 `displaced` 0(26.100 · 26.125) | `evidence/criteria-1-2-3.txt` 하단 · `evidence/partial-invariant.txt` |
| 4 | PR-A 보호 유지 | **충족(새 위반 0)** — ⓐ 표식 LOST 는 헬퍼 편집(`MINE-EDHELPER`, 26.150 · 26.161) 1종뿐 · PR · main · 26.170.0 동일(기존 pra-review-loss HIGH-2) ⓑ uninstall 뒤 하네스 바이트(현행 + 옛 5판 + 26.170.0 템플릿 sha 대조) PR 23/23회 0 — 26.170.0 은 2–3개 남김 ⓒ update 2회차 백업: 26.132+ 전부 0 · 26.100 · 26.125 흐름 A 는 13(은퇴 claims 회수 — PR-B 범위, main · 26.170.0 도 13, 3회차 0) ⓓ update 가 `records` 를 쓰지 않음 — 60회 전부(PR · main · 26.170.0) | `evidence/matrix.txt` · `evidence/matrix-all.txt` · `evidence/harness-bytes-after-uninstall*.txt` · `evidence/harness-bytes-partial.txt` |

### 실행 · 음성 대조

| 검사 | 결과 | 근거 |
|---|---|---|
| `npm run ci`(격리 사본, 파이프 없이 exit 기록) | **exit=0** · 163 files / 2394 tests · branches 89.59 | `evidence/ci-pr.txt` |
| M1 읽기만 폴더 단위로 되돌림 | 변이 diff 확인 · `tsc --noEmit` 0 · **4 red**(recorded "스킬 none" · ⓐ `displaced []` · ⓑ uninstall 뒤 ENOENT · update-dev-default-skills ④) | `evidence/mut-M1.txt` |
| M2 쓰기 불변식만 되돌림 | 변이 diff 확인 · tsc 0 · **1 red**(update-one-writer ⓒ :139 — 필드 생성) | `evidence/mut-M2.txt` |
| M2b M2 + 중간(메커니즘) 단언 제거 | tsc 0 · **결과 단언 :144 red**(옛 스킬이 `displaced` 로 적힘) — 테스트가 구현 방식이 아니라 결과를 문다 | `evidence/mut-M2b.txt` |

## 작성자 잔여 판정 — "26.100/26.125 + full update 뒤, 그 옛 판이 깔았지만 현행 기본이 아닌 번들 스킬은 uninstall 이 남긴다"

- **실재하는 장면을 찾았다.** 11개 트랙을 26.100 · 26.125 로 깔아 현행 기본과 대조하니, 현행 번들에 있는데 기본이 아닌 스킬을 그 판이 기본으로 깐 경우는 **ssr-htmx 의 `ui-visual-review` 하나**뿐이다(그 밖 옛 판 전용 스킬 13–16개는 은퇴했거나 외부 팩이라 현행 대상이 아님 — PR · main · 26.170.0 판정 같음). `evidence/old-only-skills-by-track.txt`
- 결과(36회, `evidence/residual-summary.txt`):
  - **손대지 않은 경우**: PR · main · 26.170.0 모두 uninstall 이 치운다(옛 판 지문). 하네스 바이트 0.
  - **설치자가 `SKILL.md` 를 고친 경우**: update(A · N)를 거치면 PR 은 그 파일을 **고친 내용 그대로 라이브에 남긴다** — 26.170.0 과 같다(12칸 중 12칸 PR = 26.170.0). main 은 백업 뒤 치운다. update 없이 바로 uninstall(U) 하면 셋 다 백업 뒤 치운다.
- **판정: 손실 아님 · 원칙 위반 아님 · 블로커 아님.** 남는 것은 설치자의 편집이 든 파일이고 바이트는 하나도 사라지지 않는다. 원칙(기록 없는 옛 판 파일은 바이트 그대로일 때만 하네스 것으로 보고 치운다)과도 맞다. 게시판 대비 회귀도 아니다. 다만 같은 파일이 "update 를 한 번 했는가"에 따라 남거나 백업·제거로 갈린다 → MEDIUM-2.

## Findings

[MEDIUM-1] #796 설계 문서가 이 PR 이 철회한 읽기 규칙을 여전히 "설계 필수 항목"으로 처방한다
File: docs/plans/796-one-writer-design.md:55(§1.2 ⑧ 행) · :72 · :115-117(§3.3) · :309(PR-0 행)
Issue: ⑧ 행은 "`scanFieldOf` 를 스킬 폴더 단위로 고쳐… 안 고치면 회귀 — 설계 필수 항목", :72 는 "조기 반환은 사라진다 — 단 스킬 단위와 함께" 라고 적는다. 코드와 ADR-097 은 이제 반대(필드 단위 읽기 + 쓰는 쪽 불변식)다. #796 은 PR-B(pruneOrphans)가 남아 같은 설계를 읽고 착수한다 — `doc-governance` "추적 문서는 머지까지 코드와 함께 동기화". 다음 구현자가 설계를 따라 폴더 단위로 되돌릴 위험이 있으나 M1 이 4 red 로 무는 것을 확인했으므로 MEDIUM.
Fix: 방향만 — ⑧ · :72 · §3.3 에 "PR #813 에서 철회 — 현행은 ADR-097(필드 단위 읽기 + `recordHarnessWrites` 쓰기 불변식)" 한 줄 포인터. 본문 이력은 그대로 둬도 된다.

[MEDIUM-2] 스캔 필드 없는 옛 기록(≤26.125)에서 설치자가 고친 옛 하네스 스킬(현행 비기본)의 uninstall 결과가 "그 사이 update 가 있었나" 로 갈린다 (기존 동작 — 26.170.0 과 같음)
설치자 장면: 26.100 ssr-htmx 설치본, `ui-visual-review/SKILL.md` 에 한 줄 추가. update 뒤 uninstall → 파일이 편집 그대로 라이브에 남음 / update 없이 uninstall → 백업 뒤 제거.
재현: `evidence/residual-summary.txt`(`*-edit-A|N` vs `*-edit-U`) · `ev/residual/<v>-pr-edit-*/res.txt`
26.170.0/main 대비: PR = 26.170.0(12/12) · main 은 둘 다 백업 뒤 제거.
손실 0 · 원칙 위반 0. 해당 장면은 11트랙 중 ssr-htmx 의 1개 스킬뿐. 선택 개선 — full update 가 필드를 처음 만들 때 그 옛 판이 깐 대상 밖 번들 스킬도 같이 판정할지는 PR-B(은퇴·대상 밖 회수)와 함께 볼 일.

## Positive Observations (측정)

- 기준 1·2 의 결과가 26.170.0 과 칸 단위로 같다(디스크 · `displaced` 기록 · 화면 줄) — main 의 회귀 22회(기준 1 8회 + 기준 2 14회)가 전부 닫혔다.
- 쓰기 불변식이 문서화된 `--only new-skills` 하나가 아니라 `--only hooks|rules` 에서도 실설치로 버틴다(필드 미생성, 이후 `displaced` 0).
- PR-A 의 개선(다른 트랙 이름 자기 파일 미덮어쓰기 · uninstall 뒤 하네스 바이트 0)이 그대로 — 26.170.0 은 `strategist.md` · `ui-components.md` · `data-analyst.md` 를 덮고 하네스 바이트를 남긴다.
- 수정이 src 2곳 21줄로 작고, 읽는 쪽에 경우를 더하지 않고 기록을 만드는 쪽 한 곳에서 막았다.
- 테스트가 결과를 문다(M2b) — 메커니즘 단언을 지워도 `displaced` 결과 단언이 red.

## 한계

- linux-arm64 컨테이너 · `--cli` 조합은 {claude} · {claude, codex} 만. opencode · antigravity 조합, `uninstall --cli` 부분 제거, `--reinstall`, 위저드 update 는 실행하지 않았다(위저드는 같은 `runUpdateMode` → `updateHarnessFiles` 를 타는 것만 코드로 확인).
- 하네스 바이트 판정은 번들 템플릿 파일 sha 대조 — 렌더 산출물(`.agents/` · `AGENTS.md`)은 표식 추적으로만 봤다.
- 26.126–131(S2) 표본은 npm 판을 넣지 않았다 — 옛 스캔이 깔린 스킬을 다 적는다는 전제는 26.132 · 26.150 · 26.161 에서만 실측(디스크 스킬 폴더 = 기록 폴더, 26.161 의 외부 팩 `frontend-design` 만 기록 밖이고 현행 대상이 아님).
- 헬퍼 편집 LOST(pra-review-loss HIGH-2)는 이 PR 범위 밖 기존 결함이라 재판정하지 않았다.

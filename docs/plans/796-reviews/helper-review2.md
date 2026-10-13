# PR #814 재리뷰 — 29d7562 (지난 [CRITICAL] 수정분 · 영향 범위만)

## 판정: **PASS** — 블로커 0. 지난 CRITICAL 해소 · 확장된 writer 규칙에서 설치자 바이트 손실 0 · 지문이 소유 근거로 쓰이는 새 경로 없음

방법: 빌드 3개를 이미지 `uzys-rev814-img2` 에 넣음 — PR 29d7562(`npm pack`) · main 2582746(PR-B 포함, `git archive`) · **병합판**(`git merge-tree 2582746 29d7562` 트리 — 충돌 없음. 실제로 main 에 들어갈 모양). 각 tarball 에 PR 코드(지문 헬퍼 줄 · writer 지문 가지)와 PR-B 코드가 있는지 grep 으로 확인함(pr 은 PR-B 없음 · main 은 PR 없음 · merged 는 둘 다). 옛 npm 판 26.100 / 26.125 / 26.150 / 26.161 / 26.170.0. 실행 52회 + dry 집계. 이미지·컨테이너는 지웠고 잔존 0.

| 확인 | 결과 | 근거 |
|---|---|---|
| ⓐ 손대지 않은 26.150 · 26.161, B/U | PR · 병합판 · main 12/12 모두 `.uzys-agent-harness/` 없음 · 헬퍼 백업 줄 0 | `evidence2/ev/clean.txt` |
| ⓐ 고친 헬퍼만 백업 | 26.150 · 26.161 B/U(PR · 병합판 8회): 고친 `protect-branch` · `check-absence` 만 백업, 손대지 않은 `spec-drift-check` 는 백업 없음. U 에서 update 뒤 다시 고친 것(PB2)도 백업. main 은 같은 장면 4회 모두 헬퍼 편집 LOST | `evidence2/matrix2.txt` |
| ⓑ ≤26.125 `.claude/` 로 넓어진 범위 | 26.100 · 26.125 × B/U × 3빌드: PR · 병합판 LOST 0(main 은 U 에서 MINE-PB2 LOST — 기존 #812). 고친 룰 · 에이전트 · 훅 · 스킬 · 은퇴 자리 편집, 하네스 이름의 설치자 파일(옛 판이 안 깐 룰 · 에이전트 · 스킬 폴더 + 노트 · 다른 트랙 · opt-in · 은퇴 이름) 전부 main 과 같은 상태(LIVE 또는 백업). 하네스 템플릿 바이트 잔존 0(24/24) | `matrix2.txt` |
| ⓑ 사라진 백업이 설치자 것이 아닌가 | 첫 update 백업 수: main 35 → 병합판 25(26.100) · 35 → 24(26.125). main 에만 있던 21개는 **전부 그 옛 판 템플릿과 바이트 동일**(설치자 내용 0). 병합판에만 생긴 백업 0 | `evidence2/dropped-backups.txt` |
| ⓑ 지문이 `none` 에 개입하는가 | 코드: writer 는 `rec.state === "no-sha"` 일 때만 지문을 본다(`install-writes.ts` +8줄). 실측: 설치자가 **옛 하네스 바이트 그대로인** 자기 `protect-branch.sh` 를 미리 둔 장면(새 판 첫 설치 / 26.170.0 설치) × B/U × 3빌드 → PR · 병합판 8/8 `displaced` 로 적고 uninstall 이 바이트 그대로 되돌림. 지문이 첫 접촉을 하네스 것으로 바꾸지 않았다. main 은 4/4 "not put back"(백업에만 — 기존 #812) | `evidence2/ev/disp.txt` |
| ⓒ 음성 대조 | M1(생성물을 d95982e 로 되돌림 · 헬퍼 지문 0줄 확인 · tsc 0) → 18건 중 5 red. M2(`install-writes.ts` 되돌림 · `isLegacyHarnessFile` 0 확인 · tsc 0) → 2 red(update 경유 둘). 원본 18/18 green · 되돌린 뒤 작업 트리 깨끗. 작성자 보고와 일치. **첫 실행은 zsh 가 테스트 인자 두 개를 한 덩어리로 넘겨 "No test files found" 가 나 무효 처리, bash 스크립트로 다시 돌림** | `evidence2/mut/` |
| ⓓ `npm run ci` | exit 0 — 163 files · 2403 tests · branches 89.6% | `evidence2/ci-pr.log` |

## Findings
- 블로커 없음.
- [참고 · 의도된 변화] `install --reinstall` 도 같은 writer 를 타서 옛 기록의 noChecksum 백업이 준다: 26.125 16 → 1, 26.161 4 → 2. 고친 룰 · 헬퍼는 두 판 모두 백업에 남음(`evidence2/reinstall.txt`). 손실 0이고 ADR-111 결정 1ⓐ 를 쓰기에도 적용한 결과다. 다만 결정 문장 "보류된 대안: 지문을 update 파일 회수에도"와 헷갈리지 않도록 ADR-111 Consequences 에 "install · update · reinstall 쓰기도 no-sha + 지문 일치 = 백업 생략"을 한 줄 더하는 것을 권함(선택).
- [MEDIUM · 지난 리뷰에서 이월] 기록 폴더 안 설치자 자기 파일(`my-notes.md`)은 남지만 화면이 말하지 않는다 — 이번 범위 밖.
- 참고: uninstall 의 ⓑ′ 후보(`legacyFileCandidates`)에도 헬퍼가 들어갔다. 쓰는 순간 적는 기록(26.162+)에서 헬퍼가 `none` 이면서 displaced 도 아니고 바이트가 옛 판 그대로인 디스크는 실설치 경로로 만들어지지 않는다. 설치 전에 미리 둔 파일은 위 실측대로 displaced 가 된다. ADR-111 Consequences("번들 자리의 우연한 옛 바이트 = 백업 없이")에 이미 받아들인 범위다.

## 한계
- linux-arm64 · tooling 트랙 · {claude} 만(지난 라운드에서 {claude,codex} · `--cli codex` 를 봤고, 이번 수정은 그 경로의 판정을 바꾸지 않는다 — 바뀐 곳은 writer 와 지문 표뿐).
- 26.126–26.149 · 26.162–26.169 는 개별 실행하지 않음. 헬퍼 지문은 v26.141 · v26.143 · v26.147 이후 바이트를 생성기가 태그에서 뽑는다(작성자 노트). 실측한 것은 26.150 · 26.161 바이트뿐.

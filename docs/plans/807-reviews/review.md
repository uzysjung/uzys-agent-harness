# #807 적대적 리뷰 — 실제 옛 npm 판 실설치 (2026-10-14)

대상: `fix/807-displaced-legacy` — e3ecabd · f2ae2b8(1차 수정), 76803d5(리뷰 지적 수정). 비교 = main 928f548.
환경: linux-arm64 Docker, CLI = claude+codex, 트랙 = tooling. 옛 판 = npm 26.140.0 · 26.150.0 · 26.161.0 → npm 26.170.0 update → 브랜치 빌드.

## 1차 (e3ecabd · f2ae2b8) — BLOCKER 1
- #807 원래 장면은 고쳐졌다. 남는 옛 하네스 에이전트(strategist · data-analyst)가 2 → 0이 됐고, 둘 다 백업된다.
- **BLOCKER-1**: `.agents/skills/natural-korean/SKILL.md` 는 하네스 판과 같은 바이트로 둔 설치자 파일이다. 26.170 update 가 이 파일을 "left yours in place"(displaced, 노트 없음)로 적었는데, 브랜치 uninstall 이 이 파일을 **백업 없이 지웠다**. main 은 남긴다. 원인: 새 술어의 트랙 판정이 manifest 경로(`.claude/`) 문자열 기준이라 `.agents/` 자리를 늘 "트랙 밖"으로 읽었다.
- **HIGH-1**: 같은 원인으로, `.agents/skills/` 에 둔 옛 판 바이트 원본을 되돌리지 않았다(손실 없음, 백업에 남음).
- HIGH-2(범위 밖, main 과 같음): 설치자가 고친 strategist 원본은 "spot is taken"으로 남는다. 손실은 없고 화면이 사실대로 말한다.
- 증거: `r1-evidence/`

## 2차 (76803d5) — 통과, BLOCKER 0
- 수정: uninstall 의 자리 → 번들 경로 매핑(`bundlePath`)을 `src/recorded.ts` 로 옮겨 export 했고, 트랙 판정이 그 매핑을 거친다(src 순증 +3줄).
- ④ · ④′ 칸이 main 과 바이트 단위로 같다. 기본 칸의 개선(2 → 0)도 유지된다. 1차에서 미실행이던 `uninstall --cli codex` · `install --reinstall` 흐름도 실행했고 차이가 없다.
- NOTE: 치운 개수가 89 → 91로 늘었고, 같은 두 파일이 "backed up … removed from live" 줄에도 나온다(사실이라 블로커 아님). `.agents/rules/` · `.codex/` 자리는 지문 표에 없어 늘 설치자 파일로 판정된다(main 과 같다).
- 증거: `r2-evidence/`(실행 목록 = `jobs.txt`, 흐름 = `scripts/` · `drive.sh` · `one.sh`)

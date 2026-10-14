# #817 · #777 적대적 리뷰 — 실제 옛 npm 판 실설치 (2026-10-14)

대상: `fix/817-one-screen` — 75ac7ba(1차). 비교 = main 04b0e33. 둘 다 `npm pack` 결과로 설치.
환경: linux-arm64 Docker. 옛 판 = npm 26.100.0 · 26.125.0 · 26.161.0. 장면 8개 · 단계 21개.

## 1차 (75ac7ba) — 통과, BLOCKER 0
- **디스크는 main 과 같다.** 단계마다 파일 목록과 sha 를 대조했고, 차이는 설치 기록의 시각(`installedAt` · 백업 이름)과
  런타임 목록 `update-backups.json` 의 `removed` · `noChecksum` · `note`(USAGE 가 밝힌 의도된 변경)뿐이다. 설치자 파일 손실 0.
- **화면은 모든 장면에서 한 일만 말한다.** 은퇴 회수 · 체크섬 없는 옛 파일 · 번들 밖 스킬 파일 · 기록 폴더의 설치자 파일 ·
  비켜 둔 같은 이름 파일이 파일마다 줄로 나온다. main 이 말하지 않거나("orphan prune 4 removed") 틀리게 말하던("replacing") 자리다.
- #777: 옛 supabase 404 패키지 항목이 있으면 안내 한 줄이 뜬다. 404 는 `npm view` 로 확인(대조군 `@supabase/mcp-server-supabase` 는 존재).
- 브랜치 `npm run ci` exit 0. 관련 Docker 시나리오 8종 PASS. `update-external-skills` 는 main · 브랜치 모두 PASS —
  구현자 쪽 실패 원인은 Docker VM 디스크 100% 였다.
- 지적:
  - **H1**: 외부 스킬 도구(`src/external-installer.ts`)가 남긴 백업은 판정 줄에 안 들어가 `BACKUPS 2 file(s)` 한 줄뿐인데,
    USAGE 는 "파일마다 말한다"고 새로 적었다. main 과 같은 화면이라 회귀는 아니다. 손실 없음.
  - **M1**: "체크섬 없음"을 화면 문구의 `endsWith` 로 되읽는다. 지금은 맞지만 문구를 바꾸면 조용히 틀어진다.
  - **ⓐ**: v26.169.0 이 약속한 "put back on uninstall" 이 비켜 둔 파일 줄에서 빠졌다(uninstall 은 실제로 되돌린다 — 장면 g).
  - NOTE: 체크섬 없음 줄에 백업 경로가 없다(목록 · BACKUPS 줄이 대신 가리킨다). 회수 자리에 원본을 되돌리는 경우의
    표현 엇갈림은 26.168 부터 은퇴한 파일이 0개라 지금 도달할 수 없다.
- 장면별 결과:

| 장면 | 디스크 | 화면 |
|---|---|---|
| a v26.100 + 손으로 만든 룰 → update | 같음 | 은퇴 회수 13건을 파일마다, "14 saved before removing" |
| b v26.125 → `update --only hooks` → 전체 update | 같음 | 기록 없는 9건을 체크섬 없음 · removing 으로(main 은 replacing + 편집 재적용 안내) |
| c v26.161 + north-star/my-notes.md → update | 같음 | `not in bundle — not on the install record — saved as …, removed from live` |
| d 기록 폴더의 설치자 파일 → uninstall --dry-run → uninstall | 같음 | 미리보기 · 실행 모두 남긴다고 말함(main 은 침묵) |
| e 자기 .mcp.json + v26.161 csr-supabase → update | 같음 | #777 안내 줄 |
| f 고친 앵커 + 고친 .agents 스킬 → update | 같음 | `you edited it — saved as <경로>` |
| g 같은 이름의 설치자 파일 → update → uninstall | 같음 | `had a file with this name — saved as …`, uninstall 이 되돌림 |
| h 외부 스킬 편집 → update | 같음 | main 과 같음(H1) |

- 한계: Docker 디스크가 차서 `run.sh` 로 이미지를 새로 빌드하지 못했다. 같은 시나리오 스크립트를 기존 이미지 위에서 각 빌드의
  pack 결과를 PATH 앞에 두고 돌렸다.
- 증거: `evidence/<장면>-<main|br>/`(화면 · 스냅샷 · 기록 · 목록), 실행 스크립트 `evidence/scripts/`.

## 지적 수정 (4bea32e · aa7e4a5) — 재리뷰 대신 실행 확인
- H1: 외부 스킬 도구의 백업도 판정 줄로 올렸다(`src/external-installer.ts`). M1: JudgedWrite 의 `recorded` 필드로 센다.
  ⓐ: 비켜 둔 파일 줄에 `— yours, put back on uninstall` 을 다시 붙였다.
- 디스크 동작은 바꾸지 않았다(화면 줄을 만드는 쪽만). 확인 = `npm run ci` exit 0, Docker 시나리오
  `update-external-skills` · `install-keeps-yours` · `update-skills`(결과는 PR 본문).

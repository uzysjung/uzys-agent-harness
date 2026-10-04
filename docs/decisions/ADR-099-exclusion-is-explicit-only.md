# ADR-099: 빼기는 명시할 때만 기록한다 — 사라진 하네스 몫은 되돌리고 알린다

- Status: Accepted
- Date: 2026-10-04
- PR: #693
- Issue: #566 · #616 · #675 · #641 · #633 · #598 · #584
- Supersedes: ADR-097 §6.2 ⓒ 의 "기록에 있는데 파일에 없는 키는 설치자가 지운 것 — update 는 되살리지 않고 `excluded` 에 자동 기록" · 설계 Q4(파일째 지움 → `excluded`) · `one-principle-design-2026-09-27.md` §1.2 shared 행의 `deleted` · `exclude-portions` 두 칸(본문은 PR A 에서 함께 고친다) 한정. `excluded` 한 목록 · 누적 · `--with` 로 해제는 그대로다.
- 설계 문서: `docs/plans/explicit-exclusion-design-2026-10-04.md`
- Context: 하네스 몫이 디스크에서 사라지면, 파일(룰·스킬)은 update 가 되살리고(USAGE "not the same signal") 함께 쓰는 파일 안의
  몫은 "설치자가 뺐다" 로 자동 기록돼 영영 돌아오지 않았다. 그 추론이 설치자가 빼려 하지 않은 상태 — 훅 스크립트 삭제 뒤 update 의
  배선 정리(#675) · 구간 마커 일시 오타(#641, 되돌린 뒤 내용 삭제) · 파일 재작성(#633) — 에도 걸렸고 되돌릴 명령이 없었다
  (`--with` 가 키 id 를 받지 않음). 26.163.0 재확인에서 7건 모두 재현.
- Decision: **install 의 선택은 그 실행의 입력이고 `excluded`(최신 선택)를 대체한다** — 대체 범위는 그 실행이 `--without` 으로 받을 수
  있는 id(R4 집합), 밖은 이어받는다. **update · uninstall 은 읽기만 한다.** 선택 이력은 기록 `selections`(효과분 · 최근 100개)에 남고
  `list` 가 보여 준다(보강 설계 `docs/plans/selection-record-design-2026-10-04.md`, 사용자 요구 2026-10-04 "사람 A, 사람 B 모두 기대하는대로").
  이 선택 한 필드만 ADR-097 의 누적(Q2)에서 빠진다 — `assets` · `clis` · `portions` 등 쓰기 = 기록 축은 그대로 누적이다. 기록에 있는데
  사라진 하네스 몫(파일 · 키 · CLI 산출물 · 훅 스크립트)은 install·update 가 되돌리고 `was missing — restored` + 영구히 빼는 명령을
  말한다. `--with`/`--without` 은 화면이 보여 주는 모든 id(키 id 포함)를 받는다. 옛 판이 자동 추론으로 적은 키 id 는 1회 지우고,
  옛 기록의 모호한 카탈로그 빼기는 폴더 유무 + mtime 창으로 1회 판정한다(이력에 남긴다). 같은 id 를 `--with`·`--without` 에 함께
  주면 거절한다. 기록된 빼기는 update · uninstall 이 지키고, 플래그 없는 다음 install 은 전에 뺀 것을 다시 깔며 `↺` 줄로 말한다.
  update 는 `settings.json` · `.mcp.json` · `.gitignore` 의 하네스 몫을 install 과 같은 writer 로 쓴다. 사용자 결정 2026-10-04.
- Alternatives: 자동 기록을 두고 `--with <key id>` 탈출구와 안내만 더함 — 설치자가 문제를 알아채고 명령을 찾아야 한다, 기각.
  경우별 예외(파일째 사라짐 · 마커 깨짐은 추론 제외) — 한 원칙에 예외를 더하는 방식이고 다음 사례가 또 나온다, 기각.
- Consequences: 일부러 하네스 서버·블록을 손으로 지운 설치자는 다음 update 에 그것이 돌아온다(화면이 `--without <id>` 를 말한다).
  USAGE 의 `AGENTS.md` "블록을 지우면 다시 넣지 않는다" · "`update` does not rewrite `settings.json`" 문장이 바뀐다.
  ADR-074 의 "제외 없이 다시 깔면 돌아온다" 가 다시 참이고 모든 id 종류로 넓어진다 — CI · 스크립트가 install 을 반복하면 매번 플래그를
  다시 줘야 하고, 갱신만 하려면 update 를 쓴다. 다중 CLI 설치자가 `install --cli claude` 만 돌려도 codex 키 빼기가 풀린다(화면이 미리 말한다).
  `cleanStaleHookRefs` 는 기록에 없는 스크립트 참조에만 남는다. 어댑터 계약의 `deleted` 와
  judge 의 `exclude-portions` 는 없어진다(one-principle-design §1.2 표 갱신).

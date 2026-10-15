# #543 트랙 단위 uninstall 설계 — 독립 설계 검증 (design-verifier, 2026-10-15)

대상: `docs/plans/543-track-uninstall-design.md` @ e374d05 (main 912e0e7) · 근거 `docs/plans/543-design-evidence/` · `src/`
판정: **착수 가능 — BLOCKER 0건 · NOTE 9건** (NOTE 1·2·3 은 구현 브리프에 반영해야 테스트 계획과 코드가 맞는다)

## 1. 핵심 주장 대조 — 전부 코드·실험과 맞는다

| 주장 | 판정 | 근거 |
|---|---|---|
| "T 전용" 술어 = `claudeTargets(old) ∧ ¬claudeTargets(remaining)`(ⓑ) · 디렉터리 아래는 번들 템플릿 파일 규칙 | ✓ | `src/track-heal.ts:43-48`(파일 + `.claude/skills/` 디렉터리, `DEFAULT_OPTIONS`) · `src/recorded.ts:114-120` · S1/S2/S3 `track-diff-predicate.txt` — ⓐ는 S1 에서 스킬 0, ⓑ는 `ui-visual-review` 두 자리까지 4건. 외부 CLI 자리 매핑(`bundlePath` `recorded.ts:83` · `.agents/rules/<r>.md` 정규식 `out-of-track.ts:28`)도 S1 출력이 실증 |
| `removeHarnessFiles` 에 `RemovalScope{has:onlyT, shared:[], skeleton:[], folders:[], importBlock:false, anchor:false}` 만 넘기면 백업 · displaced 되돌림 · 링크 · 빈 폴더가 그대로 돈다 | ✓ | `src/commands/uninstall.ts:1607-1620`(필드) · `1717-1722`(후보 × `scope.has`) · `1748-1756`(`restoreDisplaced(has: scope.has)`) · `1758-1759`(지운 파일 부모만 prune) · `removeRecordedFile` 1825-1918 이 판정을 **실행 시작 때의 기록**(`recorded(log,…)` 1885)으로 하므로 기록을 먼저 바꾸면 안 된다는 함정도 맞다 |
| heal 은 메타파일 sha 가 기록과 같을 때만 트랙을 더한다 → `spec.tracks` + 메타 본문 + sha 를 한 쓰기로 | ✓ | `src/track-heal.ts:59-84`(79 줄 sha 대조) · `src/install-log.ts:711`(읽는 쪽 전부가 거친다) · S1·S2·S3 `edit-1a.txt`(spec 만 빼면 `list` 가 두 트랙) vs `edit-1b.txt` |
| 순서 0→1→2→3→4 · 중간 실패 시 손실 없음 | ✓ | 1 뒤 실패: 기록이 T 를 들고 있어 재실행이 `forgotten`(1866-1869)으로 정리 · 3 뒤 4 실패: sha 불일치라 heal 이 아무것도 더하지 않고 기록은 그대로 T(`track-heal.ts:79`) · 4 실패는 `--cli` 와 같은 줄(1195-1204). 백업은 1 에서 이미 남는다 |
| update 재사용만으로는 안 된다(새 엔진은 불필요) | ✓ | `update-mode.ts:1286·1309·1704`(대상 = 기록 트랙 + 기록 스킬) · `2424`(orphan = 템플릿 부재) · `out-of-track.ts:79-93`(Antigravity 룰 한 자리 · claude 사본 있으면 kept) — S1·S2 `screen-2-update.txt` ⊘ 줄 · `probe-after-update.txt` STILL THERE 가 그대로 보인다 |

사용자 요청("기록에서 트랙을 빼고 기존 경로를 재사용하는 작은 설계")과의 정합: 새 삭제 엔진 · 새 판정 함수 · 새 기록 필드 없음. "기존 경로" 가 update 가 아니라 **uninstall 의 파일 회수 엔진**이라는 점만 §1.2 판정대로 사용자에게 한 줄로 알리면 된다(요청의 전제가 "update 정합 경로"였다 — 가설 ⓑ 는 부분 기각이고 설계는 그 결론을 정직하게 담았다).

## 2. BLOCKER — 없음

설치자 파일 손실 · 화면 거짓 · 남는 트랙 자산 회수 가능성을 다음 장면으로 따라갔고 전부 막힌다:
- 옛 판 기록 A1(스캔 · writer 없음): 후보는 `policyFiles`/`skillFiles`(1778-1779) · `recorded()` 는 `legacyOwned`(`recorded.ts:186-187`) 로 **sha** 를 돌려준다 → 디스크가 sha 그대로면 지우고 다르면 백업(`judge.ts:195-202`). 설치자 동명 파일이 백업 없이 사라지는 길은 없다(단 NOTE 2 — 테스트 10 의 기대값이 틀렸다).
- A2(파일 필드 없음): `recordedTrackSpots`(1789) → `no-sha` → `templateNext` 바이트 대조(1898) → 같으면 remove · 다르면 backup+remove. 손실 없음. `.agents/` 자리는 `externalFiles` 가 없던 판이라 후보가 아니다(남는다 — 화면이 말할 것은 없다, 전량 uninstall 과 같다).
- 남는 트랙과 공유하는 자산: 술어가 `¬claudeTargets(remaining)` 이라 구조적으로 후보에서 빠진다(S2: csr-fastapi 가 남으면 `cli-development` 둘만).
- 외부 CLI 자리(`.agents`): `has` 가 번들 경로로 판정하므로 `.agents/rules/<T 룰>.md` · `.agents/skills/<T 스킬>/…` 만 든다. 앵커 `.agents/rules/uzys-harness.md` → `.claude/rules/uzys-harness.md` 는 manifest 밖 → 거짓. 외부 자산 `.agents/skills/frontend-design/…` → `.claude/skills/frontend-design/…` 은 manifest 밖 → 거짓(남는다 = D2).
- `excluded`: 후보에 없는 파일은 닿지 않고(ADR-099 R3), 옵트인 스킬(`--with compaction-handoff`)은 `DEFAULT_OPTIONS` 술어에서 `was()` 가 거짓이라 **남는다**(안전한 쪽). ⓐ 술어였다면 모든 번들 스킬이 대상이라 위험했을 것 — ⓑ 선택이 옳다.
- `.claude/.installed-tracks`: manifest 밖이라 `has` 거짓 → 1 단계가 건드리지 않고 3 단계가 다시 쓴다. ✓

## 3. NOTE (근거 · 실패 시나리오 · 고칠 문장)

**NOTE 1 — AGENTS.md 재렌더가 기록을 디스크에서 읽는 자리가 둘이다. "선택 인자 하나 ≈ 3줄" 은 하나만 덮는다.**
- 근거: `rerenderAgentsMd`(`uninstall.ts:1049-1060`) → `recordedRenderInputs(projectDir, log)` 의 `rules` 는 `installedTracks(projectDir)`(`update-mode.ts:1929 → 1842-1844`, **디스크 기록**) — 설계가 인자로 덮는 곳. 그런데 같은 호출의 `selectedInternalSkills` 는 `recordedBundledSkills(projectDir, log)`(1924) = 넘긴 log 의 `skillFiles` ∪ `externalFiles` ∪ `bundledSkillTargets(log.spec.tracks)` 이고, 그 뒤 `runAgentsMdTransform` 안의 `agentsSkillSlot(refreshOnly:true)` 가 **또** `bundledSkillTargets(projectDir)` 를 기본 인자 `readInstallLog(projectDir)` 로 디스크에서 읽는다(`agents-skill-targets.ts:42 · 118`).
- 실패 시나리오: 2 단계가 4 단계(기록 쓰기) 앞이므로 둘 다 **T 를 든 기록**을 본다. 상시 안내(`CONTINUOUS_SKILLS` = `user-centered-explanation` · `model-orchestration`, `external-assets.ts:1183`)는 트랙 전용 스킬을 싣지 않아 S1~S3 에서는 바이트가 안 바뀌지만, **dev 트랙을 마지막으로 빼고 비-dev 트랙(executive · project-management · growth-marketing)이 남는 장면**에서는 방금 지운 두 스킬을 "열어라" 고 적은 AGENTS.md 가 다음 update 까지 남는다(update 가 그때 다시 써서 §3.1-7 "이어서 update 해도 조용" 이 그 장면에서 깨진다).
- 고칠 문장(§2.3 행 4 · §2.4): "재렌더 입력은 **settled 기록**(`settleTrackLog` 결과 — 4 단계가 쓸 그 객체)으로 만든다: `recordedRenderInputs(projectDir, settled, settled.spec.tracks)` 로 `rules` 와 `selectedInternalSkills` 둘 다 남는 트랙 · 남는 기록에서 나오게 하고, `agentsSkillSlot` 의 `bundledSkillTargets(projectDir)` 디스크 읽기는 `runAgentsMdTransform` 에 `log` 를 넘겨 같은 객체를 쓰게 한다(≈ 8줄). 대안은 4 단계를 둘로 나누기(settled 기록을 먼저 쓰고 재렌더 뒤 `withRerender` 로 한 번 더) — 두 번째 쓰기가 실패하면 다음 update 가 AGENTS.md 를 백업하는 #550 형태라 전자를 권한다." 순서 2→4 의 이유(§2.4 셋째 글머리)는 그대로 유효하다.

**NOTE 2 — §3.1 테스트 10 의 기대값이 코드와 다르다(관측 불가능한 단언).**
- 근거: `recorded()` 의 옛 스캔 필터 ②는 `isTarget(path)` 가 **거짓**일 때만 `none` 을 낸다(`recorded.ts:186-187 · 203-204`). `--track` 의 `has` 가 참인 경로는 정의상 기록 트랙의 대상이라 `isTarget` 이 참 → `{state:"sha", sha256: 스캔 sha}` → `judge` 가 디스크 sha 로 remove / backup+remove 를 가른다. "필터에 걸려 `none` → 남는다" 는 `has` 가 참인 경로에서 일어날 수 없다.
- 고칠 문장: "10. **옛 스캔 로그(records 없음)**: `tests/uninstall-legacy-scan.test.ts` 픽스처 모양으로 ⓐ 설치 뒤 설치자가 고친 T 전용 룰 → `backup+remove`(sha 불일치, `LINES.editedRemoved`) ⓑ 스캔 sha 그대로인 T 전용 룰 → 백업 없이 제거 ⓒ `excluded` 에 든 T 전용 경로(`--without baseline:rules/<r>`)는 후보가 아니라 남는다(필터 ③). 손실 음성 대조는 ⓐ 의 백업 파일 존재." (설계 §2.2 둘째 줄의 ADR-097 결정 1 인용은 writer 기록에만 맞는 말이다 — "writer 기록에서는" 을 붙인다.)

**NOTE 3 — A4 의 기대("끊어진 링크가 남지 않는가")는 현행 엔진이 보장하지 않는다 — 전량 uninstall 과 같은 결과가 정답이다.**
- 근거: `.claude/skills/<id>` 슬롯이 링크면 `foreignOwnedTarget`(`foreign-slot.ts` `SKILL_SLOT`) 이 슬롯 전체를 남의 자리로 보고 `removeRecordedFile` 은 **기록만 정리**한다(1841-1851). 본문 `.agents/skills/<id>/SKILL.md` 는 `externalFiles` 로 지워진다. 1908-1911 의 "포인터 먼저" 는 슬롯 **안**의 파일 링크 이야기다. 결과 = 설치자가 만든 링크가 끊어진 채 남고 화면은 침묵 — 전량 · `--cli` 와 같다(링크는 설치자 것, #343 · ADR-098).
- 고칠 문장: "A4 — 본문은 빠지고 설치자 링크 슬롯은 기록만 정리돼 **끊어진 링크가 남는다**(전량 uninstall 과 같은 결과). 다른 결과면 회귀." 링크 슬롯을 말하는 줄(`⊘ left .claude/skills/<id> — your link; its target was removed`)은 전량 · `--cli` 에도 없는 것이라 이번 범위 밖(이슈).

**NOTE 4 — D3(루트 `CLAUDE.md` 트랙 줄 갱신)은 이번 범위에서 뺀다. 추천안 ✗ → 대안(두고 이슈).**
- 근거 ①: 루트 `CLAUDE.md` 는 사용자 소유이고 하네스 몫은 **마커 블록 하나**다 — `project-claude-merge.ts:349-350 · 360-362`(`upsertHarnessImport` 는 "그 안만" 바꾼다, P5 · ADR-060). 인용 블록을 고치는 순간 함께 쓰는 파일의 하네스 몫이 하나 늘어나는데, 그 몫은 **기록(`portions`)에 없다** — `TRACK_NOTE_MARK` 로 알아보는 것은 디스크 내용 기반 소유 판정이라 원칙 "하네스 몫은 설치 기록 하나가 정한다"(ADR-096) 와 어긋난다. ② 더할 때도 안 바뀌는 대칭 결함(§7 첫 줄) — 뺄 때만 고치면 다음 `install --track` 뒤 다시 틀린다. ③ 사용자가 "작은 설계" 를 정했고 이 줄은 안내문이라 틀려도 설치자가 잃는 것이 없다.
- 고칠 문장: "D3 — **두고 이슈로**. 더하기 · 빼기 양쪽을 같은 함수(`upsertHarnessImport` 가 마커 블록을 갱신하듯 트랙 인용 블록을 갱신하거나, 그 줄을 마커 블록 안으로 옮기는 결정)로 고치는 별도 이슈. 그때 그 줄을 기록(`portions`)에 적을지가 결정 항목." (src 순증 −15)

**NOTE 5 — D1 추천안의 안내 명령은 성립한다 — 단 두 가지를 화면에 적는다.**
- 근거: `install` 은 기존 기록의 CLI 를 합치므로 `--cli` 없이 된다(`install.ts:275`) · `--without chrome-devtools` 는 카탈로그 id(`external-assets.ts:588`)라 통과(`install.ts:306-307`) · `droppedMcpServers`(`mcp-merge.ts:276-286`) 가 그 행을 빼고 렌더 밖 기록 키는 `planUpsert` 가 지운다(ADR-101) — `.codex/config.toml` · `opencode.json` 도 같은 `mcp` 값(`installer.ts:673`).
- 적을 것: ⓐ 그 명령은 **install 전체를 다시 돈다**(모든 하네스 파일 갱신 · 고친 파일 백업) — 설치자가 "MCP 한 줄 빼는 명령" 으로 기대하지 않게 한 마디 ⓑ `--without` 은 누적 `excluded` 라 나중에 `install --track csr-fastapi` 로 돌아와도 그 서버는 `--with` 로 다시 골라야 한다. 문장 원천으로 지목한 `install-writes.ts:901` 은 맞다.

**NOTE 6 — 어휘 밖 트랙 문자열과 "마지막 트랙" 판정.**
- 근거: `claudeTargets` · `installedTracks` · heal 은 전부 `isTrack` 으로 거른다. 기록에 `["csr-fastapi","legacy-x"]` 처럼 지금 어휘에 없는 문자열이 있으면 남는 "아는 트랙" 이 0 이 된다.
- 고칠 문장(§2.2 마지막 트랙): "마지막 판정은 **어휘에 있는 기록 트랙**으로 센다(모르는 문자열은 남는 트랙으로 치지 않는다). `settleTrackLog` 는 모르는 문자열을 지우지 않고 그대로 둔다 — 메타파일도 같은 목록(`installedTracksText`)으로 쓴다."

**NOTE 7 — `--track` 과 `--yes` 의 우선순위를 적는다.**
- 근거: `uninstallAction` 은 `--cli` 분기(268-274)가 `--only` · 전량보다 앞이라 `--cli --yes` 에서 `--yes` 는 무시된다. `--track` 분기를 그 옆에 두면 같다. 적지 않으면 구현자가 `--yes` 를 "전량" 으로 읽어 분기 순서를 바꿀 수 있다 — 그러면 `--track x --yes` 가 전량 삭제가 된다.
- 고칠 문장(§2.5): "`--track` 분기는 `--cli` 분기 바로 옆(`--only` 파싱 앞)이다 — `--yes` 가 같이 와도 트랙 제거만 한다. 테스트 5 에 `--track x --yes` → 트랙 제거(전량 아님)를 더한다."

**NOTE 8 — 위저드 확인 화면의 "나가는 것 집계" 는 엔진 미리보기 없이 manifest 이름으로.**
- 근거: `uninstall-interactive.ts` 는 선택만 하고(`cli-ownership` 표 요약 `removalSummary`) 엔진(`removeHarnessFiles`, 비export)을 부르지 않는다(모듈 머리 주석 · `pickCli` 329-351). §2.1 의 "§2.6 미리보기와 같은 집계(파일 수)" 를 그대로 하면 엔진 export + 디스크 판정이 화면 모듈로 들어와 70줄 추정이 늘고 레이어가 섞인다.
- 고칠 문장: "확인 화면은 `claudeTargets(old) − claudeTargets(remaining)` 에서 룰 · 에이전트 · 스킬 **이름**을 보이고(디스크 안 봄 — `--cli` 의 `removalSummary` 와 같은 급) 'file counts: agent-harness uninstall --track <t> --dry-run' 한 줄을 댄다."

**NOTE 9 — §2.2 둘째 글머리 문장 정정(지문 파일).** ⓑ′(`removeHarnessFiles` 1726-1730)는 `scope.has` 만 보므로 T 전용 **현행** 자리에 기록 없이 놓인 옛 판 바이트 파일(지문 표에 `.claude/rules/ui-components.md` · `cli-development.md` 가 있다, `legacy-fingerprints.ts`)은 회수된다 — `inBundle`(1892) 이 참이라 백업 없이. 설치자 내용이 아니라 손실은 아니지만 "트랙 제거는 지문 파일을 건드리지 않는다" 는 틀렸다 → "은퇴 자리의 지문 파일은 술어 밖이고, T 전용 현행 자리의 지문 파일은 ADR-111 판정 그대로 회수된다" 로.

## 4. 결정 항목 판정

| # | 추천 | 판정 | 이유 |
|---|---|---|---|
| D1 MCP 기본 행 남김 | 남김 + drop 명령 | **동의** | 기록이 기본/`--with` 를 못 가른다(`mcp-merge.ts:204-206`, S1 `portions` 세 서버가 같은 모양). `selections.with`(install-log.ts:732-746) 로 새 기록만 가를 수 있지만 옛 기록 오탐 + 원격 MCP 로그인 상태 손실 → 삭제 확대는 사용자 결정. NOTE 5 두 마디 추가 |
| D2 외부 자산 남김 | 남김 + `--only` | **동의** | `settleCliLog` 1102 주석 규율과 같다. 대안은 plugin(`claude plugin uninstall` 스폰) · npm 까지 번진다. 설치자 눈에 `frontend-design` 3종 × 2자리가 남는 것은 화면이 명령으로 메운다 |
| D3 루트 CLAUDE.md 줄 | 바꾼다 | **반대 → 대안(두고 이슈)** | NOTE 4 |
| D4 한 번에 하나 | 하나씩 | **동의** | 술어가 합성적이라(targets(old)−targets(old−a) 뒤 −b = targets(old)−targets(old−a−b)) 순차 두 번 = 한 번과 같다. 열 때 비용 낮음 |
| D5 ADR-094 문턱 위 | 예 | **동의** | 설치자 디스크 삭제 경로 |

## 5. 더 단순한 구조 — 경우를 덧대는 곳 둘

ⓐ **`removeCliAction` 의 뼈대를 둘이 나눠 쓴다.** 설계는 `resolveTrackTarget` · `removeTrackDryRunLines` · `removeTrackHeader` · `removeTrackAction` · `settleTrackLog` 를 `--cli` 와 **같은 모양으로 한 벌 더** 만든다(≈ 165줄). `--cli` 와 다른 것은 ① 머리글 세 줄 ② `scope` ③ 남김 줄(`kept`/`trackLeft`) ④ `settle`(기록 갱신 규칙) ⑤ 재렌더 집합 조건 ⑥ 마지막 줄 문구뿐이고, 순서(미리보기 분기 · `removeHarnessFiles` · 줄 출력 · 재렌더 · 기록 쓰기 · 쓰기 실패 줄)는 같다. `ScopedRemoval{ title, header, scope, extraLines(preview), rerenderSet, settle(done) }` 하나와 `runScopedRemoval(ctx, io, plan)` ≈ 60줄로 두 명령을 돌리면 `--track` 의 추가분은 plan 조립 ≈ 70줄 + `resolveTrackTarget` 35 → uninstall.ts **≈ 230 → ≈ 150**. `settleCliLog` 1138-1155(externalFiles 생존 · `withoutRestored` · portions)는 `forgetRemoved(next, done)` 로 뽑아 둘이 같이 쓴다(−20). Non-Goals 의 "`--cli` 엔진 변경 없음" 과 충돌하지 않는다 — 엔진(`removeHarnessFiles`)이 아니라 호출 뼈대이고 `tests/uninstall-cli-scope.test.ts` 가 리그레션 그물이다. 선택 사항이지만 "같은 모양을 한 벌 더" 가 바로 §원칙 "경우를 덧대지 말고 구조를" 의 신호다.
ⓑ D3 제외(−15) · NOTE 8(위저드 확인을 이름으로, −~20).
→ 예상 src 순증 **≈ 330 → ≈ 230** (uninstall.ts ≈ 150 · interactive ≈ 55 · update-mode/agents-md-transform ≈ 10 · recorded/track-heal ≈ 10).

## 6. 테스트 계획 — 덮는 것과 빠진 장면

덮는다: 1(변이 증명 = 옵션 부재) · 2(heal 음성 대조 — 실험 ⓐ 가 이미 그 장면) · 3 · 4 · 5 · 6 · 7(NOTE 1 반영 후) · 8 · 9. Docker ①~⑥ 과 적대적 A1~A8(A4 는 NOTE 3 대로 기대값 수정) 도 충분하다. 빠진 장면:
- **T1 비-dev 잔존**: `tooling + executive` → `--track tooling` → DEV_RULES · DEV_AGENTS(`implementer` 등) · has-dev-track 번들 스킬 전부 + `CONTINUOUS_SKILLS` 둘이 빠지고 공통 룰 · `strategist`(executive) · 훅 · 앵커는 남는다 · AGENTS.md 상시 안내에 지운 스킬이 없다(NOTE 1 의 관측 장면) · 이어서 update 조용.
- **T2 `full` 제거**: `full + tooling` → `--track full` → `ui-components` · `ui-visual-review` · `data-analyst` · `strategist` 가 빠지고 `cli-development` 는 남는다(두 트랙 모두의 룰 — 패턴 `csr-*|ssr-nextjs|full` · `data|full` · `executive|full` 겹침 대조).
- **T3 옵트인 스킬 보존**: `--with compaction-handoff` 로 깐 뒤 `--track csr-fastapi` → 그 스킬 두 자리 그대로(`DEFAULT_OPTIONS` 술어의 안전 쪽을 무는 음성 대조 — ⓐ 술어로 바꾸면 빨간불이어야 한다).
- **T4 `excluded` 불변**: `install --track csr-fastapi --without ui-visual-review` 뒤 `--track csr-fastapi` → 파일 0 · `excluded` 그대로 · `install --track csr-fastapi` 재설치 때도 그 스킬은 안 돌아온다(누적 빼기 계약 확인).
- **T5 antigravity 단독(A6 를 단위 테스트로)**: 메타파일 없음 · 3 단계 건너뜀 · `.agents/rules/<T>.md` 만 · 기록 `spec.tracks` 갱신.
- **T6 `--track x --yes`** → 트랙 제거(전량 아님) · `--track x --cli claude` 거절(NOTE 7).
- **T7 순차 = 일괄**: a→b 두 번의 최종 디스크 · 기록이 "a+b 를 처음부터 안 깐 설치" 와 같다(D4 의 근거를 무는 대조).
- **T8 어휘 밖 트랙**(NOTE 6): 기록 `["csr-fastapi","legacy-x"]` 에서 `--track csr-fastapi` 거절(마지막 아는 트랙).
- **T9 `list` 대조**: 제거 뒤 `list` 가 남는 트랙만 말한다(docker ④ 를 단위에도).

## 7. 범위 밖 관찰(이슈 후보)
- 링크 슬롯이 끊어진 채 남는 것을 화면이 말하지 않는다(전량 · `--cli` · `--track` 공통, NOTE 3).
- `demotedAgents` · `reclaimOutOfTrack kept` 문구를 `uninstall --track` 으로(설계 §7 둘째 — 동의).
- 루트 `CLAUDE.md` 트랙 줄의 더하기 · 빼기 동기화(NOTE 4).

판정: **PASS with notes** — NOTE 1 · 2 · 3 · 4 · 6 · 7 을 문서에 반영한 판을 구현 브리프로 쓴다. 사용자에게 올릴 결정은 없다(D1 · D2 추천안 유지 · D3 는 범위 제외 권고 — 바꾸는 쪽이 아니라 두는 쪽이라 사용자 결정 불요).

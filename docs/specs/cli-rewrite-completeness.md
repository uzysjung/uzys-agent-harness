# SPEC: CLI Rewrite Completeness — Promise = Implementation

> **Status**: Draft (2026-04-25) — 사용자 승인 후 Accepted 전환
> **Scope**: bash setup-harness.sh 등가성 100% 복원. v0.2.0 CLI rewrite (TS) 시 누락된 외부 자산 32건 + Router 분기 + 환경 파일 + Codex opt-in 모두 구현
> **NORTH_STAR**: Phase 1 — 어휘 완전성 (`docs/NORTH_STAR.md` §4 재정의 후)
> **Driver**: Reviewer 전수 조사 보고서 (CRITICAL 4 / HIGH 9 / MEDIUM 5 / LOW 3) + 사용자 실측 발견

---

## 1. Objective

v0.2.0 CLI rewrite는 `templates/` 자산 복사만 포팅하고 bash setup-harness.sh L791~1067의 외부 자산 설치 32건을 누락. v0.3.0 OpenCode 추가 시 이 누락분이 ship되면서 README가 거짓 약속 상태.

**3 결과**:
1. **Promise = Implementation** — README/USAGE/SPEC 광고 자산 100% 실제 설치/작동
2. **First-Run Success ≥ 95%** — 사용자가 처음 `npx -y github:...` 실행 시 수동 개입 없이 완료
3. **bash era 등가성** — `setup-harness.sh@911c246~1` 의도된 동작 100% 복원 (별도 외부 자산 마켓이 사라지거나 더 이상 유효하지 않은 경우 명시적 deprecation 후 제거)

## 2. 판단 기준 (불변)

NORTH_STAR §5 4-gate (Vocabulary / Persona / Capability / Promise=Implementation) 통과 + CLAUDE.md P2(Simplicity First) 우선.

### 완료 조건 (AC)

- **AC1**: `--with-ecc` / `--with-prune` / `--with-tob` 3 옵션 모두 실제 plugin/script 호출 + 결과 파일 검증 (`.claude/local-plugins/ecc/` 디렉토리 존재 + KEEP 89 외 제거 / ToB plugin 설치)
- **AC2**: Track별 외부 자산 32건 (bash setup-harness.sh L791~1067 매트릭스) 모두 호출. 호출 도중 일부 실패는 warning + skip 허용하지만 **silent skip은 금지** (사용자에게 명시적 보고)
- **AC3**: Router 5-action 메뉴 중 add / update / reinstall 3 액션이 **각각 다른 동작** 수행. backup 자동 생성. update 시 orphan prune + stale hook cleanup
- **AC4**: 환경 파일 자동 생성 — `csr-supabase`/`full` 시 `.env.example` + `.gitignore` `.env` 추가. 모든 dev track 시 `.mcp-allowlist` 자동 생성
- **AC5**: Codex `--cli=codex|both|all` 시 opt-in prompt 2 종 — `~/.codex/skills/` 복사 (default No) + `~/.codex/config.toml` trust entry 등록 (default No). `registerTrustEntry` dead code 활성
- **AC6**: 9 Track × 5 CLI mode (claude/codex/opencode/both/all) E2E install 매트릭스 테스트 — 45 시나리오 모두 PASS
- **AC7**: package.json `version` ↔ `cli.ts VERSION` 일치. **fresh `npx -y github:...` first-run 검증**을 PR 머지 전 강제 (CI 또는 PR 체크리스트)

### 판정 절차

1. AC별 증거 = 파일 경로:라인 + 커밋 SHA + 실행 로그
2. **에이전트 자기주장 불가** — 모든 AC는 reviewer subagent (context: fork) 또는 자동화된 E2E 테스트로 검증
3. 무인 설치 + first-run 시뮬레이션 로그를 `docs/evals/cli-completeness-YYYY-MM-DD.md`에 기록

## 3. 결정 일람

### 3.1 포함 (In Scope)

| ID | 작업 | 근거 (Reviewer ID) | 우선순위 |
|----|------|---------------------|---------|
| **F1** | External plugin install 통합 모듈 — `claude plugin marketplace add` + `claude plugin install` + `npm install -g` + `npx skills add` 호출 추상화 | C1, C2, C3, C4 | P0 |
| **F2** | `--with-ecc` / `--with-prune` / `--with-tob` 옵션 실제 동작 — F1 호출 | C1~C3 | P0 |
| **F3** | Track 매트릭스 데이터 (32건) — bash L791~1067 → `templates/external-asset-map.tsv` 또는 TS 상수 | C4 | P0 |
| **F4** | F3 데이터를 install pipeline에서 read + Track별 분기 호출 | C4 | P0 |
| **F5** | Router 분기 — `update` / `add` / `reinstall` 액션별 다른 path. backup 자동 생성 (reinstall + update) | H1, H2 | P0 |
| **F6** | Update 모드 orphan prune + stale hook cleanup (bash 497-573 포팅) | H9 | P0 |
| **F7** | `.env.example` 자동 생성 (csr-supabase/full) + `.gitignore` `.env` 추가 | H5, H6 | P0 |
| **F8** | `.mcp-allowlist` 자동 생성 (모든 dev track) | H7 | P1 |
| **F9** | `.mcp.json` ADD_MODE 보존 — 기존 user 항목 + `_comment` 보존, invalid 시 백업 후 재생성 | H8 | P1 |
| **F10** | Codex `~/.codex/skills/` opt-in 설치 prompt + 실제 복사 | H3 | P1 |
| **F11** | Codex `~/.codex/config.toml` trust entry opt-in prompt + `registerTrustEntry` 호출 | H4 | P1 |
| **F12** | 9 Track × 5 CLI mode E2E install 매트릭스 테스트 — 45 시나리오 | AC6 | P1 |
| **F13** | First-run E2E 시뮬레이션 — fresh tempdir에서 `npm install --prefix=tmp file:.` 후 bin 호출, 옵션별 부작용 spy | AC7 | P1 |
| **F14** | package.json version 0.2.0 → 0.4.0 + cli.ts VERSION 동일 + Release tag 정합 | M3 | P1 |
| **F15** | `--gsd` 별칭 (별도) 구현 또는 README/USAGE에서 `--with-gsd`만 단일 표기 (별칭 미지원 명시) | M2 | P2 |
| **F16** | `validated.tracks` 반환 정정 + `defaultHarnessRoot` Windows 호환 (`fileURLToPath`) | L1, L2 | P2 |
| **F17** | OpenCode plugin 자산 매트릭스 — Claude/Codex track 외부 자산이 OpenCode에서도 동등하게 작동하는지 검증 + 차이점 ADR | M4 | P2 |
| **F18** | dead option 차단 테스트 — install spy mock으로 옵션 enable 시 부작용 발화 횟수 assertion | L3 | P1 |

### 3.2 제외 (Non-Goals)

- **외부 마켓플레이스 사라진 자산** — bash 시절 호출했으나 현재 더 이상 존재하지 않는 plugin은 ADR로 deprecation 명시 후 제거 (예시: 특정 vendor가 archived)
- **Phase 4+ 팀 협업 기능** — NORTH_STAR Phase 5
- **외부 사용자 영입 캠페인** — 본 SPEC은 어휘 완전성 + 첫 실행 성공률만. 마케팅/홍보 별도
- **새 Track 추가** — 9 Track 유지
- **Self-Improvement instinct → Rule 승격 자동화** — Phase 4
- **`~/.claude/` 글로벌 수정** — D16 영구 보호

### 3.3 DO NOT CHANGE

- `docs/NORTH_STAR.md` (방금 갱신 완료)
- `docs/SPEC.md` (Phase 1 Finalization)
- `docs/specs/codex-compat.md` + `docs/specs/opencode-compat.md` 본문
- `templates/codex/` + `src/codex/` 본 SPEC 외 영역 미수정 (단 `registerTrustEntry` 호출 추가는 H4 본 SPEC 범위)
- `~/.claude/`, `~/.codex/`, `~/.opencode/` 글로벌 (사용자 opt-in 후만 `~/.codex/skills/` + `~/.codex/config.toml` 수정)

### 3.4 판단 보류 (Open Questions)

| OQ | 상태 | 결정/근거 |
|----|------|-----------|
| **OQ1** 외부 plugin install 실패 시 정책 — abort vs warn-skip | **Open** | (a) abort 시 first-run 신뢰성 강화 / (b) warn-skip 시 partial 설치라도 진행. 1차 추천: warn + skip (사용자에게 명시적 보고 + 종료 시 누락 자산 목록 출력) |
| **OQ2** ECC marketplace 자체 sourcing — `affaan-m/everything-claude-code` 가 항상 유효한가 | **Open** | git tag 또는 fork pin? 1차 main branch + warn (drift 감지) |
| **OQ3** ToB plugin 사실 — `trailofbits/skills`가 현재 유효한 marketplace인가 | **Open** | Phase 1 시작 시 실측 후 결정. 무효 시 deprecation ADR |
| **OQ4** First-run E2E CI 매트릭스 환경 수 | **Open** | (a) ubuntu-latest + macos-latest × Node 20/22 (= 4) / (b) + Windows = 6. Windows는 path 호환성 문제 가능 (L2 참조) |
| **OQ5** version 0.4.0 vs 0.3.1 | **Open** | 본 SPEC 산출은 누락 fix이므로 patch (0.3.1) 적합. 단 외부 자산 32건 추가는 minor (0.4.0) 합당. 1차 추천: **0.4.0** |
| **OQ6** External asset map 형식 — TSV 외 데이터 / TS 상수 / JSON | **Open** | 1차 추천: TS 상수 (타입 안전 + 테스트 가능). bash era TSV는 데이터 단순할 때만 효과적 |

## 4. Phase 분해

각 Phase 종료 시 Self-Audit (P11) + reviewer subagent 검증 (context: fork) + AC 진척 표 갱신.

### Phase 1 — SPEC 확정 + 외부 자산 매트릭스 데이터화 (1일)

- F3, F14, F1 골격
- 산출: `templates/external-asset-map.{tsv|ts}`, `src/external-installer.ts` 인터페이스, `package.json` version bump, OQ1~OQ6 결정

### Phase 2 — `--with-*` 옵션 + ECC + ToB (1.5일)

- F2 (3 옵션), F1 (실제 호출 구현), F18 (dead option 차단 테스트)
- E2E: tooling + dev Track에서 `--with-ecc --with-prune --with-tob` 모두 호출 발화 + 산출물 검증

### Phase 3 — Track 매트릭스 32건 통합 (2일)

- F4 (Track별 분기 호출), F17 (OpenCode parity)
- E2E: 9 Track 각각 시도 + skipped 자산 명시 보고

### Phase 4 — Router 분기 + 환경 파일 (1.5일)

- F5 (add/update/reinstall 분기 + backup), F6 (orphan prune + stale hook), F7 (.env.example, .gitignore), F8 (.mcp-allowlist), F9 (.mcp.json ADD_MODE)
- E2E: 기존 install 위에 add → 보존 검증, update → backup + 정책 갱신 검증

### Phase 5 — Codex opt-in (0.5일)

- F10, F11
- E2E: `--cli=codex` 시 prompt 2종 발화 + 동의 시 글로벌 mutation 발생 + 거절 시 미수정

### Phase 6 — 매트릭스 E2E + first-run CI + Ship (1일)

- F12 (45 시나리오), F13 (first-run npx fresh fetch), F15, F16
- 사용자 1차 실측 검증 후 v0.4.0 ship

**총 예상**: ~7일 (병렬 고려 시 단축 가능). Phase 2/3은 직렬, Phase 4/5는 Phase 3 완료 후 병렬 가능.

## 5. 위험 & 완화

| Risk | 완화 |
|------|------|
| 외부 marketplace plugin이 더 이상 유효하지 않음 (`affaan-m/everything-claude-code` archived 등) | OQ2/OQ3 Phase 1 실측 + 무효 plugin은 deprecation ADR + 본 SPEC에서 제외 |
| 32건 외부 자산 호출 일부 실패로 부분 설치 발생 → "promise = implementation" 위반 | OQ1 결정에 따라 abort or warn-skip + 종료 보고 명확화. README도 "best-effort install" 표현 검토 |
| First-run CI 매트릭스가 너무 무거움 (시간/리소스) | OQ4에서 4 매트릭스로 시작. Windows는 후속 결정. CI cache 활용 |
| `~/.codex/` opt-in 시 사용자 동의 없이 글로벌 수정 위험 | F11 prompt를 명시 + default No + 동의 후만 `registerTrustEntry` 호출. 테스트로 default No 보장 |
| Test 매트릭스 폭증으로 CI 시간 ↑ | E2E는 mock spy 위주, 실제 plugin install은 매트릭스 1~2건만 |

## 6. Self-Audit Hooks

각 Phase 완료 시 CLAUDE.md P11 Self-Audit 5항목 실행. 결과 `docs/evals/cli-completeness-phase-<N>-YYYY-MM-DD.md`에 기록. **이번엔 reviewer subagent (context: fork)로 검증 강제** — 사용자 실측에서 반복 발견된 누락 재발 방지.

## 7. Verification Strategy (이번엔 다르게)

이전 ship에서 누락 검증의 root cause = "node dist/index.js 로컬 빌드 + 플래그 모드만 검증". 본 SPEC은 다음 강제:

1. **fresh npx fetch first-run 검증** — 매 PR마다 (CI 또는 수동 PR 체크리스트)
2. **인터랙티브 default action 검증** — TTY mock으로 자동화
3. **옵션별 부작용 spy 테스트** — dead option 차단
4. **README ↔ manifest cross-check** — grep으로 광고 자산이 실제 manifest/external-asset-map에 있는지 자동 검증
5. **9 Track × 5 CLI mode 매트릭스** — 45 시나리오 자동화

## 8. Sprint Contract

본 SPEC 사용자 승인 시 Status: Draft → Accepted. Phase 1~6 자동 진행하되 다음 시점에 인간 게이트:
- SPEC 승인
- Phase 1 종료 (OQ1~OQ6 결정 검토)
- Phase 3 종료 (Track 매트릭스 호출 발화 검증)
- Phase 6 종료 (Ship 직전 first-run 결과 검토)

---

## Changelog

- 2026-04-25: 초안 작성. 근거 — Reviewer 전수 조사 보고서 + 사용자 실측 누락 발견 + NORTH_STAR.md vibe coding 정의 갱신.
- 2026-07-20 (v26.132.0, ADR-047): **F5·F6 동작 수정** — 사용자 보고("재설치가 rules·hooks 를 덮친다")로
  드러난 결함 반영.
  - **F5**: "backup 자동 생성 (reinstall + update)" 는 `.claude/` **통짜** 백업만 가리켰고,
    `add` 모드(기존 설치 위 `install`)에는 그것조차 없었다. 이제 정책 파일
    (rules/agents/commands/hooks)은 **모드와 무관하게** 파일 단위 소유자 판정을 받는다 —
    사용자가 고쳤으면 `.backup-<stamp>`, 안 고쳤으면 조용히 덮어쓴다. 판정 기준선은
    install log 의 `policyFiles`(설치 시점 sha256).
  - **F6**: "orphan prune" 이 무조건 삭제였다 → **소유가 증명될 때만** 삭제한다. 기준선에 없는
    파일은 사용자가 만든 것이므로 유지한다. 기록이 없는 레거시 설치에서는 prune 이 1 사이클
    쉬어간다 (사용자 파일 삭제 위험 0 과의 트레이드오프).
  - 근본 원인: ADR-046 의 결정이 자산 종류와 무관한데 구현은 `.claude/skills/` 에만 적용됐다.
    상세·대안·검증은 `docs/decisions/ADR-047-policy-file-ownership.md`.

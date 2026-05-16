# SPEC: v26.54.0 — All-in-one installer screen

> **Status**: Draft (2026-05-16)
> **Predecessor**: v26.53.0 (5-step wizard, 2-tier navigator)
> **Trigger**: 사용자 피드백 — "전체 단계가 명확히 보이지 않는다 / ESC 시 strikethrough / 한 화면에서 무엇이 설치되는지 보고 싶다".

---

## 1. Objective

5-step wizard → **3-step wizard**. 4번 항목 (Options + External Assets) 을 **1 화면 group multiselect** 로 통합. ESC = silent back.

## 2. AC

- **AC1**: Step 수 5 → 3 (tracks → cli → install-targets → confirm 흡수)
- **AC2**: Install-targets step 은 **단일 group multiselect**. EXTERNAL_ASSETS (32+) + OPTION_DEFS 의 togglable build option (9개) 모두 한 화면에 카테고리 그룹 헤더로 표시
- **AC3**: Track preset 추천 자산 + 추천 옵션 (조건 만족) 이 **default checked**
- **AC4**: ESC at any wizard step ≠ cancel message. Silent back. Step 1 ESC = exit (이때만 메시지)
- **AC5**: Step indicator — "Step N/3" 표시 (intro 메시지 또는 prompt message prefix)
- **AC6**: confirm 은 별도 step 이 아니라 install-targets ENTER 직후 summary + confirm 1 prompt 로 압축
- **AC7**: 사용자 unchecked 추천 → `forceExclude`, 추가 checked → `forceInclude` (기존 userOverride 모델 유지)
- **AC8**: Codex Trust / Codex Skills (D16) 는 본 화면 노출 X — 별도 처리 (현재와 동일, CLI 자동 또는 별도 flag)
- **AC9**: 회귀 0 + 신규 test (interactive.test.ts)
- **AC10**: branch coverage 88% 유지 또는 갱신 후 commit

## 3. UI

### Step 1/3 — Tracks
```
Select Track(s) (Space to toggle, Enter to confirm):
[ ] fullstack
[x] tooling
[ ] data
...
```

### Step 2/3 — Target CLI
```
Target CLI(s) (Space to toggle, Enter to confirm):
[x] Claude Code
[ ] Codex (OpenAI)
[ ] OpenCode
```

### Step 3/3 — What will be installed
```
✓ = preset 추천 또는 옵션 default. Space toggle, Enter to confirm. ESC to go back.

━━━ Frontend ━━━
  [x] shadcn-ui                  [vercel-labs]      shadcn UI components
  [ ] tailwindcss-skill          [3rd-party]        Tailwind 4 utility classes
━━━ Backend ━━━
  [x] fastapi-skill              [obra]             FastAPI patterns
━━━ Data ━━━
  ...
━━━ Dev Tools ━━━
  [ ] karpathy-coder hook        [alirezarezvani]   Write|Edit pre-commit
  [ ] Trail of Bits plugin       [trailofbits]      security review
━━━ Workflow ━━━
  [x] uzys-harness               [본 프로젝트]      /uzys:* 6-Gate
  [ ] addy-agent-skills          [addyosmani]       /spec /plan slash
  [ ] superpowers                [obra/anthropics]  agentic skills
  [ ] GSD orchestrator           [3rd-party]        large project coord
━━━ ECC Suite ━━━
  [ ] ECC plugin                 [affaan-m]
  [ ] Prune (--with-prune)       [본 프로젝트]      implies --with-ecc
━━━ Build Options ━━━
  [ ] Tauri desktop rule         [본 프로젝트]      --with-tauri
```

→ ENTER → summary + confirm prompt → install

### ESC 동작
| Step | ESC | 결과 |
|---|---|---|
| 1 (tracks) | exit | "Cancelled." 메시지 1회 |
| 2 (cli) | back to 1 | **silent** (메시지 없음) |
| 3 (install-targets) | back to 2 | silent |
| confirm | back to 3 | silent |

## 4. 데이터 모델 변경

`InstallTargetId` = `option:<keyof OptionFlags>` | `asset:<external-asset-id>`. Prompt 결과를 두 source 로 분리해 OptionFlags + userOverride 로 변환.

```ts
function splitTargets(selected: ReadonlyArray<string>): {
  optionKeys: Array<keyof OptionFlags>;
  assetIds: Array<string>;
}
```

## 5. Non-Goals
- ExternalAsset / OptionFlags 의 condition/source/category 메타 변경 없음
- CLI flag (`--with` / `--without` / `--with-*` 옵션) 변경 없음
- D16 Codex 글로벌 자산 처리 변경 없음
- Update / Add / Reinstall mode 의 router 변경 없음

## 6. 위험

- **한 화면 50+ 항목** → 스크롤. 카테고리 헤더로 시각 그룹화로 완화. clack groupMultiselect 가 카테고리 단위 hint 처리
- **Track 변경 시 reset** → 기존 v26.50 reset 정책 유지. Step 1 back → Step 3 selections reset
- **prompts.ts 의 selectOptionKeys / selectExternalAssets / selectAssetCategory / selectAssetsInCategory 4 함수가 deprecated** → 제거 (호환 불필요, 외부 caller X)

## 7. Changelog
- 2026-05-16: 초안 (사용자 피드백 기반).

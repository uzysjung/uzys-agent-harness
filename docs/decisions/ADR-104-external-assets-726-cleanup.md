# ADR-104: 외부 자산 5종 정리 — 삭제 3 · 교체 2, 기존 설치본은 남기고 update 화면이 자산마다 말한다

- Status: Proposed
- Date: 2026-10-11
- PR: (머지 때 채운다)
- Issue: #726
- Amends: ADR-063(product-skills — "카탈로그 삭제 기각, opt-in 으로 존치"를 삭제로) · ADR-093(퇴역 규율은 그대로 따르되, update 가 플러그인 퇴역분도 말하게 넓힌다)

## Context

#726 조사(`docs/research/mcp-skills-freshness-2026-10-11/726-external-skills.md`)가 외부 자산 14종을 이 리포의 판정 축 —
① 설치자가 AI 코딩 도구로 개발을 더 잘하게 하는가 ② 지시문을 넘는 도구·도메인 지식을 주는가 ③ 상류가 살아 있고 더 공신력 있는
대안이 없는가 — 으로 판정했다. 사용자 결정(2026-10-11, 이슈 #726 댓글): 삭제 product-skills · agentmemory · revealjs / 교체
trailofbits-skills → claude-security, web-video-presentation → hyperframes / 보류 marp-slide · finance-skills.

남는 질문은 **이미 그 자산을 깐 설치본**이다. 지금 코드에서 카탈로그에서 빠진 자산은 update 가 skill 방식이면 "카탈로그에 없어 갱신
대상이 아니다" 한 줄로 뭉쳐 말하고, plugin 방식이면 **아무 말도 하지 않는다**. 위저드는 기록에 남은 그 id 를 행 없이 선택에 실어
확인 화면이 "selected" · "+User added" 로 적는다 — 실제로는 아무것도 깔지 않는데.

## Decision

1. **카탈로그 52 → 49.** product-skills · agentmemory · revealjs · trailofbits-skills · web-video-presentation 을 빼고
   claude-security · hyperframes 를 더한다. 수의 SSOT 는 `EXTERNAL_ASSETS.length` 이고 사람이 읽는 수는 COMPATIBILITY 서문이다.
2. 두 교체본은 `anthropics/claude-plugins-official` 마켓플레이스 플러그인 · tier `official` · opt-in:
   `claude-security@claude-plugins-official` · `hyperframes@claude-plugins-official`(소스 = sha 고정 `heygen-com/hyperframes`).
3. **빠진 자산은 기존 설치본에서 지우지 않는다**(ADR-093 · ADR-063 "이미 설치된 plugin 은 사용자 소유물"). `update` 에는 확인
   단계가 없고, 다섯 자산 모두 설치자가 골라서 깐 것이며, 스킬 자리에는 설치자 파일이 섞인다(ADR-046).
4. **update 가 자산마다 한 줄로 말한다.** `REMOVED_CATALOG_ASSETS`(`src/external-assets.ts`, 교체는 `replacedBy`)에 든 id 를
   **설치 기록에서만** 골라(디스크 존재 ≠ 소유, ADR-096) — 빠졌다/무엇으로 바뀌었다 · 깐 것은 그대로 남는다(skill 이면 update 가 더는
   갱신하지 않는다) · 새 것은 `install --with <새 id>`(대체가 이 설치본의 CLI 에 안 닿으면 그 사실) · 옛 것은 `uninstall --only <id>`.
   일반 "카탈로그에 없어" 줄에는 그 id 를 넣지 않는다. `excluded` 여부와 무관하게 말하고, `excludedStillThere` 줄(`--with <id>` 를
   권한다 — 이제 거절되는 플래그)에서는 뺀다. `uninstall --only <옛 id>` 는 기록의 `detail` 로 되돌리므로 지금 그대로 동작한다.
5. **자동 이행하지 않는다** — 옛 id 기록이 있어도 update 는 새 자산을 깔지 않는다. 고른 적 없는 자산이 update 로 깔리면 안 되고
   (ADR-078), claude-security 는 `git push` 에 훅을 걸고 스캔이 시간 · 토큰을 쓴다.
6. **위저드 확인 화면**: `computeUserOverride` 가 forceInclude 를 카탈로그 id 로 거른다. 선택 자체는 거르지 않아
   `classifyUpdateIntent` 가 기록된 자산을 그대로 찾는다(아무것도 안 바꾼 Update 가 add 로 오판되지 않는다). ADR-093 퇴역분에도 같이 적용된다.

## Alternatives (기각)

- **update 가 새 자산을 자동 설치** — update 는 기록에 있는 것만 다룬다(ADR-078). 위 5.
- **update 가 옛 자산을 제거** — 확인 없는 삭제. 위 3.
- **옛 id 를 유지하고 method 만 새 플러그인으로** — `trailofbits-skills` 라는 이름으로 Anthropic 플러그인을 까는 거짓 이름이 되고,
  기록의 `detail.pluginId` 가 옛 값이라 uninstall 이 새 것을 못 지운다.
- **`RETIRED_SKILL_IDS` 재사용** — 그 목록은 **디스크**에서 이름을 찾는다. 설치자가 하네스 밖에서 직접 깐 `revealjs` 도 "은퇴 · 지워도
  된다"로 잡힌다. 그 목록은 이름이 우리 것인 번들 스킬용으로 남긴다.
- **hyperframes 를 skill 방식으로(4-CLI)** — 기술적으로는 된다: `method: { kind: "skill", source: "heygen-com/hyperframes" }`
  (`--skill` 없음)이면 `npx skills add --yes` 가 상류 21종을 4-CLI 에 `--copy` 로 깔고 #573 파일 기록 · `uninstall --only` 도 그대로
  받는다(전례 jakubkrehel-skills). 기각 이유는 설치 뒤다: standalone 모드의 상류 라우터는 워크플로 진입 전에
  `npx hyperframes skills update <workflow>` 를, 스캐폴드 때 `npx hyperframes init` 을 돌리고 bare `skills update` 는 미게시 스킬을
  prune 한다 — **상류 CLI 가 런타임에 같은 스킬 디렉터리를 다시 쓰고 지운다.** 하네스 기록의 sha 와 어긋나고 새 파일은 기록 밖이며,
  update 의 refresh 와 두 주체가 한 자리를 쓴다. plugin 모드는 상류 문서(`references/plugin-installation.md`)가 그 런타임 설치를
  스스로 금하고, 상류 marketplace 가 plugin 을 "Recommended" 로 둔다.
- **hyperframes 를 HeyGen 자체 마켓플레이스(`hyperframes@hyperframes`)로** — 최신을 더 빨리 받지만, Anthropic 공식 마켓플레이스는
  sha 를 고정해 검토된 판만 내보내고 tier `official` 정의와 맞는다. claude-security 와 `marketplace add` 가 한 번이다.

## Consequences

- 새 설치자의 위저드 · `--with` 목록이 49종이 된다. `--with <빠진 id>` 는 기존처럼 `[WARN] Unknown asset id … Skipping` 이다.
- **Codex · OpenCode · Antigravity 만 쓰는 새 설치자에게는 영상형 발표 자산이 없다**(web-video-presentation 은 4-CLI 였다). 위저드는
  이미 "outside reach — not installed" 로 표시하고, 기존 설치본의 web-video-presentation 파일은 남는다. codex 전용 설치본의 update
  줄은 "hyperframes 는 Claude 전용이라 이 설치본의 CLI 에는 깔리지 않는다"를 말한다.
- 기록에 빠진 id 가 남아 있는 한 update 마다 같은 줄이 나온다 — `uninstall --only <id>` 를 돌리면 기록에서 빠져 멈춘다.
- 안내 줄은 update 화면에만 낸다. install 재실행 화면에는 내지 않는다.
- ADR-093 퇴역 플러그인(superpowers 등)은 이 표에 넣지 않아 계속 update 에서 무음이다(이번 결정 범위 밖).
- hyperframes 는 `source: heygen-com` 이지만 tier 가 official 이라 `trust-tier-drift` 의 월간 star 감시 밖이다. 상류 개선은 마켓플레이스
  sha 갱신까지 늦게 온다.
- 실 claude 로 두 pluginId 가 깔리는지 · 이행이 기록대로 되는지는 일회용 컨테이너로 확인한다(설계 `docs/plans/v26.167.0-skills-design.md` §7).

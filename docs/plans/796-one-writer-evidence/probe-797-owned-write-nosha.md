# #797 탐침 — owned-write 가 체크섬 없는 옛 기록 파일을 어떻게 분류하나 (2026-10-13, main @ 601c227)

임시 vitest 파일(tests/__d796_probe__/…, 실행 뒤 삭제)로 `createOwnedWriter(dir, new Map(), { owned: () => true, refreshOnly: true })` 에
디스크 "old harness body" · 쓰려는 내용 "new harness body" 를 넣었다.

PROBE   {"wrote":true,"backedUp":[".agents/skills/x/SKILL.md"],"displaced":[],"files":[{"path":".agents/skills/x/SKILL.md","sha256":"bb77…"}],"backups":1}
CONTROL {"backedUp":[],"backups":0}   ← 기준선 sha 가 디스크와 같을 때(안 고침) — 백업 없이 덮는다

판정: 코드 수준에서는 이슈 #797 의 의심이 맞다 — `owned()` 가 참이고 기준선에 sha 가 없는(= `no-sha`) 파일은 `backedUp`("편집" 묶음)에 들어간다.
화면 수준: update 는 `checksumOnRecord(logAtStart)` 가 `externalBackedUp` 을 다시 갈라 "no checksum on record" 행으로 낸다(install-render.ts:1013·1372).
install(add · reinstall)은 외부 CLI 백업을 `backup <경로>` 중립 행으로만 낸다(install-render.ts:1491-1495) — "edited" 라 부르는 곳이 없다.
→ 설치자가 보는 문구는 지금도 틀리지 않는다. 틀린 것은 **분류가 두 곳(owned-write 의 backedUp · 렌더의 재분류)에서 따로 산다**는 구조다.

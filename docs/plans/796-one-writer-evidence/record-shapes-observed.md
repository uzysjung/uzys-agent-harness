# 옛 npm 판 실설치 기록 모양 — 실측 (출처: docs/plans/v26.170.0-design-evidence/container/*/record-0.json, 2026-10-12 컨테이너 실설치)

| 판 | 기록 필드 | 비고 |
|---|---|---|
| 26.100.0 | assets · installedAt · schemaVersion · scope · spec{tracks,cli} · templates{claudeDir,codexDir,rootClaudeMd} | **스캔 필드 없음 · rootFiles 없음** (S0) |
| 26.125.0 | + rootFiles(2: `.mcp.json` created · `.mcp-allowlist` created) | 스캔 필드 없음 (S1) |
| 26.132.0 | + policyFiles(23) · skillFiles(35) | externalFiles 없음 (S3) |
| 26.140.0 | + externalFiles(11) | (S4) |
| 26.150.0 | policyFiles 18 · skillFiles 51 · externalFiles 14 · rootFiles 1 · rootClaudeMd = CLAUDE-uzys-harness.md | (S4) |
| 26.150.0 → 현행(v26.170) update 1회 뒤 (record-2.json) | policyFiles 11 · skillFiles 41 · externalFiles 50 · rootFiles 3(displaced 2 · created 1) · portions 9 · **records 없음** | update 는 `records:"writer"` 를 적지 않는다(현행 동작 확인) |

S2(v26.126–131: skillFiles 만 있고 policyFiles 없음)는 컨테이너 표본에 없다 — CHANGELOG v26.126.0 / v26.132.0 로 모양을 유도했다.
S5(writer: records:"writer" · portions · excluded)는 현행 install 이 쓴다(tests/install-writes.test.ts:258,282 가 단언).

record-2 의 rootFiles:
- `.claude/agents/data-analyst.md` displaced(notes []) — 기록 트랙(tooling) 밖 자리 · 내용이 하네스 판과 같아 그대로 둠(Q3)
- `.claude/agents/strategist.md` displaced(notes [backup]) — 트랙 밖 자리 · 내용 다름 → 백업 + 하네스 판

# ADR-011: uzys-harness 6-Gate workflow opt-in (BREAKING)

- **Status**: Superseded by ADR-023 (2026-06-26 — 6-Gate workflow removed entirely)
- **Date**: 2026-05-14
- **PR**: #70 (v26.44.0)
- **Supersedes**: 없음
- **Related**: ADR-009 (addy opt-in 패턴 정렬), ADR-010 (Category-based pivot)

## Context

본 harness 자체 6-Gate 워크플로우 (`/uzys:spec`, `/uzys:plan`, `/uzys:build`, `/uzys:test`, `/uzys:review`, `/uzys:ship`, `/uzys:auto`) 는 v0.x 부터 **dev 트랙 자동 설치**.

- `manifest.ts` 의 `commands/uzys/*.md` entry condition = `applies: dev`
- 7 slash command (.md) 파일이 `.claude/commands/uzys/` 로 자동 복사

ADR-010 Category-based pivot 의 핵심 결정 중 하나는 "본 harness 가 자기 자신을 default 강제 push 하지 않는 중립 인스톨러" 포지셔닝.

문제:
1. **ADR-009 와 패턴 모순**: addy-agent-skills 는 opt-in 인데 uzys-harness 는 강제. 본 harness 자체가 외부 plugin 보다 더 invasive 한 셈.
2. **Workflow 카테고리 선택권 차단**: 사용자가 superpowers / addy 를 메인 워크플로우로 쓰고 싶어도 `/uzys:*` 가 같이 깔림.
3. **Track 무관 사용 케이스**: executive 트랙 사용자가 `/uzys:spec` 을 의식적으로 쓰고 싶을 수 있음 — 현 로직은 dev 트랙만 자동 설치 → 가능성 차단.

## Decision

`uzys-harness` 6-Gate slash commands 를 **opt-in** 으로 전환. **Track 무관**.

### 변경

```ts
// types.ts
export interface OptionFlags {
  ...
  withUzysHarness: boolean;  // default false
}

// manifest.ts
for (const cmd of UZYS_COMMANDS) {
  m.push({
    source: `commands/uzys/${cmd}.md`,
    target: `.claude/commands/uzys/${cmd}.md`,
    applies: (s) => Boolean(s.withUzysHarness),  // 이전: dev
  });
}
```

설치 방법:
- CLI: `--with-uzys-harness`
- Interactive: 옵션 체크박스에서 'uzys-harness 6-Gate workflow' 선택

### Track 무관 (Resolved as R7)

기존 `dev` predicate 와 달리 **트랙 조건 없음**. executive/project-management/growth-marketing 트랙에도 `--with-uzys-harness` 명시 시 `/uzys:*` 설치.

사용자 명시 의도가 트랙 분류보다 우선.

## Alternatives

- **(a) `dev && withUzysHarness` 조합** (트랙+옵션 둘 다 충족). 기각: executive 트랙 사용자가 6-Gate 못 씀 = 정당화 어려움.
- **(b) 자동 설치 유지 + `--no-uzys-harness` opt-out**. 기각: ADR-009 (addy opt-in) 와 패턴 불일치. 외부 plugin 보다 자체 워크플로우가 더 invasive 한 상태 유지.
- **(c) `/uzys:*` 를 별도 npx package 로 분리** (e.g., `@uzys/workflow-commands`). 기각: 과도한 분리. 본 harness 안에서 opt-in 으로 충분.

## Consequences

### 긍정
- ADR-009/010 과 패턴 일관 — 모든 외부/대안 워크플로우가 동일 선상.
- 본 harness 가 중립 인스톨러 — 사용자 자율성 ↑.
- Track 무관 — 더 넓은 사용 케이스 (executive 도 6-Gate 사용 가능).

### 부정 (BREAKING)
- 기존 dev 트랙 사용자가 다음 install 시 `/uzys:spec` 등 사라짐.
- Migration 1줄 (`--with-uzys-harness`) 필요.
- "왜 `/uzys:spec` 안 되지?" 혼란 가능.

### 완화
- Release notes 명시 (https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.44.0).
- CLI help 메시지에 "기존 동작 복원: --with-uzys-harness" 명시 (review LOW 1 반영).
- Interactive 옵션 라벨에 "v26.44.0 opt-in" 명시.
- README/README.ko 30-second start 섹션에 BREAKING 안내.

## Notes

- `manifest.ts` 의 `applies` 가 `dev` predicate → `(s) => Boolean(s.withUzysHarness)` 변경. AssetSpec 에 `withUzysHarness?` 필드 추가.
- `installer.ts` 에서 `spec.options.withUzysHarness` 를 `manifestSpec.withUzysHarness` 로 복사. dual-guard 패턴 (withTauri 와 동일) — 동기화 의무 주석 명시 (review MEDIUM 1 반영).
- Code reviewer SOD 검증 통과 (CRITICAL 0, HIGH/MEDIUM/LOW 5건 해소).

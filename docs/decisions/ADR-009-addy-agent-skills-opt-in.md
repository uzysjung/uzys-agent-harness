# ADR-009: addy-agent-skills opt-in 전환 (BREAKING)

- **Status**: Accepted
- **Date**: 2026-05-13
- **PR**: #68 (v26.42.0)
- **Supersedes**: 없음
- **Related**: ADR-010 (Category-based pivot), ADR-011 (uzys-harness opt-in)

## Context

`addyosmani/agent-skills` (external plugin) 는 v0.x 부터 dev 트랙(`csr-*/ssr-*/data/tooling/full`) **강제 자동 설치** 자산이었다 (`external-assets.ts` condition: `has-dev-track`). 사용자가 끄는 방법이 없었다.

문제:
1. 외부 plugin 강제 설치 = uzys-claude-harness 사용자가 의식하지 않은 채 3rd-party 자산 받음.
2. addy 의 slash commands (`/spec`, `/plan`, `/build`, `/test`, `/review`, `/ship`, `/code-simplify`) 는 namespace 가 없음 — 본 harness 의 `/uzys:*` 과 짝지어 있을 때 사용자가 어느 출처인지 혼란.
3. GSD orchestrator 는 이미 `withGsd` opt-in 패턴. addy 도 동일 선상 정렬이 자연스러움.

## Decision

`addy-agent-skills` 를 **opt-in** 으로 전환. GSD 와 동일한 `OptionFlags.withAddyAgentSkills` 패턴.

```ts
// external-assets.ts
{
  id: "addy-agent-skills",
  condition: { kind: "option", flag: "withAddyAgentSkills" },  // 이전: has-dev-track
  ...
}
```

설치 방법:
- CLI: `--with-addy-agent-skills`
- Interactive: 옵션 체크박스에서 'addy agent-skills' 선택

## Alternatives

- **(a) Default ON 유지 + `--no-addy` flag 추가** (opt-out 패턴). 기각: GSD/Tauri/ECC 와 패턴 불일치, 외부 plugin 강제 설치 문제 미해소.
- **(b) addy 자산 완전 제거.** 기각: 사용자 중 일부가 의식적으로 원할 수 있음. 제거가 아닌 명시 opt-in이 적절.
- **(c) addy 자체를 본 harness 의 default workflow 로 보존하되 `/uzys:*` 와 namespace 분리.** 기각: 외부 plugin 의존성은 사용자 명시 동의가 원칙.

## Consequences

### 긍정
- 사용자가 의식적으로 선택 — 기대치 명확.
- 외부 plugin 의존성 가시화.
- `/uzys:*` (본 harness) vs `/spec` (addy) namespace 분리 명확.
- GSD/Tauri 등과 패턴 일관성.

### 부정 (BREAKING)
- 기존 dev 트랙 사용자가 다음 install 시 `/spec /plan` 등이 사라짐 → 혼란 가능.
- Migration 1줄 (`--with-addy-agent-skills`) 필요.

### 완화
- Release notes 명시 (https://github.com/uzysjung/uzys-claude-harness/releases/tag/v26.42.0).
- CLI help 메시지에 BREAKING 안내.
- 다음 PR (#70) 에서 `withUzysHarness` opt-in 도 같은 패턴으로 정렬 (사용자 한 번에 학습).

## Notes

이 ADR 은 PR #68 머지 (2026-05-13) 후 사후 작성됨. change-management.md "변경 후 ADR 기록" 규약 따라 보존.

6-gate 개발 워크플로우 적용:

```
Define(/uzys:spec) -> Plan(/uzys:plan) -> Build(/uzys:build) -> Verify(/uzys:test) -> Review(/uzys:review) -> Ship(/uzys:ship)
```

- 각 게이트를 순서대로 통과해야 다음 단계 진행 가능.
- Hotfix 단축: Build -> Verify -> Ship (긴급 수정에 한함).
- 탐색적 분석(EDA)은 Build 게이트에서 노트북 기반 진행 허용.

```
Define(/uzys:spec) → Plan(/uzys:plan) → Build(/uzys:build) → Verify(/uzys:test) → Review(/uzys:review) → Ship(/uzys:ship)
```

각 단계는 `.claude/hooks/gate-check.sh`로 강제. 이전 단계 미완료 시 다음 단계 실행 차단.

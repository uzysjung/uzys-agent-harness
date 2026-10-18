# #513 1단계 — 출처 목록 (확인일 2026-10-18)

설계 문서 `docs/plans/513-effect-eval-design.md` §1 이 인용하는 출처. 확인 방법 = WebFetch 로 본문을 읽었거나(○) 저장소를 받아 파일을 열었다(●). 검색 결과 요약만 본 것은 (△)로 표시했고 설계의 근거로 쓰지 않았다.

| # | 주제 | URL | 방법 | 비고 |
|---|---|---|---|---|
| S1 | DeepSWE 저장소 README · 과제 형식 · Pier 실행법 | https://github.com/datacurve-ai/deep-swe | ○ ● | 클론 commit `0b9fabbb` (2026-08-26). `tasks/` 113 + PROVENANCE · README |
| S2 | DeepSWE v1.1 블로그 (채점 방식 · 모델별 평균 비용) | https://deepswe.datacurve.ai/blog/deepswe-v1-1 | ○ | 글 2026-06-14, 데이터 갱신 2026-09-22 |
| S3 | Pier (Harbor 포크) 저장소 | https://github.com/datacurve-ai/pier | ○ | 에이전트 목록 · `agent.env` · 네트워크 allowlist |
| S4 | Pier PyPI | https://pypi.org/project/datacurve-pier/ | ○ | 0.3.1 (2026-08-11), Python ≥3.12 |
| S5 | Pier `claude-code` 에이전트 소스 | `~/.local/share/uv/tools/datacurve-pier/.../pier/agents/installed/claude_code.py` (0.3.1 설치본) | ● | 실행 명령 · `--effort` kwarg · `ANTHROPIC_BASE_URL` allowlist · `CLAUDE_CONFIG_DIR` |
| S6 | Terminal-Bench 4.0 공지 | https://www.tbench.ai/news/terminal-bench-4-0 | ○ | 8시간 타임아웃 · `harbor run -d terminal-bench/terminal-bench@4.0.0` |
| S7 | Terminal-Bench 실행 가이드 | https://www.tbench.ai/run | ○ | GPU 과제 존재 · Modal 권장 · `-a claude-code -k 5` |
| S8 | Terminal-Bench 저장소 (task.toml 전수) | https://github.com/harbor-framework/terminal-bench | ○ ● | sparse clone commit `2e29ca91` (2026-10-15). 66 과제 · GPU 3 |
| S9 | Terminal-Bench 4.0 과제 수 (교차) | https://snorkel.ai/leaderboard/terminal-bench-4-0/ | △ | 66 (S8 실측과 일치) |
| S10 | Harbor 저장소 | https://github.com/laude-institute/harbor | ○ | Apache-2.0 · 에이전트 예시 |
| S11 | Harbor 문서 — run flags | https://docs.harborframework.com/jobs/run-a-job | ○ | `-p -d -i -x -l -k -n -e -o --ak --effort` |
| S12 | Harbor 문서 — 과제 형식 | https://docs.harborframework.com/tasks/overview | ○ | `reward.txt`/`reward.json` · docker-compose 지원 |
| S13 | SWE-Atlas-QnA 데이터셋 카드 | https://huggingface.co/datasets/ScaleAI/SWE-Atlas-QnA | ○ | 124 과제 · 루브릭 · LLM 채점(Opus 4.5) · 코드 변경 시 실패 |
| S14 | SWE-Atlas-QnA 메타 (라이선스 필드) | https://huggingface.co/api/datasets/ScaleAI/SWE-Atlas-QnA | ○ | license 태그 없음 · gated=false · 2026-03-31 |
| S15 | SWE-Atlas 저장소 (harbor 판) | https://github.com/scaleapi/SWE-Atlas | ○ ● | Apache-2.0 · `run_config/oracle.sh` · claude-code 2.1.293 핀 · Modal 권장 · `data/qa` 124 |
| S16 | Claude Code — 비대화 실행 | https://code.claude.com/docs/en/headless | ○ | `-p` · `--bare` · `--output-format json` · `total_cost_usd` · `--permission-prompts none` |
| S17 | Claude Code — CLI 레퍼런스 | https://code.claude.com/docs/en/cli-reference | ○ | `--effort` · `--max-budget-usd` · `--max-turns` · `--model` · `--permission-mode` · `--no-session-persistence` |
| S18 | Claude Code — 모델 · effort | https://code.claude.com/docs/en/model-config | ○ | 별칭→모델 · effort 지원표 · 기본 effort · 폴백 |
| S19 | Claude Code — 환경변수 | https://code.claude.com/docs/en/env-vars | ○ | `CLAUDE_CODE_EFFORT_LEVEL` · `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` · `DISABLE_AUTOUPDATER` · `CLAUDE_CONFIG_DIR` · `ANTHROPIC_AUTH_TOKEN` |
| S20 | Claude Code — 설정 우선순위 | https://code.claude.com/docs/en/settings | ○ | managed > `--settings` > local > project > user |
| S21 | Claude Code — 설치 · 플랫폼 | https://code.claude.com/docs/en/setup | ○ | linux-arm64 지원 · npm 핀 · `DISABLE_AUTOUPDATER` |
| S22 | Agent SDK — 비용 집계 | https://code.claude.com/docs/en/agent-sdk/cost-tracking | ○ | `total_cost_usd` 는 클라이언트 추정 · `modelUsage` 가 서브에이전트 포함 · `usage` 는 미포함 |
| S23 | Anthropic 가격표 | https://platform.claude.com/docs/en/about-claude/pricing | ○ | Opus 5.5 $4/$20 · Sonnet 5.5 $2/$10 · Fable 5.1 $10/$50 · Haiku 5.5 $0.10/$0.50 |
| S24 | Anthropic — 에이전트 평가 가이드 | https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents | ○ | 2026-01-09. 결과 채점 · pass@k vs pass^k · 다중 시행 |
| S25 | Z.ai GLM Coding Plan 개요 | https://docs.z.ai/devpack/overview | ○ | 티어별 5시간·주간 크레딧 · 크레딧 공식 · 모델 · 오프피크 50% |
| S26 | Z.ai — Claude Code 연결 | https://docs.z.ai/devpack/tool/claude | ○ | `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic` · `ANTHROPIC_AUTH_TOKEN` · `ANTHROPIC_DEFAULT_*_MODEL` · `API_TIMEOUT_MS` · Claude Code 2.0.14 로 검증했다고 적힘 |
| S27 | Z.ai — 사용 정책 | https://docs.z.ai/devpack/usage-policy | ○ | 지원 도구 안에서만 · 동시성 Max>Pro>Lite · 위반 시 제한 |
| S28 | Z.ai — FAQ | https://docs.z.ai/devpack/faq | ○ | 모델 2종 · 한도 소진 시 5시간 대기 · 오류 1113 |
| S29 | Z.ai — 지원 도구 목록 | https://docs.z.ai/devpack/tool/others | ○ | Claude Code 는 공식 지원 도구 |
| S30 | Z.ai — GLM-5.3 모델 문서 | https://docs.z.ai/guides/llm/glm-5.3 | ○ | `thinking.type=enabled` 만 · `reasoning_effort` low/high/max 기본 max · Anthropic 호환 엔드포인트 |
| S31 | Z.ai 한도 (프롬프트 수 단위) | 검색 요약 (docs.z.ai/devpack/overview 인용) | △ | "Lite ~80 프롬프트/5h" 류 — S25 본문에는 크레딧만 있어 **미확인**으로 둔다 |
| S32 | npm 레지스트리 — Claude Code 최신 | `npm view @anthropic-ai/claude-code version time` | ● | 2.1.302 (2026-10-16) |
| S33 | npm 레지스트리 — 하네스 최신 | `npm view @uzysjung/agent-harness version` | ● | 26.174.0 |

실측 산출물은 `feasibility/`(채점기 대조 · 자원표 · 라우팅 스모크), 실행 골격은 `glm-container/` · `pier-agent-b.py` · `run-pilot.sh`.

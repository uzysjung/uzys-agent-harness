# #513 실험 설계 재검증(2차) — **BLOCK (BLOCKER 7건 · NOTE 9건)**

- 검증자: design-verifier (읽기 전용, 2026-10-18)
- 대상: `docs/plans/513-effect-eval-design.md` @ `6cd46b0` (`feat/513-effect-eval`) — 범위는 바뀐 절(§4.3 · §4.4 · §5.4 · §10 3b/5 · 권장안·예산)과 `pier_agent_b.py` · `prep-b.sh` · `run-pilot.sh`
- 직접 대조한 근거: Pier 0.3.1 설치본(`~/.local/share/uv/tools/datacurve-pier/…/pier/` — `models/trial/config.py` · `agents/installed/base.py` · `environments/base.py` · `environments/docker/docker.py`) · 1차 레인의 실제 job 산출물(`…/bf8b3ed9…/scratchpad/jobs/eval-513-pier-glm-fake{,-B}` · `eval-513-tb-pier-{oracle,nop,filter}`) · 레인의 DeepSWE 클론(117 과제 폴더) · T-Bench sparse 클론(`sound-change-cascade`) · 이 리포 `src/commands/install-render.ts` · `src/project-claude-merge.ts` · `src/ci-scaffold.ts` · `templates/skills/audit-harness-fit/{SKILL,references/populate}.md` · `gh api`/`gh pr view` 실호출(저장소 3곳 × 경로 9개 + 대조군, PR 14건)
- 프로젝트 파일은 고치지 않았다.

요약: **1차 BLOCKER B1~B4 는 네 건 모두 해소됐다**(증거 파일과 코드가 일치하고, 표본은 내가 직접 다시 재서 같은 값을 얻었다). 그러나 **D9 구현(정리 3회)에서 새 결함 6건**과 **B1 후속 결함 1건**이 나왔다 — 대부분 수정 규모는 작지만, 두 건(BLOCKER 2 · 4)은 "경우마다 장치를 더하기"보다 **정리를 Pier 안에서 돌리는 구조 변경** 하나로 함께 닫는 편이 단순하다(아래 §더 단순한 구조).

---

## 1. 1차 BLOCKER 해소 판정

| 건 | 판정 | 내가 직접 확인한 것 |
|---|---|---|
| **B1** 실사용 과제 A 팔에 하네스 | **해소**(후속 결함 1건 → BLOCKER 7) | `gh api repos/<r>/contents/<p>` 를 `yargs/yargs` · `sharkdp/bat` · `spf13/cobra` × 9 경로(`CLAUDE.md AGENTS.md .claude .cursor .cursorrules GEMINI.md .github/copilot-instructions.md .windsurfrules .clinerules`)에 직접 호출 → **27건 전부 rc=1(404)**. 대조군 `uzysjung/uzys-agent-harness/contents/CLAUDE.md` → rc=0 · path 반환(탐지기가 문다). 후보 PR 6건(`gh pr view --json mergedAt,baseRefOid,body,files`)은 전부 `Fixes/Closes #N` 과 테스트 파일 변경을 갖는다(R1 `test/yargs.mjs` · R2 `tests/integration_tests.rs` · R4 `completions_test.go` · R7 `test/chalk.js` · R8 `tests/options.variadic.test.js` · R9 `tests/test_types/test_Path.py`) |
| **B2** `git checkout -- .` 부분-A | **해소** | `feasibility/harness-skipworktree-in-deepswe-image.txt` 의 명령 = `glm-container/harness-skipworktree-test.sh` 21–24행 = `pier_agent_b.py` `_skip_worktree_cmd()` + exclude 루프(레인 산출물 `agent-build-context/Dockerfile` 의 생성 RUN 줄에도 같은 명령이 박혀 있다). 산출: 설치 후 `M .gitignore · M CLAUDE.md · ?? 6` → 처리 뒤 `SAME` · `CLAUDE.md` 5·6·14행 import 잔존 · `git diff <base> HEAD --stat` = `main.go | 1 +` · 하네스 경로 0. 빌드 실패 = 양팔 제외 규칙은 §4.3 · §5.3 · `run-pilot.sh:65` 에 들어갔다 |
| **B3** B 증거 거짓음성 | **해소** | 1차 레인 job 을 내가 다시 파싱: B `init.skills` 30(`audit-harness-fit` · `north-star` · `objective-brief` 포함) · `agents` 에 `implementer` · `reviewer` · `mcp_servers` = `[{context7, pending, project}]` / A `skills` 16 · 하네스 0 · `agents` 5 · `mcp_servers []`. 세션 jsonl `Session started. Branch:` B **3** · A **0**. `"hook_name":"SessionStart` B **2**(started+response) · A **0**. `/logs/agent/` 에 `harness-install-record.json` · `harness-git-status-diff.txt` · `harness-git.txt` 존재(디렉터리 목록 확인) |
| **B4** Pier 에 `-d` 없음 | **해소** | `jobs/eval-513-tb-pier-oracle/sound-change-cascade__fj5Tjyq/verifier/reward.txt` = **1** · `…-nop/…__xTEbbUn` = **0** · `…-filter/…__DKWuDcy`(= `-p tasks -i sound-change-cascade`) = 0 · 과제 1개 매치. `run-pilot.sh:43` 이 `-p … -x … --override-gpus 0` 로 바뀌었다 |

---

## 2. BLOCKER (새로 생긴 결함 — 전부 D9 구현 · §10 · §5.4)

### BLOCKER 1. `prep.tar` 를 찾는 키가 trial 폴더 이름인데 Pier 가 그 이름을 **32자에서 자른다** — DeepSWE 117 과제 중 **41개**는 정리 결과를 영영 못 찾고, 못 찾으면 **조용히 "설치만 한 B"** 로 돈다

- **근거**: `pier_agent_b.py:98` `task_id = Path(self.logs_dir).parent.name.split("__")[0]`. Pier `models/trial/config.py:276-279` `generate_trial_name()` = `f"{task_name[:32].rstrip('_-')}__{ShortUUID…}"`. 레인 클론 `dl/deep-swe/tasks` 에서 폴더 이름 길이 > 32 인 과제 = **41 / 117**(예: `dynamodb-toolbox-conditional-attribute-requirements` 51자 · `claude-code-by-agents-recursive-delegation` 42자 · `boa-hierarchical-evaluation-cancellation` 40자). `prep-b.sh` 는 `<out-dir>` 를 호출자가 과제 폴더 이름으로 만들라고 한다(§10 3b `~/eval-513/prep/$t`) → 잘린 이름과 불일치. 불일치 시 `pier_agent_b.py:115-116` `else` 분기가 `prep-applied.txt = none` 만 적고 **`super().run()` 으로 진행**한다 — D9 가 정의한 B(설치 + 정리 3회)가 아닌 팔이 같은 job 안에 섞여 돈다. `--sample-seed 513 -l 12` 표본에 긴 이름이 들 확률은 약 35%/과제다.
- **실패 시나리오**: 12 과제 중 4개가 정리 없는 B 로 돌고, `prep-applied.txt` 를 사후에 읽어야만 드러난다(§10 5ⓔ 는 "멈춘다"고 하지만 그 시점엔 비용이 이미 나갔다).
- **고칠 문장(§4.4 "단위와 재사용" · `pier_agent_b.py`)**: "정리 결과의 키는 trial 폴더 이름이 아니라 **시작 커밋 해시**다 — `run()` 이 먼저 `git -C /app rev-parse HEAD` 를 실행해(`exec_as_agent` 의 `ExecResult.stdout`) `<prep_dir>/<sha>/prep.tar` 를 찾고, `prep-b.sh` 도 `<out-dir>/<sha>/` 에 쓴다(과제 폴더 이름 → sha 는 `task.toml` 의 `base_commit_hash` 로도 미리 안다). 이렇게 하면 '저장소+시작 커밋 단위' 정의와 키가 일치하고 trial 이름 규칙에 의존하지 않는다. **`prep_dir` 가 주어졌는데 그 sha 의 `prep.tar` 가 없으면 예외로 멈춘다**(`raise FileNotFoundError` → trial 실패 → 양팔 제외 목록) — '설치만 한 B' 분기는 삭제한다(D9 이후 B 는 하나다)." 비-git 과제(T-Bench)는 BLOCKER 2 의 규칙을 따른다.

### BLOCKER 2. T-Bench 과제의 `/app` 은 **git 저장소가 아니다** — 지금 `pier_agent_b.py` 로는 **T-Bench 전 과제가 B 이미지 빌드 실패 → 양팔 제외**되고, `prep-b.sh` 는 T-Bench 를 받지도 않는다

- **근거**: 레인 클론 `dl/tbench/tasks/sound-change-cascade/environment/Dockerfile` = `FROM python:3.12-slim … WORKDIR /app … COPY engine/ … COPY data/train.tsv …` — `git init`/`git clone` 없음(grep rc=1; 대조군 DeepSWE `task.toml` 의 `[[verifier.collect]]` 는 `git diff` 를 쓴다 = 1건). T-Bench 채점은 `tests/test.sh` + `artifacts = ["/app/rules.json", "/app/ordering.txt"]` 로 git 을 쓰지 않는다. `pier_agent_b.py:70-73` 설치 단계는 `set -e; cd /app; … git status --porcelain > …` 으로 시작하므로 `fatal: not a git repository`(exit 128) → `RUN` 실패 → 이미지 빌드 실패 → §5.3 규칙으로 **양팔 제외**. 또 `prep-b.sh:28-29` 는 `task.toml` 의 `docker_image` 가 없으면 exit 4 — T-Bench `task.toml` 에는 `[environment]` 아래 `docker_image` 가 없다(환경은 `environment/Dockerfile` 빌드). 그런데 §3 · §7.2 · §0 예산은 T-Bench 6 과제 + 정리 18 세션을 실행 수에 넣고 있다.
- **실패 시나리오**: 권장안 24 과제 중 6개가 0 실행으로 끝나고, 예산표의 T-Bench 행과 "3 과제군 첫 신호" 주장이 거짓이 된다.
- **고칠 문장(`pier_agent_b.py` 설치 단계 · `run()` · §4.3 첫머리)**: "git 처리(skip-worktree · exclude · status 대조)는 **`/app` 이 git 저장소일 때만** 한다(`if git -C /app rev-parse --git-dir >/dev/null 2>&1; then … fi`) — 비-git 과제(T-Bench)는 채점이 git 을 읽지 않으므로 하네스 파일이 채점에 섞일 길이 없다(`artifacts` 는 지정 파일만). 비-git 과제의 증거 파일은 `status-*.txt` 대신 `git-repo: no` 한 줄을 남긴다." 정리(prep) 쪽은 아래 §더 단순한 구조로 — `prep-b.sh` 가 `docker_image` 를 요구하는 한 T-Bench 정리는 만들 수 없다.

### BLOCKER 3. 정리 **실패**가 제외로 이어지지 않고, `prep.tar` 가 정리 결과를 충실히 담지 못한다

- **근거 ⓐ(세션 실패 삼킴)**: `prep-b.sh:46-47` `claude -p … || true` — 401×10 재시도 · `--max-turns 60` 도달 · `is_error` 세션이어도 루프가 계속되고 `prep.tar` 가 만들어진다. "정리 3회" 가 실제로 0~2회였는지 아무 데서도 판정하지 않는다(§4.4 ⓔ 의 `fill-count` 감소 검사는 세션 1회가 성공하면 통과한다).
- **근거 ⓑ(`-uall` 부재 → 거짓 양팔 제외)**: `prep-b.sh:52-53` 은 `git status --porcelain` 출력을 경로 정규식으로 가른다. 상류에 `.github/` 가 **없는** 저장소에서는 porcelain 이 `?? .github/workflows/ci.yml` 이 아니라 **`?? .github/`** 를 내므로 정규식(`\.github/workflows/ci\.yml`)에 안 걸려 `prep-touched-source.txt` 로 가고 **exit 5 → 양팔 제외**가 난다 — ".github 가 없는 저장소" 가 체계적으로 표본에서 빠진다. 1차 설치 관측(`harness-install-in-deepswe-image.txt`)이 `?? .github/workflows/ci.yml` 로 보인 것은 `abs` 저장소에 `.github/` 가 이미 있었기 때문이다.
- **근거 ⓒ(겹쳐 풀기)**: `pier_agent_b.py:106` `tar -xf … -C /app` 은 덧씌우기만 한다 — 정리 세션이 하네스 파일을 **지웠으면**(populate 모드는 "scaffold notice 제거" 까지 허용하고 모델은 더 할 수 있다) 그 삭제는 전파되지 않아 B trial 마다 설치 직후 판이 살아 있다. 또 `.uzys-agent-harness/` 를 폴더째 담으면 정리 세션 중 생긴 `hook-blocks.log` 가 따라가 §2 의 "훅 차단 수" 기준선이 0 이 아니게 된다.
- **고칠 문장(§4.4 · §5.3 표 · `prep-b.sh` · `pier_agent_b.py`)**: "정리 세션은 **세 번 모두** `exit 0` · `is_error == false` · `num_turns > 0` 이어야 한다(`prep-b.sh` 가 세션마다 판정, 하나라도 어긋나면 **exit 6 · `prep.tar` 를 만들지 않는다**). §5.3 에 행을 더한다: '정리 실패(exit 4/5/6 · `prep.tar` 없음) → **그 과제 양팔 제외**, 사유 기록'. `prep.tar` 는 `git status --porcelain -uall` 의 파일 단위 목록으로 만들고(디렉터리 축약 없음 · gitignore 된 `hook-blocks.log` 는 자연히 빠진다), 적용은 **하네스 경로를 먼저 지운 뒤**(`rm -rf .claude .uzys-agent-harness .mcp.json CLAUDE.md CLAUDE-uzys-harness.md .github/workflows/ci.yml AGENTS.md .agents` — skip-worktree 비트는 index 에 남는다) 푼다 — tar 가 정리 결과의 **정본**이 되고 삭제도 전파된다."

### BLOCKER 4. 정리 세션은 **네트워크가 열린 컨테이너**에서 돈다 — "과제 정보가 새는 길 자체가 없다"(§4.4)는 거짓이다

- **근거**: `prep-b.sh:55` `docker run --rm --env-file … "$IMAGE" /out/prep-inner.sh` — 네트워크 제한 없음. 과제 이미지의 `/app` 에는 상류 저장소 체크아웃이 있고 `task.toml` 에 `repository_url` 이 있듯 `.git/config` 의 `origin` 도 보통 남아 있다. 정리 세션의 모델은 `bypassPermissions` 로 `git fetch origin` · `gh` · `WebFetch` 를 칠 수 있고, 그러면 **시작 커밋 이후의 상류 커밋(= 과제의 정답 PR)·이슈** 를 본 채로 `CLAUDE.md` 를 쓴다. `populate.md` 는 "current repository evidence" 를 쓰라고 하지만 네트워크 금지를 명시하지 않는다. 반면 과제 실행은 Pier egress 프록시로 `BASE_URL` 호스트만 허용된다(DeepSWE `no-network`). 즉 **B 만** 과제 밖 정보에 닿는 단계가 있다 — 확률은 낮아도 길이 있고, 설계는 "없다"고 적었다.
- **실패 시나리오**: 정리된 `CLAUDE.md` 의 "Architecture" 절이 정답 PR 이 만든 모듈 이름을 언급한다. 사후 대조(`prep-git-status.txt`)로는 네트워크 접근 여부를 알 수 없다.
- **고칠 문장(§4.4 "과제를 보기 전에 한다")**: "정리 세션은 **과제 실행과 같은 네트워크 정책**(egress 허용 = API 호스트만) 아래에서 돈다. 그래서 정리는 `docker run` 이 아니라 **Pier 로** 돈다(아래 §더 단순한 구조) — Pier 가 같은 이미지 빌드 · 같은 설치 단계 · 같은 사용자 · 같은 egress 프록시를 그대로 준다. 기록에는 `init.mcp_servers`·`api_retry` 외에 세션 jsonl 의 `WebFetch`/`git fetch`/`gh` 호출 **0건** 을 사후 대조 항목으로 더한다." 최소 대안(Pier 를 못 쓸 때)은 `git remote | xargs -r -n1 git remote remove` + `gh` 제거이지만 WebFetch 는 못 막으니 그 잔여 위험을 문서에 적어야 한다.

### BLOCKER 5. `prep-b.sh` 의 토큰 유출 검사가 **토큰을 검사하지 않는다**(항상 문자열 `ANTHROPI` 를 찾는다) · §10 7 의 grep 범위가 정리 산출물을 안 본다

- **근거**: `prep-b.sh:61` `grep -l "$(head -c 8 "$ENV_FILE" | cut -d= -f2)" -r "$OUT"`. `head -c 8` 이 먼저 돌아 `ANTHROPIC_AUTH_TOKEN=…` 의 **앞 8바이트 = `ANTHROPI`** 를 내고, `cut -d= -f2` 는 구분자가 없는 입력을 그대로 통과시킨다 — 실측 `printf 'ANTHROPIC_AUTH_TOKEN=abcdefgh…' | head -c 8 | cut -d= -f2` → `ANTHROPI`. 즉 키 조각은 한 번도 grep 되지 않고, `ANTHROPI` 가 든 파일(설치 로그·세션 JSON 의 `ANTHROPIC_` 환경 이름)이 "경고" 로 뜬다. 정리 세션은 `bypassPermissions` 로 `env` 를 칠 수 있고 결과 JSON 이 **호스트 `<out-dir>`** 에 남는다(§10 7 이 trial 에 대해 인정한 바로 그 경로). §10 7 의 `grep -rl '<키 앞 8자>' ~/eval-513/jobs` 는 `~/eval-513/prep` 을 보지 않는다.
- **고칠 문장(`prep-b.sh:61` · §10 7)**: `tok=$(cut -d= -f2 "$ENV_FILE" | head -c 8); grep -rl -- "$tok" "$OUT" && { echo "토큰 조각이 산출물에 있다"; exit 7; } || true` (키가 8자 미만이면 중단). §10 7 은 "`~/eval-513/` 전체(`jobs/` · `prep/`)" 로 넓힌다. D4 의 서술 자체("pier argv·lock·config 에는 없다 · 실행 중 호스트 ps 와 컨테이너 env 에는 있다")는 Pier `environments/docker/docker.py:751-753`(`exec … -e KEY=VALUE`)과 일치한다 — 문장은 맞고 검사기가 틀렸다.

### BLOCKER 6. §10 스모크를 **순서대로 치면 3b 가 실패한다** — 클론 전에 과제 폴더를 쓰고, 정리할 과제 id 를 알 방법이 없다

- **근거**: §10 3b 는 `~/eval-513/deep-swe/tasks/$t` 를 쓰는데 `git clone … ~/eval-513/deep-swe` 는 **4번** 에 있다. 또 3b 의 `<task-id-1> <task-id-2>` 는 4번의 `run-pilot.sh … deepswe 2 513` 이 Pier 안에서 `--sample-seed 513 -l 2` 로 뽑는 표본이어야 하는데, 그 표본을 메인 세션이 실행 전에 알 수단이 문서에 없다(`run-pilot.sh` 에 `-i` 경로가 없다). 두 id 를 잘못 짚으면 BLOCKER 1 의 분기로 "설치만 한 B" 가 된다.
- **고칠 문장(§10)**: "1 번에 클론을 둔다(`git clone --depth 1 … ~/eval-513/deep-swe`). 스모크 과제는 표본 추출이 아니라 **이름으로 고정**한다 — `run-pilot.sh` 에 `EVAL_TASKS='<id> <id>'` 를 받아 `-i <id>` 로 넘기는 경로를 더하고(`-l`/`--sample-seed` 와 배타), 3b · 4 가 같은 두 id 를 쓴다(§3 '표본 목록은 실행 전에 뽑아 적는다' 와 같은 원칙)."

### BLOCKER 7. 실사용 후보 **R4(`spf13/cobra` #2356)가 선정 규칙 ⓐ "2026-07 이후 머지" 를 위반**한다 — 머지일 **2026-04-24**

- **근거**: `gh pr view 2356 -R spf13/cobra --json mergedAt` → `2026-04-24T20:41:58Z`. 나머지 예비 5개는 규칙 안(R1 10-13 · R2 10-07 · R7 07-25 · R8 09-28 · R9 09-08). 본실험 풀의 `hynek/structlog #818` 도 **2026-06-01** 로 위반. `realuse-repo-survey.sh:41` 은 "최근 머지 20건" 만 보고 날짜를 거르지 않는다 — 규칙 ⓐ 를 코드가 집행하지 않는다.
- **실패 시나리오**: 4월 머지 PR 은 모델 학습 범위에 들 수 있어(규칙 ⓐ 의 취지가 그것이라면) A·B 모두 "기억으로 푸는" 과제가 된다 — 효과 측정이 아니라 기억 측정.
- **고칠 문장(§5.4 표 · `realuse-repo-survey.sh`)**: "R4 를 `go-chi/chi` #843→#1159(2026-08-27) 또는 `stretchr/testify` #1211→#1938(2026-08-24) 로 바꾸고, `structlog #818` 을 풀에서 뺀다. 스크립트는 `gh pr list … --json number,title,mergedAt` 로 받아 `mergedAt < 2026-07-01` 을 건너뛴다. 규칙 ⓐ 의 **이유**(모델 학습 마감 이후)를 한 줄 적어 날짜의 근거를 남긴다."

---

## 3. 더 단순한 구조 — BLOCKER 2(정리 쪽) · 4 를 한 번에 닫는다

정리를 **별도 `docker run` 경로**로 두는 한 네트워크 정책 · 사용자 · Claude Code 설치 위치 · 과제 환경 빌드(T-Bench 의 `environment/Dockerfile`)를 전부 **두 번** 맞춰야 한다. 대신 `pier_agent_b.py` 에 `PrepClaudeCode(HarnessedClaudeCode)` 를 하나 더 두고:

- `install_spec()` 은 부모(B)와 같다(하네스 설치 포함).
- `run()` 은 `instruction` 을 **무시**하고 고정 프롬프트로 `claude -p …` 를 3회 `exec_as_agent` 로 돌린 뒤, `git status --porcelain -uall`(git 과제) 또는 하네스 경로 전체(비-git 과제)를 `tar` 로 묶어 **`/logs/agent/prep.tar`**(호스트 trial 폴더에 bind mount) 와 세션 JSON · `fill-count.txt` 를 남긴다.
- 호출: `pier run -p <tasks> -i <id> --agent-import-path pier_agent_b:PrepClaudeCode --env-file … -m … --ak reasoning_effort=high` — 검증기가 돌아 reward 0 을 내지만 무시한다(비용 1분).

얻는 것: egress 허용 = API 호스트만(BLOCKER 4 해소) · T-Bench 포함 모든 Harbor 과제에 같은 길(BLOCKER 2 정리 쪽 해소) · 같은 사용자/설치 경로라 권한 차이 없음(NOTE 5 해소) · `prep-b.sh` 의 `docker_image` 파싱 · PATH 조정 · 사용자 환경 재현 코드가 전부 사라진다. `run-pilot.sh` 의 B 는 trial 폴더에서 `prep.tar` 를 `<prep_dir>/<sha>/` 로 복사하는 한 줄만 추가된다. 정리 세션의 "과제 지시문을 주지 않는다" 는 `run()` 이 `instruction` 을 버리는 것으로 **코드가 보증**한다(지금은 "주지 않는다"가 운영 약속이다).

---

## 4. NOTE (선택 개선)

- **N1. 프롬프트는 설치 화면과 바이트 동일이 아니다.** 화면(`src/commands/install-render.ts:888`) = "…, or ask the **audit-harness-fit** skill to fill it from repository evidence" / 프롬프트 = "Use the audit-harness-fit skill to fill CLAUDE.md from repository evidence." — 'ask … to fill it' 을 명령형으로 옮기고 `it` 을 `CLAUDE.md` 로 푼 것. 뜻은 같다. §4.4 의 "문자 그대로" 를 "설치 화면 문구를 명령형으로 옮긴 고정 프롬프트" 로 고쳐 쓰면 거짓이 없다.
- **N2. 상류에 `CLAUDE.md` 가 있는 저장소에서는 FILL 안내가 **안 뜬다**.** `install-render.ts:880-884` — `created === false` 이고 `hasFillPrompt` 가 거짓이면 `scaffoldFiles` 가 비어 FILL 행 자체가 없다. 그 경우 `after-install` FILL 수 = 0 이라 §10 5ⓔ "줄었는가" 가 성립하지 않고, populate 모드는 상류 `CLAUDE.md` 를 편집할 수 있다(skip-worktree 라 채점에선 가려진다). ⓔ 를 "FILL 수 6 → 감소(새 스캐폴드) **또는** 0 → `CLAUDE.md` 변경 있음(상류 파일)" 두 갈래로 적어라.
- **N3. ②′ 가 `usage` 로 센다.** §4.4 · `prep-b.sh:60` 의 jq 는 `.usage` 만 뽑는데 §2 · §8 은 "`modelUsage` 로 센다(`usage` 금지)" 다 — 정리 세션이 서브에이전트를 쓰면 빠진다. jq 를 `modelUsage` 로.
- **N4. exit 98 은 Pier 에서 `NonZeroAgentExitCodeError` 로 올라간다**(`agents/installed/base.py:340-351` — `_exec` 가 return_code≠0 에 raise). trial 의 `exception.txt`/`result.json` 만 보면 "에이전트 실패" 와 구별이 안 된다. 98 로 나가기 전에 `/logs/agent/excluded.txt` 에 사유를 적어 두면 `summarize.sh` 가 그걸로 양팔 제외를 가른다.
- **N5. D9 의 `run()` 경로(upload → tar 풀기 → git 재적용)는 **리허설이 없다**(1차 리허설은 `34bd75d`, D9 이전).** `exec_as_agent` 는 `task.config.agent.user`(DeepSWE `task.toml` 에 없음 → 이미지 기본 사용자)로 돌고, 설치 단계가 root 로 쓴 `CLAUDE.md` · `.mcp.json` · `CLAUDE-uzys-harness.md` 는 `chmod a+rwX` 대상(`.claude` · `.uzys-agent-harness`)에 없다. 기본 사용자가 root 가 아니면 tar 덧쓰기는 디렉터리 쓰기 권한으로 되지만 Claude 의 직접 편집은 막힌다. 스모크 첫 B trial 에서 `prep-applied.txt` 와 권한 오류를 먼저 본다 — §3 구조로 가면 사용자 차이는 사라진다.
- **N6. 상류에 `.mcp.json` · `.claude/settings.json` 이 tracked 로 있으면** 설치가 그 파일을 고쳐(`M`) `SHARED_TRACKED` 밖이라 exit 97 → 양팔 제외. 규칙대로지만 감손이 보고에 남아야 한다. `.mcp.json` 은 이 리포 원칙상 "함께 쓰는 파일" 이므로 `SHARED_TRACKED` 에 넣는 것이 일관되다(`.claude/settings.json` 은 B1 규칙으로 실사용에선 안 나오고 벤치마크에선 제외가 맞다).
- **N7. 예산표의 T-Bench 정리 18 세션 · 권장안 "정리 72" 는 BLOCKER 2 해소 뒤 다시 센다.** `ci-scaffold.ts:82-85` 는 기존 `ci.yml` 이 있으면 건너뛰므로(`skippedExisting`) 그 경우 tracked 변경은 안 생긴다 — 1차 N2 걱정과 달리 attrition 요인은 아니다.
- **N8. `prep-b.sh:37-38` 이 설치 오류를 `>/dev/null 2>&1` 로 지운다** — 실패하면 `set -e` 로 죽되 원인이 안 남는다. stderr 는 `/out/install.err` 로.
- **N9. `realuse-repo-survey.md` 는 기본 브랜치 HEAD 의 지시 파일 부재를 본다** — A 팔이 쓰는 것은 PR base 커밋이다. 지시 파일은 시간이 갈수록 늘기만 하므로 HEAD 에 없으면 base 에도 없다고 봐도 되지만, 과제 생성 스크립트(2단계)가 base 체크아웃에서 같은 9 경로를 한 번 더 확인하도록 적어 두면 가정이 코드가 된다.

### 확인해서 문제 없음

정리 3회가 **누적**으로 도는가 — `prep-inner.sh` 가 같은 `/app` 에서 세션을 순차 실행하므로 2·3회차는 1회차 결과 위에서 돈다 ✓ · 정리 결과를 **적용하는 시점**이 에이전트 실행 **전**이고 적용 전후 `git status --porcelain` 동일을 요구하므로 에이전트의 실제 소스 변경을 숨길 길은 없다(skip-worktree 파일을 에이전트가 고친 경우만 1차 B2 와 같은 한계 — 문서에 적혀 있다) ✓ · 정리가 하네스 밖 tracked 파일을 바꾸면 `prep-touched-source.txt` → 제외 ✓(단 BLOCKER 3ⓑ 의 거짓 양성) · 정리 모델·effort 가 단계와 같다(`prep-b.sh` GLM env 5종 = Pier 가 묶는 것과 같은 집합 · `--effort high` = `run-pilot.sh` `EFFORT=high`) ✓ · 도입 비용 분리 공시(§2 ②′ · §4.4 · §7.2 "도입(정리)" 행) ✓ · upload+tar 의 몇 초가 `agent_execution`(Pier `trial/trial.py:310-320` 이 `run_agent` 전체를 감싼다)에 든다는 공시 ✓ · D4 토큰 서술 = Pier 코드 ✓ · 1차 N1~N11 반영 위치(§14 표) 는 본문과 일치 ✓.

---

## 5. 판정

**`BLOCK`** — BLOCKER 1(키 = 시작 커밋 sha · '설치만 한 B' 분기 삭제) · 2(비-git 과제 분기) · 3(세션 실패 → exit 6 · `-uall` · 지우고 풀기) · 4(정리를 Pier egress 안에서) · 5(토큰 grep 수정 · 범위) · 6(§10 순서 · `-i` 고정) · 7(R4 교체 · 날짜 필터). 2 와 4 는 §3 의 `PrepClaudeCode` 하나로 함께 닫는 것을 권한다 — 그러면 `prep-b.sh` 의 절반이 사라진다. 재검토는 `pier_agent_b.py` · `run-pilot.sh` · §4.4 · §5.3 · §5.4 표 · §10 만 보면 된다.

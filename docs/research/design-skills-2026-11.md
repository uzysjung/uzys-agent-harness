# UI 트랙 디자인 스킬 — 기본·선택 판정 조사

> 이슈 #927 · `/deep-research` 결과(2026-11-02). 웹 검색 → 출처 수집 → 주장마다 3표 반박 검증(2표 이상 반박이면 기각) → 종합.
> 출처 21개 · 추출 주장 105개 · 검증 25 · 통과 21 · 기각 4.
> 아래 '결과'는 검증을 통과한 주장이다. '추론'이라 적힌 문장과 리포 관측은 검증 투표 대상이 아니었다.

## 요약

Impeccable(pbakaus/impeccable, Apache-2.0, 2026-11-01까지 매일 커밋, v4.8.0)은 마크다운만 복사하는 스킬이 아닙니다. 첫 실행 때 GitHub Releases에서 17~22MB 네이티브 엔진을 `~/.impeccable/bin/`에 받아 실행하고, 자체 설치기(`npx impeccable install`)는 편집할 때마다 도는 훅을 기본으로 등록합니다. 프로젝트에는 `.impeccable/`, `PRODUCT.md`, `DESIGN.md`를 만듭니다. 기본 상태에서도 impeccable.style로 버전 확인, 디자인 방향 요청(roll), 선택 텔레메트리가 나가고, 이 가운데 roll은 텔레메트리를 꺼도 나갑니다. 벤더 정책과 소스 판독으로는 프로젝트 이름·코드·브리프가 이 요청에 실리지 않습니다. 다만 `OPENAI_API_KEY`가 설정돼 있고 CLI에 자체 이미지 도구가 없으면 기존 페이지 스크린샷과 comp 크롭이 OpenAI Images API로 올라갑니다. frontend-design은 스크립트·훅·네트워크 호출이 없는 텍스트 9.4KB이고 상주 설명이 205바이트입니다. 다만 본문에 기존 디자인 시스템을 지키라는 지시가 없어서, 하네스 카탈로그 문구의 보완 한 줄이 그 공백을 메우고 있습니다. "설치자 프로젝트 내용이 외부로 나가는 자산은 기본으로 두지 않는다"는 기준을 적용하면, 근거는 frontend-design을 기본으로 유지하고 Impeccable은 선택 항목으로 추가하는 쪽을 받칩니다. 사용자 의견("Impeccable 을 넣고")이 기본 교체를 뜻한다면 이 근거와 갈리므로 사용자가 정해야 합니다. 네 스킬을 같은 과제로 비교한 공개 평가, taste의 "30~45분·수십만 토큰" 주장, taste·better-*의 설치 구조와 송신 여부는 이번 검증을 통과한 근거가 없습니다. 그래서 첫 판정 기준인 "UI를 더 잘 만들게 하는가"는 아직 답하지 못했습니다.

## 결과

### 1. (high · 투표 3-0 (주장 5·6·8·11 병합))

Impeccable의 설치 경로는 둘이고, 결과물이 서로 다릅니다. ① `npx impeccable install`(자체 설치기)은 훅을 기본으로 설치합니다. 대화형이면 Y가 기본값인 질문을 하고, `-y`나 터미널이 없는 환경(CI·스크립트)이면 묻지 않고 설치하며, `--no-hooks`로만 생략합니다. 훅을 쓰는 파일은 `.claude/settings.local.json`(PostToolUse 5초, Stop 30초), `.codex/hooks.json`, `.cursor/hooks.json`, `.github/hooks/impeccable.json`, `.gemini/settings.json`(기존 파일에 병합하고 `.bak` 백업), `.grok/hooks/`이고, 설치 동의는 `.impeccable/config.local.json`에 기록됩니다. ② `npx skills add pbakaus/impeccable`은 공유 빌드만 깔고 훅은 넣지 않습니다(README: 'A manual copy skips the design hook and subagents'). 훅 문서는 OpenCode와 Antigravity를 다루지 않습니다.

- 근거: 근거는 셋입니다. 첫째, `crates/skills/src/commands.rs:585`의 `install_hooks = !has_flag(flags, "--no-hooks")`와 `decide_hook_install()`이 'yes || !stdin_tty → true'로 동작합니다. 둘째, 리포의 `skill/reference/hooks.md`가 프로젝트에 설치되는 경로 목록을 적어 두었습니다. 셋째, FAQ가 '`npx skills add` = shared build, Impeccable installer selects a build for your tool'이라고 씁니다. 주장 5·6·8·11을 합쳤고 표결은 각 3-0입니다. 하네스 원칙에 비추면(추론) 하네스는 지금 `npx skills` 경로로 스킬을 깔기 때문에 훅이 생기지 않습니다. `npx impeccable install`을 하네스가 대신 돌리면 하네스 설치 기록 밖에서 함께 쓰는 설정 파일(`.claude/settings.local.json`, `.gemini/settings.json` 등)이 바뀝니다.
- 출처: https://impeccable.style/docs/hooks · https://impeccable.style/faq · https://github.com/pbakaus/impeccable · https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/scripts/impeccable

### 2. (high · 투표 3-0 (주장 0·9·10·11·16·20 병합))

Impeccable 스킬은 설명문만으로 돌지 않습니다. SKILL.md가 세션마다 `scripts/impeccable context`를 실행하라고 지시하고, 이 POSIX sh 런처가 네이티브 엔진을 실행합니다. 런처는 `$IMPECCABLE_BIN`, 옆의 `bin/<os>-<arch>/`, `~/.impeccable/bin/impeccable`, 버전 고정 캐시, PATH 순으로 엔진을 찾습니다. 엔진 바이너리는 git에서 제외(gitignore)돼 있어서, git에서 받은 설치본(npx skills 포함)은 첫 실행 때 `https://github.com/pbakaus/impeccable/releases/download/engine-v<ver>/impeccable-<os>-<arch>`를 curl이나 wget으로 `~/.impeccable/bin/<version>/`에 받습니다. 받은 파일은 SHA-256으로 검증하고, 맞지 않으면 실행을 거부합니다. 훅은 이 런처를 편집할 때마다 실행합니다. 이 실행은 모델 승인 밖에서 일어나고 샌드박스 없이 에이전트의 환경과 네트워크 권한을 그대로 씁니다. 그래서 첫 편집이 엔진 다운로드를 일으킬 수 있습니다. `serve-question`은 127.0.0.1의 포트를 여는 데몬을 띄웁니다. 런처를 쓸 수 없으면 `PRODUCT.md`와 `DESIGN.md`를 직접 읽는 대체 경로가 있습니다.

- 근거: 런처 헤더에 'Never needs Node'와 'Last resort: fetch ... from the public release channel'이 있고, `base=${IMPECCABLE_DOWNLOAD_BASE:-https://github.com/pbakaus/impeccable/releases/download}`로 받을 주소를 정합니다. `.gitignore`의 `**/skills/impeccable/scripts/bin/` 줄이 엔진을 git에서 제외합니다. engine-v0.1.18 릴리스(2026-10-26)는 darwin-arm64가 17,721,856바이트, linux-x64가 21,984,304바이트입니다. 데몬은 `serve_question.rs:1610`의 `bind(("127.0.0.1", port))`에서 확인했습니다. README:205에는 'Hooks run outside model approval... the first edit can download the engine'이라고 적혀 있습니다. 주장 0·9·10·11·16·20을 합쳤고 표결은 각 3-0입니다.
- 출처: https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/scripts/impeccable · https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/SKILL.md · https://github.com/pbakaus/impeccable · https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/reference/new-work.md

### 3. (high · 투표 3-0 (주장 1·2·3·12·13 병합))

Impeccable은 기본 상태에서 impeccable.style로 외부 호출을 보냅니다. 끄는 방법과 실리는 내용은 다음과 같습니다. (a) 버전 확인(`/api/version`): 보통 하루 1회이고 프로젝트 내용은 없습니다. `IMPECCABLE_NO_UPDATE_CHECK=1`이나 `updateCheck: false`로 끕니다. (b) 디자인 방향 요청 roll(`/api/roll`): 새 디자인을 시작할 때 나갑니다. 무작위로 만든 roll key, round, scope, 필터(mode·grain·platform), `X-Impeccable-Client` 버전 헤더가 실리고, 프로젝트 이름·경로·프롬프트·브리프는 실리지 않습니다. 텔레메트리를 꺼도 요청은 그대로 나가며 'X-Impeccable-Telemetry: off' 헤더만 붙습니다. 로컬 카탈로그(`IMPECCABLE_CATALOG_DIR`)가 있으면 이 요청을 대신하지만, 기본 배포본에는 카탈로그가 없어 API 경로를 탑니다. (c) 선택 ping(`/api/chosen`): 기본으로 켜져 있고 카드 종류, 위치, 카탈로그 ID, roll key, round, scope, 페이지 모드, safer/bolder 여부를 보냅니다. (d) 미리보기 이미지를 `impeccable.style/worlds/cards`에서 불러옵니다. (e) 엔진 다운로드는 GitHub에서 받습니다. 프로젝트 검사(detect)는 로컬에서 돌고, 결과를 에이전트에게만 돌려주며 Impeccable 서버로 올리지 않습니다. 서버 기록에는 IP, 프로젝트 내용, 사용자·기기 ID가 없다고 하며, 정해진 삭제 기한 없이 보관합니다. Cloudflare는 IP를 처리합니다.

- 근거: 근거는 셋입니다. 개인정보 처리방침(2026-10-21 갱신)에 'Turning telemetry off doesn't stop that request', 'These requests do not include your project name, file paths, prompt, or brief', 'Its project checks run locally'가 있습니다. 코드에서는 `concept_seed.rs`의 `fetch_roll()`이 opt-out일 때 헤더만 붙이고 `req.call()`을 그대로 실행하고, `telemetry.rs`의 `api_base()` 기본값이 https://impeccable.style/api(`IMPECCABLE_API_URL`로 변경 가능)입니다. `context_cli.rs`의 갱신 확인 주기는 24시간입니다. 주장 1·2·3·12·13을 합쳤고 표결은 각 3-0입니다. 한계도 있습니다. 실린 내용은 벤더가 스스로 밝힌 것과 소스 판독이고, 네트워크를 직접 관측하지는 않았습니다.
- 출처: https://impeccable.style/privacy · https://github.com/pbakaus/impeccable · https://github.com/pbakaus/impeccable/blob/main/crates/context/src/telemetry.rs

### 4. (high · 투표 3-0 (주장 4·13·14 병합))

Impeccable 텔레메트리는 기본으로 켜져 있고 끄는 방법이 넷입니다. `npx impeccable telemetry off`(사용자 설정 `~/.impeccable/config.json`에 `telemetry: false`를 씁니다), `IMPECCABLE_NO_TELEMETRY=1`, `DO_NOT_TRACK=1`, 프로젝트 `.impeccable/config.json` 또는 `config.local.json`의 `telemetry: false`입니다. 프로젝트 설정으로 모든 작업자에 대해 끌 수 있고, 어느 한 곳에서 끄면 다른 설정이 다시 켜지 못합니다. 다만 텔레메트리를 꺼도 roll 요청은 나가고 버전 확인은 별도 변수(`IMPECCABLE_NO_UPDATE_CHECK`)로 끕니다. 따라서 '텔레메트리 끔'은 '외부 호출 0'을 뜻하지 않습니다. v4.6.0보다 옛 판은 환경 변수 두 개만, 그것도 선택 보고에만 적용합니다.

- 근거: `opt_out_reason()`(77~111행)은 환경 변수나 설정에 opt-out이 없으면 None(켜짐)을 돌려줍니다. 1171~1240행의 테스트가 각 경로를 덮습니다. 상태 문구 원문은 'telemetry: on. The roll request and the choice ping carry the seed key, scope, mode, round, pool revision, the card kind and catalog id that won, and the client version; never your project's names or code'입니다. 진짜 opt-out은 2026-10-12 커밋 44c00a2a에서 들어왔습니다. 주장 4·13·14를 합쳤고 표결은 각 3-0입니다.
- 출처: https://impeccable.style/privacy · https://github.com/pbakaus/impeccable/blob/main/crates/context/src/telemetry.rs

### 5. (high · 투표 3-0)

조건이 맞으면 설치자 프로젝트 화면이 외부로 나갑니다. CLI에 자체 이미지 도구가 없고 환경에 `OPENAI_API_KEY`가 있으면, Impeccable의 `generate-image` 대체 경로가 기존 페이지 스크린샷(기존 디자인 안에 새 화면을 만들 때의 참조 이미지)과 승인된 comp 크롭을 multipart로 `https://api.openai.com/v1/images/edits`에 올립니다. 비용은 사용자 키로 청구됩니다. 키가 없으면 이 경로는 종료하고, 에이전트에게는 첫 렌더 전에 이를 알리라고 지시합니다.

- 근거: `new-work.md`의 41행과 113행에 'pass a screenshot of a representative existing page as a reference image (... or `impeccable generate-image --ref`)'와 'The API fallback is `impeccable generate-image --ref <crop.png> ...`'가 있습니다. 코드에서는 `generate_image.rs`가 `run_with_api_base(args, io, "https://api.openai.com/v1")`로 기본 주소를 정하고 `--ref`마다 `image[]`를 업로드하며, 키가 없으면 371행에서 종료합니다. `context_cli.rs:214~221`은 키가 있을 때만 대체 경로를 안내합니다. 주장 17이고 표결은 3-0입니다. 판정 기준과 관련해서 보면, '설치자 프로젝트 내용이 외부로 나간다'는 기준에 걸리는 유일하게 확인된 경로이고 조건부입니다.
- 출처: https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/reference/new-work.md

### 6. (high · 투표 3-0 (주장 0·15 병합))

Impeccable은 설치자 프로젝트에 자기 상태 파일을 만듭니다. `PRODUCT.md`(init), `DESIGN.md`(document)와 `.impeccable/` 아래 `config.json`, `config.local.json`(gitignore 대상), `design.json`, `live/config.json`, `surfaces/*.md`, `critique/*.md`, `mocks/`, `review/`, `build/`, `questions/`, 훅 캐시(`hook.cache.json`, `hook.pending.json`)가 그것입니다. 여기에 `.git/info/exclude` 편집과 홈 디렉터리의 `~/.impeccable/`이 더해집니다. 일부는 해당 명령(live·critique·mocks·comp 기반 build)을 실행할 때만 생깁니다. README는 이 가운데 일부를 리포에 커밋하라고 권합니다.

- 근거: README:166은 'Impeccable writes its working files under `.impeccable/`... Keep PRODUCT.md and DESIGN.md in the repo too'라고 씁니다. `new-work.md`의 55·152·41·115~142행이 파일별 위치를, `crates/live/src/gitignore.rs`가 info/exclude 기록을 보여 줍니다. 주장 0·15를 합쳤고 표결은 각 3-0입니다. 하네스 원칙에 비추면(추론) 이 파일들은 하네스 설치 기록 밖이라 하네스 uninstall이 치우지 않습니다. 설치자가 Impeccable을 써서 생긴 산출물이기 때문입니다.
- 출처: https://github.com/pbakaus/impeccable · https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/reference/new-work.md

### 7. (high · 투표 3-0 (주장 7·11 병합))

Impeccable 훅은 상주 설명 토큰과 별도로 실행 비용을 더합니다. Claude Code와 Codex에서는 UI 파일(.tsx, .jsx, .html, .vue, .svelte, .astro, .css, .scss, .sass, .less, .ts, .js)을 편집할 때마다 PostToolUse에서 즉시 검사를 하고, 턴이 끝날 때 Stop에서 그 세션에 건드린 UI 파일 전체에 규칙 전부를 돌립니다. 결과는 시스템 리마인더로 컨텍스트에 들어가고, 문제 없는 파일도 quiet 모드가 아니면 확인 메시지를 남깁니다. Cursor와 Copilot은 Stop 단계 없이 편집마다 전체 검사를 돌립니다. 훅 제한 시간은 PostToolUse 5초, Stop 30초로 설정돼 있지만, 실측 지연이나 토큰 수치는 벤더 문서에 없습니다.

- 근거: 훅 문서에 'Broader checks run on the session's touched UI files at the `Stop` event'라는 문장이 있습니다. `skill/reference/hooks.md`에는 'push a short system reminder into the agent's context after the edit'가 있고, 리포의 `.claude/settings.json`에 timeout 5초와 30초가 설정돼 있습니다. 주장 7·11을 합쳤고 표결은 각 3-0입니다. 하네스가 쓰는 `npx skills` 경로에는 훅이 없으므로 이 비용은 생기지 않고, 그 대신 자동 검사의 가치도 빠집니다(MANUAL_DETECTOR_REQUIRED 지시 1회만 남습니다).
- 출처: https://impeccable.style/docs/hooks · https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/scripts/impeccable

### 8. (high · 투표 3-0)

Anthropic 공식 frontend-design은 안내 텍스트뿐입니다. `skills/frontend-design/`에는 SKILL.md(9,390바이트)와 LICENSE.txt 두 파일만 있고 스크립트, 훅, 텔레메트리, 외부 API 호출이 없습니다. 마지막 변경은 2026-09-03 커밋 41bbe19(#1713)입니다. 상주하는 description은 두 문장, 29단어, 205바이트입니다(원 주장의 '한 문장'은 정정). 하네스가 쓰는 설치 경로인 `npx skills add`(vercel-labs/skills)는 따로 skills.sh로 설치 텔레메트리를 보냅니다(`/tele/t`, `/tele/audit`). 실리는 것은 CLI 버전, 에이전트, 소스 리포, 스킬 이름 등이고 프로젝트 내용은 없습니다. 이 텔레메트리는 `DISABLE_TELEMETRY`나 `DO_NOT_TRACK`로 꺼지는데, 하네스 `src/`에는 이 변수를 설정하는 곳이 없습니다(대조군을 두고 부재 확인). 이 동작은 후보 네 스킬 모두에 똑같이 적용됩니다.

- 근거: GitHub API로 디렉터리 목록과 커밋을 확인했습니다. SKILL.md 71행을 http, curl, fetch, api, script, hook, telemetr, npx로 검색해 네트워크 관련 항목이 없음을 확인했습니다. 하네스 쪽은 `src/external-installer.ts:1595`(npx skills add anthropics/skills)와 vercel-labs/skills의 `src/telemetry.ts`를 확인했습니다. 주장 18이고 표결은 3-0이며, 설명 길이는 검증자가 정정했습니다.
- 출처: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md

### 9. (medium · 투표 3-0 (frontend-design 부분) · 겹침 범위 주장은 0-3 반박)

frontend-design 본문은 에이전트를 '의견이 분명한 선택을 하고 근거가 있으면 미적 위험을 감수하는 디자인 리드'로 둡니다. 컬러·타입·레이아웃 토큰 체계를 새로 만들라고 지시하고(47행), description은 'reshaping an existing one'을 대상에 넣습니다. 반면 기존 디자인 시스템, 컴포넌트 라이브러리, 코드베이스 규약을 지키라는 문장은 없고, 브리프에 명시한 시각 방향만 이 지시보다 우선합니다(43행). 그래서 디자인 시스템이 이미 있는 프로젝트에서는 기존 토큰을 갈아엎을 여지가 있습니다. 하네스 카탈로그 문구('do not let it override an existing design system', `src/external-assets.ts:679`)가 이 공백을 이미 메우고 있습니다. Impeccable 쪽은 `new-work.md`에 '기존 디자인 안에서 새 화면 만들기' 경로를 두고 `DESIGN.md`에 시각 결정을 맡깁니다. 다만 Impeccable이 기존 PRODUCT.md·DESIGN.md를 보존하고 기존 디자인을 따른다는 FAQ 주장은 반박됐습니다(0-3). 그래서 Impeccable이 덮어쓰지 않는다고는 말할 수 없습니다.

- 근거: frontend-design 부분은 본문을 직접 읽은 결과입니다(주장 19, 3-0). 공식 플러그인 사본 9개(2026-08-23~11-02)를 검색해도 결과가 같았습니다. medium으로 둔 이유는 둘입니다. '덮어쓸 여지'는 본문에 그런 지시가 없다는 데서 나온 추론이고, 실제로 덮어쓴 사례를 관측하지 않았습니다. 또 두 스킬의 겹침(anti-slop 범위)을 말하는 주장이 반박돼(0-3) 겹침의 구체적 범위가 검증되지 않았습니다.
- 출처: https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md · https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/reference/new-work.md

### 10. (high · 투표 검증자 증거 교차(주장 0·1·12·14 검증 과정))

Impeccable의 라이선스와 유지보수 상태: Apache-2.0이고 2026-11-01에 마지막으로 push했으며 아카이브되지 않았습니다. 판은 v4.8.0(2026-10-26), 엔진은 engine-v0.1.18(2026-10-26)이고 README는 2026-10-28에 개편됐습니다(#1204). 스타 수는 약 10만(검증자 관측)이고 매일 커밋이 들어오는 활발한 프로젝트입니다. 텔레메트리 v2는 2026-10-12에, opt-out 헤더는 v4.6.0에 들어왔듯이 송신 정책도 최근까지 바뀌었습니다.

- 근거: 여러 검증자가 GitHub API와 리포 메타데이터로 관측했습니다(라이선스, pushed_at, package.json 4.8.0, 릴리스 목록). 스타 수만 근삿값입니다.
- 출처: https://github.com/pbakaus/impeccable · https://impeccable.style/privacy

### 11. (medium · 투표 추론(검증된 주장 조합))

(근거를 판정 기준에 적용한 추론) 기본은 frontend-design 유지, Impeccable은 선택(opt-in)으로 추가, taste-skill과 jakubkrehel/skills(better-*)는 선택 유지, 제외는 없음을 추천합니다. 이유는 다음과 같습니다. frontend-design은 외부 송신이 없고 상주 비용이 205바이트이며, 디자인 시스템 덮어쓰기 위험은 카탈로그 문구로 이미 보완했습니다. Impeccable은 기본 경로에서 프로젝트 내용을 보내지 않는다는 벤더 정책과 코드 근거가 있습니다. 그러나 끌 수 없는 roll 호출, 기본으로 켜진 텔레메트리, 첫 실행 때의 네이티브 엔진 다운로드, `OPENAI_API_KEY` 조건부 스크린샷 업로드, 프로젝트 상태 파일 생성이 있어 '외부로 나가는 자산은 기본으로 두지 않는다'는 방향과 맞지 않습니다. 설치는 지금처럼 `npx skills` 경로로 합니다. 훅이 없고, 하네스 기록 밖의 함께 쓰는 설정 파일을 건드리지 않기 때문입니다. 사용자 의견 'Impeccable 을 넣고'가 기본 교체를 뜻한다면 이 추천과 갈리므로 사용자가 정해야 합니다. 첫 판정 기준(UI를 더 잘 만들게 하는가)에서 어느 쪽이 우위인지 보여 주는 검증된 근거는 없습니다.

- 근거: 앞의 high 근거들을 사용자가 준 판정 순서(목적, 그다음 보안·비용)에 적용했습니다. 카탈로그 설명 문구 초안은 다음과 같습니다. 기존 항목처럼 영문 한 줄입니다. Impeccable(opt-in) 초안은 "impeccable — design workflow with an anti-generic detector and PRODUCT.md/DESIGN.md context. Downloads a native engine on first use and calls impeccable.style for design directions even with telemetry off; set DO_NOT_TRACK=1 and IMPECCABLE_NO_UPDATE_CHECK=1 to minimize. With OPENAI_API_KEY set it can upload page screenshots to OpenAI. Opt-in, not a default"입니다. frontend-design은 현행 문구('... For new UI or an explicit redesign; do not let it override an existing design system')를 그대로 둡니다. taste-skill과 jakubkrehel-skills도 현행 문구를 유지합니다. 비용 주장은 검증되지 않아 문구에 수치를 넣지 않습니다. 현행 문구 출처는 `src/external-assets.ts`의 679·692·705행입니다.
- 출처: https://impeccable.style/privacy · https://github.com/pbakaus/impeccable · https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md · https://impeccable.style/docs/hooks

## 한계

이번 단계에서 검증을 통과한 주장은 질문 ①(Impeccable)과 ②의 frontend-design 쪽에 몰려 있습니다. ③ 네 스킬을 같은 과제로 비교한 공개 평가나 사용자 보고, ④ taste-skill의 '30~45분·수십만 토큰' 주장, Impeccable의 상주 설명 토큰 수, taste-skill과 jakubkrehel/skills의 설치 구조·외부 호출 여부는 확인된 주장이 0건입니다. 이것은 '그런 근거가 없다'는 뜻이 아니라 '확인하지 못했다'는 뜻이고, 그래서 '더 잘 만들게 하는가'라는 첫 판정 기준에 답할 근거가 비어 있습니다. Impeccable이 무엇을 보내는지는 벤더 개인정보 처리방침과 소스 코드를 읽어 확인한 것이고, 패킷 캡처 같은 독립적인 네트워크 관측은 하지 않았습니다. 반박된 주장 4건은 근거로 쓰지 않습니다. ⓐ README가 4개 CLI 지원 목록을 싣고 npx skills를 언급하지 않는다는 주장 ⓑ FAQ의 지원 CLI 목록 ⓒ FAQ가 말한다는 'update는 PRODUCT.md·DESIGN.md를 보존하고 기존 디자인 정체성을 따른다' ⓓ frontend-design이 클리셰 5군을 명시해 anti-slop 범위에서 겹친다는 주장입니다. 이에 따라 Impeccable이 기존 디자인 시스템을 존중하는지, 두 스킬이 정확히 어디서 겹치는지는 확인되지 않았습니다. frontend-design의 '디자인 시스템 덮어쓰기'는 본문에 보존 지시가 없다는 데서 나온 추론이고 관측된 사례가 아닙니다. 시간에 민감한 부분도 있습니다. Impeccable은 거의 매일 커밋되고 송신 정책도 최근까지 바뀌었습니다(텔레메트리 v2는 2026-10-12, opt-out 헤더는 v4.6.0부터, 개인정보 처리방침은 2026-10-21 갱신). 그러니 판정 문서에 확인 날짜(2026-11-02)와 판(v4.8.0, engine-v0.1.18)을 적어야 합니다. 스타 수(약 10만)는 검증자가 관측한 근삿값입니다.

## 열린 질문

- `npx skills add pbakaus/impeccable`로 깐 공유 빌드가 하네스의 4개 CLI(특히 OpenCode·Antigravity)에서 실제로 로드되고 동작하는가? 훅 없이 자동 검사가 빠졌을 때 남는 가치는 얼마인가? 컨테이너 실설치(`test/docker/run.sh`)로 확인해야 한다.
- 같은 UI 과제(새 랜딩 페이지 1건, 디자인 시스템이 있는 기존 앱 화면 1건)에서 frontend-design, Impeccable, taste-skill, better-*의 결과 품질과 실행 시간·토큰은 어떻게 다른가? 공개 비교가 확인되지 않아 자체 A/B가 필요하고, taste의 '30~45분·수십만 토큰' 주장도 이 실측으로 판정한다.
- Impeccable은 디자인 시스템이 이미 있는 프로젝트에서 기존 토큰과 `DESIGN.md`를 보존하는가, 덮어쓰는가? FAQ 주장이 반박됐으므로 실제 실행으로 확인해야 한다.
- 하네스의 `npx skills` 설치가 skills.sh 설치 텔레메트리를 끄지 않는 것(`DO_NOT_TRACK`, `DISABLE_TELEMETRY` 미설정)을 그대로 둘 것인가? 프로젝트 내용은 실리지 않지만 설치자의 에이전트와 스킬 목록이 나가고, 이는 네 스킬 모두에 해당한다.

## 기각된 주장(0-3 등)

- (0-3) Impeccable installs through its own CLI (`npx impeccable install`), not `npx skills`. The installer detects the coding tools in use, asks whether to install for the project or globally, and offers to add a design hook where the tool supports one. The supported tools listed include Claude Code, Codex CLI, OpenCode, Gemini CLI and Google Antigravity. Neither `npx skills` nor skills.sh appears in the README. — https://github.com/pbakaus/impeccable
- (0-3) Impeccable has two install routes. `npx impeccable install` is its own CLI installer: it asks which coding tool to target, whether to install for this project or all projects, and needs Node.js 18.19 or later. `npx skills add pbakaus/impeccable` installs only a generic shared build, and the FAQ says Impeccable's own installer is the one that picks a tool-specific build. The FAQ names Codex, Cursor, Devin, Gemini CLI, GitHub Copilot and Replit Agent as supported tools, but this page does not name Claude Code, OpenCode or Antigravity. — https://impeccable.style/faq
- (0-3) On existing project design files: an update replaces Impeccable's own installed files but leaves the project's PRODUCT.md and DESIGN.md alone. Generate and live modes follow the project's existing design identity unless the user asks to change it. Overwriting an existing installation requires the explicit --force flag. — https://impeccable.style/faq
- (0-3) The skill explicitly lists five clusters of AI-generated design clichés (cream background with terracotta accent, near-black with acid-green accent, broadsheet layout, the SaaS-card kit, and template chrome such as ALL-CAPS eyebrows and trailing arrows). It says the brief's explicit visual direction always wins over its anti-default guidance. This 'anti-slop' scope is the main area where it overlaps with Impeccable and taste-skill. — https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md

## 수집한 출처

- https://github.com/pbakaus/impeccable
- https://impeccable.style/privacy
- https://impeccable.style/docs/hooks
- https://impeccable.style/faq
- https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/scripts/impeccable
- https://github.com/pbakaus/impeccable/blob/main/crates/context/src/telemetry.rs
- https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/reference/new-work.md
- https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md
- https://github.com/pbakaus/impeccable/blob/main/.claude/skills/impeccable/SKILL.md
- https://www.paralect.com/skills/top-design-skills
- https://devtoollab.com/blog/ai-taste-skills
- https://andrew.ooo/posts/impeccable-review-design-skill-coding-agents-ai-slop/
- https://github.com/Leonxlnx/taste-skill/blob/main/CHANGELOG.md
- https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/references/research.md
- https://github.com/Leonxlnx/taste-skill
- https://github.com/jakubkrehel/skills
- https://github.com/jakubkrehel/skills/issues/22
- https://code.claude.com/docs/en/skills
- https://github.com/jakubkrehel/skills/issues/50
- https://github.com/jakubkrehel/skills/pull/19
- https://jamesyong-42.github.io/claude-code-skills-study/

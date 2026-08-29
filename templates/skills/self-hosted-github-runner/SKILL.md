---
name: self-hosted-github-runner
description: >
  GitHub 호스티드 러너를 못 쓰게 됐을 때, 레포의 기존 워크플로를 **그대로** 자기 머신의 Docker
  self-hosted runner 에서 돌리게 만든다. 결제 실패·지출한도·분(minutes) 소진·조직 쿼터·Actions
  장애로 CI 가 멈췄을 때, "CI 를 로컬에서 돌리자"·"self-hosted runner"·"act 로 돌릴까"·"CI 죽었는데
  머지·배포 어떻게 하냐"는 말이 나올 때 쓴다. **누군가 "CI 스텝을 스크립트에 옮겨 적어 로컬에서
  돌리자"고 제안할 때도 반드시 이 스킬을 켠다** — 그 안은 워크플로를 두 벌로 갈라놓고, 갈라진
  순간부터 로컬 초록이 CI 초록을 뜻하지 않게 되기 때문이다.
---

# Self-Hosted GitHub Runner

CI 가 멈췄을 때 **검증을 포기하지 않고, 동시에 검증을 위조하지도 않는** 방법.

## 이 스킬이 막으려는 것

CI 가 멈추면 두 가지 유혹이 온다.

1. **그냥 배포한다.** 게이트를 한 번 건너뛰면 다음에도 건너뛴다.
2. **CI 스텝을 로컬 스크립트에 베껴 적는다.** 이게 더 위험하다 — 초록이 나오니까 검증한 것처럼
   보이는데, 워크플로에 스텝이 하나 추가되는 순간 스크립트는 그걸 모른 채 계속 초록을 낸다.
   **검증을 잃은 것보다 나쁜 것은, 잃은 줄 모르는 것이다.**

self-hosted runner 는 워크플로 파일 **자체**를 실행한다. 복제본이 0이므로 드리프트가 구조적으로
불가능하고, PR 상태 체크·태그 트리거·필수 체크가 전부 그대로 살아 있다.

## Step 0 — 정말 인프라 문제인지 먼저 가른다

"CI 가 빨갛다"에서 곧바로 러너로 뛰지 마라. 코드가 깨진 건데 인프라 탓으로 돌리면 결함을
러너 뒤에 숨기게 된다. **대조군으로 가른다** — 시각 기준으로 갈리면 인프라, 커밋 기준으로
갈리면 코드다.

```bash
gh run list --workflow=<wf>.yml --limit 10 \
  --json createdAt,headSha,conclusion,event \
  --jq '.[] | "\(.createdAt)  \(.headSha[0:7])  \(.event)  \(.conclusion)"'
```

잡이 **스텝 0개로 몇 초 만에** 죽었다면 잡이 시작조차 못 한 것이다. 실제 사유는 어노테이션에 있다:

```bash
JOB=$(gh api repos/<owner>/<repo>/actions/runs/<run-id>/jobs --jq '.jobs[0].id')
gh api repos/<owner>/<repo>/check-runs/$JOB/annotations --jq '.[].message'
```

실측 예: `"The job was not started because recent account payments have failed or your spending
limit needs to be increased."` — 이건 코드와 무관하다.

## Step 1 — 워크플로를 복제하지 않고 전환 가능하게 만든다

`runs-on` 은 `vars` 컨텍스트를 받는다(공식 Context availability 표). 그래서 **한 줄**로 옮길 수 있다:

```yaml
jobs:
  build:
    runs-on: ${{ vars.CI_RUNNER_LABEL || 'ubuntu-latest' }}
```

변수를 설정하면 self-hosted 로, 지우면 호스티드로 돌아온다. 워크플로 파일을 복사하거나 `if:` 로
잡을 두 벌 만들지 마라 — 그게 바로 이 스킬이 막으려는 드리프트다.

전 잡에 적용해야 한다. 하나라도 빠뜨리면 그 잡만 호스티드를 기다리다 영원히 큐에 남는다.

## Step 2 — 아키텍처를 **재고 나서** 정한다

self-hosted 머신이 Apple Silicon 이면 arm64 다. 워크플로가 `ubuntu-latest`(x64)를 전제하고 쓴
것들이 여기서 깨진다. 두 선택지가 있고, **추측하지 말고 재라**:

```bash
for P in linux/arm64 linux/amd64; do
  docker run --rm --platform $P node:22-bookworm-slim node -e "
    const s=Date.now(); let h=0; for(let i=0;i<8e6;i++){h=(h*31+i)>>>0;}
    console.log('$P ms='+(Date.now()-s));"
done
```

실측 사례(M-series, Docker Desktop): arm64 **127ms** vs amd64 **497ms** — 에뮬레이션이 3.9배 느렸다.

**그런데 이 숫자로 고르지 마라.** 나도 이걸 보고 arm64 를 골랐다가 되돌렸다. 속도는 **의존성이
그 아키텍처에서 실제로 도는 다음**의 기준이다 — 돌지 않는 것이 빠를 수는 없다. 네이티브 모듈
하나만 prebuild 가 없어도 테스트 스위트가 통째로 죽는다.

**기본값은 `ubuntu-latest` 와 같은 amd64 로 두고**, arm64 는 "이 레포의 네이티브 의존성이 arm64
prebuild 를 갖고 있다"를 확인한 뒤에 성능 최적화로 택하라. 아키텍처를 맞춰 두면 실패했을 때
"CI 환경이 달라서인가"를 먼저 의심하지 않아도 된다 — 그 의심을 지우는 값이 3.9배보다 크다.

### 흔히 깨지는 것: 아키텍처 하드코딩된 도구 설치

```yaml
# 깨진다 — arm64 러너에서 x64 바이너리는 실행되지 않는다
curl -sSfL ".../gitleaks_${VERSION}_linux_x64.tar.gz" -o /tmp/t.tar.gz
echo "${EXPECTED}  /tmp/t.tar.gz" | sha256sum -c -
```

```yaml
# 고친 것 — 핀을 버리지 않고 아키텍처별로 둔다
case "$(uname -m)" in
  x86_64)  ASSET=linux_x64;   EXPECTED=<x64 sha> ;;
  aarch64) ASSET=linux_arm64; EXPECTED=<arm64 sha> ;;
  *) echo "지원하지 않는 아키텍처: $(uname -m) — 핀을 추가하세요" >&2; exit 1 ;;
esac
```

**해시는 릴리스의 공식 checksums 파일에서 옮겨 적는다.** 직접 받아서 계산하면 "검증하려던 대상으로
검증값을 만드는" 꼴이라 공급망 핀의 의미가 사라진다. 옮겨 적은 뒤 기존 핀과 대조해 같은 출처인지
확인하면 좋다. 미지원 아키텍처는 조용히 넘어가지 말고 **exit 1** — 스킵은 "검사했는데 통과"로 읽힌다.

### 더 고약한 것: 캐시 키가 아키텍처를 구분하지 않는다

`runner.os` 는 x64 든 ARM64 든 **똑같이 `Linux`** 다. 그래서 이 키는 두 아키텍처에서 충돌한다:

```yaml
key: node-modules-${{ runner.os }}-node22-${{ hashFiles('package-lock.json') }}   # 깨진다
key: node-modules-${{ runner.os }}-${{ runner.arch }}-node22-${{ hashFiles(...) }} # 고친 것
```

x64 러너가 올린 `node_modules` 를 ARM64 러너가 그대로 복원하고, 캐시 히트라 `npm ci` 는 건너뛴다.
네이티브 바인딩만 다른 아키텍처 것이라 **캐시·설치 스텝은 전부 초록으로 찍히고 두세 스텝 뒤에
테스트가 죽는다** — 실측:

```
Cannot find module '@rolldown/binding-linux-arm64-gnu'
```

원인 스텝과 증상 스텝이 떨어져 있어서 "테스트가 깨졌다"로 오진하기 딱 좋다. **아키텍처를 바꿔
러너를 옮길 때는 캐시 키부터 확인하라.** 같은 함정이 `~/.cache`·pip·cargo·Go 빌드 캐시에도 있다.

**이건 self-hosted 로 옮겨야만 드러나는 결함이다.** 호스티드만 쓰는 동안에는 전부 x64 라 영원히
숨어 있는다 — 옮기는 김에 잡은 것이고, 고친 값은 호스티드에서도 그대로 옳다.

## Step 3 — 러너를 컨테이너로 띄운다

호스트에 직접 붙이지 말고 Linux 컨테이너에서 돌린다. 워크플로는 리눅스를 전제한다(`apt-get`,
`sha256sum`, `/tmp` 경로, `--with-deps`). macOS 호스트에 러너를 붙이면 그 전제가 전부 깨진다.

### 이미지의 **베이스 OS 를 `ubuntu-latest` 와 맞춰라** — `latest` 태그를 믿지 마라

러너 이미지의 `latest` 가 최신 Ubuntu 라는 보장이 없다. 실측: `myoung34/github-runner:latest` 는
**Ubuntu 20.04(glibc 2.31)**, GitHub 의 `ubuntu-latest` 는 **24.04(glibc 2.39)** — 두 세대 차이다.

그 차이가 이렇게 나타난다:

```
Error: Cannot find addon '.' imported from '…/sodium-native/binding.js'
Candidates:
- file:///…/sodium-native/prebuilds/linux-x64/sodium-native.node    ← 이 파일은 실제로 있다
```

**메시지가 거짓말을 한다.** "찾을 수 없다"고 하지만 파일은 919KB 짜리로 멀쩡히 있고, 실제로는
`dlopen` 이 실패한 것이다. 원인은 `ldd` 로만 보인다:

```bash
ldd node_modules/<pkg>/prebuilds/linux-x64/<pkg>.node
# → version `GLIBC_2.33' not found (required by …)
```

**네이티브 모듈이 "파일을 못 찾는다"고 하면 파일 유무부터 확인하고, 있으면 `ldd` 를 걸어라.**
없는 파일을 찾아 헤매는 것이 이 함정의 본체다. 우리는 이걸 "설치가 깨졌나 → 아키텍처 문제인가 →
npm 캐시인가"로 몇 시간 쫓다가 결국 `ldd` 한 줄로 끝냈다.

착수 전에 재는 편이 싸다:

```bash
docker run --rm --entrypoint sh <이미지> -c 'grep PRETTY_NAME /etc/os-release; ldd --version | head -1'
```

띄우기·내리기·상태확인을 스크립트 하나로 묶어 두면 원복(Step 5)까지 한 곳에 남는다. 핵심은 이것이다:

```bash
TOKEN=$(gh api -X POST /repos/<owner>/<repo>/actions/runners/registration-token --jq .token)

ENVFILE=$(mktemp); chmod 600 "$ENVFILE"
cat > "$ENVFILE" <<EOF
REPO_URL=https://github.com/<owner>/<repo>
RUNNER_NAME=local-docker
RUNNER_TOKEN=$TOKEN
RUNNER_WORKDIR=/tmp/runner/work
LABELS=<고유 라벨>
EPHEMERAL=true
EOF

docker run -d --name ci-runner --env-file "$ENVFILE" \
  -v ci-runner-work:/tmp/runner myoung34/github-runner:latest
rm -f "$ENVFILE"

gh variable set CI_RUNNER_LABEL --body '<고유 라벨>' --repo <owner>/<repo>
```

### 안전한 기본값 세 가지 — 하나씩 이유가 있다

**1. 라벨에 `self-hosted` 를 쓰지 마라.** GitHub 이 **모든** self-hosted 러너에 자동으로 붙이는
기본 라벨이다. 타깃으로 쓰면 나중에 이 레포·조직에 러너가 하나만 더 붙어도 우리 잡을 가져간다.
`<repo>-local` 처럼 고유한 값을 쓴다.

**2. `EPHEMERAL=true`.** 비-ephemeral 러너는 잡 사이에 작업 디렉터리와 프로세스 상태가 남는다 —
한 잡이 심어 놓은 것이 다음 잡에서 실행된다(러너 오염). ephemeral 이면 잡 하나를 처리하고
등록을 스스로 해제한다. **다음 잡을 돌리려면 다시 띄워야 해서 불편한데, 그 불편이 곧 격리다.**

**3. 등록 토큰을 `-e` 로 넘기지 마라.** `docker inspect` 에 평문으로 남는다. 600 권한 임시 파일로
넘기고 곧바로 지운다. 토큰 자체는 1시간 유효·등록 시 1회 소비지만, 그 사이에 남길 이유가 없다.

### `services:` 를 쓸 때만 docker.sock 을 붙인다 — 기본은 끈다

워크플로에 `services: postgres` 같은 게 있으면 러너가 컨테이너를 만들 수 있어야 하고, 그래서
`/var/run/docker.sock` 을 마운트하게 된다.

**이건 사실상 호스트 장악 권한이다** — 그 소켓에 닿는 코드는 호스트 파일시스템을 마운트한 root
컨테이너를 띄울 수 있다. 필요 없는 잡까지 이 권한 아래 돌리지 마라. 워크플로에 `services:` 가
없으면 **빼라.**

**소켓만 주면 반쯤만 동작한다 — `--network host` 가 같이 필요하다.** 러너가 컨테이너 안이면
서비스 컨테이너는 **호스트 포트**에 게시되는데, 워크플로는 `localhost:5432` 를 본다. GitHub
호스티드는 잡이 VM 위에서 돌아 localhost 가 곧 게시 대상이라 이 차이가 안 보인다. 실측하면
`db:migrate` 가 **에러 메시지도 없이 exit 1** 한다 — 연결 실패라고 말해 주지 않아서 마이그레이션
파일을 먼저 뒤지게 된다. 두 옵션은 하나로 묶어 두는 게 낫다.

호스트 포트가 컨테이너에서 보이는지 먼저 재라(대조군 포함):

```bash
docker run -d --name probe -p 55999:5432 -e POSTGRES_PASSWORD=x postgres:16
docker run --rm postgres:16 pg_isready -h host.docker.internal -p 55999   # 대조군
docker run --rm --network host postgres:16 pg_isready -h localhost -p 55999
docker rm -f probe
```

## 가장 큰 위험: PR 이 내 머신에서 돈다

워크플로가 `on: pull_request` 로 돌면, 러너가 켜져 있는 동안 **모든 PR 의 CI 가 내 머신에서**
실행된다. private 레포라고 안심하면 안 된다 — 위험은 "누가 PR 을 여는가"가 아니라 **"그 잡이
무슨 코드를 실행하는가"** 에서 온다:

- **의존성 bump PR**(dependabot 등)은 새 패키지를 설치한다 → 그 패키지의 `postinstall` 이 내
  머신에서 실행된다. 워크플로 파일이 base 브랜치 것이어도 **설치되는 코드는 PR 것**이다.
- 저장소 협업자가 여는 PR 도 마찬가지다. 신뢰는 사람에 대한 것이지 그 사람이 끌어오는 트랜지티브
  의존성에 대한 것이 아니다.

public 레포면 **하지 마라.** fork PR 이 임의 코드를 실행한다 — GitHub 이 명시적으로 말린다.

private 레포라면 착수 전에 실측해서 알린다:

```bash
grep -rl "pull_request" .github/workflows/
gh pr list --state open --json headRefName \
  --jq '[.[] | select(.headRefName|startswith("dependabot/"))] | length'
```

**결정은 사용자 몫이다.** 짧게 쓰고 내릴 거면 그대로 두고, 오래 켜둘 거면 의존성 PR 을 먼저
닫거나, self-hosted 를 태그·수동 실행에만 쓰고 PR CI 는 복구될 때까지 비워 둔다. 조용히
켜 두지는 마라.

## Step 4 — 도는지 확인하고, 그다음에 "된다"고 말한다

등록됐다 ≠ 잡이 배정된다. 둘은 다른 사건이다.

```bash
gh api /repos/<owner>/<repo>/actions/runners \
  --jq '.runners[] | "\(.name) status=\(.status) labels=" + ([.labels[].name]|join(","))'

gh workflow run <wf>.yml --ref <branch>
# 잡이 실제로 시작하는지 본다 — queued 에서 안 움직이면 라벨이 안 맞는 것이다
```

**결제 실패 계정에서도 self-hosted 러너에는 잡이 배정된다** — 2026-08-20 실측. 같은 레포에서
호스티드 잡은 `"The job was not started because recent account payments have failed…"` 로 2~4초 만에
스텝 0개로 죽었는데, self-hosted 로 라벨을 옮기니 같은 워크플로가 정상적으로 스텝을 밟았다.
공식 문서는 "GitHub Actions usage is free for self-hosted runners"까지만 말하고 이 경우를 명시하지
않으므로, 다른 계정 상태(정지·organization 제재 등)에서도 같으리라 단정하지는 마라 — 확인하고 쓴다.

**등록 API 의 `status` 를 믿지 마라.** 컨테이너 로그에 `Listening for Jobs` 가 찍힌 뒤에도 API 가
잠시 `offline` 을 돌려준다. 등록 확인은 **컨테이너 로그**로, 배정 확인은 **잡이 실제로
`in_progress` 로 넘어가는지**로 한다.

큐에서 안 움직일 때 볼 것: 라벨 불일치(`runs-on` 값 ≠ 러너 `LABELS`) · 변수 미설정 · 러너 offline ·
그 워크플로의 `if:` 조건 미충족 · **ephemeral 러너가 앞 잡을 처리하고 이미 내려갔다**(잡이 2개 이상인
워크플로에서 흔하다 — 두 번째 잡은 영원히 큐에 남는다).

## Step 5 — 원복 경로를 먼저 만들어 두고 시작한다

임시 조치는 **끝내는 방법이 있을 때만 임시**다. 없으면 그냥 새 영구 상태다.

```bash
gh variable delete CI_RUNNER_LABEL --repo <owner>/<repo>   # 호스티드로 복귀
ID=$(gh api /repos/<owner>/<repo>/actions/runners --jq '.runners[]|select(.name=="local-docker")|.id')
gh api -X DELETE /repos/<owner>/<repo>/actions/runners/$ID  # 등록 해제
docker rm -f ci-runner
```

**등록 해제를 빼먹지 마라.** 컨테이너만 지우면 GitHub 에는 offline 러너가 남고, 그 라벨로 오는
잡은 영영 큐에 머문다.

## 자원 — 조용히 느려지는 것보다 미리 말하는 게 낫다

Docker Desktop 기본 할당은 대개 CPU 2·RAM 2~4GB 다. 테스트 수백 파일 + 빌드 + 브라우저 E2E 를
돌리는 CI 에는 부족하고, **OOM 은 코드 결함처럼 보이는 실패로 나타난다.**

```bash
docker info --format 'CPU {{.NCPU}} · RAM {{.MemTotal}}'
```

부족하면 착수 전에 알린다(권장 CPU 6+ · RAM 12GB+). 여기서 막지는 말되, 나중에 "왜 이렇게
느리냐"는 질문이 나오게 두지도 마라.

## `act` 를 먼저 검토했는가

[`nektos/act`](https://github.com/nektos/act) 은 워크플로를 로컬 도커에서 실행한다. **드리프트 0이라는
장점은 같다.** 진짜 러너 대신 act 가 나은 경우가 있다:

| | self-hosted runner | `act` |
|---|---|---|
| PR 상태 체크·필수 체크 | **살아난다** | 안 된다(GitHub 이 결과를 모른다) |
| 태그·스케줄 트리거 | 그대로 | 수동 재현 |
| 결제·쿼터 의존 | 확인 필요(Step 4) | 완전 무관 |
| 설정 비용 | 등록·원복 필요 | 설치만 |
| 아키텍처 하드코딩 스텝 | 같이 깨진다 | 같이 깨진다 |

**PR 게이트·배포 게이트를 되살리는 게 목적이면 러너**, 그냥 로컬에서 워크플로를 돌려보고 싶은
거면 `act` 다. 목적을 먼저 묻고 고른다.

## 보고할 때

이 조치로 돌린 CI 는 **평소와 다른 환경**에서 돈 것이다. 그 사실을 숨기지 않는다 — 특히 배포
게이트로 쓴 경우.

적을 것: 어느 러너에서 돌았나(호스티드/self-hosted, 아키텍처) · 워크플로를 고쳤다면 무엇을 ·
평소 CI 와 달라진 것 · 아직 확인 못 한 것.

"CI 통과"라고만 적으면 다음 사람은 GitHub 호스티드에서 통과한 줄 안다.

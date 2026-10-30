#!/usr/bin/env bash
# Temporary ephemeral self-hosted runner for the current GitHub repository, in a Linux container.
#
# Usage (from the repository root):
#   bash <skill>/scripts/runner.sh up [--jobs N] [--docker]  # serve N jobs, then set CI_RUNNER_LABEL
#   bash <skill>/scripts/runner.sh down                      # restore hosted runners
#   bash <skill>/scripts/runner.sh status                    # variable, registered runners, container
#
# Environment (all optional):
#   REPO      owner/name              default: gh repo view
#   LABEL     runs-on label           default: <name>-local (never a GitHub default label)
#   PLATFORM  linux/arm64|linux/amd64 default: the host hardware (Apple Silicon → arm64, even under Rosetta)
#   IMAGE     runner image            default: myoung34/github-runner:ubuntu-noble (= ubuntu-latest's 24.04)
#
# --jobs N   ephemeral runners serve one job each: N = the jobs this event will actually run
#            (matrix legs count, jobs skipped by `if:` do not). Interrupted? run `down`.
# --docker   mount the host Docker socket and use host networking — only for `services:` /
#            Docker-based jobs. It gives jobs host-level control; leave it off otherwise.
# The registration token goes in through a 600 file mounted read-only, never through the
# container's environment config, so `docker inspect` does not show it.
# Exit codes: 2 usage · 3 refused or GitHub state unknown · 4 runner failed to start.
set -euo pipefail

SELF=$0
die() { echo "runner.sh: $1" >&2; exit "${2:-3}"; }
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }
for bin in gh docker; do command -v "$bin" >/dev/null || die "$bin not found"; done

REPO=${REPO:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}
[ -n "$REPO" ] || die "cannot resolve the repository; set REPO=owner/name"
LABEL=${LABEL:-${REPO#*/}-local}
NAME="${REPO%/*}-${REPO#*/}-runner"
IMAGE=${IMAGE:-myoung34/github-runner:ubuntu-noble}
if [ -z "${PLATFORM:-}" ]; then
  arch=$(uname -m)
  # A Rosetta shell on Apple Silicon reports x86_64; ask the hardware instead.
  [ "$(uname -s)" = Darwin ] && [ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" = 1 ] && arch=arm64
  case "$arch" in
    arm64|aarch64) PLATFORM=linux/arm64 ;;
    x86_64|amd64)  PLATFORM=linux/amd64 ;;
    *) die "unknown host architecture $arch; set PLATFORM" ;;
  esac
fi
case "$(lower "$LABEL")" in
  self-hosted|linux|macos|windows|x64|arm64|arm)
    die "LABEL=$LABEL is a default label that any self-hosted runner matches" ;;
esac

# Prints the current CI_RUNNER_LABEL. Returns 1 only when GitHub says it does not exist;
# any other failure (auth, network, rate limit) stops the script rather than reading as unset.
label_var() {
  local out
  if out=$(gh api "/repos/$REPO/actions/variables/CI_RUNNER_LABEL" --jq .value 2>&1); then
    printf '%s' "$out"; return 0
  fi
  case "$out" in *"HTTP 404"*) return 1 ;; esac
  die "cannot read CI_RUNNER_LABEL: $out"
}
read_label() {  # sets CURRENT; exits on an unknown state
  local rc=0
  CURRENT=$(label_var) || rc=$?
  [ "$rc" -le 1 ] || exit "$rc"
}

TOKENFILE=""
VAR_SET=0
cleanup() {
  local rc=$?
  [ -z "$TOKENFILE" ] || rm -f "$TOKENFILE"
  if [ "$rc" -ne 0 ] && [ "$VAR_SET" = 1 ]; then
    echo "runner.sh: stopped with CI_RUNNER_LABEL=$LABEL still set; restore with: bash $SELF down" >&2
  fi
}
trap cleanup EXIT
trap 'exit 130' INT TERM

launch() {
  local -a extra=()
  # Under $HOME, not $TMPDIR: engines like Colima share only the home directory with the VM.
  TOKENFILE=$(mktemp "$HOME/.runner-token.XXXXXX"); chmod 600 "$TOKENFILE"
  gh api -X POST "/repos/$REPO/actions/runners/registration-token" --jq .token > "$TOKENFILE"
  [ "$DOCKER" = 1 ] && extra=(-v /var/run/docker.sock:/var/run/docker.sock --network host)
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --platform "$PLATFORM" \
    -e "REPO_URL=https://github.com/$REPO" -e "RUNNER_NAME=$NAME" -e "LABELS=$LABEL" \
    -e RUNNER_WORKDIR=/tmp/runner/work -e EPHEMERAL=true \
    -v "$TOKENFILE:/run/runner-token:ro" ${extra[@]+"${extra[@]}"} \
    --entrypoint bash "$IMAGE" \
    -c 'RUNNER_TOKEN=$(cat /run/runner-token); export RUNNER_TOKEN; exec /entrypoint.sh ./bin/Runner.Listener run --startuptype service' \
    >/dev/null
  for _ in $(seq 1 40); do
    if docker logs "$NAME" 2>&1 | grep -q "Listening for Jobs"; then
      rm -f "$TOKENFILE"; TOKENFILE=""
      return 0
    fi
    [ "$(docker inspect -f '{{.State.Running}}' "$NAME" 2>/dev/null)" = true ] || break
    sleep 3
  done
  docker logs "$NAME" 2>&1 | tail -5 >&2
  die "runner did not start listening" 4
}

cmd=${1:-}; shift || true
case "$cmd" in
  up)
    JOBS=1; DOCKER=0
    while [ $# -gt 0 ]; do
      case "$1" in
        --jobs) [ $# -ge 2 ] || die "--jobs needs a number" 2; JOBS=$2; shift 2 ;;
        --docker) DOCKER=1; shift ;;
        *) die "unknown option $1" 2 ;;
      esac
    done
    case "$JOBS" in ''|*[!0-9]*|0*) die "--jobs must be a positive integer" 2 ;; esac
    visibility=$(gh api "/repos/$REPO" --jq .visibility)
    [ -n "$visibility" ] || die "cannot read $REPO visibility"
    [ "$visibility" != public ] || die "$REPO is public: fork PRs would run arbitrary code on this machine"
    read_label
    [ -z "$CURRENT" ] || [ "$CURRENT" = "$LABEL" ] || die "CI_RUNNER_LABEL is already '$CURRENT'; not overwriting"
    echo "repo=$REPO label=$LABEL platform=$PLATFORM docker=$DOCKER jobs=$JOBS"
    for i in $(seq 1 "$JOBS"); do
      launch
      echo "runner $i/$JOBS listening"
      if [ "$VAR_SET" = 0 ]; then
        # Route jobs here only once a runner is listening, so a failed start leaves CI as it was.
        [ "$CURRENT" = "$LABEL" ] || gh variable set CI_RUNNER_LABEL --body "$LABEL" --repo "$REPO"
        VAR_SET=1
      fi
      docker wait "$NAME" >/dev/null
      docker logs "$NAME" 2>&1 | grep -E "Running job|completed with result" || true
      docker rm -f "$NAME" >/dev/null 2>&1 || true
    done
    echo "served $JOBS job(s); restore hosted runners with: bash $SELF down"
    ;;
  down)
    read_label
    if [ "$CURRENT" = "$LABEL" ]; then
      gh api -X DELETE "/repos/$REPO/actions/variables/CI_RUNNER_LABEL" >/dev/null
    elif [ -n "$CURRENT" ]; then
      echo "CI_RUNNER_LABEL is '$CURRENT', not '$LABEL'; left as is" >&2
    fi
    ids=$(gh api "/repos/$REPO/actions/runners" --jq ".runners[]|select(.name==\"$NAME\")|.id")
    for id in $ids; do
      gh api -X DELETE "/repos/$REPO/actions/runners/$id"
    done
    docker rm -f "$NAME" >/dev/null 2>&1 || true
    read_label
    [ "$CURRENT" != "$LABEL" ] || die "CI_RUNNER_LABEL is still '$LABEL'"
    echo "restored: $NAME unregistered and removed; CI_RUNNER_LABEL is ${CURRENT:-unset}"
    ;;
  status)
    read_label
    echo "CI_RUNNER_LABEL=${CURRENT:-<unset>}"
    gh api "/repos/$REPO/actions/runners" --jq '.runners[] | "\(.name) \(.status) " + ([.labels[].name]|join(","))'
    docker ps -a --filter "name=^${NAME}$" --format '{{.Names}} {{.Status}}'
    ;;
  *) sed -n '2,21p' "$0" >&2; exit 2 ;;
esac

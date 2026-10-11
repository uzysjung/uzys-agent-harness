# Direct calls (no wrapper)

The harness installs the whole skill directory, `scripts/` included, on every CLI.
When the wrappers are missing anyway (a hand-copied or partial SKILL.md), prefer
restoring the complete skill folder; use these only as CLI-mechanics examples.
The short examples below show a neutral throwaway cwd, explicit binary
resolution, and a subshell; they do **not** reproduce the wrappers' environment
allowlist, secret-shaped-prompt gate, timeout, or all image-mode restrictions.
Preserve those existing safeguards before making a direct call; a missing script
is not permission to drop them. Resolve this reference and the `scripts/`
directory from `<skill-dir>` — the directory of the SKILL.md actually read — not
the current project directory.

Notes before either block:

- Never run these from the repo root. `agy` and `codex` are *agents*: starting in
  the project can expose repo context to the provider. A neutral cwd reduces this
  ambient context but does not block absolute-path reads or global configuration.
  Read-only mode restricts writes; it does not isolate filesystem reads.
- Keep the `cd` inside `( )`. In an interactive terminal a bare `cd` persists after
  the block and silently relocates every later command.
- Consulting the same model you are running on is usually circular. On Antigravity
  you already are Gemini; on the Codex CLI you already are codex. A fresh session
  is only worth it deliberately (e.g. a separate brief without this conversation's
  history). It is not guaranteed independent of prompt framing or global settings.

## Gemini (`agy`) — text

```bash
(
  AGY="${AGY_BIN:-$(command -v agy || echo "$HOME/.local/bin/agy")}"
  [ -x "$AGY" ] || { echo "agy not found — ask the user to install it" >&2; exit 3; }
  "$AGY" models   # → read the list, pick a slug for the tier you want:
                  #   gemini-*-pro-* · claude-*
  D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT
  cd "$D" && "$AGY" --model="<slug>" -p "PROMPT"
)
```

Read the slug out of `agy models` rather than typing one from memory — agy rejects
a retired model outright (`invalid model selection`, exit 1), so a remembered name
fails the whole call.

**Flag-order gotcha** (the wrapper handles this): `--model=...` must come *before*
`-p`, and the prompt must be the value immediately after `-p`. A flag placed
between `-p` and the prompt makes agy ignore the prompt entirely — you get an
answer to nothing.

## Gemini — image generation

Headless agy denies the shell permission a "save to cwd" would need, so generate
only and collect from the artifact store afterwards:

```bash
(
  AGY="${AGY_BIN:-$(command -v agy || echo "$HOME/.local/bin/agy")}"
  [ -x "$AGY" ] || { echo "agy not found — ask the user to install it" >&2; exit 3; }
  BRAIN="$HOME/.gemini/antigravity-cli/brain"
  M="$(mktemp)"; D="$(mktemp -d)"; trap 'rm -rf "$D" "$M"' EXIT
  cd "$D" && "$AGY" --model="<slug from agy models>" -p "PROMPT — 생성만 하고 셸 저장은 시도하지 마"
  find "$BRAIN" -type f \( -name '*.png' -o -name '*.jpg' \) -newer "$M"   # → report/copy these
)
```

## Codex — text

```bash
(
  CODEX="${CODEX_BIN:-$(command -v codex || echo "$HOME/.local/bin/codex")}"
  [ -x "$CODEX" ] || { echo "codex not found — ask the user to install it" >&2; exit 3; }
  D="$(mktemp -d)"; trap 'rm -rf "$D"' EXIT
  cd "$D" && "$CODEX" exec -s read-only --skip-git-repo-check --ephemeral \
    -o last.txt -- "PROMPT" >&2
  cat last.txt
)
```

## Codex — image generation

The requested `workspace-write` working directory is the throwaway dir, not the
repo. This does not prevent repo reads; retain the wrapper's shell-network and
other image-mode safeguards before using a direct invocation:

```bash
(
  CODEX="${CODEX_BIN:-$(command -v codex || echo "$HOME/.local/bin/codex")}"
  [ -x "$CODEX" ] || { echo "codex not found — ask the user to install it" >&2; exit 3; }
  D="$(mktemp -d)"   # no rm trap: generated files live here — report the paths
  cd "$D" && "$CODEX" exec -s workspace-write --skip-git-repo-check --ephemeral \
    -o last.txt -- "PROMPT (파일명 지정)" >&2
  cat last.txt; ls "$D"
)
```

**Gotchas these encode:** `codex exec` refuses to run outside a git repo without
`--skip-git-repo-check`; progress shares stdout with the answer unless the final
message is captured via `-o`; and `-i/--image` is **variadic** — a bare
`-i f.png PROMPT` swallows the prompt as a second image path, so use
`--image=f.png` plus `--` before the prompt.

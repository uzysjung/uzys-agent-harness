# Direct calls (no wrapper)

On CLIs where the harness installs only `SKILL.md` and not the `scripts/` sidecar,
fall back to these. They reproduce the wrapper's guardrails inline — the neutral
throwaway cwd, the explicit binary resolution, and the subshell. **Everything the
wrapper does that you skip here is a guardrail you are choosing to drop.**

Two notes before either block:

- Never run these from the repo root. `agy` and `codex` are *agents*: a bare run in
  the project dir pulls repo files into their workspace and ships them to the
  provider.
- Keep the `cd` inside `( )`. In an interactive terminal a bare `cd` persists after
  the block and silently relocates every later command.
- Consulting the same model you are running on is usually circular. On Antigravity
  you already are Gemini; on the Codex CLI you already are codex. A fresh isolated
  session is only worth it deliberately (e.g. for an uncontaminated second read, or
  a guaranteed read-only sandbox).

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

`workspace-write` is scoped to the throwaway dir, **never** the repo:

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

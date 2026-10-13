#!/usr/bin/env bash
# Put the irreversible git guards on the SERVER, not on every local command.
#
# Force-push to the default branch, direct pushes that skip review, and branch deletion are the
# operations you cannot undo from a laptop. A local hook checks them on every commit or push, can
# be skipped with --no-verify, and has to be reinstalled in every clone. A repository rule is
# evaluated once, by the host, for everyone — humans and agents alike.
#
# Usage:
#   bash protect-branch.sh              # apply (idempotent)
#   bash protect-branch.sh --dry-run    # print what would change, touch nothing
#
# Exit: 0 applied or already in place · 1 rule/API failure · 2 usage · 3 prerequisite missing
set -u

DRY_RUN=0
case "${1:-}" in
  --dry-run) DRY_RUN=1 ;;
  "") ;;
  *) echo "usage: bash protect-branch.sh [--dry-run]" >&2; exit 2 ;;
esac

RULESET_NAME="default-branch protection"

say() { printf '%s\n' "$*"; }
die() { printf '%s\n' "$*" >&2; exit "${2:-1}"; }

command -v gh >/dev/null 2>&1 || die "gh (GitHub CLI) not found — install it, or apply the same rules in the repo's web settings under Rules." 3
gh auth status >/dev/null 2>&1 || die "gh is not authenticated — run: gh auth login" 3

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner 2>/dev/null) \
  || die "not inside a GitHub repository (or no remote) — run this from a clone with an 'origin' on GitHub." 3
BRANCH=$(gh repo view --json defaultBranchRef --jq .defaultBranchRef.name)
say "repo: $REPO · default branch: $BRANCH"

# --- 1. branch ruleset -------------------------------------------------------
# Decide by the rules that are ACTUALLY in force on the branch, not by ruleset name. A name check
# reports "not protected" for an equivalent ruleset someone called something else, and then a
# re-run stacks a duplicate. This endpoint answers the question we actually have: what does the
# host enforce on this branch right now, whatever it was named or however many rulesets say it.
ACTIVE=$(gh api "repos/$REPO/rules/branches/$BRANCH" --jq '[.[].type] | unique | join(" ")' 2>/dev/null || echo "")
MISSING=""
for want in deletion non_fast_forward pull_request; do
  case " $ACTIVE " in *" $want "*) ;; *) MISSING="$MISSING $want" ;; esac
done

if [ -z "$MISSING" ]; then
  say "default branch already enforces: $ACTIVE — left as is."
elif [ "$DRY_RUN" -eq 1 ]; then
  say "[dry-run] would create ruleset '$RULESET_NAME' on $BRANCH — missing:$MISSING"
else
  # required_approving_review_count is 0 on purpose: a solo maintainer cannot approve their own
  # pull request, and a rule nobody can satisfy gets switched off rather than obeyed. The value
  # here is that changes land through a reviewable ref, not that a second person signs off.
  gh api "repos/$REPO/rulesets" -X POST --input - >/dev/null <<JSON || die "failed to create the ruleset — you need admin rights on $REPO."
{
  "name": "$RULESET_NAME",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash", "merge", "rebase"]
      }
    }
  ]
}
JSON
  say "ruleset created — deletion, force-push and unreviewed pushes to $BRANCH are now refused."
fi

# --- 2. secret push protection ----------------------------------------------
# Blocks a push that carries a recognised credential. Free on public repositories; on private ones
# it needs GitHub Advanced Security, so a failure here is reported and does not fail the script.
PUSH_PROT=$(gh api "repos/$REPO" --jq '.security_and_analysis.secret_scanning_push_protection.status' 2>/dev/null || echo unknown)

if [ "$PUSH_PROT" = "enabled" ]; then
  say "secret push protection already enabled."
elif [ "$DRY_RUN" -eq 1 ]; then
  say "[dry-run] would enable secret scanning + push protection (currently: $PUSH_PROT)"
else
  if gh api "repos/$REPO" -X PATCH \
      -f 'security_and_analysis[secret_scanning][status]=enabled' \
      -f 'security_and_analysis[secret_scanning_push_protection][status]=enabled' >/dev/null 2>&1; then
    say "secret push protection enabled."
  else
    say "could not enable secret push protection — private repositories need GitHub Advanced Security. The ruleset above is unaffected."
  fi
fi

# --- 3. what this does NOT cover --------------------------------------------
# Saying so is the point: an unstated gap gets mistaken for a covered one.
cat <<'GAPS'

Still not covered by any server rule:
  - `git reset --hard` and friends destroy uncommitted work locally; no host can see that.
  - Secrets that are not in a recognised credential format.
  - Anything pushed to branches other than the default one.
GAPS

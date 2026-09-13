# Apply Authorized Changes

## Confirm scope without repeating approval

Use the explicit request and valid recorded approvals. Named findings or a bounded
local cleanup criterion can authorize edits where project policy permits. An audit,
"inspect", or "do not edit" request does not. Respect required exact-action / target
or destructive-operation approval; a broad goal does not replace it. Reuse existing
specific approval unless the scope, target, action, or material risk changed.

Revalidate changed sources and affected dependencies; do not rerun an unchanged full
audit. Before altering a finding, check current text and user worktree edits so the
approved patch still means the same thing. Continue independent authorized changes
when only one finding is unresolved. Defer disputed interpretation, not the whole task.

## Preserve ownership and recovery

Identify project-owned prose, harness-owned assets, generated output, and managed
markers/imports. Modify the canonical editable source within authorization. Preserve
unrelated text, local customizations, headings, language, and formatting. Update a
mirror only if its ownership and synchronization contract are known and in scope.
If an installer would overwrite the local fix, report the required source change;
do not silently edit generator code outside this skill's scope.

Ensure the prior content of a removal is recoverable. A clean tracked source can use
existing version history; dirty or untracked content needs an authorized snapshot.
Keep backups outside discoverable rule/skill paths so they do not become another
active copy. Do not commit, stage unrelated changes, or create remote state for backup.
If recovery or ownership is unclear, defer that removal with a precise reason.

## Apply a coherent patch

Implement supported rewrite, narrow, merge, relocate, or retire decisions; keep
uncertain hypotheses and protected controls unchanged. For relocation create or
confirm the destination first, preserve the history's factual status, and leave only
current operational guidance plus a useful on-demand link at the original location.

For a retired skill, check callers, import/routing lines, scripts, referenced assets,
registrations, package inclusion, and required gates. Remove or redirect authorized
prose references with the skill. Do not delete shared resources still used elsewhere.
If the dependency requires application/installer code, permission/hook configuration,
CI, or another unapproved change, leave the dependent unit intact and report it.
Do not hide obsolete routing, drop tests, or mark an incomplete retirement applied.

Maintain equivalent protected behavior when consolidating a duplicate statement.
Do not erase the only discoverable safety instruction because enforcement exists
elsewhere. Conversely, a generic "always make a plan" is not protected merely by
its emphatic wording. Policy changes to mandatory tests/review remain separate.

## Check the result and stop

Inspect the diff for approved scope, preserved meaning, unresolved conflicts, and
unrelated changes. Verify links and imports, frontmatter where applicable, package
resource inclusion, and dependent routing. Complete applicable required checks using
the project's actual commands; never weaken a check to obtain a pass. Reuse valid
results and run targeted optional checks only for effects of the patch.

Report each finding as applied, proposed, deferred, or superseded with its reason.
Distinguish file-level checks, product behavior not tested, and runtime loading not
observed. Report required review as pending when unavailable, not completed by
self-review. A repeated run with unchanged evidence should produce no unnecessary
rewrite, duplicate history, new approval, or renewed optional validation.

Stop after the approved patch and its checks. Do not redesign conventions, add
recurring audit hooks, or rewrite unrelated code. A future regression may justify
revisiting the affected finding; it does not justify an automatic full-audit loop.

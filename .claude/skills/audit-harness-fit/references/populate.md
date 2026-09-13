# Populate or Refresh Project Context

Fill existing AGENTS.md / CLAUDE.md project context from current repository evidence.
Keep its structure and language. Do not turn filling a scaffold into a full skill
audit, a new documentation system, or authorization to modify application code.

## Locate editable context

Read the target, relevant imports, fill markers, policy, and worktree changes.
Distinguish project-owned sections from shared principles, inline rules, generated
content, and managed blocks. Names alone do not define ownership: AGENTS.md may
contain both context and principles; CLAUDE.md may import a separate anchor.

For "fill", complete unresolved context sections only. For "refresh/update", update
supported stale project context too, preserving still-valid user content. Report
unrelated stale guidance instead of changing it. An explicit fill/update request
permits these bounded edits where policy allows; a preview request remains read-only.
Do not require another approval for the same permitted edit.

When both files are requested, reconcile their shared project facts while preserving
client-specific syntax, boundaries, and imports. Do not copy the complete file over
the other, create a new cross-client import convention, or modify managed principles.
If only one file is requested, report any conflicting other copy without silently
expanding the edit. No file or no recognizable editable section: propose placement
and draft content; create/restructure only when the request and policy authorize it.

## Ground the existing sections

| Existing section, or equivalent | Fill from evidence |
|---|---|
| Identity & Purpose | README, package description, accepted product decisions; project, users, core usage scene, and observable result. Do not describe the harness unless it is the project. |
| Stack & Commands | Manifests, lockfiles, runtime/configuration and scripts; useful exact commands, working directory and prerequisites. A selected installation track is not proof of stack. |
| Architecture & Layout | Main boundaries, entry points, data flow and non-obvious locations; link to detail instead of copying a tree or file-by-file catalog. |
| Installed Harness Assets | Confirm installed files; retain useful project-specific routing/exceptions and a valid inventory reference. Do not duplicate every description or claim loaded from presence. |
| Boundaries | Explicit project policy and references to shared controls. Distinguish documented policy from observed enforcement; CODEOWNERS or .gitignore alone does not create approval rules. |
| Verification Gate | Required commands, prerequisites and defined thresholds from actual policy/scripts/CI; affected usage outcomes and critical contracts mapped to existing checks and pass conditions. |

Use equivalent headings when the scaffold differs. Keep the verification mapping
compact; reference the maintained test plan for detail. Distinguish required gates,
optional checks, and genuine coverage gaps. Preserve established model-review routing
only where documented/configured. Put new testing or higher-model delegation ideas
in the proposal, not into the file as already accepted policy. The verification
reference is available for substantive advice, not required for copying an exact
existing test command.

Separate **intended**, **implemented**, and **verified** when they differ. An accepted
usage change is not an implemented feature. Leave unsupported goals, commands,
thresholds, and unresolved A-to-B decisions explicit rather than guessing. Complete
independent sections; mark not applicable only when evidence supports it.

Keep current actionable context in the scaffold. Link to maintained long rationale
and history on demand, never through an automatic import. Move existing content
only within authorized update/relocation scope. An old FILL prompt is not permission
to invent policies, catalog every file, or claim one command proves all work safe;
report a conflicting instruction and use confirmed project evidence.

## Check the bounded edit

Record a compact section-to-source mapping in the report, not a verbose evidence
ledger inside the active file. Finding a command proves it is defined, not that it
passes. Do not install dependencies, run deployments, access production, or execute
state-changing commands merely to fill text. Obey actual required check gates and
report anything not run.

Remove a section's fill marker only when resolved. Keep unresolved markers and a
partial-scaffold notice while any sections remain uncertain. Remove or update the
scaffold-only notice when all sections are resolved; preserve unrelated banners,
managed markers, and imports. Completing the prose does not verify the application.

Check that the diff stays within authorized sections, paths/links/commands match
sources, and shared facts agree across requested files. Report completed sections,
remaining gaps, preserved content, and actual checks. With unchanged evidence,
repeating the fill should not rewrite valid content, duplicate sections, or re-add
removed placeholders. Do not rerun a broad audit just to establish this property.

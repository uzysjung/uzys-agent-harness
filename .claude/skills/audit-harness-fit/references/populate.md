# Populate or Refresh Project Context

Fill existing AGENTS.md / CLAUDE.md project context from current repository evidence.
Keep its structure and language. Make confirmed goals, commands, boundaries, and
verification resources usable for autonomous decisions. Filling a scaffold is a
bounded context edit, not a full skill audit or a new documentation system.

## Locate editable context

Read the target, relevant imports, fill markers, policy, and worktree changes.
Distinguish project-owned sections from shared principles, inline rules, generated
content, and managed blocks. Names alone do not define ownership: AGENTS.md may
contain context and principles; CLAUDE.md may import a separate anchor.

For "fill", complete unresolved context sections. For "refresh/update", also update
supported stale project context while preserving still-valid user content. Report
unrelated stale guidance separately. An explicit fill/update request permits these
bounded edits where policy allows; a preview stays read-only. Reuse that authority
rather than asking again for the same permitted edit.

When both files are requested, align shared project facts while retaining client
syntax, boundaries, and imports. Edit their relevant sections rather than copying
one file wholesale or introducing a cross-client import convention. When only one
file is requested, report conflicting copies outside scope. If no recognizable
editable section exists, propose placement and content; create or restructure only
within the request's authority and project policy.

## Ground the existing sections

| Existing section, or equivalent | Fill from evidence |
|---|---|
| Identity & Purpose | README, package description, accepted product decisions; actual project, users, core usage scene, and observable result. Describe the harness only when it is the project. |
| Stack & Commands | Manifests, lockfiles, runtime/configuration and scripts; exact useful commands, working directory and prerequisites. A selected installation track alone does not establish stack. |
| Architecture & Layout | Main boundaries, entry points, data flow, and non-obvious locations; use maintained references for detail rather than a full file catalog. |
| Installed Harness Assets | Confirmed installed files, useful project-specific routing/exceptions, and a maintained inventory reference; distinguish presence from loading. |
| Boundaries | Explicit project policy and references to shared controls; distinguish documented policy from observed enforcement. CODEOWNERS or .gitignore alone does not establish approval rules. |
| Verification Gate | Required commands, prerequisites and defined thresholds from policy/scripts/CI; affected outcomes and critical contracts mapped to existing checks and pass conditions. |

Use equivalent headings when the scaffold differs. Keep the verification mapping
compact and link to a maintained plan for detail. Distinguish required gates, optional
checks, and genuine coverage gaps. Preserve documented model/tool routing. Put new
testing or routing ideas in proposals rather than recording them as accepted policy.
The verification reference is useful for substantive advice, not a prerequisite for
copying an exact existing command.

Prioritize facts that remove consequential uncertainty: where to work, which contract
matters, what success means, and which existing tool or check can establish it. Keep
implementation and verification methods flexible unless actual policy requires them.
Add such context only in the authorized sections and from supported sources.

Separate **intended**, **implemented**, and **verified** when they differ. Accepted
usage changes can remain unimplemented. Leave unsupported goals, commands, thresholds,
and unresolved A-to-B choices explicit. Complete independent sections and use "not
applicable" only when evidence supports it.

Keep current actionable context in the scaffold. Reference long rationale and history
on demand instead of automatic imports. Move existing content only within authorized
relocation scope. Treat old FILL prompts as scaffolding, not evidence for an invented
policy, feature, or success claim; report conflicts and use confirmed project evidence.

## Check the bounded edit

Give a compact section-to-source mapping in the report rather than an evidence ledger
in the active file. Finding a command establishes its definition, not successful
execution. Filling context authorizes bounded prose edits, not dependency installation,
state-changing product commands, production access, or deployment. Complete applicable
required checks and identify anything not run.

Remove a section's fill marker when resolved. Retain unresolved markers and a partial
scaffold notice while gaps remain. Update or remove only the scaffold notice when all
sections are resolved; preserve unrelated banners, managed markers, and imports.
Completing the prose does not verify the application.

Check the diff's authorized sections, source-consistent paths/links/commands, and shared
facts across requested files. Report completed sections, remaining gaps, preserved
content, and actual checks. With unchanged evidence, another fill should leave valid
text and resolved placeholders unchanged. Establish this from the bounded edit rather
than rerunning a broad audit.

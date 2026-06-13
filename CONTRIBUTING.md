# Contributing to uzys-agent-harness

Thanks for your interest. This project follows a minimal contribution model — small, surgical changes preferred over big refactors.

## Before you start

1. Read [README.md](./README.md) and [docs/REFERENCE.md](./docs/REFERENCE.md)
2. Check existing [issues](https://github.com/uzysjung/uzys-agent-harness/issues) and [tags](https://github.com/uzysjung/uzys-agent-harness/tags)
3. For non-trivial changes: open an issue first to discuss scope

## Development setup

```bash
git clone https://github.com/uzysjung/uzys-agent-harness.git
cd uzys-agent-harness

# Install on this repo itself (dogfooding)
bash scripts/setup-harness.sh --track tooling --project-dir .

# Run the full test suite (≈8 min, 111 tests)
bash scripts/test-harness.sh

# Or run quick mode for iteration (≈5s, 85 tests, skips install tests)
bash scripts/test-harness.sh --quick
```

## Adding a new Track

Tracks are defined in `scripts/setup-harness.sh`. Adding `mytrack`:

1. **Validation list** — add `mytrack` to `VALID_TRACKS` (line ~75)
2. **Track menu** — add `mytrack` to `TRACKS=(...)` (line ~316)
3. **Track-specific rules** — add case in `get_track_rules()` (line ~388)
4. **Optional MCPs** — add row to `templates/track-mcp-map.tsv`:
   ```
   <mcp_name>	<track_pattern>	<command>	<args_json>
   my-mcp	mytrack|full	npx	["-y", "@org/my-mcp"]
   ```
5. **Project CLAUDE template** — create `templates/project-claude/mytrack.md` with stack info
6. **Expected count** — add case in `RULES_EXPECTED` switch (line ~807)
7. **test-harness** — add `mytrack` to `T5_TRACKS` array (line ~178)
8. Update [docs/REFERENCE.md](./docs/REFERENCE.md) and the Tracks table in README files

## Adding a Rule

Rules live in `templates/rules/*.md`. They are non-obvious project-specific invariants. Don't add anything a senior engineer already knows or a linter catches.

1. Create `templates/rules/your-rule.md` (≤60 lines, focused)
2. Decide which Tracks need it:
   - All dev tracks → add to `DEV_RULES` in `scripts/setup-harness.sh`
   - UI tracks (csr-*, ssr-*) → add to `UI_RULES`
   - Single Track → add to `get_track_rules()` case
3. Update `RULES_EXPECTED` counts
4. Run `bash scripts/test-harness.sh --quick` and verify

**Anti-patterns** (don't add):
- "Use `const` instead of `let`" → linter does this
- "No hardcoded secrets" → covered by security-reviewer agent + AgentShield
- "Use spread to avoid mutation" → obvious to senior engineers

## Adding a Hook

Hooks live in `templates/hooks/*.sh`. Two types:

**Auto-registered** (PreToolUse/PostToolUse/SessionStart in `templates/settings.json`):
- Must be **fast** (<10s for async, <2s for blocking)
- Block via `exit 2` + clear stderr message
- Pass via `exit 0` (no output)
- jq fallback required (some users won't have jq)

**On-demand utilities** (called explicitly by commands):
- Documented in `docs/REFERENCE.md`
- Not registered in `settings.json`

After adding:
- Add to `scripts/setup-harness.sh` install list
- Update `HOOKS_EXP` count
- Add to `scripts/test-harness.sh` T2 syntax check list
- Add unit test in T3 (positive + negative)

## Adding a `/uzys:*` command

Commands live in `templates/commands/uzys/*.md`.

1. Create the command file with frontmatter (model, description)
2. Update `gate-check.sh` if it should be gated by previous phases
3. Add to `scripts/setup-harness.sh` install loop
4. Add gate-check unit test in T11 (workflow E2E smoke)

## Updating cherry-picked content

Skills, hooks, or agents pulled from upstream repos (ECC, claude-powerline, etc.) are tracked in `.dev-references/cherrypicks.lock`. **Do not** hand-edit cherry-picked files unless you intend to fork them locally.

### Sync workflow

```bash
# 1. Detect drift (read-only)
bash scripts/sync-cherrypicks.sh

# 2. Auto-apply upstream changes for unmodified files
bash scripts/sync-cherrypicks.sh --apply

# 3. CI gate — exit 1 if any drift remains
bash scripts/sync-cherrypicks.sh --check
```

### Adding a new cherry-pick

1. Register the source repo in `cherrypicks.lock` under `sources.*`:
   ```json
   {
     "url": "https://github.com/org/repo",
     "local_path": ".dev-references/repo",
     "commit": "<pinned SHA>"
   }
   ```
2. Clone into `.dev-references/<name>` (gitignored).
3. Add each file to `cherrypicks[]`:
   ```json
   {
     "source": "<name>",
     "src": "path/in/upstream",
     "dst": "templates/skills/.../file.md",
     "src_hash": "<sha256 of source file>",
     "modified": false
   }
   ```
4. Copy file to `dst`, run `bash scripts/sync-cherrypicks.sh` — should report "in sync".
5. If local tweaks are required, set `modified: true` and note reason in commit.

### Bumping pinned commits

When upstream ships something you want:

1. `cd .dev-references/<name> && git fetch && git checkout <new-sha>`
2. Update `sources.<name>.commit` in `cherrypicks.lock`
3. `bash scripts/sync-cherrypicks.sh` — review diff per file
4. `--apply` for unmodified files; manually merge `modified: true` cases
5. Update `src_hash` values to match new upstream content

### Do NOT

- Silently modify a cherry-pick without flipping `modified: true`
- Commit a file whose `src_hash` mismatches the actual content (`--check` fails CI)
- Bump `commit` SHA without running sync first

## Commit conventions

Conventional Commits format:
```
<type>: <description>

<optional body explaining "why">
```

Types: `feat` / `fix` / `refactor` / `docs` / `test` / `chore` / `perf` / `ci` / `security`

**Focus on "why" in the body.** The "what" is in the diff.

Example:
```
feat(setup): --update orphan prune + stale hook ref cleanup

Why: Existing --update only overwrote files. Templates-removed
files persisted in old installations + settings.json kept stale
hook references → hook-not-found errors.

Scope:
- prune_orphans: delete files in .claude/{rules,agents,commands/uzys,hooks}
  not present in templates
- clean_stale_hook_refs: remove settings.json hook entries pointing
  to non-existent files
```

## Pull Request checklist

- [ ] `bash scripts/test-harness.sh` passes (full or quick if change is trivial)
- [ ] If you added/removed files: counts updated in `scripts/setup-harness.sh` (`HOOKS_EXP`, `RULES_EXPECTED`) and `scripts/test-harness.sh` (T5, T13)
- [ ] Both `templates/` and `.claude/` paths synced (if applicable)
- [ ] `docs/REFERENCE.md` updated for any new asset
- [ ] No regression in `--quick` mode
- [ ] Commit message follows conventions

## Security policy

- **Never commit secrets.** `.env` is gitignored; `.claude/settings.local.json` is gitignored.
- **Run AgentShield** before opening a PR that touches hooks/agents/settings:
  ```bash
  npx ecc-agentshield scan
  ```
- Report security issues privately to the maintainer (see GitHub profile).

## Code style

See `templates/rules/cli-development.md` for Bash conventions:
- BSD/GNU compatibility (macOS + Linux)
- Hook stdin JSON format with jq fallback
- `mktemp` for temp files (no `/tmp/fixed-name`)
- shellcheck must pass

## Out-of-scope contributions

The harness is intentionally **lean**. PRs likely to be declined:
- Adding rules/hooks for things linter or AgentShield already catches
- Track abstractions for stacks with no real user
- Mocking convenience features for tests when real environment works
- "Universal" wrappers around things that already work

## License

By contributing, you agree your contributions will be licensed under the MIT License.

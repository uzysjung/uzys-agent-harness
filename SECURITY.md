# Security Policy

## Supported Versions

`@uzysjung/agent-harness` ships under a CalVer-like scheme
(`v<year − 2000>.<minor>.<patch>`). Only the **latest published minor** receives security fixes.

| Version          | Supported |
| ---------------- | --------- |
| latest `v26.x`   | ✅        |
| anything older   | ❌        |

## Reporting a Vulnerability

Please report security issues **privately** via
[GitHub Security Advisories → "Report a vulnerability"](https://github.com/uzysjung/uzys-agent-harness/security/advisories/new).
Do **not** open a public issue for an unfixed vulnerability.

- **First response:** within 5 business days.
- **Include:** affected version, reproduction steps, and impact.

## Scope — two trust surfaces

This project is an **installer/curator**, so a report can concern one of two distinct surfaces.
Telling us which one helps us route it correctly.

1. **Harness code** — this repository: the CLI, installer, per-CLI transforms, hooks, and the
   files it writes into your project. Issues such as path traversal, command injection, or
   unsafe file overwrite are **in scope** and we fix them directly here.

2. **Curated third-party assets** — the plugins / skills / workflows the harness installs.
   These are maintained by their **upstream authors**. We select them by a **trust-tier
   heuristic** (GitHub stars ≥ 1000 + active maintenance) and verify their **install path** in
   Docker. Report a vulnerability *inside* an upstream asset to that asset's maintainer first,
   then tell us so we can adjust the catalog (de-list, pin, or warn).

### What "vetted" means — and does not

A `vetted` trust tier signals **popularity + install-path verification**, *not* a line-by-line
security review or a prompt-injection scan of an asset's contents. Treat every installed asset
as you would any third-party dependency. The harness pins npm/npx asset versions where the
catalog schema allows it; `claude plugin` / `npx skills` assets resolve to upstream HEAD and
cannot be commit-pinned today (see `docs/COMPATIBILITY.md`).

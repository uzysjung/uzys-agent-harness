# Tracks — what each one installs

A **track** is a preset for what you are building. Pick one or more at step 1 of the wizard (or `--track <name>`); the track decides which rules, agents, skills, and external assets are **pre-checked** at step 3. You can uncheck any pre-checked item before installing, and add anything else at step 3 or with `--with <id>`. A track is a starting point, not a lock-in.

See the [README](../README.md) for the overview, the [usage guide](USAGE.md) for flags and file paths, and the [compatibility matrix](COMPATIBILITY.md) for every asset with its install method and verification. That matrix is generated from the catalog; this page is written by hand, so the matrix wins if the two ever disagree.

---

## The twelve tracks

| Track | For |
|---|---|
| `base` | No stack chosen yet. Principles, method skills, and the testing rules — nothing stack-specific, and `frontend-design` is not pre-checked. Every dev track already includes everything `base` installs, so picking it alongside one adds nothing |
| `csr-supabase` | Vite + React + Supabase |
| `csr-fastify` | Vite + React + Fastify |
| `csr-fastapi` | Vite + React + FastAPI |
| `ssr-nextjs` | Next.js (App Router) |
| `ssr-htmx` | htmx + FastAPI |
| `data` | Python data work — DuckDB, PySide6 |
| `tooling` | Bash + Markdown projects with no app stack (a CLI, a docs repo, this harness itself) |
| `full` | Every dev track at once |
| `executive` | Proposals, due diligence, decks, financial models |
| `project-management` | PM workflow and reviews |
| `growth-marketing` | Growth and content marketing |

"Dev tracks" below means the first nine. The last three are business tracks: they get the common rules and the all-track skills, and no development tooling.

---

## What every track gets

| | Dev tracks | Business tracks |
|---|---|---|
| **Rules** | git policy · change management · doc governance · test policy · ship checklist (+ CLI development on `tooling` and `full`; + UI components — build React/Next.js UI with shadcn/ui and check it with `@shadcn/lint` — on `csr-*`, `ssr-*`, and `full`) | git policy · change management · doc governance |
| **Hooks** | session start · protect files | same |
| **Agents** | `reviewer` · `implementer` (+ `data-analyst` on `data`/`full`, `strategist` on `executive`/`full`) | `reviewer` (+ `strategist` on `executive`) |
| **Skills on every track** | `north-star` · `objective-brief` · `gh-issue-workflow` · `audit-harness-fit` | same |
| **Method skills** | `user-centered-explanation` · `audit-service-gaps` · `multi-persona-review` · `recurrence-prevention` · `compaction-handoff` · `self-hosted-github-runner` · `model-orchestration` · `external-model-consult` · `natural-korean` · `multi-model-debate` | — |
| **CI scaffold** | GitHub Actions fill-in templates under `.github/workflows/`, written only when the file does not exist yet (see [below](#workflow-bundles)) | — |
| **Dev tools** | `frontend-design` (`csr-*` · `ssr-*` · `full`) | — |
| **MCP servers** (`.mcp.json`) | `context7` (+ `chrome-devtools` on `csr-*`/`ssr-*`/`full`, `railway-mcp-server` on `csr-*`/`ssr-htmx`/`full`, `supabase` on `csr-supabase`/`full` — any track can add `chrome-devtools` or `railway-mcp-server` with `--with`, and `vercel` or `github-mcp` with `--with` on any track) | `context7` |

The method skills are built into this repo — written and maintained here, bundled as templates, no separate download. They install as native skills on all four CLIs: Claude Code reads `.claude/skills/`, and Codex, OpenCode, and Antigravity read the same `.agents/skills/<id>/`. Each can be dropped with `--without <id>` — or installed alone, without the harness, with `npx skills add uzysjung/uzys-agent-harness --skill <id> -a claude-code` ([how](USAGE.md#one-skill-without-the-harness)).

| Skill | What it does |
|---|---|
| `north-star` | Direction baseline — the north-star metric as a proxy, pillars, will/won't, decision gates — and the roadmap derived from it |
| `objective-brief` | Normalizes work about to be delegated, designed, or carried out in several steps into one brief: objective, inputs, invariants, success criteria, boundaries, autonomy, verification. One-line questions and routine edits get no brief |
| `gh-issue-workflow` | GitHub Issues as the async backlog and decision channel, with read-only, draft, and remote-write stages kept apart |
| `audit-harness-fit` | Checks whether the instructions and skills your agent loads still fit: needless questions and repeated checks, contradicting decisions, missing context, procedures a better model no longer needs. Fills your `CLAUDE.md` / `AGENTS.md` project sections from repository evidence. Read-only unless you ask it to apply |
| `user-centered-explanation` | Explains problems, changes, and choices as what the user does and sees, in the user's language; an approval request arrives as context → problem → options → recommendation, with before/after for screens and flows |
| `audit-service-gaps` | Lists gaps against the north-star baseline through three lenses, then checks how a reference service closed each before proposing a fix |
| `multi-persona-review` | Reviews one artifact through independent personas in parallel and returns deduplicated, severity-ranked findings |
| `recurrence-prevention` | When the same defect comes back: confirm it really recurred, decide whether it was a simple slip or a harness problem, then repair or replace the countermeasure — a note, a rule, or a structural gate — based on evidence |
| `compaction-handoff` | Before the agent's context is compacted (its working memory trimmed): save durable state, a git snapshot, and one resume point |
| `self-hosted-github-runner` | When hosted runners stop (billing, quota, outage): run the repo's existing workflow files on a Docker self-hosted runner instead of copying CI steps into a script |
| `model-orchestration` | Which model, how much reasoning effort, and when to delegate — reuse context first, add workers or independent review only when their contribution justifies the cost |
| `external-model-consult` | Ask a non-Claude model (Gemini via `agy`, or Codex) for natural Korean phrasing, a second opinion, concise restructuring, or image generation. Installing it always succeeds; at run time it needs that provider's CLI and login, and tells you so when they are missing |
| `natural-korean` | Write, answer, translate, and revise in Korean that reads as Korean — keeps meaning and register, removes translationese. Sibling of `user-centered-explanation`: that one decides *what* to say, this one *how the Korean is written*. If you never write Korean, drop it with `--without natural-korean` |
| `multi-model-debate` | Has two or three different real models answer independently, then cross-examines only the disagreements that change the decision and checks them against sources, calculations, or tests. Uses whichever routes you have — `external-model-consult`'s CLIs alone give two different models; a missing route is reported, not faked |

Three more built-in skills are **opt-in on every track**: `gemini-delegate` · `chatgpt-delegate` · `genspark-delegate` hand work to Gemini, ChatGPT, or Genspark on the web through your own logged-in Chrome (Genspark also generates images). Installing them only copies files; running them needs a browser tool in your CLI — Claude Code with Claude in Chrome, or the Codex app; the Codex CLI has no browser — and your signed-in account. Add them at step 3 or with `--with <id>`.

---

## What each stack adds

Pre-checked on top of the set above. Rows marked **opt-in** are never pre-checked on any track — add them at step 3 or with `--with <id>`; that includes every `⚠ experimental` asset.

### Frontend

| Asset | What | Tracks |
|---|---|---|
| `react-best-practices` | React hook, performance, and component patterns (vercel-labs) | `csr-*` · `ssr-nextjs` · `full` |
| `shadcn-ui` | Radix-based components + Tailwind theme (shadcn) | `csr-*` · `ssr-nextjs` · `full` |
| `web-design-guidelines` | Visual hierarchy, colour, spacing (vercel-labs) — `frontend-design` covers the default | opt-in |
| `taste-skill` | Learns your design language, then adjusts variety, motion, and density (Leonxlnx) | opt-in |
| `jakubkrehel-skills` | Typography, OKLCH colour, accessibility, layout, UX writing — one concern per skill | opt-in |
| `scroll-world` | Scroll-driven 3D landing pages (oso95) | opt-in |
| `preline` | Preline UI component patterns | opt-in |
| `tauri-desktop` | Tauri desktop rule template (this project) | opt-in |

### Backend

| Asset | What | Tracks |
|---|---|---|
| `supabase-agent-skills` | RLS, auth, edge functions, realtime (Supabase official) | `csr-supabase` · `full` |
| `postgres-best-practices` | Schema, index, and query patterns (Supabase official) | `csr-supabase` · `full` |
| `railway-skills` | Railway deploy and project/service/env management — ⚠ experimental | opt-in |
| `railway-mcp-server` | Railway's official remote MCP (`https://mcp.railway.com`) in `.mcp.json`, Codex and OpenCode — sign in on first use · ⚠ experimental | opt-in (default on `csr-*`/`ssr-htmx`/`full`) |
| `vercel` | Vercel's official remote MCP (`https://mcp.vercel.com`) in `.mcp.json`, Codex and OpenCode — sign in on first use | opt-in |
| `vercel-cli` | The Vercel deploy CLI as a `devDependency` | opt-in |
| `supabase-cli` · `netlify-cli` | The deploy CLI as a `devDependency`. Pick the one your project deploys to | opt-in |

### Bundled stack skill

One more skill ships inside the harness and follows the track, not the catalog — it does not appear at step 3 and has no `--with` id: `ui-visual-review` on `csr-*` · `ssr-*` · `full` (screenshot capture, baseline diff, and a review gate for UI changes).

### Data and business

| Asset | What | Tracks |
|---|---|---|
| `anthropic-data-plugin` | Visualization + SQL exploration (Anthropic official) | `data` · `full` |
| `anthropic-document-skills` | pptx / docx / xlsx / pdf authoring (Anthropic official) | `executive` · `full` |
| `finance-skills` | Financial analyst, SaaS metrics, investment advisor (3 skills) | opt-in |
| `marketingskills` | CRO, copywriting, SEO / AI-SEO, ads, growth (45 skills) | opt-in |

The `project-management` and `growth-marketing` tracks pre-check no external asset of their own; add `marketingskills` if you want it.

### Dev tools, understanding, visual

All opt-in, on any track: `security-guidance` · `claude-security` (security review) — `agent-browser` · `claude-video` · `understand-anything` (understanding) — `frontend-slides` · `marp-slide` · `gsap-skills` · `remotion` · `ppt-master` · `hyperframes` (visual & media; `hyperframes` renders HTML to MP4 and is a Claude Code plugin) — `game-engine`. One-line descriptions for each are in the [compatibility matrix](COMPATIBILITY.md).

### Workflow bundles

Both opt-in. [WORKFLOWS.md](WORKFLOWS.md) compares them and says when you don't need one.

| Asset | What | Source |
|---|---|---|
| `openspec` | Spec-driven changes to an existing codebase (propose → apply → archive) — a team contract, for teams that adopted it | Fission-AI |
| `bmad-method` | Multi-agent agile workflow (PM / Architect / Dev) — for team-scale delivery with fixed roles | bmad-code-org |

**CI scaffold** (`ci-scaffold`, this project — on by default for dev tracks; skip it with `--without ci-scaffold`): fill-in GitHub Actions templates — tag-triggered CI, a real-database service container, a coverage gate, Playwright E2E on UI tracks — matched to your tracks (node / python / both). The only asset that writes under `.github/`: it writes only files that do not exist yet and never overwrites an existing workflow file; `uninstall` leaves `.github/` alone. The workflows run only after you commit them. `update` does not add them to an existing install — run `install` again to get them.

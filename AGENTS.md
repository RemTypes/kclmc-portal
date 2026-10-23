<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# KCLMC Platform: Engineering & PR Workflow Rules

## 1. Absolute Rule: No Direct Pushes to Main
- **NEVER push commits directly to `main`, `cloudflare-preview`, or any production branch on any remote.**
- **ALL** code changes, documentation updates, and bug fixes must be delivered via Pull Requests (PRs).
- Direct pushes to `main` violate repository release discipline.

## 2. Multi-PR Track Classification
Before making changes, determine the task track and cut the branch from fresh `origin/main`:

### Track A: Quick Updates (`quick/<slug>` or `fix/<slug>`)
- **Use For**: Text/copy updates, emergency bug fixes, single-route corrections, styling tweaks, small config adjustments.
- **Scope Limit**: Kept atomic and minimal (typically under ~100 lines across 1–3 files).
- **Branching**:
  ```bash
  git fetch origin main
  git checkout -b quick/<slug> origin/main
  ```
- **PR Title**: `quick: <concise summary>` or `fix: <concise summary>`

### Track B: Standard Features (`feat/<slug>`)
- **Use For**: New user features, new routes, self-contained tools (e.g. guide additions, new export formats, scanner enhancements).
- **Branching**:
  ```bash
  git fetch origin main
  git checkout -b feat/<slug> origin/main
  ```
- **PR Title**: `feat: <concise summary>`

### Track C: Architectural Migrations (`epic/<slug>` or `arch/<slug>`)
- **Use For**: Long-running infrastructure changes, such as the Supabase replacement/migration (`epic/replace-supabase`).
- **Strategy (Seams & Milestones)**:
  - Do not create a single monolithic PR. Break the migration into decoupled milestones merged behind domain service interfaces/seams (see [ADR 0002](docs/adr/0002-storage-adapter-seam-for-roster.md)).
  - Milestone PRs can target the epic branch or feature-flagged PRs into `main`.
- **Automatic Sync on Context Switch**:
  - Whenever resuming work on an `epic/*` branch after quick fixes have been merged into `main`, **ALWAYS** sync first:
    ```bash
    git checkout <epic-branch>
    git fetch origin main
    git merge origin/main
    ```
  - This ensures all recently merged quick fixes automatically flow into the migration branch with zero drift.

## 3. Mandatory Pre-PR Verification Gate
Before pushing any branch or opening a PR, the agent MUST run and pass the full verification suite:
1. **Automated Tests**: `npm test` (all tests passing, 233+ tests).
2. **TypeScript Compilation**: `npx tsc --noEmit` (0 errors).
3. **Edge Worker Build**: `npm run build:worker` (OpenNext Cloudflare worker compiles cleanly to `.open-next/worker.js`).

## 4. Pull Request Creation (`gh pr create`)
Once verification passes:
1. Push the branch to remote:
   ```bash
   git push -u origin <branch-name>
   ```
2. Create the Pull Request using GitHub CLI (`gh pr create`), referencing the template from the `pr` skill:
   - **Summary**: Concise overview and diagram/pseudocode/call-tree if relevant.
   - **Evidence**: Passing test count, compilation verification.
   - **Merge Danger & Blast Radius**: Reversible (two-way) vs irreversible (one-way), blast radius rating.
3. Provide the full PR URL in the conversation so the user can inspect and review changes before merging.

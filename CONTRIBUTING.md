# Contributing to Skilldex

Thanks for taking the time to contribute! Skilldex is a local-first Electron
dashboard for discovering and organizing agent skills. This guide covers how to
get set up, the conventions the codebase follows, and how to get a change
merged.

## Table of contents

- [Code of conduct](#code-of-conduct)
- [Getting set up](#getting-set-up)
- [Project layout](#project-layout)
- [Development workflow](#development-workflow)
- [Coding guidelines](#coding-guidelines)
- [Testing](#testing)
- [Commit and PR guidelines](#commit-and-pr-guidelines)
- [Reporting issues](#reporting-issues)

## Code of conduct

Be respectful and constructive. Assume good intent, keep discussion focused on
the work, and help newcomers find their footing.

## Getting set up

You'll need [Node.js](https://nodejs.org/) (an active LTS release) and npm.

```bash
git clone https://github.com/klubinskak/skilldex.git
cd skilldex
npm install
npm run dev
```

`npm run dev` launches the app through `electron-vite` with hot reloading for the
renderer.

## Project layout

Code is organized by feature, not by generic presentation folders:

```text
src/
  app/                     # composition only
  features/
    dashboard/             # dashboard state and orchestration
    skills/                # catalog model, skill list, favourites, detail
    navigation/            # workspace navigation
    settings/              # source configuration
  ui/                      # shared shadcn/ui primitives only
  lib/                     # shared helpers
electron/
  main/
    workspace/             # SkillWorkspace module (behind the preload seam)
```

Each feature owns its model, state, and UI. The `app` module only composes
features. On the Electron main side, the `SkillWorkspace` module
(`electron/main/workspace/`) exposes a small interface — get config, get
snapshot, configure sources, and skill-change intents — while directory walking,
manifest parsing, dedup, and settings persistence stay hidden behind that seam.
The renderer reaches it only through the context-isolated `window.skilldex`
preload bridge; it has no direct Node.js or filesystem access.

## Development workflow

1. **Find or open an issue.** Issues are tracked in GitHub Issues. For anything
   beyond a small fix, open or comment on an issue first so the approach can be
   agreed on before you write code.
2. **Branch from `main`.** Use a short, descriptive branch name, e.g.
   `fix/skill-dedup` or `feat/git-provenance`.
3. **Make your change** following the guidelines below.
4. **Verify locally** before pushing:

   ```bash
   npm run typecheck
   npm run lint
   npm run test
   npm run build
   ```

   If your change touches packaging or the Electron main process, also run:

   ```bash
   npm run package
   ```

5. **Open a pull request** against `main`.

## Coding guidelines

- **TypeScript everywhere.** Keep the build clean — `npm run typecheck` must
  pass with no errors.
- **Respect the architecture.** New capabilities that touch skill discovery,
  Git inspection, manifest parsing, or settings go *behind* the `SkillWorkspace`
  seam, not into the renderer. Callers request a normalized workspace snapshot
  and send skill-change intents; the details stay inside the module.
- **Keep features self-contained.** A feature owns its model, state, and UI.
  Don't reach across features; share through `src/lib` or the `SkillWorkspace`
  interface instead.
- **Shared UI lives in `src/ui`.** Only put generic shadcn/ui primitives there —
  feature-specific components stay in their feature.
- **No direct Node/filesystem access from the renderer.** Everything crosses the
  context-isolated preload bridge (`window.skilldex`).
- **Lint clean.** `npm run lint` (oxlint) must pass. Follow the existing
  formatting and naming conventions in the files you touch.

## Testing

Tests run with [Vitest](https://vitest.dev/):

```bash
npm run test
```

Most logic lives on the Electron main side under
`electron/main/workspace/__tests__/`, with model tests colocated in
`src/features/`. When you add or change behavior:

- Add or update tests alongside the code (`*.test.ts`).
- Cover the `SkillWorkspace` seam's behavior — directory dedup, manifest
  parsing, per-source error isolation, favourites, and Git provenance are all
  exercised by existing tests; follow their style.
- Make sure the full suite passes before opening a PR.

## Commit and PR guidelines

- Write clear, imperative commit messages ("Add Git provenance deep-links", not
  "added stuff").
- Keep each PR focused on a single concern; split unrelated changes.
- In the PR description, explain **what** changed and **why**, and link the
  issue it addresses (e.g. `Closes #42`).
- Make sure typecheck, lint, tests, and build all pass. CI and reviewers will
  check the same.
- Update the README or docs when your change affects setup, architecture, or
  user-facing behavior.

## Reporting issues

Open a [GitHub issue](https://github.com/klubinskak/skilldex/issues) and include:

- What you expected to happen and what actually happened.
- Steps to reproduce.
- Your OS and app version.
- Relevant logs or screenshots.

For security-sensitive reports, please avoid filing a public issue with exploit
details — reach out to the maintainer privately first.

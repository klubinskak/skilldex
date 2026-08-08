# Skilldex

Skilldex is a local-first dashboard for developers to discover, organize, and favourite their agent skills across global environments, projects, and Git repositories.

## Current foundation

- React, TypeScript, Vite, Tailwind CSS, and shadcn/ui
- Interactive overview dashboard with search and favourites
- Normalized sample catalog showing global, project, and repository skill sources
- A UI seam ready for a future `SkillWorkspace` module that discovers local skill directories and Git metadata

## Architecture

Code is organized by feature, not by generic presentation folders:

```text
src/
  app/                    # composition only
  features/
    dashboard/             # dashboard state and orchestration
    skills/                # catalog model, skill list, favourites
    navigation/            # workspace navigation
    overview/              # metrics
    repositories/          # repository watch
  ui/                      # shared shadcn/ui primitives only
```

Each feature owns its model, state, and UI. The app module only composes features. The future `SkillWorkspace` module will provide a small interface for normalized workspace snapshots and change intents; filesystem and Git implementations remain behind that seam.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run build
npm run lint
```

## Next implementation slice

Introduce a native filesystem adapter (Tauri is the intended shell) and a `SkillWorkspace` module. Its callers should only request a normalized workspace snapshot and send skill-change intents; directory walking, manifest parsing, Git inspection, and settings persistence remain inside the module.

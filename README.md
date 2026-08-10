# Skilldex

![Skilldex dashboard](docs/screenshots/hero.png)

Skilldex is a local-first dashboard for developers to discover, organize, and favourite their agent skills across global environments, projects, and Git repositories.

## Current foundation

- Electron, React, TypeScript, Tailwind CSS, and shadcn/ui
- Context-isolated Electron preload bridge; the renderer has no direct Node.js or filesystem access
- Interactive overview dashboard with search and favourites
- Live scan of local skill directories, normalized across Personal, Plugin, and Project sources
- A `SkillWorkspace` module behind the preload seam that discovers skill directories, dedups across roots, and isolates per-source errors

## Architecture

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
```

Each feature owns its model, state, and UI. The app module only composes features. On the Electron main side, the `SkillWorkspace` module (`electron/main/workspace/`) exposes a small interface — get config, get snapshot, configure sources, and skill-change intents — while directory walking, manifest parsing, dedup, and settings persistence stay hidden behind that seam. The renderer reaches it only through the context-isolated `window.skilldex` preload bridge.

## Run locally

```bash
npm install
npm run dev
```

## Verify

```bash
npm run build
npm run lint
npm run package
```

## Extending

New capabilities go behind the `SkillWorkspace` seam rather than into the renderer. Callers request a normalized workspace snapshot and send skill-change intents; directory walking, manifest parsing, Git inspection, dedup, and settings persistence all stay inside the module. Skill scaffolding, enable/disable, and Git provenance (upstream host deep-links from `.git/config`) already live there.
